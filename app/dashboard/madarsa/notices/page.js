"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Calendar,
  Users,
  Bell,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
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
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar"; // Import your Sidebar component
import Layout from "@/components/Layout"; // Import your Layout component if you have one

export default function NoticesManagementPage() {
  const { user, userData } = useAuthStore();

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // State for sidebar toggle
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    targetAudience: "",
    priority: "",
    expiryDate: "",
    showOnDashboard: true,
  });

  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);

      const madarsaId = userData?.madarsaId;
      if (!madarsaId) {
        // If no madarsaId, we probably shouldn't show anything or show error?
        // But for now let's just proceed with empty? Or return.
        // Assuming userData is loaded as there's a check in render.
      }

      // 1. Local Notices
      let localDocs = [];
      if (madarsaId) {
        const localQuery = query(
          collection(db, "notices"),
          where("madarsaId", "==", madarsaId),
          orderBy("createdAt", "desc"),
        );
        const localSnapshot = await getDocs(localQuery);
        localDocs = localSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      }

      // 2. Central Notices
      const centralQuery = query(
        collection(db, "notices"),
        where("type", "==", "central"),
        orderBy("createdAt", "desc"),
      );
      const centralSnapshot = await getDocs(centralQuery);
      const centralDocs = centralSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Merge maps to deduplicate by ID
      const allNoticesMap = new Map();
      [...localDocs, ...centralDocs].forEach((notice) => {
        allNoticesMap.set(notice.id, notice);
      });

      const mergedNotices = Array.from(allNoticesMap.values());

      // Filter
      const filteredNotices = mergedNotices.filter((notice) => {
        // Active check
        if (notice.isActive === false) return false;

        // Target Audience check
        if (notice.targetAudience) {
          const audience = String(notice.targetAudience).toLowerCase();
          // Sadar should only see 'all' or 'madarsas'
          if (audience !== "all" && audience !== "madarsas") {
            return false;
          }
        }

        // Central CheckTarget
        if (notice.type === "central") {
          if (notice.targetMahals && notice.targetMahals.length > 0) {
            if (madarsaId && !notice.targetMahals.includes(madarsaId)) {
              return false;
            }
          }
        }
        return true;
      });

      // Sort
      filteredNotices.sort((a, b) => {
        const dateA = a.createdAt?.seconds
          ? a.createdAt.seconds
          : a.createdAt
            ? new Date(a.createdAt).getTime() / 1000
            : 0;
        const dateB = b.createdAt?.seconds
          ? b.createdAt.seconds
          : b.createdAt
            ? new Date(b.createdAt).getTime() / 1000
            : 0;
        return dateB - dateA;
      });

      setNotices(filteredNotices);
    } catch (error) {
      console.error("Error fetching notices:", error);
      toast.error("Failed to fetch notices");
    } finally {
      setLoading(false);
    }
  }, [userData]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      targetAudience: "",
      priority: "",
      expiryDate: "",
      showOnDashboard: true,
    });
    setEditingNotice(null);
  };

  const handleEdit = (notice) => {
    setEditingNotice(notice);
    setFormData({
      title: notice.title,
      content: notice.content,
      targetAudience: notice.targetAudience,
      priority: notice.priority,
      expiryDate: notice.expiryDate
        ? new Date(notice.expiryDate.seconds * 1000).toISOString().split("T")[0]
        : "",
      showOnDashboard: notice.showOnDashboard ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    setSubmitting(true);

    try {
      const noticeData = {
        title: formData.title,
        content: formData.content,
        targetAudience: formData.targetAudience,
        priority: formData.priority,
        showOnDashboard: formData.showOnDashboard,
        createdBy: user.uid,
        createdByName: user.displayName || user.email,
        updatedAt: new Date(),
        madarsaId: userData?.madarsaId,
      };

      // Validate madarsaId is present (prevents cross-portal leakage)
      if (!noticeData.madarsaId) {
        toast.error(
          "Session error: madrasa information missing. Please refresh and try again.",
        );
        setSubmitting(false);
        return;
      }

      // For mekhala-targeted notices, add mekhala metadata
      if (formData.targetAudience === "mekhala") {
        noticeData.forMekhala = true;
        noticeData.mekhalaName = userData?.district || userData?.mekhala || "";
      }

      // Add expiry date if provided
      if (formData.expiryDate) {
        noticeData.expiryDate = new Date(formData.expiryDate);
      }

      if (editingNotice) {
        // Update existing notice
        await updateDoc(doc(db, "notices", editingNotice.id), noticeData);
        toast.success("Notice updated successfully!");
      } else {
        // Create new notice
        noticeData.createdAt = new Date();
        await addDoc(collection(db, "notices"), noticeData);
        toast.success("Notice created successfully!");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchNotices();
    } catch (error) {
      console.error("Error saving notice:", error);
      toast.error("Failed to save notice");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (noticeId, noticeTitle) => {
    if (window.confirm(`Are you sure you want to delete "${noticeTitle}"?`)) {
      try {
        await deleteDoc(doc(db, "notices", noticeId));
        toast.success("Notice deleted successfully");
        fetchNotices();
      } catch (error) {
        console.error("Error deleting notice:", error);
        toast.error("Failed to delete notice");
      }
    }
  };

  const isExpired = (notice) => {
    if (!notice.expiryDate) return false;
    const expiryDate = notice.expiryDate.seconds
      ? new Date(notice.expiryDate.seconds * 1000)
      : new Date(notice.expiryDate);
    return expiryDate < new Date();
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getAudienceColor = (audience) => {
    switch (audience) {
      case "teachers":
        return "bg-blue-100 text-blue-800";
      case "students":
        return "bg-purple-100 text-purple-800";
      case "all":
        return "bg-teal-100 text-teal-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Filter active notices
  const activeNotices = notices.filter((notice) => !isExpired(notice));
  const expiredNotices = notices.filter((notice) => isExpired(notice));

  // Early return if user is not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  // Helper function
  const formatContentWithLinks = (content) => {
    if (!content) return "";
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <Layout user={user} role={userData?.role || user?.role}>
      <div className="flex h-screen overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div className="min-w-0 flex-1">
                <Button
                  variant="ghost"
                  className="lg:hidden mb-2 p-2"
                  onClick={() => setSidebarOpen(true)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </Button>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                  Notices Management
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
                  Create and manage notices for teachers and students
                </p>
              </div>

              <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) resetForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto min-h-[44px] font-medium">
                    <Plus className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>Create Notice</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-2xl bg-white max-h-[90vh] overflow-y-auto mx-auto">
                  <DialogHeader className="pb-4">
                    <DialogTitle className="text-lg sm:text-xl">
                      {editingNotice ? "Edit Notice" : "Create New Notice"}
                    </DialogTitle>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="title" className="text-sm font-medium">
                        Title *
                      </Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        placeholder="Notice title..."
                        className="mt-1 h-10 sm:h-9"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="content" className="text-sm font-medium">
                        Content *
                      </Label>
                      <Textarea
                        id="content"
                        value={formData.content}
                        onChange={(e) =>
                          setFormData({ ...formData, content: e.target.value })
                        }
                        placeholder="Notice content..."
                        rows={4}
                        className="mt-1 resize-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label
                          htmlFor="targetAudience"
                          className="text-sm font-medium"
                        >
                          Target Audience *
                        </Label>
                        <Select
                          value={formData.targetAudience}
                          onValueChange={(value) =>
                            setFormData({ ...formData, targetAudience: value })
                          }
                        >
                          <SelectTrigger className="mt-1 h-10 sm:h-9">
                            <SelectValue placeholder="Select audience" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 bg-white">
                            <SelectItem value="all">
                              All (Teachers &amp; Students of this Madrasa)
                            </SelectItem>
                            <SelectItem value="teachers">
                              Teachers Only
                            </SelectItem>
                            <SelectItem value="students">
                              Students Only
                            </SelectItem>
                            <SelectItem value="mekhala">
                              Mekhala (Forward to Mekhala)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label
                          htmlFor="priority"
                          className="text-sm font-medium"
                        >
                          Priority *
                        </Label>
                        <Select
                          value={formData.priority}
                          onValueChange={(value) =>
                            setFormData({ ...formData, priority: value })
                          }
                        >
                          <SelectTrigger className="mt-1 h-10 sm:h-9">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="high">High Priority</SelectItem>
                            <SelectItem value="medium">
                              Medium Priority
                            </SelectItem>
                            <SelectItem value="low">Low Priority</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label
                        htmlFor="expiryDate"
                        className="text-sm font-medium"
                      >
                        Expiry Date (Optional)
                      </Label>
                      <Input
                        id="expiryDate"
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={formData.expiryDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            expiryDate: e.target.value,
                          })
                        }
                        className="mt-1 h-10 sm:h-9"
                      />
                      <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        Leave empty for permanent notice
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 py-2">
                      <input
                        type="checkbox"
                        id="showOnDashboard"
                        checked={formData.showOnDashboard}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            showOnDashboard: e.target.checked,
                          })
                        }
                        className="rounded w-4 h-4"
                      />
                      <Label
                        htmlFor="showOnDashboard"
                        className="text-sm font-medium"
                      >
                        Show on dashboard
                      </Label>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="bg-teal-600 hover:bg-teal-700 min-h-[44px] font-medium flex-1 sm:flex-none"
                      >
                        {submitting
                          ? "Saving..."
                          : editingNotice
                            ? "Update Notice"
                            : "Create Notice"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                        className="min-h-[44px] font-medium flex-1 sm:flex-none"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Bell className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-gray-600 truncate">
                        Total Notices
                      </p>
                      <p className="text-lg sm:text-xl font-bold">
                        {notices.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Eye className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-gray-600 truncate">
                        Active Notices
                      </p>
                      <p className="text-lg sm:text-xl font-bold">
                        {activeNotices.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-gray-600 truncate">
                        High Priority
                      </p>
                      <p className="text-lg sm:text-xl font-bold">
                        {notices.filter((n) => n.priority === "high").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-gray-600 truncate">
                        Expired
                      </p>
                      <p className="text-lg sm:text-xl font-bold">
                        {expiredNotices.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Active Notices */}
            <Card>
              <CardHeader className="p-4 sm:p-5 md:p-6">
                <CardTitle className="flex items-center space-x-2 text-base sm:text-lg md:text-xl">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>Active Notices ({activeNotices.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
                {loading ? (
                  <div className="text-center py-8 sm:py-10 md:py-12">
                    <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-teal-600 border-t-transparent mx-auto"></div>
                    <p className="text-gray-600 mt-4 text-sm sm:text-base">
                      Loading notices...
                    </p>
                  </div>
                ) : activeNotices.length === 0 ? (
                  <div className="text-center py-8 sm:py-10 md:py-12">
                    <Bell className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      No active notices found.
                    </p>
                    <Button
                      onClick={() => setIsDialogOpen(true)}
                      className="bg-teal-600 hover:bg-teal-700 min-h-[44px] font-medium"
                    >
                      Create Your First Notice
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {activeNotices.map((notice) => (
                      <Card
                        key={notice.id}
                        className="border-l-4 border-l-teal-500"
                      >
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-3 lg:space-y-0">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 mb-3">
                                <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight">
                                  {formatContentWithLinks(notice.title)}
                                </h3>
                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                  {notice.type === "central" && (
                                    <Badge className="bg-teal-600 hover:bg-teal-700 text-xs text-white">
                                      Central
                                    </Badge>
                                  )}
                                  <Badge
                                    className={`text-xs font-medium ${getPriorityColor(
                                      notice.priority,
                                    )}`}
                                  >
                                    {notice.priority} priority
                                  </Badge>
                                  <Badge
                                    className={`text-xs font-medium ${getAudienceColor(
                                      notice.targetAudience,
                                    )}`}
                                  >
                                    {notice.targetAudience === "all"
                                      ? "All"
                                      : notice.targetAudience}
                                  </Badge>
                                  {notice.showOnDashboard && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Dashboard
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <p className="text-gray-600 mb-3 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                                {formatContentWithLinks(notice.content)}
                              </p>

                              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                                <span>
                                  <span className="font-medium">Created:</span>{" "}
                                  {notice.createdAt?.seconds
                                    ? new Date(
                                        notice.createdAt.seconds * 1000,
                                      ).toLocaleDateString()
                                    : "N/A"}
                                  {notice.createdByName &&
                                    ` by ${notice.createdByName}`}
                                </span>
                                {notice.expiryDate && (
                                  <span>
                                    <span className="font-medium">
                                      Expires:
                                    </span>{" "}
                                    {notice.expiryDate.seconds
                                      ? new Date(
                                          notice.expiryDate.seconds * 1000,
                                        ).toLocaleDateString()
                                      : new Date(
                                          notice.expiryDate,
                                        ).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-row lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2 lg:ml-4">
                              {user &&
                                (notice.createdBy === user.uid ||
                                  notice.createdBy === user.email) && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEdit(notice)}
                                      className="flex-1 lg:flex-none min-h-[36px] text-xs sm:text-sm"
                                    >
                                      <Edit className="w-4 h-4 mr-1 lg:mr-0" />
                                      <span className="lg:hidden">Edit</span>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleDelete(notice.id, notice.title)
                                      }
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-1 lg:flex-none min-h-[36px] text-xs sm:text-sm"
                                    >
                                      <Trash2 className="w-4 h-4 mr-1 lg:mr-0" />
                                      <span className="lg:hidden">Delete</span>
                                    </Button>
                                  </>
                                )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expired Notices */}
            {expiredNotices.length > 0 && (
              <Card>
                <CardHeader className="p-4 sm:p-5 md:p-6">
                  <CardTitle className="flex items-center space-x-2 text-base sm:text-lg md:text-xl">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0" />
                    <span>Expired Notices ({expiredNotices.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
                  <div className="space-y-3 sm:space-y-4">
                    {expiredNotices.map((notice) => (
                      <Card
                        key={notice.id}
                        className="border-l-4 border-l-red-500 opacity-60"
                      >
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-3 lg:space-y-0">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 mb-3">
                                <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight">
                                  {formatContentWithLinks(notice.title)}
                                </h3>
                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs font-medium"
                                  >
                                    EXPIRED
                                  </Badge>
                                  <Badge
                                    className={`text-xs font-medium ${getAudienceColor(
                                      notice.targetAudience,
                                    )}`}
                                  >
                                    {notice.targetAudience === "all"
                                      ? "All"
                                      : notice.targetAudience}
                                  </Badge>
                                </div>
                              </div>

                              <p className="text-gray-600 mb-3 text-sm sm:text-base leading-relaxed">
                                {formatContentWithLinks(notice.content)}
                              </p>

                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                                <span>
                                  <span className="font-medium">Expired:</span>{" "}
                                  {notice.expiryDate.seconds
                                    ? new Date(
                                        notice.expiryDate.seconds * 1000,
                                      ).toLocaleDateString()
                                    : new Date(
                                        notice.expiryDate,
                                      ).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            <div className="flex justify-end lg:ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleDelete(notice.id, notice.title)
                                }
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 min-h-[36px] text-xs sm:text-sm"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                <span>Delete</span>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
