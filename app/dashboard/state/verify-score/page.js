"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/alert-dialog";
import { ShieldCheck, Globe, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CATEGORIES } from "@/lib/competitionUtils";

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

export default function VerifyScorePage() {
  const { user, userData } = useAuthStore();

  const [stateMarks, setStateMarks]             = useState([]);
  const [mekhalaMarks, setMekhalaMarks]         = useState([]);
  const [loading, setLoading]                   = useState(true);
  
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [openDistrict, setOpenDistrict]         = useState(false);
  const [selectedMekhala, setSelectedMekhala]   = useState("all");
  const [openMekhala, setOpenMekhala]           = useState(false);
  const [selectedMadrasa, setSelectedMadrasa]   = useState("all");
  const [openMadrasa, setOpenMadrasa]           = useState(false);

  const [actionId, setActionId]                 = useState(null);
  const [confirmMark, setConfirmMark]           = useState(null);

  const convenerDistricts = useMemo(() => userData?.districts || [], [userData]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (convenerDistricts.length === 0) {
        // No district restriction — fetch all state marks (global access)
        const [smSnap, mmSnap] = await Promise.all([
          getDocs(collection(db, "competition_state_marks")),
          getDocs(collection(db, "competition_mekhala_marks"))
        ]);
        setStateMarks(smSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setMekhalaMarks(mmSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        return;
      }

      const smResults = await Promise.all(
        convenerDistricts.map(async (dName) => {
          const snap = await getDocs(
            query(
              collection(db, "competition_state_marks"),
              where("districtName", "==", dName),
            ),
          );
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }),
      );
      setStateMarks(smResults.flat());

      const mmResults = await Promise.all(
        convenerDistricts.map(async (dName) => {
          const snap = await getDocs(
            query(
              collection(db, "competition_mekhala_marks"),
              where("districtName", "==", dName),
            ),
          );
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }),
      );
      setMekhalaMarks(mmResults.flat());
    } catch {
      toast.error("Failed to load state marks");
    } finally {
      setLoading(false);
    }
  }, [convenerDistricts]);

  useEffect(() => { load(); }, [load]);

  // Cascade filter derivations
  const uniqueDistricts = useMemo(() =>
    [...new Set(stateMarks.map((m) => m.districtName).filter(Boolean))].sort(),
    [stateMarks]
  );

  const districtFiltered = useMemo(() =>
    selectedDistrict === "all"
      ? stateMarks
      : stateMarks.filter((m) => m.districtName === selectedDistrict),
    [stateMarks, selectedDistrict]
  );

  const uniqueMekhalas = useMemo(() =>
    [...new Set(districtFiltered.map((m) => m.mekhalaName).filter(Boolean))].sort(),
    [districtFiltered]
  );

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

  const finalFiltered = useMemo(() =>
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

  const getMekhalaMarkForSm = (sm) =>
    mekhalaMarks.find(
      (mm) => mm.registrationId === sm.registrationId && mm.eventId === sm.eventId
    ) || null;

  const pending   = finalFiltered.filter((m) => m.verificationStatus === "pending" || !m.verificationStatus);
  const verified  = finalFiltered.filter((m) => m.verificationStatus === "verified");
  const published = finalFiltered.filter((m) => m.verificationStatus === "published");

  const handleVerifyAndPublish = async (mark) => {
    setActionId(mark.id);
    try {
      // Calculate position
      const existSnap = await getDocs(
        query(
          collection(db, "competition_results"),
          where("eventId", "==", mark.eventId),
        ),
      );
      const sameCatResults = existSnap.docs
        .map((d) => d.data())
        .filter((r) => r.category === mark.category);
      const higherCount = sameCatResults.filter(
        (r) => (r.finalScore || 0) > (mark.total || 0),
      ).length;
      const position = higherCount + 1;

      // Update state mark → published
      await updateDoc(doc(db, "competition_state_marks", mark.id), {
        verificationStatus: "published",
        verifiedAt: serverTimestamp(),
        verifiedBy: user?.uid || null,
        publishedAt: serverTimestamp(),
      });

      // Write to public competition_results
      const studentNames  = mark.students?.map((s) => s.name).join(", ") || "";
      const primaryStudent = mark.students?.[0];

      await addDoc(collection(db, "competition_results"), {
        stateMarkId:  mark.id,
        studentId:    primaryStudent?.id || "",
        studentName:  mark.type === "group"
          ? studentNames
          : (primaryStudent?.name || ""),
        studentPhoto: primaryStudent?.profilePictureUrl || "",
        eventId:      mark.eventId,
        eventName:    mark.eventName,
        category:     mark.category,
        type:         mark.type,
        madarsaId:    mark.madarsaId,
        madarsaName:  mark.madarsaName,
        mekhalaId:    mark.mekhalaId,
        mekhalaName:  mark.mekhalaName,
        districtName: mark.districtName,
        finalGrade:   mark.grade,
        finalScore:   mark.total,
        mark1:        mark.mark1,
        mark2:        mark.mark2,
        mark3:        mark.mark3,
        students:     mark.students || [],
        position,
        publishedAt:  serverTimestamp(),
        verifiedBy:   user?.uid || null,
      });

      toast.success(`Result verified and published — Position #${position} in ${CATEGORIES[mark.category]?.label}`);
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Failed to verify and publish");
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" /> Loading results…
        </div>
      </Layout>
    );
  }

  const renderTableRow = (m, showAction = true, btnLabel = "Verify & Publish", actionHandler = setConfirmMark) => {
    const mekMark = getMekhalaMarkForSm(m);
    return (
      <TableRow key={m.id} className="hover:bg-teal-50/40">
        <TableCell className="font-medium">
          <div className="flex flex-col gap-1">
            {m.students?.map((s, idx) => (
              <span key={idx} className="whitespace-nowrap">{s.name}</span>
            ))}
          </div>
        </TableCell>
        <TableCell>{m.eventName}</TableCell>
        <TableCell>
          <Badge variant="outline">{CATEGORIES[m.category]?.label}</Badge>
        </TableCell>
        <TableCell className="whitespace-nowrap">{m.districtName}</TableCell>
        <TableCell className="whitespace-nowrap">{m.mekhalaName}</TableCell>
        <TableCell className="font-medium whitespace-nowrap">{m.madarsaName} <span className="text-xs text-gray-400">({m.madarsaId})</span></TableCell>
        
        {/* Mekhala Total */}
        <TableCell className="bg-blue-50/40 border-l border-blue-100">
          {mekMark ? <span className="font-semibold text-blue-800">{mekMark.total}</span> : <span className="text-gray-400 text-xs">—</span>}
          {mekMark?.grade && <>{" "}<Badge className={gradeColor(mekMark.grade)} variant="outline">{mekMark.grade}</Badge></>}
        </TableCell>

        {/* District Total */}
        <TableCell className="bg-purple-50/40 border-l border-purple-100">
          {m.districtTotal !== undefined ? <span className="font-semibold text-purple-800">{m.districtTotal}</span> : <span className="text-gray-400 text-xs">—</span>}
          {m.districtGrade && <>{" "}<Badge className={gradeColor(m.districtGrade)} variant="outline">{m.districtGrade}</Badge></>}
        </TableCell>

        <TableCell className="border-l">{m.mark1}</TableCell>
        <TableCell>{m.mark2}</TableCell>
        <TableCell>{m.mark3}</TableCell>
        
        {/* State Total */}
        <TableCell className="bg-teal-50/60 font-bold text-teal-800 text-lg border-l border-teal-100">
          {m.total}
        </TableCell>
        <TableCell className="bg-teal-50/60 border-r border-teal-100">
          <Badge className={gradeColor(m.grade)}>{m.grade}</Badge>
        </TableCell>

        {showAction && (
          <TableCell className="text-center">
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white gap-1 shadow-sm"
              onClick={() => actionHandler(m)}
              disabled={actionId === m.id}
            >
              {actionId === m.id
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Globe className="h-3 w-3" />}
              {btnLabel}
            </Button>
          </TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <Layout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <ShieldCheck className="h-6 w-6 text-teal-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-teal-900">Score Verification</h1>
            <p className="text-sm text-gray-500">
              Review state marks and publish verified results to the live scoreboard
            </p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pending",   count: stateMarks.filter((m) => !m.verificationStatus || m.verificationStatus === "pending").length,   color: "bg-amber-50 border-amber-200 text-amber-700" },
            { label: "Verified",  count: stateMarks.filter((m) => m.verificationStatus === "verified").length,  color: "bg-teal-50 border-teal-200 text-teal-700" },
            { label: "Published", count: stateMarks.filter((m) => m.verificationStatus === "published").length, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
          ].map((s) => (
            <Card key={s.label} className={`border ${s.color}`}>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold">{s.count}</p>
                <p className="text-sm font-medium">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Cascade filters */}
        <div className="flex items-center gap-3 flex-wrap bg-white border border-teal-100 shadow-sm rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-teal-800">Filter:</span>
          
          {/* District Filter */}
          <div className="flex items-center gap-2">
            <Popover open={openDistrict} onOpenChange={setOpenDistrict}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={openDistrict} className="w-52 justify-between bg-gray-50 font-normal text-gray-700 border-teal-100 hover:bg-teal-50">
                  {selectedDistrict === "all" ? `All Districts (${uniqueDistricts.length})` : selectedDistrict}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-0">
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

          {/* Mekhala Filter */}
          <div className="flex items-center gap-2">
            <Popover open={openMekhala} onOpenChange={setOpenMekhala}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={openMekhala} className="w-52 justify-between bg-gray-50 font-normal text-gray-700 border-teal-100 hover:bg-teal-50">
                  {selectedMekhala === "all" ? `All Mekhalas (${uniqueMekhalas.length})` : selectedMekhala}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-0">
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

          {/* Madrasa Filter */}
          <div className="flex items-center gap-2">
            <Popover open={openMadrasa} onOpenChange={setOpenMadrasa}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={openMadrasa} className="w-[300px] justify-between bg-gray-50 font-normal text-gray-700 border-teal-100 hover:bg-teal-50">
                  {selectedMadrasa === "all" ? `All Madarsas (${uniqueMadarsas.length})` : (() => {
                    const m = uniqueMadarsas.find(m => m.id === selectedMadrasa);
                    return m ? `${m.name} (${m.id})` : "Select Madrasa...";
                  })()}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
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
              className="text-teal-600 hover:text-teal-800 hover:bg-teal-50"
            >
              Clear Filters
            </Button>
          )}
        </div>

        {finalFiltered.length === 0 && (
          <Card className="border-dashed border-2 border-teal-100 bg-teal-50/30">
            <CardContent className="py-12 text-center text-teal-600 font-medium">
              No state marks found for the selected filters.
            </CardContent>
          </Card>
        )}

        {/* Pending verification */}
        {pending.length > 0 && (
          <Card className="border-amber-200 shadow-md overflow-hidden">
            <CardHeader className="bg-amber-50 border-b border-amber-100 py-4">
              <CardTitle className="text-sm font-semibold text-amber-800">
                Pending Verification ({pending.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b">
                    <TableHead className="font-semibold text-slate-700">Student(s)</TableHead>
                    <TableHead className="font-semibold text-slate-700">Event</TableHead>
                    <TableHead className="font-semibold text-slate-700">Category</TableHead>
                    <TableHead className="font-semibold text-slate-700">District</TableHead>
                    <TableHead className="font-semibold text-slate-700">Mekhala</TableHead>
                    <TableHead className="font-semibold text-slate-700">Madrasa</TableHead>
                    <TableHead className="text-blue-700 bg-blue-50/50 border-l border-blue-100 font-semibold whitespace-nowrap">Mek. Total</TableHead>
                    <TableHead className="text-purple-700 bg-purple-50/50 border-l border-purple-100 font-semibold whitespace-nowrap">Dist. Total</TableHead>
                    <TableHead className="font-semibold text-slate-700 border-l">M1</TableHead>
                    <TableHead className="font-semibold text-slate-700">M2</TableHead>
                    <TableHead className="font-semibold text-slate-700">M3</TableHead>
                    <TableHead className="text-teal-800 bg-teal-50/60 border-l border-teal-100 font-bold">State Total</TableHead>
                    <TableHead className="text-teal-800 bg-teal-50/60 border-r border-teal-100 font-bold">Grade</TableHead>
                    <TableHead className="text-center font-semibold text-slate-700">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((m) => renderTableRow(m, true, "Verify & Publish", setConfirmMark))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Verified (not yet published) */}
        {verified.length > 0 && (
          <Card className="border-teal-200 shadow-md overflow-hidden mt-6">
            <CardHeader className="bg-teal-50 border-b border-teal-100 py-4">
              <CardTitle className="text-sm font-semibold text-teal-800">
                Verified ({verified.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b">
                    <TableHead className="font-semibold text-slate-700">Student(s)</TableHead>
                    <TableHead className="font-semibold text-slate-700">Event</TableHead>
                    <TableHead className="font-semibold text-slate-700">Category</TableHead>
                    <TableHead className="font-semibold text-slate-700">District</TableHead>
                    <TableHead className="font-semibold text-slate-700">Mekhala</TableHead>
                    <TableHead className="font-semibold text-slate-700">Madrasa</TableHead>
                    <TableHead className="text-blue-700 bg-blue-50/50 border-l border-blue-100 font-semibold whitespace-nowrap">Mek. Total</TableHead>
                    <TableHead className="text-purple-700 bg-purple-50/50 border-l border-purple-100 font-semibold whitespace-nowrap">Dist. Total</TableHead>
                    <TableHead className="font-semibold text-slate-700 border-l">M1</TableHead>
                    <TableHead className="font-semibold text-slate-700">M2</TableHead>
                    <TableHead className="font-semibold text-slate-700">M3</TableHead>
                    <TableHead className="text-teal-800 bg-teal-50/60 border-l border-teal-100 font-bold">State Total</TableHead>
                    <TableHead className="text-teal-800 bg-teal-50/60 border-r border-teal-100 font-bold">Grade</TableHead>
                    <TableHead className="text-center font-semibold text-slate-700">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verified.map((m) => renderTableRow(m, true, "Publish", setConfirmMark))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Published results */}
        {published.length > 0 && (
          <Card className="border-emerald-200 shadow-md overflow-hidden mt-6">
            <CardHeader className="bg-emerald-50 border-b border-emerald-100 py-4">
              <CardTitle className="text-sm font-semibold text-emerald-800">
                Published Results ({published.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b">
                    <TableHead className="font-semibold text-slate-700">Student(s)</TableHead>
                    <TableHead className="font-semibold text-slate-700">Event</TableHead>
                    <TableHead className="font-semibold text-slate-700">Category</TableHead>
                    <TableHead className="font-semibold text-slate-700">District</TableHead>
                    <TableHead className="font-semibold text-slate-700">Mekhala</TableHead>
                    <TableHead className="font-semibold text-slate-700">Madrasa</TableHead>
                    <TableHead className="text-blue-700 bg-blue-50/50 border-l border-blue-100 font-semibold whitespace-nowrap">Mek. Total</TableHead>
                    <TableHead className="text-purple-700 bg-purple-50/50 border-l border-purple-100 font-semibold whitespace-nowrap">Dist. Total</TableHead>
                    <TableHead className="font-semibold text-slate-700 border-l">M1</TableHead>
                    <TableHead className="font-semibold text-slate-700">M2</TableHead>
                    <TableHead className="font-semibold text-slate-700">M3</TableHead>
                    <TableHead className="text-teal-800 bg-teal-50/60 border-l border-teal-100 font-bold">State Total</TableHead>
                    <TableHead className="text-teal-800 bg-teal-50/60 border-r border-teal-100 font-bold">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {published.map((m) => renderTableRow(m, false))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmMark} onOpenChange={(open) => { if (!open) setConfirmMark(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verify & Publish Result?</AlertDialogTitle>
            <AlertDialogDescription>
              This will publish{" "}
              <strong>{confirmMark?.eventName}</strong>
              {confirmMark?.districtName ? ` (${confirmMark.districtName})` : ""} to the live
              scoreboard. A position will be calculated and assigned. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmMark(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => {
                const mark = confirmMark;
                setConfirmMark(null);
                handleVerifyAndPublish(mark);
              }}
            >
              Verify & Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
