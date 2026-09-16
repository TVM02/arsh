"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  DialogDescription,
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
  Download,
  Eye,
  Edit,
  UserX,
UserPlus,
Loader2,
  FileText,
  User,
  Trash2,
  Grid3X3,
  List,
  RotateCcw,
  Mail,
  GraduationCap,
  BookOpen,
  Phone,
  Building2,
  Landmark,
  ShieldCheck,
 

} from "lucide-react";
import {

  Modal,
  InfoSection,
  InfoField,
} from "@/components/digitalclassroom/application";
import { toast } from "sonner";
import {
  getDigitalTeachers,
  updateDigitalTeacher,
  deleteDigitalTeacher,
  getEligibleDigitalStudents,
assignDigitalStudents,
unassignDigitalStudent,
} from "@/lib/digitalClassTeacherService";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import StudentFilters from "@/components/digitalclassroom/studentFilter";
import { Pagination } from "@/components/ui/pagination";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";






// Helper to format teacher name (UI level)
const formatTeacherName = (name) => {
  if (!name) return "";
  return name
    .toString()
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
};

// Verified by direct HTTP request: every Cloudinary cloud name ever used for
// teacher photos ("dxggxnjjw" and "dglkp24ki") currently returns 401
// "cloud_name ... is disabled" — an account-level suspension affecting all
// of Cloudinary, not one cloud. Treat any res.cloudinary.com URL as dead so
// it's queued for recovery-from-other-sources instead of being skipped as
// "already has a valid photo". If Cloudinary is ever reactivated, narrow
// this back down.
const isDisabledCloudinaryUrl = (url) =>
  typeof url === "string" && url.includes("res.cloudinary.com/");

export default function CentralAdminTeachersPage() {
  const { user, userData } = useAuthStore();
  const [teachers, setTeachers] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]); // For download functionality - loaded on demand
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
 
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteTeacherId, setDeleteTeacherId] = useState(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalTeachers, setTotalTeachers] = useState(0);
  const itemsPerPage = 20;

  // Lazy Secondary Data: Maps for O(1) lookup of madarsa and mekhala names
  const [
  eligibleDigitalStudents,
  setEligibleDigitalStudents,
] = useState([]);

const [
  assignedDigitalStudents,
  setAssignedDigitalStudents,
] = useState([]);

const [
  digitalStudentsLoading,
  setDigitalStudentsLoading,
] = useState(false);

const [
  assignStudentsOpen,
  setAssignStudentsOpen,
] = useState(false);

const [
  assignTeacher,
  setAssignTeacher,
] = useState(null);

const [
  selectedAssignStudent,
  setSelectedAssignStudent,
] = useState(null);

const [
  studentViewOpen,
  setStudentViewOpen,
] = useState(false);

