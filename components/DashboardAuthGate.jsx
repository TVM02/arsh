"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useAuthStore from "@/lib/authStore";
import { auth } from "@/lib/firebase";

const CUSTOM_PORTAL_ROLES = ["convener_admin", "mekhala_admin"];

const DASHBOARD_RULES = [
  {
    basePath: "/dashboard/dkju-control",
    role: "central_admin",
    loginPath: "/auth/login/dkju-control",
  },
  {
    basePath: "/dashboard/madarsa",
    role: "madarsa_admin",
    loginPath: "/auth/login/madarsa-admin",
  },
  {
    basePath: "/dashboard/inspector",
    role: "inspector",
    loginPath: "/auth/login/inspector",
  },
  {
    basePath: "/dashboard/mekhala-portal",
    role: "mekhala_admin",
    loginPath: "/auth/login/mekhala-admin",
  },
  {
    basePath: "/dashboard/district",
    role: "mekhala_admin",
    loginPath: "/auth/login/district",
  },
  {
    basePath: "/dashboard/convener",
    role: "convener_admin",
    loginPath: "/auth/login/convener",
  },
  {
    basePath: "/dashboard/pariksha-board-convener",
    role: "pariksha_board_convener",
    loginPath: "/auth/login/pariksha-board-convener",
  },
  {
    basePath: "/dashboard/teacher",
    role: "teacher",
    loginPath: "/auth/login/teacher",
  },
  {
    basePath: "/dashboard/student",
    role: "student",
    loginPath: "/auth/login/student",
  },
  {
    basePath: "/dashboard/manager",
    role: "manager",
    loginPath: "/auth/login/manager",
  },
];

const ROLE_HOME = DASHBOARD_RULES.reduce((acc, rule) => {
  if (!acc[rule.role]) acc[rule.role] = rule.basePath;
  return acc;
}, {});

function matchesBase(pathname, basePath) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function getRule(pathname) {
  return DASHBOARD_RULES.find((rule) => matchesBase(pathname, rule.basePath));
}

function LoadingScreen({ message = "Verifying access..." }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-600 border-t-transparent mx-auto" />
        <p className="text-teal-600 font-medium">{message}</p>
      </div>
    </div>
  );
}

export default function DashboardAuthGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const {
    user,
    userData,
    loading,
    _hasHydrated,
    initializeAuth,
    clearAuth,
    logout,
    isSessionValid,
  } = useAuthStore();

  const rule = useMemo(() => getRule(pathname), [pathname]);
  const isCustomPortalUser = CUSTOM_PORTAL_ROLES.includes(userData?.role);
  const hasFirebaseSession = Boolean(
    auth.currentUser && user && auth.currentUser.uid === user.uid,
  );
  const sessionValid = authReady && isSessionValid();
  const roleMatches = useMemo(() => {
    if (!rule) return true;
    if (userData?.role !== rule.role) return false;
    if (rule.type && userData?.mekhalaDocType !== rule.type) return false;
    return true;
  }, [rule, userData]);

  const userHome = useMemo(() => {
    if (!userData?.role) return null;
    if (userData.role === "mekhala_admin") {
      if (userData.portalType) {
        return userData.portalType === "mekhala_portal" ? "/dashboard/mekhala-portal" : "/dashboard/district";
      }
      return userData.mekhalaDocType === "sub_mekhala"
        ? "/dashboard/district"
        : "/dashboard/mekhala-portal";
    }
    return ROLE_HOME[userData.role] || null;
  }, [userData]);

  useEffect(() => {
    const unsubscribe = initializeAuth();
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [initializeAuth]);

  useEffect(() => {
    let cancelled = false;
    const waitForAuth = async () => {
      try {
        if (typeof auth.authStateReady === "function") {
          await auth.authStateReady();
        }
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    };

    waitForAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!_hasHydrated || !authReady || loading || !rule) return;

    if (!sessionValid) {
      clearAuth();
      router.replace(rule.loginPath);
      return;
    }

    if (!roleMatches && userHome) {
      router.replace(userHome);
    }
  }, [
    _hasHydrated,
    authReady,
    loading,
    rule,
    sessionValid,
    roleMatches,
    userHome,
    clearAuth,
    router,
  ]);

  // Idle Timeout Mechanism
  useEffect(() => {
    if (!sessionValid) return;

    let timeoutId;
    const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log("Session expired due to inactivity.");
        logout();
      }, IDLE_TIMEOUT_MS);
    };

    // Listen to standard activity events
    const events = ["mousemove", "keydown", "wheel", "touchstart", "click"];
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    
    // Initialize timer
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [sessionValid, logout]);

  if (!_hasHydrated || !authReady || loading) {
    return <LoadingScreen />;
  }

  if (!rule) {
    return children;
  }

  if (!sessionValid) {
    return <LoadingScreen message="Redirecting to login..." />;
  }

  if (!isCustomPortalUser && !hasFirebaseSession) {
    return <LoadingScreen message="Redirecting to login..." />;
  }

  if (!roleMatches) {
    return <LoadingScreen message="Redirecting..." />;
  }

  return children;
}
