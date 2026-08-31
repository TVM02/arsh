"use client";

import { useState, useEffect, useRef } from "react";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightLeft,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Building,
  ChevronRight,
  FileText,
  AlertCircle,
  Printer,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  doc as fsDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

const formatDate = (v) => {
  if (!v) return "—";
  if (v?.toDate) return v.toDate().toLocaleString("en-IN");
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleString("en-IN");
};

// Flipkart-style status timeline config
const STATUS_STEPS = [
  { key: "pending_manager_a", label: "Request Submitted", short: "Submitted" },
  {
    key: "approved_manager_a",
    label: "Approved by Source Manager",
    short: "Mgr A Approved",
  },
  {
    key: "approved_sadar_a",
    label: "Approved by Sadar",
    short: "Sadar Approved",
  },
  {
    key: "approved_manager_b",
    label: "Approved by Dest. Manager",
    short: "Mgr B Approved",
  },
  { key: "completed", label: "Transfer Complete", short: "Complete" },
];

const stepIndex = (status) => {
  if (status === "rejected") return -1;
  return STATUS_STEPS.findIndex((s) => s.key === status);
};

const statusBadge = (status) => {
  const map = {
    pending_manager_a: { label: "Pending Manager", cls: "bg-yellow-100 text-yellow-700" },
    approved_manager_a: {
      label: "Pending Sadar",
      cls: "bg-blue-100 text-blue-700",
    },
    approved_sadar_a: {
      label: "Pending Dest. Manager",
      cls: "bg-indigo-100 text-indigo-700",
    },
    approved_manager_b: {
      label: "Nearly Done",
      cls: "bg-purple-100 text-purple-700",
    },
    completed: { label: "Completed", cls: "bg-green-100 text-green-700" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700" },
  };
  return map[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
};

const fetchPublicMadarsaById = async (madarsaId) => {
  if (!madarsaId) return null;
  const response = await fetch(
    `/api/public/madarsas?madarsaId=${encodeURIComponent(madarsaId)}`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  return response.json();
};

export default function StudentTCRequestPage() {
  const { userData } = useAuthStore();

  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [madarsas, setMadarsas] = useState([]);
  const [sourceMadarsa, setSourceMadarsa] = useState(null);
  const [madarsaSearch, setMadarsaSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailReq, setDetailReq] = useState(null);
  const [successData, setSuccessData] = useState(null); // holds submitted request for success screen
  const printRef = useRef(null);

  const [form, setForm] = useState({
    transferMode: "online",
    destinationMadarsaId: "",
    destinationMadarsaName: "",
    reason: "",
  });

  /* ─── fetch ─────────────────────────────────────── */
  useEffect(() => {
    if (!userData) return;
    fetchMyRequests();
    fetchMadarsas();
    const sourceId =
      userData.madarsaId ||
      userData.madrasaId ||
      userData.madarsa ||
      userData.madrasa;
    fetchPublicMadarsaById(sourceId).then(setSourceMadarsa).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchMyRequests = async () => {
    try {
      setLoading(true);
      // Sort client-side to avoid requiring a composite Firestore index
      const snap = await getDocs(
        query(
          collection(db, "tc_requests"),
          where("requesterId", "==", userData.id || userData.uid),
        ),
      );
      const requests = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt ?? 0);
          const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt ?? 0);
          return tb - ta;
        });
      setMyRequests(requests);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load TC requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchMadarsas = async () => {
    try {
      const response = await fetch("/api/public/madarsas", {
        cache: "no-store",
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(data.error || "Failed to load madarsas");
      }
      const all = (Array.isArray(data) ? data : [])
        .filter((m) => (m.madarsaId || m.id) !== userData?.madarsaId)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setMadarsas(all);
    } catch (err) {
      console.error(err);
    }
  };

  /* ─── submit ─────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.transferMode === "online" && !form.destinationMadarsaId) {
      toast.error("Select a destination madarsa");
      return;
    }
    if (!form.reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    // Removed the active request check to allow unlimited attempts as requested

    try {
      setSubmitting(true);
      const sourceMadarsaId =
        userData.madarsaId ||
        userData.madrasaId ||
        userData.madarsa ||
        userData.madrasa ||
        "";
      const sourceDetails =
        sourceMadarsa || (await fetchPublicMadarsaById(sourceMadarsaId));
      const sourceMadarsaName =
        sourceDetails?.name ||
        sourceDetails?.madarsaName ||
        userData.madarsaName ||
        userData.madrasaName ||
        sourceMadarsaId ||
        "";
      const payload = {
        type: "student",
        requesterId: userData.id || userData.uid,
        requesterName: userData.fullName || userData.name,
        requesterEmail: userData.email,
        requesterClass:
          userData.class || userData.classLevel || userData.std || "",
        requesterAdmissionNo: userData.admissionNumber || "",
        sourceMadarsaId,
        sourceMadarsaName,
        destinationMadarsaId: form.transferMode === "offline" ? "others" : form.destinationMadarsaId,
        destinationMadarsaName: form.transferMode === "offline" ? "Others" : form.destinationMadarsaName,
        transferMode: form.transferMode,
        reason: form.reason.trim(),
        status: "pending_manager_a",
        statusHistory: [
          {
            status: "pending_manager_a",
            by: userData.id || userData.uid,
            byName: userData.fullName || userData.name,
            byRole: "student",
            timestamp: new Date().toISOString(),
            note: form.reason.trim(),
          },
        ],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, "tc_requests"), payload);
      setSuccessData({
        studentName: payload.requesterName,
        mid: userData.admissionNumber || userData.id || "",
        transferMode: payload.transferMode,
        sourceMadarsaName: payload.sourceMadarsaName,
        destinationMadarsaName: payload.destinationMadarsaName,
        reason: payload.reason,
        submittedAt: new Date().toLocaleString("en-IN"),
      });
      setForm({
        transferMode: "online",
        destinationMadarsaId: "",
        destinationMadarsaName: "",
        reason: "",
      });
      setShowForm(false);
      fetchMyRequests();
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit TC request");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMadarsas = madarsas.filter((m) => {
    if (!madarsaSearch) return true;
    const q = madarsaSearch.toLowerCase();
    const mid = String(m.madarsaId || m.id || "").toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      mid.includes(q) ||
      m.district?.toLowerCase().includes(q) ||
      m.mekhala?.toLowerCase().includes(q)
    );
  });

  const canRaiseRequest = true; // Unlimited attempts allowed

  /* ─── render ─────────────────────────────────────── */
  // Guard: if userData not available yet, show nothing (Layout handles auth init)
  if (!userData) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-600 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Transfer Certificate
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Request a TC to transfer to another madarsa
            </p>
          </div>
          {canRaiseRequest && (
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => setShowForm(true)}
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" /> Request TC
            </Button>
          )}
        </div>

        {/* Existing Requests */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-600 border-t-transparent" />
          </div>
        ) : myRequests.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ArrowRightLeft className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No TC requests yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Click &ldquo;Request TC&rdquo; to start a transfer request
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {myRequests.map((req) => {
              const badge = statusBadge(req.status);
              const idx = stepIndex(req.status);
              return (
                <Card
                  key={req.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setDetailReq(req)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          TC to:{" "}
                          {req.destinationMadarsaName ||
                            req.destinationMadarsaId}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Submitted: {formatDate(req.createdAt)}
                        </p>
                      </div>
                      <Badge className={badge.cls}>{badge.label}</Badge>
                    </div>

                    {/* Status Timeline */}
                    {req.status !== "rejected" ? (
                      <div className="flex items-center gap-1 overflow-x-auto">
                        {STATUS_STEPS.map((step, i) => (
                          <div
                            key={step.key}
                            className="flex items-center gap-1 flex-shrink-0"
                          >
                            <div className={`flex flex-col items-center`}>
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                                  ${
                                    i < idx
                                      ? "bg-teal-600 text-white"
                                      : i === idx
                                        ? "bg-teal-600 text-white ring-2 ring-teal-200"
                                        : "bg-gray-200 text-gray-400"
                                  }`}
                              >
                                {i < idx ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : (
                                  i + 1
                                )}
                              </div>
                              <span className="text-[10px] mt-1 text-gray-500 text-center max-w-[60px]">
                                {step.short}
                              </span>
                            </div>
                            {i < STATUS_STEPS.length - 1 && (
                              <div
                                className={`h-0.5 w-6 flex-shrink-0 ${i < idx ? "bg-teal-500" : "bg-gray-200"}`}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-600">
                        <XCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">
                          Request rejected
                        </span>
                        {req.rejectionReason && (
                          <span className="text-sm text-gray-500">
                            — {req.rejectionReason}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* New Request Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Transfer Certificate Request</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div>
              <Label>Request Mode</Label>
              <Select
                value={form.transferMode}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, transferMode: value }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-gray-500">
                Offline requests stop after Source Manager approval and can be printed.
              </p>
            </div>

            {form.transferMode === "online" && (
              <div>
                <Label>
                  Destination Madarsa <span className="text-red-500">*</span>
                </Label>
              <p className="text-xs text-gray-500 mb-2">
                Select the madarsa you want to transfer to
              </p>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search madarsa name or district..."
                  value={madarsaSearch}
                  onChange={(e) => setMadarsaSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                {filteredMadarsas.length === 0 ? (
                  <p className="text-sm text-gray-500 p-3 text-center">
                    No madarsas found
                  </p>
                ) : (
                  filteredMadarsas.map((m) => (
                    <div
                      key={m.id}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          destinationMadarsaId: m.madarsaId || m.id,
                          destinationMadarsaName: m.name,
                        }))
                      }
                      className={`p-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between
                        ${form.destinationMadarsaId === (m.madarsaId || m.id) ? "bg-teal-50 border-l-2 border-teal-600" : ""}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-gray-500">
                          {m.district} {m.madarsaId ? `· ${m.madarsaId}` : ""}
                        </p>
                      </div>
                      {form.destinationMadarsaId === (m.madarsaId || m.id) && (
                        <CheckCircle className="w-4 h-4 text-teal-600 flex-shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>
              {form.destinationMadarsaName && (
                <p className="text-xs text-teal-600 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Selected:{" "}
                  {form.destinationMadarsaName}
                </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="reason">
                Reason for Transfer <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="Explain why you need a transfer certificate..."
                value={form.reason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reason: e.target.value }))
                }
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="bg-yellow-50 rounded-md p-3 flex gap-2 text-sm text-yellow-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                {form.transferMode === "offline"
                  ? "Offline TC requests will stop after approval by your Sadar and Source Manager."
                  : "Online TC requests will go through approval by your Sadar, Source Manager, Destination Manager, and Destination Sadar."}
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailReq} onOpenChange={() => setDetailReq(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>TC Request Details</DialogTitle>
          </DialogHeader>
          {detailReq && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  [
                    "From",
                    detailReq.sourceMadarsaName || detailReq.sourceMadarsaId,
                  ],
                  [
                    "To",
                    detailReq.destinationMadarsaName ||
                      detailReq.destinationMadarsaId,
                  ],
                  ["Class", detailReq.requesterClass || "—"],
                  ["Adm. No.", detailReq.requesterAdmissionNo || "—"],
                  ["Mode", detailReq.transferMode || "online"],
                  ["Reason", detailReq.reason],
                  ["Submitted", formatDate(detailReq.createdAt)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-gray-500">{k}</p>
                    <p className="font-medium">{v}</p>
                  </div>
                ))}
              </div>

              {/* Full Timeline */}
              <div>
                <p className="text-sm font-semibold mb-3">Status Timeline</p>
                <div className="space-y-4">
                  {(() => {
                    const fullHistory = [...(detailReq.statusHistory || [])];
                    if (fullHistory.length === 0 || fullHistory[0].status !== "pending_manager_a") {
                      fullHistory.unshift({
                        status: "pending_manager_a",
                        byName: detailReq.requesterName || "Student",
                        byRole: "student",
                        timestamp: detailReq.createdAt?.toDate?.()?.toISOString() || detailReq.createdAt,
                        note: detailReq.reason
                      });
                    }
                    
                    const getStatusLabel = (st) => {
                      const map = {
                        pending_manager_a: "Submitted by Student",
                        approved_manager_a: "Action by Source Manager",
                        approved_sadar_a: "Action by Source Sadar",
                        approved_mekhala: "Action by Mekhala Admin",
                        approved_manager_b: "Action by Destination Manager",
                        completed: "Transfer Completed",
                        rejected: "Request Rejected"
                      };
                      return map[st] || String(st).replace(/_/g, " ");
                    };

                    return fullHistory.map((h, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                          {i < fullHistory.length - 1 && (
                            <div className="w-0.5 h-full bg-teal-200 mt-1 min-h-[24px]" />
                          )}
                        </div>
                        <div className="pb-4 w-full">
                          <p className="text-sm font-semibold text-gray-900 capitalize">
                            {getStatusLabel(h.status)}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {h.byName} <span className="uppercase text-[10px] bg-gray-100 px-1.5 py-0.5 rounded ml-1">{h.byRole}</span>
                            <span className="mx-2">•</span>
                            {h.timestamp ? new Date(h.timestamp).toLocaleString("en-IN") : "—"}
                          </p>
                          {h.note && (
                            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-800 relative">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 rounded-l-md"></div>
                              <span className="font-medium text-xs text-gray-500 uppercase block mb-1">Remark</span>
                              {h.note}
                            </div>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Success Screen Dialog ── */}
      <Dialog open={!!successData} onOpenChange={() => setSuccessData(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="sr-only">TC Request Submitted Successfully</DialogTitle>
          </DialogHeader>
          <div ref={printRef} className="p-4 space-y-4 print:p-6">
            {/* DKJU Header with logo */}
            <div className="text-center border-b pb-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="DKJU Logo" className="h-12 w-12 object-contain" />
                <div className="text-left">
                  <p className="text-xs font-bold text-teal-700 tracking-widest uppercase leading-tight">
                    DKJU
                  </p>
                  <p className="text-[10px] text-gray-400 leading-tight">
                    Transfer Certificate Desk
                  </p>
                </div>
              </div>
              <h2 className="text-base font-bold text-gray-900 mt-1">Transfer Certificate Request</h2>
              <p className="text-xs text-gray-400">Confirmation Receipt</p>
            </div>

            {/* Success icon */}
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-base font-semibold text-green-700">
                Request Submitted Successfully!
              </p>
            </div>

            {/* Details */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Student Name</span>
                <span className="font-semibold">{successData?.studentName}</span>
              </div>
              {successData?.mid && (
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">MID</span>
                  <span className="font-semibold">{successData.mid}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Mode</span>
                <span className="font-semibold capitalize">
                  {successData?.transferMode || "online"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">From Madrasa</span>
                <span className="font-semibold text-right max-w-[55%]">
                  {successData?.sourceMadarsaName || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">To Madrasa</span>
                <span className="font-semibold text-right max-w-[55%]">
                  {successData?.transferMode === "offline" ? "Others" : (successData?.destinationMadarsaName || "—")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Submitted</span>
                <span className="font-semibold">{successData?.submittedAt}</span>
              </div>
            </div>

            {/* Forwarded message */}
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-800">
              <p>
                {successData?.transferMode === "offline"
                  ? "Your offline TC request has been forwarded to your Sadar. After Source Manager approval, the offline flow will be completed for printout."
                  : (
                    <>
                      Your TC request has been forwarded to the <strong>Sadar</strong>{" "}
                      of{" "}
                      <strong>{successData?.sourceMadarsaName || "your madrasa"}</strong>.
                      You will be notified as it moves through each approval stage.
                    </>
                  )}
              </p>
            </div>

            {/* Typed reason */}
            {successData?.reason && (
              <div className="border rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Your Reason
                </p>
                <p className="text-sm text-gray-700 italic">
                  &ldquo;{successData.reason}&rdquo;
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 pt-8 text-center text-xs text-gray-600">
              {["Student", "Sadar / Principal", "Manager"].map((label) => (
                <div key={label} className="space-y-2">
                  <div className="border-b border-gray-500 h-8" />
                  <p>{label} Signature</p>
                </div>
              ))}
            </div>

            {/* Print note visible only on screen */}
            <p className="text-xs text-gray-400 text-center print:hidden">
              Submitted: {successData?.submittedAt}
            </p>
          </div>

          {/* Action buttons — hidden on print */}
          <div className="flex gap-2 justify-end pt-2 print:hidden">
            <Button
              variant="outline"
              onClick={() => {
                window.print();
              }}
              className="gap-2"
            >
              <Printer className="w-4 h-4" /> Print / Save PDF
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => setSuccessData(null)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
