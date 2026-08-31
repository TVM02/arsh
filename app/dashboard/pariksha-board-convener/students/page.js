"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Pagination } from "@/components/ui/pagination";
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
  Phone,
  Mail,
  MapPin,
  FileSpreadsheet,
  Printer,
  Eye,
  X,
  Search as SearchIcon,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { getDocuments, COLLECTIONS } from "@/lib/firestoreService";
import { orderBy } from "firebase/firestore";
import useAuthStore from "@/lib/authStore";
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
import {
  doc,
  getDoc,
  collection,
  where,
  getDocs,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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

export default function RegisteredStudents() {
  const { user, role } = useAuth();
  const { userData } = useAuthStore();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState("");

  // Data States - Optimized
  const [exams, setExams] = useState([]);
  const [currentPageRegistrations, setCurrentPageRegistrations] = useState([]);
  const [cachedStudents, setCachedStudents] = useState(new Map());

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

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedExam, setSelectedExam] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedMekhala, setSelectedMekhala] = useState("all");
  const [selectedMadrasa, setSelectedMadrasa] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedType, setSelectedType] = useState("all"); // All / madrasa / mekhala / state
  const [searchLoading, setSearchLoading] = useState(false);
  const [madrasaSearchOpen, setMadrasaSearchOpen] = useState(false);

  // Stats state
  const [stats, setStats] = useState({
    totalRegistrations: 0,
    maleStudents: 0,
    femaleStudents: 0,
    totalRevenue: 0,
  });

  const [downloadingIndividual, setDownloadingIndividual] = useState({});

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

  // Initial load
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await fetchExams();
      setLoading(false);
    };
    initializeData();

    // Load metadata in background
    loadMetadata();
  }, [fetchExams, loadMetadata]);

  // Handle URL parameters for exam filtering
  useEffect(() => {
    const examParam = searchParams.get("exam");
    if (examParam && examParam !== selectedExam) {
      setSelectedExam(examParam);
    }
  }, [searchParams, selectedExam]);

  // Fetch stats
  const fetchStats = useCallback(
    async (filters) => {
      try {
        // For now, use the count we already have
        // In a real app, you'd want separate aggregation queries
        const totalRegistrations = totalCount;

        setStats({
          totalRegistrations,
          maleStudents: 0, // Would need separate query
          femaleStudents: 0, // Would need separate query
          totalRevenue: 0, // Would need separate query
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    },
    [totalCount],
  );

  // Load page data with server-side filtering
  const loadPageData = useCallback(async () => {
    setLoadingPage(true);
    try {
      const classActive = selectedClass && selectedClass !== "all";
      const filters = {
        examId: selectedExam !== "all" ? selectedExam : null,
        classLevel: classActive ? selectedClass : null,
        madarsaId: selectedMadrasa !== "all" ? selectedMadrasa : null,
        paymentStatus: ["completed", "waived"],
        // _page is used by fetchFilteredRegistrations for manual pagination
        // when class filter is active (cursor-based pagination can't be used then)
        _page: classActive ? currentPage : undefined,
      };

      if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
        const { registrations, total } = await searchRegistrations(
          debouncedSearchTerm,
          filters,
        );
        setTotalCount(total);
        setCurrentPageRegistrations(registrations);
      } else {
        // When class filter is active, fetchFilteredRegistrations handles count
        // internally and returns _totalFiltered — no need to call getRegistrationsCount
        if (classActive) {
          const { registrations, _totalFiltered } =
            await fetchFilteredRegistrations(filters, itemsPerPage, null);
          setTotalCount(_totalFiltered ?? 0);
          setCurrentPageRegistrations(registrations);

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
              .catch((err) =>
                console.error("Background prefetch failed:", err),
              );
          }
        } else {
          const count = await getRegistrationsCount(filters);
          setTotalCount(count);

          const { registrations, lastVisible } =
            await fetchFilteredRegistrations(
              filters,
              itemsPerPage,
              currentPage > 1 ? lastDocRef.current : null,
            );

          lastDocRef.current = lastVisible;
          setCurrentPageRegistrations(registrations);

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
              .catch((err) =>
                console.error("Background prefetch failed:", err),
              );
          }
        }
      }

      // Fetch stats separately
      fetchStats(filters);
    } catch (error) {
      console.error("Error loading page data:", error);
      setError("Failed to load registrations");
    } finally {
      setLoadingPage(false);
    }
  }, [
    selectedExam,
    selectedClass,
    selectedMadrasa,
    currentPage,
    itemsPerPage,
    debouncedSearchTerm,
    fetchStats,
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
    selectedMadrasa,
    selectedMekhala,
  ]);

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedExam("all");
    setSelectedGender("all");
    setSelectedMadrasa("all");
    setSelectedMekhala("all");
    setSelectedClass("all");
  };

  // Export to CSV function
  const exportToCSV = () => {
    if (currentPageRegistrations.length === 0) {
      toast.error("No registrations to export");
      return;
    }

    const toastId = toast.loading("Preparing CSV export...");

    try {
      const headers = [
        "Registration ID",
        "Student Name",
        "Email",
        "Phone",
        "Gender",
        "Class",
        "Madrasa",
        "Exam Title",
        "Exam Fees",
        "Payment Status",
        "Registration Date",
      ];

      const csvData = currentPageRegistrations.map((registration) => {
        const student = cachedStudents.get(registration.studentId) || {};

        return [
          registration.id || "",
          registration.studentName || student.fullName || "",
          registration.studentEmail || student.email || "",
          registration.studentPhone || student.phone || "",
          student.gender || registration.gender || "",
          registration.classLevel ||
            registration.class ||
            student.classLevel ||
            "",
          student.madarsaId || registration.madarsa || "",
          registration.examTitle || "",
          registration.examFees || "",
          registration.paymentStatus || "",
          formatDate(registration.createdAt),
        ];
      });

      const csvContent = [
        headers.join(","),
        ...csvData.map((row) => row.map((field) => `"${field}"`).join(",")),
      ].join("\n");

      // Add UTF-8 BOM for Malayalam support
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `registered_students_${new Date().toISOString().split("T")[0]}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("CSV exported successfully", { id: toastId });
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export CSV", { id: toastId });
    }
  };

  // Print function
  const printList = () => {
    const exam = exams.find((e) => e.id === selectedExam);
    const examTitle = exam?.title || "All Exams";

    const printWindow = window.open("", "_blank");

    printWindow.document.write(`
      <html>
        <head>
          <title>Registered Students - ${examTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .print-date { text-align: right; font-size: 10px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DKJU - Registered Students List</h1>
            <h2>${examTitle}</h2>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Student Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Gender</th>
                <th>Class</th>
                <th>Madrasa</th>
                <th>Payment Status</th>
                <th>Registration Date</th>
              </tr>
            </thead>
            <tbody>
              ${currentPageRegistrations
                .map((registration, index) => {
                  const student =
                    cachedStudents.get(registration.studentId) || {};
                  return `
                  <tr>
                    <td>${(currentPage - 1) * itemsPerPage + index + 1}</td>
                    <td>${
                      registration.studentName || student.fullName || ""
                    }</td>
                    <td>${registration.studentEmail || student.email || ""}</td>
                    <td>${registration.studentPhone || student.phone || ""}</td>
                    <td>${student.gender || registration.gender || ""}</td>
                    <td>${registration.classLevel || registration.class || student.classLevel || ""}</td>
                    <td>${student.madarsaId || registration.madarsa || ""}</td>
                    <td>${registration.paymentStatus || ""}</td>
                    <td>${formatDate(registration.createdAt)}</td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
          
          <div class="print-date">
            Generated on: ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading registered students...</p>
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
            Registered Students List
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Manage and view all exam registrations with advanced filtering and
            export options
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
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-teal-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Total Registrations
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {totalCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <User className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Current Page
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {currentPageRegistrations.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Total Pages
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {Math.ceil(totalCount / itemsPerPage)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Active Exams
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {exams.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Export Actions */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg sm:text-xl">
                Filter & Export Students
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={exportToCSV}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={currentPageRegistrations.length === 0}
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button
                  onClick={printList}
                  className="bg-gray-600 hover:bg-gray-700"
                  disabled={currentPageRegistrations.length === 0}
                  size="sm"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Clear All Filters Button */}
            <div className="mb-4 flex justify-end">
              <Button
                onClick={clearAllFilters}
                variant="outline"
                size="sm"
                className="text-gray-600"
              >
                <X className="h-4 w-4 mr-2" />
                Clear All Filters
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Search */}
              <div className="lg:col-span-3">
                <Label>Search Students</Label>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Name, email, phone, admission #..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  {searchLoading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Exam Filter */}
              <div>
                <Label>Filter by Exam</Label>
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Exams" />
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

              {/* Institution Type Filter */}
              <div>
                <Label>Institution Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="madrasa">Madrasa</SelectItem>
                    <SelectItem value="mekhala">Mekhala</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Class Filter */}
              <div>
                <Label>Filter by Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Classes</SelectItem>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((cls) => (
                      <SelectItem key={cls} value={cls.toString()}>
                        Class {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Madrasa Filter */}
              <div>
                <Label>Filter by Madrasa</Label>
                <Popover
                  open={madrasaSearchOpen}
                  onOpenChange={setMadrasaSearchOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={madrasaSearchOpen}
                      className="w-full justify-between"
                    >
                      {selectedMadrasa === "all"
                        ? "All Madrasas"
                        : madrasas.find((m) => m.madarsaId === selectedMadrasa)
                          ? `${
                              madrasas.find(
                                (m) => m.madarsaId === selectedMadrasa,
                              )?.madarsaId
                            } - ${
                              madrasas.find(
                                (m) => m.madarsaId === selectedMadrasa,
                              )?.name
                            }`
                          : "Select madrasa..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command className="bg-white">
                      <CommandInput placeholder="Search madrasa..." />
                      <CommandEmpty>No madrasa found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setSelectedMadrasa("all");
                            setMadrasaSearchOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              selectedMadrasa === "all"
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />
                          All Madrasas
                        </CommandItem>
                        {madrasas.map((madrasa) => (
                          <CommandItem
                            key={madrasa.id}
                            value={`${madrasa.madarsaId} ${madrasa.name}`}
                            onSelect={() => {
                              setSelectedMadrasa(madrasa.madarsaId);
                              setMadrasaSearchOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedMadrasa === madrasa.madarsaId
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                            {madrasa.madarsaId} - {madrasa.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Students List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Registered Students
                  <Badge
                    variant="secondary"
                    className="bg-teal-50 text-teal-700 border-teal-100 font-bold"
                  >
                    {totalCount} Total
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1">
                  Viewing results for the selected filters
                </CardDescription>
              </div>
              {totalCount > 0 && (
                <div className="text-xs text-gray-500 font-medium">
                  {(() => {
                    const start = (currentPage - 1) * itemsPerPage + 1;
                    const end = Math.min(
                      currentPage * itemsPerPage,
                      totalCount,
                    );
                    return start === end
                      ? `Showing ${start} of ${totalCount}`
                      : `Showing ${start} - ${end} of ${totalCount}`;
                  })()}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingPage ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-600 mt-3">
                  Loading students...
                </p>
              </div>
            ) : currentPageRegistrations.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No registered students found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentPageRegistrations.map((registration) => {
                  const student =
                    cachedStudents.get(registration.studentId) || {};
                  const exam = exams.find((e) => e.id === registration.examId);
                  const madrasa = madrasaMap.get(
                    student.madarsaId || registration.madarsaId,
                  );

                  return (
                    <Card
                      key={registration.id}
                      className="group hover:shadow-lg transition-all duration-300 border-l-4 border-l-teal-500 overflow-hidden"
                    >
                      <CardContent className="p-0">
                        {/* Header with gradient background */}
                        <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-4 border-b">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {/* Name and Class */}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-gray-900 truncate text-base">
                                  {registration.studentName || student.fullName}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {(registration.classLevel ||
                                    registration.class ||
                                    student.classLevel) && (
                                    <Badge className="bg-teal-600 text-white hover:bg-teal-700 text-xs">
                                      Class{" "}
                                      {(() => {
                                        const v =
                                          registration.classLevel ||
                                          registration.class ||
                                          student.classLevel;
                                        return String(v || "").toUpperCase() ===
                                          "UKG"
                                          ? "Ukg"
                                          : v;
                                      })()}
                                    </Badge>
                                  )}
                                  {student.gender && (
                                    <Badge className="bg-teal-600 text-white hover:bg-teal-700 text-xs capitalize">
                                      {student.gender}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Payment Status Badge */}
                            <Badge
                              className={`flex-shrink-0 ${
                                registration.paymentStatus === "completed"
                                  ? "bg-green-500 hover:bg-green-600"
                                  : registration.paymentStatus === "waived"
                                    ? "bg-blue-500 hover:bg-blue-600"
                                    : "bg-yellow-500 hover:bg-yellow-600"
                              }`}
                            >
                              {registration.paymentStatus}
                            </Badge>
                          </div>
                        </div>

                        {/* Body with contact and exam info */}
                        <div className="p-4 space-y-3">
                          {/* Contact Information */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Mail className="h-4 w-4 text-teal-600 flex-shrink-0" />
                              <span className="truncate">
                                {registration.studentEmail ||
                                  student.email ||
                                  "N/A"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="h-4 w-4 text-teal-600 flex-shrink-0" />
                              <span>
                                {registration.studentPhone ||
                                  student.phone ||
                                  "N/A"}
                              </span>
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="border-t border-gray-100"></div>

                          {/* Academic Information */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <School className="h-4 w-4 text-purple-600 flex-shrink-0" />
                              <span className="text-gray-700 font-medium truncate">
                                {madrasa?.name ||
                                  student.madarsaId ||
                                  registration.madarsa ||
                                  "N/A"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <BookOpen className="h-4 w-4 text-orange-600 flex-shrink-0" />
                              <span className="text-gray-700 truncate">
                                {exam?.title || registration.examTitle}
                              </span>
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="border-t border-gray-100"></div>

                          {/* Footer with fees and date */}
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1 text-green-700 font-semibold">
                              <IndianRupee className="h-4 w-4" />
                              <span>{registration.examFees || "0"}</span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-500 text-xs">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(registration.createdAt)}</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2">
                            <Button
                              onClick={() => downloadHallTicket(registration)}
                              disabled={downloadingIndividual[registration.id]}
                              className="w-full bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center gap-2"
                              size="sm"
                            >
                              {downloadingIndividual[registration.id] ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              Download Hall Ticket
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalCount > itemsPerPage && (
          <div className="flex justify-center">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalCount / itemsPerPage)}
              onPageChange={setCurrentPage}
              totalItems={totalCount}
              itemsPerPage={itemsPerPage}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
