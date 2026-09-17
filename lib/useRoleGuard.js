"use client";

import { useEffect } from "react";
import {
  useRouter,
  usePathname,
} from "next/navigation";

import useAuthStore from "@/lib/authStore";
import { auth } from "@/lib/firebase";


const ROLE_DASHBOARD_MAP = {
  central_admin:
    "/dashboard/dkju-control",

  admin:
    "/dashboard/dkju-control",

  madarsa_admin:
    "/dashboard/madarsa",

  inspector:
    "/dashboard/inspector",

  mekhala_admin:
    "/dashboard/district",

  convener_admin:
    "/dashboard/convener",

  manager:
    "/dashboard/manager",

  pariksha_board_convener:
    "/dashboard/pariksha-board-convener",

  teacher:
    "/dashboard/teacher",

  student:
    "/dashboard/student",
};


export function useRoleGuard() {
  const router = useRouter();
  const pathname =
    usePathname();

  const {
    user,
    userData,
    loading,
  } = useAuthStore();


  useEffect(() => {
    if (
      !pathname.startsWith(
        "/dashboard/",
      )
    ) {
      return;
    }


    if (
      loading ||
      !userData?.role
    ) {
      return;
    }


    // ==========================================
    // FIREBASE SESSION SAFETY
    // ==========================================

    const firebaseUid =
      auth.currentUser?.uid;

    if (
      firebaseUid &&
      user?.uid &&
      firebaseUid !== user.uid
    ) {
      return;
    }


    // ==========================================
    // DIGITAL TEACHER CHECK
    // ==========================================

    const isDigitalTeacher =
      userData?.role ===
        "teacher" &&

      userData?.digitalTeacher ===
        true &&

      userData
        ?.digitalClassAccess ===
        true &&

      (
        !userData
          ?.digitalTeacherStatus ||

        userData
          ?.digitalTeacherStatus ===
          "active"
      );


    // ==========================================
    // DIGITAL TEACHER DASHBOARD
    // ==========================================

    if (
      pathname.startsWith(
        "/dashboard/digital-teacher",
      )
    ) {
      if (isDigitalTeacher) {
        // Digital Teacher has access.
        // DO NOT redirect to normal Teacher.
        return;
      }

      router.replace(
        "/auth/login/digital-teacher",
      );

      return;
    }


    // ==========================================
    // NORMAL TEACHER DASHBOARD
    // ==========================================

    if (
      pathname.startsWith(
        "/dashboard/teacher",
      ) &&
      userData.role === "teacher"
    ) {
      // Digital Teacher is still a normal
      // Teacher, so normal Teacher portal
      // must continue to work.
      return;
    }


    // ==========================================
    // DEFAULT DASHBOARD
    // ==========================================

    let ownedBasePath =
      ROLE_DASHBOARD_MAP[
        userData.role
      ];


    // ==========================================
    // STUDENT TYPE OVERRIDE
    // ==========================================

    if (
      userData.role ===
      "student"
    ) {
      if (
        userData.userType ===
        "digital_student"
      ) {
        ownedBasePath =
          "/dashboard/digital-student";
      } else {
        ownedBasePath =
          "/dashboard/student";
      }
    }


    // ==========================================
    // MEKHALA / DISTRICT / STATE
    // ==========================================

    if (
      userData.role ===
        "mekhala_admin" &&
      userData.portalType ===
        "mekhala_portal"
    ) {
      ownedBasePath =
        "/dashboard/mekhala-portal";
    }

    else if (
      userData.role ===
        "mekhala_admin" &&
      userData.portalType ===
        "district_portal"
    ) {
      ownedBasePath =
        "/dashboard/district";
    }

    else if (
      userData.role ===
        "convener_admin" &&
      userData.portalType ===
        "state_portal"
    ) {
      ownedBasePath =
        "/dashboard/state";
    }


    if (!ownedBasePath) {
      return;
    }


    // ==========================================
    // ALREADY INSIDE OWN DASHBOARD
    // ==========================================

    if (
      pathname.startsWith(
        ownedBasePath,
      )
    ) {
      return;
    }


    // ==========================================
    // REDIRECT WRONG PORTAL
    // ==========================================

    router.replace(
      ownedBasePath,
    );

  }, [
    loading,
    userData,
    pathname,
    router,
    user?.uid,
  ]);
}