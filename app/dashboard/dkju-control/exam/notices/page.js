"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/authUtils";
import Layout from "@/components/Layout";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bell,
  Plus,
  Calendar,
  Search,
  Edit,
  Trash2,
  Paperclip,
  Download,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { storage } from "@/lib/firebase";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { formatDate } from "@/lib/dateUtils";
import {
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  COLLECTIONS,
} from "@/lib/firestoreService";
import { orderBy } from "firebase/firestore";
import useAuthStore from "@/lib/authStore";
import { toast } from "sonner";

export default function ExamNoticesPage() {
  const { user, role } = useAuth();
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data States
  const [exams, setExams] = useState([]);
  const [examNotices, setExamNotices] = useState([]);
  const [filteredNotices, setFilteredNotices] = useState([]);

  // Dialog States
  const [isCreateNoticeOpen, setIsCreateNoticeOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form States
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    content: "",
    examId: "none",
    isImportant: false,
    recipients: ["sadar", "student", "teacher"], // Array of selected recipients: ['sadar', 'student', 'teacher']
    attachments: [], // Array of {name, url, uploadedAt}
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExam, setSelectedExam] = useState("all");
  const [importantOnly, setImportantOnly] = useState(false);

  // Fetch data
  const fetchExams = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      const fetchedExams = await getDocuments(COLLECTIONS.EXAMS, constraints);
      setExams(fetchedExams);
    } catch (error) {
      console.error("Error fetching exams:", error);
      setError("Failed to fetch exams");
    }
  }, []);

  const fetchExamNotices = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      const fetchedNotices = await getDocuments(
        COLLECTIONS.EXAM_NOTICES,
        constraints,
      );
      console.log("Fetched notices:", fetchedNotices.length);
      setExamNotices(fetchedNotices);
      // Don't set filtered notices here - let the useEffect handle filtering
    } catch (error) {
      console.error("Error fetching exam notices:", error);
      setError("Failed to fetch notices");
    }
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      await Promise.all([fetchExams(), fetchExamNotices()]);
      setLoading(false);
    };

    fetchAllData();
  }, [fetchExams, fetchExamNotices]);

  // Filter notices
  useEffect(() => {
    let filtered = examNotices;

    // Search by title or content
    if (searchTerm) {
      filtered = filtered.filter(
        (notice) =>
          notice.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          notice.content?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by exam
    if (selectedExam !== "all") {
      filtered = filtered.filter((notice) => notice.examId === selectedExam);
    }

    // Filter by importance
    if (importantOnly) {
      filtered = filtered.filter((notice) => notice.isImportant);
    }

    setFilteredNotices(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [examNotices, searchTerm, selectedExam, importantOnly]);

  // Handle file upload
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return [];

    setUploading(true);
    const uploadedFiles = [];

    try {
      for (const file of files) {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const storageRef = ref(storage, `exam/notice/files/${fileName}`);

        await uploadBytes(storageRef, file, {
          contentDisposition: "attachment",
        });
        const url = await getDownloadURL(storageRef);

        uploadedFiles.push({
          name: file.name,
          url: url,
          uploadedAt: new Date().toISOString(),
          size: file.size,
        });
      }
      return uploadedFiles;
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Failed to upload some files");
      return uploadedFiles;
    } finally {
      setUploading(false);
    }
  };

  // Handle file deletion from form (before saving)
  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle attachment deletion from existing notice
  const handleRemoveAttachment = (index) => {
    setNoticeForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  // Toggle all recipients
  const toggleAllRecipients = (checked) => {
    if (checked) {
      setNoticeForm((prev) => ({
        ...prev,
        recipients: ["sadar", "student", "teacher"],
      }));
    } else {
      setNoticeForm((prev) => ({ ...prev, recipients: [] }));
    }
  };

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchExamNotices();
      toast.success("Notices refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh notices");
    } finally {
      setRefreshing(false);
    }
  };

  // Handle notice creation
  const handleNoticeSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!noticeForm.title.trim()) {
      toast.error("Notice title is required");
      return;
    }

    if (!noticeForm.content.trim()) {
      toast.error("Notice content is required");
      return;
    }

    if (noticeForm.recipients.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    try {
      // Upload files if any
      let uploadedAttachments = [];
      if (selectedFiles.length > 0) {
        uploadedAttachments = await handleFileUpload(selectedFiles);
      }

      const noticeData = {
        ...noticeForm,
        examId: noticeForm.examId === "none" ? "" : noticeForm.examId,
        attachments: uploadedAttachments,
        createdBy: userData?.id || user?.uid,
        createdByName: userData?.name || user?.displayName || "Admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await createDocument(COLLECTIONS.EXAM_NOTICES, noticeData);
      toast.success("Exam notice created successfully");

      setIsCreateNoticeOpen(false);
      setNoticeForm({
        title: "",
        content: "",
        examId: "none",
        isImportant: false,
        recipients: ["sadar", "student", "teacher"],
        attachments: [],
      });
      setSelectedFiles([]);

      // Auto-refresh notices
      await fetchExamNotices();
    } catch (error) {
      console.error("Error creating notice:", error);
      toast.error("Failed to create notice");
    }
  };

  // Handle notice deletion
  const handleDeleteNotice = async (noticeId) => {
    if (
      !confirm(
        "Are you sure you want to delete this notice? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await deleteDocument(COLLECTIONS.EXAM_NOTICES, noticeId);
      toast.success("Notice deleted successfully");
      await fetchExamNotices();
    } catch (error) {
      console.error("Error deleting notice:", error);
      toast.error("Failed to delete notice");
    }
  };

  // Handle notice editing
  const handleEditNotice = (notice) => {
    setEditingItem(notice);
    setNoticeForm({
      title: notice.title,
      content: notice.content,
      examId: notice.examId || "none",
      isImportant: notice.isImportant || false,
      recipients: notice.recipients || [],
      attachments: notice.attachments || [],
    });
    setSelectedFiles([]);
    setIsCreateNoticeOpen(true);
  };

  // Handle notice update
  const handleUpdateNotice = async (e) => {
    e.preventDefault();

    // Validation
    if (!noticeForm.title.trim()) {
      toast.error("Notice title is required");
      return;
    }

    if (!noticeForm.content.trim()) {
      toast.error("Notice content is required");
      return;
    }

    if (noticeForm.recipients.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    try {
      // Upload new files if any
      let newAttachments = [];
      if (selectedFiles.length > 0) {
        newAttachments = await handleFileUpload(selectedFiles);
      }

      const noticeData = {
        ...noticeForm,
        examId: noticeForm.examId === "none" ? "" : noticeForm.examId,
        attachments: [...(noticeForm.attachments || []), ...newAttachments],
        updatedAt: new Date(),
        updatedBy: userData?.id || user?.uid,
        updatedByName: userData?.name || user?.displayName || "Admin",
      };

      await updateDocument(
        COLLECTIONS.EXAM_NOTICES,
        editingItem.id,
        noticeData,
      );
      toast.success("Notice updated successfully");

      setIsCreateNoticeOpen(false);
      setEditingItem(null);
      setNoticeForm({
        title: "",
        content: "",
        examId: "none",
        isImportant: false,
        recipients: ["sadar", "student", "teacher"],
        attachments: [],
      });
      setSelectedFiles([]);

      await fetchExamNotices();
    } catch (error) {
      console.error("Error updating notice:", error);
      toast.error("Failed to update notice");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading notices...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Pagination Logic
  const totalPages = Math.ceil(filteredNotices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentNotices = filteredNotices.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

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
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Exam Notices
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Create and manage exam notices for students
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <Bell className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    Total Notices
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {examNotices.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    Important Notices
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {examNotices.filter((n) => n.isImportant).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <Search className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    Filtered Results
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {filteredNotices.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filter Notices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Search Notices</Label>
                <Input
                  id="search"
                  placeholder="Search by title or content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="exam-filter">Filter by Exam</Label>
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select exam" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Exams</SelectItem>
                    {exams.map((exam) => (
                      <SelectItem key={exam.id} value={exam.id}>
                        {exam.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 mt-6">
                <input
                  type="checkbox"
                  id="important-only"
                  checked={importantOnly}
                  onChange={(e) => setImportantOnly(e.target.checked)}
                />
                <Label htmlFor="important-only">Show Important Only</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-lg sm:text-xl font-semibold">
              Notices ({filteredNotices.length})
            </h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                className="flex-1 sm:flex-initial"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Dialog
                open={isCreateNoticeOpen}
                onOpenChange={setIsCreateNoticeOpen}
              >
                <DialogTrigger asChild>
                  <Button className="flex-1 sm:flex-initial">
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="sm:inline">Create Notice</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white max-h-[90vh] overflow-y-auto max-w-3xl w-[95vw] sm:w-full">
                  <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl">
                      {editingItem ? "Edit Exam Notice" : "Create Exam Notice"}
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                      Create a notice for students about exams
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={
                      editingItem ? handleUpdateNotice : handleNoticeSubmit
                    }
                    className="space-y-4"
                  >
                    <div>
                      <Label htmlFor="noticeTitle">Notice Title *</Label>
                      <Input
                        id="noticeTitle"
                        value={noticeForm.title}
                        onChange={(e) =>
                          setNoticeForm((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        placeholder="Important Exam Notice"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="examSelect">
                        Related Exam (Optional)
                      </Label>
                      <Select
                        value={noticeForm.examId}
                        onValueChange={(value) =>
                          setNoticeForm((prev) => ({ ...prev, examId: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an exam (optional)" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="none">No specific exam</SelectItem>
                          {exams.map((exam) => (
                            <SelectItem key={exam.id} value={exam.id}>
                              {exam.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Send Notice To *</Label>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center space-x-2 mb-3 pb-2 border-b">
                          <input
                            type="checkbox"
                            id="selectAllRecipients"
                            checked={noticeForm.recipients.length === 3}
                            onChange={(e) =>
                              toggleAllRecipients(e.target.checked)
                            }
                            className="rounded"
                          />
                          <Label
                            htmlFor="selectAllRecipients"
                            className="text-sm font-semibold"
                          >
                            Select All
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="sendToSadar"
                            checked={noticeForm.recipients.includes("sadar")}
                            onChange={(e) => {
                              const value = "sadar";
                              setNoticeForm((prev) => ({
                                ...prev,
                                recipients: e.target.checked
                                  ? [...prev.recipients, value]
                                  : prev.recipients.filter((r) => r !== value),
                              }));
                            }}
                            className="rounded"
                          />
                          <Label
                            htmlFor="sendToSadar"
                            className="text-sm font-normal"
                          >
                            Send to Sadar
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="sendToStudent"
                            checked={noticeForm.recipients.includes("student")}
                            onChange={(e) => {
                              const value = "student";
                              setNoticeForm((prev) => ({
                                ...prev,
                                recipients: e.target.checked
                                  ? [...prev.recipients, value]
                                  : prev.recipients.filter((r) => r !== value),
                              }));
                            }}
                            className="rounded"
                          />
                          <Label
                            htmlFor="sendToStudent"
                            className="text-sm font-normal"
                          >
                            Send to Students
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="sendToTeacher"
                            checked={noticeForm.recipients.includes("teacher")}
                            onChange={(e) => {
                              const value = "teacher";
                              setNoticeForm((prev) => ({
                                ...prev,
                                recipients: e.target.checked
                                  ? [...prev.recipients, value]
                                  : prev.recipients.filter((r) => r !== value),
                              }));
                            }}
                            className="rounded"
                          />
                          <Label
                            htmlFor="sendToTeacher"
                            className="text-sm font-normal"
                          >
                            Send to Teacher
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="noticeContent">Notice Content *</Label>
                      <Textarea
                        id="noticeContent"
                        value={noticeForm.content}
                        onChange={(e) =>
                          setNoticeForm((prev) => ({
                            ...prev,
                            content: e.target.value,
                          }))
                        }
                        placeholder="Write your notice content here..."
                        rows={6}
                        required
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isImportant"
                        checked={noticeForm.isImportant}
                        onChange={(e) =>
                          setNoticeForm((prev) => ({
                            ...prev,
                            isImportant: e.target.checked,
                          }))
                        }
                      />
                      <Label htmlFor="isImportant">Mark as Important</Label>
                    </div>

                    {/* File Upload Section */}
                    <div>
                      <Label
                        htmlFor="fileUpload"
                        className="flex items-center gap-2"
                      >
                        <Paperclip className="h-4 w-4" />
                        Attach Files (Optional)
                      </Label>
                      <Input
                        id="fileUpload"
                        type="file"
                        multiple
                        onChange={(e) =>
                          setSelectedFiles(Array.from(e.target.files || []))
                        }
                        className="mt-2"
                        disabled={uploading}
                      />
                      {selectedFiles.length > 0 && (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm text-gray-600">
                            Selected files:
                          </p>
                          {selectedFiles.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between bg-gray-50 p-2 rounded"
                            >
                              <span className="text-sm">
                                {file.name} ({(file.size / 1024).toFixed(2)} KB)
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveFile(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      {noticeForm.attachments &&
                        noticeForm.attachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-sm text-gray-600 font-medium">
                              Existing attachments:
                            </p>
                            {noticeForm.attachments.map((attachment, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between bg-blue-50 p-2 rounded"
                              >
                                <span className="text-sm">
                                  {attachment.name}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveAttachment(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setIsCreateNoticeOpen(false);
                          setEditingItem(null);
                          setNoticeForm({
                            title: "",
                            content: "",
                            examId: "none",
                            isImportant: false,
                            recipients: ["sadar", "student", "teacher"],
                            attachments: [],
                          });
                          setSelectedFiles([]);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={uploading}
                        className="w-full sm:w-auto"
                      >
                        {uploading
                          ? "Uploading..."
                          : editingItem
                            ? "Update Notice"
                            : "Create Notice"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Notices List */}
          <div className="grid gap-4">
            {filteredNotices.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {examNotices.length === 0
                      ? "No exam notices created yet"
                      : "No notices match your filters"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              currentNotices.map((notice) => {
                const relatedExam = exams.find((e) => e.id === notice.examId);
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
                            {notice.isImportant && (
                              <Badge variant="destructive">Important</Badge>
                            )}
                            {relatedExam && (
                              <Badge variant="outline">
                                {relatedExam.title}
                              </Badge>
                            )}
                            {notice.recipients &&
                            notice.recipients.length > 0 ? (
                              <div className="flex gap-1">
                                {notice.recipients.map((recipient) => (
                                  <Badge
                                    key={recipient}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {recipient === "sadar"
                                      ? "Sadar"
                                      : recipient === "student"
                                        ? "Students"
                                        : recipient === "teacher"
                                          ? "Teachers"
                                          : recipient}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs text-red-600"
                              >
                                Showing to no one
                              </Badge>
                            )}
                          </div>
                          <p className="text-gray-600 whitespace-pre-wrap mb-3">
                            {formatContentWithLinks(notice.content)}
                          </p>
                          {notice.attachments &&
                            notice.attachments.length > 0 && (
                              <div className="mt-3 mb-3">
                                <p className="text-sm font-medium text-gray-700 mb-2">
                                  Attachments:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {notice.attachments.map(
                                    (attachment, index) => (
                                      <a
                                        key={index}
                                        href={attachment.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 text-sm"
                                      >
                                        <Paperclip className="h-3 w-3" />
                                        {attachment.name}
                                        <Download className="h-3 w-3 ml-1" />
                                      </a>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                          <p className="text-sm text-gray-500">
                            Created: {formatDate(notice.createdAt)} by{" "}
                            {notice.createdByName}
                          </p>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditNotice(notice)}
                            className="text-blue-600 hover:text-blue-700 min-h-[40px] sm:min-h-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteNotice(notice.id)}
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
              <p className="text-sm text-gray-500">
                Showing {startIndex + 1} to{" "}
                {Math.min(startIndex + itemsPerPage, filteredNotices.length)} of{" "}
                {filteredNotices.length} notices
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="px-4 py-2 text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
