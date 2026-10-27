import { NextResponse } from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";


const ROOM_COLLECTION =
  "digitalMeetRooms";


/* =========================================================
   HELPERS
========================================================= */

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}


function cleanArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) =>
          cleanText(item)
        )
        .filter(Boolean)
    ),
  ];
}


/* =========================================================
   NORMALIZE CLASS

   Class 3
   class 3
   3

   becomes:
   3
========================================================= */

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


/* =========================================================
   GOOGLE MEET LINK VALIDATION
========================================================= */

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
      url.pathname &&
      url.pathname !== "/"
    );

  } catch {
    return false;
  }
}


/* =========================================================
   NORMALIZE GOOGLE MEET LINK

   These are considered the SAME:

   https://meet.google.com/ABC-DEFG-HIJ
   https://meet.google.com/abc-defg-hij/
   https://meet.google.com/abc-defg-hij?authuser=1

   Output:

   https://meet.google.com/abc-defg-hij
========================================================= */

function normalizeGoogleMeetLink(
  value
) {
  try {
    const url =
      new URL(
        cleanText(value)
      );


    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !==
        "meet.google.com"
    ) {
      return "";
    }


    const path =
      url.pathname
        .replace(
          /^\/+/,
          ""
        )
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();


    if (!path) {
      return "";
    }


    return (
      `https://meet.google.com/${path}`
    );

  } catch {
    return "";
  }
}


/* =========================================================
   EXTRACT MEETING CODE

   https://meet.google.com/abc-defg-hij

   becomes:

   abc-defg-hij
========================================================= */

function getGoogleMeetCode(
  value
) {
  const normalized =
    normalizeGoogleMeetLink(
      value
    );


  if (!normalized) {
    return "";
  }


  try {
    const url =
      new URL(
        normalized
      );


    return url.pathname
      .replace(
        /^\/+/,
        ""
      )
      .replace(
        /\/+$/,
        ""
      )
      .toLowerCase();

  } catch {
    return "";
  }
}


/* =========================================================
   SERIALIZE FIRESTORE VALUES
========================================================= */

function serialize(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }


  if (
    value &&
    typeof value.toDate ===
      "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }


  if (value instanceof Date) {
    return value.toISOString();
  }


  if (
    Array.isArray(value)
  ) {
    return value.map(
      serialize
    );
  }


  if (
    typeof value ===
    "object"
  ) {
    const result = {};


    for (
      const [key, child]
      of Object.entries(value)
    ) {
      result[key] =
        serialize(child);
    }


    return result;
  }


  return value;
}


/* =========================================================
   VERIFY CENTRAL ADMIN
========================================================= */

async function verifyCentralAdmin(
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


    /* =====================================================
       CUSTOM CLAIM ROLE
    ===================================================== */

    if (
      decoded?.role ===
        "central_admin" ||
      decoded?.role ===
        "admin"
    ) {
      return {
        uid:
          decoded.uid,

        decoded,

        role:
          decoded.role,
      };
    }


    /* =====================================================
       USERS DOCUMENT ROLE
    ===================================================== */

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
      userSnapshot.data() ||
      {};


    if (
      userData?.role !==
        "central_admin" &&
      userData?.role !==
        "admin"
    ) {
      return null;
    }


    return {
      uid:
        decoded.uid,

      decoded,

      userData,

      role:
        userData?.role,
    };

  } catch (error) {
    console.error(
      "VERIFY CENTRAL ADMIN GOOGLE MEET ERROR:",
      error
    );


    return null;
  }
}


/* =========================================================
   GET DIGITAL TEACHER NAME
========================================================= */

function getTeacherName(
  teacher
) {
  return cleanText(
    teacher?.fullName ||
    teacher?.teacherName ||
    teacher?.name
  ) ||
  "Digital Teacher";
}


/* =========================================================
   GET DIGITAL TEACHER CLASSES

   Canonical:
   digitalTeachingAssignment.classes

   Legacy fallback retained for old teacher records.
========================================================= */

