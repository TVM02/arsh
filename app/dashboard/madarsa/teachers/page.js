"use client";

import { useState, useEffect, useCallback } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Search, Edit, Trash2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  deleteDoc,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import useAuthStore from "@/lib/authStore";

export default function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    mhrId: "",
    qualification: "",
    degree: "",
    moallimTraining: false,
    moallimTrainingDetails: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDocs, setLastDocs] = useState({});
  const [hasMore, setHasMore] = useState(true);
  const [totalTeachers, setTotalTeachers] = useState(0);
  const ITEMS_PER_PAGE = 10;
  const { user, userData } = useAuthStore();

  const fetchStats = async () => {
    if (!userData?.madarsaId) return;
    try {
      const { getCount } = await import("@/lib/firestoreService");
      const count = await getCount("teachers", [
        where("madarsaId", "==", userData.madarsaId),
        where("status", "!=", "deleted"),
      ]);
      setTotalTeachers(count);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchTeachers = useCallback(
    async (page = 1) => {
      if (!userData?.madarsaId) return;

      try {
        setLoading(true);
        const { getPaginatedDocuments, getDocuments } = await import(
          "@/lib/firestoreService"
        );

        const constraints = [
          where("madarsaId", "==", userData.madarsaId),
          where("status", "!=", "deleted"),
        ];

        let results = [];

        if (searchTerm) {
          // Client-side search optimization: Fetch all active for madarsa then filter
          // This avoids complex composite indexes for search fields
          const allDocs = await getDocuments("teachers", constraints);
          const filtered = allDocs.filter(
            (teacher) =>
              teacher.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              teacher.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              teacher.mhrId?.toLowerCase().includes(searchTerm.toLowerCase())
          );

          // Client-side pagination for search results
          const start = (page - 1) * ITEMS_PER_PAGE;
          const end = start + ITEMS_PER_PAGE;
          results = filtered.slice(start, end);
          setHasMore(end < filtered.length);
          // Update total for search context
          // setTotalTeachers(filtered.length); // Optional: update badge to show found count?
          // Keeping badge as "Total Teachers" in db is usually better, but for search...
          // let's leave totalTeachers as DB total, maybe show "Found X" separately.
        } else {
          // Server-side pagination
          const lastVisible = lastDocs[page - 1] || null;
          const { data, lastDoc } = await getPaginatedDocuments(
            "teachers",
            ITEMS_PER_PAGE,
            constraints,
            lastVisible
          );

          results = data;
          setHasMore(data.length === ITEMS_PER_PAGE);
          if (lastDoc) {
            setLastDocs((prev) => ({ ...prev, [page]: lastDoc }));
          }
        }

        setTeachers(results);
      } catch (error) {
        console.error("Error fetching teachers:", error);
        toast.error("Failed to fetch teachers");
      } finally {
        setLoading(false);
      }
    },
    [userData?.madarsaId, searchTerm, lastDocs]
  );

  useEffect(() => {
    if (userData?.madarsaId) {
      setCurrentPage(1);
      setLastDocs({});
      fetchTeachers(1);
      fetchStats();
    }
  }, [userData?.madarsaId, searchTerm]);
  // removed fetchTeachers dependency to avoid loop if used as dep

  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
    fetchTeachers(newPage);
  };

  const generatePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password }));
    return password;
  };

  const resetForm = () => {
    setFormData({
      id: "",
      name: "",
      email: "",
      password: "",
      phone: "",
      address: "",
      mhrId: "",
      qualification: "",
      degree: "",
      moallimTraining: false,
      moallimTrainingDetails: "",
    });
    setShowPassword(false);
  };

  const handleEdit = (teacher) => {
    setFormData({
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      password: "", // Don't show existing password
      phone: teacher.phone || "",
      address: teacher.address || "",
      mhrId: teacher.mhrId || "",
      qualification: teacher.qualification || "",
      degree: teacher.degree || "",
      moallimTraining: teacher.moallimTraining || false,
      moallimTrainingDetails: teacher.moallimTrainingDetails || "",
    });
    setIsDialogOpen(true);
  };

  const checkMsrIdExists = async (msrId, excludeTeacherId = null) => {
    try {
      const teachersQuery = query(
        collection(db, "teachers"),
        where("mhrId", "==", msrId)
      );
      const snapshot = await getDocs(teachersQuery);

      if (excludeTeacherId) {
        // For updates, exclude the current teacher from the check
        return snapshot.docs.some((doc) => doc.id !== excludeTeacherId);
      }

      return !snapshot.empty;
    } catch (error) {
      console.error("Error checking MSR ID:", error);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Check for MSR ID uniqueness if provided
      if (formData.mhrId) {
        const msrExists = await checkMsrIdExists(formData.mhrId, formData.id);
        if (msrExists) {
          toast.error("MSR Number already exists. Please contact Admin.");
          setSubmitting(false);
          return;
        }
      }

      const teacherData = {
        name: String(formData.name || "").trim().toUpperCase(),
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        mhrId: formData.mhrId,
        qualification: String(formData.qualification || "").trim().toUpperCase(),
        degree: String(formData.degree || "").trim().toUpperCase(),
        moallimTraining: formData.moallimTraining || false,
        moallimTrainingDetails: formData.moallimTrainingDetails || "",
        updatedAt: new Date(),
        madarsaId: userData.madarsaId || "madarsa-001",
      };

      if (formData.id) {
        // Update existing teacher
        if (formData.password) {
          teacherData.password = formData.password;
        }
        await updateDoc(doc(db, "teachers", formData.id), teacherData);
        toast.success("Teacher updated successfully!");
      } else {
        // Create new teacher
        let finalPassword = formData.password;
        if (!finalPassword) {
          finalPassword = generatePassword();
        }
        teacherData.password = finalPassword;
        teacherData.role = "teacher";
        teacherData.status = "active";
        teacherData.createdAt = new Date();

        // also include additional fields on create
        teacherData.qualification = String(formData.qualification || "").trim().toUpperCase();
        teacherData.degree = String(formData.degree || "").trim().toUpperCase();
        teacherData.moallimTraining = formData.moallimTraining || false;
        teacherData.moallimTrainingDetails =
          formData.moallimTrainingDetails || "";

        await addDoc(collection(db, "teachers"), teacherData);
        setShowPassword(true);
        toast.success("Teacher added successfully!");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchTeachers();
      window.location.reload();
    } catch (error) {
      console.error("Error saving teacher:", error);
      toast.error(error.message || "Failed to save teacher");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (teacherId, teacherName) => {
    if (
      window.confirm(`Are you sure you want to delete teacher ${teacherName}?`)
    ) {
      try {
        await deleteDoc(doc(db, "teachers", teacherId));
        toast.success("Teacher deleted successfully");
        fetchTeachers();
      } catch (error) {
        console.error("Error deleting teacher:", error);
        toast.error("Failed to delete teacher");
      }
    }
  };

  // Filter logic moved to fetchTeachers
  const filteredTeachers = teachers;

  return (
    <Layout user={user} role={userData?.role || user?.role}>
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
              Teachers Management
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
              Manage teacher accounts and credentials
            </p>
          </div>

          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto min-h-[44px] font-medium"
                onClick={resetForm}
              >
                <Plus className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>Add Teacher</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl bg-white max-h-[90vh] overflow-y-auto mx-auto">
              <DialogHeader className="pb-4">
                <DialogTitle className="text-lg sm:text-xl">
                  {formData.id ? "Edit Teacher" : "Add New Teacher"}
                </DialogTitle>
              </DialogHeader>

              {showPassword && formData.password && (
                <Alert className="bg-green-50 border-green-200 mb-4">
                  <AlertDescription className="space-y-3">
                    <p className="font-semibold text-green-800 text-sm sm:text-base">
                      {formData.id
                        ? "Teacher updated successfully!"
                        : "Teacher added successfully!"}
                    </p>
                    <div className="bg-white p-3 rounded border text-sm">
                      <p className="break-all">
                        <strong>Email:</strong> {formData.email}
                      </p>
                      <p className="break-all">
                        <strong>Password:</strong> {formData.password}
                      </p>
                    </div>
                    <p className="text-xs sm:text-sm text-green-700">
                      Please share these credentials with the teacher securely.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium">
                      Full Name *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="mt-1 h-10 sm:h-9"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium">
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="mt-1 h-10 sm:h-9"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-1">
                      <Input
                        id="password"
                        type="text"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        className="h-10 sm:h-9 flex-1"
                        placeholder={
                          formData.id
                            ? "Leave empty to keep current"
                            : "Leave empty to auto-generate"
                        }
                      />
                      {!formData.id && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => generatePassword()}
                          className="h-10 sm:h-9 px-3 text-sm whitespace-nowrap"
                        >
                          Generate
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="mhrId" className="text-sm font-medium">
                      MSR ID
                    </Label>
                    <Input
                      id="mhrId"
                      value={formData.mhrId}
                      onChange={(e) =>
                        setFormData({ ...formData, mhrId: e.target.value })
                      }
                      className="mt-1 h-10 sm:h-9"
                      placeholder="Enter MSR ID (optional)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium">
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="mt-1 h-10 sm:h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address" className="text-sm font-medium">
                      Address
                    </Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      className="mt-1 h-10 sm:h-9"
                      placeholder="Enter address"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label
                      htmlFor="qualification"
                      className="text-sm font-medium"
                    >
                      Qualification
                    </Label>
                    <Input
                      id="qualification"
                      value={formData.qualification}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          qualification: e.target.value,
                        })
                      }
                      className="mt-1 h-10 sm:h-9"
                      placeholder="e.g. B.Ed, M.A"
                    />
                  </div>
                  <div>
                    <Label htmlFor="degree" className="text-sm font-medium">
                      Degree
                    </Label>
                    <Input
                      id="degree"
                      value={formData.degree}
                      onChange={(e) =>
                        setFormData({ ...formData, degree: e.target.value })
                      }
                      className="mt-1 h-10 sm:h-9"
                      placeholder="e.g. BA, BSc"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <Label className="text-sm font-medium">
                    Moallim Training
                  </Label>
                  <div className="flex items-center space-x-3 mt-2">
                    <Button
                      type="button"
                      variant={
                        !formData.moallimTraining ? "default" : "outline"
                      }
                      onClick={() =>
                        setFormData({ ...formData, moallimTraining: true })
                      }
                      className="min-h-[36px] px-3"
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      variant={formData.moallimTraining ? "default" : "outline"}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          moallimTraining: false,
                          moallimTrainingDetails: "",
                        })
                      }
                      className="min-h-[36px] px-3"
                    >
                      No
                    </Button>
                  </div>

                  {formData.moallimTraining && (
                    <div className="mt-3">
                      <Label
                        htmlFor="moallimTrainingDetails"
                        className="text-sm font-medium"
                      >
                        If yes, what training?
                      </Label>
                      <Input
                        id="moallimTrainingDetails"
                        value={formData.moallimTrainingDetails}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            moallimTrainingDetails: e.target.value,
                          })
                        }
                        className="mt-1 h-10 sm:h-9"
                        placeholder="Describe the training"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-teal-600 hover:bg-teal-700 min-h-[44px] font-medium flex-1 sm:flex-none"
                  >
                    {submitting
                      ? formData.id
                        ? "Updating..."
                        : "Adding..."
                      : formData.id
                      ? "Update Teacher"
                      : "Add Teacher"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="min-h-[44px] font-medium flex-1 sm:flex-none"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search teachers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 sm:h-9"
            />
          </div>
          <Badge
            variant="secondary"
            className="self-start sm:self-center px-3 py-1 text-sm"
          >
            {totalTeachers} teachers
          </Badge>
        </div>

        {/* Teachers List */}
        {loading ? (
          <div className="text-center py-8 sm:py-10 md:py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-teal-600 border-t-transparent mx-auto"></div>
            <p className="text-gray-600 mt-4 text-sm sm:text-base">
              Loading teachers...
            </p>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 sm:py-10 md:py-12">
              <p className="text-gray-600 text-sm sm:text-base">
                No teachers found.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {filteredTeachers.map((teacher) => (
              <Card
                key={teacher.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4 sm:p-5 md:p-6">
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-4">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                          {teacher.name}
                        </h3>
                        <Badge
                          variant={
                            teacher.status === "active"
                              ? "default"
                              : "secondary"
                          }
                          className={`self-start sm:self-center text-xs ${
                            teacher.status === "active"
                              ? "bg-green-100 text-green-800"
                              : ""
                          }`}
                        >
                          {teacher.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 text-sm">
                        <div className="flex items-center space-x-2 min-w-0">
                          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{teacher.email}</span>
                        </div>

                        {teacher.password && (
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-gray-400 flex-shrink-0">
                              Password:
                            </span>
                            <span className="truncate font-medium">
                              {teacher.password}
                            </span>
                          </div>
                        )}

                        {teacher.mhrId && (
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-gray-400 flex-shrink-0">
                              MSR ID:
                            </span>
                            <span className="truncate font-medium">
                              {teacher.mhrId}
                            </span>
                          </div>
                        )}

                        {teacher.phone && (
                          <div className="flex items-center space-x-2 min-w-0">
                            <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{teacher.phone}</span>
                          </div>
                        )}

                        {teacher.address && (
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-gray-400 flex-shrink-0">
                              Address:
                            </span>
                            <span className="truncate">{teacher.address}</span>
                          </div>
                        )}

                        {teacher.qualification && (
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-gray-400 flex-shrink-0">
                              Qualification:
                            </span>
                            <span className="truncate font-medium">
                              {teacher.qualification}
                            </span>
                          </div>
                        )}

                        {teacher.degree && (
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-gray-400 flex-shrink-0">
                              Degree:
                            </span>
                            <span className="truncate font-medium">
                              {teacher.degree}
                            </span>
                          </div>
                        )}

                        {typeof teacher.moallimTraining !== "undefined" && (
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-gray-400 flex-shrink-0">
                              Moallim Training:
                            </span>
                            <span className="truncate font-medium">
                              {teacher.moallimTraining ? "Yes" : "No"}
                            </span>
                          </div>
                        )}

                        {teacher.moallimTraining &&
                          teacher.moallimTrainingDetails && (
                            <div className="flex items-center space-x-2 min-w-0">
                              <span className="text-gray-400 flex-shrink-0">
                                Training Details:
                              </span>
                              <span className="truncate">
                                {teacher.moallimTrainingDetails}
                              </span>
                            </div>
                          )}

                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="text-gray-400 flex-shrink-0">
                            Added:
                          </span>
                          <span className="truncate">
                            {teacher.createdAt?.toDate
                              ? teacher.createdAt.toDate().toLocaleDateString()
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2 lg:ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(teacher)}
                        className="flex-1 lg:flex-none min-h-[36px] text-xs sm:text-sm"
                      >
                        <Edit className="w-4 h-4 mr-1 lg:mr-0" />
                        <span className="lg:hidden">Edit</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(teacher.id, teacher.name)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-1 lg:flex-none min-h-[36px] text-xs sm:text-sm"
                      >
                        <Trash2 className="w-4 h-4 mr-1 lg:mr-0" />
                        <span className="lg:hidden">Delete</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {teachers.length > 0 && !searchTerm && (
          <div className="flex justify-between items-center mt-4">
            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="flex items-center gap-2"
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">Page {currentPage}</span>
            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasMore || loading}
              className="flex items-center gap-2"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
