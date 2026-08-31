"use client";

import { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Edit,
  Save,
  X,
  Eye,
  EyeOff,
  Building,
  Loader2,
} from "lucide-react";
import {
  collection,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { fetchConvenerStats } from "@/lib/convenerData";
import { toast } from "sonner";

export default function MekhalaProfile() {
  const { user, userData, setUserData } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [stats, setStats] = useState({
    assignedMekhalas: 0,
    totalMadarsas: 0,
    totalStudents: 0,
    totalTeachers: 0,
  });

  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    loginId: "",
    phone: "",
    address: "",
    district: "",
    state: "",
    password: "",
    status: "active",
  });

  const [originalData, setOriginalData] = useState({});

  useEffect(() => {
    if (userData && userData.role === "convener_admin") {
      // Initialize profile data from userData
      const data = {
        name: userData.name || "",
        email: userData.email || "",
        loginId: userData.loginId || "",
        phone: userData.phone || "",
        address: userData.address || "",
        district: userData.district || "",
        state: userData.state || "",
        password: userData.password || "",
        status: userData.status || "active",
      };
      setProfileData(data);
      setOriginalData(data);

      // Fetch related statistics
      fetchMekhalaStats();
    } else {
      setStatsLoading(false);
    }
  }, [userData]);

  const fetchMekhalaStats = async () => {
    try {
      setStatsLoading(true);
      if (!userData?.uid) return;

      // Use the unified optimized stat fetcher
      const statsData = await fetchConvenerStats(userData, db);

      setStats({
        assignedMekhalas: statsData.mekhalas,
        totalMadarsas: statsData.madarsas,
        totalStudents: statsData.students,
        totalTeachers: statsData.teachers,
      });
    } catch (error) {
      console.error("Error fetching mekhala stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      if (!userData?.uid) {
        toast.error("User ID not found");
        return;
      }

      // Safe trim helper
      const s = (v) => (v || "").toString().trim();

      // Update document in Firestore — no fields are mandatory
      const updates = {
        ...(s(profileData.name) && { name: s(profileData.name), fullName: s(profileData.name) }),
        ...(s(profileData.email) && { email: s(profileData.email) }),
        ...(s(profileData.loginId) && { loginId: s(profileData.loginId) }),
        phone: s(profileData.phone),
        address: s(profileData.address),
        district: s(profileData.district),
        state: s(profileData.state),
        ...(s(profileData.password) && { password: s(profileData.password) }),
        status: profileData.status || "active",
        updatedAt: new Date().toISOString(),
      };
      let updatedSomething = false;

      try {
        const userDocRef = doc(db, "users", userData.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          await updateDoc(userDocRef, updates);
          updatedSomething = true;
        }
      } catch (err) {
        // Silently ignore if missing or permissions fail
      }

      try {
        const convenerDocRef = doc(db, "conveners", userData.uid);
        const convenerSnap = await getDoc(convenerDocRef);
        if (convenerSnap.exists()) {
          await updateDoc(convenerDocRef, updates);
          updatedSomething = true;
        }
      } catch (err) {
        // Silently ignore if missing or permissions fail
      }

      if (!updatedSomething) {
        throw new Error("Could not update profile in database. Document might be missing.");
      }

      // Update userData in store
      const updatedUserData = {
        ...userData,
        ...profileData,
        fullName: s(profileData.name) || profileData.fullName,
        updatedAt: new Date().toISOString(),
      };
      setUserData(updatedUserData);

      setOriginalData(profileData);
      setEditing(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(`Failed to update profile: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setProfileData(originalData);
    setEditing(false);
  };

  if (!userData || userData.role !== "convener_admin") {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600">
              You need to be logged in as a Convener Admin to access this page.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (statsLoading) {
    return (
      <Layout>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">Convener Profile</h1>
          <p className="text-teal-100">
            Manage your profile information and view your administration
            statistics
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Assigned Mekhala</p>
                  <p className="text-2xl font-bold">
                    {stats.assignedMekhalas}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                  <Building className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Madrasas</p>
                  <p className="text-2xl font-bold">{stats.totalMadarsas}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Students</p>
                  <p className="text-2xl font-bold">{stats.totalStudents}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Shield className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Teachers</p>
                  <p className="text-2xl font-bold">{stats.totalTeachers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>
                    {editing
                      ? "Edit your profile information"
                      : "View and manage your profile details"}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                        disabled={loading}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={loading}>
                        <Save className="h-4 w-4 mr-2" />
                        {loading ? "Saving..." : "Save"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  {editing ? (
                    <Input
                      id="name"
                      value={profileData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      placeholder="Enter your full name"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-md">
                      {profileData.name || "Not provided"}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loginId">Login ID</Label>
                  {editing ? (
                    <Input
                      id="loginId"
                      value={profileData.loginId}
                      onChange={(e) =>
                        handleInputChange("loginId", e.target.value)
                      }
                      placeholder="Enter your login ID"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-md">
                      {profileData.loginId || "Not provided"}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  {editing ? (
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      placeholder="Enter your email"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-md flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      {profileData.email || "Not provided"}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  {editing ? (
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) =>
                        handleInputChange("phone", e.target.value)
                      }
                      placeholder="Enter your phone number"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-md flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      {profileData.phone || "Not provided"}
                    </div>
                  )}
                </div>
              </div>

              {/* Location Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="district">District</Label>
                  {editing ? (
                    <Input
                      id="district"
                      value={profileData.district}
                      onChange={(e) =>
                        handleInputChange("district", e.target.value)
                      }
                      placeholder="Enter your district"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-md">
                      {profileData.district || "Not provided"}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  {editing ? (
                    <Input
                      id="state"
                      value={profileData.state}
                      onChange={(e) =>
                        handleInputChange("state", e.target.value)
                      }
                      placeholder="Enter your state"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-md">
                      {profileData.state || "Not provided"}
                    </div>
                  )}
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                {editing ? (
                  <Textarea
                    id="address"
                    value={profileData.address}
                    onChange={(e) =>
                      handleInputChange("address", e.target.value)
                    }
                    placeholder="Enter your complete address"
                    rows={3}
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-md">
                    {profileData.address || "Not provided"}
                  </div>
                )}
              </div>

              {/* Password */}
              {editing && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={profileData.password}
                      onChange={(e) =>
                        handleInputChange("password", e.target.value)
                      }
                      placeholder="Enter new password"
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
              )}

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Account Status</Label>
                {editing ? (
                  <Select
                    value={profileData.status}
                    onValueChange={(value) =>
                      handleInputChange("status", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-3 bg-gray-50 rounded-md">
                    <Badge
                      variant={
                        profileData.status === "active"
                          ? "default"
                          : "secondary"
                      }
                      className={
                        profileData.status === "active"
                          ? "bg-teal-100 text-teal-800"
                          : ""
                      }
                    >
                      {profileData.status || "active"}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>
              Account creation and last update details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label className="text-sm font-medium text-gray-600">
                  Account Created
                </Label>
                <p className="text-sm text-gray-900 mt-1">
                  {userData.createdAt
                    ? new Date(userData.createdAt).toLocaleDateString()
                    : "Not available"}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">
                  Last Updated
                </Label>
                <p className="text-sm text-gray-900 mt-1">
                  {userData.updatedAt
                    ? new Date(userData.updatedAt).toLocaleDateString()
                    : "Not available"}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">
                  Role
                </Label>
                <div className="text-sm text-gray-900 mt-1">
                  <Badge
                    variant="outline"
                    className="bg-teal-50 text-teal-700"
                  >
                    Mekhala Administrator
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
