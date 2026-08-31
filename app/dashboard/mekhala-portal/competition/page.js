"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trophy, Save, Loader2, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { madrasaMatchesMekhala } from "@/lib/madrasaHierarchy";
import {
  getCompetitionConfig,
  saveMarks,
  updateMarks,
  deleteMarks,
  deleteRegistration,
} from "@/lib/competitionService";
import { calcGrade, calcTotal, CATEGORIES } from "@/lib/competitionUtils";

function gradeColor(grade) {
  switch (grade) {
    case "A+": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "A":  return "bg-green-100 text-green-800 border-green-200";
    case "B+": return "bg-blue-100 text-blue-800 border-blue-200";
    case "B":  return "bg-sky-100 text-sky-800 border-sky-200";
    case "C":  return "bg-yellow-100 text-yellow-800 border-yellow-200";
    default:   return "bg-red-100 text-red-800 border-red-200";
  }
}

export default function MekhalaCompetitionPage() {
  const { user, userData } = useAuthStore();

  const [config, setConfig]               = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [marks, setMarks]                 = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedMadrasa, setSelectedMadrasa] = useState("all");
  const [openMadrasa, setOpenMadrasa] = useState(false);
  const [markInputs, setMarkInputs]       = useState({});
  const [savingId, setSavingId]           = useState(null);
  const [deleteMarkTarget, setDeleteMarkTarget] = useState(null);
  const [allMyMadrasas, setAllMyMadrasas] = useState([]);

  const mekhalaName = userData?.mekhalaName || userData?.mekhala || userData?.name || "";

  const load = useCallback(async () => {
    if (!mekhalaName) return;
    setLoading(true);
    try {
      // Fetch madrasa list + config in parallel
      const [cfg, madSnap, regByMekhalaSnap] = await Promise.all([
        getCompetitionConfig(),
        getDocs(collection(db, "madarsas")),
        getDocs(query(collection(db, "competition_registrations"), where("mekhalaName", "==", mekhalaName))),
      ]);
      setConfig(cfg);

      // Madarsas belonging to this mekhala
      const allMadarsas = madSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const myMadarsas  = allMadarsas.filter((m) => madrasaMatchesMekhala(m, mekhalaName));
      setAllMyMadrasas(myMadarsas);

      // Build all possible ID variants and names for secondary/tertiary queries
      const idVariants  = new Set();
      const nameVariants = new Set();
      myMadarsas.forEach((m) => {
        // Try madarsaId as-is, stringified, numeric-only, and mid-XXXX form
        [m.madarsaId, m.madrasaId, m.midNumber].filter(v => v != null).forEach((v) => {
          idVariants.add(v);
          idVariants.add(String(v));
          const digits = String(v).replace(/\D/g, "");
          if (digits) { idVariants.add(digits); idVariants.add(`mid-${digits}`); }
        });
        // Also use Firestore doc ID
        if (m.id) idVariants.add(m.id);
        // Name-based
        if (m.name) nameVariants.add(m.name);
        if (m.madarsaName) nameVariants.add(m.madarsaName);
      });

      const idList   = Array.from(idVariants).filter(Boolean);
      const nameList = Array.from(nameVariants).filter(Boolean);

      const chunkArray = (arr, size) => {
        const out = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };

      // Primary fetch: registrations stored with this mekhalaName
      const regsByMekhala = regByMekhalaSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Secondary fetch: by madarsaId variants (Firestore `in` handles mixed types correctly)
      const regsByIds = (
        await Promise.all(
          chunkArray(idList, 30).map((batch) =>
            getDocs(query(collection(db, "competition_registrations"), where("madarsaId", "in", batch)))
              .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
          )
        )
      ).flat();

      // Tertiary fetch: by madarsaName (catches complete ID format mismatches)
      const regsByName = nameList.length
        ? (
            await Promise.all(
              chunkArray(nameList, 30).map((batch) =>
                getDocs(query(collection(db, "competition_registrations"), where("madarsaName", "in", batch)))
                  .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
              )
            )
          ).flat()
        : [];

      // Merge and deduplicate (all three sources)
      const regMap = new Map();
      [...regsByMekhala, ...regsByIds, ...regsByName].forEach((r) => regMap.set(r.id, r));
      setRegistrations(Array.from(regMap.values()));

      // Existing mekhala marks
      const markSnap = await getDocs(
        query(collection(db, "competition_mekhala_marks"), where("mekhalaName", "==", mekhalaName))
      );
      setMarks(markSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [mekhalaName]);

  useEffect(() => { load(); }, [load]);

  // Pre-fill inputs from existing marks
  useEffect(() => {
    if (!marks.length) return;
    setMarkInputs((prev) => {
      const updated = { ...prev };
      marks.forEach((m) => {
        if (!updated[m.registrationId]) {
          updated[m.registrationId] = { mark1: m.mark1 ?? "", mark2: m.mark2 ?? "", mark3: m.mark3 ?? "" };
        }
      });
      return updated;
    });
  }, [marks]);

  // Madrasa dropdown: ALL madarsas in the mekhala, sorted by name
  const uniqueMadarsas = useMemo(() =>
    allMyMadrasas
      .map((m) => ({ id: m.id, name: m.madarsaName || m.name, midCode: m.midNumber || m.midCode }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [allMyMadrasas]
  );

  const filteredRegs = selectedMadrasa === "all"
    ? registrations
    : registrations.filter((r) => r.madarsaId === selectedMadrasa);

  const existingMark = (regId) => marks.find((m) => m.registrationId === regId);
  const getInput     = (regId) => markInputs[regId] || { mark1: "", mark2: "", mark3: "" };
  const setInput     = (regId, field, val) =>
    setMarkInputs((prev) => ({ ...prev, [regId]: { ...getInput(regId), [field]: val } }));

  const handleSaveMark = async (reg) => {
    const inp = getInput(reg.id);
    const m1 = Number(inp.mark1);
    const m2 = Number(inp.mark2);
    const m3 = Number(inp.mark3);
    if ([m1, m2, m3].some((m) => isNaN(m) || m < 0 || m > 50)) {
      toast.error("Each mark must be 0–50");
      return;
    }
    const total = calcTotal(m1, m2, m3);
    const grade = calcGrade(total);
    const payload = {
      registrationId: reg.id,
      eventId: reg.eventId,
      eventName: reg.eventName,
      category: reg.category,
      type: reg.type,
      madarsaId: reg.madarsaId,
      madarsaName: reg.madarsaName,
      mekhalaId: userData?.uid || "",
      mekhalaName,
      districtName: reg.districtName || "",
      studentIds: reg.studentIds,
      students: reg.students,
      mark1: m1, mark2: m2, mark3: m3,
      total, grade,
    };
    setSavingId(reg.id);
    try {
      const existing = existingMark(reg.id);
      if (existing) {
        await updateMarks("mekhala", existing.id, payload);
        toast.success("Marks updated");
      } else {
        await saveMarks("mekhala", payload, user?.uid);
        toast.success("Marks saved");
      }
      await load();
    } catch {
      toast.error("Failed to save marks");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteMark = async (reg) => {
    try {
      const existing = existingMark(reg.id);
      if (existing) {
        await deleteMarks("mekhala", existing.id);
      }
      await deleteRegistration(reg.id);

      setMarkInputs((prev) => {
        const next = { ...prev };
        delete next[reg.id];
        return next;
      });
      toast.success("Entry completely deleted");
      await load();
    } catch (error) {
      toast.error(`Failed to delete: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      </Layout>
    );
  }

  if (!config?.portalVisibility?.mekhala) {
    return (
      <Layout>
        <div className="p-6 text-center text-gray-500">
          Competition module is not enabled for Mekhala portal.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <Trophy className="h-6 w-6 text-teal-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">
              Competition <span className="text-teal-700 font-arabic">التنافس</span>
            </h1>
            <p className="text-sm text-gray-500">Mekhala: <strong>{mekhalaName}</strong> — Mark Entry</p>
          </div>
        </div>

        {/* Madrasa filter */}
        <div className="flex items-center gap-3 flex-wrap bg-gray-50 border rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Filter by Madrasa:</span>
              <Popover open={openMadrasa} onOpenChange={setOpenMadrasa}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openMadrasa}
                    className="w-[300px] justify-between bg-white text-sm md:text-base border-teal-200 hover:border-teal-300 hover:bg-teal-50 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-teal-600 focus-visible:border-teal-600 font-normal text-slate-700"
                  >
                    {selectedMadrasa === "all"
                      ? `All Madarsas (${uniqueMadarsas.length})`
                      : (() => {
                          const m = uniqueMadarsas.find((m) => m.id === selectedMadrasa);
                          return m ? `${m.name} ${m.midCode ? `(${m.midCode})` : ""}` : "Select Madrasa...";
                        })()
                    }
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput className="bg-white" placeholder="Search madrasa..." />
                    <CommandList className="bg-white scrollbar-hide">
                      <CommandEmpty>No madrasas found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          className="bg-white"
                          onSelect={() => {
                            setSelectedMadrasa("all");
                            setOpenMadrasa(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedMadrasa === "all" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          All Madarsas ({uniqueMadarsas.length})
                        </CommandItem>
                        {uniqueMadarsas.map((m) => (
                          <CommandItem
                            key={m.id}
                            value={`${m.id} ${m.name} ${m.midCode || ""}`}
                            className="bg-white flex flex-col items-start gap-1 py-2"
                            onSelect={() => {
                              setSelectedMadrasa(m.id);
                              setOpenMadrasa(false);
                            }}
                          >
                            <div className="flex items-center w-full">
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 shrink-0",
                                  selectedMadrasa === m.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="font-medium text-sm text-gray-800 break-words whitespace-normal">{m.name}</span>
                            </div>
                            {m.midCode && (
                              <div className="ml-6 px-2 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-200 text-xs rounded-md font-semibold shrink-0">
                                {m.midCode}
                              </div>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>{selectedMadrasa !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedMadrasa("all")} className="text-gray-500">
              Clear
            </Button>
          )}
        </div>

        {/* Registrations + mark entry */}
        {filteredRegs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-400">
              {registrations.length === 0
                ? "No registrations from this mekhala yet."
                : "No registrations match the selected filter."}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Registrations — Enter Marks ({filteredRegs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto scrollbar-hide">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Madrasa</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Mark 1<span className="text-gray-400 font-normal">/50</span></TableHead>
                    <TableHead>Mark 2<span className="text-gray-400 font-normal">/50</span></TableHead>
                    <TableHead>Mark 3<span className="text-gray-400 font-normal">/50</span></TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegs.map((reg) => {
                    const existing    = existingMark(reg.id);
                    const inp         = getInput(reg.id);
                    const m1          = Number(inp.mark1) || 0;
                    const m2          = Number(inp.mark2) || 0;
                    const m3          = Number(inp.mark3) || 0;
                    const hasAll      = inp.mark1 !== "" && inp.mark2 !== "" && inp.mark3 !== "";
                    const previewTotal = hasAll ? calcTotal(m1, m2, m3) : "—";
                    const previewGrade = typeof previewTotal === "number" ? calcGrade(previewTotal) : "—";

                    return (
                      <TableRow key={reg.id} className={existing ? "bg-emerald-50/40" : ""}>
                        <TableCell className="text-sm text-gray-600 font-medium whitespace-nowrap">{reg.madarsaName}</TableCell>
                        <TableCell className="font-medium">{reg.eventName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{CATEGORIES[reg.category]?.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          <div className="flex flex-col gap-1">
                            {reg.students?.map((s, idx) => (
                              <span key={idx} className="whitespace-nowrap">{s.name}</span>
                            ))}
                          </div>
                        </TableCell>
                        {["mark1", "mark2", "mark3"].map((field) => (
                          <TableCell key={field}>
                            <Input
                              type="number" min="0" max="50"
                              className="w-16 h-8 text-center border-gray-300 shadow-sm bg-white"
                              value={inp[field]}
                              onChange={(e) => setInput(reg.id, field, e.target.value)}
                            />
                          </TableCell>
                        ))}
                        <TableCell className="font-semibold">{previewTotal}</TableCell>
                        <TableCell>
                          {typeof previewGrade === "string" && previewGrade !== "—"
                            ? <Badge className={gradeColor(previewGrade)}>{previewGrade}</Badge>
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="grid grid-cols-[32px_auto_32px] gap-2 items-center w-full max-w-[140px] mx-auto">
                            <div /> {/* Spacer for centering */}
                            <Button
                              size="sm"
                              className="bg-teal-700 hover:bg-teal-800 h-8 px-4 font-medium transition-all"
                              onClick={() => handleSaveMark(reg)}
                              disabled={savingId === reg.id}
                            >
                              {savingId === reg.id
                                ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                : existing ? <Check className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                              {existing ? "Update" : "Save"}
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 rounded-full p-0 flex items-center justify-center transition-all"
                              title="Delete entry completely"
                              onClick={() => setDeleteMarkTarget(reg)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        {/* Single Top-Level Delete Dialog */}
        <AlertDialog open={!!deleteMarkTarget} onOpenChange={(open) => !open && setDeleteMarkTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Registration Marks?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the marks for this registration? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  if (deleteMarkTarget) {
                    handleDeleteMark(deleteMarkTarget);
                    setDeleteMarkTarget(null);
                  }
                }}
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
