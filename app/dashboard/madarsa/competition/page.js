"use client";

import { useState, useEffect, useCallback } from "react";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Trophy,
  ChevronRight,
  Users,
  User,
  Check,
  Loader2,
  ArrowLeft,
  Trash2,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getCompetitionConfig,
  getEvents,
  getRegistrationsByMadarsa,
  saveRegistration,
  updateRegistration,
  deleteRegistration,
} from "@/lib/competitionService";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  isEligible,
} from "@/lib/competitionUtils";

// ─── views ───────────────────────────────────────────────────────────────
const VIEW = { CATEGORIES: "categories", EVENTS: "events", REGISTER: "register" };

export default function SadarCompetitionPage() {
  const { user, userData } = useAuthStore();

  const [config, setConfig]               = useState(null);
  const [events, setEvents]               = useState([]);
  const [students, setStudents]           = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [madarsaHierarchy, setMadarsaHierarchy] = useState({ mekhalaName: "", districtName: "" });

  const [view, setView]                   = useState(VIEW.CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedEvent, setSelectedEvent]       = useState(null);

  // selection state
  const [selectedIds, setSelectedIds]     = useState(new Set());
  const [saving, setSaving]               = useState(false);

  // edit dialog
  const [editReg, setEditReg]             = useState(null);
  const [editSelectedIds, setEditSelectedIds] = useState(new Set());
  const [editSaving, setEditSaving]       = useState(false);

  const madarsaId = userData?.madarsaId;

  // ── bootstrap ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!madarsaId) return;
    setLoading(true);
    try {
      const [cfg, evts, regs, studSnap, madSnap] = await Promise.all([
        getCompetitionConfig(),
        getEvents(),
        getRegistrationsByMadarsa(madarsaId),
        getDocs(query(
          collection(db, "students"),
          where("madarsaId", "==", madarsaId),
          where("status", "==", "active"),
        )),
        getDocs(query(collection(db, "madarsas"), where("madarsaId", "==", madarsaId))),
      ]);
      setConfig(cfg);
      setEvents(evts);
      setRegistrations(regs);
      setStudents(studSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      // Store madrasa hierarchy for fallback when userData fields are empty
      if (!madSnap.empty) {
        const m = madSnap.docs[0].data();
        setMadarsaHierarchy({
          mekhalaName: m.mekhala || m.mekhalaName || "",
          districtName: m.district || m.districtName || "",
        });
      }
    } catch {
      toast.error("Failed to load competition data");
    } finally {
      setLoading(false);
    }
  }, [madarsaId]);

  useEffect(() => { load(); }, [load]);

  // ── helpers ───────────────────────────────────────────────────────────
  const categoryEvents = (catKey) => events.filter((e) => e.category === catKey);

  const dobCutoff = (catKey) => config?.categories?.[catKey]?.dobCutoff ?? "";

  const eligibleStudents = (catKey) =>
    students.filter((s) => isEligible(s, dobCutoff(catKey)));

  // Count individual / group registrations for a student (across this madarsa)
  const studentEventCounts = (studentId) => {
    let individual = 0, group = 0;
    registrations.forEach((reg) => {
      if (reg.studentIds?.includes(studentId)) {
        if (reg.type === "individual") individual++;
        else group++;
      }
    });
    return { individual, group };
  };

  // existing registration for this event+madrasa
  const existingReg = (eventId) =>
    registrations.find((r) => r.eventId === eventId && r.madarsaId === madarsaId);

  // ── open event for registration ───────────────────────────────────────
  const openEvent = (ev) => {
    setSelectedEvent(ev);
    const reg = existingReg(ev.id);
    setSelectedIds(reg ? new Set(reg.studentIds) : new Set());
    setView(VIEW.REGISTER);
  };

  // ── toggle student selection ──────────────────────────────────────────
  const toggleStudent = (studentId) => {
    const ev = selectedEvent;
    if (!ev) return;

    if (selectedIds.has(studentId)) {
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(studentId); return s; });
      return;
    }

    // group: cap at participantsRequired
    if (ev.type === "group") {
      if (selectedIds.size >= ev.participantsRequired) {
        toast.error(`Exactly ${ev.participantsRequired} participants required`);
        return;
      }
    }

    // individual: cap at 1
    if (ev.type === "individual" && selectedIds.size >= 1) {
      toast.error("Individual event allows only 1 student");
      return;
    }

    setSelectedIds((prev) => new Set([...prev, studentId]));
  };

  // ── save registration ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedEvent || !madarsaId) return;
    const ev = selectedEvent;
    const ids = [...selectedIds];

    if (ids.length === 0) { toast.error("Select at least one student"); return; }
    if (ev.type === "group" && ids.length !== ev.participantsRequired) {
      toast.error(`Exactly ${ev.participantsRequired} participants required`);
      return;
    }

    // Validate per-student limits
    for (const sid of ids) {
      const counts = studentEventCounts(sid);
      const existingForThisEvent = existingReg(ev.id);
      // don't double-count if already in this event
      const alreadyInThisEvent = existingForThisEvent?.studentIds?.includes(sid);

      if (ev.type === "individual") {
        const countWithoutThisEvent = alreadyInThisEvent ? counts.individual - 1 : counts.individual;
        if (countWithoutThisEvent >= 3) {
          const s = students.find((x) => x.id === sid);
          toast.error(`${s?.fullName || "A student"} has reached the max of 3 individual events`);
          return;
        }
      } else {
        const countWithoutThisEvent = alreadyInThisEvent ? counts.group - 1 : counts.group;
        if (countWithoutThisEvent >= 2) {
          const s = students.find((x) => x.id === sid);
          toast.error(`${s?.fullName || "A student"} has reached the max of 2 group events`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const studentDocs = ids.map((sid) => {
        const s = students.find((x) => x.id === sid);
        return { id: sid, name: s?.fullName || s?.name || "", admissionNumber: s?.admissionNumber || "", dateOfBirth: s?.dateOfBirth || "", profilePictureUrl: s?.profilePictureUrl || "" };
      });

      const payload = {
        eventId: ev.id,
        eventName: ev.name,
        category: ev.category,
        type: ev.type,
        participantsRequired: ev.participantsRequired ?? null,
        madarsaId,
        madarsaName: userData?.madarsaName || userData?.name || "",
        mekhalaId: userData?.mekhalaId || "",
        mekhalaName: userData?.mekhalaName || userData?.mekhala || madarsaHierarchy.mekhalaName,
        districtName: userData?.districtName || userData?.district || userData?.districtId || madarsaHierarchy.districtName,
        studentIds: ids,
        students: studentDocs,
      };

      const reg = existingReg(ev.id);
      if (reg) {
        await updateRegistration(reg.id, payload);
        toast.success("Registration updated");
      } else {
        await saveRegistration(payload, user?.uid);
        toast.success("Registration saved");
      }

      await load();
      setView(VIEW.EVENTS);
    } catch {
      toast.error("Failed to save registration");
    } finally {
      setSaving(false);
    }
  };

  // ── delete registration ───────────────────────────────────────────────
  const handleDelete = async (reg) => {
    if (!confirm(`Remove registration for "${reg.eventName}"?`)) return;
    try {
      await deleteRegistration(reg.id);
      toast.success("Registration removed");
      await load();
    } catch {
      toast.error("Failed to remove registration");
    }
  };

  // ── save button enablement ────────────────────────────────────────────
  const canSave = selectedEvent
    ? selectedEvent.type === "individual"
      ? selectedIds.size === 1
      : selectedIds.size === selectedEvent.participantsRequired
    : false;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading competition data…
        </div>
      </Layout>
    );
  }

  if (!config?.portalVisibility?.sadar) {
    return (
      <Layout>
        <div className="p-6 text-center text-gray-500">
          Competition module is not enabled for Sadar portal. Contact Central Admin.
        </div>
      </Layout>
    );
  }

  // ── VIEW: CATEGORIES ──────────────────────────────────────────────────
  if (view === VIEW.CATEGORIES) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Trophy className="h-6 w-6 text-teal-700" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Competition <span className="text-teal-700 font-arabic">التنافس</span></h1>
              <p className="text-sm text-gray-500">Select a category to register students</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {CATEGORY_ORDER.map((key) => {
              const cat = CATEGORIES[key];
              const evCount = categoryEvents(key).length;
              const regCount = registrations.filter((r) => r.category === key).length;
              return (
                <Card
                  key={key}
                  className="cursor-pointer hover:border-teal-400 hover:shadow-md transition-all"
                  onClick={() => { setSelectedCategory(key); setView(VIEW.EVENTS); }}
                >
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg">{cat.label}</p>
                      <p className="text-xs font-arabic text-gray-400">{cat.labelAr}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {evCount} event{evCount !== 1 ? "s" : ""} · {regCount} registration{regCount !== 1 ? "s" : ""}
                      </p>
                      {config.categories?.[key]?.dobCutoff && (
                        <p className="text-xs text-teal-600 mt-0.5">
                          DOB cutoff: {new Date(config.categories[key].dobCutoff).toLocaleDateString("en-IN")}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Registered summary */}
          {registrations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">All Registrations ({registrations.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrations.map((reg) => (
                      <TableRow key={reg.id}>
                        <TableCell className="font-medium">{reg.eventName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{CATEGORIES[reg.category]?.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={reg.type === "group" ? "secondary" : "outline"}>
                            {reg.type === "group" ? <Users className="h-3 w-3 mr-1 inline" /> : <User className="h-3 w-3 mr-1 inline" />}
                            {reg.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {reg.students?.map((s) => s.name).join(", ")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { const ev = events.find((e) => e.id === reg.eventId); if (ev) openEvent(ev); }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => handleDelete(reg)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    );
  }

  // ── VIEW: EVENTS ──────────────────────────────────────────────────────
  if (view === VIEW.EVENTS && selectedCategory) {
    const cat = CATEGORIES[selectedCategory];
    const catEvents = categoryEvents(selectedCategory);
    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <Button variant="ghost" onClick={() => setView(VIEW.CATEGORIES)} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Categories
          </Button>
          <div>
            <h2 className="text-xl font-semibold">{cat.label} Events</h2>
            <p className="text-sm text-gray-500">
              {dobCutoff(selectedCategory)
                ? `Eligible: born on or after ${new Date(dobCutoff(selectedCategory)).toLocaleDateString("en-IN")}`
                : "No DOB cutoff set"}
            </p>
          </div>

          {catEvents.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-gray-400">No events in this category yet.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {catEvents.map((ev) => {
                const reg = existingReg(ev.id);
                return (
                  <Card
                    key={ev.id}
                    className="cursor-pointer hover:border-teal-400 hover:shadow-md transition-all"
                    onClick={() => openEvent(ev)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{ev.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={ev.type === "group" ? "secondary" : "outline"} className="capitalize">
                            {ev.type === "group" ? <Users className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                            {ev.type}{ev.type === "group" ? ` (${ev.participantsRequired})` : ""}
                          </Badge>
                          {reg && (
                            <Badge className="bg-teal-100 text-teal-700 border-teal-200">
                              <Check className="h-3 w-3 mr-1" /> Registered
                            </Badge>
                          )}
                        </div>
                        {reg && (
                          <p className="text-xs text-gray-500 mt-1">
                            {reg.students?.map((s) => s.name).join(", ")}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ── VIEW: REGISTER ─────────────────────────────────────────────────────
  if (view === VIEW.REGISTER && selectedEvent) {
    const ev = selectedEvent;
    const cat = CATEGORIES[ev.category];
    const eligible = eligibleStudents(ev.category);

    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <Button variant="ghost" onClick={() => { setView(VIEW.EVENTS); setSelectedEvent(null); }}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {cat.label} Events
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{ev.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={ev.type === "group" ? "secondary" : "outline"}>
                  {ev.type === "group" ? <Users className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                  {ev.type}{ev.type === "group" ? ` — ${ev.participantsRequired} required` : ""}
                </Badge>
                <Badge variant="outline">{cat.label}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {selectedIds.size}{ev.type === "group" ? `/${ev.participantsRequired}` : ""} selected
              </span>
              <Button
                onClick={handleSave}
                disabled={!canSave || saving}
                className="bg-teal-700 hover:bg-teal-800 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Registration
              </Button>
            </div>
          </div>

          {eligible.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-gray-400">
                No eligible students for this category.
                {dobCutoff(ev.category) && (
                  <p className="text-xs mt-1">
                    Cutoff: born on or after {new Date(dobCutoff(ev.category)).toLocaleDateString("en-IN")}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Admission No.</TableHead>
                      <TableHead>DOB</TableHead>
                      <TableHead>Events (Ind/Grp)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eligible.map((s) => {
                      const isSelected = selectedIds.has(s.id);
                      const counts = studentEventCounts(s.id);
                      const indLimit = counts.individual >= 3;
                      const grpLimit = counts.group >= 2;
                      const blocked =
                        !selectedIds.has(s.id) &&
                        ((ev.type === "individual" && indLimit) ||
                          (ev.type === "group" && grpLimit));

                      return (
                        <TableRow
                          key={s.id}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-teal-50 border-l-4 border-l-teal-500"
                              : blocked
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-gray-50"
                          }`}
                          onClick={() => !blocked && toggleStudent(s.id)}
                        >
                          <TableCell>
                            {isSelected && (
                              <div className="h-5 w-5 rounded-full bg-teal-500 flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{s.fullName || s.name}</TableCell>
                          <TableCell className="text-gray-500">{s.admissionNumber}</TableCell>
                          <TableCell className="text-gray-500 text-sm">
                            {s.dateOfBirth
                              ? typeof s.dateOfBirth === "string"
                                ? new Date(s.dateOfBirth).toLocaleDateString("en-IN")
                                : s.dateOfBirth?.toDate?.()?.toLocaleDateString("en-IN") || "—"
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <span className={counts.individual >= 3 ? "text-red-500" : "text-gray-500"}>
                              {counts.individual}/3
                            </span>
                            {" · "}
                            <span className={counts.group >= 2 ? "text-red-500" : "text-gray-500"}>
                              {counts.group}/2
                            </span>
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

  return null;
}
