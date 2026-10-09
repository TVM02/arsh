import {
  NextResponse,
} from "next/server";

import {
  getAdminApp,
  getAdminAuth,
} from "@/lib/firebase-admin";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


const TEACHER_MESSAGES_COLLECTION =
  "digitalTeacherStudentMessages";

const STUDENT_READS_COLLECTION =
  "digitalStudentMessageReads";


/* =========================================================
   HELPERS
========================================================= */

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}


function normalizeValue(value) {
  return cleanText(value)
    .toLowerCase();
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


function toMillis(value) {
  if (!value) {
    return 0;
  }

  try {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return 0;
    }

    return date.getTime();
  } catch {
    return 0;
  }
}


/* =========================================================
   FIRESTORE REST
========================================================= */

function getProjectId() {
  const app =
    getAdminApp();

  const projectId =
    cleanText(
      process.env
        .NEXT_FIREBASE_PROJECT_ID ||
      app?.options?.projectId
    );

  if (!projectId) {
    throw new Error(
      "Firebase project ID is missing."
    );
  }

  return projectId;
}


function getFirestoreBaseUrl() {
  const projectId =
    getProjectId();

  return (
    "https://firestore.googleapis.com/v1/" +
    `projects/${encodeURIComponent(
      projectId
    )}/databases/(default)/documents`
  );
}


async function getServiceAccessToken() {
  const app =
    getAdminApp();

  const credential =
    app?.options?.credential;

  if (
    !credential ||
    typeof credential
      .getAccessToken !==
      "function"
  ) {
    throw new Error(
      "Firebase Admin credential is unavailable."
    );
  }

  const result =
    await credential
      .getAccessToken();

  const accessToken =
    cleanText(
      result?.access_token
    );

  if (!accessToken) {
    throw new Error(
      "Unable to create Firebase service access token."
    );
  }

  return accessToken;
}


/* =========================================================
   FIRESTORE VALUE DECODER
========================================================= */

function decodeFirestoreValue(
  value
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return null;
  }

  if (
    "nullValue" in value
  ) {
    return null;
  }

  if (
    "stringValue" in value
  ) {
    return value.stringValue;
  }

  if (
    "booleanValue" in value
  ) {
    return value.booleanValue;
  }

  if (
    "integerValue" in value
  ) {
    return Number(
      value.integerValue
    );
  }

  if (
    "doubleValue" in value
  ) {
    return Number(
      value.doubleValue
    );
  }

  if (
    "timestampValue" in value
  ) {
    return value.timestampValue;
  }

  if (
    "referenceValue" in value
  ) {
    return value.referenceValue;
  }

  if (
    "geoPointValue" in value
  ) {
    return value.geoPointValue;
  }

  if (
    "arrayValue" in value
  ) {
    const values =
      Array.isArray(
        value.arrayValue
          ?.values
      )
        ? value.arrayValue
            .values
        : [];

    return values.map(
      decodeFirestoreValue
    );
  }

  if (
    "mapValue" in value
  ) {
    return decodeFirestoreFields(
      value.mapValue?.fields ||
        {}
    );
  }

  return null;
}


function decodeFirestoreFields(
  fields
) {
  const result = {};

  for (
    const [
      key,
      value,
    ] of Object.entries(
      fields || {}
    )
  ) {
    result[key] =
      decodeFirestoreValue(
        value
      );
  }

  return result;
}


function decodeFirestoreDocument(
  document
) {
  const name =
    cleanText(
      document?.name
    );

  const id =
    name
      .split("/")
      .filter(Boolean)
      .pop() ||
    "";

  return {
    id,

    ...decodeFirestoreFields(
      document?.fields ||
        {}
    ),

    _createTime:
      document?.createTime ||
      null,

    _updateTime:
      document?.updateTime ||
      null,
  };
}


/* =========================================================
   GET ONE DOCUMENT
========================================================= */

