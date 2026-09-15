import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
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
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

/* ============================================
   POST
   DIGITAL TEACHER REGISTRATION
============================================ */

export async function POST(request) {
  try {
    const db = getAdminDb();

    const body = await request.json();

    console.log(
      "DIGITAL TEACHER REGISTER BODY:",
      JSON.stringify(body, null, 2),
    );

    const {
      sourceTeacherId,
      sourceTeacherUid,

      fullName,
      mhrId,
      email,
      phone,
      gender,
      dateOfBirth,
      address,
      madarsaName,
      profilePicture,

      qualification,
      bankDetails,

      certificateUrl,
    } = body;

    /* ============================================
       TEACHER VALIDATION
    ============================================ */

    if (!sourceTeacherUid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Teacher UID is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!cleanText(fullName)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Teacher name is required.",
        },
        {
          status: 400,
        },
      );
    }

    /* ============================================
       GENERAL EDUCATION
    ============================================ */

    const generalEducation =
      qualification?.generalEducation;

    if (
      !cleanText(
        generalEducation?.highestQualification,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "General Education highest qualification is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !cleanText(
        generalEducation?.courseName,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "General Education course name is required.",
        },
        {
          status: 400,
        },
      );
    }

    /* ============================================
       COMPUTER KNOWLEDGE
    ============================================ */

    const computerKnowledge =
      qualification?.computerKnowledge;

    if (
      !cleanText(
        computerKnowledge?.level,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Computer Knowledge level is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      computerKnowledge?.level === "other" &&
      !cleanText(
        computerKnowledge?.otherDetails,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please specify your other computer skills.",
        },
        {
          status: 400,
        },
      );
    }

    /* ============================================
       ISLAMIC / ARABIC EDUCATION
    ============================================ */

    const islamicEducation =
  qualification?.islamicEducation;

if (
  !cleanText(
    islamicEducation?.highestQualification,
  )
) {
  return NextResponse.json(
    {
      success: false,
      message:
        "Islamic Academic Qualification is required.",
    },
    {
      status: 400,
    },
  );
}

if (
  islamicEducation?.highestQualification ===
    "degree" &&
  !cleanText(
    islamicEducation?.courseName,
  )
) {
  return NextResponse.json(
    {
      success: false,
      message:
        "Islamic Degree Course Name is required.",
    },
    {
      status: 400,
    },
  );
}

if (
  !cleanText(
    islamicEducation?.yearOfPassing,
  )
) {
  return NextResponse.json(
    {
      success: false,
      message:
        "Islamic qualification year of passing is required.",
    },
    {
      status: 400,
    },
  );
}

if (
  !cleanText(
    islamicEducation?.teachingExperience,
  )
) {
  return NextResponse.json(
    {
      success: false,
      message:
        "Teaching Experience is required.",
    },
    {
      status: 400,
    },
  );
}

