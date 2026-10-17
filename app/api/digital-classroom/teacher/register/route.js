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
   VERIFY LOGGED-IN TEACHER
============================================ */

async function verifyTeacher(
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

    if (!decodedToken?.uid) {
      return null;
    }

    /*
      Get actual Firebase Auth account.
      UID + email come from Firebase,
      not from browser form.
    */
    const firebaseUser =
      await auth.getUser(
        decodedToken.uid,
      );

    /*
      Existing normal Teacher profile
    */
    const userRef =
      db
        .collection("users")
        .doc(decodedToken.uid);

    const userSnapshot =
      await userRef.get();

    const userData =
      userSnapshot.exists
        ? userSnapshot.data()
        : null;

    const role =
      userData?.role ||
      decodedToken?.role ||
      firebaseUser
        ?.customClaims
        ?.role ||
      null;

    if (
      role !== "teacher"
    ) {
      return null;
    }

    return {
      uid:
        decodedToken.uid,

      email:
        cleanEmail(
          firebaseUser?.email ||
            userData?.email,
        ),

      firebaseUser,

      userData:
        userData || {},
    };
  } catch (error) {
    console.error(
      "VERIFY DIGITAL TEACHER REGISTRATION ERROR:",
      error,
    );

    return null;
  }
}

/* ============================================
   POST
   DIGITAL TEACHER REGISTRATION
============================================ */

