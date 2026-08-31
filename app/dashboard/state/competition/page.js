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
import {
  getCompetitionConfig,
  saveMarks,
  updateMarks,
  deleteMarks,
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

export default function StateCompetitionPage() {
  const { user, userData } = useAuthStore();

  const [config, setConfig]               = useState(null);
  const [districtMarks, setDistrictMarks] = useState([]);
  const [mekhalaMarks, setMekhalaMarks]   = useState([]);
  const [stateMarks, setStateMarks]       = useState([]);
  const [loading, setLoading]             = useState(true);

  // Cascade filter states: District → Mekhala → Madrasa
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [openDistrict, setOpenDistrict] = useState(false);
  const [selectedMekhala, setSelectedMekhala]   = useState("all");
  const [openMekhala, setOpenMekhala] = useState(false);
  const [selectedMadrasa, setSelectedMadrasa]   = useState("all");
  const [openMadrasa, setOpenMadrasa] = useState(false);

  const [markInputs, setMarkInputs] = useState({});
  const [savingId, setSavingId]     = useState(null);

  // For convener_admin, userData.districts = array of district names
  // Empty districts means global access (e.g. central admin logging in via state portal)
  const convenerDistricts = useMemo(() => userData?.districts || [], [userData]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const cfg = await getCompetitionConfig();
      setConfig(cfg);

      if (convenerDistricts.length === 0) {
        // No district restriction — fetch all marks (global access)
        const [dmSnap, mmSnap, smSnap] = await Promise.all([
          getDocs(collection(db, "competition_district_marks")),
          getDocs(collection(db, "competition_mekhala_marks")),
          getDocs(collection(db, "competition_state_marks")),
        ]);
        setDistrictMarks(dmSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setMekhalaMarks(mmSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStateMarks(smSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        return;
      }

      // Fetch district marks for each district under this convener
      const dmResults = await Promise.all(
        convenerDistricts.map((dName) =>
          getDocs(query(collection(db, "competition_district_marks"), where("districtName", "==", dName)))
            .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
        )
      );
      setDistrictMarks(dmResults.flat());

      // Fetch mekhala marks for the same districts
      const mmResults = await Promise.all(
        convenerDistricts.map((dName) =>
          getDocs(query(collection(db, "competition_mekhala_marks"), where("districtName", "==", dName)))
            .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
        )
      );
      setMekhalaMarks(mmResults.flat());

      // Fetch existing state marks
      const smResults = await Promise.all(
        convenerDistricts.map((dName) =>
          getDocs(query(collection(db, "competition_state_marks"), where("districtName", "==", dName)))
            .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
        )
      );
      setStateMarks(smResults.flat());
    } catch (e) {
      console.error(e);
      toast.error("Failed to load state competition data");
    } finally {
      setLoading(false);
    }
  }, [convenerDistricts]);

  useEffect(() => { load(); }, [load]);

  // Pre-fill mark inputs from existing state marks
  useEffect(() => {
    if (!stateMarks.length) return;
    setMarkInputs((prev) => {
      const updated = { ...prev };
      stateMarks.forEach((m) => {
        const key = m.districtMarkId;
        if (key && !updated[key]) {
          updated[key] = { mark1: m.mark1 ?? "", mark2: m.mark2 ?? "", mark3: m.mark3 ?? "" };
        }
      });
      return updated;
    });
  }, [stateMarks]);

  // ── Cascade filter derivations ────────────────────────────────────────────

  // Level 1: unique districts from all district marks
  const uniqueDistricts = useMemo(() =>
    [...new Set(districtMarks.map((m) => m.districtName).filter(Boolean))].sort(),
    [districtMarks]
  );

  // Level 2: apply district filter → unique mekhalas
  const districtFiltered = useMemo(() =>
    selectedDistrict === "all"
      ? districtMarks
      : districtMarks.filter((m) => m.districtName === selectedDistrict),
    [districtMarks, selectedDistrict]
  );

  const uniqueMekhalas = useMemo(() =>
    [...new Set(districtFiltered.map((m) => m.mekhalaName).filter(Boolean))].sort(),
    [districtFiltered]
  );

  // Level 3: apply mekhala filter → unique madarsas
  const mekhalaFiltered = useMemo(() =>
    selectedMekhala === "all"
      ? districtFiltered
      : districtFiltered.filter((m) => m.mekhalaName === selectedMekhala),
    [districtFiltered, selectedMekhala]
  );

  const uniqueMadarsas = useMemo(() =>
    Array.from(
      new Map(mekhalaFiltered.map((m) => [m.madarsaId, { id: m.madarsaId, name: m.madarsaName }])).values()
    ).filter((m) => m.id).sort((a, b) => a.name.localeCompare(b.name)),
    [mekhalaFiltered]
  );

  // Level 4: apply madrasa filter → final list
  const filteredMarks = useMemo(() =>
    selectedMadrasa === "all"
      ? mekhalaFiltered
      : mekhalaFiltered.filter((m) => m.madarsaId === selectedMadrasa),
    [mekhalaFiltered, selectedMadrasa]
  );

  const handleDistrictChange = (val) => {
    setSelectedDistrict(val);
    setSelectedMekhala("all");
    setSelectedMadrasa("all");
  };
  const handleMekhalaChange = (val) => {
    setSelectedMekhala(val);
    setSelectedMadrasa("all");
  };

  // ── Mark helpers ──────────────────────────────────────────────────────────

  // Find the mekhala mark that corresponds to a district mark (same registration + event)
  const getMekhalaMarkForDm = (dm) =>
    mekhalaMarks.find(
      (mm) => mm.registrationId === dm.registrationId && mm.eventId === dm.eventId
    ) || null;

  const existingStateMark = (districtMarkId) =>
    stateMarks.find((m) => m.districtMarkId === districtMarkId);

  const getInput = (key) => markInputs[key] || { mark1: "", mark2: "", mark3: "" };
  const setInput = (key, field, val) =>
    setMarkInputs((prev) => ({ ...prev, [key]: { ...getInput(key), [field]: val } }));

  const handleSaveMark = async (districtMark) => {
    const key = districtMark.id;
    const inp = getInput(key);
    const m1  = Number(inp.mark1);
    const m2  = Number(inp.mark2);
    const m3  = Number(inp.mark3);

    if ([m1, m2, m3].some((m) => isNaN(m) || m < 0 || m > 50)) {
      toast.error("Each mark must be 0–50");
      return;
    }

    const total   = calcTotal(m1, m2, m3);
    const grade   = calcGrade(total);
    const payload = {
      districtMarkId: districtMark.id,
      registrationId: districtMark.registrationId,
      eventId:        districtMark.eventId,
      eventName:      districtMark.eventName,
      category:       districtMark.category,
      type:           districtMark.type,
      madarsaId:      districtMark.madarsaId,
      madarsaName:    districtMark.madarsaName,
      mekhalaId:      districtMark.mekhalaId,
      mekhalaName:    districtMark.mekhalaName,
      districtName:   districtMark.districtName,
      studentIds:     districtMark.studentIds,
      students:       districtMark.students,
      districtTotal:  districtMark.total,
      districtGrade:  districtMark.grade,
      mark1: m1, mark2: m2, mark3: m3,
      total, grade,
      verificationStatus: "pending",
    };

    // Strip any undefined values to prevent Firebase invalid data errors
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, v]) => v !== undefined)
    );

    setSavingId(key);
    try {
      const existing = existingStateMark(key);
      if (existing) {
        await updateMarks("state", existing.id, cleanPayload);
        toast.success("State marks updated");
      } else {
        await saveMarks("state", cleanPayload, user?.uid);
        toast.success("State marks saved — pending verification");
      }
      await load();
    } catch (err) {
      console.error("Save mark error:", err);
      toast.error("Failed to save state marks: " + (err.message || err));
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteMark = async (districtMark) => {
    const existing = existingStateMark(districtMark.id);
    if (!existing) return;
    try {
      await deleteMarks("state", existing.id);
      toast.success("State marks deleted");
      await load();
    } catch {
      toast.error("Failed to delete marks");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading state competition data…
        </div>
      </Layout>
    );
  }

  if (!config?.portalVisibility?.state) {
    return (
      <Layout>
        <div className="p-6 text-center text-gray-500">
          Competition module is not enabled for State portal.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <Trophy className="h-6 w-6 text-teal-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">
              Competition <span className="text-teal-700 font-arabic">التنافس</span>
            </h1>
            <p className="text-sm text-gray-500">State Portal — Final Mark Entry</p>
          </div>
        </div>

        {/* Cascade filters: District → Mekhala → Madrasa */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap bg-gray-50 border rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-gray-600 hidden sm:block">Filter:</span>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-gray-500 sm:hidden">District</span>
            <Popover open={openDistrict} onOpenChange={setOpenDistrict}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={openDistrict} className="w-full sm:w-52 justify-between bg-white font-normal text-gray-700">
                  {selectedDistrict === "all" ? `All Districts (${uniqueDistricts.length})` : selectedDistrict}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full sm:w-52 p-0">
                <Command>
                  <CommandInput placeholder="Search district..." />
                  <CommandList>
                    <CommandEmpty>No districts found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="all" onSelect={() => { handleDistrictChange("all"); setOpenDistrict(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", selectedDistrict === "all" ? "opacity-100" : "opacity-0")} />
                        All Districts ({uniqueDistricts.length})
                      </CommandItem>
                      {uniqueDistricts.map((d) => (
                        <CommandItem key={d} value={d} onSelect={() => { handleDistrictChange(d); setOpenDistrict(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", selectedDistrict === d ? "opacity-100" : "opacity-0")} />
                          {d}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-gray-500 sm:hidden">Mekhala</span>
            <Popover open={openMekhala} onOpenChange={setOpenMekhala}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={openMekhala} className="w-full sm:w-52 justify-between bg-white font-normal text-gray-700">
                  {selectedMekhala === "all" ? `All Mekhalas (${uniqueMekhalas.length})` : selectedMekhala}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full sm:w-52 p-0">
                <Command>
                  <CommandInput placeholder="Search mekhala..." />
                  <CommandList>
                    <CommandEmpty>No mekhalas found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="all" onSelect={() => { handleMekhalaChange("all"); setOpenMekhala(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", selectedMekhala === "all" ? "opacity-100" : "opacity-0")} />
                        All Mekhalas ({uniqueMekhalas.length})
                      </CommandItem>
                      {uniqueMekhalas.map((m) => (
                        <CommandItem key={m} value={m} onSelect={() => { handleMekhalaChange(m); setOpenMekhala(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", selectedMekhala === m ? "opacity-100" : "opacity-0")} />
                          {m}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-gray-500 sm:hidden">Madrasa</span>
            <Popover open={openMadrasa} onOpenChange={setOpenMadrasa}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={openMadrasa} className="w-full sm:w-[300px] justify-between bg-white text-sm md:text-base border-teal-200 hover:border-teal-300 hover:bg-teal-50 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-teal-600 focus-visible:border-teal-600 font-normal text-slate-700">
                  {selectedMadrasa === "all" ? `All Madarsas (${uniqueMadarsas.length})` : (() => {
                    const m = uniqueMadarsas.find(m => m.id === selectedMadrasa);
                    return m ? `${m.name} (${m.id})` : "Select Madrasa...";
                  })()}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[90vw] sm:w-[300px] p-0">
                <Command>
                  <CommandInput className="bg-white" placeholder="Search madrasa..." />
                  <CommandList className="bg-white">
                    <CommandEmpty>No madrasas found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem className="bg-white" value="all" onSelect={() => { setSelectedMadrasa("all"); setOpenMadrasa(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", selectedMadrasa === "all" ? "opacity-100" : "opacity-0")} />
                        All Madarsas ({uniqueMadarsas.length})
                      </CommandItem>
                      {uniqueMadarsas.map((m) => (
                        <CommandItem className="bg-white" key={m.id} value={`${m.id} ${m.name}`} onSelect={() => { setSelectedMadrasa(m.id); setOpenMadrasa(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", selectedMadrasa === m.id ? "opacity-100" : "opacity-0")} />
                          {m.name} ({m.id})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {(selectedDistrict !== "all" || selectedMekhala !== "all" || selectedMadrasa !== "all") && (
            <Button
              variant="ghost" size="sm"
              onClick={() => { setSelectedDistrict("all"); setSelectedMekhala("all"); setSelectedMadrasa("all"); }}
              className="text-gray-500"
            >
              Clear
            </Button>
          )}
        </div>

        {/* District results + state mark entry */}
        {filteredMarks.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-400">
              {districtMarks.length === 0
                ? "No district marks received yet."
                : "No results match the selected filters."}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Mekhala &amp; District Results — Enter State Final Marks ({filteredMarks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>District</TableHead>
                    <TableHead>Mekhala</TableHead>
                    <TableHead>Madrasa</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead className="text-blue-700 bg-blue-50">Mek. Total</TableHead>
                    <TableHead className="text-purple-700 bg-purple-50">Dist. Total</TableHead>
                    <TableHead>M1</TableHead>
                    <TableHead>M2</TableHead>
                    <TableHead>M3</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMarks.map((dm) => {
                    const key          = dm.id;
                    const inp          = getInput(key);
                    const m1           = Number(inp.mark1) || 0;
                    const m2           = Number(inp.mark2) || 0;
                    const m3           = Number(inp.mark3) || 0;
                    const hasAll       = inp.mark1 !== "" && inp.mark2 !== "" && inp.mark3 !== "";
                    const previewTotal = hasAll ? calcTotal(m1, m2, m3) : "—";
                    const previewGrade = typeof previewTotal === "number" ? calcGrade(previewTotal) : "—";
                    const existing     = existingStateMark(key);
                    const status       = existing?.verificationStatus;
                    const locked       = status === "verified" || status === "published";
                    const mekhalaMark  = getMekhalaMarkForDm(dm);

                    return (
                      <TableRow key={key} className={existing ? "bg-emerald-50/30" : ""}>
                        <TableCell className="text-sm text-gray-600 whitespace-nowrap">{dm.districtName}</TableCell>
                        <TableCell className="text-sm text-gray-600 whitespace-nowrap">{dm.mekhalaName}</TableCell>
                        <TableCell className="text-sm text-gray-600 font-medium whitespace-nowrap">{dm.madarsaName}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{dm.eventName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{CATEGORIES[dm.category]?.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          <div className="flex flex-col gap-1">
                            {dm.students?.map((s, idx) => (
                              <span key={idx} className="whitespace-nowrap">{s.name}</span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="bg-blue-50/40">
                          {mekhalaMark ? (
                            <span className="font-semibold text-blue-800">{mekhalaMark.total}</span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                          {mekhalaMark?.grade && (
                            <>{" "}<Badge className={gradeColor(mekhalaMark.grade)} variant="outline">{mekhalaMark.grade}</Badge></>
                          )}
                        </TableCell>
                        <TableCell className="bg-purple-50/40">
                          <span className="font-semibold">{dm.total}</span>{" "}
                          <Badge className={gradeColor(dm.grade)} variant="outline">{dm.grade}</Badge>
                        </TableCell>
                        {["mark1", "mark2", "mark3"].map((f) => (
                          <TableCell key={f}>
                            <Input
                              type="number" min="0" max="50"
                              className="w-16 h-8 text-center border-gray-300 shadow-sm bg-white"
                              value={inp[f]}
                              onChange={(e) => setInput(key, f, e.target.value)}
                              disabled={locked}
                            />
                          </TableCell>
                        ))}
                        <TableCell className="font-semibold">{previewTotal}</TableCell>
                        <TableCell>
                          {typeof previewGrade === "string" && previewGrade !== "—"
                            ? <Badge className={gradeColor(previewGrade)}>{previewGrade}</Badge>
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {status
                            ? <Badge variant={status === "published" ? "default" : "secondary"} className="capitalize">{status}</Badge>
                            : <Badge variant="outline" className="text-gray-400 border-gray-200 bg-gray-50 text-xs font-normal">not saved</Badge>}
                        </TableCell>
                        <TableCell className="text-center">
                          {!locked && (
                            <div className="grid grid-cols-[32px_auto_32px] gap-2 items-center w-full max-w-[140px] mx-auto">
                              <div />
                              <Button
                                size="sm"
                                className="bg-teal-700 hover:bg-teal-800 h-8 px-4 font-medium transition-all"
                                onClick={() => handleSaveMark(dm)}
                                disabled={savingId === key}
                              >
                                {savingId === key
                                  ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  : existing ? <Check className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                                {existing ? "Update" : "Save"}
                              </Button>
                              {existing ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="icon" variant="ghost"
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 rounded-full p-0 flex items-center justify-center transition-all"
                                      title="Delete marks"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete State Marks?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete the state marks for this entry? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDeleteMark(dm)}>
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : <div />}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}


      </div>
    </Layout>
  );
}
