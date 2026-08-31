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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Download,
  User,
  BookOpen,
  School,
  Phone,
  Mail,
  MapPin,
  FileText,
  Printer,
  Calendar,
  CreditCard,
  Hash,
} from "lucide-react";
import {
  getDocuments,
  updateDocument,
  COLLECTIONS,
} from "@/lib/firestoreService";
import { orderBy, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";

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

// Generate hall ticket number
const generateHallTicketNumber = (examId, studentId, classLevel) => {
  const year = new Date().getFullYear();
  const classCode = classLevel ? classLevel.toString().padStart(2, "0") : "00";
  const examCode = examId ? examId.substring(0, 4).toUpperCase() : "EXAM";
  const studentCode = studentId
    ? studentId.substring(0, 6).toUpperCase()
    : "STU000";

  return `${"0"}${year}${classCode}${examCode}${studentCode}`;
};

export default function HallTickets() {
  const { user, role } = useAuth();
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  // Data States
  const [examRegistrations, setExamRegistrations] = useState([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState([]);
  const [studentDetails, setStudentDetails] = useState({});
  const [exams, setExams] = useState([]);
  const [madrasas, setMadrasas] = useState([]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExam, setSelectedExam] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedMadrasa, setSelectedMadrasa] = useState("all");
  const [hallTicketStatus, setHallTicketStatus] = useState("all"); // all, generated, pending

  // Fetch all exam registrations for eligible classes only (5th, 7th, 10th, 12th)
  const fetchExamRegistrations = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      const fetchedRegistrations = await getDocuments(
        COLLECTIONS.EXAM_REGISTRATIONS,
        constraints,
      );

      // Filter for eligible classes and completed payments
      const eligibleRegistrations = fetchedRegistrations.filter(
        (registration) => {
          return registration.paymentStatus === "completed";
        },
      );

      setExamRegistrations(eligibleRegistrations);
      setFilteredRegistrations(eligibleRegistrations);

      // Fetch student details for each registration
      const studentIds = [
        ...new Set(eligibleRegistrations.map((r) => r.studentId)),
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
              const studentData = studentSnapshot.docs[0].data();
              // Only include students from eligible classes
              if (["5", "7", "10", "12"].includes(studentData.classLevel)) {
                studentDetailsMap[studentId] = studentData;
              }
            }
          } catch (error) {
            console.error(`Error fetching student ${studentId}:`, error);
          }
        }
      }

      setStudentDetails(studentDetailsMap);

      // Filter registrations to only include eligible students
      const finalEligibleRegistrations = eligibleRegistrations.filter(
        (registration) => studentDetailsMap[registration.studentId],
      );

      setExamRegistrations(finalEligibleRegistrations);
      setFilteredRegistrations(finalEligibleRegistrations);
    } catch (error) {
      console.error("Error fetching exam registrations:", error);
      setError("Failed to fetch registrations");
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
      const madrasaQuery = query(collection(db, "madrasas"));
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

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      await Promise.all([
        fetchExamRegistrations(),
        fetchExams(),
        fetchMadrasas(),
      ]);
      setLoading(false);
    };

    fetchAllData();
  }, [fetchExamRegistrations, fetchExams, fetchMadrasas]);

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

    // Hall ticket status filter
    if (hallTicketStatus !== "all") {
      if (hallTicketStatus === "generated") {
        filtered = filtered.filter(
          (registration) => registration.hallTicketNumber,
        );
      } else if (hallTicketStatus === "pending") {
        filtered = filtered.filter(
          (registration) => !registration.hallTicketNumber,
        );
      }
    }

    setFilteredRegistrations(filtered);
  }, [
    examRegistrations,
    studentDetails,
    searchTerm,
    selectedExam,
    selectedClass,
    selectedMadrasa,
    hallTicketStatus,
  ]);

  // Generate hall ticket for single student
  const generateSingleHallTicket = async (registration) => {
    try {
      const student = studentDetails[registration.studentId];
      if (!student) {
        alert("Student details not found");
        return;
      }

      const hallTicketNumber = generateHallTicketNumber(
        registration.examId,
        registration.studentId,
        student.classLevel,
      );

      await updateDocument(COLLECTIONS.EXAM_REGISTRATIONS, registration.id, {
        hallTicketNumber,
        hallTicketGeneratedAt: new Date(),
      });

      // Update local state
      setExamRegistrations((prev) =>
        prev.map((reg) =>
          reg.id === registration.id
            ? { ...reg, hallTicketNumber, hallTicketGeneratedAt: new Date() }
            : reg,
        ),
      );

      alert("Hall ticket generated successfully!");
    } catch (error) {
      console.error("Error generating hall ticket:", error);
      alert("Failed to generate hall ticket");
    }
  };

  // Generate hall tickets in bulk
  const generateBulkHallTickets = async () => {
    const pendingRegistrations = filteredRegistrations.filter(
      (reg) => !reg.hallTicketNumber,
    );

    if (pendingRegistrations.length === 0) {
      alert("No students found without hall tickets");
      return;
    }

    if (
      !confirm(
        `Generate hall tickets for ${pendingRegistrations.length} students?`,
      )
    ) {
      return;
    }

    setGenerating(true);
    try {
      const updates = [];

      for (const registration of pendingRegistrations) {
        const student = studentDetails[registration.studentId];
        if (student) {
          const hallTicketNumber = generateHallTicketNumber(
            registration.examId,
            registration.studentId,
            student.classLevel,
          );

          updates.push({
            id: registration.id,
            hallTicketNumber,
            hallTicketGeneratedAt: new Date(),
          });
        }
      }

      // Update in batches
      for (const update of updates) {
        await updateDocument(COLLECTIONS.EXAM_REGISTRATIONS, update.id, {
          hallTicketNumber: update.hallTicketNumber,
          hallTicketGeneratedAt: update.hallTicketGeneratedAt,
        });
      }

      // Update local state
      setExamRegistrations((prev) =>
        prev.map((reg) => {
          const update = updates.find((u) => u.id === reg.id);
          return update ? { ...reg, ...update } : reg;
        }),
      );

      alert(`Successfully generated ${updates.length} hall tickets!`);
    } catch (error) {
      console.error("Error generating bulk hall tickets:", error);
      alert("Failed to generate hall tickets");
    } finally {
      setGenerating(false);
    }
  };

  // Print single hall ticket
  const printHallTicket = (registration) => {
    const student = studentDetails[registration.studentId];
    const exam = exams.find((e) => e.id === registration.examId);

    if (!registration.hallTicketNumber) {
      alert("Hall ticket not generated yet");
      return;
    }

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Hall Ticket - ${registration.hallTicketNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .hall-ticket { max-width: 800px; margin: 0 auto; border: 2px solid #000; padding: 20px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
            .logo { font-size: 24px; font-weight: bold; color: #1f2937; }
            .title { font-size: 20px; font-weight: bold; margin: 10px 0; }
            .subtitle { font-size: 16px; color: #666; }
            .content { display: flex; gap: 20px; }
            .left-section { flex: 2; }
            .right-section { flex: 1; text-align: center; }
            .photo-box { border: 1px solid #000; width: 120px; height: 150px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
            .info-row { display: flex; margin: 10px 0; }
            .label { font-weight: bold; width: 150px; }
            .value { flex: 1; border-bottom: 1px dotted #000; padding-bottom: 2px; }
            .hall-ticket-number { font-size: 18px; font-weight: bold; color: #dc2626; text-align: center; margin: 20px 0; }
            .instructions { margin-top: 30px; border-top: 1px solid #000; padding-top: 20px; }
            .signature-section { margin-top: 30px; display: flex; justify-content: space-between; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="hall-ticket">
            <div class="header">
              <div class="logo">DKJU - Darul Uloom Kareem Al Jamiat</div>
              <div class="title">EXAMINATION HALL TICKET</div>
              <div class="subtitle">${exam?.title || "Examination"}</div>
            </div>
            
            <div class="hall-ticket-number">
              Hall Ticket No: ${registration.hallTicketNumber}
            </div>
            
            <div class="content">
              <div class="left-section">
                <div class="info-row">
                  <span class="label">Student Name:</span>
                  <span class="value">${registration.studentName || student?.fullName || ""}</span>
                </div>
                <div class="info-row">
                  <span class="label">Father's Name:</span>
                  <span class="value">${student?.guardianName || student?.fatherName || ""}</span>
                </div>
                <div class="info-row">
                  <span class="label">Class:</span>
                  <span class="value">${student?.classLevel ? `Class ${student.classLevel}` : ""}</span>
                </div>
                <div class="info-row">
                  <span class="label">Madrasa:</span>
                  <span class="value">${student?.madarsaId || registration.madarsaId || ""}</span>
                </div>
                <div class="info-row">
                  <span class="label">Admission No:</span>
                  <span class="value">${student?.admissionNumber || ""}</span>
                </div>
                <div class="info-row">
                  <span class="label">Date of Birth:</span>
                  <span class="value">${student?.dateOfBirth ? formatDate(student.dateOfBirth) : ""}</span>
                </div>
                <div class="info-row">
                  <span class="label">Email:</span>
                  <span class="value">${registration.studentEmail || student?.email || ""}</span>
                </div>
                <div class="info-row">
                  <span class="label">Phone:</span>
                  <span class="value">${registration.studentPhone || student?.phone || ""}</span>
                </div>
                <div class="info-row">
                  <span class="label">Exam Date:</span>
                  <span class="value">${exam?.examDate ? formatDate(exam.examDate) : "To be announced"}</span>
                </div>
                <div class="info-row">
                  <span class="label">Exam Time:</span>
                  <span class="value">${exam?.startTime || "To be announced"}</span>
                </div>
              </div>
              
              <div class="right-section">
                <div class="photo-box">
                  <span style="color: #666;">PASSPORT SIZE PHOTOGRAPH</span>
                </div>
                <div style="margin-top: 20px; font-size: 12px; text-align: center;">
                  Affix recent passport size photograph here
                </div>
              </div>
            </div>
            
            <div class="instructions">
              <h3>Important Instructions:</h3>
              <ul style="font-size: 14px; line-height: 1.6;">
                <li>This hall ticket must be brought to the examination center.</li>
                <li>Students must arrive at least 30 minutes before the exam starts.</li>
                <li>Bring a valid ID proof along with this hall ticket.</li>
                <li>Mobile phones and electronic devices are strictly prohibited.</li>
                <li>Students must occupy their assigned seats only.</li>
                <li>Late entry after 15 minutes of exam start will not be allowed.</li>
              </ul>
            </div>
            
            <div class="signature-section">
              <div>
                <div style="border-top: 1px solid #000; width: 150px; text-align: center; padding-top: 5px; font-size: 12px;">
                  Student Signature
                </div>
              </div>
              <div>
                <div style="border-top: 1px solid #000; width: 150px; text-align: center; padding-top: 5px; font-size: 12px;">
                  Controller of Examinations
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // Download hall tickets list
  const downloadHallTicketsList = () => {
    const generatedTickets = filteredRegistrations.filter(
      (reg) => reg.hallTicketNumber,
    );

    if (generatedTickets.length === 0) {
      alert("No hall tickets generated yet");
      return;
    }

    const headers = [
      "Hall Ticket Number",
      "Student Name",
      "Class",
      "Madrasa",
      "Exam Title",
      "Email",
      "Phone",
      "Generated Date",
    ];

    const csvData = generatedTickets.map((registration) => {
      const student = studentDetails[registration.studentId] || {};
      const exam = exams.find((e) => e.id === registration.examId);

      return [
        registration.hallTicketNumber || "",
        registration.studentName || student.fullName || "",
        student.classLevel || "",
        student.madarsaId || registration.madarsaId || "",
        exam?.title || "",
        registration.studentEmail || student.email || "",
        registration.studentPhone || student.phone || "",
        registration.hallTicketGeneratedAt
          ? formatDate(registration.hallTicketGeneratedAt)
          : "",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.map((field) => `"${field}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `hall_tickets_list_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = {
    total: filteredRegistrations.length,
    generated: filteredRegistrations.filter((reg) => reg.hallTicketNumber)
      .length,
    pending: filteredRegistrations.filter((reg) => !reg.hallTicketNumber)
      .length,
    classes: ["5", "7", "10", "12"],
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading hall tickets data...</p>
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
            Hall Tickets Management
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Generate and manage hall tickets for students in classes 5th, 7th,
            10th, and 12th
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
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Total Eligible
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
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Generated
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {stats.generated}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 flex-shrink-0" />
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

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Eligible Classes
                  </p>
                  <p className="text-sm sm:text-base font-bold text-gray-900">
                    5th, 7th, 10th, 12th
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions and Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg sm:text-xl">
                Hall Tickets Management
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={generateBulkHallTickets}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={stats.pending === 0 || generating}
                  size="sm"
                >
                  <Hash className="h-4 w-4 mr-2" />
                  {generating
                    ? "Generating..."
                    : `Generate Bulk (${stats.pending})`}
                </Button>
                <Button
                  onClick={downloadHallTicketsList}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={stats.generated === 0}
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download List
                </Button>
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
                    <SelectItem value="5">Class 5th</SelectItem>
                    <SelectItem value="7">Class 7th</SelectItem>
                    <SelectItem value="10">Class 10th</SelectItem>
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
                  Hall Ticket Status
                </Label>
                <Select
                  value={hallTicketStatus}
                  onValueChange={setHallTicketStatus}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="generated">Generated</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
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
              Eligible Students ({filteredRegistrations.length})
            </CardTitle>
            <CardDescription>
              Students from classes 5th, 7th, 10th, and 12th with completed
              payment
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredRegistrations.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No eligible students found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRegistrations.map((registration) => {
                  const exam = exams.find((e) => e.id === registration.examId);
                  const student = studentDetails[registration.studentId] || {};

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
                              <Badge
                                variant="outline"
                                className="border-green-500 text-green-700"
                              >
                                Class{" "}
                                {String(
                                  student.classLevel || "",
                                ).toUpperCase() === "UKG"
                                  ? "Ukg"
                                  : student.classLevel}
                              </Badge>
                              {registration.hallTicketNumber ? (
                                <Badge
                                  variant="default"
                                  className="bg-green-600"
                                >
                                  Hall Ticket Generated
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  Pending Generation
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                              {registration.hallTicketNumber && (
                                <p className="flex items-center gap-1">
                                  <CreditCard className="h-3 w-3" />
                                  <strong>Hall Ticket:</strong>{" "}
                                  {registration.hallTicketNumber}
                                </p>
                              )}
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
                            </div>
                            <p>
                              <strong>Exam:</strong>{" "}
                              {exam?.title || "Unknown Exam"}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 flex-shrink-0">
                          {!registration.hallTicketNumber ? (
                            <Button
                              onClick={() =>
                                generateSingleHallTicket(registration)
                              }
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Hash className="h-4 w-4 mr-2" />
                              Generate
                            </Button>
                          ) : (
                            <Button
                              onClick={() => printHallTicket(registration)}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Printer className="h-4 w-4 mr-2" />
                              Print
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
      </div>
    </Layout>
  );
}