function getTeacherClasses(
  teacher
) {
  const classes =
    teacher
      ?.digitalTeachingAssignment
      ?.classes ||

    teacher
      ?.teachingAssignment
      ?.classes ||

    [];


  return cleanArray(
    classes
  );
}


/* =========================================================
   CHECK CANONICAL DIGITAL TEACHER
========================================================= */

function isActiveDigitalTeacher(
  teacher
) {
  if (!teacher) {
    return false;
  }


  if (
    teacher?.role !==
    "teacher"
  ) {
    return false;
  }


  /*
   * Canonical Digital Teacher flags.
   */
  if (
    teacher?.digitalTeacher !==
    true
  ) {
    return false;
  }


  if (
    teacher?.digitalClassAccess !==
    true
  ) {
    return false;
  }


  if (
    teacher
      ?.digitalTeacherStatus &&
    teacher
      ?.digitalTeacherStatus !==
      "active"
  ) {
    return false;
  }


  return true;
}


/* =========================================================
   GET
   CENTRAL ADMIN ROOM LIST

   IMPORTANT:

   Central Admin CAN see meetUri.

   This API is already protected by:
   Firebase token + Central Admin role.
========================================================= */

export async function GET(
  request
) {
  try {

    const auth =
      getAdminAuth();


    const db =
      getAdminDb();


    /* =====================================================
       VERIFY ADMIN
    ===================================================== */

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


    /* =====================================================
       LOAD ROOMS
    ===================================================== */

    const snapshot =
      await db
        .collection(
          ROOM_COLLECTION
        )
        .get();


    const rooms =
      snapshot.docs
        .map(
          (document) => {

            const data =
              document.data() ||
              {};


            return {
              id:
                document.id,

              teacherUid:
                data
                  ?.teacherUid ||
                "",

              teacherName:
                data
                  ?.teacherName ||
                "",

              teacherEmail:
                data
                  ?.teacherEmail ||
                "",

              teacherMhrId:
                data
                  ?.teacherMhrId ||
                "",

              className:
                data
                  ?.className ||
                "",

              classKey:
                data
                  ?.classKey ||
                "",


              /*
               * CENTRAL ADMIN ONLY.
               *
               * Teacher / Student APIs
               * must never return this.
               */
              meetUri:
  data?.meetUri ||
  data?.meetUrl ||
  "",

meetCode:
  data?.meetCode ||
  getGoogleMeetCode(
    data?.meetUri ||
    data?.meetUrl
  ) ||
  "",

configured:
  Boolean(
    data?.meetUri ||
    data?.meetUrl
  ),

              provider:
                data
                  ?.provider ||
                "google_meet",


              status:
                data
                  ?.status ||
                "active",


              createdAt:
                serialize(
                  data
                    ?.createdAt
                ),


              updatedAt:
                serialize(
                  data
                    ?.updatedAt
                ),
            };
          }
        )
        .sort(
          (a, b) => {

            const first =
              cleanText(
                a?.teacherName
              );


            const second =
              cleanText(
                b?.teacherName
              );


            const teacherCompare =
              first.localeCompare(
                second
              );


            if (
              teacherCompare !==
              0
            ) {
              return teacherCompare;
            }


            return cleanText(
              a?.className
            ).localeCompare(
              cleanText(
                b?.className
              ),
              undefined,
              {
                numeric: true,
              }
            );
          }
        );


    return NextResponse.json(
      {
        success: true,

        rooms,

        count:
          rooms.length,
      },
      {
        status: 200,
      }
    );

  } catch (error) {

    console.error(
      "GET DIGITAL GOOGLE MEET ROOMS ERROR:",
      {
        message:
          error?.message,

        code:
          error?.code,

        stack:
          error?.stack,
      }
    );


    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to load Google Meet rooms.",

        code:
          error?.code ||
          null,
      },
      {
        status: 500,
      }
    );
  }
}


