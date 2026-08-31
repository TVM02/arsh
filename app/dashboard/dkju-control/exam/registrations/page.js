"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/lib/authUtils";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Calendar,
  DollarSign,
  Filter,
  ArrowUpDown,
  Download,
  User,
  IndianRupee,
  Edit,
  ChevronLeft,
  ChevronRight,
  Printer,
  X,
  Trash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getDocuments,
  updateDocument,
  COLLECTIONS,
} from "@/lib/firestoreService";
import {
  orderBy,
  collection,
  query,
  getDocs,
  getDoc,
  deleteDoc,
  doc as docRef,
  where,
  limit,
  startAfter,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { toast } from "sonner";
import Image from "next/image";
import {
  generateHallTicketPDF,
  generateHallTicketNumber,
} from "@/lib/pdfUtils";
import { jsPDF } from "jspdf";
import {
  generateHallTicketHTML,
  generateHallTicketPDFBlob,
  toRomanIfNumber as toRomanUtil,
  formatDate as formatDateUtil,
} from "@/lib/hallTicketUtils";
import { PDFDocument } from "pdf-lib";
import HallTicket from "@/components/HallTicket";
import StudentFilters from "@/components/StudentFilters";
import {
  fetchFilteredRegistrations,
  getRegistrationsCount,
  fetchStudentsByIds,
  fetchMetadata,
  searchRegistrations,
} from "@/lib/firestoreQueries";
import { exportRegistrationsToCSV } from "@/lib/exportUtils";

// Helper function to normalize class levels
const normalizeClassLevel = (classLevel) => {
  if (!classLevel) return "";

  // Normalize UKG variations to canonical "Ukg"
  const normalized = classLevel.toString().trim().toUpperCase();
  if (
    normalized === "U.K.G" ||
    normalized === "U.K.G." ||
    normalized === "UKG"
  ) {
    return "Ukg";
  }

  return classLevel;
};

// Helper function to get sort order for classes
const getClassSortOrder = (classLevel) => {
  if (!classLevel) return 999;

  const normalized = normalizeClassLevel(classLevel);

  // Special cases for pre-primary
  if (normalized === "LKG") return -1;
  if (normalized === "Ukg") return 0;

  // Handle numeric classes (1-12)
  const numericClass = parseInt(normalized);
  if (!isNaN(numericClass) && numericClass >= 1 && numericClass <= 12) {
    return numericClass;
  }

  // Everything else goes to the end
  return 999;
};

// Helper function to format dates
const formatDate = formatDateUtil;

// Helper function to get profile picture from student or application
const getProfilePicture = async (student, admissionNumber, madarsaId) => {
  // First check if student has profile picture
  if (student?.profilePictureUrl || student?.profilePicture) {
    return student.profilePictureUrl || student.profilePicture;
  }

  // If not found in student, check admissions collection (exactly like HallTicket component)
  if (admissionNumber) {
    try {
      const admissionsRef = collection(db, "admissions");
      const q = query(
        admissionsRef,
        where("admissionNumber", "==", admissionNumber),
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const admissionData = querySnapshot.docs[0].data();
        const profileUrl =
          admissionData.profilePictureUrl || admissionData.profilePicture;
        if (profileUrl) {
          return profileUrl;
        }
      } else {
        console.log(
          "No admission found with admissionNumber:",
          admissionNumber,
        );
      }
    } catch (error) {
      console.error("Error fetching profile picture from admissions:", error);
    }
  }

  return "";
};

export default function ExamRegistrationsPage() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data States - Optimized
  const [exams, setExams] = useState([]);
  const [currentPageRegistrations, setCurrentPageRegistrations] = useState([]);
  const [pageStudents, setPageStudents] = useState([]); // Only students for current page

  // Metadata Caching (fetched once)
  const [madrasaMap, setMadrasaMap] = useState(new Map());
  const [mekhalaMap, setMekhalaMap] = useState(new Map());
  const [mekhalas, setMekhalas] = useState([]);
  const [madrasas, setMadrasas] = useState([]);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const lastDocRef = useRef(null);
  const [loadingPage, setLoadingPage] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedExam, setSelectedExam] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedMekhala, setSelectedMekhala] = useState("all");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [selectedMadrasa, setSelectedMadrasa] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");

  // District and Class States
  const [districts, setDistricts] = useState([]);
  const [filteredDistricts, setFilteredDistricts] = useState([]);
  const [filteredMadrasas, setFilteredMadrasas] = useState([]);
  const [classes, setClasses] = useState([]);

  // Edit States
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState(null);
  const [editForm, setEditForm] = useState({
    studentName: "",
    studentEmail: "",
    studentPhone: "",
    paymentStatus: "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Manual Hall Ticket States
  const [isManualHallTicketDialogOpen, setIsManualHallTicketDialogOpen] =
    useState(false);
  const [manualHallTicketData, setManualHallTicketData] = useState(null);
  const [manualHallTicketForm, setManualHallTicketForm] = useState({
    rollNumber: "",
    fullName: "",
    gender: "",
    admissionNumber: "",
    classLevel: "",
    madarsa: "",
    madarsaId: "",
    mekhala: "",
    sadar: "",
    guardianPhone: "",
    dateOfBirth: "",
    profilePictureUrl: "",
    examId: "",
    examTitle: "",
    examDate: "",
    examFees: "",
    hallTicketNumber: "",
  });
  const [manualHallTicketSubmitting, setManualHallTicketSubmitting] =
    useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Bulk download state
  const [downloadingBulkHallTickets, setDownloadingBulkHallTickets] =
    useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);

  // Delete States
  const [deletingRegistration, setDeletingRegistration] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Timetables and Notices States
  const [notices, setNotices] = useState({});

  // Fetch exams
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

  // Fetch and cache metadata (madrasas & mekhalas) - called once
  const loadMetadata = useCallback(async () => {
    try {
      const { madrasas, mekhalas, madrasaMap, mekhalaMap } =
        await fetchMetadata();
      setMadrasas(madrasas);
      setMekhalas(mekhalas);
      setMadrasaMap(madrasaMap);
      setMekhalaMap(mekhalaMap);
      setFilteredMadrasas(madrasas);

      // Extract districts from madrasas
      const districtSet = new Set(
        madrasas.map((m) => m.district).filter(Boolean),
      );
      const districtList = Array.from(districtSet).map((name, idx) => ({
        id: `dist-${idx}`,
        name,
      }));
      setDistricts(districtList);
      setFilteredDistricts(districtList);
    } catch (error) {
      console.error("Error fetching metadata:", error);
    }
  }, []);

  // Fetch current page registrations with server-side filtering
  const loadPageData = useCallback(async () => {
    setLoadingPage(true);
    try {
      // Build filter object for server-side query
      const filters = {
        examId: selectedExam !== "all" ? selectedExam : null,
        classLevel: selectedClass !== "all" ? selectedClass : null,
        paymentStatus: ["completed", "waived"],
      };

      // If search term is present, use search function instead of pagination
      if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
        const { registrations, total } = await searchRegistrations(
          debouncedSearchTerm,
          filters,
        );

        setTotalCount(total);
        setCurrentPageRegistrations(registrations);

        // Fetch students for search results
        if (registrations.length > 0) {
          const studentIds = [
            ...new Set(registrations.map((r) => r.studentId)),
          ];
          const students = await fetchStudentsByIds(studentIds);
          setPageStudents(students);

          // Extract classes from students
          const classSet = new Set(
            students
              .filter((s) => s.status === "active")
              .map((s) => normalizeClassLevel(s.classLevel))
              .filter(Boolean),
          );
          const sortedClasses = Array.from(classSet).sort(
            (a, b) => getClassSortOrder(a) - getClassSortOrder(b),
          );
          setClasses(sortedClasses);
        }
      } else {
        // Normal pagination when no search term
        const count = await getRegistrationsCount(filters);
        setTotalCount(count);

        // Fetch current page
        const { registrations, lastVisible } = await fetchFilteredRegistrations(
          filters,
          itemsPerPage,
          currentPage > 1 ? lastDocRef.current : null,
        );

        lastDocRef.current = lastVisible;
        setCurrentPageRegistrations(registrations);

        // Fetch students for this page only (20-record enrichment)
        if (registrations.length > 0) {
          const studentIds = [
            ...new Set(registrations.map((r) => r.studentId)),
          ];
          const students = await fetchStudentsByIds(studentIds);
          setPageStudents(students);

          // Extract classes from students
          const classSet = new Set(
            students
              .filter((s) => s.status === "active")
              .map((s) => normalizeClassLevel(s.classLevel))
              .filter(Boolean),
          );
          const sortedClasses = Array.from(classSet).sort(
            (a, b) => getClassSortOrder(a) - getClassSortOrder(b),
          );
          setClasses(sortedClasses);
        }
      }
    } catch (error) {
      console.error("Error loading page data:", error);
      setError("Failed to load registrations");
    } finally {
      setLoadingPage(false);
    }
  }, [
    selectedExam,
    selectedClass,
    currentPage,
    itemsPerPage,
    debouncedSearchTerm,
  ]);

  // Initial load
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([fetchExams(), loadMetadata()]);
      setLoading(false);
    };
    initializeData();
  }, [fetchExams, loadMetadata]);

  // Load page data when filters or page change
  useEffect(() => {
    if (!loading) {
      loadPageData();
    }
  }, [loading, loadPageData]);

  // Debounce search input by 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 2000);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to page 1 when search term changes
  useEffect(() => {
    if (debouncedSearchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  // Enrich current page registrations with metadata using cached Maps
  const enrichedRegistrations = useMemo(() => {
    return currentPageRegistrations.map((registration) => {
      const student = pageStudents.find((s) => s.id === registration.studentId);
      // Use madarsaId from student to lookup in Map
      const madrasa = student && madrasaMap.get(student.madarsaId);

      let mekhalaId = null;
      let mekhalaName = null;
      let districtName = null;

      if (madrasa) {
        // Madrasa has mekhala and district fields directly
        districtName = madrasa.district || null;
        mekhalaName = madrasa.mekhala || null;

        // Find mekhala by name to get the ID
        if (mekhalaName) {
          const mekhala = Array.from(mekhalaMap.values()).find(
            (mk) =>
              mk.name?.toUpperCase() === mekhalaName.toUpperCase() ||
              mk.region?.toUpperCase() === mekhalaName.toUpperCase(),
          );

          if (mekhala) {
            mekhalaId = mekhala.id;
          }
        }
      }

      return {
        ...registration,
        studentData: student || null,
        madrasaData: madrasa || null,
        mekhalaId,
        mekhalaName,
        districtName,
      };
    });
  }, [currentPageRegistrations, pageStudents, madrasaMap, mekhalaMap]);

  // Apply client-side filters (for filters not handled server-side)
  const filteredRegistrations = useMemo(() => {
    let filtered = enrichedRegistrations;

    // Gender filter (can't do server-side easily without denormalization)
    if (selectedGender !== "all") {
      filtered = filtered.filter(
        (reg) => reg.studentData?.gender === selectedGender,
      );
    }

    // Mekhala filter (can't do server-side easily without denormalization)
    if (selectedMekhala !== "all") {
      filtered = filtered.filter((reg) => reg.mekhalaId === selectedMekhala);
    }

    // District filter (can't do server-side easily without denormalization)
    if (filterDistrict !== "all") {
      const districtObj = districts.find((d) => d.id === filterDistrict);
      filtered = filtered.filter(
        (reg) => reg.madrasaData?.district === districtObj?.name,
      );
    }

    // Madrasa filter (can't do server-side easily without denormalization)
    if (selectedMadrasa !== "all") {
      filtered = filtered.filter(
        (reg) =>
          reg.madrasaData &&
          (reg.madrasaData.id === selectedMadrasa ||
            reg.madrasaData.madarsaId === selectedMadrasa),
      );
    }

    return filtered;
  }, [
    enrichedRegistrations,
    selectedGender,
    selectedMekhala,
    filterDistrict,
    selectedMadrasa,
    districts,
  ]);

  // Calculate stats using server count + client filtered data
  const stats = useMemo(() => {
    const totalRegistrations = totalCount;
    const completedPayments = totalCount;
    const pendingPayments = 0; // We only fetch completed/waived

    // Calculate revenue from current page data (approximation)
    const totalRevenue = filteredRegistrations.reduce((sum, r) => {
      const exam = exams.find((e) => e.id === r.examId);
      return sum + (parseFloat(exam?.fees || r.examFees) || 0);
    }, 0);

    return {
      totalRegistrations,
      completedPayments,
      pendingPayments,
      totalRevenue,
    };
  }, [totalCount, filteredRegistrations, exams]);

  // Cascading filter: When mekhala changes, filter madrasas based on mekhala.districts array
  useEffect(() => {
    if (selectedMekhala && selectedMekhala !== "all") {
      // Find the selected mekhala
      const mekhala = mekhalas.find((m) => m.id === selectedMekhala);

      if (mekhala && Array.isArray(mekhala.districts)) {
        // Get madrasas where madrasa.district is in mekhala.districts array
        const madrasasForMekhala = madrasas.filter((m) =>
          mekhala.districts.some(
            (d) => d.toUpperCase() === m.district?.toUpperCase(),
          ),
        );
        setFilteredMadrasas(madrasasForMekhala);

        // For backwards compatibility, keep districts filter (though not directly used)
        setFilteredDistricts(districts);
      } else {
        setFilteredMadrasas([]);
        setFilteredDistricts([]);
      }
    } else {
      setFilteredMadrasas(madrasas);
      setFilteredDistricts(districts);
    }
    // Reset district and madrasa selection when mekhala changes
    setFilterDistrict("all");
    setSelectedMadrasa("all");
  }, [selectedMekhala, madrasas, districts, mekhalas]);

  // Cascading filter: When district changes, filter madrasas
  useEffect(() => {
    if (filterDistrict && filterDistrict !== "all") {
      // Find the district object to get its name
      const districtObj = districts.find((d) => d.id === filterDistrict);
      if (districtObj) {
        // Filter madrasas where district field matches the district name
        const filtered = madrasas.filter(
          (madarsa) => madarsa.district === districtObj.name,
        );
        setFilteredMadrasas(filtered);
      }
    } else if (selectedMekhala && selectedMekhala !== "all") {
      // If district is "all" but mekhala is selected, restore mekhala-filtered madrasas
      const mekhalaDistricts = districts.filter(
        (d) => d.mekhalaId === selectedMekhala,
      );
      const districtNames = mekhalaDistricts.map((d) => d.name);

      const madrasasForMekhala = madrasas.filter((m) =>
        districtNames.includes(m.district),
      );
      setFilteredMadrasas(madrasasForMekhala);
    } else {
      // Both mekhala and district are "all"
      setFilteredMadrasas(madrasas);
    }
    // Reset madarsa selection when district changes
    setSelectedMadrasa("all");
  }, [filterDistrict, madrasas, selectedMekhala, districts]);

  // Get available mekhalas from enriched registrations only
  const getAvailableMekhalas = () => {
    const mekhalaIds = [
      ...new Set(enrichedRegistrations.map((r) => r.mekhalaId).filter(Boolean)),
    ];
    return mekhalas.filter((m) => mekhalaIds.includes(m.id));
  };

  // Get available madrasas based on selected mekhala from enriched data
  const getAvailableMadrasas = () => {
    let filtered = enrichedRegistrations;

    if (selectedMekhala !== "all") {
      filtered = filtered.filter((r) => r.mekhalaId === selectedMekhala);
    }

    const madrasaIds = [
      ...new Set(filtered.map((r) => r.studentData?.madarsaId).filter(Boolean)),
    ];
    return madrasas.filter(
      (m) => madrasaIds.includes(m.id) || madrasaIds.includes(m.madarsaId),
    );
  };

  // Get available classes based on selected mekhala and madrasa from enriched data
  const getAvailableClasses = () => {
    let filtered = enrichedRegistrations;

    if (selectedMekhala !== "all") {
      filtered = filtered.filter((r) => r.mekhalaId === selectedMekhala);
    }

    if (selectedMadrasa !== "all") {
      filtered = filtered.filter((r) => {
        const madrasaData = r.madrasaData;
        return (
          madrasaData &&
          (madrasaData.id === selectedMadrasa ||
            madrasaData.madarsaId === selectedMadrasa)
        );
      });
    }

    const classes = [
      ...new Set(
        filtered.map((r) => r.studentData?.classLevel).filter(Boolean),
      ),
    ];
    return classes.sort((a, b) => a - b);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedExam("all");
    setSelectedStatus("all");
    setSelectedGender("all");
    setSelectedMekhala("all");
    setFilterDistrict("all");
    setSelectedMadrasa("all");
    setSelectedClass("all");
  };

  // Export function using streaming approach for large datasets
  const exportRegistrations = async () => {
    setExportingCSV(true);
    try {
      const filters = {
        examId: selectedExam !== "all" ? selectedExam : null,
        classLevel: selectedClass !== "all" ? selectedClass : null,
        paymentStatus: ["completed", "waived"],
      };

      const totalExported = await exportRegistrationsToCSV(
        filters,
        exams,
        (progress) => {
          console.log(`Exported ${progress} registrations...`);
        },
      );

      toast.success(`Successfully exported ${totalExported} registrations`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export registrations");
    } finally {
      setExportingCSV(false);
    }
  };

  // Bulk download hall tickets
  const handleBulkDownloadHallTickets = async () => {
    if (filteredRegistrations.length === 0) {
      toast.error("No registrations to download");
      return;
    }

    setDownloadingBulkHallTickets(true);
    toast.info(`Preparing ${filteredRegistrations.length} hall tickets...`);

    try {
      const { jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;

      const doc = new jsPDF("p", "mm", "a4");
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();

      // Temporary container for HT generation
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.width = "210mm";
      container.style.backgroundColor = "white";
      container.style.padding = "10mm";
      document.body.appendChild(container);

      for (let i = 0; i < filteredRegistrations.length; i++) {
        const registration = filteredRegistrations[i];

        // Use registration data, enriched with student data
        const exam = exams.find((e) => e.id === registration.examId);
        const student = registration.studentData;

        // Prepare data using helper
        const hallTicketData = await prepareHallTicketData(
          registration,
          exam,
          student,
        );

        // Render HTML
        container.innerHTML = generateHallTicketHTML(hallTicketData);

        // Wait for images to load
        const images = container.querySelectorAll("img");
        await Promise.all(
          Array.from(images).map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          }),
        );

        // Generate canvas
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
        });

        const imgData = canvas.toDataURL("image/png");

        // Add page if not first
        if (i > 0) doc.addPage();

        // Add image to PDF
        doc.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      }

      document.body.removeChild(container);

      // Save
      const filename = `Batch_Hall_Tickets_${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      doc.save(filename);
      toast.success("Bulk hall tickets downloaded successfully");
    } catch (error) {
      console.error("Bulk download error:", error);
      toast.error("Failed to generate bulk hall tickets");
    } finally {
      setDownloadingBulkHallTickets(false);
    }
  };

  // Edit registration functions
  const handleEditRegistration = (registration) => {
    setEditingRegistration(registration);
    setEditForm({
      studentName: registration.studentName || "",
      studentEmail: registration.studentEmail || "",
      studentPhone: registration.studentPhone || "",
      paymentStatus: registration.paymentStatus || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingRegistration) return;

    setEditSubmitting(true);
    try {
      const updatedData = {
        ...editForm,
        updatedAt: new Date(),
      };

      // Update the registration in Firestore
      await updateDocument(
        COLLECTIONS.EXAM_REGISTRATIONS,
        editingRegistration.id,
        updatedData,
      );

      // Update local state
      setExamRegistrations((prev) =>
        prev.map((reg) =>
          reg.id === editingRegistration.id ? { ...reg, ...updatedData } : reg,
        ),
      );

      setIsEditDialogOpen(false);
      setEditingRegistration(null);
      alert("Registration updated successfully!");
    } catch (error) {
      console.error("Error updating registration:", error);
      alert("Failed to update registration. Please try again.");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Delete registration functions
  const handleDeleteRegistration = (registration) => {
    setDeletingRegistration(registration);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteRegistration = async () => {
    if (!deletingRegistration) return;

    try {
      await deleteDoc(docRef(db, "examRegistrations", deletingRegistration.id));
      toast.success("Registration deleted successfully");
      setIsDeleteDialogOpen(false);
      setDeletingRegistration(null);
      // Refresh data
      await fetchExamRegistrations();
    } catch (error) {
      console.error("Error deleting registration:", error);
      toast.error("Failed to delete registration");
    }
  };

  // Generate Hall Ticket for individual student
  const handleGenerateHallTicket = async (registration, exam, student) => {
    console.log("handleGenerateHallTicket called with:", {
      registration,
      exam,
      student,
    });

    // If exam is not found in exams array, try to use data from registration
    let examData = exam;
    if (!examData) {
      // Use exam data from registration object
      examData = {
        id: registration.examId,
        title: registration.examTitle || "Unknown Exam",
        examDate: registration.examDate,
        fees: registration.examFees || 0,
      };
      console.log("Using exam data from registration:", examData);
    }

    try {
      // If student data not available, fetch it individually
      let studentData = student;
      if (!studentData) {
        console.log("Student data not loaded, fetching individually...");
        try {
          const studentRef = docRef(
            db,
            COLLECTIONS.STUDENTS,
            registration.studentId,
          );
          const studentSnap = await getDoc(studentRef);
          if (studentSnap.exists()) {
            studentData = { id: studentSnap.id, ...studentSnap.data() };
          } else {
            toast.error("Student data not found");
            return;
          }
        } catch (error) {
          console.error("Error fetching student:", error);
          toast.error("Failed to load student data");
          return;
        }
      }

      // Prepare hall ticket data
      const hallTicketData = await prepareHallTicketData(
        registration,
        examData,
        studentData,
      );

      console.log("Generated hall ticket data:", hallTicketData);

      // Generate PDF directly instead of dialog
      const { jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;

      const doc = new jsPDF("p", "mm", "a4");

      // Create a temporary container for the hall ticket HTML
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.width = "210mm"; // A4 width
      container.style.backgroundColor = "white";
      container.style.padding = "10mm";

      // Build the hall ticket HTML using helper function
      container.innerHTML = generateHallTicketHTML(hallTicketData);

      document.body.appendChild(container);

      // Wait for images to load
      const images = container.querySelectorAll("img");
      await Promise.all(
        Array.from(images).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }),
      );

      // Convert to canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      // Remove temporary container
      document.body.removeChild(container);

      // Add to PDF
      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();

      doc.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

      // Save the PDF
      const fileName = `hall_ticket_${hallTicketData.admissionNumber}_${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      doc.save(fileName);

      toast.success("Hall ticket downloaded successfully");
    } catch (error) {
      console.error("Error generating hall ticket:", error);
      toast.error("Failed to generate hall ticket");
    }
  };

  // Manual Hall Ticket Functions
  const handleRollNumberSearch = async (rollNumber) => {
    if (!rollNumber.trim()) return;

    try {
      // Search student in Firestore directly
      const studentsRef = collection(db, COLLECTIONS.STUDENTS);
      const q = query(
        studentsRef,
        where("admissionNumber", "==", rollNumber.trim()),
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const student = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

        // Get profile picture from student or application
        const profilePictureUrl = await getProfilePicture(
          student,
          student.admissionNumber,
          student.madarsaId,
        );

        // Auto-fill form with student data
        setManualHallTicketForm((prev) => ({
          ...prev,
          fullName: student.fullName || "",
          gender: student.gender || "",
          admissionNumber: student.admissionNumber || "",
          classLevel: student.classLevel || "",
          madarsa: student.madarsaId || "",
          guardianPhone: student.guardianPhone || "",
          dateOfBirth: student.dateOfBirth || "",
          profilePictureUrl: profilePictureUrl,
        }));
        toast.success("Student details auto-filled");
      } else {
        toast.error("Student not found with this roll number");
      }
    } catch (error) {
      console.error("Error searching student:", error);
      toast.error("Failed to search student");
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    try {
      setUploadingPhoto(true);
      const imageUrl = await uploadToCloudinary(file);
      setManualHallTicketForm((prev) => ({
        ...prev,
        profilePictureUrl: imageUrl,
      }));
      toast.success("Photo uploaded successfully");
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleManualHallTicketSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!manualHallTicketForm.fullName || !manualHallTicketForm.examId) {
      toast.error("Please fill in all required fields");
      return;
    }

    setManualHallTicketSubmitting(true);
    try {
      // Get exam details
      const selectedExam = exams.find(
        (e) => e.id === manualHallTicketForm.examId,
      );
      if (!selectedExam) {
        toast.error("Selected exam not found");
        return;
      }

      // Generate hall ticket number if not provided
      const hallTicketNumber =
        manualHallTicketForm.hallTicketNumber ||
        generateHallTicketNumber(
          manualHallTicketForm.examId,
          manualHallTicketForm.admissionNumber,
          manualHallTicketForm.classLevel,
        );

      // Prepare data for display
      const hallTicketData = {
        ...manualHallTicketForm,
        hallTicketNumber,
        examTitle: selectedExam.examTitle || "N/A",
        examDate: selectedExam.examDate,
        examFees: manualHallTicketForm.examFees || selectedExam.fees || 0,
        createdAt: new Date(),
        madarsa: manualHallTicketForm.madarsa || selectedExam.madarsa || "N/A",
        madarsaId: manualHallTicketForm.madarsaId || null,
        mekhala: manualHallTicketForm.mekhala || "N/A",
        sadar: manualHallTicketForm.sadar || "N/A",
      };

      setManualHallTicketData(hallTicketData);
      setIsManualHallTicketDialogOpen(false);

      // Open the hall ticket display dialog
      setTimeout(() => {
        setIsManualHallTicketDialogOpen(true);
      }, 100);

      toast.success("Hall ticket prepared successfully");
    } catch (error) {
      console.error("Error preparing hall ticket:", error);
      toast.error("Failed to prepare hall ticket");
    } finally {
      setManualHallTicketSubmitting(false);
    }
  };

  // Helper: Convert class number to Roman numeral
  const toRomanIfNumber = toRomanUtil;

  // Helper: Prepare hall ticket data for a single registration
  const prepareHallTicketData = async (registration, exam, student) => {
    // Generate hall ticket number
    const hallTicketNumber =
      registration.hallTicketNumber ||
      generateHallTicketNumber(
        registration.examId,
        registration.studentId,
        student?.classLevel,
      );

    // Get profile picture (exactly like HallTicket component)
    const profilePictureUrl = await getProfilePicture(
      student,
      registration.admissionNumber || student?.admissionNumber,
      student?.madarsaId || registration.madarsaId,
    );

    // Get madarsaId - this is what HallTicket component uses to fetch mekhala/sadar dynamically
    const madarsaId = student?.madarsaId || registration.madarsaId || null;

    // Fetch madarsa details to get mekhala and sadar information
    let mekhala = "N/A";
    let sadarName = "N/A";
    let sadarAddress = "N/A";

    if (madarsaId) {
      try {
        const madarsasRef = collection(db, "madarsas");
        const q = query(madarsasRef, where("madarsaId", "==", madarsaId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const madarsaData = querySnapshot.docs[0].data();
          mekhala = madarsaData.district || "N/A";
          sadarName = madarsaData.adminName || "N/A";
          sadarAddress = madarsaData.address || "N/A";
        }
      } catch (error) {
        console.error("Error fetching madarsa details for hall ticket:", error);
      }
    }

    // Fetch exam timetable (use exam's timetableEntries)
    let timetableEntries = [];
    if (exam?.timetableEntries && exam.timetableEntries.length > 0) {
      timetableEntries = exam.timetableEntries;
    }

    return {
      hallTicketNumber,
      examTitle: registration.examTitle || "N/A",
      fullName: registration.studentName || student?.fullName || "N/A",
      middleName: student?.middleName || student?.midNumber || "",
      midNumber: student?.midNumber || "",
      admissionNumber:
        registration.admissionNumber || student?.admissionNumber || "N/A",
      classLevel: student?.classLevel || exam?.class || "N/A",
      gender: student?.gender
        ? student.gender.charAt(0).toUpperCase() +
          student.gender.slice(1).toLowerCase()
        : "N/A",
      guardianPhone:
        registration.studentPhone || student?.guardianPhone || "N/A",
      dateOfBirth: student?.dateOfBirth || registration.dateOfBirth || "N/A",
      madarsa: student?.madarsaId || registration.madarsaId || "N/A",
      madarsaId: madarsaId,
      mekhala: mekhala,
      sadarName: sadarName,
      sadarAddress: sadarAddress,
      examDate: exam?.examDate || registration.examDate,
      createdAt: registration.createdAt,
      profilePictureUrl,
      examFees: registration.examFees || exam?.fees || 0,
      subject: exam?.subject || "N/A",
      duration: exam?.duration || "N/A",
      rulesAndRegulations: exam?.rulesAndRegulations || "",
      notice: exam?.notice || "",
      timetableEntries: timetableEntries,
    };
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading registrations...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Paid Exam Registrations
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            View and manage student exam registrations with completed payments
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-teal-500 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Paid Registrations
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {stats.totalRegistrations}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Completed Payments
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {stats.completedPayments}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <Filter className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Pending Payments
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {stats.pendingPayments}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <IndianRupee className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 flex-shrink-0" />
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    Total Revenue
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    ₹{stats.totalRevenue}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg sm:text-xl">
                Filter Registrations
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  onClick={() => setIsManualHallTicketDialogOpen(true)}
                  className="bg-teal-500 hover:bg-blue-700 w-full sm:w-auto"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="sm:hidden">Manual Hall Ticket</span>
                  <span className="hidden sm:inline">
                    Create Manual Hall Ticket
                  </span>
                </Button>
                <Button
                  onClick={handleBulkDownloadHallTickets}
                  className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto"
                  disabled={
                    downloadingBulkHallTickets ||
                    enrichedRegistrations.length === 0
                  }
                  size="sm"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  {downloadingBulkHallTickets ? (
                    <span>Generating...</span>
                  ) : (
                    <>
                      <span className="sm:hidden">Bulk Hall Tickets</span>
                      <span className="hidden sm:inline">
                        Download Hall Tickets{" "}
                        {selectedMekhala !== "all" ? "(Bulk)" : "(All)"}
                      </span>
                    </>
                  )}
                </Button>
                <Button
                  onClick={exportRegistrations}
                  className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                  disabled={exportingCSV}
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exportingCSV ? (
                    <span>Exporting...</span>
                  ) : (
                    <>
                      <span className="sm:hidden">Export</span>
                      <span className="hidden sm:inline">Export CSV</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Clear Filters Button */}
            <div className="flex justify-end mb-3">
              <Button
                onClick={clearAllFilters}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear All Filters
              </Button>
            </div>

            {/* Exam Filter (separate from StudentFilters) */}
            <div className="mb-4">
              <Label htmlFor="exam-filter" className="text-sm">
                Filter by Exam
              </Label>
              <Select value={selectedExam} onValueChange={setSelectedExam}>
                <SelectTrigger className="mt-1">
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

            {/* StudentFilters Component */}
            <StudentFilters
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterMahal={selectedMadrasa}
              setFilterMahal={setSelectedMadrasa}
              filterMekhala={selectedMekhala}
              setFilterMekhala={setSelectedMekhala}
              filterDistrict={filterDistrict}
              setFilterDistrict={setFilterDistrict}
              filterGender={selectedGender}
              setFilterGender={setSelectedGender}
              filterClass={selectedClass}
              setFilterClass={setSelectedClass}
              filterStatus={selectedStatus}
              setFilterStatus={setSelectedStatus}
              madarsas={filteredMadrasas}
              mekhalas={mekhalas}
              districts={filteredDistricts}
              classes={classes}
              loading={loading}
              searchLoading={false}
            />

            {/* Search Results Indicator */}
            {searchTerm && searchTerm.trim() && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <span className="text-sm font-medium text-blue-900">
                      Searching for: &ldquo;{searchTerm}&rdquo;
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-800"
                  >
                    {totalCount} result{totalCount !== 1 ? "s" : ""} found
                  </Badge>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  Showing results from up to 1,000 most recent registrations
                </p>
              </div>
            )}

            {loadingPage && (
              <div className="mt-3 text-sm text-gray-500 flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-teal-500" />
                <span>Loading registrations...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Registrations List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Student Registrations ({filteredRegistrations.length})
            </CardTitle>
            <CardDescription>
              All student registrations for exams
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPage ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading registrations...</p>
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  No registrations match your filters
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRegistrations.map((registration) => {
                  const exam = exams.find((e) => e.id === registration.examId);
                  return (
                    <div
                      key={registration.id}
                      className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                            <h4 className="font-semibold text-base sm:text-lg truncate">
                              {registration.studentName}
                            </h4>
                            <Badge
                              variant={
                                registration.paymentStatus === "completed"
                                  ? "default"
                                  : "secondary"
                              }
                              className="self-start sm:self-center"
                            >
                              {registration.paymentStatus === "waived"
                                ? "Waived"
                                : registration.paymentStatus === "completed"
                                  ? "Paid"
                                  : "Pending"}
                            </Badge>
                          </div>

                          <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                              <p>
                                <strong>Email:</strong>{" "}
                                <span className="break-all">
                                  {registration.studentEmail}
                                </span>
                              </p>
                              <p>
                                <strong>Phone:</strong>{" "}
                                {registration.studentPhone ||
                                  registration.studentData?.phone ||
                                  "N/A"}
                              </p>
                              <p>
                                <strong>Gender:</strong>{" "}
                                {registration.studentData?.gender || "N/A"}
                              </p>
                              <p>
                                <strong>Class:</strong>{" "}
                                {registration?.classLevel || "N/A"}
                              </p>
                              <p>
                                <strong>Amount:</strong> ₹
                                {registration.examFees || exam?.fees || 0}
                              </p>
                              <p>
                                <strong>Madrasa:</strong>{" "}
                                {registration.madrasaData?.name ||
                                  registration.madrasaData?.madarsaName ||
                                  registration.madarsaId ||
                                  "N/A"}
                              </p>
                              <p>
                                <strong>Madrasa ID:</strong>{" "}
                                {registration.madrasaData?.madarsaId ||
                                  registration.madarsaId ||
                                  "N/A"}
                              </p>
                              <p>
                                <strong>District:</strong>{" "}
                                {registration.districtName ||
                                  registration.madrasaData?.district ||
                                  "N/A"}
                              </p>
                              <p>
                                <strong>Mekhala:</strong>{" "}
                                {registration.mekhalaName ||
                                  registration.madrasaData?.mekhala ||
                                  "N/A"}
                              </p>
                            </div>
                            <p>
                              <strong>Exam:</strong>{" "}
                              <span className="break-words">
                                {exam?.title ||
                                  registration.examTitle ||
                                  "Unknown Exam"}
                              </span>
                            </p>
                            <p>
                              <strong>Registered:</strong>{" "}
                              {formatDate(registration.createdAt)}
                            </p>
                            {registration.paymentId && (
                              <p className="break-all">
                                <strong>Payment ID:</strong>{" "}
                                {registration.paymentId}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-left sm:text-right flex-shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                          <div className="flex flex-col items-start sm:items-end gap-2">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleEditRegistration(registration)
                                }
                                className="flex items-center gap-1"
                              >
                                <Edit className="h-3 w-3" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleDeleteRegistration(registration)
                                }
                                className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              >
                                <Trash className="h-3 w-3" />
                                <span className="hidden sm:inline">Delete</span>
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() =>
                                  handleGenerateHallTicket(
                                    registration,
                                    exam,
                                    registration.studentData,
                                  )
                                }
                                className="flex items-center gap-1 bg-teal-500 hover:bg-blue-700"
                              >
                                <Download className="h-3 w-3" />
                                <span className="hidden sm:inline">
                                  Hall Ticket
                                </span>
                                <span className="sm:hidden">Ticket</span>
                              </Button>
                            </div>
                            <div className="text-xs sm:text-sm text-gray-500 space-y-1">
                              <div>
                                <strong>Student ID:</strong>{" "}
                                {registration.studentId || "N/A"}
                              </div>
                              {registration.applicationId && (
                                <div>
                                  <strong>App ID:</strong>{" "}
                                  {registration.applicationId}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {Math.ceil(totalCount / itemsPerPage) > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}{" "}
              registrations
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex items-center space-x-1">
                {Array.from(
                  { length: Math.min(5, Math.ceil(totalCount / itemsPerPage)) },
                  (_, i) => {
                    const totalPagesCalc = Math.ceil(totalCount / itemsPerPage);
                    const pageNum =
                      Math.max(
                        1,
                        Math.min(totalPagesCalc - 4, currentPage - 2),
                      ) + i;
                    if (pageNum > totalPagesCalc) return null;

                    return (
                      <Button
                        key={pageNum}
                        variant={
                          currentPage === pageNum ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  },
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.min(prev + 1, Math.ceil(totalCount / itemsPerPage)),
                  )
                }
                disabled={currentPage === Math.ceil(totalCount / itemsPerPage)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete this registration?
              </p>
              {deletingRegistration && (
                <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Student:</span>{" "}
                    {deletingRegistration.studentName}
                  </p>
                  <p>
                    <span className="font-medium">Exam:</span>{" "}
                    {deletingRegistration.examTitle}
                  </p>
                  <p>
                    <span className="font-medium">Email:</span>{" "}
                    {deletingRegistration.studentEmail}
                  </p>
                </div>
              )}
              <p className="text-sm text-red-600 font-medium">
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDeleteDialogOpen(false);
                    setDeletingRegistration(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDeleteRegistration}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete Registration
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Registration Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Edit Registration</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-student-name">Student Name</Label>
                <Input
                  id="edit-student-name"
                  value={editForm.studentName}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      studentName: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-student-email">Email</Label>
                <Input
                  id="edit-student-email"
                  type="email"
                  value={editForm.studentEmail}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      studentEmail: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-student-phone">Phone</Label>
                <Input
                  id="edit-student-phone"
                  value={editForm.studentPhone}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      studentPhone: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="edit-payment-status">Payment Status</Label>
                <Select
                  value={editForm.paymentStatus}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, paymentStatus: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="waived">Waived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={editSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editSubmitting}>
                  {editSubmitting ? "Updating..." : "Update Registration"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete this registration?
              </p>
              {deletingRegistration && (
                <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Student:</span>{" "}
                    {deletingRegistration.studentName}
                  </p>
                  <p>
                    <span className="font-medium">Exam:</span>{" "}
                    {deletingRegistration.examTitle}
                  </p>
                  <p>
                    <span className="font-medium">Email:</span>{" "}
                    {deletingRegistration.studentEmail}
                  </p>
                </div>
              )}
              <p className="text-sm text-red-600 font-medium">
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDeleteDialogOpen(false);
                    setDeletingRegistration(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDeleteRegistration}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete Registration
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manual Hall Ticket Dialog */}
        <Dialog
          open={isManualHallTicketDialogOpen}
          onOpenChange={setIsManualHallTicketDialogOpen}
        >
          <DialogContent className="sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Manual Hall Ticket</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleManualHallTicketSubmit} className="space-y-4">
              {/* Roll Number Search */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="roll-number">
                    Roll Number (Admission No.)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="roll-number"
                      value={manualHallTicketForm.rollNumber}
                      onChange={(e) =>
                        setManualHallTicketForm((prev) => ({
                          ...prev,
                          rollNumber: e.target.value,
                        }))
                      }
                      placeholder="Enter admission number"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        handleRollNumberSearch(manualHallTicketForm.rollNumber)
                      }
                      disabled={!manualHallTicketForm.rollNumber.trim()}
                    >
                      Search
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Search to auto-fill student details
                  </p>
                </div>

                <div>
                  <Label htmlFor="hall-ticket-number">
                    Hall Ticket Number (Optional)
                  </Label>
                  <Input
                    id="hall-ticket-number"
                    value={manualHallTicketForm.hallTicketNumber}
                    onChange={(e) =>
                      setManualHallTicketForm((prev) => ({
                        ...prev,
                        hallTicketNumber: e.target.value,
                      }))
                    }
                    placeholder="Auto-generated if empty"
                  />
                </div>
              </div>

              {/* Student Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full-name">Full Name *</Label>
                  <Input
                    id="full-name"
                    value={manualHallTicketForm.fullName}
                    onChange={(e) =>
                      setManualHallTicketForm((prev) => ({
                        ...prev,
                        fullName: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="gender">Gender *</Label>
                  <Select
                    value={manualHallTicketForm.gender}
                    onValueChange={(value) =>
                      setManualHallTicketForm((prev) => ({
                        ...prev,
                        gender: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="admission-number">Admission Number</Label>
                  <Input
                    id="admission-number"
                    value={manualHallTicketForm.admissionNumber}
                    onChange={(e) =>
                      setManualHallTicketForm((prev) => ({
                        ...prev,
                        admissionNumber: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="class-level">Class Level</Label>
                  <Input
                    id="class-level"
                    value={manualHallTicketForm.classLevel}
                    onChange={(e) =>
                      setManualHallTicketForm((prev) => ({
                        ...prev,
                        classLevel: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="madarsa">Madarsa</Label>
                  <Input
                    id="madarsa"
                    value={manualHallTicketForm.madarsa}
                    onChange={(e) =>
                      setManualHallTicketForm((prev) => ({
                        ...prev,
                        madarsa: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="madarsaId">Madarsa ID</Label>
                  <Input
                    id="madarsaId"
                    placeholder="e.g., mid-1400"
                    value={manualHallTicketForm.madarsaId}
                    onChange={(e) =>
                      setManualHallTicketForm((prev) => ({
                        ...prev,
                        madarsaId: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="guardian-phone">Guardian Phone</Label>
                  <Input
                    id="guardian-phone"
                    value={manualHallTicketForm.guardianPhone}
                    onChange={(e) =>
                      setManualHallTicketForm((prev) => ({
                        ...prev,
                        guardianPhone: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mekhala">Mekhala</Label>
                  <Input
                    id="mekhala"
                    placeholder="Enter mekhala"
                    value={manualHallTicketForm.mekhala}
                    onChange={(e) =>
                      setManualHallTicketForm((prev) => ({
                        ...prev,
                        mekhala: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="sadar">Sadar</Label>
                  <Input
                    id="sadar"
                    placeholder="Enter sadar"
                    value={manualHallTicketForm.sadar}
                    onChange={(e) =>
                      setManualHallTicketForm((prev) => ({
                        ...prev,
                        sadar: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Photo Upload */}
              <div>
                <Label htmlFor="photo-upload">Photo Upload</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    id="photo-upload"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    disabled={uploadingPhoto}
                  />
                  {uploadingPhoto && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-500"></div>
                      <span className="text-sm text-teal-500">
                        Uploading photo...
                      </span>
                    </div>
                  )}
                  {manualHallTicketForm.profilePictureUrl && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Image
                          src="/check-icon.png"
                          alt="Check"
                          className="h-4 w-4 text-green-600"
                          width={16}
                          height={16}
                        />
                        <span className="text-sm text-green-600 font-medium">
                          Photo uploaded successfully
                        </span>
                      </div>
                      <div className="w-24 h-32 border-2 border-gray-300 flex items-center justify-center rounded-lg bg-gray-50">
                        <Image
                          src={manualHallTicketForm.profilePictureUrl}
                          alt="Student Photo"
                          width={96}
                          height={128}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Exam Selection */}
              <div>
                <Label htmlFor="exam-select">Select Exam *</Label>
                <Select
                  value={manualHallTicketForm.examId}
                  onValueChange={(value) => {
                    const selectedExam = exams.find((e) => e.id === value);
                    setManualHallTicketForm((prev) => ({
                      ...prev,
                      examId: value,
                      examTitle: selectedExam?.title || "",
                      examDate: selectedExam?.examDate || "",
                      examFees: selectedExam?.fees || "",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select exam" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {exams.map((exam) => (
                      <SelectItem key={exam.id} value={exam.id}>
                        {exam.title} - ({exam.class})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Exam Details Display */}
              {manualHallTicketForm.examId && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Exam Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Title:</span>{" "}
                      {manualHallTicketForm.examTitle}
                    </div>
                    <div>
                      <span className="font-medium">Date:</span>{" "}
                      {manualHallTicketForm.examDate
                        ? formatDate(manualHallTicketForm.examDate)
                        : "N/A"}
                    </div>
                    <div>
                      <span className="font-medium">Fees:</span> ₹
                      {manualHallTicketForm.examFees || 0}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsManualHallTicketDialogOpen(false);
                    setManualHallTicketForm({
                      rollNumber: "",
                      fullName: "",
                      gender: "",
                      admissionNumber: "",
                      classLevel: "",
                      madarsa: "",
                      madarsaId: "",
                      mekhala: "",
                      sadar: "",
                      guardianPhone: "",
                      profilePictureUrl: "",
                      examId: "",
                      examTitle: "",
                      examDate: "",
                      examFees: "",
                      hallTicketNumber: "",
                    });
                  }}
                  disabled={manualHallTicketSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={manualHallTicketSubmitting}>
                  {manualHallTicketSubmitting
                    ? "Preparing..."
                    : "Preview Hall Ticket"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Hall Ticket Display Dialog */}
        <Dialog
          open={!!manualHallTicketData}
          onOpenChange={(open) => {
            if (!open) setManualHallTicketData(null);
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white print:max-w-none print:max-h-none print:overflow-visible print:p-0 print:m-0">
            <DialogHeader className="print:hidden">
              <DialogTitle>Hall Ticket</DialogTitle>
            </DialogHeader>

            {manualHallTicketData && (
              <div id="hall-ticket-content" className="space-y-6">
                <HallTicket
                  data={{
                    hallTicketNumber: manualHallTicketData.hallTicketNumber,
                    examTitle: manualHallTicketData.examTitle,
                    fullName: manualHallTicketData.fullName,
                    middleName:
                      manualHallTicketData.middleName ||
                      manualHallTicketData.midNumber,
                    midNumber: manualHallTicketData.midNumber,
                    admissionNumber: manualHallTicketData.admissionNumber,
                    classLevel: manualHallTicketData.classLevel,
                    gender: manualHallTicketData.gender,
                    guardianPhone: manualHallTicketData.guardianPhone,
                    madarsa: manualHallTicketData.madarsa,
                    madarsaId: manualHallTicketData.madarsaId,
                    mekhala: manualHallTicketData.mekhala,
                    sadar: manualHallTicketData.sadar,
                    examDate: manualHallTicketData.examDate,
                    createdAt: manualHallTicketData.createdAt,
                    profilePictureUrl: manualHallTicketData.profilePictureUrl,
                  }}
                  formatDate={formatDate}
                />

                <div className="text-center print:hidden">
                  <Button
                    onClick={() => window.print()}
                    className="bg-teal-500 hover:bg-blue-700 text-white px-8 py-2"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Hall Ticket
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">
                    Please print this hall ticket and bring it to the
                    examination center
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
