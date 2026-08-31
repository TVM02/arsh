"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import useAuthStore from "@/lib/authStore";
import ProtectedRoute from "@/components/ProtectedRoute";
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
  MapPin,
  Building,
  Users,
  GraduationCap,
  Search,
  Calendar,
  Bell,
  Eye,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
  doc,
  getDoc,
} from "firebase/firestore";

// Count students/teachers for a single madarsa across all ID storage variants.
async function countForMadarsa(collName, rawMadarsaId) {
  if (!rawMadarsaId) return 0;
  const strId = String(rawMadarsaId);
  const numericStr = strId.replace(/^[a-zA-Z]+-/, "");
  const numericVal = Number(numericStr);

  const strVariants = new Set([
    strId,
    numericStr,
    `mid-${numericStr}`,
    `mld-${numericStr}`,
  ]);
  const numVariants =
    Number.isFinite(numericVal) && numericVal > 0 ? [numericVal] : [];

  const queries = [
    ...[...strVariants].map((v) =>
      getCountFromServer(query(collection(db, collName), where("madarsaId", "==", v)))
        .then((s) => s.data().count)
        .catch(() => 0),
    ),
    ...numVariants.map((v) =>
      getCountFromServer(query(collection(db, collName), where("madarsaId", "==", v)))
        .then((s) => s.data().count)
        .catch(() => 0),
    ),
  ];
  const results = await Promise.all(queries);
  return results.reduce((a, b) => a + b, 0);
}

// Count docs for a list of madarsaIds, expanding each to all storage variants.
// Runs separate in-queries for string variants and number variants (Firestore
// does not support mixed-type arrays in 'in' queries reliably).
async function batchCount(collName, ids) {
  if (!ids.length) return 0;

  const stringVariants = new Set();
  const numberVariants = new Set();

  for (const rawId of ids) {
    const strId = String(rawId);
    const numericStr = strId.replace(/^[a-zA-Z]+-/, "");
    const numericVal = Number(numericStr);

    stringVariants.add(strId);
    stringVariants.add(numericStr);
    stringVariants.add(`mid-${numericStr}`);
    stringVariants.add(`mld-${numericStr}`);
    if (Number.isFinite(numericVal) && numericVal > 0) {
      numberVariants.add(numericVal);
    }
  }

  const strArr = [...stringVariants];
  const numArr = [...numberVariants];

  // Chunk helper — Firestore 'in' limit is 30 items
  const chunk = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size)
      chunks.push(arr.slice(i, i + size));
    return chunks;
  };

  const strQueries = chunk(strArr, 30).map((c) =>
    getCountFromServer(
      query(collection(db, collName), where("madarsaId", "in", c)),
    )
      .then((s) => s.data().count)
      .catch(() => 0),
  );
  const numQueries =
    numArr.length > 0
      ? chunk(numArr, 30).map((c) =>
        getCountFromServer(
          query(collection(db, collName), where("madarsaId", "in", c)),
        )
          .then((s) => s.data().count)
          .catch(() => 0),
      )
      : [];

  const results = await Promise.all([...strQueries, ...numQueries]);
  return results.reduce((a, b) => a + b, 0);
}
import { db } from "@/lib/firebase";
import { madrasaMatchesMekhala } from "@/lib/madrasaHierarchy";
import { toast } from "sonner";

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

