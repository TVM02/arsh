import { NextResponse } from "next/server";
import {
  FieldValue,
} from "firebase-admin/firestore";

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


    /* ========================================
       VALIDATION
    ======================================== */

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
       LOAD STUDENT FROM USERS

       THIS IS THE SOURCE OF TRUTH
    ======================================== */

    const studentRef =
      db
        .collection("users")
        .doc(cleanStudentUid);

    const studentSnap =
      await studentRef.get();


    if (!studentSnap.exists) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Student user document not found.",
        },
        {
          status: 404,
        },
      );
    }


    const student =
      studentSnap.data() || {};


    /* ========================================
       VERIFY DIGITAL STUDENT
    ======================================== */

    if (
      student?.role !== "student" ||
      student?.userType !==
        "digital_student"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This account is not a Digital Student.",
        },
        {
          status: 400,
        },
      );
    }


    /* ========================================
       VERIFY CURRENT ASSIGNMENT
    ======================================== */

    if (
      student?.teacherAssigned !==
      true
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This student is not currently assigned.",
        },
        {
          status: 409,
        },
      );
    }


    const currentTeacherUid =
      cleanText(
        student
          ?.assignedDigitalTeacherUid,
      );


    if (
      currentTeacherUid !==
      teacherUid
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This student is assigned to another Digital Teacher.",
        },
        {
          status: 409,
        },
      );
    }


    /* ========================================
       FIND OLD REGISTRATION DOCUMENT

       Only for cleanup.
       NOT source of truth.
    ======================================== */

    const registrationQuery =
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


    /* ========================================
       UNASSIGN FROM USERS

       MAIN FIREBASE DOCUMENT
    ======================================== */

    batch.update(
      studentRef,
      {
        teacherAssigned:
          false,

        assignedDigitalTeacherApplicationId:
          FieldValue.delete(),

        assignedDigitalTeacherUid:
          FieldValue.delete(),

        assignedDigitalTeacherName:
          FieldValue.delete(),

        assignedDigitalTeacherEmail:
          FieldValue.delete(),

        assignedDigitalTeacherMhrId:
          FieldValue.delete(),

        assignedDigitalTeacherClass:
          FieldValue.delete(),

        teacherAssignedAt:
          FieldValue.delete(),

        teacherAssignedBy:
          FieldValue.delete(),

        teacherUnassignedAt:
          FieldValue.serverTimestamp(),

        teacherUnassignedBy:
          admin.uid,

        updatedAt:
          FieldValue.serverTimestamp(),
      },
    );


    /* ========================================
       CLEAN OLD REGISTRATION DATA
    ======================================== */

    if (
      !registrationQuery.empty
    ) {
      const registrationRef =
        registrationQuery
          .docs[0]
          .ref;

      batch.update(
        registrationRef,
        {
          teacherAssigned:
            false,

          assignedDigitalTeacherApplicationId:
            FieldValue.delete(),

          assignedDigitalTeacherUid:
            FieldValue.delete(),

          assignedDigitalTeacherName:
            FieldValue.delete(),

          assignedDigitalTeacherEmail:
            FieldValue.delete(),

          assignedDigitalTeacherMhrId:
            FieldValue.delete(),

          assignedDigitalTeacherClass:
            FieldValue.delete(),

          teacherAssignedAt:
            FieldValue.delete(),

          teacherAssignedBy:
            FieldValue.delete(),

          teacherUnassignedAt:
            FieldValue.serverTimestamp(),

          teacherUnassignedBy:
            admin.uid,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
      );
    }


    /* ========================================
       COMMIT SERVER-SIDE FIREBASE UPDATE
    ======================================== */

    await batch.commit();


    /* ========================================
       VERIFY RESULT
    ======================================== */

    const updatedSnap =
      await studentRef.get();

    const updatedStudent =
      updatedSnap.data() || {};


    


    /* ========================================
       SUCCESS
    ======================================== */

    return NextResponse.json(
      {
        success: true,

        message:
          "Digital Student unassigned successfully.",

        studentUid:
          cleanStudentUid,

        teacherUid,

        teacherApplicationId,

        teacherAssigned:
          updatedStudent
            ?.teacherAssigned ===
          true,

        assignedDigitalTeacherUid:
          updatedStudent
            ?.assignedDigitalTeacherUid ??
          null,
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
          "Unable to unassign Digital Student.",
      },
      {
        status: 500,
      },
    );
  }
}