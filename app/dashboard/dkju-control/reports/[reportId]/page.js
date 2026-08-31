"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  ArrowLeft,
  FileText,
  Eye,
  Calendar,
  Building,
  User,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  UserCheck,
  Users,
  X,
  Check,
  History,
  MapPin,
  Edit,
} from "lucide-react";
import useAuthStore from "@/lib/authStore";
import { INVENTORY_ITEMS } from "@/lib/inspectionConstants";

const CLASS_LIST = [
  "LKG",
  "Ukg",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { toast } from "sonner";

export default function AdminReportViewPage() {
  const params = useParams();
  const router = useRouter();
  const { user, userData } = useAuthStore();
  const [report, setReport] = useState(null);
  const [inspector, setInspector] = useState(null);
  const [madarsa, setMadarsa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewModal, setPreviewModal] = useState({ open: false, file: null });
  const [actionModal, setActionModal] = useState({ open: false, action: "" });
  const [actionRemarks, setActionRemarks] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const reportId = params.reportId;

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);

        const reportDoc = await getDoc(doc(db, "inspections", reportId));

        if (!reportDoc.exists()) {
          router.push("/dashboard/dkju-control/reports");
          return;
        }

        const reportData = {
          id: reportDoc.id,
          ...reportDoc.data(),
        };
        setReport(reportData);

        // Fetch inspector details
        if (reportData.inspectorId) {
          const inspectorDoc = await getDoc(
            doc(db, "users", reportData.inspectorId),
          );
          if (inspectorDoc.exists()) {
            setInspector(inspectorDoc.data());
          }
        }

        // Fetch madarsa details
        if (reportData.selectedMadarsaId || reportData.madarsaId) {
          const mId = reportData.selectedMadarsaId || reportData.madarsaId;
          const madarsaQuery = query(
            collection(db, "madarsas"),
            where("madarsaId", "==", mId),
          );
          const madarsaSnapshot = await getDocs(madarsaQuery);
          if (!madarsaSnapshot.empty) {
            setMadarsa(madarsaSnapshot.docs[0].data());
          } else {
            const mDoc = await getDoc(doc(db, "madarsas", mId));
            if (mDoc.exists()) {
              setMadarsa(mDoc.data());
            }
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching report:", error);
        router.push("/dashboard/dkju-control/reports");
      }
    };

    if (user && userData?.role === "central_admin" && reportId) {
      fetchReportData();
    }
  }, [user, userData, reportId, router]);

  const getStatusColor = (status) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "submitted":
        return "bg-green-100 text-green-800";
      case "reviewed":
        return "bg-purple-100 text-purple-800";
      case "approved":
        return "bg-emerald-100 text-emerald-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "draft":
        return <FileText className="h-4 w-4" />;
      case "in_progress":
        return <Clock className="h-4 w-4" />;
      case "submitted":
        return <CheckCircle className="h-4 w-4" />;
      case "reviewed":
        return <Eye className="h-4 w-4" />;
      case "approved":
        return <CheckCircle className="h-4 w-4" />;
      case "rejected":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatDate = (val) => {
    if (!val) return "N/A";
    if (typeof val.toDate === "function") return val.toDate().toLocaleDateString();
    if (val.seconds) return new Date(val.seconds * 1000).toLocaleDateString();
    return new Date(val).toLocaleDateString();
  };

  const handleAction = (action) => {
    setActionModal({ open: true, action });
    setActionRemarks("");
  };

  const submitAction = async () => {
    if (!actionModal.action) return;

    if (
      (actionModal.action === "rejected" ||
        actionModal.action === "approved") &&
      !actionRemarks.trim()
    ) {
      toast.error("Please provide remarks for this action");
      return;
    }

    try {
      setActionLoading(true);

      const updateData = {
        status: actionModal.action,
        reviewedAt: serverTimestamp(),
        reviewedBy: userData?.name || user.displayName,
        adminRemarks: actionRemarks.trim(),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "inspections", reportId), updateData);

      // Update local state
      setReport((prev) => ({ ...prev, ...updateData }));

      toast.success(`Report ${actionModal.action} successfully`);
      setActionModal({ open: false, action: "" });
      setActionRemarks("");
    } catch (error) {
      console.error("Error updating report:", error);
      toast.error("Failed to update report");
    } finally {
      setActionLoading(false);
    }
  };

  const previewFile = (file) => {
    setPreviewModal({ open: true, file });
  };

  const getFileType = (file) => file?.type || file?.contentType || "";
  const getFileUrl = (file) => file?.url || file?.downloadURL || "";
  const isImageFile = (file) => {
    const type = getFileType(file);
    if (type.startsWith("image/")) return true;
    const src = file?.name || getFileUrl(file) || "";
    return /\.(png|jpe?g|webp|gif)(\?|$|#)/i.test(src) || /\.(png|jpe?g|webp|gif)$/i.test(src.split("?")[0]);
  };
  const isPdfFile = (file) => {
    const type = getFileType(file);
    if (type === "application/pdf") return true;
    const src = file?.name || getFileUrl(file) || "";
    return /\.pdf(\?|$|#)/i.test(src) || /\.pdf$/i.test(src.split("?")[0]);
  };

  const downloadFile = (file) => {
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderFileSection = (filesRaw) => {
    const files = Array.isArray(filesRaw)
      ? filesRaw
      : filesRaw && typeof filesRaw === "object"
        ? Object.values(filesRaw)
        : [];

    if (!files || files.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No files uploaded</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-8">
        {files.map((file, index) => {
          const fileUrl = file.url || file.downloadURL || "";
          const fileName = file.name || `Attachment ${index + 1}`;
          const isImage = isImageFile(file);
          const isPdf = isPdfFile(file);

          return (
            <div key={index} className="flex flex-col gap-0 rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
              {/* File header */}
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-sm font-semibold text-gray-700 truncate">{fileName}</span>
                <span className="ml-auto text-xs text-gray-400 shrink-0">#{index + 1}</span>
              </div>

              {/* Image preview */}
              {isImage && fileUrl && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fileUrl}
                    alt={fileName}
                    className="w-full h-auto object-contain bg-gray-100 max-h-[600px]"
                    loading="lazy"
                  />
                  <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4 bg-white">
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <Eye className="h-4 w-4" />
                      View full size
                    </a>
                    <span className="text-gray-200">|</span>
                    <a
                      href={fileUrl}
                      download={fileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-800 hover:underline"
                    >
                      <Download className="h-4 w-4" />
                      Download image
                    </a>
                  </div>
                </>
              )}

              {/* PDF embedded view */}
              {isPdf && fileUrl && (
                <>
                  <div className="w-full h-[640px] bg-gray-100">
                    <iframe
                      src={fileUrl}
                      className="w-full h-full"
                      title={fileName}
                    />
                  </div>
                  <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4 bg-white">
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <Eye className="h-4 w-4" />
                      Open PDF in new tab
                    </a>
                    <span className="text-gray-200">|</span>
                    <a
                      href={fileUrl}
                      download={fileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-800 hover:underline"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </a>
                  </div>
                </>
              )}

              {/* Other file types */}
              {!isImage && !isPdf && (
                <div className="px-4 py-8 flex flex-col items-center gap-3">
                  <FileText className="h-10 w-10 text-gray-300" />
                  <span className="text-sm text-gray-500">{fileName}</span>
                  {fileUrl && (
                    <div className="flex items-center gap-4">
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <Eye className="h-4 w-4" />
                        Open file
                      </a>
                      <span className="text-gray-200">|</span>
                      <a
                        href={fileUrl}
                        download={fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-800 hover:underline"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading report...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!report) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-8">
            <p className="text-gray-500">Report not found</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/dkju-control/reports">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Reports
              </Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col  gap-4">
          <Button variant="outline" className="w-32" size="sm" asChild>
            <Link href="/dashboard/dkju-control/reports">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">
              {report.title || "Inspection Report"}
            </h1>
            <p className="text-gray-600 mt-1 font-mono">
              Report ID: {
                report.reportId || 
                `INS-${report.selectedMadarsaId || report.madarsaId || "UNKNOWN"}-${String(inspector?.phone || inspector?.phoneNumber || "000").replace(/\\D/g, "").slice(-3).padStart(3, "0")}`.toUpperCase()
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(report.status)}>
              {getStatusIcon(report.status)}
              <span className="ml-1 capitalize">
                {String(report.status || "draft").replace("_", " ")}
              </span>
            </Badge>

            {/* Action Buttons */}
            {(report.status === "submitted" ||
              report.status === "reviewed") && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleAction("approved")}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleAction("rejected")}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("reviewed")}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Mark Reviewed
                </Button>
              </div>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <Label className="text-sm text-gray-500">Madarsa</Label>
                <p className="font-medium">
                  {madarsa?.name || report.madarsaName}
                </p>
                <p className="text-sm text-gray-600">
                  {report.selectedMadarsaId}
                </p>
                {madarsa?.location && typeof madarsa.location === 'string' && (
                  <p className="text-sm text-gray-500">{madarsa.location}</p>
                )}
              </div>
              <div>
                <Label className="text-sm text-gray-500">Madrasa Address</Label>
                <p className="font-medium">{madarsa?.address || madarsa?.madarsaAddress || "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">District</Label>
                <p className="font-medium">{madarsa?.mekhala || madarsa?.mekhalaName || "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Mekhala Name</Label>
                <p className="font-medium">{madarsa?.district || "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Inspector</Label>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="font-medium">
                      {inspector?.name || report.inspectorName}
                    </p>
                    {inspector?.email && (
                      <p className="text-sm text-gray-600">{inspector.email}</p>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Inspection Date</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <p className="font-medium">
                    {report.inspectionDate
                      ? new Date(report.inspectionDate).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Type</Label>
                <p className="font-medium capitalize">
                  {String(report.inspectionType || "routine").replace("_", " ")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t">
              <div>
                <Label className="text-sm text-gray-500">Created</Label>
                <p className="font-medium">
                  {formatDate(report.createdAt)}
                </p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Last Updated</Label>
                <p className="font-medium">
                  {formatDate(report.updatedAt)}
                </p>
              </div>
              {report.submittedAt && (
                <div>
                  <Label className="text-sm text-gray-500">Submitted</Label>
                  <p className="font-medium">
                    {formatDate(report.submittedAt)}
                  </p>
                </div>
              )}
              {report.location && (
                <div>
                  <Label className="text-sm text-gray-500">Location Recorded</Label>
                  <a 
                    href={`https://maps.google.com/?q=${report.location.lat},${report.location.lng}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <MapPin className="h-3 w-3" />
                    {Number(report.location.lat || 0).toFixed(6)}, {Number(report.location.lng || 0).toFixed(6)}
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {report.inspectorSelfieUrl && (
          <div className="mt-6 pt-6 border-t">
            <Label className="text-sm text-gray-500 mb-3 block">
              Inspector Verification
            </Label>
            <div className="flex items-center gap-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
              <div className="w-16 h-16 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={report.inspectorSelfieUrl}
                  alt="Inspector Verification Selfie"
                  className="w-full h-full object-cover rounded-lg border-2 border-teal-300"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-teal-600" />
                  <p className="font-medium text-teal-800">
                    Inspector Identity Verified
                  </p>
                </div>
                <p className="text-sm text-teal-600 mt-1">
                  Selfie captured during inspection submission
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(report.inspectorSelfieUrl, "_blank")}
                className="text-teal-600 border-teal-300 hover:bg-teal-50"
              >
                <Eye className="h-4 w-4 mr-1" />
                View Full
              </Button>
            </div>
          </div>
        )}

        {/* Student Class Summary */}
        {report.classTableData &&
          Object.keys(report.classTableData).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Student Class Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left py-2 px-3 border border-gray-200 font-semibold">
                          Class
                        </th>
                        <th className="text-center py-2 px-3 border border-gray-200 font-semibold">
                          Boys
                        </th>
                        <th className="text-center py-2 px-3 border border-gray-200 font-semibold">
                          Girls
                        </th>
                        <th className="text-center py-2 px-3 border border-gray-200 font-semibold">
                          Others
                        </th>
                        <th className="text-center py-2 px-3 border border-gray-200 font-semibold">
                          Total
                        </th>
                        <th className="text-center py-2 px-3 border border-gray-200 font-semibold">
                          Male Count
                        </th>
                        <th className="text-center py-2 px-3 border border-gray-200 font-semibold">
                          Female Count
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {CLASS_LIST.map((cls) => {
                        const row = report.classTableData?.[cls];
                        if (!row) return null;
                        const boys = Number(row.boys) || 0;
                        const girls = Number(row.girls) || 0;
                        return (
                          <tr key={cls} className="hover:bg-gray-50">
                            <td className="py-2 px-3 border border-gray-200 font-medium">
                              {cls}
                            </td>
                            <td className="py-2 px-3 border border-gray-200 text-center">
                              {boys}
                            </td>
                            <td className="py-2 px-3 border border-gray-200 text-center">
                              {girls}
                            </td>
                            <td className="py-2 px-3 border border-gray-200 text-center text-amber-600">
                              {row.others ? Number(row.others) : "-"}
                            </td>
                            <td className="py-2 px-3 border border-gray-200 text-center font-semibold">
                              {boys + girls + Number(row.others || 0)}
                            </td>
                            <td className="py-2 px-3 border border-gray-200 text-center">
                              {row.enteredMale !== undefined && row.enteredMale !== "" ? row.enteredMale : "-"}
                            </td>
                            <td className="py-2 px-3 border border-gray-200 text-center">
                              {row.enteredFemale !== undefined && row.enteredFemale !== "" ? row.enteredFemale : "-"}
                            </td>
                          </tr>
                        );
                      })}
                      {report.classTableData?.["_other"] &&
                        (() => {
                          const row = report.classTableData["_other"];
                          const boys = Number(row.boys) || 0;
                          const girls = Number(row.girls) || 0;
                          return (
                            <tr className="hover:bg-gray-50 bg-yellow-50">
                              <td className="py-2 px-3 border border-gray-200 font-medium">
                                Other
                              </td>
                              <td className="py-2 px-3 border border-gray-200 text-center">
                                {boys}
                              </td>
                              <td className="py-2 px-3 border border-gray-200 text-center">
                                {girls}
                              </td>
                              <td className="py-2 px-3 border border-gray-200 text-center text-amber-600">
                                {row.others ? Number(row.others) : "-"}
                              </td>
                              <td className="py-2 px-3 border border-gray-200 text-center font-semibold">
                                {boys + girls + Number(row.others || 0)}
                              </td>
                              <td className="py-2 px-3 border border-gray-200 text-center">
                                {row.enteredMale !== undefined && row.enteredMale !== "" ? row.enteredMale : "-"}
                              </td>
                              <td className="py-2 px-3 border border-gray-200 text-center">
                                {row.enteredFemale !== undefined && row.enteredFemale !== "" ? row.enteredFemale : "-"}
                              </td>
                            </tr>
                          );
                        })()}
                      {/* Total row */}
                      {(() => {
                        let totalBoys = 0;
                        let totalGirls = 0;
                        let totalOthers = 0;
                        let totalEnteredMale = 0;
                        let totalEnteredFemale = 0;

                        Object.keys(report.classTableData || {}).forEach((k) => {
                          const r = report.classTableData[k] || {};
                          totalBoys += Number(r.boys || 0);
                          totalGirls += Number(r.girls || 0);
                          totalOthers += Number(r.others || 0);
                          totalEnteredMale += Number(r.enteredMale || 0);
                          totalEnteredFemale += Number(r.enteredFemale || 0);
                        });

                        return (
                          <tr className="bg-gray-50 font-bold">
                            <td className="py-2 px-3 border border-gray-200 font-bold">
                              Total
                            </td>
                            <td className="py-2 px-3 border border-gray-200 text-center font-bold">
                              {totalBoys}
                            </td>
                            <td className="py-2 px-3 border border-gray-200 text-center font-bold">
                              {totalGirls}
                            </td>
                            <td className="py-2 px-3 border border-gray-200 text-center font-bold text-amber-600">
                              {totalOthers > 0 ? totalOthers : "-"}
                            </td>
                            <td className="py-2 px-3 border border-gray-200 text-center font-bold">
                              {totalBoys + totalGirls + totalOthers}
                            </td>
                            <td className="py-2 px-3 border border-gray-200 text-center font-bold text-blue-600">
                              {totalEnteredMale}
                            </td>
                            <td className="py-2 px-3 border border-gray-200 text-center font-bold text-blue-600">
                              {totalEnteredFemale}
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

        {/* Inventory */}
        {(report.inventoryRegistry || report.customInventoryFields) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Inventory Registry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {[
                  ...INVENTORY_ITEMS,
                  ...(Array.isArray(report.customInventoryFields)
                    ? report.customInventoryFields
                    : []),
                ].map((item) => {
                  const val = report.inventoryRegistry?.[item.key];
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between py-1 border-b border-gray-100"
                    >
                      <span className="text-sm text-gray-600">
                        {item.label}
                      </span>
                      <span className="font-medium text-sm">
                        {val !== undefined && val !== "" ? val : "-"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {[
          {
            step: "madarsa",
            title: "Madarsa Form",
            icon: Building,
            files: report.madarsaFormFiles || report.inspectionData?.step2?.attachments,
            remarks: report.madarsaFormRemarks || report.inspectionData?.step2?.remarks,
          },
          {
            step: "management",
            title: "Management Form",
            icon: UserCheck,
            files: report.managementFormFiles || report.inspectionData?.step3?.attachments,
            remarks: report.managementFormRemarks || report.inspectionData?.step3?.remarks,
          },
          {
            step: "sadar",
            title: "Sadar Info Form",
            icon: Users,
            files: report.sadarFormFiles || report.inspectionData?.step4?.attachments,
            remarks: report.sadarFormRemarks || report.inspectionData?.step4?.remarks,
          },
        ].map(({ step, title, icon: Icon, files, remarks }) => (
          <Card key={step}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5" />
                {title}
              </CardTitle>
              <CardDescription>
                Documents and observations for {title.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Files Section */}
              <div>
                <Label className="text-base font-semibold mb-4 block">
                  Uploaded Documents ({files?.length || 0})
                </Label>
                {renderFileSection(files)}
              </div>

              {/* Remarks Section */}
              <div>
                <Label className="text-base font-semibold mb-2 block">
                  Inspector Remarks & Observations
                </Label>
                {remarks ? (
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {remarks}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500 border border-dashed rounded-lg">
                    No remarks added for this section
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Administrative Actions History */}
        {(report.adminRemarks || report.reviewedAt) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Administrative Review History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.reviewedAt && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-500">Reviewed On</Label>
                    <p className="font-medium">
                      {formatDate(report.reviewedAt)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Reviewed By</Label>
                    <p className="font-medium">{report.reviewedBy || "N/A"}</p>
                  </div>
                </div>
              )}

              {report.adminRemarks && (
                <div>
                  <Label className="text-sm text-gray-500">Admin Remarks</Label>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mt-2">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {report.adminRemarks}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Modal */}
        <Dialog
          open={actionModal.open}
          onOpenChange={(open) => setActionModal({ open, action: "" })}
        >
          <DialogContent className="sm:max-w-[500px] bg-white">
            <DialogHeader>
              <DialogTitle>
                {actionModal.action === "approved" && "Approve Report"}
                {actionModal.action === "rejected" && "Reject Report"}
                {actionModal.action === "reviewed" && "Mark as Reviewed"}
              </DialogTitle>
              <DialogDescription>
                Report:{" "}
                {report.title ||
                  `Inspection Report - ${report.selectedMadarsaId}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="actionRemarks">
                  {actionModal.action === "rejected"
                    ? "Rejection Reason *"
                    : "Remarks"}
                </Label>
                <Textarea
                  id="actionRemarks"
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                  placeholder={
                    actionModal.action === "approved"
                      ? "Add any approval comments (optional)"
                      : actionModal.action === "rejected"
                        ? "Please provide reason for rejection"
                        : "Add review comments"
                  }
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setActionModal({ open: false, action: "" })}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitAction}
                  disabled={actionLoading}
                  variant={
                    actionModal.action === "rejected"
                      ? "destructive"
                      : "default"
                  }
                >
                  {actionLoading ? "Processing..." : "Confirm"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* File Preview Modal */}
        <Dialog
          open={previewModal.open}
          onOpenChange={(open) => setPreviewModal({ open, file: null })}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle>File Preview</DialogTitle>
              <DialogDescription>{previewModal.file?.name}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              {isImageFile(previewModal.file) ? (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewModal.file?.url || previewModal.file?.downloadURL || ""}
                    alt={previewModal.file?.name || "Preview"}
                    className="max-w-full max-h-[65vh] object-contain rounded-md border border-gray-200"
                  />
                </div>
              ) : isPdfFile(previewModal.file) ? (
                <div className="w-full h-[65vh] border border-gray-200 rounded-md overflow-hidden bg-white">
                  <iframe
                    title={previewModal.file?.name || "PDF Preview"}
                    src={previewModal.file?.url || previewModal.file?.downloadURL || ""}
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-8">
                  <FileText className="h-16 w-16 text-gray-400" />
                  <p className="text-gray-500 text-sm">Cannot preview this file type.</p>
                </div>
              )}

              {/* View + Download links — always shown */}
              {(previewModal.file?.url || previewModal.file?.downloadURL) && (
                <div className="flex items-center justify-center gap-5 pt-3 border-t border-gray-100">
                  <a
                    href={previewModal.file?.url || previewModal.file?.downloadURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <Eye className="h-4 w-4" />
                    {isImageFile(previewModal.file) ? "View full size" : "Open in new tab"}
                  </a>
                  <span className="text-gray-200">|</span>
                  <a
                    href={previewModal.file?.url || previewModal.file?.downloadURL}
                    download={previewModal.file?.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-800 hover:underline"
                  >
                    <Download className="h-4 w-4" />
                    {isPdfFile(previewModal.file) ? "Download PDF" : "Download image"}
                  </a>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
