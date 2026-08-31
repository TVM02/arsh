"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import useAuthStore from "@/lib/authStore";
import { auth } from "@/lib/firebase";

const ROLE_DASHBOARD_MAP = {
  central_admin: "/dashboard/dkju-control",
  admin: "/dashboard/dkju-control",
  madarsa_admin: "/dashboard/madarsa",
  inspector: "/dashboard/inspector",
  mekhala_admin: "/dashboard/district",
  convener_admin: "/dashboard/convener",
  manager: "/dashboard/manager",
  pariksha_board_convener: "/dashboard/pariksha-board-convener",
  teacher: "/dashboard/teacher",
  student: "/dashboard/student",
};

export function useRoleGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, userData, loading } = useAuthStore();

  useEffect(() => {
    if (!pathname.startsWith("/dashboard/")) return;

    if (loading || !userData?.role) return;

    // Guard against stale persisted store: if the Firebase auth user doesn't match
    // the store user (e.g. after a different user just logged in), skip redirecting
    // until onAuthStateChanged updates the store with the correct role.
    const firebaseUid = auth.currentUser?.uid;
    if (firebaseUid && user?.uid && firebaseUid !== user.uid) return;

    let ownedBasePath = ROLE_DASHBOARD_MAP[userData.role];
    
    // Custom overrides based on portalType
    if (userData.role === "mekhala_admin" && userData.portalType === "mekhala_portal") {
      ownedBasePath = "/dashboard/mekhala-portal";
    } else if (userData.role === "mekhala_admin" && userData.portalType === "district_portal") {
      ownedBasePath = "/dashboard/district";
    } else if (userData.role === "convener_admin" && userData.portalType === "state_portal") {
      ownedBasePath = "/dashboard/state";
    }

    if (!ownedBasePath) return;

    if (!pathname.startsWith(ownedBasePath)) {
      router.replace(ownedBasePath);
    }
  }, [loading, userData, pathname, router, user?.uid]);
}
