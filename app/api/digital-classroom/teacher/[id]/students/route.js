import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";
import { addGoogleMeetMember, getGoogleMeetAccessToken } from "@/lib/googleMeetMembers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEACHER_COLLECTION =
  "digitalClassTeacherRegistrations";



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

  if (Array.isArray(value)) {
    return value.map(serialize);
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

/* ============================================
   CENTRAL ADMIN AUTH
============================================ */

/* ============================================
   VERIFY DIGITAL TEACHER OR ADMIN
============================================ */

async function verifyDigitalTeacherOrAdmin(
  request,
  auth,
  db,
) {
  const authorization =
    request.headers.get(
      "authorization",
    ) || "";

  if (
    !authorization.startsWith(
      "Bearer ",
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
        token,
      );


    if (!decoded?.uid) {
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
      userSnapshot.data() ||
      {};


    /* ========================================
       CENTRAL ADMIN
    ======================================== */

    if (
      userData?.role ===
        "central_admin" ||
      userData?.role ===
        "admin"
    ) {
      return {
        uid:
          decoded.uid,

        type:
          "admin",

        userData,
      };
    }


    /* ========================================
       DIGITAL TEACHER

       Digital Teacher remains role "teacher".
    ======================================== */

    const isDigitalTeacher =
      userData?.role ===
        "teacher" &&
      userData
        ?.digitalTeacher ===
        true &&
      userData
        ?.digitalClassAccess ===
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

      type:
        "digital_teacher",

      userData,
    };
  } catch (error) {
    console.error(
      "VERIFY DIGITAL TEACHER ERROR:",
      error,
    );

    return null;
  }
}
/* ============================================
   VERIFY CENTRAL ADMIN
   USED BY POST + DELETE
============================================ */

async function verifyCentralAdmin(
  request,
  auth,
  db,
) {
  const authenticatedUser =
    await verifyDigitalTeacherOrAdmin(
      request,
      auth,
      db,
    );

  if (
    !authenticatedUser?.uid
  ) {
    return null;
  }

  if (
    authenticatedUser.type !==
    "admin"
  ) {
    return null;
  }

  return {
    uid:
      authenticatedUser.uid,

    userData:
      authenticatedUser.userData,
  };
}
/* ============================================
   GET STUDENT CLASS
============================================ */

function getStudentClass(student) {
  return (
    student?.className ||
    student?.class ||
    student?.currentClass ||
    student?.applyingclass ||
    student?.classLevel ||
    student?.academicDetails
      ?.className ||
    student?.academicDetails
      ?.class ||
    ""
  );
}

async function getDigitalStudentProfile(
  db,
  studentUid,
) {
  if (!studentUid) {
    return {};
  }

  // Current registration format
  let snapshot =
    await db
      .collection(
        "digitalClassStudentRegistrations",
      )
      .where(
        "uid",
        "==",
        studentUid,
      )
      .limit(1)
      .get();

  if (!snapshot.empty) {
    return {
      id:
        snapshot.docs[0].id,

      ...snapshot.docs[0].data(),
    };
  }


  // Legacy fallback
  snapshot =
    await db
      .collection(
        "digitalClassStudentRegistrations",
      )
      .where(
        "studentUid",
        "==",
        studentUid,
      )
      .limit(1)
      .get();

  if (!snapshot.empty) {
    return {
      id:
        snapshot.docs[0].id,

      ...snapshot.docs[0].data(),
    };
  }


  // Document ID fallback
  const documentSnapshot =
    await db
      .collection(
        "digitalClassStudentRegistrations",
      )
      .doc(studentUid)
      .get();

  if (
    documentSnapshot.exists
  ) {
    return {
      id:
        documentSnapshot.id,

      ...documentSnapshot.data(),
    };
  }


  return {};
}

/* ============================================
   GET ELIGIBLE DIGITAL STUDENTS
============================================ */

export async function GET(
  request,
  { params },
) {
  try {
    const { id } =
      await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const auth =
      getAdminAuth();

    const db =
      getAdminDb();

    /* ----------------------------------------
       VERIFY ADMIN
    ---------------------------------------- */

   const authenticatedUser =
  await verifyDigitalTeacherOrAdmin(
    request,
    auth,
    db,
  );


if (
  !authenticatedUser?.uid
) {
  return NextResponse.json(
    {
      success: false,
      message:
        "Unauthorized.",
    },
    {
      status: 401,
    },
  );
}

    /* ----------------------------------------
       LOAD DIGITAL TEACHER
    ---------------------------------------- */

    /* ============================================
   DIGITAL TEACHER
   LOAD ONLY OWN ASSIGNED STUDENTS
============================================ */

if (
  authenticatedUser.type ===
  "digital_teacher"
) {
  const digitalTeacherUid =
    authenticatedUser.uid;


  /* ============================================
     GET ASSIGNED STUDENTS FROM USERS

     users = assignment source of truth
  ============================================ */

  const studentsSnapshot =
    await db
      .collection("users")
      .where(
        "assignedDigitalTeacherUid",
        "==",
        digitalTeacherUid,
      )
      .get();


  const assignedUserDocs =
    studentsSnapshot.docs.filter(
      (doc) => {
        const student =
          doc.data() || {};

        return (
          student?.role ===
            "student" &&

          student?.userType ===
            "digital_student" &&

          student?.teacherAssigned ===
            true &&

          cleanText(
            student
              ?.assignedDigitalTeacherUid,
          ) ===
            digitalTeacherUid
        );
      },
    );


  /* ============================================
     MERGE STUDENT REGISTRATION PROFILE
  ============================================ */

  const students =
    await Promise.all(
      assignedUserDocs.map(
        async (doc) => {
          const userData =
            doc.data() || {};

          const studentUid =
            cleanText(
              userData?.uid ||
              doc.id,
            );

          const profile =
            await getDigitalStudentProfile(
              db,
              studentUid,
            );


          /*
           * Registration gives profile data.
           * users gives current assignment data.
           *
           * users is placed LAST so current
           * assignment values always win.
           */
          const merged = {
            ...profile,
            ...userData,
          };


          const fullName =
            cleanText(
              merged?.fullName ||
              merged?.studentName ||
              merged?.name,
            );


          const studentClass =
            cleanText(
              merged
                ?.assignedDigitalTeacherClass ||

              merged?.classLevel ||

              merged?.className ||

              merged?.currentClass ||

              merged?.class ||

              merged?.applyingclass,
            );


          return {
            ...merged,

            /*
             * IMPORTANT:
             * id must be users document ID
             */
            id:
              doc.id,

            uid:
              studentUid,

            studentUid,

            name:
              fullName,

            fullName,

            studentName:
              fullName,


            /* Admission */

            admissionNo:
              merged
                ?.digitalAdmissionNumber ||
              merged
                ?.admissionNumber ||
              null,

            admissionNumber:
              merged
                ?.admissionNumber ||
              null,

            digitalAdmissionNumber:
              merged
                ?.digitalAdmissionNumber ||
              null,


            /* Class */

            studentClass,

            className:
              studentClass,

            class:
              studentClass,


            /* Contact */

            phone:
              merged?.phone ||
              merged
                ?.studentPhone ||
              null,

            email:
              merged?.email ||
              merged
                ?.studentEmail ||
              null,


            /* Personal */

            gender:
              merged?.gender ||
              null,

            dateOfBirth:
              merged
                ?.dateOfBirth ||
              null,

            address:
              merged?.address ||
              null,

            profilePicture:
              merged
                ?.profilePicture ||
              null,


            /* Guardian */

            guardianName:
              merged
                ?.guardianName ||
              null,

            guardianPhone:
              merged
                ?.guardianPhone ||
              null,


            /* Madrasa */

            madrasaName:
              merged
                ?.madrasaName ||
              merged
                ?.madarsaName ||
              merged
                ?.previousmadarsa ||
              null,

            madarsaName:
              merged
                ?.madarsaName ||
              merged
                ?.madrasaName ||
              null,


            /* Account */

            status:
              merged
                ?.accountStatus ||
              merged?.status ||
              "active",

            accountStatus:
              merged
                ?.accountStatus ||
              merged?.status ||
              "active",


            /* Assignment */

            teacherAssigned:
              true,

            assignedDigitalTeacherApplicationId:
              merged
                ?.assignedDigitalTeacherApplicationId ??
              null,

            assignedDigitalTeacherUid:
              merged
                ?.assignedDigitalTeacherUid ??
              null,

            assignedDigitalTeacherName:
              merged
                ?.assignedDigitalTeacherName ??
              null,

            assignedDigitalTeacherEmail:
              merged
                ?.assignedDigitalTeacherEmail ??
              null,

            assignedDigitalTeacherMhrId:
              merged
                ?.assignedDigitalTeacherMhrId ??
              null,

            assignedDigitalTeacherClass:
              merged
                ?.assignedDigitalTeacherClass ??
              studentClass,

            teacherAssignedAt:
              merged
                ?.teacherAssignedAt ??
              null,

            teacherAssignedBy:
              merged
                ?.teacherAssignedBy ??
              null,

            alreadyAssigned:
              true,
          };
        },
      ),
    );


  


  return NextResponse.json(
    {
      success: true,

      teacherUid:
        digitalTeacherUid,

      count:
        students.length,

      assignedCount:
        students.length,

      students,
    },
    {
      status: 200,
    },
  );
}
    /* ----------------------------------------
       TEACHER ASSIGNED CLASSES
    ---------------------------------------- */

    const teacherClasses =
      Array.isArray(
        teacher
          ?.teachingAssignment
          ?.classes,
      )
        ? teacher
            .teachingAssignment
            .classes
        : [];

    const normalizedTeacherClasses =
      teacherClasses.map(
        normalizeClass,
      );

    /* ----------------------------------------
       LOAD DIGITAL STUDENTS
    ---------------------------------------- */

    const studentsSnapshot =
      await db
        .collection("users")
        .where(
          "userType",
          "==",
          "digital_student",
        )
        .get();

    /* ----------------------------------------
       LOAD CURRENT ASSIGNMENTS
    ---------------------------------------- */

    const assignmentSnapshot =
  await db
    .collection(
      ASSIGNMENT_COLLECTION,
    )
    .where(
      "digitalTeacherUid",
      "==",
      digitalTeacherUid,
    )
    .where(
      "status",
      "==",
      "active",
    )
    .get();

const assignedStudentUids =
  new Set(
    assignmentSnapshot.docs.map(
      (doc) =>
        doc.data()
          ?.studentUid,
    ),
  );

    /* ----------------------------------------
       FILTER ELIGIBLE STUDENTS
    ---------------------------------------- */

    const students =
      studentsSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...serialize(
            doc.data(),
          ),
        }))
        .filter((student) => {
          /*
            Must be a Digital Student
          */

          if (
            student?.role !==
            "student"
          ) {
            return false;
          }

          if (
            student?.userType !==
            "digital_student"
          ) {
            return false;
          }

          /*
            Match teacher classes
          */

          const studentClass =
            normalizeClass(
              getStudentClass(
                student,
              ),
            );

          if (
            normalizedTeacherClasses
              .length > 0 &&
            !normalizedTeacherClasses
              .includes(
                studentClass,
              )
          ) {
            return false;
          }

          return true;
        })
        .map((student) => ({
  ...student,

  studentClass:
    getStudentClass(
      student,
    ),

  teacherAssigned:
    student?.teacherAssigned ===
    true,

  assignedDigitalTeacherApplicationId:
    student
      ?.assignedDigitalTeacherApplicationId ??
    null,

  assignedDigitalTeacherUid:
    student
      ?.assignedDigitalTeacherUid ??
    null,

  assignedDigitalTeacherName:
    student
      ?.assignedDigitalTeacherName ??
    null,

  assignedDigitalTeacherEmail:
    student
      ?.assignedDigitalTeacherEmail ??
    null,

  assignedDigitalTeacherMhrId:
    student
      ?.assignedDigitalTeacherMhrId ??
    null,

  assignedDigitalTeacherClass:
    student
      ?.assignedDigitalTeacherClass ??
    null,

  teacherAssignedAt:
    student
      ?.teacherAssignedAt ??
    null,

  teacherAssignedBy:
    student
      ?.teacherAssignedBy ??
    null,

  teacherUnassignedAt:
    student
      ?.teacherUnassignedAt ??
    null,

  teacherUnassignedBy:
    student
      ?.teacherUnassignedBy ??
    null,

  /*
   * Used by your existing Central Admin UI.
   *
   * This means:
   * this student is assigned specifically
   * to the currently selected Digital Teacher.
   */
  alreadyAssigned:
    student?.teacherAssigned ===
      true &&
    student
      ?.assignedDigitalTeacherUid ===
      digitalTeacherUid,
}));

    /* ----------------------------------------
       RESPONSE
    ---------------------------------------- */

    return NextResponse.json(
      {
        success: true,

        teacher: {
          id,

          digitalTeacherUid,

          fullName:
            teacher?.fullName ||
            "",

          teachingAssignment:
            teacher
              ?.teachingAssignment ||
            {
              classes: [],
              subjects: [],
              languages: [],
            },
        },

        students,

        count:
          students.length,

        assignedCount:
  students.filter(
    (student) =>
      student?.teacherAssigned ===
        true &&
      student
        ?.assignedDigitalTeacherUid ===
        digitalTeacherUid,
  ).length,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "GET ELIGIBLE DIGITAL STUDENTS ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to load Digital Students.",
      },
      {
        status: 500,
      },
    );
  }
}
/* ============================================
   AUTO SYNC STUDENT TO EXISTING GOOGLE MEET
============================================ */

