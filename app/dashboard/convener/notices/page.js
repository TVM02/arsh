"use client";

import { useState, useEffect, useCallback } from "react";
import useAuthStore from "@/lib/authStore";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Trash2,
  Edit,
  Bell,
  Send,
  Calendar,
  Eye,
  Search,
  X,
  Loader2,
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
import { db, auth } from "@/lib/firebase";
import { getAuthorizedDistricts } from "@/lib/convenerData";
import { fetchMadarsasByDistricts, madrasaMatchesDistrict } from "@/lib/madrasaHierarchy";
import { toast } from "sonner";

export default function MekhalaNotices() {
  const { user, userData } = useAuthStore();
  const [notices, setNotices] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [madarsas, setMadarsas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [sourceFilter, setSourceFilter] = useState("all"); // 'all' | 'convener' | 'central_admin'
  const [madarsaSearchTerm, setMadarsaSearchTerm] = useState("");

  // Form states
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    content: "",
    priority: "medium",
    targetType: "all", // 'all', 'specific_districts', 'specific_madarsas'
    targetDistricts: [],
    targetMadarsas: [],
    expiryDate: "",
    showOnDashboard: true,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const mekhalaId = userData?.uid || userData?.id;
      if (!mekhalaId) {
        // console.log('No mekhala ID found, skipping data fetch');
        setLoading(false);
        return;
      }

      // Determine assigned districts using unified logic
      let districtsData = await getAuthorizedDistricts(userData, db);

      setDistricts(districtsData);

      // Get district names for filtering madarsas (using district names instead of IDs)
      const districtNames = districtsData.map((d) => d.name);

      // Fetch madarsas in these districts — use the shared alias-aware
      // district matcher (and its cached fetch) so this list stays
      // consistent with the rest of the portal.
      if (districtNames.length > 0) {
        const candidateMadarsas = await fetchMadarsasByDistricts(db, query, collection, where, getDocs, districtNames);
        const filteredMadarsas = candidateMadarsas.filter((madarsa) =>
          districtNames.some(dn => {
            try { return madrasaMatchesDistrict(madarsa, dn); } catch { return false; }
          })
        );
        setMadarsas(filteredMadarsas);
      }

      // Fetch notices created by this convener
      const myNoticesQ = query(
        collection(db, "notices"),
        where("createdBy", "==", mekhalaId)
      );
      // Fetch notices from central admin targeted at conveners
      const centralQ = query(
        collection(db, "notices"),
        where("sender", "==", "central_admin")
      );
      // Fetch notices targeted specifically at convener portal
      const convenerTargetedQ = query(
        collection(db, "notices"),
        where("targetAudience", "==", "convener")
      );

      const [mySnap, centralSnap, convenerSnap] = await Promise.all([
        getDocs(myNoticesQ),
        getDocs(centralQ),
        getDocs(convenerTargetedQ),
      ]);

      const myNotices = mySnap.docs.map((doc) => ({
        id: doc.id, source: "convener", ...doc.data(),
      }));
      const centralNotices = centralSnap.docs
        .map((doc) => ({
          id: doc.id, source: "central_admin", ...doc.data(),
        }))
        .filter((notice) => {
          const audience = String(notice.targetAudience || "").toLowerCase();
          return audience === "all" || audience === "convener";
        });
      const convenerTargetedNotices = convenerSnap.docs.map((doc) => ({
        id: doc.id, source: "central_admin", ...doc.data(),
      }));

      // Merge, deduplicating by id
      const allMap = new Map();
      [...centralNotices, ...convenerTargetedNotices, ...myNotices].forEach((n) =>
        allMap.set(n.id, n)
      );
      const noticesData = Array.from(allMap.values()).sort((a, b) => {
        const aT = a.createdAt?.seconds || (a.createdAt?.toDate ? a.createdAt.toDate().getTime() / 1000 : 0);
        const bT = b.createdAt?.seconds || (b.createdAt?.toDate ? b.createdAt.toDate().getTime() / 1000 : 0);
        return bT - aT;
      });
      setNotices(noticesData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [userData?.uid, userData?.id]);

  useEffect(() => {
    if (userData?.uid) {
      fetchData();
    }
  }, [userData?.uid, userData?.id, fetchData]); // Depend on both possible ID fields

  const resetForm = () => {
    setNoticeForm({
      title: "",
      content: "",
      priority: "medium",
      targetType: "all",
      targetDistricts: [],
      targetMadarsas: [],
      expiryDate: "",
      showOnDashboard: true,
    });
    setEditingNotice(null);
    setMadarsaSearchTerm("");
  };



  // Filter madarsas based on search term
  const filteredMadarsas = madarsas.filter(
    (madarsa) =>
      madarsa.name?.toLowerCase().includes(madarsaSearchTerm.toLowerCase()) ||
      madarsa.madarsaId
        ?.toLowerCase()
        .includes(madarsaSearchTerm.toLowerCase()) ||
      madarsa.district?.toLowerCase().includes(madarsaSearchTerm.toLowerCase())
  );

  // Get selected madarsa objects for display
  const selectedMadarsas = madarsas.filter((madarsa) =>
    noticeForm.targetMadarsas.includes(madarsa.id)
  );

  // Remove madarsa from selection
  const removeMadarsa = (madarsaId) => {
    setNoticeForm((prev) => ({
      ...prev,
      targetMadarsas: prev.targetMadarsas.filter((id) => id !== madarsaId),
    }));
  };

  const validateForm = () => {
    if (!noticeForm.title.trim()) {
      toast.error("Title is required");
      return false;
    }
    if (!noticeForm.content.trim()) {
      toast.error("Content is required");
      return false;
    }
    if (
      noticeForm.targetType === "specific_districts" &&
      noticeForm.targetDistricts.length === 0
    ) {
      toast.error("Please select at least one mekhala");
      return false;
    }
    if (
      noticeForm.targetType === "specific_madarsas" &&
      noticeForm.targetMadarsas.length === 0
    ) {
      toast.error("Please select at least one madarsa");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      // Prepare target data based on target type
      let finalTargetDistricts = noticeForm.targetDistricts;
      let finalTargetMadarsas = noticeForm.targetMadarsas;

      // If target type is "all", include all districts and madarsas
      if (noticeForm.targetType === "all") {
        finalTargetDistricts = districts.map((d) => d.id);
        finalTargetMadarsas = madarsas.map((m) => m.id);
      }

      // Append names to finalTargetDistricts for portals searching by district string name
      if (finalTargetDistricts && finalTargetDistricts.length > 0) {
        const selectedNames = districts
          .filter((d) => finalTargetDistricts.includes(d.id))
          .map((d) => d.name)
          .filter(Boolean);
        finalTargetDistricts = [...new Set([...finalTargetDistricts, ...selectedNames])];
      }

      const noticeData = {
        title: noticeForm.title.trim(),
        content: noticeForm.content.trim(),
        priority: noticeForm.priority,
        targetType: noticeForm.targetType,
        targetDistricts: finalTargetDistricts,
        targetMadarsas: finalTargetMadarsas,
        // Additional metadata for "all" target type
        allDistrictsCount:
          noticeForm.targetType === "all" ? districts.length : null,
        allMadarsasCount:
          noticeForm.targetType === "all" ? madarsas.length : null,
        expiryDate: noticeForm.expiryDate
          ? new Date(noticeForm.expiryDate)
          : null,
        showOnDashboard: noticeForm.showOnDashboard,
        createdBy: userData?.uid || user?.uid,
        createdByName:
          userData?.name || userData?.displayName || "Mekhala Admin",
        createdByRole: "convener_admin",
        mekhalaId: userData?.uid || user?.uid,
        deleted: false,
        updatedAt: serverTimestamp(),
      };

      if (editingNotice) {
        await updateDoc(doc(db, "notices", editingNotice.id), {
          ...noticeData,
          createdAt: editingNotice.createdAt, // Keep original creation date
        });
        toast.success("Notice updated successfully");
      } else {
        noticeData.createdAt = serverTimestamp();
        await addDoc(collection(db, "notices"), noticeData);
        toast.success("Notice created and sent successfully");
      }

      setIsCreateDialogOpen(false);
      resetForm();
      fetchData();
      window.location.reload();
    } catch (error) {
      console.error("Error saving notice:", error);
      toast.error("Failed to save notice");
    }
  };

  const handleEdit = (notice) => {
    setEditingNotice(notice);
    setNoticeForm({
      title: notice.title,
      content: notice.content,
      priority: notice.priority || "medium",
      targetType: notice.targetType || "all",
      targetDistricts: notice.targetDistricts || [],
      targetMadarsas: notice.targetMadarsas || [],
      expiryDate: notice.expiryDate
        ? new Date(notice.expiryDate.toDate()).toISOString().split("T")[0]
        : "",
      showOnDashboard: notice.showOnDashboard ?? true,
    });
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async (noticeId) => {
    if (!confirm("Are you sure you want to delete this notice?")) return;

    try {
      await updateDoc(doc(db, "notices", noticeId), {
        deleted: true,
        deletedAt: serverTimestamp(),
      });
      toast.success("Notice deleted successfully");
      fetchData();
    } catch (error) {
      console.error("Error deleting notice:", error);
      toast.error("Failed to delete notice");
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "low":
        return "bg-teal-100 text-teal-700 border-teal-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getTargetDescription = (notice) => {
    if (notice.targetType === "all") {
      const districtCount =
        notice.allDistrictsCount ||
        notice.targetDistricts?.length ||
        districts.length;
      const madarsaCount =
        notice.allMadarsasCount ||
        notice.targetMadarsas?.length ||
        madarsas.length;
      return {
        type: "text",
        content: `All mekhalas (${districtCount}) and madarsas (${madarsaCount}) in mekhala`,
      };
    } else if (notice.targetType === "specific_districts") {
      const selectedDistricts = districts.filter((d) =>
        notice.targetDistricts?.includes(d.id)
      );
      return {
        type: "text",
        content: `Mekhalas: ${selectedDistricts
          .map((d) => d.name)
          .join(", ")}`,
      };
    } else if (notice.targetType === "specific_madarsas") {
      const selectedMadarsas = madarsas.filter((m) =>
        notice.targetMadarsas?.includes(m.id)
      );
      return {
        type: "pills",
        content: selectedMadarsas,
        label: "Madrasas",
      };
    }
    return { type: "text", content: "Unknown target" };
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
        </div>
      </Layout>
    );
  }

  const formatContentWithLinks = (content) => {
    if (!content) return "";
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-600 hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notice Management</h1>
            <p className="text-gray-600">
              Send notices to madarsas within your mekhala
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Managing {districts.length} mekhalas with {madarsas.length}{" "}
              madarsas
            </p>
          </div>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Create Notice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
              <DialogHeader>
                <DialogTitle>
                  {editingNotice ? "Edit Notice" : "Create New Notice"}
                </DialogTitle>
                <DialogDescription>
                  {editingNotice
                    ? "Update notice information"
                    : "Send a notice to madarsas in your mekhala"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title*</Label>
                  <Input
                    id="title"
                    value={noticeForm.title}
                    onChange={(e) =>
                      setNoticeForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Enter notice title"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="content">Content*</Label>
                  <Textarea
                    id="content"
                    value={noticeForm.content}
                    onChange={(e) =>
                      setNoticeForm((prev) => ({
                        ...prev,
                        content: e.target.value,
                      }))
                    }
                    placeholder="Enter notice content"
                    rows={4}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={noticeForm.priority}
                      onValueChange={(value) =>
                        setNoticeForm((prev) => ({ ...prev, priority: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="expiry">Expiry Date</Label>
                    <Input
                      id="expiry"
                      type="date"
                      value={noticeForm.expiryDate}
                      onChange={(e) =>
                        setNoticeForm((prev) => ({
                          ...prev,
                          expiryDate: e.target.value,
                        }))
                      }
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                </div>

                <div>
                  <Label>Target Audience</Label>
                  <Select
                    value={noticeForm.targetType}
                    onValueChange={(value) =>
                      setNoticeForm((prev) => ({
                        ...prev,
                        targetType: value,
                        targetDistricts: [],
                        targetMadarsas: [],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select target" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">
                        All mekhalas in my mekhala
                      </SelectItem>
                      <SelectItem value="specific_districts">
                        Specific mekhalas
                      </SelectItem>
                      <SelectItem value="specific_madarsas">
                        Specific madarsas
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {noticeForm.targetType === "specific_districts" && (
                  <div>
                    <Label>Select Mekhalas</Label>
                    <div className="border rounded p-3 max-h-32 overflow-y-auto">
                      {districts.map((district) => (
                        <div
                          key={district.id}
                          className="flex items-center space-x-2 py-1"
                        >
                          <input
                            type="checkbox"
                            id={`district-${district.id}`}
                            checked={noticeForm.targetDistricts.includes(
                              district.id
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNoticeForm((prev) => ({
                                  ...prev,
                                  targetDistricts: [
                                    ...prev.targetDistricts,
                                    district.id,
                                  ],
                                }));
                              } else {
                                setNoticeForm((prev) => ({
                                  ...prev,
                                  targetDistricts: prev.targetDistricts.filter(
                                    (id) => id !== district.id
                                  ),
                                }));
                              }
                            }}
                          />
                          <label
                            htmlFor={`district-${district.id}`}
                            className="text-sm"
                          >
                            {district.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {noticeForm.targetType === "specific_madarsas" && (
                  <div className="space-y-4">
                    <Label>Select Madrasas</Label>

                    {/* Selected Madrasas Pills */}
                    {selectedMadarsas.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">
                          Selected Madrasas ({selectedMadarsas.length}):
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedMadarsas.map((madarsa) => (
                            <Badge
                              key={madarsa.id}
                              variant="secondary"
                              className="bg-teal-100 text-teal-800 px-3 py-1 flex items-center gap-2"
                            >
                              <span className="text-sm">{madarsa.name}</span>
                              <button
                                type="button"
                                onClick={() => removeMadarsa(madarsa.id)}
                                className="hover:bg-teal-200 rounded-full p-1 transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search madarsas by name, ID, or district..."
                        value={madarsaSearchTerm}
                        onChange={(e) => setMadarsaSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Madarsas List */}
                    <div className="border rounded-lg">
                      <div className="max-h-48 overflow-y-auto">
                        {filteredMadarsas.length > 0 ? (
                          <div className="p-2 space-y-1">
                            {filteredMadarsas.map((madarsa) => (
                              <div
                                key={madarsa.id}
                                className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  id={`madarsa-${madarsa.id}`}
                                  checked={noticeForm.targetMadarsas.includes(
                                    madarsa.id
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNoticeForm((prev) => ({
                                        ...prev,
                                        targetMadarsas: [
                                          ...prev.targetMadarsas,
                                          madarsa.id,
                                        ],
                                      }));
                                    } else {
                                      removeMadarsa(madarsa.id);
                                    }
                                  }}
                                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                />
                                <label
                                  htmlFor={`madarsa-${madarsa.id}`}
                                  className="flex-1 cursor-pointer"
                                >
                                  <div className="text-sm font-medium text-gray-900">
                                    {madarsa.name}
                                  </div>
                                  <div className="text-xs text-gray-500 flex items-center gap-2">
                                    <span>ID: {madarsa.madarsaId}</span>
                                    <span>•</span>
                                    <span>{madarsa.district}</span>
                                  </div>
                                </label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            {madarsaSearchTerm ? (
                              <>
                                <div className="text-sm">
                                  No madarsas found for &quot;
                                  {madarsaSearchTerm}&quot;
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setMadarsaSearchTerm("")}
                                  className="text-xs text-teal-600 hover:text-teal-800 mt-1"
                                >
                                  Clear search
                                </button>
                              </>
                            ) : (
                              <div className="text-sm">
                                No madarsas available
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    {filteredMadarsas.length > 0 && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const unselectedMadarsas = filteredMadarsas.filter(
                              (m) => !noticeForm.targetMadarsas.includes(m.id)
                            );
                            if (unselectedMadarsas.length > 0) {
                              setNoticeForm((prev) => ({
                                ...prev,
                                targetMadarsas: [
                                  ...prev.targetMadarsas,
                                  ...unselectedMadarsas.map((m) => m.id),
                                ],
                              }));
                            }
                          }}
                          disabled={filteredMadarsas.every((m) =>
                            noticeForm.targetMadarsas.includes(m.id)
                          )}
                        >
                          Select All Visible
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setNoticeForm((prev) => ({
                              ...prev,
                              targetMadarsas: [],
                            }));
                          }}
                          disabled={noticeForm.targetMadarsas.length === 0}
                        >
                          Clear All
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showOnDashboard"
                    checked={noticeForm.showOnDashboard}
                    onChange={(e) =>
                      setNoticeForm((prev) => ({
                        ...prev,
                        showOnDashboard: e.target.checked,
                      }))
                    }
                  />
                  <Label htmlFor="showOnDashboard">Show on dashboard</Label>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    <Send className="h-4 w-4 mr-2" />
                    {editingNotice ? "Update" : "Send"} Notice
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notices ({notices.filter((n) => !n.deleted && (sourceFilter === "all" || n.source === sourceFilter)).length})
            </CardTitle>
            <CardDescription>
              Manage notices sent to madarsas in your convener area
            </CardDescription>
            {/* Source filter */}
            <div className="flex gap-2 flex-wrap mt-3">
              {[
                { value: "all", label: "All Notices" },
                { value: "convener", label: "My Notices" },
                { value: "central_admin", label: "From Central Admin" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setSourceFilter(f.value)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    sourceFilter === f.value
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {notices.filter((n) => !n.deleted && (sourceFilter === "all" || n.source === sourceFilter)).length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No notices found
                </h3>
                <p className="text-gray-500 mb-4">
                  {sourceFilter === "all" ? "Start by creating your first notice" : "No notices from this source"}
                </p>
                {sourceFilter === "all" && (
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Notice
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notices
                    .filter((n) => !n.deleted && (sourceFilter === "all" || n.source === sourceFilter))
                    .map((notice) => (
                      <TableRow key={notice.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {formatContentWithLinks(notice.title)}
                            </div>
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {formatContentWithLinks(notice.content)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs ${
                              notice.source === "central_admin"
                                ? "bg-teal-100 text-teal-800 border-teal-200"
                                : "bg-teal-100 text-teal-800 border-teal-200"
                            }`}
                          >
                            {notice.source === "central_admin" ? "Central Admin" : "My Notice"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPriorityColor(notice.priority)}>
                            {notice.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {(() => {
                              const targetInfo = getTargetDescription(notice);
                              if (targetInfo.type === "pills") {
                                return (
                                  <div className="space-y-2">
                                    <div className="text-xs text-gray-600">
                                      {targetInfo.label}:
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {targetInfo.content
                                        .slice(0, 3)
                                        .map((madarsa) => (
                                          <Badge
                                            key={madarsa.id}
                                            variant="outline"
                                            className="text-xs bg-teal-50 text-teal-700 border-teal-200"
                                          >
                                            {madarsa.name}
                                          </Badge>
                                        ))}
                                      {targetInfo.content.length > 3 && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs bg-gray-50 text-gray-600"
                                        >
                                          +{targetInfo.content.length - 3} more
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              return targetInfo.content;
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {notice.showOnDashboard && (
                              <Badge variant="outline" className="text-xs">
                                Dashboard
                              </Badge>
                            )}
                            {notice.expiryDate && (
                              <div className="text-xs text-gray-500">
                                Expires:{" "}
                                {new Date(
                                  notice.expiryDate.toDate()
                                ).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {notice.createdAt?.toDate?.()?.toLocaleDateString() ||
                            "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {notice.source === "convener" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(notice)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDelete(notice.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Badge variant="outline" className="text-xs text-gray-500">
                                Read-only
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
