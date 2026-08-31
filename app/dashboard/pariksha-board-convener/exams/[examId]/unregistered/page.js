"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  Users,
  UserCheck,
  UserX,
  Search,
  Eye,
  Download,
  BookOpen,
  ArrowLeft,
  CheckCircle,
  Check,
  ChevronsUpDown,
} from "lucide-react";

import { getDocument, COLLECTIONS } from "@/lib/firestoreService";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchMetadata, searchStudents } from "@/lib/firestoreQueries";
import {
  fetchUnregisteredStudents,
  getUnregisteredStudentsCount,
  getExamRegistrationsCount,
} from "@/lib/examDetailQueries";

import { toast } from "sonner";

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

// Helper function to get madrasa name
const getMadrasaName = (madrasaId, madrasaMap) => {
  if (!madrasaId) return "N/A";
  if (madrasaMap instanceof Map) {
    const madrasa = madrasaMap.get(madrasaId);
    return madrasa?.name || madrasaId;
  }
  return madrasaId;
};

export default function ExamUnregisteredStudentsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, role } = useAuth();
  const examId = params.examId;

  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState("");

  // Data States - Optimized
  const [exam, setExam] = useState(null);
  const [currentPageStudents, setCurrentPageStudents] = useState([]);
  const [madrasaMap, setMadrasaMap] = useState(new Map());
  const [madrasas, setMadrasas] = useState([]);
  const [mekhalas, setMekhalas] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);
  const [studentToRegister, setStudentToRegister] = useState(null);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedGender, setSelectedGender] = useState("all");

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 1000);
    return () => clearTimeout(handler);
  }, [searchTerm]);
  const [selectedMadrasa, setSelectedMadrasa] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [madrasaSearchOpen, setMadrasaSearchOpen] = useState(false);

  // State for registering students
  const [registeringStudents, setRegisteringStudents] = useState({});

  // Checkbox selection states
  const [selectedStudents, setSelectedStudents] = useState({});
  const [selectAll, setSelectAll] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalUnregisteredCount, setTotalUnregisteredCount] = useState(0);
  const [totalRegisteredCount, setTotalRegisteredCount] = useState(0);
  const lastDocRef = useRef(null);

  // Classes list
  const [classes, setClasses] = useState([]);

  // Load metadata
  const loadMetadata = useCallback(async () => {
    try {
      const { madrasas, mekhalas, madrasaMap } = await fetchMetadata();
      setMadrasas(madrasas);
      setMekhalas(mekhalas);
      setMadrasaMap(madrasaMap);

      // Class levels come from a server-cached endpoint instead of scanning
      // the entire (54k+ document) students collection client-side — that
      // full scan could take minutes or hit the Firestore read quota, which
      // looked like the page being permanently stuck on "Loading...".
      const classesRes = await fetch('/api/students/class-levels', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (classesRes.ok) {
        const classesJson = await classesRes.json();
        setClasses(classesJson.classes || []);
      }
    } catch (error) {
      console.error("Error loading metadata:", error);
    }
  }, []);

  // Fetch exam details
  const fetchExam = useCallback(async () => {
    if (!examId) return;

    try {
      const examData = await getDocument(COLLECTIONS.EXAMS, examId);
      if (examData) {
        setExam(examData);
      } else {
        setError("Exam not found");
      }
    } catch (error) {
      console.error("Error fetching exam:", error);
      setError("Failed to fetch exam details");
    }
  }, [examId]);

  // Load unregistered students for current page
  const loadUnregisteredPage = useCallback(async () => {
    if (!examId) return;

    setLoadingPage(true);
    try {
      console.log(
        `[UNREGISTERED] Loading page ${currentPage}, search: ${debouncedSearchTerm}`,
      );

      const filters = {
        madarsaId: selectedMadrasa !== "all" ? selectedMadrasa : null,
        gender: selectedGender !== "all" ? selectedGender : null,
        classLevel: selectedClass !== "all" ? selectedClass : null,
        searchTerm: debouncedSearchTerm,
        page: currentPage,
      };

      // 1. Get stats matching the current filters
      const [unregCount, regCount] = await Promise.all([
        getUnregisteredStudentsCount(examId, filters),
        getExamRegistrationsCount(examId, filters),
      ]);

      setTotalUnregisteredCount(unregCount);
      setTotalRegisteredCount(regCount);

      // 2. Fetch Unregistered Students
      const { students, lastVisible } = await fetchUnregisteredStudents(
        examId,
        filters,
        pageSize,
        currentPage > 1 ? lastDocRef.current : null,
      );

      setCurrentPageStudents(students);
      lastDocRef.current = lastVisible;
    } catch (error) {
      console.error("Error loading unregistered students:", error);
      setError("Failed to load unregistered students");
    } finally {
      setLoadingPage(false);
    }
  }, [
    examId,
    currentPage,
    pageSize,
    selectedMadrasa,
    selectedGender,
    selectedClass,
    debouncedSearchTerm,
  ]);

  // Initial load
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([fetchExam(), loadMetadata()]);
      setLoading(false);
    };
    initializeData();
  }, [fetchExam, loadMetadata]);

  // Load page data when filters or page changes
  useEffect(() => {
    if (!loading && examId) {
      loadUnregisteredPage();
    }
  }, [
    loading,
    examId,
    currentPage,
    pageSize,
    selectedMadrasa,
    selectedGender,
    selectedClass,
    loadUnregisteredPage,
  ]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    lastDocRef.current = null;
  }, [selectedMadrasa, selectedGender, selectedClass, searchTerm]);

  // Get statistics
  const stats = {
    totalActiveStudents: totalUnregisteredCount + totalRegisteredCount,
    registeredStudents: totalRegisteredCount,
    unregisteredStudents: totalUnregisteredCount,
    registrationRate:
      totalUnregisteredCount + totalRegisteredCount > 0
        ? (
            (totalRegisteredCount /
              (totalUnregisteredCount + totalRegisteredCount)) *
            100
          ).toFixed(1)
        : "0.0",
  };

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedStudents({});
      setSelectAll(false);
    } else {
      const newSelection = {};
      filteredStudents.forEach((student) => {
        newSelection[student.id] = true;
      });
      setSelectedStudents(newSelection);
      setSelectAll(true);
    }
  };

  // Handle individual checkbox
  const handleSelectStudent = (studentId) => {
    setSelectedStudents((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  // Search is applied server-side via loadUnregisteredPage
  const filteredStudents = currentPageStudents;

  // Update selectAll state when individual checkboxes change
  useEffect(() => {
    const allSelected =
      filteredStudents.length > 0 &&
      filteredStudents.every((student) => selectedStudents[student.id]);
    setSelectAll(allSelected);
  }, [selectedStudents, filteredStudents]);

  // Bulk register selected students
  const bulkRegisterStudents = async () => {
    const selectedStudentIds = Object.keys(selectedStudents).filter(
      (id) => selectedStudents[id],
    );

    if (selectedStudentIds.length === 0) {
      toast.error("Please select at least one student to register");
      return;
    }

    const toastId = toast.loading(
      `Registering ${selectedStudentIds.length} students...`,
    );

    try {
      setRegisteringStudents((prev) => {
        const newState = { ...prev };
        selectedStudentIds.forEach((id) => {
          newState[id] = true;
        });
        return newState;
      });

      const registrationPromises = selectedStudentIds.map(async (studentId) => {
        const student = currentPageStudents.find((s) => s.id === studentId);
        if (!student) return;

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
          madarsaId: student.madarsaId || "",
          madarsa: getMadrasaName(student.madarsaId, madrasaMap),
          classLevel: student.classLevel || "",
          gender: student.gender || "",
          status: "registered",
          paymentStatus: "waived",
          paymentMethod: "convener_bulk_registration",
          registeredBy: user?.uid || "convener",
          registeredByName: user?.email || "Convener",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        return addDoc(
          collection(db, COLLECTIONS.EXAM_REGISTRATIONS),
          registrationData,
        );
      });

      await Promise.all(registrationPromises);

      toast.success(
        `Successfully registered ${selectedStudentIds.length} students`,
        {
          id: toastId,
          duration: 5000,
        },
      );

      // Clear selections and refresh
      setSelectedStudents({});
      setSelectAll(false);
      await loadUnregisteredPage();
    } catch (error) {
      console.error("Error bulk registering students:", error);
      toast.error("Failed to register some students: " + error.message, {
        id: toastId,
      });
    } finally {
      setRegisteringStudents({});
    }
  };

  // Show registration confirmation dialog
  const showRegisterConfirmation = (student) => {
    setStudentToRegister(student);
    setIsRegisterDialogOpen(true);
  };

  // Register student without payment
  const confirmRegisterStudent = async () => {
    if (!exam || !studentToRegister) return;

    try {
      setRegisteringStudents((prev) => ({
        ...prev,
        [studentToRegister.id]: true,
      }));
      setIsRegisterDialogOpen(false);

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
        madarsaId: studentToRegister.madarsaId || "",
        madarsa: getMadrasaName(studentToRegister.madarsaId, madrasaMap),
        classLevel: studentToRegister.classLevel || "",
        gender: studentToRegister.gender || "",
        status: "registered",
        paymentStatus: "waived",
        paymentMethod: "convener_registration",
        registeredBy: user?.uid || "convener",
        registeredByName: user?.email || "Pariksha Board Convener",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(
        collection(db, COLLECTIONS.EXAM_REGISTRATIONS),
        registrationData,
      );

      toast.success(`Successfully registered ${studentToRegister.fullName}`);
      await loadUnregisteredPage();
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
  const viewStudentDetails = (student) => {
    setSelectedStudent(student);
    setIsStudentDialogOpen(true);
  };

  // Export all unregistered students
  const exportUnregisteredStudents = async () => {
    const toastId = toast.loading("Fetching all unregistered students...");

    try {
      // Get registered student IDs
      const registrationsRef = collection(db, COLLECTIONS.EXAM_REGISTRATIONS);
      const regQuery = query(registrationsRef, where("examId", "==", examId));
      const regSnapshot = await getDocs(regQuery);
      const registeredStudentIds = regSnapshot.docs.map(
        (doc) => doc.data().studentId,
      );

      toast.loading("Fetching student data...", { id: toastId });

      // Fetch all students with filters
      const studentsRef = collection(db, COLLECTIONS.STUDENTS);
      const constraints = [where("status", "==", "active")];

      if (selectedMadrasa !== "all") {
        constraints.push(where("madarsaId", "==", selectedMadrasa));
      }
      if (selectedGender !== "all") {
        constraints.push(where("gender", "==", selectedGender));
      }
      if (selectedClass !== "all") {
        constraints.push(where("classLevel", "==", selectedClass));
      }

      constraints.push(orderBy("fullName", "asc"));

      const q = query(studentsRef, ...constraints);
      const snapshot = await getDocs(q);

      const allStudents = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((student) => !registeredStudentIds.includes(student.id));

      toast.loading(`Preparing CSV with ${allStudents.length} records...`, {
        id: toastId,
      });

      const headers = [
        "Name",
        "Email",
        "Phone",
        "Admission Number",
        "Madrasa",
        "Gender",
        "Class",
      ];

      const csvData = allStudents.map((student) => [
        student.fullName || "",
        student.email || "",
        student.phone || "",
        student.admissionNumber || "",
        getMadrasaName(student.madarsaId, madrasaMap),
        student.gender || "",
        student.classLevel || "",
      ]);

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
        `unregistered-students-${exam?.title || "exam"}-${
          new Date().toISOString().split("T")[0]
        }.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Successfully exported ${allStudents.length} students`, {
        id: toastId,
        duration: 5000,
      });
    } catch (error) {
      console.error("Error exporting students:", error);
      toast.error("Failed to export students", { id: toastId });
    }
  };

  const totalPages = Math.ceil(totalUnregisteredCount / pageSize);
  const selectedCount = Object.values(selectedStudents).filter(Boolean).length;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error && !exam) {
    return (
      <Layout>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            className="mt-4"
            onClick={() =>
              router.push("/dashboard/pariksha-board-convener/exams")
            }
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Exams
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              router.push("/dashboard/pariksha-board-convener/exams")
            }
            className="text-black hover:bg-teal-500"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Exams
          </Button>
        </div>

        <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">
            Unregistered Students - {exam?.title || "Exam"}
          </h1>
          <p className="text-teal-100">Students who havent registered yet</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Students</p>
                  <p className="text-2xl font-bold">
                    {stats.totalActiveStudents}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <UserCheck className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Registered</p>
                  <p className="text-2xl font-bold">
                    {stats.registeredStudents}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <UserX className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-sm text-gray-600">Unregistered</p>
                  <p className="text-2xl font-bold">
                    {stats.unregisteredStudents}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <BookOpen className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Registration Rate</p>
                  <p className="text-2xl font-bold">
                    {stats.registrationRate}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle>Filter & Search</CardTitle>
              <div className="flex gap-2">
                {selectedCount > 0 && (
                  <Button
                    onClick={bulkRegisterStudents}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Register Selected ({selectedCount})
                  </Button>
                )}
                <Button
                  onClick={exportUnregisteredStudents}
                  disabled={totalUnregisteredCount === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="lg:col-span-4">
                <Label>Search Students</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Name, email, phone, admission #..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Madrasa Filter */}
              <div>
                <Label>Madrasa</Label>
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
                    <Command>
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

              {/* Gender Filter */}
              <div>
                <Label>Gender</Label>
                <Select
                  value={selectedGender}
                  onValueChange={setSelectedGender}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Genders</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Class Filter */}
              <div>
                <Label>Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue />
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
            </div>
          </CardContent>
        </Card>

        {/* Students Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Unregistered Students ({filteredStudents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPage ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-600 mt-3">
                  Loading students...
                </p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No unregistered students found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectAll}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Madrasa</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedStudents[student.id] || false}
                            onCheckedChange={() =>
                              handleSelectStudent(student.id)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{student.fullName}</p>
                            <p className="text-sm text-gray-500">
                              {student.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{student.gender}</Badge>
                        </TableCell>
                        <TableCell>
                          {getMadrasaName(student.madarsaId, madrasaMap)}
                        </TableCell>
                        <TableCell>
                          {String(student.classLevel || "").toUpperCase() ===
                          "UKG"
                            ? "Ukg"
                            : student.classLevel}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewStudentDetails(student)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => showRegisterConfirmation(student)}
                              disabled={registeringStudents[student.id]}
                            >
                              {registeringStudents[student.id]
                                ? "..."
                                : "Register"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalUnregisteredCount}
            itemsPerPage={pageSize}
          />
        )}

        {/* Student Details Dialog */}
        <Dialog
          open={isStudentDialogOpen}
          onOpenChange={setIsStudentDialogOpen}
        >
          <DialogContent className="max-w-2xl bg-white">
            <DialogHeader>
              <DialogTitle>Student Details</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Name</p>
                  <p className="text-base">{selectedStudent.fullName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-base">{selectedStudent.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="text-base">{selectedStudent.phone}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Gender</p>
                  <p className="text-base">{selectedStudent.gender}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Madrasa</p>
                  <p className="text-base">
                    {getMadrasaName(selectedStudent.madarsaId, madrasaMap)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Class</p>
                  <p className="text-base">{selectedStudent.classLevel}</p>
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
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Confirm Registration</DialogTitle>
              <DialogDescription>
                Are you sure you want to register this student for the exam?
              </DialogDescription>
            </DialogHeader>
            {studentToRegister && (
              <div className="space-y-2 py-4">
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
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsRegisterDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={confirmRegisterStudent}>
                Confirm Registration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
