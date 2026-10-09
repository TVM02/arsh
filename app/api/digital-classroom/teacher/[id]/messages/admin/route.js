import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value) {
  return String(value ?? "").trim();
}

function toISOString(value) {
  if (!value) {
    return null;
  }

  try {
    if (
      typeof value.toDate ===
      "function"
    ) {
      return value
        .toDate()
        .toISOString();
    }

    if (
      typeof value.seconds ===
      "number"
    ) {
      return new Date(
        value.seconds * 1000
      ).toISOString();
    }

    const parsed =
      new Date(value);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return null;
    }

    return parsed.toISOString();
  } catch {
    return null;
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
      "VERIFY DIGITAL TEACHER MESSAGE ERROR:",
      error
    );

    return null;
  }
}

/* =========================================================
   GET CENTRAL ADMIN MESSAGES
========================================================= */

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
       LOAD CENTRAL ADMIN NOTICES
    ======================================== */

    const noticeSnapshot =
      await db
        .collection("notices")
        .where(
          "sender",
          "==",
          "central_admin"
        )
        .get();

    const now =
      new Date();

    const notices =
      noticeSnapshot.docs
        .map((doc) => {
          const data =
            doc.data() || {};

          return {
            id: doc.id,
            ...data,
          };
        })
        .filter((notice) => {
          /*
           * Only Digital Teacher
           * or All audience
           */

          const audience =
            cleanText(
              notice.targetAudience
            ).toLowerCase();

          const validAudience =
            audience ===
              "digitalteacher" ||
            audience === "all";

          if (!validAudience) {
            return false;
          }

          /*
           * Inactive notice
           */

          if (
            notice.isActive ===
            false
          ) {
            return false;
          }

          /*
           * Expired notice
           */

          if (
            notice.expiryDate
          ) {
            let expiryDate = null;

            try {
              if (
                typeof notice
                  .expiryDate
                  ?.toDate ===
                "function"
              ) {
                expiryDate =
                  notice.expiryDate.toDate();
              } else if (
                typeof notice
                  .expiryDate
                  ?.seconds ===
                "number"
              ) {
                expiryDate =
                  new Date(
                    notice.expiryDate
                      .seconds *
                      1000
                  );
              } else {
                expiryDate =
                  new Date(
                    notice.expiryDate
                  );
              }
            } catch {
              expiryDate =
                null;
            }

            if (
              expiryDate &&
              !Number.isNaN(
                expiryDate.getTime()
              ) &&
              expiryDate < now
            ) {
              return false;
            }
          }

          return true;
        });

    /* ========================================
       LOAD THIS TEACHER'S READ STATUS
    ======================================== */

    const readSnapshot =
      await db
        .collection(
          "digitalTeacherNoticeReads"
        )
        .where(
          "teacherUid",
          "==",
          teacherUid
        )
        .get();

    const readMap = {};

    readSnapshot.docs.forEach(
      (doc) => {
        const data =
          doc.data() || {};

        if (data.noticeId) {
          readMap[
            data.noticeId
          ] =
            data.read === true;
        }
      }
    );

    /* ========================================
       FORMAT RESPONSE
    ======================================== */

    const messages =
      notices
        .map((notice) => {
          const createdAt =
            toISOString(
              notice.createdAt
            );

          return {
            id:
              notice.id,

            title:
              cleanText(
                notice.title
              ),

            message:
              cleanText(
                notice.content
              ),

            senderName:
              cleanText(
                notice.createdByName
              ) ||
              "Central Admin",

            priority:
              notice.priority ===
              "high"
                ? "important"
                : "normal",

            read:
              readMap[
                notice.id
              ] === true,

            createdAt,

            expiryDate:
              toISOString(
                notice.expiryDate
              ),

            targetAudience:
              notice.targetAudience,

            showOnDashboard:
              notice.showOnDashboard ===
              true,
          };
        })
        .sort((a, b) => {
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

          return second - first;
        });

    /* ========================================
       SUCCESS
    ======================================== */

    return NextResponse.json({
      success: true,

      count:
        messages.length,

      unreadCount:
        messages.filter(
          (message) =>
            !message.read
        ).length,

      messages,
    });
  } catch (error) {
    console.error(
      "GET DIGITAL TEACHER ADMIN MESSAGES ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to load Central Admin messages.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   MARK CENTRAL ADMIN MESSAGE AS READ
========================================================= */

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
       REQUEST BODY
    ======================================== */

    let body = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    const noticeId =
      cleanText(
        body?.noticeId
      );

    if (!noticeId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Notice ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    /* ========================================
       VERIFY NOTICE EXISTS
    ======================================== */

    const noticeRef =
      db
        .collection("notices")
        .doc(noticeId);

    const noticeSnapshot =
      await noticeRef.get();

    if (
      !noticeSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Central Admin message not found.",
        },
        {
          status: 404,
        }
      );
    }

    const notice =
      noticeSnapshot.data() || {};

    /* ========================================
       VERIFY CENTRAL ADMIN MESSAGE
    ======================================== */

    if (
      cleanText(
        notice.sender
      ).toLowerCase() !==
      "central_admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid Central Admin message.",
        },
        {
          status: 403,
        }
      );
    }

    /* ========================================
       VERIFY AUDIENCE
    ======================================== */

    const audience =
      cleanText(
        notice.targetAudience
      ).toLowerCase();

    const allowedAudience =
      audience ===
        "digitalteacher" ||
      audience === "all";

    if (!allowedAudience) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have access to this message.",
        },
        {
          status: 403,
        }
      );
    }

    /* ========================================
       VERIFY ACTIVE
    ======================================== */

    if (
      notice.isActive ===
      false
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This message is no longer active.",
        },
        {
          status: 403,
        }
      );
    }

    /* ========================================
       VERIFY NOT EXPIRED
    ======================================== */

    if (notice.expiryDate) {
      let expiryDate = null;

      try {
        if (
          typeof notice
            .expiryDate
            ?.toDate ===
          "function"
        ) {
          expiryDate =
            notice.expiryDate.toDate();
        } else if (
          typeof notice
            .expiryDate
            ?.seconds ===
          "number"
        ) {
          expiryDate =
            new Date(
              notice.expiryDate
                .seconds * 1000
            );
        } else {
          expiryDate =
            new Date(
              notice.expiryDate
            );
        }
      } catch {
        expiryDate = null;
      }

      if (
        expiryDate &&
        !Number.isNaN(
          expiryDate.getTime()
        ) &&
        expiryDate <
          new Date()
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This message has expired.",
          },
          {
            status: 403,
          }
        );
      }
    }

    /* ========================================
       SAVE READ STATUS

       One document for:
       one teacher + one notice
    ======================================== */

    const readDocumentId =
      `${teacherUid}_${noticeId}`;

    const readRef =
      db
        .collection(
          "digitalTeacherNoticeReads"
        )
        .doc(
          readDocumentId
        );

    await readRef.set(
      {
        teacherUid,

        noticeId,

        read: true,

        readAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    /* ========================================
       SUCCESS
    ======================================== */

    return NextResponse.json({
      success: true,

      message:
        "Message marked as read.",

      noticeId,

      read: true,
    });
  } catch (error) {
    console.error(
      "MARK DIGITAL TEACHER ADMIN MESSAGE READ ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to mark message as read.",
      },
      {
        status: 500,
      }
    );
  }
}