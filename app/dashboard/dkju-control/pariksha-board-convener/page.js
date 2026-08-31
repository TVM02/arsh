"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/authUtils";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Edit,
  Trash2,
  UserCheck,
  Phone,
  Mail,
  Calendar,
  Save,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  COLLECTIONS,
} from "@/lib/firestoreService";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

// Helper function to format dates
const formatDate = (dateValue) => {
  if (!dateValue) return "Not available";

  try {
    if (dateValue && typeof dateValue.toDate === "function") {
      return dateValue.toDate().toLocaleDateString();
    }

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return "Invalid date";
    }

    return date.toLocaleDateString();
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Date error";
  }
};

export default function ParikshaBoardConvenerManagement() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [conveners, setConveners] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConvener, setEditingConvener] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConvenerPasswords, setShowConvenerPasswords] = useState({});

  const toggleConvenerPassword = (id) => {
    setShowConvenerPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    loginId: "",
    password: "",
    isActive: true,
  });

  // Fetch all conveners
  const fetchConveners = useCallback(async () => {
    try {
      setLoading(true);
      const convenerQuery = query(collection(db, "pariksha_board_convener"));
      const snapshot = await getDocs(convenerQuery);
      const convenerList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setConveners(convenerList);
    } catch (error) {
      console.error("Error fetching conveners:", error);
      setError("Failed to fetch Pariksha Board Conveners");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConveners();
  }, [fetchConveners]);

  // Filter conveners based on search term
  const filteredConveners = conveners.filter(
    (convener) =>
      convener.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      convener.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      convener.phone?.includes(searchTerm),
  );

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      loginId: "",
      password: "",
      isActive: true,
    });
    setShowPassword(false);
    setEditingConvener(null);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate form
      if (!formData.name || !formData.email || !formData.phone) {
        throw new Error("Please fill in all required fields, including phone number");
      }

      if (
        !editingConvener &&
        (!formData.loginId.trim() || !formData.password.trim())
      ) {
        throw new Error("Login ID and password are required for new conveners");
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error("Please enter a valid email address");
      }

      // Phone validation
      if (!/^\d{10,15}$/.test(formData.phone.replace(/\D/g, ""))) {
        throw new Error("Please enter a valid phone number (10-15 digits)");
      }

      if (editingConvener) {
        // Update existing convener
        const updateData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          isActive: formData.isActive,
          updatedAt: new Date(),
        };

        if (formData.password.trim()) {
          updateData.password = formData.password.trim();
        }
        if (formData.loginId.trim()) {
          updateData.loginId = formData.loginId.trim();
        }

        // Atomic: update both collections together so they can never end up
        // out of sync if one write succeeds and the other fails.
        const updateBatch = writeBatch(db);
        updateBatch.update(
          doc(db, "pariksha_board_convener", editingConvener.id),
          updateData,
        );
        if (editingConvener.convenerDocId) {
          updateBatch.update(
            doc(db, "conveners", editingConvener.convenerDocId),
            updateData,
          );
        }
        await updateBatch.commit();

        toast.success("Convener updated successfully");
      } else {
        const convenerData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          loginId: formData.loginId.trim(),
          password: formData.password.trim(),
          isActive: formData.isActive,
          createdAt: new Date(),
          role: "pariksha_board_convener",
          status: "active",
        };

        // Atomic: pre-allocate both doc IDs client-side, then write all three
        // operations (create pariksha_board_convener, create conveners,
        // back-link) in a single batch. Previously these were three separate
        // sequential awaits — if the 2nd or 3rd write failed for any reason,
        // the 1st had already committed, leaving an orphaned half-created
        // record and reporting a false "failed to save" even though a
        // convener document now existed (and would collide/confuse on retry).
        const pbRef = doc(collection(db, "pariksha_board_convener"));
        const convRef = doc(collection(db, "conveners"));

        const createBatch = writeBatch(db);
        createBatch.set(pbRef, {
          ...convenerData,
          convenerDocId: convRef.id,
        });
        createBatch.set(convRef, {
          ...convenerData,
          pbConvenerId: pbRef.id,
        });
        await createBatch.commit();

        toast.success("Convener created successfully");
      }

      // Reset form and close dialog
      resetForm();
      setIsDialogOpen(false);

      // Refresh the list
      fetchConveners();
    } catch (error) {
      console.error("Error saving convener:", error);
      toast.error(error.message || "Failed to save convener");
      setError(error.message || "Failed to save convener");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = (convener) => {
    setEditingConvener(convener);
    setFormData({
      name: convener.name || "",
      email: convener.email || "",
      phone: convener.phone || "",
      loginId: convener.loginId || "",
      password: "",
      isActive: convener.isActive !== false,
    });
    setIsDialogOpen(true);
  };

  // Handle delete
  const handleDelete = async (convenerId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this convener? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "pariksha_board_convener", convenerId));
      toast.success("Convener deleted successfully");
      fetchConveners();
    } catch (error) {
      console.error("Error deleting convener:", error);
      toast.error("Failed to delete convener");
    }
  };

  // Handle toggle active status
  const handleToggleStatus = async (convener) => {
    try {
      await updateDoc(doc(db, "pariksha_board_convener", convener.id), {
        isActive: !convener.isActive,
        updatedAt: new Date(),
      });
      toast.success(
        `Convener ${convener.isActive ? "deactivated" : "activated"} successfully`,
      );
      fetchConveners();
    } catch (error) {
      console.error("Error updating convener status:", error);
      toast.error("Failed to update convener status");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Pariksha Board Conveners...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Pariksha Board Convener Management
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Manage Pariksha Board Convener accounts and permissions
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto"
                onClick={resetForm}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Convener
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-white">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingConvener ? "Edit Convener" : "Add New Convener"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingConvener
                      ? "Update the convener information below."
                      : "Fill in the details to create a new Pariksha Board Convener account."}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="Enter full name"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="Enter email address"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      placeholder="Enter phone number"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="loginId">Login ID *</Label>
                    <Input
                      id="loginId"
                      value={formData.loginId}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          loginId: e.target.value,
                        }))
                      }
                      placeholder="Enter unique login ID (e.g. conv001)"
                      required={!editingConvener}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="password">
                      {editingConvener
                        ? "New Password (leave blank to keep existing)"
                        : "Password *"}
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                        placeholder={
                          editingConvener
                            ? "Leave blank to keep existing password"
                            : "Enter password"
                        }
                        required={!editingConvener}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          isActive: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="isActive" className="text-sm">
                      Active (can login and access dashboard)
                    </Label>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setIsDialogOpen(false);
                      setError("");
                    }}
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting
                      ? editingConvener
                        ? "Updating..."
                        : "Creating..."
                      : editingConvener
                        ? "Update"
                        : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Label htmlFor="search" className="sr-only">
                Search
              </Label>
              <Input
                id="search"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Conveners Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Pariksha Board Conveners ({filteredConveners.length})
            </CardTitle>
            <CardDescription>
              Manage accounts for Pariksha Board Conveners who oversee exam
              registrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredConveners.length === 0 ? (
              <div className="text-center py-8">
                <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  {conveners.length === 0
                    ? "No conveners created yet"
                    : "No conveners match your search"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Phone
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Created
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConveners.map((convener) => (
                      <TableRow key={convener.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            <UserCheck className="h-4 w-4 text-orange-600" />
                            <span>{convener.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2 text-sm">
                            <Mail className="h-3 w-3 text-gray-400" />
                            <span className="break-all">{convener.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="inline-flex items-center gap-1.5 bg-gray-100 rounded-md px-2 py-1 min-w-[90px]">
                            <span className="font-mono text-xs text-gray-800 flex-1">
                              {showConvenerPasswords[convener.id]
                                ? convener.password || "—"
                                : "••••••••"}
                            </span>
                            {convener.password && (
                              <button
                                type="button"
                                title={showConvenerPasswords[convener.id] ? "Hide password" : "Show password"}
                                className="shrink-0 rounded p-0.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors"
                                onClick={() => toggleConvenerPassword(convener.id)}
                              >
                                {showConvenerPasswords[convener.id] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {convener.phone ? (
                            <div className="flex items-center space-x-2 text-sm">
                              <Phone className="h-3 w-3 text-gray-400" />
                              <span>{convener.phone}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              convener.isActive !== false
                                ? "default"
                                : "secondary"
                            }
                            className={
                              convener.isActive !== false ? "bg-green-600" : ""
                            }
                          >
                            {convener.isActive !== false
                              ? "Active"
                              : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-gray-500">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(convener.createdAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleStatus(convener)}
                            >
                              {convener.isActive !== false
                                ? "Deactivate"
                                : "Activate"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(convener)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(convener.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
    </Layout>
  );
}
