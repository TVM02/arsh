
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

import {
  generateDigitalAdmissionNumber,
} from "@/lib/digitalClassAdmissionNumber";

/* ============================================
   DIGITAL STUDENT REGISTRATION
============================================ */

export async function POST(request) {
  try {
    /* ========================================
       1. REQUEST BODY
    ======================================== */

    const body = await request.json();

    const {
      studentId,
      uid,
      admissionNumber,

      fullName,
      studentName,

      dateOfBirth,
      gender,
      email,
      phone,
      address,

      applyingclass,

      // NEW: MENTOR TYPE
      mentor,

      hasOldRegistration,
      oldRegistrationNumber,

      previousmadarsa,

      guardianName,
      guardianPhone,

      profilePicture,
      profilePictureUrl,
    } = body;

    /* ========================================
       2. NORMALIZE FIELDS
    ======================================== */

    const finalStudentName =
      studentName || fullName || null;

    const finalApplyingClass =
      applyingclass || null;

    const finalPreviousMadarsa =
      previousmadarsa || null;

    const finalProfilePicture =
      profilePicture ||
      profilePictureUrl ||
      null;

    /* ========================================
       NORMALIZE MENTOR
    ======================================== */

    const finalMentor = String(
      mentor || ""
    )
      .trim()
      .toLowerCase();

    /* ========================================
       3. VALIDATION
    ======================================== */

    if (!finalStudentName) {
      return NextResponse.json(
        {
          success: false,
          message: "Student name is required",
        },
        { status: 400 }
      );
    }

    if (!dateOfBirth) {
      return NextResponse.json(
        {
          success: false,
          message: "Date of birth is required",
        },
        { status: 400 }
      );
    }

    if (!finalApplyingClass) {
      return NextResponse.json(
        {
          success: false,
          message: "Applying class is required",
        },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          message: "Phone number is required",
        },
        { status: 400 }
      );
    }

    /* ========================================
       VALIDATE MENTOR TYPE
    ======================================== */

    const allowedMentors = [
      "ustad",
      "teacher",
    ];

    if (
      !allowedMentors.includes(
        finalMentor
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please select Ustad or Teacher.",
        },
        { status: 400 }
      );
    }

    /* ========================================
       4. FIREBASE DATABASE
    ======================================== */

    const db = getAdminDb();

    /* ========================================
       5. OPTIONAL DUPLICATE CHECK
    ======================================== */

    if (uid) {
      const existingSnap = await db
        .collection(
          "digitalClassStudentRegistrations"
        )
        .where("uid", "==", uid)
        .where("status", "==", "pending")
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        return NextResponse.json(
          {
            success: false,
            message:
              "A pending Digital Classroom registration already exists.",
          },
          { status: 409 }
        );
      }
    }

    /* ========================================
       6. GENERATE DIGITAL ADMISSION NUMBER
    ======================================== */

    const digitalAdmissionNumber =
      await generateDigitalAdmissionNumber();

    /* ========================================
       7. PREPARE REGISTRATION DATA
    ======================================== */

    const now = new Date();

    const registrationData = {
      studentId:
        studentId || null,

      uid:
        uid || null,

      admissionNumber:
        admissionNumber || null,

      digitalAdmissionNumber,

      studentName:
        finalStudentName,

      fullName:
        finalStudentName,

      dateOfBirth:
        dateOfBirth || null,

      gender:
        gender || null,

      email:
        email || null,

      phone:
        phone || null,

      address:
        address || null,

      applyingclass:
        finalApplyingClass,

      /* ====================================
         SAVE SELECTED MENTOR TO FIREBASE
      ==================================== */

      mentor:
        finalMentor,

      /* ====================================
         PREVIOUS REGISTRATION
      ==================================== */

      hasOldRegistration:
        hasOldRegistration || "no",

      oldRegistrationNumber:
        hasOldRegistration === "yes"
          ? oldRegistrationNumber || null
          : null,

      previousmadarsa:
        finalPreviousMadarsa,

      guardianName:
        guardianName || null,

      guardianPhone:
        guardianPhone || null,

      profilePicture:
        finalProfilePicture,

      /* ====================================
         ACCOUNT STATUS
      ==================================== */

      status: "pending",

      digitalClassAccess: false,

      passwordCreated: false,

      /* ====================================
         CENTRAL ADMIN APPROVAL
      ==================================== */

      approval: {
        centralAdmin: {
          status: "pending",

          approvedBy: null,

          approvedAt: null,

          rejectedAt: null,

          rejectionReason: null,
        },
      },

      createdAt: now,
      updatedAt: now,
    };

    /* ========================================
       8. SAVE REGISTRATION TO FIREBASE
    ======================================== */

    const docRef = await db
      .collection(
        "digitalClassStudentRegistrations"
      )
      .add(registrationData);

    console.log(
      "DIGITAL STUDENT REGISTRATION SAVED:",
      {
        registrationId: docRef.id,
        digitalAdmissionNumber,
        mentor: finalMentor,
      }
    );

    /* ========================================
       9. SUCCESS RESPONSE
    ======================================== */

    return NextResponse.json(
      {
        success: true,

        message:
          "Digital Classroom registration submitted successfully. Waiting for Central Admin approval.",

        registrationId:
          docRef.id,

        digitalAdmissionNumber,

        mentor:
          finalMentor,

        status: "pending",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "DIGITAL REGISTRATION ERROR:",
      {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
      }
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to submit Digital Classroom registration request.",

        code:
          error?.code || null,
      },
      { status: 500 }
    );
  }
}
