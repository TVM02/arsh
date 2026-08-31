"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
} from "@/components/ui/dialog";
import {
  Users,
  UserCheck,
  UserX,
  Search,
  Eye,
  FileText,
  User,
  Mail,
  Phone,
  School,
  BookOpen,
  MapPin,
  Calendar,
  Download,
} from "lucide-react";
import { getDocuments, COLLECTIONS } from "@/lib/firestoreService";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchStudentsByIds, fetchMetadata } from "@/lib/firestoreQueries";
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

export default function UnregisteredStudentsPage() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState("");

  // Data States - Optimized for pagination
  const [currentPageStudents, setCurrentPageStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [madrasaMap, setMadrasaMap] = useState(new Map());
  const [madrasas, setMadrasas] = useState([]);
  const [mekhalas, setMekhalas] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedMadrasa, setSelectedMadrasa] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [viewMode, setViewMode] = useState("table");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalRegistered, setTotalRegistered] = useState(0);
  const lastDocRef = useRef(null);

  // Classes list
  const [classes, setClasses] = useState([]);

  // Load metadata (madrasas, mekhalas) - cached
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

  // Fetch exams
  const fetchExams = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      const fetchedExams = await getDocuments(COLLECTIONS.EXAMS, constraints);
      setExams(fetchedExams);

      if (fetchedExams.length > 0 && !selectedExam) {
        setSelectedExam(fetchedExams[0].id);
      }
    } catch (error) {
      console.error("Error fetching exams:", error);
    }
  }, [selectedExam]);

  // Load unregistered students for current page
  const loadUnregisteredPage = useCallback(async () => {
    if (!selectedExam) return;

    setLoadingPage(true);
    try {
      console.log(
        `[UNREGISTERED] Loading page ${currentPage}, pageSize: ${pageSize}`,
      );

      // Get registered student IDs for this exam
      const registrationsRef = collection(db, COLLECTIONS.EXAM_REGISTRATIONS);
      const regQuery = query(
        registrationsRef,
        where("examId", "==", selectedExam),
      );
      const regSnapshot = await getDocs(regQuery);
      const registeredStudentIds = regSnapshot.docs.map(
        (doc) => doc.data().studentId,
      );
      setTotalRegistered(registeredStudentIds.length);

      // Build student query with filters
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

      // Get total count
      const countQuery = query(studentsRef, ...constraints);
      const countSnap = await getCountFromServer(countQuery);
      const totalActive = countSnap.data().count;

      // Fetch current page with pagination
      constraints.push(orderBy("fullName", "asc"));
      constraints.push(limit(pageSize * 2)); // Fetch extra to account for filtering

      if (currentPage > 1 && lastDocRef.current) {
        constraints.push(startAfter(lastDocRef.current));
      }

      const q = query(studentsRef, ...constraints);
      const snapshot = await getDocs(q);

      // Filter out registered students
      const students = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((student) => !registeredStudentIds.includes(student.id))
        .slice(0, pageSize);

      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;

      console.log(
        `[UNREGISTERED] Loaded ${students.length} students for page ${currentPage}`,
      );

      setCurrentPageStudents(students);
      setTotalStudents(Math.max(0, totalActive - registeredStudentIds.length));
    } catch (error) {
      console.error("Error loading unregistered students:", error);
      setError("Failed to load unregistered students");
    } finally {
      setLoadingPage(false);
    }
  }, [
    selectedExam,
    currentPage,
    pageSize,
    selectedMadrasa,
    selectedGender,
    selectedClass,
  ]);

  // Initial load
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([fetchExams(), loadMetadata()]);
      setLoading(false);
    };
    initializeData();
  }, [fetchExams, loadMetadata]);

  // Load page data when filters or page changes
  useEffect(() => {
    if (!loading && selectedExam) {
      loadUnregisteredPage();
    }
  }, [
    loading,
    selectedExam,
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
  }, [
    selectedExam,
    selectedMadrasa,
    selectedGender,
    selectedClass,
    searchTerm,
  ]);

  // Get statistics
  const stats = {
    totalStudents,
    registeredStudents: totalRegistered,
    unregisteredStudents: totalStudents,
  };

  // View student details
  const viewStudentDetails = (student) => {
    setSelectedStudent({
      student,
      madrasaName: getMadrasaName(student.madarsaId, madrasaMap),
    });
    setIsStudentDialogOpen(true);
  };

  // Export all unregistered students
  const exportUnregisteredStudents = async () => {
    const toastId = toast.loading("Fetching all unregistered students...");

    try {
      // Get registered student IDs
      const registrationsRef = collection(db, COLLECTIONS.EXAM_REGISTRATIONS);
      const regQuery = query(
        registrationsRef,
        where("examId", "==", selectedExam),
      );
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
        "Student Name",
        "Email",
        "Phone",
        "Gender",
        "Madrasa",
        "Class Level",
        "Admission Number",
      ];

      const csvData = allStudents.map((student) => [
        student.fullName || "",
        student.email || "",
        student.phone || "",
        student.gender || "",
        getMadrasaName(student.madarsaId, madrasaMap),
        student.classLevel || "",
        student.admissionNumber || "",
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
        `unregistered_students_${new Date().toISOString().split("T")[0]}.csv`,
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

  // Apply search filter client-side (for current page only)
  const filteredStudents = currentPageStudents.filter((student) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const fullName = student.fullName || "";
    const email = student.email || "";
    return (
      fullName.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(totalStudents / pageSize);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading unregistered students...</p>
          </div>
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
              Unregistered Students
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Students who havent completed exam registration
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
            >
              <FileText className="h-4 w-4 mr-2" />
              Table
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Exam Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Exam</CardTitle>
            <CardDescription>
              Choose an exam to view unregistered students
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <Label htmlFor="exam-select">Exam</Label>
              <Select value={selectedExam} onValueChange={setSelectedExam}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select an exam" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <UserX className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Unregistered
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.unregisteredStudents}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Registered
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.registeredStudents}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Total Active
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.registeredStudents + stats.unregisteredStudents}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>Filters</CardTitle>
              <Button
                onClick={exportUnregisteredStudents}
                className="bg-green-600 hover:bg-green-700"
                disabled={totalStudents === 0}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export All ({totalStudents})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="search"
                    placeholder="Name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={selectedGender}
                  onValueChange={setSelectedGender}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Genders</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="madrasa">Madrasa</Label>
                <Select
                  value={selectedMadrasa}
                  onValueChange={setSelectedMadrasa}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Madrasas</SelectItem>
                    {madrasas.map((madrasa) => (
                      <SelectItem key={madrasa.id} value={madrasa.madarsaId}>
                        {madrasa.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="class">Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="mt-1">
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
            {!selectedExam ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Please select an exam</p>
              </div>
            ) : loadingPage ? (
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewStudentDetails(student)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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
            totalItems={totalStudents}
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
                  <p className="text-base">
                    {selectedStudent.student.fullName}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-base">{selectedStudent.student.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="text-base">{selectedStudent.student.phone}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Gender</p>
                  <p className="text-base">{selectedStudent.student.gender}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Madrasa</p>
                  <p className="text-base">{selectedStudent.madrasaName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Class</p>
                  <p className="text-base">
                    {String(
                      selectedStudent.student.classLevel || "",
                    ).toUpperCase() === "UKG"
                      ? "Ukg"
                      : selectedStudent.student.classLevel}
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
