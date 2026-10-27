import { NextResponse } from "next/server";
import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";
import {
  getGoogleMeetAccessToken,
} from "@/lib/googleMeetMembers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // 1. Verify Central Admin
    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const decoded = await auth.verifyIdToken(
      authorization.slice(7).trim()
    );

    const userSnapshot = await db
      .collection("users")
      .doc(decoded.uid)
      .get();

    const role =
      decoded.role ||
      userSnapshot.data()?.role;

    if (
      role !== "central_admin" &&
      role !== "admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Central Admin access required.",
        },
        { status: 403 }
      );
    }

    // 2. Read roomId
    const body = await request.json();

    const roomId = String(
      body?.roomId || ""
    ).trim();

    if (!roomId) {
      return NextResponse.json(
        {
          success: false,
          message: "roomId is required.",
        },
        { status: 400 }
      );
    }

    // 3. Read existing DKJU Meet room
    const roomRef = db
      .collection("digitalMeetRooms")
      .doc(roomId);

    const roomSnapshot = await roomRef.get();

    if (!roomSnapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Meet room not found.",
        },
        { status: 404 }
      );
    }

    const room = roomSnapshot.data();

    const spaceName = String(
      room.googleSpaceName || ""
    ).trim();

    if (
      !/^spaces\/[A-Za-z0-9_-]+$/.test(spaceName)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid Google Meet space name.",
        },
        { status: 400 }
      );
    }

    // 4. Get refreshed Google OAuth token
    const accessToken =
      await getGoogleMeetAccessToken(db);

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Google Meet access token is unavailable.",
        },
        { status: 502 }
      );
    }

    // 5. Read current Google Meet configuration
    const getResponse = await fetch(
      `https://meet.googleapis.com/v2/${spaceName}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const currentSpace =
      await getResponse
        .json()
        .catch(() => ({}));

    if (!getResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "read_space",
          googleStatus: getResponse.status,
          googleResponse: currentSpace,
        },
        { status: 502 }
      );
    }

    const googleConfig =
      currentSpace?.config || {};

    // 6. Save the actual Google configuration
    await roomRef.set(
      {
        googleConfig,
        googleAccessType:
          googleConfig?.accessType || null,
        googleAccessCheckedAt:
          new Date().toISOString(),
        updatedAt:
          new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      roomId,
      googleSpaceName: spaceName,
      config: googleConfig,
      accessType:
        googleConfig?.accessType || null,
    });
  } catch (error) {
    console.error(
      "GOOGLE MEET ACCESS CHECK ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Google Meet access check failed.",
      },
      { status: 500 }
    );
  }
}