"use client";

import React from "react";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import InspectorLayout from "@/components/InspectorLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Download,
  Upload,
  X,
  FileText,
  Save,
  Send,
  Eye,
  Building,
  Users,
  UserCheck,
  ClipboardList,
  CheckCircle,
  AlertCircle,
  QrCode,
  Loader2,
} from "lucide-react";
import useAuthStore from "@/lib/authStore";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import PhotoCapture from "@/components/PhotoCapture";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { uploadInspectionFilesToStorage } from "@/lib/inspectionUpload";
import { QRCodeCanvas } from "qrcode.react";
import {
  canonicalDistrictName,
  madrasaMatchesDistrict,
} from "@/lib/madrasaHierarchy";

const fetchMadarsasByIds = async (madarsaIds) => {
  const rawIds = Array.isArray(madarsaIds) ? madarsaIds : [];
  const stringIds = rawIds.map((x) => String(x ?? "").trim()).filter(Boolean);
  const numberIds = rawIds
    .map((x) => {
      if (typeof x === "number") return x;
      const s = String(x ?? "").trim();
      if (!s) return NaN;
      if (!/^\d+$/.test(s)) return NaN;
      return Number(s);
    })
    .filter((n) => Number.isFinite(n));

  if (stringIds.length === 0 && numberIds.length === 0) return [];

  const queryInChunks = async (values) => {
    const chunks = [];
    for (let i = 0; i < values.length; i += 10)
      chunks.push(values.slice(i, i + 10));
    const out = [];
    for (const chunk of chunks) {
      const snap = await getDocs(
        query(collection(db, "madarsas"), where("madarsaId", "in", chunk)),
      );
      snap.docs.forEach((doc) => out.push({ id: doc.id, ...doc.data() }));
    }
    return out;
  };

  const results = [
    ...(await queryInChunks(stringIds)),
    ...(await queryInChunks(numberIds)),
  ];

  const seen = new Set();
  return results.filter((m) => {
    const mid = String(m?.madarsaId ?? "").trim();
    if (!mid) return false;
    if (seen.has(mid)) return false;
    seen.add(mid);
    return true;
  });
};

const deriveMadarsasFromAssignedDistricts = async (assignedDistricts) => {
  const districts = Array.isArray(assignedDistricts)
    ? assignedDistricts
        .map((d) => canonicalDistrictName(d) || String(d || "").trim())
        .filter(Boolean)
    : [];
  if (districts.length === 0) return [];
  const values = Array.from(new Set(districts.map((d) => String(d).trim())));

  const chunks = [];
  for (let i = 0; i < values.length; i += 10) {
    chunks.push(values.slice(i, i + 10));
  }

  let all = [];
  if (chunks.length > 0) {
    const snaps = await Promise.all([
      ...chunks.map((chunk) => getDocs(query(collection(db, "madarsas"), where("district", "in", chunk)))),
      ...chunks.map((chunk) => getDocs(query(collection(db, "madarsas"), where("districtName", "in", chunk))))
    ]);
    snaps.forEach((snap) => {
      snap.docs.forEach((doc) => all.push({ id: doc.id, ...doc.data() }));
    });
  }

  const filtered = all.filter((m) =>
    districts.some((d) => {
      try {
        if (!madrasaMatchesDistrict(m, d)) return false;
        return !!String(m?.district || m?.districtName || "").trim();
      } catch {
        return false;
      }
    }),
  );

  const seen = new Set();
  return filtered.filter((m) => {
    const mid = String(m?.madarsaId || "").trim();
    if (!mid) return false;
    if (seen.has(mid)) return false;
    seen.add(mid);
    return true;
  });
};

const STEPS = [
  { id: 1, title: "Basic Information", icon: ClipboardList },
  { id: 2, title: "Madrasa Form", icon: Building },
  { id: 3, title: "Management Form", icon: UserCheck },
  { id: 4, title: "Sadar Info/Form", icon: Users },
  { id: 5, title: "Madrasa Data", icon: FileText },
  { id: 6, title: "Inventory Management", icon: FileText },
  { id: 7, title: "Review & Submit", icon: CheckCircle },
];

// Standard class list shown in the student summary table
const CLASS_LIST = [
  "LKG",
  "Ukg",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];

// Normalize raw classLevel values from Firestore to display labels
const CLASS_NORMALIZE = {
  // LKG
  lkg: "LKG",
  LKG: "LKG",
  // UKG
  ukg: "Ukg",
  UKG: "Ukg",
  Ukg: "Ukg",
  // Numeric → Roman
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
  8: "VIII",
  9: "IX",
  10: "X",
  11: "XI",
  12: "XII",
  // Roman (already correct)
  I: "I",
  II: "II",
  III: "III",
  IV: "IV",
  V: "V",
  VI: "VI",
  VII: "VII",
  VIII: "VIII",
  IX: "IX",
  X: "X",
  XI: "XI",
  XII: "XII",
  // Class with prefix ("Class 1", "Class I")
  "class 1": "I",
  "class 2": "II",
  "class 3": "III",
  "class 4": "IV",
  "class 5": "V",
  "class 6": "VI",
  "class 7": "VII",
  "class 8": "VIII",
  "class 9": "IX",
  "class 10": "X",
  "class 11": "XI",
  "class 12": "XII",
  "class i": "I",
  "class ii": "II",
  "class iii": "III",
  "class iv": "IV",
  "class v": "V",
  "class vi": "VI",
  "class vii": "VII",
  "class viii": "VIII",
  "class ix": "IX",
  "class x": "X",
  "class xi": "XI",
  "class xii": "XII",
};

// Normalize any gender string → "male" | "female" | ""
const normalizeGender = (raw) => {
  const g = String(raw || "")
    .toLowerCase()
    .trim();
  if (["male", "m", "boy", "boys", "1"].includes(g)) return "male";
  if (["female", "f", "girl", "girls", "0", "2"].includes(g)) return "female";
  return "";
};

import { INVENTORY_ITEMS } from "@/lib/inspectionConstants";

function CreateInspectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData } = useAuthStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [madarsas, setMadarsas] = useState([]);

  const [madrasaStudents, setMadrasaStudents] = useState([]);
  const [madrasaTeachers, setMadrasaTeachers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [madrasaDataLoading, setMadrasaDataLoading] = useState(false);
  // Dedicated state so the student-fetch effect reliably fires when madrasa changes
  const [selectedMadarsaIdForFetch, setSelectedMadarsaIdForFetch] =
    useState("");
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [exportingMadrasaPdf, setExportingMadrasaPdf] = useState(false);
  const [exportingMadrasaExcel, setExportingMadrasaExcel] = useState(false);
  const [exportingInventoryPdf, setExportingInventoryPdf] = useState(false);
  const [exportingInventoryExcel, setExportingInventoryExcel] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [addingNewField, setAddingNewField] = useState(false);

  // Form data for all steps
  const [formData, setFormData] = useState({
    // Step 1: Basic Information
    selectedMadarsaId: "",
    madarsaName: "",
    inspectionDate: new Date().toISOString().split("T")[0],
    inspectionType: "routine",
    title: "",
    location: null,

    // Step 2: Madarsa Form
    madarsaFormFiles: [],
    madarsaFormRemarks: "",

    // Step 3: Management Form
    managementFormFiles: [],
    managementFormRemarks: "",

    // Step 4: Sadar Info Form
    sadarFormFiles: [],
    sadarFormRemarks: "",

    // Step 5: Class-wise student summary (editable by inspector)
    classTableData: {},

    // Step 6: Inventory registry (inspector-entered counts)
    inventoryRegistry: {
      hajeerBook: "",
      signRegister: "",
      registerBook: "",
      tcBook: "",
      meetingBook: "",
      markRegister: "",
      others: "",
    },
    // Custom inventory fields added by inspector
    customInventoryFields: [],
  });

  const [uploadingFiles, setUploadingFiles] = useState({});
  const [previewModal, setPreviewModal] = useState({ open: false, file: null });
  const [draftId, setDraftId] = useState(null);
  const [inspectorSelfieUrl, setInspectorSelfieUrl] = useState(null);
  const [qrModal, setQrModal] = useState({
    open: false,
    step: null,
    url: "",
    sessionId: "",
  });
  // Tracks the active mobile upload session independently of whether the QR modal is open.
  // This way ALL files uploaded from the phone are received, not just the first one.
  const [mobileSession, setMobileSession] = useState({
    sessionId: "",
    step: null,
  });

  // Load draft if resuming
  useEffect(() => {
    const loadDraft = async () => {
      const draftIdParam = searchParams.get("draft");
      if (draftIdParam) {
        try {
          const draftDoc = await getDoc(doc(db, "inspections", draftIdParam));
          if (draftDoc.exists()) {
            const draftData = draftDoc.data();
            setFormData((prev) => ({ ...prev, ...draftData }));
            setCurrentStep(draftData.currentStep || 1);
            setDraftId(draftIdParam);
            // Trigger student fetch for the saved madrasa
            if (draftData.selectedMadarsaId) {
              setSelectedMadarsaIdForFetch(draftData.selectedMadarsaId);
            }
          }
        } catch (error) {
          console.error("Error loading draft:", error);
          toast.error("Failed to load draft");
        }
      }
    };

    loadDraft();
  }, [searchParams]);

  // Capture Location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData((prev) => ({
            ...prev,
            location: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            },
          }));
        },
        (err) => console.error("Could not get location:", err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  // Load madarsas
  useEffect(() => {
    const fetchMadarsas = async () => {
      try {
        const madarsaIds = Array.isArray(userData?.assignedMadarsas)
          ? userData.assignedMadarsas
          : [];
        const districts = Array.isArray(userData?.assignedDistricts)
          ? userData.assignedDistricts
          : userData?.assignedDistrict
            ? [userData.assignedDistrict]
            : [];

        if (madarsaIds.length === 0 && districts.length === 0) return;

        let madarsasData =
          madarsaIds.length > 0
            ? await fetchMadarsasByIds(madarsaIds)
            : await deriveMadarsasFromAssignedDistricts(districts);
        if (
          madarsaIds.length > 0 &&
          madarsasData.length === 0 &&
          districts.length > 0
        ) {
          madarsasData = await deriveMadarsasFromAssignedDistricts(districts);
        }
        setMadarsas(madarsasData);

        // Auto-select madrasa: prefer ?madarsaId= URL param, then first in list.
        if (madarsasData.length >= 1) {
          const madarsaIdParam = searchParams.get("madarsaId");
          setFormData((prev) => {
            if (prev.selectedMadarsaId) return prev;
            const m = madarsaIdParam
              ? madarsasData.find((x) => x.madarsaId === madarsaIdParam) ||
                madarsasData[0]
              : madarsasData[0];
            const name = m.name || "";
            // Trigger student fetch via the dedicated state
            setSelectedMadarsaIdForFetch(m.madarsaId);
            return {
              ...prev,
              selectedMadarsaId: m.madarsaId,
              madarsaName: name,
              title: `Inspection Report - ${name}`,
            };
          });
        }
      } catch (error) {
        console.error("Error fetching madarsas:", error);
      }
    };

    if (userData) {
      fetchMadarsas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  // Load madrasa data (students/teachers) + inventory data for selected madrasa
  useEffect(() => {
    const fetchMadrasaData = async () => {
      const mid = selectedMadarsaIdForFetch;
      if (!mid) {
        setMadrasaStudents([]);
        setMadrasaTeachers([]);
        setInventoryItems([]);
        return;
      }

      try {
        setMadrasaDataLoading(true);

        // Build all candidate IDs for this madrasa. Students/teachers can be stored
        // under the numeric madarsaId field value ("MID-001"), the Firestore doc ID,
        // or even a numeric version of the ID. We resolve all three to avoid
        // missing data when the storage format is inconsistent.
        const candidateIds = new Set([String(mid).trim()]);

        // The already-loaded madarsas list is the fastest source — no extra Firestore read.
        const madarsaObj = madarsas.find(
          (m) =>
            String(m?.madarsaId || "").trim() === String(mid).trim() ||
            String(m?.id || "").trim() === String(mid).trim(),
        );
        if (madarsaObj?.id) candidateIds.add(String(madarsaObj.id).trim());
        if (madarsaObj?.madarsaId)
          candidateIds.add(String(madarsaObj.madarsaId).trim());

        // Also do a live Firestore lookup in case the madarsas list is stale/empty
        try {
          const mSnap = await getDocs(
            query(collection(db, "madarsas"), where("madarsaId", "==", mid)),
          );
          if (!mSnap.empty) {
            const mDoc = mSnap.docs[0];
            if (mDoc.id) candidateIds.add(String(mDoc.id).trim());
            if (mDoc.data().madarsaId)
              candidateIds.add(String(mDoc.data().madarsaId).trim());
          } else {
            // Try fetching by Firestore doc id
            try {
              const directSnap = await getDoc(doc(db, "madarsas", mid));
              if (directSnap.exists()) {
                candidateIds.add(String(directSnap.id).trim());
                if (directSnap.data().madarsaId)
                  candidateIds.add(String(directSnap.data().madarsaId).trim());
              }
            } catch {
              // ignore
            }
          }
        } catch {
          // proceed with what we have
        }

        const baseIds = Array.from(candidateIds).filter(
          (id) => id !== "" && id !== null && id !== undefined,
        );

        // Expand to include 'mid-xxx' and 'mld-xxx' prefixes as many teachers
        // use those formats for madarsaId.
        const expandedStringIds = new Set(baseIds);
        baseIds.forEach((idStr) => {
          const numericStr = idStr.replace(/^[a-zA-Z]+-/, "");
          if (numericStr) {
            expandedStringIds.add(numericStr);
            expandedStringIds.add(`mid-${numericStr}`);
            expandedStringIds.add(`mld-${numericStr}`);
          }
        });
        const finalStringIds = Array.from(expandedStringIds);

        // Also build numeric versions — Firestore stores madarsaId as a number
        // in some documents, so a string query won't match them (type-strict).
        const numericIds = finalStringIds
          .map((id) => {
            const n = Number(id);
            return Number.isFinite(n) && n > 0 ? n : null;
          })
          .filter(Boolean);

        // Generate all query promises (string ids + numeric ids) for a collection and field
        const buildSnapPromises = (colName, fieldName = "madarsaId") => [
          ...finalStringIds.map((id) =>
            getDocs(
              query(collection(db, colName), where(fieldName, "==", id)),
            ),
          ),
          ...numericIds.map((id) =>
            getDocs(
              query(collection(db, colName), where(fieldName, "==", id)),
            ),
          ),
        ];

        // Step 2: Query students + teachers for ALL candidate IDs (string + numeric), then deduplicate
        // Teachers might be stored under `madarsaId` or `madrasaId`
        // Use Promise.allSettled to prevent one failed query from breaking everything
        const results = await Promise.allSettled([
          ...buildSnapPromises("students", "madarsaId"),
          ...buildSnapPromises("students", "madrasaId"),
          ...buildSnapPromises("teachers", "madarsaId"),
          ...buildSnapPromises("teachers", "madrasaId"),
        ]);

        const uniqueStudents = new Map();
        const uniqueTeachers = new Map();

        // Process results
        // first half are students, second half are teachers based on how we built the array
        let index = 0;
        const totalStudentPromises = buildSnapPromises("students", "madarsaId").length * 2; // times 2 for the two field names
        
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

        setMadrasaStudents(
          Array.from(uniqueStudents.values()).filter(
            (s) => !s.deleted && ["active", "inactive"].includes(s.status || "active")
          )
        );
        setMadrasaTeachers(
          Array.from(uniqueTeachers.values()).filter(
            (t) => !t.deleted && ["active", "inactive"].includes(t.status || "active")
          )
        );
      } catch (error) {
        console.error("Error fetching madrasa data:", error);
        setMadrasaStudents([]);
        setMadrasaTeachers([]);
      } finally {
        setMadrasaDataLoading(false);
      }
    };

    const fetchInventory = async () => {
      const mid = selectedMadarsaIdForFetch;
      if (!mid) {
        setInventoryItems([]);
        return;
      }
      try {
        setInventoryLoading(true);
        const invSnap = await getDocs(
          query(collection(db, "inventory"), where("madarsaId", "==", mid)),
        );
        const items = invSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setInventoryItems(items);
      } catch (error) {
        console.error("Error fetching inventory:", error);
        setInventoryItems([]);
      } finally {
        setInventoryLoading(false);
      }
    };

    fetchMadrasaData();
    fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMadarsaIdForFetch, madarsas]);

  // Listen to the active mobile upload session for ALL files, regardless of whether the QR modal
  // is open. This ensures every file the phone uploads is reflected on the desktop.
  useEffect(() => {
    if (!mobileSession.sessionId || !draftId || !mobileSession.step) return;

    const unsub = onSnapshot(
      doc(db, "mobileUploadSessions", mobileSession.sessionId),
      async (snap) => {
        if (!snap.exists()) return;
        const session = snap.data() || {};
        const pendingFiles = Array.isArray(session.files)
          ? session.files
          : [];

        if (pendingFiles.length === 0) return;

        const step = mobileSession.step;
        const field = `${step}FormFiles`;

        // Merge into local formData immediately (optimistic UI)
        setFormData((prev) => {
          const existingKeys = new Set(
            (prev[field] || []).map((f) => f?.storagePath || f?.url || ""),
          );
          const newFiles = pendingFiles.filter(
            (f) => !existingKeys.has(f?.storagePath || f?.url || ""),
          );
          if (newFiles.length === 0) return prev;
          toast.success(`${newFiles.length} file(s) received from mobile`);
          return { ...prev, [field]: [...(prev[field] || []), ...newFiles] };
        });

        // Auto-close QR modal once at least one NEW file arrives
        setQrModal((prev) => (prev.open ? { ...prev, open: false } : prev));

        // Persist to the inspections document using the authenticated inspector
        try {
          await updateDoc(doc(db, "inspections", draftId), {
            [field]: arrayUnion(...pendingFiles),
            updatedAt: serverTimestamp(),
          });
        } catch (e) {
          console.error("Failed to link mobile files to inspection:", e);
        }
      },
    );

    return () => unsub();
  }, [mobileSession.sessionId, mobileSession.step, draftId]);

  // Live-sync draft updates (e.g. mobile uploads) into local state
  useEffect(() => {
    if (!draftId) return;

    const unsub = onSnapshot(doc(db, "inspections", draftId), (snap) => {
      if (!snap.exists()) return;
      const remote = snap.data() || {};

      const mergeUploadedFiles = (local = [], remoteList = []) => {
        const toKey = (f) =>
          f?.storagePath || `${f?.url || ""}|${f?.name || ""}`;
        const merged = [...local];
        const existing = new Set(local.map(toKey));
        remoteList.forEach((f) => {
          const k = toKey(f);
          if (!existing.has(k)) {
            merged.push(f);
            existing.add(k);
          }
        });
        return merged;
      };

      setFormData((prev) => {
        const next = { ...prev };
        ["madarsa", "management", "sadar"].forEach((step) => {
          const key = `${step}FormFiles`;
          next[key] = mergeUploadedFiles(prev[key] || [], remote[key] || []);
        });
        return next;
      });
    });

    return () => unsub();
  }, [draftId]);

  const updateFormData = useCallback((updates) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Build class-wise student counts whenever students load; preserve existing remarks and entered counts
  useEffect(() => {
    if (madrasaDataLoading) return;
    setFormData((prev) => {
      // Start fresh counts (boys/girls from live data), but keep any remarks/entered counts the inspector typed
      const counts = {};
      CLASS_LIST.forEach((cls) => {
        counts[cls] = {
          boys: 0,
          girls: 0,
          others: 0,
          enteredMale: prev.classTableData?.[cls]?.enteredMale ?? "",
          enteredFemale: prev.classTableData?.[cls]?.enteredFemale ?? "",
          remarks: prev.classTableData?.[cls]?.remarks ?? "",
        };
      });
      // Bucket for students whose class doesn't match any known CLASS_LIST entry
      counts["_other"] = {
        boys: 0,
        girls: 0,
        others: 0,
        total: 0,
        enteredMale: prev.classTableData?.["_other"]?.enteredMale ?? "",
        enteredFemale: prev.classTableData?.["_other"]?.enteredFemale ?? "",
        remarks: prev.classTableData?.["_other"]?.remarks ?? "",
      };
      madrasaStudents.forEach((s) => {
        if (s.deleted || s.status === "suspended" || s.status === "deleted") {
          return;
        }

        const raw = String(
          s?.classLevel || s?.class || s?.standard || "",
        ).trim();
        const normClass =
          CLASS_NORMALIZE[raw] ||
          CLASS_NORMALIZE[raw.toLowerCase()] ||
          CLASS_NORMALIZE[raw.toUpperCase()] ||
          raw.toUpperCase();
        const gender = normalizeGender(s?.gender || s?.sex || "");

        const classKnown =
          counts[normClass] !== undefined && normClass !== "_other";
        
        const targetBucket = classKnown ? counts[normClass] : counts["_other"];
        
        if (gender === "male") targetBucket.boys += 1;
        else if (gender === "female") targetBucket.girls += 1;
        else targetBucket.others += 1;

        if (!classKnown) targetBucket.total += 1;
      });
      return { ...prev, classTableData: counts };
    });
  }, [madrasaStudents, madrasaDataLoading]);

  const handleFileUpload = async (files, step) => {
    const stepKey = `${step}FormFiles`;

    setUploadingFiles((prev) => ({ ...prev, [step]: true }));

    try {
      const { uploadedFiles, errors } = await uploadInspectionFilesToStorage(
        files,
        step,
      );

      errors.forEach((m) => toast.error(m));

      if (uploadedFiles.length > 0) {
        updateFormData({
          [stepKey]: [...formData[stepKey], ...uploadedFiles],
        });
        toast.success(`${uploadedFiles.length} file(s) uploaded successfully`);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Failed to upload files");
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [step]: false }));
    }
  };

  const removeFile = (step, index) => {
    const stepKey = `${step}FormFiles`;
    const updatedFiles = formData[stepKey].filter((_, i) => i !== index);
    updateFormData({ [stepKey]: updatedFiles });
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      const draftData = {
        ...formData,
        currentStep,
        status: "draft",
        inspectorId: user.uid,
        updatedAt: serverTimestamp(),
      };

      if (draftId) {
        await updateDoc(doc(db, "inspections", draftId), draftData);
        toast.success("Draft updated successfully");
        return draftId;
      } else {
        draftData.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, "inspections"), draftData);
        setDraftId(docRef.id);
        toast.success("Draft saved successfully");
        return docRef.id;
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openQrUpload = async (step) => {
    const id = draftId || (await saveDraft());
    if (!id) return;

    const baseUrl =
      process.env.NEXT_PUBLIC_QR_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "";
    const origin = String(baseUrl || "").replace(/\/+$/, "");

    if (!origin || /localhost|127\.0\.0\.1/i.test(origin)) {
      toast.error(
        "QR base URL is not configured. Set NEXT_PUBLIC_QR_BASE_URL to a public domain/tunnel (no localhost).",
      );
      return;
    }

    try {
      // Expire the previous session (if any) so its stale files don't
      // contaminate the new onSnapshot listener baseline.
      if (mobileSession.sessionId) {
        try {
          await updateDoc(
            doc(db, "mobileUploadSessions", mobileSession.sessionId),
            { status: "expired", expiresAt: Timestamp.fromDate(new Date(0)) },
          );
        } catch {
          // Best-effort; don't block opening the new session
        }
      }

      // Create a fresh session for this QR scan.
      const sessionId = crypto.randomUUID();
      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      );
      await setDoc(doc(db, "mobileUploadSessions", sessionId), {
        draftId: id,
        step,
        status: "active",
        createdAt: serverTimestamp(),
        expiresAt,
        uploadCount: 0,
        lastUploadAt: null,
        files: [], // explicit empty array so baseline detection is reliable
      });
      const url = `${origin}/mobile-upload?sessionId=${encodeURIComponent(sessionId)}`;

      // Reset mobileSession FIRST so the old useEffect cleans up its listener,
      // then open the modal with the brand-new session.
      setMobileSession({ sessionId: "", step: null });
      // Small tick to ensure the old unsub fires before we start the new listener
      await new Promise((r) => setTimeout(r, 0));
      setQrModal({ open: true, step, url, sessionId });
      setMobileSession({ sessionId, step });
    } catch (e) {
      console.error("Failed to create upload session:", e);
      toast.error("Failed to create upload session");
    }
  };

  const nextStep = () => {
    if (currentStep < 7) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        return (
          formData.selectedMadarsaId &&
          formData.inspectionDate &&
          formData.title
        );
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
        return true; // Optional steps
      case 7:
        return inspectorSelfieUrl; // Require inspector selfie before submission
      default:
        return false;
    }
  };

  const safeStudentName = (s) =>
    s?.fullName || s?.studentName || s?.name || s?.studentFullName || "";
  const safeStudentClass = (s) =>
    s?.classLevel || s?.class || s?.standard || "";
  const safeStudentGender = (s) => s?.gender || s?.sex || "";

  const safeTeacherName = (t) => t?.name || t?.fullName || t?.teacherName || "";
  const safeTeacherPhone = (t) => t?.phone || t?.mobile || "";
  const safeTeacherQualification = (t) => t?.qualification || t?.degree || "";

  const getMadrasaExportBaseName = () => {
    const name = formData.madarsaName || "madrasa";
    const id = formData.selectedMadarsaId || "";
    return `${String(name).replace(/\s+/g, "_")}${id ? `_${id}` : ""}`;
  };

  const downloadMadrasaDataPdf = async () => {
    if (!formData.selectedMadarsaId) return;
    setExportingMadrasaPdf(true);
    try {
      const doc = new jsPDF();
      const madrasaTitle = `Student Summary - ${formData.madarsaName || ""} (${formData.selectedMadarsaId})`;
      doc.setFontSize(13);
      doc.text(madrasaTitle, 14, 16);

      const ctd = formData.classTableData || {};
      const classRows = CLASS_LIST.map((cls) => {
        const row = ctd[cls] || {};
        const boys =
          row.boys !== undefined && row.boys !== "" ? Number(row.boys) : "";
        const girls =
          row.girls !== undefined && row.girls !== "" ? Number(row.girls) : "";
        const others = row.others !== undefined && row.others !== "" ? Number(row.others) : "";
        const total = boys !== "" && girls !== "" ? boys + girls + (others || 0) : "";
        return [
          cls,
          boys !== "" ? boys : "-",
          girls !== "" ? girls : "-",
          others !== "" && others > 0 ? others : "-",
          total !== "" ? total : "-",
          row.enteredMale !== undefined && row.enteredMale !== "" ? Number(row.enteredMale) : "-",
          row.enteredFemale !== undefined && row.enteredFemale !== "" ? Number(row.enteredFemale) : "-",
        ];
      });
      // Other row (unrecognized class)
      const otherRowPdf = ctd["_other"] || {};
      if ((otherRowPdf.total || 0) > 0) {
        classRows.push([
          "Other",
          otherRowPdf.boys || 0,
          otherRowPdf.girls || 0,
          otherRowPdf.others || 0,
          otherRowPdf.total,
          otherRowPdf.enteredMale !== undefined && otherRowPdf.enteredMale !== "" ? Number(otherRowPdf.enteredMale) : "-",
          otherRowPdf.enteredFemale !== undefined && otherRowPdf.enteredFemale !== "" ? Number(otherRowPdf.enteredFemale) : "-",
        ]);
      }

      // Total row — use madrasaStudents as authoritative source
      const tb = madrasaStudents.filter(
        (s) => normalizeGender(s?.gender || s?.sex || "") === "male",
      ).length;
      const tg = madrasaStudents.filter(
        (s) => normalizeGender(s?.gender || s?.sex || "") === "female",
      ).length;
      const to = madrasaStudents.filter((s) => {
        const g = normalizeGender(s?.gender || s?.sex || "");
        return g !== "male" && g !== "female";
      }).length;
      const tt = madrasaStudents.length;

      const totalEnteredMale = Object.values(ctd).reduce(
        (sum, r) => sum + (r.enteredMale ? Number(r.enteredMale) : 0),
        0
      );
      const totalEnteredFemale = Object.values(ctd).reduce(
        (sum, r) => sum + (r.enteredFemale ? Number(r.enteredFemale) : 0),
        0
      );

      classRows.push(["Total", tb || "-", tg || "-", to || "-", tt || "-", totalEnteredMale, totalEnteredFemale]);

      autoTable(doc, {
        startY: 22,
        head: [["Class", "Boys", "Girls", "Others", "Total", "Male Count", "Female Count"]],
        body: classRows,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [0, 128, 128] },
        foot: [],
      });

      // Teachers table below
      const afterClassY = (doc.lastAutoTable?.finalY || 22) + 8;
      doc.setFontSize(11);
      doc.text("Teachers", 14, afterClassY);
      autoTable(doc, {
        startY: afterClassY + 4,
        head: [["Teacher Name", "Phone", "Qualification"]],
        body: madrasaTeachers.map((t) => [
          safeTeacherName(t),
          safeTeacherPhone(t),
          safeTeacherQualification(t),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [0, 128, 128] },
      });

      doc.save(
        `${getMadrasaExportBaseName()}_madrasa_data_${new Date().toISOString().split("T")[0]}.pdf`,
      );
      toast.success("PDF downloaded");
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error("Failed to download PDF");
    } finally {
      setExportingMadrasaPdf(false);
    }
  };

  const exportMadrasaDataExcel = async () => {
    if (!formData.selectedMadarsaId) return;
    setExportingMadrasaExcel(true);
    try {
      const ctd = formData.classTableData || {};
      const classRows = CLASS_LIST.map((cls) => {
        const row = ctd[cls] || {};
        const boys =
          row.boys !== undefined && row.boys !== "" ? Number(row.boys) : "";
        const girls =
          row.girls !== undefined && row.girls !== "" ? Number(row.girls) : "";
        const others = row.others !== undefined && row.others !== "" ? Number(row.others) : "";
        return {
          Class: cls,
          Boys: boys !== "" ? boys : "-",
          Girls: girls !== "" ? girls : "-",
          Others: others !== "" && others > 0 ? others : "-",
          Total: boys !== "" && girls !== "" ? boys + girls + (others || 0) : "-",
          "Male Count": row.enteredMale !== undefined && row.enteredMale !== "" ? Number(row.enteredMale) : "-",
          "Female Count": row.enteredFemale !== undefined && row.enteredFemale !== "" ? Number(row.enteredFemale) : "-",
        };
      });
      // Other row (unrecognized class)
      const otherRowXls = ctd["_other"] || {};
      if ((otherRowXls.total || 0) > 0) {
        classRows.push({
          Class: "Other",
          Boys: otherRowXls.boys || 0,
          Girls: otherRowXls.girls || 0,
          Others: otherRowXls.others || 0,
          Total: otherRowXls.total,
          "Male Count": otherRowXls.enteredMale !== undefined && otherRowXls.enteredMale !== "" ? Number(otherRowXls.enteredMale) : "-",
          "Female Count": otherRowXls.enteredFemale !== undefined && otherRowXls.enteredFemale !== "" ? Number(otherRowXls.enteredFemale) : "-",
        });
      }
      // Total row — authoritative counts from madrasaStudents
      const tb = madrasaStudents.filter(
        (s) => normalizeGender(s?.gender || s?.sex || "") === "male",
      ).length;
      const tg = madrasaStudents.filter(
        (s) => normalizeGender(s?.gender || s?.sex || "") === "female",
      ).length;
      const to = madrasaStudents.filter((s) => {
        const g = normalizeGender(s?.gender || s?.sex || "");
        return g !== "male" && g !== "female";
      }).length;
      const tt = madrasaStudents.length;

      const totalEnteredMale = Object.values(ctd).reduce(
        (sum, r) => sum + (r.enteredMale ? Number(r.enteredMale) : 0),
        0
      );
      const totalEnteredFemale = Object.values(ctd).reduce(
        (sum, r) => sum + (r.enteredFemale ? Number(r.enteredFemale) : 0),
        0
      );

      classRows.push({
        Class: "Total",
        Boys: tb || "-",
        Girls: tg || "-",
        Others: to || "-",
        Total: tt || "-",
        "Male Count": totalEnteredMale,
        "Female Count": totalEnteredFemale,
      });

      const studentsSheet = XLSX.utils.json_to_sheet(classRows);
      const teachersSheet = XLSX.utils.json_to_sheet(
        madrasaTeachers.map((t) => ({
          Name: safeTeacherName(t),
          Phone: safeTeacherPhone(t),
          Qualification: safeTeacherQualification(t),
        })),
      );

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, studentsSheet, "Student Summary");
      XLSX.utils.book_append_sheet(workbook, teachersSheet, "Teachers");
      XLSX.writeFile(
        workbook,
        `${getMadrasaExportBaseName()}_madrasa_data_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
      toast.success("Excel exported");
    } catch (error) {
      console.error("Excel export failed:", error);
      toast.error("Failed to export Excel");
    } finally {
      setExportingMadrasaExcel(false);
    }
  };

  const normalizeInventoryItem = (it) => {
    const name =
      it?.name || it?.itemName || it?.title || it?.assetName || it?.label || "";
    const quantity =
      it?.quantity ?? it?.count ?? it?.qty ?? it?.stock ?? it?.units ?? "";
    const condition = it?.condition || it?.status || it?.state || "";
    const remarks = it?.remarks || it?.note || it?.notes || "";
    return { name, quantity, condition, remarks };
  };

  const downloadInventoryPdf = async () => {
    if (!formData.selectedMadarsaId) return;
    setExportingInventoryPdf(true);
    try {
      const doc = new jsPDF();
      const title = `Inventory Registry - ${formData.madarsaName || ""} (${formData.selectedMadarsaId})`;
      doc.setFontSize(13);
      doc.text(title, 14, 16);

      const reg = formData.inventoryRegistry || {};
      const customFields = Array.isArray(formData.customInventoryFields)
        ? formData.customInventoryFields
        : [];
      const allItems = [...INVENTORY_ITEMS, ...customFields];
      const rows = allItems.map((item) => [
        item.label,
        reg[item.key] !== undefined && reg[item.key] !== ""
          ? String(reg[item.key])
          : "-",
      ]);

      autoTable(doc, {
        startY: 22,
        head: [["Item", "Count"]],
        body: rows,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [0, 128, 128] },
        columnStyles: { 1: { halign: "center", cellWidth: 40 } },
      });

      doc.save(
        `${getMadrasaExportBaseName()}_inventory_${new Date().toISOString().split("T")[0]}.pdf`,
      );
      toast.success("PDF downloaded");
    } catch (error) {
      console.error("Inventory PDF export failed:", error);
      toast.error("Failed to download PDF");
    } finally {
      setExportingInventoryPdf(false);
    }
  };

  const exportInventoryExcel = async () => {
    if (!formData.selectedMadarsaId) return;
    setExportingInventoryExcel(true);
    try {
      const reg = formData.inventoryRegistry || {};
      const customFields = Array.isArray(formData.customInventoryFields)
        ? formData.customInventoryFields
        : [];
      const allItems = [...INVENTORY_ITEMS, ...customFields];
      const rows = allItems.map((item) => ({
        Item: item.label,
        Count:
          reg[item.key] !== undefined && reg[item.key] !== ""
            ? reg[item.key]
            : "-",
      }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Inventory");
      XLSX.writeFile(
        workbook,
        `${getMadrasaExportBaseName()}_inventory_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
      toast.success("Excel exported");
    } catch (error) {
      console.error("Inventory Excel export failed:", error);
      toast.error("Failed to export Excel");
    } finally {
      setExportingInventoryExcel(false);
    }
  };

  const submitInspection = async () => {
    // Validate inspector selfie before submission
    if (!inspectorSelfieUrl) {
      toast.error("Inspector selfie is required before submission");
      return;
    }

    setSubmitting(true);
    try {
      const phone = userData.phone || userData.adminPhone || userData.phoneNumber || "000";
      const phoneDigits = String(phone).replace(/\D/g, "");
      const last3 = phoneDigits.length >= 3 ? phoneDigits.slice(-3) : "000";
      const madarsaIdentifier = formData.madarsaId || formData.selectedMadarsaId || "UNKNOWN";
      
      const rawCleanId = madarsaIdentifier.replace(/^mid-/i, "");
      const cleanMadarsaId = /^\d+$/.test(rawCleanId) ? rawCleanId.padStart(3, "0") : rawCleanId;
      const rawFormattedId = `INS-${cleanMadarsaId}-${last3}`.toUpperCase();
      const generatedReportId = rawFormattedId.replace(/INS-(?:MID-)?(\d+)-(\d+)/i, (match, mId, last) => `INS-${mId.padStart(3, "0")}-${last.padStart(3, "0")}`);

      const inspectionData = {
        ...formData,
        reportId: generatedReportId,
        status: "submitted",
        inspectorId: user.uid,
        inspectorName: userData.name || userData.fullName,
        inspectorSelfieUrl: inspectorSelfieUrl, // Include inspector selfie
        sessionStartedAt: await (async () => {
          // Always fetch the live user doc so we get the real session start,
          // not the stale cached value in userData.
          try {
            const freshUserDoc = await getDoc(doc(db, "users", user.uid));
            if (freshUserDoc.exists()) {
              const ud = freshUserDoc.data();
              const raw = ud?.sessionStartTime;
              if (raw) {
                return raw?.toDate?.() || new Date(raw);
              }
            }
          } catch (_) {
            // fallback to cached value
          }
          return userData?.sessionStartTime
            ? new Date(userData.sessionStartTime)
            : null;
        })(),
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (draftId) {
        await updateDoc(doc(db, "inspections", draftId), inspectionData);
      } else {
        inspectionData.createdAt = serverTimestamp();
        await addDoc(collection(db, "inspections"), inspectionData);
      }

      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error submitting inspection:", error);
      toast.error("Failed to submit inspection");
    } finally {
      setSubmitting(false);
    }
  };

  const previewFile = (file) => {
    setPreviewModal({ open: true, file });
  };

  const renderFileUploadSection = (step, title) => {
    const stepKey = `${step}FormFiles`;
    const remarksKey = `${step}FormRemarks`;
    const files = formData[stepKey] || [];
    const isUploading = uploadingFiles[step];

    return (
      <div className="space-y-6">
        {/* File Upload */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Label className="text-base font-semibold">
              Documents & Images
            </Label>
            <Button
              type="button"
              variant="outline"
              onClick={() => openQrUpload(step)}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              <QrCode className="h-4 w-4 mr-2" />
              QR Upload
            </Button>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Upload images (JPG/PNG) or PDF files. Multiple files allowed.
          </p>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <input
              type="file"
              id={`files-${step}`}
              multiple
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => handleFileUpload(e.target.files, step)}
              className="hidden"
              disabled={isUploading}
            />
            <label
              htmlFor={`files-${step}`}
              className="cursor-pointer flex flex-col items-center space-y-2"
            >
              {isUploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              ) : (
                <>
                  <Upload className="h-8 w-8 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">
                    Click to upload files
                  </span>
                  <span className="text-xs text-gray-500">
                    Or drag and drop • JPG, PNG, PDF up to 10MB each
                  </span>
                </>
              )}
            </label>
          </div>

          {/* Uploaded Files */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <Label className="text-sm font-medium">
                Uploaded Files ({files.length})
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50 hover:bg-gray-100"
                  >
                    <div className="flex-shrink-0">
                      {(file.type || "").startsWith("image/") ? (
                        <div className="w-10 h-10 relative">
                          <Image
                            src={file.url}
                            alt={file.name}
                            fill
                            className="object-cover rounded"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center">
                          <FileText className="h-5 w-5 text-red-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => previewFile(file)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(step, index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Remarks */}
        <div>
          <Label
            htmlFor={`remarks-${step}`}
            className="text-base font-semibold"
          >
            Remarks & Observations
          </Label>
          <p className="text-sm text-gray-600 mb-2">
            Add your detailed observations and remarks for this section.
          </p>
          <Textarea
            id={`remarks-${step}`}
            value={formData[remarksKey] || ""}
            onChange={(e) => updateFormData({ [remarksKey]: e.target.value })}
            placeholder="Enter your detailed remarks and observations here..."
            className="min-h-[120px]"
          />
        </div>
      </div>
    );
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

  return (
    <InspectorLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">
              Resume Inspection
            </h1>
            <p className="text-gray-600">
              Complete the multi-step inspection process
            </p>
          </div>
          <Badge variant="outline" className="text-blue-600 border-blue-200">
            Step {currentStep} of 7
          </Badge>
        </div>

        {/* Progress Steps */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => {
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                const Icon = step.icon;

                return (
                  <div key={step.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                          isCompleted
                            ? "bg-green-100 border-green-500 text-green-700"
                            : isActive
                              ? "bg-blue-100 border-blue-500 text-blue-700"
                              : "bg-gray-100 border-gray-300 text-gray-400"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>
                      <span
                        className={`mt-2 text-xs font-medium text-center max-w-20 ${
                          isActive ? "text-blue-700" : "text-gray-500"
                        }`}
                      >
                        {step.title}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-px mx-4 ${
                          isCompleted ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {React.createElement(STEPS[currentStep - 1].icon, {
                className: "h-5 w-5",
              })}
              {STEPS[currentStep - 1].title}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 &&
                "Enter basic information about the inspection"}
              {currentStep === 2 &&
                "Upload documents and add remarks for Madrasa evaluation"}
              {currentStep === 3 &&
                "Upload documents and add remarks for Management assessment"}
              {currentStep === 4 &&
                "Upload documents and add remarks for Sadar information"}
              {currentStep === 5 &&
                "Review students and teachers data (export available)"}
              {currentStep === 6 && "Review inventory items (export available)"}
              {currentStep === 7 && "Review all information before submitting"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="madarsa">Select Madrasa *</Label>
                    <Select
                      value={formData.selectedMadarsaId}
                      onValueChange={(value) => {
                        const selectedMadarsa = madarsas.find(
                          (m) => m.madarsaId === value,
                        );
                        const name = selectedMadarsa?.name || "";
                        // Auto-fill title only when it's blank or was previously auto-generated
                        const shouldAutoFillTitle =
                          !formData.title ||
                          formData.title.startsWith("Inspection Report - ");
                        // Trigger student fetch via dedicated state
                        setSelectedMadarsaIdForFetch(value);
                        updateFormData({
                          selectedMadarsaId: value,
                          madarsaName: name,
                          ...(shouldAutoFillTitle && name
                            ? { title: `Inspection Report - ${name}` }
                            : {}),
                        });
                      }}
                    >
                      <SelectTrigger className="border-teal-200 hover:border-teal-300 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-teal-600 focus-visible:border-teal-600">
                        <SelectValue placeholder="Choose a madarsa to inspect" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {madarsas.map((madarsa, index) => (
                          <SelectItem
                            key={madarsa.id || `${madarsa.madarsaId}-${index}`}
                            value={madarsa.madarsaId}
                          >
                            {madarsa.name} ({madarsa.madarsaId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="inspectionDate">Inspection Date *</Label>
                    <Input
                      id="inspectionDate"
                      type="date"
                      value={formData.inspectionDate}
                      onChange={(e) =>
                        updateFormData({ inspectionDate: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="inspectionType">Inspection Type</Label>
                    <Select
                      value={formData.inspectionType}
                      onValueChange={(value) =>
                        updateFormData({ inspectionType: value })
                      }
                    >
                      <SelectTrigger className="border-teal-200 hover:border-teal-300 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-teal-600 focus-visible:border-teal-600">
                        <SelectValue placeholder="Select inspection type" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="routine">
                          Routine Inspection
                        </SelectItem>
                        <SelectItem value="follow_up">
                          Follow-up Inspection
                        </SelectItem>
                        <SelectItem value="complaint">
                          Complaint-based Inspection
                        </SelectItem>
                        <SelectItem value="special">
                          Special Inspection
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="title">Inspection Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        updateFormData({ title: e.target.value })
                      }
                      placeholder="Enter a descriptive title for this inspection"
                    />
                  </div>
                </div>

                {formData.selectedMadarsaId && (
                  <Alert>
                    <Building className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Selected Madrasa:</strong> {formData.madarsaName}{" "}
                      ({formData.selectedMadarsaId})
                      <br />
                      <strong>Inspection Date:</strong>{" "}
                      {new Date(formData.inspectionDate).toLocaleDateString()}
                      <br />
                      <strong>Type:</strong>{" "}
                      {formData.inspectionType?.replace("_", " ").toUpperCase()}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Step 2: Madarsa Form */}
            {currentStep === 2 &&
              renderFileUploadSection("madarsa", "Madarsa Form")}

            {/* Step 3: Management Form */}
            {currentStep === 3 &&
              renderFileUploadSection("management", "Management Form")}

            {/* Step 4: Sadar Info Form */}
            {currentStep === 4 &&
              renderFileUploadSection("sadar", "Sadar Info Form")}

            {/* Step 5: Madrasa Data */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      Total Students: {madrasaStudents.length} • Teachers:{" "}
                      {madrasaTeachers.length}
                    </p>
                    {madrasaDataLoading && (
                      <p className="text-sm text-gray-500">
                        Loading madrasa data...
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={downloadMadrasaDataPdf}
                      disabled={
                        exportingMadrasaPdf ||
                        exportingMadrasaExcel ||
                        madrasaDataLoading ||
                        !formData.selectedMadarsaId
                      }
                      className="w-full sm:w-auto"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {exportingMadrasaPdf ? "Downloading..." : "Download PDF"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={exportMadrasaDataExcel}
                      disabled={
                        exportingMadrasaExcel ||
                        exportingMadrasaPdf ||
                        madrasaDataLoading ||
                        !formData.selectedMadarsaId
                      }
                      className="w-full sm:w-auto"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {exportingMadrasaExcel ? "Exporting..." : "Export Excel"}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* LEFT: Class-wise student summary table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Student Summary</CardTitle>
                      <CardDescription>
                        Boys &amp; Girls auto-counted from student records. Only
                        Remarks is editable.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-gray-50">
                            <TableRow>
                              <TableHead className="text-xs font-semibold">
                                Class
                              </TableHead>
                              <TableHead className="text-xs font-semibold text-center">
                                Boys
                              </TableHead>
                              <TableHead className="text-xs font-semibold text-center">
                                Girls
                              </TableHead>
                              <TableHead className="text-xs font-semibold text-center">
                                Others
                              </TableHead>
                              <TableHead className="text-xs font-semibold text-center">
                                Total
                              </TableHead>
                              <TableHead className="text-xs font-semibold text-center">
                                Male Count
                              </TableHead>
                              <TableHead className="text-xs font-semibold text-center">
                                Female Count
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {CLASS_LIST.map((cls) => {
                              const row =
                                (formData.classTableData || {})[cls] || {};
                              const boys = row.boys ?? "";
                              const girls = row.girls ?? "";
                              const others = row.others ?? "";
                              const total =
                                boys !== "" && girls !== ""
                                  ? Number(boys) + Number(girls) + Number(others || 0)
                                  : "-";
                              const updateRow = (field, val) =>
                                updateFormData({
                                  classTableData: {
                                    ...(formData.classTableData || {}),
                                    [cls]: {
                                      ...(formData.classTableData?.[cls] || {}),
                                      [field]: val,
                                    },
                                  },
                                });
                              return (
                                <TableRow key={cls}>
                                  <TableCell className="font-medium text-sm py-1">
                                    {cls}
                                  </TableCell>
                                  <TableCell className="py-1 text-sm text-center">
                                    {boys !== "" ? boys : "-"}
                                  </TableCell>
                                  <TableCell className="py-1 text-sm text-center">
                                    {girls !== "" ? girls : "-"}
                                  </TableCell>
                                  <TableCell className="py-1 text-sm text-center text-amber-600">
                                    {others !== "" ? others : "-"}
                                  </TableCell>
                                  <TableCell className="py-1 text-sm font-medium text-center">
                                    {total}
                                  </TableCell>
                                  <TableCell className="py-1 text-center">
                                    <input
                                      type="number"
                                      min="0"
                                      value={row.enteredMale ?? ""}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === "" || /^\d+$/.test(v)) {
                                          updateRow("enteredMale", v);
                                        }
                                      }}
                                      className="w-20 h-7 border border-teal-200 rounded px-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                      placeholder="—"
                                    />
                                  </TableCell>
                                  <TableCell className="py-1 text-center">
                                    <input
                                      type="number"
                                      min="0"
                                      value={row.enteredFemale ?? ""}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === "" || /^\d+$/.test(v)) {
                                          updateRow("enteredFemale", v);
                                        }
                                      }}
                                      className="w-20 h-7 border border-teal-200 rounded px-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                      placeholder="—"
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {/* Other row — students with unrecognized class value */}
                            {(() => {
                              const other =
                                (formData.classTableData || {})["_other"] || {};
                              const otherTotal = other.total || 0;
                              if (otherTotal === 0) return null;
                              const ob = other.boys || 0;
                              const og = other.girls || 0;
                              return (
                                <TableRow className="bg-amber-50">
                                  <TableCell className="text-sm py-1 text-amber-700 font-medium">
                                    Other
                                  </TableCell>
                                  <TableCell className="text-sm text-center py-1">
                                    {ob > 0 ? ob : "-"}
                                  </TableCell>
                                  <TableCell className="text-sm text-center py-1">
                                    {og > 0 ? og : "-"}
                                  </TableCell>
                                  <TableCell className="text-sm text-center py-1 font-medium">
                                    {otherTotal}
                                  </TableCell>
                                  <TableCell className="py-1 text-center">
                                    <input
                                      type="number"
                                      min="0"
                                      value={other.enteredMale ?? ""}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === "" || /^\d+$/.test(v)) {
                                          setFormData((prev) => ({
                                            ...prev,
                                            classTableData: {
                                              ...(prev.classTableData || {}),
                                              _other: {
                                                ...(prev.classTableData?.["_other"] || {}),
                                                enteredMale: v,
                                              },
                                            },
                                          }));
                                        }
                                      }}
                                      className="w-20 h-7 border border-amber-200 rounded px-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                                      placeholder="—"
                                    />
                                  </TableCell>
                                  <TableCell className="py-1 text-center">
                                    <input
                                      type="number"
                                      min="0"
                                      value={other.enteredFemale ?? ""}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === "" || /^\d+$/.test(v)) {
                                          setFormData((prev) => ({
                                            ...prev,
                                            classTableData: {
                                              ...(prev.classTableData || {}),
                                              _other: {
                                                ...(prev.classTableData?.["_other"] || {}),
                                                enteredFemale: v,
                                              },
                                            },
                                          }));
                                        }
                                      }}
                                      className="w-20 h-7 border border-amber-200 rounded px-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                                      placeholder="—"
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })()}
                            {/* Total row — use madrasaStudents as authoritative source */}
                            {(() => {
                              const tb = madrasaStudents.filter(
                                (s) =>
                                  normalizeGender(s?.gender || s?.sex || "") ===
                                  "male",
                              ).length;
                              const tg = madrasaStudents.filter(
                                (s) =>
                                  normalizeGender(s?.gender || s?.sex || "") ===
                                  "female",
                              ).length;
                              const tt = madrasaStudents.length;

                              const totalEnteredMale = Object.values(formData.classTableData || {}).reduce(
                                (sum, r) => sum + (r.enteredMale ? Number(r.enteredMale) : 0),
                                0
                              );
                              const totalEnteredFemale = Object.values(formData.classTableData || {}).reduce(
                                (sum, r) => sum + (r.enteredFemale ? Number(r.enteredFemale) : 0),
                                0
                              );

                              const to = tt - tb - tg;
                              return (
                                <TableRow className="bg-gray-50 font-bold">
                                  <TableCell className="text-sm font-bold py-1">
                                    Total
                                  </TableCell>
                                  <TableCell className="text-sm text-center py-1">
                                    {tb > 0 ? tb : "-"}
                                  </TableCell>
                                  <TableCell className="text-sm text-center py-1">
                                    {tg > 0 ? tg : "-"}
                                  </TableCell>
                                  <TableCell className="text-sm text-center py-1 text-amber-600">
                                    {to > 0 ? to : "-"}
                                  </TableCell>
                                  <TableCell className="text-sm text-center py-1 font-bold">
                                    {tt > 0 ? tt : "-"}
                                  </TableCell>
                                  <TableCell className="text-sm text-center py-1 font-bold text-blue-600">
                                    {totalEnteredMale}
                                  </TableCell>
                                  <TableCell className="text-sm text-center py-1 font-bold text-blue-600">
                                    {totalEnteredFemale}
                                  </TableCell>
                                </TableRow>
                              );
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* RIGHT: Teachers */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle>
                          Teachers ({madrasaTeachers.length})
                        </CardTitle>
                        {madrasaTeachers.length > 0 && (
                          <div className="flex gap-3 text-xs text-gray-500">
                            <span>
                              Male:{" "}
                              {
                                madrasaTeachers.filter(
                                  (t) =>
                                    (t.gender || "").toLowerCase() === "male",
                                ).length
                              }
                            </span>
                            <span>
                              Female:{" "}
                              {
                                madrasaTeachers.filter(
                                  (t) =>
                                    (t.gender || "").toLowerCase() === "female",
                                ).length
                              }
                            </span>
                          </div>
                        )}
                      </div>
                      <CardDescription>
                        Teacher list for selected madrasa
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {madrasaDataLoading ? (
                        <p className="text-sm text-gray-400 animate-pulse">
                          Loading teachers…
                        </p>
                      ) : madrasaTeachers.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          No teachers found
                        </p>
                      ) : (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="max-h-[420px] overflow-y-auto">
                            <Table>
                              <TableHeader className="sticky top-0 bg-gray-50 z-10">
                                <TableRow>
                                  <TableHead className="w-8">#</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>MHR ID</TableHead>
                                  <TableHead>Phone</TableHead>
                                  <TableHead>Qualification</TableHead>
                                  <TableHead>Moallim Training</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {madrasaTeachers.map((t, idx) => (
                                  <TableRow
                                    key={t.id}
                                    className="hover:bg-gray-50"
                                  >
                                    <TableCell className="text-gray-400 text-xs">
                                      {idx + 1}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      <div>{safeTeacherName(t) || "—"}</div>
                                      {t.email && (
                                        <div className="text-xs text-gray-400 truncate max-w-[140px]">
                                          {t.email}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-xs font-mono">
                                      {t.mhrId || t.teacherId || "—"}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {safeTeacherPhone(t) || "—"}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      <div>
                                        {safeTeacherQualification(t) || "—"}
                                      </div>
                                      {t.degree && (
                                        <div className="text-xs text-gray-400">
                                          {t.degree}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {t.moallimTraining ? (
                                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-600/20">
                                          Yes
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                                          No
                                        </span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Step 6: Inventory */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      Enter the count for each inventory register / book.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={downloadInventoryPdf}
                      disabled={
                        exportingInventoryPdf ||
                        exportingInventoryExcel ||
                        !formData.selectedMadarsaId
                      }
                      className="w-full sm:w-auto"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {exportingInventoryPdf
                        ? "Downloading..."
                        : "Download PDF"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={exportInventoryExcel}
                      disabled={
                        exportingInventoryExcel ||
                        exportingInventoryPdf ||
                        !formData.selectedMadarsaId
                      }
                      className="w-full sm:w-auto"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {exportingInventoryExcel
                        ? "Exporting..."
                        : "Export Excel"}
                    </Button>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Inventory Registry</CardTitle>
                    <CardDescription>
                      Enter the available count for each item
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-5">
                      {[
                        ...INVENTORY_ITEMS,
                        ...(Array.isArray(formData.customInventoryFields)
                          ? formData.customInventoryFields
                          : []),
                      ].map((item) => (
                        <div key={item.key} className="flex items-center gap-4">
                          <Label className="w-44 text-sm font-semibold text-gray-700 shrink-0">
                            {item.label}
                          </Label>
                          <div className="flex items-center gap-4 flex-wrap flex-1">
                            <div className="flex items-center gap-4 shrink-0">
                              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={formData.inventoryRegistry?.[item.key] === "YES"}
                                  onChange={() =>
                                    updateFormData({
                                      inventoryRegistry: {
                                        ...(formData.inventoryRegistry || {}),
                                        [item.key]: formData.inventoryRegistry?.[item.key] === "YES" ? "" : "YES",
                                      },
                                    })
                                  }
                                  className="h-4 w-4 rounded border-teal-300 text-teal-600 focus:ring-teal-500"
                                />
                                YES
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={formData.inventoryRegistry?.[item.key] === "NO"}
                                  onChange={() =>
                                    updateFormData({
                                      inventoryRegistry: {
                                        ...(formData.inventoryRegistry || {}),
                                        [item.key]: formData.inventoryRegistry?.[item.key] === "NO" ? "" : "NO",
                                      },
                                    })
                                  }
                                  className="h-4 w-4 rounded border-teal-300 text-teal-600 focus:ring-teal-500"
                                />
                                NO
                              </label>
                            </div>
                            <Input
                              type="number"
                              min="0"
                              placeholder="Count"
                              className="w-24 h-8"
                              value={formData.inventoryRegistry?.[`${item.key}_count`] || ""}
                              onChange={(e) =>
                                updateFormData({
                                  inventoryRegistry: {
                                    ...(formData.inventoryRegistry || {}),
                                    [`${item.key}_count`]: e.target.value,
                                  },
                                })
                              }
                            />
                            <Input
                              type="text"
                              placeholder="Remark"
                              className="flex-1 h-8 min-w-[150px]"
                              value={formData.inventoryRegistry?.[`${item.key}_remark`] || ""}
                              onChange={(e) =>
                                updateFormData({
                                  inventoryRegistry: {
                                    ...(formData.inventoryRegistry || {}),
                                    [`${item.key}_remark`]: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          {/* Allow removing custom fields */}
                          {!INVENTORY_ITEMS.some((i) => i.key === item.key) && (
                            <button
                              type="button"
                              className="text-red-400 hover:text-red-600 ml-1"
                              title="Remove field"
                              onClick={() =>
                                updateFormData({
                                  customInventoryFields: (
                                    formData.customInventoryFields || []
                                  ).filter((f) => f.key !== item.key),
                                  inventoryRegistry: Object.fromEntries(
                                    Object.entries(
                                      formData.inventoryRegistry || {},
                                    ).filter(([k]) => k !== item.key),
                                  ),
                                })
                              }
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Add custom field row */}
                      {addingNewField ? (
                        <div className="flex items-center gap-3 pt-2 border-t">
                          <input
                            autoFocus
                            type="text"
                            value={newFieldLabel}
                            onChange={(e) => setNewFieldLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const label = newFieldLabel.trim();
                                if (!label) return;
                                const key =
                                  "custom_" +
                                  label
                                    .toLowerCase()
                                    .replace(/\s+/g, "_")
                                    .replace(/[^a-z0-9_]/g, "") +
                                  "_" +
                                  Date.now();
                                updateFormData({
                                  customInventoryFields: [
                                    ...(formData.customInventoryFields || []),
                                    { key, label: label.toUpperCase() },
                                  ],
                                });
                                setNewFieldLabel("");
                                setAddingNewField(false);
                              }
                              if (e.key === "Escape") {
                                setNewFieldLabel("");
                                setAddingNewField(false);
                              }
                            }}
                            placeholder="Field name (e.g. Fee Register)"
                            className="flex-1 h-9 border border-teal-300 rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                          />
                          <button
                            type="button"
                            title="Add field"
                            className="h-9 w-9 flex items-center justify-center rounded-md bg-teal-600 text-white hover:bg-teal-700"
                            onClick={() => {
                              const label = newFieldLabel.trim();
                              if (!label) return;
                              const key =
                                "custom_" +
                                label
                                  .toLowerCase()
                                  .replace(/\s+/g, "_")
                                  .replace(/[^a-z0-9_]/g, "") +
                                "_" +
                                Date.now();
                              updateFormData({
                                customInventoryFields: [
                                  ...(formData.customInventoryFields || []),
                                  { key, label: label.toUpperCase() },
                                ],
                              });
                              setNewFieldLabel("");
                              setAddingNewField(false);
                            }}
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            title="Cancel"
                            className="h-9 w-9 flex items-center justify-center rounded-md border text-gray-500 hover:bg-gray-100"
                            onClick={() => {
                              setNewFieldLabel("");
                              setAddingNewField(false);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingNewField(true)}
                          className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 pt-2 border-t w-full"
                        >
                          <span className="flex items-center justify-center h-6 w-6 rounded-full border border-teal-500 text-lg leading-none">
                            +
                          </span>
                          Add custom field
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 7: Review & Submit */}
            {currentStep === 7 && (
              <div className="space-y-6">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please review all information below before submitting your
                    inspection report.
                  </AlertDescription>
                </Alert>

                {/* Basic Information Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-500">Madrasa</Label>
                      <p className="font-medium">{formData.madarsaName}</p>
                      <p className="text-sm text-gray-600">
                        {formData.selectedMadarsaId}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">
                        Inspection Date
                      </Label>
                      <p className="font-medium">
                        {new Date(formData.inspectionDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Type</Label>
                      <p className="font-medium capitalize">
                        {formData.inspectionType?.replace("_", " ")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Title</Label>
                      <p className="font-medium">{formData.title}</p>
                    </div>
                  </CardContent>
                </Card>

                {[
                  { step: "madarsa", title: "Madrasa Form" },
                  { step: "management", title: "Management Form" },
                  { step: "sadar", title: "Sadar Info Form" },
                ].map(({ step, title }) => {
                  const files = formData[`${step}FormFiles`] || [];
                  const remarks = formData[`${step}FormRemarks`] || "";

                  return (
                    <Card key={step}>
                      <CardHeader>
                        <CardTitle className="text-lg">{title}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label className="text-sm text-gray-500">
                            Uploaded Files ({files.length})
                          </Label>
                          {files.length > 0 ? (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {files.map((file, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 p-2 border rounded text-sm"
                                >
                                  {(file.type || "").startsWith("image/") ? (
                                    <div className="w-8 h-8 relative">
                                      <Image
                                        src={file.url}
                                        alt={file.name}
                                        fill
                                        className="object-cover rounded"
                                      />
                                    </div>
                                  ) : (
                                    <FileText className="h-4 w-4 text-red-600" />
                                  )}
                                  <span className="truncate">{file.name}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => previewFile(file)}
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 mt-2">
                              No files uploaded
                            </p>
                          )}
                        </div>
                        <div>
                          <Label className="text-sm text-gray-500">
                            Remarks
                          </Label>
                          {remarks ? (
                            <div className="mt-2 p-3 bg-gray-50 rounded border">
                              <p className="text-sm whitespace-pre-wrap">
                                {remarks}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 mt-2">
                              No remarks added
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Madrasa Data Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Madrasa Data</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-500">Students</Label>
                      <p className="font-medium">{madrasaStudents.length}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Teachers</Label>
                      <p className="font-medium">{madrasaTeachers.length}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Inventory Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Inventory</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                      {[
                        ...INVENTORY_ITEMS,
                        ...(Array.isArray(formData.customInventoryFields)
                          ? formData.customInventoryFields
                          : []),
                      ].map((item) => {
                        const val = formData.inventoryRegistry?.[item.key];
                        const count = formData.inventoryRegistry?.[`${item.key}_count`];
                        const remark = formData.inventoryRegistry?.[`${item.key}_remark`];
                        return (
                          <div
                            key={item.key}
                            className="flex flex-col py-1.5 border-b border-gray-100"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">
                                {item.label}
                              </span>
                              <span className="font-medium text-sm">
                                {val !== undefined && val !== "" ? val : "-"}
                              </span>
                            </div>
                            {(count || remark) && (
                              <div className="flex flex-wrap gap-x-4 mt-0.5 text-xs text-gray-500">
                                {count && <span>Count: {count}</span>}
                                {remark && <span>Remark: {remark}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Inspector Selfie Requirement */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Camera className="h-5 w-5 text-teal-600" />
                      Inspector Verification *
                      <Badge variant="destructive" className="text-xs">
                        Required
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Please take a selfie to verify your identity before
                      submitting the inspection report. This is mandatory for
                      all inspection submissions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!inspectorSelfieUrl ? (
                      <div className="space-y-4">
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Required:</strong> Inspector selfie is
                            mandatory before submission. Please take a photo to
                            verify your identity.
                          </AlertDescription>
                        </Alert>
                        <PhotoCapture
                          onCapture={(url) => {
                            setInspectorSelfieUrl(url);
                            console.log("Inspector selfie captured:", url);
                            toast.success(
                              "Inspector selfie captured successfully!",
                            );
                          }}
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Alert>
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription>
                            Inspector selfie verified successfully! You can now
                            submit the inspection.
                          </AlertDescription>
                        </Alert>
                        <div className="flex items-center gap-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
                          <div className="w-16 h-16 relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={inspectorSelfieUrl}
                              alt="Inspector Selfie"
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-teal-800">
                              Selfie Captured
                            </p>
                            <p className="text-sm text-teal-600">
                              Inspector identity verified
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setInspectorSelfieUrl(null);
                              console.log("Inspector selfie reset for retake");
                              toast.info(
                                "Selfie cleared. Please take a new photo.",
                              );
                            }}
                            className="text-teal-600 border-teal-300 hover:bg-teal-50"
                          >
                            Retake
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={saving}
              className="flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Draft
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/inspector/inspections")}
            >
              Cancel
            </Button>

            {currentStep < 7 ? (
              <Button
                onClick={nextStep}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {currentStep === 6 ? "Review" : "Next"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={submitInspection}
                disabled={submitting || !validateStep(currentStep)}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit Inspection
              </Button>
            )}
          </div>
        </div>

        {/* File Preview Modal */}
        <Dialog
          open={previewModal.open}
          onOpenChange={(open) => setPreviewModal({ open, file: null })}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle>File Preview</DialogTitle>
              <DialogDescription>{previewModal.file?.name}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-center">
              {(previewModal.file?.type || "").startsWith("image/") ? (
                <div className="relative max-w-full max-h-[70vh]">
                  <Image
                    src={previewModal.file?.url}
                    alt={previewModal.file?.name}
                    width={800}
                    height={600}
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center w-full space-y-3">
                  <iframe
                    src={previewModal.file?.url}
                    title={previewModal.file?.name}
                    className="w-full rounded border"
                    style={{ height: "65vh", minHeight: 400 }}
                  />
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={previewModal.file?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open in New Tab
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* QR Upload Modal */}
        <Dialog
          open={qrModal.open}
          onOpenChange={(open) =>
            setQrModal((prev) => ({
              ...prev,
              open,
              step: open ? prev.step : null,
            }))
          }
        >
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Upload from Mobile</DialogTitle>
              <DialogDescription>
                Scan this QR code with your phone to upload files for{" "}
                <span className="font-medium">
                  {qrModal.step === "madarsa"
                    ? "Madrasa Form"
                    : qrModal.step === "management"
                      ? "Management Form"
                      : qrModal.step === "sadar"
                        ? "Sadar Info/Form"
                        : "this step"}
                </span>
                .
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4">
              {qrModal.url ? (
                <QRCodeCanvas value={qrModal.url} size={220} includeMargin />
              ) : (
                <div className="text-sm text-gray-500">Generating QR…</div>
              )}

              <p className="w-full text-xs text-gray-500 text-center">
                Keep this page open on desktop; uploads will appear
                automatically.
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Success Modal */}
        <Dialog open={showSuccessModal} onOpenChange={(open) => {
          if (!open) {
            setShowSuccessModal(false);
            router.push("/dashboard/inspector/inspections");
          }
        }}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 mb-4">
                <CheckCircle className="h-6 w-6 text-teal-600" />
              </div>
              <DialogTitle className="text-xl text-center text-gray-900 font-semibold mb-2">
                Success
              </DialogTitle>
              <DialogDescription className="text-center text-gray-600 text-base">
                Report has been successfully submitted
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center mt-6">
              <Button 
                onClick={() => {
                  setShowSuccessModal(false);
                  router.push("/dashboard/inspector/inspections");
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white min-w-[120px]"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </InspectorLayout>
  );
}

export default function CreateInspectionPage() {
  return (
    <Suspense fallback={
      <InspectorLayout>
        <div className="p-6">
          <div className="text-center py-8">Loading...</div>
        </div>
      </InspectorLayout>
    }>
      <CreateInspectionContent />
    </Suspense>
  );
}
