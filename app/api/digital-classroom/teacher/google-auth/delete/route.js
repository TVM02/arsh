import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request) {
  try {
    const authorization = request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Authentication required." },
        { status: 401 }
      );
    }

    const idToken = authorization.slice(7).trim();

    if (!idToken) {
      return NextResponse.json(
        { message: "Authentication token is missing." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const uid = String(body?.uid || "").trim();

    if (!uid) {
      return NextResponse.json(
        { message: "Teacher UID is required." },
        { status: 400 }
      );
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    // Verify Central Admin session
    const decodedToken = await auth.verifyIdToken(idToken);
    const adminUid = decodedToken.uid;

    const adminDoc = await db
      .collection("users")
      .doc(adminUid)
      .get();

    const adminData = adminDoc.exists
      ? adminDoc.data() || {}
      : {};

    const isCentralAdmin =
      adminData.role === "admin" ||
      adminData.role === "central_admin" ||
      adminData.isCentralAdmin === true;

    if (!isCentralAdmin) {
      return NextResponse.json(
        { message: "Central Admin access required." },
        { status: 403 }
      );
    }

    const teacherRef = db.collection("users").doc(uid);
    const teacherSnapshot = await teacherRef.get();

    if (!teacherSnapshot.exists) {
      return NextResponse.json(
        { message: "Teacher account was not found." },
        { status: 404 }
      );
    }

    const teacherData = teacherSnapshot.data() || {};

    if (
      teacherData.role !== "teacher" ||
      teacherData.digitalTeacher !== true ||
      teacherData.digitalClassAccess !== true
    ) {
      return NextResponse.json(
        {
          message:
            "This account is not authorized for Digital Classroom Teacher access.",
        },
        { status: 403 }
      );
    }

    await teacherRef.update({
      googleAuth: null,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Teacher Google account disconnected successfully.",
    });
  } catch (error) {
    console.error(
      "DIGITAL TEACHER GOOGLE AUTH DELETE ERROR:",
      error
    );

    if (
      error?.code === "auth/id-token-expired" ||
      error?.code === "auth/argument-error" ||
      error?.code === "auth/invalid-id-token"
    ) {
      return NextResponse.json(
        {
          message:
            "Your admin session has expired. Please log in again.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        message:
          error?.message ||
          "Unable to disconnect teacher Google account.",
      },
      { status: 500 }
    );
  }
}