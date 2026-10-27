import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Central Admin Google Meet creation endpoint.
 *
 * The Digital Teacher page already sends:
 *   Authorization: Bearer <Firebase ID token>
 *   { teacherUid, className }
 *
 * The previous version of this route expected the old:
 *   creatorRole
 *   tokens
 *   title/startTime/endTime
 *
 * That caused:
 *   403 Forbidden: Outsiders or unauthorized users cannot create live classes.
 *
 * This route now forwards the request to the existing DKJU
 * Google Meet creation flow, which performs the proper Central Admin
 * authentication and Google Meet OAuth/member handling.
 */
export async function POST(request) {
  try {
    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const idToken =
      authorization.slice(7).trim();

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication token is missing.",
        },
        { status: 401 }
      );
    }

    const body =
      await request.json().catch(() => ({}));

    const teacherUid =
      String(body?.teacherUid || "").trim();

    const className =
      String(body?.className || "").trim();

    if (!teacherUid) {
      return NextResponse.json(
        {
          success: false,
          message: "Teacher UID is required.",
        },
        { status: 400 }
      );
    }

    if (!className) {
      return NextResponse.json(
        {
          success: false,
          message: "Class name is required.",
        },
        { status: 400 }
      );
    }

    /*
     * Use the existing DKJU Meet creation endpoint.
     *
     * This keeps the actual Google Meet creation logic in one place.
     */
    const baseUrl =
      new URL(request.url).origin;

    const targetUrl =
      `${baseUrl}/api/digital-classroom/teacher/google-auth/connect`;

    const meetResponse =
      await fetch(targetUrl, {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${idToken}`,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body: JSON.stringify({
          teacherUid,
          className,
        }),

        cache: "no-store",
      });

    const raw =
      await meetResponse.text();

    let data = {};

    try {
      data =
        raw
          ? JSON.parse(raw)
          : {};
    } catch {
      data = {
        success: false,
        message:
          raw ||
          "Google Meet API returned invalid JSON.",
      };
    }

    /*
     * Forward the actual status from the existing
     * DKJU Meet creation endpoint.
     */
    if (!meetResponse.ok) {
      console.error(
        "DKJU GOOGLE MEET CREATE ERROR:",
        {
          status:
            meetResponse.status,

          teacherUid,

          className,

          data,
        }
      );

      return NextResponse.json(
        {
          success: false,

          message:
            data?.message ||
            data?.error ||
            "Unable to create Google Meet.",

          error:
            data?.error ||
            null,

          googleError:
            data?.googleError ||
            null,

          roomId:
            data?.roomId ||
            null,

          teacher:
            data?.teacher ||
            null,

          students:
            data?.students ||
            null,
        },
        {
          status:
            meetResponse.status,
        }
      );
    }

    /*
     * Keep the response compatible with the existing
     * Central Admin page.
     */
    return NextResponse.json(
      {
        success:
          data?.success !== false,

        message:
          data?.message ||
          "Google Meet created successfully.",

        roomId:
          data?.roomId ||
          null,

        meetUrl:
          data?.meetUrl ||
          data?.data?.meetUrl ||
          null,

        googleSpaceName:
          data?.googleSpaceName ||
          data?.data?.googleSpaceName ||
          null,

        teacher:
          data?.teacher ||
          null,

        teacherMemberAdded:
          data?.teacher?.added === true,

        teacherMemberMessage:
          data?.teacher?.message ||
          null,

        students:
          data?.students ||
          null,

        organizer:
          data?.organizer ||
          null,

        data,
      },
      {
        status:
          meetResponse.status,
      }
    );

  } catch (error) {
    console.error(
      "ADMIN GOOGLE MEET CREATE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to create Google Meet.",

        error:
          error?.message ||
          null,
      },
      {
        status: 500,
      }
    );
  }
}