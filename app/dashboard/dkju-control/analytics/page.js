"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  Users,
  GraduationCap,
  Building,
  TrendingUp,
  Download,
  Calendar,
  FileText,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  collection,
  getDocs,
  query,
  where,
  getCountFromServer,
  limit,
  orderBy,
  startAfter,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { COLLECTIONS } from "@/lib/firestoreService";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const SECTION_KEYS = {
  ADMISSIONS_BY_MADRASA: "admissionsByMadrasa",
  STUDENTS_BY_CLASS: "studentsByClass",
  TEACHERS_BY_SUBJECT: "teachersBySubject",
  MONTHLY_GROWTH: "monthlyGrowth",
  MADRASA_PERFORMANCE: "madrasaPerformance",
};

const SECTION_TABS = [
  {
    key: SECTION_KEYS.ADMISSIONS_BY_MADRASA,
    label: "Admissions by Madrasa",
    icon: BarChart3,
  },
  {
    key: SECTION_KEYS.STUDENTS_BY_CLASS,
    label: "Students by Class",
    icon: Users,
  },
  {
    key: SECTION_KEYS.TEACHERS_BY_SUBJECT,
    label: "Teacher Specializations",
    icon: GraduationCap,
  },
  {
    key: SECTION_KEYS.MONTHLY_GROWTH,
    label: "Monthly Growth",
    icon: TrendingUp,
  },
  {
    key: SECTION_KEYS.MADRASA_PERFORMANCE,
    label: "Madrasa Performance",
    icon: Building,
  },
];

