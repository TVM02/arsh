"use client";

import { useState, useEffect } from "react";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, MapPin, Users, Loader2, BookOpen } from "lucide-react";
import { db } from "@/lib/firebase";
import { fetchConvenerStats } from "@/lib/convenerData";

export default function ConvenerDashboard() {
  const { userData } = useAuthStore();
  const [stats, setStats] = useState({
    mekhalas: 0,
    madarsas: 0,
    teachers: 0,
    students: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData && userData.role === "convener_admin") {
      fetchDashboardStats();
    } else {
      setLoading(false);
    }
  }, [userData]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const statsData = await fetchConvenerStats(userData, db);
      setStats({
        mekhalas: statsData.mekhalas,
        madarsas: statsData.madarsas,
        teachers: statsData.teachers,
        students: statsData.students,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
        </div>
      </Layout>
    );
  }

  if (!userData || userData.role !== "convener_admin") {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You need to be logged in as a Convener Admin to access this page.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg p-6 text-white shadow-md">
          <h1 className="text-3xl font-bold mb-2">Convener Dashboard</h1>
          <p className="text-teal-100 text-lg">
            Welcome back, {userData.name || "Admin"}. Here&apos;s an overview of the state administration.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-t-4 border-t-teal-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Mekhala</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.mekhalas}</p>
                </div>
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
                  <MapPin className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-teal-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Madrasas</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.madarsas}</p>
                </div>
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
                  <Building className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-teal-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Teachers</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.teachers}</p>
                </div>
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-teal-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Students</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.students}</p>
                </div>
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
                  <BookOpen className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
