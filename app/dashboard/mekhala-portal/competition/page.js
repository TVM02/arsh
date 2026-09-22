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
  const [selectedItem, setSelectedItem] = useState("all");
const [openItem, setOpenItem] = useState(false);

const [selectedCategory, setSelectedCategory] = useState("all");
const [openCategory, setOpenCategory] = useState(false);

const [studentSearch, setStudentSearch] = useState("");

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


const uniqueItems = useMemo(() => {
  const map = new Map();

  registrations.forEach((reg) => {
    const id =
      reg.eventId ||
      reg.itemId ||
      reg.eventName ||
      reg.itemName;

    const name =
      reg.eventName ||
      reg.itemName ||
      reg.event ||
      reg.item;

    if (id && name) {
      map.set(id, {
        id,
        name,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}, [registrations]);


const uniqueCategories = useMemo(() => {
  return [
    ...new Set(
      registrations
        .map((reg) => reg.category)
        .filter(Boolean),
    ),
  ].sort();
}, [registrations]);


  // Madrasa dropdown: ALL madarsas in the mekhala, sorted by name
  const uniqueMadarsas = useMemo(() =>
    allMyMadrasas
      .map((m) => ({ id: m.id, name: m.madarsaName || m.name, midCode: m.madarsaId || m.midCode }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [allMyMadrasas]
  );

const filteredRegistrations = useMemo(() => {
  const search = studentSearch
    .trim()
    .toLowerCase();

  return registrations.filter((reg) => {
    /* =====================================
       MADRASA
    ====================================== */

    if (
      selectedMadrasa !== "all" &&
      reg.madarsaId !== selectedMadrasa
    ) {
      return false;
    }


    /* =====================================
       ITEM
    ====================================== */

    const registrationItemId =
      reg.eventId ||
      reg.itemId ||
      reg.eventName ||
      reg.itemName;

    if (
      selectedItem !== "all" &&
      registrationItemId !== selectedItem
    ) {
      return false;
    }


    /* =====================================
       CATEGORY
    ====================================== */

    if (
      selectedCategory !== "all" &&
      reg.category !== selectedCategory
    ) {
      return false;
    }


    /* =====================================
       STUDENT SEARCH
    ====================================== */

    if (search) {
      const studentText = Array.isArray(reg.students)
        ? reg.students
            .map((student) =>
              [
                student?.name,
                student?.studentName,
                student?.id,
                student?.studentId,
              ]
                .filter(Boolean)
                .join(" "),
            )
            .join(" ")
        : "";

      const searchableText = [
        studentText,
        reg.studentName,
        reg.participantName,
        reg.studentId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchableText.includes(search)) {
        return false;
      }
    }

    return true;
  });
}, [
  registrations,
  selectedMadrasa,
  selectedItem,
  selectedCategory,
  studentSearch,
]);


  

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
        <div
  className="
    flex
    flex-wrap
    items-end
    gap-3
    rounded-xl
    border
    border-slate-200
    bg-gradient-to-r
    from-slate-50
    to-teal-50/40
    px-4
    py-4
    shadow-sm
  "
>
  {/* =====================================
      MADRASA FILTER
  ====================================== */}

  <div className="flex flex-col gap-1.5">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      Madrasa
    </span>

    <Popover
      open={openMadrasa}
      onOpenChange={setOpenMadrasa}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={openMadrasa}
          className="
            w-[280px]
            justify-between
            border-teal-200
            bg-white
            font-normal
            text-slate-700
            hover:border-teal-300
            hover:bg-teal-50
          "
        >
          <span className="truncate">
            {selectedMadrasa === "all"
              ? `All Madrasas (${uniqueMadarsas.length})`
              : (() => {
                  const madrasa =
                    uniqueMadarsas.find(
                      (m) =>
                        m.id ===
                        selectedMadrasa,
                    );

                  return madrasa
                    ? `${madrasa.name}${
                        madrasa.midCode
                          ? ` (${madrasa.midCode})`
                          : ""
                      }`
                    : "Select Madrasa...";
                })()}
          </span>

          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput
            className="bg-white"
            placeholder="Search madrasa..."
          />

          <CommandList className="bg-white">
            <CommandEmpty>
              No madrasas found.
            </CommandEmpty>

            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={() => {
                  setSelectedMadrasa("all");
                  setOpenMadrasa(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedMadrasa === "all"
                      ? "opacity-100"
                      : "opacity-0",
                  )}
                />

                All Madrasas ({uniqueMadarsas.length})
              </CommandItem>

              {uniqueMadarsas.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.id} ${m.name} ${m.midCode || ""}`}
                  className="flex flex-col items-start gap-1 py-2"
                  onSelect={() => {
                    setSelectedMadrasa(m.id);
                    setOpenMadrasa(false);
                  }}
                >
                  <div className="flex w-full items-center">
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        selectedMadrasa === m.id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />

                    <span className="whitespace-normal break-words text-sm font-medium text-slate-800">
                      {m.name}
                    </span>
                  </div>

                  {m.midCode && (
                    <span
                      className="
                        ml-6
                        rounded-md
                        border
                        border-amber-200
                        bg-amber-50
                        px-2
                        py-0.5
                        text-[10px]
                        font-semibold
                        text-amber-700
                      "
                    >
                      {m.midCode}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>


  {/* =====================================
      ITEM FILTER
  ====================================== */}

  <div className="flex flex-col gap-1.5">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      Item
    </span>

    <Popover
      open={openItem}
      onOpenChange={setOpenItem}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="
            w-[220px]
            justify-between
            border-teal-200
            bg-white
            font-normal
            text-slate-700
            hover:bg-teal-50
          "
        >
          <span className="truncate">
            {selectedItem === "all"
              ? `All Items (${uniqueItems.length})`
              : uniqueItems.find(
                    (item) =>
                      item.id === selectedItem,
                  )?.name || "Select Item"}
          </span>

          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[260px] p-0">
        <Command>
          <CommandInput placeholder="Search item..." />

          <CommandList>
            <CommandEmpty>
              No items found.
            </CommandEmpty>

            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={() => {
                  setSelectedItem("all");
                  setOpenItem(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedItem === "all"
                      ? "opacity-100"
                      : "opacity-0",
                  )}
                />

                All Items ({uniqueItems.length})
              </CommandItem>

              {uniqueItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.id} ${item.name}`}
                  onSelect={() => {
                    setSelectedItem(item.id);
                    setOpenItem(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedItem === item.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />

                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>


  {/* =====================================
      CATEGORY FILTER
  ====================================== */}

  <div className="flex flex-col gap-1.5">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      Category
    </span>

    <Popover
      open={openCategory}
      onOpenChange={setOpenCategory}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="
            w-[190px]
            justify-between
            border-teal-200
            bg-white
            font-normal
            text-slate-700
            hover:bg-teal-50
          "
        >
          <span className="truncate">
            {selectedCategory === "all"
              ? `All Categories (${uniqueCategories.length})`
              : CATEGORIES?.[selectedCategory]
                  ?.label ||
                selectedCategory}
          </span>

          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Search category..." />

          <CommandList>
            <CommandEmpty>
              No categories found.
            </CommandEmpty>

            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={() => {
                  setSelectedCategory("all");
                  setOpenCategory(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedCategory === "all"
                      ? "opacity-100"
                      : "opacity-0",
                  )}
                />

                All Categories
              </CommandItem>

              {uniqueCategories.map(
                (category) => (
                  <CommandItem
                    key={category}
                    value={`${category} ${
                      CATEGORIES?.[category]
                        ?.label || ""
                    }`}
                    onSelect={() => {
                      setSelectedCategory(
                        category,
                      );
                      setOpenCategory(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedCategory ===
                          category
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />

                    {CATEGORIES?.[category]
                      ?.label ||
                      category}
                  </CommandItem>
                ),
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>


  {/* =====================================
      STUDENT SEARCH
  ====================================== */}

  <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      Student Search
    </span>

    <div className="relative">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="
          absolute
          left-3
          top-1/2
          h-4
          w-4
          -translate-y-1/2
          text-slate-400
        "
      >
        <circle
          cx="11"
          cy="11"
          r="7"
          stroke="currentColor"
          strokeWidth="1.8"
        />

        <path
          d="M20 20L16.5 16.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>

      <input
        type="text"
        value={studentSearch}
        onChange={(e) =>
          setStudentSearch(e.target.value)
        }
        placeholder="Search student name or ID..."
        className="
          h-10
          w-full
          rounded-md
          border
          border-teal-200
          bg-white
          pl-9
          pr-3
          text-sm
          text-slate-700
          outline-none
          transition
          placeholder:text-slate-400
          focus:border-teal-500
          focus:ring-2
          focus:ring-teal-500/10
        "
      />
    </div>
  </div>


  {/* =====================================
      CLEAR ALL
  ====================================== */}

  {(selectedMadrasa !== "all" ||
    selectedItem !== "all" ||
    selectedCategory !== "all" ||
    studentSearch) && (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        setSelectedMadrasa("all");
        setSelectedItem("all");
        setSelectedCategory("all");
        setStudentSearch("");
      }}
      className="
        h-10
        text-slate-500
        hover:bg-red-50
        hover:text-red-600
      "
    >
      Clear All
    </Button>
  )}
</div>

        {/* Registrations + mark entry */}
        {filteredRegistrations.length === 0 ? (
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
                Registrations — Enter Marks ({filteredRegistrations.length})
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
                  {filteredRegistrations.map((reg) => {
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
                        <TableCell className="whitespace-nowrap">
  <div className="flex flex-col gap-1">
    <span className="text-sm font-semibold text-slate-800">
      {reg.madarsaName || "—"}
    </span>

    {reg.madarsaId && (
      <span
        className="
          inline-flex
          w-fit
          items-center
          rounded-md
          border
          border-teal-100
          bg-teal-50
          px-2
          py-0.5
          text-[10px]
          font-semibold
          tracking-wide
          text-teal-700
        "
      >
        ID: {reg.madarsaId}
      </span>
    )}
  </div>
</TableCell>
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
