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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, AlertCircle, Paperclip, Download } from "lucide-react";
import { getDocuments, COLLECTIONS } from "@/lib/firestoreService";
import { orderBy } from "firebase/firestore";
import useAuthStore from "@/lib/authStore";
import { formatDate } from "@/lib/dateUtils";

export default function StudentExamNoticesPage() {
  const { user } = useAuth();
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data States
  const [examNotices, setExamNotices] = useState([]);

  // Helper to normalize class names for comparison
  const cleanClass = (cls) => {
    if (!cls) return "";
    return cls
      .toString()
      .toLowerCase()
      .trim()
      .replace(/^\+/, "") // +2 becomes 2
      .replace(/^class\s+/i, ""); // "Class 2" becomes "2"
  };

  // Fetch exam notices
  const fetchExamNotices = useCallback(async () => {
    try {
      if (!userData?.classLevel) {
        console.warn("Student class not found in userData");
      }

      const studentClass = cleanClass(userData?.classLevel);
      const constraints = [orderBy("createdAt", "desc")];

      // Fetch both collections in parallel
      const [fetchedNotices, fetchedExams] = await Promise.all([
        getDocuments(COLLECTIONS.EXAM_NOTICES, constraints),
        getDocuments(COLLECTIONS.EXAMS, constraints),
      ]);

      // Create a map of exams for easy lookup
      const examMap = fetchedExams.reduce((acc, exam) => {
        acc[exam.id] = exam;
        return acc;
      }, {});

      // Filter standard notices for students that match the student's class (if examId is present)
      const studentNotices = fetchedNotices.filter((notice) => {
        const isRecipientsValid =
          notice.recipients && notice.recipients.includes("student");
        if (!isRecipientsValid) return false;

        // If notice is tied to an exam, check if that exam matches student's class
        if (notice.examId && examMap[notice.examId]) {
          const examClass = cleanClass(examMap[notice.examId].class);
          return examClass === studentClass;
        }

        // If it's a general notice without specific examId, show it to everyone
        return true;
      });

      // Process exam notices from exams collection that match the student's class
      const examNoticesList = fetchedExams
        .filter(
          (exam) => exam.notice && cleanClass(exam.class) === studentClass
        )
        .map((exam) => ({
          id: `exam-${exam.id}`,
          title: `Notice: ${exam.title}`,
          content: exam.notice,
          createdAt: exam.createdAt,
          type: "exam_specific",
          isImportant: false,
          recipients: ["student"],
          createdByName: exam.createdByName,
          examId: exam.id,
        }));

      // Merge and sort by date (newest first)
      const allNotices = [...studentNotices, ...examNoticesList].sort(
        (a, b) => {
          const dateA = a.createdAt?.toDate
            ? a.createdAt.toDate()
            : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate
            ? b.createdAt.toDate()
            : new Date(b.createdAt);
          return dateB - dateA;
        }
      );

      setExamNotices(allNotices);
    } catch (error) {
      console.error("Error fetching exam notices:", error);
      setError("Failed to load exam notices");
    }
  }, [userData]);

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);
        await fetchExamNotices();
      } catch (error) {
        console.error("Error initializing data:", error);
        setError("Failed to load exam notices");
      } finally {
        setLoading(false);
      }
    };

    if (user || userData) {
      initializeData();
    }
  }, [user, userData, fetchExamNotices]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading exam notices...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Exam Notices</h1>
            <p className="text-gray-600 mt-2">
              Stay updated with latest exam announcements
            </p>
          </div>
        </div>

        {/* Notices List */}
        <div className="grid gap-4">
          {examNotices.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium mb-2">
                  No notices available
                </p>
                <p className="text-gray-400">
                  Check back later for exam announcements
                </p>
              </CardContent>
            </Card>
          ) : (
            examNotices.map((notice) => (
              <Card
                key={notice.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">
                        {formatContentWithLinks(notice.title)}
                      </CardTitle>
                      <div className="flex items-center gap-2 mb-2">
                        {notice.isImportant && (
                          <Badge variant="destructive" className="text-xs">
                            Important
                          </Badge>
                        )}
                        {notice.recipients && notice.recipients.length > 0 ? (
                          <div className="flex gap-1">
                            {notice.recipients.map((recipient) => (
                              <Badge
                                key={recipient}
                                variant="secondary"
                                className="text-xs"
                              >
                                {recipient === "sadar"
                                  ? "Sadar"
                                  : recipient === "student"
                                  ? "Students"
                                  : recipient === "teacher"
                                  ? "Teachers"
                                  : recipient}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs text-red-600"
                          >
                            Showing to no one
                          </Badge>
                        )}
                        <span className="text-sm text-gray-500">
                          {formatDate(notice.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap mb-4">
                    {formatContentWithLinks(notice.content)}
                  </p>
                  {notice.attachments && notice.attachments.length > 0 && (
                    <div className="mt-3 mb-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Attachments:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {notice.attachments.map((attachment, index) => (
                          <a
                            key={index}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 text-sm"
                          >
                            <Paperclip className="h-3 w-3" />
                            {attachment.name}
                            <Download className="h-3 w-3 ml-1" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {notice.createdByName && (
                    <p className="text-sm text-gray-500">
                      Published by: {notice.createdByName}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
