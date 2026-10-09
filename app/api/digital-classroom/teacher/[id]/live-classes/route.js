import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIVE_CLASS_COLLECTION =
  "digitalClassLiveClasses";

/* ============================================
   HELPERS
============================================ */

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeClass(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/^class\s*/i, "")
    .replace(/\s+/g, "");
}

function normalizeSubject(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isValidGoogleMeetLink(value) {
  try {
    const url =
      new URL(
        cleanText(value)
      );

    return (
      url.protocol === "https:" &&
      url.hostname ===
        "meet.google.com"
    );
  } catch {
    return false;
  }
}

function getAutomaticLiveClassStatus(
  liveClass,
  now = new Date()
) {
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
    return (
      liveClass?.status ||
      "upcoming"
    );
  }

  /*
   * Madrasa Digital Classroom
   * uses India time.
   */

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
    return (
      liveClass?.status ||
      "upcoming"
    );
  }

  if (now < startDate) {
    return "upcoming";
  }

  if (
    now >= startDate &&
    now < endDate
  ) {
    return "ongoing";
  }

  return "completed";
}
/* ============================================
   VERIFY DIGITAL TEACHER
============================================ */

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

    /*
     * Teacher can create
     * only his own Live Class.
     */
    if (
      cleanText(decoded.uid) !==
      cleanText(teacherUid)
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

    if (!isDigitalTeacher) {
      return null;
    }

    return {
      uid:
        decoded.uid,

      userData,
    };
  } catch (error) {
    console.error(
      "VERIFY LIVE CLASS TEACHER ERROR:",
      error
    );

    return null;
  }
}

/* ============================================
   CREATE LIVE CLASS
============================================ */

