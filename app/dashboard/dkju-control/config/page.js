"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Settings,
  Globe,
  Bell,
  Shield,
  Database,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Users,
  Calendar,
  Loader2,
  GraduationCap,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  deleteDoc,
  addDoc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import { clearSettingsCache } from "@/lib/settingsService";
import Layout from "@/components/Layout";
import { cn } from "@/lib/utils";
import configDropdowns from "@/data/configDropdowns.json";

// Fee keys are stored and looked up in lowercase (form uses .toLowerCase() for lookup)
const DEFAULT_ADMISSION_FEES = configDropdowns.classes.reduce(
  (acc, cls) => ({
    ...acc,
    [cls.value.toLowerCase()]: cls.value.toLowerCase() === "ukg" ? 100 : 20,
  }),
  {},
);

export default function CentralAdminConfigPage() {
  const { user, userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [marqueeTexts, setMarqueeTexts] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMarquee, setEditingMarquee] = useState(null);
  const [settings, setSettings] = useState({
    studentEdit: false,
    studentSelfEdit: false,
    showResults: true,
    showAdmissions: true,
    revaluationEnabled: false,
    attendanceEnabled: true,
    resultWindow: 15,
    totalWorkingDays: 200,
    requiredPresentDays: 150,
    totalHolidays: 0,
    admissionFees: { ...DEFAULT_ADMISSION_FEES },
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingResultWindow, setSavingResultWindow] = useState(false);
  const [savingAttendanceDays, setSavingAttendanceDays] = useState(false);
  const [savingAdmissionFees, setSavingAdmissionFees] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingToggleValue, setPendingToggleValue] = useState(false);
  const [
    showStudentSelfEditConfirmDialog,
    setShowStudentSelfEditConfirmDialog,
  ] = useState(false);
  const [pendingStudentSelfEditValue, setPendingStudentSelfEditValue] =
    useState(false);
  const [pendingResultsValue, setPendingResultsValue] = useState(false);
  const [showResultsConfirmDialog, setShowResultsConfirmDialog] =
    useState(false);
  const [showAdmissionsConfirmDialog, setShowAdmissionsConfirmDialog] =
    useState(false);
  const [pendingAdmissionsValue, setPendingAdmissionsValue] = useState(false);
  const [formData, setFormData] = useState({
    text: "",
    isActive: true,
    priority: 1,
  });

  const saveSettingsPatch = useCallback(async (patch) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("Your admin session has expired. Please login again.");
    }

    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Failed to update settings");
    }

    return data.settings || patch;
  }, []);

  const fetchMarqueeTexts = useCallback(async () => {
    try {
      setLoading(true);
      const marqueeQuery = query(
        collection(db, "marqueeTexts")
      );
      const marqueeSnapshot = await getDocs(marqueeQuery);
      const marqueeData = marqueeSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Sort in memory to bypass Firebase index requirements
      marqueeData.sort((a, b) => {
        const priorityA = a.priority || 0;
        const priorityB = b.priority || 0;
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      
      setMarqueeTexts(marqueeData);
    } catch (error) {
      console.error("Error fetching marquee texts:", error);
      toast.error("Failed to fetch marquee texts");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const settingsDoc = await getDoc(doc(db, "settings", "general"));
      if (settingsDoc.exists()) {
        const settingsData = settingsDoc.data();
        setSettings({
          studentEdit: settingsData.studentEdit || false,
          studentSelfEdit: settingsData.studentSelfEdit || false,
          showResults: settingsData.showResults ?? true,
          showAdmissions: settingsData.showAdmissions ?? true,
          revaluationEnabled: settingsData.revaluationEnabled ?? false,
          attendanceEnabled: settingsData.attendanceEnabled ?? true,
          resultWindow: settingsData.resultWindow || 15,
          totalWorkingDays: settingsData.totalWorkingDays || 200,
          requiredPresentDays: settingsData.requiredPresentDays || 150,
          totalHolidays: settingsData.totalHolidays || 0,
          admissionFees: (() => {
            const stored = settingsData.admissionFees;
            if (
              stored &&
              typeof stored === "object" &&
              !Array.isArray(stored)
            ) {
              // Normalize all stored keys to lowercase for consistent lookup
              const normalizedStored = Object.fromEntries(
                Object.entries(stored).map(([k, v]) => [k.toLowerCase(), v]),
              );
              return { ...DEFAULT_ADMISSION_FEES, ...normalizedStored };
            }
            // Legacy migration: ukgAdmissionFee → admissionFees
            const legacyRaw = settingsData.ukgAdmissionFee;
            const legacyFee =
              typeof legacyRaw === "number"
                ? legacyRaw
                : parseInt(legacyRaw, 10);
            return {
              ...DEFAULT_ADMISSION_FEES,
              ukg: Number.isFinite(legacyFee) ? legacyFee : 100,
            };
          })(),
        });
      } else {
        // Create default settings if they don't exist
        await saveSettingsPatch({
          studentEdit: false,
          studentSelfEdit: false,
          showResults: true,
          showAdmissions: true,
          revaluationEnabled: false,
          attendanceEnabled: true,
          resultWindow: 15,
          totalWorkingDays: 200,
          requiredPresentDays: 150,
          totalHolidays: 0,
          admissionFees: { ...DEFAULT_ADMISSION_FEES },
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to fetch settings");
    }
  }, [saveSettingsPatch]);

  const handleToggleRequest = (newValue) => {
    setPendingToggleValue(newValue);
    setShowConfirmDialog(true);
  };

  const handleStudentSelfEditToggleRequest = (newValue) => {
    setPendingStudentSelfEditValue(newValue);
    setShowStudentSelfEditConfirmDialog(true);
  };

  const handleResultsToggleRequest = (newValue) => {
    setPendingResultsValue(newValue);
    setShowResultsConfirmDialog(true);
  };
  const handleAdmissionsToggleRequest = (newValue) => {
    setPendingAdmissionsValue(newValue);
    setShowAdmissionsConfirmDialog(true);
  };

  const handleRevaluationToggle = async (newValue) => {
    try {
      setSavingSettings(true);
      await saveSettingsPatch({ revaluationEnabled: newValue });
      setSettings((prev) => ({ ...prev, revaluationEnabled: newValue }));
      clearSettingsCache();
      toast.success(`Revaluation ${newValue ? "enabled" : "disabled"} for students`);
    } catch (error) {
      console.error("Error updating revaluation setting:", error);
      toast.error("Failed to update revaluation setting");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAttendanceToggle = async (newValue) => {
    try {
      setSavingSettings(true);
      await saveSettingsPatch({ attendanceEnabled: newValue });
      setSettings((prev) => ({ ...prev, attendanceEnabled: newValue }));
      clearSettingsCache();
      toast.success(`Attendance tracking ${newValue ? "enabled" : "disabled"} for the system`);
    } catch (error) {
      console.error("Error updating attendance setting:", error);
      toast.error("Failed to update attendance setting");
    } finally {
      setSavingSettings(false);
    }
  };

  const confirmToggleStudentEdit = async () => {
    try {
      setSavingSettings(true);
      setShowConfirmDialog(false);

      await saveSettingsPatch({
        studentEdit: pendingToggleValue,
      });

      setSettings((prev) => ({
        ...prev,
        studentEdit: pendingToggleValue,
      }));

      // Clear cache so other parts of the app get updated settings
      clearSettingsCache();

      toast.success(
        `Student edit access ${pendingToggleValue ? "enabled" : "disabled"}`,
      );
    } catch (error) {
      console.error("Error updating student edit setting:", error);
      toast.error("Failed to update student edit setting");
    } finally {
      setSavingSettings(false);
    }
  };

  const cancelToggle = () => {
    setShowConfirmDialog(false);
    setPendingToggleValue(false);
  };

  const confirmToggleStudentSelfEdit = async () => {
    try {
      setSavingSettings(true);
      setShowStudentSelfEditConfirmDialog(false);

      await saveSettingsPatch({
        studentSelfEdit: pendingStudentSelfEditValue,
      });

      setSettings((prev) => ({
        ...prev,
        studentSelfEdit: pendingStudentSelfEditValue,
      }));

      // Clear cache so other parts of the app get updated settings
      clearSettingsCache();

      toast.success(
        `Student self-edit access ${pendingStudentSelfEditValue ? "enabled" : "disabled"}`,
      );
    } catch (error) {
      console.error("Error updating student self-edit setting:", error);
      toast.error("Failed to update student self-edit setting");
    } finally {
      setSavingSettings(false);
    }
  };

  const cancelStudentSelfEditToggle = () => {
    setShowStudentSelfEditConfirmDialog(false);
    setPendingStudentSelfEditValue(false);
  };

  const confirmToggleResults = async () => {
    try {
      setSavingSettings(true);
      setShowResultsConfirmDialog(false);

      await saveSettingsPatch({
        showResults: pendingResultsValue,
      });

      setSettings((prev) => ({
        ...prev,
        showResults: pendingResultsValue,
      }));

      clearSettingsCache();

      toast.success(
        `Results page ${pendingResultsValue ? "enabled" : "disabled"}`,
      );
    } catch (error) {
      console.error("Error updating results setting:", error);
      toast.error("Failed to update results setting");
    } finally {
      setSavingSettings(false);
    }
  };

  const cancelResultsToggle = () => {
    setShowResultsConfirmDialog(false);
    setPendingResultsValue(false);
  };

  const confirmToggleAdmissions = async () => {
    try {
      setSavingSettings(true);
      setShowAdmissionsConfirmDialog(false);

      await saveSettingsPatch({
        showAdmissions: pendingAdmissionsValue,
      });

      setSettings((prev) => ({
        ...prev,
        showAdmissions: pendingAdmissionsValue,
      }));

      clearSettingsCache();

      toast.success(
        `Admissions ${pendingAdmissionsValue ? "enabled" : "disabled"}`,
      );
    } catch (error) {
      console.error("Error updating admissions setting:", error);
      toast.error("Failed to update admissions setting");
    } finally {
      setSavingSettings(false);
    }
  };

  const cancelAdmissionsToggle = () => {
    setShowAdmissionsConfirmDialog(false);
    setPendingAdmissionsValue(false);
  };

  const saveResultWindow = async () => {
    try {
      setSavingResultWindow(true);
      await saveSettingsPatch({
        resultWindow: settings.resultWindow,
      });

      clearSettingsCache();
      toast.success(`Result window updated to ${settings.resultWindow} days`);
    } catch (error) {
      console.error("Error updating result window:", error);
      toast.error("Failed to update result window");
    } finally {
      setSavingResultWindow(false);
    }
  };

  const saveAdmissionFees = async () => {
    try {
      const parsedFees = {};
      for (const [cls, val] of Object.entries(settings.admissionFees)) {
        const parsed = typeof val === "number" ? val : parseInt(val, 10);
        const entry = configDropdowns.classes.find((c) => c.value === cls);
        const label = entry ? entry.label : cls.toUpperCase();
        if (!Number.isFinite(parsed) || parsed < 0) {
          toast.error(`Invalid fee amount for ${label}`);
          return;
        }
        parsedFees[cls] = parsed;
      }

      setSavingAdmissionFees(true);
      await saveSettingsPatch({
        admissionFees: parsedFees,
      });

      clearSettingsCache();
      toast.success("Admission fees saved successfully");
    } catch (error) {
      console.error("Error updating admission fees:", error);
      toast.error("Failed to update admission fees");
    } finally {
      setSavingAdmissionFees(false);
    }
  };

  const saveAttendanceDays = async () => {
    try {
      setSavingAttendanceDays(true);
      await saveSettingsPatch({
        totalWorkingDays: settings.totalWorkingDays,
        requiredPresentDays: settings.requiredPresentDays,
        totalHolidays: settings.totalHolidays,
      });
      clearSettingsCache();
      toast.success("Attendance days updated successfully");
    } catch (error) {
      console.error("Error updating attendance days:", error);
      toast.error("Failed to update attendance days");
    } finally {
      setSavingAttendanceDays(false);
    }
  };

  useEffect(() => {
    fetchMarqueeTexts();
    fetchSettings();
  }, [fetchMarqueeTexts, fetchSettings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const marqueeData = {
        ...formData,
        createdBy: userData?.id || user?.uid,
        createdByName: userData?.name || user?.displayName || "Admin",
        updatedAt: new Date(),
      };

      if (editingMarquee) {
        await updateDoc(doc(db, "marqueeTexts", editingMarquee.id), {
          ...marqueeData,
          updatedAt: new Date(),
        });
        toast.success("Marquee text updated successfully");
      } else {
        await addDoc(collection(db, "marqueeTexts"), {
          ...marqueeData,
          createdAt: new Date(),
        });
        toast.success("Marquee text created successfully");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchMarqueeTexts();
    } catch (error) {
      console.error("Error saving marquee text:", error);
      toast.error("Failed to save marquee text");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (marquee) => {
    setEditingMarquee(marquee);
    setFormData({
      text: marquee.text,
      isActive: marquee.isActive,
      priority: marquee.priority,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (marqueeId) => {
    if (!confirm("Are you sure you want to delete this marquee text?")) return;

    try {
      await deleteDoc(doc(db, "marqueeTexts", marqueeId));
      toast.success("Marquee text deleted successfully");
      fetchMarqueeTexts();
    } catch (error) {
      console.error("Error deleting marquee text:", error);
      toast.error("Failed to delete marquee text");
    }
  };

  const resetForm = () => {
    setFormData({
      text: "",
      isActive: true,
      priority: 1,
    });
    setEditingMarquee(null);
  };

  const handleNewMarquee = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-16 md:py-24 bg-gradient-to-br from-gray-50 to-white min-h-screen">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-200 border-t-teal-600 mx-auto"></div>
            <p className="text-sm md:text-base text-gray-600">
              Loading configuration settings...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-3 md:p-6 space-y-6 bg-gradient-to-br from-gray-50 to-white min-h-screen">
        {/* Header */}
        <div className="bg-white rounded-lg md:rounded-xl p-3 md:p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="space-y-1">
              <h1 className="text-lg md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent leading-tight">
                System Configuration
              </h1>
              <p className="text-xs md:text-sm lg:text-base text-gray-600 leading-relaxed">
                Manage marquee texts and website display settings
              </p>
            </div>
            <Button
              onClick={handleNewMarquee}
              className="w-full min-h-[48px] touch-manipulation rounded-lg bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 shadow-md transition-all duration-200 hover:scale-[1.02] text-sm font-medium"
            >
              <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
              Add Marquee Text
            </Button>
          </div>
        </div>

        {/* System Settings Section */}
        <Card className="border-0 shadow-md rounded-lg md:rounded-xl bg-white">
          <CardHeader className="pb-3 md:pb-4">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Users className="h-5 w-5 text-teal-600" />
              System Settings
            </CardTitle>
            <p className="text-xs md:text-sm text-gray-600">
              Configure access permissions and system behavior
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Student Edit Access Setting */}
            <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Edit className="h-4 w-4 text-blue-600" />
                  <h3 className="font-medium text-gray-900 text-sm md:text-base">
                    Student Edit Access
                  </h3>
                </div>
                <p className="text-xs md:text-sm text-gray-600 mt-1">
                  Allow sadars to edit students profile information and
                  application details
                </p>
                <Badge
                  variant="outline"
                  className={`mt-2 text-xs ${
                    settings.studentEdit
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-700 border-gray-200"
                  }`}
                >
                  {settings.studentEdit ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Switch
                  checked={settings.studentEdit}
                  onCheckedChange={handleToggleRequest}
                  disabled={savingSettings}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300",
                    "data-[state=checked]:bg-teal-500 data-[state=unchecked]:bg-gray-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-md ring-0 transition-all duration-300",
                      "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
                    )}
                  />
                </Switch>

                {savingSettings && (
                  <div className="flex items-center gap-1">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-teal-200 border-t-teal-600"></div>
                    <span className="text-xs text-gray-500">Saving...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Student Self Edit Access Setting */}
            <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-100">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  <h3 className="font-medium text-gray-900 text-sm md:text-base">
                    Student Self-Edit Access
                  </h3>
                </div>
                <p className="text-xs md:text-sm text-gray-600 mt-1">
                  Allow students to edit their own profile information from
                  student portal
                </p>
                <Badge
                  variant="outline"
                  className={`mt-2 text-xs ${
                    settings.studentSelfEdit
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-700 border-gray-200"
                  }`}
                >
                  {settings.studentSelfEdit ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Switch
                  checked={settings.studentSelfEdit}
                  onCheckedChange={handleStudentSelfEditToggleRequest}
                  disabled={savingSettings}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300",
                    "data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-md ring-0 transition-all duration-300",
                      "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
                    )}
                  />
                </Switch>

                {savingSettings && (
                  <div className="flex items-center gap-1">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-purple-200 border-t-purple-600"></div>
                    <span className="text-xs text-gray-500">Saving...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Show Results Page Setting */}
            <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-100">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-orange-600" />
                  <h3 className="font-medium text-gray-900 text-sm md:text-base">
                    Public Results Page
                  </h3>
                </div>
                <p className="text-xs md:text-sm text-gray-600 mt-1">
                  Control the visibility of the Results page on the public
                  website
                </p>
                <Badge
                  variant="outline"
                  className={`mt-2 text-xs ${
                    settings.showResults
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-700 border-gray-200"
                  }`}
                >
                  {settings.showResults ? "Visible" : "Hidden"}
                </Badge>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Switch
                  checked={settings.showResults}
                  onCheckedChange={handleResultsToggleRequest}
                  disabled={savingSettings}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300",
                    "data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-gray-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-md ring-0 transition-all duration-300",
                      "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
                    )}
                  />
                </Switch>

                {savingSettings && (
                  <div className="flex items-center gap-1">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-orange-200 border-t-orange-600"></div>
                    <span className="text-xs text-gray-500">Saving...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Revaluation Setting */}
            <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-violet-50 to-sky-50 rounded-lg border border-violet-100">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-600" />
                  <h3 className="font-medium text-gray-900 text-sm md:text-base">
                    Student Revaluation
                  </h3>
                </div>
                <p className="text-xs md:text-sm text-gray-600 mt-1">
                  Control whether REVALUATION exams are visible in student portals
                </p>
                <Badge
                  variant="outline"
                  className={`mt-2 text-xs ${
                    settings.revaluationEnabled
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-700 border-gray-200"
                  }`}
                >
                  {settings.revaluationEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <Switch
                checked={settings.revaluationEnabled}
                onCheckedChange={handleRevaluationToggle}
                disabled={savingSettings}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300",
                  "data-[state=checked]:bg-violet-500 data-[state=unchecked]:bg-gray-300",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              />
            </div>

            {/* Attendance Setting */}
            <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-100">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-medium text-gray-900 text-sm md:text-base">
                    Attendance Tracking
                  </h3>
                </div>
                <p className="text-xs md:text-sm text-gray-600 mt-1">
                  Control whether the attendance tracking module is active across all portals
                </p>
                <Badge
                  variant="outline"
                  className={`mt-2 text-xs ${
                    settings.attendanceEnabled
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-700 border-gray-200"
                  }`}
                >
                  {settings.attendanceEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <Switch
                checked={settings.attendanceEnabled}
                onCheckedChange={handleAttendanceToggle}
                disabled={savingSettings}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300",
                  "data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-gray-300",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              />
            </div>

            {/* Show Admissions Setting */}
            <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg border border-teal-100">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-teal-600" />
                  <h3 className="font-medium text-gray-900 text-sm md:text-base">
                    Public Admissions
                  </h3>
                </div>
                <p className="text-xs md:text-sm text-gray-600 mt-1">
                  Control the visibility of admission links and &quot;Apply
                  Now&quot; buttons
                </p>
                <Badge
                  variant="outline"
                  className={`mt-2 text-xs ${
                    settings.showAdmissions
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-700 border-gray-200"
                  }`}
                >
                  {settings.showAdmissions ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Switch
                  checked={settings.showAdmissions}
                  onCheckedChange={handleAdmissionsToggleRequest}
                  disabled={savingSettings}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300",
                    "data-[state=checked]:bg-teal-500 data-[state=unchecked]:bg-gray-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-md ring-0 transition-all duration-300",
                      "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
                    )}
                  />
                </Switch>

                {savingSettings && (
                  <div className="flex items-center gap-1">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-teal-200 border-t-teal-600"></div>
                    <span className="text-xs text-gray-500">Saving...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Results Display Window Setting */}
            <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-lg border border-teal-100">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-teal-600" />
                  <h3 className="font-medium text-gray-900 text-sm md:text-base">
                    Result Visibility Window
                  </h3>
                </div>
                <p className="text-xs md:text-sm text-gray-600 mt-1">
                  How many days should results be visible after creation? (e.g.,
                  15 days)
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Input
                    type="number"
                    value={settings.resultWindow}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        resultWindow: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-20 h-9 rounded-lg border-teal-200 focus:ring-teal-500 bg-white shadow-sm"
                  />
                  <span className="text-xs font-bold text-teal-700">Days</span>
                  <Button
                    size="sm"
                    className="h-9 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 shadow-md ml-2"
                    onClick={saveResultWindow}
                    disabled={savingResultWindow}
                  >
                    {savingResultWindow ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Attendance Days Configuration */}
            <div className="flex flex-col p-3 md:p-4 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-lg border border-teal-100">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-teal-600" />
                <h3 className="font-medium text-gray-900 text-sm md:text-base">
                  Attendance Days Configuration
                </h3>
              </div>
              <p className="text-xs md:text-sm text-gray-600 mb-4">
                Set the total working days, required present days, and total holidays for the academic year.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-gray-700">Total Working Days</Label>
                  <Input
                    type="number"
                    value={settings.totalWorkingDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        totalWorkingDays: parseInt(e.target.value) || 0,
                      })
                    }
                    className="h-9 rounded-lg border-teal-200 focus:ring-teal-500 bg-white shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-gray-700">Required Present Days</Label>
                  <Input
                    type="number"
                    value={settings.requiredPresentDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        requiredPresentDays: parseInt(e.target.value) || 0,
                      })
                    }
                    className="h-9 rounded-lg border-teal-200 focus:ring-teal-500 bg-white shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-gray-700">Total Holidays</Label>
                  <Input
                    type="number"
                    value={settings.totalHolidays ?? 0}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        totalHolidays: parseInt(e.target.value) || 0,
                      })
                    }
                    className="h-9 rounded-lg border-teal-200 focus:ring-teal-500 bg-white shadow-sm"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  className="h-9 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 shadow-md"
                  onClick={saveAttendanceDays}
                  disabled={savingAttendanceDays}
                >
                  {savingAttendanceDays ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save Attendance Config"
                  )}
                </Button>
              </div>
            </div>

            {/* Per-Class Admission Fees Setting */}
            <div className="p-3 md:p-4 bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg border border-teal-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-teal-600" />
                  <h3 className="font-medium text-gray-900 text-sm md:text-base">
                    Admission Fees (Per Class)
                  </h3>
                </div>
                <Button
                  size="sm"
                  className="h-9 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 shadow-md"
                  onClick={saveAdmissionFees}
                  disabled={savingAdmissionFees}
                >
                  {savingAdmissionFees ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save All"
                  )}
                </Button>
              </div>
              <p className="text-xs md:text-sm text-gray-600 mb-4">
                Set the payable admission fee for each class. Enter 0 for free
                admission.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {configDropdowns.classes.map((cls) => (
                  <div key={cls.value} className="flex flex-col gap-1">
                    <Label className="text-xs font-semibold text-gray-700">
                      {cls.label}
                    </Label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-teal-700 font-bold">₹</span>
                      <Input
                        type="number"
                        min={0}
                        value={
                          settings.admissionFees?.[cls.value.toLowerCase()] ?? 0
                        }
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            admissionFees: {
                              ...prev.admissionFees,
                              [cls.value.toLowerCase()]:
                                parseInt(e.target.value) || 0,
                            },
                          }))
                        }
                        className="h-8 rounded-md border-teal-200 focus:ring-teal-500 bg-white shadow-sm text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Marquee Texts List */}
        <div className="space-y-3 md:space-y-4">
          {marqueeTexts.length === 0 ? (
            <Card className="border-0 shadow-md bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg md:rounded-xl">
              <CardContent className="flex items-center justify-center py-12 md:py-16 lg:py-20 px-4">
                <div className="text-center space-y-4 max-w-sm">
                  <div className="w-12 h-12 md:w-16 md:h-16 mx-auto bg-teal-100 rounded-full flex items-center justify-center">
                    <Globe className="h-6 w-6 md:h-8 md:w-8 text-teal-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base md:text-lg lg:text-xl font-semibold text-gray-900">
                      No marquee texts found
                    </h3>
                    <p className="text-xs md:text-sm lg:text-base text-gray-500 leading-relaxed">
                      Create your first marquee text to display important
                      announcements
                    </p>
                  </div>
                  <Button
                    onClick={handleNewMarquee}
                    className="mt-4 w-full min-h-[48px] touch-manipulation rounded-lg bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-sm font-medium"
                  >
                    <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
                    Create First Marquee Text
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            marqueeTexts.map((marquee) => (
              <Card
                key={marquee.id}
                className={`border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.01] rounded-lg md:rounded-xl ${
                  marquee.isActive
                    ? "bg-gradient-to-r from-green-50 to-teal-50 border-l-4 border-l-green-500"
                    : "bg-gradient-to-r from-gray-50 to-gray-100 border-l-4 border-l-gray-400"
                }`}
              >
                <CardContent className="p-3 md:p-4 lg:p-6">
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={marquee.isActive ? "default" : "secondary"}
                          className={`text-xs px-2 md:px-3 py-1 rounded-full font-medium ${
                            marquee.isActive
                              ? "bg-green-100 text-green-800 border-green-300"
                              : "bg-gray-100 text-gray-700 border-gray-300"
                          }`}
                        >
                          {marquee.isActive ? (
                            <>
                              <Eye className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-xs px-2 md:px-3 py-1 rounded-full bg-teal-50 text-teal-700 border-teal-300 font-medium"
                        >
                          Priority: {marquee.priority}
                        </Badge>
                      </div>

                      <div
                        className={`p-3 md:p-4 rounded-lg text-xs md:text-sm border-2 break-words shadow-sm ${
                          marquee.isActive
                            ? "bg-white border-teal-200 text-teal-900"
                            : "bg-gray-50 border-gray-200 text-gray-700"
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          <Bell className="h-4 w-4 mt-0.5 text-teal-500 flex-shrink-0" />
                          <span className="leading-relaxed break-words">
                            {marquee.text}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 bg-gray-50 p-2 md:p-3 rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">
                              Created by {marquee.createdByName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>
                              {marquee.createdAt &&
                                new Date(
                                  marquee.createdAt.seconds * 1000,
                                ).toLocaleDateString()}
                            </span>
                            {marquee.updatedAt &&
                              marquee.updatedAt.seconds !==
                                marquee.createdAt?.seconds && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-orange-600 font-medium">
                                    Updated{" "}
                                    {new Date(
                                      marquee.updatedAt.seconds * 1000,
                                    ).toLocaleDateString()}
                                  </span>
                                </>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(marquee)}
                        className="flex-1 min-h-[48px] touch-manipulation rounded-lg border-teal-300 text-teal-600 hover:bg-teal-50 transition-colors text-xs md:text-sm font-medium"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(marquee.id)}
                        className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 min-h-[48px] touch-manipulation rounded-lg border-red-300 transition-colors text-xs md:text-sm font-medium"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Add/Edit Marquee Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl bg-white mx-3 md:mx-4 max-h-[90vh] overflow-y-auto rounded-lg md:rounded-xl shadow-2xl border-0 w-[calc(100vw-24px)] md:w-auto">
            <DialogHeader className="space-y-2 md:space-y-3 pb-4 md:pb-6 border-b border-gray-100">
              <DialogTitle className="text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent leading-tight">
                {editingMarquee ? "Edit Marquee Text" : "Add New Marquee Text"}
              </DialogTitle>
              <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                {editingMarquee
                  ? "Update the marquee text details below"
                  : "Create a new scrolling text for the website"}
              </p>
            </DialogHeader>

            <form
              onSubmit={handleSubmit}
              className="space-y-4 md:space-y-6 pt-4 md:pt-6"
            >
              <div className="space-y-2">
                <Label
                  htmlFor="text"
                  className="text-xs md:text-sm font-semibold text-gray-700 flex items-center"
                >
                  <Bell className="h-4 w-4 mr-2 text-teal-500 flex-shrink-0" />
                  Marquee Text *
                </Label>
                <Textarea
                  id="text"
                  value={formData.text}
                  onChange={(e) =>
                    setFormData({ ...formData, text: e.target.value })
                  }
                  placeholder="Enter the text that will scroll on the website..."
                  required
                  rows={4}
                  className="resize-none rounded-lg border-gray-300 focus:border-teal-500 focus:ring-teal-500 transition-colors text-sm"
                />
                <p className="text-xs text-gray-500 leading-relaxed">
                  This text will be displayed as a scrolling marquee on the
                  website
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="priority"
                  className="text-xs md:text-sm font-semibold text-gray-700 flex items-center"
                >
                  <Settings className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                  Priority *
                </Label>
                <Input
                  id="priority"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: parseInt(e.target.value),
                    })
                  }
                  placeholder="1-10 (1 = highest priority)"
                  required
                  className="rounded-lg border-gray-300 focus:border-green-500 focus:ring-green-500 transition-colors text-sm"
                />
                <p className="text-xs text-gray-500 leading-relaxed">
                  Lower numbers appear first. Use 1 for most important
                  announcements.
                </p>
              </div>

              <div className="flex items-start space-x-3 p-3 md:p-4 bg-gray-50 rounded-lg">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor="isActive"
                    className="text-xs md:text-sm font-semibold text-gray-700 cursor-pointer block"
                  >
                    Show on website
                  </Label>
                  <p className="text-xs text-gray-500 leading-relaxed mt-1">
                    Toggle to control whether this text appears on the website
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4 md:pt-6 border-t border-gray-100">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[48px] touch-manipulation rounded-lg bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 shadow-md transition-all duration-200 text-sm font-medium"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2 flex-shrink-0"></div>
                      Saving...
                    </>
                  ) : editingMarquee ? (
                    "Update Marquee"
                  ) : (
                    "Create Marquee"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={submitting}
                  className="w-full min-h-[48px] touch-manipulation rounded-lg border-gray-300 hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Alert className="border-0 bg-gradient-to-r from-teal-50 to-green-50 shadow-sm rounded-lg md:rounded-xl">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-teal-100 rounded-full flex-shrink-0">
              <Settings className="h-4 w-4 text-teal-600" />
            </div>
            <AlertDescription className="text-xs md:text-sm text-gray-700 leading-relaxed flex-1">
              <span className="font-semibold text-gray-900">How it works:</span>{" "}
              Marquee texts will appear on the main website in order of
              priority. Active texts will scroll automatically in a continuous
              loop to grab visitors&apos; attention for important announcements.
            </AlertDescription>
          </div>
        </Alert>
      </div>

      {/* Student Edit Access Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                <Settings className="h-4 w-4 text-amber-600" />
              </div>
              Confirm Sadar Student Edit Access Change
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  You are about to{" "}
                  <strong>{pendingToggleValue ? "enable" : "disable"}</strong>{" "}
                  student edit access.
                </p>

                {pendingToggleValue ? (
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                      <strong>Enabling student edit access will allow:</strong>
                    </p>
                    <ul className="list-disc list-inside text-sm text-green-700 mt-2 space-y-1">
                      <li>
                        {"Sadars to edit their student's profile information"}
                      </li>
                      <li>
                        {"Sadars to update their student's application details"}
                      </li>
                      <li>
                        {"Sadars to modify their student's personal data"}
                      </li>
                    </ul>
                  </div>
                ) : (
                  <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800">
                      <strong>
                        Disabling student edit access will prevent:
                      </strong>
                    </p>
                    <ul className="list-disc list-inside text-sm text-red-700 mt-2 space-y-1">
                      <li>{"Sadars from editing their student's profiles"}</li>
                      <li>
                        {
                          "Sadars from updating their student's application details"
                        }
                      </li>
                      <li>
                        {
                          "Any modifications to student data by sadars themselves"
                        }
                      </li>
                    </ul>
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  This change will take effect immediately for all sadars. Are
                  you sure you want to continue?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelToggle}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleStudentEdit}
              className={
                pendingToggleValue
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {pendingToggleValue ? "Enable Access" : "Disable Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Results Page Toggle Confirmation Dialog */}
      <AlertDialog
        open={showResultsConfirmDialog}
        onOpenChange={setShowResultsConfirmDialog}
      >
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                <Database className="h-4 w-4 text-orange-600" />
              </div>
              Confirm Results Page Visibility Change
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  You are about to{" "}
                  <strong>{pendingResultsValue ? "show" : "hide"}</strong> the
                  results page on the website.
                </p>

                {pendingResultsValue ? (
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                      <strong>Showing the results page will:</strong>
                    </p>
                    <ul className="list-disc list-inside text-sm text-green-700 mt-2 space-y-1">
                      <li>Make the Results link visible in the header</li>
                      <li>
                        Allow students and public to search for exam results
                      </li>
                    </ul>
                  </div>
                ) : (
                  <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800">
                      <strong>Hiding the results page will:</strong>
                    </p>
                    <ul className="list-disc list-inside text-sm text-red-700 mt-2 space-y-1">
                      <li>Remove the Results link from the header</li>
                      <li>
                        Show an error/maintenance page if users access the URL
                        directly
                      </li>
                    </ul>
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  This change will take effect immediately. Are you sure?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelResultsToggle}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleResults}
              className={
                pendingResultsValue
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {pendingResultsValue ? "Show Results Page" : "Hide Results Page"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Student Self-Edit Access Confirmation Dialog */}
      <AlertDialog
        open={showStudentSelfEditConfirmDialog}
        onOpenChange={setShowStudentSelfEditConfirmDialog}
      >
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
              Confirm Student Self-Edit Access Change
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  You are about to{" "}
                  <strong>
                    {pendingStudentSelfEditValue ? "enable" : "disable"}
                  </strong>{" "}
                  student self-edit access.
                </p>

                {pendingStudentSelfEditValue ? (
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                      <strong>
                        Enabling student self-edit access will allow:
                      </strong>
                    </p>
                    <ul className="list-disc list-inside text-sm text-green-700 mt-2 space-y-1">
                      <li>Students to edit their own profile information</li>
                      <li>Students to update their personal details</li>
                      <li>Students to modify their contact information</li>
                    </ul>
                  </div>
                ) : (
                  <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800">
                      <strong>
                        Disabling student self-edit access will prevent:
                      </strong>
                    </p>
                    <ul className="list-disc list-inside text-sm text-red-700 mt-2 space-y-1">
                      <li>Students from editing their own profiles</li>
                      <li>Students from updating their personal information</li>
                      <li>
                        Any self-modifications to student data by students
                      </li>
                    </ul>
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  This change will take effect immediately for all students. Are
                  you sure you want to continue?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelStudentSelfEditToggle}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleStudentSelfEdit}
              className={
                pendingStudentSelfEditValue
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {pendingStudentSelfEditValue ? "Enable Access" : "Disable Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admissions Toggle Confirmation Dialog */}
      <AlertDialog
        open={showAdmissionsConfirmDialog}
        onOpenChange={setShowAdmissionsConfirmDialog}
      >
        <AlertDialogContent className="bg-white" id="admissions-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                <GraduationCap className="h-4 w-4 text-teal-600" />
              </div>
              Confirm Admissions Status Change
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  You are about to{" "}
                  <strong>{pendingAdmissionsValue ? "open" : "close"}</strong>{" "}
                  the admissions process.
                </p>

                {pendingAdmissionsValue ? (
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                      <strong>Opening admissions will:</strong>
                    </p>
                    <ul className="list-disc list-inside text-sm text-green-700 mt-2 space-y-1">
                      <li>Show the Admission button in the main header</li>
                      <li>
                        Show &quot;Apply Now&quot; buttons on the home page
                      </li>
                      <li>Allow new student applications at all levels</li>
                    </ul>
                  </div>
                ) : (
                  <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800">
                      <strong>Closing admissions will:</strong>
                    </p>
                    <ul className="list-disc list-inside text-sm text-red-700 mt-2 space-y-1">
                      <li>Hide admission links from the header and website</li>
                      <li>Disable the &quot;Apply Now&quot; buttons</li>
                      <li>
                        Prevent new student applications from being submitted
                      </li>
                    </ul>
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  This change will take effect immediately. Are you sure?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelAdmissionsToggle}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleAdmissions}
              className={
                pendingAdmissionsValue
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {pendingAdmissionsValue ? "Open Admissions" : "Close Admissions"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
