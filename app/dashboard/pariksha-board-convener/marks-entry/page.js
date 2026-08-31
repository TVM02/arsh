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
import { Pagination } from "@/components/ui/pagination";
import { toast } from "sonner";
import {
  Users,
  Save,
  User,
  BookOpen,
  School,
  Phone,
  Mail,
  Plus,
  Minus,
  FileText,
  Eye,
  Edit,
  Trash2,
  Download,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import {
  getDocuments,
  createDocument,
  updateDocument,
  COLLECTIONS,
} from "@/lib/firestoreService";
import { orderBy, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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

// Local storage keys
const MARKS_TEMPLATE_KEY = "marksEntryTemplate";
const DRAFT_MARKS_KEY = "draftMarks";

export default function MarksEntry() {
  const { user, role, loading: authLoading } = useAuth();
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data States
  const [examRegistrations, setExamRegistrations] = useState([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState([]);
  const [studentDetails, setStudentDetails] = useState({});
  const [exams, setExams] = useState([]);
  const [madrasas, setMadrasas] = useState([]);
  const [existingMarks, setExistingMarks] = useState({});

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExam, setSelectedExam] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedMadrasa, setSelectedMadrasa] = useState("all");
  const [marksStatus, setMarksStatus] = useState("all"); // all, entered, pending, draft

  // Marks Entry States
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [marks, setMarks] = useState({});
  const [remarks, setRemarks] = useState("");
  const [showMarksDialog, setShowMarksDialog] = useState(false);
  const [editingMarks, setEditingMarks] = useState(null);

  // View Marks Dialog
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingMarks, setViewingMarks] = useState(null);

  // Template Management
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectMaxMarks, setNewSubjectMaxMarks] = useState("100");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Load saved templates and drafts from localStorage
  useEffect(() => {
    const templates = localStorage.getItem(MARKS_TEMPLATE_KEY);
    if (templates) {
      try {
        setSavedTemplates(JSON.parse(templates));
      } catch (error) {
        console.error("Error loading templates:", error);
      }
    }
  }, []);

  // Fetch all exam registrations
  const fetchExamRegistrations = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      const fetchedRegistrations = await getDocuments(
        COLLECTIONS.EXAM_REGISTRATIONS,
        constraints,
      );

      // Filter for completed payments only
      const paidRegistrations = fetchedRegistrations.filter(
        (registration) => registration.paymentStatus === "completed",
      );

      setExamRegistrations(paidRegistrations);
      setFilteredRegistrations(paidRegistrations);

      // Fetch student details for each registration
      const studentIds = [
        ...new Set(paidRegistrations.map((r) => r.studentId)),
      ];
      const studentDetailsMap = {};

      for (const studentId of studentIds) {
        if (studentId) {
          try {
            const studentQuery = query(
              collection(db, "students"),
              where("uid", "==", studentId),
            );
            const studentSnapshot = await getDocs(studentQuery);

            if (!studentSnapshot.empty) {
              studentDetailsMap[studentId] = studentSnapshot.docs[0].data();
            }
          } catch (error) {
            console.error(`Error fetching student ${studentId}:`, error);
          }
        }
      }

      setStudentDetails(studentDetailsMap);
    } catch (error) {
      console.error("Error fetching exam registrations:", error);
      toast.error("Failed to fetch registrations");
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
      const madrasaQuery = query(collection(db, "madarsas"));
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

  // Fetch existing marks
  const fetchExistingMarks = useCallback(async () => {
    try {
      const marksQuery = query(collection(db, COLLECTIONS.EXAM_MARKS));
      const marksSnapshot = await getDocs(marksQuery);
      const marksMap = {};

      marksSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const key = `${data.studentId}_${data.examId}`;
        marksMap[key] = { id: doc.id, ...data };
      });

      setExistingMarks(marksMap);
    } catch (error) {
      console.error("Error fetching existing marks:", error);
    }
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      // console.log("userData", userData, user);
      if (!user) {
        toast.error("You must be logged in to access this page");
        setLoading(false);
        return;
      }

      setLoading(true);
      await Promise.all([
        fetchExamRegistrations(),
        fetchExams(),
        fetchMadrasas(),
        fetchExistingMarks(),
      ]);
      setLoading(false);
    };

    fetchAllData();
  }, [
    user,
    fetchExamRegistrations,
    fetchExams,
    fetchMadrasas,
    fetchExistingMarks,
  ]);

  // Filter registrations
  useEffect(() => {
    let filtered = examRegistrations;

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

    // Marks status filter
    if (marksStatus !== "all") {
      filtered = filtered.filter((registration) => {
        const key = `${registration.studentId}_${registration.examId}`;
        const existingMark = existingMarks[key];

        if (marksStatus === "entered") {
          return existingMark && existingMark.status === "saved";
        } else if (marksStatus === "draft") {
          return existingMark && existingMark.status === "draft";
        } else if (marksStatus === "pending") {
          return !existingMark;
        }
        return true;
      });
    }

    setFilteredRegistrations(filtered);
  }, [
    examRegistrations,
    studentDetails,
    searchTerm,
    selectedExam,
    selectedClass,
    selectedMadrasa,
    marksStatus,
    existingMarks,
  ]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedExam, selectedClass, selectedMadrasa, marksStatus]);

  // Template Management Functions
  const saveTemplate = () => {
    if (subjects.length === 0) {
      toast.error("Please add subjects first");
      return;
    }

    const templateName = prompt("Enter template name:");
    if (templateName) {
      const newTemplate = {
        id: Date.now().toString(),
        name: templateName,
        subjects: subjects.map((subject) => ({
          name: subject.name,
          maxMarks: subject.maxMarks,
        })),
        createdAt: new Date().toISOString(),
      };

      const updatedTemplates = [...savedTemplates, newTemplate];
      setSavedTemplates(updatedTemplates);
      localStorage.setItem(
        MARKS_TEMPLATE_KEY,
        JSON.stringify(updatedTemplates),
      );
      toast.success("Template saved successfully!");
    }
  };

  const loadTemplate = (template) => {
    setSubjects(
      template.subjects.map((subject, index) => ({
        id: index + 1,
        name: subject.name,
        maxMarks: subject.maxMarks,
      })),
    );

    // Reset marks for new subjects
    const newMarks = {};
    template.subjects.forEach((subject, index) => {
      newMarks[index + 1] = "";
    });
    setMarks(newMarks);
    setShowTemplateDialog(false);
    toast.success(`Template "${template.name}" loaded successfully!`);
  };

  const deleteTemplate = (templateId) => {
    if (confirm("Are you sure you want to delete this template?")) {
      const updatedTemplates = savedTemplates.filter(
        (t) => t.id !== templateId,
      );
      setSavedTemplates(updatedTemplates);
      localStorage.setItem(
        MARKS_TEMPLATE_KEY,
        JSON.stringify(updatedTemplates),
      );
    }
  };

  // Subject Management Functions
  const addSubject = () => {
    if (!newSubjectName.trim()) {
      toast.error("Please enter subject name");
      return;
    }

    const newSubject = {
      id: subjects.length + 1,
      name: newSubjectName.trim(),
      maxMarks: parseInt(newSubjectMaxMarks) || 100,
    };

    setSubjects([...subjects, newSubject]);
    setMarks((prev) => ({ ...prev, [newSubject.id]: "" }));
    setNewSubjectName("");
    setNewSubjectMaxMarks("100");
  };

  const removeSubject = (subjectId) => {
    setSubjects(subjects.filter((s) => s.id !== subjectId));
    setMarks((prev) => {
      const newMarks = { ...prev };
      delete newMarks[subjectId];
      return newMarks;
    });
  };

  // Marks Entry Functions
  const openMarksEntry = (registration) => {
    setSelectedStudent(registration);
    setShowMarksDialog(true);

    // Load existing marks if available
    const key = `${registration.studentId}_${registration.examId}`;
    const existingMark = existingMarks[key];

    if (existingMark) {
      setSubjects(existingMark.subjects || []);
      setMarks(existingMark.marks || {});
      setRemarks(existingMark.remarks || "");
      setEditingMarks(existingMark);
    } else {
      // Load from draft if available
      const draftKey = `${registration.studentId}_${registration.examId}`;
      const draft = localStorage.getItem(`${DRAFT_MARKS_KEY}_${draftKey}`);

      if (draft) {
        try {
          const draftData = JSON.parse(draft);
          setSubjects(draftData.subjects || []);
          setMarks(draftData.marks || {});
          setRemarks(draftData.remarks || "");
        } catch (error) {
          console.error("Error loading draft:", error);
        }
      } else {
        // Reset to empty state
        setSubjects([]);
        setMarks({});
        setRemarks("");
      }
      setEditingMarks(null);
    }
  };

  // View Marks Function
  const openViewMarks = (registration) => {
    const key = `${registration.studentId}_${registration.examId}`;
    const existingMark = existingMarks[key];

    if (existingMark) {
      setViewingMarks({
        student: registration,
        marks: existingMark,
        studentDetails: studentDetails[registration.studentId],
        exam: exams.find((e) => e.id === registration.examId),
      });
      setShowViewDialog(true);
    } else {
      toast.error("No marks found for this student");
    }
  };

  const saveDraft = () => {
    if (!selectedStudent) return;

    const draftKey = `${selectedStudent.studentId}_${selectedStudent.examId}`;
    const draftData = {
      subjects,
      marks,
      remarks,
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(
      `${DRAFT_MARKS_KEY}_${draftKey}`,
      JSON.stringify(draftData),
    );
    toast.success("Draft saved successfully!");
  };

  const saveMarks = async (asDraft = false) => {
    if (!selectedStudent || subjects.length === 0) {
      toast.error("Please add subjects and marks");
      return;
    }

    // Check authentication from userData
    if (!user) {
      toast.error("You must be logged in to save marks");
      return;
    }

    // Validate marks
    const invalidMarks = subjects.some((subject) => {
      const mark = parseInt(marks[subject.id]);
      return isNaN(mark) || mark < 0 || mark > subject.maxMarks;
    });

    if (invalidMarks) {
      toast.error("Please enter valid marks for all subjects");
      return;
    }

    // console.log("Current userData:", userData); // Debug log
    // console.log("User ID:", userData?.uid || userData?.id); // Debug log
    // console.log("User email:", userData?.email); // Debug log
    // console.log("User name:", userData?.name); // Debug log
    // console.log("Firebase user object:", user); // Debug log

    // Check Firebase authentication state
    if (user) {
      try {
        const token = await user.getIdToken(true); // Force refresh token
        console.log("Auth token exists:", !!token); // Debug log
        console.log("Token length:", token?.length); // Debug log

        // Verify the token contains proper claims
        const idTokenResult = await user.getIdTokenResult(true); // Force refresh to ensure latest claims
        console.log("Token claims:", idTokenResult.claims); // Debug log
        console.log("Auth time:", idTokenResult.authTime); // Debug log
        console.log("Sign in provider:", idTokenResult.signInProvider); // Debug log
      } catch (error) {
        console.error("Error getting auth token:", error);
        toast.error(
          "Authentication error. Please try logging out and logging back in.",
        );
        return;
      }
    } else {
      console.warn("No Firebase user object available"); // Debug log
    }

    setSaving(true);
    try {
      const marksData = {
        studentId: selectedStudent.studentId,
        examId: selectedStudent.examId,
        subjects,
        marks,
        remarks,
        status: asDraft ? "draft" : "saved",
        enteredBy: user?.email || "Unknown User",
        enteredAt: new Date(),
        ...(editingMarks && { updatedAt: new Date() }),
      };

      console.log("Marks data to save:", marksData); // Debug log
      console.log("Collection:", COLLECTIONS.EXAM_MARKS); // Debug log

      if (editingMarks) {
        await updateDocument(
          COLLECTIONS.EXAM_MARKS,
          editingMarks.id,
          marksData,
        );
      } else {
        await createDocument(COLLECTIONS.EXAM_MARKS, marksData);
      }

      // Clear draft from localStorage
      const draftKey = `${selectedStudent.studentId}_${selectedStudent.examId}`;
      localStorage.removeItem(`${DRAFT_MARKS_KEY}_${draftKey}`);

      // Refresh existing marks
      await fetchExistingMarks();

      setShowMarksDialog(false);
      toast.success(
        asDraft ? "Marks saved as draft!" : "Marks saved successfully!",
      );
    } catch (error) {
      console.error("Error saving marks:", error);
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        stack: error.stack,
      });

      // Try to provide more helpful error messages
      if (error.message.includes("Missing or insufficient permissions")) {
        toast.error(
          "Permission denied: Please ensure you are properly logged in and have the necessary permissions to save marks. Try refreshing the page or logging out and back in.",
        );
      } else {
        toast.error("Failed to save marks: " + error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    total: filteredRegistrations.length,
    entered: filteredRegistrations.filter((reg) => {
      const key = `${reg.studentId}_${reg.examId}`;
      return existingMarks[key] && existingMarks[key].status === "saved";
    }).length,
    draft: filteredRegistrations.filter((reg) => {
      const key = `${reg.studentId}_${reg.examId}`;
      return existingMarks[key] && existingMarks[key].status === "draft";
    }).length,
    pending: filteredRegistrations.filter((reg) => {
      const key = `${reg.studentId}_${reg.examId}`;
      return !existingMarks[key];
    }).length,
  };

  if (loading || authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading marks entry system...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <AlertCircle className="h-12 w-12 mx-auto mb-2" />
              <h2 className="text-xl font-semibold">Authentication Required</h2>
            </div>
            <p className="text-gray-600">
              You must be logged in to access the marks entry system.
            </p>
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
            Marks Entry System
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Enter and manage examination marks with draft save and verification
            system
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4 bg-white">
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
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Marks Entered
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {stats.entered}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Draft Saved
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {stats.draft}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Pending
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {stats.pending}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg sm:text-xl">
                Marks Entry Management
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Dialog
                  open={showTemplateDialog}
                  onOpenChange={setShowTemplateDialog}
                >
                  <DialogTrigger asChild>
                    <Button
                      className="bg-purple-600 hover:bg-purple-700"
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Templates
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl bg-white">
                    <DialogHeader>
                      <DialogTitle>Marks Entry Templates</DialogTitle>
                      <DialogDescription>
                        Manage your saved subject templates for quick marks
                        entry
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {savedTemplates.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">
                          No templates saved yet
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {savedTemplates.map((template) => (
                            <div
                              key={template.id}
                              className="flex items-center justify-between p-3 border rounded-lg"
                            >
                              <div>
                                <h4 className="font-medium">{template.name}</h4>
                                <p className="text-sm text-gray-600">
                                  {template.subjects.length} subjects • Created{" "}
                                  {formatDate(template.createdAt)}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => loadTemplate(template)}
                                  size="sm"
                                  variant="outline"
                                >
                                  Load
                                </Button>
                                <Button
                                  onClick={() => deleteTemplate(template.id)}
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="search" className="text-sm">
                  Search Students
                </Label>
                <Input
                  id="search"
                  placeholder="Name, email, hall ticket..."
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
                    <SelectItem value="1">Class 1st</SelectItem>
                    <SelectItem value="2">Class 2nd</SelectItem>
                    <SelectItem value="3">Class 3rd</SelectItem>
                    <SelectItem value="4">Class 4th</SelectItem>
                    <SelectItem value="5">Class 5th</SelectItem>
                    <SelectItem value="6">Class 6th</SelectItem>
                    <SelectItem value="7">Class 7th</SelectItem>
                    <SelectItem value="8">Class 8th</SelectItem>
                    <SelectItem value="9">Class 9th</SelectItem>
                    <SelectItem value="10">Class 10th</SelectItem>
                    <SelectItem value="11">Class 11th</SelectItem>
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
                <Label htmlFor="status-filter" className="text-sm">
                  Marks Status
                </Label>
                <Select value={marksStatus} onValueChange={setMarksStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="entered">Marks Entered</SelectItem>
                    <SelectItem value="draft">Draft Saved</SelectItem>
                    <SelectItem value="pending">Pending Entry</SelectItem>
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
              Students for Marks Entry ({filteredRegistrations.length})
            </CardTitle>
            <CardDescription>
              Enter examination marks with draft save and two-layer verification
              system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredRegistrations.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  No students found for marks entry
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRegistrations
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((registration) => {
                    const exam = exams.find(
                      (e) => e.id === registration.examId,
                    );
                    const student =
                      studentDetails[registration.studentId] || {};
                    const key = `${registration.studentId}_${registration.examId}`;
                    const existingMark = existingMarks[key];

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
                                {student.classLevel && (
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
                                )}
                                {existingMark ? (
                                  existingMark.status === "saved" ? (
                                    <Badge
                                      variant="default"
                                      className="bg-green-600"
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Marks Entered
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="secondary"
                                      className="bg-orange-500 text-white"
                                    >
                                      <Clock className="h-3 w-3 mr-1" />
                                      Draft Saved
                                    </Badge>
                                  )
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="border-red-500 text-red-700"
                                  >
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Pending Entry
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                                <p className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  <strong>Email:</strong>{" "}
                                  {registration.studentEmail || student.email}
                                </p>
                                <p className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  <strong>Phone:</strong>{" "}
                                  {registration.studentPhone ||
                                    student.phone ||
                                    "N/A"}
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
                                {registration.hallTicketNumber && (
                                  <p className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    <strong>Hall Ticket:</strong>{" "}
                                    {registration.hallTicketNumber}
                                  </p>
                                )}
                              </div>
                              <p>
                                <strong>Exam:</strong>{" "}
                                {exam?.title || "Unknown Exam"}
                              </p>
                              {existingMark && (
                                <p>
                                  <strong>Last Updated:</strong>{" "}
                                  {formatDate(
                                    existingMark.updatedAt ||
                                      existingMark.enteredAt,
                                  )}{" "}
                                  by {existingMark.enteredBy}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 flex-shrink-0">
                            <Button
                              onClick={() => openMarksEntry(registration)}
                              size="sm"
                              className={
                                existingMark
                                  ? "bg-blue-600 hover:bg-blue-700"
                                  : "bg-green-600 hover:bg-green-700"
                              }
                            >
                              {existingMark ? (
                                <>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Marks
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Enter Marks
                                </>
                              )}
                            </Button>
                            {existingMark && (
                              <Button
                                onClick={() => openViewMarks(registration)}
                                size="sm"
                                variant="outline"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
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

        {/* Pagination */}
        {filteredRegistrations.length > pageSize && (
          <div className="flex justify-center">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredRegistrations.length / pageSize)}
              onPageChange={setCurrentPage}
              totalItems={filteredRegistrations.length}
              itemsPerPage={pageSize}
            />
          </div>
        )}

        {/* Marks Entry Dialog */}
        <Dialog open={showMarksDialog} onOpenChange={setShowMarksDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle>
                {editingMarks ? "Edit Marks" : "Enter Marks"} -{" "}
                {selectedStudent?.studentName ||
                  studentDetails[selectedStudent?.studentId]?.fullName}
              </DialogTitle>
              <DialogDescription>
                Enter marks for each subject. You can save as draft for later
                completion or save final marks.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Student Info */}
              {selectedStudent && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Student:</strong>{" "}
                      {selectedStudent.studentName ||
                        studentDetails[selectedStudent.studentId]?.fullName}
                    </div>
                    <div>
                      <strong>Class:</strong>{" "}
                      {studentDetails[selectedStudent.studentId]?.classLevel}
                    </div>
                    <div>
                      <strong>Exam:</strong>{" "}
                      {
                        exams.find((e) => e.id === selectedStudent.examId)
                          ?.title
                      }
                    </div>
                    <div>
                      <strong>Hall Ticket:</strong>{" "}
                      {selectedStudent.hallTicketNumber || "Not Generated"}
                    </div>
                  </div>
                </div>
              )}

              {/* Load Template Section */}
              {savedTemplates.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Load Subject Template
                    </CardTitle>
                    <CardDescription>
                      Quickly load previously saved subject templates
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-3">
                      {savedTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1">
                            <h4 className="font-medium">{template.name}</h4>
                            <p className="text-sm text-gray-600">
                              {template.subjects.length} subjects • Created{" "}
                              {new Date(
                                template.createdAt,
                              ).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Subjects:{" "}
                              {template.subjects.map((s) => s.name).join(", ")}
                            </p>
                          </div>
                          <Button
                            onClick={() => loadTemplate(template)}
                            size="sm"
                            variant="outline"
                            className="ml-3"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Load
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Add Subject Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Add New Subject</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Label>Subject Name</Label>
                      <Input
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        placeholder="Enter subject name"
                      />
                    </div>
                    <div className="w-32">
                      <Label>Max Marks</Label>
                      <Input
                        value={newSubjectMaxMarks}
                        onChange={(e) => setNewSubjectMaxMarks(e.target.value)}
                        placeholder="100"
                        type="number"
                      />
                    </div>
                    <Button
                      onClick={addSubject}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Subjects and Marks */}
              {subjects.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">
                        Subjects & Marks
                      </CardTitle>
                      <Button
                        onClick={saveTemplate}
                        variant="outline"
                        size="sm"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save as Template
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {subjects.map((subject) => (
                        <div
                          key={subject.id}
                          className="flex items-center gap-3 p-3 border rounded-lg"
                        >
                          <div className="flex-1">
                            <Label className="font-medium">
                              {subject.name}
                            </Label>
                            <p className="text-sm text-gray-600">
                              Max Marks: {subject.maxMarks}
                            </p>
                          </div>
                          <div className="w-32">
                            <Input
                              type="number"
                              placeholder="Marks"
                              min="0"
                              max={subject.maxMarks}
                              value={marks[subject.id] || ""}
                              onChange={(e) =>
                                setMarks((prev) => ({
                                  ...prev,
                                  [subject.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <Button
                            onClick={() => removeSubject(subject.id)}
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Remarks Section */}
              <div>
                <Label>Remarks (Optional)</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter any remarks about the student's performance..."
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter>
              <div className="flex gap-2 w-full justify-between">
                <div className="flex gap-2">
                  <Button onClick={saveDraft} variant="outline">
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowMarksDialog(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => saveMarks(true)}
                    disabled={saving}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {saving ? "Saving..." : "Save as Draft"}
                  </Button>
                  <Button
                    onClick={() => saveMarks(false)}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {saving ? "Saving..." : "Save Final Marks"}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Marks Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle>
                View Marks -{" "}
                {viewingMarks?.student?.studentName ||
                  viewingMarks?.studentDetails?.fullName}
              </DialogTitle>
              <DialogDescription>
                View complete marks details for this student
              </DialogDescription>
            </DialogHeader>

            {viewingMarks && (
              <div className="space-y-6">
                {/* Student Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Student Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Student Name:</strong>{" "}
                        {viewingMarks.student.studentName ||
                          viewingMarks.studentDetails?.fullName}
                      </div>
                      <div>
                        <strong>Class:</strong>{" "}
                        {viewingMarks.studentDetails?.classLevel ||
                          "Not Available"}
                      </div>
                      <div>
                        <strong>Email:</strong>{" "}
                        {viewingMarks.student.studentEmail ||
                          viewingMarks.studentDetails?.email}
                      </div>
                      <div>
                        <strong>Phone:</strong>{" "}
                        {viewingMarks.student.studentPhone ||
                          viewingMarks.studentDetails?.phone ||
                          "N/A"}
                      </div>
                      <div>
                        <strong>Madrasa:</strong>{" "}
                        {viewingMarks.studentDetails?.madarsaId ||
                          viewingMarks.student.madarsaId}
                      </div>
                      <div>
                        <strong>Admission Number:</strong>{" "}
                        {viewingMarks.studentDetails?.admissionNumber || "N/A"}
                      </div>
                      <div>
                        <strong>Hall Ticket:</strong>{" "}
                        {viewingMarks.student.hallTicketNumber ||
                          "Not Generated"}
                      </div>
                      <div>
                        <strong>Exam:</strong>{" "}
                        {viewingMarks.exam?.title || "Unknown Exam"}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Marks Details */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">Subject Marks</CardTitle>
                      <Badge
                        variant={
                          viewingMarks.marks.status === "saved"
                            ? "default"
                            : "secondary"
                        }
                        className={
                          viewingMarks.marks.status === "saved"
                            ? "bg-green-600"
                            : "bg-orange-500 text-white"
                        }
                      >
                        {viewingMarks.marks.status === "saved" ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Final Marks
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3 mr-1" />
                            Draft
                          </>
                        )}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {viewingMarks.marks.subjects &&
                      viewingMarks.marks.subjects.length > 0 ? (
                        <>
                          {viewingMarks.marks.subjects.map((subject, index) => {
                            const obtainedMarks =
                              viewingMarks.marks.marks[subject.id] ||
                              viewingMarks.marks.marks[index + 1] ||
                              "N/A";
                            const percentage =
                              obtainedMarks !== "N/A"
                                ? (
                                    (parseInt(obtainedMarks) /
                                      subject.maxMarks) *
                                    100
                                  ).toFixed(1)
                                : "N/A";

                            return (
                              <div
                                key={subject.id || index}
                                className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                              >
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">
                                    {subject.name}
                                  </h4>
                                  <p className="text-sm text-gray-600">
                                    Maximum Marks: {subject.maxMarks}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-semibold text-gray-900">
                                    {obtainedMarks} / {subject.maxMarks}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {percentage !== "N/A"
                                      ? `${percentage}%`
                                      : "N/A"}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Total Calculation */}
                          <div className="border-t pt-3 mt-3">
                            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                              <div className="flex-1">
                                <h4 className="font-semibold text-blue-900">
                                  Total Marks
                                </h4>
                                <p className="text-sm text-blue-700">
                                  Overall Performance
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-blue-900">
                                  {(() => {
                                    const totalObtained =
                                      viewingMarks.marks.subjects.reduce(
                                        (sum, subject, index) => {
                                          const obtainedMarks = parseInt(
                                            viewingMarks.marks.marks[
                                              subject.id
                                            ] ||
                                              viewingMarks.marks.marks[
                                                index + 1
                                              ] ||
                                              0,
                                          );
                                          return (
                                            sum +
                                            (isNaN(obtainedMarks)
                                              ? 0
                                              : obtainedMarks)
                                          );
                                        },
                                        0,
                                      );
                                    const totalMaximum =
                                      viewingMarks.marks.subjects.reduce(
                                        (sum, subject) =>
                                          sum + subject.maxMarks,
                                        0,
                                      );
                                    const overallPercentage =
                                      totalMaximum > 0
                                        ? (
                                            (totalObtained / totalMaximum) *
                                            100
                                          ).toFixed(1)
                                        : "N/A";

                                    return `${totalObtained} / ${totalMaximum}`;
                                  })()}
                                </div>
                                <div className="text-sm text-blue-700">
                                  {(() => {
                                    const totalObtained =
                                      viewingMarks.marks.subjects.reduce(
                                        (sum, subject, index) => {
                                          const obtainedMarks = parseInt(
                                            viewingMarks.marks.marks[
                                              subject.id
                                            ] ||
                                              viewingMarks.marks.marks[
                                                index + 1
                                              ] ||
                                              0,
                                          );
                                          return (
                                            sum +
                                            (isNaN(obtainedMarks)
                                              ? 0
                                              : obtainedMarks)
                                          );
                                        },
                                        0,
                                      );
                                    const totalMaximum =
                                      viewingMarks.marks.subjects.reduce(
                                        (sum, subject) =>
                                          sum + subject.maxMarks,
                                        0,
                                      );
                                    const overallPercentage =
                                      totalMaximum > 0
                                        ? (
                                            (totalObtained / totalMaximum) *
                                            100
                                          ).toFixed(1)
                                        : "N/A";

                                    return overallPercentage !== "N/A"
                                      ? `${overallPercentage}%`
                                      : "N/A";
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No subject marks available
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Remarks */}
                {viewingMarks.marks.remarks && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Remarks</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                        {viewingMarks.marks.remarks}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Entry Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Entry Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Entered By:</strong>{" "}
                        {viewingMarks.marks.enteredBy || "Unknown"}
                      </div>
                      <div>
                        <strong>Entry Date:</strong>{" "}
                        {formatDate(
                          viewingMarks.marks.enteredAt ||
                            viewingMarks.marks.updatedAt,
                        )}
                      </div>
                      <div>
                        <strong>Status:</strong>
                        <Badge
                          variant={
                            viewingMarks.marks.status === "saved"
                              ? "default"
                              : "secondary"
                          }
                          className={`ml-2 ${
                            viewingMarks.marks.status === "saved"
                              ? "bg-green-600"
                              : "bg-orange-500 text-white"
                          }`}
                        >
                          {viewingMarks.marks.status === "saved"
                            ? "Final"
                            : "Draft"}
                        </Badge>
                      </div>
                      {viewingMarks.marks.updatedAt && (
                        <div>
                          <strong>Last Updated:</strong>{" "}
                          {formatDate(viewingMarks.marks.updatedAt)}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <DialogFooter>
              <Button
                onClick={() => setShowViewDialog(false)}
                variant="outline"
              >
                Close
              </Button>
              {viewingMarks && (
                <Button
                  onClick={() => {
                    setShowViewDialog(false);
                    openMarksEntry(viewingMarks.student);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Marks
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
