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

function cleanEmail(value) {
  return cleanText(value).toLowerCase();
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
   CENTRAL ADMIN AUTH CHECK
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
      claimRole === "central_admin" ||
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
      userData?.role !== "admin"
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
    console.log(
    "========== DIGITAL TEACHER PATCH HIT ==========",
  );

  console.log(
    "METHOD:",
    request.method,
  );

  console.log(
    "URL:",
    request.url,
  );

  console.log(
    "AUTH HEADER:",
    request.headers.get("authorization")
      ? "PRESENT"
      : "MISSING",
  );
  let createdAuthUid = null;

  try {
    const { id } = await params;

    if (!id) {
      return errorResponse(
        "Digital Teacher application ID is required.",
      );
    }

    const auth =
      getAdminAuth();

    const db =
      getAdminDb();

    /* ============================================
       VERIFY CENTRAL ADMIN
    ============================================ */

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

    /* ============================================
       BODY
    ============================================ */

    const body =
      await request.json();

    const email =
      cleanEmail(body?.email);

    const password =
      cleanText(body?.password);

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

    /* ============================================
       VALIDATION
    ============================================ */

    if (!email) {
      return errorResponse(
        "Digital Teacher email is required.",
      );
    }

    if (
      !email.includes("@")
    ) {
      return errorResponse(
        "Please enter a valid Digital Teacher email.",
      );
    }

    if (
      password.length < 6
    ) {
      return errorResponse(
        "Password must be at least 6 characters.",
      );
    }

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

    /* ============================================
       LOAD REGISTRATION
    ============================================ */

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

    /* ============================================
       APPLICATION STATUS CHECK
    ============================================ */

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

    /* ============================================
       CHECK DIGITAL LOGIN EMAIL
    ============================================ */

    try {
      const existingUser =
        await auth.getUserByEmail(
          email,
        );

      if (existingUser) {
        return errorResponse(
          "This Digital Teacher email is already registered in Firebase Authentication.",
          409,
        );
      }
    } catch (error) {
      if (
        error?.code !==
        "auth/user-not-found"
      ) {
        throw error;
      }
    }

    /* ============================================
       CREATE SEPARATE DIGITAL TEACHER
       FIREBASE AUTH ACCOUNT
    ============================================ */

    const digitalTeacherUser =
      await auth.createUser({
        email,
        password,

        displayName:
          teacher?.fullName ||
          "Digital Teacher",

        emailVerified: true,

        disabled: false,
      });

    createdAuthUid =
      digitalTeacherUser.uid;

    /* ============================================
       SET DIGITAL TEACHER CLAIM
    ============================================ */

    await auth.setCustomUserClaims(
      digitalTeacherUser.uid,
      {
        role: "digital-teacher",
      },
    );

    /* ============================================
       TEACHING ASSIGNMENT
    ============================================ */

    const teachingAssignment = {
      classes:
        assignedClasses,

      subjects:
        assignedSubjects,

      languages,
    };

    /* ============================================
       FIRESTORE TRANSACTION
    ============================================ */

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

        const latestTeacher =
          latestSnapshot.data();

        if (
          latestTeacher?.status !==
          "pending"
        ) {
          throw new Error(
            "Digital Teacher application is no longer pending.",
          );
        }

        const userRef =
          db
            .collection("users")
            .doc(
              digitalTeacherUser.uid,
            );

        /* ========================================
           CREATE DIGITAL TEACHER USER PROFILE
        ======================================== */

        transaction.set(
          userRef,
          {
            uid:
              digitalTeacherUser.uid,

            email,

            fullName:
              latestTeacher
                ?.fullName ||
              "Digital Teacher",

            name:
              latestTeacher
                ?.fullName ||
              "Digital Teacher",

            role:
              "digital-teacher",

            /* Link back to normal teacher */

            sourceTeacherId:
              latestTeacher
                ?.sourceTeacherId ||
              null,

            sourceTeacherUid:
              latestTeacher
                ?.sourceTeacherUid ||
              null,

            mhrId:
              latestTeacher
                ?.mhrId ||
              null,

            phone:
              latestTeacher
                ?.phone ||
              null,

            madarsaName:
              latestTeacher
                ?.madarsaName ||
              null,

            profilePicture:
              latestTeacher
                ?.profilePicture ||
              null,

            /* Access */

            status: "active",

            accountStatus:
              "active",

            digitalClassAccess:
              true,

            /* Assignment */

            teachingAssignment,

            createdAt:
              new Date(),

            updatedAt:
              new Date(),
          },
          {
            merge: true,
          },
        );

        /* ========================================
           UPDATE APPLICATION
        ======================================== */

        transaction.update(
          registrationRef,
          {
            status:
              "approved",

            accountStatus:
              "active",

            digitalClassAccess:
              true,

            digitalTeacherUid:
              digitalTeacherUser.uid,

            digitalTeacherEmail:
              email,

            teachingAssignment,

            "approval.centralAdmin.status":
              "approved",

            "approval.centralAdmin.approvedBy":
              admin.uid,

            "approval.centralAdmin.approvedAt":
              new Date(),

            "approval.centralAdmin.rejectedAt":
              null,

            "approval.centralAdmin.rejectionReason":
              null,

            updatedAt:
              new Date(),
          },
        );
      },
    );

    /* ============================================
       SUCCESS
    ============================================ */

    return NextResponse.json(
      {
        success: true,

        message:
          "Digital Teacher approved successfully.",

        teacher: {
          applicationId:
            id,

          digitalTeacherUid:
            digitalTeacherUser.uid,

          digitalTeacherEmail:
            email,

          role:
            "digital-teacher",

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

    /*
      If Firebase Authentication account was created
      but Firestore approval failed, remove that new
      account so we don't leave an orphan user.
    */

    if (createdAuthUid) {
      try {
        const auth =
          getAdminAuth();

        await auth.deleteUser(
          createdAuthUid,
        );

        console.log(
          "ROLLED BACK DIGITAL TEACHER AUTH USER:",
          createdAuthUid,
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "DIGITAL TEACHER AUTH ROLLBACK ERROR:",
          rollbackError,
        );
      }
    }

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
export async function GET(
  request,
  { params },
) {
  const { id } = await params;

  return NextResponse.json({
    success: true,
    message: "Digital Teacher Approve API is working",
    id,
  });
}