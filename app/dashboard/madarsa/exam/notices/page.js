"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bell,
  AlertCircle,
  Search,
  Calendar as CalendarIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Download,
} from "lucide-react";
import { getDocuments, COLLECTIONS } from "@/lib/firestoreService";
import { orderBy } from "firebase/firestore";
import useAuthStore from "@/lib/authStore";
import { formatDate } from "@/lib/dateUtils";

export default function MadarsaExamNoticesPage() {
  const { user } = useAuth();
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data States
  const [examNotices, setExamNotices] = useState([]);

  // Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // Fetch exam notices
  const fetchExamNotices = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];

      // 1. Fetch standard notices
      const fetchedNotices = await getDocuments(
        COLLECTIONS.EXAM_NOTICES,
        constraints
      );

      // Filter notices that are sent to mekhala or madarsa
      const standardNotices = fetchedNotices.filter(
        (notice) =>
          notice.recipients &&
          (notice.recipients.includes("mekhala") ||
            notice.recipients.includes("madarsa") ||
            notice.recipients.includes("all"))
      );

      // 2. Fetch exams with notices
      const fetchedExams = await getDocuments(COLLECTIONS.EXAMS, constraints);
      const examNotices = fetchedExams
        .filter((exam) => exam.notice && exam.notice.trim() !== "")
        .map((exam) => ({
          id: `exam-${exam.id}`,
          title: `Exam Alert: ${exam.title}`,
          content: exam.notice,
          createdAt: exam.createdAt || exam.updatedAt,
          isImportant: true,
          type: "exam_specific",
          recipients: ["madarsa", "student"], // Implicit recipients
          createdByName: "System (Exam Update)",
        }));

      // 3. Combine and sort
      const allNotices = [...standardNotices, ...examNotices].sort((a, b) => {
        const dateA = a.createdAt?.toDate
          ? a.createdAt.toDate()
          : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate
          ? b.createdAt.toDate()
          : new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      setExamNotices(allNotices);
    } catch (error) {
      console.error("Error fetching exam notices:", error);
      setError("Failed to load exam notices");
    }
  }, []);

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

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate, sortOrder]);

  // Filter and Sort Logic
  const filteredNotices = useMemo(() => {
    return examNotices
      .filter((notice) => {
        // Search Filter
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
          notice.title?.toLowerCase().includes(searchLower) ||
          notice.content?.toLowerCase().includes(searchLower);

        // Date Range Filter
        let matchesDate = true;
        if (startDate || endDate) {
          const noticeDate = notice.createdAt?.toDate
            ? notice.createdAt.toDate()
            : new Date(notice.createdAt);
          // Reset time part for accurate date comparison
          noticeDate.setHours(0, 0, 0, 0);

          if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            matchesDate = matchesDate && noticeDate >= start;
          }
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(0, 0, 0, 0);
            matchesDate = matchesDate && noticeDate <= end;
          }
        }

        return matchesSearch && matchesDate;
      })
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate
          ? a.createdAt.toDate()
          : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate
          ? b.createdAt.toDate()
          : new Date(b.createdAt || 0);
        return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
      });
  }, [examNotices, searchQuery, startDate, endDate, sortOrder]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredNotices.length / itemsPerPage);
  const paginatedNotices = filteredNotices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const isExpired = (notice) => {
    if (!notice.expiryDate) return false;
    const expiry = notice.expiryDate?.toDate
      ? notice.expiryDate.toDate()
      : new Date(notice.expiryDate);
    return expiry < new Date();
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setSortOrder("newest");
  };

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
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Madarsa Exam Notices
            </h1>
            <p className="text-gray-600 mt-2">
              View exam notices and announcements for your madarsa
            </p>
          </div>
        </div>

        {/* Filters Section */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search notices..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-auto"
                  />
                  <span className="text-gray-400">-</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
                {(searchQuery ||
                  startDate ||
                  endDate ||
                  sortOrder !== "newest") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearFilters}
                    title="Clear filters"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notices List */}
        <div className="grid gap-4">
          {paginatedNotices.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium mb-2">
                  No notices found
                </p>
                <p className="text-gray-400">
                  Try adjusting your filters or check back later
                </p>
              </CardContent>
            </Card>
          ) : (
            paginatedNotices.map((notice) => {
              const expired = isExpired(notice);
              return (
                <Card
                  key={notice.id}
                  className={`hover:bad-md transition-bad ${
                    expired ? "border-red-300 bg-red-50/30" : ""
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <CardTitle className="text-xl text-blue-800">
                            {formatContentWithLinks(notice.title)}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {notice.isImportant && (
                            <Badge variant="destructive" className="text-xs">
                              Important
                            </Badge>
                          )}
                          {notice.recipients && notice.recipients.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
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
                          ) : notice.type === "exam_specific" ? (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200"
                            >
                              Exam Update
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-red-600"
                            >
                              Showing to no one
                            </Badge>
                          )}
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
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
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-gray-600 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
