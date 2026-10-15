import { NextResponse } from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONNECTION_COLLECTION =
  "googleMeetOAuthConnections";


async function verifyCentralAdmin(
  request,
  auth,
  db,
) {
  const authorization =
    request.headers.get(
      "authorization"
    ) || "";

  if (
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    return null;
  }

  const token =
    authorization
      .slice(7)
      .trim();

  if (!token) {
    return null;
  }

  try {

    const decoded =
      await auth.verifyIdToken(
        token
      );

    if (
      decoded?.role ===
        "central_admin" ||
      decoded?.role ===
        "admin"
    ) {
      return decoded;
    }

    const userSnapshot =
      await db
        .collection("users")
        .doc(decoded.uid)
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

    return decoded;

  } catch (error) {

    console.error(
      "VERIFY GOOGLE MEET ADMIN ERROR:",
      error
    );

    return null;
  }
}


function serializeDate(
  value
) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toDate ===
    "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date.toISOString();
}


export async function GET(
  request
) {
  try {

    const auth =
      getAdminAuth();

    const db =
      getAdminDb();


    const admin =
      await verifyCentralAdmin(
        request,
        auth,
        db
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
        }
      );
    }


    const snapshot =
      await db
        .collection(
          CONNECTION_COLLECTION
        )
        .doc("default")
        .get();


    if (!snapshot.exists) {

      return NextResponse.json(
        {
          success: true,
          connected: false,
        },
        {
          status: 200,
        }
      );
    }


    const data =
      snapshot.data() || {};


    /*
     * IMPORTANT:
     * Never expose accessToken
     * or refreshToken here.
     */
    return NextResponse.json(
      {
        success: true,

        connected:
          data?.connected === true,

        provider:
          data?.provider ||
          "google_meet",

        connectedAt:
          serializeDate(
            data?.connectedAt
          ),

        updatedAt:
          serializeDate(
            data?.updatedAt
          ),

        accessTokenExpiresAt:
          serializeDate(
            data
              ?.accessTokenExpiresAt
          ),

        scope:
          data?.scope || "",
      },
      {
        status: 200,
      }
    );


  } catch (error) {

    console.error(
      "GOOGLE MEET STATUS ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Unable to load Google Meet connection status.",
      },
      {
        status: 500,
      }
    );
  }
}
