"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  School,
  Search,
  Hash,
  Save,
  RefreshCw,
  Info,
  MapPin,
  Users,
  BookOpen,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  setDoc,
  getDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

// Class ordering for hall ticket number generation
const CLASS_ORDER = [
  "LKG", "UKG", "Ukg", "ukg",
  "1", "2", "3", "4", "5", "6",
  "7", "8", "9", "10", "11", "12",
];

const normalizeClass = (c) => {
  if (!c) return "";
  const u = String(c).trim().toUpperCase();
  if (u === "LKG" || u === "L.K.G") return "LKG";
  if (u === "UKG" || u === "U.K.G") return "UKG";
  const n = parseInt(u);
  if (!isNaN(n) && n >= 1 && n <= 12) return String(n);
  return String(c).trim();
};

const getClassSortOrder = (c) => {
  const norm = normalizeClass(c);
  if (norm === "LKG") return -1;
  if (norm === "UKG") return 0;
  const n = parseInt(norm);
  if (!isNaN(n)) return n;
  return 999;
};

export default function HallTicketAssignmentPage() {
  const [madrasas, setMadrasas] = useState([]);
  const [loadingMadrasas, setLoadingMadrasas] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Assigned madrasas list (from Firestore hallTicketMadrasaSequence collection)
  const [assignments, setAssignments] = useState([]); // [{madarsaId, sequenceNumber, classStrengths, assignedAt}]
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [liveCounts, setLiveCounts] = useState({}); // { madarsaId: { classes: N, students: M } }

  // Modal state
  const [selectedMadrasa, setSelectedMadrasa] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [classStrengths, setClassStrengths] = useState({}); // {classLevel: count}
  const [sequenceNumber, setSequenceNumber] = useState("");
  const [loadingStrengths, setLoadingStrengths] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch all madrasas
  const fetchMadrasas = useCallback(async () => {
    try {
      setLoadingMadrasas(true);
      const snap = await getDocs(
        query(collection(db, "madarsas"), orderBy("name", "asc"))
      );
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMadrasas(data);
    } catch (err) {
      console.error("Error fetching madrasas:", err);
      toast.error("Failed to fetch madrasas");
    } finally {
      setLoadingMadrasas(false);
    }
  }, []);

  // Fetch existing assignments
  const fetchAssignments = useCallback(async () => {
    try {
      setLoadingAssignments(true);
      const snap = await getDocs(collection(db, "hallTicketMadrasaSequence"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAssignments(data);
    } catch (err) {
      console.error("Error fetching assignments:", err);
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  useEffect(() => {
    fetchMadrasas();
    fetchAssignments();
  }, [fetchMadrasas, fetchAssignments]);

  // Fetch live counts for the table to avoid "0 classes 0 students" inconsistency
  useEffect(() => {
    const fetchLiveCounts = async () => {
      if (!assignments.length || !madrasas.length) return;
      const counts = { ...liveCounts };
      
      const toFetch = assignments.filter(a => !counts[a.madarsaId]);
      if (toFetch.length === 0) return;

      await Promise.all(toFetch.map(async (asgn) => {
        try {
          const madrasa = madrasas.find(m => m.id === asgn.madarsaId);
          if (!madrasa) return;
          const madarsaCode = madrasa.madarsaId || madrasa.mid || madrasa.id;
          
          const snap = await getDocs(
            query(collection(db, "students"), where("madarsaId", "==", madarsaCode))
          );
          
          const classSet = new Set();
          snap.docs.forEach(d => {
            const cls = normalizeClass(d.data().classLevel);
            if (cls) classSet.add(cls);
          });
          
          counts[asgn.madarsaId] = { classes: classSet.size, students: snap.size };
        } catch (e) {
          console.error("Error fetching live count for", asgn.madarsaId, e);
        }
      }));
      setLiveCounts(counts);
    };
    fetchLiveCounts();
  }, [assignments, madrasas]);

  // Filtered madrasas for search
  const filteredMadrasas = useMemo(() => {
    if (!searchTerm.trim()) return madrasas;
    const t = searchTerm.toLowerCase();
    return madrasas.filter(
      (m) =>
        m.name?.toLowerCase().includes(t) ||
        m.id?.toLowerCase().includes(t) ||
        m.madarsaId?.toLowerCase().includes(t) ||
        m.district?.toLowerCase().includes(t) ||
        m.address?.toLowerCase().includes(t)
    );
  }, [madrasas, searchTerm]);

  // Get assignment for a madrasa
  const getAssignment = (madrasaId) =>
    assignments.find((a) => a.madarsaId === madrasaId);

  // Open modal: fetch student class strengths for the selected madrasa
  const openMadrasaModal = async (madrasa) => {
    setSelectedMadrasa(madrasa);
    setModalOpen(true);
    setLoadingStrengths(true);
    setClassStrengths({});
    setSequenceNumber("");

    // Pre-populate sequence number if existing assignment exists
    const existing = getAssignment(madrasa.id);
    if (existing) {
      setSequenceNumber(String(existing.sequenceNumber || ""));
    }

    // Fetch live student strengths
    try {
      const madarsaCode = madrasa.madarsaId || madrasa.mid || madrasa.id;
      const snap = await getDocs(
        query(
          collection(db, "students"),
          where("madarsaId", "==", madarsaCode)
        )
      );

      const strengthMap = {};
      snap.docs.forEach((d) => {
        const cls = normalizeClass(d.data().classLevel);
        if (!cls) return;
        strengthMap[cls] = (strengthMap[cls] || 0) + 1;
      });

      setClassStrengths(strengthMap);
    } catch (err) {
      console.error("Error fetching strengths:", err);
      toast.error("Failed to fetch student strengths");
    } finally {
      setLoadingStrengths(false);
    }
  };

  // Save assignment
  const saveAssignment = async () => {
    if (!sequenceNumber || isNaN(parseInt(sequenceNumber)) || parseInt(sequenceNumber) < 1) {
      toast.error("Please enter a valid sequence number (≥ 1)");
      return;
    }

    const seqNum = parseInt(sequenceNumber);

    // Check for duplicate sequence number
    const duplicate = assignments.find(
      (a) =>
        a.madarsaId !== selectedMadrasa.id &&
        a.sequenceNumber === seqNum
    );
    if (duplicate) {
      const dupMadrasa = madrasas.find((m) => m.id === duplicate.madarsaId);
      toast.error(
        `Sequence #${seqNum} is already assigned to "${dupMadrasa?.name || duplicate.madarsaId}". Please use a different number.`
      );
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, "hallTicketMadrasaSequence", selectedMadrasa.id);
      const assignmentData = {
        madarsaId: selectedMadrasa.id,
        madarsaName: selectedMadrasa.name,
        sequenceNumber: seqNum,
        classStrengths,
        district: selectedMadrasa.district || "",
        address: selectedMadrasa.address || "",
        adminName: selectedMadrasa.adminName || "",
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(docRef, assignmentData, { merge: true });

      // Update local state
      setAssignments((prev) => {
        const filtered = prev.filter((a) => a.madarsaId !== selectedMadrasa.id);
        return [...filtered, { id: selectedMadrasa.id, ...assignmentData }];
      });

      // Now regenerate hall ticket numbers for all students in this madrasa
      // by batch-updating the computed sequence numbers
      await recomputeHallTicketNumbers(selectedMadrasa.id, seqNum, classStrengths);

      toast.success(`Sequence #${seqNum} saved for ${selectedMadrasa.name}`);
      setModalOpen(false);
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save assignment");
    } finally {
      setSaving(false);
    }
  };

  // Recompute and assign hall ticket numbers to students of a madrasa
  const recomputeHallTicketNumbers = async (madrasaId, seqNum, strengthMap) => {
    try {
      // Fetch all assignments ordered by sequence number to compute offsets
      const allSnap = await getDocs(collection(db, "hallTicketMadrasaSequence"));
      const allAssignments = allSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

      // Build class → start number map based on all madrasas sorted by seqNum
      // For each class: collect madrasas by seqNum order, compute running total
      const allClasses = new Set();
      allAssignments.forEach((a) => {
        Object.keys(a.classStrengths || {}).forEach((c) => allClasses.add(c));
      });

      const sortedClasses = Array.from(allClasses).sort(
        (a, b) => getClassSortOrder(a) - getClassSortOrder(b)
      );

      let globalCounter = 1;
      // classStartMap: { "UKG_mid-123": 51, "1_mid-123": 201, ... }
      const studentStartMap = {}; // madrasaId_class → start number

      for (const cls of sortedClasses) {
        // All madrasas for this class, sorted by sequence number
        const madrasasForClass = allAssignments
          .filter((a) => (a.classStrengths || {})[cls] > 0)
          .sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

        for (const assignment of madrasasForClass) {
          const strength = (assignment.classStrengths || {})[cls] || 0;
          if (strength > 0) {
            studentStartMap[`${assignment.madarsaId}_${cls}`] = globalCounter;
            globalCounter += strength;
          }
        }
      }

      // Now fetch students for THIS madrasa and assign numbers
      const madarsaObj = madrasas.find((m) => m.id === madrasaId);
      const madarsaCode = madarsaObj?.madarsaId || madarsaObj?.mid || madrasaId;
      const studentsSnap = await getDocs(
        query(
          collection(db, "students"),
          where("madarsaId", "==", madarsaCode)
        )
      );

      // Group students by class
      const studentsByClass = {};
      studentsSnap.docs.forEach((d) => {
        const cls = normalizeClass(d.data().classLevel);
        if (!cls) return;
        if (!studentsByClass[cls]) studentsByClass[cls] = [];
        studentsByClass[cls].push({ id: d.id, ...d.data() });
      });

      // Assign numbers via batch
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const [cls, students] of Object.entries(studentsByClass)) {
        const startNum = studentStartMap[`${madrasaId}_${cls}`];
        if (!startNum) continue;

        for (let idx = 0; idx < students.length; idx++) {
          const student = students[idx];
          const hallTicketNum = startNum + idx;
          const studentRef = doc(db, "students", student.id);
          batch.update(studentRef, {
            hallTicketSequenceNumber: hallTicketNum,
            hallTicketClass: cls,
            hallTicketMadrasaSeq: seqNum,
            hallTicketUpdatedAt: serverTimestamp(),
          });
          batchCount++;

          // Commit in chunks of 400
          if (batchCount % 400 === 0) {
            await batch.commit();
            batch = writeBatch(db);
          }
        }
      }

      if (batchCount > 0 && batchCount % 400 !== 0) {
        await batch.commit();
      }

      console.log(`✅ Assigned hall ticket numbers to ${batchCount} students in ${madrasaId}`);
    } catch (err) {
      console.error("Error recomputing hall ticket numbers:", err);
      // Don't fail silently — this is non-critical, main assignment is saved
      toast.warning("Hall ticket numbers partially updated. Run recalculate if needed.");
    }
  };

  // Sorted assignments for display table (by sequence number)
  const sortedAssignments = useMemo(
    () =>
      [...assignments].sort(
        (a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0)
      ),
    [assignments]
  );

  // Sorted class strengths for modal display
  const sortedClassEntries = useMemo(() => {
    return Object.entries(classStrengths).sort(
      ([a], [b]) => getClassSortOrder(a) - getClassSortOrder(b)
    );
  }, [classStrengths]);

  const totalStudents = useMemo(
    () => Object.values(classStrengths).reduce((s, v) => s + v, 0),
    [classStrengths]
  );

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Hash className="h-7 w-7 text-purple-600" />
              Hall Ticket — Madrasa Sequence Assignment
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Assign a sequence number to each madrasa. Hall ticket numbers are
              auto-generated class-wise in sequence order.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              fetchMadrasas();
              fetchAssignments();
            }}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* LEFT: Madrasa Select Dropdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <School className="h-5 w-5 text-purple-600" />
                Select Madrasa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label className="text-sm font-medium">Search and Select Madrasa</Label>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={popoverOpen}
                    className="min-h-[44px] text-sm md:text-base justify-between w-full border-purple-200 hover:border-purple-300 hover:bg-purple-50 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-purple-600 focus-visible:border-purple-600"
                  >
                    <span>Select Madrasa...</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] sm:w-[400px] p-0" align="start">
                  <Command className="bg-white">
                    <CommandInput
                      className="bg-white"
                      placeholder="Search by name, ID, district..."
                    />
                    <CommandList className="bg-white max-h-[300px] overflow-y-auto">
                      <CommandEmpty>No Madrasa found.</CommandEmpty>
                      <CommandGroup>
                        {madrasas.map((madarsa) => {
                          const asgn = getAssignment(madarsa.id);
                          return (
                            <CommandItem
                              key={madarsa.id}
                              value={`${madarsa.name} ${madarsa.mid || madarsa.madarsaId || ''} ${madarsa.district || ''}`}
                              onSelect={() => {
                                openMadrasaModal(madarsa);
                                setPopoverOpen(false);
                              }}
                              className="bg-white cursor-pointer hover:bg-purple-50 flex items-center justify-between p-2"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-sm text-gray-900">{madarsa.name}</span>
                                <span className="text-xs text-gray-500">
                                  MID: {madarsa.mid || madarsa.madarsaId || madarsa.id} {madarsa.district ? ` · ${madarsa.district}` : ""}
                                </span>
                              </div>
                              {asgn && (
                                <Badge className="bg-green-100 text-green-700 text-xs shrink-0">
                                  #{asgn.sequenceNumber}
                                </Badge>
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          {/* RIGHT: Assigned Madrasas Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Assigned Sequence List
                <Badge variant="secondary">{assignments.length} assigned</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAssignments ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : sortedAssignments.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  No madrasas assigned yet. Select one from the list.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Madrasa</TableHead>
                        <TableHead>Classes</TableHead>
                        <TableHead className="text-right">Students</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAssignments.map((asgn) => {
                        const live = liveCounts[asgn.madarsaId];
                        const totalForMadrasa = live ? live.students : Object.values(asgn.classStrengths || {}).reduce((s, v) => s + v, 0);
                        const classCount = live ? live.classes : Object.keys(asgn.classStrengths || {}).length;
                        return (
                          <TableRow
                            key={asgn.id}
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => {
                              const m = madrasas.find((x) => x.id === asgn.madarsaId);
                              if (m) openMadrasaModal(m);
                            }}
                          >
                            <TableCell>
                              <Badge className="bg-purple-100 text-purple-700 font-bold">
                                {asgn.sequenceNumber}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm font-medium text-gray-800">
                                {asgn.madarsaName}
                              </p>
                              <p className="text-xs text-gray-400">
                                MID: {madrasas.find((x) => x.id === asgn.madarsaId)?.madarsaId || madrasas.find((x) => x.id === asgn.madarsaId)?.mid || asgn.madarsaId}
                              </p>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-gray-500">
                                {classCount} class{classCount !== 1 ? "es" : ""}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-semibold text-gray-700">
                                {totalForMadrasa}
                              </span>
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
      </div>

      {/* MODAL: Madrasa Detail + Sequence Assignment */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <School className="h-5 w-5 text-purple-600" />
              {selectedMadrasa?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedMadrasa && (
            <div className="space-y-4">
              {/* Madrasa Info */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Hash className="h-4 w-4" />
                  <span className="font-medium">MID:</span> {selectedMadrasa.madarsaId || selectedMadrasa.mid || selectedMadrasa.id}
                </div>
                {selectedMadrasa.adminName && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Info className="h-4 w-4" />
                    <span className="font-medium">Sadar:</span>{" "}
                    {selectedMadrasa.adminName}
                  </div>
                )}
                {selectedMadrasa.district && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span className="font-medium">District:</span>{" "}
                    {selectedMadrasa.district}
                  </div>
                )}
                {selectedMadrasa.address && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span className="font-medium">Address:</span>{" "}
                    {selectedMadrasa.address}
                  </div>
                )}
              </div>

              {/* Sequence Number Input */}
              <div>
                <Label htmlFor="seqNum" className="text-sm font-semibold">
                  Madrasa Sequence Number *
                </Label>
                <p className="text-xs text-gray-400 mb-1">
                  This determines the order of hall ticket number allocation.
                </p>
                <Input
                  id="seqNum"
                  type="number"
                  min="1"
                  value={sequenceNumber}
                  onChange={(e) => setSequenceNumber(e.target.value)}
                  placeholder="e.g. 1, 2, 3..."
                  className="mt-1"
                />
              </div>

              {/* Class Strengths */}
              <div>
                <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-purple-600" />
                  Class-wise Student Strength
                  {totalStudents > 0 && (
                    <Badge variant="secondary">{totalStudents} total</Badge>
                  )}
                </div>

                {loadingStrengths ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading student data...
                  </div>
                ) : sortedClassEntries.length === 0 ? (
                  <div className="text-sm text-gray-400 py-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    No active students found for this madrasa.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {sortedClassEntries.map(([cls, count]) => (
                      <div
                        key={cls}
                        className="flex items-center justify-between bg-purple-50 rounded px-2.5 py-1.5"
                      >
                        <span className="text-xs font-medium text-purple-700">
                          {cls === "1" ||
                          (parseInt(cls) >= 1 && parseInt(cls) <= 12)
                            ? `Class ${cls}`
                            : cls}
                        </span>
                        <span className="text-xs font-bold text-purple-900">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveAssignment}
              disabled={saving || loadingStrengths || !sequenceNumber}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save & Generate Numbers
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
