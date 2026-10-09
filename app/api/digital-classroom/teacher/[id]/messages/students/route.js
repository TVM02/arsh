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

const MESSAGE_COLLECTION =
  "digitalTeacherStudentMessages";

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeClass(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^class\s*/i, "")
    .trim();
}
function getStudentClass(
  student
) {
  return cleanText(
    student
      ?.applyingclass ||
      student
        ?.assignedDigitalTeacherClass ||
      student?.className ||
      student?.studentClass ||
      student?.class
  );
}

function getStudentName(
  student
) {
  return cleanText(
    student?.name ||
      student?.studentName ||
      student?.fullName ||
      student?.fullname ||
      student?.studentFullName ||
      student?.profileName
  );
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

    if (
      cleanText(decoded.uid) !==
      cleanText(teacherUid)
    ) {
      return null;
    }

    const teacherSnapshot =
      await db
        .collection("users")
        .doc(decoded.uid)
        .get();

    if (
      !teacherSnapshot.exists
    ) {
      return null;
    }

    const userData =
      teacherSnapshot.data() || {};

    const validTeacher =
      userData.role ===
        "teacher" &&
      userData.digitalTeacher ===
        true &&
      userData.digitalClassAccess ===
        true &&
      (
        !userData.digitalTeacherStatus ||
        userData.digitalTeacherStatus ===
          "active"
      );

    if (!validTeacher) {
      return null;
    }

    return {
      uid:
        decoded.uid,

      userData,
    };
  } catch (error) {
    console.error(
      "VERIFY DIGITAL TEACHER ERROR:",
      error
    );

    return null;
  }
}

/* =========================================================
   GET TEACHER'S ASSIGNED DIGITAL STUDENTS
========================================================= */

async function getAssignedStudents(
  db,
  teacherUid
) {
  const snapshot =
    await db
      .collection("users")
      .where(
        "assignedDigitalTeacherUid",
        "==",
        teacherUid
      )
      .get();

  return snapshot.docs
    .map((doc) => ({
      uid:
        doc.id,

      ...doc.data(),
    }))
    .filter((student) => {
      return (
        student.role ===
          "student" &&
        student.userType ===
          "digital_student" &&
        student.teacherAssigned ===
          true
      );
    });
}

/* =========================================================
   SEND MESSAGE
========================================================= */

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
       VERIFY TEACHER
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

    const message =
      cleanText(
        body?.message
      );

    const recipientType =
      cleanText(
        body?.recipientType
      );

    const className =
      cleanText(
        body?.className
      );

    const studentUid =
      cleanText(
        body?.studentUid
      );

    /* ========================================
       VALIDATE MESSAGE
    ======================================== */

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Message title is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Message is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (title.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Message title cannot exceed 100 characters.",
        },
        {
          status: 400,
        }
      );
    }

    if (message.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Message cannot exceed 1000 characters.",
        },
        {
          status: 400,
        }
      );
    }

    const allowedRecipientTypes =
      [
        "all",
        "class",
        "student",
      ];

    if (
      !allowedRecipientTypes.includes(
        recipientType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid recipient type.",
        },
        {
          status: 400,
        }
      );
    }

    /* ========================================
       LOAD ASSIGNED STUDENTS
    ======================================== */

    const assignedStudents =
      await getAssignedStudents(
        db,
        teacherUid
      );

    if (
      assignedStudents.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No Digital Students are assigned to you.",
        },
        {
          status: 400,
        }
      );
    }

    let recipients = [];

    let recipientName = "";

    let finalClassName = null;

    let recipientStudentUid =
      null;

    /* ========================================
       ALL ASSIGNED STUDENTS
    ======================================== */

    if (
      recipientType ===
      "all"
    ) {
      recipients =
        assignedStudents;

      recipientName =
        "All Assigned Students";

      finalClassName =
        null;
    }

    /* ========================================
       CLASS STUDENTS
    ======================================== */

    if (
      recipientType ===
      "class"
    ) {
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

      recipients =
        assignedStudents.filter(
          (student) =>
           normalizeClass(
  getStudentClass(
    student
  )
) ===
normalizeClass(
  className
)
        );

      if (
        recipients.length ===
        0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "No assigned Digital Students found in this class.",
          },
          {
            status: 400,
          }
        );
      }

      recipientName =
        `${className} - All Students`;

      finalClassName =
        className;
    }