async function syncStudentToExistingMeet({
  db,
  studentUid,
  teacherUid,
  studentClass,
}) {
  try {
    if (
      !studentUid ||
      !teacherUid ||
      !studentClass
    ) {
      return {
        success: false,
        skipped: true,
        reason:
          "Student UID, teacher UID, or class is missing.",
      };
    }

    const normalizedClass =
      normalizeClass(studentClass);

    if (!normalizedClass) {
      return {
        success: false,
        skipped: true,
        reason:
          "Student class is missing.",
      };
    }

    /* ----------------------------------------
       LOAD CURRENT STUDENT
    ---------------------------------------- */

    const studentSnapshot =
      await db
        .collection("users")
        .doc(studentUid)
        .get();

    if (!studentSnapshot.exists) {
      return {
        success: false,
        skipped: true,
        reason:
          "Student account not found.",
      };
    }

    const student =
      studentSnapshot.data() || {};

    /* ----------------------------------------
       GOOGLE ACCOUNT
    ---------------------------------------- */

    const googleAuth =
      student?.googleAuth || {};

    if (
      googleAuth?.connected !== true
    ) {
      return {
        success: false,
        skipped: true,
        reason:
          "Student has not connected a Google account yet.",
      };
    }

    const googleEmail =
      cleanText(
        googleAuth?.email,
      ).toLowerCase();

    if (!googleEmail) {
      return {
        success: false,
        skipped: true,
        reason:
          "Student Google email is missing.",
      };
    }

    /* ----------------------------------------
       FIND EXISTING MEET ROOM
    ---------------------------------------- */

    const roomId =
      `${teacherUid}__${normalizedClass}`;

    const roomRef =
      db
        .collection("digitalMeetRooms")
        .doc(roomId);

    const roomSnapshot =
      await roomRef.get();

    if (!roomSnapshot.exists) {
      return {
        success: false,
        skipped: true,
        reason:
          "No existing Google Meet was found for this teacher and class.",
      };
    }

    const room =
      roomSnapshot.data() || {};

    const googleSpaceName =
      cleanText(
        room?.meetSpaceName ||
        room?.spaceName ||
        room?.googleSpaceName,
      );

    if (!googleSpaceName) {
      return {
        success: false,
        skipped: true,
        reason:
          "Google Meet space name is missing.",
      };
    }

    /* ----------------------------------------
       CHECK EXISTING MEMBER RESULT
    ---------------------------------------- */

    const existingResults =
      Array.isArray(
        room?.studentMemberResults,
      )
        ? room.studentMemberResults
        : [];

    const existingMemberIndex =
      existingResults.findIndex(
        (member) =>
          cleanText(
            member?.email,
          ).toLowerCase() ===
          googleEmail,
      );

    if (
      existingMemberIndex >= 0 &&
      existingResults[
        existingMemberIndex
      ]?.success === true
    ) {
      return {
        success: true,
        alreadyAdded: true,
        email: googleEmail,
        roomId,
        message:
          "Student is already added to the Google Meet.",
      };
    }

    /* ----------------------------------------
       GET CENTRAL ADMIN GOOGLE ACCESS TOKEN
    ---------------------------------------- */

    const accessToken =
      await getGoogleMeetAccessToken(
        db,
      );

    /* ----------------------------------------
       ADD STUDENT TO GOOGLE MEET
    ---------------------------------------- */

    const memberResult =
      await addGoogleMeetMember({
        accessToken,
        googleSpaceName,
        email: googleEmail,
        role: "ROLE_UNSPECIFIED",
        db,
      });

    /* ----------------------------------------
       SAVE MEMBER RESULT
    ---------------------------------------- */

    const updatedResults =
      [...existingResults];

    const resultToSave = {
      uid: studentUid,
      email: googleEmail,
      success:
        memberResult?.success === true,
      role: "ROLE_UNSPECIFIED",
      status:
        memberResult?.status || null,
      errorStatus:
        memberResult?.errorStatus || null,
      message:
        memberResult?.message ||
        null,
      addedAt:
        new Date().toISOString(),
    };

    if (
      existingMemberIndex >= 0
    ) {
      updatedResults[
        existingMemberIndex
      ] = resultToSave;
    } else {
      updatedResults.push(
        resultToSave,
      );
    }

    await roomRef.set(
      {
        studentMemberResults:
          updatedResults,
        updatedAt:
          new Date(),
      },
      {
        merge: true,
      },
    );

    return {
      success:
        memberResult?.success === true,
      alreadyAdded: false,
      email: googleEmail,
      roomId,
      memberResult,
    };
  } catch (error) {
    console.error(
      "AUTO SYNC STUDENT TO GOOGLE MEET ERROR:",
      {
        studentUid,
        teacherUid,
        studentClass,
        error,
      },
    );

    return {
      success: false,
      skipped: false,
      reason:
        error?.message ||
        "Unable to synchronize student with Google Meet.",
    };
  }
}

