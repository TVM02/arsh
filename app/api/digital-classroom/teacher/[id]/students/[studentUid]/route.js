import { NextResponse } from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEACHER_COLLECTION =
  "digitalClassTeacherRegistrations";

const ASSIGNMENT_COLLECTION =
  "digitalTeacherStudentAssignments";

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

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token =
    authorization.slice(7).trim();

  if (!token) {
    return null;
  }

  try {
    const decoded =
      await auth.verifyIdToken(token);

    if (
      decoded?.role === "central_admin" ||
      decoded?.role === "admin"
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
      userData?.role !== "central_admin" &&
      userData?.role !== "admin"
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
   UNASSIGN DIGITAL STUDENT
============================================ */

export async function DELETE(
  request,
  { params },
) {
  try {
    const {
      id,
      studentUid,
    } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!studentUid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Student UID is required.",
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

    /* ========================================
       VERIFY CENTRAL ADMIN
    ======================================== */

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

    /* ========================================
       LOAD DIGITAL TEACHER
    ======================================== */

    const teacherSnapshot =
      await db
        .collection(
          TEACHER_COLLECTION,
        )
        .doc(id)
        .get();

    if (!teacherSnapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher not found.",
        },
        {
          status: 404,
        },
      );
    }

    const teacher =
      teacherSnapshot.data();

    const digitalTeacherUid =
      teacher?.digitalTeacherUid;

    if (!digitalTeacherUid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher UID not found.",
        },
        {
          status: 400,
        },
      );
    }

    /* ========================================
       ASSIGNMENT DOCUMENT ID
    ======================================== */

    const assignmentId =
      `${digitalTeacherUid}_${studentUid}`;

    const assignmentRef =
      db
        .collection(
          ASSIGNMENT_COLLECTION,
        )
        .doc(assignmentId);

    const assignmentSnapshot =
      await assignmentRef.get();

    if (!assignmentSnapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Student assignment not found.",
        },
        {
          status: 404,
        },
      );
    }

    const assignment =
      assignmentSnapshot.data();

    /* ========================================
       SECURITY CHECK
    ======================================== */

    if (
      assignment?.digitalTeacherUid !==
      digitalTeacherUid
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid student assignment.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      assignment?.studentUid !==
      studentUid
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Student UID does not match assignment.",
        },
        {
          status: 400,
        },
      );
    }

    /* ========================================
       ALREADY REMOVED
    ======================================== */

    if (
      assignment?.status ===
      "inactive"
    ) {
      return NextResponse.json(
        {
          success: true,
          message:
            "Digital Student is already unassigned.",
        },
        {
          status: 200,
        },
      );
    }

    /* ========================================
       SOFT REMOVE
    ======================================== */

    const now =
      new Date();

    await assignmentRef.set(
      {
        status:
          "inactive",

        unassignedBy:
          admin.uid,

        unassignedAt:
          now,

        updatedAt:
          now,
      },
      {
        merge: true,
      },
    );

    return NextResponse.json(
      {
        success: true,

        message:
          "Digital Student unassigned successfully.",

        assignmentId,

        digitalTeacherUid,

        studentUid,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "UNASSIGN DIGITAL STUDENT ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to unassign Digital Student.",
      },
      {
        status: 500,
      },
    );
  }
}