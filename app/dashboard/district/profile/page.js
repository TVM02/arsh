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
  Camera,
  Upload,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { madrasaMatchesMekhala } from "@/lib/madrasaHierarchy";
import { toast } from "sonner";

export default function MekhalaProfile() {
  const { user, userData, setUserData } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [parentDistrict, setParentDistrict] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [stats, setStats] = useState({
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
    if (userData && userData.role === "mekhala_admin") {
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
      setProfilePhotoUrl(
        userData.profilePhoto || userData.profilePicture || "",
      );

      // Fetch fresh Firestore doc to get district + any fields not in authStore
      const fetchFreshDoc = async () => {
        try {
          const isSubMekhala = userData.mekhalaDocType === "sub_mekhala";
          const collName = isSubMekhala ? "districts" : "mekhala";
          const freshSnap = await getDoc(doc(db, collName, userData.uid));
          if (freshSnap.exists()) {
            const fresh = freshSnap.data();
            // Always use fresh Firestore values (overrides stale authStore data)
            setProfileData((prev) => ({
              ...prev,
              district: fresh.district || prev.district || "",
              state: fresh.state || prev.state || "",
              phone: fresh.phone || prev.phone || "",
              address: fresh.address || prev.address || "",
              email: fresh.email || prev.email || "",
            }));
            setOriginalData((prev) => ({
              ...prev,
              district: fresh.district || prev.district || "",
              state: fresh.state || prev.state || "",
              phone: fresh.phone || prev.phone || "",
              address: fresh.address || prev.address || "",
              email: fresh.email || prev.email || "",
            }));
          }

          // For sub_mekhala: fetch parent mekhala district name
          if (isSubMekhala) {
            const parentId =
              userData.parentMekhalaId ||
              (freshSnap.exists() ? freshSnap.data().mekhalaId : null);
            if (parentId) {
              const parentSnap = await getDoc(doc(db, "mekhala", parentId));
              if (parentSnap.exists()) {
                const pd = parentSnap.data();
                const districtName = pd.district || pd.name || "";
                setParentDistrict(districtName);
                // Also fill in profileData.district if still empty
                setProfileData((prev) => ({
                  ...prev,
                  district: prev.district || districtName,
                }));
              }
            }
          }
        } catch (e) {
          console.error("Error fetching fresh profile doc:", e);
        }
      };
      fetchFreshDoc();

      // Fetch related statistics
      fetchMekhalaStats();
    }
  }, [userData]);

  const fetchMekhalaStats = async () => {
    try {
      if (!userData) return;
      const isSubMekhala = userData.mekhalaDocType === "sub_mekhala";

      // Count helper — queries all madarsaId storage variants
      const countFor = async (collName, rawId) => {
        if (!rawId) return 0;
        const strId = String(rawId);
        const numStr = strId.replace(/^[a-zA-Z]+-/, "");
        const numVal = Number(numStr);
        const strVariants = [
          ...new Set([strId, numStr, `mid-${numStr}`, `mld-${numStr}`]),
        ];
        const results = await Promise.all([
          ...strVariants.map((v) =>
            getDocs(
              query(collection(db, collName), where("madarsaId", "==", v)),
            )
              .then((s) => s.size)
              .catch(() => 0),
          ),
          ...(Number.isFinite(numVal) && numVal > 0
            ? [
              getDocs(
                query(
                  collection(db, collName),
                  where("madarsaId", "==", numVal),
                ),
              )
                .then((s) => s.size)
                .catch(() => 0),
            ]
            : []),
        ]);
        return results.reduce((a, b) => a + b, 0);
      };

      if (isSubMekhala) {
        // Sub-mekhala: scope to this mekhala's madarsas by name
        const specificName = userData.mekhalaName || userData.name || "";

        // Fetch parent district name from mekhala collection
        const parentId = userData.parentMekhalaId || userData.mekhalaId;
        if (parentId) {
          const parentDoc = await getDoc(doc(db, "mekhala", parentId));
          if (parentDoc.exists()) {
            const pd = parentDoc.data();
            setParentDistrict(pd.district || pd.name || "");
          }
        }

        const madarsasSnap = await getDocs(query(collection(db, "madarsas")));
        const filtered = madarsasSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => madrasaMatchesMekhala(m, specificName));

        const counts = await Promise.all(
          filtered.map((m) =>
            Promise.all([
              countFor("students", m.madarsaId || m.id),
              countFor("teachers", m.madarsaId || m.id),
            ]),
          ),
        );
        const totalStudents = counts.reduce((s, [sc]) => s + sc, 0);
        const totalTeachers = counts.reduce((s, [, tc]) => s + tc, 0);
        setStats({
          totalMadarsas: filtered.length,
          totalStudents,
          totalTeachers,
        });
        return;
      }

      // District-level admin
      const mekhalaId = userData.uid || userData.id;
      const [districtsSnapshot, freshMekhalaDoc] = await Promise.all([
        getDocs(
          query(
            collection(db, "districts"),
            where("mekhalaId", "==", mekhalaId),
          ),
        ),
        getDoc(doc(db, "mekhala", mekhalaId)),
      ]);
      const freshDistrictNames = freshMekhalaDoc.exists()
        ? freshMekhalaDoc.data().districts || []
        : [];
      const collectionNames = districtsSnapshot.docs.map((d) =>
        d.data().name?.toLowerCase(),
      );
      const allDistrictNamesLower = new Set([
        ...collectionNames,
        ...freshDistrictNames.map((n) => n.toLowerCase()),
      ]);

      const madarsasSnap = await getDocs(query(collection(db, "madarsas")));
      const filtered = madarsasSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (m) =>
            allDistrictNamesLower.has((m.district || "").toLowerCase()) ||
            m.mekhalaId === mekhalaId,
        );

      const counts = await Promise.all(
        filtered.map((m) =>
          Promise.all([
            countFor("students", m.madarsaId || m.id),
            countFor("teachers", m.madarsaId || m.id),
          ]),
        ),
      );
      const totalStudents = counts.reduce((s, [sc]) => s + sc, 0);
      const totalTeachers = counts.reduce((s, [, tc]) => s + tc, 0);
      setStats({
        totalMadarsas: filtered.length,
        totalStudents,
        totalTeachers,
      });
    } catch (error) {
      console.error("Error fetching mekhala stats:", error);
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

      // Update document in correct collection (sub_mekhala → districts, else → mekhala)
      const isSubMekhala = userData.mekhalaDocType === "sub_mekhala";
      const collName = isSubMekhala ? "districts" : "mekhala";
      const mekhalaDocRef = doc(db, collName, userData.uid);
      // Safe trim — guard against undefined/null field values
      const s = (v) => (v || "").toString().trim();
      await updateDoc(mekhalaDocRef, {
        ...(s(profileData.name) && { name: s(profileData.name) }),
        ...(s(profileData.email) && { email: s(profileData.email) }),
        ...(s(profileData.loginId) && { loginId: s(profileData.loginId) }),
        phone: s(profileData.phone),
        address: s(profileData.address),
        district: s(profileData.district),
        state: s(profileData.state),
        ...(s(profileData.password) && { password: s(profileData.password) }),
        status: profileData.status || "active",
        updatedAt: new Date().toISOString(),
      });

      // Update userData in store
      const updatedUserData = {
        ...userData,
        ...profileData,
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

  const handlePhotoUpload = async (file) => {
    if (!file || !userData?.uid) return;
    try {
      setPhotoUploading(true);
      const ext = file.name.split(".").pop();
      const fileName = `mekhala/profile/${userData.uid}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      const isSubMekhala = userData.mekhalaDocType === "sub_mekhala";
      const collName = isSubMekhala ? "districts" : "mekhala";
      await updateDoc(doc(db, collName, userData.uid), {
        profilePhoto: photoURL,
      });
      setProfilePhotoUrl(photoURL);
      setUserData({ ...userData, profilePhoto: photoURL });
      setPhotoFile(null);
      toast.success("Profile photo updated!");
    } catch (err) {
      console.error("Photo upload error:", err);
      toast.error("Failed to upload photo");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleCancel = () => {
    setProfileData(originalData);
    setEditing(false);
  };

  // Safely convert any date value (Firestore Timestamp, JS Date, seconds number, ISO string) to a readable string
  const formatDate = (val) => {
    if (!val) return "Not available";
    try {
      // Firestore Timestamp object
      if (typeof val.toDate === "function")
        return val.toDate().toLocaleDateString();
      // { seconds, nanoseconds } plain object (serialised Timestamp)
      if (typeof val === "object" && val.seconds != null)
        return new Date(val.seconds * 1000).toLocaleDateString();
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toLocaleDateString();
    } catch {
      /* fall through */
    }
    return "Not available";
  };

  if (!userData || userData.role !== "mekhala_admin") {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600">
              You need to be logged in as a Mekhala Admin to access this page.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const isDistrictAdmin = userData?.portalType 
    ? userData.portalType === "district_portal"
    : userData?.mekhalaDocType !== "sub_mekhala";
  const entityName = isDistrictAdmin ? "District" : "Mekhala";
  const entityTitle = isDistrictAdmin ? "District" : "Mekhala Secretary";

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">{entityName} Profile</h1>
          <p className="text-indigo-100">
            Manage your profile information and view your administration
            statistics
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Building className="h-6 w-6 text-green-600" />
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
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-purple-600" />
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
                    {entityName} Secretary Profile Information
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
              {/* Profile Photo Upload */}
              <div className="flex flex-col items-center gap-4 pb-4 border-b">
                <div className="relative">
                  <div className="h-24 w-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                    {profilePhotoUrl ? (
                      <img
                        src={profilePhotoUrl}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-10 w-10 text-gray-400" />
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm font-medium text-gray-700">
                    Profile Photo
                  </p>
                  <div className="flex gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setPhotoFile(f);
                            handlePhotoUpload(f);
                          }
                        }}
                      />
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        Upload Photo
                      </span>
                    </label>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setPhotoFile(f);
                            handlePhotoUpload(f);
                          }
                        }}
                      />
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 cursor-pointer">
                        <Camera className="h-3.5 w-3.5" />
                        Camera
                      </span>
                    </label>
                  </div>
                  {photoUploading && (
                    <p className="text-xs text-gray-500">Uploading...</p>
                  )}
                </div>
              </div>

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{entityName}</Label>
                  {editing ? (
                    <Input
                      id="name"
                      value={profileData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      placeholder={`Enter ${entityName.toLowerCase()} name`}
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
                      {/* For sub-mekhala, show parent district name fetched from mekhala collection */}
                      {userData?.mekhalaDocType === "sub_mekhala"
                        ? parentDistrict ||
                        profileData.district ||
                        "Not provided"
                        : profileData.district || "Not provided"}
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
                          ? "bg-green-100 text-green-800"
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
                  {formatDate(userData.createdAt)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">
                  Last Updated
                </Label>
                <p className="text-sm text-gray-900 mt-1">
                  {formatDate(userData.updatedAt)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">
                  Role
                </Label>
                <div className="text-sm text-gray-900 mt-1">
                  <Badge
                    variant="outline"
                    className="bg-indigo-50 text-indigo-700"
                  >
                    {entityTitle}
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
