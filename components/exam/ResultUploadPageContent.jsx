"use client";

import { useState, useEffect, useCallback, Fragment, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Upload,
  ArrowLeft,
  Save,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Search,
  X,
  Calculator,
  Plus,
  User,
  Trash2,
  ArrowRight,
  Download,
  Eye,
} from "lucide-react";
import {
  doc,
  getDoc,
  collection,
  writeBatch,
  updateDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  addDoc,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { COLLECTIONS } from "@/lib/firestoreService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  getExamSubjects,
  getSubjectsByHallTicket,
} from "@/lib/getExamSubjects";

const CLASS_EQUIVALENTS = {
  1: ["1", "I", "i"],
  2: ["2", "II", "ii"],
  3: ["3", "III", "iii"],
  4: ["4", "IV", "iv"],
  5: ["5", "V", "v"],
  6: ["6", "VI", "vi"],
  7: ["7", "VII", "vii"],
  8: ["8", "VIII", "viii"],
  9: ["9", "IX", "ix"],
  10: ["10", "X", "x"],
  11: ["11", "XI", "xi"],
  12: ["12", "XII", "xii"],
  I: ["1", "I", "i"],
  II: ["2", "II", "ii"],
  III: ["3", "III", "iii"],
  IV: ["4", "IV", "iv"],
  V: ["5", "V", "v"],
  VI: ["6", "VI", "vi"],
  VII: ["7", "VII", "vii"],
  VIII: ["8", "VIII", "viii"],
  IX: ["9", "IX", "ix"],
  X: ["10", "X", "x"],
  XI: ["11", "XI", "xi"],
  XII: ["12", "XII", "xii"],
};

