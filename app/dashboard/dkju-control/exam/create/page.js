"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/lib/authUtils";
import { convertMinutesToHours, formatDuration } from "@/lib/hallTicketUtils";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileCheck,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Clock,
  Users,
  DollarSign,
  Upload,
  Image as ImageIcon,
  FileText,
  ClipboardList,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Eye,
  Globe,
} from "lucide-react";
import {
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  COLLECTIONS,
} from "@/lib/firestoreService";
import {
  orderBy,
  where,
  collection,
  query,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { toast } from "sonner";
import {
  DISTRICT_ORDER,
  canonicalDistrictName,
  getMekhalaListForDistrict,
  madrasaMatchesDistrict,
  madrasaMatchesMekhala,
  sortMadarsasByIdThenName,
} from "@/lib/madrasaHierarchy";
import html2canvas from "html2canvas";
import Image from "next/image";
import { generateAttendanceSheet, generateResultSheet } from "@/lib/pdfUtils";
import { saveAs } from "file-saver";

const downloadFile = async (url, filename) => {
  const saveBlob = (blob, name) => {
    let finalFilename = name;
    if (!name.includes(".")) {
      const mimeType = blob.type;
      let extension = "";

      if (mimeType === "application/pdf") {
        extension = "pdf";
      } else if (mimeType.startsWith("image/")) {
        extension = mimeType.split("/")[1];
        if (extension === "jpeg") extension = "jpg";
      }

      if (extension) {
        finalFilename = `${name}.${extension}`;
      }
    }
    saveAs(blob, finalFilename);
  };

  try {
    // Try using XMLHttpRequest for more reliable blob downloading
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "blob";
      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(xhr.response);
        } else {
          reject(new Error(`XHR failed with status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("XHR Network error"));
      xhr.send();
    });

    saveBlob(blob, filename);
  } catch (xhrError) {
    console.warn("XHR download failed, trying fetch fallback:", xhrError);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      saveBlob(blob, filename);
    } catch (fetchError) {
      console.error(
        "Fetch failed, opening in new tab as last resort:",
        fetchError,
      );
      window.open(url, "_blank");
    }
  }
};

// Helper function to format dates
const formatDate = (dateValue) => {
  if (!dateValue) return "Not available";

  try {
    if (dateValue && typeof dateValue.toDate === "function") {
      // Firestore timestamp
      dateValue = dateValue.toDate();
    }

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return "Invalid date";
    }

    // Check if the original value contains time information
    const hasTime =
      typeof dateValue === "string" &&
      dateValue.includes("T") &&
      dateValue.split("T")[1] !== "00:00:00.000Z";

    if (hasTime) {
      return date.toLocaleString();
    } else {
      return date.toLocaleDateString();
    }
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Date error";
  }
};

// Helper function to convert 24-hour time to 12-hour format with AM/PM
const formatTime12Hour = (time24) => {
  if (!time24) return "";

  try {
    const [hours, minutes] = time24.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
  } catch (error) {
    return time24;
  }
};

function CreateExamsPage() {
  const router = useRouter();
  const { user, role } = useAuth();
  const { userData } = useAuthStore();
  const searchParams = useSearchParams();
  const examIdParam = searchParams.get("id");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Exam Management States
  const [exams, setExams] = useState([]);
  const [examRegistrations, setExamRegistrations] = useState([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const examsPerPage = 10;

  // Get current exams for pagination
  const indexOfLastExam = currentPage * examsPerPage;
  const indexOfFirstExam = indexOfLastExam - examsPerPage;
  const currentExams = exams.slice(indexOfFirstExam, indexOfLastExam);

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Dialog States
  const [isCreateExamOpen, setIsCreateExamOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [timetableMode, setTimetableMode] = useState("both"); // 'upload', 'table', or 'both'
  const [viewMode, setViewMode] = useState("card"); // 'card' or 'compact'
  const [expandedExamId, setExpandedExamId] = useState(null); // For compact view expansion
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState(null);

  // Attendance Sheet Dialog States
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [selectedExamForAttendance, setSelectedExamForAttendance] =
    useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState("ml");
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [selectedMekhala, setSelectedMekhala] = useState("all");
  const [selectedMahal, setSelectedMahal] = useState("all");
  const [selectedMahalId, setSelectedMahalId] = useState("all");
  const [selectedClasses, setSelectedClasses] = useState(["all"]);
  const [enrichedRegistrations, setEnrichedRegistrations] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [mekhalas, setMekhalas] = useState([]);
  const [madarsas, setMadarsas] = useState([]);
  const [madarsaSearch, setMadarsaSearch] = useState("");

  // Result Sheet Dialog States
  const [resultSheetDialogOpen, setResultSheetDialogOpen] = useState(false);
  const [selectedExamForResult, setSelectedExamForResult] = useState(null);
  const [selectedResultLanguage, setSelectedResultLanguage] = useState("ml");
  const [selectedResultMahal, setSelectedResultMahal] = useState("all");
  const [selectedResultMahalId, setSelectedResultMahalId] = useState("all");
  const [selectedResultClasses, setSelectedResultClasses] = useState([]);
  const [resultEnrichedRegistrations, setResultEnrichedRegistrations] =
    useState([]);
  const [resultMadarsaSearch, setResultMadarsaSearch] = useState("");

  // Form States
  const [examForm, setExamForm] = useState({
    title: "",
    description: "",
    subject: "",
    class: "",
    duration: "",
    totalMarks: "",
    examDate: "",
    registrationDeadline: "",
    fees: "",
    examType: "PUBLIC",
    notice: "",
    rulesAndRegulations: "",
    isActive: true,
    timetableTitle: "",
    timetableDescription: "",
    uploadedTimetableImage: "", // For uploaded files (PDF/PNG)
    uploadedTimetableFileType: "",
    uploadedTimetableFilePath: "",
    generatedTimetableImage: "", // For generated PNG from table
    generatedTimetableFilePath: "",
    timetableEntries: [
      {
        subject: "",
        date: "",
        startTime: "",
        endTime: "",
        duration: "",
        passMark: "",
      },
    ],
    overallPassMark: "",
    firstFirstClassMark: "", // Requirement says "First Class Mark"
  });

  // Fetch all data
  const fetchExams = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      const fetchedExams = await getDocuments(COLLECTIONS.EXAMS, constraints);
      // console.log("Fetched Exams:", fetchedExams);
      setExams(fetchedExams);
    } catch (error) {
      console.error("Error fetching exams:", error);
      setError("Failed to fetch exams");
    }
  }, []);

  const fetchExamRegistrations = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      const fetchedRegistrations = await getDocuments(
        COLLECTIONS.EXAM_REGISTRATIONS,
        constraints,
      );
      setExamRegistrations(fetchedRegistrations);
    } catch (error) {
      console.error("Error fetching exam registrations:", error);
    }
  }, []);

  // Fetch districts, mekhalas, and madarsas
  const fetchLocationData = useCallback(async () => {
    try {
      // Fetch districts (authoritative mapping used in Madrasa Management)
      const districtsQuery = query(
        collection(db, "districts"),
        orderBy("name", "asc"),
      );
      const districtsSnapshot = await getDocs(districtsQuery);
      const districtsList = districtsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch madrasas directly using Firestore (same approach as /[examId] page)
      const madrasaQuery = query(
        collection(db, "madarsas"),
        orderBy("name", "asc"),
      );
      const madrasaSnapshot = await getDocs(madrasaQuery);
      const madrasaList = madrasaSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMadarsas(madrasaList);

      // Fetch mekhalas directly using Firestore (same approach as /[examId] page)
      const mekhalaQuery = query(
        collection(db, "mekhala"),
        orderBy("name", "asc"),
      );
      const mekhalaSnapshot = await getDocs(mekhalaQuery);
      const mekhalaList = mekhalaSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMekhalas(mekhalaList);

      if (districtsList.length > 0) {
        setDistricts(districtsList);
      } else {
        // Fallback: Extract unique districts from madrasas
        const districtSet = new Set();
        madrasaList.forEach((madarsa) => {
          if (madarsa.district) {
            districtSet.add(madarsa.district);
          }
        });
        const fallbackDistrictsList = Array.from(districtSet)
          .sort()
          .map((name) => ({ name }));
        setDistricts(fallbackDistrictsList);
      }
    } catch (error) {
      console.error("Error fetching location data:", error);
    }
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      await Promise.all([
        fetchExams(),
        fetchExamRegistrations(),
        fetchLocationData(),
      ]);
      setLoading(false);
    };

    fetchAllData();
  }, [fetchExams, fetchExamRegistrations, fetchLocationData]);

  // Handle timetable image upload
  const handleTimetableImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "application/pdf",
    ];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a PNG, JPEG, or PDF file");
      return;
    }

    try {
      setUploading(true);

      // Upload to Firebase Storage under exams/timetable
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.name}`;
      const storageRef = ref(storage, `exams/timetable/${filename}`);

      const metadata = { contentDisposition: "attachment" };
      const snapshot = await uploadBytes(storageRef, file, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);

      setExamForm((prev) => ({
        ...prev,
        uploadedTimetableImage: downloadURL,
        uploadedTimetableFileType: file.type,
        uploadedTimetableFilePath: snapshot.ref.fullPath, // Store path for future deletion if needed
      }));
      toast.success(
        `Timetable ${
          file.type === "application/pdf" ? "PDF" : "image"
        } uploaded successfully`,
      );
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload timetable file");
    } finally {
      setUploading(false);
    }
  };

  // Timetable entry handlers
  const handleAddTimetableEntry = () => {
    setExamForm((prev) => ({
      ...prev,
      timetableEntries: [
        ...prev.timetableEntries,
        { subject: "", date: "", startTime: "", endTime: "", duration: "" },
      ],
    }));
  };

  const handleUpdateTimetableEntry = (index, field, value) => {
    setExamForm((prev) => {
      const updatedEntries = prev.timetableEntries.map((entry, i) => {
        if (i === index) {
          const updatedEntry = { ...entry, [field]: value };

          // Auto-calculate duration when start or end time changes
          if (
            (field === "startTime" || field === "endTime") &&
            updatedEntry.startTime &&
            updatedEntry.endTime
          ) {
            const [startHour, startMin] = updatedEntry.startTime
              .split(":")
              .map(Number);
            const [endHour, endMin] = updatedEntry.endTime
              .split(":")
              .map(Number);

            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;

            // Calculate duration in minutes
            if (endMinutes > startMinutes) {
              updatedEntry.duration = (endMinutes - startMinutes).toString();
            } else {
              // End time must be greater than start time
              updatedEntry.duration = "";
            }
          }

          return updatedEntry;
        }
        return entry;
      });

      return {
        ...prev,
        timetableEntries: updatedEntries,
      };
    });
  };

  const handleRemoveTimetableEntry = (index) => {
    setExamForm((prev) => ({
      ...prev,
      timetableEntries: prev.timetableEntries.filter((_, i) => i !== index),
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

      // Add branding header matching hall ticket design with logos
      const header = document.createElement("div");
      header.style.textAlign = "center";
      header.style.marginBottom = "20px";
      header.style.paddingBottom = "15px";
      header.style.position = "relative";
      header.style.display = "flex";
      header.style.flexDirection = "column";
      header.style.alignItems = "center";

      // Header container with logos
      const headerContainer = document.createElement("div");
      headerContainer.style.position = "relative";
      headerContainer.style.width = "100%";
      headerContainer.style.display = "flex";
      headerContainer.style.justifyContent = "space-between";
      headerContainer.style.alignItems = "flex-start";
      headerContainer.style.marginBottom = "10px";

      // Left logo
      const leftLogo = document.createElement("img");
      leftLogo.src = "/htleft.jpg";
      leftLogo.style.width = "80px";
      leftLogo.style.height = "80px";
      leftLogo.style.objectFit = "contain";
      leftLogo.onerror = () => {
        leftLogo.style.display = "none";
      }; // Hide if image fails to load

      // Right logo
      const rightLogo = document.createElement("img");
      rightLogo.src = "/htright.jpg";
      rightLogo.style.width = "80px";
      rightLogo.style.height = "80px";
      rightLogo.style.objectFit = "contain";
      rightLogo.onerror = () => {
        rightLogo.style.display = "none";
      }; // Hide if image fails to load

      // Center content container
      const centerContent = document.createElement("div");
      centerContent.style.flex = "1";
      centerContent.style.display = "flex";
      centerContent.style.flexDirection = "column";
      centerContent.style.alignItems = "center";
      centerContent.style.justifyContent = "center";

      // Top banner image
      const bannerImg = document.createElement("img");
      bannerImg.src = "/htup.png";
      bannerImg.style.width = "380px";
      bannerImg.style.height = "auto";
      bannerImg.style.maxHeight = "40px";
      bannerImg.style.objectFit = "contain";
      bannerImg.style.marginBottom = "10px";
      bannerImg.onerror = () => {
        bannerImg.style.display = "none";
      }; // Hide if image fails to load

      // Main title (English) - matching hall ticket
      const logo = document.createElement("h1");
      logo.style.color = "#000000";
      logo.style.fontSize = "22px";
      logo.style.fontWeight = "bold";
      logo.style.margin = "0 0 8px 0";
      logo.textContent = "Dakshina Kerala Islam Matha Vidyabhyasa Board";

      // Malayalam subtitle - matching hall ticket
      const malayalamText = document.createElement("p");
      malayalamText.style.color = "#000000";
      malayalamText.style.fontSize = "14px";
      malayalamText.style.margin = "0 0 12px 0";
      malayalamText.style.fontWeight = "normal";
      malayalamText.textContent = "ദക്ഷിണ കേരള ഇസ്ലാം മത വിദ്യാഭ്യാസ ബോർഡ്";

      // Timetable label - matching hall ticket style
      const timetableLabel = document.createElement("p");
      timetableLabel.style.color = "#000000";
      timetableLabel.style.fontSize = "16px";
      timetableLabel.style.margin = "0";
      timetableLabel.style.fontWeight = "bold";
      timetableLabel.textContent = "EXAMINATION TIMETABLE";

      // Assemble center content
      centerContent.appendChild(bannerImg);
      centerContent.appendChild(logo);
      centerContent.appendChild(malayalamText);
      centerContent.appendChild(timetableLabel);

      // Assemble header container
      headerContainer.appendChild(leftLogo);
      headerContainer.appendChild(centerContent);
      headerContainer.appendChild(rightLogo);

      header.appendChild(headerContainer);

      // Add exam title with hall ticket styling
      const examTitle = document.createElement("div");
      examTitle.style.backgroundColor = "#f0f8ff"; // Light blue background
      examTitle.style.padding = "10px";
      examTitle.style.margin = "15px 0";
      examTitle.style.textAlign = "center";

      const examTitleText = document.createElement("h2");
      examTitleText.style.color = "#000000";
      examTitleText.style.fontSize = "18px";
      examTitleText.style.fontWeight = "bold";
      examTitleText.style.margin = "0";
      examTitleText.textContent = examForm.title || "Exam Timetable";

      examTitle.appendChild(examTitleText);

      // Add exam details section (similar to hall ticket)
      const detailsContainer = document.createElement("div");
      detailsContainer.style.display = "flex";
      detailsContainer.style.justifyContent = "space-between";
      detailsContainer.style.margin = "20px 0";
      detailsContainer.style.fontSize = "12px";

      // Left side details
      const leftDetails = document.createElement("div");
      leftDetails.style.flex = "1";

      const detailsList = [
        {
          label: "Exam Date:",
          value: examForm.examDate
            ? new Date(examForm.examDate).toLocaleDateString("en-IN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "Not specified",
        },
        { label: "Class:", value: examForm.class || "N/A" },
        { label: "Subject:", value: examForm.subject || "N/A" },
      ];

      detailsList.forEach((item) => {
        const row = document.createElement("div");
        row.style.marginBottom = "5px";
        row.innerHTML = `<span style="font-weight: bold; width: 100px; display: inline-block;">${item.label}</span> <span>${item.value}</span>`;
        leftDetails.appendChild(row);
      });

      // Right side details (Instructions summary)
      const rightDetails = document.createElement("div");
      rightDetails.style.flex = "1";
      rightDetails.style.textAlign = "right";

      if (examForm.timetableDescription) {
        const instructionTitle = document.createElement("div");
        instructionTitle.style.fontWeight = "bold";
        instructionTitle.style.marginBottom = "5px";
        instructionTitle.textContent = "Instructions:";
        rightDetails.appendChild(instructionTitle);

        const instructionText = document.createElement("div");
        instructionText.style.maxWidth = "300px";
        instructionText.style.marginLeft = "auto";
        instructionText.textContent = examForm.timetableDescription;
        rightDetails.appendChild(instructionText);
      }

      detailsContainer.appendChild(leftDetails);
      detailsContainer.appendChild(rightDetails);

      // Clone and style the table (include Day column, exclude actions column)
      const clonedTable = document.createElement("table");
      clonedTable.style.width = "100%";
      clonedTable.style.borderCollapse = "collapse";
      clonedTable.style.marginTop = "10px";
      clonedTable.style.border = "1px solid #000000";

      // Get original table rows
      const originalRows = tableElement.querySelectorAll("tr");

      originalRows.forEach((row, rowIndex) => {
        const clonedRow = document.createElement("tr");

        if (rowIndex === 0) {
          // Header row - add Day column first
          const dayHeader = document.createElement("th");
          dayHeader.style.backgroundColor = "#f5f5f5";
          dayHeader.style.color = "#000000";
          dayHeader.style.padding = "10px";
          dayHeader.style.textAlign = "center";
          dayHeader.style.fontWeight = "bold";
          dayHeader.style.border = "1px solid #000000";
          dayHeader.style.fontSize = "12px";
          dayHeader.textContent = "Day";
          clonedRow.appendChild(dayHeader);
        } else {
          // Data rows - add day from date
          const cells = row.querySelectorAll("td, th");
          if (cells.length > 1) {
            const dateCell = cells[1];
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
            dayData.style.fontSize = "11px";
            dayData.style.textAlign = "center";
            dayData.textContent = dayName;
            clonedRow.appendChild(dayData);
          }
        }

        // Process columns: Subject, Date, combine Time from Start+End, Duration (skip Actions column)
        const cells = row.querySelectorAll("td, th");
        for (let i = 0; i < cells.length - 1; i++) {
          const cell = cells[i];
          const clonedCell = cell.cloneNode(true);

          // Extract value from input if present
          const input = clonedCell.querySelector("input");
          if (input) {
            clonedCell.textContent = input.value;
          }

          // Style the cell
          if (rowIndex === 0) {
            // Header row
            clonedCell.style.backgroundColor = "#f5f5f5";
            clonedCell.style.color = "#000000";
            clonedCell.style.padding = "10px";
            clonedCell.style.textAlign = "center";
            clonedCell.style.fontWeight = "bold";
            clonedCell.style.border = "1px solid #000000";
            clonedCell.style.fontSize = "12px";
          } else {
            // Data rows
            clonedCell.style.padding = "8px";
            clonedCell.style.border = "1px solid #000000";
            clonedCell.style.backgroundColor = "white";
            clonedCell.style.color = "#000000";
            clonedCell.style.fontSize = "11px";
            clonedCell.style.textAlign = "center";
          }

          // Add Subject column (index 0)
          if (i === 0) {
            clonedRow.appendChild(clonedCell);
          }
          // Add Date column (index 1) and then combined Time column
          else if (i === 1) {
            clonedRow.appendChild(clonedCell);

            // Create combined Time column from Start Time (i=2) and End Time (i=3)
            if (rowIndex === 0) {
              // Header row - add "Time" header
              const timeHeader = document.createElement("th");
              timeHeader.style.backgroundColor = "#f5f5f5";
              timeHeader.style.color = "#000000";
              timeHeader.style.padding = "10px";
              timeHeader.style.textAlign = "center";
              timeHeader.style.fontWeight = "bold";
              timeHeader.style.border = "1px solid #000000";
              timeHeader.style.fontSize = "12px";
              timeHeader.textContent = "Time";
              clonedRow.appendChild(timeHeader);
            } else {
              // Data row - combine start and end time with AM/PM format
              const startTimeCell = cells[2];
              const endTimeCell = cells[3];
              const startTimeInput = startTimeCell?.querySelector("input");
              const endTimeInput = endTimeCell?.querySelector("input");
              const startTime = startTimeInput?.value || "";
              const endTime = endTimeInput?.value || "";

              const timeCell = document.createElement("td");
              timeCell.style.padding = "8px";
              timeCell.style.border = "1px solid #000000";
              timeCell.style.backgroundColor = "white";
              timeCell.style.color = "#000000";
              timeCell.style.fontSize = "11px";
              timeCell.style.textAlign = "center";

              if (startTime && endTime) {
                const startTime12 = formatTime12Hour(startTime);
                const endTime12 = formatTime12Hour(endTime);
                timeCell.textContent = `${startTime12} - ${endTime12}`;
              } else {
                timeCell.textContent = "N/A";
              }

              clonedRow.appendChild(timeCell);
            }
          }
          // Skip Start Time (index 2) and End Time (index 3) columns as they're combined
          else if (i === 2 || i === 3) {
            continue;
          }
          // Add Duration column (index 4)
          else if (i === 4) {
            if (rowIndex !== 0) {
              // Data rows - get duration from original data
              const entryIndex = rowIndex - 1; // Adjust for header row
              const originalEntry = examForm.timetableEntries[entryIndex];
              const durationValue = originalEntry?.duration;
              const formattedDuration = formatDuration(durationValue);
              clonedCell.textContent = formattedDuration;
            }
            clonedRow.appendChild(clonedCell);
          }
        }

        clonedTable.appendChild(clonedRow);
      });

      // Add footer with hall ticket styling
      const footer = document.createElement("div");
      footer.style.textAlign = "center";
      footer.style.marginTop = "auto"; // Push to bottom
      footer.style.paddingTop = "20px";
      footer.style.color = "#9ca3af"; // Gray-400
      footer.style.fontSize = "10px";

      const footerText1 = document.createElement("p");
      footerText1.style.margin = "0 0 4px 0";
      footerText1.textContent =
        "This timetable is computer-generated | DKJU - Exam Dept.";

      const footerText2 = document.createElement("p");
      footerText2.style.margin = "0";
      footerText2.textContent = `Generated: ${new Date().toLocaleString()}`;

      footer.appendChild(footerText1);
      footer.appendChild(footerText2);

      // Assemble the document
      wrapper.appendChild(header);
      wrapper.appendChild(examTitle);
      wrapper.appendChild(detailsContainer);
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

        try {
          // Upload to Firebase Storage under exams/timetable
          const timestamp = Date.now();
          const filename = `${timestamp}-${
            examForm.title || "exam"
          }-timetable.png`;
          const storageRef = ref(storage, `exams/timetable/${filename}`);

          const pngMetadata = { contentDisposition: "attachment" };
          const snapshot = await uploadBytes(storageRef, blob, pngMetadata);
          const downloadURL = await getDownloadURL(snapshot.ref);

          setExamForm((prev) => ({
            ...prev,
            generatedTimetableImage: downloadURL,
            generatedTimetableFilePath: snapshot.ref.fullPath,
          }));

          toast.success("Timetable created successfully");
        } catch (error) {
          console.error("Error uploading timetable:", error);
          toast.error("Failed to save timetable");
        }
      }, "image/png");
    } catch (error) {
      console.error("Error generating timetable:", error);
      toast.error("Failed to create timetable");
    } finally {
      setUploading(false);
    }
  };

  // Download timetable image
  const handleDownloadTimetable = async (timetableUrl, examTitle) => {
    try {
      await downloadFile(timetableUrl, `${examTitle || "exam"}-timetable`);
      toast.success("Timetable download started");
    } catch (error) {
      console.error("Error downloading timetable:", error);
      toast.error("Failed to download timetable");
    }
  };

  // Handle exam creation/update
  const handleExamSubmit = async (e) => {
    e.preventDefault();

    try {
      let examId;

      if (editingItem) {
        // UPDATE: Only update changed fields, preserve original createdAt
        const updateData = {
          ...examForm,
          fees: parseFloat(examForm.fees),
          totalMarks: examForm.totalMarks
            ? parseFloat(examForm.totalMarks)
            : null,
          overallPassMark: examForm.overallPassMark
            ? parseFloat(examForm.overallPassMark)
            : null,
          firstFirstClassMark: examForm.firstFirstClassMark
            ? parseFloat(examForm.firstFirstClassMark)
            : null,
          updatedAt: new Date(),
          updatedBy: userData?.id || user?.uid,
          updatedByName: userData?.name || user?.displayName || "Admin",
          // DO NOT update createdAt or createdBy - preserve original values
        };

        await updateDocument(COLLECTIONS.EXAMS, editingItem.id, updateData);
        examId = editingItem.id;
        toast.success("Exam updated successfully");

        // Control flag for update method
        const USE_HTTP_HALL_TICKET_UPDATE = true;

        if (USE_HTTP_HALL_TICKET_UPDATE) {
          // Trigger background update of hall tickets (Client Side Batch - bypassing auth issues)
          try {
            const loadingToast = toast.loading(
              "Updating hall tickets across database...",
            );
            const examId = editingItem.id;
            const studentsRef = collection(
              db,
              "hallTickets",
              examId,
              "students",
            );
            const snapshot = await getDocs(studentsRef);

            if (!snapshot.empty) {
              const batchSize = 500;
              let operationCount = 0;
              let currentBatch = writeBatch(db);
              const batches = [];

              const updatePayload = {};

              // Explicit fields
              if (examForm.title) updatePayload.examTitle = examForm.title;
              if (examForm.examDate) updatePayload.examDate = examForm.examDate;
              if (examForm.timetableEntries)
                updatePayload.timetableEntries = examForm.timetableEntries;

              // Map specific fields to Hall Ticket schema
              if (examForm.fees !== undefined)
                updatePayload.examFees = parseFloat(examForm.fees) || 0;
              if (examForm.subject) updatePayload.subject = examForm.subject;
              if (examForm.duration) updatePayload.duration = examForm.duration;
              if (examForm.totalMarks)
                updatePayload.totalMarks = examForm.totalMarks;

              // Do NOT include class

              snapshot.docs.forEach((studentDoc) => {
                const docRef = doc(
                  db,
                  "hallTickets",
                  examId,
                  "students",
                  studentDoc.id,
                );
                currentBatch.update(docRef, updatePayload);
                operationCount++;

                if (operationCount >= batchSize) {
                  batches.push(currentBatch.commit());
                  currentBatch = writeBatch(db);
                  operationCount = 0;
                }
              });

              if (operationCount > 0) {
                batches.push(currentBatch.commit());
              }

              await Promise.all(batches);
              toast.dismiss(loadingToast);
              toast.success(
                `Updated ${snapshot.size} hall tickets successfully`,
              );
            } else {
              toast.dismiss(loadingToast);
            }
          } catch (apiError) {
            console.error("Failed to update hall tickets:", apiError);
            toast.error(
              "Updated exam but failed to sync hall tickets. Permissions issue?",
            );
          }
        }
      } else {
        // CREATE: Set all fields including createdAt
        const examData = {
          ...examForm,
          fees: parseFloat(examForm.fees),
          totalMarks: examForm.totalMarks
            ? parseFloat(examForm.totalMarks)
            : null,
          overallPassMark: examForm.overallPassMark
            ? parseFloat(examForm.overallPassMark)
            : null,
          firstFirstClassMark: examForm.firstFirstClassMark
            ? parseFloat(examForm.firstFirstClassMark)
            : null,
          createdBy: userData?.id || user?.uid,
          createdByName: userData?.name || user?.displayName || "Admin",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        examId = await createDocument(COLLECTIONS.EXAMS, examData);
        toast.success("Exam created successfully");
      }

      // Create exam notice if notice field is provided
      if (examForm.notice && examForm.notice.trim()) {
        try {
          const noticeData = {
            examId: examId,
            title: `${examForm.title} - Notice`,
            content: examForm.notice,
            type: "exam",
            priority: "high",
            isActive: true,
            createdBy: userData?.id || user?.uid,
            createdByName: userData?.name || user?.displayName || "Admin",
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await createDocument(COLLECTIONS.EXAM_NOTICES, noticeData);
          toast.success("Exam notice created successfully");
        } catch (noticeError) {
          console.error("Error creating exam notice:", noticeError);
          toast.error("Exam created but failed to create notice");
        }
      }

      // Reset form and close dialog
      setExamForm({
        title: "",
        description: "",
        subject: "",
        class: "",
        duration: "",
        totalMarks: "",
        examDate: "",
        registrationDeadline: "",
        fees: "",
        examType: "PUBLIC",
        notice: "",
        rulesAndRegulations: "",
        isActive: true,
        timetableTitle: "",
        timetableDescription: "",
        uploadedTimetableImage: "",
        uploadedTimetableFileType: "",
        uploadedTimetableFilePath: "",
        generatedTimetableImage: "",
        generatedTimetableFilePath: "",
        timetableEntries: [
          {
            subject: "",
            date: "",
            startTime: "",
            endTime: "",
            duration: "",
            passMark: "",
          },
        ],
        overallPassMark: "",
        firstFirstClassMark: "",
      });
      setTimetableMode("both");
      setIsCreateExamOpen(false);
      setEditingItem(null);

      // Refresh data
      await fetchExams();
    } catch (error) {
      console.error("Error saving exam:", error);
      toast.error("Failed to save exam");
    }
  };

  // Helper function to safely convert Firestore timestamp to date string
  const convertFirestoreTimestampToDateString = (timestamp) => {
    if (!timestamp) return "";

    try {
      let date;

      // Handle Firestore Timestamp object
      if (timestamp && typeof timestamp.toDate === "function") {
        date = timestamp.toDate();
      }
      // Handle timestamp with seconds property
      else if (timestamp && timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      }
      // Handle regular Date or date string
      else {
        date = new Date(timestamp);
      }

      if (isNaN(date.getTime())) {
        return "";
      }

      // Return datetime-local format (YYYY-MM-DDTHH:MM) for exam dates
      return date.toISOString().slice(0, 16);
    } catch (error) {
      console.error("Error converting timestamp to date string:", error);
      return "";
    }
  };

  // Handle exam edit
  const handleEditExam = (exam) => {
    const hasTimetableEntries =
      exam.timetableEntries && exam.timetableEntries.length > 0;
    const hasUploadedTimetable = exam.uploadedTimetableImage;
    const hasGeneratedTimetable = exam.generatedTimetableImage;

    // Determine timetable mode based on existing data
    if (
      hasTimetableEntries &&
      (hasUploadedTimetable || hasGeneratedTimetable)
    ) {
      setTimetableMode("both");
    } else if (hasTimetableEntries) {
      setTimetableMode("table");
    } else if (hasUploadedTimetable || hasGeneratedTimetable) {
      setTimetableMode("upload");
    } else {
      setTimetableMode("both");
    }

    setExamForm({
      title: exam.title || "",
      description: exam.description || "",
      subject: exam.subject || "",
      class: exam.class || "",
      duration: exam.duration || "",
      totalMarks: exam.totalMarks?.toString() || "",
      overallPassMark: exam.overallPassMark?.toString() || "",
      firstFirstClassMark: exam.firstFirstClassMark?.toString() || "",
      examDate: convertFirestoreTimestampToDateString(exam.examDate),
      registrationDeadline: exam.registrationDeadline || "",
      fees: exam.fees?.toString() || "",
      examType: exam.examType || "PUBLIC",
      notice: exam.notice || "",
      rulesAndRegulations: exam.rulesAndRegulations || "",
      isActive: exam.isActive !== undefined ? exam.isActive : true,
      timetableTitle: exam.timetableTitle || "",
      timetableDescription: exam.timetableDescription || "",
      uploadedTimetableImage:
        exam.uploadedTimetableImage ||
        (exam.timetableImage && typeof exam.timetableImage === "string"
          ? exam.timetableImage
          : exam.timetableImage?.secure_url || exam.timetableImage?.url) ||
        "",
      uploadedTimetableFileType:
        exam.uploadedTimetableFileType || exam.timetableFileType || "",
      uploadedTimetableFilePath:
        exam.uploadedTimetableFilePath || exam.timetableFilePath || "",
      generatedTimetableImage: exam.generatedTimetableImage || "",
      generatedTimetableFilePath: exam.generatedTimetableFilePath || "",
      timetableEntries: exam.timetableEntries || [
        {
          subject: "",
          date: "",
          startTime: "",
          endTime: "",
          duration: "",
          passMark: "",
        },
      ],
    });
    setEditingItem(exam);
    setIsCreateExamOpen(true);
  };

  // Handle exam delete
  const handleDeleteExam = async (examId) => {
    setExamToDelete(examId);
    setDeleteConfirmOpen(true);
  };

  // Confirm and execute exam deletion
  const confirmDeleteExam = async () => {
    if (!examToDelete) return;

    try {
      const loadingToast = toast.loading(
        "Deleting exam and all associated data...",
      );

      // 1. Get all registrations for this exam
      const registrationsQuery = query(
        collection(db, COLLECTIONS.EXAM_REGISTRATIONS),
        where("examId", "==", examToDelete),
      );
      const registrationSnap = await getDocs(registrationsQuery);

      // 2. Get all hall tickets for this exam - hallTickets/{examId}/students
      const studentsRef = collection(
        db,
        "hallTickets",
        examToDelete,
        "students",
      );
      const hallTicketSnap = await getDocs(studentsRef);

      // 3. Get all notices for this exam
      const noticesQuery = query(
        collection(db, COLLECTIONS.EXAM_NOTICES),
        where("examId", "==", examToDelete),
      );
      const noticeSnap = await getDocs(noticesQuery);

      // 4. Get all marks for this exam
      const marksQuery = query(
        collection(db, COLLECTIONS.EXAM_MARKS),
        where("examId", "==", examToDelete),
      );
      const marksSnap = await getDocs(marksQuery);

      // 5. Get all published results for this exam
      const publishedResultsQuery = query(
        collection(db, COLLECTIONS.PUBLISHED_RESULTS),
        where("examId", "==", examToDelete),
      );
      const publishedResultsSnap = await getDocs(publishedResultsQuery);

      // 6. Get all results for this exam
      const resultsQuery = query(
        collection(db, COLLECTIONS.EXAM_RESULTS),
        where("examId", "==", examToDelete),
      );
      const resultsSnap = await getDocs(resultsQuery);

      // Collect all references to delete
      const refsToDelete = [
        doc(db, COLLECTIONS.EXAMS, examToDelete),
        doc(db, "hallTickets", examToDelete),
      ];

      registrationSnap.forEach((doc) => refsToDelete.push(doc.ref));
      hallTicketSnap.forEach((doc) => refsToDelete.push(doc.ref));
      noticeSnap.forEach((doc) => refsToDelete.push(doc.ref));
      marksSnap.forEach((doc) => refsToDelete.push(doc.ref));
      publishedResultsSnap.forEach((doc) => refsToDelete.push(doc.ref));
      resultsSnap.forEach((doc) => refsToDelete.push(doc.ref));

      // Execute deletions in batches of 500 (Firestore limit)
      for (let i = 0; i < refsToDelete.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = refsToDelete.slice(i, i + 500);
        chunk.forEach((ref) => batch.delete(ref));
        await batch.commit();
      }

      toast.dismiss(loadingToast);
      toast.success("Exam and all associated data deleted successfully");
      await fetchExams();
    } catch (error) {
      console.error("Error deleting exam and related data:", error);
      toast.error("Failed to delete exam and associated data");
    } finally {
      setDeleteConfirmOpen(false);
      setExamToDelete(null);
    }
  };

  // Generate attendance sheet PDF for an exam
  const handleGenerateAttendanceSheet = async (exam) => {
    try {
      toast.loading("Fetching data...");

      // 1. Get all registrations for this exam (Source of Truth for "Registered Students")
      const registeredStudents = examRegistrations.filter(
        (reg) => reg.examId === exam.id,
      );

      if (registeredStudents.length === 0) {
        toast.dismiss();
        toast.error("No registered students found for this exam");
        return;
      }

      console.log(
        `Found ${registeredStudents.length} registrations for exam ${exam.id}`,
      );

      // 2. Fetch existing hall tickets to get Roll Numbers
      const studentsRef = collection(db, "hallTickets", exam.id, "students");
      const hallTicketsSnapshot = await getDocs(studentsRef);
      const hallTicketMap = new Map();

      hallTicketsSnapshot.forEach((doc) => {
        const data = doc.data();
        // Map by studentId if available, otherwise doc.id (which might be studentId depending on creation logic)
        const sId = data.studentId || doc.id;
        hallTicketMap.set(sId, { ...data, id: doc.id });
      });

      console.log(`Found ${hallTicketMap.size} generated hall tickets`);

      // 3. Fetch all student profiles for complete data (including MID)
      const studentIdsToFetch = [
        ...new Set(registeredStudents.map((reg) => reg.studentId)),
      ];

      const studentProfileMap = new Map();

      // Batch fetch missing student profiles (chunk by 30)
      if (studentIdsToFetch.length > 0) {
        console.log(
          `Fetching profiles for ${studentIdsToFetch.length} students without hall tickets...`,
        );
        const uniqueIds = [...new Set(studentIdsToFetch)];
        const batchSize = 30;

        for (let i = 0; i < uniqueIds.length; i += batchSize) {
          const batch = uniqueIds.slice(
            i,
            Math.min(i + batchSize, uniqueIds.length),
          );
          const constraints = [where("uid", "in", batch)];
          const students = await getDocuments(
            COLLECTIONS.STUDENTS,
            constraints,
          );
          students.forEach((student) => {
            studentProfileMap.set(student.uid, student);
          });
        }
      }

      // 4. Merge Data
      const enriched = registeredStudents.map((reg) => {
        const hallTicket = hallTicketMap.get(reg.studentId);
        const studentProfile = studentProfileMap.get(reg.studentId);

        const rawMid =
          studentProfile?.madarsaId ??
          reg?.madarsaId ??
          hallTicket?.midNumber ??
          studentProfile?.midNumber ??
          reg?.midNumber ??
          studentProfile?.mid ??
          reg?.mid;
        const madarsaId =
          rawMid && String(rawMid).trim() && String(rawMid) !== "N/A"
            ? String(rawMid)
            : null;

        if (hallTicket) {
          // Priority 1: Use Hall Ticket Data (Snapshot) + Student Profile for missing fields
          return {
            ...studentProfile,
            ...hallTicket,
            id: hallTicket.id,
            studentId: reg.studentId,
            // Ensure consistent names
            fullName:
              hallTicket.studentName ||
              hallTicket.name ||
              hallTicket.fullName ||
              studentProfile?.fullName,
            madarsa:
              hallTicket.madarsaName ||
              hallTicket.madarsa ||
              hallTicket.centerName ||
              studentProfile?.madarsa,
            classLevel:
              hallTicket.classLevel ||
              hallTicket.class ||
              studentProfile?.classLevel,
            examId: exam.id,
            rollNumber: hallTicket.rollNumber || hallTicket.rollNo || "N/A",
            midNumber:
              hallTicket.midNumber || studentProfile?.midNumber || "N/A",
            madarsaId,
          };
        } else {
          // Priority 2: Use Student Profile + Registration Data
          return {
            ...reg,
            // Merge student profile if available
            ...studentProfile,
            id: reg.id, // Registration ID
            studentId: reg.studentId,
            fullName:
              studentProfile?.fullName || reg.studentName || "Unknown Name",
            madarsa:
              reg.madarsa ||
              studentProfile?.madarsa ||
              studentProfile?.madarsaName ||
              "N/A",
            classLevel:
              studentProfile?.classLevel ||
              studentProfile?.class ||
              reg.classLevel ||
              "N/A",
            examId: exam.id,
            rollNumber: "Pending", // No roll number yet
            madarsaId,
          };
        }
      });

      console.log("Final Enriched List for Attendance:", enriched);
      setEnrichedRegistrations(enriched);

      toast.dismiss();

      // Open dialog for filters selection
      setSelectedExamForAttendance(exam);
      setSelectedLanguage("ml");
      setSelectedDistrict("all");
      setSelectedMekhala("all");
      setSelectedMahal("all");
      setSelectedMahalId("all");
      setSelectedClasses(["all"]);
      setMadarsaSearch("");
      setAttendanceDialogOpen(true);
    } catch (error) {
      console.error("Error generating Attendance sheet:", error);
      toast.dismiss();
      toast.error("Failed to generate Attendance sheet");
    }
  };

  // Get unique mahals from exam registrations
  const getUniqueMahals = () => {
    if (!selectedExamForAttendance) return [];
    const mahals = [
      ...new Set(
        enrichedRegistrations.map((reg) => reg.madarsa).filter(Boolean),
      ),
    ];
    return mahals.sort();
  };

  // Get filtered mekhalas based on district
  const getFilteredMekhalas = () => {
    if (selectedDistrict === "all") return [];

    const district = canonicalDistrictName(selectedDistrict);
    const configured = getMekhalaListForDistrict(district);

    if (configured.length > 0) {
      return [...configured]
        .sort((a, b) =>
          String(a).localeCompare(String(b), undefined, {
            sensitivity: "base",
          }),
        )
        .map((name) => ({ id: name, name }));
    }

    // Fallback: derive from stored madarsas if district isn't configured
    const set = new Set();
    madarsas.forEach((m) => {
      if (!madrasaMatchesDistrict(m, district)) return;
      if (m?.mekhala) set.add(String(m.mekhala));
    });

    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ id: name, name }));
  };

  // District dropdown options: keep the full existing list, but also ensure
  // configured districts only (hide any extra Firestore districts).
  const getDistrictOptions = () => {
    return [...DISTRICT_ORDER];
  };

  // Get filtered madarsas based on mekhala or district
  const getFilteredMadarsas = () => {
    // Strict hierarchy: no madrasa list until a mekhala is selected
    if (selectedDistrict === "all") return [];
    if (selectedMekhala === "all") return [];

    const list = madarsas.filter(
      (m) =>
        madrasaMatchesDistrict(m, selectedDistrict) &&
        madrasaMatchesMekhala(m, selectedMekhala),
    );

    return sortMadarsasByIdThenName(list);
  };

  // Get unique classes from exam registrations (filtered by selection)
  const getUniqueClasses = () => {
    if (!selectedExamForAttendance || enrichedRegistrations.length === 0)
      return [];
    let registrations = enrichedRegistrations;

    console.log("selectedMahalId", selectedMahalId);
    if (selectedMahalId !== "all") {
      registrations = registrations.filter(
        (reg) => String(reg.madarsaId) === String(selectedMahalId),
      );
    } else if (selectedMekhala !== "all") {
      const madarsasInMekhalaIds = getFilteredMadarsas().map((m) =>
        String(m.madarsaId),
      );
      registrations = registrations.filter(
        (reg) =>
          reg.madarsaId && madarsasInMekhalaIds.includes(String(reg.madarsaId)),
      );
    } else if (selectedDistrict !== "all") {
      const madarsasInDistrictIds = madarsas
        .filter((m) => madrasaMatchesDistrict(m, selectedDistrict))
        .map((m) => String(m.madarsaId));
      registrations = registrations.filter(
        (reg) =>
          reg.madarsaId &&
          madarsasInDistrictIds.includes(String(reg.madarsaId)),
      );
    }

    const classes = [
      ...new Set(registrations.map((reg) => reg.classLevel).filter(Boolean)),
    ];

    return classes.sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  };

  // Handle class selection (multi-select)
  const handleClassSelection = (classValue) => {
    const currentClasses = selectedClasses;
    const allClasses = getUniqueClasses();

    if (classValue === "all") {
      // When "All" is clicked
      if (currentClasses.includes("all")) {
        // If already selected, uncheck all
        setSelectedClasses([]);
      } else {
        // If not selected, select all
        setSelectedClasses(["all", ...allClasses]);
      }
    } else {
      // Individual class clicked
      let newClasses = currentClasses.filter((c) => c !== "all");

      if (newClasses.includes(classValue)) {
        // Uncheck this class
        newClasses = newClasses.filter((c) => c !== classValue);
      } else {
        // Check this class
        newClasses = [...newClasses, classValue];
      }

      // If all individual classes are selected, switch to "all"
      if (
        newClasses.length === allClasses.length &&
        allClasses.every((c) => newClasses.includes(c))
      ) {
        setSelectedClasses(["all", ...newClasses]);
      } else if (newClasses.length === 0) {
        // If nothing is selected, set to empty array (user must select at least the "all" checkbox)
        setSelectedClasses([]);
      } else {
        setSelectedClasses(newClasses);
      }
    }
  };

  // Generate PDF with selected filters
  const handleConfirmGenerateAttendance = async () => {
    try {
      if (!selectedExamForAttendance) return;

      // Use enriched registrations
      let filteredStudents = enrichedRegistrations;

      console.log(filteredStudents);

      // Apply location filters
      if (selectedMahalId !== "all") {
        filteredStudents = filteredStudents.filter(
          (reg) => String(reg.madarsaId) === String(selectedMahalId),
        );
      } else if (selectedMekhala !== "all") {
        const madarsasInMekhalaIds = getFilteredMadarsas().map((m) =>
          String(m.madarsaId),
        );
        filteredStudents = filteredStudents.filter(
          (reg) =>
            reg.madarsaId &&
            madarsasInMekhalaIds.includes(String(reg.madarsaId)),
        );
      } else if (selectedDistrict !== "all") {
        const madarsasInDistrictIds = madarsas
          .filter((m) => madrasaMatchesDistrict(m, selectedDistrict))
          .map((m) => String(m.madarsaId));
        filteredStudents = filteredStudents.filter(
          (reg) =>
            reg.madarsaId &&
            madarsasInDistrictIds.includes(String(reg.madarsaId)),
        );
      }

      // Filter by classes if not "all"
      if (!selectedClasses.includes("all")) {
        filteredStudents = filteredStudents.filter((reg) =>
          selectedClasses.includes(reg.classLevel),
        );
      }

      if (filteredStudents.length === 0) {
        toast.error("No students found with the selected filters");
        return;
      }

      // Retrieve Madarsa Name for PDF if a specific madarsa is selected
      const selectedMadarsaName =
        selectedMahalId !== "all" ? selectedMahal : "all";
      const madarsaData =
        selectedMahalId !== "all"
          ? madarsas.find(
              (m) => String(m.madarsaId) === String(selectedMahalId),
            )
          : null;

      console.log("Final Filtered", filteredStudents);
      const doc = await generateAttendanceSheet(
        selectedExamForAttendance,
        filteredStudents,
        selectedClasses.includes("all") ? null : selectedClasses.join(","),
        selectedMahalId === "all" ? null : selectedMadarsaName,
        null,
        selectedLanguage,
        madarsaData,
      );

      // Download PDF
      const locationText =
        selectedMahalId !== "all"
          ? (selectedMadarsaName || "").replace(/\s+/g, "-")
          : selectedMekhala !== "all"
            ? getMekhalaName(selectedMekhala).replace(/\s+/g, "-")
            : selectedDistrict !== "all"
              ? getDistrictName(selectedDistrict).replace(/\s+/g, "-")
              : "All";
      const classText = selectedClasses.includes("all")
        ? "All-Classes"
        : `Class-${selectedClasses.join("-")}`;
      const langText = selectedLanguage === "ml" ? "Malayalam" : "English";
      doc.save(
        `${
          selectedExamForAttendance.title || "exam"
        }-${locationText}-${classText}-${langText}-HazarSheet.pdf`,
      );

      toast.success("Attendance Sheet generated successfully");
      setAttendanceDialogOpen(false);
    } catch (error) {
      console.error("Error generating Attendance sheet:", error);
      toast.error("Failed to generate Attendance sheet");
    }
  };

  // Get unique classes from result enriched registrations
  const getUniqueResultClasses = () => {
    if (resultEnrichedRegistrations.length === 0) return [];

    let registrations = resultEnrichedRegistrations;

    // Apply madarsa filter if selected
    if (selectedResultMahalId !== "all") {
      registrations = registrations.filter(
        (reg) => String(reg.madarsaId) === String(selectedResultMahalId),
      );
    }

    const classes = [
      ...new Set(registrations.map((reg) => reg.classLevel).filter(Boolean)),
    ];

    return classes.sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  };

  // Handle result sheet class selection (multi-select)
  const handleResultClassSelection = (classValue) => {
    const currentClasses = selectedResultClasses;
    const allClasses = getUniqueResultClasses();

    if (classValue === "all") {
      // When "All" is clicked
      if (currentClasses.includes("all")) {
        // If already selected, uncheck all
        setSelectedResultClasses([]);
      } else {
        // If not selected, select all
        setSelectedResultClasses(["all", ...allClasses]);
      }
    } else {
      // Individual class clicked
      let newClasses = currentClasses.filter((c) => c !== "all");

      if (newClasses.includes(classValue)) {
        // Uncheck this class
        newClasses = newClasses.filter((c) => c !== classValue);
      } else {
        // Check this class
        newClasses = [...newClasses, classValue];
      }

      // If all individual classes are selected, switch to "all"
      if (
        newClasses.length === allClasses.length &&
        allClasses.every((c) => newClasses.includes(c))
      ) {
        setSelectedResultClasses(["all", ...newClasses]);
      } else if (newClasses.length === 0) {
        // If nothing is selected, set to empty array
        setSelectedResultClasses([]);
      } else {
        setSelectedResultClasses(newClasses);
      }
    }
  };

  // Generate result sheet PDF for an exam
  const handleGenerateResultSheet = async (exam) => {
    try {
      // Fetch registered students for this exam
      const registeredStudents = examRegistrations.filter(
        (reg) => reg.examId === exam.id,
      );

      if (registeredStudents.length === 0) {
        toast.error("No registered students found for this exam");
        return;
      }

      // Fetch student details to get class information
      toast.loading("Loading student data...");
      const studentIds = [
        ...new Set(registeredStudents.map((reg) => reg.studentId)),
      ];

      // Fetch only the students we need using Firestore 'in' query (batch by 30 for Firestore limit)
      const studentMap = {};
      const batchSize = 30;

      for (let i = 0; i < studentIds.length; i += batchSize) {
        const batch = studentIds.slice(
          i,
          Math.min(i + batchSize, studentIds.length),
        );
        const constraints = [where("uid", "in", batch)];
        const students = await getDocuments(COLLECTIONS.STUDENTS, constraints);
        students.forEach((student) => {
          studentMap[student.uid] = student;
        });
      }

      console.log("Student Map:", studentMap);

      toast.dismiss();
      // Enrich registrations with full student data
      const enriched = registeredStudents.map((reg) => {
        const student = studentMap[reg.studentId];
        return {
          ...reg,
          // Merge all student properties
          ...student,
          // Keep original registration data with priority
          studentId: reg.studentId,
          examId: reg.examId,
          madarsa: reg.madarsa || student?.madarsa,
          classLevel: student?.classLevel || null,
          fullName: student?.fullName || reg.studentName,
        };
      });

      console.log("Enriched Registrations:", enriched);

      setResultEnrichedRegistrations(enriched);

      // Get all available classes from enriched data
      const allClasses = [
        ...new Set(enriched.map((reg) => reg.classLevel).filter(Boolean)),
      ].sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      });

      // Open dialog for filters selection
      setSelectedExamForResult(exam);
      setSelectedResultLanguage("ml");
      setSelectedResultMahal("all");
      setSelectedResultMahalId("all");
      setSelectedResultClasses(["all", ...allClasses]); // Default to all classes selected
      setResultMadarsaSearch("");
      setResultSheetDialogOpen(true);
    } catch (error) {
      console.error("Error generating result sheet:", error);
      toast.dismiss();
      toast.error("Failed to generate result sheet");
    }
  };

  // Handle result sheet confirmation
  const handleConfirmGenerateResult = async () => {
    try {
      if (!selectedExamForResult) return;

      // Filter students based on selected mahal and classes
      let filteredStudents = resultEnrichedRegistrations;

      if (selectedResultMahalId !== "all") {
        filteredStudents = filteredStudents.filter(
          (s) => String(s.madarsaId) === String(selectedResultMahalId),
        );
      }

      if (
        selectedResultClasses.length > 0 &&
        !selectedResultClasses.includes("all")
      ) {
        filteredStudents = filteredStudents.filter((s) =>
          selectedResultClasses.includes(s.classLevel),
        );
      }

      if (filteredStudents.length === 0) {
        toast.error("No students found with the selected filters");
        return;
      }

      // Generate PDF
      const mahalId =
        selectedResultMahalId === "all" ? null : selectedResultMahalId;
      const madarsaData = mahalId
        ? madarsas.find((m) => String(m.madarsaId) === String(mahalId))
        : null;

      const doc = await generateResultSheet(
        selectedExamForResult,
        filteredStudents,
        selectedResultClasses.includes("all") ||
          selectedResultClasses.length === 0
          ? null
          : selectedResultClasses,
        selectedResultMahalId === "all" ? null : selectedResultMahal,
        selectedResultLanguage,
        madarsaData,
      );

      // Download PDF
      const langText =
        selectedResultLanguage === "ml" ? "Malayalam" : "English";
      const mahalText =
        selectedResultMahalId !== "all"
          ? selectedResultMahal.replace(/\s+/g, "-")
          : "All";
      doc.save(
        `${
          selectedExamForResult.title || "exam"
        }-${mahalText}-${langText}-ResultSheet.pdf`,
      );

      toast.success("Result Sheet generated successfully");
      setResultSheetDialogOpen(false);
    } catch (error) {
      console.error("Error generating result sheet:", error);
      toast.error("Failed to generate result sheet");
    }
  };

  // Helper functions to get names
  const getDistrictName = (name) => {
    return name === "all" ? "All Districts" : name;
  };

  const getMekhalaName = (id) => {
    const mekhala = mekhalas.find((m) => m.id === id);
    return mekhala?.name || id;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading exams...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Create & Manage Exams
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Create new exams and manage existing ones
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription className="text-green-700">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-lg sm:text-xl font-semibold">
              Exam Management
            </h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              {/* View Toggle */}
              <div className="flex items-center gap-0 bg-gray-100 rounded-lg p-1 border border-gray-200">
                <Button
                  type="button"
                  variant={viewMode === "card" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("card")}
                  className="h-9 flex-1 sm:flex-none sm:px-4"
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  <span className="text-sm">Card</span>
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "compact" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("compact")}
                  className="h-9 flex-1 sm:flex-none sm:px-4"
                >
                  <Users className="h-4 w-4 mr-1.5" />
                  <span className="text-sm">Compact</span>
                </Button>
              </div>
              <Dialog
                open={isCreateExamOpen}
                onOpenChange={setIsCreateExamOpen}
              >
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto h-9">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Exam
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-6xl bg-white overflow-y-auto max-h-[95vh] w-[98vw] sm:w-[95vw] p-3 sm:p-6">
                  <DialogHeader className="space-y-1 sm:space-y-3 pb-3 sm:pb-0">
                    <DialogTitle className="text-base sm:text-xl pr-8 sm:pr-6">
                      {editingItem ? "Edit Exam" : "Create New Exam"}
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-base">
                      Create a comprehensive exam with all details
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={handleExamSubmit}
                    className="space-y-3 sm:space-y-6 mt-2 sm:mt-6"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label htmlFor="title" className="text-sm">
                          Exam Title *
                        </Label>
                        <Input
                          id="title"
                          value={examForm.title}
                          onChange={(e) =>
                            setExamForm((prev) => ({
                              ...prev,
                              title: e.target.value,
                            }))
                          }
                          placeholder="e.g., Annual Examination 2025"
                          required
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="fees" className="text-sm">
                          Exam Fees (₹) *
                        </Label>
                        <Input
                          id="fees"
                          type="number"
                          value={examForm.fees}
                          onChange={(e) =>
                            setExamForm((prev) => ({
                              ...prev,
                              fees: e.target.value,
                            }))
                          }
                          placeholder="500"
                          required
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label htmlFor="examType" className="text-sm">Exam Type *</Label>
                        <Select
                          value={examForm.examType || "PUBLIC"}
                          onValueChange={(v) => setExamForm((prev) => ({ ...prev, examType: v }))}
                        >
                          <SelectTrigger id="examType" className="h-9 sm:h-10 text-sm">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="PUBLIC">PUBLIC – Visible to students</SelectItem>
                            <SelectItem value="REVALUATION">REVALUATION</SelectItem>
                            <SelectItem value="SAY">SAY (Save A Year)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label htmlFor="subject" className="text-sm">
                          Subject *
                        </Label>
                        <Input
                          id="subject"
                          value={examForm.subject}
                          onChange={(e) =>
                            setExamForm((prev) => ({
                              ...prev,
                              subject: e.target.value,
                            }))
                          }
                          placeholder="e.g., Mathematics, Islamic Studies"
                          required
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="class" className="text-sm">
                          Class *
                        </Label>
                        <Input
                          id="class"
                          value={examForm.class}
                          onChange={(e) =>
                            setExamForm((prev) => ({
                              ...prev,
                              class: e.target.value,
                            }))
                          }
                          placeholder="e.g., Class 10, Alim 1st Year"
                          required
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label htmlFor="duration" className="text-sm">
                          Duration (Optional)
                        </Label>
                        <Input
                          id="duration"
                          value={examForm.duration}
                          onChange={(e) =>
                            setExamForm((prev) => ({
                              ...prev,
                              duration: e.target.value,
                            }))
                          }
                          placeholder="e.g., 3 hours, 180 minutes"
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      <div>
                        <Label htmlFor="totalMarks" className="text-sm">
                          Total Marks *
                        </Label>
                        <Input
                          id="totalMarks"
                          type="number"
                          value={examForm.totalMarks}
                          onChange={(e) =>
                            setExamForm((prev) => ({
                              ...prev,
                              totalMarks: e.target.value,
                            }))
                          }
                          placeholder="e.g., 100"
                          required
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="overallPassMark" className="text-sm">
                          Overall Pass Mark *
                        </Label>
                        <Input
                          id="overallPassMark"
                          type="number"
                          value={examForm.overallPassMark}
                          onChange={(e) =>
                            setExamForm((prev) => ({
                              ...prev,
                              overallPassMark: e.target.value,
                            }))
                          }
                          placeholder="e.g., 40"
                          required
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="firstFirstClassMark"
                          className="text-sm"
                        >
                          First Class Mark *
                        </Label>
                        <Input
                          id="firstFirstClassMark"
                          type="number"
                          value={examForm.firstFirstClassMark}
                          onChange={(e) =>
                            setExamForm((prev) => ({
                              ...prev,
                              firstFirstClassMark: e.target.value,
                            }))
                          }
                          placeholder="e.g., 75"
                          required
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description" className="text-sm">
                        Description
                      </Label>
                      <Textarea
                        id="description"
                        value={examForm.description}
                        onChange={(e) =>
                          setExamForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Describe the exam details..."
                        rows={3}
                        className="resize-none text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label htmlFor="examDate" className="text-sm">
                          Exam Date & Time *
                        </Label>
                        <Input
                          id="examDate"
                          type="datetime-local"
                          min={new Date().toISOString().slice(0, 16)}
                          value={examForm.examDate}
                          onChange={(e) =>
                            setExamForm((prev) => ({
                              ...prev,
                              examDate: e.target.value,
                            }))
                          }
                          required
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="registrationDeadline"
                          className="text-sm"
                        >
                          Registration Deadline *
                        </Label>
                        <Input
                          id="registrationDeadline"
                          type="date"
                          min={new Date().toISOString().split("T")[0]}
                          value={examForm.registrationDeadline}
                          onChange={(e) =>
                            setExamForm((prev) => ({
                              ...prev,
                              registrationDeadline: e.target.value,
                            }))
                          }
                          required
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="notice" className="text-sm">
                        Exam Notice (Auto-creates notice for students)
                      </Label>
                      <Textarea
                        id="notice"
                        value={examForm.notice}
                        onChange={(e) =>
                          setExamForm((prev) => ({
                            ...prev,
                            notice: e.target.value,
                          }))
                        }
                        placeholder="Important notice for students (will be automatically published as exam notice)..."
                        rows={3}
                        className="text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="rulesAndRegulations" className="text-sm">
                        Rules and Regulations
                      </Label>
                      <Textarea
                        id="rulesAndRegulations"
                        value={examForm.rulesAndRegulations}
                        onChange={(e) =>
                          setExamForm((prev) => ({
                            ...prev,
                            rulesAndRegulations: e.target.value,
                          }))
                        }
                        placeholder="Enter the rules and regulations for this exam..."
                        rows={3}
                        className="text-sm"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={examForm.isActive}
                        onChange={(e) =>
                          setExamForm((prev) => ({
                            ...prev,
                            isActive: e.target.checked,
                          }))
                        }
                        className="h-4 w-4"
                      />
                      <Label
                        htmlFor="isActive"
                        className="text-sm cursor-pointer"
                      >
                        Active (Students can register)
                      </Label>
                    </div>

                    {/* Timetable Section */}
                    <div className="border-t pt-3 sm:pt-6 mt-3 sm:mt-6">
                      <div className="flex items-center gap-2 mb-2 sm:mb-4">
                        <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                        <h3 className="text-sm sm:text-lg font-semibold text-gray-900">
                          Optional: Timetable
                        </h3>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                        You can create a timetable by uploading an image or by
                        creating a structured table with Subject/Date entries.
                      </p>

                      <div className="space-y-3 sm:space-y-4">
                        <div>
                          <Label htmlFor="timetableTitle" className="text-sm">
                            Timetable Title
                          </Label>
                          <Input
                            id="timetableTitle"
                            value={examForm.timetableTitle}
                            onChange={(e) =>
                              setExamForm((prev) => ({
                                ...prev,
                                timetableTitle: e.target.value,
                              }))
                            }
                            placeholder={
                              `${examForm.title} - Timetable` ||
                              "Exam Timetable"
                            }
                            className="h-9 sm:h-10 text-sm"
                          />
                        </div>

                        <div>
                          <Label
                            htmlFor="timetableDescription"
                            className="text-sm"
                          >
                            Timetable Description
                          </Label>
                          <Textarea
                            id="timetableDescription"
                            value={examForm.timetableDescription}
                            onChange={(e) =>
                              setExamForm((prev) => ({
                                ...prev,
                                timetableDescription: e.target.value,
                              }))
                            }
                            placeholder="Additional notes about the timetable..."
                            rows={2}
                            className="text-sm"
                          />
                        </div>

                        {/* Timetable Creation Mode Toggle */}
                        <div className="flex flex-col sm:flex-row gap-2 p-2 sm:p-0 bg-gray-50 sm:bg-transparent rounded-md sm:rounded-none">
                          <Button
                            type="button"
                            variant={
                              timetableMode === "upload" ? "default" : "outline"
                            }
                            onClick={() => setTimetableMode("upload")}
                            className="flex-1 h-9 sm:h-8"
                            size="sm"
                          >
                            <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            <span className="text-xs sm:text-sm">
                              Upload Only
                            </span>
                          </Button>
                          <Button
                            type="button"
                            variant={
                              timetableMode === "table" ? "default" : "outline"
                            }
                            onClick={() => setTimetableMode("table")}
                            className="flex-1 h-9 sm:h-8"
                            size="sm"
                          >
                            <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            <span className="text-xs sm:text-sm">
                              Table Only
                            </span>
                          </Button>
                          <Button
                            type="button"
                            variant={
                              timetableMode === "both" ? "default" : "outline"
                            }
                            onClick={() => setTimetableMode("both")}
                            className="flex-1 h-9 sm:h-8"
                            size="sm"
                          >
                            <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            <span className="text-xs sm:text-sm">Both</span>
                          </Button>
                        </div>

                        {(timetableMode === "upload" ||
                          timetableMode === "both") && (
                          <div>
                            <Label htmlFor="timetableImage">
                              Upload Timetable (PNG, JPEG, or PDF)
                            </Label>
                            <div className="mt-2">
                              <input
                                type="file"
                                id="timetableImage"
                                accept="image/png,image/jpeg,image/jpg,application/pdf"
                                onChange={handleTimetableImageUpload}
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                disabled={uploading}
                              />
                              {uploading && (
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                  <span className="text-sm text-blue-600">
                                    Uploading timetable image...
                                  </span>
                                </div>
                              )}
                              {examForm.uploadedTimetableImage && (
                                <div className="mt-3 p-2 sm:p-3 border rounded-md bg-gray-50">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                                      <span className="text-xs sm:text-sm text-green-600 font-medium">
                                        Uploaded timetable{" "}
                                        {examForm.uploadedTimetableFileType ===
                                        "application/pdf"
                                          ? "PDF"
                                          : "image"}{" "}
                                        ready
                                      </span>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setExamForm((prev) => ({
                                          ...prev,
                                          uploadedTimetableImage: "",
                                          uploadedTimetableFileType: "",
                                          uploadedTimetableFilePath: "",
                                        }))
                                      }
                                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      title="Remove uploaded timetable"
                                    >
                                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                  </div>
                                  <div
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() =>
                                      downloadFile(
                                        examForm.uploadedTimetableImage,
                                        `${examForm.title || "exam"}-uploaded-timetable`,
                                      )
                                    }
                                  >
                                    {examForm.uploadedTimetableFileType ===
                                    "application/pdf" ? (
                                      <div className="flex items-center gap-2 p-2 sm:p-3 border rounded-md bg-white">
                                        <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
                                        <span className="text-xs sm:text-sm text-gray-700">
                                          Click to view uploaded PDF
                                        </span>
                                      </div>
                                    ) : (
                                      <Image
                                        src={examForm.uploadedTimetableImage}
                                        alt="Uploaded timetable preview"
                                        width={250}
                                        height={100}
                                        className="max-w-full h-20 sm:h-32 object-contain border rounded-md bg-white"
                                      />
                                    )}
                                  </div>
                                </div>
                              )}

                              {examForm.generatedTimetableImage && (
                                <div className="mt-3 p-2 sm:p-3 border rounded-md bg-blue-50">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                                      <span className="text-xs sm:text-sm text-blue-600 font-medium">
                                        Generated timetable PNG ready
                                      </span>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setExamForm((prev) => ({
                                          ...prev,
                                          generatedTimetableImage: "",
                                          generatedTimetableFilePath: "",
                                        }))
                                      }
                                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      title="Remove generated timetable"
                                    >
                                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                  </div>
                                  <div
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() =>
                                      downloadFile(
                                        examForm.generatedTimetableImage,
                                        `${examForm.title || "exam"}-generated-timetable.png`,
                                      )
                                    }
                                  >
                                    <Image
                                      src={examForm.generatedTimetableImage}
                                      alt="Generated timetable preview"
                                      width={250}
                                      height={100}
                                      className="max-w-full h-20 sm:h-32 object-contain border rounded-md bg-white"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {(timetableMode === "table" ||
                          timetableMode === "both") && (
                          <div>
                            <Label>Timetable Entries</Label>
                            <div className="mt-2 border rounded-md overflow-hidden">
                              <div className="overflow-x-auto">
                                <table
                                  className="w-full min-w-[320px] sm:min-w-[800px]"
                                  id="timetable-table"
                                >
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Subject
                                      </th>
                                      <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date
                                      </th>
                                      <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Start Time
                                      </th>
                                      <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        End Time
                                      </th>
                                      <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Duration
                                      </th>
                                      <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Pass Mark
                                      </th>
                                      <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {examForm.timetableEntries.map(
                                      (entry, index) => (
                                        <tr key={index}>
                                          <td className="px-2 sm:px-4 py-2">
                                            <Input
                                              value={entry.subject}
                                              onChange={(e) =>
                                                handleUpdateTimetableEntry(
                                                  index,
                                                  "subject",
                                                  e.target.value,
                                                )
                                              }
                                              placeholder="Enter subject"
                                              className="w-full h-8 sm:h-9 text-sm"
                                            />
                                          </td>
                                          <td className="px-2 sm:px-4 py-2">
                                            <Input
                                              type="date"
                                              value={entry.date}
                                              onChange={(e) =>
                                                handleUpdateTimetableEntry(
                                                  index,
                                                  "date",
                                                  e.target.value,
                                                )
                                              }
                                              className="w-full h-8 sm:h-9 text-sm"
                                            />
                                          </td>
                                          <td className="px-2 sm:px-4 py-2">
                                            <Input
                                              type="time"
                                              value={entry.startTime}
                                              onChange={(e) => {
                                                const newStartTime =
                                                  e.target.value;
                                                // Validate that start time is less than end time
                                                if (
                                                  entry.endTime &&
                                                  newStartTime
                                                ) {
                                                  const [startHour, startMin] =
                                                    newStartTime
                                                      .split(":")
                                                      .map(Number);
                                                  const [endHour, endMin] =
                                                    entry.endTime
                                                      .split(":")
                                                      .map(Number);
                                                  const startMinutes =
                                                    startHour * 60 + startMin;
                                                  const endMinutes =
                                                    endHour * 60 + endMin;

                                                  if (
                                                    startMinutes >= endMinutes
                                                  ) {
                                                    toast.error(
                                                      "Start time must be less than end time",
                                                    );
                                                    return;
                                                  }
                                                }
                                                handleUpdateTimetableEntry(
                                                  index,
                                                  "startTime",
                                                  newStartTime,
                                                );
                                              }}
                                              placeholder="Start time"
                                              className="w-full h-8 sm:h-9 text-sm"
                                            />
                                          </td>
                                          <td className="px-2 sm:px-4 py-2">
                                            <Input
                                              type="time"
                                              value={entry.endTime}
                                              onChange={(e) => {
                                                const newEndTime =
                                                  e.target.value;
                                                // Validate that end time is greater than start time
                                                if (
                                                  entry.startTime &&
                                                  newEndTime
                                                ) {
                                                  const [startHour, startMin] =
                                                    entry.startTime
                                                      .split(":")
                                                      .map(Number);
                                                  const [endHour, endMin] =
                                                    newEndTime
                                                      .split(":")
                                                      .map(Number);
                                                  const startMinutes =
                                                    startHour * 60 + startMin;
                                                  const endMinutes =
                                                    endHour * 60 + endMin;

                                                  if (
                                                    endMinutes <= startMinutes
                                                  ) {
                                                    toast.error(
                                                      "End time must be greater than start time",
                                                    );
                                                    return;
                                                  }
                                                }
                                                handleUpdateTimetableEntry(
                                                  index,
                                                  "endTime",
                                                  newEndTime,
                                                );
                                              }}
                                              placeholder="End time"
                                              className="w-full h-8 sm:h-9 text-sm"
                                            />
                                          </td>
                                          <td className="px-2 sm:px-4 py-2">
                                            <span className="text-sm text-gray-900">
                                              {entry.duration
                                                ? formatDuration(entry.duration)
                                                : "N/A"}
                                            </span>
                                          </td>
                                          <td className="px-2 sm:px-4 py-2">
                                            <Input
                                              type="number"
                                              value={entry.passMark}
                                              onChange={(e) =>
                                                handleUpdateTimetableEntry(
                                                  index,
                                                  "passMark",
                                                  e.target.value,
                                                )
                                              }
                                              placeholder="Min Marks"
                                              className="w-full h-8 sm:h-9 text-sm"
                                            />
                                          </td>
                                          <td className="px-2 sm:px-4 py-2">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() =>
                                                handleRemoveTimetableEntry(
                                                  index,
                                                )
                                              }
                                              disabled={
                                                examForm.timetableEntries
                                                  .length === 1
                                              }
                                              className="h-8 w-8 p-0"
                                            >
                                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                            </Button>
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 mt-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAddTimetableEntry}
                                className="w-full sm:w-auto h-9 sm:h-8"
                              >
                                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="text-xs sm:text-sm">
                                  Add Row
                                </span>
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleGenerateTimetablePNG}
                                disabled={
                                  examForm.timetableEntries.some(
                                    (entry) => !entry.subject || !entry.date,
                                  ) || uploading
                                }
                                className="w-full sm:w-auto h-9 sm:h-8"
                              >
                                {uploading ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-gray-600 mr-1 sm:mr-2"></div>
                                    <span className="text-xs sm:text-sm">
                                      Generating...
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                    <span className="text-xs sm:text-sm">
                                      Create Timetable
                                    </span>
                                  </>
                                )}
                              </Button>
                            </div>
                            {examForm.generatedTimetableImage &&
                              (timetableMode === "table" ||
                                timetableMode === "both") && (
                                <div className="mt-3 p-2 sm:p-3 border rounded-md bg-blue-50">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                                      <span className="text-xs sm:text-sm text-blue-600 font-medium">
                                        Timetable generated successfully
                                      </span>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setExamForm((prev) => ({
                                          ...prev,
                                          generatedTimetableImage: "",
                                          generatedTimetableFilePath: "",
                                        }))
                                      }
                                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      title="Remove generated timetable"
                                    >
                                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                  </div>
                                  <div
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() =>
                                      downloadFile(
                                        examForm.generatedTimetableImage,
                                        `${examForm.title || "exam"}-generated-timetable.png`,
                                      )
                                    }
                                  >
                                    <Image
                                      src={examForm.generatedTimetableImage}
                                      alt="Generated timetable"
                                      width={250}
                                      height={100}
                                      className="max-w-full h-20 sm:h-32 object-contain border rounded-md bg-white"
                                    />
                                  </div>
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 sm:pt-6 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto h-10 sm:h-9"
                        onClick={() => {
                          setExamForm({
                            title: "",
                            description: "",
                            subject: "",
                            class: "",
                            duration: "",
                            totalMarks: "",
                            examDate: "",
                            registrationDeadline: "",
                            fees: "",
                            notice: "",
                            rulesAndRegulations: "",
                            isActive: true,
                            timetableTitle: "",
                            timetableDescription: "",
                            uploadedTimetableImage: "",
                            uploadedTimetableFileType: "",
                            uploadedTimetableFilePath: "",
                            generatedTimetableImage: "",
                            generatedTimetableFilePath: "",
                            timetableEntries: [
                              { subject: "", date: "", duration: "" },
                            ],
                          });
                          setTimetableMode("both");
                          setIsCreateExamOpen(false);
                          setEditingItem(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="w-full sm:w-auto h-10 sm:h-9"
                      >
                        {editingItem ? "Update Exam" : "Create Exam"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Delete Confirmation Dialog */}
              <Dialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
              >
                <DialogContent className="sm:max-w-md bg-white p-4 sm:p-6 w-[95vw] sm:w-full">
                  <DialogHeader className="space-y-2">
                    <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                      Delete Exam
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                      Are you sure you want to delete this exam? This action
                      cannot be undone and will permanently remove the exam
                      along with all associated data.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-4 sm:mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDeleteConfirmOpen(false);
                        setExamToDelete(null);
                      }}
                      className="w-full sm:w-auto h-9"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={confirmDeleteExam}
                      className="bg-red-600 hover:bg-red-700 w-full sm:w-auto h-9"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Exam
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Attendance Sheet Selection Dialog */}
              <Dialog
                open={attendanceDialogOpen}
                onOpenChange={setAttendanceDialogOpen}
              >
                <DialogContent className="sm:max-w-2xl bg-white p-4 sm:p-6 w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
                  <DialogHeader className="space-y-2">
                    <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                      Generate Attendance Sheet
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                      Select filters for the Attendance sheet
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                    {/* Language Selection */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="language-select"
                        className="text-sm font-semibold"
                      >
                        Language
                      </Label>
                      <Select
                        value={selectedLanguage}
                        onValueChange={setSelectedLanguage}
                      >
                        <SelectTrigger id="language-select">
                          <SelectValue placeholder="Select Language" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="ml">Malayalam (മലയാളം)</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* District Selection */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="district-select"
                        className="text-sm font-semibold"
                      >
                        District
                      </Label>
                      <Select
                        value={selectedDistrict}
                        onValueChange={(val) => {
                          setSelectedDistrict(val);
                          setSelectedMekhala("all");
                          setSelectedMahal("all");
                          setSelectedMahalId("all");
                          setSelectedClasses(["all"]);
                          setMadarsaSearch("");
                        }}
                      >
                        <SelectTrigger id="district-select">
                          <SelectValue placeholder="Select District" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="all">All Districts</SelectItem>
                          {getDistrictOptions().map((district) => (
                            <SelectItem key={district} value={district}>
                              {String(district).toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Mekhala Selection */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="mekhala-select"
                        className="text-sm font-semibold"
                      >
                        Mekhala
                      </Label>
                      <Select
                        value={selectedMekhala}
                        onValueChange={(val) => {
                          setSelectedMekhala(val);
                          setSelectedMahal("all");
                          setSelectedMahalId("all");
                          setSelectedClasses(["all"]);
                          setMadarsaSearch("");
                        }}
                        disabled={selectedDistrict === "all"}
                      >
                        <SelectTrigger id="mekhala-select">
                          <SelectValue placeholder="Select Mekhala" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {selectedDistrict !== "all" && (
                            <SelectItem value="all">All Mekhalas</SelectItem>
                          )}
                          {getFilteredMekhalas().map((mekhala) => (
                            <SelectItem key={mekhala.id} value={mekhala.id}>
                              {String(mekhala.name).toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Madarsa Selection */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="madarsa-select"
                        className="text-sm font-semibold"
                      >
                        Madarsa
                      </Label>
                      <Select
                        value={selectedMahalId}
                        onValueChange={(val) => {
                          setSelectedMahalId(val);
                          if (val === "all") {
                            setSelectedMahal("all");
                          } else {
                            const m = madarsas.find(
                              (item) => String(item.madarsaId) === val,
                            );
                            if (m) setSelectedMahal(m.name);
                          }

                          setSelectedClasses(["all"]);
                          // Don't clear search - helpful for re-selection
                        }}
                        disabled={selectedMekhala === "all"}
                      >
                        <SelectTrigger id="madarsa-select">
                          <SelectValue placeholder="Select Madarsa" />
                        </SelectTrigger>
                        <SelectContent className="bg-white max-h-[300px]">
                          <div className="px-2 py-2 sticky top-0 bg-white z-10 border-b">
                            <Input
                              type="text"
                              placeholder="Search Madarsa..."
                              value={madarsaSearch}
                              onChange={(e) => {
                                e.stopPropagation();
                                setMadarsaSearch(e.target.value);
                              }}
                              onKeyDown={(e) => e.stopPropagation()}
                              className="w-full h-8 text-sm"
                            />
                          </div>
                          <SelectItem value="all">All Madarsas</SelectItem>
                          {getFilteredMadarsas()
                            .filter(
                              (m) =>
                                m.name
                                  .toLowerCase()
                                  .includes(madarsaSearch.toLowerCase()) ||
                                (m.madarsaId &&
                                  m.madarsaId
                                    .toString()
                                    .includes(madarsaSearch)),
                            )
                            .map((madarsa) => (
                              <SelectItem
                                key={madarsa.id}
                                value={String(madarsa.madarsaId)}
                              >
                                {String(madarsa.name).toUpperCase()}{" "}
                                {madarsa.madarsaId
                                  ? `(${madarsa.madarsaId})`
                                  : ""}
                              </SelectItem>
                            ))}
                          {getFilteredMadarsas().filter(
                            (m) =>
                              m.name
                                .toLowerCase()
                                .includes(madarsaSearch.toLowerCase()) ||
                              (m.madarsaId &&
                                m.madarsaId.toString().includes(madarsaSearch)),
                          ).length === 0 && (
                            <div className="p-2 text-sm text-gray-500 text-center">
                              No madrasa found
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Class Selection (Multi-select) */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Classes</Label>
                      <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto bg-gray-50">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="class-all"
                            checked={selectedClasses.includes("all")}
                            onChange={() => handleClassSelection("all")}
                            className="h-4 w-4 cursor-pointer"
                          />
                          <Label
                            htmlFor="class-all"
                            className="text-sm cursor-pointer"
                          >
                            All Classes
                          </Label>
                        </div>
                        {getUniqueClasses().map((cls) => {
                          const isAllSelected = selectedClasses.includes("all");
                          const isClassSelected = selectedClasses.includes(cls);
                          return (
                            <div
                              key={cls}
                              className="flex items-center space-x-2"
                            >
                              <input
                                type="checkbox"
                                id={`class-${cls}`}
                                checked={isAllSelected || isClassSelected}
                                onChange={() => handleClassSelection(cls)}
                                disabled={false}
                                className="h-4 w-4 cursor-pointer"
                              />
                              <Label
                                htmlFor={`class-${cls}`}
                                className="text-sm cursor-pointer"
                              >
                                Class {cls}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected Filters Info */}
                    <div className="p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-md text-xs sm:text-sm">
                      <p className="font-medium text-blue-900 mb-1">
                        Selection Summary:
                      </p>
                      <p className="text-blue-700">
                        Language:{" "}
                        <span className="font-semibold">
                          {selectedLanguage === "ml" ? "Malayalam" : "English"}
                        </span>
                      </p>
                      <p className="text-blue-700">
                        District:{" "}
                        <span className="font-semibold">
                          {selectedDistrict === "all"
                            ? "ALL DISTRICTS"
                            : String(
                                getDistrictName(selectedDistrict),
                              ).toUpperCase()}
                        </span>
                      </p>
                      <p className="text-blue-700">
                        Mekhala:{" "}
                        <span className="font-semibold">
                          {selectedMekhala === "all"
                            ? "ALL MEKHALAS"
                            : String(
                                getMekhalaName(selectedMekhala),
                              ).toUpperCase()}
                        </span>
                      </p>
                      <p className="text-blue-700">
                        Madarsa:{" "}
                        <span className="font-semibold">
                          {selectedMahal === "all"
                            ? "ALL MADARSAS"
                            : String(selectedMahal).toUpperCase()}
                        </span>
                      </p>
                      <p className="text-blue-700">
                        Classes:{" "}
                        <span className="font-semibold">
                          {selectedClasses.includes("all")
                            ? "All Classes"
                            : selectedClasses
                                .map((c) => `Class ${c}`)
                                .join(", ")}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-4 sm:mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setAttendanceDialogOpen(false)}
                      className="w-full sm:w-auto h-9"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConfirmGenerateAttendance}
                      className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto h-9"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Generate Attendance Sheet
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Result Sheet Dialog */}
              <Dialog
                open={resultSheetDialogOpen}
                onOpenChange={setResultSheetDialogOpen}
              >
                <DialogContent className="w-full bg-white max-w-lg sm:max-w-2xl  overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                      Generate Result Sheet
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                      Select filters for the result sheet
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                    {/* Language Selection */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="result-language-select"
                        className="text-sm font-semibold"
                      >
                        Language
                      </Label>
                      <Select
                        value={selectedResultLanguage}
                        onValueChange={setSelectedResultLanguage}
                      >
                        <SelectTrigger id="result-language-select">
                          <SelectValue placeholder="Select Language" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="ml">Malayalam (മലയാളം)</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Madarsa Selection */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="result-madarsa-select"
                        className="text-sm font-semibold"
                      >
                        Madarsa
                      </Label>
                      <Select
                        value={selectedResultMahalId}
                        onValueChange={(val) => {
                          setSelectedResultMahalId(val);
                          if (val === "all") {
                            setSelectedResultMahal("all");
                          } else {
                            const m = madarsas.find(
                              (item) => String(item.madarsaId) === val,
                            );
                            if (m) setSelectedResultMahal(m.name);
                          }
                          // Don't clear search - helpful for re-selection
                        }}
                      >
                        <SelectTrigger id="result-madarsa-select">
                          <SelectValue placeholder="Select Madarsa" />
                        </SelectTrigger>
                        <SelectContent className="bg-white max-h-[300px]">
                          <div className="px-2 py-2 sticky top-0 bg-white z-10 border-b">
                            <Input
                              type="text"
                              placeholder="Search Madarsa..."
                              value={resultMadarsaSearch}
                              onChange={(e) => {
                                e.stopPropagation();
                                setResultMadarsaSearch(e.target.value);
                              }}
                              onKeyDown={(e) => e.stopPropagation()}
                              className="w-full h-8 text-sm"
                            />
                          </div>
                          <SelectItem value="all">All Madarsas</SelectItem>
                          {madarsas
                            .filter(
                              (m) =>
                                m.name
                                  .toLowerCase()
                                  .includes(
                                    resultMadarsaSearch.toLowerCase(),
                                  ) ||
                                (m.madarsaId &&
                                  m.madarsaId
                                    .toString()
                                    .includes(resultMadarsaSearch)),
                            )
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((madarsa) => (
                              <SelectItem
                                key={madarsa.id}
                                value={String(madarsa.madarsaId)}
                              >
                                {madarsa.name}{" "}
                                {madarsa.madarsaId
                                  ? `(${madarsa.madarsaId})`
                                  : ""}
                              </SelectItem>
                            ))}
                          {madarsas.filter(
                            (m) =>
                              m.name
                                .toLowerCase()
                                .includes(resultMadarsaSearch.toLowerCase()) ||
                              (m.madarsaId &&
                                m.madarsaId
                                  .toString()
                                  .includes(resultMadarsaSearch)),
                          ).length === 0 && (
                            <div className="p-2 text-sm text-gray-500 text-center">
                              No madrasa found
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Class Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Classes</Label>
                      <div className="border rounded-md p-3 space-y-2 bg-white max-h-40 overflow-y-auto">
                        {/* All Classes Checkbox */}
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="result-class-all"
                            checked={selectedResultClasses.includes("all")}
                            onCheckedChange={() =>
                              handleResultClassSelection("all")
                            }
                          />
                          <label
                            htmlFor="result-class-all"
                            className="text-sm font-medium cursor-pointer"
                          >
                            All Classes
                          </label>
                        </div>

                        {/* Individual Class Checkboxes */}
                        {getUniqueResultClasses().map((classItem) => (
                          <div
                            key={classItem}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`result-class-${classItem}`}
                              checked={selectedResultClasses.includes(
                                classItem,
                              )}
                              onCheckedChange={() =>
                                handleResultClassSelection(classItem)
                              }
                            />
                            <label
                              htmlFor={`result-class-${classItem}`}
                              className="text-sm cursor-pointer"
                            >
                              Class {classItem}
                            </label>
                          </div>
                        ))}

                        {getUniqueResultClasses().length === 0 && (
                          <p className="text-xs text-gray-500">
                            No classes available
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Selected Filters Info */}
                    <div className="p-2 sm:p-3 bg-green-50 border border-green-200 rounded-md text-xs sm:text-sm">
                      <p className="font-medium text-green-900 mb-1">
                        Selection Summary:
                      </p>
                      <p className="text-green-700">
                        Language:{" "}
                        <span className="font-semibold">
                          {selectedResultLanguage === "ml"
                            ? "Malayalam"
                            : "English"}
                        </span>
                      </p>
                      <p className="text-green-700">
                        Madarsa:{" "}
                        <span className="font-semibold">
                          {selectedResultMahal === "all"
                            ? "All Madarsas"
                            : selectedResultMahal}
                        </span>
                      </p>
                      <p className="text-green-700">
                        Classes:{" "}
                        <span className="font-semibold">
                          {selectedResultClasses.includes("all")
                            ? "All Classes"
                            : selectedResultClasses.length === 0
                              ? "None Selected"
                              : selectedResultClasses
                                  .map((c) => `Class ${c}`)
                                  .join(", ")}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-4 sm:mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setResultSheetDialogOpen(false)}
                      className="w-full sm:w-auto h-9"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConfirmGenerateResult}
                      className="bg-green-600 hover:bg-green-700 w-full sm:w-auto h-9"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Generate Result Sheet
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Exams List */}
          {viewMode === "card" ? (
            <div>
              <div className="grid gap-3 sm:gap-4">
                {exams.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <FileCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No exams created yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  currentExams.map((exam) => (
                    <Card key={exam.id}>
                      <CardContent className="p-3 sm:p-4 md:p-6">
                        <div className="flex flex-col gap-3 sm:gap-4">
                          <div className="flex-1 w-full">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-2">
                              <h3 className="text-base sm:text-lg font-semibold">
                                {exam.title}
                              </h3>
                              <Badge
                                variant={
                                  exam.isActive ? "default" : "secondary"
                                }
                                className={`w-fit ${exam.isActive ? "bg-green-500 hover:bg-green-500 text-white" : ""}`}
                              >
                                {exam.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>

                            <div className="text-xs sm:text-sm text-gray-600 space-y-2 sm:space-y-1">
                              <p>{exam.description}</p>

                              {/* Subject and Class Info */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3 p-2 sm:p-3 bg-gray-50 rounded">
                                <div>
                                  <span className="text-xs font-medium text-gray-500 uppercase">
                                    Subject
                                  </span>
                                  <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                                    {exam.subject || "Not specified"}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-gray-500 uppercase">
                                    Class
                                  </span>
                                  <p className="text-xs sm:text-sm font-medium text-gray-900">
                                    {exam.class || "Not specified"}
                                  </p>
                                </div>
                                {exam.duration && (
                                  <div>
                                    <span className="text-xs font-medium text-gray-500 uppercase">
                                      Duration
                                    </span>
                                    <p className="text-xs sm:text-sm font-medium text-gray-900">
                                      {exam.duration}
                                    </p>
                                  </div>
                                )}
                                {exam.totalMarks && (
                                  <div>
                                    <span className="text-xs font-medium text-gray-500 uppercase">
                                      Total Marks
                                    </span>
                                    <p className="text-xs sm:text-sm font-medium text-gray-900">
                                      {exam.totalMarks}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 mt-3 text-xs sm:text-sm">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                                  <span className="text-xs sm:text-sm">
                                    Exam: {formatDate(exam.examDate)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                                  <span className="text-xs sm:text-sm">
                                    Deadline:{" "}
                                    {formatDate(exam.registrationDeadline)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs sm:text-sm">
                                    ₹{exam.fees}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                                  <span className="text-xs sm:text-sm">
                                    {
                                      examRegistrations.filter(
                                        (r) => r.examId === exam.id,
                                      ).length
                                    }{" "}
                                    registered
                                  </span>
                                </div>
                              </div>

                              {/* Rules and Regulations */}
                              {exam.rulesAndRegulations && (
                                <div className="mt-3 p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-md">
                                  <div className="flex items-center gap-2 mb-1 sm:mb-2">
                                    <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                                    <span className="text-xs sm:text-sm font-medium text-blue-800">
                                      Rules & Regulations
                                    </span>
                                  </div>
                                  <p className="text-xs sm:text-sm text-blue-700 whitespace-pre-wrap">
                                    {exam.rulesAndRegulations}
                                  </p>
                                </div>
                              )}

                              {/* Timetable Information */}
                              {(exam.timetableTitle ||
                                exam.uploadedTimetableImage ||
                                exam.generatedTimetableImage ||
                                exam.timetableImage) && (
                                <div className="mt-3 p-2 sm:p-3 bg-green-50 border border-green-200 rounded-md">
                                  <div className="flex items-center justify-between gap-2 mb-1 sm:mb-2">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                                      <span className="text-xs sm:text-sm font-medium text-green-800">
                                        {exam.timetableTitle ||
                                          "Exam Timetable"}
                                      </span>
                                    </div>
                                  </div>
                                  {exam.timetableDescription && (
                                    <p className="text-xs sm:text-sm text-green-700 mb-2">
                                      {exam.timetableDescription}
                                    </p>
                                  )}

                                  {/* Legacy Timetable (backward compatibility) */}
                                  {exam.timetableImage &&
                                    !exam.uploadedTimetableImage &&
                                    !exam.generatedTimetableImage && (
                                      <div className="mt-2 p-2 bg-white border rounded-md">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                          <span className="text-xs font-medium text-gray-700">
                                            Timetable
                                          </span>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              handleDownloadTimetable(
                                                typeof exam.timetableImage ===
                                                  "string"
                                                  ? exam.timetableImage
                                                  : exam.timetableImage
                                                      ?.secure_url ||
                                                      exam.timetableImage?.url,
                                                exam.title,
                                              )
                                            }
                                            className="text-green-600 hover:text-green-700 h-7 sm:h-8 px-2 text-xs"
                                            title="Download Timetable"
                                          >
                                            <Download className="h-3 w-3 mr-1" />
                                            Download
                                          </Button>
                                        </div>
                                        <div
                                          className="cursor-pointer hover:opacity-80 transition-opacity inline-block"
                                          onClick={() =>
                                            window.open(
                                              typeof exam.timetableImage ===
                                                "string"
                                                ? exam.timetableImage
                                                : exam.timetableImage
                                                    ?.secure_url ||
                                                    exam.timetableImage?.url,
                                              "_blank",
                                            )
                                          }
                                        >
                                          {exam.timetableFileType ===
                                          "application/pdf" ? (
                                            <div className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
                                              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                                              <span className="text-xs text-gray-700">
                                                Click to view PDF timetable
                                              </span>
                                            </div>
                                          ) : (
                                            <Image
                                              src={
                                                typeof exam.timetableImage ===
                                                "string"
                                                  ? exam.timetableImage
                                                  : exam.timetableImage
                                                      ?.secure_url ||
                                                    exam.timetableImage?.url
                                              }
                                              alt="Exam timetable"
                                              width={180}
                                              height={80}
                                              className="max-w-full h-12 sm:h-16 object-contain border rounded bg-white"
                                            />
                                          )}
                                        </div>
                                      </div>
                                    )}

                                  {/* Uploaded Timetable */}
                                  {exam.uploadedTimetableImage && (
                                    <div className="mt-2 p-2 bg-white border rounded-md">
                                      <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="text-xs font-medium text-gray-700">
                                          Uploaded Timetable
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            handleDownloadTimetable(
                                              exam.uploadedTimetableImage,
                                              `${exam.title}-uploaded`,
                                            )
                                          }
                                          className="text-green-600 hover:text-green-700 h-7 sm:h-8 px-2 text-xs"
                                          title="Download Uploaded Timetable"
                                        >
                                          <Download className="h-3 w-3 mr-1" />
                                          Download
                                        </Button>
                                      </div>
                                      <div
                                        className="cursor-pointer hover:opacity-80 transition-opacity inline-block"
                                        onClick={() =>
                                          window.open(
                                            exam.uploadedTimetableImage,
                                            "_blank",
                                          )
                                        }
                                      >
                                        {exam.uploadedTimetableFileType ===
                                        "application/pdf" ? (
                                          <div className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
                                            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                                            <span className="text-xs text-gray-700">
                                              Click to view PDF timetable
                                            </span>
                                          </div>
                                        ) : (
                                          <Image
                                            src={exam.uploadedTimetableImage}
                                            alt="Uploaded exam timetable"
                                            width={180}
                                            height={80}
                                            className="max-w-full h-12 sm:h-16 object-contain border rounded bg-white"
                                          />
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Generated Timetable */}
                                  {exam.generatedTimetableImage && (
                                    <div className="mt-2 p-2 bg-white border rounded-md">
                                      <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="text-xs font-medium text-gray-700">
                                          Generated Timetable
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            handleDownloadTimetable(
                                              exam.generatedTimetableImage,
                                              `${exam.title}-generated`,
                                            )
                                          }
                                          className="text-blue-600 hover:text-blue-700 h-7 sm:h-8 px-2 text-xs"
                                          title="Download Generated Timetable"
                                        >
                                          <Download className="h-3 w-3 mr-1" />
                                          Download
                                        </Button>
                                      </div>
                                      <div
                                        className="cursor-pointer hover:opacity-80 transition-opacity inline-block"
                                        onClick={() =>
                                          window.open(
                                            exam.generatedTimetableImage,
                                            "_blank",
                                          )
                                        }
                                      >
                                        <Image
                                          src={exam.generatedTimetableImage}
                                          alt="Generated exam timetable"
                                          width={180}
                                          height={80}
                                          className="max-w-full h-12 sm:h-16 object-contain border rounded bg-white"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 pt-2 border-t">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() =>
                                router.push(`/dashboard/dkju-control/exam/${exam.id}`)
                              }
                              className="h-9"
                              title="View Registered/Unregistered Students"
                            >
                              <Eye className="h-4 w-4 sm:mr-1" />
                              <span className="ml-1">View</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditExam(exam)}
                              className="h-9"
                            >
                              <Edit className="h-4 w-4 sm:mr-1" />
                              <span className="ml-1">Edit</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteExam(exam.id)}
                              className="text-red-600 hover:text-red-700 h-9"
                            >
                              <Trash2 className="h-4 w-4 sm:mr-1" />
                              <span className="ml-1">Delete</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleGenerateAttendanceSheet(exam)
                              }
                              className="text-blue-600 hover:text-blue-700 h-9"
                              title="Generate Attendance Sheet"
                            >
                              <ClipboardList className="h-4 w-4 sm:mr-1" />
                              <span className="ml-1">Attendance Sheet</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGenerateResultSheet(exam)}
                              className="text-green-600 hover:text-green-700 h-9"
                              title="Generate Result Sheet"
                            >
                              <FileText className="h-4 w-4 sm:mr-1" />
                              <span className="ml-1">Result Sheet</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/dashboard/dkju-control/exam/result/${exam.id}/view`,
                                )
                              }
                              className="h-9 text-blue-600 border-blue-200 hover:bg-blue-50"
                              title="View and Edit Results"
                            >
                              <FileText className="h-4 w-4 sm:mr-1" />
                              <span className="ml-1">View Result</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/dashboard/dkju-control/exam/result/${exam.id}`,
                                )
                              }
                              className="h-9"
                              title="Upload/Manage Results"
                            >
                              <Upload className="h-4 w-4 sm:mr-1" />
                              <span className="ml-1">Upload Result</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/dashboard/dkju-control/exam/unpublished?exam=${exam.id}`,
                                )
                              }
                              className="h-9 text-orange-600 border-orange-200 hover:bg-orange-50"
                              title="View Unpublished Results"
                            >
                              <Globe className="h-4 w-4 sm:mr-1" />
                              <span className="ml-1">Unpublished</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {exams.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <FileCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No exams created yet</p>
                  </CardContent>
                </Card>
              ) : (
                currentExams.map((exam) => (
                  <Card key={exam.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {/* Compact Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 hover:bg-gray-50 transition-colors gap-3">
                        <div className="flex-1 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-6 sm:gap-3 sm:items-center">
                          {/* Title & Status */}
                          <div className="sm:col-span-2">
                            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                              {exam.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                variant={
                                  exam.isActive ? "default" : "secondary"
                                }
                                className={`text-xs ${exam.isActive ? "bg-green-500 hover:bg-green-500 text-white" : ""}`}
                              >
                                {exam.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {exam.class}
                              </span>
                            </div>
                          </div>

                          {/* Exam Date */}
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="text-xs text-gray-500">
                                Exam Date
                              </div>
                              <div className="text-xs sm:text-sm font-medium text-gray-900">
                                {formatDate(exam.examDate)}
                              </div>
                            </div>
                          </div>

                          {/* Registration Deadline */}
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="text-xs text-gray-500">
                                Deadline
                              </div>
                              <div className="text-xs sm:text-sm font-medium text-gray-900">
                                {formatDate(exam.registrationDeadline)}
                              </div>
                            </div>
                          </div>

                          {/* Fees & Registrations */}
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div>
                              <div className="text-xs text-gray-500">Fees</div>
                              <div className="text-xs sm:text-sm font-medium text-gray-900">
                                ₹{exam.fees}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-gray-400" />
                              <span className="text-xs sm:text-sm font-medium text-gray-900">
                                {
                                  examRegistrations.filter(
                                    (r) => r.examId === exam.id,
                                  ).length
                                }
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 sm:justify-end">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() =>
                                router.push(`/dashboard/dkju-control/exam/${exam.id}`)
                              }
                              className="h-8 flex-1 sm:flex-none text-xs sm:text-sm"
                              title="View Registered/Unregistered Students"
                            >
                              <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/dashboard/dkju-control/exam/result/${exam.id}/view`,
                                )
                              }
                              className="h-8 flex-1 sm:flex-none text-xs sm:text-sm text-blue-600 border-blue-200"
                              title="View Results"
                            >
                              <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              Results
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/dashboard/dkju-control/exam/unpublished?exam=${exam.id}`,
                                )
                              }
                              className="h-8 flex-1 sm:flex-none text-xs sm:text-sm text-orange-600 border-orange-200"
                              title="View Unpublished Results"
                            >
                              <Globe className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              Unpublished Results
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setExpandedExamId(
                                  expandedExamId === exam.id ? null : exam.id,
                                )
                              }
                              className="h-8 flex-1 sm:flex-none text-xs sm:text-sm"
                            >
                              {expandedExamId === exam.id ? (
                                <>
                                  <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                  Details
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditExam(exam)}
                              className="h-8 w-8 p-0"
                              title="Edit"
                            >
                              <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteExam(exam.id)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedExamId === exam.id && (
                        <div className="border-t bg-gray-50 p-3 sm:p-4 space-y-3 sm:space-y-4">
                          {/* Description & Subject */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {exam.description && (
                              <div>
                                <h4 className="text-xs font-semibold text-gray-700 uppercase mb-1">
                                  Description
                                </h4>
                                <p className="text-xs sm:text-sm text-gray-600">
                                  {exam.description}
                                </p>
                              </div>
                            )}
                            <div>
                              <h4 className="text-xs font-semibold text-gray-700 uppercase mb-1">
                                Subject
                              </h4>
                              <p className="text-xs sm:text-sm text-gray-600">
                                {exam.subject || "Not specified"}
                              </p>
                            </div>
                          </div>

                          {/* Duration & Total Marks */}
                          {(exam.duration || exam.totalMarks) && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-2 sm:p-3 bg-white rounded-md border">
                              {exam.duration && (
                                <div>
                                  <span className="text-xs font-medium text-gray-500 uppercase">
                                    Duration
                                  </span>
                                  <p className="text-xs sm:text-sm font-medium text-gray-900">
                                    {exam.duration}
                                  </p>
                                </div>
                              )}
                              {exam.totalMarks && (
                                <div>
                                  <span className="text-xs font-medium text-gray-500 uppercase">
                                    Total Marks
                                  </span>
                                  <p className="text-xs sm:text-sm font-medium text-gray-900">
                                    {exam.totalMarks}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Rules and Regulations */}
                          {exam.rulesAndRegulations && (
                            <div className="p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-md">
                              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                                <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                                <span className="text-xs sm:text-sm font-medium text-blue-800">
                                  Rules & Regulations
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm text-blue-700 whitespace-pre-wrap">
                                {exam.rulesAndRegulations}
                              </p>
                            </div>
                          )}

                          {/* Timetable Information */}
                          {(exam.timetableTitle ||
                            exam.uploadedTimetableImage ||
                            exam.generatedTimetableImage ||
                            exam.timetableImage) && (
                            <div className="p-2 sm:p-3 bg-green-50 border border-green-200 rounded-md">
                              <div className="flex items-center justify-between gap-2 mb-1 sm:mb-2">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                                  <span className="text-xs sm:text-sm font-medium text-green-800">
                                    {exam.timetableTitle || "Exam Timetable"}
                                  </span>
                                </div>
                              </div>

                              {exam.timetableDescription && (
                                <p className="text-xs sm:text-sm text-green-700 mb-2">
                                  {exam.timetableDescription}
                                </p>
                              )}

                              <div className="flex flex-wrap gap-2">
                                {exam.timetableImage &&
                                  !exam.uploadedTimetableImage &&
                                  !exam.generatedTimetableImage && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleDownloadTimetable(
                                          typeof exam.timetableImage ===
                                            "string"
                                            ? exam.timetableImage
                                            : exam.timetableImage?.secure_url ||
                                                exam.timetableImage?.url,
                                          exam.title,
                                        )
                                      }
                                      className="text-green-600 hover:text-green-700 h-8 text-xs"
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      View Timetable
                                    </Button>
                                  )}
                                {exam.uploadedTimetableImage && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleDownloadTimetable(
                                        exam.uploadedTimetableImage,
                                        `${exam.title}-uploaded`,
                                      )
                                    }
                                    className="text-green-600 hover:text-green-700 h-8 text-xs"
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    Uploaded Timetable
                                  </Button>
                                )}
                                {exam.generatedTimetableImage && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleDownloadTimetable(
                                        exam.generatedTimetableImage,
                                        `${exam.title}-generated`,
                                      )
                                    }
                                    className="text-blue-600 hover:text-blue-700 h-8 text-xs"
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    Generated Timetable
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleGenerateAttendanceSheet(exam)
                              }
                              className="text-blue-600 hover:text-blue-700 h-8 text-xs sm:text-sm"
                            >
                              <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              Attendance Sheet
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGenerateResultSheet(exam)}
                              className="text-green-600 hover:text-green-700 h-8 text-xs sm:text-sm"
                            >
                              <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              Result Sheet
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/dashboard/dkju-control/exam/result/${exam.id}`,
                                )
                              }
                              className="h-8 text-xs sm:text-sm"
                            >
                              <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              Result
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {exams.length > examsPerPage && (
            <div className="flex justify-center items-center gap-4 mt-6 pb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="w-24"
              >
                Previous
              </Button>
              <span className="text-sm font-medium text-gray-600">
                Page {currentPage} of {Math.ceil(exams.length / examsPerPage)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => paginate(currentPage + 1)}
                disabled={
                  currentPage === Math.ceil(exams.length / examsPerPage)
                }
                className="w-24"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
export default function CreateExamsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
      }
    >
      <CreateExamsPage />
    </Suspense>
  );
}
