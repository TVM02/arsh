"use client";

import { useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  Trash2,
  FileText,
  Download,
  Eye,
  Plus,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import { toast } from "sonner";

const COLLECTION = "managerReportDocuments";

function ManagerReportAdminPage() {
  const { userData } = useAuthStore();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docName, setDocName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, COLLECTION),
        orderBy("uploadedAt", "desc"),
      );
      const snap = await getDocs(q);
      setDocuments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a file.");
      return;
    }
    if (!docName.trim()) {
      toast.error("Please enter a document name.");
      return;
    }
    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.type.startsWith("image/")
    ) {
      toast.error("Only PDF and image files are supported.");
      return;
    }
    if (selectedFile.size > 20 * 1024 * 1024) {
      toast.error("File size must be less than 20MB.");
      return;
    }

    setUploading(true);
    try {
      const timestamp = Date.now();
      const ext = selectedFile.name.split(".").pop();
      const filename = `manager-reports/${timestamp}-${selectedFile.name}`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, selectedFile, {
        contentType: selectedFile.type,
        contentDisposition: `attachment; filename="${selectedFile.name}"`,
      });
      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, COLLECTION), {
        name: docName.trim(),
        originalName: selectedFile.name,
        url: downloadURL,
        storagePath: filename,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        uploadedBy: userData?.email || "",
        uploadedByName: userData?.fullName || userData?.name || "",
        uploadedAt: serverTimestamp(),
      });

      toast.success("Document uploaded successfully!");
      setDocName("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchDocuments();
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (document) => {
    setDeleting(true);
    try {
      // Delete from Firebase Storage
      if (document.storagePath) {
        try {
          const storageRef = ref(storage, document.storagePath);
          await deleteObject(storageRef);
        } catch (storageErr) {
          console.warn("Storage file not found, skipping:", storageErr);
        }
      }
      // Delete from Firestore
      await deleteDoc(doc(db, COLLECTION, document.id));
      toast.success("Document deleted successfully.");
      setDeleteConfirm(null);
      fetchDocuments();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete document.");
    } finally {
      setDeleting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <ProtectedRoute allowedRoles={["central_admin"]}>
      <Layout>
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Manager Report Documents
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Upload documents to be displayed in the Manager Portal. Managers
              can download these files.
            </p>
          </div>

          {/* Upload Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Upload className="h-5 w-5 text-teal-600" />
                Upload New Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="doc-name">Document Name *</Label>
                  <Input
                    id="doc-name"
                    placeholder="e.g. College Application Form 2024-25"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-file">File (PDF or Image) *</Label>
                  <Input
                    id="doc-file"
                    type="file"
                    accept=".pdf,image/*"
                    ref={fileInputRef}
                    onChange={(e) =>
                      setSelectedFile(e.target.files?.[0] || null)
                    }
                    required
                  />
                  <p className="text-xs text-gray-500">
                    PDF or image files, max 20 MB
                  </p>
                  {selectedFile && (
                    <div className="flex items-center gap-2 text-sm text-teal-700 bg-teal-50 rounded px-3 py-2">
                      <FileText className="h-4 w-4" />
                      {selectedFile.name} — {formatFileSize(selectedFile.size)}
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={uploading}
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
                >
                  {uploading ? (
                    <>
                      <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload Document
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Documents List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-teal-600" />
                Uploaded Documents ({documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-gray-400 py-8 text-center">
                  Loading…
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No documents uploaded yet.</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Upload a document above to make it visible in the Manager
                    Portal.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-teal-50 rounded-lg shrink-0">
                          <FileText className="h-5 w-5 text-teal-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {doc.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {doc.originalName} · {formatFileSize(doc.fileSize)}{" "}
                            · Uploaded {formatDate(doc.uploadedAt)}
                          </p>
                          {doc.uploadedByName && (
                            <p className="text-xs text-gray-400">
                              by {doc.uploadedByName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-teal-300 text-teal-600 rounded hover:bg-teal-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </a>
                        <a
                          href={doc.url}
                          download={doc.originalName}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                          onClick={() => setDeleteConfirm(doc)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Delete Confirm Dialog */}
        <Dialog
          open={!!deleteConfirm}
          onOpenChange={() => setDeleteConfirm(null)}
        >
          <DialogContent className="bg-white sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Delete Document
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete{" "}
                <strong>{deleteConfirm?.name}</strong>? This will also remove it
                from the Manager Portal immediately.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  );
}

export default ManagerReportAdminPage;
