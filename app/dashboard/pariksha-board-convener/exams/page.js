"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authUtils";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  DollarSign,
  Users,
  BookOpen,
  Eye,
  Filter,
  Search,
  Grid3X3,
  Table,
  Users as UsersIcon,
  ClipboardList,
  UserX,
  Download,
  FileText,
  Globe,
  Upload,
} from "lucide-react";
import { getDocuments, COLLECTIONS, getDocument } from "@/lib/firestoreService";
import { orderBy, where } from "firebase/firestore";
import { generateAttendanceSheet } from "@/lib/pdfUtils";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/pagination";
import {
  DISTRICT_ORDER,
  canonicalDistrictName,
  getMekhalaListForDistrict,
  madrasaMatchesDistrict,
  madrasaMatchesMekhala,
  normalizeKey,
} from "@/lib/madrasaHierarchy";

// Helper function to format dates
const formatDate = (dateValue, includeTime = false) => {
  if (!dateValue) return "Not available";

  try {
    let date;
    if (dateValue && typeof dateValue.toDate === "function") {
      date = dateValue.toDate();
    } else {
      date = new Date(dateValue);
    }

    if (isNaN(date.getTime())) {
      return "Invalid date";
    }

    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...(includeTime && { hour: "2-digit", minute: "2-digit" }),
    };

    return date.toLocaleDateString("en-US", options);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Date error";
  }
};

