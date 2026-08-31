"use client";

import { useState, useEffect } from "react";
import useAuthStore from "@/lib/authStore";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  Users,
  GraduationCap,
  Search,
  Eye,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Filter,
  Download,
} from "lucide-react";
import { collection, getDocs, query, where, orderBy, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  madrasaMatchesMekhala,
  canonicalMekhalaName,
} from "@/lib/madrasaHierarchy";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Count students or teachers for a madarsa across ALL madarsaId storage formats,
 * optionally filtered by gender ('male' | 'female' | null).
 * Gender matching is case-insensitive (queries both 'male' and 'Male', etc.).
 */
async function countForMadarsa(collName, rawMadarsaId, gender = null) {
  if (!rawMadarsaId) return 0;
  const strId = String(rawMadarsaId);

  // Strip ANY letter-word prefix followed by a dash: "mid-", "mld-", "m-", etc.
  const numericStr = strId.replace(/^[a-zA-Z]+-/, "");
  const numericVal = Number(numericStr);

  // Build unique madarsaId variant set
  const variantSet = new Set([strId]);
  if (numericStr !== strId) variantSet.add(numericStr);
  if (Number.isFinite(numericVal) && numericVal > 0) {
    variantSet.add(numericVal);
    variantSet.add(`mid-${numericStr}`);
    variantSet.add(`mld-${numericStr}`);
  }

  // Build gender variants to cover different capitalizations stored in Firestore
  const genderVariants = gender
    ? [
        gender.toLowerCase(),
        gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase(),
        gender.toUpperCase(),
      ]
    : null;

  // Use getCountFromServer to count occurrences without downloading all documents
  const queries = [...variantSet].map(async (v) => {
    try {
      const constraints = [where("madarsaId", "==", v)];
      if (genderVariants) constraints.push(where("gender", "in", genderVariants));
      const snap = await getCountFromServer(query(collection(db, collName), ...constraints));
      return snap.data().count;
    } catch {
      return 0;
    }
  });

  const results = await Promise.all(queries);
  return results.reduce((a, b) => a + b, 0);
}

