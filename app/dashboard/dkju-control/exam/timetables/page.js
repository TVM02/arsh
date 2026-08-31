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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Calendar,
  Plus,
  Upload,
  Search,
  Trash2,
  Edit,
  Image as ImageIcon,
  Table as TableIcon,
} from "lucide-react";
import {
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  COLLECTIONS,
} from "@/lib/firestoreService";
import { orderBy } from "firebase/firestore";
import useAuthStore from "@/lib/authStore";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { toast } from "sonner";
import Image from "next/image";
import html2canvas from "html2canvas";

// Helper function to format dates
const formatDate = (dateValue) => {
  if (!dateValue) return "Not available";

  try {
    if (dateValue && typeof dateValue.toDate === "function") {
      return dateValue.toDate().toLocaleDateString();
    }

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return "Invalid date";
    }

    return date.toLocaleDateString();
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Date error";
  }
};

export default function ExamTimetablesPage() {
  const { user, role } = useAuth();
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  // Data States
  const [exams, setExams] = useState([]);
  const [filteredTimetables, setFilteredTimetables] = useState([]);

  // Dialog States
  const [isCreateTimetableOpen, setIsCreateTimetableOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [timetableMode, setTimetableMode] = useState("upload"); // 'upload' or 'table'

  // Form States
  const [timetableForm, setTimetableForm] = useState({
    examId: "",
    title: "",
    description: "",
    image: "",
    date: "",
    timetableEntries: [{ subject: "", date: "" }], // For table-based timetable
  });

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExam, setSelectedExam] = useState("all");

  // Fetch data
  const fetchExams = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      const fetchedExams = await getDocuments(COLLECTIONS.EXAMS, constraints);
      // Filter exams that have timetable data
      const examsWithTimetables = fetchedExams.filter(
        (exam) =>
          exam.uploadedTimetableImage ||
          exam.generatedTimetableImage ||
          exam.timetableImage,
      );
      setExams(examsWithTimetables);
      setFilteredTimetables(examsWithTimetables);
    } catch (error) {
      console.error("Error fetching exams:", error);
      setError("Failed to fetch exams");
    }
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      await fetchExams();
      setLoading(false);
    };

    fetchAllData();
  }, [fetchExams]);

  // Filter timetables
  useEffect(() => {
    let filtered = exams;

    // Search by title or description
    if (searchTerm) {
      filtered = filtered.filter(
        (exam) =>
          exam.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exam.timetableTitle
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          exam.timetableDescription
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by exam (class in this case)
    if (selectedExam !== "all") {
      filtered = filtered.filter((exam) => exam.class === selectedExam);
    }

    setFilteredTimetables(filtered);
  }, [exams, searchTerm, selectedExam]);

  // Handle timetable image upload
  const handleTimetableImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    try {
      setUploading(true);
      const imageUrl = await uploadToCloudinary(file);
      setTimetableForm((prev) => ({
        ...prev,
        image: imageUrl,
      }));
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  // Timetable entry handlers
  const handleAddTimetableEntry = () => {
    setTimetableForm((prev) => ({
      ...prev,
      timetableEntries: [
        ...(prev.timetableEntries || []),
        { subject: "", date: "" },
      ],
    }));
  };

  const handleUpdateTimetableEntry = (index, field, value) => {
    setTimetableForm((prev) => ({
      ...prev,
      timetableEntries: (prev.timetableEntries || []).map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry,
      ),
    }));
  };

  const handleRemoveTimetableEntry = (index) => {
    setTimetableForm((prev) => ({
      ...prev,
      timetableEntries: (prev.timetableEntries || []).filter(
        (_, i) => i !== index,
      ),
    }));
  };

  // Generate PNG from timetable table with branding
  const handleGenerateTimetablePNG = async () => {
    const tableElement = document.getElementById("timetable-table");
    if (!tableElement) {
      toast.error("Timetable table not found");
      return;
    }

    try {
      setUploading(true);

      // Create a wrapper div for better styling (A4 landscape: 1123px x 794px at 96 DPI)
      const wrapper = document.createElement("div");
      wrapper.style.backgroundColor = "#ffffff";
      wrapper.style.padding = "30px";
      wrapper.style.fontFamily = "Arial, sans-serif";
      wrapper.style.width = "1063px"; // A4 landscape width minus padding
      wrapper.style.minHeight = "734px"; // A4 landscape height minus padding
      wrapper.style.margin = "0 auto";
      wrapper.style.color = "#000000";
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";

      // Add branding header with better styling
      const header = document.createElement("div");
      header.style.textAlign = "center";
      header.style.marginBottom = "20px";
      header.style.borderBottom = "3px solid #000000";
      header.style.paddingBottom = "15px";
      header.style.backgroundColor = "#f8f8f8";
      header.style.padding = "20px";
      header.style.borderRadius = "8px";

      const logo = document.createElement("h1");
      logo.style.color = "#000000";
      logo.style.fontSize = "28px";
      logo.style.fontWeight = "bold";
      logo.style.marginBottom = "5px";
      logo.style.letterSpacing = "1px";
      logo.style.textTransform = "uppercase";
      logo.textContent = "DAKSHINA KERALA ISLAM MATHA VIDHYABHASA BOARD";

      const tagline = document.createElement("p");
      tagline.style.color = "#666666";
      tagline.style.fontSize = "14px";
      tagline.style.margin = "5px 0 0 0";
      tagline.style.fontStyle = "italic";
      tagline.textContent = "Islamic Educational Excellence";

      header.appendChild(logo);
      header.appendChild(tagline);

      // Add exam title with better styling
      const examTitle = document.createElement("h2");
      examTitle.style.color = "#000000";
      examTitle.style.fontSize = "22px";
      examTitle.style.fontWeight = "bold";
      examTitle.style.textAlign = "center";
      examTitle.style.margin = "15px 0";
      examTitle.style.backgroundColor = "#e8e8e8";
      examTitle.style.padding = "10px";
      examTitle.style.borderRadius = "5px";
      examTitle.style.border = "2px solid #000000";
      examTitle.textContent = timetableForm.title || "Exam Timetable";

      // Add timetable instruction from description field
      const instruction = document.createElement("div");
      instruction.style.backgroundColor = "#f0f0f0";
      instruction.style.padding = "15px";
      instruction.style.borderRadius = "5px";
      instruction.style.margin = "15px 0";
      instruction.style.border = "1px solid #000000";

      const instructionTitle = document.createElement("h3");
      instructionTitle.style.color = "#000000";
      instructionTitle.style.fontSize = "16px";
      instructionTitle.style.fontWeight = "bold";
      instructionTitle.style.margin = "0 0 10px 0";
      instructionTitle.style.textDecoration = "underline";
      instructionTitle.textContent = "Timetable Instructions";

      const instructionText = document.createElement("p");
      instructionText.style.color = "#000000";
      instructionText.style.fontSize = "13px";
      instructionText.style.margin = "0";
      instructionText.style.lineHeight = "1.5";
      instructionText.textContent =
        timetableForm.description ||
        "Please arrive 15 minutes before your exam time. Bring your admit card and necessary stationery. Mobile phones are strictly prohibited in the examination hall.";

      instruction.appendChild(instructionTitle);
      instruction.appendChild(instructionText);

      // Add exam start date with better styling
      const examDateDiv = document.createElement("div");
      examDateDiv.style.backgroundColor = "#e8e8e8";
      examDateDiv.style.padding = "12px";
      examDateDiv.style.borderRadius = "5px";
      examDateDiv.style.margin = "15px 0";
      examDateDiv.style.textAlign = "center";
      examDateDiv.style.border = "2px solid #000000";
      examDateDiv.style.display = "inline-block";
      examDateDiv.style.width = "fit-content";
      examDateDiv.style.marginLeft = "auto";
      examDateDiv.style.marginRight = "auto";

      const examDateLabel = document.createElement("span");
      examDateLabel.style.fontWeight = "bold";
      examDateLabel.style.color = "#000000";
      examDateLabel.style.fontSize = "14px";
      examDateLabel.textContent = "Exam Start Date: ";

      const examDateValue = document.createElement("span");
      examDateValue.style.color = "#000000";
      examDateValue.style.fontSize = "14px";
      examDateValue.textContent = timetableForm.date
        ? new Date(timetableForm.date).toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "Not specified";

      examDateDiv.appendChild(examDateLabel);
      examDateDiv.appendChild(examDateValue);

      // Clone and style the table (include Day column, exclude actions column)
      const clonedTable = document.createElement("table");
      clonedTable.style.width = "100%";
      clonedTable.style.borderCollapse = "collapse";
      clonedTable.style.marginTop = "20px";
      clonedTable.style.border = "2px solid #000000";
      clonedTable.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";

      // Get original table rows
      const originalRows = tableElement.querySelectorAll("tr");

      originalRows.forEach((row, rowIndex) => {
        const clonedRow = document.createElement("tr");

        if (rowIndex === 0) {
          // Header row - add Day column
          const dayHeader = document.createElement("th");
          dayHeader.style.backgroundColor = "#000000";
          dayHeader.style.color = "white";
          dayHeader.style.padding = "12px";
          dayHeader.style.textAlign = "center";
          dayHeader.style.fontWeight = "bold";
          dayHeader.style.border = "1px solid #000000";
          dayHeader.style.fontSize = "13px";
          dayHeader.textContent = "Day";
          clonedRow.appendChild(dayHeader);
        } else {
          // Data rows - add day from date
          const cells = row.querySelectorAll("td, th");
          if (cells.length > 1) {
            const dateCell = cells[1]; // Date is in second column
            const dateValue =
              dateCell.querySelector("input")?.value || dateCell.textContent;

            let dayName = "";
            if (dateValue) {
              try {
                const date = new Date(dateValue);
                dayName = date.toLocaleDateString("en-IN", { weekday: "long" });
              } catch (e) {
                dayName = "Invalid Date";
              }
            }

            const dayData = document.createElement("td");
            dayData.style.padding = "8px";
            dayData.style.border = "1px solid #000000";
            dayData.style.backgroundColor = "white";
            dayData.style.color = "#000000";
            dayData.style.fontSize = "12px";
            dayData.style.textAlign = "center";
            dayData.style.fontWeight = "bold";
            dayData.textContent = dayName;
            clonedRow.appendChild(dayData);
          }
        }

        // Skip actions column (last column) and add other columns
        const cells = row.querySelectorAll("td, th");
        for (let i = 0; i < cells.length - 1; i++) {
          const cell = cells[i];
          const clonedCell = cell.cloneNode(true);

          if (rowIndex === 0) {
            // Header row
            clonedCell.style.backgroundColor = "#000000";
            clonedCell.style.color = "white";
            clonedCell.style.padding = "12px";
            clonedCell.style.textAlign = "center";
            clonedCell.style.fontWeight = "bold";
            clonedCell.style.border = "1px solid #000000";
            clonedCell.style.fontSize = "13px";
          } else {
            // Data rows
            clonedCell.style.padding = "8px";
            clonedCell.style.border = "1px solid #000000";
            clonedCell.style.backgroundColor =
              rowIndex % 2 === 0 ? "#f9f9f9" : "white";
            clonedCell.style.color = "#000000";
            clonedCell.style.fontSize = "12px";
            clonedCell.style.textAlign = "center";
          }

          clonedRow.appendChild(clonedCell);
        }

        clonedTable.appendChild(clonedRow);
      });

      // Add footer with better styling
      const footer = document.createElement("div");
      footer.style.textAlign = "center";
      footer.style.marginTop = "20px";
      footer.style.paddingTop = "15px";
      footer.style.borderTop = "2px solid #000000";
      footer.style.color = "#000000";
      footer.style.fontSize = "11px";
      footer.style.backgroundColor = "#f8f8f8";
      footer.style.padding = "10px";
      footer.style.borderRadius = "5px";
      footer.textContent = `Generated on ${new Date().toLocaleDateString()} | DAKSHINA KERALA ISLAM MATHA VIDHYABHASA BOARD`;

      // Assemble the document
      wrapper.appendChild(header);
      wrapper.appendChild(examTitle);
      wrapper.appendChild(instruction);
      wrapper.appendChild(examDateDiv);
      wrapper.appendChild(clonedTable);
      wrapper.appendChild(footer);

      // Temporarily add to DOM for html2canvas
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(wrapper, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        width: 1123, // A4 landscape width at 96 DPI
        height: Math.max(794, wrapper.scrollHeight), // A4 landscape height or content height
      });

      // Remove from DOM
      document.body.removeChild(wrapper);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error("Failed to generate timetable");
          return;
        }

        const file = new File(
          [blob],
          `${timetableForm.title || "exam"}-timetable.png`,
          { type: "image/png" },
        );
        const imageUrl = await uploadToCloudinary(file);

        setTimetableForm((prev) => ({
          ...prev,
          image: imageUrl,
        }));

        toast.success("Timetable created successfully");
      }, "image/png");
    } catch (error) {
      console.error("Error generating timetable:", error);
      toast.error("Failed to create timetable");
    } finally {
      setUploading(false);
    }
  };

  // Handle timetable creation
  const handleTimetableSubmit = async (e) => {
    e.preventDefault();

    if (
      !timetableForm.examId ||
      !timetableForm.title ||
      !timetableForm.description ||
      !timetableForm.date
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (timetableMode === "upload" && !timetableForm.image) {
      toast.error("Please upload a timetable image");
      return;
    }

    if (timetableMode === "create" && !timetableForm.image) {
      toast.error("Please generate a timetable PNG first");
      return;
    }

    setUploading(true);

    try {
      const timetableData = {
        examId: timetableForm.examId,
        title: timetableForm.title,
        description: timetableForm.description,
        image: timetableForm.image,
        date: new Date(timetableForm.date),
        createdBy: userData?.id || user?.uid,
        createdByName: userData?.name || user?.displayName || "Admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await createDocument(COLLECTIONS.EXAM_TIMETABLES, timetableData);
      toast.success("Exam timetable created successfully");

      setIsCreateTimetableOpen(false);
      setTimetableForm({
        examId: "",
        title: "",
        description: "",
        image: "",
        date: "",
        timetableEntries: [{ subject: "", date: "" }],
      });
      setTimetableMode("upload");

      await fetchExamTimetables();
    } catch (error) {
      console.error("Error creating timetable:", error);
      toast.error("Failed to create timetable");
    } finally {
      setUploading(false);
    }
  };

  // Handle timetable deletion
  const handleDeleteTimetable = async (timetableId) => {
    if (
      !confirm(
        "Are you sure you want to delete this timetable? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await deleteDocument(COLLECTIONS.EXAM_TIMETABLES, timetableId);
      toast.success("Timetable deleted successfully");
      await fetchExamTimetables();
    } catch (error) {
      console.error("Error deleting timetable:", error);
      toast.error("Failed to delete timetable");
    }
  };

  // Handle timetable editing
  const handleEditTimetable = (timetable) => {
    setEditingItem(timetable);
    setTimetableForm({
      examId: timetable.examId,
      title: timetable.title,
      description: timetable.description,
      image: timetable.image,
      date: timetable.date?.toDate
        ? timetable.date.toDate().toISOString().split("T")[0]
        : timetable.date,
      timetableEntries: [{ subject: "", date: "" }],
    });
    setTimetableMode("upload"); // Default to upload mode for editing existing timetables
    setIsCreateTimetableOpen(true);
  };

  // Handle timetable update
  const handleUpdateTimetable = async (e) => {
    e.preventDefault();

    if (
      !timetableForm.examId ||
      !timetableForm.title ||
      !timetableForm.description ||
      !timetableForm.date
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (timetableMode === "upload" && !timetableForm.image) {
      toast.error("Please upload a timetable image");
      return;
    }

    if (timetableMode === "create" && !timetableForm.image) {
      toast.error("Please generate a timetable PNG first");
      return;
    }

    setUploading(true);

    try {
      const timetableData = {
        examId: timetableForm.examId,
        title: timetableForm.title,
        description: timetableForm.description,
        image: timetableForm.image,
        date: new Date(timetableForm.date),
        updatedAt: new Date(),
        updatedBy: userData.uid,
        updatedByName: userData.name || userData.displayName || "Unknown",
      };

      await updateDocument(
        COLLECTIONS.EXAM_TIMETABLES,
        editingItem.id,
        timetableData,
      );

      toast.success("Timetable updated successfully");
      setIsCreateTimetableOpen(false);
      setEditingItem(null);
      setTimetableForm({
        examId: "",
        title: "",
        description: "",
        image: "",
        date: "",
        timetableEntries: [{ subject: "", date: "" }],
      });
      setTimetableMode("upload");
      await fetchExamTimetables();
    } catch (error) {
      console.error("Error updating timetable:", error);
      toast.error("Failed to update timetable");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading timetables...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Exam Timetables
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Create and manage exam timetables for students
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    Total Timetables
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {exams.length}
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
                    {filteredTimetables.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">
              Filter Timetables
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="search">Search Timetables</Label>
                <Input
                  id="search"
                  placeholder="Search by title or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="exam-filter">Filter by Class</Label>
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Classes</SelectItem>
                    {[...new Set(exams.map((exam) => exam.class))]
                      .filter(Boolean)
                      .filter(className => String(className).trim() !== "13")
                      .map((className) => (
                        <SelectItem key={className} value={className}>
                          {className}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h2 className="text-lg sm:text-xl font-semibold">
              Timetables ({filteredTimetables.length})
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">
              Timetables are created and managed in the Exam Creation page
            </p>
          </div>

          {/* Timetables List */}
          <div className="grid gap-3 sm:gap-4">
            {filteredTimetables.length === 0 ? (
              <Card>
                <CardContent className="text-center py-6 sm:py-8">
                  <Calendar className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm sm:text-base text-gray-500">
                    {exams.length === 0
                      ? "No exam timetables created yet"
                      : "No timetables match your filters"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredTimetables.map((exam) => {
                return (
                  <Card key={exam.id} className="">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                            <h3 className="text-base sm:text-lg font-semibold">
                              {exam.title}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              {exam.class}
                            </Badge>
                            <Badge
                              variant={exam.isActive ? "default" : "secondary"}
                              className={`text-xs ${exam.isActive ? "bg-green-500 hover:bg-green-500 text-white" : ""}`}
                            >
                              {exam.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>

                          <div className="text-xs sm:text-sm text-gray-600 space-y-2">
                            <p>
                              <strong>Subject:</strong> {exam.subject}
                            </p>
                            <p>
                              <strong>Exam Date:</strong>{" "}
                              {formatDate(exam.examDate)}
                            </p>

                            {exam.timetableTitle && (
                              <p className="text-sm sm:text-base font-medium mt-3">
                                {exam.timetableTitle}
                              </p>
                            )}

                            {exam.timetableDescription && (
                              <p className="text-xs sm:text-sm text-gray-600">
                                {exam.timetableDescription}
                              </p>
                            )}
                          </div>

                          {/* Display timetable images */}
                          <div className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
                            {/* Uploaded Timetable */}
                            {exam.uploadedTimetableImage && (
                              <div>
                                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                  Uploaded Timetable:
                                </p>
                                {exam.uploadedTimetableFileType ===
                                "application/pdf" ? (
                                  <div
                                    className="flex items-center gap-2 p-3 sm:p-4 border rounded-md bg-gray-50 cursor-pointer hover:bg-gray-100"
                                    onClick={() =>
                                      window.open(
                                        exam.uploadedTimetableImage,
                                        "_blank",
                                      )
                                    }
                                  >
                                    <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
                                    <div>
                                      <p className="text-xs sm:text-sm font-medium">
                                        PDF Timetable
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Click to view
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <Image
                                    src={exam.uploadedTimetableImage}
                                    alt="Uploaded timetable"
                                    width={500}
                                    height={300}
                                    className="max-w-full h-48 sm:h-64 object-contain border rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() =>
                                      window.open(
                                        exam.uploadedTimetableImage,
                                        "_blank",
                                      )
                                    }
                                  />
                                )}
                              </div>
                            )}

                            {/* Generated Timetable */}
                            {exam.generatedTimetableImage && (
                              <div>
                                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                  Generated Timetable:
                                </p>
                                <Image
                                  src={exam.generatedTimetableImage}
                                  alt="Generated timetable"
                                  width={500}
                                  height={300}
                                  className="max-w-full h-48 sm:h-64 object-contain border rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() =>
                                    window.open(
                                      exam.generatedTimetableImage,
                                      "_blank",
                                    )
                                  }
                                />
                              </div>
                            )}

                            {/* Legacy Timetable */}
                            {exam.timetableImage &&
                              !exam.uploadedTimetableImage &&
                              !exam.generatedTimetableImage && (
                                <div>
                                  <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                    Timetable:
                                  </p>
                                  <Image
                                    src={
                                      typeof exam.timetableImage === "string"
                                        ? exam.timetableImage
                                        : exam.timetableImage?.secure_url ||
                                          exam.timetableImage?.url
                                    }
                                    alt="Exam timetable"
                                    width={500}
                                    height={300}
                                    className="max-w-full h-48 sm:h-64 object-contain border rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() =>
                                      window.open(
                                        typeof exam.timetableImage === "string"
                                          ? exam.timetableImage
                                          : exam.timetableImage?.secure_url ||
                                              exam.timetableImage?.url,
                                        "_blank",
                                      )
                                    }
                                  />
                                </div>
                              )}

                            <p className="text-xs text-gray-500 mt-2">
                              Click images to view full size
                            </p>
                          </div>

                          <p className="text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4">
                            Created: {formatDate(exam.createdAt)} by{" "}
                            {exam.createdByName}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
