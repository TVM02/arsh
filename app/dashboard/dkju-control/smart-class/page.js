"use client";

import {
  uploadFile,
  deleteFile,
  getFileType,
  validateVideoUrl,
  getYouTubeEmbedUrl,
  getVimeoEmbedUrl,
} from "@/lib/storageService";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  Plus,
  Search,
  Edit,
  Trash2,
  FileText,
  Book,
  BookOpen,
  Filter,
  Download,
  Eye,
  Video,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { toast } from "sonner";

const CLASS_LEVELS = [
  "UKG",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
];

export default function SmartClassAdminPage() {
  const { userData } = useAuthStore();
  const [activeTab, setActiveTab] = useState("syllabus");
  const [syllabusContent, setSyllabusContent] = useState([]);
  const [studyContent, setStudyContent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Upload form state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    class: "",
    section: "",
    title: "",
    description: "",
    files: [],
    videoUrl: "",
    uploadType: "file", // 'file' or 'video'
  });

  // Edit form state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    files: [],
    videoUrl: "",
    uploadType: "none", // 'none', 'file', 'video', 'mixed'
  });

  // Filters
  const [filters, setFilters] = useState({
    class: "all",
    section: "all",
    search: "",
  });

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);

  // Content viewer
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch syllabus content
      const syllabusQuery = query(
        collection(db, "smartClassSyllabus"),
        orderBy("createdAt", "desc"),
      );
      const syllabusSnapshot = await getDocs(syllabusQuery);
      const syllabusData = syllabusSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        section: "syllabus",
      }));

      // Fetch study content
      const contentsQuery = query(
        collection(db, "smartClassContents"),
        orderBy("createdAt", "desc"),
      );
      const contentsSnapshot = await getDocs(contentsQuery);
      const contentsData = contentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        section: "contents",
      }));

      setSyllabusContent(syllabusData);
      setStudyContent(contentsData);
    } catch (error) {
      console.error("Error fetching content:", error);
      toast.error("Failed to load content");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter((file) => {
      const isValidType =
        file.type.startsWith("image/") || file.type === "application/pdf";
      const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB limit

      if (!isValidType) {
        toast.error(`${file.name}: Only images and PDFs are allowed`);
        return false;
      }
      if (!isValidSize) {
        toast.error(`${file.name}: File size must be less than 50MB`);
        return false;
      }
      return true;
    });

    setUploadForm((prev) => ({
      ...prev,
      files: [...prev.files, ...validFiles],
    }));
  };

  const removeFile = (index) => {
    setUploadForm((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  const handleVideoUrlChange = (url) => {
    setUploadForm((prev) => ({
      ...prev,
      videoUrl: url,
    }));
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!uploadForm.class || !uploadForm.section || !uploadForm.title.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate upload content
    if (uploadForm.uploadType === "file" && uploadForm.files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    if (uploadForm.uploadType === "video") {
      if (!uploadForm.videoUrl.trim()) {
        toast.error("Please enter a video URL");
        return;
      }
      if (!validateVideoUrl(uploadForm.videoUrl.trim())) {
        toast.error(
          "Please enter a valid video URL (YouTube, Vimeo, or direct video file)",
        );
        return;
      }
    }

    if (uploadForm.uploadType === "mixed") {
      if (uploadForm.files.length === 0 && !uploadForm.videoUrl.trim()) {
        toast.error("Please upload files or add a video URL");
        return;
      }
      if (
        uploadForm.videoUrl.trim() &&
        !validateVideoUrl(uploadForm.videoUrl.trim())
      ) {
        toast.error(
          "Please enter a valid video URL (YouTube, Vimeo, or direct video file)",
        );
        return;
      }
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const collectionName =
        uploadForm.section === "syllabus"
          ? "smartClassSyllabus"
          : "smartClassContents";
      let successMessage = "Content uploaded successfully";

      // Prepare base content data
      const baseContentData = {
        title: uploadForm.title.trim(),
        description: uploadForm.description.trim() || null,
        class: uploadForm.class.replace("Class ", ""), // "Ukg" stays "Ukg"; "Class 5" -> "5"
        uploadedBy: userData?.email || "admin",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (uploadForm.uploadType === "video") {
        // Handle video URL only
        const contentData = {
          ...baseContentData,
          files: [
            {
              url: uploadForm.videoUrl.trim(),
              type: "video",
              storageType: "url",
              originalName: "Video Link",
              fileSize: null,
            },
          ],
        };

        await addDoc(collection(db, collectionName), contentData);
        setUploadProgress(100);
        successMessage = "Video link uploaded successfully";
      } else {
        // Handle file uploads (with optional video for mixed type)
        const uploadedFiles = [];

        // Upload files if any
        if (uploadForm.files.length > 0) {
          for (let i = 0; i < uploadForm.files.length; i++) {
            const file = uploadForm.files[i];
            setUploadProgress(((i + 0.5) / uploadForm.files.length) * 70); // Reserve 30% for video and database save

            // Upload file
            const uploadResult = await uploadFile(file, "smart-class");

            uploadedFiles.push({
              url: uploadResult.url,
              type: uploadResult.type,
              storageType: uploadResult.storageType,
              filePath: uploadResult.path || null,
              publicId: uploadResult.publicId || null,
              originalName: uploadResult.originalName,
              fileSize: uploadResult.size,
            });
          }
        }

        // Add video URL if provided (for mixed type)
        if (uploadForm.uploadType === "mixed" && uploadForm.videoUrl.trim()) {
          uploadedFiles.push({
            url: uploadForm.videoUrl.trim(),
            type: "video",
            storageType: "url",
            originalName: "Video Link",
            fileSize: null,
          });
        }

        // Save single entry with all files
        const contentData = {
          ...baseContentData,
          files: uploadedFiles,
        };

        setUploadProgress(90);
        await addDoc(collection(db, collectionName), contentData);
        setUploadProgress(100);

        const fileCount = uploadForm.files.length;
        const videoCount =
          uploadForm.uploadType === "mixed" && uploadForm.videoUrl.trim()
            ? 1
            : 0;
        const totalItems = fileCount + videoCount;

        successMessage = `Successfully uploaded content with ${totalItems} item(s)`;
      }

      setUploadDialogOpen(false);
      setUploadForm({
        class: "",
        section: "",
        title: "",
        description: "",
        files: [],
        videoUrl: "",
        uploadType: "file",
      });
      toast.success(successMessage);
      fetchContent();
    } catch (error) {
      console.error("Error uploading content:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to upload content. Please try again.";
      toast.error(message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setEditForm({
      title: item.title,
      description: item.description || "",
      files: [],
      videoUrl: "",
      uploadType: "none",
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    if (!editForm.title.trim()) {
      toast.error("Title is required");
      return;
    }

    // Validate additional files if being uploaded
    if (editForm.uploadType === "file" && editForm.files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    if (editForm.uploadType === "video") {
      if (!editForm.videoUrl.trim()) {
        toast.error("Please enter a video URL");
        return;
      }
      if (!validateVideoUrl(editForm.videoUrl.trim())) {
        toast.error("Please enter a valid video URL");
        return;
      }
    }

    if (editForm.uploadType === "mixed") {
      if (editForm.files.length === 0 && !editForm.videoUrl.trim()) {
        toast.error("Please upload files or add a video URL");
        return;
      }
      if (
        editForm.videoUrl.trim() &&
        !validateVideoUrl(editForm.videoUrl.trim())
      ) {
        toast.error("Please enter a valid video URL");
        return;
      }
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const collectionName =
        editItem.section === "syllabus"
          ? "smartClassSyllabus"
          : "smartClassContents";

      // Prepare base update data
      const updateData = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        updatedAt: serverTimestamp(),
      };

      // Handle additional files if being uploaded
      if (editForm.uploadType !== "none") {
        const existingFiles =
          editItem.files ||
          (editItem.fileUrl
            ? [
                {
                  url: editItem.fileUrl,
                  type: editItem.fileType,
                  storageType: editItem.storageType,
                  filePath: editItem.filePath,
                  publicId: editItem.publicId,
                  originalName: editItem.originalName,
                  fileSize: editItem.fileSize,
                },
              ]
            : []);

        const newFiles = [];

        // Upload new files if any
        if (editForm.uploadType === "file" || editForm.uploadType === "mixed") {
          for (let i = 0; i < editForm.files.length; i++) {
            const file = editForm.files[i];
            setUploadProgress(((i + 0.5) / editForm.files.length) * 70);

            const uploadResult = await uploadFile(file, "smart-class");

            newFiles.push({
              url: uploadResult.url,
              type: uploadResult.type,
              storageType: uploadResult.storageType,
              filePath: uploadResult.path || null,
              publicId: uploadResult.publicId || null,
              originalName: uploadResult.originalName,
              fileSize: uploadResult.size,
            });
          }
        }

        // Add video URL if provided
        if (
          (editForm.uploadType === "video" ||
            editForm.uploadType === "mixed") &&
          editForm.videoUrl.trim()
        ) {
          newFiles.push({
            url: editForm.videoUrl.trim(),
            type: "video",
            storageType: "url",
            originalName: "Video Link",
            fileSize: null,
          });
        }

        // Combine existing and new files
        updateData.files = [...existingFiles, ...newFiles];
      }

      setUploadProgress(90);
      await updateDoc(doc(db, collectionName, editItem.id), updateData);
      setUploadProgress(100);

      toast.success("Content updated successfully");
      setEditDialogOpen(false);
      setEditForm({
        title: "",
        description: "",
        files: [],
        videoUrl: "",
        uploadType: "none",
      });
      fetchContent();
    } catch (error) {
      console.error("Error updating content:", error);
      toast.error("Failed to update content");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Helper functions for edit form
  const handleEditFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setEditForm((prev) => ({ ...prev, files: [...prev.files, ...files] }));
  };

  const removeEditFile = (index) => {
    setEditForm((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  const handleEditVideoUrlChange = (url) => {
    setEditForm((prev) => ({ ...prev, videoUrl: url }));
  };

  const handleDelete = async () => {
    if (!deleteItem) return;

    try {
      const collectionName =
        deleteItem.section === "syllabus"
          ? "smartClassSyllabus"
          : "smartClassContents";

      // Delete files from storage
      if (deleteItem.files) {
        // New format with multiple files
        for (const file of deleteItem.files) {
          if (file.storageType && file.storageType !== "url") {
            await deleteFile({
              storageType: file.storageType,
              path: file.filePath,
              publicId: file.publicId,
            });
          }
        }
      } else if (deleteItem.storageType && deleteItem.storageType !== "url") {
        // Old format with single file
        await deleteFile({
          storageType: deleteItem.storageType,
          path: deleteItem.filePath,
          publicId: deleteItem.publicId,
        });
      }

      // Delete from Firestore
      await deleteDoc(doc(db, collectionName, deleteItem.id));

      toast.success("Content deleted successfully");
      setDeleteDialogOpen(false);
      setDeleteItem(null);
      fetchContent();
    } catch (error) {
      console.error("Error deleting content:", error);
      toast.error("Failed to delete content");
    }
  };

  const handleView = (item) => {
    setViewItem(item);
    setViewDialogOpen(true);
  };

  const getFilteredContent = () => {
    const allContent = [...syllabusContent, ...studyContent];

    return allContent.filter((item) => {
      // Extract class number from filter value (e.g., "Class 5" -> "5")
      const filterClassValue =
        filters.class === "all" ? "all" : filters.class.replace("Class ", "");
      // Match Ukg/UKG/ukg variants for backward-compat with old Firestore documents
      const isUkgFilter = filterClassValue === "Ukg";
      const matchesClass =
        filters.class === "all" ||
        item.class === filterClassValue ||
        (isUkgFilter && (item.class === "UKG" || item.class === "ukg"));
      const matchesSection =
        filters.section === "all" || item.section === filters.section;
      const matchesSearch =
        !filters.search ||
        item.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        (item.description &&
          item.description
            .toLowerCase()
            .includes(filters.search.toLowerCase()));

      return matchesClass && matchesSection && matchesSearch;
    });
  };

  const exportData = () => {
    const data = getFilteredContent();
    const csvContent = [
      [
        "Title",
        "Description",
        "Class",
        "Section",
        "File Type",
        "Upload Date",
      ].join(","),
      ...data.map((item) =>
        [
          item.title || "",
          item.description || "",
          item.class || "",
          item.section || "",
          item.fileType || "",
          new Date(
            item.createdAt?.seconds * 1000 || item.createdAt,
          ).toLocaleDateString(),
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "smart_class_content.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getCurrentTabContent = () => {
    return activeTab === "syllabus" ? syllabusContent : studyContent;
  };

  const getFileBadges = (item) => {
    if (item.files?.length > 0) {
      return item.files.map((file, index) => (
        <Badge
          key={index}
          variant={
            file.type === "image" || file.type === "video"
              ? "default"
              : "secondary"
          }
          className="text-xs"
        >
          {file.type === "image"
            ? "Image"
            : file.type === "video"
              ? "Video"
              : "PDF"}
        </Badge>
      ));
    }
    return (
      <Badge
        variant={
          item.fileType === "image" || item.fileType === "video"
            ? "default"
            : "secondary"
        }
      >
        {item.fileType === "image"
          ? "Image"
          : item.fileType === "video"
            ? "Video"
            : "PDF"}
      </Badge>
    );
  };

  const renderActionButtons = (item) => (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-9 w-9 p-0 flex-shrink-0"
        onClick={() => handleView(item)}
        title="View"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-9 w-9 p-0 flex-shrink-0"
        onClick={() => handleEdit(item)}
        title="Edit"
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        variant="destructive"
        size="sm"
        className="h-9 w-9 p-0 flex-shrink-0"
        onClick={() => {
          setDeleteItem(item);
          setDeleteDialogOpen(true);
        }}
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const renderContentList = (items) => {
    if (items.length === 0) return null;
    return (
      <>
        {/* Mobile card list — hidden on md+ */}
        <div className="flex flex-col gap-3 md:hidden">
          {items.map((item) => (
            <div
              key={item.id}
              className="border rounded-lg p-3 bg-white shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-snug">
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-xs">
                      Class {item.class}
                    </Badge>
                    {getFileBadges(item)}
                    <span className="text-xs text-gray-400">
                      {new Date(
                        item.createdAt?.seconds * 1000 || item.createdAt,
                      )
                        .toLocaleDateString("en-GB")
                        .replace(/\//g, "-")}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0">{renderActionButtons(item)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table — hidden below md */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>File Type</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.title}</div>
                      {item.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.class}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {getFileBadges(item)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(
                      item.createdAt?.seconds * 1000 || item.createdAt,
                    ).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{renderActionButtons(item)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              Smart Class Admin
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Manage Madrasa syllabus and content materials
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={exportData}
              variant="outline"
              className="min-h-[44px] text-sm md:text-base"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="min-h-[44px] text-sm md:text-base">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Content
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-lg md:text-xl">
                    Upload New Content
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Class *</Label>
                      <Select
                        value={uploadForm.class}
                        onValueChange={(value) =>
                          setUploadForm((prev) => ({ ...prev, class: value }))
                        }
                      >
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue placeholder="Select Class" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {CLASS_LEVELS.map((classLevel) => (
                            <SelectItem key={classLevel} value={classLevel}>
                              {classLevel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Section *</Label>
                      <Select
                        value={uploadForm.section}
                        onValueChange={(value) =>
                          setUploadForm((prev) => ({ ...prev, section: value }))
                        }
                      >
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue placeholder="Select Section" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="syllabus">Syllabus</SelectItem>
                          <SelectItem value="contents">Contents</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Title *</Label>
                    <Input
                      value={uploadForm.title}
                      onChange={(e) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      placeholder="Enter content title"
                      className="min-h-[44px]"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">
                      Description (Optional)
                    </Label>
                    <Textarea
                      value={uploadForm.description}
                      onChange={(e) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Enter content description"
                      className="min-h-[80px] resize-none"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Upload Type *</Label>
                    <Select
                      value={uploadForm.uploadType}
                      onValueChange={(value) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          uploadType: value,
                        }))
                      }
                    >
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Select Upload Type" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="file">Upload Files Only</SelectItem>
                        <SelectItem value="video">
                          Add Video Link Only
                        </SelectItem>
                        <SelectItem value="mixed">
                          Upload Files + Video Link
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(uploadForm.uploadType === "video" ||
                    uploadForm.uploadType === "mixed") && (
                    <div>
                      <Label className="text-sm font-medium">
                        Video URL{" "}
                        {uploadForm.uploadType === "mixed" ? "(Optional)" : "*"}
                      </Label>
                      <Input
                        value={uploadForm.videoUrl}
                        onChange={(e) => handleVideoUrlChange(e.target.value)}
                        placeholder="Enter YouTube, Vimeo, or direct video URL"
                        className="min-h-[44px]"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Supported: YouTube, Vimeo, or direct video file URLs
                      </p>
                    </div>
                  )}

                  {(uploadForm.uploadType === "file" ||
                    uploadForm.uploadType === "mixed") && (
                    <div>
                      <Label className="text-sm font-medium">Files *</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                        <input
                          type="file"
                          id="file-upload"
                          multiple
                          accept="image/*,.pdf"
                          onChange={handleFileUpload}
                          className="sr-only"
                        />
                        <label
                          htmlFor="file-upload"
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          <Upload className="h-8 w-8 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            Click to upload files or drag and drop
                          </span>
                          <span className="text-xs text-gray-500">
                            Images (PNG, JPG, GIF) and PDFs up to 50MB
                          </span>
                        </label>
                      </div>

                      {uploadForm.files.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <Label className="text-sm font-medium">
                            Selected Files ({uploadForm.files.length})
                          </Label>
                          <div className="space-y-2">
                            {uploadForm.files.map((file, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-2 border rounded"
                              >
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-gray-400" />
                                  <span className="text-sm truncate">
                                    {file.name}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {getFileType(file)}
                                  </Badge>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFile(index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Uploading...</span>
                        <span>{Math.round(uploadProgress)}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setUploadDialogOpen(false)}
                      disabled={uploading}
                      className="min-h-[44px]"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={uploading}
                      className="min-h-[44px]"
                    >
                      {uploading ? "Uploading..." : "Upload"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center space-x-2 md:space-x-3">
                <Book className="h-6 w-6 md:h-8 md:w-8 text-teal-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-gray-600 truncate">
                    Total Syllabus
                  </p>
                  <p className="text-lg md:text-2xl font-bold truncate">
                    {syllabusContent.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center space-x-2 md:space-x-3">
                <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-green-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-gray-600 truncate">
                    Total Contents
                  </p>
                  <p className="text-lg md:text-2xl font-bold truncate">
                    {studyContent.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center space-x-2 md:space-x-3">
                <FileText className="h-6 w-6 md:h-8 md:w-8 text-purple-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-gray-600 truncate">
                    Total Files
                  </p>
                  <p className="text-lg md:text-2xl font-bold truncate">
                    {[...syllabusContent, ...studyContent].reduce(
                      (acc, item) =>
                        acc +
                        (item.files?.length || (item.fileUrl ? 1 : 0) || 1),
                      0,
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center space-x-2 md:space-x-3">
                <Upload className="h-6 w-6 md:h-8 md:w-8 text-orange-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-gray-600 truncate">
                    This Month
                  </p>
                  <p className="text-lg md:text-2xl font-bold truncate">
                    {
                      [...syllabusContent, ...studyContent].filter((item) => {
                        const itemDate = new Date(
                          item.createdAt?.seconds * 1000 || item.createdAt,
                        );
                        const now = new Date();
                        return (
                          itemDate.getMonth() === now.getMonth() &&
                          itemDate.getFullYear() === now.getFullYear()
                        );
                      }).length
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col gap-3 md:gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by title or description..."
                    value={filters.search}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        search: e.target.value,
                      }))
                    }
                    className="pl-10 min-h-[44px]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <Select
                    value={filters.class}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, class: value }))
                    }
                  >
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Filter by Class" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All Classes</SelectItem>
                      {CLASS_LEVELS.map((classLevel) => (
                        <SelectItem key={classLevel} value={classLevel}>
                          {classLevel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select
                    value={filters.section}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, section: value }))
                    }
                  >
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Filter by Section" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All Sections</SelectItem>
                      <SelectItem value="syllabus">Syllabus</SelectItem>
                      <SelectItem value="contents">Contents</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Tabs */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-lg md:text-xl">
                Content Management
              </CardTitle>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger
                    value="syllabus"
                    className="flex items-center gap-2"
                  >
                    <Book className="h-4 w-4" />
                    Syllabus
                  </TabsTrigger>
                  <TabsTrigger
                    value="contents"
                    className="flex items-center gap-2"
                  >
                    <BookOpen className="h-4 w-4" />
                    Contents
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="syllabus" className="mt-0">
                {loading ? (
                  <div className="text-center py-8">Loading content...</div>
                ) : getFilteredContent().filter(
                    (item) => item.section === "syllabus",
                  ).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Book className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No syllabus content found.</p>
                    <p className="text-sm mt-2">
                      Upload some content to get started.
                    </p>
                  </div>
                ) : (
                  renderContentList(
                    getFilteredContent().filter(
                      (item) => item.section === "syllabus",
                    ),
                  )
                )}
              </TabsContent>

              <TabsContent value="contents" className="mt-0">
                {loading ? (
                  <div className="text-center py-8">Loading content...</div>
                ) : getFilteredContent().filter(
                    (item) => item.section === "contents",
                  ).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No study content found.</p>
                    <p className="text-sm mt-2">
                      Upload some content to get started.
                    </p>
                  </div>
                ) : (
                  renderContentList(
                    getFilteredContent().filter(
                      (item) => item.section === "contents",
                    ),
                  )
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle>Edit Content</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Title *</Label>
                <Input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Enter content title"
                  className="min-h-[44px]"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Enter content description"
                  className="min-h-[80px] resize-none"
                />
              </div>

              {/* Current Files Display */}
              {(editItem?.files?.length > 0 || editItem?.fileUrl) && (
                <div>
                  <Label className="text-sm font-medium">Current Files</Label>
                  <div className="space-y-2 p-3 bg-gray-50 rounded border">
                    {editItem.files ? (
                      editItem.files.map((file, index) => (
                        <div key={index} className="flex items-center gap-2">
                          {file.type === "image" && (
                            <ImageIcon className="h-4 w-4 text-teal-600" />
                          )}
                          {file.type === "pdf" && (
                            <FileText className="h-4 w-4 text-red-600" />
                          )}
                          {file.type === "video" && (
                            <Video className="h-4 w-4 text-green-600" />
                          )}
                          <span className="text-sm">{file.originalName}</span>
                          <Badge
                            variant={
                              file.type === "image"
                                ? "default"
                                : file.type === "video"
                                  ? "default"
                                  : "secondary"
                            }
                            className="text-xs"
                          >
                            {file.type === "image"
                              ? "Image"
                              : file.type === "video"
                                ? "Video"
                                : "PDF"}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      // Legacy single file format
                      <div className="flex items-center gap-2">
                        {editItem.fileType === "image" && (
                          <ImageIcon className="h-4 w-4 text-teal-600" />
                        )}
                        {editItem.fileType === "pdf" && (
                          <FileText className="h-4 w-4 text-red-600" />
                        )}
                        {editItem.fileType === "video" && (
                          <Video className="h-4 w-4 text-green-600" />
                        )}
                        <span className="text-sm">{editItem.originalName}</span>
                        <Badge
                          variant={
                            editItem.fileType === "image"
                              ? "default"
                              : editItem.fileType === "video"
                                ? "default"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {editItem.fileType === "image"
                            ? "Image"
                            : editItem.fileType === "video"
                              ? "Video"
                              : "PDF"}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Add Additional Files */}
              <div>
                <Label className="text-sm font-medium">
                  Add More Files (Optional)
                </Label>
                <Select
                  value={editForm.uploadType}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, uploadType: value }))
                  }
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Add more content..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="none">No additional files</SelectItem>
                    <SelectItem value="file">Upload More Files</SelectItem>
                    <SelectItem value="video">Add Video Link</SelectItem>
                    <SelectItem value="mixed">
                      Upload Files + Video Link
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(editForm.uploadType === "video" ||
                editForm.uploadType === "mixed") && (
                <div>
                  <Label className="text-sm font-medium">
                    Video URL{" "}
                    {editForm.uploadType === "mixed" ? "(Optional)" : "*"}
                  </Label>
                  <Input
                    value={editForm.videoUrl}
                    onChange={(e) => handleEditVideoUrlChange(e.target.value)}
                    placeholder="Enter YouTube, Vimeo, or direct video URL"
                    className="min-h-[44px]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Supported: YouTube, Vimeo, or direct video file URLs
                  </p>
                </div>
              )}

              {(editForm.uploadType === "file" ||
                editForm.uploadType === "mixed") && (
                <div>
                  <Label className="text-sm font-medium">
                    Additional Files *
                  </Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    <input
                      type="file"
                      id="edit-file-upload"
                      multiple
                      accept="image/*,.pdf"
                      onChange={handleEditFileUpload}
                      className="sr-only"
                    />
                    <label
                      htmlFor="edit-file-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="h-8 w-8 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Click to upload additional files
                      </span>
                      <span className="text-xs text-gray-500">
                        Images (PNG, JPG, GIF) and PDFs up to 50MB
                      </span>
                    </label>
                  </div>

                  {editForm.files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <Label className="text-sm font-medium">
                        Selected Files ({editForm.files.length})
                      </Label>
                      <div className="space-y-2">
                        {editForm.files.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 border rounded"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <span className="text-sm truncate">
                                {file.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {getFileType(file)}
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeEditFile(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {uploading && editForm.uploadType !== "none" && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading additional content...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  className="min-h-[44px]"
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="min-h-[44px]"
                  disabled={uploading}
                >
                  {uploading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Content Viewer Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle>{viewItem?.title}</DialogTitle>
              {viewItem?.description && (
                <p className="text-sm text-gray-600">{viewItem.description}</p>
              )}
            </DialogHeader>
            <div className="space-y-4">
              {viewItem?.files?.map((file, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {file.type === "image" && (
                        <ImageIcon className="h-5 w-5 text-teal-600" />
                      )}
                      {file.type === "pdf" && (
                        <FileText className="h-5 w-5 text-red-600" />
                      )}
                      {file.type === "video" && (
                        <Video className="h-5 w-5 text-green-600" />
                      )}
                      <span className="font-medium">{file.originalName}</span>
                      <Badge
                        variant={
                          file.type === "image"
                            ? "default"
                            : file.type === "video"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {file.type === "image"
                          ? "Image"
                          : file.type === "video"
                            ? "Video"
                            : "PDF"}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(file.url, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open
                    </Button>
                  </div>

                  {file.type === "image" && (
                    <div className="max-w-full">
                      <Image
                        src={file.url}
                        alt={file.originalName}
                        width={800}
                        height={400}
                        className="max-w-full h-auto rounded border object-contain"
                        style={{ maxHeight: "400px" }}
                      />
                    </div>
                  )}

                  {file.type === "video" && (
                    <div className="aspect-video">
                      {getYouTubeEmbedUrl(file.url) ? (
                        <iframe
                          src={getYouTubeEmbedUrl(file.url)}
                          className="w-full h-full rounded border"
                          allowFullScreen
                        />
                      ) : getVimeoEmbedUrl(file.url) ? (
                        <iframe
                          src={getVimeoEmbedUrl(file.url)}
                          className="w-full h-full rounded border"
                          allowFullScreen
                        />
                      ) : (
                        <video
                          controls
                          className="w-full h-full rounded border"
                        >
                          <source src={file.url} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      )}
                    </div>
                  )}

                  {file.type === "pdf" && (
                    <div className="text-center py-8 bg-gray-50 rounded border">
                      <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p className="text-gray-600 mb-4">PDF Document</p>
                      <Button onClick={() => window.open(file.url, "_blank")}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open PDF
                      </Button>
                    </div>
                  )}
                </div>
              )) ||
                // Fallback for old single file format
                (viewItem && (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {viewItem.fileType === "image" && (
                          <ImageIcon className="h-5 w-5 text-teal-600" />
                        )}
                        {viewItem.fileType === "pdf" && (
                          <FileText className="h-5 w-5 text-red-600" />
                        )}
                        {viewItem.fileType === "video" && (
                          <Video className="h-5 w-5 text-green-600" />
                        )}
                        <span className="font-medium">
                          {viewItem.originalName}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(viewItem.fileUrl, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open
                      </Button>
                    </div>

                    {viewItem.fileType === "image" && (
                      <Image
                        src={viewItem.fileUrl}
                        alt={viewItem.originalName}
                        width={800}
                        height={400}
                        className="max-w-full h-auto rounded border object-contain"
                        style={{ maxHeight: "400px" }}
                      />
                    )}

                    {viewItem.fileType === "video" && (
                      <div className="aspect-video">
                        <iframe
                          src={viewItem.fileUrl}
                          className="w-full h-full rounded border"
                          allowFullScreen
                        />
                      </div>
                    )}

                    {viewItem.fileType === "pdf" && (
                      <div className="text-center py-8 bg-gray-50 rounded border">
                        <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p className="text-gray-600 mb-4">PDF Document</p>
                        <Button
                          onClick={() =>
                            window.open(viewItem.fileUrl, "_blank")
                          }
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open PDF
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Delete Content</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete this item? This action cannot be
                undone.
              </p>
              {deleteItem && (
                <div className="mt-3 p-3 bg-gray-50 rounded border">
                  <div className="font-medium">{deleteItem.title}</div>
                  <div className="text-sm text-gray-500">
                    {deleteItem.class} - {deleteItem.section}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                className="min-h-[44px]"
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
