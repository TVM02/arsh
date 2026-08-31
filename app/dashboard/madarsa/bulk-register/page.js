"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  writeBatch,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestoreService";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  CheckSquare,
  Square,
  Upload,
  Search,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  IndianRupee,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function StatusBadge({ label, color }) {
  const colors = {
    green: "bg-green-100 text-green-800 border-green-200",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
    teal: "bg-teal-100 text-teal-800 border-teal-200",
    red: "bg-red-100 text-red-800 border-red-200",
    gray: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[color] || colors.gray}`}
    >
      {label}
    </span>
  );
}

function BulkRegisterPage() {
  const { userData } = useAuthStore();
  const { toast } = useToast();

  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState(null);

  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [failedStudentClasses, setFailedStudentClasses] = useState(new Map());
  const [revaluationEnabled, setRevaluationEnabled] = useState(false);

  const [registrations, setRegistrations] = useState([]);
  const registeredIds = useMemo(
    () => new Set(registrations.map((r) => r.studentId)),
    [registrations],
  );
  const [regLoading, setRegLoading] = useState(false);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [unregisterIds, setUnregisterIds] = useState(new Set());

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [showOnlyUnregistered, setShowOnlyUnregistered] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const classLevels = useMemo(() => {
    const seen = new Set();
    students.forEach((s) => {
      if (s.classLevel) seen.add(s.classLevel);
    });
    return Array.from(seen).sort();
  }, [students]);

  useEffect(() => {
    const fetchExams = async () => {
      setExamsLoading(true);
      try {
        const settingsDoc = await getDocs(query(collection(db, "settings")));
        let revaluationEnabled = false;
        settingsDoc.forEach((doc) => {
          if (doc.id === "general") {
            revaluationEnabled = doc.data().revaluationEnabled || false;
          }
        });
        setRevaluationEnabled(revaluationEnabled);

        const q = query(
          collection(db, COLLECTIONS.EXAMS),
          where("isActive", "==", true),
        );
        const snap = await getDocs(q);
        // Ensure Firestore doc id is not overwritten by any `id` field in the document data.
        const fetchedExams = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        const filteredExams = fetchedExams.filter(exam => {
          const type = (exam.examType || "PUBLIC").toUpperCase();
          if (type === "REVALUATION") return revaluationEnabled;
          return true;
        });
        setExams(filteredExams);
      } catch (err) {
        console.error("Failed to load exams", err);
        toast({ title: "Error loading exams", variant: "destructive" });
      } finally {
        setExamsLoading(false);
      }
    };
    fetchExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedExam || !userData?.madarsaId) return;
    setStudents([]);
    setSelectedIds(new Set());
    setUnregisterIds(new Set());
    setResult(null);

    const fetchStudents = async () => {
      setStudentsLoading(true);
      try {
        const q = query(
          collection(db, COLLECTIONS.STUDENTS),
          where("madarsaId", "==", userData.madarsaId),
          where("status", "==", "active"),
        );
        const snap = await getDocs(q);
        // Ensure Firestore doc id is not overwritten by any `id` field in the document data.
        setStudents(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        
        // Fetch results to determine failed students for SAY exams
        if (userData?.madarsaId) {
          try {
            const resultsQ = query(
              collection(db, COLLECTIONS.EXAM_RESULTS || "results"),
              where("madarsaId", "==", userData.madarsaId)
            );
            const resultsSnap = await getDocs(resultsQ);
            const failedMap = new Map();
            resultsSnap.forEach(doc => {
              const res = doc.data();
              // Check if failed
              const status = String(res.resultStatus || res.status || res.promotedStatus || "").toLowerCase();
              let isFailed = status.includes("fail") || res.isPassed === false || res.passed === false;
              if (!isFailed && Array.isArray(res.result)) {
                isFailed = res.result.some((subject) => {
                  const passMark = Number(subject.passMark || 30);
                  const marks = Number(subject.marks);
                  return Number.isFinite(marks) && marks < passMark;
                });
              }
              
              if (isFailed) {
                const sId = res.studentId || res.uid || res.studentUid;
                const className = String(res.class || res.classLevel || res.examClass || "").toLowerCase().replace(/^class\s+/, "").trim();
                if (sId && className) {
                  if (!failedMap.has(sId)) failedMap.set(sId, new Set());
                  failedMap.get(sId).add(className);
                }
              }
            });
            setFailedStudentClasses(failedMap);
          } catch (e) {
            console.error("Error fetching failed results:", e);
          }
        }
      } catch (err) {
        console.error("Failed to load students", err);
        toast({ title: "Error loading students", variant: "destructive" });
      } finally {
        setStudentsLoading(false);
      }
    };

    const fetchRegistrations = async () => {
      setRegLoading(true);
      try {
        const q = query(
          collection(db, COLLECTIONS.EXAM_REGISTRATIONS),
          where("examId", "==", selectedExam.id),
          where("madarsaId", "==", userData.madarsaId),
        );
        const snap = await getDocs(q);
        setRegistrations(
          snap.docs.map((d) => ({
            docId: d.id,
            studentId: d.data().studentId,
          })),
        );
      } catch (err) {
        console.error("Failed to check registrations", err);
      } finally {
        setRegLoading(false);
      }
    };

    fetchStudents();
    fetchRegistrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExam, userData?.madarsaId]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (
        search &&
        !(s.fullName || s.name || "")
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        !(s.admissionNumber || s.admissionNo || "")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      if (
        classFilter !== "all" &&
        (s.classLevel || "").toUpperCase() !== classFilter.toUpperCase()
      )
        return false;
      if (showOnlyUnregistered && registeredIds.has(s.id)) return false;

      if (selectedExam && (selectedExam.examType || "PUBLIC").toUpperCase() === "SAY") {
        const examClass = String(selectedExam.class || "").toLowerCase().replace(/^class\s+/, "").trim();
        const studentFailedClasses = failedStudentClasses.get(s.id) || new Set();
        if (!studentFailedClasses.has(examClass)) {
          return false;
        }
      }

      return true;
    });
  }, [students, search, classFilter, showOnlyUnregistered, registeredIds, selectedExam, failedStudentClasses]);

  const unregisteredFiltered = filtered.filter((s) => !registeredIds.has(s.id));
  const allUnregisteredSelected =
    unregisteredFiltered.length > 0 &&
    unregisteredFiltered.every((s) => selectedIds.has(s.id));

  const toggleStudent = (id) => {
    if (registeredIds.has(id)) {
      setUnregisterIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllUnregistered = () => {
    if (allUnregisteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        unregisteredFiltered.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        unregisteredFiltered.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  const totalStudents = students.length;
  const totalRegistered = registeredIds.size;
  const totalUnregistered = totalStudents - totalRegistered;
  const totalSelected = [...selectedIds].filter(
    (id) => !registeredIds.has(id),
  ).length;
  const totalToUnregister = unregisterIds.size;
  const examFees = selectedExam?.fees ?? 0;
  const totalAmount = totalSelected * examFees;

  const handleSubmit = async () => {
    if (!selectedExam || totalSelected === 0) return;
    setSubmitting(true);
    setResult(null);
    const toRegister = students.filter(
      (s) => selectedIds.has(s.id) && !registeredIds.has(s.id),
    );
    let successCount = 0;
    let failedCount = 0;
    const BATCH_SIZE = 499;
    try {
      for (let i = 0; i < toRegister.length; i += BATCH_SIZE) {
        const chunk = toRegister.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((s) => {
          const ref = doc(collection(db, COLLECTIONS.EXAM_REGISTRATIONS));
          batch.set(ref, {
            studentId: s.id,
            studentName: s.fullName || s.name || "",
            classLevel: s.classLevel || "",
            madarsaId: userData.madarsaId,
            madarsaName: userData.madarsaName || "",
            examId: selectedExam.id,
            examTitle: selectedExam.title || "",
            status: "registered",
            paymentStatus: "waived",
            registeredBy: userData.uid || userData.id || "",
            registeredByName: userData.fullName || userData.name || "",
            registeredByRole: "madarsa_admin",
            createdAt: serverTimestamp(),
          });
        });
        try {
          await batch.commit();
          successCount += chunk.length;
        } catch (batchErr) {
          console.error("Batch failed", batchErr);
          failedCount += chunk.length;
        }
      }
      setRegistrations((prev) => [
        ...prev,
        ...toRegister.map((s) => ({ docId: null, studentId: s.id })),
      ]);
      setSelectedIds(new Set());
      setResult({
        success: successCount,
        skipped: selectedIds.size - toRegister.length,
        failed: failedCount,
      });
      toast({
        title: `Registered ${successCount} student${successCount !== 1 ? "s" : ""}`,
        variant: failedCount > 0 ? "destructive" : "default",
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Registration failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnregister = async () => {
    if (totalToUnregister === 0) return;
    setSubmitting(true);
    try {
      const toDelete = registrations.filter(
        (r) => unregisterIds.has(r.studentId) && r.docId,
      );
      for (const reg of toDelete) {
        await deleteDoc(doc(db, COLLECTIONS.EXAM_REGISTRATIONS, reg.docId));
      }
      setRegistrations((prev) =>
        prev.filter((r) => !unregisterIds.has(r.studentId)),
      );
      setUnregisterIds(new Set());
      toast({
        title: `Unregistered ${toDelete.length} student${toDelete.length !== 1 ? "s" : ""}`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Unregister failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-teal-600 rounded-lg">
            <Upload className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Bulk Register</h1>
            <p className="text-sm text-gray-500">
              Register multiple students for an exam at once (payment waived)
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT: Exam selection */}
          <div className="lg:w-72 xl:w-80 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-5 lg:sticky lg:top-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <h2 className="font-semibold text-gray-900">Select Exam</h2>
              </div>

              {examsLoading ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading exams…
                </div>
              ) : exams.length === 0 ? (
                <p className="text-sm text-gray-500">No active exams found.</p>
              ) : (
                <div className="space-y-2">
                  {exams.map((exam) => (
                    <button
                      key={exam.id}
                      onClick={() => {
                        setSelectedExam(exam);
                        setClassFilter("all");
                        setSearch("");
                      }}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedExam?.id === exam.id
                          ? "border-teal-600 bg-teal-50"
                          : "border-gray-200 hover:border-teal-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <BookOpen className="w-4 h-4 mt-0.5 text-teal-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {exam.title}
                          </p>
                          {exam.fees != null && (
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-0.5">
                              <IndianRupee className="w-3 h-3" />
                              {exam.fees} per student
                            </p>
                          )}
                          {exam.examDate && (
                            <p className="text-xs text-gray-500">
                              {exam.examDate}
                            </p>
                          )}
                        </div>
                        {selectedExam?.id === exam.id && (
                          <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedExam && examFees > 0 && totalSelected > 0 && (
                <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                  <p className="text-xs text-teal-700 font-medium">
                    Estimated Amount
                  </p>
                  <p className="text-xl font-bold text-teal-800 flex items-center gap-0.5">
                    <IndianRupee className="w-4 h-4" />
                    {totalAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-teal-600">
                    {totalSelected} × ₹{examFees} (waived)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Students */}
          <div className="flex-1 min-w-0">
            {!selectedExam ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  Select an exam on the left to get started
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <h2 className="font-semibold text-gray-900">
                    Select Students
                  </h2>
                  {totalToUnregister > 0 && (
                    <span className="ml-auto text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                      {totalToUnregister} marked for unregister
                    </span>
                  )}
                </div>

                {!studentsLoading && !regLoading && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        label: "Total",
                        value: totalStudents,
                        style: "bg-teal-50 border-teal-200 text-teal-700",
                      },
                      {
                        label: "Registered",
                        value: totalRegistered,
                        style: "bg-green-50 border-green-200 text-green-700",
                      },
                      {
                        label: "Yet to Register",
                        value: totalUnregistered,
                        style: "bg-yellow-50 border-yellow-200 text-yellow-700",
                      },
                      {
                        label: "Selected",
                        value: totalSelected,
                        style: "bg-teal-50 border-teal-200 text-teal-700",
                      },
                    ].map(({ label, value, style }) => (
                      <div
                        key={label}
                        className={`rounded-lg p-3 border ${style}`}
                      >
                        <p className="text-2xl font-bold">{value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search name or admission no…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="all">All Classes</option>
                    {classLevels.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showOnlyUnregistered}
                      onChange={(e) =>
                        setShowOnlyUnregistered(e.target.checked)
                      }
                      className="rounded accent-teal-600"
                    />
                    Unregistered only
                  </label>
                </div>

                {!studentsLoading &&
                  !regLoading &&
                  unregisteredFiltered.length > 0 && (
                    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <button
                        onClick={selectAllUnregistered}
                        className="flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-800"
                      >
                        {allUnregisteredSelected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                        {allUnregisteredSelected
                          ? "Deselect All Unregistered"
                          : `Select All Unregistered (${unregisteredFiltered.length})`}
                      </button>
                      <span className="text-xs text-gray-500">
                        {totalSelected} selected
                      </span>
                    </div>
                  )}

                {studentsLoading || regLoading ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm py-6 justify-center">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading
                    students…
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-8">
                    No students match your filters.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                    {filtered.map((student) => {
                      const alreadyReg = registeredIds.has(student.id);
                      const isSelected = selectedIds.has(student.id);
                      const markedForUnreg = unregisterIds.has(student.id);
                      return (
                        <div
                          key={student.id}
                          onClick={() => toggleStudent(student.id)}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${
                            markedForUnreg
                              ? "bg-red-50"
                              : alreadyReg
                                ? "bg-gray-50 opacity-70"
                                : isSelected
                                  ? "bg-teal-50"
                                  : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="shrink-0">
                            {markedForUnreg ? (
                              <Trash2 className="w-5 h-5 text-red-500" />
                            ) : alreadyReg ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : isSelected ? (
                              <CheckSquare className="w-5 h-5 text-teal-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {student.fullName || student.name || "—"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {student.admissionNumber ||
                                student.admissionNo ||
                                "No Adm. No."}{" "}
                              · {student.classLevel || "—"}
                            </p>
                          </div>
                          {markedForUnreg ? (
                            <StatusBadge label="Unregister" color="red" />
                          ) : alreadyReg ? (
                            <StatusBadge label="Registered" color="green" />
                          ) : isSelected ? (
                            <StatusBadge label="Selected" color="teal" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {totalSelected > 0 && (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium text-sm hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Register {totalSelected} Student
                      {totalSelected !== 1 ? "s" : ""}
                      {examFees > 0 &&
                        ` — waived ₹${totalAmount.toLocaleString()}`}
                    </button>
                  )}
                  {totalToUnregister > 0 && (
                    <button
                      onClick={handleUnregister}
                      disabled={submitting}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Unregister {totalToUnregister} Student
                      {totalToUnregister !== 1 ? "s" : ""}
                    </button>
                  )}
                </div>

                {result && (
                  <div
                    className={`rounded-xl border p-5 flex items-start gap-3 ${result.failed > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}
                  >
                    {result.failed > 0 ? (
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">
                        {result.failed > 0
                          ? "Partial Success"
                          : "Registration Complete"}
                      </p>
                      <ul className="text-sm text-gray-600 mt-1 space-y-0.5">
                        <li>
                          ✅ {result.success} student
                          {result.success !== 1 ? "s" : ""} registered
                        </li>
                        {result.skipped > 0 && (
                          <li>
                            ⚠️ {result.skipped} already registered (skipped)
                          </li>
                        )}
                        {result.failed > 0 && (
                          <li>❌ {result.failed} failed — please retry</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function BulkRegisterPageWrapper() {
  return (
    <ProtectedRoute requiredRole="madarsa_admin">
      <BulkRegisterPage />
    </ProtectedRoute>
  );
}
