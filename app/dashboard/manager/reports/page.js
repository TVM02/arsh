"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileText, Search, Eye, Download, Calendar } from "lucide-react";
import useAuthStore from "@/lib/authStore";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const statusColor = (status) => {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-700";
    case "submitted":
      return "bg-blue-100 text-blue-700";
    case "draft":
      return "bg-yellow-100 text-yellow-700";
    case "rejected":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

const formatDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function ManagerReportsPage() {
  const { userData } = useAuthStore();
  const [reports, setReports] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const madarsaId = userData?.madarsaId;

  useEffect(() => {
    if (!madarsaId) return;
    const fetchReports = async () => {
      setLoading(true);
      try {
        // Inspections store madrasa as selectedMadarsaId
        const q = query(
          collection(db, "inspections"),
          where("selectedMadarsaId", "==", madarsaId),
        );
        const snap = await getDocs(q);
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((r) => r.status === "approved" || r.status === "submitted")
          .sort((a, b) => {
            const ta = a.createdAt?.toDate
              ? a.createdAt.toDate().getTime()
              : 0;
            const tb = b.createdAt?.toDate
              ? b.createdAt.toDate().getTime()
              : 0;
            return tb - ta;
          });
        setReports(data);
        setFiltered(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [madarsaId]);

  useEffect(() => {
    const term = search.toLowerCase();
    setFiltered(
      reports.filter((r) => {
        const matchSearch =
          (r.title || "").toLowerCase().includes(term) ||
          (r.inspectorName || r.inspectedBy || "").toLowerCase().includes(term);
        const matchStatus =
          statusFilter === "all" || r.status === statusFilter;
        return matchSearch && matchStatus;
      }),
    );
  }, [search, statusFilter, reports]);

  return (
    <ProtectedRoute allowedRoles={["manager"]}>
      <Layout>
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Inspection Reports
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Reports submitted for {userData?.madarsaName}
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by title or inspector…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Total", value: reports.length },
              {
                label: "Approved",
                value: reports.filter((r) => r.status === "approved").length,
              },
              {
                label: "Submitted",
                value: reports.filter((r) => r.status === "submitted").length,
              },
            ].map((c) => (
              <Card key={c.label}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-gray-500">{c.label}</p>
                  <p className="text-2xl font-bold text-teal-700">{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Reports table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-teal-600" />
                Reports
                <Badge className="ml-2 bg-teal-100 text-teal-700">
                  {filtered.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-center text-gray-400 py-10 text-sm">
                  Loading reports…
                </p>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No inspection reports found.</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Reports submitted by inspectors will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {["#", "Title", "Inspector", "Date", "Status", "Action"].map((h) => (
                          <th
                            key={h}
                            className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r, idx) => (
                        <tr
                          key={r.id}
                          className="border-b last:border-0 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4 text-gray-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {r.title || "Inspection Report"}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {r.inspectorName || r.inspectedBy || "—"}
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-xs">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(r.createdAt)}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={statusColor(r.status)}>
                              {r.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelected(r)}
                                className="text-teal-600 hover:bg-teal-50"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {[
                                ...(r.madarsaFormFiles || []),
                                ...(r.managementFormFiles || []),
                                ...(r.sadarFormFiles || []),
                                ...(r.files || []),
                              ].filter(f => f?.url).slice(0, 1).map((f, i) => (
                                <a key={i} href={f.url} target="_blank" rel="noreferrer">
                                  <Button variant="ghost" size="sm" className="text-gray-500 hover:bg-gray-100">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </a>
                              ))}
                            </div>
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

        {/* Report Detail Dialog */}
        {selected && (
          <Dialog
            open={Boolean(selected)}
            onOpenChange={() => setSelected(null)}
          >
            <DialogContent className="w-[95vw] max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
              <DialogHeader>
                <DialogTitle>
                  {selected.title || "Inspection Report"}
                </DialogTitle>
                <DialogDescription>
                  <span className="flex items-center gap-2 mt-1">
                    <Badge className={statusColor(selected.status)}>
                      {selected.status}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {formatDate(selected.createdAt)}
                    </span>
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4 text-sm">
                {selected.remarks && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1">
                      Remarks
                    </p>
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {selected.remarks}
                    </p>
                  </div>
                )}

                {/* Attached files */}
                {[
                  ...(selected.madarsaFormFiles || []),
                  ...(selected.managementFormFiles || []),
                  ...(selected.sadarFormFiles || []),
                  ...(selected.files || []),
                ].length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">
                      Attached Files
                    </p>
                    <div className="space-y-2">
                      {[
                        ...(selected.madarsaFormFiles || []),
                        ...(selected.managementFormFiles || []),
                        ...(selected.sadarFormFiles || []),
                        ...(selected.files || []),
                      ].map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between bg-gray-50 rounded p-2 border"
                        >
                          <span className="text-sm text-gray-700 truncate mr-2">
                            {f.name || `File ${i + 1}`}
                          </span>
                          {f.url && (
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-600 hover:underline flex items-center gap-1 text-xs shrink-0"
                            >
                              <Download className="h-3 w-3" />
                              Download
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inspector info */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Inspector", selected.inspectorName || selected.inspectedBy],
                    ["Madrasa", selected.madarsaName],
                    ["Inspection Date", formatDate(selected.inspectionDate || selected.createdAt)],
                  ].map(([label, val]) =>
                    val ? (
                      <div key={label} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">{label}</p>
                        <p className="font-medium text-gray-900">{val}</p>
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
