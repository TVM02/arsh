"use client";

import { useEffect, useState, Suspense } from "react";
import StudentSidebar from "./sidebar"
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, X, Clock, Timer, AlertTriangle } from "lucide-react";
import useAuthStore from "@/lib/authStore";
import { useRoleGuard } from "@/lib/useRoleGuard";
import DigitalSessionTimer from "@/components/digitalclassroom/DigitalSessionTimer";
import DigitalSessionAnalytics from "@/components/digitalclassroom/DigitalSessionAnalytics"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, ChevronDown, LogOut, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { closeActiveSessionLog } from "@/lib/loggingUtils";

const Layout = ({
  children,
  showTimer = false,
  timeRemaining = 0,
  sessionActive = false,
  formatTimeRemaining,
  getTimerColor,
  allowedTime = 60,
}) => {
  const { user, userData, initializeAuth, clearAuth } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const [logoutLoading, setLogoutLoading] = useState(false);

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

  useRoleGuard();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <div className="bg-gray-50 fixed inset-0 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-black bg-opacity-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <Suspense fallback={null}>
        <StudentSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </Suspense>
      {/* Main content */}
      <div className="lg:pl-64 h-full flex flex-col">
        {/* Top bar */}
        <div className="z-30 bg-white shadow-sm border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>

              {/* Log Out button removed from header as per user request */}
          </div>
        </div>

        {/* Page content */}
        <main className="p-6 flex-1 overflow-y-auto scrollbar-hide">{children}</main>

        {/* Inspector Timer Bar */}
        {showTimer && (
          <div className="z-50 bg-gradient-to-r from-teal-900 to-teal-900 border-t border-teal-700 shadow-lg">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Timer className="h-5 w-5 text-blue-200" />
                  <span className="text-blue-100 font-medium">
                    Session Timer:
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <div
                    className={`text-2xl font-bold ${
                      getTimerColor
                        ? getTimerColor(timeRemaining)
                        : "text-white"
                    }`}
                  >
                    {formatTimeRemaining
                      ? formatTimeRemaining(timeRemaining)
                      : "00:00"}
                  </div>

                  <Badge
                    variant={sessionActive ? "default" : "destructive"}
                    className={
                      sessionActive
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-red-600 hover:bg-red-700"
                    }
                  >
                    {sessionActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {timeRemaining <= 300 &&
                  timeRemaining > 0 && ( // 5 minutes warning
                    <div className="flex items-center space-x-2 bg-orange-600 text-white px-3 py-1 rounded-full">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Session ending soon!
                      </span>
                    </div>
                  )}

                <div className="text-blue-200 text-sm">
                  Inspector Portal Session
                </div>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-blue-800 h-1">
              <div
                className={`h-full transition-all duration-1000 ${
                  timeRemaining <= 300
                    ? "bg-red-500"
                    : timeRemaining <= 900
                      ? "bg-orange-500"
                      : "bg-green-500"
                }`}
                style={{
                  width: `${
                    sessionActive && formatTimeRemaining
                      ? Math.max(
                          0,
                          (timeRemaining / (Math.max(1, allowedTime) * 60)) *
                            100,
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        <div
  className="
    flex
    flex-col
    items-center
    justify-center
    gap-2
    border-t
    border-teal-700
    bg-gradient-to-r
    from-teal-950
    via-teal-900
    to-emerald-950
    px-6
    py-4
    text-center
    sm:flex-row
    sm:gap-3
  "
>
  <div
    className="
      flex
      h-9
      w-9
      items-center
      justify-center
      rounded-full
      bg-white/10
      text-emerald-300
      ring-1
      ring-white/10
    "
  >
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5a2 2 0 012-2h2.28a2 2 0 011.94 1.515l.518 2.072a2 2 0 01-.55 1.906l-1.257 1.257a16.042 16.042 0 006.32 6.32l1.257-1.257a2 2 0 011.906-.55l2.072.518A2 2 0 0121 16.72V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  </div>

  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
    <span
      className="
        text-[11px]
        font-semibold
        uppercase
        tracking-[0.14em]
        text-teal-200
      "
    >
      Technical Support
    </span>

    <span className="hidden text-teal-500 sm:inline">
      •
    </span>

    <a
      href="tel:8891177850"
      className="
        text-sm
        font-bold
        text-white
        transition
        hover:text-emerald-300
      "
    >
      8891177850
    </a>
  </div>
</div>
      </div>{" "}
      <DigitalSessionTimer />{" "}
      <DigitalSessionAnalytics />{" "}
    </div>
  );
};

export default Layout;
