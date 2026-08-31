"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Search,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  UserCheck,
  Edit,
  UserX,
  Grid3X3,
  List,
  Download,
  FileText,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  Calendar,
} from "lucide-react";
import {
  getDocuments,
  updateDocument,
  COLLECTIONS,
} from "@/lib/firestoreService";
import { searchStudents, fetchStudentsByIds } from "@/lib/firestoreQueries";
import {
  where,
  orderBy,
  doc,
  getDoc,
  limit,
  startAfter,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  getDocs,
  getCountFromServer,
} from "firebase/firestore";
import useAuthStore from "@/lib/authStore";
import Image from "next/image";
import {
  generateHallTicketHTML,
  generateHallTicketPDFBlob,
} from "@/lib/hallTicketUtils";
import { fetchHallTicketData } from "@/lib/examDetailQueries";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";

// Helper function to format dates
const formatDate = (dateValue) => {
  if (!dateValue || dateValue === "N/A" || dateValue === "NA") return "N/A";

  try {
    let dateObj;
    if (dateValue && typeof dateValue.toDate === "function") {
      dateObj = dateValue.toDate();
    } else if (
      dateValue &&
      typeof dateValue === "object" &&
      "seconds" in dateValue
    ) {
      dateObj = new Date(
        dateValue.seconds * 1000 + (dateValue.nanoseconds || 0) / 1000000,
      );
    } else if (
      typeof dateValue === "string" &&
      dateValue.includes("Timestamp(")
    ) {
      const secondsMatch = dateValue.match(/seconds=(\d+)/);
      const nanosecondsMatch = dateValue.match(/nanoseconds=(\d+)/);
      if (secondsMatch) {
        const seconds = parseInt(secondsMatch[1]);
        const nanoseconds = nanosecondsMatch
          ? parseInt(nanosecondsMatch[1])
          : 0;
        dateObj = new Date(seconds * 1000 + nanoseconds / 1000000);
      } else {
        dateObj = new Date(dateValue);
      }
    } else if (dateValue instanceof Date) {
      dateObj = dateValue;
    } else {
      dateObj = new Date(dateValue);
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      return "Invalid date";
    }

    return dateObj.toLocaleDateString();
  } catch (error) {
    console.error("Date formatting error:", error);
    return "Invalid date";
  }
};