export default function MekhalaMadarsas() {
  const { user, userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [madarsas, setMadarsas] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [filterMadarsa, setFilterMadarsa] = useState("all");
  const [madarsaSearch, setMadarsaSearch] = useState("");
  const [madarsaDropdownOpen, setMadarsaDropdownOpen] = useState(false);
  const [stats, setStats] = useState({
    totalMadarsas: 0,
    totalStudents: 0,
    totalTeachers: 0,
    activeMadarsas: 0,
    totalMale: 0,
    totalFemale: 0,
  });

  useEffect(() => {
    if (userData && userData.role === "mekhala_admin") {
      const fetchMadarsasData = async () => {
        try {
          setLoading(true);

          const mekhalaId = userData.uid || userData.id;
          const isSubMekhala = userData.mekhalaDocType === "sub_mekhala";

          // ── Fetch all madarsas (common for both paths) ───────────────────
          const madarsasSnapshot = await getDocs(
            query(collection(db, "madarsas"), orderBy("name", "asc")),
          );
          const allMadarsas = madarsasSnapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));

          let uniqueFilteredMadarsas;

          if (isSubMekhala) {
            // ── Sub-mekhala login (e.g. Pothencode): scope to this mekhala only ──
            const specificName = userData.mekhalaName || userData.name || "";
            setDistricts([{ id: mekhalaId, name: specificName }]);

            uniqueFilteredMadarsas = allMadarsas.filter((m) =>
              madrasaMatchesMekhala(m, specificName),
            );
          } else {
            // ── District-level login: show all mekhalas under this district ──

            // Fetch districts from districts collection where mekhalaId matches
            const districtsSnapshot = await getDocs(
              query(
                collection(db, "districts"),
                where("mekhalaId", "==", mekhalaId),
                orderBy("name", "asc"),
              ),
            );
            const districtsData = districtsSnapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));

            // Re-fetch mekhala doc fresh to avoid stale localStorage districts
            const { doc: docRef, getDoc } = await import("firebase/firestore");
            const freshMekhalaDoc = await getDoc(
              docRef(db, "mekhala", mekhalaId),
            );
            const freshDistricts = freshMekhalaDoc.exists()
              ? freshMekhalaDoc.data().districts || []
              : userData.districts || userData.assignedDistricts || [];

            const collectionDistrictNames = districtsData.map((d) => d.name);
            const extraDistrictObjects = freshDistricts
              .filter(
                (name) =>
                  !collectionDistrictNames.some(
                    (cn) => cn.toLowerCase() === name.toLowerCase(),
                  ),
              )
              .map((name) => ({ id: `synthetic-${name}`, name }));

            setDistricts([...districtsData, ...extraDistrictObjects]);

            const allDistrictNames = Array.from(
              new Set([
                ...collectionDistrictNames.map((n) => n.toLowerCase()),
                ...freshDistricts.map((n) => n.toLowerCase()),
              ]),
            );

            const filteredMadarsas = allMadarsas.filter(
              (madarsa) =>
                allDistrictNames.some(
                  (dn) =>
                    canonicalMekhalaName(
                      madarsa.district || madarsa.mekhala || "",
                    ).toLowerCase() === canonicalMekhalaName(dn).toLowerCase(),
                ) || madarsa.mekhalaId === mekhalaId,
            );
            uniqueFilteredMadarsas = Array.from(
              new Map(filteredMadarsas.map((m) => [m.id, m])).values(),
            );
          }

          {
            // Fetch student and teacher counts — query all madarsaId variants
            // ("mid-2246", "2246", 2246) since Firestore is type-strict
            const madarsasWithCounts = await Promise.all(
              uniqueFilteredMadarsas.map(async (madarsa) => {
                try {
                  const mid = madarsa.madarsaId || madarsa.id;
                  const [teacherCount, studentCount, maleCount, femaleCount] =
                    await Promise.all([
                      countForMadarsa("teachers", mid),
                      countForMadarsa("students", mid),
                      countForMadarsa("students", mid, "male"),
                      countForMadarsa("students", mid, "female"),
                    ]);
                  return {
                    ...madarsa,
                    studentCount,
                    teacherCount,
                    maleCount,
                    femaleCount,
                  };
                } catch (error) {
                  console.error(
                    `Error fetching counts for madarsa ${madarsa.id}:`,
                    error,
                  );
                  return { ...madarsa, studentCount: 0, teacherCount: 0 };
                }
              }),
            );

            setMadarsas(madarsasWithCounts);

            // Calculate stats
            const totalStudents = madarsasWithCounts.reduce(
              (sum, m) => sum + (m.studentCount || 0),
              0,
            );
            const totalTeachers = madarsasWithCounts.reduce(
              (sum, m) => sum + (m.teacherCount || 0),
              0,
            );
            const activeMadarsas = madarsasWithCounts.filter(
              (m) => m.status === "active",
            ).length;
            const totalMale = madarsasWithCounts.reduce(
              (sum, m) => sum + (m.maleCount || 0),
              0,
            );
            const totalFemale = madarsasWithCounts.reduce(
              (sum, m) => sum + (m.femaleCount || 0),
              0,
            );

            setStats({
              totalMadarsas: madarsasWithCounts.length,
              totalStudents,
              totalTeachers,
              activeMadarsas,
              totalMale,
              totalFemale,
            });
          }
        } catch (error) {
          console.error("Error fetching madarsas:", error);
          toast.error("Failed to fetch madarsas data");
        } finally {
          setLoading(false);
        }
      };

      fetchMadarsasData();
    } else {
      setLoading(false);
    }
  }, [userData]);

  // Filter madarsas based on search term, district, and status
  const filteredMadarsas = madarsas.filter((madarsa) => {
    const matchesSearch =
      madarsa.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      madarsa.madarsaId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      madarsa.adminName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      madarsa.adminEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      madarsa.address?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMadarsa =
      filterMadarsa === "all" || madarsa.id === filterMadarsa;

    const matchesDistrict =
      filterDistrict === "all" ||
      (
        madarsa.district ||
        madarsa.mekhala ||
        madarsa.districtName ||
        ""
      ).toUpperCase() === filterDistrict.toUpperCase();
    const matchesStatus =
      filterStatus === "all" || madarsa.status === filterStatus;
    const instType = (
      madarsa.type ||
      madarsa.institutionType ||
      "Madrasa"
    ).toLowerCase();
    const matchesType =
      filterType === "all" || instType === filterType.toLowerCase();
    const matchesGender =
      filterGender === "all" ||
      (filterGender === "male"
        ? (madarsa.maleCount || 0) > 0
        : (madarsa.femaleCount || 0) > 0);

    return (
      matchesSearch &&
      matchesMadarsa &&
      matchesDistrict &&
      matchesStatus &&
      matchesType &&
      matchesGender
    );
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading madarsas...</div>
        </div>
      </Layout>
    );
  }

  if (!userData || userData.role !== "mekhala_admin") {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600">
              You need to be logged in as a Mekhala Admin to access this page.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">Madarsa Management</h1>
          <p className="text-green-100">
            Manage and monitor madarsas in your assigned districts
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Building className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total Madrasas</p>
                  <p className="text-xl font-bold">{stats.totalMadarsas}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total Students</p>
                  <p className="text-xl font-bold">{stats.totalStudents}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Male Students</p>
                  <p className="text-xl font-bold">{stats.totalMale}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Female Students</p>
                  <p className="text-xl font-bold">{stats.totalFemale}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total Teachers</p>
                  <p className="text-xl font-bold">{stats.totalTeachers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Building className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Active Madrasas</p>
                  <p className="text-xl font-bold">{stats.activeMadarsas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Madrasas Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 justify-between">
              <span className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Madrasas ({filteredMadarsas.length})
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => {
                    const headers = [
                      "Name",
                      "Mekhala",
                      "Type",
                      "Status",
                      "Students",
                      "Teachers",
                      "Admin",
                      "Phone",
                    ];
                    const rows = filteredMadarsas.map((m) => [
                      m.name || "",
                      m.district || "",
                      m.type || m.institutionType || "Madrasa",
                      m.status || "",
                      m.studentCount || 0,
                      m.teacherCount || 0,
                      m.adminName || "",
                      m.phone || "",
                    ]);
                    const csv = [headers, ...rows]
                      .map((r) =>
                        r
                          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                          .join(","),
                      )
                      .join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "madarsas.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("CSV exported successfully");
                  }}
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => {
                    try {
                      const doc = new jsPDF();
                      doc.setFontSize(14);
                      doc.text("Madrasas List", 14, 16);
                      
                      const headers = ["Name", "Mekhala", "Type", "Status", "Students", "Teachers", "Admin", "Phone"];
                      const rows = filteredMadarsas.map((m) => [
                        m.name || "",
                        m.district || "",
                        m.type || m.institutionType || "Madrasa",
                        m.status || "",
                        String(m.studentCount || 0),
                        String(m.teacherCount || 0),
                        m.adminName || "",
                        m.phone || "",
                      ]);

                      autoTable(doc, {
                        startY: 22,
                        head: [headers],
                        body: rows,
                        styles: { fontSize: 8 },
                      });
                      doc.save("madarsas.pdf");
                      toast.success("PDF exported successfully");
                    } catch (err) {
                      console.error(err);
                      toast.error("Failed to export PDF");
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              Madrasas in your assigned districts
            </CardDescription>

            {/* Search and Filters */}
            <div className="flex flex-col gap-4 mt-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by name, ID, address, admin name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-72 relative">
                  {/* Searchable madrasa filter */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder={
                        filterMadarsa === "all"
                          ? "Filter by Madrasa…"
                          : madarsas.find((m) => m.id === filterMadarsa)
                              ?.name || "Filter by Madrasa…"
                      }
                      value={madarsaSearch}
                      onFocus={() => setMadarsaDropdownOpen(true)}
                      onBlur={() =>
                        setTimeout(() => setMadarsaDropdownOpen(false), 150)
                      }
                      onChange={(e) => {
                        setMadarsaSearch(e.target.value);
                        setMadarsaDropdownOpen(true);
                      }}
                      className="pl-9 pr-8"
                    />
                    {filterMadarsa !== "all" && (
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFilterMadarsa("all");
                          setMadarsaSearch("");
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {madarsaDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
                      <button
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          filterMadarsa === "all"
                            ? "font-semibold text-green-700 bg-green-50"
                            : ""
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFilterMadarsa("all");
                          setMadarsaSearch("");
                          setMadarsaDropdownOpen(false);
                        }}
                      >
                        All Madrasas
                      </button>
                      {Array.from(
                        new Map(
                          madarsas.map((m) => [m.madarsaId || m.id, m]),
                        ).values(),
                      )
                        .filter((m) => {
                          const q = madarsaSearch.toLowerCase();
                          return (
                            !q ||
                            (m.name || "").toLowerCase().includes(q) ||
                            (m.madarsaId || "").toLowerCase().includes(q)
                          );
                        })
                        .map((m) => (
                          <button
                            key={m.id}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                              filterMadarsa === m.id ? "bg-green-50" : ""
                            }`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setFilterMadarsa(m.id);
                              setMadarsaSearch("");
                              setMadarsaDropdownOpen(false);
                            }}
                          >
                            <div className="text-sm font-medium text-gray-900">
                              {m.name || m.id}
                            </div>
                            {m.madarsaId && (
                              <div className="text-xs text-gray-400">
                                {m.madarsaId}
                              </div>
                            )}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {/* District Filter */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Mekhala:</span>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant={filterDistrict === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterDistrict("all")}
                    >
                      All
                    </Button>
                    {districts.map((district) => (
                      <Button
                        key={district.id}
                        variant={
                          filterDistrict === district.name
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => setFilterDistrict(district.name)}
                        className="max-w-[150px] truncate"
                      >
                        {district.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Type Filter */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Institution Type:</span>
                  <div className="flex gap-2 flex-wrap">
                    {["all", "Madrasa", "Mekhala", "State"].map((t) => (
                      <Button
                        key={t}
                        variant={filterType === t ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilterType(t)}
                      >
                        {t === "all" ? "All" : t}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Gender Filter */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Gender:</span>
                  <div className="flex gap-2 flex-wrap">
                    {["all", "male", "female"].map((g) => (
                      <Button
                        key={g}
                        variant={filterGender === g ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilterGender(g)}
                        className={
                          filterGender === g && g === "male"
                            ? "bg-indigo-600"
                            : filterGender === g && g === "female"
                              ? "bg-pink-600"
                              : ""
                        }
                      >
                        {g === "all"
                          ? "All Genders"
                          : g === "male"
                            ? "♂ Male"
                            : "♀ Female"}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Status:</span>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant={filterStatus === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterStatus("all")}
                    >
                      All
                    </Button>
                    <Button
                      variant={
                        filterStatus === "active" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setFilterStatus("active")}
                    >
                      Active
                    </Button>
                    <Button
                      variant={
                        filterStatus === "inactive" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setFilterStatus("inactive")}
                    >
                      Inactive
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredMadarsas.length === 0 ? (
              <div className="text-center py-12">
                <Building className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  {searchTerm ||
                  filterDistrict !== "all" ||
                  filterStatus !== "all"
                    ? "No madarsas found"
                    : "No madarsas in your districts"}
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm ||
                  filterDistrict !== "all" ||
                  filterStatus !== "all"
                    ? "Try adjusting your search criteria or filters"
                    : "Madrasas will appear here when they are added to your assigned districts"}
                </p>
                {(searchTerm ||
                  filterDistrict !== "all" ||
                  filterStatus !== "all") && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterDistrict("all");
                      setFilterStatus("all");
                      setFilterType("all");
                      setFilterMadarsa("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Madrasa Details</TableHead>
                      <TableHead>Mekhala</TableHead>
                      <TableHead>Admin Contact</TableHead>
                      <TableHead>Students (♂/♀)</TableHead>
                      <TableHead>Teachers</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMadarsas.map((madarsa) => (
                      <TableRow key={madarsa.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {madarsa.name || "N/A"}
                            </div>
                            <Badge
                              variant="outline"
                              className="mt-1 bg-blue-50 text-blue-700"
                            >
                              {madarsa.madarsaId || "N/A"}
                            </Badge>
                            <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap max-w-xs">
                              {madarsa.address || madarsa.place || madarsa.location || "Address not provided"}
                            </div>
                            {madarsa.established && (
                              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Est. {madarsa.established}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="bg-gray-100 uppercase"
                          >
                            {madarsa.district ||
                              madarsa.mekhala ||
                              madarsa.districtName ||
                              madarsa.mekhalaName ||
                              "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {madarsa.adminName || "N/A"}
                            </div>
                            <div className="text-gray-500 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {madarsa.adminEmail || "N/A"}
                            </div>
                            <div className="text-gray-500 flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {madarsa.phone || "N/A"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                                <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                              </div>
                              <span className="font-semibold">
                                {filterGender === "male"
                                  ? madarsa.maleCount || 0
                                  : filterGender === "female"
                                    ? madarsa.femaleCount || 0
                                    : madarsa.studentCount || 0}
                              </span>
                            </div>
                            {filterGender === "all" && (
                              <div className="text-xs text-gray-500 pl-9">
                                <span className="text-indigo-600">
                                  ♂ {madarsa.maleCount || 0}
                                </span>
                                {" · "}
                                <span className="text-pink-600">
                                  ♀ {madarsa.femaleCount || 0}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                              <Users className="h-4 w-4 text-purple-600" />
                            </div>
                            <span className="font-semibold">
                              {madarsa.teacherCount || 0}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              madarsa.status === "active"
                                ? "default"
                                : "secondary"
                            }
                            className={
                              madarsa.status === "active"
                                ? "bg-green-100 text-green-800"
                                : ""
                            }
                          >
                            {madarsa.status || "active"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
