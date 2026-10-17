
import { NextResponse } from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================
   FIRESTORE COLLECTIONS
============================================ */

const COLLECTION =
  "digitalClassTeacherRegistrations";

const SYLLABUS_COLLECTION =
  "digitalClassSyllabusSettings";

const CLASS_OPTIONS = [
  "LKG",
  "UKG",
  ...Array.from(
    { length: 12 },
    (_, index) => `Class ${index + 1}`
  ),
];

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
        .map((item) => cleanText(item))
        .filter(Boolean)
    ),
  ];
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(
    object,
    key
  );
}

function getClassDocumentId(className) {
  return className
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function apiError(message, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

/* ============================================
   VERIFY CENTRAL ADMIN
============================================ */

async function verifyCentralAdmin(
  request,
  auth,
  db
) {
  const authorization =
    request.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authorization
    .slice(7)
    .trim();

  if (!idToken) {
    return null;
  }

  try {
    const decodedToken =
      await auth.verifyIdToken(idToken);

    if (
      decodedToken?.role === "central_admin" ||
      decodedToken?.role === "admin"
    ) {
      return decodedToken;
    }

    const userSnapshot = await db
      .collection("users")
      .doc(decodedToken.uid)
      .get();

    if (!userSnapshot.exists) {
      return null;
    }

    const userData = userSnapshot.data();

    if (
      userData?.role !== "central_admin" &&
      userData?.role !== "admin"
    ) {
      return null;
    }

    return decodedToken;
  } catch (error) {
    console.error(
      "VERIFY CENTRAL ADMIN ERROR:",
      error
    );

    return null;
  }
}

/* ============================================
   LOAD SUBJECTS BY ASSIGNED CLASSES
============================================ */

async function resolveClassSubjects(
  db,
  assignedClasses
) {
  const syllabusCollection = db.collection(
    SYLLABUS_COLLECTION
  );

  const snapshots = await Promise.all(
    assignedClasses.map((className) => {
      const documentId =
        getClassDocumentId(className);

      return syllabusCollection
        .doc(documentId)
        .get();
    })
  );

  const subjectMap = new Map();
  const missingClasses = [];

  assignedClasses.forEach((className, index) => {
    const snapshot = snapshots[index];

    if (!snapshot.exists) {
      missingClasses.push(className);
      return;
    }

    const syllabusData = snapshot.data();

    const classSubjects =
      syllabusData?.subjects;

    if (
      syllabusData?.className !== className ||
      !Array.isArray(classSubjects) ||
      classSubjects.length === 0
    ) {
      missingClasses.push(className);
      return;
    }

    for (const subject of classSubjects) {
      if (typeof subject !== "string") {
        continue;
      }

      const cleanSubject = subject.trim();

      if (!cleanSubject) {
        continue;
      }

      const subjectKey =
        cleanSubject.toLowerCase();

      if (!subjectMap.has(subjectKey)) {
        subjectMap.set(
          subjectKey,
          cleanSubject
        );
      }
    }

    const hasValidSubject =
      classSubjects.some(
        (subject) =>
          typeof subject === "string" &&
          subject.trim().length > 0
      );

    if (!hasValidSubject) {
      missingClasses.push(className);
    }
  });

  return {
    subjects: [...subjectMap.values()],
    missingClasses,
  };
}

/* ============================================
   PATCH DIGITAL TEACHER
============================================ */

export async function PATCH(
  request,
  { params }
) {
  try {
    const { id } = await params;

    if (!id) {
      return apiError(
        "Digital Teacher application ID is required."
      );
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    /* ========================================
       VERIFY CENTRAL ADMIN
    ======================================== */

    const admin =
      await verifyCentralAdmin(
        request,
        auth,
        db
      );

    if (!admin?.uid) {
      return apiError(
        "Unauthorized. Central Admin access required.",
        401
      );
    }

    /* ========================================
       REQUEST BODY
    ======================================== */

    let body;

    try {
      body = await request.json();
    } catch {
      return apiError(
        "Invalid JSON request body.",
        400
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return apiError(
        "Invalid update data.",
        400
      );
    }

    /* ========================================
       LOAD DIGITAL TEACHER APPLICATION
    ======================================== */

    const registrationRef = db
      .collection(COLLECTION)
      .doc(id);

    const registrationSnapshot =
      await registrationRef.get();

    if (!registrationSnapshot.exists) {
      return apiError(
        "Digital Teacher application not found.",
        404
      );
    }

    const teacher =
      registrationSnapshot.data();

    if (teacher?.status !== "approved") {
      return apiError(
        "Only approved Digital Teachers can be edited.",
        409
      );
    }

    /* ========================================
       EXISTING FIREBASE TEACHER UID
    ======================================== */

    const digitalTeacherUid =
      teacher?.digitalTeacherUid;

    if (!digitalTeacherUid) {
      return apiError(
        "Digital Teacher Firebase UID not found.",
        400
      );
    }

    /* ========================================
       VERIFY EXISTING FIREBASE AUTH USER
    ======================================== */

    let firebaseUser;

    try {
      firebaseUser = await auth.getUser(
        digitalTeacherUid
      );
    } catch {
      return apiError(
        "Digital Teacher Firebase account not found.",
        404
      );
    }

    /* ========================================
       UPDATE OBJECTS
    ======================================== */

    const registrationUpdate = {};
    const userUpdate = {};
    const authUpdate = {};

    let passwordUpdated = false;

    /* ========================================
       EMAIL UPDATE - OPTIONAL
    ======================================== */

    if (
      hasOwn(body, "digitalTeacherEmail")
    ) {
      const email = cleanEmail(
        body.digitalTeacherEmail
      );

      if (!email) {
        return apiError(
          "Digital Teacher email cannot be empty."
        );
      }

      if (!email.includes("@")) {
        return apiError(
          "Please enter a valid Digital Teacher email."
        );
      }

      if (email !== firebaseUser.email) {
        try {
          const existing =
            await auth.getUserByEmail(email);

          if (
            existing?.uid !==
            digitalTeacherUid
          ) {
            return apiError(
              "This Digital Teacher email is already used by another Firebase account.",
              409
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

        authUpdate.email = email;
      }

      registrationUpdate.digitalTeacherEmail =
        email;

      userUpdate.email = email;
    }

    /* ========================================
       PASSWORD UPDATE - OPTIONAL

       PASSWORD SAVED ONLY IN FIREBASE AUTH
    ======================================== */

    if (hasOwn(body, "password")) {
      const password = cleanText(
        body.password
      );

      if (password) {
        if (password.length < 6) {
          return apiError(
            "Password must be at least 6 characters."
          );
        }

        authUpdate.password = password;
        passwordUpdated = true;
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

    for (const field of editableFields) {
      if (hasOwn(body, field)) {
        registrationUpdate[field] =
          body[field];

        userUpdate[field] =
          body[field];
      }
    }

    /* ========================================
       ACCOUNT INACTIVATION
    ======================================== */

    const previousStatus = cleanText(
      teacher?.accountStatus
    ).toLowerCase();

    const nextStatus = hasOwn(
      body,
      "accountStatus"
    )
      ? cleanText(
          body.accountStatus
        ).toLowerCase()
      : previousStatus;

    const becomingInactive =
      nextStatus === "inactive" &&
      previousStatus !== "inactive";

    if (nextStatus === "inactive") {
      registrationUpdate.digitalClassAccess =
        false;

      userUpdate.digitalClassAccess =
        false;

      if (becomingInactive) {
        const reason = cleanText(
          body.inactiveReason
        );

        if (!reason) {
          return apiError(
            "Please provide a reason for inactivating this teacher."
          );
        }

        const inactivationData = {
          inactiveReason: reason,
          inactivatedAt: new Date(),
          inactivatedBy: admin.uid,
        };

        Object.assign(
          registrationUpdate,
          inactivationData
        );

        Object.assign(
          userUpdate,
          inactivationData
        );
      }
    }

    /* ========================================
       FULL NAME -> FIREBASE DISPLAY NAME
    ======================================== */

    if (
      hasOwn(body, "fullName") ||
      hasOwn(body, "name")
    ) {
      const displayName = cleanText(
        body?.fullName ?? body?.name
      );

      if (displayName) {
        authUpdate.displayName =
          displayName;
      }
    }

    /* ========================================
       TEACHING ASSIGNMENT
    ======================================== */

    const teachingAssignmentWasSent =
      hasOwn(
        body,
        "teachingAssignment"
      ) ||
      hasOwn(
        body,
        "assignedClasses"
      ) ||
      hasOwn(
        body,
        "assignedSubjects"
      ) ||
      hasOwn(
        body,
        "languages"
      );

    if (teachingAssignmentWasSent) {
      /* ====================================
         CURRENT ASSIGNMENT
      ==================================== */

      const currentAssignment =
        teacher?.teachingAssignment ||
        teacher?.digitalTeachingAssignment ||
        {
          classes: [],
          subjects: [],
          languages: [],
        };

      const incoming =
        body.teachingAssignment &&
        typeof body.teachingAssignment ===
          "object" &&
        !Array.isArray(
          body.teachingAssignment
        )
          ? body.teachingAssignment
          : {};

      /* ====================================
         RESOLVE ASSIGNED CLASSES
      ==================================== */

      const classesSource = hasOwn(
        body,
        "assignedClasses"
      )
        ? body.assignedClasses
        : hasOwn(incoming, "classes")
          ? incoming.classes
          : currentAssignment.classes;

      if (!Array.isArray(classesSource)) {
        return apiError(
          "Assigned classes must be an array."
        );
      }

      const assignedClasses =
        cleanArray(classesSource);

      /* ====================================
         VALIDATE CLASSES
      ==================================== */

      const invalidClasses =
        assignedClasses.filter(
          (className) =>
            !CLASS_OPTIONS.includes(
              className
            )
        );

      if (invalidClasses.length > 0) {
        return apiError(
          `Invalid classes: ${invalidClasses.join(", ")}`
        );
      }

      /* ====================================
         RESOLVE TEACHING LANGUAGES
      ==================================== */

      const languagesSource = hasOwn(
        body,
        "languages"
      )
        ? body.languages
        : hasOwn(incoming, "languages")
          ? incoming.languages
          : currentAssignment.languages;

      if (!Array.isArray(languagesSource)) {
        return apiError(
          "Teaching languages must be an array."
        );
      }

      const languages =
        cleanArray(languagesSource);

      /* ====================================
         GET SUBJECTS FROM SYLLABUS SETTINGS

         FRONTEND SUBJECTS ARE NOT TRUSTED
      ==================================== */

      const {
        subjects: assignedSubjects,
        missingClasses,
      } = await resolveClassSubjects(
        db,
        assignedClasses
      );

      /* ====================================
         VALIDATE CONFIGURED SUBJECTS
      ==================================== */

      if (missingClasses.length > 0) {
        return apiError(
          "Please configure Syllabus Settings for: " +
            missingClasses.join(", "),
          409
        );
      }

      if (
        assignedClasses.length > 0 &&
        assignedSubjects.length === 0
      ) {
        return apiError(
          "No valid subjects found for selected classes.",
          409
        );
      }

      /* ====================================
         BUILD ASSIGNMENT OBJECT
      ==================================== */

      const teachingAssignment = {
        classes: assignedClasses,
        subjects: assignedSubjects,
        languages,
      };

      /* ====================================
         REGISTRATION DOCUMENT
      ==================================== */

      registrationUpdate.teachingAssignment =
        teachingAssignment;

      /* ====================================
         CANONICAL USER DOCUMENT
      ==================================== */

      userUpdate.digitalTeachingAssignment =
        teachingAssignment;

      /* ====================================
         KEEP EXISTING COMPATIBILITY FIELD
      ==================================== */

      userUpdate.teachingAssignment =
        teachingAssignment;

      console.log(
        "DIGITAL TEACHER ASSIGNMENT UPDATED:",
        {
          teacherUid: digitalTeacherUid,
          classes: assignedClasses,
          subjects: assignedSubjects,
          languages,
        }
      );
    }

    /* ========================================
       CHECK IF ANY DATA NEEDS UPDATING
    ======================================== */

    const hasFirestoreUpdate =
      Object.keys(
        registrationUpdate
      ).length > 0;

    const hasAuthUpdate =
      Object.keys(
        authUpdate
      ).length > 0;

    if (
      !hasFirestoreUpdate &&
      !hasAuthUpdate
    ) {
      return apiError(
        "No editable data was provided."
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
          authUpdate
        );
    }

    /* ========================================
       COMMON UPDATE DATA
    ======================================== */

    const now = new Date();

    registrationUpdate.updatedAt =
      now;

    registrationUpdate.updatedBy =
      admin.uid;

    userUpdate.updatedAt =
      now;

    userUpdate.updatedBy =
      admin.uid;

    /* ========================================
       UPDATE BOTH FIRESTORE DOCUMENTS
    ======================================== */

    const userRef = db
      .collection("users")
      .doc(digitalTeacherUid);

    await db.runTransaction(
      async (transaction) => {
        transaction.set(
          registrationRef,
          registrationUpdate,
          { merge: true }
        );

        transaction.set(
          userRef,
          userUpdate,
          { merge: true }
        );
      }
    );

    /* ========================================
       SUCCESS RESPONSE
    ======================================== */

    return NextResponse.json({
      success: true,

      message: passwordUpdated
        ? "Digital Teacher details and password updated successfully."
        : "Digital Teacher updated successfully.",

      teacher: {
        applicationId: id,
        digitalTeacherUid,

        digitalTeacherEmail:
          updatedFirebaseUser?.email ||
          teacher?.digitalTeacherEmail ||
          null,

        passwordUpdated,

        updatedFields: Object.keys(
          registrationUpdate
        ).filter(
          (field) =>
            field !== "updatedAt" &&
            field !== "updatedBy"
        ),
      },
    });
  } catch (error) {
    console.error(
      "UPDATE DIGITAL TEACHER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Failed to update Digital Teacher.",
      },
      { status: 500 }
    );
  }
}
