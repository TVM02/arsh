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

function serialize(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (
    value &&
    typeof value.toDate ===
      "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serialize);
  }

  if (
    typeof value ===
    "object"
  ) {
    const result = {};

    for (
      const [key, child]
      of Object.entries(value)
    ) {
      result[key] =
        serialize(child);
    }

    return result;
  }

  return value;
}

/* ============================================
   CENTRAL ADMIN AUTH
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
      "VERIFY ADMIN ERROR:",
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
   GET ELIGIBLE DIGITAL STUDENTS
============================================ */

export async function GET(
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
       LOAD DIGITAL TEACHER
    ---------------------------------------- */

    const teacherSnapshot =
      await db
        .collection(
          TEACHER_COLLECTION,
        )
        .doc(id)
        .get();

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
            "Digital Teacher is not approved.",
        },
        {
          status: 400,
        },
      );
    }

    const digitalTeacherUid =
      teacher
        ?.digitalTeacherUid;

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

    /* ----------------------------------------
       TEACHER ASSIGNED CLASSES
    ---------------------------------------- */

    const teacherClasses =
      Array.isArray(
        teacher
          ?.teachingAssignment
          ?.classes,
      )
        ? teacher
            .teachingAssignment
            .classes
        : [];

    const normalizedTeacherClasses =
      teacherClasses.map(
        normalizeClass,
      );

    /* ----------------------------------------
       LOAD DIGITAL STUDENTS
    ---------------------------------------- */

    const studentsSnapshot =
      await db
        .collection("users")
        .where(
          "userType",
          "==",
          "digital_student",
        )
        .get();

    /* ----------------------------------------
       LOAD CURRENT ASSIGNMENTS
    ---------------------------------------- */

    const assignmentSnapshot =
      await db
        .collection(
          ASSIGNMENT_COLLECTION,
        )
        .where(
          "digitalTeacherUid",
          "==",
          digitalTeacherUid,
        )
        .where(
          "status",
          "==",
          "active",
        )
        .get();

    const assignedStudentUids =
      new Set(
        assignmentSnapshot.docs.map(
          (doc) =>
            doc.data()
              ?.studentUid,
        ),
      );

    /* ----------------------------------------
       FILTER ELIGIBLE STUDENTS
    ---------------------------------------- */

    const students =
      studentsSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...serialize(
            doc.data(),
          ),
        }))
        .filter((student) => {
          /*
            Must be a Digital Student
          */

          if (
            student?.role !==
            "student"
          ) {
            return false;
          }

          if (
            student?.userType !==
            "digital_student"
          ) {
            return false;
          }

          /*
            Match teacher classes
          */

          const studentClass =
            normalizeClass(
              getStudentClass(
                student,
              ),
            );

          if (
            normalizedTeacherClasses
              .length > 0 &&
            !normalizedTeacherClasses
              .includes(
                studentClass,
              )
          ) {
            return false;
          }

          return true;
        })
        .map((student) => ({
          ...student,

          studentClass:
            getStudentClass(
              student,
            ),

          alreadyAssigned:
            assignedStudentUids.has(
              student.uid ||
                student.id,
            ),
        }));

    /* ----------------------------------------
       RESPONSE
    ---------------------------------------- */

    return NextResponse.json(
      {
        success: true,

        teacher: {
          id,

          digitalTeacherUid,

          fullName:
            teacher?.fullName ||
            "",

          teachingAssignment:
            teacher
              ?.teachingAssignment ||
            {
              classes: [],
              subjects: [],
              languages: [],
            },
        },

        students,

        count:
          students.length,

        assignedCount:
          students.filter(
            (student) =>
              student.alreadyAssigned,
          ).length,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "GET ELIGIBLE DIGITAL STUDENTS ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to load Digital Students.",
      },
      {
        status: 500,
      },
    );
  }
}