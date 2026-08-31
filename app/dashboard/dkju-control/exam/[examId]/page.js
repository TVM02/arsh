"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/authUtils";
import Layout from "@/components/Layout";
import StudentFilters from "@/components/StudentFilters";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  UserCheck,
  UserX,
  Eye,
  User,
  Mail,
  Phone,
  School,
  BookOpen,
  MapPin,
  Calendar,
  Download,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Printer,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  GraduationCap,
  Edit,
  DollarSign,
  FileCheck,
  ClipboardList,
} from "lucide-react";
import { getDocuments, COLLECTIONS, getDocument } from "@/lib/firestoreService";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  addDoc,
  deleteDoc,
  doc,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateHallTicketNumber } from "@/lib/pdfUtils";
import {
  getNextHallTicketNumber,
  getOrCreateHallTicketNumber,
  batchGenerateHallTicketNumbers,
  generateFormattedHallTicketNumber,
} from "@/lib/hallTicketService";
import {
  generateHallTicketHTML,
  downloadHallTicket as downloadHallTicketPDF,
  generateHallTicketPDFBlob,
} from "@/lib/hallTicketUtils";
import {
  saveHallTicketData,
  batchSaveHallTicketData,
} from "@/lib/hallTicketDataService";
import { toast } from "sonner";
import { PDFDocument } from "pdf-lib";
import {
  fetchExamRegistrationIds,
  fetchStudentsByIds,
  fetchUnregisteredStudents,
  getExamRegistrationsCount,
  getUnregisteredStudentsCount,
  fetchInstitutionsMetadata,
} from "@/lib/examDetailQueries";

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

// Helper to format student name (UI level)
const formatStudentName = (name) => {
  if (!name) return "";
  return name
    .toString()
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
};

// Helper function to get madrasa name (using Map for O(1) lookup)
const getMadrasaName = (madrasaId, madrasaMapOrList) => {
  if (!madrasaId) return "N/A";

  // Support both Map and Array for backward compatibility
  if (madrasaMapOrList instanceof Map) {
    const madrasa = madrasaMapOrList.get(madrasaId);
    return madrasa?.name || madrasaId;
  }

  // Fallback to array find
  const madrasa = madrasaMapOrList.find(
    (m) => m.id === madrasaId || m.madarsaId === madrasaId,
  );
  return madrasa?.name || madrasaId;
};

// Helper function to get mekhala name by matching district with mekhala.districts array
const getMekhalaNameByDistrict = (madrasaId, madrasasList, mekhalasList) => {
  if (!madrasaId) return "N/A";

  // Find the madarsa
  const madarsa = madrasasList.find(
    (m) => m.id === madrasaId || m.madarsaId === madrasaId,
  );

  if (!madarsa) return "N/A";

  // If no district field, return N/A
  if (!madarsa.district) return "N/A";

  // Find mekhala by checking if madarsa.district is in mekhala.districts array
  const mekhala = mekhalasList.find(
    (mk) =>
      Array.isArray(mk.districts) &&
      mk.districts.some(
        (d) => d.toUpperCase() === madarsa.district.toUpperCase(),
      ),
  );

  // If mekhala found, return its name
  if (mekhala) {
    return mekhala.name || mekhala.region || "N/A";
  }

  // Fallback: try matching by region or name
  const fallbackMekhala = mekhalasList.find(
    (m) =>
      m.region?.toUpperCase() === madarsa.district?.toUpperCase() ||
      m.name?.toUpperCase() === madarsa.district?.toUpperCase(),
  );

  if (fallbackMekhala) {
    return fallbackMekhala.name || fallbackMekhala.region || "N/A";
  }

  // Last fallback: return the district name itself
  return madarsa.district || "N/A";
};

// Helper function to get district name from madarsa
const getDistrictName = (madrasaId, madrasasList) => {
  if (!madrasaId) return "N/A";

  const madarsa = madrasasList.find(
    (m) => m.id === madrasaId || m.madarsaId === madrasaId,
  );

  return madarsa?.district || "N/A";
};

// Helper function to normalize class level (treat UKG variations as same)
const normalizeClassLevel = (classLevel) => {
  if (!classLevel) return "N/A";
  const normalized = classLevel.toString().toUpperCase().trim();
  // Normalize UKG variations to canonical "Ukg"
  if (
    normalized === "UKG" ||
    normalized === "U.K.G" ||
    normalized === "U.K.G."
  ) {
    return "Ukg";
  }
  return classLevel;
};

// Helper function to get class sort order (Ukg = 0, 1-12 = 1-12, others = 999)
const getClassSortOrder = (classLevel) => {
  if (!classLevel) return 999;
  const normalized = normalizeClassLevel(classLevel)
    .toString()
    .toUpperCase()
    .trim();

  // Ukg comes first
  if (normalized === "UKG") return 0;

  // LKG comes before Ukg if it exists
  if (normalized === "LKG" || normalized === "L.K.G" || normalized === "L.K.G.")
    return -1;

  // Numeric classes 1-12
  const numClass = parseInt(normalized);
  if (!isNaN(numClass) && numClass >= 1 && numClass <= 12) {
    return numClass;
  }

  // Everything else goes to the end
  return 999;
};

// Helper: Convert class number to Roman numeral
const toRomanIfNumber = (num) => {
  if (!num) return "N/A";
  const numberValue = parseInt(num);
  if (isNaN(numberValue)) return num;

  const romanNumerals = [
    { value: 12, numeral: "XII" },
    { value: 11, numeral: "XI" },
    { value: 10, numeral: "X" },
    { value: 9, numeral: "IX" },
    { value: 8, numeral: "VIII" },
    { value: 7, numeral: "VII" },
    { value: 6, numeral: "VI" },
    { value: 5, numeral: "V" },
    { value: 4, numeral: "IV" },
    { value: 3, numeral: "III" },
    { value: 2, numeral: "II" },
    { value: 1, numeral: "I" },
  ];

  const found = romanNumerals.find((rn) => rn.value === numberValue);
  return found ? found.numeral : num;
};

