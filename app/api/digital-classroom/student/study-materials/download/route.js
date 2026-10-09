import {
  NextResponse,
} from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

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


function safeFileName(
  value
) {
  return String(
    value ||
      "study-material"
  )
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      "-"
    )
    .trim();
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

    if (!token) {
      return null;
    }

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
      "VERIFY DOWNLOAD STUDENT ERROR:",
      error
    );

    return null;
  }
}


/* =========================================================
   DOWNLOAD MATERIAL
========================================================= */

export async function POST(
  request
) {
  try {
    const auth =
      getAdminAuth();

    const db =
      getAdminDb();


    /* ==============================
       REQUEST BODY
    ============================== */

    let body = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }


    /* ==============================
       MATERIAL ID
    ============================== */

    const materialId =
      cleanText(
        body?.materialId
      );

    if (!materialId) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Material ID is required.",
        },
        {
          status: 400,
        }
      );
    }


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


    if (
      studentData
        ?.teacherAssigned !==
        true ||
      !teacherUid
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "No Digital Teacher assigned.",
        },
        {
          status: 403,
        }
      );
    }


    /* ==============================
       LOAD MATERIAL
    ============================== */

    const materialRef =
      db
        .collection(
          "digitalStudyMaterials"
        )
        .doc(materialId);

    const materialSnapshot =
      await materialRef.get();

    if (
      !materialSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Study material not found.",
        },
        {
          status: 404,
        }
      );
    }


    const material =
      materialSnapshot.data() ||
      {};


    /* ==============================
       ACTIVE CHECK
    ============================== */

    if (
      cleanText(
        material?.status
      ).toLowerCase() !==
      "active"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "This material is unavailable.",
        },
        {
          status: 403,
        }
      );
    }


    /* ==============================
       TEACHER CHECK
    ============================== */

    if (
      cleanText(
        material?.teacherUid
      ) !== teacherUid
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "You cannot access this material.",
        },
        {
          status: 403,
        }
      );
    }


    /* ==============================
       CLASS CHECK
    ============================== */

    if (
      normalizeClass(
        material?.className
      ) !==
      normalizeClass(
        studentClass
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "This material is not assigned to your class.",
        },
        {
          status: 403,
        }
      );
    }


    /* ==============================
       BLOCK YOUTUBE
    ============================== */

    const materialType =
      cleanText(
        material?.materialType ||
        material?.type
      ).toLowerCase();

    if (
      materialType ===
        "youtube" ||
      material?.youtubeUrl
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "YouTube videos cannot be downloaded.",
        },
        {
          status: 400,
        }
      );
    }


    /* ==============================
       FILE URL
    ============================== */

    const fileUrl =
      cleanText(
        material?.fileUrl
      );

    if (!fileUrl) {
      return NextResponse.json(
        {
          success: false,

          message:
            "File is unavailable.",
        },
        {
          status: 404,
        }
      );
    }


    /* ==============================
       FETCH FILE
    ============================== */

    const fileResponse =
      await fetch(
        fileUrl,
        {
          cache:
            "no-store",
        }
      );


    if (
      !fileResponse.ok ||
      !fileResponse.body
    ) {
      console.error(
        "MATERIAL FILE FETCH ERROR:",
        fileResponse.status
      );

      return NextResponse.json(
        {
          success: false,

          message:
            "Unable to download file.",
        },
        {
          status: 502,
        }
      );
    }


    /* ==============================
       DOWNLOAD COUNT
    ============================== */

    await materialRef.update({
      downloads:
        FieldValue.increment(
          1
        ),

      lastDownloadedAt:
        FieldValue.serverTimestamp(),
    });


    /* ==============================
       FILE NAME
    ============================== */

    const fileName =
      safeFileName(
        material?.fileName ||
        material?.title ||
        "study-material"
      );


    const contentType =
      fileResponse.headers.get(
        "content-type"
      ) ||
      "application/octet-stream";


    /* ==============================
       FORCE DOWNLOAD
    ============================== */

    return new Response(
      fileResponse.body,
      {
        status: 200,

        headers: {
          "Content-Type":
            contentType,

          "Content-Disposition":
            `attachment; filename="${fileName}"`,

          "Cache-Control":
            "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "DIGITAL STUDENT MATERIAL DOWNLOAD ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to download material.",
      },
      {
        status: 500,
      }
    );
  }
}