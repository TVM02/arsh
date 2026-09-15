"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Download,
  Home,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  GraduationCap,
  
  FileText,
} from "lucide-react";


import ProfileImage from "@/components/ProfileImage";



export default function AdmissionConfirmation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const fetchStudentData = async () => {
    const admissionNumber =
      searchParams.get("admissionNumber");

    if (!admissionNumber) {
      router.push("/digital-class");
      return;
    }

    try {
      const cachedData =
        sessionStorage.getItem("admissionData");

      if (cachedData) {
        const parsed = JSON.parse(cachedData);

        if (
          parsed.digitalAdmissionNumber ===
          admissionNumber
        ) {
          setStudentData(parsed);
          setLoading(false);
          return;
        }
      }

      const response = await fetch(
        `/api/digital-classroom/student?digitalAdmissionNumber=${encodeURIComponent(
    admissionNumber
  )}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Admission record not found"
        );
      }

      const data = await response.json();

      setStudentData(data);
    } catch (error) {
      console.error(
        "Error loading digital admission:",
        error
      );

      router.push("/digital-class");
    } finally {
      setLoading(false);
    }
  };

  fetchStudentData();
}, [searchParams, router]);

  // Add print-specific styles
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @page {
        size: A4 portrait;
        margin: 1.5cm 1.5cm 1cm 1.5cm;
      }

      @media print {
        body {
          background: white !important;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* ── Tailwind print-variant utilities explicitly defined ── */
        /* These ensure print:hidden / hidden print:block work      */
        /* regardless of Tailwind's compile/purge order.            */
        .print\\:hidden {
          display: none !important;
        }
        .print\\:block {
          display: block !important;
        }
        .print\\:p-0 {
          padding: 0 !important;
        }
        .print\\:mb-0 {
          margin-bottom: 0 !important;
        }
        .print\\:border-0 {
          border: none !important;
        }
        .print\\:shadow-none {
          box-shadow: none !important;
        }
        .print\\:bg-white {
          background-color: white !important;
        }
        .print\\:max-w-full {
          max-width: 100% !important;
        }

        /* Watermark */
        .print-watermark {
          position: relative;
          background: white;
        }
        .print-watermark::before {
          content: "DKJU";
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 150px;
          font-weight: 900;
          color: rgba(13, 148, 136, 0.03);
          z-index: 0;
          white-space: nowrap;
          pointer-events: none;
        }

        .print-content {
          position: relative;
          z-index: 1;
        }

        /* Receipt header */
        .print-receipt-header {
          border: 3px solid #0f766e;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          background: #f0fdfa !important;
        }

        /* Section containers */
        .print-section {
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 12px;
          background: white !important;
          page-break-inside: avoid;
        }

        .print-section-title {
          font-size: 14px;
          font-weight: 700;
          color: #0f766e;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 2px solid #0f766e;
        }

        .print-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .print-field {
          margin-bottom: 6px;
        }

        .print-field-label {
          font-size: 10px;
          color: #6b7280;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .print-field-value {
          font-size: 12px;
          color: #1f2937;
          font-weight: 600;
          margin-top: 2px;
        }

        /* Footer / stamp area */
        .print-footer {
          margin-top: 20px;
          padding-top: 12px;
          border-top: 2px dashed #9ca3af;
          font-size: 10px;
          color: #6b7280;
        }

        .print-stamp-box {
          border: 2px dashed #9ca3af;
          border-radius: 4px;
          padding: 8px;
          text-align: center;
          font-size: 10px;
          color: #9ca3af;
          min-height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Images */
        img {
          max-width: 100%;
          page-break-inside: avoid;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleGoHome = () => {
    sessionStorage.removeItem("admissionData");
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading confirmation details...</p>
        </div>
      </div>
    );
  }

  if (!studentData) {
    return null;
  }

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 print-watermark print:bg-white">
    

      <div className="container mx-auto px-4 py-8 max-w-4xl print:max-w-full print:p-0 print-content">
        {/* Print Header with DKJU Branding */}
        <div
          className="hidden print:block print-receipt-header"
          style={{ background: "#f0fdfa" }}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1
                className="text-xl font-bold text-teal-800"
                style={{ fontSize: "20px", marginBottom: "4px" }}
              >
                Dakshina Kerala Islam Matha Vidyabhyasa Board
              </h1>
              <p className="text-xs text-gray-700" style={{ fontSize: "11px" }}>
                Admission Confirmation Receipt
              </p>
            </div>
            <div className="text-right">
              <div
                className="text-teal-700 font-bold"
                style={{ fontSize: "24px", lineHeight: "1" }}
              >
                DKJU
              </div>
              <p className="text-xs text-gray-600" style={{ fontSize: "9px" }}>
                Official Document
              </p>
            </div>
          </div>
          <div
            className="flex justify-between items-center mt-3 pt-3"
            style={{ borderTop: "1px solid #d1d5db" }}
          >
            <div>
              <span
                className="text-xs text-gray-600"
                style={{ fontSize: "9px" }}
              >
                Receipt Date:{" "}
              </span>
              <span
                className="text-xs font-semibold"
                style={{ fontSize: "10px" }}
              >
                {formatDate(
                  studentData.submittedAt || new Date().toISOString(),
                )}
              </span>
            </div>
            <div>
              <span
                className="text-xs text-gray-600"
                style={{ fontSize: "9px" }}
              >
                Status:{" "}
              </span>
              <span
  className="text-xs font-semibold text-amber-700"
  style={{ fontSize: "10px" }}
>
  PENDING APPROVAL
</span>
            </div>
          </div>
        </div>

        {/* Success Header */}
        <div className="text-center mb-8 print:mb-4 print:hidden">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
  Application Submitted Successfully!
</h1>

<p className="text-gray-600 text-lg">
  Your Digital Classroom admission request has been submitted
  for Central Admin approval.
</p>
        </div>

        {/* Important Details Card */}
        <Card className="mb-6 border-2 border-teal-500 shadow-lg print:border-0 print:shadow-none print:mb-0">
          <CardContent className="p-6 print:p-0">
            <div className="print:hidden grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Admission Number */}
              <div className="bg-teal-50 p-4 rounded-lg border-2 border-teal-200">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-teal-600" />
                  <p className="text-sm font-medium text-gray-600">
                   Digital Admission Number

                  </p>
                </div>
                <p className="text-2xl font-bold text-teal-800">
                  {studentData.digitalAdmissionNumber}
                </p>
              </div>

              {/* Madrasa ID */}
              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                  <p className="text-sm font-medium text-gray-600">
                    Madrasa ID (MID)
                  </p>
                </div>
                <p className="text-2xl font-bold text-blue-800">
                  {studentData.previousmadarsa}
                </p>
              </div>
            </div>

            {/* Print version - Important Details */}
            <div
              className="hidden print:block print-section"
              style={{ background: "#ccfbf1" }}
            >
              <div className="print-grid">
                <div className="print-field">
                  <div className="print-field-label">Digital Admission Number
</div>
                  <div
                    className="print-field-value"
                    style={{ fontSize: "14px", color: "#0f766e" }}
                  >
                    {studentData.digitalAdmissionNumber}
                  </div>
                </div>
                <div className="print-field">
                  <div className="print-field-label">Madrasa ID (MID)</div>
                  <div
                    className="print-field-value"
                    style={{ fontSize: "14px", color: "#1e40af" }}
                  >
                    {studentData.previousmadarsa}
                  </div>
                  <div className="bg-amber-50 p-4 rounded-lg border-2 border-amber-200">
  <div className="flex items-center gap-2 mb-2">
    <CheckCircle className="h-5 w-5 text-amber-600" />

    <p className="text-sm font-medium text-gray-600">
      Application Status
    </p>
  </div>

  <p className="text-xl font-bold text-amber-700 capitalize">
    {studentData.status || "pending"}
  </p>
</div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded print:hidden">
              <p className="text-sm text-amber-800 font-medium">
                ⚠️ Important: Please save or print this page for your records.
                You will need these details for future reference.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Student Details Card */}
        <Card className="mb-6 shadow-lg print:shadow-none print:mb-0 print:border-0">
          <CardContent className="p-6 print:p-0">
            {/* Screen version */}
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 print:hidden">
              <User className="h-5 w-5 text-teal-600" />
              Student Information
            </h2>

            {/* Print version */}
            <div className="hidden print:block print-section">
              <div className="print-section-title">STUDENT INFORMATION</div>
              <div className="print-grid">
                {studentData.profilePicture && (
                  <div
                    className="print-field"
                    style={{ gridColumn: "1 / 2", gridRow: "1 / 4" }}
                  >
                    <div
                      style={{
                        width: "80px",
                        height: "100px",
                        border: "2px solid #0f766e",
                        borderRadius: "4px",
                        overflow: "hidden",
                      }}
                    >
                      <ProfileImage
                        src={studentData.profilePicture}
                        sourceData={studentData}
                        alt="Student"
                        className="w-full h-full object-cover"
                        fallbackClassName="w-full h-full flex items-center justify-center"
                        iconClassName="h-8 w-8 text-gray-400"
                        showText={false}
                      />
                    </div>
                  </div>
                )}
                <div
                  className="print-field"
                  style={{
                    gridColumn: studentData.profilePicture ? "2 / 3" : "1 / 2",
                  }}
                >
                  <div className="print-field-label">Full Name</div>
                  <div className="print-field-value">
                    {studentData.fullName}
                  </div>
                </div>
                <div className="print-field">
                  <div className="print-field-label">Date of Birth</div>
                  <div className="print-field-value">
                    {formatDate(studentData.dateOfBirth)}
                  </div>
                </div>
                <div className="print-field">
                  <div className="print-field-label">Gender</div>
                  <div className="print-field-value">
                    {studentData.gender || "N/A"}
                  </div>
                </div>
                <div className="print-field">
                  <div className="print-field-label">Class Level</div>
                  <div className="print-field-value">
                    {studentData.class || studentData.classLevel || "N/A"}
                  </div>
                </div>
                {studentData.email && (
                  <div className="print-field" style={{ gridColumn: "1 / -1" }}>
                    <div className="print-field-label">Email</div>
                    <div
                      className="print-field-value"
                      style={{ fontSize: "10px" }}
                    >
                      {studentData.email}
                    </div>
                  </div>
                )}
                {studentData.phone && (
                  <div className="print-field">
                    <div className="print-field-label">Phone</div>
                    <div className="print-field-value">{studentData.phone}</div>
                  </div>
                )}
                {studentData.aadharNumber && (
                  <div className="print-field">
                    <div className="print-field-label">Aadhar Number</div>
                    <div className="print-field-value">
                      {studentData.aadharNumber}
                    </div>
                  </div>
                )}
                {studentData.address && (
                  <div className="print-field" style={{ gridColumn: "1 / -1" }}>
                    <div className="print-field-label">Address</div>
                    <div
                      className="print-field-value"
                      style={{ fontSize: "10px" }}
                    >
                      {studentData.address}
                    </div>
                  </div>
                )}
                {studentData.applyingclass && (
                  <div className="print-field" style={{ gridColumn: "1 / -1" }}>
                    <div className="print-field-label">Applying Class</div>
                    <div
                      className="print-field-value"
                      style={{ fontSize: "10px" }}
                    >
                      {studentData.applyingclass}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
              {/* Profile Picture */}
              {studentData.profilePicture && (
                <div className="flex justify-center md:justify-start">
                  <div className="relative w-40 h-40 border-4 border-teal-200 rounded-lg overflow-hidden">
                    <ProfileImage
                      src={studentData.profilePicture}
                      sourceData={studentData}
                      alt="Student Profile"
                      className="w-full h-full object-cover"
                      fallbackClassName="w-full h-full flex items-center justify-center"
                      iconClassName="h-12 w-12 text-gray-400"
                      showText={false}
                    />
                  </div>
                </div>
              )}

              {/* Student Details */}
              <div
                className={`${
                  studentData.profilePicture ? "md:col-span-2" : "md:col-span-3"
                } grid grid-cols-1 sm:grid-cols-2 gap-4`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    Full Name
                  </p>
                  <p className="font-semibold text-gray-800">
                    {studentData.fullName}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    Date of Birth
                  </p>
                  <p className="font-semibold text-gray-800 flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    {formatDate(studentData.dateOfBirth)}
                  </p>
                </div>

                {studentData.email && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      Email
                    </p>
                    <p className="font-semibold text-gray-800 flex items-center gap-1 break-all">
                      <Mail className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      {studentData.email}
                    </p>
                  </div>
                )}

                {studentData.phone && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      Phone
                    </p>
                    <p className="font-semibold text-gray-800 flex items-center gap-1">
                      <Phone className="h-4 w-4 text-gray-500" />
                      {studentData.phone}
                    </p>
                  </div>
                )}

                {studentData.gender && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      Gender
                    </p>
                    <p className="font-semibold text-gray-800">
                      {studentData.gender}
                    </p>
                  </div>
                )}

                {studentData.applyingclass && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      Applying Class
                    </p>
                    <p className="font-semibold text-gray-800">
                      {studentData.applyingclass}
                    </p>
                  </div>
                )}

                {studentData.address && (
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      Address
                    </p>
                    <p className="font-semibold text-gray-800 flex items-start gap-1">
                      <MapPin className="h-4 w-4 text-gray-500 mt-1 flex-shrink-0" />
                      {studentData.address}
                    </p>
                  </div>
                )}

                {studentData.aadharNumber && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      Aadhar Number
                    </p>
                    <p className="font-semibold text-gray-800">
                      {studentData.aadharNumber}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guardian Details Card - Compact for print */}
        {(studentData.fatherName ||
          studentData.motherName ||
          studentData.guardianPhone) && (
          <Card className="mb-6 shadow-lg print:shadow-none print:mb-0 print:border-0">
            <CardContent className="p-6 print:p-0">
              {/* Screen version */}
              <h2 className="text-xl font-bold text-gray-800 mb-4 print:hidden">
                Guardian Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:hidden">
                {studentData.fatherName && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      Father&apos;s Name
                    </p>
                    <p className="font-semibold text-gray-800">
                      {studentData.fatherName}
                    </p>
                  </div>
                )}

                {studentData.motherName && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      Mother&apos;s Name
                    </p>
                    <p className="font-semibold text-gray-800">
                      {studentData.motherName}
                    </p>
                  </div>
                )}

                {studentData.guardianName && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      Guardian Name
                    </p>
                    <p className="font-semibold text-gray-800">
                      {studentData.guardianName}
                    </p>
                  </div>
                )}

                {studentData.guardianPhone && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      Guardian Phone
                    </p>
                    <p className="font-semibold text-gray-800 flex items-center gap-1">
                      <Phone className="h-4 w-4 text-gray-500" />
                      {studentData.guardianPhone}
                    </p>
                  </div>
                )}

                {studentData.previousEducation && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      Previous Education
                    </p>
                    <p className="font-semibold text-gray-800">
                      {studentData.previousEducation}
                    </p>
                  </div>
                )}
              </div>

              {/* Print version */}
              <div className="hidden print:block print-section">
                <div className="print-section-title">GUARDIAN INFORMATION</div>
                <div className="print-grid">
                  {studentData.fatherName && (
                    <div className="print-field">
                      <div className="print-field-label">
                        Father&apos;s Name
                      </div>
                      <div className="print-field-value">
                        {studentData.fatherName}
                      </div>
                    </div>
                  )}
                  {studentData.motherName && (
                    <div className="print-field">
                      <div className="print-field-label">
                        Mother&apos;s Name
                      </div>
                      <div className="print-field-value">
                        {studentData.motherName}
                      </div>
                    </div>
                  )}
                  {studentData.guardianName && (
                    <div className="print-field">
                      <div className="print-field-label">Guardian Name</div>
                      <div className="print-field-value">
                        {studentData.guardianName}
                      </div>
                    </div>
                  )}
                  {studentData.guardianPhone && (
                    <div className="print-field">
                      <div className="print-field-label">Guardian Phone</div>
                      <div className="print-field-value">
                        {studentData.guardianPhone}
                      </div>
                    </div>
                  )}
                  {studentData.previousEducation && (
                    <div className="print-field">
                      <div className="print-field-label">
                        Previous Education
                      </div>
                      <div className="print-field-value">
                        {studentData.previousEducation}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        

        {/* Print Footer */}
        <div className="hidden print:block print-footer">
          <div className="flex justify-between items-start mb-3">
            <div className="text-left" style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  marginBottom: "4px",
                }}
              >
                Authorized Signature
              </div>
              <div
                className="print-stamp-box"
                style={{ width: "150px", height: "60px" }}
              >
                <span>Signature</span>
              </div>
            </div>
            <div className="text-center" style={{ flex: 1, padding: "0 20px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  marginBottom: "4px",
                }}
              >
                Official Stamp
              </div>
              <div
                className="print-stamp-box"
                style={{ width: "100px", height: "60px", margin: "0 auto" }}
              >
                <span>DKJU SEAL</span>
              </div>
            </div>
            <div className="text-right" style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  marginBottom: "4px",
                }}
              >
                Date
              </div>
              <div
                className="print-stamp-box"
                style={{ width: "120px", height: "60px", marginLeft: "auto" }}
              >
                <span>{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div
            style={{
              borderTop: "1px solid #d1d5db",
              paddingTop: "8px",
              marginTop: "8px",
            }}
          >
            <p style={{ margin: "4px 0", fontSize: "9px" }}>
              <strong>Note:</strong> This is an official admission confirmation
              receipt. Please keep it safe for future reference.
            </p>
            <p style={{ margin: "4px 0", fontSize: "9px" }}>
              For queries, contact: info@dkju.edu | Phone: +91-8891177850
            </p>
            <p style={{ margin: "4px 0", fontSize: "8px", color: "#9ca3af" }}>
              Generated on: {new Date().toLocaleString()} | Document ID:{" "}
              {studentData.digitalAdmissionNumber}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center print:hidden">
          <Button
            onClick={handlePrint}
            size="lg"
            variant="outline"
            className="border-teal-600 text-teal-600 hover:bg-teal-50"
          >
            <Download className="h-5 w-5 mr-2" />
            Print / Save as PDF
          </Button>

          <Button
            onClick={handleGoHome}
            size="lg"
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Home className="h-5 w-5 mr-2" />
            Back to Home
          </Button>
        </div>

        {/* Print Instructions */}
        <div className="mt-6 text-center text-sm text-gray-500 print:hidden">
          <p>
            To save as PDF: Click &quot;Print / Save as PDF&quot; and select
            &quot;Save as PDF&quot; as your printer
          </p>
        </div>
      </div>

      
    </div>
  );
}
