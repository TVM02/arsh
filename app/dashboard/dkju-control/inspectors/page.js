"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  UserCheck,
  Building,
  Mail,
  Phone,
  RefreshCw,
  X,
  Eye,
  EyeOff,
  Copy,
  Key,
  Clock,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { toast } from "sonner";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  deleteDoc,
  addDoc,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  updatePassword,
  signInWithEmailAndPassword,
  getAuth as getClientAuth,
  signOut,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { initializeApp, getApps } from "firebase/app";
import { auth, db } from "@/lib/firebase";
import { functions } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/ui/pagination";
import {
  canonicalDistrictName,
  canonicalMekhalaName,
  DISTRICT_ORDER,
  DISTRICT_TO_MEHKALA,
  madrasaMatchesDistrict,
  madrasaMatchesMekhala,
} from "@/lib/madrasaHierarchy";

export default function InspectorsManagementPage() {
  const { user, userData } = useAuthStore();
  const debugLogs = process.env.NODE_ENV !== "production";

  const getSecondaryAuth = () => {
    const secondaryName = "secondary-auth";
    const existing = getApps().find((a) => a.name === secondaryName);
    const appForAuth =
      existing || initializeApp(auth.app.options, secondaryName);
    return getClientAuth(appForAuth);
  };
  const [inspectors, setInspectors] = useState([]);
  const [madarsas, setMadarsas] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInspector, setEditingInspector] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inspectorPasswords, setInspectorPasswords] = useState({});
  const [enablePasswordChange, setEnablePasswordChange] = useState(false);
  const [districtSearchTerm, setDistrictSearchTerm] = useState("");
  const [mekhalaSearchTerm, setMekhalaSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    assignedDistricts: [],
    assignedMekhalas: [],
    assignedMadarsas: [],
    status: "active",
    allowedTime: "60", // Default 60 minutes (string to allow backspace/empty)
  });

  const normalizeDistrictKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const districtOptions = useMemo(() => {
    if (Array.isArray(DISTRICT_ORDER) && DISTRICT_ORDER.length > 0) {
      return [...DISTRICT_ORDER];
    }

    // Prefer deriving from madrasa docs so we always show real district names
    // (in some deployments the `districts` collection may contain non-district labels).
    const fromMadarsas = new Set();
    for (const m of madarsas) {
      const d =
        canonicalDistrictName(m?.district) || String(m?.district || "").trim();
      if (d) fromMadarsas.add(d);
    }
    if (fromMadarsas.size > 0) {
      return Array.from(fromMadarsas).sort((a, b) => a.localeCompare(b));
    }

    const fromDistricts = (districts || [])
      .map(
        (d) => canonicalDistrictName(d?.name) || String(d?.name || "").trim(),
      )
      .filter(Boolean);
    return Array.from(new Set(fromDistricts)).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [districts, madarsas]);

  const filteredDistrictOptions = useMemo(() => {
    const term = districtSearchTerm.trim().toLowerCase();
    if (!term) return districtOptions;
    return districtOptions.filter((d) =>
      String(d).toLowerCase().includes(term),
    );
  }, [districtOptions, districtSearchTerm]);

  const deriveDistrictFromAssignedMadarsas = useCallback(
    (assignedMadarsaIds) => {
      if (!Array.isArray(assignedMadarsaIds) || assignedMadarsaIds.length === 0)
        return "";

      const districts = new Set();
      for (const mid of assignedMadarsaIds) {
        const m = madarsas.find((x) => x?.madarsaId === mid);
        const d = String(m?.district || "").trim();
        if (d) districts.add(d);
        if (districts.size > 1) return "";
      }

      return districts.size === 1 ? Array.from(districts)[0] : "";
    },
    [madarsas],
  );

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalInspectors, setTotalInspectors] = useState(0);
  const itemsPerPage = 10;
  const lastDocRef = useRef(null);
  const [allInspectors, setAllInspectors] = useState([]); // For client-side filter if needed

  const fetchInspectors = useCallback(
    async (isSearch = false) => {
      try {
        setLoading(true);
        const inspectorsRef = collection(db, "users");
        let q = query(
          inspectorsRef,
          where("role", "==", "inspector"),
          orderBy("createdAt", "desc"),
        );

        // Simple implementation: Fetch all for now if pagination is handled client-side
        // but for "proper pagination", server-side is better.
        // Given the previous task, I'll implement proper pagination.

        const snapshot = await getDocs(q);
        const inspectorsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAllInspectors(inspectorsData);
        setTotalInspectors(inspectorsData.length);
        setTotalPages(Math.ceil(inspectorsData.length / itemsPerPage));
      } catch (error) {
        console.error("Error fetching inspectors:", error);
        toast.error("Failed to fetch inspectors");
      } finally {
        setLoading(false);
      }
    },
    [itemsPerPage],
  );

  const fetchMadarsas = useCallback(async () => {
    try {
      const madarsasQuery = query(
        collection(db, "madarsas"),
        orderBy("name", "asc"),
      );
      const snapshot = await getDocs(madarsasQuery);
      const madarsasData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (debugLogs) {
        const counts = new Map();
        for (const m of madarsasData) {
          const mid = m?.madarsaId;
          if (!mid) continue;
          counts.set(mid, (counts.get(mid) || 0) + 1);
        }
        const duplicates = Array.from(counts.entries())
          .filter(([, c]) => c > 1)
          .slice(0, 10);
        if (duplicates.length) {
          console.warn("[Madarsas] duplicate madarsaId detected", duplicates);
        }
      }

      setMadarsas(madarsasData);
    } catch (error) {
      console.error("Error fetching madarsas:", error);
      toast.error("Failed to fetch madarsas");
    }
  }, [debugLogs]);

  useEffect(() => {
    fetchInspectors();
    fetchMadarsas();
  }, [fetchInspectors, fetchMadarsas]);

  const fetchDistricts = useCallback(async () => {
    try {
      const districtsQuery = query(
        collection(db, "districts"),
        orderBy("name", "asc"),
      );
      const snapshot = await getDocs(districtsQuery);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setDistricts(data);
    } catch (error) {
      console.error("Error fetching districts:", error);
      // Don’t block the page; we’ll fall back to madrasa-derived options.
      setDistricts([]);
    }
  }, []);

  useEffect(() => {
    fetchDistricts();
  }, [fetchDistricts]);

  const normalizeAllowedTimeMinutes = (value) => {
    const str = String(value ?? "").trim();
    if (str === "") return null;

    const parsed = parseInt(str, 10);

    // Allow 0 as valid. Treat invalid/negative as null.
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.min(480, parsed);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation: 10 digit phone number
    const phoneRegex = /^\d{10}$/;
    if (formData.phone && !phoneRegex.test(formData.phone)) {
      return toast.error("Phone number must be exactly 10 digits");
    }

    const selectedDistricts = Array.isArray(formData.assignedDistricts)
      ? formData.assignedDistricts
          .map((d) => canonicalDistrictName(d) || String(d || "").trim())
          .filter(Boolean)
      : [];

    // Validation: must assign by district(s) when creating
    if (!editingInspector && selectedDistricts.length === 0) {
      toast.error("Please select at least one district to assign");
      return;
    }

    // Compute assigned madrasas from the selected mekhalas.
    // If no mekhalas were picked (e.g. editing legacy record), fall back to all madrasas in the district.
    const selectedMekhalas = Array.isArray(formData.assignedMekhalas)
      ? formData.assignedMekhalas
      : [];

    // Compute assigned madrasas from the selected districts and mekhalas.
    const mekhalaToDistrict = new Map();
    for (const [dist, meks] of Object.entries(DISTRICT_TO_MEHKALA)) {
      meks.forEach((m) => {
        mekhalaToDistrict.set(m.toLowerCase(), dist);
      });
    }

    const restrictedDistricts = new Set();
    selectedMekhalas.forEach((mek) => {
      const canonicalMek = canonicalMekhalaName(mek) || mek;
      const parentDistrict = mekhalaToDistrict.get(canonicalMek.toLowerCase());
      if (parentDistrict) {
        restrictedDistricts.add(canonicalDistrictName(parentDistrict) || parentDistrict);
      }
    });

    const computedAssignedMadarsas =
      selectedDistricts.length > 0
        ? Array.from(
            new Set(
              madarsas
                .filter((m) => {
                  return selectedDistricts.some((selected) => {
                    const canonicalSel = canonicalDistrictName(selected) || selected;
                    const districtRaw =
                      canonicalDistrictName(m?.district) ||
                      String(m?.district || "").trim();
                    const matchesDist = (() => {
                      try {
                        if (madrasaMatchesDistrict(m, selected)) return true;
                      } catch {
                        // ignore
                      }
                      return (
                        normalizeDistrictKey(districtRaw) ===
                        normalizeDistrictKey(selected)
                      );
                    })();

                    if (!matchesDist) return false;

                    if (restrictedDistricts.has(canonicalSel)) {
                      // This district has mekhala restrictions.
                      // The madrasa must match one of the selectedMekhalas that belong to this district.
                      return selectedMekhalas.some((mek) => {
                        const canonicalMek = canonicalMekhalaName(mek) || mek;
                        const parent = mekhalaToDistrict.get(canonicalMek.toLowerCase());
                        const canonicalParent = parent ? (canonicalDistrictName(parent) || parent) : "";
                        if (canonicalParent !== canonicalSel) return false;
                        try {
                          return madrasaMatchesMekhala(m, mek);
                        } catch {
                          return false;
                        }
                      });
                    }

                    // Otherwise, unrestricted district
                    return true;
                  });
                })
                .map((m) => m?.madarsaId)
                .filter(Boolean),
            ),
          )
        : null;

    setSubmitting(true);

    try {
      if (editingInspector) {
        // Update existing inspector
        const normalizedAllowedTime = normalizeAllowedTimeMinutes(
          formData.allowedTime,
        );
        const updateData = {
          name: formData.name,
          phone: formData.phone,
          assignedDistricts: selectedDistricts,
          assignedMekhalas: selectedMekhalas,
          // Backward-compatible field for older reads/UI.
          assignedDistrict: selectedDistricts[0] || "",
          assignedMadarsas:
            computedAssignedMadarsas !== null
              ? computedAssignedMadarsas
              : formData.assignedMadarsas,
          status: formData.status,
          allowedTime: normalizedAllowedTime,
          updatedAt: new Date(),
        };

        // If password change is enabled and password is provided
        if (enablePasswordChange && formData.password) {
          updateData.password = formData.password;
          setInspectorPasswords((prev) => ({
            ...prev,
            [editingInspector.id]: formData.password,
          }));
          updateData.passwordUpdated = new Date();
        }

        await updateDoc(doc(db, "users", editingInspector.id), updateData);

        // Update the inspector in-place in the list
        setAllInspectors((prev) =>
          prev.map((insp) =>
            insp.id === editingInspector.id
              ? { ...insp, ...updateData }
              : insp,
          ),
        );

        toast.success(
          enablePasswordChange && formData.password
            ? "Inspector updated successfully with new password"
            : "Inspector updated successfully",
        );
      } else {
        // Create new inspector
        const currentAdminUser = user;

        // IMPORTANT: Use a secondary auth instance so creating a user

        const secondaryAuth = getSecondaryAuth();
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth,
          formData.email,
          formData.password,
        );
        await signOut(secondaryAuth);

        // Create user document in Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password, // Store for administrative visibility
          role: "inspector",
          assignedDistricts: selectedDistricts,
          assignedMekhalas: selectedMekhalas,
          // Backward-compatible field for older reads/UI.
          assignedDistrict: selectedDistricts[0] || "",
          assignedMadarsas: computedAssignedMadarsas || [],
          status: formData.status,
          allowedTime: normalizeAllowedTimeMinutes(formData.allowedTime), // Session time limit in minutes (null = default)
          active: true, // Initially active
          sessionStartTime: null, // Will be set when they log in
          sessionEndTime: null, // Will be calculated on login
          createdAt: new Date().toISOString(),
          createdBy: currentAdminUser.uid,
        });

        // Add newly created inspector to the top of the list immediately
        const newInspectorDoc = {
          id: userCredential.user.uid,
          uid: userCredential.user.uid,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: "inspector",
          assignedDistricts: selectedDistricts,
          assignedMekhalas: selectedMekhalas,
          assignedDistrict: selectedDistricts[0] || "",
          assignedMadarsas: computedAssignedMadarsas || [],
          status: formData.status,
          allowedTime: normalizeAllowedTimeMinutes(formData.allowedTime),
          createdAt: new Date().toISOString(),
          createdBy: currentAdminUser.uid,
          password: formData.password,
        };
        setAllInspectors((prev) => [newInspectorDoc, ...prev]);
        setTotalInspectors((prev) => prev + 1);
        toast.success("Inspector created successfully");
      }

      setIsDialogOpen(false);
      resetForm();
      // Re-fetch only on edit to get server timestamps; creation already prepended above
      if (editingInspector) {
        fetchInspectors();
      }
    } catch (error) {
      console.error("Error saving inspector:", error);
      if (error.code === "auth/email-already-in-use") {
        toast.error("Email already in use");
      } else if (error.code === "auth/weak-password") {
        toast.error("Password should be at least 6 characters");
      } else {
        toast.error("Failed to save inspector");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (inspectorId) => {
    if (!confirm("Are you sure you want to delete this inspector?")) return;

    const loadingToast = toast.loading("Deleting inspector...");

    // Optimistic Update: Remove from UI immediately
    const prevInspectors = [...allInspectors];
    setAllInspectors((prev) => prev.filter((i) => i.id !== inspectorId));

    try {
      if (debugLogs) {
        console.log("[Inspectors] delete requested", { inspectorId });
      }

      // Primary: Next.js API route (Admin SDK on Vercel — always available)
      let deleted = false;
      const authRes = await authFetch("/api/admin/delete-user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: inspectorId }),
      });

      const authResult = await authRes.json().catch(() => ({}));
      if (debugLogs) {
        console.log("[Inspectors] delete-user API response", {
          status: authRes.status,
          ok: authRes.ok,
          data: authResult,
        });
      }

      if (authRes.ok && !authResult?.error) {
        deleted = true;
      }

      // Fallback: Callable Cloud Function (if API route fails for some reason)
      if (!deleted) {
        if (debugLogs) {
          console.warn(
            "[Inspectors] API route failed, trying callable function",
            { status: authRes.status, data: authResult },
          );
        }
        try {
          const deleteInspectorUser = httpsCallable(
            functions,
            "deleteInspectorUser",
          );
          const res = await deleteInspectorUser({ uid: inspectorId });
          if (debugLogs) {
            console.log("[Inspectors] callable delete response", res?.data);
          }
          deleted = true;
        } catch (err) {
          if (debugLogs) {
            console.warn("[Inspectors] callable delete also failed", {
              message: err?.message,
              code: err?.code,
            });
          }
          // Both failed — surface the original API route error
          const details = authResult?.details || authResult?.error || "";
          throw new Error(`Deletion failed${details ? `: ${details}` : ""}`);
        }
      }

      toast.success("Inspector deleted successfully", { id: loadingToast });

      // Update total count locally
      setTotalInspectors((prev) => prev - 1);
    } catch (error) {
      console.error("Error deleting inspector:", error);
      toast.error(
        error?.message
          ? `Failed to delete inspector: ${error.message}`
          : "Failed to delete inspector",
        { id: loadingToast },
      );
      // Revert optimistic update on failure
      setAllInspectors(prevInspectors);
      setTotalInspectors(prevInspectors.length);
    }
  };

  const handleEdit = (inspector) => {
    setEditingInspector(inspector);
    const derivedDistrict =
      inspector.assignedDistrict ||
      deriveDistrictFromAssignedMadarsas(inspector.assignedMadarsas || []);
    const derivedDistricts = Array.isArray(inspector.assignedDistricts)
      ? inspector.assignedDistricts
      : derivedDistrict
        ? [derivedDistrict]
        : [];
    setFormData({
      name: inspector.name || "",
      email: inspector.email || "",
      phone: inspector.phone || "",
      password: "",
      assignedDistricts: derivedDistricts,
      assignedMekhalas: inspector.assignedMekhalas || [],
      assignedMadarsas: inspector.assignedMadarsas || [],
      status: inspector.status || "active",
      // Keep empty if missing/null; otherwise show the saved number (including 0)
      allowedTime:
        inspector.allowedTime === null || inspector.allowedTime === undefined
          ? ""
          : String(inspector.allowedTime),
    });
    setEnablePasswordChange(false);
    setShowPassword(false);
    setDistrictSearchTerm("");
    setMekhalaSearchTerm("");
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      assignedDistricts: [],
      assignedMekhalas: [],
      assignedMadarsas: [],
      status: "active",
      allowedTime: "60",
    });
    setShowPassword(false);
    setEnablePasswordChange(false);
    setEditingInspector(null);
    setDistrictSearchTerm("");
    setMekhalaSearchTerm("");
  };

  useEffect(() => {
    if (!isDialogOpen) {
      setDistrictSearchTerm("");
      setMekhalaSearchTerm("");
    }
  }, [isDialogOpen]);

  const generatePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
    toast.success("Password generated successfully");
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${type} copied to clipboard`);
    } catch (err) {
      toast.error(`Failed to copy ${type}`);
    }
  };

  const selectedDistrictHasLegacyMultiDistrictAssignment =
    Boolean(editingInspector) &&
    (!Array.isArray(formData.assignedDistricts) ||
      formData.assignedDistricts.length === 0) &&
    Array.isArray(formData.assignedMadarsas) &&
    formData.assignedMadarsas.length > 0;

  const filteredInspectors = allInspectors.filter(
    (inspector) =>
      inspector.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspector.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspector.phone?.includes(searchTerm) ||
      inspector.uid?.includes(searchTerm),
  );

  // Pagination logic
  const paginatedInspectors = filteredInspectors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setTotalPages(Math.ceil(filteredInspectors.length / itemsPerPage));
    if (
      currentPage > 1 &&
      (currentPage - 1) * itemsPerPage >= filteredInspectors.length
    ) {
      setCurrentPage(1);
    }
  }, [filteredInspectors.length, itemsPerPage, currentPage]);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Inspector Management
            </h1>
            <p className="text-gray-600">
              Manage inspectors and their assigned districts
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Inspector
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] bg-white overflow-hidden">
              <DialogHeader>
                <DialogTitle>
                  {editingInspector ? "Edit Inspector" : "Add New Inspector"}
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto max-h-[75vh] pr-2">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                      disabled={editingInspector}
                    />
                  </div>

                  {!editingInspector && (
                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                password: e.target.value,
                              })
                            }
                            required
                            placeholder="Minimum 6 characters"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-500" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-500" />
                            )}
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={generatePassword}
                          className="whitespace-nowrap"
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Generate
                        </Button>
                      </div>
                    </div>
                  )}

                  {editingInspector && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="changePassword"
                          checked={enablePasswordChange}
                          onCheckedChange={setEnablePasswordChange}
                        />
                        <Label
                          htmlFor="changePassword"
                          className="text-sm font-medium"
                        >
                          Change Password
                        </Label>
                      </div>

                      {enablePasswordChange && (
                        <div className="space-y-2">
                          <Label htmlFor="newPassword">New Password *</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id="newPassword"
                                type={showPassword ? "text" : "password"}
                                value={formData.password}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    password: e.target.value,
                                  })
                                }
                                required={enablePasswordChange}
                                placeholder="Minimum 6 characters"
                                className="pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={
                                  showPassword
                                    ? "Hide password"
                                    : "Show password"
                                }
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <Eye className="h-4 w-4 text-gray-500" />
                                )}
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={generatePassword}
                              className="whitespace-nowrap"
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Generate
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500">
                            Leave blank to keep current password unchanged
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assignedDistrict">
                      Assigned Districts *
                    </Label>
                    <div className="border rounded-md overflow-hidden">
                      <div className="p-2 border-b bg-gray-50">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            value={districtSearchTerm}
                            onChange={(e) =>
                              setDistrictSearchTerm(e.target.value)
                            }
                            placeholder="Search districts..."
                            className="pl-9 pr-9"
                          />
                          {districtSearchTerm && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                              onClick={() => setDistrictSearchTerm("")}
                              aria-label="Clear search"
                            >
                              <X className="h-4 w-4 text-gray-500" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto">
                        {filteredDistrictOptions.length === 0 ? (
                          <div className="p-4 text-sm text-gray-500">
                            No districts found.
                          </div>
                        ) : (
                          filteredDistrictOptions.map((d) => {
                            const isSelected = Array.isArray(
                              formData.assignedDistricts,
                            )
                              ? formData.assignedDistricts.some(
                                  (x) =>
                                    normalizeDistrictKey(x) ===
                                    normalizeDistrictKey(d),
                                )
                              : false;

                            const displayName = String(d || "")
                              .trim()
                              .toUpperCase();

                            return (
                              <div
                                key={d}
                                className="flex items-center justify-between p-3 border-b last:border-b-0"
                              >
                                <div className="text-sm font-medium text-gray-900">
                                  {displayName || "—"}
                                </div>

                                {isSelected ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-teal-50 text-teal-700 border-teal-200"
                                  >
                                    Added
                                  </Badge>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        assignedDistricts: Array.from(
                                          new Set([
                                            ...(prev.assignedDistricts || []),
                                            d,
                                          ]),
                                        ),
                                      }))
                                    }
                                  >
                                    Add
                                  </Button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {Array.isArray(formData.assignedDistricts) &&
                    formData.assignedDistricts.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-sm text-gray-700 font-medium">
                          Selected districts (
                          {formData.assignedDistricts.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {formData.assignedDistricts.map((d) => (
                            <div
                              key={d}
                              className="flex items-center gap-2 px-2 py-1 border rounded-md bg-teal-50 border-teal-200"
                            >
                              <span className="text-sm text-teal-900 font-semibold">
                                {String(d || "")
                                  .trim()
                                  .toUpperCase()}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  const removedDistrict = d;
                                  const mekhalasOfDistrict = new Set(
                                    (
                                      DISTRICT_TO_MEHKALA[removedDistrict] || []
                                    ).map((mk) => mk.toLowerCase()),
                                  );
                                  setFormData((prev) => ({
                                    ...prev,
                                    assignedDistricts: (
                                      prev.assignedDistricts || []
                                    ).filter(
                                      (x) =>
                                        normalizeDistrictKey(x) !==
                                        normalizeDistrictKey(removedDistrict),
                                    ),
                                    assignedMekhalas: (
                                      prev.assignedMekhalas || []
                                    ).filter(
                                      (mk) =>
                                        !mekhalasOfDistrict.has(
                                          mk.toLowerCase(),
                                        ),
                                    ),
                                  }));
                                }}
                                aria-label="Remove selected district"
                              >
                                <X className="h-4 w-4 text-teal-700" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Inline mekhala picker for each selected district */}
                    {Array.isArray(formData.assignedDistricts) &&
                      formData.assignedDistricts.length > 0 && (() => {
                        const hasAnyVisibleMekhala = formData.assignedDistricts.some((d) => {
                          const mks = DISTRICT_TO_MEHKALA[d] || [];
                          return mks.some((mek) =>
                            mek.toLowerCase().includes(mekhalaSearchTerm.toLowerCase())
                          );
                        });

                        return (
                          <div className="space-y-3">
                            <div className="text-sm text-gray-700 font-medium">
                              Select Mekhalas
                            </div>
                            
                            <div className="border rounded-md p-2 bg-gray-50">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  value={mekhalaSearchTerm}
                                  onChange={(e) =>
                                    setMekhalaSearchTerm(e.target.value)
                                  }
                                  placeholder="Search mekhalas..."
                                  className="pl-9 pr-9 bg-white"
                                />
                                {mekhalaSearchTerm && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                    onClick={() => setMekhalaSearchTerm("")}
                                    aria-label="Clear search"
                                  >
                                    <X className="h-4 w-4 text-gray-500" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {!hasAnyVisibleMekhala ? (
                              <div className="text-sm text-gray-500 p-4 text-center border rounded-md bg-white">
                                No mekhalas match your search.
                              </div>
                            ) : (
                              formData.assignedDistricts.map((district) => {
                                const mekhalas =
                                  DISTRICT_TO_MEHKALA[district] || [];
                                const filteredMekhalas = mekhalas.filter((mek) =>
                                  mek.toLowerCase().includes(mekhalaSearchTerm.toLowerCase())
                                );
                                if (filteredMekhalas.length === 0) return null;
                                return (
                                  <div
                                    key={district}
                                    className="border rounded-md overflow-hidden"
                                  >
                                    <div className="px-3 py-2 bg-teal-50 border-b text-xs font-semibold text-teal-800 uppercase tracking-wide">
                                      {district}
                                    </div>
                                    <div className="divide-y">
                                      {filteredMekhalas.map((mek) => {
                                        const isAdded = (
                                          formData.assignedMekhalas || []
                                        ).some(
                                          (x) =>
                                            x.toLowerCase() === mek.toLowerCase(),
                                        );
                                        return (
                                          <div
                                            key={mek}
                                            className="flex items-center justify-between px-3 py-2 bg-white"
                                          >
                                            <span className="text-sm text-gray-800">
                                              {mek}
                                            </span>
                                            {isAdded ? (
                                              <div className="flex items-center gap-1">
                                                <Badge
                                                  variant="outline"
                                                  className="bg-teal-50 text-teal-700 border-teal-200 text-xs"
                                                >
                                                  Added
                                                </Badge>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-6 w-6"
                                                  onClick={() =>
                                                    setFormData((prev) => ({
                                                      ...prev,
                                                      assignedMekhalas: (
                                                        prev.assignedMekhalas || []
                                                      ).filter(
                                                        (x) =>
                                                          x.toLowerCase() !==
                                                          mek.toLowerCase(),
                                                      ),
                                                    }))
                                                  }
                                                  aria-label="Remove mekhala"
                                                >
                                                  <X className="h-3 w-3 text-teal-700" />
                                                </Button>
                                              </div>
                                            ) : (
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                  setFormData((prev) => ({
                                                    ...prev,
                                                    assignedMekhalas: Array.from(
                                                      new Set([
                                                        ...(prev.assignedMekhalas ||
                                                          []),
                                                        mek,
                                                      ]),
                                                    ),
                                                  }))
                                                }
                                              >
                                                Add
                                              </Button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        );
                      })()}

                    <p className="text-xs text-gray-500">
                      Click <strong>Add</strong> on a district, then add the
                      mekhalas you want to assign to this inspector.
                    </p>
                    {selectedDistrictHasLegacyMultiDistrictAssignment && (
                      <p className="text-xs text-amber-600">
                        This inspector currently has madarsas across multiple
                        districts. Select district(s) to reassign.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="allowedTime">
                      Session Time Limit (minutes)
                    </Label>
                    <Input
                      id="allowedTime"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.allowedTime}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const digitsOnly = raw.replace(/[^0-9]/g, "");
                        if (debugLogs) {
                          console.log("[Inspectors] allowedTime onChange", {
                            raw,
                            digitsOnly,
                            prevAllowedTime: formData.allowedTime,
                          });
                        }
                        setFormData((prev) => ({
                          ...prev,
                          allowedTime: digitsOnly,
                        }));
                      }}
                      onBlur={() =>
                        setFormData((prev) => {
                          // Requirement: if user clears the field, keep it empty.
                          if (prev.allowedTime === "") {
                            if (debugLogs) {
                              console.log(
                                "[Inspectors] allowedTime onBlur (empty)",
                              );
                            }
                            return prev;
                          }

                          const normalized = normalizeAllowedTimeMinutes(
                            prev.allowedTime,
                          );

                          if (debugLogs) {
                            console.log("[Inspectors] allowedTime onBlur", {
                              prevAllowedTime: prev.allowedTime,
                              normalized,
                            });
                          }

                          return {
                            ...prev,
                            allowedTime:
                              normalized === null ? "" : String(normalized),
                          };
                        })
                      }
                      placeholder=""
                    />
                    <p className="text-xs text-gray-500">
                      Inspector session will automatically expire after this
                      duration. Default: 60 minutes
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
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
                        : editingInspector
                          ? "Update"
                          : "Create"}
                    </Button>
                  </div>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search inspectors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Inspectors (Thaftheesh) Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Inspectors (Thaftheesh) ({filteredInspectors.length})
            </CardTitle>
            {totalPages > 1 && (
              <div className="text-sm font-normal text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredInspectors.length === 0 ? (
              <div className="text-center py-8">
                <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No inspectors found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Inspector</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>Assigned Districts</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Session Limit</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInspectors.map((inspector) => (
                      <TableRow key={inspector.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{inspector.name}</p>
                            <p className="text-sm text-gray-500 truncate max-w-[150px]">
                              {inspector.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {inspector.phone && (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3" />
                                {inspector.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm truncate max-w-[150px]">
                              {inspector.email}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                copyToClipboard(inspector.email, "Email")
                              }
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {inspector.password ||
                          inspectorPasswords[inspector.id] ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                                {inspector.password ||
                                  inspectorPasswords[inspector.id]}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  copyToClipboard(
                                    inspector.password ||
                                      inspectorPasswords[inspector.id],
                                    "Password",
                                  )
                                }
                                className="h-6 w-6 p-0"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">
                              Not set
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(Array.isArray(inspector.assignedDistricts)
                              ? inspector.assignedDistricts
                              : inspector.assignedDistrict
                                ? [inspector.assignedDistrict]
                                : []
                            ).length > 0 ? (
                              (Array.isArray(inspector.assignedDistricts)
                                ? inspector.assignedDistricts
                                : inspector.assignedDistrict
                                  ? [inspector.assignedDistrict]
                                  : []
                              )
                                .filter(Boolean)
                                .map((district) => (
                                  <Badge
                                    key={district}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {String(district || "")
                                      .trim()
                                      .toUpperCase()}
                                  </Badge>
                                ))
                            ) : (
                              <span className="text-gray-500 text-sm">
                                No assignments
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              inspector.status === "active"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {inspector.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-teal-600" />
                            <span className="font-semibold">
                              {inspector.allowedTime ?? 60}m
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {inspector.createdAt
                            ? typeof inspector.createdAt === "string"
                              ? new Date(inspector.createdAt).toLocaleDateString()
                              : inspector.createdAt.toDate
                                ? inspector.createdAt.toDate().toLocaleDateString()
                                : new Date(inspector.createdAt).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleEdit(inspector)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleDelete(inspector.id)}
                              className="text-red-600 hover:text-red-700 bg-white"
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-6">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    itemsPerPage={itemsPerPage}
                    totalItems={filteredInspectors.length}
                  />
                  <div className="mt-2 text-xs text-gray-500 text-center">
                    Page {currentPage} of {totalPages} | Showing{" "}
                    {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredInspectors.length,
                    )}{" "}
                    of {filteredInspectors.length} inspectors
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
