"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  GraduationCap,
  FileText,
  FileSpreadsheet,
  Award,
  Bell,
  MapPin,
  Phone,
  Mail,
  Calendar,
  BarChart3,
} from "lucide-react";
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

export default function ManagerDashboard() {
  const { userData } = useAuthStore();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalReports: 0,
    pendingAdmissions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentNotices, setRecentNotices] = useState([]);
  const [madarsaProfile, setMadarsaProfile] = useState(null);

  const madarsaId = userData?.madarsaId;
  const madarsaName = userData?.madarsaName;

  useEffect(() => {
    if (!madarsaId) return;
    const fetchStats = async () => {
      try {
        const [students, teachers, reports, pending] = await Promise.all([
          getCountFromServer(query(collection(db, "students"), where("madarsaId", "==", madarsaId))),
          getCountFromServer(query(collection(db, "teachers"), where("madarsaId", "==", madarsaId))),
          getCountFromServer(query(collection(db, "inspections"), where("selectedMadarsaId", "==", madarsaId), where("status", "in", ["approved", "submitted"]))),
          getCountFromServer(query(collection(db, "admissions"), where("madarsa", "==", madarsaId), where("status", "in", ["pending", "confirmed"]))),
        ]);
        setStats({
          totalStudents: students.data().count,
          totalTeachers: teachers.data().count,
          totalReports: reports.data().count,
          pendingAdmissions: pending.data().count,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [madarsaId]);

  useEffect(() => {
    if (!madarsaId) return;
    const fetchExtras = async () => {
      try {
        const madarsaQ = query(collection(db, "madarsas"), where("madarsaId", "==", madarsaId));
        const madarsaSnap = await getDocs(madarsaQ);
        if (!madarsaSnap.empty) {
          setMadarsaProfile({ id: madarsaSnap.docs[0].id, ...madarsaSnap.docs[0].data() });
        }

        const noticesSnap = await getDocs(
          query(collection(db, "notices"), where("showOnDashboard", "==", true), orderBy("createdAt", "desc"), limit(5))
        );
        const now = new Date();
        const notices = noticesSnap.docs
          .map((d) => { const data = d.data(); return { id: d.id, ...data, createdAt: data.createdAt?.toDate(), expiryDate: data.expiryDate?.toDate() }; })
          .filter((n) => !n.expiryDate || n.expiryDate > now)
          .filter((n) => { const aud = n.targetAudience?.toLowerCase(); return aud === "all" || aud === "management" || n.madarsaId === madarsaId; });
        setRecentNotices(notices);
      } catch (err) {
        console.error(err);
      }
    };
    fetchExtras();
  }, [madarsaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const getPriorityColor = (p) => {
    if (p === "high") return "bg-red-100 text-red-800 border-red-200";
    if (p === "medium") return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-green-100 text-green-800 border-green-200";
  };

  const getAudienceColor = (a) => {
    if (a === "teachers") return "bg-blue-100 text-blue-800";
    if (a === "students") return "bg-purple-100 text-purple-800";
    return "bg-teal-100 text-teal-800";
  };

  const formatDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const quickLinks = [
    { name: "Students", href: "/dashboard/manager/students", icon: Users, desc: "View all students" },
    { name: "Teachers", href: "/dashboard/manager/teachers", icon: GraduationCap, desc: "View all teachers" },
    { name: "Reports", href: "/dashboard/manager/reports", icon: FileText, desc: "View inspection reports" },
    { name: "Documents", href: "/dashboard/manager/documents", icon: FileSpreadsheet, desc: "Download & upload documents" },
    { name: "TC Requests", href: "/dashboard/manager/tc-requests", icon: Award, desc: "Transfer certificate requests" },
  ];

  return (
    <ProtectedRoute allowedRoles={["manager"]}>
      <Layout>
        <div className="space-y-4 md:space-y-6 p-3 sm:p-4 md:p-6 lg:p-0">
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
                      <span className="text-xs sm:text-sm text-green-100">{notice.content?.substring(0, 100)}...</span>
                      {index < recentNotices.length * 2 - 1 && <span className="mx-3 sm:mx-4 text-green-300">|</span>}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg p-4 sm:p-5 md:p-6 text-white">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-2 leading-tight">Management Portal Dashboard</h1>
            <p className="text-sm md:text-base text-teal-100 leading-relaxed">{madarsaName || "Your Madrasa"}</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-600 border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                {[
                  { label: "Total Students", value: stats.totalStudents, icon: Users, bg: "bg-blue-100", color: "text-blue-600" },
                  { label: "Pending Admissions", value: stats.pendingAdmissions, icon: FileText, bg: "bg-orange-100", color: "text-orange-600" },
                  { label: "Teachers", value: stats.totalTeachers, icon: GraduationCap, bg: "bg-green-100", color: "text-green-600" },
                  { label: "Inspection Reports", value: stats.totalReports, icon: BarChart3, bg: "bg-teal-100", color: "text-teal-600" },
                ].map((c) => (
                  <Card key={c.label} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3 sm:p-4 md:p-6">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 ${c.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
                          <c.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${c.color}`} />
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm text-gray-600 font-medium">{c.label}</p>
                          <p className="text-lg sm:text-2xl font-bold text-gray-900">{c.value}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {madarsaProfile && (
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="p-4 sm:p-5 md:p-6">
                    <CardTitle className="text-base sm:text-lg font-semibold">Madarsa Profile</CardTitle>
                    <CardDescription>Details fetched from the database</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {[
                        ["Name", madarsaProfile.name, null],
                        ["Madarsa ID", madarsaProfile.madarsaId, null],
                        ["Manager", madarsaProfile.managerName || madarsaProfile.adminName, null],
                        ["Address", madarsaProfile.address, MapPin],
                        ["Phone", madarsaProfile.phone, Phone],
                        ["Email", madarsaProfile.email, Mail],
                        ["Established", madarsaProfile.established, Calendar],
                      ].map(([label, val, Icon]) =>
                        val ? (
                          <div key={label}>
                            <label className="text-xs font-medium text-gray-500">{label}</label>
                            <div className="flex items-center gap-1 mt-0.5">
                              {Icon && <Icon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />}
                              <p className="font-medium text-gray-900">{val}</p>
                            </div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="p-4 sm:p-5 md:p-6">
                    <CardTitle className="text-base sm:text-lg font-semibold">Quick Access</CardTitle>
                    <CardDescription>Manage your madarsa</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 sm:space-y-3 p-4 sm:p-5 md:p-6 pt-0">
                    {quickLinks.map((l) => (
                      <Button key={l.name} className="w-full justify-start h-auto py-3 px-3 sm:px-4 text-sm font-medium hover:bg-gray-50 active:bg-gray-100" variant="outline" asChild>
                        <Link href={l.href} className="flex items-center min-h-[44px]">
                          <l.icon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 flex-shrink-0" />
                          <div className="text-left">
                            <p className="font-medium">{l.name}</p>
                            <p className="text-xs text-gray-500">{l.desc}</p>
                          </div>
                        </Link>
                      </Button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="p-4 sm:p-5 md:p-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                      <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                      Recent Notices
                    </CardTitle>
                    <CardDescription>Latest notices for your madarsa</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
                    <div className="space-y-3 max-h-80 sm:max-h-96 overflow-y-auto">
                      {recentNotices.length > 0 ? (
                        recentNotices.map((notice) => (
                          <div key={notice.id} className="border rounded-lg p-3 sm:p-4 hover:shadow-sm bg-white">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                              <h3 className="font-semibold text-sm sm:text-base text-gray-900">{notice.title}</h3>
                              <div className="flex gap-1.5 flex-wrap">
                                <Badge className={`text-xs ${getPriorityColor(notice.priority)}`}>{notice.priority}</Badge>
                                <Badge className={`text-xs ${getAudienceColor(notice.targetAudience)}`}>
                                  {notice.targetAudience === "all" ? "All" : notice.targetAudience}
                                </Badge>
                              </div>
                            </div>
                            <p className="whitespace-pre-wrap text-gray-600 text-sm leading-relaxed mb-2">{notice.content}</p>
                            <div className="text-xs text-gray-500 flex flex-wrap gap-3">
                              <span><span className="font-medium">By:</span> {notice.createdByName}</span>
                              <span><span className="font-medium">Posted:</span> {formatDate(notice.createdAt)}</span>
                              {notice.expiryDate && <span><span className="font-medium">Expires:</span> {formatDate(notice.expiryDate)}</span>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10">
                          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 text-sm font-medium">No recent notices</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
