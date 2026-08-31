"use client";

import { useState, useEffect } from "react";
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
  ArrowRightLeft,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  AlertCircle,
  Printer,
  Users,
  GraduationCap,
  User,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

const formatDate = (v) => {
  if (!v) return "—";
  if (v?.toDate) return v.toDate().toLocaleString("en-IN");
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleString("en-IN");
};

const STATUS_STEPS = [
  { key: "pending_manager_a", label: "Request Submitted", short: "Submitted" },
  { key: "approved_manager_a", label: "Source Mgr Approved", short: "Mgr A ✓" },
  { key: "approved_mekhala", label: "Mekhala Approved", short: "Mekhala ✓" },
  { key: "completed", label: "Transfer Complete", short: "Complete" },
];

const stepIndex = (status) => {
  if (status === "rejected") return -1;
  return STATUS_STEPS.findIndex((s) => s.key === status);
};

const statusBadge = (status) => {
  const map = {
    pending_manager_a: { label: "Pending Manager", cls: "bg-yellow-100 text-yellow-800" },
    approved_manager_a: { label: "Pending Mekhala", cls: "bg-blue-100 text-blue-800" },
    approved_mekhala: { label: "Mekhala Approved", cls: "bg-indigo-100 text-indigo-800" },
    completed: { label: "Completed", cls: "bg-green-100 text-green-800" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-800" },
  };
  return map[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
};

export default function TeacherTCRequestsPage() {
  const { userData } = useAuthStore();

  /* ── Tabs: "my" = teacher's own TC | "madrasa" = all requests from madrasa ── */
  const [activeTab, setActiveTab] = useState("my");

  /* ── Teacher's own TC request ── */
  const [myRequests, setMyRequests] = useState([]);
  const [loadingMy, setLoadingMy] = useState(true);
  const [madarsas, setMadarsas] = useState([]);
  const [madarsaSearch, setMadarsaSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [detailReq, setDetailReq] = useState(null);
  const [form, setForm] = useState({
    destinationMadarsaId: "",
    destinationMadarsaName: "",
    reason: "",
  });

  /* ── Madrasa TC requests ── */
  const [madarsaRequests, setMadarsaRequests] = useState([]);
  const [loadingMadarsa, setLoadingMadarsa] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (!userData) return;
    fetchMyRequests();
    fetchMadarsas();
    fetchMadarsaRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchMyRequests = async () => {
    try {
      setLoadingMy(true);
      const snap = await getDocs(
        query(
          collection(db, "tc_requests"),
          where("requesterId", "==", userData.id || userData.uid),
        ),
      );
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt ?? 0);
          const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt ?? 0);
          return tb - ta;
        });
      setMyRequests(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load your TC requests");
    } finally {
      setLoadingMy(false);
    }
  };

  const fetchMadarsas = async () => {
    try {
      const snap = await getDocs(collection(db, "madarsas"));
      const all = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => (m.madarsaId || m.id) !== userData?.madarsaId)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setMadarsas(all);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMadarsaRequests = async () => {
    if (!userData?.madarsaId) { setLoadingMadarsa(false); return; }
    try {
      setLoadingMadarsa(true);
      const snap = await getDocs(
        query(
          collection(db, "tc_requests"),
          where("sourceMadarsaId", "==", userData.madarsaId),
        ),
      );
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt ?? 0);
          const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt ?? 0);
          return tb - ta;
        });
      setMadarsaRequests(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load madrasa TC requests");
    } finally {
      setLoadingMadarsa(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.destinationMadarsaId) {
      toast.error("Select a destination madrasa");
      return;
    }
    if (!form.reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    // Removed the active request check to allow unlimited attempts as requested
    try {
      setSubmitting(true);
      const payload = {
        type: "teacher",
        requesterId: userData.id || userData.uid,
        requesterName: userData.fullName || userData.name,
        requesterEmail: userData.email,
        requesterSubject: userData.subject || "",
        sourceMadarsaId: userData.madarsaId,
        sourceMadarsaName: userData.madarsaName || "",
        destinationMadarsaId: form.destinationMadarsaId,
        destinationMadarsaName: form.destinationMadarsaName,
        reason: form.reason.trim(),
        status: "pending_manager_a",
        statusHistory: [
          {
            status: "pending_manager_a",
            by: userData.id || userData.uid,
            byName: userData.fullName || userData.name,
            byRole: "teacher",
            timestamp: new Date().toISOString(),
            note: form.reason.trim(),
          },
        ],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, "tc_requests"), payload);
      setSuccessData({
        teacherName: payload.requesterName,
        sourceMadarsaName: payload.sourceMadarsaName,
        destinationMadarsaName: payload.destinationMadarsaName,
        reason: payload.reason,
        submittedAt: new Date().toLocaleString("en-IN"),
      });
      setForm({ destinationMadarsaId: "", destinationMadarsaName: "", reason: "" });
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
    return (
      m.name?.toLowerCase().includes(q) ||
      String(m.madarsaId || m.id || "").toLowerCase().includes(q) ||
      m.district?.toLowerCase().includes(q)
    );
  });

  const canRaiseRequest = true; // Unlimited attempts allowed

  const filteredMadarsaRequests = madarsaRequests.filter((r) => {
    if (typeFilter === "all") return true;
    return r.type === typeFilter;
  });

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
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <ArrowRightLeft className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">TC Requests</h1>
            <p className="text-gray-500 text-sm">Manage transfer certificate requests</p>
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex gap-1 border-b">
          {[
            { key: "my", label: "My TC Request", icon: User },
            { key: "madrasa", label: `Madrasa Requests (${madarsaRequests.length})`, icon: Users },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? "border-teal-600 text-teal-700 bg-teal-50"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── MY TC REQUEST TAB ── */}
        {activeTab === "my" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Request a transfer certificate to move to another madrasa
              </p>
              {canRaiseRequest && (
                <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setShowForm(true)}>
                  <ArrowRightLeft className="w-4 h-4 mr-2" /> Request TC
                </Button>
              )}
            </div>

            {loadingMy ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-600 border-t-transparent" />
              </div>
            ) : myRequests.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <ArrowRightLeft className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No TC requests yet</p>
                  <p className="text-sm text-gray-400 mt-1">Click &ldquo;Request TC&rdquo; to start a transfer request</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {myRequests.map((req) => {
                  const badge = statusBadge(req.status);
                  const idx = stepIndex(req.status);
                  const nextStep = idx >= 0 && idx < STATUS_STEPS.length - 1 ? STATUS_STEPS[idx + 1]?.label : null;
                  return (
                    <Card key={req.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailReq(req)}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <p className="font-semibold text-gray-900">TC to: {req.destinationMadarsaName || req.destinationMadarsaId}</p>
                            <p className="text-sm text-gray-500 mt-0.5">Submitted: {formatDate(req.createdAt)}</p>
                            {nextStep && req.status !== "completed" && req.status !== "rejected" && (
                              <p className="text-xs text-teal-600 mt-1 font-medium">➜ Next: {nextStep}</p>
                            )}
                          </div>
                          <Badge className={badge.cls}>{badge.label}</Badge>
                        </div>
                        {req.status !== "rejected" ? (
                          <div className="flex items-center gap-1 overflow-x-auto">
                            {STATUS_STEPS.map((step, i) => (
                              <div key={step.key} className="flex items-center gap-1 flex-shrink-0">
                                <div className="flex flex-col items-center">
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                                    ${i < idx ? "bg-teal-600 text-white" : i === idx ? "bg-teal-600 text-white ring-2 ring-teal-200" : "bg-gray-200 text-gray-400"}`}>
                                    {i < idx ? <CheckCircle className="w-4 h-4" /> : i + 1}
                                  </div>
                                  <span className="text-[10px] mt-1 text-gray-500 text-center max-w-[60px]">{step.short}</span>
                                </div>
                                {i < STATUS_STEPS.length - 1 && (
                                  <div className={`h-0.5 w-6 flex-shrink-0 mb-3 ${i < idx ? "bg-teal-500" : "bg-gray-200"}`} />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-600">
                            <XCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">Request rejected</span>
                            {req.rejectionReason && <span className="text-sm text-gray-500">— {req.rejectionReason}</span>}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MADRASA TC REQUESTS TAB ── */}
        {activeTab === "madrasa" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {["all", "student", "teacher"].map((f) => (
                <Button key={f} size="sm"
                  variant={typeFilter === f ? "default" : "outline"}
                  onClick={() => setTypeFilter(f)}
                  className={typeFilter === f ? "bg-teal-600 hover:bg-teal-700" : ""}
                >
                  {f === "student" && <Users className="w-3.5 h-3.5 mr-1" />}
                  {f === "teacher" && <GraduationCap className="w-3.5 h-3.5 mr-1" />}
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="ml-1.5 text-xs opacity-70">
                    ({f === "all" ? madarsaRequests.length : madarsaRequests.filter((r) => r.type === f).length})
                  </span>
                </Button>
              ))}
            </div>

            {loadingMadarsa ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-600 border-t-transparent" />
              </div>
            ) : filteredMadarsaRequests.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <ArrowRightLeft className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No TC requests found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredMadarsaRequests.map((req) => {
                  const badge = statusBadge(req.status);
                  const idx = stepIndex(req.status);
                  const nextStep = idx >= 0 && idx < STATUS_STEPS.length - 1 ? STATUS_STEPS[idx + 1]?.label : null;
                  return (
                    <Card key={req.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailReq(req)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {req.type === "teacher" ? (
                              <GraduationCap className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                            ) : (
                              <Users className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
                            )}
                            <div>
                              <p className="font-medium text-sm text-gray-900">{req.requesterName || "—"}</p>
                              <p className="text-xs text-gray-400">
                                {req.type === "student" ? `Class: ${req.requesterClass || "—"}` : req.requesterEmail || "Teacher"}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">→ {req.destinationMadarsaName || req.destinationMadarsaId}</p>
                              {nextStep && req.status !== "completed" && req.status !== "rejected" && (
                                <p className="text-xs text-teal-600 mt-0.5 font-medium">➜ Next: {nextStep}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <Badge className={`${badge.cls} text-xs`}>{badge.label}</Badge>
                            <p className="text-[10px] text-gray-400">{formatDate(req.createdAt)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── New Request Form Dialog ── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teacher Transfer Certificate Request</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div>
              <Label>Destination Madrasa <span className="text-red-500">*</span></Label>
              <p className="text-xs text-gray-500 mb-2">Select the madrasa you want to transfer to</p>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search madrasa..." value={madarsaSearch} onChange={(e) => setMadarsaSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                {filteredMadarsas.length === 0 ? (
                  <p className="text-sm text-gray-500 p-3 text-center">No madarsas found</p>
                ) : filteredMadarsas.map((m) => (
                  <div key={m.id}
                    onClick={() => setForm((f) => ({ ...f, destinationMadarsaId: m.madarsaId || m.id, destinationMadarsaName: m.name }))}
                    className={`p-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between
                      ${form.destinationMadarsaId === (m.madarsaId || m.id) ? "bg-teal-50 border-l-2 border-teal-600" : ""}`}
                  >
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-gray-500">{m.district} {m.madarsaId ? `· ${m.madarsaId}` : ""}</p>
                    </div>
                    {form.destinationMadarsaId === (m.madarsaId || m.id) && <CheckCircle className="w-4 h-4 text-teal-600 flex-shrink-0" />}
                  </div>
                ))}
              </div>
              {form.destinationMadarsaName && (
                <p className="text-xs text-teal-600 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Selected: {form.destinationMadarsaName}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="reason">Reason for Transfer <span className="text-red-500">*</span></Label>
              <Textarea id="reason" placeholder="Explain why you want to transfer..." value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={3} className="mt-1" />
            </div>

            <div className="bg-yellow-50 rounded-md p-3 flex gap-2 text-sm text-yellow-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>Your request goes through: Source Manager → Corresponding Mekhala → Destination Manager for direct placement.</p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-700">
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Success Screen ── */}
      <Dialog open={!!successData} onOpenChange={() => setSuccessData(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="sr-only">TC Request Submitted Successfully</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4 print:p-6">
            <div className="text-center border-b pb-3">
              <p className="text-xs font-semibold text-teal-700 tracking-widest uppercase">Darul Khair Jamia Uloom</p>
              <h2 className="text-lg font-bold text-gray-900 mt-0.5">Teacher Transfer Certificate Request</h2>
              <p className="text-xs text-gray-400">Confirmation Receipt</p>
            </div>
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-base font-semibold text-green-700">Request Submitted Successfully!</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              {[
                ["Teacher Name", successData?.teacherName],
                ["From Madrasa", successData?.sourceMadarsaName],
                ["To Madrasa", successData?.destinationMadarsaName],
                ["Submitted", successData?.submittedAt],
              ].map(([k, v]) => v ? (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500 font-medium">{k}</span>
                  <span className="font-semibold text-right max-w-[55%]">{v}</span>
                </div>
              ) : null)}
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-800">
              Your TC request has been forwarded to the <strong>Sadar</strong> of{" "}
              <strong>{successData?.sourceMadarsaName || "your madrasa"}</strong>.
              A performance rating will be given at the Sadar stage.
            </div>
            {successData?.reason && (
              <div className="border rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Your Reason</p>
                <p className="text-sm text-gray-700 italic">&ldquo;{successData.reason}&rdquo;</p>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-2 print:hidden">
            <Button variant="outline" onClick={() => window.print()} className="gap-2">
              <Printer className="w-4 h-4" /> Print / Save PDF
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setSuccessData(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ── */}
      <Dialog open={!!detailReq} onOpenChange={() => setDetailReq(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>TC Request Details</DialogTitle></DialogHeader>
          {detailReq && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Name", detailReq.requesterName],
                  ["Type", detailReq.type],
                  ["Email", detailReq.requesterEmail],
                  detailReq.type === "student"
                    ? ["Class", detailReq.requesterClass || "—"]
                    : ["Subject", detailReq.requesterSubject || "—"],
                  ["From", detailReq.sourceMadarsaName || detailReq.sourceMadarsaId],
                  ["To", detailReq.destinationMadarsaName || detailReq.destinationMadarsaId],
                  ["Reason", detailReq.reason],
                  ["Submitted", formatDate(detailReq.createdAt)],
                  ...(detailReq.rejectionReason ? [["Rejected Because", detailReq.rejectionReason]] : []),
                  ...(detailReq.teacherRating ? [["Sadar Rating", `${detailReq.teacherRating}/5`]] : []),
                  ...(detailReq.teacherRatingComment ? [["Rating Comment", detailReq.teacherRatingComment]] : []),
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}><p className="text-gray-500">{k}</p><p className="font-medium">{v}</p></div>
                ))}
              </div>
              {/* Next step */}
              {detailReq.status !== "completed" && detailReq.status !== "rejected" && (() => {
                const idx = stepIndex(detailReq.status);
                const next = idx >= 0 ? STATUS_STEPS[idx + 1] : null;
                return next ? (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-700">
                    <span className="font-semibold">Next Step: </span>{next.label}
                  </div>
                ) : null;
              })()}
              <div>
                <p className="text-sm font-semibold mb-3">Status History</p>
                <div className="space-y-4">
                  {(() => {
                    const fullHistory = [...(detailReq.statusHistory || [])];
                    if (fullHistory.length === 0 || fullHistory[0].status !== "pending_manager_a") {
                      fullHistory.unshift({
                        status: "pending_manager_a",
                        byName: detailReq.requesterName || "Requester",
                        byRole: detailReq.type || "user",
                        timestamp: detailReq.createdAt?.toDate?.()?.toISOString() || detailReq.createdAt,
                        note: detailReq.reason
                      });
                    }
                    
                    const getStatusLabel = (st) => {
                      const map = {
                        pending_manager_a: "Submitted by Requester",
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
                          <div className="w-6 h-6 rounded-full bg-teal-600 flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </div>
                          {i < fullHistory.length - 1 && (
                            <div className="w-0.5 h-full bg-teal-200 mt-1 min-h-[20px]" />
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
    </Layout>
  );
}
