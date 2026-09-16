"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Home,
  Users,
  FileText,
  Settings,
  LogOut,
  X,
  BookOpen,
  UserCheck,
  BarChart3,
  Upload,
  User,
  GraduationCap,
  Bell,
  ClipboardList,
  Search,
  Building,
  ChevronDown,
  ChevronRight,
  Monitor,
  MapPin,
  Plus,
  FileCheck,
  Calendar,
  FilePen,
  Award,
  UserX,
  FileSpreadsheet,
  Palette,
  IndianRupee,
  Clock,
  ArrowRightLeft,
  History,
  Hash,
  Trophy,
  FolderOpen,
   Youtube, 
  UserPlus
} from "lucide-react";
import useAuthStore from "@/lib/authStore";
import Image from "next/image";
import { closeActiveSessionLog } from "@/lib/loggingUtils";
import { getCompetitionConfig } from "@/lib/competitionService";

const Sidebar = ({ isOpen, onClose }) => {
  const { user, userData, clearAuth, initializeAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [compVis, setCompVis] = useState({ sadar: true, mekhala: true, district: true, state: true });
  const [collapsedGroups, setCollapsedGroups] = useState({
    users: false,
    institutions: true,
    reports: true,
    settings: true,
    exams: false,
  });

  const toggleGroup = (groupKey) => {
    setCollapsedGroups((prev) => {
      const isCurrentlyOpen = !prev[groupKey];

      const newGroups = {
        users: true,
        institutions: true,
        reports: true,
        settings: true,
        exams: true,
      };

      if (!isCurrentlyOpen) {
        newGroups[groupKey] = false;
      }

      return newGroups;
    });
  };

  // useEffect(() => {
  //   initializeAuth();
  // }, []);

  // Determine user role based on current path and user data
  const getUserRole = () => {
    // Force home_admin role for home-control portal regardless of underlying user role
    if (pathname.includes("/home-control")) {
      return "home_admin";
    }

    // If userData has role (for madarsa_admin, central_admin, inspector, pariksha_board_convener), use it
    if (userData?.role) {
      return userData.role;
    }

    // If no role in userData, determine from current path
    if (pathname.includes("/dashboard/teacher")) {
      return "teacher";
    }
    if (pathname.includes("/dashboard/student")) {
      return "student";
    }
    if (pathname.includes("/dashboard/madarsa")) {
      return "madarsa_admin";
    }
    if (pathname.includes("/dashboard/manager")) {
      return "manager";
    }
    if (pathname.includes("/dashboard/inspector")) {
      return "inspector";
    }
    if (
      pathname.includes("/dashboard/dkju-control") ||
      pathname.includes("/dashboard/admin")
    ) {
      return "central_admin";
    }
    if (pathname.includes("/dashboard/pariksha-board-convener")) {
      return "pariksha_board_convener";
    }
    if (pathname.includes("/dashboard/convener")) {
      return "convener_admin";
    }
    if (pathname.includes("/dashboard/district")) {
      return "mekhala_admin";
    }

    // Fallback to user.role if available
    return user?.role || null;
  };

  const userRole = getUserRole();

  // Fetch competition portal visibility — must be after userRole is defined
  useEffect(() => {
    const PORTAL_ROLES = ["madarsa_admin", "mekhala_admin", "convener_admin"];
    if (!userRole || !PORTAL_ROLES.includes(userRole)) return;
    getCompetitionConfig()
      .then((cfg) => { if (cfg?.portalVisibility) setCompVis(cfg.portalVisibility); })
      .catch(() => {});
  }, [userRole]);

  // Update collapsed groups based on current path
  useEffect(() => {
    if (userRole === "central_admin") {
      // Function to determine which group should be open based on current path
      const getActiveGroup = () => {
        const centralPath = pathname.replace(
          "/dashboard/admin",
          "/dashboard/dkju-control",
        );

        // User Management pages
        if (
          centralPath.includes("/dashboard/dkju-control/students") ||
          centralPath.includes("/dashboard/dkju-control/teachers") ||
          centralPath.includes("/dashboard/dkju-control/managers") ||
          centralPath.includes("/dashboard/dkju-control/applications")
        ) {
          return "users";
        }

        // Institution Management pages
        if (
          centralPath.includes("/dashboard/dkju-control/madarsas") ||
          centralPath.includes("/dashboard/dkju-control/inspectors") ||
          centralPath.includes("/dashboard/dkju-control/districts") ||
          centralPath.includes("/dashboard/dkju-control/mekhala")
        ) {
          return "institutions";
        }

        // Reports & Reviews pages
        if (
          centralPath.includes("/dashboard/dkju-control/reports") ||
          centralPath.includes("/dashboard/dkju-control/sadar-reviews") ||
          centralPath.includes("/dashboard/dkju-control/analytics") ||
          centralPath.includes("/dashboard/dkju-control/tc-requests") ||
          centralPath.includes("/dashboard/dkju-control/login-logs") ||
          centralPath.includes("/dashboard/dkju-control/certificates")
        ) {
          return "reports";
        }

        // Exam Management pages
        if (centralPath.includes("/dashboard/dkju-control/exam")) {
          return "exams";
        }

        // Communication & Settings pages
        if (
          centralPath.includes("/dashboard/dkju-control/notices") ||
          centralPath.includes("/dashboard/dkju-control/sadar-notices") ||
          centralPath.includes("/dashboard/dkju-control/config") ||
          centralPath.includes("/dashboard/dkju-control/smart-class") ||
          centralPath.includes("/dashboard/dkju-control/pariksha-board-convener") ||
          centralPath.includes("/dashboard/dkju-control/style-guide")
        ) {
          return "settings";
        }
// Digtal class room control pages
        if (
          centralPath.includes("/dashboard/dkju-control/digital-student") ||
          centralPath.includes("/dashboard/dkju-control/digital-student/application") ||
          centralPath.includes("/dashboard/dkju-control/digital-teacher") ||
          centralPath.includes("/dashboard/dkju-control/digital-teacher/application")
        ) {
          return "digital";
        }        

        // Competition pages
        if (centralPath.includes("/dashboard/dkju-control/competition")) {
          return "competition";
        }

        // Default to users group for dashboard or unknown pages
        return "users";
      };

      const activeGroup = getActiveGroup();
      if (activeGroup) {
        setCollapsedGroups({
          users: activeGroup !== "users",
          institutions: activeGroup !== "institutions",
          reports: activeGroup !== "reports",
          settings: activeGroup !== "settings",
          exams: activeGroup !== "exams",
        });
      }
    }
  }, [pathname, userRole]);

  // // Don't render sidebar if still loading or no user
  // if (loading || !user) {
  //   return null;
  // }

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await closeActiveSessionLog();
      await signOut(auth);

      clearAuth();

      localStorage.removeItem("auth-storage");
      sessionStorage.removeItem("dkju-active-login-session");
      sessionStorage.removeItem("dkju-active-login-log-id");
      sessionStorage.removeItem("dkju-session-start");

      if (userData?.uid) {
        localStorage.removeItem(`inspector_session_${userData.uid}`);
        localStorage.removeItem(`inspector_session_start_${userData.uid}`);
        localStorage.removeItem(`inspector_session_end_${userData.uid}`);
        localStorage.removeItem(`inspector_rules_seen_${userData.uid}`);
        localStorage.removeItem(`inspector_refresh_${userData.uid}`);
      }

      Object.keys(localStorage).forEach((key) => {
        if (userData?.uid && key.includes(userData.uid)) {
          localStorage.removeItem(key);
        }
      });

      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setLogoutLoading(false);
    }
  };

  const getNavigationItems = () => {
    const baseItems = [
      {
        name: "Dashboard",
        href: `/dashboard/${userRole}`,
        icon: Home,
        matchExact: true,
      },
    ];

    switch (userRole) {
      case "student":
        return [
          ...baseItems,
          { name: "Profile", href: "/dashboard/student/profile", icon: User },
          {
            name: "Smart Class",
            href: "/dashboard/student/smart-class",
            icon: Monitor,
          },
          {
            name: "Assignments",
            href: "/dashboard/student/assignments",
            icon: BookOpen,
          },

          // Exam Group
          { type: "separator", label: "Exam Portal", groupKey: "exams" },
          {
            name: "Available Exams",
            href: "/dashboard/student/exam",
            icon: FileCheck,
            group: "exams",
          },
          {
            name: "Exam Notices",
            href: "/dashboard/student/exam/notices",
            icon: Bell,
            group: "exams",
          },
          {
            name: "Exam Timetables",
            href: "/dashboard/student/exam/timetables",
            icon: Calendar,
            group: "exams",
          },
          {
            name: "My Registrations",
            href: "/dashboard/student/exam/registrations",
            icon: UserCheck,
            group: "exams",
          },
          {
            name: "Results & Certificates",
            href: "/dashboard/student/results",
            icon: Award,
            group: "exams",
          },

          {
            name: "TC Request",
            href: "/dashboard/student/tc-request",
            icon: ArrowRightLeft,
          },
          {
            name: "Notices",
            href: "/dashboard/student/notices",
            icon: Bell,
          },
        ];

      case "teacher":
        return [
          ...baseItems,
          { name: "Profile", href: "/dashboard/teacher/profile", icon: User },
          {
            name: "Smart Class",
            href: "/dashboard/teacher/smart-class",
            icon: Monitor,
          },
          {
            name: "Students",
            href: "/dashboard/teacher/students",
            icon: Users,
          },
          {
            name: "Attendance",
            href: "/dashboard/teacher/attendance",
            icon: ClipboardList,
          },
          {
            name: "Assignments",
            href: "/dashboard/teacher/materials",
            icon: BookOpen,
          },
          {
            name: "Notices",
            href: "/dashboard/teacher/notices",
            icon: Bell,
          },
          {
            name: "TC Requests",
            href: "/dashboard/teacher/tc-requests",
            icon: Award,
          },
          {
            name: "Digital Class Registration",
            href: "/dashboard/teacher/digital-registration",
            icon: UserPlus,
          },
        ];

      case "manager":
        return [
          { name: "Dashboard", href: "/dashboard/manager", icon: Home },
          {
            name: "Students",
            href: "/dashboard/manager/students",
            icon: Users,
          },
          {
            name: "Teachers",
            href: "/dashboard/manager/teachers",
            icon: GraduationCap,
          },
          {
            name: "Reports",
            href: "/dashboard/manager/reports",
            icon: FileText,
          },
          {
            name: "Documents",
            href: "/dashboard/manager/documents",
            icon: FileSpreadsheet,
          },
          {
            name: "TC Requests",
            href: "/dashboard/manager/tc-requests",
            icon: Award,
          },
        ];

      case "madarsa_admin": // Changed from madarsa-admin to match your authStore
        return [
          { name: "Dashboard", href: "/dashboard/madarsa", icon: Home },
          {
            name: "Applications",
            href: "/dashboard/madarsa/applications",
            icon: ClipboardList,
          },
          {
            name: "Students",
            href: "/dashboard/madarsa/students",
            icon: Users,
          },
          {
            name: "Teachers",
            href: "/dashboard/madarsa/teachers",
            icon: GraduationCap,
          },
          {
            name: "Contact Directory",
            href: "/dashboard/madarsa/contacts",
            icon: Users,
          },
          {
            name: "Managers",
            href: "/dashboard/madarsa/managers",
            icon: UserCheck,
          },

          // Exam Management Group
          { type: "separator", label: "Exam Management", groupKey: "exams" },
          {
            name: "Exams",
            href: "/dashboard/madarsa/exam/exams",
            icon: FilePen,
            group: "exams",
          },
          {
            name: "Registered Students",
            href: "/dashboard/madarsa/exam/students",
            icon: Users,
            group: "exams",
          },
          {
            name: "Exam Notices",
            href: "/dashboard/madarsa/exam/notices",
            icon: Bell,
            group: "exams",
          },
          {
            name: "Exam Timetables",
            href: "/dashboard/madarsa/exam/timetables",
            icon: Calendar,
            group: "exams",
          },
          {
            name: "Bulk Register",
            href: "/dashboard/madarsa/bulk-register",
            icon: Upload,
            group: "exams",
          },

          {
            name: "Thafteesh Review/Report",
            href: "/dashboard/madarsa/thafteesh-review",
            icon: Search,
          },
          { name: "Notices", href: "/dashboard/madarsa/notices", icon: Bell },
          {
            name: "Mekhala Notices",
            href: "/dashboard/madarsa/mekhala-notices",
            icon: Bell,
          },
          {
            name: "TC Requests",
            href: "/dashboard/madarsa/tc-requests",
            icon: ArrowRightLeft,
          },
          {
            name: "Assignments",
            href: "/dashboard/madarsa/assignments",
            icon: FileText,
          },
          ...(compVis.sadar ? [
            { type: "separator", label: "Competition التنافس", groupKey: "competition" },
            { name: "Competition", href: "/dashboard/madarsa/competition", icon: Trophy, group: "competition" },
          ] : []),
        ];

      case "central_admin": // Changed from admin to match your authStore
        return [
          // Dashboard
          {
            name: "Dashboard",
            href: "/dashboard/dkju-control",
            icon: Home,
            group: "main",
          },

          // User Management Group
          { type: "separator", label: "User Management", groupKey: "users" },
          {
            name: "All Students",
            href: "/dashboard/dkju-control/students",
            icon: Users,
            group: "users",
          },
          {
            name: "All Teachers",
            href: "/dashboard/dkju-control/teachers",
            icon: UserCheck,
            group: "users",
          },
          {
            name: "All Managers",
            href: "/dashboard/dkju-control/managers",
            icon: Users,
            group: "users",
          },
          {
            name: "Applications",
            href: "/dashboard/dkju-control/applications",
            icon: ClipboardList,
            group: "users",
          },

          // Institution Management Group
          {
            type: "separator",
            label: "Institution Management",
            groupKey: "institutions",
          },
          {
            name: "Madarsa Management",
            href: "/dashboard/dkju-control/madarsas",
            icon: Building,
            group: "institutions",
          },
          {
            name: "Inspectors (Thaftheesh)",
            href: "/dashboard/dkju-control/inspectors",
            icon: Search,
            group: "institutions",
          },
          {
            name: "Mekhala Management",
            href: "/dashboard/dkju-control/districts",
            icon: MapPin,
            group: "institutions",
          },
          {
            name: "Districts Management",
            href: "/dashboard/dkju-control/mekhala",
            icon: Building,
            group: "institutions",
          },

          // Reports & Reviews Group
          {
            type: "separator",
            label: "Reports & Reviews",
            groupKey: "reports",
          },
          {
            name: "Inspection Reports",
            href: "/dashboard/dkju-control/reports",
            icon: FileText,
            group: "reports",
          },
          {
            name: "Contact Directory",
            href: "/dashboard/dkju-control/reports/contacts",
            icon: Users,
            group: "reports",
          },
          {
            name: "Sadar Reviews",
            href: "/dashboard/dkju-control/sadar-reviews",
            icon: Search,
            group: "reports",
          },
          {
            name: "Analytics",
            href: "/dashboard/dkju-control/analytics",
            icon: BarChart3,
            group: "reports",
          },
          {
            name: "TC Requests",
            href: "/dashboard/dkju-control/tc-requests",
            icon: ArrowRightLeft,
            group: "reports",
          },
          {
            name: "Website Visitor Reports",
            href: "/dashboard/dkju-control/login-logs",
            icon: Monitor,
            group: "reports",
          },
          {
            name: "Certificates",
            href: "/dashboard/dkju-control/certificates",
            icon: Award,
            group: "reports",
          },
          {
            name: "Attendance Reports",
            href: "/dashboard/dkju-control/reports/attendance",
            icon: ClipboardList,
            group: "reports",
          },
          {
            name: "Manager Report",
            href: "/dashboard/dkju-control/reports/manager-report",
            icon: FileSpreadsheet,
            group: "reports",
          },

          // Exam Management Group
          { type: "separator", label: "Exam Management", groupKey: "exams" },
          {
            name: "Exam Overview",
            href: "/dashboard/dkju-control/exam",
            icon: FileCheck,
            group: "exams",
          },
          {
            name: "Manage Exams",
            href: "/dashboard/dkju-control/exam/create",
            icon: Plus,
            group: "exams",
          },
          {
            name: "Board Convener Accounts",
            href: "/dashboard/dkju-control/exam/create-admin",
            icon: UserCheck,
            group: "exams",
          },
          {
            name: "All Registrations",
            href: "/dashboard/dkju-control/exam/registrations",
            icon: Users,
            group: "exams",
          },
          {
            name: "Exam Notices",
            href: "/dashboard/dkju-control/exam/notices",
            icon: Bell,
            group: "exams",
          },
          {
            name: "Exam Timetables",
            href: "/dashboard/dkju-control/exam/timetables",
            icon: Calendar,
            group: "exams",
          },
          {
            name: "Data Sheet",
            href: "/dashboard/dkju-control/exam/data-sheet",
            icon: Calendar,
            group: "exams",
          },
          {
            name: "Hall Ticket Sequence",
            href: "/dashboard/dkju-control/exam/hall-ticket-assignment",
            icon: Hash,
            group: "exams",
          },
          {
            name: "Unpublished Results",
            href: "/dashboard/dkju-control/exam/unpublished",
            icon: FileText,
            group: "exams",
          },

          // Competition Group
          { type: "separator", label: "Competition التنافس", groupKey: "competition" },
          {
            name: "Competition",
            href: "/dashboard/dkju-control/competition",
            icon: Trophy,
            group: "competition",
          },

          // Communication & Settings Group
          {
            type: "separator",
            label: "Communication & Settings",
            groupKey: "settings",
          },
          {
            name: "Smart Class Admin",
            href: "/dashboard/dkju-control/smart-class",
            icon: Monitor,
            group: "settings",
          },
          {
            name: "Pariksha Board Conveners",
            href: "/dashboard/dkju-control/pariksha-board-convener",
            icon: UserCheck,
            group: "settings",
          },
          {
            name: "Notices",
            href: "/dashboard/dkju-control/notices",
            icon: Bell,
            group: "settings",
          },
          {
            name: "Sadar Notices",
            href: "/dashboard/dkju-control/sadar-notices",
            icon: Building,
            group: "settings",
          },
          {
            name: "Configuration",
            href: "/dashboard/dkju-control/config",
            icon: Settings,
            group: "settings",
          },
          {
            name: "Brand Style Guide",
            href: "/dashboard/dkju-control/style-guide",
            icon: Palette,
            group: "settings",
          },
           // Digtal class room control pages
          {
            type: "separator",
            label: "Digital Classroom",
            groupKey: "digital",
          },
          {
            name: "Digital Student",
            href: "/dashboard/dkju-control/digital-student",
            icon: Users,
            group: "digital",
          },
          {
            name: "Student Application",
            href: "/dashboard/dkju-control/digital-student/application",
            icon: ClipboardList,
            group: "digital",
          },
          {
            name: "Digital Teacher",
            href: "/dashboard/dkju-control/digital-teacher",
            icon: UserCheck,
            group: "digital",
          },
          {
            name: "Teacher Application",
            href: "/dashboard/dkju-control/digital-teacher/application",
            icon: ClipboardList,
            group: "digital",
          },

        ];

      case "mekhala_admin":
        // NEW Mekhala Portal (mekhala_portal type) vs District Portal
        if (userData?.portalType === "mekhala_portal") {
          return [
            {
              name: "Profile",
              href: "/dashboard/mekhala-portal/profile",
              icon: User,
            },
            { name: "Dashboard", href: "/dashboard/mekhala-portal", icon: Home },
            {
              name: "Madrasa",
              href: "/dashboard/mekhala-portal/madarsas",
              icon: Building,
            },
            {
              name: "Students",
              href: "/dashboard/mekhala-portal/students",
              icon: Users,
            },
            {
              name: "Teachers",
              href: "/dashboard/mekhala-portal/teachers",
              icon: GraduationCap,
            },
            {
              name: "Exam Section",
              href: "/dashboard/mekhala-portal/exam",
              icon: FileCheck,
            },
            {
              name: "History",
              href: "/dashboard/mekhala-portal/history",
              icon: Clock,
            },
            {
              name: "Notices",
              href: "/dashboard/mekhala-portal/notices",
              icon: Bell,
            },
            ...(compVis.mekhala ? [
              { type: "separator", label: "Competition التنافس", groupKey: "competition" },
              { name: "Competition", href: "/dashboard/mekhala-portal/competition", icon: Trophy, group: "competition" },
            ] : []),
          ];
        }
        return [
          {
            name: "Profile",
            href: "/dashboard/district/profile",
            icon: User,
          },
          { name: "Dashboard", href: "/dashboard/district", icon: Home },
          {
            name: "Madrasa",
            href: "/dashboard/district/madarsas",
            icon: Building,
          },
          {
            name: "Students",
            href: "/dashboard/district/students",
            icon: Users,
          },
          {
            name: "Teachers",
            href: "/dashboard/district/teachers",
            icon: GraduationCap,
          },
          {
            name: "Exam Section",
            href: "/dashboard/district/exam",
            icon: FileCheck,
          },
          {
            name: "History",
            href: "/dashboard/district/history",
            icon: Clock,
          },
          {
            name: "Notices",
            href: "/dashboard/district/notices",
            icon: Bell,
          },
          ...(() => {
            // Detect if this admin manages a single mekhala (mekhala-level) or multiple (district-level)
            const isMekhalaLevel = (userData?.districts?.length || 0) <= 1;
            const hasAccess = isMekhalaLevel ? compVis.mekhala : compVis.district;
            return hasAccess ? [
              { type: "separator", label: "Competition التنافس", groupKey: "competition" },
              { name: "Competition", href: "/dashboard/district/competition", icon: Trophy, group: "competition" },
            ] : [];
          })(),
        ];

      case "convener_admin":
        if (userData?.portalType === "state_portal") {
          return [
            { type: "separator", label: "Competition التنافس", groupKey: "competition" },
            { name: "Competition", href: "/dashboard/state/competition", icon: Trophy, group: "competition" },
            { name: "Verification", href: "/dashboard/state/verify-score", icon: FileCheck, group: "competition" },
          ];
        }
        return [
          { name: "Dashboard", href: "/dashboard/convener", icon: Home },
          { name: "Mekhala", href: "/dashboard/convener/districts", icon: MapPin },
          { name: "Madrasas", href: "/dashboard/convener/madarsas", icon: Building },
          { name: "Exam Section", href: "/dashboard/convener/exam", icon: FileCheck },
          { name: "Finance", href: "/dashboard/convener/finance", icon: IndianRupee },
          { name: "History", href: "/dashboard/convener/history", icon: Clock },
          { name: "Notices", href: "/dashboard/convener/notices", icon: Bell },
          { name: "Profile", href: "/dashboard/convener/profile", icon: User },
        ];

      case "inspector": {
        const madarsaPageMatch = pathname.match(
          /\/dashboard\/inspector\/madarsas\/([^/?#]+)/,
        );
        const inspectingMadarsaId = madarsaPageMatch?.[1] || null;
        return [
          { name: "Dashboard", href: "/dashboard/inspector", icon: Home },
          {
            name: "Inspection Reports",
            href: "/dashboard/inspector/reports",
            icon: FileText,
          },
          {
            name: "History",
            href: "/dashboard/inspector/history",
            icon: History,
          },
          {
            name: "Management Reports",
            href: "/dashboard/inspector/management",
            icon: BarChart3,
          },
          {
            name: "Contacts",
            href: "/dashboard/inspector/contacts",
            icon: Users,
          },
          {
            name: "Notices",
            href: "/dashboard/inspector/notices",
            icon: Bell,
          },
          ...(inspectingMadarsaId
            ? [
                {
                  name: "Records",
                  href: `/dashboard/inspector/records?sourceMadarsaId=${inspectingMadarsaId}`,
                  icon: FolderOpen,
                },
              ]
            : []),
        ];
      }

      case "pariksha_board_convener":
        return [
          {
            name: "Dashboard",
            href: "/dashboard/pariksha-board-convener",
            icon: Home,
          },

          // Student Management Group
          {
            type: "separator",
            label: "Student Management",
            groupKey: "students",
          },
          {
            name: "Registered Students",
            href: "/dashboard/pariksha-board-convener/students",
            icon: Users,
            group: "students",
          },
          {
            name: "Unregistered Students",
            href: "/dashboard/pariksha-board-convener/unregistered-students",
            icon: UserX,
            group: "students",
          },
          {
            name: "Data Sheet",
            href: "/dashboard/pariksha-board-convener/data-sheet",
            icon: FileSpreadsheet,
            group: "students",
          },

          // Examination Management Group
          {
            type: "separator",
            label: "Examination Management",
            groupKey: "exams",
          },
          {
            name: "Active Exams",
            href: "/dashboard/pariksha-board-convener/exams",
            icon: BookOpen,
            group: "exams",
          },
          // {
          //   name: "Marks Entry",
          //   href: "/dashboard/pariksha-board-convener/marks-entry",
          //   icon: FilePen,
          //   group: "exams",
          // },
          {
            name: "Results Management",
            href: "/dashboard/pariksha-board-convener/results",
            icon: BarChart3,
            group: "exams",
          },
          {
            name: "Profile",
            href: "/dashboard/pariksha-board-convener/profile",
            icon: User,
          },
        ];
      case "home_admin":
        return [
          { type: "separator", label: "Homepage Control", groupKey: "home-control" },
          { name: "Carousel Images", href: "/home-control?tab=carousel", icon: Palette, group: "home-control" },
          { name: "Marquee Announcements", href: "/home-control?tab=marquee", icon: Bell, group: "home-control" },
          { name: "Latest News", href: "/home-control?tab=news", icon: FileText, group: "home-control" },
          { name: "Upcoming Events", href: "/home-control?tab=events", icon: Calendar, group: "home-control" },
          { name: "YouTube Videos", href: "/home-control?tab=youtube-videos", icon: Youtube, group: "home-control" },
          { name: "Friday Quthba", href: "/home-control?tab=friday-quthba", icon: BookOpen, group: "home-control" },
          { name: "About Us", href: "/home-control?tab=about", icon: Users, group: "home-control" },
          { name: "Madrasa Holidays", href: "/home-control?tab=madrasa-holidays", icon: Calendar, group: "home-control" },
        ];

      default:
        return baseItems;
    }
  };

  const navigationItems = getNavigationItems();

  // Find the best matching item based on path specificity
  const currentTab = searchParams ? searchParams.get("tab") : null;
  const activeNavItem = navigationItems
    .filter((item) => item.href)
    .filter((item) => {
      if (userRole === "home_admin" && item.href.includes("?tab=")) {
        const itemTab = item.href.split("?tab=")[1];
        const activeTabMatch = currentTab || "carousel";
        return activeTabMatch === itemTab;
      }
      return item.matchExact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
    })
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-teal-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-teal-700">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <Image src={"/logo.png"} alt="Logo" width={32} height={32} />
            </div>
            <span className="text-white font-semibold text-lg">DKJU</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-white hover:bg-teal-700"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* User info */}
        <div className="px-6 py-4 border-b border-teal-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">
                {user?.displayName ||
                  userData?.madarsaName ||
                  userData?.fullName ||
                  userData?.name ||
                  user?.email
                    .toString()
                    .substring(0, user?.email.indexOf("@")) ||
                  "User"}
              </p>
              <p className="text-teal-300 text-xs capitalize">
                {userData?.portalType === "state_portal"
                  ? "State Admin"
                  : userRole === "mekhala_admin"
                  ? userData?.portalType === "mekhala_portal" 
                    ? "Mekhala Admin" 
                    : userData?.portalType === "district_portal" 
                      ? "District Admin" 
                      : userData?.mekhalaDocType === "sub_mekhala" 
                        ? "District Admin" 
                        : "Mekhala Admin"
                  : userRole?.replace(/_/g, " ") === "madarssa admin"
                  ? "Office Admin"
                  : userRole?.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto scrollbar-hide">
          {navigationItems.map((item, index) => {
            // Handle group separators
            if (item.type === "separator") {
              const isExamGroup = item.groupKey === "exams";
              const isAlwaysOpen = userRole === "student" && isExamGroup;

              const isCollapsed = isAlwaysOpen
                ? false
                : collapsedGroups[item.groupKey];
              const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown;

              return (
                <div
                  key={`separator-${index}`}
                  className="pt-4 pb-2 first:pt-0"
                >
                  {isAlwaysOpen ? (
                    <div className="px-3 py-1 flex items-center justify-between text-left">
                      <h3 className="text-xs font-semibold text-teal-300 uppercase tracking-wider">
                        {item.label}
                      </h3>
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleGroup(item.groupKey)}
                      className="w-full px-3 py-1 flex items-center justify-between text-left hover:bg-white/5 rounded transition-colors"
                    >
                      <h3 className="text-xs font-semibold text-teal-300 uppercase tracking-wider">
                        {item.label}
                      </h3>
                      <ChevronIcon className="h-3 w-3 text-teal-400 transition-transform duration-200" />
                    </button>
                  )}
                  <div className="mt-1 border-t border-teal-700/50"></div>
                </div>
              );
            }

            // Handle regular navigation items
            const isActive = activeNavItem?.href === item.href;

            // Check if this item belongs to a collapsed group
            const isAlwaysOpen =
              userRole === "student" && item.group === "exams";
            const isInCollapsedGroup =
              item.group && collapsedGroups[item.group] && !isAlwaysOpen;

            // Don't render items in collapsed groups (except main group)
            if (isInCollapsedGroup && item.group !== "main") {
              return null;
            }

            // Determine if this item should be indented (belongs to a group other than "main")
            const isGroupedItem = item.group && item.group !== "main";

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  // Add left margin/padding for grouped items to show they're under a group
                  isGroupedItem ? "px-3 ml-4" : "px-3",
                  isActive
                    ? "bg-white/10 text-white shadow-sm border border-white/20"
                    : "text-teal-100 hover:bg-white/5 hover:text-white",
                )}
                onClick={onClose}
              >
                <item.icon
                  className={cn(
                    "flex-shrink-0",
                    // Make icons slightly smaller for grouped items
                    isGroupedItem ? "h-3.5 w-3.5" : "h-4 w-4",
                  )}
                />
                <span className="truncate">{item.name}</span>
                {item.badge && (
                  <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-orange-500 text-white rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-4 py-6 border-t border-teal-700">
          <Button
            variant="ghost"
            className="w-full justify-start text-teal-100 hover:bg-teal-700 hover:text-white"
            onClick={handleLogout}
            disabled={logoutLoading}
          >
            <LogOut className="h-5 w-5 mr-3" />
            {logoutLoading ? "Signing out..." : "Sign Out"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;