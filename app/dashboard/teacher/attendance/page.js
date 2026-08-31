"use client";

import { useState, useEffect, useMemo } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Calendar,
  Save,
  Download,
  FileSpreadsheet,
  FileText,
  Clock,
  History,
  ClipboardList
} from "lucide-react";
import { collection, query, where, getDocs, setDoc, doc, Timestamp, writeBatch, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function TeacherAttendance() {
  const [activeTab, setActiveTab] = useState("mark"); // 'mark' or 'history'
  
  // States for Mark Attendance
  const [students, setStudents] = useState([]);
  const [classLevels, setClassLevels] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [genderFilter, setGenderFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  // Attendance State
  const [attendanceRecords, setAttendanceRecords] = useState({}); // studentId -> 'Present' | 'Absent'
  const [absentStreaks, setAbsentStreaks] = useState({}); // studentId -> consecutive absent days count
  const [absentReasons, setAbsentReasons] = useState({}); // studentId -> absent reason string
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [missingReasonStudents, setMissingReasonStudents] = useState([]);
  
  // Single Reason Modal State
  const [singleReasonModalOpen, setSingleReasonModalOpen] = useState(false);
  const [currentReasonStudent, setCurrentReasonStudent] = useState(null);
  const [tempSingleReason, setTempSingleReason] = useState("");
  
  const [attendanceExists, setAttendanceExists] = useState(false);
  const [existingAttendanceDocId, setExistingAttendanceDocId] = useState(null);
  const [settings, setSettings] = useState({ totalWorkingDays: 200, requiredPresentDays: 150, totalHolidays: 0 });
  const [studentStats, setStudentStats] = useState({});
  
  // History States
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({
    fromDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0],
    toDate: new Date().toISOString().split("T")[0],
    classLevel: "all",
    search: "",
    status: "all"
  });

  const { userData } = useAuthStore();
  const router = useRouter();

  // Fetch classes and students initially
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setError("");

        let madarsaId = userData?.madarsaId || "madarsa-001";

        const q = query(
          collection(db, "students"),
          where("madarsaId", "==", madarsaId),
          where("status", "==", "active")
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
        
        const uniqueClasses = [...new Set(studentsData.map((s) => {
          if (!s.classLevel) return null;
          const str = String(s.classLevel).trim();
          return str.toUpperCase() === "UKG" ? "UKG" : str;
        }).filter(Boolean))].sort((a, b) => {
          const numA = parseInt(a);
          const numB = parseInt(b);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.localeCompare(b);
        });
        setClassLevels(uniqueClasses);
        
        const settingsDoc = await getDoc(doc(db, "settings", "general"));
        if (settingsDoc.exists()) {
          const sData = settingsDoc.data();
          setSettings({
            totalWorkingDays: sData.totalWorkingDays || 200,
            requiredPresentDays: sData.requiredPresentDays || 150,
            totalHolidays: sData.totalHolidays || 0
          });
        }
        
      } catch (error) {
        console.error("Error fetching initial data:", error);
        setError("Failed to load students. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (userData) {
      fetchInitialData();
    }
  }, [userData]);

  // Handle class selection and existing attendance check
  useEffect(() => {
    const checkExistingAttendance = async () => {
      if (!selectedClass || !selectedDate || !userData) return;

      // Clear state immediately when switching class to prevent bleeding
      setAttendanceExists(false);
      setExistingAttendanceDocId(null);
      setStudentStats({});

      try {
        setLoading(true);
        let madarsaId = userData?.madarsaId || "madarsa-001";
        
        // Single query by madarsaId to avoid composite index requirements
        const allAttendancesQ = query(
          collection(db, "attendances"),
          where("madarsaId", "==", madarsaId)
        );
        
        const allAttendancesSnap = await getDocs(allAttendancesQ);
        const statsObj = {};
        let todayAttendanceDoc = null;
        
        const pastDocs = [];
        
        allAttendancesSnap.forEach(docSnap => {
          const dData = docSnap.data();
          
          // Only process records for the currently selected class
          if (dData.classId !== selectedClass) return;

          // Check if this is today's attendance document
          if (dData.attendanceDate === selectedDate) {
            todayAttendanceDoc = { id: docSnap.id, ...dData };
            return; // Don't add today's marks to historical stats
          }

          pastDocs.push(dData);
          if (dData.records && Array.isArray(dData.records)) {
            dData.records.forEach(r => {
              if (r.status === "Present") {
                statsObj[r.studentId] = (statsObj[r.studentId] || 0) + 1;
              }
            });
          }
        });
        
        // Sort past docs descending by date
        pastDocs.sort((a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate));
        
        const streaksObj = {};
        students.filter(s => s.classLevel === selectedClass).forEach(student => {
           let streak = 0;
           let streakBroken = false;
           pastDocs.forEach(dData => {
              const record = dData.records?.find(r => r.studentId === student.id);
              if (record) {
                 if (record.status === "Present") {
                    streakBroken = true;
                 } else if (record.status === "Absent" && !streakBroken) {
                    streak++;
                 }
              }
           });
           streaksObj[student.id] = streak;
        });

        setAbsentStreaks(streaksObj);
        setStudentStats(statsObj);

        if (todayAttendanceDoc) {
          // Attendance exists for this class and date
          setAttendanceExists(true);
          setExistingAttendanceDocId(todayAttendanceDoc.id);
          
          // Load records
          const loadedRecords = {};
          const loadedReasons = {};
          if (todayAttendanceDoc.records && Array.isArray(todayAttendanceDoc.records)) {
            todayAttendanceDoc.records.forEach(record => {
              loadedRecords[record.studentId] = record.status;
              if (record.reason) {
                 loadedReasons[record.studentId] = record.reason;
              }
            });
          }
          setAbsentReasons(loadedReasons);
          
          // Default missing students to Absent (or Present if preferred, but Absent is safer)
          const classStudents = students.filter(s => s.classLevel === selectedClass);
          const finalRecords = { ...loadedRecords };
          classStudents.forEach(student => {
            if (finalRecords[student.id] === undefined) {
              finalRecords[student.id] = "Present"; 
            }
          });
          
          setAttendanceRecords(finalRecords);
          toast.info("Attendance already marked for this date. Records loaded.");
        } else {
          // No attendance exists
          setAttendanceExists(false);
          setExistingAttendanceDocId(null);
          
          // Initialize all as Present
          const classStudents = students.filter(s => s.classLevel === selectedClass);
          const initialRecords = {};
          classStudents.forEach(student => {
            initialRecords[student.id] = "Present";
          });
          setAttendanceRecords(initialRecords);
        }
      } catch (error) {
        console.error("Error checking attendance:", error);
        toast.error("Failed to check existing attendance");
      } finally {
        setLoading(false);
      }
    };

    checkExistingAttendance();
  }, [selectedClass, selectedDate, students, userData]);

  const classStudents = useMemo(() => {
    return students.filter(s => {
      const sClass = s.classLevel ? String(s.classLevel).trim() : "";
      const normClass = sClass.toUpperCase() === "UKG" ? "UKG" : sClass;
      return normClass === selectedClass;
    });
  }, [students, selectedClass]);

  // Filtered class students based on search and gender
  const filteredClassStudents = useMemo(() => {
    let list = classStudents;
    if (genderFilter !== "all") {
      list = list.filter(s => (s.gender || "").toLowerCase() === genderFilter.toLowerCase());
    }
    if (!searchTerm) return list;
    const lowerSearch = searchTerm.toLowerCase();
    return list.filter(s => 
      s.fullName?.toLowerCase().includes(lowerSearch) ||
      s.mid?.toLowerCase().includes(lowerSearch) ||
      s.admissionNumber?.toLowerCase().includes(lowerSearch)
    );
  }, [classStudents, searchTerm, genderFilter]);

  // Dashboard Stats
  const stats = useMemo(() => {
    const total = filteredClassStudents.length;
    let present = 0;
    let absent = 0;
    
    filteredClassStudents.forEach(s => {
      if (attendanceRecords[s.id] === "Present") present++;
      if (attendanceRecords[s.id] === "Absent") absent++;
    });
    
    const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0;
    
    return { total, present, absent, percentage };
  }, [filteredClassStudents, attendanceRecords]);

  const toggleAttendance = (studentId, status) => {
    if (status === "Absent" && absentStreaks[studentId] >= 2) {
      const student = classStudents.find(s => s.id === studentId);
      setCurrentReasonStudent(student);
      setTempSingleReason(absentReasons[studentId] || "");
      setSingleReasonModalOpen(true);
      return; 
    }
    
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSingleReasonSubmit = () => {
    if (!tempSingleReason.trim()) {
      toast.error("Reason is required.");
      return;
    }
    setAbsentReasons(prev => ({ ...prev, [currentReasonStudent.id]: tempSingleReason }));
    setAttendanceRecords(prev => ({ ...prev, [currentReasonStudent.id]: "Absent" }));
    setSingleReasonModalOpen(false);
  };

  const markAll = (status) => {
    const newRecords = { ...attendanceRecords };
    filteredClassStudents.forEach(s => {
      newRecords[s.id] = status;
    });
    setAttendanceRecords(newRecords);
  };

  const saveAttendance = async (overrideMissingReasons = false) => {
    if (!selectedClass || !selectedDate) {
      toast.error("Please select a class and date");
      return;
    }
    
    if (classStudents.length === 0) {
      toast.error("No students found in this class");
      return;
    }

    if (!overrideMissingReasons) {
      const missing = classStudents.filter(s => 
        attendanceRecords[s.id] === "Absent" && 
        absentStreaks[s.id] >= 2 && 
        !absentReasons[s.id]
      );
      if (missing.length > 0) {
        setMissingReasonStudents(missing);
        setReasonModalOpen(true);
        return;
      }
    }

    try {
      setSaving(true);
      setReasonModalOpen(false);
      const batch = writeBatch(db);
      
      const teacherId = userData?.uid || userData?.teacherId || "unknown";
      const teacherName = userData?.fullName || userData?.name || "Teacher";
      const madarsaId = userData?.madarsaId || "madarsa-001";
      
      // Prepare records array
      const recordsToSave = classStudents.map(student => ({
        studentId: student.id,
        midNumber: student.mid || student.admissionNumber || "N/A",
        studentName: student.fullName || student.name || "N/A",
        gender: student.gender || "N/A",
        status: attendanceRecords[student.id] || "Absent",
        reason: (attendanceRecords[student.id] === "Absent" && absentStreaks[student.id] >= 2) ? (absentReasons[student.id] || "") : ""
      }));

      const attendanceData = {
        madarsaId,
        classId: selectedClass,
        className: `Class ${selectedClass}`,
        attendanceDate: selectedDate,
        teacherId,
        teacherName,
        totalStudents: classStudents.length,
        presentCount: classStudents.filter(s => attendanceRecords[s.id] === "Present").length,
        absentCount: classStudents.filter(s => attendanceRecords[s.id] === "Absent").length,
        records: recordsToSave,
        updatedAt: Timestamp.now()
      };

      let docRefId = existingAttendanceDocId;
      
      if (attendanceExists && existingAttendanceDocId) {
        // Update existing
        const docRef = doc(db, "attendances", existingAttendanceDocId);
        batch.update(docRef, attendanceData);
      } else {
        // Create new
        const newDocRef = doc(collection(db, "attendances"));
        docRefId = newDocRef.id;
        attendanceData.createdAt = Timestamp.now();
        batch.set(newDocRef, attendanceData);
      }

      // Add audit log
      const auditLogRef = doc(collection(db, "attendance_audit_logs"));
      batch.set(auditLogRef, {
        action: attendanceExists ? "Updated Attendance" : "Marked Attendance",
        attendanceId: docRefId,
        teacherId,
        teacherName,
        classId: selectedClass,
        className: `Class ${selectedClass}`,
        date: selectedDate,
        time: new Date().toLocaleTimeString(),
        timestamp: Timestamp.now()
      });

      await batch.commit();
      
      toast.success(attendanceExists ? "Attendance updated successfully" : "Attendance marked successfully");
      setAttendanceExists(true);
      setExistingAttendanceDocId(docRefId);
      
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  // Fetch History
  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      let madarsaId = userData?.madarsaId || "madarsa-001";
      
      const historyQ = query(
        collection(db, "attendances"),
        where("madarsaId", "==", madarsaId)
      );
      
      const snap = await getDocs(historyQ);
      const fetchedHistory = [];
      
      snap.forEach(doc => {
        const data = doc.data();
        // Client-side date filtering to bypass composite index building time
        if (data.attendanceDate >= historyFilters.fromDate && data.attendanceDate <= historyFilters.toDate) {
          fetchedHistory.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      // Client-side filtering for class
      let filtered = fetchedHistory;
      if (historyFilters.classLevel !== "all") {
        filtered = filtered.filter(h => h.classId === historyFilters.classLevel);
      }
      
      // Sort by date descending
      filtered.sort((a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate));
      
      setHistoryRecords(filtered);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Failed to load attendance history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history" && userData) {
      fetchHistory();
    }
  }, [activeTab, historyFilters.fromDate, historyFilters.toDate, historyFilters.classLevel, userData]);

  const getFilteredHistoryDetails = () => {
    let details = [];
    historyRecords.forEach(record => {
      record.records.forEach(studentRecord => {
        // Filter by status
        if (historyFilters.status !== "all" && studentRecord.status !== historyFilters.status) {
          return;
        }
        
        // Filter by search
        if (historyFilters.search) {
          const lowerSearch = historyFilters.search.toLowerCase();
          if (!studentRecord.studentName.toLowerCase().includes(lowerSearch) && 
              !studentRecord.midNumber.toLowerCase().includes(lowerSearch)) {
            return;
          }
        }
        
        details.push({
          date: record.attendanceDate,
          className: record.className,
          teacherName: record.teacherName,
          ...studentRecord
        });
      });
    });
    
    // Sort details by date desc
    return details.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const exportHistoryCSV = () => {
    const details = getFilteredHistoryDetails();
    if (details.length === 0) {
      toast.info("No records to export");
      return;
    }
    
    const headers = ["Date", "MID Number", "Student Name", "Class", "Status", "Marked By"];
    const rows = details.map(d => [
      d.date,
      d.midNumber,
      d.studentName,
      d.className,
      d.status,
      d.teacherName
    ]);
    
    const csvContent = [headers, ...rows]
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");
      
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance_history_${historyFilters.fromDate}_to_${historyFilters.toDate}.csv`;
    link.click();
  };

  const exportHistoryPDF = () => {
    const details = getFilteredHistoryDetails();
    if (details.length === 0) {
      toast.info("No records to export");
      return;
    }
    
    const doc = new jsPDF();
    doc.text(`Attendance History (${historyFilters.fromDate} to ${historyFilters.toDate})`, 14, 15);
    
    const tableColumn = ["Date", "MID Number", "Student Name", "Class", "Status", "Marked By"];
    const tableRows = details.map(d => [
      d.date,
      d.midNumber,
      d.studentName,
      d.className,
      d.status,
      d.teacherName
    ]);
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 22,
      theme: "striped",
    });
    
    doc.save(`attendance_history_${historyFilters.fromDate}_to_${historyFilters.toDate}.pdf`);
  };

  if (!userData) {
    return null;
  }

  return (
    <ProtectedRoute requiredRole="teacher">
      <Layout>
        <div className="space-y-6 md:space-y-8 px-4 md:px-0">
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center">
                <ClipboardList className="mr-3 h-8 w-8 text-teal-600" />
                Attendance Module
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                Manage and track daily student attendance
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("mark")}
              className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                activeTab === "mark" ? "text-teal-600" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Mark Attendance
              {activeTab === "mark" && (
                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-teal-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                activeTab === "history" ? "text-teal-600" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Attendance History
              {activeTab === "history" && (
                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-teal-600" />
              )}
            </button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {activeTab === "mark" && (
            <div className="space-y-6">
              {/* Controls */}
              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Class</label>
                      <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Class" />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-white">
                          {classLevels.map((level) => (
                            <SelectItem key={level} value={level}>
                              {["LKG", "UKG"].includes(String(level).toUpperCase()) ? String(level).toUpperCase() : `Class ${level}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Gender Filter</label>
                      <Select value={genderFilter} onValueChange={setGenderFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-white">
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="text"
                          readOnly
                          value={new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          className="pl-10 bg-gray-50 text-gray-600"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {selectedClass ? (
                <>
                  {/* Dashboard Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm font-medium text-gray-500">Total Students</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm font-medium text-gray-500">Present</p>
                        <p className="text-2xl font-bold text-green-600">{stats.present}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm font-medium text-gray-500">Absent</p>
                        <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm font-medium text-gray-500">Attendance %</p>
                        <p className="text-2xl font-bold text-teal-600">{stats.percentage}%</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Attendance Table */}
                  <Card>
                    <CardHeader className="space-y-4 p-4 md:p-6 border-b border-gray-100">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                        <div className="space-y-3">
                          <div>
                            <CardTitle className="text-xl text-gray-900">Class {selectedClass} Attendance</CardTitle>
                            <CardDescription className="mt-1">
                              {attendanceExists 
                                ? <span className="text-teal-600 font-medium flex items-center"><CheckCircle2 className="w-4 h-4 mr-1"/> Attendance recorded for {selectedDate}</span>
                                : "Mark attendance for today"}
                            </CardDescription>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                            <span className="bg-teal-50 text-teal-700 px-3 py-1.5 rounded-full border border-teal-200 shadow-sm flex items-center">
                              Working Days: {settings.totalWorkingDays}
                            </span>
                            <span className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200 shadow-sm flex items-center">
                              Req. Present: {settings.requiredPresentDays}
                            </span>
                            <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-200 shadow-sm flex items-center">
                              Holidays: {settings.totalHolidays}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:items-end gap-3 w-full lg:w-auto">
                          <div className="flex flex-wrap lg:justify-end gap-2 w-full lg:w-auto">
                            <Button 
                              variant="outline" size="sm"
                              onClick={() => markAll("Present")}
                              className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 shadow-sm flex-1 sm:flex-none"
                            >
                              <CheckCircle2 className="mr-1.5 h-4 w-4" />
                              Mark All Present
                            </Button>
                            <Button 
                              variant="outline" size="sm"
                              onClick={() => markAll("Absent")}
                              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 shadow-sm flex-1 sm:flex-none"
                            >
                              <XCircle className="mr-1.5 h-4 w-4" />
                              Mark All Absent
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => saveAttendance()} 
                              disabled={saving}
                              className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm flex-1 sm:flex-none"
                            >
                              <Save className="mr-1.5 h-4 w-4" />
                              {saving ? "Saving..." : (attendanceExists ? "Update" : "Save")}
                            </Button>
                          </div>
                          
                          <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              placeholder="Search student..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-9 h-9 text-sm w-full bg-gray-50 focus:bg-white transition-colors"
                            />
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-0">
                      {loading ? (
                        <div className="flex justify-center py-12">
                          <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : filteredClassStudents.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          {searchTerm ? "No students found matching your search." : "No active students in this class."}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="bg-gray-50">
                              <TableRow>
                                <TableHead className="hidden md:table-cell w-[100px]">MID / Adm No</TableHead>
                                <TableHead>Student Name</TableHead>
                                <TableHead className="w-[100px] md:w-[150px] text-center px-1 md:px-4">Att.</TableHead>
                                <TableHead className="text-center w-[160px] md:w-[250px] px-1 md:px-4">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredClassStudents.map((student) => {
                                const status = attendanceRecords[student.id] || "Absent";
                                return (
                                  <TableRow key={student.id} className="hover:bg-gray-50">
                                    <TableCell className="hidden md:table-cell font-medium text-gray-600">
                                      {student.mid || student.admissionNumber || "N/A"}
                                    </TableCell>
                                    <TableCell className="font-semibold text-gray-900 px-2 md:px-4 text-sm md:text-base">
                                      {student.fullName || student.name}
                                    </TableCell>
                                    <TableCell className="text-center font-medium px-1 md:px-4">
                                      {(() => {
                                        const presentCount = attendanceExists
                                          ? (status === "Present" ? 1 : 0)
                                          : 0;
                                        const percentage = ((presentCount / settings.totalWorkingDays) * 100).toFixed(1);
                                        const isEligible = presentCount >= settings.requiredPresentDays;
                                        return (
                                          <div className="flex flex-col items-center">
                                            <span className={`text-sm md:text-base font-bold ${isEligible ? "text-green-600" : "text-amber-600"} whitespace-nowrap`}>
                                              {presentCount} / {settings.totalWorkingDays}
                                            </span>
                                            <span className="text-[10px] md:text-xs text-gray-500">
                                              ({percentage}%)
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </TableCell>
                                    <TableCell className="px-1 md:px-4">
                                      <div className="flex justify-center space-x-1 md:space-x-2">
                                        <button
                                          onClick={() => toggleAttendance(student.id, "Present")}
                                          className={`flex items-center justify-center px-2 py-1 md:px-3 md:py-1.5 rounded-md text-[10px] md:text-sm font-medium transition-colors ${
                                            status === "Present"
                                              ? "bg-green-100 text-green-800 border border-green-200"
                                              : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
                                          }`}
                                        >
                                          <CheckCircle2 className={`mr-1 h-3 w-3 md:h-4 md:w-4 ${status === "Present" ? "text-green-600" : ""}`} />
                                          <span>Present</span>
                                        </button>
                                        <button
                                          onClick={() => toggleAttendance(student.id, "Absent")}
                                          className={`flex items-center justify-center px-2 py-1 md:px-3 md:py-1.5 rounded-md text-[10px] md:text-sm font-medium transition-colors ${
                                            status === "Absent"
                                              ? "bg-red-100 text-red-800 border border-red-200"
                                              : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
                                          }`}
                                        >
                                          <XCircle className={`mr-1 h-3 w-3 md:h-4 md:w-4 ${status === "Absent" ? "text-red-600" : ""}`} />
                                          <span>Absent</span>
                                        </button>
                                      </div>
                                      {status === "Absent" && absentStreaks[student.id] >= 2 && (
                                        <div className="mt-3 flex flex-col items-center justify-center p-2 bg-red-50/50 border border-red-100 rounded-lg w-full max-w-[220px] mx-auto">
                                          <span className="text-[10px] uppercase tracking-wider text-red-500 font-bold mb-1.5">3+ Days Absent Streak</span>
                                          {absentReasons[student.id] ? (
                                            <div className="flex items-center justify-between w-full bg-white px-2.5 py-1.5 rounded-md border border-red-100 shadow-sm">
                                               <span className="truncate max-w-[130px] font-medium text-xs text-gray-800" title={absentReasons[student.id]}>{absentReasons[student.id]}</span>
                                               <button onClick={() => {
                                                  setCurrentReasonStudent(student);
                                                  setTempSingleReason(absentReasons[student.id] || "");
                                                  setSingleReasonModalOpen(true);
                                               }} className="text-blue-600 hover:text-blue-800 text-[11px] ml-2 font-bold px-1 py-0.5 rounded hover:bg-blue-50 transition-colors">Edit</button>
                                            </div>
                                          ) : (
                                            <span className="text-red-600 text-xs font-semibold animate-pulse bg-red-100 px-2 py-1 rounded-md">Reason Missing!</span>
                                          )}
                                        </div>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mb-4">
                    <Users className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-medium text-gray-900">Select a Class</h3>
                  <p className="text-gray-500 mt-2 max-w-md mx-auto">
                    Choose a class from the dropdown above to view students and mark their attendance.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">From Date</label>
                      <Input
                        type="date"
                        value={historyFilters.fromDate}
                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">To Date</label>
                      <Input
                        type="date"
                        value={historyFilters.toDate}
                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, toDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Class</label>
                      <Select 
                        value={historyFilters.classLevel} 
                        onValueChange={(val) => setHistoryFilters(prev => ({ ...prev, classLevel: val }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Classes" />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-white">
                          <SelectItem value="all">All Classes</SelectItem>
                          {classLevels.map((level) => (
                            <SelectItem key={level} value={level}>
                              Class {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Status</label>
                      <Select 
                        value={historyFilters.status} 
                        onValueChange={(val) => setHistoryFilters(prev => ({ ...prev, status: val }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-white">
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="Present">Present Only</SelectItem>
                          <SelectItem value="Absent">Absent Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Search</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Name / MID..."
                          value={historyFilters.search}
                          onChange={(e) => setHistoryFilters(prev => ({ ...prev, search: e.target.value }))}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4 space-x-2">
                    <Button onClick={exportHistoryCSV} variant="outline" className="border-gray-200">
                      <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                      Export CSV
                    </Button>
                    <Button onClick={exportHistoryPDF} variant="outline" className="border-gray-200">
                      <FileText className="mr-2 h-4 w-4 text-red-600" />
                      Export PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Attendance Records</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {historyLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-gray-50">
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>MID / Adm No</TableHead>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Marked By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getFilteredHistoryDetails().length > 0 ? (
                            getFilteredHistoryDetails().map((record, index) => (
                              <TableRow key={`${record.studentId}-${record.date}-${index}`} className="hover:bg-gray-50">
                                <TableCell className="whitespace-nowrap font-medium">{record.date}</TableCell>
                                <TableCell className="text-gray-600">{record.midNumber}</TableCell>
                                <TableCell className="font-semibold text-gray-900">{record.studentName}</TableCell>
                                <TableCell>{record.className}</TableCell>
                                <TableCell>
                                  {record.status === "Present" ? (
                                    <Badge className="bg-green-100 text-green-800 border-green-200">Present</Badge>
                                  ) : (
                                    <Badge className="bg-red-100 text-red-800 border-red-200">Absent</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-gray-500">{record.teacherName}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                No attendance records found for the selected filters.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

        </div>
        {/* Missing Reasons Modal */}
        <Dialog open={reasonModalOpen} onOpenChange={setReasonModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <Alert className="h-5 w-5 border-0 p-0 text-red-600" />
                Action Required: Absent Reasons
              </DialogTitle>
              <DialogDescription>
                The following students have been absent for 3 or more continuous days. Please provide a reason for their absence before saving.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 my-4 max-h-[60vh] overflow-y-auto">
              {missingReasonStudents.map(student => (
                <div key={student.id} className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">{student.fullName} ({student.admissionNumber || student.mid})</label>
                  <Input
                    autoFocus
                    placeholder="Enter reason..."
                    value={absentReasons[student.id] || ""}
                    onChange={(e) => setAbsentReasons(prev => ({...prev, [student.id]: e.target.value}))}
                    className={!absentReasons[student.id] ? "border-red-400" : ""}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setReasonModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700" 
                onClick={() => {
                  if (missingReasonStudents.every(s => absentReasons[s.id]?.trim())) {
                    saveAttendance(true);
                  } else {
                    toast.error("Please enter reasons for all continuous absent students.");
                  }
                }}
              >
                Confirm & Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Single Reason Modal */}
        <Dialog open={singleReasonModalOpen} onOpenChange={(open) => {
          if (!open && currentReasonStudent && !absentReasons[currentReasonStudent.id]) {
              // Revert back to Present if closed without saving reason
              setAttendanceRecords(prev => ({
                ...prev,
                [currentReasonStudent.id]: "Present"
              }));
          }
          setSingleReasonModalOpen(open);
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Alert className="h-5 w-5 border-0 p-0 text-red-600" />
                Reason for Continuous Absence
              </DialogTitle>
              <DialogDescription>
                {currentReasonStudent?.fullName} has been absent for 3 or more continuous days. Please provide a reason to mark them absent today.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 my-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Reason</label>
                <Input
                  autoFocus
                  placeholder="Enter reason..."
                  value={tempSingleReason}
                  onChange={(e) => setTempSingleReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSingleReasonSubmit();
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => {
                  if (!absentReasons[currentReasonStudent?.id]) {
                    setAttendanceRecords(prev => ({
                      ...prev,
                      [currentReasonStudent?.id]: "Present"
                    }));
                  }
                  setSingleReasonModalOpen(false);
              }}>
                Cancel
              </Button>
              <Button 
                className="bg-red-600 hover:bg-red-700" 
                onClick={handleSingleReasonSubmit}
              >
                Confirm Absent
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  );
}