export async function POST(
  request,
) {
  try {
    const auth =
      getAdminAuth();

    const db =
      getAdminDb();

    /* ========================================
       VERIFY EXISTING TEACHER LOGIN
    ======================================== */

    const teacherAccount =
      await verifyTeacher(
        request,
        auth,
        db,
      );

    if (!teacherAccount?.uid) {
      return errorResponse(
        "Unauthorized. Please login with your Teacher account.",
        401,
      );
    }

    const body =
      await request.json();

    const teacherUid =
      teacherAccount.uid;

    const teacherEmail =
      teacherAccount.email;

    const userData =
      teacherAccount.userData ||
      {};

    if (!teacherEmail) {
      return errorResponse(
        "Teacher account email was not found.",
        400,
      );
    }

    /* ========================================
       CHECK EXISTING APPLICATION
    ======================================== */

    const existingSnapshot =
      await db
        .collection(COLLECTION)
        .where(
          "sourceTeacherUid",
          "==",
          teacherUid,
        )
        .limit(1)
        .get();

    if (
      !existingSnapshot.empty
    ) {
      const existingDoc =
        existingSnapshot.docs[0];

      const existing =
        existingDoc.data();

      if (
        existing?.status ===
        "pending"
      ) {
        return NextResponse.json(
          {
            success: true,

            message:
              "Your Digital Teacher application is already pending.",

            status:
              "pending",

            applicationId:
              existingDoc.id,
          },
          {
            status: 200,
          },
        );
      }

      if (
        existing?.status ===
        "approved"
      ) {
        return NextResponse.json(
          {
            success: true,

            message:
              "Your Digital Teacher application is already approved.",

            status:
              "approved",

            applicationId:
              existingDoc.id,
          },
          {
            status: 200,
          },
        );
      }
    }

    /* ========================================
       PROFILE IMAGE

       Uploaded to Firebase Storage
       before this API call.
    ======================================== */

    const profilePicture =
      cleanText(
        body?.profilePicture,
      ) || null;

    /*
      If profile photo must be mandatory,
      keep this validation.

      If photo is optional,
      remove this block.
    */
/* ========================================
   NORMALIZE QUALIFICATION DATA
======================================== */

const qualificationBody =
  body?.qualification &&
  typeof body.qualification === "object"
    ? body.qualification
    : {};

const generalEducation =
  qualificationBody?.generalEducation &&
  typeof qualificationBody.generalEducation ===
    "object"
    ? qualificationBody.generalEducation
    : {};

const computerKnowledge =
  qualificationBody?.computerKnowledge &&
  typeof qualificationBody.computerKnowledge ===
    "object"
    ? qualificationBody.computerKnowledge
    : {};

const islamicEducation =
  qualificationBody?.islamicEducation &&
  typeof qualificationBody.islamicEducation ===
    "object"
    ? qualificationBody.islamicEducation
    : {};


/* ========================================
   QURAN QUALIFICATION

   Supports:
   quranQualification      = correct
   QuranQualification      = old field
======================================== */

const quranQualification =
  cleanText(
    islamicEducation?.quranQualification ||
    islamicEducation?.QuranQualification
  ) || null;


/* ========================================
   CERTIFICATE URL

   Certificate is uploaded to Firebase
   Storage by frontend before API call.
======================================== */

const certificateUrl =
  cleanText(
    body?.certificateUrl ||
    qualificationBody?.certificateUrl
  ) || null;

    if (!profilePicture) {
      return errorResponse(
        "Please upload your Digital Teacher profile photo.",
        400,
      );
    }



    const applicationData = {

      sourceTeacherUid:
        teacherUid,

      sourceTeacherId:
        body?.sourceTeacherId ||
        userData?.teacherId ||
        userData?.id ||
        null,

      /*
        Digital Teacher uses
        SAME Firebase Auth account.
      */
      digitalTeacherUid:
        teacherUid,

      /*
        Existing Teacher email.
      */
      email:
        teacherEmail,

      digitalTeacherEmail:
        teacherEmail,

      /* ======================================
         PERSONAL INFORMATION
      ====================================== */

      fullName:
        cleanText(
          body?.fullName ||
            userData?.fullName ||
            userData?.name ||
            teacherAccount
              ?.firebaseUser
              ?.displayName,
        ),

      mhrId:
        cleanText(
          body?.mhrId ||
            userData?.mhrId ||
            userData?.teacherId,
        ) || null,

      phone:
        cleanText(
          body?.phone ||
            userData?.phone,
        ) || null,

      gender:
        cleanText(
          body?.gender ||
            userData?.gender,
        ) || null,

      dateOfBirth:
        cleanText(
          body?.dateOfBirth ||
            userData?.dateOfBirth,
        ) || null,

      address:
        cleanText(
          body?.address ||
            userData?.address,
        ) || null,

      madarsaName:
        cleanText(
          body?.madarsaName ||
            userData?.madarsaName ||
            userData?.madarsaId ||
            userData
              ?.institutionName,
        ) || null,

      /*
        New Digital Teacher
        registration profile image
      */
      profilePicture,

      /* ======================================
         QUALIFICATION
      ====================================== */

     qualification: {
  generalEducation: {
    highestQualification:
      cleanText(
        generalEducation?.highestQualification
      ) || null,

    courseName:
      cleanText(
        generalEducation?.courseName
      ) || null,

    institution:
      cleanText(
        generalEducation?.institution
      ) || null,
  },

  computerKnowledge: {
    level:
      cleanText(
        computerKnowledge?.level
      ) || null,

    otherDetails:
      cleanText(
        computerKnowledge?.otherDetails
      ) || null,
  },

  islamicEducation: {
    highestQualification:
      cleanText(
        islamicEducation?.highestQualification
      ) || null,

    courseName:
      cleanText(
        islamicEducation?.courseName
      ) || null,

    institution:
      cleanText(
        islamicEducation?.institution
      ) || null,

    yearOfPassing:
      cleanText(
        islamicEducation?.yearOfPassing
      ) || null,

    teachingExperience:
      cleanText(
        islamicEducation?.teachingExperience
      ) || null,

    quranQualification:
      quranQualification,
  },

  certificateUrl:
    certificateUrl,
},


bankDetails:
  body?.bankDetails &&
  typeof body.bankDetails ===
    "object"
    ? body.bankDetails
    : {},


certificateUrl:
  certificateUrl,

      /* ======================================
         APPLICATION STATUS
      ====================================== */

      status:
        "pending",

      /*
        Not active until
        Central Admin approves.
      */
      accountStatus:
        "pending",

      digitalClassAccess:
        false,

      /*
        Central Admin assigns these
        during approval.
      */
      teachingAssignment: {
        classes: [],
        subjects: [],
        languages: [],
      },

      /* ======================================
         APPROVAL
      ====================================== */

      approval: {
        centralAdmin: {
          status:
            "pending",

          approvedBy:
            null,

          approvedAt:
            null,

          rejectedAt:
            null,

          rejectionReason:
            null,
        },
      },

      createdAt:
        new Date(),

      updatedAt:
        new Date(),
    };

    /* ========================================
       REJECTED APPLICATION -> REAPPLY
    ======================================== */

    if (
      !existingSnapshot.empty
    ) {
      const existingDoc =
        existingSnapshot.docs[0];

      const existing =
        existingDoc.data();

      if (
        existing?.status ===
        "rejected"
      ) {
        await existingDoc.ref.set(
          {
            ...applicationData,

            createdAt:
              existing?.createdAt ||
              new Date(),

            updatedAt:
              new Date(),
          },
          {
            merge: true,
          },
        );

        return NextResponse.json({
          success: true,

          message:
            "Digital Teacher application resubmitted successfully.",

          status:
            "pending",

          applicationId:
            existingDoc.id,

          digitalTeacherUid:
            teacherUid,

          digitalTeacherEmail:
            teacherEmail,
        });
      }
    }

    /* ========================================
       CREATE APPLICATION
    ======================================== */

    const applicationRef =
      db
        .collection(COLLECTION)
        .doc();

    await applicationRef.set(
      applicationData,
    );

    /* ========================================
       SUCCESS
    ======================================== */

    return NextResponse.json(
      {
        success: true,

        message:
          "Digital Teacher application submitted successfully.",

        status:
          "pending",

        applicationId:
          applicationRef.id,

        /*
          Same existing Firebase account
        */
        digitalTeacherUid:
          teacherUid,

        digitalTeacherEmail:
          teacherEmail,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "DIGITAL TEACHER REGISTRATION ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to submit Digital Teacher application.",
      },
      {
        status: 500,
      },
    );
  }
}