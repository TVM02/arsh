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
      url.protocol ===
        "https:" &&
      url.hostname.toLowerCase() ===
        "meet.google.com" &&
      url.pathname.length > 1
    );

  } catch {

    return false;
  }
}


/* =========================================================
   VERIFY DIGITAL STUDENT
========================================================= */

async function verifyDigitalStudent(
  request,
  auth,
  db
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


    const studentSnapshot =
      await db
        .collection("users")
        .doc(decoded.uid)
        .get();


    if (
      !studentSnapshot.exists
    ) {
      return null;
    }


    const studentData =
      studentSnapshot.data() ||
      {};


    if (
      studentData?.role !==
        "student" ||
      studentData?.userType !==
        "digital_student"
    ) {
      return null;
    }


    return {
      uid:
        decoded.uid,

      studentData,
    };

  } catch (error) {

    console.error(
      "VERIFY DIGITAL STUDENT JOIN ERROR:",
      error
    );


    return null;
  }
}


/* =========================================================
   POST
   DIGITAL STUDENT JOIN LIVE CLASS

   BODY:
   {
     classId: "LIVE_CLASS_ID"
   }
========================================================= */

export async function POST(
  request
) {

  try {

    const auth =
      getAdminAuth();


    const db =
      getAdminDb();


    /* =====================================================
       VERIFY STUDENT
    ===================================================== */

    const student =
      await verifyDigitalStudent(
        request,
        auth,
        db
      );


    if (!student?.uid) {

      return NextResponse.json(
        {
          success: false,

          message:
            "Unauthorized Digital Student.",
        },
        {
          status: 401,
        }
      );
    }


    const studentData =
      student.studentData ||
      {};


    /* =====================================================
       CHECK TEACHER ASSIGNMENT
    ===================================================== */

    if (
      studentData
        ?.teacherAssigned !==
        true
    ) {

      return NextResponse.json(
        {
          success: false,

          message:
            "No Digital Teacher is assigned to you.",
        },
        {
          status: 403,
        }
      );
    }


    const assignedTeacherUid =
      cleanText(
        studentData
          ?.assignedDigitalTeacherUid
      );


    const assignedClass =
      cleanText(
        studentData
          ?.assignedDigitalTeacherClass
      );


    const assignedClassKey =
      normalizeClass(
        assignedClass
      );


    if (
      !assignedTeacherUid ||
      !assignedClassKey
    ) {

      return NextResponse.json(
        {
          success: false,

          message:
            "Your Digital Classroom assignment is incomplete.",
        },
        {
          status: 403,
        }
      );
    }


    /* =====================================================
       BODY
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

    const liveClassSnapshot =
      await db
        .collection(
          LIVE_CLASS_COLLECTION
        )
        .doc(
          classId
        )
        .get();


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
       VERIFY ASSIGNED TEACHER
    ===================================================== */

    if (
      cleanText(
        liveClass?.teacherUid
      ) !==
      assignedTeacherUid
    ) {

      return NextResponse.json(
        {
          success: false,

          message:
            "This Live Class is not assigned to your Digital Teacher.",
        },
        {
          status: 403,
        }
      );
    }


    /* =====================================================
       VERIFY ASSIGNED CLASS
    ===================================================== */

    const liveClassKey =
      normalizeClass(
        liveClass?.className
      );


    if (
      !liveClassKey ||
      liveClassKey !==
        assignedClassKey
    ) {

      return NextResponse.json(
        {
          success: false,

          message:
            "This Live Class is not assigned to your class.",
        },
        {
          status: 403,
        }
      );
    }


    /* =====================================================
       JOIN TIME

       Student can join:
       5 minutes before start
       until class end.
    ===================================================== */

    const date =
      cleanText(
        liveClass?.date
      );


    const startTime =
      cleanText(
        liveClass?.startTime
      );


    const endTime =
      cleanText(
        liveClass?.endTime
      );


    if (
      !date ||
      !startTime ||
      !endTime
    ) {

      return NextResponse.json(
        {
          success: false,

          message:
            "Live Class schedule is incomplete.",
        },
        {
          status: 409,
        }
      );
    }


    const startDate =
      new Date(
        `${date}T${startTime}:00+05:30`
      );


    const endDate =
      new Date(
        `${date}T${endTime}:00+05:30`
      );


    if (
      Number.isNaN(
        startDate.getTime()
      ) ||
      Number.isNaN(
        endDate.getTime()
      )
    ) {

      return NextResponse.json(
        {
          success: false,

          message:
            "Live Class schedule is invalid.",
        },
        {
          status: 409,
        }
      );
    }


    const joinOpenTime =
      new Date(
        startDate.getTime() -
        5 * 60 * 1000
      );


    const now =
      new Date();


    if (
      now <
      joinOpenTime
    ) {

      return NextResponse.json(
        {
          success: false,

          message:
            "You can join this class 5 minutes before the start time.",
        },
        {
          status: 403,
        }
      );
    }


    if (
      now >
      endDate
    ) {

      return NextResponse.json(
        {
          success: false,

          message:
            "This Live Class has already ended.",
        },
        {
          status: 403,
        }
      );
    }


    /* =====================================================
       RESOLVE PRIVATE ROOM
    ===================================================== */

    const meetRoomId =
      cleanText(
        liveClass?.meetRoomId
      ) ||
      `${assignedTeacherUid}__${liveClassKey}`;


    const roomSnapshot =
      await db
        .collection(
          MEET_ROOM_COLLECTION
        )
        .doc(
          meetRoomId
        )
        .get();


    if (
      !roomSnapshot.exists
    ) {

      return NextResponse.json(
        {
          success: false,

          message:
            "Google Meet room is not configured for this class.",
        },
        {
          status: 409,
        }
      );
    }


    const room =
      roomSnapshot.data() ||
      {};


    /* =====================================================
       VERIFY ROOM TEACHER
    ===================================================== */

    if (
      cleanText(
        room?.teacherUid
      ) !==
      assignedTeacherUid
    ) {

      return NextResponse.json(
        {
          success: false,

          message:
            "Google Meet room teacher does not match.",
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
        room?.className
      ) !==
      assignedClassKey
    ) {

      return NextResponse.json(
        {
          success: false,

          message:
            "Google Meet room does not match your class.",
        },
        {
          status: 403,
        }
      );
    }


    /* =====================================================
       ROOM MUST BE ACTIVE
    ===================================================== */

    if (
      cleanText(
        room?.status
      ).toLowerCase() !==
      "active"
    ) {

      return NextResponse.json(
        {
          success: false,

          message:
            "Google Meet room is currently inactive.",
        },
        {
          status: 409,
        }
      );
    }


    /* =====================================================
       PRIVATE MEET URL
    ===================================================== */

    const meetUri =
      cleanText(
        room?.meetUri
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
            "Google Meet room is not configured correctly.",
        },
        {
          status: 409,
        }
      );
    }


    /* =====================================================
       SUCCESS

       Meet URL is only returned after
       every student authorization check.
    ===================================================== */

    return NextResponse.json(
      {
        success: true,

        message:
          "Live Class ready.",

        classId,

        joinUrl:
          meetUri,
      },
      {
        status: 200,
      }
    );

  } catch (error) {

    console.error(
      "DIGITAL STUDENT JOIN LIVE CLASS ERROR:",
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