"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Layout from "@/components/Layout";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Users, Phone, Search, Loader2 } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Pagination } from "@/components/ui/pagination";
import {
  canonicalDistrictName,
  canonicalMekhalaName,
  madrasaMatchesDistrict,
  madrasaMatchesMekhala,
} from "@/lib/madrasaHierarchy";

const getCleanPhone = (phone, loginId) => {
  const p = String(phone || "").trim();
  const l = String(loginId || "").trim();
  const isPhone = (val) => {
    const cleaned = val.replace(/\D/g, "");
    return cleaned.length >= 8 && !/[a-zA-Z]/.test(val);
  };
  if (p && isPhone(p)) return p;
  if (l && isPhone(l)) return l;
  return "N/A";
};

export default function InspectorContactsPage() {
  const { userData } = useAuthStore();
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filters
  const [roleFilter, setRoleFilter] = useState("all_contacts");
  const [searchTerm, setSearchTerm] = useState("");

  const [madrasas, setMadrasas] = useState([]);
  const [madrasaMap, setMadrasaMap] = useState(new Map());

  // Resolve assigned scope from Inspector userData
  const allowedDistricts = useMemo(() => {
    const raw = Array.isArray(userData?.assignedDistricts)
      ? userData.assignedDistricts
      : userData?.assignedDistrict
        ? [userData.assignedDistrict]
        : [];
    return Array.from(new Set(raw.map((d) => canonicalDistrictName(d) || String(d || "").trim()).filter(Boolean)));
  }, [userData]);

  const allowedMekhalas = useMemo(() => {
    const raw = Array.isArray(userData?.assignedMekhalas) ? userData.assignedMekhalas : [];
    return Array.from(new Set(raw.map((m) => canonicalMekhalaName(m) || String(m || "").trim()).filter(Boolean)));
  }, [userData]);

  // Load madrasas and determine assigned madrasas
  useEffect(() => {
    const loadMadrasas = async () => {
      if (!userData) return;
      try {
        const directIds = Array.isArray(userData?.assignedMadarsas) ? userData.assignedMadarsas : [];
        let allMadarsas = [];

        if (allowedDistricts.length > 0) {
          const values = Array.from(new Set(allowedDistricts.map((d) => String(d).trim())));
          const chunks = [];
          for (let i = 0; i < values.length; i += 10) {
            chunks.push(values.slice(i, i + 10));
          }
          if (chunks.length > 0) {
            const snaps = await Promise.all([
              ...chunks.map((chunk) => getDocs(query(collection(db, "madarsas"), where("district", "in", chunk)))),
              ...chunks.map((chunk) => getDocs(query(collection(db, "madarsas"), where("districtName", "in", chunk))))
            ]);
            snaps.forEach((snap) => {
              snap.docs.forEach((doc) => allMadarsas.push({ id: doc.id, ...doc.data() }));
            });
          }
        }

        // Also fetch directIds if any (and merge/deduplicate them)
        if (directIds.length > 0) {
          const directChunks = [];
          for (let i = 0; i < directIds.length; i += 30) {
            directChunks.push(directIds.slice(i, i + 30));
          }
          const directPromises = directChunks.map(async (chunk) => {
            const q = query(collection(db, "madarsas"), where("madarsaId", "in", chunk));
            const snap = await getDocs(q);
            return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          });
          const directResults = (await Promise.all(directPromises)).flat();
          
          const seen = new Set(allMadarsas.map((m) => m.id));
          directResults.forEach((m) => {
            if (!seen.has(m.id)) {
              allMadarsas.push(m);
            }
          });
        }

        setMadrasas(allMadarsas);

        const mMap = new Map();
        allMadarsas.forEach((m) => {
          mMap.set(m.id, m);
          if (m.madarsaId) {
            mMap.set(m.madarsaId, m);
          }
        });
        setMadrasaMap(mMap);
      } catch (error) {
        console.error("Error loading madrasas:", error);
      }
    };
    loadMadrasas();
  }, [userData, allowedDistricts]);

  // Filter madrasas matching inspector's scope
  const assignedMadrasaIds = useMemo(() => {
    const directIds = Array.isArray(userData?.assignedMadarsas) ? userData.assignedMadarsas : [];
    const matched = madrasas.filter((m) => {
      // Direct assignment check
      const mIdStr = String(m.madarsaId || m.id || "").trim();
      if (directIds.some((id) => String(id).trim() === mIdStr)) return true;

      // District assignment check
      const matchesDist = allowedDistricts.some((dist) => {
        try {
          if (!madrasaMatchesDistrict(m, dist)) return false;
          return !!String(m?.district || m?.districtName || "").trim();
        } catch {
          return false;
        }
      });
      if (matchesDist) return true;

      // Mekhala assignment check
      const matchesMekh = allowedMekhalas.some((mekh) => {
        try {
          return madrasaMatchesMekhala(m, mekh);
        } catch {
          return false;
        }
      });
      return matchesMekh;
    });

    const idsSet = new Set();
    matched.forEach((m) => {
      const mid = m.madarsaId || m.id;
      if (mid) {
        const strId = String(mid);
        const numericStr = strId.replace(/^[a-zA-Z]+-/, "");
        const numericVal = Number(numericStr);
        idsSet.add(strId);
        idsSet.add(numericStr);
        idsSet.add(`mid-${numericStr}`);
        idsSet.add(`mld-${numericStr}`);
        if (Number.isFinite(numericVal) && numericVal > 0) {
          idsSet.add(numericVal);
        }
      }
    });

    return idsSet;
  }, [madrasas, allowedDistricts, allowedMekhalas, userData]);

  const fetchContacts = useCallback(async () => {
    if (assignedMadrasaIds.size === 0 && allowedDistricts.length === 0 && allowedMekhalas.length === 0) {
      setContacts([]);
      return;
    }

    setLoading(true);
    try {
      let fetched = [];
      const allowedIds = Array.from(assignedMadrasaIds);
      
      const chunk = (array, size) => {
        const result = [];
        for (let i = 0; i < array.length; i += size) {
          result.push(array.slice(i, i + size));
        }
        return result;
      };

      const rolesToFetch =
        roleFilter === "all_contacts"
          ? [
              "all_students",
              "all_teachers",
              "all_sadars",
              "all_district",
              "all_mekhala",
            ]
          : [roleFilter];

      for (const contactRole of rolesToFetch) {
        let roleContacts = [];

      if (contactRole === "all_students") {
        if (allowedIds.length > 0) {
          const chunks = chunk(allowedIds, 30);
          const promises = chunks.map(async (c) => {
            const q = query(collection(db, "students"), where("madarsaId", "in", c));
            const snap = await getDocs(q);
            return snap.docs.map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                name: d.fullName || d.studentName || d.name || "N/A",
                role: "Student",
                phone: d.phone || d.guardianPhone || "N/A",
                madarsaId: d.madarsaId || "",
                secondary: d.classLevel ? `Class ${d.classLevel}` : "N/A",
                deleted: !!d.deleted,
              };
            });
          });
          const results = await Promise.all(promises);
          roleContacts = results.flat().filter((s) => !s.deleted);
        }
      } else if (contactRole === "all_teachers") {
        if (allowedIds.length > 0) {
          const chunks = chunk(allowedIds, 30);
          const promises = chunks.map(async (c) => {
            const q = query(collection(db, "teachers"), where("madarsaId", "in", c));
            const snap = await getDocs(q);
            return snap.docs.map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                name: d.name || "N/A",
                role: "Teacher",
                phone: d.phone || "N/A",
                madarsaId: d.madarsaId || "",
                secondary: d.qualification || d.degree || "N/A",
                deleted: !!d.deleted,
              };
            });
          });
          const results = await Promise.all(promises);
          roleContacts = results.flat().filter((t) => !t.deleted);
        }
      } else if (contactRole === "all_sadars") {
        if (allowedIds.length > 0) {
          const chunks = chunk(allowedIds, 30);
          const promises = chunks.map(async (c) => {
            const q = query(
              collection(db, "users"),
              where("role", "==", "madarsa_admin"),
              where("madarsaId", "in", c)
            );
            const snap = await getDocs(q);
            return snap.docs.map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                name: d.name || d.fullName || "N/A",
                role: "Sadar",
                phone: d.phone || d.phoneNumber || "N/A",
                madarsaId: d.madarsaId || "",
                secondary: "Sadar",
              };
            });
          });
          const results = await Promise.all(promises);
          roleContacts = results.flat();
        }
      } else if (contactRole === "all_mekhala") {
        const [distSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "districts")),
          getDocs(query(collection(db, "users"), where("role", "==", "mekhala_admin"))),
        ]);

        const list = [];
        distSnap.docs.forEach((doc) => {
          const d = doc.data();
          const mekhNameCanon = canonicalMekhalaName(d.name);
          const isAssigned = allowedMekhalas.some(
            (allowed) => allowed.toLowerCase() === mekhNameCanon?.toLowerCase()
          );
          if (isAssigned) {
            list.push({
              id: doc.id,
              name: d.name || "N/A",
              role: "Mekhala Owner",
              phone: getCleanPhone(d.phone, d.loginId),
              secondary: d.name || "N/A",
            });
          }
        });

        usersSnap.docs.forEach((doc) => {
          const d = doc.data();
          const isMekhOwner = d.portalType === "mekhala_portal" || d.mekhalaDocType === "sub_mekhala";
          if (isMekhOwner) {
            const mekhNameCanon = canonicalMekhalaName(d.mekhalaName || d.name);
            const isAssigned = allowedMekhalas.some(
              (allowed) => allowed.toLowerCase() === mekhNameCanon?.toLowerCase()
            );
            if (isAssigned) {
              list.push({
                id: doc.id,
                name: d.name || d.fullName || "N/A",
                role: "Mekhala Owner",
                phone: getCleanPhone(d.phone || d.phoneNumber, d.loginId),
                secondary: d.mekhalaName || d.name || "N/A",
              });
            }
          }
        });

        const seen = new Set();
        const filteredList = list.filter((item) => {
          const cleanPhone = String(item.phone || "").replace(/\D/g, "");
          const key = cleanPhone && cleanPhone.length >= 8 ? cleanPhone : item.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        roleContacts = filteredList;
      } else if (contactRole === "all_district") {
        const [mekhSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "mekhala")),
          getDocs(query(collection(db, "users"), where("role", "==", "mekhala_admin"))),
        ]);

        const list = [];
        mekhSnap.docs.forEach((doc) => {
          const d = doc.data();
          const distNameCanon = canonicalDistrictName(d.name);
          const isAssigned = allowedDistricts.some(
            (allowed) => allowed.toLowerCase() === distNameCanon?.toLowerCase()
          );
          if (isAssigned) {
            list.push({
              id: doc.id,
              name: d.name || "N/A",
              role: "District Owner",
              phone: getCleanPhone(d.phone, d.loginId),
              secondary: d.name || "N/A",
            });
          }
        });

        usersSnap.docs.forEach((doc) => {
          const d = doc.data();
          const isDistOwner = d.portalType !== "mekhala_portal" && d.mekhalaDocType !== "sub_mekhala";
          if (isDistOwner) {
            const distNameCanon = canonicalDistrictName(d.district || d.mekhalaName);
            const isAssigned = allowedDistricts.some(
              (allowed) => allowed.toLowerCase() === distNameCanon?.toLowerCase()
            );
            if (isAssigned) {
              list.push({
                id: doc.id,
                name: d.name || d.fullName || "N/A",
                role: "District Owner",
                phone: getCleanPhone(d.phone || d.phoneNumber, d.loginId),
                secondary: d.district || d.mekhalaName || "N/A",
              });
            }
          }
        });

        const seen = new Set();
        const filteredList = list.filter((item) => {
          const cleanPhone = String(item.phone || "").replace(/\D/g, "");
          const key = cleanPhone && cleanPhone.length >= 8 ? cleanPhone : item.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        roleContacts = filteredList;
      }

        fetched = [...fetched, ...roleContacts];
      }

      const seen = new Set();
      const uniqueFetched = fetched.filter((item) => {
        if (!item.id) return true;
        const key = `${item.role || ""}-${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setContacts(uniqueFetched);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error("Failed to load contacts data");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, assignedMadrasaIds, allowedDistricts, allowedMekhalas]);

  useEffect(() => {
    if (!userData) return;
    // For district/mekhala owner contacts we don't need madarsas first.
    // For student/teacher/sadar contacts, assignedMadrasaIds (derived from madrasas)
    // drives the query — fetchContacts re-runs automatically when madrasas load
    // because fetchContacts itself changes (it depends on assignedMadrasaIds via useCallback).
    if (allowedDistricts.length > 0 || allowedMekhalas.length > 0 || madrasas.length > 0) {
      fetchContacts();
    }
  }, [userData, madrasas, allowedDistricts, allowedMekhalas, fetchContacts]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, searchTerm]);

  // Apply client-side filters
  useEffect(() => {
    let result = [...contacts];

    if (searchTerm.trim() !== "") {
      const s = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(s) ||
          c.phone.toLowerCase().includes(s)
      );
    }

    setFilteredContacts(result);
  }, [contacts, searchTerm]);

  // Paginated contacts for current view page
  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredContacts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredContacts, currentPage, itemsPerPage]);

  const formatMID = (madarsaId) => {
    if (!madarsaId) return "N/A";
    const idStr = String(madarsaId).trim();
    const numericPart = idStr.replace(/^[a-zA-Z]+-/i, "");
    if (/^\d+$/.test(numericPart)) return `MID-${numericPart}`;
    return idStr.toUpperCase();
  };

  const handleDownloadCSV = () => {
    if (filteredContacts.length === 0) {
      toast.info("No contacts to export");
      return;
    }

    const headers = [
      "Name",
      "Role",
      ...(roleFilter !== "all_students" ? ["Phone Number"] : []),
      "Madrasa Number",
      "Madrasa",
      "Mekhala / Zone",
      "Institution / Info",
    ];
    const rows = filteredContacts.map((c) => [
      c.name,
      c.role,
      ...(roleFilter !== "all_students" ? [c.role === "Student" ? "" : c.phone] : []),
      c.role === "Student" || c.role === "Teacher" || c.role === "Sadar"
        ? c.madarsaId || "N/A"
        : "N/A",
      c.role === "Student" || c.role === "Teacher" || c.role === "Sadar"
        ? madrasaMap.get(c.madarsaId)?.name || c.madarsaId || "N/A"
        : "N/A",
      c.role === "Student" || c.role === "Teacher" || c.role === "Sadar"
        ? madrasaMap.get(c.madarsaId)?.district ||
          madrasaMap.get(c.madarsaId)?.districtName ||
          madrasaMap.get(c.madarsaId)?.mekhala ||
          madrasaMap.get(c.madarsaId)?.mekhalaName ||
          "N/A"
        : c.secondary,
      c.secondary,
    ]);

    const csvContent = [headers, ...rows]
      .map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `assigned_contacts_${roleFilter}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Downloaded Successfully");
  };

  const handleDownloadPDF = () => {
    if (filteredContacts.length === 0) {
      toast.info("No contacts to export");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(15, 118, 110); // Teal color
    doc.text(`Assigned Contact Directory`, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);
    
    const tableColumn = [
      "S.No",
      "Name",
      "Role",
      ...(roleFilter !== "all_students" ? ["Phone"] : []),
      "Madrasa ID",
      "Madrasa Name",
      "Mekhala / Zone",
      "Institution Info",
    ];
    
    const tableRows = filteredContacts.map((c, index) => [
      index + 1,
      c.name,
      c.role,
      ...(roleFilter !== "all_students" ? [c.role === "Student" ? "" : c.phone] : []),
      c.role === "Student" || c.role === "Teacher" || c.role === "Sadar"
        ? c.madarsaId || "N/A"
        : "N/A",
      c.role === "Student" || c.role === "Teacher" || c.role === "Sadar"
        ? madrasaMap.get(c.madarsaId)?.name || c.madarsaId || "N/A"
        : "N/A",
      c.role === "Student" || c.role === "Teacher" || c.role === "Sadar"
        ? madrasaMap.get(c.madarsaId)?.district ||
          madrasaMap.get(c.madarsaId)?.districtName ||
          madrasaMap.get(c.madarsaId)?.mekhala ||
          madrasaMap.get(c.madarsaId)?.mekhalaName ||
          "N/A"
        : c.secondary,
      c.secondary,
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 4,
        valign: 'middle',
      },
      headStyles: {
        fillColor: [15, 118, 110], // Teal-600
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 }, // S.No
        2: { halign: 'center', cellWidth: 25 }, // Role
        ...(roleFilter !== "all_students" ? { 3: { halign: 'center', cellWidth: 35 } } : {}),
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
    });

    doc.save(`assigned_contacts_${roleFilter}.pdf`);
    toast.success("PDF Downloaded Successfully");
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="h-8 w-8 text-teal-600" />
              Assigned Contact Directory
            </h1>
            <p className="text-slate-600 mt-1">
              Access contacts for Students, Teachers, Sadars, District Owners, and Mekhala Owners assigned to your zone.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadCSV}
              variant="outline"
              disabled={loading}
              className="border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button
              onClick={handleDownloadPDF}
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {/* Filter Panel */}
        <Card className="border border-slate-200 shadow-sm bg-white/50 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Role Select */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Role Filter</label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full bg-white border-slate-200">
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all_contacts">ALL CONTACTS</SelectItem>
                    <SelectItem value="all_students">ALL STUDENTS</SelectItem>
                    <SelectItem value="all_teachers">ALL TEACHERS</SelectItem>
                    <SelectItem value="all_sadars">ALL SADARS</SelectItem>
                    <SelectItem value="all_mekhala">ALL MEKHALA OWNERS</SelectItem>
                    <SelectItem value="all_district">ALL DISTRICT OWNERS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Search Name/Phone</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white border-slate-200"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Directory Table */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between py-4">
            <CardTitle className="text-lg font-bold text-slate-900">
              Contacts ({filteredContacts.length} found)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="h-10 w-10 animate-spin text-teal-600 mb-2" />
                Loading contacts...
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                No contacts found in your assigned zone.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold text-slate-700">Name</TableHead>
                        <TableHead className="font-bold text-slate-700">Role</TableHead>
                        {roleFilter !== "all_students" && (
                          <TableHead className="font-bold text-slate-700">Phone Number</TableHead>
                        )}
                        <TableHead className="font-bold text-slate-700">Madrasa Number</TableHead>
                        <TableHead className="font-bold text-slate-700">Madrasa</TableHead>
                        <TableHead className="font-bold text-slate-700">Mekhala / Zone</TableHead>
                        <TableHead className="font-bold text-slate-700">Institution / Info</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedContacts.map((c) => (
                        <TableRow key={`${c.role}-${c.id}`} className="hover:bg-slate-50/50">
                          <TableCell className="font-medium text-slate-900">{c.name}</TableCell>
                          <TableCell className="text-slate-600">{c.role}</TableCell>
                          {roleFilter !== "all_students" && (
                            <TableCell className="text-slate-900 font-mono tracking-tight">
                              {c.role === "Student" ? (
                                <span className="text-slate-400 italic text-sm font-sans"></span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                                  {c.phone}
                                </div>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="text-slate-600 font-mono text-xs">
                            {c.role === "Student" || c.role === "Teacher" || c.role === "Sadar"
                              ? <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium border border-amber-100">
                                  {formatMID(madrasaMap.get(c.madarsaId)?.madarsaId || c.madarsaId)}
                                </span>
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {c.role === "Student" || c.role === "Teacher" || c.role === "Sadar"
                              ? madrasaMap.get(c.madarsaId)?.name || c.madarsaId || "N/A"
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {c.role === "Student" || c.role === "Teacher" || c.role === "Sadar"
                              ? madrasaMap.get(c.madarsaId)?.district ||
                                madrasaMap.get(c.madarsaId)?.districtName ||
                                madrasaMap.get(c.madarsaId)?.mekhala ||
                                madrasaMap.get(c.madarsaId)?.mekhalaName ||
                                "N/A"
                              : c.secondary}
                          </TableCell>
                          <TableCell className="text-slate-600">{c.secondary}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-4 border-t border-slate-100">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(filteredContacts.length / itemsPerPage)}
                    onPageChange={setCurrentPage}
                    itemsPerPage={itemsPerPage}
                    totalItems={filteredContacts.length}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
