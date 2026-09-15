import { NextResponse } from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION =
  "digitalClassTeacherRegistrations";

/* ============================================
   VERIFY CENTRAL ADMIN
============================================ */

async function verifyCentralAdmin(
  request,
  auth,
  db,
) {
  const authorization =
    request.headers.get("authorization") || "";

  if (
    !authorization.startsWith("Bearer ")
  ) {
    return null;
  }

  const token =
    authorization
      .slice(7)
      .trim();

  if (!token) {
    return null;
  }

  try {
    const decoded =
      await auth.verifyIdToken(
        token,
      );

    if (
      decoded?.role ===
        "central_admin" ||
      decoded?.role ===
        "admin"
    ) {
      return decoded;
    }

    const userSnapshot =
      await db
        .collection("users")
        .doc(decoded.uid)
        .get();

    if (!userSnapshot.exists) {
      return null;
    }

    const userData =
      userSnapshot.data();

    if (
      userData?.role !==
        "central_admin" &&
      userData?.role !==
        "admin"
    ) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error(
      "VERIFY CENTRAL ADMIN ERROR:",
      error,
    );

    return null;
  }
}

/* ============================================
   DELETE DIGITAL TEACHER
============================================ */

export async function DELETE(
  request,
  { params },
) {
  try {
    const { id } =
      await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher application ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const auth =
      getAdminAuth();

    const db =
      getAdminDb();

    /* ============================================
       VERIFY ADMIN
    ============================================ */

    const admin =
      await verifyCentralAdmin(
        request,
        auth,
        db,
      );

    if (!admin?.uid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized. Central Admin access required.",
        },
        {
          status: 401,
        },
      );
    }

    /* ============================================
       LOAD APPLICATION
    ============================================ */

    const registrationRef =
      db
        .collection(COLLECTION)
        .doc(id);

    const registrationSnapshot =
      await registrationRef.get();

    if (
      !registrationSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher application not found.",
        },
        {
          status: 404,
        },
      );
    }

    const teacher =
      registrationSnapshot.data();

    const digitalTeacherUid =
      teacher?.digitalTeacherUid ||
      null;

    /* ============================================
       DELETE FIREBASE AUTH ACCOUNT
    ============================================ */

    if (digitalTeacherUid) {
      try {
        await auth.deleteUser(
          digitalTeacherUid,
        );

        console.log(
          "DIGITAL TEACHER AUTH DELETED:",
          digitalTeacherUid,
        );
      } catch (error) {
        /*
          If account already doesn't exist,
          continue deleting Firestore records.
        */

        if (
          error?.code !==
          "auth/user-not-found"
        ) {
          throw error;
        }
      }
    }

    /* ============================================
       DELETE FIRESTORE USER + APPLICATION
    ============================================ */

    const batch =
      db.batch();

    if (digitalTeacherUid) {
      const userRef =
        db
          .collection("users")
          .doc(
            digitalTeacherUid,
          );

      batch.delete(
        userRef,
      );
    }

    batch.delete(
      registrationRef,
    );

    await batch.commit();

    /* ============================================
       SUCCESS
    ============================================ */

    return NextResponse.json({
      success: true,

      message:
        "Digital Teacher deleted successfully.",

      applicationId:
        id,

      digitalTeacherUid,

      deletedBy:
        admin.uid,
    });
  } catch (error) {
    console.error(
      "DELETE DIGITAL TEACHER ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to delete Digital Teacher.",
      },
      {
        status: 500,
      },
    );
  }
}