export async function POST(
  request,
  { params },
) {
  try {
    const { id } =
      await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher ID is required.",
        },
        {
          status: 400,
        },
      );
    }


    const auth =
      getAdminAuth();

    const db =
      getAdminDb();


    /* ============================================
       CENTRAL ADMIN AUTH
    ============================================ */

    const admin =
      await verifyCentralAdmin(
        request,
        auth,
        db,
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
        },
      );
    }


    /* ============================================
       REQUEST BODY
    ============================================ */

    let body = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }


    const studentUids =
      Array.isArray(
        body?.studentUids,
      )
        ? [
            ...new Set(
              body.studentUids
                .map(
                  (uid) =>
                    cleanText(uid),
                )
                .filter(Boolean),
            ),
          ]
        : [];


    if (
      studentUids.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please select at least one Digital Student.",
        },
        {
          status: 400,
        },
      );
    }


    /* ============================================
       LOAD DIGITAL TEACHER
    ============================================ */

    const teacherSnapshot =
      await db
        .collection(
          TEACHER_COLLECTION,
        )
        .doc(id)
        .get();


    if (
      !teacherSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher not found.",
        },
        {
          status: 404,
        },
      );
    }


    const teacher =
      teacherSnapshot.data() ||
      {};


    /* ============================================
       TEACHER STATUS
    ============================================ */

    if (
      teacher?.status !==
      "approved"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher is not approved.",
        },
        {
          status: 400,
        },
      );
    }


    if (
      teacher?.accountStatus &&
      teacher?.accountStatus !==
        "active"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher account is not active.",
        },
        {
          status: 403,
        },
      );
    }


    /* ============================================
       DIGITAL TEACHER UID

       Prefer sourceTeacherUid because
       Digital Teacher uses normal Teacher account.
    ============================================ */

    const digitalTeacherUid =
      cleanText(
        teacher
          ?.sourceTeacherUid ||
        teacher
          ?.digitalTeacherUid,
      );


    if (!digitalTeacherUid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Digital Teacher Firebase UID not found.",
        },
        {
          status: 400,
        },
      );
    }


    /* ============================================
       TEACHER INFO
    ============================================ */

    const teacherName =
      cleanText(
        teacher?.fullName ||
        teacher?.teacherName ||
        teacher?.name,
      );


    const teacherEmail =
      cleanText(
        teacher
          ?.digitalTeacherEmail ||
        teacher?.email,
      );


    const teacherMhrId =
      cleanText(
        teacher?.mhrId ||
        teacher?.teacherId,
      );


    /* ============================================
       ASSIGN STUDENTS
    ============================================ */

    const assigned = [];

    const skipped = [];


    for (
      const studentUid
      of studentUids
    ) {
      /* ----------------------------------------
         LOAD STUDENT USER
      ---------------------------------------- */

      const studentRef =
        db
          .collection("users")
          .doc(studentUid);


      const studentSnapshot =
        await studentRef.get();


      if (
        !studentSnapshot.exists
      ) {
        skipped.push({
          studentUid,
          reason:
            "Digital Student user account not found.",
        });

        continue;
      }


      const student =
        studentSnapshot.data() ||
        {};


      /* ----------------------------------------
         MUST BE DIGITAL STUDENT
      ---------------------------------------- */

      if (
        student?.role !==
          "student" ||
        student?.userType !==
          "digital_student"
      ) {
        skipped.push({
          studentUid,
          reason:
            "This account is not a Digital Student.",
        });

        continue;
      }


      /* ----------------------------------------
         ALREADY ASSIGNED TO ANOTHER TEACHER
      ---------------------------------------- */

      if (
        student
          ?.teacherAssigned ===
          true &&
        student
          ?.assignedDigitalTeacherUid &&
        student
          ?.assignedDigitalTeacherUid !==
          digitalTeacherUid
      ) {
        skipped.push({
          studentUid,

          reason:
            `Student is already assigned to ${
              student
                ?.assignedDigitalTeacherName ||
              "another Digital Teacher"
            }.`,
        });

        continue;
      }


      /* ========================================
         GET STUDENT CLASS

         First try users/{uid}.
         If missing, try registration collection.
      ======================================== */

      let studentClass =
        getStudentClass(
          student,
        );


      if (!studentClass) {
        const registrationSnapshot =
          await db
            .collection(
              "digitalClassStudentRegistrations",
            )
            .where(
              "uid",
              "==",
              studentUid,
            )
            .limit(1)
            .get();


        if (
          !registrationSnapshot.empty
        ) {
          const registration =
            registrationSnapshot
              .docs[0]
              .data() || {};


          studentClass =
            registration
              ?.applyingclass ||
            registration
              ?.classLevel ||
            registration
              ?.class ||
            "";
        }
      }


      /* ========================================
         SAVE ASSIGNMENT DIRECTLY TO STUDENT
      ======================================== */

      await studentRef.set(
  {
    teacherAssigned:
      true,

    assignedDigitalTeacherApplicationId:
      id,

    assignedDigitalTeacherUid:
      digitalTeacherUid,

    assignedDigitalTeacherName:
      teacherName ||
      null,

    assignedDigitalTeacherEmail:
      teacherEmail ||
      null,

    assignedDigitalTeacherMhrId:
      teacherMhrId ||
      null,

    assignedDigitalTeacherClass:
      studentClass ||
      null,

    teacherAssignedAt:
      new Date(),

    teacherAssignedBy:
      admin.uid,

    teacherUnassignedAt:
      null,

    teacherUnassignedBy:
      null,

    updatedAt:
      new Date(),
  },
  {
    merge: true,
  },
);


/* ========================================
   AUTO ADD STUDENT TO EXISTING GOOGLE MEET

   Assignment must NOT fail if Meet sync
   fails or Meet does not exist yet.
======================================== */

const meetSync =
  await syncStudentToExistingMeet({
    db,
    studentUid,
    teacherUid:
      digitalTeacherUid,
    studentClass,
  });


assigned.push({
  studentUid,

  className:
    studentClass ||
    null,

  googleMeetSync:
    {
      success:
        meetSync?.success === true,

      alreadyAdded:
        meetSync?.alreadyAdded === true,

      skipped:
        meetSync?.skipped === true,

      email:
        meetSync?.email ||
        null,

      reason:
        meetSync?.reason ||
        null,
    },
});
    }


    /* ============================================
       NOTHING ASSIGNED
    ============================================ */

    if (
      assigned.length ===
        0 &&
      skipped.length > 0
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            skipped[0]?.reason ||
            "Unable to assign selected students.",

          assigned,

          skipped,
        },
        {
          status: 409,
        },
      );
    }


    /* ============================================
       SUCCESS
    ============================================ */

    return NextResponse.json(
      {
        success: true,

        message:
          assigned.length === 1
            ? "Digital Student assigned successfully."
            : `${assigned.length} Digital Students assigned successfully.`,

        teacher: {
          applicationId:
            id,

          uid:
            digitalTeacherUid,

          name:
            teacherName,

          email:
            teacherEmail,

          mhrId:
            teacherMhrId,
        },

        assigned,

        assignedCount:
          assigned.length,

        skipped,

        skippedCount:
          skipped.length,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "ASSIGN DIGITAL STUDENT ERROR:",
      error,
    );


    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to assign students.",
      },
      {
        status: 500,
      },
    );
  }
}