export default function ResultUploadPageContent({ examId }) {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState(null);
  const [excelFile, setExcelFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [columnMapping, setColumnMapping] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [headerInfo, setHeaderInfo] = useState({});
  const [rawJsonData, setRawJsonData] = useState([]);
  const [studentStartRow, setStudentStartRow] = useState(0);
  const [studentEndRow, setStudentEndRow] = useState(0);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [subjectMapping, setSubjectMapping] = useState({});
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [currentSheetName, setCurrentSheetName] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [columnWidths, setColumnWidths] = useState({
    slNo: 70,
    class: 120,
    regNo: 160,
    name: 200,
    madarsa: 180,
    remark: 100,
    total: 80,
    status: 90,
  });

  const columnWidthsRef = useRef(columnWidths);
  useEffect(() => {
    columnWidthsRef.current = columnWidths;
  }, [columnWidths]);

  const startResizing = useCallback((e, colKey) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = columnWidthsRef.current[colKey];

    const onMouseMove = (moveEvent) => {
      const diff = moveEvent.pageX - startX;
      setColumnWidths((prev) => ({
        ...prev,
        [colKey]: Math.max(50, startWidth + diff),
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  // --- Manual Entry Logic ---
  const [activeTab, setActiveTab] = useState("bulk");
  const [manualHallTicket, setManualHallTicket] = useState("");
  const [manualStudents, setManualStudents] = useState([]);
  const [manualEntries, setManualEntries] = useState({});
  const [fetchingStudent, setFetchingStudent] = useState(false);
  const [existingResults, setExistingResults] = useState({});
  const [manualSearchMode, setManualSearchMode] = useState("madarsa");
  const [evaluatedItems, setEvaluatedItems] = useState([]);
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
  const [publishByDefault, setPublishByDefault] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // By Madarsa Tab States
  const [selectedMadarsa, setSelectedMadarsa] = useState("");
  const [madarsaList, setMadarsaList] = useState([]);
  const [madarsaStudents, setMadarsaStudents] = useState([]);
  const [madarsaSearch, setMadarsaSearch] = useState("");
  const [madarsaPage, setMadarsaPage] = useState(1);
  const [madarsaTotalCount, setMadarsaTotalCount] = useState(0);
  const [madarsaLastDoc, setMadarsaLastDoc] = useState(null);
  const [madarsaDocHistory, setMadarsaDocHistory] = useState([]);
  const [fetchingMadarsaStudents, setFetchingMadarsaStudents] = useState(false);
  const [fetchingMadarsaList, setFetchingMadarsaList] = useState(false);
  const [selectedMadarsaClass, setSelectedMadarsaClass] = useState("all");
  const [madarsaClasses, setMadarsaClasses] = useState([]);
  const [fetchingMadarsaClasses, setFetchingMadarsaClasses] = useState(false);
  const madarsaPageSize = 20;

  // Add Subject States
  const [showAddSubjectInput, setShowAddSubjectInput] = useState(false);
  const [addSubjectForClass, setAddSubjectForClass] = useState(null);
  const [subjectTab, setSubjectTab] = useState("existing");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectPassMark, setNewSubjectPassMark] = useState(35);
  const [newSubjectTotalMarks, setNewSubjectTotalMarks] = useState(100);
  const [newSubjectFirstClassMarks, setNewSubjectFirstClassMarks] =
    useState(60);
  const [newSubjectClass, setNewSubjectClass] = useState("all");
  const [manualPassMarks, setManualPassMarks] = useState({});
  const [manualTotalMarks, setManualTotalMarks] = useState({});
  const [manualFirstClassMarks, setManualFirstClassMarks] = useState({});
  const [resultSubjectTemp, setResultSubjectTemp] = useState([]);
  const [subjectToDelete, setSubjectToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletedResultSubjects, setDeletedResultSubjects] = useState([]);
  const [editingHTs, setEditingHTs] = useState(new Set());
  const [removedSubjectsPerStudent, setRemovedSubjectsPerStudent] = useState(
    {},
  );
  const [htStudentSubjects, setHtStudentSubjects] = useState({});

  // Resolves per-student subjects from their hall ticket and syncs state
  const applyHallTicketSubjects = useCallback(
    async (students, existingResultsMap) => {
      if (!students || students.length === 0) return;

      // Fetch timetableEntries for each student in parallel
      const htSubjectsMap = {};
      await Promise.all(
        students.map(async (student) => {
          const ht = student.hallTicketNumber?.toString();
          if (!ht) return;
          try {
            const subs = await getSubjectsByHallTicket(examId, ht);
            console.log(
              `[applyHallTicketSubjects] HT: ${ht} → subjects:`,
              subs.map((s) => s.subject),
            );
            if (subs.length > 0) {
              htSubjectsMap[ht] = subs;
            } else {
              console.warn(
                `[applyHallTicketSubjects] HT: ${ht} → no timetableEntries found in hallTicket doc`,
              );
            }
          } catch (err) {
            console.error(
              `[applyHallTicketSubjects] HT: ${ht} → error fetching subjects:`,
              err,
            );
          }
        }),
      );

      // Build union of subject names from hall tickets (filter deleted ones)
      const subjectNamesSet = new Set();
      Object.values(htSubjectsMap).forEach((subs) =>
        subs.forEach((s) => {
          if (s.subject && !deletedResultSubjects.includes(s.subject))
            subjectNamesSet.add(s.subject);
        }),
      );

      // Always include subjects from exam.timetableEntries as default
      if (exam?.timetableEntries) {
        exam.timetableEntries.forEach((entry) => {
          const subName = entry.subject || entry.title;
          if (subName && !deletedResultSubjects.includes(subName))
            subjectNamesSet.add(subName);
        });
      }

      // Also include extra subjects from resultSubjectTemp
      if (exam?.resultSubjectTemp) {
        exam.resultSubjectTemp.forEach((s) => {
          const sub = typeof s === "string" ? s : s?.subject;
          if (sub && !deletedResultSubjects.includes(sub))
            subjectNamesSet.add(sub);
        });
      }

      // Also include subjects that were previously saved for these students but might not be in timetable/temp anymore
      Object.values(existingResultsMap || {}).forEach((resultObj) => {
        resultObj?.result?.forEach((s) => {
          if (s.subject && !deletedResultSubjects.includes(s.subject)) {
            subjectNamesSet.add(s.subject);
          }
        });
      });

      const mergedSubjects = Array.from(subjectNamesSet);
      if (mergedSubjects.length === 0) return;

      // Resolve pass marks: hall ticket data first, then exam timetableEntries (case-insensitive)
      const newPassMarks = {};
      mergedSubjects.forEach((subName) => {
        for (const subs of Object.values(htSubjectsMap)) {
          const found = subs.find(
            (s) => s.subject?.toLowerCase() === subName.toLowerCase(),
          );
          if (found?.passMark) {
            newPassMarks[subName] = found.passMark;
            break;
          }
        }
        if (!newPassMarks[subName] && exam?.timetableEntries) {
          const matched = exam.timetableEntries.find(
            (te) =>
              (te.subject || te.title || "").toLowerCase() ===
              subName.toLowerCase(),
          );
          if (matched?.passMark) newPassMarks[subName] = matched.passMark;
        }
      });

      // Build manualEntries per student — only include relevant subjects
      const newEntries = {};
      students.forEach((student) => {
        const ht = student.hallTicketNumber?.toString();
        if (!ht) return;
        const studentClass = student.classLevel || student.class;
        const c2 = String(studentClass).trim().toUpperCase();

        const existingResult = existingResultsMap[ht];
        newEntries[ht] = {};

        // Identify which subjects from mergedSubjects are relevant for THIS student
        mergedSubjects.forEach((subName) => {
          // 1. Check if it's explicitly in their hall ticket
          const htSubs = htSubjectsMap[ht] || [];
          let isRelevant = htSubs.some(
            (s) => (s.subject || "").toLowerCase() === subName.toLowerCase(),
          );

          // 2. Check if it's a core timetable subject
          if (!isRelevant && exam?.timetableEntries) {
            isRelevant = exam.timetableEntries.some(
              (te) =>
                (te.subject || te.title || "").toLowerCase() ===
                subName.toLowerCase(),
            );
          }

          // 3. Check if it's in resultSubjectTemp and matches class
          if (!isRelevant && exam?.resultSubjectTemp) {
            const meta = exam.resultSubjectTemp.find(
              (s) =>
                (typeof s === "string" ? s : s.subject || "").toLowerCase() ===
                subName.toLowerCase(),
            );
            if (meta) {
              const targetClass = typeof meta === "string" ? "all" : meta.class;
              if (!targetClass || targetClass === "all") {
                isRelevant = true;
              } else {
                const c1 = String(targetClass).trim().toUpperCase();
                if (c1 === c2) {
                  isRelevant = true;
                } else {
                  for (const eq of Object.values(CLASS_EQUIVALENTS || {})) {
                    const eqUpper = eq.map((e) => String(e).toUpperCase());
                    if (eqUpper.includes(c1) && eqUpper.includes(c2)) {
                      isRelevant = true;
                      break;
                    }
                  }
                }
              }
            }
          }

          // 4. Always keep if it exists in existing results (don't lose data)
          if (!isRelevant && existingResult?.result) {
            isRelevant = existingResult.result.some(
              (r) => r.subject?.toLowerCase() === subName.toLowerCase(),
            );
          }

          if (isRelevant) {
            let entry = { mark: "", grade: "" };
            if (existingResult?.result) {
              const found = existingResult.result.find(
                (r) => r.subject?.toLowerCase() === subName.toLowerCase(),
              );
              if (found)
                entry = { mark: found.marks ?? "", grade: found.grade ?? "" };
            }
            newEntries[ht][subName] = entry;
          }
        });
      });

      console.log("[applyHallTicketSubjects] setting state →", {
        mergedSubjects,
        newPassMarks,
        studentCount: students.length,
        htKeys: Object.keys(newEntries),
      });

      // Maintain sync with editingHTs: students without results enter edit mode by default
      setEditingHTs((prev) => {
        const next = new Set(prev);
        students.forEach((s) => {
          const ht = s.hallTicketNumber?.toString();
          if (ht) {
            if (!existingResultsMap[ht]) {
              next.add(ht);
            } else {
              // Only remove from editing if it's the initial load or re-fetch
              // If they were intentionally being edited, we might want to keep them there
              // but per user request, saving refreshes it to view mode.
              next.delete(ht);
            }
          }
        });
        return next;
      });

      setHtStudentSubjects(htSubjectsMap);
      setAvailableSubjects(mergedSubjects);
      setManualPassMarks(newPassMarks);
      setManualEntries(newEntries);
    },
    [examId, exam, deletedResultSubjects],
  );

  const fetchManualStudents = useCallback(
    async (ticketOverride) => {
      const targetTickets = ticketOverride || manualHallTicket;
      if (!targetTickets) return;
      setFetchingStudent(true);
      setManualStudents([]);
      // Only clear existingResults if not in madarsa mode to maintain table badges
      if (manualSearchMode !== "madarsa") {
        setExistingResults({});
      }
      setManualEntries({});

      const items = targetTickets
        .toString()
        .split(/[, \s\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const finalTickets = [];
      items.forEach((item) => {
        if (item.includes("-")) {
          const [startStr, endStr] = item.split("-");
          const start = parseInt(startStr);
          const end = parseInt(endStr);
          if (!isNaN(start) && !isNaN(end) && start <= end) {
            const count = end - start + 1;
            if (count > 200) {
              toast.error(`Range ${item} is too large (max 200)`);
              return;
            }
            for (let i = start; i <= end; i++) {
              finalTickets.push(i.toString());
            }
          }
        } else {
          finalTickets.push(item);
        }
      });

      const uniqueTickets = [...new Set(finalTickets)];

      if (uniqueTickets.length === 0) {
        setFetchingStudent(false);
        return;
      }

      const newStudents = [];
      const newExistingResults = {};
      const fetchedResults = [];

      try {
        await Promise.all(
          uniqueTickets.map(async (ht) => {
            const hallTicketNum = ht.toString();
            const docId = `${examId}_${hallTicketNum}`;
            const resultDocRef = doc(
              db,
              COLLECTIONS.EXAM_RESULTS || "results",
              docId,
            );
            const resultSnap = await getDoc(resultDocRef);

            let resultData = null;
            if (resultSnap.exists()) {
              resultData = resultSnap.data();
              newExistingResults[hallTicketNum] = resultData;
              fetchedResults.push(resultData);
            }

            const q = query(
              collection(db, "hallTickets", examId, "students"),
              where("hallTicketNumber", "==", hallTicketNum),
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
              const studentData = snapshot.docs[0].data();
              newStudents.push(studentData);
            } else {
              newStudents.push({
                hallTicketNumber: hallTicketNum,
                fullName: resultData?.studentName || "",
                classLevel: resultData?.class || "",
                madarsa: resultData?.madarsaName || "",
                sadarAddress: resultData?.place || "",
                mekhala: resultData?.zone || "",
                isCustom: true,
                profilePictureUrl: null,
              });
            }
          }),
        );

        newStudents.sort(
          (a, b) => Number(a.hallTicketNumber) - Number(b.hallTicketNumber),
        );

        if (newStudents.length > 0) {
          const firstHT = newStudents[0].hallTicketNumber;
          console.log(
            `[fetchManualStudents] subjects from hallTickets for first student (HT: ${firstHT}):`,
            await getSubjectsByHallTicket(examId, firstHT),
          );
        }

        await applyHallTicketSubjects(newStudents, newExistingResults);

        setManualStudents(newStudents);
        setExistingResults((prev) => ({ ...prev, ...newExistingResults }));

        if (newStudents.length > 0) {
          toast.success(`Fetched ${newStudents.length} entries`);
        }
      } catch (error) {
        console.error("Error fetching students:", error);
        toast.error("Failed to fetch details");
      } finally {
        setFetchingStudent(false);
      }
    },
    [manualHallTicket, examId, manualSearchMode, applyHallTicketSubjects],
  );

  const handleManualStudentEdit = (ht, field, value) => {
    setManualStudents((prev) =>
      prev.map((s) => {
        if (s.hallTicketNumber.toString() === ht.toString()) {
          return { ...s, [field]: value };
        }
        return s;
      }),
    );
  };

  const handleEditExisting = (htNo) => {
    const existingResult = existingResults[htNo];
    if (!existingResult) return;

    const newManualPassMarks = { ...manualPassMarks };
    const studentEntries = {};

    // Only load subjects that exist in the saved result document
    existingResult.result?.forEach((item) => {
      studentEntries[item.subject] = {
        mark: item.marks ?? "",
        grade: item.grade || "",
      };
      if (item.passMark !== undefined) {
        newManualPassMarks[item.subject] = item.passMark;
      }
      if (item.totalMarks !== undefined) {
        setManualTotalMarks((prev) => ({
          ...prev,
          [item.subject]: item.totalMarks,
        }));
      }
      if (item.firstClassMarks !== undefined) {
        setManualFirstClassMarks((prev) => ({
          ...prev,
          [item.subject]: item.firstClassMarks,
        }));
      }
    });

    setManualPassMarks(newManualPassMarks);
    setManualEntries((prev) => ({
      ...prev,
      [htNo]: studentEntries,
    }));

    // Clear any stale removals for this student
    setRemovedSubjectsPerStudent((prev) => {
      const next = { ...prev };
      delete next[htNo];
      return next;
    });

    setEditingHTs((prev) => {
      const next = new Set(prev);
      next.add(htNo.toString());
      return next;
    });

    toast.info(`Editing result for ${htNo}`);
  };

  const clearManualEntry = () => {
    setManualHallTicket("");
    setManualStudents([]);
    setManualEntries({});
    setExistingResults({});
    setFetchingStudent(false);
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

  const autoCalculateManualGrades = () => {
    const updatedEntries = { ...manualEntries };
    let count = 0;
    Object.keys(updatedEntries).forEach((ht) => {
      Object.keys(updatedEntries[ht]).forEach((sub) => {
        if (!updatedEntries[ht][sub].grade) {
          updatedEntries[ht][sub].grade = getGradeFromMark(
            updatedEntries[ht][sub].mark,
          );
          count++;
        }
      });
    });
    setManualEntries(updatedEntries);
    if (count > 0) toast.success(`Calculated ${count} grades`);
  };

  const clearManualGrades = () => {
    const updatedEntries = { ...manualEntries };
    let count = 0;
    Object.keys(updatedEntries).forEach((ht) => {
      Object.keys(updatedEntries[ht]).forEach((sub) => {
        if (updatedEntries[ht][sub].grade) {
          updatedEntries[ht][sub].grade = "";
          count++;
        }
      });
    });
    setManualEntries(updatedEntries);
    if (count > 0) toast.success(`Cleared ${count} grades`);
  };

  const handleEntryChange = (ht, subject, field, value) => {
    setManualEntries((prev) => {
      const current = prev[ht]?.[subject] || {};
      const updated = { ...current, [field]: value };
      if (field === "mark") {
        updated.grade = getGradeFromMark(value);
      }
      return {
        ...prev,
        [ht]: {
          ...(prev[ht] || {}),
          [subject]: updated,
        },
      };
    });
  };

  const getPassMarkForSubject = (subjectName) => {
    if (!subjectName) return 0;
    const subLower = subjectName.toLowerCase();
    const te = (exam?.timetableEntries || []).find(
      (t) => (t.subject || t.title || "").toLowerCase() === subLower,
    );
    if (te?.passMark) return Number(te.passMark);
    if (manualPassMarks[subjectName])
      return Number(manualPassMarks[subjectName]);
    const temp = (resultSubjectTemp || []).find(
      (s) =>
        (typeof s === "string" ? s : s.subject || "").toLowerCase() ===
        subLower,
    );
    if (temp?.passMark) return Number(temp.passMark);
    return 0;
  };

  const autoCalculateBulkGrades = () => {
    if (!parsedData) return;
    const updated = parsedData.map((student) => {
      const updatedSubjects = { ...student.subjects };
      Object.keys(updatedSubjects).forEach((subName) => {
        if (!updatedSubjects[subName].grade) {
          updatedSubjects[subName].grade = getGradeFromMark(
            updatedSubjects[subName].mark,
          );
        }
      });
      return { ...student, subjects: updatedSubjects };
    });
    setParsedData(updated);
    toast.success("Grades calculated based on marks");
  };

  const removeAllBulkGrades = () => {
    if (!parsedData) return;
    const updated = parsedData.map((student) => {
      const updatedSubjects = { ...student.subjects };
      Object.keys(updatedSubjects).forEach((subName) => {
        updatedSubjects[subName].grade = "";
      });
      return { ...student, subjects: updatedSubjects };
    });
    setParsedData(updated);
    toast.success("All grades removed");
  };

  const calculateResultStatus = (resultsArray, examData, remark) => {
    let isPass = true;
    let totalObtained = 0;

    // Check remark override first - MOVE TO TOP
    if (remark) {
      const cleanRemark = remark.toString().trim().toUpperCase();
      // Broaden detection for PASS/FAIL
      const isExplicitPass = cleanRemark === "P" || cleanRemark === "PASS" || cleanRemark === "PASSED" || (cleanRemark.startsWith("P") && cleanRemark.length <= 6);
      const isExplicitFail = cleanRemark === "F" || cleanRemark === "FAIL" || cleanRemark === "FAILED" || (cleanRemark.startsWith("F") && cleanRemark.length <= 6);

      if (isExplicitPass || isExplicitFail) {
        (resultsArray || []).forEach((res) => {
          totalObtained += Number(res.marks) || 0;
        });

        const finalStatus = isExplicitPass ? "PASS" : "FAIL";
        // Sync First Class logic: 90% threshold
        const totalPossible = (resultsArray || []).length * 100;
        const isFirstClass = Boolean(
          finalStatus === "PASS" &&
          totalPossible > 0 &&
          totalObtained >= (totalPossible * 0.9)
        );

        return {
          status: finalStatus,
          totalObtained,
          totalMarks: totalObtained,
          marksSum: totalObtained,
          isFirstClass,
        };
      }
    }

    if (!resultsArray || resultsArray.length === 0) {
      return { status: "FAIL", totalObtained: 0, totalMarks: 0, marksSum: 0, isFirstClass: false };
    }

    // Create lookup maps for performance
    const timetableMap = new Map();
    (examData?.timetableEntries || []).forEach((te) => {
      const name = te.subject || te.title;
      if (name) timetableMap.set(name.toLowerCase(), te);
    });

    const tempMap = new Map();
    (resultSubjectTemp || []).forEach((s) => {
      const name = typeof s === "string" ? s : s.subject;
      if (name) tempMap.set(name.toLowerCase(), s);
    });

    // Handle "NA" / specific subjects if any
    const containsNoExam = resultsArray.some(
      (r) => r.subject === "NO EXAM" || r.marks === "NA",
    );
    if (containsNoExam) {
      const allNA = resultsArray.every(
        (r) => r.marks === "NA" || r.subject === "NO EXAM",
      );
      if (allNA) {
        return { status: "PASS", totalObtained: 0, totalMarks: 0, marksSum: 0, isFirstClass: false };
      }
    }

    // Check subject-wise pass marks
    resultsArray.forEach((res) => {
      const m = Number(res.marks) || 0;
      totalObtained += m;

      const subLower = (res.subject || "").toLowerCase();
      const subjectEntry = timetableMap.get(subLower);
      const subjectMeta = tempMap.get(subLower);

      const effectivePassMark =
        res.passMark ||
        subjectEntry?.passMark ||
        manualPassMarks[res.subject] ||
        subjectMeta?.passMark;

      if (effectivePassMark && m < Number(effectivePassMark)) {
        isPass = false;
      }
    });

    // Check overall pass mark
    if (
      examData?.overallPassMark &&
      totalObtained < Number(examData.overallPassMark)
    ) {
      isPass = false;
    }

    // Check first class: 90% threshold
    const totalPossible = resultsArray.length * 100;
    const isFirstClass = Boolean(
      isPass &&
      totalPossible > 0 &&
      totalObtained >= (totalPossible * 0.9)
    );

    return {
      status: isPass ? "PASS" : "FAIL",
      totalObtained,
      totalMarks: totalObtained,
      marksSum: totalObtained,
      isFirstClass,
    };
  };

  // const promoteStudent = async (studentId, currentClass) => {
  //   if (!studentId) return;

  //   try {
  //     const studentDocRef = doc(db, "students", studentId);
  //     const studentSnap = await getDoc(studentDocRef);

  //     if (studentSnap.exists()) {
  //       const studentData = studentSnap.data();
  //       const currentClassStr = studentData.classLevel || currentClass;

  //       const match = currentClassStr.match(/(\d+)/);
  //       if (match) {
  //         const nextLevel = parseInt(match[1]) + 1;
  //         const nextClass = currentClassStr.replace(
  //           match[1],
  //           nextLevel.toString(),
  //         );

  //         await updateDoc(studentDocRef, {
  //           classLevel: nextClass,
  //           promotedAt: serverTimestamp(),
  //           lastGraduatedClass: currentClassStr,
  //         });

  //         console.log(`Promoted student ${studentId} to ${nextClass}`);
  //       }
  //     }
  //   } catch (err) {
  //     console.error("Error promoting student:", err);
  //   }
  // };

  const handleManualSubmit = async () => {
    console.log("handleManualSubmit called");
    if (manualStudents.length === 0) {
      console.log("No manual students to save");
      return;
    }
    setUploading(true);
    console.log(
      "Starting manual submit for",
      manualStudents.length,
      "students",
    );

    const validationErrors = [];
    manualStudents.forEach((student) => {
      const ht = student.hallTicketNumber.toString();
      const studentEntries = manualEntries[ht];
      if (!studentEntries) return;

      Object.keys(studentEntries).forEach((sub) => {
        const entry = studentEntries[sub];
        if (entry) {
          const markVal = entry.mark === "" ? 0 : Number(entry.mark);
          if (markVal < 0 || markVal > 100) {
            validationErrors.push(
              `Invalid mark (${entry.mark}) for ${ht} - ${sub}`,
            );
          }
        }
      });
    });

    if (validationErrors.length > 0) {
      toast.error(validationErrors[0]);
      setUploading(false);
      return;
    }

    const batch = writeBatch(db);
    let count = 0;

    // Pre-calculate common lookup maps
    const timetableMap = new Map();
    (exam?.timetableEntries || []).forEach((te) => {
      const name = te.subject || te.title;
      if (name) timetableMap.set(name.toLowerCase(), te);
    });

    const tempMap = new Map();
    resultSubjectTemp.forEach((s) => {
      const name = typeof s === "string" ? s : s.subject;
      if (name) tempMap.set(name.toLowerCase(), s);
    });

    manualStudents.forEach((student) => {
      const ht = student.hallTicketNumber.toString();
      const resultsArray = [];
      const studentEntries = manualEntries[ht];
      if (!studentEntries) return;

      const htSubs = htStudentSubjects[ht] || [];
      const htSubNamesSet = new Set(
        htSubs.map((s) =>
          (typeof s === "string" ? s : s.subject || "").toLowerCase(),
        ),
      );

      const studentClass = student.classLevel || student.class;
      const c2 = String(studentClass).trim().toUpperCase();

      // Core subjects from timetable
      const timetableSubsFiltered = (exam?.timetableEntries || []).filter(
        (te) => {
          const name = te.subject || te.title;
          if (!name) return false;
          const low = name.toLowerCase();
          return (
            !htSubNamesSet.has(low) && !deletedResultSubjects.includes(name)
          );
        },
      );

      // Extra subjects from resultSubjectTemp
      const extraSubsFiltered = resultSubjectTemp.filter((extraSub) => {
        if (!extraSub.subject) return false;
        const low = extraSub.subject.toLowerCase();

        if (htSubNamesSet.has(low) || timetableMap.has(low)) return false;
        if (extraSub.class === "all" || !extraSub.class) return true;

        const c1 = String(extraSub.class).trim().toUpperCase();
        if (c1 === c2) return true;

        for (const eq of Object.values(CLASS_EQUIVALENTS || {})) {
          const eqUpper = eq.map((e) => String(e).toUpperCase());
          if (eqUpper.includes(c1) && eqUpper.includes(c2)) return true;
        }
        return false;
      });

      const relevantSubjects = [
        ...htSubs.map((s) => (typeof s === "string" ? { subject: s } : s)),
        ...timetableSubsFiltered.map((te) => ({
          subject: te.subject || te.title,
          passMark: manualPassMarks[te.subject || te.title] || te.passMark,
          totalMarks:
            manualTotalMarks[te.subject || te.title] || te.totalMarks || 100,
          firstClassMarks:
            manualFirstClassMarks[te.subject || te.title] ||
            te.firstClassMarks ||
            60,
        })),
        ...extraSubsFiltered.map((s) => ({
          subject: s.subject,
          passMark: manualPassMarks[s.subject] || s.passMark,
          totalMarks: manualTotalMarks[s.subject] || s.totalMarks || 100,
          firstClassMarks:
            manualFirstClassMarks[s.subject] || s.firstClassMarks || 60,
        })),
      ];

      const studentRemovedSubjects = removedSubjectsPerStudent[ht] || [];
      relevantSubjects
        .filter((sub) => !studentRemovedSubjects.includes(sub.subject))
        .forEach((subObj) => {
          const sub = subObj.subject;
          if (!sub) return;

          const entry = studentEntries[sub] || { mark: "", grade: "" };
          const subLower = sub.toLowerCase();
          const timetableEntry = timetableMap.get(subLower);
          const tempEntry = tempMap.get(subLower);

          resultsArray.push({
            subject: sub,
            marks: entry.mark === "" ? 0 : Number(entry.mark) || 0,
            grade: entry.grade || "NA",
            passMark:
              subObj.passMark ||
              timetableEntry?.passMark ||
              manualPassMarks[sub] ||
              tempEntry?.passMark ||
              0,
            totalMarks:
              subObj.totalMarks ||
              manualTotalMarks[sub] ||
              tempEntry?.totalMarks ||
              timetableEntry?.totalMarks ||
              100,
            firstClassMarks:
              subObj.firstClassMarks ||
              manualFirstClassMarks[sub] ||
              tempEntry?.firstClassMarks ||
              60,
          });
        });

      const { status, totalObtained, isFirstClass } = calculateResultStatus(
        resultsArray,
        exam,
      );

      const resultDocData = {
        studentName: student.fullName || student.studentName || "",
        madarsaName: student.madarsa || student.madarsaName || "",
        mid: student.madarsaId || student.mid || "",
        examID: examId,
        hallTicketNumber: ht,
        class: student.classLevel || student.class || "",
        place: student.sadarAddress || student.place || "",
        zone: student.mekhala || student.zone || "",
        result: resultsArray,
        totalObtained,
        status,
        isFirstClass: !!isFirstClass,
        uploadedAt: serverTimestamp(),
        uploadedBy: user?.uid || "admin",
        isManual: true,
        isPublished: !!publishByDefault,
        studentId: student.studentId || student.id || "",
      };

      const docId = `${examId}_${ht}`;
      const docRef = doc(db, COLLECTIONS.EXAM_RESULTS || "results", docId);
      batch.set(docRef, resultDocData);
      count++;
    });

    if (count === 0) {
      toast.info("No changes to save");
      setUploading(false);
      return;
    }

    try {
      await batch.commit();

      const hts =
        manualStudents.length > 1
          ? `${manualStudents[0].hallTicketNumber} - ${manualStudents[manualStudents.length - 1].hallTicketNumber}`
          : manualStudents[0]?.hallTicketNumber || "Direct Entry";

      toast.success(`Published performance for ${count} students`);

      setEvaluatedItems((prev) => [
        { name: `HT: ${hts}`, date: new Date().toLocaleTimeString() },
        ...prev,
      ]);

      if (manualSearchMode === "madarsa" && selectedMadarsa) {
        console.log("Refreshing madarsa students list");
        fetchMadarsaStudents("initial");
      } else {
        fetchManualStudents();
      }

      // Exit edit mode for these students
      setEditingHTs((prev) => {
        const next = new Set(prev);
        manualStudents.forEach((s) => {
          next.delete(s.hallTicketNumber.toString());
        });
        return next;
      });

      // Clear localized subject removals for saved students
      setRemovedSubjectsPerStudent((prev) => {
        const next = { ...prev };
        manualStudents.forEach((s) => {
          delete next[s.hallTicketNumber.toString()];
        });
        return next;
      });
    } catch (error) {
      console.error("Error saving manual results:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      toast.error(
        `Failed to save results: ${error.message || "Unknown error"}`,
      );
    } finally {
      console.log("Setting uploading to false");
      setUploading(false);
    }
  };

  const handleUpdateExistingResult = async (ht) => {
    const student = manualStudents.find(
      (s) => s.hallTicketNumber.toString() === ht,
    );
    if (!student) return;

    setUploading(true);
    try {
      const studentEntries = manualEntries[ht] || {};
      const removedSubs = removedSubjectsPerStudent[ht] || [];
      const resultsArray = [];

      Object.keys(studentEntries)
        .filter((sub) => !removedSubs.includes(sub))
        .forEach((sub) => {
          const entry = studentEntries[sub];
          resultsArray.push({
            subject: sub,
            marks: entry.mark === "" ? 0 : Number(entry.mark) || 0,
            grade: entry.grade || "NA",
            passMark: manualPassMarks[sub] || getPassMarkForSubject(sub) || 0,
            totalMarks: manualTotalMarks[sub] || 100,
            firstClassMarks: manualFirstClassMarks[sub] || 60,
          });
        });

      const { status, totalObtained, isFirstClass } = calculateResultStatus(
        resultsArray,
        exam,
      );

      const docId = `${examId}_${ht}`;
      const docRef = doc(db, COLLECTIONS.EXAM_RESULTS || "results", docId);
      await updateDoc(docRef, {
        result: resultsArray,
        totalObtained,
        status,
        isFirstClass: !!isFirstClass,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || user?.uid || "admin",
      });

      // Update local existingResults state
      setExistingResults((prev) => ({
        ...prev,
        [ht]: {
          ...(prev[ht] || {}),
          result: resultsArray,
          totalObtained,
          status,
          isFirstClass: !!isFirstClass,
        },
      }));

      // Exit edit mode
      setEditingHTs((prev) => {
        const next = new Set(prev);
        next.delete(ht);
        return next;
      });

      // Clear removals
      setRemovedSubjectsPerStudent((prev) => {
        const next = { ...prev };
        delete next[ht];
        return next;
      });

      toast.success(`Updated result for HT: ${ht}`);
    } catch (error) {
      console.error("Error updating result:", error);
      toast.error(`Failed to update: ${error.message || "Unknown error"}`);
    } finally {
      setUploading(false);
    }
  };

  // Fetch Madarsas List
  const fetchMadarsaList = useCallback(async () => {
    setFetchingMadarsaList(true);
    try {
      const madarsasQuery = query(
        collection(db, COLLECTIONS.MADRASAS || "madarsas"),
        orderBy("name", "asc"),
      );
      const snapshot = await getDocs(madarsasQuery);
      const madarsas = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Use madarsaId field if available, fallback to doc.id
          uid: data.madarsaId || data.mid || doc.id,
        };
      });
      setMadarsaList(madarsas);
    } catch (error) {
      console.error("Error fetching madarsas:", error);
      toast.error("Failed to load madarsas");
    } finally {
      setFetchingMadarsaList(false);
    }
  }, []);

  const fetchMadarsaClasses = useCallback(async () => {
    if (!selectedMadarsa || !examId) return;
    setFetchingMadarsaClasses(true);
    try {
      const q = query(
        collection(db, "hallTickets", examId, "students"),
        where("madarsaId", "==", selectedMadarsa),
      );
      const snapshot = await getDocs(q);
      const uniqueClasses = [
        ...new Set(
          snapshot.docs.map((doc) => doc.data().classLevel || doc.data().class),
        ),
      ]
        .filter(Boolean)
        .sort();
      setMadarsaClasses(uniqueClasses);
    } catch (error) {
      console.error("Error fetching madarsa classes:", error);
    } finally {
      setFetchingMadarsaClasses(false);
    }
  }, [selectedMadarsa, examId]);

  // Fetch Students by Madarsa with Pagination
  const fetchMadarsaStudents = useCallback(
    async (direction = "initial") => {
      if (!selectedMadarsa || !examId) return;

      setFetchingMadarsaStudents(true);
      try {
        // Query the hallTickets subcollection for this exam
        const studentsRef = collection(db, "hallTickets", examId, "students");
        let constraints = [where("madarsaId", "==", selectedMadarsa)];

        if (selectedMadarsaClass && selectedMadarsaClass !== "all") {
          const equivalents = CLASS_EQUIVALENTS[selectedMadarsaClass] || [
            selectedMadarsaClass,
          ];
          constraints.push(where("classLevel", "in", equivalents));
        }

        console.log(
          "Fetching students for madarsa from hallTickets:",
          selectedMadarsa,
          "exam:",
          examId,
        );

        console.log("subjects are, ", await getExamSubjects(examId));

        // Log subjects for first student via hall ticket
        const firstDoc = (
          await getDocs(query(studentsRef, ...constraints, ...[]))
        ).docs[0];
        if (firstDoc) {
          const firstHT = firstDoc.data().hallTicketNumber;
          console.log(
            "subjects from hallTickets for first student (HT:",
            firstHT,
            "):",
            await getSubjectsByHallTicket(examId, firstHT),
          );
        }

        // If search term is present, use client-side filtering
        if (madarsaSearch.trim()) {
          const searchLower = madarsaSearch.trim().toLowerCase();
          console.log("Searching for:", searchLower);

          // Fetch all students for this madarsa in this exam
          const q = query(studentsRef, ...constraints);
          const snapshot = await getDocs(q);

          console.log(
            "Total hall tickets before search:",
            snapshot.docs.length,
          );

          let allStudents = snapshot.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              ...d,
              profilePictureUrl: d.profilePictureUrl || d.profilePicture || null,
            };
          });

          // Filter in JS
          allStudents = allStudents.filter((student) => {
            return (
              (student.studentName &&
                student.studentName.toLowerCase().includes(searchLower)) ||
              (student.fullName &&
                student.fullName.toLowerCase().includes(searchLower)) ||
              (student.admissionNumber &&
                student.admissionNumber
                  .toString()
                  .toLowerCase()
                  .includes(searchLower)) ||
              (student.hallTicketNumber &&
                student.hallTicketNumber
                  .toString()
                  .toLowerCase()
                  .includes(searchLower))
            );
          });

          console.log("Students after search:", allStudents.length);

          // Sort by hallTicketNumber
          allStudents.sort((a, b) => {
            const htA = a.hallTicketNumber || "";
            const htB = b.hallTicketNumber || "";
            return htA
              .toString()
              .localeCompare(htB.toString(), undefined, { numeric: true });
          });

          setMadarsaTotalCount(allStudents.length);

          // Pagination
          const startIndex = (madarsaPage - 1) * madarsaPageSize;
          const endIndex = startIndex + madarsaPageSize;
          const paginatedStudents = allStudents.slice(startIndex, endIndex);

          // Check for existing results
          const hallTickets = paginatedStudents
            .map((s) => s.hallTicketNumber)
            .filter(Boolean);
          const existingResultsMap = {};

          if (hallTickets.length > 0) {
            await Promise.all(
              hallTickets.map(async (ht) => {
                const resultDocId = `${examId}_${ht}`;
                const resultDoc = await getDoc(
                  doc(db, COLLECTIONS.EXAM_RESULTS || "results", resultDocId),
                );
                if (resultDoc.exists()) {
                  existingResultsMap[ht] = {
                    id: resultDoc.id,
                    ...resultDoc.data(),
                  };
                }
              }),
            );
          }

          await applyHallTicketSubjects(paginatedStudents, existingResultsMap);
          setMadarsaStudents(paginatedStudents);
          setExistingResults(existingResultsMap);
          setMadarsaLastDoc(null);
          setMadarsaDocHistory([]);
          setFetchingMadarsaStudents(false);
          return;
        }

        // Get total count
        const countQuery = query(studentsRef, ...constraints);
        const countSnapshot = await getCountFromServer(countQuery);
        setMadarsaTotalCount(countSnapshot.data().count);

        // Build paginated query
        constraints.push(orderBy("hallTicketNumber", "asc"));
        constraints.push(limit(madarsaPageSize));

        if (direction === "next" && madarsaLastDoc) {
          constraints.push(startAfter(madarsaLastDoc));
        } else if (direction === "prev" && madarsaDocHistory.length > 0) {
          const prevDoc = madarsaDocHistory[madarsaDocHistory.length - 1];
          if (prevDoc) {
            constraints.push(startAfter(prevDoc));
          }
        }

        const studentsQuery = query(studentsRef, ...constraints);

        const snapshot = await getDocs(studentsQuery);
        const students = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            profilePictureUrl: d.profilePictureUrl || d.profilePicture || null,
          };
        });

        // Check for existing results for these students
        const hallTickets = students
          .map((s) => s.hallTicketNumber)
          .filter(Boolean);
        const existingResultsMap = {};

        if (hallTickets.length > 0) {
          await Promise.all(
            hallTickets.map(async (ht) => {
              const resultDocId = `${examId}_${ht}`;
              const resultDoc = await getDoc(
                doc(db, COLLECTIONS.EXAM_RESULTS || "results", resultDocId),
              );
              if (resultDoc.exists()) {
                existingResultsMap[ht] = {
                  id: resultDoc.id,
                  ...resultDoc.data(),
                };
              }
            }),
          );
        }

        await applyHallTicketSubjects(students, existingResultsMap);
        setMadarsaStudents(students);
        setExistingResults(existingResultsMap);

        // Update pagination state
        if (snapshot.docs.length > 0) {
          setMadarsaLastDoc(snapshot.docs[snapshot.docs.length - 1]);

          if (direction === "next") {
            setMadarsaDocHistory((prev) => [...prev, snapshot.docs[0]]);
          } else if (direction === "prev") {
            setMadarsaDocHistory((prev) => prev.slice(0, -1));
          } else {
            setMadarsaDocHistory([]);
          }
        }
      } catch (error) {
        console.error("Error fetching madarsa students:", error);
        toast.error("Failed to load students");
      } finally {
        setFetchingMadarsaStudents(false);
      }
    },
    [
      selectedMadarsa,
      selectedMadarsaClass,
      examId,
      madarsaSearch,
      madarsaLastDoc,
      madarsaDocHistory,
      madarsaPageSize,
      madarsaPage,
      applyHallTicketSubjects,
    ],
  );

  // Load madarsas on mount
  useEffect(() => {
    fetchMadarsaList();
  }, [fetchMadarsaList]);

  // Fetch students when madarsa or search changes
  useEffect(() => {
    if (selectedMadarsa && manualSearchMode === "madarsa") {
      fetchMadarsaClasses();
      setMadarsaPage(1);
      fetchMadarsaStudents("initial");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMadarsa, selectedMadarsaClass, madarsaSearch, manualSearchMode]);

  // Auto-fetch if hall ticket is set from outside (e.g. from Madarsa tab buttons)
  useEffect(() => {
    if (
      manualHallTicket &&
      manualSearchMode === "direct" &&
      manualStudents.length === 0
    ) {
      fetchManualStudents();
    }
  }, [
    manualHallTicket,
    manualSearchMode,
    manualStudents.length,
    fetchManualStudents,
  ]);

  useEffect(() => {
    const fetchExam = async () => {
      try {
        if (!examId) return;
        const examDoc = await getDoc(doc(db, COLLECTIONS.EXAMS, examId));
        if (examDoc.exists()) {
          const examData = { id: examDoc.id, ...examDoc.data() };
          setExam(examData);

          const subjects = new Set();
          if (examData.timetableEntries) {
            examData.timetableEntries.forEach((entry) => {
              if (entry.subject) subjects.add(entry.subject);
              if (entry.title) subjects.add(entry.title);
            });
          }

          // Load deleted subjects blocklist
          const deletedSubs = examData.deletedResultSubjects || [];
          setDeletedResultSubjects(deletedSubs);

          // Also merge resultSubjectTemp subjects into availableSubjects
          if (examData.resultSubjectTemp) {
            const normSubjects = examData.resultSubjectTemp.map((s) =>
              typeof s === "string" ? { subject: s, class: "all" } : s,
            );
            setResultSubjectTemp(normSubjects);
            normSubjects.forEach((s) => subjects.add(s.subject));
          }

          // Filter out deleted subjects
          const subjArray = Array.from(subjects).filter(
            (s) => !deletedSubs.includes(s),
          );
          setAvailableSubjects((prev) => {
            const merged = new Set([...prev, ...subjArray]);
            const result = Array.from(merged);
            console.log("[fetchExam] merging availableSubjects:", {
              prev,
              subjArray,
              result,
            });
            return result;
          });

          if (examData.subjectMapping) {
            setSubjectMapping(examData.subjectMapping);
          }
        } else {
          toast.error("Exam not found");
        }
      } catch (error) {
        console.error("Error fetching exam:", error);
        toast.error("Failed to fetch exam details");
      } finally {
        setLoading(false);
      }
    };

    fetchExam();
  }, [examId]);

  useEffect(() => {
    console.log("[availableSubjects changed]", availableSubjects);
  }, [availableSubjects]);

  const initiateDeleteSubject = (opt) => {
    setSubjectToDelete(opt);
    setShowDeleteConfirm(true);
  };

  const executeDeleteSubject = async () => {
    if (!subjectToDelete?.value || !examId) return;

    try {
      const examRef = doc(db, COLLECTIONS.EXAMS, examId);
      const sub = subjectToDelete.value;

      const updatedTemp = resultSubjectTemp.filter((s) => s.subject !== sub);
      const updatedTimetable = (exam?.timetableEntries || []).filter(
        (te) => (te.subject || te.title) !== sub,
      );

      await updateDoc(examRef, {
        resultSubjectTemp: updatedTemp,
        timetableEntries: updatedTimetable,
      });

      setResultSubjectTemp(updatedTemp);
      if (exam) {
        setExam({ ...exam, timetableEntries: updatedTimetable });
      }
      setAvailableSubjects((prev) => prev.filter((s) => s !== sub));

      toast.success(`Subject "${sub}" deleted`);
      setShowDeleteConfirm(false);
      setSubjectToDelete(null);
    } catch (error) {
      console.error("Error deleting subject:", error);
      toast.error("Failed to delete subject");
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (
      !file.type.includes("sheet") &&
      !file.type.includes("excel") &&
      !file.name.endsWith(".xlsx") &&
      !file.name.endsWith(".xls")
    ) {
      toast.error("Please upload a valid Excel file (.xlsx or .xls)");
      return;
    }

    setExcelFile(file);
    parseExcel(file);
  };

  const parseExcel = async (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        setWorkbook(workbook);
        setSheetNames(workbook.SheetNames);

        const firstSheetName = workbook.SheetNames[0];
        setCurrentSheetName(firstSheetName);

        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          toast.error("Sheet is empty");
          return;
        }

        setRawJsonData(jsonData);
        setStudentStartRow(0);
        setStudentEndRow(0);
        setIsConfirmed(false);
        processExcelData(jsonData);
      } catch (error) {
        console.error("Error parsing Excel:", error);
        toast.error("Failed to parse Excel file");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSheetChange = (sheetName) => {
    if (!workbook) return;

    setCurrentSheetName(sheetName);
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length === 0) {
      toast.error("Selected sheet is empty");
      setParsedData([]);
      setRawJsonData([]);
      return;
    }

    setRawJsonData(jsonData);
    setStudentStartRow(0);
    setStudentEndRow(0);
    setIsConfirmed(false);
    processExcelData(jsonData);
  };

  const processExcelData = (data) => {
    if (!data || data.length === 0) return;

    let allStudents = [];
    let globalSubjectNames = [];
    let blockSubjects = [];
    let detectedSubjectsInfo = {}; // { subjectName: { markIndex, gradeIndex } }
    let extractedInfo = {};

    for (let i = 0; i < Math.min(data.length, 50); i++) {
      const row = data[i];
      if (!row) continue;
      row.forEach((cell, idx) => {
        if (typeof cell === "string") {
          const cleanCell = cell.trim().toUpperCase();
          if (
            cleanCell.includes("MADRASA NAME") &&
            !extractedInfo.madrasaName
          ) {
            for (let k = idx + 1; k < row.length; k++) {
              if (row[k]) {
                extractedInfo.madrasaName = row[k].toString();
                break;
              }
            }
          }
          if (cleanCell.includes("PLACE") && !extractedInfo.place) {
            for (let k = idx + 1; k < row.length; k++) {
              if (row[k]) {
                extractedInfo.place = row[k].toString();
                break;
              }
            }
          }
          if (cleanCell.includes("ZONE") && !extractedInfo.zone) {
            for (let k = idx + 1; k < row.length; k++) {
              if (row[k]) {
                extractedInfo.zone = row[k].toString();
                break;
              }
            }
          }
          if (cleanCell.startsWith("MID-") && !extractedInfo.madrasaId) {
            extractedInfo.madrasaId = cleanCell;
          }
        }
      });
    }

    // --- Dynamic Grade Logic Extraction ---
    let sheetGradeRules = [];
    for (let i = 0; i < Math.min(data.length, 50); i++) {
      const row = data[i];
      if (!row) continue;
      const potentialGradeLabels = ["GRADE", "MARK RANGE", "SCALE", "PATTERN"];
      const found = row.some(
        (c) =>
          c &&
          typeof c === "string" &&
          potentialGradeLabels.some((l) => c.toUpperCase().includes(l)),
      );

      if (found) {
        // Check next row or this row for pairs
        const nextRow = data[i + 1] || [];
        row.forEach((cell, idx) => {
          const gradeMatch =
            cell &&
            typeof cell === "string" &&
            /^[A-E][+-]?$|^ABSENT$/i.test(cell.trim());
          if (gradeMatch) {
            const rangeCell = nextRow[idx] || row[idx + 1];
            if (
              rangeCell &&
              typeof rangeCell === "string" &&
              rangeCell.includes("-")
            ) {
              const [min, max] = rangeCell
                .split("-")
                .map((v) => parseInt(v.trim()));
              if (!isNaN(min) && !isNaN(max)) {
                sheetGradeRules.push({
                  grade: cell.trim().toUpperCase(),
                  min,
                  max,
                });
              }
            }
          }
        });
        if (sheetGradeRules.length > 0) break;
      }
    }
    if (sheetGradeRules.length > 5) {
      setGradeRules(sheetGradeRules.sort((a, b) => b.min - a.min));
      toast.info("Extracted grade pattern from sheet");
    }

    setHeaderInfo(extractedInfo);

    const startIdx = studentStartRow > 0 ? studentStartRow - 1 : 0;
    const endIdx = studentEndRow > 0 ? studentEndRow : data.length;

    let rowIndex = startIdx;
    while (rowIndex < Math.min(endIdx, data.length)) {
      const row = data[rowIndex];
      if (!row) {
        rowIndex++;
        continue;
      }

      const isHeader = row.some(
        (cell) =>
          cell &&
          typeof cell === "string" &&
          (cell.toLowerCase().includes("sl no") || cell.toLowerCase() === "sl"),
      );

      if (isHeader) {
        const headerRow = row;
        const subjectRow = data[rowIndex - 1];

        let detectedClassName = null;
        for (let k = rowIndex - 1; k >= Math.max(0, rowIndex - 5); k--) {
          const prevRow = data[k];
          if (!prevRow) continue;

          const classCell = prevRow.find(
            (c) =>
              c &&
              typeof c === "string" &&
              (c.toUpperCase().includes("CLASS") ||
                c.toUpperCase().includes("STD")),
          );

          if (classCell) {
            detectedClassName = classCell
              .toString()
              .split(/[:\s]+/)
              .pop()
              .trim();
            if (
              detectedClassName.toUpperCase() === "CLASS" ||
              detectedClassName.toUpperCase() === "STD"
            ) {
              detectedClassName = classCell.toString().trim();
            }
            break;
          }
        }

        const regNoIdx = headerRow.findIndex(
          (c) =>
            c &&
            typeof c === "string" &&
            (c.toLowerCase().includes("reg no") ||
              c.toLowerCase().includes("reg.no")),
        );
        const nameIdx = headerRow.findIndex(
          (c) => c && typeof c === "string" && c.toLowerCase().includes("name"),
        );
        const classIdx = headerRow.findIndex(
          (c) =>
            c && typeof c === "string" && c.toLowerCase().includes("class"),
        );
        const remarkIdx = [row, data[rowIndex - 1], data[rowIndex - 2]].reduce(
          (foundIdx, currentRow) => {
            if (foundIdx !== -1 || !currentRow) return foundIdx;
            return currentRow.findIndex(
              (c) =>
                c &&
                typeof c === "string" &&
                (c.toLowerCase().includes("remark") ||
                  c.toLowerCase().includes("status") ||
                  c.toLowerCase().includes("result") ||
                  c.toLowerCase() === "res")
            );
          },
          -1,
        );

        blockSubjects = [];
        headerRow.forEach((cell, idx) => {
          if (
            typeof cell === "string" &&
            cell.trim().toLowerCase() === "mark"
          ) {
            let subjectName =
              subjectRow && subjectRow[idx]
                ? subjectRow[idx].toString().trim()
                : null;

            if (!subjectName && subjectRow) {
              for (let k = idx; k >= 0; k--) {
                if (subjectRow[k]) {
                  subjectName = subjectRow[k].toString().trim();
                  break;
                }
              }
            }

            if (subjectName) {
              const nextCell = headerRow[idx + 1];
              const isGradeNext =
                nextCell &&
                typeof nextCell === "string" &&
                nextCell.trim().toLowerCase() === "grade";

              blockSubjects.push({
                name: subjectName,
                markIndex: idx,
                gradeIndex: isGradeNext ? idx + 1 : null,
              });

              if (!detectedSubjectsInfo[subjectName]) {
                detectedSubjectsInfo[subjectName] = {
                  markIndex: idx,
                  gradeIndex: isGradeNext ? idx + 1 : null,
                };
              }

              if (!globalSubjectNames.includes(subjectName)) {
                globalSubjectNames.push(subjectName);
              }
            }
          }
        });

        rowIndex++;
        while (rowIndex < Math.min(endIdx, data.length)) {
          const sRow = data[rowIndex];
          if (!sRow) {
            rowIndex++;
            continue;
          }

          const isStopCondition = sRow.some(
            (c) =>
              c &&
              typeof c === "string" &&
              (c.toLowerCase().includes("sl no") ||
                c.toLowerCase().includes("subjects") ||
                c.toLowerCase() === "sl" ||
                c.toLowerCase().includes("grade pattern")),
          );
          const isEmpty = sRow.every((c) => !c || c.toString().trim() === "");

          if (isStopCondition) break;
          if (isEmpty) {
            rowIndex++;
            continue;
          }

          const regNoRaw = regNoIdx !== -1 ? sRow[regNoIdx] : null;
          const regNo =
            regNoRaw !== null && regNoRaw !== undefined
              ? regNoRaw.toString().trim()
              : null;
          const name = nameIdx !== -1 ? sRow[nameIdx] : null;

          const remarkValue = remarkIdx !== -1 ? sRow[remarkIdx] : null;
          const remark =
            remarkValue !== null && remarkValue !== undefined
              ? remarkValue.toString().trim()
              : "";

          if (regNo || name) {
            const student = {
              slNo: sRow[0],
              class:
                classIdx !== -1 && sRow[classIdx]
                  ? sRow[classIdx]
                  : detectedClassName || "Unknown",
              regNo,
              name,
              remark,
              subjects: {},
            };

            blockSubjects.forEach((sub) => {
              const mark = sRow[sub.markIndex];
              const grade = sub.gradeIndex ? sRow[sub.gradeIndex] : null;

              // Always initialize the subject if it belongs to this block
              // Use empty string as default for undefined/null values
              student.subjects[sub.name] = {
                mark:
                  mark !== undefined && mark !== null ? mark.toString() : "",
                grade:
                  grade !== undefined && grade !== null ? grade.toString() : "",
              };
            });

            allStudents.push(student);
          }
          rowIndex++;
        }
      } else {
        rowIndex++;
      }
    }

    setSubjectMapping((prev) => {
      const newMapping = { ...prev };
      globalSubjectNames.forEach((name) => {
        if (!newMapping[name]) {
          const match = availableSubjects.find(
            (as) => as.toLowerCase() === name.toLowerCase(),
          );
          newMapping[name] = match || "";
        }
      });
      return newMapping;
    });

    setColumnMapping({
      subjects: Object.keys(detectedSubjectsInfo).map((name) => ({
        name: name,
        markIndex: detectedSubjectsInfo[name].markIndex,
        gradeIndex: detectedSubjectsInfo[name].gradeIndex,
      })),
    });
    setHeaderInfo(extractedInfo);
    setParsedData(allStudents);
  };

  const handleCellEdit = (studentIdx, field, subName, value) => {
    if (field === "mark" && value !== "" && !isNaN(value)) {
      if (parseFloat(value) > 100) {
        toast.error("Marks cannot exceed 100");
        return;
      }
    }
    setParsedData((prev) => {
      const updated = [...prev];
      if (subName) {
        if (!updated[studentIdx].subjects[subName]) {
          updated[studentIdx].subjects[subName] = { mark: "", grade: "" };
        }
        updated[studentIdx].subjects[subName][field] = value;
      } else {
        updated[studentIdx][field] = value;
      }
      return updated;
    });
  };

  const triedRegNos = useRef(new Set());

  useEffect(() => {
    const fetchMadarsaNames = async () => {
      if (!parsedData || parsedData.length === 0 || isConfirmed) {
        triedRegNos.current.clear();
        return;
      }

      const updated = [...parsedData];
      let hasUpdate = false;

      const studentsToFetch = updated
        .map((s, idx) => ({ ...s, originalIdx: idx }))
        .filter((s) => !s.madarsaName && s.regNo && !triedRegNos.current.has(s.regNo));

      if (studentsToFetch.length === 0) return;

      const uniqueRegNos = [...new Set(studentsToFetch.map((s) => s.regNo))];

      for (const regNo of uniqueRegNos) {
        triedRegNos.current.add(regNo);
        try {
          // Try string match first
          let q = query(
            collection(db, "hallTickets", examId, "students"),
            where("hallTicketNumber", "==", regNo.toString().trim()),
          );
          let snap = await getDocs(q);

          // If no string match, try numeric match if applicable
          if (snap.empty && !isNaN(regNo)) {
            q = query(
              collection(db, "hallTickets", examId, "students"),
              where("hallTicketNumber", "==", Number(regNo)),
            );
            snap = await getDocs(q);
          }

          if (!snap.empty) {
            const data = snap.docs[0].data();
            const mName = data.madarsaName || data.madarsa || "";
            const mId = data.madarsaId || data.madarsa || "";

            if (mName) {
              updated.forEach((s, idx) => {
                if (s.regNo === regNo) {
                  updated[idx].madarsaName = mName;
                  updated[idx].mid = String(mId);
                  hasUpdate = true;
                }
              });
            }
          } else {
            // Fallback to headerInfo or "Not Found" if still empty after both tries
            updated.forEach((s, idx) => {
              if (s.regNo === regNo) {
                updated[idx].madarsaName = headerInfo.madrasaName || "Unknown (Not Found)";
                updated[idx].mid = headerInfo.madrasaId || "";
                hasUpdate = true;
              }
            });
          }
        } catch (err) {
          console.error("Error fetching madarsa for preview:", err);
        }

        if (hasUpdate) {
          setParsedData([...updated]);
          hasUpdate = false;
        }
      }
    };

    fetchMadarsaNames();
  }, [parsedData?.length, isConfirmed, examId, headerInfo.madrasaName]);

  const removeStudent = (sIdx) => {
    setParsedData((prev) => prev.filter((_, i) => i !== sIdx));
    toast.success("Student removed from list");
  };

  const handleSaveResults = async () => {
    if (!parsedData || parsedData.length === 0) {
      toast.error("No data to save");
      return;
    }

    setUploading(true);
    try {
      let operationCount = 0;
      let currentBatch = writeBatch(db);

      for (const student of parsedData) {
        const resultsArray = [];
        let hasInvalidMarks = false;

        Object.keys(student.subjects).forEach((excelSub) => {
          const mappedSubName = subjectMapping[excelSub];
          if (mappedSubName === "ignore_subject") return;

          const examSub = mappedSubName || excelSub;
          const subData = student.subjects[excelSub];
          const markValue = parseFloat(subData.mark);

          if (!isNaN(markValue) && markValue > 100) {
            hasInvalidMarks = true;
          }

          const examPassMark = exam?.timetableEntries?.find(
            (te) => te.subject === examSub || te.title === examSub,
          )?.passMark;

          resultsArray.push({
            subject: examSub,
            marks: subData.mark || 0,
            grade: subData.grade || "NA",
            passMark: examPassMark || 0,
          });
        });

        if (hasInvalidMarks) {
          toast.error(
            `Invalid marks Found (>100) found for student ${student.name} (${student.regNo})`,
          );
          setUploading(false);
          return;
        }

        const calcResult = calculateResultStatus(
          resultsArray,
          exam,
          student.remark,
        );
        const status = calcResult.status;
        const totalObtained = calcResult.totalObtained || 0;
        const totalMarksFinal = calcResult.totalMarks ?? totalObtained;
        const marksSumFinal = calcResult.marksSum ?? totalObtained;
        const isFirstClass = calcResult.isFirstClass || false;

        // Fetch the real madarsa details dynamically to avoid applying the top header to all students
        let studentMadarsaName = headerInfo.madrasaName || "";
        let studentMid = headerInfo.madrasaId || "";

        try {
          let studentQ = query(
            collection(db, "hallTickets", examId, "students"),
            where("hallTicketNumber", "==", student.regNo.toString().trim())
          );
          let studentSnap = await getDocs(studentQ);

          if (studentSnap.empty && !isNaN(student.regNo)) {
            studentQ = query(
              collection(db, "hallTickets", examId, "students"),
              where("hallTicketNumber", "==", Number(student.regNo))
            );
            studentSnap = await getDocs(studentQ);
          }

          if (!studentSnap.empty) {
            const studentData = studentSnap.docs[0].data();
            const madarsaId = studentData.madarsaId || studentData.madarsa;

            if (madarsaId) {
              let foundMadarsa = null;

              try {
                const madarsaDoc = await getDoc(doc(db, "madarsas", String(madarsaId)));
                if (madarsaDoc.exists()) {
                  foundMadarsa = madarsaDoc.data();
                }
              } catch (e) {
                // Ignore if invalid path
              }

              if (!foundMadarsa) {
                const madarsaQ = query(
                  collection(db, "madarsas"),
                  where("madarsaId", "==", String(madarsaId))
                );
                const madarsaSnap = await getDocs(madarsaQ);
                if (!madarsaSnap.empty) {
                  foundMadarsa = madarsaSnap.docs[0].data();
                }
              }

              if (foundMadarsa) {
                studentMadarsaName = foundMadarsa.name || foundMadarsa.madarsaName || studentMadarsaName;
                studentMid = foundMadarsa.madarsaId || foundMadarsa.id || String(madarsaId);
              } else if (studentData.madarsaName || studentData.madarsa) {
                const possibleName = studentData.madarsaName || studentData.madarsa;
                if (typeof possibleName === 'string') {
                  studentMadarsaName = possibleName;
                }
                studentMid = studentData.madarsaId || String(madarsaId);
              }
            }
          }
        } catch (e) {
          console.error("Error fetching madarsa details during upload:", e);
        }

        const resultDocData = {
          studentName: student.name,
          madarsaName: studentMadarsaName,
          mid: studentMid,
          examID: examId,
          hallTicketNumber: student.regNo
            ? student.regNo.toString().trim()
            : "",
          class: student.class,
          place: headerInfo.place || "",
          zone: headerInfo.zone || "",
          result: resultsArray,
          totalObtained,
          totalMarks: totalMarksFinal,
          marksSum: marksSumFinal,
          status,
          isFirstClass,
          uploadedAt: serverTimestamp(),
          uploadedBy: user?.uid || "admin",
          isPublished: publishByDefault,
          studentId: student.studentId || "",
        };

        const docId = `${examId}_${student.regNo.toString().trim()}`;
        const newDocRef = doc(db, COLLECTIONS.EXAM_RESULTS || "results", docId);
        currentBatch.set(newDocRef, resultDocData);

        operationCount++;

        if (operationCount >= 450) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          operationCount = 0;
        }

        // Handle promotion for bulk upload (Removed for now)
        /*
        if (publishByDefault && status === "PASS") {
          if (student.studentId) {
            await promoteStudent(student.studentId, student.class);
          }
        }
        */
      }

      if (operationCount > 0) {
        await currentBatch.commit();
      }

      if (Object.keys(subjectMapping).length > 0) {
        try {
          await updateDoc(doc(db, COLLECTIONS.EXAMS, examId), {
            subjectMapping,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          console.error("Error saving subject mapping:", err);
        }
      }

      toast.success(
        `Successfully uploaded ${parsedData.length} student results and updated mapping.`,
      );

      // Log activity
      try {
        await addDoc(collection(db, "LoginLogs"), {
          email: user?.email || "unknown",
          name: user?.displayName || "Unknown User",
          userId: user?.uid || "unknown",
          role: user?.role || "admin",
          activityType: "result_upload",
          details: `Uploaded ${parsedData.length} results for exam: ${exam?.title || examId}`,
          examId: examId,
          examTitle: exam?.title || "",
          recordCount: parsedData.length,
          loginTimestamp: serverTimestamp(),
          platform:
            typeof window !== "undefined"
              ? window.navigator.userAgent.includes("Mobile")
                ? "mobile"
                : "web"
              : "unknown",
          userAgent:
            typeof window !== "undefined" ? window.navigator.userAgent : "",
        });
      } catch (logError) {
        console.error("Error logging activity:", logError);
      }

      setEvaluatedItems((prev) => [
        {
          name: currentSheetName || "Batch",
          date: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      setExcelFile(null);
      setParsedData(null);
      console.error("Error saving results:", error);
      toast.error("Failed to save results to database.");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSample = () => {
    try {
      const link = document.createElement("a");
      link.href = "/SAMPLE_RESULTS_UPLOAD_SHEET.xlsx";
      link.download = "SAMPLE_RESULTS_UPLOAD_SHEET.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Sample template downloaded successfully");
    } catch (error) {
      console.error("Error downloading sample:", error);
      toast.error("Failed to download sample template");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-20 px-0 sm:px-0">
      <div className="flex flex-col items-start gap-3 sm:gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Upload Performance for {exam?.title}
          </h1>
          <p className="text-sm sm:text-base text-gray-500 font-medium">
            Interface for batch processing and manual entry of student results
          </p>
        </div>

        {evaluatedItems.length > 0 && (
          <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-right-4 duration-700">
            {evaluatedItems.slice(0, 3).map((item, idx) => (
              <Badge
                key={idx}
                className="bg-teal-50 text-teal-700 border-teal-100 px-4 py-2 rounded-none flex items-center gap-2 shadow-sm"
              >
                <CheckCircle className="h-3 w-3" />
                <div className="flex flex-col items-start leading-none">
                  <span className="font-bold text-[11px] uppercase tracking-wider">
                    {item.name} Evaluated
                  </span>
                  <span className="text-[9px] opacity-60 font-mono mt-0.5">
                    {item.date}
                  </span>
                </div>
              </Badge>
            ))}
            {evaluatedItems.length > 3 && (
              <Badge
                variant="ghost"
                className="text-gray-400 font-bold text-[10px]"
              >
                +{evaluatedItems.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </div>

      <Tabs
        defaultValue="bulk"
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="bg-gray-200/50 p-1 mb-6 rounded-none flex items-center justify-start flex-nowrap gap-1 h-auto w-full md:w-fit overflow-x-auto">
          <TabsTrigger
            value="bulk"
            className="px-6 py-2 rounded-none text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm whitespace-nowrap"
          >
            Bulk Upload (Excel)
          </TabsTrigger>
          <TabsTrigger
            value="manual"
            className="px-6 py-2 rounded-none text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm whitespace-nowrap"
          >
            Manual Marks Entry
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bulk">
          <div className="flex flex-col gap-6">
            {!parsedData ? (
              <Card className="w-full border border-gray-200 shadow-none rounded-none overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                  <CardTitle className="text-xl font-bold text-gray-900">
                    Batch Upload Engine
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-8">
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-none p-6 sm:p-10 flex flex-col items-center justify-center text-center hover:bg-gray-50 hover:border-teal-200 transition-all cursor-pointer relative group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="h-16 w-16 bg-teal-50 text-teal-600 rounded-none flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="h-8 w-8" />
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      Drop Excel spreadsheet here
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Maximum file size 10MB. Supports .xlsx and .xls
                    </p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".xlsx, .xls"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadSample();
                      }}
                      className="flex items-center gap-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                    >
                      <Download className="h-4 w-4" />
                      Download Sample Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                {/* Configuration Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2 border border-gray-200 shadow-none rounded-none">
                    <CardHeader className="bg-gray-50/50 border-b border-gray-100 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-teal-600" />
                        Subject Logic Mapping
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50"
                        onClick={() => setSubjectMapping({})}
                      >
                        <Trash2 className="h-3 w-3 mr-1.5" />
                        Clear All
                      </Button>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-8">
                        {columnMapping?.subjects.map((sub, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col gap-2 p-4 bg-gray-50/50 hover:bg-white rounded-none border border-gray-100 group transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span
                                  className="text-xs font-black text-teal-800 uppercase tracking-tight truncate max-w-[150px]"
                                  title={sub.name}
                                >
                                  {sub.name}
                                </span>
                                <span className="text-[10px] font-bold text-teal-600/40 font-mono">
                                  Excel Column{" "}
                                  {String.fromCharCode(
                                    65 + (sub.markIndex || 0),
                                  )}
                                </span>
                              </div>
                              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-teal-400 transition-colors" />
                              <div className="w-[180px] flex flex-col gap-1">
                                <SearchableSelect
                                  value={subjectMapping[sub.name] || ""}
                                  onValueChange={(val) =>
                                    setSubjectMapping((prev) => ({
                                      ...prev,
                                      [sub.name]: val,
                                    }))
                                  }
                                  options={[
                                    {
                                      value: "ignore_subject",
                                      label: "--- IGNORE ---",
                                    },
                                    ...availableSubjects
                                      .filter((s) => s.toLowerCase() !== "all")
                                      .map((s) => ({
                                        value: s,
                                        label: s,
                                      })),
                                  ]}
                                  placeholder="Select System Subject"
                                />
                                {subjectMapping[sub.name] &&
                                  subjectMapping[sub.name] !==
                                  "ignore_subject" && (
                                    <div className="flex items-center justify-end px-1">
                                      <span className="text-[10px] font-bold text-gray-400">
                                        Pass:{" "}
                                        <span className="text-teal-600">
                                          {exam?.timetableEntries?.find(
                                            (te) =>
                                              te.subject ===
                                              subjectMapping[sub.name] ||
                                              te.title ===
                                              subjectMapping[sub.name],
                                          )?.passMark || "NA"}
                                        </span>
                                      </span>
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-gray-100 pt-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Calculator className="h-4 w-4 text-teal-600" />
                          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                            Grade Pattern Mapping
                          </h4>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          {gradeRules.map((rule, idx) => (
                            <div
                              key={idx}
                              className="bg-white p-3 rounded-none border border-gray-100 space-y-2 group hover:border-teal-200 transition-all"
                            >
                              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block text-center">
                                Grade {rule.grade}
                              </Label>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  className="h-8 text-[11px] font-black p-0 text-center border-gray-100 focus:border-teal-500"
                                  value={rule.min}
                                  onChange={(e) => {
                                    const next = [...gradeRules];
                                    next[idx].min =
                                      parseInt(e.target.value) || 0;
                                    setGradeRules(next);
                                  }}
                                />
                                <span className="text-gray-300 font-bold">
                                  -
                                </span>
                                <Input
                                  type="number"
                                  className="h-8 text-[11px] font-black p-0 text-center border-gray-100 focus:border-teal-500"
                                  value={rule.max}
                                  onChange={(e) => {
                                    const next = [...gradeRules];
                                    next[idx].max =
                                      parseInt(e.target.value) || 0;
                                    setGradeRules(next);
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-gray-200 shadow-none rounded-none">
                    <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-teal-600" />
                        Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="flex items-center justify-between p-4 bg-teal-50/50 rounded-none border border-teal-100">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold text-teal-900">
                            Publish Results
                          </Label>
                          <p className="text-[10px] text-teal-600 font-medium">
                            Results will be visible to students immediately
                          </p>
                        </div>
                        <Switch
                          checked={publishByDefault}
                          onCheckedChange={setPublishByDefault}
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border border-gray-200 rounded-none">
                          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                            Input Sheet
                          </span>
                          <Badge
                            variant="outline"
                            className="bg-teal-50 text-teal-700 border-teal-200 font-bold"
                          >
                            {currentSheetName}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-medium uppercase tracking-wider text-gray-400 ml-1">
                            Sheet Selection
                          </Label>
                          <SearchableSelect
                            value={currentSheetName}
                            onValueChange={handleSheetChange}
                            options={sheetNames.map((name) => ({
                              value: name,
                              label: name,
                            }))}
                            placeholder="Select Sheet"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">
                              Start Row
                            </Label>
                            <Input
                              type="number"
                              className="h-11 rounded-none border-gray-200"
                              value={studentStartRow}
                              onChange={(e) =>
                                setStudentStartRow(
                                  parseInt(e.target.value) || 0,
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">
                              End Row
                            </Label>
                            <Input
                              type="number"
                              className="h-11 rounded-none border-gray-200"
                              value={studentEndRow}
                              onChange={(e) =>
                                setStudentEndRow(parseInt(e.target.value) || 0)
                              }
                            />
                          </div>
                        </div>
                        <Button
                          className="w-full h-11 rounded-none font-bold bg-teal-600 text-white hover:bg-teal-700 shadow-sm transition-all"
                          onClick={() => processExcelData(rawJsonData)}
                        >
                          Re-process Data
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Data Preview Table */}
                <Card className="border-none shadow-sm  rounded-none overflow-hidden">
                  <CardHeader className="bg-white p-8 flex flex-row items-center justify-between border-b border-gray-50">
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-900">
                        Live Data Preview
                      </CardTitle>
                      <p className="text-gray-400 font-medium text-sm mt-1">
                        Reviewing {parsedData.length} extracted student records
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex flex-col items-end justify-center leading-none mr-4">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          Global Mapping
                        </span>
                        <span className="text-xs font-bold text-teal-600">
                          {columnMapping?.subjects?.length || 0} Subjects
                          Detected
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        className="h-11 px-6 rounded-none border-teal-200 text-teal-700 hover:bg-teal-50 font-bold shadow-sm"
                        onClick={autoCalculateBulkGrades}
                      >
                        <Calculator className="h-4 w-4 mr-2" />
                        Calculate All Grades
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-11 px-6 rounded-none text-red-500 hover:bg-red-50 font-bold"
                        onClick={removeAllBulkGrades}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove All Grades
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-11 px-4 rounded-none text-red-500 hover:bg-red-50 font-bold"
                        onClick={() => {
                          setExcelFile(null);
                          setParsedData(null);
                          setColumnMapping(null);
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table className="w-full table-fixed">
                        <TableHeader className="bg-teal-700 border-b-2 border-teal-800 sticky top-0 z-20">
                          <TableRow className="border-teal-600 hover:bg-transparent">
                            <TableHead
                              style={{
                                width: columnWidths.slNo,
                                minWidth: "70px",
                              }}
                              className="px-6 relative h-14"
                            >
                              <span className="text-[13px] font-black uppercase text-white tracking-widest">
                                Sl.
                              </span>
                              <div
                                onMouseDown={(e) => startResizing(e, "slNo")}
                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-white/30"
                              />
                            </TableHead>
                            <TableHead
                              style={{
                                width: columnWidths.regNo,
                                minWidth: "160px",
                              }}
                              className="relative h-14 px-4"
                            >
                              <span className="text-[13px] font-black uppercase text-white tracking-widest">
                                Reg No.
                              </span>
                              <div
                                onMouseDown={(e) => startResizing(e, "regNo")}
                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-white/30"
                              />
                            </TableHead>
                            <TableHead
                              style={{
                                width: columnWidths.name,
                                minWidth: "200px",
                              }}
                              className="relative h-14 px-4"
                            >
                              <span className="text-[13px] font-black uppercase text-white tracking-widest">
                                Student Name
                              </span>
                              <div
                                onMouseDown={(e) => startResizing(e, "name")}
                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-white/30"
                              />
                            </TableHead>
                            <TableHead
                              style={{
                                width: columnWidths.madarsa,
                                minWidth: "180px",
                              }}
                              className="relative h-14 px-4 border-l border-teal-600/50"
                            >
                              <span className="text-[13px] font-black uppercase text-white tracking-widest">
                                Madarsa
                              </span>
                              <div
                                onMouseDown={(e) => startResizing(e, "madarsa")}
                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-white/30"
                              />
                            </TableHead>
                            {columnMapping?.subjects.map((sub, idx) => (
                              <TableHead
                                key={idx}
                                className="bg-teal-800/40 border-l border-teal-600/50 h-auto py-3 "
                                style={{
                                  width: columnWidths.name,
                                  minWidth: "200px",
                                }}
                              >
                                <div className="flex flex-col gap-0.5 px-2">
                                  <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                                    <span className="text-[13px] font-black text-white/70 uppercase tracking-tighter">
                                      {sub.name}
                                    </span>
                                    {subjectMapping[sub.name] &&
                                      subjectMapping[sub.name] !==
                                      "ignore_subject" && (
                                        <>
                                          <ArrowRight className="h-3 w-3 text-white/50 shrink-0" />
                                          <span className="text-[14px] font-black uppercase text-white tracking-tight">
                                            {subjectMapping[sub.name]}
                                          </span>
                                        </>
                                      )}
                                  </div>
                                  <span className="text-[12px] font-bold text-white/40 font-mono">
                                    COL{" "}
                                    {String.fromCharCode(
                                      65 + (sub.markIndex || 0),
                                    )}
                                  </span>
                                  <div className="flex gap-4 mt-1.5 border-t border-white/10 pt-1">
                                    <span className="text-[11px] font-black text-white/70">
                                      MARK
                                    </span>
                                    <span className="text-[11px] font-black text-white/70">
                                      GRADE
                                    </span>
                                  </div>
                                </div>
                              </TableHead>
                            ))}
                            <TableHead
                              style={{
                                width: columnWidths.remark,
                                minWidth: "100px",
                              }}
                              className="relative h-14 px-4 border-l border-teal-600/50"
                            >
                              <span className="text-[13px] font-black uppercase text-white tracking-widest">
                                Remark
                              </span>
                              <div
                                onMouseDown={(e) => startResizing(e, "remark")}
                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-white/30"
                              />
                            </TableHead>
                            <TableHead
                              style={{
                                width: columnWidths.total,
                                minWidth: "80px",
                              }}
                              className="relative h-14 px-4 border-l border-teal-600/50"
                            >
                              <span className="text-[13px] font-black uppercase text-white tracking-widest text-center block w-full">
                                Total
                              </span>
                              <div
                                onMouseDown={(e) => startResizing(e, "total")}
                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-white/30"
                              />
                            </TableHead>
                            <TableHead
                              style={{
                                width: columnWidths.status,
                                minWidth: "90px",
                              }}
                              className="relative h-14 px-4 border-l border-teal-600/50"
                            >
                              <span className="text-[13px] font-black uppercase text-white tracking-widest text-center block w-full">
                                Status
                              </span>
                              <div
                                onMouseDown={(e) => startResizing(e, "status")}
                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-white/30"
                              />
                            </TableHead>
                            <TableHead className="w-[80px] bg-teal-800/60 border-l border-teal-600/50 uppercase text-[13px] font-black text-white tracking-widest text-center">
                              Action
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedData.map((student, sIdx) => {
                            const prevStudent =
                              sIdx > 0 ? parsedData[sIdx - 1] : null;
                            const showClassDivider =
                              !prevStudent ||
                              prevStudent.class !== student.class;

                            return (
                              <Fragment key={sIdx}>
                                {showClassDivider && (
                                  <TableRow className="bg-gray-100/80 hover:bg-gray-100/80 border-y border-gray-300">
                                    <TableCell
                                      colSpan={
                                        7 +
                                        (columnMapping?.subjects?.length || 0)
                                      }
                                      className="py-2.5 px-10"
                                    >
                                      <div className="flex items-center gap-4">
                                        <Badge className=" border-gray-900 border-2 font-black text-[10px] px-5 py-1 uppercase tracking-widest shadow-sm">
                                          {student.class}
                                        </Badge>
                                        <div className="h-px flex-1 bg-gray-300/50" />
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest italic opacity-60">
                                          Section Start
                                        </span>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                                <TableRow className="hover:bg-teal-50/5 transition-all group border-b border-gray-100">
                                  <TableCell className="text-center font-mono text-[11px] font-bold text-gray-300 group-hover:text-teal-600">
                                    {student.slNo || sIdx + 1}
                                  </TableCell>
                                  <TableCell className="px-4">
                                    {(() => {
                                      const isValid =
                                        student.regNo !== "" &&
                                        !isNaN(student.regNo);
                                      return (
                                        <Input
                                          className={`h-9 rounded-none border-transparent hover:border-gray-200 focus:bg-white focus:border-teal-500 transition-all font-mono font-bold text-xs bg-transparent ${!isValid ? "border-red-500 text-red-600 bg-red-50/30" : "text-gray-900"}`}
                                          value={student.regNo}
                                          onChange={(e) =>
                                            handleCellEdit(
                                              sIdx,
                                              "regNo",
                                              null,
                                              e.target.value,
                                            )
                                          }
                                        />
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell className="px-4">
                                    {(() => {
                                      const isValid =
                                        student.name &&
                                        student.name.trim() !== "";
                                      return (
                                        <Input
                                          className={`h-9 rounded-none border-transparent hover:border-gray-200 focus:bg-white focus:border-teal-500 transition-all font-bold text-sm bg-transparent ${!isValid ? "border-red-500 text-red-600 bg-red-50/30" : "text-gray-900"}`}
                                          value={student.name}
                                          onChange={(e) =>
                                            handleCellEdit(
                                              sIdx,
                                              "name",
                                              null,
                                              e.target.value,
                                            )
                                          }
                                        />
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell className="px-4 border-l border-gray-100">
                                    <div className="flex flex-col gap-0.5 min-w-[150px]">
                                      <span className="text-[10px] font-bold text-gray-900 leading-tight">
                                        {student.madarsaName || (student.regNo ? "Searching..." : (headerInfo.madrasaName || "Unknown"))}
                                      </span>
                                      <span className="text-[9px] font-mono text-gray-400">
                                        {student.mid || headerInfo.madrasaId || ""}
                                      </span>
                                    </div>
                                  </TableCell>
                                  {columnMapping?.subjects.map(
                                    (sub, subIdx) => {
                                      const hasSubject =
                                        student.subjects[sub.name] !==
                                        undefined;
                                      return (
                                        <TableCell
                                          key={subIdx}
                                          className={`border-l border-gray-100 p-2 transition-colors ${!hasSubject ? "bg-gray-100/60 opacity-60" : "bg-white"}`}
                                        >
                                          <div
                                            className="flex gap-2 justify-center"
                                            title={
                                              !hasSubject
                                                ? "Subject not detected in this block"
                                                : `Active for ${student.class}`
                                            }
                                          >
                                            {(() => {
                                              const subjectData =
                                                student.subjects[sub.name] ||
                                                {};
                                              const mark =
                                                subjectData.mark || "";
                                              const grade =
                                                subjectData.grade || "";

                                              // Validation Logic
                                              const isMarkEmpty = mark === "";
                                              const isMarkValid =
                                                isMarkEmpty ||
                                                mark === "AB" ||
                                                mark === "Absent" ||
                                                !isNaN(parseFloat(mark));

                                              const isGradeEmpty = grade === "";
                                              const validGrades = [
                                                "",
                                                ...gradeRules.map((r) =>
                                                  r.grade.toUpperCase(),
                                                ),
                                              ];
                                              const isGradeValid =
                                                isGradeEmpty ||
                                                validGrades.includes(
                                                  grade.toUpperCase(),
                                                );

                                              return (
                                                <>
                                                  <Input
                                                    className={`h-9 w-16 rounded-none border-gray-200 text-[11px] font-black text-center focus:ring-1 focus:ring-teal-500 transition-all ${hasSubject
                                                      ? !isMarkValid
                                                        ? "border-red-500 text-red-600 bg-red-50/30"
                                                        : "text-teal-600 bg-white"
                                                      : "text-gray-400 bg-gray-50/50"
                                                      }`}
                                                    placeholder="M"
                                                    value={mark}
                                                    onChange={(e) =>
                                                      handleCellEdit(
                                                        sIdx,
                                                        "mark",
                                                        sub.name,
                                                        e.target.value,
                                                      )
                                                    }
                                                  />
                                                  <Input
                                                    className={`h-9 w-16 rounded-none border-gray-200 text-[11px] font-black text-center uppercase focus:ring-1 focus:ring-teal-500 transition-all outline-none ${hasSubject
                                                      ? !isGradeValid
                                                        ? "border-red-500 text-red-600 bg-red-50/30 shadow-sm"
                                                        : "text-gray-900 bg-white shadow-sm"
                                                      : "text-gray-400 bg-gray-50/50"
                                                      }`}
                                                    placeholder="GR"
                                                    value={grade}
                                                    onChange={(e) =>
                                                      handleCellEdit(
                                                        sIdx,
                                                        "grade",
                                                        sub.name,
                                                        e.target.value,
                                                      )
                                                    }
                                                  />
                                                </>
                                              );
                                            })()}
                                          </div>
                                        </TableCell>
                                      );
                                    },
                                  )}
                                  <TableCell className="px-4 text-center border-l border-gray-100">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={`h-8 w-12 rounded-none font-black text-[10px] transition-all ${student.remark && (student.remark.toString().toUpperCase().startsWith("P"))
                                          ? "bg-green-600 text-white border-green-700 hover:bg-green-700 hover:text-white shadow-sm"
                                          : student.remark && (student.remark.toString().toUpperCase().startsWith("F"))
                                            ? "bg-red-600 text-white border-red-700 hover:bg-red-700 hover:text-white shadow-sm"
                                            : "text-gray-400 border-gray-200 hover:bg-gray-50"
                                        }`}
                                      onClick={() => {
                                        const r = (student.remark || "").toString().toUpperCase();
                                        const isPass = r.startsWith("P");
                                        const isFail = r.startsWith("F");
                                        const next = isPass ? "F" : isFail ? "" : "P";
                                        handleCellEdit(
                                          sIdx,
                                          "remark",
                                          null,
                                          next,
                                        );
                                      }}
                                      title={
                                        !student.remark
                                          ? "System Calculated (Click to Force Pass)"
                                          : student.remark === "P"
                                            ? "Manual Pass (Click to Force Fail)"
                                            : "Manual Fail (Click to Reset)"
                                      }
                                    >
                                      {student.remark || "AUTO"}
                                    </Button>
                                  </TableCell>
                                  <TableCell className="px-2 text-center border-l border-gray-100">
                                    {(() => {
                                      const resultsArray = [];
                                      Object.keys(student.subjects).forEach(
                                        (subName) => {
                                          const mappedSub =
                                            subjectMapping[subName];
                                          if (mappedSub === "ignore_subject")
                                            return;

                                          const subKey = (mappedSub || subName).toLowerCase();
                                          const timetableEntry = (exam?.timetableEntries || []).find(
                                            (te) => (te.subject || te.title || "").toLowerCase() === subKey
                                          );
                                          const subjectMeta = resultSubjectTemp.find(
                                            (s) => (typeof s === "string" ? s : s.subject || "").toLowerCase() === subKey
                                          );

                                          resultsArray.push({
                                            subject: mappedSub || subName,
                                            marks: student.subjects[subName].mark,
                                            passMark: timetableEntry?.passMark || manualPassMarks[mappedSub || subName] || (typeof subjectMeta === 'object' ? subjectMeta.passMark : 0) || 0,
                                            totalMarks: timetableEntry?.totalMarks || manualTotalMarks[mappedSub || subName] || (typeof subjectMeta === 'object' ? subjectMeta.totalMarks : 100) || 100,
                                          });
                                        },
                                      );
                                      const { status, totalObtained } =
                                        calculateResultStatus(
                                          resultsArray,
                                          exam,
                                          student.remark,
                                        );
                                      return (
                                        <div className="flex flex-col items-center gap-1">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[12px] font-black text-gray-900 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                              {totalObtained}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell className="px-2 text-center border-l border-gray-100">
                                    {(() => {
                                      const resultsArray = [];
                                      Object.keys(student.subjects).forEach(
                                        (subName) => {
                                          const mappedSub =
                                            subjectMapping[subName];
                                          if (mappedSub === "ignore_subject")
                                            return;

                                          const subKey = (mappedSub || subName).toLowerCase();
                                          const timetableEntry = (exam?.timetableEntries || []).find(
                                            (te) => (te.subject || te.title || "").toLowerCase() === subKey
                                          );
                                          const subjectMeta = resultSubjectTemp.find(
                                            (s) => (typeof s === "string" ? s : s.subject || "").toLowerCase() === subKey
                                          );

                                          resultsArray.push({
                                            subject: mappedSub || subName,
                                            marks: student.subjects[subName].mark,
                                            passMark: timetableEntry?.passMark || manualPassMarks[mappedSub || subName] || (typeof subjectMeta === 'object' ? subjectMeta.passMark : 0) || 0,
                                            totalMarks: timetableEntry?.totalMarks || manualTotalMarks[mappedSub || subName] || (typeof subjectMeta === 'object' ? subjectMeta.totalMarks : 100) || 100,
                                          });
                                        },
                                      );
                                      const { status } = calculateResultStatus(
                                        resultsArray,
                                        exam,
                                        student.remark,
                                      );
                                      return (
                                        <Badge
                                          className={`font-black text-[9px] px-2 py-0.5 none ${status === "PASS"
                                            ? "bg-green-100 text-green-700 border border-green-200"
                                            : "bg-red-100 text-red-700 border border-red-200"
                                            }`}
                                        >
                                          {status}
                                        </Badge>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell className="text-center border-l border-gray-100">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => removeStudent(sIdx)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              </Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Sticky Save Bar */}
                <div className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-500 w-[95%] sm:w-auto">
                  <div className="bg-white border border-gray-200 px-4 sm:px-8 py-3 sm:py-4 rounded-none shadow-xl flex flex-col sm:flex-row items-center gap-4 sm:gap-10">
                    <div className="flex flex-col items-center sm:items-start">
                      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Upload Readiness
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 none-full bg-green-500 shadow-sm"></div>
                        <span className="text-gray-900 font-bold text-sm">
                          {parsedData.length} records verified
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        className="h-10 flex-1 sm:flex-none sm:px-8 rounded-none border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-sm sm:text-base shadow-sm transition-all"
                        onClick={() => setPreviewMode(true)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                      <Button
                        className="h-10 flex-1 sm:flex-none sm:px-12 rounded-none bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm sm:text-lg shadow-sm transition-all active:scale-95"
                        onClick={handleSaveResults}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin mr-2 sm:mr-3" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
                            Save
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Preview Modal */}
                {previewMode && (
                  <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-none shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
                      <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">
                            Preview Results
                          </h2>
                          <p className="text-sm text-gray-500 mt-1">
                            Read-only preview matching final published layout
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setPreviewMode(false)}
                          className="flex items-center gap-2"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Back to Edit
                        </Button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-6">
                        <div className="space-y-6">
                          <div className="grid grid-cols-3 gap-4">
                            <Card>
                              <CardContent className="p-4">
                                <p className="text-xs text-gray-500 mb-1">
                                  Total Records
                                </p>
                                <p className="text-2xl font-bold text-gray-900">
                                  {parsedData.length}
                                </p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-4">
                                <p className="text-xs text-gray-500 mb-1">
                                  Subjects
                                </p>
                                <p className="text-2xl font-bold text-gray-900">
                                  {columnMapping?.subjects?.length || 0}
                                </p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-4">
                                <p className="text-xs text-gray-500 mb-1">
                                  Classes
                                </p>
                                <p className="text-2xl font-bold text-gray-900">
                                  {
                                    [...new Set(parsedData.map((s) => s.class))]
                                      .length
                                  }
                                </p>
                              </CardContent>
                            </Card>
                          </div>

                          <div className="border border-gray-200 rounded-none overflow-hidden">
                            <Table>
                              <TableHeader className="bg-gray-50">
                                <TableRow>
                                  <TableHead className="w-16">Sl.No</TableHead>
                                  <TableHead className="w-32">
                                    Hall Ticket
                                  </TableHead>
                                  <TableHead className="min-w-[200px]">
                                    Student Name
                                  </TableHead>
                                  <TableHead className="w-24">Class</TableHead>
                                  {columnMapping?.subjects?.map((sub, idx) => (
                                    <TableHead
                                      key={idx}
                                      className="text-center"
                                    >
                                      <div className="flex flex-col items-center">
                                        <span className="font-bold text-xs">
                                          {subjectMapping[sub.name] &&
                                            subjectMapping[sub.name] !==
                                            "ignore_subject"
                                            ? subjectMapping[sub.name]
                                            : sub.name}
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                          Mark / Grade
                                        </span>
                                      </div>
                                    </TableHead>
                                  ))}
                                  <TableHead className="text-center">
                                    Total
                                  </TableHead>
                                  <TableHead className="text-center w-24">
                                    Status
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {parsedData.map((student, sIdx) => {
                                  const prevStudent =
                                    sIdx > 0 ? parsedData[sIdx - 1] : null;
                                  const showClassDivider =
                                    !prevStudent ||
                                    prevStudent.class !== student.class;

                                  const resultsArray = [];
                                  Object.keys(student.subjects || {}).forEach(
                                    (subName) => {
                                      const mappedSub = subjectMapping[subName];
                                      if (mappedSub === "ignore_subject") return;

                                      const subKey = (mappedSub || subName).toLowerCase();
                                      const timetableEntry = (exam?.timetableEntries || []).find(
                                        (te) => (te.subject || te.title || "").toLowerCase() === subKey
                                      );
                                      const subjectMeta = resultSubjectTemp.find(
                                        (s) => (typeof s === "string" ? s : s.subject || "").toLowerCase() === subKey
                                      );

                                      resultsArray.push({
                                        subject: mappedSub || subName,
                                        marks: student.subjects[subName].mark,
                                        passMark: timetableEntry?.passMark || manualPassMarks[mappedSub || subName] || (typeof subjectMeta === 'object' ? subjectMeta.passMark : 0) || 0,
                                        totalMarks: timetableEntry?.totalMarks || manualTotalMarks[mappedSub || subName] || (typeof subjectMeta === 'object' ? subjectMeta.totalMarks : 100) || 100,
                                      });
                                    },
                                  );

                                  const { status, totalObtained } =
                                    calculateResultStatus(
                                      resultsArray,
                                      exam,
                                      student.remark,
                                    );

                                  return (
                                    <Fragment key={sIdx}>
                                      {showClassDivider && (
                                        <TableRow className="bg-gray-100">
                                          <TableCell
                                            colSpan={
                                              5 +
                                              (columnMapping?.subjects
                                                ?.length || 0) +
                                              2
                                            }
                                            className="py-2 px-4"
                                          >
                                            <Badge className="bg-gray-900 text-white font-bold text-xs">
                                              Class {student.class}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                      <TableRow className="hover:bg-gray-50">
                                        <TableCell className="text-center text-gray-600 font-mono text-sm">
                                          {student.slNo || sIdx + 1}
                                        </TableCell>
                                        <TableCell className="font-mono font-semibold text-sm">
                                          {student.regNo}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                          {student.name}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <Badge variant="outline">
                                            {student.class}
                                          </Badge>
                                        </TableCell>
                                        {columnMapping?.subjects?.map(
                                          (sub, subIdx) => {
                                            const mappedSubject =
                                              subjectMapping[sub.name];
                                            if (
                                              mappedSubject === "ignore_subject"
                                            ) {
                                              return (
                                                <TableCell
                                                  key={subIdx}
                                                  className="text-center text-gray-300"
                                                >
                                                  -
                                                </TableCell>
                                              );
                                            }
                                            const mark =
                                              student.subjects?.[sub.name]
                                                ?.mark || "";
                                            const grade =
                                              student.subjects?.[sub.name]
                                                ?.grade || "";
                                            return (
                                              <TableCell
                                                key={subIdx}
                                                className="text-center"
                                              >
                                                <div className="flex items-center justify-center gap-2">
                                                  <span className="font-bold text-teal-600">
                                                    {mark}
                                                  </span>
                                                  <span className="text-gray-400">
                                                    /
                                                  </span>
                                                  <Badge
                                                    variant="secondary"
                                                    className="font-bold"
                                                  >
                                                    {grade}
                                                  </Badge>
                                                </div>
                                              </TableCell>
                                            );
                                          },
                                        )}
                                        <TableCell className="text-center">
                                          <span className="font-bold text-lg text-gray-900">
                                            {totalObtained}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <Badge
                                            className={`font-bold ${status === "PASS"
                                              ? "bg-green-500 text-white"
                                              : "bg-red-500 text-white"
                                              }`}
                                          >
                                            {status}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    </Fragment>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                          This is a preview. Click &ldquo;Back to Edit&rdquo; to
                          make changes or &ldquo;Save Results&rdquo; to publish.
                        </p>
                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            onClick={() => setPreviewMode(false)}
                          >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Edit
                          </Button>
                          <Button
                            className="bg-teal-600 hover:bg-teal-700 text-white"
                            onClick={() => {
                              setPreviewMode(false);
                              handleSaveResults();
                            }}
                            disabled={uploading}
                          >
                            {uploading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Save Results
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="manual">
          <div className="space-y-8 animate-in fade-in duration-500">
            <Card className="border border-gray-200 shadow-none rounded-none overflow-hidden">
              <CardHeader className="bg-white border-b border-gray-100 p-3 sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-teal-50 text-teal-600 rounded-none flex items-center justify-center shrink-0">
                    <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
                      Direct Entry Interface
                    </CardTitle>
                    <p className="text-gray-500 font-medium text-xs sm:text-sm">
                      Search and modify individual records
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-1.5 sm:p-6 space-y-6">
                <Tabs
                  value={manualSearchMode}
                  onValueChange={setManualSearchMode}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2 mb-6 h-auto bg-gray-100/50 p-1 rounded-none overflow-x-auto">
                    <TabsTrigger
                      value="madarsa"
                      className="rounded-none data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm font-bold transition-all py-2 text-xs sm:text-sm"
                    >
                      <User className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      Madarsa
                    </TabsTrigger>
                    <TabsTrigger
                      value="direct"
                      className="rounded-none data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm font-bold transition-all py-2 text-xs sm:text-sm"
                    >
                      <Search className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      Direct
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="direct"
                    className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 p-2 sm:p-2 bg-gray-50 none-2xl border border-gray-100">
                      <div className="flex-1 relative w-full">
                        <Search className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                        <Input
                          placeholder="Search Hall Ticket numbers..."
                          className="h-12 sm:h-14 pl-10 sm:pl-14 pr-4 sm:pr-6 rounded-none border-none bg-transparent focus-visible:ring-0 text-base sm:text-lg font-mono placeholder:text-gray-400 w-full"
                          value={manualHallTicket}
                          onChange={(e) => setManualHallTicket(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && fetchManualStudents()
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                          size="lg"
                          className="h-12 sm:h-14 px-4 sm:px-8 rounded-none font-bold text-sm sm:text-lg shadow-lg shadow-teal-600/20 transition-all hover:scale-[1.02] active:scale-95 flex-1 sm:flex-initial"
                          onClick={() => fetchManualStudents()}
                          disabled={fetchingStudent}
                        >
                          {fetchingStudent ? (
                            <>
                              <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin mr-2" />
                              Fetching...
                            </>
                          ) : (
                            <>
                              <Search className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                              Fetch
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-12 sm:h-14 w-12 sm:w-auto sm:px-6 rounded-none text-gray-400 hover:text-red-600 hover:bg-red-50 font-bold shrink-0"
                          onClick={clearManualEntry}
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>

                    <div className="px-2 sm:px-4 flex flex-wrap items-center gap-x-4 sm:gap-6 gap-y-2 text-[10px] sm:text-[11px] font-medium text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1 h-1 none-full bg-teal-400" />
                        <span>Comma/space separated (e.g. 1001, 1002)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1 h-1 none-full bg-teal-400" />
                        <span>Manual ranges (e.g. 1001-1020)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1 h-1 none-full bg-teal-400" />
                        <span>Press Enter to fetch</span>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="madarsa"
                    className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300"
                  >
                    <div className="space-y-4">
                      {/* Madarsa Selection */}
                      <div className="p-4 bg-gray-50 rounded-none border border-gray-100">
                        <Label className="text-sm font-bold text-gray-700 mb-2 block">
                          Select Madarsa{" "}
                          {fetchingMadarsaList && (
                            <span className="text-xs text-gray-500">
                              (Loading...)
                            </span>
                          )}
                        </Label>
                        {fetchingMadarsaList ? (
                          <div className="h-12 flex items-center justify-center border rounded-none bg-white">
                            <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                          </div>
                        ) : madarsaList.length === 0 ? (
                          <div className="h-12 flex items-center justify-center border rounded-none bg-white text-gray-500 text-sm">
                            No madarsas available
                          </div>
                        ) : (
                          <SearchableSelect
                            value={selectedMadarsa}
                            onValueChange={setSelectedMadarsa}
                            options={madarsaList.map((madarsa) => {
                              const madarsaName =
                                madarsa.name ||
                                madarsa.madarsaName ||
                                "Unnamed Madarsa";
                              const mid =
                                madarsa.madarsaId || madarsa.mid || madarsa.id;
                              return {
                                value: mid,
                                label: `${madarsaName} (MID: ${mid})`,
                                searchableText:
                                  `${madarsaName} ${mid}`.toLowerCase(),
                              };
                            })}
                            getOptionSearchText={(opt) => opt.searchableText}
                            placeholder="Search by name or MID..."
                            emptyMessage="No madarsa found"
                          />
                        )}
                      </div>

                      {/* Class Selection */}
                      {selectedMadarsa && (
                        <div className="p-4 bg-gray-50 rounded-none border border-gray-100">
                          <Label className="text-sm font-bold text-gray-700 mb-2 block">
                            Select Class
                            {fetchingMadarsaClasses && (
                              <span className="text-xs text-gray-500 ml-2">
                                (Updating...)
                              </span>
                            )}
                          </Label>
                          <Select
                            value={selectedMadarsaClass}
                            onValueChange={setSelectedMadarsaClass}
                            disabled={fetchingMadarsaClasses}
                          >
                            <SelectTrigger className="h-12 bg-white">
                              <SelectValue placeholder="All Classes" />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                              <SelectItem value="all">All Classes</SelectItem>
                              {madarsaClasses.map((cls) => (
                                <SelectItem key={cls} value={cls}>
                                  Class {cls}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Search Bar */}
                      {selectedMadarsa && (
                        <div className="p-4 bg-gray-50 rounded-none border border-gray-100">
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input
                              placeholder="Search students by name..."
                              className="h-12 pl-12"
                              value={madarsaSearch}
                              onChange={(e) => setMadarsaSearch(e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Students List */}
                      {selectedMadarsa && (
                        <div className="space-y-4">
                          {fetchingMadarsaStudents ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                            </div>
                          ) : madarsaStudents.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                              <User className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                              <p>No students found</p>
                            </div>
                          ) : (
                            <>
                              <div className="bg-white rounded-none border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="whitespace-nowrap">
                                          HallTicket No
                                        </TableHead>
                                        <TableHead className="whitespace-nowrap">
                                          Admission No
                                        </TableHead>
                                        <TableHead className="whitespace-nowrap">
                                          Result Status
                                        </TableHead>
                                        <TableHead className="whitespace-nowrap">
                                          Student Name
                                        </TableHead>
                                        <TableHead className="whitespace-nowrap">
                                          Class
                                        </TableHead>
                                        <TableHead className="whitespace-nowrap">
                                          Status
                                        </TableHead>
                                        <TableHead className="whitespace-nowrap">
                                          Action
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {madarsaStudents.map((student) => {
                                        const hasResult =
                                          existingResults[
                                          student.hallTicketNumber
                                          ];
                                        return (
                                          <TableRow key={student.id}>
                                            <TableCell className="font-mono">
                                              {student.hallTicketNumber}
                                            </TableCell>
                                            <TableCell className="font-mono text-teal-600 font-bold">
                                              {student.admissionNumber || "N/A"}
                                            </TableCell>
                                            <TableCell>
                                              {hasResult ? (
                                                <Badge
                                                  variant="secondary"
                                                  className={
                                                    calculateResultStatus(
                                                      hasResult.result,
                                                      exam,
                                                    ).status === "PASS"
                                                      ? "bg-green-100 text-green-700 border-green-200"
                                                      : "bg-red-100 text-red-700 border-red-200"
                                                  }
                                                >
                                                  {
                                                    calculateResultStatus(
                                                      hasResult.result,
                                                      exam,
                                                    ).status
                                                  }
                                                </Badge>
                                              ) : (
                                                <span className="text-gray-300">
                                                  -
                                                </span>
                                              )}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                              {student.fullName}
                                            </TableCell>
                                            <TableCell>
                                              {student.classLevel}
                                            </TableCell>
                                            <TableCell>
                                              {hasResult ? (
                                                <Badge className="bg-green-100 text-green-800">
                                                  Published
                                                </Badge>
                                              ) : (
                                                <Badge variant="outline">
                                                  Pending
                                                </Badge>
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              <Button
                                                size="sm"
                                                variant={
                                                  hasResult
                                                    ? "outline"
                                                    : "default"
                                                }
                                                className="whitespace-nowrap"
                                                onClick={() => {
                                                  setManualHallTicket(
                                                    student.hallTicketNumber.toString(),
                                                  );
                                                  fetchManualStudents(
                                                    student.hallTicketNumber,
                                                  );
                                                }}
                                              >
                                                <span className="hidden sm:inline">
                                                  {hasResult
                                                    ? "Edit Result"
                                                    : "Publish Result"}
                                                </span>
                                                <span className="sm:hidden">
                                                  {hasResult
                                                    ? "Edit"
                                                    : "Publish"}
                                                </span>
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>

                              {/* Pagination */}
                              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4">
                                <div className="text-sm text-gray-600 text-center sm:text-left">
                                  Showing {madarsaStudents.length} of{" "}
                                  {madarsaTotalCount} students
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={madarsaPage === 1}
                                    onClick={() => {
                                      setMadarsaPage((p) => p - 1);
                                      fetchMadarsaStudents("prev");
                                    }}
                                  >
                                    Previous
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                      madarsaStudents.length < madarsaPageSize
                                    }
                                    onClick={() => {
                                      setMadarsaPage((p) => p + 1);
                                      fetchMadarsaStudents("next");
                                    }}
                                  >
                                    Next
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="bg-gray-50 p-3 sm:p-5 rounded-none border border-gray-100 mb-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 bg-teal-100 text-teal-600 rounded-none flex items-center justify-center">
                        <Calculator className="h-4 w-4" />
                      </div>
                      <h4 className="font-bold text-gray-900 uppercase tracking-wider text-xs sm:text-sm">
                        Dynamic Grade Mapping
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 bg-white px-3 sm:px-4 py-2 rounded-none border border-gray-100 w-full sm:w-auto justify-between sm:justify-start">
                      <div className="flex flex-col items-start sm:items-end leading-none">
                        <span className="text-[10px] font-bold text-gray-900 uppercase">
                          Publish
                        </span>
                        <span className="text-[9px] text-gray-400 font-medium mt-1">
                          {publishByDefault ? "Public" : "Draft"}
                        </span>
                      </div>
                      <Switch
                        checked={publishByDefault}
                        onCheckedChange={setPublishByDefault}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:gap-3">
                    {gradeRules.map((rule, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-2.5 sm:p-3 rounded-none border border-gray-100 space-y-2 group hover:border-teal-200 transition-all"
                      >
                        <Label className="text-[10px] sm:text-xs font-black text-gray-700 uppercase tracking-wider block text-center">
                          {rule.grade}
                        </Label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            className="h-8 sm:h-9 text-xs sm:text-sm font-bold text-center border-gray-200 focus:border-teal-500 rounded-none"
                            value={rule.min}
                            onChange={(e) => {
                              const next = [...gradeRules];
                              next[idx].min = parseInt(e.target.value) || 0;
                              setGradeRules(next);
                            }}
                          />
                          <span className="text-gray-400 font-bold text-sm">
                            -
                          </span>
                          <Input
                            type="number"
                            className="h-8 sm:h-9 text-xs sm:text-sm font-bold text-center border-gray-200 focus:border-teal-500 rounded-none"
                            value={rule.max}
                            onChange={(e) => {
                              const next = [...gradeRules];
                              next[idx].max = parseInt(e.target.value) || 0;
                              setGradeRules(next);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {manualStudents.length > 0 && (
                  <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-4">
                    <Button
                      variant="outline"
                      className="h-10 sm:h-11 px-4 sm:px-6 rounded-none border-red-100 text-red-600 hover:bg-red-50 font-bold text-xs sm:text-sm w-full sm:w-auto"
                      onClick={clearManualGrades}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Grades
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 sm:h-11 px-4 sm:px-6 rounded-none border-teal-200 text-teal-700 hover:bg-teal-50 font-bold text-xs sm:text-sm w-full sm:w-auto"
                      onClick={autoCalculateManualGrades}
                    >
                      <Calculator className="h-4 w-4 mr-2" />
                      Auto-Grades
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {manualStudents.length > 0 && (
              <div className="space-y-6">
                {manualStudents.map((student) => {
                  const ht = student.hallTicketNumber.toString();
                  const isExisting = !!existingResults[ht];

                  return (
                    <Card
                      key={ht}
                      className={`border border-gray-200 shadow-none rounded-none overflow-hidden transition-all bg-white`}
                    >
                      <div className="p-2.5 sm:p-8">
                        <div className="flex flex-col gap-4 sm:gap-6 mb-6 sm:mb-8">
                          <div className="flex flex-row items-start sm:items-center gap-3 sm:gap-6 w-full">
                            <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-none bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm shrink-0">
                              {student.profilePictureUrl ? (
                                <img
                                  src={student.profilePictureUrl}
                                  alt={student.fullName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <User className="h-8 w-8 sm:h-10 sm:w-10 text-gray-300" />
                              )}
                            </div>
                            <div className="flex-1 w-full min-w-0">
                              {student.isCustom ? (
                                <div className="space-y-3">
                                  <Input
                                    className="h-10 px-3 sm:px-4 text-base sm:text-xl font-bold bg-white border-teal-200 focus:border-teal-500 rounded-none w-full max-w-[400px]"
                                    placeholder="Full Name (Required)"
                                    value={student.fullName}
                                    onChange={(e) =>
                                      handleManualStudentEdit(
                                        ht,
                                        "fullName",
                                        e.target.value,
                                      )
                                    }
                                  />
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                    <Badge className="font-bold font-mono">
                                      HT: {ht}
                                    </Badge>
                                    {(() => {
                                      const removedSubs =
                                        removedSubjectsPerStudent[ht] || [];
                                      const liveResults = Object.keys(
                                        manualEntries[ht] || {},
                                      )
                                        .filter(
                                          (sub) => !removedSubs.includes(sub),
                                        )
                                        .map((sub) => ({
                                          subject: sub,
                                          marks: manualEntries[ht][sub].mark,
                                          grade: manualEntries[ht][sub].grade,
                                          passMark: getPassMarkForSubject(sub),
                                        }));
                                      const status = calculateResultStatus(
                                        liveResults,
                                        exam,
                                      );
                                      return (
                                        <Badge
                                          className={`font-bold uppercase text-[9px] sm:text-[10px] ${status.status === "PASS" ? "bg-green-600" : "bg-red-600"}`}
                                        >
                                          Live: {status.status} (
                                          {status.totalObtained})
                                        </Badge>
                                      );
                                    })()}
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        Class:
                                      </span>
                                      <Input
                                        className="h-7 px-2 text-[10px] font-bold bg-white border-teal-100 focus:border-teal-500 rounded-none w-16 sm:w-20 uppercase"
                                        placeholder="Class"
                                        value={student.classLevel}
                                        onChange={(e) =>
                                          handleManualStudentEdit(
                                            ht,
                                            "classLevel",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        Madarsa:
                                      </span>
                                      <Input
                                        className="h-7 px-2 text-[10px] font-bold bg-white border-teal-100 focus:border-teal-500 rounded-none w-32 sm:w-40"
                                        placeholder="Madarsa"
                                        value={student.madarsa}
                                        onChange={(e) =>
                                          handleManualStudentEdit(
                                            ht,
                                            "madarsa",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className="border-orange-200 text-orange-600 bg-orange-50 font-black text-[8px] sm:text-[9px] uppercase px-2 py-0.5"
                                    >
                                      Custom
                                    </Badge>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
                                    {student.fullName}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                                    <Badge className="font-bold font-mono">
                                      HT: {ht}
                                    </Badge>
                                    {student.admissionNumber && (
                                      <Badge
                                        variant="outline"
                                        className="font-bold font-mono text-teal-600 border-teal-200 bg-teal-50"
                                      >
                                        ADM: {student.admissionNumber}
                                      </Badge>
                                    )}
                                    {(() => {
                                      const removedSubs =
                                        removedSubjectsPerStudent[ht] || [];
                                      const liveResults = Object.keys(
                                        manualEntries[ht] || {},
                                      )
                                        .filter(
                                          (sub) => !removedSubs.includes(sub),
                                        )
                                        .map((sub) => ({
                                          subject: sub,
                                          marks: manualEntries[ht][sub].mark,
                                          grade: manualEntries[ht][sub].grade,
                                          passMark: getPassMarkForSubject(sub),
                                        }));
                                      const status = calculateResultStatus(
                                        liveResults,
                                        exam,
                                      );
                                      return (
                                        <Badge
                                          className={`font-bold uppercase text-[9px] sm:text-[10px] ${status.status === "PASS" ? "bg-green-600" : "bg-red-600"}`}
                                        >
                                          Live: {status.status} (
                                          {status.totalObtained})
                                        </Badge>
                                      );
                                    })()}
                                    <Badge className="border-teal-100 font-bold uppercase text-[9px] sm:text-[10px]">
                                      {student.classLevel || student.class}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="border-gray-200 text-gray-400 font-bold uppercase text-[9px] sm:text-[10px] truncate max-w-[150px] sm:max-w-none"
                                    >
                                      {student.madarsa}
                                    </Badge>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {isExisting && manualSearchMode !== "madarsa" && (
                            <div className="bg-orange-100 p-4 rounded-none flex items-center gap-4">
                              <AlertTriangle className="h-6 w-6 text-orange-600" />
                              <div>
                                <p className="font-bold text-orange-900 leading-none">
                                  Record Exists
                                </p>
                                <p className="text-[10px] font-bold text-orange-700 uppercase mt-1">
                                  A result is already recorded for this HT.
                                  Editing will overwrite it.
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-white hover:bg-orange-50 border-orange-200 text-orange-700 font-bold rounded-none ml-auto"
                                onClick={() => handleEditExisting(ht)}
                              >
                                Reload from DB
                              </Button>
                            </div>
                          )}
                        </div>

                        <div>
                          {editingHTs.has(ht) ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-gray-700">
                                  Subjects
                                </h4>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-3 text-xs font-bold border-teal-200 text-teal-700 hover:bg-teal-50"
                                  onClick={() => {
                                    setAddSubjectForClass(
                                      student.classLevel ||
                                      student.class ||
                                      null,
                                    );
                                    setShowAddSubjectInput(true);
                                  }}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Subject
                                </Button>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-4">
                                {(() => {
                                  // Gather all potential subjects: hall ticket specific + timetable + extras
                                  const htSubs = htStudentSubjects[ht] || [];
                                  const htSubNames = htSubs.map((s) =>
                                    typeof s === "string" ? s : s.subject,
                                  );
                                  const studentClass =
                                    student.classLevel || student.class;
                                  const sClassUpper = String(studentClass)
                                    .trim()
                                    .toUpperCase();

                                  const timetableSubs = (
                                    exam?.timetableEntries || []
                                  )
                                    .filter((te) => {
                                      const subName = te.subject || te.title;
                                      return (
                                        subName &&
                                        !htSubNames.includes(subName) &&
                                        !deletedResultSubjects.includes(subName)
                                      );
                                    })
                                    .map((te) => ({
                                      subject: te.subject || te.title,
                                      passMark:
                                        manualPassMarks[
                                        te.subject || te.title
                                        ] || te.passMark,
                                    }));

                                  const timetableSubNames = timetableSubs.map(
                                    (ts) => ts.subject,
                                  );

                                  const extraSubs = resultSubjectTemp
                                    .filter((extraSub) => {
                                      if (
                                        htSubNames.includes(extraSub.subject) ||
                                        timetableSubNames.includes(
                                          extraSub.subject,
                                        )
                                      )
                                        return false;
                                      if (
                                        extraSub.class === "all" ||
                                        !extraSub.class
                                      )
                                        return true;

                                      const eClassUpper = String(extraSub.class)
                                        .trim()
                                        .toUpperCase();
                                      if (eClassUpper === sClassUpper)
                                        return true;

                                      return Object.values(
                                        CLASS_EQUIVALENTS || {},
                                      ).some((eq) => {
                                        const eqUpper = eq.map((e) =>
                                          String(e).toUpperCase(),
                                        );
                                        return (
                                          eqUpper.includes(eClassUpper) &&
                                          eqUpper.includes(sClassUpper)
                                        );
                                      });
                                    })
                                    .map((s) => ({
                                      subject: s.subject,
                                      passMark:
                                        manualPassMarks[s.subject] ||
                                        s.passMark,
                                    }));

                                  // Merge and filter locally removed ones
                                  return [
                                    ...htSubs,
                                    ...timetableSubs,
                                    ...extraSubs,
                                  ].filter((s) => {
                                    const subName =
                                      typeof s === "string" ? s : s.subject;
                                    return !(
                                      removedSubjectsPerStudent[ht] || []
                                    ).includes(subName);
                                  });
                                })().map((subObj) => {
                                  const sub =
                                    typeof subObj === "string"
                                      ? subObj
                                      : subObj.subject;
                                  if (!sub) return null;
                                  const passMark =
                                    exam?.timetableEntries?.find(
                                      (te) => (te.subject || te.title) === sub,
                                    )?.passMark ||
                                    subObj.passMark ||
                                    manualPassMarks[sub];

                                  return (
                                    <div
                                      key={sub}
                                      className="bg-white p-2 sm:p-4 rounded-none border border-gray-200 shadow-sm flex flex-col justify-between h-full relative overflow-hidden group"
                                    >
                                      <div className="flex items-center gap-2 mb-2 sm:mb-4">
                                        <div className="h-5 w-5 sm:h-8 sm:w-8 rounded-none bg-teal-50 text-teal-600 flex items-center justify-center text-[9px] sm:text-[10px] font-bold shrink-0 border border-white">
                                          {sub.substring(0, 2).toUpperCase()}
                                        </div>
                                        <Label
                                          className="text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-tight truncate flex-1 leading-tight"
                                          title={sub}
                                        >
                                          {sub}
                                        </Label>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-5 w-5 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                          onClick={() => {
                                            setRemovedSubjectsPerStudent(
                                              (prev) => ({
                                                ...prev,
                                                [ht]: [
                                                  ...(prev[ht] || []),
                                                  sub,
                                                ],
                                              }),
                                            );
                                            toast.info(
                                              `Removed ${sub} for this student`,
                                            );
                                          }}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      <div className="flex gap-2 sm:gap-6 items-end">
                                        <div className="flex-1 space-y-0.5 sm:space-y-1">
                                          <span className="text-[7px] sm:text-[9px] font-bold text-gray-400 ml-0.5 uppercase block">
                                            Marks
                                          </span>
                                          <Input
                                            type="number"
                                            className="h-8 sm:h-10 w-full rounded-none bg-gray-50 border-transparent focus:bg-white focus:border-teal-500 transition-all font-bold text-teal-600 text-center text-xs sm:text-sm px-0"
                                            placeholder="00"
                                            value={
                                              manualEntries[ht]?.[sub]?.mark ||
                                              ""
                                            }
                                            onChange={(e) =>
                                              handleEntryChange(
                                                ht,
                                                sub,
                                                "mark",
                                                e.target.value,
                                              )
                                            }
                                          />
                                        </div>
                                        <div className="flex-1 space-y-0.5 sm:space-y-1">
                                          <span className="text-[7px] sm:text-[9px] font-bold text-gray-400 ml-0.5 uppercase block">
                                            Grade
                                          </span>
                                          <Input
                                            className="h-8 sm:h-10 w-full rounded-none bg-gray-50 border-transparent focus:bg-white focus:border-teal-500 transition-all font-bold text-gray-600 text-center text-xs sm:text-sm px-0 uppercase"
                                            placeholder="GR"
                                            value={
                                              manualEntries[ht]?.[sub]?.grade ||
                                              ""
                                            }
                                            onChange={(e) =>
                                              handleEntryChange(
                                                ht,
                                                sub,
                                                "grade",
                                                e.target.value,
                                              )
                                            }
                                          />
                                        </div>
                                      </div>
                                      <div className="mt-1.5 flex justify-between items-center px-0.5">
                                        <span className="text-[8px] sm:text-[9px] font-bold text-gray-300">
                                          PM: {passMark || "-"}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {isExisting && (
                                <div className="flex gap-3 mt-6 pt-4 border-t border-dashed border-gray-200">
                                  <Button
                                    className="h-10 px-8 rounded-none bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                    onClick={() =>
                                      handleUpdateExistingResult(ht)
                                    }
                                    disabled={uploading}
                                  >
                                    {uploading ? (
                                      <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Updating...
                                      </>
                                    ) : (
                                      "Update Result"
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="h-10 px-6 rounded-none border-gray-200 text-gray-500 font-bold hover:bg-gray-50"
                                    onClick={() => {
                                      // Reload from saved data and exit edit mode
                                      const existingResult =
                                        existingResults[ht];
                                      if (existingResult?.result) {
                                        const restored = {};
                                        existingResult.result.forEach(
                                          (item) => {
                                            restored[item.subject] = {
                                              mark: item.marks ?? "",
                                              grade: item.grade || "",
                                            };
                                          },
                                        );
                                        setManualEntries((prev) => ({
                                          ...prev,
                                          [ht]: restored,
                                        }));
                                      }
                                      setRemovedSubjectsPerStudent((prev) => {
                                        const next = { ...prev };
                                        delete next[ht];
                                        return next;
                                      });
                                      setEditingHTs((prev) => {
                                        const next = new Set(prev);
                                        next.delete(ht);
                                        return next;
                                      });
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Saved Performance View (Read-Only Preview) */
                            <div className="bg-gray-50/50 p-4 sm:p-8 rounded-none border border-gray-100">
                              <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-none bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-100">
                                    <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                                  </div>
                                  <div>
                                    <h4 className="text-base sm:text-lg font-black text-gray-800 uppercase tracking-tight">
                                      Saved Performance Record
                                    </h4>
                                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mt-0.5">
                                      Verified & Processed
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-10 px-6 rounded-none border-teal-200 text-teal-700 font-bold hover:bg-teal-50"
                                  onClick={() => handleEditExisting(ht)}
                                >
                                  Edit Results
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                {(() => {
                                  // Directly show from results collection
                                  const savedResultArray =
                                    existingResults[ht]?.result || [];

                                  if (savedResultArray.length === 0) {
                                    return (
                                      <div className="col-span-full p-4 text-center text-gray-400 font-medium text-sm">
                                        No saved subjects found.
                                      </div>
                                    );
                                  }

                                  return savedResultArray.map(
                                    (savedSub, idx) => {
                                      const sub = savedSub.subject;
                                      const passMark =
                                        savedSub.passMark ||
                                        getPassMarkForSubject(sub);
                                      const isFail =
                                        passMark > 0 &&
                                        Number(savedSub.marks) < passMark;

                                      return (
                                        <div
                                          key={idx}
                                          className={`bg-white p-3 border shadow-sm flex items-center justify-between ${isFail ? "border-red-300 bg-red-50/30" : "border-gray-200"}`}
                                        >
                                          <div className="flex items-center gap-3">
                                            <div
                                              className={`h-8 w-8 rounded-none flex items-center justify-center text-[10px] font-black border uppercase ${isFail ? "bg-red-50 text-red-500 border-red-200" : "bg-gray-50 text-gray-400 border-gray-100"}`}
                                            >
                                              {sub.substring(0, 2)}
                                            </div>
                                            <div>
                                              <p className="text-[10px] font-black text-gray-700 uppercase mb-1">
                                                {sub}
                                              </p>
                                              <p className="text-[9px] font-bold text-gray-400 uppercase">
                                                Marks:{" "}
                                                <span
                                                  className={
                                                    isFail
                                                      ? "text-red-500"
                                                      : "text-teal-600"
                                                  }
                                                >
                                                  {savedSub.marks || "0"}
                                                </span>{" "}
                                                | Grade:{" "}
                                                <span className="text-teal-600">
                                                  {savedSub.grade || "NA"}
                                                </span>
                                                {passMark > 0 && (
                                                  <>
                                                    {" "}
                                                    | PM:{" "}
                                                    <span className="text-gray-500">
                                                      {passMark}
                                                    </span>
                                                  </>
                                                )}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-[8px] font-bold text-gray-300 uppercase">
                                              Status
                                            </p>
                                            <p
                                              className={`text-[10px] font-black uppercase ${isFail ? "text-red-500" : "text-green-600"}`}
                                            >
                                              {isFail ? "Failed" : "Passed"}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    },
                                  );
                                })()}
                              </div>

                              <div className="mt-6 pt-6 border-t border-dashed border-gray-200 flex flex-wrap gap-4 items-center">
                                {(() => {
                                  // Read directly from saved results collection doc
                                  const savedDoc = existingResults[ht] || {};
                                  const savedResultArray =
                                    savedDoc.result || [];

                                  const liveResults = savedResultArray.map(
                                    (sub) => ({
                                      subject: sub.subject,
                                      marks: sub.marks,
                                      grade: sub.grade,
                                      passMark:
                                        sub.passMark ||
                                        getPassMarkForSubject(sub.subject),
                                    }),
                                  );
                                  const res = calculateResultStatus(
                                    liveResults,
                                    exam,
                                  );
                                  return (
                                    <Fragment>
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-100 rounded-none border border-gray-200">
                                          <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">
                                            Total Obtained
                                          </p>
                                          <p className="text-base font-black text-gray-700 leading-none">
                                            {res.totalObtained}
                                          </p>
                                        </div>
                                        <div
                                          className={`p-2 rounded-none border ${res.status === "PASS" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
                                        >
                                          <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">
                                            Final Status
                                          </p>
                                          <p
                                            className={`text-base font-black leading-none ${res.status === "PASS" ? "text-green-600" : "text-red-600"}`}
                                          >
                                            {res.status}
                                          </p>
                                        </div>
                                      </div>
                                      {res.percentage !== undefined && (
                                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-none border-2 border-gray-100 flex items-center justify-center bg-white ml-auto">
                                          <p className="text-[9px] font-black text-gray-800">
                                            {res.percentage}%
                                          </p>
                                        </div>
                                      )}
                                    </Fragment>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}

                <div className="flex justify-center sm:justify-end pt-10 pb-20">
                  <Button
                    className="h-12 sm:h-11 w-full sm:w-auto px-16 rounded-none bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg sm:text-xl shadow-sm shadow-teal-100 transition-all active:scale-95 disabled:opacity-50"
                    onClick={handleManualSubmit}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin mr-3" />
                        Saving...
                      </>
                    ) : (
                      "Save Result"
                    )}
                  </Button>
                </div>

                {/* Global Dialogs Restored */}
                <Dialog
                  open={showAddSubjectInput}
                  onOpenChange={setShowAddSubjectInput}
                >
                  <DialogContent className="sm:max-w-[500px] bg-white p-0 overflow-hidden border-none shadow-2xl rounded-none">
                    <DialogHeader className="p-6 pb-0">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 mt-1 rounded-none bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-100">
                          <Plus className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <DialogTitle className="text-xl font-bold text-teal-900">
                            Add Subject
                          </DialogTitle>
                          <DialogDescription className="text-teal-600 font-medium text-xs mt-1">
                            Define extra subjects for results
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>

                    <div className="p-6">
                      <Tabs
                        value={subjectTab}
                        onValueChange={setSubjectTab}
                        className="w-full"
                      >
                        <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-none h-11 mb-6">
                          <TabsTrigger
                            value="existing"
                            className="rounded-none data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm font-bold"
                          >
                            Use Existing
                          </TabsTrigger>
                          <TabsTrigger
                            value="new"
                            className="rounded-none data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm font-bold"
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
                                options={resultSubjectTemp
                                  .filter((s) => {
                                    if (!addSubjectForClass) return true;
                                    if (s.class === "all" || !s.class)
                                      return true;
                                    const sClassUpper = String(
                                      addSubjectForClass,
                                    )
                                      .trim()
                                      .toUpperCase();
                                    const eClassUpper = String(s.class)
                                      .trim()
                                      .toUpperCase();
                                    if (eClassUpper === sClassUpper)
                                      return true;
                                    return Object.values(
                                      CLASS_EQUIVALENTS || {},
                                    ).some((eq) => {
                                      const eqUpper = eq.map((e) =>
                                        String(e).toUpperCase(),
                                      );
                                      return (
                                        eqUpper.includes(eClassUpper) &&
                                        eqUpper.includes(sClassUpper)
                                      );
                                    });
                                  })
                                  .map((s) => ({
                                    label: s.subject,
                                    value: s.subject,
                                  }))}
                                value={newSubjectName}
                                onValueChange={(val) => {
                                  setNewSubjectName(val);
                                  const existing = resultSubjectTemp.find(
                                    (s) => s.subject === val,
                                  );
                                  if (existing) {
                                    setNewSubjectPassMark(
                                      existing.passMark || 35,
                                    );
                                    setNewSubjectTotalMarks(
                                      existing.totalMarks || 100,
                                    );
                                    setNewSubjectFirstClassMarks(
                                      existing.firstClassMarks || 60,
                                    );
                                    setNewSubjectClass(existing.class || "all");
                                  }
                                }}
                                triggerClassName="h-12 bg-white border-teal-200 focus:ring-2 focus:ring-teal-500 rounded-none shadow-none"
                                searchPlaceholder="Search subjects..."
                                onDeleteOption={initiateDeleteSubject}
                              />
                            ) : (
                              <Input
                                placeholder="Enter new subject name"
                                className="h-12 bg-white border-teal-200 focus:ring-2 focus:ring-teal-500 rounded-none font-bold"
                                value={newSubjectName}
                                onChange={(e) =>
                                  setNewSubjectName(e.target.value)
                                }
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
                                <SelectTrigger className="h-12 bg-white border-teal-200 focus:ring-2 focus:ring-teal-500 rounded-none">
                                  <SelectValue placeholder="All Classes" />
                                </SelectTrigger>
                                <SelectContent className="bg-white rounded-none">
                                  <SelectItem
                                    value="all"
                                    className="rounded-none"
                                  >
                                    All Classes
                                  </SelectItem>
                                  {madarsaClasses.map((cls) => (
                                    <SelectItem
                                      key={cls}
                                      value={cls}
                                      className="rounded-none"
                                    >
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
                                className="h-12 bg-white border-teal-200 focus:ring-2 focus:ring-teal-500 rounded-none font-bold shadow-none"
                                value={newSubjectTotalMarks}
                                onChange={(e) =>
                                  setNewSubjectTotalMarks(
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-teal-800 uppercase ml-1 tracking-wider">
                                Pass Marks
                              </Label>
                              <Input
                                type="number"
                                className="h-12 bg-white border-teal-200 focus:ring-2 focus:ring-teal-500 rounded-none font-bold shadow-none"
                                value={newSubjectPassMark}
                                onChange={(e) =>
                                  setNewSubjectPassMark(
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-teal-800 uppercase ml-1 tracking-wider">
                                First Class
                              </Label>
                              <Input
                                type="number"
                                className="h-12 bg-white border-teal-200 focus:ring-2 focus:ring-teal-500 rounded-none font-bold shadow-none"
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
                          className="flex-1 h-12 font-bold text-gray-500 hover:bg-gray-50 rounded-none"
                          onClick={() => {
                            setNewSubjectName("");
                            setAddSubjectForClass(null);
                            setShowAddSubjectInput(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="flex-[2] h-12 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-none shadow-lg shadow-teal-100"
                          onClick={() => {
                            const trimmedSubject = newSubjectName.trim();
                            if (trimmedSubject) {
                              const newSubObj = {
                                subject: trimmedSubject,
                                class: newSubjectClass,
                                passMark: newSubjectPassMark,
                                totalMarks: newSubjectTotalMarks,
                                firstClassMarks: newSubjectFirstClassMarks,
                              };

                              if (
                                !resultSubjectTemp.some(
                                  (s) =>
                                    s.subject === trimmedSubject &&
                                    s.class === newSubjectClass,
                                )
                              ) {
                                updateDoc(doc(db, COLLECTIONS.EXAMS, examId), {
                                  resultSubjectTemp: arrayUnion(newSubObj),
                                }).catch((err) =>
                                  console.error(
                                    "Error saving custom subject:",
                                    err,
                                  ),
                                );
                                setResultSubjectTemp((prev) => [
                                  ...prev,
                                  newSubObj,
                                ]);
                              }

                              setManualPassMarks((prev) => ({
                                ...prev,
                                [trimmedSubject]: newSubjectPassMark,
                              }));
                              setManualTotalMarks((prev) => ({
                                ...prev,
                                [trimmedSubject]: newSubjectTotalMarks,
                              }));
                              setManualFirstClassMarks((prev) => ({
                                ...prev,
                                [trimmedSubject]: newSubjectFirstClassMarks,
                              }));

                              const updatedEntries = { ...manualEntries };
                              Object.keys(updatedEntries).forEach((htKey) => {
                                if (!updatedEntries[htKey][trimmedSubject]) {
                                  updatedEntries[htKey][trimmedSubject] = {
                                    mark: "",
                                    grade: "",
                                  };
                                }
                              });
                              setManualEntries(updatedEntries);
                              toast.success(
                                `Added ${trimmedSubject} for Class ${newSubjectClass}`,
                              );
                              setNewSubjectName("");
                              setAddSubjectForClass(null);
                              setShowAddSubjectInput(false);
                            } else {
                              toast.error("Please enter a subject name");
                            }
                          }}
                        >
                          Finalize & Add Subject
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={showDeleteConfirm}
                  onOpenChange={setShowDeleteConfirm}
                >
                  <DialogContent className="sm:max-w-md bg-white p-6 border-none shadow-2xl rounded-none">
                    <DialogHeader>
                      <div className="mx-auto w-12 h-12 bg-red-50 text-red-600 rounded-none flex items-center justify-center mb-4">
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <DialogTitle className="text-xl font-bold text-center text-gray-900">
                        Confirm Deletion
                      </DialogTitle>
                      <DialogDescription className="text-center text-gray-500 pt-2 pb-2">
                        Are you sure you want to remove{" "}
                        <span className="font-bold text-gray-900">
                          &quot;{subjectToDelete?.value}&quot;
                        </span>
                        from the{" "}
                        <span className="text-teal-600 font-bold">
                          Exam Configuration
                        </span>
                        ? This will remove it from the list of selectable
                        subjects for ALL students in this exam. This action
                        cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-3 justify-center pt-6">
                      <Button
                        variant="ghost"
                        className="flex-1 h-11 font-bold text-gray-500 hover:bg-gray-50 rounded-none"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setSubjectToDelete(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-bold rounded-none"
                        onClick={executeDeleteSubject}
                      >
                        Delete Subject
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
