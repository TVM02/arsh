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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileSpreadsheet,
  Download,
  Filter,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { getDocuments, COLLECTIONS } from "@/lib/firestoreService";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as XLSX from "xlsx";

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

// Helper function to get madrasa name
const getMadrasaName = (madrasaId, madrasasList) => {
  if (!madrasaId) return "N/A";
  const madrasa = madrasasList.find(
    (m) => m.id === madrasaId || m.madarsaId === madrasaId,
  );
  return madrasa?.name || madrasaId;
};

// Helper function to get mekhala name by matching district/region
const getMekhalaNameByDistrict = (madrasaId, madrasasList, mekhalasList) => {
  if (!madrasaId) return "N/A";

  // Find the madarsa
  const madarsa = madrasasList.find(
    (m) => m.id === madrasaId || m.madarsaId === madrasaId,
  );

  if (!madarsa || !madarsa.district) return "N/A";

  // Find mekhala by matching district with region (case-insensitive)
  const mekhala = mekhalasList.find(
    (m) => m.region?.toLowerCase() === madarsa.district.toLowerCase(),
  );

  return mekhala?.name || madarsa.district || "N/A";
};

// Helper function to normalize class level (treat UKG variations as same)
const normalizeClassLevel = (classLevel) => {
  if (!classLevel) return "N/A";
  const normalized = classLevel.toString().toUpperCase().trim();
  // Normalize UKG variations to canonical "Ukg"
  if (
    normalized === "UKG" ||
    normalized === "U.K.G" ||
    normalized === "U.K.G."
  ) {
    return "Ukg";
  }
  return classLevel;
};

// Helper function to get class sort order (Ukg = 0, 1-12 = 1-12, others = 999)
const getClassSortOrder = (classLevel) => {
  if (!classLevel) return 999;
  const normalized = normalizeClassLevel(classLevel)
    .toString()
    .toUpperCase()
    .trim();

  // Ukg comes first
  if (normalized === "UKG") return 0;

  // LKG comes before Ukg if it exists
  if (normalized === "LKG" || normalized === "L.K.G" || normalized === "L.K.G.")
    return -1;

  // Numeric classes 1-12
  const numClass = parseInt(normalized);
  if (!isNaN(numClass) && numClass >= 1 && numClass <= 12) {
    return numClass;
  }

  // Everything else goes to the end
  return 999;
};

// Helper function to sort registrations by class
const sortByClass = (data) => {
  return [...data].sort((a, b) => {
    const orderA = getClassSortOrder(a.classLevel);
    const orderB = getClassSortOrder(b.classLevel);
    return orderA - orderB;
  });
};

// Helper function to generate hall ticket number
const generateHallTicketNumber = (examId, studentId, classLevel) => {
  const baseId = studentId || "default";

  // Create a stable numeric hash
  let hash = 0;
  for (let i = 0; i < baseId.length; i++) {
    hash = (hash * 31 + baseId.charCodeAt(i)) >>> 0;
  }

  // Convert hash to 10-digit number
  let number = (hash % 1_000_000_0000) // 10 digits max range
    .toString()
    .padStart(10, "0");

  number = "0" + number;

  return number;
};

