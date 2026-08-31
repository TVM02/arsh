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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  UserCheck,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  BookOpen,
  Image as ImageIcon,
  IndianRupee,
  Download,
  Printer,
} from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getDocuments, COLLECTIONS } from "@/lib/firestoreService";
import { where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, doc, getDoc } from "firebase/firestore";
import useAuthStore from "@/lib/authStore";
import HallTicket from "@/components/HallTicket";
import { getOrCreateHallTicketNumber } from "@/lib/hallTicketService";
import {
  generateHallTicketHTML,
  generateHallTicketPDFBlob,
} from "@/lib/hallTicketUtils";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { PDFDocument } from "pdf-lib";
import { fetchHallTicketData } from "@/lib/examDetailQueries";
import { formatDate } from "@/lib/dateUtils";
import { authFetch } from "@/lib/authFetch";

// Helper function to get status badge
const getStatusBadge = (status) => {
  switch (status) {
    case "registered":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
  }
};

const fetchStudentMadarsaDetails = async (madarsaId) => {
  if (!madarsaId) return null;

  const response = await authFetch(
    `/api/student/madarsa-details?madarsaId=${encodeURIComponent(madarsaId)}`,
    { cache: "no-store" },
  );

  if (!response.ok) return null;
  return response.json();
};

export default function StudentExamRegistrationsPage() {
  const { user } = useAuth();
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data States
  const [examRegistrations, setExamRegistrations] = useState([]);

  // Expandable content states
  const [expandedCards, setExpandedCards] = useState({});
  const [timetables, setTimetables] = useState({});
  const [notices, setNotices] = useState({});
  const [loadingContent, setLoadingContent] = useState({});

  // Hall ticket states
  const [hallTicketDialog, setHallTicketDialog] = useState(false);
  const [currentHallTicket, setCurrentHallTicket] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [loadingStudentDetails, setLoadingStudentDetails] = useState(false);
  const [downloadingHallTicket, setDownloadingHallTicket] = useState(false);
  const [downloadingBulkHallTickets, setDownloadingBulkHallTickets] =
    useState(false);

  // Fetch student's exam registrations
  const fetchExamRegistrations = useCallback(async () => {
    if (!userData?.uid && !user?.uid) return;
    // console.log(userData)
    try {
      const constraints = [
        where("studentId", "==", userData?.uid || user?.uid),
        orderBy("createdAt", "desc"),
      ];
      const fetchedRegistrations = await getDocuments(
        COLLECTIONS.EXAM_REGISTRATIONS,
        constraints,
      );
      setExamRegistrations(fetchedRegistrations);
    } catch (error) {
      console.error("Error fetching exam registrations:", error);
      setError("Failed to load your exam registrations");
    }
  }, [userData?.uid, user?.uid]);

  // Fetch timetables for a specific exam (from exam document)
  const fetchTimetable = async (examId) => {
    if (timetables[examId]) return timetables[examId]; // Return cached data

    try {
      setLoadingContent((prev) => ({ ...prev, [`timetable_${examId}`]: true }));

      // Fetch the exam document to get timetable data
      const examQuery = query(
        collection(db, COLLECTIONS.EXAMS),
        where("__name__", "==", examId),
      );
      const examSnapshot = await getDocs(examQuery);

      if (!examSnapshot.empty) {
        const examData = examSnapshot.docs[0].data();

        // Extract timetable data from exam document
        const timetableData = {
          id: examId,
          title: examData.timetableTitle || examData.title || "Exam Timetable",
          description: examData.timetableDescription || "",
          image: examData.timetableImage,
          entries: examData.timetableEntries || [],
          createdAt: examData.createdAt,
        };

        setTimetables((prev) => ({ ...prev, [examId]: [timetableData] }));
        return [timetableData];
      } else {
        console.warn(`Exam with ID ${examId} not found`);
        return [];
      }
    } catch (error) {
      console.error(`Error fetching timetable for exam ${examId}:`, error);
      return [];
    } finally {
      setLoadingContent((prev) => ({
        ...prev,
        [`timetable_${examId}`]: false,
      }));
    }
  };

  // Fetch notices for a specific exam
  const fetchNotices = async (examId) => {
    if (notices[examId]) return notices[examId]; // Return cached data

    try {
      setLoadingContent((prev) => ({ ...prev, [`notices_${examId}`]: true }));
      // Fetch the exam document to get notice data
      const examQuery = query(
        collection(db, COLLECTIONS.EXAMS),
        where("__name__", "==", examId),
      );
      const examSnapshot = await getDocs(examQuery);

      if (!examSnapshot.empty) {
        const examData = examSnapshot.docs[0].data();

        // Extract notice data from exam document
        const noticeData = examData.notice
          ? [
              {
                id: examId,
                title: "Important Notice",
                content: examData.notice,
                createdAt: examData.createdAt,
              },
            ]
          : [];

        setNotices((prev) => ({ ...prev, [examId]: noticeData }));
        return noticeData;
      } else {
        console.warn(`Exam with ID ${examId} not found`);
        return [];
      }
    } catch (error) {
      console.error(`Error fetching notices for exam ${examId}:`, error);
      return [];
    } finally {
      setLoadingContent((prev) => ({ ...prev, [`notices_${examId}`]: false }));
    }
  };

  // Toggle expandable content
  const toggleExpandedContent = async (registrationId, examId, type) => {
    const key = `${registrationId}_${type}`;
    const isCurrentlyExpanded = expandedCards[key];

    // Close if already expanded
    if (isCurrentlyExpanded) {
      setExpandedCards((prev) => ({ ...prev, [key]: false }));
      return;
    }

    // Expand and fetch data
    setExpandedCards((prev) => ({ ...prev, [key]: true }));

    if (type === "timetable") {
      await fetchTimetable(examId);
    } else if (type === "notices") {
      await fetchNotices(examId);
    }
  };

  // Fetch student details from students collection
  const fetchStudentDetails = async (studentId) => {
    try {
      setLoadingStudentDetails(true);

      // First try to fetch by studentId (uid)
      const studentQuery = query(
        collection(db, "students"),
        where("uid", "==", studentId),
      );
      let studentSnapshot = await getDocs(studentQuery);

      // If not found by uid, try by email
      if (studentSnapshot.empty && (userData?.email || user?.email)) {
        const emailQuery = query(
          collection(db, "students"),
          where("email", "==", userData?.email || user?.email),
        );
        studentSnapshot = await getDocs(emailQuery);
      }

      let studentData = null;

      if (!studentSnapshot.empty) {
        studentData = studentSnapshot.docs[0].data();
      }
      if (studentData && !studentData.profilePictureUrl) {
        try {
          // Try to find application by studentId (uid)
          const applicationQuery = query(
            collection(db, COLLECTIONS.ADMISSIONS),
            where("studentId", "==", studentId),
          );
          const applicationSnapshot = await getDocs(applicationQuery);

          if (!applicationSnapshot.empty) {
            const applicationData = applicationSnapshot.docs[0].data();
            if (
              applicationData.profilePictureUrl ||
              applicationData.profilePicture
            ) {
              studentData.profilePictureUrl =
                applicationData.profilePictureUrl ||
                applicationData.profilePicture;
            }
          }
        } catch (error) {
          console.warn(
            "Error fetching profile picture from applications:",
            error,
          );
        }
      }

      // Also check if student data has profilePicture instead of profilePictureUrl
      if (
        studentData &&
        !studentData.profilePictureUrl &&
        studentData.profilePicture
      ) {
        studentData.profilePictureUrl = studentData.profilePicture;
      }

      if (studentData) {
        // console.log("Fetched Student Details:", studentData.profilePictureUrl);
        setStudentDetails(studentData);

        return studentData;
      } else {
        console.warn("Student details not found");
        return null;
      }
    } catch (error) {
      console.error("Error fetching student details:", error);
      return null;
    } finally {
      setLoadingStudentDetails(false);
    }
  };

  // Generate and show hall ticket
  const generateHallTicket = async (registration) => {
    setCurrentHallTicket(registration);

    // Fetch student details if not already cached
    if (!studentDetails) {
      await fetchStudentDetails(
        registration.studentId || userData?.uid || user?.uid,
      );
    }

    // Get or create hall ticket number if not exists
    if (!registration.hallTicketNumber && registration.id) {
      try {
        const hallTicketNumber = await getOrCreateHallTicketNumber(
          registration.id,
          registration.examId,
        );
        registration.hallTicketNumber = hallTicketNumber;
      } catch (error) {
        console.error("Error getting hall ticket number:", error);
      }
    }

    // Fetch timetable and notices for the hall ticket
    if (!timetables[registration.examId]) {
      await fetchTimetable(registration.examId);
    }
    if (!notices[registration.examId]) {
      await fetchNotices(registration.examId);
    }

    setHallTicketDialog(true);
  };

  // Direct download hall ticket without opening dialog
  const directDownloadHallTicket = async (registration) => {
    // If hall ticket URL exists, download directly
    console.log(
      "Direct download hall ticket for registration:",
      examRegistrations[0],
    );
    if (examRegistrations[0]?.hallTicketUrl) {
      console.log(
        "Downloading hall ticket from URL:",
        examRegistrations[0].hallTicketUrl,
      );
      const link = document.createElement("a");
      link.href = examRegistrations[0].hallTicketUrl;
      link.download = `hall_ticket_${
        examRegistrations[0].admissionNumber || registration.studentId
      }.pdf`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Hall ticket downloaded");
      return;
    }

    setCurrentHallTicket(registration);

    // Fetch student details if not already cached
    let currentStudent = studentDetails;
    if (!currentStudent) {
      currentStudent = await fetchStudentDetails(
        registration.studentId || userData?.uid || user?.uid,
      );
    }

    // Get or create hall ticket number if not exists
    if (!registration.hallTicketNumber && registration.id) {
      try {
        const hallTicketNumber = await getOrCreateHallTicketNumber(
          registration.id,
          registration.examId,
        );
        registration.hallTicketNumber = hallTicketNumber;
      } catch (error) {
        console.error("Error getting hall ticket number:", error);
      }
    }

    // Fetch timetable and notices for the hall ticket - MOVED to downloadHallTicket fallback
    // if (!timetables[registration.examId]) {
    //   await fetchTimetable(registration.examId);
    // }
    // if (!notices[registration.examId]) {
    //   await fetchNotices(registration.examId);
    // }

    // Now download the hall ticket
    downloadHallTicket(registration, currentStudent);
  };

  // Helper to open content in a new window and print without mutating the main DOM
  const openPrintWindowAndPrint = (contentHtml) => {
    try {
      const printWindow = window.open(
        "",
        "_blank",
        "noopener,noreferrer,width=900,height=700",
      );
      if (!printWindow) {
        console.warn("Unable to open print window—popup blocked");
        return;
      }

      // Copy page styles (links and inline styles) so printed content looks correct
      const headStyles = Array.from(
        document.querySelectorAll("link[rel=stylesheet], style"),
      )
        .map((el) => el.outerHTML)
        .join("");

      printWindow.document.open();
      printWindow.document.write(
        `<!doctype html><html><head>${headStyles}</head><body>${contentHtml}</body></html>`,
      );
      printWindow.document.close();
      printWindow.focus();

      // Wait for the window to finish rendering styles
      setTimeout(() => {
        try {
          printWindow.print();
          printWindow.close();
        } catch (err) {
          console.error("Print window print/close error:", err);
        }
      }, 500);
    } catch (err) {
      console.error("Error opening print window:", err);
    }
  };

  // Print hall ticket
  const printHallTicket = () => {
    const printContent = document.getElementById("hall-ticket-content");
    if (!printContent) return;
    openPrintWindowAndPrint(printContent.innerHTML);
  };

  // Download hall ticket as PDF
  const downloadHallTicket = async (
    registrationOverride = null,
    studentDetailsOverride = null,
  ) => {
    const registrationToUse = registrationOverride || currentHallTicket;
    const studentToUse = studentDetailsOverride || studentDetails;

    if (!registrationToUse || !studentToUse) return;

    setDownloadingHallTicket(true);

    try {
      // If hall ticket URL exists, download directly
      if (registrationToUse.hallTicketUrl) {
        const link = document.createElement("a");
        link.href = registrationToUse.hallTicketUrl;
        link.download = `Hall_Ticket_${
          studentToUse.admissionNumber || studentToUse.fullName
        }_${registrationToUse.examTitle}.pdf`;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // Try to fetch pre-generated hall ticket data from Firestore
      let hallTicketData = null;
      try {
        hallTicketData = await fetchHallTicketData(
          registrationToUse.examId,
          registrationToUse.studentId,
        );
      } catch (err) {
        // console.error("Error fetching hall ticket data:", err);
        // Fallback to manual construction if not found
      }

      // Fallback to manual construction if not found
      if (!hallTicketData) {
        console.log(
          "Hall ticket data not found in collection, constructing manually...",
        );

        // Fetch timetable and notices if not available
        if (!timetables[registrationToUse.examId]) {
          await fetchTimetable(registrationToUse.examId);
        }
        if (!notices[registrationToUse.examId]) {
          await fetchNotices(registrationToUse.examId);
        }

        // Prepare hall ticket data for PDF generation
        // Fetch madarsa details to get mekhala and sadar information if not present
        let mekhala =
          studentToUse.mekhala || registrationToUse.mekhala || "N/A";
        let sadarName = studentToUse.sadar || registrationToUse.sadar || "N/A";
        let sadarAddress = "N/A";

        const madarsaId = studentToUse.madarsaId || registrationToUse.madarsaId;

        if (madarsaId && (mekhala === "N/A" || sadarName === "N/A")) {
          try {
            const madarsaData = await fetchStudentMadarsaDetails(madarsaId);

            if (madarsaData) {
              mekhala = madarsaData.district || "N/A";
              sadarName =
                madarsaData.sadarName || madarsaData.adminName || "N/A";
              sadarAddress = madarsaData.address || "N/A";
            }
          } catch (error) {
            console.error(
              "Error fetching madarsa details for hall ticket:",
              error,
            );
          }
        }

        hallTicketData = {
          hallTicketNumber: registrationToUse.hallTicketNumber || "000000",
          examTitle: registrationToUse.examTitle,
          fullName: studentToUse.fullName || "N/A",
          admissionNumber: studentToUse.admissionNumber || "N/A",
          classLevel: studentToUse.classLevel || "N/A",
          gender: studentToUse.gender
            ? studentToUse.gender.charAt(0).toUpperCase() +
              studentToUse.gender.slice(1).toLowerCase()
            : "N/A",
          guardianName:
            studentToUse.guardianName || studentToUse.guardian || "N/A",
          dateOfBirth: studentToUse.dateOfBirth || "N/A",
          guardianPhone: studentToUse.guardianPhone || "N/A",
          madarsa: registrationToUse.madarsa || studentToUse.madarsa || "N/A",
          madarsaId: madarsaId,
          mekhala: mekhala,
          sadarName: sadarName,
          sadarAddress: sadarAddress,
          examDate: registrationToUse.examDate,
          createdAt: registrationToUse.createdAt,
          profilePictureUrl: studentToUse.profilePictureUrl || "",
          timetableEntries:
            timetables[registrationToUse.examId]?.[0]?.entries || [],
          examFees: registrationToUse.examFees || 0,
          subject: registrationToUse.subject || "N/A",
          duration: registrationToUse.duration || "N/A",
          rulesAndRegulations: registrationToUse.rulesAndRegulations || "",
          notice: registrationToUse.notice || "",
        };
      }

      // Generate PDF blob using the shared utility
      const pdfBuffer = await generateHallTicketPDFBlob(hallTicketData);
      const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });

      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Hall_Ticket_${
        studentToUse.admissionNumber || studentToUse.fullName
      }_${registrationToUse.examTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Hall ticket downloaded successfully");
    } catch (error) {
      console.error("Error downloading hall ticket:", error);
      toast.error("Failed to download hall ticket");
    } finally {
      setDownloadingHallTicket(false);
    }
  };

  // Bulk download hall tickets as Merged PDF
  const bulkDownloadHallTickets = async () => {
    // Filter registrations that are approved
    const approvedRegistrations = examRegistrations.filter(
      (reg) => reg.status === "registered",
    );

    if (approvedRegistrations.length === 0) {
      toast.error("No approved registrations available for download");
      return;
    }

    setDownloadingBulkHallTickets(true);
    const toastId = toast.loading("Preparing hall tickets...");

    try {
      // Ensure student details are loaded
      let currentStudentDetails = studentDetails;
      if (!currentStudentDetails) {
        currentStudentDetails = await fetchStudentDetails(
          userData?.uid || user?.uid,
        );
      }

      if (!currentStudentDetails) {
        throw new Error("Could not fetch student details");
      }

      const mergedPdf = await PDFDocument.create();
      let processedCount = 0;

      for (const registration of approvedRegistrations) {
        // Try to fetch pre-generated hall ticket data from Firestore
        let hallTicketData = null;
        try {
          hallTicketData = await fetchHallTicketData(
            registration.examId,
            registration.studentId,
          );
        } catch (err) {
          // console.error("Error fetching hall ticket data:", err);
          // Fallback to manual construction if not found
        }

        // Fallback to manual construction if not found
        if (!hallTicketData) {
          // Fetch timetable and notices if not available
          if (!timetables[registration.examId]) {
            await fetchTimetable(registration.examId);
          }
          if (!notices[registration.examId]) {
            await fetchNotices(registration.examId);
          }

          // Fetch madarsa details if needed
          let mekhala =
            currentStudentDetails.mekhala || registration.mekhala || "N/A";
          let sadarName =
            currentStudentDetails.sadar || registration.sadar || "N/A";
          let sadarAddress = "N/A";

          const madarsaId =
            currentStudentDetails.madarsaId || registration.madarsaId;

          if (madarsaId && (mekhala === "N/A" || sadarName === "N/A")) {
            try {
              const madarsaData = await fetchStudentMadarsaDetails(madarsaId);

              if (madarsaData) {
                mekhala = madarsaData.district || "N/A";
                sadarName =
                  madarsaData.sadarName || madarsaData.adminName || "N/A";
                sadarAddress = madarsaData.address || "N/A";
              }
            } catch (error) {
              console.error(
                "Error fetching madarsa details for hall ticket:",
                error,
              );
            }
          }

          // Prepare data
          hallTicketData = {
            hallTicketNumber: registration.hallTicketNumber || "000000",
            examTitle: registration.examTitle,
            fullName: currentStudentDetails.fullName || "N/A",
            admissionNumber: currentStudentDetails.admissionNumber || "N/A",
            classLevel: currentStudentDetails.classLevel || "N/A",
            gender: currentStudentDetails.gender
              ? currentStudentDetails.gender.charAt(0).toUpperCase() +
                currentStudentDetails.gender.slice(1).toLowerCase()
              : "N/A",
            guardianName:
              currentStudentDetails.guardianName ||
              currentStudentDetails.guardian ||
              "N/A",
            dateOfBirth: currentStudentDetails.dateOfBirth || "N/A",
            guardianPhone: currentStudentDetails.guardianPhone || "N/A",
            madarsa:
              registration.madarsa || currentStudentDetails.madarsa || "N/A",
            madarsaId: madarsaId,
            mekhala: mekhala,
            sadarName: sadarName,
            sadarAddress: sadarAddress,
            examDate: registration.examDate,
            createdAt: registration.createdAt,
            profilePictureUrl: currentStudentDetails.profilePictureUrl || "",
            timetableEntries:
              timetables[registration.examId]?.[0]?.entries || [],
            examFees: registration.examFees || 0,
            subject: registration.subject || "N/A",
            duration: registration.duration || "N/A",
            rulesAndRegulations: registration.rulesAndRegulations || "",
            notice: registration.notice || "",
          };
        }

        try {
          // Generate individual PDF blob
          const pdfBuffer = await generateHallTicketPDFBlob(hallTicketData);

          // Load the generated PDF
          const pdf = await PDFDocument.load(pdfBuffer);

          // Copy pages to merged PDF
          const copiedPages = await mergedPdf.copyPages(
            pdf,
            pdf.getPageIndices(),
          );
          copiedPages.forEach((page) => mergedPdf.addPage(page));

          processedCount++;
          toast.loading(
            `Processed ${processedCount}/${approvedRegistrations.length} hall tickets...`,
            { id: toastId },
          );
        } catch (err) {
          console.error(
            `Error generating PDF for ${registration.examTitle}:`,
            err,
          );
        }
      }

      if (processedCount === 0) {
        throw new Error("No hall tickets were successfully generated");
      }

      toast.loading("Finalizing PDF file...", { id: toastId });

      // Save the merged PDF
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const fileName = `My_Hall_Tickets_${
        new Date().toISOString().split("T")[0]
      }.pdf`;

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.dismiss(toastId);
      toast.success(`Successfully downloaded ${processedCount} hall tickets!`);
    } catch (error) {
      console.error("Error generating bulk hall tickets:", error);
      toast.dismiss(toastId);
      toast.error("Failed to generate hall tickets");
    } finally {
      setDownloadingBulkHallTickets(false);
    }
  };

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);
        await fetchExamRegistrations();
      } catch (error) {
        console.error("Error initializing data:", error);
        setError("Failed to load your exam registrations");
      } finally {
        setLoading(false);
      }
    };

    if (user || userData) {
      initializeData();
    }
  }, [user, userData, fetchExamRegistrations]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your registrations...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              My Exam Registrations
            </h1>
            <p className="text-gray-600 mt-2">
              Track your exam registration status
            </p>
          </div>
        </div>

        {/* Registrations List */}
        <div className="grid gap-4">
          {examRegistrations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium mb-2">
                  No registrations found
                </p>
                <p className="text-gray-400">
                  You haven&apos;t registered for any exams yet
                </p>
              </CardContent>
            </Card>
          ) : (
            examRegistrations.map((registration) => {
              const timetableKey = `${registration.id}_timetable`;
              const noticesKey = `${registration.id}_notices`;
              const isTimetableExpanded = expandedCards[timetableKey];
              const isNoticesExpanded = expandedCards[noticesKey];

              return (
                <Card
                  key={registration.id}
                  className="hover:now-lg transition-all duration-300 border-l-4 border-l-blue-500"
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-3 text-gray-900">
                          {registration.examTitle}
                        </CardTitle>
                        <div className="flex items-center gap-3 mb-3">
                          {getStatusBadge(registration.status)}
                          <span className="text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                            Registered: {formatDate(registration.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {/* Main Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                        <div className="p-2 bg-blue-100 rounded-full">
                          <Calendar className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-blue-600 font-medium">
                            Exam Date
                          </p>
                          <p className="font-semibold text-gray-900">
                            {formatDate(registration.examDate)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                        <div className="p-2 bg-green-100 rounded-full">
                          <IndianRupee className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-green-600 font-medium">
                            Registration Fee
                          </p>
                          <p className="font-semibold text-gray-900">
                            ₹{registration.examFees}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                        <div className="p-2 bg-purple-100 rounded-full">
                          <UserCheck className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm text-purple-600 font-medium">
                            Student Name
                          </p>
                          <p className="font-semibold text-gray-900">
                            {registration.studentName}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 mb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleExpandedContent(
                            registration.id,
                            registration.examId,
                            "timetable",
                          )
                        }
                        className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-300"
                        disabled={
                          loadingContent[`timetable_${registration.examId}`]
                        }
                      >
                        <FileText className="h-4 w-4" />
                        View Timetable
                        {loadingContent[`timetable_${registration.examId}`] ? (
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        ) : isTimetableExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleExpandedContent(
                            registration.id,
                            registration.examId,
                            "notices",
                          )
                        }
                        className="flex items-center gap-2 hover:bg-amber-50 hover:border-amber-300"
                        disabled={
                          loadingContent[`notices_${registration.examId}`]
                        }
                      >
                        <BookOpen className="h-4 w-4" />
                        View Notices
                        {loadingContent[`notices_${registration.examId}`] ? (
                          <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                        ) : isNoticesExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Hall Ticket Button - Only show for approved registrations */}
                      {registration.status === "registered" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => directDownloadHallTicket(registration)}
                          disabled={downloadingHallTicket}
                          className="flex items-center gap-2 hover:bg-green-50 hover:border-green-300 text-green-700 border-green-300 disabled:opacity-50"
                        >
                          {downloadingHallTicket ? (
                            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          {downloadingHallTicket
                            ? "Downloading..."
                            : "Download Hall Ticket"}
                        </Button>
                      )}
                    </div>

                    {/* Expandable Timetable Content */}
                    {isTimetableExpanded && (
                      <div className="border-t pt-4 mb-4 bg-blue-50/50 -mx-6 px-6 py-4 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          Exam Timetable
                        </h4>
                        {timetables[registration.examId] ? (
                          timetables[registration.examId].length > 0 ? (
                            <div className="space-y-3">
                              {timetables[registration.examId].map(
                                (timetable) => (
                                  <div
                                    key={timetable.id}
                                    className="bg-white p-4 rounded-lg border"
                                  >
                                    <div className="flex items-start justify-between mb-3">
                                      <div>
                                        <h5 className="font-medium text-gray-900">
                                          {timetable.title || "Exam Timetable"}
                                        </h5>
                                        {timetable.description && (
                                          <p className="text-sm text-gray-600 mt-1">
                                            {timetable.description}
                                          </p>
                                        )}

                                        {/* Display timetable entries */}
                                        {timetable.entries &&
                                          timetable.entries.length > 0 && (
                                            <div className="mt-3">
                                              <h6 className="text-sm font-medium text-gray-800 mb-2">
                                                Schedule:
                                              </h6>
                                              <div className="space-y-2">
                                                {timetable.entries.map(
                                                  (entry, entryIndex) => (
                                                    <div
                                                      key={entryIndex}
                                                      className="flex justify-between items-center bg-gray-50 p-2 rounded"
                                                    >
                                                      <span className="text-sm font-medium text-gray-900">
                                                        {entry.subject}
                                                      </span>
                                                      <span className="text-sm text-gray-600">
                                                        {formatDate(entry.date)}
                                                      </span>
                                                    </div>
                                                  ),
                                                )}
                                              </div>
                                            </div>
                                          )}

                                        {/* Display timetable image if available */}
                                        {timetable.image &&
                                          timetable.image.secure_url && (
                                            <Image
                                              src={timetable.image.secure_url}
                                              alt="Exam Timetable"
                                              width={800}
                                              height={600}
                                              className="max-w-full h-auto cursor-pointer rounded-lg mt-4 border now-sm hover:now-md transition-now"
                                              style={{ objectFit: "contain" }}
                                              onClick={() =>
                                                window.open(
                                                  timetable.image.secure_url,
                                                  "_blank",
                                                )
                                              }
                                            />
                                          )}
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {formatDate(timetable.createdAt)}
                                      </Badge>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          ) : (
                            <p className="text-gray-500 py-4 text-center bg-white rounded-lg border border-dashed">
                              No timetable available for this exam yet.
                            </p>
                          )
                        ) : (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expandable Notices Content */}
                    {isNoticesExpanded && (
                      <div className="border-t pt-4 mb-4 bg-amber-50/50 -mx-6 px-6 py-4 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-amber-600" />
                          Exam Notices
                        </h4>
                        {notices[registration.examId] ? (
                          notices[registration.examId].length > 0 ? (
                            <div className="space-y-3">
                              {notices[registration.examId].map((notice) => (
                                <div
                                  key={notice.id}
                                  className="bg-white p-4 rounded-lg border"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <h5 className="font-medium text-gray-900">
                                      {notice.title}
                                    </h5>
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {formatDate(notice.createdAt)}
                                    </Badge>
                                  </div>
                                  <p className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
                                    {notice.content}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 py-4 text-center bg-white rounded-lg border border-dashed">
                              No notices available for this exam yet.
                            </p>
                          )
                        ) : (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600 mx-auto"></div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Rejection Reason Alert */}
                    {registration.rejectionReason &&
                      registration.status === "rejected" && (
                        <Alert variant="destructive" className="mb-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Rejection Reason:</strong>{" "}
                            {registration.rejectionReason}
                          </AlertDescription>
                        </Alert>
                      )}

                    {/* Madarsa Info */}
                    {registration.madarsa && (
                      <div className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                        <strong>Madarsa:</strong> {registration.madarsa}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Hall Ticket Dialog */}
      <Dialog open={hallTicketDialog} onOpenChange={setHallTicketDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>Hall Ticket</DialogTitle>
          </DialogHeader>

          {currentHallTicket && (
            <div id="hall-ticket-content" className="space-y-6">
              <HallTicket
                data={{
                  hallTicketNumber:
                    currentHallTicket.hallTicketNumber || "000000",
                  examTitle: currentHallTicket.examTitle,
                  fullName: studentDetails?.fullName || "N/A",
                  middleName:
                    studentDetails?.middleName || studentDetails?.midNumber,
                  midNumber: studentDetails?.midNumber,
                  admissionNumber: studentDetails?.admissionNumber,
                  classLevel: studentDetails?.classLevel,
                  gender: studentDetails?.gender,
                  guardianPhone: studentDetails?.guardianPhone,
                  madarsa: currentHallTicket.madarsa || studentDetails?.madarsa,
                  madarsaId:
                    studentDetails?.madarsaId ||
                    currentHallTicket.madarsaId ||
                    null,
                  mekhala: studentDetails?.mekhala || currentHallTicket.mekhala,
                  sadar: studentDetails?.sadar || currentHallTicket.sadar,
                  examDate: currentHallTicket.examDate,
                  createdAt: currentHallTicket.createdAt,
                  profilePictureUrl: studentDetails?.profilePictureUrl,
                }}
                formatDate={formatDate}
              />

              <div className="text-center print:hidden flex gap-4 justify-center">
                <Button
                  onClick={downloadHallTicket}
                  disabled={downloadingHallTicket}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloadingHallTicket ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {downloadingHallTicket
                    ? "Downloading..."
                    : "Download Hall Ticket"}
                </Button>
                <Button
                  onClick={printHallTicket}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Hall Ticket
                </Button>
                <p className="text-sm text-gray-500 mt-2 col-span-2 text-center">
                  Please download or print this hall ticket and bring it to the
                  examination center
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
