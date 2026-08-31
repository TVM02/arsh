"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/authUtils";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Download,
  User,
  BookOpen,
  School,
  Phone,
  Mail,
  Award,
  FileText,
  Printer,
  Calendar,
  CheckCircle,
  AlertCircle,
  Trophy,
  Star,
  FileDown,
} from "lucide-react";
import {
  getDocuments,
  updateDocument,
  COLLECTIONS,
} from "@/lib/firestoreService";
import { orderBy, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";

// Helper function to format dates
const formatDate = (dateValue) => {
  if (!dateValue) return "Not available";

  try {
    if (dateValue && typeof dateValue.toDate === "function") {
      return dateValue.toDate().toLocaleDateString();
    }

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return "Invalid date";
    }

    return date.toLocaleDateString();
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Date error";
  }
};

// Calculate result status based on marks
const calculateResult = (marks, subjects) => {
  if (!marks || !subjects || subjects.length === 0) {
    return {
      status: "pending",
      percentage: 0,
      grade: "N/A",
      totalMarks: 0,
      obtainedMarks: 0,
    };
  }

  let totalMaxMarks = 0;
  let totalObtainedMarks = 0;
  let failed = false;

  subjects.forEach((subject) => {
    const mark = parseInt(marks[subject.id]) || 0;
    const maxMark = subject.maxMarks || 100;
    const passingMark = Math.ceil(maxMark * 0.33); // 33% passing criteria

    totalMaxMarks += maxMark;
    totalObtainedMarks += mark;

    if (mark < passingMark) {
      failed = true;
    }
  });

  const percentage =
    totalMaxMarks > 0
      ? ((totalObtainedMarks / totalMaxMarks) * 100).toFixed(2)
      : 0;

  let grade = "F";
  if (!failed) {
    if (percentage >= 90) grade = "A+";
    else if (percentage >= 80) grade = "A";
    else if (percentage >= 70) grade = "B+";
    else if (percentage >= 60) grade = "B";
    else if (percentage >= 50) grade = "C+";
    else if (percentage >= 40) grade = "C";
    else if (percentage >= 33) grade = "D";
  }

  return {
    status: failed ? "failed" : "passed",
    percentage: parseFloat(percentage),
    grade,
    totalMarks: totalMaxMarks,
    obtainedMarks: totalObtainedMarks,
  };
};

