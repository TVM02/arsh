"use client";

import { useState, useEffect, useRef } from "react";
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
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  BookOpen,
  Upload,
  BarChart3,
  Clock,
  User,
  FileText,
  Bell,
} from "lucide-react";
import useAuthStore from "@/lib/authStore";
import { format } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getAuth } from "firebase/auth";

export default function TeacherDashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalMaterials: 0,
    recentUploads: 0,
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, userData, loading: authLoading } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    // console.log("user", user)

    const fetchDashboardData = async () => {
      try {
        if (!isMounted) return;
        setLoading(true);

        // console.log(user);

        // Get user ID from either authStore or Firebase currentUser
        let userId = user?.uid;
        let madarsaId = userData?.madarsaId || "madarsa-001"; // Default madarsaId if not available

        if (!userId) {
          const currentUser = getAuth().currentUser;
          if (!currentUser) {
            // console.log("No authenticated user found.");
            if (isMounted) setLoading(false);
            return;
          }
          userId = currentUser.uid;
        }

        // Use default madarsaId if not available
        if (!madarsaId) {
          madarsaId = "madarsa-001";
        }

        // console.log("Fetching dashboard data for user:", userId, "madarsaId:", madarsaId);

        // Fetch madarsa info to get district and document ID
        let madarsaData = null;
        let madarsaDocId = "";
        const madarsaQuery = query(
          collection(db, "madarsas"),
          where("madarsaId", "==", madarsaId)
        );
        const madarsaSnapshot = await getDocs(madarsaQuery);
        if (!madarsaSnapshot.empty) {
          madarsaData = madarsaSnapshot.docs[0].data();
          madarsaDocId = madarsaSnapshot.docs[0].id;
        }

        // Fetch total students count
        const studentsQuery = query(
          collection(db, "students"),
          where("madarsaId", "==", madarsaId),
        );
        const studentsSnapshot = await getCountFromServer(studentsQuery);

        // Fetch total materials count (try assignments first, then materials as fallback)
        let materialsSnapshot;
        try {
          const materialsQuery = query(
            collection(db, "assignments"),
            where("createdBy", "==", userId),
            where("madarsaId", "==", madarsaId),
          );
          materialsSnapshot = await getCountFromServer(materialsQuery);
        } catch (error) {
          // console.log("Assignments collection not found, trying materials...");
          const materialsQuery = query(
            collection(db, "materials"),
            where("createdBy", "==", userId),
            where("madarsaId", "==", madarsaId),
          );
          materialsSnapshot = await getCountFromServer(materialsQuery);
        }

        // Fetch recent uploads (last 7 days)
        let recentMaterialsSnapshot;
        try {
          const recentMaterialsQuery = query(
            collection(db, "assignments"),
            where("createdBy", "==", userId),
            where("madarsaId", "==", madarsaId),
            where(
              "createdAt",
              ">=",
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            ),
          );
          const recentDocs = await getDocs(recentMaterialsQuery);
          recentMaterialsSnapshot = {
            data: () => ({ count: recentDocs.size }),
          };
        } catch (error) {
          // console.log("Recent assignments not found, setting to 0");
          recentMaterialsSnapshot = { data: () => ({ count: 0 }) };
        }

        // Fetch recent activities (last 5 actions)
        const activitiesQuery = query(
          collection(db, "notices"),
          where("showOnDashboard", "==", true),
          orderBy("createdAt", "desc"),
          limit(10), // Fetch more to account for filtering
        );
        const activitiesSnapshot = await getDocs(activitiesQuery);
        const activitiesData = activitiesSnapshot.docs.map((doc) => {
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
            createdByRole: data.createdByRole,
            targetType: data.targetType,
            targetDistricts: data.targetDistricts,
            targetMadarsas: data.targetMadarsas,
            deleted: data.deleted,
          };
        });

        // Filter out expired notices

        // console.log(userData)

        const currentDate = new Date();
        const validNotices = activitiesData
          .filter((notice) => {
            // If expired, filter out
            if (notice.expiryDate && notice.expiryDate <= currentDate)
              return false;
            if (notice.deleted === true) return false;

            // If mekhala notice:
            if (notice.createdByRole === "mekhala_admin") {
              if (notice.targetType === "all" || notice.targetType === "teachers_portal") {
                return madarsaData && notice.targetDistricts?.includes(madarsaData.district);
              }
              if (notice.targetType === "specific_districts") {
                return madarsaData && notice.targetDistricts?.includes(madarsaData.district);
              }
              if (notice.targetType === "specific_madarsas") {
                return notice.targetMadarsas?.includes(madarsaId) || (madarsaDocId && notice.targetMadarsas?.includes(madarsaDocId));
              }
              return false;
            }

            // Filter by targetAudience: show 'all' or 'teachers'
            const audience = notice.targetAudience?.toLowerCase();
            if (audience !== "all" && audience !== "teachers") return false;
            // If madarsaId is set, only show if matches current user's madarsaId
            if (notice.madarsaId && notice.madarsaId !== userData?.madarsaId)
              return false;
            return true;
          })
          .slice(0, 5); // Take only first 5 after filtering

        setStats({
          totalStudents: studentsSnapshot.data().count,
          totalMaterials: materialsSnapshot.data().count,
          recentUploads: recentMaterialsSnapshot.data().count,
        });

        if (isMounted) {
          setRecentActivities(validNotices);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Only fetch data once auth has been initialized
    if (user) {
      fetchDashboardData();
    } else if (!authLoading && !user) {
      setLoading(false);
    } else {
      // console.log("Waiting for auth to load or user data to be available");
    }

    return () => {
      isMounted = false;
    };
  }, [user, userData, authLoading]);

  const formatDate = (date) => {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  // Get current user from Firebase as fallback
  const currentUser = getAuth().currentUser;
  const displayUser = user || currentUser;

  // Show error if no user is found
  if (!displayUser) {
    return (
      <Layout user={displayUser}>
        <div className="flex justify-center items-center h-64 px-4">
          <div className="text-center">
            <p className="text-red-600 mb-4 text-sm md:text-base">
              Authentication required
            </p>
            <p className="text-gray-600 text-sm md:text-base">
              Please log in to access the teacher dashboard
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={displayUser}>
      <div className="space-y-4 md:space-y-6 px-4 md:px-0">
        {/* Marquee Notice Banner */}
        {recentActivities.length > 0 && (
          <div className="bg-green-600 text-white py-2 sm:py-3 px-4 rounded-lg shadow-md overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 flex-shrink-0 animate-pulse" />
              <span className="text-xs sm:text-sm font-semibold">
                Latest Notices:
              </span>
            </div>
            <div className="relative overflow-hidden">
              <div className="animate-marquee whitespace-nowrap inline-block">
                {[...recentActivities, ...recentActivities].map(
                  (notice, index) => (
                    <span
                      key={`${notice.id}-${index}`}
                      className="inline-flex items-center mr-8 sm:mr-12"
                    >
                      <span className="text-sm sm:text-base font-medium">
                        {notice.title}
                      </span>
                      <span className="mx-2 sm:mx-3 text-green-200">•</span>
                      <span className="text-xs sm:text-sm text-green-100">
                        {notice.content?.substring(0, 100)}...
                      </span>
                      {index < recentActivities.length * 2 - 1 && (
                        <span className="mx-3 sm:mx-4 text-green-300">|</span>
                      )}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-4 md:p-6 text-white">
          <h1 className="text-xl md:text-2xl font-bold mb-2">
            Welcome, {displayUser?.displayName || userData?.name || "Teacher"}!
          </h1>
          <p className="text-green-100 text-sm md:text-base">
            Manage your students and educational content.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-gray-600">
                    Total Students
                  </p>
                  <p className="text-xl md:text-2xl font-bold">
                    {stats.totalStudents}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-gray-600">
                    Materials Uploaded
                  </p>
                  <p className="text-xl md:text-2xl font-bold">
                    {stats.totalMaterials}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Upload className="h-5 w-5 md:h-6 md:w-6 text-yellow-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-gray-600">
                    Recent Uploads
                  </p>
                  <p className="text-xl md:text-2xl font-bold">
                    {stats.recentUploads}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-xl">
                Quick Actions
              </CardTitle>
              <CardDescription className="text-sm md:text-base">
                Common tasks and shortcuts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6 pt-0">
              <Button
                asChild
                className="w-full justify-start text-sm md:text-base"
                variant="outline"
                size="sm"
              >
                <Link href="/dashboard/teacher/materials">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Material
                </Link>
              </Button>
              <Button
                asChild
                className="w-full justify-start text-sm md:text-base"
                variant="outline"
                size="sm"
              >
                <Link href="/dashboard/teacher/students">
                  <Users className="h-4 w-4 mr-2" />
                  View Students ({stats.totalStudents})
                </Link>
              </Button>
              <Button
                asChild
                className="w-full justify-start text-sm md:text-base"
                variant="outline"
                size="sm"
              >
                <Link href="/dashboard/teacher/notices">
                  <FileText className="h-4 w-4 mr-2" />
                  Manage Notices
                </Link>
              </Button>
              <Button
                asChild
                className="w-full justify-start text-sm md:text-base"
                variant="outline"
                size="sm"
              >
                <Link href="/dashboard/teacher/profile">
                  <User className="h-4 w-4 mr-2" />
                  View Profile
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Bell className="w-4 h-4 md:w-5 md:h-5" />
                <span>Recent Notices</span>
              </CardTitle>
              <CardDescription className="text-sm md:text-base">
                Latest notices posted for your madarsa
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="space-y-3 md:space-y-4">
                {recentActivities.length > 0 ? (
                  recentActivities.map((notice) => (
                    <div
                      key={notice.id}
                      className="border rounded-lg p-3 md:p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 space-y-2 sm:space-y-0">
                        <h3 className="font-semibold text-base md:text-lg break-words">
                          {notice.title || "Untitled Notice"}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {notice.priority && (
                            <Badge
                              className={`${getPriorityColor(notice.priority)} text-xs`}
                            >
                              {notice.priority}
                            </Badge>
                          )}
                          {notice.targetAudience && (
                            <Badge
                              className={`${getAudienceColor(notice.targetAudience)} text-xs`}
                            >
                              {notice.targetAudience === "all"
                                ? "All"
                                : notice.targetAudience}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p className="whitespace-pre-wrap text-gray-600 mb-3 text-sm md:text-base break-words">
                        {notice.content || "No content available"}
                      </p>

                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-4 text-xs md:text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <span>Posted by:</span>
                          <span className="font-medium">
                            {notice.createdByName || "Unknown"}
                          </span>
                        </div>
                        {notice.createdAt && (
                          <div className="flex items-center gap-1">
                            <span>Posted on:</span>
                            <span>{formatDate(notice.createdAt)}</span>
                          </div>
                        )}
                        {notice.expiryDate && (
                          <div className="flex items-center gap-1">
                            <span>Expires:</span>
                            <span>{formatDate(notice.expiryDate)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 md:py-4">
                    <p className="text-gray-500 text-sm md:text-base">
                      No recent notices to display
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
