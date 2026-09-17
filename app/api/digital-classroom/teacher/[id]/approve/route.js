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
   HELPERS
============================================ */

function cleanText(value) {
  return String(value ?? "").trim();
}

function cleanArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) =>
          cleanText(item),
        )
        .filter(Boolean),
    ),
  ];
}

function errorResponse(
  message,
  status = 400,
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    },
  );
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

  const idToken =
    authorization
      .slice(7)
      .trim();

  if (!idToken) {
    return null;
  }

  try {
    const decodedToken =
      await auth.verifyIdToken(
        idToken,
      );

    const claimRole =
      decodedToken?.role;

    if (
      claimRole ===
        "central_admin" ||
      claimRole === "admin"
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
      userData?.role !==
        "admin"
    ) {
      return null;
    }

    return decodedToken;
  } catch (error) {
    console.error(
      "CENTRAL ADMIN VERIFY ERROR:",
      error,
    );

    return null;
  }
}

/* ============================================
   PATCH
   APPROVE DIGITAL TEACHER
============================================ */

export async function PATCH(
  request,
  { params },
) {
  try {
    const { id } =
      await params;

    if (!id) {
      return errorResponse(
        "Digital Teacher application ID is required.",
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
      return errorResponse(
        "Unauthorized. Central Admin access required.",
        401,
      );
    }

    /* ========================================
       REQUEST BODY

       NO EMAIL
       NO PASSWORD
    ======================================== */

    const body =
      await request.json();

    const assignedClasses =
      cleanArray(
        body?.assignedClasses,
      );

    const assignedSubjects =
      cleanArray(
        body?.assignedSubjects,
      );

    const languages =
      cleanArray(
        body?.languages,
      );

    /* ========================================
       ASSIGNMENT VALIDATION
    ======================================== */

    if (
      assignedClasses.length === 0
    ) {
      return errorResponse(
        "Please assign at least one class.",
      );
    }

    if (
      assignedSubjects.length ===
      0
    ) {
      return errorResponse(
        "Please assign at least one subject.",
      );
    }

    if (
      languages.length === 0
    ) {
      return errorResponse(
        "Please select at least one teaching medium.",
      );
    }

    /* ========================================
       LOAD REGISTRATION
    ======================================== */

    const registrationRef =
      db
        .collection(COLLECTION)
        .doc(id);

    const registrationSnapshot =
      await registrationRef.get();

    if (
      !registrationSnapshot.exists
    ) {
      return errorResponse(
        "Digital Teacher application not found.",
        404,
      );
    }

    const teacher =
      registrationSnapshot.data();

    /* ========================================
       APPLICATION STATUS
    ======================================== */

    if (
      teacher?.status ===
      "approved"
    ) {
      return errorResponse(
        "This Digital Teacher application is already approved.",
        409,
      );
    }

    if (
      teacher?.status ===
      "rejected"
    ) {
      return errorResponse(
        "Rejected application cannot be approved directly.",
        409,
      );
    }

    if (
      teacher?.status !==
      "pending"
    ) {
      return errorResponse(
        "Only pending Digital Teacher applications can be approved.",
        409,
      );
    }

    /* ========================================
       EXISTING TEACHER FIREBASE UID
    ======================================== */

    const teacherUid =
      cleanText(
        teacher?.sourceTeacherUid ||
          teacher?.digitalTeacherUid,
      );

    if (!teacherUid) {
      return errorResponse(
        "Existing Teacher Firebase UID was not found.",
        400,
      );
    }

    /*
      IMPORTANT:

      We do NOT create another Firebase user.

      Normal Teacher UID
             =
      Digital Teacher UID
    */

    let firebaseUser;

    try {
      firebaseUser =
        await auth.getUser(
          teacherUid,
        );
    } catch (error) {
      if (
        error?.code ===
        "auth/user-not-found"
      ) {
        return errorResponse(
          "Existing Teacher Firebase account was not found.",
          404,
        );
      }

      throw error;
    }

    /* ========================================
       VERIFY EXISTING USER DOCUMENT
    ======================================== */

    const userRef =
      db
        .collection("users")
        .doc(teacherUid);

    const userSnapshot =
      await userRef.get();

    if (!userSnapshot.exists) {
      return errorResponse(
        "Teacher user profile was not found.",
        404,
      );
    }

    const existingUser =
      userSnapshot.data();

    /*
      Keep normal Teacher role.
    */

    if (
      existingUser?.role !==
      "teacher"
    ) {
      return errorResponse(
        "This account is not a Teacher account.",
        400,
      );
    }

    /* ========================================
       EXISTING LOGIN EMAIL
    ======================================== */

    const teacherEmail =
      cleanText(
        firebaseUser?.email ||
          teacher?.email ||
          existingUser?.email,
      ).toLowerCase();

    if (!teacherEmail) {
      return errorResponse(
        "Teacher login email was not found.",
        400,
      );
    }

    /* ========================================
       TEACHING ASSIGNMENT
    ======================================== */

    const teachingAssignment = {
      classes:
        assignedClasses,

      subjects:
        assignedSubjects,

      languages,
    };

    const now =
      new Date();

    /* ========================================
       FIRESTORE TRANSACTION
    ======================================== */

    await db.runTransaction(
      async (transaction) => {
        const latestSnapshot =
          await transaction.get(
            registrationRef,
          );

        if (
          !latestSnapshot.exists
        ) {
          throw new Error(
            "Digital Teacher application no longer exists.",
          );
        }

        const latest =
          latestSnapshot.data();

        if (
          latest?.status !==
          "pending"
        ) {
          throw new Error(
            "Only pending Digital Teacher applications can be approved.",
          );
        }

        /* ====================================
           UPDATE EXISTING NORMAL TEACHER USER

           DO NOT CHANGE:
           role: "teacher"
        ==================================== */

        transaction.set(
          userRef,
          {
            /*
              Digital Teacher access
            */
            digitalTeacher:
              true,

            digitalClassAccess:
              true,

            digitalTeacherStatus:
              "active",

            digitalTeacherApplicationId:
              id,

            /*
              Keep Digital Teacher assignment
              separate from normal Teacher data.
            */
            digitalTeachingAssignment:
              teachingAssignment,

            /*
              Digital Teacher registration
              can have a separate profile photo.
            */
            digitalTeacherProfilePicture:
              teacher?.profilePicture ||
              null,

            digitalTeacherApprovedAt:
              now,

            digitalTeacherApprovedBy:
              admin.uid,

            updatedAt:
              now,
          },
          {
            merge: true,
          },
        );

        /* ====================================
           UPDATE DIGITAL TEACHER APPLICATION
        ==================================== */

        transaction.update(
          registrationRef,
          {
            status:
              "approved",

            accountStatus:
              "active",

            digitalClassAccess:
              true,

            /*
              SAME existing Teacher UID
            */
            digitalTeacherUid:
              teacherUid,

            /*
              SAME existing Teacher email
            */
            digitalTeacherEmail:
              teacherEmail,

            teachingAssignment,

            "approval.centralAdmin.status":
              "approved",

            "approval.centralAdmin.approvedBy":
              admin.uid,

            "approval.centralAdmin.approvedAt":
              now,

            "approval.centralAdmin.rejectedAt":
              null,

            "approval.centralAdmin.rejectionReason":
              null,

            updatedAt:
              now,
          },
        );
      },
    );

    /* ========================================
       SUCCESS
    ======================================== */

    return NextResponse.json(
      {
        success: true,

        message:
          "Digital Teacher approved successfully.",

        teacher: {
          applicationId:
            id,

          sourceTeacherUid:
            teacherUid,

          digitalTeacherUid:
            teacherUid,

          digitalTeacherEmail:
            teacherEmail,

          /*
            Normal role stays teacher.
          */
          role:
            "teacher",

          digitalTeacher:
            true,

          accountStatus:
            "active",

          digitalClassAccess:
            true,

          teachingAssignment,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "DIGITAL TEACHER APPROVE ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to approve Digital Teacher.",
      },
      {
        status: 500,
      },
    );
  }
}

/* ============================================
   TEST GET
============================================ */

export async function GET(
  request,
  { params },
) {
  const { id } =
    await params;

  return NextResponse.json({
    success: true,
    message:
      "Digital Teacher Approve API is working",
    id,
  });
}