async function getRestDocument(
  documentPath,
  accessToken
) {
  const baseUrl =
    getFirestoreBaseUrl();

  const encodedPath =
    String(
      documentPath ||
      ""
    )
      .split("/")
      .filter(Boolean)
      .map(
        encodeURIComponent
      )
      .join("/");

  const response =
    await fetch(
      `${baseUrl}/${encodedPath}`,
      {
        method:
          "GET",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );


  if (
    response.status ===
    404
  ) {
    return null;
  }


  const raw =
    await response.text();


  if (!response.ok) {
    console.log(
      "FIRESTORE REST GET ERROR:",
      {
        path:
          documentPath,

        status:
          response.status,

        raw:
          raw.slice(
            0,
            500
          ),
      }
    );

    throw new Error(
      `Firestore REST GET failed. HTTP ${response.status}`
    );
  }


  let data = {};

  try {
    data =
      raw
        ? JSON.parse(raw)
        : {};
  } catch {
    throw new Error(
      "Firestore returned invalid JSON."
    );
  }


  return decodeFirestoreDocument(
    data
  );
}


/* =========================================================
   LIST COLLECTION
========================================================= */

async function listRestCollection(
  collectionName,
  accessToken
) {
  const baseUrl =
    getFirestoreBaseUrl();

  const documents = [];

  let pageToken = "";

  /*
   * Maximum 5 pages x 500.
   * More than enough for this
   * message module.
   */
  for (
    let page = 0;
    page < 5;
    page += 1
  ) {
    const params =
      new URLSearchParams();

    params.set(
      "pageSize",
      "500"
    );

    if (pageToken) {
      params.set(
        "pageToken",
        pageToken
      );
    }


    const response =
      await fetch(
        `${baseUrl}/${encodeURIComponent(
          collectionName
        )}?${params.toString()}`,
        {
          method:
            "GET",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            Accept:
              "application/json",
          },

          cache:
            "no-store",
        }
      );


    if (
      response.status ===
      404
    ) {
      return [];
    }


    const raw =
      await response.text();


    if (!response.ok) {
      console.log(
        "FIRESTORE REST LIST ERROR:",
        {
          collection:
            collectionName,

          status:
            response.status,

          raw:
            raw.slice(
              0,
              500
            ),
        }
      );

      throw new Error(
        `Firestore REST LIST failed. HTTP ${response.status}`
      );
    }


    let data = {};

    try {
      data =
        raw
          ? JSON.parse(raw)
          : {};
    } catch {
      throw new Error(
        "Firestore returned invalid JSON."
      );
    }


    const pageDocuments =
      Array.isArray(
        data?.documents
      )
        ? data.documents
        : [];


    documents.push(
      ...pageDocuments.map(
        decodeFirestoreDocument
      )
    );


    pageToken =
      cleanText(
        data?.nextPageToken
      );


    if (!pageToken) {
      break;
    }
  }


  return documents;
}


/* =========================================================
   WRITE READ STATUS
========================================================= */

async function saveReadStatus(
  {
    studentUid,
    source,
    messageId,
  },
  accessToken
) {
  const baseUrl =
    getFirestoreBaseUrl();

  const readId =
    `${studentUid}_${source}_${messageId}`;

  const now =
    new Date()
      .toISOString();


  const response =
    await fetch(
      `${baseUrl}/${STUDENT_READS_COLLECTION}/${encodeURIComponent(
        readId
      )}`,
      {
        method:
          "PATCH",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify({
            fields: {
              studentUid: {
                stringValue:
                  studentUid,
              },

              source: {
                stringValue:
                  source,
              },

              messageId: {
                stringValue:
                  messageId,
              },

              read: {
                booleanValue:
                  true,
              },

              readAt: {
                timestampValue:
                  now,
              },

              updatedAt: {
                timestampValue:
                  now,
              },
            },
          }),

        cache:
          "no-store",
      }
    );


  const raw =
    await response.text();


  if (!response.ok) {
    console.log(
      "SAVE MESSAGE READ REST ERROR:",
      {
        status:
          response.status,

        raw:
          raw.slice(
            0,
            500
          ),
      }
    );

    throw new Error(
      "Unable to save message read status."
    );
  }


  return true;
}


/* =========================================================
   VERIFY DIGITAL STUDENT
========================================================= */

