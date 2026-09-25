import { NextResponse } from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function cleanText(value) {
  return String(value ?? "").trim();
}


/* ============================================
   VERIFY CENTRAL ADMIN
============================================ */

async function verifyCentralAdmin(
  request,
  auth,
  db,
) {
  const header =
    request.headers.get(
      "authorization",
    ) || "";

  if (
    !header.startsWith(
      "Bearer ",
    )
  ) {
    return null;
  }

  try {
    const token =
      header
        .slice(7)
        .trim();

    if (!token) {
      return null;
    }

    const decoded =
      await auth.verifyIdToken(
        token,
      );

    if (!decoded?.uid) {
      return null;
    }

    if (
      decoded?.role ===
        "central_admin" ||
      decoded?.role ===
        "admin"
    ) {
      return decoded;
    }

    const userSnap =
      await db
        .collection("users")
        .doc(decoded.uid)
        .get();

    if (!userSnap.exists) {
      return null;
    }

    const userData =
      userSnap.data() || {};

    if (
      userData?.role !==
        "central_admin" &&
      userData?.role !==
        "admin"
    ) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error(
      "VERIFY ADMIN ERROR:",
      error,
    );

    return null;
  }
}


/* ============================================
   LOAD DIGITAL STUDENT REGISTRATION PROFILE

   users/{uid} is assignment source of truth.

   Registration collection is used only to
   enrich student profile/details.
============================================ */

async function getDigitalStudentProfile(
  db,
  studentUid,
) {
  if (!studentUid) {
    return null;
  }

  try {
    /* ----------------------------------------
       CURRENT
       uid === Firebase UID
    ---------------------------------------- */

    const byUid =
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

    if (!byUid.empty) {
      const docSnap =
        byUid.docs[0];

      return {
        id:
          docSnap.id,

        ...docSnap.data(),
      };
    }


    /* ----------------------------------------
       LEGACY PROFILE FIELD
    ---------------------------------------- */

    const byStudentUid =
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

    if (
      !byStudentUid.empty
    ) {
      const docSnap =
        byStudentUid.docs[0];

      return {
        id:
          docSnap.id,

        ...docSnap.data(),
      };
    }


    /* ----------------------------------------
       DOCUMENT ID FALLBACK
    ---------------------------------------- */

    const directSnap =
      await db
        .collection(
          "digitalClassStudentRegistrations",
        )
        .doc(studentUid)
        .get();

    if (
      directSnap.exists
    ) {
      return {
        id:
          directSnap.id,

        ...directSnap.data(),
      };
    }

    return null;
  } catch (error) {
    console.error(
      "LOAD DIGITAL STUDENT PROFILE ERROR:",
      studentUid,
      error,
    );

    return null;
  }
}


/* ============================================
   GET ASSIGNED DIGITAL STUDENTS

   VIEW ONLY:
   - show assigned students
   - student details
   - used before unassign

   Assignment source:
   users/{studentUid}
============================================ */