if (
  !cleanText(
    islamicEducation?.quranQualification,
  )
) {
  return NextResponse.json(
    {
      success: false,
      message:
        "Quran Qualification is required.",
    },
    {
      status: 400,
    },
  );
}

    /* ============================================
       BANK VALIDATION
    ============================================ */

    if (
      !cleanText(
        bankDetails?.accountHolderName,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Account holder name is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !cleanText(
        bankDetails?.bankName,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bank name is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !cleanText(
        bankDetails?.accountNumber,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bank account number is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !cleanText(
        bankDetails?.ifscCode,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "IFSC code is required.",
        },
        {
          status: 400,
        },
      );
    }

    /* ============================================
       CHECK EXISTING APPLICATION
    ============================================ */

    const existingSnapshot =
      await db
        .collection(COLLECTION)
        .where(
          "sourceTeacherUid",
          "==",
          sourceTeacherUid,
        )
        .get();

    if (!existingSnapshot.empty) {
      const existingApplications =
        existingSnapshot.docs.map(
          (doc) => ({
            id: doc.id,
            ...doc.data(),
          }),
        );

      const pendingApplication =
        existingApplications.find(
          (item) =>
            item.status === "pending",
        );

      if (pendingApplication) {
        return NextResponse.json(
          {
            success: false,

            message:
              "You already have a pending Digital Teacher application.",

            applicationId:
              pendingApplication.id,

            status: "pending",
          },
          {
            status: 409,
          },
        );
      }

      const approvedApplication =
        existingApplications.find(
          (item) =>
            item.status === "approved",
        );

      if (approvedApplication) {
        return NextResponse.json(
          {
            success: false,

            message:
              "Your Digital Teacher application is already approved.",

            applicationId:
              approvedApplication.id,

            status: "approved",
          },
          {
            status: 409,
          },
        );
      }
    }

    /* ============================================
       NORMALIZE
    ============================================ */

    const cleanEmail =
      cleanText(email).toLowerCase();

    const cleanPhone =
      cleanText(phone);

    const cleanAccountNumber =
      cleanText(
        bankDetails.accountNumber,
      );

    const cleanIfsc =
      cleanText(
        bankDetails.ifscCode,
      ).toUpperCase();

    /* ============================================
       REGISTRATION DATA
    ============================================ */

    const registrationData = {
      /* Existing teacher reference */

      sourceTeacherId:
        sourceTeacherId || null,

      sourceTeacherUid,

      /* Personal */

      fullName:
        cleanText(fullName),

      mhrId:
        cleanText(mhrId) || null,

      email:
        cleanEmail || null,

      phone:
        cleanPhone || null,

      gender:
        cleanText(gender) || null,

      dateOfBirth:
        cleanText(dateOfBirth) ||
        null,

      address:
        cleanText(address) || null,

      madarsaName:
        cleanText(madarsaName) ||
        null,

      profilePicture:
        cleanText(profilePicture) ||
        null,

      /* ========================================
         QUALIFICATION
      ======================================== */

      qualification: {
        /* General Education */

        generalEducation: {
          highestQualification:
            cleanText(
              generalEducation
                .highestQualification,
            ),

          courseName:
            cleanText(
              generalEducation
                .courseName,
            ),

          institution:
            cleanText(
              generalEducation
                .institution,
            ) || null,
        },

        /* Computer Knowledge */

        computerKnowledge: {
          level:
            cleanText(
              computerKnowledge.level,
            ),

          otherDetails:
            computerKnowledge.level ===
            "other"
              ? cleanText(
                  computerKnowledge
                    .otherDetails,
                )
              : null,
        },

        /* Islamic / Arabic */

        islamicEducation: {
          highestQualification:
            cleanText(
              islamicEducation
                .highestQualification,
            ),

          courseName:
            cleanText(
              islamicEducation
                .courseName,
            ),

          institution:
            cleanText(
              islamicEducation
                .institution,
            ),

          yearOfPassing:
            cleanText(
              islamicEducation
                .yearOfPassing,
            ),

          teachingExperience:
            cleanText(
              islamicEducation
                .teachingExperience,
            ),
        },

        /* Step 4 upload */

        certificateUrl:
          cleanText(
            certificateUrl ||
              qualification
                ?.certificateUrl,
          ) || null,
      },

      /* ========================================
         BANK DETAILS
      ======================================== */

      bankDetails: {
        accountHolderName:
          cleanText(
            bankDetails
              .accountHolderName,
          ),

        bankName:
          cleanText(
            bankDetails.bankName,
          ),

        accountNumber:
          cleanAccountNumber,

        ifscCode:
          cleanIfsc,

        branchName:
          cleanText(
            bankDetails.branchName,
          ) || null,

        upiId:
          cleanText(
            bankDetails.upiId,
          ) || null,
      },

      /* ========================================
         APPLICATION STATUS
      ======================================== */

      status: "pending",

      accountStatus: null,

      digitalClassAccess: false,

      /* Approval creates these */

      digitalTeacherUid: null,

      digitalTeacherEmail: null,

      /*
        NO teachingAssignment here.

        Central Admin will later set:
        classes
        subjects
        languages
      */

      approval: {
        centralAdmin: {
          status: "pending",

          approvedBy: null,
          approvedAt: null,

          rejectedAt: null,
          rejectionReason: null,
        },
      },

      createdAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    };

    /* ============================================
       SAVE
    ============================================ */

    const docRef =
      await db
        .collection(COLLECTION)
        .add(registrationData);

    return NextResponse.json(
      {
        success: true,

        message:
          "Digital Teacher application submitted successfully.",

        applicationId:
          docRef.id,

        status: "pending",
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "DIGITAL TEACHER REGISTER ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Digital Teacher registration failed.",
      },
      {
        status: 500,
      },
    );
  }
}