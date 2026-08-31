"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Calendar,
  Filter,
  Download,
  User,
  IndianRupee,
  BookOpen,
  School,
  UserCheck,
  FileText,
  Eye,
  Info,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { getDocuments, COLLECTIONS } from "@/lib/firestoreService";
import {
  orderBy,
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
  limit,
  startAfter,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import StudentFilters from "@/components/StudentFilters";
import {
  fetchFilteredRegistrations,
  getRegistrationsCount,
  fetchStudentsByIds,
  fetchMetadata,
  searchRegistrations,
} from "@/lib/firestoreQueries";
import { toast } from "sonner";
import { PDFDocument } from "pdf-lib";
import {
  generateHallTicketPDFBlob,
  downloadHallTicket as downloadHallTicketPDF,
} from "@/lib/hallTicketUtils";
import { fetchHallTicketData } from "@/lib/examDetailQueries";
import { getOrCreateHallTicketNumber } from "@/lib/hallTicketService";
import { doc, getDoc } from "firebase/firestore";

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
    } else {
      dateObj = new Date(dateValue);
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      return "Invalid date";
    }

    return dateObj.toLocaleDateString();
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Date error";
  }
};

// Helper function to normalize class levels
const normalizeClassLevel = (classLevel) => {
  if (!classLevel) return "";
  const normalized = classLevel.toString().trim().toUpperCase();
  if (
    normalized === "U.K.G" ||
    normalized === "U.K.G." ||
    normalized === "UKG"
  ) {
    return "Ukg";
  }
  return classLevel;
};

// Helper function to get sort order for classes
const getClassSortOrder = (classLevel) => {
  if (!classLevel) return 999;
  const normalized = normalizeClassLevel(classLevel);
  if (normalized === "LKG") return -1;
  if (normalized === "Ukg") return 0;
  const numericClass = parseInt(normalized);
  if (!isNaN(numericClass) && numericClass >= 1 && numericClass <= 12) {
    return numericClass;
  }
  return 999;
};