export default function AdminExamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, role } = useAuth();
  const examId = params.examId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("registered");

  // Data States - OPTIMIZED: Only current page data
  const [exam, setExam] = useState(null);
  const [examClass, setExamClass] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [examRegistrations, setExamRegistrations] = useState([]);
  const [filteredRegistered, setFilteredRegistered] = useState([]);
  const [filteredUnregistered, setFilteredUnregistered] = useState([]);
  const [currentPageRegistrations, setCurrentPageRegistrations] = useState([]);
  const [currentPageUnregistered, setCurrentPageUnregistered] = useState([]);

  // Metadata (cached once) - Maps for O(1) lookup
  const [madrasas, setMadrasas] = useState([]);
  const [mekhalas, setMekhalas] = useState([]);
  const [madrasaMap, setMadrasaMap] = useState(new Map());
  const [mekhalaMap, setMekhalaMap] = useState(new Map());
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);
  const [studentToRegister, setStudentToRegister] = useState(null);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [generatingHallTickets, setGeneratingHallTickets] = useState({});
  const [downloadingBulkHallTickets, setDownloadingBulkHallTickets] =
    useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMahal, setFilterMahal] = useState("all");
  const [filterMekhala, setFilterMekhala] = useState("all");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [madrasaSearchOpen, setMadrasaSearchOpen] = useState(false);
  const [madrasaSearchTerm, setMadrasaSearchTerm] = useState("");

  // Filtered lists based on selections
  const [filteredMadrasas, setFilteredMadrasas] = useState([]);
  const [uniqueDistricts, setUniqueDistricts] = useState([]);
  const [filteredDistrictOptions, setFilteredDistrictOptions] = useState([]);
  const [classes, setClasses] = useState([]);

  // State for registering students
  const [registeringStudents, setRegisteringStudents] = useState({});

  // State for deleting registrations
  const [deletingRegistrations, setDeletingRegistrations] = useState({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [registrationToDelete, setRegistrationToDelete] = useState(null);

  // Checkbox selection states
  const [selectedStudents, setSelectedStudents] = useState({});
  const [selectAll, setSelectAll] = useState(false);
  const [selectedStudentsList, setSelectedStudentsList] = useState([]);
  const [bulkRegistrationProgress, setBulkRegistrationProgress] = useState({
    total: 0,
    completed: 0,
    inProgress: false,
  });

  // Pagination - OPTIMIZED
  const [loadingPage, setLoadingPage] = useState(false);
  const [totalRegisteredCount, setTotalRegisteredCount] = useState(0);
  const [totalUnregisteredCount, setTotalUnregisteredCount] = useState(0);
  const lastDocRefRegistered = useRef(null);
  const lastDocRefUnregistered = useRef(null);
  const hasPreloadedRef = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch exam details
  const fetchExam = useCallback(async () => {
    if (!examId) return;

    try {
      const examData = await getDocument(COLLECTIONS.EXAMS, examId);
      if (examData) {
        console.log("examData", examData);
        setExam(examData);
        setExamClass(examData.class);
      } else {
        setError("Exam not found");
      }
    } catch (error) {
      console.error("Error fetching exam:", error);
      setError("Failed to fetch exam details");
    }
  }, [examId]);

  // Fetch hall ticket data from hallTickets collection
  const fetchHallTicketData = useCallback(async (examId, studentId) => {
    try {
      const hallTicketDocRef = doc(
        db,
        "hallTickets",
        examId,
        "students",
        studentId,
      );
      const hallTicketSnapshot = await getDoc(hallTicketDocRef);

      if (hallTicketSnapshot.exists()) {
        const hallTicketData = hallTicketSnapshot.data();
        return hallTicketData;
      } else {
        throw new Error("Hall ticket data not found");
      }
    } catch (error) {
      console.error("Error fetching hall ticket data:", error);
      throw error;
    }
  }, []);

  // OPTIMIZED: Load institutions metadata ONCE (cached)
  const loadInstitutions = useCallback(async () => {
    try {
      const { madrasas, mekhalas, madrasaMap, mekhalaMap, districts } =
        await fetchInstitutionsMetadata();

      setMadrasas(madrasas);
      setMekhalas(mekhalas);
      setMadrasaMap(madrasaMap);
      setMekhalaMap(mekhalaMap);
      setUniqueDistricts(districts);
      setFilteredDistrictOptions(districts);
      setFilteredMadrasas(madrasas);

      // Get unique classes from all students (one-time fetch for filter)
      const studentsRef = collection(db, COLLECTIONS.STUDENTS);
      const classQuery = query(
        studentsRef,
        where("status", "==", "active"),
        orderBy("classLevel", "asc"),
      );
      const classSnapshot = await getDocs(classQuery);

      const classSet = new Set();
      classSnapshot.docs.forEach((doc) => {
        const classLevel = doc.data().classLevel;
        if (classLevel) {
          classSet.add(normalizeClassLevel(classLevel));
        }
      });

      const uniqueClasses = Array.from(classSet).sort((a, b) => {
        const orderA = getClassSortOrder(a);
        const orderB = getClassSortOrder(b);
        return orderA - orderB;
      });
      setClasses(uniqueClasses);
    } catch (error) {
      console.error("Error loading institutions:", error);
      setError("Failed to load institutions");
    }
  }, []);

  // OPTIMIZED: Load current page of REGISTERED students (20 records)
  const loadRegisteredPage = useCallback(async () => {
    if (!examId) return;

    setLoadingPage(true);
    try {
      const filters = {
        classLevel: filterClass !== "all" ? filterClass : null,
        madarsaId: filterMahal !== "all" ? filterMahal : null,
        searchTerm: searchTerm,
        page: currentPage,
      };

      console.log(
        `[REGISTERED] Loading page ${currentPage}, pageSize: ${pageSize}`,
      );

      // Fetch registrations for current page
      const { registrations, lastVisible } = await fetchExamRegistrationIds(
        examId,
        filters,
        pageSize,
        currentPage > 1 ? lastDocRefRegistered.current : null,
      );

      console.log(
        `[REGISTERED] Loaded ${registrations.length} registrations for page ${currentPage}`,
      );
      lastDocRefRegistered.current = lastVisible;

      // Extract student IDs
      const studentIds = registrations.map((r) => r.studentId);

      // Fetch only those 20 students
      const students = await fetchStudentsByIds(studentIds);

      // Map students to registrations
      const studentsMap = new Map(students.map((s) => [s.id, s]));
      const combined = registrations
        .map((reg) => ({
          ...studentsMap.get(reg.studentId),
          registration: reg,
        }))
        .filter((item) => item.id); // Filter out any missing students

      setCurrentPageRegistrations(combined);
    } catch (error) {
      console.error("Error loading registered page:", error);
      setError("Failed to load registered students");
    } finally {
      setLoadingPage(false);
    }
  }, [
    examId,
    examClass,
    filterClass,
    filterMahal,
    searchTerm,
    currentPage,
    pageSize,
  ]);

  // OPTIMIZED: Load current page of UNREGISTERED students (20 records)
  const loadUnregisteredPage = useCallback(async () => {
    if (!examId) return;

    setLoadingPage(true);
    try {
      const filters = {
        classLevel: filterClass !== "all" ? filterClass : examClass || null,
        madarsaId: filterMahal !== "all" ? filterMahal : null,
        gender: filterGender !== "all" ? filterGender : null,
        searchTerm: searchTerm,
        page: currentPage,
      };

      console.log(
        `[UNREGISTERED] Loading page ${currentPage}, pageSize: ${pageSize}`,
      );

      // Fetch current page students
      const { students, lastVisible } = await fetchUnregisteredStudents(
        examId,
        filters,
        pageSize,
        currentPage > 1 ? lastDocRefUnregistered.current : null,
      );
      console.log("examclass", examClass);

      // console.log(students, exam);
      console.log(
        `[UNREGISTERED] Loaded ${students.length} students for page ${currentPage}`,
      );
      lastDocRefUnregistered.current = lastVisible;
      setCurrentPageUnregistered(students);
    } catch (error) {
      console.error("Error loading unregistered page:", error);
      setError("Failed to load unregistered students");
    } finally {
      setLoadingPage(false);
    }
  }, [
    examId,
    exam,
    examClass,
    filterClass,
    filterMahal,
    filterGender,
    searchTerm,
    currentPage,
    pageSize,
  ]);

  // Function to fetch both counts independently of page data
  const fetchCounts = useCallback(async () => {
    if (!examId || loading || madrasas.length === 0) return;

    try {
      const regFilters = {
        classLevel: filterClass !== "all" ? filterClass : null,
        madarsaId: filterMahal !== "all" ? filterMahal : null,
        searchTerm: searchTerm,
      };

      const unregFilters = {
        ...regFilters,
        classLevel: filterClass !== "all" ? filterClass : examClass || null,
        gender: filterGender !== "all" ? filterGender : null,
      };

      const [regCount, unregCount] = await Promise.all([
        getExamRegistrationsCount(examId, regFilters),
        getUnregisteredStudentsCount(examId, unregFilters),
      ]);

      setTotalRegisteredCount(regCount);
      setTotalUnregisteredCount(unregCount);
    } catch (error) {
      console.error("Error fetching counts:", error);
    }
  }, [
    examId,
    examClass,
    filterClass,
    filterMahal,
    filterGender,
    searchTerm,
    loading,
    madrasas.length,
  ]);

  // Effect to update counts when filters change
  useEffect(() => {
    if (!loading && madrasas.length > 0) {
      fetchCounts();
    }
  }, [fetchCounts, loading, madrasas.length]);

  // OPTIMIZED: Load data on mount and when dependencies change

  // Load institutions metadata ONCE on mount
  useEffect(() => {
    loadInstitutions();
  }, [loadInstitutions]);

  const buildFormattedHallTicketNumber = async (student, madrasa) => {
    let mekhalaNumber =
      student.mekhalaNumber || madrasa?.mekhalaNumber || madrasa?.mekhalaNo || "";
    const districtName = madrasa?.district || student.district || "";

    if (!mekhalaNumber && districtName) {
      try {
        const districtSnap = await getDocs(
          query(collection(db, "districts"), where("name", "==", districtName)),
        );
        if (!districtSnap.empty) {
          mekhalaNumber = districtSnap.docs[0].data().mekhalaNumber || "";
        }
      } catch (error) {
        console.warn("Unable to fetch mekhala number for hall ticket:", error);
      }
    }

    return generateFormattedHallTicketNumber(exam.id, {
      districtName,
      mekhalaNumber,
      madarsaId: student.madarsaId || madrasa?.madarsaId || madrasa?.id,
    });
  };

  // Load exam details
  useEffect(() => {
    if (examId) {
      fetchExam();
    }
  }, [examId, fetchExam]);

  // Load current page data when tab, filters, or page changes
  useEffect(() => {
    if (!loading && madrasas.length > 0) {
      if (activeTab === "registered") {
        loadRegisteredPage();
      } else {
        loadUnregisteredPage();
      }
    }
  }, [
    activeTab,
    currentPage,
    filterClass,
    filterMahal,
    filterGender,
    searchTerm,
    madrasas,
    loading,
    loadRegisteredPage,
    loadUnregisteredPage,
  ]);

  // Preload both tabs on initial mount for faster switching
  useEffect(() => {
    if (
      !loading &&
      madrasas.length > 0 &&
      currentPage === 1 &&
      !hasPreloadedRef.current
    ) {
      hasPreloadedRef.current = true;
      console.log(
        "[INITIAL LOAD] Preloading both registered and unregistered data",
      );
      // Load both tabs in parallel
      Promise.all([loadRegisteredPage(), loadUnregisteredPage()])
        .then(() => {
          console.log("[INITIAL LOAD] Both tabs preloaded successfully");
        })
        .catch((err) => {
          console.error("[INITIAL LOAD] Error preloading tabs:", err);
        });
    }
  }, [
    loading,
    madrasas.length,
    currentPage,
    loadRegisteredPage,
    loadUnregisteredPage,
  ]);

  // Set loading to false once institutions are loaded
  useEffect(() => {
    if (madrasas.length > 0) {
      setLoading(false);
    }
  }, [madrasas]);

  // Reset to page 1 and clear cursors when filters or tab change
  useEffect(() => {
    setCurrentPage(1);
    lastDocRefRegistered.current = null;
    lastDocRefUnregistered.current = null;
  }, [filterClass, filterMahal, filterGender, searchTerm, activeTab]);

  // Filter districts and madrasas based on mekhala selection
  useEffect(() => {
    if (filterMekhala && filterMekhala !== "all") {
      // Find the selected mekhala
      const mekhala = mekhalas.find((m) => m.id === filterMekhala);

      if (mekhala && Array.isArray(mekhala.districts)) {
        // Filter madrasas where madrasa.district is in mekhala.districts array
        const filteredMads = madrasas.filter((madrasa) =>
          mekhala.districts.some(
            (d) => d.toUpperCase() === madrasa.district?.toUpperCase(),
          ),
        );
        setFilteredMadrasas(filteredMads);

        // Filter district options to show only those in mekhala.districts
        const filteredDists = uniqueDistricts.filter((dist) =>
          mekhala.districts.some(
            (d) => d.toUpperCase() === dist.name.toUpperCase(),
          ),
        );
        setFilteredDistrictOptions(filteredDists);
      } else {
        setFilteredMadrasas(madrasas);
        setFilteredDistrictOptions(uniqueDistricts);
      }
    } else {
      setFilteredMadrasas(madrasas);
      setFilteredDistrictOptions(uniqueDistricts);
    }
    // Reset district and madrasa selection when mekhala changes
    setFilterDistrict("all");
    setFilterMahal("all");
  }, [filterMekhala, madrasas, uniqueDistricts, mekhalas]);

  // Filter madrasas based on district selection
  useEffect(() => {
    if (filterDistrict && filterDistrict !== "all") {
      // Filter madrasas by district name
      const filteredMads = madrasas.filter(
        (madrasa) =>
          madrasa.district?.toUpperCase() === filterDistrict.toUpperCase(),
      );
      setFilteredMadrasas(filteredMads);
    } else if (filterMekhala && filterMekhala !== "all") {
      // If mekhala is selected but district is "all", keep mekhala-filtered madrasas
      const mekhala = mekhalas.find((m) => m.id === filterMekhala);
      if (mekhala && Array.isArray(mekhala.districts)) {
        const filteredMads = madrasas.filter((madrasa) =>
          mekhala.districts.some(
            (d) => d.toUpperCase() === madrasa.district?.toUpperCase(),
          ),
        );
        setFilteredMadrasas(filteredMads);
      } else {
        setFilteredMadrasas(madrasas);
      }
    } else {
      setFilteredMadrasas(madrasas);
    }
    // Reset madrasa selection when district changes
    setFilterMahal("all");
  }, [filterDistrict, madrasas, filterMekhala, mekhalas]);

  // Apply filters to students
  // Client-side filtering REMOVED - Now done server-side in loadRegisteredPage() and loadUnregisteredPage()

  // Get statistics using optimized counts

  // Get statistics using optimized counts
  const getStats = () => {
    return {
      totalActiveStudents: totalRegisteredCount + totalUnregisteredCount,
      registeredStudents: totalRegisteredCount,
      unregisteredStudents: totalUnregisteredCount,
      registrationRate:
        totalRegisteredCount + totalUnregisteredCount > 0
          ? (
              (totalRegisteredCount /
                (totalRegisteredCount + totalUnregisteredCount)) *
              100
            ).toFixed(1)
          : "0.0",
    };
  };

  const stats = getStats();

  // Handle select all checkbox
  const handleSelectAll = () => {
    const currentData =
      activeTab === "registered"
        ? currentPageRegistrations
        : currentPageUnregistered;
    if (selectAll) {
      setSelectedStudents({});
      setSelectedStudentsList([]);
      setSelectAll(false);
    } else {
      const newSelection = {};
      currentData.forEach((student) => {
        newSelection[student.id] = true;
      });
      setSelectedStudents(newSelection);
      setSelectedStudentsList(currentData);
      setSelectAll(true);
    }
  };

  // Handle individual checkbox
  const handleSelectStudent = (studentId) => {
    setSelectedStudents((prev) => {
      const newSelection = {
        ...prev,
        [studentId]: !prev[studentId],
      };

      // Update selected students list
      const currentData =
        activeTab === "registered"
          ? currentPageRegistrations
          : currentPageUnregistered;

      const selected = currentData.filter((s) => newSelection[s.id]);
      setSelectedStudentsList(selected);

      return newSelection;
    });
  };

  // Update selectAll state when individual checkboxes change
  useEffect(() => {
    const currentData =
      activeTab === "registered"
        ? currentPageRegistrations
        : currentPageUnregistered;
    const allSelected =
      currentData.length > 0 &&
      currentData.every((student) => selectedStudents[student.id]);
    setSelectAll(allSelected);
  }, [
    selectedStudents,
    currentPageRegistrations,
    currentPageUnregistered,
    activeTab,
  ]);

  // Show registration confirmation dialog
  const showRegisterConfirmation = (student) => {
    setStudentToRegister(student);
    setIsRegisterDialogOpen(true);
  };

  // Bulk register selected students - OPTIMIZED
  const bulkRegisterStudents = async () => {
    const selectedStudentIds = Object.keys(selectedStudents).filter(
      (id) => selectedStudents[id],
    );

    if (selectedStudentIds.length === 0) {
      toast.error("Please select at least one student to register");
      return;
    }

    if (
      !confirm(
        `Register ${selectedStudentIds.length} student(s)? This will be super fast!`,
      )
    ) {
      return;
    }

    setBulkRegistrationProgress({
      total: selectedStudentIds.length,
      completed: 0,
      inProgress: true,
    });

    try {
      const selectedStudentsForRegistration = selectedStudentIds
        .map((studentId) => currentPageUnregistered.find((s) => s.id === studentId))
        .filter(Boolean);

      console.log("Generating formatted hall ticket numbers...");
      const hallTicketNumbers = await Promise.all(
        selectedStudentsForRegistration.map((student) =>
          buildFormattedHallTicketNumber(student, madrasaMap.get(student.madarsaId)),
        ),
      );

      // Step 2: Prepare registration data and hall ticket data
      const registrationsData = [];
      const hallTicketsData = [];

      selectedStudentsForRegistration.forEach((student, index) => {
        const hallTicketNumber = hallTicketNumbers[index];
        const madrasa = madrasaMap.get(student.madarsaId);
        const madrasaName = madrasa?.name || student.madarsaId || "N/A";

        // Resolve Mekhala (Logic from fix-tkt)
        let mekhalaObj = mekhalaMap.get(student.mekhalaId);
        let mekhalaId = student.mekhalaId;

        if (!mekhalaObj && madrasa?.mekhala) {
          mekhalaObj = mekhalas.find((m) => m.name === madrasa.mekhala);
          if (mekhalaObj) {
            mekhalaId = mekhalaObj.id;
          }
        }

        // Registration data
        const registrationData = {
          examId: exam.id,
          examTitle: exam.title,
          examDate: exam.examDate,
          examFees: exam.fees || 0,
          studentId: student.id,
          studentName: student.fullName || student.name || "Unknown",
          studentEmail: student.email || "",
          studentPhone: student.phone || "",
          admissionNumber: student.admissionNumber || "",
          guardianName: student.guardianName || student.guardian || "N/A",
          dateOfBirth: student.dateOfBirth || "N/A",
          madarsa: madrasaName,
          madarsaId: student.madarsaId,
          classLevel: student.classLevel || "",
          hallTicketNumber: hallTicketNumber,
          status: "registered",
          paymentStatus: "waived",
          paymentMethod: "admin_bulk_registration",
          registeredBy: user?.uid || "admin",
          registeredByName: user?.email || "Admin",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        if (student.mekhalaId) {
          registrationData.mekhalaId = student.mekhalaId;
        }

        registrationsData.push(registrationData);

        // Hall ticket data for later PDF generation (ALL fields from hallTicketUtils.js)
        hallTicketsData.push({
          studentId: student.id,
          data: {
            // Exam Information
            examId: exam.id,
            examTitle: exam.title,
            examDate: exam.examDate,

            // Student Information
            studentId: student.id,
            fullName: student.fullName || student.name || "Unknown",
            admissionNumber: student.admissionNumber || "",
            classLevel: student.classLevel || "",
            gender: student.gender || "",
            guardianName: student.guardianName || student.guardian || "N/A",
            dateOfBirth: student.dateOfBirth || "N/A",
            guardianPhone: student.guardianPhone || student.phone || "",
            profilePictureUrl:
              student.profilePicture || student.profilePictureUrl || null,

            // Institution Information
            madarsa: madrasaName,
            madarsaId: student.madarsaId,
            mekhala: madrasa?.district || madrasa?.mekhala || "N/A",
            mekhalaId: mekhalaId || "",
            mekhalaNumber:
              student.mekhalaNumber ||
              madrasa?.mekhalaNumber ||
              hallTicketNumber.split("-")[1] ||
              "",
            sadarName: madrasa?.name || madrasa?.sadarName || "N/A",
            sadarAddress: madrasa?.address || madrasa?.sadarAddress || "N/A",

            // Hall Ticket Details
            hallTicketNumber: hallTicketNumber,
            createdAt: new Date(),

            // Timetable (will be populated later if available)
            timetableEntries: exam.timetable || [],

            // PDF Status
            generatedPdfUrl: null,
          },
        });
      });

      // Step 3: Batch write registrations (FAST - batched writes)
      console.log("Saving registrations...");
      const batchSize = 500;
      const registrationBatches = [];

      for (let i = 0; i < registrationsData.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = registrationsData.slice(i, i + batchSize);

        chunk.forEach((regData) => {
          const docRef = doc(collection(db, COLLECTIONS.EXAM_REGISTRATIONS));
          batch.set(docRef, regData);
        });

        registrationBatches.push(batch.commit());
      }

      await Promise.all(registrationBatches);

      // Step 4: Batch save hall ticket data (FAST - batched writes)
      console.log("Saving hall ticket data...");
      await batchSaveHallTicketData(exam.id, hallTicketsData);

      // Success!
      toast.success(
        `Successfully registered ${selectedStudentIds.length} student(s)! Hall tickets can be generated anytime.`,
      );

      // Clear selections and refresh
      setSelectedStudents({});
      setSelectedStudentsList([]);
      setSelectAll(false);

      // Reload current page and counts
      fetchCounts();
      if (activeTab === "registered") {
        await loadRegisteredPage();
      } else {
        await loadUnregisteredPage();
      }
    } catch (error) {
      console.error("Error bulk registering students:", error);
      toast.error("Failed to register students: " + error.message);
    } finally {
      setBulkRegistrationProgress({
        total: 0,
        completed: 0,
        inProgress: false,
      });
    }
  };

  // Export selected students
  // const exportSelectedStudents = () => {
  //   const selectedStudentIds = Object.keys(selectedStudents).filter(
  //     (id) => selectedStudents[id]
  //   );

  //   if (selectedStudentIds.length === 0) {
  //     alert("Please select at least one student to export");
  //     return;
  //   }

  //   const currentData =
  //     activeTab === "registered" ? filteredRegistered : filteredUnregistered;
  //   const studentsToExport = currentData.filter((student) =>
  //     selectedStudentIds.includes(student.id)
  //   );

  //   exportStudents(
  //     studentsToExport,
  //     `selected-${activeTab}-students-${exam?.title || "exam"}-${
  //       new Date().toISOString().split("T")[0]
  //     }.csv`
  //   );
  // };

  // Register student without payment
  const confirmRegisterStudent = async () => {
    if (!exam || !studentToRegister) return;

    try {
      setRegisteringStudents((prev) => ({
        ...prev,
        [studentToRegister.id]: true,
      }));
      setIsRegisterDialogOpen(false);

      const madrasa = madrasaMap.get(studentToRegister.madarsaId);
      const madrasaName = madrasa?.name || studentToRegister.madarsaId || "N/A";
      const hallTicketNumber = await buildFormattedHallTicketNumber(
        studentToRegister,
        madrasa,
      );

      // Resolve Mekhala (Logic from fix-tkt & bulk)
      let mekhalaObj = mekhalaMap.get(studentToRegister.mekhalaId);
      let mekhalaId = studentToRegister.mekhalaId;

      if (!mekhalaObj && madrasa?.mekhala) {
        mekhalaObj = mekhalas.find((m) => m.name === madrasa.mekhala);
        if (mekhalaObj) {
          mekhalaId = mekhalaObj.id;
        }
      }

      // Create registration document
      const registrationData = {
        examId: exam.id,
        examTitle: exam.title,
        examDate: exam.examDate,
        examFees: exam.fees || 0,
        studentId: studentToRegister.id,
        studentName:
          studentToRegister.fullName || studentToRegister.name || "Unknown",
        studentEmail: studentToRegister.email || "",
        studentPhone: studentToRegister.phone || "",
        admissionNumber: studentToRegister.admissionNumber || "",
        guardianName:
          studentToRegister.guardianName || studentToRegister.guardian || "N/A",
        dateOfBirth: studentToRegister.dateOfBirth || "N/A",
        madarsa: madrasaName,
        madarsaId: studentToRegister.madarsaId,
        classLevel: studentToRegister.classLevel || "",
        hallTicketNumber: hallTicketNumber,
        status: "registered",
        paymentStatus: "waived",
        paymentMethod: "admin_registration",
        registeredBy: user?.uid || "admin",
        registeredByName: user?.email || "Admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (studentToRegister.mekhalaId) {
        registrationData.mekhalaId = studentToRegister.mekhalaId;
      }

      await addDoc(
        collection(db, COLLECTIONS.EXAM_REGISTRATIONS),
        registrationData,
      );

      // Save hall ticket data for later PDF generation
      try {
        const hallTicketData = {
          examId: exam.id,
          examTitle: exam.title,
          examDate: exam.examDate,
          studentId: studentToRegister.id,
          fullName:
            studentToRegister.fullName || studentToRegister.name || "Unknown",
          admissionNumber: studentToRegister.admissionNumber || "",
          classLevel: studentToRegister.classLevel || "",
          gender: studentToRegister.gender || "",
          guardianName:
            studentToRegister.guardianName ||
            studentToRegister.guardian ||
            "N/A",
          dateOfBirth: studentToRegister.dateOfBirth || "N/A",
          guardianPhone:
            studentToRegister.guardianPhone || studentToRegister.phone || "",
          profilePictureUrl:
            studentToRegister.profilePicture ||
            studentToRegister.profilePictureUrl ||
            null,
          madarsa: madrasaName,
          madarsaId: studentToRegister.madarsaId,
          mekhala: madrasa?.district || madrasa?.mekhala || "N/A",
          mekhalaId: mekhalaId || "",
          mekhalaNumber:
            studentToRegister.mekhalaNumber ||
            madrasa?.mekhalaNumber ||
            hallTicketNumber.split("-")[1] ||
            "",
          sadarName: madrasa?.name || madrasa?.sadarName || "N/A",
          sadarAddress: madrasa?.address || madrasa?.sadarAddress || "N/A",
          hallTicketNumber: hallTicketNumber,
          createdAt: new Date(),
          timetableEntries: exam.timetable || [],
          generatedPdfUrl: null,
        };

        await saveHallTicketData(exam.id, studentToRegister.id, hallTicketData);
      } catch (hallTicketError) {
        console.error("Failed to save hall ticket data:", hallTicketError);
      }

      toast.success(
        `Student registered successfully! Hall ticket will be generated shortly.`,
      );

      // Refresh registrations and counts
      fetchCounts();
      if (activeTab === "registered") {
        await loadRegisteredPage();
      } else {
        await loadUnregisteredPage();
      }
    } catch (error) {
      console.error("Error registering student:", error);
      toast.error("Failed to register student: " + error.message);
    } finally {
      setRegisteringStudents((prev) => ({
        ...prev,
        [studentToRegister.id]: false,
      }));
      setStudentToRegister(null);
    }
  };

  // View student details
  const viewStudentDetails = async (student) => {
    setSelectedStudent(student);
    setIsStudentDialogOpen(true);
  };

  // Show delete confirmation dialog
  const showDeleteConfirmation = (student) => {
    const registration =
      student.registration ||
      examRegistrations.find((r) => r.studentId === student.id);
    setRegistrationToDelete({ student, registration });
    setIsDeleteDialogOpen(true);
  };

  // Delete registration
  const confirmDeleteRegistration = async () => {
    console.log("Delete triggered for:", registrationToDelete);
    if (!registrationToDelete?.registration) {
      console.error(
        "Missing registration data in delete payload",
        registrationToDelete,
      );
      setIsDeleteDialogOpen(false);
      toast.error("Cannot delete: Incomplete registration data found.");
      return;
    }

    try {
      setDeletingRegistrations((prev) => ({
        ...prev,
        [registrationToDelete.student.id]: true,
      }));
      setIsDeleteDialogOpen(false);

      const registrationRef = doc(
        db,
        COLLECTIONS.EXAM_REGISTRATIONS,
        registrationToDelete.registration.id,
      );
      await deleteDoc(registrationRef);

      // Create a reference to the hall ticket document
      const hallTicketRef = doc(
        db,
        "hallTickets",
        exam.id,
        "students",
        registrationToDelete.student.id,
      );

      // Attempt to delete the hall ticket
      try {
        await deleteDoc(hallTicketRef);
        console.log("Hall ticket deleted successfully");
      } catch (htError) {
        console.warn(
          "Could not delete hall ticket (might not exist):",
          htError,
        );
      }

      toast.success("Registration deleted successfully");

      // Refresh registrations and counts
      fetchCounts();
      if (activeTab === "registered") {
        await loadRegisteredPage();
      } else {
        await loadUnregisteredPage();
      }
    } catch (error) {
      console.error("Error deleting registration:", error);
      toast.error("Failed to delete registration: " + error.message);
    } finally {
      setDeletingRegistrations((prev) => ({
        ...prev,
        [registrationToDelete.student.id]: false,
      }));
      setRegistrationToDelete(null);
    }
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

  // Generate and download hall ticket for a single student
  // Generate and download hall ticket for a single student
  const downloadHallTicket = async (student) => {
    if (!exam) return;

    try {
      setGeneratingHallTickets((prev) => ({ ...prev, [student.id]: true }));

      // Find the registration
      const registration = examRegistrations.find(
        (r) => r.studentId === student.id,
      );

      const hallTicketData = await prepareHallTicketData(student, registration);

      // Download directly using utility
      await downloadHallTicketPDF(hallTicketData);
      toast.success("Hall ticket downloaded");
    } catch (error) {
      console.error("Error generating hall ticket:", error);
      toast.error("Failed to generate hall ticket");
    } finally {
      setGeneratingHallTickets((prev) => ({ ...prev, [student.id]: false }));
    }
  };

  // Preview hall ticket
  const previewHallTicket = async (student) => {
    if (!exam) return;

    try {
      // Find the registration
      const registration = examRegistrations.find(
        (r) => r.studentId === student.id,
      );

      // If hall ticket URL exists, open directly
      if (registration?.hallTicketUrl) {
        window.open(registration.hallTicketUrl, "_blank");
        return;
      }

      // Try to fetch pre-computed hall ticket data from hallTickets collection
      let ticketData;
      try {
        const hallTicketData = await fetchHallTicketData(exam.id, student.id);
        ticketData = {
          fullName: hallTicketData.fullName || student.fullName || "N/A",
          middleName: hallTicketData.middleName || "",
          midNumber: hallTicketData.midNumber || "",
          admissionNumber:
            hallTicketData.admissionNumber ||
            student.admissionNumber ||
            student.id ||
            "N/A",
          classLevel: hallTicketData.classLevel || student.classLevel || "N/A",
          madarsa:
            hallTicketData.madarsa ||
            getMadrasaName(student.madarsaId, madrasas),
          madarsaId: hallTicketData.madarsaId || student.madarsaId || null,
          mekhala:
            hallTicketData.mekhala ||
            getMekhalaNameByDistrict(student.madarsaId, madrasas, mekhalas),
          gender: hallTicketData.gender || student.gender || "N/A",
          guardianName:
            hallTicketData.guardianName ||
            student.guardianName ||
            student.guardian ||
            "N/A",
          dateOfBirth:
            hallTicketData.dateOfBirth || student.dateOfBirth || "N/A",
          guardianPhone:
            hallTicketData.guardianPhone || student.guardianPhone || "N/A",
          profilePictureUrl: hallTicketData.profilePictureUrl || "",
          hallTicketNumber:
            hallTicketData.hallTicketNumber ||
            registration?.hallTicketNumber ||
            "000000",
          examTitle: hallTicketData.examTitle || exam.title || "N/A",
          examDate: hallTicketData.examDate || exam.examDate,
          createdAt: hallTicketData.createdAt || new Date(),
          examFees: hallTicketData.examFees || exam.fees || 0,
          timetableEntries:
            hallTicketData.timetableEntries || exam.timetable || [],
        };
      } catch (error) {
        console.warn(
          "Hall ticket data not found in collection, generating manually:",
          error,
        );

        // Fallback: generate hall ticket data manually
        let hallTicketNumber = registration?.hallTicketNumber;

        // If no hall ticket number exists, generate and save it
        if (!hallTicketNumber && registration) {
          hallTicketNumber = await getOrCreateHallTicketNumber(
            registration.id,
            exam.id,
          );
        }

        // Fallback if still no number (shouldn't happen)
        if (!hallTicketNumber) {
          hallTicketNumber = "000000";
        }

        const profilePictureUrl = await getProfilePicture(
          student,
          student.admissionNumber,
          student.madarsaId,
        );

        ticketData = {
          fullName: student.fullName || "N/A",
          middleName: "",
          midNumber: student.midNumber || "",
          admissionNumber: student.admissionNumber || student.id || "N/A",
          classLevel: student.classLevel || "N/A",
          madarsa: getMadrasaName(student.madarsaId, madrasas),
          madarsaId: student.madarsaId || null,
          mekhala: getMekhalaNameByDistrict(
            student.madarsaId,
            madrasas,
            mekhalas,
          ),
          gender: student.gender || "N/A",
          guardianName: student.guardianName || student.guardian || "N/A",
          dateOfBirth: student.dateOfBirth || "N/A",
          guardianPhone: student.guardianPhone || "N/A",
          profilePictureUrl: profilePictureUrl,
          hallTicketNumber: hallTicketNumber,
          examTitle: exam.title || "N/A",
          examDate: exam.examDate,
          createdAt: new Date(),
          examFees: exam.fees || 0,
        };
      }

      // Download directly using utility
      await downloadHallTicketPDF(ticketData);
      toast.success("Hall ticket downloaded");
    } catch (error) {
      console.error("Error preparing hall ticket:", error);
      toast.error("Failed to prepare hall ticket");
    }
  };

  // Helper: Prepare hall ticket data for a single student
  async function prepareHallTicketData(student, registration) {
    try {
      // Try to fetch pre-computed hall ticket data from hallTickets collection first
      const hallTicketData = await fetchHallTicketData(exam.id, student.id);
      console.log(
        "hallTicketData",
        hallTicketData,
        hallTicketData.profilePictureUrl,
      );
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
        dateOfBirth: student.dateOfBirth || hallTicketData.dateOfBirth || "N/A",
        guardianPhone:
          hallTicketData.guardianPhone || student.guardianPhone || "N/A",
        madarsa: hallTicketData.madarsa || student?.madarsaId || "N/A",
        madarsaId: hallTicketData.madarsaId || student?.madarsaId || null,
        mekhala: hallTicketData.mekhala || "N/A",
        sadarName: hallTicketData.sadarName || "N/A",
        sadarAddress: hallTicketData.sadarAddress || "N/A",
        examDate: hallTicketData.examDate || exam?.examDate,
        createdAt: hallTicketData.createdAt || new Date(),
        profilePictureUrl: hallTicketData.profilePictureUrl || "",
        examFees: hallTicketData.examFees || exam?.fees || 0,
        timetableEntries: hallTicketData.timetableEntries || [],
      };
    } catch (error) {
      console.warn(
        "Hall ticket data not found in collection, falling back to manual generation:",
        error,
      );

      // Fallback: manual generation with API calls
      // Get or generate hall ticket number
      let hallTicketNumber = registration?.hallTicketNumber;
      if (!hallTicketNumber && registration) {
        hallTicketNumber = await getOrCreateHallTicketNumber(
          registration.id,
          exam.id,
        );
      }
      if (!hallTicketNumber) {
        hallTicketNumber = "000000";
      }

      // Get profile picture
      const profilePictureUrl = await getProfilePicture(
        student,
        student.admissionNumber,
        student.madarsaId,
      );

      // Get madarsaId
      const madarsaId = student?.madarsaId || null;

      // Fetch madarsa details to get mekhala and sadar information
      let mekhala = "N/A";
      let sadarName = "N/A";
      let sadarAddress = "N/A";

      if (madarsaId) {
        try {
          const madarsasRef = collection(db, "madarsas");
          const q = query(madarsasRef, where("madarsaId", "==", madarsaId));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const madarsaData = querySnapshot.docs[0].data();
            mekhala = madarsaData.district || "N/A";
            sadarName = madarsaData.adminName || "N/A";
            sadarAddress = madarsaData.address || "N/A";
          }
        } catch (error) {
          console.error(
            "Error fetching madarsa details for hall ticket:",
            error,
          );
        }
      }

      // Fetch exam timetable (exactly like HallTicket component)
      let timetableEntries = [];
      const examTitle = exam?.title;

      if (examTitle) {
        try {
          const examsRef = collection(db, "exams");
          const q = query(examsRef, where("title", "==", examTitle));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            // Get the latest exam if multiple exist
            const exams = querySnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));

            // Sort by createdAt descending to get the latest
            exams.sort((a, b) => {
              const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
              const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
              return bTime - aTime;
            });

            const latestExam = exams[0];
            timetableEntries = latestExam.timetableEntries || [];
          }
        } catch (error) {
          console.error("Error fetching exam timetable:", error);
        }
      }

      return {
        hallTicketNumber,
        examTitle: exam?.title || "N/A",
        fullName: student.fullName || "N/A",
        middleName: student?.middleName || student?.midNumber || "",
        midNumber: student?.midNumber || "",
        admissionNumber: student.admissionNumber || "N/A",
        classLevel: student.classLevel || "N/A",
        gender: student.gender || "N/A",
        guardianName: student.guardianName || student.guardian || "N/A",
        dateOfBirth: student.dateOfBirth || "N/A",
        guardianPhone: student.guardianPhone || "N/A",
        madarsa: student?.madarsaId || "N/A",
        madarsaId: madarsaId,
        mekhala: mekhala,
        sadarName: sadarName,
        sadarAddress: sadarAddress,
        examDate: exam?.examDate,
        createdAt: new Date(),
        profilePictureUrl,
        examFees: exam?.fees || 0,
        timetableEntries: timetableEntries,
      };
    }
  }

  // Bulk download hall tickets for selected students (Merged PDF)
  const bulkDownloadHallTickets = async () => {
    const selectedStudentIds = Object.keys(selectedStudents).filter(
      (id) => selectedStudents[id],
    );

    if (selectedStudentIds.length === 0) {
      toast.error(
        "Please select at least one student to download hall tickets",
      );
      return;
    }

    try {
      setDownloadingBulkHallTickets(true);
      toast.info(
        `Generating and merging hall tickets for ${selectedStudentIds.length} students...`,
      );

      const mergedPdf = await PDFDocument.create();
      let successCount = 0;

      // Process students sequentially
      for (const studentId of selectedStudentIds) {
        // Find student in current page registrations
        const student = currentPageRegistrations.find(
          (s) => s.id === studentId,
        );

        // If not found in current page, skip (or we could try to fetch, but selection is usually from current page)
        if (!student) {
          console.warn(`Student ${studentId} not found in current page data`);
          continue;
        }

        const registration = student.registration;
        if (!registration) {
          console.warn(`Registration not found for student ${studentId}`);
          continue;
        }

        try {
          const hallTicketData = await prepareHallTicketData(
            student,
            registration,
          );
          const pdfBuffer = await generateHallTicketPDFBlob(hallTicketData);

          if (pdfBuffer) {
            const pdf = await PDFDocument.load(pdfBuffer);
            const copiedPages = await mergedPdf.copyPages(
              pdf,
              pdf.getPageIndices(),
            );
            copiedPages.forEach((page) => mergedPdf.addPage(page));
            successCount++;
          }
        } catch (err) {
          console.error(`Failed to generate PDF for student ${studentId}`, err);
        }
      }

      if (successCount === 0) {
        toast.error("No hall tickets could be generated.");
        return;
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `hall_tickets_merged_${exam?.title || "exam"}_${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(
        `Successfully merged and downloaded ${successCount} hall tickets`,
      );
    } catch (error) {
      console.error("Error bulk downloading hall tickets:", error);
      toast.error("Failed to download hall tickets: " + error.message);
    } finally {
      setDownloadingBulkHallTickets(false);
    }
  };

  // Export All Students - Fetch all data from Firestore
  const exportAllStudents = async () => {
    const toastId = toast.loading(
      `Fetching all ${activeTab} students... Please wait`,
    );

    try {
      let allStudents = [];
      let allRegistrations = [];

      if (activeTab === "registered") {
        // Fetch ALL registrations for this exam
        const filters = {
          classLevel: filterClass !== "all" ? filterClass : null,
          madarsaId: filterMahal !== "all" ? filterMahal : null,
        };

        toast.loading("Fetching all registrations...", { id: toastId });

        // Fetch all registrations (no pagination)
        const registrationsRef = collection(db, COLLECTIONS.EXAM_REGISTRATIONS);
        const constraints = [where("examId", "==", examId)];

        if (filters.classLevel) {
          constraints.push(where("classLevel", "==", filters.classLevel));
        }
        if (filters.madarsaId) {
          constraints.push(where("madarsaId", "==", filters.madarsaId));
        }

        constraints.push(orderBy("hallTicketNumber", "asc"));

        const q = query(registrationsRef, ...constraints);
        const snapshot = await getDocs(q);

        allRegistrations = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        toast.loading(
          `Fetching ${allRegistrations.length} student details...`,
          { id: toastId },
        );

        // Fetch all student details
        const studentIds = allRegistrations.map((r) => r.studentId);
        allStudents = await fetchStudentsByIds(studentIds);

        // Map students to registrations
        const studentsMap = new Map(allStudents.map((s) => [s.id, s]));
        allStudents = allRegistrations
          .map((reg) => ({
            ...studentsMap.get(reg.studentId),
            registration: reg,
          }))
          .filter((item) => item.id);
      } else {
        // Fetch ALL unregistered students
        const filters = {
          classLevel: filterClass !== "all" ? filterClass : null,
          madarsaId: filterMahal !== "all" ? filterMahal : null,
          gender: filterGender !== "all" ? filterGender : null,
        };

        toast.loading("Fetching all unregistered students...", { id: toastId });

        // Get registered student IDs
        const registrationsRef = collection(db, COLLECTIONS.EXAM_REGISTRATIONS);
        const regQuery = query(registrationsRef, where("examId", "==", examId));
        const regSnapshot = await getDocs(regQuery);
        const registeredStudentIds = regSnapshot.docs.map(
          (doc) => doc.data().studentId,
        );

        // Fetch all students with filters
        const studentsRef = collection(db, COLLECTIONS.STUDENTS);
        const constraints = [where("status", "==", "active")];

        if (filters.classLevel) {
          constraints.push(where("classLevel", "==", filters.classLevel));
        }
        if (filters.madarsaId) {
          constraints.push(where("madarsaId", "==", filters.madarsaId));
        }
        if (filters.gender) {
          constraints.push(where("gender", "==", filters.gender));
        }

        constraints.push(orderBy("fullName", "asc"));

        const q = query(studentsRef, ...constraints);
        const snapshot = await getDocs(q);

        allStudents = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter(
            (student) =>
              !student.deleted && !registeredStudentIds.includes(student.id),
          );
      }

      toast.loading(
        `Preparing CSV file with ${allStudents.length} records...`,
        {
          id: toastId,
        },
      );

      // Generate CSV
      const headers = [
        "Name",
        "Email",
        "Phone",
        "Admission Number",
        "Madrasa",
        "Mekhala",
        "Gender",
        "Class",
        "Exam Name",
        "Hall Ticket Number",
        "Hall Ticket URL",
      ];

      const rows = allStudents.map((student) => [
        formatStudentName(
          student.registration?.studentName || student.fullName,
        ),
        student.registration?.studentEmail || student.email || "",
        student.registration?.studentPhone || student.phone || "",
        student.registration?.admissionNumber || student.admissionNumber || "",
        student.registration?.madarsa ||
          getMadrasaName(student.madarsaId, madrasas),
        student.registration?.mekhala ||
          getMekhalaNameByDistrict(student.madarsaId, madrasas, mekhalas),
        student.registration?.gender || student.gender || "",
        student.registration?.classLevel || student.classLevel || "",
        student.registration?.examTitle || exam?.title || "",
        student.registration?.hallTicketNumber || "",
        student.registration?.hallTicketUrl || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      // Download CSV with UTF-8 BOM for Malayalam/Unicode support
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `${activeTab}-students-${exam?.title || "exam"}-${
          new Date().toISOString().split("T")[0]
        }.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(
        `Successfully exported ${allStudents.length} ${activeTab} students`,
        { id: toastId, duration: 5000 },
      );
    } catch (error) {
      console.error("Error exporting all students:", error);
      toast.error("Failed to export students. Please try again.", {
        id: toastId,
      });
    }
  };

  // Export Selected Students
  const exportSelectedStudents = async () => {
    const selectedStudentIds = Object.keys(selectedStudents).filter(
      (id) => selectedStudents[id],
    );

    if (selectedStudentIds.length === 0) {
      toast.error("Please select at least one student to export");
      return;
    }

    const toastId = toast.loading(
      `Exporting ${selectedStudentIds.length} selected students...`,
    );

    try {
      const currentData =
        activeTab === "registered"
          ? currentPageRegistrations
          : currentPageUnregistered;

      const studentsToExport = currentData.filter((s) =>
        selectedStudentIds.includes(s.id),
      );

      // Generate CSV
      const headers = [
        "Name",
        "Email",
        "Phone",
        "Admission Number",
        "Madrasa",
        "Mekhala",
        "Gender",
        "Class",
        "Exam Name",
        "Hall Ticket Number",
        "Hall Ticket URL",
      ];

      const rows = studentsToExport.map((student) => [
        formatStudentName(
          student.registration?.studentName || student.fullName,
        ),
        student.registration?.studentEmail || student.email || "",
        student.registration?.studentPhone || student.phone || "",
        student.registration?.admissionNumber || student.admissionNumber || "",
        student.registration?.madarsa ||
          getMadrasaName(student.madarsaId, madrasas),
        student.registration?.mekhala ||
          getMekhalaNameByDistrict(student.madarsaId, madrasas, mekhalas),
        student.registration?.gender || student.gender || "",
        student.registration?.classLevel || student.classLevel || "",
        student.registration?.examTitle || exam?.title || "",
        student.registration?.hallTicketNumber || "",
        student.registration?.hallTicketUrl || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      // Download CSV with UTF-8 BOM for Malayalam/Unicode support
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `selected-${activeTab}-students-${exam?.title || "exam"}-${
          new Date().toISOString().split("T")[0]
        }.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(
        `Successfully exported ${studentsToExport.length} selected students`,
        { id: toastId, duration: 3000 },
      );
    } catch (error) {
      console.error("Error exporting selected students:", error);
      toast.error("Failed to export selected students. Please try again.", {
        id: toastId,
      });
    }
  };

  // Pagination helpers
  const getCurrentPageData = (data) => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(
    (activeTab === "registered"
      ? totalRegisteredCount
      : totalUnregisteredCount) / pageSize,
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
      </Layout>
    );
  }

  if (error && !exam) {
    return (
      <Layout>
        <div className="p-6">
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
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-3 sm:mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                {exam?.title || "Exam Details"}
                {exam?.isActive === false && (
                  <Badge variant="destructive" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                <p className="text-sm sm:text-base text-gray-500 flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(exam?.examDate)}
                </p>
                {exam?.class && (
                  <p className="text-sm sm:text-base text-gray-500 flex items-center gap-1">
                    <GraduationCap className="h-4 w-4" />
                    Class: {exam.class}
                  </p>
                )}
                {exam?.fees && (
                  <p className="text-sm sm:text-base text-teal-600 font-semibold flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Fees: {exam.fees}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/dashboard/dkju-control/exam/create?id=${exam.id}`)
                }
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Exam
              </Button>
            </div>
          </div>
        </div>

        {/* Detailed Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-teal-50 border-teal-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-teal-900 flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Pass Criteria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-teal-700">Overall Pass Mark:</span>
                <span className="font-bold text-teal-900">
                  {exam?.overallPassMark || "N/A"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-teal-700">First Class Mark:</span>
                <span className="font-bold text-teal-900">
                  {exam?.firstFirstClassMark || "N/A"}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-teal-200 pt-2 font-black uppercase text-[10px] tracking-wider">
                <span className="text-teal-800">Total Exam Marks:</span>
                <span className="text-teal-900">
                  {exam?.totalMarks || "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 bg-gray-50 border-gray-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Exam Description & Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 line-clamp-3">
                {exam?.description ||
                  exam?.notice ||
                  "No description provided for this examination."}
              </p>
              {exam?.registrationDeadline && (
                <div className="mt-2 text-xs font-semibold text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Registration Deadline: {formatDate(exam.registrationDeadline)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Card>
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
                Total Students
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 sm:pb-4">
              <div className="flex items-center justify-between">
                <div className="text-xl sm:text-2xl font-bold text-gray-900">
                  {stats.totalActiveStudents}
                </div>
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
                Registered
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 sm:pb-4">
              <div className="flex items-center justify-between">
                <div className="text-xl sm:text-2xl font-bold text-green-600">
                  {stats.registeredStudents}
                </div>
                <UserCheck className="h-6 w-6 sm:h-8 sm:w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
                Unregistered
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 sm:pb-4">
              <div className="flex items-center justify-between">
                <div className="text-xl sm:text-2xl font-bold text-orange-600">
                  {stats.unregisteredStudents}
                </div>
                <UserX className="h-6 w-6 sm:h-8 sm:w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
                Registration Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 sm:pb-4">
              <div className="flex items-center justify-between">
                <div className="text-xl sm:text-2xl font-bold text-blue-600">
                  {stats.registrationRate}%
                </div>
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="mb-4 sm:mb-6">
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Search */}
              <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Search by name, admission no..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* District Filter */}
              <div>
                <Label htmlFor="mekhala">District</Label>
                <Select value={filterMekhala} onValueChange={setFilterMekhala}>
                  <SelectTrigger id="mekhala">
                    <SelectValue placeholder="All Mekhalas" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Mekhalas</SelectItem>
                    {mekhalas.map((mekhala) => (
                      <SelectItem key={mekhala.id} value={mekhala.id}>
                        {mekhala.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Mekhala Filter */}
              <div>
                <Label htmlFor="district">Mekhala</Label>
                <Select
                  value={filterDistrict}
                  onValueChange={setFilterDistrict}
                >
                  <SelectTrigger id="district">
                    <SelectValue placeholder="All Districts" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Districts</SelectItem>
                    {filteredDistrictOptions.map((district) => (
                      <SelectItem key={district.name} value={district.name}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Madrasa Filter */}
              <div>
                <Label htmlFor="madrasa">Madrasa</Label>
                <Popover
                  open={madrasaSearchOpen}
                  onOpenChange={setMadrasaSearchOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={madrasaSearchOpen}
                      className="w-full justify-between font-normal"
                    >
                      {filterMahal === "all"
                        ? "All Madrasas"
                        : (() => {
                            const m = filteredMadrasas.find(
                              (m) => m.madarsaId === filterMahal,
                            );
                            return m
                              ? `${m.name} (${m.madarsaId})`
                              : "Select Madrasa";
                          })()}
                      <svg
                        className="ml-2 h-4 w-4 shrink-0 opacity-50"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[300px] p-0 bg-white"
                    align="start"
                  >
                    <Command>
                      <CommandInput
                        placeholder="Search by name or MID..."
                        value={madrasaSearchTerm}
                        onValueChange={setMadrasaSearchTerm}
                      />
                      <CommandEmpty>No madrasa found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        <CommandItem
                          key="all"
                          onSelect={() => {
                            setFilterMahal("all");
                            setMadrasaSearchOpen(false);
                            setMadrasaSearchTerm("");
                          }}
                        >
                          <CheckCircle
                            className={`mr-2 h-4 w-4 ${
                              filterMahal === "all"
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />
                          All Madrasas
                        </CommandItem>
                        {filteredMadrasas
                          .filter((madrasa) => {
                            const search = madrasaSearchTerm.toLowerCase();
                            return (
                              madrasa.name?.toLowerCase().includes(search) ||
                              madrasa.id?.toLowerCase().includes(search) ||
                              madrasa.madarsaId?.toLowerCase().includes(search)
                            );
                          })
                          .map((madrasa) => (
                            <CommandItem
                              key={madrasa.id}
                              onSelect={() => {
                                setFilterMahal(madrasa.madarsaId);
                                setMadrasaSearchOpen(false);
                                setMadrasaSearchTerm("");
                              }}
                            >
                              <CheckCircle
                                className={`mr-2 h-4 w-4 ${
                                  filterMahal === madrasa.madarsaId
                                    ? "opacity-100"
                                    : "opacity-0"
                                }`}
                              />
                              <div className="flex flex-col">
                                <span>{madrasa.name}</span>
                                {(madrasa.madarsaId || madrasa.id) && (
                                  <span className="text-xs text-gray-500">
                                    MID: {madrasa.madarsaId || madrasa.id}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Class Filter */}
              <div>
                <Label htmlFor="class">Class</Label>
                <Select value={filterClass} onValueChange={setFilterClass}>
                  <SelectTrigger id="class">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls} value={cls}>
                        {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Gender Filter */}
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select value={filterGender} onValueChange={setFilterGender}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="All Genders" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Genders</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs for Registered/Unregistered */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg sm:text-xl">Students</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportAllStudents}
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </Button>
              </div>

              {Object.values(selectedStudents).some((v) => v) && (
                <div className="flex flex-col sm:flex-row gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 text-sm text-blue-700 font-medium flex-1">
                    <CheckCircle className="h-4 w-4" />
                    {
                      Object.values(selectedStudents).filter((v) => v).length
                    }{" "}
                    student(s) selected
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportSelectedStudents}
                      className="flex-1 sm:flex-none"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Selected
                    </Button>
                    {activeTab === "registered" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={bulkDownloadHallTickets}
                        disabled={downloadingBulkHallTickets}
                        className="flex-1 sm:flex-none"
                      >
                        {downloadingBulkHallTickets ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        ) : (
                          <Printer className="h-4 w-4 mr-2" />
                        )}
                        {downloadingBulkHallTickets
                          ? "Preparing..."
                          : "Download Hall Tickets"}
                      </Button>
                    )}
                    {activeTab === "unregistered" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={bulkRegisterStudents}
                        disabled={bulkRegistrationProgress.inProgress}
                        className="flex-1 sm:flex-none"
                      >
                        {bulkRegistrationProgress.inProgress ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Registering...
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Register Selected
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            {/* Selected Students Display */}
            {selectedStudentsList.length > 0 && (
              <Card className="mb-4 bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-blue-900">
                      Selected Students ({selectedStudentsList.length})
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedStudents({});
                        setSelectedStudentsList([]);
                        setSelectAll(false);
                      }}
                      className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                    >
                      Clear All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {selectedStudentsList.map((student) => (
                      <Badge
                        key={student.id}
                        variant="secondary"
                        className="px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-200 flex items-center gap-2 bg-white border-blue-300"
                      >
                        <span className="font-medium text-blue-900">
                          {student.fullName}
                        </span>
                        <span className="text-blue-400">•</span>
                        <span className="text-blue-700">
                          {student.admissionNumber}
                        </span>
                        <X
                          className="ml-1 h-3 w-3 hover:text-red-600 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectStudent(student.id);
                          }}
                        />
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bulk Registration Progress Indicator */}
            {bulkRegistrationProgress.inProgress && (
              <Alert className="mb-4 bg-green-50 border-green-200">
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-900">
                      Registering students: {bulkRegistrationProgress.completed}{" "}
                      / {bulkRegistrationProgress.total}
                    </span>
                    <div className="w-48 h-2 bg-green-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all duration-300"
                        style={{
                          width: `${
                            (bulkRegistrationProgress.completed /
                              bulkRegistrationProgress.total) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="registered">
                  Registered ({totalRegisteredCount})
                </TabsTrigger>
                <TabsTrigger value="unregistered">
                  Unregistered ({totalUnregisteredCount})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="registered">
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectAll}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead className="min-w-[150px]">Name</TableHead>
                        <TableHead className="min-w-[100px] hidden sm:table-cell">
                          Hall Ticket
                        </TableHead>
                        <TableHead className="min-w-[120px] hidden md:table-cell">
                          Admission No
                        </TableHead>
                        <TableHead className="min-w-[120px] hidden lg:table-cell">
                          Madarsa
                        </TableHead>
                        <TableHead className="min-w-[80px] hidden xl:table-cell">
                          Class
                        </TableHead>
                        <TableHead className="w-36">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingPage ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                              <p className="text-sm text-gray-600">
                                Loading students...
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : currentPageRegistrations.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-center py-8 text-gray-500"
                          >
                            No registered students found
                          </TableCell>
                        </TableRow>
                      ) : (
                        currentPageRegistrations.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell>
                              <Checkbox
                                checked={!!selectedStudents[student.id]}
                                onCheckedChange={() =>
                                  handleSelectStudent(student.id)
                                }
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="min-w-[120px]">
                                {student.fullName || "N/A"}
                                <div className="sm:hidden text-xs text-gray-500 mt-1">
                                  {student.registration?.hallTicketNumber ||
                                    "N/A"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge
                                variant="secondary"
                                className="font-mono text-xs"
                              >
                                {student.registration?.hallTicketNumber ||
                                  "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {student.admissionNumber || "N/A"}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="max-w-[150px] truncate">
                                {getMadrasaName(student.madarsaId, madrasas)}
                              </div>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell">
                              {student.classLevel || "N/A"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => viewStudentDetails(student)}
                                  className="h-8 w-8 p-0"
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => downloadHallTicket(student)}
                                  disabled={generatingHallTickets[student.id]}
                                  className="h-8 w-8 p-0"
                                  title="Download Hall Ticket"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    showDeleteConfirmation(student)
                                  }
                                  disabled={deletingRegistrations[student.id]}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Delete Registration"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="unregistered">
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectAll}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead className="min-w-[150px]">Name</TableHead>
                        <TableHead className="min-w-[120px] hidden sm:table-cell">
                          Admission No
                        </TableHead>
                        <TableHead className="min-w-[120px] hidden md:table-cell">
                          Madarsa
                        </TableHead>
                        <TableHead className="min-w-[100px] hidden lg:table-cell">
                          Mekhala
                        </TableHead>
                        <TableHead className="min-w-[100px] hidden lg:table-cell">
                          District
                        </TableHead>
                        <TableHead className="min-w-[80px] hidden xl:table-cell">
                          Class
                        </TableHead>
                        <TableHead className="min-w-[80px] hidden xl:table-cell">
                          Gender
                        </TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingPage ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                              <p className="text-sm text-gray-600">
                                Loading students...
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : currentPageUnregistered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="text-center py-8 text-gray-500"
                          >
                            No unregistered students found
                          </TableCell>
                        </TableRow>
                      ) : (
                        currentPageUnregistered.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell>
                              <Checkbox
                                checked={!!selectedStudents[student.id]}
                                onCheckedChange={() =>
                                  handleSelectStudent(student.id)
                                }
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="min-w-[120px]">
                                {student.fullName || "N/A"}
                                <div className="sm:hidden text-xs text-gray-500 mt-1">
                                  {student.admissionNumber || "N/A"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {student.admissionNumber || "N/A"}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="max-w-[150px] truncate">
                                {getMadrasaName(student.madarsaId, madrasas)}
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="max-w-[120px] truncate">
                                {getDistrictName(student.madarsaId, madrasas)}
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="max-w-[120px] truncate">
                                {getMekhalaNameByDistrict(
                                  student.madarsaId,
                                  madrasas,
                                  mekhalas,
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell">
                              {student.classLevel || "N/A"}
                            </TableCell>
                            <TableCell className="hidden xl:table-cell">
                              <Badge variant="outline" className="text-xs">
                                {student.gender || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => viewStudentDetails(student)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() =>
                                    showRegisterConfirmation(student)
                                  }
                                  disabled={registeringStudents[student.id]}
                                  className="h-8 text-xs px-2"
                                >
                                  {registeringStudents[student.id]
                                    ? "..."
                                    : "Register"}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={
                    activeTab === "registered"
                      ? totalRegisteredCount
                      : totalUnregisteredCount
                  }
                  itemsPerPage={pageSize}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student Details Dialog */}
        <Dialog
          open={isStudentDialogOpen}
          onOpenChange={setIsStudentDialogOpen}
        >
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white mx-4">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                Student Details
              </DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Full Name
                    </p>
                    <p className="text-base font-semibold">
                      {selectedStudent.fullName || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Admission Number
                    </p>
                    <p className="text-base">
                      {selectedStudent.admissionNumber || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Email</p>
                    <p className="text-base">
                      {selectedStudent.email || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Phone</p>
                    <p className="text-base">
                      {selectedStudent.phone || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Gender</p>
                    <p className="text-base">
                      {selectedStudent.gender || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Class</p>
                    <p className="text-base">
                      {selectedStudent.classLevel || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Madarsa</p>
                    <p className="text-base">
                      {getMadrasaName(selectedStudent.madarsaId, madrasas)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      District
                    </p>
                    <p className="text-base">
                      {getMekhalaNameByDistrict(
                        selectedStudent.madarsaId,
                        madrasas,
                        mekhalas,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Date of Birth
                    </p>
                    <p className="text-base">
                      {formatDate(selectedStudent.dateOfBirth)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Guardian Phone
                    </p>
                    <p className="text-base">
                      {selectedStudent.guardianPhone || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Register Confirmation Dialog */}
        <Dialog
          open={isRegisterDialogOpen}
          onOpenChange={setIsRegisterDialogOpen}
        >
          <DialogContent className="bg-white mx-4 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                Confirm Registration
              </DialogTitle>
              <DialogDescription className="text-sm">
                Are you sure you want to register this student for the exam?
              </DialogDescription>
            </DialogHeader>
            {studentToRegister && (
              <div className="space-y-2 py-4 text-sm">
                <p>
                  <strong>Student:</strong> {studentToRegister.fullName}
                </p>
                <p>
                  <strong>Exam:</strong> {exam?.title}
                </p>
                <p>
                  <strong>Exam Date:</strong> {formatDate(exam?.examDate)}
                </p>
                <p>
                  <strong>Fees:</strong> ₹{exam?.fees || 0} (Waived)
                </p>
              </div>
            )}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setIsRegisterDialogOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmRegisterStudent}
                className="w-full sm:w-auto"
              >
                Confirm Registration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Registration Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="bg-white mx-4 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Delete Registration
              </DialogTitle>
              <DialogDescription className="text-sm">
                Are you sure you want to delete this exam registration? This
                action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {registrationToDelete && (
              <div className="space-y-2 py-4 text-sm bg-red-50 rounded-lg p-4 border border-red-200">
                <p>
                  <strong>Student:</strong>{" "}
                  {registrationToDelete.student.fullName}
                </p>
                <p>
                  <strong>Admission No:</strong>{" "}
                  {registrationToDelete.student.admissionNumber || "N/A"}
                </p>
                <p>
                  <strong>Exam:</strong> {exam?.title}
                </p>
                <p>
                  <strong>Registration Date:</strong>{" "}
                  {registrationToDelete.registration?.createdAt
                    ? formatDate(registrationToDelete.registration.createdAt)
                    : "N/A"}
                </p>
              </div>
            )}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setRegistrationToDelete(null);
                }}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteRegistration}
                className="w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Registration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
