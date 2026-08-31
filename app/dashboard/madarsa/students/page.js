"use client";

import { toast } from "sonner";
import { useState, useEffect, useCallback, useRef } from "react";
import { profileImageSrc } from "@/lib/utils";
import ProfileImage from "@/components/ProfileImage";
import {
  pickUrl,
  resolveAndPersistProfilePicture,
} from "@/lib/profilePictureUtils";
import { useAuth } from "@/lib/authUtils";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Eye,
  Mail,
  Phone,
  Calendar,
  MapPin,
  User,
  GraduationCap,
  Search,
  Filter,
  Edit,
  Trash2,
  Download,
  UserX,
  TrendingUp,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  getDocuments,
  updateDocument,
  deleteDocument,
  COLLECTIONS,
} from "@/lib/firestoreService";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  limit,
  orderBy,
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import useAuthStore from "@/lib/authStore";
import { isStudentEditEnabled } from "@/lib/settingsService";
import Image from "next/image";

// Helper function to safely format dates
const formatDate = (dateValue) => {
  if (!dateValue) return "Not available";

  try {
    // Handle Firestore timestamp objects
    if (dateValue && typeof dateValue.toDate === "function") {
      return dateValue.toDate().toLocaleDateString();
    }

    // Handle regular date strings/objects
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

const ALLOWED_CLASSES_BY_SCOPE = {
  madrasa: new Set(["UKG", "Ukg", "ukg", "LKG", "1", "2", "3"]),
  mekhala: new Set(["4", "6", "8", "9", "11"]),
  state: new Set(["5", "7", "10", "12"]),
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

export default function StudentsManagement() {
  const { user, role } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentResults, setStudentResults] = useState([]);
  const [studentResultsLoading, setStudentResultsLoading] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [studentEditEnabled, setStudentEditEnabled] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [selectedStudentForAction, setSelectedStudentForAction] =
    useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDocs, setLastDocs] = useState({});
  const [hasMore, setHasMore] = useState(true);
  const [genderFilter, setGenderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const ITEMS_PER_PAGE = 10;
  const searchTimeoutRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [totalFilteredCount, setTotalFilteredCount] = useState(0);
  // View Details dialog state
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [viewDetailsStudent, setViewDetailsStudent] = useState(null);
  const [viewDetailsPerf, setViewDetailsPerf] = useState([]);
  const [viewDetailsPerfLoading, setViewDetailsPerfLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const aadharRefs = [useRef(null), useRef(null), useRef(null)];
  const pendingProfilePictureFixes = useRef(new Set());

  const aadharParts = [
    editForm.aadharNumber?.substring(0, 4) || "",
    editForm.aadharNumber?.substring(4, 8) || "",
    editForm.aadharNumber?.substring(8, 12) || "",
  ];

  const handleAadharChange = (index, value) => {
    // Only allow digits and max 4 per box
    const cleaned = value.replace(/\D/g, "").substring(0, 4);

    const newParts = [...aadharParts];
    newParts[index] = cleaned;

    const combined = newParts.join("");
    handleEditFormChange("aadharNumber", combined);

    // Auto focus next box
    if (cleaned.length === 4 && index < 2) {
      aadharRefs[index + 1].current?.focus();
    }
  };

  const handleAadharKeyDown = (index, e) => {
    if (e.key === "Backspace" && !aadharParts[index] && index > 0) {
      aadharRefs[index - 1].current?.focus();
    }
  };

  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !viewDetailsStudent) return;
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
      const studentDocId = viewDetailsStudent.uid || viewDetailsStudent.id;
      await updateDocument(COLLECTIONS.STUDENTS, studentDocId, {
        profilePicture: downloadURL,
      });
      // Also update admission doc if available
      if (viewDetailsStudent.admissionId) {
        try {
          const { doc: docRef, updateDoc: firestoreUpdateDoc } =
            await import("firebase/firestore");
          await firestoreUpdateDoc(
            docRef(db, "admissions", viewDetailsStudent.admissionId),
            { profilePicture: downloadURL },
          );
        } catch (_) {}
      }
      setViewDetailsStudent((prev) =>
        prev ? { ...prev, profilePicture: downloadURL } : prev,
      );
      setStudents((prev) =>
        prev.map((s) =>
          s.uid === studentDocId || s.id === studentDocId
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

  const handleViewDetails = async (student) => {
    setViewDetailsStudent(student);
    setViewDetailsPerf([]);
    setViewDetailsPerfLoading(true);
    setViewDetailsOpen(true);

    // ── Resolve profile picture if missing on the student object ──────────
    const hasValidPic = (url) =>
      typeof url === "string" && url?.startsWith?.("http");
    if (
      !hasValidPic(student.profilePicture) &&
      !hasValidPic(student.profilePictureUrl)
    ) {
      (async () => {
        try {
          const existingPic =
            pickUrl(student.profilePicture) ||
            pickUrl(student.profilePictureUrl);
          const profilePic = await resolveAndPersistProfilePicture(
            {
              // Spread the full student object so every field is available
              ...student,
              // Explicit aliases
              id: student.uid || student.id,
              uid: student.uid || student.id,
            },
            {
              failedUrls: isDisabledCloudinaryUrl(existingPic)
                ? [existingPic]
                : [],
            },
          );

          if (profilePic) {
            console.log(
              "✅ [ProfilePic] Resolved via utility:",
              profilePic.slice(0, 70),
            );
            setViewDetailsStudent((prev) =>
              prev ? { ...prev, profilePicture: profilePic } : prev,
            );
          } else {
            console.warn(
              "[ProfilePic] No profilePicture found for:",
              student?.fullName,
              student?.admissionNumber,
            );
          }
        } catch (e) {
          console.warn("[ProfilePic] resolveProfilePicture error:", e?.message);
        }
      })();
    }
    // ────────────────────────────────────────────────────────────────────────

    try {
      const sid = student.uid || student.id;
      const admNo = student.admissionNumber;
      console.log("[ViewDetails] student id:", sid, "admissionNumber:", admNo);

      // --- Step 1: collect all exam registrations via multiple fallbacks ---
      const regMap = new Map(); // docId -> reg data

      // by studentId (primary)
      if (sid) {
        const snap = await getDocs(
          query(
            collection(db, "examRegistrations"),
            where("studentId", "==", sid),
          ),
        );
        snap.docs.forEach((d) => regMap.set(d.id, { id: d.id, ...d.data() }));
        console.log("[ViewDetails] regs by studentId:", snap.size);
      }
      // by admissionNumber (fallback)
      if (admNo) {
        const snap = await getDocs(
          query(
            collection(db, "examRegistrations"),
            where("admissionNumber", "==", admNo),
          ),
        );
        snap.docs.forEach((d) => regMap.set(d.id, { id: d.id, ...d.data() }));
        console.log("[ViewDetails] regs by admissionNumber:", snap.size);
      }

      const regs = Array.from(regMap.values());
      console.log("[ViewDetails] total unique registrations:", regs.length);

      // --- Step 2: collect published results via multiple fallbacks ---
      const resultMap = new Map(); // docId -> result data

      // by studentId in results collection
      if (sid) {
        const snap = await getDocs(
          query(collection(db, "results"), where("studentId", "==", sid)),
        );
        snap.docs.forEach((d) => {
          if (d.data().isPublished)
            resultMap.set(d.id, { id: d.id, ...d.data() });
        });
        console.log("[ViewDetails] results by studentId:", snap.size);
      }
      // by admissionNumber in results collection
      if (admNo) {
        const snap = await getDocs(
          query(
            collection(db, "results"),
            where("admissionNumber", "==", admNo),
          ),
        );
        snap.docs.forEach((d) => {
          if (d.data().isPublished)
            resultMap.set(d.id, { id: d.id, ...d.data() });
        });
        console.log("[ViewDetails] results by admissionNumber:", snap.size);
      }

      // --- Step 3: build combined display list ---
      // First from registrations (with result overlay)
      const displayMap = new Map(); // key = examId
      const fetched = await Promise.all(
        regs.map(async (reg) => {
          let examName = reg.examTitle || reg.examName || "";
          if (!examName && reg.examId) {
            try {
              const es = await getDoc(doc(db, "exams", reg.examId));
              if (es.exists())
                examName = es.data().title || es.data().name || reg.examId;
            } catch (_) {}
          }
          let status = "",
            totalObtained = 0,
            totalMax = 0,
            subjects = [],
            uploadDate = null,
            hasResult = false;
          if (reg.examId && reg.hallTicketNumber) {
            try {
              const rs = await getDoc(
                doc(db, "results", `${reg.examId}_${reg.hallTicketNumber}`),
              );
              if (rs.exists()) {
                const r = rs.data();
                hasResult = true;
                status = r.status || "";
                subjects = r.subjects || [];
                totalObtained = subjects.reduce(
                  (s, sub) => s + (Number(sub.marks) || 0),
                  0,
                );
                totalMax = subjects.reduce(
                  (s, sub) =>
                    s + (Number(sub.totalMarks || sub.maxMarks || 0) || 0),
                  0,
                );
                uploadDate = r.uploadedAt?.toDate
                  ? r.uploadedAt.toDate()
                  : r.updatedAt?.toDate
                    ? r.updatedAt.toDate()
                    : null;
              }
            } catch (_) {}
          }
          const entry = {
            examName: examName || `Exam (${reg.examId || "Unknown"})`,
            examId: reg.examId,
            hallTicketNumber: reg.hallTicketNumber,
            status,
            totalObtained,
            totalMax,
            subjects,
            uploadDate:
              uploadDate ||
              (reg.createdAt?.toDate ? reg.createdAt.toDate() : null),
            hasResult,
          };
          if (reg.examId) displayMap.set(reg.examId, entry);
          return entry;
        }),
      );

      // Also add any results not already covered by registrations
      for (const r of resultMap.values()) {
        if (r.examId && !displayMap.has(r.examId)) {
          let examName = r.examName || r.examTitle || r.title || "";
          if (!examName && r.examId) {
            try {
              const es = await getDoc(doc(db, "exams", r.examId));
              if (es.exists())
                examName = es.data().title || es.data().name || r.examId;
            } catch (_) {}
          }
          const subjects = r.subjects || [];
          const totalObtained = subjects.reduce(
            (s, sub) => s + (Number(sub.marks) || 0),
            0,
          );
          const totalMax = subjects.reduce(
            (s, sub) => s + (Number(sub.totalMarks || sub.maxMarks || 0) || 0),
            0,
          );
          const uploadDate = r.uploadedAt?.toDate
            ? r.uploadedAt.toDate()
            : r.updatedAt?.toDate
              ? r.updatedAt.toDate()
              : null;
          displayMap.set(r.examId, {
            examName: examName || `Exam (${r.examId})`,
            examId: r.examId,
            hallTicketNumber: r.hallTicketNumber,
            status: r.status || "",
            totalObtained,
            totalMax,
            subjects,
            uploadDate,
            hasResult: true,
          });
        }
      }

      const valid = Array.from(displayMap.values()).sort(
        (a, b) =>
          (b.uploadDate?.getTime?.() || 0) - (a.uploadDate?.getTime?.() || 0),
      );
      console.log("[ViewDetails] final display entries:", valid.length);
      setViewDetailsPerf(valid);
    } catch (err) {
      console.error("[ViewDetails] Error fetching student performance:", err);
    } finally {
      setViewDetailsPerfLoading(false);
    }
  };

  // Use static class options to avoid fetching all students just for filter
  const CLASS_OPTIONS = [
    "LKG",
    "UKG",
    ...Array.from({ length: 12 }, (_, i) => (i + 1).toString()),
  ];

  const scopeAllowedSet = ALLOWED_CLASSES_BY_SCOPE[scopeFilter] || null;
  const visibleClassOptions = scopeAllowedSet
    ? CLASS_OPTIONS.filter(
        (c) =>
          scopeAllowedSet.has(String(c).toUpperCase()) ||
          scopeAllowedSet.has(c),
      )
    : CLASS_OPTIONS;

  const [totalStats, setTotalStats] = useState({
    total: 0,
    active: 0,
    suspended: 0,
    inactive: 0,
    thisYear: 0,
  });
  const { userData } = useAuthStore();

  // Debounced search and filter effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Reset pagination when filters change
    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
      setLastDocs({});
      fetchStudents(1);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [
    searchTerm,
    scopeFilter,
    classFilter,
    genderFilter,
    statusFilter,
    userData?.madarsaId,
  ]);

  // Reset class if it's outside the selected scope
  useEffect(() => {
    if (!scopeAllowedSet) return;
    if (classFilter === "all") return;

    const normalized = String(classFilter).toUpperCase();
    if (!scopeAllowedSet.has(normalized)) {
      setClassFilter("all");
    }
  }, [scopeFilter, scopeAllowedSet, classFilter]);

  useEffect(() => {
    const missingPhotoStudents = students.filter((student) => {
      const pic =
        pickUrl(student.profilePicture) || pickUrl(student.profilePictureUrl);
      return !pic || isDisabledCloudinaryUrl(pic);
    });
    if (!missingPhotoStudents.length) return;

    let cancelled = false;
    const hydrateMissingProfilePictures = async () => {
      for (const student of missingPhotoStudents.slice(0, 10)) {
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
            setViewDetailsStudent((prev) =>
              prev && (prev.uid || prev.id) === studentDocId
                ? {
                    ...prev,
                    profilePicture: profilePic,
                    profilePictureUrl: profilePic,
                  }
                : prev,
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

  const fetchStats = async () => {
    if (!userData?.madarsaId) return;

    try {
      const { getCount } = await import("@/lib/firestoreService");
      const { Timestamp } = await import("firebase/firestore"); // Import Timestamp correctly

      // 1. Total Students
      const totalPromise = getCount(COLLECTIONS.STUDENTS, [
        where("madarsaId", "==", userData.madarsaId),
      ]);

      // 2. Active Students
      const activePromise = getCount(COLLECTIONS.STUDENTS, [
        where("madarsaId", "==", userData.madarsaId),
        where("status", "==", "active"),
      ]);

      // 3. This Year Students
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      const thisYearPromise = getCount(COLLECTIONS.STUDENTS, [
        where("madarsaId", "==", userData.madarsaId),
        where("admissionDate", ">=", startOfYear),
        // Note: Depending on where "admissionDate" is stored as Timestamp or string, this might need adjustment.
        // Assuming Timestamp as per recent fixes.
      ]);

      // 4. Suspended Students
      const suspendedPromise = getCount(COLLECTIONS.STUDENTS, [
        where("madarsaId", "==", userData.madarsaId),
        where("status", "==", "suspended"),
      ]);

      const [total, active, thisYear, suspended] = await Promise.all([
        totalPromise,
        activePromise,
        thisYearPromise,
        suspendedPromise,
      ]);
      
      const inactive = total - (active + suspended);

      setTotalStats({
        total,
        active,
        suspended,
        inactive,
        thisYear,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    if (userData?.madarsaId) {
      fetchStats();
    }
  }, [userData?.madarsaId]);

  const fetchStudents = async (page = 1) => {
    if (!userData?.madarsaId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const constraints = [where("madarsaId", "==", userData.madarsaId)];

      // Handle Scope Filter (class grouping)
      if (scopeAllowedSet && classFilter === "all") {
        const allowed = Array.from(scopeAllowedSet);
        const expanded =
          allowed.includes("UKG") || allowed.includes("Ukg")
            ? [...allowed, "ukg", "UKG", "Ukg"]
            : allowed;
        constraints.push(where("classLevel", "in", expanded));
      }

      // Handle Class Filter (if not 'all')
      if (classFilter !== "all") {
        // Generate all case permutations so "UKG" matches "Ukg", "ukg", "UKG" etc.
        const raw = String(classFilter).trim();
        const upper = raw.toUpperCase();

        let allVariants;
        if (/^[A-Z]+$/.test(upper) && upper.length <= 4) {
          // Bitmask: generate every upper/lower combo (e.g. 2^3=8 for UKG)
          const perms = [];
          const n = upper.length;
          for (let mask = 0; mask < 1 << n; mask++) {
            let v = "";
            for (let i = 0; i < n; i++) {
              v += mask & (1 << i) ? upper[i].toLowerCase() : upper[i];
            }
            perms.push(v);
          }
          allVariants = [...new Set([raw, ...perms])];
        } else {
          allVariants = [
            ...new Set([
              raw,
              upper,
              raw.toLowerCase(),
              raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase(),
            ]),
          ];
        }

        // Firestore "in" allows max 10 values
        const uniqueValues = allVariants.slice(0, 10);
        constraints.push(where("classLevel", "in", uniqueValues));
      }

      // Handle Gender Filter
      if (genderFilter !== "all") {
        constraints.push(where("gender", "==", genderFilter));
      }

      // Handle Status Filter
      if (statusFilter !== "all") {
        constraints.push(where("status", "==", statusFilter));
      }

      // Handle Search and Pagination
      let fetchedDocs = [];
      let lastVisible = lastDocs[page - 1] || null;

      const { getPaginatedDocuments, getDocuments } =
        await import("@/lib/firestoreService");

      if (searchTerm) {
        // Client-side search for simplicity as Firestore full-text search is limited
        // Fetch all matching filters first
        const allDocs = await getDocuments(COLLECTIONS.STUDENTS, constraints);
        const filtered = allDocs.filter(
          (student) =>
            student.fullName
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.admissionNumber
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()),
        );

        const start = (page - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        fetchedDocs = filtered.slice(start, end);
        setHasMore(end < filtered.length);
        setTotalFilteredCount(filtered.length);
      } else {
        // Server-side pagination
        const { data, lastDoc } = await getPaginatedDocuments(
          COLLECTIONS.STUDENTS,
          ITEMS_PER_PAGE,
          constraints,
          lastVisible,
        );

        // Fetch total count for the current filters (only on first page or filter change)
        if (page === 1) {
          const { getCount } = await import("@/lib/firestoreService");
          const total = await getCount(COLLECTIONS.STUDENTS, constraints);
          setTotalFilteredCount(total);
        }

        fetchedDocs = data;
        setHasMore(data.length === ITEMS_PER_PAGE);
        if (lastDoc) {
          setLastDocs((prev) => ({ ...prev, [page]: lastDoc }));
        }
      }

      setStudents(
        fetchedDocs.map((s) => ({
          ...s,
          profilePicture:
            s.profilePicture && s.profilePicture.startsWith("http")
              ? s.profilePicture
              : s.profilePictureUrl && s.profilePictureUrl.startsWith("http")
                ? s.profilePictureUrl
                : s.profilePicture || null,
        })),
      );
    } catch (error) {
      console.error("Error fetching students:", error);
      setError("Failed to fetch students");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
    fetchStudents(newPage);
  };

  const checkStudentEditSetting = async () => {
    try {
      const editEnabled = await isStudentEditEnabled();
      setStudentEditEnabled(editEnabled);
    } catch (error) {
      console.error("Error checking student edit setting:", error);
      setStudentEditEnabled(false); // Default to disabled
    }
  };

  useEffect(() => {
    // Check student edit setting only once on component mount
    checkStudentEditSetting();
  }, []);
  const generateStudentPDF = (student) => {
    // Mask Aadhar number - show only last 4 digits
    const maskedAadhar = student.aadharNumber
      ? `XXXX-XXXX-${student.aadharNumber.slice(-4)}`
      : "Not provided";

    const currentDate = new Date().toLocaleDateString();
    const formattedAdmissionDate = formatDate(student.admissionDate);
    const formattedDateOfBirth = formatDate(student.dateOfBirth);

    // Create PDF content
    const printWindow = window.open("", "_blank");
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
                    <div class="info-value">${student.phone}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Date of Birth</div>
                    <div class="info-value">${formattedDateOfBirth}</div>
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
                    <div class="info-value">${student.admissionNumber}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Class Level</div>
                    <div class="info-value">${student.classLevel}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Academic Year</div>
                    <div class="info-value">${student.academicYear}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Admission Date</div>
                    <div class="info-value">${formattedAdmissionDate}</div>
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

    printWindow.document.write(pdfContent);
    printWindow.document.close();
  };

  const handleUpdateStudentStatus = async (studentId, newStatus) => {
    try {
      await updateDocument(COLLECTIONS.STUDENTS, studentId, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      setSuccess(`Student status updated to ${newStatus}`);
      fetchStudents();
    } catch (error) {
      console.error("Error updating student status:", error);
      setError("Failed to update student status");
    }
  };

  const handleSuspendClick = (student) => {
    setSelectedStudentForAction(student);
    setSuspensionReason("");
    setSuspendDialogOpen(true);
  };

  const handleSuspendStudent = async () => {
    if (!suspensionReason.trim()) {
      setError("Please provide a reason for suspension");
      return;
    }

    try {
      await updateDocument(COLLECTIONS.STUDENTS, selectedStudentForAction.id, {
        status: "suspended",
        suspensionReason: suspensionReason.trim(),
        suspendedAt: new Date().toISOString(),
        suspendedBy: userData?.uid || "unknown",
        updatedAt: new Date().toISOString(),
      });
      setSuccess(
        `Student ${selectedStudentForAction.fullName} has been suspended`,
      );
      setSuspendDialogOpen(false);
      setSuspensionReason("");
      setSelectedStudentForAction(null);
      fetchStudents();
    } catch (error) {
      console.error("Error suspending student:", error);
      setError("Failed to suspend student");
    }
  };

  const handleActivateClick = (student) => {
    setSelectedStudentForAction(student);
    setActivateDialogOpen(true);
  };

  const handleActivateStudent = async () => {
    try {
      await updateDocument(COLLECTIONS.STUDENTS, selectedStudentForAction.id, {
        status: "active",
        updatedAt: new Date().toISOString(),
        // Keep suspension history but mark as reactivated
        reactivatedAt: new Date().toISOString(),
        reactivatedBy: userData?.uid || "unknown",
      });
      setSuccess(
        `Student ${selectedStudentForAction.fullName} has been activated`,
      );
      setActivateDialogOpen(false);
      setSelectedStudentForAction(null);
      fetchStudents();
    } catch (error) {
      console.error("Error activating student:", error);
      setError("Failed to activate student");
    }
  };

  const handleDeleteClick = (student) => {
    setSelectedStudentForAction(student);
    setDeleteDialogOpen(true);
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudentForAction) return;

    setDeleteLoading(true);
    try {
      // Use permanent delete (deleteDocument) as requested
      await deleteDocument(COLLECTIONS.STUDENTS, selectedStudentForAction.id);

      setSuccess(
        `Student ${selectedStudentForAction.fullName} has been permanently deleted`,
      );
      setDeleteDialogOpen(false);
      setSelectedStudentForAction(null);
      fetchStudents();
      fetchStats();
    } catch (error) {
      console.error("Error deleting student:", error);
      setError("Failed to delete student");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    // Fetch student results when dialog opens
    setStudentResults([]);
    setStudentResultsLoading(true);
    getDocs(
      query(
        collection(db, "results"),
        where("studentId", "==", student.id),
        orderBy("createdAt", "desc"),
        limit(10),
      ),
    )
      .then((snap) =>
        setStudentResults(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      )
      .catch((err) => console.error("Failed to load student results", err))
      .finally(() => setStudentResultsLoading(false));

    // Helper function to format date for input field
    const formatDateForInput = (dateValue) => {
      if (!dateValue) return "";
      try {
        let date;
        if (dateValue && typeof dateValue.toDate === "function") {
          date = dateValue.toDate();
        } else {
          date = new Date(dateValue);
        }

        if (isNaN(date.getTime())) return "";

        // Format as YYYY-MM-DD for input[type="date"]
        return date.toISOString().split("T")[0];
      } catch (error) {
        console.error("Error formatting date for input:", error);
        return "";
      }
    };

    setEditForm({
      fullName: student.fullName || "",
      email: student.email || "",
      phone: student.phone || "",
      dateOfBirth: formatDateForInput(student.dateOfBirth),
      address: student.address || "",
      aadharNumber: student.aadharNumber || "",
      // admissionNumber and midNumber are system-generated — excluded from editable fields
      classLevel: student.classLevel || "",
      academicYear: student.academicYear || "",
      fatherName: student.fatherName || "",
      motherName: student.motherName || "",
      guardianPhone: student.guardianPhone || "",
      previousEducation: student.previousEducation || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      if (
        editForm.aadharNumber &&
        editForm.aadharNumber.length > 0 &&
        editForm.aadharNumber.length !== 12
      ) {
        setError("Aadhar number must be exactly 12 digits");
        return;
      }

      await updateDocument(COLLECTIONS.STUDENTS, editingStudent.id, {
        ...editForm,
        updatedAt: new Date().toISOString(),
      });

      setSuccess("Student information updated successfully");
      setIsEditDialogOpen(false);
      setEditingStudent(null);
      setEditForm({});
      fetchStudents();
    } catch (error) {
      console.error("Error updating student:", error);
      setError("Failed to update student information");
    }
  };

  const handleEditFormChange = (field, value) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleExportCSV = async () => {
    if (!userData?.madarsaId) return;
    try {
      setExporting(true);

      const constraints = [where("madarsaId", "==", userData.madarsaId)];
      let classLevelFilterValues = null;

      // Apply Class Filter (if not 'all')
      if (classFilter !== "all") {
        const filterValues = [classFilter];
        if (classFilter.toUpperCase() !== classFilter)
          filterValues.push(classFilter.toUpperCase());
        if (classFilter.toLowerCase() !== classFilter)
          filterValues.push(classFilter.toLowerCase());
        const uniqueValues = [...new Set(filterValues)];
        classLevelFilterValues = uniqueValues;
        constraints.push(where("classLevel", "in", uniqueValues));
      }

      // Apply Gender Filter
      if (genderFilter !== "all") {
        constraints.push(where("gender", "==", genderFilter));
      }

      // Apply Status Filter
      if (statusFilter !== "all") {
        constraints.push(where("status", "==", statusFilter));
      }

      const isIndexError = (err) => {
        const message = (err?.message || "").toLowerCase();
        return (
          err?.code === "failed-precondition" ||
          message.includes("requires an index") ||
          message.includes("create it here")
        );
      };

      // Export is not interactive UI pagination, so prefer resilience:
      // 1) Try with server-side filters (no orderBy, to avoid composite indexes)
      // 2) If indexes are still required, fallback to only madarsaId and filter locally
      let snapshot;
      try {
        const q = query(collection(db, COLLECTIONS.STUDENTS), ...constraints);
        snapshot = await getDocs(q);
      } catch (err) {
        if (!isIndexError(err)) throw err;
        console.warn(
          "Export CSV: missing index for filtered query; falling back to client-side filtering.",
          err,
        );
        const fallbackQ = query(
          collection(db, COLLECTIONS.STUDENTS),
          where("madarsaId", "==", userData.madarsaId),
        );
        snapshot = await getDocs(fallbackQ);
      }

      let filteredStudents = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Client-side filter application (keeps behavior consistent across fallback path)
      if (classFilter !== "all" && Array.isArray(classLevelFilterValues)) {
        filteredStudents = filteredStudents.filter((s) =>
          classLevelFilterValues.includes(s.classLevel),
        );
      }
      if (genderFilter !== "all") {
        filteredStudents = filteredStudents.filter(
          (s) => s.gender === genderFilter,
        );
      }
      if (statusFilter !== "all") {
        filteredStudents = filteredStudents.filter(
          (s) => s.status === statusFilter,
        );
      }

      // Client-side search filtering
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredStudents = filteredStudents.filter(
          (student) =>
            student.fullName?.toLowerCase().includes(term) ||
            student.email?.toLowerCase().includes(term) ||
            student.admissionNumber?.toLowerCase().includes(term),
        );
      }

      // Sort client-side to avoid composite index requirements
      const toAdmissionSortKey = (value) => {
        const raw = value === null || value === undefined ? "" : String(value);
        const trimmed = raw.trim();
        if (trimmed === "") return { type: 2, num: 0, str: "" };
        if (/^\d+$/.test(trimmed)) {
          return { type: 0, num: Number(trimmed), str: trimmed };
        }
        return { type: 1, num: 0, str: trimmed.toLowerCase() };
      };
      filteredStudents.sort((a, b) => {
        const ka = toAdmissionSortKey(a.admissionNumber);
        const kb = toAdmissionSortKey(b.admissionNumber);
        if (ka.type !== kb.type) return ka.type - kb.type;
        if (ka.type === 0 && ka.num !== kb.num) return ka.num - kb.num;
        if (ka.str < kb.str) return -1;
        if (ka.str > kb.str) return 1;
        return 0;
      });

      const headers = [
        "Admission Number",
        "Full Name",
        "Gender",
        "Class",
        "Academic Year",
        "Status",
        "Father Name",
        "Mother Name",
        "Guardian Name",
        "Phone",
        "Guardian Phone",
        "Email",
        "Date of Birth",
        "Address",
        "Aadhar Number",
        "Previous Education",
        "Admission Date",
      ];

      const csvContent = [
        headers.join(","),
        ...filteredStudents.map((s) =>
          [
            s.admissionNumber || "",
            `"${(s.fullName || "").replace(/"/g, '""')}"`,
            s.gender || "",
            s.classLevel || "",
            s.academicYear || "",
            s.status || "",
            `"${(s.fatherName || "").replace(/"/g, '""')}"`,
            `"${(s.motherName || "").replace(/"/g, '""')}"`,
            `"${(s.guardianName || "").replace(/"/g, '""')}"`,
            s.phone || "",
            s.guardianPhone || "",
            s.email || "",
            `"${formatDate(s.dateOfBirth)}"`,
            `"${(s.address || "").replace(/"/g, '""')}"`,
            s.aadharNumber ? `"\t${s.aadharNumber}"` : "",
            `"${(s.previousEducation || "").replace(/"/g, '""')}"`,
            `"${formatDate(s.admissionDate)}"`,
          ].join(","),
        ),
      ].join("\n");

      let filterSuffix = "";
      if (classFilter !== "all") filterSuffix += `_Class_${classFilter}`;
      if (genderFilter !== "all") filterSuffix += `_${genderFilter}`;
      if (statusFilter !== "all") filterSuffix += `_${statusFilter}`;
      if (searchTerm)
        filterSuffix += `_Search_${searchTerm.replace(/\s+/g, "_")}`;

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        const madarsaName = (userData.madarsaName || "madarsa").replace(
          /\s+/g,
          "_",
        );
        link.setAttribute(
          "download",
          `Students_${madarsaName}${filterSuffix}_${new Date().toISOString().split("T")[0]}.csv`,
        );
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setSuccess("Students exported successfully");
    } catch (error) {
      console.error("Error exporting students:", error);
      setError("Failed to export students");
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            Active
          </Badge>
        );
      case "inactive":
        return (
          <Badge variant="outline" className="text-red-600 border-red-600">
            Inactive
          </Badge>
        );
      case "suspended":
        return (
          <Badge
            variant="outline"
            className="text-yellow-600 border-yellow-600"
          >
            Suspended
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const uniqueClasses = [
    ...new Set(students.map((s) => s.classLevel).filter(Boolean)),
  ];

  return (
    <Layout user={user} role={role}>
      <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 sm:p-6 text-white">
          <h1 className="text-xl sm:text-2xl font-bold mb-2">
            Students Management
          </h1>
          <p className="text-blue-100 text-sm sm:text-base">
            View and manage all students in your madarsa
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription className="text-green-700">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    Total Students
                  </p>
                  <p className="text-lg sm:text-2xl font-bold">
                    {totalStats.total}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    Active Students
                  </p>
                  <p className="text-lg sm:text-2xl font-bold">
                    {totalStats.active}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <UserX className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    Suspended Students
                  </p>
                  <p className="text-lg sm:text-2xl font-bold">
                    {totalStats.suspended}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <UserX className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    Inactive Students
                  </p>
                  <p className="text-lg sm:text-2xl font-bold">
                    {totalStats.inactive}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    This Year
                  </p>
                  <p className="text-lg sm:text-2xl font-bold">
                    {totalStats.thisYear}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by name, email, or Admission Number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border rounded-md text-sm"
                >
                  <option value="all">All</option>
                  <option value="madrasa">Madrasa</option>
                  <option value="mekhala">Mekhala</option>
                  <option value="state">State</option>
                </select>

                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border rounded-md text-sm"
                >
                  <option value="all">All Classes</option>
                  {visibleClassOptions.map((className) => (
                    <option key={className} value={className}>
                      Class {className}
                    </option>
                  ))}
                </select>

                <select
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border rounded-md text-sm"
                >
                  <option value="all">All Genders</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border rounded-md text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>

                <Button
                  onClick={handleExportCSV}
                  disabled={exporting}
                  variant="outline"
                  className="w-full sm:w-auto ml-auto bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exporting ? "Exporting..." : "Export CSV"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Students List */}
        <Card>
          <CardHeader>
            <CardTitle>Students ({totalFilteredCount})</CardTitle>
            <CardDescription>
              All students enrolled in your madarsa
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading students...</div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No students found
              </div>
            ) : (
              <div className="space-y-4">
                {students.map((student) => (
                  <div key={student.id} className="border rounded-lg p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Profile Picture and Student Info */}
                      <div className="flex items-start gap-4 flex-1">
                        {/* Profile Picture */}

                        {/* Student Details */}
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                            <h3 className="font-semibold text-base sm:text-lg">
                              {student.fullName}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {getStatusBadge(student.status)}
                              <Badge variant="secondary">
                                Class{" "}
                                {String(
                                  student.classLevel || "",
                                ).toUpperCase() === "UKG"
                                  ? "Ukg"
                                  : student.classLevel}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <div className="flex items-center gap-2">
                                <GraduationCap className="h-4 w-4 flex-shrink-0" />
                                <span className="break-all text-xs sm:text-sm">
                                  Admission Number : {student.admissionNumber}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 flex-shrink-0" />
                                <span className="break-all text-xs sm:text-sm">
                                  {student.email}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 flex-shrink-0" />
                                <span className="break-all text-xs sm:text-sm">
                                  {student.phone}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 flex-shrink-0" />
                              <span className="text-xs sm:text-sm">
                                Admitted: {formatDate(student.admissionDate)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row lg:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => handleViewDetails(student)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={`w-full sm:w-auto ${
                                  studentEditEnabled
                                    ? "text-blue-600 border-blue-600 hover:bg-blue-50"
                                    : "text-gray-400 border-gray-300 cursor-not-allowed"
                                }`}
                                onClick={() =>
                                  studentEditEnabled &&
                                  handleEditStudent(student)
                                }
                                disabled={!studentEditEnabled}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </TooltipTrigger>
                            {!studentEditEnabled && (
                              <TooltipContent>
                                <p>
                                  Student edit access disabled by Central Admin
                                </p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>

                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-600 w-full sm:w-auto"
                          onClick={() => generateStudentPDF(student)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>

                        {student.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-yellow-600 border-yellow-600 w-full sm:w-auto"
                            onClick={() => handleSuspendClick(student)}
                          >
                            Suspend
                          </Button>
                        )}

                        {student.status === "suspended" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-600 w-full sm:w-auto"
                              onClick={() => handleActivateClick(student)}
                            >
                              Activate
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-600 w-full sm:w-auto"
                              onClick={() => handleDeleteClick(student)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {students.length > 0 && !searchTerm && (
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="flex items-center gap-2"
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {currentPage}
                </span>
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!hasMore || loading}
                  className="flex items-center gap-2"
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Details Dialog - controlled */}
        <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle>Student Details</DialogTitle>
                {viewDetailsStudent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateStudentPDF(viewDetailsStudent)}
                    className="text-blue-600 border-blue-600 shrink-0"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download PDF
                  </Button>
                )}
                {viewDetailsStudent && (
                  <label className="cursor-pointer shrink-0">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleProfilePhotoUpload}
                      disabled={uploadingPhoto}
                    />
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border font-medium ${
                        uploadingPhoto
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 cursor-pointer"
                      }`}
                    >
                      {uploadingPhoto
                        ? "Uploading..."
                        : viewDetailsStudent.profilePicture
                          ? "Change Photo"
                          : "Upload Photo"}
                    </span>
                  </label>
                )}
              </div>
              <DialogDescription>
                Complete student information
              </DialogDescription>
            </DialogHeader>
            {viewDetailsStudent && (
              <StudentDetails
                student={viewDetailsStudent}
                perfData={viewDetailsPerf}
                perfLoading={viewDetailsPerfLoading}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Student Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle>Edit Student Information</DialogTitle>
              <DialogDescription>Update student details</DialogDescription>
            </DialogHeader>

            {editingStudent && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2">
                      Personal Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          Full Name *
                        </label>
                        <Input
                          value={editForm.fullName}
                          onChange={(e) =>
                            handleEditFormChange("fullName", e.target.value)
                          }
                          placeholder="Full Name"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          Email *
                        </label>
                        <Input
                          type="email"
                          value={editForm.email}
                          onChange={(e) =>
                            handleEditFormChange("email", e.target.value)
                          }
                          placeholder="Email"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          Phone *
                        </label>
                        <Input
                          value={editForm.phone}
                          onChange={(e) =>
                            handleEditFormChange("phone", e.target.value)
                          }
                          placeholder="Phone Number"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          Date of Birth
                        </label>
                        <Input
                          type="date"
                          value={editForm.dateOfBirth}
                          onChange={(e) =>
                            handleEditFormChange("dateOfBirth", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          Address
                        </label>
                        <Input
                          value={editForm.address}
                          onChange={(e) =>
                            handleEditFormChange("address", e.target.value)
                          }
                          placeholder="Address"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 block mb-1">
                          Aadhar Number (12 Digits)
                        </label>
                        <div className="flex items-center gap-2">
                          {[0, 1, 2].map((idx) => (
                            <div key={idx} className="flex-1">
                              <Input
                                ref={aadharRefs[idx]}
                                value={aadharParts[idx]}
                                onChange={(e) =>
                                  handleAadharChange(idx, e.target.value)
                                }
                                onKeyDown={(e) => handleAadharKeyDown(idx, e)}
                                placeholder="0000"
                                className="text-center tracking-widest font-mono"
                                maxLength={4}
                              />
                            </div>
                          ))}
                        </div>
                        {editForm.aadharNumber &&
                          editForm.aadharNumber.length > 0 &&
                          editForm.aadharNumber.length < 12 && (
                            <p className="text-[10px] text-red-500 mt-1">
                              Aadhar must be exactly 12 digits (currently{" "}
                              {editForm.aadharNumber.length})
                            </p>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Academic Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2">
                      Academic Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          Admission Number
                        </label>
                        <p className="text-sm px-3 py-2 bg-gray-50 border rounded-md text-gray-700">
                          {editingStudent?.admissionNumber || "—"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          System-generated — not editable
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          Academic Year *
                        </label>
                        <Input
                          value={editForm.academicYear}
                          onChange={(e) =>
                            handleEditFormChange("academicYear", e.target.value)
                          }
                          placeholder="Academic Year"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          Previous Education
                        </label>
                        <Input
                          value={editForm.previousEducation}
                          onChange={(e) =>
                            handleEditFormChange(
                              "previousEducation",
                              e.target.value,
                            )
                          }
                          placeholder="Previous Education"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Family Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">
                    Family Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Father&apos;s Name
                      </label>
                      <Input
                        value={editForm.fatherName}
                        onChange={(e) =>
                          handleEditFormChange("fatherName", e.target.value)
                        }
                        placeholder="Father's Name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Mother&apos;s Name
                      </label>
                      <Input
                        value={editForm.motherName}
                        onChange={(e) =>
                          handleEditFormChange("motherName", e.target.value)
                        }
                        placeholder="Mother's Name"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium text-gray-600">
                        Guardian Phone
                      </label>
                      <Input
                        value={editForm.guardianPhone}
                        onChange={(e) =>
                          handleEditFormChange("guardianPhone", e.target.value)
                        }
                        placeholder="Guardian Phone"
                      />
                    </div>
                  </div>
                </div>

                {/* Performance History */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    📊 Academic Performance
                  </h3>
                  {studentResultsLoading ? (
                    <p className="text-sm text-gray-500">Loading results…</p>
                  ) : studentResults.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">
                      No exam results found for this student.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {studentResults.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
                        >
                          <div>
                            <p className="font-medium">
                              {r.examTitle || r.examName || "Unknown Exam"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {r.createdAt?.toDate
                                ? r.createdAt
                                    .toDate()
                                    .toLocaleDateString("en-IN")
                                : r.createdAt || ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {r.percentage != null && (
                              <span className="text-gray-600">
                                {r.percentage}%
                              </span>
                            )}
                            {r.obtainedMarks != null &&
                              r.totalMarks != null &&
                              !r.percentage && (
                                <span className="text-gray-600">
                                  {r.obtainedMarks}/{r.totalMarks}
                                </span>
                              )}
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                r.status === "passed"
                                  ? "bg-green-100 text-green-700"
                                  : r.status === "failed"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {r.status || r.grade || "—"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Suspend Student Dialog */}
        <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Suspend Student</DialogTitle>
              <DialogDescription>
                You are about to suspend {selectedStudentForAction?.fullName}.
                Please provide a reason for this action.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
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

        {/* Activate Student Dialog */}
        <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Activate Student</DialogTitle>
              <DialogDescription>
                Review the suspension details before reactivating{" "}
                {selectedStudentForAction?.fullName}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-yellow-800 mb-2">
                  Suspension Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Reason:</span>
                    <p className="text-gray-600 mt-1">
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
                        ? formatDate(selectedStudentForAction.suspendedAt)
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

        {/* Delete Student Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-red-600">Delete Student</DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete{" "}
                <span className="font-semibold text-gray-900">
                  {selectedStudentForAction?.fullName}
                </span>
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setSelectedStudentForAction(null);
                }}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteStudent}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Delete Permanently"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

// Component to display full student details
function StudentDetails({ student, perfData = [], perfLoading = false }) {
  const InfoRow = ({ label, value }) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </span>
      <span className="text-sm font-medium text-gray-800 break-words">
        {value || "—"}
      </span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header: photo + name + status */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100">
        <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 border-purple-200 shadow-sm bg-purple-100 flex items-center justify-center">
          <ProfileImage
            src={student.profilePicture}
            sourceData={student}
            alt={student.fullName || "Student"}
            className="w-full h-full object-cover"
            fallbackClassName="w-full h-full flex items-center justify-center"
            iconClassName="h-10 w-10 text-purple-400"
            showText={false}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-gray-900 truncate">
            {student.fullName}
          </p>
          <p className="text-sm text-gray-500">{student.admissionNumber}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
              Class{" "}
              {String(student.classLevel || "").toUpperCase() === "UKG"
                ? "UKG"
                : student.classLevel}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                student.status === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {student.status === "active" ? "Active" : "Suspended"}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              AY {student.academicYear}
            </span>
          </div>
        </div>
      </div>

      {/* Personal + Academic Info */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Personal & Academic Information
          </h3>
        </div>
        <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow label="Full Name" value={student.fullName} />
          <InfoRow label="Admission Number" value={student.admissionNumber} />
          <InfoRow label="Email" value={student.email} />
          <InfoRow
            label="Class Level"
            value={
              String(student.classLevel || "").toUpperCase() === "UKG"
                ? "UKG"
                : student.classLevel
            }
          />
          <InfoRow label="Phone" value={student.phone} />
          <InfoRow label="Academic Year" value={student.academicYear} />
          <InfoRow
            label="Date of Birth"
            value={formatDate(student.dateOfBirth)}
          />
          <InfoRow
            label="Admission Date"
            value={formatDate(student.admissionDate)}
          />
          <div className="col-span-2">
            <InfoRow label="Address" value={student.address} />
          </div>
          <InfoRow label="Aadhar Number" value={student.aadharNumber} />
          <InfoRow label="Status" value={student.status} />
        </div>
      </div>

      {/* Family Info */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Family Information
          </h3>
        </div>
        <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow label="Guardian's Name" value={student.guardianName} />
          <InfoRow label="Guardian Phone" value={student.guardianPhone} />
          <div className="col-span-2">
            <InfoRow
              label="Previous Education"
              value={student.previousEducation}
            />
          </div>
        </div>
      </div>

      {/* Academic Performance */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <TrendingUp className="h-4 w-4 text-purple-600" />
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Academic Performance
          </h3>
        </div>
        <div className="p-4">
          {perfLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading exam records...
            </div>
          ) : perfData.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-sm text-gray-400">
              No exam records found for this student.
            </div>
          ) : (
            <div className="space-y-2">
              {perfData.map((result, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${
                    !result.hasResult
                      ? "bg-gray-50 border-gray-200"
                      : result.status === "PASS"
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                  }`}
                >
                  {/* Status icon */}
                  <div
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                      !result.hasResult
                        ? "bg-gray-200"
                        : result.status === "PASS"
                          ? "bg-green-500"
                          : "bg-red-500"
                    }`}
                  >
                    {!result.hasResult ? (
                      <GraduationCap className="h-4 w-4 text-gray-500" />
                    ) : result.status === "PASS" ? (
                      <CheckCircle className="h-4 w-4 text-white" />
                    ) : (
                      <XCircle className="h-4 w-4 text-white" />
                    )}
                  </div>
                  {/* Exam info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold text-gray-900 leading-tight"
                      style={{ whiteSpace: "normal", wordBreak: "break-word" }}
                    >
                      {result.examName || `Exam (${result.examId})`}
                    </p>
                    {result.uploadDate && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {result.uploadDate.toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}
                    {result.subjects.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {result.subjects.map((sub, si) => (
                          <span
                            key={si}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-600"
                          >
                            {sub.subjectName || sub.name || `Sub ${si + 1}`}:{" "}
                            <strong>{sub.marks ?? "—"}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Score + badge */}
                  <div className="shrink-0 text-right">
                    {result.totalMax > 0 && (
                      <p className="text-sm font-bold text-gray-700">
                        {result.totalObtained}
                        <span className="text-xs text-gray-400">
                          /{result.totalMax}
                        </span>
                      </p>
                    )}
                    {!result.hasResult ? (
                      <span className="inline-block mt-1 text-[11px] font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    ) : result.status === "PASS" ? (
                      <span className="inline-block mt-1 text-[11px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        PASS
                      </span>
                    ) : (
                      <span className="inline-block mt-1 text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                        FAIL
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Suspension History */}
      {(student.status === "suspended" ||
        student.suspensionReason ||
        student.reactivatedAt) && (
        <div className="rounded-xl border border-yellow-200 overflow-hidden">
          <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200">
            <h3 className="text-sm font-bold text-yellow-800 uppercase tracking-wide">
              Suspension History
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {student.suspensionReason ? (
              <div
                className={`rounded-lg p-3 border ${student.status === "suspended" ? "bg-yellow-50 border-yellow-300" : "bg-gray-50 border-gray-200"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-600">
                    {student.status === "suspended"
                      ? "Currently Suspended"
                      : "Previous Suspension"}
                  </span>
                  <Badge
                    variant={
                      student.status === "suspended"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {student.status === "suspended"
                      ? "Suspended"
                      : "Reactivated"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">Reason:</span>{" "}
                  {student.suspensionReason}
                </p>
                {student.suspendedAt && (
                  <p className="text-xs text-gray-500">
                    Suspended on {formatDate(student.suspendedAt)}
                    {student.suspendedBy ? ` by ${student.suspendedBy}` : ""}
                  </p>
                )}
                {student.reactivatedAt && (
                  <p className="text-xs text-green-700 mt-1">
                    Reactivated on {formatDate(student.reactivatedAt)}
                    {student.reactivatedBy
                      ? ` by ${student.reactivatedBy}`
                      : ""}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-yellow-800">
                This student is currently suspended. No suspension reason
                recorded.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
