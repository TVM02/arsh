"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Layout from "@/components/Layout";
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Search,
  Eye,
  MoreHorizontal,
  Download,
  Filter,
  Calendar,
  Building,
  User,
  CheckCircle,
  Clock,
  AlertCircle,
  FileCheck,
  X,
  Check,
  Users,
  UserCheck,
  Edit,
  Trash2,
  ClipboardList,
  MapPin,
} from "lucide-react";
import useAuthStore from "@/lib/authStore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { INVENTORY_ITEMS } from "@/lib/inspectionConstants";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/pagination";

export default function AdminReportsPage() {
  const { user, userData } = useAuthStore();
  const [reports, setReports] = useState([]);
  const [madarsas, setMadarsas] = useState([]);
  const [inspectors, setInspectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inspectorFilter, setInspectorFilter] = useState("all");
  const [madarsaFilter, setMadarsaFilter] = useState("all");
  const [madarsaSearch, setMadarsaSearch] = useState("");
  const [madarsaDropdownOpen, setMadarsaDropdownOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState("");
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Pagination (client-side)
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch all data in parallel for performance optimization
        const [reportsSnapshot, madarsasSnapshot, inspectorsSnapshot] = await Promise.all([
          getDocs(query(collection(db, "inspections"), orderBy("createdAt", "desc"))),
          getDocs(query(collection(db, "madarsas"))),
          getDocs(query(collection(db, "users"), where("role", "==", "inspector")))
        ]);

        const reportsData = reportsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setReports(reportsData);

        const madarsasData = madarsasSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMadarsas(madarsasData);

        const inspectorsData = inspectorsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setInspectors(inspectorsData);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load reports data");
      } finally {
        setLoading(false);
      }
    };

    if (user && userData?.role === "central_admin") {
      fetchData();
    } else if (user && userData) {
      // If user is logged in but not central admin, still stop loading
      setLoading(false);
    }
  }, [user, userData]);

  const filteredReports = reports.filter((report) => {
    const inspector = inspectors.find((i) => i.id === report.inspectorId);
    const inspectorPhone = inspector?.phone || inspector?.phoneNumber || "000";
    const last3 = String(inspectorPhone).replace(/\D/g, "").slice(-3).padStart(3, "0");
    const madarsaIdStr = report.selectedMadarsaId || report.madarsaId || "UNKNOWN";
    
    // Ensure the Madrasa serial number is correctly padded to at least 3 digits (supports 3/4/5 digit variants)
    const rawCleanId = madarsaIdStr.replace(/^mid-/i, "");
    const cleanMadarsaId = /^\d+$/.test(rawCleanId) ? rawCleanId.padStart(3, "0") : rawCleanId;
    
    const rawFormattedId = report.reportId || `INS-${cleanMadarsaId}-${last3}`.toUpperCase();
    
    // Normalize any existing Report IDs to ensure the serial number formatting strictly adheres to the requested consistent storage pattern
    const formattedId = rawFormattedId.replace(/INS-(?:MID-)?(\d+)-(\d+)/i, (match, mId, last) => {
      return `INS-${mId.padStart(3, "0")}-${last.padStart(3, "0")}`;
    });
    report.formattedReportId = formattedId;
    
    // Ensure MID column is properly formatted in the PDF and UI
    const midDigits = String(madarsaIdStr).replace(/\D/g, "");
    report.formattedMID = midDigits ? `MID-${midDigits.padStart(3, "0")}` : madarsaIdStr;

    const matchesSearch =
      report.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.madarsaName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.selectedMadarsaId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.inspectorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formattedId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || report.status === statusFilter;
    const matchesInspector =
      inspectorFilter === "all" || report.inspectorId === inspectorFilter;
    const matchesMadarsa =
      madarsaFilter === "all" || report.selectedMadarsaId === madarsaFilter;

    let matchesDate = true;
    if (dateFilter !== "all") {
      const reportDate = new Date(
        report.createdAt?.toDate?.() || report.createdAt,
      );
      const today = new Date();
      const daysDiff = Math.floor((today - reportDate) / (1000 * 60 * 60 * 24));

      switch (dateFilter) {
        case "today":
          matchesDate = daysDiff === 0;
          break;
        case "week":
          matchesDate = daysDiff <= 7;
          break;
        case "month":
          matchesDate = daysDiff <= 30;
          break;
        case "custom":
          if (!customDate) {
            matchesDate = true;
            break;
          }
          matchesDate = reportDate.toISOString().split("T")[0] === customDate;
          break;
        default:
          matchesDate = true;
      }
    }

    return (
      matchesSearch &&
      matchesStatus &&
      matchesInspector &&
      matchesMadarsa &&
      matchesDate
    );
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    statusFilter,
    inspectorFilter,
    madarsaFilter,
    dateFilter,
    customDate,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil((filteredReports?.length || 0) / itemsPerPage),
  );

  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    (currentPage - 1) * itemsPerPage + itemsPerPage,
  );

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
        return <FileCheck className="h-4 w-4" />;
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

  const handleReviewAction = async (report, action) => {
    setSelectedReport(report);
    setReviewAction(action);
    setReviewRemarks("");
    setReviewModal(true);
  };

  const submitReview = async () => {
    if (!selectedReport || !reviewAction) return;

    if (
      (reviewAction === "rejected" || reviewAction === "approved") &&
      !reviewRemarks.trim()
    ) {
      toast.error("Please provide remarks for this action");
      return;
    }

    try {
      setActionLoading(true);

      const updateData = {
        status: reviewAction,
        reviewedAt: serverTimestamp(),
        reviewedBy: userData?.name || user.displayName,
        adminRemarks: reviewRemarks.trim(),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "inspections", selectedReport.id), updateData);

      // Update local state
      setReports((prev) =>
        prev.map((report) =>
          report.id === selectedReport.id
            ? { ...report, ...updateData }
            : report,
        ),
      );

      toast.success(`Report ${reviewAction} successfully`);
      setReviewModal(false);
      setSelectedReport(null);
      setReviewAction("");
      setReviewRemarks("");
    } catch (error) {
      console.error("Error updating report:", error);
      toast.error("Failed to update report");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteReport = (report) => {
    setReportToDelete(report);
    setDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!reportToDelete) return;

    try {
      setDeleteLoading(true);

      // Delete the report from Firestore
      await deleteDoc(doc(db, "inspections", reportToDelete.id));

      // Update local state to remove the deleted report
      setReports((prev) =>
        prev.filter((report) => report.id !== reportToDelete.id),
      );

      toast.success("Report deleted successfully");
      setDeleteModal(false);
      setReportToDelete(null);

      // Keep page index valid if the current page becomes empty
      setCurrentPage((p) => Math.max(1, p));
    } catch (error) {
      console.error("Error deleting report:", error);
      toast.error("Failed to delete report");
    } finally {
      setDeleteLoading(false);
    }
  };

  const cancelDelete = () => {
    setDeleteModal(false);
    setReportToDelete(null);
  };

  const downloadPDF = async (scope = "filtered") => {
    const source = scope === "all" ? reports : filteredReports;
    const pdf = new jsPDF({ orientation: "landscape" });

    pdf.setFontSize(14);
    pdf.text("Inspection Reports", 14, 15);
    pdf.setFontSize(9);
    pdf.text(
      `Generated: ${new Date().toLocaleString("en-IN")} — ${source.length} records`,
      14,
      22,
    );
    autoTable(pdf, {
      startY: 27,
      head: [csvHeaders],
      body: source.map(reportToCSVRow),
      styles: { fontSize: 7, cellPadding: 2, font: "helvetica" },
      headStyles: { fillColor: [37, 99, 235], font: "helvetica" },
    });
    pdf.save(
      `inspection-reports-${scope}-${new Date().toISOString().split("T")[0]}.pdf`,
    );
  };

  const downloadCsvRows = (rows, filename) => {
    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const csvHeaders = [
    "Report ID",
    "Title",
    "Madrasa",
    "MID",
    "Inspector",
    "Inspector Email",
    "Status",
    "Created Date",
    "Inspection Date",
    "Type",
    "Session Started",
    "Submitted At",
    "Location",
  ];

  const reportToCSVRow = (report) => {
    const formatTs = (val) => {
      const d = val?.toDate?.() || (val ? new Date(val) : null);
      return d ? d.toLocaleString("en-IN") : "—";
    };
    return [
      report.id,
      report.title || `Inspection Report - ${report.selectedMadarsaId}`,
      report.madarsaName || report.selectedMadarsaId,
      report.selectedMadarsaId || "",
      report.inspectorName || "",
      inspectors.find((i) => i.id === report.inspectorId)?.email || "",
      report.status || "draft",
      formatTs(report.createdAt),
      report.inspectionDate
        ? new Date(report.inspectionDate).toLocaleDateString()
        : "N/A",
      report.inspectionType || "routine",
      formatTs(report.sessionStartedAt),
      formatTs(report.submittedAt),
      report.location ? `${report.location.lat}, ${report.location.lng}` : "—",
    ];
  };

  const exportReports = (scope = "filtered") => {
    const source = scope === "all" ? reports : filteredReports;
    downloadCsvRows(
      [csvHeaders, ...source.map(reportToCSVRow)],
      `inspection-reports-${scope}-${new Date().toISOString().split("T")[0]}.csv`,
    );
  };

  const downloadSingleReport = (report) => {
    const inspector = inspectors.find((i) => i.id === report.inspectorId);
    const inspectorPhone = inspector?.phone || inspector?.phoneNumber || "000";
    const last3 = String(inspectorPhone).replace(/\D/g, "").slice(-3).padStart(3, "0");
    const madarsaIdStr = report.selectedMadarsaId || report.madarsaId || "UNKNOWN";
    
    const rawCleanId = madarsaIdStr.replace(/^mid-/i, "");
    const cleanMadarsaId = /^\d+$/.test(rawCleanId) ? rawCleanId.padStart(3, "0") : rawCleanId;
    const rawFormattedId = report.reportId || `INS-${cleanMadarsaId}-${last3}`.toUpperCase();
    const formattedId = rawFormattedId.replace(/INS-(?:MID-)?(\d+)-(\d+)/i, (match, mId, last) => `INS-${mId.padStart(3, "0")}-${last.padStart(3, "0")}`);
    
    const midDigits = String(madarsaIdStr).replace(/\D/g, "");
    const formattedMID = midDigits ? `MID-${midDigits.padStart(3, "0")}` : madarsaIdStr;
    report.formattedMID = formattedMID;

    downloadCsvRows(
      [csvHeaders, reportToCSVRow(report)],
      `${formattedId}-${new Date().toISOString().split("T")[0]}.csv`,
    );
  };

  const downloadSingleReportPDF = async (report) => {
    const pdf = new jsPDF();

    try {
      const fontResponse = await fetch("/fonts/NotoSansMalayalam-Regular.ttf");
      const fontBuffer = await fontResponse.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(fontBuffer);
      for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
      }
      pdf.addFileToVFS("NotoSansMalayalam.ttf", btoa(binary));
      pdf.addFont("NotoSansMalayalam.ttf", "NotoSansMalayalam", "normal", "Identity-H");
      pdf.addFont("NotoSansMalayalam.ttf", "NotoSansMalayalam", "bold", "Identity-H");
      pdf.setFont("NotoSansMalayalam");
    } catch (e) {
      console.error("Failed to load custom font", e);
    }
    
    const formatTs = (val) => {
      const d = val?.toDate?.() || (val ? new Date(val) : null);
      return d ? d.toLocaleString("en-IN") : "—";
    };
    
    // Get inspector phone for ID formatting
    const inspector = inspectors.find((i) => i.id === report.inspectorId);
    const inspectorPhone = inspector?.phone || inspector?.phoneNumber || "000";
    const last3 = String(inspectorPhone).replace(/\D/g, "").slice(-3).padStart(3, "0");
    const madarsaIdStr = report.selectedMadarsaId || report.madarsaId || "UNKNOWN";
    
    const rawCleanId = madarsaIdStr.replace(/^mid-/i, "");
    const cleanMadarsaId = /^\d+$/.test(rawCleanId) ? rawCleanId.padStart(3, "0") : rawCleanId;
    const rawFormattedId = report.reportId || `INS-${cleanMadarsaId}-${last3}`.toUpperCase();
    const formattedId = rawFormattedId.replace(/INS-(?:MID-)?(\d+)-(\d+)/i, (match, mId, last) => `INS-${mId.padStart(3, "0")}-${last.padStart(3, "0")}`);
    
    const midDigits = String(madarsaIdStr).replace(/\D/g, "");
    const formattedMID = midDigits ? `MID-${midDigits.padStart(3, "0")}` : madarsaIdStr;
    report.formattedMID = formattedMID;

    const pageWidth = pdf.internal.pageSize.getWidth();

    // ── Title ──
    pdf.setFontSize(16);
    
    pdf.setTextColor(0);
    pdf.text("Inspection Report", 14, 16);
    pdf.setFontSize(9);
    pdf.text(
      `Generated: ${new Date().toLocaleString("en-IN")}`,
      pageWidth - 14,
      16,
      { align: "right" },
    );
    pdf.setDrawColor(200);
    pdf.line(14, 19, pageWidth - 14, 19);
    // Subtitle: report ID + status
    pdf.setFontSize(10);
    pdf.setTextColor(120);
    
    pdf.text(`${formattedId}  ·  ${(report.status || "draft").replace("_", " ").toUpperCase()}`, 14, 26);
    pdf.setTextColor(0);

    // ── Section 1: Basic Info ──
    const basicRows = [
      ["Report ID", formattedId],
      [
        "Title",
        report.title || `Inspection Report - ${report.formattedMID || report.selectedMadarsaId}`,
      ],
      ["Madrasa", report.madarsaName || report.selectedMadarsaId || "—"],
      ["MID", report.formattedMID || report.selectedMadarsaId || "—"],
      [
        "Madrasa Address",
        (madarsas.find((m) => m.id === (report.selectedMadarsaId || report.madarsaId) || m.madarsaId === (report.selectedMadarsaId || report.madarsaId))?.address || madarsas.find((m) => m.id === (report.selectedMadarsaId || report.madarsaId) || m.madarsaId === (report.selectedMadarsaId || report.madarsaId))?.madarsaAddress) || "—"
      ],
      [
        "District",
        (madarsas.find((m) => m.id === (report.selectedMadarsaId || report.madarsaId) || m.madarsaId === (report.selectedMadarsaId || report.madarsaId))?.mekhala || madarsas.find((m) => m.id === (report.selectedMadarsaId || report.madarsaId) || m.madarsaId === (report.selectedMadarsaId || report.madarsaId))?.mekhalaName) || "—"
      ],
      [
        "Mekhala Name",
        madarsas.find((m) => m.id === (report.selectedMadarsaId || report.madarsaId) || m.madarsaId === (report.selectedMadarsaId || report.madarsaId))?.district || "—"
      ],
      ["Inspector", report.inspectorName || "—"],
      [
        "Inspector Email",
        inspectors.find((i) => i.id === report.inspectorId)?.email || "—",
      ],
      ["Status", (report.status || "draft").replace("_", " ").toUpperCase()],
      [
        "Inspection Type",
        (report.inspectionType || "routine").replace("_", " "),
      ],
      [
        "Inspection Date",
        report.inspectionDate
          ? new Date(report.inspectionDate).toLocaleDateString("en-IN")
          : "—",
      ],
      ["Session Started", formatTs(report.sessionStartedAt)],
      ["Submitted At", formatTs(report.submittedAt)],
      ["Created", formatTs(report.createdAt)],
      [
        "Location",
        report.location
          ? `${report.location.lat.toFixed(6)}, ${report.location.lng.toFixed(6)}`
          : "—"
      ],
    ];
    autoTable(pdf, {
      startY: 31,
      head: [
        [
          {
            content: "Basic Information",
            colSpan: 2,
            styles: { halign: "left", font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
          },
        ],
      ],
      body: basicRows,
      styles: { fontSize: 8, cellPadding: 3, font: "NotoSansMalayalam", overflow: "linebreak" },
      headStyles: { fillColor: [15, 118, 110], font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 55, fillColor: [245, 247, 250], font: "NotoSansMalayalam" }, 1: { font: "NotoSansMalayalam" } },
      willDrawCell: (data) => {
        if (data.section === "body" && data.row.raw[0] === "Location" && data.column.index === 1 && report.location) {
          pdf.setTextColor(37, 99, 235); // text-blue-600
        }
      },
      didDrawCell: (data) => {
        if (data.section === "body" && data.row.raw[0] === "Location" && data.column.index === 1 && report.location) {
          const text = `${report.location.lat.toFixed(6)}, ${report.location.lng.toFixed(6)}`;
          const textWidth = pdf.getTextWidth(text);
          const { x, y, width, height } = data.cell;
          pdf.link(x + 3, y + 3, textWidth, height - 6, { url: `https://maps.google.com/?q=${report.location.lat},${report.location.lng}` });
          pdf.setDrawColor(37, 99, 235);
          pdf.line(x + 3, y + height - 3, x + 3 + textWidth, y + height - 3);
        }
      }
    });

    // ── Inspector Selfie ──
    if (report.inspectorSelfieUrl) {
      try {
        // Route through server-side proxy to bypass Firebase Storage CORS
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(report.inspectorSelfieUrl)}`;
        const selfieDataUrl = await fetch(proxyUrl)
          .then((res) => {
            if (!res.ok) throw new Error("proxy fetch failed");
            return res.blob();
          })
          .then(
            (blob) =>
              new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              })
          );
        const selfieY = pdf.lastAutoTable.finalY + 10;
        pdf.setFontSize(9);
        
        pdf.setTextColor(0);
        pdf.text("Inspector Selfie", 14, selfieY);
        pdf.addImage(selfieDataUrl, "JPEG", 14, selfieY + 3, 50, 50);
        pdf.lastAutoTable = { finalY: selfieY + 58 };
      } catch (e) {
        // Last resort: show URL as text
        const selfieY = pdf.lastAutoTable.finalY + 10;
        pdf.setFontSize(9);
        
        pdf.setTextColor(0);
        pdf.text("Inspector Selfie:", 14, selfieY);
        pdf.text(report.inspectorSelfieUrl, 50, selfieY, { maxWidth: 140 });
        pdf.lastAutoTable = { finalY: selfieY + 14 };
      }
    }

    // ── Section 2: Remarks from each form ──
    const remarksRows = [
      ["Madrasa Form Remarks", report.madarsaFormRemarks || "—"],
      ["Management Form Remarks", report.managementFormRemarks || "—"],
      ["Sadar Info Form Remarks", report.sadarFormRemarks || "—"],
    ];
    autoTable(pdf, {
      startY: pdf.lastAutoTable.finalY + 10,
      pageBreak: "avoid",
      head: [
        [
          {
            content: "Inspector Remarks & Observations",
            colSpan: 2,
            styles: { halign: "left", font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
          },
        ],
      ],
      body: remarksRows,
      styles: { fontSize: 8, cellPadding: 3, font: "NotoSansMalayalam", overflow: "linebreak" },
      headStyles: { fillColor: [15, 118, 110], font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 60, fillColor: [245, 247, 250], font: "NotoSansMalayalam" }, 1: { font: "NotoSansMalayalam", overflow: "linebreak" } },
    });

    // ── Section 3: Student Class Summary ──
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
    const ctd = report.classTableData || {};
    const classRows = [];
    let totalBoys = 0,
      totalGirls = 0,
      totalOthers = 0;
    CLASS_LIST.forEach((cls) => {
      const row = ctd[cls];
      if (!row) return;
      const b = Number(row.boys) || 0;
      const g = Number(row.girls) || 0;
      const o = Number(row.others) || 0;
      totalBoys += b;
      totalGirls += g;
      totalOthers += o;
      classRows.push([cls, b, g, o, b + g + o, row.remarks || "—"]);
    });
    if (ctd["_other"]) {
      const b = Number(ctd["_other"].boys) || 0;
      const g = Number(ctd["_other"].girls) || 0;
      const o = Number(ctd["_other"].others) || 0;
      totalBoys += b;
      totalGirls += g;
      totalOthers += o;
      classRows.push(["Other", b, g, o, b + g + o, ctd["_other"].remarks || "—"]);
    }
      if (classRows.length > 0) {
      classRows.push([
        { content: "TOTAL", styles: { fontStyle: "bold", fillColor: [230, 244, 241], font: "NotoSansMalayalam" } },
        { content: totalBoys, styles: { fontStyle: "bold", halign: "center", fillColor: [230, 244, 241], font: "NotoSansMalayalam" } },
        { content: totalGirls, styles: { fontStyle: "bold", halign: "center", fillColor: [230, 244, 241], font: "NotoSansMalayalam" } },
        { content: totalOthers, styles: { fontStyle: "bold", halign: "center", fillColor: [230, 244, 241], font: "NotoSansMalayalam" } },
        { content: totalBoys + totalGirls + totalOthers, styles: { fontStyle: "bold", halign: "center", fillColor: [230, 244, 241], font: "NotoSansMalayalam" } },
        { content: "", styles: { fillColor: [230, 244, 241] } },
      ]);
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 10,
        head: [
          [
            {
              content: "Student Class Summary",
              colSpan: 6,
              styles: { halign: "left", font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
            },
          ],
          ["Class", "Boys", "Girls", "Others", "Total", "Remarks"],
        ],
        body: classRows,
        styles: { fontSize: 8, cellPadding: 3, font: "NotoSansMalayalam" },
        headStyles: { fillColor: [15, 118, 110], font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 22, font: "NotoSansMalayalam" },
          1: { halign: "center", cellWidth: 15, font: "NotoSansMalayalam" },
          2: { halign: "center", cellWidth: 15, font: "NotoSansMalayalam" },
          3: { halign: "center", cellWidth: 15, font: "NotoSansMalayalam" },
          4: { halign: "center", cellWidth: 18, fontStyle: "bold", font: "NotoSansMalayalam" },
        },
      });
    }

    // ── Section 4: Inventory Registry ──
    const invReg = report.inventoryRegistry || {};
    const customFields = Array.isArray(report.customInventoryFields)
      ? report.customInventoryFields
      : [];
    const allInventory = [...INVENTORY_ITEMS, ...customFields];
    const invRows = allInventory.map((item) => [
      item.label,
      invReg[item.key] !== undefined && invReg[item.key] !== ""
        ? invReg[item.key]
        : "—",
    ]);
    if (invRows.length > 0) {
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 10,
        head: [
          [
            {
              content: "Inventory Registry",
              colSpan: 2,
              styles: { halign: "left", font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
            },
          ],
        ],
        body: invRows,
        styles: { fontSize: 8, cellPadding: 3, font: "NotoSansMalayalam" },
        headStyles: { fillColor: [15, 118, 110], font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 70, fillColor: [245, 247, 250], font: "NotoSansMalayalam" }, 1: { font: "NotoSansMalayalam" } },
      });
    }

    // ── Section 5: File Attachments ──
    const fileSections = [
      { label: "Madrasa Form Files", files: report.madarsaFormFiles },
      { label: "Management Form Files", files: report.managementFormFiles },
      { label: "Sadar Info Form Files", files: report.sadarFormFiles },
    ];
    const fileRows = [];
    fileSections.forEach(({ label, files }) => {
      if (!Array.isArray(files) || files.length === 0) return;
      files.forEach((f, i) => {
        fileRows.push([`${label} (${i + 1})`, f.name || "—", f.url]);
      });
    });
    if (fileRows.length > 0) {
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 10,
        head: [
          [
            {
              content: "Uploaded Documents",
              colSpan: 2,
              styles: { halign: "left", font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
            },
          ],
          ["Section", "File Name"],
        ],
        body: fileRows.map(r => [r[0], r[1]]),
        styles: { fontSize: 8, cellPadding: 3, font: "NotoSansMalayalam" },
        headStyles: { fillColor: [15, 118, 110], font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 70, fontStyle: "bold", fillColor: [245, 247, 250], font: "NotoSansMalayalam" },
          1: { cellWidth: 110, font: "NotoSansMalayalam", textColor: [0, 102, 204] },
        },
        didDrawCell: (data) => {
          if (data.column.index === 1 && data.cell.section === 'body') {
            const url = fileRows[data.row.index][2];
            if (url) {
              pdf.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
            }
          }
        }
      });
    }

    // ── Section 5.5: Append Media Attachments ──
    const mediaFiles = [];
    fileSections.forEach(({ label, files }) => {
      if (!Array.isArray(files)) return;
      files.forEach((f, i) => {
        const fileUrl = f.url || f.downloadURL || "";
        if (!fileUrl) return;
        const isImg = f.type?.startsWith("image/") || /\.(png|jpe?g|webp|gif)(\?|$|#)/i.test(f.name || fileUrl);
        const isPdf = f.type === "application/pdf" || /\.pdf(\?|$|#)/i.test(f.name || fileUrl);
        if (isImg || isPdf) {
          mediaFiles.push({ label: `${label} (${i + 1})`, url: fileUrl, isImg, isPdf, name: f.name || "Unknown File" });
        }
      });
    });

    if (mediaFiles.length > 0) {
      let currentY = pdf.lastAutoTable.finalY + 10;
      
      pdf.setFontSize(10);
      pdf.setFont("NotoSansMalayalam", "bold");
      pdf.setTextColor(15, 118, 110);
      pdf.text("Attached Documents (Visuals)", 14, currentY);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("NotoSansMalayalam", "normal");
      currentY += 8;

      for (const media of mediaFiles) {
        if (currentY + 65 > pdf.internal.pageSize.getHeight()) {
          pdf.addPage();
          currentY = 20;
        }
        
        pdf.setFontSize(9);
        pdf.setFont("NotoSansMalayalam", "bold");
        pdf.text(media.label, 98, currentY + 10);
        pdf.setFont("NotoSansMalayalam", "normal");
        pdf.setTextColor(15, 118, 110);
        
        if (media.isImg) {
          try {
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(media.url)}`;
            const imgDataUrl = await fetch(proxyUrl)
              .then(res => {
                 if (!res.ok) throw new Error("fetch failed");
                 return res.blob();
              })
              .then(blob => new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.onerror = reject;
                r.readAsDataURL(blob);
              }));
            
            pdf.addImage(imgDataUrl, "JPEG", 14, currentY, 80, 50, undefined, 'FAST');
            pdf.textWithLink("View Full Image", 98, currentY + 18, { url: media.url });
          } catch(e) {
            console.error("Failed to load image for PDF", e);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`[Image Load Failed]`, 14, currentY + 5);
            pdf.setTextColor(15, 118, 110);
            pdf.textWithLink("View Image via Link", 98, currentY + 18, { url: media.url });
          }
        } else if (media.isPdf) {
          // Draw PDF placeholder box
          pdf.setDrawColor(200, 200, 200);
          pdf.setFillColor(245, 247, 250);
          pdf.rect(14, currentY, 80, 50, "FD");
          
          pdf.setTextColor(100, 100, 100);
          pdf.setFontSize(14);
          pdf.setFont("NotoSansMalayalam", "bold");
          pdf.text("PDF", 54, currentY + 25, { align: "center" });
          pdf.setFontSize(9);
          pdf.setFont("NotoSansMalayalam", "normal");
          pdf.text("Document Attached", 54, currentY + 32, { align: "center" });
          
          pdf.setTextColor(15, 118, 110);
          pdf.textWithLink("Open PDF in New Tab", 98, currentY + 18, { url: media.url });
        }
        
        pdf.setTextColor(0, 0, 0);
        currentY += 55;
      }
      pdf.lastAutoTable = { finalY: currentY };
    }
    
    // Final reset of font and color before Admin Remarks section
    pdf.setTextColor(0);

    // ── Section 6: Admin Remarks (AFTER images so color/font state is clean) ──
    if (report.adminRemarks || report.reviewedBy) {
      const remarksText = (report.adminRemarks || "—")
        .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, " ") // normalize whitespace
        .replace(/\r\n/g, "\n")
        .trim();

      // Ensure font is set BEFORE splitting text to use correct metrics
      
      const wrappedRemarks = pdf.splitTextToSize(remarksText, 120);

      const adminRows = [
        ["Reviewed By", report.reviewedBy || "—"],
        ["Reviewed At", formatTs(report.reviewedAt)],
        ["Admin Remarks", wrappedRemarks], // Pass pre-wrapped array
      ];
      
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 10,
        pageBreak: "avoid", // prevent header from being orphaned at page bottom
        head: [
          [
            {
              content: "Administrative Review",
              colSpan: 2,
              styles: { halign: "left", font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
            },
          ],
        ],
        body: adminRows,
        styles: {
          fontSize: 8,
          cellPadding: 3,
          font: "NotoSansMalayalam",
          fontStyle: "normal",
          overflow: "linebreak",
          halign: "left",
        },
        headStyles: { fillColor: [15, 118, 110], font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 50, fillColor: [245, 247, 250], font: "NotoSansMalayalam" },
          1: { cellWidth: 130, font: "NotoSansMalayalam", fontStyle: "normal", overflow: "linebreak", minCellHeight: 20 },
        },
      });
    }

    // ── Footer on each page ──
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFontSize(7);
      pdf.setTextColor(150);
      pdf.text(
        `Page ${p} of ${totalPages}  |  DKJU Inspection Report  |  ${formattedId}`,
        pageWidth / 2,
        pdf.internal.pageSize.getHeight() - 8,
        { align: "center" },
      );
    }

    try {
      const mainPdfBytes = pdf.output("arraybuffer");
      const mainPdfDoc = await PDFDocument.load(mainPdfBytes);
      const helveticaFont = await mainPdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helveticaNormal = await mainPdfDoc.embedFont(StandardFonts.Helvetica);

      for (const media of mediaFiles) {
        if (media.isPdf) {
          try {
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(media.url)}`;
            const pdfBytes = await fetch(proxyUrl).then((res) => {
              if (!res.ok) throw new Error("fetch failed");
              return res.arrayBuffer();
            });
            const attachedPdfDoc = await PDFDocument.load(pdfBytes);
            
            // Create a cover page
            const coverPage = mainPdfDoc.addPage();
            const { width, height } = coverPage.getSize();
            
            // Draw heading
            coverPage.drawText(media.label, { x: 50, y: height - 100, size: 20, font: helveticaFont, color: rgb(0.06, 0.46, 0.43) });
            
            // Draw file name
            coverPage.drawText(`File Name: ${media.name}`, { x: 50, y: height - 140, size: 14, font: helveticaNormal, color: rgb(0, 0, 0) });

            const copiedPages = await mainPdfDoc.copyPages(
              attachedPdfDoc,
              attachedPdfDoc.getPageIndices()
            );
            copiedPages.forEach((page) => mainPdfDoc.addPage(page));
          } catch (e) {
            console.error("Failed to append PDF:", media.url, e);
          }
        }
      }

      const finalPdfBytes = await mainPdfDoc.save();
      const blob = new Blob([finalPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${formattedId}-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error finalizing PDF via pdf-lib", e);
      // Fallback to native jsPDF save
      pdf.save(`${formattedId}-${new Date().toISOString().split("T")[0]}.pdf`);
    }
  };

  const getStatsData = () => {
    const total = reports.length;
    const draft = reports.filter(
      (r) => r.status === "draft" || !r.status,
    ).length;
    const submitted = reports.filter((r) => r.status === "submitted").length;
    const reviewed = reports.filter((r) => r.status === "reviewed").length;
    const approved = reports.filter((r) => r.status === "approved").length;
    const rejected = reports.filter((r) => r.status === "rejected").length;

    return { total, draft, submitted, reviewed, approved, rejected };
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading reports...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Check if user is authorized
  if (!user || userData?.role !== "central_admin") {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600">
              You don&apos;t have permission to view this page.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const stats = getStatsData();

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Inspection Reports
            </h1>
            <p className="text-gray-600">
              Manage and review all inspection reports from inspectors
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/dkju-control/reports/attendance">
              <Button variant="outline" className="border-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100">
                <ClipboardList className="h-4 w-4 mr-2" />
                Attendance Reports
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Download Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportReports("filtered")}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Filtered CSV ({filteredReports.length} reports)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportReports("all")}>
                  <Download className="h-4 w-4 mr-2" />
                  Export All CSV ({reports.length} reports)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>PDF Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => downloadPDF("filtered")}>
                  <Download className="h-4 w-4 mr-2" />
                  Filtered ({filteredReports.length} reports)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadPDF("all")}>
                  <Download className="h-4 w-4 mr-2" />
                  All ({reports.length} reports)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.total}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Draft</p>
                <p className="text-2xl font-bold text-gray-600">
                  {stats.draft}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Submitted</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.submitted}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Reviewed</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.reviewed}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {stats.approved}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.rejected}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={inspectorFilter}
                onValueChange={setInspectorFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by inspector" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">
                    All Inspectors (Thaftheesh)
                  </SelectItem>
                  {inspectors.map((inspector) => (
                    <SelectItem key={inspector.id} value={inspector.id}>
                      {inspector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Searchable madrasa filter */}
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder={
                      madarsaFilter === "all"
                        ? "All Madarsas"
                        : madarsas.find((m) => m.madarsaId === madarsaFilter)
                            ?.name || "All Madarsas"
                    }
                    value={madarsaSearch}
                    onFocus={() => setMadarsaDropdownOpen(true)}
                    onBlur={() =>
                      setTimeout(() => setMadarsaDropdownOpen(false), 150)
                    }
                    onChange={(e) => {
                      setMadarsaSearch(e.target.value);
                      setMadarsaDropdownOpen(true);
                    }}
                    className="pl-9 pr-7"
                  />
                  {madarsaFilter !== "all" && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setMadarsaFilter("all");
                        setMadarsaSearch("");
                      }}
                    >
                      &#x2715;
                    </button>
                  )}
                </div>
                {madarsaDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full min-w-[220px] bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                    <button
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${madarsaFilter === "all" ? "font-semibold text-blue-700 bg-blue-50" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setMadarsaFilter("all");
                        setMadarsaSearch("");
                        setMadarsaDropdownOpen(false);
                      }}
                    >
                      All Madarsas
                    </button>
                    {madarsas
                      .filter((m) => {
                        const q = madarsaSearch.toLowerCase();
                        return (
                          !q ||
                          (m.name || "").toLowerCase().includes(q) ||
                          (m.madarsaId || "").toLowerCase().includes(q)
                        );
                      })
                      .map((m) => (
                        <button
                          key={m.id}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${madarsaFilter === m.madarsaId ? "bg-blue-50" : ""}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setMadarsaFilter(m.madarsaId);
                            setMadarsaSearch("");
                            setMadarsaDropdownOpen(false);
                          }}
                        >
                          <div className="text-sm font-medium">{m.name}</div>
                          <div className="text-xs text-gray-400">
                            {m.madarsaId}
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <Select
                value={dateFilter}
                onValueChange={(v) => {
                  setDateFilter(v);
                  setCustomDate("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative flex items-center">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    setDateFilter(e.target.value ? "custom" : "all");
                  }}
                  title="Filter by specific date"
                  className="pl-9 pr-8 h-10 w-full rounded-md border border-gray-300 bg-white text-sm text-gray-900 shadow-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500"
                />
                {customDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomDate("");
                      setDateFilter("all");
                    }}
                    title="Clear date filter"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Reports ({filteredReports.length})
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredReports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">
                  {reports.length === 0
                    ? "No inspection reports found"
                    : "No reports match your search criteria"}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto border rounded-lg shadow-sm">
                  <Table className="w-full text-sm">
                    <TableHeader className="bg-gray-50/80">
                      <TableRow>
                        <TableHead className="font-semibold text-gray-600">Report Details</TableHead>
                        <TableHead className="font-semibold text-gray-600">Madrasa</TableHead>
                        <TableHead className="font-semibold text-gray-600">Location</TableHead>
                        <TableHead className="font-semibold text-gray-600">Inspector</TableHead>
                        <TableHead className="font-semibold text-gray-600">Status</TableHead>
                        <TableHead className="font-semibold text-gray-600">Timeline</TableHead>
                        <TableHead className="font-semibold text-gray-600 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-gray-100">
                      {paginatedReports.map((report) => {
                        const madarsa = madarsas.find(
                          (m) => m.madarsaId === report.selectedMadarsaId,
                        );
                        const inspector = inspectors.find(
                          (i) => i.id === report.inspectorId,
                        );

                        // Ensure rigorous Report ID formatting
                        const inspectorPhone = inspector?.phone || inspector?.phoneNumber || "000";
                        const last3 = String(inspectorPhone).replace(/\D/g, "").slice(-3).padStart(3, "0");
                        const madarsaIdStr = report.selectedMadarsaId || report.madarsaId || "UNKNOWN";
                        const rawFormattedId = report.reportId || `INS-${madarsaIdStr}-${last3}`.toUpperCase();
                        const formattedId = rawFormattedId.replace(/INS-MID-/i, "INS-");

                        return (
                          <TableRow key={report.id} className="hover:bg-gray-50/50 transition-colors">
                            <TableCell className="align-top py-4">
                              <div className="flex flex-col gap-1.5">
                                <span className="font-semibold text-gray-900 leading-none">
                                  {report.title || `Inspection Report - ${report.selectedMadarsaId}`}
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="font-mono text-xs text-indigo-600 bg-indigo-50 border-indigo-100">
                                    {formattedId}
                                  </Badge>
                                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider bg-gray-100 text-gray-600">
                                    {report.inspectionType || "ROUTINE"}
                                  </Badge>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="align-top py-4">
                              <div className="flex items-start gap-2.5">
                                <div className="mt-0.5 bg-blue-50 p-1.5 rounded-md">
                                  <Building className="h-4 w-4 text-blue-500" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-gray-900">
                                    {madarsa?.name || report.madarsaName || "Unknown Madrasa"}
                                  </span>
                                  <span className="text-xs font-medium text-gray-500">
                                    MID: {report.selectedMadarsaId}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="align-top py-4">
                              {report.location ? (
                                <a 
                                  href={`https://maps.google.com/?q=${report.location.lat},${report.location.lng}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-blue-600 hover:underline flex items-center gap-1.5 text-sm font-medium"
                                >
                                  <MapPin className="h-4 w-4" />
                                  View Map
                                </a>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="align-top py-4">
                              <div className="flex items-start gap-2.5">
                                <div className="mt-0.5 bg-emerald-50 p-1.5 rounded-md">
                                  <User className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-gray-900">
                                    {inspector?.name || report.inspectorName || "Unknown Inspector"}
                                  </span>
                                  <span className="text-xs text-gray-500 max-w-[140px] truncate">
                                    {inspector?.email || "No email provided"}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="align-top py-4">
                              <Badge className={getStatusColor(report.status)}>
                                {getStatusIcon(report.status)}
                                <span className="ml-1.5 capitalize font-medium">
                                  {(report.status || "draft").replace("_", " ")}
                                </span>
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top py-4 min-w-[200px]">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-blue-500 shrink-0" />
                                  <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                                    {report.inspectionDate ? new Date(report.inspectionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "N/A"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Clock className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                                  <span className="whitespace-nowrap">Session: <strong className="text-gray-800 font-medium ml-1">{(() => {
                                    const t = report.sessionStartedAt?.toDate?.() || (report.sessionStartedAt ? new Date(report.sessionStartedAt) : null);
                                    return t ? t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase() : "—";
                                  })()}</strong></span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                  <span className="whitespace-nowrap">Submitted: <strong className="text-gray-800 font-medium ml-1">{(() => {
                                    const t = report.submittedAt?.toDate?.() || (report.submittedAt ? new Date(report.submittedAt) : null);
                                    return t ? t.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase() : "—";
                                  })()}</strong></span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="align-top py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600" asChild>
                                  <Link href={`/dashboard/dkju-control/reports/${report.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-teal-50 hover:text-teal-600"
                                  onClick={() => downloadSingleReport(report)}
                                  title="Export CSV"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-rose-50 hover:text-rose-600"
                                  onClick={() => downloadSingleReportPDF(report)}
                                  title="Export PDF"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t-2 border-gray-200 px-2 sm:px-0">
                    <Pagination
                      currentPage={Math.min(currentPage, totalPages)}
                      totalPages={totalPages}
                      onPageChange={(p) => {
                        const next = Math.min(Math.max(1, p), totalPages);
                        setCurrentPage(next);
                      }}
                      itemsPerPage={itemsPerPage}
                      totalItems={filteredReports.length}
                    />
                    <div className="mt-2 text-xs text-gray-500 text-center">
                      Page {Math.min(currentPage, totalPages)} of {totalPages} |
                      Total: {filteredReports.length} | Items per page:
                      {itemsPerPage}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Review Modal */}
        <Dialog open={reviewModal} onOpenChange={setReviewModal}>
          <DialogContent className="sm:max-w-[500px] bg-white">
            <DialogHeader>
              <DialogTitle>
                {reviewAction === "approved" && "Approve Report"}
                {reviewAction === "rejected" && "Reject Report"}
                {reviewAction === "reviewed" && "Mark as Reviewed"}
              </DialogTitle>
              <DialogDescription>
                {selectedReport && (
                  <>
                    Report:{" "}
                    {selectedReport.title ||
                      `Inspection Report - ${selectedReport.selectedMadarsaId}`}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="remarks">
                  {reviewAction === "rejected"
                    ? "Rejection Reason *"
                    : "Remarks"}
                </Label>
                <Textarea
                  id="remarks"
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder={
                    reviewAction === "approved"
                      ? "Add any approval comments (optional)"
                      : reviewAction === "rejected"
                        ? "Please provide reason for rejection"
                        : "Add review comments"
                  }
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setReviewModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitReview}
                  disabled={actionLoading}
                  variant={
                    reviewAction === "rejected" ? "destructive" : "default"
                  }
                >
                  {actionLoading ? "Processing..." : "Confirm"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={deleteModal} onOpenChange={setDeleteModal}>
          <DialogContent className="sm:max-w-[400px] bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Delete Report
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this inspection report? This
                action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {reportToDelete && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium text-sm">
                    {reportToDelete.title ||
                      `Inspection Report - ${reportToDelete.selectedMadarsaId}`}
                  </p>
                  <p className="text-sm text-gray-600">
                    Madrasa:{" "}
                    {reportToDelete.madarsaName ||
                      reportToDelete.selectedMadarsaId}
                  </p>
                  <p className="text-sm text-gray-600">
                    Inspector: {reportToDelete.inspectorName}
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={cancelDelete}
                  disabled={deleteLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? "Deleting..." : "Delete Report"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