export default function ExamRegistrationsPage() {
  const { user, role } = useAuth();
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data States - Optimized
  const [exams, setExams] = useState([]);
  const [currentPageRegistrations, setCurrentPageRegistrations] = useState([]);
  const [cachedStudents, setCachedStudents] = useState(new Map()); // Cache for viewed students

  // Metadata Caching
  const [madrasaMap, setMadrasaMap] = useState(new Map());
  const [mekhalaMap, setMekhalaMap] = useState(new Map());
  const [mekhalas, setMekhalas] = useState([]);
  const [madrasas, setMadrasas] = useState([]);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const lastDocRef = useRef(null);
  const [loadingPage, setLoadingPage] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedExam, setSelectedExam] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedMekhala, setSelectedMekhala] = useState("all");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [selectedMadrasa, setSelectedMadrasa] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchLoading, setSearchLoading] = useState(false);
  const [viewMode, setViewMode] = useState("table"); // 'table' or 'cards'

  // Dialog States
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);

  // Hall ticket download states
  const [downloadingIndividual, setDownloadingIndividual] = useState({});
  const [downloadingBulk, setDownloadingBulk] = useState(false);

  // Fetch and cache metadata
  const loadMetadata = useCallback(async () => {
    try {
      const { madrasas, mekhalas, madrasaMap, mekhalaMap } =
        await fetchMetadata();
      setMadrasas(madrasas);
      setMekhalas(mekhalas);
      setMadrasaMap(madrasaMap);
      setMekhalaMap(mekhalaMap);
    } catch (error) {
      console.error("Error fetching metadata:", error);
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

  // Initial load - Prioritize registrations and exams
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await fetchExams(); // Load exams first for filter dropdowns
      // We don't wait for metadata here to speed up first paint
      setLoading(false);
    };
    initializeData();

    // Load metadata in background
    loadMetadata();
  }, [fetchExams, loadMetadata]);

  // Load page data with server-side filtering
  const loadPageData = useCallback(async () => {
    setLoadingPage(true);
    try {
      const filters = {
        examId: selectedExam !== "all" ? selectedExam : null,
        classLevel: selectedClass !== "all" ? selectedClass : null,
        paymentStatus:
          selectedStatus !== "all" ? selectedStatus : ["completed", "waived"],
      };

      if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
        const { registrations, total } = await searchRegistrations(
          debouncedSearchTerm,
          filters,
        );
        setTotalCount(total);
        setCurrentPageRegistrations(registrations);
      } else {
        const count = await getRegistrationsCount(filters);
        setTotalCount(count);

        const { registrations, lastVisible } = await fetchFilteredRegistrations(
          filters,
          itemsPerPage,
          currentPage > 1 ? lastDocRef.current : null,
        );

        lastDocRef.current = lastVisible;
        setCurrentPageRegistrations(registrations);

        // Background Enrichment: Prefetch student data for the current page
        if (registrations.length > 0) {
          const studentIds = [
            ...new Set(registrations.map((r) => r.studentId)),
          ];
          fetchStudentsByIds(studentIds)
            .then((students) => {
              setCachedStudents((prev) => {
                const newMap = new Map(prev);
                students.forEach((s) => newMap.set(s.id, s));
                return newMap;
              });
            })
            .catch((err) => console.error("Background prefetch failed:", err));
        }
      }
    } catch (error) {
      console.error("Error loading page data:", error);
      setError("Failed to load registrations");
    } finally {
      setLoadingPage(false);
    }
  }, [
    selectedExam,
    selectedClass,
    selectedStatus,
    currentPage,
    itemsPerPage,
    debouncedSearchTerm,
  ]);

  useEffect(() => {
    if (!loading) {
      loadPageData();
    }
  }, [loading, loadPageData]);

  // Debounce search
  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) {
      setSearchLoading(true);
    }
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setSearchLoading(false);
    }, 1000);
    return () => clearTimeout(handler);
  }, [searchTerm, debouncedSearchTerm]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
    lastDocRef.current = null;
  }, [
    debouncedSearchTerm,
    selectedExam,
    selectedClass,
    selectedStatus,
    selectedMekhala,
    filterDistrict,
    selectedMadrasa,
  ]);

  // Cascading filters logic
  const availableDistricts = useMemo(() => {
    if (selectedMekhala === "all") return [];
    const mekhala = mekhalas.find((m) => m.id === selectedMekhala);
    if (!mekhala || !mekhala.districts) return [];
    return mekhala.districts.map((d) => ({ id: d, name: d }));
  }, [selectedMekhala, mekhalas]);

  const filteredMadrasas = useMemo(() => {
    let list = madrasas;
    if (selectedMekhala !== "all") {
      const mekhala = mekhalas.find((m) => m.id === selectedMekhala);
      if (mekhala && mekhala.districts) {
        list = list.filter((m) => mekhala.districts.includes(m.district));
      }
    }
    if (filterDistrict !== "all") {
      list = list.filter((m) => m.district === filterDistrict);
    }
    return list;
  }, [madrasas, selectedMekhala, filterDistrict, mekhalas]);

  // Enrich registrations using Maps
  const enrichedRegistrations = useMemo(() => {
    return currentPageRegistrations.map((registration) => {
      const madrasa = madrasaMap.get(registration.madarsaId);

      let mekhalaId = null;
      let mekhalaName = null;
      let districtName = null;

      if (madrasa) {
        districtName = madrasa.district || null;
        mekhalaName = madrasa.mekhala || null;
        if (mekhalaName) {
          const mekhala = mekhalas.find(
            (mk) =>
              mk.id === mekhalaName ||
              mk.name?.toUpperCase() === mekhalaName.toUpperCase(),
          );
          if (mekhala) mekhalaId = mekhala.id;
        }
      }

      return {
        ...registration,
        madrasaData: madrasa || null,
        mekhalaId,
        mekhalaName,
        districtName,
      };
    });
  }, [currentPageRegistrations, madrasaMap, mekhalas]);

  // Final filtered list (client side for gender, mekhala, district, madrasa)
  const filteredRegistrations = useMemo(() => {
    let filtered = enrichedRegistrations;
    if (selectedGender !== "all") {
      filtered = filtered.filter((reg) => reg.gender === selectedGender);
    }
    if (selectedMekhala !== "all") {
      filtered = filtered.filter((reg) => reg.mekhalaId === selectedMekhala);
    }
    if (filterDistrict !== "all") {
      filtered = filtered.filter((reg) => reg.districtName === filterDistrict);
    }
    if (selectedMadrasa !== "all") {
      filtered = filtered.filter(
        (reg) =>
          reg.madrasaData &&
          (reg.madrasaData.id === selectedMadrasa ||
            reg.madrasaData.madarsaId === selectedMadrasa),
      );
    }
    return filtered;
  }, [
    enrichedRegistrations,
    selectedGender,
    selectedMekhala,
    filterDistrict,
    selectedMadrasa,
  ]);

  // Stats calculation
  const stats = useMemo(() => {
    const totalRevenue = enrichedRegistrations
      .filter((r) => r.paymentStatus === "completed")
      .reduce((sum, r) => sum + (parseFloat(r.examFees) || 0), 0);

    return {
      totalRegistrations: totalCount,
      completedPayments: totalCount, // Approximation based on filter
      pendingPayments: 0,
      totalRevenue,
    };
  }, [totalCount, enrichedRegistrations]);

  // Handlers
  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedExam("all");
    setSelectedGender("all");
    setSelectedMekhala("all");
    setFilterDistrict("all");
    setSelectedMadrasa("all");
    setSelectedClass("all");
    setSelectedStatus("all");
  };

  const viewStudentDetails = async (registration) => {
    try {
      setLoadingPage(true); // Reuse loading state for modal fetch
      let student = cachedStudents.get(registration.studentId);

      if (!student) {
        // Fetch specific student document
        const students = await fetchStudentsByIds([registration.studentId]);
        if (students.length > 0) {
          student = students[0];
          setCachedStudents((prev) =>
            new Map(prev).set(registration.studentId, student),
          );
        }
      }

      if (student) {
        const madrasa = madrasaMap.get(
          student.madarsaId || registration.madarsaId,
        );
        setSelectedStudent({
          registration,
          student,
          madrasaName: madrasa?.name || registration.madarsaId || "N/A",
          mekhalaName: registration.mekhalaName || "N/A",
        });
        setIsStudentDialogOpen(true);
      } else {
        setError("Student details not found");
      }
    } catch (err) {
      console.error("Error fetching student details:", err);
      setError("Failed to load student details");
    } finally {
      setLoadingPage(false);
    }
  };

  const exportRegistrationsCsv = () => {
    if (filteredRegistrations.length === 0) return;
    const headers = [
      "Reg ID",
      "Student",
      "Email",
      "Phone",
      "Madrasa",
      "Class",
      "Exam",
      "Fees",
      "Status",
      "Date",
    ];
    const rows = filteredRegistrations.map((r) => [
      r.id,
      r.studentName || "",
      r.studentEmail || "",
      r.studentPhone || "",
      r.madrasaData?.name || "",
      r.classLevel || "",
      r.examTitle || "",
      r.examFees || "",
      r.paymentStatus || "",
      formatDate(r.createdAt),
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((e) => e.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `registrations_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    link.click();
  };

  // Get profile picture helper
  const getProfilePicture = async (student, admissionNumber, madarsaId) => {
    if (student?.profilePictureUrl || student?.profilePicture) {
      return student.profilePictureUrl || student.profilePicture;
    }

    if (admissionNumber && madarsaId) {
      try {
        const admissionsData = await getDocuments(COLLECTIONS.ADMISSIONS, [
          where("admissionNumber", "==", admissionNumber),
          where("madarsa", "==", madarsaId),
        ]);

        if (admissionsData.length > 0) {
          const admission = admissionsData[0];
          return admission.profilePicture || admission.profilePictureUrl || "";
        }
      } catch (error) {
        console.error("Error fetching profile picture from admissions:", error);
      }
    }

    return "";
  };

  // Helper: Prepare hall ticket data for a single student
  const prepareHallTicketData = async (student, registration) => {
    try {
      // Find the specific exam
      const exam = exams.find((e) => e.id === registration.examId);

      // Try to fetch pre-computed hall ticket data from hallTickets collection first
      const hallTicketData = await fetchHallTicketData(
        registration.examId,
        student.id,
      );

      if (hallTicketData) {
        return {
          hallTicketNumber:
            hallTicketData.hallTicketNumber ||
            registration?.hallTicketNumber ||
            "000000",
          examTitle: hallTicketData.examTitle || exam?.title || "N/A",
          fullName: hallTicketData.fullName || student.fullName || "N/A",
          middleName:
            hallTicketData.middleName ||
            student?.middleName ||
            student?.midNumber ||
            "",
          midNumber: hallTicketData.midNumber || student?.midNumber || "",
          admissionNumber:
            hallTicketData.admissionNumber || student.admissionNumber || "N/A",
          classLevel: hallTicketData.classLevel || student.classLevel || "N/A",
          gender: hallTicketData.gender || student.gender || "N/A",
          guardianName:
            hallTicketData.guardianName ||
            student.guardianName ||
            student.guardian ||
            "N/A",
          dateOfBirth:
            student.dateOfBirth || hallTicketData.dateOfBirth || "N/A",
          guardianPhone:
            hallTicketData.guardianPhone || student.guardianPhone || "N/A",
          madarsa:
            hallTicketData.madarsa ||
            madrasaMap.get(student.madarsaId)?.name ||
            "N/A",
          madarsaId: hallTicketData.madarsaId || student?.madarsaId || null,
          mekhala: hallTicketData.mekhala || "N/A",
          sadarName: hallTicketData.sadarName || "N/A",
          sadarAddress: hallTicketData.sadarAddress || "N/A",
          examDate: hallTicketData.examDate || registration?.examDate,
          createdAt: hallTicketData.createdAt || registration?.createdAt,
          profilePictureUrl: hallTicketData.profilePictureUrl || "",
          examFees: hallTicketData.examFees || registration?.examFees || 0,
          timetableEntries:
            hallTicketData.timetableEntries || exam?.timetable || [],
        };
      }

      console.warn(
        "Hall ticket data not found in collection, falling back to manual generation",
      );

      // Fallback: manual generation
      let hallTicketNumber = registration?.hallTicketNumber;
      if (!hallTicketNumber && registration) {
        hallTicketNumber = await getOrCreateHallTicketNumber(
          registration.id,
          registration.examId,
        );
      }

      const profilePictureUrl = await getProfilePicture(
        student,
        student.admissionNumber,
        student.madarsaId,
      );

      const madrasa = madrasaMap.get(registration.madarsaId);

      return {
        hallTicketNumber: hallTicketNumber || "000000",
        examTitle: registration.examTitle,
        fullName: student.fullName || registration.studentName,
        admissionNumber: student.admissionNumber || "N/A",
        classLevel: student.classLevel || registration.classLevel,
        gender: student.gender || "N/A",
        dateOfBirth: student.dateOfBirth || "N/A",
        guardianPhone: student.phone || "N/A",
        madarsa: madrasa?.name || registration.madarsaId || "N/A",
        madarsaId: registration.madarsaId,
        mekhala: madrasa?.mekhala || "N/A",
        sadarName: madrasa?.adminName || "N/A",
        sadarAddress: madrasa?.address || "N/A",
        examDate: registration.examDate,
        createdAt: registration.createdAt,
        profilePictureUrl,
        examFees: registration.examFees || 0,
        timetableEntries: exam?.timetable || [],
      };
    } catch (error) {
      console.error("Error in prepareHallTicketData:", error);
      throw error;
    }
  };

  // Download individual hall ticket
  const downloadHallTicket = async (registration) => {
    setDownloadingIndividual((prev) => ({ ...prev, [registration.id]: true }));
    const toastId = toast.loading("Generating hall ticket...");

    try {
      // Fetch student details if not cached
      let student = cachedStudents.get(registration.studentId);
      if (!student) {
        const students = await fetchStudentsByIds([registration.studentId]);
        if (students.length > 0) {
          student = students[0];
          setCachedStudents((prev) =>
            new Map(prev).set(registration.studentId, student),
          );
        }
      }

      if (!student) {
        throw new Error("Student details not found");
      }

      const hallTicketData = await prepareHallTicketData(student, registration);

      // Use the utility for downloading
      await downloadHallTicketPDF(hallTicketData);

      toast.success("Hall ticket downloaded successfully", { id: toastId });
    } catch (error) {
      console.error("Error downloading hall ticket:", error);
      toast.error("Failed to download hall ticket", { id: toastId });
    } finally {
      setDownloadingIndividual((prev) => ({
        ...prev,
        [registration.id]: false,
      }));
    }
  };

  // Download all hall tickets as merged PDF
  const downloadAllHallTickets = async () => {
    // Only download for currently filtered/displayed registrations
    const registrationsToDownload = filteredRegistrations.filter(
      (reg) =>
        reg.paymentStatus === "completed" || reg.paymentStatus === "waived",
    );

    if (registrationsToDownload.length === 0) {
      toast.error(
        "No approved registrations in current view to download hall tickets.",
      );
      return;
    }

    try {
      setDownloadingBulk(true);
      const toastId = toast.loading("Preparing hall tickets...");

      const mergedPdf = await PDFDocument.create();
      let processedCount = 0;

      for (const registration of registrationsToDownload) {
        try {
          // Fetch student details if not cached
          let student = cachedStudents.get(registration.studentId);
          if (!student) {
            const students = await fetchStudentsByIds([registration.studentId]);
            if (students.length > 0) {
              student = students[0];
              setCachedStudents((prev) =>
                new Map(prev).set(registration.studentId, student),
              );
            }
          }

          if (!student) {
            console.error(`Student not found for ${registration.id}`);
            continue;
          }

          const hallTicketData = await prepareHallTicketData(
            student,
            registration,
          );

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
            `Processed ${processedCount}/${registrationsToDownload.length} hall tickets...`,
            { id: toastId },
          );
        } catch (err) {
          console.error(
            `Error generating PDF for ${registration.studentName}:`,
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
      const fileName = `Bulk_Hall_Tickets_${
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
      console.error("Error creating bulk download:", error);
      toast.error("Failed to download hall tickets");
    } finally {
      setDownloadingBulk(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Exam Registrations
            </h1>
            <p className="text-sm text-gray-600">
              Manage exam registrations with optimized performance.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
            >
              <FileText className="h-4 w-4 mr-2" /> Table
            </Button>
            <Button
              variant={viewMode === "cards" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("cards")}
            >
              <Eye className="h-4 w-4 mr-2" /> Cards
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Total Registrations"
            value={stats.totalRegistrations}
            color="text-blue-600"
          />
          <StatCard
            icon={UserCheck}
            label="Completed Payments"
            value={stats.completedPayments}
            color="text-green-600"
          />
          <StatCard
            icon={Users}
            label="Pending Payments"
            value={stats.pendingPayments}
            color="text-orange-600"
          />
          <StatCard
            icon={IndianRupee}
            label="Total Revenue"
            value={`₹${stats.totalRevenue}`}
            color="text-purple-600"
          />
        </div>

        {/* Filters */}
        <StudentFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterMekhala={selectedMekhala}
          setFilterMekhala={setSelectedMekhala}
          filterDistrict={filterDistrict}
          setFilterDistrict={setFilterDistrict}
          filterMahal={selectedMadrasa}
          setFilterMahal={setSelectedMadrasa}
          filterGender={selectedGender}
          setFilterGender={setSelectedGender}
          filterClass={selectedClass}
          setFilterClass={setSelectedClass}
          filterStatus={selectedStatus}
          setFilterStatus={setSelectedStatus}
          mekhalas={mekhalas}
          districts={availableDistricts}
          madarsas={filteredMadrasas}
          classes={[...new Set(exams.flatMap((e) => e.classes || []))].sort(
            (a, b) => a - b,
          )}
          loading={loadingPage}
          searchLoading={searchLoading}
        />

        <div className="flex justify-between items-center">
          <Button
            onClick={clearAllFilters}
            variant="ghost"
            size="sm"
            className="text-gray-500"
          >
            <X className="h-4 w-4 mr-1" /> Clear Filters
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={exportRegistrationsCsv}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button
              onClick={downloadAllHallTickets}
              disabled={downloadingBulk || filteredRegistrations.length === 0}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              {downloadingBulk ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloadingBulk
                ? "Preparing..."
                : `Download Hall Tickets (${filteredRegistrations.length})`}
            </Button>
          </div>
        </div>

        {/* Table/Cards View */}
        {viewMode === "table" ? (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Madrasa</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Exam</th>
                  <th className="px-4 py-3">Fees</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRegistrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {reg.studentName || reg.studentData?.fullName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {reg.studentEmail || reg.studentData?.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {reg.madrasaData?.name || reg.madarsaId}
                    </td>
                    <td className="px-4 py-3">{reg.classLevel}</td>
                    <td className="px-4 py-3">{reg.examTitle}</td>
                    <td className="px-4 py-3">₹{reg.examFees}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          reg.paymentStatus === "completed"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {reg.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewStudentDetails(reg)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadHallTicket(reg)}
                          disabled={downloadingIndividual[reg.id]}
                          title="Download Hall Ticket"
                        >
                          {downloadingIndividual[reg.id] ? (
                            <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRegistrations.length === 0 && !loadingPage && (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-4 py-10 text-center text-gray-500"
                    >
                      No registrations found matching the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRegistrations.map((reg) => (
              <Card key={reg.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {reg.studentName || reg.studentData?.fullName}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {reg.studentEmail || reg.studentData?.email}
                      </p>
                    </div>
                    <Badge
                      variant={
                        reg.paymentStatus === "completed"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {reg.paymentStatus}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Class:</span>{" "}
                      {reg.classLevel}
                    </div>
                    <div>
                      <span className="text-gray-500">Exam:</span>{" "}
                      {reg.examTitle}
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Madrasa:</span>{" "}
                      {reg.madrasaData?.name}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => viewStudentDetails(reg)}
                    >
                      <Info className="h-4 w-4 mr-2" /> View Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => downloadHallTicket(reg)}
                      disabled={downloadingIndividual[reg.id]}
                    >
                      {downloadingIndividual[reg.id] ? (
                        <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Hall Ticket
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-600">
            Showing {filteredRegistrations.length} of {totalCount} registrations
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1 || loadingPage}
              onClick={() => setCurrentPage((prev) => prev - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage * itemsPerPage >= totalCount || loadingPage}
              onClick={() => setCurrentPage((prev) => prev + 1)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Dialogs */}
        <RegistrationDetailDialog
          open={isStudentDialogOpen}
          onOpenChange={setIsStudentDialogOpen}
          data={selectedStudent}
        />
      </div>
    </Layout>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <Icon className={`h-8 w-8 ${color}`} />
        <div>
          <p className="text-xs font-medium text-gray-600">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RegistrationDetailDialog({ open, onOpenChange, data }) {
  if (!data) return null;
  const { registration, student, madrasaName, mekhalaName } = data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle>Registration Details</DialogTitle>
            <DialogDescription>
              Full information for {student.fullName}
            </DialogDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadHallTicket(registration)}
            disabled={downloadingIndividual[registration.id]}
          >
            {downloadingIndividual[registration.id] ? (
              <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download Hall Ticket
          </Button>
        </DialogHeader>
        <div className="space-y-4">
          <DetailSection title="Personal Information" icon={User}>
            <DetailItem label="Full Name" value={student.fullName} />
            <DetailItem label="Gender" value={student.gender} />
            <DetailItem label="Email" value={student.email} />
            <DetailItem label="Phone" value={student.phone} />
            <DetailItem label="Address" value={student.address} />
          </DetailSection>

          <DetailSection title="Academic Details" icon={School}>
            <DetailItem label="Madrasa" value={madrasaName} />
            <DetailItem label="Mekhala" value={mekhalaName} />
            <DetailItem
              label="Class"
              value={
                String(registration.classLevel || "").toUpperCase() === "UKG"
                  ? "Ukg"
                  : registration.classLevel
              }
            />
            <DetailItem label="Admission No" value={student.admissionNumber} />
          </DetailSection>

          <DetailSection title="Registration Info" icon={BookOpen}>
            <DetailItem label="Exam" value={registration.examTitle} />
            <DetailItem label="Fees" value={`₹${registration.examFees}`} />
            <DetailItem
              label="Status"
              value={registration.paymentStatus}
              badge
            />
            <DetailItem
              label="Date"
              value={formatDate(registration.createdAt)}
            />
          </DetailSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailSection({ title, icon: Icon, children }) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 font-bold text-gray-800 border-b pb-2">
        <Icon className="h-5 w-5" /> {title}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        {children}
      </div>
    </div>
  );
}

function DetailItem({ label, value, badge = false }) {
  return (
    <div>
      <Label className="text-xs text-gray-500">{label}</Label>
      {badge ? (
        <div>
          <Badge>{value}</Badge>
        </div>
      ) : (
        <p className="text-sm font-medium">{value || "N/A"}</p>
      )}
    </div>
  );
}
