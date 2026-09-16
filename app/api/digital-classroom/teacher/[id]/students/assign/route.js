import { NextResponse } from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

import {
  createDigitalTeacherStudentAssignment,
} from "@/lib/digitalTeacherStudentAssignmentService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEACHER_COLLECTION =
  "digitalClassTeacherRegistrations";

/* ============================================
   HELPERS
============================================ */

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeClass(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/^class\s*/i, "")
    .replace(/\s+/g, "");
}

/* ============================================
   VERIFY CENTRAL ADMIN
============================================ */

async function verifyCentralAdmin(
  request,
  auth,
  db,
) {
  const authorization =
    request.headers.get(
      "authorization",
    ) || "";

  if (
    !authorization.startsWith(
      "Bearer ",
    )
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
   GET STUDENT CLASS
============================================ */

function getStudentClass(student) {
  return (
    student?.className ||
    student?.class ||
    student?.currentClass ||
    student?.applyingclass ||
    student?.classLevel ||
    student?.academicDetails
      ?.className ||
    student?.academicDetails
      ?.class ||
    ""
  );
}

/* ============================================
   ASSIGN STUDENTS
============================================ */

export async function POST(
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

    /* ----------------------------------------
       VERIFY ADMIN
    ---------------------------------------- */

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

    /* ----------------------------------------
       BODY
    ---------------------------------------- */

    const body =
      await request.json();

    const studentIds =
      Array.isArray(
        body?.studentIds,
      )
        ? [
            ...new Set(
              body.studentIds
                .map((value) =>
                  cleanText(value),
                )
                .filter(Boolean),
            ),
          ]
        : [];

    if (
      studentIds.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please select at least one Digital Student.",
        },
        {
          status: 400,
        },
      );
    }

    /* ----------------------------------------
       LOAD TEACHER
    ---------------------------------------- */

    const teacherRef =
      db
        .collection(
          TEACHER_COLLECTION,
        )
        .doc(id);

    const teacherSnapshot =
      await teacherRef.get();

    if (
      !teacherSnapshot.exists
    ) {
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

    if (
      teacher?.status !==
      "approved"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher must be approved before assigning students.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      teacher?.accountStatus &&
      teacher.accountStatus !==
        "active"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher account is not active.",
        },
        {
          status: 400,
        },
      );
    }

    const digitalTeacherUid =
      teacher?.digitalTeacherUid;

    if (!digitalTeacherUid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher Firebase UID not found.",
        },
        {
          status: 400,
        },
      );
    }

    /* ----------------------------------------
       TEACHING ASSIGNMENT
    ---------------------------------------- */

    const teachingAssignment =
      teacher?.teachingAssignment ||
      {};

    const assignedClasses =
      Array.isArray(
        teachingAssignment?.classes,
      )
        ? teachingAssignment.classes
        : [];

    const assignedSubjects =
      Array.isArray(
        teachingAssignment?.subjects,
      )
        ? teachingAssignment.subjects
        : [];

    const teachingLanguages =
      Array.isArray(
        teachingAssignment?.languages,
      )
        ? teachingAssignment.languages
        : [];

    if (
      assignedClasses.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This Digital Teacher has no assigned classes.",
        },
        {
          status: 400,
        },
      );
    }

    const normalizedTeacherClasses =
      assignedClasses.map(
        normalizeClass,
      );

    /* ----------------------------------------
       VALIDATE EACH STUDENT
    ---------------------------------------- */

    const assignedStudents = [];

    const skippedStudents = [];

    for (
      const studentId
      of studentIds
    ) {
      try {
        const studentSnapshot =
          await db
            .collection("users")
            .doc(studentId)
            .get();

        if (
          !studentSnapshot.exists
        ) {
          skippedStudents.push({
            studentId,
            reason:
              "Student not found.",
          });

          continue;
        }

        const student =
          studentSnapshot.data();

        /* Must be Digital Student */

        if (
          student?.role !==
            "student" ||
          student?.userType !==
            "digital_student"
        ) {
          skippedStudents.push({
            studentId,
            reason:
              "User is not a Digital Student.",
          });

          continue;
        }

        /* Student UID */

        const studentUid =
          student?.uid ||
          studentSnapshot.id;

        /* Class validation */

        const studentClass =
          getStudentClass(
            student,
          );

        const normalizedStudentClass =
          normalizeClass(
            studentClass,
          );

        if (
          !normalizedTeacherClasses
            .includes(
              normalizedStudentClass,
            )
        ) {
          skippedStudents.push({
            studentId,
            studentUid,
            reason:
              `Student class "${studentClass || "Unknown"}" is not assigned to this teacher.`,
          });

          continue;
        }

        /* ----------------------------------------
           CREATE ASSIGNMENT
        ---------------------------------------- */

        const assignment =
          await createDigitalTeacherStudentAssignment(
            {
              digitalTeacherUid,

              digitalTeacherApplicationId:
                id,

              studentUid,

              studentId:
                studentSnapshot.id,

              assignedClasses: [
                studentClass,
              ],

              assignedSubjects,

              teachingLanguages,

              assignedBy:
                admin.uid,
            },
          );

        assignedStudents.push({
          studentId:
            studentSnapshot.id,

          studentUid,

          fullName:
            student?.fullName ||
            student?.name ||
            "",

          studentClass,

          assignmentId:
            assignment.id,
        });
      } catch (studentError) {
        console.error(
          "STUDENT ASSIGN ERROR:",
          studentId,
          studentError,
        );

        skippedStudents.push({
          studentId,
          reason:
            studentError?.message ||
            "Assignment failed.",
        });
      }
    }

    /* ----------------------------------------
       RESPONSE
    ---------------------------------------- */

    return NextResponse.json(
      {
        success: true,

        message:
          `${assignedStudents.length} Digital Student(s) assigned successfully.`,

        digitalTeacherUid,

        assignedCount:
          assignedStudents.length,

        skippedCount:
          skippedStudents.length,

        assignedStudents,

        skippedStudents,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "ASSIGN DIGITAL STUDENTS ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to assign Digital Students.",
      },
      {
        status: 500,
      },
    );
  }
}