export default function MekhalaDashboard() {
  const { user, userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [districts, setDistricts] = useState([]);
  const [madarsas, setMadarsas] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [notices, setNotices] = useState([]);
  const [parentDistrict, setParentDistrict] = useState("");
  const [stats, setStats] = useState({
    totalDistricts: 0,
    totalMadarsas: 0,
    totalStudents: 0,
    totalTeachers: 0,
  });

  // Simple cache to avoid refetching data unnecessarily
  const [dataCache, setDataCache] = useState({
    timestamp: null,
    data: null,
  });

  // Memoize filtered madarsas to avoid unnecessary recalculations
  const filteredMadarsas = useMemo(() => {
    if (!searchTerm) return madarsas;
    return madarsas.filter(
      (madarsa) =>
        madarsa.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        madarsa.district?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        madarsa.madarsaId?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [madarsas, searchTerm]);

  // Optimized data fetching function with progressive loading and caching
  const fetchMekhalaData = useCallback(async () => {
    try {
      // Check cache first
      const now = Date.now();
      if (
        dataCache.timestamp &&
        now - dataCache.timestamp < CACHE_DURATION &&
        dataCache.data
      ) {
        console.log("Using cached data");
        const cached = dataCache.data;
        setDistricts(cached.districts);
        setMadarsas(cached.madarsas);
        setStats(cached.stats);
        setLoading(false);
        setLoadingStats(false);
        return;
      }

      setLoading(true);
      setLoadingStats(true);
      // console.log('Fetching fresh mekhala data for:', userData);

      const mekhalaId = userData.uid || userData.id;
      const isSubMekhala = userData.mekhalaDocType === "sub_mekhala";

      // ── Sub-mekhala login (e.g. Pothencode) ──────────────────────────────────
      if (isSubMekhala) {
        const specificName = userData.mekhalaName || userData.name || "";
        setDistricts([{ id: mekhalaId, name: specificName }]);
        // Fetch parent district name from mekhala collection
        const parentId = userData.parentMekhalaId || userData.mekhalaId;
        if (parentId) {
          getDoc(doc(db, "mekhala", parentId))
            .then((snap) => {
              if (snap.exists())
                setParentDistrict(
                  snap.data().district || snap.data().name || "",
                );
            })
            .catch(() => { });
        }

        const madarsasSnapshot = await getDocs(
          query(collection(db, "madarsas"), orderBy("name", "asc")),
        );
        const allMadarsas = madarsasSnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        const filteredMadarsasData = allMadarsas.filter((m) =>
          madrasaMatchesMekhala(m, specificName),
        );
        setMadarsas(filteredMadarsasData);
        setLoading(false);

        // Attach per-madarsa counts
        const madarsasWithCounts = await Promise.all(
          filteredMadarsasData.map(async (m) => {
            const mid = m.madarsaId || m.id;
            const [studentCount, teacherCount] = await Promise.all([
              countForMadarsa("students", mid),
              countForMadarsa("teachers", mid),
            ]);
            return { ...m, studentCount, teacherCount };
          }),
        );
        setMadarsas(madarsasWithCounts);

        const totalStudents = madarsasWithCounts.reduce(
          (s, m) => s + (m.studentCount || 0),
          0,
        );
        const totalTeachers = madarsasWithCounts.reduce(
          (s, m) => s + (m.teacherCount || 0),
          0,
        );

        setStats({
          totalDistricts: 1,
          totalMadarsas: madarsasWithCounts.length,
          totalStudents,
          totalTeachers,
        });
        setLoadingStats(false);
        return;
      }

      // ── District-level login (original logic) ────────────────────────────────

      // Step 1: Fetch districts first (fastest query)
      const districtsQuery = query(
        collection(db, "districts"),
        where("mekhalaId", "==", mekhalaId),
        orderBy("name", "asc"),
      );
      const districtsSnapshot = await getDocs(districtsQuery);
      const districtsData = districtsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDistricts(districtsData);

      // Merge district names from collection + userData.districts array
      // (userData.districts covers entries like Pothencode that may lack a districts-collection doc)
      const collectionDistrictNames = districtsData.map((d) => d.name);
      const userDataDistricts =
        userData.districts || userData.assignedDistricts || [];
      const allDistrictNamesLower = new Set([
        ...collectionDistrictNames.map((n) => n.toLowerCase()),
        ...userDataDistricts.map((n) => n.toLowerCase()),
      ]);

      // Update basic stats immediately
      const basicStats = {
        totalDistricts: allDistrictNamesLower.size,
        totalMadarsas: 0,
        totalStudents: 0,
        totalTeachers: 0,
      };
      setStats(basicStats);

      // Step 2: Fetch madarsas next to show UI faster
      const madarsasQuery = query(
        collection(db, "madarsas"),
        orderBy("name", "asc"),
      );
      const madarsasSnapshot = await getDocs(madarsasQuery);
      const allMadarsas = madarsasSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter madarsas: by district name (case-insensitive) OR direct mekhalaId tag
      const filteredMadarsasData = Array.from(
        new Map(
          allMadarsas
            .filter(
              (madarsa) =>
                allDistrictNamesLower.has(madarsa.district?.toLowerCase()) ||
                madarsa.mekhalaId === mekhalaId,
            )
            .map((m) => [m.id, m]),
        ).values(),
      );
      setMadarsas(filteredMadarsasData);

      // Update madarsas count immediately
      const updatedStats = {
        ...basicStats,
        totalMadarsas: filteredMadarsasData.length,
      };
      setStats(updatedStats);

      // Show main UI now, continue loading stats in background
      setLoading(false);

      // Step 3: Get total counts using efficient batched in-queries (no per-doc download)
      const allIds = filteredMadarsasData.map((m) => m.madarsaId || m.id);
      const [totalStudents, totalTeachers] = await Promise.all([
        batchCount("students", allIds),
        batchCount("teachers", allIds),
      ]);

      const finalStats = {
        totalDistricts: allDistrictNamesLower.size,
        totalMadarsas: filteredMadarsasData.length,
        totalStudents,
        totalTeachers,
      };
      setStats(finalStats);

      // Cache the data
      setDataCache({
        timestamp: now,
        data: {
          districts: districtsData,
          madarsas: filteredMadarsasData,
          stats: finalStats,
        },
      });

      setLoadingStats(false);

      // Step 4: Fetch recent notices for marquee (limit to 5)
      try {
        const noticesQuery = query(
          collection(db, "notices"),
          where("showOnDashboard", "==", true),
          orderBy("createdAt", "desc"),
          limit(5),
        );
        const noticesSnapshot = await getDocs(noticesQuery);
        const noticesData = noticesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          expiryDate: doc.data().expiryDate?.toDate(),
        }));

        // Filter out expired notices and by targetAudience
        const currentDate = new Date();
        const validNotices = noticesData.filter((notice) => {
          if (notice.expiryDate && notice.expiryDate <= currentDate)
            return false;
          const audience = notice.targetAudience?.toLowerCase();
          return audience === "all" || audience === "mekhala";
        });

        setNotices(validNotices);
      } catch (noticeError) {
        console.error("Error fetching notices:", noticeError);
        // Don't show error toast for notices, just log it
      }
    } catch (error) {
      console.error("Error fetching mekhala data:", error);
      toast.error("Failed to fetch dashboard data");
      setLoading(false);
      setLoadingStats(false);
    }
  }, [userData, dataCache.timestamp, dataCache.data]);

  useEffect(() => {
    // console.log('Mekhala Dashboard - Store State Check:');
    // console.log('- userData:', userData);
    // console.log('- user:', user);
    // console.log('- localStorage auth-storage:', localStorage.getItem('auth-storage'));

    // Add a check for userData existence and role
    if (userData) {
      console.log("UserData exists with role:", userData.role);

      if (userData.role === "mekhala_admin") {
        fetchMekhalaData();
      } else {
        // console.log('User role is not mekhala_admin:', userData.role);
        setLoading(false);
      }
    } else if (!userData && user) {
      // console.log('No userData but user exists, initializing...');
      // Give time for userData to load
      setTimeout(() => {
        if (!userData) {
          // console.log('Still no userData after timeout');
          setLoading(false);
        }
      }, 3000);
    } else {
      // console.log('No user or userData');
      setLoading(false);
    }
  }, [userData, user, fetchMekhalaData]);

  // Filter madarsas based on search term

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading dashboard...</div>
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
              You need to be logged in as an Admin to access this page.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const isDistrictAdmin = userData.portalType
    ? userData.portalType === "district_portal"
    : userData.mekhalaDocType !== "sub_mekhala";
  const portalName = isDistrictAdmin ? "District" : "Mekhala";
  const managedEntityName = isDistrictAdmin ? "Mekhala" : "Sub-Mekhala";
  const managedEntitiesName = isDistrictAdmin ? "Mekhalas" : "Sub-Mekhalas";
  const basePath = userData.portalType === "mekhala_portal" ? "/dashboard/mekhala-portal" : "/dashboard/district";

  return (
    <ProtectedRoute requiredRole="mekhala_admin">
      <Layout>
        <div className="space-y-6">
          {/* Marquee Notice Banner */}
          {notices.length > 0 && (
            <div className="bg-green-600 text-white py-2 sm:py-3 px-4 rounded-lg shadow-md overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <Bell className="h-4 w-4 flex-shrink-0 animate-pulse" />
                <span className="text-xs sm:text-sm font-semibold">
                  Latest Notices:
                </span>
              </div>
              <div className="relative overflow-hidden">
                <div className="animate-marquee whitespace-nowrap inline-block">
                  {[...notices, ...notices].map((notice, index) => (
                    <span
                      key={`${notice.id}-${index}`}
                      className="inline-flex items-center mr-8 sm:mr-12"
                    >
                      <span className="text-sm sm:text-base font-medium">
                        {notice.title}
                      </span>
                      <span className="mx-2 sm:mx-3 text-green-200">•</span>
                      <span className="text-xs sm:text-sm text-green-100">
                        {notice.content?.substring(0, 100)}...
                      </span>
                      {index < notices.length * 2 - 1 && (
                        <span className="mx-3 sm:mx-4 text-green-300">|</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Welcome Section */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
            <h1 className="text-2xl font-bold mb-2">
              {portalName} Administration Dashboard
            </h1>
            <p className="text-blue-100">
              Welcome back, {userData.name} - Manage your assigned {managedEntitiesName.toLowerCase()} and
              madarsas.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{managedEntitiesName}</p>
                    <p className="text-2xl font-bold">
                      {loading ? (
                        <span className="animate-pulse bg-gray-300 rounded h-6 w-12 block"></span>
                      ) : (
                        stats.totalDistricts
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Building className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Madrasas</p>
                    <p className="text-2xl font-bold">
                      {loading ? (
                        <span className="animate-pulse bg-gray-300 rounded h-6 w-12 block"></span>
                      ) : (
                        stats.totalMadarsas
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <GraduationCap className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Students</p>
                    <p className="text-2xl font-bold">
                      {loadingStats ? (
                        <span className="animate-pulse bg-gray-300 rounded h-6 w-12 block"></span>
                      ) : (
                        stats.totalStudents.toLocaleString()
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Teachers</p>
                    <p className="text-2xl font-bold">
                      {loadingStats ? (
                        <span className="animate-pulse bg-gray-300 rounded h-6 w-12 block"></span>
                      ) : (
                        stats.totalTeachers.toLocaleString()
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Management Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{managedEntityName} Management</CardTitle>
                <CardDescription>
                  Your assigned {managedEntityName.toLowerCase()} and administration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-gray-600 mb-4">
                  You have {districts.length} {managedEntityName.toLowerCase()}(s) assigned to you
                </div>
                {districts.length === 0 ? (
                  <div className="text-center py-8">
                    <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No {managedEntitiesName.toLowerCase()} assigned
                    </h3>
                    <p className="text-gray-500">
                      Contact the central admin to get {managedEntitiesName.toLowerCase()} assigned.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {districts.slice(0, 5).map((district) => (
                      <div
                        key={district.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium">
                            {parentDistrict || district.name}
                          </div>
                          {district.description && (
                            <div className="text-sm text-gray-500">
                              {district.description}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {districts.length > 5 && (
                      <div className="text-sm text-gray-500 text-center pt-2">
                        and {districts.length - 5} more {managedEntitiesName.toLowerCase()}...
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common {portalName.toLowerCase()} administrative tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() =>
                    (window.location.href = `${basePath}/notices`)
                  }
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Manage Notices
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  disabled={madarsas.length === 0}
                  onClick={() => {
                    // Scroll to madarsas section
                    document
                      .getElementById("madarsas-section")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Building className="h-4 w-4 mr-2" />
                  View Madrasas ({madarsas.length})
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  disabled={stats.totalStudents === 0}
                  onClick={() =>
                    (window.location.href = `${basePath}/students`)
                  }
                >
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Student Overview ({stats.totalStudents})
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  disabled={stats.totalTeachers === 0}
                  onClick={() =>
                    (window.location.href = `${basePath}/teachers`)
                  }
                >
                  <Users className="h-4 w-4 mr-2" />
                  Teacher Overview ({stats.totalTeachers})
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Madrasas in Districts */}
          <Card id="madarsas-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Madrasas in Your {managedEntitiesName} ({filteredMadarsas.length})
              </CardTitle>
              <CardDescription>
                Madrasas located in your assigned {managedEntitiesName.toLowerCase()}
              </CardDescription>

              {/* Search */}
              {madarsas.length > 0 && (
                <div className="flex gap-4 mt-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search madarsas by name, district, or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                // Skeleton loading for madarsas table
                <div className="space-y-4">
                  <div className="animate-pulse bg-gray-200 rounded h-4 w-1/4"></div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name & ID</TableHead>
                          <TableHead>District</TableHead>
                          <TableHead>Admin Contact</TableHead>
                          <TableHead>Students</TableHead>
                          <TableHead>Teachers</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...Array(5)].map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <div className="space-y-2">
                                <div className="animate-pulse bg-gray-200 rounded h-4 w-32"></div>
                                <div className="animate-pulse bg-gray-200 rounded h-3 w-20"></div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="animate-pulse bg-gray-200 rounded h-4 w-24"></div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="animate-pulse bg-gray-200 rounded h-3 w-28"></div>
                                <div className="animate-pulse bg-gray-200 rounded h-3 w-32"></div>
                                <div className="animate-pulse bg-gray-200 rounded h-3 w-24"></div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="animate-pulse bg-gray-200 rounded h-4 w-8"></div>
                            </TableCell>
                            <TableCell>
                              <div className="animate-pulse bg-gray-200 rounded h-4 w-8"></div>
                            </TableCell>
                            <TableCell>
                              <div className="animate-pulse bg-gray-200 rounded h-4 w-16"></div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : filteredMadarsas.length === 0 ? (
                <div className="text-center py-12">
                  <Building className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">
                    {searchTerm
                      ? "No madarsas found"
                      : `No madarsas in your ${managedEntitiesName.toLowerCase()}`}
                  </h3>
                  <p className="text-gray-500 mb-6">
                    {searchTerm
                      ? "Try adjusting your search criteria"
                      : `Madrasas will appear here when they are added to your assigned ${managedEntitiesName.toLowerCase()}`}
                  </p>
                  {searchTerm && (
                    <Button variant="outline" onClick={() => setSearchTerm("")}>
                      Clear Search
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name & ID</TableHead>
                        <TableHead>District</TableHead>
                        <TableHead>Admin Contact</TableHead>
                        <TableHead>Students</TableHead>
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
                              {madarsa.established && (
                                <div className="text-xs text-gray-500 mt-1">
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
                                "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {madarsa.adminName || "N/A"}
                              </div>
                              <div className="text-gray-500">
                                {madarsa.adminEmail || "N/A"}
                              </div>
                              <div className="text-gray-500">
                                {madarsa.phone || "N/A"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <GraduationCap className="h-4 w-4 text-green-600" />
                              </div>
                              <span className="font-semibold">
                                {madarsa.studentCount || 0}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <Users className="h-4 w-4 text-blue-600" />
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
    </ProtectedRoute>
  );
}
