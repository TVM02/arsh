import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import {
  addGoogleMeetMember,
  getGoogleMeetAccessToken,
} from "@/lib/googleMeetMembers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOM_COLLECTION = "digitalMeetRooms";
const TEACHER_MEET_ROLE = "ROLE_UNSPECIFIED";

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeClass(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/^class\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_-]/g, "");
}

export async function POST(request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    /* =====================================================
       VERIFY CENTRAL ADMIN
    ===================================================== */

    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const idToken = authorization
      .slice(7)
      .trim();

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication token is missing.",
        },
        { status: 401 }
      );
    }

    const decodedToken =
      await auth.verifyIdToken(idToken);

    const adminUid = decodedToken.uid;

    const adminSnapshot = await db
      .collection("users")
      .doc(adminUid)
      .get();

    if (!adminSnapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Central Admin account was not found.",
        },
        { status: 403 }
      );
    }

    const adminData =
      adminSnapshot.data() || {};

    const isCentralAdmin =
      adminData.role === "admin" ||
      adminData.role === "central_admin" ||
      adminData.isCentralAdmin === true;

    if (!isCentralAdmin) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Central Admin access required.",
        },
        { status: 403 }
      );
    }

    /* =====================================================
       REQUEST DATA
    ===================================================== */

    const body =
      await request.json().catch(() => ({}));

    const teacherUid =
      cleanText(body?.teacherUid);

    const className =
      cleanText(body?.className);

    if (!teacherUid) {
      return NextResponse.json(
        {
          success: false,
          message: "Teacher UID is required.",
        },
        { status: 400 }
      );
    }

    if (!className) {
      return NextResponse.json(
        {
          success: false,
          message: "Class name is required.",
        },
        { status: 400 }
      );
    }

    const classKey =
      normalizeClass(className);

    if (!classKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid class name.",
        },
        { status: 400 }
      );
    }

    /* =====================================================
       LOAD TEACHER
    ===================================================== */

    const teacherRef = db
      .collection("users")
      .doc(teacherUid);

    const teacherSnapshot =
      await teacherRef.get();

    if (!teacherSnapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Teacher account was not found.",
        },
        { status: 404 }
      );
    }

    const teacherData =
      teacherSnapshot.data() || {};

    /* =====================================================
       VERIFY DIGITAL TEACHER
    ===================================================== */

    if (
      teacherData.role !== "teacher" ||
      teacherData.digitalTeacher !== true ||
      teacherData.digitalClassAccess !== true
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This account is not authorized for Digital Classroom Teacher access.",
        },
        { status: 403 }
      );
    }

    if (
      teacherData.digitalTeacherStatus &&
      teacherData.digitalTeacherStatus !== "active"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your Digital Teacher account is not active.",
        },
        { status: 403 }
      );
    }

    /* =====================================================
       VERIFY TEACHER CLASS ASSIGNMENT
    ===================================================== */

    const assignedClasses =
      Array.isArray(
        teacherData?.digitalTeachingAssignment
          ?.classes
      )
        ? teacherData.digitalTeachingAssignment.classes
        : [];

    const teacherHasClass =
      assignedClasses.some(
        (assignedClass) =>
          normalizeClass(
            typeof assignedClass === "string"
              ? assignedClass
              : assignedClass?.name ||
                assignedClass?.className ||
                assignedClass?.value ||
                ""
          ) === classKey
      );

    if (!teacherHasClass) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This class is not assigned to the selected Digital Teacher.",
        },
        { status: 403 }
      );
    }

    /* =====================================================
       GET CENTRAL ADMIN GOOGLE MEET TOKEN
       
       IMPORTANT:
       The Central Admin creates the Meet.
       Teacher Google account is NOT required here.
    ===================================================== */

    const accessToken =
      await getGoogleMeetAccessToken(db);

    /* =====================================================
       DETERMINISTIC ROOM ID
    ===================================================== */

    const roomId =
      `${teacherUid}__${classKey}`;

    const roomRef =
      db
        .collection(ROOM_COLLECTION)
        .doc(roomId);

    const existingRoom =
      await roomRef.get();

    if (existingRoom.exists) {
      const existingData =
        existingRoom.data() || {};

      if (
        existingData.status === "active" &&
        existingData.meetUrl
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "An active Google Meet already exists for this teacher and class.",
            roomId,
            meetUrl:
              existingData.meetUrl,
          },
          { status: 409 }
        );
      }
    }

    /* =====================================================
       CREATE GOOGLE MEET
       
       CENTRAL ADMIN = ORGANIZER
    ===================================================== */

    const createResponse = await fetch(
  "https://meet.googleapis.com/v2/spaces",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      config: {
        entryPointAccess: "ALL",
      },
    }),
    cache: "no-store",
  }
);

    const createRaw =
      await createResponse.text();

    let createData = {};

    try {
      createData = createRaw
        ? JSON.parse(createRaw)
        : {};
    } catch {
      createData = {
        raw: createRaw,
      };
    }

    if (!createResponse.ok) {
      console.error(
        "GOOGLE MEET CREATE ERROR:",
        {
          status:
            createResponse.status,
          data: createData,
        }
      );

      return NextResponse.json(
        {
          success: false,
          message:
            createData?.error?.message ||
            "Unable to create Google Meet.",
          googleError:
            createData?.error || null,
        },
        {
          status:
            createResponse.status,
        }
      );
    }

    const googleSpaceName =
      cleanText(
        createData?.name
      );

    const meetUrl =
      cleanText(
        createData?.meetingUri ||
          createData?.meetingUri?.uri ||
          createData?.meetingUri
      );

    if (!googleSpaceName) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Google Meet was created but the Google Space name was not returned.",
        },
        { status: 500 }
      );
    }

    if (
      !meetUrl ||
      !meetUrl.startsWith(
        "https://meet.google.com/"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Google Meet was created but a valid Meet URL was not returned.",
        },
        { status: 500 }
      );
    }

    /* =====================================================
       ADD TEACHER AS NORMAL MEMBER
       
       Teacher is NOT organizer/host.
    ===================================================== */

    const teacherGoogleEmail =
      cleanText(
        teacherData?.googleAuth?.email
      ).toLowerCase();

    let teacherMemberResult = {
      added: false,
      skipped: true,
      email: teacherGoogleEmail,
      message:
        "Teacher has not connected a Google account.",
    };

    if (
      teacherData?.googleAuth?.connected === true &&
      teacherGoogleEmail
    ) {
      const result =
        await addGoogleMeetMember({
          accessToken,
          googleSpaceName,
          email:
            teacherGoogleEmail,
          role:
            TEACHER_MEET_ROLE,
        });

      teacherMemberResult = {
        added:
          result?.success === true,
        skipped:
          result?.skipped === true,
        email:
          teacherGoogleEmail,
        message:
          result?.success
            ? null
            : result?.message ||
              "Unable to add teacher to Google Meet.",
      };
    }

    /* =====================================================
       FIND ASSIGNED DIGITAL STUDENTS
    ===================================================== */

    const studentsSnapshot =
      await db
        .collection("users")
        .where(
          "role",
          "==",
          "student"
        )
        .where(
          "userType",
          "==",
          "digital_student"
        )
        .get();

    const assignedStudents = [];

    studentsSnapshot.forEach(
      (studentDoc) => {
        const student =
          studentDoc.data() || {};

        const assignedTeacherUid =
          cleanText(
            student?.assignedDigitalTeacherUid
          );

        const assignedClassKey =
          normalizeClass(
            student?.assignedDigitalTeacherClass
          );

        if (
          assignedTeacherUid ===
            teacherUid &&
          assignedClassKey ===
            classKey
        ) {
          assignedStudents.push({
            uid:
              studentDoc.id,
            ...student,
          });
        }
      }
    );

    /* =====================================================
       ADD STUDENTS AS NORMAL MEMBERS
    ===================================================== */

    const studentMemberResults = [];

    for (
      const student of assignedStudents
    ) {
      const googleConnected =
        student?.googleAuth
          ?.connected === true;

      const studentGoogleEmail =
        cleanText(
          student?.googleAuth?.email
        ).toLowerCase();

      if (
        !googleConnected ||
        !studentGoogleEmail
      ) {
        studentMemberResults.push({
          uid:
            student.uid,
          email: "",
          added: false,
          skipped: true,
          message:
            "Student has not connected a Google account.",
        });

        continue;
      }

      const memberResult =
        await addGoogleMeetMember({
          accessToken,
          googleSpaceName,
          email:
            studentGoogleEmail,
          role:
            "ROLE_UNSPECIFIED",
        });

      studentMemberResults.push({
        uid:
          student.uid,
        email:
          studentGoogleEmail,
        added:
          memberResult?.success === true,
        skipped:
          memberResult?.skipped === true,
        message:
          memberResult?.success
            ? null
            : memberResult?.message ||
              "Unable to add student to Google Meet.",
      });
    }

    /* =====================================================
       SAVE MEET ROOM
    ===================================================== */

    const now =
      new Date().toISOString();

    const roomData = {
      id: roomId,

      teacherUid,

      teacherName:
        cleanText(
          teacherData?.name ||
            teacherData?.displayName ||
            teacherData?.teacherName
        ),

      className,

      classKey,

      googleSpaceName,

      meetUrl,

      status: "active",

      organizerUid:
        adminUid,

      organizerType:
        "central_admin",

      teacherMember:
        teacherMemberResult,

      studentMemberResults,

      assignedStudentCount:
        assignedStudents.length,

      createdAt: now,

      updatedAt: now,
    };

    await roomRef.set(
      roomData,
      {
        merge: true,
      }
    );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json(
      {
        success: true,

        roomId,

        meetUrl,

        googleSpaceName,

        organizer: {
          uid: adminUid,
          type: "central_admin",
        },

        teacher: {
          uid: teacherUid,
          googleEmail:
            teacherGoogleEmail ||
            null,
          added:
            teacherMemberResult.added,
          skipped:
            teacherMemberResult.skipped,
          message:
            teacherMemberResult.message,
        },

        students: {
          assigned:
            assignedStudents.length,
          results:
            studentMemberResults,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "CREATE DIGITAL GOOGLE MEET ERROR:",
      error
    );

    if (
      error?.code ===
        "auth/id-token-expired" ||
      error?.code ===
        "auth/invalid-id-token" ||
      error?.code ===
        "auth/argument-error"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your Central Admin session has expired. Please log in again.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Unable to create Google Meet.",
      },
      { status: 500 }
    );
  }
}