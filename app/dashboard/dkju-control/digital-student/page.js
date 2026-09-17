"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

import { sortBySearchRank } from "@/lib/searchRanking";
import { profileImageSrc } from "@/lib/utils";
import ProfileImage from "@/components/ProfileImage";
import {
  resolveAndPersistProfilePicture,
  pickUrl,
} from "@/lib/profilePictureUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Download,
  Eye,
  Edit,
  UserX,
  Filter,
  FileText,
  User,
  Trash2,
  Grid3X3,
  List,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import {
  getDigitalStudents,
  updateDigitalStudent,
  deleteDigitalStudent,
} from "@/lib/digitalClassStudentService";
import {
  getDigitalTeachers,
  assignDigitalStudents,
} from "@/lib/digitalClassTeacherService";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import Image from "next/image";
import StudentFilters from "@/components/digitalclassroom/studentFilter";
import { Pagination } from "@/components/ui/pagination";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const normalizeMadarsaIdValue = (value) => String(value ?? "").trim();



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

// Verified by direct HTTP request: every Cloudinary cloud name ever used for
// student photos ("dxggxnjjw" and "dglkp24ki") currently returns 401
// "cloud_name ... is disabled" — an account-level suspension affecting all
// of Cloudinary, not one cloud. Treat any res.cloudinary.com URL as dead so
// it's queued for recovery-from-other-sources instead of being skipped as
// "already has a valid photo". If Cloudinary is ever reactivated, narrow
// this back down.
const isDisabledCloudinaryUrl = (url) =>
  typeof url === "string" && url.includes("res.cloudinary.com/");

export default function CentralAdminStudentsPage() {
  const { user, userData } = useAuthStore();
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]); // For download functionality - loaded on demand
  

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
 
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteStudentId, setDeleteStudentId] = useState(null);
  /* ============================================
   DIGITAL TEACHER ASSIGNMENT
============================================ */

const [
  selectedStudentUids,
  setSelectedStudentUids,
] = useState([]);

const [
  teacherAssignDialogOpen,
  setTeacherAssignDialogOpen,
] = useState(false);

const [
  availableDigitalTeachers,
  setAvailableDigitalTeachers,
] = useState([]);

const [
  selectedDigitalTeacher,
  setSelectedDigitalTeacher,
] = useState(null);

const [
  teachersLoading,
  setTeachersLoading,
] = useState(false);

