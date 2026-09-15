"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, AlertCircle, Calendar } from "lucide-react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/digitalclassroom/Layout";
import { format } from "date-fns";

export default function StudentNoticesPage() {
  const { user, userData } = useAuthStore();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        setLoading(true);
        setError("");

        if (!user?.email) {
          setError("User not logged in");
          setLoading(false);
          return;
        }

        // First try to use userData if available
        let studentData = userData;

        // If userData doesn't have all required fields, fetch from students collection
        if (!studentData || !studentData.madarsaId) {
          const q = query(
            collection(db, "students"),
            where("email", "==", user.email)
          );
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
            setError("Student not found");
            return;
          }

          const studentDoc = querySnapshot.docs[0];
          studentData = studentDoc.data();
        }

        if (!studentData.madarsaId) {
          setError("Student information not complete - missing madarsa ID");
          return;
        }

        if (studentData.status && studentData.status !== "active") {
          setError(
            "Your account is not active. Please contact the administrator."
          );
          return;
        }

        // Get class level
        const classLevel =
          studentData.classLevel || studentData.class || studentData.grade;

        // Fetch madarsa details to get district and document ID
        let madarsaData = null;
        let madarsaDocId = "";
        const madarsaQuery = query(
          collection(db, "madarsas"),
          where("madarsaId", "==", studentData.madarsaId)
        );
        const madarsaSnapshot = await getDocs(madarsaQuery);
        if (!madarsaSnapshot.empty) {
          madarsaData = madarsaSnapshot.docs[0].data();
          madarsaDocId = madarsaSnapshot.docs[0].id;
        }

        // 1. Local Notices Query
        const localQuery = query(
          collection(db, "notices"),
          where("madarsaId", "==", studentData.madarsaId),
          where("targetAudience", "in", ["students", "all"])
        );

        // 2. Central Notices Query
        const centralQuery = query(
          collection(db, "notices"),
          where("targetAudience", "in", ["students", "all"])
        );

        // 3. Mekhala Notices Query
        const mekhalaQuery = query(
          collection(db, "notices"),
          where("createdByRole", "==", "mekhala_admin")
        );

        const [localSnapshot, centralSnapshot, mekhalaSnapshot] = await Promise.all([
          getDocs(localQuery),
          getDocs(centralQuery),
          getDocs(mekhalaQuery),
        ]);

        const localDocs = localSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const centralDocs = centralSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const mekhalaDocs = mekhalaSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Merge and deduplicate by ID
        const allNoticesMap = new Map();

        [...localDocs, ...centralDocs, ...mekhalaDocs].forEach((notice) => {
          allNoticesMap.set(notice.id, notice);
        });

        const mergedNotices = Array.from(allNoticesMap.values());

        console.log(mergedNotices)

        // Apply filters
        const filteredNotices = mergedNotices.filter((notice) => {
          // 1. Active Check
          if (notice.isActive === false) return false;
          if (notice.deleted === true) return false;

          // 2. Mekhala Notice Target Check
          if (notice.createdByRole === "mekhala_admin") {
            if (notice.targetType === "all" || notice.targetType === "students_portal") {
              return madarsaData && notice.targetDistricts?.includes(madarsaData.district);
            }
            if (notice.targetType === "specific_districts") {
              return madarsaData && notice.targetDistricts?.includes(madarsaData.district);
            }
            if (notice.targetType === "specific_madarsas") {
              return notice.targetMadarsas?.includes(studentData.madarsaId) || (madarsaDocId && notice.targetMadarsas?.includes(madarsaDocId));
            }
            return false;
          }

          // 3. Central Notice Target Check
          if (notice.type === "central") {
            // If targetMahals is active/present and NOT empty, check if student's madarsa is included
            if (notice.targetMahals && notice.targetMahals.length > 0) {
              if (!notice.targetMahals.includes(studentData.madarsaId)) {
                return false;
              }
            }
            // If targetMahals is empty or undefined, it's for everyone -> Match
          }

          // 4. Class Level Check
          // If notice doesn't specify classLevel, it's for all classes
          if (!notice.classLevel) return true;
          // If notice is for "All" classes
          if (notice.classLevel === "All" || notice.classLevel === "all")
            return true;
          // If student has no class level, show all notices (permissive)
          if (!classLevel) return true;
          // Check if notice is for student's specific class
          if (Array.isArray(notice.classLevel)) {
            return (
              notice.classLevel.includes(classLevel) ||
              notice.classLevel.includes("All")
            );
          }
          return notice.classLevel === classLevel;
        });

        // Sort by createdAt descending
        filteredNotices.sort((a, b) => {
          const dateA = a.createdAt?.seconds
            ? a.createdAt.seconds
            : a.createdAt
            ? new Date(a.createdAt).getTime() / 1000
            : 0;
          const dateB = b.createdAt?.seconds
            ? b.createdAt.seconds
            : b.createdAt
            ? new Date(b.createdAt).getTime() / 1000
            : 0;
          return dateB - dateA;
        });

        setNotices(filteredNotices);
      } catch (err) {
        console.error("Error fetching notices:", err);
        setError("Failed to load notices. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (user?.email) {
      fetchNotices();
    }
  }, [user, userData]);

  const isExpired = (notice) => {
    if (!notice.expiryDate) return false;
    const expiryDate = notice.expiryDate.seconds
      ? new Date(notice.expiryDate.seconds * 1000)
      : new Date(notice.expiryDate);
    return expiryDate < new Date();
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

  const activeNotices = notices.filter((notice) => !isExpired(notice));
  const expiredNotices = notices.filter((notice) => isExpired(notice));

  const formatContentWithLinks = (content) => {
    if (!content) return "";
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.seconds
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);
    return format(date, "MMM d, yyyy");
  };

  return (
    <Layout user={user}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Notices
            </h1>
            <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">
              Important announcements
              {userData?.classLevel || userData?.class
                ? ` for Class ${userData.classLevel || userData.class}`
                : ""}
            </p>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center space-x-3">
                <Bell className="w-6 h-6 md:w-8 md:h-8 text-blue-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-gray-600">
                    Active Notices
                  </p>
                  <p className="text-lg md:text-xl font-bold">
                    {activeNotices.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-gray-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-gray-600">
                    Past Notices
                  </p>
                  <p className="text-lg md:text-xl font-bold">
                    {expiredNotices.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Active Notices */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center space-x-2 text-lg md:text-xl">
              <Bell className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
              <span>Current Notices ({activeNotices.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            {loading ? (
              <div className="text-center py-6 md:py-8">
                <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
                <p className="text-gray-600 mt-4 text-sm md:text-base">
                  Loading notices...
                </p>
              </div>
            ) : activeNotices.length === 0 ? (
              <div className="text-center py-6 md:py-8">
                <Bell className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-sm md:text-base">
                  No current notices available
                </p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {activeNotices.map((notice) => (
                  <Card
                    key={notice.id}
                    className="border-l-4 border-l-blue-500 hover:none-md transition-none"
                  >
                    <CardContent className="p-3 md:p-4">
                      <div className="space-y-2 md:space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                          <h3 className="text-base md:text-lg font-semibold break-words flex-1 text-gray-900 leading-tight">
                            {formatContentWithLinks(notice.title)}
                          </h3>
                          <div className="flex flex-wrap gap-2 flex-shrink-0">
                            {notice.type === "central" && (
                              <Badge className="bg-teal-600 hover:bg-teal-700 text-xs text-white">
                                Central
                              </Badge>
                            )}
                            <Badge
                              className={`${getPriorityColor(
                                notice.priority
                              )} text-xs`}
                            >
                              {notice.priority} priority
                            </Badge>
                          </div>
                        </div>

                        <p className="text-gray-600 whitespace-pre-wrap text-sm md:text-base break-words">
                          {formatContentWithLinks(notice.content)}
                        </p>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs md:text-sm text-gray-500 pt-2 border-t border-gray-100">
                          <div className="flex items-center space-x-1">
                            <span className="font-medium text-gray-600">
                              Posted:
                            </span>
                            <span>{formatDate(notice.createdAt)}</span>
                            {notice.createdByName && (
                              <span className="ml-1 text-gray-500">
                                by {notice.createdByName}
                              </span>
                            )}
                          </div>
                          {notice.expiryDate && (
                            <div className="flex items-center space-x-1 sm:ml-auto">
                              <Calendar className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                              <span>
                                Valid until: {formatDate(notice.expiryDate)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expired Notices */}
        {expiredNotices.length > 0 && (
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center space-x-2 text-lg md:text-xl">
                <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
                <span>Past Notices ({expiredNotices.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="space-y-3 md:space-y-4">
                {expiredNotices.map((notice) => (
                  <Card
                    key={notice.id}
                    className="border-l-4 border-l-gray-300 opacity-75 bg-gray-50"
                  >
                    <CardContent className="p-3 md:p-4">
                      <div className="space-y-2 md:space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                          <h3 className="text-base md:text-lg font-semibold break-words flex-1 text-gray-700">
                            {formatContentWithLinks(notice.title)}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {notice.type === "central" && (
                              <Badge variant="secondary" className="text-xs">
                                Central
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              EXPIRED
                            </Badge>
                          </div>
                        </div>

                        <p className="text-gray-500 whitespace-pre-wrap text-sm md:text-base break-words">
                          {formatContentWithLinks(notice.content)}
                        </p>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs md:text-sm text-gray-400">
                          <div className="flex items-center space-x-1">
                            <span>Posted: {formatDate(notice.createdAt)}</span>
                            {notice.createdByName && (
                              <span>by {notice.createdByName}</span>
                            )}
                          </div>
                          {notice.expiryDate && (
                            <div className="flex items-center space-x-1 sm:ml-auto text-red-400">
                              <Calendar className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                              <span>
                                Expired on: {formatDate(notice.expiryDate)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