/* =========================================================
   POST

   CREATE / REPLACE PRIVATE GOOGLE MEET ROOM

   BODY:

   {
     teacherUid: "...",
     className: "Class 3",
     meetLink: "https://meet.google.com/abc-defg-hij"
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
       VERIFY CENTRAL ADMIN
    ===================================================== */

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


    const teacherUid =
      cleanText(
        body
          ?.teacherUid
      );


    const className =
      cleanText(
        body
          ?.className
      );


    const rawMeetLink =
      cleanText(
        body
          ?.meetLink
      );


    /* =====================================================
       BASIC VALIDATION
    ===================================================== */

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


    if (!className) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Class is required.",
        },
        {
          status: 400,
        }
      );
    }


    if (!rawMeetLink) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Google Meet link is required.",
        },
        {
          status: 400,
        }
      );
    }


    if (
      !isGoogleMeetLink(
        rawMeetLink
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Please enter a valid Google Meet link.",
        },
        {
          status: 400,
        }
      );
    }


    /* =====================================================
       NORMALIZE GOOGLE MEET URL
    ===================================================== */

    const normalizedMeetLink =
      normalizeGoogleMeetLink(
        rawMeetLink
      );


    if (
      !normalizedMeetLink
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Please enter a valid Google Meet link.",
        },
        {
          status: 400,
        }
      );
    }


    const meetCode =
      getGoogleMeetCode(
        normalizedMeetLink
      );


    if (!meetCode) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Unable to detect Google Meet code.",
        },
        {
          status: 400,
        }
      );
    }


    /* =====================================================
       LOAD DIGITAL TEACHER

       Canonical source:
       users/{teacherUid}
    ===================================================== */

    const teacherRef =
      db
        .collection("users")
        .doc(teacherUid);


    const teacherSnapshot =
      await teacherRef.get();


    if (
      !teacherSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Digital Teacher user account not found.",
        },
        {
          status: 404,
        }
      );
    }


    const teacher =
      teacherSnapshot.data() ||
      {};


    /* =====================================================
       VERIFY DIGITAL TEACHER
    ===================================================== */

    if (
      !isActiveDigitalTeacher(
        teacher
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Selected teacher is not an active Digital Teacher.",
        },
        {
          status: 400,
        }
      );
    }


    /* =====================================================
       CHECK CLASS IS ASSIGNED TO THIS TEACHER
    ===================================================== */

    const assignedClasses =
      getTeacherClasses(
        teacher
      );


    const requestedClassKey =
      normalizeClass(
        className
      );


    if (
      !requestedClassKey
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Invalid class.",
        },
        {
          status: 400,
        }
      );
    }


    const matchedTeacherClass =
      assignedClasses.find(
        (
          teacherClass
        ) =>
          normalizeClass(
            teacherClass
          ) ===
          requestedClassKey
      );


    if (
      !matchedTeacherClass
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `${className} is not assigned to this Digital Teacher.`,
        },
        {
          status: 400,
        }
      );
    }


    /*
     * Store the original assigned class
     * value rather than arbitrary request
     * formatting.
     */
    const finalClassName =
      cleanText(
        matchedTeacherClass
      );


    /* =====================================================
       TEACHER INFORMATION
    ===================================================== */

    const teacherName =
      getTeacherName(
        teacher
      );


    const teacherEmail =
      cleanText(
        teacher
          ?.email ||
        teacher
          ?.digitalTeacherEmail
      );


    const teacherMhrId =
      cleanText(
        teacher
          ?.mhrId ||
        teacher
          ?.teacherId
      );


    /* =====================================================
       ROOM DOCUMENT ID

       One teacher + one class
       has exactly one room document.

       Example:

       USER_UID__3
    ===================================================== */

    const roomId =
      `${teacherUid}__${requestedClassKey}`;


    const roomRef =
      db
        .collection(
          ROOM_COLLECTION
        )
        .doc(
          roomId
        );


    /* =====================================================
       DUPLICATE MEET LINK CHECK

       IMPORTANT:

       SAME room document:
       allowed to save same URL again.

       DIFFERENT teacher/class:
       same Meet link is BLOCKED.
    ===================================================== */

    const roomsSnapshot =
      await db
        .collection(
          ROOM_COLLECTION
        )
        .get();


    let duplicateRoom =
      null;


    for (
      const document
      of roomsSnapshot.docs
    ) {

      /*
       * Current teacher + class
       * document can keep its
       * own existing URL.
       */
      if (
        document.id ===
        roomId
      ) {
        continue;
      }


      const room =
        document.data() ||
        {};


      const existingMeetLink =
        normalizeGoogleMeetLink(
          room
            ?.meetUri ||
          room
            ?.meetKey
        );


      if (
        !existingMeetLink
      ) {
        continue;
      }


      if (
        existingMeetLink ===
        normalizedMeetLink
      ) {
        duplicateRoom = {
          id:
            document.id,

          ...room,
        };

        break;
      }
    }


    /* =====================================================
       DUPLICATE FOUND
    ===================================================== */

    if (
      duplicateRoom
    ) {

      const duplicateTeacherName =
        cleanText(
          duplicateRoom
            ?.teacherName
        ) ||
        "another Digital Teacher";


      const duplicateClassName =
        cleanText(
          duplicateRoom
            ?.className
        ) ||
        "another class";


      return NextResponse.json(
        {
          success: false,

          message:
            `This Google Meet link is already assigned to ${duplicateTeacherName} - ${duplicateClassName}. Please use a different Google Meet link.`,

          duplicate: {
            roomId:
              duplicateRoom
                ?.id ||
              "",

            teacherUid:
              duplicateRoom
                ?.teacherUid ||
              "",

            teacherName:
              duplicateTeacherName,

            className:
              duplicateClassName,
          },
        },
        {
          /*
           * 409 = conflict
           */
          status: 409,
        }
      );
    }


    /* =====================================================
       CHECK EXISTING CURRENT ROOM
    ===================================================== */

    const existingSnapshot =
      await roomRef.get();


    const existingData =
      existingSnapshot.exists
        ? existingSnapshot.data() ||
          {}
        : {};


    const now =
      new Date();


    /* =====================================================
       SAVE ROOM

       meetUri is private data.
    ===================================================== */

    await roomRef.set(
      {
        teacherUid,

        teacherName,

        teacherEmail,

        teacherMhrId,


        className:
          finalClassName,

        classKey:
          requestedClassKey,


        /*
         * PRIVATE GOOGLE MEET URL
         */
        meetUri:
          normalizedMeetLink,


        /*
         * Normalized duplicate-check key.
         */
        meetKey:
          normalizedMeetLink,


        meetCode,


        provider:
          "google_meet",


        status:
          "active",


        /*
         * Preserve original creator/date
         * when replacing a link.
         */
        createdAt:
          existingData
            ?.createdAt ||
          now,


        createdBy:
          existingData
            ?.createdBy ||
          admin.uid,


        updatedAt:
          now,


        updatedBy:
          admin.uid,
      },
      {
        merge: true,
      }
    );


    /* =====================================================
       SUCCESS RESPONSE

       Central Admin is allowed to see URL.
    ===================================================== */

    return NextResponse.json(
      {
        success: true,


        message:
          existingSnapshot.exists

            ? "Google Meet room updated successfully."

            : "Google Meet room assigned successfully.",


        room: {
          id:
            roomId,

          teacherUid,

          teacherName,

          teacherEmail,

          teacherMhrId,

          className:
            finalClassName,

          classKey:
            requestedClassKey,


          /*
           * CENTRAL ADMIN response.
           */
          meetUri:
            normalizedMeetLink,

          meetCode,


          configured:
            true,

          provider:
            "google_meet",

          status:
            "active",
        },
      },
      {
        status:
          existingSnapshot.exists
            ? 200
            : 201,
      }
    );

  } catch (error) {

    console.error(
      "SAVE DIGITAL GOOGLE MEET ROOM ERROR:",
      {
        message:
          error?.message,

        code:
          error?.code,

        stack:
          error?.stack,
      }
    );


    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to assign Google Meet room.",

        code:
          error?.code ||
          null,
      },
      {
        status: 500,
      }
    );
  }
}