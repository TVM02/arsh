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
import Layout from "@/components/Layout";

export default function TeacherNoticesPage() {
  const { user, userData } = useAuthStore();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    priority: "medium",
    expiryDate: "",
    showOnDashboard: true,
  });

  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);

      let madarsaId = userData?.madarsaId;

      if (!madarsaId) {
        madarsaId = "madarsa-001"; // Default or fallback madarsa ID
      }

      // Fetch madarsa info to get district and document ID
      let madarsaData = null;
      let madarsaDocId = "";
      const madarsaQuery = query(
        collection(db, "madarsas"),
        where("madarsaId", "==", madarsaId)
      );
      const madarsaSnapshot = await getDocs(madarsaQuery);
      if (!madarsaSnapshot.empty) {
        madarsaData = madarsaSnapshot.docs[0].data();
        madarsaDocId = madarsaSnapshot.docs[0].id;
      }

      // 1. Local Query
      const localQuery = query(
        collection(db, "notices"),
        where("madarsaId", "==", madarsaId),
        orderBy("createdAt", "desc")
      );

      // 2. Central Query
      const centralQuery = query(
        collection(db, "notices"),
        where("type", "==", "central"),
        orderBy("createdAt", "desc")
      );

      // 3. Mekhala Query
      const mekhalaQuery = query(
        collection(db, "notices"),
        where("createdByRole", "==", "mekhala_admin")
      );

      const [localSnapshot, centralSnapshot, mekhalaSnapshot] = await Promise.all([
        getDocs(localQuery),
        getDocs(centralQuery),
        getDocs(mekhalaQuery),
      ]);

      const localDocs = localSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const centralDocs = centralSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const mekhalaDocs = mekhalaSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Merge maps to deduplicate by ID
      const allNoticesMap = new Map();
      [...localDocs, ...centralDocs, ...mekhalaDocs].forEach((notice) => {
        allNoticesMap.set(notice.id, notice);
      });

      const mergedNotices = Array.from(allNoticesMap.values());

      const filteredNotices = mergedNotices.filter((notice) => {
        // Active check
        if (notice.isActive === false) return false;
        if (notice.deleted === true) return false;

        // If mekhala notice:
        if (notice.createdByRole === "mekhala_admin") {
          if (notice.targetType === "all" || notice.targetType === "teachers_portal") {
            return madarsaData && notice.targetDistricts?.includes(madarsaData.district);
          }
          if (notice.targetType === "specific_districts") {
            return madarsaData && notice.targetDistricts?.includes(madarsaData.district);
          }
          if (notice.targetType === "specific_madarsas") {
            return notice.targetMadarsas?.includes(madarsaId) || (madarsaDocId && notice.targetMadarsas?.includes(madarsaDocId));
          }
          return false;
        }

        // Target Audience Check
        const allowedAudiences = ["students", "teachers", "all"];
        // If targetAudience is specified, it must be in the allowed list
        if (
          notice.targetAudience &&
          !allowedAudiences.includes(notice.targetAudience)
        ) {
          return false;
        }

        // Central Check
        if (notice.type === "central") {
          if (notice.targetMahals && notice.targetMahals.length > 0) {
            if (!notice.targetMahals.includes(madarsaId)) {
              return false;
            }
          }
        }
        return true;
      });

      // Sort manually after merge
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
      priority: "medium",
      expiryDate: "",
      showOnDashboard: true,
    });
    setEditingNotice(null);
  };

  const handleEdit = (notice) => {
    // Only allow editing if the notice was created by this teacher
    if (notice.createdBy !== user?.uid) {
      toast.error("You can only edit notices you created");
      return;
    }

    setEditingNotice(notice);
    setFormData({
      title: notice.title,
      content: notice.content,
      priority: notice.priority,
      expiryDate: notice.expiryDate
        ? new Date(notice.expiryDate.seconds * 1000).toISOString().split("T")[0]
        : "",
      showOnDashboard: notice.showOnDashboard ?? true,
      madarsaId: notice.madarsaId || userData?.madarsaId || "madarsa-001",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const noticeData = {
        title: formData.title,
        content: formData.content,
        targetAudience: "students", // Teachers can only create for students
        priority: formData.priority,
        showOnDashboard: formData.showOnDashboard,
        createdBy: user.uid,
        createdByName: user.displayName || user.email,
        madarsaId: userData?.madarsaId || "madarsa-001",
        updatedAt: new Date(),
        classLevel: formData.classLevel || "All",
      };

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
    // Check if the notice was created by this teacher
    const noticeToDelete = notices.find((n) => n.id === noticeId);
    if (noticeToDelete?.createdBy !== user?.uid) {
      toast.error("You can only delete notices you created");
      return;
    }

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

  // Filter active notices
  const activeNotices = notices.filter((notice) => !isExpired(notice));
  const expiredNotices = notices.filter((notice) => isExpired(notice));

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
    <Layout user={user}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Student Notices
            </h1>
            <p className="text-gray-600 mt-2 text-sm md:text-base">
              Create and manage notices for your students
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
              <Button
                className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Notice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-full sm:max-w-2xl w-11/12 sm:w-full max-h-[90vh] overflow-y-auto bg-white">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">
                  {editingNotice ? "Edit Notice" : "Create New Notice"}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
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
                    required
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
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
                    required
                    className="min-h-[100px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-sm font-medium">
                    Priority *
                  </Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) =>
                      setFormData({ ...formData, priority: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto bg-white">
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="low">Low Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="classLevel" className="text-sm font-medium">
                    Class Level *
                  </Label>
                  <Select
                    value={formData.classLevel}
                    onValueChange={(value) =>
                      setFormData({ ...formData, classLevel: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select class level" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto bg-white">
                      <SelectItem value="All">All</SelectItem>
                      <SelectItem value="1">Class 1</SelectItem>
                      <SelectItem value="2">Class 2</SelectItem>
                      <SelectItem value="3">Class 3</SelectItem>
                      <SelectItem value="4">Class 4</SelectItem>
                      <SelectItem value="5">Class 5</SelectItem>
                      <SelectItem value="6">Class 6</SelectItem>
                      <SelectItem value="7">Class 7</SelectItem>
                      <SelectItem value="8">Class 8</SelectItem>
                      <SelectItem value="9">Class 9</SelectItem>
                      <SelectItem value="10">Class 10</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiryDate" className="text-sm font-medium">
                    Expiry Date (Optional)
                  </Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) =>
                      setFormData({ ...formData, expiryDate: e.target.value })
                    }
                    className="w-full"
                  />
                  <p className="text-xs sm:text-sm text-gray-500">
                    Leave empty for permanent notice
                  </p>
                </div>

                <div className="flex items-center space-x-2 pt-2">
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
                  <Label htmlFor="showOnDashboard" className="text-sm">
                    Show on student dashboard
                  </Label>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto order-1"
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
                    className="w-full sm:w-auto order-2"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Bell className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">
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
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Eye className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">
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
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Expired Notices
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
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Active Notices ({activeNotices.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-6 sm:py-8">
                <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-4 border-teal-600 border-t-transparent mx-auto"></div>
                <p className="text-sm sm:text-base text-gray-600 mt-4">
                  Loading notices...
                </p>
              </div>
            ) : activeNotices.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-sm sm:text-base text-gray-600 mb-4">
                  No active notices found.
                </p>
                <Button
                  onClick={() => setIsDialogOpen(true)}
                  className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto"
                >
                  Create Your First Notice
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeNotices.map((notice) => (
                  <Card
                    key={notice.id}
                    className="border-l-4 border-l-teal-500"
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-3 lg:space-y-0">
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-2">
                            <h3 className="text-base sm:text-lg font-semibold">
                              {formatContentWithLinks(notice.title)}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {notice.type === "central" && (
                                <Badge className="bg-teal-600 hover:bg-teal-700 text-xs text-white">
                                  Central
                                </Badge>
                              )}
                              <Badge
                                className={getPriorityColor(notice.priority)}
                              >
                                {notice.priority} priority
                              </Badge>
                              {notice.showOnDashboard && (
                                <Badge variant="outline">On Dashboard</Badge>
                              )}
                              {notice.createdBy === user?.uid && (
                                <Badge variant="outline">Created by you</Badge>
                              )}
                              {notice.classLevel && (
                                <Badge variant="outline" className="capitalize">
                                  Class: {notice.classLevel}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <p className="text-sm sm:text-base text-gray-600 mb-3 whitespace-pre-wrap">
                            {formatContentWithLinks(notice.content)}
                          </p>

                          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs sm:text-sm text-gray-500">
                            <span>
                              Created:{" "}
                              {notice.createdAt?.seconds
                                ? new Date(
                                    notice.createdAt.seconds * 1000
                                  ).toLocaleDateString()
                                : "N/A"}
                              {notice.createdByName &&
                                ` by ${notice.createdByName}`}
                            </span>
                            {notice.expiryDate && (
                              <span>
                                Expires:{" "}
                                {notice.expiryDate.seconds
                                  ? new Date(
                                      notice.expiryDate.seconds * 1000
                                    ).toLocaleDateString()
                                  : new Date(
                                      notice.expiryDate
                                    ).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {notice.createdBy === user?.uid && (
                          <div className="flex space-x-2 lg:ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(notice)}
                              className="flex-1 lg:flex-none"
                            >
                              <Edit className="w-4 h-4 lg:mr-0 mr-2" />
                              <span className="lg:hidden">Edit</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleDelete(notice.id, notice.title)
                              }
                              className="text-red-600 hover:text-red-700 flex-1 lg:flex-none"
                            >
                              <Trash2 className="w-4 h-4 lg:mr-0 mr-2" />
                              <span className="lg:hidden">Delete</span>
                            </Button>
                          </div>
                        )}
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
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                <span>Expired Notices ({expiredNotices.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {expiredNotices.map((notice) => (
                  <Card
                    key={notice.id}
                    className="border-l-4 border-l-red-500 opacity-60"
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-3 lg:space-y-0">
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-2">
                            <h3 className="text-base sm:text-lg font-semibold">
                              {formatContentWithLinks(notice.title)}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary">EXPIRED</Badge>
                              {notice.createdBy === user?.uid && (
                                <Badge variant="outline">Created by you</Badge>
                              )}
                            </div>
                          </div>

                          <p className="text-sm sm:text-base text-gray-600 mb-3">
                            {formatContentWithLinks(notice.content)}
                          </p>

                          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs sm:text-sm text-gray-500">
                            <span>
                              Expired:{" "}
                              {notice.expiryDate.seconds
                                ? new Date(
                                    notice.expiryDate.seconds * 1000
                                  ).toLocaleDateString()
                                : new Date(
                                    notice.expiryDate
                                  ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {notice.createdBy === user?.uid && (
                          <div className="flex space-x-2 lg:ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleDelete(notice.id, notice.title)
                              }
                              className="text-red-600 hover:text-red-700 w-full lg:w-auto"
                            >
                              <Trash2 className="w-4 h-4 lg:mr-0 mr-2" />
                              <span className="lg:hidden">Delete</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
