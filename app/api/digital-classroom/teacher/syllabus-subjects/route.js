
import { NextResponse } from "next/server";
import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const token = authorization.slice(7).trim();

    const decoded = await getAdminAuth()
      .verifyIdToken(token);

    const db = getAdminDb();

    const userSnapshot = await db
      .collection("users")
      .doc(decoded.uid)
      .get();

    const teacher = userSnapshot.data();

    if (
      !teacher ||
      teacher.role !== "teacher" ||
      teacher.digitalTeacher !== true ||
      teacher.digitalClassAccess !== true ||
      (teacher.digitalTeacherStatus &&
        teacher.digitalTeacherStatus !== "active") ||
      teacher.accountStatus === "inactive"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Digital Teacher access denied.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const className = searchParams.get("className");

    if (!className) {
      return NextResponse.json(
        {
          success: false,
          message: "Class name is required.",
        },
        { status: 400 }
      );
    }

    const assignment =
      teacher.digitalTeachingAssignment || {};

    const assignedClasses = Array.isArray(
      assignment.classes
    )
      ? assignment.classes
      : [];

    if (!assignedClasses.includes(className)) {
      return NextResponse.json(
        {
          success: false,
          message: "This class is not assigned to you.",
        },
        { status: 403 }
      );
    }

    const classId = className
      .toLowerCase()
      .replace(/\s+/g, "-");

    const syllabusSnapshot = await db
      .collection("digitalClassSyllabusSettings")
      .doc(classId)
      .get();

    const syllabus = syllabusSnapshot.data();

    if (
      !syllabusSnapshot.exists ||
      syllabus?.className !== className
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Class syllabus not configured.",
        },
        { status: 404 }
      );
    }

    const teacherSubjects = new Set(
      (Array.isArray(assignment.subjects)
        ? assignment.subjects
        : []
      )
        .filter((s) => typeof s === "string")
        .map((s) => s.trim().toLowerCase())
    );

    const subjects = [
      ...new Map(
        (Array.isArray(syllabus.subjects)
          ? syllabus.subjects
          : []
        )
          .filter(
            (s) =>
              typeof s === "string" &&
              s.trim() &&
              teacherSubjects.has(
                s.trim().toLowerCase()
              )
          )
          .map((s) => {
            const clean = s.trim();
            return [clean.toLowerCase(), clean];
          })
      ).values(),
    ];

    return NextResponse.json({
      success: true,
      className,
      subjects,
    });
  } catch (error) {
    console.error(
      "TEACHER SYLLABUS SUBJECTS ERROR:",
      error
    );

    if (
      error?.code?.startsWith?.("auth/") ||
      error?.code === "auth/id-token-expired"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid or expired session.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load class subjects.",
      },
      { status: 500 }
    );
  }
}
