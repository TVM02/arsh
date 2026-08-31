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
  Users,
  User,
  UserCheck,
  Bell,
  Calendar,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { getDocuments, COLLECTIONS } from "@/lib/firestoreService";
import { where, orderBy } from "firebase/firestore";
import useAuthStore from "@/lib/authStore";
import Link from "next/link";

export default function MadarsaExamOverviewPage() {
  const { user, role } = useAuth();
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data States
  const [examNotices, setExamNotices] = useState([]);
  const [examTimetables, setExamTimetables] = useState([]);
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);

  const fetchExamNotices = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      const fetchedNotices = await getDocuments(
        COLLECTIONS.EXAM_NOTICES,
        constraints,
      );
      setExamNotices(fetchedNotices.slice(0, 5)); // Get latest 5
    } catch (error) {
      console.error("Error fetching exam notices:", error);
    }
  }, []);

  const fetchExamTimetables = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      const fetchedTimetables = await getDocuments(
        COLLECTIONS.EXAM_TIMETABLES,
        constraints,
      );
      setExamTimetables(fetchedTimetables.slice(0, 5)); // Get latest 5
    } catch (error) {
      console.error("Error fetching exam timetables:", error);
    }
  }, []);

  const fetchRegisteredStudents = useCallback(async () => {
    try {
      let constraints;
      if (userData?.madarsaId) {
        constraints = [
          where("madarsaId", "==", userData.madarsaId),
          orderBy("createdAt", "desc"),
        ];
      } else {
        constraints = [orderBy("createdAt", "desc")];
      }

      const fetchedRegistrations = await getDocuments(
        COLLECTIONS.EXAM_REGISTRATIONS,
        constraints,
      );
      setRegisteredStudents(fetchedRegistrations);
    } catch (error) {
      console.error("Error fetching registered students:", error);
    }
  }, [userData?.madarsaId]);

  const fetchAllStudents = useCallback(async () => {
    try {
      let constraints = [];
      if (userData?.madarsaId) {
        constraints = [where("madarsaId", "==", userData.madarsaId)];
      }

      const fetchedStudents = await getDocuments(
        COLLECTIONS.ADMISSIONS,
        constraints,
      );
      const approvedStudents = fetchedStudents.filter(
        (student) => student.status === "approved",
      );
      setAllStudents(approvedStudents);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  }, [userData?.madarsa]);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchExamNotices(),
          fetchExamTimetables(),
          fetchRegisteredStudents(),
          fetchAllStudents(),
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load exam data");
      } finally {
        setLoading(false);
      }
    };

    if (user || userData) {
      fetchAllData();
    }
  }, [
    user,
    userData,
    fetchExamNotices,
    fetchExamTimetables,
    fetchRegisteredStudents,
    fetchAllStudents,
  ]);

  // Calculate student statistics
  const getStudentStats = () => {
    const maleStudents = allStudents.filter(
      (student) => student.gender === "male",
    ).length;
    const femaleStudents = allStudents.filter(
      (student) => student.gender === "female",
    ).length;
    const totalStudents = allStudents.length;

    return { maleStudents, femaleStudents, totalStudents };
  };

  const studentStats = getStudentStats();

  if (loading) {
    return (
      <Layout user={user} role={role}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading exam portal...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} role={role}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">Exam Management Overview</h1>
          <p className="text-blue-100">
            View exam notices, timetables, and manage student registrations from
            your madarsa
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Exam Notices */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">
                Recent Notices
              </CardTitle>
              <Link href="/dashboard/madarsa/exam/notices">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {examNotices.length === 0 ? (
                <p className="text-sm text-gray-500">No notices available</p>
              ) : (
                examNotices.map((notice) => (
                  <div key={notice.id} className="flex items-center space-x-3">
                    <Bell className="h-4 w-4 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {notice.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {notice.createdAt?.toDate?.()?.toLocaleDateString() ||
                          "Recently"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Exam Timetables */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">
                Recent Timetables
              </CardTitle>
              <Link href="/dashboard/madarsa/exam/timetables">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {examTimetables.length === 0 ? (
                <p className="text-sm text-gray-500">No timetables available</p>
              ) : (
                examTimetables.map((timetable) => (
                  <div
                    key={timetable.id}
                    className="flex items-center space-x-3"
                  >
                    <Calendar className="h-4 w-4 text-green-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {timetable.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {timetable.date?.toDate?.()?.toLocaleDateString() ||
                          "Recently"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Registered Students */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">
                Recent Registrations
              </CardTitle>
              <Link href="/dashboard/madarsa/exam/students">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {registeredStudents.length === 0 ? (
                <p className="text-sm text-gray-500">No registrations yet</p>
              ) : (
                registeredStudents.slice(0, 5).map((registration) => (
                  <div
                    key={registration.id}
                    className="flex items-center space-x-3"
                  >
                    <UserCheck className="h-4 w-4 text-purple-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {registration.studentName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {registration.examTitle}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
