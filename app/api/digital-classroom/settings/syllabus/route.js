
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION = "digitalClassSyllabusSettings";

const CLASS_OPTIONS = [
  "UKG",
  ...Array.from(
    { length: 12 },
    (_, index) => `Class ${index + 1}`
  ),
];

function getClassId(className) {
  return className.toLowerCase().replace(/\s+/g, "-");
}

function errorResponse(message, status) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

async function verifyCentralAdmin(request) {
  const authorization =
    request.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return {
      error: "Authentication token is required.",
      status: 401,
    };
  }

  try {
    const token = authorization.slice(7).trim();

    const decoded = await getAdminAuth().verifyIdToken(
      token
    );

    let role = decoded.role;

    if (!role) {
      const userSnapshot = await getAdminDb()
        .collection("users")
        .doc(decoded.uid)
        .get();

      role = userSnapshot.data()?.role;
    }

    if (
      role !== "central_admin" &&
      role !== "admin"
    ) {
      return {
        error: "Central Admin access is required.",
        status: 403,
      };
    }

    return { uid: decoded.uid };
  } catch (error) {
    console.error("SYLLABUS AUTH ERROR:", error);

    return {
      error: "Invalid or expired authentication token.",
      status: 401,
    };
  }
}

/* ============================================
   GET ALL CLASS SUBJECT SETTINGS
============================================ */

export async function GET(request) {
  const admin = await verifyCentralAdmin(request);

  if (admin.error) {
    return errorResponse(admin.error, admin.status);
  }

  try {
    const snapshot = await getAdminDb()
      .collection(COLLECTION)
      .get();

    const settings = {};

    for (const doc of snapshot.docs) {
      const data = doc.data();

      if (!CLASS_OPTIONS.includes(data.className)) {
        continue;
      }

      settings[data.className] = Array.isArray(
        data.subjects
      )
        ? data.subjects
        : [];
    }

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("LOAD SYLLABUS ERROR:", error);

    return errorResponse(
      "Unable to load syllabus settings.",
      500
    );
  }
}

/* ============================================
   SAVE CLASS SUBJECT SETTINGS
============================================ */

export async function POST(request) {
  const admin = await verifyCentralAdmin(request);

  if (admin.error) {
    return errorResponse(admin.error, admin.status);
  }

  try {
    const body = await request.json();

    const { className, subjects } = body;

    if (!CLASS_OPTIONS.includes(className)) {
      return errorResponse("Invalid class selected.", 400);
    }

    if (!Array.isArray(subjects)) {
      return errorResponse(
        "Subjects must be an array.",
        400
      );
    }

    if (
      subjects.some(
        (subject) =>
          typeof subject !== "string" ||
          !subject.trim() ||
          subject.trim().length > 150
      )
    ) {
      return errorResponse(
        "Invalid subject name.",
        400
      );
    }

    const cleanSubjects = [];
    const seen = new Set();

    for (const subject of subjects) {
      const clean = subject.trim();
      const key = clean.toLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        cleanSubjects.push(clean);
      }
    }

    if (cleanSubjects.length > 100) {
      return errorResponse(
        "Too many subjects selected.",
        400
      );
    }

    const documentId = getClassId(className);

    await getAdminDb()
      .collection(COLLECTION)
      .doc(documentId)
      .set(
        {
          className,
          subjects: cleanSubjects,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: admin.uid,
        },
        { merge: true }
      );

    return NextResponse.json({
      success: true,
      message: "Syllabus settings saved successfully.",
      className,
      subjects: cleanSubjects,
    });
  } catch (error) {
    console.error("SAVE SYLLABUS ERROR:", error);

    if (error instanceof SyntaxError) {
      return errorResponse("Invalid JSON body.", 400);
    }

    return errorResponse(
      "Unable to save syllabus settings.",
      500
    );
  }
}