function getDateFilter(timeRange) {
  const now = new Date();
  if (timeRange === "allTime") return null;
  if (timeRange === "thisYear") return new Date(now.getFullYear(), 0, 1);
  if (timeRange === "last30Days")
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function parseCreatedAt(item) {
  if (!item.createdAt) return new Date(0);
  return new Date(item.createdAt?.seconds * 1000 || item.createdAt);
}

function normalizeQualification(skill) {
  if (!skill) return "Not Assigned";
  const s = skill.toString().trim();
  if (!s) return "Not Assigned";
  
  const clean = s.toUpperCase().replace(/[\s.-]/g, "");
  
  if (clean === "SSLC" || clean === "10" || clean === "10TH") {
    return "SSLC";
  }
  if (
    clean === "PLUSTWO" ||
    clean === "12" ||
    clean === "12TH" ||
    clean === "+2" ||
    clean === "HSE" ||
    clean === "VHSE"
  ) {
    return "Plus Two";
  }
  if (clean === "PDC") {
    return "PDC";
  }
  if (clean === "BA" || clean === "DEGREE" || clean === "GRADUATION") {
    return "BA / Degree";
  }
  if (clean === "MA" || clean === "POSTGRADUATION") {
    return "MA";
  }
  if (clean === "MANNANI" || clean === "ALIM" || clean === "MAULAVI") {
    return "Mannani";
  }
  if (clean === "BAQAVI") {
    return "Baqavi";
  }
  if (clean === "HASANI") {
    return "Hasani";
  }
  if (clean === "DARIMI") {
    return "Darimi";
  }
  if (clean === "FAIZY") {
    return "Faizy";
  }
  if (clean === "NOTASSIGNED" || clean === "NONE" || clean === "NULL") {
    return "Not Assigned";
  }
  
  // Title Case for everything else
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default function CentralAdminAnalyticsPage() {
  const { user, userData } = useAuthStore();

  const [countsLoading, setCountsLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [timeRange, setTimeRange] = useState("thisMonth");
  const [activeSection, setActiveSection] = useState(
    SECTION_KEYS.ADMISSIONS_BY_MADRASA,
  );

  const [counts, setCounts] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalMahals: 0,
    totalAdmissions: 0,
    studentsThisMonth: 0,
    teachersThisMonth: 0,
    admissionsThisMonth: 0,
  });

  const [sectionData, setSectionData] = useState({});
  const [searchInputValue, setSearchInputValue] = useState("");
  const [admissionsSearch, setAdmissionsSearch] = useState("");
  const [admissionsPage, setAdmissionsPage] = useState(1);
  const [admissionsTotal, setAdmissionsTotal] = useState(0);
  const [admissionsPageTokens, setAdmissionsPageTokens] = useState([null]);
  const cacheKeyRef = useRef("");

  const fetchCounts = useCallback(async () => {
    try {
      setCountsLoading(true);
      const dateFilter = getDateFilter(timeRange);

      const studentsRef = collection(db, COLLECTIONS.STUDENTS);
      const teachersRef = collection(db, "teachers");
      const madarsasRef = collection(db, COLLECTIONS.MADRASAS);
      const admissionsRef = collection(db, COLLECTIONS.ADMISSIONS);

      const [
        totalStudentsSnap,
        totalTeachersSnap,
        totalMahalsSnap,
        totalAdmissionsSnap,
      ] = await Promise.all([
        getCountFromServer(studentsRef),
        getCountFromServer(teachersRef),
        getCountFromServer(madarsasRef),
        getCountFromServer(admissionsRef),
      ]);

      // Roughly count Sadars (Madrasas with an admin assigned)
      // Since getCountFromServer with != is tricky, we'll use the totalMadarsas for now
      // or if we want to be precise, we'd need a separate collection or a full fetch.
      // The user likely considers 1 Sadar per Madrasa.
      const totalSadars = totalMahalsSnap.data().count;

      const [
        studentsThisMonthSnap,
        teachersThisMonthSnap,
        admissionsThisMonthSnap,
      ] = await Promise.all([
        getCountFromServer(
          dateFilter
            ? query(studentsRef, where("createdAt", ">=", dateFilter))
            : studentsRef,
        ),
        getCountFromServer(
          dateFilter
            ? query(teachersRef, where("createdAt", ">=", dateFilter))
            : teachersRef,
        ),
        getCountFromServer(
          dateFilter
            ? query(admissionsRef, where("createdAt", ">=", dateFilter))
            : admissionsRef,
        ),
      ]);

      setCounts({
        totalStudents: totalStudentsSnap.data().count,
        totalTeachers: totalTeachersSnap.data().count,
        totalMahals: totalMahalsSnap.data().count,
        totalAdmissions: totalAdmissionsSnap.data().count,
        totalSadars: totalSadars,
        studentsThisMonth: studentsThisMonthSnap.data().count,
        teachersThisMonth: teachersThisMonthSnap.data().count,
        admissionsThisMonth: admissionsThisMonthSnap.data().count,
      });
    } catch (error) {
      console.error("Error fetching counts:", error);
      toast.error("Failed to fetch summary counts");
    } finally {
      setCountsLoading(false);
    }
  }, [timeRange]);

  const fetchSectionData = useCallback(
    async (sectionKey) => {
      const cacheKey =
        sectionKey === SECTION_KEYS.ADMISSIONS_BY_MADRASA ||
        sectionKey === SECTION_KEYS.MADRASA_PERFORMANCE
          ? `${sectionKey}_${timeRange}_${admissionsSearch || ""}_${admissionsPage}`
          : `${sectionKey}_${timeRange}`;
      if (sectionData[cacheKey]) return;

      try {
        setSectionLoading(true);
        let data = null;

        if (sectionKey === SECTION_KEYS.ADMISSIONS_BY_MADRASA) {
          let madarsasQuery = query(
            collection(db, COLLECTIONS.MADRASAS),
            orderBy("name"),
            limit(10),
          );

          if (admissionsSearch) {
            // Use searchKeywords for name/MID search if possible
            // Fallback to name prefix if searchKeywords doesn't work for some reason
            // But here we'll try the common pattern
            madarsasQuery = query(
              collection(db, COLLECTIONS.MADRASAS),
              where(
                "searchKeywords",
                "array-contains",
                admissionsSearch.toLowerCase(),
              ),
              limit(10),
            );
          }

          if (admissionsPage > 1) {
            const prevToken = admissionsPageTokens[admissionsPage - 1];
            if (prevToken) {
              madarsasQuery = query(madarsasQuery, startAfter(prevToken));
            }
          }

          const [madarsasSnap, totalCountSnap] = await Promise.all([
            getDocs(madarsasQuery),
            admissionsPage === 1
              ? getCountFromServer(
                  admissionsSearch
                    ? query(
                        collection(db, COLLECTIONS.MADRASAS),
                        where(
                          "searchKeywords",
                          "array-contains",
                          admissionsSearch.toLowerCase(),
                        ),
                      )
                    : collection(db, COLLECTIONS.MADRASAS),
                )
              : Promise.resolve(null),
          ]);

          if (totalCountSnap) {
            setAdmissionsTotal(totalCountSnap.data().count);
          }

          const madarsas = madarsasSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));

          if (madarsasSnap.docs.length > 0) {
            const lastDoc = madarsasSnap.docs[madarsasSnap.docs.length - 1];
            setAdmissionsPageTokens((prev) => {
              const next = [...prev];
              next[admissionsPage] = lastDoc;
              return next;
            });
          }

          if (madarsas.length === 0) {
            data = [];
          } else {
            const madarsaIds = madarsas.map((m) => m.id);
            const madarsaMids = madarsas
              .map((m) => m.madarsaId)
              .filter((mid) => !!mid);

            // Fetch admissions, students and teachers for these 10 madrasas
            // We fetch checking both doc IDs and MIDs (string IDs like 'mid-XXX')
            // because different collections use different linking conventions.
            const promises = [
              getDocs(
                query(
                  collection(db, COLLECTIONS.ADMISSIONS),
                  where("madarsaId", "in", madarsaIds),
                ),
              ),
              madarsaMids.length > 0
                ? getDocs(
                    query(
                      collection(db, COLLECTIONS.ADMISSIONS),
                      where("madarsaId", "in", madarsaMids),
                    ),
                  )
                : Promise.resolve({ docs: [] }),
              getDocs(
                query(
                  collection(db, COLLECTIONS.ADMISSIONS),
                  where("madarsa", "in", madarsaIds),
                ),
              ),
              madarsaMids.length > 0
                ? getDocs(
                    query(
                      collection(db, COLLECTIONS.ADMISSIONS),
                      where("madarsa", "in", madarsaMids),
                    ),
                  )
                : Promise.resolve({ docs: [] }),
              getDocs(
                query(
                  collection(db, COLLECTIONS.STUDENTS),
                  where("madarsaId", "in", madarsaIds),
                ),
              ),
              madarsaMids.length > 0
                ? getDocs(
                    query(
                      collection(db, COLLECTIONS.STUDENTS),
                      where("madarsaId", "in", madarsaMids),
                    ),
                  )
                : Promise.resolve({ docs: [] }),
              getDocs(
                query(
                  collection(db, "teachers"),
                  where("madarsaId", "in", madarsaIds),
                ),
              ),
              madarsaMids.length > 0
                ? getDocs(
                    query(
                      collection(db, "teachers"),
                      where("madarsaId", "in", madarsaMids),
                    ),
                  )
                : Promise.resolve({ docs: [] }),
            ];

            const [
              admSnap1,
              admSnap2,
              admSnap3,
              admSnap4,
              stdSnap1,
              stdSnap2,
              teaSnap1,
              teaSnap2,
            ] = await Promise.all(promises);

            const admissions = [
              ...admSnap1.docs,
              ...admSnap2.docs,
              ...admSnap3.docs,
              ...admSnap4.docs,
            ].map((d) => d.data());
            const studentsData = [...stdSnap1.docs, ...stdSnap2.docs].map((d) =>
              d.data(),
            );
            const teachersData = [...teaSnap1.docs, ...teaSnap2.docs].map((d) =>
              d.data(),
            );

            data = madarsas.map((madarsa) => {
              const madarsaAdmissions = admissions.filter(
                (a) =>
                  a.madarsa === madarsa.id ||
                  a.madarsaId === madarsa.id ||
                  a.madarsa === madarsa.madarsaId ||
                  a.madarsaId === madarsa.madarsaId,
              );
              const madarsaStudents = studentsData.filter(
                (s) =>
                  s.madarsaId === madarsa.id ||
                  s.madarsaId === madarsa.madarsaId,
              );
              const madarsaTeachers = teachersData.filter(
                (t) =>
                  t.madarsaId === madarsa.id ||
                  t.madarsaId === madarsa.madarsaId,
              );

              return {
                name: madarsa.name,
                mid: madarsa.madarsaId,
                count: madarsaAdmissions.length,
                approved: madarsaAdmissions.filter(
                  (a) => a.status === "approved",
                ).length,
                pending: madarsaAdmissions.filter((a) => a.status === "pending")
                  .length,
                students: madarsaStudents.length,
                teachers: madarsaTeachers.length,
              };
            });
          }
        }

        if (sectionKey === SECTION_KEYS.STUDENTS_BY_CLASS) {
          const studentsSnap = await getDocs(
            collection(db, COLLECTIONS.STUDENTS),
          );
          const students = studentsSnap.docs
            .map((d) => d.data())
            .filter((s) => !s.deleted);

          const classGroups = {};
          students.forEach((s) => {
            let rawClass = s.classLevel || s.class || "Not Assigned";
            let normalized = rawClass.toString().trim();

            // Normalize UKG variations
            if (normalized.toLowerCase().replace(/[\s.-]/g, "") === "ukg") {
              normalized = "UKG";
            }
            // Normalize LKG variations
            else if (
              normalized.toLowerCase().replace(/[\s.-]/g, "") === "lkg"
            ) {
              normalized = "LKG";
            }
            // Normalize STD/Class prefixes (e.g., STD2 -> 2)
            else if (/^(std|class)\.?\s*(\d+)$/i.test(normalized)) {
              normalized = normalized.match(/^(std|class)\.?\s*(\d+)$/i)[2];
            }

            if (/^\d+$/.test(normalized)) {
              const num = parseInt(normalized);
              if (num > 12 || num < 1) return; // Exclude Class 13+ and invalid
              normalized = "Class " + num;
            } else if (normalized !== "LKG" && normalized !== "UKG") {
              return; // Exclude 'Not Assigned' and other non-standard classes
            }

            classGroups[normalized] = (classGroups[normalized] || 0) + 1;
          });

          // Sort numerically, then alphabetically
          const sortedClasses = Object.entries(classGroups)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => {
              const numA = parseInt(a.name.replace("Class ", ""));
              const numB = parseInt(b.name.replace("Class ", ""));
              const isNumA = !isNaN(numA);
              const isNumB = !isNaN(numB);

              if (isNumA && isNumB) return numA - numB;
              if (isNumA) return 1; // Put numeric classes after KG
              if (isNumB) return -1; // Put numeric classes after KG

              // Place KG classes
              if (a.name === "LKG" && b.name === "UKG") return -1;
              if (a.name === "UKG" && b.name === "LKG") return 1;

              return a.name.localeCompare(b.name);
            });

          data = {
            studentsByClass: sortedClasses,
            total: students.length,
          };
        }

        if (sectionKey === SECTION_KEYS.TEACHERS_BY_SUBJECT) {
          const [teachersSnap, madarsasSnap] = await Promise.all([
            getDocs(collection(db, "teachers")),
            getDocs(collection(db, "madarsas")),
          ]);

          const teachers = teachersSnap.docs.map((d) => ({
            ...d.data(),
            type: "teacher",
          }));

          // Madarsa Admins (Sadars) are stored as admin fields in the madarsas collection
          const sadars = madarsasSnap.docs.map((d) => ({
            ...d.data(),
            type: "sadar",
            // Map admin fields for completeness, though they mostly lack qualification fields
            name: d.data().adminName,
            email: d.data().adminEmail,
          }));

          const allStaff = [...teachers, ...sadars];

          const subjectGroups = {};
          allStaff.forEach((t) => {
            // Priority: subject -> qualification -> degree
            const skill =
              t.subject || t.qualification || t.degree || "Not Assigned";
            const normalized = normalizeQualification(skill);
            if (!subjectGroups[normalized]) {
              subjectGroups[normalized] = { teacher: 0, sadar: 0, total: 0 };
            }
            subjectGroups[normalized][t.type]++;
            subjectGroups[normalized].total++;
          });

          data = {
            teachersBySubject: Object.entries(subjectGroups)
              .map(([name, stats]) => ({
                name,
                count: stats.total, // keep for compatibility
                teacherCount: stats.teacher,
                sadarCount: stats.sadar,
                total: stats.total,
              }))
              .sort((a, b) => b.total - a.total),
            total: allStaff.length,
          };
        }

        if (sectionKey === SECTION_KEYS.MONTHLY_GROWTH) {
          const [studentsSnap, teachersSnap] = await Promise.all([
            getDocs(collection(db, COLLECTIONS.STUDENTS)),
            getDocs(collection(db, "teachers")),
          ]);
          const students = studentsSnap.docs.map((d) => d.data());
          const teachers = teachersSnap.docs.map((d) => d.data());

          const now = new Date();
          const monthlyGrowth = [];
          for (let i = 5; i >= 0; i--) {
            const monthStart = new Date(
              now.getFullYear(),
              now.getMonth() - i,
              1,
            );
            const monthEnd = new Date(
              now.getFullYear(),
              now.getMonth() - i + 1,
              0,
            );

            const monthStudents = students.filter((s) => {
              const d = parseCreatedAt(s);
              return d >= monthStart && d <= monthEnd;
            }).length;

            const monthTeachers = teachers.filter((t) => {
              const d = parseCreatedAt(t);
              return d >= monthStart && d <= monthEnd;
            }).length;

            monthlyGrowth.push({
              month: monthStart.toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              }),
              students: monthStudents,
              teachers: monthTeachers,
            });
          }
          data = monthlyGrowth;
        }

        if (sectionKey === SECTION_KEYS.MADRASA_PERFORMANCE) {
          const madarsasRef = collection(db, COLLECTIONS.MADRASAS);
          let madarsasQuery;

          if (admissionsSearch) {
            const lower = admissionsSearch.toLowerCase();
            madarsasQuery = query(
              madarsasRef,
              where("searchKeywords", "array-contains", lower),
              limit(20),
            );
          } else {
            const pageToken = admissionsPageTokens[admissionsPage - 1];
            madarsasQuery = query(
              madarsasRef,
              orderBy("name", "asc"),
              limit(10),
            );
            if (pageToken) {
              madarsasQuery = query(madarsasQuery, startAfter(pageToken));
            }
          }

          const madarsasSnap = await getDocs(madarsasQuery);
          const madarsas = madarsasSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));

          if (madarsasSnap.docs.length > 0 && !admissionsSearch) {
            const lastDoc = madarsasSnap.docs[madarsasSnap.docs.length - 1];
            setAdmissionsPageTokens((prev) => {
              const next = [...prev];
              next[admissionsPage] = lastDoc;
              return next;
            });
          }

          if (madarsas.length === 0) {
            data = [];
          } else {
            const madarsaIds = madarsas.map((m) => m.id);
            const madarsaMids = madarsas
              .map((m) => m.madarsaId)
              .filter((mid) => !!mid);

            // Fetch students and teachers for these madrasas
            const [stdSnap1, stdSnap2, teaSnap1, teaSnap2] = await Promise.all([
              getDocs(
                query(
                  collection(db, COLLECTIONS.STUDENTS),
                  where("madarsaId", "in", madarsaIds),
                ),
              ),
              madarsaMids.length > 0
                ? getDocs(
                    query(
                      collection(db, COLLECTIONS.STUDENTS),
                      where("madarsaId", "in", madarsaMids),
                    ),
                  )
                : Promise.resolve({ docs: [] }),
              getDocs(
                query(
                  collection(db, "teachers"),
                  where("madarsaId", "in", madarsaIds),
                ),
              ),
              madarsaMids.length > 0
                ? getDocs(
                    query(
                      collection(db, "teachers"),
                      where("madarsaId", "in", madarsaMids),
                    ),
                  )
                : Promise.resolve({ docs: [] }),
            ]);

            const studentsData = [...stdSnap1.docs, ...stdSnap2.docs].map((d) =>
              d.data(),
            );
            const teachersData = [...teaSnap1.docs, ...teaSnap2.docs].map((d) =>
              d.data(),
            );

            data = madarsas.map((madarsa) => {
              const madarsaStudents = studentsData.filter(
                (s) =>
                  s.madarsaId === madarsa.id ||
                  s.madarsaId === madarsa.madarsaId,
              );
              const madarsaTeachers = teachersData.filter(
                (t) =>
                  t.madarsaId === madarsa.id ||
                  t.madarsaId === madarsa.madarsaId,
              );

              const sCount = madarsaStudents.length;
              const tCount = madarsaTeachers.length;
              const activeSCount = madarsaStudents.filter(
                (s) => s.status === "active",
              ).length;

              return {
                id: madarsa.id,
                mid: madarsa.madarsaId,
                name: madarsa.name,
                students: sCount,
                teachers: tCount,
                ratio: tCount > 0 ? (sCount / tCount).toFixed(1) : sCount,
                activeStudents: activeSCount,
                capacity: madarsa.capacity || 0,
                utilizationRate: madarsa.capacity
                  ? (activeSCount / madarsa.capacity) * 100
                  : 0,
              };
            });
          }
        }

        setSectionData((prev) => ({ ...prev, [cacheKey]: data }));
      } catch (error) {
        console.error(`Error fetching section ${sectionKey}:`, error);
        toast.error("Failed to load section data");
      } finally {
        setSectionLoading(false);
      }
    },
    [
      timeRange,
      sectionData,
      admissionsSearch,
      admissionsPage,
      admissionsPageTokens,
    ],
  );

  useEffect(() => {
    fetchCounts();
    setSectionData({});
  }, [timeRange, fetchCounts]);

  useEffect(() => {
    if (!countsLoading) {
      fetchSectionData(activeSection);
    }
  }, [
    activeSection,
    countsLoading,
    admissionsSearch,
    admissionsPage,
    fetchSectionData,
  ]);

  const currentCacheKey =
    activeSection === SECTION_KEYS.ADMISSIONS_BY_MADRASA ||
    activeSection === SECTION_KEYS.MADRASA_PERFORMANCE
      ? `${activeSection}_${timeRange}_${admissionsSearch || ""}_${admissionsPage}`
      : `${activeSection}_${timeRange}`;
  const currentData = sectionData[currentCacheKey] || null;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAdmissionsSearch(searchInputValue);
      setAdmissionsPage(1);
      setAdmissionsPageTokens([null]);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInputValue]);

  const handleAdmissionsSearch = (val) => {
    setSearchInputValue(val);
  };

  const handleAdmissionsPageChange = (direction) => {
    if (direction === "next") {
      setAdmissionsPage((prev) => prev + 1);
    } else if (direction === "prev") {
      setAdmissionsPage((prev) => Math.max(1, prev - 1));
    }
  };

  const downloadReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      timeRange,
      summary: {
        totalStudents: counts.totalStudents,
        totalTeachers: counts.totalTeachers,
        totalMahals: counts.totalMahals,
        totalAdmissions: counts.totalAdmissions,
      },
      loadedSections: Object.keys(sectionData),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_report_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const renderSectionContent = () => {
    if (sectionLoading && !currentData) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600 mx-auto" />
            <p className="text-gray-400 text-sm font-medium">
              Loading section data...
            </p>
          </div>
        </div>
      );
    }

    if (!currentData) return null;

    switch (activeSection) {
      case SECTION_KEYS.ADMISSIONS_BY_MADRASA:
        return (
          <AdmissionsByMadrasaSection
            data={currentData}
            searchTerm={searchInputValue}
            onSearch={handleAdmissionsSearch}
            currentPage={admissionsPage}
            totalPages={Math.ceil(admissionsTotal / 10)}
            onPageChange={handleAdmissionsPageChange}
            loading={sectionLoading}
          />
        );
      case SECTION_KEYS.STUDENTS_BY_CLASS:
        return <StudentsByClassSection data={currentData} />;
      case SECTION_KEYS.TEACHERS_BY_SUBJECT:
        return <TeachersBySubjectSection data={currentData} />;
      case SECTION_KEYS.MONTHLY_GROWTH:
        return <MonthlyGrowthSection data={currentData} />;
      case SECTION_KEYS.MADRASA_PERFORMANCE:
        return (
          <MadrasaPerformanceSection
            data={currentData}
            searchTerm={searchInputValue}
            onSearch={handleAdmissionsSearch}
            currentPage={admissionsPage}
            totalPages={
              admissionsSearch ? 1 : Math.ceil(counts.totalMahals / 10)
            }
            onPageChange={handleAdmissionsPageChange}
            loading={sectionLoading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-8 bg-gray-50/30 min-h-screen">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Analytics Dashboard
            </h1>
            <p className="text-gray-500 font-medium">
              Comprehensive system-wide insights and performance metrics
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-full sm:w-48 h-12 border-gray-200 bg-white none-sm font-medium">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <SelectValue placeholder="Select period" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="last30Days">Last 30 Days</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
                <SelectItem value="allTime">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={downloadReport}
              className="w-full sm:w-auto h-12 bg-teal-600 hover:bg-teal-700 none-md transition-all duration-200 font-bold px-6"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {countsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[...Array(4)].map((_, i) => (
              <Card
                key={i}
                className="border-none none-sm bg-white border-l-4 border-l-gray-200"
              >
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-3 bg-gray-200 none w-24" />
                    <div className="h-8 bg-gray-200 none w-16" />
                    <div className="h-4 bg-gray-100 none w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <Card className="border-none none-sm bg-white hover:none-md transition-all duration-200 border-l-4 border-l-teal-500">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Total Students
                    </p>
                    <h3 className="text-3xl font-bold text-gray-900">
                      {counts.totalStudents.toLocaleString()}
                    </h3>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="flex items-center text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 none-full border border-teal-100">
                        <TrendingUp className="h-2.5 w-2.5 mr-1" />+
                        {counts.studentsThisMonth} New
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-teal-50 none-xl">
                    <Users className="h-6 w-6 text-teal-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none none-sm bg-white hover:none-md transition-all duration-200 border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Total Teachers
                    </p>
                    <h3 className="text-3xl font-bold text-gray-900">
                      {counts.totalTeachers.toLocaleString()}
                    </h3>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="flex items-center text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 none-full border border-blue-100">
                        <TrendingUp className="h-2.5 w-2.5 mr-1" />+
                        {counts.teachersThisMonth} New
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 none-xl">
                    <GraduationCap className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none none-sm bg-white hover:none-md transition-all duration-200 border-l-4 border-l-indigo-500">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Institutions & Leadership
                    </p>
                    <h3 className="text-3xl font-bold text-gray-900">
                      {counts.totalMahals.toLocaleString()}
                    </h3>
                    <div className="mt-2 flex flex-col gap-1">
                      <span className="flex items-center text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 none-full border border-indigo-100 w-fit">
                        {counts.totalMahals} Madrasas
                      </span>
                      <span className="flex items-center text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 none-full border border-purple-100 w-fit">
                        {counts.totalSadars} Sadars (Admins)
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-50 none-xl">
                    <Building className="h-6 w-6 text-indigo-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none none-sm bg-white hover:none-md transition-all duration-200 border-l-4 border-l-orange-500">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Total Admissions
                    </p>
                    <h3 className="text-3xl font-bold text-gray-900">
                      {counts.totalAdmissions.toLocaleString()}
                    </h3>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="flex items-center text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 none-full border border-orange-100">
                        <TrendingUp className="h-2.5 w-2.5 mr-1" />+
                        {counts.admissionsThisMonth} New
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-orange-50 none-xl">
                    <FileText className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {SECTION_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 none-xl text-sm font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-teal-600 text-white none-md"
                    : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 none-sm"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <Card className="border-none none-md overflow-hidden bg-white">
          <CardHeader className="bg-gray-50/80 border-b border-gray-100 px-6 py-4">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center">
              <div className="p-1.5 bg-teal-100 none-lg mr-2.5">
                {(() => {
                  const tab = SECTION_TABS.find((t) => t.key === activeSection);
                  const Icon = tab?.icon || BarChart3;
                  return <Icon className="h-4 w-4 text-teal-600" />;
                })()}
              </div>
              {SECTION_TABS.find((t) => t.key === activeSection)?.label}
              {sectionData[currentCacheKey] && (
                <Badge className="ml-3 bg-teal-50 text-teal-600 border-teal-100 text-[10px] font-bold">
                  CACHED
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">{renderSectionContent()}</CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function AdmissionsByMadrasaSection({
  data,
  searchTerm,
  onSearch,
  currentPage,
  totalPages,
  onPageChange,
  loading,
}) {
  const chartData = data ? [...data].reverse().slice(0, 10) : [];

  return (
    <div className="p-0">
      <div className="p-6 border-b border-gray-100 bg-white">
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">
          Admission Velocity
        </h4>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorAdm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis dataKey="name" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="Admissions"
                stroke="#0d9488"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorAdm)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search Madrasa by Name or ID..."
            className="pl-10 h-11 bg-gray-50/50 border-gray-100 rounded-xl font-medium focus:bg-white transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <p className="text-gray-400 text-sm font-medium">
                Updating results...
              </p>
            </div>
          ) : !data || data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm font-medium">
                {searchTerm
                  ? "No madrasas matching your search"
                  : "No admission data available"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.map((madarsa, index) => (
                <div key={index} className="py-5 first:pt-0 last:pb-0 group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-gray-900 group-hover:text-teal-600 transition-colors">
                          {madarsa.name}
                        </h4>
                        {madarsa.mid && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold text-teal-600 border-teal-100 bg-teal-50/50 h-5 px-1.5"
                          >
                            {madarsa.mid}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        PERFORMANCE METRICS
                      </p>
                    </div>
                    <Badge className="bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-100 px-4 py-1 font-bold text-xs rounded-lg">
                      STUDENTS: {madarsa.students}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge className="bg-blue-50 text-blue-700 border-blue-100 text-[10px] font-bold px-2.5 py-1">
                      TEACHERS: {madarsa.teachers}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[9px] font-black uppercase tracking-tighter px-2.5 py-1">
                      APPROVED ADM: {madarsa.approved}
                    </Badge>
                    <Badge className="bg-orange-50 text-orange-700 border-orange-100 text-[9px] font-black uppercase tracking-tighter px-2.5 py-1">
                      PENDING ADM: {madarsa.pending}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-6 border-t border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange("prev")}
                disabled={currentPage === 1 || loading}
                className="h-9 px-4 text-xs font-bold rounded-lg border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1.5" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange("next")}
                disabled={currentPage === totalPages || loading}
                className="h-9 px-4 text-xs font-bold rounded-lg border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                Next <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StudentsByClassSection({ data }) {
  if (!data || !data.studentsByClass || data.studentsByClass.length === 0) {
    return (
      <p className="text-gray-400 text-center py-12 text-sm">
        No student data available.
      </p>
    );
  }
  return (
    <div className="p-0">
      <div className="p-6 border-b border-gray-100 bg-white">
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">
          Enrollment Trends
        </h4>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.studentsByClass}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                dy={10}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#14b8a6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorCount)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {data.studentsByClass.map((classData, index) => (
          <div key={index} className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-900">
                {classData.name}
              </span>
              <span className="text-xs font-bold text-gray-400">
                {classData.count} Students (
                {data.total > 0
                  ? Math.round((classData.count / data.total) * 100)
                  : 0}
                %)
              </span>
            </div>
            <Progress
              value={data.total > 0 ? (classData.count / data.total) * 100 : 0}
              className="h-1.5 bg-gray-50"
              indicatorClassName="bg-teal-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TeachersBySubjectSection({ data }) {
  if (!data || !data.teachersBySubject || data.teachersBySubject.length === 0) {
    return (
      <p className="text-gray-400 text-center py-12 text-sm">
        No teacher data available.
      </p>
    );
  }
  return (
    <div className="p-0">
      <div className="p-6 border-b border-gray-100 bg-white">
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">
          Expertise Distribution
        </h4>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.teachersBySubject.slice(0, 10)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fontWeight: 700, fill: "#94a3b8" }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fontWeight: 700, fill: "#94a3b8" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              />
              <Bar
                dataKey="count"
                fill="#3b82f6"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {data.teachersBySubject.slice(0, 7).map((subjectData, index) => (
          <div key={index} className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-900">
                {subjectData.name}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 none-full">
                  {subjectData.teacherCount || 0} Teachers
                </span>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 none-full">
                  {subjectData.sadarCount || 0} Sadars
                </span>
              </div>
            </div>
            <Progress
              value={
                data.total > 0 ? (subjectData.total / data.total) * 100 : 0
              }
              className="h-1.5 bg-gray-50"
              indicatorClassName="bg-blue-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyGrowthSection({ data }) {
  if (!data || data.length === 0) {
    return (
      <p className="text-gray-400 text-center py-12 text-sm">
        No growth data available.
      </p>
    );
  }

  const maxVal = Math.max(
    ...data.map((m) => Math.max(m.students, m.teachers, 1)),
  );

  return (
    <div className="p-0">
      <div className="p-6 border-b border-gray-100 bg-white">
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">
          Growth Velocity
        </h4>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTeachers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                dy={10}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              />
              <Area
                type="monotone"
                dataKey="students"
                stroke="#14b8a6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorStudents)"
              />
              <Area
                type="monotone"
                dataKey="teachers"
                stroke="#3b82f6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorTeachers)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {data.map((month, index) => (
          <div key={index} className="space-y-3">
            <div className="flex justify-between items-end">
              <span className="text-sm font-bold text-gray-900">
                {month.month}
              </span>
              <span className="text-xs font-bold text-gray-400 uppercase">
                {(month.students + month.teachers).toLocaleString()} New Members
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-teal-600">Students</span>
                  <span className="text-gray-900">{month.students}</span>
                </div>
                <Progress
                  value={(month.students / (maxVal * 1.2)) * 100}
                  className="h-1.5 bg-teal-50"
                  indicatorClassName="bg-teal-500"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-blue-600">Teachers</span>
                  <span className="text-gray-900">{month.teachers}</span>
                </div>
                <Progress
                  value={(month.teachers / (maxVal * 1.2)) * 100}
                  className="h-1.5 bg-blue-50"
                  indicatorClassName="bg-blue-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MadrasaPerformanceSection({
  data,
  searchTerm,
  onSearch,
  currentPage,
  totalPages,
  onPageChange,
  loading,
}) {
  if (!loading && (!data || data.length === 0)) {
    return (
      <div className="p-6 space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search Madrasas..."
            className="pl-10 h-11 bg-gray-50/50 border-gray-100 rounded-xl font-medium focus:bg-white transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <p className="text-gray-400 text-center py-12 text-sm">
          No performance data available.
        </p>
      </div>
    );
  }

  return (
    <div className="p-0">
      <div className="p-6 border-b border-gray-100 bg-white">
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">
          Capacity Analysis
        </h4>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis dataKey="name" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              />
              <Line
                type="monotone"
                dataKey="utilizationRate"
                name="Utilization %"
                stroke="#f97316"
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="ratio"
                name="S:T Ratio"
                stroke="#6366f1"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-6 pb-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search Madrasas by Name or ID..."
            className="pl-10 h-11 bg-gray-50/50 border-gray-100 rounded-xl font-medium focus:bg-white transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="hidden md:block overflow-x-auto mt-6">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
              <th className="text-left py-4 px-8">Madrasa Name</th>
              <th className="text-center py-4 px-4">Students</th>
              <th className="text-center py-4 px-4">Teachers</th>
              <th className="text-center py-4 px-4">Ratio (S:T)</th>
              <th className="text-center py-4 px-4">Utilization</th>
              <th className="text-right py-4 px-8">Capacity Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-gray-600 font-medium">
            {loading
              ? [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-5 px-8">
                      <div className="h-4 bg-gray-100 rounded w-32" />
                    </td>
                    <td className="py-5 px-4">
                      <div className="h-6 bg-gray-100 rounded-full w-12 mx-auto" />
                    </td>
                    <td className="py-5 px-4">
                      <div className="h-6 bg-gray-100 rounded-full w-12 mx-auto" />
                    </td>
                    <td className="py-5 px-4">
                      <div className="h-4 bg-gray-100 rounded w-16 mx-auto" />
                    </td>
                    <td className="py-5 px-4">
                      <div className="h-4 bg-gray-100 rounded w-24 mx-auto" />
                    </td>
                    <td className="py-5 px-8">
                      <div className="h-6 bg-gray-100 rounded-full w-20 ml-auto" />
                    </td>
                  </tr>
                ))
              : data.map((madarsa, index) => (
                  <tr
                    key={index}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-5 px-8">
                      <div className="font-bold text-gray-900">
                        {madarsa.name}
                      </div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                        {madarsa.mid || madarsa.id}
                      </div>
                    </td>
                    <td className="py-5 px-4 text-center">
                      <Badge
                        variant="secondary"
                        className="bg-teal-50 text-teal-700 border-none px-3"
                      >
                        {madarsa.students}
                      </Badge>
                    </td>
                    <td className="py-5 px-4 text-center">
                      <Badge
                        variant="secondary"
                        className="bg-blue-50 text-blue-700 border-none px-3"
                      >
                        {madarsa.teachers}
                      </Badge>
                    </td>
                    <td className="py-5 px-4 text-center">
                      <span className="text-xs font-bold text-gray-700">
                        {madarsa.ratio}:1
                      </span>
                    </td>
                    <td className="py-5 px-4">
                      {madarsa.capacity ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="text-[10px] font-bold text-gray-400">
                            {Math.round(madarsa.utilizationRate)}% FULL
                          </span>
                          <Progress
                            value={madarsa.utilizationRate}
                            className="h-1.5 w-24 bg-gray-100"
                          />
                        </div>
                      ) : (
                        <div className="text-center h-full">
                          <span className="text-gray-300 italic text-[10px] font-bold uppercase">
                            No Cap
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-5 px-8 text-right">
                      <Badge
                        className={`border-none px-4 py-1 uppercase text-[10px] font-black tracking-tighter ${
                          madarsa.utilizationRate > 80
                            ? "bg-red-100 text-red-600"
                            : madarsa.utilizationRate > 60
                              ? "bg-orange-100 text-orange-600"
                              : "bg-emerald-100 text-emerald-600"
                        }`}
                      >
                        {madarsa.utilizationRate > 80
                          ? "CRITICAL"
                          : madarsa.utilizationRate > 60
                            ? "HIGH"
                            : "OPTIMAL"}
                      </Badge>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden p-4 space-y-4">
        {loading
          ? [...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100 animate-pulse space-y-4"
              >
                <div className="h-5 bg-gray-100 rounded w-3/4" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-14 bg-gray-100 rounded" />
                  <div className="h-14 bg-gray-100 rounded" />
                </div>
              </div>
            ))
          : data.map((madarsa, index) => (
              <div
                key={index}
                className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100 space-y-4 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight">
                      {madarsa.name}
                    </h3>
                    <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                      {madarsa.mid || madarsa.id}
                    </div>
                  </div>
                  <Badge
                    className={`border-none text-[10px] font-bold px-2.5 ${
                      madarsa.utilizationRate > 80
                        ? "bg-red-100 text-red-600"
                        : madarsa.utilizationRate > 60
                          ? "bg-orange-100 text-orange-600"
                          : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    {madarsa.utilizationRate > 80
                      ? "UNSTABLE"
                      : madarsa.utilizationRate > 60
                        ? "FULL"
                        : "STABLE"}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col items-center">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      STD
                    </span>
                    <span className="text-lg font-black text-teal-600">
                      {madarsa.students}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col items-center">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      TEA
                    </span>
                    <span className="text-lg font-black text-blue-600">
                      {madarsa.teachers}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col items-center">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      RATIO
                    </span>
                    <span className="text-lg font-black text-indigo-600 font-mono">
                      {madarsa.ratio}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <span>Capacity Utilization</span>
                    <span>{Math.round(madarsa.utilizationRate)}%</span>
                  </div>
                  <Progress
                    value={madarsa.utilizationRate}
                    className="h-2 bg-white"
                    indicatorClassName={
                      madarsa.utilizationRate > 80
                        ? "bg-red-500"
                        : madarsa.utilizationRate > 60
                          ? "bg-orange-500"
                          : "bg-emerald-500"
                    }
                  />
                </div>
              </div>
            ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between p-6 border-t border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange("prev")}
              disabled={currentPage === 1 || loading}
              className="h-9 px-4 text-xs font-bold rounded-lg border-gray-200 hover:bg-gray-50"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1.5" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange("next")}
              disabled={currentPage === totalPages || loading}
              className="h-9 px-4 text-xs font-bold rounded-lg border-gray-200 hover:bg-gray-50"
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
