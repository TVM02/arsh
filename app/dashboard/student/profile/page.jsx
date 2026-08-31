"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  GraduationCap,
  Mail,
  Phone,
  Home,
  Calendar,
  User,
  Users,
  BookOpen,
  Hash,
  Info,
  Contact,
  Edit3,
  Save,
  X,
} from "lucide-react";
import ProfileImage from "@/components/ProfileImage";
import { format } from "date-fns";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { updateDocument } from "@/lib/firestoreService";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

export default function StudentProfile() {
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [editData, setEditData] = useState({
    fullName: "",
    address: "",
    dateOfBirth: "",
    guardianName: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const router = useRouter();
  const { user, userData } = useAuthStore();
  const { toast } = useToast();

  // Function to start editing
  const startEdit = () => {
    // When toggle is OFF, allow only one-time edit
    if (!settings?.studentSelfEdit && studentData?.profileEdited) {
      toast({
        title: "Edit Not Allowed",
        description: "You have already used your one-time edit opportunity.",
        variant: "destructive",
      });
      return;
    }
    // When toggle is OFF and settings is disabled entirely (settings loaded but explicitly false)
    // We still allow one-time edit, so do not block here.

    setEditData({
      fullName: studentData?.fullName || "",
      address: studentData?.address || "",
      dateOfBirth: studentData?.dateOfBirth
        ? typeof studentData.dateOfBirth === "object" &&
          studentData.dateOfBirth.seconds
          ? new Date(studentData.dateOfBirth.seconds * 1000)
              .toISOString()
              .split("T")[0]
          : new Date(studentData.dateOfBirth).toISOString().split("T")[0]
        : "",
      guardianName: studentData?.guardianName || "",
    });
    setIsEditing(true);
  };

  // Function to cancel editing
  const cancelEdit = () => {
    setIsEditing(false);
    setEditData({
      fullName: "",
      address: "",
      dateOfBirth: "",
      guardianName: "",
    });
  };

  // Function to save changes
  const saveChanges = async () => {
    if (
      !editData.fullName.trim() ||
      !editData.address.trim() ||
      !editData.dateOfBirth ||
      !editData.guardianName.trim()
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Find the document ID for the student
      let docId = user.email;

      // Try to find the student document
      const usersQuery = query(
        collection(db, "students"),
        where("email", "==", user.email),
      );
      const usersSnapshot = await getDocs(usersQuery);

      if (!usersSnapshot.empty) {
        docId = usersSnapshot.docs[0].id;
      }

      // Update the student data
      const updateData = {
        fullName: editData.fullName.trim(),
        address: editData.address.trim(),
        dateOfBirth: new Date(editData.dateOfBirth),
        guardianName: editData.guardianName.trim(),
        // Only mark as "one-time edited" when toggle is OFF
        ...(settings?.studentSelfEdit
          ? {}
          : { profileEdited: true, profileEditedAt: new Date() }),
      };

      await updateDocument("students", docId, updateData);

      // Sync with Hall Tickets
      try {
        const sId = studentData?.id || user.uid || studentData?.uid;
        if (sId) {
          const regQuery = query(
            collection(db, "examRegistrations"),
            where("studentId", "==", sId),
          );
          const regSnap = await getDocs(regQuery);

          if (!regSnap.empty) {
            const batch = writeBatch(db);
            let hasUpdates = false;

            regSnap.docs.forEach((docSnap) => {
              const data = docSnap.data();

              // 1. Update in separate hallTickets collection (legacy/specific exam path)
              if (data.examId) {
                const htRef = doc(
                  db,
                  "hallTickets",
                  data.examId,
                  "students",
                  sId,
                );
                // Update fullName
                batch.set(
                  htRef,
                  { fullName: editData.fullName.trim() },
                  { merge: true },
                );
              }

              // 2. Update in examRegistrations collection (root + nested hallTicket)
              const regRef = doc(db, "examRegistrations", docSnap.id);
              batch.set(
                regRef,
                {
                  studentName: editData.fullName.trim(),
                  hallTicket: { fullName: editData.fullName.trim() },
                },
                { merge: true },
              );

              hasUpdates = true;
            });

            if (hasUpdates) {
              await batch.commit();
              console.log("Synced full name to hall tickets");
            }
          }
        }
      } catch (syncErr) {
        console.error("Error syncing hall tickets:", syncErr);
      }

      // Update local state
      setStudentData((prev) => ({
        ...prev,
        ...updateData,
      }));

      setIsEditing(false);
      toast({
        title: "Profile Updated",
        description: settings?.studentSelfEdit
          ? "Your profile has been successfully updated."
          : "Your profile has been successfully updated. This was your one-time edit opportunity.",
        variant: "default",
        className: "bg-white",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoadingSettings(true);
        const settingsDoc = await getDoc(doc(db, "settings", "general"));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data());
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoadingSettings(false);
      }
    };

    const fetchStudentData = async () => {
      try {
        if (!user?.email) {
          router.push("/auth/login/student");
          return;
        }

        // // Use userData if available and complete
        // if (
        //   userData &&
        //   userData.role === "student" &&
        //   userData.fullName &&
        //   userData.email
        // ) {
        //   console.log('Using userData from auth store:', userData);
        //   setStudentData(userData);
        //   setLoading(false);
        //   return;
        // }

        // console.log('Fetching student data for email:', user.email);

        // Try to fetch from users collection first
        let studentFound = false;

        // console.log(user)
        const usersQuery = query(
          collection(db, "students"),
          where("email", "==", user.email),
        );

        const usersSnapshot = await getDocs(usersQuery);

        if (!usersSnapshot.empty) {
          const doc = usersSnapshot.docs[0];
          setStudentData({ id: doc.id, ...doc.data() });
          studentFound = true;
        }

        // If not found in users, try students collection
        if (!studentFound) {
          // Try to fetch from students collection using email as document ID

          const docRef = doc(db, "students", user.email);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setStudentData({ id: docSnap.id, ...docSnap.data() });
            studentFound = true;
          } else {
            // Fallback: query by email field in students collection
            const studentsQuery = query(
              collection(db, "students"),
              where("email", "==", user.email),
            );
            const querySnapshot = await getDocs(studentsQuery);

            if (!querySnapshot.empty) {
              const doc = querySnapshot.docs[0];
              setStudentData({ id: doc.id, ...doc.data() });
              studentFound = true;
            }
          }
        }

        // console.log("Student data loaded:", studentData);
        // console.log("Profile picture fields:", {
        //   profilePicture: userData?.profilePicture,
        //   profilePictureUrl: userData?.profilePictureUrl,
        //   photo: userData?.photo
        // });

        if (!studentFound) {
          // console.log("No student data found");
          setStudentData(null);
        }
      } catch (error) {
        console.error("Error fetching student data:", error);
        setStudentData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
    fetchStudentData();
  }, [router, user?.email, userData]);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[calc(100vh-140px)]">
          <div className="animate-spin none-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!studentData) {
    return (
      <Layout>
        <div className="flex flex-col justify-center items-center min-h-[calc(100vh-140px)] text-center p-4">
          <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 none-full mb-4">
              <GraduationCap className="h-12 w-12 text-blue-600" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-gray-900">
              Student Profile Not Found
            </h3>
            <p className="mb-6 mt-3 text-base text-gray-600 leading-relaxed ">
              We couldn&apos;t find your student profile. Please contact your
              administrator or try logging in again.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => router.push("/auth/login/student")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
              >
                Return to Login
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="border-blue-200 text-blue-600 hover:bg-blue-50 px-6 py-2"
              >
                Refresh Page
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Safe date formatting function
  const formatDate = (dateValue, fallback = "Not available") => {
    if (!dateValue) return fallback;

    try {
      // Handle Firestore Timestamp
      if (
        typeof dateValue === "object" &&
        typeof dateValue.seconds === "number"
      ) {
        return format(new Date(dateValue.seconds * 1000), "MMMM d, yyyy");
      }

      // Handle Firestore Timestamp with toDate method
      if (
        typeof dateValue === "object" &&
        typeof dateValue.toDate === "function"
      ) {
        return format(dateValue.toDate(), "MMMM d, yyyy");
      }

      // Handle string or number dates
      if (typeof dateValue === "string" || typeof dateValue === "number") {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return format(date, "MMMM d, yyyy");
        }
      }

      return fallback;
    } catch (error) {
      console.error("Error formatting date:", error);
      return fallback;
    }
  };

  // Format dates for display
  const formattedAdmissionDate = formatDate(studentData?.admissionDate);
  const formattedDob = formatDate(studentData?.dateOfBirth);
  const formattedCreatedAt = formatDate(studentData?.createdAt);

  return (
    <Layout>
      <div className="flex-1 space-y-4 md:space-y-6 p-4 md:p-8 pt-4 md:pt-6">
        {/* Edit Status Alert */}
        {!settings?.studentSelfEdit && !studentData?.profileEdited && (
          <div className="bg-blue-50 border border-blue-200 none-lg p-3 md:p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-blue-900">
                  One-Time Edit Available
                </h3>
                <p className="text-xs md:text-sm text-blue-800 mt-1">
                  You can edit your profile once. After saving, further edits
                  will require administrator permission.
                </p>
              </div>
            </div>
          </div>
        )}
        {!settings?.studentSelfEdit && studentData?.profileEdited && (
          <div className="bg-yellow-50 border border-yellow-200 none-lg p-3 md:p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-yellow-900">
                  One-Time Edit Already Used
                </h3>
                <p className="text-xs md:text-sm text-yellow-800 mt-1">
                  You have already used your one-time edit opportunity. Contact
                  your administrator if you need to update your information.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 none-xl p-4 md:p-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Student Profile
              </h1>
              <p className="text-blue-100 mt-1 text-sm md:text-base">
                View and manage your academic information
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Badge
                variant={
                  studentData?.status === "active" ? "secondary" : "destructive"
                }
                className={`${
                  studentData?.status === "active"
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-red-100 text-red-800 border-red-200"
                } font-medium px-3 py-1 text-xs md:text-sm w-fit`}
              >
                {studentData?.status === "active"
                  ? "Active Student"
                  : studentData?.status || "Inactive"}
              </Badge>

              {/* Edit Button */}
              {!isEditing && (
                <Button
                  onClick={startEdit}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30 w-full sm:w-auto text-sm"
                  disabled={
                    !settings?.studentSelfEdit && !!studentData?.profileEdited
                  }
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  {settings?.studentSelfEdit
                    ? "Edit Profile"
                    : studentData?.profileEdited
                      ? "Edit Used (One Time)"
                      : "Edit Profile (One Time)"}
                </Button>
              )}

              {/* Save/Cancel Buttons */}
              {isEditing && (
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button
                    onClick={saveChanges}
                    variant="secondary"
                    className="bg-green-600 hover:bg-green-700 text-white text-sm"
                    disabled={saving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    onClick={cancelEdit}
                    variant="secondary"
                    className="bg-red-600 hover:bg-red-700 text-white text-sm"
                    disabled={saving}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_2fr]">
          {/* Profile Card */}
          <Card className="h-fit shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
            <CardHeader className="pb-4 md:pb-6 text-center">
              <div className="flex flex-col items-center gap-3 md:gap-4">
                <div className="relative">
                  <div className="h-24 w-24 md:h-28 md:w-28 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                    <ProfileImage
                      src={studentData}
                      sourceData={studentData}
                      onResolved={(profilePic) => {
                        setStudentData((prev) =>
                          prev
                            ? {
                                ...prev,
                                profilePicture: profilePic,
                                profilePictureUrl: profilePic,
                              }
                            : prev,
                        );
                      }}
                      alt={`${
                        studentData?.fullName || "Student"
                      } profile picture`}
                      className="w-full h-full object-cover"
                      fallbackClassName="w-full h-full flex items-center justify-center"
                      iconClassName="h-10 w-10 md:h-12 md:w-12 text-white"
                      showText={false}
                    />
                  </div>
                  {/* Profile picture change control — always available when toggle ON, one-time when OFF */}
                  {isEditing &&
                    (settings?.studentSelfEdit ||
                      !studentData?.profilePicChanged) && (
                      <div className="flex-col -bottom-6 left-0 w-full flex justify-center">
                        <label className=" items-center gap-2 bg-white/90 border none-md px-3 py-1 text-sm cursor-pointer hover:bg-white">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              setSelectedFile(e.target.files?.[0] || null)
                            }
                          />
                          <span>
                            {selectedFile ? selectedFile.name : "Change Photo"}
                          </span>
                        </label>
                        <div className="ml-2">
                          <Button
                            size="sm"
                            className="mt-2 bg-green-600 hover:bg-green-700 text-white w-full"
                            onClick={async () => {
                              if (!selectedFile) return;
                              setUploading(true);
                              try {
                                // Upload to Firebase Storage under students/profile-picture
                                const timestamp = Date.now();
                                const fileName = `${user.email.replace(
                                  /[^a-zA-Z0-9]/g,
                                  "_",
                                )}_${timestamp}_${selectedFile.name}`;
                                const storageRef = ref(
                                  storage,
                                  `students/profile-picture/${fileName}`,
                                );

                                // Upload file
                                await uploadBytes(storageRef, selectedFile);

                                // Get download URL
                                const photoURL =
                                  await getDownloadURL(storageRef);

                                // Determine docId for student
                                let docId = user.email;
                                const usersQuery = query(
                                  collection(db, "students"),
                                  where("email", "==", user.email),
                                );
                                const usersSnapshot = await getDocs(usersQuery);
                                if (!usersSnapshot.empty)
                                  docId = usersSnapshot.docs[0].id;

                                // Update student document with profilePicture; mark profilePicChanged only when toggle is OFF
                                await updateDocument("students", docId, {
                                  profilePicture: photoURL,
                                  ...(settings?.studentSelfEdit
                                    ? {}
                                    : {
                                        profilePicChanged: true,
                                        profilePicChangedAt: new Date(),
                                      }),
                                });

                                // Sync with Hall Tickets
                                try {
                                  const sId =
                                    studentData?.id ||
                                    user.uid ||
                                    studentData?.uid;
                                  if (sId) {
                                    const regQuery = query(
                                      collection(db, "examRegistrations"),
                                      where("studentId", "==", sId),
                                    );
                                    const regSnap = await getDocs(regQuery);

                                    if (!regSnap.empty) {
                                      const batch = writeBatch(db);
                                      let hasUpdates = false;

                                      regSnap.docs.forEach((docSnap) => {
                                        const data = docSnap.data();

                                        // 1. Update in separate hallTickets collection
                                        if (data.examId) {
                                          const htRef = doc(
                                            db,
                                            "hallTickets",
                                            data.examId,
                                            "students",
                                            sId,
                                          );
                                          batch.set(
                                            htRef,
                                            { profilePictureUrl: photoURL },
                                            { merge: true },
                                          );
                                        }

                                        // 2. Update in examRegistrations collection
                                        const regRef = doc(
                                          db,
                                          "examRegistrations",
                                          docSnap.id,
                                        );
                                        batch.set(
                                          regRef,
                                          {
                                            hallTicket: {
                                              profilePictureUrl: photoURL,
                                            },
                                          },
                                          { merge: true },
                                        );

                                        hasUpdates = true;
                                      });

                                      if (hasUpdates) {
                                        await batch.commit();
                                        console.log(
                                          "Synced profile picture to hall tickets",
                                        );
                                      }
                                    }
                                  }
                                } catch (syncErr) {
                                  console.error(
                                    "Error syncing hall tickets:",
                                    syncErr,
                                  );
                                }

                                // Update local state
                                setStudentData((prev) => ({
                                  ...prev,
                                  profilePicture: photoURL,
                                  ...(settings?.studentSelfEdit
                                    ? {}
                                    : { profilePicChanged: true }),
                                }));
                                setSelectedFile(null);
                                toast({
                                  title: "Profile Photo Updated",
                                  description:
                                    "Your profile photo was uploaded successfully.",
                                  className: "bg-white",
                                });
                              } catch (err) {
                                console.error("Upload failed", err);
                                toast({
                                  title: "Upload Failed",
                                  description:
                                    err?.message || "Failed to upload image.",
                                  variant: "destructive",
                                });
                              } finally {
                                setUploading(false);
                              }
                            }}
                            disabled={!selectedFile || uploading}
                          >
                            {uploading ? "Uploading..." : "Save Photo"}
                          </Button>
                        </div>
                      </div>
                    )}
                </div>
                <div className="text-center">
                  {isEditing ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Full Name
                      </label>
                      <Input
                        value={editData.fullName}
                        onChange={(e) =>
                          setEditData((prev) => ({
                            ...prev,
                            fullName: e.target.value,
                          }))
                        }
                        className="text-center text-lg font-bold border-2"
                        placeholder="Enter full name"
                      />
                    </div>
                  ) : (
                    <CardTitle className="text-xl md:text-2xl font-bold text-gray-900">
                      {studentData?.fullName || "Student"}
                    </CardTitle>
                  )}
                  <CardDescription className="mt-2 text-sm md:text-base font-medium text-gray-600">
                    Grade {studentData?.classLevel || "N/A"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 px-4 md:px-6">
              {/* Contact Information */}
              <div className="flex items-center gap-3 md:gap-4 p-3 none-lg bg-blue-50 border border-blue-100">
                <div className="none-lg bg-blue-600 p-2 md:p-2.5 flex-shrink-0">
                  <Mail className="h-4 w-4 md:h-5 md:w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium text-blue-900">
                    Email Address
                  </p>
                  <p className="font-semibold text-gray-900 truncate text-sm md:text-base">
                    {studentData?.email || "Not provided"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 md:gap-4 p-3 none-lg bg-green-50 border border-green-100">
                <div className="none-lg bg-green-600 p-2 md:p-2.5 flex-shrink-0">
                  <Phone className="h-4 w-4 md:h-5 md:w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium text-green-900">
                    Phone Number
                  </p>
                  <p className="font-semibold text-gray-900 text-sm md:text-base">
                    {studentData?.phone || "Not provided"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 md:gap-4 p-3 none-lg bg-purple-50 border border-purple-100">
                <div className="none-lg bg-purple-600 p-2 md:p-2.5 flex-shrink-0 mt-1">
                  <Home className="h-4 w-4 md:h-5 md:w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium text-purple-900">
                    Home Address
                  </p>
                  {isEditing ? (
                    <Input
                      value={editData.address}
                      onChange={(e) =>
                        setEditData((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                      className="mt-1 border-2 text-sm"
                      placeholder="Enter home address"
                    />
                  ) : (
                    <p className="font-semibold text-gray-900 leading-relaxed text-sm md:text-base break-words">
                      {studentData?.address || "Not provided"}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 md:gap-4 p-3 none-lg bg-orange-50 border border-orange-100">
                <div className="none-lg bg-orange-600 p-2 md:p-2.5 flex-shrink-0">
                  <Calendar className="h-4 w-4 md:h-5 md:w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium text-orange-900">
                    Date of Birth
                  </p>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={editData.dateOfBirth}
                      onChange={(e) =>
                        setEditData((prev) => ({
                          ...prev,
                          dateOfBirth: e.target.value,
                        }))
                      }
                      className="mt-1 border-2 text-sm"
                    />
                  ) : (
                    <p className="font-semibold text-gray-900 text-sm md:text-base">
                      {formattedDob}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details Section */}
          <div className="space-y-4 md:space-y-6">
            {/* Academic Information */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-blue-50">
              <CardHeader className="border-b border-blue-100 bg-gradient-to-r from-blue-600 to-indigo-600 text-white none-t-lg p-4 md:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 none-lg">
                    <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg md:text-xl font-bold">
                    Academic Information
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pt-4 md:pt-6 p-4 md:p-6">
                <div className="p-3 md:p-4 none-lg bg-white border border-gray-100">
                  <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                    Admission Number
                  </p>
                  <p className="font-bold text-base md:text-lg text-gray-900 break-all">
                    {studentData?.admissionNumber || "Not available"}
                  </p>
                </div>
                <div className="p-3 md:p-4 none-lg bg-white border border-gray-100">
                  <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                    Admission Date
                  </p>
                  <p className="font-bold text-base md:text-lg text-gray-900">
                    {formattedAdmissionDate}
                  </p>
                </div>
                <div className="p-3 md:p-4 none-lg bg-white border border-gray-100">
                  <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                    Current Class
                  </p>
                  <p className="font-bold text-base md:text-lg text-gray-900">
                    Grade {studentData?.classLevel || "Not available"}
                  </p>
                </div>
                <div className="p-3 md:p-4 none-lg bg-white border border-gray-100">
                  <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                    Academic Year
                  </p>
                  <p className="font-bold text-base md:text-lg text-gray-900">
                    {studentData?.academicYear || "Not available"}
                  </p>
                </div>
                <div className="md:col-span-2 p-3 md:p-4 none-lg bg-white border border-gray-100">
                  <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                    Previous Education
                  </p>
                  <p className="font-bold text-base md:text-lg text-gray-900 break-words">
                    {studentData?.previousEducation || "Not available"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Family Information */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-green-50">
              <CardHeader className="border-b border-green-100 bg-gradient-to-r from-green-600 to-emerald-600 text-white none-t-lg p-4 md:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 none-lg">
                    <Users className="h-5 w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg md:text-xl font-bold">
                    Family Information
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pt-4 md:pt-6 p-4 md:p-6">
                <div className="p-3 md:p-4 none-lg bg-white border border-gray-100">
                  <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                    Guardian Name
                  </p>
                  {isEditing ? (
                    <Input
                      value={editData.guardianName}
                      onChange={(e) =>
                        setEditData((prev) => ({
                          ...prev,
                          guardianName: e.target.value,
                        }))
                      }
                      className="mt-1 border-2 text-sm"
                      placeholder="Enter guardian name"
                    />
                  ) : (
                    <p className="font-bold text-base md:text-lg text-gray-900 break-words">
                      {studentData?.guardianName || "Not available"}
                    </p>
                  )}
                </div>
                <div className="p-3 md:p-4 none-lg bg-white border border-gray-100">
                  <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                    Guardian Contact
                  </p>
                  <p className="font-bold text-base md:text-lg text-gray-900 break-all">
                    {studentData?.guardianPhone || "Not available"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* System Information */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-purple-50">
              <CardHeader className="border-b border-purple-100 bg-gradient-to-r from-purple-600 to-violet-600 text-white none-t-lg p-4 md:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 none-lg">
                    <Info className="h-5 w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg md:text-xl font-bold">
                    System Information
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pt-4 md:pt-6 p-4 md:p-6">
                <div className="p-3 md:p-4 none-lg bg-white border border-gray-100">
                  <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                    Madrasa ID
                  </p>
                  <p className="font-bold text-base md:text-lg text-gray-900 break-all">
                    {studentData?.madarsaId || "Not available"}
                  </p>
                </div>
                <div className="p-3 md:p-4 none-lg bg-white border border-gray-100">
                  <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                    Account Status
                  </p>
                  <p className="font-bold text-base md:text-lg text-gray-900 capitalize">
                    {studentData?.status || "active"}
                  </p>
                </div>
                <div className="md:col-span-2 p-3 md:p-4 none-lg bg-white border border-gray-100">
                  <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                    Account Created
                  </p>
                  <p className="font-bold text-base md:text-lg text-gray-900">
                    {formattedCreatedAt}
                  </p>
                </div>

                {/* Profile Edit Status */}
                <div className="md:col-span-2 p-3 md:p-4 none-lg bg-white border border-gray-100">
                  <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
                    Profile Edit Status
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Badge
                      variant={
                        studentData?.profileEdited ? "destructive" : "secondary"
                      }
                      className={`${
                        studentData?.profileEdited
                          ? "bg-red-100 text-red-800"
                          : "bg-green-100 text-green-800"
                      } w-fit text-xs`}
                    >
                      {studentData?.profileEdited
                        ? "Edit Used"
                        : "Edit Available"}
                    </Badge>
                    {studentData?.profileEditedAt && (
                      <span className="text-xs md:text-sm text-gray-600 break-words">
                        (Edited on {formatDate(studentData.profileEditedAt)})
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Toaster />
    </Layout>
  );
}