async function verifyDigitalStudent(
  request,
  accessToken
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


  const idToken =
    authorization
      .slice(7)
      .trim();


  if (!idToken) {
    return null;
  }


  try {
    const auth =
      getAdminAuth();

    const decoded =
      await auth.verifyIdToken(
        idToken
      );


    if (!decoded?.uid) {
      return null;
    }


    /*
     * IMPORTANT:
     * User document is loaded
     * through REST, not Admin
     * Firestore gRPC.
     */

    const userData =
      await getRestDocument(
        `users/${decoded.uid}`,
        accessToken
      );


    if (!userData) {
      return null;
    }


    if (
      userData?.role !==
        "student" ||
      userData?.userType !==
        "digital_student"
    ) {
      return null;
    }


    return {
      uid:
        decoded.uid,

      userData,
    };
  } catch (error) {
    console.log(
      "VERIFY DIGITAL STUDENT MESSAGE ERROR:",
      error?.message
    );

    return null;
  }
}


/* =========================================================
   STUDENT CLASS
========================================================= */

function getStudentClass(
  studentData
) {
  return cleanText(
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
}


/* =========================================================
   CENTRAL MESSAGE ACCESS
========================================================= */

function canStudentReadCentralNotice(
  notice,
  studentData
) {
  if (!notice) {
    return false;
  }


  if (
    notice?.isActive ===
    false
  ) {
    return false;
  }


  if (
    notice?.deleted ===
    true
  ) {
    return false;
  }


  const audience =
    normalizeValue(
      notice?.targetAudience
    );


  const validAudience =
    [
      "",
      "all",
      "student",
      "students",
      "digital_student",
      "digital_students",
    ];


  if (
    !validAudience.includes(
      audience
    )
  ) {
    return false;
  }


  /*
   * Expiry
   */

  if (notice?.expiryDate) {
    const expiryTime =
      toMillis(
        notice.expiryDate
      );

    if (
      expiryTime > 0 &&
      expiryTime <
        Date.now()
    ) {
      return false;
    }
  }


  /*
   * Madrasa target
   */

  const targetMahals =
    Array.isArray(
      notice?.targetMahals
    )
      ? notice.targetMahals
          .map(
            normalizeValue
          )
          .filter(Boolean)
      : [];


  if (
    targetMahals.length >
    0
  ) {
    const studentValues =
      [
        studentData
          ?.madarsaId,

        studentData
          ?.madrasaId,

        studentData
          ?.madarsaName,

        studentData
          ?.madrasaName,
      ]
        .map(
          normalizeValue
        )
        .filter(Boolean);


    const matched =
      studentValues.some(
        (value) =>
          targetMahals.includes(
            value
          )
      );


    if (!matched) {
      return false;
    }
  }


  return true;
}


/* =========================================================
   TEACHER MESSAGE ACCESS
========================================================= */

function canStudentReadTeacherMessage(
  message,
  studentUid,
  studentClass,
  teacherUid
) {
  if (!message) {
    return false;
  }

  /* =========================================
     ONLY ASSIGNED TEACHER
  ========================================= */

  if (
    cleanText(message?.teacherUid) !==
    cleanText(teacherUid)
  ) {
    return false;
  }

  /* =========================================
     BLOCK INACTIVE / DELETED
  ========================================= */

  if (
    message?.deleted === true ||
    normalizeValue(message?.status) === "deleted" ||
    normalizeValue(message?.status) === "inactive"
  ) {
    return false;
  }

  /* =========================================
     FIRESTORE RECIPIENT TYPE
  ========================================= */

  const recipientType =
    normalizeValue(
      message?.recipientType ||
      message?.targetType
    );

  const recipientUid =
    cleanText(
      message?.recipientUid ||
      message?.studentUid
    );

  const messageClass =
    normalizeClass(
      message?.className ||
      message?.recipientClass
    );

  const currentStudentClass =
    normalizeClass(
      studentClass
    );

  /* =========================================
     ALL STUDENTS ASSIGNED TO THIS TEACHER
  ========================================= */

  if (
    recipientType === "all"
  ) {
    return true;
  }

  /* =========================================
     ONE STUDENT
  ========================================= */

  if (
    recipientType === "student"
  ) {
    return (
      recipientUid ===
      cleanText(studentUid)
    );
  }

  /* =========================================
     WHOLE CLASS
  ========================================= */

  if (
    recipientType === "class"
  ) {
    return (
      messageClass ===
      currentStudentClass
    );
  }

  /* =========================================
     LEGACY SUPPORT
  ========================================= */

  if (
    recipientUid === "all"
  ) {
    return true;
  }

  if (recipientUid) {
    return (
      recipientUid ===
      cleanText(studentUid)
    );
  }

  if (messageClass) {
    return (
      messageClass ===
      currentStudentClass
    );
  }

  return false;
}

/* =========================================================
   GET STUDENT MESSAGES
========================================================= */

export async function GET(
  request
) {
  try {

    /*
     * SERVICE ACCOUNT TOKEN
     *
     * Uses HTTP REST.
     * No Firestore gRPC.
     */

    const accessToken =
      await getServiceAccessToken();


    /* ==============================
       VERIFY STUDENT
    ============================== */

    const student =
      await verifyDigitalStudent(
        request,
        accessToken
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


    const studentUid =
      student.uid;

    const studentData =
      student.userData ||
      {};


    const teacherUid =
      cleanText(
        studentData
          ?.assignedDigitalTeacherUid
      );


    const teacherName =
      cleanText(
        studentData
          ?.assignedDigitalTeacherName
      );


    const studentClass =
      getStudentClass(
        studentData
      );


    /* ==============================
       LOAD COLLECTIONS
    ============================== */

    const [
      centralDocuments,
      teacherDocuments,
      readDocuments,
    ] =
      await Promise.all([
        listRestCollection(
          "centralNotices",
          accessToken
        ),

        teacherUid
          ? listRestCollection(
              TEACHER_MESSAGES_COLLECTION,
              accessToken
            )
          : Promise.resolve(
              []
            ),

        listRestCollection(
          STUDENT_READS_COLLECTION,
          accessToken
        ),
      ]);


    /* ==============================
       CENTRAL ADMIN MESSAGES
    ============================== */

    const centralMessages =
      centralDocuments
        .filter(
          (notice) =>
            canStudentReadCentralNotice(
              notice,
              studentData
            )
        )
        .map(
          (notice) => ({
            id:
              notice.id,

            source:
              "central_admin",

            senderType:
              "central_admin",

            senderName:
              notice
                ?.createdByName ||
              "Central Admin",

            title:
              notice?.title ||
              "Central Admin Message",

            message:
              notice?.content ||
              notice?.message ||
              "",

            priority:
              notice?.priority ||
              "medium",

            createdAt:
              notice?.createdAt ||
              notice?._createTime ||
              null,

            updatedAt:
              notice?.updatedAt ||
              notice?._updateTime ||
              null,
          })
        );


    /* ==============================
       TEACHER MESSAGES
    ============================== */

    const teacherMessages =
      teacherDocuments
        .filter(
          (message) =>
            canStudentReadTeacherMessage(
              message,
              studentUid,
              studentClass,
              teacherUid
            )
        )
        .map(
          (message) => ({
            id:
              message.id,

            source:
              "teacher",

            senderType:
              "teacher",

            senderName:
              message
                ?.teacherName ||
              teacherName ||
              "Digital Teacher",

            teacherUid,

            title:
              message?.title ||
              "Teacher Message",

            message:
              message?.message ||
              message?.content ||
              "",

            className:
              message?.className ||
              studentClass,

            targetType:
              message?.targetType ||
              "",

            priority:
              message?.priority ||
              "normal",

            createdAt:
              message?.createdAt ||
              message?._createTime ||
              null,

            updatedAt:
              message?.updatedAt ||
              message?._updateTime ||
              null,
          })
        );


    /* ==============================
       READ STATUS
    ============================== */

    const readSet =
      new Set(
        readDocuments
          .filter(
            (item) =>
              cleanText(
                item
                  ?.studentUid
              ) ===
              studentUid
          )
          .map(
            (item) =>
              `${cleanText(
                item?.source
              )}:${cleanText(
                item?.messageId
              )}`
          )
      );


    /* ==============================
       MERGE + SORT
    ============================== */

    const messages =
      [
        ...centralMessages,
        ...teacherMessages,
      ]
        .map(
          (message) => ({
            ...message,

            read:
              readSet.has(
                `${message.source}:${message.id}`
              ),
          })
        )
        .sort(
          (a, b) =>
            toMillis(
              b?.createdAt
            ) -
            toMillis(
              a?.createdAt
            )
        );


    const unreadCount =
      messages.filter(
        (message) =>
          !message.read
      ).length;


    return NextResponse.json({
      success:
        true,

      student: {
        uid:
          studentUid,

        className:
          studentClass,

        teacherAssigned:
          studentData
            ?.teacherAssigned ===
          true,

        teacherUid:
          teacherUid ||
          null,

        teacherName:
          teacherName ||
          null,
      },

      count:
        messages.length,

      unreadCount,

      centralCount:
        messages.filter(
          (message) =>
            message.source ===
            "central_admin"
        ).length,

      teacherCount:
        messages.filter(
          (message) =>
            message.source ===
            "teacher"
        ).length,

      messages,
    });

  } catch (error) {
    console.log(
      "GET DIGITAL STUDENT MESSAGES REST ERROR:",
      error
    );


    return NextResponse.json(
      {
        success:
          false,

        message:
          error?.message ||
          "Unable to load messages.",
      },
      {
        status:
          500,
      }
    );
  }
}


/* =========================================================
   MARK MESSAGE READ
========================================================= */

export async function PATCH(
  request
) {
  try {
    const accessToken =
      await getServiceAccessToken();


    const student =
      await verifyDigitalStudent(
        request,
        accessToken
      );


    if (!student?.uid) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Unauthorized Digital Student.",
        },
        {
          status:
            401,
        }
      );
    }


    let body = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }


    const source =
      cleanText(
        body?.source
      );


    const messageId =
      cleanText(
        body?.messageId
      );


    if (
      ![
        "central_admin",
        "teacher",
      ].includes(source)
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Invalid message source.",
        },
        {
          status:
            400,
        }
      );
    }


    if (!messageId) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Message ID is required.",
        },
        {
          status:
            400,
        }
      );
    }


    const studentUid =
      student.uid;

    const studentData =
      student.userData ||
      {};

    const teacherUid =
      cleanText(
        studentData
          ?.assignedDigitalTeacherUid
      );

    const studentClass =
      getStudentClass(
        studentData
      );


    /* ==============================
       VERIFY CENTRAL MESSAGE
    ============================== */

    if (
      source ===
      "central_admin"
    ) {
      const notice =
        await getRestDocument(
          `centralNotices/${messageId}`,
          accessToken
        );


      if (
        !notice ||
        !canStudentReadCentralNotice(
          notice,
          studentData
        )
      ) {
        return NextResponse.json(
          {
            success:
              false,

            message:
              "Message not found.",
          },
          {
            status:
              404,
          }
        );
      }
    }


    /* ==============================
       VERIFY TEACHER MESSAGE
    ============================== */

    if (
      source ===
      "teacher"
    ) {
      const message =
        await getRestDocument(
          `${TEACHER_MESSAGES_COLLECTION}/${messageId}`,
          accessToken
        );


      if (
        !message ||
        !canStudentReadTeacherMessage(
          message,
          studentUid,
          studentClass,
          teacherUid
        )
      ) {
        return NextResponse.json(
          {
            success:
              false,

            message:
              "Message not found.",
          },
          {
            status:
              404,
          }
        );
      }
    }


    /* ==============================
       SAVE READ STATUS
    ============================== */

    await saveReadStatus(
      {
        studentUid,
        source,
        messageId,
      },
      accessToken
    );


    return NextResponse.json({
      success:
        true,

      message:
        "Message marked as read.",

      messageId,

      source,
    });

  } catch (error) {
    console.log(
      "MARK STUDENT MESSAGE READ REST ERROR:",
      error
    );


    return NextResponse.json(
      {
        success:
          false,

        message:
          error?.message ||
          "Unable to mark message as read.",
      },
      {
        status:
          500,
      }
    );
  }
}