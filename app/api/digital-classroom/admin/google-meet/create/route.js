import { NextResponse } from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";


const ROOM_COLLECTION =
  "digitalMeetRooms";

const CONNECTION_COLLECTION =
  "googleMeetOAuthConnections";

/*
 * COHOST returned 403 for the connected
 * Google account.
 *
 * ROLE_UNSPECIFIED works and adds the
 * Digital Teacher as a configured member.
 */
const TEACHER_MEET_ROLE =
  "ROLE_UNSPECIFIED";


/* =========================================================
   BASIC HELPERS
========================================================= */

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}


function normalizeClass(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/^class\s*/i, "")
    .replace(/\s+/g, "")
    .replace(
      /[^a-z0-9_-]/g,
      ""
    );
}


/* =========================================================
   VERIFY CENTRAL ADMIN
========================================================= */

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


    /*
     * Fast path if role is
     * available in custom claims.
     */
    if (
      decoded?.role ===
        "central_admin" ||
      decoded?.role ===
        "admin"
    ) {
      return decoded;
    }


    /*
     * Otherwise verify from
     * users/{uid}.
     */
    const snapshot =
      await db
        .collection("users")
        .doc(decoded.uid)
        .get();


    if (!snapshot.exists) {
      return null;
    }


    const data =
      snapshot.data() || {};


    if (
      data?.role !==
        "central_admin" &&
      data?.role !==
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


/* =========================================================
   GET / REFRESH GOOGLE ACCESS TOKEN
========================================================= */

async function getGoogleAccessToken(
  db
) {
  const connectionRef =
    db
      .collection(
        CONNECTION_COLLECTION
      )
      .doc("default");


  const snapshot =
    await connectionRef.get();


  if (!snapshot.exists) {
    throw new Error(
      "Google Meet is not connected."
    );
  }


  const connection =
    snapshot.data() || {};


  if (
    connection?.connected !== true
  ) {
    throw new Error(
      "Google Meet is not connected."
    );
  }


  const expiresAt =
    connection
      ?.accessTokenExpiresAt
      ?.toDate
      ? connection
          .accessTokenExpiresAt
          .toDate()
      : new Date(
          connection
            ?.accessTokenExpiresAt ||
          0
        );


  /*
   * Reuse current access token
   * if it has more than 2 minutes
   * remaining.
   */
  if (
    connection?.accessToken &&
    expiresAt instanceof Date &&
    !Number.isNaN(
      expiresAt.getTime()
    ) &&
    expiresAt.getTime() >
      Date.now() +
        2 * 60 * 1000
  ) {
    return connection.accessToken;
  }


  /*
   * Otherwise refresh it.
   */
  const refreshToken =
    cleanText(
      connection?.refreshToken
    );


  if (!refreshToken) {
    throw new Error(
      "Google refresh token is missing. Please reconnect Google Meet."
    );
  }


  const clientId =
    process.env
      .GOOGLE_MEET_CLIENT_ID;

  const clientSecret =
    process.env
      .GOOGLE_MEET_CLIENT_SECRET;


  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "Google OAuth environment variables are missing."
    );
  }


  const response =
    await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({

            client_id:
              clientId,

            client_secret:
              clientSecret,

            refresh_token:
              refreshToken,

            grant_type:
              "refresh_token",

          }),

        cache: "no-store",
      }
    );


  const raw =
    await response.text();


  let data = {};


  try {

    data =
      raw
        ? JSON.parse(raw)
        : {};

  } catch {

    throw new Error(
      `Google token endpoint returned invalid response. HTTP ${response.status}`
    );
  }


  if (!response.ok) {

    console.error(
      "GOOGLE TOKEN REFRESH ERROR:",
      data
    );


    throw new Error(
      data?.error_description ||
      data?.error ||
      "Unable to refresh Google access token."
    );
  }


  const accessToken =
    cleanText(
      data?.access_token
    );


  if (!accessToken) {
    throw new Error(
      "Google access token is missing."
    );
  }


  const expiresIn =
    Number(
      data?.expires_in ||
      3600
    );


  await connectionRef.set(
    {

      accessToken,

      accessTokenExpiresAt:
        new Date(
          Date.now() +
          expiresIn * 1000
        ),

      updatedAt:
        new Date(),

    },
    {
      merge: true,
    }
  );


  return accessToken;
}


