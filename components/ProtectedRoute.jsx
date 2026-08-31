"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/lib/authStore";
import { auth } from "@/lib/firebase";

const ROLE_LOGIN_PATHS = {
  central_admin: "/auth/login/admin",
  admin: "/auth/login/admin",
  home_admin: "/home-control/login",
  madarsa_admin: "/auth/login/madarsa-admin",
  inspector: "/auth/login/inspector",
  mekhala_admin: "/auth/login/district",
  convener_admin: "/auth/login/convener",
  pariksha_board_convener: "/auth/login/pariksha-board-convener",
  teacher: "/auth/login/teacher",
  student: "/auth/login/student",
  manager: "/auth/login/manager",
};

const getLoginPath = (requiredRole, allowedRoles) => {
  const role = requiredRole || allowedRoles?.[0] || "student";
  return ROLE_LOGIN_PATHS[role] || "/auth/login/student";
};

const ProtectedRoute = ({
  children,
  requiredRole,
  allowedRoles,
  redirectTo = "/unauthorized",
}) => {
  const {
    user,
    userData,
    role,
    loading,
    _hasHydrated,
    hasRole,
    forceReinitializeAuth,
    refreshUserData,
    clearAuth,
    isSessionValid,
  } = useAuthStore();
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [roleRetried, setRoleRetried] = useState(false);
  const [sessionVerified, setSessionVerified] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const loginPath = getLoginPath(requiredRole, allowedRoles);

  const checkRole = () => {
    if (allowedRoles && allowedRoles.length > 0) {
      return allowedRoles.some((r) => hasRole(r));
    }
    if (requiredRole) {
      return hasRole(requiredRole);
    }
    return true;
  };

  const effectiveRole = requiredRole || (allowedRoles && allowedRoles[0]);
  const isCustomPortalUser = !!(userData && !user);
  const hasCachedSession = !!userData;
  const isDataMissing = !!(user && !userData && !loading);
  const isRoleMismatch =
    !loading &&
    (user || isCustomPortalUser) &&
    userData &&
    effectiveRole &&
    !checkRole();

  // SECURITY FIX: Verify that Firebase session is actually active
  // This prevents bypass via manual URL navigation when session has expired
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
    if (!_hasHydrated || !authReady) return;
    setSessionVerified(null);
    
    const verifySession = async () => {
      const firebaseUser = auth.currentUser;
      const CUSTOM_AUTH_ROLES = ["convener_admin", "mekhala_admin"];
      const isCustomPortal = CUSTOM_AUTH_ROLES.includes(userData?.role);
      
      // For custom portal users, no Firebase session needed
      if (isCustomPortal && userData && isSessionValid()) {
        setSessionVerified(true);
        return;
      }

      // For Firebase auth users, verify that auth.currentUser exists and matches
      if (user && firebaseUser && user.uid === firebaseUser.uid) {
        setSessionVerified(true);
        return;
      }

      // If no Firebase user but we think there's a session, clear it
      if (!firebaseUser && user) {
        console.warn("Session mismatch: Firebase user cleared but store still has user");
        clearAuth();
        setSessionVerified(false);
        return;
      }

      // If no Firebase user and no custom portal user, session is invalid
      if (!firebaseUser && !isCustomPortal) {
        clearAuth();
        setSessionVerified(false);
        return;
      }

      setSessionVerified(false);
    };

    verifySession();
  }, [_hasHydrated, authReady, user, userData, clearAuth, isSessionValid]);

  const handleRetry = async () => {
    setRetrying(true);
    await forceReinitializeAuth();
    setRetrying(false);
  };

  useEffect(() => {
    if (isDataMissing) {
      const timer = setTimeout(() => {
        forceReinitializeAuth();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isDataMissing, forceReinitializeAuth]);

  useEffect(() => {
    if (isRoleMismatch && !roleRetried) {
      setRoleRetried(true);
      refreshUserData().catch(() => {});
    }
  }, [isRoleMismatch, roleRetried, refreshUserData]);

  useEffect(() => {
    if (!loading && sessionVerified === true) {
      if (!user && !userData && effectiveRole) {
        router.push(loginPath);
        return;
      }
      if (user && !userData) return;
      if (
        (user || isCustomPortalUser) &&
        effectiveRole &&
        !checkRole() &&
        roleRetried
      ) {
        router.push(redirectTo);
        return;
      }
    }
  }, [
    user,
    userData,
    role,
    requiredRole,
    allowedRoles,
    redirectTo,
    router,
    loading,
    hasRole,
    roleRetried,
    isCustomPortalUser,
    sessionVerified,
    loginPath,
  ]);

  useEffect(() => {
    if (_hasHydrated && authReady && sessionVerified === false && !loading) {
      router.push(loginPath);
    }
  }, [_hasHydrated, authReady, sessionVerified, loading, router, loginPath]);

  if (!_hasHydrated || !authReady) {
    return null;
  }

  // SECURITY FIX: Require session verification before allowing access
  if (sessionVerified === false && !loading) {
    // Session verification shows that user is not authenticated
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-600 border-t-transparent mx-auto"></div>
          <p className="text-teal-600 font-medium">Redirecting...</p>
        </div>
      </div>
    );
  }

  if ((loading || sessionVerified !== true) && !hasCachedSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-600 border-t-transparent mx-auto"></div>
          <p className="text-teal-600 font-medium">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (isDataMissing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-600 border-t-transparent mx-auto"></div>
          <p className="text-teal-600 font-medium">
            {retrying ? "Retrying..." : "Loading your session..."}
          </p>
          <button
            onClick={handleRetry}
            className="text-sm text-teal-600 underline hover:text-teal-800"
          >
            Taking too long? Click to retry
          </button>
        </div>
      </div>
    );
  }

  if (isRoleMismatch && !roleRetried) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-600 border-t-transparent mx-auto"></div>
          <p className="text-teal-600 font-medium">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user && !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-600 border-t-transparent mx-auto"></div>
          <p className="text-teal-600 font-medium">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (effectiveRole && !checkRole()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-600 border-t-transparent mx-auto"></div>
          <p className="text-teal-600 font-medium">Redirecting...</p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
