"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Filter,
  GlobeLock,
  Edit,
  Trash2,
  Save,
  Plus,
  X,
  MapPin,
  User,
  Clock,
  Eye,
  Loader2,
  Globe,
  Users,
  School,
  Calculator,
  Eraser,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { serverTimestamp, addDoc, deleteDoc } from "firebase/firestore";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  updateDoc,
  getCountFromServer,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestoreService";
import { toast } from "sonner";
import useAuthStore from "@/lib/authStore";

const MAX_CLIENT_FILTER_RESULTS = 2000;

const normalizeText = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

const normalizeClassValue = (value) => {
  const cleaned = normalizeText(value)
    .replace(/^class\s*/i, "")
    .toUpperCase()
    .trim();

  if (cleaned === "U.K.G" || cleaned === "U.K.G.") return "UKG";
  if (cleaned === "L.K.G" || cleaned === "L.K.G.") return "LKG";
  if (/^\d+$/.test(cleaned)) return String(Number(cleaned));
  return cleaned;
};

const isValidClassOption = (value) => {
  const normalized = normalizeClassValue(value);
  if (normalized === "LKG" || normalized === "UKG") return true;

  const numericClass = Number(normalized);
  return (
    Number.isInteger(numericClass) &&
    numericClass >= 1 &&
    numericClass <= 12
  );
};

const buildIdAliases = (...values) => {
  const aliases = new Set();

  values.forEach((value) => {
    const raw = normalizeText(value).toLowerCase();
    if (!raw) return;

    aliases.add(raw);
    aliases.add(raw.replace(/\s+/g, ""));

    const prefixed = raw.match(/^(mid|mld)-?(\d+)$/i);
    if (prefixed) {
      const [, prefix, number] = prefixed;
      aliases.add(number);
      aliases.add(`${prefix}-${number}`);
      aliases.add(`${prefix}${number}`);
      return;
    }

    if (/^\d+$/.test(raw)) {
      aliases.add(`mid-${raw}`);
      aliases.add(`mid${raw}`);
      aliases.add(`mld-${raw}`);
      aliases.add(`mld${raw}`);
    }
  });

  return aliases;
};

const hasMatchingAlias = (left, right) => {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
};

