/* Updated UI with layout improvements */
"use client";

import { useState, useEffect } from "react";
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
  Plus,
  Calendar,
  Users,
  Bell,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
  Send,
  Download,
  FileText,
  Settings,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  deleteDoc,
  addDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/authUtils";
import Layout from "@/components/Layout";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/searchable-select";

const CENTRAL_NOTICES_COLLECTION = "centralNotices";

const getDateValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  if (typeof value._seconds === "number")
    return new Date(value._seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function CentralAdminNoticesPage() {
  const { user, userData } = useAuth();
  const [notices, setNotices] = useState([]);
  const [madarsas, setMahals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Filter and search states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMahal, setSelectedMahal] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    targetMahals: [],
    targetAudience: "all",
    priority: "medium",
    expiryDate: "",
    showOnDashboard: true,
  });

  useEffect(() => {
    fetchNotices();
    fetchMahals();
  }, []);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const centralQuery = query(
        collection(db, CENTRAL_NOTICES_COLLECTION),
        orderBy("createdAt", "desc"),
      );
      const centralSnapshot = await getDocs(centralQuery);
      const centralData = centralSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        type: "central",
      }));

      const allNotices = centralData.sort((a, b) => {
        return (
          (getDateValue(b.createdAt) || 0) - (getDateValue(a.createdAt) || 0)
        );
      });

      setNotices(allNotices);
    } catch (err) {
      toast.error("Failed to fetch notices");
    } finally {
      setLoading(false);
    }
  };

  const fetchMahals = async () => {
    try {
      const q = query(collection(db, "madarsas"), orderBy("name"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMahals(data);
    } catch (err) {
      toast.error("Failed to fetch madarsas");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      targetMahals: [],
      targetAudience: "all",
      priority: "medium",
      expiryDate: "",
      showOnDashboard: true,
    });
    setEditingNotice(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const notice = {
        ...formData,
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : null,
        createdBy: user?.uid,
        createdByName: user?.displayName || userData?.name || "Central Admin",
        createdAt: editingNotice ? editingNotice.createdAt : new Date(),
        updatedAt: new Date(),
        isActive: true,
        sender: "central_admin",
        type: "central", // Explicitly set type
      };

      if (editingNotice) {
        await updateDoc(
          doc(db, CENTRAL_NOTICES_COLLECTION, editingNotice.id),
          notice,
        );
        await setDoc(doc(db, "notices", editingNotice.id), notice);
        toast.success("Notice updated successfully");
      } else {
        const docRef = await addDoc(collection(db, CENTRAL_NOTICES_COLLECTION), notice);
        await setDoc(doc(db, "notices", docRef.id), notice);
        toast.success("Notice created successfully");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchNotices();
    } catch (err) {
      console.error("Error saving notice:", err);
      toast.error(`Error saving notice: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    id: null,
    type: null,
  });

  const handleDelete = (id, noticeType) => {
    setDeleteConfirmation({
      isOpen: true,
      id,
      type: noticeType,
    });
  };

  const confirmDelete = async () => {
    const { id, type } = deleteConfirmation;
    if (!id) return;

    try {
      const noticeToDelete = notices.find((n) => n.id === id);

      await deleteDoc(doc(db, CENTRAL_NOTICES_COLLECTION, id));
      await deleteDoc(doc(db, "notices", id));

      if (type === "central" && noticeToDelete) {
        try {
          const regularNoticesQuery = query(
            collection(db, "notices"),
            where("title", "==", noticeToDelete.title),
            where("content", "==", noticeToDelete.content),
            where("sender", "==", "central_admin"),
          );

          const snapshot = await getDocs(regularNoticesQuery);

          // Delete all matching notices found (should usually be one)
          const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));

          await Promise.all(deletePromises);
        } catch (err) {
          console.error("Error deleting matching regular notice:", err);
          // Don't throw here, as primary deletion was successful
        }
      }

      toast.success("Deleted successfully from all collections");
      fetchNotices();
    } catch (err) {
      console.error("Error deleting notice:", err);
      toast.error("Error deleting notice");
    } finally {
      setDeleteConfirmation({ isOpen: false, id: null, type: null });
    }
  };

  const getMahalNames = (ids) => {
    if (!ids?.length) return "All Madrasas";
    return madarsas
      .filter((m) => ids.includes(m.id))
      .map((m) => m.name)
      .join(", ");
  };

  const getColor = (priority) => {
    return (
      {
        high: "bg-red-100 text-red-700",
        medium: "bg-yellow-100 text-yellow-700",
        low: "bg-green-100 text-green-700",
      }[priority] || "bg-gray-100 text-gray-700"
    );
  };

  // Filter and search logic
  const isNoticeExpired = (notice) => {
    if (notice.isActive === false) return true;
    if (!notice.expiryDate) return false;
    const expiryDate = getDateValue(notice.expiryDate);
    if (!expiryDate) return false;
    return expiryDate < new Date();
  };

  const filteredNotices = notices.filter((notice) => {
    // Search filter
    const matchesSearch =
      notice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notice.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (notice.createdByName &&
        notice.createdByName.toLowerCase().includes(searchTerm.toLowerCase()));

    // Mahal filter
    const matchesMahal =
      selectedMahal === "all" ||
      (notice.targetMahals && notice.targetMahals.includes(selectedMahal)) ||
      !notice.targetMahals ||
      notice.targetMahals.length === 0;

    // Status filter (active/expired)
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && !isNoticeExpired(notice)) ||
      (statusFilter === "expired" && isNoticeExpired(notice));

    // Priority filter
    const matchesPriority =
      priorityFilter === "all" || notice.priority === priorityFilter;

    return matchesSearch && matchesMahal && matchesStatus && matchesPriority;
  });

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedMahal("all");
    setStatusFilter("all");
    setPriorityFilter("all");
  };

  // Helper function to format content with links
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
    <Layout>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4 md:space-y-6 lg:space-y-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
              Central Admin Notices
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-1">
              Manage and distribute university-wide announcements.
            </p>
          </div>
          <div className="flex gap-2 md:gap-3 w-full sm:w-auto">
            <Button
              onClick={() => {
                resetForm();
                setIsDialogOpen(true);
              }}
              className="flex-1 sm:flex-none min-h-[48px] touch-manipulation text-sm md:text-base px-4 md:px-6 rounded-lg"
            >
              <Plus className="mr-2 h-4 w-4" /> Create Notice
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center">
                <Bell className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Total
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                    {filteredNotices.length}
                  </p>
                  <p className="text-xs text-gray-500 truncate hidden sm:block">
                    of {notices.length} notices
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Active
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                    {filteredNotices.filter((n) => !isNoticeExpired(n)).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center">
                <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    High Priority
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                    {
                      filteredNotices.filter((n) => n.priority === "high")
                        .length
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center">
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Expired
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                    {filteredNotices.filter((n) => isNoticeExpired(n)).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Section */}
        <Card className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-blue-200 shadow-sm">
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-600 rounded-full">
                <Filter className="h-3 w-3 md:h-4 md:w-4 text-white" />
              </div>
              <CardTitle className="text-sm md:text-base lg:text-lg text-blue-900 font-semibold">
                Search & Filter
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="space-y-3 md:space-y-4">
              {/* Search Input */}
              <div>
                <Label className="text-xs md:text-sm font-medium text-gray-700 mb-1 block">
                  Search Notices
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by title, content, or author..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white min-h-[48px] text-sm md:text-base border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Filter Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Mahal Filter */}
                <div>
                  <Label className="text-xs md:text-sm font-medium text-gray-700 mb-1 block">
                    Madrasa
                  </Label>
                  <SearchableSelect
                    value={selectedMahal}
                    onValueChange={setSelectedMahal}
                    placeholder="All Madrasas"
                    searchPlaceholder="Search madrasas..."
                    options={madarsas}
                    getOptionLabel={(madarsa) => madarsa.name}
                    getOptionValue={(madarsa) => madarsa.id}
                    getOptionSearchText={(madarsa) =>
                      `${madarsa.name} ${madarsa.madarsaId || ""}`
                    }
                    allOptionText="All Madrasas"
                    emptyText="No madrasas found"
                    triggerClassName="bg-white min-h-[48px] text-sm md:text-base border-gray-300 rounded-lg"
                  />
                </div>

                {/* Status Filter */}
                <div>
                  <Label className="text-xs md:text-sm font-medium text-gray-700 mb-1 block">
                    Status
                  </Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="bg-white min-h-[48px] text-sm md:text-base border-gray-300 rounded-lg">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white rounded-lg border shadow-lg">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority Filter */}
                <div>
                  <Label className="text-xs md:text-sm font-medium text-gray-700 mb-1 block">
                    Priority
                  </Label>
                  <Select
                    value={priorityFilter}
                    onValueChange={setPriorityFilter}
                  >
                    <SelectTrigger className="bg-white min-h-[48px] text-sm md:text-base border-gray-300 rounded-lg">
                      <SelectValue placeholder="All Priorities" />
                    </SelectTrigger>
                    <SelectContent className="bg-white rounded-lg border shadow-lg">
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-4 pt-3 border-t border-blue-200">
              <div className="text-xs md:text-sm text-gray-600 bg-white px-3 py-1 rounded-full border">
                <span className="font-semibold text-blue-600">
                  {filteredNotices.length}
                </span>{" "}
                of <span className="font-semibold">{notices.length}</span>{" "}
                notices
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="text-blue-600 border-blue-300 hover:bg-blue-50 min-h-[44px] touch-manipulation text-sm w-full sm:w-auto rounded-lg"
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3 md:space-y-4">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="flex flex-col items-center space-y-3">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
                <p className="text-sm text-gray-500">Loading notices...</p>
              </div>
            </div>
          ) : filteredNotices.length === 0 ? (
            <Card className="text-center py-12 md:py-16 bg-gradient-to-br from-gray-50 to-gray-100 border-dashed border-2 border-gray-300">
              <CardContent className="p-6 md:p-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <Bell className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
                  No notices found
                </h3>
                <p className="text-sm md:text-base text-gray-500 mb-4">
                  {notices.length === 0
                    ? "No notices have been created yet. Create your first notice to get started!"
                    : "Try adjusting your search criteria or filters to find more notices."}
                </p>
                {notices.length > 0 && (
                  <Button
                    variant="outline"
                    className="min-h-[48px] touch-manipulation text-sm md:text-base rounded-lg border-blue-300 text-blue-600 hover:bg-blue-50"
                    onClick={clearFilters}
                  >
                    Clear All Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredNotices.map((notice) => {
              const isExpired = isNoticeExpired(notice);
              return (
                <Card
                  key={notice.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                      <div className="flex-1 w-full">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-base sm:text-lg font-semibold break-words">
                            {formatContentWithLinks(notice.title)}
                          </h3>
                          <Badge
                            variant={
                              notice.priority === "high"
                                ? "destructive"
                                : "secondary"
                            }
                            className="capitalize"
                          >
                            {notice.priority}
                          </Badge>
                          {notice.type === "central" && (
                            <Badge
                              variant="default"
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Central
                            </Badge>
                          )}
                          {isExpired ? (
                            <Badge
                              variant="outline"
                              className="text-red-500 border-red-200 bg-red-50"
                            >
                              Expired
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-green-600 border-green-200 bg-green-50"
                            >
                              Active
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge variant="outline" className="text-xs">
                            {notice.targetAudience}
                          </Badge>
                          {notice.showOnDashboard && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                            >
                              Dashboard
                            </Badge>
                          )}
                        </div>

                        <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap mb-3">
                          {formatContentWithLinks(notice.content)}
                        </div>

                        <div className="text-xs sm:text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                          <span>
                            Created:{" "}
                            {notice.createdAt?.seconds
                              ? new Date(
                                  notice.createdAt.seconds * 1000,
                                ).toLocaleDateString()
                              : "N/A"}
                            {notice.createdByName &&
                              ` by ${notice.createdByName}`}
                          </span>
                          {notice.expiryDate && (
                            <span
                              className={
                                isExpired ? "text-red-600 font-medium" : ""
                              }
                            >
                              Expires:{" "}
                              {new Date(
                                notice.expiryDate.seconds * 1000,
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 w-full sm:w-auto justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingNotice(notice);
                            setFormData({
                              ...notice,
                              expiryDate: notice.expiryDate
                                ? new Date(notice.expiryDate.seconds * 1000)
                                    .toISOString()
                                    .split("T")[0]
                                : "",
                            });
                            setIsDialogOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 min-h-[40px] sm:min-h-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(notice.id, notice.type)}
                          className="text-red-600 hover:text-red-700 min-h-[40px] sm:min-h-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl">
                {editingNotice ? "Edit Notice" : "Create Notice"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  required
                  className="min-h-[44px] text-sm md:text-base mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Content</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      content: e.target.value,
                    }))
                  }
                  required
                  rows={5}
                  className="min-h-[100px] text-sm md:text-base mt-1 resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, priority: v }))
                    }
                  >
                    <SelectTrigger className="min-h-[44px] text-sm md:text-base mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Audience</Label>
                  <Select
                    value={formData.targetAudience}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, targetAudience: v }))
                    }
                  >
                    <SelectTrigger className="min-h-[44px] text-sm md:text-base mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="teachers">Teachers</SelectItem>
                      <SelectItem value="madarsas">Madrasas</SelectItem>
                      <SelectItem value="students">Students</SelectItem>
                      <SelectItem value="mekhala">Mekhala</SelectItem>
                      <SelectItem value="exam_board">Exam Board</SelectItem>
                      <SelectItem value="management">Management Portal</SelectItem>
                      <SelectItem value="district">District</SelectItem>
                      <SelectItem value="convener">Convener Portal</SelectItem>
                      <SelectItem value="inspector">Inspector Portal</SelectItem>
                      <SelectItem value="digitalteacher">Digital Teacher</SelectItem>
                      <SelectItem value="digitalstudent">Digital Student</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Expiry Date</Label>
                <Input
                  type="date"
                  value={formData.expiryDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      expiryDate: e.target.value,
                    }))
                  }
                  className="min-h-[44px] text-sm md:text-base mt-1"
                />
              </div>
              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="showOnDashboard"
                  checked={formData.showOnDashboard}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      showOnDashboard: e.target.checked,
                    }))
                  }
                  className="w-4 h-4"
                />
                <Label
                  htmlFor="showOnDashboard"
                  className="text-sm font-medium"
                >
                  Show on Dashboard
                </Label>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="min-h-[44px] touch-manipulation text-sm md:text-base"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[44px] touch-manipulation text-sm md:text-base"
                >
                  {submitting
                    ? "Saving..."
                    : editingNotice
                      ? "Update"
                      : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmation.isOpen}
          onOpenChange={(open) =>
            !open &&
            setDeleteConfirmation({ isOpen: false, id: null, type: null })
          }
        >
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl text-red-600 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Confirm Deletion
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-gray-600">
                Are you sure you want to delete this notice? This action cannot
                be undone.
              </p>
              {deleteConfirmation.type === "central" && (
                <p className="text-amber-600 text-sm mt-2 bg-amber-50 p-2 rounded border border-amber-200">
                  Note: This is a CENTRAL notice. Deleting it will remove it
                  from all associated dashboards (Madarsas, Students, etc).
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() =>
                  setDeleteConfirmation({ isOpen: false, id: null, type: null })
                }
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                className="min-h-[44px] bg-red-600 hover:bg-red-700 !text-white"
              >
                Delete Notice
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
