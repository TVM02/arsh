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

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(
    object,
    key,
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

    /* ========================================
       VERIFY ADMIN
    ======================================== */

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

    /* ========================================
       REQUEST BODY
    ======================================== */

    const body =
      await request.json();

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid update data.",
        },
        {
          status: 400,
        },
      );
    }

    /* ========================================
       LOAD APPLICATION
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

    /* ========================================
       FIREBASE USER
    ======================================== */

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

    /* ========================================
       UPDATE OBJECTS

       Only fields sent from frontend
       will be updated.
    ======================================== */

    const registrationUpdate = {};

    const userUpdate = {};

    const authUpdate = {};

    let passwordUpdated = false;

    /* ========================================
       EMAIL - OPTIONAL
    ======================================== */

    const digitalTeacherEmailWasSent =
  hasOwn(
    body,
    "digitalTeacherEmail",
  );

if (digitalTeacherEmailWasSent) {
  const email =
    cleanEmail(
      body.digitalTeacherEmail,
    );

      if (!email) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Digital Teacher email cannot be empty.",
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
          "Please enter a valid Digital Teacher email.",
      },
      {
        status: 400,
      },
    );
  }

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
              "This Digital Teacher email is already used by another Firebase account.",
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

    authUpdate.email =
      email;
  }

  registrationUpdate.digitalTeacherEmail =
    email;

  userUpdate.email =
    email;
}

    /* ========================================
       PASSWORD - OPTIONAL

       Firebase Auth only.
       Never save password in Firestore.
    ======================================== */

    if (
      hasOwn(body, "password")
    ) {
      const password =
        cleanText(
          body.password,
        );

      /*
        Empty password means:
        keep existing password.
      */

      if (password) {
        if (
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

        authUpdate.password =
          password;

        passwordUpdated =
          true;
      }
    }

    /* ========================================
       NORMAL EDITABLE FIELDS
    ======================================== */

    const editableFields = [
      "fullName",
      "name",
      "phone",
      "gender",
      "dateOfBirth",
      "address",
      "madarsaName",
      "profilePicture",
      "mhrId",
      "qualification",
      "bankDetails",
      "accountStatus",
      "digitalClassAccess",
    ];

    for (
      const field
      of editableFields
    ) {
      if (
        hasOwn(body, field)
      ) {
        registrationUpdate[field] =
          body[field];

        userUpdate[field] =
          body[field];
      }
    }

    /* ========================================
       FULL NAME -> FIREBASE DISPLAY NAME
    ======================================== */

    if (
      hasOwn(body, "fullName") ||
      hasOwn(body, "name")
    ) {
      const displayName =
        cleanText(
          body?.fullName ??
            body?.name,
        );

      if (displayName) {
        authUpdate.displayName =
          displayName;
      }
    }

    /* ========================================
       TEACHING ASSIGNMENT - OPTIONAL
    ======================================== */

    const teachingAssignmentWasSent =
      hasOwn(
        body,
        "teachingAssignment",
      ) ||
      hasOwn(
        body,
        "assignedClasses",
      ) ||
      hasOwn(
        body,
        "assignedSubjects",
      ) ||
      hasOwn(
        body,
        "languages",
      );

    if (
      teachingAssignmentWasSent
    ) {
      const currentAssignment =
        teacher
          ?.teachingAssignment || {
          classes: [],
          subjects: [],
          languages: [],
        };

      const incoming =
        body
          ?.teachingAssignment ||
        {};

      const classesWasSent =
        hasOwn(
          incoming,
          "classes",
        ) ||
        hasOwn(
          body,
          "assignedClasses",
        );

      const subjectsWasSent =
        hasOwn(
          incoming,
          "subjects",
        ) ||
        hasOwn(
          body,
          "assignedSubjects",
        );

      const languagesWasSent =
        hasOwn(
          incoming,
          "languages",
        ) ||
        hasOwn(
          body,
          "languages",
        );

      const teachingAssignment = {
        classes:
          classesWasSent
            ? cleanArray(
                incoming?.classes ??
                  body?.assignedClasses,
              )
            : cleanArray(
                currentAssignment
                  ?.classes,
              ),

        subjects:
          subjectsWasSent
            ? cleanArray(
                incoming?.subjects ??
                  body?.assignedSubjects,
              )
            : cleanArray(
                currentAssignment
                  ?.subjects,
              ),

        languages:
          languagesWasSent
            ? cleanArray(
                incoming?.languages ??
                  body?.languages,
              )
            : cleanArray(
                currentAssignment
                  ?.languages,
              ),
      };

      /*
        IMPORTANT:
        No minimum class / subject /
        language validation here.

        Empty array is allowed.
      */

      registrationUpdate.teachingAssignment =
        teachingAssignment;

      userUpdate.teachingAssignment =
        teachingAssignment;
    }

    /* ========================================
       NOTHING TO UPDATE
    ======================================== */

    const hasFirestoreUpdate =
      Object.keys(
        registrationUpdate,
      ).length > 0;

    const hasAuthUpdate =
      Object.keys(
        authUpdate,
      ).length > 0;

    if (
      !hasFirestoreUpdate &&
      !hasAuthUpdate
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No editable data was provided.",
        },
        {
          status: 400,
        },
      );
    }

    /* ========================================
       UPDATE FIREBASE AUTH
    ======================================== */

    let updatedFirebaseUser =
      firebaseUser;

    if (hasAuthUpdate) {
      updatedFirebaseUser =
        await auth.updateUser(
          digitalTeacherUid,
          authUpdate,
        );
    }

    /* ========================================
       COMMON UPDATE DATA
    ======================================== */

    const now =
      new Date();

    registrationUpdate.updatedAt =
      now;

    registrationUpdate.updatedBy =
      admin.uid;

    userUpdate.updatedAt =
      now;

    userUpdate.updatedBy =
      admin.uid;

    /* ========================================
       UPDATE FIRESTORE
    ======================================== */

    const userRef =
      db
        .collection("users")
        .doc(
          digitalTeacherUid,
        );

    await db.runTransaction(
      async (transaction) => {
        transaction.set(
          registrationRef,
          registrationUpdate,
          {
            merge: true,
          },
        );

        transaction.set(
          userRef,
          userUpdate,
          {
            merge: true,
          },
        );
      },
    );

    /* ========================================
       SUCCESS
    ======================================== */

    return NextResponse.json({
      success: true,

      message:
        passwordUpdated
          ? "Digital Teacher details and password updated successfully."
          : "Digital Teacher updated successfully.",

      teacher: {
        applicationId:
          id,

        digitalTeacherUid,

        digitalTeacherEmail:
          updatedFirebaseUser
            ?.email ||
          teacher
            ?.digitalTeacherEmail ||
          null,

        passwordUpdated,

        updatedFields:
          Object.keys(
            registrationUpdate,
          ).filter(
            (field) =>
              field !==
                "updatedAt" &&
              field !==
                "updatedBy",
          ),
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