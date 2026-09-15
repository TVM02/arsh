export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  getAdminDb,
  getAdminAuth,
} from "@/lib/firebase-admin";

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;

    const body = await request.json();

    const adminUid =
      body.adminUid || null;

    const email =
      body.email?.trim().toLowerCase();

    const password =
      body.password?.trim();

    console.log("DIGITAL APPROVAL REQUEST:", {
      id,
      adminUid,
      email,
      hasPassword: Boolean(password),
      passwordLength:
        password?.length || 0,
    });

    // -------------------------------------
    // 1. Validation
    // -------------------------------------

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Student registration ID is required",
        },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          message: "Email is required",
        },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        {
          success: false,
          message: "Password is required",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password must be at least 6 characters",
        },
        { status: 400 }
      );
    }

    // -------------------------------------
    // 2. Firebase Admin
    // -------------------------------------

    const db = getAdminDb();
    const auth = getAdminAuth();

    const registrationRef = db
      .collection(
        "digitalClassStudentRegistrations"
      )
      .doc(id);

    const registrationSnap =
      await registrationRef.get();

    if (!registrationSnap.exists) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital student registration not found",
        },
        { status: 404 }
      );
    }

    const student =
      registrationSnap.data();

    // -------------------------------------
    // 3. Prevent double approval
    // -------------------------------------

    if (student.status === "approved") {
      return NextResponse.json(
        {
          success: false,
          message:
            "This student is already approved",
        },
        { status: 409 }
      );
    }

    // -------------------------------------
    // 4. Create Firebase Authentication user
    // -------------------------------------

    let authUser;

    try {
      authUser =
        await auth.createUser({
          email,
          password,

          displayName:
            student.fullName ||
            student.studentName ||
            "Digital Student",
        });
    } catch (error) {
      console.error(
        "FIREBASE AUTH CREATE ERROR:",
        {
          code: error?.code,
          message: error?.message,
        }
      );

      // IMPORTANT:
      // Do not reset an existing user's password
      // automatically.
      if (
        error.code ===
        "auth/email-already-exists"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This email already has a login account. Please use another email.",
          },
          { status: 409 }
        );
      }

      throw error;
    }

    const uid =
      authUser.uid;

    console.log(
      "DIGITAL STUDENT AUTH USER CREATED:",
      {
        uid,
        email,
      }
    );

    // -------------------------------------
    // 5. Create Users document
    // -------------------------------------

    const userRef = db
      .collection("users")
      .doc(uid);

    await userRef.set(
      {
        uid,

        email,

        fullName:
          student.fullName ||
          student.studentName ||
          "Digital Student",

        role: "student",

        userType:
          "digital_student",

        digitalAdmissionNumber:
          student.digitalAdmissionNumber ||
          null,

        accountStatus:
          "active",

        digitalClassAccess:
          true,

        createdAt:
          new Date(),

        updatedAt:
          new Date(),
      },
      {
        merge: true,
      }
    );

    console.log(
      "USERS DOCUMENT CREATED:",
      uid
    );

    // -------------------------------------
    // 6. Update digital registration
    // -------------------------------------

    await registrationRef.update({
  uid,

  studentEmail: email,
  email,

  // Password value
  password: password,

  status: "approved",
  accountStatus: "active",

  paymentStatus: "pending",

  digitalClassAccess: true,
  passwordCreated: true,

  "approval.centralAdmin.status":
    "approved",

  "approval.centralAdmin.approvedBy":
    adminUid,

  "approval.centralAdmin.approvedAt":
    new Date(),

  "approval.centralAdmin.rejectedAt":
    null,

  "approval.centralAdmin.rejectionReason":
    null,

  updatedAt: new Date(),
});

    // -------------------------------------
    // 7. Success response
    // -------------------------------------

    return NextResponse.json(
      {
        success: true,

        message:
          "Digital student approved successfully",

        // Return credentials so Central Admin
        // can show/copy them immediately.
        credentials: {
          email,
          password,
        },

        student: {
          id,

          uid,

          fullName:
            student.fullName ||
            student.studentName ||
            null,

          email,

          digitalAdmissionNumber:
            student.digitalAdmissionNumber ||
            null,

          status:
            "approved",

          accountStatus:
            "active",

          paymentStatus:
            "pending",

          digitalClassAccess:
            true,

          passwordCreated:
            true,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "DIGITAL STUDENT APPROVAL ERROR:",
      {
        message:
          error?.message,

        code:
          error?.code,

        stack:
          error?.stack,
      }
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to approve Digital Classroom student",

        code:
          error?.code || null,
      },
      {
        status: 500,
      }
    );
  }
}