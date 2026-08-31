"use client";

import { useState, useEffect, useMemo } from "react";
import InspectorLayout from "@/components/InspectorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  History,
  Users,
  GraduationCap,
  Search,
  RefreshCw,
  UserX,
  AlertTriangle,
  Building,
  Calendar,
  XCircle,
} from "lucide-react";
import useAuthStore from "@/lib/authStore";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import {
  canonicalDistrictName,
  madrasaMatchesDistrict,
  fetchMadarsasByDistricts,
} from "@/lib/madrasaHierarchy";

const fmtDate = (v) => {
  if (!v) return "—";
  const d = v?.toDate ? v.toDate() : new Date(v);
  return isNaN(d)
    ? "—"
    : d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const statusColor = (s) =>
  ({
    inactive: "bg-red-100 text-red-700",
    suspended: "bg-orange-100 text-orange-700",
  })[s?.toLowerCase()] || "bg-gray-100 text-gray-600";

export default function InspectorHistoryPage() {
  const { user, userData } = useAuthStore();

  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [failedResults, setFailedResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("students");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [madarsaFilter, setMadarsaFilter] = useState("all");
  const [assignedMadarsas, setAssignedMadarsas] = useState([]);

  useEffect(() => {
    if (!user || !userData) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userData]);

  const fetchData = async () => {
    try {
      setLoading(true);

      /* ── resolve inspector assigned madarsas ───────────────────────── */
      const madarsaIds = Array.isArray(userData?.assignedMadarsas)
        ? userData.assignedMadarsas
        : [];
      const rawDistricts = Array.isArray(userData?.assignedDistricts)
        ? userData.assignedDistricts
        : userData?.assignedDistrict
          ? [userData.assignedDistrict]
          : [];
      const districts = rawDistricts
        .map((d) => canonicalDistrictName(d) || String(d || "").trim())
        .filter(Boolean);

      let madarsaList = [];

      if (madarsaIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < madarsaIds.length; i += 10)
          chunks.push(madarsaIds.slice(i, i + 10));
        for (const chunk of chunks) {
          const snap = await getDocs(
            query(collection(db, "madarsas"), where("madarsaId", "in", chunk)),
          );
          snap.docs.forEach((d) =>
            madarsaList.push({ docId: d.id, ...d.data() }),
          );
        }
      }

      if (madarsaList.length === 0 && districts.length > 0) {
        const candidateDocs = await fetchMadarsasByDistricts(db, query, collection, where, getDocs, districts);
        madarsaList = candidateDocs
          .map((d) => ({ docId: d.id, ...d }))
          .filter((m) =>
            districts.some((dist) => {
              try {
                return madrasaMatchesDistrict(m, dist);
              } catch {
                return false;
              }
            }),
          );
      }

      const seen = new Set();
      madarsaList = madarsaList.filter((m) => {
        const mid = String(m?.madarsaId ?? "").trim();
        if (!mid || seen.has(mid)) return false;
        seen.add(mid);
        return true;
      });

      setAssignedMadarsas(madarsaList);
      const assignedIds = madarsaList
        .map((m) => String(m.madarsaId ?? "").trim())
        .filter(Boolean);
      const inactiveStatuses = ["inactive", "suspended"];

      /* ── students ──────────────────────────────────────────────────── */
      let studentResults = [];
      if (assignedIds.length > 0) {
        for (let i = 0; i < assignedIds.length; i += 10) {
          const chunk = assignedIds.slice(i, i + 10);
          const snap = await getDocs(
            query(
              collection(db, "students"),
              where("madarsaId", "in", chunk),
              where("status", "in", inactiveStatuses),
            ),
          );
          snap.docs.forEach((d) =>
            studentResults.push({ id: d.id, ...d.data() }),
          );
        }
      } else {
        const snap = await getDocs(
          query(
            collection(db, "students"),
            where("status", "in", inactiveStatuses),
          ),
        );
        snap.docs.forEach((d) =>
          studentResults.push({ id: d.id, ...d.data() }),
        );
      }

      /* ── teachers ──────────────────────────────────────────────────── */
      let teacherResults = [];
      if (assignedIds.length > 0) {
        for (let i = 0; i < assignedIds.length; i += 10) {
          const chunk = assignedIds.slice(i, i + 10);
          const snap = await getDocs(
            query(
              collection(db, "teachers"),
              where("madarsaId", "in", chunk),
              where("status", "in", inactiveStatuses),
            ),
          );
          snap.docs.forEach((d) =>
            teacherResults.push({ id: d.id, ...d.data() }),
          );
        }
      } else {
        const snap = await getDocs(
          query(
            collection(db, "teachers"),
            where("status", "in", inactiveStatuses),
          ),
        );
        snap.docs.forEach((d) =>
          teacherResults.push({ id: d.id, ...d.data() }),
        );
      }

      const sortByDate = (a, b) => {
        const ta =
          a.updatedAt?.toDate?.()?.getTime?.() ??
          a.createdAt?.toDate?.()?.getTime?.() ??
          0;
        const tb =
          b.updatedAt?.toDate?.()?.getTime?.() ??
          b.createdAt?.toDate?.()?.getTime?.() ??
          0;
        return tb - ta;
      };

      setStudents(studentResults.sort(sortByDate));
      setTeachers(teacherResults.sort(sortByDate));

      /* ── failed exam results ──────────────────────────────────────── */
      let failedRes = [];
      if (assignedIds.length > 0) {
        for (let i = 0; i < assignedIds.length; i += 10) {
          const chunk = assignedIds.slice(i, i + 10);
          const snap = await getDocs(
            query(
              collection(db, "results"),
              where("madarsaId", "in", chunk),
              where("status", "==", "failed"),
            ),
          );
          snap.docs.forEach((d) => failedRes.push({ id: d.id, ...d.data() }));
        }
      } else {
        const snap = await getDocs(
          query(collection(db, "results"), where("status", "==", "failed")),
        );
        snap.docs.forEach((d) => failedRes.push({ id: d.id, ...d.data() }));
      }
      setFailedResults(failedRes.sort(sortByDate));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load history data");
    } finally {
      setLoading(false);
    }
  };

  const filterList = (list) =>
    list.filter((item) => {
      if (statusFilter !== "all" && item.status?.toLowerCase() !== statusFilter)
        return false;
      if (madarsaFilter !== "all" && String(item.madarsaId) !== madarsaFilter)
        return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const name = (item.fullName || item.name || "").toLowerCase();
        if (
          !name.includes(s) &&
          !String(item.madarsaId || "").includes(s) &&
          !(item.madarsaName || "").toLowerCase().includes(s) &&
          !(item.email || "").toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });

  const filteredStudents = useMemo(
    () => filterList(students),
    [students, searchTerm, statusFilter, madarsaFilter],
  );
  const filteredTeachers = useMemo(
    () => filterList(teachers),
    [teachers, searchTerm, statusFilter, madarsaFilter],
  );

  const hasFilters =
    searchTerm || statusFilter !== "all" || madarsaFilter !== "all";
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setMadarsaFilter("all");
  };

  if (loading) {
    return (
      <InspectorLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent" />
        </div>
      </InspectorLayout>
    );
  }

  const isStudent = activeTab === "students";
  const currentList = isStudent ? filteredStudents : filteredTeachers;

  return (
    <InspectorLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">History</h1>
            <p className="text-sm text-gray-500 mt-1">
              Inactive &amp; suspended students / teachers across your assigned
              madarsas
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Inactive Students",
              value: students.filter(
                (s) => s.status?.toLowerCase() === "inactive",
              ).length,
              cls: "text-red-600",
              icon: UserX,
            },
            {
              label: "Suspended Students",
              value: students.filter(
                (s) => s.status?.toLowerCase() === "suspended",
              ).length,
              cls: "text-orange-600",
              icon: AlertTriangle,
            },
            {
              label: "Inactive Teachers",
              value: teachers.filter(
                (t) => t.status?.toLowerCase() === "inactive",
              ).length,
              cls: "text-red-600",
              icon: UserX,
            },
            {
              label: "Suspended Teachers",
              value: teachers.filter(
                (t) => t.status?.toLowerCase() === "suspended",
              ).length,
              cls: "text-orange-600",
              icon: AlertTriangle,
            },
            {
              label: "Failed Exam Results",
              value: failedResults.length,
              cls: "text-purple-600",
              icon: XCircle,
            },
          ].map(({ label, value, cls, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`w-8 h-8 ${cls} flex-shrink-0`} />
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-2xl font-bold ${cls}`}>{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          {[
            {
              key: "students",
              label: "Students",
              count: filteredStudents.length,
              Icon: GraduationCap,
            },
            {
              key: "teachers",
              label: "Teachers",
              count: filteredTeachers.length,
              Icon: Users,
            },
            {
              key: "failed",
              label: "Failed Exam",
              count: failedResults.length,
              Icon: XCircle,
            },
          ].map(({ key, label, count, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-gray-500 hover:text-teal-600"
              }`}
            >
              <Icon className="w-4 h-4" /> {label} ({count})
            </button>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={`Search name, madarsa, email…`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            {assignedMadarsas.length > 0 && (
              <Select value={madarsaFilter} onValueChange={setMadarsaFilter}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="All Madarsas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Madarsas</SelectItem>
                  {assignedMadarsas.map((m) => (
                    <SelectItem key={m.madarsaId} value={String(m.madarsaId)}>
                      {m.name || m.madarsaId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        {activeTab !== "failed" && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                {isStudent ? (
                  <GraduationCap className="w-4 h-4 text-teal-600" />
                ) : (
                  <Users className="w-4 h-4 text-teal-600" />
                )}
                {isStudent
                  ? "Inactive / Suspended Students"
                  : "Inactive / Suspended Teachers"}
                <span className="text-sm font-normal text-gray-500">
                  ({currentList.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {currentList.length === 0 ? (
                <div className="text-center py-16">
                  <History className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {hasFilters
                      ? "No results match your filters"
                      : `No inactive / suspended ${activeTab} in your madarsas`}
                  </p>
                  {hasFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={clearFilters}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      {isStudent && <TableHead>Class</TableHead>}
                      {!isStudent && <TableHead>Subject</TableHead>}
                      <TableHead>Madarsa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Updated
                        </div>
                      </TableHead>
                      <TableHead>Reason / Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentList.map((item, i) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs text-gray-400">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">
                            {item.fullName || item.name || "—"}
                          </p>
                          {item.email && (
                            <p className="text-xs text-gray-400">
                              {item.email}
                            </p>
                          )}
                          {item.admissionNumber && (
                            <p className="text-xs text-gray-400">
                              #{item.admissionNumber}
                            </p>
                          )}
                        </TableCell>
                        {isStudent && (
                          <TableCell className="text-sm text-gray-600">
                            {item.classLevel || item.class || item.std || "—"}
                          </TableCell>
                        )}
                        {!isStudent && (
                          <TableCell className="text-sm text-gray-600">
                            {item.subject ||
                              (Array.isArray(item.subjects)
                                ? item.subjects.join(", ")
                                : "") ||
                              "—"}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Building className="w-3 h-3 text-gray-400" />
                            <div>
                              <p className="text-sm">
                                {item.madarsaName || "—"}
                              </p>
                              {item.madarsaId && (
                                <p className="text-xs text-gray-400">
                                  {item.madarsaId}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${statusColor(item.status)} capitalize text-xs`}
                          >
                            {item.status || "unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {fmtDate(item.updatedAt || item.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                          {item.inactiveReason ||
                            item.suspensionReason ||
                            item.notes ||
                            "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Failed Exam Results */}
        {activeTab === "failed" && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <XCircle className="w-4 h-4 text-purple-600" />
                Failed Exam Results
                <span className="text-sm font-normal text-gray-500">
                  ({failedResults.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {failedResults.length === 0 ? (
                <div className="text-center py-16">
                  <XCircle className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-500">No failed exam results found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Exam</TableHead>
                      <TableHead>Madarsa</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failedResults.map((item, i) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs text-gray-400">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">
                            {item.studentName || item.fullName || "—"}
                          </p>
                          {item.admissionNumber && (
                            <p className="text-xs text-gray-400">
                              #{item.admissionNumber}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {item.classLevel || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {item.examTitle || item.examName || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Building className="w-3 h-3 text-gray-400" />
                            <p className="text-sm">
                              {item.madarsaName || item.madarsaId || "—"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.percentage != null ? (
                            <Badge className="bg-red-100 text-red-700">
                              {item.percentage}%
                            </Badge>
                          ) : item.obtainedMarks != null ? (
                            <Badge className="bg-red-100 text-red-700">
                              {item.obtainedMarks}/{item.totalMarks}
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700">
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {fmtDate(item.createdAt || item.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </InspectorLayout>
  );
}
