import { getAdminDb } from "@/lib/firebase-admin";


const COLLECTION =
  "digitalTeacherStudentAssignments";

/* ============================================
   CREATE / UPDATE STUDENT ASSIGNMENT
============================================ */

export async function createDigitalTeacherStudentAssignment({
  digitalTeacherUid,
  digitalTeacherApplicationId,

  studentUid,
  studentId,

  assignedClasses = [],
  assignedSubjects = [],
  teachingLanguages = [],

  assignedBy,
}) {
  if (!digitalTeacherUid) {
    throw new Error(
      "Digital Teacher UID is required.",
    );
  }

  if (!studentUid) {
    throw new Error(
      "Digital Student UID is required.",
    );
  }

  const db = getAdminDb();

  /*
    One teacher + one student
    = one assignment document

    This prevents duplicate assignment.
  */

  const assignmentId =
    `${digitalTeacherUid}_${studentUid}`;

  const assignmentRef =
    db
      .collection(COLLECTION)
      .doc(assignmentId);

  const existing =
    await assignmentRef.get();

  const now =
    new Date();

  const data = {
    digitalTeacherUid,

    digitalTeacherApplicationId:
      digitalTeacherApplicationId ||
      null,

    studentUid,

    studentId:
      studentId ||
      studentUid,

    assignedClasses:
      Array.isArray(
        assignedClasses,
      )
        ? assignedClasses
        : [],

    assignedSubjects:
      Array.isArray(
        assignedSubjects,
      )
        ? assignedSubjects
        : [],

    teachingLanguages:
      Array.isArray(
        teachingLanguages,
      )
        ? teachingLanguages
        : [],

    status:
      "active",

    assignedBy:
      assignedBy ||
      null,

    updatedAt:
      now,
  };

  /*
    Only set assignedAt
    first time.
  */

 if (
  !existing.exists ||
  existing.data()?.status !== "active"
) {
  data.assignedAt = now;

  data.unassignedAt = null;
  data.unassignedBy = null;
}

  await assignmentRef.set(
    data,
    {
      merge: true,
    },
  );

  return {
    id:
      assignmentId,

    ...data,
  };
}

/* ============================================
   GET STUDENTS ASSIGNED TO TEACHER
============================================ */

export async function getDigitalTeacherStudentAssignments(
  digitalTeacherUid,
) {
  if (!digitalTeacherUid) {
    throw new Error(
      "Digital Teacher UID is required.",
    );
  }

  const db =
    getAdminDb();

  const snapshot =
    await db
      .collection(COLLECTION)
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

  return snapshot.docs.map(
    (doc) => ({
      id: doc.id,
      ...doc.data(),
    }),
  );
}

/* ============================================
   CHECK STUDENT ALREADY ASSIGNED
============================================ */

export async function isStudentAssignedToDigitalTeacher(
  digitalTeacherUid,
  studentUid,
) {
  if (
    !digitalTeacherUid ||
    !studentUid
  ) {
    return false;
  }

  const db =
    getAdminDb();

  const assignmentId =
    `${digitalTeacherUid}_${studentUid}`;

  const snapshot =
    await db
      .collection(COLLECTION)
      .doc(assignmentId)
      .get();

  if (!snapshot.exists) {
    return false;
  }

  const data =
    snapshot.data();

  return (
    data?.status ===
    "active"
  );
}