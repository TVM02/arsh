"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { profileImageSrc } from "@/lib/utils";
import ProfileImage from "@/components/ProfileImage";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Eye,
  Check,
  X,
  Phone,
  Calendar,
  MapPin,
  User,
  Search,
  BookOpen,
  GraduationCap,
  School,
  Home,
  ChevronLeft,
  ChevronRight,
  Trash2,
  RotateCcw,
} from "lucide-react";

import {
  createDocument,
  updateDocument,
  deleteDocument,
  getDocuments,
  COLLECTIONS,
} from "@/lib/firestoreService";
import useAuthStore from "@/lib/authStore";
import Image from "next/image";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  writeBatch,
  serverTimestamp,
  runTransaction,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  fetchFilteredApplications,
  getApplicationsCount,
  searchApplications,
} from "@/lib/applicationQueries";

function ApplicationDetails({ application }) {
  const [isLoading, setIsLoading] = useState(true);

  const formatDate = (dateString) => {
    if (!dateString) return "Not specified";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Simulate loading state for better UX
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800); // 800ms delay to show skeleton

    return () => clearTimeout(timer);
  }, [application]);

  // Reset loading state when application changes
  useEffect(() => {
    setIsLoading(true);
  }, [application?.id]);

  console.log(application);

  if (isLoading) {
    return (
      <div className="w-full space-y-4 md:space-y-6">
        {/* Loading indicator with spinner */}
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent mr-3"></div>
          <span className="text-sm text-gray-600">
            Loading application details...
          </span>
        </div>

        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid grid-cols-3 gap-1 md:gap-2 mb-4 md:mb-6 rounded-lg bg-muted p-1 w-full">
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
          </TabsList>

          {/* Loading skeleton for content */}
          <div className="p-4 md:p-6 bg-background border rounded-lg space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </div>

            {/* Profile picture skeleton */}
            <div className="sm:col-span-2 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="w-[200px] h-[200px] rounded-md" />
            </div>
          </div>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid grid-cols-3 gap-1 md:gap-2 mb-4 md:mb-6 rounded-lg bg-muted p-1 w-full">
          <TabsTrigger
            value="personal"
            className="data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:shadow-sm py-2 rounded-md text-xs md:text-sm"
          >
            Personal
          </TabsTrigger>
          <TabsTrigger
            value="family"
            className="data-[state=active]:bg-background data-[state=active]:border-b-2  data-[state=active]:shadow-sm py-2 rounded-md text-xs md:text-sm"
          >
            Family
          </TabsTrigger>
          <TabsTrigger
            value="education"
            className="data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:shadow-sm py-2 rounded-md text-xs md:text-sm"
          >
            Education
          </TabsTrigger>
        </TabsList>

        {/* Personal Info */}
        <TabsContent value="personal">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 p-4 md:p-6 bg-background border rounded-lg">
            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                Full Name
              </Label>
              <p className="text-sm md:text-base font-medium">
                {application.fullName || "Not provided"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                Date of Birth
              </Label>
              <p className="text-sm md:text-base font-medium">
                {formatDate(application.dateOfBirth)}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                Gender
              </Label>
              <p className="text-sm md:text-base font-medium">
                {application.gender || "Not specified"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                Phone Number
              </Label>
              <p className="text-sm md:text-base font-medium">
                {application.phone || "Not provided"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                Aadhar Number
              </Label>
              <p className="text-sm md:text-base font-medium">
                {application.aadharNumber || "N/A"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                Payment ID
              </Label>
              <p className="text-sm md:text-base font-medium">
                {application.paymentId || "N/A"}
              </p>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                Address
              </Label>
              <p className="text-sm md:text-base font-medium">
                {application.address || "Address not available"}
              </p>
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                Profile Picture
              </Label>

              {application.profilePictureUrl || application.profilePicture ? (
                <div className="w-[200px] h-[200px] overflow-hidden rounded-md border">
                  <ProfileImage
                    src={
                      application.profilePictureUrl ||
                      application.profilePicture
                    }
                    sourceData={application}
                    alt="Profile Picture"
                    className="w-full h-full object-cover"
                    fallbackClassName="w-full h-full flex items-center justify-center"
                    iconClassName="h-12 w-12 text-gray-400"
                    showText={false}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center w-[200px] h-[200px] bg-muted rounded-md text-sm text-muted-foreground border">
                  No Image
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Family Info */}
        <TabsContent value="family">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 p-4 md:p-6 bg-background border rounded-lg">
            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                Guardian&apos;s Name
              </Label>
              <p className="text-sm md:text-base font-medium">
                {application.guardianName || "Not specified"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                Guardian&apos;s Phone
              </Label>
              <p className="text-sm md:text-base font-medium">
                {application.guardianPhone || "Not provided"}
              </p>
            </div>

            {application.guardianRelationship && (
              <div className="space-y-1">
                <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                  Relationship
                </Label>
                <p className="text-sm md:text-base font-medium">
                  {application.guardianRelationship}
                </p>
              </div>
            )}

            {application.pro}
          </div>
        </TabsContent>

        {/* Education Info */}
        <TabsContent value="education">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 p-4 md:p-6 bg-background border rounded-lg">
            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                Class Level
              </Label>
              <p className="text-sm md:text-base font-medium">
                {application.class || "Not specified"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                Previous Madrasa
              </Label>
              <p className="text-sm md:text-base font-medium">
                {application.previousSchool || "Not provided"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                Admission Number
              </Label>
              <p className="text-sm md:text-base font-medium">
                {application.admissionNumber || "Not assigned"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-muted-foreground">
                Madrasa
              </Label>
              <p className="text-sm md:text-base font-medium">
                {application.madarsa || "Not specified"}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ApplicationsManagement() {
  const { user, userData } = useAuthStore();

  // Optimized state management
  const [currentPageApplications, setCurrentPageApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage] = useState(20);
  const lastDocRef = useRef(null);

  const [selectedApplication, setSelectedApplication] = useState(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [studentCredentials, setStudentCredentials] = useState({
    email: "",
    password: "",
  });
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingApplication, setRejectingApplication] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [madarsaFilter, setMadarsaFilter] = useState("");

  // Load current page data with server-side filtering
  const loadPageData = useCallback(async () => {
    setLoadingPage(true);
    try {
      setError("");

      const filters = {
        status: statusFilter !== "all" ? statusFilter : null,
        madarsaId: madarsaFilter.trim() || null,
      };

      // If search term, use search function
      if (searchTerm && searchTerm.trim()) {
        const { applications, total } = await searchApplications(
          searchTerm,
          filters,
        );
        setTotalCount(total);
        setCurrentPageApplications(applications);
      } else {
        // Normal pagination
        const count = await getApplicationsCount(filters);
        setTotalCount(count);

        const { applications, lastVisible } = await fetchFilteredApplications(
          filters,
          itemsPerPage,
          currentPage > 1 ? lastDocRef.current : null,
        );

        lastDocRef.current = lastVisible;
        setCurrentPageApplications(applications);
      }
    } catch (error) {
      console.error("Error loading applications:", error);
      setError(error.message || "Failed to fetch applications");
    } finally {
      setLoadingPage(false);
      setLoading(false);
    }
  }, [statusFilter, currentPage, itemsPerPage, searchTerm, madarsaFilter]);

  useEffect(() => {
    if (user && userData) {
      loadPageData();
    }
  }, [user, userData, loadPageData]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
    lastDocRef.current = null;
  }, [searchTerm, statusFilter, madarsaFilter]);

  const handleApproveApplication = async (application) => {
    setApproveLoading(true);
    setError("");
    setSuccess("");

    if (!studentCredentials.email || !studentCredentials.password) {
      setError("Please provide email and password for the student");
      setApproveLoading(false);
      return;
    }

    try {
      // ── Atomically claim this application to prevent double-approval ──────
      // If SADAR and Central Admin click Approve simultaneously, only one
      // transaction wins; the other gets "already approved" and no duplicate
      // student / duplicate MID is ever created.
      const appRef = doc(db, "admissions", application.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(appRef);
        if (!snap.exists()) throw new Error("Application not found");
        if (snap.data().status === "approved")
          throw new Error("already_approved");
        tx.update(appRef, {
          status: "approved",
          approvedAt: new Date().toISOString(),
          approvedBy: user.uid,
        });
      });

      const studentId = `student_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      await createDocument(COLLECTIONS.USERS, studentId, {
        uid: studentId,
        email: studentCredentials.email.toLowerCase(),
        password: studentCredentials.password, // Store password in database
        fullName: application.fullName,
        role: "student",
        status: "active",
        createdAt: new Date().toISOString(),
        lastLogin: null,
        profileComplete: true,
        madarsaId: application.madarsa,
      });

      await createDocument(COLLECTIONS.STUDENTS, studentId, {
        uid: studentId,
        admissionId: application.id,
        admissionNumber: application.admissionNumber || "N/A",
        fullName: application.fullName,
        email: studentCredentials.email.toLowerCase(),
        password: studentCredentials.password, // Store password in database
        phone: application.phone,
        dateOfBirth: application.dateOfBirth,
        address: application.address,
        aadharNumber: application.aadharNumber || "N/A",
        guardianName: application.guardianName,
        guardianPhone: application.guardianPhone,
        previousEducation: application.previousSchool,
        madarsaId: application.madarsa,
        classLevel: application.class,
        admissionDate: new Date().toISOString(),
        status: "active",
        academicYear: new Date().getFullYear(),
        gender: application.gender,
        admissionNumber: application.admissionNumber,
        profilePicture:
          application.profilePicture || application.profilePictureUrl || null,
      });

      // Update application with the student UID (status already set in transaction)
      await updateDocument(COLLECTIONS.ADMISSIONS, application.id, {
        studentEmail: studentCredentials.email,
        studentUid: studentId,
      });

      setSuccess(
        `Student account created successfully! Email: ${studentCredentials.email}`,
      );
      setShowCredentialsDialog(false);
      setStudentCredentials({ email: "", password: "" });
      loadPageData();
    } catch (error) {
      console.error("Error approving application:", error);
      if (error.message === "already_approved") {
        setError(
          "This application has already been approved by another admin.",
        );
      } else {
        setError("Failed to approve application");
      }
    } finally {
      setApproveLoading(false);
    }
  };

  const handleRejectApplication = async (application, reason) => {
    // Guard: only reject the specific application passed
    if (!application?.id) {
      setError("Invalid application selected for rejection");
      return;
    }

    setRejectLoading(true);
    setError("");

    try {
      await updateDocument(COLLECTIONS.ADMISSIONS, application.id, {
        status: "rejected",
        rejectedAt: new Date().toISOString(),
        rejectedBy: user.uid,
        rejectionReason: reason || "",
      });

      setSuccess("Application rejected successfully");
      setRejectDialogOpen(false);
      setRejectingApplication(null);
      setRejectionReason("");

      // Reset cursor so reloading always starts from page 1 with fresh data.
      // Setting lastDocRef.current to null ensures fetchFilteredApplications
      // starts from the beginning regardless of what page the user was on.
      lastDocRef.current = null;
      setCurrentPage(1);
      // Explicitly reload since setCurrentPage(1) won't trigger useEffect
      // if the user was already on page 1.
      loadPageData();
    } catch (error) {
      console.error("Error rejecting application:", error);
      setError("Failed to reject application");
    } finally {
      setRejectLoading(false);
    }
  };

  const handleDeleteApplication = async (application) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the application of ${application.fullName}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setDeleteLoading(true);
    setError("");

    try {
      await updateDocument(COLLECTIONS.ADMISSIONS, application.id, {
        status: "deleted",
        deletedAt: new Date().toISOString(),
        deletedBy: user.uid,
      });
      setSuccess("Application deleted successfully");
      loadPageData();
    } catch (error) {
      console.error("Error deleting application:", error);
      setError("Failed to delete application");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteAllRejected = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete ALL rejected applications? This action cannot be undone.",
      )
    ) {
      return;
    }

    setDeleteLoading(true);
    setError("");

    try {
      const q = query(
        collection(db, COLLECTIONS.ADMISSIONS),
        where("status", "==", "rejected"),
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setSuccess("No rejected applications found to delete");
        setDeleteLoading(false);
        return;
      }

      const batch = writeBatch(db);
      const deletedAt = new Date().toISOString();
      const deletedBy = user.uid;

      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          status: "deleted",
          deletedAt,
          deletedBy,
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      setSuccess(`Successfully deleted ${snapshot.size} rejected applications`);
      loadPageData();
    } catch (error) {
      console.error("Error deleting all rejected applications:", error);
      setError("Failed to delete all rejected applications");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRestoreApplication = async (application) => {
    if (
      !window.confirm(
        `Are you sure you want to restore ${application.fullName}'s application back to pending?`,
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await updateDocument(COLLECTIONS.ADMISSIONS, application.id, {
        status: "pending",
        restoredAt: new Date().toISOString(),
        restoredBy: user.uid,
        // Reset createdAt to now so it sorts to the top (list orders by createdAt desc)
        createdAt: serverTimestamp(),
        rejectionReason: null,
        rejectedAt: null,
        rejectedBy: null,
      });
      setSuccess(
        `${application.fullName}'s application has been restored and moved to the top`,
      );
      // Switch to pending view, page 1 — the restored app will appear at the top
      setStatusFilter("pending");
      setCurrentPage(1);
      lastDocRef.current = null;
    } catch (error) {
      console.error("Error restoring application:", error);
      setError("Failed to restore application");
    }
  };

  const generateStudentEmail = (fullName, phone) => {
    const namePart = fullName
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(" ")
      .slice(0, 2)
      .join(".");
    const phonePart = phone
      ? phone.slice(-4)
      : Math.floor(1000 + Math.random() * 9000);
    return `${namePart}.${phonePart}@dkju.in`;
  };

  const generatePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Removed client-side filtering - now done server-side

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "confirmed":
        return <Badge variant="secondary">Pending Review</Badge>;
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case undefined:
      case null:
      case "":
        return <Badge variant="secondary">Pending</Badge>; // Treat missing status as pending
      default:
        return (
          <Badge variant="outline">
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pending"}
          </Badge>
        );
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString();
    }
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-4 md:p-6 text-white">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2">
            Student Applications
          </h1>
          <p className="text-sm md:text-base text-purple-100">
            Review and manage student admission applications
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col space-y-4 lg:flex-row lg:space-y-0 lg:gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by name, email or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full lg:w-56">
                <Input
                  placeholder="Filter by Madarsa ID (e.g. mid-166)"
                  value={madarsaFilter}
                  onChange={(e) => setMadarsaFilter(e.target.value)}
                />
              </div>
              <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full lg:w-auto px-3 py-2 border rounded-md text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAllRejected}
                  disabled={deleteLoading}
                  className="w-full lg:w-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All Rejected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Applications List */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg md:text-xl">
              Applications ({currentPageApplications.length} of {totalCount})
            </CardTitle>
            <CardDescription className="text-sm md:text-base">
              Manage student admission applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading || loadingPage ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-4 border-purple-600 border-t-transparent mx-auto"></div>
                <p className="text-sm md:text-base text-gray-600 mt-4">
                  Loading applications...
                </p>
              </div>
            ) : currentPageApplications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 md:h-16 md:w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-sm md:text-base">No applications found</p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {currentPageApplications.map((application) => (
                  <div
                    key={application.id}
                    className="border rounded-lg p-3 md:p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <h3 className="font-semibold text-base md:text-lg text-gray-900">
                            {application.fullName}
                          </h3>
                          {getStatusBadge(application.status)}
                        </div>
                        <div className="text-xs md:text-sm text-gray-600 space-y-1">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
                            <span className="truncate">
                              {application.phone}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
                            <span className="truncate">
                              {application.admissionNumber}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
                            <span className="truncate">
                              Applied:{" "}
                              {formatDate(
                                application.submittedAt ||
                                  application.createdAt,
                              )}
                            </span>
                          </div>
                          {application.status === "rejected" &&
                            application.rejectionReason && (
                              <div className="flex items-start gap-2 mt-1">
                                <X className="h-3 w-3 md:h-4 md:w-4 shrink-0 text-red-500 mt-0.5" />
                                <span className="text-xs text-red-600">
                                  <span className="font-medium">Reason:</span>{" "}
                                  {application.rejectionReason}
                                </span>
                              </div>
                            )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:ml-4">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-full sm:max-w-2xl w-11/12 sm:w-full max-h-[90vh] overflow-y-auto bg-white">
                            <DialogHeader>
                              <DialogTitle className="text-lg md:text-xl">
                                Application Details
                              </DialogTitle>
                              <DialogDescription className="text-sm md:text-base">
                                Complete application information
                              </DialogDescription>
                            </DialogHeader>
                            <ApplicationDetails application={application} />
                          </DialogContent>
                        </Dialog>

                        {application.status !== "approved" && application.status !== "rejected" && (
                          <>
                            <Dialog
                              open={
                                showCredentialsDialog &&
                                selectedApplication?.id === application.id
                              }
                              onOpenChange={setShowCredentialsDialog}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  className="w-full sm:w-auto"
                                  onClick={() => {
                                    setSelectedApplication(application);
                                    setStudentCredentials({
                                      email: generateStudentEmail(
                                        application.fullName,
                                        application.phone,
                                      ),
                                      password: generatePassword(),
                                    });
                                  }}
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-full sm:max-w-md w-11/12 sm:w-full bg-white">
                                <DialogHeader>
                                  <DialogTitle className="text-lg md:text-xl">
                                    Approve Application
                                  </DialogTitle>
                                  <DialogDescription className="text-sm md:text-base">
                                    Set credentials for {application.fullName}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">
                                      Student Email
                                    </Label>
                                    <Input
                                      value={studentCredentials.email}
                                      disabled
                                      onChange={(e) =>
                                        setStudentCredentials((prev) => ({
                                          ...prev,
                                          email: e.target.value,
                                        }))
                                      }
                                      className="w-full"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">
                                      Temporary Password
                                    </Label>
                                    <Input
                                      value={studentCredentials.password}
                                      onChange={(e) =>
                                        setStudentCredentials((prev) => ({
                                          ...prev,
                                          password: e.target.value,
                                        }))
                                      }
                                      className="w-full"
                                    />
                                  </div>
                                  <div className="flex flex-col sm:flex-row gap-2 pt-4">
                                    <Button
                                      onClick={() =>
                                        handleApproveApplication(application)
                                      }
                                      disabled={approveLoading}
                                      className="w-full sm:w-auto order-1"
                                    >
                                      {approveLoading
                                        ? "Processing..."
                                        : "Confirm"}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() =>
                                        setShowCredentialsDialog(false)
                                      }
                                      className="w-full sm:w-auto order-2"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRejectingApplication(application);
                                setRejectionReason("");
                                setRejectDialogOpen(true);
                              }}
                              disabled={rejectLoading}
                              className="w-full sm:w-auto"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </>
                        )}

                        {application.status === "rejected" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleRestoreApplication(application)
                              }
                              className="w-full sm:w-auto border-green-500 text-green-700 hover:bg-green-50"
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Restore
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                handleDeleteApplication(application)
                              }
                              disabled={deleteLoading}
                              className="w-full sm:w-auto"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {deleteLoading ? "Deleting..." : "Delete"}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading &&
              !loadingPage &&
              Math.ceil(totalCount / itemsPerPage) > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t gap-4">
                  <div className="text-sm text-gray-700">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(currentPage * itemsPerPage, totalCount)} of{" "}
                    {totalCount} applications
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1 || loadingPage}
                      className="min-h-[44px] touch-manipulation"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>

                    <div className="flex items-center space-x-1">
                      {Array.from(
                        {
                          length: Math.min(
                            5,
                            Math.ceil(totalCount / itemsPerPage),
                          ),
                        },
                        (_, i) => {
                          const totalPagesCalc = Math.ceil(
                            totalCount / itemsPerPage,
                          );
                          const pageNum =
                            Math.max(
                              1,
                              Math.min(totalPagesCalc - 4, currentPage - 2),
                            ) + i;
                          if (pageNum > totalPagesCalc) return null;

                          return (
                            <Button
                              key={pageNum}
                              variant={
                                currentPage === pageNum ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              disabled={loadingPage}
                              className="w-10 h-10 p-0"
                            >
                              {pageNum}
                            </Button>
                          );
                        },
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) =>
                          Math.min(
                            prev + 1,
                            Math.ceil(totalCount / itemsPerPage),
                          ),
                        )
                      }
                      disabled={
                        currentPage === Math.ceil(totalCount / itemsPerPage) ||
                        loadingPage
                      }
                      className="min-h-[44px] touch-manipulation"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Rejection Confirmation Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRejectDialogOpen(false);
            setRejectingApplication(null);
            setRejectionReason("");
          }
        }}
      >
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              You are about to reject the application of{" "}
              <strong>{rejectingApplication?.fullName}</strong>. This action
              will mark their application as rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-sm font-medium">Reason for Rejection</Label>
            <Textarea
              placeholder="Enter reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            {rejectionReason.trim() === "" && (
              <p className="text-xs text-red-500">
                Reason is required to reject the application.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectingApplication(null);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectionReason.trim() || rejectLoading}
              onClick={() =>
                handleRejectApplication(rejectingApplication, rejectionReason)
              }
            >
              {rejectLoading ? "Processing..." : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
