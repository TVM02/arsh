import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ATTENDANCE_COLLECTION =
  "digitalClassAttendance";

const ALLOWED_STATUSES = new Set([
  "present",
  "absent",
  "late",
]);

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

function getStudentClass(student) {
  return (
    student?.assignedDigitalTeacherClass ||
    student?.applyingclass ||
    student?.className ||
    student?.class ||
    student?.currentClass ||
    student?.classLevel ||
    ""
  );
}

/* ============================================
   VERIFY LOGGED-IN DIGITAL TEACHER
============================================ */

async function verifyDigitalTeacher(
  request,
  auth,
  db,
  teacherUid,
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

  const token = authorization
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

    if (!decoded?.uid) {
      return null;
    }

    /*
     * Teacher may only save
     * attendance for himself.
     */
    if (
      cleanText(decoded.uid) !==
      cleanText(teacherUid)
    ) {
      return null;
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
      userSnapshot.data() || {};

    const isDigitalTeacher =
      userData?.role === "teacher" &&
      userData?.digitalTeacher ===
        true &&
      userData?.digitalClassAccess ===
        true &&
      (
        !userData
          ?.digitalTeacherStatus ||
        userData
          ?.digitalTeacherStatus ===
          "active"
      );

    if (!isDigitalTeacher) {
      return null;
    }

    return {
      uid: decoded.uid,
      userData,
    };
  } catch (error) {
    console.error(
      "VERIFY ATTENDANCE TEACHER ERROR:",
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
    const routeParams =
      await params;

    const teacherUid =
      cleanText(
        routeParams?.teacherUid ||
        routeParams?.id
      );

    if (!teacherUid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher UID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const auth =
      getAdminAuth();

    const db =
      getAdminDb();

    /* =========================================
       VERIFY DIGITAL TEACHER
    ========================================= */

    const teacher =
      await verifyDigitalTeacher(
        request,
        auth,
        db,
        teacherUid
      );

    if (!teacher?.uid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized Digital Teacher.",
        },
        {
          status: 401,
        }
      );
    }

    /* =========================================
       GET QUERY PARAMS
    ========================================= */

    const { searchParams } =
      new URL(request.url);

    const date =
      cleanText(
        searchParams.get("date")
      );

    const className =
      cleanText(
        searchParams.get(
          "className"
        )
      );

    if (!date) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Attendance date is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!className) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Class is required.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       LOAD SAVED ATTENDANCE
    ========================================= */

    const snapshot =
      await db
        .collection(
          ATTENDANCE_COLLECTION
        )
        .where(
          "teacherUid",
          "==",
          teacherUid
        )
        .where(
          "date",
          "==",
          date
        )
        .get();

    const records =
      snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter(
          (record) =>
            normalizeClass(
              record?.className
            ) ===
            normalizeClass(
              className
            )
        );

    /* =========================================
       EASY LOOKUP BY STUDENT UID
    ========================================= */

    const attendanceByStudent =
      {};

    records.forEach(
      (record) => {
        if (
          record?.studentId
        ) {
          attendanceByStudent[
            record.studentId
          ] = {
            id:
              record.id,

            status:
              record.status,

            date:
              record.date,

            className:
              record.className,

            studentId:
              record.studentId,

            studentName:
              record.studentName,

            admissionNumber:
              record.admissionNumber,
          };
        }
      }
    );

    return NextResponse.json(
      {
        success: true,

        teacherUid,

        date,

        className,

        count:
          records.length,

        records,

        attendanceByStudent,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "LOAD DIGITAL CLASS ATTENDANCE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to load attendance.",
      },
      {
        status: 500,
      }
    );
  }
}



