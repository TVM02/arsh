"use client";

import { useState, useEffect } from "react";
import useAuthStore from "@/lib/authStore";
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
  FileText,
  Settings,
  BarChart3,
  Shield,
  UserCheck,
  Globe,
  Bell,
} from "lucide-react";
import { collection, getCountFromServer, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const NOTICE_COLLECTIONS = ["centralNotices", "examNotices", "notices"];

const getCollectionCount = async (collectionName) => {
  const snapshot = await getCountFromServer(collection(db, collectionName));
  return snapshot.data().count || 0;
};

const getDateValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  if (typeof value._seconds === "number")
    return new Date(value._seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isActiveNotice = (notice) => {
  if (notice.deleted || notice.isActive === false) return false;

  const expiryDate = getDateValue(
    notice.expiryDate || notice.expiresAt || notice.endDate,
  );

  return !expiryDate || expiryDate >= new Date();
};

const getActiveNoticeCount = async () => {
  const snapshots = await Promise.all(
    NOTICE_COLLECTIONS.map((collectionName) =>
      getDocs(collection(db, collectionName)),
    ),
  );

  const noticesByKey = new Map();

  snapshots.forEach((snapshot, index) => {
    const collectionName = NOTICE_COLLECTIONS[index];
    snapshot.docs.forEach((noticeDoc) => {
      const notice = { id: noticeDoc.id, ...noticeDoc.data() };
      const dedupeKey = notice.id || `${collectionName}:${noticeDoc.id}`;
      noticesByKey.set(dedupeKey, notice);
    });
  });

  return Array.from(noticesByKey.values()).filter(isActiveNotice).length;
};

export default function AdminDashboard() {
  const { userData } = useAuthStore();
  const role = userData?.role;
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalMahals: 0,
    totalMarquees: 0,
    activeMarquees: 0,
    activeNotices: 0,
    totalNotices: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRealData();
  }, []);

  const fetchRealData = async () => {
    try {
      setLoading(true);

      const [
        totalStudents,
        totalTeachers,
        totalMahals,
        totalMarquees,
        activeMarquees,
        noticeCounts,
        activeNotices,
      ] = await Promise.all([
        getCollectionCount("students"),
        getCollectionCount("teachers"),
        getCollectionCount("madarsas"),
        getCollectionCount("marqueeTexts"),
        getDocs(collection(db, "marqueeTexts")).then(
          (snapshot) =>
            snapshot.docs.filter((doc) => doc.data()?.isActive !== false)
              .length,
        ),
        Promise.all(NOTICE_COLLECTIONS.map(getCollectionCount)),
        getActiveNoticeCount(),
      ]);

      setStats({
        totalStudents,
        totalTeachers,
        totalMahals,
        totalMarquees,
        activeMarquees,
        activeNotices,
        totalNotices: noticeCounts.reduce((total, count) => total + count, 0),
      });
    } catch (error) {
      console.error("Error loading optimized data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="central_admin">
      <Layout>
        <div className="space-y-6">
          {/* Welcome Section */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-lg p-6 text-white">
            <h1 className="text-2xl font-bold mb-2">
              Central Administration Dashboard
            </h1>
            <p className="text-red-100">
              Complete system overview and management controls.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Students</p>
                    <p className="text-2xl font-bold">
                      {loading ? "..." : stats.totalStudents}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <UserCheck className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Teachers</p>
                    <p className="text-2xl font-bold">
                      {loading ? "..." : stats.totalTeachers}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Settings className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Madarsa</p>
                    <p className="text-2xl font-bold">
                      {loading ? "..." : stats.totalMahals}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Globe className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Marquees</p>
                    <p className="text-2xl font-bold">
                      {loading ? "..." : stats.totalMarquees}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Globe className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Active Notices</p>
                    <p className="text-2xl font-bold">
                      {loading ? "..." : stats.activeNotices}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                    <Bell className="h-6 w-6 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Notices</p>
                    <p className="text-2xl font-bold">
                      {loading ? "..." : stats.totalNotices}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Core Management</CardTitle>
                <CardDescription>
                  Essential administrative functions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() =>
                    (window.location.href = "/dashboard/dkju-control/students")
                  }
                >
                  <Users className="h-4 w-4 mr-2" />
                  Students ({stats.totalStudents})
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() =>
                    (window.location.href = "/dashboard/dkju-control/teachers")
                  }
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Teachers ({stats.totalTeachers})
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() =>
                    (window.location.href = "/dashboard/dkju-control/madarsas")
                  }
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Madarsa ({stats.totalMahals})
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() =>
                    (window.location.href = "/dashboard/dkju-control/exam/unpublished")
                  }
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Unpublished Results
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content & Communications</CardTitle>
                <CardDescription>
                  Website content and notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() =>
                    (window.location.href = "/dashboard/dkju-control/config")
                  }
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Marquee Texts ({stats.activeMarquees} active)
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() =>
                    (window.location.href = "/dashboard/dkju-control/notices")
                  }
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Notices ({stats.totalNotices})
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() =>
                    (window.location.href = "/dashboard/dkju-control/analytics")
                  }
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics & Reports
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Duplicate Applications Fixer (Central Admin only)
          {role === 'central_admin' && (
            <Card>
              <CardHeader>
                <CardTitle>Duplicate Applications</CardTitle>
                <CardDescription>Find and fix duplicate application IDs per madarsa</CardDescription>
              </CardHeader>
              <CardContent>
                <DuplicateApplications />
              </CardContent>
            </Card>
          )} */}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
