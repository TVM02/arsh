import { NextResponse } from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION =
  "digitalClassTeacherRegistrations";

/* ============================================
   SERIALIZE FIRESTORE VALUES
============================================ */

function serialize(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (
    value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serialize);
  }

  if (
    typeof value === "object"
  ) {
    const result = {};

    for (const [key, child] of Object.entries(
      value,
    )) {
      result[key] = serialize(child);
    }

    return result;
  }

  return value;
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
    !authorization.startsWith("Bearer ")
  ) {
    return null;
  }

  const idToken =
    authorization.slice(7).trim();

  if (!idToken) {
    return null;
  }

  try {
    const decodedToken =
      await auth.verifyIdToken(idToken);

    if (
      decodedToken?.role ===
        "central_admin" ||
      decodedToken?.role === "admin"
    ) {
      return decodedToken;
    }

    const userSnapshot =
      await db
        .collection("users")
        .doc(decodedToken.uid)
        .get();

    if (!userSnapshot.exists) {
      return null;
    }

    const userData =
      userSnapshot.data();

    if (
      userData?.role !==
        "central_admin" &&
      userData?.role !== "admin"
    ) {
      return null;
    }

    return decodedToken;
  } catch (error) {
    console.error(
      "VERIFY CENTRAL ADMIN ERROR:",
      error,
    );

    return null;
  }
}

/* ============================================
   GET DIGITAL TEACHER APPLICATIONS
============================================ */

export async function GET(request) {
  try {
 

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
            "Unauthorized. Central Admin access required.",
        },
        {
          status: 401,
        },
      );
    }

    const snapshot =
      await db
        .collection(COLLECTION)
        .orderBy(
          "createdAt",
          "desc",
        )
        .get();

    const teachers =
  await Promise.all(
    snapshot.docs.map(
      async (doc) => {
        const teacherData =
          doc.data();
const teacherUid =
  teacherData.digitalTeacherUid ||
  teacherData.uid ||
  teacherData.userId;

        let googleAuth = null;

        if (teacherUid) {
          const userSnapshot =
            await db
              .collection("users")
              .doc(teacherUid)
              .get();

          if (userSnapshot.exists) {
            googleAuth =
              userSnapshot.data()?.googleAuth ||
              null;
          }
        }

        return {
          id: doc.id,
          ...serialize(
            teacherData,
          ),
          googleAuth: serialize(
            googleAuth,
          ),
        };
      },
    ),
  );
    return NextResponse.json(
      {
        success: true,
        teachers,
        count:
          teachers.length,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "GET DIGITAL TEACHERS ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to load Digital Teacher applications.",
      },
      {
        status: 500,
      },
    );
  }
}