export async function POST(
  request,
  { params },
) {
  try {
   const routeParams =
  await params;

const teacherUid =
  cleanText(
    routeParams?.teacherUid ||
    routeParams?.id
  );

    if (!teacherUid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher UID is required.",
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

    /* =========================================
       AUTHENTICATION
    ========================================= */

    const teacher =
      await verifyDigitalTeacher(
        request,
        auth,
        db,
        teacherUid,
      );

    if (!teacher?.uid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized Digital Teacher.",
        },
        {
          status: 401,
        },
      );
    }

    /* =========================================
       REQUEST BODY
    ========================================= */

    let body = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    const date =
      cleanText(body?.date);

    const className =
      cleanText(
        body?.className,
      );

    const attendance =
      Array.isArray(
        body?.attendance,
      )
        ? body.attendance
        : [];

    /* =========================================
       VALIDATE DATE
    ========================================= */

    if (!date) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Attendance date is required.",
        },
        {
          status: 400,
        },
      );
    }

    const validDate =
      /^\d{4}-\d{2}-\d{2}$/.test(
        date,
      );

    if (!validDate) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid attendance date.",
        },
        {
          status: 400,
        },
      );
    }

    /* =========================================
       VALIDATE CLASS
    ========================================= */

    if (!className) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Class is required.",
        },
        {
          status: 400,
        },
      );
    }

    /* =========================================
       VALIDATE RECORDS
    ========================================= */

    if (
      attendance.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Attendance records are required.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Firestore batch limit is 500.
     * Keep a safe limit here.
     */
    if (
      attendance.length > 450
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Too many attendance records in one request.",
        },
        {
          status: 400,
        },
      );
    }

    /* =========================================
       CLEAN + VALIDATE ATTENDANCE
    ========================================= */

    const cleanAttendance = [];

    const seenStudentIds =
      new Set();

    for (
      const item
      of attendance
    ) {
      const studentId =
        cleanText(
          item?.studentId,
        );

      const status =
        cleanText(
          item?.status,
        ).toLowerCase();

      if (!studentId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Student UID is missing from attendance.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        seenStudentIds.has(
          studentId,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Duplicate student found in attendance.",
          },
          {
            status: 400,
          },
        );
      }

      seenStudentIds.add(
        studentId,
      );

      if (
        !ALLOWED_STATUSES.has(
          status,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Invalid attendance status for ${studentId}.`,
          },
          {
            status: 400,
          },
        );
      }

      cleanAttendance.push({
        studentId,
        status,

        studentName:
          cleanText(
            item?.studentName,
          ),

        admissionNumber:
          cleanText(
            item?.admissionNumber ||
              item?.admissionNo,
          ),
      });
    }

    /* =========================================
       VERIFY EVERY STUDENT

       users/{studentUid} is the assignment
       source of truth.
    ========================================= */

    const verifiedStudents = [];

    for (
      const record
      of cleanAttendance
    ) {
      const studentSnapshot =
        await db
          .collection("users")
          .doc(record.studentId)
          .get();

      if (
        !studentSnapshot.exists
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `Student account not found: ${record.studentId}`,
          },
          {
            status: 404,
          },
        );
      }

      const student =
        studentSnapshot.data() ||
        {};

      /* Must be Digital Student */

      if (
        student?.role !==
          "student" ||
        student?.userType !==
          "digital_student"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid Digital Student in attendance.",
          },
          {
            status: 400,
          },
        );
      }

      /* Must be assigned */

      if (
        student
          ?.teacherAssigned !==
        true
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `${student?.name || "Student"} is not assigned to a Digital Teacher.`,
          },
          {
            status: 403,
          },
        );
      }

      /* Must belong to this teacher */

      if (
        cleanText(
          student
            ?.assignedDigitalTeacherUid,
        ) !==
        cleanText(
          teacherUid,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `${student?.name || "Student"} is not assigned to this Digital Teacher.`,
          },
          {
            status: 403,
          },
        );
      }

      /* Must belong to selected class */

      const studentClass =
        cleanText(
          getStudentClass(
            student,
          ),
        );

      if (
        normalizeClass(
          studentClass,
        ) !==
        normalizeClass(
          className,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `${student?.name || "Student"} does not belong to the selected class.`,
          },
          {
            status: 400,
          },
        );
      }

      verifiedStudents.push({
        ...record,

        studentName:
          cleanText(
            student?.name ||
              student?.fullName ||
              student
                ?.studentName ||
              record
                .studentName,
          ),

        admissionNumber:
          cleanText(
            student
              ?.digitalAdmissionNumber ||
              student
                ?.admissionNumber ||
              record
                .admissionNumber,
          ),

        className:
          studentClass,
      });
    }

   
/* =========================================
   PREVENT DUPLICATE ATTENDANCE

   One student can be marked only once
   per teacher per date.
========================================= */

for (
  const student
  of verifiedStudents
) {
  const attendanceId =
    `${teacherUid}_${date}_${student.studentId}`;

  const attendanceRef =
    db
      .collection(
        ATTENDANCE_COLLECTION
      )
      .doc(attendanceId);

  const existingAttendance =
    await attendanceRef.get();

  if (
    existingAttendance.exists
  ) {
    return NextResponse.json(
      {
        success: false,

        message:
          `${student.studentName || "Student"} attendance is already marked for today.`,

        alreadyMarked: true,

        studentId:
          student.studentId,

        attendance:
          existingAttendance.data(),
      },
      {
        status: 409,
      }
    );
  }
}

    const batch =
      db.batch();

    for (
      const student
      of verifiedStudents
    ) {
      const attendanceId =
        `${teacherUid}_${date}_${student.studentId}`;

      const attendanceRef =
        db
          .collection(
            ATTENDANCE_COLLECTION,
          )
          .doc(
            attendanceId,
          );

      batch.set(
        attendanceRef,
        {
          teacherUid:
            teacherUid,

          teacherName:
            cleanText(
              teacher.userData
                ?.name ||
                teacher.userData
                  ?.fullName ||
                teacher.userData
                  ?.teacherName,
            ) || null,

          teacherEmail:
            cleanText(
              teacher.userData
                ?.email,
            ) || null,

          studentId:
            student.studentId,

          studentName:
            student.studentName ||
            null,

          admissionNumber:
            student.admissionNumber ||
            null,

          className:
            student.className ||
            className,

          date,

          status:
            student.status,

          attendanceType:
            "digital_class",

          updatedAt:
            FieldValue.serverTimestamp(),

          updatedBy:
            teacherUid,
        },
        {
          merge: true,
        },
      );
    }

    await batch.commit();

    /* =========================================
       SUMMARY
    ========================================= */

    const presentCount =
      verifiedStudents.filter(
        (student) =>
          student.status ===
          "present",
      ).length;

    const absentCount =
      verifiedStudents.filter(
        (student) =>
          student.status ===
          "absent",
      ).length;

    const lateCount =
      verifiedStudents.filter(
        (student) =>
          student.status ===
          "late",
      ).length;

    /* =========================================
       SUCCESS
    ========================================= */

    return NextResponse.json(
      {
        success: true,

        message:
          "Attendance saved successfully.",

        date,

        className,

        teacherUid,

        total:
          verifiedStudents.length,

        presentCount,

        absentCount,

        lateCount,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "SAVE DIGITAL CLASS ATTENDANCE ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to save attendance.",
      },
      {
        status: 500,
      },
    );
  }
}