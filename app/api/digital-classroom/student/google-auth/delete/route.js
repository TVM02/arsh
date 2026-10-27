import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const idToken = authorization
      .slice(7)
      .trim();

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication token is missing.",
        },
        { status: 401 }
      );
    }

    const decodedToken =
      await auth.verifyIdToken(idToken);

    const adminUid =
      decodedToken.uid;

    const adminUser =
      await auth.getUser(adminUid);

    const adminDoc =
      await db
        .collection("users")
        .doc(adminUid)
        .get();

    if (!adminDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Admin account was not found.",
        },
        { status: 403 }
      );
    }

    const adminData =
      adminDoc.data() || {};

    const isCentralAdmin =
      adminData.role === "admin" ||
      adminData.role === "central_admin" ||
      adminData.isCentralAdmin === true ||
      adminUser.email &&
        Array.isArray(
          (process.env.CENTRAL_ADMIN_EMAILS || "")
            .split(",")
            .map((email) =>
              email.trim().toLowerCase()
            )
        ) &&
        (process.env.CENTRAL_ADMIN_EMAILS || "")
          .split(",")
          .map((email) =>
            email.trim().toLowerCase()
          )
          .includes(
            adminUser.email
              .trim()
              .toLowerCase()
          );

    if (!isCentralAdmin) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized. Central Admin access required.",
        },
        { status: 403 }
      );
    }

    const body =
      await request.json().catch(() => ({}));

    const uid =
      typeof body?.uid === "string"
        ? body.uid.trim()
        : "";

    if (!uid) {
      return NextResponse.json(
        {
          success: false,
          message: "Student UID is required.",
        },
        { status: 400 }
      );
    }

    const studentRef =
      db.collection("users").doc(uid);

    const studentSnapshot =
      await studentRef.get();

    if (!studentSnapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Student account was not found.",
        },
        { status: 404 }
      );
    }

    const studentData =
      studentSnapshot.data() || {};

    if (
      studentData.role !== "student" ||
      studentData.userType !==
        "digital_student"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This account is not a Digital Student account.",
        },
        { status: 403 }
      );
    }

    if (
      !studentData.googleAuth?.connected
    ) {
      return NextResponse.json({
        success: true,
        message:
          "No Google account is currently connected.",
      });
    }

    /*
     * Remove ONLY Google authentication data.
     *
     * The student's:
     * - DKJU account
     * - registration
     * - class
     * - teacher assignment
     * - other details
     *
     * remain unchanged.
     */
    await studentRef.update({
      googleAuth:
        null,
      updatedAt:
        new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message:
        "Google account disconnected successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE DIGITAL STUDENT GOOGLE AUTH ERROR:",
      error
    );

    if (
      error?.code ===
        "auth/id-token-expired" ||
      error?.code ===
        "auth/invalid-id-token" ||
      error?.code ===
        "auth/argument-error"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your admin session has expired. Please log in again.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Unable to disconnect Google account.",
      },
      { status: 500 }
    );
  }
}