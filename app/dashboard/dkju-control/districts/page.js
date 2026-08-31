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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Edit,
  MapPin,
  Building,
  Users,
  GraduationCap,
  Eye,
  EyeOff,
  ChevronRight,
  School,
  Download,
  FileSpreadsheet,
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
  getCountFromServer,
  writeBatch,
} from "firebase/firestore";

// Build an array of stored-value variants for a mekhala/district name so we
// can use a targeted Firestore "in" query instead of a full collection scan.
function _nameVariants(name) {
  if (!name) return [];
  const canon = (canonicalMekhalaName(name) || name).trim();
  const variants = new Set([
    name,
    name.trim(),
    name.toLowerCase(),
    name.toUpperCase(),
    name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
    canon,
    canon.toLowerCase(),
    canon.toUpperCase(),
    canon.charAt(0).toUpperCase() + canon.slice(1).toLowerCase(),
  ]);
  return Array.from(variants).filter(Boolean).slice(0, 15); // within Firestore "in" limit (30)
}
import { db } from "@/lib/firebase";
import {
  madrasaMatchesMekhala,
  madrasaMatchesDistrict,
  getMekhalaListForDistrict,
  canonicalDistrictName,
  canonicalMekhalaName,
} from "@/lib/madrasaHierarchy";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ── Credential Dialog — own local state so typing never re-renders the page ──
function CredentialDialog({ open, mekhala, onClose, onSave }) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset fields whenever the dialog opens for a new mekhala
  useEffect(() => {
    if (open && mekhala) {
      setPhone(mekhala.phone || mekhala.loginId || "");
      setLoginId(mekhala.phone || mekhala.loginId || "");
      setShowPw(false);
    }
  }, [open, mekhala]);

  const handleSave = useCallback(async () => {
    if (!phone.trim()) {
      return;
    }
    if (!password.trim()) {
      return;
    }
    setSaving(true);
    await onSave(mekhala, phone.trim(), password.trim(), phone.trim());
    setSaving(false);
  }, [phone, password, mekhala, onSave]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[420px] bg-white gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-5 w-5 text-teal-600 shrink-0" />
            Set Portal Credentials
          </DialogTitle>
          <DialogDescription className="text-sm leading-snug mt-1">
            Set login ID &amp; password for{" "}
            <span className="font-semibold text-gray-900 capitalize">
              {mekhala?.name}
            </span>
            . This credential is exclusive to this mekhala only.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cred-phone" className="text-sm font-medium">
              Phone Number *
            </Label>
            <Input
              id="cred-phone"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, ""));
                setLoginId(e.target.value.replace(/\D/g, ""));
              }}
              placeholder="e.g. 9876543210"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cred-password" className="text-sm font-medium">
              Password *
            </Label>
            <div className="relative">
              <Input
                id="cred-password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          </div>
        <DialogFooter className="px-6 pb-5 gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={handleSave}
            disabled={saving || !phone.trim() || !password.trim()}
          >
            {saving ? "Saving..." : "Save Credentials"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DistrictsManagement() {
  const { user, role } = useAuth();
  const [districts, setDistricts] = useState([]);
  const [mekhalas, setMekhalas] = useState([]);
  const [allMadarsas, setAllMadarsas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState(null);

  // Hierarchy view state
  const [selectedMekhala, setSelectedMekhala] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [isMadarsasModalOpen, setIsMadarsasModalOpen] = useState(false);
  const [modalMadarsas, setModalMadarsas] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [credDlg, setCredDlg] = useState({ open: false, mekhala: null });

  // Form states
  const [districtForm, setDistrictForm] = useState({
    name: "",
    mekhalaId: "",
    description: "",
  });

  // Bulk add states
  const [bulkForm, setBulkForm] = useState({
    districtNames: "",
    mekhalaId: "",
    description: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [districtsSnap, mekhalasSnap, madarsasSnap] = await Promise.all([
        getDocs(collection(db, "districts")),
        getDocs(collection(db, "mekhala")),
        getDocs(collection(db, "madarsas")),
      ]);

      setDistricts(districtsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setMekhalas(mekhalasSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAllMadarsas(madarsasSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDistrictForm({
      name: "",
      mekhalaId: "",
      description: "",
    });
    setEditingDistrict(null);
  };

  const getParsedDistrictNames = () => {
    if (!bulkForm.districtNames.trim()) return [];
    return bulkForm.districtNames
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
  };

  const getDistrictsForMekhala = (mekhalaId) => {
    const sourceMekhala = mekhalas.find((m) => m.id === mekhalaId);

    // Collect all IDs that map to this mekhala (handles name-based fallback)
    const allIds = new Set();
    allIds.add((mekhalaId || "").trim());
    if (sourceMekhala) {
      mekhalas
        .filter(
          (m) =>
            (m.name || "").toLowerCase().trim() ===
            (sourceMekhala.name || "").toLowerCase().trim(),
        )
        .forEach((m) => allIds.add(m.id));
    }

    // Real Firestore district docs — deduplicate by CANONICAL name so that
    // e.g. "CHARUMMOOD" and "Charummoodu" are treated as the same entry.
    const realRaw = districts.filter((d) =>
      allIds.has((d.mekhalaId || "").trim()),
    );
    const seenRealCanon = new Set();
    const real = realRaw.filter((d) => {
      const raw = (d.name || "").trim();
      const canon = (canonicalMekhalaName(raw) || raw).toLowerCase();
      if (seenRealCanon.has(canon)) return false;
      seenRealCanon.add(canon);
      // Also index the raw lowercase so exact-name lookups still work
      seenRealCanon.add(raw.toLowerCase());
      return true;
    });
    // realNamesLower now contains both raw-lower and canonical-lower of every real doc
    const realNamesLower = seenRealCanon;

    if (!sourceMekhala) return real;

    // Virtual entries derived from actual allMadarsas data:
    // Find unique district names stored in madrasa docs under this mekhala
    // that don't already have a Firestore districts doc.
    // Normalize through canonicalMekhalaName so all spelling variants
    // (e.g. "PothanCod", "PothenCode", "Pothencode") merge into one card.
    const canonName = canonicalDistrictName(sourceMekhala.name);
    const virtualMap = new Map(); // canonical name (lower) → canonical display name
    allMadarsas.forEach((m) => {
      if (!madrasaMatchesDistrict(m, sourceMekhala.name)) return;
      const rawDistrict = (m.district || m.districtName || "").trim();
      if (!rawDistrict) return;
      // Normalize: merge all spelling variants into the canonical display name
      const canonical = canonicalMekhalaName(rawDistrict) || rawDistrict;
      const key = canonical.toLowerCase();
      if (!realNamesLower.has(key) && !virtualMap.has(key)) {
        virtualMap.set(key, canonical);
      }
    });

    // Also add any canonical config names that have madrasas but no district doc
    const configured = getMekhalaListForDistrict(canonName);
    configured.forEach((cfgName) => {
      const key = cfgName.toLowerCase();
      if (!realNamesLower.has(key) && !virtualMap.has(key)) {
        // Only include if actual madrasas exist for this name
        const hasMadrasas = allMadarsas.some(
          (m) =>
            madrasaMatchesDistrict(m, sourceMekhala.name) &&
            madrasaMatchesDistrict(m, cfgName),
        );
        if (hasMadrasas) virtualMap.set(key, cfgName);
      }
    });

    const virtual = Array.from(virtualMap.values()).map((name) => ({
      id: `virtual-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name,
      mekhalaId,
      _virtual: true,
    }));

    return [...real, ...virtual];
  };

  const getMadrasasCountForMekhala = (mekhalaName) =>
    allMadarsas.filter((m) => madrasaMatchesDistrict(m, mekhalaName)).length;

  const getUniqueMadarsaKey = (madarsa) =>
    String(madarsa?.madarsaId || madarsa?.id || "")
      .trim()
      .toLowerCase();

  const uniqueMadarsas = (madarsas) => {
    const seen = new Set();
    return madarsas.filter((madarsa) => {
      const key = getUniqueMadarsaKey(madarsa);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const getMadrasasForDistrict = (mekhalaName, districtName) => {
    const canonDist = (canonicalMekhalaName(districtName) || districtName)
      .toLowerCase()
      .trim();

    const matchedMadarsas = allMadarsas.filter((m) => {
      if (!madrasaMatchesDistrict(m, mekhalaName)) return false;
      const storedRaw = (m.district || m.districtName || "").trim();
      const storedCanon = (canonicalMekhalaName(storedRaw) || storedRaw)
        .toLowerCase()
        .trim();
      return storedCanon === canonDist;
    });

    return uniqueMadarsas(matchedMadarsas);
  };

  // Normalize both sides through canonicalMekhalaName so all spelling variants
  // of a district name (e.g. "PothanCod", "PothenCode", "Pothencode") count together.
  const getMadrasasCountForDistrict = (mekhalaName, districtName) =>
    getMadrasasForDistrict(mekhalaName, districtName).length;

  const loadMadarsas = async (district) => {
    if (!selectedMekhala) return;
    setSelectedDistrict(district);
    setIsMadarsasModalOpen(true);
    setModalLoading(true);
    setModalMadarsas([]);

    try {
      const mekhalaName = selectedMekhala.name;
      const districtName = district.name;
      const madarsasList = getMadrasasForDistrict(mekhalaName, districtName);

      const withCounts = await Promise.all(
        madarsasList.map(async (m) => {
          try {
            const [studentSnap, teacherSnap] = await Promise.all([
              getCountFromServer(
                query(
                  collection(db, "students"),
                  where("madarsaId", "==", m.madarsaId),
                ),
              ),
              getCountFromServer(
                query(
                  collection(db, "teachers"),
                  where("madarsaId", "==", m.madarsaId),
                ),
              ),
            ]);
            return {
              ...m,
              studentCount: studentSnap.data().count,
              teacherCount: teacherSnap.data().count,
            };
          } catch {
            return { ...m, studentCount: "-", teacherCount: "-" };
          }
        }),
      );

      setModalMadarsas(withCounts);
    } catch (error) {
      console.error("Error loading madarsas:", error);
      toast.error("Failed to load madarsas");
    } finally {
      setModalLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!districtForm.name.trim() || !districtForm.mekhalaId) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const districtData = {
        name: districtForm.name.trim(),
        mekhalaId: districtForm.mekhalaId,
        description: districtForm.description.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (editingDistrict) {
        const oldName = (editingDistrict.name || "").trim();
        const newName = districtForm.name.trim();

        // Helper: propagate name change across all collections
        // Uses parallel fetches + Firestore batched writes (max 500/batch) for speed.
        const propagateName = async (from, to) => {
          if (!from || !to) return 0;
          const canonFrom = (canonicalMekhalaName(from) || from).toLowerCase();
          const canonTo = (canonicalMekhalaName(to) || to).toLowerCase();

          const matchesFrom = (val) => {
            if (!val) return false;
            const v = val.toLowerCase();
            if (v === from.toLowerCase()) return true;
            const c = (canonicalMekhalaName(val) || val).toLowerCase();
            return c === canonFrom || c === canonTo;
          };

          // Build name variants for targeted queries (avoids full collection scans)
          const variants = _nameVariants(from);

          // For large collections (students/teachers/managers) use targeted where queries.
          // For small collections (madarsas/mekhala) a full scan is acceptable.
          const queryByNameFields = async (colName) => {
            const [byMekhala, byDistrict] = await Promise.all([
              getDocs(
                query(
                  collection(db, colName),
                  where("mekhala", "in", variants),
                ),
              ),
              getDocs(
                query(
                  collection(db, colName),
                  where("district", "in", variants),
                ),
              ),
            ]);
            const seen = new Set();
            const allDocs = [];
            for (const d of [...byMekhala.docs, ...byDistrict.docs]) {
              if (!seen.has(d.id)) {
                seen.add(d.id);
                allDocs.push(d);
              }
            }
            return { docs: allDocs };
          };

          // Fetch in parallel: full scans for small collections, targeted for large ones
          const [
            madarsasSnap,
            studentsSnap,
            teachersSnap,
            managersSnap,
            mekhalaSnap,
          ] = await Promise.all([
            getDocs(collection(db, "madarsas")),
            queryByNameFields("students"),
            queryByNameFields("teachers"),
            queryByNameFields("managers"),
            getDocs(collection(db, "mekhala")),
          ]);

          // Collect all {ref, fields} pairs that need updating
          const updates = [];
          const addUpdates = (snap, colName, nameField = null) => {
            snap.docs.forEach((d) => {
              const data = d.data();
              if (nameField) {
                if (matchesFrom(data[nameField]))
                  updates.push({
                    ref: doc(db, colName, d.id),
                    fields: { [nameField]: to },
                  });
              } else {
                const fields = {};
                if (matchesFrom(data.mekhala)) fields.mekhala = to;
                if (matchesFrom(data.district)) fields.district = to;
                if (Object.keys(fields).length)
                  updates.push({ ref: doc(db, colName, d.id), fields });
              }
            });
          };

          addUpdates(madarsasSnap, "madarsas");
          addUpdates(studentsSnap, "students");
          addUpdates(teachersSnap, "teachers");
          addUpdates(managersSnap, "managers");
          addUpdates(mekhalaSnap, "mekhala", "name");

          // Firestore batch limit is 500 ops — chunk and commit in parallel
          const CHUNK = 500;
          const batchPromises = [];
          for (let i = 0; i < updates.length; i += CHUNK) {
            const batch = writeBatch(db);
            updates
              .slice(i, i + CHUNK)
              .forEach(({ ref, fields }) => batch.update(ref, fields));
            batchPromises.push(batch.commit());
          }
          await Promise.all(batchPromises);
          return updates.length;
        };

        // Virtual districts have no Firestore doc yet — but first check if one already
        // exists with the new name (avoids creating duplicates on repeated edits).
        if (editingDistrict._virtual) {
          // Propagate first: update all madrasas/students/teachers from oldName → newName
          // This covers all stored spelling variants (CHARUMMOOD, Charummoodu, etc.)
          const count = await propagateName(oldName, newName);

          // Check if a Firestore doc already exists for this name+mekhala combination
          const existingSnap = await getDocs(collection(db, "districts"));
          const existingDoc = existingSnap.docs.find(
            (d) =>
              (d.data().name || "").toLowerCase().trim() ===
                newName.toLowerCase() &&
              (d.data().mekhalaId || "") === districtForm.mekhalaId,
          );

          if (existingDoc) {
            // Update the existing doc instead of creating a duplicate
            await updateDoc(doc(db, "districts", existingDoc.id), {
              name: newName,
              mekhalaId: districtForm.mekhalaId,
              description: districtForm.description,
              updatedAt: serverTimestamp(),
            });
            toast.success(
              `Mekhala updated and ${count} related records synced`,
            );
          } else {
            // Only create a new doc if truly none exists
            await addDoc(collection(db, "districts"), {
              name: newName,
              mekhalaId: districtForm.mekhalaId,
              description: districtForm.description,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            toast.success(
              `Mekhala registered and ${count} related records updated`,
            );
          }
          setIsAddDialogOpen(false);
          resetForm();
          fetchData();
          return;
        }
        await updateDoc(doc(db, "districts", editingDistrict.id), {
          ...districtData,
          createdAt: editingDistrict.createdAt,
        });
        // Propagate name change for non-virtual entries too
        await propagateName(oldName, newName);
        toast.success("Mekhala updated successfully");
      } else {
        await addDoc(collection(db, "districts"), districtData);
        toast.success("Mekhala added successfully");
      }

      setIsAddDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving district:", error);
      toast.error("Failed to save district");
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();

    if (!bulkForm.districtNames.trim() || !bulkForm.mekhalaId) {
      toast.error("Please enter district names and select a mekhala");
      return;
    }

    try {
      const districtNames = getParsedDistrictNames();

      if (districtNames.length === 0) {
        toast.error("Please enter valid district names");
        return;
      }

      const promises = districtNames.map((name) => {
        const districtData = {
          name: name,
          mekhalaId: bulkForm.mekhalaId,
          description: bulkForm.description.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        return addDoc(collection(db, "districts"), districtData);
      });

      await Promise.all(promises);

      toast.success(
        "Successfully added " + districtNames.length + " districts",
      );
      setIsBulkDialogOpen(false);
      setBulkForm({ districtNames: "", mekhalaId: "", description: "" });
      fetchData();
    } catch (error) {
      console.error("Error adding districts in bulk:", error);
      toast.error("Failed to add districts in bulk");
    }
  };

  const handleEdit = (district) => {
    setEditingDistrict(district);
    setDistrictForm({
      name: district.name,
      mekhalaId: district.mekhalaId,
      description: district.description || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (districtId, district) => {
    if (!confirm("Are you sure you want to delete this mekhala?")) return;

    // Virtual entries have no Firestore doc — they are derived from madrasa data
    if (district?._virtual) {
      toast.error(
        "This mekhala has no registry entry. Reassign its madrasas to a different mekhala first.",
      );
      return;
    }

    try {
      await deleteDoc(doc(db, "districts", districtId));
      toast.success("Mekhala deleted successfully");
      fetchData();
    } catch (error) {
      console.error("Error deleting district:", error);
      toast.error("Failed to delete district");
    }
  };

  const getMekhalaName = (mekhalaId) => {
    const mekhala = mekhalas.find((m) => m.id === mekhalaId);
    return mekhala ? mekhala.name : "Unknown District";
  };

  // ─── Export: selected district → its mekhalas + madrasa counts ──────────────
  const exportDistrictCSV = () => {
    if (!selectedMekhala) return;
    const districtList = getDistrictsForMekhala(selectedMekhala.id);
    const rows = [
      ["District: " + selectedMekhala.name.toUpperCase()],
      [],
      ["Mekhala Name", "Madrasa Count"],
      ...districtList.map((d) => [
        d.name,
        getMadrasasCountForDistrict(selectedMekhala.name, d.name),
      ]),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["A1"] = { v: "District: " + selectedMekhala.name.toUpperCase(), t: "s" };
    XLSX.utils.book_append_sheet(wb, ws, "Mekhalas");
    XLSX.writeFile(wb, `${selectedMekhala.name}-mekhalas.xlsx`);
    toast.success("Excel exported successfully");
  };

  const exportDistrictPDF = () => {
    if (!selectedMekhala) return;
    const districtList = getDistrictsForMekhala(selectedMekhala.id);
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(selectedMekhala.name.toUpperCase(), 14, 20);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Mekhalas: ${districtList.length}`, 14, 30);

    autoTable(doc, {
      startY: 38,
      head: [["#", "Mekhala Name", "Madrasa Count"]],
      body: districtList.map((d, i) => [
        i + 1,
        d.name,
        getMadrasasCountForDistrict(selectedMekhala.name, d.name),
      ]),
      headStyles: { fillColor: [20, 184, 166] },
    });

    doc.save(`${selectedMekhala.name}-mekhalas.pdf`);
    toast.success("PDF exported successfully");
  };

  // ─── Export: selected mekhala → its madrasas ─────────────────────────────────
  const exportMekhalaCSV = () => {
    if (!selectedDistrict || !selectedMekhala) return;
    const rows = [
      [
        `District: ${selectedMekhala.name.toUpperCase()} | Mekhala: ${selectedDistrict.name.toUpperCase()}`,
      ],
      [],
      [
        "Madrasa Name",
        "Madrasa ID",
        "Address",
        "Phone",
        "Sadar Name",
        "Sadar Phone",
        "Manager Name",
        "Manager Phone",
        "Manager Position",
        "Students",
        "Teachers",
      ],
      ...modalMadarsas.map((m) => [
        m.name,
        m.madarsaId || "",
        m.address || "",
        m.phone || "",
        m.adminName || m.sadarName || "",
        m.adminPhone || m.sadarPhone || "",
        m.managerName || "",
        m.phone || "",
        m.managerPosition || "",
        m.studentCount ?? "-",
        m.teacherCount ?? "-",
      ]),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Madrasas");
    XLSX.writeFile(wb, `${selectedDistrict.name}-madrasas.xlsx`);
    toast.success("Excel exported successfully");
  };

  const exportMekhalaPDF = () => {
    if (!selectedDistrict || !selectedMekhala) return;
    const doc = new jsPDF("landscape");

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(
      `${selectedMekhala.name.toUpperCase()} — ${selectedDistrict.name.toUpperCase()}`,
      14,
      20,
    );

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Madrasas: ${modalMadarsas.length}`, 14, 30);

    autoTable(doc, {
      startY: 38,
      head: [["#", "Madrasa Name", "MID", "Sadar Name", "Sadar Phone", "Manager Name", "Manager Phone", "Manager Pos", "Students", "Teachers"]],
      body: modalMadarsas.map((m, i) => [
        i + 1,
        m.name,
        m.madarsaId || "-",
        m.adminName || m.sadarName || "-",
        m.adminPhone || m.sadarPhone || "-",
        m.managerName || "-",
        m.phone || "-",
        m.managerPosition || "-",
        m.studentCount ?? "-",
        m.teacherCount ?? "-",
      ]),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.5, textColor: [40, 40, 40], overflow: "linebreak", font: "helvetica" },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold", halign: "center", valign: "middle" },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },    // #
        1: { halign: "left", cellWidth: 45 },      // Madrasa Name
        2: { halign: "center", cellWidth: 15 },    // MID
        3: { halign: "left", cellWidth: 40 },      // Sadar Name
        4: { halign: "center", cellWidth: 30 },    // Sadar Phone
        5: { halign: "left", cellWidth: 40 },      // Manager Name
        6: { halign: "center", cellWidth: 30 },    // Manager Phone
        7: { halign: "center", cellWidth: 27 },    // Manager Pos
        8: { halign: "center", cellWidth: 20 },    // Students
        9: { halign: "center", cellWidth: 20 }     // Teachers
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 35, left: 10, right: 10 }
    });

    doc.save(`${selectedDistrict.name}-madrasas.pdf`);
    toast.success("PDF exported successfully");
  };

  const handleSaveCredentials = useCallback(
    async (mekhala, loginId, password, phone) => {
      try {
        let districtDocId = mekhala.id;

        if (mekhala._virtual) {
          const newDocRef = await addDoc(collection(db, "districts"), {
            name: mekhala.name,
            mekhalaId: mekhala.mekhalaId,
            loginId,
            password,
            phone,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          districtDocId = newDocRef.id;
          setDistricts((prev) => [
            ...prev,
            {
              id: districtDocId,
              name: mekhala.name,
              mekhalaId: mekhala.mekhalaId,
              loginId,
              password,
              phone,
            },
          ]);
        } else {
          await updateDoc(doc(db, "districts", districtDocId), {
            loginId,
            password,
            phone,
            updatedAt: new Date(),
          });
          setDistricts((prev) =>
            prev.map((d) =>
              d.id === districtDocId
                ? { ...d, loginId, password, phone }
                : d,
            ),
          );
        }

        setSelectedDistrict((prev) =>
          prev
            ? {
                ...prev,
                id: districtDocId,
                loginId,
                password,
                phone,
                _virtual: false,
              }
            : prev,
        );

        toast.success(`Credentials saved for ${mekhala.name}!`);
        setCredDlg({ open: false, mekhala: null });
      } catch (err) {
        console.error(err);
        toast.error("Failed to save credentials");
      }
    },
    [],
  );

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
      <div className="container mx-auto p-6 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mekhala Management</h1>
            <p className="text-gray-600">
              Browse the district → mekhala → madrasa hierarchy
            </p>
          </div>
          <div className="flex gap-2">
            {/* Bulk Add Dialog */}
            <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Bulk Add
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white h-[90vh] overflow-y-scroll max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Bulk Add Mekhala</DialogTitle>
                  <DialogDescription>
                    Add multiple mekhalas at once using comma-separated names
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleBulkSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="mekhala-bulk">Assign to District*</Label>
                    <Select
                      value={bulkForm.mekhalaId}
                      onValueChange={(value) =>
                        setBulkForm((prev) => ({ ...prev, mekhalaId: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select district for all mekhalas" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {mekhalas.map((mekhala) => (
                          <SelectItem key={mekhala.id} value={mekhala.id}>
                            {mekhala.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="district-names">Mekhala Names*</Label>
                    <Textarea
                      id="district-names"
                      value={bulkForm.districtNames}
                      onChange={(e) =>
                        setBulkForm((prev) => ({
                          ...prev,
                          districtNames: e.target.value,
                        }))
                      }
                      placeholder="Enter district names separated by commas (e.g., Mekhala A, Mekhala B, Mekhala C)"
                      rows={4}
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Separate district names with commas. Each name will be
                      created as a separate district.
                    </p>

                    {getParsedDistrictNames().length > 0 && (
                      <div className="mt-3">
                        <Label className="text-sm font-medium text-gray-700">
                          Preview ({getParsedDistrictNames().length} mekhalas):
                        </Label>
                        <div className="flex flex-wrap gap-2 mt-2 p-3 bg-gray-50 rounded-lg border">
                          {getParsedDistrictNames().map((name, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="bg-blue-100 text-blue-800 border-blue-200"
                            >
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="description-bulk">
                      Description (Optional)
                    </Label>
                    <Textarea
                      id="description-bulk"
                      value={bulkForm.description}
                      onChange={(e) =>
                        setBulkForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Optional description for all mekhalas"
                      rows={2}
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsBulkDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        getParsedDistrictNames().length === 0 ||
                        !bulkForm.mekhalaId
                      }
                    >
                      Add{" "}
                      {getParsedDistrictNames().length > 0
                        ? getParsedDistrictNames().length
                        : ""}{" "}
                      Mekhala{getParsedDistrictNames().length !== 1 ? "s" : ""}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* Add Mekhala Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Mekhala
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white">
                <DialogHeader>
                  <DialogTitle>
                    {editingDistrict ? "Edit Mekhala" : "Add New Mekhala"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingDistrict
                      ? "Update district information"
                      : "Create a new district"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="district-name">
                      Mekhala Name (Multiple? Comma Separated)*
                    </Label>
                    <Input
                      id="district-name"
                      value={districtForm.name}
                      onChange={(e) =>
                        setDistrictForm((prev) => ({
                          ...prev,
                          name: e.target.value.toLocaleLowerCase(),
                        }))
                      }
                      placeholder="Enter mekhala name"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="mekhala">Assign to District*</Label>
                    <Select
                      value={districtForm.mekhalaId}
                      onValueChange={(value) =>
                        setDistrictForm((prev) => ({
                          ...prev,
                          mekhalaId: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {mekhalas.map((mekhala) => (
                          <SelectItem key={mekhala.id} value={mekhala.id}>
                            {mekhala.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={districtForm.description}
                      onChange={(e) =>
                        setDistrictForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Optional description"
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
                      {editingDistrict ? "Update" : "Add"} Mekhala
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── Summary badges ── */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-4 py-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span>{mekhalas.length} Districts</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-4 py-2 text-sm font-medium">
            <Building className="h-4 w-4 text-gray-500" />
            <span>{districts.length} Mekhalas</span>
          </div>
        </div>

        {/* ── Main two-column layout ── */}
        <div className="flex gap-4" style={{ minHeight: "65vh" }}>
          {/* Left column — selectable district rectangles */}
          <div className="w-60 xl:w-72 shrink-0 flex flex-col gap-1 overflow-y-auto pr-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">
              Districts ({mekhalas.length})
            </p>
            {mekhalas.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                No districts found
              </div>
            ) : (
              mekhalas.map((m) => {
                const count = getDistrictsForMekhala(m.id).length;
                const isSelected = selectedMekhala?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMekhala(isSelected ? null : m)}
                    className={[
                      "flex items-center justify-between px-3 py-3 rounded-lg border cursor-pointer",
                      "transition-all duration-150 select-none",
                      isSelected
                        ? "bg-black text-white border-black shadow-md"
                        : "bg-white text-gray-800 border-gray-200 hover:border-gray-800 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <span className="font-medium text-sm leading-tight capitalize">
                      {m.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span
                        className={[
                          "text-xs rounded-full px-1.5 py-0.5 font-semibold",
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-gray-100 text-gray-500",
                        ].join(" ")}
                      >
                        {count}
                      </span>
                      <ChevronRight
                        className={[
                          "h-3.5 w-3.5 transition-transform",
                          isSelected ? "rotate-90 text-white" : "text-gray-400",
                        ].join(" ")}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right side — mekhala cards */}
          <div className="flex-1 overflow-y-auto">
            {!selectedMekhala ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 select-none">
                <MapPin className="h-16 w-16 mb-4" />
                <p className="text-xl font-semibold text-gray-400">
                  Select a District
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Choose a district from the left to see its mekhalas
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-bold capitalize">
                      {selectedMekhala.name}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {getDistrictsForMekhala(selectedMekhala.id).length}{" "}
                      mekhalas
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportDistrictCSV}
                      className="border-teal-500 text-teal-600 hover:bg-teal-50"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-1" />
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportDistrictPDF}
                      className="border-teal-500 text-teal-600 hover:bg-teal-50"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>

                {getDistrictsForMekhala(selectedMekhala.id).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                    <Building className="h-12 w-12 mb-3" />
                    <p className="text-gray-400 text-sm">
                      No mekhalas in this district
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        setDistrictForm((prev) => ({
                          ...prev,
                          mekhalaId: selectedMekhala.id,
                        }));
                        setIsAddDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Mekhala
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {getDistrictsForMekhala(selectedMekhala.id).map(
                      (district) => {
                        const madrasaCount = getMadrasasCountForDistrict(
                          selectedMekhala.name,
                          district.name,
                        );
                        return (
                          <div
                            key={district.id}
                            className="overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow group"
                          >
                            {/* Teal header */}
                            <div className="bg-teal-500 px-4 py-3 flex items-center justify-between">
                              <span className="text-white font-bold text-sm uppercase leading-tight">
                                {district.name}
                              </span>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
                                <button
                                  className="text-white/70 hover:text-white p-0.5"
                                  onClick={() => handleEdit(district)}
                                >
                                  <Edit className="h-3 w-3" />
                                </button>
                                <button
                                  className="text-white/70 hover:text-red-200 p-0.5"
                                  onClick={() =>
                                    handleDelete(district.id, district)
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            {/* White body */}
                            <div className="bg-white px-3 pt-2.5 pb-3 space-y-2.5">
                              {/* Madrasas count */}
                              <div className="flex items-center gap-1.5 text-sm">
                                <span className="h-2 w-2 rounded-full bg-teal-500 inline-block shrink-0" />
                                <span className="font-semibold text-gray-800">
                                  {madrasaCount}
                                </span>
                                <span className="text-gray-500">Madrasas</span>
                              </div>

                              {district.description && (
                                <p className="text-xs text-gray-400 line-clamp-2">
                                  {district.description}
                                </p>
                              )}

                              <Button
                                className="w-full border border-teal-500 text-teal-600 bg-white hover:bg-teal-50 text-xs h-8 gap-1.5"
                                variant="outline"
                                onClick={() => loadMadarsas(district)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View Madrasas
                              </Button>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Madarsas Modal ── */}
        <Dialog
          open={isMadarsasModalOpen}
          onOpenChange={setIsMadarsasModalOpen}
        >
          <DialogContent className="bg-white max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <School className="h-5 w-5 text-teal-600" />
                Madrasas in{" "}
                <span className="capitalize">{selectedDistrict?.name}</span>
                {selectedMekhala && (
                  <span className="text-gray-400 font-normal text-sm">
                    &nbsp;· {selectedMekhala.name}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription>
                {modalLoading
                  ? "Fetching madrasas and their counts…"
                  : modalMadarsas.length +
                    " madrasa" +
                    (modalMadarsas.length !== 1 ? "s" : "") +
                    " found"}
              </DialogDescription>
            </DialogHeader>

            {/* Export buttons */}
            {!modalLoading && modalMadarsas.length > 0 && (
              <div className="flex items-center gap-2 justify-end -mt-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportMekhalaCSV}
                  className="border-teal-500 text-teal-600 hover:bg-teal-50"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  Export Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportMekhalaPDF}
                  className="border-teal-500 text-teal-600 hover:bg-teal-50"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export PDF
                </Button>
              </div>
            )}

            {/* ── Portal Credentials Strip — scoped to the specific mekhala (selectedDistrict) ── */}
            {selectedDistrict && (
              <div className="border border-teal-200 rounded-lg bg-teal-50/40 p-3 mb-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-teal-600" />
                  <span className="font-medium text-teal-800 text-sm">
                    Portal Credentials —{" "}
                    <span className="capitalize">{selectedDistrict.name}</span>
                  </span>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  {selectedDistrict?.loginId ? (
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="text-gray-500">
                        Login ID:{" "}
                        <span className="font-mono font-semibold text-gray-800">
                          {selectedDistrict.loginId}
                        </span>
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-500">
                        Password:{" "}
                        <span className="font-mono font-semibold text-gray-800">
                          ••••••••
                        </span>
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-500">
                        Phone No:{" "}
                        <span className="font-mono font-semibold text-gray-800">
                          {selectedDistrict.phone || "—"}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-amber-600 font-medium">
                      ⚠ No credentials set for {selectedDistrict.name} yet
                    </span>
                  )}
                  <Button
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white h-8 px-3"
                    onClick={() =>
                      setCredDlg({ open: true, mekhala: selectedDistrict })
                    }
                  >
                    <KeyRound className="h-3 w-3 mr-1" />
                    {selectedDistrict?.loginId
                      ? "Update Credentials"
                      : "Set Credentials"}
                  </Button>
                </div>
              </div>
            )}

            {modalLoading ? (
              <div className="py-16 text-center text-gray-500">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500 mb-3" />
                <p className="text-sm">Loading madrasas…</p>
              </div>
            ) : modalMadarsas.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <School className="h-12 w-12 mx-auto mb-3 text-teal-200" />
                <p className="font-medium">No madrasas found</p>
                <p className="text-sm mt-1">
                  No madrasas are assigned to this mekhala yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {modalMadarsas.map((m) => (
                  <div
                    key={m.id}
                    className="border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow"
                  >
                    {/* Green header */}
                    <div className="bg-teal-500 px-4 py-3">
                      <p className="text-white font-bold text-sm uppercase leading-tight tracking-wide">
                        {m.name}
                      </p>
                      {m.madarsaId && (
                        <span className="text-teal-100 text-xs">
                          {m.madarsaId}
                        </span>
                      )}
                    </div>
                    {/* White body */}
                    <div className="bg-white px-4 py-3 space-y-2">
                      {m.address && (
                        <p className="text-xs text-gray-400 flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-teal-500" />
                          <span>{m.address}</span>
                        </p>
                      )}
                      <div className="flex gap-6 pt-1 border-t border-gray-100">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-teal-600">
                          <Users className="h-3.5 w-3.5" />
                          {m.studentCount} Students
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-teal-600">
                          <GraduationCap className="h-3.5 w-3.5" />
                          {m.teacherCount} Teachers
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      {/* Credential Setup Dialog — isolated component to avoid page re-renders on keystroke */}
      <CredentialDialog
        open={credDlg.open}
        mekhala={credDlg.mekhala}
        onClose={() => setCredDlg({ open: false, mekhala: null })}
        onSave={handleSaveCredentials}
      />
    </Layout>
  );
}
