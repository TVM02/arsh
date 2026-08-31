"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Search,
  Filter,
  Eye,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  Download,
  RefreshCw,
  GraduationCap,
  Home,
  Cake,
  User,
} from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";

export default function TeacherStudents() {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const { userData } = useAuthStore();
  const router = useRouter();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    const fetchStudentsData = async () => {
      try {
        setLoading(true);
        setError("");

        let madarsaId = userData?.madarsaId;
        if (!madarsaId) {
          madarsaId = "madarsa-001";
        }

        const q = query(
          collection(db, "students"),
          where("madarsaId", "==", madarsaId),
        );

        const querySnapshot = await getDocs(q);
        const studentsData = [];

        querySnapshot.forEach((doc) => {
          studentsData.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        setStudents(studentsData);
      } catch (error) {
        console.error("Error fetching students:", error);
        setError("Failed to load students. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchStudentsData();
  }, [userData?.madarsaId]);

  useEffect(() => {
    const filterStudents = () => {
      let filtered = students;

      // Filter by search term
      if (searchTerm) {
        filtered = filtered.filter(
          (student) =>
            student.fullName
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.admissionId
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            student.rollNumber
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            student.admissionNumber
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            (student.aadharNumber &&
              student.aadharNumber.slice(-4).includes(searchTerm)),
        );
      }

      // Filter by status
      if (filterStatus !== "all") {
        filtered = filtered.filter(
          (student) => student.status === filterStatus,
        );
      }

      // Filter by class
      if (filterClass !== "all") {
        filtered = filtered.filter(
          (student) => student.classLevel === filterClass,
        );
      }

      // Filter by gender
      if (filterGender !== "all") {
        filtered = filtered.filter(
          (student) => student.gender === filterGender,
        );
      }

      setFilteredStudents(filtered);
      setCurrentPage(1); // Reset to first page on filter change
    };

    filterStudents();
  }, [students, searchTerm, filterStatus, filterClass, filterGender]);

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStudents = filteredStudents.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError("");

      let madarsaId = userData?.madarsaId;
      if (!madarsaId) {
        madarsaId = "madarsa-001";
      }

      const q = query(
        collection(db, "students"),
        where("madarsaId", "==", madarsaId),
      );

      const querySnapshot = await getDocs(q);
      const studentsData = [];

      querySnapshot.forEach((doc) => {
        studentsData.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      setStudents(studentsData);
    } catch (error) {
      console.error("Error fetching students:", error);
      setError("Failed to load students. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: "bg-green-100 text-green-800", label: "Active" },
      inactive: { color: "bg-gray-100 text-gray-800", label: "Inactive" },
      suspended: { color: "bg-red-100 text-red-800", label: "Suspended" },
    };

    const config = statusConfig[status] || statusConfig.active;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const exportStudentData = () => {
    const csvContent = [
      [
        "Name",
        "Admission Number",
        "Class",
        "Gender",
        "Status",
        "Date of Birth",
        "Guardian Name",
        "Guardian Phone",
        "Email",
        "Phone",
        "Address",
        "Aadhar",
      ],
      ...filteredStudents.map((student) => [
        student.fullName,
        student.admissionNumber || "N/A",
        ["LKG", "UKG"].includes(String(student.classLevel).toUpperCase()) ? String(student.classLevel).toUpperCase() : `Class ${student.classLevel}`,
        student.gender || "N/A",
        student.status,
        student.dateOfBirth
          ? new Date(student.dateOfBirth).toLocaleDateString()
          : "N/A",
        student.guardianName || "N/A",
        student.guardianPhone || "N/A",
        student.email,
        student.phone || "N/A",
        `"${student.address || "N/A"}"`, // Quote address to handle commas
        student.aadharNumber
          ? `XXXX-XXXX-${student.aadharNumber.slice(-4)}`
          : "N/A",
      ]),
    ];

    const csvString = csvContent.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `students_${userData?.madarsaId || ""}_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadStudentPDF = (student) => {
    // Mask Aadhar number - show only last 4 digits
    const maskedAadhar = student.aadharNumber
      ? `XXXX-XXXX-${student.aadharNumber.slice(-4)}`
      : "Not provided";

    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const pdfContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Student Details - ${student.fullName}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Arial', sans-serif;
              line-height: 1.6;
              color: #333;
              background: #f8f9fa;
            }
            
            .container {
              max-width: 800px;
              margin: 20px auto;
              background: white;
              box-shadow: 0 0 20px rgba(0,0,0,0.1);
            }
            
            .header {
              background: linear-gradient(135deg, #0f766e, #134e4a);
              color: white;
              padding: 30px;
              text-align: center;
              position: relative;
              overflow: hidden;
            }
            
            .header::before {
              content: '';
              position: absolute;
              top: -50%;
              left: -50%;
              width: 200%;
              height: 200%;
              background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 50%);
              animation: pulse 4s ease-in-out infinite;
            }
            
            @keyframes pulse {
              0%, 100% { opacity: 0.5; }
              50% { opacity: 0.8; }
            }
            
            .logo {
              display: inline-block;
              width: 60px;
              height: 60px;
              background: #fbbf24;
              border-radius: 15px;
              margin-bottom: 15px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 28px;
              font-weight: bold;
              color: #0f766e;
              position: relative;
              z-index: 1;
            }
            
            .header h1 {
              font-size: 28px;
              font-weight: bold;
              margin-bottom: 5px;
              position: relative;
              z-index: 1;
            }
            
            .header p {
              font-size: 14px;
              opacity: 0.9;
              position: relative;
              z-index: 1;
            }
            
            .content {
              padding: 40px;
            }
            
            .student-info {
              text-align: center;
              margin-bottom: 40px;
              padding: 20px;
              background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
              border-radius: 10px;
              border-left: 5px solid #0f766e;
            }
            
            .student-name {
              font-size: 24px;
              font-weight: bold;
              color: #0f766e;
              margin-bottom: 5px;
            }
            
            .student-id {
              color: #666;
              font-size: 14px;
            }
            
            .section {
              margin-bottom: 30px;
            }
            
            .section-title {
              font-size: 18px;
              font-weight: bold;
              color: #0f766e;
              border-bottom: 2px solid #fbbf24;
              padding-bottom: 5px;
              margin-bottom: 20px;
              display: flex;
              align-items: center;
            }
            
            .section-title::before {
              content: '';
              width: 8px;
              height: 8px;
              background: #fbbf24;
              border-radius: 50%;
              margin-right: 10px;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
              gap: 20px;
            }
            
            .info-item {
              background: #f8fafc;
              padding: 15px;
              border-radius: 8px;
              border-left: 3px solid #0f766e;
            }
            
            .info-label {
              font-weight: 600;
              color: #374151;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 5px;
            }
            
            .info-value {
              color: #1f2937;
              font-size: 14px;
              font-weight: 500;
            }
            
            .footer {
              background: #f8fafc;
              padding: 20px 40px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
            
            .generated-date {
              margin-top: 10px;
              font-style: italic;
            }
            
            .watermark {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-45deg);
              font-size: 120px;
              color: rgba(15, 118, 110, 0.05);
              font-weight: bold;
              z-index: 0;
              pointer-events: none;
            }
            
            @media print {
              body { background: white; }
              .container { box-shadow: none; margin: 0; }
              .header::before { animation: none; }
            }
          </style>
        </head>
        <body>
          <div class="watermark">DKJU</div>
          <div class="container">

            
            <div class="content">
              <div class="student-info">
                <div class="student-name">${student.fullName}</div>
                <div class="student-id">Admission Number: ${
                  student.admissionNumber
                }</div>
              </div>
              
              <div class="section">
                <div class="section-title">Personal Information</div>
                <div class="info-grid">
                  <div class="info-item">
                    <div class="info-label">Full Name</div>
                    <div class="info-value">${student.fullName}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Email</div>
                    <div class="info-value">${student.email}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Phone</div>
                    <div class="info-value">${
                      student.phone || "Not provided"
                    }</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Date of Birth</div>
                    <div class="info-value">${
                      student.dateOfBirth
                        ? new Date(student.dateOfBirth).toLocaleDateString()
                        : "Not provided"
                    }</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Aadhar Number</div>
                    <div class="info-value">${maskedAadhar}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Address</div>
                    <div class="info-value">${
                      student.address || "Not provided"
                    }</div>
                  </div>
                </div>
              </div>
              
              <div class="section">
                <div class="section-title">Academic Information</div>
                <div class="info-grid">
                  <div class="info-item">
                    <div class="info-label">Admission Number</div>
                    <div class="info-value">${
                      student.admissionNumber || "Not provided"
                    }</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Class Level</div>
                    <div class="info-value">${student.classLevel}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Academic Year</div>
                    <div class="info-value">${
                      student.academicYear || new Date().getFullYear()
                    }</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Admission Date</div>
                    <div class="info-value">${new Date(
                      student.admissionDate,
                    ).toLocaleDateString()}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Status</div>
                    <div class="info-value">${student.status}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Previous Education</div>
                    <div class="info-value">${
                      student.previousEducation || "Not provided"
                    }</div>
                  </div>
                </div>
              </div>
              
              <div class="section">
                <div class="section-title">Family Information</div>
                <div class="info-grid">
                  <div class="info-item">
                    <div class="info-label">Guardian's Name</div>
                    <div class="info-value">${
                      student.guardianName || "Not provided"
                    }</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Guardian Phone</div>
                    <div class="info-value">${
                      student.guardianPhone || "Not provided"
                    }</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p>© 2025 DKJU. All rights reserved. | Smart Islamic Education Platform</p>
              <div class="generated-date">Generated on: ${currentDate}</div>
            </div>
          </div>
          
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `;

    // Create and open new window with PDF content
    const printWindow = window.open("", "_blank");
    printWindow.document.write(pdfContent);
    printWindow.document.close();
  };

  const viewStudentDetails = (studentId) => {
    router.push(`/dashboard/teacher/students/${studentId}`);
  };

  // Get unique class levels for filter
  const classLevels = [...new Set(students.map((s) => s.classLevel))].sort();

  return (
    <Layout>
      <div className="space-y-6 md:space-y-8 px-4 md:px-0">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              My Students
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              View and manage your assigned students
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            <Button
              onClick={exportStudentData}
              variant="outline"
              className="flex items-center justify-center space-x-2"
              size="sm"
            >
              <Download className="h-4 w-4" />
              <span>Export Data</span>
            </Button>
            <Button
              onClick={fetchStudents}
              variant="outline"
              className="flex items-center justify-center space-x-2"
              size="sm"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm font-medium text-gray-600">
                    Total Students
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900">
                    {students.length}
                  </p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm font-medium text-gray-600">
                    Active Students
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-green-600">
                    {students.filter((s) => s.status === "active").length}
                  </p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm font-medium text-gray-600">
                    Classes
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-purple-600">
                    {classLevels.length}
                  </p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm font-medium text-gray-600">
                    Current Year
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-yellow-600">
                    {students[0]?.academicYear || new Date().getFullYear()}
                  </p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 md:h-6 md:w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex items-center space-x-4">
                <div className="relative flex-1 lg:flex-none">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full lg:w-80"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-600" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-auto"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4 text-gray-600" />
                  <select
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-auto"
                  >
                    <option value="all">All Classes</option>
                    {classLevels.map((level) => (
                      <option key={level} value={level}>
                        {["LKG", "UKG"].includes(String(level).toUpperCase()) ? String(level).toUpperCase() : `Class ${level}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-600" />
                  <select
                    value={filterGender}
                    onChange={(e) => setFilterGender(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-auto"
                  >
                    <option value="all">All Genders</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Students List */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center space-x-2 text-lg md:text-xl">
              <Users className="h-5 w-5" />
              <span>Students ({filteredStudents.length})</span>
            </CardTitle>
            <CardDescription className="text-sm md:text-base">
              List of students assigned to your classes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 md:p-6 md:pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-8 md:py-12 px-4">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-600 text-sm md:text-base">
                    Loading students...
                  </span>
                </div>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 md:py-12 px-4">
                <Users className="h-10 w-10 md:h-12 md:w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">
                  No students found
                </h3>
                <p className="text-gray-600 text-sm md:text-base">
                  {searchTerm || filterStatus !== "all" || filterClass !== "all"
                    ? "Try adjusting your filters or search terms"
                    : "No students have been assigned to your classes yet"}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-900">
                          Student
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">
                          Admission Details
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">
                          Contact
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">
                          Parents
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">
                          Aadhar
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {currentStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <div>
                              <div className="font-medium text-gray-900">
                                {student.fullName}
                              </div>
                              <div className="text-sm text-gray-600 flex items-center mt-1">
                                <Cake className="h-3 w-3 mr-1" />
                                DOB:{" "}
                                {new Date(
                                  student.dateOfBirth,
                                ).toLocaleDateString()}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <div className="text-sm text-gray-900">
                                <span className="font-medium">Class:</span>{" "}
                                {String(
                                  student.classLevel || "",
                                ).toUpperCase() === "UKG"
                                  ? "UKG"
                                  : student.classLevel}
                              </div>
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">
                                  Admission Number:
                                </span>{" "}
                                {student.admissionNumber || "N/A"}
                              </div>
                              <div className="text-sm text-gray-600 flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(
                                  student.admissionDate,
                                ).toLocaleDateString()}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center text-sm text-gray-600">
                                <Mail className="h-3 w-3 mr-1" />
                                {student.email}
                              </div>
                              {student.phone && (
                                <div className="flex items-center text-sm text-gray-600">
                                  <Phone className="h-3 w-3 mr-1" />
                                  {student.phone}
                                </div>
                              )}
                              {student.guardianPhone && (
                                <div className="flex items-center text-sm text-gray-600">
                                  <User className="h-3 w-3 mr-1" />
                                  Guardian: {student.guardianPhone}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Guardian:</span>{" "}
                                {student.guardianName || "N/A"}
                              </div>
                              <div className="flex items-center text-sm text-gray-600">
                                <Home className="h-3 w-3 mr-1" />
                                {student.address}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm font-mono text-gray-600">
                              {student.aadharNumber
                                ? `XXXX-XXXX-${student.aadharNumber.slice(-4)}`
                                : "N/A"}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            {getStatusBadge(student.status)}
                          </td>
                          <td className="py-4 px-4">
                            <Button
                              onClick={() => downloadStudentPDF(student)}
                              variant="outline"
                              size="sm"
                              className="flex items-center space-x-1"
                            >
                              <Download className="h-3 w-3" />
                              <span>PDF</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4 p-4">
                  {currentStudents.map((student) => (
                    <Card key={student.id} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Student Name and Status */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 truncate">
                                {student.fullName}
                              </h3>
                              <div className="text-sm text-gray-600 flex items-center mt-1">
                                <Cake className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span>
                                  DOB:{" "}
                                  {new Date(
                                    student.dateOfBirth,
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="ml-2 flex-shrink-0">
                              {getStatusBadge(student.status)}
                            </div>
                          </div>

                          {/* Class and Admission Info */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Class & Admission
                              </p>
                              <div className="mt-1 space-y-1">
                                <div className="text-sm text-gray-900">
                                  <span className="font-medium">Class:</span>{" "}
                                  {String(
                                    student.classLevel || "",
                                  ).toUpperCase() === "UKG"
                                    ? "UKG"
                                    : student.classLevel}
                                </div>
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">
                                    Admission #:
                                  </span>{" "}
                                  {student.admissionNumber || "N/A"}
                                </div>
                                <div className="text-sm text-gray-600 flex items-center">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {new Date(
                                    student.admissionDate,
                                  ).toLocaleDateString()}
                                </div>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Contact Info
                              </p>
                              <div className="mt-1 space-y-1">
                                <div className="flex items-center text-sm text-gray-600">
                                  <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                                  <span className="truncate">
                                    {student.email}
                                  </span>
                                </div>
                                {student.phone && (
                                  <div className="flex items-center text-sm text-gray-600">
                                    <Phone className="h-3 w-3 mr-1 flex-shrink-0" />
                                    <span>{student.phone}</span>
                                  </div>
                                )}
                                {student.guardianPhone && (
                                  <div className="flex items-center text-sm text-gray-600">
                                    <User className="h-3 w-3 mr-1 flex-shrink-0" />
                                    <span>
                                      Guardian: {student.guardianPhone}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Guardian and Address */}
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              Family & Address
                            </p>
                            <div className="mt-1 space-y-1">
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Guardian:</span>{" "}
                                {student.guardianName || "N/A"}
                              </div>
                              <div className="flex items-start text-sm text-gray-600">
                                <Home className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                                <span className="break-words">
                                  {student.address}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Aadhar and Actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Aadhar
                              </p>
                              <div className="text-sm font-mono text-gray-600 mt-1">
                                {student.aadharNumber
                                  ? `XXXX-XXXX-${student.aadharNumber.slice(
                                      -4,
                                    )}`
                                  : "N/A"}
                              </div>
                            </div>
                            <Button
                              onClick={() => downloadStudentPDF(student)}
                              variant="outline"
                              size="sm"
                              className="flex items-center space-x-1"
                            >
                              <Download className="h-3 w-3" />
                              <span>PDF</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pagination Controls */}
        {!loading && filteredStudents.length > itemsPerPage && (
          <div className="flex justify-center items-center space-x-2 mt-4 pb-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <Button
                  key={i + 1}
                  variant={currentPage === i + 1 ? "default" : "outline"}
                  size="sm"
                  className={`w-8 h-8 p-0 ${
                    currentPage === i + 1
                      ? "bg-green-600 hover:bg-green-700"
                      : ""
                  }`}
                  onClick={() => paginate(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