export default function UnpublishedResultsContent({ examId = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { userData } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [madarsas, setMadarsas] = useState([]);
  const [exams, setExams] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);

  // Pagination
  const [lastDoc, setLastDoc] = useState(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMadarsa, setFilterMadarsa] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterExam, setFilterExam] = useState(
    examId || searchParams.get("exam") || "all",
  );

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Modal States
  const [editingResult, setEditingResult] = useState(null);
  const [viewingResult, setViewingResult] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hallTicketData, setHallTicketData] = useState(null);
  const [loadingHallTicket, setLoadingHallTicket] = useState(false);

  // Grade and Subject Management States
  const [gradeRules, setGradeRules] = useState([
    { grade: "A+", min: 90, max: 100 },
    { grade: "A", min: 80, max: 89 },
    { grade: "B+", min: 70, max: 79 },
    { grade: "B", min: 60, max: 69 },
    { grade: "C+", min: 50, max: 59 },
    { grade: "C", min: 40, max: 49 },
    { grade: "D+", min: 30, max: 39 },
    { grade: "D", min: 20, max: 29 },
    { grade: "E", min: 0, max: 19 },
    { grade: "Absent", min: -1, max: -1 },
  ]);
  const [resultSubjectTemp, setResultSubjectTemp] = useState([]);
  const [subjectToDelete, setSubjectToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddSubjectDialog, setShowAddSubjectDialog] = useState(false);
  const [subjectTab, setSubjectTab] = useState("existing");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectPassMark, setNewSubjectPassMark] = useState(35);
  const [newSubjectTotalMarks, setNewSubjectTotalMarks] = useState(100);
  const [newSubjectFirstClassMarks, setNewSubjectFirstClassMarks] =
    useState(60);
  const [newSubjectClass, setNewSubjectClass] = useState("all");
  const [currentExamData, setCurrentExamData] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      // Fetch Madarsas for filter
      const mSnap = await getDocs(
        query(collection(db, "madarsas"), orderBy("name", "asc")),
      );
      setMadarsas(
        mSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          madarsaId: doc.data().madarsaId || doc.id,
        })),
      );

      // Fetch Exams for filter
      const eSnap = await getDocs(
        query(collection(db, COLLECTIONS.EXAMS), orderBy("createdAt", "desc")),
      );
      setExams(eSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      // Fetch Unique Classes from results
      const rSnap = await getDocs(query(collection(db, "results"), limit(500)));
      const classSet = new Set();
      rSnap.docs.forEach((doc) => {
        const c = doc.data().class;
        if (c) classSet.add(c);
      });

      // Standard fallback classes if none found or to supplement
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

      // Filter out Roman numerals
      const validClasses = Array.from(classSet)
        .map(normalizeClassValue)
        .filter((c) => {
          const upper = String(c).toUpperCase().trim();
          const isRoman = /^(I{1,3}|IV|V|VI{1,3}|IX|X|XI{1,2})$/.test(
            upper,
          );
          return !isRoman && isValidClassOption(c);
        });

      const sortedClasses = Array.from(new Set(validClasses)).sort((a, b) => {
        const strA = String(a).toUpperCase().trim();
        const strB = String(b).toUpperCase().trim();
        if (strA === "LKG" && strB !== "LKG") return -1;
        if (strB === "LKG" && strA !== "LKG") return 1;
        if (strA === "UKG" && strB !== "UKG") return -1;
        if (strB === "UKG" && strA !== "UKG") return 1;
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return String(a).localeCompare(String(b));
      });
      setAvailableClasses(sortedClasses);
    } catch (error) {
      console.error("Error fetching initial data:", error);
    }
  };

  const getBaseConstraints = useCallback(() => {
    const constraints = [where("isPublished", "==", false)];

    if (filterExam !== "all") {
      constraints.push(where("examID", "==", filterExam));
    }

    return constraints;
  }, [filterExam]);

  const applyClientFilters = useCallback(
    (data) => {
      const selectedMadarsa = madarsas.find((m) => {
        const optionAliases = buildIdAliases(
          m.id,
          m.madarsaId,
          m.madrasaId,
          m.mid,
        );
        return hasMatchingAlias(optionAliases, buildIdAliases(filterMadarsa));
      });

      const selectedMadarsaAliases = buildIdAliases(
        filterMadarsa,
        selectedMadarsa?.id,
        selectedMadarsa?.madarsaId,
        selectedMadarsa?.madrasaId,
        selectedMadarsa?.mid,
      );
      const selectedMadarsaName = normalizeText(selectedMadarsa?.name)
        .toLowerCase()
        .trim();
      const selectedClass = normalizeClassValue(filterClass);
      const lowerSearch = searchTerm.trim().toLowerCase();

      return data.filter((result) => {
        if (filterExam !== "all" && result.examID !== filterExam) {
          return false;
        }

        if (filterMadarsa !== "all") {
          const resultAliases = buildIdAliases(
            result.mid,
            result.madarsaId,
            result.madrasaId,
          );
          const resultMadarsaName = normalizeText(result.madarsaName)
            .toLowerCase()
            .trim();

          if (
            !hasMatchingAlias(selectedMadarsaAliases, resultAliases) &&
            (!selectedMadarsaName || selectedMadarsaName !== resultMadarsaName)
          ) {
            return false;
          }
        }

        if (
          filterClass !== "all" &&
          normalizeClassValue(result.class) !== selectedClass
        ) {
          return false;
        }

        if (lowerSearch) {
          const sName = String(result.studentName || "").toLowerCase();
          const hNum = String(result.hallTicketNumber || "").toLowerCase();
          const mName = String(result.madarsaName || "").toLowerCase();
          return (
            sName.includes(lowerSearch) ||
            hNum.includes(lowerSearch) ||
            mName.includes(lowerSearch)
          );
        }

        return true;
      });
    },
    [filterClass, filterMadarsa, madarsas, searchTerm, filterExam],
  );

  const sortResultsByHallTicket = (data) =>
    [...data].sort((a, b) => {
      const hA = String(a.hallTicketNumber || "");
      const hB = String(b.hallTicketNumber || "");
      return hA.localeCompare(hB, undefined, { numeric: true });
    });

  const setClientFilteredPage = useCallback(
    (data, direction) => {
      const filteredData = applyClientFilters(sortResultsByHallTicket(data));
      const targetPage =
        direction === "next" ? page + 1 : direction === "prev" ? page - 1 : 1;
      const safePage = Math.max(1, targetPage);
      const startIndex = (safePage - 1) * pageSize;

      setTotalCount(filteredData.length);
      setResults(filteredData.slice(startIndex, startIndex + pageSize));
      setLastDoc(null);
      setPage(safePage);
    },
    [applyClientFilters, page],
  );

  const fetchBaseResults = useCallback(async (baseConstraints) => {
    try {
      const orderedQ = query(
        collection(db, "results"),
        ...baseConstraints,
        orderBy("hallTicketNumber", "asc"),
        limit(MAX_CLIENT_FILTER_RESULTS),
      );
      return await getDocs(orderedQ);
    } catch (error) {
      if (error.code !== "failed-precondition") throw error;

      console.info("Missing index, falling back to client-side sorting...");
      try {
        const fallbackQ = query(
          collection(db, "results"),
          ...baseConstraints,
          limit(MAX_CLIENT_FILTER_RESULTS),
        );
        return await getDocs(fallbackQ);
      } catch (err2) {
        if (err2.code !== "failed-precondition") throw err2;
        
        console.info("Missing composite index, falling back to base filter...");
        const baseFallbackQ = query(
          collection(db, "results"),
          where("isPublished", "==", false),
          limit(MAX_CLIENT_FILTER_RESULTS),
        );
        return await getDocs(baseFallbackQ);
      }
    }
  }, []);

  const fetchResults = useCallback(
    async (direction = "initial") => {
      setLoading(true);
      try {
        const baseConstraints = getBaseConstraints();
        const needsClientFiltering =
          filterMadarsa !== "all" ||
          filterClass !== "all" ||
          searchTerm.trim() !== "";

        if (needsClientFiltering) {
          const snapshot = await fetchBaseResults(baseConstraints);
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setClientFilteredPage(data, direction);
          return;
        }

        // Count total
        const countQuery = query(collection(db, "results"), ...baseConstraints);
        const countSnapshot = await getCountFromServer(countQuery);
        setTotalCount(countSnapshot.data().count);

        // Sorting
        let q = query(
          collection(db, "results"),
          ...baseConstraints,
          orderBy("hallTicketNumber", "asc"),
          limit(pageSize),
        );

        if (direction === "next" && lastDoc) {
          q = query(q, startAfter(lastDoc));
        }

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setResults(data);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);

        if (direction === "initial") {
          setPage(1);
        } else if (direction === "next") {
          setPage((currentPage) => currentPage + 1);
        }
      } catch (error) {
        if (error.code === "failed-precondition") {
          console.info("Missing index, falling back to client-side sorting...");
          try {
            const fallbackSnap = await fetchBaseResults(getBaseConstraints());
            const allData = fallbackSnap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setClientFilteredPage(allData, direction);
            return;
          } catch (err) {
            console.error("Fallback failed", err);
          }
        }
        console.error("Error fetching unpublished results:", error);
        toast.error("Failed to load unpublished results");
      } finally {
        setLoading(false);
      }
    },
    [
      fetchBaseResults,
      filterClass,
      filterMadarsa,
      getBaseConstraints,
      lastDoc,
      searchTerm,
      setClientFilteredPage,
    ],
  );

  useEffect(() => {
    fetchResults("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterExam, filterMadarsa, filterClass, searchTerm]);

  const handlePublish = async (id) => {
    if (!confirm("Are you sure you want to publish this result?")) return;
    try {
      await updateDoc(doc(db, "results", id), {
        isPublished: true,
        updatedAt: new Date(),
        publishedAt: new Date(),
        publishedBy: user?.email || "admin",
      });
      toast.success("Result published successfully");
      fetchResults("initial");
    } catch (error) {
      console.error("Error publishing result:", error);
      toast.error("Failed to publish result");
    }
  };

  const handleBulkPublish = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one record");
      return;
    }

    if (
      !confirm(`Are you sure you want to publish ${selectedIds.size} records?`)
    )
      return;

    setBulkProcessing(true);
    try {
      const batchSize = 100;
      const idsArray = Array.from(selectedIds);

      for (let i = 0; i < idsArray.length; i += batchSize) {
        const batch = writeBatch(db);
        const currentBatchIds = idsArray.slice(i, i + batchSize);

        currentBatchIds.forEach((id) => {
          const docRef = doc(db, "results", id);
          batch.update(docRef, {
            isPublished: true,
            updatedAt: new Date(),
            publishedAt: new Date(),
            publishedBy: user?.email || "admin",
          });
        });

        await batch.commit();
      }

      toast.success(`Successfully published ${selectedIds.size} records`);
      setSelectedIds(new Set());
      fetchResults("initial");
    } catch (error) {
      console.error("Error performing bulk publish:", error);
      toast.error("Failed to publish records");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one record");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete ${selectedIds.size} records? This action cannot be undone.`,
      )
    )
      return;

    setBulkProcessing(true);
    try {
      const batchSize = 100;
      const idsArray = Array.from(selectedIds);

      for (let i = 0; i < idsArray.length; i += batchSize) {
        const batch = writeBatch(db);
        const currentBatchIds = idsArray.slice(i, i + batchSize);

        currentBatchIds.forEach((id) => {
          const docRef = doc(db, "results", id);
          batch.delete(docRef);
        });

        await batch.commit();
      }

      toast.success(`Successfully deleted ${selectedIds.size} records`);
      setSelectedIds(new Set());
      fetchResults("initial");
    } catch (error) {
      console.error("Error performing bulk delete:", error);
      toast.error("Failed to delete records");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleEdit = async (result) => {
    setEditingResult(result);
    setEditFormData({ ...result });

    // Fetch exam data for pass/fail calculation
    try {
      const examRef = doc(db, COLLECTIONS.EXAMS, result.examID);
      const examSnap = await getDoc(examRef);
      if (examSnap.exists()) {
        const examData = examSnap.data();
        setCurrentExamData(examData);
        setResultSubjectTemp(examData.resultSubjectTemp || []);
      }
    } catch (error) {
      console.error("Error fetching exam data:", error);
    }
  };

  const handleSaveEdit = async () => {
    if (!editFormData) return;
    setSaving(true);
    try {
      const marksSum =
        editFormData.result?.reduce(
          (sum, item) => sum + (Number(item.marks) || 0),
          0,
        ) || 0;

      const resultStatus = calculateResultStatus(
        editFormData.result || [],
        currentExamData,
      );

      const batch = writeBatch(db);
      const oldDocRef = doc(db, "results", editingResult.id);
      const newDocId = `${editFormData.examID}_${editFormData.hallTicketNumber.toString().trim()}`;

      const updateData = {
        ...editFormData,
        totalObtained: resultStatus.totalObtained,
        totalMarks: resultStatus.totalObtained,
        marksSum: resultStatus.totalObtained,
        status: resultStatus.status,
        isFirstClass: resultStatus.isFirstClass,
        updatedAt: new Date(),
        updatedBy: user?.email || user?.uid || "unknown",
      };

      if (newDocId !== editingResult.id) {
        const newDocRef = doc(db, "results", newDocId);
        batch.set(newDocRef, updateData);
        batch.delete(oldDocRef);
        await batch.commit();
      } else {
        await updateDoc(oldDocRef, updateData);
      }

      toast.success("Result updated successfully");
      setEditingResult(null);
      setEditFormData(null);
      setCurrentExamData(null);
      fetchResults("initial");
    } catch (error) {
      console.error("Error updating result:", error);
      toast.error("Failed to update result");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this result?")) return;
    try {
      await deleteDoc(doc(db, "results", id));
      toast.success("Result deleted");
      fetchResults("initial");
    } catch (error) {
      console.error("Error deleting result:", error);
      toast.error("Failed to delete result");
    }
  };

  const toggleSelection = (id) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map((r) => r.id)));
    }
  };

  const getGradeFromMark = (mark) => {
    if (
      !mark ||
      mark === "" ||
      mark === "AB" ||
      mark === "Absent" ||
      mark === -1
    )
      return "Absent";
    const m = parseFloat(mark);
    if (isNaN(m)) return "";
    const rule = gradeRules.find((r) => m >= r.min && m <= r.max);
    return rule ? rule.grade : "E";
  };

  const autoCalculateGrades = () => {
    if (!editFormData?.result) return;
    const updatedResult = editFormData.result.map((sub) => ({
      ...sub,
      grade: sub.grade || getGradeFromMark(sub.marks),
    }));
    setEditFormData({ ...editFormData, result: updatedResult });
    toast.success("Grades calculated based on marks");
  };

  const clearAllGrades = () => {
    if (!editFormData?.result) return;
    const updatedResult = editFormData.result.map((sub) => ({
      ...sub,
      grade: "",
    }));
    setEditFormData({ ...editFormData, result: updatedResult });
    toast.success("All grades cleared");
  };

  const calculateResultStatus = (resultsArray, examData) => {
    if (!examData)
      return { status: "PENDING", totalObtained: 0, isFirstClass: false };

    let totalObtained = 0;
    let isPass = true;

    resultsArray.forEach((res) => {
      const markStr = String(res.marks ?? "").trim();
      const numMark = parseFloat(markStr);
      totalObtained += !isNaN(numMark) ? numMark : 0;

      const subjectEntry = examData.timetableEntries?.find(
        (te) => te.subject === res.subject || te.title === res.subject,
      );

      const subjectMeta = resultSubjectTemp.find(
        (s) => s.subject === res.subject,
      );

      const effectivePassMark =
        subjectEntry?.passMark || res.passMark || subjectMeta?.passMark;

      if (effectivePassMark) {
        // Only fail if there is a valid numeric mark below pass mark.
        // Empty strings and "AB"/"Absent" are treated as absent (not as 0).
        if (!isNaN(numMark) && numMark < Number(effectivePassMark)) {
          isPass = false;
        }
      }
    });

    const totalPossible = resultsArray.length * 100;
    const isFirstClass = Boolean(
      isPass && totalPossible > 0 && totalObtained >= totalPossible * 0.9,
    );

    return {
      status: isPass ? "PASS" : "FAIL",
      totalObtained,
      totalMarks: totalObtained,
      marksSum: totalObtained,
      isFirstClass,
    };
  };

  const addNewSubjectToResult = async () => {
    const trimmedSubject = newSubjectName.trim();
    if (!trimmedSubject) {
      toast.error("Please enter a subject name");
      return;
    }

    // Check if subject already exists in current result
    if (editFormData.result?.some((r) => r.subject === trimmedSubject)) {
      toast.error("Subject already exists in this result");
      return;
    }

    const newSubject = {
      subject: trimmedSubject,
      marks: "",
      grade: "",
      passMark: newSubjectPassMark,
      totalMarks: newSubjectTotalMarks,
      firstClassMarks: newSubjectFirstClassMarks,
    };

    // If it's a new subject (not in resultSubjectTemp), save it to exam document
    if (
      !resultSubjectTemp.some(
        (s) => s.subject === trimmedSubject && s.class === newSubjectClass,
      )
    ) {
      try {
        const newSubObj = {
          subject: trimmedSubject,
          class: newSubjectClass,
          passMark: newSubjectPassMark,
          totalMarks: newSubjectTotalMarks,
          firstClassMarks: newSubjectFirstClassMarks,
        };

        const examRef = doc(db, COLLECTIONS.EXAMS, editingResult.examID);
        await updateDoc(examRef, {
          resultSubjectTemp: [...resultSubjectTemp, newSubObj],
        });

        setResultSubjectTemp((prev) => [...prev, newSubObj]);
        toast.success(
          `Subject "${trimmedSubject}" added to exam configuration`,
        );
      } catch (err) {
        console.error("Error saving subject to exam:", err);
        toast.error("Failed to save subject configuration");
      }
    }

    // Add to current result
    setEditFormData({
      ...editFormData,
      result: [...(editFormData.result || []), newSubject],
    });

    // Reset form
    setNewSubjectName("");
    setNewSubjectPassMark(35);
    setNewSubjectTotalMarks(100);
    setNewSubjectFirstClassMarks(60);
    setNewSubjectClass("all");
    setShowAddSubjectDialog(false);
    toast.success(`Subject "${trimmedSubject}" added to result`);
  };

  const removeSubjectFromResult = (subIdx) => {
    const newResult = editFormData.result.filter((_, i) => i !== subIdx);
    setEditFormData({ ...editFormData, result: newResult });
    toast.success("Subject removed");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <button
          onClick={() => router.back()}
          className="hover:text-teal-600 transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-900 border-b-2 border-teal-600 pb-0.5">
          Unpublished Results
        </span>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-orange-600" />
            Unpublished Results
          </h1>
          <p className="text-gray-500">
            Manage results that are not yet visible to students
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleBulkDelete}
            disabled={selectedIds.size === 0 || bulkProcessing}
            variant="destructive"
            className="flex items-center gap-2"
          >
            {bulkProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete Selected ({selectedIds.size})
          </Button>
          <Button
            onClick={handleBulkPublish}
            disabled={selectedIds.size === 0 || bulkProcessing}
            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
          >
            {bulkProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
            Publish Selected ({selectedIds.size})
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search student, hall ticket, madarsa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  Filters:
                </span>
              </div>

              <Select value={filterExam} onValueChange={setFilterExam}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Exams" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Exams</SelectItem>
                  {exams.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <SearchableSelect
                value={filterMadarsa}
                onValueChange={setFilterMadarsa}
                placeholder="All Madarsas"
                options={madarsas}
                getOptionLabel={(m) => m.name}
                getOptionValue={(m) => m.madarsaId || m.id}
                getOptionSearchText={(m) => `${m.name} ${m.madarsaId || m.id}`}
                className="w-[200px]"
                triggerClassName="h-10"
              />

              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Classes</SelectItem>
                  {availableClasses.map((c) => (
                    <SelectItem key={c} value={c}>
                      {isNaN(parseInt(c)) ? c : `Class ${c}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        results.length > 0 &&
                        selectedIds.size === results.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Hall Ticket</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Madarsa</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Marks Sum</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
                        <p className="text-sm text-gray-500">
                          Loading results...
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="h-8 w-8 text-gray-300" />
                        <p className="text-gray-500 font-medium">
                          No unpublished results found
                        </p>
                        <p className="text-xs text-gray-400">
                          Try adjusting your filters or search term
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((result) => (
                    <TableRow key={result.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(result.id)}
                          onCheckedChange={() => toggleSelection(result.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        {result.hallTicketNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            {result.studentName}
                          </span>
                          <span className="text-xs text-gray-500 capitalize">
                            {result.gender || "N/A"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none"
                        >
                          Class {result.class}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <School className="h-3 w-3 text-gray-400" />
                          <span className="text-sm text-gray-600 line-clamp-1">
                            {result.madarsaName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600 line-clamp-1">
                          {exams.find((e) => e.id === result.examID)?.title ||
                            result.examID}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-gray-900">
                          {result.marksSum ||
                            result.totalMarks ||
                            result.result?.reduce(
                              (sum, item) => sum + (Number(item.marks) || 0),
                              0,
                            ) ||
                            0}
                        </span>
                      </TableCell>
                      <TableCell>
                        {result.status ? (
                          <Badge
                            className={`font-bold capitalize ${
                              result.status === "PASS"
                                ? "bg-green-100 text-green-700 hover:bg-green-100 border-none"
                                : "bg-red-100 text-red-700 hover:bg-red-100 border-none"
                            }`}
                          >
                            {result.status}
                          </Badge>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-teal-600 hover:bg-teal-50"
                            onClick={() => setViewingResult(result)}
                            title="Detailed Analysis"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-gray-600 hover:bg-gray-100"
                            onClick={() => handleEdit(result)}
                            title="Modify Record"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50"
                            onClick={() => handleDelete(result.id)}
                            title="Discard Result"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="ml-2 h-8 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                            onClick={() => handlePublish(result.id)}
                          >
                            Publish
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {results.length > 0 && (
          <div className="p-4 border-t bg-gray-50/50 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{results.length}</span> of{" "}
              <span className="font-medium">{totalCount}</span> results
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchResults("initial")}
                disabled={page === 1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchResults("next")}
                disabled={page * pageSize >= totalCount}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      {editingResult && (
        <Dialog open={true} onOpenChange={() => setEditingResult(null)}>
          <DialogContent className="max-w-4xl bg-white border-none shadow-2xl rounded-lg p-8 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold text-gray-900">
                Modify Result:{" "}
                <span className="text-teal-600">
                  {editingResult.studentName}
                </span>
              </DialogTitle>
              <p className="text-gray-500 font-medium">
                Updating examination details for Hall Ticket #
                {editingResult.hallTicketNumber}
              </p>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-6 py-4">
              <div className="space-y-2">
                <Label className="font-bold text-gray-700 ml-1">
                  Student Full Name
                </Label>
                <Input
                  className="h-12 rounded-lg border-gray-200 focus:ring-teal-500"
                  value={editFormData.studentName}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      studentName: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-gray-700 ml-1">
                  Hall Ticket Number
                </Label>
                <Input
                  className="h-12 rounded-lg border-gray-200 font-mono font-bold"
                  value={editFormData.hallTicketNumber}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      hallTicketNumber: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-gray-700 ml-1">
                  Class Level
                </Label>
                <Input
                  className="h-12 rounded-lg border-gray-200"
                  value={editFormData.class}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, class: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-gray-700 ml-1">
                  Madarsa Name
                </Label>
                <Input
                  className="h-12 rounded-lg border-gray-200"
                  value={editFormData.madarsaName}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      madarsaName: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="mt-8 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wider">
                  Subject-wise Scores
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50 font-bold"
                    onClick={autoCalculateGrades}
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate Grades
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-gray-200 text-gray-600 hover:bg-gray-50 font-bold"
                    onClick={clearAllGrades}
                  >
                    <Eraser className="h-4 w-4 mr-2" />
                    Clear Grades
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-teal-200 text-teal-700 hover:bg-teal-50 font-bold"
                    onClick={() => setShowAddSubjectDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Subject
                  </Button>
                </div>
              </div>

              {currentExamData && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="space-y-2 text-sm">
                      <p className="font-bold text-blue-900">
                        Pass/Fail Criteria:
                      </p>
                      <div className="grid grid-cols-3 gap-4 text-blue-700">
                        {currentExamData.overallPassMark && (
                          <div>
                            <span className="font-semibold">
                              Overall Pass Mark:
                            </span>{" "}
                            {currentExamData.overallPassMark}
                          </div>
                        )}
                        {currentExamData.firstFirstClassMark && (
                          <div>
                            <span className="font-semibold">
                              First Class Mark:
                            </span>{" "}
                            {currentExamData.firstFirstClassMark}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold">Status:</span>{" "}
                          {(() => {
                            const status = calculateResultStatus(
                              editFormData.result || [],
                              currentExamData,
                            );
                            return (
                              <Badge
                                className={`ml-2 ${
                                  status.status === "PASS"
                                    ? "bg-green-100 text-green-700 border-green-200"
                                    : "bg-red-100 text-red-700 border-red-200"
                                }`}
                              >
                                {status.status === "PASS" ? (
                                  <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                                ) : (
                                  <XCircle className="h-3 w-3 mr-1 inline" />
                                )}
                                {status.status}
                                {status.isFirstClass && " (First Class)"}
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {editFormData.result?.map((sub, sIdx) => {
                  const timetableEntry =
                    currentExamData?.timetableEntries?.find(
                      (te) =>
                        te.subject === sub.subject || te.title === sub.subject,
                    );
                  const subjectMeta = resultSubjectTemp.find(
                    (s) => s.subject === sub.subject,
                  );
                  const passMarkValue =
                    sub.passMark ||
                    timetableEntry?.passMark ||
                    subjectMeta?.passMark ||
                    35;
                  const totalMarksValue =
                    sub.totalMarks ||
                    timetableEntry?.totalMarks ||
                    subjectMeta?.totalMarks ||
                    100;
                  const isFromExam = !!timetableEntry?.passMark;

                  const markStr = String(sub.marks ?? "").trim();
                  const isAbsent =
                    markStr.toUpperCase() === "AB" ||
                    markStr.toLowerCase() === "absent";
                  const hasValidMark = markStr !== "" && !isAbsent;
                  const numericMark = hasValidMark ? parseFloat(markStr) : null;
                  const isPassing =
                    numericMark !== null &&
                    !isNaN(numericMark) &&
                    numericMark >= Number(passMarkValue);
                  const isFailing =
                    numericMark !== null &&
                    !isNaN(numericMark) &&
                    numericMark < Number(passMarkValue);

                  return (
                    <div
                      key={sIdx}
                      className={`grid grid-cols-12 gap-4 items-start p-4 rounded-lg border relative group/row transition-all ${
                        hasValidMark
                          ? isPassing
                            ? "border-green-200 bg-green-50/30"
                            : "border-red-200 bg-red-50/20"
                          : "border-gray-100 bg-gray-50/50"
                      }`}
                    >
                      <div className="col-span-4 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                            Subject Name
                          </Label>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              isFromExam
                                ? "bg-teal-100 text-teal-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                            title={
                              isFromExam
                                ? "Pass mark from exam"
                                : "Custom pass mark"
                            }
                          >
                            PM: {passMarkValue}/{totalMarksValue}
                          </span>
                        </div>
                        <Input
                          className="h-11 rounded-lg bg-white border-gray-200"
                          value={sub.subject}
                          onChange={(e) => {
                            const newR = [...editFormData.result];
                            newR[sIdx].subject = e.target.value;
                            setEditFormData({ ...editFormData, result: newR });
                          }}
                        />
                      </div>
                      <div className="col-span-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                            Marks
                          </Label>
                          {isAbsent && (
                            <Badge className="text-[9px] font-bold px-1.5 py-0 h-4 rounded bg-gray-100 text-gray-600 border-gray-200">
                              ABSENT
                            </Badge>
                          )}
                          {hasValidMark && (
                            <Badge
                              className={`text-[9px] font-bold px-1.5 py-0 h-4 rounded ${
                                isPassing
                                  ? "bg-green-100 text-green-700 border-green-200"
                                  : "bg-red-100 text-red-700 border-red-200"
                              }`}
                            >
                              {isPassing ? "PASS" : "FAIL"}
                            </Badge>
                          )}
                        </div>
                        <div className="relative">
                          <Input
                            className={`h-11 rounded-lg bg-white font-bold pr-8 transition-all ${
                              hasValidMark
                                ? isPassing
                                  ? "border-green-300 text-green-700 focus-visible:ring-green-200"
                                  : "border-red-300 text-red-600 focus-visible:ring-red-200"
                                : "border-gray-200 text-gray-900"
                            }`}
                            type="text"
                            value={sub.marks}
                            onChange={(e) => {
                              const val = e.target.value;
                              const isAbsentInput =
                                val.toUpperCase() === "AB" ||
                                val.toLowerCase() === "absent";
                              if (!isAbsentInput && val !== "") {
                                const numVal = parseFloat(val);
                                if (!isNaN(numVal) && numVal < 0) {
                                  toast.error("Marks cannot be negative");
                                  return;
                                }
                                if (
                                  !isNaN(numVal) &&
                                  numVal > Number(totalMarksValue)
                                ) {
                                  toast.error(
                                    `Marks cannot exceed ${totalMarksValue}`,
                                  );
                                  return;
                                }
                              }
                              const newR = [...editFormData.result];
                              newR[sIdx].marks = val;
                              newR[sIdx].grade = getGradeFromMark(val);
                              setEditFormData({
                                ...editFormData,
                                result: newR,
                              });
                            }}
                            placeholder={`0–${totalMarksValue} or AB`}
                          />
                          {(hasValidMark || isAbsent) && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {isAbsent ? (
                                <span className="text-[9px] font-black text-gray-400">
                                  AB
                                </span>
                              ) : isPassing ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="col-span-3 space-y-1.5">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                          Grade
                        </Label>
                        <Input
                          className="h-11 rounded-lg bg-white border-gray-200 font-bold text-gray-900"
                          value={sub.grade}
                          onChange={(e) => {
                            const newR = [...editFormData.result];
                            newR[sIdx].grade = e.target.value;
                            setEditFormData({ ...editFormData, result: newR });
                          }}
                          placeholder="A+, A, B..."
                        />
                      </div>
                      <div className="col-span-2 flex items-end justify-end gap-2 pt-7">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 rounded-lg text-red-500 hover:bg-red-50 opacity-0 group-hover/row:opacity-100 transition-opacity"
                          onClick={() => removeSubjectFromResult(sIdx)}
                          title="Remove Subject"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="mt-12 gap-3">
              <Button
                variant="ghost"
                className="h-12 px-8 rounded-lg font-bold text-gray-500"
                onClick={() => {
                  setEditingResult(null);
                  setEditFormData(null);
                  setCurrentExamData(null);
                }}
              >
                Discard Changes
              </Button>
              <Button
                className="h-12 px-10 rounded-lg bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-100 font-bold transition-all"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Save className="h-5 w-5 mr-2" />
                )}
                Finalize Updates
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Subject Dialog */}
      {showAddSubjectDialog && (
        <Dialog open={true} onOpenChange={() => setShowAddSubjectDialog(false)}>
          <DialogContent className="sm:max-w-[500px] bg-white p-0 overflow-hidden border-none shadow-2xl rounded-lg">
            <DialogHeader className="p-6 pb-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 mt-1 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-100">
                  <Plus className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <DialogTitle className="text-xl font-bold text-teal-900">
                    Add Subject
                  </DialogTitle>
                  <p className="text-teal-600 font-medium text-xs mt-1">
                    Select existing or create new subject
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="p-6">
              <Tabs
                value={subjectTab}
                onValueChange={setSubjectTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-lg h-11 mb-6">
                  <TabsTrigger
                    value="existing"
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm font-bold"
                  >
                    Use Existing
                  </TabsTrigger>
                  <TabsTrigger
                    value="new"
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm font-bold"
                  >
                    Add New
                  </TabsTrigger>
                </TabsList>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-teal-800 uppercase ml-1 tracking-wider">
                      Subject Name
                    </Label>
                    {subjectTab === "existing" ? (
                      <SearchableSelect
                        placeholder="Select existing subject"
                        options={resultSubjectTemp.map((s) => ({
                          label: `${s.subject} ${s.class !== "all" ? `(Class ${s.class})` : "(All Classes)"}`,
                          value: s.subject,
                        }))}
                        value={newSubjectName}
                        onValueChange={(val) => {
                          setNewSubjectName(val);
                          const existing = resultSubjectTemp.find(
                            (s) => s.subject === val,
                          );
                          if (existing) {
                            setNewSubjectPassMark(existing.passMark || 35);
                            setNewSubjectTotalMarks(existing.totalMarks || 100);
                            setNewSubjectFirstClassMarks(
                              existing.firstClassMarks || 60,
                            );
                            setNewSubjectClass(existing.class || "all");
                          }
                        }}
                        className="w-full"
                        triggerClassName="h-12 bg-white border-teal-200 focus:ring-2 focus:ring-teal-500 rounded-lg shadow-none"
                      />
                    ) : (
                      <Input
                        placeholder="Enter new subject name"
                        className="h-12 bg-white border-teal-200 focus:ring-2 focus:ring-teal-500 rounded-lg font-bold"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-teal-800 uppercase ml-1 tracking-wider">
                        Apply to Class
                      </Label>
                      <Select
                        value={newSubjectClass}
                        onValueChange={setNewSubjectClass}
                      >
                        <SelectTrigger className="h-12 bg-white border-teal-200 focus:ring-2 focus:ring-teal-500 rounded-lg">
                          <SelectValue placeholder="All Classes" />
                        </SelectTrigger>
                        <SelectContent className="bg-white rounded-lg">
                          <SelectItem value="all">All Classes</SelectItem>
                          {availableClasses.map((cls) => (
                            <SelectItem key={cls} value={cls}>
                              Class {cls}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-teal-800 uppercase ml-1 tracking-wider">
                        Total Marks
                      </Label>
                      <Input
                        type="number"
                        className="h-12 bg-white border-teal-200 focus:ring-2 focus:ring-teal-500 rounded-lg font-bold shadow-none"
                        value={newSubjectTotalMarks}
                        onChange={(e) =>
                          setNewSubjectTotalMarks(parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold text-teal-800 uppercase ml-1 tracking-wider">
                          Pass Marks
                        </Label>
                        {currentExamData?.timetableEntries?.find(
                          (te) =>
                            te.subject === newSubjectName.trim() ||
                            te.title === newSubjectName.trim(),
                        )?.passMark && (
                          <Badge className="bg-teal-50 text-teal-700 hover:bg-teal-50 border-teal-100 text-[10px] rounded-lg">
                            Exam:{" "}
                            {
                              currentExamData.timetableEntries.find(
                                (te) =>
                                  te.subject === newSubjectName.trim() ||
                                  te.title === newSubjectName.trim(),
                              ).passMark
                            }
                          </Badge>
                        )}
                      </div>
                      <Input
                        type="number"
                        className="h-12 bg-white border-teal-200 focus:ring-2 focus:ring-teal-500 rounded-lg font-bold shadow-none"
                        value={newSubjectPassMark}
                        onChange={(e) =>
                          setNewSubjectPassMark(parseInt(e.target.value) || 0)
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-teal-800 uppercase ml-1 tracking-wider">
                        First Class
                      </Label>
                      <Input
                        type="number"
                        className="h-12 bg-white border-teal-200 focus:ring-2 focus:ring-teal-500 rounded-lg font-bold shadow-none"
                        value={newSubjectFirstClassMarks}
                        onChange={(e) =>
                          setNewSubjectFirstClassMarks(
                            parseInt(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </Tabs>

              <div className="flex gap-3 pt-8">
                <Button
                  variant="ghost"
                  className="flex-1 h-12 font-bold text-gray-500 hover:bg-gray-50 rounded-lg"
                  onClick={() => {
                    setNewSubjectName("");
                    setNewSubjectPassMark(35);
                    setNewSubjectTotalMarks(100);
                    setNewSubjectFirstClassMarks(60);
                    setNewSubjectClass("all");
                    setShowAddSubjectDialog(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-[2] h-12 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg shadow-lg shadow-teal-100"
                  onClick={addNewSubjectToResult}
                >
                  Finalize & Add Subject
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* View Modal */}
      {viewingResult && (
        <Dialog
          open={true}
          onOpenChange={() => {
            setViewingResult(null);
          }}
        >
          <DialogContent className="max-w-4xl bg-white border-none shadow-xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
            <DialogHeader className="pb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl font-bold text-gray-900">
                    Examination Report Sheet
                  </DialogTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Detailed academic performance overview
                  </p>
                </div>
                <button
                  onClick={() => setViewingResult(null)}
                  className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-2">
              <div className="py-6 space-y-8">
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  <div className="h-24 w-24 shrink-0 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                    <User className="h-10 w-10 text-gray-400" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                      {viewingResult.studentName}
                    </h2>
                    <p className="text-gray-500 text-sm font-medium">
                      Hall Ticket:{" "}
                      <span className="text-gray-900 font-mono font-semibold">
                        {viewingResult.hallTicketNumber}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Badge className="bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-100">
                        Class {viewingResult.class}
                      </Badge>
                      <Badge variant="outline" className="text-gray-600">
                        {viewingResult.madarsaName}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50/50">
                      <TableRow>
                        <TableHead className="font-bold text-gray-900">
                          Subject
                        </TableHead>
                        <TableHead className="text-center font-bold text-gray-900">
                          Marks
                        </TableHead>
                        <TableHead className="text-right font-bold text-gray-900">
                          Grade
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingResult.result?.map((sub, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {sub.subject}
                          </TableCell>
                          <TableCell className="text-center font-bold text-teal-600">
                            {sub.marks}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {sub.grade}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
