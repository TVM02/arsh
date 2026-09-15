import { NextResponse } from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION =
  "digitalClassTeacherRegistrations";

function cleanText(value) {
  return String(value ?? "").trim();
}

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
      "CENTRAL ADMIN VERIFY ERROR:",
      error,
    );

    return null;
  }
}

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

    const body =
      await request.json();

    const reason =
      cleanText(
        body?.reason,
      );

    if (!reason) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Rejection reason is required.",
        },
        {
          status: 400,
        },
      );
    }

    const registrationRef =
      db
        .collection(COLLECTION)
        .doc(id);

    const snapshot =
      await registrationRef.get();

    if (!snapshot.exists) {
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

    const application =
      snapshot.data();

    if (
      application?.status !==
      "pending"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only pending Digital Teacher applications can be rejected.",
        },
        {
          status: 409,
        },
      );
    }

    await registrationRef.update({
      status:
        "rejected",

      accountStatus:
        null,

      digitalClassAccess:
        false,

      "approval.centralAdmin.status":
        "rejected",

      "approval.centralAdmin.approvedBy":
        null,

      "approval.centralAdmin.approvedAt":
        null,

      "approval.centralAdmin.rejectedBy":
        admin.uid,

      "approval.centralAdmin.rejectedAt":
        new Date(),

      "approval.centralAdmin.rejectionReason":
        reason,

      updatedAt:
        new Date(),
    });

    return NextResponse.json({
      success: true,

      message:
        "Digital Teacher application rejected successfully.",

      applicationId:
        id,

      status:
        "rejected",

      rejectionReason:
        reason,
    });
  } catch (error) {
    console.error(
      "DIGITAL TEACHER REJECT ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to reject Digital Teacher application.",
      },
      {
        status: 500,
      },
    );
  }
}