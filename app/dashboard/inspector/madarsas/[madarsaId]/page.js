"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import InspectorLayout from "@/components/InspectorLayout";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building,
  Users,
  GraduationCap,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Calendar,
  FileText,
  Eye,
  Search,
  Filter,
  SortAsc,
  User,
  BookOpen,
  Clock,
  UserCheck,
  Award,
  Download,
  Upload,
  FolderOpen,
  Home
} from "lucide-react";
import useAuthStore from "@/lib/authStore";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export default function MadarsaInspectionPage() {
  const params = useParams();
  const router = useRouter();
  const { user, userData } = useAuthStore();
  const [madarsa, setMadarsa] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("tab") || "overview";
    }
    return "overview";
  });

  // Search and filter states
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [teacherSearchTerm, setTeacherSearchTerm] = useState("");
  const [studentSortBy, setStudentSortBy] = useState("name");
  const [teacherSortBy, setTeacherSortBy] = useState("name");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");

  // Modal states
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [exportingStudentPdf, setExportingStudentPdf] = useState(false);
  const [exportingStudentExcel, setExportingStudentExcel] = useState(false);

  // Records states
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [uploadingRecord, setUploadingRecord] = useState(false);
  const fileInputRef = useRef(null);

  const madarsaId = String(params.madarsaId || "").trim();
  const assignedMadarsaIds = useMemo(
    () =>
      Array.isArray(userData?.assignedMadarsas)
        ? userData.assignedMadarsas
            .map((id) => String(id ?? "").trim())
            .filter(Boolean)
        : [],
    [userData?.assignedMadarsas],
  );

  const assignedDistricts = useMemo(
    () =>
      [
        ...(Array.isArray(userData?.assignedDistricts) ? userData.assignedDistricts : []),
        ...(userData?.assignedDistrict ? [userData.assignedDistrict] : []),
      ]
        .map((d) => String(d || "").trim().toLowerCase())
        .filter(Boolean),
    [userData?.assignedDistricts, userData?.assignedDistrict],
  );

  const normalizeValue = (value) => String(value ?? "").trim();

  useEffect(() => {
    const fetchMadarsaData = async () => {
      try {
        setLoading(true);

        // Fetch madarsa details, supporting both canonical madarsaId and Firestore doc id routes
        let madarsaData = null;

        const madarsaQuery = query(
          collection(db, "madarsas"),
          where("madarsaId", "==", madarsaId),
        );
        const madarsaSnapshot = await getDocs(madarsaQuery);

        if (!madarsaSnapshot.empty) {
          madarsaData = {
            id: madarsaSnapshot.docs[0].id,
            ...madarsaSnapshot.docs[0].data(),
          };
        } else {
          const madarsaDocSnapshot = await getDoc(
            doc(db, "madarsas", madarsaId),
          );
          if (madarsaDocSnapshot.exists()) {
            madarsaData = {
              id: madarsaDocSnapshot.id,
              ...madarsaDocSnapshot.data(),
            };
          }
        }

        if (!madarsaData) {
          router.replace("/dashboard/inspector/madarsas");
          return;
        }

        // Check if user has access to this madarsa
        if (assignedMadarsaIds.length > 0) {
          const allowed =
            assignedMadarsaIds.includes(String(madarsaId || "").trim()) ||
            assignedMadarsaIds.includes(String(madarsaData.id || "").trim()) ||
            assignedMadarsaIds.includes(
              String(madarsaData.madarsaId || "").trim(),
            );

          if (!allowed) {
            router.replace("/dashboard/inspector/madarsas");
            return;
          }
        } else if (assignedDistricts.length > 0) {
          // District-based inspector: verify the madarsa belongs to an assigned district
          const madarsaDistrict = String(
            madarsaData.district || madarsaData.districtName || madarsaData.district_name || ""
          ).trim().toLowerCase();

          const allowed = assignedDistricts.some((d) => d === madarsaDistrict);
          if (!allowed) {
            router.replace("/dashboard/inspector/madarsas");
            return;
          }
        }

        setMadarsa(madarsaData);
        if (madarsaData.district || madarsaData.districtName || madarsaData.district_name) {
          // If a district active state needs to be managed, it should be done here.
          // setActiveInspectorDistrict is not defined in useAuthStore currently.
        }

        const baseCandidateIds = new Set([
          normalizeValue(madarsaId),
          normalizeValue(madarsaData?.id),
          normalizeValue(madarsaData?.madarsaId),
        ].filter(Boolean));

        const expandedStringIds = new Set(baseCandidateIds);
        baseCandidateIds.forEach((idStr) => {
          const numericStr = idStr.replace(/^[a-zA-Z]+-/, "");
          if (numericStr) {
            expandedStringIds.add(numericStr);
            expandedStringIds.add(`mid-${numericStr}`);
            expandedStringIds.add(`mld-${numericStr}`);
            expandedStringIds.add(`MID-${numericStr}`);
          }
        });
        const finalStringIds = Array.from(expandedStringIds);

        const numericCandidates = finalStringIds
          .map((id) => {
            const n = Number(id);
            return Number.isFinite(n) && n > 0 ? n : null;
          })
          .filter(Boolean);

        const buildSnapPromises = (colName, fieldName = "madarsaId") => [
          ...finalStringIds.map((id) =>
            getDocs(query(collection(db, colName), where(fieldName, "==", id)))
          ),
          ...numericCandidates.map((id) =>
            getDocs(query(collection(db, colName), where(fieldName, "==", id)))
          ),
        ];

        const results = await Promise.allSettled([
          ...buildSnapPromises("students", "madarsaId"),
          ...buildSnapPromises("students", "madrasaId"),
          ...buildSnapPromises("teachers", "madarsaId"),
          ...buildSnapPromises("teachers", "madrasaId"),
        ]);

        const uniqueStudents = new Map();
        const uniqueTeachers = new Map();

        let index = 0;
        const totalStudentPromises = buildSnapPromises("students", "madarsaId").length * 2;
        
        results.forEach((res) => {
          if (res.status === "fulfilled" && res.value && res.value.docs) {
            const isStudent = index < totalStudentPromises;
            res.value.docs.forEach((d) => {
              if (isStudent) {
                uniqueStudents.set(d.id, { id: d.id, ...d.data() });
              } else {
                uniqueTeachers.set(d.id, { id: d.id, ...d.data() });
              }
            });
          }
          index++;
        });

        setStudents(
          Array.from(uniqueStudents.values()).filter(
            (s) => !s.deleted && s.status !== "suspended"
          )
        );
        setTeachers(Array.from(uniqueTeachers.values()));

        setLoading(false);
      } catch (error) {
        console.error("Error fetching madarsa data:", error);
        setLoading(false);
      }
    };

    if (user && userData && madarsaId) {
      fetchMadarsaData();
    }
  }, [assignedMadarsaIds, assignedDistricts, user, userData, madarsaId, router]);

  // Fetch inspection reports for this madarsa when madarsa is loaded
  useEffect(() => {
    if (!madarsa) return;

    const fetchMadarsaReports = async () => {
      setReportsLoading(true);
      try {
        const q1 = query(
          collection(db, "inspections"),
          where("selectedMadarsaId", "==", madarsa.madarsaId),
        );
        const snap1 = await getDocs(q1);
        const q2 = query(
          collection(db, "inspections"),
          where("madarsaId", "==", madarsa.madarsaId),
        );
        const snap2 = await getDocs(q2);

        const map = new Map();
        snap1.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        snap2.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));

        const combined = Array.from(map.values()).sort((a, b) => {
          const ta =
            a.createdAt && a.createdAt.toDate
              ? a.createdAt.toDate().getTime()
              : 0;
          const tb =
            b.createdAt && b.createdAt.toDate
              ? b.createdAt.toDate().getTime()
              : 0;
          return tb - ta;
        });

        setReports(combined);
        // Auto-scope records to this madarsa's district + mekhala (system-driven, no user filters)
        const madarsaDistrict = String(
          madarsa.district || madarsa.districtName || madarsa.district_name || ""
        ).trim().toLowerCase();
        const madarsaMekhala = String(
          madarsa.mekhala || madarsa.mekhalaName || madarsa.mekhaala || madarsa.mekhala_name || ""
        ).trim().toLowerCase();

        const fetchedRecords = combined.filter(d => {
          const isCompletedRecord = d.isRecord === true || d.status === "approved" || d.status === "completed" || d.status === "COMPLETED" || d.status === "APPROVED";
          if (!isCompletedRecord) return false;
          // If the record has district/mekhala, verify it matches this madarsa
          if (d.district && madarsaDistrict) {
            const recDistrict = String(d.district || "").trim().toLowerCase();
            if (recDistrict && recDistrict !== madarsaDistrict) return false;
          }
          if (d.mekhala && madarsaMekhala) {
            const recMekhala = String(d.mekhala || "").trim().toLowerCase();
            if (recMekhala && recMekhala !== madarsaMekhala) return false;
          }
          return true;
        });
        fetchedRecords.sort((a, b) => {
          const ta = a.uploadedAt?.toDate ? a.uploadedAt.toDate().getTime() : (a.submittedAt?.toDate ? a.submittedAt.toDate().getTime() : 0);
          const tb = b.uploadedAt?.toDate ? b.uploadedAt.toDate().getTime() : (b.submittedAt?.toDate ? b.submittedAt.toDate().getTime() : 0);
          return tb - ta;
        });
        setRecords(fetchedRecords);
        
      } catch (error) {
        console.error("Error fetching madarsa reports:", error);
      } finally {
        setReportsLoading(false);
        setRecordsLoading(false);
      }
    };

    fetchMadarsaReports();
  }, [madarsa]);

  // Get unique classes and subjects for filters
  const uniqueClasses = [
    ...new Set(students.map((s) => s.classLevel).filter(Boolean)),
  ].sort();
  const uniqueSubjects = [
    ...new Set(teachers.map((t) => t.subject).filter(Boolean)),
  ].sort();

  // Filter and sort students
  const filteredAndSortedStudents = students
    .filter((student) => {
      const matchesSearch =
        normalizeValue(student.fullName)
          .toLowerCase()
          .includes(studentSearchTerm.toLowerCase()) ||
        normalizeValue(student.admissionNumber)
          .toLowerCase()
          .includes(studentSearchTerm.toLowerCase()) ||
        normalizeValue(student.fatherName)
          .toLowerCase()
          .includes(studentSearchTerm.toLowerCase());
      const matchesClass =
        selectedClass === "all" || student.classLevel === selectedClass;
      const genderNorm = (student.gender || "").trim().toLowerCase();
      const matchesGender =
        selectedGender === "all" ||
        (selectedGender === "other"
          ? genderNorm !== "male" && genderNorm !== "female"
          : genderNorm === selectedGender);
      return matchesSearch && matchesClass && matchesGender;
    })
    .sort((a, b) => {
      switch (studentSortBy) {
        case "name":
          return (a.fullName || "").localeCompare(b.fullName || "");
        case "class":
          return (a.classLevel || "").localeCompare(b.classLevel || "");
        case "admission":
          return (a.admissionNumber || "").localeCompare(
            b.admissionNumber || "",
          );
        default:
          return 0;
      }
    });

  // Filter and sort teachers
  const filteredAndSortedTeachers = teachers
    .filter((teacher) => {
      const matchesSearch =
        normalizeValue(teacher.fullName || teacher.name)
          .toLowerCase()
          .includes(teacherSearchTerm.toLowerCase()) ||
        normalizeValue(teacher.teacherId || teacher.mhrId)
          .toLowerCase()
          .includes(teacherSearchTerm.toLowerCase()) ||
        normalizeValue(teacher.email)
          .toLowerCase()
          .includes(teacherSearchTerm.toLowerCase());
      const matchesSubject =
        selectedSubject === "all" || teacher.subject === selectedSubject;
      return matchesSearch && matchesSubject;
    })
    .sort((a, b) => {
      switch (teacherSortBy) {
        case "name":
          return (a.fullName || "").localeCompare(b.fullName || "");
        case "subject":
          return (a.subject || "").localeCompare(b.subject || "");
        case "experience":
          return (b.experience || 0) - (a.experience || 0);
        default:
          return 0;
      }
    });

  const normalizeGender = (value) =>
    (value || "").toString().trim().toLowerCase();

  const selectedClassLabel =
    selectedClass === "all" ? "All" : `Class ${selectedClass}`;
  const studentsTotalCount = filteredAndSortedStudents.length;
  const studentsMaleCount = filteredAndSortedStudents.filter(
    (s) => normalizeGender(s.gender) === "male",
  ).length;
  const studentsFemaleCount = filteredAndSortedStudents.filter(
    (s) => normalizeGender(s.gender) === "female",
  ).length;
  const studentsUnspecifiedCount = studentsTotalCount - studentsMaleCount - studentsFemaleCount;

  const selectedSubjectLabel =
    selectedSubject === "all" ? "All" : selectedSubject;
  const teachersTotalCount = filteredAndSortedTeachers.length;
  const teachersMaleCount = filteredAndSortedTeachers.filter(
    (t) => normalizeGender(t.gender || t.sex) === "male",
  ).length;
  const teachersFemaleCount = filteredAndSortedTeachers.filter(
    (t) => normalizeGender(t.gender || t.sex) === "female",
  ).length;
  const teachersUnspecifiedCount = teachersTotalCount - teachersMaleCount - teachersFemaleCount;

  const downloadStudentsPdf = async () => {
    setExportingStudentPdf(true);
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Students List — ${madarsa?.name || ""}`, 14, 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(
        `ID: ${params.madarsaId}   |   Total: ${students.length}   |   Male: ${students.filter((s) => (s.gender || "").toLowerCase() === "male").length}   |   Female: ${students.filter((s) => (s.gender || "").toLowerCase() === "female").length}   |   Unspecified: ${students.length - students.filter((s) => (s.gender || "").toLowerCase() === "male").length - students.filter((s) => (s.gender || "").toLowerCase() === "female").length}   |   Date: ${new Date().toLocaleDateString()}`,
        14,
        20,
      );
      doc.setTextColor(0);

      const rows = filteredAndSortedStudents.map((s, i) => [
        String(i + 1),
        s.fullName || "—",
        s.classLevel || "—",
        s.gender ? s.gender.charAt(0).toUpperCase() + s.gender.slice(1) : "—",
        s.admissionNumber || "—",
        s.dateOfBirth || "—",
        s.phone || s.mobileNumber || "—",
        s.fatherName || "—",
      ]);

      autoTable(doc, {
        startY: 26,
        head: [
          [
            "#",
            "Name",
            "Class",
            "Gender",
            "Admission No.",
            "DOB",
            "Phone",
            "Father Name",
          ],
        ],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
        headStyles: {
          fillColor: [0, 128, 128],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 8.5,
        },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 48 },
          2: { cellWidth: 18, halign: "center" },
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 38 },
          5: { cellWidth: 26, halign: "center" },
          6: { cellWidth: 28 },
          7: { cellWidth: 45 },
        },
        alternateRowStyles: { fillColor: [245, 250, 250] },
        margin: { left: 14, right: 14 },
      });

      doc.save(
        `students_${String(madarsa?.name || params.madarsaId).replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`,
      );
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Failed to download PDF");
    } finally {
      setExportingStudentPdf(false);
    }
  };

  const exportStudentsExcel = () => {
    setExportingStudentExcel(true);
    try {
      const rows = filteredAndSortedStudents.map((s, i) => ({
        "#": i + 1,
        Name: s.fullName || "-",
        Class: s.classLevel || "-",
        Gender: s.gender || "-",
        "Admission No.": s.admissionNumber || "-",
        DOB: s.dateOfBirth || "-",
        Phone: s.phone || s.mobileNumber || "-",
        "Father Name": s.fatherName || "-",
        Status: s.status || "-",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      XLSX.writeFile(
        wb,
        `students_${String(madarsa?.name || params.madarsaId).replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
      toast.success("Excel exported");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export Excel");
    } finally {
      setExportingStudentExcel(false);
    }
  };

  const openStudentModal = (student) => {
    setSelectedStudent(student);
    setStudentModalOpen(true);
  };

  const openTeacherModal = (teacher) => {
    setSelectedTeacher(teacher);
    setTeacherModalOpen(true);
  };

  const handleRecordUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !madarsa) return;

    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed for records.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error("File size must be less than 15MB");
      return;
    }

    setUploadingRecord(true);
    try {
      const timestamp = Date.now();
      const sanitizedName = String(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `madarsa_records/${madarsa.madarsaId}/${timestamp}_${sanitizedName}`;
      
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, file, { contentType: file.type });
      const downloadURL = await getDownloadURL(snapshot.ref);

      const recordData = {
        madarsaId: madarsa.madarsaId,
        isRecord: true,
        fileName: file.name,
        url: downloadURL,
        uploadedAt: new Date(),
        uploadedBy: user.uid,
        uploadedByName: userData?.name || "Inspector",
      };

      const { addDoc, collection } = await import("firebase/firestore");
      const docRef = await addDoc(collection(db, "inspections"), recordData);
      
      setRecords(prev => [{ id: docRef.id, ...recordData }, ...prev]);
      toast.success("Record uploaded successfully");
    } catch (error) {
      console.error("Error uploading record:", error);
      toast.error("Failed to upload record");
    } finally {
      setUploadingRecord(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <InspectorLayout>
        <div className="p-6">
          <div className="text-center py-8">Loading...</div>
        </div>
      </InspectorLayout>
    );
  }

  if (!madarsa) {
    return (
      <InspectorLayout>
        <div className="p-6">
          <div className="text-center py-8">
            <p className="text-gray-500">Madarsa not found</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/inspector">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Madarsas
              </Link>
            </Button>
          </div>
        </div>
      </InspectorLayout>
    );
  }

  return (
    <InspectorLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/inspector">
              <ArrowLeft className="h-4 w-4 " />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{madarsa.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{madarsa.madarsaId}</Badge>
              <Badge
                variant={madarsa.status === "active" ? "default" : "secondary"}
              >
                {madarsa.status}
              </Badge>
            </div>
          </div>
          <Button
            onClick={() =>
              router.push(
                `/dashboard/inspector/reports?madarsaId=${encodeURIComponent(params.madarsaId)}`,
              )
            }
          >
            <FileText className="h-4 w-4 mr-2" />
            Create Report
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">
              Students ({students.length})
            </TabsTrigger>
            <TabsTrigger value="teachers">
              Teachers ({teachers.length})
            </TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="records">Records</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-500 mt-1" />
                    <div>
                      <p className="font-medium">Address</p>
                      <p className="text-gray-600">{madarsa.address}</p>
                    </div>
                  </div>

                  {madarsa.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="font-medium">Phone</p>
                        <p className="text-gray-600">{madarsa.phone}</p>
                      </div>
                    </div>
                  )}

                  {madarsa.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="font-medium">Email</p>
                        <p className="text-gray-600">{madarsa.email}</p>
                      </div>
                    </div>
                  )}

                  {madarsa.established && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="font-medium">Established</p>
                        <p className="text-gray-600">{madarsa.established}</p>
                      </div>
                    </div>
                  )}

                  {madarsa.capacity && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="font-medium">Capacity</p>
                        <p className="text-gray-600">
                          {madarsa.capacity} students
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Administration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {madarsa.adminName && (
                    <div>
                      <p className="font-medium">Administrator</p>
                      <p className="text-gray-600">{madarsa.adminName}</p>
                    </div>
                  )}

                  {madarsa.adminEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="font-medium">Admin Email</p>
                        <p className="text-gray-600">{madarsa.adminEmail}</p>
                      </div>
                    </div>
                  )}

                  {madarsa.adminPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="font-medium">Admin Phone</p>
                        <p className="text-gray-600">{madarsa.adminPhone}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Students
                      </p>
                      <p className="text-3xl font-bold text-blue-600">
                        {students.length}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Teachers
                      </p>
                      <p className="text-3xl font-bold text-green-600">
                        {teachers.length}
                      </p>
                    </div>
                    <GraduationCap className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Capacity Usage
                      </p>
                      <p className="text-3xl font-bold text-purple-600">
                        {madarsa.capacity
                          ? Math.round(
                              (students.length / madarsa.capacity) * 100,
                            )
                          : 0}
                        %
                      </p>
                    </div>
                    <Building className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Description */}
            {madarsa.description && (
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{madarsa.description}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Students List
                    </CardTitle>
                    <CardDescription className="mt-1">
                      All students enrolled in {madarsa.name} (
                      {filteredAndSortedStudents.length} of {students.length})
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadStudentsPdf}
                      disabled={exportingStudentPdf || students.length === 0}
                      className="border-teal-600 text-teal-700 hover:bg-teal-600 hover:text-white transition-colors"
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      {exportingStudentPdf ? "Downloading..." : "Download PDF"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportStudentsExcel}
                      disabled={exportingStudentExcel || students.length === 0}
                      className="border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors"
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      {exportingStudentExcel ? "Exporting..." : "Export Excel"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search and Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search students by name, admission number, or father's name..."
                        value={studentSearchTerm}
                        onChange={(e) => setStudentSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={selectedClass}
                      onValueChange={setSelectedClass}
                    >
                      <SelectTrigger className="w-[150px] border-teal-200 hover:border-teal-300 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-teal-600 focus-visible:border-teal-600">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter by Class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {uniqueClasses.map((cls) => (
                          <SelectItem key={cls} value={cls}>
                            Class {cls}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={selectedGender}
                      onValueChange={setSelectedGender}
                    >
                      <SelectTrigger className="w-[150px] border-teal-200 hover:border-teal-300 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-teal-600 focus-visible:border-teal-600">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter by Gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Genders</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={studentSortBy}
                      onValueChange={setStudentSortBy}
                    >
                      <SelectTrigger className="w-[150px] border-teal-200 hover:border-teal-300 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-teal-600 focus-visible:border-teal-600">
                        <SortAsc className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Sort by Name</SelectItem>
                        <SelectItem value="class">Sort by Class</SelectItem>
                        <SelectItem value="admission">
                          Sort by Admission No.
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Highlighted Counts (dynamic based on filters) */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-xs text-gray-500">Class</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedClassLabel}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-xs text-gray-500">Total Students</p>
                    <p className="text-lg font-semibold text-teal-700">
                      {studentsTotalCount}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-xs text-gray-500">Male</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {studentsMaleCount}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-xs text-gray-500">Female</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {studentsFemaleCount}
                    </p>
                  </div>
                  {studentsUnspecifiedCount > 0 && (
                    <div className="p-3 rounded-lg border bg-gray-50">
                      <p className="text-xs text-gray-500">Unspecified</p>
                      <p className="text-lg font-semibold text-amber-600">
                        {studentsUnspecifiedCount}
                      </p>
                    </div>
                  )}
                </div>

                {filteredAndSortedStudents.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {students.length === 0
                        ? "No Students Enrolled"
                        : "No Students Found"}
                    </h3>
                    <p className="text-gray-600">
                      {students.length === 0
                        ? "No students have been enrolled in this madarsa yet."
                        : "Try adjusting your search or filter criteria."}
                    </p>
                    {(studentSearchTerm ||
                      selectedClass !== "all" ||
                      selectedGender !== "all") && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => {
                          setStudentSearchTerm("");
                          setSelectedClass("all");
                          setSelectedGender("all");
                        }}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">
                            Student Details
                          </TableHead>
                          <TableHead className="font-semibold">
                            Admission Info
                          </TableHead>
                          <TableHead className="font-semibold">Class</TableHead>
                          <TableHead className="font-semibold">
                            Contact
                          </TableHead>
                          <TableHead className="font-semibold">
                            Status
                          </TableHead>
                          <TableHead className="font-semibold text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedStudents.map((student) => (
                          <TableRow
                            key={student.id}
                            className="hover:bg-gray-50"
                          >
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-gray-900">
                                  {student.fullName}
                                </p>
                                {student.fatherName && (
                                  <p className="text-sm text-gray-500">
                                    S/O {student.fatherName}
                                  </p>
                                )}
                                {student.dateOfBirth && (
                                  <p className="text-xs text-gray-400">
                                    DOB:{" "}
                                    {new Date(
                                      student.dateOfBirth,
                                    ).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-blue-600">
                                  {student.admissionNumber}
                                </p>
                                {student.admissionDate && (
                                  <p className="text-xs text-gray-500">
                                    Admitted:{" "}
                                    {new Date(
                                      student.admissionDate,
                                    ).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700"
                              >
                                {student.classLevel || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {student.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-gray-400" />
                                    <p className="text-sm">{student.phone}</p>
                                  </div>
                                )}
                                {student.email && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3 text-gray-400" />
                                    <p className="text-sm text-gray-500">
                                      {student.email}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  student.status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  student.status === "active"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-600"
                                }
                              >
                                {student.status || "active"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openStudentModal(student)}
                                className="hover:bg-blue-50 hover:text-blue-600"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View More
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
          </TabsContent>

          <TabsContent value="teachers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Teachers List
                </CardTitle>
                <CardDescription>
                  All teachers working at {madarsa.name} (
                  {filteredAndSortedTeachers.length} of {teachers.length})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search and Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search teachers by name, employee ID, or email..."
                        value={teacherSearchTerm}
                        onChange={(e) => setTeacherSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={selectedSubject}
                      onValueChange={setSelectedSubject}
                    >
                      <SelectTrigger className="w-[150px] border-teal-200 hover:border-teal-300 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-teal-600 focus-visible:border-teal-600">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter by Subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        {uniqueSubjects.map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={teacherSortBy}
                      onValueChange={setTeacherSortBy}
                    >
                      <SelectTrigger className="w-[150px] border-teal-200 hover:border-teal-300 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-teal-600 focus-visible:border-teal-600">
                        <SortAsc className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Sort by Name</SelectItem>
                        <SelectItem value="subject">Sort by Subject</SelectItem>
                        <SelectItem value="experience">
                          Sort by Experience
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Highlighted Counts (dynamic based on filters) */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-xs text-gray-500">Subject</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedSubjectLabel}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-xs text-gray-500">Total Teachers</p>
                    <p className="text-lg font-semibold text-teal-700">
                      {teachersTotalCount}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-xs text-gray-500">Male</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {teachersMaleCount}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-xs text-gray-500">Female</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {teachersFemaleCount}
                    </p>
                  </div>
                  {teachersUnspecifiedCount > 0 && (
                    <div className="p-3 rounded-lg border bg-gray-50">
                      <p className="text-xs text-gray-500">Unspecified</p>
                      <p className="text-lg font-semibold text-amber-600">
                        {teachersUnspecifiedCount}
                      </p>
                    </div>
                  )}
                </div>

                {filteredAndSortedTeachers.length === 0 ? (
                  <div className="text-center py-12">
                    <GraduationCap className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {teachers.length === 0
                        ? "No Teachers Registered"
                        : "No Teachers Found"}
                    </h3>
                    <p className="text-gray-600">
                      {teachers.length === 0
                        ? "No teachers have been registered for this madarsa yet."
                        : "Try adjusting your search or filter criteria."}
                    </p>
                    {(teacherSearchTerm || selectedSubject !== "all") && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => {
                          setTeacherSearchTerm("");
                          setSelectedSubject("all");
                        }}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">
                            Teacher Details
                          </TableHead>
                          <TableHead className="font-semibold">
                            Msr ID
                          </TableHead>
                          <TableHead className="font-semibold">
                            Subject
                          </TableHead>
                          <TableHead className="font-semibold">
                            Experience
                          </TableHead>
                          <TableHead className="font-semibold">
                            Contact
                          </TableHead>
                          <TableHead className="font-semibold">
                            Status
                          </TableHead>
                          <TableHead className="font-semibold text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedTeachers.map((teacher) => (
                          <TableRow
                            key={teacher.id}
                            className="hover:bg-gray-50"
                          >
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-gray-900">
                                  {teacher.fullName || teacher.name}
                                </p>
                                {teacher.qualification && (
                                  <p className="text-sm text-gray-500">
                                    {teacher.qualification}
                                  </p>
                                )}
                                {teacher.specialization && (
                                  <p className="text-xs text-gray-400">
                                    {teacher.specialization}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-green-600">
                                  {teacher.teacherId || teacher.mhrId || "N/A"}
                                </p>
                                {teacher.joinDate && (
                                  <p className="text-xs text-gray-500">
                                    Joined:{" "}
                                    {new Date(
                                      teacher.joinDate,
                                    ).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="bg-green-50 text-green-700"
                              >
                                {teacher.subject || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-gray-400" />
                                <span className="text-sm">
                                  {teacher.experience
                                    ? `${teacher.experience} years`
                                    : "N/A"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {teacher.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-gray-400" />
                                    <p className="text-sm">{teacher.phone}</p>
                                  </div>
                                )}
                                {teacher.email && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3 text-gray-400" />
                                    <p className="text-sm text-gray-500">
                                      {teacher.email}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  teacher.status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  teacher.status === "active"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-600"
                                }
                              >
                                {teacher.status || "active"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openTeacherModal(teacher)}
                                className="hover:bg-green-50 hover:text-green-600"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View More
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
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Inspection Reports</CardTitle>
                <CardDescription>
                  Previous inspection reports for {madarsa.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="text-center py-8">Loading reports...</div>
                ) : reports.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No inspection reports yet</p>
                    <Button
                      className="mt-4"
                      onClick={() =>
                        router.push(
                          `/dashboard/inspector/reports?madarsaId=${encodeURIComponent(params.madarsaId)}`,
                        )
                      }
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Create First Report
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Report Title</TableHead>
                          <TableHead>Created Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {report.title ||
                                    `Inspection Report - ${report.selectedMadarsaId || report.madarsaId}`}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {report.inspectionDate
                                    ? new Date(
                                        report.inspectionDate,
                                      ).toLocaleDateString()
                                    : "N/A"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-500" />
                                {report.createdAt
                                  ?.toDate?.()
                                  ?.toLocaleDateString() || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  report.status === "draft"
                                    ? "secondary"
                                    : "default"
                                }
                              >
                                {report.status || "draft"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    (window.location.href = `/dashboard/inspector/inspections/${report.id}`)
                                  }
                                  title="View Report"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {(report.status === "draft" ||
                                  !report.status) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      (window.location.href = `/dashboard/inspector/inspections/create?draft=${report.id}`)
                                    }
                                    title="Edit Report"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                )}
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
          </TabsContent>

          <TabsContent value="records" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Records</CardTitle>
                  <CardDescription>
                    Official documents and records for this madarsa
                  </CardDescription>
                </div>
                <div>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleRecordUpload}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingRecord}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {uploadingRecord ? (
                      "Uploading..."
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Record
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recordsLoading ? (
                  <div className="text-center py-8">Loading records...</div>
                ) : records.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                    <FolderOpen className="h-12 w-12 text-gray-400 mb-3" />
                    <p>No records found for this madarsa</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {records.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {record.fileName || "Madarsa Record"}
                            </h4>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {record.uploadedAt?.toDate ? record.uploadedAt.toDate().toLocaleDateString() : (record.submittedAt?.toDate ? record.submittedAt.toDate().toLocaleDateString() : "")}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {record.uploadedByName || record.inspectorName || "Inspector"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={record.url || record.pdfUrl || record.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            View
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      {/* Student Detail Modal */}
        <Dialog open={studentModalOpen} onOpenChange={setStudentModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Student Details
              </DialogTitle>
              <DialogDescription>
                Complete information for {selectedStudent?.fullName}
              </DialogDescription>
            </DialogHeader>

            {selectedStudent && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Personal Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Personal Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Full Name
                        </label>
                        <p className="font-medium">
                          {selectedStudent.fullName}
                        </p>
                      </div>
                      {selectedStudent.fatherName && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Father&apos;s Name
                          </label>
                          <p className="font-medium">
                            {selectedStudent.fatherName}
                          </p>
                        </div>
                      )}
                      {selectedStudent.motherName && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Mother&apos;s Name
                          </label>
                          <p className="font-medium">
                            {selectedStudent.motherName}
                          </p>
                        </div>
                      )}
                      {selectedStudent.dateOfBirth && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Date of Birth
                          </label>
                          <p className="font-medium">
                            {new Date(
                              selectedStudent.dateOfBirth,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      {selectedStudent.gender && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Gender
                          </label>
                          <p className="font-medium capitalize">
                            {selectedStudent.gender}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Academic Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Academic Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Admission Number
                        </label>
                        <p className="font-medium text-blue-600">
                          {selectedStudent.admissionNumber}
                        </p>
                      </div>
                      {selectedStudent.classLevel && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Current Class
                          </label>
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700"
                          >
                            {selectedStudent.classLevel}
                          </Badge>
                        </div>
                      )}
                      {selectedStudent.admissionDate && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Admission Date
                          </label>
                          <p className="font-medium">
                            {new Date(
                              selectedStudent.admissionDate,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      {selectedStudent.previousEducation && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Previous Education
                          </label>
                          <p className="font-medium">
                            {selectedStudent.previousEducation}
                          </p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Status
                        </label>
                        <Badge
                          variant={
                            selectedStudent.status === "active"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            selectedStudent.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600"
                          }
                        >
                          {selectedStudent.status || "active"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedStudent.phone && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Phone Number
                        </label>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <p className="font-medium">{selectedStudent.phone}</p>
                        </div>
                      </div>
                    )}
                    {selectedStudent.email && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Email Address
                        </label>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <p className="font-medium">{selectedStudent.email}</p>
                        </div>
                      </div>
                    )}
                    {selectedStudent.address && (
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-500">
                          Address
                        </label>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                          <p className="font-medium">
                            {selectedStudent.address}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Additional Information */}
                {(selectedStudent.bloodGroup ||
                  selectedStudent.medicalConditions ||
                  selectedStudent.emergencyContact) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Additional Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {selectedStudent.bloodGroup && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Blood Group
                          </label>
                          <p className="font-medium">
                            {selectedStudent.bloodGroup}
                          </p>
                        </div>
                      )}
                      {selectedStudent.medicalConditions && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Medical Conditions
                          </label>
                          <p className="font-medium">
                            {selectedStudent.medicalConditions}
                          </p>
                        </div>
                      )}
                      {selectedStudent.emergencyContact && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Emergency Contact
                          </label>
                          <p className="font-medium">
                            {selectedStudent.emergencyContact}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Teacher Detail Modal */}
        <Dialog open={teacherModalOpen} onOpenChange={setTeacherModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Teacher Details
              </DialogTitle>
              <DialogDescription>
                Complete information for{" "}
                {selectedTeacher?.fullName || selectedTeacher?.name}
              </DialogDescription>
            </DialogHeader>

            {selectedTeacher && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Personal Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Personal Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Full Name
                        </label>
                        <p className="font-medium">
                          {selectedTeacher.fullName || selectedTeacher.name}
                        </p>
                      </div>
                      {selectedTeacher.email && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Email
                          </label>
                          <p className="font-medium">{selectedTeacher.email}</p>
                        </div>
                      )}
                      {selectedTeacher.phone && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Phone
                          </label>
                          <p className="font-medium">{selectedTeacher.phone}</p>
                        </div>
                      )}
                      {selectedTeacher.dateOfBirth && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Date of Birth
                          </label>
                          <p className="font-medium">
                            {new Date(
                              selectedTeacher.dateOfBirth,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      {selectedTeacher.gender && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Gender
                          </label>
                          <p className="font-medium capitalize">
                            {selectedTeacher.gender}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Professional Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        Professional Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Employee ID
                        </label>
                        <p className="font-medium text-green-600">
                          {selectedTeacher.teacherId || selectedTeacher.mhrId}
                        </p>
                      </div>
                      {selectedTeacher.subject && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Subject
                          </label>
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700"
                          >
                            {selectedTeacher.subject}
                          </Badge>
                        </div>
                      )}
                      {selectedTeacher.qualification && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Qualification
                          </label>
                          <p className="font-medium">
                            {selectedTeacher.qualification}
                          </p>
                        </div>
                      )}
                      {selectedTeacher.specialization && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Specialization
                          </label>
                          <p className="font-medium">
                            {selectedTeacher.specialization}
                          </p>
                        </div>
                      )}
                      {selectedTeacher.experience && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Experience
                          </label>
                          <p className="font-medium">
                            {selectedTeacher.experience} years
                          </p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Status
                        </label>
                        <Badge
                          variant={
                            selectedTeacher.status === "active"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            selectedTeacher.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600"
                          }
                        >
                          {selectedTeacher.status || "active"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Employment Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Employment Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {selectedTeacher.joinDate && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Join Date
                        </label>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <p className="font-medium">
                            {new Date(
                              selectedTeacher.joinDate,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedTeacher.employmentType && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Employment Type
                        </label>
                        <p className="font-medium">
                          {selectedTeacher.employmentType}
                        </p>
                      </div>
                    )}
                    {selectedTeacher.salary && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Salary
                        </label>
                        <p className="font-medium">₹{selectedTeacher.salary}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Contact Information */}
                {selectedTeacher.address && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Contact Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Address
                        </label>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                          <p className="font-medium">
                            {selectedTeacher.address}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </InspectorLayout>
  );
}
