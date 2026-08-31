"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InspectorLayout from "@/components/InspectorLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit,
  Building,
  Calendar,
  MapPin,
} from "lucide-react";
import useAuthStore from "@/lib/authStore";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { toast } from "sonner";
import {
  canonicalDistrictName,
  madrasaMatchesDistrict,
} from "@/lib/madrasaHierarchy";

const fetchMadarsasByIds = async (madarsaIds) => {
  const rawIds = Array.isArray(madarsaIds) ? madarsaIds : [];
  const stringIds = rawIds.map((x) => String(x ?? "").trim()).filter(Boolean);
  const numberIds = rawIds
    .map((x) => {
      if (typeof x === "number") return x;
      const s = String(x ?? "").trim();
      if (!s) return NaN;
      if (!/^\d+$/.test(s)) return NaN;
      return Number(s);
    })
    .filter((n) => Number.isFinite(n));

  if (stringIds.length === 0 && numberIds.length === 0) return [];

  const queryInChunks = async (values) => {
    const chunks = [];
    for (let i = 0; i < values.length; i += 10)
      chunks.push(values.slice(i, i + 10));
    const out = [];
    for (const chunk of chunks) {
      const snap = await getDocs(
        query(collection(db, "madarsas"), where("madarsaId", "in", chunk)),
      );
      snap.docs.forEach((doc) => out.push({ id: doc.id, ...doc.data() }));
    }
    return out;
  };

  const results = [
    ...(await queryInChunks(stringIds)),
    ...(await queryInChunks(numberIds)),
  ];

  const seen = new Set();
  return results.filter((m) => {
    const mid = String(m?.madarsaId ?? "").trim();
    if (!mid) return false;
    if (seen.has(mid)) return false;
    seen.add(mid);
    return true;
  });
};

const deriveMadarsasFromAssignedDistricts = async (assignedDistricts) => {
  const districts = Array.isArray(assignedDistricts)
    ? assignedDistricts
        .map((d) => canonicalDistrictName(d) || String(d || "").trim())
        .filter(Boolean)
    : [];
  if (districts.length === 0) return [];
  const values = Array.from(new Set(districts.map((d) => String(d).trim())));

  const chunks = [];
  for (let i = 0; i < values.length; i += 10) {
    chunks.push(values.slice(i, i + 10));
  }

  let all = [];
  if (chunks.length > 0) {
    const snaps = await Promise.all([
      ...chunks.map((chunk) => getDocs(query(collection(db, "madarsas"), where("district", "in", chunk)))),
      ...chunks.map((chunk) => getDocs(query(collection(db, "madarsas"), where("districtName", "in", chunk))))
    ]);
    snaps.forEach((snap) => {
      snap.docs.forEach((doc) => all.push({ id: doc.id, ...doc.data() }));
    });
  }

  const filtered = all.filter((m) =>
    districts.some((d) => {
      try {
        if (!madrasaMatchesDistrict(m, d)) return false;
        return !!String(m?.district || m?.districtName || "").trim();
      } catch {
        return false;
      }
    }),
  );

  const seen = new Set();
  return filtered.filter((m) => {
    const mid = String(m?.madarsaId || "").trim();
    if (!mid) return false;
    if (seen.has(mid)) return false;
    seen.add(mid);
    return true;
  });
};

