"use client";

import { useState, useEffect, useRef } from "react";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  Star,
  RefreshCw,
  Clock,
  Eye,
  Users,
  GraduationCap,
  QrCode,
  X,
  Camera,
  Upload,
  Search,
  FileText,
  ChevronRight,
  Printer,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  setDoc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";

const formatDate = (v) => {
  if (!v) return "—";
  if (v?.toDate) return v.toDate().toLocaleString("en-IN");
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleString("en-IN");
};

const STUDENT_STEPS = [
  { key: "pending_manager_a", short: "Submitted" },
  { key: "approved_manager_a", short: "Mgr A Approved" },
  { key: "approved_sadar_a", short: "Sadar Approved" },
  { key: "approved_manager_b", short: "Mgr B Approved" },
  { key: "completed", short: "Complete" },
];

const TEACHER_STEPS = [
  { key: "pending_manager_a", short: "Submitted" },
  { key: "approved_manager_a", short: "Mgr A Approved" },
  { key: "approved_mekhala", short: "Mekhala Approved" },
  { key: "completed", short: "Complete" },
];

const NEXT_STEP_LABEL = {
  pending_manager_a: "Awaiting Source Manager approval",
  approved_manager_a: "Awaiting Sadar approval — action required",
  approved_sadar_a: "Forwarded to Destination Manager for approval",
  approved_mekhala: "Forwarded to Destination Manager for approval",
  approved_manager_b: "Awaiting Destination Madrasa to mark complete",
  completed: "Transfer complete ✓",
  rejected: "Request has been rejected",
};

