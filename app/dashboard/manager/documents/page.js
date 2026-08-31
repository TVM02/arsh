"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  Upload,
  CheckCircle,
  Trash2,
  FileText,
  Send,
  Clock,
  QrCode,
  X,
  Eye,
} from "lucide-react";
import useAuthStore from "@/lib/authStore";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadInspectionFilesToStorage } from "@/lib/inspectionUpload";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";

// ── Template docs are now managed by Central Admin ──────────────────────────
// (fetched dynamically from managerReportDocuments collection)

const STEPS = [
  { id: 1, label: "Download Template", Icon: Download },
  { id: 2, label: "Upload Document", Icon: Upload },
];

const formatDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function ManagerDocumentsPage() {
  const { userData } = useAuthStore();
  const [uploads, setUploads] = useState([]); // history
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Admin-uploaded template documents
  const [adminDocs, setAdminDocs] = useState([]);
  const [loadingAdminDocs, setLoadingAdminDocs] = useState(true);

  // Step wizard
  const [currentStep, setCurrentStep] = useState(1);

  // Upload form state
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [previewFile, setPreviewFile] = useState(null); // { name, url, isPdf, isObjectUrl }

  // QR upload states
  const [qrModal, setQrModal] = useState({
    open: false,
    url: "",
    sessionId: "",
  });
  const [mobileSession, setMobileSession] = useState(null); // { sessionId }
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

  const fileRef = useRef(null);
  const unsubRef = useRef(null);

  const madarsaId = userData?.madarsaId;
  const madarsaName = userData?.madarsaName;

  // ── Fetch submission history ──────────────────────────────────────────────
  const fetchHistory = async () => {
    if (!madarsaId) return;
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "manager_documents"),
        where("madarsaId", "==", madarsaId),
      );
      const snap = await getDocs(q);
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.submittedAt?.toDate
            ? a.submittedAt.toDate().getTime()
            : 0;
          const tb = b.submittedAt?.toDate
            ? b.submittedAt.toDate().getTime()
            : 0;
          return tb - ta;
        });
      setUploads(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [madarsaId]);

  // ── Fetch admin template documents ──────────────────────────────────────
  const fetchAdminDocs = async () => {
    setLoadingAdminDocs(true);
    try {
      const q = query(
        collection(db, "managerReportDocuments"),
        orderBy("uploadedAt", "desc"),
      );
      const snap = await getDocs(q);
      setAdminDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAdminDocs(false);
    }
  };

  useEffect(() => {
    fetchAdminDocs();
  }, []);

  // ── Mobile session listener ──────────────────────────────────────────────
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
          setFiles((prev) => {
            const existingNames = new Set(prev.map((f) => f._name || f.name));
            const newOnes = pending.filter((p) => !existingNames.has(p.name));
            if (newOnes.length === 0) return prev;
            const mapped = newOnes.map((p) => ({
              _fromMobile: true,
              _name: p.name,
              _url: p.url,
              name: p.name,
              size: 0,
            }));
            toast.success(`${newOnes.length} file(s) received from mobile`);
            setQrModal((m) => (m.open ? { ...m, open: false } : m));
            return [...prev, ...mapped];
          });
        }
      },
    );

    unsubRef.current = unsub;
    return () => unsub();
  }, [mobileSession]);

  // ── Handle file selection ────────────────────────────────────────────────
  const handleFilesChange = (newFiles) => {
    const arr = Array.from(newFiles || []);
    const valid = arr.filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name} exceeds 10 MB limit.`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveQrUrl = (url) => {
    const clean = String(url || "")
      .trim()
      .replace(/\/+$/, "");
    setDevQrUrl(clean);
    if (typeof window !== "undefined")
      localStorage.setItem("devQrBaseUrl", clean);
    setEditingQrUrl(false);
    toast.success("ngrok URL saved!");
    return clean;
  };

  // ── QR Upload ─────────────────────────────────────────────────────────────
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
        step: "manager-docs",
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

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error("Please attach at least one file.");
      return;
    }
    setUploading(true);
    try {
      const localFiles = files.filter((f) => !f._fromMobile);
      const mobileFiles = files.filter((f) => f._fromMobile);

      let uploadedFiles = mobileFiles.map((f) => ({
        name: f._name,
        url: f._url,
      }));

      if (localFiles.length > 0) {
        const { uploadedFiles: uploaded, errors } =
          await uploadInspectionFilesToStorage(localFiles, "manager-docs");
        errors.forEach((e) => toast.error(e));
        uploadedFiles = [...uploadedFiles, ...uploaded];
      }

      if (uploadedFiles.length === 0) {
        toast.error("No files were uploaded. Please try again.");
        return;
      }

      const now = new Date().toISOString();
      await addDoc(collection(db, "manager_documents"), {
        madarsaId,
        madarsaName: madarsaName || "",
        managerId: userData?.id || userData?.uid || "",
        managerName: userData?.name || userData?.fullName || "",
        managerEmail: userData?.email || "",
        files: uploadedFiles,
        message: message.trim(),
        submittedAt: serverTimestamp(),
        submittedAtISO: now,
        status: "submitted",
      });

      toast.success(
        "Document uploaded successfully. It has been sent to the Inspector Portal and Central Admin.",
      );
      setFiles([]);
      setMessage("");
      setSubmitted(true);
      setMobileSession(null);
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
      fetchHistory();
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["manager"]}>
      <Layout>
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
            <p className="text-sm text-gray-500 mt-1">
              Follow the steps below to submit your documents.
            </p>
          </div>

          {/* Step Progress Indicator */}
          <div className="flex items-center gap-2">
            {STEPS.map((step, i) => {
              const Icon = step.Icon;
              const isActive = currentStep === step.id;
              const isDone = currentStep > step.id;
              return (
                <div key={step.id} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                      ${isActive ? "bg-teal-600 text-white" : isDone ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
                  >
                    {isDone ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{step.label}</span>
                    <span className="sm:hidden">{step.id}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 w-8 ${currentStep > step.id ? "bg-teal-400" : "bg-gray-200"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Step 1 : Download template ──────────────────────────────── */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Download className="h-5 w-5 text-teal-600" />
                  Step 1 — Download Form Template
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Download the official DKJU document template, fill it offline,
                  then proceed to Step 2 to upload the completed form.
                </p>
                {loadingAdminDocs ? (
                  <p className="text-sm text-gray-400">Loading documents…</p>
                ) : adminDocs.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      No document templates available yet. The Central Admin
                      will upload them here. Please check back later.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {adminDocs.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={doc.originalName}
                      >
                        <Button className="gap-2 bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-auto">
                          <Download className="h-4 w-4" />
                          Download {doc.name}
                        </Button>
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => setCurrentStep(2)}
                    className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
                  >
                    Next — Upload Document
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step 2 : Upload completed form ────────────────────────── */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Upload className="h-5 w-5 text-teal-600" />
                  Step 2 — Upload Completed Document
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {submitted && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Your document was submitted successfully. The Inspector
                      Portal and Central Admin have been notified.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Upload buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 border-teal-300 text-teal-700 hover:bg-teal-50"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    <FileText className="h-4 w-4" />
                    Upload File
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                    onClick={openQrUpload}
                    disabled={uploading}
                  >
                    <QrCode className="h-4 w-4" />
                    Scan QR (Mobile Upload)
                  </Button>
                </div>

                {/* Mobile session active indicator */}
                {mobileSession && !qrModal.open && (
                  <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    Waiting for mobile upload… (session active)
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
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFilesChange(e.target.files)}
                />

                {/* Selected files preview */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      Selected files ({files.length}):
                    </p>
                    {files.map((f, idx) => {
                      const fileName = f._fromMobile ? f._name : f.name;
                      const isPdf = /\.pdf$/i.test(fileName);
                      const handlePreview = () => {
                        let url;
                        if (f._fromMobile) {
                          url = f._url;
                        } else {
                          url = URL.createObjectURL(f);
                        }
                        setPreviewFile({
                          name: fileName,
                          url,
                          isPdf,
                          isObjectUrl: !f._fromMobile,
                        });
                      };
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-gray-50 rounded-lg p-2 border text-sm"
                        >
                          <div className="flex items-center gap-2 truncate mr-2">
                            {f._fromMobile && (
                              <Badge className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0 shrink-0">
                                Mobile
                              </Badge>
                            )}
                            <span className="truncate text-gray-700">
                              {fileName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={handlePreview}
                              className="text-indigo-400 hover:text-indigo-600"
                              title="Preview"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFile(idx)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Message box */}
                <div className="space-y-2">
                  <Label htmlFor="msg">
                    Remarks / Message{" "}
                    <span className="text-gray-400 font-normal text-xs">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    id="msg"
                    rows={3}
                    placeholder="Add any notes or remarks about this submission…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={uploading}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    disabled={uploading}
                  >
                    ← Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={uploading || files.length === 0}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {uploading ? "Uploading…" : "Submit Document"}
                  </Button>
                </div>

                <p className="text-xs text-gray-400 text-center">
                  Accepts JPG, PNG, PDF — max 10 MB per file.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Submission History ─────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5 text-gray-500" />
                Submission History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingHistory ? (
                <p className="text-center text-gray-400 py-8 text-sm">
                  Loading history…
                </p>
              ) : uploads.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">
                  No submissions yet.
                </p>
              ) : (
                <div className="divide-y">
                  {uploads.map((u) => (
                    <div key={u.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {u.managerName}
                          </p>
                          <p className="text-xs text-gray-400">
                            <Clock className="inline h-3 w-3 mr-1" />
                            {formatDate(u.submittedAt)}
                          </p>
                        </div>
                        <Badge className="bg-green-100 text-green-700 shrink-0">
                          Submitted
                        </Badge>
                      </div>
                      {u.message && (
                        <p className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                          {u.message}
                        </p>
                      )}
                      {u.files && u.files.length > 0 && (
                        <div className="space-y-1">
                          {u.files.map((f, fi) => (
                            <a
                              key={fi}
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 text-xs text-teal-600 hover:underline"
                            >
                              <Download className="h-3 w-3" />
                              {f.name || `File ${fi + 1}`}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
                      Take a photo or upload files from mobile. Files appear
                      here automatically.
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

        {/* File Preview Modal */}
        <Dialog
          open={!!previewFile}
          onOpenChange={(open) => {
            if (!open) {
              if (previewFile?.isObjectUrl)
                URL.revokeObjectURL(previewFile.url);
              setPreviewFile(null);
            }
          }}
        >
          <DialogContent className="max-w-3xl w-full">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-medium truncate">
                <Eye className="h-4 w-4 text-indigo-600 shrink-0" />
                <span className="truncate">{previewFile?.name}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-2 max-h-[75vh] overflow-auto">
              {previewFile?.isPdf ? (
                <iframe
                  src={previewFile.url}
                  title={previewFile.name}
                  className="w-full rounded border"
                  style={{ height: "65vh" }}
                />
              ) : (
                <Image
                  src={previewFile?.url}
                  alt={previewFile?.name || "preview"}
                  unoptimized
                  width={0}
                  height={0}
                  sizes="100vw"
                  className="max-w-full rounded-lg border shadow object-contain"
                  style={{ width: "100%", height: "auto", maxHeight: "65vh" }}
                />
              )}
              <a
                href={previewFile?.url}
                download={previewFile?.name}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline"
              >
                Open / Download
              </a>
            </div>
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  );
}
