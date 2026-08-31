"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  BookOpen,
  Search,
  Eye,
  AlertCircle,
  FileText,
  Award,
} from "lucide-react";
import {
  getDocuments,
  getPaginatedDocuments,
  COLLECTIONS,
} from "@/lib/firestoreService";
import {
  where,
  orderBy,
  doc,
  getDoc,
  limit,
  startAfter,
} from "firebase/firestore";
import useAuthStore from "@/lib/authStore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { generateAttendanceSheet } from "@/lib/pdfUtils";

// Helper function to format dates
const formatDate = (dateValue) => {
  if (!dateValue) return "Not available";
  // Handle Firestore Timestamp
  if (dateValue?.toDate)
    return dateValue.toDate().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  // Handle string or Date object
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Helper function to format time
const formatTime = (dateValue) => {
  if (!dateValue) return "Not available";
  // Handle Firestore Timestamp
  if (dateValue?.toDate)
    return dateValue
      .toDate()
      .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  // Handle string (ISO) or Date object
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function MadarsaExamsPage() {
  const { user, role } = useAuth();
  const { userData } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data States
  const [allExams, setAllExams] = useState([]);
  const [filteredExams, setFilteredExams] = useState([]);
  const [examRegistrations, setExamRegistrations] = useState([]);

  // UI States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExam, setSelectedExam] = useState(null);
  const [showExamDetails, setShowExamDetails] = useState(false);

  // Attendance Sheet Dialog States
  const [hazarDialogOpen, setHazarDialogOpen] = useState(false);
  const [selectedExamForHazar, setSelectedExamForHazar] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState("ml");
  const [selectedClasses, setSelectedClasses] = useState(["all"]);
  const [enrichedRegistrations, setEnrichedRegistrations] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [docHistory, setDocHistory] = useState([null]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [pageSize] = useState(6);
  const [settings, setSettings] = useState({
    showResults: true,
    resultWindow: 15,
    revaluationEnabled: false,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);

  const fetchExams = useCallback(
    async (direction = "initial", startAfterDoc = null) => {
      try {
        setLoading(true);
        let currentLastDoc = startAfterDoc;

        const constraints = [];

        const result = await getPaginatedDocuments(
          COLLECTIONS.EXAMS,
          pageSize,
          constraints,
          currentLastDoc,
        );

        setAllExams(result.data);
        setFilteredExams(result.data);
        setLastDoc(result.lastDoc);

        if (direction === "next") {
          setDocHistory((prev) => [...prev, result.lastDoc]);
          setPage((prev) => prev + 1);
        } else if (direction === "prev") {
          setPage((prev) => prev - 1);
        } else {
          setDocHistory([null, result.lastDoc]);
          setPage(1);
        }

        // Simple hasMore check
        setHasMore(result.data.length === pageSize);
      } catch (error) {
        console.error("Error fetching exams:", error);
        setError("Failed to load exams");
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  const handleNextPage = () => {
    if (hasMore) {
      fetchExams("next", lastDoc);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      const prevDoc = docHistory[page - 3] || null;
      fetchExams("prev", prevDoc);
    }
  };

  const fetchExamRegistrations = useCallback(async () => {
    try {
      const registrations = await getDocuments(COLLECTIONS.EXAM_REGISTRATIONS);
      setExamRegistrations(registrations);
    } catch (error) {
      console.error("Error fetching exam registrations:", error);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const settingsDoc = await getDoc(doc(db, "settings", "general"));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setSettings({
          showResults: data.showResults ?? true,
          resultWindow: data.resultWindow || 15,
          revaluationEnabled: data.revaluationEnabled ?? false,
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchExams(),
          fetchExamRegistrations(),
          fetchSettings(),
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load exam data");
      } finally {
        setLoading(false);
      }
    };

    if (user || userData) {
      fetchData();
    }
  }, [user, userData, fetchExams, fetchExamRegistrations, fetchSettings]);

  // Filter exams based on search query and revaluation enabled toggle
  useEffect(() => {
    let filtered = allExams;
    if (!settings.revaluationEnabled) {
      filtered = filtered.filter(
        (exam) => (exam.examType || "PUBLIC").toUpperCase() !== "REVALUATION"
      );
    }
    
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (exam) =>
          exam.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          exam.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          exam.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          exam.class?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    setFilteredExams(filtered);
  }, [searchQuery, allExams, settings.revaluationEnabled]);

  // Generate Attendance Sheet PDF for an exam
  const handleGenerateHazarSheet = async (exam) => {
    try {
      // Fetch registered students for this exam
      const registeredStudents = examRegistrations.filter(
        (reg) => reg.examId === exam.id,
      );

      if (registeredStudents.length === 0) {
        toast.error("No students registered for this exam");
        return;
      }

      // Get madarsa name for display
      const madarsaName =
        userData?.madarsa || userData?.madarsaName || userData?.madrasaName;

      // Get madarsa ID for filtering (assuming userData.id or userData.uid is the madarsa document ID)
      const madarsaId = userData?.madarsaId || userData?.uid || userData?.id;
      console.log("Madarsa ID:", madarsaId);

      if (!madarsaId) {
        console.log("UserData:", userData);
        toast.error(
          "Unable to determine your madarsa ID. Please contact administrator.",
        );
        return;
      }

      // Filter by madarsa ID
      const filteredByMadarsa = registeredStudents.filter((reg) => {
        return reg.madarsaId === madarsaId;
      });

      if (filteredByMadarsa.length === 0) {
        toast.error(
          `No students from this madarsa (${
            madarsaName || madarsaId
          }) registered for this exam`,
        );
        return;
      }

      // Fetch student details to get class information
      toast.loading("Loading student data...");
      const studentIds = [
        ...new Set(filteredByMadarsa.map((reg) => reg.studentId)),
      ];

      // Fetch students in batches
      const studentMap = {};
      const batchSize = 30;

      for (let i = 0; i < studentIds.length; i += batchSize) {
        const batch = studentIds.slice(i, i + batchSize);
        const batchStudents = await getDocuments(COLLECTIONS.STUDENTS, [
          where("uid", "in", batch),
        ]);
        batchStudents.forEach((student) => {
          studentMap[student.uid] = student;
        });
      }

      // Enrich registrations with student class data
      const enriched = filteredByMadarsa.map((reg) => ({
        ...reg,
        classLevel: studentMap[reg.studentId]?.classLevel || null,
        fullName: studentMap[reg.studentId]?.fullName || reg.studentName,
      }));

      setEnrichedRegistrations(enriched);
      toast.dismiss();

      // Get all available classes
      const allClasses = [
        ...new Set(enriched.map((reg) => reg.classLevel).filter(Boolean)),
      ].sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      });

      // Open dialog for filters selection
      setSelectedExamForHazar(exam);
      setSelectedLanguage("ml");
      setSelectedClasses(["all", ...allClasses]);
      setHazarDialogOpen(true);
    } catch (error) {
      console.error("Error generating Attendanceance sheet:", error);
      toast.dismiss();
      toast.error("Failed to generate Attendance sheet");
    }
  };

  // Get unique classes from enriched registrations
  const getUniqueClasses = () => {
    if (enrichedRegistrations.length === 0) return [];
    const classes = [
      ...new Set(
        enrichedRegistrations.map((reg) => reg.classLevel).filter(Boolean),
      ),
    ];
    return classes.sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  };

  // Handle class selection
  const handleClassSelection = (classValue) => {
    const currentClasses = selectedClasses;
    const allClasses = getUniqueClasses();

    if (classValue === "all") {
      if (currentClasses.includes("all")) {
        setSelectedClasses([]);
      } else {
        setSelectedClasses(["all", ...allClasses]);
      }
    } else {
      let newClasses = currentClasses.filter((c) => c !== "all");

      if (newClasses.includes(classValue)) {
        newClasses = newClasses.filter((c) => c !== classValue);
      } else {
        newClasses = [...newClasses, classValue];
      }

      if (
        newClasses.length === allClasses.length &&
        allClasses.every((c) => newClasses.includes(c))
      ) {
        setSelectedClasses(["all", ...newClasses]);
      } else if (newClasses.length === 0) {
        setSelectedClasses([]);
      } else {
        setSelectedClasses(newClasses);
      }
    }
  };

  // Generate PDF with selected filters
  const handleConfirmGenerateHazar = async () => {
    try {
      if (!selectedExamForHazar) return;

      let filteredStudents = enrichedRegistrations;

      // Filter by classes if not "all"
      if (!selectedClasses.includes("all") && selectedClasses.length > 0) {
        filteredStudents = filteredStudents.filter((reg) =>
          selectedClasses.includes(reg.classLevel),
        );
      }

      if (filteredStudents.length === 0) {
        toast.error("No students found with the selected filters");
        return;
      }

      // Get madarsa name for display
      const madarsaName =
        userData?.madarsa || userData?.madarsaName || userData?.madrasaName;

      // Generate PDF
      const doc = await generateAttendanceSheet(
        selectedExamForHazar,
        filteredStudents,
        selectedClasses.includes("all") ? null : selectedClasses.join(","),
        madarsaName || null,
        null,
        selectedLanguage,
      );

      // Download PDF
      const madarsaText = madarsaName
        ? madarsaName.replace(/\s+/g, "-")
        : "Madarsa";
      const classText = selectedClasses.includes("all")
        ? "All-Classes"
        : `Class-${selectedClasses.join("-")}`;
      const langText = selectedLanguage === "ml" ? "Malayalam" : "English";
      doc.save(
        `${
          selectedExamForHazar.title || "exam"
        }-${madarsaText}-${classText}-${langText}-HazarSheet.pdf`,
      );

      toast.success("Attendance Sheet generated successfully");
      setHazarDialogOpen(false);
    } catch (error) {
      console.error("Error generating Attendance sheet:", error);
      toast.error("Failed to generate Attendance sheet");
    }
  };

  const handleViewExam = (exam) => {
    setSelectedExam(exam);
    setShowExamDetails(true);
  };

  const getRegistrationCount = (examId) => {
    const madarsaId = userData?.madarsaId || userData?.uid || userData?.id;
    if (!madarsaId) return 0;
    return examRegistrations.filter(
      (reg) => reg.examId === examId && reg.madarsaId === madarsaId,
    ).length;
  };

  const getExamStatusBadge = (exam) => {
    const now = new Date();
    const examDate = new Date(exam.examDate);
    const registrationEnd = new Date(exam.registrationDeadline);

    if (now > examDate) {
      return (
        <Badge
          variant="secondary"
          className="bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          Completed
        </Badge>
      );
    } else if (now > registrationEnd) {
      return (
        <Badge
          variant="destructive"
          className="bg-red-100 text-red-600 hover:bg-red-200 border-red-200"
        >
          Registration Closed
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="default"
          className="bg-green-100 text-green-600 hover:bg-green-200 border-green-200"
        >
          Open for Registration
        </Badge>
      );
    }
  };

  const isResultVisible = (exam) => {
    return settings.showResults;
  };

  if (loading) {
    return (
      <Layout user={user} role={role}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin none-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p>Loading exams...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} role={role}>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="bg-teal-600 none-xl p-6 text-white shadow-lg">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            Available Exams
          </h1>
          <p className="text-teal-100">
            View all available exams, schedules, and details
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Search */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search exams by title, subject, class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Exams Grid */}
        {filteredExams.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery ? "No exams found" : "No exams available"}
              </h3>
              <p className="text-gray-500 text-center max-w-md">
                {searchQuery
                  ? "Try adjusting your search terms to find the exam you're looking for."
                  : "There are currently no exams available. Check back later for updates."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.map((exam) => (
              <Card
                key={exam.id}
                className="hover:shadow-xl transition-all duration-300 border-gray-100 overflow-hidden group"
              >
                <div className="h-2 bg-teal-500" />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between mb-2">
                    <Badge
                      variant="outline"
                      className="bg-teal-50 text-teal-700 border-teal-200"
                    >
                      {exam.class || "General"}
                    </Badge>
                    {getExamStatusBadge(exam)}
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-teal-600 transition-colors">
                    {exam.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 mt-1">
                    {exam.description || "No description available"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-3 text-sm">
                    {/* Exam Details */}
                    <div className="flex items-center text-gray-600 bg-gray-50 p-2 none-md">
                      <BookOpen className="h-4 w-4 mr-3 text-teal-500" />
                      <span className="font-medium">
                        {exam.subject || "N/A"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{formatDate(exam.examDate)}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Clock className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{formatTime(exam.examDate)}</span>
                      </div>
                    </div>
                    {exam.fees > 0 && (
                      <div className="flex items-center text-gray-600">
                        <span className="font-medium mr-2">Fee:</span>
                        <span>₹{exam.fees}</span>
                      </div>
                    )}
                    <div className="flex items-center text-gray-600">
                      <Users className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="font-medium mr-1">Registered:</span>
                      <span>{getRegistrationCount(exam.id)}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-4 mt-2 border-t border-gray-100 space-y-2">
                    <Button
                      onClick={() => handleViewExam(exam)}
                      className="w-full bg-white text-teal-600 border border-teal-200 hover:bg-teal-50 hover:border-teal-300 shadow-sm"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <Button
                      onClick={() =>
                        router.push(
                          `/dashboard/madarsa/exam/students?examId=${exam.id}`,
                        )
                      }
                      className="w-full bg-white text-teal-600 border border-teal-200 hover:bg-teal-50 hover:border-teal-300 shadow-sm"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      View Students
                    </Button>
                    <Button
                      onClick={() => handleGenerateHazarSheet(exam)}
                      className="w-full bg-teal-600 !hover:text-white text-white hover:bg-teal-700 shadow-sm"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Download Attendance sheet
                    </Button>
                    {isResultVisible(exam) && (
                      <Button
                        onClick={() =>
                          router.push(
                            `/dashboard/madarsa/exam/exams/results/${exam.id}`,
                          )
                        }
                        className="w-full bg-teal-600 text-white !hover:text-white hover:bg-teal-700 shadow-sm"
                      >
                        <Award className="h-4 w-4 mr-2" />
                        View Results
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {!searchQuery && filteredExams.length > 0 && (
          <div className="flex items-center justify-between mt-8 p-4 bg-white border border-gray-100 none-xl shadow-sm">
            <div className="text-sm text-gray-500">
              Page <span className="font-medium">{page}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={page === 1 || loading}
                className="border-gray-200"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasMore || loading}
                className="border-gray-200"
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Exam Details Dialog */}
        <Dialog open={showExamDetails} onOpenChange={setShowExamDetails}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-200">
                  {selectedExam?.class}
                </Badge>
                {selectedExam && getExamStatusBadge(selectedExam)}
              </div>
              <DialogTitle className="text-2xl font-bold text-gray-900">
                {selectedExam?.title}
              </DialogTitle>
              <DialogDescription className="text-base">
                {selectedExam?.description}
              </DialogDescription>
            </DialogHeader>

            {selectedExam && (
              <div className="space-y-6 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-teal-500" />
                      Exam Details
                    </h4>
                    <div className="bg-gray-50 none-lg p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Subject</span>
                        <span className="font-medium text-gray-900">
                          {selectedExam.subject}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Date</span>
                        <span className="font-medium text-gray-900">
                          {formatDate(selectedExam.examDate)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Time</span>
                        <span className="font-medium text-gray-900">
                          {formatTime(selectedExam.examDate)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Duration</span>
                        <span className="font-medium text-gray-900">
                          {selectedExam.duration}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Marks</span>
                        <span className="font-medium text-gray-900">
                          {selectedExam.totalMarks}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Registration Information */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Users className="h-4 w-4 text-teal-500" />
                      Registration
                    </h4>
                    <div className="bg-teal-50 none-lg p-4 space-y-3 border border-teal-100">
                      <div className="flex justify-between">
                        <span className="text-teal-700">Deadline</span>
                        <span className="font-medium text-teal-900">
                          {formatDate(selectedExam.registrationDeadline)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-teal-700">Fee</span>
                        <span className="font-medium text-teal-900">
                          {selectedExam.fees > 0
                            ? `₹${selectedExam.fees}`
                            : "Free"}
                        </span>
                      </div>
                      <div className="pt-2">
                        <Badge
                          variant={
                            selectedExam.isActive ? "default" : "secondary"
                          }
                          className="w-full justify-center"
                        >
                          {selectedExam.isActive ? "Active Exam" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rules */}
                {selectedExam.rulesAndRegulations && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-900">
                      Rules & Regulations
                    </h4>
                    <div className="bg-gray-50 p-4 none-lg border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedExam.rulesAndRegulations}
                    </div>
                  </div>
                )}

                {/* Notice */}
                {selectedExam.notice && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-900">
                      Important Notice
                    </h4>
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800">
                        {selectedExam.notice}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {/* Timetables */}
                {(selectedExam.generatedTimetableImage ||
                  selectedExam.uploadedTimetableImage ||
                  (selectedExam.timetableEntries &&
                    selectedExam.timetableEntries.length > 0)) && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-teal-500" />
                      Timetables
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedExam.generatedTimetableImage && (
                        <div className="border none-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                          <p className="text-sm font-medium mb-2 text-gray-900">
                            Generated Timetable
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200"
                            onClick={() =>
                              window.open(
                                selectedExam.generatedTimetableImage,
                                "_blank",
                              )
                            }
                          >
                            <Eye className="h-3 w-3 mr-2" />
                            View Timetable
                          </Button>
                        </div>
                      )}

                      {selectedExam.uploadedTimetableImage && (
                        <div className="border none-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                          <p className="text-sm font-medium mb-2 text-gray-900">
                            Uploaded Schedule
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200"
                            onClick={() =>
                              window.open(
                                selectedExam.uploadedTimetableImage,
                                "_blank",
                              )
                            }
                          >
                            <Eye className="h-3 w-3 mr-2" />
                            View File
                          </Button>
                        </div>
                      )}

                      {selectedExam.timetableEntries?.map((entry, index) => (
                        <div
                          key={index}
                          className="border none-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="mb-2">
                            <p className="text-sm font-medium text-gray-900">
                              {entry.timetableTitle ||
                                entry.subject ||
                                `Timetable ${index + 1}`}
                            </p>
                            {entry.date && (
                              <p className="text-xs text-gray-500">
                                {formatDate(entry.date)}
                              </p>
                            )}
                          </div>
                          {entry.timetableImage && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200"
                              onClick={() =>
                                window.open(entry.timetableImage, "_blank")
                              }
                            >
                              <Eye className="h-3 w-3 mr-2" />
                              View Timetable
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Attendance Sheet Dialog */}
        <Dialog open={hazarDialogOpen} onOpenChange={setHazarDialogOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-900">
                Generate Attendance Sheet
              </DialogTitle>
              <DialogDescription>
                {selectedExamForHazar?.title}
                {userData?.madarsa && (
                  <div className="mt-2 p-2 bg-teal-50 none-md border border-teal-200">
                    <p className="text-sm text-teal-800">
                      <span className="font-semibold">Madarsa:</span>{" "}
                      {userData.madarsa}
                    </p>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* Language Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Language
                </label>
                <Select
                  value={selectedLanguage}
                  onValueChange={setSelectedLanguage}
                >
                  <SelectTrigger className="border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ml">Malayalam</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Class Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Select Classes
                </label>
                <div className="border border-gray-200 none-md p-3 max-h-48 overflow-y-auto bg-gray-50">
                  {/* All Classes Checkbox */}
                  <div className="flex items-center space-x-2 mb-2 pb-2 border-b border-gray-200">
                    <Checkbox
                      id="class-all"
                      checked={selectedClasses.includes("all")}
                      onCheckedChange={() => handleClassSelection("all")}
                    />
                    <label
                      htmlFor="class-all"
                      className="text-sm font-semibold cursor-pointer text-teal-700"
                    >
                      All Classes
                    </label>
                  </div>

                  {/* Individual Classes */}
                  <div className="space-y-2">
                    {getUniqueClasses().map((classLevel) => (
                      <div
                        key={classLevel}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`class-${classLevel}`}
                          checked={
                            selectedClasses.includes(classLevel) ||
                            selectedClasses.includes("all")
                          }
                          onCheckedChange={() =>
                            handleClassSelection(classLevel)
                          }
                        />
                        <label
                          htmlFor={`class-${classLevel}`}
                          className="text-sm cursor-pointer text-gray-700"
                        >
                          Class {classLevel}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedClasses.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedClasses.includes("all")
                      ? `All classes selected (${
                          getUniqueClasses().length
                        } classes)`
                      : `${selectedClasses.length} class(es) selected`}
                  </p>
                )}
              </div>

              {/* Generate Button */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setHazarDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmGenerateHazar}
                  disabled={selectedClasses.length === 0}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Generate PDF
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
