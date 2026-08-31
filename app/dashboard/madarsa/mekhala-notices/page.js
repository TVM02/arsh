"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bell,
  Search,
  Calendar,
  Eye,
  Filter,
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  Building2,
} from "lucide-react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

export default function MekhalaNoticesPage() {
  const { user, userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState([]);
  const [madarsaInfo, setMadarsaInfo] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch madarsa notices with proper targeting logic
  const fetchMadarsaNotices = useCallback(async () => {
    try {
      setLoading(true);
      const madarsaId = userData.madarsaId;

      // First, get madarsa information
      const madarsaQuery = query(
        collection(db, "madarsas"),
        where("madarsaId", "==", madarsaId),
      );
      const madarsaSnapshot = await getDocs(madarsaQuery);

      if (!madarsaSnapshot.empty) {
        const madarsaData = madarsaSnapshot.docs[0].data();
        setMadarsaInfo(madarsaData);

        // Fetch notices that target this madarsa
        const noticesQuery = query(
          collection(db, "notices"),
          orderBy("createdAt", "desc"),
        );
        const noticesSnapshot = await getDocs(noticesQuery);

        const allNotices = noticesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Filter notices that target this madarsa
        const relevantNotices = allNotices.filter((notice) => {
          // Notices sent to Mekhala from Sadar portals in the same mekhala
          if (notice.forMekhala === true) {
            // Show if mekhalaName matches this madrasa's district/mekhala
            const currentMekhala =
              madarsaData.district || madarsaData.mekhala || "";
            if (
              notice.mekhalaName &&
              currentMekhala &&
              notice.mekhalaName.trim().toLowerCase() ===
                currentMekhala.trim().toLowerCase()
            ) {
              return true;
            }
            // Also show mekhala notices from same madarsa
            if (notice.madarsaId === madarsaId) return true;
            return false;
          }
          // Standard targeting logic
          if (notice.targetType === "all" || notice.targetType === "all_sadar_portals") {
            if (notice.createdByRole === "mekhala_admin") {
              return notice.targetDistricts?.includes(madarsaData.district);
            }
            return true; // All madarsas are targeted
          } else if (notice.targetType === "specific_districts") {
            // Check if this madarsa's district is in targetDistricts
            return notice.targetDistricts?.includes(madarsaData.district);
          } else if (notice.targetType === "specific_madarsas") {
            // Check if this madarsa is specifically targeted
            return (
              notice.targetMadarsas?.includes(madarsaId) ||
              notice.targetMadarsas?.includes(madarsaSnapshot.docs[0].id)
            );
          }
          return false;
        });

        setNotices(relevantNotices);
      } else {
        // console.log('Madarsa not found with ID:', madarsaId);
        toast.error("Madarsa information not found");
      }
    } catch (error) {
      console.error("Error fetching madarsa notices:", error);
      toast.error("Failed to fetch notices");
    } finally {
      setLoading(false);
    }
  }, [userData]);

  // Memoize filtered notices
  const filteredNotices = useMemo(() => {
    return notices.filter((notice) => {
      const matchesSearch =
        !searchTerm ||
        notice.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notice.content?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPriority =
        priorityFilter === "all" || notice.priority === priorityFilter;

      // Status filter based on expiry
      let matchesStatus = true;
      if (statusFilter !== "all") {
        const now = new Date();
        const expiryDate = notice.expiryDate
          ? new Date(notice.expiryDate)
          : null;

        if (statusFilter === "active") {
          matchesStatus = !expiryDate || now <= expiryDate;
        } else if (statusFilter === "expired") {
          matchesStatus = expiryDate && now > expiryDate;
        }
      }

      return matchesSearch && matchesPriority && matchesStatus;
    });
  }, [notices, searchTerm, priorityFilter, statusFilter]);

  useEffect(() => {
    if (userData?.madarsaId) {
      fetchMadarsaNotices();
    } else if (userData) {
      //   console.log('No madarsaId found for user:', userData);
      setLoading(false);
    }
  }, [userData, fetchMadarsaNotices]);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStatusIcon = (notice) => {
    const now = new Date();
    const expiryDate = notice.expiryDate ? new Date(notice.expiryDate) : null;

    if (expiryDate && now > expiryDate) {
      return <Clock className="h-4 w-4 text-gray-500" />;
    }

    if (notice.priority === "high") {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }

    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getNoticeStatus = (notice) => {
    const now = new Date();
    const expiryDate = notice.expiryDate ? new Date(notice.expiryDate) : null;

    if (expiryDate && now > expiryDate) {
      return { label: "Expired", color: "bg-gray-100 text-gray-700" };
    }

    return { label: "Active", color: "bg-green-100 text-green-700" };
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "Invalid Date";
    }
  };

  const openNoticeDialog = (notice) => {
    setSelectedNotice(notice);
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mr-3"></div>
          <div className="text-lg">Loading mekhala notices...</div>
        </div>
      </Layout>
    );
  }

  if (!userData || userData.role !== "madarsa_admin") {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600">
              You need to be logged in as a Madrasa Admin to access this page.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Mekhala Notices</h1>
          </div>
          <p className="text-teal-100">
            Official notices from your Mekhala administration for{" "}
            {madarsaInfo?.name || "your madarsa"}
          </p>
          {madarsaInfo && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2 text-teal-100">
                <Building2 className="h-4 w-4" />
                <span>Madrasa ID: {madarsaInfo.madarsaId}</span>
              </div>
              <div className="flex items-center gap-2 text-teal-100">
                <MapPin className="h-4 w-4" />
                <span>District: {madarsaInfo.district}</span>
              </div>
              <div className="flex items-center gap-2 text-teal-100">
                <Bell className="h-4 w-4" />
                <span>Total Notices: {filteredNotices.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Notices</p>
                  <p className="text-2xl font-bold">{notices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold">
                    {
                      notices.filter((n) => {
                        const now = new Date();
                        const expiryDate = n.expiryDate
                          ? new Date(n.expiryDate)
                          : null;
                        return !expiryDate || now <= expiryDate;
                      }).length
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">High Priority</p>
                  <p className="text-2xl font-bold">
                    {notices.filter((n) => n.priority === "high").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Expired</p>
                  <p className="text-2xl font-bold">
                    {
                      notices.filter((n) => {
                        const now = new Date();
                        const expiryDate = n.expiryDate
                          ? new Date(n.expiryDate)
                          : null;
                        return expiryDate && now > expiryDate;
                      }).length
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search notices by title or content..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full md:w-48">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>
              <div className="w-full md:w-48">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notices Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notices ({filteredNotices.length})
            </CardTitle>
            <CardDescription>
              Official notices sent by your Mekhala administration
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredNotices.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  {searchTerm ||
                  priorityFilter !== "all" ||
                  statusFilter !== "all"
                    ? "No notices found"
                    : "No notices received"}
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm ||
                  priorityFilter !== "all" ||
                  statusFilter !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "You haven't received any notices from your Mekhala yet"}
                </p>
                {(searchTerm ||
                  priorityFilter !== "all" ||
                  statusFilter !== "all") && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setPriorityFilter("all");
                      setStatusFilter("all");
                    }}
                  >
                    Clear All Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Target Type</TableHead>
                      <TableHead>Date Posted</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotices.map((notice) => {
                      const status = getNoticeStatus(notice);
                      return (
                        <TableRow key={notice.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(notice)}
                              <Badge variant="outline" className={status.color}>
                                {status.label}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-semibold text-gray-900">
                                {notice.title}
                              </div>
                              <div className="text-sm text-gray-500 line-clamp-2">
                                {notice.content?.substring(0, 100)}
                                {notice.content?.length > 100 && "..."}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getPriorityColor(notice.priority)}
                            >
                              {notice.priority || "medium"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {notice.targetType === "all"
                                ? "All Madrasas"
                                : notice.targetType === "specific_districts"
                                  ? "District-wise"
                                  : notice.targetType === "specific_madarsas"
                                    ? "Specific"
                                    : "Unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">
                                {formatDate(notice.createdAt)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {notice.expiryDate ? (
                              <div className="text-sm">
                                {formatDate(notice.expiryDate)}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">
                                No expiry
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openNoticeDialog(notice)}
                              className="hover:bg-teal-50 hover:text-teal-600"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notice Detail Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notice Details
              </DialogTitle>
            </DialogHeader>

            {selectedNotice && (
              <div className="space-y-6">
                {/* Header */}
                <div className="border-b pb-4">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {selectedNotice.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge
                      variant="outline"
                      className={getPriorityColor(selectedNotice.priority)}
                    >
                      {selectedNotice.priority || "medium"} priority
                    </Badge>
                    <Badge variant="secondary">
                      {selectedNotice.targetType === "all"
                        ? "All Madrasas"
                        : selectedNotice.targetType === "specific_districts"
                          ? "District-wise"
                          : selectedNotice.targetType === "specific_madarsas"
                            ? "Specific Madrasas"
                            : "Unknown"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={getNoticeStatus(selectedNotice).color}
                    >
                      {getNoticeStatus(selectedNotice).label}
                    </Badge>
                    {selectedNotice.showOnDashboard && (
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700"
                      >
                        Dashboard Notice
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Notice Content</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {selectedNotice.content}
                    </p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Timeline</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <span className="text-sm text-gray-600">Posted:</span>
                          <div className="font-medium">
                            {formatDate(selectedNotice.createdAt)}
                          </div>
                        </div>
                      </div>
                      {selectedNotice.expiryDate && (
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <div>
                            <span className="text-sm text-gray-600">
                              Expires:
                            </span>
                            <div className="font-medium">
                              {formatDate(selectedNotice.expiryDate)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">
                      Targeting Details
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm text-gray-600">
                          Target Type:
                        </span>
                        <div className="font-medium">
                          {selectedNotice.targetType === "all"
                            ? "All Madrasas in Mekhala"
                            : selectedNotice.targetType === "specific_districts"
                              ? "Specific Districts"
                              : selectedNotice.targetType ===
                                  "specific_madarsas"
                                ? "Specific Madrasas"
                                : "Unknown"}
                        </div>
                      </div>
                      {selectedNotice.targetType === "specific_districts" &&
                        selectedNotice.allDistrictsCount && (
                          <div>
                            <span className="text-sm text-gray-600">
                              Districts Targeted:
                            </span>
                            <div className="font-medium">
                              {selectedNotice.allDistrictsCount} districts
                            </div>
                          </div>
                        )}
                      {selectedNotice.targetType === "specific_madarsas" &&
                        selectedNotice.allMadarsasCount && (
                          <div>
                            <span className="text-sm text-gray-600">
                              Madrasas Targeted:
                            </span>
                            <div className="font-medium">
                              {selectedNotice.allMadarsasCount} madarsas
                            </div>
                          </div>
                        )}
                      {selectedNotice.targetType === "all" && (
                        <div>
                          <span className="text-sm text-gray-600">
                            Coverage:
                          </span>
                          <div className="font-medium">
                            All districts (
                            {selectedNotice.allDistrictsCount || "N/A"}) and
                            madarsas ({selectedNotice.allMadarsasCount || "N/A"}
                            ) in mekhala
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