export async function GET(
  request,
  { params },
) {
  try {
    const { id } =
      await params;

    const teacherApplicationId =
      cleanText(id);


    if (!teacherApplicationId) {
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


    /* ========================================
       CENTRAL ADMIN AUTH
    ======================================== */

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
            "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }


    /* ========================================
       LOAD SELECTED DIGITAL TEACHER
    ======================================== */

    const teacherSnap =
      await db
        .collection(
          "digitalClassTeacherRegistrations",
        )
        .doc(
          teacherApplicationId,
        )
        .get();


    if (!teacherSnap.exists) {
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
      teacherSnap.data() || {};


    /*
     * New Digital Teacher architecture:
     *
     * Normal Teacher Firebase UID
     * is also the Digital Teacher UID.
     *
     * sourceTeacherUid is preferred.
     */
    const digitalTeacherUid =
      cleanText(
        teacher?.sourceTeacherUid ||
        teacher?.digitalTeacherUid,
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


    /* ========================================
       LOAD ASSIGNED STUDENTS

       IMPORTANT:
       No digitalTeacherStudentAssignments.

       Assignment is directly stored in:

       users/{studentUid}

       teacherAssigned === true

       assignedDigitalTeacherUid
         === digitalTeacherUid
    ======================================== */

    const assignedSnapshot =
      await db
        .collection("users")
        .where(
          "assignedDigitalTeacherUid",
          "==",
          digitalTeacherUid,
        )
        .get();


    const assignedUserDocs =
      assignedSnapshot.docs.filter(
        (docSnap) => {
          const student =
            docSnap.data() || {};

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


    /* ========================================
       BUILD STUDENT DETAILS
    ======================================== */

    const students =
      await Promise.all(
        assignedUserDocs.map(
          async (userDoc) => {
            const userData =
              userDoc.data() ||
              {};

            const studentUid =
              cleanText(
                userData?.uid ||
                userDoc.id,
              );


            /*
             * Registration is only
             * additional profile data.
             *
             * Assignment data always
             * comes from users document.
             */
            const registration =
              await getDigitalStudentProfile(
                db,
                studentUid,
              );


            const profile =
              registration || {};


            const fullName =
              cleanText(
                userData?.fullName ||
                profile?.fullName ||
                userData?.studentName ||
                profile?.studentName ||
                userData?.name ||
                profile?.name,
              );


            const studentClass =
              cleanText(
                userData
                  ?.assignedDigitalTeacherClass ||
                userData?.className ||
                userData?.currentClass ||
                userData?.class ||
                userData?.classLevel ||
                profile?.applyingclass ||
                profile?.className ||
                profile?.currentClass ||
                profile?.class ||
                profile?.classLevel,
              );


            return {
              /*
               * Registration/profile fields
               */
              ...profile,

              /*
               * users document fields
               *
               * Keep this AFTER profile
               * because users is source
               * of truth for assignment.
               */
              ...userData,


              /* =================================
                 IDENTIFIERS
              ================================= */

              id:
                userDoc.id,

              uid:
                studentUid,

              studentUid:
                studentUid,


              /* =================================
                 DISPLAY FIELDS
              ================================= */

              fullName:
                fullName ||
                "Digital Student",

              name:
                fullName ||
                "Digital Student",

              studentClass,

              className:
                studentClass,

              class:
                studentClass,

              digitalAdmissionNumber:
                userData
                  ?.digitalAdmissionNumber ||
                profile
                  ?.digitalAdmissionNumber ||
                null,

              phone:
                userData?.phone ||
                profile?.phone ||
                userData
                  ?.mobileNumber ||
                profile
                  ?.mobileNumber ||
                userData
                  ?.guardianPhone ||
                profile
                  ?.guardianPhone ||
                null,

              gender:
                userData?.gender ||
                profile?.gender ||
                null,

              profilePicture:
                userData
                  ?.profilePicture ||
                userData
                  ?.profilePictureUrl ||
                profile
                  ?.profilePicture ||
                profile
                  ?.profilePictureUrl ||
                null,

              madrasaName:
                userData
                  ?.madarsaName ||
                userData
                  ?.madrasaName ||
                profile
                  ?.madarsaName ||
                profile
                  ?.madrasaName ||
                null,

              status:
                userData
                  ?.accountStatus ||
                userData?.status ||
                profile
                  ?.accountStatus ||
                profile?.status ||
                "active",


              /* =================================
                 CURRENT ASSIGNMENT
              ================================= */

              teacherAssigned:
                true,

              alreadyAssigned:
                true,

              assignedDigitalTeacherApplicationId:
                userData
                  ?.assignedDigitalTeacherApplicationId ||
                teacherApplicationId,

              assignedDigitalTeacherUid:
                userData
                  ?.assignedDigitalTeacherUid ||
                digitalTeacherUid,

              assignedDigitalTeacherName:
                userData
                  ?.assignedDigitalTeacherName ||
                null,

              assignedDigitalTeacherEmail:
                userData
                  ?.assignedDigitalTeacherEmail ||
                null,

              assignedDigitalTeacherMhrId:
                userData
                  ?.assignedDigitalTeacherMhrId ||
                null,

              assignedDigitalTeacherClass:
                userData
                  ?.assignedDigitalTeacherClass ||
                studentClass ||
                null,

              teacherAssignedAt:
                userData
                  ?.teacherAssignedAt ||
                null,

              teacherAssignedBy:
                userData
                  ?.teacherAssignedBy ||
                null,
            };
          },
        ),
      );


    /* ========================================
       RESPONSE
    ======================================== */

    return NextResponse.json({
      success: true,

      teacherApplicationId,

      teacherUid:
        digitalTeacherUid,

      teacher: {
        id:
          teacherApplicationId,

        uid:
          digitalTeacherUid,

        fullName:
          teacher?.fullName ||
          teacher?.teacherName ||
          teacher?.name ||
          "",

        email:
          teacher
            ?.digitalTeacherEmail ||
          teacher?.email ||
          "",

        mhrId:
          teacher?.mhrId ||
          teacher?.teacherId ||
          "",
      },

      assignedCount:
        students.length,

      students,
    });
  } catch (error) {
    console.error(
      "GET ASSIGNED DIGITAL STUDENTS ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Unable to load assigned Digital Students.",
      },
      {
        status: 500,
      },
    );
  }
}