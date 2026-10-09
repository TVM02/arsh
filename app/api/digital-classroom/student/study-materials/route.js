import {
  NextResponse,
} from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


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
    );
}


function serializeDate(value) {
  if (!value) {
    return null;
  }

  try {
    if (
      typeof value?.toDate ===
      "function"
    ) {
      return value
        .toDate()
        .toISOString();
    }

    return new Date(
      value
    ).toISOString();
  } catch {
    return null;
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
   GET STUDENT STUDY MATERIALS
========================================================= */

export async function GET(
  request
) {
  try {
    const auth =
      getAdminAuth();

    const db =
      getAdminDb();


    /* ==============================
       VERIFY STUDENT
    ============================== */

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


    /* ==============================
       ASSIGNED TEACHER
    ============================== */

    const teacherUid =
      cleanText(
        studentData
          ?.assignedDigitalTeacherUid
      );


    /* ==============================
       STUDENT CLASS
    ============================== */

    const studentClass =
      cleanText(
        studentData
          ?.assignedDigitalTeacherClass ||

        studentData
          ?.applyingclass ||

        studentData
          ?.classLevel ||

        studentData
          ?.className ||

        studentData
          ?.class
      );


    /* ==============================
       NO TEACHER ASSIGNED
    ============================== */

    if (
      studentData
        ?.teacherAssigned !==
        true ||
      !teacherUid
    ) {
      return NextResponse.json({
        success: true,

        teacherAssigned:
          false,

        studentClass,

        materials: [],

        count: 0,
      });
    }


    /* ==============================
       LOAD TEACHER MATERIALS
    ============================== */

    const snapshot =
      await db
        .collection(
          "digitalStudyMaterials"
        )
        .where(
          "teacherUid",
          "==",
          teacherUid
        )
        .get();


    /* ==============================
       FILTER STUDENT CLASS
    ============================== */

    const materials =
      snapshot.docs
        .map(
          (document) => {
            const data =
              document.data() ||
              {};


            /*
             * Only active
             * materials.
             */

            if (
              cleanText(
                data?.status
              ).toLowerCase() !==
              "active"
            ) {
              return null;
            }


            /*
             * Material must
             * belong to the
             * student's class.
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


            return {
              id:
                document.id,

              title:
                data?.title ||
                "Untitled Material",

              subject:
                data?.subjectName ||
                data?.subject ||
                "",

              subjectName:
                data?.subjectName ||
                "",

              className:
                data?.className ||
                "",

              materialType:
                data?.materialType ||
                data?.type ||
                "",

              type:
                data?.materialType ||
                data?.type ||
                "",

              teacherUid:
                data?.teacherUid ||
                teacherUid,

              teacherName:
                data?.ustadName ||
                studentData
                  ?.assignedDigitalTeacherName ||
                "",

              ustadName:
                data?.ustadName ||
                studentData
                  ?.assignedDigitalTeacherName ||
                "",

              description:
                data?.description ||
                "",

              fileUrl:
                data?.fileUrl ||
                null,

              fileName:
                data?.fileName ||
                null,

              fileSize:
                data?.fileSize ||
                null,

              youtubeUrl:
                data?.youtubeUrl ||
                null,

              downloads:
                Number(
                  data?.downloads ||
                  0
                ),

              status:
                data?.status ||
                "active",

              createdAt:
                serializeDate(
                  data?.createdAt
                ),

              updatedAt:
                serializeDate(
                  data?.updatedAt
                ),
            };
          }
        )
        .filter(Boolean)
        .sort(
          (a, b) => {
            const first =
              new Date(
                a?.createdAt ||
                  0
              ).getTime();

            const second =
              new Date(
                b?.createdAt ||
                  0
              ).getTime();

            return (
              second -
              first
            );
          }
        );


    /* ==============================
       RESPONSE
    ============================== */

    return NextResponse.json({
      success: true,

      teacherAssigned:
        true,

      teacherUid,

      teacherName:
        studentData
          ?.assignedDigitalTeacherName ||
        "",

      studentClass,

      count:
        materials.length,

      materials,
    });
  } catch (error) {
    console.error(
      "GET DIGITAL STUDENT STUDY MATERIALS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to load Study Materials.",
      },
      {
        status: 500,
      }
    );
  }
}