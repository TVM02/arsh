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

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  try {
    const decoded =
      await auth.verifyIdToken(
        header.slice(7).trim(),
      );

    if (
      decoded?.role === "central_admin" ||
      decoded?.role === "admin"
    ) {
      return decoded;
    }

    const userSnap =
      await db
        .collection("users")
        .doc(decoded.uid)
        .get();

    if (!userSnap.exists) {
      return null;
    }

    const userData =
      userSnap.data() || {};

    if (
      userData?.role !==
        "central_admin" &&
      userData?.role !== "admin"
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

export async function GET(
  request,
  { params },
) {
  try {
    const { id } = await params;

    const teacherApplicationId =
      cleanText(id);

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

    /* ==========================================
       LOAD TEACHER
    ========================================== */

    const teacherSnap =
      await db
        .collection(
          "digitalClassTeacherRegistrations",
        )
        .doc(
          teacherApplicationId,
        )
        .get();

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

    const sourceTeacherUid =
      cleanText(
        teacher?.sourceTeacherUid,
      );

    const digitalTeacherUid =
      cleanText(
        teacher?.digitalTeacherUid,
      );

    const legacyTeacherUid =
      cleanText(
        teacher?.legacyDigitalTeacherUid,
      );

    const possibleTeacherUids =
      [
        sourceTeacherUid,
        digitalTeacherUid,
        legacyTeacherUid,
      ].filter(
        (value, index, array) =>
          value &&
          array.indexOf(value) ===
            index,
      );

    /* ==========================================
       LOAD ASSIGNMENTS

       Application ID is most important.
       This also survives UID migration.
    ========================================== */

    const assignmentsCollection =
      db.collection(
        "digitalTeacherStudentAssignments",
      );

    const assignmentMap =
      new Map();

    const applicationQuery =
      await assignmentsCollection
        .where(
          "digitalTeacherApplicationId",
          "==",
          teacherApplicationId,
        )
        .get();

    applicationQuery.docs.forEach(
      (docSnap) => {
        const data =
          docSnap.data() || {};

        if (
          data?.status ===
          "active"
        ) {
          assignmentMap.set(
            docSnap.id,
            {
              id: docSnap.id,
              ...data,
            },
          );
        }
      },
    );

    /*
      Also search by Teacher UID.

      Covers old records where
      application ID may be missing.
    */

    for (
      const teacherUid of
      possibleTeacherUids
    ) {
      const uidQuery =
        await assignmentsCollection
          .where(
            "digitalTeacherUid",
            "==",
            teacherUid,
          )
          .get();

      uidQuery.docs.forEach(
        (docSnap) => {
          const data =
            docSnap.data() || {};

          if (
            data?.status ===
            "active"
          ) {
            assignmentMap.set(
              docSnap.id,
              {
                id: docSnap.id,
                ...data,
              },
            );
          }
        },
      );
    }

    const assignments =
      Array.from(
        assignmentMap.values(),
      );

    /* ==========================================
       LOAD STUDENT PROFILES
    ========================================== */

    const students = [];

    for (
      const assignment of
      assignments
    ) {
      const studentUid =
        cleanText(
          assignment?.studentUid,
        );

      if (!studentUid) {
        continue;
      }

      let studentDoc = null;

      /*
        Current records:
        uid = Firebase student UID
      */

      const byUid =
        await db
          .collection(
            "digitalClassStudentRegistrations",
          )
          .where(
            "uid",
            "==",
            studentUid,
          )
          .limit(1)
          .get();

      if (!byUid.empty) {
        studentDoc =
          byUid.docs[0];
      }

      /*
        Legacy fallback:
        studentUid field
      */

      if (!studentDoc) {
        const byStudentUid =
          await db
            .collection(
              "digitalClassStudentRegistrations",
            )
            .where(
              "studentUid",
              "==",
              studentUid,
            )
            .limit(1)
            .get();

        if (
          !byStudentUid.empty
        ) {
          studentDoc =
            byStudentUid.docs[0];
        }
      }

      /*
        Final fallback:
        UID may be document ID
      */

      if (!studentDoc) {
        const directSnap =
          await db
            .collection(
              "digitalClassStudentRegistrations",
            )
            .doc(studentUid)
            .get();

        if (
          directSnap.exists
        ) {
          studentDoc =
            directSnap;
        }
      }

      /*
        IMPORTANT:
        Even if student profile is
        missing, do not silently lose
        the assignment.
      */

      if (!studentDoc) {
        students.push({
          id:
            studentUid,

          uid:
            studentUid,

          studentUid,

          fullName:
            "Student Profile Not Found",

          alreadyAssigned:
            true,

          assignmentId:
            assignment.id,

          assignment:
            assignment,

          assignedDigitalTeacherUid:
            assignment
              ?.digitalTeacherUid ||
            null,

          assignedDigitalTeacherApplicationId:
            assignment
              ?.digitalTeacherApplicationId ||
            teacherApplicationId,
        });

        continue;
      }

      const studentData =
        studentDoc.data() || {};

      students.push({
        id:
          studentDoc.id,

        ...studentData,

        /*
          Always preserve Firebase UID.
        */
        uid:
          studentData?.uid ||
          studentData?.studentUid ||
          studentUid,

        alreadyAssigned:
          true,

        assignmentId:
          assignment.id,

        assignment:
          assignment,

        assignedDigitalTeacherUid:
          assignment
            ?.digitalTeacherUid ||
          studentData
            ?.assignedDigitalTeacherUid ||
          null,

        assignedDigitalTeacherApplicationId:
          teacherApplicationId,
      });
    }

    return NextResponse.json({
      success: true,

      teacherApplicationId,

      teacherUid:
        sourceTeacherUid ||
        digitalTeacherUid ||
        null,

      assignedCount:
        students.length,

      students,
    });
  } catch (error) {
    console.error(
      "GET ASSIGNED DIGITAL STUDENTS ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to load assigned Digital Students.",
      },
      {
        status: 500,
      },
    );
  }
}