"use client";

import { useState, useEffect, useCallback } from "react";
import { madrasaMatchesDistrict, madrasaMatchesMekhala } from "@/lib/madrasaHierarchy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Users,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Phone,
  Building,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/authFetch";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import { fetchMadrasasMetadata } from "@/lib/teacherQueries";
import Layout from "@/components/Layout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ITEMS_PER_PAGE = 20;

export default function AdminManagersPage() {
  const { userData } = useAuthStore();
  const [managers, setManagers] = useState([]);
  const [madarsas, setMadarsas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [nameSearch, setNameSearch] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [madarsaFilter, setMadarsaFilter] = useState("all");
  const [madarsaSearch, setMadarsaSearch] = useState("");
  const [madarsaDropdownOpen, setMadarsaDropdownOpen] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [mekhalas, setMekhalas] = useState([]);
  const [filterMekhala, setFilterMekhala] = useState("all");
  const [madrasaMap, setMadrasaMap] = useState(new Map());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Edit/Delete dialogs
  const [editingManager, setEditingManager] = useState(null);
  const [deletingManager, setDeletingManager] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    address: "",
    password: "",
    position: "Others",
    status: "active",
  });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const managersSnap = await getDocs(collection(db, "managers"));
      
      const managersData = managersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      managersData.sort((a, b) => {
        const getTime = (val) => {
          if (!val) return 0;
          try {
            if (typeof val.toMillis === 'function') return val.toMillis();
            if (typeof val.toDate === 'function') return val.toDate().getTime();
            if (typeof val === 'number') return val < 10000000000 ? val * 1000 : val;
            if (val.seconds) return val.seconds * 1000;
            const parsed = new Date(val).getTime();
            return isNaN(parsed) ? 0 : parsed;
          } catch (e) {
            return 0;
          }
        };
        const timeA = Math.max(getTime(a.createdAt), getTime(a.updatedAt));
        const timeB = Math.max(getTime(b.createdAt), getTime(b.updatedAt));
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        return (a.name || "").localeCompare(b.name || "");
      });
      setManagers(managersData);

      // Fetch madrasas, districts and mekhalas
      const { madrasas: dbMadrasas, madrasaMap: dbMadrasaMap } = await fetchMadrasasMetadata();
      const districtsSnap = await getDocs(query(collection(db, "districts"), orderBy("name", "asc")));
      setDistricts(districtsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      
      const mekhalasSnap = await getDocs(query(collection(db, "mekhala"), orderBy("name", "asc")));
      setMekhalas(mekhalasSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      
      const enrichedMadrasaMap = new Map(dbMadrasaMap);
      dbMadrasas.forEach(m => {
        if (m.madarsaId) enrichedMadrasaMap.set(m.madarsaId, m);
      });
      setMadrasaMap(enrichedMadrasaMap);

      const uniqueMadarsasMap = new Map();
      dbMadrasas.forEach((m) => {
        const mId = m.madarsaId || m.name;
        if (mId && !uniqueMadarsasMap.has(mId)) {
          uniqueMadarsasMap.set(mId, {
            id: m.id,
            madarsaId: m.madarsaId || "",
            name: m.name || m.madarsaId || "Unknown",
          });
        }
      });
      setMadarsas(Array.from(uniqueMadarsasMap.values()));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load managers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (userData?.role !== "central_admin") {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-gray-500">
          Access Denied — Central Admin only
        </div>
      </Layout>
    );
  }

  // Filtered list
  const filtered = managers.filter((m) => {
    const name = (m.name || "").toLowerCase();
    const phone = (m.phone || "").toLowerCase();
    const mId = m.madarsaId || m.madarsaName || "";
    const nameOk = !nameSearch || name.includes(nameSearch.toLowerCase());
    const phoneOk = !phoneSearch || phone.includes(phoneSearch.toLowerCase());
    const madarsaOk =
      madarsaFilter === "all" ||
      mId === madarsaFilter ||
      m.madarsaName === madarsaFilter;
      
    let districtOk = true;
    if (filterDistrict !== "all") {
      const targetDistrict = mekhalas.find((d) => d.id === filterDistrict);
      const districtName = targetDistrict?.name;
      const madrasaInfo = madrasaMap.get(m.madarsaId) || madrasaMap.get(m.madarsaName);
      if (madrasaInfo && districtName) {
        districtOk = madrasaMatchesDistrict(madrasaInfo, districtName);
      } else {
        districtOk = false;
      }
    }
      
    let mekhalaOk = true;
    if (filterMekhala !== "all") {
      const targetMekhala = districts.find((mk) => mk.id === filterMekhala);
      const mekhalaName = targetMekhala?.name;
      const madrasaInfo = madrasaMap.get(m.madarsaId) || madrasaMap.get(m.madarsaName);
      if (madrasaInfo) {
        mekhalaOk =
          madrasaInfo.mekhalaId === filterMekhala ||
          (mekhalaName && madrasaMatchesMekhala(madrasaInfo, mekhalaName));
      } else {
        mekhalaOk = false;
      }
    }
    
    return nameOk && phoneOk && madarsaOk && districtOk && mekhalaOk;
  });

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handleDownloadCSV = () => {
    if (filtered.length === 0) {
      toast.info("No managers to export");
      return;
    }

    const headers = ["Manager Name", "Position", "Phone", "Madrasa Name", "Madrasa ID", "Mekhala", "Status"];
    const rows = filtered.map((m) => {
      const madrasaInfo = madrasaMap.get(m.madarsaId) || madrasaMap.get(m.madarsaName);
      const mekhalaName = madrasaInfo ? (madrasaInfo.district || madrasaInfo.districtName || "N/A") : "N/A";
      return [
        m.name || "N/A",
        m.position || "Others",
        m.phone || "N/A",
        m.madarsaName || "N/A",
        m.madarsaId || "N/A",
        mekhalaName,
        m.status || "active",
      ];
    });

    const csvContent = [headers, ...rows]
      .map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `managers_directory.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Downloaded Successfully");
  };

  const handleDownloadPDF = async () => {
    if (filtered.length === 0) {
      toast.info("No managers to export");
      return;
    }

    const doc = new jsPDF("landscape");
    
    // Load Malayalam Font
    let fontLoaded = false;
    try {
      const fontResponse = await fetch("/fonts/NotoSansMalayalam-Regular.ttf");
      if (fontResponse.ok) {
        const fontBlob = await fontResponse.blob();
        const fontBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(",")[1]);
          reader.readAsDataURL(fontBlob);
        });
        doc.addFileToVFS("NotoSansMalayalam.ttf", fontBase64);
        doc.addFont("NotoSansMalayalam.ttf", "NotoSansMalayalam", "normal");
        fontLoaded = true;
      }
    } catch (e) {
      console.warn("Failed to load Malayalam font:", e);
    }
    
    const loadImage = (src) => new Promise((resolve) => {
      const img = document.createElement("img");
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

    const logoImg = await loadImage("/logo.png");
    if (logoImg) {
      doc.addImage(logoImg, "PNG", 14, 10, 20, 20);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(15, 118, 110);
    doc.text("DKJU Central Control", 40, 18);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text("Managers Directory", 40, 26);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    })}`, 235, 26);

    const tableColumn = ["#", "Manager Name", "Position", "Phone", "Madrasa Name", "Madrasa ID", "Mekhala", "Status"];
    const tableRows = filtered.map((m, index) => {
      const madrasaInfo = madrasaMap.get(m.madarsaId) || madrasaMap.get(m.madarsaName);
      const mekhalaName = madrasaInfo ? (madrasaInfo.district || madrasaInfo.districtName || "N/A") : "N/A";
      return [
        index + 1,
        m.name || "N/A",
        m.position || "Others",
        m.phone || "N/A",
        m.madarsaName || "N/A",
        m.madarsaId || "N/A",
        mekhalaName,
        m.status || "active",
      ];
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, textColor: [40, 40, 40], overflow: "linebreak", font: fontLoaded ? "NotoSansMalayalam" : "helvetica" },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold", halign: "center", valign: "middle" },
      columnStyles: {
        0: { halign: "center", cellWidth: 13 },    // #
        1: { halign: "left", cellWidth: 50 },      // Manager Name
        2: { halign: "center", cellWidth: 25 },    // Position
        3: { halign: "center", cellWidth: 35 },    // Phone
        4: { halign: "left", cellWidth: 60 },      // Madrasa Name
        5: { halign: "center", cellWidth: 25 },    // Madrasa ID
        6: { halign: "left", cellWidth: 45 },      // Mekhala
        7: { halign: "center", cellWidth: 20 },    // Status
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 35, left: 10, right: 10 }
    });

    doc.save(`managers_directory_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF Downloaded Successfully");
  };

  const openEdit = (m) => {
    setEditingManager(m);
    setEditForm({
      name: m.name || "",
      phone: m.phone || "",
      address: m.address || "",
      password: m.password || "",
      position: m.position || "Others",
      status: m.status || "active",
    });
    setShowPassword(false);
  };

  const handleSave = async () => {
    if (!editingManager) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/admin/create-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          phone: editForm.phone.trim(),
          address: editForm.address.trim(),
          password: editForm.password.trim(),
          position: editForm.position,
          status: editForm.status,
          institutionName: editingManager.institutionName || "",
          madarsaId: editingManager.madarsaId,
          madarsaName: editingManager.madarsaName || "",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update manager");
      }

      setManagers((prev) =>
        prev.map((m) =>
          m.id === editingManager.id ? { ...m, ...editForm } : m,
        ),
      );
      setEditingManager(null);
      toast.success("Manager updated successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update manager");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingManager) return;
    try {
      await deleteDoc(doc(db, "managers", deletingManager.id));
      setManagers((prev) => prev.filter((m) => m.id !== deletingManager.id));
      setDeletingManager(null);
      toast.success("Manager deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete manager");
    }
  };

  // Madrasa dropdown filtered list
  const filteredMadarsas = madarsas.filter((m) => {
    const q = madarsaSearch.toLowerCase();
    return (
      !q ||
      (m.name || "").toLowerCase().includes(q) ||
      (m.madarsaId || "").toLowerCase().includes(q)
    );
  });

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">All Managers</h1>
            <p className="text-gray-600">
              Manage all Sadar portal managers ({managers.length} total)
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadCSV}
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button
              onClick={handleDownloadPDF}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              {/* Name search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name..."
                  value={nameSearch}
                  onChange={(e) => {
                    setNameSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>

              {/* Phone search */}
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by phone..."
                  value={phoneSearch}
                  onChange={(e) => {
                    setPhoneSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>

              {/* District searchable dropdown */}
              <div className="relative">
                <SearchableSelect
                  value={filterDistrict}
                  onValueChange={(val) => {
                    setFilterDistrict(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Filter by District..."
                  searchPlaceholder="Search District..."
                  options={mekhalas}
                  getOptionLabel={(m) => m.name}
                  getOptionValue={(m) => m.id}
                  allOptionText="All Districts"
                  showAllOption={true}
                  triggerClassName="min-h-[44px] text-sm border-gray-200 bg-white"
                />
              </div>

              {/* Mekhala searchable dropdown */}
              <div className="relative">
                <SearchableSelect
                  value={filterMekhala}
                  onValueChange={(val) => {
                    setFilterMekhala(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Filter by Mekhala..."
                  searchPlaceholder="Search Mekhala..."
                  options={districts}
                  getOptionLabel={(m) => m.name}
                  getOptionValue={(m) => m.id}
                  allOptionText="All Mekhalas"
                  showAllOption={true}
                  triggerClassName="min-h-[44px] text-sm border-gray-200 bg-white"
                />
              </div>

              {/* Madrasa searchable dropdown */}
              <div className="relative">
                <SearchableSelect
                  value={madarsaFilter}
                  onValueChange={(val) => {
                    setMadarsaFilter(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Filter by Madrasa..."
                  searchPlaceholder="Search Madrasa Name or MID..."
                  options={madarsas}
                  getOptionLabel={(m) => `${m.name}${m.madarsaId ? ` (${m.madarsaId})` : ''}`}
                  getOptionValue={(m) => m.madarsaId || m.name}
                  allOptionText="All Madrasas"
                  showAllOption={true}
                  triggerClassName="min-h-[44px] text-sm border-gray-200 bg-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Managers ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No managers found matching your filters.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Manager Name</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Madrasa Name</TableHead>
                        <TableHead>Madrasa ID</TableHead>
                        <TableHead>Mekhala</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((m, i) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-gray-500">
                            {(currentPage - 1) * ITEMS_PER_PAGE + i + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            {m.name || "—"}
                          </TableCell>
                          <TableCell>{m.position || "Others"}</TableCell>
                          <TableCell>{m.phone || "—"}</TableCell>
                          <TableCell>
                            <span className="font-medium">{m.madarsaName || "—"}</span>
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {m.madarsaId || "—"}
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {(() => {
                              const madrasaInfo = madrasaMap.get(m.madarsaId) || madrasaMap.get(m.madarsaName);
                              return madrasaInfo ? (madrasaInfo.district || madrasaInfo.districtName || "—") : "—";
                            })()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                m.status === "active"
                                  ? "bg-green-100 text-green-700 border-green-200"
                                  : "bg-red-100 text-red-700 border-red-200"
                              }
                              variant="outline"
                            >
                              {m.status || "active"}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEdit(m)}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeletingManager(m)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages} · {filtered.length}{" "}
                    managers
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog
          open={!!editingManager}
          onOpenChange={(o) => !o && setEditingManager(null)}
        >
          <DialogContent className="max-w-lg bg-white">
            <DialogHeader>
              <DialogTitle>Edit Manager</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Full name"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="Phone number"
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={editForm.address}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, address: e.target.value }))
                  }
                  placeholder="Address"
                />
              </div>
              <div>
                <Label>Position</Label>
                <Select
                  value={editForm.position}
                  onValueChange={(value) =>
                    setEditForm((p) => ({ ...p, position: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Position" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="President">President</SelectItem>
                    <SelectItem value="Secretary">Secretary</SelectItem>
                    <SelectItem value="Treasurer">Treasurer</SelectItem>
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Password (leave blank to keep current)</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={editForm.password}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, password: e.target.value }))
                    }
                    placeholder="New password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    onClick={() => setShowPassword((s) => !s)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, status: e.target.value }))
                  }
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingManager(null)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm */}
        <AlertDialog
          open={!!deletingManager}
          onOpenChange={(o) => !o && setDeletingManager(null)}
        >
          <AlertDialogContent className="bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Manager</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{" "}
                <strong>{deletingManager?.name}</strong>? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