export async function POST(
  request,
  { params }
) {
  try {
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

    const auth =
      getAdminAuth();

    const db =
      getAdminDb();

    /* ========================================
       AUTH
    ======================================== */

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

    /* ========================================
       BODY
    ======================================== */

    let body = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    const title =
      cleanText(
        body?.title
      );

    const subject =
      cleanText(
        body?.subject
      );

    const className =
      cleanText(
        body?.className
      );

    const date =
      cleanText(
        body?.date
      );

    const startTime =
      cleanText(
        body?.startTime
      );

    const endTime =
      cleanText(
        body?.endTime
      );

    const meetLink =
      cleanText(
        body?.meetLink
      );

    const description =
      cleanText(
        body?.description
      );

    /* ========================================
       REQUIRED FIELDS
    ======================================== */

    if (
      !title ||
      !subject ||
      !className ||
      !date ||
      !startTime ||
      !endTime ||
      !meetLink
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please fill all required Live Class fields.",
        },
        {
          status: 400,
        }
      );
    }

    /* ========================================
       DATE FORMAT
    ======================================== */

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        date
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid class date.",
        },
        {
          status: 400,
        }
      );
    }

    /* ========================================
       TIME FORMAT
    ======================================== */

    const timePattern =
      /^([01]\d|2[0-3]):[0-5]\d$/;

    if (
      !timePattern.test(
        startTime
      ) ||
      !timePattern.test(
        endTime
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid class time.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      endTime <= startTime
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "End time must be after start time.",
        },
        {
          status: 400,
        }
      );
    }

    /* ========================================
       GOOGLE MEET VALIDATION
    ======================================== */

    if (
      !isValidGoogleMeetLink(
        meetLink
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please provide a valid Google Meet link.",
        },
        {
          status: 400,
        }
      );
    }

    /* ========================================
       TEACHER ASSIGNMENTS
    ======================================== */

    const assignment =
      teacher.userData
        ?.digitalTeachingAssignment ||
      {};

    const assignedClasses =
      Array.isArray(
        assignment?.classes
      )
        ? assignment.classes
        : [];

    const assignedSubjects =
      Array.isArray(
        assignment?.subjects
      )
        ? assignment.subjects
        : [];

    /* ========================================
       VERIFY CLASS
    ======================================== */

    const classAllowed =
      assignedClasses.some(
        (item) =>
          normalizeClass(
            item
          ) ===
          normalizeClass(
            className
          )
      );

    if (!classAllowed) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not assigned to this class.",
        },
        {
          status: 403,
        }
      );
    }

    /* ========================================
       VERIFY SUBJECT
    ======================================== */

    const subjectAllowed =
      assignedSubjects.some(
        (item) =>
          normalizeSubject(
            item
          ) ===
          normalizeSubject(
            subject
          )
      );

    if (!subjectAllowed) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not assigned to this subject.",
        },
        {
          status: 403,
        }
      );
    }

    /* ========================================
       TEACHER INFO
    ======================================== */

    const teacherName =
      cleanText(
        teacher.userData
          ?.fullName ||
        teacher.userData
          ?.teacherName ||
        teacher.userData
          ?.name
      );

    const teacherEmail =
      cleanText(
        teacher.userData
          ?.email
      );

    /* ========================================
       SAVE FIRESTORE
    ======================================== */

    const liveClassRef =
      db
        .collection(
          LIVE_CLASS_COLLECTION
        )
        .doc();

    await liveClassRef.set({
      id:
        liveClassRef.id,

      teacherUid,

      teacherName:
        teacherName ||
        null,

      teacherEmail:
        teacherEmail ||
        null,

      title,

      subject,

      className,

      date,

      startTime,

      endTime,

      meetLink,

      description:
        description ||
        null,

      status:
        "upcoming",

      platform:
        "google_meet",

      liveClassType:
        "digital_class",

      createdBy:
        teacherUid,

      createdAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    /* ========================================
       SUCCESS
    ======================================== */

    return NextResponse.json(
      {
        success: true,

        message:
          "Live Class scheduled successfully.",

        liveClass: {
          id:
            liveClassRef.id,

          teacherUid,

          title,

          subject,

          className,

          date,

          startTime,

          endTime,

          meetLink,

          description,

          status:
            "upcoming",
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "SCHEDULE DIGITAL LIVE CLASS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to schedule Live Class.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(
  request,
  { params }
) {
  try {
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

    const auth =
      getAdminAuth();

    const db =
      getAdminDb();

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

    const snapshot =
      await db
        .collection(
          LIVE_CLASS_COLLECTION
        )
        .where(
          "teacherUid",
          "==",
          teacherUid
        )
        .get();

        /* ========================================
   AUTO UPDATE FIRESTORE STATUS
======================================== */

const now =
  new Date();

const batch =
  db.batch();

let statusChanges =
  0;

snapshot.docs.forEach(
  (document) => {
    const data =
      document.data() || {};

    const newStatus =
      getAutomaticLiveClassStatus(
        data,
        now
      );

    const oldStatus =
      cleanText(
        data.status
      ) ||
      "upcoming";

    if (
      newStatus !==
      oldStatus
    ) {
      batch.update(
        document.ref,
        {
          status:
            newStatus,

          statusUpdatedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        }
      );

      statusChanges += 1;
    }
  }
);

if (statusChanges > 0) {
  await batch.commit();
}

    const classes =
      snapshot.docs
        .map((doc) => {
          const data =
            doc.data() || {};

          const automaticStatus =
  getAutomaticLiveClassStatus(
    data,
    now
  );

return {
  id: doc.id,

  ...data,

  status:
    automaticStatus,

  createdAt:
    data?.createdAt
      ?.toDate?.()
      ?.toISOString?.() ||
    null,

  updatedAt:
    data?.updatedAt
      ?.toDate?.()
      ?.toISOString?.() ||
    null,
};
        })
        .sort((a, b) => {
          const first =
            `${a.date || ""} ${a.startTime || ""}`;

          const second =
            `${b.date || ""} ${b.startTime || ""}`;

          return first.localeCompare(
            second
          );
        });

    return NextResponse.json({
      success: true,
      count: classes.length,
      classes,
    });
  } catch (error) {
    console.error(
      "GET DIGITAL LIVE CLASSES ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Unable to load Live Classes.",
      },
      {
        status: 500,
      }
    );
  }
}

/* ============================================
   DELETE LIVE CLASS
============================================ */

export async function DELETE(
  request,
  { params }
) {
  try {
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

    const auth =
      getAdminAuth();

    const db =
      getAdminDb();

    /* AUTH */

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

    /* BODY */

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

    /* GET CLASS */

    const liveClassRef =
      db
        .collection(
          LIVE_CLASS_COLLECTION
        )
        .doc(classId);

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

    const liveClassData =
      liveClassSnapshot.data() ||
      {};

    /* OWNERSHIP CHECK */

    if (
      cleanText(
        liveClassData.teacherUid
      ) !== teacherUid
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You cannot delete this Live Class.",
        },
        {
          status: 403,
        }
      );
    }

    /* DELETE */

    await liveClassRef.delete();

    return NextResponse.json({
      success: true,

      message:
        "Live Class deleted successfully.",

      classId,
    });
  } catch (error) {
    console.error(
      "DELETE DIGITAL LIVE CLASS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to delete Live Class.",
      },
      {
        status: 500,
      }
    );
  }
}


