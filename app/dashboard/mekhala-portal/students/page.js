"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import useAuthStore from "@/lib/authStore";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, GraduationCap, ArrowLeft, Mail, Phone, Calendar, User , Loader2 } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { madrasaMatchesMekhala } from "@/lib/madrasaHierarchy";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SearchableSelect } from "@/components/ui/searchable-select";

// Chunk array helper
function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export default function MekhalaStudentsPage() {
  const { userData } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [madarsas, setMadarsas] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [filterMadarsa, setFilterMadarsa] = useState("all");

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text("Students List", 14, 16);
      
      const headers = ["Name", "Adm. No.", "Madrasa", "Class", "Gender", "Phone"];
      const rows = filteredStudents.map((s) => [
        (s.fullName || s.name || "N/A").toUpperCase(),
        s.admissionNumber || "N/A",
        getMadarsaName(s.madarsaId).toUpperCase(),
        String(s.classLevel || "N/A").toUpperCase(),
        (s.gender || "N/A").toUpperCase(),
        s.phone || "N/A",
      ]);

      autoTable(doc, {
        startY: 22,
        head: [headers],
        body: rows,
        styles: { fontSize: 8 },
      });
      doc.save("students.pdf");
      toast.success("PDF exported successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export PDF");
    }
  };

  const handleExportCSV = () => {
    const headers = ["Name", "Admission No", "Madrasa", "Class", "Gender", "Phone"];
    const rows = filteredStudents.map((s) => [
      (s.fullName || s.name || "N/A").toUpperCase(),
      s.admissionNumber || "N/A",
      getMadarsaName(s.madarsaId).toUpperCase(),
      String(s.classLevel || "N/A").toUpperCase(),
      (s.gender || "N/A").toUpperCase(),
      s.phone || "N/A",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  const fetchStudentsData = useCallback(async () => {
    try {
      setLoading(true);
      const mekhalaId = userData.uid || userData.id;
      const isSubMekhala = userData.mekhalaDocType === "sub_mekhala";

      // 1. Fetch all madarsas first
      const madarsasSnapshot = await getDocs(collection(db, "madarsas"));
      const allMadarsas = madarsasSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      let assignedMadarsas = [];

      if (isSubMekhala) {
        const specificName = userData.mekhalaName || userData.name || "";
        assignedMadarsas = allMadarsas.filter((m) =>
          madrasaMatchesMekhala(m, specificName)
        );
      } else {
        // District-level mekhala: fetch districts
        const districtsSnapshot = await getDocs(
          query(collection(db, "districts"), where("mekhalaId", "==", mekhalaId))
        );
        const districtsData = districtsSnapshot.docs.map((d) => d.data());
        const collectionDistrictNames = districtsData.map((d) => d.name);
        const userDataDistricts = userData.districts || userData.assignedDistricts || [];
        const allDistrictNamesLower = new Set([
          ...collectionDistrictNames.map((n) => n.toLowerCase()),
          ...userDataDistricts.map((n) => n.toLowerCase()),
        ]);

        assignedMadarsas = allMadarsas.filter(
          (m) =>
            allDistrictNamesLower.has(m.district?.toLowerCase()) ||
            m.mekhalaId === mekhalaId
        );
      }

      setMadarsas(assignedMadarsas);

      if (assignedMadarsas.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // Gather all possible variants of madarsa IDs to query
      const madarsaIdsSet = new Set();
      assignedMadarsas.forEach((m) => {
        const mid = m.madarsaId || m.id;
        if (mid) {
          const strId = String(mid);
          const numericStr = strId.replace(/^[a-zA-Z]+-/, "");
          const numericVal = Number(numericStr);

          madarsaIdsSet.add(strId);
          madarsaIdsSet.add(numericStr);
          madarsaIdsSet.add(`mid-${numericStr}`);
          madarsaIdsSet.add(`mld-${numericStr}`);
          if (Number.isFinite(numericVal) && numericVal > 0) {
            madarsaIdsSet.add(numericVal);
          }
        }
      });

      let allStudents = [];

      if (!isSubMekhala) {
        // Fetch all students for the mekhala using single direct query (extremely fast)
        const q = query(collection(db, "students"), where("mekhalaId", "==", mekhalaId));
        const snap = await getDocs(q);
        allStudents = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      } else {
        const allowedIds = Array.from(madarsaIdsSet);
        if (allowedIds.length > 0) {
          // Query students in chunks of 30 due to Firestore "in" limit
          const studentChunks = chunk(allowedIds, 30);
          const studentPromises = studentChunks.map(async (c) => {
            const q = query(collection(db, "students"), where("madarsaId", "in", c));
            const snap = await getDocs(q);
            return snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));
          });

          const chunkResults = await Promise.all(studentPromises);
          allStudents = chunkResults.flat();
        }
      }

      // Filter out duplicates if any
      const uniqueStudents = Array.from(
        new Map(allStudents.map((s) => [s.id, s])).values()
      ).filter((s) => !s.deleted);

      // Sort by name or class
      uniqueStudents.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
      setStudents(uniqueStudents);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching mekhala students:", error);
      toast.error("Failed to load students data");
      setLoading(false);
    }
  }, [userData]);

  useEffect(() => {
    if (userData && userData.role === "mekhala_admin") {
      fetchStudentsData();
    } else {
      setLoading(false);
    }
  }, [userData, fetchStudentsData]);

  // Extract unique classes
  const classes = useMemo(() => {
    const classSet = new Set();
    students.forEach((s) => {
      let c = s.classLevel || s.class;
      if (c) classSet.add(String(c).toUpperCase());
    });
    return Array.from(classSet).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(a).localeCompare(String(b));
    });
  }, [students]);

  const getMadarsaName = (madarsaId) => {
    const m = madarsas.find(
      (m) =>
        m.id === madarsaId ||
        m.madarsaId === madarsaId ||
        String(m.madarsaId).replace(/^[a-zA-Z]+-/, "") === String(madarsaId).replace(/^[a-zA-Z]+-/, "")
    );
    return m ? m.name : madarsaId || "N/A";
  };

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        (s.fullName || "").toLowerCase().includes(searchLower) ||
        (s.admissionNumber || "").toLowerCase().includes(searchLower) ||
        (s.email || "").toLowerCase().includes(searchLower) ||
        (s.madarsaId || "").toLowerCase().includes(searchLower) ||
        (getMadarsaName(s.madarsaId) || "").toLowerCase().includes(searchLower);

      const matchesClass = filterClass === "all" || String(s.classLevel || s.class || "").toUpperCase() === filterClass;
      const matchesGender = filterGender === "all" || (s.gender || "").toLowerCase() === filterGender.toLowerCase();

      // Match Madrasa Filter (either by mid or id)
      let matchesMadarsa = true;
      if (filterMadarsa !== "all") {
        const selectedM = madarsas.find((m) => m.id === filterMadarsa);
        const selectedMID = selectedM?.madarsaId;
        const studentMID = s.madarsaId;
        matchesMadarsa =
          studentMID === filterMadarsa ||
          studentMID === selectedMID ||
          String(studentMID).replace(/^[a-zA-Z]+-/, "") === String(selectedMID).replace(/^[a-zA-Z]+-/, "");
      }

      return matchesSearch && matchesClass && matchesGender && matchesMadarsa;
    });
  }, [students, searchTerm, filterClass, filterGender, filterMadarsa, madarsas]);

  // Get Madrasa Name helper

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center justify-center gap-3 text-teal-800">
            <Loader2 className="h-10 w-10 animate-spin" />
            </div>
        </div>
      </Layout>
    );
  }

  if (!userData || userData.role !== "mekhala_admin") {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">
              You need to be logged in as a Mekhala Admin to access this page.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <ProtectedRoute requiredRole="mekhala_admin">
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <GraduationCap className="h-6 w-6 text-green-600" />
                  Student Overview ({filteredStudents.length})
                </h1>
                <p className="text-sm text-gray-500">
                  Manage and view students across your assigned mekhala districts
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleExportCSV}>
                Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportPDF}>
                Export PDF
              </Button>
            </div>
          </div>

          {/* Filters Card */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by name, ID, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Madrasa filter */}
                <div className="w-full">
                  <SearchableSelect
                    value={filterMadarsa}
                    onValueChange={setFilterMadarsa}
                    placeholder="All Madrasas"
                    searchPlaceholder="Search madrasa..."
                    options={[
                      { label: "All Madrasas", value: "all" },
                      ...madarsas.map((m) => ({
                        label: `${m.name} ${m.madarsaId ? `(${m.madarsaId})` : ""}`,
                        value: m.id,
                      })),
                    ]}
                  />
                </div>

                {/* Class filter */}
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                >
                  <option value="all">All Classes</option>
                  {classes.map((cls) => (
                    <option key={cls} value={cls}>
                      Class {cls}
                    </option>
                  ))}
                </select>

                {/* Gender filter */}
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value)}
                >
                  <option value="all">All Genders</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Students List Table */}
          <Card>
            <CardContent className="pt-6">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No students found matching filters.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Admission No</TableHead>
                        <TableHead>Madrasa</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Contact</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((s) => (
                        <TableRow key={s.id} className="hover:bg-gray-50">
                          <TableCell className="font-semibold text-gray-900">
                            {(s.fullName || "N/A").toUpperCase()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{s.admissionNumber || "N/A"}</Badge>
                          </TableCell>
                          <TableCell className="text-gray-700">
                            {getMadarsaName(s.madarsaId).toUpperCase()}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                              CLASS {String(s.classLevel || "N/A").toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{(s.gender || "N/A").toUpperCase()}</TableCell>
                          <TableCell>
                            <div className="text-xs text-gray-500 space-y-1">
                              {s.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {s.phone}
                                </div>
                              )}
                              {s.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {s.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
