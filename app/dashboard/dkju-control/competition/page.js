"use client";

import { useState, useEffect, useCallback } from "react";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trophy,
  Plus,
  Edit,
  Trash2,
  Users,
  User,
  Calendar,
  Eye,
  EyeOff,
  Save,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCompetitionConfig,
  saveCompetitionConfig,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from "@/lib/competitionService";
import { CATEGORIES, CATEGORY_ORDER, EVENT_TYPES } from "@/lib/competitionUtils";

// ─── default config shape ────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  categories: {
    senior:    { dobCutoff: "" },
    higher:    { dobCutoff: "" },
    junior:    { dobCutoff: "" },
    subJunior: { dobCutoff: "" },
  },
  portalVisibility: {
    sadar:    false,
    mekhala:  false,
    district: false,
    state:    false,
  },
};

const PORTAL_LABELS = {
  sadar:    "Sadar Portal",
  mekhala:  "Mekhala Portal",
  district: "District Portal",
  state:    "State Portal",
};

const BLANK_EVENT = {
  name: "",
  category: "",
  type: "individual",
  participantsRequired: "",
};

// ─── component ───────────────────────────────────────────────────────────
export default function CompetitionAdminPage() {
  const { user, userData } = useAuthStore();

  const [config, setConfig]         = useState(DEFAULT_CONFIG);
  const [events, setEvents]         = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [savingConfig, setSavingConfig]   = useState(false);

  // event modal
  const [eventDialog, setEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState(BLANK_EVENT);
  const [savingEvent, setSavingEvent] = useState(false);

  // ── fetch config ──────────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const data = await getCompetitionConfig();
      if (data) {
        setConfig({
          categories: { ...DEFAULT_CONFIG.categories, ...data.categories },
          portalVisibility: { ...DEFAULT_CONFIG.portalVisibility, ...data.portalVisibility },
        });
      }
    } catch {
      toast.error("Failed to load competition config");
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  // ── fetch events ──────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const data = await getEvents();
      setEvents(data);
    } catch {
      toast.error("Failed to load events");
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchEvents();
  }, [fetchConfig, fetchEvents]);

  // ── save config ───────────────────────────────────────────────────────
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await saveCompetitionConfig(config, user?.uid);
      toast.success("Configuration saved");
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSavingConfig(false);
    }
  };

  // ── category DOB cutoff change ─────────────────────────────────────────
  const handleDobChange = (categoryKey, value) => {
    setConfig((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [categoryKey]: { ...prev.categories[categoryKey], dobCutoff: value },
      },
    }));
  };

  // ── portal visibility toggle ──────────────────────────────────────────
  const handleVisibilityToggle = (portalKey) => {
    setConfig((prev) => ({
      ...prev,
      portalVisibility: {
        ...prev.portalVisibility,
        [portalKey]: !prev.portalVisibility[portalKey],
      },
    }));
  };

  // ── event modal open ──────────────────────────────────────────────────
  const openCreateEvent = () => {
    setEditingEvent(null);
    setEventForm(BLANK_EVENT);
    setEventDialog(true);
  };

  const openEditEvent = (ev) => {
    setEditingEvent(ev);
    setEventForm({
      name: ev.name,
      category: ev.category,
      type: ev.type,
      participantsRequired: ev.participantsRequired ?? "",
    });
    setEventDialog(true);
  };

  // ── save event ────────────────────────────────────────────────────────
  const handleSaveEvent = async () => {
    if (!eventForm.name.trim() || !eventForm.category) {
      toast.error("Name and category are required");
      return;
    }
    if (eventForm.type === "group" && !eventForm.participantsRequired) {
      toast.error("Participant count required for group events");
      return;
    }

    setSavingEvent(true);
    try {
      const payload = {
        name: eventForm.name.trim(),
        category: eventForm.category,
        type: eventForm.type,
        participantsRequired:
          eventForm.type === "group"
            ? Number(eventForm.participantsRequired)
            : null,
      };

      if (editingEvent) {
        await updateEvent(editingEvent.id, payload);
        toast.success("Event updated");
      } else {
        await createEvent(payload, user?.uid);
        toast.success("Event created");
      }

      setEventDialog(false);
      await fetchEvents();
    } catch {
      toast.error("Failed to save event");
    } finally {
      setSavingEvent(false);
    }
  };

  // ── delete event ──────────────────────────────────────────────────────
  const handleDeleteEvent = async (ev) => {
    if (!confirm(`Delete event "${ev.name}"? This cannot be undone.`)) return;
    try {
      await deleteEvent(ev.id);
      toast.success("Event deleted");
      await fetchEvents();
    } catch {
      toast.error("Failed to delete event");
    }
  };

  // ── helpers ───────────────────────────────────────────────────────────
  const eventsByCategory = CATEGORY_ORDER.reduce((acc, key) => {
    acc[key] = events.filter((e) => e.category === key);
    return acc;
  }, {});

  // ─── render ────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <Trophy className="h-6 w-6 text-teal-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Competition{" "}
              <span className="text-teal-700 font-arabic text-xl">
                التنافس
              </span>
            </h1>
            <p className="text-sm text-gray-500">
              Configure categories, events, and portal access
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="events">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="categories">Categories & Eligibility</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="visibility">Portal Visibility</TabsTrigger>
          </TabsList>

          {/* ── TAB 1: Categories ── */}
          <TabsContent value="categories" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  DOB Cutoff Per Category
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Students born{" "}
                  <span className="font-medium">on or after</span> this date are
                  eligible for that category.
                </p>
              </CardHeader>
              <CardContent>
                {loadingConfig ? (
                  <div className="flex items-center gap-2 text-gray-400 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2">
                    {CATEGORY_ORDER.map((key) => {
                      const cat = CATEGORIES[key];
                      return (
                        <div key={key} className="space-y-1.5">
                          <Label htmlFor={`dob-${key}`} className="font-medium">
                            {cat.label}
                            <span className="ml-2 text-xs text-gray-400 font-normal font-arabic">
                              {cat.labelAr}
                            </span>
                          </Label>
                          <Input
                            id={`dob-${key}`}
                            type="date"
                            value={config.categories[key]?.dobCutoff ?? ""}
                            onChange={(e) => handleDobChange(key, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="bg-teal-700 hover:bg-teal-800"
              >
                {savingConfig ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Configuration
              </Button>
            </div>
          </TabsContent>

          {/* ── TAB 2: Events ── */}
          <TabsContent value="events" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">
                {events.length} event{events.length !== 1 ? "s" : ""} configured
              </p>
              <Button
                onClick={openCreateEvent}
                className="bg-teal-700 hover:bg-teal-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            </div>

            {loadingEvents ? (
              <div className="flex items-center gap-2 text-gray-400 py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading events…
              </div>
            ) : events.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-gray-400">
                  No events yet. Click &quot;Add Event&quot; to create one.
                </CardContent>
              </Card>
            ) : (
              CATEGORY_ORDER.filter((k) => eventsByCategory[k].length > 0).map(
                (key) => (
                  <Card key={key}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold uppercase tracking-wide text-teal-700">
                        {CATEGORIES[key].label}
                        <span className="ml-2 font-arabic font-normal text-gray-400 normal-case tracking-normal">
                          {CATEGORIES[key].labelAr}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Event Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Participants</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {eventsByCategory[key].map((ev) => (
                            <TableRow key={ev.id}>
                              <TableCell className="font-medium">
                                {ev.name}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    ev.type === "group"
                                      ? "secondary"
                                      : "outline"
                                  }
                                  className="capitalize"
                                >
                                  {ev.type === "group" ? (
                                    <Users className="h-3 w-3 mr-1" />
                                  ) : (
                                    <User className="h-3 w-3 mr-1" />
                                  )}
                                  {EVENT_TYPES[ev.type]}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {ev.type === "group"
                                  ? ev.participantsRequired
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditEvent(ev)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteEvent(ev)}
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
                ),
              )
            )}
          </TabsContent>

          {/* ── TAB 3: Portal Visibility ── */}
          <TabsContent value="visibility" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Show Competition Menu In
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Toggle the Competition menu on or off for each portal.
                </p>
              </CardHeader>
              <CardContent>
                {loadingConfig ? (
                  <div className="flex items-center gap-2 text-gray-400 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.keys(PORTAL_LABELS).map((key) => {
                      const enabled = config.portalVisibility[key] ?? false;
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-lg border p-4"
                        >
                          <div className="flex items-center gap-3">
                            {enabled ? (
                              <Eye className="h-4 w-4 text-teal-600" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            )}
                            <div>
                              <p className="font-medium text-sm">
                                {PORTAL_LABELS[key]}
                              </p>
                              <p className="text-xs text-gray-400">
                                {enabled
                                  ? "Competition menu is visible"
                                  : "Competition menu is hidden"}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={enabled}
                            onCheckedChange={() => handleVisibilityToggle(key)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="bg-teal-700 hover:bg-teal-800"
              >
                {savingConfig ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Visibility Settings
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Event Create / Edit Dialog ── */}
      <Dialog open={eventDialog} onOpenChange={setEventDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? "Edit Event" : "Create Event"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Event Name *</Label>
              <Input
                placeholder="e.g. Qiraat, Group Dance"
                value={eventForm.name}
                onChange={(e) =>
                  setEventForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select
                value={eventForm.category}
                onValueChange={(v) =>
                  setEventForm((f) => ({ ...f, category: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((key) => (
                    <SelectItem key={key} value={key}>
                      {CATEGORIES[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Event Type *</Label>
              <Select
                value={eventForm.type}
                onValueChange={(v) =>
                  setEventForm((f) => ({
                    ...f,
                    type: v,
                    participantsRequired: v === "individual" ? "" : f.participantsRequired,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" /> Individual
                    </div>
                  </SelectItem>
                  <SelectItem value="group">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" /> Group
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Participants (group only) */}
            {eventForm.type === "group" && (
              <div className="space-y-1.5">
                <Label>Number of Participants Required *</Label>
                <Input
                  type="number"
                  min="2"
                  max="50"
                  placeholder="e.g. 5"
                  value={eventForm.participantsRequired}
                  onChange={(e) =>
                    setEventForm((f) => ({
                      ...f,
                      participantsRequired: e.target.value,
                    }))
                  }
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setEventDialog(false)}
                disabled={savingEvent}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEvent}
                disabled={savingEvent}
                className="bg-teal-700 hover:bg-teal-800"
              >
                {savingEvent && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {editingEvent ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
