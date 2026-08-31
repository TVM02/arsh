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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  MapPin,
} from "lucide-react";
import useAuthStore from "@/lib/authStore";
import { INVENTORY_ITEMS } from "@/lib/inspectionConstants";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

export default function InspectionViewPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewModal, setPreviewModal] = useState({ open: false, file: null });
  const [downloadingPdf, setDownloadingPdf] = useState(false);

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

  const downloadPDF = async () => {
    if (!inspection) return;
    try {
      setDownloadingPdf(true);
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
      const pageWidth = pdf.internal.pageSize.getWidth();

      // ── Title ──
      pdf.setFontSize(16);
      pdf.setFont("NotoSansMalayalam", "bold");
      pdf.text("Inspection Report", 14, 16);
      pdf.setFont("NotoSansMalayalam", "normal");
      pdf.setFontSize(9);
      pdf.text(
        `Generated: ${new Date().toLocaleString("en-IN")}`,
        pageWidth - 14,
        16,
        { align: "right" },
      );
      pdf.setDrawColor(200);
      pdf.line(14, 19, pageWidth - 14, 19);

      // ── Section 1: Basic Info ──
      const basicRows = [
        ["Report ID", inspection.formattedReportId],
        [
          "Title",
          inspection.title || `Inspection Report - ${inspection.selectedMadarsaId}`,
        ],
        ["Madrasa", inspection.madarsaName || inspection.selectedMadarsaId || "—"],
        ["MID", inspection.formattedMID || inspection.selectedMadarsaId || "—"],
        ["Madrasa Address", inspection.madarsaAddress || "—"],
        ["District", inspection.madarsaMekhalaName || "—"],
        ["Mekhala Name", inspection.madarsaDistrict || "—"],
        ["Inspector", inspection.inspectorName || "—"],
        ["Inspector Email", user?.email || "—"],
        ["Status", (inspection.status || "draft").replace("_", " ").toUpperCase()],
        [
          "Inspection Type",
          (inspection.inspectionType || "routine").replace("_", " "),
        ],
        [
          "Inspection Date",
          inspection.inspectionDate
            ? new Date(inspection.inspectionDate).toLocaleDateString("en-IN")
            : "—",
        ],
        ["Session Started", formatTs(inspection.sessionStartedAt)],
        ["Submitted At", formatTs(inspection.submittedAt)],
        ["Created", formatTs(inspection.createdAt)],
        [
          "Location",
          inspection.location
            ? `${inspection.location.lat.toFixed(6)}, ${inspection.location.lng.toFixed(6)}`
            : "—"
        ],
      ];
      autoTable(pdf, {
        startY: 23,
        head: [
          [
            {
              content: "Basic Information",
              colSpan: 2,
              styles: { halign: "left" },
            },
          ],
        ],
        body: basicRows,
        styles: { fontSize: 8, cellPadding: 2, font: "NotoSansMalayalam", overflow: "linebreak" },
        headStyles: { fillColor: [15, 118, 110], font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 55, font: "NotoSansMalayalam" }, 1: { font: "NotoSansMalayalam" } },
        willDrawCell: (data) => {
          if (data.section === "body" && data.row.raw[0] === "Location" && data.column.index === 1 && inspection.location) {
            pdf.setTextColor(37, 99, 235); // text-blue-600
          }
        },
        didDrawCell: (data) => {
          if (data.section === "body" && data.row.raw[0] === "Location" && data.column.index === 1 && inspection.location) {
            const text = `${inspection.location.lat.toFixed(6)}, ${inspection.location.lng.toFixed(6)}`;
            const textWidth = pdf.getTextWidth(text);
            const { x, y, width, height } = data.cell;
            pdf.link(x + 2, y + 2, textWidth, height - 4, { url: `https://maps.google.com/?q=${inspection.location.lat},${inspection.location.lng}` });
            pdf.setDrawColor(37, 99, 235);
            pdf.line(x + 2, y + height - 2, x + 2 + textWidth, y + height - 2);
          }
        }
      });

      // ── Inspector Selfie ──
      if (inspection.inspectorSelfieUrl) {
        try {
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(inspection.inspectorSelfieUrl)}`;
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
          const selfieY = pdf.lastAutoTable.finalY + 6;
          pdf.setFontSize(9);
          pdf.setFont("NotoSansMalayalam", "bold");
          pdf.text("Inspector Selfie", 14, selfieY);
          pdf.setFont("NotoSansMalayalam", "normal");
          pdf.addImage(selfieDataUrl, "JPEG", 14, selfieY + 3, 50, 50);
          pdf.lastAutoTable = { finalY: selfieY + 58 };
        } catch (e) {
          const selfieY = pdf.lastAutoTable.finalY + 6;
          pdf.setFontSize(9);
          pdf.setFont("NotoSansMalayalam", "bold");
          pdf.text("Inspector Selfie:", 14, selfieY);
          pdf.setFont("NotoSansMalayalam", "normal");
          pdf.text(inspection.inspectorSelfieUrl, 50, selfieY, { maxWidth: 140 });
          pdf.lastAutoTable = { finalY: selfieY + 14 };
        }
      }

      // ── Section 2: Remarks from each form ──
      const remarksRows = [
        ["Madrasa Form Remarks", inspection.madarsaFormRemarks || "—"],
        ["Management Form Remarks", inspection.managementFormRemarks || "—"],
        ["Sadar Info Form Remarks", inspection.sadarFormRemarks || "—"],
      ];
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 6,
        pageBreak: "avoid",
        head: [
          [
            {
              content: "Inspector Remarks & Observations",
              colSpan: 2,
              styles: { halign: "left" },
            },
          ],
        ],
        body: remarksRows,
        styles: { fontSize: 8, cellPadding: 2, font: "NotoSansMalayalam", overflow: "linebreak" },
        headStyles: { fillColor: [15, 118, 110], font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 55, font: "NotoSansMalayalam" }, 1: { font: "NotoSansMalayalam", overflow: "linebreak" } },
      });

      // ── Section 3: Student Class Summary ──
      const ctd = inspection.classTableData || {};
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
          { content: "TOTAL", styles: { fontStyle: "bold", font: "NotoSansMalayalam" } },
          { content: totalBoys, styles: { fontStyle: "bold", font: "NotoSansMalayalam" } },
          { content: totalGirls, styles: { fontStyle: "bold", font: "NotoSansMalayalam" } },
          { content: totalOthers, styles: { fontStyle: "bold", font: "NotoSansMalayalam" } },
          { content: totalBoys + totalGirls + totalOthers, styles: { fontStyle: "bold", font: "NotoSansMalayalam" } },
          "",
        ]);
        autoTable(pdf, {
          startY: pdf.lastAutoTable.finalY + 6,
          head: [
            [
              {
                content: "Student Class Summary",
                colSpan: 6,
                styles: { halign: "left" },
              },
            ],
            ["Class", "Boys", "Girls", "Others", "Total", "Remarks"],
          ],
          body: classRows,
          styles: { fontSize: 8, cellPadding: 2, font: "NotoSansMalayalam" },
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
      const invReg = inspection.inventoryRegistry || {};
      const customFields = Array.isArray(inspection.customInventoryFields)
        ? inspection.customInventoryFields
        : [];
      const allInventory = [...INVENTORY_ITEMS, ...customFields];
      const invRows = allInventory.map((item) => {
        const val = invReg[item.key] !== undefined && invReg[item.key] !== "" ? invReg[item.key] : "—";
        const count = invReg[`${item.key}_count`] || "—";
        const remark = invReg[`${item.key}_remark`] || "—";
        return [item.label, val, count, remark];
      });
      if (invRows.length > 0) {
        autoTable(pdf, {
          startY: pdf.lastAutoTable.finalY + 6,
          head: [
            [
              {
                content: "Inventory Registry",
                colSpan: 4,
                styles: { halign: "left" },
              },
            ],
            ["Item", "Availability", "Count", "Remark"],
          ],
          body: invRows,
          styles: { fontSize: 8, cellPadding: 2, font: "NotoSansMalayalam" },
          headStyles: { fillColor: [15, 118, 110], font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
          columnStyles: { 0: { fontStyle: "bold", cellWidth: 50, font: "NotoSansMalayalam" }, 1: { cellWidth: 20, font: "NotoSansMalayalam" }, 2: { cellWidth: 20, font: "NotoSansMalayalam" }, 3: { cellWidth: 80, font: "NotoSansMalayalam" } },
        });
      }

      // ── Section 5: File Attachments ──
      const fileSections = [
        { label: "Madrasa Form Files", files: inspection.madarsaFormFiles },
        { label: "Management Form Files", files: inspection.managementFormFiles },
        { label: "Sadar Info Form Files", files: inspection.sadarFormFiles },
      ];
      // fileRows stores [section, fileName, url] internally; url is not rendered
      // as a column — the file name cell itself becomes a clickable link.
      const fileRows = [];
      fileSections.forEach(({ label, files }) => {
        if (!Array.isArray(files) || files.length === 0) return;
        files.forEach((f, i) => {
          fileRows.push([`${label} (${i + 1})`, f.name || "—", f.url || f.downloadURL || ""]);
        });
      });
      if (fileRows.length > 0) {
        autoTable(pdf, {
          startY: pdf.lastAutoTable.finalY + 6,
          head: [
            [
              {
                content: "Uploaded Documents",
                colSpan: 2,
                styles: { halign: "left" },
              },
            ],
            ["Section", "File Name"],
          ],
          // Only render 2 columns — URL is stored in index 2 but not displayed
          body: fileRows.map((r) => [r[0], r[1]]),
          styles: { fontSize: 8, cellPadding: 3, font: "NotoSansMalayalam" },
          headStyles: { fillColor: [15, 118, 110], font: "NotoSansMalayalam", fontStyle: "bold" },
          columnStyles: {
            0: { cellWidth: 70, fontStyle: "bold" },
            1: { cellWidth: 100, textColor: [0, 102, 204] },
          },
          didDrawCell: (data) => {
            // Make the file name cell a clickable hyperlink that opens the file URL
            if (data.column.index === 1 && data.cell.section === "body") {
              const url = fileRows[data.row.index]?.[2];
              if (url) {
                pdf.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
              }
            }
          },
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
          pdf.setTextColor(15, 118, 110); // Theme color
          
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
              
              // Draw image fixed size 80x60
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

      // ── Section 6: Admin Remarks ──
      if (inspection.adminRemarks || inspection.reviewedBy) {
        const adminRows = [
          ["Reviewed By", inspection.reviewedBy || "—"],
          ["Reviewed At", formatTs(inspection.reviewedAt)],
          ["Admin Remarks", inspection.adminRemarks || "—"],
        ];
        autoTable(pdf, {
          startY: pdf.lastAutoTable.finalY + 6,
          head: [
            [
              {
                content: "Administrative Review",
                colSpan: 2,
                styles: { halign: "left" },
              },
            ],
          ],
          body: adminRows,
          styles: { fontSize: 8, cellPadding: 2, font: "NotoSansMalayalam" },
          headStyles: { fillColor: [15, 118, 110], font: "NotoSansMalayalam", fontStyle: "bold", fontSize: 9 },
          columnStyles: { 0: { fontStyle: "bold", cellWidth: 55, font: "NotoSansMalayalam" }, 1: { font: "NotoSansMalayalam" }, 2: { font: "NotoSansMalayalam", overflow: "linebreak" } },
        });
      }

      // ── Footer on each page ──
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(7);
        pdf.setTextColor(150);
        pdf.text(
          `Page ${p} of ${totalPages}  |  DKJU Inspection Report  |  ${inspection.formattedReportId}`,
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
        a.download = `${inspection.formattedReportId}-${new Date().toISOString().split("T")[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Error finalizing PDF via pdf-lib", e);
        pdf.save(
          `${inspection.formattedReportId}-${new Date().toISOString().split("T")[0]}.pdf`
        );
      }
    } catch (error) {
      console.error("PDF generation failed:", error);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const inspectionId = params.inspectionId;

  useEffect(() => {
    const fetchInspection = async () => {
      try {
        setLoading(true);

        const inspectionDoc = await getDoc(
          doc(db, "inspections", inspectionId),
        );

        if (!inspectionDoc.exists()) {
          router.push("/dashboard/inspector/inspections");
          return;
        }

        const inspectionData = {
          id: inspectionDoc.id,
          ...inspectionDoc.data(),
        };

        // Check if user has access to this inspection
        if (inspectionData.inspectorId !== user.uid && inspectionData.status !== "approved") {
          router.push("/dashboard/inspector/inspections");
          return;
        }

        let inspectorPhone = "000";
        if (!inspectionData.reportId) {
          try {
            const inspectorDoc = await getDoc(doc(db, "users", inspectionData.inspectorId));
            if (inspectorDoc.exists()) {
              inspectorPhone = inspectorDoc.data().phone || inspectorDoc.data().phoneNumber || "000";
            }
          } catch (e) {}
        }
        
        const last3 = String(inspectorPhone).replace(/\D/g, "").slice(-3).padStart(3, "0");
        const madarsaIdStr = inspectionData.selectedMadarsaId || inspectionData.madarsaId || "UNKNOWN";
        const rawCleanId = madarsaIdStr.replace(/^mid-/i, "");
        const cleanMadarsaId = /^\d+$/.test(rawCleanId) ? rawCleanId.padStart(3, "0") : rawCleanId;
        const rawFormattedId = inspectionData.reportId || `INS-${cleanMadarsaId}-${last3}`.toUpperCase();
        
        inspectionData.formattedReportId = rawFormattedId.replace(/INS-(?:MID-)?(\d+)-(\d+)/i, (match, mId, last) => `INS-${mId.padStart(3, "0")}-${last.padStart(3, "0")}`);
        
        const midDigits = String(madarsaIdStr).replace(/\D/g, "");
        inspectionData.formattedMID = midDigits ? `MID-${midDigits.padStart(3, "0")}` : madarsaIdStr;

        if (inspectionData.selectedMadarsaId || inspectionData.madarsaId) {
          try {
            const mId = inspectionData.selectedMadarsaId || inspectionData.madarsaId;
            let mData = null;
            const mDoc = await getDoc(doc(db, "madarsas", mId));
            if (mDoc.exists()) {
              mData = mDoc.data();
            } else {
              const q = query(collection(db, "madarsas"), where("madarsaId", "==", mId));
              const snap = await getDocs(q);
              if (!snap.empty) {
                mData = snap.docs[0].data();
              }
            }
            if (mData) {
              inspectionData.madarsaAddress = mData.address || mData.madarsaAddress || "—";
              inspectionData.madarsaDistrict = mData.district || "—";
              inspectionData.madarsaMekhalaName = mData.mekhala || mData.mekhalaName || "—";
            }
          } catch(e) {}
        }

        setInspection(inspectionData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching inspection:", error);
        router.push("/dashboard/inspector/inspections");
      }
    };

    if (user && inspectionId) {
      fetchInspection();
    }
  }, [user, inspectionId, router]);

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

  const previewFile = (file) => {
    setPreviewModal({ open: true, file });
  };

  const downloadFile = (file) => {
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderFileSection = (files, title) => {
    if (!files || files.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No files uploaded</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        {files.map((file, index) => {
          const fileUrl = getFileUrl(file);
          const fileName = file.name || `Attachment ${index + 1}`;
          const isImage = isImageFile(file);
          const isPdf = isPdfFile(file);

          return (
            <div key={index} className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
              {/* Header */}
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
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </>
              )}

              {/* PDF embedded viewer */}
              {isPdf && fileUrl && (
                <div className="w-full h-[640px] bg-gray-50">
                  <iframe
                    src={fileUrl}
                    className="w-full h-full"
                    title={fileName}
                  />
                </div>
              )}

              {/* Unknown file type fallback */}
              {!isImage && !isPdf && fileUrl && (
                <div className="px-4 py-10 flex flex-col items-center justify-center bg-gray-50">
                  <FileText className="h-12 w-12 text-gray-300 mb-2" />
                  <span className="text-sm text-gray-500">{fileName}</span>
                </div>
              )}

              {/* View + Download links — always shown */}
              {fileUrl && (
                <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4 bg-white">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <Eye className="h-4 w-4" />
                    {isImage ? "View full size" : isPdf ? "Open PDF in new tab" : "Open file"}
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
                    {isPdf ? "Download PDF" : "Download"}
                  </a>
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
            <p className="text-gray-500">Loading inspection...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!inspection) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-8">
            <p className="text-gray-500">Inspection not found</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/inspector/inspections">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Inspections
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
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/inspector/records">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">
              {inspection.title || "Inspection Report"}
            </h1>
            <p className="text-gray-600 mt-1">Inspection ID: {inspection.formattedReportId}</p>
          </div>
          {inspection.status !== "draft" && (
            <Button
              onClick={downloadPDF}
              disabled={downloadingPdf}
              className="bg-teal-600 hover:bg-teal-700 text-white hidden sm:flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {downloadingPdf ? "Generating..." : "Download PDF"}
            </Button>
          )}
          <Badge className={getStatusColor(inspection.status)}>
            {getStatusIcon(inspection.status)}
            <span className="ml-1 capitalize">
              {inspection.status?.replace("_", " ")}
            </span>
          </Badge>
        </div>

        {/* Basic Information */}
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
                <p className="font-medium">{inspection.madarsaName}</p>
                <p className="text-sm text-gray-600">
                  {inspection.selectedMadarsaId}
                </p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Madrasa Address</Label>
                <p className="font-medium">{inspection.madarsaAddress || "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">District</Label>
                <p className="font-medium">{inspection.madarsaMekhalaName || "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Mekhala Name</Label>
                <p className="font-medium">{inspection.madarsaDistrict || "—"}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Inspection Date</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <p className="font-medium">
                    {new Date(inspection.inspectionDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Type</Label>
                <p className="font-medium capitalize">
                  {inspection.inspectionType?.replace("_", " ")}
                </p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Inspector</Label>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <p className="font-medium">{inspection.inspectorName}</p>
                </div>
              </div>
            </div>

            {/* Inspector Selfie Section */}
            {inspection.inspectorSelfieUrl && (
              <div className="mt-6 pt-6 border-t">
                <Label className="text-sm text-gray-500 mb-3 block">
                  Inspector Verification
                </Label>
                <div className="flex items-center gap-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
                  <div className="w-16 h-16 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={inspection.inspectorSelfieUrl}
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
                    onClick={() =>
                      window.open(inspection.inspectorSelfieUrl, "_blank")
                    }
                    className="text-teal-600 border-teal-300 hover:bg-teal-50"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Full
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t">
              <div>
                <Label className="text-sm text-gray-500">Created</Label>
                <p className="font-medium">
                  {inspection.createdAt?.toDate?.()?.toLocaleDateString() ||
                    "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Last Updated</Label>
                <p className="font-medium">
                  {inspection.updatedAt?.toDate?.()?.toLocaleDateString() ||
                    "N/A"}
                </p>
              </div>
              {inspection.submittedAt && (
                <div>
                  <Label className="text-sm text-gray-500">Submitted</Label>
                  <p className="font-medium">
                    {inspection.submittedAt?.toDate?.()?.toLocaleDateString()}
                  </p>
                </div>
              )}
              {inspection.location && (
                <div>
                  <Label className="text-sm text-gray-500">Location Recorded</Label>
                  <a 
                    href={`https://maps.google.com/?q=${inspection.location.lat},${inspection.location.lng}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <MapPin className="h-3 w-3" />
                    {inspection.location.lat.toFixed(6)}, {inspection.location.lng.toFixed(6)}
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Student Class Summary */}
        {inspection.classTableData &&
          Object.keys(inspection.classTableData).length > 0 && (
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
                        const row = inspection.classTableData?.[cls];
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
                      {inspection.classTableData?.["_other"] &&
                        (() => {
                          const row = inspection.classTableData["_other"];
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

                        Object.keys(inspection.classTableData || {}).forEach((k) => {
                          const r = inspection.classTableData[k] || {};
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
        {(inspection.inventoryRegistry || inspection.customInventoryFields) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Inventory Registry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {[
                  ...INVENTORY_ITEMS,
                  ...(Array.isArray(inspection.customInventoryFields)
                    ? inspection.customInventoryFields
                    : []),
                ].map((item) => {
                  const val = inspection.inventoryRegistry?.[item.key];
                  const count = inspection.inventoryRegistry?.[`${item.key}_count`];
                  const remark = inspection.inventoryRegistry?.[`${item.key}_remark`];
                  return (
                    <div
                      key={item.key}
                      className="flex flex-col py-2 border-b border-gray-100"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          {item.label}
                        </span>
                        <span className="font-medium text-sm">
                          {val !== undefined && val !== "" ? val : "-"}
                        </span>
                      </div>
                      {(count || remark) && (
                        <div className="flex flex-wrap gap-x-4 mt-0.5 text-xs text-gray-500">
                          {count && <span>Count: {count}</span>}
                          {remark && <span>Remark: {remark}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Forms Sections */}
        {[
          {
            step: "madarsa",
            title: "Madarsa Form",
            icon: Building,
            files: inspection.madarsaFormFiles,
            remarks: inspection.madarsaFormRemarks,
          },
          {
            step: "management",
            title: "Management Form",
            icon: UserCheck,
            files: inspection.managementFormFiles,
            remarks: inspection.managementFormRemarks,
          },
          {
            step: "sadar",
            title: "Sadar Info Form",
            icon: Users,
            files: inspection.sadarFormFiles,
            remarks: inspection.sadarFormRemarks,
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
                {renderFileSection(files, title)}
              </div>

              {/* Remarks Section */}
              <div>
                <Label className="text-base font-semibold mb-2 block">
                  Remarks & Observations
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

        {/* Admin Actions (if reviewed/approved/rejected) */}
        {(inspection.adminRemarks || inspection.reviewedAt) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Administrative Review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inspection.reviewedAt && (
                <div>
                  <Label className="text-sm text-gray-500">Reviewed On</Label>
                  <p className="font-medium">
                    {inspection.reviewedAt?.toDate?.()?.toLocaleDateString()}
                  </p>
                </div>
              )}

              {inspection.reviewedBy && (
                <div>
                  <Label className="text-sm text-gray-500">Reviewed By</Label>
                  <p className="font-medium">{inspection.reviewedBy}</p>
                </div>
              )}

              {inspection.adminRemarks && (
                <div>
                  <Label className="text-sm text-gray-500">Admin Remarks</Label>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {inspection.adminRemarks}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          {inspection.status !== "draft" && (
            <Button
              onClick={downloadPDF}
              disabled={downloadingPdf}
              className="bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {downloadingPdf ? "Generating PDF..." : "Download Report PDF"}
            </Button>
          )}

          {inspection.status === "draft" && (
            <Button asChild>
              <Link
                href={`/dashboard/inspector/inspections/create?draft=${inspection.id}`}
              >
                Continue Editing
              </Link>
            </Button>
          )}

          <Button variant="outline" asChild>
            <Link href="/dashboard/inspector/inspections">
              Back to Inspections
            </Link>
          </Button>
        </div>

        {/* File Preview Modal */}
        <Dialog
          open={previewModal.open}
          onOpenChange={(open) => setPreviewModal({ open, file: null })}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>File Preview</DialogTitle>
              <DialogDescription>{previewModal.file?.name}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              {isImageFile(previewModal.file) ? (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewModal.file?.url}
                    alt={previewModal.file?.name || "Attachment"}
                    className="max-w-full max-h-[70vh] object-contain rounded-md border border-gray-200"
                  />
                </div>
              ) : isPdfFile(previewModal.file) ? (
                <div className="w-full h-[70vh] border border-gray-200 rounded-md overflow-hidden bg-white">
                  <iframe
                    src={previewModal.file?.url}
                    className="w-full h-full"
                    title={previewModal.file?.name || "PDF Preview"}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4 py-8">
                  <FileText className="h-16 w-16 text-red-600" />
                  <p className="text-gray-600">Cannot preview this file type</p>
                </div>
              )}
              {/* Download link always shown below */}
              {previewModal.file?.url && (
                <div className="flex items-center justify-center gap-4 pt-3 border-t border-gray-200">
                  <a
                    href={previewModal.file?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium flex items-center gap-1.5"
                  >
                    <Eye className="h-4 w-4" /> Open Full Screen
                  </a>
                  <span className="text-gray-300">|</span>
                  <a
                    href={previewModal.file?.url}
                    download={previewModal.file?.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium flex items-center gap-1.5"
                  >
                    <Download className="h-4 w-4" /> Download
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
