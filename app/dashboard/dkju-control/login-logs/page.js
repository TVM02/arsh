"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Monitor,
  Search,
  Filter,
  Clock,
  RefreshCw,
  Eye,
  Download,
  Activity,
  LogIn,
  FileUp,
  FileEdit,
  FileX,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  MapPin,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PAGE_SIZE = 20;

const toDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseTimestamp = (timestamp) => {
  if (!timestamp) return null;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getLogTime = (log) =>
  log.entryTimeClient || log.entryTime || log.loginTimestamp;

const getDateKeyFromTimestamp = (timestamp) => {
  const date = parseTimestamp(timestamp);
  return date ? toDateInputValue(date) : "Unknown";
};

const getEntryDate = (log) =>
  parseTimestamp(log.entryTimeClient || log.entryTime || log.loginTimestamp);

const getLastSeenDate = (log) =>
  parseTimestamp(log.lastSeenAtClient || log.lastSeenAt);

const getEffectiveStatusForLog = (log, nowMs) => {
  const status = log.status || "active";
  if (status !== "active") return status;
  const referenceDate = getLastSeenDate(log) || getEntryDate(log);
  if (!referenceDate) return "unknown";
  return nowMs - referenceDate.getTime() > 2 * 60 * 1000 ? "stale" : "active";
};

const getEffectiveDurationSecondsForLog = (log, nowMs) => {
  const stored = Number(log.durationSeconds);
  if (Number.isFinite(stored) && stored > 0) return stored;

  const entryDate = getEntryDate(log);
  const lastSeenDate = getLastSeenDate(log);
  if (entryDate && lastSeenDate && lastSeenDate > entryDate) {
    const seconds = Math.round((lastSeenDate - entryDate) / 1000);
    if (seconds > 0) return seconds;
  }

  if (getEffectiveStatusForLog(log, nowMs) === "active" && entryDate) {
    return Math.max(1, Math.round((nowMs - entryDate.getTime()) / 1000));
  }

  return null;
};

const isVisitLog = (log) => (log.activityType || "login") === "login";

const getVisitorKey = (log) =>
  log.userId || log.email || log.ip || log.sessionId || log.id || "unknown";

const calculateLegacyBotScore = (userAgent = "") => {
  if (!userAgent) return null;
  let score = 12;
  if (/bot|crawler|spider|scraper|curl|wget|python|httpclient|postman|axios|go-http-client/i.test(userAgent)) {
    score += 55;
  }
  if (/headless|phantomjs|puppeteer|playwright|selenium/i.test(userAgent)) {
    score += 70;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
};

const formatMonthDay = (label) => {
  if (!label || !label.includes("-")) return label;
  const [mStr, dStr] = label.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mIndex = parseInt(mStr, 10) - 1;
  if (mIndex >= 0 && mIndex < 12) {
    return `${monthNames[mIndex]} ${parseInt(dStr, 10)}`;
  }
  return label;
};

const formatTooltipDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIndex = parseInt(month, 10) - 1;
      if (mIndex >= 0 && mIndex < 12) {
        return `${monthNames[mIndex]} ${parseInt(day, 10)}, ${year}`;
      }
    }
  } catch {}
  return dateStr;
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl border border-gray-100 shadow-xl space-y-2">
        <p className="text-xs font-semibold text-gray-500">{formatTooltipDate(data.date)}</p>
        <div className="space-y-1.5 text-sm">
          {payload.map((entry, idx) => (
            <div key={idx} className="flex items-center gap-4 justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color || entry.stroke || '#ccc' }}
                />
                <span className="text-gray-600">{entry.name}:</span>
              </div>
              <span className="font-bold text-gray-900">
                {entry.value} {entry.name === "Avg Duration" ? " min" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function ActivityLogsPage() {
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailsModal, setDetailsModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [reportDate, setReportDate] = useState(toDateInputValue());
  const [reportNow, setReportNow] = useState(Date.now());
  const [chartMetric, setChartMetric] = useState("all");

  // Filters (live – while typing / selecting)
  const [filters, setFilters] = useState({
    email: "",
    role: "all",
    activityType: "login",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
  });

  // Applied filters – only change on "Apply Filters" click
  const [appliedFilters, setAppliedFilters] = useState({
    email: "",
    role: "all",
    activityType: "login",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
  });

  const roles = [
    "inspector",
    "central_admin",
    "student",
    "teacher",
    "madarsa_admin",
    "mekhala_admin",
    "convener_admin",
    "pariksha_board_convener",
    "manager",
  ];

  const activityTypes = [
    "login",
    "result_upload",
    "result_edit",
    "result_delete",
    "application_approved",
    "application_rejected",
  ];

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await authFetch("/api/admin/visitor-reports?limit=5000", {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch visitor reports");
      }
      setAllLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (error) {
      console.error("Error fetching visitor reports:", error);
      toast.error(error.message || "Failed to fetch visitor reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setReportNow(Date.now()), 15000);
    return () => window.clearInterval(interval);
  }, []);

  // ─── Client-side filtering ──────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    const f = appliedFilters;
    return allLogs.filter((log) => {
      if (
        f.email &&
        !(log.email || "").toLowerCase().includes(f.email.toLowerCase())
      )
        return false;
      if (f.role !== "all" && log.role !== f.role) return false;
      const logActivity = log.activityType || "login";
      if (f.activityType !== "all" && logActivity !== f.activityType)
        return false;

      if (f.startDate || f.endDate) {
        const logDate = parseTimestamp(getLogTime(log));
        if (!logDate) return false;

        if (f.startDate) {
          const start = new Date(
            f.startDate + "T" + (f.startTime || "00:00") + ":00",
          );
          if (logDate < start) return false;
        }
        if (f.endDate) {
          const end = new Date(
            f.endDate + "T" + (f.endTime || "23:59") + ":59",
          );
          if (logDate > end) return false;
        }
      }
      return true;
    });
  }, [allLogs, appliedFilters]);

  // ─── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
  };

  const clearFilters = () => {
    const cleared = {
      email: "",
      role: "all",
      activityType: "login",
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
    };
    setFilters(cleared);
    setAppliedFilters(cleared);
  };

  const viewDetails = (log) => {
    setSelectedLog(log);
    setDetailsModal(true);
  };

  const formatTimestamp = (timestamp) => {
    const date = parseTimestamp(timestamp);
    return date ? date.toLocaleString() : "N/A";
  };

  const formatDuration = (seconds) => {
    if (seconds == null || Number.isNaN(Number(seconds))) return "Not captured";
    const value = Math.max(0, Math.round(Number(seconds)));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const rest = value % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return minutes <= 0 ? `${rest}s` : `${minutes}m ${rest}s`;
  };

  const getEffectiveStatus = useCallback(
    (log) => getEffectiveStatusForLog(log, reportNow),
    [reportNow],
  );

  const getEffectiveDurationSeconds = useCallback(
    (log) => getEffectiveDurationSecondsForLog(log, reportNow),
    [reportNow],
  );

  const getEffectiveBotScore = useCallback((log) => {
    if (log.botScoreSource && log.botScore != null) return Number(log.botScore);
    const recalculated = calculateLegacyBotScore(log.userAgent);
    return recalculated ?? (log.botScore != null ? Number(log.botScore) : null);
  }, []);

  function getBotScoreSource(log) {
    return (
      log.botScoreSource ||
      (log.userAgent ? "legacy_user_agent_recalculated" : "legacy")
    );
  }

  const visitLogs = useMemo(() => allLogs.filter(isVisitLog), [allLogs]);

  const filteredVisitLogs = useMemo(
    () => filteredLogs.filter(isVisitLog),
    [filteredLogs],
  );

  const visitCountByVisitor = useMemo(() => {
    const counts = new Map();
    visitLogs.forEach((log) => {
      const key = getVisitorKey(log);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [visitLogs]);

  const getDisplayVisitCount = (log) =>
    visitCountByVisitor.get(getVisitorKey(log)) || Number(log.visitCount || 1);

  const totalVisitors = useMemo(
    () => new Set(filteredVisitLogs.map(getVisitorKey)).size,
    [filteredVisitLogs],
  );

  const totalVisits = filteredVisitLogs.length;

  const activeSessions = useMemo(
    () =>
      filteredVisitLogs.filter((log) => getEffectiveStatus(log) === "active")
        .length,
    [filteredVisitLogs, getEffectiveStatus],
  );

  const averageBotScore = useMemo(() => {
    const scoredLogs = filteredVisitLogs
      .map((log) => getEffectiveBotScore(log))
      .filter((score) => score != null);
    if (scoredLogs.length === 0) return "N/A";
    return Math.round(
      scoredLogs.reduce((sum, score) => sum + Number(score || 0), 0) /
        scoredLogs.length,
    );
  }, [filteredVisitLogs, getEffectiveBotScore]);

  const dailySummary = useMemo(() => {
    const map = new Map();
    filteredVisitLogs.forEach((log) => {
      const key = getDateKeyFromTimestamp(getLogTime(log));
      if (key === "Unknown") return;
      const current = map.get(key) || {
        date: key,
        label: key.slice(5),
        visits: 0,
        visitors: new Set(),
        durationSeconds: 0,
        durationCount: 0,
        botScoreTotal: 0,
        botScoreCount: 0,
      };
      current.visits += 1;
      const durationSeconds = getEffectiveDurationSeconds(log);
      if (durationSeconds != null) {
        current.durationSeconds += durationSeconds;
        current.durationCount += 1;
      }
      current.visitors.add(getVisitorKey(log));
      const botScore = getEffectiveBotScore(log);
      if (botScore != null) {
        current.botScoreTotal += Number(botScore || 0);
        current.botScoreCount += 1;
      }
      map.set(key, current);
    });
    return Array.from(map.values())
      .map((item) => ({
        date: item.date,
        label: item.label,
        visits: item.visits,
        visitors: item.visitors.size,
        avgDurationMinutes: Number(
          (item.durationSeconds / Math.max(1, item.durationCount) / 60).toFixed(1),
        ),
        avgBotScore: item.botScoreCount
          ? Math.round(item.botScoreTotal / item.botScoreCount)
          : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [filteredVisitLogs, getEffectiveDurationSeconds, getEffectiveBotScore]);

  const getSystemDevice = (log) => {
    if (log.system && log.device) return `${log.system} (${log.device})`;
    if (log.system) return log.system;
    if (log.browser || log.os) {
      return `${log.browser || "Unknown Browser"} on ${log.os || "Unknown OS"}${
        log.device ? ` (${log.device})` : ""
      }`;
    }
    return log.device || log.platform || "Unknown";
  };

  const formatBotScore = (score) =>
    score == null || score === "" ? "N/A" : `${Math.round(Number(score))}`;

  const getBotRiskLabel = (score) => {
    if (score == null || score === "") return "Unknown";
    const value = Number(score);
    if (value >= 70) return "Likely Bot";
    if (value >= 40) return "Review";
    return "Human";
  };

  const getBotBadgeColor = (score) => {
    if (score == null || score === "") return "bg-gray-50 text-gray-700";
    const value = Number(score);
    if (value >= 70) return "bg-red-50 text-red-700";
    if (value >= 40) return "bg-amber-50 text-amber-700";
    return "bg-emerald-50 text-emerald-700";
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "active":
        return "bg-emerald-50 text-emerald-700";
      case "closed":
        return "bg-gray-50 text-gray-700";
      case "stale":
        return "bg-amber-50 text-amber-700";
      case "unknown":
        return "bg-slate-50 text-slate-700";
      default:
        return "bg-blue-50 text-blue-700";
    }
  };

  const exportDayPdf = () => {
    const rows = visitLogs.filter(
      (log) => getDateKeyFromTimestamp(getLogTime(log)) === reportDate,
    );
    if (rows.length === 0) {
      toast.error("No records found for selected day");
      return;
    }

    const dayVisitors = new Set(rows.map(getVisitorKey)).size;
    const pdf = new jsPDF({ orientation: "landscape" });
    pdf.setFontSize(14);
    pdf.text(`DKJU Visitor Report - ${reportDate}`, 14, 14);
    pdf.setFontSize(9);
    pdf.text(
      `Total Visitors: ${dayVisitors}   Total Visits: ${rows.length}   Generated: ${new Date().toLocaleString()}`,
      14,
      20,
    );
    autoTable(pdf, {
      startY: 28,
      head: [
        [
          "Sl. No.",
          "Name",
          "Email",
          "Role",
          "IP Address",
          "Entry Time",
          "Duration",
          "Visits",
          "System / Device",
          "Bot Score",
          "Status",
        ],
      ],
      body: rows.map((log, index) => [
        index + 1,
        log.name || "",
        log.email || "",
        log.role || "",
        log.ip || "Unavailable",
        formatTimestamp(getLogTime(log)),
        formatDuration(getEffectiveDurationSeconds(log)),
        getDisplayVisitCount(log),
        getSystemDevice(log),
        formatBotScore(getEffectiveBotScore(log)),
        getEffectiveStatus(log),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [15, 118, 110] },
    });
    pdf.save(`dkju-visitor-report-${reportDate}.pdf`);
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "central_admin":
        return "bg-red-100 text-red-800";
      case "inspector":
        return "bg-blue-100 text-blue-800";
      case "teacher":
        return "bg-green-100 text-green-800";
      case "student":
        return "bg-purple-100 text-purple-800";
      case "madarsa_admin":
        return "bg-orange-100 text-orange-800";
      case "mekhala_admin":
        return "bg-cyan-100 text-cyan-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getActivityBadgeColor = (activityType) => {
    switch (activityType) {
      case "login":
        return "bg-blue-50 text-blue-700";
      case "result_upload":
        return "bg-green-50 text-green-700";
      case "result_edit":
        return "bg-yellow-50 text-yellow-700";
      case "result_delete":
        return "bg-red-50 text-red-700";
      case "application_approved":
        return "bg-emerald-50 text-emerald-700";
      case "application_rejected":
        return "bg-rose-50 text-rose-700";
      default:
        return "bg-gray-50 text-gray-700";
    }
  };

  const getActivityIcon = (activityType) => {
    const iconProps = { className: "h-3 w-3" };
    switch (activityType) {
      case "login":
        return <LogIn {...iconProps} />;
      case "result_upload":
        return <FileUp {...iconProps} />;
      case "result_edit":
        return <FileEdit {...iconProps} />;
      case "result_delete":
        return <FileX {...iconProps} />;
      case "application_approved":
        return <CheckCircle {...iconProps} />;
      case "application_rejected":
        return <XCircle {...iconProps} />;
      default:
        return <Activity {...iconProps} />;
    }
  };

  const exportLogs = () => {
    const escapeCsv = (value) => {
      const text = String(value ?? "");
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const csvContent = [
      [
        "Name",
        "Email",
        "Role",
        "Activity Type",
        "IP Address",
        "Entry Time",
        "Duration",
        "Visits",
        "System / Device",
        "Bot Score",
        "Status",
        "Details",
        "Location",
        "User Agent",
      ]
        .map(escapeCsv)
        .join(","),
      ...filteredLogs.map((log) =>
        [
          log.name || "",
          log.email || "",
          log.role || "",
          log.activityType || "login",
          log.ip || "Unavailable",
          formatTimestamp(getLogTime(log)),
          formatDuration(getEffectiveDurationSeconds(log)),
          isVisitLog(log) ? getDisplayVisitCount(log) : "",
          getSystemDevice(log),
          formatBotScore(getEffectiveBotScore(log)),
          getEffectiveStatus(log),
          log.details || "",
          log.location
            ? `${log.location.latitude || log.location.lat || ""},${log.location.longitude || log.location.lng || ""}`
            : "",
          log.userAgent || "",
        ]
          .map(escapeCsv)
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `visitor-logs-${toDateInputValue()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Monitor className="h-6 w-6 sm:h-8 sm:w-8 text-teal-700" />
              Website Visitor Reports
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Login sessions with IP, duration, device, bot score, status, and downloadable daily reports
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
              className="h-9 w-40"
            />
            <Button variant="outline" onClick={exportDayPdf} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Day PDF
            </Button>
            <Button
              variant="outline"
              onClick={fetchLogs}
              size="sm"
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button variant="outline" onClick={exportLogs} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Total Visitors</p>
              <p className="text-2xl font-bold">{totalVisitors}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Total Visits</p>
              <p className="text-2xl font-bold">{totalVisits}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Active Sessions</p>
              <p className="text-2xl font-bold">{activeSessions}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Avg Bot Score</p>
              <p className="text-2xl font-bold">{averageBotScore}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-teal-700" />
                Daily Visitor Graph
              </CardTitle>
              <CardDescription>
                Per-day visits, unique visitors, and average session duration.
                <span className="block mt-1 text-xs text-teal-600 font-medium">
                  Note: Left y-axis represents counts (Visits &amp; Visitors) | Right y-axis represents average session duration (in minutes).
                </span>
              </CardDescription>
            </div>
            <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setChartMetric("all")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  chartMetric === "all"
                    ? "bg-white text-gray-900 shadow-sm border border-gray-200/50"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                All Metrics
              </button>
              <button
                type="button"
                onClick={() => setChartMetric("visits")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  chartMetric === "visits"
                    ? "bg-white text-gray-900 shadow-sm border border-gray-200/50"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Visits &amp; Visitors
              </button>
              <button
                type="button"
                onClick={() => setChartMetric("duration")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  chartMetric === "duration"
                    ? "bg-white text-gray-900 shadow-sm border border-gray-200/50"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Session Duration
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              {dailySummary.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded border border-dashed text-sm text-gray-500">
                  No visitor data found for the selected filters
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartMetric === "all" ? (
                    <ComposedChart
                      data={dailySummary}
                      margin={{ top: 15, right: 15, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickFormatter={formatMonthDay}
                      />
                      <YAxis
                        yAxisId="left"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        allowDecimals={false}
                        width={40}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickFormatter={(val) => `${val} min`}
                        width={65}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12, paddingBottom: 10 }}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="visits"
                        name="Visits"
                        fill="#0f766e"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="visitors"
                        name="Visitors"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="avgDurationMinutes"
                        name="Avg Duration"
                        stroke="#d97706"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </ComposedChart>
                  ) : chartMetric === "visits" ? (
                    <ComposedChart
                      data={dailySummary}
                      margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f766e" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#0f766e" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickFormatter={formatMonthDay}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        allowDecimals={false}
                        width={40}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12, paddingBottom: 10 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="visits"
                        name="Visits"
                        stroke="#0f766e"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorVisits)"
                      />
                      <Area
                        type="monotone"
                        dataKey="visitors"
                        name="Visitors"
                        stroke="#2563eb"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorVisitors)"
                      />
                    </ComposedChart>
                  ) : (
                    <ComposedChart
                      data={dailySummary}
                      margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d97706" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickFormatter={formatMonthDay}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickFormatter={(val) => `${val} min`}
                        width={65}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12, paddingBottom: 10 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="avgDurationMinutes"
                        name="Avg Duration"
                        stroke="#d97706"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorDuration)"
                      />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <CardDescription>
              Filter activity logs by email, role, activity type, or date &amp;
              time range
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Row 1: Email, Role, Activity Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  placeholder="Search by email..."
                  value={filters.email}
                  onChange={(e) => handleFilterChange("email", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={filters.role}
                  onValueChange={(value) => handleFilterChange("role", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.replace(/_/g, " ").toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="activityType">Activity Type</Label>
                <Select
                  value={filters.activityType}
                  onValueChange={(value) =>
                    handleFilterChange("activityType", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select activity type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Activities</SelectItem>
                    {activityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/_/g, " ").toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Date & Time range */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  max={toDateInputValue()}
                  value={filters.startDate}
                  onChange={(e) =>
                    handleFilterChange("startDate", e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={filters.startTime}
                  onChange={(e) =>
                    handleFilterChange("startTime", e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  max={toDateInputValue()}
                  value={filters.endDate}
                  onChange={(e) =>
                    handleFilterChange("endDate", e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={filters.endTime}
                  onChange={(e) =>
                    handleFilterChange("endTime", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button onClick={applyFilters}>
                <Search className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full sm:w-auto"
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg sm:text-xl">
                  Visitor And Activity Records ({filteredLogs.length})
                </CardTitle>
                <CardDescription className="text-sm">
                  Page {currentPage} of {totalPages} &middot; {PAGE_SIZE}{" "}
                  records per page &middot; {filteredLogs.length} total
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 mt-2 text-sm">
                  Loading visitor reports...
                </span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Monitor className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p className="text-sm sm:text-base">No visitor records found</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden border-b border-gray-200 sm:rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Activity Type</TableHead>
                            <TableHead>Entry Time</TableHead>
                            <TableHead>IP Address</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Visits</TableHead>
                            <TableHead>System / Device</TableHead>
                            <TableHead>Bot Score</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{log.email}</p>
                                  <p className="text-sm text-gray-500">
                                    {log.name}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={getRoleBadgeColor(log.role)}>
                                  {log.role?.replace(/_/g, " ").toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={getActivityBadgeColor(
                                    log.activityType || "login",
                                  )}
                                >
                                  <div className="flex items-center gap-1">
                                    {getActivityIcon(
                                      log.activityType || "login",
                                    )}
                                    {(log.activityType || "login")
                                      .replace(/_/g, " ")
                                      .toUpperCase()}
                                  </div>
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  <span className="text-sm">
                                    {formatTimestamp(getLogTime(log))}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>{log.ip || "Unavailable"}</TableCell>
                              <TableCell>
                                {formatDuration(getEffectiveDurationSeconds(log))}
                              </TableCell>
                              <TableCell>
                                {isVisitLog(log) ? getDisplayVisitCount(log) : "-"}
                              </TableCell>
                              <TableCell>
                                <div className="min-w-44 text-sm">
                                  <p className="font-medium text-gray-800">
                                    {getSystemDevice(log)}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {log.platform || "web"}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={getBotBadgeColor(getEffectiveBotScore(log))}>
                                  {formatBotScore(getEffectiveBotScore(log))} -{" "}
                                  {getBotRiskLabel(getEffectiveBotScore(log))}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={getStatusBadgeColor(getEffectiveStatus(log))}>
                                  {getEffectiveStatus(log)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-gray-600 max-w-xs truncate">
                                  {log.details || "N/A"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => viewDetails(log)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let page;
                      if (totalPages <= 7) page = i + 1;
                      else if (currentPage <= 4) page = i + 1;
                      else if (currentPage >= totalPages - 3)
                        page = totalPages - 6 + i;
                      else page = currentPage - 3 + i;
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details Modal */}
        <Dialog open={detailsModal} onOpenChange={setDetailsModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle>Activity Details</DialogTitle>
              <DialogDescription>
                Complete information about this activity
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-500">Email</Label>
                    <p className="font-medium">{selectedLog.email}</p>
                  </div>
                  {selectedLog.name && selectedLog.name !== "N/A" && (
                    <div>
                      <Label className="text-sm text-gray-500">Name</Label>
                      <p className="font-medium">{selectedLog.name}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm text-gray-500 mr-3">Role</Label>
                    <Badge className={getRoleBadgeColor(selectedLog.role)}>
                      {selectedLog.role?.replace(/_/g, " ").toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">User ID</Label>
                    <p className="font-mono text-sm">{selectedLog.userId}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500 mr-3">
                      Activity Type
                    </Label>
                    <Badge
                      className={getActivityBadgeColor(
                        selectedLog.activityType || "login",
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {getActivityIcon(selectedLog.activityType || "login")}
                        {(selectedLog.activityType || "login")
                          .replace(/_/g, " ")
                          .toUpperCase()}
                      </div>
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Timestamp</Label>
                    <p className="font-medium">
                      {formatTimestamp(getLogTime(selectedLog))}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Platform</Label>
                    <p className="font-medium">{selectedLog.platform}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">
                      Login Method
                    </Label>
                    <p className="font-medium">{selectedLog.loginMethod}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">IP Address</Label>
                    <p className="font-medium">{selectedLog.ip || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Duration</Label>
                    <p className="font-medium">
                      {formatDuration(getEffectiveDurationSeconds(selectedLog))}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Visits</Label>
                    <p className="font-medium">
                      {isVisitLog(selectedLog)
                        ? getDisplayVisitCount(selectedLog)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">
                      System / Device
                    </Label>
                    <p className="font-medium">{getSystemDevice(selectedLog)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500 mr-3">
                      Bot Score
                    </Label>
                    <Badge className={getBotBadgeColor(getEffectiveBotScore(selectedLog))}>
                      {formatBotScore(getEffectiveBotScore(selectedLog))} -{" "}
                      {getBotRiskLabel(getEffectiveBotScore(selectedLog))}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500 mr-3">Status</Label>
                    <Badge
                      className={getStatusBadgeColor(
                        getEffectiveStatus(selectedLog),
                      )}
                    >
                      {getEffectiveStatus(selectedLog)}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Last Seen</Label>
                    <p className="font-medium">
                      {formatTimestamp(
                        selectedLog.lastSeenAtClient || selectedLog.lastSeenAt,
                      )}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">
                      Bot Score Source
                    </Label>
                    <p className="font-medium">
                      {getBotScoreSource(selectedLog)}
                    </p>
                  </div>
                </div>

                {Array.isArray(selectedLog.botSignals) &&
                  selectedLog.botSignals.length > 0 && (
                    <div>
                      <Label className="text-sm text-gray-500">
                        Bot Score Signals
                      </Label>
                      <div className="mt-1 rounded border bg-amber-50 p-3">
                        <p className="text-sm text-amber-900">
                          {selectedLog.botSignals.join(", ")}
                        </p>
                      </div>
                    </div>
                  )}

                {selectedLog.userAgent && (
                  <div>
                    <Label className="text-sm text-gray-500">User Agent</Label>
                    <div className="mt-1 rounded border bg-gray-50 p-3">
                      <p className="break-words font-mono text-xs text-gray-700">
                        {selectedLog.userAgent}
                      </p>
                    </div>
                  </div>
                )}

                {selectedLog.details && (
                  <div>
                    <Label className="text-sm text-gray-500">Details</Label>
                    <div className="p-3 bg-blue-50 rounded border border-blue-200 mt-1">
                      <p className="text-sm font-medium text-blue-900">
                        {selectedLog.details}
                      </p>
                    </div>
                  </div>
                )}

                {(selectedLog.activityType === "result_upload" ||
                  selectedLog.activityType === "result_edit" ||
                  selectedLog.activityType === "result_delete") && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedLog.examTitle && (
                      <div>
                        <Label className="text-sm text-gray-500">Exam</Label>
                        <p className="font-medium">{selectedLog.examTitle}</p>
                      </div>
                    )}
                    {selectedLog.examId && (
                      <div>
                        <Label className="text-sm text-gray-500">Exam ID</Label>
                        <p className="font-mono text-sm">
                          {selectedLog.examId}
                        </p>
                      </div>
                    )}
                    {selectedLog.hallTicketNumber && (
                      <div>
                        <Label className="text-sm text-gray-500">
                          Hall Ticket Number
                        </Label>
                        <p className="font-medium">
                          {selectedLog.hallTicketNumber}
                        </p>
                      </div>
                    )}
                    {selectedLog.studentName && (
                      <div>
                        <Label className="text-sm text-gray-500">
                          Student Name
                        </Label>
                        <p className="font-medium">{selectedLog.studentName}</p>
                      </div>
                    )}
                    {selectedLog.recordCount && (
                      <div>
                        <Label className="text-sm text-gray-500">
                          Records Affected
                        </Label>
                        <p className="font-medium">{selectedLog.recordCount}</p>
                      </div>
                    )}
                  </div>
                )}

                {(selectedLog.activityType === "application_approved" ||
                  selectedLog.activityType === "application_rejected") && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedLog.applicantName && (
                      <div>
                        <Label className="text-sm text-gray-500">
                          Applicant Name
                        </Label>
                        <p className="font-medium">
                          {selectedLog.applicantName}
                        </p>
                      </div>
                    )}
                    {selectedLog.admissionNumber && (
                      <div>
                        <Label className="text-sm text-gray-500">
                          Admission Number
                        </Label>
                        <p className="font-mono text-sm">
                          {selectedLog.admissionNumber}
                        </p>
                      </div>
                    )}
                    {selectedLog.rejectionReason && (
                      <div className="col-span-2">
                        <Label className="text-sm text-gray-500">
                          Rejection Reason
                        </Label>
                        <p className="font-medium text-rose-700">
                          {selectedLog.rejectionReason}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedLog.actionPerformed && (
                  <div className="col-span-2">
                    <Label className="text-sm text-gray-500">
                      Action Performed
                    </Label>
                    <div
                      className={`mt-1 p-3 rounded-lg border ${
                        selectedLog.activityType === "application_approved"
                          ? "border-emerald-200 bg-emerald-50"
                          : selectedLog.activityType === "application_rejected"
                            ? "border-rose-200 bg-rose-50"
                            : "border-teal-200 bg-teal-50"
                      }`}
                    >
                      <p
                        className={`text-sm font-semibold ${
                          selectedLog.activityType === "application_approved"
                            ? "text-emerald-800"
                            : selectedLog.activityType ===
                                "application_rejected"
                              ? "text-rose-800"
                              : "text-teal-800"
                        }`}
                      >
                        {selectedLog.actionPerformed}
                      </p>
                    </div>
                  </div>
                )}

                {selectedLog.location && (
                  <div className="col-span-2">
                    <Label className="text-sm text-gray-500">Location Recorded</Label>
                    <div className="p-3 bg-gray-50 rounded border mt-1">
                      {selectedLog.location.latitude || selectedLog.location.lat ? (
                        <a 
                          href={`https://maps.google.com/?q=${selectedLog.location.latitude || selectedLog.location.lat},${selectedLog.location.longitude || selectedLog.location.lng}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="font-medium text-blue-600 hover:underline flex items-center gap-1 w-fit"
                        >
                          <MapPin className="h-4 w-4" />
                          {Number(selectedLog.location.latitude || selectedLog.location.lat).toFixed(6)}, {Number(selectedLog.location.longitude || selectedLog.location.lng).toFixed(6)}
                          {selectedLog.location.accuracy && (
                            <span className="text-gray-500 text-sm ml-2">
                              (Accuracy: {selectedLog.location.accuracy}m)
                            </span>
                          )}
                        </a>
                      ) : (
                        <p className="text-gray-500 font-medium text-sm flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          {selectedLog.location.error || "Location access denied or unavailable"}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
