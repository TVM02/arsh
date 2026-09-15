export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  generateDigitalAdmissionNumber,
} from "@/lib/digitalClassAdmissionNumber";

export async function POST(request) {
  try {
    console.log("1. Digital registration started");

    const body = await request.json();

    console.log("2. Request body:", body);

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

      hasOldRegistration,
      oldRegistrationNumber,

      previousmadarsa,

      guardianName,
      guardianPhone,

      profilePicture,
      profilePictureUrl,
    } = body;

    // ------------------------------------
    // Normalize fields
    // ------------------------------------

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

    // ------------------------------------
    // 1. Validation
    // ------------------------------------

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

    const db = getAdminDb();

    console.log("3. Firebase Admin ready");

    // ------------------------------------
    // 2. Optional duplicate check
    // ------------------------------------

    if (uid) {
      const existingSnap = await db
        .collection("digitalClassStudentRegistrations")
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

    // ------------------------------------
    // 3. Generate Digital Admission Number
    // ------------------------------------
const testRef = db
  .collection("systemCounters")
  .doc("digitalClassStudent");

const testSnap = await testRef.get();

console.log(
  "COUNTER READ WORKING:",
  testSnap.exists
);
    console.log(
      "4. Generating digital admission number"
    );

    const digitalAdmissionNumber =
      await generateDigitalAdmissionNumber();

    console.log(
      "5. Generated:",
      digitalAdmissionNumber
    );

    // ------------------------------------
    // 4. Prepare registration
    // ------------------------------------

    const now = new Date();

    const registrationData = {
      studentId: studentId || null,

      uid: uid || null,

      admissionNumber:
        admissionNumber || null,

      digitalAdmissionNumber,

      studentName: finalStudentName,

      fullName: finalStudentName,

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

      status: "pending",

      digitalClassAccess: false,

      passwordCreated: false,

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

    // ------------------------------------
    // 5. Save
    // ------------------------------------

    const docRef = await db
      .collection(
        "digitalClassStudentRegistrations"
      )
      .add(registrationData);

    console.log(
      "6. Registration saved:",
      docRef.id
    );

    // ------------------------------------
    // 6. Response
    // ------------------------------------

    return NextResponse.json(
      {
        success: true,

        message:
          "Digital Classroom registration submitted successfully. Waiting for Central Admin approval.",

        registrationId:
          docRef.id,

        digitalAdmissionNumber,

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