"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Users, Phone, Search, Loader2 } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Pagination } from "@/components/ui/pagination";

const getMadarsaIdVariants = (userData) => {
  const explicitIds = [
    userData?.madarsaId,
    userData?.madrasaId,
    userData?.mid,
    userData?.madarsa?.madarsaId,
    userData?.madarsa?.id,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const variants = new Set();
  explicitIds.forEach((id) => {
    variants.add(id);
    const numericStr = id.replace(/^[a-zA-Z]+-/, "");
    if (numericStr) {
      variants.add(numericStr);
      variants.add(`mid-${numericStr}`);
      variants.add(`mld-${numericStr}`);
    }
    const numericVal = Number(numericStr);
    if (Number.isFinite(numericVal) && numericVal > 0) {
      variants.add(numericVal);
    }
  });

  return Array.from(variants);
};

export default function SadarContactsPage() {
  const { userData } = useAuthStore();
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filter states
  const [roleFilter, setRoleFilter] = useState("students");
  const [classFilter, setClassFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [classes, setClasses] = useState([]);

  // Fetch student contacts under this Sadar's madarsa
  const fetchContacts = useCallback(async () => {
    const allowedIds = getMadarsaIdVariants(userData);
    if (allowedIds.length === 0) {
      setContacts([]);
      setFilteredContacts([]);
      setClasses([]);
      return;
    }

    setLoading(true);
    try {
      const chunk = (array, size) => {
        const result = [];
        for (let i = 0; i < array.length; i += size) {
          result.push(array.slice(i, i + size));
        }
        return result;
      };

      const chunks = chunk(allowedIds, 30);
      const collectionName = roleFilter === "teachers" ? "teachers" : "students";
      const promises = chunks.map(async (c) => {
        const q = query(collection(db, collectionName), where("madarsaId", "in", c));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      });

      const chunkResults = await Promise.all(promises);
      const allPeople = chunkResults.flat().filter((s) => !s.deleted);

      // De-duplicate by ID and filter out teachers without MSR ID
      const uniquePeople = Array.from(
        new Map(allPeople.map((s) => [s.id, s])).values()
      ).filter((s) => {
        if (roleFilter === "teachers") {
          const msrId = s.mhrId || s.mid || s.teacherId;
          return msrId && String(msrId).trim() !== "" && String(msrId).toUpperCase() !== "N/A";
        }
        return true;
      });

      const fetched = uniquePeople.map((s) => ({
        id: s.id,
        name: roleFilter === "teachers" ? s.name || "N/A" : s.fullName || s.studentName || s.name || "N/A",
        role: roleFilter === "teachers" ? "Teacher" : "Student",
        phone:
          roleFilter === "teachers"
            ? s.phone || s.mobile || "N/A"
            : s.phone || s.guardianPhone || "N/A",
        classLevel: roleFilter === "teachers" ? "N/A" : s.classLevel ? String(s.classLevel).trim() : "N/A",
        mid: roleFilter === "teachers" ? s.mhrId || s.mid || s.teacherId || "N/A" : s.mid || s.admissionNumber || s.studentId || "N/A",
      }));

      // Gather distinct classes for class filter
      const classSet = new Set(fetched.map((s) => s.classLevel).filter((c) => c !== "N/A"));
      setClasses(Array.from(classSet).sort());

      setContacts(fetched);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error("Failed to load contacts data");
    } finally {
      setLoading(false);
    }
  }, [userData, roleFilter]);

  useEffect(() => {
    if (userData) {
      fetchContacts();
    }
  }, [userData, fetchContacts]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, classFilter, searchTerm]);

  // Apply client-side filters
  useEffect(() => {
    let result = [...contacts];

    if (roleFilter === "students" && classFilter !== "all") {
      result = result.filter((c) => c.classLevel === classFilter);
    }

    if (searchTerm.trim() !== "") {
      const s = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(s) ||
          c.phone.toLowerCase().includes(s)
      );
    }

    setFilteredContacts(result);
  }, [contacts, roleFilter, classFilter, searchTerm]);

  // Paginated contacts for current view page
  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredContacts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredContacts, currentPage, itemsPerPage]);

  // Exports
  const handleDownloadCSV = () => {
    if (filteredContacts.length === 0) {
      toast.info("No contacts to export");
      return;
    }

    const isTeacher = roleFilter === "teachers";
    const headers = isTeacher 
      ? ["Name", "Role", "Phone Number", "MSR"]
      : ["Name", "Role", "Phone Number", "Class", "MID"];
    const rows = filteredContacts.map((c) => 
      isTeacher 
        ? [c.name, c.role, c.phone, c.mid || "N/A"]
        : [c.name, c.role, c.phone, c.classLevel, c.mid || "N/A"]
    );

    const csvContent = [headers, ...rows]
      .map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      roleFilter === "teachers" ? "teacher_contacts.csv" : "student_contacts.csv",
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Downloaded Successfully");
  };

  const handleDownloadPDF = () => {
    if (filteredContacts.length === 0) {
      toast.info("No contacts to export");
      return;
    }

    const doc = new jsPDF();

    const madrasaName = userData?.madarsaName || userData?.name || userData?.fullName || "Madrasa";
    const madrasaCode = userData?.madarsaId || userData?.mid || "";
    const dateGenerated = new Date().toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    });

    const titleText = roleFilter === "teachers"
      ? "Teachers Contact Directory"
      : "Students Contact Directory";

    doc.setFontSize(14);
    doc.text(`${madrasaName.toUpperCase()} (${madrasaCode}) - ${titleText}`, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${dateGenerated}`, 14, 21);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    const isTeacher = roleFilter === "teachers";
    const tableColumn = isTeacher
      ? ["S.No", "Name", "Role", "Phone Number", "MSR"]
      : ["S.No", "Name", "Role", "Phone Number", "Class", "MID"];
    const tableRows = filteredContacts.map((c, index) => 
      isTeacher
        ? [index + 1, c.name, c.role, c.phone, c.mid || "N/A"]
        : [index + 1, c.name, c.role, c.phone, c.classLevel, c.mid || "N/A"]
    );

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 25,
      theme: "striped",
    });

    doc.save(roleFilter === "teachers" ? "teacher_contacts.pdf" : "student_contacts.pdf");
    toast.success("PDF Downloaded Successfully");
  };

  return (
    <ProtectedRoute requiredRole="madarsa_admin">
      <Layout>
      <div className="space-y-8 px-1 pb-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="h-8 w-8 text-teal-600" />
              Contact Directory
            </h1>
            <p className="text-slate-600 mt-1">
              View and download contact details of students and teachers under your Madrasa.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadCSV}
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button
              onClick={handleDownloadPDF}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {/* Filter Panel */}
        <Card className="relative z-20 border border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Section</label>
                <Select
                  value={roleFilter}
                  onValueChange={(value) => {
                    setRoleFilter(value);
                    setClassFilter("all");
                  }}
                >
                  <SelectTrigger className="w-full bg-white border-slate-200">
                    <SelectValue placeholder="Select Section" />
                  </SelectTrigger>
                  <SelectContent className="z-[100] bg-white shadow-lg">
                    <SelectItem value="students">Students</SelectItem>
                    <SelectItem value="teachers">Teachers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Class Select */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Filter by Class</label>
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-full bg-white border-slate-200" disabled={roleFilter !== "students"}>
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent className="z-[100] bg-white shadow-lg">
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls} value={cls}>
                        Class {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Search Name/Phone</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white border-slate-200"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Directory Table */}
        <Card className="relative z-10 border border-slate-200 shadow-sm bg-white">
          <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between py-4">
            <CardTitle className="text-lg font-bold text-slate-900">
              {roleFilter === "teachers" ? "Teachers" : "Students"} ({filteredContacts.length} found)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="h-10 w-10 animate-spin text-teal-600 mb-2" />
                Loading contacts...
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                No {roleFilter === "teachers" ? "teachers" : "students"} found.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold text-slate-700">Name</TableHead>
                        <TableHead className="font-bold text-slate-700">Role</TableHead>
                        <TableHead className="font-bold text-slate-700">Phone Number</TableHead>
                        {roleFilter === "students" && <TableHead className="font-bold text-slate-700">Class</TableHead>}
                        <TableHead className="font-bold text-slate-700">
                          {roleFilter === "teachers" ? "MSR" : "MID"}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedContacts.map((c) => (
                        <TableRow key={c.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-medium text-slate-900">{c.name}</TableCell>
                          <TableCell className="text-slate-600">{c.role}</TableCell>
                          <TableCell className="text-slate-900 font-mono tracking-tight flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            {c.phone}
                          </TableCell>
                          {roleFilter === "students" && (
                            <TableCell className="text-slate-600">
                              {c.classLevel === "N/A" ? "N/A" : `Class ${c.classLevel}`}
                            </TableCell>
                          )}
                          <TableCell className="text-slate-600">{c.mid || "N/A"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-4 border-t border-slate-100">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(filteredContacts.length / itemsPerPage)}
                    onPageChange={setCurrentPage}
                    itemsPerPage={itemsPerPage}
                    totalItems={filteredContacts.length}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </Layout>
    </ProtectedRoute>
  );
}
