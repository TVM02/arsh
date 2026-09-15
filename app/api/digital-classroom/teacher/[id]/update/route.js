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

    if (
      decodedToken?.role ===
        "central_admin" ||
      decodedToken?.role ===
        "admin"
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
      "VERIFY CENTRAL ADMIN ERROR:",
      error,
    );

    return null;
  }
}

/* ============================================
   PATCH DIGITAL TEACHER
============================================ */

export async function PATCH(
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
            "Digital Teacher application ID is required.",
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

    /* ============================================
       ADMIN AUTH
    ============================================ */

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

    /* ============================================
       BODY
    ============================================ */

    const body =
      await request.json();

    const email =
      cleanEmail(
        body?.email,
      );

    const password =
      cleanText(
        body?.password,
      );

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
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher email is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please enter a valid email.",
        },
        {
          status: 400,
        },
      );
    }

    /*
      Empty password means:
      keep current password.
    */

    if (
      password &&
      password.length < 6
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password must be at least 6 characters.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      assignedClasses.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please assign at least one class.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      assignedSubjects.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please assign at least one subject.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      languages.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please select at least one teaching language.",
        },
        {
          status: 400,
        },
      );
    }

    /* ============================================
       LOAD APPLICATION
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
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher application not found.",
        },
        {
          status: 404,
        },
      );
    }

    const teacher =
      registrationSnapshot.data();

    if (
      teacher?.status !==
      "approved"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only approved Digital Teachers can be edited.",
        },
        {
          status: 409,
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

    /* ============================================
       GET CURRENT FIREBASE USER
    ============================================ */

    let firebaseUser;

    try {
      firebaseUser =
        await auth.getUser(
          digitalTeacherUid,
        );
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher Firebase account not found.",
        },
        {
          status: 404,
        },
      );
    }

    /* ============================================
       CHECK EMAIL DUPLICATE
    ============================================ */

    if (
      email !==
      firebaseUser.email
    ) {
      try {
        const existing =
          await auth.getUserByEmail(
            email,
          );

        if (
          existing?.uid !==
          digitalTeacherUid
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "This email is already used by another Firebase account.",
            },
            {
              status: 409,
            },
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
    }

    /* ============================================
       UPDATE FIREBASE AUTH
    ============================================ */

    const authUpdate = {
      email,

      displayName:
        teacher?.fullName ||
        firebaseUser.displayName ||
        "Digital Teacher",

      emailVerified: true,

      disabled: false,
    };

    /*
      Only update password
      when admin entered a new password.
    */

    if (password) {
      authUpdate.password =
        password;
    }

    const updatedFirebaseUser =
      await auth.updateUser(
        digitalTeacherUid,
        authUpdate,
      );

    /* ============================================
       ENSURE ROLE CLAIM
    ============================================ */

    await auth.setCustomUserClaims(
      digitalTeacherUid,
      {
        ...(
          firebaseUser
            ?.customClaims || {}
        ),

        role:
          "digital-teacher",
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
       UPDATE FIRESTORE
    ============================================ */

    const userRef =
      db
        .collection("users")
        .doc(
          digitalTeacherUid,
        );

    await db.runTransaction(
      async (transaction) => {
        transaction.set(
          userRef,
          {
            email,

            role:
              "digital-teacher",

            accountStatus:
              "active",

            digitalClassAccess:
              true,

            teachingAssignment,

            updatedAt:
              new Date(),

            updatedBy:
              admin.uid,
          },
          {
            merge: true,
          },
        );

        transaction.update(
          registrationRef,
          {
            digitalTeacherEmail:
              email,

            teachingAssignment,

            accountStatus:
              "active",

            digitalClassAccess:
              true,

            updatedAt:
              new Date(),

            updatedBy:
              admin.uid,
          },
        );
      },
    );

    /* ============================================
       SUCCESS
    ============================================ */

    return NextResponse.json({
      success: true,

      message:
        password
          ? "Digital Teacher details and password updated successfully."
          : "Digital Teacher details updated successfully.",

      teacher: {
        applicationId:
          id,

        digitalTeacherUid,

        digitalTeacherEmail:
          updatedFirebaseUser.email,

        accountStatus:
          "active",

        digitalClassAccess:
          true,

        passwordUpdated:
          Boolean(password),

        teachingAssignment,
      },
    });
  } catch (error) {
    console.error(
      "UPDATE DIGITAL TEACHER ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to update Digital Teacher.",
      },
      {
        status: 500,
      },
    );
  }
}