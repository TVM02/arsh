"use client";

import { useState, useEffect, Fragment } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Edit,
  Building,
  Eye,
  EyeOff,
  MapPin,
  ChevronDown,
  ChevronUp,
  School,
  ExternalLink,
  Users,
  FileSpreadsheet,
  Download,
  KeyRound,
} from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { formatDate } from "@/lib/dateUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export default function MekhalaManagement() {
  const { user, role } = useAuth();
  const [mekhalas, setMekhalas] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [madrasas, setMadrasas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMekhala, setEditingMekhala] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});
  const [expandedMekhalas, setExpandedMekhalas] = useState({});
  const [selectedMekhalaForDetails, setSelectedMekhalaForDetails] =
    useState(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [credentialDialog, setCredentialDialog] = useState({
    open: false,
    mekhala: null,
    loginId: "",
    password: "",
    showPassword: false,
    saving: false,
  });

  // Form states
  const [mekhalaForm, setMekhalaForm] = useState({
    name: "",
    email: "",
    loginId: "",
    password: "",
    region: "",
    phone: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveCredentials = async () => {
    const { mekhala, loginId, password } = credentialDialog;
    if (!loginId.trim()) {
      toast.error("Login ID is required");
      return;
    }
    if (!password.trim()) {
      toast.error("Password is required");
      return;
    }
    setCredentialDialog((p) => ({ ...p, saving: true }));
    try {
      const trimmedId = loginId.trim();
      const updateData = {
        loginId: trimmedId,
        password: password.trim(),
        updatedAt: new Date(),
      };
      if (/^\d+$/.test(trimmedId)) {
        updateData.phone = trimmedId;
      }
      await updateDoc(doc(db, "mekhala", mekhala.id), updateData);
      toast.success("Credentials saved!");
      // If the details dialog is open for this mekhala, update it in-place
      if (selectedMekhalaForDetails?.id === mekhala.id) {
        setSelectedMekhalaForDetails((prev) => ({
          ...prev,
          loginId: loginId.trim(),
          password: password.trim(),
        }));
      }
      setCredentialDialog({
        open: false,
        mekhala: null,
        loginId: "",
        password: "",
        showPassword: false,
        saving: false,
      });
      fetchData();
    } catch (err) {
      toast.error("Failed to save credentials");
    } finally {
      setCredentialDialog((p) => ({ ...p, saving: false }));
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch mekhalas
      const mekhalasSnapshot = await getDocs(collection(db, "mekhala"));
      const mekhalasData = mekhalasSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMekhalas(mekhalasData);

      // Fetch mekhalas
      const districtsSnapshot = await getDocs(collection(db, "districts"));
      const districtsData = districtsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDistricts(districtsData);

      // Fetch madrasas
      const madrasasSnapshot = await getDocs(collection(db, "madarsas"));
      const madrasasData = madrasasSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMadrasas(madrasasData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMekhalaForm({
      name: "",
      email: "",
      loginId: "",
      password: "",
      region: "",
      phone: "",
    });
    setEditingMekhala(null);
  };

  const validateForm = () => {
    if (!mekhalaForm.name.trim()) {
      toast.error("District name is required");
      return false;
    }
    // When editing, email/loginId/password are optional — only name is required
    if (!editingMekhala) {
      if (!mekhalaForm.email.trim()) {
        toast.error("Email is required");
        return false;
      }
      if (!mekhalaForm.phone.trim()) {
        toast.error("Phone number is required");
        return false;
      }
      if (!mekhalaForm.password.trim()) {
        toast.error("Password is required");
        return false;
      }
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(mekhalaForm.email)) {
        toast.error("Please enter a valid email address");
        return false;
      }
    } else {
      // Editing: validate email only if provided
      if (mekhalaForm.email && mekhalaForm.email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(mekhalaForm.email.trim())) {
          toast.error("Please enter a valid email address");
          return false;
        }
      }
    }

    return true;
  };

  const checkDuplicates = async () => {
    // Check for duplicate email (skip if empty during edit)
    if (mekhalaForm.email.trim()) {
      const emailQuery = query(
        collection(db, "mekhala"),
        where("email", "==", mekhalaForm.email.trim()),
      );
      const emailSnapshot = await getDocs(emailQuery);

      if (editingMekhala) {
        const emailExists = emailSnapshot.docs.some(
          (doc) => doc.id !== editingMekhala.id,
        );
        if (emailExists) {
          toast.error("Email already exists");
          return false;
        }
      } else {
        if (!emailSnapshot.empty) {
          toast.error("Email already exists");
          return false;
        }
      }
    }

    // Check for duplicate login ID (skip if empty during edit)
    if (mekhalaForm.loginId.trim()) {
      const loginQuery = query(
        collection(db, "mekhala"),
        where("loginId", "==", mekhalaForm.loginId.trim()),
      );
      const loginSnapshot = await getDocs(loginQuery);

      if (editingMekhala) {
        const loginExists = loginSnapshot.docs.some(
          (doc) => doc.id !== editingMekhala.id,
        );
        if (loginExists) {
          toast.error("Login ID already exists");
          return false;
        }
      } else {
        if (!loginSnapshot.empty) {
          toast.error("Login ID already exists");
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      // Check for duplicates
      const isUnique = await checkDuplicates();
      if (!isUnique) return;

      const mekhalaData = {
        name: mekhalaForm.name.trim(),
        email: mekhalaForm.email.trim(),
        loginId: mekhalaForm.loginId.trim(),
        region: mekhalaForm.region.trim(),
        role: "mekhala_admin",
        updatedAt: serverTimestamp(),
        ...(mekhalaForm.phone.trim() !== "" && { phone: mekhalaForm.phone.trim() }),
      };

      if (mekhalaForm.password.trim()) {
        mekhalaData.password = mekhalaForm.password.trim();
      }

      if (editingMekhala) {
        // Build update payload — only include email/loginId if provided
        const updatePayload = {
          name: mekhalaData.name,
          region: mekhalaData.region,
          role: mekhalaData.role,
          updatedAt: mekhalaData.updatedAt,
          createdAt: editingMekhala.createdAt,
        };
        if (mekhalaForm.email.trim())
          updatePayload.email = mekhalaForm.email.trim();
        if (mekhalaForm.phone.trim() !== "") {
          updatePayload.phone = mekhalaForm.phone.trim();
          updatePayload.loginId = mekhalaForm.phone.trim(); // Keep loginId in sync for legacy compatibility
        }

        await updateDoc(doc(db, "mekhala", editingMekhala.id), updatePayload);

        // Propagate name change to every collection that stores the mekhala name
        const oldName = (editingMekhala.name || "").trim();
        const newName = mekhalaData.name;
        if (
          oldName &&
          newName &&
          oldName.toLowerCase() !== newName.toLowerCase()
        ) {
          const allUpdates = [];

          // 1. Update madarsas where mekhala or district field === oldName
          const madarsasSnap = await getDocs(collection(db, "madarsas"));
          madarsasSnap.docs.forEach((d) => {
            const data = d.data();
            const fields = {};
            if ((data.mekhala || "").toLowerCase() === oldName.toLowerCase())
              fields.mekhala = newName;
            if ((data.district || "").toLowerCase() === oldName.toLowerCase())
              fields.district = newName;
            if (Object.keys(fields).length)
              allUpdates.push(updateDoc(doc(db, "madarsas", d.id), fields));
          });

          // 2. Update districts collection where name === oldName
          const districtsSnap = await getDocs(collection(db, "districts"));
          districtsSnap.docs.forEach((d) => {
            if ((d.data().name || "").toLowerCase() === oldName.toLowerCase())
              allUpdates.push(
                updateDoc(doc(db, "districts", d.id), { name: newName }),
              );
          });

          // 3. Update students where mekhala or district field === oldName
          const studentsSnap = await getDocs(collection(db, "students"));
          studentsSnap.docs.forEach((d) => {
            const data = d.data();
            const fields = {};
            if ((data.mekhala || "").toLowerCase() === oldName.toLowerCase())
              fields.mekhala = newName;
            if ((data.district || "").toLowerCase() === oldName.toLowerCase())
              fields.district = newName;
            if (Object.keys(fields).length)
              allUpdates.push(updateDoc(doc(db, "students", d.id), fields));
          });

          // 4. Update teachers where mekhala or district field === oldName
          const teachersSnap = await getDocs(collection(db, "teachers"));
          teachersSnap.docs.forEach((d) => {
            const data = d.data();
            const fields = {};
            if ((data.mekhala || "").toLowerCase() === oldName.toLowerCase())
              fields.mekhala = newName;
            if ((data.district || "").toLowerCase() === oldName.toLowerCase())
              fields.district = newName;
            if (Object.keys(fields).length)
              allUpdates.push(updateDoc(doc(db, "teachers", d.id), fields));
          });

          // 5. Update managers where mekhala or district field === oldName
          const managersSnap = await getDocs(collection(db, "managers"));
          managersSnap.docs.forEach((d) => {
            const data = d.data();
            const fields = {};
            if ((data.mekhala || "").toLowerCase() === oldName.toLowerCase())
              fields.mekhala = newName;
            if ((data.district || "").toLowerCase() === oldName.toLowerCase())
              fields.district = newName;
            if (Object.keys(fields).length)
              allUpdates.push(updateDoc(doc(db, "managers", d.id), fields));
          });

          await Promise.all(allUpdates);
          toast.success(
            `Name updated and propagated to ${allUpdates.length} related records across all collections`,
          );
        } else {
          toast.success("Mekhala updated successfully");
        }
      } else {
        mekhalaData.createdAt = serverTimestamp();
        await addDoc(collection(db, "mekhala"), mekhalaData);
        toast.success("District added successfully");
      }

      setIsAddDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving mekhala:", error);
      toast.error("Failed to save mekhala");
    }
  };

  const handleEdit = (mekhala) => {
    setEditingMekhala(mekhala);
    setMekhalaForm({
      name: mekhala.name || "",
      email: mekhala.email || "",
      loginId: mekhala.phone || mekhala.loginId || "", // We use this internally if needed
      password: "", // Don't pre-fill password for security
      region: mekhala.region || "",
      phone: mekhala.phone || mekhala.loginId || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (mekhalaId) => {
    // Check if mekhala has mekhalas in its mekhalas array
    const mekhala = mekhalas.find((m) => m.id === mekhalaId);
    const hasDistricts =
      mekhala &&
      Array.isArray(mekhala.districts) &&
      mekhala.districts.length > 0;

    if (hasDistricts) {
      toast.error(
        `Cannot delete mekhala. It has ${mekhala.districts.length} assigned mekhalas. Please remove mekhalas first.`,
      );
      return;
    }

    if (!confirm("Are you sure you want to delete this mekhala?")) return;

    try {
      await deleteDoc(doc(db, "mekhala", mekhalaId));
      toast.success("District deleted successfully");
      fetchData();
    } catch (error) {
      console.error("Error deleting mekhala:", error);
      toast.error("Failed to delete mekhala");
    }
  };

  const togglePasswordVisibility = (mekhalaId) => {
    setShowPasswords((prev) => ({
      ...prev,
      [mekhalaId]: !prev[mekhalaId],
    }));
  };

  const getAssignedDistrictsCount = (mekhalaId) => {
    const mekhala = mekhalas.find((m) => m.id === mekhalaId);
    return mekhala && Array.isArray(mekhala.districts)
      ? mekhala.districts.length
      : 0;
  };

  const getAssignedDistricts = (mekhalaId) => {
    const mekhala = mekhalas.find((m) => m.id === mekhalaId);
    if (!mekhala || !Array.isArray(mekhala.districts)) return [];

    // Return array of objects with id and name for compatibility
    return mekhala.districts.map((districtName) => ({
      id: districtName,
      name: districtName,
    }));
  };

  const getMadrasasForMekhala = (mekhalaId) => {
    const mekhala = mekhalas.find((m) => m.id === mekhalaId);
    if (!mekhala || !Array.isArray(mekhala.districts)) {
      // Still check direct mekhalaId match
      return madrasas.filter((m) => m.mekhalaId === mekhalaId);
    }

    // Get madrasas where madrasa.district is in mekhala.districts array OR direct mekhalaId match
    const result = madrasas.filter(
      (m) =>
        mekhala.districts.some(
          (d) => d.toUpperCase() === m.district?.toUpperCase(),
        ) || m.mekhalaId === mekhalaId,
    );
    // Deduplicate
    return Array.from(new Map(result.map((m) => [m.id, m])).values());
  };

  // ─── Export: mekhalas under a district admin ───────────────────────────────
  const exportMekhalaListCSV = (mekhala) => {
    const districtList = getAssignedDistricts(mekhala.id);
    const rows = [
      [mekhala.name.toUpperCase()],
      [],
      ["Mekhala Name", "Madrasa Count"],
      ...districtList.map((d) => [
        d.name,
        madrasas.filter(
          (m) => m.district?.toUpperCase() === d.name?.toUpperCase(),
        ).length,
      ]),
      [],
      ["Total Mekhalas", districtList.length],
      ["Total Madrasas", getMadrasasForMekhala(mekhala.id).length],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Bold the district name cell
    if (!ws["A1"].s) ws["A1"].s = {};
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    XLSX.utils.book_append_sheet(wb, ws, "Mekhalas");
    XLSX.writeFile(wb, `${mekhala.name}-mekhalas.xlsx`);
    toast.success("Excel exported successfully");
  };

  const exportMekhalaListPDF = (mekhala) => {
    const districtList = getAssignedDistricts(mekhala.id);
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(mekhala.name.toUpperCase(), 14, 20);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Total Mekhalas: ${districtList.length}  |  Total Madrasas: ${getMadrasasForMekhala(mekhala.id).length}`,
      14,
      30,
    );

    autoTable(doc, {
      startY: 38,
      head: [["#", "Mekhala Name", "Madrasa Count"]],
      body: districtList.map((d, i) => [
        i + 1,
        d.name,
        `(${madrasas.filter((m) => m.district?.toUpperCase() === d.name?.toUpperCase()).length})`,
      ]),
      headStyles: { fillColor: [20, 184, 166], fontStyle: "bold" },
      columnStyles: { 2: { halign: "center" } },
    });

    doc.save(`${mekhala.name}-mekhalas.pdf`);
    toast.success("PDF exported successfully");
  };

  const toggleMekhalaExpansion = (mekhalaId) => {
    setExpandedMekhalas((prev) => ({
      ...prev,
      [mekhalaId]: !prev[mekhalaId],
    }));
  };

  const openDetailsModal = (mekhala) => {
    setSelectedMekhalaForDetails(mekhala);
    setIsDetailsDialogOpen(true);
  };

  const closeDetailsModal = () => {
    setSelectedMekhalaForDetails(null);
    setIsDetailsDialogOpen(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              District Management
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Manage districts administrators and their regions
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add District
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>
                  {editingMekhala ? "Edit District" : "Add New District"}
                </DialogTitle>
                <DialogDescription>
                  {editingMekhala
                    ? "Update mekhala information"
                    : "Create a new mekhala administrator"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="mekhala-name">District Name*</Label>
                  <Input
                    id="mekhala-name"
                    value={mekhalaForm.name}
                    onChange={(e) =>
                      setMekhalaForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Enter mekhala name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email*</Label>
                  <Input
                    id="email"
                    type="email"
                    value={mekhalaForm.email}
                    onChange={(e) =>
                      setMekhalaForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="Enter email address"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone">
                    Phone Number*{" "}
                    <span className="text-xs text-gray-500">
                      (used to log in to District Portal)
                    </span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={mekhalaForm.phone}
                    onChange={(e) =>
                      setMekhalaForm((prev) => ({
                        ...prev,
                        phone: e.target.value.replace(/\D/g, ""),
                        loginId: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                    placeholder="e.g. 9876543210"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password">
                    Password
                    {editingMekhala ? " (leave blank to keep current)" : "*"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={mekhalaForm.password}
                    onChange={(e) =>
                      setMekhalaForm((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    placeholder={
                      editingMekhala
                        ? "Enter new password or leave blank"
                        : "Enter password"
                    }
                    required={!editingMekhala}
                  />
                </div>

                <div>
                  <Label htmlFor="region">Region/Identifier</Label>
                  <Input
                    id="region"
                    value={mekhalaForm.region}
                    onChange={(e) =>
                      setMekhalaForm((prev) => ({
                        ...prev,
                        region: e.target.value,
                      }))
                    }
                    placeholder="Enter region or identifier"
                  />
                </div>



                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingMekhala ? "Update" : "Add"} District
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Districts ({mekhalas.length})
            </CardTitle>
            <CardDescription>
              Manage districts administrators and view their assigned mekhalas
            </CardDescription>
          </CardHeader>
          <CardContent className="bg-white">
            {mekhalas.length === 0 ? (
              <div className="text-center py-8">
                <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No mekhalas found
                </h3>
                <p className="text-gray-500 mb-4">
                  Start by adding your first mekhala
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add District
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop Table - Hidden on mobile */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Login ID</TableHead>
                        <TableHead>Password</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>Mekhalas</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mekhalas.map((mekhala) => (
                        <Fragment key={mekhala.id}>
                          <TableRow>
                            <TableCell className="font-medium">
                              {mekhala.name}
                            </TableCell>
                            <TableCell>{mekhala.email}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {mekhala.phone || mekhala.loginId || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">
                                  {showPasswords[mekhala.id]
                                    ? mekhala.password || "Not set"
                                    : "••••••••"}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    togglePasswordVisibility(mekhala.id)
                                  }
                                >
                                  {showPasswords[mekhala.id] ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>{mekhala.region || "-"}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">
                                    {getAssignedDistrictsCount(mekhala.id)}{" "}
                                    mekhalas
                                  </Badge>
                                  <Badge variant="secondary">
                                    {getMadrasasForMekhala(mekhala.id).length}{" "}
                                    madrasas
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() =>
                                      toggleMekhalaExpansion(mekhala.id)
                                    }
                                    className="h-6 w-6 p-0"
                                  >
                                    {expandedMekhalas[mekhala.id] ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                                {getAssignedDistricts(mekhala.id).length >
                                  0 && (
                                  <div className="text-xs text-gray-500">
                                    {getAssignedDistricts(mekhala.id)
                                      .slice(0, 2)
                                      .map((d) => d.name)
                                      .join(", ")}
                                    {getAssignedDistricts(mekhala.id).length >
                                      2 &&
                                      ` +${getAssignedDistricts(mekhala.id).length - 2} more`}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-medium text-xs text-gray-500">
                              {formatDate(mekhala.createdAt, "N/A")}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(mekhala)}
                                  className="h-8 px-2.5 text-xs text-slate-700 border-slate-200 hover:bg-slate-50"
                                >
                                  <Edit className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2.5 text-xs border-teal-600 text-teal-600 hover:bg-teal-50"
                                  onClick={() =>
                                    setCredentialDialog({
                                      open: true,
                                      mekhala,
                                      loginId: mekhala.loginId || "",
                                      password: mekhala.password || "",
                                      showPassword: false,
                                      saving: false,
                                    })
                                  }
                                >
                                  <KeyRound className="h-3.5 w-3.5 mr-1" />
                                  Credentials
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2.5 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                  onClick={() => handleDelete(mekhala.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {/* Expanded row showing madrasas */}
                          {expandedMekhalas[mekhala.id] && (
                            <TableRow>
                              <TableCell colSpan={8} className="bg-gray-50">
                                <div className="py-4">
                                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                                    <School className="h-4 w-4" />
                                    Madrasas in {mekhala.name} (
                                    {getMadrasasForMekhala(mekhala.id).length})
                                  </h4>
                                  {getMadrasasForMekhala(mekhala.id).length >
                                  0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {getMadrasasForMekhala(mekhala.id).map(
                                        (madrasa) => (
                                          <div
                                            key={madrasa.id}
                                            className="border rounded-lg p-3 bg-white"
                                          >
                                            <div className="font-medium text-sm">
                                              {madrasa.name}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                              MID: {madrasa.madarsaId}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              Mekhala: {madrasa.district}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              Contact: {madrasa.phone || "N/A"}
                                            </div>
                                            <Badge
                                              variant={
                                                madrasa.status === "active"
                                                  ? "default"
                                                  : "secondary"
                                              }
                                              className="mt-2 text-xs"
                                            >
                                              {madrasa.status || "active"}
                                            </Badge>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-500 text-center py-4">
                                      No madrasas found in this mekhala
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card Layout - Visible on mobile only */}
                <div className="md:hidden space-y-4">
                  {mekhalas.map((mekhala) => (
                    <Card key={mekhala.id} className="border shadow-sm">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">
                                {mekhala.name}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {mekhala.email}
                              </p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(mekhala)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-teal-500 text-teal-600 hover:bg-teal-50"
                                onClick={() =>
                                  setCredentialDialog({
                                    open: true,
                                    mekhala,
                                    loginId: mekhala.loginId || "",
                                    password: mekhala.password || "",
                                    showPassword: false,
                                    saving: false,
                                  })
                                }
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(mekhala.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500">Login ID:</span>
                              <div className="mt-1">
                                <Badge variant="secondary">
                                  {mekhala.loginId}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Region:</span>
                              <div className="mt-1">
                                {mekhala.region || "-"}
                              </div>
                            </div>
                          </div>

                          {/* Password */}
                          <div className="text-sm">
                            <span className="text-gray-500">Password:</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-mono text-sm">
                                {showPasswords[mekhala.id]
                                  ? mekhala.password || "Not set"
                                  : "••••••••"}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  togglePasswordVisibility(mekhala.id)
                                }
                                className="h-6 w-6 p-0"
                              >
                                {showPasswords[mekhala.id] ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Mekhalas & Madrasas Info */}
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {getAssignedDistrictsCount(mekhala.id)} mekhalas
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {getMadrasasForMekhala(mekhala.id).length}{" "}
                                madrasas
                              </Badge>
                            </div>

                            {getAssignedDistricts(mekhala.id).length > 0 && (
                              <div className="text-xs text-gray-500">
                                {getAssignedDistricts(mekhala.id)
                                  .slice(0, 2)
                                  .map((d) => d.name)
                                  .join(", ")}
                                {getAssignedDistricts(mekhala.id).length > 2 &&
                                  ` +${getAssignedDistricts(mekhala.id).length - 2} more`}
                              </div>
                            )}
                          </div>

                          {/* Created Date */}
                          <div className="text-xs text-gray-500 pt-2 border-t">
                            Created: {formatDate(mekhala.createdAt, "N/A")}
                          </div>

                          {/* Expanded Details */}
                          {expandedMekhalas[mekhala.id] && (
                            <div className="pt-3 border-t">
                              <div className="space-y-3">
                                {getMadrasasForMekhala(mekhala.id).length >
                                0 ? (
                                  <div className="space-y-2">
                                    <h4 className="font-medium text-sm flex items-center gap-2">
                                      <School className="h-4 w-4" />
                                      Madrasas (
                                      {getMadrasasForMekhala(mekhala.id).length}
                                      )
                                    </h4>
                                    {getMadrasasForMekhala(mekhala.id)
                                      .slice(0, 3)
                                      .map((madrasa) => (
                                        <div
                                          key={madrasa.id}
                                          className="p-2 bg-gray-50 rounded text-xs"
                                        >
                                          <div className="font-medium">
                                            {madrasa.name}
                                          </div>
                                          <div className="text-gray-600">
                                            {madrasa.madarsaId} •{" "}
                                            {madrasa.district}
                                          </div>
                                        </div>
                                      ))}
                                    {getMadrasasForMekhala(mekhala.id).length >
                                      3 && (
                                      <div className="text-xs text-gray-500 text-center">
                                        +
                                        {getMadrasasForMekhala(mekhala.id)
                                          .length - 3}{" "}
                                        more madrasas
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-sm text-gray-500 text-center py-4">
                                    No madrasas found in this mekhala
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Mekhalas Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Mekhalas Overview
            </CardTitle>
            <CardDescription>
              View all mekhalas and their mekhala assignments with detailed
              madrasas information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {mekhalas.map((mekhala) => {
                const assignedDistricts = getAssignedDistricts(mekhala.id);
                const assignedMadrasas = getMadrasasForMekhala(mekhala.id);

                return (
                  <Card
                    key={mekhala.id}
                    className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    {/* Header Section */}
                    <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold truncate">
                            {mekhala.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(mekhala)}
                            className="h-8 w-8 p-0 text-white hover:bg-white/20"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(mekhala.id)}
                            className="h-8 w-8 p-0 text-white hover:bg-white/20 hover:text-red-200"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDetailsModal(mekhala)}
                            className="h-8 px-2 text-white hover:bg-white/20 flex items-center gap-1"
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span className="text-xs">Details</span>
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <CardContent className="p-0">
                      {/* Stats Bar */}
                      <div className="bg-gray-50 px-4 py-3 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 bg-teal-500 rounded-full"></div>
                              <span className="text-sm font-medium">
                                {assignedDistricts.length} Mekhalas
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm font-medium">
                                {assignedMadrasas.length} Madrasas
                              </span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {mekhala.loginId}
                          </Badge>
                        </div>
                      </div>

                      <div className="p-4">
                        {assignedDistricts.length > 0 && (
                          <div className="">
                            <div className="text-xs text-gray-500 mb-2">
                              Mekhalas Preview:
                            </div>
                            <div className="text-sm text-gray-700">
                              {assignedDistricts
                                .slice(0, 3)
                                .map((d) => d.name)
                                .join(", ")}
                              {assignedDistricts.length > 3 &&
                                ` +${assignedDistricts.length - 3} more`}
                            </div>
                          </div>
                        )}

                        {/* Action Button */}
                        <div className="mt-4">
                          <Button
                            onClick={() => openDetailsModal(mekhala)}
                            className="w-full"
                            variant="outline"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View All Mekhalas & Madrasas
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Details Modal */}
        <Dialog
          open={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
        >
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-auto bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {selectedMekhalaForDetails?.name} - Complete Details
              </DialogTitle>
              <DialogDescription>
                All mekhalas and madrasas under{" "}
                {selectedMekhalaForDetails?.name}
              </DialogDescription>
            </DialogHeader>

            {selectedMekhalaForDetails && (
              <>
                {/* Export Buttons */}
                <div className="flex items-center gap-2 justify-end -mt-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportMekhalaListCSV(selectedMekhalaForDetails)
                    }
                    className="border-teal-500 text-teal-600 hover:bg-teal-50"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                    Export Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportMekhalaListPDF(selectedMekhalaForDetails)
                    }
                    className="border-teal-500 text-teal-600 hover:bg-teal-50"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export PDF
                  </Button>
                </div>
                {/* ── Portal Credentials ── */}
                <div className="border border-teal-200 rounded-lg bg-teal-50/40 p-4 mb-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-teal-600" />
                      <span className="font-medium text-teal-800 text-sm">
                        Mekhala Portal Credentials
                      </span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {selectedMekhalaForDetails?.loginId ? (
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-gray-500">
                            Login ID:{" "}
                            <span className="font-mono font-semibold text-gray-800">
                              {selectedMekhalaForDetails.loginId}
                            </span>
                          </span>
                          <span className="text-gray-400">|</span>
                          <span className="text-gray-500">
                            Password:{" "}
                            <span className="font-mono font-semibold text-gray-800">
                              ••••••••
                            </span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-amber-600 font-medium">
                          ⚠ No credentials set yet
                        </span>
                      )}
                      <Button
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700 text-white h-8 px-3"
                        onClick={() =>
                          setCredentialDialog({
                            open: true,
                            mekhala: selectedMekhalaForDetails,
                            loginId: selectedMekhalaForDetails?.loginId || "",
                            password: selectedMekhalaForDetails?.password || "",
                            showPassword: false,
                            saving: false,
                          })
                        }
                      >
                        <KeyRound className="h-3 w-3 mr-1" />
                        {selectedMekhalaForDetails?.loginId
                          ? "Update Credentials"
                          : "Set Credentials"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="h-[60vh] grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Mekhalas Section - Fixed Height */}
                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                      <MapPin className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold">
                        Mekhalas (
                        {
                          getAssignedDistricts(selectedMekhalaForDetails.id)
                            .length
                        }
                        )
                      </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2">
                      {getAssignedDistricts(selectedMekhalaForDetails.id)
                        .length > 0 ? (
                        <div className="space-y-3">
                          {getAssignedDistricts(
                            selectedMekhalaForDetails.id,
                          ).map((district, index) => (
                            <div
                              key={district.id}
                              className="p-3 bg-blue-50 border border-blue-200 rounded-lg"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center">
                                    {index + 1}
                                  </span>
                                  <div>
                                    <div className="font-medium text-blue-900">
                                      {district.name}
                                    </div>
                                    <div className="text-xs text-blue-600">
                                      Mekhala ID: {district.id}
                                    </div>
                                  </div>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {
                                    madrasas.filter(
                                      (m) => m.district === district.name,
                                    ).length
                                  }{" "}
                                  madrasas
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-500">
                              No mekhalas assigned
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Madrasas Section - Independent Scroll */}
                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                      <School className="h-5 w-5 text-green-600" />
                      <h3 className="text-lg font-semibold">
                        Madrasas (
                        {
                          getMadrasasForMekhala(selectedMekhalaForDetails.id)
                            .length
                        }
                        )
                      </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2">
                      {getMadrasasForMekhala(selectedMekhalaForDetails.id)
                        .length > 0 ? (
                        <div className="space-y-3">
                          {getMadrasasForMekhala(
                            selectedMekhalaForDetails.id,
                          ).map((madrasa, index) => (
                            <div
                              key={madrasa.id}
                              className="p-3 bg-green-50 border border-green-200 rounded-lg"
                            >
                              <div className="flex items-start gap-3">
                                <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center mt-1">
                                  {index + 1}
                                </span>
                                <div className="flex-1">
                                  <div className="font-medium text-green-900 mb-1">
                                    {madrasa.name}
                                  </div>
                                  <div className="space-y-1 text-xs text-green-700">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">MID:</span>
                                      <span className="bg-white px-2 py-1 rounded font-mono">
                                        {madrasa.madarsaId}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        Mekhala:
                                      </span>
                                      <span>{madrasa.district}</span>
                                    </div>
                                    {madrasa.phone && (
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">
                                          Contact:
                                        </span>
                                        <span>{madrasa.phone}</span>
                                      </div>
                                    )}
                                    {madrasa.email && (
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">
                                          Email:
                                        </span>
                                        <span>{madrasa.email}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-2">
                                    <Badge
                                      variant={
                                        madrasa.status === "active"
                                          ? "default"
                                          : "secondary"
                                      }
                                      className="text-xs"
                                    >
                                      {madrasa.status || "active"}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <School className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-500">No madrasas found</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
      {/* Credential Setup Dialog */}
      <Dialog
        open={credentialDialog.open}
        onOpenChange={() =>
          setCredentialDialog({
            open: false,
            mekhala: null,
            loginId: "",
            password: "",
            showPassword: false,
            saving: false,
          })
        }
      >
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-teal-600" />
              Set Portal Credentials
            </DialogTitle>
            <DialogDescription>
              {credentialDialog.mekhala?.name} — set the login ID and password
              for the Mekhala portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1 block">Login ID *</Label>
              <Input
                value={credentialDialog.loginId}
                onChange={(e) =>
                  setCredentialDialog((p) => ({
                    ...p,
                    loginId: e.target.value,
                  }))
                }
                placeholder="e.g. mekhala_pothencode"
              />
            </div>
            <div>
              <Label className="mb-1 block">Password *</Label>
              <div className="relative">
                <Input
                  type={credentialDialog.showPassword ? "text" : "password"}
                  value={credentialDialog.password}
                  onChange={(e) =>
                    setCredentialDialog((p) => ({
                      ...p,
                      password: e.target.value,
                    }))
                  }
                  placeholder="Enter password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() =>
                    setCredentialDialog((p) => ({
                      ...p,
                      showPassword: !p.showPassword,
                    }))
                  }
                >
                  {credentialDialog.showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setCredentialDialog({
                  open: false,
                  mekhala: null,
                  loginId: "",
                  password: "",
                  showPassword: false,
                  saving: false,
                })
              }
            >
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleSaveCredentials}
              disabled={credentialDialog.saving}
            >
              {credentialDialog.saving ? "Saving..." : "Save Credentials"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
