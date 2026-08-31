"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/authUtils";
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
  FileCheck,
  Plus,
  Calendar,
  Users,
  Bell,
  ArrowRight,
  BookOpen,
  TrendingUp,
  IndianRupee,
} from "lucide-react";
import { getDocuments, COLLECTIONS } from "@/lib/firestoreService";
import { orderBy } from "firebase/firestore";
import Link from "next/link";

export default function ExamOverviewPage() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data States
  const [exams, setExams] = useState([]);
  const [examRegistrations, setExamRegistrations] = useState([]);
  const [examNotices, setExamNotices] = useState([]);
  const [examTimetables, setExamTimetables] = useState([]);

  // Fetch all data for overview
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        fetchedExams,
        fetchedRegistrations,
        fetchedNotices,
        fetchedTimetables,
      ] = await Promise.all([
        getDocuments(COLLECTIONS.EXAMS, [orderBy("createdAt", "desc")]),
        getDocuments(COLLECTIONS.EXAM_REGISTRATIONS, [
          orderBy("createdAt", "desc"),
        ]),
        getDocuments(COLLECTIONS.EXAM_NOTICES, [orderBy("createdAt", "desc")]),
        getDocuments(COLLECTIONS.EXAM_TIMETABLES, [
          orderBy("createdAt", "desc"),
        ]),
      ]);

      setExams(fetchedExams);
      setExamRegistrations(fetchedRegistrations);
      setExamNotices(fetchedNotices);
      setExamTimetables(fetchedTimetables);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to fetch exam data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Calculate statistics
  const stats = {
    totalExams: exams.length,
    activeExams: exams.filter((e) => e.isActive).length,
    totalRegistrations: examRegistrations.length,
    completedPayments: examRegistrations.filter(
      (r) => r.paymentStatus === "completed" || r.paymentStatus === "paid",
    ).length,
    totalNotices: examNotices.length,
    importantNotices: examNotices.filter((n) => n.isImportant).length,
    totalTimetables: examTimetables.length,
    totalRevenue: examRegistrations
      .filter(
        (r) => r.paymentStatus === "completed" || r.paymentStatus === "paid",
      )
      .reduce(
        (sum, r) =>
          sum + (parseFloat(r.paymentAmount) || parseFloat(r.examFees) || 0),
        0,
      ),
  };

  // Quick action cards
  const quickActions = [
    {
      title: "Create Exams",
      description: "Create and manage new exams",
      href: "/dashboard/dkju-control/exam/create",
      icon: FileCheck,
      color: "bg-blue-500",
      count: stats.totalExams,
      label: "Total Exams",
    },
    {
      title: "View Registrations",
      description: "Manage student registrations",
      href: "/dashboard/dkju-control/exam/registrations",
      icon: Users,
      color: "bg-green-500",
      count: stats.totalRegistrations,
      label: "Total Registrations",
    },
    {
      title: "Exam Notices",
      description: "Create and manage notices",
      href: "/dashboard/dkju-control/exam/notices",
      icon: Bell,
      color: "bg-orange-500",
      count: stats.totalNotices,
      label: "Total Notices",
    },
    {
      title: "Exam Timetables",
      description: "Upload and manage timetables",
      href: "/dashboard/dkju-control/exam/timetables",
      icon: Calendar,
      color: "bg-purple-500",
      count: stats.totalTimetables,
      label: "Total Timetables",
    },
    {
      title: "Hall Ticket Sequence",
      description: "Assign madrasa sequence numbers for hall ticket generation",
      href: "/dashboard/dkju-control/exam/hall-ticket-assignment",
      icon: TrendingUp,
      color: "bg-indigo-500",
      count: null,
      label: "Sequence Assignment",
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading exam data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Exam Management Overview
          </h1>
          <p className="text-gray-600">
            Comprehensive exam management dashboard for central admin
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Key Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <BookOpen className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Active Exams
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.activeExams}
                  </p>
                  <p className="text-xs text-gray-500">
                    of {stats.totalExams} total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Registrations
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.totalRegistrations}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stats.completedPayments} paid
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <IndianRupee className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{stats.totalRevenue}
                  </p>
                  <p className="text-xs text-gray-500">from payments</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Bell className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Important Notices
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.importantNotices}
                  </p>
                  <p className="text-xs text-gray-500">
                    of {stats.totalNotices} total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Link key={action.title} href={action.href}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-lg ${action.color}`}>
                        <action.icon className="h-6 w-6 text-white" />
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {action.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {action.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-gray-900">
                        {action.count}
                      </span>
                      <span className="text-xs text-gray-500">
                        {action.label}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Exams */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Recent Exams
                <Link href="/dashboard/dkju-control/exam/create">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create New
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {exams.length === 0 ? (
                <div className="text-center py-8">
                  <FileCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No exams created yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {exams.slice(0, 3).map((exam) => (
                    <div
                      key={exam.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {exam.title}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {exam.isActive ? "Active" : "Inactive"} • ₹{exam.fees}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {
                            examRegistrations.filter(
                              (r) => r.examId === exam.id,
                            ).length
                          }{" "}
                          registered
                        </p>
                      </div>
                    </div>
                  ))}
                  {exams.length > 3 && (
                    <div className="text-center pt-2">
                      <Link href="/dashboard/dkju-control/exam/create">
                        <Button variant="outline" size="sm">
                          View All Exams
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Notices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Recent Notices
                <Link href="/dashboard/dkju-control/exam/notices">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Notice
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {examNotices.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No notices created yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {examNotices.slice(0, 3).map((notice) => (
                    <div key={notice.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">
                            {notice.title}
                          </h4>
                          <p className="whitespace-pre-wrap text-sm text-gray-600 line-clamp-2">
                            {notice.content}
                          </p>
                        </div>
                        {notice.isImportant && (
                          <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full">
                            Important
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {examNotices.length > 3 && (
                    <div className="text-center pt-2">
                      <Link href="/dashboard/dkju-control/exam/notices">
                        <Button variant="outline" size="sm">
                          View All Notices
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
