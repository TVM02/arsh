"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { madrasaMatchesMekhala } from "@/lib/madrasaHierarchy";
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
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  getDoc,
  limit,
  startAfter,
  updateDoc,
  deleteDoc,
  getCountFromServer,
  setDoc,
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import Image from "next/image";
import StudentFilters from "@/components/StudentFilters";
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

const getMadarsaIdVariants = (madarsa) => {
  const ids = new Set();
  [madarsa?.id, madarsa?.madarsaId, madarsa?.madrasaId, madarsa?.mid]
    .map(normalizeMadarsaIdValue)
    .filter(Boolean)
    .forEach((id) => {
      ids.add(id);
      const numeric = id.replace(/^[a-zA-Z]+-/, "");
      if (numeric) {
        ids.add(numeric);
        ids.add(`mid-${numeric}`);
        ids.add(`mld-${numeric}`);
      }
    });
  return Array.from(ids);
};

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
  const [madarsas, setMahals] = useState([]);
  const [mekhalas, setMekhalas] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterMahal, setFilterMahal] = useState("all");
  const [filterMekhala, setFilterMekhala] = useState("all");
  const [filterDistrict, setFilterDistrict] = useState("all");
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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const itemsPerPage = 20;

  // Lazy Secondary Data: Maps for O(1) lookup of madarsa and mekhala names
  const [madarsaMap, setMadarsaMap] = useState(new Map());
  const [mekhalaMap, setMekhalaMap] = useState(new Map());

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

  const getAllowedClassesForLevel = useCallback((level) => {
    switch (level) {
      case "madrasa":
        return ["UKG", "1", "2", "3"];
      case "mekhala":
        return ["4", "6", "8", "9", "11"];
      case "state":
        return ["5", "7", "10", "12"];
      default:
        return null;
    }
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-red-100 text-red-800";
      case "suspended":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStudentCountByMadrasa = (madrasaId) => {
    return allStudents.filter((student) => student.madarsaId === madrasaId)
      .length;
  };

  const selectedScopeMadarsaIds = useMemo(() => {
    let scoped = madarsas;

    if (filterMahal && filterMahal !== "all") {
      return [filterMahal];
    }

    if (filterMekhala && filterMekhala !== "all") {
      const targetDistrict = mekhalas.find((m) => m.id === filterMekhala);
      const districtName = targetDistrict?.name;
      scoped = scoped.filter((m) => {
        if (m.mekhalaId === filterMekhala) return true;
        return districtName ? madrasaMatchesMekhala(m, districtName) : false;
      });
    }

    if (filterDistrict && filterDistrict !== "all") {
      const targetSubMekhala = districts.find((sm) => sm.id === filterDistrict);
      const subMekhalaName = targetSubMekhala?.name;
      scoped = scoped.filter((m) => {
        return subMekhalaName ? madrasaMatchesMekhala(m, subMekhalaName) : false;
      });
    }

    if (
      filterMekhala === "all" &&
      filterDistrict === "all" &&
      filterMahal === "all"
    ) {
      return null;
    }

    return Array.from(new Set(scoped.flatMap(getMadarsaIdVariants)));
  }, [madarsas, mekhalas, districts, filterMahal, filterMekhala, filterDistrict]);

  const getMadarsaMeta = useCallback(
    (madarsaId) => {
      const id = normalizeMadarsaIdValue(madarsaId);
      return (
        madarsas.find((m) => getMadarsaIdVariants(m).includes(id)) || null
      );
    },
    [madarsas],
  );

  const studentMatchesClientFilters = useCallback(
    (student, { statusMode = "activeInactive", includeSearch = false } = {}) => {
      // Intentionally not filtering by student.deleted to match the dashboard stats exact count

      if (filterMahal !== "all" && student.madarsaId !== filterMahal) {
        return false;
      }

      if (selectedScopeMadarsaIds && selectedScopeMadarsaIds.length > 0) {
        const id = normalizeMadarsaIdValue(student.madarsaId);
        if (!selectedScopeMadarsaIds.map(String).includes(id)) return false;
      }

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
          !["active", "inactive"].includes(student.status || "active")
        ) {
          return false;
        }
      } else if ((student.status || "active") !== filterStatus) {
        return false;
      }

      const studentClassRaw =
        student.classLevel ?? student.class ?? student.className ?? "";
      const normalizedStudentClass = normalizeClassDisplay(
        String(studentClassRaw).trim(),
      );
      const allowed = getAllowedClassesForLevel(filterLevel);
      if (
        allowed &&
        !allowed
          .map((c) => normalizeClassDisplay(String(c)))
          .includes(normalizedStudentClass)
      ) {
        return false;
      }
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
          student.name,
          formattedName,
          student.email,
          student.phone,
          student.admissionNumber,
          student.admissionId,
          student.madarsaId,
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
        const studentAdmNumNormalized = student.admissionNumber
          ? student.admissionNumber
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
      filterMahal,
      filterStatus,
      getAllowedClassesForLevel,
      selectedScopeMadarsaIds,
    ],
  );

  // Fetch stats counts for dashboard
  const fetchStatsCounts = useCallback(async () => {
    setStatsLoading(true);
    try {
      const studentsRef = collection(db, "students");
      let baseFilters = [];

      // Server-side filters - Only push if explicitly set and not "all"
      if (filterMahal && filterMahal !== "all") {
        baseFilters.push(where("madarsaId", "==", filterMahal));
      }
      if (filterGender && filterGender !== "all") {
        if (filterGender === "other") {
           // Firestore '==' misses missing/blank fields, and 'not-in' breaks with missing fields.
           // We rely on client-side filtering for 'other'.
           // To avoid counting ALL students, we fetch without the filter and filter client-side later.
        } else {
           baseFilters.push(where("gender", "==", filterGender));
        }
      }

      if (selectedScopeMadarsaIds) {
        if (selectedScopeMadarsaIds.length === 0) {
          setStatsCounts({ total: 0, active: 0, inactive: 0, suspended: 0 });
          return;
        }

        const snaps = await Promise.all(
          chunkArray(selectedScopeMadarsaIds, 30).map((ids) =>
            getDocs(query(studentsRef, where("madarsaId", "in", ids))),
          ),
        );
        const scopedStudents = Array.from(
          new Map(
            snaps
              .flatMap((snap) =>
                snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
              )
              .map((student) => [student.id, student]),
          ).values(),
        ).filter((student) =>
          studentMatchesClientFilters(student, { statusMode: "any" }),
        );

        setStatsCounts({
          total: scopedStudents.length,
          active: scopedStudents.filter((s) => (s.status || "active") === "active").length,
          inactive: scopedStudents.filter((s) => s.status === "inactive").length,
          suspended: scopedStudents.filter((s) => s.status === "suspended").length,
        });
        return;
      }

      // Scope-based class grouping
      const allowed = getAllowedClassesForLevel(filterLevel);
      let classLevelVariants = null;

      if (filterClass && filterClass !== "all") {
        const raw = String(filterClass).trim();

        const generateCasePermutations = (text) => {
          const upper = String(text).trim().toUpperCase();
          if (!/^[A-Z]+$/.test(upper) || upper.length > 4) {
            return [
              raw,
              raw.toUpperCase(),
              raw.toLowerCase(),
              raw.length > 0
                ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
                : raw,
            ];
          }

          const perms = [];
          const n = upper.length;
          for (let mask = 0; mask < 1 << n; mask++) {
            let v = "";
            for (let i = 0; i < n; i++) {
              const ch = upper[i];
              v += mask & (1 << i) ? ch.toLowerCase() : ch;
            }
            perms.push(v);
          }
          return perms;
        };

        classLevelVariants = [
          ...new Set([raw, ...generateCasePermutations(raw)].filter(Boolean)),
        ].slice(0, 10);
        baseFilters.push(where("classLevel", "in", classLevelVariants));
      } else if (allowed) {
        classLevelVariants = allowed;
        baseFilters.push(where("classLevel", "in", allowed));
      }

      // Apply status filter to total count as well to match currently selected view
      let totalFilters = [...baseFilters];
      if (filterStatus && filterStatus !== "all") {
        totalFilters.push(where("status", "==", filterStatus));
      }

      // Use getCountFromServer for better performance instead of full fetch
      // Use getCountFromServer for better performance instead of full fetch
      let counts = { total: 0, active: 0, inactive: 0, suspended: 0 };

      if (filterGender === "other") {
        const notOtherVariants = ["male", "Male", "MALE", "female", "Female", "FEMALE"];
        const [
          totalAllSnap, activeAllSnap, inactiveAllSnap, suspendedAllSnap,
          totalNotOtherSnap, activeNotOtherSnap, inactiveNotOtherSnap, suspendedNotOtherSnap
        ] = await Promise.all([
          filterStatus === "all" ? getCountFromServer(query(studentsRef, ...baseFilters)) : getCountFromServer(query(studentsRef, ...totalFilters)),
          getCountFromServer(query(studentsRef, ...baseFilters, where("status", "==", "active"))),
          getCountFromServer(query(studentsRef, ...baseFilters, where("status", "==", "inactive"))),
          getCountFromServer(query(studentsRef, ...baseFilters, where("status", "==", "suspended"))),
          filterStatus === "all" ? getCountFromServer(query(studentsRef, ...baseFilters, where("gender", "in", notOtherVariants))) : getCountFromServer(query(studentsRef, ...totalFilters, where("gender", "in", notOtherVariants))),
          getCountFromServer(query(studentsRef, ...baseFilters, where("status", "==", "active"), where("gender", "in", notOtherVariants))),
          getCountFromServer(query(studentsRef, ...baseFilters, where("status", "==", "inactive"), where("gender", "in", notOtherVariants))),
          getCountFromServer(query(studentsRef, ...baseFilters, where("status", "==", "suspended"), where("gender", "in", notOtherVariants))),
        ]);

        counts = {
          total: totalAllSnap.data().count - totalNotOtherSnap.data().count,
          active: activeAllSnap.data().count - activeNotOtherSnap.data().count,
          inactive: inactiveAllSnap.data().count - inactiveNotOtherSnap.data().count,
          suspended: suspendedAllSnap.data().count - suspendedNotOtherSnap.data().count,
        };
      } else {
        const [totalSnap, activeSnap, inactiveSnap, suspendedSnap] = await Promise.all([
          filterStatus === "all" ? getCountFromServer(query(studentsRef, ...baseFilters)) : getCountFromServer(query(studentsRef, ...totalFilters)),
          getCountFromServer(query(studentsRef, ...baseFilters, where("status", "==", "active"))),
          getCountFromServer(query(studentsRef, ...baseFilters, where("status", "==", "inactive"))),
          getCountFromServer(query(studentsRef, ...baseFilters, where("status", "==", "suspended"))),
        ]);

        counts = {
          total: totalSnap.data().count,
          active: activeSnap.data().count,
          inactive: inactiveSnap.data().count,
          suspended: suspendedSnap.data().count,
        };
      }

      setStatsCounts(counts);
    } catch (error) {
      console.error("Error fetching stats counts:", error);
      // Fallback if index missing for status-based counts
      try {
        const studentsRef = collection(db, "students");
        const totalSnap = await getCountFromServer(
          query(studentsRef, where("deleted", "==", false)),
        );
        setStatsCounts((prev) => ({ ...prev, total: totalSnap.data().count }));
      } catch (e) {}
    } finally {
      setStatsLoading(false);
    }
  }, [
    filterMahal,
    filterLevel,
    filterGender,
    filterClass,
    filterStatus,
    getAllowedClassesForLevel,
    selectedScopeMadarsaIds,
    studentMatchesClientFilters,
  ]);

  // Delete student
  const handleDeleteStudent = async () => {
    if (!deleteStudentId) return;
    setDeleteSubmitting(true);
    setDeleteSubmitting(true);
    try {
      await deleteDoc(doc(db, "students", deleteStudentId));
      toast.success("Student permanently deleted");
      setDeleteStudentId(null);
      fetchStudents();
      fetchStatsCounts();
    } catch (err) {
      toast.error("Failed to delete student");
    }
    setDeleteSubmitting(false);
  };
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [madarsaEditSearch, setMadarsaEditSearch] = useState("");
  const [madarsaDropdownOpen, setMadarsaDropdownOpen] = useState(false);
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
    setOriginalStudentStatus(student.status || "active");
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

      // Check if admissionNumber (MID) was manually changed
      if (originalStudent && data.admissionNumber && data.admissionNumber !== originalStudent.admissionNumber) {
        const newMid = data.admissionNumber.trim();
        
        // 1. Verify uniqueness
        const [dupInAdmissions, dupInStudents] = await Promise.all([
          getDocs(query(collection(db, "admissions"), where("admissionNumber", "==", newMid))),
          getDocs(query(collection(db, "students"), where("admissionNumber", "==", newMid)))
        ]);
        
        if (!dupInAdmissions.empty || !dupInStudents.empty) {
          toast.error(`The Admission Number ${newMid} is already in use. Please use a unique one.`);
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

      await updateDoc(doc(db, "students", id), updatePayload);
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


  const fetchMahals = async () => {
    try {
      const madarsasQuery = query(collection(db, "madarsas"), orderBy("name"));
      const snapshot = await getDocs(madarsasQuery);
      const madarsasData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
        };
      });

      setMahals(madarsasData);

      // Lazy Secondary Data: Populate Map for O(1) lookup
      const madarsaLookup = new Map();
      madarsasData.forEach((madarsa) => {
        madarsaLookup.set(madarsa.id, madarsa.name);
        if (madarsa.madarsaId) {
          madarsaLookup.set(madarsa.madarsaId, madarsa.name);
        }
      });
      setMadarsaMap(madarsaLookup);
    } catch (error) {
      console.error("Error fetching madarsas:", error);
    }
  };

  const fetchMekhalas = async () => {
    try {
      const mekhalasQuery = query(collection(db, "mekhala"), orderBy("name"));
      const snapshot = await getDocs(mekhalasQuery);
      const mekhalasData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
        };
      });
      setMekhalas(mekhalasData);

      // Lazy Secondary Data: Populate Map for O(1) lookup
      const mekhalaLookup = new Map();
      mekhalasData.forEach((mekhala) => {
        mekhalaLookup.set(mekhala.id, mekhala.name);
      });
      setMekhalaMap(mekhalaLookup);
    } catch (error) {
      console.error("Error fetching mekhalas:", error);
    }
  };

  const fetchDistricts = async () => {
    try {
      const districtsQuery = query(collection(db, "districts"), orderBy("name"));
      const snapshot = await getDocs(districtsQuery);
      const districtsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
        };
      });
      setDistricts(districtsData);
    } catch (error) {
      console.error("Error fetching districts:", error);
    }
  };

  const lastDocRef = useRef(null);

  const fetchClasses = async () => {
    try {
      // Try to get classes from current students once (up to 1000 for efficiency)
      const studentsRef = collection(db, "students");
      const q = query(studentsRef, limit(1000));
      const snapshot = await getDocs(q);

      const classSet = new Set();
      snapshot.docs.forEach((doc) => {
        const c = doc.data().classLevel;
        if (!c) return;
        // Normalize UKG variants to "UKG" for consistent display
        const raw = String(c).trim();
        const normalized = raw.toUpperCase() === "UKG" ? "UKG" : raw;
        if (normalized) classSet.add(normalized);
      });

      // Add common standard classes as defaults if not present
      const standard = [
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
        "11",
        "12",
        "LKG",
        "UKG",
      ];
      standard.forEach((s) => classSet.add(s));

      const sortedClasses = Array.from(classSet).sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      });

      setClasses(sortedClasses);
    } catch (error) {
      console.error("Error fetching classes:", error);
      // Fallback to standard
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
        "11",
        "12",
      ]);
    }
  };

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);

      const studentsRef = collection(db, "students");
      let filters = [];

      // Server-side filters - Only push if explicitly set and not "all"
      if (filterMahal && filterMahal !== "all") {
        filters.push(where("madarsaId", "==", filterMahal));
      }
      if (filterGender && filterGender !== "all") {
        if (filterGender !== "other") {
          filters.push(where("gender", "==", filterGender));
        }
      }
      if (filterStatus && filterStatus !== "all") {
        filters.push(where("status", "==", filterStatus));
      }
      // Scope-based class grouping
      // NOTE: any classLevel "in" filter (from filterLevel OR filterClass) uses
      // hasClassLevelFilter=true below to skip orderBy and avoid missing indexes.
      const allowed = getAllowedClassesForLevel(filterLevel);
      let classLevelVariants = null; // non-null means we have a classLevel "in" filter

      if (filterClass && filterClass !== "all") {
        const raw = String(filterClass).trim();

        const generateCasePermutations = (text) => {
          const upper = String(text).trim().toUpperCase();
          if (!/^[A-Z]+$/.test(upper) || upper.length > 4) {
            return [
              raw,
              raw.toUpperCase(),
              raw.toLowerCase(),
              raw.length > 0
                ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
                : raw,
            ];
          }

          const perms = [];
          const n = upper.length;
          for (let mask = 0; mask < 1 << n; mask++) {
            let v = "";
            for (let i = 0; i < n; i++) {
              const ch = upper[i];
              v += mask & (1 << i) ? ch.toLowerCase() : ch;
            }
            perms.push(v);
          }
          return perms;
        };

        classLevelVariants = [
          ...new Set([raw, ...generateCasePermutations(raw)].filter(Boolean)),
        ].slice(0, 10);
        filters.push(where("classLevel", "in", classLevelVariants));
      } else if (allowed) {
        // filterLevel is set (madrasa/mekhala/state) without a specific class
        classLevelVariants = allowed;
        filters.push(where("classLevel", "in", allowed));
      }

      const isSearching =
        debouncedSearchTerm && debouncedSearchTerm.trim().length > 0;

      // Determine if we have a classLevel "in" filter — used both in search fallback
      // and in the main pagination path below.
      const hasClassLevelFilter = classLevelVariants !== null;

      // Log the query details for debugging
      console.log("🔍 Fetching Students:", {
        isSearching,
        searchTerm: debouncedSearchTerm,
        appliedFilters: filters.length,
        hasClassLevelFilter,
      });

      // Filter by District/Mekhala using madrasa scope. Firestore cannot safely
      // combine multiple IN filters, so scope filters are fetched by madrasaId
      // and the remaining filters are applied consistently client-side.
      if (selectedScopeMadarsaIds) {
        if (selectedScopeMadarsaIds.length === 0) {
          setStudents([]);
          setTotalStudents(0);
          setTotalPages(0);
          setLoading(false);
          return;
        }

        const chunks = chunkArray(selectedScopeMadarsaIds, 30);
        const promises = chunks.map(async (c) => {
          const scopedFilters = [];
          if (filterGender && filterGender !== "all" && filterGender !== "other") {
            scopedFilters.push(where("gender", "==", filterGender));
          }
          const q = query(studentsRef, ...scopedFilters, where("madarsaId", "in", c));
          const snap = await getDocs(q);
          return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        });

        const results = await Promise.all(promises);
        let allMekhalaStudents = results
          .flat()
          .filter((student) =>
            studentMatchesClientFilters(student, {
              includeSearch: Boolean(isSearching),
            }),
          );

        // De-duplicate
        allMekhalaStudents = Array.from(new Map(allMekhalaStudents.map((s) => [s.id, s])).values());

        // Client-side sorting by createdAt desc
        allMekhalaStudents.sort((a, b) => {
          const timeA = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        setTotalStudents(allMekhalaStudents.length);
        setTotalPages(Math.ceil(allMekhalaStudents.length / itemsPerPage));

        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedStudents = allMekhalaStudents.slice(startIndex, startIndex + itemsPerPage);
        setStudents(paginatedStudents);
        setLoading(false);
        return;
      }

      // Search Logic: Iterative deep search
      if (isSearching) {
        const term = debouncedSearchTerm.trim();
        const termLower = term.toLowerCase();
        const matchesMap = new Map();

        const addMatches = (querySnapshot) => {
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Intentionally keeping deleted students for count parity
            matchesMap.set(doc.id, {
              id: doc.id,
              ...data,
              profilePicture: data.profilePicture || data.profilePictureUrl,
            });
          });
        };

        const parseAndFormatAdmissionNumber = (t) => {
          if (!t) return null;
          const match = t.match(/^(?:mid[-_])?(\d+)[-_](\d+)$/i);
          if (match) {
            const madrasaDigits = match[1];
            const seqDigits = match[2];
            const paddedSeq = seqDigits.padStart(6, "0");
            return `mid-${madrasaDigits}-${paddedSeq}`;
          }
          return null;
        };

        const targetedQueries = [
          query(
            studentsRef,
            ...filters,
            where("fullName", ">=", term),
            where("fullName", "<=", `${term}\uf8ff`),
            limit(100),
          ),
          query(
            studentsRef,
            ...filters,
            where("admissionNumber", ">=", term),
            where("admissionNumber", "<=", `${term}\uf8ff`),
            limit(100),
          ),
          query(studentsRef, ...filters, where("email", "==", termLower), limit(50)),
          query(studentsRef, ...filters, where("phone", "==", term), limit(50)),
        ];

        const formattedAdmNum = parseAndFormatAdmissionNumber(term);
        if (formattedAdmNum) {
          targetedQueries.push(
            query(
              studentsRef,
              ...filters,
              where("admissionNumber", "==", formattedAdmNum),
              limit(10),
            )
          );
        }

        // Run targeted queries individually so one failing index doesn't abort the others
        await Promise.allSettled(
          targetedQueries.map(async (studentQuery) => {
            try {
              const snap = await getDocs(studentQuery);
              addMatches(snap);
            } catch {
              // Index missing for this field combo — skip silently
            }
          }),
        );

        if (matchesMap.size === 0) {
          // Fallback: fetch all students matching the active filters (e.g. madarsaId)
          // and do full client-side text search.
          // NO orderBy here — any orderBy combined with an equality filter (madarsaId ==)
          // requires a Firestore composite index. Without it the query throws an error.
          // We fetch without ordering and sort client-side instead.
          const fallbackLimit = 1000;
          const fallbackQuery = query(
            studentsRef,
            ...filters,
            limit(fallbackLimit),
          );
          const fallbackSnap = await getDocs(fallbackQuery);
          // Set total count early for search
          const validStudents = fallbackSnap.docs
              .map((doc) => ({ id: doc.id, ...doc.data() }));
          validStudents
            .filter((student) => {
              const formattedName = student.fullName
                ? formatStudentName(student.fullName).toLowerCase()
                : "";
              const searchableText = [
                student.fullName,
                student.studentName,
                student.name,
                formattedName,
                student.email,
                student.phone,
                student.admissionNumber,
                student.admissionId,
                student.madarsaId,
                student.uid,
                student.guardianName,
                student.guardianPhone,
                student.aadharNumber,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

              const termNormalized = termLower.replace(/mid-/g, "").replace(/-0+/g, "-").replace(/[^a-z0-9]/g, "");
              const studentAdmNumNormalized = student.admissionNumber
                ? student.admissionNumber.toLowerCase().replace(/mid-/g, "").replace(/-0+/g, "-").replace(/[^a-z0-9]/g, "")
                : "";

              return searchableText.includes(termLower) ||
                (termNormalized && studentAdmNumNormalized && studentAdmNumNormalized.includes(termNormalized));
            })
            .forEach((student) => {
              matchesMap.set(student.id, {
                ...student,
                profilePicture:
                  student.profilePicture || student.profilePictureUrl,
              });
            });
        }

        const allMatches = Array.from(matchesMap.values());
        console.log(
          `✅ Search complete. Total found: ${allMatches.length}`,
        );

        // Set total count based on filtered matches
        setTotalStudents(allMatches.length);
        setTotalPages(Math.ceil(allMatches.length / itemsPerPage));

        // Client-side pagination for search results
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedStudents = allMatches.slice(
          startIndex,
          startIndex + itemsPerPage,
        );
        setStudents(paginatedStudents);

        setLoading(false);
        return;
      }

      // When classLevel is filtered with `in` (either via filterClass or filterLevel),
      // avoid orderBy to prevent composite-index dependency. Sort client-side instead.
      // This also fixes the "filter not showing students" bug where filterLevel's
      // classLevel "in" filter was going through the orderBy path and silently failing.
      if (hasClassLevelFilter) {
        // Fetch up to a reasonable batch without orderBy (avoids composite index issues)
        // For first page, start fresh; for subsequent pages use cursor
        let pageQ = query(studentsRef, ...filters, limit(itemsPerPage * 3));
        if (lastDocRef.current && currentPage > 1) {
          pageQ = query(
            studentsRef,
            ...filters,
            startAfter(lastDocRef.current),
            limit(itemsPerPage * 3),
          );
        }

        const [pageSnap, countSnap] = await Promise.all([
          getDocs(pageQ),
          getCountFromServer(query(studentsRef, ...filters)),
        ]);

        if (pageSnap.empty && currentPage > 1) {
          setCurrentPage(1);
          lastDocRef.current = null;
          return;
        }

        if (!pageSnap.empty) {
          lastDocRef.current = pageSnap.docs[pageSnap.docs.length - 1];
        }

        const allFetched = pageSnap.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              profilePicture: data.profilePicture || data.profilePictureUrl,
            };
          })
          .filter((student) => studentMatchesClientFilters(student, { includeSearch: Boolean(isSearching) }));

        // Client-side sort by createdAt descending
        allFetched.sort((a, b) => {
          const da = a.createdAt?.seconds
            ? a.createdAt.seconds * 1000
            : new Date(a.createdAt || 0).getTime();
          const db2 = b.createdAt?.seconds
            ? b.createdAt.seconds * 1000
            : new Date(b.createdAt || 0).getTime();
          return db2 - da;
        });

        const totalCount = countSnap.data().count;
        setTotalStudents(totalCount);
        setTotalPages(Math.ceil(totalCount / itemsPerPage));
        setStudents(allFetched.slice(0, itemsPerPage));
        setLoading(false);
        return;
      }

      // Normal Logic: Server-side count + client-side pagination.
      // NO orderBy — any orderBy combined with an equality filter (madarsaId ==, gender ==, etc.)
      // requires a Firestore composite index per field combination. Without pre-built indexes
      // this throws "The query requires an index" errors. We fetch a larger batch without
      // ordering and sort + paginate entirely client-side.
      const fetchLimit = filterGender === "other" ? 1000 : Math.max(itemsPerPage * currentPage * 2, 200);
      let q = query(
        studentsRef,
        ...filters,
        limit(fetchLimit),
      );

      const snapshot = await getDocs(q);

      const toMs = (v) => {
        if (!v) return 0;
        if (v?.seconds) return v.seconds * 1000;
        const d = new Date(v);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };

      const studentsArr = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            profilePicture: data.profilePicture || data.profilePictureUrl,
          };
        })
        .filter((student) => studentMatchesClientFilters(student, { includeSearch: Boolean(isSearching) }))
        // Sort descending by createdAt, falling back to admissionDate / joinedDate
        .sort((a, b) => {
          const ta = toMs(a.createdAt || a.admissionDate || a.joinedDate);
          const tb = toMs(b.createdAt || b.admissionDate || b.joinedDate);
          return tb - ta;
        });

      // Get accurate total using server-side count (no orderBy needed)
      const countSnap = await getCountFromServer(
        query(studentsRef, ...filters),
      );
      const totalCount = countSnap.data().count;

      // Slice for client-side pagination
      const startIndex = (currentPage - 1) * itemsPerPage;
      setTotalStudents(totalCount);
      setTotalPages(Math.ceil(totalCount / itemsPerPage));
      setStudents(studentsArr.slice(startIndex, startIndex + itemsPerPage));
      setLoading(false);
    } catch (err) {
      console.error("Error fetching students:", err);
      if (err.code === "failed-precondition") {
        console.log("Missing composite index. Falling back to client-side filtering...");
        try {
          const fallbackFilters = [];
          if (filterMahal && filterMahal !== "all") {
            fallbackFilters.push(where("madarsaId", "==", filterMahal));
          } else if (filterStatus && filterStatus !== "all") {
            fallbackFilters.push(where("status", "==", filterStatus));
          } else if (filterGender && filterGender !== "all" && filterGender !== "other") {
            fallbackFilters.push(where("gender", "==", filterGender));
          }
          const fallbackQ = query(studentsRef, ...fallbackFilters, limit(1000));
          const snap = await getDocs(fallbackQ);
          
          const toMs = (v) => {
            if (!v) return 0;
            if (v?.seconds) return v.seconds * 1000;
            const d = new Date(v);
            return isNaN(d.getTime()) ? 0 : d.getTime();
          };

          const validStudents = snap.docs
            .map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                profilePicture: data.profilePicture || data.profilePictureUrl,
              };
            })
            .filter((student) => studentMatchesClientFilters(student, { statusMode: "activeInactive" }))
            .sort((a, b) => {
              const ta = toMs(a.createdAt || a.admissionDate || a.joinedDate);
              const tb = toMs(b.createdAt || b.admissionDate || b.joinedDate);
              return tb - ta;
            });
            
          setTotalStudents(validStudents.length);
          setTotalPages(Math.ceil(validStudents.length / itemsPerPage));
          
          const startIndex = (currentPage - 1) * itemsPerPage;
          setStudents(validStudents.slice(startIndex, startIndex + itemsPerPage));
          setLoading(false);
          return;
        } catch (fallbackErr) {
          console.error("Fallback query failed:", fallbackErr);
        }
      }
      toast.error("Failed to load students list.");
      setLoading(false);
    }
  }, [
    currentPage,
    debouncedSearchTerm,
    filterMahal,
    filterMekhala,
    filterDistrict,
    filterLevel,
    filterGender,
    filterClass,
    filterStatus,
    itemsPerPage,
    getAllowedClassesForLevel,
    selectedScopeMadarsaIds,
    studentMatchesClientFilters,
  ]);

  // Reset pagination when search state changes
  useEffect(() => {
    setCurrentPage(1);
    lastDocRef.current = null;
  }, [debouncedSearchTerm]);

  // Fetch static metadata once on mount
  useEffect(() => {
    fetchMahals();
    fetchMekhalas();
    fetchDistricts();
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

  // When District changes, reset Mekhala (district) and Madrasa selection
  useEffect(() => {
    setFilterDistrict("all");
    setFilterMahal("all");
    setCurrentPage(1);
    lastDocRef.current = null;
  }, [filterMekhala]);

  // When Mekhala changes, reset Madrasa selection
  useEffect(() => {
    setFilterMahal("all");
    setCurrentPage(1);
    lastDocRef.current = null;
  }, [filterDistrict]);

  // Reset to page 1 (and cursor) when filters change
  useEffect(() => {
    setCurrentPage(1);
    lastDocRef.current = null;
  }, [
    debouncedSearchTerm,
    filterMahal,
    filterMekhala,
    filterDistrict,
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
    filterMahal,
    filterMekhala,
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
    setSelectedStudent(null);
    try {
      const studentDocId = student?.uid || student?.id;
      const ref = doc(db, "students", studentDocId);
      const snap = await getDoc(ref);

      const baseData = snap.exists()
        ? { id: snap.id, ...snap.data() }
        : { ...student };

      // Resolve profile picture from ALL sources and patch Firestore so future views work instantly.
      const existingPic =
        pickUrl(baseData.profilePicture) || pickUrl(baseData.profilePictureUrl);
      const profilePic = await resolveAndPersistProfilePicture(
        {
          // Spread the full doc so every field the resolver knows is available
          ...baseData,
          // Explicit aliases to ensure id/uid are always set correctly
          id: studentDocId,
          uid: baseData?.uid || studentDocId,
        },
        {
          failedUrls: isDisabledCloudinaryUrl(existingPic) ? [existingPic] : [],
        },
      );

      if (profilePic) {
        console.log(
          "✅ [handleViewStudent] profilePic resolved:",
          profilePic.slice(0, 70),
        );
      } else {
        console.warn(
          "❌ [handleViewStudent] No profilePicture found for:",
          baseData?.fullName,
          baseData?.admissionNumber,
        );
      }

      setSelectedStudent({ ...baseData, profilePicture: profilePic });
    } catch (err) {
      console.error("Error fetching student for view:", err);
      setSelectedStudent(student);
    }
    setViewLoading(false);
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
      await updateDoc(doc(db, "students", selectedStudent.id), {
        profilePicture: downloadURL,
      });
      // Also update admission doc if available
      if (selectedStudent.admissionId) {
        try {
          await updateDoc(doc(db, "admissions", selectedStudent.admissionId), {
            profilePicture: downloadURL,
          });
        } catch (_) {}
      }
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

  const handleStatusChange = async (studentId, newStatus) => {
    try {
      await updateDoc(doc(db, "students", studentId), {
        status: newStatus,
        updatedAt: new Date(),
      });

      toast.success("Student status updated successfully");
      fetchStudents();
    } catch (error) {
      console.error("Error updating student status:", error);
      toast.error("Failed to update student status");
    }
  };

  const handleSuspendClick = (student) => {
    setSelectedStudentForAction(student);
    setSuspensionReason("");
    setSuspendDialogOpen(true);
  };

  const handleSuspendStudent = async () => {
    if (!suspensionReason.trim()) {
      toast.error("Please provide a reason for suspension");
      return;
    }

    try {
      await updateDoc(doc(db, "students", selectedStudentForAction.id), {
        status: "suspended",
        suspensionReason: suspensionReason.trim(),
        suspendedAt: new Date().toISOString(),
        suspendedBy: userData?.uid || "unknown",
        updatedAt: new Date(),
      });
      toast.success(
        `Student ${selectedStudentForAction.fullName} has been suspended`,
      );
      setSuspendDialogOpen(false);
      setSuspensionReason("");
      setSelectedStudentForAction(null);
      fetchStudents();
      fetchStatsCounts();
    } catch (error) {
      console.error("Error suspending student:", error);
      toast.error("Failed to suspend student");
    }
  };

  const handleActivateClick = (student) => {
    setSelectedStudentForAction(student);
    setActivateDialogOpen(true);
  };

  const handleActivateStudent = async () => {
    try {
      await updateDoc(doc(db, "students", selectedStudentForAction.id), {
        status: "active",
        updatedAt: new Date(),
        reactivatedAt: new Date().toISOString(),
        reactivatedBy: userData?.uid || "unknown",
      });
      toast.success(
        `Student ${selectedStudentForAction.fullName} has been activated`,
      );
      setActivateDialogOpen(false);
      setSelectedStudentForAction(null);
      fetchStudents();
      fetchStatsCounts();
    } catch (error) {
      console.error("Error activating student:", error);
      toast.error("Failed to activate student");
    }
  };

  const clearFilters = () => {
    setFilterMahal("all");
    setFilterMekhala("all");
    setFilterDistrict("all");
    setFilterLevel("all");
    setFilterGender("all");
    setFilterClass("all");
    setFilterStatus("all");
    setSearchTerm("");
    setShowSuspendedOnly(false);
    toast.info("All filters cleared");
  };

  const fetchAllStudentsForDownload = async (onProgress, scopeIds = null) => {
    try {
      if (onProgress) onProgress("Fetching from database...");
      
      let allSnapshots = [];
      
      if (scopeIds && scopeIds.length > 0) {
        // Chunk scopeIds into groups of 30 due to Firestore 'in' query limits
        const chunkSize = 30;
        const chunks = [];
        for (let i = 0; i < scopeIds.length; i += chunkSize) {
          chunks.push(scopeIds.slice(i, i + chunkSize));
        }
        
        // Use Promise.all for parallel fetching to make it vastly faster
        const chunkPromises = chunks.map(chunk => {
          const q = query(collection(db, "students"), where("madarsaId", "in", chunk));
          return getDocs(q);
        });
        
        const snaps = await Promise.all(chunkPromises);
        allSnapshots.push(...snaps);
        if (onProgress) onProgress("Processing data...");
      } else {
        const studentsQuery = query(collection(db, "students"));
        const snapshot = await getDocs(studentsQuery);
        allSnapshots.push(snapshot);
      }
      
      const studentMap = new Map();
      allSnapshots.forEach(snap => {
        snap.docs.forEach((doc) => {
          const data = doc.data();
          if (!studentMap.has(doc.id)) {
            studentMap.set(doc.id, { ...data, id: doc.id });
          }
        });
      });
      
      const allStudentsData = Array.from(studentMap.values());
      
      if (onProgress) onProgress("Processing dates...");
      
      // Pre-calculate timestamps to prevent extreme N log N performance 
      // degradation and avoid unstable sorting caused by NaN dates.
      allStudentsData.forEach(a => {
        let time = 0;
        if (a.createdAt?.seconds) {
           time = a.createdAt.seconds * 1000;
        } else if (a.createdAt) {
           const parsed = new Date(a.createdAt).getTime();
           time = isNaN(parsed) ? 0 : parsed;
        }
        a._sortTime = time;
      });

      if (onProgress) onProgress("Sorting data...");
      
      // Client-side sort by createdAt descending
      allStudentsData.sort((a, b) => b._sortTime - a._sortTime);
      
      return allStudentsData;
    } catch (error) {
      console.error("Error fetching all students:", error);
      throw error;
    }
  };

  const downloadStudentData = async () => {
    const toastId = toast.loading("Exporting Students Data");

    try {
      let dataToExport = [];
      const hasScopeFilter = selectedScopeMadarsaIds && selectedScopeMadarsaIds.length > 0;
      
      if (hasScopeFilter) {
        // Optimized targeted fetch for specific Madrasa/Mekhala/District scopes
        dataToExport = await fetchAllStudentsForDownload(null, selectedScopeMadarsaIds);
      } else {
        // Global fetch (no scope selected)
        if (allStudents.length === 0) {
          const fetched = await fetchAllStudentsForDownload(null, null);
          setAllStudents(fetched); // Cache global data
          dataToExport = fetched;
        } else {
          dataToExport = allStudents;
        }
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
          "Madrasa Number",
          "Madrasa",
          "Mekhala",
          "Class Level",
          "Academic Year",
          "Admission Number",
          "Admission Date",
          "Roll Number",
          "Guardian Name",
          "Mother Name",
          "Guardian Name",
          "Guardian Phone",
          "Guardian Email",
          "Previous Madrasa",
          "Previous Education",
          "Status",
          "Profile Complete",
          "Date Created",
          "Last Updated",
        ].join(","),
        ...filteredAllStudents.map((student) =>
          [
            escapeCSV(formatStudentName(student.fullName)),
            escapeCSV(student.email),
            escapeCSV(student.phone),
            escapeCSV(student.dateOfBirth),
            escapeCSV(student.gender),
            escapeCSV(student.address),
            escapeCSV(
              student.aadharNumber
                ? `XXXX-XXXX-${student.aadharNumber.slice(-4)}`
                : "",
            ),
            escapeCSV(student.madarsaId),
            escapeCSV(getMahalName(student.madarsaId)),
            escapeCSV(
              getMadarsaMeta(student.madarsaId)?.district ||
                getMadarsaMeta(student.madarsaId)?.districtName ||
                "",
            ),
            escapeCSV(student.classLevel || student.class),
            escapeCSV(student.academicYear),
            escapeCSV(student.admissionNumber),
            escapeCSV(
              student.admissionDate
                ? new Date(student.admissionDate).toLocaleDateString()
                : "",
            ),
            escapeCSV(student.rollNumber),
            escapeCSV(student.fatherName || student.parentDetails?.fatherName),
            escapeCSV(student.motherName || student.parentDetails?.motherName),
            escapeCSV(student.guardianName),
            escapeCSV(student.guardianPhone || student.parentDetails?.phone),
            escapeCSV(student.guardianEmail || student.parentDetails?.email),
            escapeCSV(student.previousSchool),
            escapeCSV(student.previousEducation),
            escapeCSV(student.status || "active"),
            escapeCSV(student.profileComplete || false),
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

  const exportPDF = async () => {
    let toastId = toast.loading("Generating PDF report...");
    try {
      const hasScopeFilter = selectedScopeMadarsaIds && selectedScopeMadarsaIds.length > 0;
      let allStudentsData = [];
      
      if (hasScopeFilter) {
        allStudentsData = await fetchAllStudentsForDownload(null, selectedScopeMadarsaIds);
      } else {
        if (allStudents.length === 0) {
          const fetched = await fetchAllStudentsForDownload(null, null);
          setAllStudents(fetched);
          allStudentsData = fetched;
        } else {
          allStudentsData = allStudents;
        }
      }

      const q = debouncedSearchTerm.toLowerCase();
      const filteredAllStudents = allStudentsData.filter((student) => {
        const matchesSearch =
          (student.fullName || "").toLowerCase().includes(q) ||
          (student.admissionNumber || "").toLowerCase().includes(q) ||
          (student.email || "").toLowerCase().includes(q) ||
          (student.phone || "").toLowerCase().includes(q) ||
          (student.madarsaId || "").toLowerCase().includes(q);

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
        "Admission Num", 
        "Madrasa", 
        "MID", 
        "Name", 
        "Class", 
        "Gender", 
        "Guardian Name", 
        "Phone", 
        "Status"
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
        student.admissionNumber || student.admissionId || "N/A",
        getMahalName(student.madarsaId) || "N/A",
        student.madarsaId || "N/A",
        formatStudentName(student.fullName),
        student.classLevel || student.class || "N/A",
        student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : "N/A",
        formatStudentName(student.guardianName || student.parentName || "N/A"),
        cleanPhoneForPdf(student.phone || student.mobileNumber || student.guardianPhone || "N/A"),
        student.status || "active"
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
          1: { halign: "center", cellWidth: 34 },    // Admission Num
          2: { halign: "left", cellWidth: 46 },      // Madrasa
          3: { halign: "center", cellWidth: 16 },    // MID
          4: { halign: "left", cellWidth: 47 },      // Name
          5: { halign: "center", cellWidth: 12 },    // Class
          6: { halign: "center", cellWidth: 15 },    // Gender
          7: { halign: "left", cellWidth: 39 },      // Guardian Name
          8: { halign: "center", cellWidth: 36 },    // Phone
          9: { halign: "center", cellWidth: 18 }     // Status
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

  const getMahalName = (madarsaId) => {
    // Lazy Secondary Data: O(1) lookup using Map
    if (!madarsaId) return "N/A";
    if (madarsaMap.has(madarsaId)) {
      return madarsaMap.get(madarsaId);
    }

    // Avoid redundant fetches for the same ID
    if (pendingMadarsaFetches.current.has(madarsaId)) {
      return "Loading...";
    }
    pendingMadarsaFetches.current.add(madarsaId);

    // Fallback: try to fetch from Firestore synchronously (best effort) - but avoid blocking UI
    (async () => {
      try {
        // Try by document id
        const docRef = doc(db, "madarsas", madarsaId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setMahals((prev) => {
            if (prev.find((p) => p.id === data.id)) return prev;
            return [...prev, data].sort((a, b) =>
              (a.name || "").localeCompare(b.name || ""),
            );
          });
          // Update the Map as well
          setMadarsaMap((prev) => new Map(prev).set(data.id, data.name));
        } else {
          // Try by madarsaId field
          const q = query(
            collection(db, "madarsas"),
            where("madarsaId", "==", madarsaId),
            limit(1),
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const d = { id: snap.docs[0].id, ...snap.docs[0].data() };
            setMahals((prev) => {
              if (prev.find((p) => p.id === d.id)) return prev;
              return [...prev, d].sort((a, b) =>
                (a.name || "").localeCompare(b.name || ""),
              );
            });
            // Update the Map as well
            setMadarsaMap((prev) => new Map(prev).set(d.id, d.name));
          }
        }
      } catch (err) {
        console.error("Error resolving madarsa name fallback:", err);
      } finally {
        // We don't remove from pending as we rely on the Map now
      }
    })();

    return "Loading...";
  };

  const getMekhalaName = (mekhalaId) => {
    // Lazy Secondary Data: O(1) lookup using Map
    if (!mekhalaId) return "N/A";
    if (mekhalaMap.has(mekhalaId)) {
      return mekhalaMap.get(mekhalaId);
    }

    // Avoid redundant fetches
    if (pendingMekhalaFetches.current.has(mekhalaId)) {
      return "Loading...";
    }
    pendingMekhalaFetches.current.add(mekhalaId);

    // Fallback: try to fetch from Firestore synchronously (best effort) - but avoid blocking UI
    (async () => {
      try {
        const docRef = doc(db, "mekhala", mekhalaId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setMekhalas((prev) => {
            if (prev.find((p) => p.id === data.id)) return prev;
            return [...prev, data].sort((a, b) =>
              (a.name || "").localeCompare(b.name || ""),
            );
          });
          // Update the Map as well
          setMekhalaMap((prev) => new Map(prev).set(data.id, data.name));
        }
      } catch (err) {
        console.error("Error resolving mekhala name fallback:", err);
      }
    })();

    return "Loading...";
  };

  const filteredMadarsas = useMemo(() => {
    let list = madarsas;
    if (filterMekhala !== "all") {
      const targetDistrict = mekhalas.find((mk) => mk.id === filterMekhala);
      const districtName = targetDistrict?.name;
      list = list.filter((m) => {
        if (m.mekhalaId === filterMekhala) return true;
        return districtName ? madrasaMatchesMekhala(m, districtName) : false;
      });
    }
    if (filterDistrict !== "all") {
      const targetSubMekhala = districts.find((sm) => sm.id === filterDistrict);
      const subMekhalaName = targetSubMekhala?.name;
      list = list.filter((m) => subMekhalaName && madrasaMatchesMekhala(m, subMekhalaName));
    }
    return list;
  }, [madarsas, mekhalas, filterMekhala, filterDistrict, districts]);

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
          filterMahal={filterMahal}
          setFilterMahal={setFilterMahal}
          filterMekhala={filterMekhala}
          setFilterMekhala={setFilterMekhala}
          filterDistrict={filterDistrict}
          setFilterDistrict={setFilterDistrict}
          filterLevel={filterLevel}
          setFilterLevel={setFilterLevel}
          filterGender={filterGender}
          setFilterGender={setFilterGender}
          filterClass={filterClass}
          setFilterClass={setFilterClass}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          madarsas={filteredMadarsas}
          mekhalas={mekhalas}
          districts={districts}
          classes={classes}
          loading={loading}
          searchLoading={searchLoading}
        />

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
                        Class
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-center w-[140px]">
                        Status
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
                            {/* <TableCell>
                              <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200">
                                {student.profilePicture ? (
                                  <Image
                                    src={student.profilePicture}
                                    alt={student.fullName || "Student"}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                    <User className="h-5 w-5 text-gray-400" />
                                  </div>
                                )}
                              </div>
                            </TableCell> */}
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
                                {student.admissionNumber && (
                                  <div
                                    className="text-xs text-teal-700 font-mono mt-0.5 truncate"
                                    title={student.admissionNumber}
                                  >
                                    {student.admissionNumber}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="w-[190px] max-w-[190px]">
                              <div
                                className="truncate text-sm"
                                title={student.email || "N/A"}
                              >
                                {student.email || "N/A"}
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
                              {student.madarsaId}
                            </TableCell>
                            <TableCell>
                              {normalizeClassDisplay(student.classLevel) ||
                                "N/A"}
                            </TableCell>
                            <TableCell className="text-center w-[140px]">
                              <div className="flex flex-col items-center gap-1.5 mx-auto">
                                <Badge
                                  className={`justify-center font-medium ${
                                    student.status === "active"
                                      ? "bg-green-100 text-green-800 border-green-300"
                                      : student.status === "suspended"
                                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                        : "bg-gray-100 text-gray-800 border-gray-300"
                                  }`}
                                >
                                  {student.status === "active"
                                    ? "Active"
                                    : student.status === "suspended"
                                      ? "Suspended"
                                      : student.status || "Active"}
                                </Badge>
                                {student.status === "active" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-yellow-700 border-yellow-400 hover:bg-yellow-50 h-7 text-xs w-full"
                                    onClick={() => handleSuspendClick(student)}
                                  >
                                    Suspend
                                  </Button>
                                )}
                                {student.status === "suspended" && (
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
                              {student.admissionNumber && (
                                <p className="text-xs text-teal-700 font-mono mt-0.5 truncate">
                                  {student.admissionNumber}
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
                              student.status === "active"
                                ? "default"
                                : student.status === "inactive"
                                  ? "secondary"
                                  : "destructive"
                            }
                            className="text-xs px-2 py-1 shrink-0"
                          >
                            {student.status || "active"}
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
                              Class
                            </p>
                            <p className="font-medium text-gray-900 truncate">
                              {normalizeClassDisplay(student.classLevel) ||
                                "N/A"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-gray-500 text-xs font-medium mb-1">
                              Madrasa
                            </p>
                            <p className="font-medium text-gray-900 truncate">
                              {getMahalName(student.madarsaId)}
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
                                  student.status === "active"
                                    ? "bg-green-100 text-green-800"
                                    : student.status === "suspended"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-gray-100 text-gray-800"
                                }
                              >
                                {student.status || "active"}
                              </Badge>
                              {student.status === "active" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-yellow-600 border-yellow-600 h-7 text-xs flex-1"
                                  onClick={() => handleSuspendClick(student)}
                                >
                                  Suspend
                                </Button>
                              )}
                              {student.status === "suspended" && (
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
                      value={editForm.email || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, email: e.target.value }))
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
                      Academic Year
                    </label>
                    <Input
                      type="number"
                      value={editForm.academicYear || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          academicYear:
                            parseInt(e.target.value) || e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Admission Date
                    </label>
                    <Input
                      type="date"
                      value={(() => {
                        const d = convertTimestampToDate(
                          editForm.admissionDate,
                        );
                        return d ? d.toISOString().split("T")[0] : "";
                      })()}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          admissionDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Admission ID
                    </label>
                    <Input
                      disabled
                      value={editForm.admissionId || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          admissionId: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Admission Number
                    </label>
                    <Input
                      value={editForm.admissionNumber || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          admissionNumber: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Madrasa
                    </label>
                    <div className="relative">
                      {/* Search input */}
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Search by name or MID…"
                        value={madarsaEditSearch}
                        onChange={(e) => {
                          setMadarsaEditSearch(e.target.value);
                          setMadarsaDropdownOpen(true);
                        }}
                        onFocus={() => setMadarsaDropdownOpen(true)}
                        onBlur={() =>
                          setTimeout(() => setMadarsaDropdownOpen(false), 200)
                        }
                      />
                      {/* Selected madrasa indicator */}
                      {editForm.madarsaId && !madarsaEditSearch && (
                        <div className="mt-1 text-xs text-teal-700 font-medium px-1">
                          Selected:{" "}
                          {(() => {
                            const sel = Array.from(
                              new Map(madarsas.map((m) => [m.id, m])).values(),
                            ).find(
                              (m) =>
                                (m.madarsaId || m.id) === editForm.madarsaId,
                            );
                            return sel
                              ? `${sel.name} (${sel.madarsaId || sel.id})`
                              : editForm.madarsaId;
                          })()}
                        </div>
                      )}
                      {/* Dropdown list */}
                      {madarsaDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                          {(() => {
                            const uniqueMadrasas = Array.from(
                              new Map(madarsas.map((m) => [m.id, m])).values(),
                            );
                            const visibleMadrasas = madarsaEditSearch.trim()
                              ? sortBySearchRank(
                                  uniqueMadrasas,
                                  madarsaEditSearch,
                                  (m) =>
                                    `${m.name || ""} ${m.madarsaId || m.id || ""}`,
                                  (m) => [m.name, m.madarsaId, m.id, m.mid],
                                )
                              : uniqueMadrasas;

                            if (visibleMadrasas.length === 0) {
                              return (
                                <div className="px-3 py-2 text-sm text-gray-400">
                                  No madrasa found
                                </div>
                              );
                            }

                            return visibleMadrasas.map((m, idx) => (
                                <div
                                  key={`${m.id}-${idx}`}
                                  className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-teal-50 ${
                                    editForm.madarsaId ===
                                    (m.madarsaId || m.id)
                                      ? "bg-teal-100 font-semibold"
                                      : ""
                                  }`}
                                  onMouseDown={() => {
                                    setEditForm((f) => ({
                                      ...f,
                                      madarsaId: m.madarsaId || m.id,
                                    }));
                                    setMadarsaEditSearch("");
                                    setMadarsaDropdownOpen(false);
                                  }}
                                >
                                  <span className="truncate">{m.name}</span>
                                  <span className="ml-2 text-xs text-gray-400 font-mono shrink-0">
                                    {m.madarsaId || m.id}
                                  </span>
                                </div>
                              ));
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Class
                    </label>
                    <Select
                      value={editForm.classLevel || ""}
                      onValueChange={(v) =>
                        setEditForm((f) => ({ ...f, classLevel: v }))
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
                      value={editForm.status || "active"}
                      onValueChange={(v) => {
                        if (v === "inactive" && originalStudentStatus !== "inactive") {
                          setInactivateDialogOpen(true);
                        } else {
                          setEditForm((f) => ({ ...f, status: v }));
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
                      value={editForm.previousEducation || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          previousEducation: e.target.value,
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
                        {selectedStudent.email || "N/A"}
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
                        Madrasa
                      </label>
                      <p className="text-sm">
                        {getMahalName(selectedStudent.madarsaId)}
                      </p>
                      {selectedStudent.madarsaId && (
                        <p className="text-xs text-gray-500 mt-1">
                          MID:{" "}
                          <span className="font-medium text-gray-700">
                            {selectedStudent.madarsaId}
                          </span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Class
                      </label>
                      <p className="text-sm">
                        {normalizeClassDisplay(selectedStudent.classLevel) ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Status
                      </label>
                      <Badge className={getStatusColor(selectedStudent.status)}>
                        {selectedStudent.status || "active"}
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

                    {selectedStudent.admissionNumber && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Admission Number
                        </label>
                        <p className="text-sm">
                          {selectedStudent.admissionNumber}
                        </p>
                      </div>
                    )}

                    {selectedStudent.admissionDate && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Admission Date
                        </label>
                        <p className="text-sm">
                          {(() => {
                            const d = convertTimestampToDate(
                              selectedStudent.admissionDate,
                            );
                            return d
                              ? d.toLocaleDateString()
                              : String(selectedStudent.admissionDate);
                          })()}
                        </p>
                      </div>
                    )}

                    {selectedStudent.rollNumber && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Roll Number
                        </label>
                        <p className="text-sm">{selectedStudent.rollNumber}</p>
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
                  {(selectedStudent.status === "suspended" ||
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
                              selectedStudent.status === "suspended"
                                ? "bg-yellow-50 border-yellow-300"
                                : "bg-gray-50 border-gray-300"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <h5 className="font-semibold text-sm text-gray-800">
                                {selectedStudent.status === "suspended"
                                  ? "Currently Suspended"
                                  : "Previous Suspension"}
                              </h5>
                              <Badge
                                className={
                                  selectedStudent.status === "suspended"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-gray-100 text-gray-800"
                                }
                              >
                                {selectedStudent.status === "suspended"
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
                        {selectedStudent.status === "suspended" &&
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
                        Object.entries(data).filter(([_, value]) => value !== undefined),
                      );
                      await updateDoc(doc(db, "students", id), {
                        ...cleanData,
                        status: "inactive",
                        inactiveReason: inactivationReason.trim(),
                        inactivatedAt: new Date().toISOString(),
                        inactivatedBy: userData?.uid || "unknown",
                        updatedAt: new Date(),
                      });
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
                  }}
                  disabled={!inactivationReason.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Confirm
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
      </div>
    </Layout>
  );
}