/* =========================================================
   ADD GOOGLE MEET MEMBER
========================================================= */

async function addGoogleMeetMember({
  accessToken,
  googleSpaceName,
  email,
  role = TEACHER_MEET_ROLE,
}) {
  const cleanEmail =
    cleanText(email)
      .toLowerCase();


  if (!cleanEmail) {

    return {

      success:
        false,

      skipped:
        true,

      role,

      message:
        "Digital Teacher Google email is missing.",

    };
  }


  if (!googleSpaceName) {

    return {

      success:
        false,

      skipped:
        true,

      role,

      message:
        "Google Meet space name is missing.",

    };
  }


  try {

    const response =
      await fetch(
        `https://meet.googleapis.com/v2/${googleSpaceName}/members`,
        {
          method: "POST",

          headers: {

            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",

          },

          body:
            JSON.stringify({

              email:
                cleanEmail,

              role,

            }),

          cache:
            "no-store",
        }
      );


    const raw =
      await response.text();


    let data = {};


    try {

      data =
        raw
          ? JSON.parse(raw)
          : {};

    } catch {

      data = {
        raw,
      };
    }


    if (!response.ok) {

      console.error(
        "GOOGLE MEET MEMBER ERROR:",
        {

          email:
            cleanEmail,

          role,

          status:
            response.status,

          data,

        }
      );


      return {

        success:
          false,

        email:
          cleanEmail,

        role,

        status:
          response.status,

        errorStatus:
          data?.error?.status ||
          null,

        message:
          data?.error?.message ||
          `Unable to add Google Meet member. HTTP ${response.status}`,

      };
    }


    return {

      success:
        true,

      email:
        cleanEmail,

      role,

      member:
        data,

    };

  } catch (error) {

    console.error(
      "GOOGLE MEET MEMBER REQUEST ERROR:",
      error
    );


    return {

      success:
        false,

      email:
        cleanEmail,

      role,

      message:
        error?.message ||
        "Unable to add Google Meet member.",

    };
  }
}


/* =========================================================
   CREATE GOOGLE MEET
========================================================= */