const [
  assigningStudentUid,
  setAssigningStudentUid,
] = useState(null);
const [
  removingStudentUid,
  setRemovingStudentUid,
] = useState(null);

 

  // Stats counts
  const [statsCounts, setStatsCounts] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    suspended: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Refs to track pending fetches and avoid redundant lookups
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
 

  

  const teacherMatchesClientFilters = useCallback(
    (teacher, { statusMode = "activeInactive", includeSearch = false } = {}) => {
      // Intentionally not filtering by teacher.deleted to match the dashboard stats exact count

      
      if (filterGender !== "all") {
        const genderNorm = (teacher.gender || "").trim().toLowerCase();
        if (filterGender === "other") {
          if (genderNorm === "male" || genderNorm === "female") return false;
        } else if (genderNorm !== filterGender) {
          return false;
        }
      }

      if (filterStatus === "all") {
        if (
          statusMode === "activeInactive" &&
          !["active", "inactive"].includes(teacher.accountStatus || "active")
        ) {
          return false;
        }
      } else if ((teacher.accountStatus || "active") !== filterStatus) {
        return false;
      }

      const assignedClasses = teacher?.teachingAssignment?.classes || [];

      if (
        filterClass !== "all" &&
        !assignedClasses.some(
          (className) =>
            normalizeClassDisplay(String(className).trim()) ===
            normalizeClassDisplay(String(filterClass).trim()),
        )
      ) {
        return false;
      }

      if (includeSearch && debouncedSearchTerm.trim()) {
        const term = debouncedSearchTerm.trim().toLowerCase();
        const formattedName = teacher.fullName
          ? formatTeacherName(teacher.fullName).toLowerCase()
          : "";
        const searchableText = [
          teacher.fullName,
          teacher.teacherName,
          formattedName,
          teacher.teacherEmail,
          teacher.digitalTeacherEmail,
          teacher.email,
          teacher.phone,
          teacher.digitalAdmissionNumber,
          teacher.oldRegistrationNumber,
          teacher.madarsaName,
          teacher.uid,
          teacher.guardianName,
          teacher.guardianPhone,
          teacher.aadharNumber,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const termNormalized = term
          .replace(/mid-/g, "")
          .replace(/-0+/g, "-")
          .replace(/[^a-z0-9]/g, "");
        const teacherAdmNumNormalized = teacher.digitalAdmissionNumber
          ? teacher.digitalAdmissionNumber
              .toLowerCase()
              .replace(/mid-/g, "")
              .replace(/-0+/g, "-")
              .replace(/[^a-z0-9]/g, "")
          : "";
        return (
          searchableText.includes(term) ||
          (termNormalized &&
            teacherAdmNumNormalized &&
            teacherAdmNumNormalized.includes(termNormalized))
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

  // Fetch stats counts for dashboard
  const fetchStatsCounts =
  useCallback(async () => {
    setStatsLoading(true);

    try {
      const result =
        await getDigitalTeachers();

      const all =
        result.teachers ||
        result.data ||
        [];

      const approved =
        all.filter(
          (teacher) =>
            teacher.status ===
            "approved"
        );

      const counts = {
        total:
          approved.length,

        active:
          approved.filter(
            (teacher) =>
              (teacher.accountStatus ||
                "active") ===
              "active"
          ).length,

        inactive:
          approved.filter(
            (teacher) =>
              teacher.accountStatus ===
              "inactive"
          ).length,

        suspended:
          approved.filter(
            (teacher) =>
              teacher.accountStatus ===
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

  // Delete teacher
  const handleDeleteTeacher =
  async () => {
    if (!deleteTeacherId) {
      return;
    }

    setDeleteSubmitting(true);

    try {
      await deleteDigitalTeacher(
        deleteTeacherId
      );

      toast.success(
        "Digital teacher deleted"
      );

      setDeleteTeacherId(null);

      await fetchTeachers();
      await fetchStatsCounts();
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      toast.error(
        error.message ||
          "Failed to delete Digital teacher"
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
  const [selectedTeacherForAction, setSelectedTeacherForAction] =
    useState(null);
  const [inactivateDialogOpen, setInactivateDialogOpen] = useState(false);
  const [inactivationReason, setInactivationReason] = useState("");
  const [originalTeacherStatus, setOriginalTeacherStatus] = useState("");

  // View mode state
  const [viewMode, setViewMode] = useState("table"); // 'table' or 'card'
  const [showSuspendedOnly, setShowSuspendedOnly] = useState(false); // Toggle for showing only suspended teachers
  // Open edit dialog with teacher data
  const handleEditTeacher = (teacher) => {
    setEditForm({ ...teacher });
    setOriginalTeacherStatus(teacher.accountStatus || "active");
    setIsEditDialogOpen(true);
  };

  // Save edited teacher info
  const handleEditTeacherSubmit = async (e, bypassInactivateCheck = false) => {
    if (e) e.preventDefault();
    if (!editForm?.id) {
      toast.error("Digital teacher ID not found");
      return;
    }

    if (
      !bypassInactivateCheck &&
      editForm.accountStatus === "inactive" &&
      originalTeacherStatus !== "inactive" &&
      !inactivationReason.trim()
    ) {
      setInactivateDialogOpen(true);
      return;
    }

    setEditSubmitting(true);

    try {
      const { id, ...data } = editForm;

      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined),
      );

      const becomingInactive =
        editForm.accountStatus === "inactive" &&
        originalTeacherStatus !== "inactive";

      const updatePayload = {
        ...cleanData,
        updatedAt: new Date().toISOString(),
        ...(becomingInactive
          ? {
              inactiveReason: inactivationReason.trim(),
              inactivatedAt: new Date().toISOString(),
              inactivatedBy: user?.uid || userData?.uid || null,
              digitalClassAccess: false,
            }
          : {}),
      };

      await updateDigitalTeacher(id, updatePayload);

      toast.success("Digital teacher updated");
      setIsEditDialogOpen(false);
      setInactivationReason("");

      await fetchTeachers();
      await fetchStatsCounts();
    } catch (error) {
      console.error("Error updating digital teacher:", error);
      toast.error(error?.message || "Failed to update digital teacher");
    } finally {
      setEditSubmitting(false);
    }
  };
const handleViewAssignStudent = (student) => {
  setSelectedAssignStudent(student);
  setStudentViewOpen(true);
};


const handleAddDigitalStudent = async (student) => {
  if (!assignTeacher?.id) {
    toast.error("Digital Teacher not found.");
    return;
  }

  const studentUid =
    student?.uid ||
    student?.id;

  if (!studentUid) {
    toast.error("Digital Student UID not found.");
    return;
  }

  try {
    setAssigningStudentUid(studentUid);

    const result =
      await assignDigitalStudents(
        assignTeacher.id,
        [studentUid],
      );

    toast.success(
      result?.message ||
        "Digital Student assigned successfully.",
    );

    // Reload students
    const refreshed =
      await getEligibleDigitalStudents(
        assignTeacher.id,
      );

    setEligibleDigitalStudents(
      Array.isArray(refreshed?.students)
        ? refreshed.students
        : [],
    );
  } catch (error) {
    console.error(
      "ASSIGN STUDENT ERROR:",
      error,
    );

    toast.error(
      error?.message ||
        "Failed to assign Digital Student.",
    );
  } finally {
    setAssigningStudentUid(null);
  }
};

  const loadDigitalTeacherStudents =
  async (teacher) => {
    if (!teacher?.id) {
      return;
    }

    try {
      setDigitalStudentsLoading(true);

      const result =
        await getEligibleDigitalStudents(
          teacher.id,
        );

      const students =
        Array.isArray(
          result?.students,
        )
          ? result.students
          : [];

      setEligibleDigitalStudents(
        students,
      );

      setAssignedDigitalStudents(
        students.filter(
          (student) =>
            student?.alreadyAssigned ===
            true,
        ),
      );
    } catch (error) {
      console.error(
        "LOAD DIGITAL STUDENTS ERROR:",
        error,
      );

      toast.error(
        error?.message ||
          "Failed to load assigned Digital Students.",
      );

      setEligibleDigitalStudents([]);
      setAssignedDigitalStudents([]);
    } finally {
      setDigitalStudentsLoading(false);
    }
  };

  const handleRemoveDigitalStudent = async (student) => {
  if (!assignTeacher?.id) {
    toast.error("Digital Teacher not found.");
    return;
  }

  const studentUid =
    student?.uid ||
    student?.id;

  if (!studentUid) {
    toast.error("Digital Student UID not found.");
    return;
  }

  try {
    setRemovingStudentUid(studentUid);

    const result =
      await unassignDigitalStudent(
        assignTeacher.id,
        studentUid,
      );

    toast.success(
      result?.message ||
        "Digital Student removed successfully.",
    );

    // Reload students
    const refreshed =
      await getEligibleDigitalStudents(
        assignTeacher.id,
      );

    setEligibleDigitalStudents(
      Array.isArray(refreshed?.students)
        ? refreshed.students
        : [],
    );
  } catch (error) {
    console.error(
      "REMOVE DIGITAL STUDENT ERROR:",
      error,
    );

    toast.error(
      error?.message ||
        "Failed to remove Digital Student.",
    );
  } finally {
    setRemovingStudentUid(null);
  }
};

  const lastDocRef = useRef(null);

  const fetchClasses = async () => {
    try {
      const result = await getDigitalTeachers();
      const all = result?.teachers || result?.data || [];
      const classSet = new Set();

      all
        .filter((teacher) => teacher.status === "approved")
        .forEach((teacher) => {
          const assignedClasses =
            teacher?.teachingAssignment?.classes || [];

          assignedClasses.forEach((className) => {
            const value = String(className || "").trim();
            if (value) classSet.add(value);
          });
        });

      setClasses(
        Array.from(classSet).sort((a, b) =>
          String(a).localeCompare(String(b), undefined, { numeric: true }),
        ),
      );
    } catch (error) {
      console.error("Digital classes error:", error);
      setClasses([]);
    }
  };

  const fetchTeachers = useCallback(async () => {
  try {
    setLoading(true);

    const result = await getDigitalTeachers();

    console.log("DIGITAL TEACHERS:", result);

    let teachersData =
      result.teachers ||
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

      teachersData =
        teachersData.filter((teacher) => {
          const searchableText = [
            teacher.fullName,
            teacher.teacherName,
            teacher.digitalTeacherEmail,
            teacher.email,
            teacher.phone,
            teacher.digitalAdmissionNumber,
            teacher.oldRegistrationNumber,
            teacher.madarsaName,
            teacher.guardianName,
            teacher.guardianPhone,
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
      teachersData =
        teachersData.filter(
          (teacher) =>
            (teacher.accountStatus ||
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
      teachersData =
        teachersData.filter((teacher) => {
          const gender =
            (
              teacher.gender || ""
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
      teachersData = teachersData.filter((teacher) => {
        const assignedClasses =
          teacher?.teachingAssignment?.classes || [];

        return assignedClasses.some(
          (className) => String(className) === String(filterClass),
        );
      });
    }

    // ----------------------------
    // ONLY APPROVED TEACHERS 
    // ----------------------------

    teachersData =
      teachersData.filter(
        (teacher) =>
          teacher.status ===
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

    teachersData.sort(
      (a, b) =>
        toMs(b.createdAt) -
        toMs(a.createdAt)
    );

    // ----------------------------
    // PAGINATION
    // ----------------------------

    setTotalTeachers(
      teachersData.length
    );

    setTotalPages(
      Math.ceil(
        teachersData.length /
          itemsPerPage
      )
    );

    const startIndex =
      (currentPage - 1) *
      itemsPerPage;

    setTeachers(
      teachersData.slice(
        startIndex,
        startIndex +
          itemsPerPage
      )
    );
  } catch (error) {
    console.error(
      "Error fetching Digital teachers:",
      error
    );

    toast.error(
      error.message ||
        "Failed to load Digital teachers."
    );

    setTeachers([]);
    setTotalTeachers(0);
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

  // Fetch static metadata once on mount
  useEffect(() => {
    
    fetchClasses();
  }, []);

  // Fetch teachers list and stats counts when page or filters change
  useEffect(() => {
    fetchStatsCounts();
    fetchTeachers();
  }, [fetchTeachers, fetchStatsCounts]);

  useEffect(() => {
    const missingPhotoTeacher = teachers.filter((teacher) => {
      const pic =
        pickUrl(teacher.profilePicture) || pickUrl(teacher.profilePictureUrl);
      return !pic || isDisabledCloudinaryUrl(pic);
    });
    if (!missingPhotoTeacher.length) return;

    let cancelled = false;
    const hydrateMissingProfilePictures = async () => {
      for (const teacher of missingPhotoTeacher.slice(0, 20)) {
        const teacherDocId = teacher.uid || teacher.id;
        if (
          !teacherDocId ||
          pendingProfilePictureFixes.current.has(teacherDocId)
        )
          continue;

        pendingProfilePictureFixes.current.add(teacherDocId);
        try {
          const existingPic =
            pickUrl(teacher.profilePicture) ||
            pickUrl(teacher.profilePictureUrl);
          const profilePic = await resolveAndPersistProfilePicture(teacher, {
            failedUrls: isDisabledCloudinaryUrl(existingPic)
              ? [existingPic]
              : [],
          });
          if (profilePic && !cancelled) {
            setTeachers((prev) =>
              prev.map((s) =>
                (s.uid || s.id) === teacherDocId
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
  }, [teachers]);

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

  // Fetch teacher when page or filters change
  useEffect(() => {
    if (debouncedSearchTerm !== null) {
      // Only fetch after initial load
      fetchTeachers();
    }
  }, [
    fetchTeachers,
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
 const handleViewTeacher =
  async (teacher) => {
    setSelectedTeacher(teacher);

    setAssignedDigitalStudents([]);
    setEligibleDigitalStudents([]);

    setDetailsOpen(true);

    await loadDigitalTeacherStudents(
      teacher,
    );
  };

  const handleOpenAssignStudents =
  async (teacher) => {
    if (!teacher?.id) {
      toast.error(
        "Digital Teacher ID not found.",
      );

      return;
    }

    setAssignTeacher(teacher);

    setEligibleDigitalStudents([]);

    setAssignStudentsOpen(true);

    try {
      setDigitalStudentsLoading(true);

      const result =
        await getEligibleDigitalStudents(
          teacher.id,
        );

      setEligibleDigitalStudents(
        Array.isArray(
          result?.students,
        )
          ? result.students
          : [],
      );
    } catch (error) {
      console.error(
        "LOAD DIGITAL STUDENTS ERROR:",
        error,
      );

      toast.error(
        error?.message ||
          "Failed to load Digital Students.",
      );
    } finally {
      setDigitalStudentsLoading(false);
    }
  };


 const handleStatusChange = async (
  teacherId,
  newStatus
) => {
  try {
    await updateDigitalTeacher(
      teacherId,
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
      "Digital teacher status updated"
    );

    await fetchTeachers();
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

const handleInactiveTeacher =
  async (teacher, reason = "") => {
    try {
      await updateDigitalTeacher(
        teacher.id,
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
        `${teacher.fullName} marked inactive`
      );

      await fetchTeachers();
      await fetchStatsCounts();
    } catch (error) {
      toast.error(
        error.message ||
          "Failed to make teacher inactive"
      );
    }
  };
  const handleSuspendClick = (teacher) => {
    setSelectedTeacherForAction(teacher);
    setSuspensionReason("");
    setSuspendDialogOpen(true);
  };

 const handleSuspendTeacher =
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
      await updateDigitalTeacher(
        selectedTeacherForAction.id,
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
        `${selectedTeacherForAction.fullName} suspended`
      );

      setSuspendDialogOpen(false);
      setSuspensionReason("");
      setSelectedTeacherForAction(
        null
      );

      await fetchTeachers();
      await fetchStatsCounts();
    } catch (error) {
      console.error(
        "Suspend error:",
        error
      );

      toast.error(
        error.message ||
          "Failed to suspend teacher"
      );
    }
  };

  const handleActivateClick = (teacher) => {
    setSelectedTeacherForAction(teacher);
    setActivateDialogOpen(true);
  };

  const handleActivateTeacher =
  async () => {
    try {
      await updateDigitalTeacher(
        selectedTeacherForAction.id,
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
        `${selectedTeacherForAction.fullName} activated`
      );

      setActivateDialogOpen(false);

      setSelectedTeacherForAction(
        null
      );

      await fetchTeachers();
      await fetchStatsCounts();
    } catch (error) {
      console.error(
        "Activate error:",
        error
      );

      toast.error(
        error.message ||
          "Failed to activate teacher"
      );
    }
  };
  const fetchAllTeachersForDownload =
  async () => {
    try {
      const result =
        await getDigitalTeachers();

      const all =
        result.teachers ||
        result.data ||
        [];

      return all.filter(
        (teacher) =>
          teacher.status === "approved"
      );
    } catch (error) {
      console.error(
        "Error fetching Digital teachers for export:",
        error
      );

      throw error;
    }
  };

  const downloadTeacherData = async () => {
    const toastId = toast.loading("Exporting Teachers Data");

    try {
      let dataToExport = [];
  
        // Global fetch (no scope selected)
        if (allTeachers.length === 0) {
          const fetched = await fetchAllTeachersForDownload();
          setAllTeachers(fetched); // Cache global data
          dataToExport = fetched;
        } else {
          dataToExport = allTeachers;
        }
      

      // Apply current client-side filters (Status, Class, Gender, Search)
      const filteredAllTeachers = dataToExport.filter((teacher) => {
        const q = (debouncedSearchTerm || "").toLowerCase();
        const matchesSearch =
          (teacher.fullName || "").toLowerCase().includes(q) ||
          (teacher.digitalTeacherEmail || "").toLowerCase().includes(q) ||
          (teacher.phone || "").toLowerCase().includes(q) ||
          (teacher.madarsaId || "").toLowerCase().includes(q);

        return matchesSearch && teacherMatchesClientFilters(teacher, { statusMode: "any" });
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
          "Digital Teacher Email",
          "Phone",
          "Date of Birth",
          "Gender",
          "Address",
          "Aadhar Number",                  
          "MHR Id",          
          "Digital Admission Number",
          "Old Registration Number",
          "Admission Date",
          "Guardian Name",                    
          "Guardian Phone",          
          "Madrasa",          
          "Status",
          "Teaching Experience",
         
          "Date Created",
          "Last Updated",
        ].join(","),
        ...filteredAllTeachers.map((teacher) =>
          [
            escapeCSV(formatTeacherName(teacher.fullName)),
            escapeCSV(teacher.digitalTeacherEmail || "N/A"),
            escapeCSV(teacher.phone),
            escapeCSV(teacher.dateOfBirth),
            escapeCSV(teacher.gender),
            escapeCSV(teacher.address),
            escapeCSV(
              teacher.aadharNumber
                ? `XXXX-XXXX-${teacher.aadharNumber.slice(-4)}`
                : "N/A",
            ),
           escapeCSV(teacher.mhrId || teacher.mhrId),
           escapeCSV(teacher.digitalAdmissionNumber),
           escapeCSV(
              teacher.oldRegistrationNumber || "N/A"
            ),
            escapeCSV(
              teacher.createdAt
                ? new Date(teacher.createdAt).toLocaleDateString()
                : "",
            ),
            escapeCSV(teacher.guardianName),
            escapeCSV(teacher.guardianPhone || teacher.parentDetails?.phone),
            escapeCSV(teacher.madarsaName || "N/A"),
            escapeCSV(teacher.accountStatus || "active"),
            escapeCSV(teacher?.qualification
                        ?.islamicEducation
                        ?.teachingExperience || "Nill"),
           
            escapeCSV(
              (() => {
                const date = convertTimestampToDate(teacher.createdAt || teacher.admissionDate || teacher.joinedDate);
                return date ? date.toLocaleDateString() : "";
              })(),
            ),
            escapeCSV(
              (() => {
                const date = convertTimestampToDate(teacher.updatedAt);
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
      a.download = `all_teachers_${new Date().toISOString().split("T")[0]}.csv`;
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
      
      let allTeachersData = [];
      
      
        if (allTeachers.length === 0) {
          const fetched = await fetchAllTeachersForDownload();
          setAllTeachers(fetched);
          allTeachersData = fetched;
        } else {
          allTeachersData = allTeachers;
        }
     

      const q = debouncedSearchTerm.toLowerCase();
      const filteredAllTeachers = allTeachersData.filter((teacher) => {
        const matchesSearch =
          (teacher.fullName || "").toLowerCase().includes(q) ||
          (teacher.digitalAdmissionNumber || "").toLowerCase().includes(q) ||
          (teacher.digitalTeacherEmail || "").toLowerCase().includes(q) ||
          (teacher.phone || "").toLowerCase().includes(q) ||
          (teacher.madarsaName || "").toLowerCase().includes(q);

        return matchesSearch && teacherMatchesClientFilters(teacher, { statusMode: "any" });
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
      doc.text("All Teachers Master Report", 40, 26);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 235, 26);
      
      const tableColumn = [
        "#", 
           "Madrasa", 
        "Name", 
        "MSR ID", 
        "Gender", 
        "Phone", 
        "Status",
        "Teaching Experience"
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

      const tableRows = filteredAllTeachers.map((teacher, index) => [
        index + 1,
        teacher.madarsaName || "N/A",
        formatTeacherName(teacher.fullName),
        teacher.mhrId || teacher.mhrId || "N/A",
        teacher.gender ? teacher.gender.charAt(0).toUpperCase() + teacher.gender.slice(1) : "N/A",
           cleanPhoneForPdf(teacher.phone || teacher.mobileNumber || teacher.guardianPhone || "N/A"),
        teacher.accountStatus || "active",
        teacher?.qualification
                        ?.islamicEducation
                        ?.teachingExperience || "nill"
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
               1: { halign: "left", cellWidth: 46 },      // Previous Madrasa
          2: { halign: "center", cellWidth: 16 },    // MID
          3: { halign: "left", cellWidth: 47 },      // Name
   
          4: { halign: "center", cellWidth: 15 },    // Gender
         
          5: { halign: "center", cellWidth: 36 },    // Phone
          6: { halign: "center", cellWidth: 18 },    // Status
          7: { halign: "center", cellWidth: 20 }    // Payment Status
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 35, left: 10, right: 10 }
      });
      
      doc.save(`all_teachers_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success(`Successfully exported ${filteredAllTeachers.length} teachers to PDF`, { id: toastId });
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
              All Teachers
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Manage teachers across all madarsas
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
            <Button onClick={downloadTeacherData} className="w-full lg:w-auto">
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
                        Total Teachers
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

        {/* Suspended Teachers Toggle */}
        <div className="flex justify-center items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              Show Suspended Teachers
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

        {/* Teachers Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-lg md:text-xl">
                Teachers List ({totalTeachers})
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
                  Loading teachers...
                </p>
              </div>
            ) : teachers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 md:h-16 md:w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-sm md:text-base">
                  No teachers found matching the current filters.
                </p>
              </div>
            ) : viewMode === "table" ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[900px] w-full">
                  <TableHeader>
                    <TableRow>
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
                        Madrasa
                      </TableHead>
                      <TableHead className="whitespace-nowrap w-[60px]">
                        MSR ID
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-center w-[140px]">
                        Status
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-center w-[140px]">
                        Teaching Experience
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
                      : teachers.map((teacher) => (
                          <TableRow key={teacher.id}>
                            <TableCell className="font-medium w-[160px] max-w-[160px]">
                              <div className="min-w-0">
                                <div
                                  className="truncate font-semibold text-sm"
                                  title={
                                    formatTeacherName(teacher.fullName) || "N/A"
                                  }
                                >
                                  {formatTeacherName(teacher.fullName) || "N/A"}
                                </div>
                                
                              </div>
                            </TableCell>
                            <TableCell className="w-[190px] max-w-[190px]">
                              <div
                                className="truncate text-sm"
                                title={teacher.digitalTeacherEmail || "N/A"}
                              >
                                {teacher.digitalTeacherEmail || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell className="w-[110px]">
                              <span
                                className="font-mono text-xs bg-gray-100 px-2 py-1 rounded block truncate"
                                title={teacher.password || "N/A"}
                              >
                                {teacher.password || "N/A"}
                              </span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap w-[130px] text-sm">
                              {teacher.phone || "N/A"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap w-[100px] text-sm">
                              {teacher.madarsaName || "N/A"}
                            </TableCell>
                            <TableCell>
                              {normalizeClassDisplay(teacher.mhrId) ||
                                "N/A"}
                            </TableCell>
                            <TableCell className="text-center w-[140px]">
                              <div className="flex flex-col items-center gap-1.5 mx-auto">
                                <Badge
                                  className={`justify-center font-medium ${
                                    teacher.accountStatus === "active"
                                      ? "bg-green-100 text-green-800 border-green-300"
                                      : teacher.accountStatus === "suspended"
                                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                        : "bg-gray-100 text-gray-800 border-gray-300"
                                  }`}
                                >
                                  {teacher.accountStatus === "active"
                                    ? "Active"
                                    : teacher.accountStatus === "suspended"
                                      ? "Suspended"
                                      : teacher.accountStatus || "Active"}
                                </Badge>
                                {teacher.accountStatus === "active" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-yellow-700 border-yellow-400 hover:bg-yellow-50 h-7 text-xs w-full"
                                    onClick={() => handleSuspendClick(teacher)}
                                  >
                                    Suspend
                                  </Button>
                                )}
                                {teacher.accountStatus === "suspended" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-green-700 border-green-400 hover:bg-green-50 h-7 text-xs w-full"
                                    onClick={() => handleActivateClick(teacher)}
                                  >
                                    Activate
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center w-[140px]">
                             {teacher?.qualification
                        ?.islamicEducation
                        ?.teachingExperience || "Nill"}
                            </TableCell>
                            <TableCell className="hidden md:table-cell whitespace-nowrap text-center">
                              {(() => {
                                const date = convertTimestampToDate(
                                  teacher.createdAt || teacher.admissionDate || teacher.joinedDate,
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
                                onClick={() => {
                                  setSelectedTeacher(
                                    teacher,
                                  );

                                  setDetailsOpen(
                                    true,
                                  );
                                }}
                                className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                  <Eye className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="border-[#7f2af2] text-[#7f2af2] hover:bg-[#7f2af2]/10"
                                  onClick={() => handleEditTeacher(teacher)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => setDeleteTeacherId(teacher.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button  type="button"
                                  onClick={() =>
                                  handleOpenAssignStudents(
                                  teacher,
                                  )}
                                  variant="outline"
                                  size="icon" >
                                <UserPlus className="h-3.5 w-3.5" />
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
                {teachers.map((teacher) => (
                  <Card
                    key={teacher.id}
                    className="border-l-4 border-l-blue-500 shadow-sm"
                  >
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        {/* Header Section with Profile Picture */}
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex gap-3 flex-1 min-w-0">
                            {/* Profile Picture */}
                            <div className="shrink-0">
                              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
                                <ProfileImage
                                  src={teacher.profilePicture}
                                  sourceData={teacher}
                                  onResolved={(profilePic) => {
                                    setTeachers((prev) =>
                                      prev.map((s) =>
                                        (s.uid || s.id) ===
                                        (teacher.uid || teacher.id)
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
                                    formatTeacherName(teacher.fullName) ||
                                    "Teacher"
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
                                {formatTeacherName(teacher.fullName) || "N/A"}
                              </h3>
                              {teacher.digitalAdmissionNumber && (
                                <p className="text-xs text-teal-700 font-mono mt-0.5 truncate">
                                  {teacher.digitalAdmissionNumber}
                                </p>
                              )}
                              <p className="text-sm text-gray-600 truncate mt-1">
                                {teacher.digitalTeacherEmail || "N/A"}
                              </p>
                              <p className="text-xs text-gray-500 font-mono mt-1">
                                Pass: {teacher.password || "N/A"}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={
                              teacher.accountStatus === "active"
                                ? "default"
                                : teacher.accountStatus === "inactive"
                                  ? "secondary"
                                  : "destructive"
                            }
                            className="text-xs px-2 py-1 shrink-0"
                          >
                            {teacher.accountStatus || "active"}
                          </Badge>
                        </div>

                        {/* Information Grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div className="min-w-0">
                            <p className="text-gray-500 text-xs font-medium mb-1">
                              Phone
                            </p>
                            <p className="font-medium text-gray-900 truncate">
                              {teacher.phone || "N/A"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-gray-500 text-xs font-medium mb-1">
                              MSR ID
                            </p>
                            <p className="font-medium text-gray-900 truncate">
                              {normalizeClassDisplay(teacher.mhrId) ||
                                "N/A"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-gray-500 text-xs font-medium mb-1">
                              Madrasa
                            </p>
                            <p className="font-medium text-gray-900 truncate">
                              {teacher.madarsaName || "N/A"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-gray-500 text-xs font-medium mb-1">
                              Joined
                            </p>
                            <p className="font-medium text-gray-900 text-xs">
                              {(() => {
                                const date = convertTimestampToDate(
                                  teacher.createdAt || teacher.admissionDate || teacher.joinedDate,
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
                                  teacher.accountStatus === "active"
                                    ? "bg-green-100 text-green-800"
                                    : teacher.accountStatus === "suspended"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-gray-100 text-gray-800"
                                }
                              >
                                {teacher.accountStatus || "active"}
                              </Badge>
                              {teacher.accountStatus === "active" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-yellow-600 border-yellow-600 h-7 text-xs flex-1"
                                  onClick={() => handleSuspendClick(teacher)}
                                >
                                  Suspend
                                </Button>
                              )}
                              {teacher.accountStatus === "suspended" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 border-green-600 h-7 text-xs flex-1"
                                  onClick={() => handleActivateClick(teacher)}
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
                              onClick={() => handleViewTeacher(teacher)}
                              className="h-8 text-xs px-2 flex items-center justify-center text-black"
                            >
                              <Eye className="h-3 w-3 mr-1 text-black" />
                              <span className="hidden xs:inline">View</span>
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleEditTeacher(teacher)}
                              className="h-8 text-xs px-2 flex items-center justify-center"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              <span className="hidden xs:inline">Edit</span>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteTeacherId(teacher.id)}
                              disabled={deleteSubmitting}
                              className="h-8 text-xs px-2 flex items-center justify-center"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              <span className="hidden xs:inline">Delete</span>
                            </Button>
                            <Button  type="button"
                              onClick={() =>
                              handleOpenAssignStudents(
                              teacher,
                              )
                              }
                                variant="outline"
                               size="sm"
                               className="h-8 text-xs px-2 flex items-center justify-center">
                              <UserPlus className="h-3 w-3 mr-1" />
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
            {!loading && totalTeachers > 0 && (
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t-2 border-gray-200 px-2 sm:px-0">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={totalTeachers}
                />
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Page {currentPage} of {totalPages} | Total: {totalTeachers} |
                  Items per page: {itemsPerPage}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Delete Teacher Confirmation Dialog */}
        <Dialog
          open={!!deleteTeacherId}
          onOpenChange={(v) => {
            if (!v) setDeleteTeacherId(null);
          }}
        >
          <DialogContent className="max-w-full sm:max-w-md w-11/12 sm:w-full bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                Delete Teacher
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 text-sm sm:text-base">
              Are you sure you want to delete this teacher? This action cannot
              be undone.
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTeacherId(null)}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteTeacher}
                disabled={deleteSubmitting}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {deleteSubmitting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {/* Edit Teacher Dialog */}
        <Dialog
          className="!bg-white"
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        >
          <DialogContent className="max-w-full sm:max-w-2xl w-11/12 sm:w-full bg-white overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                Edit Teacher Info
              </DialogTitle>
            </DialogHeader>
            {editForm && (
              <form onSubmit={handleEditTeacherSubmit} className="space-y-4">
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
                      value={editForm.digitalTeacherEmail || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, digitalTeacherEmail: e.target.value }))
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
                      MHR ID
                    </label>
                    <Input
                      value={editForm.mhrId || ""}
                      disabled
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Status
                    </label>
                    <Select
                      value={editForm.accountStatus
 || "active"}
                      onValueChange={(v) => {
                        if (v === "inactive" && originalTeacherStatus !== "inactive") {
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
                      Madarsa Name
                    </label>
                    <Input
                      value={editForm.madarsaName || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          madarsaName: e.target.value,
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
                  
                </div>
                
                
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
       {detailsOpen &&
                 selectedTeacher && (
                   <Modal
                     title="Digital Teacher Details"
                     onClose={() =>
                       setDetailsOpen(false)
                     }
                   >
       
                     <div className="space-y-6">
       
                       <InfoSection
                         title="Teacher Information"
                       >
       
                         <InfoField
                           icon={User}
                           label="Full Name"
                           value={
                             selectedTeacher.fullName
                           }
                         />
       
                         <InfoField
                           icon={Phone}
                           label="Phone"
                           value={
                             selectedTeacher.phone
                           }
                         />
       
                         <InfoField
                           icon={Mail}
                           label="Email"
                           value={
                             selectedTeacher.email
                           }
                         />
       
                         <InfoField
                           icon={Building2}
                           label="Madrasa"
                           value={
                             selectedTeacher.madarsaName
                           }
                         />
       
                       </InfoSection>
       
                       <InfoSection
                         title="General Education"
                       >
       
                         <InfoField
                           icon={GraduationCap}
                           label="Qualification"
                           value={
                             selectedTeacher
                               ?.qualification
                               ?.generalEducation
                               ?.highestQualification
                           }
                         />
       
                         <InfoField
                           icon={BookOpen}
                           label="Course"
                           value={
                             selectedTeacher
                               ?.qualification
                               ?.generalEducation
                               ?.courseName
                           }
                         />
       
                         <InfoField
                           icon={Building2}
                           label="Institution"
                           value={
                             selectedTeacher
                               ?.qualification
                               ?.generalEducation
                               ?.institution
                           }
                         />
       
                       </InfoSection>
                       <InfoSection
                         title="Computer Knowledge"
                       >
       <InfoField
                           icon={GraduationCap}
                           label="Level of computer knowledge"
                           value={
                             selectedTeacher
                               ?.qualification
                               ?.computerKnowledge
                               ?.level
                           }
                         />
       <InfoField
                           icon={GraduationCap}
                           label="Other details"
                           value={
                             selectedTeacher
                               ?.qualification
                               ?.computerKnowledge
                               ?.otherDetails
                           }
                         />
       
                       </InfoSection>
       
                       <InfoSection
                         title="Islamic Academic Qualification"
                       >
       
                         <InfoField
                           icon={GraduationCap}
                           label="Qualification"
                           value={
                             selectedTeacher
                               ?.qualification
                               ?.islamicEducation
                               ?.highestQualification
                           }
                         />
       
                         <InfoField
                           icon={BookOpen}
                           label="Course"
                           value={
                             selectedTeacher
                               ?.qualification
                               ?.islamicEducation
                               ?.courseName
                           }
                         />
       
                         <InfoField
                           icon={ShieldCheck}
                           label="Quran Qualification"
                           value={
                             selectedTeacher
                               ?.qualification
                               ?.islamicEducation
                               ?.quranQualification
                           }
                         />
       
                         <InfoField
                           icon={GraduationCap}
                           label="Teaching Experience"
                           value={
                             selectedTeacher
                               ?.qualification
                               ?.islamicEducation
                               ?.teachingExperience
                           }
                         />
       
                       </InfoSection>
       {/* =========================================
    TEACHING ASSIGNMENT
========================================= */}

<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

  {/* Header */}
  <div className="mb-6 flex items-start gap-3">

    <div
      className="
        flex
        h-11
        w-11
        shrink-0
        items-center
        justify-center
        rounded-2xl
        bg-teal-50
        text-teal-600
      "
    >
      <GraduationCap className="h-5 w-5" />
    </div>

    <div>
      <h3 className="text-base font-bold text-slate-900">
        Teaching Assignment
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Classes, subjects and teaching medium assigned by Central Admin.
      </p>
    </div>

  </div>


  {/* Assignment Cards */}
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

    {/* Assigned Classes */}
    <div
      className="
        rounded-2xl
        border
        border-slate-200
        bg-slate-50/70
        p-5
      "
    >
      <p className="mb-4 text-sm font-bold text-slate-900">
        Assigned Classes
      </p>

      <div className="flex flex-wrap gap-2">

        {selectedTeacher
          ?.teachingAssignment
          ?.classes
          ?.length > 0 ? (

          selectedTeacher
            .teachingAssignment
            .classes
            .map((className, index) => (

              <span
                key={`${className}-${index}`}
                className="
                  rounded-full
                  border
                  border-teal-300
                  bg-teal-50
                  px-3
                  py-1.5
                  text-xs
                  font-semibold
                  text-teal-700
                "
              >
                {className}
              </span>

            ))

        ) : (

          <span className="text-sm text-slate-400">
            No classes assigned
          </span>

        )}

      </div>
    </div>


    {/* Assigned Subjects */}
    <div
      className="
        rounded-2xl
        border
        border-slate-200
        bg-slate-50/70
        p-5
      "
    >
      <p className="mb-4 text-sm font-bold text-slate-900">
        Assigned Subjects
      </p>

      <div className="flex flex-wrap gap-2">

        {selectedTeacher
          ?.teachingAssignment
          ?.subjects
          ?.length > 0 ? (

          selectedTeacher
            .teachingAssignment
            .subjects
            .map((subject, index) => (

              <span
                key={`${subject}-${index}`}
                className="
                  rounded-full
                  border
                  border-indigo-300
                  bg-indigo-50
                  px-3
                  py-1.5
                  text-xs
                  font-semibold
                  text-indigo-700
                "
              >
                {subject}
              </span>

            ))

        ) : (

          <span className="text-sm text-slate-400">
            No subjects assigned
          </span>

        )}

      </div>
    </div>


    {/* Teaching Medium */}
    <div
      className="
        rounded-2xl
        border
        border-slate-200
        bg-slate-50/70
        p-5
      "
    >
      <p className="mb-4 text-sm font-bold text-slate-900">
        Teaching Medium
      </p>

      <div className="flex flex-wrap gap-2">

        {selectedTeacher
          ?.teachingAssignment
          ?.languages
          ?.length > 0 ? (

          selectedTeacher
            .teachingAssignment
            .languages
            .map((language, index) => (

              <span
                key={`${language}-${index}`}
                className="
                  rounded-full
                  border
                  border-amber-300
                  bg-amber-50
                  px-3
                  py-1.5
                  text-xs
                  font-semibold
                  text-amber-700
                "
              >
                {language}
              </span>

            ))

        ) : (

          <span className="text-sm text-slate-400">
            No teaching medium assigned
          </span>

        )}

      </div>
    </div>

  </div>

</div>



                       <InfoSection
                         title="Bank Details"
                       >
       
                         <InfoField
                           icon={Landmark}
                           label="Account Holder"
                           value={
                             selectedTeacher
                               ?.bankDetails
                               ?.accountHolderName
                           }
                         />
       
                         <InfoField
                           icon={Landmark}
                           label="Bank"
                           value={
                             selectedTeacher
                               ?.bankDetails
                               ?.bankName
                           }
                         />
       
                         <InfoField
                           icon={Landmark}
                           label="Account Number"
                           value={
                             selectedTeacher
                               ?.bankDetails
                               ?.accountNumber
                           }
                         />
       
                         <InfoField
                           icon={Landmark}
                           label="IFSC"
                           value={
                             selectedTeacher
                               ?.bankDetails
                               ?.ifscCode
                           }
                         />
                         <InfoField
                           icon={Landmark}
                           label="UPI id"
                           value={
                             selectedTeacher
                               ?.bankDetails
                               ?.upiId
                           }
                         />
       
                       </InfoSection>
       
                     </div>
       
                   </Modal>
                 )}
       
       
       
        

        {/* Suspend Teacher Dialog */}
        <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Suspend Teacher</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                You are about to suspend{" "}
                <span className="font-semibold">
                  {selectedTeacherForAction?.fullName}
                </span>
                . Please provide a reason for this action.
              </p>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Reason for Suspension *
                </label>
                <Textarea
                  placeholder="Enter the reason for suspending this teacher..."
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
                    setSelectedTeacherForAction(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSuspendTeacher}
                  disabled={!suspensionReason.trim()}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  Confirm Suspension
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Inactivate Teacher Dialog */}
        <Dialog open={inactivateDialogOpen} onOpenChange={(v) => {
          if (!v) {
            setInactivateDialogOpen(false);
            setInactivationReason("");
            setEditForm((f) => ({ ...f, accountStatus: originalTeacherStatus }));
          }
        }}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Inactivate Teacher</DialogTitle>
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
                  placeholder="Enter the reason for making this teacher inactive..."
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
                    setEditForm((f) => ({ ...f, accountStatus: originalTeacherStatus }));
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

      await updateDigitalTeacher(id, {
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
        "Digital teacher updated and marked inactive"
      );

      setIsEditDialogOpen(false);
      setInactivationReason("");

      await fetchTeachers();
      await fetchStatsCounts();
    } catch (err) {
      console.error(
        "Error updating digital teacher:",
        err
      );

      toast.error(
        err.message ||
          "Failed to update digital teacher"
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

        {/* Activate Teacher Dialog */}
        <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Activate Teacher</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Review the suspension details before reactivating{" "}
                <span className="font-semibold">
                  {selectedTeacherForAction?.fullName}
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
                      {selectedTeacherForAction?.suspensionReason ||
                        "No reason provided"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Suspended On:
                    </span>
                    <p className="text-gray-600">
                      {selectedTeacherForAction?.suspendedAt
                        ? (() => {
                            try {
                              return new Date(
                                selectedTeacherForAction.suspendedAt,
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
                    setSelectedTeacherForAction(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleActivateTeacher}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Confirm Activation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
  open={assignStudentsOpen}
  onOpenChange={(open) => {
    setAssignStudentsOpen(open);

    if (!open) {
      setAssignTeacher(null);
      setEligibleDigitalStudents([]);
    }
  }}
>
  <DialogContent
    className="
      max-h-[90vh]
      max-w-4xl
      overflow-y-auto
      rounded-2xl
      p-0
    "
  >

    {/* Header */}

    <DialogHeader className="border-b border-slate-200 px-6 py-5">

      <DialogTitle className="text-xl font-bold text-slate-900">
        Assign Digital Students
      </DialogTitle>

      <DialogDescription>
        Assign eligible Digital Students to this Digital Teacher.
      </DialogDescription>

    </DialogHeader>


    <div className="space-y-6 p-6">

      {/* =====================================
          TEACHER
      ===================================== */}

      <div
        className="
          flex
          items-center
          gap-4
          rounded-2xl
          border
          border-slate-200
          bg-slate-50
          p-4
        "
      >

        <div
          className="
            flex
            h-12
            w-12
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-teal-100
            text-lg
            font-bold
            text-teal-700
          "
        >
          {(
            assignTeacher?.fullName ||
            assignTeacher?.name ||
            "T"
          )
            .charAt(0)
            .toUpperCase()}
        </div>


        <div className="min-w-0">

          <p className="truncate font-bold text-slate-900">
            {assignTeacher?.fullName ||
              assignTeacher?.name ||
              "Digital Teacher"}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {assignTeacher?.mhrId ||
              assignTeacher?.digitalTeacherEmail ||
              "Digital Teacher"}
          </p>

        </div>

      </div>


      {/* =====================================
          TEACHING ASSIGNMENT
      ===================================== */}

      <div
        className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-5
        "
      >

        <div className="mb-5">

          <h3 className="text-base font-bold text-slate-900">
            Teaching Assignment
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Classes, subjects and teaching medium assigned to this teacher.
          </p>

        </div>


        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

          {/* CLASSES */}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

            <p className="mb-3 text-sm font-bold text-slate-800">
              Assigned Classes
            </p>

            <div className="flex flex-wrap gap-2">

              {assignTeacher
                ?.teachingAssignment
                ?.classes
                ?.length > 0 ? (

                assignTeacher
                  .teachingAssignment
                  .classes
                  .map(
                    (
                      className,
                      index,
                    ) => (

                      <span
                        key={`${className}-${index}`}
                        className="
                          rounded-full
                          border
                          border-teal-200
                          bg-teal-50
                          px-3
                          py-1
                          text-xs
                          font-semibold
                          text-teal-700
                        "
                      >
                        {className}
                      </span>

                    ),
                  )

              ) : (

                <span className="text-sm text-slate-400">
                  No classes assigned
                </span>

              )}

            </div>

          </div>


          {/* SUBJECTS */}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

            <p className="mb-3 text-sm font-bold text-slate-800">
              Assigned Subjects
            </p>

            <div className="flex flex-wrap gap-2">

              {assignTeacher
                ?.teachingAssignment
                ?.subjects
                ?.length > 0 ? (

                assignTeacher
                  .teachingAssignment
                  .subjects
                  .map(
                    (
                      subject,
                      index,
                    ) => (

                      <span
                        key={`${subject}-${index}`}
                        className="
                          rounded-full
                          border
                          border-indigo-200
                          bg-indigo-50
                          px-3
                          py-1
                          text-xs
                          font-semibold
                          text-indigo-700
                        "
                      >
                        {subject}
                      </span>

                    ),
                  )

              ) : (

                <span className="text-sm text-slate-400">
                  No subjects assigned
                </span>

              )}

            </div>

          </div>


          {/* MEDIUM */}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

            <p className="mb-3 text-sm font-bold text-slate-800">
              Teaching Medium
            </p>

            <div className="flex flex-wrap gap-2">

              {assignTeacher
                ?.teachingAssignment
                ?.languages
                ?.length > 0 ? (

                assignTeacher
                  .teachingAssignment
                  .languages
                  .map(
                    (
                      language,
                      index,
                    ) => (

                      <span
                        key={`${language}-${index}`}
                        className="
                          rounded-full
                          border
                          border-amber-200
                          bg-amber-50
                          px-3
                          py-1
                          text-xs
                          font-semibold
                          text-amber-700
                        "
                      >
                        {language}
                      </span>

                    ),
                  )

              ) : (

                <span className="text-sm text-slate-400">
                  No medium assigned
                </span>

              )}

            </div>

          </div>

        </div>

      </div>


      {/* =====================================
          DIGITAL STUDENTS
          NEXT STEP
      ===================================== */}

      <div className="rounded-2xl border border-slate-200 bg-white">

  {/* Header */}
  <div
    className="
      flex
      flex-col
      gap-2
      border-b
      border-slate-200
      px-5
      py-4
      sm:flex-row
      sm:items-center
      sm:justify-between
    "
  >
    <div>
      <h3 className="font-bold text-slate-900">
        Eligible Digital Students
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Students matching this teacher&apos;s assigned class.
      </p>
    </div>

    {!digitalStudentsLoading && (
      <span
        className="
          inline-flex
          w-fit
          rounded-full
          bg-teal-50
          px-3
          py-1
          text-xs
          font-semibold
          text-teal-700
        "
      >
        {eligibleDigitalStudents.length} Student
        {eligibleDigitalStudents.length !== 1
          ? "s"
          : ""}
      </span>
    )}
  </div>


  {/* Loading */}
  {digitalStudentsLoading ? (

    <div className="flex min-h-[180px] items-center justify-center">

      <div className="flex items-center gap-2 text-sm text-slate-500">

        <Loader2 className="h-5 w-5 animate-spin" />

        Loading Digital Students...

      </div>

    </div>

  ) : eligibleDigitalStudents.length === 0 ? (

    /* Empty */

    <div
      className="
        flex
        min-h-[180px]
        flex-col
        items-center
        justify-center
        p-6
        text-center
      "
    >
      <Users className="h-9 w-9 text-slate-300" />

      <p className="mt-3 font-semibold text-slate-700">
        No Eligible Digital Students
      </p>

      <p className="mt-1 text-sm text-slate-500">
        No Digital Students match the assigned classes.
      </p>
    </div>

  ) : (

    /* Student List */

    <div className="divide-y divide-slate-100">

      {eligibleDigitalStudents.map(
        (student) => {

          const studentUid =
            student?.uid ||
            student?.id;

          const isAdding =
            assigningStudentUid ===
            studentUid;

          const studentName =
            student?.fullName ||
            student?.name ||
            student?.studentName ||
            "Digital Student";

          const studentClass =
            student?.studentClass ||
            student?.className ||
            student?.currentClass ||
            student?.class ||
            student?.classLevel ||
            "N/A";

          return (
            <div
              key={studentUid}
              className="
                flex
                flex-col
                gap-4
                px-5
                py-4
                transition
                hover:bg-slate-50/70
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >

              {/* Student Info */}
              <div className="flex min-w-0 items-center gap-3">

                {/* Avatar */}
                <div
                  className="
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-xl
                    bg-teal-50
                    font-bold
                    text-teal-700
                  "
                >
                  {student?.profilePicture ? (

                    <img
                      src={student.profilePicture}
                      alt={studentName}
                      className="h-full w-full object-cover"
                    />

                  ) : (

                    studentName
                      .charAt(0)
                      .toUpperCase()

                  )}
                </div>


                {/* Details */}
                <div className="min-w-0">

                  <div className="flex flex-wrap items-center gap-2">

                    <p className="truncate font-bold text-slate-900">
                      {studentName}
                    </p>

                    {student?.alreadyAssigned && (
                      <span
                        className="
                          rounded-full
                          bg-emerald-50
                          px-2
                          py-0.5
                          text-[11px]
                          font-semibold
                          text-emerald-700
                        "
                      >
                        Assigned
                      </span>
                    )}

                  </div>

                  <div
                    className="
                      mt-1
                      flex
                      flex-wrap
                      items-center
                      gap-x-3
                      gap-y-1
                      text-xs
                      text-slate-500
                    "
                  >

                    <span>
                      ID:{" "}
                      {student?.digitalAdmissionNumber ||
                        student?.studentId ||
                        studentUid ||
                        "N/A"}
                    </span>

                    <span>
                      Class:{" "}
                      <strong className="font-semibold text-slate-700">
                        {studentClass}
                      </strong>
                    </span>

                    {student?.phone && (
                      <span>
                        {student.phone}
                      </span>
                    )}

                  </div>

                </div>

              </div>


              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">

                {/* View */}
                <button
                  type="button"
                  onClick={() =>
                    handleViewAssignStudent(
                      student,
                    )
                  }
                  className="
                    inline-flex
                    h-9
                    items-center
                    justify-center
                    gap-1.5
                    rounded-lg
                    border
                    border-slate-200
                    bg-white
                    px-3
                    text-xs
                    font-semibold
                    text-slate-700
                    transition
                    hover:bg-slate-50
                  "
                >
                  <Eye className="h-3.5 w-3.5" />

                  View
                </button>


                {/* Add */}
                {student?.alreadyAssigned ? (

  <button
    type="button"
    onClick={() =>
      handleRemoveDigitalStudent(
        student,
      )
    }
    disabled={
      removingStudentUid ===
      studentUid
    }
    className="
      inline-flex
      h-9
      items-center
      justify-center
      gap-1.5
      rounded-lg
      border
      border-red-200
      bg-red-50
      px-3
      text-xs
      font-semibold
      text-red-700
      transition
      hover:border-red-300
      hover:bg-red-100
      disabled:cursor-not-allowed
      disabled:opacity-50
    "
  >
    {removingStudentUid ===
    studentUid ? (
      <>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />

        Removing...
      </>
    ) : (
      <>
        <Trash2 className="h-3.5 w-3.5" />

        Remove
      </>
    )}
  </button>

) : (

  <button
    type="button"
    onClick={() =>
      handleAddDigitalStudent(
        student,
      )
    }
    disabled={
      assigningStudentUid ===
      studentUid
    }
    className="
      inline-flex
      h-9
      items-center
      justify-center
      gap-1.5
      rounded-lg
      bg-gradient-to-r
      from-teal-500
      to-emerald-600
      px-3
      text-xs
      font-semibold
      text-white
      transition
      hover:from-teal-600
      hover:to-emerald-700
      disabled:cursor-not-allowed
      disabled:opacity-50
    "
  >
    {assigningStudentUid ===
    studentUid ? (
      <>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />

        Adding...
      </>
    ) : (
      <>
        <UserPlus className="h-3.5 w-3.5" />

        Add
      </>
    )}
  </button>

)}

              </div>

            </div>
          );
        },
      )}

    </div>

  )}

</div>

    </div>

  </DialogContent>
</Dialog>
<Dialog
  open={studentViewOpen}
  onOpenChange={setStudentViewOpen}
>
  <DialogContent className="max-w-lg rounded-2xl">

    <DialogHeader>

      <DialogTitle>
        Digital Student Details
      </DialogTitle>

      <DialogDescription>
        View Digital Student information.
      </DialogDescription>

    </DialogHeader>


    {selectedAssignStudent && (

      <div className="space-y-5 py-3">

        {/* Profile */}
        <div className="flex items-center gap-4">

          <div
            className="
              flex
              h-16
              w-16
              shrink-0
              items-center
              justify-center
              overflow-hidden
              rounded-2xl
              bg-teal-50
              text-xl
              font-bold
              text-teal-700
            "
          >

            {selectedAssignStudent
              ?.profilePicture ? (

              <img
                src={
                  selectedAssignStudent
                    .profilePicture
                }
                alt="Student"
                className="h-full w-full object-cover"
              />

            ) : (

              (
                selectedAssignStudent
                  ?.fullName ||
                selectedAssignStudent
                  ?.name ||
                "S"
              )
                .charAt(0)
                .toUpperCase()

            )}

          </div>


          <div>

            <h3 className="text-lg font-bold text-slate-900">
              {selectedAssignStudent
                ?.fullName ||
                selectedAssignStudent
                  ?.name ||
                "Digital Student"}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {selectedAssignStudent
                ?.digitalAdmissionNumber ||
                selectedAssignStudent
                  ?.studentId ||
                "Digital Student"}
            </p>

          </div>

        </div>


        {/* Details */}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

          <div className="rounded-xl bg-slate-50 p-4">

            <p className="text-xs font-medium text-slate-400">
              Class
            </p>

            <p className="mt-1 font-semibold text-slate-800">
              {selectedAssignStudent
                ?.studentClass ||
                selectedAssignStudent
                  ?.className ||
                selectedAssignStudent
                  ?.currentClass ||
                selectedAssignStudent
                  ?.class ||
                "N/A"}
            </p>

          </div>


          <div className="rounded-xl bg-slate-50 p-4">

            <p className="text-xs font-medium text-slate-400">
              Phone
            </p>

            <p className="mt-1 font-semibold text-slate-800">
              {selectedAssignStudent
                ?.phone ||
                "N/A"}
            </p>

          </div>


          <div className="rounded-xl bg-slate-50 p-4">

            <p className="text-xs font-medium text-slate-400">
              Email
            </p>

            <p className="mt-1 break-all font-semibold text-slate-800">
              {selectedAssignStudent
                ?.email ||
                "N/A"}
            </p>

          </div>


          <div className="rounded-xl bg-slate-50 p-4">

            <p className="text-xs font-medium text-slate-400">
              Status
            </p>

            <p className="mt-1 font-semibold text-slate-800">
              {selectedAssignStudent
                ?.alreadyAssigned
                ? "Already Assigned"
                : "Available"}
            </p>

          </div>

        </div>


        {/* Add from View popup */}

        {!selectedAssignStudent
          ?.alreadyAssigned && (

          <button
            type="button"
            onClick={async () => {
              await handleAddDigitalStudent(
                selectedAssignStudent,
              );

              setStudentViewOpen(
                false,
              );
            }}
            disabled={
              assigningStudentUid ===
              (
                selectedAssignStudent
                  ?.uid ||
                selectedAssignStudent
                  ?.id
              )
            }
            className="
              inline-flex
              h-11
              w-full
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-gradient-to-r
              from-teal-500
              to-emerald-600
              px-4
              font-semibold
              text-white
              hover:from-teal-600
              hover:to-emerald-700
              disabled:opacity-50
            "
          >
            <UserPlus className="h-4 w-4" />

            Add Student to Teacher
          </button>

        )}

      </div>

    )}

  </DialogContent>
</Dialog>
      </div>
    </Layout>
  );
}