if (
  recipientType ===
  "student"
) {
  if (!studentUid) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Student UID is required.",
      },
      {
        status: 400,
      }
    );
  }

  const student =
    assignedStudents.find(
      (item) =>
        cleanText(
          item.uid
        ) ===
        studentUid
    );

  if (!student) {
    return NextResponse.json(
      {
        success: false,
        message:
          "This Digital Student is not assigned to you.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * IMPORTANT:
   * Only put the student
   * into recipients here.
   *
   * recipientStudentUids
   * will be created later.
   */

  recipients = [
    student,
  ];

  recipientStudentUid =
    student.uid;

  recipientName =
    getStudentName(
      student
    ) ||
    "Digital Student";

  finalClassName =
    getStudentClass(
      student
    ) ||
    className ||
    null;
}
    /* ========================================
       RECIPIENT UIDS
    ======================================== */

    const recipientStudentUids =
      recipients
        .map(
          (student) =>
            cleanText(
              student.uid
            )
        )
        .filter(Boolean);

    if (
      recipientStudentUids.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No valid recipients found.",
        },
        {
          status: 400,
        }
      );
    }

    /* ========================================
       TEACHER NAME
    ======================================== */

    const teacherName =
      cleanText(
        teacher.userData?.name ||
          teacher.userData
            ?.teacherName ||
          teacher.userData
            ?.displayName
      ) ||
      "Digital Teacher";

    /* ========================================
       CREATE MESSAGE
    ======================================== */

    const messageRef =
      db
        .collection(
          MESSAGE_COLLECTION
        )
        .doc();

    const messageData = {
      id:
        messageRef.id,

      teacherUid,

      teacherName,

      teacherEmail:
        cleanText(
          teacher.userData?.email
        ) ||
        null,

      title,

      message,

      recipientType,

      recipientStudentUid,

      recipientStudentUids,

      recipientName,

      className:
        finalClassName,

      recipientCount:
        recipientStudentUids.length,

      senderType:
        "digital_teacher",

      status:
        "sent",

      createdBy:
        teacherUid,

      createdAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    };

    await messageRef.set(
      messageData
    );

    /* ========================================
       RESPONSE
    ======================================== */

    return NextResponse.json({
      success: true,

      message:
        "Message sent successfully.",

      sentMessage: {
        id:
          messageRef.id,

        teacherUid,

        teacherName,

        title,

        message,

        recipientType,

        recipientStudentUid,

        recipientStudentUids,

        recipientName,

        className:
          finalClassName,

        recipientCount:
          recipientStudentUids.length,

        senderType:
          "digital_teacher",

        status:
          "sent",

        createdAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "SEND DIGITAL STUDENT MESSAGE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to send message.",
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

    /* ========================================
       VERIFY DIGITAL TEACHER
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
       LOAD THIS TEACHER'S SENT MESSAGES
    ======================================== */

    const snapshot =
      await db
        .collection(
          MESSAGE_COLLECTION
        )
        .where(
          "teacherUid",
          "==",
          teacherUid
        )
        .get();

    const messages =
      snapshot.docs
        .map((doc) => {
          const data =
            doc.data() || {};

          let createdAt =
            null;

          if (
            data.createdAt &&
            typeof data.createdAt
              .toDate ===
              "function"
          ) {
            createdAt =
              data.createdAt
                .toDate()
                .toISOString();
          } else if (
            data.createdAt
              ?.seconds
          ) {
            createdAt =
              new Date(
                data.createdAt
                  .seconds *
                  1000
              ).toISOString();
          }

          return {
            id:
              doc.id,

            title:
              cleanText(
                data.title
              ),

            message:
              cleanText(
                data.message
              ),

            recipientType:
              cleanText(
                data.recipientType
              ),

            recipientStudentUid:
              data
                .recipientStudentUid ||
              null,

            recipientStudentUids:
              Array.isArray(
                data
                  .recipientStudentUids
              )
                ? data
                    .recipientStudentUids
                : [],

            recipientName:
              cleanText(
                data.recipientName
              ),

            className:
              cleanText(
                data.className
              ),

            recipientCount:
              Number(
                data.recipientCount ||
                  0
              ),

            senderType:
              cleanText(
                data.senderType
              ),

            status:
              cleanText(
                data.status
              ) ||
              "sent",

            createdAt,
          };
        })
        .sort(
          (a, b) => {
            const first =
              a.createdAt
                ? new Date(
                    a.createdAt
                  ).getTime()
                : 0;

            const second =
              b.createdAt
                ? new Date(
                    b.createdAt
                  ).getTime()
                : 0;

            return (
              second -
              first
            );
          }
        );

    /* ========================================
       SUCCESS
    ======================================== */

    return NextResponse.json({
      success: true,

      count:
        messages.length,

      messages,
    });
  } catch (error) {
    console.error(
      "GET DIGITAL TEACHER SENT MESSAGES ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to load sent messages.",
      },
      {
        status: 500,
      }
    );
  }
}


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

    /* ========================================
       VERIFY DIGITAL TEACHER
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

    const messageId =
      cleanText(
        body?.messageId
      );

    if (!messageId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Message ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    /* ========================================
       GET MESSAGE
    ======================================== */

    const messageRef =
      db
        .collection(
          MESSAGE_COLLECTION
        )
        .doc(messageId);

    const messageSnapshot =
      await messageRef.get();

    if (
      !messageSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Message not found.",
        },
        {
          status: 404,
        }
      );
    }

    const messageData =
      messageSnapshot.data() || {};

    /* ========================================
       VERIFY OWNERSHIP
    ======================================== */

    if (
      cleanText(
        messageData.teacherUid
      ) !== teacherUid
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You cannot delete this message.",
        },
        {
          status: 403,
        }
      );
    }

    /* ========================================
       DELETE
    ======================================== */

    await messageRef.delete();

    return NextResponse.json({
      success: true,

      message:
        "Message deleted successfully.",

      messageId,
    });
  } catch (error) {
    console.error(
      "DELETE DIGITAL TEACHER MESSAGE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to delete message.",
      },
      {
        status: 500,
      }
    );
  }
}