export default function ActiveExams() {
  const router = useRouter();
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exams, setExams] = useState([]);
  const [filteredExams, setFilteredExams] = useState([]);
  const [examRegistrations, setExamRegistrations] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [viewMode, setViewMode] = useState("card"); // 'card' or 'table'

  // Attendance Sheet Dialog States
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [selectedExamForAttendance, setSelectedExamForAttendance] =
    useState(null);
  const [selectedMahal, setSelectedMahal] = useState("all");
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [selectedMekhala, setSelectedMekhala] = useState("all");
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");
  const [enrichedRegistrations, setEnrichedRegistrations] = useState([]);
  const [madrasaMap, setMadrasaMap] = useState(new Map()); // madrasa name -> { madarsaId, name }
  const [madrasaSearch, setMadrasaSearch] = useState(""); // search term for madrasa picker
  const [allMadarsas, setAllMadarsas] = useState([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  const handleGenerateAttendanceSheet = async (exam) => {
    try {
      // Fetch registered students for this exam
      const registeredStudents = examRegistrations.filter(
        (reg) => reg.examId === exam.id,
      );

      if (registeredStudents.length === 0) {
        toast.error("No students registered for this exam");
        return;
      }

      // Fetch student details to get class information - only for registered students
      toast.loading("Loading student data...");
      const studentIds = [
        ...new Set(registeredStudents.map((reg) => reg.studentId)),
      ];

      // Fetch only the students we need using Firestore 'in' query (batch by 30 for Firestore limit)
      const studentMap = {};
      const batchSize = 30; // Firestore 'in' query limit is 30

      for (let i = 0; i < studentIds.length; i += batchSize) {
        const batch = studentIds.slice(i, i + batchSize);
        const batchStudents = await getDocuments(COLLECTIONS.STUDENTS, [
          where("uid", "in", batch),
        ]);
        batchStudents.forEach((student) => {
          studentMap[student.uid] = student;
        });
      }

      // Fetch madrasas to build a name -> {madarsaId, name} map
      const madrasaDocs = await getDocuments(
        COLLECTIONS.MADARSAS || "madarsas",
        [orderBy("name", "asc")],
      );
      setAllMadarsas(madrasaDocs);
      const newMadrasaMap = new Map();
      madrasaDocs.forEach((m) => {
        if (m.name) newMadrasaMap.set(m.name, m);
        if (m.madarsaId) newMadrasaMap.set(m.madarsaId, m);
      });
      setMadrasaMap(newMadrasaMap);

      // Enrich registrations with student class data
      const enriched = registeredStudents.map((reg) => ({
        ...reg,
        classLevel: studentMap[reg.studentId]?.classLevel || null,
        fullName: studentMap[reg.studentId]?.fullName || reg.studentName,
      }));

      setEnrichedRegistrations(enriched);
      toast.dismiss();

      // Open dialog for madrasa and class selection
      setSelectedExamForAttendance(exam);
      setSelectedMahal("all");
      setSelectedDistrict("all");
      setSelectedMekhala("all");
      setSelectedClassFilter("all");
      setAttendanceDialogOpen(true);
    } catch (error) {
      console.error("Error generating attendance sheet:", error);
      toast.dismiss();
      toast.error("Failed to generate attendance sheet");
    }
  };

  const resolveMadrasaDocForRegistration = useCallback(
    (reg) => {
      if (!reg) return null;
      // Prefer id match (if present), then name match
      if (reg.madarsaId && madrasaMap.has(reg.madarsaId)) {
        return madrasaMap.get(reg.madarsaId);
      }
      if (reg.madarsa && madrasaMap.has(reg.madarsa)) {
        return madrasaMap.get(reg.madarsa);
      }
      return null;
    },
    [madrasaMap],
  );

  const registrationsMatchLocation = useCallback(
    (reg) => {
      if (selectedDistrict === "all" && selectedMekhala === "all") return true;
      const doc = resolveMadrasaDocForRegistration(reg);
      // If we can't resolve location and any filter is active, treat as non-match
      if (!doc) return false;
      if (
        selectedDistrict !== "all" &&
        !madrasaMatchesDistrict(doc, selectedDistrict)
      ) {
        return false;
      }
      if (
        selectedMekhala !== "all" &&
        !madrasaMatchesMekhala(doc, selectedMekhala)
      ) {
        return false;
      }
      return true;
    },
    [resolveMadrasaDocForRegistration, selectedDistrict, selectedMekhala],
  );

  const availableDistricts = useMemo(() => {
    return [...DISTRICT_ORDER];
  }, []);

  const availableMekhalas = useMemo(() => {
    if (selectedDistrict === "all") return [];

    const configured = getMekhalaListForDistrict(selectedDistrict);

    const present = new Set();
    enrichedRegistrations.forEach((reg) => {
      const doc = resolveMadrasaDocForRegistration(reg);
      if (!doc) return;
      if (!madrasaMatchesDistrict(doc, selectedDistrict)) return;
      const m = doc?.mekhala;
      if (m) present.add(normalizeKey(m));
    });

    if (configured.length > 0) {
      const filtered = configured.filter((m) => present.has(normalizeKey(m)));
      const list = filtered.length > 0 ? filtered : configured;
      return [...list].sort((a, b) =>
        String(a).localeCompare(String(b), undefined, { sensitivity: "base" }),
      );
    }

    // Fallback: derive from stored data when we don't have a config entry
    return Array.from(present)
      .map((k) => {
        // Try to preserve original casing by looking up from madarsas
        const match = (allMadarsas || []).find(
          (m) => normalizeKey(m?.mekhala) === k,
        );
        return match?.mekhala || k;
      })
      .sort((a, b) => a.localeCompare(b));
  }, [
    allMadarsas,
    enrichedRegistrations,
    resolveMadrasaDocForRegistration,
    selectedDistrict,
  ]);

  // Get unique madrasas from exam registrations
  const getUniqueMadrasas = () => {
    if (!selectedExamForAttendance) return [];

    const filteredRegs = enrichedRegistrations.filter(
      registrationsMatchLocation,
    );
    const names = [
      ...new Set(filteredRegs.map((reg) => reg.madarsa).filter(Boolean)),
    ];

    return names.sort().map((name) => {
      const info = madrasaMap.get(name);
      return {
        value: name,
        label: info?.madarsaId ? `${info.madarsaId} - ${name}` : name,
      };
    });
  };

  // Get unique classes from exam registrations (filtered by mahal if selected)
  const getUniqueClasses = () => {
    if (!selectedExamForAttendance || enrichedRegistrations.length === 0)
      return [];
    let registrations = enrichedRegistrations;

    // Filter by mahal if not "all"
    if (selectedMahal !== "all") {
      registrations = registrations.filter(
        (reg) => reg.madarsa === selectedMahal,
      );
    } else {
      registrations = registrations.filter(registrationsMatchLocation);
    }

    const classes = [
      ...new Set(registrations.map((reg) => reg.classLevel).filter(Boolean)),
    ];

    return classes.sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  };

  // Generate PDF with selected filters
  const handleConfirmGenerateAttendance = async () => {
    try {
      if (!selectedExamForAttendance) return;

      // Use enriched registrations
      let filteredStudents = enrichedRegistrations;

      // Filter by mahal if not "all"
      if (selectedMahal !== "all") {
        filteredStudents = filteredStudents.filter(
          (reg) => reg.madarsa === selectedMahal,
        );
      } else {
        filteredStudents = filteredStudents.filter(registrationsMatchLocation);
      }

      // Filter by class if not "all"
      if (selectedClassFilter !== "all") {
        filteredStudents = filteredStudents.filter(
          (reg) => reg.classLevel === selectedClassFilter,
        );
      }

      if (filteredStudents.length === 0) {
        toast.error("No students found with the selected filters");
        return;
      }

      // Generate PDF with filters
      const doc = await generateAttendanceSheet(
        selectedExamForAttendance,
        filteredStudents,
        selectedClassFilter === "all" ? null : selectedClassFilter,
        selectedMahal === "all" ? null : selectedMahal,
        null,
      );

      // Download PDF
      const mahalText =
        selectedMahal === "all"
          ? selectedMekhala !== "all"
            ? selectedMekhala.replace(/\s+/g, "-")
            : selectedDistrict !== "all"
              ? selectedDistrict.replace(/\s+/g, "-")
              : "All"
          : selectedMahal.replace(/\s+/g, "-");
      const classText =
        selectedClassFilter === "all"
          ? "All-Classes"
          : `Class-${selectedClassFilter}`;
      doc.save(
        `${
          selectedExamForAttendance.title || "exam"
        }-${mahalText}-${classText}-attendance.pdf`,
      );

      toast.success("Attendance sheet generated successfully");
      setAttendanceDialogOpen(false);
    } catch (error) {
      console.error("Error generating attendance sheet:", error);
      toast.error("Failed to generate attendance sheet");
    }
  };

  // Fetch active exams
  const fetchActiveExams = useCallback(async () => {
    try {
      const constraints = [orderBy("examDate", "asc")];
      const fetchedExams = await getDocuments(COLLECTIONS.EXAMS, constraints);

      // Filter only active exams
      const activeExams = fetchedExams.filter((exam) => exam.isActive === true);
      setExams(activeExams);
      setFilteredExams(activeExams);
    } catch (error) {
      console.error("Error fetching active exams:", error);
      setError("Failed to fetch active exams");
    }
  }, []);

  // Fetch exam registrations
  const fetchExamRegistrations = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      const fetchedRegistrations = await getDocuments(
        COLLECTIONS.EXAM_REGISTRATIONS,
        constraints,
      );
      setExamRegistrations(fetchedRegistrations);
    } catch (error) {
      console.error("Error fetching exam registrations:", error);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchActiveExams(), fetchExamRegistrations()]);
      setLoading(false);
    };

    fetchData();
  }, [fetchActiveExams, fetchExamRegistrations]);

  // Filter exams
  useEffect(() => {
    let filtered = exams;

    // Search by title, subject, or description
    if (searchTerm) {
      filtered = filtered.filter(
        (exam) =>
          exam.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exam.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exam.description?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by class
    if (selectedClass !== "all") {
      filtered = filtered.filter((exam) => exam.class === selectedClass);
    }

    setFilteredExams(filtered);
    setCurrentPage(1); // Reset to page 1 when filters change
  }, [exams, searchTerm, selectedClass]);

  // Get unique classes for filter
  const uniqueClasses = [
    ...new Set(exams.map((exam) => exam.class).filter(Boolean)),
  ].sort();

  // Handle exam click - navigate to students page with exam filter
  const handleExamClick = (examId) => {
    // Navigate to students page with exam filter
    router.push(`/dashboard/pariksha-board-convener/students?exam=${examId}`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading active exams...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">Active Exams</h1>
          <p className="text-teal-100">
            View all currently active examinations and manage student
            registrations
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Filter Exams</CardTitle>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 mr-2">View:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <Button
                  variant={viewMode === "card" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("card")}
                  className={`px-3 py-1 ${
                    viewMode === "card"
                      ? "bg-teal-600 text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Grid3X3 className="h-4 w-4 mr-1" />
                  Cards
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-1 ${
                    viewMode === "table"
                      ? "bg-teal-600 text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Table className="h-4 w-4 mr-1" />
                  Table
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Exams
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by title, subject, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="all">All Classes</option>
                  {uniqueClasses.map((classLevel) => (
                    <option key={classLevel} value={classLevel}>
                      Class {classLevel}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exam Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <BookOpen className="h-8 w-8 text-teal-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Active Exams</p>
                  <p className="text-2xl font-bold">{filteredExams.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Users className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Classes Covered</p>
                  <p className="text-2xl font-bold">{uniqueClasses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <DollarSign className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Exam Fees</p>
                  <p className="text-2xl font-bold">
                    ₹
                    {filteredExams.reduce(
                      (sum, exam) => sum + (exam.fees || 0),
                      0,
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Exams Display */}
        {viewMode === "card" ? (
          /* Card View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((exam) => (
                <Card
                  key={exam.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-teal-500"
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg leading-tight">
                        {exam.title}
                      </CardTitle>
                      <Badge variant="secondary" className="ml-2">
                        Class {exam.class}
                      </Badge>
                    </div>
                    <CardDescription className="text-sm">
                      {exam.subject}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">
                          {formatDate(exam.examDate, true)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">{exam.duration}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">₹{exam.fees}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <BookOpen className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">
                          {exam.totalMarks} marks
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 col-span-2">
                        <UsersIcon className="h-4 w-4 text-teal-500" />
                        <span className="text-gray-600 font-medium">
                          {
                            examRegistrations.filter(
                              (reg) => reg.examId === exam.id,
                            ).length
                          }{" "}
                          students registered
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <p className="text-xs text-gray-500 mb-2">
                        Registration Deadline:{" "}
                        {formatDate(exam.registrationDeadline)}
                      </p>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateAttendanceSheet(exam)}
                        className="text-green-600 hover:text-green-700 w-full"
                        title="Generate Attendance Sheet"
                      >
                        <ClipboardList className="h-4 w-4" />
                        Attendance Sheet
                      </Button>

                      {(exam.generatedTimetableImage ||
                        exam.uploadedTimetableImage) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              exam.generatedTimetableImage ||
                                exam.uploadedTimetableImage,
                              "_blank",
                            );
                          }}
                          className="text-blue-600 hover:text-blue-700 w-full mt-2"
                          title="View Timetable"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Timetable
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/pariksha-board-convener/exams/${exam.id}/unregistered`);
                        }}
                        className="text-orange-600 hover:text-orange-700 w-full mt-2"
                        title="View Unregistered Students"
                      >
                        <UserX className="h-4 w-4 mr-2" />
                        Unregistered
                      </Button>

                      <Button
                        className="w-full bg-teal-600 mt-2 hover:bg-teal-700"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExamClick(exam.id);
                        }}
                      >
                        <UsersIcon className="h-4 w-4 mr-2" />
                        View Students
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/pariksha-board-convener/unpublished?exam=${exam.id}`);
                        }}
                        className="text-orange-600 hover:text-orange-700 w-full mt-2"
                        title="View Unpublished Results"
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        Unpublished Results
                      </Button>

                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/pariksha-board-convener/results/${exam.id}/view`);
                          }}
                          className="text-teal-600 hover:text-teal-700 w-full"
                          title="View Results"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Result
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/pariksha-board-convener/results/${exam.id}`);
                          }}
                          className="text-purple-600 hover:text-purple-700 w-full"
                          title="Upload Result"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Result
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        ) : (
          /* Table View */
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Exam Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Class
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fees
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Marks
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Registered
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredExams
                      .slice(
                        (currentPage - 1) * pageSize,
                        currentPage * pageSize,
                      )
                      .map((exam) => (
                        <tr key={exam.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {exam.title}
                              </div>
                              <div className="text-sm text-gray-500">
                                {exam.subject}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                Deadline:{" "}
                                {formatDate(exam.registrationDeadline)}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="secondary">
                              Class {exam.class}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(exam.examDate, true)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {exam.duration}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ₹{exam.fees}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {exam.totalMarks}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <UsersIcon className="h-4 w-4 text-teal-500" />
                              <span className="text-sm font-medium text-gray-900">
                                {
                                  examRegistrations.filter(
                                    (reg) => reg.examId === exam.id,
                                  ).length
                                }
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleGenerateAttendanceSheet(exam)
                                }
                                className="text-green-600 hover:text-green-700 w-full"
                                title="Generate Attendance Sheet"
                              >
                                <ClipboardList className="h-4 w-4 mr-2" />
                                Attendance Sheet
                              </Button>

                              {(exam.generatedTimetableImage ||
                                exam.uploadedTimetableImage) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(
                                      exam.generatedTimetableImage ||
                                        exam.uploadedTimetableImage,
                                      "_blank",
                                    );
                                  }}
                                  className="text-blue-600 hover:text-blue-700 w-full"
                                  title="View Timetable"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Timetable
                                </Button>
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/dashboard/pariksha-board-convener/exams/${exam.id}/unregistered`);
                                }}
                                className="text-orange-600 hover:text-orange-700 w-full"
                                title="View Unregistered Students"
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Unregistered
                              </Button>

                              <Button
                                className="bg-teal-600 hover:bg-teal-700 w-full"
                                size="sm"
                                onClick={() => handleExamClick(exam.id)}
                              >
                                <UsersIcon className="h-4 w-4 mr-2" />
                                View Students
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/dashboard/pariksha-board-convener/unpublished?exam=${exam.id}`);
                                }}
                                className="text-orange-600 hover:text-orange-700 w-full"
                                title="View Unpublished Results"
                              >
                                <Globe className="h-4 w-4 mr-2" />
                                Unpublished Results
                              </Button>

                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/dashboard/pariksha-board-convener/results/${exam.id}/view`);
                                  }}
                                  className="text-teal-600 hover:text-teal-700 w-full"
                                  title="View Results"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Result
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/dashboard/pariksha-board-convener/results/${exam.id}`);
                                  }}
                                  className="text-purple-600 hover:text-purple-700 w-full"
                                  title="Upload Result"
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload Result
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {filteredExams.length > pageSize && (
          <div className="flex justify-center">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredExams.length / pageSize)}
              onPageChange={setCurrentPage}
              totalItems={filteredExams.length}
              itemsPerPage={pageSize}
            />
          </div>
        )}

        {filteredExams.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Active Exams Found
              </h3>
              <p className="text-gray-500">
                {searchTerm || selectedClass !== "all"
                  ? "Try adjusting your filters to see more exams."
                  : "There are currently no active examinations scheduled."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Attendance Sheet Selection Dialog */}
        <Dialog
          open={attendanceDialogOpen}
          onOpenChange={setAttendanceDialogOpen}
        >
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                Generate Attendance Sheet
              </DialogTitle>
              <DialogDescription>
                Select madrasa and class for the attendance sheet
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* District Selection */}
              <div className="space-y-2">
                <Label htmlFor="district-select">District</Label>
                <select
                  id="district-select"
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value);
                    setSelectedMekhala("all");
                    setSelectedMahal("all");
                    setSelectedClassFilter("all");
                    setMadrasaSearch("");
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
                >
                  <option value="all">All Districts</option>
                  {availableDistricts.map((d) => (
                    <option key={d} value={d}>
                      {String(d).toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mekhala Selection */}
              <div className="space-y-2">
                <Label htmlFor="mekhala-select">Mekhala</Label>
                <select
                  id="mekhala-select"
                  value={selectedMekhala}
                  disabled={selectedDistrict === "all"}
                  onChange={(e) => {
                    setSelectedMekhala(e.target.value);
                    setSelectedMahal("all");
                    setSelectedClassFilter("all");
                    setMadrasaSearch("");
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm disabled:opacity-50"
                >
                  <option value="all">All Mekhalas</option>
                  {availableMekhalas.map((m) => (
                    <option key={m} value={m}>
                      {String(m).toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Madrasa Selection — custom searchable inline picker */}
              <div className="space-y-2">
                <Label htmlFor="madrasa-search">Madrasa</Label>
                {/* Search input */}
                <input
                  id="madrasa-search"
                  type="text"
                  placeholder="Search by name or number..."
                  value={madrasaSearch}
                  onChange={(e) => setMadrasaSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
                />
                {/* Scrollable list */}
                <div className="border border-gray-200 rounded-md overflow-y-auto max-h-44 bg-white">
                  {/* "All Madrasas" option */}
                  <div
                    onClick={() => {
                      setSelectedMahal("all");
                      setSelectedClassFilter("all");
                      setMadrasaSearch("");
                    }}
                    className={`px-3 py-2 cursor-pointer text-sm hover:bg-blue-50 ${
                      selectedMahal === "all"
                        ? "bg-blue-100 font-semibold text-blue-800"
                        : "text-gray-700"
                    }`}
                  >
                    All Madrasas
                  </div>
                  {/* Filtered madrasa options */}
                  {getUniqueMadrasas()
                    .filter(({ label }) =>
                      madrasaSearch.trim() === ""
                        ? true
                        : label
                            .toLowerCase()
                            .includes(madrasaSearch.trim().toLowerCase()),
                    )
                    .map(({ value, label }) => (
                      <div
                        key={value}
                        onClick={() => {
                          setSelectedMahal(value);
                          setSelectedClassFilter("all");
                          setMadrasaSearch("");
                        }}
                        className={`px-3 py-2 cursor-pointer text-sm hover:bg-blue-50 ${
                          selectedMahal === value
                            ? "bg-blue-100 font-semibold text-blue-800"
                            : "text-gray-700"
                        }`}
                      >
                        {String(label).toUpperCase()}
                      </div>
                    ))}
                  {/* No results */}
                  {madrasaSearch.trim() !== "" &&
                    getUniqueMadrasas().filter(({ label }) =>
                      label
                        .toLowerCase()
                        .includes(madrasaSearch.trim().toLowerCase()),
                    ).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-400 italic">
                        No madrasas found
                      </div>
                    )}
                </div>
              </div>

              {/* Class Selection */}
              <div className="space-y-2">
                <Label htmlFor="class-select">Class</Label>
                <select
                  id="class-select"
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
                >
                  <option value="all">All Classes</option>
                  {getUniqueClasses().map((cls) => (
                    <option key={cls} value={cls}>
                      Class {cls}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Filters Info */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
                <p className="font-medium text-blue-900">Selection Summary:</p>
                <p className="text-blue-700">
                  District:{" "}
                  <span className="font-semibold">
                    {selectedDistrict === "all"
                      ? "All Districts"
                      : selectedDistrict}
                  </span>
                </p>
                <p className="text-blue-700">
                  Mekhala:{" "}
                  <span className="font-semibold">
                    {selectedMekhala === "all"
                      ? "All Mekhalas"
                      : selectedMekhala}
                  </span>
                </p>
                <p className="text-blue-700">
                  Madrasa:{" "}
                  <span className="font-semibold">
                    {selectedMahal === "all"
                      ? "All Madrasas"
                      : (() => {
                          const info = madrasaMap.get(selectedMahal);
                          return info?.madarsaId
                            ? `${info.madarsaId} - ${selectedMahal}`
                            : selectedMahal;
                        })()}
                  </span>
                </p>
                <p className="text-blue-700">
                  Class:{" "}
                  <span className="font-semibold">
                    {selectedClassFilter === "all"
                      ? "All Classes"
                      : `Class ${selectedClassFilter}`}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setAttendanceDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmGenerateAttendance}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Generate PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