export async function POST(
  request
) {
  try {

    const auth =
      getAdminAuth();

    const db =
      getAdminDb();


    /* -----------------------------------------------------
       VERIFY ADMIN
    ----------------------------------------------------- */

    const admin =
      await verifyCentralAdmin(
        request,
        auth,
        db
      );


    if (!admin?.uid) {

      return NextResponse.json(
        {
          success:
            false,

          message:
            "Unauthorized. Central Admin access required.",
        },
        {
          status:
            401,
        }
      );
    }


    /* -----------------------------------------------------
       REQUEST BODY
    ----------------------------------------------------- */

    let body = {};


    try {

      body =
        await request.json();

    } catch {

      return NextResponse.json(
        {
          success:
            false,

          message:
            "Invalid request body.",
        },
        {
          status:
            400,
        }
      );
    }


    const teacherUid =
      cleanText(
        body?.teacherUid
      );


    const className =
      cleanText(
        body?.className
      );


    if (
      !teacherUid ||
      !className
    ) {

      return NextResponse.json(
        {
          success:
            false,

          message:
            "Digital Teacher and class are required.",
        },
        {
          status:
            400,
        }
      );
    }


    /* -----------------------------------------------------
       LOAD DIGITAL TEACHER
    ----------------------------------------------------- */

    const teacherSnapshot =
      await db
        .collection("users")
        .doc(teacherUid)
        .get();


    if (!teacherSnapshot.exists) {

      return NextResponse.json(
        {
          success:
            false,

          message:
            "Digital Teacher not found.",
        },
        {
          status:
            404,
        }
      );
    }


    const teacher =
      teacherSnapshot.data() ||
      {};


    /* -----------------------------------------------------
       VERIFY DIGITAL TEACHER
    ----------------------------------------------------- */

    if (
      teacher?.role !==
        "teacher" ||

      teacher?.digitalTeacher !==
        true ||

      teacher
        ?.digitalClassAccess !==
        true ||

      (
        teacher
          ?.digitalTeacherStatus &&

        teacher
          ?.digitalTeacherStatus !==
          "active"
      )
    ) {

      return NextResponse.json(
        {
          success:
            false,

          message:
            "Digital Teacher is not active.",
        },
        {
          status:
            403,
        }
      );
    }


    /* -----------------------------------------------------
       VERIFY ASSIGNED CLASS
    ----------------------------------------------------- */

    const assignedClasses =
      Array.isArray(
        teacher
          ?.digitalTeachingAssignment
          ?.classes
      )
        ? teacher
            .digitalTeachingAssignment
            .classes
        : [];


    const classKey =
      normalizeClass(
        className
      );


    if (!classKey) {

      return NextResponse.json(
        {
          success:
            false,

          message:
            "Invalid Digital Classroom class.",
        },
        {
          status:
            400,
        }
      );
    }


    const classAllowed =
      assignedClasses.some(
        (item) =>
          normalizeClass(
            item
          ) ===
          classKey
      );


    if (!classAllowed) {

      return NextResponse.json(
        {
          success:
            false,

          message:
            "This class is not assigned to the Digital Teacher.",
        },
        {
          status:
            403,
        }
      );
    }


    /* -----------------------------------------------------
       DETERMINISTIC ROOM ID
    ----------------------------------------------------- */

    const roomId =
      `${teacherUid}__${classKey}`;


    const roomRef =
      db
        .collection(
          ROOM_COLLECTION
        )
        .doc(roomId);


    const existingRoom =
      await roomRef.get();


    /*
     * Do not accidentally create another
     * Meet for the same Teacher + Class.
     */
    if (
      existingRoom.exists &&
      existingRoom.data()
        ?.status === "active" &&
      existingRoom.data()
        ?.meetUri
    ) {

      return NextResponse.json(
        {
          success:
            false,

          message:
            "Google Meet is already configured for this class.",
        },
        {
          status:
            409,
        }
      );
    }


    /* -----------------------------------------------------
       GET GOOGLE ACCESS TOKEN
    ----------------------------------------------------- */

    const accessToken =
      await getGoogleAccessToken(
        db
      );


    /* -----------------------------------------------------
       CREATE GOOGLE MEET SPACE
    ----------------------------------------------------- */

    const meetResponse =
      await fetch(
        "https://meet.googleapis.com/v2/spaces",
        {
          method:
            "POST",

          headers: {

            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",

          },


          /*
           * Important:
           *
           * Do NOT force accessType here,
           * because this connected account
           * returned:
           *
           * updateAccessType is not
           * available to the user.
           *
           * CREATOR_APP_ONLY limits
           * meeting entry points to entry
           * points owned by the same
           * Google Cloud project.
           */
          body:
            JSON.stringify({

              config: {

                entryPointAccess:
                  "ALL",

              },

            }),

          cache:
            "no-store",
        }
      );


    const meetRaw =
      await meetResponse.text();


    let space = {};


    try {

      space =
        meetRaw
          ? JSON.parse(
              meetRaw
            )
          : {};

    } catch {

      throw new Error(
        `Google Meet API returned invalid response. HTTP ${meetResponse.status}`
      );
    }


    if (!meetResponse.ok) {

      console.error(
        "GOOGLE MEET CREATE ERROR:",
        space
      );


      return NextResponse.json(
        {
          success:
            false,

          message:
            space?.error
              ?.message ||
            "Google Meet room creation failed.",
        },
        {
          status:
            meetResponse
              .status ||
            500,
        }
      );
    }


    /* -----------------------------------------------------
       GOOGLE SPACE DATA
    ----------------------------------------------------- */

    const meetUri =
      cleanText(
        space?.meetingUri
      );


    const meetingCode =
      cleanText(
        space?.meetingCode
      );


    const googleSpaceName =
      cleanText(
        space?.name
      );


    if (
      !meetUri ||
      !googleSpaceName
    ) {

      throw new Error(
        "Google Meet API did not return a valid meeting room."
      );
    }


    /* -----------------------------------------------------
       DIGITAL TEACHER GOOGLE EMAIL
    ----------------------------------------------------- */

    const teacherGoogleEmail =
      cleanText(
        teacher
          ?.googleMeetEmail ||

        teacher
          ?.digitalTeacherEmail ||

        teacher
          ?.teacherEmail ||

        teacher
          ?.email
      )
      .toLowerCase();


    /* -----------------------------------------------------
       ADD USTAD AS CONFIGURED MEMBER
    ----------------------------------------------------- */

    const teacherMemberResult =
      await addGoogleMeetMember({

        accessToken,

        googleSpaceName,

        email:
          teacherGoogleEmail,

        role:
          TEACHER_MEET_ROLE,

      });


    /* -----------------------------------------------------
       SAVE PRIVATE ROOM
    ----------------------------------------------------- */

    const nowServer =
      FieldValue
        .serverTimestamp();


    const roomData = {

      teacherUid,

      teacherName:
        teacher?.fullName ||
        teacher?.teacherName ||
        "",

      teacherEmail:
        teacher
          ?.digitalTeacherEmail ||
        teacher
          ?.teacherEmail ||
        teacher?.email ||
        "",

      teacherMhrId:
        teacher?.mhrId ||
        "",


      className,

      classKey,


      googleSpaceName,

      meetUri,

      meetKey:
        meetUri
          .trim()
          .toLowerCase(),

      meetCode:
        meetingCode,


      provider:
        "google_meet",


      /*
       * Store actual config returned
       * by Google.
       */
      googleConfig:
        space?.config ||
        null,


      /*
       * Teacher membership.
       */
      teacherGoogleEmail:
        teacherGoogleEmail ||
        "",

      teacherMeetRole:
        teacherMemberResult
          ?.success
            ? TEACHER_MEET_ROLE
            : null,

      teacherMeetMemberAdded:
        teacherMemberResult
          ?.success === true,

      teacherMeetMemberName:
        teacherMemberResult
          ?.member
          ?.name ||
        null,

      teacherMeetMemberError:
        teacherMemberResult
          ?.success
            ? null
            : teacherMemberResult
                ?.message ||
              null,


      status:
        "active",

      configured:
        true,


      createdBy:
        admin.uid,

      createdAt:
        nowServer,

      updatedBy:
        admin.uid,

      updatedAt:
        nowServer,

    };


    await roomRef.set(
      roomData,
      {
        merge: true,
      }
    );


    /* -----------------------------------------------------
       SAFE ADMIN RESPONSE
    ----------------------------------------------------- */

    return NextResponse.json(
      {
        success:
          true,


        message:
          teacherMemberResult
            ?.success
            ? "Google Meet created and Ustad added as a Meet member."
            : "Google Meet created. Ustad could not be added as a Meet member.",


        teacherMemberAdded:
          teacherMemberResult
            ?.success === true,


        teacherMeetRole:
          teacherMemberResult
            ?.success
              ? TEACHER_MEET_ROLE
              : null,


        teacherMemberMessage:
          teacherMemberResult
            ?.success
              ? null
              : teacherMemberResult
                  ?.message ||
                null,


        room: {

          id:
            roomId,

          teacherUid,

          className,

          classKey,

          googleSpaceName,

          /*
           * Central Admin may need this
           * immediately after creation.
           *
           * Do not expose this response
           * from Student / Teacher list APIs.
           */
          meetUri,

          meetCode:
            meetingCode,

          configured:
            true,

          status:
            "active",

        },

      },
      {
        status:
          201,
      }
    );


  } catch (error) {

    console.error(
      "CREATE GOOGLE MEET ERROR:",
      error
    );


    return NextResponse.json(
      {
        success:
          false,

        message:
          error?.message ||
          "Unable to create Google Meet.",
      },
      {
        status:
          500,
      }
    );
  }
}