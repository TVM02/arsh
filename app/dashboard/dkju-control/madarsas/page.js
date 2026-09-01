"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Search,
  Settings, // Re-added as it's used in stats
  Download,
  Eye,
  Edit,
  Trash2,
  Building,
  Users,
  MapPin,
  Upload,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  deleteDoc,
  addDoc,
  updateDoc,
  where,
  limit,
  startAfter,
  getCountFromServer,
  startAt,
  endAt,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { authFetch } from "@/lib/authFetch";

const cleanMadrasaField = (value) => {
  const text = String(value ?? "").trim();
  if (!text || ["null", "undefined", "n/a", "na"].includes(text.toLowerCase())) {
    return "";
  }
  return text;
};

const pickMadrasaPhone = (primary, fallback) =>
  cleanMadrasaField(primary) || cleanMadrasaField(fallback);

export default function CentralAdminMadrassasPage() {
  const { user, userData } = useAuthStore();
  const [madrasas, setMadrassas] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [mekhalas, setMekhalas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchSummary, setActiveSearchSummary] = useState("");

  // Server-side pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  // pageTokens[0] is always null (for page 1)
  // pageTokens[1] is the last doc of page 1 (used to get page 2)
  // pageTokens[2] is the last doc of page 2 (used to get page 3)
  const [pageTokens, setPageTokens] = useState([null]);
  const pageTokensRef = useRef(pageTokens);
  const currentPageRef = useRef(currentPage);

  // (debounced search effect moved to after searchMadrassas declaration)

  useEffect(() => {
    pageTokensRef.current = pageTokens;
  }, [pageTokens]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Search states
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Cache for student/teacher counts
  const [countsCache, setCountsCache] = useState(new Map());
  const countsCacheRef = useRef(countsCache);

  useEffect(() => {
    countsCacheRef.current = countsCache;
  }, [countsCache]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExcelDialogOpen, setIsExcelDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [madrasaToDelete, setMadrasaToDelete] = useState(null);
  const [editingMadrassa, setEditingMadrassa] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [excelData, setExcelData] = useState([]);
  const [mappedData, setMappedData] = useState([]);
  const [previewStartId, setPreviewStartId] = useState(500);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const initialFormData = {
    name: "",
    address: "",
    district: "",
    mekhala: "",
    madarsaId: "",
    managerName: "",
    managerPosition: "Others",
    phone: "",
    email: "",
    adminName: "",
    adminEmail: "",
    adminPhone: "",
    adminPassword: "",
    managerPassword: "",
    capacity: "",
    established: "",
    description: "",
    status: "active",
  };
  const [formData, setFormData] = useState(initialFormData);

  // State for district search in form
  const [districtSearch, setDistrictSearch] = useState("");
  const [mekhalaSearch, setMekhalaSearch] = useState("");
  const [mappingLoader, setMappingLoader] = useState(false);

  // MID-related state
  const [midExists, setMidExists] = useState(false);
  const [checkingMid, setCheckingMid] = useState(false);
  const [autoGeneratedMid, setAutoGeneratedMid] = useState("");

  // Function to reset the form
  const resetForm = () => {
    setFormData(initialFormData);
    setEditingMadrassa(null);
    setMidExists(false);
    setCheckingMid(false);
    setAutoGeneratedMid("");
    setDistrictSearch("");
    setMekhalaSearch("");
    setMappingLoader(false);
  };

  // Generate next MID using counter
  const generateNextMid = useCallback(async () => {
    try {
      const counterRef = doc(db, "counters", "madarsaIds");
      const counterDoc = await getDoc(counterRef);

      let nextId = 1001; // Default start

      if (counterDoc.exists()) {
        nextId = counterDoc.data().current + 1;
      } else {
        // Initialize if doesn't exist
        await initializeMidCounter();
        const newCounterDoc = await getDoc(counterRef);
        if (newCounterDoc.exists()) {
          nextId = newCounterDoc.data().current + 1;
        }
      }

      return `mid-${nextId}`;
    } catch (error) {
      console.error("Error generating next MID:", error);
      return `mid-${Date.now().toString().slice(-6)}`;
    }
  }, []); // Added empty dependency array

  // Auto-generate password when creating new madrasa
  useEffect(() => {
    if (!editingMadrassa) {
      // Show real-time password generation even with partial input
      if (formData.name || formData.address) {
        const name = formData.name || "madarsa";
        // Extract place from address (first part before comma) or use 'place' as default
        const place = formData.address
          ? formData.address.split(",")[0].trim()
          : "place";
        const autoPassword = generatePassword(name, place);
        setFormData((prev) => ({
          ...prev,
          adminPassword: autoPassword,
        }));
      } else {
        // Clear password when both fields are empty
        setFormData((prev) => ({
          ...prev,
          adminPassword: "",
        }));
      }
    }
  }, [formData.name, formData.address, editingMadrassa]);

  // Auto-generate MID when creating new madrasa (not editing)
  useEffect(() => {
    const generateMid = async () => {
      if (!editingMadrassa && !formData.madarsaId) {
        try {
          const newMid = await generateNextMid();
          setAutoGeneratedMid(newMid);
          setFormData((prev) => ({
            ...prev,
            madarsaId: newMid,
          }));
        } catch (error) {
          console.error("Error auto-generating MID:", error);
        }
      }
    };

    generateMid();
  }, [editingMadrassa, formData.madarsaId, generateNextMid]);

  // Initialize MID counter on component mount
  useEffect(() => {
    initializeMidCounter();
  }, []); // Added empty dependency array

  // Check MID uniqueness when user types
  useEffect(() => {
    const checkUniqueness = async () => {
      // If editing and the ID hasn't changed from the original, it's not a duplicate
      if (editingMadrassa && formData.madarsaId === editingMadrassa.madarsaId) {
        setMidExists(false);
        setCheckingMid(false);
        return;
      }

      if (formData.madarsaId && formData.madarsaId !== autoGeneratedMid) {
        setCheckingMid(true);
        const exists = await checkMidExists(formData.madarsaId);
        setMidExists(exists);
        setCheckingMid(false);
      } else {
        setMidExists(false);
        setCheckingMid(false);
      }
    };

    const timeoutId = setTimeout(checkUniqueness, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [formData.madarsaId, autoGeneratedMid, editingMadrassa]);

  // Fetch functions and other hooks must be before early return
  const loadCountsInBatches = useCallback(async (madrassasData) => {
  const batchSize = 5;
  const workingCache = new Map(countsCacheRef.current);

  for (let i = 0; i < madrassasData.length; i += batchSize) {
    const batch = madrassasData.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (madrassaData) => {
        const madrassaKey =
          madrassaData.madarsaId || madrassaData.id;

        if (workingCache.has(madrassaKey)) {
          return;
        }

        try {
          // 1. Approved / active students
          const studentsQuery = query(
            collection(db, "students"),
            where("madarsaId", "==", madrassaKey)
          );

          // 2. Pending admission applications
          const pendingQuery = query(
            collection(db, "admissions"),
            where("madarsa", "==", madrassaKey),
            where("status", "==", "pending")
          );

          // 3. Teachers
          const teachersQuery = query(
            collection(db, "teachers"),
            where("madarsaId", "==", madrassaKey)
          );

          const [
            studentsSnapshot,
            pendingSnapshot,
            teachersSnapshot,
          ] = await Promise.all([
            getDocs(studentsQuery),
            getDocs(pendingQuery),
            getDocs(teachersQuery),
          ]);

          // Approved students are stored as active students
          const approvedStudents =
            studentsSnapshot.docs.filter((doc) => {
              const data = doc.data();

              return (
                !data.deleted &&
                data.status === "active"
              );
            });

          // Pending applications
          const pendingStudents =
            pendingSnapshot.docs.filter((doc) => {
              const data = doc.data();

              return !data.deleted;
            });

          const activeTeachers =
            teachersSnapshot.docs.filter((doc) => {
              const data = doc.data();

              return (
                !data.deleted &&
                data.status !== "suspended" &&
                data.status !== "deleted"
              );
            });

          workingCache.set(madrassaKey, {
            studentCount: approvedStudents.length,
            approvedStudentCount: approvedStudents.length,
            pendingStudentCount: pendingStudents.length,
            teacherCount: activeTeachers.length,
          });
        } catch (error) {
          console.error(
            `Error fetching counts for ${madrassaKey}:`,
            error
          );

          workingCache.set(madrassaKey, {
            studentCount: 0,
            approvedStudentCount: 0,
            pendingStudentCount: 0,
            teacherCount: 0,
          });
        }
      })
    );

    setCountsCache((prev) => {
      const merged = new Map(prev);

      for (const [key, value] of workingCache.entries()) {
        merged.set(key, value);
      }

      return merged;
    });

    if (i + batchSize < madrassasData.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, 100)
      );
    }
  }
}, []);

  const isMadrasaStatusFilter = (value) =>
    ["active", "inactive", "suspended"].includes(value);

  const fetchPendingStudentMadrassas = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);

        // 1) Find all madrasas that currently have pending admission applications
        const pendingQuery = query(
          collection(db, "admissions"),
          where("status", "==", "pending"),
        );

        const pendingSnapshot = await getDocs(pendingQuery);
        const pendingMadrasaIds = new Set();

        pendingSnapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.madarsa && !data.deleted) {
            pendingMadrasaIds.add(String(data.madarsa).trim());
          }
        });

        if (pendingMadrasaIds.size === 0) {
          setMadrassas([]);
          setTotalItems(0);
          setTotalPages(0);
          setCurrentPage(1);
          return;
        }

        // 2) Load madrasas and keep only those whose MID occurs in pending admissions
        const madrasaSnapshot = await getDocs(
          query(collection(db, "madarsas"), orderBy("createdAt", "desc")),
        );

        let filteredMadrasas = madrasaSnapshot.docs
          .map((docSnap) => ({
            ...docSnap.data(),
            id: docSnap.id,
            _doc: docSnap,
          }))
          .filter((madrasa) =>
            pendingMadrasaIds.has(String(madrasa.madarsaId || "").trim()),
          );

        // 3) Keep the existing search box working while Pending Students is selected
        const search = (searchTerm || "").trim().toLowerCase();
        if (search) {
          filteredMadrasas = filteredMadrasas.filter((madrasa) => {
            const haystack = [
              madrasa.name,
              madrasa.madarsaId,
              madrasa.email,
              madrasa.phone,
              madrasa.district,
              madrasa.mekhala,
              madrasa.address,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return haystack.includes(search);
          });
        }

        // 4) Client-side pagination over the complete filtered result
        const total = filteredMadrasas.length;
        const pages = Math.ceil(total / itemsPerPage);
        const safePage = Math.max(1, Math.min(page, pages || 1));
        const startIndex = (safePage - 1) * itemsPerPage;
        const pageData = filteredMadrasas.slice(
          startIndex,
          startIndex + itemsPerPage,
        );

        setTotalItems(total);
        setTotalPages(pages);
        setCurrentPage(safePage);
        setMadrassas(pageData);

        await loadCountsInBatches(pageData);
      } catch (error) {
        console.error("Error fetching pending-student madrasas:", error);
        toast.error("Failed to fetch pending student madrasas");
      } finally {
        setLoading(false);
      }
    },
    [itemsPerPage, loadCountsInBatches, searchTerm],
  );

  const getTotalCount = useCallback(async () => {
  try {
    let countQuery = query(collection(db, "madarsas"));

    if (isMadrasaStatusFilter(filterStatus)) {
      countQuery = query(
        countQuery,
        where("status", "==", filterStatus)
      );
    }

    const countSnapshot =
      await getCountFromServer(countQuery);

    const total = countSnapshot.data().count;

    setTotalItems(total);
    setTotalPages(Math.ceil(total / itemsPerPage));
  } catch (error) {
    console.error("Error getting total count:", error);
  }
}, [filterStatus, itemsPerPage]);

  const fetchMadrassas = useCallback(
    async (page = 1, reset = false) => {
      try {
        if (filterStatus === "students-pending") {
          await fetchPendingStudentMadrassas(reset ? 1 : page);
          return;
        }

        setLoading(true);

        let madrassasQuery;
        let targetPage = reset ? 1 : page;

        // Firestore cursor pagination needs the last document of the previous page.
        // If the user jumps ahead (e.g., clicks 6 directly), we may not have the
        // intermediate cursor yet. Build missing cursors sequentially so clicks
        // work without forcing the user to navigate page-by-page.
        if (!reset && targetPage > 1) {
          const requiredTokenIndex = targetPage - 1;
          const existing = pageTokensRef.current?.[requiredTokenIndex];
          if (!existing) {
            let tokens = pageTokensRef.current || [null];

            // Find nearest previous page we *do* have a cursor for.
            let nearestIndex = requiredTokenIndex - 1;
            while (nearestIndex > 0 && !tokens[nearestIndex]) {
              nearestIndex -= 1;
            }

            // nearestIndex=0 means start from the beginning (page 1)
            let cursor = tokens[nearestIndex] || null;
            const working = [...tokens];

            for (
              let tokenIndex = nearestIndex + 1;
              tokenIndex <= requiredTokenIndex;
              tokenIndex++
            ) {
              // tokenIndex corresponds to: last doc of page tokenIndex
              const qParts = [collection(db, "madarsas")];
              if (isMadrasaStatusFilter(filterStatus)) {
                qParts.push(where("status", "==", filterStatus));
              }
              qParts.push(orderBy("createdAt", "desc"));
              if (cursor) {
                qParts.push(startAfter(cursor));
              }
              qParts.push(limit(itemsPerPage));

              const snap = await getDocs(query(...qParts));
              if (snap.empty) break;

              cursor = snap.docs[snap.docs.length - 1];
              working[tokenIndex] = cursor;
            }

            setPageTokens(working);
            pageTokensRef.current = working;
          }
        }

        // Get the pagination token (last doc of the *previous* page)
        const pageToken = reset ? null : pageTokensRef.current[targetPage - 1];

        if (targetPage === 1 || reset) {
          // First page or reset - start from beginning
          let qParts = [
            collection(db, "madarsas"),
            orderBy("createdAt", "desc"),
            limit(itemsPerPage),
          ];

          if (isMadrasaStatusFilter(filterStatus)) {
            qParts.splice(1, 0, where("status", "==", filterStatus));
          }

          madrassasQuery = query(...qParts);
        } else {
          // Subsequent pages - use pagination token
          if (pageToken) {
            let qParts = [
              collection(db, "madarsas"),
              orderBy("createdAt", "desc"),
              startAfter(pageToken),
              limit(itemsPerPage),
            ];

            if (isMadrasaStatusFilter(filterStatus)) {
              qParts.splice(1, 0, where("status", "==", filterStatus));
            }

            madrassasQuery = query(...qParts);
          } else {
            console.error("No page token found for page", targetPage);
            setLoading(false);
            return;
          }
        }

        const snapshot = await getDocs(madrassasQuery);
        const madrassasData = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id,
          _doc: docSnap, // Store document reference for pagination
        }));

        // Update page tokens for navigation
        if (reset) {
          setPageTokens([null]);
        }

        if (madrassasData.length > 0) {
          const lastDoc = snapshot.docs[snapshot.docs.length - 1];

          // Store the token for the *next* page
          setPageTokens((prevTokens) => {
            const newTokens = [...prevTokens];
            newTokens[targetPage] = lastDoc; // token for page *targetPage* is last doc
            return newTokens;
          });
        }

        setMadrassas(madrassasData);
        setCurrentPage(targetPage);

        // Get total count only on first load
        if (targetPage === 1 || reset) {
          await getTotalCount();
        }

        // Load counts in batches for better performance
        loadCountsInBatches(madrassasData);
      } catch (error) {
        console.error("Error fetching madrasas:", error);
        toast.error("Failed to fetch madrasas");
      } finally {
        setLoading(false);
      }
    },
    [
      itemsPerPage,
      getTotalCount,
      loadCountsInBatches,
      filterStatus,
      fetchPendingStudentMadrassas,
    ],
  ); // Removed pageTokens from deps

  // Real-time debounced search: primary = array-contains on `searchKeywords`, fallback = client-side filtering
  const searchMadrassas = useCallback(
    async (term) => {
      const q = (term || "").trim();

      if (filterStatus === "students-pending") {
        setIsSearching(true);
        setHasSearched(false);
        setSearchResults([]);
        setActiveSearchSummary(q);
        try {
          await fetchPendingStudentMadrassas(1);
        } finally {
          setIsSearching(false);
        }
        return;
      }

      if (!q) {
        // Reset search and go back to paginated list
        setHasSearched(false);
        setSearchResults([]);
        setActiveSearchSummary("");
        try {
          await fetchMadrassas(1, true);
        } catch (e) {
          // ignore
        }
        return;
      }

      setIsSearching(true);
      setHasSearched(true);
      setActiveSearchSummary(q);

      const lower = q.toLowerCase();

      try {
        // Primary: array-contains on precomputed `searchKeywords` array field
        const primaryQuery = query(
          collection(db, "madarsas"),
          where("searchKeywords", "array-contains", lower),
          orderBy("createdAt", "desc"),
          limit(200),
        );

        let snapshot = null;
        try {
          snapshot = await getDocs(primaryQuery);
        } catch (err) {
          // If array-contains field isn't present or permission error, we'll fallback below
          console.warn(
            "Primary search failed, will fallback to client-side filtering:",
            err,
          );
          snapshot = null;
        }

        let results = [];

        if (snapshot && !snapshot.empty) {
          results = snapshot.docs.map((docSnap) => ({
            ...docSnap.data(),
            id: docSnap.id,
            _doc: docSnap,
          }));
        } else {
          // Fallback strategy (in steps):
          // 1) Prefix-range queries on madarsaId and name (server-side, efficient)
          // 2) If still empty, do a bounded paged client-side scan (capped) across createdAt and filter other fields
          const tries = [];

          try {
            const endTerm = lower + "\uf8ff";

            // Prefix on madarsaId
            const byIdQ = query(
              collection(db, "madarsas"),
              orderBy("madarsaId"),
              startAt(lower),
              endAt(endTerm),
              limit(200),
            );
            const byIdSnap = await getDocs(byIdQ);
            if (byIdSnap && !byIdSnap.empty) {
              tries.push(
                ...byIdSnap.docs.map((d) => ({
                  ...d.data(),
                  id: d.id,
                  _doc: d,
                })),
              );
            }

            // Prefix on name
            const byNameQ = query(
              collection(db, "madarsas"),
              orderBy("name"),
              startAt(lower),
              endAt(endTerm),
              limit(200),
            );
            const byNameSnap = await getDocs(byNameQ);
            if (byNameSnap && !byNameSnap.empty) {
              tries.push(
                ...byNameSnap.docs.map((d) => ({
                  ...d.data(),
                  id: d.id,
                  _doc: d,
                })),
              );
            }
          } catch (prefixErr) {
            console.warn(
              "Prefix queries failed (may need indexes):",
              prefixErr,
            );
          }

          // If prefix queries gave something, use them, else fall back to a bounded paged scan
          if (tries.length > 0) {
            results = tries;
          } else {
            // Bounded paged scan: scan up to a capped number of documents (to avoid runaway reads)
            const pageSize = 500;
            const maxPages = 10; // cap to ~5000 docs
            let lastDoc = null;
            const found = [];

            setActiveSearchSummary("Scanning older documents...");

            for (let p = 0; p < maxPages; p++) {
              try {
                const scanQ = lastDoc
                  ? query(
                      collection(db, "madarsas"),
                      orderBy("createdAt", "desc"),
                      startAfter(lastDoc),
                      limit(pageSize),
                    )
                  : query(
                      collection(db, "madarsas"),
                      orderBy("createdAt", "desc"),
                      limit(pageSize),
                    );

                const snap = await getDocs(scanQ);
                if (!snap || snap.empty) break;

                const docs = snap.docs.map((d) => ({
                  ...d.data(),
                  id: d.id,
                  _doc: d,
                }));

                for (const m of docs) {
                  const hay =
                    `${m.name || ""} ${m.madarsaId || ""} ${m.email || ""} ${m.phone || ""} ${m.district || ""} ${m.address || ""} ${m.mekhala || ""}`.toLowerCase();
                  if (hay.includes(lower)) found.push(m);
                  if (found.length >= 200) break;
                }

                if (found.length >= 200) break;

                lastDoc = snap.docs[snap.docs.length - 1];
                if (!lastDoc) break;
              } catch (scanErr) {
                console.warn(
                  "Paged scan failed during search fallback:",
                  scanErr,
                );
                break;
              }
            }

            results = found;
          }
        }

        // Deduplicate and sort by numeric madarsaId (if available)

        // Deduplicate by document id
        const unique = new Map();
        results.forEach((r) => {
          if (!unique.has(r.id)) unique.set(r.id, r);
        });

        let finalResults = Array.from(unique.values());

        // Apply status filter to search results
        if (isMadrasaStatusFilter(filterStatus)) {
          finalResults = finalResults.filter((r) => r.status === filterStatus);
        }

        // Ensure numeric sort: use madarsaIdNum if present, else try to extract
        finalResults = finalResults.map((r) => ({
          ...r,
          madarsaIdNum:
            r.madarsaIdNum ?? extractMadarsaIdNum(r.madarsaId) ?? null,
        }));

        finalResults.sort((a, b) => {
          const na = a.madarsaIdNum ?? Number.POSITIVE_INFINITY;
          const nb = b.madarsaIdNum ?? Number.POSITIVE_INFINITY;
          if (na !== nb) return na - nb;
          // fallback to name compare
          return (a.name || "").localeCompare(b.name || "");
        });

        setSearchResults(finalResults);
        // madrassas state is used for the main list, we shouldn't overwrite it with search results
        // unless the search is active. currentItems logic handles this.
        loadCountsInBatches(finalResults);
      } catch (error) {
        console.error("Error searching madrasas (realtime):", error);
        toast.error("Search failed. Please try again.");
      } finally {
        setIsSearching(false);
      }
    },
    [
      fetchMadrassas,
      fetchPendingStudentMadrassas,
      loadCountsInBatches,
      filterStatus,
    ],
  );

  // Debounced real-time search: trigger searchMadrassas 300ms after typing stops
  useEffect(() => {
    if ((searchTerm || "").trim() === "") {
      setHasSearched(false);
      setSearchResults([]);
      setActiveSearchSummary("");
      fetchMadrassas(1, true).catch(() => {});
      return;
    }

    const id = setTimeout(() => {
      searchMadrassas(searchTerm);
    }, 300);

    return () => clearTimeout(id);
  }, [searchTerm, filterStatus, searchMadrassas, fetchMadrassas]);

  // Handle status filter change separately to refresh list if not searching
  useEffect(() => {
    if (!hasSearched) {
      fetchMadrassas(1, true).catch(() => {});
    }
  }, [filterStatus, hasSearched, fetchMadrassas]);

  // This is the list of items to display
  const currentItems = hasSearched ? searchResults : madrasas;

  const displayTotalPages = hasSearched ? 1 : totalPages;
  const displayCurrentPage = hasSearched ? 1 : currentPage;

  // Reset to page 1 when search changes
  useEffect(() => {
    if (!hasSearched) {
      setCurrentPage(1);
    }
  }, [hasSearched]);

  const handlePageChange = useCallback(
    (page) => {
      if (hasSearched) {
        // In search mode, no pagination
        return;
      }

      fetchMadrassas(page);
      // Scroll to top of table
      document
        .getElementById("madrasas-table")
        ?.scrollIntoView({ behavior: "smooth" });
    },
    [hasSearched, fetchMadrassas],
  );

  // Get counts for a madrasa with fallback
  const getCounts = useCallback(
  (madrasa) => {
    const madrassaKey =
      madrasa.madarsaId || madrasa.id;

    const cached =
      countsCache.get(madrassaKey);

    return {
      studentCount:
        cached?.studentCount ?? 0,

      approvedStudentCount:
        cached?.approvedStudentCount ?? 0,

      pendingStudentCount:
        cached?.pendingStudentCount ?? 0,

      teacherCount:
        cached?.teacherCount ?? 0,

      isLoading: !cached,
    };
  },
  [countsCache]
);

  const fetchDistricts = useCallback(async () => {
    try {
      const districtsQuery = query(
        collection(db, "districts"),
        orderBy("name", "asc"),
      );
      const snapshot = await getDocs(districtsQuery);
      const districtsData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      setDistricts(districtsData);
    } catch (error) {
      console.error("Error fetching districts:", error);
      toast.error("Failed to fetch districts");
    }
  }, []);

  const fetchMekhalas = useCallback(async () => {
    try {
      const mekhalasQuery = query(
        collection(db, "mekhala"),
        orderBy("name", "asc"),
      );
      const snapshot = await getDocs(mekhalasQuery);
      const mekhalasData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      setMekhalas(mekhalasData);
    } catch (error) {
      console.error("Error fetching mekhalas:", error);
      toast.error("Failed to fetch mekhalas");
    }
  }, []);

  // Fetch districts and mekhalas on mount
  useEffect(() => {
    fetchDistricts();
    fetchMekhalas();
  }, [fetchDistricts, fetchMekhalas]);

  // Initial data load on mount
  useEffect(() => {
    let isMounted = true;

    const initialLoad = async () => {
      try {
        await fetchMadrassas(1, true);
      } catch (error) {
        if (isMounted) {
          console.error("Error in initial load:", error);
        }
      }
    };

    initialLoad();

    return () => {
      isMounted = false;
    };
  }, [fetchMadrassas]); // Only run once on mount (fetchMadrassas is stable)

  // Filter districts for the form dropdown based on selected mekhala
  const getFilteredDistricts = () => {
    let filtered = districts;

    // If mekhala is selected, filter districts by that mekhala
    if (formData.mekhala) {
      const selectedMekhala = mekhalas.find((m) => m.name === formData.mekhala);
      if (selectedMekhala && selectedMekhala.id) {
        // Use the mekhala's document id to match with district's mekhalaId field
        filtered = districts.filter(
          (d) => d.mekhalaId === selectedMekhala.id,
        );
      }
    }

    // Apply search filter
    if (districtSearch) {
      filtered = filtered.filter((district) =>
        district.name.toLowerCase().includes(districtSearch.toLowerCase()),
      );
    }

    // Deduplicate by name to prevent duplicate key/value issues in select dropdowns
    const seen = new Set();
    return filtered.filter((district) => {
      const nameLower = district.name.trim().toLowerCase();
      if (seen.has(nameLower)) {
        return false;
      }
      seen.add(nameLower);
      return true;
    });
  };

  // Filter mekhalas for the form dropdown
  const getFilteredMekhalas = () => {
    let filtered = mekhalas;
    if (mekhalaSearch) {
      filtered = mekhalas.filter((mekhala) =>
        mekhala.name.toLowerCase().includes(mekhalaSearch.toLowerCase()),
      );
    }

    // Deduplicate by name to prevent duplicate key/value issues in select dropdowns
    const seen = new Set();
    return filtered.filter((mekhala) => {
      const nameLower = mekhala.name.trim().toLowerCase();
      if (seen.has(nameLower)) {
        return false;
      }
      seen.add(nameLower);
      return true;
    });
  };

  // Handle district selection - auto-map to mekhala
  const handleDistrictChange = async (districtName) => {
    setMappingLoader(true);
    try {
      // Find the selected district and its mekhala
      const selectedDistrict = districts.find((d) => d.name === districtName);
      let mekhalaName = "";

      if (selectedDistrict && selectedDistrict.mekhalaId) {
        // Find the mekhala by its id
        const associatedMekhala = mekhalas.find(
          (m) => m.id === selectedDistrict.mekhalaId,
        );
        if (associatedMekhala) {
          mekhalaName = associatedMekhala.name;
        }
      }

      setFormData((prev) => ({
        ...prev,
        district: districtName,
        mekhala: mekhalaName,
      }));
    } catch (error) {
      console.error("Error handling district change:", error);
    } finally {
      setMappingLoader(false);
    }
  };

  // Handle mekhala selection - clear district to force user to select from filtered list
  const handleMekhalaChange = async (mekhalaName) => {
    setMappingLoader(true);
    try {
      setFormData((prev) => ({
        ...prev,
        mekhala: mekhalaName,
        district: "", // Clear district so user selects from filtered list
      }));

      // Clear district search when mekhala changes
      setDistrictSearch("");
    } catch (error) {
      console.error("Error handling mekhala change:", error);
    } finally {
      setMappingLoader(false);
    }
  };

  // Early return if user is not authenticated
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gray-50">
        <div className="bg-white rounded-xl shadow-md p-10 flex flex-col items-center gap-4 max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-teal-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800">Session Expired</h2>
          <p className="text-gray-500 text-center text-sm">Your session has ended. Please log in again to continue.</p>
          <a href="/auth/login/dkju-control">
            <Button className="bg-teal-600 hover:bg-teal-700 text-white w-full">Go to Login</Button>
          </a>
        </div>
      </div>
    );
  }

  // Function to regenerate MID
  const handleRegenerateMid = async () => {
    try {
      const newMid = await generateNextMid();
      setAutoGeneratedMid(newMid);
      setFormData((prev) => ({
        ...prev,
        madarsaId: newMid,
      }));
      setMidExists(false);
      toast.success("New MID generated successfully");
    } catch (error) {
      console.error("Error regenerating MID:", error);
      toast.error("Failed to generate new MID");
    }
  };

  const handleEdit = (madrasa) => {
    setEditingMadrassa(madrasa);
    setFormData({
      name: madrasa.name || "",
      madarsaId: madrasa.madarsaId || "",
      address: madrasa.address || "",
      district: madrasa.district || "",
      mekhala: madrasa.mekhala || "",
      managerName: madrasa.managerName || "",
      managerPosition: madrasa.managerPosition || "Others",
      phone: cleanMadrasaField(madrasa.phone),
      email: madrasa.email || "",
      // Fix for "null" string
      adminName:
        madrasa.adminName === "null" || !madrasa.adminName
          ? madrasa.name || "N/A"
          : madrasa.adminName,
      adminEmail: madrasa.adminEmail || "",
      adminPhone: pickMadrasaPhone(madrasa.adminPhone, madrasa.phone),
      adminPassword: madrasa.adminPassword || "",
      managerPassword: madrasa.managerPassword || "",
      capacity: madrasa.capacity?.toString() || "",
      established: madrasa.established || "",
      description: madrasa.description || "",
      status: madrasa.status || "active",
    });
    // Reset MID validation state when editing
    setMidExists(false);
    setCheckingMid(false);
    setAutoGeneratedMid("");
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    // Validate MID uniqueness for new madrasas
    if (!editingMadrassa) {
      if (!formData.madarsaId.trim()) {
        toast.error("Madrasa ID is required");
        return;
      }

      const midAlreadyExists = await checkMidExists(formData.madarsaId);
      if (midAlreadyExists) {
        toast.error("Madrasa ID already exists. Please use a different ID.");
        setMidExists(true);
        return;
      }
    }

    setSubmitting(true);

    try {
      const madrassaData = {
        name: formData.name,
        madarsaId: formData.madarsaId,
        // numeric part for correct sorting
        madarsaIdNum: (function (m) {
          try {
            const m1 = m?.toString().match(/(?:mid|MID)-?(\d+)/);
            return m1 ? parseInt(m1[1], 10) : null;
          } catch (e) {
            return null;
          }
        })(formData.madarsaId),
        address: formData.address,
        district: formData.district,
        mekhala: formData.mekhala,
        managerName: formData.managerName || "",
        managerPosition: formData.managerPosition || "Others",
        phone: cleanMadrasaField(formData.phone),
        email: formData.email,
        adminName: formData.adminName,
        adminEmail: formData.adminEmail,
        adminPhone: pickMadrasaPhone(formData.adminPhone, formData.phone),
        adminPassword: formData.adminPassword,
        managerPassword: formData.managerPassword,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        established: formData.established,
        description: formData.description,
        status: formData.status,
        // Precompute search keywords for fast realtime search
        searchKeywords: buildSearchKeywords(
          formData.name,
          formData.madarsaId,
          formData.email,
          formData.phone,
          formData.district,
          formData.address,
          formData.mekhala,
        ),
        updatedAt: new Date(),
        updatedBy: userData?.id || user?.uid,
      };

      if (editingMadrassa) {
        await updateDoc(doc(db, "madarsas", editingMadrassa.id), madrassaData);
        if (hasSearched) {
          setSearchResults((prev) => 
            prev.map((m) => m.id === editingMadrassa.id ? { ...m, ...madrassaData } : m)
          );
        }
        toast.success("Madrasa updated successfully");
      } else {
        await addDoc(collection(db, "madarsas"), {
          ...madrassaData,
          createdAt: new Date(),
          createdBy: userData?.id || user?.uid,
        });

        await updateMidCounter(formData.madarsaId);

        toast.success("Madrasa created successfully");
      }

      // Auto-create/update manager if manager password is provided
      if (formData.managerPassword) {
        try {
          const res = await authFetch("/api/admin/create-manager", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: formData.managerName || (formData.name ? `${formData.name} Manager` : "Manager"),
              password: formData.managerPassword,
              phone: cleanMadrasaField(formData.phone),
              address: formData.address || "",
              institutionName: formData.name || "",
              position: formData.managerPosition || "Others",
              madarsaId: formData.madarsaId,
              madarsaName: formData.name,
              createdBy: userData?.email || userData?.phone || "",
            }),
          });
          const data = await res.json();
          if (!res.ok && res.status !== 409) {
            toast.error(data.error || "Failed to auto-create/update manager.");
          } else if (res.ok) {
            toast.success(data.message || `Manager created automatically.`);
          }
        } catch (err) {
          console.error("Auto manager creation error:", err);
        }
      }

      setIsDialogOpen(false);
      resetForm();
      fetchMadrassas(1, true); // Refresh list from page 1
    } catch (error) {
      console.error("Error saving madrasa:", error);
      toast.error("Failed to save madrasa");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (madrassaId) => {
    // Find the madrasa object to get its madarsaId (MID)
    const madrassaToDelete =
      madrasas.find((m) => m.id === madrassaId) ||
      searchResults.find((m) => m.id === madrassaId);
    if (!madrassaToDelete) {
      toast.error("Could not find madrasa details to delete.");
      return;
    }

    // Set the madrasa to delete and open confirmation dialog
    setMadrasaToDelete(madrassaToDelete);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!madrasaToDelete) return;

    const mid = madrasaToDelete.madarsaId;

    try {
      // Check if madrasa has students or teachers using the madarsaId
      const studentsQuery = query(
        collection(db, "students"),
        where("madarsaId", "==", mid),
      );
      const studentsSnapshot = await getDocs(studentsQuery);

      const teachersQuery = query(
        collection(db, "teachers"),
        where("madarsaId", "==", mid),
      );
      const teachersSnapshot = await getDocs(teachersQuery);

      if (studentsSnapshot.size > 0 || teachersSnapshot.size > 0) {
        toast.error(
          `Cannot delete madrasa ${mid}. It has ${studentsSnapshot.size} students and ${teachersSnapshot.size} teachers. Please transfer or delete them first.`,
        );
        setIsDeleteDialogOpen(false);
        setMadrasaToDelete(null);
        return;
      }

      // Delete the madrasa using its document ID (madrassaId)
      await deleteDoc(doc(db, "madarsas", madrasaToDelete.id));
      toast.success("Madrasa deleted successfully");
      setIsDeleteDialogOpen(false);
      setMadrasaToDelete(null);
      fetchMadrassas(1, true); // Refresh list from page 1
    } catch (error) {
      console.error("Error deleting madrasa:", error);
      toast.error("Failed to delete madrasa");
      setIsDeleteDialogOpen(false);
      setMadrasaToDelete(null);
    }
  };

  const handleStatusChange = async (madrasaId, newStatus) => {
    try {
      await updateDoc(doc(db, "madarsas", madrasaId), {
        status: newStatus,
        updatedAt: new Date(),
        updatedBy: userData?.id || user?.uid,
      });

      // Update local state
      setMadrassas((prev) =>
        prev.map((m) => (m.id === madrasaId ? { ...m, status: newStatus } : m)),
      );
      if (hasSearched) {
        setSearchResults((prev) =>
          prev.map((m) =>
            m.id === madrasaId ? { ...m, status: newStatus } : m,
          ),
        );
      }
      toast.success("Status updated successfully");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  // Excel Import Functions
  const generateMahalId = async () => {
    try {
      // Use the counter-based generation
      return await generateNextMid();
    } catch (error) {
      console.error("Error generating madarsa ID:", error);
      return `mid-${Date.now().toString().slice(-6)}`;
    }
  };

  // Initialize MID counter if it doesn't exist
  const initializeMidCounter = async () => {
    try {
      const counterRef = doc(db, "counters", "madarsaIds");
      const counterDoc = await getDoc(counterRef);

      if (!counterDoc.exists()) {
        // Find the highest existing MID to initialize counter
        const madrassasQuery = query(
          collection(db, "madarsas"),
          orderBy("createdAt", "desc"),
        );
        const snapshot = await getDocs(madrassasQuery);

        let maxId = 1000;
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.madarsaId) {
            const match = data.madarsaId.match(/(?:mid|MID)-?(\d+)/);
            if (match) {
              const idNumber = parseInt(match[1]);
              if (!isNaN(idNumber) && idNumber > maxId) {
                maxId = idNumber;
              }
            }
          }
        });

        await setDoc(counterRef, { current: maxId });
        console.log("MID counter initialized with value:", maxId);
      }
    } catch (error) {
      console.error("Error initializing MID counter:", error);
    }
  };

  // Update counter when MID is successfully used
  const updateMidCounter = async (midValue) => {
    try {
      const match = midValue.match(/(?:mid|MID)-?(\d+)/);
      if (match) {
        const idNumber = parseInt(match[1]);
        if (idNumber) {
          const counterRef = doc(db, "counters", "madarsaIds");
          const counterDoc = await getDoc(counterRef);

          let currentMax = 1000;
          if (counterDoc.exists()) {
            currentMax = counterDoc.data().current || 1000;
          }

          // Only update if this new ID is higher than the current counter
          if (idNumber > currentMax) {
            await setDoc(counterRef, { current: idNumber }, { merge: true });
          }
        }
      }
    } catch (error) {
      console.error("Error updating MID counter:", error);
    }
  };

  // Check if MID already exists
  const checkMidExists = async (midValue) => {
    try {
      if (!midValue.trim()) return false;

      const madrassasQuery = query(
        collection(db, "madarsas"),
        where("madarsaId", "==", midValue.trim()),
      );
      const snapshot = await getDocs(madrassasQuery);
      return !snapshot.empty;
    } catch (error) {
      console.error("Error checking MID existence:", error);
      return false;
    }
  };

  const normalizeEmailName = (name, place) => {
    const cleanName = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") // Remove all non-alphanumeric characters
      .substring(0, 15); // Limit name to 15 characters

    const cleanPlace = place
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") // Remove all non-alphanumeric characters
      .substring(0, 10); // Limit place to 10 characters

    return `${cleanName}-${cleanPlace}`;
  };

  const generatePassword = (name, place) => {
    const cleanName = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 10);
    const cleanPlace = place
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 8);
    return `${cleanName}${cleanPlace}123`;
  };

  // Build search keywords (prefixes) for realtime array-contains search
  const buildSearchKeywords = (...fields) => {
    const set = new Set();
    fields.forEach((f) => {
      if (!f) return;
      const str = f.toString().toLowerCase();
      // Add full string
      set.add(str);
      // Split into words and add prefixes
      const words = str.split(/\s+/).filter(Boolean);
      words.forEach((w) => {
        set.add(w);
        for (let i = 1; i <= w.length; i++) {
          set.add(w.slice(0, i));
        }
      });
      // also add continuous substrings up to length 10
      for (let i = 0; i < str.length; i++) {
        for (let j = i + 1; j <= Math.min(str.length, i + 10); j++) {
          set.add(str.slice(i, j));
        }
      }
    });

    return Array.from(set).slice(0, 1000);
  };

  // Extract numeric part from MADRASA ID like 'mid-123' -> 123. Returns null if not found
  const extractMadarsaIdNum = (mid) => {
    if (!mid) return null;
    try {
      const match = mid.toString().match(/(?:mid|MID)-?(\d+)/);
      if (match && match[1]) return parseInt(match[1], 10);
    } catch (e) {
      // ignore
    }
    return null;
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast.error("Please upload a valid Excel file (.xlsx or .xls)");
      return;
    }

    setExcelFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Check if first row contains headers or data
        const range = XLSX.utils.decode_range(worksheet["!ref"]);
        const firstRowData = [];
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
          const cell = worksheet[cellAddress];
          firstRowData.push(cell ? cell.v : "");
        }

        const expectedHeaders = [
          "NAME OF MADRASA",
          "PLACE",
          "MEKHALA",
          "DISTRICT",
          "SADAR MUALLIM",
          "PHONE",
        ];
        const hasHeaders = expectedHeaders.some((header) =>
          firstRowData.some(
            (cell) =>
              cell &&
              cell
                .toString()
                .toUpperCase()
                .includes(header.toUpperCase().substring(0, 5)),
          ),
        );

        let jsonData;
        if (hasHeaders) {
          // First row contains headers
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        } else {
          // First row contains data, use manual headers
          jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: expectedHeaders,
            range: 0, // Start from first row
          });
        }

        if (jsonData.length === 0) {
          toast.error("Excel file is empty");
          return;
        }

        // Validate required columns
        const firstRow = jsonData[0];
        const missingColumns = expectedHeaders.filter(
          (col) => !(col in firstRow),
        );

        if (missingColumns.length > 0) {
          toast.error(`Missing required columns: ${missingColumns.join(", ")}`);
          return;
        }

        setExcelData(jsonData);

        // Get the starting ID for preview
        generateMahalId().then((startId) => {
          const startNumber = parseInt(startId.split("-")[1]);
          setPreviewStartId(startNumber);
        });

        toast.success(
          `Successfully loaded ${jsonData.length} records from Excel`,
        );
      } catch (error) {
        console.error("Error reading Excel file:", error);
        toast.error("Error reading Excel file. Please check the format.");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const processExcelData = async () => {
    if (excelData.length === 0) {
      toast.error("No data to import");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const processedData = [];
      let currentMahalId = await generateMahalId();
      let currentIdNumber = parseInt(currentMahalId.split("-")[1]);

      for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];

        // Skip rows with missing essential data
        if (!row["NAME OF MADRASA"] || !row["PLACE"]) {
          continue;
        }

        const name = row["NAME OF MADRASA"].toString().trim();
        const place = row["PLACE"].toString().trim();
        const mekhala = row["MEKHALA"] ? row["MEKHALA"].toString().trim() : "";
        const district = row["DISTRICT"]
          ? row["DISTRICT"].toString().trim()
          : "";
        const sadarMuallim = row["SADAR MUALLIM"]
          ? row["SADAR MUALLIM"].toString().trim()
          : "";
        const phone = row["PHONE"] ? row["PHONE"].toString().trim() : "";

        // Use madarsa name as admin name if SADAR MUALLIM is empty
        const adminName = sadarMuallim || name;

        // Combine address
        const addressParts = [place, mekhala, district].filter((part) => part);
        const address = addressParts.join(", ");

        // Generate email
        const emailName = normalizeEmailName(name, place);
        const email = `${emailName}@dkju.in`;

        // Generate password
        const adminPassword = generatePassword(name, place);

        const madrassaData = {
          name: name,
          address: address,
          district: district,
          madarsaId: `mid-${currentIdNumber}`,
          madarsaIdNum: currentIdNumber,
          phone: phone,
          email: email,
          adminName: adminName,
          adminEmail: email, // Same as madarsa email
          adminPhone: phone, // Same as madarsa phone
          adminPassword: adminPassword,
          capacity: null,
          established: "",
          description: "",
          status: "active",
          // Precompute search keywords for realtime search
          searchKeywords: buildSearchKeywords(
            name,
            `mid-${currentIdNumber}`,
            email,
            phone,
            district,
            address,
            mekhala,
          ),
          createdAt: new Date(),
          createdBy: userData?.id || user?.uid,
          updatedAt: new Date(),
          updatedBy: userData?.id || user?.uid,
        };

        processedData.push(madrassaData);
        currentIdNumber++;

        // Update progress
        setImportProgress(Math.round(((i + 1) / excelData.length) * 100));
      }

      // Store mapped data and show confirmation dialog
      setMappedData(processedData);
      setIsExcelDialogOpen(false);
      setIsConfirmDialogOpen(true);
      toast.success(
        `Successfully mapped ${processedData.length} madrasas. Please review and confirm.`,
      );
    } catch (error) {
      console.error("Error processing Excel data:", error);
      toast.error("Error processing data. Please try again.");
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const confirmImport = async () => {
    if (mappedData.length === 0) {
      toast.error("No data to import");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    let lastImportedMid = "";

    try {
      // Import to Firestore
      for (let i = 0; i < mappedData.length; i++) {
        const madrassaData = mappedData[i];
        await addDoc(collection(db, "madarsas"), madrassaData);
        lastImportedMid = madrassaData.madarsaId;

        // Update progress
        setImportProgress(Math.round(((i + 1) / mappedData.length) * 100));
      }

      // Update the counter *after* successful import
      if (lastImportedMid) {
        await updateMidCounter(lastImportedMid);
      }

      toast.success(`Successfully imported ${mappedData.length} madrasas`);
      setIsConfirmDialogOpen(false);
      setExcelFile(null);
      setExcelData([]);
      setMappedData([]);
      fetchMadrassas(1, true); // Refresh the list
    } catch (error) {
      console.error("Error importing Excel data:", error);
      toast.error("Error importing data. Please try again.");
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const downloadSampleExcel = () => {
    const sampleData = [
      {
        "NAME OF MADRASA": "Jamia Islamia Sample",
        PLACE: "Sample Place",
        MEKHALA: "Sample Madrasa",
        DISTRICT: "Sample District",
        "SADAR MUALLIM": "Sample Teacher Name",
        PHONE: "1234567890",
      },
      {
        "NAME OF MADRASA": "Madrasa Al-Noor",
        PLACE: "New Delhi",
        MEKHALA: "Central Delhi",
        DISTRICT: "Delhi",
        "SADAR MUALLIM": "Maulana Ahmed",
        PHONE: "9876543210",
      },
      {
        "NAME OF MADRASA": "Darul Uloom Sample",
        PLACE: "Mumbai",
        MEKHALA: "South Mumbai",
        DISTRICT: "Maharashtra",
        "SADAR MUALLIM": "Hafez Mohammad",
        PHONE: "9123456789",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Madrasas");
    XLSX.writeFile(workbook, "madrassa_import_sample.xlsx");
    toast.success("Sample Excel file downloaded");
  };

  const downloadMadrassaData = async () => {
  let dataToExport = hasSearched
    ? searchResults
    : madrasas;

  // Get all madrasas when search is empty
  if ((searchTerm || "").trim() === "") {
    try {
      const allQuery = query(
        collection(db, "madarsas"),
        orderBy("createdAt", "desc")
      );

      const allSnap = await getDocs(allQuery);

      dataToExport = allSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        _doc: docSnap,
      }));
    } catch (error) {
      console.error(
        "Error fetching all madrasas for export:",
        error
      );

      toast.error(
        "Failed to fetch all madrasas for export."
      );

      return;
    }
  }

  try {
    toast.loading("Preparing export...", {
      id: "madrasa-export",
    });

    // =========================================
    // GET APPROVED + PENDING COUNT FOR EXPORT
    // =========================================

    const exportData = await Promise.all(
      dataToExport.map(async (madrasa) => {
        const madrassaKey =
          madrasa.madarsaId || madrasa.id;

        try {
          // Approved students
          const studentsQuery = query(
            collection(db, "students"),
            where(
              "madarsaId",
              "==",
              madrassaKey
            )
          );

          // Pending students/applications
          const pendingQuery = query(
            collection(db, "admissions"),
            where(
              "madarsa",
              "==",
              madrassaKey
            ),
            where(
              "status",
              "==",
              "pending"
            )
          );

          // Teachers
          const teachersQuery = query(
            collection(db, "teachers"),
            where(
              "madarsaId",
              "==",
              madrassaKey
            )
          );

          const [
            studentsSnapshot,
            pendingSnapshot,
            teachersSnapshot,
          ] = await Promise.all([
            getDocs(studentsQuery),
            getDocs(pendingQuery),
            getDocs(teachersQuery),
          ]);

          // Active students = Approved
          const approvedStudents =
            studentsSnapshot.docs.filter(
              (docSnap) => {
                const data = docSnap.data();

                return (
                  !data.deleted &&
                  data.status === "active"
                );
              }
            );

          // Pending admissions
          const pendingStudents =
            pendingSnapshot.docs.filter(
              (docSnap) => {
                const data = docSnap.data();

                return !data.deleted;
              }
            );

          // Active teachers
          const activeTeachers =
            teachersSnapshot.docs.filter(
              (docSnap) => {
                const data = docSnap.data();

                return (
                  !data.deleted &&
                  data.status !== "suspended" &&
                  data.status !== "deleted"
                );
              }
            );

          return {
            ...madrasa,

            approvedStudentCount:
              approvedStudents.length,

            pendingStudentCount:
              pendingStudents.length,

            teacherCount:
              activeTeachers.length,
          };
        } catch (error) {
          console.error(
            `Count error for ${madrassaKey}:`,
            error
          );

          return {
            ...madrasa,
            approvedStudentCount: 0,
            pendingStudentCount: 0,
            teacherCount: 0,
          };
        }
      })
    );

    // =========================================
    // CREATE CSV
    // =========================================

    const csvContent = [
      [
        "Name",
        "Madrasa ID",
        "Address",
        "Phone",
        "Email",
        "Manager Name",
        "Manager Position",
        "Admin Name",
        "Admin Email",
        "Admin Phone",
        "Admin Password",
        "Capacity",
        "Approved Students",
        "Pending Students",
        "Teachers",
        "Status",
        "Established",
        "Description",
        "Created Date",
        "Updated Date",
      ].join(","),

      ...exportData.map((madrasa) =>
        [
          `"${madrasa.name || ""}"`,

          `"${madrasa.madarsaId || ""}"`,

          `"${(madrasa.address || "")
            .replace(/"/g, '""')}"`,

          `"${madrasa.phone || ""}"`,

          `"${madrasa.email || ""}"`,

          `"${madrasa.managerName || ""}"`,

          `"${madrasa.managerPosition || "Others"}"`,

          `"${madrasa.adminName || ""}"`,

          `"${madrasa.adminEmail || ""}"`,

          `"${madrasa.adminPhone || ""}"`,

          `"${madrasa.adminPassword || ""}"`,

          madrasa.capacity || "",

          // APPROVED
          madrasa.approvedStudentCount,

          // PENDING
          madrasa.pendingStudentCount,

          // TEACHERS
          madrasa.teacherCount,

          `"${madrasa.status || ""}"`,

          `"${madrasa.established || ""}"`,

          `"${(madrasa.description || "")
            .replace(/"/g, '""')}"`,

          madrasa.createdAt
            ? new Date(
                madrasa.createdAt?.seconds
                  ? madrasa.createdAt.seconds * 1000
                  : madrasa.createdAt
              ).toLocaleDateString()
            : "",

          madrasa.updatedAt
            ? new Date(
                madrasa.updatedAt?.seconds
                  ? madrasa.updatedAt.seconds * 1000
                  : madrasa.updatedAt
              ).toLocaleDateString()
            : "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob(
      [csvContent],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      window.URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      "madrassas_data.csv";

    a.click();

    window.URL.revokeObjectURL(url);

    toast.success(
      "Madrasa data exported successfully",
      {
        id: "madrasa-export",
      }
    );
  } catch (error) {
    console.error(
      "Export error:",
      error
    );

    toast.error(
      "Failed to export data",
      {
        id: "madrasa-export",
      }
    );
  }
};

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

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Central Management
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Manage all madrasas in the system
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              onClick={downloadMadrassaData}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              onClick={() => setIsExcelDialogOpen(true)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Excel
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    resetForm();
                    setIsDialogOpen(true);
                  }}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Madrasa
                </Button>
              </DialogTrigger>
              {/* Added overflow-y-scroll and h-screen */}
              <DialogContent className="max-w-2xl overflow-y-scroll h-screen bg-white">
                <DialogHeader>
                  <DialogTitle>
                    {editingMadrassa ? "Edit Madrasa" : "Add New Madrasa"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Madrasa Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        required
                        placeholder="Enter Madrasa name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="managerName">Manager Name</Label>
                      <Input
                        id="managerName"
                        value={formData.managerName || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            managerName: e.target.value,
                          }))
                        }
                        placeholder="Enter manager name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="managerPosition">Manager Position</Label>
                      <Select
                        value={formData.managerPosition}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, managerPosition: value }))
                        }
                      >
                        <SelectTrigger id="managerPosition">
                          <SelectValue placeholder="Select Position" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="President">President</SelectItem>
                          <SelectItem value="Secretary">Secretary</SelectItem>
                          <SelectItem value="Treasurer">Treasurer</SelectItem>
                          <SelectItem value="Others">Others</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="phone">Manager Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        placeholder="Enter manager phone number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="managerPassword">Manager Password</Label>
                      <Input
                        id="managerPassword"
                        type="text"
                        value={formData.managerPassword || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            managerPassword: e.target.value,
                          }))
                        }
                        placeholder="Enter manager password to auto-create"
                      />
                    </div>
                    <div>
                      <Label htmlFor="madarsaId">Madrasa ID</Label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Input
                            id="madarsaId"
                            value={formData.madarsaId}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                madarsaId: e.target.value,
                              }))
                            }
                            placeholder="Enter Madrasa ID"
                            className={`pr-8 ${
                              midExists
                                ? "border-red-500 focus:border-red-500"
                                : formData.madarsaId &&
                                    !midExists &&
                                    !checkingMid
                                  ? "border-green-500 focus:border-green-500"
                                  : ""
                            }`}
                          />
                          {/* Loading/Status indicator */}
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            {checkingMid ? (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            ) : midExists ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : formData.madarsaId && !checkingMid ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : null}
                          </div>
                        </div>
                        {/* Auto-generate button - only show when not editing */}
                        {!editingMadrassa && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRegenerateMid}
                            className="flex items-center gap-1"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Generate
                          </Button>
                        )}
                      </div>
                      {/* Validation messages */}
                      {midExists && (
                        <p className="text-sm text-red-600 mt-1">
                          This ID already exists. Please choose a different one.
                        </p>
                      )}
                      {formData.madarsaId && !midExists && !checkingMid && (
                        <p className="text-sm text-green-600 mt-1">
                          ✓ ID is available
                        </p>
                      )}
                      {!editingMadrassa && (
                        <p className="text-sm text-gray-500 mt-1">
                          Auto-generated IDs are unique. You can edit manually
                          if needed.
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                      placeholder="Enter complete address"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="mekhala">
                        District (Select First)
                        {mappingLoader && (
                          <Loader2 className="h-4 w-4 animate-spin inline ml-2" />
                        )}
                      </Label>
                      <Select
                        value={formData.mekhala}
                        onValueChange={handleMekhalaChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select District first" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <div className="p-2">
                            <Input
                              placeholder="Search districts..."
                              value={mekhalaSearch}
                              onChange={(e) => setMekhalaSearch(e.target.value)}
                              className="mb-2"
                            />
                          </div>
                          {getFilteredMekhalas().length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">
                              No District found
                            </div>
                          ) : (
                            getFilteredMekhalas().map((mekhala) => (
                              <SelectItem key={mekhala.id} value={mekhala.name}>
                                {mekhala.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="district">
                        Mekhala
                        {!formData.mekhala && (
                          <span className="text-sm text-gray-500">
                            (Select mekhala first)
                          </span>
                        )}
                        {mappingLoader && (
                          <Loader2 className="h-4 w-4 animate-spin inline ml-2" />
                        )}
                      </Label>
                      <Select
                        value={formData.district}
                        onValueChange={handleDistrictChange}
                        disabled={!formData.mekhala}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              !formData.mekhala
                                ? "Select district first"
                                : "Select Mekhala"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <div className="p-2">
                            <Input
                              placeholder="Search mekhalas..."
                              value={districtSearch}
                              onChange={(e) =>
                                setDistrictSearch(e.target.value)
                              }
                              className="mb-2"
                            />
                          </div>
                          {getFilteredDistricts().length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">
                              {!formData.mekhala
                                ? "Please select a mekhala first"
                                : "No districts found for this mekhala"}
                            </div>
                          ) : (
                            getFilteredDistricts().map((district) => (
                              <SelectItem
                                key={district.id}
                                value={district.name}
                              >
                                {district.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        placeholder="Enter email address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="capacity">Capacity</Label>
                      <Input
                        id="capacity"
                        type="number"
                        value={formData.capacity}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            capacity: e.target.value,
                          }))
                        }
                        placeholder="Enter capacity"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Sadar Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="adminName">Sadar Name</Label>
                        <Input
                          id="adminName"
                          value={formData.adminName}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              adminName: e.target.value,
                            }))
                          }
                          placeholder="Enter sadar name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="adminPhone">Sadar Phone</Label>
                        <Input
                          id="adminPhone"
                          value={formData.adminPhone}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              adminPhone: e.target.value,
                            }))
                          }
                          placeholder="Enter sadar phone"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label htmlFor="adminEmail">Sadar Email</Label>
                      <Input
                        id="adminEmail"
                        type="email"
                        value={formData.adminEmail}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            adminEmail: e.target.value,
                          }))
                        }
                        placeholder="Enter sadar email"
                      />
                    </div>
                    <div className="mt-4">
                      <Label htmlFor="adminPassword">Sadar Password</Label>
                      <Input
                        id="adminPassword"
                        type="text"
                        value={formData.adminPassword}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            adminPassword: e.target.value,
                          }))
                        }
                        placeholder={
                          !editingMadrassa
                            ? "Will auto-generate as you type..."
                            : "Sadar password"
                        }
                        // Make read-only when adding new
                        readOnly={!editingMadrassa}
                        className={
                          !editingMadrassa
                            ? "bg-gray-100 cursor-not-allowed font-mono"
                            : ""
                        }
                      />
                      {/* Improved helper text */}
                      {!editingMadrassa && (
                        <p className="text-xs text-gray-500 mt-1">
                          {formData.name || formData.address ? (
                            <>
                              Password auto-generated:{" "}
                              <span className="font-mono text-blue-600">
                                {formData.adminPassword}
                              </span>
                            </>
                          ) : (
                            "Enter Madrasa name and address to see generated password"
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="established">Established Year</Label>
                      <Input
                        id="established"
                        value={formData.established}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            established: e.target.value,
                          }))
                        }
                        placeholder="e.g., 2020"
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, status: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Enter description (optional)"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting
                        ? "Saving..."
                        : editingMadrassa
                          ? "Update Madrasa"
                          : "Create Madrasa"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Excel Import Dialog */}
            <Dialog
              open={isExcelDialogOpen}
              onOpenChange={setIsExcelDialogOpen}
            >
              {/* Added max-w-7xl, overflow-auto, h-[80vh] */}
              <DialogContent className="max-w-7xl bg-white overflow-auto h-[80vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    <span>Import Madrasas from Excel</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 md:space-y-6">
                  {/* Instructions */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">
                      Excel Format Requirements:
                    </h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>
                        • <strong>First row should contain headers:</strong>
                      </li>
                      <li>&nbsp;&nbsp;- Column A: NAME OF MADRASA</li>
                      <li>&nbsp;&nbsp;- Column B: PLACE</li>
                      <li>&nbsp;&nbsp;- Column C: MEKHALA</li>
                      <li>&nbsp;&nbsp;- Column D: DISTRICT</li>
                      <li>&nbsp;&nbsp;- Column E: SADAR MUALLIM</li>
                      <li>&nbsp;&nbsp;- Column F: PHONE</li>
                      <li>
                        • <strong>Data rows start from row 2</strong>
                      </li>
                      <li>• If no headers, data starts from row 1</li>
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadSampleExcel}
                      className="mt-3"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Sample Excel
                    </Button>
                  </div>
                  {/* File Upload */}
                  <div>
                    <Label htmlFor="excel-file">Upload Excel File</Label>
                    <Input
                      id="excel-file"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      className="mt-1"
                    />
                    {excelFile && (
                      <p className="text-sm text-gray-600 mt-2">
                        Selected: {excelFile.name}
                      </p>
                    )}
                  </div>
                  {/* Preview */}
                  {excelData.length > 0 && (
                    <div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
                        <h4 className="font-medium">
                          Preview ({excelData.length} records)
                        </h4>
                        <Button
                          onClick={processExcelData}
                          disabled={excelData.length === 0 || isImporting}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {isImporting
                            ? "Processing..."
                            : `Process ${excelData.length} Records`}
                        </Button>
                      </div>
                      <div className="bg-yellow-50 p-3 rounded-lg mb-3">
                        <p className="text-sm text-yellow-800">
                          <strong>Preview shows:</strong> Generated Madrasa IDs,
                          normalized emails (@dkju.in), admin passwords
                          (name+place+123), and admin names. If SADAR MUALLIM is
                          empty, Madrasa name will be used as admin name.
                        </p>
                      </div>
                      <div className="border rounded-lg max-h-60 overflow-auto">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Generated ID</TableHead>
                                <TableHead>Address</TableHead>
                                <TableHead>Generated Email</TableHead>
                                <TableHead>Admin</TableHead>
                                <TableHead>Password</TableHead>
                                <TableHead>Phone</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {excelData.map((row, index) => {
                                const name = row["NAME OF MADRASA"] || "";
                                const place = row["PLACE"] || "";
                                const mekhala = row["MEKHALA"] || "";
                                const district = row["DISTRICT"] || "";
                                const sadarMuallim = row["SADAR MUALLIM"] || "";
                                const phone = row["PHONE"] || "";
                                const address = [place, district]
                                  .filter(Boolean)
                                  .join(", ");
                                const emailName = normalizeEmailName(
                                  name,
                                  place,
                                );
                                const email = `${emailName}@dkju.in`;
                                const adminName = sadarMuallim || name;
                                const adminPassword = generatePassword(
                                  name,
                                  place,
                                );
                                return (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium">
                                      {name || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        className="bg-blue-50 text-blue-700"
                                      >
                                        mid-{previewStartId + index}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-xs">
                                      <div className="truncate" title={address}>
                                        {address || "N/A"}
                                      </div>
                                    </TableCell>
                                    <TableCell className="max-w-xs">
                                      <div
                                        className="truncate text-sm"
                                        title={email}
                                      >
                                        {email}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-sm">
                                        <div>{adminName || "N/A"}</div>
                                        {!sadarMuallim && (
                                          <div className="text-gray-500 text-xs">
                                            (Using Madrasa name)
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                                        {adminPassword}
                                      </div>
                                    </TableCell>
                                    <TableCell>{phone || "N/A"}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Import Progress */}
                  {isImporting && (
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Processing data...</span>
                        <span>{importProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${importProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsExcelDialogOpen(false);
                        setExcelFile(null);
                        setExcelData([]);
                      }}
                      disabled={isImporting}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Confirmation Dialog for Mapped Data */}
            <Dialog
              open={isConfirmDialogOpen}
              onOpenChange={setIsConfirmDialogOpen}
            >
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto bg-white">
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    <span>Confirm Import - Review Mapped Data</span>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Summary */}
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">
                      Ready to Import {mappedData.length} Madrasas
                    </h4>
                    <p className="text-sm text-green-800">
                      Please review the mapped data below. Click &quot;Confirm
                      Import&quot; to proceed with adding these madrasas to the
                      database.
                    </p>
                  </div>

                  {/* Mapped Data Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-96 overflow-y-scroll">
                      <Table>
                        <TableHeader className="sticky top-0 bg-gray-50">
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Madrasa Name</TableHead>
                            <TableHead>Madrasa ID</TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>District</TableHead>
                            <TableHead>Mekhala</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Admin Name</TableHead>
                            <TableHead>Password</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mappedData.map((madrasa, index) => (
                            <TableRow key={index} className="hover:bg-gray-50">
                              <TableCell className="font-medium text-gray-500">
                                {index + 1}
                              </TableCell>
                              <TableCell className="font-medium">
                                {madrasa.name}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className="bg-blue-50 text-blue-700"
                                >
                                  {madrasa.madarsaId}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs">
                                <div
                                  className="truncate"
                                  title={madrasa.address}
                                >
                                  {madrasa.address}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-xs">
                                <div
                                  className="truncate uppercase"
                                  title={madrasa.mekhala}
                                >
                                  {madrasa.mekhala || "N/A"}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-xs">
                                <div
                                  className="truncate uppercase"
                                  title={madrasa.district}
                                >
                                  {madrasa.district || "N/A"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {madrasa.email}
                                  </div>
                                  <div className="text-gray-500">
                                    Admin: {madrasa.adminEmail}
                                  </div>
                                </div>
                              </TableCell>
                              {/* Fix for "null" string */}
                              <TableCell>
                                {madrasa.adminName === "null" ||
                                !madrasa.adminName
                                  ? madrasa.name
                                  : madrasa.adminName}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                                  {madrasa.adminPassword}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <div>{madrasa.phone || "N/A"}</div>
                                  <div className="text-gray-500">
                                    Admin: {madrasa.adminPhone || "N/A"}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-green-100 text-green-800">
                                  {madrasa.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Import Progress */}
                  {isImporting && (
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Importing to database...</span>
                        <span>{importProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-green-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${importProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        Please wait while we import the Madrasas to the
                        database...
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:justify-between pt-4 border-t gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsConfirmDialogOpen(false);
                        setIsExcelDialogOpen(true); // Go back to Excel dialog
                      }}
                      disabled={isImporting}
                      className="w-full sm:w-auto order-1"
                    >
                      ← Back to Excel Import
                    </Button>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsConfirmDialogOpen(false);
                          setExcelFile(null);
                          setExcelData([]);
                          setMappedData([]);
                        }}
                        disabled={isImporting}
                        className="w-full sm:w-auto"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={confirmImport}
                        disabled={mappedData.length === 0 || isImporting}
                        className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                      >
                        {isImporting
                          ? "Importing..."
                          : `Confirm Import ${mappedData.length} Madrasas`}
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <Building className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Madrasas</p>
                  {/* Fixed: Use totalItems from server count */}
                  <p className="text-2xl font-bold">{totalItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            {/* Standardized padding */}
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 md:space-x-3">
                <Settings className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Active Madrasas</p>
                  <p className="text-2xl font-bold">
                    {/* Note: This is an approximation based on *all* items, not just loaded ones */}
                    {totalItems -
                      madrasas.filter((m) => m.status !== "active").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <Users className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Students</p>
                  <p className="text-2xl font-bold">
                    {/* This is total students on *current page* or *search results* */}
                    {currentItems.reduce(
                      (sum, madrasa) =>
                        sum + (getCounts(madrasa).studentCount || 0),
                      0,
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <Users className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Teachers</p>
                  <p className="text-2xl font-bold">
                    {/* This is total teachers on *current page* or *search results* */}
                    {currentItems.reduce(
                      (sum, madrasa) =>
                        sum + (getCounts(madrasa).teacherCount || 0),
                      0,
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-3 items-end">
              <div className="relative flex-1">
                <Label className="sr-only">Search</Label>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search name, MID, email, contact, district, mekhala, address"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>

              <div className="w-full md:w-48">
                <Select
                  value={filterStatus}
                  onValueChange={(value) => {
                    setFilterStatus(value);
                    setCurrentPage(1);
                    setPageTokens([null]);
                    pageTokensRef.current = [null];
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="students-pending">
        Pending Students
      </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 items-center">
                <div className="min-w-[100px]">
                  {isSearching || loading ? (
                    <div className="flex items-center text-sm text-gray-500">
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Loading...
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">
                      {hasSearched ? "Search active" : "Real-time list"}
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={async () => {
                    setSearchTerm("");
                    setFilterStatus("all");
                    setHasSearched(false);
                    setSearchResults([]);
                    setActiveSearchSummary("");
                    await fetchMadrassas(1, true);
                  }}
                  className="h-10"
                >
                  Clear All
                </Button>
              </div>
            </div>

            {activeSearchSummary && (
              <div className="mt-3 text-sm text-gray-600">
                Searching for: <strong>{activeSearchSummary}</strong>
              </div>
            )}

            {(isSearching || loading) && (
              <div className="mt-3">
                {/* Simplified progress bar */}
                <Progress
                  value={loading || isSearching ? 50 : 0}
                  className="h-1 animate-pulse"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Madrasas Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <CardTitle>
                Madrasas List
                <span className="text-base font-normal text-gray-600 ml-2">
                  {/* Improved summary text */}(
                  {hasSearched
                    ? `${currentItems.length} ${currentItems.length === 1 ? "result" : "results"} found`
                    : `${totalItems} total madrasas`}
                  )
                </span>
              </CardTitle>
              {!hasSearched && displayTotalPages > 1 && (
                <div className="text-sm text-gray-500">
                  Page {displayCurrentPage} of {displayTotalPages}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading Madrasas...</div>
            ) : currentItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {hasSearched
                  ? "No Madrasas found matching your search."
                  : "No Madrasas found."}
              </div>
            ) : (
              <div>
                {/* Desktop Table View */}
                <div
                  className="hidden lg:block overflow-x-auto"
                  id="madrasas-table"
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Madrasa ID</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Mekhala</TableHead>
                        <TableHead>District</TableHead>
                        <TableHead>Admin Login</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Students</TableHead>
                        <TableHead>Teachers</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentItems.map((madrasa) => {
                        const counts = getCounts(madrasa);
                        return (
                          <TableRow key={madrasa.id}>
                            <TableCell className="font-medium">
                              <div>
                                <div className="font-semibold">
                                  {madrasa.name || "N/A"}
                                </div>
                                {madrasa.established && (
                                  <div className="text-xs text-gray-500">
                                    Est. {madrasa.established}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs truncate">
                                {madrasa.madarsaId || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs truncate">
                                {madrasa.address || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs truncate">
                                {madrasa.district || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs truncate">
                                {madrasa.mekhala || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {madrasa.adminPassword || "N/A"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {madrasa.adminEmail || ""}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div>{madrasa.phone || "N/A"}</div>
                                <div className="text-xs text-gray-500">
                                  {madrasa.email || ""}
                                </div>
                              </div>
                            </TableCell>
                           <TableCell>
  <div className="flex flex-col gap-2 min-w-[110px]">
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-600">
        Approved
      </span>

      <span className="min-w-[30px] h-6 px-2 flex items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-semibold">
        {counts.isLoading
          ? "..."
          : counts.approvedStudentCount}
      </span>
    </div>

    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-600">
        Pending
      </span>

      <span className="min-w-[30px] h-6 px-2 flex items-center justify-center rounded-full bg-yellow-100 text-yellow-700 text-sm font-semibold">
        {counts.isLoading
          ? "..."
          : counts.pendingStudentCount}
      </span>
    </div>
  </div>
</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  counts.isLoading ? "animate-pulse" : ""
                                }
                              >
                                {counts.isLoading ? "..." : counts.teacherCount}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={madrasa.status || "active"}
                                onValueChange={(value) =>
                                  handleStatusChange(madrasa.id, value)
                                }
                              >
                                <SelectTrigger
                                  className={`h-8 w-28 text-xs ${getStatusColor(madrasa.status)}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="inactive">
                                    Inactive
                                  </SelectItem>
                                  <SelectItem value="suspended">
                                    Suspended
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEdit(madrasa)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleDelete(madrasa.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile Card View */}
                <div className="lg:hidden space-y-3 mt-2">
                  {currentItems.map((madrasa) => {
                    const counts = getCounts(madrasa);
                    return (
                      <Card
                        key={madrasa.id}
                        className="border-l-4 border-l-blue-500 shadow-md bg-white"
                      >
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 text-base leading-tight truncate">
                                  {madrasa.name}
                                </h3>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  <Badge
                                    variant="outline"
                                    className="bg-blue-50 text-blue-700 text-xs"
                                  >
                                    {madrasa.madarsaId}
                                  </Badge>
                                  <Select
                                    value={madrasa.status || "active"}
                                    onValueChange={(value) =>
                                      handleStatusChange(madrasa.id, value)
                                    }
                                  >
                                    <SelectTrigger
                                      className={`h-6 w-24 text-[10px] ${getStatusColor(madrasa.status)}`}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                      <SelectItem value="active">
                                        Active
                                      </SelectItem>
                                      <SelectItem value="inactive">
                                        Inactive
                                      </SelectItem>
                                      <SelectItem value="suspended">
                                        Suspended
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              {/* Improved button layout for mobile */}
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEdit(madrasa)}
                                  className="h-8 w-8 p-0 rounded-full border-gray-300"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleDelete(madrasa.id)}
                                  className="h-8 w-8 p-0 rounded-full border-gray-300 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-y-2 text-sm">
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500 font-medium w-24 shrink-0">
                                  Address:
                                </span>
                                <span className="font-medium text-gray-900">
                                  {madrasa.address || "N/A"}
                                </span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500 font-medium w-24 shrink-0">
                                  District:
                                </span>
                                <span className="font-medium text-gray-900 uppercase">
                                  {madrasa.mekhala || "N/A"}
                                </span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500 font-medium w-24 shrink-0">
                                  Mekhala:
                                </span>
                                <span className="font-medium text-gray-900 uppercase">
                                  {madrasa.district || "N/A"}
                                </span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500 font-medium w-24 shrink-0">
                                  Admin:
                                </span>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium text-gray-900 truncate">
                                    {madrasa.adminPassword || "N/A"}
                                  </span>
                                  <span className="text-gray-500 text-xs truncate">
                                    {madrasa.adminEmail || ""}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500 font-medium w-24 shrink-0">
                                  Phone:
                                </span>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium text-gray-900 truncate">
                                    {madrasa.phone || madrasa.adminPhone || madrasa.mobile || "N/A"}
                                  </span>
                                  <span className="text-gray-500 text-xs truncate">
                                    {madrasa.email || ""}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 font-medium w-24 shrink-0">
                                  Students:
                                </span>
                                <Badge
                                  variant="outline"
                                  className={
                                    counts.isLoading ? "animate-pulse" : ""
                                  }
                                >
                                  {counts.isLoading
                                    ? "..."
                                    : counts.studentCount}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 font-medium w-24 shrink-0">
                                  Teachers:
                                </span>
                                <Badge
                                  variant="outline"
                                  className={
                                    counts.isLoading ? "animate-pulse" : ""
                                  }
                                >
                                  {counts.isLoading
                                    ? "..."
                                    : counts.teacherCount}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Pagination */}
                {!hasSearched && displayTotalPages > 1 && (
                  <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-gray-700">
                      Total: {totalItems} madrasas
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(displayCurrentPage - 1)}
                        disabled={displayCurrentPage === 1 || loading}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      {/* Improved Pagination Logic */}
                      <div className="flex items-center gap-1">
                        {(() => {
                          const pages = [];
                          const maxPagesToShow = 5;
                          // Adjust startPage to be centered
                          let startPage = Math.max(
                            1,
                            displayCurrentPage - Math.floor(maxPagesToShow / 2),
                          );
                          let endPage = Math.min(
                            displayTotalPages,
                            startPage + maxPagesToShow - 1,
                          );

                          // Adjust startPage again if endPage is at the limit
                          startPage = Math.max(1, endPage - maxPagesToShow + 1);

                          if (startPage > 1) {
                            pages.push(
                              <Button
                                key={1}
                                variant={"outline"}
                                size="sm"
                                onClick={() => handlePageChange(1)}
                                disabled={loading}
                                className="h-8 w-8 p-0"
                              >
                                1
                              </Button>,
                            );
                            if (startPage > 2) {
                              pages.push(
                                <span
                                  key="start-ellipsis"
                                  className="px-2 py-1 text-gray-500"
                                >
                                  ...
                                </span>,
                              );
                            }
                          }

                          for (let page = startPage; page <= endPage; page++) {
                            pages.push(
                              <Button
                                key={page}
                                variant={
                                  displayCurrentPage === page
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                onClick={() => handlePageChange(page)}
                                disabled={loading}
                                className="h-8 w-8 p-0"
                              >
                                {page}
                              </Button>,
                            );
                          }

                          if (endPage < displayTotalPages) {
                            if (endPage < displayTotalPages - 1) {
                              pages.push(
                                <span
                                  key="end-ellipsis"
                                  className="px-2 py-1 text-gray-500"
                                >
                                  ...
                                </span>,
                              );
                            }
                            pages.push(
                              <Button
                                key={displayTotalPages}
                                variant={"outline"}
                                size="sm"
                                onClick={() =>
                                  handlePageChange(displayTotalPages)
                                }
                                disabled={loading}
                                className="h-8 w-8 p-0"
                              >
                                {displayTotalPages}
                              </Button>,
                            );
                          }
                          return pages;
                        })()}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(displayCurrentPage + 1)}
                        disabled={
                          displayCurrentPage === displayTotalPages || loading
                        }
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="text-sm text-gray-500">
                      Page {displayCurrentPage} of {displayTotalPages}
                    </div>
                  </div>
                )}

                {/* Search Results Info */}
                {hasSearched && (
                  <div className="mt-6 text-center">
                    <div className="text-sm text-gray-600">
                      Found {currentItems.length} result
                      {currentItems.length !== 1 ? "s" : ""} for &ldquo;
                      {activeSearchSummary}&rdquo;
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setSearchTerm("");
                        setHasSearched(false);
                        setSearchResults([]);
                        setActiveSearchSummary("");
                        await fetchMadrassas(1, true);
                      }}
                      className="mt-2"
                    >
                      Clear Search & Return to All Madrasas
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Madrasa</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this madrasa{" "}
              <strong>{madrasaToDelete?.name}</strong> (ID:{" "}
              <strong>{madrasaToDelete?.madarsaId}</strong>)?
              <br />
              <br />
              This action cannot be undone and will permanently remove all
              madrasa information.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setMadrasaToDelete(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Madrasa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
