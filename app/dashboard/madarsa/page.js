"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileText, GraduationCap, BarChart3, Bell, MapPin, Phone, Mail, Calendar } from "lucide-react";
import useAuthStore from "@/lib/authStore";
import {
  collection,
  query,
  where,
  getCountFromServer,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";

export default function MahalDashboard() {
  const { user, userData, initializeAuth } = useAuthStore();
  const [stats, setStats] = useState({
    totalApplications: 0,
    pendingAdmissions: 0,
    totalTeachers: 0,
    totalStudents: 0,
    approvedAdmissions: 0,
    rejectedAdmissions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentNotices, setRecentNotices] = useState([]);
  const [mekhalaNotices, setMekhalaNotices] = useState([]);
  const [madarsaProfile, setMadarsaProfile] = useState(null);

  useEffect(() => {
    // console.log(user, userData);
    const fetchData = async () => {
      try {
        setLoading(true);

        // console.log(user);

        const madarsaId = userData?.madarsaId || "madarsa-001"; // Fallback to default madarsaId

        // Fetch counts from Firestore.
        // - Students count comes from the 'students' collection (same source as the Students tab)
        // - Pending/Rejected counts come from 'admissions' collection (application pipeline)
        // This ensures dashboard numbers always match what you see on each respective page.
        const [
          teachersCount,
          studentsCount,
          pendingAdmissionsCount,
          rejectedAdmissionsCount,
        ] = await Promise.all([
          getCountFromServer(
            query(collection(db, "teachers"), where("madarsaId", "==", madarsaId))
          ),
          // Total enrolled students — mirrors Students page count
          getCountFromServer(
            query(collection(db, "students"), where("madarsaId", "==", madarsaId))
          ),
          getCountFromServer(
            query(
              collection(db, "admissions"),
              where("madarsa", "==", madarsaId),
              where("status", "in", ["pending", "confirmed"])
            )
          ),
          getCountFromServer(
            query(
              collection(db, "admissions"),
              where("madarsa", "==", madarsaId),
              where("status", "==", "rejected")
            )
          ),
        ]);

        // Fetch recent notices (last 5)
        const noticesQuery = query(
          collection(db, "notices"),
          // where('madarsaId', '==', madarsaId),
          where("showOnDashboard", "==", true),
          orderBy("createdAt", "desc"),
          limit(5)
        );

        const noticesSnapshot = await getDocs(noticesQuery);
        const notices = noticesSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title,
            content: data.content,
            priority: data.priority,
            targetAudience: data.targetAudience,
            createdAt: data.createdAt?.toDate(),
            createdByName: data.createdByName,
            expiryDate: data.expiryDate?.toDate(),
            madarsaId: data.madarsaId,
          };
        });

        const currentDate = new Date();
        // console.log(notices)

        const validNotices = notices.filter((notice) => {
          if (!notice.expiryDate) return true; // No expiry date means always valid
          return notice.expiryDate > currentDate;
        });

        // Filter by targetAudience: show 'all', 'madarsas', or madarsa-specific notices
        const filteredNotices = validNotices.filter((notice) => {
          const audience = notice.targetAudience?.toLowerCase();
          // Show if targetAudience is 'all', 'madarsas', or if it matches this madarsa
          return audience === 'all' || audience === 'madarsas' || notice.madarsaId === madarsaId;
        });

        const pending = pendingAdmissionsCount.data().count;
        const totalStudents = studentsCount.data().count;
        const rejected = rejectedAdmissionsCount.data().count;

        setStats({
          // totalApplications = pending + enrolled students + rejected (full pipeline)
          totalApplications: pending + totalStudents + rejected,
          totalTeachers: teachersCount.data().count,
          pendingAdmissions: pending,
          // totalStudents mirrors the Students page exactly (from students collection)
          totalStudents,
          // approvedAdmissions = students in students collection (created when admission is approved)
          approvedAdmissions: totalStudents,
          rejectedAdmissions: rejected,
        });

        setRecentNotices(filteredNotices);

        // Mekhala notices and madarsa profile are fetched in a separate effect
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    if (user && userData?.madarsaId) {
      fetchData();
    } else {
      initializeAuth();
    }
  }, [user, userData, initializeAuth, madarsaProfile]);

  // Separate effect to fetch madarsa profile and mekhala notices
  useEffect(() => {
    const fetchProfileAndMekhala = async () => {
      try {
        const madarsaId = userData?.madarsaId;
        if (!madarsaId) return;

        // Fetch madarsa profile
        const madarsaQ = query(collection(db, 'madarsas'), where('madarsaId', '==', madarsaId));
        const madarsaSnap = await getDocs(madarsaQ);
        let madarsaData = null;
        if (!madarsaSnap.empty) {
          madarsaData = { id: madarsaSnap.docs[0].id, ...madarsaSnap.docs[0].data() };
          setMadarsaProfile(madarsaData);
        }

        // Fetch recent mekhala notices and filter by target
        const mekhalNoticesQuery = query(
          collection(db, 'notices'),
          orderBy('createdAt', 'desc'),
          limit(3)
        );
        const mekhalNoticesSnapshot = await getDocs(mekhalNoticesQuery);
        const allMekhalNotices = mekhalNoticesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const relevantMekhalNotices = allMekhalNotices.filter(notice => {
          if (!notice.targetType) return false;
          if (notice.targetType === 'all' || notice.targetType === 'all_sadar_portals') return true;
          if (notice.targetType === 'specific_districts') return notice.targetDistricts?.includes(madarsaData?.district);
          if (notice.targetType === 'specific_madarsas') return notice.targetMadarsas?.includes(madarsaId) || notice.targetMadarsas?.includes(madarsaData?.id);
          return false;
        });
        setMekhalaNotices(relevantMekhalNotices);
      } catch (err) {
        console.error('Error fetching profile or mekhala notices:', err);
      }
    };

    if (userData?.madarsaId) fetchProfileAndMekhala();
  }, [userData?.madarsaId]);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getAudienceColor = (audience) => {
    switch (audience) {
      case "teachers":
        return "bg-blue-100 text-blue-800";
      case "students":
        return "bg-purple-100 text-purple-800";
      case "all":
        return "bg-teal-100 text-teal-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Layout user={user} role={userData?.role || user?.role}>
      <div className="space-y-4 md:space-y-6 p-3 sm:p-4 md:p-6 lg:p-0">
        {/* Marquee Notice Banner */}
        {recentNotices.length > 0 && (
          <div className="bg-green-600 text-white py-2 sm:py-3 px-4 rounded-lg shadow-md overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 flex-shrink-0 animate-pulse" />
              <span className="text-xs sm:text-sm font-semibold">Latest Notices:</span>
            </div>
            <div className="relative overflow-hidden">
              <div className="animate-marquee whitespace-nowrap inline-block">
                {[...recentNotices, ...recentNotices].map((notice, index) => (
                  <span key={`${notice.id}-${index}`} className="inline-flex items-center mr-8 sm:mr-12">
                    <span className="text-sm sm:text-base font-medium">{notice.title}</span>
                    <span className="mx-2 sm:mx-3 text-green-200">•</span>
                    <span className="whitespace-pre-wrap text-xs sm:text-sm text-green-100">{notice.content.substring(0, 100)}...</span>
                    {index < (recentNotices.length * 2) - 1 && (
                      <span className="mx-3 sm:mx-4 text-green-300">|</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-4 sm:p-5 md:p-6 text-white">
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-2 leading-tight">
            Office Administration Dashboard
          </h1>
          <p className="text-sm md:text-base text-purple-100 leading-relaxed">
            Manage your office staff, students, and notices.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8 sm:py-10 md:py-12">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 border-4 border-teal-600 border-t-transparent"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="h-5 w-5 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm md:text-sm text-gray-600 truncate font-medium">Total Applications</p>
                      <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                        {stats.totalApplications}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 sm:h-5 sm:w-5 md:h-6 md:w-6 text-orange-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm md:text-sm text-gray-600 truncate font-medium">
                        Pending Admissions
                      </p>
                      <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                        {stats.pendingAdmissions}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="h-5 w-5 sm:h-5 sm:w-5 md:h-6 md:w-6 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm md:text-sm text-gray-600 truncate font-medium">Teachers</p>
                      <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                        {stats.totalTeachers}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="h-5 w-5 sm:h-5 sm:w-5 md:h-6 md:w-6 text-teal-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm md:text-sm text-gray-600 truncate font-medium">
                        Approved Admissions
                      </p>
                      <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                        {stats.approvedAdmissions}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Madarsa Profile Section */}
            {madarsaProfile && (
              <div className="mt-4">
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="p-4 sm:p-5 md:p-6">
                    <CardTitle className="text-base sm:text-lg md:text-xl font-semibold">Madarsa Profile</CardTitle>
                    <CardDescription className="text-sm md:text-base text-gray-600 leading-relaxed">
                      Details fetched from the database
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 md:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Name</label>
                        <p className="font-medium text-gray-900">{madarsaProfile.name || madarsaProfile.displayName || madarsaProfile.madarsaId}</p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-500">Madarsa ID</label>
                        <p className="font-medium text-gray-900">{madarsaProfile.madarsaId}</p>
                      </div>

                      {madarsaProfile.adminName && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Administrator</label>
                          <p className="font-medium">{madarsaProfile.adminName}</p>
                        </div>
                      )}

                      {madarsaProfile.address && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Address</label>
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                            <p className="font-medium">{madarsaProfile.address}</p>
                          </div>
                        </div>
                      )}

                      {(madarsaProfile.adminPhone || madarsaProfile.phone) && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Phone</label>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <p className="font-medium">{madarsaProfile.adminPhone || madarsaProfile.phone}</p>
                          </div>
                        </div>
                      )}

                      {madarsaProfile.email && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Email</label>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <p className="font-medium">{madarsaProfile.email}</p>
                          </div>
                        </div>
                      )}

                      {madarsaProfile.established && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Established</label>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <p className="font-medium">{madarsaProfile.established}</p>
                          </div>
                        </div>
                      )}

                      {madarsaProfile.capacity && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Capacity</label>
                          <p className="font-medium">{madarsaProfile.capacity} students</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="p-4 sm:p-5 md:p-6">
                  <CardTitle className="text-base sm:text-lg md:text-xl font-semibold">Student Management</CardTitle>
                  <CardDescription className="text-sm md:text-base text-gray-600 leading-relaxed">
                    Manage student admissions and records
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3 md:space-y-4 p-4 sm:p-5 md:p-6 pt-0">
                  <Button
                    className="w-full justify-start h-auto py-3 sm:py-3.5 px-3 sm:px-4 text-sm md:text-base font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    variant="outline"
                    asChild
                  >
                    <Link href="/dashboard/madarsa/applications" className="flex items-center min-h-[44px]">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 flex-shrink-0" />
                      <span className="truncate text-left">Review Applications ({stats.pendingAdmissions})</span>
                    </Link>
                  </Button>
                  <Button
                    className="w-full justify-start h-auto py-3 sm:py-3.5 px-3 sm:px-4 text-sm md:text-base font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    variant="outline"
                    asChild
                  >
                    <Link href="/dashboard/madarsa/students" className="flex items-center min-h-[44px]">
                      <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 flex-shrink-0" />
                      <span className="truncate text-left">Manage Students ({stats.totalStudents})</span>
                    </Link>
                  </Button>
                  <Button
                    className="w-full justify-start h-auto py-3 sm:py-3.5 px-3 sm:px-4 text-sm md:text-base font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    variant="outline"
                    asChild
                  >
                    <Link href="/dashboard/madarsa/notices" className="flex items-center min-h-[44px]">
                      <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 flex-shrink-0" />
                      <span className="truncate text-left">Notices</span>
                    </Link>
                  </Button>
                  <Button
                    className="w-full justify-start h-auto py-3 sm:py-3.5 px-3 sm:px-4 text-sm md:text-base font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    variant="outline"
                    asChild
                  >
                    <Link href="/dashboard/madarsa/assignments" className="flex items-center min-h-[44px]">
                      <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 flex-shrink-0" />
                      <span className="truncate text-left">All Assignments</span>
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="p-4 sm:p-5 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl font-semibold">
                    <Bell className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 flex-shrink-0" />
                    <span>Recent Notices</span>
                  </CardTitle>
                  <CardDescription className="text-sm md:text-base text-gray-600 leading-relaxed">
                    Latest notices posted for your madarsa
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
                  <div className="space-y-3 sm:space-y-4 max-h-80 sm:max-h-96 overflow-y-auto">
                    {recentNotices.length > 0 ? (
                      recentNotices.map((notice) => (
                        <div
                          key={notice.id}
                          className="border rounded-lg p-3 sm:p-4 hover:shadow-sm transition-shadow bg-white"
                        >
                          <div className="flex flex-col gap-2 mb-3">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                              <h3 className="font-semibold text-sm sm:text-base md:text-lg leading-tight text-gray-900 pr-2">
                                {notice.title}
                              </h3>
                              <div className="flex gap-1.5 sm:gap-2 flex-wrap sm:flex-shrink-0">
                                <Badge
                                  className={`text-xs font-medium ${getPriorityColor(notice.priority)}`}
                                >
                                  {notice.priority}
                                </Badge>
                                <Badge
                                  className={`text-xs font-medium ${getAudienceColor(
                                    notice.targetAudience
                                  )}`}
                                >
                                  {notice.targetAudience === "all"
                                    ? "All"
                                    : notice.targetAudience}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <p className="whitespace-pre-wrap text-gray-600 mb-3 text-sm md:text-base leading-relaxed">
                            {notice.content}
                          </p>

                          <div className="flex flex-col gap-1.5 sm:gap-2 text-xs md:text-sm text-gray-500">
                            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-4">
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Posted by:</span>
                                <span className="text-gray-700">
                                  {notice.createdByName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Posted:</span>
                                <span>{formatDate(notice.createdAt)}</span>
                              </div>
                              {notice.expiryDate && (
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">Expires:</span>
                                  <span>{formatDate(notice.expiryDate)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 sm:py-10 md:py-12">
                        <Bell className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm md:text-base font-medium">
                          No recent notices to display
                        </p>
                        <p className="text-gray-400 text-xs md:text-sm mt-1">
                          Check back later for updates
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Mekhala Notices Section */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="p-4 sm:p-5 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl font-semibold">
                    <Bell className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 flex-shrink-0 text-teal-600" />
                    <span>Mekhala Notices</span>
                    <Badge variant="outline" className="ml-auto bg-teal-50 text-teal-700 border-teal-200">
                      {mekhalaNotices.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-sm md:text-base text-gray-600 leading-relaxed">
                    Official notices from your Mekhala administration
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
                  <div className="space-y-3 sm:space-y-4 max-h-80 sm:max-h-96 overflow-y-auto">
                    {mekhalaNotices.length > 0 ? (
                      mekhalaNotices.map((notice) => (
                        <div
                          key={notice.id}
                          className="p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start gap-2 sm:gap-3">
                            <div className="flex-shrink-0 mt-1">
                              {notice.priority === 'high' ? (
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              ) : notice.priority === 'medium' ? (
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              ) : (
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm sm:text-base font-medium text-gray-900 truncate">
                                  {notice.title}
                                </h4>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs shrink-0 ${
                                    notice.priority === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                                    notice.priority === 'medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                    'bg-green-50 text-green-700 border-green-200'
                                  }`}
                                >
                                  {notice.priority || 'medium'}
                                </Badge>
                              </div>
                              <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 leading-relaxed mb-2">
                                {notice.content?.substring(0, 150)}...
                              </p>
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>
                                  {notice.createdAt ? new Date(notice.createdAt.toDate()).toLocaleDateString() : 'Recent'}
                                </span>
                                <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                                  {notice.targetType === 'all' ? 'All Madrasas' :
                                   notice.targetType === 'specific_districts' ? 'District-wise' :
                                   'Specific'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 sm:py-10 md:py-12">
                        <Bell className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm md:text-base font-medium">
                          No mekhala notices yet
                        </p>
                        <p className="text-gray-400 text-xs md:text-sm mt-1">
                          Official notices from your Mekhala will appear here
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* View All Button */}
                  {mekhalaNotices.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <Button 
                        variant="outline" 
                        className="w-full justify-center hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300"
                        asChild
                      >
                        <Link href="/dashboard/madarsa/mekhala-notices">
                          <Bell className="h-4 w-4 mr-2" />
                          View All Mekhala Notices
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
