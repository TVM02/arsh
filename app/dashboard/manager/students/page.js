"use client";

import { useState, useEffect, useMemo } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Users, Search, Eye, Download, X } from "lucide-react";
import useAuthStore from "@/lib/authStore";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

const TYPES = ["All", "Madrasa"];
const CLASS_LEVELS = ["LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "Other"];

export default function ManagerStudentsPage() {
  const { userData } = useAuthStore();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const madarsaId = userData?.madarsaId;

  useEffect(() => {
    if (!madarsaId) return;
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "students"),
          where("madarsaId", "==", madarsaId),
        );
        const snap = await getDocs(q);
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.name || a.fullName || "").localeCompare(b.name || b.fullName || ""));
        setStudents(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [madarsaId]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return students.filter((s) => {
      if (
        term &&
        !(s.name || s.fullName || "").toLowerCase().includes(term) &&
        !(s.admissionNumber || "").toLowerCase().includes(term) &&
        !(s.email || "").toLowerCase().includes(term)
      )
        return false;
      if (classFilter !== "all" && (s.classLevel || s.class) !== classFilter)
        return false;
      if (statusFilter !== "all" && (s.status || "active") !== statusFilter)
        return false;
      if (typeFilter !== "all") {
        const t = (s.institutionType || s.type || "madrasa").toLowerCase();
        if (t !== typeFilter) return false;
      }
      return true;
    });
  }, [students, search, classFilter, statusFilter, typeFilter]);

  const clearFilters = () => {
    setSearch("");
    setClassFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
  };

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ["#", "Name", "Admission No.", "Class", "Gender", "Status", "Email", "Phone", "Type"];
    const rows = filtered.map((s, i) => [
      i + 1,
      s.name || s.fullName || "",
      s.admissionNumber || "",
      s.classLevel || s.class || "",
      s.gender || "",
      s.status || "active",
      s.email || "",
      s.phone || "",
      s.institutionType || s.type || "Madrasa",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `students_${userData?.madarsaName || "madarsa"}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("CSV exported");
  };

  const statusColor = (status) => {
    if (status === "active") return "bg-green-100 text-green-700";
    if (status === "inactive") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <ProtectedRoute allowedRoles={["manager"]}>
      <Layout>
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Students</h1>
              <p className="text-sm text-gray-500 mt-1">
                {userData?.madarsaName} — {students.length} total students
              </p>
            </div>
            <Button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                {/* Search */}
                <div className="lg:col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search name, admission no., email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Type */}
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="madrasa">Madrasa</SelectItem>
                  </SelectContent>
                </Select>

                {/* Class */}
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Classes</SelectItem>
                    {CLASS_LEVELS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(search || classFilter !== "all" || statusFilter !== "all" || typeFilter !== "all") && (
                <div className="mt-3 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500">
                    <X className="h-3.5 w-3.5 mr-1" />
                    Clear Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Total", value: students.length, color: "text-teal-700" },
              { label: "Active", value: students.filter((s) => s.status === "active").length, color: "text-green-600" },
              { label: "Inactive", value: students.filter((s) => s.status === "inactive").length, color: "text-red-500" },
            ].map((c) => (
              <Card key={c.label}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-gray-500">{c.label}</p>
                  <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-teal-600" />
                Student List
                <Badge className="ml-2 bg-teal-100 text-teal-700">
                  {filtered.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-center text-gray-400 py-10 text-sm">Loading students…</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">No students found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {["#", "Name", "Admission No.", "Class", "Gender", "Type", "Status", "Action"].map((h) => (
                          <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s, idx) => (
                        <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 px-4 text-gray-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-medium text-gray-900">{s.name || s.fullName}</td>
                          <td className="py-3 px-4 text-gray-600 font-mono text-xs">{s.admissionNumber || "—"}</td>
                          <td className="py-3 px-4 text-gray-600">{s.classLevel || s.class || "—"}</td>
                          <td className="py-3 px-4 capitalize text-gray-600">{s.gender || "—"}</td>
                          <td className="py-3 px-4 capitalize text-gray-600">{s.institutionType || s.type || "Madrasa"}</td>
                          <td className="py-3 px-4">
                            <Badge className={statusColor(s.status)}>{s.status || "active"}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Button variant="ghost" size="sm" onClick={() => setSelected(s)} className="text-teal-600 hover:bg-teal-50">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* View Dialog */}
        {selected && (
          <Dialog open={Boolean(selected)} onOpenChange={() => setSelected(null)}>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
              <DialogHeader>
                <DialogTitle>Student Details</DialogTitle>
                <DialogDescription>Complete student information</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-sm">
                {[
                  ["Name", selected.name || selected.fullName],
                  ["Admission No.", selected.admissionNumber],
                  ["Class", selected.classLevel || selected.class],
                  ["Gender", selected.gender],
                  ["Status", selected.status],
                  ["Institution Type", selected.institutionType || selected.type || "Madrasa"],
                  ["Email", selected.email],
                  ["Phone", selected.phone],
                  ["Address", selected.address],
                  ["Guardian", selected.guardianName],
                  ["Guardian Phone", selected.guardianPhone],
                ].map(([label, val]) =>
                  val ? (
                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className="font-medium text-gray-900">{val}</p>
                    </div>
                  ) : null,
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
