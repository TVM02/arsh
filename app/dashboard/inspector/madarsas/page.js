"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import InspectorLayout from "@/components/InspectorLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building,
  Eye,
  Search,
  MapPin,
  Users,
  Calendar,
  School,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import useAuthStore from "@/lib/authStore";
import {
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  canonicalDistrictName,
  canonicalMekhalaName,
  madrasaMatchesDistrict,
  madrasaMatchesMekhala,
  getParentDistrictsForMekhalas,
  fetchMadarsasByDistricts,
  getMekhalaListForDistrict,
  DISTRICT_ORDER,
} from "@/lib/madrasaHierarchy";

export default function InspectorMadarsasPage() {
  const { user, userData } = useAuthStore();
  const [madarsas, setMadarsas] = useState([]);
  const [approvedMadarsaIds, setApprovedMadarsaIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const normalizeValue = useCallback((value) => String(value ?? "").trim(), []);

  const fetchMadarsasByIds = async (madarsaIds) => {
    const rawIds = Array.isArray(madarsaIds) ? madarsaIds : [];
    const stringIds = rawIds.map((x) => String(x ?? "").trim()).filter(Boolean);
    const numberIds = rawIds
      .map((x) => {
        if (typeof x === "number") return x;
        const s = String(x ?? "").trim();
        if (!s) return NaN;
        if (!/^\d+$/.test(s)) return NaN;
        return Number(s);
      })
      .filter((n) => Number.isFinite(n));

    if (stringIds.length === 0 && numberIds.length === 0) return [];

    const queryInChunks = async (values) => {
      const chunks = [];
      for (let i = 0; i < values.length; i += 10)
        chunks.push(values.slice(i, i + 10));
      const out = [];
      for (const chunk of chunks) {
        const snap = await getDocs(
          query(collection(db, "madarsas"), where("madarsaId", "in", chunk)),
        );
        snap.docs.forEach((doc) => out.push({ id: doc.id, ...doc.data() }));
      }
      return out;
    };

    let results = [
      ...(await queryInChunks(stringIds)),
      ...(await queryInChunks(numberIds)),
    ];

    const requestedKeys = new Set([
      ...stringIds.map((x) => String(x).trim()),
      ...numberIds.map((x) => String(x).trim()),
    ]);

    const matchedKeys = new Set(
      results.flatMap((m) => [
        String(m?.madarsaId ?? "").trim(),
        String(m?.id ?? "").trim(),
      ]),
    );

    const missingRequestedIds = Array.from(requestedKeys).filter(
      (key) => key && !matchedKeys.has(key),
    );

    if (results.length === 0 || missingRequestedIds.length > 0) {
      const allSnap = await getDocs(query(collection(db, "madarsas")));
      const allMadarsas = allSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const fallbackMatches = allMadarsas.filter((m) => {
        const docId = String(m?.id ?? "").trim();
        const madarsaId = String(m?.madarsaId ?? "").trim();
        return requestedKeys.has(docId) || requestedKeys.has(madarsaId);
      });
      results = [...results, ...fallbackMatches];
    }

    const seen = new Set();
    return results.filter((m) => {
      const mid =
        String(m?.madarsaId ?? "").trim() || String(m?.id ?? "").trim();
      if (!mid) return false;
      if (seen.has(mid)) return false;
      seen.add(mid);
      return true;
    });
  };

  const deriveMadarsasFromAssignedDistricts = async (assignedDistricts) => {
    const districts = Array.isArray(assignedDistricts)
      ? assignedDistricts
          .map((d) => canonicalDistrictName(d) || String(d || "").trim())
          .filter(Boolean)
      : [];
    if (districts.length === 0) return [];

    const values = Array.from(new Set(districts.map((d) => String(d).trim())));

    const chunks = [];
    for (let i = 0; i < values.length; i += 10) {
      chunks.push(values.slice(i, i + 10));
    }

    const queryFieldIn = async (field) => {
      const snaps = await Promise.all(
        chunks.map((chunk) =>
          getDocs(query(collection(db, "madarsas"), where(field, "in", chunk))),
        ),
      );
      const out = [];
      snaps.forEach((snap) => {
        snap.docs.forEach((doc) => out.push({ id: doc.id, ...doc.data() }));
      });
      return out;
    };

    let all = [];
    if (chunks.length > 0) {
      const [byDistrict, byDistrictName] = await Promise.all([
        queryFieldIn("district"),
        queryFieldIn("districtName"),
      ]);
      all = [...byDistrict, ...byDistrictName];
    }

    if (all.length === 0) {
      // NEW: Fast district-based query instead of full scan
      const districtChunks = [];
      for (let i = 0; i < districts.length; i += 10) {
        districtChunks.push(districts.slice(i, i + 10));
      }

      const districtMadarsas = [];
      for (const chunk of districtChunks) {
        const snap = await getDocs(
          query(
            collection(db, "madarsas"),
            where("district", "in", chunk),
            limit(100),
          ),
        );
        snap.docs.forEach((doc) =>
          districtMadarsas.push({ id: doc.id, ...doc.data() }),
        );
      }

      all =
        districtMadarsas.length > 0
          ? districtMadarsas
          : // ULTIMATE fallback with limit
            (
              await getDocs(query(collection(db, "madarsas"), limit(200)))
            ).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }

    const filtered = all.filter((m) =>
      districts.some((d) => {
        try {
          if (!madrasaMatchesDistrict(m, d)) return false;
          return !!String(m?.district || m?.districtName || "").trim();
        } catch {
          return false;
        }
      }),
    );

    const seen = new Set();
    return filtered.filter((m) => {
      const mid = String(m?.madarsaId || "").trim();
      if (!mid) return false;
      if (seen.has(mid)) return false;
      seen.add(mid);
      return true;
    });
  };

  const filterAssignedMadarsas = useCallback(
    (madarsasData, assignedDistricts) => {
      const canonicalDistricts = Array.isArray(assignedDistricts)
        ? assignedDistricts
            .map((d) => canonicalDistrictName(d) || String(d || "").trim())
            .filter(Boolean)
        : [];

      if (canonicalDistricts.length === 0) {
        return Array.isArray(madarsasData) ? madarsasData : [];
      }

      return (Array.isArray(madarsasData) ? madarsasData : []).filter(
        (madarsa) =>
          canonicalDistricts.some((district) => {
            try {
              return madrasaMatchesDistrict(madarsa, district);
            } catch {
              return false;
            }
          }),
      );
    },
    [],
  );

  useEffect(() => {
    const fetchAssignedMadarsas = async () => {
      try {
        setLoading(true);
        setError("");

        const madarsaIds = Array.isArray(userData?.assignedMadarsas)
          ? userData.assignedMadarsas
          : [];
        const districts = Array.isArray(userData?.assignedDistricts)
          ? userData.assignedDistricts
          : userData?.assignedDistrict
            ? [userData.assignedDistrict]
            : [];
        const assignedMekhalas = Array.isArray(userData?.assignedMekhalas)
          ? userData.assignedMekhalas.filter(Boolean)
          : [];

        if (
          madarsaIds.length === 0 &&
          districts.length === 0 &&
          assignedMekhalas.length === 0
        ) {
          setLoading(false);
          return;
        }

        // If mekhalas assigned, fetch madarsas in parent districts and filter by mekhala name
        let mekhalaBasedMadarsas = [];
        if (assignedMekhalas.length > 0) {
          const parentDistricts = getParentDistrictsForMekhalas(assignedMekhalas);
          const targetDistricts = parentDistricts.length > 0 ? parentDistricts : DISTRICT_ORDER;
          const candidateMadarsas = await fetchMadarsasByDistricts(
            db,
            query,
            collection,
            where,
            getDocs,
            targetDistricts
          );
          mekhalaBasedMadarsas = candidateMadarsas.filter((m) =>
            assignedMekhalas.some((mek) => {
              try {
                return madrasaMatchesMekhala(m, mek);
              } catch {
                return false;
              }
            }),
          );
        }

        let madarsasData =
          madarsaIds.length > 0
            ? await fetchMadarsasByIds(madarsaIds)
            : districts.length > 0
              ? await deriveMadarsasFromAssignedDistricts(districts)
              : [];
        if (
          madarsaIds.length > 0 &&
          madarsasData.length === 0 &&
          districts.length > 0
        ) {
          madarsasData = await deriveMadarsasFromAssignedDistricts(districts);
        }

        // Merge mekhala-based madarsas with district/id-based madarsas
        const merged = [...madarsasData, ...mekhalaBasedMadarsas];
        const seen = new Set();
        const deduped = merged.filter((m) => {
          const key = [
            m?.madarsaId,
            m?.id,
            m?.name,
            m?.address,
          ]
            .map((value) => String(value || "").trim().toLowerCase())
            .filter(Boolean)
            .join("|");
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Apply district filter only if districts are assigned (skip if only mekhalas)
        let filteredMadarsas =
          districts.length > 0
            ? filterAssignedMadarsas(deduped, districts)
            : deduped;

        // Filter out madarsas with empty mekhala fields to match the Central Admin districts portal count (e.g. 154 instead of 156)
        if (districts.length > 0) {
          filteredMadarsas = filteredMadarsas.filter((m) => {
            return !!String(m?.district || m?.districtName || "").trim();
          });
        }

        if (!filteredMadarsas || filteredMadarsas.length === 0) {
          setError(
            assignedMekhalas.length > 0
              ? `No madarsas found for the assigned mekhalas: ${assignedMekhalas.join(", ")}`
              : districts.length > 0
                ? "No madarsas found for the assigned districts."
                : "No madarsas found for the assigned IDs.",
          );
          setLoading(false);
          return;
        }

        setMadarsas(filteredMadarsas);

        // Fetch approved inspections for this inspector (used to block re-inspection)
        try {
          const approvedSnap = await getDocs(
            query(
              collection(db, "inspections"),
              where("inspectorId", "==", user?.uid || ""),
              where("status", "==", "approved"),
            ),
          );
          const ids = new Set();
          approvedSnap.docs.forEach((d) => {
            const data = d.data();
            const mid = String(
              data?.selectedMadarsaId || data?.madarsaId || "",
            ).trim();
            if (mid) ids.add(mid);
          });
          setApprovedMadarsaIds(ids);
        } catch {
          setApprovedMadarsaIds(new Set());
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching assigned madarsas:", error);
        setError("Failed to load assigned madarsas. Please try again.");
        setLoading(false);
      }
    };

    if (userData) {
      fetchAssignedMadarsas();
    }
  }, [filterAssignedMadarsas, user?.uid, userData]);

  const filteredMadarsas = useMemo(() => {
    const term = normalizeValue(searchTerm).toLowerCase();
    if (!term) return madarsas;

    return madarsas.filter((madarsa) => {
      const haystack = [
        normalizeValue(madarsa?.name),
        normalizeValue(madarsa?.madarsaId),
        normalizeValue(madarsa?.address),
        normalizeValue(madarsa?.district),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [madarsas, normalizeValue, searchTerm]);

  if (loading) {
    return (
      <InspectorLayout>
        <div className="p-6 space-y-6">
          {/* Header Skeleton */}
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
          </div>

          {/* Search Skeleton */}
          <div className="h-10 bg-gray-200 rounded w-80 animate-pulse"></div>

          {/* Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </InspectorLayout>
    );
  }

  return (
    <InspectorLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              Assigned Madrasas
            </h1>
            <p className="text-gray-600 mt-1">
              Manage and inspect your assigned madarsas ({madarsas.length}{" "}
              total)
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Search and Stats */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search madarsas by name, ID, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 border-gray-200 focus:border-teal-500 focus:ring-teal-500"
            />
          </div>

          {searchTerm && (
            <div className="text-sm text-gray-600">
              Showing {filteredMadarsas.length} of {madarsas.length} madarsas
            </div>
          )}
        </div>

        {/* Madrasas Grid */}
        {filteredMadarsas.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-200">
            <CardContent className="text-center py-16">
              <div className="flex flex-col items-center space-y-4">
                <div className="rounded-full bg-gray-100 p-4">
                  <Building className="h-12 w-12 text-gray-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {madarsas.length === 0
                      ? "No Madrasas Assigned"
                      : "No Results Found"}
                  </h3>
                  <p className="text-gray-600 max-w-sm">
                    {madarsas.length === 0
                      ? "You haven't been assigned any madarsas yet. Contact your administrator for assignments."
                      : `No madarsas match "${searchTerm}". Try adjusting your search terms.`}
                  </p>
                </div>
                {searchTerm && (
                  <Button
                    variant="outline"
                    onClick={() => setSearchTerm("")}
                    className="mt-4"
                  >
                    Clear Search
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMadarsas.map((madarsa) => (
              <Card
                key={madarsa.id}
                className="hover:shadow-lg transition-all duration-200 border-gray-200 hover:border-teal-300 group"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-teal-600 transition-colors truncate">
                        {madarsa.name}
                      </CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-1">
                        <span className="text-xs text-gray-500">ID:</span>
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          {madarsa.madarsaId}
                        </code>
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        madarsa.status === "active" ? "default" : "secondary"
                      }
                      className={
                        madarsa.status === "active"
                          ? "bg-green-100 text-green-800 border-green-200"
                          : "bg-gray-100 text-gray-600"
                      }
                    >
                      {madarsa.status || "active"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Location */}
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {madarsa.address}
                      </p>
                      {madarsa.district && (
                        <p className="text-xs text-gray-500 mt-1">
                          District: {madarsa.district}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 p-2 bg-teal-50 rounded-lg">
                      <Users className="h-4 w-4 text-teal-600" />
                      <div>
                        <p className="text-sm font-medium text-teal-900">
                          {madarsa.studentCount}
                        </p>
                        <p className="text-xs text-teal-600">Students</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                      <Users className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-900">
                          {madarsa.teacherCount}
                        </p>
                        <p className="text-xs text-green-600">Teachers</p>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <span className="text-gray-500 text-xs">
                        Established:
                      </span>
                      <p className="font-medium text-gray-700">
                        {madarsa.established || "N/A"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-500 text-xs">Capacity:</span>
                      <p className="font-medium text-gray-700">
                        {madarsa.capacity || "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  {madarsa.description && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                        {madarsa.description}
                      </p>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="pt-2">
                    {approvedMadarsaIds.has(madarsa.madarsaId) ? (
                      <Button className="w-full" variant="outline" disabled>
                        Already Inspected
                      </Button>
                    ) : (
                      <Button
                        asChild
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                      >
                        <Link
                          href={`/dashboard/inspector/madarsas/${madarsa.madarsaId}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Start Inspection
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </InspectorLayout>
  );
}
