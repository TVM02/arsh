import { NextResponse } from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";


const LIVE_CLASS_COLLECTION =
  "digitalClassLiveClasses";

const MEET_ROOM_COLLECTION =
  "digitalMeetRooms";


/* =========================================================
   HELPERS
========================================================= */

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}


function normalizeClass(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(
      /^class\s*/i,
      ""
    )
    .replace(
      /\s+/g,
      ""
    )
    .replace(
      /[^a-z0-9_-]/g,
      ""
    );
}


function isGoogleMeetLink(value) {
  try {
    const url =
      new URL(
        cleanText(value)
      );

    return (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() ===
        "meet.google.com" &&
      url.pathname.length > 1
    );

  } catch {
    return false;
  }
}


/* =========================================================
   VERIFY DIGITAL TEACHER
========================================================= */

async function verifyDigitalTeacher(
  request,
  auth,
  db,
  teacherUid
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


    if (!decoded?.uid) {
      return null;
    }


    /* Teacher can join only own account */

    if (
      cleanText(
        decoded.uid
      ) !==
      cleanText(
        teacherUid
      )
    ) {
      return null;
    }


    const userSnapshot =
      await db
        .collection("users")
        .doc(decoded.uid)
        .get();


    if (
      !userSnapshot.exists
    ) {
      return null;
    }


    const userData =
      userSnapshot.data() || {};


    const isDigitalTeacher =
      userData?.role ===
        "teacher" &&

      userData?.digitalTeacher ===
        true &&

      userData?.digitalClassAccess ===
        true &&

      (
        !userData
          ?.digitalTeacherStatus ||

        userData
          ?.digitalTeacherStatus ===
          "active"
      );


    if (
      !isDigitalTeacher
    ) {
      return null;
    }


    return {
      uid:
        decoded.uid,

      userData,
    };

  } catch (error) {
    console.error(
      "VERIFY TEACHER JOIN ERROR:",
      error
    );

    return null;
  }
}


/* =========================================================
   POST
   TEACHER JOIN LIVE CLASS

   BODY:
   {
     classId: "LIVE_CLASS_DOCUMENT_ID"
   }
========================================================= */