// Helper function to get status badge
const getStatusBadge = (status) => {
  switch (status) {
    case "approved":
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

export default function MadarsaExamStudentsPage() {
  const { user } = useAuth();
  const { userData } = useAuthStore();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Data States
  const [examRegistrations, setExamRegistrations] = useState([]);
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedExam, setSelectedExam] = useState("all");

  // Initialize from URL params
  useEffect(() => {
    const examIdParam = searchParams.get("examId");
    if (examIdParam) {
      setSelectedExam(examIdParam);
      setSelectedRegistrationStatus("registered");
    }
  }, [searchParams]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 1000);
    return () => clearTimeout(handler);
  }, [searchTerm]);
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedRegistrationStatus, setSelectedRegistrationStatus] =
    useState("all");
  const [viewMode, setViewMode] = useState("card"); // "card" or "table"

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const itemsPerPage = 20;

  // Edit Dialog States
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState(null);
  const [editFormData, setEditFormData] = useState({
    status: "",
    rejectionReason: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Hall ticket states
  const [currentStudentDetails, setCurrentStudentDetails] = useState(null);
  const [loadingStudentDetails, setLoadingStudentDetails] = useState(false);
  const [timetables, setTimetables] = useState({});
  const [notices, setNotices] = useState({});
  const [loadingContent, setLoadingContent] = useState({});
  const [downloadingBulk, setDownloadingBulk] = useState(false);
  const [downloadingStudentIds, setDownloadingStudentIds] = useState(new Set());
  const [exportingCSV, setExportingCSV] = useState(false);
  const [examStats, setExamStats] = useState({
    total: 0,
    registered: 0,
    unregistered: 0,
    loading: false,
  });

  // Fetch exams
  const fetchExams = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      const fetchedExams = await getDocuments(COLLECTIONS.EXAMS, constraints);
      setExams(fetchedExams);
      return fetchedExams;
    } catch (error) {
      console.error("Error fetching exams:", error);
    }
  }, []);

  // Fetch students from madarsa with pagination
  const fetchStudents = useCallback(
    async (page = 1) => {
      try {
        const madarsaId =
          userData?.madarsaId || userData?.madarsa || userData?.madrasaId;

        if (madarsaId) {
          const fetchLimit = itemsPerPage * page;
          const constraints = [where("madarsaId", "==", madarsaId)];

          if (selectedClass !== "all")
            constraints.push(where("classLevel", "==", selectedClass));
          if (selectedGender !== "all")
            constraints.push(where("gender", "==", selectedGender));

          constraints.push(orderBy("createdAt", "desc"));
          constraints.push(limit(fetchLimit));

          const allFetched = await getDocuments(
            COLLECTIONS.STUDENTS,
            constraints,
          );

          // Get total count for pagination metadata
          const countConstraints = [where("madarsaId", "==", madarsaId)];
          if (selectedClass !== "all")
            countConstraints.push(where("classLevel", "==", selectedClass));
          if (selectedGender !== "all")
            countConstraints.push(where("gender", "==", selectedGender));

          const { getCount } = await import("@/lib/firestoreService");
          const totalCount = await getCount(
            COLLECTIONS.STUDENTS,
            countConstraints,
          );

          setTotalStudents(totalCount);
          setTotalPages(Math.ceil(totalCount / itemsPerPage));

          // Calculate exactly which 20 students belong to this page
          const startIndex = (page - 1) * itemsPerPage;
          const pageStudents = allFetched.slice(
            startIndex,
            startIndex + itemsPerPage,
          );

          return { students: pageStudents };
        } else {
          setStudents([]);
          setTotalStudents(0);
          setTotalPages(0);
          return { students: [] };
        }
      } catch (error) {
        console.error("Error fetching students:", error);
        setError("Failed to load students");
        return { students: [] };
      }
    },
    [
      userData?.madarsaId,
      userData?.madarsa,
      userData?.madrasaId,
      itemsPerPage,
      selectedClass,
      selectedGender,
    ],
  );

  // Fetch exam registrations for madarsa students with pagination
  const fetchExamRegistrations = useCallback(
    async (page = 1, paginated = false, examId = null) => {
      try {
        // If madarsa admin, filter by their madarsa ID
        let regsToProcess = [];
        let fetchedData = [];
        const madarsaId =
          userData?.madarsaId || userData?.madarsa || userData?.madrasaId;

        if (madarsaId) {
          if (examId && examId !== "all") {
            // USE hallTickets COLLECTION for exam-wise data
            const hallTicketsRef = collection(
              db,
              "hallTickets",
              examId,
              "students",
            );
            let hallTicketConstraints = [orderBy("createdAt", "desc")];
            if (selectedClass !== "all")
              hallTicketConstraints.push(
                where("classLevel", "==", selectedClass),
              );
            if (selectedGender !== "all")
              hallTicketConstraints.push(where("gender", "==", selectedGender));

            if (paginated) {
              hallTicketConstraints.push(limit(itemsPerPage * page));
            } else {
              hallTicketConstraints.push(limit(1000));
            }

            // Try madarsaId first
            let q = query(
              hallTicketsRef,
              where("madarsaId", "==", madarsaId),
              ...hallTicketConstraints,
            );
            let snapshot = await getDocs(q);

            // If empty, try mid (common in results/halltickets)
            if (snapshot.empty) {
              q = query(
                hallTicketsRef,
                where("mid", "==", madarsaId),
                ...hallTicketConstraints,
              );
              snapshot = await getDocs(q);
            }

            fetchedData = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));

            if (paginated) {
              // For hallTickets count
              // Simple count for now or use getCountFromServer
              setTotalStudents(fetchedData.length); // Approximation or fetch count properly
              setTotalPages(Math.ceil(fetchedData.length / itemsPerPage));
            }
          } else {
            // Use EXAM_REGISTRATIONS collection as fallback or for "All Exams"
            let constraints = [
              where("madarsaId", "==", madarsaId),
              orderBy("createdAt", "desc"),
            ];

            if (paginated) {
              constraints.push(limit(itemsPerPage * page));

              const countConstraints = [where("madarsaId", "==", madarsaId)];
              const totalDocs = await getDocuments(
                COLLECTIONS.EXAM_REGISTRATIONS,
                countConstraints,
              );
              setTotalStudents(totalDocs.length);
              setTotalPages(Math.ceil(totalDocs.length / itemsPerPage));
            } else {
              constraints.push(limit(1000));
            }

            fetchedData = await getDocuments(
              COLLECTIONS.EXAM_REGISTRATIONS,
              constraints,
            );
          }
        }

        if (paginated && madarsaId) {
          const startIndex = (page - 1) * itemsPerPage;
          regsToProcess = fetchedData.slice(
            startIndex,
            startIndex + itemsPerPage,
          );
        } else {
          regsToProcess = fetchedData;
        }

        // Map the registrations/hall tickets to a consistent format
        const mappedRegistrations = regsToProcess.map((reg) => ({
          id: reg.id,
          studentId: reg.studentId || reg.uid || reg.id,
          examId: reg.examId || examId,
          status: reg.status || "registered",
          examTitle: reg.examTitle,
          examDate: reg.examDate,
          examFees: reg.examFees || 0,
          hallTicketNumber: reg.hallTicketNumber,
          studentName:
            reg.studentName || reg.fullName || reg.name || reg.StudentName,
          studentEmail: reg.studentEmail || reg.email || reg.Email,
          madarsa: reg.madarsa || reg.madarsaName || reg.Madarsa || reg.mid,
          mekhala: reg.mekhala || reg.Mekhala,
          sadar: reg.sadar || reg.sadarName || reg.Sadar,
          createdAt: reg.createdAt,
          updatedAt: reg.updatedAt,
          paidAt: reg.paidAt,
          paymentId: reg.paymentId,
          paymentMethod: reg.paymentMethod,
          paymentAmount: reg.paymentAmount || reg.examFees || reg.amount,
          paymentStatus: reg.paymentStatus || "completed", // Hall tickets imply completed payment
          orderId: reg.orderId,
          rejectionReason: reg.rejectionReason,
          hallTicketUrl: reg.hallTicketUrl,
          studentPhone: reg.studentPhone || reg.phone || reg.Phone,
          gender: reg.gender || reg.Gender || reg.sex || reg.Sex,
          classLevel:
            reg.classLevel || reg.class || reg.grade || reg.ClassLevel,
          admissionNumber: reg.admissionNumber || reg.AdmissionNumber,
        }));

        setExamRegistrations(mappedRegistrations);
        return { registrations: mappedRegistrations };
      } catch (error) {
        console.error("Error fetching exam registrations:", error);
        setError("Failed to load exam registrations");
        return { registrations: [] };
      }
    },
    [
      userData?.madarsaId,
      userData?.madarsa,
      userData?.madrasaId,
      itemsPerPage,
      selectedClass,
      selectedGender,
    ],
  );

  // Handle edit registration
  const handleEditRegistration = (registration) => {
    setEditingRegistration(registration);
    setEditFormData({
      status: registration.status || "pending",
      rejectionReason: registration.rejectionReason || "",
    });
    setEditDialogOpen(true);
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingRegistration) return;

    try {
      setSavingEdit(true);
      const updateData = {
        status: editFormData.status,
        updatedAt: new Date(),
      };

      if (
        editFormData.status === "rejected" &&
        editFormData.rejectionReason.trim()
      ) {
        updateData.rejectionReason = editFormData.rejectionReason.trim();
      } else if (editFormData.status !== "rejected") {
        updateData.rejectionReason = null; // Clear rejection reason if not rejected
      }

      await updateDocument(
        COLLECTIONS.EXAM_REGISTRATIONS,
        editingRegistration.id,
        updateData,
      );

      // Refresh data
      await fetchExamRegistrations();

      setEditDialogOpen(false);
      setEditingRegistration(null);
      setEditFormData({ status: "", rejectionReason: "" });
    } catch (error) {
      console.error("Error updating registration:", error);
      setError("Failed to update registration");
    } finally {
      setSavingEdit(false);
    }
  };

  // Fetch student details from students collection for hall ticket
  const fetchStudentDetailsForHallTicket = async (studentId) => {
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
        setCurrentStudentDetails(studentData);
        return studentData;
      } else {
        console.warn("Student details not found for hall ticket");
        return null;
      }
    } catch (error) {
      console.error("Error fetching student details for hall ticket:", error);
      return null;
    } finally {
      setLoadingStudentDetails(false);
    }
  };

  // Fetch timetables for a specific exam (from exam document)
  const fetchTimetable = async (examId) => {
    if (timetables[examId]) return timetables[examId]; // Return cached data

    try {
      setLoadingContent((prev) => ({ ...prev, [`timetable_${examId}`]: true }));

      console.log("Fetching timetable for exam:", examId);
      const examDocRef = doc(db, COLLECTIONS.EXAMS, examId);
      const examSnapshot = await getDoc(examDocRef);

      if (examSnapshot.exists()) {
        const examData = examSnapshot.data();

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
      const examDocRef = doc(db, COLLECTIONS.EXAMS, examId);
      const examSnapshot = await getDoc(examDocRef);

      if (examSnapshot.exists()) {
        const examData = examSnapshot.data();

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

  // Download individual hall ticket
  const downloadHallTicket = async (student, registration) => {
    const studentId = student.uid || student.id;
    setDownloadingStudentIds((prev) => new Set(prev).add(studentId));
    const toastId = toast.loading("Generating hall ticket...");

    try {
      // 1. Try to fetch pre-generated hall ticket data from Firestore
      let hallTicketData = null;
      try {
        hallTicketData = await fetchHallTicketData(
          registration.examId,
          registration.studentId,
        );
      } catch (err) {
        // Fallback to manual construction if not found
      }

      // 2. Fallback to manual construction if not found
      if (!hallTicketData) {
        console.log(
          "Hall ticket data not found in collection, constructing manually...",
        );

        // Fetch student details if not already cached
        let fallbackStudent = null;
        if (
          !currentStudentDetails ||
          (student && currentStudentDetails.uid !== student.uid)
        ) {
          const fetchedDetails = await fetchStudentDetailsForHallTicket(
            student.uid || student.id,
          );
          if (fetchedDetails) {
            fallbackStudent = fetchedDetails;
          } else {
            // Use available student data for fallback
            fallbackStudent = student;
          }
        } else {
          fallbackStudent = currentStudentDetails;
        }

        // Fetch timetable and notices for the hall ticket fallback
        if (!timetables[registration.examId]) {
          console.log("Fetching timetable for exam:", registration);
          await fetchTimetable(registration.examId);
        }
        if (!notices[registration.examId]) {
          await fetchNotices(registration.examId);
        }

        // Fetch current madarsa's details for hall ticket
        const currentMadarsaId =
          userData?.madarsaId || userData?.madarsa || userData?.madrasaId;
        let currentMadarsaData = null;
        if (currentMadarsaId) {
          try {
            const madarsaDocRef = doc(
              db,
              COLLECTIONS.MADRASAS,
              currentMadarsaId,
            );
            const madarsaSnapshot = await getDoc(madarsaDocRef);
            if (madarsaSnapshot.exists()) {
              currentMadarsaData = madarsaSnapshot.data();
            }
          } catch (error) {
            console.warn("Error fetching current madarsa details:", error);
          }
        }

        hallTicketData = {
          hallTicketNumber: registration.hallTicketNumber || "000000",
          examTitle: registration.examTitle,
          fullName: fallbackStudent?.fullName || student.fullName,
          middleName: fallbackStudent?.middleName,
          midNumber: fallbackStudent?.midNumber,
          admissionNumber:
            fallbackStudent?.admissionNumber || student.admissionNumber,
          classLevel: fallbackStudent?.classLevel || student.classLevel,
          gender: fallbackStudent?.gender || student.gender,
          dateOfBirth:
            fallbackStudent?.dateOfBirth || student.dateOfBirth || "N/A",
          guardianName:
            fallbackStudent?.guardianName || fallbackStudent?.guardian || "N/A",
          guardianPhone:
            fallbackStudent?.phone ||
            fallbackStudent?.guardianPhone ||
            student.phone,
          madarsa:
            userData?.madarsaName ||
            currentMadarsaData?.name ||
            fallbackStudent?.madarsaId ||
            registration.madarsaId ||
            "N/A",
          madarsaId:
            fallbackStudent?.madarsaId || registration.madarsaId || null,
          mekhala: fallbackStudent?.mekhala || registration.mekhala,
          sadarName: userData?.madarsaName || "N/A",
          sadarAddress: userData?.madarsaAddress || "N/A",
          examDate: registration.examDate,
          createdAt: registration.createdAt,
          profilePictureUrl:
            fallbackStudent?.profilePictureUrl || student.profilePicture,
          timetableEntries: timetables[registration.examId]?.[0]?.entries || [],
        };
      }

      // 3. Generate PDF blob using the shared utility
      const pdfBuffer = await generateHallTicketPDFBlob(hallTicketData);
      const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });

      // 4. Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Hall_Ticket_${
        student.admissionNumber || student.fullName
      }_${registration.examTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Hall ticket downloaded successfully", { id: toastId });
    } catch (error) {
      console.error("Error downloading hall ticket:", error);
      toast.error("Failed to download hall ticket", { id: toastId });
    } finally {
      setDownloadingStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  };

  // Download all hall tickets as merged PDF
  const downloadAllHallTickets = async () => {
    try {
      setDownloadingBulk(true);
      const toastId = toast.loading("Fetching all registered students...");

      const madarsaId =
        userData?.madarsaId || userData?.madarsa || userData?.madrasaId;
      if (!madarsaId) return;

      // 1. Fetch ALL matching students in Madarsa
      const studentConstraints = [where("madarsaId", "==", madarsaId)];
      if (selectedClass !== "all")
        studentConstraints.push(where("classLevel", "==", selectedClass));
      if (selectedGender !== "all")
        studentConstraints.push(where("gender", "==", selectedGender));

      const allStudentsInMadarsa = await getDocuments(
        COLLECTIONS.STUDENTS,
        studentConstraints,
      );

      // 2. Fetch ALL matching registrations/halltickets
      let allRegistrations = [];
      if (selectedExam !== "all") {
        const htRef = collection(db, "hallTickets", selectedExam, "students");
        let q = query(htRef, where("madarsaId", "==", madarsaId));
        let snapshot = await getDocs(q);
        if (snapshot.empty) {
          q = query(htRef, where("mid", "==", madarsaId));
          snapshot = await getDocs(q);
        }
        allRegistrations = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } else {
        allRegistrations = await getDocuments(COLLECTIONS.EXAM_REGISTRATIONS, [
          where("madarsaId", "==", madarsaId),
        ]);
      }

      // 3. Combine and Filter
      let studentsToProcess = allStudentsInMadarsa
        .map((student) => {
          const reg = allRegistrations.find(
            (r) =>
              r.studentId === (student.uid || student.id) ||
              r.admissionNumber === student.admissionNumber,
          );
          return {
            ...student,
            isRegistered:
              !!reg && (selectedExam === "all" || reg.examId === selectedExam),
            registrationDetails: reg,
          };
        })
        .filter((s) => s.isRegistered && s.registrationDetails);

      // 4. Client-side search and status filter if applied
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        studentsToProcess = studentsToProcess.filter(
          (s) =>
            s.fullName?.toLowerCase().includes(term) ||
            s.admissionNumber?.toLowerCase().includes(term),
        );
      }

      if (studentsToProcess.length === 0) {
        toast.error("No registered students found for current filters", {
          id: toastId,
        });
        setDownloadingBulk(false);
        return;
      }

      toast.loading(`Preparing ${studentsToProcess.length} hall tickets...`, {
        id: toastId,
      });

      const mergedPdf = await PDFDocument.create();
      let processedCount = 0;

      for (const student of studentsToProcess) {
        const registration = student.registrationDetails;
        let hallTicketData = null;
        try {
          hallTicketData = await fetchHallTicketData(
            registration.examId,
            registration.studentId,
          );
        } catch (err) {}

        if (!hallTicketData) {
          if (!timetables[registration.examId])
            await fetchTimetable(registration.examId);
          if (!notices[registration.examId])
            await fetchNotices(registration.examId);

          hallTicketData = {
            hallTicketNumber: registration.hallTicketNumber || "000000",
            examTitle: registration.examTitle,
            fullName: student.fullName || "N/A",
            middleName: student.middleName,
            midNumber: student.midNumber,
            admissionNumber: student.admissionNumber || "N/A",
            classLevel: student.classLevel || "N/A",
            gender: student.gender || "N/A",
            guardianName: student.guardianName || student.guardian || "N/A",
            dateOfBirth: student.dateOfBirth || "N/A",
            guardianPhone: student.phone || student.guardianPhone || "N/A",
            madarsa: userData?.madarsaName || "N/A",
            madarsaId: madarsaId || null,
            mekhala: student.mekhala || registration.mekhala,
            sadarName: userData?.madarsaName || "N/A",
            sadarAddress: userData?.madarsaAddress || "N/A",
            examDate: registration.examDate,
            createdAt: registration.createdAt,
            profilePictureUrl:
              student.profilePictureUrl || student.profilePicture,
            timetableEntries:
              timetables[registration.examId]?.[0]?.entries || [],
          };
        }

        try {
          const pdfBuffer = await generateHallTicketPDFBlob(hallTicketData);
          const pdf = await PDFDocument.load(pdfBuffer);
          const copiedPages = await mergedPdf.copyPages(
            pdf,
            pdf.getPageIndices(),
          );
          copiedPages.forEach((page) => mergedPdf.addPage(page));
          processedCount++;
          if (processedCount % 5 === 0) {
            toast.loading(
              `Processed ${processedCount}/${studentsToProcess.length} hall tickets...`,
              { id: toastId },
            );
          }
        } catch (err) {
          console.error(`Error generating PDF for ${student.fullName}:`, err);
        }
      }

      if (processedCount === 0)
        throw new Error("No hall tickets were successfully generated");

      toast.loading("Finalizing PDF file...", { id: toastId });
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Bulk_Hall_Tickets_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.dismiss(toastId);
      toast.success(`Successfully downloaded ${processedCount} hall tickets!`);
    } catch (error) {
      console.error("Error creating bulk download:", error);
      toast.error("Failed to download hall tickets");
    } finally {
      setDownloadingBulk(false);
    }
  };

  // Export filtered students to CSV
  const exportStudentsToCSV = async () => {
    try {
      setExportingCSV(true);
      const madarsaId =
        userData?.madarsaId || userData?.madarsa || userData?.madrasaId;
      if (!madarsaId) return;

      // Prepare filters suffix for filename
      let filterSuffix = "";
      if (selectedExam !== "all") {
        const exam = exams.find((e) => e.id === selectedExam);
        if (exam) filterSuffix += `_${exam.title.replace(/\s+/g, "_")}`;
      }
      if (selectedClass !== "all") filterSuffix += `_Class_${selectedClass}`;
      if (selectedGender !== "all") filterSuffix += `_${selectedGender}`;
      if (selectedRegistrationStatus !== "all")
        filterSuffix += `_${selectedRegistrationStatus}`;

      // 1. Fetch ALL matching students
      const studentConstraints = [where("madarsaId", "==", madarsaId)];
      if (selectedClass !== "all")
        studentConstraints.push(where("classLevel", "==", selectedClass));
      if (selectedGender !== "all")
        studentConstraints.push(where("gender", "==", selectedGender));

      const allStudentsInMadarsa = await getDocuments(
        COLLECTIONS.STUDENTS,
        studentConstraints,
      );

      // 2. Fetch ALL matching registrations/halltickets for lookup
      let allRegistrations = [];
      if (selectedExam !== "all") {
        const htRef = collection(db, "hallTickets", selectedExam, "students");
        let q = query(htRef, where("madarsaId", "==", madarsaId));
        let snapshot = await getDocs(q);
        if (snapshot.empty) {
          q = query(htRef, where("mid", "==", madarsaId));
          snapshot = await getDocs(q);
        }
        allRegistrations = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } else {
        const regs = await getDocuments(COLLECTIONS.EXAM_REGISTRATIONS, [
          where("madarsaId", "==", madarsaId),
        ]);
        allRegistrations = regs;
      }

      // 3. Combine and Filter (Search + Status)
      let studentsToExport = allStudentsInMadarsa.map((student) => {
        const reg = allRegistrations.find(
          (r) =>
            r.studentId === (student.uid || student.id) ||
            r.admissionNumber === student.admissionNumber,
        );
        return {
          ...student,
          isRegistered:
            !!reg && (selectedExam === "all" || reg.examId === selectedExam),
          registrationDetails: reg,
        };
      });

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        studentsToExport = studentsToExport.filter(
          (s) =>
            s.fullName?.toLowerCase().includes(term) ||
            s.admissionNumber?.toLowerCase().includes(term) ||
            s.email?.toLowerCase().includes(term),
        );
      }

      if (selectedRegistrationStatus !== "all") {
        if (selectedRegistrationStatus === "registered") {
          studentsToExport = studentsToExport.filter((s) => s.isRegistered);
        } else {
          studentsToExport = studentsToExport.filter((s) => !s.isRegistered);
        }
      }

      if (studentsToExport.length === 0) {
        toast.error("No students found for current filters");
        return;
      }

      // Prepare CSV headers
      const headers = [
        "Name",
        "Admission Number",
        "Class",
        "Gender",
        "Phone",
        "Email",
        "Registration Status",
        "Exam Title",
        "Registration Date",
        "Payment Status",
        "Hall Ticket Number",
      ];

      // Prepare CSV rows
      const rows = studentsToExport.map((student) => {
        const reg = student.registrationDetails;
        return [
          student.fullName || "",
          student.admissionNumber || "",
          student.classLevel || "",
          student.gender || "",
          student.phone || "",
          student.email || "",
          student.isRegistered ? "Registered" : "Not Registered",
          reg?.examTitle || "",
          reg?.createdAt ? formatDate(reg.createdAt) : "",
          reg?.paymentStatus || "",
          reg?.hallTicketNumber || "",
        ];
      });

      const csvContent =
        "\ufeff" +
        [headers, ...rows]
          .map((row) =>
            row
              .map((field) => `"${String(field || "").replace(/"/g, '""')}"`)
              .join(","),
          )
          .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Students_${(userData?.madarsaName || "export").replace(/\s+/g, "_")}${filterSuffix}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${studentsToExport.length} students to CSV`);
    } catch (error) {
      console.error("Error exporting students to CSV:", error);
      toast.error("Failed to export students data");
    } finally {
      setExportingCSV(false);
    }
  };

  // Filter students based on search and filters
  useEffect(() => {
    let filtered = [];

    if (selectedRegistrationStatus === "registered" && !debouncedSearchTerm) {
      // Use examRegistrations as base to ensure continuous list
      const uniqueStudentMap = new Map();

      examRegistrations.forEach((reg) => {
        // Filter by Exam first (if selected)
        if (selectedExam !== "all" && reg.examId !== selectedExam) return;

        // Ensure paid/waived
        if (reg.paymentStatus !== "completed" && reg.paymentStatus !== "waived")
          return;

        if (!uniqueStudentMap.has(reg.studentId)) {
          // Find student in students array for more complete metadata
          const studentDoc = students.find(
            (s) => s.uid === reg.studentId || s.id === reg.studentId,
          );

          uniqueStudentMap.set(reg.studentId, {
            ...studentDoc, // Prioritize student doc fields
            uid: reg.studentId,
            id: reg.studentId,
            fullName: studentDoc?.fullName || reg.studentName,
            email: studentDoc?.email || reg.studentEmail,
            phone: studentDoc?.phone || reg.studentPhone,
            gender:
              studentDoc?.gender ||
              studentDoc?.Gender ||
              studentDoc?.sex ||
              studentDoc?.Sex ||
              reg.gender,
            classLevel:
              studentDoc?.classLevel ||
              studentDoc?.ClassLevel ||
              studentDoc?.class ||
              studentDoc?.grade ||
              reg.classLevel,
            admissionNumber: studentDoc?.admissionNumber || reg.admissionNumber,
            isRegistered: true,
            registrationDetails: reg,
          });
        }
      });

      filtered = Array.from(uniqueStudentMap.values());
    } else {
      // Use paginated students list as base (Default)
      filtered = students.map((student) => {
        const normalizeAdmNo = (no) => no?.toString().trim().toLowerCase();
        const studentAdmNo = normalizeAdmNo(student.admissionNumber);
        const studentUid = student.uid;
        const studentId = student.id;

        // Helper to match student with registration
        const matchesStudent = (reg) => {
          const regAdmNo = normalizeAdmNo(reg.admissionNumber);
          return (
            (regAdmNo && studentAdmNo && regAdmNo === studentAdmNo) ||
            reg.studentId === studentUid ||
            reg.studentId === studentId
          );
        };

        // Helper to check for active/paid registration
        const isPaidContent = (reg) =>
          reg.paymentStatus === "completed" || reg.paymentStatus === "waived";

        const registrationDetails = examRegistrations.find((reg) => {
          const matchesExam =
            selectedExam === "all" || reg.examId === selectedExam;
          return matchesExam && matchesStudent(reg) && isPaidContent(reg);
        });

        return {
          ...student,
          fullName: student.fullName || registrationDetails?.studentName,
          gender:
            student.gender ||
            student.Gender ||
            student.sex ||
            student.Sex ||
            registrationDetails?.gender,
          classLevel:
            student.classLevel ||
            student.ClassLevel ||
            student.class ||
            student.grade ||
            registrationDetails?.classLevel,
          isRegistered: !!registrationDetails,
          registrationDetails,
        };
      });
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (student) =>
          student.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.admissionNumber
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          student.email?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by gender
    if (selectedGender !== "all") {
      filtered = filtered.filter(
        (student) =>
          student.gender?.toLowerCase() === selectedGender.toLowerCase(),
      );
    }

    // Filter by class
    if (selectedClass !== "all") {
      filtered = filtered.filter(
        (student) => student.classLevel === selectedClass,
      );
    }

    // Filter by registration status
    if (selectedRegistrationStatus !== "all") {
      if (selectedRegistrationStatus === "registered") {
        filtered = filtered.filter((student) => student.isRegistered);
      } else if (selectedRegistrationStatus === "not_registered") {
        filtered = filtered.filter((student) => !student.isRegistered);
      }
    }

    console.log("Filtered students:", filtered);

    setFilteredStudents(filtered);
  }, [
    students,
    examRegistrations,
    searchTerm,
    selectedExam,
    selectedGender,
    selectedClass,
    selectedRegistrationStatus,
    debouncedSearchTerm,
  ]);

  // Initialize data on first load (Fetch Exams only)
  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);
        // Reset pagination state for fresh load
        setCurrentPage(1);
        await fetchExams();
      } catch (error) {
        console.error("Error initializing data:", error);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    if (user || userData) {
      initializeData();
    }
  }, [user, userData, fetchExams]);

  // Handle pagination changes and search
  useEffect(() => {
    const loadPageData = async () => {
      // Pagination logic based on view mode
      try {
        setLoading(true);

        const madarsaId =
          userData?.madarsaId || userData?.madarsa || userData?.madrasaId;

        if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
          // --- SEARCH MODE (Server-Side) ---
          // Search strictly matches the user query across the DB for this madarsa
          // Ignores standard pagination and 'Registered' mode logic temporarily

          if (madarsaId) {
            const filters = {
              madarsaId: madarsaId,
            };
            if (selectedClass !== "all") filters.classLevel = selectedClass;
            // Note: Gender filter relies on searchStudents support or post-filtering
            // searchStudents supports gender key if I recall correctly (checked Step 599 diff)
            // Yes it does: if (gender ...) baseConstraints.push...
            if (selectedGender !== "all") filters.gender = selectedGender;

            // Fetch registrations for lookup context
            const [searchResults, registrationResult] = await Promise.all([
              searchStudents(debouncedSearchTerm, filters),
              fetchExamRegistrations(1, false), // unpaginated batch
            ]);

            // Update students list
            setStudents(searchResults);

            // Update metadata for search view
            setTotalStudents(searchResults.length);
            setTotalPages(1); // Search results are currently one "page"
          }
        } else if (selectedRegistrationStatus === "registered") {
          // --- REGISTERED MODE (Paginated) ---
          // We drive entirely from fetchExamRegistrations
          const result = await fetchExamRegistrations(
            currentPage,
            true,
            selectedExam,
          );

          if (result && result.registrations?.length > 0) {
            const studentIds = [
              ...new Set(result.registrations.map((r) => r.studentId)),
            ].filter(Boolean);
            if (studentIds.length > 0) {
              const studentsData = await fetchStudentsByIds(studentIds);
              setStudents(studentsData);
            }
          }
        } else {
          // --- DEFAULT STUDENT MODE (Paginated) ---
          // We fetch students page, plus a batch of registrations for lookup
          const [registrationResult, studentResult] = await Promise.all([
            fetchExamRegistrations(1, false), // Fetch batch for lookup
            fetchStudents(currentPage),
          ]);

          // Handle student results
          if (studentResult) {
            const { students: fetchedStudents } = studentResult;
            setStudents(fetchedStudents);
          }
        }
      } catch (error) {
        console.error("Error loading page data:", error);
        setError("Failed to load page data");
      } finally {
        setLoading(false);
      }
    };

    if (user || userData) {
      loadPageData();
    }
  }, [
    currentPage,
    user,
    userData,
    exams,
    selectedRegistrationStatus,
    fetchExamRegistrations,
    fetchStudents,
    debouncedSearchTerm, // Added dependency
    selectedClass, // Added for search context update
    selectedGender,
  ]);

  const fetchExamStats = useCallback(async () => {
    const madarsaId =
      userData?.madarsaId || userData?.madarsa || userData?.madrasaId;
    try {
      setExamStats((prev) => ({ ...prev, loading: true }));
      const { getCount } = await import("@/lib/firestoreService");

      // 1. Fetch ALL matching students in Madarsa for this class/gender
      const studentConstraints = [where("madarsaId", "==", madarsaId)];
      if (selectedClass !== "all")
        studentConstraints.push(where("classLevel", "==", selectedClass));
      if (selectedGender !== "all")
        studentConstraints.push(where("gender", "==", selectedGender));

      const allStudentsSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.STUDENTS), ...studentConstraints),
      );
      const allStudentsInMadarsa = allStudentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 2. Fetch ALL matching registrations/halltickets for intersection
      let allRegistrations = [];
      if (selectedExam !== "all") {
        const htRef = collection(db, "hallTickets", selectedExam, "students");
        let q = query(htRef, where("madarsaId", "==", madarsaId));
        if (selectedClass !== "all")
          q = query(q, where("classLevel", "==", selectedClass));
        if (selectedGender !== "all")
          q = query(q, where("gender", "==", selectedGender));

        const snapshot = await getDocs(q);
        allRegistrations = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } else {
        const regRef = collection(db, COLLECTIONS.EXAM_REGISTRATIONS);
        let q = query(regRef, where("madarsaId", "==", madarsaId));
        if (selectedClass !== "all")
          q = query(q, where("classLevel", "==", selectedClass));
        if (selectedGender !== "all")
          q = query(q, where("gender", "==", selectedGender));

        const snapshot = await getDocs(q);
        allRegistrations = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      }

      // 3. Calculate intersection (this matches download logic exactly)
      const registeredCount = allStudentsInMadarsa.filter((student) => {
        return allRegistrations.some(
          (r) =>
            r.studentId === (student.uid || student.id) ||
            r.admissionNumber === student.admissionNumber,
        );
      }).length;

      setExamStats({
        total: allStudentsInMadarsa.length,
        registered: registeredCount,
        unregistered: Math.max(
          0,
          allStudentsInMadarsa.length - registeredCount,
        ),
        loading: false,
      });
    } catch (err) {
      console.error("Error fetching stats:", err);
      setExamStats((prev) => ({ ...prev, loading: false }));
    }
  }, [userData, selectedExam, selectedClass, selectedGender]);

  useEffect(() => {
    fetchExamStats();
  }, [fetchExamStats]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading registered students...</p>
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
              Madarsa Students
            </h1>
            <p className="text-gray-600 mt-2">
              View all students and their exam registration status
            </p>
            {/* Stat Boxes */}
            {selectedExam !== "all" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <Card>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm text-gray-600 truncate">
                          Total Students
                        </p>
                        <p className="text-lg sm:text-2xl font-bold">
                          {examStats.loading ? "..." : examStats.total}
                        </p>
                        {selectedClass !== "all" && (
                          <p className="text-[10px] text-blue-600 font-medium">
                            Class {selectedClass}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <UserCheck className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm text-gray-600 truncate">
                          Registered
                        </p>
                        <p className="text-lg sm:text-2xl font-bold">
                          {examStats.loading ? "..." : examStats.registered}
                        </p>
                        <p className="text-[10px] text-green-600 font-medium">
                          Ready for Exam
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <UserX className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm text-gray-600 truncate">
                          Unregistered
                        </p>
                        <p className="text-lg sm:text-2xl font-bold">
                          {examStats.loading ? "..." : examStats.unregistered}
                        </p>
                        <p className="text-[10px] text-red-600 font-medium">
                          Missing Registration
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "card" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("card")}
            >
              <Grid3X3 className="h-4 w-4 mr-2" />
              Card View
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4 mr-2" />
              Table View
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={selectedExam} onValueChange={setSelectedExam}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by exam" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Exams</SelectItem>
                  {exams
                    .filter((exam) => exam && exam.isActive !== false)
                    .map((exam) => (
                      <SelectItem key={exam.id} value={exam.id}>
                        {exam.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select value={selectedGender} onValueChange={setSelectedGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by gender" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by class" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Classes</SelectItem>
                  <SelectItem value="1">Class 1</SelectItem>
                  <SelectItem value="2">Class 2</SelectItem>
                  <SelectItem value="3">Class 3</SelectItem>
                  <SelectItem value="4">Class 4</SelectItem>
                  <SelectItem value="5">Class 5</SelectItem>
                  <SelectItem value="6">Class 6</SelectItem>
                  <SelectItem value="7">Class 7</SelectItem>
                  <SelectItem value="8">Class 8</SelectItem>
                  <SelectItem value="9">Class 9</SelectItem>
                  <SelectItem value="10">Class 10</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={selectedRegistrationStatus}
                onValueChange={setSelectedRegistrationStatus}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Registration status" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Students</SelectItem>
                  <SelectItem value="registered">Exam Registered</SelectItem>
                  <SelectItem value="not_registered">Not Registered</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center text-sm text-gray-600">
                <UserCheck className="h-4 w-4 mr-2" />
                Total: {filteredStudents.length} students
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
              <Button
                onClick={exportStudentsToCSV}
                disabled={exportingCSV}
                variant="outline"
                className="flex items-center gap-2"
              >
                {exportingCSV ? (
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {exportingCSV
                  ? "Exporting..."
                  : `Export All (${
                      selectedExam === "all"
                        ? totalStudents
                        : selectedRegistrationStatus === "all"
                          ? examStats.total
                          : selectedRegistrationStatus === "registered"
                            ? examStats.registered
                            : examStats.unregistered
                    } total)`}
              </Button>
              <Button
                onClick={downloadAllHallTickets}
                disabled={
                  downloadingBulk ||
                  filteredStudents.filter((s) => s.isRegistered).length === 0
                }
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                {downloadingBulk ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download All Hall Tickets ({examStats.registered})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Students Display */}
        {viewMode === "card" ? (
          /* Card View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
            {filteredStudents.length === 0 ? (
              <div className="col-span-full">
                <Card className="p-8 text-center">
                  <CardContent>
                    <UserX className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No students found
                    </h3>
                    <p className="text-gray-600">
                      {students.length === 0
                        ? "No students are registered in your madarsa yet."
                        : "No students match your current filters. Try adjusting your search or filter criteria."}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              filteredStudents.map((student) => {
                const { isRegistered, registrationDetails } = student;

                return (
                  <Card
                    key={student.uid}
                    className="h-full hover:skk-lg transition-skk duration-200 border border-gray-200"
                  >
                    <CardContent className="p-6 h-full flex flex-col">
                      {/* Header with Basic Info */}
                      <div className="mb-4">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {student.fullName}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Admission: {student.admissionNumber}
                          </p>
                          <p className="text-sm text-gray-600">
                            Class: {student.classLevel || "Not specified"}
                          </p>
                        </div>
                      </div>

                      {/* Registration Status */}
                      <div className="mb-4">
                        {isRegistered ? (
                          <div className="space-y-2">
                            <Badge className="bg-green-100 text-green-800 border border-green-200 px-3 py-1">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Exam Registered
                            </Badge>
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                              <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">
                                Exam
                              </p>
                              <p className="text-sm font-semibold text-blue-900 truncate">
                                {exams.find(
                                  (exam) =>
                                    exam.id === registrationDetails.examId,
                                )?.title ||
                                  registrationDetails.examTitle ||
                                  "Unknown Exam"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-700 border border-gray-200 px-3 py-1">
                            <UserX className="w-3 h-3 mr-1" />
                            Not Registered
                          </Badge>
                        )}
                      </div>

                      {/* Student Details */}
                      <div className="grid grid-cols-2 gap-3 mb-4 flex-1">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                            Gender
                          </p>
                          <p className="text-sm font-medium text-gray-900 capitalize">
                            {student.gender || "Not specified"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                            Phone
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            {student.phone || "Not provided"}
                          </p>
                        </div>
                      </div>

                      {/* Registration Details - Only show if registered */}
                      {isRegistered && registrationDetails && (
                        <div className="border-t pt-4 mt-auto">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">
                                Registered:
                              </span>
                              <span className="text-sm font-medium text-gray-900">
                                {formatDate(registrationDetails.createdAt)}
                              </span>
                            </div>

                            {/* Hall Ticket Download Button */}
                            {(registrationDetails.status === "registered" ||
                              registrationDetails.status === "approved") && (
                              <div className="pt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    downloadHallTicket(
                                      student,
                                      registrationDetails,
                                    )
                                  }
                                  disabled={downloadingStudentIds.has(
                                    student.uid || student.id,
                                  )}
                                  className="w-full flex items-center gap-2 hover:bg-green-50 hover:border-green-300 text-green-700 border-green-300 disabled:opacity-50"
                                >
                                  {downloadingStudentIds.has(
                                    student.uid || student.id,
                                  ) ? (
                                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Download className="h-3 w-3" />
                                  )}
                                  {downloadingStudentIds.has(
                                    student.uid || student.id,
                                  )
                                    ? "Downloading..."
                                    : "Download Hall Ticket"}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        ) : (
          /* Table View */
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Registration Status</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Registration Date</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        <UserX className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          No students found
                        </h3>
                        <p className="text-gray-600">
                          {students.length === 0
                            ? "No students are registered in your madarsa yet."
                            : "No students match your current filters. Try adjusting your search or filter criteria."}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((student) => {
                      const { isRegistered, registrationDetails } = student;

                      return (
                        <TableRow key={student.uid}>
                          <TableCell>
                            <div className="font-medium text-gray-900">
                              {student.fullName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {student.admissionNumber}
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">
                            {student.gender || "Not specified"}
                          </TableCell>
                          <TableCell>
                            {student.classLevel || "Not specified"}
                          </TableCell>
                          <TableCell>
                            {student.phone || "Not provided"}
                          </TableCell>
                          <TableCell>
                            {isRegistered ? "Registered" : "Not Registered"}
                          </TableCell>
                          <TableCell>
                            {isRegistered && registrationDetails
                              ? exams.find(
                                  (exam) =>
                                    exam.id === registrationDetails.examId,
                                )?.title ||
                                registrationDetails.examTitle ||
                                "Unknown"
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {isRegistered && registrationDetails
                              ? registrationDetails.createdAt
                                  ?.toDate?.()
                                  ?.toLocaleDateString() ||
                                (registrationDetails.createdAt instanceof Date
                                  ? registrationDetails.createdAt.toLocaleDateString()
                                  : "N/A")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {isRegistered && registrationDetails
                              ? registrationDetails.paidAt
                                  ?.toDate?.()
                                  ?.toLocaleDateString() ||
                                (registrationDetails.paidAt instanceof Date
                                  ? registrationDetails.paidAt.toLocaleDateString()
                                  : "N/A")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {isRegistered && registrationDetails ? (
                              <Badge
                                className="!text-white"
                                variant={
                                  registrationDetails.status === "approved"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {registrationDetails.status || "pending"}
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {isRegistered && registrationDetails && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleEditRegistration(registrationDetails)
                                }
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Edit Registration Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px] bg-white">
            <DialogHeader>
              <DialogTitle>Edit Registration</DialogTitle>
              <DialogDescription>
                Update the registration status for{" "}
                {editingRegistration?.studentName}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value) =>
                    setEditFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editFormData.status === "rejected" && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="rejectionReason" className="text-right">
                    Reason
                  </Label>
                  <Textarea
                    id="rejectionReason"
                    placeholder="Enter rejection reason..."
                    value={editFormData.rejectionReason}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        rejectionReason: e.target.value,
                      }))
                    }
                    className="col-span-3"
                    rows={3}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={savingEdit}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-700">
            Showing page {currentPage} of {totalPages} ({totalStudents} total
            students)
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (currentPage > 1) {
                  setCurrentPage(currentPage - 1);
                }
              }}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum =
                  Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (pageNum > totalPages) return null;

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (pageNum !== currentPage) {
                        setCurrentPage(pageNum);
                      }
                    }}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (currentPage < totalPages) {
                  setCurrentPage(currentPage + 1);
                }
              }}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
}
