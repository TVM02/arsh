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
import { Search, GraduationCap, Mail, Phone, User, Users } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { madrasaMatchesMekhala } from "@/lib/madrasaHierarchy";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Chunk array helper
function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export default function MekhalaTeachersPage() {
  const { userData } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [madarsas, setMadarsas] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGender, setFilterGender] = useState("all");
  const [filterMadarsa, setFilterMadarsa] = useState("all");

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text("Teachers List", 14, 16);
      
      const headers = ["Name", "MSR ID", "Madrasa", "Qualification", "Degree", "Phone"];
      const rows = filteredTeachers.map((t) => [
        (t.name || t.fullName || "N/A").toUpperCase(),
        t.mhrId || "N/A",
        getMadarsaName(t.madarsaId).toUpperCase(),
        (t.qualification || "N/A").toUpperCase(),
        (t.degree || "N/A").toUpperCase(),
        t.phone || "N/A",
      ]);

      autoTable(doc, {
        startY: 22,
        head: [headers],
        body: rows,
        styles: { fontSize: 8 },
      });
      doc.save("teachers.pdf");
      toast.success("PDF exported successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export PDF");
    }
  };

  const handleExportCSV = () => {
    const headers = ["Name", "MSR ID", "Madrasa", "Qualification", "Degree", "Phone"];
    const rows = filteredTeachers.map((t) => [
      (t.name || t.fullName || "N/A").toUpperCase(),
      t.mhrId || "N/A",
      getMadarsaName(t.madarsaId).toUpperCase(),
      (t.qualification || "N/A").toUpperCase(),
      (t.degree || "N/A").toUpperCase(),
      t.phone || "N/A",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teachers.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  const fetchTeachersData = useCallback(async () => {
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
        setTeachers([]);
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

      const allowedIds = Array.from(madarsaIdsSet);
      
      // Query teachers in chunks of 30 due to Firestore "in" limit
      const teacherChunks = chunk(allowedIds, 30);
      const teacherPromises = teacherChunks.map(async (c) => {
        const q = query(collection(db, "teachers"), where("madarsaId", "in", c));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      });

      const chunkResults = await Promise.all(teacherPromises);
      const allTeachers = chunkResults.flat();

      // Filter out duplicates if any
      const uniqueTeachers = Array.from(
        new Map(allTeachers.map((t) => [t.id, t])).values()
      );

      // Sort by name
      uniqueTeachers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setTeachers(uniqueTeachers);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching mekhala teachers:", error);
      toast.error("Failed to load teachers data");
      setLoading(false);
    }
  }, [userData]);

  useEffect(() => {
    if (userData && userData.role === "mekhala_admin") {
      fetchTeachersData();
    } else {
      setLoading(false);
    }
  }, [userData, fetchTeachersData]);

  // Filter teachers
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const name = t.name || t.fullName || "";
      const matchesSearch =
        !searchTerm ||
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.mhrId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.email || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesGender = filterGender === "all" || (t.gender || "").toLowerCase() === filterGender.toLowerCase();

      // Match Madrasa Filter (either by mid or id)
      let matchesMadarsa = true;
      if (filterMadarsa !== "all") {
        const selectedM = madarsas.find((m) => m.id === filterMadarsa);
        const selectedMID = selectedM?.madarsaId;
        const teacherMID = t.madarsaId;
        matchesMadarsa =
          teacherMID === filterMadarsa ||
          teacherMID === selectedMID ||
          String(teacherMID).replace(/^[a-zA-Z]+-/, "") === String(selectedMID).replace(/^[a-zA-Z]+-/, "");
      }

      return matchesSearch && matchesGender && matchesMadarsa;
    });
  }, [teachers, searchTerm, filterGender, filterMadarsa, madarsas]);

  // Get Madrasa Name helper
  const getMadarsaName = (madarsaId) => {
    const m = madarsas.find(
      (m) =>
        m.id === madarsaId ||
        m.madarsaId === madarsaId ||
        String(m.madarsaId).replace(/^[a-zA-Z]+-/, "") === String(madarsaId).replace(/^[a-zA-Z]+-/, "")
    );
    return m ? m.name : madarsaId || "N/A";
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading teachers...</div>
        </div>
      </Layout>
    );
  }

  if (!userData || userData.role !== "mekhala_admin") {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
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
                  <Users className="h-6 w-6 text-indigo-600" />
                  Teacher Overview ({filteredTeachers.length})
                </h1>
                <p className="text-sm text-gray-500">
                  Manage and view teachers across your assigned mekhala districts
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={filterMadarsa}
                  onChange={(e) => setFilterMadarsa(e.target.value)}
                >
                  <option value="all">All Madrasas</option>
                  {madarsas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
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

          {/* Teachers List Table */}
          <Card>
            <CardContent className="pt-6">
              {filteredTeachers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No teachers found matching filters.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher Name</TableHead>
                        <TableHead>MSR ID</TableHead>
                        <TableHead>Madrasa</TableHead>
                        <TableHead>Qualification</TableHead>
                        <TableHead>Degree</TableHead>
                        <TableHead>Contact</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTeachers.map((t) => (
                        <TableRow key={t.id} className="hover:bg-gray-50">
                          <TableCell className="font-semibold text-gray-900">
                            {(t.name || t.fullName || "N/A").toUpperCase()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{t.mhrId || "N/A"}</Badge>
                          </TableCell>
                          <TableCell className="text-gray-700">
                            {getMadarsaName(t.madarsaId).toUpperCase()}
                          </TableCell>
                          <TableCell>{(t.qualification || "N/A").toUpperCase()}</TableCell>
                          <TableCell>{(t.degree || "N/A").toUpperCase()}</TableCell>
                          <TableCell>
                            <div className="text-xs text-gray-500 space-y-1">
                              {t.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {t.phone}
                                </div>
                              )}
                              {t.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {t.email}
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