export async function POST(
  request,
  { params }
) {
  try {
    /* =====================================================
       ROUTE PARAMS
    ===================================================== */

    const routeParams =
      await params;


    const teacherUid =
      cleanText(
        routeParams?.teacherUid ||
        routeParams?.id
      );


    if (!teacherUid) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Digital Teacher UID is required.",
        },
        {
          status: 400,
        }
      );
    }


    /* =====================================================
       FIREBASE ADMIN
    ===================================================== */

    const auth =
      getAdminAuth();

    const db =
      getAdminDb();


    /* =====================================================
       AUTHENTICATE DIGITAL TEACHER
    ===================================================== */

    const teacher =
      await verifyDigitalTeacher(
        request,
        auth,
        db,
        teacherUid
      );


    if (!teacher?.uid) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Unauthorized Digital Teacher.",
        },
        {
          status: 401,
        }
      );
    }


    /* =====================================================
       REQUEST BODY
    ===================================================== */

    let body = {};


    try {
      body =
        await request.json();
    } catch {
      body = {};
    }


    const classId =
      cleanText(
        body?.classId
      );


    if (!classId) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Live Class ID is required.",
        },
        {
          status: 400,
        }
      );
    }


    /* =====================================================
       LOAD LIVE CLASS
    ===================================================== */

    const liveClassRef =
      db
        .collection(
          LIVE_CLASS_COLLECTION
        )
        .doc(
          classId
        );


    const liveClassSnapshot =
      await liveClassRef.get();


    if (
      !liveClassSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Live Class not found.",
        },
        {
          status: 404,
        }
      );
    }


    const liveClass =
      liveClassSnapshot.data() ||
      {};


    /* =====================================================
       VERIFY LIVE CLASS OWNER
    ===================================================== */

    if (
      cleanText(
        liveClass?.teacherUid
      ) !==
      teacherUid
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "You cannot join this Live Class.",
        },
        {
          status: 403,
        }
      );
    }


    /* =====================================================
       CLASS INFORMATION
    ===================================================== */

    const className =
      cleanText(
        liveClass?.className
      );


    const classKey =
      normalizeClass(
        className
      );


    if (!classKey) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Live Class class information is missing.",
        },
        {
          status: 400,
        }
      );
    }


    /* =====================================================
       VERIFY CLASS IS ASSIGNED
       TO THIS DIGITAL TEACHER
    ===================================================== */

    const assignedClasses =
      Array.isArray(
        teacher
          ?.userData
          ?.digitalTeachingAssignment
          ?.classes
      )
        ? teacher
            .userData
            .digitalTeachingAssignment
            .classes
        : [];


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
          success: false,

          message:
            "You are no longer assigned to this class.",
        },
        {
          status: 403,
        }
      );
    }


    /* =====================================================
       GET MEET ROOM ID

       New classes:
       liveClass.meetRoomId

       Old classes fallback:
       teacherUid + classKey
    ===================================================== */

    const meetRoomId =
      cleanText(
        liveClass?.meetRoomId
      ) ||
      `${teacherUid}__${classKey}`;


    /* =====================================================
       LOAD PRIVATE GOOGLE MEET ROOM
    ===================================================== */

    const meetRoomSnapshot =
      await db
        .collection(
          MEET_ROOM_COLLECTION
        )
        .doc(
          meetRoomId
        )
        .get();


    if (
      !meetRoomSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `Google Meet room is not assigned for ${className}. Please contact Central Admin.`,
        },
        {
          status: 409,
        }
      );
    }


    const meetRoom =
      meetRoomSnapshot.data() ||
      {};


    /* =====================================================
       VERIFY ROOM OWNER
    ===================================================== */

    if (
      cleanText(
        meetRoom?.teacherUid
      ) !==
      teacherUid
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Google Meet room does not belong to this Digital Teacher.",
        },
        {
          status: 403,
        }
      );
    }


    /* =====================================================
       VERIFY ROOM CLASS
    ===================================================== */

    if (
      normalizeClass(
        meetRoom?.className
      ) !==
      classKey
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Google Meet room does not match this class.",
        },
        {
          status: 409,
        }
      );
    }


    /* =====================================================
       VERIFY ROOM STATUS
    ===================================================== */

    if (
      cleanText(
        meetRoom?.status
      ).toLowerCase() !==
      "active"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Google Meet room is currently inactive. Please contact Central Admin.",
        },
        {
          status: 409,
        }
      );
    }


    /* =====================================================
       GET PRIVATE GOOGLE MEET URL

       IMPORTANT:
       meetUri exists ONLY on backend/private room document.
    ===================================================== */

    const meetUri =
      cleanText(
        meetRoom?.meetUri
      );


    if (
      !meetUri ||
      !isGoogleMeetLink(
        meetUri
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Google Meet room is not configured correctly. Please contact Central Admin.",
        },
        {
          status: 409,
        }
      );
    }


    /* =====================================================
       SUCCESS

       URL is returned only after:
       1. Firebase authentication
       2. Digital Teacher validation
       3. Live Class ownership validation
       4. Assigned class validation
       5. Private Meet room validation
       6. Active room validation
       7. Google Meet URL validation
    ===================================================== */

    return NextResponse.json(
      {
        success: true,

        message:
          "Google Meet room ready.",

        classId,

        className,

        meetRoomId,

        joinUrl:
          meetUri,
      },
      {
        status: 200,
      }
    );

  } catch (error) {
    console.error(
      "TEACHER JOIN LIVE CLASS ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to join Live Class.",
      },
      {
        status: 500,
      }
    );
  }
}