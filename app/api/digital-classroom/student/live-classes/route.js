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


function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}


function normalizeClass(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/^class\s*/i, "")
    .replace(/\s+/g, "");
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

  try {
    const token =
      authorization
        .slice(7)
        .trim();

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

    const isDigitalStudent =
      studentData?.role ===
        "student" &&
      studentData?.userType ===
        "digital_student";

    if (!isDigitalStudent) {
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

    const teacherUid =
      cleanText(
        studentData
          ?.assignedDigitalTeacherUid
      );

    const studentClass =
      cleanText(
        studentData
          ?.assignedDigitalTeacherClass ||
        studentData
          ?.applyingclass ||
        studentData
          ?.className ||
        studentData
          ?.class
      );

    if (
      !studentData
        ?.teacherAssigned ||
      !teacherUid
    ) {
      return NextResponse.json({
        success: true,
        teacherAssigned: false,
        classes: [],
        count: 0,
      });
    }

    const snapshot =
      await db
        .collection(
          "digitalClassLiveClasses"
        )
        .where(
          "teacherUid",
          "==",
          teacherUid
        )
        .get();

    const now =
      new Date();

    const batch =
      db.batch();

    let statusChanges = 0;

    const classes =
      snapshot.docs
        .map((document) => {
          const data =
            document.data() ||
            {};

          /*
           * Student sees only
           * his/her assigned class.
           */
          if (
            normalizeClass(
              data?.className
            ) !==
            normalizeClass(
              studentClass
            )
          ) {
            return null;
          }

          const status =
            getAutomaticStatus(
              data,
              now
            );

          if (
            cleanText(
              data?.status
            ) !== status
          ) {
            batch.update(
              document.ref,
              {
                status,

                statusUpdatedAt:
                  FieldValue
                    .serverTimestamp(),

                updatedAt:
                  FieldValue
                    .serverTimestamp(),
              }
            );

            statusChanges += 1;
          }

          return {
            id:
              document.id,

            title:
              data?.title ||
              "",

            subject:
              data?.subject ||
              "",

            className:
              data?.className ||
              "",

            date:
              data?.date ||
              "",

            startTime:
              data?.startTime ||
              "",

            endTime:
              data?.endTime ||
              "",

            meetLink:
              data?.meetLink ||
              "",

            description:
              data?.description ||
              "",

            teacherUid,

            teacherName:
              data?.teacherName ||
              studentData
                ?.assignedDigitalTeacherName ||
              "",

            status,
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const first =
            `${a.date} ${a.startTime}`;

          const second =
            `${b.date} ${b.startTime}`;

          return first.localeCompare(
            second
          );
        });

    if (statusChanges > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,

      teacherAssigned:
        true,

      studentClass,

      teacherUid,

      count:
        classes.length,

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