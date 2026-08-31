"use client";

import { useState, useEffect } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FolderOpen, FileText, Calendar, Eye, Building, Download } from "lucide-react";
import useAuthStore from "@/lib/authStore";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { canonicalDistrictName, madrasaMatchesDistrict } from "@/lib/madrasaHierarchy";
import Link from "next/link";

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

  const results = [
    ...(await queryInChunks(stringIds)),
    ...(await queryInChunks(numberIds)),
  ];

  const seen = new Set();
  return results.filter((m) => {
    const mid = String(m?.madarsaId ?? "").trim();
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

  let all = [];
  if (chunks.length > 0) {
    const snaps = await Promise.all([
      ...chunks.map((chunk) => getDocs(query(collection(db, "madarsas"), where("district", "in", chunk)))),
      ...chunks.map((chunk) => getDocs(query(collection(db, "madarsas"), where("districtName", "in", chunk))))
    ]);
    snaps.forEach((snap) => {
      snap.docs.forEach((doc) => all.push({ id: doc.id, ...doc.data() }));
    });
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

export default function InspectorRecordsPage() {
  const { user, userData, activeInspectorDistrict } = useAuthStore();
  const [madarsas, setMadarsas] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMadarsasAndRecords = async () => {
      try {
        setLoading(true);
        let madarsaIds = activeInspectorDistrict ? [] : (Array.isArray(userData?.assignedMadarsas)
          ? userData.assignedMadarsas
          : []);
        let districts = activeInspectorDistrict 
          ? [activeInspectorDistrict]
          : (Array.isArray(userData?.assignedDistricts)
            ? userData.assignedDistricts
            : userData?.assignedDistrict
              ? [userData.assignedDistrict]
              : []);

        let sourceMadarsaId = null;
        if (typeof window !== "undefined") {
          const urlParams = new URLSearchParams(window.location.search);
          sourceMadarsaId = urlParams.get("sourceMadarsaId");
        }

        if (sourceMadarsaId) {
          const srcData = await fetchMadarsasByIds([sourceMadarsaId]);
          if (srcData.length > 0) {
            const m = srcData[0];
            const dist = canonicalDistrictName(m.district || m.districtName) || m.district || m.districtName;
            if (dist && districts.length > 0) {
               const canonDist = String(dist).toLowerCase();
               const isAllowed = districts.some(d => String(canonicalDistrictName(d) || d).toLowerCase() === canonDist);
               
               if (isAllowed || activeInspectorDistrict) {
                 districts = []; // Clear explicit districts to NOT fetch all records for this district
                 madarsaIds = [sourceMadarsaId]; // ONLY fetch records for this madarsa
               }
            }
          }
        }

        if (madarsaIds.length === 0 && districts.length === 0) {
          setLoading(false);
          return;
        }

        let madarsasData =
          madarsaIds.length > 0
            ? await fetchMadarsasByIds(madarsaIds)
            : await deriveMadarsasFromAssignedDistricts(districts);
            
        if (madarsaIds.length > 0 && madarsasData.length === 0 && districts.length > 0) {
          madarsasData = await deriveMadarsasFromAssignedDistricts(districts);
        }
        setMadarsas(madarsasData);

        if (madarsasData.length > 0) {
          const mIds = madarsasData.map(m => m.madarsaId);
          // Optimize query: only fetch approved reports
          const approvedQuery = query(collection(db, "inspections"), where("status", "==", "approved"));
          
          const approvedSnap = await getDocs(approvedQuery);
          
          const allRecords = approvedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          // Filter by assigned madarsas and ensure we only show actual inspection reports, not static uploaded documents
          const filteredRecords = allRecords.filter(d => 
            (mIds.includes(d.madarsaId) || mIds.includes(d.selectedMadarsaId)) && d.isRecord !== true
          );

          filteredRecords.sort((a, b) => {
            const ta = a.uploadedAt?.toDate ? a.uploadedAt.toDate().getTime() : 
                       (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0);
            const tb = b.uploadedAt?.toDate ? b.uploadedAt.toDate().getTime() : 
                       (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0);
            return tb - ta;
          });
          setRecords(filteredRecords);
        }
      } catch (error) {
        console.error("Error fetching madarsas and records:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user && userData) {
      fetchMadarsasAndRecords();
    }
  }, [user, userData]);

  return (
    <InspectorLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Historical Records</h1>
          <p className="text-gray-600">
            View approved inspection reports and static records for your assigned madarsas.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-indigo-600" />
              {madarsas.length === 1 && madarsas[0].madarsaId === (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("sourceMadarsaId") : null) 
                ? `${madarsas[0].name} Records`
                : "All Assigned Madrasa Records"}
            </CardTitle>
            <CardDescription>
              {madarsas.length === 1 && madarsas[0].madarsaId === (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("sourceMadarsaId") : null) 
                ? `Showing historical records for ${madarsas[0].name}.`
                : "Showing isolated records across all your assigned jurisdictions."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading records...</p>
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg bg-gray-50 border-gray-200">
                <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No records found</p>
                <p className="text-sm text-gray-400 mt-1">There are no approved reports or records for your assigned madarsas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-lg shadow-sm">
                <Table className="w-full text-sm">
                  <TableHeader className="bg-gray-50/80">
                    <TableRow>
                      <TableHead className="font-semibold text-gray-600">Madrasa</TableHead>
                      <TableHead className="font-semibold text-gray-600">Document Type</TableHead>
                      <TableHead className="font-semibold text-gray-600">Date</TableHead>
                      <TableHead className="font-semibold text-gray-600 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100">
                    {records.map((record) => {
                      const mId = record.madarsaId || record.selectedMadarsaId;
                      const madarsa = madarsas.find((m) => m.madarsaId === mId);
                      return (
                        <TableRow key={record.id} className="hover:bg-gray-50/50 transition-colors">
                          <TableCell className="align-top py-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-gray-900">
                                {madarsa?.name || record.madarsaName || "Unknown Madrasa"}
                              </span>
                              <span className="text-xs text-gray-500 font-mono">MID: {mId}</span>
                            </div>
                          </TableCell>
                          <TableCell className="align-top py-4">
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-emerald-500" />
                              <span className="font-medium text-gray-800">Inspection Report</span>
                              {record.inspectionType && (
                                <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full capitalize">
                                  {record.inspectionType}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top py-4">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {record.submittedAt?.toDate
                                  ? record.submittedAt.toDate().toLocaleDateString()
                                  : record.createdAt?.toDate 
                                    ? record.createdAt.toDate().toLocaleDateString() 
                                    : "N/A"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="align-top py-4 text-right">
                            <Button variant="outline" size="sm" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 border-indigo-200" asChild>
                              <Link href={`/dashboard/inspector/inspections/${record.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Report
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </InspectorLayout>
  );
}
