"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Bell,
  Edit,
  Trash2,
  Search,
  Eye,
  AlertCircle,
  Building,
} from "lucide-react";
import { toast } from "sonner";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/authUtils";
import Layout from "@/components/Layout";

const formatDate = (value) => {
  if (!value) return "N/A";
  try {
    if (typeof value?.toDate === "function") return value.toDate().toLocaleDateString("en-IN");
    return new Date(value).toLocaleDateString("en-IN");
  } catch {
    return "N/A";
  }
};

export default function SadarNoticesPage() {
  const { user, userData } = useAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", content: "" });
  const [saving, setSaving] = useState(false);

  // View dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingNotice, setViewingNotice] = useState(null);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all notices that came from sadar portal (madarsa_admin or type = local/sadar)
      const q = query(
        collection(db, "notices"),
        orderBy("createdAt", "desc"),
      );
      const snapshot = await getDocs(q);
      const allNotices = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Filter: sadar notices are those NOT from central_admin, or where sender is madarsa_admin / type is local
      const sadarNotices = allNotices.filter(
        (n) =>
          n.sender === "madarsa_admin" ||
          n.type === "local" ||
          n.type === "sadar" ||
          (n.type !== "central" && n.madarsaId) ||
          (!n.type && n.madarsaId),
      );

      setNotices(sadarNotices);
    } catch (err) {
      console.error("Error fetching sadar notices:", err);
      toast.error("Failed to fetch Sadar notices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const filteredNotices = notices.filter(
    (n) =>
      n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.madarsaId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.createdByName?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const openEdit = (notice) => {
    setEditingNotice(notice);
    setEditForm({ title: notice.title || "", content: notice.content || "" });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "notices", editingNotice.id), {
        title: editForm.title.trim(),
        content: editForm.content.trim(),
        updatedAt: new Date(),
        updatedBy: user?.uid,
        updatedByName: userData?.name || "Central Admin",
      });
      toast.success("Notice updated successfully");
      setEditDialogOpen(false);
      setEditingNotice(null);
      fetchNotices();
    } catch (err) {
      console.error("Error updating notice:", err);
      toast.error("Failed to update notice");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "notices", id));
      toast.success("Notice deleted successfully");
      setDeleteConfirmId(null);
      fetchNotices();
    } catch (err) {
      console.error("Error deleting notice:", err);
      toast.error("Failed to delete notice");
    } finally {
      setDeleting(false);
    }
  };

  const getPriorityBadge = (priority) => {
    const map = {
      high: "bg-red-100 text-red-700",
      medium: "bg-yellow-100 text-yellow-700",
      low: "bg-green-100 text-green-700",
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[priority] || "bg-gray-100 text-gray-600"}`}>
        {priority || "N/A"}
      </span>
    );
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-6 text-white">
          <div className="flex items-center gap-3">
            <Building className="h-7 w-7" />
            <div>
              <h1 className="text-2xl font-bold">Sadar Notices</h1>
              <p className="text-purple-100 text-sm mt-1">
                View, edit and delete notices published by Sadar portals
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by title, content, madrasa ID, or author..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Sadar Notices ({filteredNotices.length})
            </CardTitle>
            <CardDescription>
              Notices published by Sadar (Madrasa Admin) portals — you can edit or delete them
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : filteredNotices.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No Sadar notices found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead className="hidden md:table-cell">Madrasa / Author</TableHead>
                      <TableHead className="hidden sm:table-cell">Priority</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotices.map((notice) => (
                      <TableRow key={notice.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium truncate max-w-[200px]">{notice.title}</p>
                            <p className="whitespace-pre-wrap text-xs text-gray-500 truncate max-w-[200px]">
                              {notice.content}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-gray-600">
                          <div>
                            {notice.madarsaId && (
                              <p className="text-xs font-mono">{notice.madarsaId}</p>
                            )}
                            <p className="text-xs">{notice.createdByName || "Unknown"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {getPriorityBadge(notice.priority)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-gray-500">
                          {formatDate(notice.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setViewingNotice(notice);
                                setViewDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(notice)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setDeleteConfirmId(notice.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-600" />
              {viewingNotice?.title}
            </DialogTitle>
          </DialogHeader>
          {viewingNotice && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs text-gray-500">Content</Label>
                <p className="mt-1 text-sm whitespace-pre-wrap">{viewingNotice.content}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-gray-500">Author</Label>
                  <p className="mt-1">{viewingNotice.createdByName || "Unknown"}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Madrasa ID</Label>
                  <p className="mt-1 font-mono">{viewingNotice.madarsaId || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Priority</Label>
                  <p className="mt-1">{viewingNotice.priority || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Date</Label>
                  <p className="mt-1">{formatDate(viewingNotice.createdAt)}</p>
                </div>
                {viewingNotice.expiryDate && (
                  <div>
                    <Label className="text-xs text-gray-500">Expires</Label>
                    <p className="mt-1">{formatDate(viewingNotice.expiryDate)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
            <Button onClick={() => { setViewDialogOpen(false); openEdit(viewingNotice); }}>
              <Edit className="h-4 w-4 mr-2" />Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-purple-600" />
              Edit Sadar Notice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Notice title"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={editForm.content}
                onChange={(e) => setEditForm((p) => ({ ...p, content: e.target.value }))}
                placeholder="Notice content..."
                rows={5}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleSaveEdit}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Notice
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Are you sure you want to delete this notice? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(deleteConfirmId)}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
