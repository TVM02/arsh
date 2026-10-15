import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COLLECTION =
  "googleMeetOAuthStates";


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
      "VERIFY CENTRAL ADMIN ERROR:",
      error
    );

    return null;
  }
}


export async function POST(
  request
) {
  try {

    const clientId =
      process.env
        .GOOGLE_MEET_CLIENT_ID;

    const redirectUri =
      process.env
        .GOOGLE_MEET_REDIRECT_URI;


    if (
      !clientId ||
      !redirectUri
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Google Meet OAuth is not configured.",
        },
        {
          status: 500,
        }
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


    /*
     * CSRF protection state.
     */
    const state =
      randomBytes(32)
        .toString("hex");


    const stateRef =
      db
        .collection(
          STATE_COLLECTION
        )
        .doc(state);


    await stateRef.set({

      adminUid:
        admin.uid,

      createdAt:
        new Date(),

      expiresAt:
        new Date(
          Date.now() +
          10 * 60 * 1000
        ),

    });


    const params =
      new URLSearchParams({

        client_id:
          clientId,

        redirect_uri:
          redirectUri,

        response_type:
          "code",

        access_type:
          "offline",

        prompt:
          "consent",

        include_granted_scopes:
          "true",

        state,

        scope:
          [
            "https://www.googleapis.com/auth/meetings.space.created",
          ].join(" "),

      });


    const authorizationUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;


    return NextResponse.json(
      {
        success: true,
        authorizationUrl,
      },
      {
        status: 200,
      }
    );


  } catch (error) {

    console.error(
      "GOOGLE MEET OAUTH START ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Unable to start Google authorization.",
      },
      {
        status: 500,
      }
    );
  }
}