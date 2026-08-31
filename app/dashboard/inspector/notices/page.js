"use client";

import { useState, useEffect } from "react";
import InspectorLayout from "@/components/InspectorLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Search, Calendar, User, AlertCircle } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function InspectorNoticesPage() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        setLoading(true);

        // Fetch notices for inspectors (avoid composite index requirements by sorting client-side)
        const noticesQuery = query(
          collection(db, "notices"),
          where("targetAudience", "in", ["all", "inspector"]),
        );

        const noticesSnapshot = await getDocs(noticesQuery);
        const noticesData = noticesSnapshot.docs.map((doc) => {
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
            isActive: data.isActive !== false,
          };
        });

        // Filter out expired notices
        const activeNotices = noticesData
          .filter((notice) => {
            if (!notice.expiryDate) return true; // No expiry date means it's always active
            return notice.expiryDate > new Date();
          })
          .sort((a, b) => {
            const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
            const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
            return tb - ta;
          });

        setNotices(activeNotices);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching notices:", error);
        setLoading(false);
      }
    };

    fetchNotices();
  }, []);

  const filteredNotices = notices.filter((notice) => {
    const matchesSearch =
      notice.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notice.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notice.createdByName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPriority =
      priorityFilter === "all" || notice.priority === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case "high":
        return <AlertCircle className="h-4 w-4" />;
      case "medium":
        return <Bell className="h-4 w-4" />;
      case "low":
        return <Bell className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const isRecent = (createdAt) => {
    if (!createdAt) return false;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return createdAt > weekAgo;
  };

  if (loading) {
    return (
      <InspectorLayout>
        <div className="p-6">
          <div className="text-center py-8">Loading...</div>
        </div>
      </InspectorLayout>
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
    <InspectorLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notices</h1>
            <p className="text-gray-600">
              Important announcements and updates for inspectors
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search notices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[180px] border-teal-200 hover:border-teal-300 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-teal-600 focus-visible:border-teal-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High Priority</SelectItem>
              <SelectItem value="medium">Medium Priority</SelectItem>
              <SelectItem value="low">Low Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Bell className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Total</span>
                </div>
                <p className="text-3xl font-bold text-blue-600">
                  {notices.length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium">High Priority</span>
                </div>
                <p className="text-3xl font-bold text-red-600">
                  {notices.filter((n) => n.priority === "high").length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Bell className="h-5 w-5 text-green-600" />
                  <span className="font-medium">New This Week</span>
                </div>
                <p className="text-3xl font-bold text-green-600">
                  {notices.filter((n) => isRecent(n.createdAt)).length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <User className="h-5 w-5 text-purple-600" />
                  <span className="font-medium">
                    For Inspectors (Thaftheesh)
                  </span>
                </div>
                <p className="text-3xl font-bold text-purple-600">
                  {
                    notices.filter((n) => n.targetAudience === "inspector")
                      .length
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notices List */}
        <div className="space-y-4">
          {filteredNotices.length === 0 ? (
            <Card>
              <CardContent className="p-12">
                <div className="text-center">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {notices.length === 0
                      ? "No notices available"
                      : "No notices match your search criteria"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredNotices.map((notice) => (
              <Card
                key={notice.id}
                className={`transition-shadow hover:shadow-md ${
                  notice.priority === "high" ? "border-red-200" : ""
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getPriorityColor(notice.priority)}>
                          {getPriorityIcon(notice.priority)}
                          <span className="ml-1 capitalize">
                            {notice.priority}
                          </span>
                        </Badge>
                        {notice.targetAudience === "inspector" && (
                          <Badge variant="outline">
                            For Inspectors (Thaftheesh)
                          </Badge>
                        )}
                        {isRecent(notice.createdAt) && (
                          <Badge variant="default">New</Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl">
                        {formatContentWithLinks(notice.title)}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {notice.createdByName || "Admin"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {notice.createdAt?.toLocaleDateString() || "N/A"}
                        </span>
                        {notice.expiryDate && (
                          <span className="flex items-center gap-1 text-orange-600">
                            <AlertCircle className="h-4 w-4" />
                            Expires: {notice.expiryDate.toLocaleDateString()}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {formatContentWithLinks(notice.content)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </InspectorLayout>
  );
}
