"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  UserCheck,
  Search,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  addDoc,
  updateDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, getAuth as getClientAuth } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { cn } from "@/lib/utils";

export default function ParikshaBoardConvenerManagementPage() {
  const { user, userData } = useAuthStore();
  
  const getSecondaryAuth = () => {
    const secondaryName = "secondary-auth";
    const existing = getApps().find((a) => a.name === secondaryName);
    const appForAuth =
      existing || initializeApp(auth.app.options, secondaryName);
    return getClientAuth(appForAuth);
  };

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [conveners, setConveners] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConvener, setEditingConvener] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [convenerToDelete, setConvenerToDelete] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    isActive: true,
  });

  const fetchConveners = useCallback(async () => {
    try {
      setLoading(true);
      const convenersQuery = query(
        collection(db, "pariksha_board_convener"),
        orderBy("createdAt", "desc")
      );
      const convenersSnapshot = await getDocs(convenersQuery);
      const convenersData = convenersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setConveners(convenersData);
    } catch (error) {
      console.error("Error fetching conveners:", error);
      toast.error("Failed to fetch pariksha board conveners");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConveners();
  }, [fetchConveners]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSwitchChange = (checked) => {
    setFormData((prev) => ({
      ...prev,
      isActive: checked,
    }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      isActive: true,
    });
    setEditingConvener(null);
    setShowPassword(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!formData.phone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    if (!/^\d{10,15}$/.test(formData.phone.replace(/\D/g, ""))) {
      toast.error("Please enter a valid phone number (10-15 digits)");
      return;
    }
    if (!editingConvener && !formData.password.trim()) {
      toast.error("Password is required for new convener");
      return;
    }
    if (!editingConvener && formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setSubmitting(true);

      if (editingConvener) {
        // Update existing convener
        const convenerRef = doc(db, "pariksha_board_convener", editingConvener.id);
        const updateData = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          isActive: formData.isActive,
          updatedAt: Timestamp.now(),
        };

        // Only update password if provided
        if (formData.password.trim()) {
          updateData.password = formData.password.trim();
        }

        await updateDoc(convenerRef, updateData);
        toast.success("Pariksha board convener updated successfully");
      } else {
        // Create new convener - First create Firebase Auth user
        let firebaseAuthUid = null;
        try {
          const secondaryAuth = getSecondaryAuth();
          const userCredential = await createUserWithEmailAndPassword(
            secondaryAuth,
            formData.email.trim(),
            formData.password.trim()
          );
          firebaseAuthUid = userCredential.user.uid;
          await secondaryAuth.signOut();
        } catch (authError) {
          console.error("Firebase Auth error:", authError);
          if (authError.code === "auth/email-already-in-use") {
            toast.error("Email is already registered");
          } else {
            toast.error("Failed to create authentication account");
          }
          return;
        }

        // Then create Firestore document
        const newConvenerData = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          password: formData.password.trim(),
          role: "pariksha_board_convener",
          isActive: formData.isActive,
          firebaseAuthUid: firebaseAuthUid,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          authCreatedAt: Timestamp.now(),
        };

        // Atomic: create in both collections so that login works via all portals
        const pbRef = doc(collection(db, "pariksha_board_convener"));
        const convRef = doc(collection(db, "conveners"));

        const createBatch = writeBatch(db);
        createBatch.set(pbRef, {
          ...newConvenerData,
          convenerDocId: convRef.id,
        });
        createBatch.set(convRef, {
          ...newConvenerData,
          pbConvenerId: pbRef.id,
        });
        await createBatch.commit();
        toast.success("Pariksha board convener created successfully");
      }

      fetchConveners();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving convener:", error);
      toast.error(
        editingConvener
          ? "Failed to update convener"
          : "Failed to create convener"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (convener) => {
    setEditingConvener(convener);
    setFormData({
      name: convener.name || "",
      email: convener.email || "",
      phone: convener.phone || "",
      password: "", // Don't populate password for security
      isActive: convener.isActive !== undefined ? convener.isActive : true,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (convener) => {
    setConvenerToDelete(convener);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!convenerToDelete) return;

    try {
      await deleteDoc(doc(db, "pariksha_board_convener", convenerToDelete.id));
      toast.success("Pariksha board convener deleted successfully");
      fetchConveners();
    } catch (error) {
      console.error("Error deleting convener:", error);
      toast.error("Failed to delete convener");
    } finally {
      setDeleteConfirmOpen(false);
      setConvenerToDelete(null);
    }
  };

  const handleDialogOpenChange = (open) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const filteredConveners = conveners.filter((convener) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      convener.name?.toLowerCase().includes(searchLower) ||
      convener.email?.toLowerCase().includes(searchLower) ||
      convener.phone?.includes(searchTerm)
    );
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
            <p className="text-gray-600">Loading conveners...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Pariksha Board Conveners
            </h1>
            <p className="text-gray-600 mt-1">
              Manage pariksha board convener accounts and permissions
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Convener
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-white">
              <DialogHeader>
                <DialogTitle>
                  {editingConvener ? "Edit Convener" : "Add New Convener"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter email address"
                    required
                    disabled={editingConvener} // Can't change email after creation
                  />
                  {editingConvener && (
                    <p className="text-xs text-gray-500 mt-1">
                      Email cannot be changed after creation
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Enter phone number"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">
                    Password {!editingConvener && "*"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder={
                        editingConvener
                          ? "Leave blank to keep current password"
                          : "Enter password (min 6 characters)"
                      }
                      required={!editingConvener}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="isActive">Active Status</Label>
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={handleSwitchChange}
                    className="data-[state=checked]:bg-teal-600 data-[state=unchecked]:bg-gray-200"
                  />
                </div>

                <DialogFooter className="gap-2 sm:space-x-0 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDialogOpenChange(false)}
                    disabled={submitting}
                    className="border-teal-600 text-teal-600 hover:bg-teal-50 w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-auto"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        {editingConvener ? "Updating..." : "Creating..."}
                      </>
                    ) : editingConvener ? (
                      "Update Convener"
                    ) : (
                      "Create Convener"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="md:col-span-3">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Conveners
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {conveners.length}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {conveners.filter((c) => c.isActive).length} active
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Conveners List */}
        <Card>
          <CardHeader>
            <CardTitle>All Conveners</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredConveners.length === 0 ? (
              <div className="text-center py-12">
                <UserCheck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">
                  {searchTerm
                    ? "No conveners found matching your search"
                    : "No pariksha board conveners yet"}
                </p>
                {!searchTerm && (
                  <Button
                    onClick={() => setIsDialogOpen(true)}
                    className="mt-4 bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Convener
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredConveners.map((convener) => (
                      <tr key={convener.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                              <UserCheck className="h-5 w-5 text-purple-600" />
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">
                                {convener.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {convener.email}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {convener.phone}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Badge
                            variant={convener.isActive ? "default" : "secondary"}
                            className={cn(
                              convener.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            )}
                          >
                            {convener.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {convener.createdAt?.toDate
                              ? new Date(
                                  convener.createdAt.toDate()
                                ).toLocaleDateString()
                              : "N/A"}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(convener)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(convener)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Convener</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-semibold">{convenerToDelete?.name}</span>?
                This action cannot be undone and will permanently remove the
                convener account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700"
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