const statusBadge = (status) => {
  const map = {
    pending_manager_a: {
      label: "Awaiting Manager",
      cls: "bg-yellow-100 text-yellow-700",
    },
    approved_manager_a: {
      label: "Awaiting Your Approval",
      cls: "bg-orange-100 text-orange-700",
    },
    approved_sadar_a: {
      label: "Forwarded to Mgr B",
      cls: "bg-blue-100 text-blue-700",
    },
    approved_mekhala: {
      label: "Forwarded to Mgr B",
      cls: "bg-blue-100 text-blue-700",
    },
    approved_manager_b: {
      label: "Ready to Complete",
      cls: "bg-purple-100 text-purple-700",
    },
    completed: { label: "Completed", cls: "bg-green-100 text-green-700" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700" },
  };
  return map[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
};

const StatusTimeline = ({ req }) => {
  if (!req) return null;
  const status = req.status;
  const steps = req.type === "teacher" ? TEACHER_STEPS : STUDENT_STEPS;
  const idx = steps.findIndex(s => s.key === status);
  if (status === "rejected")
    return (
      <div className="flex items-center gap-2 text-red-600 text-sm">
        <XCircle className="w-4 h-4" /> Rejected
      </div>
    );
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0
            ${i <= idx ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-400"}`}
          >
            {i <= idx ? "✓" : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 w-4 flex-shrink-0 ${i < idx ? "bg-teal-500" : "bg-gray-200"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default function MadarsaTCRequestsPage() {
  const { userData } = useAuthStore();

  const [outgoing, setOutgoing] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("outgoing");

  // Type filter (student | teacher | all)
  const [typeFilter, setTypeFilter] = useState("all");

  // Action dialog
  const [actionReq, setActionReq] = useState(null);
  const [actionType, setActionType] = useState(""); // 'approve' | 'reject' | 'complete'
  const [rejectReason, setRejectReason] = useState("");
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [processing, setProcessing] = useState(false);

  // 3-step approval wizard state
  const [wizardStep, setWizardStep] = useState(1); // 1=madrasa, 2=upload doc, 3=message
  const [wizardMadarsas, setWizardMadarsas] = useState([]);
  const [wizardMadarsaSearch, setWizardMadarsaSearch] = useState("");
  const [preferredMadarsaId, setPreferredMadarsaId] = useState("");
  const [preferredMadarsaName, setPreferredMadarsaName] = useState("");
  const [approveDocFiles, setApproveDocFiles] = useState([]);
  const [approveMessage, setApproveMessage] = useState("");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Detail dialog
  const [detailReq, setDetailReq] = useState(null);
  const [completionReceipt, setCompletionReceipt] = useState(null);

  // QR upload
  const [qrModal, setQrModal] = useState({
    open: false,
    url: "",
    sessionId: "",
  });
  const [mobileSession, setMobileSession] = useState(null);
  const [mobileFiles, setMobileFiles] = useState([]);
  const unsubRef = useRef(null);
  const [devQrUrl, setDevQrUrl] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("devQrBaseUrl") ||
        process.env.NEXT_PUBLIC_QR_BASE_URL ||
        ""
      );
    }
    return process.env.NEXT_PUBLIC_QR_BASE_URL || "";
  });
  const [qrUrlDraft, setQrUrlDraft] = useState("");
  const [editingQrUrl, setEditingQrUrl] = useState(false);

  /* ─── fetch ─────────────────────────────────────── */
  useEffect(() => {
    if (!userData?.madarsaId) return;
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchRequests = async () => {
    // Also fetch madarsas for wizard
    try {
      const mSnap = await getDocs(collection(db, "madarsas"));
      setWizardMadarsas(
        mSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      );
    } catch (_) {}
    try {
      setLoading(true);
      const madarsaId = userData.madarsaId;

      const [outSnap, inSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "tc_requests"),
            where("sourceMadarsaId", "==", madarsaId),
          ),
        ),
        getDocs(
          query(
            collection(db, "tc_requests"),
            where("destinationMadarsaId", "==", madarsaId),
            where("status", "in", ["approved_manager_b", "completed"]),
          ),
        ),
      ]);

      const sortDesc = (arr) =>
        arr.sort((a, b) => {
          const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt ?? 0);
          const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt ?? 0);
          return tb - ta;
        });
      setOutgoing(
        sortDesc(outSnap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      );
      setIncoming(
        sortDesc(inSnap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to load TC requests");
    } finally {
      setLoading(false);
    }
  };

  /* ─── QR upload ────────────────────────────────────── */
  useEffect(() => {
    if (!mobileSession?.sessionId) return;
    if (unsubRef.current) unsubRef.current();

    const unsub = onSnapshot(
      doc(db, "mobileUploadSessions", mobileSession.sessionId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() || {};
        const pending = data.files || [];
        if (pending.length > 0) {
          setMobileFiles((prev) => {
            const existingNames = new Set(prev.map((f) => f.name));
            const newOnes = pending.filter((p) => !existingNames.has(p.name));
            if (newOnes.length === 0) return prev;
            toast.success(`${newOnes.length} file(s) received from mobile`);
            setQrModal((m) => (m.open ? { ...m, open: false } : m));
            return [...prev, ...newOnes];
          });
        }
      },
    );

    unsubRef.current = unsub;
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileSession]);

  const openQrUpload = async () => {
    const origin = (process.env.NEXT_PUBLIC_QR_BASE_URL || "").replace(
      /\/+$/,
      "",
    );

    if (!origin || /localhost|127\.0\.0\.1/i.test(origin)) {
      toast.error(
        "QR base URL is not configured. Set NEXT_PUBLIC_QR_BASE_URL in your .env to a public domain/tunnel (no localhost).",
      );
      return;
    }

    try {
      const sessionId = crypto.randomUUID();
      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + 10 * 60 * 1000),
      );
      await setDoc(doc(db, "mobileUploadSessions", sessionId), {
        draftId: "",
        step: "tc-request",
        status: "active",
        createdAt: serverTimestamp(),
        expiresAt,
        uploadCount: 0,
        lastUploadAt: null,
      });
      const url = `${origin}/mobile-upload?sessionId=${encodeURIComponent(sessionId)}`;
      setQrModal({ open: true, url, sessionId });
      setMobileSession({ sessionId });
    } catch (e) {
      console.error("Failed to create upload session:", e);
      toast.error("Failed to create upload session");
    }
  };

  /* ─── approve outgoing (Sadar A) ─────────────────── */
  const openApprove = (req) => {
    setActionReq(req);
    setActionType("approve");
    setRating(0);
    setRatingComment("");
    setRejectReason("");
    // Reset wizard
    setWizardStep(1);
    setWizardMadarsaSearch("");
    setPreferredMadarsaId(req.destinationMadarsaId || "");
    setPreferredMadarsaName(req.destinationMadarsaName || "");
    setApproveDocFiles([]);
    setApproveMessage("");
  };

  const openReject = (req) => {
    setActionReq(req);
    setActionType("reject");
    setRejectReason("");
  };

  const openComplete = (req) => {
    setActionReq(req);
    setActionType("complete");
  };

  const handleAction = async () => {
    if (!actionReq) return;
    if (actionType === "reject" && !rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    if (
      actionType === "approve" &&
      actionReq.type === "teacher" &&
      rating === 0
    ) {
      toast.error("Please provide rating before approving teacher TC");
      return;
    }
    if (actionType === "approve" && !preferredMadarsaId) {
      toast.error("Please select a preferred destination madrasa");
      return;
    }

    try {
      setProcessing(true);
      const newStatus =
        actionType === "reject"
          ? "rejected"
          : actionType === "complete"
            ? "completed"
            : "approved_sadar_a";

      const historyEntry = {
        status: newStatus,
        by: userData.id || userData.uid,
        byName: userData.fullName || userData.name,
        byRole: userData.madarsaName || "Sadar",
        madarsaName: userData.madarsaName || "",
        timestamp: new Date().toISOString(),
        note:
          actionType === "reject"
            ? rejectReason
            : actionType === "complete"
              ? `Transfer completed by ${userData.madarsaName || "Destination Sadar"}`
              : approveMessage,
      };

      const updateData = {
        status: newStatus,
        updatedAt: serverTimestamp(),
        statusHistory: [...(actionReq.statusHistory || []), historyEntry],
        ...(actionType === "reject" && {
          rejectedBy: userData.fullName || userData.name,
          rejectionReason: rejectReason,
        }),
        ...(actionType === "approve" && {
          preferredDestinationMadarsaId: preferredMadarsaId,
          preferredDestinationMadarsaName: preferredMadarsaName,
          sadarApprovalMessage: approveMessage,
          ...(approveDocFiles.length > 0 && {
            sadarApprovalDocs: approveDocFiles.map((f) => ({ name: f.name, url: f.url || "" })),
          }),
          ...(actionReq.type === "teacher" && {
            teacherRating: rating,
            teacherRatingComment: ratingComment,
          }),
        }),
      };

      await updateDoc(doc(db, "tc_requests", actionReq.id), updateData);

      // When TC is marked complete → transfer the student/teacher to the destination madarsa
      if (actionType === "complete") {
        try {
          const destId = actionReq.destinationMadarsaId;
          const destName = actionReq.destinationMadarsaName || "";
          const coll = actionReq.type === "teacher" ? "teachers" : "students";
          const rid = actionReq.requesterId;
          // Try by 'id' field first, then by 'uid' field
          let docToUpdate = null;
          const snap1 = await getDocs(query(collection(db, coll), where("id", "==", rid)));
          if (!snap1.empty) {
            docToUpdate = snap1.docs[0];
          } else {
            const snap2 = await getDocs(query(collection(db, coll), where("uid", "==", rid)));
            if (!snap2.empty) docToUpdate = snap2.docs[0];
          }
          if (docToUpdate) {
            let updatePayload = {
              madarsaId: destId,
              madarsaName: destName,
              status: "active",
              updatedAt: serverTimestamp(),
            };
            
            if (coll === "students") {
               try {
                 const res = await fetch("/api/public/admission-number", {
                   method: "POST",
                   headers: { "Content-Type": "application/json" },
                   body: JSON.stringify({ madarsaId: destId })
                 });
                 const data = await res.json();
                 if (data.admissionNumber) {
                   updatePayload.admissionNumber = `mid-${data.admissionNumber}`;
                 }
               } catch (e) {
                 console.error("Failed to generate new MID", e);
               }
            }

            await updateDoc(doc(db, coll, docToUpdate.id), updatePayload);
          }
        } catch (transferErr) {
          console.error("Failed to update madarsaId after TC complete:", transferErr);
          // Don't re-throw — transfer is marked complete even if doc update fails
        }
      }

      // If teacher TC & approved, also update rating on teacher doc
      if (
        actionType === "approve" &&
        actionReq.type === "teacher" &&
        actionReq.requesterId
      ) {
        try {
          // Find teacher doc
          const tSnap = await getDocs(
            query(
              collection(db, "teachers"),
              where("id", "==", actionReq.requesterId),
            ),
          );
          if (!tSnap.empty) {
            await updateDoc(doc(db, "teachers", tSnap.docs[0].id), {
              tcRating: rating,
              tcRatingComment: ratingComment,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          console.error("Failed to update teacher rating:", err);
        }
      }

      if (actionType === "complete") {
        setCompletionReceipt({
          requesterName: actionReq.requesterName,
          type: actionReq.type,
          requesterClass: actionReq.requesterClass || "",
          requesterEmail: actionReq.requesterEmail || "",
          sourceMadarsaName: actionReq.sourceMadarsaName,
          destinationMadarsaName: actionReq.destinationMadarsaName,
          reason: actionReq.reason,
          transferMode: actionReq.transferMode || "online",
          completedAt: new Date().toLocaleString("en-IN"),
          completedBy: userData.fullName || userData.name,
          statusHistory: [...(actionReq.statusHistory || []), historyEntry],
        });
      }

      toast.success(
        actionType === "reject"
          ? "Request rejected"
          : actionType === "complete"
            ? "Transfer marked as complete!"
            : "Request approved and forwarded",
      );
      setActionReq(null);
      fetchRequests();
    } catch (err) {
      console.error(err);
      toast.error("Action failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  /* ─── counts ─────────────────────────────────────── */
  const outPending = outgoing.filter(
    (r) => r.status === "approved_manager_a",
  ).length;
  const inPending = incoming.filter(
    (r) => r.status === "approved_manager_b",
  ).length;

  /* ─── loading ────────────────────────────────────── */
  if (loading) {
    return (
      <ProtectedRoute requiredRole="madarsa_admin">
        <Layout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const renderRequestRow = (req, isIncoming = false) => {
    const badge = statusBadge(req.status);
    const needsOutgoingApproval =
      !isIncoming && req.status === "approved_manager_a";
    const needsIncomingComplete =
      isIncoming && req.status === "approved_manager_b";
    const isTeacher = req.type === "teacher";
    const STATUS_STEPS_KEYS = isTeacher
      ? ["pending_manager_a", "approved_manager_a", "approved_mekhala", "completed"]
      : ["pending_manager_a", "approved_manager_a", "approved_sadar_a", "approved_manager_b", "completed"];
    const STATUS_STEPS_LABELS = isTeacher
      ? ["Submitted", "Mgr A Approved", "Mekhala Approved", "Complete"]
      : ["Submitted", "Mgr A Approved", "Sadar Approved", "Mgr B Approved", "Complete"];
    const idx = STATUS_STEPS_KEYS.indexOf(req.status);
    const nextLabel = idx >= 0 && idx < STATUS_STEPS_KEYS.length - 1 ? STATUS_STEPS_LABELS[idx + 1] : null;
    return (
      <TableRow key={req.id}>
        <TableCell>
          <div className="flex items-center gap-1.5">
            {req.type === "teacher" ? (
              <GraduationCap className="w-4 h-4 text-blue-500 flex-shrink-0" />
            ) : (
              <Users className="w-4 h-4 text-teal-500 flex-shrink-0" />
            )}
            <span className="font-medium">{req.requesterName || "—"}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {req.type === "student"
              ? `Class: ${req.requesterClass || "—"} · Adm: ${req.requesterAdmissionNo || "—"}`
              : req.requesterEmail || "—"}
          </p>
          {nextLabel && req.status !== "completed" && req.status !== "rejected" && (
            <p className="text-[10px] text-teal-600 font-medium mt-0.5">➜ Next: {nextLabel}</p>
          )}
        </TableCell>
        <TableCell>
          {isIncoming
            ? req.sourceMadarsaName || req.sourceMadarsaId || "—"
            : req.destinationMadarsaName || req.destinationMadarsaId || "—"}
        </TableCell>
        <TableCell>
          <StatusTimeline req={req} />
        </TableCell>
        <TableCell>
          <Badge className={badge.cls}>{badge.label}</Badge>
        </TableCell>
        <TableCell className="text-gray-500 text-xs">
          {formatDate(req.createdAt)}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDetailReq(req)}
            >
              <Eye className="w-4 h-4" />
            </Button>
            {needsOutgoingApproval && (
              <>
                <Button
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => openApprove(req)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => openReject(req)}
                >
                  Reject
                </Button>
              </>
            )}
            {needsIncomingComplete && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => openComplete(req)}
              >
                Complete
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <ProtectedRoute requiredRole="madarsa_admin">
      <Layout>
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">TC Requests</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage Transfer Certificate requests for your madarsa
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openQrUpload}
                className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
              >
                <QrCode className="w-4 h-4" /> Upload Doc (QR)
              </Button>
              <Button variant="outline" size="sm" onClick={fetchRequests}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </div>
          </div>

          {/* Mobile session active indicator */}
          {mobileSession && !qrModal.open && (
            <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              Waiting for mobile upload… (session active)
              {mobileFiles.length > 0 && (
                <span className="font-medium ml-1">
                  · {mobileFiles.length} file(s) received
                </span>
              )}
              <button
                type="button"
                className="ml-auto text-indigo-400 hover:text-indigo-600"
                onClick={() => {
                  setMobileSession(null);
                  if (unsubRef.current) {
                    unsubRef.current();
                    unsubRef.current = null;
                  }
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Received mobile files */}
          {mobileFiles.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-indigo-800">
                Uploaded from Mobile ({mobileFiles.length}):
              </p>
              {mobileFiles.map((f, i) => (
                <a
                  key={i}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-indigo-600 hover:underline"
                >
                  <QrCode className="w-3 h-3" /> {f.name}
                </a>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2">
            <Button
              variant={tab === "outgoing" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("outgoing")}
              className={
                tab === "outgoing" ? "bg-teal-600 hover:bg-teal-700" : ""
              }
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Outgoing ({outgoing.length})
              {outPending > 0 && (
                <span className="ml-2 bg-yellow-400 text-yellow-900 text-xs px-1.5 rounded-full">
                  {outPending}
                </span>
              )}
            </Button>
            <Button
              variant={tab === "incoming" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("incoming")}
              className={
                tab === "incoming" ? "bg-teal-600 hover:bg-teal-700" : ""
              }
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Incoming ({incoming.length})
              {inPending > 0 && (
                <span className="ml-2 bg-purple-400 text-white text-xs px-1.5 rounded-full">
                  {inPending}
                </span>
              )}
            </Button>
          </div>

          {/* Outgoing Table */}
          {tab === "outgoing" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">
                    Outgoing TC Requests — from your madarsa
                  </CardTitle>
                  {/* Type filter */}
                  <div className="flex gap-1">
                    {["all", "student", "teacher"].map((f) => (
                      <Button key={f} size="sm"
                        variant={typeFilter === f ? "default" : "outline"}
                        onClick={() => setTypeFilter(f)}
                        className={`h-7 text-xs ${typeFilter === f ? "bg-teal-600 hover:bg-teal-700" : ""}`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        <span className="ml-1 opacity-70">
                          ({f === "all" ? outgoing.length : outgoing.filter((r) => r.type === f).length})
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Going To</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outgoing.filter(r => typeFilter === "all" || r.type === typeFilter).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                          No outgoing TC requests
                        </TableCell>
                      </TableRow>
                    ) : (
                      outgoing
                        .filter(r => typeFilter === "all" || r.type === typeFilter)
                        .map((r) => renderRequestRow(r, false))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Incoming Table */}
          {tab === "incoming" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">
                    Incoming TC Requests — ready to join your madarsa
                  </CardTitle>
                  <div className="flex gap-1">
                    {["all", "student", "teacher"].map((f) => (
                      <Button key={f} size="sm"
                        variant={typeFilter === f ? "default" : "outline"}
                        onClick={() => setTypeFilter(f)}
                        className={`h-7 text-xs ${typeFilter === f ? "bg-teal-600 hover:bg-teal-700" : ""}`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        <span className="ml-1 opacity-70">
                          ({f === "all" ? incoming.length : incoming.filter((r) => r.type === f).length})
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Coming From</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incoming.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-10 text-gray-500"
                        >
                          No incoming TC requests yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      (typeFilter === "all" ? incoming : incoming.filter((r) => r.type === typeFilter)).map((r) => renderRequestRow(r, true))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Dialog */}
        <Dialog
          open={!!actionReq}
          onOpenChange={() => {
            setActionReq(null);
            setRejectReason("");
            setRating(0);
            setRatingComment("");
            setWizardStep(1);
            setApproveDocFiles([]);
            setApproveMessage("");
          }}
        >
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {actionType === "reject" ? "Reject TC Request"
                  : actionType === "complete" ? "Complete Transfer"
                  : "Approve TC Request"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Person summary */}
              {actionReq && (
                <div className="bg-gray-50 rounded-md p-3 text-sm">
                  <p><span className="text-gray-500">Person:</span> <strong>{actionReq.requesterName}</strong></p>
                  <p><span className="text-gray-500">Type:</span> {actionReq.type === "teacher" ? "Teacher" : "Student"}</p>
                  <p><span className="text-gray-500">Destination:</span> {actionReq.destinationMadarsaName || actionReq.destinationMadarsaId}</p>
                </div>
              )}

              {/* ── APPROVE: 3-Step Wizard ── */}
              {actionType === "approve" && (
                <>
                  {/* Step indicator */}
                  <div className="flex items-center gap-2">
                    {["Preferred Madrasa", "Upload Doc", "Message & Submit"].map((s, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                          ${wizardStep > i + 1 ? "bg-teal-600 text-white" : wizardStep === i + 1 ? "bg-teal-500 text-white ring-2 ring-teal-200" : "bg-gray-200 text-gray-400"}`}>
                          {wizardStep > i + 1 ? "✓" : i + 1}
                        </div>
                        <span className={`text-xs ${wizardStep === i + 1 ? "font-semibold text-teal-700" : "text-gray-400"}`}>{s}</span>
                        {i < 2 && <ChevronRight className="w-3 h-3 text-gray-300" />}
                      </div>
                    ))}
                  </div>

                  {/* Step 1: Preferred Madrasa Selection */}
                  {wizardStep === 1 && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-semibold">Preferred Madrasa Selection <span className="text-red-500">*</span></Label>
                        <p className="text-xs text-gray-500 mb-2">Select the preferred destination madrasa for this student/teacher</p>
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input placeholder="Search madrasa..." value={wizardMadarsaSearch}
                            onChange={(e) => setWizardMadarsaSearch(e.target.value)} className="pl-9" />
                        </div>
                        <div className="max-h-52 overflow-y-auto border rounded-md divide-y">
                          {wizardMadarsas
                            .filter(m => !wizardMadarsaSearch || m.name?.toLowerCase().includes(wizardMadarsaSearch.toLowerCase()) || String(m.madarsaId || "").includes(wizardMadarsaSearch))
                            .map((m) => (
                              <div key={m.id}
                                onClick={() => { setPreferredMadarsaId(m.madarsaId || m.id); setPreferredMadarsaName(m.name); }}
                                className={`p-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between
                                  ${preferredMadarsaId === (m.madarsaId || m.id) ? "bg-teal-50 border-l-2 border-teal-600" : ""}`}
                              >
                                <div>
                                  <p className="text-sm font-medium">{m.name}</p>
                                  <p className="text-xs text-gray-500">{m.district} {m.madarsaId ? `· ${m.madarsaId}` : ""}</p>
                                </div>
                                {preferredMadarsaId === (m.madarsaId || m.id) && <CheckCircle className="w-4 h-4 text-teal-600" />}
                              </div>
                            ))}
                        </div>
                        {preferredMadarsaName && (
                          <p className="text-xs text-teal-600 mt-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Selected: {preferredMadarsaName}
                          </p>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <Button disabled={!preferredMadarsaId} onClick={() => setWizardStep(2)} className="bg-teal-600 hover:bg-teal-700">
                          Next: Upload Document →
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Document Upload */}
                  {wizardStep === 2 && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-semibold">Document Upload</Label>
                        <p className="text-xs text-gray-500 mb-3">Upload a supporting document or photo for this approval</p>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" className="flex-1 gap-2 border-dashed"
                            onClick={() => cameraInputRef.current?.click()}>
                            <Camera className="w-4 h-4" /> Take Photo
                          </Button>
                          <Button type="button" variant="outline" className="flex-1 gap-2 border-dashed"
                            onClick={() => fileInputRef.current?.click()}>
                            <Upload className="w-4 h-4" /> Choose File
                          </Button>
                        </div>
                        <input ref={cameraInputRef} type="file" accept="image/*" capture="camera" className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setApproveDocFiles((prev) => [...prev, { name: file.name, file }]);
                            e.target.value = "";
                          }} />
                        <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setApproveDocFiles((prev) => [...prev, { name: file.name, file }]);
                            e.target.value = "";
                          }} />
                        {approveDocFiles.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {approveDocFiles.map((f, i) => (
                              <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                                <FileText className="w-4 h-4 text-gray-400" />
                                <span className="flex-1 truncate">{f.name}</span>
                                <button type="button" onClick={() => setApproveDocFiles(prev => prev.filter((_, j) => j !== i))}>
                                  <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-2">You may skip this step if no document is required.</p>
                      </div>
                      <div className="flex justify-between">
                        <Button type="button" variant="outline" onClick={() => setWizardStep(1)}>← Back</Button>
                        <Button onClick={() => setWizardStep(3)} className="bg-teal-600 hover:bg-teal-700">
                          Next: Add Message →
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Message + (Rating for teacher) + Submit */}
                  {wizardStep === 3 && (
                    <div className="space-y-3">
                      {/* Rating (teacher only) */}
                      {actionReq?.type === "teacher" && (
                        <div>
                          <Label>Teacher Performance Rating <span className="text-red-500">*</span></Label>
                          <p className="text-xs text-gray-500 mb-2">Rate this teacher before approving</p>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button key={n} type="button" onClick={() => setRating(n)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center
                                  ${n <= rating ? "bg-yellow-400 text-yellow-900" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>
                                <Star className={`w-5 h-5 ${n <= rating ? "fill-current" : ""}`} />
                              </button>
                            ))}
                            {rating > 0 && <span className="text-sm font-medium self-center ml-2">{rating}/5</span>}
                          </div>
                          <Textarea className="mt-2" placeholder="Rating comment (optional)"
                            value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} rows={2} />
                        </div>
                      )}
                      <div>
                        <Label>Remark (Optional)</Label>
                        <Textarea placeholder="Add a remark for this approval (optional)..."
                          value={approveMessage} onChange={(e) => setApproveMessage(e.target.value)} rows={3} className="mt-1" />
                      </div>
                      <div className="flex justify-between">
                        <Button type="button" variant="outline" onClick={() => setWizardStep(2)}>← Back</Button>
                        <Button disabled={processing || (actionReq?.type === "teacher" && rating === 0)}
                          onClick={handleAction} className="bg-teal-600 hover:bg-teal-700 text-white">
                          {processing ? "Processing..." : "Approve & Forward"}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── REJECT ── */}
              {actionType === "reject" && (
                <>
                  <div>
                    <Label htmlFor="reason">Rejection Reason <span className="text-red-500">*</span></Label>
                    <Textarea id="reason" placeholder="Explain why this request is rejected..."
                      value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="mt-1" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setActionReq(null)}>Cancel</Button>
                    <Button disabled={processing} onClick={handleAction} className="bg-red-600 hover:bg-red-700 text-white">
                      {processing ? "Processing..." : "Reject"}
                    </Button>
                  </div>
                </>
              )}

              {/* ── COMPLETE ── */}
              {actionType === "complete" && (
                <>
                  <p className="text-sm text-gray-600">
                    Confirm that <strong>{actionReq?.requesterName}</strong> has joined your madarsa and mark the transfer as complete.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setActionReq(null)}>Cancel</Button>
                    <Button disabled={processing} onClick={handleAction} className="bg-teal-600 hover:bg-teal-700 text-white">
                      {processing ? "Processing..." : "Mark Complete"}
                    </Button>
                  </div>
                </>
              )}
            </div>
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
                    ["Name", detailReq.requesterName],
                    ["Type", detailReq.type],
                    ["Email", detailReq.requesterEmail],
                    ["Class", detailReq.requesterClass || "—"],
                    ["Adm. No.", detailReq.requesterAdmissionNo || "—"],
                    [
                      "From",
                      detailReq.sourceMadarsaName || detailReq.sourceMadarsaId,
                    ],
                    [
                      "To",
                      detailReq.destinationMadarsaName ||
                        detailReq.destinationMadarsaId,
                    ],
                    ["Reason", detailReq.reason],
                    ["Submitted", formatDate(detailReq.createdAt)],
                    ...(detailReq.rejectionReason
                      ? [["Rejection Reason", detailReq.rejectionReason]]
                      : []),
                    ...(detailReq.teacherRating
                      ? [["Teacher Rating", `${detailReq.teacherRating}/5`]]
                      : []),
                    ...(detailReq.teacherRatingComment
                      ? [["Rating Comment", detailReq.teacherRatingComment]]
                      : []),
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <p className="text-gray-500">{k}</p>
                        <p className="font-medium">{v}</p>
                      </div>
                    ))}
                </div>
                {/* Next Step Banner */}
                {detailReq.status && (
                  <div className={`rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-2
                    ${
                      detailReq.status === "completed" ? "bg-green-50 text-green-700 border border-green-200" :
                      detailReq.status === "rejected" ? "bg-red-50 text-red-700 border border-red-200" :
                      "bg-teal-50 text-teal-700 border border-teal-200"
                    }`}>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    <span><span className="font-semibold">Next: </span>{NEXT_STEP_LABEL[detailReq.status] || detailReq.status.replace(/_/g, " ")}</span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold mb-3">Status History</p>
                  <div className="space-y-3">
                    {(detailReq.statusHistory || []).map((h, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-6 h-6 rounded-full bg-teal-600 flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </div>
                          {i < detailReq.statusHistory.length - 1 && (
                            <div className="w-0.5 h-5 bg-teal-200 mt-1" />
                          )}
                        </div>
                        <div className="pb-2">
                          <p className="text-sm font-medium capitalize">
                            {h.status?.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-gray-500">
                            {h.byName} · {h.byRole} ·{" "}
                            {h.timestamp
                              ? new Date(h.timestamp).toLocaleString("en-IN")
                              : "—"}
                          </p>
                          {h.note && (
                            <p className="text-xs text-gray-400 italic">
                              {h.note}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* QR Modal */}
        <Dialog
          open={qrModal.open}
          onOpenChange={(open) => {
            setQrModal((m) => ({ ...m, open }));
            if (!open) setEditingQrUrl(false);
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-indigo-600" />
                Scan to Upload from Mobile
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-2">
              {qrModal.url ? (
                <>
                  <div className="p-3 bg-white rounded-xl border shadow-sm">
                    <QRCodeCanvas
                      value={qrModal.url}
                      size={220}
                      level="M"
                      includeMargin
                    />
                  </div>
                  <div className="text-center space-y-1 w-full">
                    <p className="text-sm text-gray-700 font-medium">
                      Scan this QR code with your phone
                    </p>
                    <p className="text-xs text-gray-500">
                      Take a photo or upload a file. It will automatically
                      appear here.
                    </p>
                    <p className="text-xs text-amber-600 mt-2">
                      ⏱ Session expires in 10 minutes
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-1">
                      {process.env.NEXT_PUBLIC_QR_BASE_URL}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setQrModal((m) => ({ ...m, open: false }))}
                  >
                    Close (session stays active)
                  </Button>
                </>
              ) : (
                <p className="text-sm text-gray-500">Generating session…</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
        {/* Completion Receipt Dialog */}
        <Dialog open={!!completionReceipt} onOpenChange={() => setCompletionReceipt(null)}>
          <DialogContent className="max-w-xl max-h-[95vh] overflow-y-auto print:max-w-none print:shadow-none print:border-none">
            <DialogHeader className="print:hidden">
              <DialogTitle className="text-teal-700 font-bold">Transfer Complete Receipt</DialogTitle>
            </DialogHeader>

            <div className="p-4 space-y-6 print:p-0">
              {/* Header */}
              <div className="text-center border-b pb-4">
                <p className="text-xs font-semibold text-teal-700 tracking-widest uppercase">Darul Khair Jamia Uloom</p>
                <h2 className="text-xl font-bold text-gray-900 mt-1">Student Transfer Certificate (TC) Receipt</h2>
                <p className="text-xs text-gray-400 mt-0.5">Transfer Confirmation and Flow Details</p>
              </div>

              {/* Success Banner */}
              <div className="flex flex-col items-center gap-2 py-2 text-center bg-teal-50 border border-teal-100 rounded-lg p-3 print:bg-white print:border-none">
                <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center print:hidden">
                  <CheckCircle className="w-6 h-6 text-teal-600" />
                </div>
                <p className="text-base font-semibold text-teal-800">Transfer Completed Successfully!</p>
                <p className="text-xs text-gray-500">The student has been successfully moved to the destination madarsa database.</p>
              </div>

              {/* Receipt Body */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 bg-gray-50 rounded-lg p-4 text-sm print:bg-white print:border print:p-4">
                {[
                  ["Student Name", completionReceipt?.requesterName],
                  ["Class", completionReceipt?.requesterClass || "—"],
                  ["Transfer Mode", (completionReceipt?.transferMode || "online").toUpperCase()],
                  ["From Madrasa", completionReceipt?.sourceMadarsaName],
                  ["To Madrasa", completionReceipt?.destinationMadarsaName],
                  ["Reason", completionReceipt?.reason],
                  ["Completed At", completionReceipt?.completedAt],
                  ["Completed By", completionReceipt?.completedBy],
                ].map(([k, v]) => v ? (
                  <div key={k} className="border-b border-gray-100 pb-1">
                    <p className="text-xs text-gray-500 font-medium">{k}</p>
                    <p className="font-semibold text-gray-900 mt-0.5">{v}</p>
                  </div>
                ) : null)}
              </div>

              {/* Status Flow Message Box */}
              <div className="border rounded-lg p-4 bg-white space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1.5">
                  Flow Approval History & Message Box
                </h3>
                <div className="space-y-3">
                  {(completionReceipt?.statusHistory || []).map((h, i) => (
                    <div key={i} className="text-xs border-l-2 border-teal-500 pl-3 py-0.5">
                      <p className="font-semibold text-gray-800 capitalize font-medium">
                        {h.status?.replace(/_/g, " ")}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        By: {h.byName} ({h.byRole}) · {h.timestamp ? new Date(h.timestamp).toLocaleString("en-IN") : "—"}
                      </p>
                      {h.note && (
                        <p className="text-gray-600 mt-1 italic bg-slate-50 p-1.5 rounded border border-slate-100">
                          &ldquo;{h.note}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t mt-4 print:hidden">
              <Button variant="outline" onClick={() => window.print()} className="gap-2">
                <Printer className="w-4 h-4" /> Print / Save PDF
              </Button>
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setCompletionReceipt(null)}>
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  );
}
