import { NextResponse } from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function cleanText(value) {
  return String(value ?? "").trim();
}


async function verifyCentralAdmin(
  request,
  auth,
  db,
) {
  const header =
    request.headers.get(
      "authorization",
    ) || "";

  if (
    !header.startsWith("Bearer ")
  ) {
    return null;
  }

  try {
    const decoded =
      await auth.verifyIdToken(
        header.slice(7).trim(),
      );

    if (
      decoded?.role ===
        "central_admin" ||
      decoded?.role ===
        "admin"
    ) {
      return decoded;
    }

    const snap =
      await db
        .collection("users")
        .doc(decoded.uid)
        .get();

    if (!snap.exists) {
      return null;
    }

    const data =
      snap.data() || {};

    if (
      data?.role !==
        "central_admin" &&
      data?.role !== "admin"
    ) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error(
      "VERIFY ADMIN ERROR:",
      error,
    );

    return null;
  }
}


export async function DELETE(
  request,
  { params },
) {
  try {
    const {
      id,
      studentUid,
    } = await params;

    const teacherApplicationId =
      cleanText(id);

    const cleanStudentUid =
      cleanText(studentUid);

    if (!teacherApplicationId) {
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

    if (!cleanStudentUid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Student UID is required.",
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
            "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }


    /* ========================================
       LOAD DIGITAL TEACHER
    ======================================== */

    const teacherRef =
      db
        .collection(
          "digitalClassTeacherRegistrations",
        )
        .doc(
          teacherApplicationId,
        );

    const teacherSnap =
      await teacherRef.get();

    if (!teacherSnap.exists) {
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
      teacherSnap.data() || {};

    const teacherUid =
      cleanText(
        teacher?.sourceTeacherUid ||
        teacher?.digitalTeacherUid,
      );

    if (!teacherUid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Teacher Firebase UID not found.",
        },
        {
          status: 400,
        },
      );
    }


    /* ========================================
       FIND ACTIVE ASSIGNMENT
    ======================================== */

    const assignmentId =
      `${teacherUid}_${cleanStudentUid}`;

    const assignmentRef =
      db
        .collection(
          "digitalTeacherStudentAssignments",
        )
        .doc(
          assignmentId,
        );

    const assignmentSnap =
      await assignmentRef.get();

    if (!assignmentSnap.exists) {
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


    /* ========================================
       FIND DIGITAL STUDENT REGISTRATION
    ======================================== */

    const studentQuery =
      await db
        .collection(
          "digitalClassStudentRegistrations",
        )
        .where(
          "uid",
          "==",
          cleanStudentUid,
        )
        .limit(1)
        .get();

    const batch =
      db.batch();

    const now =
      new Date();


    /* ========================================
       MARK ASSIGNMENT INACTIVE
    ======================================== */

    batch.set(
      assignmentRef,
      {
        status:
          "inactive",

        unassignedAt:
          now,

        unassignedBy:
          admin.uid,

        updatedAt:
          now,
      },
      {
        merge: true,
      },
    );


    /* ========================================
       CLEAR STUDENT ASSIGNED TEACHER
    ======================================== */

    if (!studentQuery.empty) {
      const studentDoc =
        studentQuery.docs[0];

      const studentData =
        studentDoc.data() || {};

      /*
        Safety:
        clear only if this is the
        currently assigned teacher.
      */
      const currentAssignedTeacherUid =
        cleanText(
          studentData
            ?.assignedDigitalTeacherUid,
        );

      if (
        !currentAssignedTeacherUid ||
        currentAssignedTeacherUid ===
          teacherUid
      ) {
        batch.set(
          studentDoc.ref,
          {
            teacherAssigned:
              false,

            assignedDigitalTeacherUid:
              null,

            assignedDigitalTeacherApplicationId:
              null,

            assignedDigitalTeacherMhrId:
              null,

            assignedDigitalTeacherName:
              null,

            assignedDigitalTeacherEmail:
              null,

            assignedDigitalTeacherClass:
              null,

            teacherAssignedAt:
              null,

            teacherUnassignedAt:
              now,

            teacherUnassignedBy:
              admin.uid,

            updatedAt:
              now,
          },
          {
            merge: true,
          },
        );
      }
    }


    await batch.commit();


    return NextResponse.json({
      success: true,

      message:
        "Digital Student unassigned successfully.",

      studentUid:
        cleanStudentUid,

      teacherUid,

      teacherApplicationId,
    });

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
          "Unable to unassign Digital Student.",
      },
      {
        status: 500,
      },
    );
  }
}