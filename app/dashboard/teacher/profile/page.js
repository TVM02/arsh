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
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
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
  Hash,
  Info,
  Contact,
  Edit3,
  Save,
  X,
  Building2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateDocument } from "@/lib/firestoreService";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

export default function TeacherProfile() {
  const [teacherData, setTeacherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    fullName: "",
    phoneNumber: "",
    address: "",
    dateOfBirth: "",
    bio: "",
    mhrId: "",
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { user, userData } = useAuthStore();
  const { toast } = useToast();

  // Helper functions to check if sections have content
  const hasPersonalInfo = () => {
    return teacherData && (
      teacherData.name || 
      teacherData.fullName || 
      teacherData.email || 
      teacherData.phone || 
      teacherData.address || 
      teacherData.dateOfBirth ||
      teacherData.mhrId
    );
  };

  const hasBioInfo = () => {
    return teacherData && teacherData.bio && teacherData.bio.trim();
  };

  const hasInstitutionInfo = () => {
    return teacherData && (
      teacherData.teacherId || 
      teacherData.id || 
      teacherData.madarsaId || 
      teacherData.createdAt || 
      teacherData.role ||
      teacherData.mhrId
    );
  };

  const hasAccountStatus = () => {
    return teacherData && (
      teacherData.status || 
      teacherData.profileEditedAt ||
      (teacherData.name || teacherData.fullName) ||
      teacherData.phone ||
      teacherData.address
    );
  };

  // Function to start editing
  const startEdit = () => {
    // Check if profile has already been edited
    if (teacherData?.profileEdited) {
      toast({
        title: "Edit Not Allowed",
        description: "You have already used your one-time edit opportunity.",
        variant: "destructive",
      });
      return;
    }

    setEditData({
      fullName: teacherData?.name || teacherData?.fullName || "",
      phoneNumber: teacherData?.phone || teacherData?.phoneNumber || "",
      address: teacherData?.address || "",
      dateOfBirth: teacherData?.dateOfBirth
        ? typeof teacherData.dateOfBirth === "object" &&
          teacherData.dateOfBirth.seconds
          ? new Date(teacherData.dateOfBirth.seconds * 1000)
              .toISOString()
              .split("T")[0]
          : new Date(teacherData.dateOfBirth).toISOString().split("T")[0]
        : "",
      bio: teacherData?.bio || "",
      mhrId: teacherData?.mhrId || "",
    });
    setIsEditing(true);
  };

  // Function to cancel editing
  const cancelEdit = () => {
    setIsEditing(false);
    setEditData({
      fullName: "",
      phoneNumber: "",
      address: "",
      dateOfBirth: "",
      bio: "",
      mhrId: "",
    });
  };

  // Function to save changes
  const saveChanges = async () => {
    if (
      !editData.fullName.trim() ||
      !editData.phoneNumber.trim() ||
      !editData.address.trim()
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Name, Phone, Address).",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Find the document ID for the teacher
      let docId = user.email;

      // Try to find the teacher document
      const usersQuery = query(
        collection(db, "teachers"),
        where("email", "==", user.email)
      );
      const usersSnapshot = await getDocs(usersQuery);

      if (!usersSnapshot.empty) {
        docId = usersSnapshot.docs[0].id;
      }

      // Update the teacher data
      const updateData = {
        name: editData.fullName.trim(),
        fullName: editData.fullName.trim(),
        phone: editData.phoneNumber.trim(),
        phoneNumber: editData.phoneNumber.trim(),
        address: editData.address.trim(),
        bio: editData.bio.trim(),
        mhrId: editData.mhrId.trim(),
        profileEdited: true, // Mark as edited
        profileEditedAt: new Date(),
      };

      if (editData.dateOfBirth) {
        updateData.dateOfBirth = new Date(editData.dateOfBirth);
      }

      await updateDocument("teachers", docId, updateData);

      // Update local state
      setTeacherData((prev) => ({
        ...prev,
        ...updateData,
      }));

      setIsEditing(false);
      toast({
        title: "Profile Updated",
        description:
          "Your profile has been successfully updated. This was your one-time edit opportunity.",
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
    const fetchTeacherData = async () => {
      try {
        if (!user?.email) {
          router.push("/auth/login/teacher");
          return;
        }

        // console.log("Fetching teacher data for email:", user.email);

        // Try to fetch from teachers collection
        let teacherFound = false;
        const teachersQuery = query(
          collection(db, "teachers"),
          where("email", "==", user.email)
        );

        const teachersSnapshot = await getDocs(teachersQuery);

        if (!teachersSnapshot.empty) {
          const teacherData = teachersSnapshot.docs[0].data();
          // console.log("Found teacher data:", teacherData);
          setTeacherData({
            ...teacherData,
            id: teachersSnapshot.docs[0].id,
          });
          teacherFound = true;
        }

        if (!teacherFound) {
          // If not found in teachers collection, use userData from auth store
          if (userData && userData.role === "teacher") {
            // console.log("Using userData from auth store:", userData);
            setTeacherData(userData);
          } else {
            // console.log("No teacher data found");
            setTeacherData(null);
          }
        }
      } catch (error) {
        console.error("Error fetching teacher data:", error);
        setTeacherData(null);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchTeacherData();
    }
  }, [user, userData, router]);

  const formatDate = (date) => {
    if (!date) return "Not provided";
    
    try {
      let dateObj;
      if (typeof date === "object" && date.seconds) {
        dateObj = new Date(date.seconds * 1000);
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        dateObj = new Date(date);
      }
      
      if (isNaN(dateObj)) return "Invalid date";
      return format(dateObj, "PPP");
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid date";
    }
  };

  if (loading) {
    return (
      <Layout user={user}>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!teacherData) {
    return (
      <Layout user={user}>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <p className="text-red-600 mb-4">Teacher profile not found</p>
            <p className="text-gray-600">
              Please contact the administrator to set up your profile
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 px-4 md:px-0">
        <Toaster />
        
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg p-4 md:p-6 text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-3 md:space-x-4">
              <Avatar className="h-12 w-12 md:h-16 md:w-16 border-4 border-white flex-shrink-0">
                <AvatarImage 
                  src={teacherData.photoURL || user?.photoURL} 
                  alt={teacherData.name || teacherData.fullName} 
                />
                <AvatarFallback className="bg-teal-500 text-white text-lg md:text-xl">
                  {(teacherData.name || teacherData.fullName)
                    ? (teacherData.name || teacherData.fullName).split(" ").map(n => n[0]).join("").toUpperCase()
                    : "T"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg md:text-2xl font-bold truncate">
                  {teacherData.name || teacherData.fullName || "Teacher Profile"}
                </h1>
                <p className="text-teal-100 text-sm md:text-base">Teacher Dashboard</p>
              </div>
            </div>
            {!isEditing && !teacherData.profileEdited && (
              <Button
                onClick={startEdit}
                className="bg-white text-teal-600 hover:bg-gray-100 w-full sm:w-auto"
                size="sm"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </div>

        {/* Edit Notice */}
        {teacherData.profileEdited && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-3 md:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <Info className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                <p className="text-sm text-yellow-800 break-words">
                  You have already used your one-time profile edit opportunity.
                  {teacherData.profileEditedAt && 
                    ` Last edited on ${formatDate(teacherData.profileEditedAt)}.`
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Personal Information - Always show when editing or has content */}
          {(isEditing || hasPersonalInfo()) && (
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center space-x-2 text-lg md:text-xl">
                  <User className="h-5 w-5" />
                  <span>Personal Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium mb-1">
                        Full Name *
                      </label>
                      <Input
                        value={editData.fullName}
                        onChange={(e) =>
                          setEditData({ ...editData, fullName: e.target.value })
                        }
                        placeholder="Enter your full name"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Phone Number *
                      </label>
                      <Input
                        value={editData.phoneNumber}
                        onChange={(e) =>
                          setEditData({ ...editData, phoneNumber: e.target.value })
                        }
                        placeholder="Enter your phone number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Date of Birth
                      </label>
                      <Input
                        type="date"
                        value={editData.dateOfBirth}
                        onChange={(e) =>
                          setEditData({ ...editData, dateOfBirth: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Address *
                      </label>
                      <Textarea
                        value={editData.address}
                        onChange={(e) =>
                          setEditData({ ...editData, address: e.target.value })
                        }
                        placeholder="Enter your address"
                        rows={3}
                        className="w-full resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        MSR ID
                      </label>
                      <Input
                        value={editData.mhrId}
                        disabled
                        onChange={(e) =>
                          setEditData({ ...editData, mhrId: e.target.value })
                        }
                        placeholder="Enter your MSR ID (optional)"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {(teacherData.name || teacherData.fullName) && (
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-3">
                        <User className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-600">Full Name</p>
                          <p className="font-medium">
                            {teacherData.name || teacherData.fullName}
                          </p>
                        </div>
                      </div>
                    )}

                    {teacherData.email && (
                      <div className="flex items-center space-x-3">
                        <Mail className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Email</p>
                          <p className="font-medium">{teacherData.email}</p>
                        </div>
                      </div>
                    )}

                    {teacherData.phone && (
                      <div className="flex items-center space-x-3">
                        <Phone className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Phone Number</p>
                          <p className="font-medium">{teacherData.phone}</p>
                        </div>
                      </div>
                    )}

                    {teacherData.dateOfBirth && formatDate(teacherData.dateOfBirth) !== "Not provided" && formatDate(teacherData.dateOfBirth) !== "Invalid date" && (
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Date of Birth</p>
                          <p className="font-medium">{formatDate(teacherData.dateOfBirth)}</p>
                        </div>
                      </div>
                    )}

                    {teacherData.address && (
                      <div className="flex flex-col sm:flex-row sm:items-start space-y-1 sm:space-y-0 sm:space-x-3">
                        <Home className="h-5 w-5 text-gray-400 mt-1 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-600">Address</p>
                          <p className="font-medium">{teacherData.address}</p>
                        </div>
                      </div>
                    )}

                    {teacherData.mhrId && (
                      <div className="flex items-center space-x-3">
                        <Hash className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">MSR ID</p>
                          <p className="font-medium">{teacherData.mhrId}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bio Information - Only show when editing or has bio content */}
          {(isEditing || hasBioInfo()) && (
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center space-x-2 text-lg md:text-xl">
                  <Info className="h-5 w-5" />
                  <span>Bio Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6">
                {isEditing ? (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Bio/Description
                    </label>
                    <Textarea
                      value={editData.bio}
                      onChange={(e) =>
                        setEditData({ ...editData, bio: e.target.value })
                      }
                      placeholder="Tell us about yourself..."
                      rows={4}
                      className="w-full resize-none"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-start space-y-1 sm:space-y-0 sm:space-x-3">
                    <Info className="h-5 w-5 text-gray-400 mt-1 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-600">Bio</p>
                      <p className="font-medium">{teacherData.bio}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Institution Information - Only show when has content */}
          {hasInstitutionInfo() && (
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center space-x-2 text-lg md:text-xl">
                  <Building2 className="h-5 w-5" />
                  <span>Institution Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6">
                {(teacherData.teacherId || teacherData.id) && (
                  <div className="flex items-center space-x-3">
                    <Hash className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Teacher ID</p>
                      <p className="font-medium">
                        {teacherData.teacherId || teacherData.id}
                      </p>
                    </div>
                  </div>
                )}

                {teacherData.mhrId && (
                  <div className="flex items-center space-x-3">
                    <Hash className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">MSR ID</p>
                      <p className="font-medium">{teacherData.mhrId}</p>
                    </div>
                  </div>
                )}

                {teacherData.madarsaId && (
                  <div className="flex items-center space-x-3">
                    <Building2 className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Mahal ID</p>
                      <p className="font-medium">{teacherData.madarsaId}</p>
                    </div>
                  </div>
                )}

                {teacherData.createdAt && formatDate(teacherData.createdAt) !== "Not available" && formatDate(teacherData.createdAt) !== "Invalid date" && (
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Joined Date</p>
                      <p className="font-medium">{formatDate(teacherData.createdAt)}</p>
                    </div>
                  </div>
                )}

                {teacherData.role && (
                  <div className="flex items-center space-x-3">
                    <Users className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Role</p>
                      <Badge variant="outline">
                        {teacherData.role}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Account Status - Only show when has content */}
          {hasAccountStatus() && (
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center space-x-2 text-lg md:text-xl">
                  <Contact className="h-5 w-5" />
                  <span>Account Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6">
                {teacherData.status && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                    <span className="text-sm text-gray-600">Account Status</span>
                    <Badge 
                      variant={teacherData.status === "active" ? "default" : "secondary"}
                      className={teacherData.status === "active" ? "bg-green-100 text-green-800" : ""}
                    >
                      {teacherData.status}
                    </Badge>
                  </div>
                )}

                {((teacherData.name || teacherData.fullName) || teacherData.phone || teacherData.address) && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                    <span className="text-sm text-gray-600">Profile Completion</span>
                    <Badge variant="outline">
                      {(teacherData.name || teacherData.fullName) && teacherData.phone && teacherData.address 
                        ? "Complete" 
                        : "Incomplete"}
                    </Badge>
                  </div>
                )}

                {teacherData.profileEditedAt && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                    <span className="text-sm text-gray-600">Last Updated</span>
                    <span className="text-sm font-medium">
                      {formatDate(teacherData.profileEditedAt)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty State Message */}
          {!isEditing && !hasPersonalInfo() && !hasBioInfo() && !hasInstitutionInfo() && !hasAccountStatus() && (
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="text-center py-12">
                  <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Profile Information</h3>
                  <p className="text-gray-600 mb-6">
                    Your profile information is not yet available. This may happen if your account is newly created.
                  </p>
                  {!teacherData.profileEdited && (
                    <Button
                      onClick={startEdit}
                      className="bg-teal-600 hover:bg-teal-700"
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Complete Your Profile
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Edit Actions */}
        {isEditing && (
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <Button
                  onClick={cancelEdit}
                  variant="outline"
                  disabled={saving}
                  className="w-full sm:w-auto"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={saveChanges}
                  disabled={saving}
                  className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
