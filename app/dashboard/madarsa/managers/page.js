"use client";

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
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
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Eye,
  EyeOff,
  RefreshCw,
  UserCheck,
  Mail,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/authFetch";

const generatePassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!";
  return Array.from({ length: 12 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join("");
};

export default function ManagersPage() {
  const { userData } = useAuthStore();
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    password: "",
    phone: "",
    address: "",
    institutionName: "",
  });

  const madarsaId = userData?.madarsaId;
  const madarsaName = userData?.madarsaName;

  const fetchManagers = async () => {
    if (!madarsaId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "managers"),
        where("madarsaId", "==", madarsaId),
      );
      const snap = await getDocs(q);
      setManagers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load managers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [madarsaId]);

  const handleAutoGenerate = () => {
    setFormData((prev) => ({ ...prev, password: generatePassword() }));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formData.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim() || !formData.password) {
      toast.error("Name, phone, and password are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch("/api/admin/create-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          password: formData.password,
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          institutionName: formData.institutionName.trim(),
          madarsaId,
          madarsaName,
          createdBy: userData?.email || userData?.phone || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create manager.");
        return;
      }
      toast.success(`Manager "${formData.name}" created successfully.`);
      setIsDialogOpen(false);
      setFormData({
        name: "",
        password: "",
        phone: "",
        address: "",
        institutionName: "",
      });
      fetchManagers();
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (manager) => {
    const newStatus = manager.status === "active" ? "inactive" : "active";
    try {
      await updateDoc(doc(db, "managers", manager.id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      toast.success(
        `Manager ${newStatus === "active" ? "activated" : "deactivated"}.`,
      );
      fetchManagers();
    } catch {
      toast.error("Failed to update status.");
    }
  };

  return (
    <ProtectedRoute allowedRoles={["madarsa_admin"]}>
      <Layout>
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Managers</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage portal access for {madarsaName}
              </p>
            </div>
            <Button
              onClick={() => {
                setFormData({
                  name: "",
                  password: "",
                  phone: "",
                  address: "",
                  institutionName: "",
                });
                setIsDialogOpen(true);
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Manager
            </Button>
          </div>

          {/* Stats card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-gray-500">Total Managers</p>
                <p className="text-2xl font-bold text-teal-700">
                  {managers.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {managers.filter((m) => m.status === "active").length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-gray-500">Inactive</p>
                <p className="text-2xl font-bold text-red-500">
                  {managers.filter((m) => m.status !== "active").length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Managers list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-teal-600" />
                Manager List
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-gray-400 text-sm py-8 text-center">
                  Loading…
                </p>
              ) : managers.length === 0 ? (
                <div className="text-center py-12">
                  <UserCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No managers added yet.</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Click &quot;Add Manager&quot; to create the first one.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500 text-xs uppercase tracking-wide">
                        <th className="text-left py-2 pr-4">#</th>
                        <th className="text-left py-2 pr-4">Name</th>
                        <th className="text-left py-2 pr-4">Phone</th>
                        <th className="text-left py-2 pr-4">Institution</th>
                        <th className="text-left py-2 pr-4">Status</th>
                        <th className="text-left py-2 pr-4">Created</th>
                        <th className="text-left py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {managers.map((m, idx) => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 text-gray-400">{idx + 1}</td>
                          <td className="py-3 pr-4 font-medium text-gray-900">
                            {m.name}
                          </td>
                          <td className="py-3 pr-4 text-gray-600">
                            {m.phone && (
                              <div className="flex items-center gap-1 font-medium">
                                {m.phone}
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-gray-600 text-sm">
                            {m.institutionName || (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge
                              className={
                                m.status === "active"
                                  ? "bg-green-100 text-green-700 border-green-200"
                                  : "bg-red-100 text-red-700 border-red-200"
                              }
                            >
                              {m.status || "active"}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 text-gray-400 text-xs">
                            {m.createdAt
                              ? new Date(m.createdAt).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleStatus(m)}
                              className={
                                m.status === "active"
                                  ? "text-red-600 border-red-200 hover:bg-red-50 text-xs"
                                  : "text-green-600 border-green-200 hover:bg-green-50 text-xs"
                              }
                            >
                              {m.status === "active"
                                ? "Deactivate"
                                : "Activate"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add Manager Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-teal-600" />
                Add New Manager
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-800">
                <strong>Madrasa:</strong> {madarsaName} —{" "}
                <span className="text-xs text-teal-600">
                  This manager will be auto-assigned to your madrasa.
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="m-name">Full Name *</Label>
                <Input
                  id="m-name"
                  placeholder="Manager's full name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="m-phone">Phone Number *</Label>
                <Input
                  id="m-phone"
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="m-address">Address</Label>
                <Input
                  id="m-address"
                  placeholder="Home / office address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="m-institution">Institution Name</Label>
                <Input
                  id="m-institution"
                  placeholder="School / institution name"
                  value={formData.institutionName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      institutionName: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="m-password">
                  Password *
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    (min. 8 characters)
                  </span>
                </Label>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="m-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Set a password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {formData.password && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleCopy}
                      title="Copy password"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoGenerate}
                  className="gap-2 text-teal-700 border-teal-300 hover:bg-teal-50 mt-1"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Auto-generate Password
                </Button>
                {formData.password && (
                  <p className="text-xs text-gray-500">
                    Share this password with the manager securely.
                  </p>
                )}
              </div>

              <Alert className="bg-amber-50 border-amber-200">
                <AlertDescription className="text-xs text-amber-800">
                  The manager will use the phone number and password above to sign in
                  at <strong>Management Portal</strong> on the portals page.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                  disabled={submitting}
                >
                  {submitting ? "Creating…" : "Create Manager"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  );
}