function InspectorReportsContent() {
  const { user, userData } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const madarsaIdParam = searchParams.get("madarsaId");
  const [reports, setReports] = useState([]);
  const [madarsas, setMadarsas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const madarsaIds = Array.isArray(userData?.assignedMadarsas)
          ? userData.assignedMadarsas
          : [];
        const districts = Array.isArray(userData?.assignedDistricts)
          ? userData.assignedDistricts
          : userData?.assignedDistrict
            ? [userData.assignedDistrict]
            : [];

        if (madarsaIds.length === 0 && districts.length === 0) {
          setLoading(false);
          return;
        }

        // Fetch madrasas and reports in parallel to reduce loading time
        const madarsaFetchPromise = (async () => {
          let data = madarsaIds.length > 0
            ? await fetchMadarsasByIds(madarsaIds)
            : await deriveMadarsasFromAssignedDistricts(districts);
          if (
            madarsaIds.length > 0 &&
            data.length === 0 &&
            districts.length > 0
          ) {
            data = await deriveMadarsasFromAssignedDistricts(districts);
          }
          return data;
        })();

        const reportsQuery = query(
          collection(db, "inspections"),
          where("inspectorId", "==", user.uid),
        );
        const reportsFetchPromise = getDocs(reportsQuery);

        const [madarsasData, reportsSnapshot] = await Promise.all([
          madarsaFetchPromise,
          reportsFetchPromise
        ]);

        setMadarsas(madarsasData);

        const reportsData = reportsSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => {
            const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return tb - ta;
          });
        setReports(reportsData);

        setLoading(false);
      } catch (error) {
        console.error("Error fetching reports:", error);
        setLoading(false);
      }
    };

    if (user && userData) {
      fetchData();
    }
  }, [user, userData]);

  const handleNewReport = () => {
    const destination = madarsaIdParam
      ? `/dashboard/inspector/inspections/create?madarsaId=${encodeURIComponent(madarsaIdParam)}`
      : "/dashboard/inspector/inspections/create";
    router.push(destination);
  };

  const handleViewReport = (reportId) => {
    router.push(`/dashboard/inspector/inspections/${reportId}`);
  };

  const handleEditReport = (reportId) => {
    router.push(`/dashboard/inspector/inspections/create?draft=${reportId}`);
  };

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.madarsaName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.selectedMadarsaId
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || report.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "draft":
        return "secondary";
      case "submitted":
        return "default";
      case "reviewed":
        return "outline";
      case "approved":
        return "default";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return (
      <InspectorLayout>
        <div className="p-6">
          <div className="text-center py-8">Loading...</div>
        </div>
      </InspectorLayout>
    );
  }

  return (
    <InspectorLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Inspection Reports
            </h1>
            <p className="text-gray-600">
              Manage your inspection reports and documentation
            </p>
          </div>
          <Button onClick={handleNewReport}>
            <Plus className="h-4 w-4 mr-2" />
            New Report
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] border-gray-300 hover:border-gray-400 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-gray-500 focus-visible:border-gray-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Reports ({filteredReports.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredReports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">
                  {reports.length === 0
                    ? "No inspection reports created yet"
                    : "No reports match your search criteria"}
                </p>
                {reports.length === 0 && (
                  <Button onClick={handleNewReport}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Report
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report Title</TableHead>
                      <TableHead>Madrasa</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => {
                      const madarsa = madarsas.find(
                        (m) => m.madarsaId === report.selectedMadarsaId,
                      );

                      return (
                        <TableRow key={report.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {report.title ||
                                  `Inspection Report - ${report.selectedMadarsaId}`}
                              </p>
                              <p className="text-sm text-gray-500">
                                {report.inspectionDate
                                  ? new Date(
                                      report.inspectionDate,
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-gray-500" />
                              <div>
                                <p className="font-medium">
                                  {madarsa?.name || report.madarsaName}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {report.selectedMadarsaId}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {report.location ? (
                              <a 
                                href={`https://maps.google.com/?q=${report.location.lat},${report.location.lng}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                              >
                                <MapPin className="h-4 w-4" />
                                View Map
                              </a>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              {report.createdAt
                                ? (report.createdAt.toDate ? report.createdAt.toDate() : new Date(report.createdAt)).toLocaleDateString()
                                : "N/A"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusColor(report.status)}>
                              {report.status || "draft"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewReport(report.id)}
                                title="View Report"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {(report.status === "draft" ||
                                !report.status) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditReport(report.id)}
                                  title="Edit Report"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        {reports.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">
                    Total Reports
                  </p>
                  <p className="text-3xl font-bold text-blue-600">
                    {reports.length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Draft</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {
                      reports.filter((r) => r.status === "draft" || !r.status)
                        .length
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Submitted</p>
                  <p className="text-3xl font-bold text-green-600">
                    {reports.filter((r) => r.status === "submitted").length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {reports.filter((r) => r.status === "approved").length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </InspectorLayout>
  );
}

export default function InspectorReportsPage() {
  return (
    <Suspense fallback={
      <InspectorLayout>
        <div className="p-6">
          <div className="text-center py-8">Loading...</div>
        </div>
      </InspectorLayout>
    }>
      <InspectorReportsContent />
    </Suspense>
  );
}