const [
  assignmentLoading,
  setAssignmentLoading,
] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const itemsPerPage = 20;

  // Lazy Secondary Data: Maps for O(1) lookup of madarsa and mekhala names
  
 

  // Stats counts
  const [statsCounts, setStatsCounts] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    suspended: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Refs to track pending fetches and avoid redundant lookups
  const pendingMadarsaFetches = useRef(new Set());
  const pendingMekhalaFetches = useRef(new Set());
  const pendingProfilePictureFixes = useRef(new Set());

  // Utility function to safely convert Firestore timestamp to Date
  const convertTimestampToDate = (timestamp) => {
    if (!timestamp) return null;
    if (timestamp?.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return new Date(timestamp);
  };

  // Normalize any variant of UKG (ukg, UKG, Ukg) to canonical "Ukg" for display & comparison
  const normalizeClassDisplay = (classVal) => {
    if (!classVal) return "";
    const s = String(classVal).trim();
    if (s.toUpperCase() === "UKG") return "UKG";
    return s;
  };



  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "inactive":
        return "bg-red-100 text-red-800";
      case "suspended":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
 

  

  const studentMatchesClientFilters = useCallback(
    (student, { statusMode = "activeInactive", includeSearch = false } = {}) => {
      // Intentionally not filtering by student.deleted to match the dashboard stats exact count

      
      if (filterGender !== "all") {
        const genderNorm = (student.gender || "").trim().toLowerCase();
        if (filterGender === "other") {
          if (genderNorm === "male" || genderNorm === "female") return false;
        } else if (genderNorm !== filterGender) {
          return false;
        }
      }

      if (filterStatus === "all") {
        if (
          statusMode === "activeInactive" &&
          !["active", "inactive"].includes(student.accountStatus || "active")
        ) {
          return false;
        }
      } else if ((student.accountStatus || "active") !== filterStatus) {
        return false;
      }

      const studentClassRaw =
        student.applyingclass ?? student.class ?? student.className ?? "";
      const normalizedStudentClass = normalizeClassDisplay(
        String(studentClassRaw).trim(),
      );
      
      if (
        filterClass !== "all" &&
        normalizedStudentClass !== normalizeClassDisplay(String(filterClass).trim())
      ) {
        return false;
      }

      if (includeSearch && debouncedSearchTerm.trim()) {
        const term = debouncedSearchTerm.trim().toLowerCase();
        const formattedName = student.fullName
          ? formatStudentName(student.fullName).toLowerCase()
          : "";
        const searchableText = [
          student.fullName,
          student.studentName,
          formattedName,
          student.studentEmail,
          student.phone,
          student.digitalAdmissionNumber,
          student.oldRegistrationNumber,
          student.previousmadarsa,
          student.uid,
          student.guardianName,
          student.guardianPhone,
          student.aadharNumber,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const termNormalized = term
          .replace(/mid-/g, "")
          .replace(/-0+/g, "-")
          .replace(/[^a-z0-9]/g, "");
        const studentAdmNumNormalized = student.digitalAdmissionNumber
          ? student.digitalAdmissionNumber
              .toLowerCase()
              .replace(/mid-/g, "")
              .replace(/-0+/g, "-")
              .replace(/[^a-z0-9]/g, "")
          : "";
        return (
          searchableText.includes(term) ||
          (termNormalized &&
            studentAdmNumNormalized &&
            studentAdmNumNormalized.includes(termNormalized))
        );
      }

      return true;
    },
    [
      debouncedSearchTerm,
      filterClass,
      filterGender,
      filterLevel,
      filterStatus,
           
    ],
  );
  const normalizeAssignmentClass = (
  value,
) => {
  if (!value) {
    return "";
  }

  let text =
    String(value)
      .trim()
      .toLowerCase();

  if (text === "lkg") {
    return "lkg";
  }

  if (text === "ukg") {
    return "ukg";
  }

  /*
    Class 5
    class 5
    5
    CLASS-5

    all become:
    5
  */
  text =
    text
      .replace(/^class[\s_-]*/i, "")
      .trim();

  return text;
};


/* ============================================
   OPEN ASSIGN TEACHER POPUP
============================================ */

const handleOpenTeacherAssignDialog =
  async () => {
    if (
      !filterClass ||
      filterClass === "all"
    ) {
      toast.error(
        "Please select a class first.",
      );

      return;
    }

    if (
      selectedStudentUids.length === 0
    ) {
      toast.error(
        "Please select at least one student.",
      );

      return;
    }

    try {
      setTeachersLoading(true);

      setSelectedDigitalTeacher(
        null,
      );

      setAvailableDigitalTeachers(
        [],
      );

      /*
        Get all Digital Teachers
      */
      const result =
        await getDigitalTeachers();

      const teachers =
        Array.isArray(result)
          ? result
          : result?.teachers ||
            result?.data ||
            result?.applications ||
            [];

      const selectedClass =
        normalizeAssignmentClass(
          filterClass,
        );

      /*
        Only:
        - approved
        - active
        - Digital Classroom access enabled
        - assigned to same class
      */
      const matchingTeachers =
        teachers.filter(
          (teacher) => {
            const approved =
              teacher?.status ===
              "approved";

            const active =
              (
                teacher?.accountStatus ||
                "active"
              ) === "active";

            const hasAccess =
              teacher
                ?.digitalClassAccess ===
              true;

            const teacherClasses =
              teacher
                ?.teachingAssignment
                ?.classes || [];

            const sameClass =
              teacherClasses.some(
                (className) =>
                  normalizeAssignmentClass(
                    className,
                  ) ===
                  selectedClass,
              );

            return (
              approved &&
              active &&
              hasAccess &&
              sameClass
            );
          },
        );

      setAvailableDigitalTeachers(
        matchingTeachers,
      );

      setTeacherAssignDialogOpen(
        true,
      );
    } catch (error) {
      console.error(
        "LOAD DIGITAL TEACHERS ERROR:",
        error,
      );

      toast.error(
        error?.message ||
          "Unable to load Digital Teachers.",
      );
    } finally {
      setTeachersLoading(false);
    }
  };

/* ============================================
   ASSIGN SELECTED STUDENTS TO DIGITAL TEACHER
============================================ */

const handleAssignSelectedStudents =
  async () => {
    if (
      !selectedDigitalTeacher
    ) {
      toast.error(
        "Please select a Digital Teacher.",
      );

      return;
    }

    if (
      selectedStudentUids.length ===
      0
    ) {
      toast.error(
        "Please select at least one student.",
      );

      return;
    }

    if (
      !filterClass ||
      filterClass === "all"
    ) {
      toast.error(
        "Please select a class first.",
      );

      return;
    }

    /*
      IMPORTANT:

      selectedDigitalTeacher.id
      = Digital Teacher application
        document ID

      This is NOT the Firebase UID.
    */

    const teacherApplicationId =
      selectedDigitalTeacher?.id;

    if (
      !teacherApplicationId
    ) {
      toast.error(
        "Digital Teacher application ID not found.",
      );

      return;
    }

    try {
      setAssignmentLoading(
        true,
      );

      const result =
  await assignDigitalStudents(
    selectedDigitalTeacher.id,
    selectedStudentUids,
    filterClass,
  );
const selectedStudents =
  students.filter((student) => {
    const uid =
      student?.uid ||
      student?.id;

    return selectedStudentUids.includes(
      uid,
    );
  });

await Promise.all(
  selectedStudents.map(
    async (student) => {
      if (!student?.id) {
        return;
      }

      await updateDigitalStudent(
        student.id,
        {
          teacherAssigned:
            true,

          assignedDigitalTeacherUid:
            selectedDigitalTeacher
              ?.digitalTeacherUid ||
            selectedDigitalTeacher
              ?.sourceTeacherUid ||
            null,

          assignedDigitalTeacherApplicationId:
            selectedDigitalTeacher
              ?.id ||
            null,
            assignedDigitalTeacherMhrId:
  selectedDigitalTeacher?.mhrId ||
  selectedDigitalTeacher?.teacherId ||
  null,

          assignedDigitalTeacherName:
            selectedDigitalTeacher
              ?.fullName ||
            selectedDigitalTeacher
              ?.name ||
            "Digital Teacher",

          assignedDigitalTeacherEmail:
            selectedDigitalTeacher
              ?.digitalTeacherEmail ||
            selectedDigitalTeacher
              ?.email ||
            null,

          assignedDigitalTeacherClass:
            filterClass,

          teacherAssignedAt:
            new Date()
              .toISOString(),

          teacherAssignedBy:
            user?.uid ||
            null,
        },
      );
    },
  ),
);
      

      toast.success(
        `${selectedStudentUids.length} student(s) assigned to ${
          selectedDigitalTeacher
            ?.fullName ||
          selectedDigitalTeacher
            ?.name ||
          "Digital Teacher"
        } successfully.`,
      );

      /* Close popup */

      setTeacherAssignDialogOpen(
        false,
      );

      /* Clear teacher */

      setSelectedDigitalTeacher(
        null,
      );

      /* Clear selected students */

      setSelectedStudentUids(
        [],
      );

      /*
        Refresh students if later we
        show teacher assignment status
        in the table.
      */

      await fetchStudents();

    } catch (error) {
      console.error(
        "ASSIGN DIGITAL STUDENTS ERROR:",
        error,
      );

      toast.error(
        error?.message ||
          "Unable to assign students to Digital Teacher.",
      );
    } finally {
      setAssignmentLoading(
        false,
      );
    }
  };

  // Fetch stats counts for dashboard
  const fetchStatsCounts =
  useCallback(async () => {
    setStatsLoading(true);

    try {
      const result =
        await getDigitalStudents();

      const all =
        result.students ||
        result.data ||
        [];

      const approved =
        all.filter(
          (student) =>
            student.status ===
            "approved"
        );

      const counts = {
        total:
          approved.length,

        active:
          approved.filter(
            (student) =>
              (student.accountStatus ||
                "active") ===
              "active"
          ).length,

        inactive:
          approved.filter(
            (student) =>
              student.accountStatus ===
              "inactive"
          ).length,

        suspended:
          approved.filter(
            (student) =>
              student.accountStatus ===
              "suspended"
          ).length,
      };

      setStatsCounts(counts);
    } catch (error) {
      console.error(
        "Digital stats error:",
        error
      );

      setStatsCounts({
        total: 0,
        active: 0,
        inactive: 0,
        suspended: 0,
      });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Delete student
  const handleDeleteStudent =
  async () => {
    if (!deleteStudentId) {
      return;
    }

    setDeleteSubmitting(true);

    try {
      await deleteDigitalStudent(
        deleteStudentId
      );

      toast.success(
        "Digital student deleted"
      );

      setDeleteStudentId(null);

      await fetchStudents();
      await fetchStatsCounts();
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      toast.error(
        error.message ||
          "Failed to delete Digital student"
      );
    } finally {
      setDeleteSubmitting(false);
    }
  };
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [selectedStudentForAction, setSelectedStudentForAction] =
    useState(null);
  const [inactivateDialogOpen, setInactivateDialogOpen] = useState(false);
  const [inactivationReason, setInactivationReason] = useState("");
  const [originalStudentStatus, setOriginalStudentStatus] = useState("");

  // View mode state
  const [viewMode, setViewMode] = useState("table"); // 'table' or 'card'
  const [showSuspendedOnly, setShowSuspendedOnly] = useState(false); // Toggle for showing only suspended students
  // Open edit dialog with student data
  const handleEditStudent = (student) => {
    setEditForm({ ...student });
    setOriginalStudentStatus(student.accountStatus || "active");
    setIsEditDialogOpen(true);
  };

  // Save edited student info
  const handleEditStudentSubmit = async (e, bypassInactivateCheck = false) => {
    if (e) e.preventDefault();
    
    // Check if the student was changed to inactive and we don't have an inactivationReason yet
    if (!bypassInactivateCheck && editForm.status === "inactive" && originalStudentStatus !== "inactive" && !inactivationReason) {
      setInactivateDialogOpen(true);
      return;
    }

    setEditSubmitting(true);
    try {
      const { id, ...data } = editForm;
      const originalStudent = students.find((s) => s.id === id);

      // Check if digitalAdmissionNumber was manually changed
      if (originalStudent && data.digitalAdmissionNumber && data.digitalAdmissionNumber !== originalStudent.digitalAdmissionNumber) {
        const newMid = data.digitalAdmissionNumber.trim();
        
        // 1. Verify uniqueness
        const [dupInAdmissions, dupInStudents] = await Promise.all([
          getDocs(query(collection(db, "admissions"), where("digitalAdmissionNumber", "==", newMid))),
          getDocs(query(collection(db, "students"), where("digitalAdmissionNumber", "==", newMid)))
        ]);
        
        if (!dupInAdmissions.empty || !dupInStudents.empty) {
          toast.error(`The Digital Admission Number ${newMid} is already in use. Please use a unique one.`);
          setEditSubmitting(false);
          return;
        }

        // 2. Parse sequence and update counter if needed
        const parts = newMid.split('-');
        if (parts.length > 1) {
          const madarsaPart = parts.slice(0, -1).join('-');
          const seqPart = parts[parts.length - 1];
          const seqNumber = parseInt(seqPart, 10);
          
          if (!isNaN(seqNumber)) {
            const counterRef = doc(db, "counters", `admission_${madarsaPart}`);
            const counterSnap = await getDoc(counterRef);
            const currentCount = counterSnap.exists() ? (counterSnap.data().count ?? 0) : 0;
            
            if (seqNumber > currentCount) {
              await setDoc(counterRef, { count: seqNumber }, { merge: true });
            }
          }
        }
      }

      // Sanitize data: remove undefined values as Firebase doesn't permit them
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined),
      );

      const updatePayload = {
        ...cleanData,
        updatedAt: new Date(),
      };

      if (editForm.status === "inactive" && originalStudentStatus !== "inactive") {
        updatePayload.inactiveReason = inactivationReason.trim();
        updatePayload.inactivatedAt = new Date().toISOString();
        updatePayload.inactivatedBy = userData?.uid || "unknown";
      }

      await updateDigitalStudent(id, updatePayload);
      toast.success("Student info updated");
      setIsEditDialogOpen(false);
      setInactivationReason("");
      fetchStudents();
      fetchStatsCounts();
    } catch (err) {
      console.error("Error updating student:", err);
      toast.error("Failed to update student");
    }
    setEditSubmitting(false);
  };

/* ============================================
   SELECT DIGITAL STUDENTS
============================================ */
const isStudentAssigned = (
  student,
) => {
  return Boolean(
    student?.teacherAssigned ===
      true ||
    student
      ?.assignedDigitalTeacherUid ||
    student
      ?.assignedDigitalTeacherApplicationId,
  );
};


const toggleStudentSelection = (
  student,
) => {
  if (
    isStudentAssigned(
      student,
    )
  ) {
    toast.info(
      `This student is already assigned to ${
        student
          ?.assignedDigitalTeacherName ||
        "a Digital Teacher"
      }.`,
    );

    return;
  }

  const uid =
    student?.uid ||
    student?.id;

  if (!uid) {
    toast.error(
      "Student UID not found.",
    );

    return;
  }

  setSelectedStudentUids(
    (prev) => {
      if (
        prev.includes(uid)
      ) {
        return prev.filter(
          (item) =>
            item !== uid,
        );
      }

      return [
        ...prev,
        uid,
      ];
    },
  );
};


/* ============================================
   SELECT ALL CURRENT FILTERED STUDENTS
============================================ */

const handleSelectAllStudents =
  () => {

    /*
      Central Admin must first
      select one class.
    */
    if (
      !filterClass ||
      filterClass === "all"
    ) {
      toast.error(
        "Please select a class first.",
      );

      return;
    }

    /*
      `students` is already filtered
      by the selected class in
      fetchStudents().
    */
    const studentUids =
  students
    .filter(
      (student) =>
        !isStudentAssigned(
          student,
        ),
    )
    .map(
      (student) =>
        student?.uid ||
        student?.id,
    )
    .filter(Boolean);

    const allSelected =
      studentUids.length > 0 &&
      studentUids.every(
        (uid) =>
          selectedStudentUids.includes(
            uid,
          ),
      );

    if (allSelected) {
      setSelectedStudentUids(
        (prev) =>
          prev.filter(
            (uid) =>
              !studentUids.includes(
                uid,
              ),
          ),
      );
    } else {
      setSelectedStudentUids(
        (prev) => [
          ...new Set([
            ...prev,
            ...studentUids,
          ]),
        ],
      );
    }
  };
  




  const lastDocRef = useRef(null);

  const fetchClasses = async () => {
  try {
    const result =
      await getDigitalStudents();

    const all =
      result.students ||
      result.data ||
      [];

    const classSet = new Set();

    all
      .filter(
        (student) =>
          student.status === "approved"
      )
      .forEach((student) => {
        const value =
          student.applyingclass ||
          student.classLevel;

        if (!value) return;

        const raw =
          String(value).trim();

        classSet.add(
          raw.toUpperCase() === "UKG"
            ? "UKG"
            : raw
        );
      });

    setClasses(
      Array.from(classSet).sort(
        (a, b) => {
          const numA = parseInt(a);
          const numB = parseInt(b);

          if (
            !isNaN(numA) &&
            !isNaN(numB)
          ) {
            return numA - numB;
          }

          return a.localeCompare(b);
        }
      )
    );
  } catch (error) {
    console.error(
      "Digital classes error:",
      error
    );

    setClasses([
      "LKG",
      "UKG",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ]);
  }
};

  const fetchStudents = useCallback(async () => {
  try {
    setLoading(true);

    const result = await getDigitalStudents();

    console.log("DIGITAL STUDENTS:", result);

    let studentsData =
      result.students ||
      result.data ||
      [];

    // ----------------------------
    // SEARCH
    // ----------------------------

    if (debouncedSearchTerm.trim()) {
      const term =
        debouncedSearchTerm
          .trim()
          .toLowerCase();

      studentsData =
        studentsData.filter((student) => {
          const searchableText = [
            student.fullName,
            student.studentName,
            student.studentEmail,
            student.email,
            student.phone,
            student.digitalAdmissionNumber,
            student.oldRegistrationNumber,
            student.previousmadarsa,
            student.guardianName,
            student.guardianPhone,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(term);
        });
    }

    // ----------------------------
    // ACCOUNT STATUS FILTER
    // active / inactive / suspended
    // ----------------------------

    if (
      filterStatus &&
      filterStatus !== "all"
    ) {
      studentsData =
        studentsData.filter(
          (student) =>
            (student.accountStatus ||
              "active") ===
            filterStatus
        );
    }

    // ----------------------------
    // GENDER
    // ----------------------------

    if (
      filterGender &&
      filterGender !== "all"
    ) {
      studentsData =
        studentsData.filter((student) => {
          const gender =
            (
              student.gender || ""
            ).toLowerCase();

          if (
            filterGender === "other"
          ) {
            return (
              gender !== "male" &&
              gender !== "female"
            );
          }

          return (
            gender ===
            filterGender.toLowerCase()
          );
        });
    }

    // ----------------------------
    // CLASS FILTER
    // ----------------------------

    if (
      filterClass &&
      filterClass !== "all"
    ) {
      studentsData =
        studentsData.filter(
          (student) =>
            String(
              student.applyingclass ||
                student.classLevel ||
                ""
            ) ===
            String(filterClass)
        );
    }

    // ----------------------------
    // ONLY APPROVED STUDENTS
    // ----------------------------

    studentsData =
      studentsData.filter(
        (student) =>
          student.status ===
          "approved"
      );

    // ----------------------------
    // SORT LATEST FIRST
    // ----------------------------

    const toMs = (value) => {
      if (!value) return 0;

      if (value?.seconds) {
        return (
          value.seconds * 1000
        );
      }

      const date = new Date(value);

      return isNaN(date.getTime())
        ? 0
        : date.getTime();
    };

    studentsData.sort(
      (a, b) =>
        toMs(b.createdAt) -
        toMs(a.createdAt)
    );

    // ----------------------------
    // PAGINATION
    // ----------------------------

    setTotalStudents(
      studentsData.length
    );

    setTotalPages(
      Math.ceil(
        studentsData.length /
          itemsPerPage
      )
    );

    const startIndex =
      (currentPage - 1) *
      itemsPerPage;

    setStudents(
      studentsData.slice(
        startIndex,
        startIndex +
          itemsPerPage
      )
    );
  } catch (error) {
    console.error(
      "Error fetching Digital students:",
      error
    );

    toast.error(
      error.message ||
        "Failed to load Digital students"
    );

    setStudents([]);
    setTotalStudents(0);
    setTotalPages(0);
  } finally {
    setLoading(false);
  }
}, [
  currentPage,
  debouncedSearchTerm,
  filterGender,
  filterClass,
  filterStatus,
  itemsPerPage,
]);

  // Reset pagination when search state changes
  useEffect(() => {
    setCurrentPage(1);
    lastDocRef.current = null;
  }, [debouncedSearchTerm]);


useEffect(() => {
  /*
    Never keep students selected
    when Central Admin changes class.
  */
  setSelectedStudentUids([]);

  setSelectedDigitalTeacher(
    null,
  );

  setAvailableDigitalTeachers(
    [],
  );
}, [filterClass]);
  // Fetch static metadata once on mount
  useEffect(() => {
    
    fetchClasses();
  }, []);

  // Fetch students list and stats counts when page or filters change
  useEffect(() => {
    fetchStatsCounts();
    fetchStudents();
  }, [fetchStudents, fetchStatsCounts]);

  useEffect(() => {
    const missingPhotoStudents = students.filter((student) => {
      const pic =
        pickUrl(student.profilePicture) || pickUrl(student.profilePictureUrl);
      return !pic || isDisabledCloudinaryUrl(pic);
    });
    if (!missingPhotoStudents.length) return;

    let cancelled = false;
    const hydrateMissingProfilePictures = async () => {
      for (const student of missingPhotoStudents.slice(0, 20)) {
        const studentDocId = student.uid || student.id;
        if (
          !studentDocId ||
          pendingProfilePictureFixes.current.has(studentDocId)
        )
          continue;

        pendingProfilePictureFixes.current.add(studentDocId);
        try {
          const existingPic =
            pickUrl(student.profilePicture) ||
            pickUrl(student.profilePictureUrl);
          const profilePic = await resolveAndPersistProfilePicture(student, {
            failedUrls: isDisabledCloudinaryUrl(existingPic)
              ? [existingPic]
              : [],
          });
          if (profilePic && !cancelled) {
            setStudents((prev) =>
              prev.map((s) =>
                (s.uid || s.id) === studentDocId
                  ? {
                      ...s,
                      profilePicture: profilePic,
                      profilePictureUrl: profilePic,
                    }
                  : s,
              ),
            );
          }
        } catch (e) {
          console.warn("[ProfilePic] Auto-repair failed:", e?.message ?? e);
        }
      }
    };

    hydrateMissingProfilePictures();
    return () => {
      cancelled = true;
    };
  }, [students]);

  // Reset dependent filters when scope changes
  useEffect(() => {
    setFilterClass("all");
    setCurrentPage(1);
    lastDocRef.current = null;
  }, [filterLevel]);

 


 

  // Reset to page 1 (and cursor) when filters change
  useEffect(() => {
    setCurrentPage(1);
    lastDocRef.current = null;
  }, [
    debouncedSearchTerm,
    
    filterLevel,
    filterGender,
    filterClass,
    filterStatus,
  ]);

  // Fetch students when page or filters change
  useEffect(() => {
    if (debouncedSearchTerm !== null) {
      // Only fetch after initial load
      fetchStudents();
    }
  }, [
    fetchStudents,
    currentPage,
    debouncedSearchTerm,
    
    filterLevel,
    filterGender,
    filterClass,
    filterStatus,
  ]);

  // Debounce search input by 2 seconds
  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) {
      setSearchLoading(true);
    }

    const t = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setSearchLoading(false);
    }, 500);

    return () => clearTimeout(t);
  }, [searchTerm, debouncedSearchTerm]);

 const handleViewStudent = async (student) => {
  setIsViewDialogOpen(true);
  setViewLoading(true);

  try {
    setSelectedStudent(student);
  } catch (error) {
    console.error(
      "Error opening Digital student:",
      error
    );
  } finally {
    setViewLoading(false);
  }
};

  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStudent) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }
    setUploadingPhoto(true);
    try {
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const fileName = `students/profile-picture/${timestamp}_${sanitizedName}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
      });
      const downloadURL = await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          null,
          (err) => reject(err),
          async () => {
            try {
              resolve(await getDownloadURL(uploadTask.snapshot.ref));
            } catch (e) {
              reject(e);
            }
          },
        );
      });
      // Update student doc
     await updateDigitalStudent(
  selectedStudent.id,
  {
    profilePicture: downloadURL,
    profilePictureUrl: downloadURL,
  }
);
      // Also update admission doc if available
      
      setSelectedStudent((prev) => ({ ...prev, profilePicture: downloadURL }));
      // Also update the student in the list
      setStudents((prev) =>
        prev.map((s) =>
          s.id === selectedStudent.id
            ? { ...s, profilePicture: downloadURL }
            : s,
        ),
      );
      toast.success("Profile picture updated successfully!");
    } catch (err) {
      console.error("Photo upload error:", err);
      toast.error(
        "Failed to upload photo: " + (err?.message || "Unknown error"),
      );
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

 const handleStatusChange = async (
  studentId,
  newStatus
) => {
  try {
    await updateDigitalStudent(
      studentId,
      {
        accountStatus:
          newStatus,

        digitalClassAccess:
          newStatus ===
          "active",

        updatedAt:
          new Date().toISOString(),
      }
    );

    toast.success(
      "Digital student status updated"
    );

    await fetchStudents();
    await fetchStatsCounts();
  } catch (error) {
    console.error(
      "Status update error:",
      error
    );

    toast.error(
      error.message ||
        "Failed to update status"
    );
  }
};

const handleInactiveStudent =
  async (student, reason = "") => {
    try {
      await updateDigitalStudent(
        student.id,
        {
          accountStatus:
            "inactive",

          digitalClassAccess:
            false,

          inactiveReason:
            reason.trim() ||
            null,

          inactivatedAt:
            new Date().toISOString(),

          inactivatedBy:
            user?.uid || null,
        }
      );

      toast.success(
        `${student.fullName} marked inactive`
      );

      await fetchStudents();
      await fetchStatsCounts();
    } catch (error) {
      toast.error(
        error.message ||
          "Failed to make student inactive"
      );
    }
  };
  const handleSuspendClick = (student) => {
    setSelectedStudentForAction(student);
    setSuspensionReason("");
    setSuspendDialogOpen(true);
  };

 const handleSuspendStudent =
  async () => {
    if (
      !suspensionReason.trim()
    ) {
      toast.error(
        "Please provide a reason for suspension"
      );
      return;
    }

    try {
      await updateDigitalStudent(
        selectedStudentForAction.id,
        {
          accountStatus:
            "suspended",

          digitalClassAccess:
            false,

          suspensionReason:
            suspensionReason.trim(),

          suspendedAt:
            new Date().toISOString(),

          suspendedBy:
            user?.uid || null,
        }
      );

      toast.success(
        `${selectedStudentForAction.fullName} suspended`
      );

      setSuspendDialogOpen(false);
      setSuspensionReason("");
      setSelectedStudentForAction(
        null
      );

      await fetchStudents();
      await fetchStatsCounts();
    } catch (error) {
      console.error(
        "Suspend error:",
        error
      );

      toast.error(
        error.message ||
          "Failed to suspend student"
      );
    }
  };

  const handleActivateClick = (student) => {
    setSelectedStudentForAction(student);
    setActivateDialogOpen(true);
  };

  const handleActivateStudent =
  async () => {
    try {
      await updateDigitalStudent(
        selectedStudentForAction.id,
        {
          accountStatus:
            "active",

          digitalClassAccess:
            true,

          suspensionReason:
            null,

          reactivatedAt:
            new Date().toISOString(),

          reactivatedBy:
            user?.uid || null,
        }
      );

      toast.success(
        `${selectedStudentForAction.fullName} activated`
      );

      setActivateDialogOpen(false);

      setSelectedStudentForAction(
        null
      );

      await fetchStudents();
      await fetchStatsCounts();
    } catch (error) {
      console.error(
        "Activate error:",
        error
      );

      toast.error(
        error.message ||
          "Failed to activate student"
      );
    }
  };
  const fetchAllStudentsForDownload =
  async () => {
    try {
      const result =
        await getDigitalStudents();

      const all =
        result.students ||
        result.data ||
        [];

      return all.filter(
        (student) =>
          student.status === "approved"
      );
    } catch (error) {
      console.error(
        "Error fetching Digital students for export:",
        error
      );

      throw error;
    }
  };

  const downloadStudentData = async () => {
    const toastId = toast.loading("Exporting Students Data");

    try {
      let dataToExport = [];
  
        // Global fetch (no scope selected)
        if (allStudents.length === 0) {
          const fetched = await fetchAllStudentsForDownload(null, null);
          setAllStudents(fetched); // Cache global data
          dataToExport = fetched;
        } else {
          dataToExport = allStudents;
        }
      

      // Apply current client-side filters (Status, Class, Gender, Search)
      const filteredAllStudents = dataToExport.filter((student) => {
        const q = (debouncedSearchTerm || "").toLowerCase();
        const matchesSearch =
          (student.fullName || "").toLowerCase().includes(q) ||
          (student.email || "").toLowerCase().includes(q) ||
          (student.phone || "").toLowerCase().includes(q) ||
          (student.madarsaId || "").toLowerCase().includes(q);

        return matchesSearch && studentMatchesClientFilters(student, { statusMode: "any" });
      });

      // Helper function to escape CSV fields
      const escapeCSV = (value) => {
        if (value == null) return "";
        const str = String(value);
        // If field contains comma, quote, or newline, wrap in quotes and escape quotes
        if (
          str.includes(",") ||
          str.includes('"') ||
          str.includes("\n") ||
          str.includes("\r")
        ) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvContent = [
        [
          "Full Name",
          "Email",
          "Phone",
          "Date of Birth",
          "Gender",
          "Address",
          "Aadhar Number",                  
          "Class Level",          
          "Digital Admission Number",
          "Old Registration Number",
          "Admission Date",
          "Guardian Name",                    
          "Guardian Phone",          
          "Previous Madrasa",          
          "Status",
          "payment Status",
         
          "Date Created",
          "Last Updated",
        ].join(","),
        ...filteredAllStudents.map((student) =>
          [
            escapeCSV(formatStudentName(student.fullName)),
            escapeCSV(student.studentEmail || "N/A"),
            escapeCSV(student.phone),
            escapeCSV(student.dateOfBirth),
            escapeCSV(student.gender),
            escapeCSV(student.address),
            escapeCSV(
              student.aadharNumber
                ? `XXXX-XXXX-${student.aadharNumber.slice(-4)}`
                : "N/A",
            ),
           escapeCSV(student.applyingclass || student.class),
           escapeCSV(student.digitalAdmissionNumber),
           escapeCSV(
              student.oldRegistrationNumber || "N/A"
            ),
            escapeCSV(
              student.createdAt
                ? new Date(student.createdAt).toLocaleDateString()
                : "",
            ),
            escapeCSV(student.guardianName),
            escapeCSV(student.guardianPhone || student.parentDetails?.phone),
            escapeCSV(student.previousmadarsa || "N/A"),
            escapeCSV(student.accountStatus || "active"),
            escapeCSV(student.paymentStatus || "pending"),
           
            escapeCSV(
              (() => {
                const date = convertTimestampToDate(student.createdAt || student.admissionDate || student.joinedDate);
                return date ? date.toLocaleDateString() : "";
              })(),
            ),
            escapeCSV(
              (() => {
                const date = convertTimestampToDate(student.updatedAt);
                return date ? date.toLocaleDateString() : "";
              })(),
            ),
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `all_students_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(
        "Successfully Downloaded",
        { id: toastId },
      );
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export CSV. Please try again.", { id: toastId });
    }
  };
  const clearFilters = () => {
  setSearchTerm("");
  setDebouncedSearchTerm("");

  setFilterLevel("all");
  setFilterGender("all");
  setFilterClass("all");
  setFilterStatus("all");

  setShowSuspendedOnly(false);

  setCurrentPage(1);

  if (lastDocRef?.current) {
    lastDocRef.current = null;
  }

  toast.info("All filters cleared");
};

  const exportPDF = async () => {
    let toastId = toast.loading("Generating PDF report...");
    try {
      
      let allStudentsData = [];
      
      
        if (allStudents.length === 0) {
          const fetched = await fetchAllStudentsForDownload(null, null);
          setAllStudents(fetched);
          allStudentsData = fetched;
        } else {
          allStudentsData = allStudents;
        }
     

      const q = debouncedSearchTerm.toLowerCase();
      const filteredAllStudents = allStudentsData.filter((student) => {
        const matchesSearch =
          (student.fullName || "").toLowerCase().includes(q) ||
          (student.digitalAdmissionNumber || "").toLowerCase().includes(q) ||
          (student.studentEmail || "").toLowerCase().includes(q) ||
          (student.phone || "").toLowerCase().includes(q) ||
          (student.previousmadarsa || "").toLowerCase().includes(q);

        return matchesSearch && studentMatchesClientFilters(student, { statusMode: "any" });
      });

      const doc = new jsPDF("landscape");
      
      const loadImage = (src) => new Promise((resolve) => {
        const img = document.createElement("img");
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });

      const logoImg = await loadImage("/logo.png");
      if (logoImg) {
        doc.addImage(logoImg, "PNG", 14, 10, 20, 20);
      }
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(15, 118, 110);
      doc.text("DKJU Central Control", 40, 18);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text("All Students Master Report", 40, 26);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 235, 26);
      
      const tableColumn = [
        "#", 
        "Digital Admission Number", 
        "Previous Madrasa", 
        "Name", 
        "Applying Class", 
        "Gender", 
        "Guardian Name", 
        "Phone", 
        "Status",
        "Payment Status"
      ];
      
      const cleanPhoneForPdf = (phoneStr) => {
        if (!phoneStr || String(phoneStr).trim().toLowerCase() === "n/a") return "N/A";
        let clean = String(phoneStr).trim();
        clean = clean.replace(/[\s\-\(\)]/g, "");
        if (clean.startsWith("+91")) {
          clean = clean.substring(3);
        } else if (clean.startsWith("91") && clean.length === 12) {
          clean = clean.substring(2);
        }
        return clean || "N/A";
      };

      const tableRows = filteredAllStudents.map((student, index) => [
        index + 1,
        student.digitalAdmissionNumber || student.digitalAdmissionNumber || student.admissionId || "N/A",
        student.previousmadarsa || "N/A",
        formatStudentName(student.fullName),
        student.applyingclass || student.class || "N/A",
        student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : "N/A",
        formatStudentName(student.guardianName || student.parentName || "N/A"),
        cleanPhoneForPdf(student.phone || student.mobileNumber || student.guardianPhone || "N/A"),
        student.accountStatus || "active",
        student.paymentStatus || "pending"
      ]);
      
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 1.5, textColor: [40, 40, 40], overflow: "linebreak", font: "helvetica" },
        headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold", halign: "center", valign: "middle" },
        columnStyles: {
          0: { halign: "center", cellWidth: 13 },    // #
          1: { halign: "center", cellWidth: 34 },    // Digital Admission Number
          2: { halign: "left", cellWidth: 46 },      // Previous Madrasa
          3: { halign: "center", cellWidth: 16 },    // MID
          4: { halign: "left", cellWidth: 47 },      // Name
          5: { halign: "center", cellWidth: 12 },    // Applying Class
          6: { halign: "center", cellWidth: 15 },    // Gender
          7: { halign: "left", cellWidth: 39 },      // Guardian Name
          8: { halign: "center", cellWidth: 36 },    // Phone
          9: { halign: "center", cellWidth: 18 },    // Status
          10: { halign: "center", cellWidth: 20 }    // Payment Status
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 35, left: 10, right: 10 }
      });
      
      doc.save(`all_students_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success(`Successfully exported ${filteredAllStudents.length} students to PDF`, { id: toastId });
    } catch (e) {
      console.error("PDF Export error:", e);
      toast.error("Failed to generate PDF", { id: toastId });
    }
  };

  

  
  

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              All Students
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Manage students across all madarsas
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <Button
              variant="outline"
              onClick={clearFilters}
              className="w-full sm:w-auto"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
            <Button onClick={downloadStudentData} className="w-full lg:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={exportPDF} variant="outline" className="w-full lg:w-auto border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800">
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <Users className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">
                        Total Students
                      </p>
                      <p className="text-lg md:text-2xl font-bold">
                        {statsCounts.total}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <Users className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">Active</p>
                      <p className="text-lg md:text-2xl font-bold">
                        {statsCounts.active}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <Users className="h-6 w-6 md:h-8 md:w-8 text-red-600" />
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">
                        Inactive
                      </p>
                      <p className="text-lg md:text-2xl font-bold">
                        {statsCounts.inactive}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <Users className="h-6 w-6 md:h-8 md:w-8 text-orange-600" />
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">
                        Suspended
                      </p>
                      <p className="text-lg md:text-2xl font-bold">
                        {statsCounts.suspended}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Filters */}
        <StudentFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          
          
         
          filterLevel={filterLevel}
          setFilterLevel={setFilterLevel}
          filterGender={filterGender}
          setFilterGender={setFilterGender}
          filterClass={filterClass}
          setFilterClass={setFilterClass}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
       
          classes={classes}
          loading={loading}
          searchLoading={searchLoading}
        />
        {filterClass !== "all" && (
  <div
    className="
      flex
      flex-col
      gap-4
      rounded-xl
      border
      border-teal-200
      bg-teal-50
      p-4
      md:flex-row
      md:items-center
      md:justify-between
    "
  >
    <div>
      <p className="text-sm text-slate-500">
        Selected Class
      </p>

      <p className="font-semibold text-slate-900">
        {normalizeClassDisplay(
          filterClass,
        )}
      </p>

      <p className="mt-1 text-sm text-teal-700">
        {
          selectedStudentUids.length
        }{" "}
        student(s) selected
      </p>
    </div>

    <div className="flex flex-col gap-2 sm:flex-row">

      <Button
        type="button"
        variant="outline"
        onClick={
          handleSelectAllStudents
        }
      >
        Select All
      </Button>

      <Button
  type="button"
  disabled={
    selectedStudentUids.length ===
    0
  }
  onClick={
    handleOpenTeacherAssignDialog
  }
  className="bg-teal-600 hover:bg-teal-700"
>
  <Users className="mr-2 h-4 w-4" />

  Assign Teacher
</Button>

    </div>
  </div>
)}

        {/* Suspended Students Toggle */}
        <div className="flex justify-center items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              Show Suspended Students
            </span>
          </div>
          <Switch
            checked={showSuspendedOnly}
            onCheckedChange={(checked) => {
              setShowSuspendedOnly(checked);
              setFilterStatus(checked ? "suspended" : "all");
            }}
            className="
    data-[state=unchecked]:bg-gray-300
    data-[state=checked]:bg-red-500
  "
            thumbClassName="
    data-[state=unchecked]:bg-gray-500
    data-[state=checked]:bg-white
  "
          />
        </div>

        {/* Students Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-lg md:text-xl">
                Students List ({totalStudents})
              </CardTitle>
              <div className="flex flex-col md:flex-row items-center gap-2">
                {/* View Toggle */}
                <div className="flex items-center border rounded-md p-1">
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className="h-8 px-3"
                  >
                    <List className="h-4 w-4 mr-1" />
                    Table
                  </Button>
                  <Button
                    variant={viewMode === "card" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("card")}
                    className="h-8 px-3"
                  >
                    <Grid3X3 className="h-4 w-4 mr-1" />
                    Cards
                  </Button>
                </div>
                {/* Top pagination for quick navigation */}
                {!loading && totalPages > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-8 px-3"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="h-8 px-3"
                    >
                      Next
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
                <p className="text-sm md:text-base text-gray-600 mt-4">
                  Loading students...
                </p>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 md:h-16 md:w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-sm md:text-base">
                  No students found matching the current filters.
                </p>
              </div>
            ) : viewMode === "table" ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[900px] w-full">
                  <TableHeader>
                    <TableRow>
                    {filterClass !== "all" && (
  <TableHead className="w-[50px]">
    <input
      type="checkbox"
      checked={
        students.length > 0 &&
        students.every(
          (student) =>
            selectedStudentUids.includes(
              student?.uid ||
                student?.id,
            ),
        )
      }
      onChange={
        handleSelectAllStudents
      }
      className="h-4 w-4 cursor-pointer"
    />
  </TableHead>
)}
                      <TableHead className="whitespace-nowrap w-[160px]">
                        Name
                      </TableHead>
                      <TableHead className="whitespace-nowrap w-[190px]">
                        Email
                      </TableHead>
                      <TableHead className="whitespace-nowrap w-[110px]">
                        Password
                      </TableHead>
                      <TableHead className="whitespace-nowrap w-[130px]">
                        Phone
                      </TableHead>
                      <TableHead className="whitespace-nowrap w-[100px]">
                        Previous Madrasa
                      </TableHead>
                      <TableHead className="whitespace-nowrap w-[60px]">
                        Applying Class
                      </TableHead>
                      <TableHead className="whitespace-nowrap w-[60px]">
                          Assigned Teacher
                        </TableHead>
                      <TableHead className="whitespace-nowrap text-center w-[140px]">
                        Status
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-center w-[140px]">
                        Payment Status
                      </TableHead>
                      <TableHead className="hidden md:table-cell whitespace-nowrap text-center w-[120px]">
                        Date Joined
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-center w-[120px]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading
                      ? Array.from({ length: 6 }).map((_, idx) => (
                          <TableRow key={`skeleton-${idx}`}>
                            <TableCell>
                              <Skeleton className="h-10 w-10 rounded-full" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-40" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-32" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-28" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell className="pl-4">
                              <div className="flex justify-center">
                                <Skeleton className="h-4 w-16" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Skeleton className="h-8 w-8 rounded" />
                                <Skeleton className="h-8 w-8 rounded" />
                                <Skeleton className="h-8 w-20 rounded" />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      : students.map((student) => (
                          <TableRow key={student.id}>
                          {filterClass !== "all" && (
  <TableCell>
    <input
  type="checkbox"
  disabled={
    isStudentAssigned(
      student,
    )
  }
  checked={
    !isStudentAssigned(
      student,
    ) &&
    selectedStudentUids.includes(
      student?.uid ||
        student?.id,
    )
  }
  onChange={() =>
    toggleStudentSelection(
      student,
    )
  }
  className="
    h-4
    w-4
    cursor-pointer
    rounded
    disabled:cursor-not-allowed
    disabled:opacity-40
  "
/>
  </TableCell>
)}
                            <TableCell className="font-medium w-[160px] max-w-[160px]">
                              <div className="min-w-0">
                                <div
                                  className="truncate font-semibold text-sm"
                                  title={
                                    formatStudentName(student.fullName) || "N/A"
                                  }
                                >
                                  {formatStudentName(student.fullName) || "N/A"}
                                </div>
                                {student.digitalAdmissionNumber && (
                                  <div
                                    className="text-xs text-teal-700 font-mono mt-0.5 truncate"
                                    title={student.digitalAdmissionNumber}
                                  >
                                    {student.digitalAdmissionNumber}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="w-[190px] max-w-[190px]">
                              <div
                                className="truncate text-sm"
                                title={student.studentEmail || "N/A"}
                              >
                                {student.studentEmail || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell className="w-[110px]">
                              <span
                                className="font-mono text-xs bg-gray-100 px-2 py-1 rounded block truncate"
                                title={student.password || "N/A"}
                              >
                                {student.password || "N/A"}
                              </span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap w-[130px] text-sm">
                              {student.phone || "N/A"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap w-[100px] text-sm">
                              {student.previousmadarsa || "N/A"}
                            </TableCell>
                            <TableCell>
                              {normalizeClassDisplay(student.applyingclass) ||
                                "N/A"}
                            </TableCell>
                            <TableCell className="w-[180px]">

  {isStudentAssigned(
    student,
  ) ? (

    <div className="min-w-0">

      <p
        className="truncate text-sm font-semibold text-teal-700"
        title={
          student
            ?.assignedDigitalTeacherName ||
          "Digital Teacher"
        }
      >
        {
          student
            ?.assignedDigitalTeacherName ||
          "Digital Teacher"
        }
      </p>

      {student
        ?.assignedDigitalTeacherMhrId && (
        <p className="text-xs text-slate-500">
  MHR ID:{" "}
  {student.assignedDigitalTeacherMhrId ||
    "N/A"}
</p>
      )}

      <Badge className="mt-1 bg-green-100 text-green-700 hover:bg-green-100">
        Assigned
      </Badge>

    </div>

  ) : (

    <Badge
      variant="outline"
      className="text-slate-500"
    >
      Not Assigned
    </Badge>

  )}

</TableCell>
                            <TableCell className="text-center w-[140px]">
                              <div className="flex flex-col items-center gap-1.5 mx-auto">
                                <Badge
                                  className={`justify-center font-medium ${
                                    student.accountStatus === "active"
                                      ? "bg-green-100 text-green-800 border-green-300"
                                      : student.accountStatus === "suspended"
                                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                        : "bg-gray-100 text-gray-800 border-gray-300"
                                  }`}
                                >
                                  {student.accountStatus === "active"
                                    ? "Active"
                                    : student.accountStatus === "suspended"
                                      ? "Suspended"
                                      : student.accountStatus || "Active"}
                                </Badge>
                                {student.accountStatus === "active" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-yellow-700 border-yellow-400 hover:bg-yellow-50 h-7 text-xs w-full"
                                    onClick={() => handleSuspendClick(student)}
                                  >
                                    Suspend
                                  </Button>
                                )}
                                {student.accountStatus === "suspended" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-green-700 border-green-400 hover:bg-green-50 h-7 text-xs w-full"
                                    onClick={() => handleActivateClick(student)}
                                  >
                                    Activate
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center w-[140px]">
                              <div className="flex flex-col items-center gap-1.5 mx-auto">
                                <Badge
                                  className={`justify-center font-medium ${
                                    student.paymentStatus === "active"
                                      ? "bg-green-100 text-green-800 border-green-300"
                                        : "bg-yellow-100 text-yellow-800 border-yellow-300"
                                  }`}
                                >
                                  {student.paymentStatus === "active"
                                    ? "Active"
                                    : student.paymentStatus || "Pending"}
                                </Badge>
                                </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell whitespace-nowrap text-center">
                              {(() => {
                                const date = convertTimestampToDate(
                                  student.createdAt || student.admissionDate || student.joinedDate,
                                );
                                return date
                                  ? date
                                      .toLocaleDateString("en-GB")
                                      .replaceAll("/", "-")
                                  : "N/A";
                              })()}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex space-x-2 justify-center">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="border-[#7f2af2] text-[#7f2af2] hover:bg-[#7f2af2]/10"
                                  onClick={() => handleViewStudent(student)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="border-[#7f2af2] text-[#7f2af2] hover:bg-[#7f2af2]/10"
                                  onClick={() => handleEditStudent(student)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => setDeleteStudentId(student.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* Card View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {students.map((student) => (
                  <Card
                    key={student.id}
                    className="border-l-4 border-l-blue-500 shadow-sm"
                  >
                    <CardContent className="p-4">
                    {filterClass !== "all" && (
  <div className="mb-3 flex items-center justify-between">

    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">

      <input
  type="checkbox"
  disabled={
    isStudentAssigned(
      student,
    )
  }
  checked={
    !isStudentAssigned(
      student,
    ) &&
    selectedStudentUids.includes(
      student?.uid ||
        student?.id,
    )
  }
  onChange={() =>
    toggleStudentSelection(
      student,
    )
  }
  className="
    h-4
    w-4
    cursor-pointer
    rounded
    disabled:cursor-not-allowed
    disabled:opacity-40
  "
/>

      Select Student

    </label>

  </div>
)}
                      <div className="space-y-4">
                        {/* Header Section with Profile Picture */}
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex gap-3 flex-1 min-w-0">
                            {/* Profile Picture */}
                            <div className="shrink-0">
                              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
                                <ProfileImage
                                  src={student.profilePicture}
                                  sourceData={student}
                                  onResolved={(profilePic) => {
                                    setStudents((prev) =>
                                      prev.map((s) =>
                                        (s.uid || s.id) ===
                                        (student.uid || student.id)
                                          ? {
                                              ...s,
                                              profilePicture: profilePic,
                                              profilePictureUrl: profilePic,
                                            }
                                          : s,
                                      ),
                                    );
                                  }}
                                  alt={
                                    formatStudentName(student.fullName) ||
                                    "Student"
                                  }
                                  className="w-full h-full object-cover"
                                  fallbackClassName="w-full h-full flex items-center justify-center"
                                  iconClassName="h-6 w-6 text-gray-400"
                                  showText={false}
                                />
                              </div>
                            </div>
                            {/* Name and Email */}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 text-base leading-tight truncate">
                                {formatStudentName(student.fullName) || "N/A"}
                              </h3>
                              {student.digitalAdmissionNumber && (
                                <p className="text-xs text-teal-700 font-mono mt-0.5 truncate">
                                  {student.digitalAdmissionNumber}
                                </p>
                              )}
                              <p className="text-sm text-gray-600 truncate mt-1">
                                {student.email || "N/A"}
                              </p>
                              <p className="text-xs text-gray-500 font-mono mt-1">
                                Pass: {student.password || "N/A"}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={
                              student.accountStatus === "active"
                                ? "default"
                                : student.accountStatus === "inactive"
                                  ? "secondary"
                                  : "destructive"
                            }
                            className="text-xs px-2 py-1 shrink-0"
                          >
                            {student.accountStatus || "active"}
                          </Badge>
                        </div>

                        {/* Information Grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div className="min-w-0">
                            <p className="text-gray-500 text-xs font-medium mb-1">
                              Phone
                            </p>
                            <p className="font-medium text-gray-900 truncate">
                              {student.phone || "N/A"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-gray-500 text-xs font-medium mb-1">
                              Applying Class
                            </p>
                            <p className="font-medium text-gray-900 truncate">
                              {normalizeClassDisplay(student.applyingclass) ||
                                "N/A"}
                            </p>
                          </div>
                          <div className="col-span-2">

  <p className="mb-1 text-xs font-medium text-gray-500">
    Assigned Digital Teacher
  </p>

  {isStudentAssigned(
    student,
  ) ? (
    <div>
      <p className="font-semibold text-teal-700">
        {
          student
            ?.assignedDigitalTeacherName ||
          "Digital Teacher"
        }
      </p>

      <Badge className="mt-1 bg-green-100 text-green-700">
        Assigned
      </Badge>
    </div>
  ) : (
    <p className="text-sm text-gray-400">
      Not Assigned
    </p>
  )}

</div>
                          
                          <div className="min-w-0">
                            <p className="text-gray-500 text-xs font-medium mb-1">
                              Previous Madrasa
                            </p>
                            <p className="font-medium text-gray-900 truncate">
                              {student.previousmadarsa || "N/A"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-gray-500 text-xs font-medium mb-1">
                              Joined
                            </p>
                            <p className="font-medium text-gray-900 text-xs">
                              {(() => {
                                const date = convertTimestampToDate(
                                  student.createdAt || student.admissionDate || student.joinedDate,
                                );
                                return date
                                  ? date.toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "N/A";
                              })()}
                            </p>
                          </div>
                        </div>

                        {/* Actions Section */}
                        <div className="border-t border-gray-100 pt-3 space-y-2">
                          {/* Status Display with Buttons */}
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-2 block">
                              Status
                            </label>
                            <div className="flex items-center gap-2">
                              <Badge
                                className={
                                  student.accountStatus === "active"
                                    ? "bg-green-100 text-green-800"
                                    : student.accountStatus === "suspended"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-gray-100 text-gray-800"
                                }
                              >
                                {student.accountStatus || "active"}
                              </Badge>
                              {student.accountStatus === "active" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-yellow-600 border-yellow-600 h-7 text-xs flex-1"
                                  onClick={() => handleSuspendClick(student)}
                                >
                                  Suspend
                                </Button>
                              )}
                              {student.accountStatus === "suspended" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 border-green-600 h-7 text-xs flex-1"
                                  onClick={() => handleActivateClick(student)}
                                >
                                  Activate
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleViewStudent(student)}
                              className="h-8 text-xs px-2 flex items-center justify-center text-black"
                            >
                              <Eye className="h-3 w-3 mr-1 text-black" />
                              <span className="hidden xs:inline">View</span>
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleEditStudent(student)}
                              className="h-8 text-xs px-2 flex items-center justify-center"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              <span className="hidden xs:inline">Edit</span>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteStudentId(student.id)}
                              disabled={deleteSubmitting}
                              className="h-8 text-xs px-2 flex items-center justify-center"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              <span className="hidden xs:inline">Delete</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && totalStudents > 0 && (
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t-2 border-gray-200 px-2 sm:px-0">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={totalStudents}
                />
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Page {currentPage} of {totalPages} | Total: {totalStudents} |
                  Items per page: {itemsPerPage}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Delete Student Confirmation Dialog */}
        <Dialog
          open={!!deleteStudentId}
          onOpenChange={(v) => {
            if (!v) setDeleteStudentId(null);
          }}
        >
          <DialogContent className="max-w-full sm:max-w-md w-11/12 sm:w-full bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                Delete Student
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 text-sm sm:text-base">
              Are you sure you want to delete this student? This action cannot
              be undone.
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteStudentId(null)}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteStudent}
                disabled={deleteSubmitting}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {deleteSubmitting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {/* Edit Student Dialog */}
        <Dialog
          className="!bg-white"
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        >
          <DialogContent className="max-w-full sm:max-w-2xl w-11/12 sm:w-full bg-white overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                Edit Student Info
              </DialogTitle>
            </DialogHeader>
            {editForm && (
              <form onSubmit={handleEditStudentSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Full Name
                    </label>
                    <Input
                      value={editForm.fullName || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          fullName: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Email
                    </label>
                    <Input
                      value={editForm.studentEmail || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, studentEmail: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Phone
                    </label>
                    <Input
                      value={editForm.phone || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, phone: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Aadhar Number
                    </label>
                    <Input
                      value={editForm.aadharNumber || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          aadharNumber: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Gender
                    </label>
                    <Select
                      value={editForm.gender || ""}
                      onValueChange={(v) =>
                        setEditForm((f) => ({ ...f, gender: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Admission Date
                    </label>
                    <Input
                      type="date"
                      value={(() => {
                        const d = convertTimestampToDate(
                          editForm.createdAt || editForm.admissionDate || editForm.joinedDate,
                        );
                        return d ? d.toISOString().split("T")[0] : "";
                      })()}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          createdAt: e.target.value,
                        }))
                      }
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Admission Number
                    </label>
                    <Input
                      value={editForm.digitalAdmissionNumber || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          digitalAdmissionNumber: e.target.value,
                        }))
                      }
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                    Applying Class
                    </label>
                    <Select
                      value={editForm.applyingclass || ""}
                      onValueChange={(v) =>
                        setEditForm((f) => ({ ...f, applyingclass: v }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Class" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {[...new Set(classes)]
                          .sort((a, b) => {
                            const numA = parseInt(a);
                            const numB = parseInt(b);
                            if (!isNaN(numA) && !isNaN(numB))
                              return numA - numB;
                            return String(a).localeCompare(String(b));
                          })
                          .map((c, idx) => (
                            <SelectItem key={`${c}-${idx}`} value={c}>
                              {["LKG", "UKG"].includes(String(c).toUpperCase()) ? String(c).toUpperCase() : `Class ${c}`}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Status
                    </label>
                    <Select
                      value={editForm.accountStatus
 || "active"}
                      onValueChange={(v) => {
                        if (v === "inactive" && originalStudentStatus !== "inactive") {
                          setInactivateDialogOpen(true);
                        } else {
                          setEditForm((f) => ({ ...f, accountStatus: v }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Date of Birth
                    </label>
                    <Input
                      type="date"
                      value={(() => {
                        const d = convertTimestampToDate(editForm.dateOfBirth);
                        return d ? d.toISOString().split("T")[0] : "";
                      })()}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          dateOfBirth: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Address
                    </label>
                    <Input
                      value={editForm.address || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          address: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Guardian Name
                    </label>
                    <Input
                      value={editForm.guardianName || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          guardianName: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Guardian Phone
                    </label>
                    <Input
                      value={editForm.guardianPhone || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          guardianPhone: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Previous Education
                    </label>
                    <Input
                      value={editForm.previousmadarsa || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          previousmadarsa: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Password
                    </label>
                    <Input
                      value={editForm.password || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          password: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      UID
                    </label>
                    <Input
                      disabled
                      value={editForm.uid || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, uid: e.target.value }))
                      }
                    />
                  </div>
                </div>
                {/* Parent/Guardian Details (optional, keep if your schema uses it) */}
                {editForm.parentDetails && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3 text-base sm:text-lg">
                      Parent/Guardian Details
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Father&apos;s Name
                        </label>
                        <Input
                          value={editForm.parentDetails?.fatherName || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              parentDetails: {
                                ...f.parentDetails,
                                fatherName: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Mother&apos;s Name
                        </label>
                        <Input
                          value={editForm.parentDetails?.motherName || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              parentDetails: {
                                ...f.parentDetails,
                                motherName: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Parent Phone
                        </label>
                        <Input
                          value={editForm.parentDetails?.phone || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              parentDetails: {
                                ...f.parentDetails,
                                phone: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Parent Email
                        </label>
                        <Input
                          value={editForm.parentDetails?.email || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              parentDetails: {
                                ...f.parentDetails,
                                email: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={editSubmitting}
                    className="w-full sm:w-auto order-1 sm:order-2"
                  >
                    {editSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
        <Dialog
          className="!bg-white"
          open={isViewDialogOpen}
          onOpenChange={(v) => {
            setIsViewDialogOpen(v);
            if (!v) {
              setSelectedStudent(null);
              setViewLoading(false);
            }
          }}
        >
          <DialogContent className="max-w-full sm:max-w-2xl w-11/12 sm:w-full bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                Student Details
              </DialogTitle>
            </DialogHeader>
            {viewLoading ? (
              <div className="space-y-6">
                {/* Header Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Skeleton className="h-4 w-20 mb-2" />
                      <Skeleton className="h-6 w-48" />
                    </div>
                    <div>
                      <Skeleton className="h-4 w-16 mb-2" />
                      <Skeleton className="h-5 w-32" />
                    </div>
                    <div>
                      <Skeleton className="h-4 w-12 mb-2" />
                      <Skeleton className="h-5 w-28" />
                    </div>
                  </div>

                  {/* Profile Picture */}
                  <div className="flex items-center justify-center">
                    <Skeleton className="w-40 h-40 rounded-full" />
                  </div>
                </div>

                {/* Main Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[...Array(8)].map((_, index) => (
                    <div key={index} className="space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>

                {/* Additional Fields */}
                <div className="space-y-4">
                  <Skeleton className="h-4 w-36" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, index) => (
                      <div key={index} className="space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Parent Details Section */}
                <div className="border-t pt-6">
                  <Skeleton className="h-5 w-48 mb-4" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, index) => (
                      <div key={index} className="space-y-2">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Loading Indicator */}
                <div className="flex justify-center items-center space-x-2 pt-4">
                  <Skeleton className="h-2 w-2 rounded-full animate-pulse" />
                  <Skeleton
                    className="h-2 w-2 rounded-full animate-pulse"
                    style={{ animationDelay: "150ms" }}
                  />
                  <Skeleton
                    className="h-2 w-2 rounded-full animate-pulse"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            ) : (
              selectedStudent && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Full Name
                      </label>
                      <p className="text-sm font-semibold">
                        {selectedStudent.fullName || "N/A"}
                      </p>
                    </div>

                    {/* Profile picture at top-right - always show */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-[180px] h-[180px] rounded-md overflow-hidden border-2 border-gray-200 bg-gray-100">
                        <ProfileImage
                          src={selectedStudent.profilePicture}
                          sourceData={selectedStudent}
                          onResolved={(profilePic) => {
                            setSelectedStudent((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    profilePicture: profilePic,
                                    profilePictureUrl: profilePic,
                                  }
                                : prev,
                            );
                            setStudents((prev) =>
                              prev.map((s) =>
                                (s.uid || s.id) ===
                                (selectedStudent.uid || selectedStudent.id)
                                  ? {
                                      ...s,
                                      profilePicture: profilePic,
                                      profilePictureUrl: profilePic,
                                    }
                                  : s,
                              ),
                            );
                          }}
                          alt="Profile Picture"
                          className="w-full h-full object-cover"
                          fallbackClassName="w-full h-full flex flex-col items-center justify-center"
                          iconClassName="h-16 w-16 text-gray-400 mb-2"
                          showText={true}
                        />
                      </div>
                      {/* Upload / change photo */}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProfilePhotoUpload}
                          disabled={uploadingPhoto}
                        />
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border ${
                            uploadingPhoto
                              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                              : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer"
                          }`}
                        >
                          {uploadingPhoto
                            ? "Uploading..."
                            : selectedStudent.profilePicture
                              ? "Change Photo"
                              : "Upload Photo"}
                        </span>
                      </label>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Email
                      </label>
                      <p className="text-sm">
                        {selectedStudent.studentEmail || "N/A"}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Password
                      </label>
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded inline-block">
                        {selectedStudent.password || "N/A"}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Phone
                      </label>
                      <p className="text-sm">
                        {selectedStudent.phone || "N/A"}
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                       Applying Class
                      </label>
                      <p className="text-sm">
                        {normalizeClassDisplay(selectedStudent.applyingclass) ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Status
                      </label>
                      <Badge className={getStatusColor(selectedStudent.accountStatus)}>
                        {selectedStudent.accountStatus || "active"}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Payment Status
                      </label>
                      <Badge className={getStatusColor(selectedStudent.paymentStatus)}>
                        {selectedStudent.paymentStatus || "pending"}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Date of Birth
                      </label>
                      <p className="text-sm">
                        {(() => {
                          if (!selectedStudent.dateOfBirth) return "N/A";
                          const d = convertTimestampToDate(selectedStudent.dateOfBirth);
                          if (d && !isNaN(d.valueOf())) return d.toLocaleDateString("en-GB").replaceAll("/", "-");
                          return typeof selectedStudent.dateOfBirth === "string" 
                            ? selectedStudent.dateOfBirth 
                            : "Invalid Date";
                        })()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Address
                      </label>
                      <p className="text-sm">
                        {selectedStudent.address || "N/A"}
                      </p>
                    </div>

                    {/* Additional academic/administrative fields */}
                    {selectedStudent.admissionId && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Admission ID
                        </label>
                        <p className="text-sm">{selectedStudent.admissionId}</p>
                      </div>
                    )}

                    {selectedStudent.digitalAdmissionNumber && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Digital Admission Number
                        </label>
                        <p className="text-sm">
                          {selectedStudent.digitalAdmissionNumber}
                        </p>
                      </div>
                    )}

                    {selectedStudent.createdAt && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Digital Admission Date
                        </label>
                        <p className="text-sm">
                          {(() => {
                            const d = convertTimestampToDate(
                              selectedStudent.createdAt,
                            );
                            return d
                              ? d.toLocaleDateString()
                              : String(selectedStudent.createdAt);
                          })()}
                        </p>
                      </div>
                    )}

                    {selectedStudent.oldRegistrationNumber && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Old Registration Number
                        </label>
                        <p className="text-sm">{selectedStudent.oldRegistrationNumber}</p>
                      </div>
                    )}

                    {selectedStudent.aadharNumber && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Aadhar (masked)
                        </label>
                        <p className="text-sm">{`XXXX-XXXX-${String(
                          selectedStudent.aadharNumber,
                        ).slice(-4)}`}</p>
                      </div>
                    )}

                    {selectedStudent.academicYear && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Academic Year
                        </label>
                        <p className="text-sm">
                          {selectedStudent.academicYear}
                        </p>
                      </div>
                    )}

                    {/* profile picture rendered at the top-right; no duplicate here */}
                  </div>

                  {/* Parent/Guardian Details */}
                  {(selectedStudent.parentDetails ||
                    selectedStudent.guardianName) && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3 text-base sm:text-lg">
                        Parent/Guardian Details
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            {selectedStudent.parentDetails?.fatherName
                              ? "Father's Name"
                              : "Guardian Name"}
                          </label>
                          <p className="text-sm">
                            {selectedStudent.parentDetails?.fatherName ||
                              selectedStudent.guardianName ||
                              "N/A"}
                          </p>
                        </div>
                        {selectedStudent.parentDetails?.motherName && (
                          <div>
                            <label className="text-sm font-medium text-gray-500">
                              Mother&apos;s Name
                            </label>
                            <p className="text-sm">
                              {selectedStudent.parentDetails.motherName}
                            </p>
                          </div>
                        )}
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Guardian Phone
                          </label>
                          <p className="text-sm">
                            {selectedStudent.parentDetails?.phone ||
                              selectedStudent.guardianPhone ||
                              "N/A"}
                          </p>
                        </div>
                        {selectedStudent.parentDetails?.email && (
                          <div>
                            <label className="text-sm font-medium text-gray-500">
                              Guardian Email
                            </label>
                            <p className="text-sm">
                              {selectedStudent.parentDetails.email}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Suspension History */}
                  {(selectedStudent.accountStatus === "suspended" ||
                    selectedStudent.suspensionReason ||
                    selectedStudent.reactivatedAt) && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3 text-base sm:text-lg">
                        Suspension History
                      </h4>
                      <div className="space-y-4">
                        {/* Current/Last Suspension Details */}
                        {selectedStudent.suspensionReason && (
                          <div
                            className={`p-4 rounded-lg border-2 ${
                              selectedStudent.accountStatus === "suspended"
                                ? "bg-yellow-50 border-yellow-300"
                                : "bg-gray-50 border-gray-300"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <h5 className="font-semibold text-sm text-gray-800">
                                {selectedStudent.accountStatus === "suspended"
                                  ? "Currently Suspended"
                                  : "Previous Suspension"}
                              </h5>
                              <Badge
                                className={
                                  selectedStudent.accountStatus === "suspended"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-gray-100 text-gray-800"
                                }
                              >
                                {selectedStudent.accountStatus === "suspended"
                                  ? "Suspended"
                                  : "Reactivated"}
                              </Badge>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <label className="text-sm font-semibold text-gray-700">
                                  Reason for Suspension:
                                </label>
                                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                                  {selectedStudent.suspensionReason}
                                </p>
                              </div>

                              {selectedStudent.suspendedAt && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-sm font-medium text-gray-600">
                                      Suspended On:
                                    </label>
                                    <p className="text-sm text-gray-800">
                                      {(() => {
                                        if (!selectedStudent.suspendedAt) return "N/A";
                                        const d = convertTimestampToDate(selectedStudent.suspendedAt);
                                        if (d && !isNaN(d.valueOf())) return d.toLocaleString("en-GB").replaceAll("/", "-");
                                        return typeof selectedStudent.suspendedAt === "string"
                                          ? selectedStudent.suspendedAt
                                          : "Invalid Date";
                                      })()}
                                    </p>
                                  </div>

                                  {selectedStudent.suspendedBy && (
                                    <div>
                                      <label className="text-sm font-medium text-gray-600">
                                        Suspended By:
                                      </label>
                                      <p className="text-sm text-gray-800">
                                        {selectedStudent.suspendedBy}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {selectedStudent.reactivatedAt && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-300">
                                  <div>
                                    <label className="text-sm font-medium text-gray-600">
                                      Reactivated On:
                                    </label>
                                    <p className="text-sm text-green-700 font-medium">
                                      {(() => {
                                        if (!selectedStudent.reactivatedAt) return "N/A";
                                        const d = convertTimestampToDate(selectedStudent.reactivatedAt);
                                        if (d && !isNaN(d.valueOf())) return d.toLocaleString("en-GB").replaceAll("/", "-");
                                        return typeof selectedStudent.reactivatedAt === "string"
                                          ? selectedStudent.reactivatedAt
                                          : "Invalid Date";
                                      })()}
                                    </p>
                                  </div>

                                  {selectedStudent.reactivatedBy && (
                                    <div>
                                      <label className="text-sm font-medium text-gray-600">
                                        Reactivated By:
                                      </label>
                                      <p className="text-sm text-green-700 font-medium">
                                        {selectedStudent.reactivatedBy}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Show message if suspended but no reason found */}
                        {selectedStudent.accountStatus === "suspended" &&
                          !selectedStudent.suspensionReason && (
                            <div className="p-4 rounded-lg bg-yellow-50 border-2 border-yellow-300">
                              <p className="text-sm text-yellow-800">
                                This student is currently suspended. No
                                suspension reason is recorded.
                              </p>
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </DialogContent>
        </Dialog>

        {/* Suspend Student Dialog */}
        <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Suspend Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                You are about to suspend{" "}
                <span className="font-semibold">
                  {selectedStudentForAction?.fullName}
                </span>
                . Please provide a reason for this action.
              </p>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Reason for Suspension *
                </label>
                <Textarea
                  placeholder="Enter the reason for suspending this student..."
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  rows={4}
                  className="w-full"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSuspendDialogOpen(false);
                    setSuspensionReason("");
                    setSelectedStudentForAction(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSuspendStudent}
                  disabled={!suspensionReason.trim()}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  Confirm Suspension
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Inactivate Student Dialog */}
        <Dialog open={inactivateDialogOpen} onOpenChange={(v) => {
          if (!v) {
            setInactivateDialogOpen(false);
            setInactivationReason("");
            setEditForm(f => ({ ...f, status: originalStudentStatus }));
          }
        }}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Inactivate Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                You are about to make{" "}
                <span className="font-semibold">
                  {editForm?.fullName}
                </span>{" "}
                inactive. Please provide a reason for this action.
              </p>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Reason for Inactivation *
                </label>
                <Textarea
                  placeholder="Enter the reason for making this student inactive..."
                  value={inactivationReason}
                  onChange={(e) => setInactivationReason(e.target.value)}
                  rows={4}
                  className="w-full"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setInactivateDialogOpen(false);
                    setInactivationReason("");
                    setEditForm(f => ({ ...f, status: originalStudentStatus }));
                  }}
                >
                  Cancel
                </Button>
                <Button
  onClick={async () => {
    setInactivateDialogOpen(false);
    setEditSubmitting(true);

    try {
      const { id, ...data } = editForm;

      const cleanData = Object.fromEntries(
        Object.entries(data).filter(
          ([_, value]) => value !== undefined
        )
      );

      await updateDigitalStudent(id, {
        ...cleanData,

        accountStatus: "inactive",

        digitalClassAccess: false,

        inactiveReason:
          inactivationReason.trim(),

        inactivatedAt:
          new Date().toISOString(),

        inactivatedBy:
          user?.uid ||
          userData?.uid ||
          null,

        updatedAt:
          new Date().toISOString(),
      });

      toast.success(
        "Digital student updated and marked inactive"
      );

      setIsEditDialogOpen(false);
      setInactivationReason("");

      await fetchStudents();
      await fetchStatsCounts();
    } catch (err) {
      console.error(
        "Error updating digital student:",
        err
      );

      toast.error(
        err.message ||
          "Failed to update digital student"
      );
    } finally {
      setEditSubmitting(false);
    }
  }}
  disabled={
    !inactivationReason.trim() ||
    editSubmitting
  }
  className="bg-red-600 hover:bg-red-700 text-white"
>
  {editSubmitting
    ? "Updating..."
    : "Confirm"}
</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Activate Student Dialog */}
        <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Activate Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Review the suspension details before reactivating{" "}
                <span className="font-semibold">
                  {selectedStudentForAction?.fullName}
                </span>
                .
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-yellow-800 mb-2">
                  Suspension Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Reason:</span>
                    <p className="text-gray-600 mt-1 whitespace-pre-wrap">
                      {selectedStudentForAction?.suspensionReason ||
                        "No reason provided"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Suspended On:
                    </span>
                    <p className="text-gray-600">
                      {selectedStudentForAction?.suspendedAt
                        ? (() => {
                            try {
                              return new Date(
                                selectedStudentForAction.suspendedAt,
                              ).toLocaleString();
                            } catch {
                              return "Unknown";
                            }
                          })()
                        : "Unknown"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setActivateDialogOpen(false);
                    setSelectedStudentForAction(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleActivateStudent}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Confirm Activation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      {/* ==========================================
    ASSIGN DIGITAL TEACHER DIALOG
========================================== */}

<Dialog
  open={
    teacherAssignDialogOpen
  }
  onOpenChange={(open) => {
    setTeacherAssignDialogOpen(
      open,
    );

    if (!open) {
      setSelectedDigitalTeacher(
        null,
      );
    }
  }}
>
  <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto bg-white sm:max-w-2xl">

    <DialogHeader>
      <DialogTitle className="text-xl font-bold text-slate-900">
        Assign Digital Teacher
      </DialogTitle>
    </DialogHeader>


    {/* SUMMARY */}

    <div className="grid gap-3 sm:grid-cols-2">

      <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">

        <p className="text-xs font-medium uppercase tracking-wide text-teal-600">
          Selected Class
        </p>

        <p className="mt-1 text-lg font-bold text-slate-900">
          {normalizeClassDisplay(
            filterClass,
          )}
        </p>

      </div>


      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">

        <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
          Selected Students
        </p>

        <p className="mt-1 text-lg font-bold text-slate-900">
          {
            selectedStudentUids.length
          }{" "}
          Student(s)
        </p>

      </div>

    </div>


    {/* TEACHER LIST */}

    <div className="mt-5">

      <div className="mb-3 flex items-center justify-between">

        <div>
          <p className="font-semibold text-slate-900">
            Available Digital Teachers
          </p>

          <p className="text-sm text-slate-500">
            Only teachers assigned to{" "}
            {normalizeClassDisplay(
              filterClass,
            )}{" "}
            are shown.
          </p>
        </div>

        {!teachersLoading && (
          <Badge variant="outline">
            {
              availableDigitalTeachers.length
            }{" "}
            Teacher(s)
          </Badge>
        )}

      </div>


      {teachersLoading ? (

        <div className="flex min-h-[180px] items-center justify-center">

          <div className="text-center">

            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />

            <p className="mt-3 text-sm text-slate-500">
              Loading Digital Teachers...
            </p>

          </div>

        </div>

      ) : availableDigitalTeachers.length ===
        0 ? (

        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">

          <Users className="mx-auto h-10 w-10 text-slate-300" />

          <p className="mt-3 font-semibold text-slate-700">
            No Digital Teacher available
          </p>

          <p className="mt-1 text-sm text-slate-500">
            No active Digital Teacher is assigned to{" "}
            {normalizeClassDisplay(
              filterClass,
            )}.
          </p>

        </div>

      ) : (

        <div className="space-y-3">

          {availableDigitalTeachers.map(
            (teacher) => {
              const teacherId =
                teacher?.id;

              const selected =
                selectedDigitalTeacher
                  ?.id ===
                teacherId;

              const subjects =
                teacher
                  ?.teachingAssignment
                  ?.subjects || [];

              const languages =
                teacher
                  ?.teachingAssignment
                  ?.languages || [];

              return (
                <button
                  key={
                    teacherId ||
                    teacher
                      ?.digitalTeacherUid
                  }
                  type="button"
                  onClick={() =>
                    setSelectedDigitalTeacher(
                      teacher,
                    )
                  }
                  className={`
                    w-full
                    rounded-xl
                    border
                    p-4
                    text-left
                    transition
                    ${
                      selected
                        ? "border-teal-500 bg-teal-50 ring-2 ring-teal-100"
                        : "border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50"
                    }
                  `}
                >

                  <div className="flex items-start gap-4">

                    {/* RADIO */}

                    <div className="pt-1">

                      <div
                        className={`
                          flex
                          h-5
                          w-5
                          items-center
                          justify-center
                          rounded-full
                          border-2
                          ${
                            selected
                              ? "border-teal-600"
                              : "border-slate-300"
                          }
                        `}
                      >
                        {selected && (
                          <div className="h-2.5 w-2.5 rounded-full bg-teal-600" />
                        )}
                      </div>

                    </div>


                    {/* TEACHER */}

                    <div className="min-w-0 flex-1">

                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                          <p className="font-bold text-slate-900">
                            {teacher?.fullName ||
                              teacher?.name ||
                              "Digital Teacher"}
                          </p>

                          <p className="text-sm text-slate-500">
                            {teacher
                              ?.digitalTeacherEmail ||
                              teacher?.email ||
                              "No email"}
                          </p>

                        </div>

                        {teacher?.mhrId && (
                          <Badge variant="outline">
                            {
                              teacher.mhrId
                            }
                          </Badge>
                        )}

                      </div>


                      {/* SUBJECTS */}

                      <div className="mt-3">

                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Subjects
                        </p>

                        <div className="mt-1 flex flex-wrap gap-1.5">

                          {subjects.length >
                          0 ? (
                            subjects.map(
                              (subject) => (
                                <Badge
                                  key={
                                    subject
                                  }
                                  className="bg-blue-50 text-blue-700 hover:bg-blue-50"
                                >
                                  {
                                    subject
                                  }
                                </Badge>
                              ),
                            )
                          ) : (
                            <span className="text-xs text-slate-400">
                              No subjects
                            </span>
                          )}

                        </div>

                      </div>


                      {/* LANGUAGE */}

                      <div className="mt-3">

                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Teaching Medium
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          {languages.length >
                          0
                            ? languages.join(
                                ", ",
                              )
                            : "Not specified"}
                        </p>

                      </div>

                    </div>

                  </div>

                </button>
              );
            },
          )}

        </div>

      )}

    </div>


    {/* BUTTONS */}

    <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">

      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setTeacherAssignDialogOpen(
            false,
          );

          setSelectedDigitalTeacher(
            null,
          );
        }}
      >
        Cancel
      </Button>


      <Button
  type="button"
  onClick={
    handleAssignSelectedStudents
  }
  disabled={
    assignmentLoading ||
    !selectedDigitalTeacher ||
    selectedStudentUids.length ===
      0
  }
  className="bg-teal-600 hover:bg-teal-700"
>
  {assignmentLoading
    ? "Assigning..."
    : `Assign ${selectedStudentUids.length} Student(s)`}
</Button>

    </div>

  </DialogContent>
</Dialog>
      </div>
    </Layout>
  );
}
