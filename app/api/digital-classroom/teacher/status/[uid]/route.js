import { NextResponse } from "next/server";

import {
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION =
  "digitalClassTeacherRegistrations";

export async function GET(
  request,
  { params },
) {
  try {
    const { uid } = await params;

    if (!uid) {
      return NextResponse.json(
        {
          success: false,
          message: "Teacher UID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const db = getAdminDb();

    const snapshot = await db
      .collection(COLLECTION)
      .where(
        "sourceTeacherUid",
        "==",
        uid,
      )
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        exists: false,
        status: "form",
        application: null,
      });
    }

    const applications =
      snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

    let application =
      applications.find(
        (item) =>
          item.status === "approved",
      ) ||
      applications.find(
        (item) =>
          item.status === "pending",
      ) ||
      applications.find(
        (item) =>
          item.status === "rejected",
      ) ||
      applications[0];

    return NextResponse.json({
      success: true,
      exists: true,

      status:
        application.status || "pending",

      application: {
        id: application.id,

        status:
          application.status || "pending",

        accountStatus:
          application.accountStatus || null,

        digitalClassAccess:
          application.digitalClassAccess ===
          true,

        digitalTeacherUid:
          application.digitalTeacherUid ||
          null,

        digitalTeacherEmail:
          application.digitalTeacherEmail ||
          null,

        rejectionReason:
          application.approval?.centralAdmin
            ?.rejectionReason ||
          null,
          teachingAssignment:
  application.teachingAssignment || {
    classes: [],
    subjects: [],
    languages: [],
  }, rejectionReason:
    application.approval?.centralAdmin
      ?.rejectionReason || null,
      },
    });
  } catch (error) {
    console.error(
      "DIGITAL TEACHER STATUS ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Unable to load application status.",
      },
      {
        status: 500,
      },
    );
  }
}