export default function Certificates() {
  const { user, role } = useAuth();
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  // Data States
  const [examRegistrations, setExamRegistrations] = useState([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState([]);
  const [studentDetails, setStudentDetails] = useState({});
  const [exams, setExams] = useState([]);
  const [madrasas, setMadrasas] = useState([]);
  const [examMarks, setExamMarks] = useState({});
  const [publishedResults, setPublishedResults] = useState({});

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExam, setSelectedExam] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedMadrasa, setSelectedMadrasa] = useState("all");
  const [resultStatus, setResultStatus] = useState("all"); // all, passed, failed
  const [certificateStatus, setCertificateStatus] = useState("all"); // all, generated, pending

  // Fetch all exam registrations for eligible classes
  const fetchExamRegistrations = useCallback(async () => {
    try {
      // Eligible classes for certificates (5th, 7th, 10th, 12th)
      const eligibleClasses = ["5", "7", "10", "12"];

      // Fetch only paid registrations directly from DB
      const registrationsQuery = query(
        collection(db, COLLECTIONS.EXAM_REGISTRATIONS),
        where("paymentStatus", "==", "completed")
      );
      const registrationsSnapshot = await getDocs(registrationsQuery);
      const paidRegistrations = registrationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort client-side to avoid requiring a composite index
      paidRegistrations.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      setExamRegistrations(paidRegistrations);

      // Fetch student details in parallel batches of 30
      const studentIds = [
        ...new Set(paidRegistrations.map((r) => r.studentId)),
      ].filter(Boolean);
      const studentDetailsMap = {};

      const batchSize = 30;
      const studentBatches = [];
      for (let i = 0; i < studentIds.length; i += batchSize) {
        studentBatches.push(studentIds.slice(i, i + batchSize));
      }

      await Promise.all(
        studentBatches.map(async (batch) => {
          try {
            const studentQuery = query(
              collection(db, "students"),
              where("uid", "in", batch)
            );
            const studentSnapshot = await getDocs(studentQuery);
            studentSnapshot.docs.forEach((doc) => {
              const studentData = doc.data();
              // Only include students from eligible classes
              if (eligibleClasses.includes(studentData.classLevel)) {
                studentDetailsMap[studentData.uid] = studentData;
              }
            });
          } catch (error) {
            console.error("Error fetching student batch:", error);
          }
        })
      );

      setStudentDetails(studentDetailsMap);

      // Filter registrations to only include eligible students
      const eligibleRegistrations = paidRegistrations.filter(
        (registration) => studentDetailsMap[registration.studentId],
      );

      setExamRegistrations(eligibleRegistrations);
      setFilteredRegistrations(eligibleRegistrations);
    } catch (error) {
      console.error("Error fetching exam registrations:", error);
      setError("Failed to fetch registrations");
    }
  }, []);

  // Fetch exams
  const fetchExams = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      const fetchedExams = await getDocuments(COLLECTIONS.EXAMS, constraints);
      setExams(fetchedExams);
    } catch (error) {
      console.error("Error fetching exams:", error);
    }
  }, []);

  // Fetch madrasas
  const fetchMadrasas = useCallback(async () => {
    try {
      const madrasaQuery = query(collection(db, "madrasas"));
      const madrasaSnapshot = await getDocs(madrasaQuery);
      const madrasaList = madrasaSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMadrasas(madrasaList);
    } catch (error) {
      console.error("Error fetching madrasas:", error);
    }
  }, []);

  // Fetch exam marks
  const fetchExamMarks = useCallback(async () => {
    try {
      const marksQuery = query(
        collection(db, "exammarks"),
        where("status", "==", "saved"), // Only final saved marks
      );
      const marksSnapshot = await getDocs(marksQuery);
      const marksMap = {};

      marksSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const key = `${data.studentId}_${data.examId}`;
        marksMap[key] = { id: doc.id, ...data };
      });

      setExamMarks(marksMap);
    } catch (error) {
      console.error("Error fetching exam marks:", error);
    }
  }, []);

  // Fetch published results
  const fetchPublishedResults = useCallback(async () => {
    try {
      const resultsQuery = query(collection(db, COLLECTIONS.PUBLISHED_RESULTS));
      const resultsSnapshot = await getDocs(resultsQuery);
      const resultsMap = {};

      resultsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const key = `${data.studentId}_${data.examId}`;
        resultsMap[key] = { id: doc.id, ...data };
      });

      setPublishedResults(resultsMap);
    } catch (error) {
      console.error("Error fetching published results:", error);
    }
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      await Promise.all([
        fetchExamRegistrations(),
        fetchExams(),
        fetchMadrasas(),
        fetchExamMarks(),
        fetchPublishedResults(),
      ]);
      setLoading(false);
    };

    fetchAllData();
  }, [
    fetchExamRegistrations,
    fetchExams,
    fetchMadrasas,
    fetchExamMarks,
    fetchPublishedResults,
  ]);

  // Filter registrations
  useEffect(() => {
    let filtered = examRegistrations;

    // First filter: Only show students with published results
    filtered = filtered.filter((registration) => {
      const key = `${registration.studentId}_${registration.examId}`;
      return publishedResults[key]; // Only include if result is published
    });

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((registration) => {
        const student = studentDetails[registration.studentId];
        const searchLower = searchTerm.toLowerCase();
        return (
          registration.studentName?.toLowerCase().includes(searchLower) ||
          registration.studentEmail?.toLowerCase().includes(searchLower) ||
          registration.hallTicketNumber?.toLowerCase().includes(searchLower) ||
          student?.fullName?.toLowerCase().includes(searchLower) ||
          student?.email?.toLowerCase().includes(searchLower) ||
          student?.admissionNumber?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Exam filter
    if (selectedExam !== "all") {
      filtered = filtered.filter(
        (registration) => registration.examId === selectedExam,
      );
    }

    // Class filter
    if (selectedClass !== "all") {
      filtered = filtered.filter((registration) => {
        const student = studentDetails[registration.studentId];
        return student?.classLevel === selectedClass;
      });
    }

    // Madrasa filter
    if (selectedMadrasa !== "all") {
      filtered = filtered.filter((registration) => {
        const student = studentDetails[registration.studentId];
        return (
          student?.madarsaId === selectedMadrasa ||
          registration.madarsaId === selectedMadrasa
        );
      });
    }

    // Result status filter
    if (resultStatus !== "all") {
      filtered = filtered.filter((registration) => {
        const key = `${registration.studentId}_${registration.examId}`;
        const marks = examMarks[key];
        if (!marks) return false;

        const result = calculateResult(marks.marks, marks.subjects);
        return result.status === resultStatus;
      });
    }

    // Certificate status filter
    if (certificateStatus !== "all") {
      if (certificateStatus === "generated") {
        filtered = filtered.filter(
          (registration) => registration.certificateNumber,
        );
      } else if (certificateStatus === "pending") {
        filtered = filtered.filter((registration) => {
          const key = `${registration.studentId}_${registration.examId}`;
          const marks = examMarks[key];
          const result = marks
            ? calculateResult(marks.marks, marks.subjects)
            : null;
          return !registration.certificateNumber && result?.status === "passed";
        });
      }
    }

    setFilteredRegistrations(filtered);
  }, [
    examRegistrations,
    studentDetails,
    searchTerm,
    selectedExam,
    selectedClass,
    selectedMadrasa,
    resultStatus,
    certificateStatus,
    examMarks,
    publishedResults,
  ]);

  // Generate certificate number
  const generateCertificateNumber = (examId, studentId, classLevel) => {
    const year = new Date().getFullYear();
    const classCode = classLevel
      ? classLevel.toString().padStart(2, "0")
      : "00";
    const examCode = examId ? examId.substring(0, 4).toUpperCase() : "CERT";
    const studentCode = studentId
      ? studentId.substring(0, 6).toUpperCase()
      : "STU000";

    return `CERT${year}${classCode}${examCode}${studentCode}`;
  };

  // Generate certificate for single student
  const generateSingleCertificate = async (registration) => {
    try {
      const student = studentDetails[registration.studentId];
      const key = `${registration.studentId}_${registration.examId}`;
      const marks = examMarks[key];

      if (!student || !marks) {
        alert("Student details or marks not found");
        return;
      }

      const result = calculateResult(marks.marks, marks.subjects);

      if (result.status !== "passed") {
        alert("Certificate can only be generated for passed students");
        return;
      }

      const certificateNumber = generateCertificateNumber(
        registration.examId,
        registration.studentId,
        student.classLevel,
      );

      await updateDocument(COLLECTIONS.EXAM_REGISTRATIONS, registration.id, {
        certificateNumber,
        certificateGeneratedAt: new Date(),
        result: result,
      });

      // Update local state
      setExamRegistrations((prev) =>
        prev.map((reg) =>
          reg.id === registration.id
            ? {
                ...reg,
                certificateNumber,
                certificateGeneratedAt: new Date(),
                result,
              }
            : reg,
        ),
      );

      alert("Certificate generated successfully!");
    } catch (error) {
      console.error("Error generating certificate:", error);
      alert("Failed to generate certificate");
    }
  };

  // Generate certificates in bulk
  const generateBulkCertificates = async () => {
    const eligibleForCertificate = filteredRegistrations.filter((reg) => {
      const key = `${reg.studentId}_${reg.examId}`;
      const marks = examMarks[key];
      const result = marks
        ? calculateResult(marks.marks, marks.subjects)
        : null;
      return !reg.certificateNumber && result?.status === "passed";
    });

    if (eligibleForCertificate.length === 0) {
      alert("No passed students found without certificates");
      return;
    }

    if (
      !confirm(
        `Generate certificates for ${eligibleForCertificate.length} passed students?`,
      )
    ) {
      return;
    }

    setGenerating(true);
    try {
      const updates = [];

      for (const registration of eligibleForCertificate) {
        const student = studentDetails[registration.studentId];
        const key = `${registration.studentId}_${registration.examId}`;
        const marks = examMarks[key];

        if (student && marks) {
          const result = calculateResult(marks.marks, marks.subjects);
          const certificateNumber = generateCertificateNumber(
            registration.examId,
            registration.studentId,
            student.classLevel,
          );

          updates.push({
            id: registration.id,
            certificateNumber,
            certificateGeneratedAt: new Date(),
            result,
          });
        }
      }

      // Update in batches
      for (const update of updates) {
        await updateDocument(COLLECTIONS.EXAM_REGISTRATIONS, update.id, {
          certificateNumber: update.certificateNumber,
          certificateGeneratedAt: update.certificateGeneratedAt,
          result: update.result,
        });
      }

      // Update local state
      setExamRegistrations((prev) =>
        prev.map((reg) => {
          const update = updates.find((u) => u.id === reg.id);
          return update ? { ...reg, ...update } : reg;
        }),
      );

      alert(`Successfully generated ${updates.length} certificates!`);
    } catch (error) {
      console.error("Error generating bulk certificates:", error);
      alert("Failed to generate certificates");
    } finally {
      setGenerating(false);
    }
  };

  // Helper to generate premium Certificate HTML matching the exact design of Image 1
  const getCertificateHTML = (registration, student, exam, result, origin) => {
    const studentName = registration.studentName || student?.fullName || "Student Name";
    const classVal = student?.classLevel || registration?.classLevel || "";
    const certId = registration.certificateNumber || "DKJU-2026-000001";
    const bgUrl = `${origin}/certificate_bg.png`;
    const logoUrl = `${origin}/logo.png`;

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Certificate - ${certId}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Montserrat:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      @page {
        size: A4 landscape;
        margin: 0;
      }
      html, body {
        margin: 0;
        padding: 0;
        width: 297mm;
        height: 210mm;
        background-color: #ffffff;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      @media screen {
        body {
          background-color: #e0e0e0;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
          box-sizing: border-box;
        }
        .certificate-container {
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
          border-radius: 4px;
        }
      }
      .certificate-container {
        width: 297mm;
        height: 210mm;
        position: relative;
        background-image: url('${bgUrl}');
        background-size: 100% 100%;
        background-repeat: no-repeat;
        background-position: center;
        box-sizing: border-box;
        overflow: hidden;
      }

      /* Certificate ID */
      .certificate-id {
        position: absolute;
        top: 7.8%;
        right: 9.8%;
        font-family: 'Montserrat', sans-serif;
        font-size: 11.5px;
        color: #333333;
        font-weight: 500;
        letter-spacing: 0.5px;
      }
      .certificate-id span {
        color: #0d6e64;
        font-weight: 700;
      }

      /* Logo Section */
      .logo-section {
        position: absolute;
        top: 4.8%;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 10;
      }
      .logo-img {
        height: 52px;
        width: auto;
        object-fit: contain;
      }
      .logo-text-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        text-align: left;
      }
      .logo-title {
        font-family: 'Montserrat', sans-serif;
        font-size: 32px;
        font-weight: 800;
        color: #111111;
        line-height: 0.95;
        letter-spacing: 2px;
      }
      .logo-subtitle {
        font-family: 'Montserrat', sans-serif;
        font-size: 10.5px;
        font-weight: 600;
        color: #555555;
        letter-spacing: 0.8px;
        margin-top: 2px;
      }

      /* Title Section */
      .certificate-title-section {
        position: absolute;
        top: 20%;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        width: 80%;
      }
      .title-main {
        font-family: 'Cinzel', serif;
        font-size: 52px;
        font-weight: 700;
        color: #0b4c42;
        letter-spacing: 8px;
        line-height: 1;
        margin: 0;
      }
      .title-sub {
        font-family: 'Montserrat', sans-serif;
        font-size: 16.5px;
        font-weight: 600;
        color: #0b4c42;
        letter-spacing: 6px;
        margin: 4px 0 0 0;
        text-transform: uppercase;
      }

      /* Student & Certification Text Block */
      .student-cert-block {
        position: absolute;
        top: 37.5%;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        width: 65%;
      }
      .certify-text {
        font-family: 'Playfair Display', serif;
        font-size: 17px;
        font-style: italic;
        color: #333333;
        margin: 0 0 8px 0;
      }
      .student-name {
        font-family: 'Montserrat', sans-serif;
        font-size: 42px;
        font-weight: 800;
        color: #0b4c42;
        letter-spacing: 1.5px;
        margin: 8px 0 12px 0;
        text-transform: uppercase;
        display: inline-block;
      }
      .completion-text {
        font-family: 'Montserrat', sans-serif;
        font-size: 14.5px;
        font-weight: 600;
        color: #333333;
        margin: 0 auto 14px auto;
        letter-spacing: 0.2px;
      }
      .completion-text span {
        font-weight: 700;
      }

      /* Teal Badge */
      .board-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background-color: #0b4c42;
        color: #ffffff;
        padding: 7px 20px;
        border-radius: 50px;
        font-family: 'Montserrat', sans-serif;
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.8px;
        margin: 0 auto 12px auto;
        text-transform: uppercase;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .badge-logo {
        width: 15px;
        height: 15px;
        filter: brightness(0) invert(1);
      }

      /* Dedication & Blessing Text */
      .dedication-text {
        font-family: 'Playfair Display', serif;
        font-size: 14.5px;
        font-style: italic;
        color: #333333;
        line-height: 1.45;
        margin: 0 0 4px 0;
        letter-spacing: 0.1px;
      }
      .blessing-text {
        font-family: 'Playfair Display', serif;
        font-size: 14px;
        font-style: italic;
        color: #0b4c42;
        font-weight: 700;
        margin: 4px 0 0 0;
        letter-spacing: 0.2px;
      }

      /* Seal inside Left Ribbon */
      .seal-section {
        position: absolute;
        left: 10.3%;
        top: 36.8%;
        width: 12.5%;
        height: 17%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        z-index: 20;
      }
      .seal-pass {
        font-family: 'Cinzel', serif;
        font-size: 28px;
        font-weight: 800;
        color: #0b4c42;
        line-height: 0.95;
        letter-spacing: 1px;
        margin: 0 0 1px 0;
      }
      .seal-congrats {
        font-family: 'Montserrat', sans-serif;
        font-size: 7.2px;
        font-weight: 700;
        color: #0b4c42;
        letter-spacing: 0.5px;
        line-height: 1;
        margin: 0 0 5px 0;
        text-transform: uppercase;
      }
      .seal-class {
        font-family: 'Montserrat', sans-serif;
        font-size: 12px;
        font-weight: 800;
        color: #0b4c42;
        line-height: 1;
        letter-spacing: 0.3px;
        margin: 0 0 5px 0;
        text-transform: uppercase;
      }
      .seal-dkju {
        font-family: 'Montserrat', sans-serif;
        font-size: 10.5px;
        font-weight: 700;
        color: #d4a373;
        line-height: 1;
        letter-spacing: 0.5px;
        margin: 0;
        text-transform: uppercase;
      }

      /* Signatory Section */
      .signatory-section {
        position: absolute;
        right: 9.8%;
        bottom: 14.5%;
        text-align: center;
        width: 20%;
        z-index: 15;
      }
      .sig-title {
        font-family: 'Playfair Display', serif;
        font-size: 13.5px;
        font-weight: 700;
        color: #0b4c42;
        margin: 0 0 3px 0;
      }
      .sig-sub {
        font-family: 'Playfair Display', serif;
        font-size: 11px;
        color: #0b4c42;
        line-height: 1.35;
        margin: 0;
      }

      /* Footer Elements */
      .footer-left {
        position: absolute;
        left: 9.8%;
        bottom: 4.8%;
        display: flex;
        align-items: center;
        gap: 6px;
        color: #ffffff;
        font-family: 'Montserrat', sans-serif;
        font-size: 11px;
        font-weight: 500;
        text-decoration: none;
        z-index: 15;
      }
      .footer-left svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
      .footer-right {
        position: absolute;
        right: 9.8%;
        bottom: 4.8%;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #ffffff;
        font-family: 'Montserrat', sans-serif;
        font-size: 11px;
        font-weight: 500;
        z-index: 15;
      }
      .social-icons {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .social-icon-circle {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background-color: #ffffff;
        color: #0b4c42;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .social-icon-circle svg {
        width: 10px;
        height: 10px;
        fill: currentColor;
      }
    </style>
  </head>
  <body>
    <div class="certificate-container">
      <!-- Top Right Certificate ID -->
      <div class="certificate-id">Certificate ID: <span>${certId}</span></div>

      <!-- Top Center Logo -->
      <div class="logo-section">
        <img class="logo-img" src="${logoUrl}" alt="DKJU Logo" />
        <div class="logo-text-container">
          <div class="logo-title">DKJU</div>
          <div class="logo-subtitle">Smart Islamic Education</div>
        </div>
      </div>

      <!-- Title: Certificate of Achievement -->
      <div class="certificate-title-section">
        <h1 class="title-main">CERTIFICATE</h1>
        <h2 class="title-sub">of achievement</h2>
      </div>

      <!-- Left Ribbon Seal Info -->
      <div class="seal-section">
        <div class="seal-pass">PASS</div>
        <div class="seal-congrats">CONGRATULATIONS</div>
        <div class="seal-class">CLASS ${classVal}</div>
        <div class="seal-dkju">DKJU</div>
      </div>

      <!-- Center Dynamic and Static Content -->
      <div class="student-cert-block">
        <div class="certify-text">This is to certify that</div>
        <div class="student-name">${studentName}</div>
        
        <div class="completion-text">
          has successfully completed <span>Class ${classVal} of Madrasa Educataion.</span>
        </div>

        <div class="board-badge">
          <img class="badge-logo" src="${logoUrl}" alt="DKJU Logo" />
          Dakshina Kerala Islam Matha Vidyabhyasa Board
        </div>

        <div class="dedication-text">
          In recognition of the dedication, hard work, and commitment
          to the pursuit of Islamic knowledge and values.
        </div>
        <div class="blessing-text">
          May Allah ﷻ grant success in his life and the hereafter.
        </div>
      </div>

      <!-- Bottom Right Signatures -->
      <div class="signatory-section">
        <div class="sig-title">Authorized Signatory</div>
        <div class="sig-sub">Dakshina Kerala Islam Matha<br>Vidyabhyasa Board</div>
      </div>

      <!-- Bottom Links and Handles -->
      <a class="footer-left" href="https://www.dkju.in" target="_blank">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"></circle>
          <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" stroke-width="2" fill="none"></path>
        </svg>
        www.dkju.in
      </a>

      <div class="footer-right">
        <div class="social-icons">
          <!-- Facebook -->
          <div class="social-icon-circle">
            <svg viewBox="0 0 24 24">
              <path d="M9 8H7v3h2v9h3v-9h2.72l.42-3H12V6c0-.9.27-1.5 1.5-1.5H15V2.05c-.38-.05-1.68-.15-3.2-.15C8.63 1.9 6 3.84 6 7.42V8H9z"/>
            </svg>
          </div>
          <!-- Instagram -->
          <div class="social-icon-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
          </div>
          <!-- YouTube -->
          <div class="social-icon-circle">
            <svg viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
        </div>
        /dkjuofficial
      </div>
    </div>
  </body>
</html>`;
  };

  // Print certificate
  const printCertificate = (registration) => {
    const student = studentDetails[registration.studentId];
    const exam = exams.find((e) => e.id === registration.examId);
    const key = `${registration.studentId}_${registration.examId}`;
    const marks = examMarks[key];

    if (!registration.certificateNumber) {
      alert("Certificate not generated yet");
      return;
    }

    const result =
      registration.result ||
      (marks ? calculateResult(marks.marks, marks.subjects) : null);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const certificateHTML = getCertificateHTML(registration, student, exam, result, origin);

    const printWindow = window.open("", "_blank");
    printWindow.document.write(certificateHTML);
    printWindow.document.close();
    printWindow.focus();

    // Allow images and fonts to load
    setTimeout(() => {
      printWindow.print();
    }, 1000);
  };

  // Download certificate as PDF
  const downloadCertificatePDF = (registration) => {
    const student = studentDetails[registration.studentId];
    const exam = exams.find((e) => e.id === registration.examId);
    const key = `${registration.studentId}_${registration.examId}`;
    const publishedResult = publishedResults[key];

    if (!registration.certificateNumber) {
      alert("Certificate not generated yet");
      return;
    }

    const result = publishedResult?.result || registration.result;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const certificateHTML = getCertificateHTML(registration, student, exam, result, origin);

    // Create blob and download
    const blob = new Blob([certificateHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Certificate-${registration.certificateNumber}-${registration.studentName || student?.fullName || "Student"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download certificates list
  const downloadCertificatesList = () => {
    const generatedCertificates = filteredRegistrations.filter(
      (reg) => reg.certificateNumber,
    );

    if (generatedCertificates.length === 0) {
      alert("No certificates generated yet");
      return;
    }

    const headers = [
      "Certificate Number",
      "Student Name",
      "Class",
      "Madrasa",
      "Exam Title",
      "Grade",
      "Percentage",
      "Status",
      "Generated Date",
    ];

    const csvData = generatedCertificates.map((registration) => {
      const student = studentDetails[registration.studentId] || {};
      const exam = exams.find((e) => e.id === registration.examId);
      const key = `${registration.studentId}_${registration.examId}`;
      const marks = examMarks[key];
      const result =
        registration.result ||
        (marks ? calculateResult(marks.marks, marks.subjects) : null);

      return [
        registration.certificateNumber || "",
        registration.studentName || student.fullName || "",
        student.classLevel || "",
        student.madarsaId || registration.madarsaId || "",
        exam?.title || "",
        result?.grade || "",
        result?.percentage || "",
        result?.status || "",
        registration.certificateGeneratedAt
          ? formatDate(registration.certificateGeneratedAt)
          : "",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.map((field) => `"${field}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `certificates_list_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = {
    total: filteredRegistrations.length,
    passed: filteredRegistrations.filter((reg) => {
      const key = `${reg.studentId}_${reg.examId}`;
      const publishedResult = publishedResults[key];
      return publishedResult?.result?.status === "passed";
    }).length,
    certificatesGenerated: filteredRegistrations.filter(
      (reg) => reg.certificateNumber,
    ).length,
    pending: filteredRegistrations.filter((reg) => {
      const key = `${reg.studentId}_${reg.examId}`;
      const publishedResult = publishedResults[key];
      return (
        !reg.certificateNumber && publishedResult?.result?.status === "passed"
      );
    }).length,
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading certificates data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Certificates Generation
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Generate certificates for passed students with published results
            only (Classes 5th, 7th, 10th, and 12th)
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Total Students
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {stats.total}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Passed Students
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {stats.passed}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <Award className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Certificates Generated
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {stats.certificatesGenerated}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Pending Certificates
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {stats.pending}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions and Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg sm:text-xl">
                Certificates Management
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={generateBulkCertificates}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={stats.pending === 0 || generating}
                  size="sm"
                >
                  <Award className="h-4 w-4 mr-2" />
                  {generating
                    ? "Generating..."
                    : `Generate Bulk (${stats.pending})`}
                </Button>
                <Button
                  onClick={downloadCertificatesList}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={stats.certificatesGenerated === 0}
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download List
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="search" className="text-sm">
                  Search Students
                </Label>
                <Input
                  id="search"
                  placeholder="Name, email, certificate..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="exam-filter" className="text-sm">
                  Filter by Exam
                </Label>
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select exam" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Exams</SelectItem>
                    {exams.map((exam) => (
                      <SelectItem key={exam.id} value={exam.id}>
                        {exam.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="class-filter" className="text-sm">
                  Filter by Class
                </Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Classes</SelectItem>
                    <SelectItem value="5">Class 5th</SelectItem>
                    <SelectItem value="7">Class 7th</SelectItem>
                    <SelectItem value="10">Class 10th</SelectItem>
                    <SelectItem value="12">Class 12th</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="madrasa-filter" className="text-sm">
                  Filter by Madrasa
                </Label>
                <Select
                  value={selectedMadrasa}
                  onValueChange={setSelectedMadrasa}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select madrasa" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Madrasas</SelectItem>
                    {madrasas.map((madrasa) => (
                      <SelectItem key={madrasa.id} value={madrasa.id}>
                        {madrasa.name || madrasa.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="result-filter" className="text-sm">
                  Result Status
                </Label>
                <Select value={resultStatus} onValueChange={setResultStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select result" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Results</SelectItem>
                    <SelectItem value="passed">Passed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="certificate-filter" className="text-sm">
                  Certificate Status
                </Label>
                <Select
                  value={certificateStatus}
                  onValueChange={setCertificateStatus}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="generated">Generated</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Students List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Students for Certificates ({filteredRegistrations.length})
            </CardTitle>
            <CardDescription>
              Students from eligible classes (5th, 7th, 10th, 12th) with
              published results only
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredRegistrations.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  No students found for certificate generation
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRegistrations.map((registration) => {
                  const exam = exams.find((e) => e.id === registration.examId);
                  const student = studentDetails[registration.studentId] || {};
                  const key = `${registration.studentId}_${registration.examId}`;
                  const marks = examMarks[key];
                  const publishedResult = publishedResults[key];
                  const result =
                    publishedResult?.result ||
                    registration.result ||
                    (marks
                      ? calculateResult(marks.marks, marks.subjects)
                      : null);

                  return (
                    <div
                      key={registration.id}
                      className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                            <h4 className="font-semibold text-base sm:text-lg truncate">
                              {registration.studentName || student.fullName}
                            </h4>
                            <div className="flex gap-2">
                              <Badge
                                variant="outline"
                                className="border-blue-500 text-blue-700"
                              >
                                Class{" "}
                                {String(
                                  student.classLevel || "",
                                ).toUpperCase() === "UKG"
                                  ? "Ukg"
                                  : student.classLevel}
                              </Badge>
                              {result ? (
                                result.status === "passed" ? (
                                  <Badge
                                    variant="default"
                                    className="bg-green-600"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Passed ({result.grade})
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Failed
                                  </Badge>
                                )
                              ) : (
                                <Badge variant="secondary">
                                  Result Pending
                                </Badge>
                              )}
                              {registration.certificateNumber && (
                                <Badge
                                  variant="default"
                                  className="bg-purple-600"
                                >
                                  <Award className="h-3 w-3 mr-1" />
                                  Certificate Generated
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                              {registration.certificateNumber && (
                                <p className="flex items-center gap-1">
                                  <Award className="h-3 w-3" />
                                  <strong>Certificate:</strong>{" "}
                                  {registration.certificateNumber}
                                </p>
                              )}
                              {result && (
                                <>
                                  <p className="flex items-center gap-1">
                                    <Star className="h-3 w-3" />
                                    <strong>Grade:</strong> {result.grade}
                                  </p>
                                  <p className="flex items-center gap-1">
                                    <Trophy className="h-3 w-3" />
                                    <strong>Percentage:</strong>{" "}
                                    {result.percentage}%
                                  </p>
                                </>
                              )}
                              <p className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                <strong>Email:</strong>{" "}
                                {registration.studentEmail || student.email}
                              </p>
                              <p className="flex items-center gap-1">
                                <School className="h-3 w-3" />
                                <strong>Madrasa:</strong>{" "}
                                {student.madarsaId || registration.madarsaId}
                              </p>
                              {student.admissionNumber && (
                                <p className="flex items-center gap-1">
                                  <BookOpen className="h-3 w-3" />
                                  <strong>Admission:</strong>{" "}
                                  {student.admissionNumber}
                                </p>
                              )}
                            </div>
                            <p>
                              <strong>Exam:</strong>{" "}
                              {exam?.title || "Unknown Exam"}
                            </p>
                            {registration.certificateGeneratedAt && (
                              <p>
                                <strong>Certificate Generated:</strong>{" "}
                                {formatDate(
                                  registration.certificateGeneratedAt,
                                )}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 flex-shrink-0">
                          {result?.status === "passed" &&
                            !registration.certificateNumber && (
                              <Button
                                onClick={() =>
                                  generateSingleCertificate(registration)
                                }
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Award className="h-4 w-4 mr-2" />
                                Generate
                              </Button>
                            )}
                          {registration.certificateNumber && (
                            <>
                              <Button
                                onClick={() => printCertificate(registration)}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <Printer className="h-4 w-4 mr-2" />
                                Print
                              </Button>
                              <Button
                                onClick={() =>
                                  downloadCertificatePDF(registration)
                                }
                                size="sm"
                                variant="outline"
                                className="border-green-500 text-green-700 hover:bg-green-50"
                              >
                                <FileDown className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