/* ============================================
   UPDATE LIVE CLASS
============================================ */

export async function PATCH(
  request,
  { params }
) {
  try {
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

    const auth =
      getAdminAuth();

    const db =
      getAdminDb();

    /* AUTH */

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

    /* BODY */

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

    const title =
      cleanText(
        body?.title
      );

    const subject =
      cleanText(
        body?.subject
      );

    const className =
      cleanText(
        body?.className
      );

    const date =
      cleanText(
        body?.date
      );

    const startTime =
      cleanText(
        body?.startTime
      );

    const endTime =
      cleanText(
        body?.endTime
      );

    const meetLink =
      cleanText(
        body?.meetLink
      );

    const description =
      cleanText(
        body?.description
      );

    /* REQUIRED */

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

    if (
      !title ||
      !subject ||
      !className ||
      !date ||
      !startTime ||
      !endTime ||
      !meetLink
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please fill all required Live Class fields.",
        },
        {
          status: 400,
        }
      );
    }

    /* DATE */

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        date
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid class date.",
        },
        {
          status: 400,
        }
      );
    }

    /* TIME */

    const timePattern =
      /^([01]\d|2[0-3]):[0-5]\d$/;

    if (
      !timePattern.test(
        startTime
      ) ||
      !timePattern.test(
        endTime
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid class time.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      endTime <= startTime
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "End time must be after start time.",
        },
        {
          status: 400,
        }
      );
    }

    /* GOOGLE MEET */

    if (
      !isValidGoogleMeetLink(
        meetLink
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please provide a valid Google Meet link.",
        },
        {
          status: 400,
        }
      );
    }

    /* CLASS DOCUMENT */

    const liveClassRef =
      db
        .collection(
          LIVE_CLASS_COLLECTION
        )
        .doc(classId);

    const snapshot =
      await liveClassRef.get();

    if (!snapshot.exists) {
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

    const existingClass =
      snapshot.data() || {};

    /* OWNERSHIP */

    if (
      cleanText(
        existingClass.teacherUid
      ) !== teacherUid
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You cannot edit this Live Class.",
        },
        {
          status: 403,
        }
      );
    }

    /* ASSIGNMENTS */

    const assignment =
      teacher.userData
        ?.digitalTeachingAssignment ||
      {};

    const assignedClasses =
      Array.isArray(
        assignment?.classes
      )
        ? assignment.classes
        : [];

    const assignedSubjects =
      Array.isArray(
        assignment?.subjects
      )
        ? assignment.subjects
        : [];

    const classAllowed =
      assignedClasses.some(
        (item) =>
          normalizeClass(
            item
          ) ===
          normalizeClass(
            className
          )
      );

    if (!classAllowed) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not assigned to this class.",
        },
        {
          status: 403,
        }
      );
    }

    const subjectAllowed =
      assignedSubjects.some(
        (item) =>
          normalizeSubject(
            item
          ) ===
          normalizeSubject(
            subject
          )
      );

    if (!subjectAllowed) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not assigned to this subject.",
        },
        {
          status: 403,
        }
      );
    }

    /* UPDATE */

    await liveClassRef.update({
      title,
      subject,
      className,
      date,
      startTime,
      endTime,
      meetLink,

      description:
        description ||
        null,

      updatedAt:
        FieldValue.serverTimestamp(),

      updatedBy:
        teacherUid,
    });

    return NextResponse.json({
      success: true,

      message:
        "Live Class updated successfully.",

      liveClass: {
        id:
          classId,

        teacherUid,

        title,

        subject,

        className,

        date,

        startTime,

        endTime,

        meetLink,

        description,

        status:
          existingClass.status ||
          "upcoming",
      },
    });
  } catch (error) {
    console.error(
      "UPDATE DIGITAL LIVE CLASS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to update Live Class.",
      },
      {
        status: 500,
      }
    );
  }
}
