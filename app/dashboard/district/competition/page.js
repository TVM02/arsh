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
import { madrasaMatchesMekhala, getParentDistrictsForMekhalas } from "@/lib/madrasaHierarchy";
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

const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export default function MekhalaCompetitionPage() {
  const { user, userData } = useAuthStore();

  const adminDistricts = useMemo(() => userData?.districts || [], [userData]);

  // Detect admin level:
  // - True district admin: manages multiple mekhalas (districts.length > 1)
  // - Mekhala-level admin: manages one mekhala OR has no districts array
  const isMekhalaAdmin = adminDistricts.length <= 1;

  // Name used in mekhala-mode queries
  const mekhalaName = useMemo(
    () => userData?.mekhalaName || userData?.mekhala || userData?.name || adminDistricts[0] || "",
    [userData, adminDistricts]
  );

  // District-mode: mekhalas this admin manages
  const districtMekhalas = useMemo(
    () => (isMekhalaAdmin ? [mekhalaName].filter(Boolean) : adminDistricts),
    [isMekhalaAdmin, mekhalaName, adminDistricts]
  );

  // Correct district name for district-mode saves
  const districtName = useMemo(
    () => getParentDistrictsForMekhalas(districtMekhalas)[0] || userData?.districtName || "",
    [districtMekhalas, userData]
  );

  const [config, setConfig]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [markInputs, setMarkInputs] = useState({});
  const [savingId, setSavingId]     = useState(null);
  const [deleteMekhalaTarget, setDeleteMekhalaTarget] = useState(null);
  const [deleteDistrictTarget, setDeleteDistrictTarget] = useState(null);

  // ── MEKHALA MODE state ────────────────────────────────────────────────────
  const [registrations, setRegistrations] = useState([]);   // competition_registrations
  const [mekhalaMarksEntered, setMekhalaMarksEntered] = useState([]); // competition_mekhala_marks
  const [selectedMadrasa, setSelectedMadrasa] = useState("all");
  const [openMadrasa, setOpenMadrasa] = useState(false);

  // ── DISTRICT MODE state ───────────────────────────────────────────────────
  const [mekhalaMarksReceived, setMekhalaMarksReceived] = useState([]); // competition_mekhala_marks
  const [districtMarks, setDistrictMarks]               = useState([]);  // competition_district_marks
  const [selectedMekhala, setSelectedMekhala]           = useState("all");
  const [openMekhalaDist, setOpenMekhalaDist]           = useState(false);
  const [selectedMadrasaDist, setSelectedMadrasaDist]   = useState("all");
  const [openMadrasaDist, setOpenMadrasaDist]           = useState(false);
  const [allMadrasasMaster, setAllMadrasasMaster]       = useState([]);

  // ── Data load ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, madSnap] = await Promise.all([
        getCompetitionConfig(),
        getDocs(collection(db, "madarsas")),
      ]);
      setConfig(cfg);
      const allMadarsas = madSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllMadrasasMaster(allMadarsas);

      if (isMekhalaAdmin) {
        // ── MEKHALA MODE: fetch registrations ────────────────────────────
        if (!mekhalaName) return;

        const myMadarsas  = allMadarsas.filter((m) => madrasaMatchesMekhala(m, mekhalaName));

        // Build ID + name variant sets for robust querying
        const idVariants   = new Set();
        const nameVariants = new Set();
        myMadarsas.forEach((m) => {
          [m.madarsaId, m.madrasaId, m.midNumber].filter(v => v != null).forEach((v) => {
            idVariants.add(v);
            idVariants.add(String(v));
            const digits = String(v).replace(/\D/g, "");
            if (digits) { idVariants.add(digits); idVariants.add(`mid-${digits}`); }
          });
          if (m.id) idVariants.add(m.id);
          if (m.name) nameVariants.add(m.name);
          if (m.madarsaName) nameVariants.add(m.madarsaName);
        });

        const idList   = Array.from(idVariants).filter(Boolean);
        const nameList = Array.from(nameVariants).filter(Boolean);

        // Parallel: primary + secondary + existing marks
        const [primarySnap, markSnap] = await Promise.all([
          getDocs(query(collection(db, "competition_registrations"), where("mekhalaName", "==", mekhalaName))),
          getDocs(query(collection(db, "competition_mekhala_marks"), where("mekhalaName", "==", mekhalaName))),
        ]);

        const regsByMekhala = primarySnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Secondary: by ID variants
        const regsByIds = (await Promise.all(
          chunkArray(idList, 30).map((batch) =>
            getDocs(query(collection(db, "competition_registrations"), where("madarsaId", "in", batch)))
              .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
          )
        )).flat();

        // Tertiary: by madarsaName (handles ID format mismatches)
        const regsByName = nameList.length ? (await Promise.all(
          chunkArray(nameList, 30).map((batch) =>
            getDocs(query(collection(db, "competition_registrations"), where("madarsaName", "in", batch)))
              .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
          )
        )).flat() : [];

        const regMap = new Map();
        [...regsByMekhala, ...regsByIds, ...regsByName].forEach((r) => regMap.set(r.id, r));
        setRegistrations(Array.from(regMap.values()));
        setMekhalaMarksEntered(markSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      } else {
        // ── DISTRICT MODE: fetch mekhala marks ───────────────────────────
        if (districtMekhalas.length === 0) return;

        const [mkResults, dmResults] = await Promise.all([
          Promise.all(
            districtMekhalas.map((mName) =>
              getDocs(query(collection(db, "competition_mekhala_marks"), where("mekhalaName", "==", mName)))
                .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
            )
          ),
          Promise.all(
            districtMekhalas.map((mName) =>
              getDocs(query(collection(db, "competition_district_marks"), where("mekhalaName", "==", mName)))
                .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
            )
          ),
        ]);

        setMekhalaMarksReceived(mkResults.flat());
        setDistrictMarks(dmResults.flat());
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load competition data");
    } finally {
      setLoading(false);
    }
  }, [isMekhalaAdmin, mekhalaName, districtMekhalas]);

  useEffect(() => { load(); }, [load]);

  // Pre-fill inputs from existing marks
  useEffect(() => {
    const sourceMarks = isMekhalaAdmin ? mekhalaMarksEntered : districtMarks;
    if (!sourceMarks.length) return;
    setMarkInputs((prev) => {
      const updated = { ...prev };
      sourceMarks.forEach((m) => {
        const key = isMekhalaAdmin ? m.registrationId : m.mekhalaMarkId;
        if (key && !updated[key]) {
          updated[key] = { mark1: m.mark1 ?? "", mark2: m.mark2 ?? "", mark3: m.mark3 ?? "" };
        }
      });
      return updated;
    });
  }, [mekhalaMarksEntered, districtMarks, isMekhalaAdmin]);

  // ── Mekhala-mode filter ───────────────────────────────────────────────────
  const uniqueMadarsas = useMemo(() =>
    allMadrasasMaster
      .filter((m) => madrasaMatchesMekhala(m, mekhalaName))
      .map((m) => ({ id: m.id, name: m.madarsaName || m.name, midCode: m.midNumber || m.midCode }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [allMadrasasMaster, mekhalaName]
  );

  const filteredRegs = useMemo(() =>
    selectedMadrasa === "all" ? registrations : registrations.filter((r) => r.madarsaId === selectedMadrasa),
    [registrations, selectedMadrasa]
  );

  // ── District-mode cascade filters ────────────────────────────────────────
  const uniqueDistMekhalas = useMemo(() =>
    [...districtMekhalas].sort(),
    [districtMekhalas]
  );

  const mekhalaFilteredDist = useMemo(() =>
    selectedMekhala === "all" ? mekhalaMarksReceived : mekhalaMarksReceived.filter((m) => m.mekhalaName === selectedMekhala),
    [mekhalaMarksReceived, selectedMekhala]
  );

  const uniqueDistMadarsas = useMemo(() => {
    let filtered = allMadrasasMaster.filter(m => 
      districtMekhalas.some(dmName => madrasaMatchesMekhala(m, dmName))
    );
    if (selectedMekhala !== "all") {
      filtered = filtered.filter(m => madrasaMatchesMekhala(m, selectedMekhala));
    }
    return filtered
      .map(m => ({ id: m.id, name: m.madarsaName || m.name, midCode: m.midNumber || m.midCode }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allMadrasasMaster, districtMekhalas, selectedMekhala]);

  const filteredDistMarks = useMemo(() =>
    selectedMadrasaDist === "all" ? mekhalaFilteredDist : mekhalaFilteredDist.filter((m) => m.madarsaId === selectedMadrasaDist),
    [mekhalaFilteredDist, selectedMadrasaDist]
  );

  const handleMekhalaFilterChange = (val) => { setSelectedMekhala(val); setSelectedMadrasaDist("all"); };

  // ── Mark helpers ──────────────────────────────────────────────────────────
  const getInput = (key) => markInputs[key] || { mark1: "", mark2: "", mark3: "" };
  const setInput = (key, field, val) =>
    setMarkInputs((prev) => ({ ...prev, [key]: { ...getInput(key), [field]: val } }));

  // MEKHALA MODE: save mekhala marks
  const handleSaveMekhalaMark = async (reg) => {
    const key = reg.id;
    const inp = getInput(key);
    const m1 = Number(inp.mark1), m2 = Number(inp.mark2), m3 = Number(inp.mark3);
    if ([m1, m2, m3].some((m) => isNaN(m) || m < 0 || m > 50)) { toast.error("Each mark must be 0–50"); return; }
    const total = calcTotal(m1, m2, m3);
    const grade = calcGrade(total);
    const payload = {
      registrationId: reg.id, eventId: reg.eventId, eventName: reg.eventName,
      category: reg.category, type: reg.type,
      madarsaId: reg.madarsaId, madarsaName: reg.madarsaName,
      mekhalaId: userData?.uid || "", mekhalaName,
      districtName: reg.districtName || districtName,
      studentIds: reg.studentIds, students: reg.students,
      mark1: m1, mark2: m2, mark3: m3, total, grade,
    };
    setSavingId(key);
    try {
      const existing = mekhalaMarksEntered.find((m) => m.registrationId === key);
      if (existing) { await updateMarks("mekhala", existing.id, payload); toast.success("Marks updated"); }
      else          { await saveMarks("mekhala", payload, user?.uid);      toast.success("Marks saved"); }
      await load();
    } catch { toast.error("Failed to save marks"); }
    finally { setSavingId(null); }
  };

  const handleDeleteMekhalaMark = async (reg) => {
    try { 
      const existing = mekhalaMarksEntered.find((m) => m.registrationId === reg.id);
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
    }
    catch (err) { 
      toast.error(`Failed to delete: ${err.message}`); 
    }
  };

  // DISTRICT MODE: save district marks
  const handleSaveDistrictMark = async (mekhalaMark) => {
    const key = mekhalaMark.id;
    const inp = getInput(key);
    const m1 = Number(inp.mark1), m2 = Number(inp.mark2), m3 = Number(inp.mark3);
    if ([m1, m2, m3].some((m) => isNaN(m) || m < 0 || m > 50)) { toast.error("Each mark must be 0–50"); return; }
    const total = calcTotal(m1, m2, m3);
    const grade = calcGrade(total);
    const payload = {
      mekhalaMarkId: mekhalaMark.id, registrationId: mekhalaMark.registrationId,
      eventId: mekhalaMark.eventId, eventName: mekhalaMark.eventName,
      category: mekhalaMark.category, type: mekhalaMark.type,
      madarsaId: mekhalaMark.madarsaId, madarsaName: mekhalaMark.madarsaName,
      mekhalaId: mekhalaMark.mekhalaId, mekhalaName: mekhalaMark.mekhalaName,
      districtName, studentIds: mekhalaMark.studentIds, students: mekhalaMark.students,
      mekhalaTotal: mekhalaMark.total, mekhalaGrade: mekhalaMark.grade,
      mark1: m1, mark2: m2, mark3: m3, total, grade,
    };
    setSavingId(key);
    try {
      const existing = districtMarks.find((m) => m.mekhalaMarkId === key);
      if (existing) { await updateMarks("district", existing.id, payload); toast.success("District marks updated"); }
      else          { await saveMarks("district", payload, user?.uid);      toast.success("District marks saved"); }
      await load();
    } catch { toast.error("Failed to save"); }
    finally { setSavingId(null); }
  };

  const handleDeleteDistrictMark = async (mekhalaMark) => {
    try { 
      const existing = districtMarks.find((m) => m.mekhalaMarkId === mekhalaMark.id);
      if (existing) {
        await deleteMarks("district", existing.id); 
      }
      await deleteMarks("mekhala", mekhalaMark.id);
      
      setMarkInputs((prev) => {
        const next = { ...prev };
        delete next[mekhalaMark.id];
        return next;
      });
      toast.success("Entry completely deleted"); 
      await load(); 
    }
    catch (err) { 
      toast.error(`Failed to delete: ${err.message}`); 
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      </Layout>
    );
  }

  const visibilityKey = isMekhalaAdmin ? "mekhala" : "district";
  if (!config?.portalVisibility?.[visibilityKey]) {
    return (
      <Layout>
        <div className="p-6 text-center text-gray-500">
          Competition module is not enabled for this portal.
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
            <p className="text-sm text-gray-500">
              {isMekhalaAdmin
                ? <>Mekhala: <strong>{mekhalaName || "—"}</strong> — Mark Entry</>
                : "District Mark Entry"}
            </p>
          </div>
        </div>

        {/* ════════════════ MEKHALA MODE ════════════════ */}
        {isMekhalaAdmin && (
          <>
            {/* Madrasa filter */}
            <div className="flex items-center gap-3 flex-wrap bg-gray-50 border rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-gray-600">Filter by Madrasa:</span>
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
                    <CommandInput className="bg-white" placeholder="Search Madrasas..." />
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
              {selectedMadrasa !== "all" && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedMadrasa("all")} className="text-gray-500">Clear</Button>
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
                  <CardTitle className="text-sm">Registrations — Enter Mekhala Marks ({filteredRegs.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto scrollbar-hide">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Madrasa</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Students</TableHead>
                        <TableHead>M1 /50</TableHead>
                        <TableHead>M2 /50</TableHead>
                        <TableHead>M3 /50</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRegs.map((reg) => {
                        const existing   = mekhalaMarksEntered.find((m) => m.registrationId === reg.id);
                        const inp        = getInput(reg.id);
                        const m1 = Number(inp.mark1) || 0, m2 = Number(inp.mark2) || 0, m3 = Number(inp.mark3) || 0;
                        const hasAll     = inp.mark1 !== "" && inp.mark2 !== "" && inp.mark3 !== "";
                        const prevTotal  = hasAll ? calcTotal(m1, m2, m3) : "—";
                        const prevGrade  = typeof prevTotal === "number" ? calcGrade(prevTotal) : "—";
                        return (
                          <TableRow key={reg.id} className={existing ? "bg-emerald-50/40" : ""}>
                            <TableCell className="text-sm font-medium whitespace-nowrap">{reg.madarsaName}</TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{reg.eventName}</TableCell>
                            <TableCell><Badge variant="outline">{CATEGORIES[reg.category]?.label}</Badge></TableCell>
                            <TableCell className="text-sm text-gray-600">
                              <div className="flex flex-col gap-1">
                                {reg.students?.map((s, idx) => (
                                  <span key={idx} className="whitespace-nowrap">{s.name}</span>
                                ))}
                              </div>
                            </TableCell>
                            {["mark1","mark2","mark3"].map((f) => (
                              <TableCell key={f}>
                                <Input type="number" min="0" max="50" className="w-16 h-8 text-center border-gray-300 shadow-sm bg-white"
                                  value={inp[f]} onChange={(e) => setInput(reg.id, f, e.target.value)} />
                              </TableCell>
                            ))}
                            <TableCell className="font-semibold">{prevTotal}</TableCell>
                            <TableCell>
                              {typeof prevGrade === "string" && prevGrade !== "—"
                                ? <Badge className={gradeColor(prevGrade)}>{prevGrade}</Badge> : "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="grid grid-cols-[32px_auto_32px] gap-2 items-center w-full max-w-[140px] mx-auto">
                                <div />
                                <Button size="sm" className="bg-teal-700 hover:bg-teal-800 h-8 px-4 font-medium transition-all"
                                  onClick={() => handleSaveMekhalaMark(reg)} disabled={savingId === reg.id}>
                                  {savingId === reg.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    : existing ? <Check className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                                  {existing ? "Update" : "Save"}
                                </Button>
                                <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 rounded-full p-0 flex items-center justify-center transition-all"
                                  onClick={() => setDeleteMekhalaTarget(reg)} title="Delete entry completely">
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

          </>
        )}

        {/* ════════════════ DISTRICT MODE ════════════════ */}
        {!isMekhalaAdmin && (
          <>
            {/* Cascade filters: Mekhala → Madrasa */}
            <div className="flex items-center gap-3 flex-wrap bg-gray-50 border rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-gray-600">Filter:</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Mekhala</span>
                <Popover open={openMekhalaDist} onOpenChange={setOpenMekhalaDist}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openMekhalaDist}
                      className="w-52 justify-between bg-white font-normal text-gray-700"
                    >
                      {selectedMekhala === "all"
                        ? `All Mekhalas (${uniqueDistMekhalas.length})`
                        : selectedMekhala}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-0">
                    <Command>
                      <CommandInput placeholder="Search mekhala..." />
                      <CommandList className="scrollbar-hide">
                        <CommandEmpty>No mekhalas found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              handleMekhalaFilterChange("all");
                              setOpenMekhalaDist(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedMekhala === "all" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            All Mekhalas ({uniqueDistMekhalas.length})
                          </CommandItem>
                          {uniqueDistMekhalas.map((m) => (
                            <CommandItem
                              key={m}
                              value={m}
                              onSelect={() => {
                                handleMekhalaFilterChange(m);
                                setOpenMekhalaDist(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedMekhala === m ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {m}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Madrasa</span>
                <Popover open={openMadrasaDist} onOpenChange={setOpenMadrasaDist}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openMadrasaDist}
                      className="w-[300px] justify-between bg-white text-sm md:text-base border-teal-200 hover:border-teal-300 hover:bg-teal-50 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-teal-600 focus-visible:border-teal-600 font-normal text-slate-700"
                    >
                      {selectedMadrasaDist === "all"
                        ? `All Madarsas (${uniqueDistMadarsas.length})`
                        : (() => {
                            const m = uniqueDistMadarsas.find((m) => m.id === selectedMadrasaDist);
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
                              setSelectedMadrasaDist("all");
                              setOpenMadrasaDist(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedMadrasaDist === "all" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            All Madarsas ({uniqueDistMadarsas.length})
                          </CommandItem>
                          {uniqueDistMadarsas.map((m) => (
                            <CommandItem
                              key={m.id}
                              value={`${m.id} ${m.name} ${m.midCode || ""}`}
                              className="bg-white flex flex-col items-start gap-1 py-2"
                              onSelect={() => {
                                setSelectedMadrasaDist(m.id);
                                setOpenMadrasaDist(false);
                              }}
                            >
                              <div className="flex items-center w-full">
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    selectedMadrasaDist === m.id ? "opacity-100" : "opacity-0"
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
              </div>
              {(selectedMekhala !== "all" || selectedMadrasaDist !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setSelectedMekhala("all"); setSelectedMadrasaDist("all"); }} className="text-gray-500">Clear</Button>
              )}
            </div>

            {filteredDistMarks.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-gray-400">
                  {mekhalaMarksReceived.length === 0 ? "No mekhala marks received yet." : "No results match the selected filters."}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Mekhala Results — Enter District Marks ({filteredDistMarks.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto scrollbar-hide">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mekhala</TableHead><TableHead>Madrasa</TableHead>
                        <TableHead>Event</TableHead><TableHead>Category</TableHead><TableHead>Students</TableHead>
                        <TableHead>Mek.</TableHead><TableHead>M1</TableHead><TableHead>M2</TableHead>
                        <TableHead>M3</TableHead><TableHead>Total</TableHead><TableHead>Grade</TableHead>
                        <TableHead className="text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDistMarks.map((mk) => {
                        const key      = mk.id;
                        const inp      = getInput(key);
                        const m1 = Number(inp.mark1)||0, m2 = Number(inp.mark2)||0, m3 = Number(inp.mark3)||0;
                        const hasAll   = inp.mark1!==""&&inp.mark2!==""&&inp.mark3!=="";
                        const prevTotal = hasAll ? calcTotal(m1,m2,m3) : "—";
                        const prevGrade = typeof prevTotal==="number" ? calcGrade(prevTotal) : "—";
                        const existing = districtMarks.find((m) => m.mekhalaMarkId === key);
                        return (
                          <TableRow key={key} className={existing ? "bg-emerald-50/40" : ""}>
                            <TableCell className="text-sm text-gray-600 whitespace-nowrap">{mk.mekhalaName}</TableCell>
                            <TableCell className="text-sm font-medium whitespace-nowrap">{mk.madarsaName}</TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{mk.eventName}</TableCell>
                            <TableCell><Badge variant="outline">{CATEGORIES[mk.category]?.label}</Badge></TableCell>
                            <TableCell className="text-sm text-gray-600">
                              <div className="flex flex-col gap-1">
                                {mk.students?.map((s, idx) => (
                                  <span key={idx} className="whitespace-nowrap">{s.name}</span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold">{mk.total}</span>{" "}
                              <Badge className={gradeColor(mk.grade)} variant="outline">{mk.grade}</Badge>
                            </TableCell>
                            {["mark1","mark2","mark3"].map((f) => (
                              <TableCell key={f}>
                                <Input type="number" min="0" max="50" className="w-16 h-8 text-center border-gray-300 shadow-sm bg-white"
                                  value={inp[f]} onChange={(e) => setInput(key, f, e.target.value)} />
                              </TableCell>
                            ))}
                            <TableCell className="font-semibold">{prevTotal}</TableCell>
                            <TableCell>
                              {typeof prevGrade==="string"&&prevGrade!=="—"
                                ? <Badge className={gradeColor(prevGrade)}>{prevGrade}</Badge> : "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="grid grid-cols-[32px_auto_32px] gap-2 items-center w-full max-w-[140px] mx-auto">
                                <div />
                                <Button size="sm" className="bg-teal-700 hover:bg-teal-800 h-8 px-4 font-medium transition-all"
                                  onClick={() => handleSaveDistrictMark(mk)} disabled={savingId === key}>
                                  {savingId === key ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    : existing ? <Check className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                                  {existing ? "Update" : "Save"}
                                </Button>
                                <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 rounded-full p-0 flex items-center justify-center transition-all"
                                  onClick={() => setDeleteDistrictTarget(mk)} title="Delete entry completely">
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

          </>
        )}
        {/* Single Top-Level Delete Dialog for Mekhala Mode */}
        <AlertDialog open={!!deleteMekhalaTarget} onOpenChange={(open) => !open && setDeleteMekhalaTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Mekhala Marks?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the marks for this registration? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => {
                if (deleteMekhalaTarget) {
                  handleDeleteMekhalaMark(deleteMekhalaTarget);
                  setDeleteMekhalaTarget(null);
                }
              }}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Single Top-Level Delete Dialog for District Mode */}
        <AlertDialog open={!!deleteDistrictTarget} onOpenChange={(open) => !open && setDeleteDistrictTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete District Marks?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the district marks for this entry? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => {
                if (deleteDistrictTarget) {
                  handleDeleteDistrictMark(deleteDistrictTarget);
                  setDeleteDistrictTarget(null);
                }
              }}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </Layout>
  );
}
