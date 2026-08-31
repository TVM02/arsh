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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import Image from "next/image";

import {
  createDocument,
  updateDocument,
  getDocuments,
  COLLECTIONS,
} from "@/lib/firestoreService";
import useAuthStore from "@/lib/authStore";
import { where, runTransaction, doc, getDoc, collection, query, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logApplicationActivity } from "@/lib/loggingUtils";

function ApplicationDetails({ application }) {
  const formatDate = (dateString) => {
    if (!dateString) return "Not specified";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {application.status === "rejected" && application.rejectionReason && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-semibold text-red-800 mb-1">
            Rejection Reason:
          </p>
          <p className="text-sm text-red-700">{application.rejectionReason}</p>
        </div>
      )}
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid grid-cols-3 gap-1 sm:gap-2 mb-4 sm:mb-6 rounded-lg bg-muted p-1">
          <TabsTrigger
            value="personal"
            className="data-[state=active]:bg-background data-[state=active]:text-teal-600 data-[state=active]:border-b-2 data-[state=active]:shadow-sm py-2 rounded-md text-xs sm:text-sm"
          >
            Personal
          </TabsTrigger>
          <TabsTrigger
            value="family"
            className="data-[state=active]:bg-background data-[state=active]:text-teal-600 data-[state=active]:border-b-2  data-[state=active]:shadow-sm py-2 rounded-md text-xs sm:text-sm"
          >
            Family
          </TabsTrigger>
          <TabsTrigger
            value="education"
            className="data-[state=active]:bg-background data-[state=active]:text-teal-600 data-[state=active]:border-b-2 data-[state=active]:shadow-sm py-2 rounded-md text-xs sm:text-sm"
          >
            Education
          </TabsTrigger>
        </TabsList>

        {/* Personal Info */}
        <TabsContent value="personal">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-6 bg-background border rounded-lg">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
                Full Name
              </Label>
              <p className="text-sm sm:text-base font-medium break-words">
                {application.fullName || "Not provided"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
                Date of Birth
              </Label>
              <p className="text-sm sm:text-base font-medium">
                {formatDate(application.dateOfBirth)}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
                Gender
              </Label>
              <p className="text-sm sm:text-base font-medium">
                {application.gender || "Not specified"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
                Phone Number
              </Label>
              <p className="text-sm sm:text-base font-medium break-all">
                {application.phone || "Not provided"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
                Aadhar Number
              </Label>
              <p className="text-sm sm:text-base font-medium break-all">
                {application.aadharNumber || "N/A"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
                Payment ID
              </Label>
              <p className="text-sm sm:text-base font-medium break-all">
                {application.paymentId || "N/A"}
              </p>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
                Address
              </Label>
              <p className="text-sm sm:text-base font-medium break-words">
                {application.address || "Address not available"}
              </p>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-6 bg-background border rounded-lg">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
                Guardian&apos;s Name
              </Label>
              <p className="text-sm sm:text-base font-medium break-words">
                {application.guardianName || "Not specified"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
                Guardian&apos;s Phone
              </Label>
              <p className="text-sm sm:text-base font-medium break-all">
                {application.guardianPhone || "Not provided"}
              </p>
            </div>

            {application.guardianRelationship && (
              <div className="space-y-1">
                <Label className="text-sm font-medium text-muted-foreground">
                  Relationship
                </Label>
                <p className="text-sm sm:text-base font-medium">
                  {application.guardianRelationship}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Education Info */}
        <TabsContent value="education">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-6 bg-background border rounded-lg">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
                Class Level
              </Label>
              <p className="text-sm sm:text-base font-medium">
                {application.class || "Not specified"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
                Previous Madrasa
              </Label>
              <p className="text-sm sm:text-base font-medium break-words">
                {application.previousSchool || "Not provided"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
                Admission Number
              </Label>
              <p className="text-sm sm:text-base font-medium">
                {application.admissionNumber || "Not assigned"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">
                Madrasa
              </Label>
              <p className="text-sm sm:text-base font-medium">
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
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
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

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDocs, setLastDocs] = useState({}); // Map page number to last doc
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 10;
  const searchTimeoutRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
      setLastDocs({});
      fetchApplications(1);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm, statusFilter]);

  const fetchApplications = async (page = 1) => {
    if (!userData?.madarsaId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const constraints = [where("madarsa", "==", userData.madarsaId)];

      if (statusFilter !== "all") {
        if (statusFilter === "pending") {
          constraints.push(where("status", "in", ["pending", "confirmed"]));
        } else {
          constraints.push(where("status", "==", statusFilter));
        }
      }

      // Handle search separately since Firestore doesn't support full-text search directly well with other filters
      // For simple prefix search on specific fields if supported, otherwise client-side or separate query
      // Here we will use simple client side filtering for search if the dataset is small,
      // or rely on fetching enough checks. But for extensive pagination with search, we need a better approach.
      // Given the requirement "firebase search", usually implies checking fields.
      // If we simply paginate, we can't search effectively across all docs without reading them.
      // Let's assume for large datasets we only filter by status/madarsa and paginate,
      // and for search we might need to search specific fields or load more.

      // However, if the user requested "firebase search", let's try to query by name if search term is present
      // Note: Firestore only supports prefix match (term >= "Start" and term <= "Start\uf8ff")

      let fetchedDocs = [];
      let lastVisible = lastDocs[page - 1] || null;

      // Import getPaginatedDocuments locally or usage
      const { getPaginatedDocuments, getDocuments } =
        await import("@/lib/firestoreService");

      if (searchTerm) {
        // If search term exists, we can try to find by admissionNumber or phone directly if exact,
        // or rely on a "searchable" approach.
        // Since we can't easily combine 'where' search with other filters in a single flexible query without valid indexes:
        // We will fetch all relevant docs (filtered by madarsa/status) and filter in memory if the list isn't huge.
        // OR, prioritize the search query.

        // Let's implement a memory-filter approach for now if that's acceptable,
        // OR simply filter by name prefix if that's the primary intent.
        // But strict pagination breaks with client-side filtering of server-side pages.

        // Strategy: If searching, fetch all matching constraints, then filter client side.
        const allDocs = await getDocuments(COLLECTIONS.ADMISSIONS, constraints);
        const filtered = allDocs.filter(
          (app) =>
            app.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            app.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            app.phone?.includes(searchTerm) ||
            app.admissionNumber
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()),
        );

        // Manual pagination of the filtered results
        const start = (page - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        fetchedDocs = filtered.slice(start, end);
        setHasMore(end < filtered.length);
      } else {
        // Standard Pagination
        const {
          data,
          lastDoc,
          hasMore: moreAvailable,
        } = await getPaginatedDocuments(
          COLLECTIONS.ADMISSIONS,
          ITEMS_PER_PAGE,
          constraints,
          lastVisible,
        );
        fetchedDocs = data;

        // Since getPaginatedDocuments in lib return {data, lastDoc},
        // we can check if data length < ITEMS_PER_PAGE to determine hasMore strictly
        // or usage of lastDoc.
        setHasMore(data.length === ITEMS_PER_PAGE);
        if (lastDoc) {
          setLastDocs((prev) => ({ ...prev, [page]: lastDoc }));
        }
      }

      const processedApps = [];
      // Fetch profile pictures
      for (const app of fetchedDocs) {
        let profilePicture = app.profilePicture || app.profilePictureUrl;
        if (!profilePicture && app.email && app.madarsa) {
          try {
            const { getDocuments } = await import("@/lib/firestoreService");
            const studentsData = await getDocuments(COLLECTIONS.STUDENTS, [
              where("admissionNumber", "==", app.admissionNumber),
              where("madarsaId", "==", app.madarsa),
            ]);
            if (studentsData.length > 0 && studentsData[0].profilePicture) {
              profilePicture = studentsData[0].profilePicture;
            }
          } catch (err) {
            console.error(err);
          }
        }
        processedApps.push({ ...app, profilePicture: profilePicture || null });
      }

      setApplications(
        processedApps.sort((a, b) => {
          const dateA = new Date(a.submittedAt || a.createdAt || 0);
          const dateB = new Date(b.submittedAt || b.createdAt || 0);
          return dateB - dateA;
        }),
      );
    } catch (error) {
      console.error("Error fetching applications:", error);
      setError(error.message || "Failed to fetch applications");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
    fetchApplications(newPage);
  };

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
      // Generate the studentId upfront so it can be stored atomically with approval
      const studentId = `student_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const batch = writeBatch(db);

      // Create User doc
      const userRef = doc(db, COLLECTIONS.USERS, studentId);
      batch.set(userRef, {
        uid: studentId,
        email: studentCredentials.email.toLowerCase(),
        password: studentCredentials.password, // Store password in database
        fullName: application.fullName,
        role: "student",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
        lastLogin: null,
        profileComplete: true,
        madarsaId: application.madarsa,
      });

      // Resolve mekhalaId from the madarsa
      let mekhalaId = null;
      try {
        if (application.madarsa) {
          const madarsasRef = collection(db, "madarsas");
          const q = query(madarsasRef, where("madarsaId", "==", application.madarsa));
          const snap = await getDocs(q);
          let madarsaData = null;
          if (!snap.empty) {
            madarsaData = snap.docs[0].data();
          } else {
            const directDoc = await getDoc(doc(db, "madarsas", application.madarsa));
            if (directDoc.exists()) {
              madarsaData = directDoc.data();
            }
          }

          if (madarsaData && madarsaData.mekhala) {
            const districtName = String(madarsaData.mekhala).trim().toUpperCase();
            const mekhalaSnap = await getDocs(collection(db, "mekhala"));
            const foundMekhala = mekhalaSnap.docs.find(
              (d) => String(d.data().name || "").trim().toUpperCase() === districtName
            );
            if (foundMekhala) {
              mekhalaId = foundMekhala.id;
            }
          }
        }
      } catch (err) {
        console.error("Error resolving mekhalaId for student:", err);
      }

      // Create Student doc
      const studentRef = doc(db, COLLECTIONS.STUDENTS, studentId);
      batch.set(studentRef, {
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
        createdAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
        mekhalaId: mekhalaId,
        status: "active",
        academicYear: new Date().getFullYear(),
        gender: application.gender,
        profilePicture:
          application.profilePicture || application.profilePictureUrl || null,
      });

      // Update Application doc
      const appRefUpdate = doc(db, "admissions", application.id);
      batch.update(appRefUpdate, {
        status: "approved",
        approvedAt: new Date().toISOString(),
        approvedBy: user.uid,
        studentEmail: studentCredentials.email,
        studentUid: studentId,
        updatedAt: serverTimestamp(),
      });

      // Commit the batch atomically
      await batch.commit();

      setSuccess(
        `Student account created successfully! Email: ${studentCredentials.email}`,
      );
      setShowCredentialsDialog(false);
      setStudentCredentials({ email: "", password: "" });
      // Log approve activity
      try {
        const role = userData?.role || "madarsa_admin";
        await logApplicationActivity(user, role, "application_approved", {
          fullName: application.fullName,
          admissionNumber: application.admissionNumber,
        });
      } catch (_) {}
      fetchApplications();
    } catch (error) {
      console.error("Error approving application:", error);
      setError(error.message || "Failed to approve application");
    } finally {
      setApproveLoading(false);
    }
  };


  const handleRejectApplication = async (application, reason) => {
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
      // Log reject activity
      try {
        const role = userData?.role || "madarsa_admin";
        await logApplicationActivity(user, role, "application_rejected", {
          fullName: application.fullName,
          admissionNumber: application.admissionNumber,
          reason: reason || "",
        });
      } catch (_) {}
      fetchApplications();
    } catch (error) {
      console.error("Error rejecting application:", error);
      setError("Failed to reject application");
    } finally {
      setRejectLoading(false);
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
        return <Badge variant="secondary">Pending</Badge>;
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
      <div className="space-y-4 sm:space-y-6 min-h-[80vh] px-2 sm:px-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-4 sm:p-6 text-white">
          <h1 className="text-xl sm:text-2xl font-bold mb-2">
            Student Applications
          </h1>
          <p className="text-purple-100 text-sm sm:text-base">
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
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col gap-4">
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
              <div className="w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Applications List */}
        <Card>
          <CardHeader>
            <CardTitle>Applications ({applications.length})</CardTitle>
            <CardDescription>
              Manage student admission applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading applications...</div>
            ) : applications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No applications found
              </div>
            ) : (
              <div className="space-y-4">
                {applications.map((application) => (
                  <div key={application.id} className="border rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Profile Picture Column */}
                      <div className="flex items-center gap-4 flex-1">
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                            <h3 className="font-semibold text-base sm:text-lg">
                              {application.fullName}
                            </h3>
                            {getStatusBadge(application.status)}
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 flex-shrink-0" />
                              <span className="break-all">
                                {application.phone}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4 flex-shrink-0" />
                              <span className="break-all">
                                {application.admissionNumber}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 flex-shrink-0" />
                              <span className="text-xs sm:text-sm">
                                Applied:{" "}
                                {formatDate(
                                  application.submittedAt ||
                                    application.createdAt,
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
                            <DialogHeader>
                              <DialogTitle>Application Details</DialogTitle>
                              <DialogDescription>
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
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto bg-white">
                                <DialogHeader>
                                  <DialogTitle>Approve Application</DialogTitle>
                                  <DialogDescription>
                                    Set credentials for {application.fullName}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Student Email</Label>
                                    <Input
                                      value={studentCredentials.email}
                                      onChange={(e) =>
                                        setStudentCredentials((prev) => ({
                                          ...prev,
                                          email: e.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Temporary Password</Label>
                                    <Input
                                      value={studentCredentials.password}
                                      onChange={(e) =>
                                        setStudentCredentials((prev) => ({
                                          ...prev,
                                          password: e.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="flex flex-col sm:flex-row gap-2 pt-4">
                                    <Button
                                      onClick={() =>
                                        handleApproveApplication(application)
                                      }
                                      disabled={approveLoading}
                                      className="w-full sm:w-auto"
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
                                      className="w-full sm:w-auto"
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
                              className="w-full sm:w-auto"
                              onClick={() => {
                                setRejectingApplication(application);
                                setRejectionReason("");
                                setRejectDialogOpen(true);
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Pagination Controls */}
            {!loading && (applications.length > 0 || currentPage > 1) && (
              <div className="px-4 py-4 border-t flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {currentPage}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!hasMore || loading}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting{" "}
              <strong>{rejectingApplication?.fullName}</strong>&apos;s
              application. This reason will be visible to the applicant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium text-gray-700">
              Reason for Rejection <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Enter the reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
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

