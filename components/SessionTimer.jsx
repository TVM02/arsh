"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import useAuthStore from "@/lib/authStore";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_AT_MS = 9 * 60 * 1000; // show warning at 9 min (1 min countdown)
const WARNING_DURATION_S = 60; // 60-second countdown

// Full-screen "Session Expired" splash shown before redirect
function SessionExpiredScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
      <div className="text-center px-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Expired</h2>
        <p className="text-gray-500 text-sm mb-1">Your session has expired due to inactivity.</p>
        <p className="text-gray-400 text-sm">Please login again to continue.</p>
        <div className="mt-6 flex items-center justify-center gap-2 text-teal-600 text-sm font-medium">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Redirecting to login…
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
];

export default function SessionTimer() {
  const { logout, userData } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_DURATION_S);

  const idleTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const warningShownRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current)
      clearInterval(countdownIntervalRef.current);
  }, []);

  // Manual logout (user clicked button)
  const handleLogout = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    if (typeof logout === "function") logout();
  }, [logout, clearAllTimers]);

  // Auto-expire: show expired screen, logout, then redirect
  const handleExpire = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    setShowExpired(true);

    const userRole = userData?.role;
    const mekhalaType = userData?.mekhalaDocType;
    const path = window.location.pathname;

    if (typeof logout === "function") logout();
    // Redirect to login after 2.5s
    setTimeout(() => {
      let loginUrl = "/auth/login";

      // 1. Determine by role if available
      if (userRole) {
        if (userRole === "central_admin" || userRole === "admin") {
          loginUrl = "/auth/login/dkju-control";
        } else if (userRole === "madarsa_admin") {
          loginUrl = "/auth/login/madarsa-admin";
        } else if (userRole === "inspector") {
          loginUrl = "/auth/login/inspector";
        } else if (userRole === "convener_admin") {
          loginUrl = "/auth/login/convener";
        } else if (userRole === "pariksha_board_convener") {
          loginUrl = "/auth/login/pariksha-board-convener";
        } else if (userRole === "teacher") {
          loginUrl = "/auth/login/teacher";
        } else if (userRole === "student") {
          loginUrl = "/auth/login/student";
        } else if (userRole === "manager") {
          loginUrl = "/auth/login/manager";
        } else if (userRole === "mekhala_admin") {
          if (mekhalaType === "sub_mekhala" || path.includes("/dashboard/mekhala-portal")) {
            loginUrl = "/auth/login/mekhala-admin";
          } else {
            loginUrl = "/auth/login/district";
          }
        }
      } else {
        // Fallback: Try to determine the right login page from the current URL
        if (path.includes("/dashboard/student")) loginUrl = "/auth/login/student";
        else if (path.includes("/dashboard/teacher")) loginUrl = "/auth/login/teacher";
        else if (path.includes("/dashboard/madarsa")) loginUrl = "/auth/login/madarsa-admin";
        else if (path.includes("/dashboard/manager")) loginUrl = "/auth/login/manager";
        else if (path.includes("/dashboard/dkju-control")) loginUrl = "/auth/login/dkju-control";
        else if (path.includes("/dashboard/inspector")) loginUrl = "/auth/login/inspector";
        else if (path.includes("/dashboard/convener")) loginUrl = "/auth/login/convener";
        else if (path.includes("/dashboard/pariksha-board-convener")) loginUrl = "/auth/login/pariksha-board-convener";
        else if (path.includes("/dashboard/mekhala-portal")) loginUrl = "/auth/login/mekhala-admin";
        else if (path.includes("/dashboard/district")) loginUrl = "/auth/login/district";
      }

      window.location.href = loginUrl;
    }, 2500);
  }, [logout, userData, clearAllTimers]);

  const resetTimer = useCallback(() => {
    clearAllTimers();
    warningShownRef.current = false;
    setShowWarning(false);
    setCountdown(WARNING_DURATION_S);

    // Set warning timer (fires at 9 min)
    warningTimerRef.current = setTimeout(() => {
      warningShownRef.current = true;
      setShowWarning(true);
      setCountdown(WARNING_DURATION_S);

      // Start countdown
      let remaining = WARNING_DURATION_S;
      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(countdownIntervalRef.current);
        }
      }, 1000);
    }, WARNING_AT_MS);

    // Set hard logout timer (fires at 10 min) — uses handleExpire
    idleTimerRef.current = setTimeout(() => {
      handleExpire();
    }, IDLE_TIMEOUT_MS);
  }, [clearAllTimers, handleExpire]);

  const handleActivity = useCallback(() => {
    if (!warningShownRef.current) {
      resetTimer();
    }
  }, [resetTimer]);

  useEffect(() => {
    resetTimer();

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true }),
    );

    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, handleActivity),
      );
    };
  }, [resetTimer, handleActivity, clearAllTimers]);

  if (showExpired) return <SessionExpiredScreen />;
  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-orange-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Session Expiring
        </h2>
        <p className="text-gray-600 mb-6 text-sm">
          You have been inactive for a while. Your session will expire in:
        </p>

        <div className="text-5xl font-bold text-orange-500 mb-6">
          {String(Math.floor(countdown / 60)).padStart(2, "0")}:
          {String(countdown % 60).padStart(2, "0")}
        </div>

        <p className="text-xs text-gray-500 mb-6">
          Click &quot;Stay Logged In&quot; to continue your session.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleLogout}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Log Out
          </button>
          <button
            onClick={resetTimer}
            className="flex-1 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}
