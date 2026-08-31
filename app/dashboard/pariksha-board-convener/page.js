"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/authUtils";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Download,
  User,
  IndianRupee,
  BookOpen,
  FileText,
  BarChart3,
  Bell,
  Globe,
  Eye,
  Upload,
} from "lucide-react";
import { COLLECTIONS } from "@/lib/firestoreService";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import { getConvenerDashboardStats } from "@/lib/firestoreQueries";

export default function ParikshaBoardConvenerDashboard() {
  const { user, role } = useAuth();
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data States
  const [stats, setStats] = useState({
    totalRegistrations: 0,
    maleStudents: 0,
    femaleStudents: 0,
    totalRevenue: 0,
  });
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch optimized stats
        const dashboardStats = await getConvenerDashboardStats();
        setStats(dashboardStats);

        // Fetch notices for convener
        const noticesQuery = query(
          collection(db, "notices"),
          where("showOnDashboard", "==", true),
          orderBy("createdAt", "desc"),
          limit(5),
        );
        const noticesSnapshot = await getDocs(noticesQuery);
        const noticesData = noticesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          expiryDate: doc.data().expiryDate?.toDate(),
        }));

        const currentDate = new Date();
        const validNotices = noticesData.filter((notice) => {
          if (notice.expiryDate && notice.expiryDate <= currentDate)
            return false;
          const audience = notice.targetAudience?.toLowerCase();
          return audience === "all" || audience === "convener";
        });

        setNotices(validNotices);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to fetch dashboard statistics");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <ProtectedRoute requiredRole="pariksha_board_convener">
        <Layout>
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading dashboard...</p>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="pariksha_board_convener">
      <Layout>
        <div className="space-y-6">
        {/* Marquee Notice Banner */}
        {notices.length > 0 && (
          <div className="bg-green-600 text-white py-2 sm:py-3 px-4 rounded-lg noow-md overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 flex-shrink-0 animate-pulse" />
              <span className="text-xs sm:text-sm font-semibold">
                Latest Notices:
              </span>
            </div>
            <div className="relative overflow-hidden">
              <div className="animate-marquee whitespace-nowrap inline-block">
                {[...notices, ...notices].map((notice, index) => (
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
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Welcome Section */}
        <div className="bg-teal-600 rounded-lg p-6 text-white noow-lg">
          <h1 className="text-2xl font-bold mb-2">
            Pariksha Board Convener Dashboard
          </h1>
          <p className="text-teal-50">
            Overview of all exam registrations across Madrasas and Mekhalas
          </p>
          {userData && (
            <p className="text-teal-100 mt-2 font-medium">
              Welcome, {userData.name}
            </p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={Users}
            label="Total Registrations"
            value={stats.totalRegistrations}
            color="text-blue-600"
            bgColor="bg-blue-100"
          />
          <StatCard
            icon={User}
            label="Male Students"
            value={stats.maleStudents}
            color="text-green-600"
            bgColor="bg-green-100"
          />
          <StatCard
            icon={User}
            label="Female Students"
            value={stats.femaleStudents}
            color="text-pink-600"
            bgColor="bg-pink-100"
          />
          <StatCard
            icon={IndianRupee}
            label="Total Revenue"
            value={`₹${stats.totalRevenue}`}
            color="text-purple-600"
            bgColor="bg-purple-100"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ActionCard
            title="Student Management"
            description="Manage student registrations and data"
            actions={[
              {
                label: `Manage Registrations`,
                icon: Users,
                href: "/dashboard/pariksha-board-convener/registrations",
              },
              {
                label: "Data Sheet (Excel Export)",
                icon: FileText,
                href: "/dashboard/pariksha-board-convener/data-sheet",
              },
            ]}
          />

          <ActionCard
            title="Examination Management"
            description="Handle examination processes and results"
            actions={[
              {
                label: "Active Exams",
                icon: BookOpen,
                href: "/dashboard/pariksha-board-convener/exams",
              },
             
              {
                label: "Unpublished Results",
                icon: Globe,
                href: "/dashboard/pariksha-board-convener/unpublished",
              },
              {
                label: "View Results",
                icon: Eye,
                href: "/dashboard/pariksha-board-convener/results",
              },
              {
                label: "Upload Results",
                icon: Upload,
                href: "/dashboard/pariksha-board-convener/results",
              },
            ]}
          />
        </div>
      </div>
    </Layout>
    </ProtectedRoute>
  );
}

function StatCard({ icon: Icon, label, value, color, bgColor }) {
  return (
    <Card className="border-none noow-md hover:noow-lg transition-noow">
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          <div
            className={`w-12 h-12 ${bgColor} rounded-full flex items-center justify-center`}
          >
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCard({ title, description, actions }) {
  return (
    <Card className="noow-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => (
          <Button
            key={index}
            className="w-full justify-start hover:bg-teal-50"
            variant="outline"
            onClick={() => (window.location.href = action.href)}
          >
            <action.icon className="h-4 w-4 mr-2" />
            {action.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
