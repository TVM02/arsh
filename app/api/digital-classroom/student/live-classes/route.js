import { NextResponse } from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";


const LIVE_CLASS_COLLECTION =
  "digitalClassLiveClasses";


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
    .replace(/[^a-z0-9_-]/g, "");
}


function getAutomaticStatus(
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


function getCanJoin(
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
    return false;
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
    return false;
  }


  const joinOpenTime =
    new Date(
      startDate.getTime() -
      5 * 60 * 1000
    );


  return (
    now >= joinOpenTime &&
    now <= endDate
  );
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
      "VERIFY DIGITAL STUDENT ERROR:",
      error
    );


    return null;
  }
}


/* =========================================================
   GET STUDENT LIVE CLASSES
========================================================= */

export async function GET(
  request
) {
  try {

    const auth =
      getAdminAuth();


    const db =
      getAdminDb();


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
       STUDENT MUST HAVE ASSIGNED USTAD
    ===================================================== */

    if (
      studentData
        ?.teacherAssigned !==
        true
    ) {

      return NextResponse.json({
        success: true,

        count: 0,

        classes: [],

        message:
          "No Digital Teacher is assigned.",
      });
    }


    const teacherUid =
      cleanText(
        studentData
          ?.assignedDigitalTeacherUid
      );


    const studentClass =
      cleanText(
        studentData
          ?.assignedDigitalTeacherClass
      );


    const studentClassKey =
      normalizeClass(
        studentClass
      );


    if (
      !teacherUid ||
      !studentClassKey
    ) {

      return NextResponse.json({
        success: true,

        count: 0,

        classes: [],

        message:
          "Digital Teacher or class assignment is incomplete.",
      });
    }


    /* =====================================================
       LOAD ONLY ASSIGNED USTAD'S CLASSES
    ===================================================== */

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


    const now =
      new Date();


    const classes =
      snapshot.docs
        .map((doc) => {

          const data =
            doc.data() ||
            {};


          /*
           * Student must see only
           * their assigned class.
           */
          if (
            normalizeClass(
              data?.className
            ) !==
            studentClassKey
          ) {
            return null;
          }


          const status =
            getAutomaticStatus(
              data,
              now
            );


          const canJoin =
            getCanJoin(
              data,
              now
            );


          /*
           * SAFE RESPONSE ONLY.
           *
           * Never return:
           * meetUri
           * meetLink
           * meetRoomId
           */
          return {
            id:
              doc.id,

            title:
              cleanText(
                data?.title
              ),

            subject:
              cleanText(
                data?.subject
              ),

            className:
              cleanText(
                data?.className
              ),

            date:
              cleanText(
                data?.date
              ),

            startTime:
              cleanText(
                data?.startTime
              ),

            endTime:
              cleanText(
                data?.endTime
              ),

            description:
              cleanText(
                data?.description
              ) ||
              null,

            teacherName:
              cleanText(
                data?.teacherName ||
                studentData
                  ?.assignedDigitalTeacherName
              ) ||
              null,

            status,

            canJoin,

            meetConfigured:
              Boolean(
                data?.meetRoomId ||
                data?.meetConfigured
              ),
          };
        })
        .filter(Boolean)
        .sort(
          (a, b) => {

            const first =
              `${a.date} ${a.startTime}`;

            const second =
              `${b.date} ${b.startTime}`;


            return first.localeCompare(
              second
            );
          }
        );


    return NextResponse.json({
      success: true,

      count:
        classes.length,

      teacher: {
        name:
          cleanText(
            studentData
              ?.assignedDigitalTeacherName
          ) ||
          null,

        className:
          studentClass,
      },

      classes,
    });

  } catch (error) {

    console.error(
      "GET DIGITAL STUDENT LIVE CLASSES ERROR:",
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