export default function DataSheetPage() {
  const { user, role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [fetchingData, setFetchingData] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Data States
  const [exams, setExams] = useState([]);
  const [madrasas, setMadrasas] = useState([]);
  const [mekhalas, setMekhalas] = useState([]);
  const [classes, setClasses] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [enrichedData, setEnrichedData] = useState({}); // Cache enriched registrations by examId

  // Filter States
  const [selectedMekhala, setSelectedMekhala] = useState("all");
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [selectedMadrasa, setSelectedMadrasa] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedExam, setSelectedExam] = useState("");
  const [madrasaPopoverOpen, setMadrasaPopoverOpen] = useState(false);

  // Filtered madrasas based on mekhala selection
  const [filteredMadrasas, setFilteredMadrasas] = useState([]);
  const [filteredDistricts, setFilteredDistricts] = useState([]);

  // Statistics
  const [studentCount, setStudentCount] = useState(0);
  const [filteredData, setFilteredData] = useState([]);

  // Fetch all data
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // Fetch madrasas
        const madrasaQuery = query(
          collection(db, "madarsas"),
          orderBy("name", "asc"),
        );
        const madrasaSnapshot = await getDocs(madrasaQuery);
        const madrasaList = madrasaSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMadrasas(madrasaList);

        // Fetch districts
        const districtQuery = query(
          collection(db, "districts"),
          orderBy("name", "asc"),
        );
        const districtSnapshot = await getDocs(districtQuery);
        const districtList = districtSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDistricts(districtList);

        // Fetch mekhalas
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

        // Fetch exams
        const examConstraints = [orderBy("createdAt", "desc")];
        const examList = await getDocuments(COLLECTIONS.EXAMS, examConstraints);
        setExams(examList);

        // Fetch all students to get unique classes
        const studentConstraints = [orderBy("createdAt", "desc")];
        const studentList = await getDocuments(
          COLLECTIONS.STUDENTS,
          studentConstraints,
        );
        const activeStudents = studentList.filter(
          (student) => !student.deleted && student.status === "active",
        );

        // Get unique classes and normalize UKG variations
        const normalizedClasses = activeStudents
          .map((student) => normalizeClassLevel(student.classLevel))
          .filter(Boolean);

        const uniqueClasses = [...new Set(normalizedClasses)].sort((a, b) => {
          const orderA = getClassSortOrder(a);
          const orderB = getClassSortOrder(b);
          return orderA - orderB;
        });
        setClasses(uniqueClasses);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Helper function to enrich registration data
  const enrichRegistration = (registration, students, madrasas, mekhalas) => {
    // Find student
    const student = students.find((s) => s.id === registration.studentId);
    if (!student) return null;

    // Find madarsa
    const madarsaId = student.madarsaId || registration.madarsaId;
    const madarsa = madrasas.find(
      (m) => m.id === madarsaId || m.madarsaId === madarsaId,
    );

    // Find mekhala (priority: direct mekhalaId, fallback: district-region match)
    let mekhala = null;
    if (madarsa) {
      // Try direct match first
      if (madarsa.mekhalaId) {
        mekhala = mekhalas.find((m) => m.id === madarsa.mekhalaId);
      }
      // Fallback to district-region match
      if (!mekhala && madarsa.district) {
        mekhala = mekhalas.find(
          (m) => m.region?.toLowerCase() === madarsa.district.toLowerCase(),
        );
      }
    }

    return {
      ...registration,
      // Student data
      student: student,
      studentName: registration.studentName || student.fullName || "N/A",
      guardianName: student.guardianName || "N/A",
      midNumber: student.midNumber || student.admissionNumber || "N/A",
      classLevel: normalizeClassLevel(
        registration.classLevel || student.classLevel,
      ),
      // Madarsa data
      madarsaId: madarsaId,
      madarsaName: madarsa?.name || "N/A",
      district: madarsa?.district || "N/A",
      // Mekhala data
      mekhalaId: mekhala?.id || null,
      mekhalaName: mekhala?.name || madarsa?.district || "N/A",
    };
  };

  // Filter districts and madrasas based on mekhala selection
  useEffect(() => {
    if (selectedMekhala && selectedMekhala !== "all") {
      // Get districts assigned to this mekhala
      const mekhalaDistricts = districts.filter(
        (d) => d.mekhalaId === selectedMekhala,
      );
      const districtNames = mekhalaDistricts.map((d) => d.name);

      // Get madrasas in those districts
      const madrasasForMekhala = madrasas.filter((m) =>
        districtNames.includes(m.district),
      );

      setFilteredDistricts(mekhalaDistricts);
      setFilteredMadrasas(madrasasForMekhala);
    } else {
      setFilteredMadrasas(madrasas);
      setFilteredDistricts(districts);
    }
    // Reset district and madrasa selection when mekhala changes
    setSelectedDistrict("all");
    setSelectedMadrasa("all");
  }, [selectedMekhala, madrasas, mekhalas, districts]);

  // Filter madrasas based on district selection
  useEffect(() => {
    if (selectedDistrict && selectedDistrict !== "all") {
      // Find the district object to get its name
      const districtObj = districts.find((d) => d.id === selectedDistrict);
      if (districtObj) {
        // Filter madrasas where district field matches the district name
        const filtered = madrasas.filter(
          (madrasa) => madrasa.district === districtObj.name,
        );
        setFilteredMadrasas(filtered);
      }
    } else if (selectedMekhala && selectedMekhala !== "all") {
      // If district is "all" but mekhala is selected, restore mekhala-filtered madrasas
      // Get districts assigned to this mekhala
      const mekhalaDistricts = districts.filter(
        (d) => d.mekhalaId === selectedMekhala,
      );
      const districtNames = mekhalaDistricts.map((d) => d.name);

      // Get madrasas in those districts
      const madrasasForMekhala = madrasas.filter((m) =>
        districtNames.includes(m.district),
      );
      setFilteredMadrasas(madrasasForMekhala);
    } else {
      // Both mekhala and district are "all"
      setFilteredMadrasas(madrasas);
    }
    // Reset madrasa selection when district changes
    setSelectedMadrasa("all");
  }, [selectedDistrict, madrasas, selectedMekhala, districts]);

  // Fetch and enrich data when exam is selected
  useEffect(() => {
    const fetchAndEnrichData = async () => {
      if (!selectedExam) {
        return;
      }

      setFetchingData(true);

      // Check if already enriched
      if (enrichedData[selectedExam]) {
        console.log(
          "[Fetch] Using cached enriched data for exam:",
          selectedExam,
        );
        setFetchingData(false);
        return;
      }

      try {
        console.log(
          "[Fetch] Fetching and enriching data for exam:",
          selectedExam,
        );

        // Step 1: Fetch all registrations for the exam
        const registrations = await getDocuments(
          COLLECTIONS.EXAM_REGISTRATIONS,
          [where("examId", "==", selectedExam)],
        );

        console.log("[Fetch] Total registrations found:", registrations.length);

        // Step 2: Fetch all students
        const studentIds = [...new Set(registrations.map((r) => r.studentId))];
        const allStudents = [];

        // Fetch students in batches of 30 (Firestore 'in' limit)
        for (let i = 0; i < studentIds.length; i += 30) {
          const batch = studentIds.slice(i, i + 30);
          const studentsQuery = query(
            collection(db, COLLECTIONS.STUDENTS),
            where("__name__", "in", batch),
          );
          const studentsSnapshot = await getDocs(studentsQuery);
          studentsSnapshot.docs.forEach((doc) => {
            allStudents.push({ id: doc.id, ...doc.data() });
          });
        }

        console.log("[Fetch] Students fetched:", allStudents.length);

        // Step 3: Enrich registrations with student, madarsa, and mekhala data
        const enrichedRegistrations = registrations
          .map((reg) =>
            enrichRegistration(reg, allStudents, madrasas, mekhalas),
          )
          .filter(Boolean); // Remove null entries

        console.log(
          "[Fetch] Enriched registrations:",
          enrichedRegistrations.length,
        );

        // Cache the enriched data
        setEnrichedData((prev) => ({
          ...prev,
          [selectedExam]: enrichedRegistrations,
        }));
      } catch (error) {
        console.error("Error fetching and enriching data:", error);
      } finally {
        setFetchingData(false);
      }
    };

    fetchAndEnrichData();
  }, [selectedExam, madrasas, mekhalas]);

  // Filter cached enriched data when filters change
  useEffect(() => {
    const filterEnrichedData = () => {
      if (!selectedExam) {
        setStudentCount(0);
        setFilteredData([]);
        return;
      }

      // Get cached enriched data for the exam
      const enrichedRegistrations = enrichedData[selectedExam];
      if (!enrichedRegistrations) {
        setStudentCount(0);
        setFilteredData([]);
        return;
      }

      console.log(
        "[Count] Filtering cached data, total:",
        enrichedRegistrations.length,
      );

      // Apply filters on enriched data
      let filtered = enrichedRegistrations;

      // // Filter by mekhala (District filter)
      // if (selectedMekhala && selectedMekhala !== "all") {
      //   filtered = filtered.filter((reg) => reg.mekhalaId === selectedMekhala);
      //   console.log("[Count] After mekhala filter:", filtered.length);
      // }

      // Filter by district (Mekhala filter)
      // if (selectedDistrict && selectedDistrict !== "all") {
      //   const districtObj = districts.find(d => d.id === selectedDistrict);
      //   if (districtObj) {
      //     filtered = filtered.filter(
      //       (reg) => reg.district === districtObj.name
      //     );
      //     console.log("[Count] After district filter:", filtered.length);
      //   }
      // }

      // Filter by madrasa (only if not "all")
      if (selectedMadrasa && selectedMadrasa !== "all") {
        filtered = filtered.filter(
          (reg) =>
            reg.student?.madarsaId === selectedMadrasa ||
            reg.madarsaId === selectedMadrasa,
        );
        console.log("[Count] After madrasa filter:", filtered.length);
      }

      // Filter by class (only if not "all")
      if (selectedClass && selectedClass !== "all") {
        filtered = filtered.filter(
          (reg) =>
            normalizeClassLevel(reg.classLevel) ===
            normalizeClassLevel(selectedClass),
        );
        console.log("[Count] After class filter:", filtered.length);
      }

      // Sort by class
      filtered = sortByClass(filtered);

      setStudentCount(filtered.length);
      setFilteredData(filtered);
    };

    filterEnrichedData();
  }, [
    selectedExam,
    selectedMadrasa,
    selectedMekhala,
    selectedDistrict,
    selectedClass,
    enrichedData,
    districts,
    madrasas,
  ]);

  // Download Excel function
  const downloadExcel = async () => {
    if (!selectedExam) {
      setError("Please select an exam");
      return;
    }

    setDownloading(true);
    setError("");
    setSuccess("");

    try {
      // Fetch exam details
      const exam = exams.find((e) => e.id === selectedExam);
      if (!exam) {
        setError("Exam not found");
        setDownloading(false);
        return;
      }

      // Get cached enriched data
      const enrichedRegistrations = enrichedData[selectedExam];
      if (!enrichedRegistrations) {
        setError("Data not loaded. Please wait and try again.");
        setDownloading(false);
        return;
      }

      console.log(
        "[Download] Using cached enriched data, total:",
        enrichedRegistrations.length,
      );

      // Apply filters on enriched data
      let filtered = enrichedRegistrations;

      // Filter by mekhala (District filter)
      // if (selectedMekhala && selectedMekhala !== "all") {
      //   filtered = filtered.filter((reg) => reg.mekhalaId === selectedMekhala);
      //   console.log("[Download] After mekhala filter:", filtered.length);
      // }

      // Filter by district (Mekhala filter)
      // if (selectedDistrict && selectedDistrict !== "all") {
      //   const districtObj = districts.find(d => d.id === selectedDistrict);
      //   if (districtObj) {
      //     filtered = filtered.filter(
      //       (reg) => reg.district === districtObj.name
      //     );
      //     console.log("[Download] After district filter:", filtered.length);
      //   }
      // }

      // Filter by madrasa (only if not "all")
      if (selectedMadrasa && selectedMadrasa !== "all") {
        filtered = filtered.filter(
          (reg) =>
            reg.student?.madarsaId === selectedMadrasa ||
            reg.madarsaId === selectedMadrasa,
        );
        console.log("[Download] After madrasa filter:", filtered.length);
      }

      // Filter by class (only if not "all")
      if (selectedClass && selectedClass !== "all") {
        filtered = filtered.filter(
          (reg) =>
            normalizeClassLevel(reg.classLevel) ===
            normalizeClassLevel(selectedClass),
        );
        console.log("[Download] After class filter:", filtered.length);
      }

      // Sort by class
      filtered = sortByClass(filtered);

      if (filtered.length === 0) {
        setError("No students found with the selected filters");
        setDownloading(false);
        return;
      }

      // Step 5: Create Excel data from enriched and filtered registrations
      const excelData = filtered.map((registration, index) => {
        // Find mekhala for this registration's district
        const districtObj = districts.find(
          (d) => d.name === registration.district,
        );
        const mekhalaForDistrict = districtObj
          ? mekhalas.find((m) => m.id === districtObj.mekhalaId)
          : null;

        return {
          "Serial Number": index + 1,
          District: mekhalaForDistrict?.name || registration.district || "N/A",
          "Mekhala Name": registration.district,
          "Madarsa Name": registration.madarsaName,
          "MID Number": registration.midNumber,
          "Hall Ticket Number": registration.hallTicketNumber,
          "Student Name": registration.studentName,
          "Guardian Name": registration.guardianName,
          Class: registration.classLevel,
          Subject: exam.subject || exam.title || "N/A",
          "Exam Date": formatDate(exam.examDate),
        };
      });

      // Create workbook
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data Sheet");

      // Set column widths
      const columnWidths = [
        { wch: 10 }, // Serial Number
        { wch: 20 }, // Mekhala Name
        { wch: 20 }, // District
        { wch: 25 }, // Madarsa Name
        { wch: 15 }, // MID Number
        { wch: 20 }, // Hall Ticket Number
        { wch: 25 }, // Student Name
        { wch: 25 }, // Guardian Name
        { wch: 10 }, // Class
        { wch: 30 }, // Subject
        { wch: 15 }, // Exam Date
      ];
      worksheet["!cols"] = columnWidths;

      // Generate filename
      const mekhalaName =
        selectedMekhala && selectedMekhala !== "all"
          ? (
              mekhalas.find((m) => m.id === selectedMekhala)?.name || "All"
            ).replace(/\s+/g, "_")
          : "All";
      const districtName =
        selectedDistrict && selectedDistrict !== "all"
          ? (
              districts.find((d) => d.id === selectedDistrict)?.name || "All"
            ).replace(/\s+/g, "_")
          : "All";
      const madrasaName =
        selectedMadrasa && selectedMadrasa !== "all"
          ? getMadrasaName(selectedMadrasa, madrasas).replace(/\s+/g, "_")
          : "All";
      const className =
        selectedClass && selectedClass !== "all" ? selectedClass : "All";
      const examName = exam.title.replace(/\s+/g, "_");
      const filename = `DataSheet_${mekhalaName}_${districtName}_${madrasaName}_${className}_${examName}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Download
      XLSX.writeFile(workbook, filename);

      setSuccess(
        `Successfully downloaded data sheet with ${filtered.length} students`,
      );
    } catch (error) {
      console.error("Error downloading Excel:", error);
      setError("Failed to download Excel file: " + error.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-3 mb-2">
            <FileSpreadsheet className="h-8 w-8 text-teal-600" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
              Data Sheet
            </h1>
          </div>
          <p className="text-sm sm:text-base text-gray-600">
            Export registered students data in Excel format
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {/* Filters Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-600" />
              <CardTitle>Filter Options</CardTitle>
            </div>
            <CardDescription>
              Select filters to export specific data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Madrasa Filter */}
              <div>
                <Label htmlFor="madrasa">Madrasa</Label>
                <Popover
                  open={madrasaPopoverOpen}
                  onOpenChange={setMadrasaPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={madrasaPopoverOpen}
                      className="w-full justify-between bg-white"
                    >
                      {selectedMadrasa && selectedMadrasa !== "all"
                        ? getMadrasaName(selectedMadrasa, madrasas)
                        : selectedMadrasa === "all"
                          ? "All Madrasas"
                          : "Select Madrasa"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-white" align="start">
                    <Command>
                      <CommandInput placeholder="Search madrasa..." />
                      <CommandList>
                        <CommandEmpty>No madrasa found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              setSelectedMadrasa("all");
                              setMadrasaPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedMadrasa === "all"
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            All Madrasas
                          </CommandItem>
                          {madrasas.map((madrasa) => (
                            <CommandItem
                              key={madrasa.id}
                              value={`${madrasa.name} ${madrasa.madarsaId}`}
                              onSelect={() => {
                                setSelectedMadrasa(
                                  String(madrasa.madarsaId || madrasa.id),
                                );
                                setMadrasaPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedMadrasa ===
                                    String(madrasa.madarsaId || madrasa.id)
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {madrasa.name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  MID: {madrasa.madarsaId}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {/* Warning removed */}
              </div>

              {/* Class Filter */}
              <div>
                <Label htmlFor="class">Class</Label>
                <Select
                  value={selectedClass}
                  onValueChange={setSelectedClass}
                  disabled={!selectedMadrasa || selectedMadrasa === "all"}
                >
                  <SelectTrigger id="class" className="bg-white">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((classLevel) => (
                      <SelectItem key={classLevel} value={classLevel}>
                        {classLevel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Exam Filter */}
              <div>
                <Label htmlFor="exam">
                  Exam <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={selectedExam}
                  onValueChange={setSelectedExam}
                  disabled={!selectedMadrasa || selectedMadrasa === "all"}
                >
                  <SelectTrigger id="exam" className="bg-white">
                    <SelectValue placeholder="Select Exam" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {exams.map((exam) => (
                      <SelectItem key={exam.id} value={exam.id}>
                        {exam.title} - {formatDate(exam.examDate)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!selectedMadrasa || selectedMadrasa === "all") && (
                  <p className="text-xs text-gray-500 mt-1">
                    Select a Madrasa first
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics and Download */}
        <Card>
          <CardHeader>
            <CardTitle>Export Data</CardTitle>
            <CardDescription>
              {selectedExam
                ? `${studentCount} student(s) found with selected filters`
                : "Select an exam to see student count"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">
                  Selected Filters:
                </h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>
                    <strong>Madrasa:</strong>{" "}
                    {selectedMadrasa && selectedMadrasa !== "all"
                      ? getMadrasaName(selectedMadrasa, madrasas)
                      : "Select First"}
                  </li>
                  <li>
                    <strong>Class:</strong>{" "}
                    {selectedClass && selectedClass !== "all"
                      ? selectedClass
                      : "All"}
                  </li>
                  <li>
                    <strong>Exam:</strong>{" "}
                    {selectedExam
                      ? exams.find((e) => e.id === selectedExam)?.title
                      : "Not selected"}
                  </li>
                </ul>
              </div>

              <Button
                onClick={downloadExcel}
                disabled={!selectedExam || downloading || studentCount === 0}
                className="w-full sm:w-auto"
                size="lg"
              >
                <Download className="h-5 w-5 mr-2" />
                {downloading
                  ? "Downloading..."
                  : `Download Excel (${studentCount})`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Preview Table */}
        {(filteredData.length > 0 || fetchingData) && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Data Preview</CardTitle>
                  <CardDescription>
                    Showing {filteredData.length} record(s) that will be
                    exported
                  </CardDescription>
                </div>
                <div className="w-full sm:w-[180px]">
                  <Select
                    value={selectedClass}
                    onValueChange={setSelectedClass}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Filter by Class" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes.map((classLevel) => (
                        <SelectItem key={classLevel} value={classLevel}>
                          {classLevel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {fetchingData ? (
                <div className="flex justify-center items-center h-48">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>District</TableHead>
                          <TableHead>Mekhala</TableHead>
                          <TableHead>Madarsa</TableHead>
                          <TableHead>MID</TableHead>
                          <TableHead>Hall Ticket</TableHead>
                          <TableHead>Student Name</TableHead>
                          <TableHead>Guardian</TableHead>
                          <TableHead>Class</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData
                          .slice(0, 50)
                          .map((registration, index) => {
                            // Find mekhala for this registration's district
                            const districtObj = districts.find(
                              (d) => d.name === registration.district,
                            );
                            const mekhalaForDistrict = districtObj
                              ? mekhalas.find(
                                  (m) => m.id === districtObj.mekhalaId,
                                )
                              : null;

                            return (
                              <TableRow key={registration.id || index}>
                                <TableCell className="font-medium">
                                  {index + 1}
                                </TableCell>
                                <TableCell>
                                  {mekhalaForDistrict?.name ||
                                    registration.district ||
                                    "N/A"}
                                </TableCell>
                                <TableCell>{registration.district}</TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                  {registration.madarsaName}
                                </TableCell>
                                <TableCell>{registration.midNumber}</TableCell>
                                <TableCell>
                                  {registration.hallTicketNumber}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                  {registration.studentName}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                  {registration.guardianName}
                                </TableCell>
                                <TableCell>
                                  {String(
                                    registration.classLevel || "",
                                  ).toUpperCase() === "UKG"
                                    ? "Ukg"
                                    : registration.classLevel}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                  {filteredData.length > 50 && (
                    <p className="text-sm text-gray-500 mt-4">
                      Showing first 50 of {filteredData.length} records.
                      Download Excel to see all records.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-blue-900">
                <p className="font-semibold">Excel Contents:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Serial Number</li>
                  <li>District Name</li>
                  <li>Mekhala</li>
                  <li>Madarsa Name</li>
                  <li>MID Number</li>
                  <li>Hall Ticket Number</li>
                  <li>Student Name</li>
                  <li>Guardian Name</li>
                  <li>Class</li>
                  <li>Subject Name</li>
                  <li>Exam Date</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
