import {
  getAuth,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

const BASE_URL =
  "/api/digital-classroom/teacher";

/* ============================================
   REGISTER DIGITAL TEACHER
============================================ */

export async function registerDigitalTeacher(
  registrationData,
) {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login with your Teacher account.",
    );
  }

  const idToken =
    await currentUser.getIdToken(
      true,
    );

  const response =
    await fetch(
      "/api/digital-classroom/teacher/register",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${idToken}`,
        },

        body:
          JSON.stringify(
            registrationData,
          ),
      },
    );

  const text =
    await response.text();

  let result;

  try {
    result =
      text
        ? JSON.parse(text)
        : {};
  } catch (error) {
    console.error(
      "REGISTER DIGITAL TEACHER INVALID RESPONSE:",
      text,
    );

    throw new Error(
      "Invalid response from Digital Teacher registration API.",
    );
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        "Digital Teacher registration failed.",
    );
  }

  return result;
}

/* ============================================
   GET ALL DIGITAL TEACHER APPLICATIONS
   We will create API later.
============================================ */

export async function getDigitalTeachers() {
  try {
    const { getAuth } =
      await import(
        "firebase/auth"
      );

    const auth =
      getAuth();

    const currentUser =
      auth.currentUser;

    if (!currentUser) {
      throw new Error(
        "Central Admin Firebase session not found.",
      );
    }

    const idToken =
      await currentUser.getIdToken();

    const response =
      await fetch(
        BASE_URL,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${idToken}`,
          },

          cache: "no-store",
        },
      );

    const rawResponse =
      await response.text();

    console.log(
      "GET DIGITAL TEACHERS STATUS:",
      response.status,
    );

    console.log(
      "GET DIGITAL TEACHERS RESPONSE:",
      rawResponse,
    );

    let result;

    try {
      result =
        rawResponse
          ? JSON.parse(
              rawResponse,
            )
          : {};
    } catch {
      throw new Error(
        `Digital Teacher API returned invalid response. HTTP ${response.status}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        result?.message ||
          "Failed to load Digital Teachers.",
      );
    }

    return result;
  } catch (error) {
    console.error(
      "GET DIGITAL TEACHERS ERROR:",
      error,
    );

    throw error;
  }
}


export async function getDigitalTeacherStatus(
  uid,
) {
  if (!uid) {
    throw new Error(
      "Teacher UID is required.",
    );
  }

  const response = await fetch(
    `/api/digital-classroom/teacher/status/${encodeURIComponent(
      uid,
    )}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  const result =
    await response.json();

  if (!response.ok) {
    throw new Error(
      result?.message ||
        "Failed to load Digital Teacher status.",
    );
  }

  return result;
}

export async function approveDigitalTeacher(
  id,
  data,
) {
  try {
    if (!id) {
      throw new Error(
        "Digital Teacher application ID is required.",
      );
    }

    const { getAuth } =
      await import("firebase/auth");

    const auth = getAuth();

    const currentUser =
      auth.currentUser;

    if (!currentUser) {
      throw new Error(
        "Central Admin Firebase session not found.",
      );
    }

    const idToken =
      await currentUser.getIdToken(
        true,
      );

    const url =
      `/api/digital-classroom/teacher/${encodeURIComponent(
        id,
      )}/approve`;

    console.log(
      "==============================",
    );

    console.log(
      "APPROVE DIGITAL TEACHER URL:",
      url,
    );

    console.log(
      "APPLICATION ID:",
      id,
    );

    const response =
      await fetch(url, {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          Authorization:
            `Bearer ${idToken}`,
        },

        body:
          JSON.stringify(data),

        cache: "no-store",
      });
console.log(
  "APPROVE STATUS:",
  response.status,
);

console.log(
  "APPROVE REDIRECTED:",
  response.redirected,
);

console.log(
  "APPROVE RESPONSE URL:",
  response.url,
);

console.log(
  "APPROVE LOCATION:",
  response.headers.get("location"),
);

    /* ============================================
       IMPORTANT:
       DO NOT CALL response.json()
    ============================================ */

    const contentType =
      response.headers.get(
        "content-type",
      ) || "";

    const rawResponse =
      await response.text();

    console.log(
      "APPROVE STATUS:",
      response.status,
    );

    console.log(
      "APPROVE CONTENT TYPE:",
      contentType,
    );

    console.log(
      "APPROVE RAW RESPONSE:",
      rawResponse,
    );

    console.log(
      "==============================",
    );

    /* ============================================
       HTML RESPONSE
    ============================================ */

    if (
      rawResponse
        .trim()
        .startsWith("<!DOCTYPE") ||
      rawResponse
        .trim()
        .startsWith("<html")
    ) {
      throw new Error(
        `Approve API returned HTML instead of JSON. HTTP ${response.status}. Check Next.js terminal.`,
      );
    }

    /* ============================================
       PARSE JSON SAFELY
    ============================================ */

    let result = {};

    if (rawResponse) {
      try {
        result =
          JSON.parse(
            rawResponse,
          );
      } catch (parseError) {
        console.error(
          "INVALID API JSON:",
          rawResponse,
        );

        throw new Error(
          `Approve API returned invalid response. HTTP ${response.status}`,
        );
      }
    }

    /* ============================================
       API ERROR
    ============================================ */

    if (!response.ok) {
      throw new Error(
        result?.message ||
          result?.error ||
          `Digital Teacher approval failed. HTTP ${response.status}`,
      );
    }

    return result;
  } catch (error) {
    console.error(
      "APPROVE DIGITAL TEACHER SERVICE ERROR:",
      error,
    );

    throw error;
  }
}
export async function rejectDigitalTeacher(
  id,
  data,
) {
  try {
    if (!id) {
      throw new Error(
        "Digital Teacher application ID is required.",
      );
    }

    const { getAuth } =
      await import("firebase/auth");

    const auth = getAuth();

    const currentUser =
      auth.currentUser;

    if (!currentUser) {
      throw new Error(
        "Central Admin Firebase session not found.",
      );
    }

    const idToken =
      await currentUser.getIdToken();

    const response =
      await fetch(
        `${BASE_URL}/${encodeURIComponent(
          id,
        )}/reject`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",

            Authorization:
              `Bearer ${idToken}`,
          },

          body:
            JSON.stringify(data),

          cache: "no-store",
        },
      );

    const rawResponse =
      await response.text();

    let result = {};

    try {
      result =
        rawResponse
          ? JSON.parse(
              rawResponse,
            )
          : {};
    } catch {
      throw new Error(
        `Reject API returned invalid response. HTTP ${response.status}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        result?.message ||
          "Digital Teacher rejection failed.",
      );
    }

    return result;
  } catch (error) {
    console.error(
      "REJECT DIGITAL TEACHER ERROR:",
      error,
    );

    throw error;
  }
}
export async function deleteDigitalTeacher(
  id,
) {
  try {
    if (!id) {
      throw new Error(
        "Digital Teacher application ID is required.",
      );
    }

    const { getAuth } =
      await import("firebase/auth");

    const auth =
      getAuth();

    const currentUser =
      auth.currentUser;

    if (!currentUser) {
      throw new Error(
        "Central Admin session not found.",
      );
    }

    const idToken =
      await currentUser.getIdToken();

    const response =
      await fetch(
        `${BASE_URL}/${encodeURIComponent(
          id,
        )}/delete`,
        {
          method: "DELETE",

          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${idToken}`,
          },

          cache: "no-store",
        },
      );

    const rawResponse =
      await response.text();

    let result = {};

    try {
      result =
        rawResponse
          ? JSON.parse(
              rawResponse,
            )
          : {};
    } catch {
      throw new Error(
        `Delete API returned invalid response. HTTP ${response.status}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        result?.message ||
          "Digital Teacher deletion failed.",
      );
    }

    return result;
  } catch (error) {
    console.error(
      "DELETE DIGITAL TEACHER SERVICE ERROR:",
      error,
    );

    throw error;
  }
}
export async function updateDigitalTeacher(
  id,
  data,
) {
  try {
    if (!id) {
      throw new Error(
        "Digital Teacher application ID is required.",
      );
    }

    const { getAuth } =
      await import(
        "firebase/auth"
      );

    const auth =
      getAuth();

    const currentUser =
      auth.currentUser;

    if (!currentUser) {
      throw new Error(
        "Central Admin session not found.",
      );
    }

    const idToken =
      await currentUser.getIdToken();

    const response =
      await fetch(
        `${BASE_URL}/${encodeURIComponent(
          id,
        )}/update`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",

            Authorization:
              `Bearer ${idToken}`,
          },

          body:
            JSON.stringify(data),

          cache:
            "no-store",
        },
      );

    const rawResponse =
      await response.text();

    let result = {};

    try {
      result =
        rawResponse
          ? JSON.parse(
              rawResponse,
            )
          : {};
    } catch {
      throw new Error(
        `Digital Teacher update API returned invalid response. HTTP ${response.status}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        result?.message ||
          "Digital Teacher update failed.",
      );
    }

    return result;
  } catch (error) {
    console.error(
      "UPDATE DIGITAL TEACHER SERVICE ERROR:",
      error,
    );

    throw error;
  }
}
/* =========================================================
   DIGITAL TEACHER → DIGITAL STUDENT ASSIGNMENT
========================================================= */

/* ---------------------------------------------------------
   GET FIREBASE ID TOKEN
--------------------------------------------------------- */

async function getDigitalTeacherAdminToken() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "You are not logged in. Please login again.",
    );
  }

  return await user.getIdToken(true);
}

/* ---------------------------------------------------------
   SAFE API RESPONSE
--------------------------------------------------------- */

async function parseDigitalTeacherApiResponse(response) {
  const text = await response.text();

  let data = null;

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch (error) {
    console.error(
      "INVALID API RESPONSE:",
      text,
    );

    throw new Error(
      `Server returned an invalid response (${response.status}).`,
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Request failed with status ${response.status}`,
    );
  }

  return data;
}

/* =========================================================
   1. GET ELIGIBLE DIGITAL STUDENTS
========================================================= */

export async function getEligibleDigitalStudents(
  teacherId,
) {
  if (!teacherId) {
    throw new Error(
      "Digital Teacher ID is required.",
    );
  }

  const token =
    await getDigitalTeacherAdminToken();

  const response = await fetch(
    `/api/digital-classroom/teacher/${encodeURIComponent(
      teacherId,
    )}/students`,
    {
      method: "GET",

      headers: {
        Authorization:
          `Bearer ${token}`,
      },

      cache: "no-store",
    },
  );

  return await parseDigitalTeacherApiResponse(
    response,
  );
}

/* =========================================================
   2. ASSIGN DIGITAL STUDENTS
========================================================= */

export async function assignDigitalStudents(
  teacherId,
  studentUids,
) {
  if (!teacherId) {
    throw new Error(
      "Digital Teacher ID is required.",
    );
  }

  const cleanStudentUids =
    Array.isArray(studentUids)
      ? [
          ...new Set(
            studentUids
              .map((uid) =>
                String(
                  uid || "",
                ).trim(),
              )
              .filter(Boolean),
          ),
        ]
      : [];


  if (
    cleanStudentUids.length ===
    0
  ) {
    throw new Error(
      "Please select at least one Digital Student.",
    );
  }


  const { auth } =
    await import(
      "@/lib/firebase"
    );


  const currentUser =
    auth.currentUser;


  if (!currentUser) {
    throw new Error(
      "Please login again.",
    );
  }


  const idToken =
    await currentUser.getIdToken(
      true,
    );


  const url =
    `/api/digital-classroom/teacher/${encodeURIComponent(
      teacherId,
    )}/students`;





  const response =
    await fetch(
      url,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          Authorization:
            `Bearer ${idToken}`,
        },

        body:
          JSON.stringify({
            studentUids:
              cleanStudentUids,
          }),
      },
    );


  /*
   * Read as text first.
   * This lets us see Next.js HTML/text
   * errors as well as JSON errors.
   */
  const raw =
    await response.text();


  let data = {};


  if (raw) {
    try {
      data =
        JSON.parse(raw);
    } catch {
      data = {};
    }
  }




  if (!response.ok) {
    const serverMessage =
      data?.message ||
      data?.error ||
      raw;


    throw new Error(
      serverMessage
        ? `HTTP ${response.status}: ${serverMessage}`
        : `Unable to assign students. HTTP ${response.status}`,
    );
  }


  return data;
}

/* =========================================================
   3. UNASSIGN DIGITAL STUDENT
========================================================= */

export async function unassignDigitalStudent(
  teacherApplicationId,
  studentUid,
) {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first.",
    );
  }

  if (!teacherApplicationId) {
    throw new Error(
      "Digital Teacher ID is required.",
    );
  }

  if (!studentUid) {
    throw new Error(
      "Digital Student UID is required.",
    );
  }

  const token =
    await currentUser.getIdToken(
      true,
    );

  const response =
    await fetch(
      `/api/digital-classroom/teacher/${encodeURIComponent(
        teacherApplicationId,
      )}/students/${encodeURIComponent(
        studentUid,
      )}`,
      {
        method: "DELETE",

        headers: {
          Authorization:
            `Bearer ${token}`,

          Accept:
            "application/json",
        },
      },
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        "Unable to unassign student.",
    );
  }

  return data;
}


export async function getAssignedDigitalStudents(
  teacherApplicationId,
) {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first.",
    );
  }

  if (!teacherApplicationId) {
    throw new Error(
      "Digital Teacher ID is required.",
    );
  }

  const token =
    await currentUser.getIdToken(
      true,
    );

  const url =
  `/api/digital-classroom/teacher/${encodeURIComponent(
    teacherApplicationId,
  )}/students/assign`;


  const response =
    await fetch(url, {
      method: "GET",

      headers: {
        Authorization:
          `Bearer ${token}`,

        Accept:
          "application/json",
      },

      cache:
        "no-store",
    });


  const text =
    await response.text();


  if (!text) {
    throw new Error(
      `Assigned Students API returned an empty response. HTTP ${response.status}`,
    );
  }

  let data;

  try {
    data =
      JSON.parse(text);
  } catch (error) {
    console.error(
      "INVALID ASSIGNED STUDENTS RESPONSE:",
      text,
    );

    throw new Error(
      `Assigned Students API returned invalid JSON. HTTP ${response.status}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Unable to load assigned students. HTTP ${response.status}`,
    );
  }

  return data;
}

export async function getMyAssignedDigitalStudents() {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first.",
    );
  }

  const teacherUid =
    currentUser.uid;

  const token =
    await currentUser.getIdToken(
      true,
    );

  const url =
    `/api/digital-classroom/teacher/${encodeURIComponent(
      teacherUid,
    )}/students`;

 

  const response =
    await fetch(url, {
      method: "GET",

      headers: {
        Authorization:
          `Bearer ${token}`,

        Accept:
          "application/json",
      },

      cache: "no-store",
    });

  const raw =
    await response.text();

 
  let data = {};

  if (raw) {
    try {
      data =
        JSON.parse(raw);
    } catch {
      throw new Error(
        `Digital Teacher Students API returned invalid JSON. HTTP ${response.status}`,
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Unable to load assigned students. HTTP ${response.status}`,
    );
  }

  return data;
}

/* =========================================================
   DIGITAL TEACHER → SAVE STUDENT ATTENDANCE
========================================================= */

export async function saveDigitalTeacherAttendance(data) {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Please login first.");
  }

  if (!data?.date) {
    throw new Error("Attendance date is required.");
  }

  if (!data?.className) {
    throw new Error("Class is required.");
  }

  if (
    !Array.isArray(data?.attendance) ||
    data.attendance.length === 0
  ) {
    throw new Error("Attendance records are required.");
  }

  const teacherUid = currentUser.uid;

  const token = await currentUser.getIdToken(true);

  const response = await fetch(
    `/api/digital-classroom/teacher/${encodeURIComponent(
      teacherUid
    )}/attendance`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify(data),
    }
  );

  const raw = await response.text();

  let result = {};

  if (raw) {
    try {
      result = JSON.parse(raw);
    } catch {
      throw new Error(
        `Attendance API returned invalid JSON. HTTP ${response.status}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Unable to save attendance. HTTP ${response.status}`
    );
  }

  return result;
}

/* =========================================================
   DIGITAL TEACHER → GET SAVED ATTENDANCE
========================================================= */

export async function getDigitalTeacherAttendance({
  date,
  className,
}) {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  if (!date) {
    throw new Error(
      "Attendance date is required."
    );
  }

  if (!className) {
    throw new Error(
      "Class is required."
    );
  }

  const teacherUid =
    currentUser.uid;

  const token =
    await currentUser.getIdToken(
      true
    );

  const query =
    new URLSearchParams({
      date:
        String(date),

      className:
        String(className),
    });

  const url =
    `/api/digital-classroom/teacher/${encodeURIComponent(
      teacherUid
    )}/attendance?${query.toString()}`;

  const response =
    await fetch(url, {
      method: "GET",

      headers: {
        Authorization:
          `Bearer ${token}`,

        Accept:
          "application/json",
      },

      cache:
        "no-store",
    });

  const raw =
    await response.text();

  let result = {};

  if (raw) {
    try {
      result =
        JSON.parse(raw);
    } catch {
      throw new Error(
        `Attendance API returned invalid JSON. HTTP ${response.status}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Unable to load attendance. HTTP ${response.status}`
    );
  }

  return result;
}

/* =========================================================
   DIGITAL TEACHER → SCHEDULE LIVE CLASS
========================================================= */

export async function scheduleDigitalLiveClass(data) {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  if (!data?.title) {
    throw new Error(
      "Class title is required."
    );
  }

  if (!data?.subject) {
    throw new Error(
      "Subject is required."
    );
  }

  if (!data?.className) {
    throw new Error(
      "Class is required."
    );
  }

  if (!data?.date) {
    throw new Error(
      "Class date is required."
    );
  }

  if (!data?.startTime) {
    throw new Error(
      "Start time is required."
    );
  }

  if (!data?.endTime) {
    throw new Error(
      "End time is required."
    );
  }



  const teacherUid =
    currentUser.uid;

  const token =
    await currentUser.getIdToken(
      true
    );

  const response =
    await fetch(
      `/api/digital-classroom/teacher/${encodeURIComponent(
        teacherUid
      )}/live-classes`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body:
          JSON.stringify(data),
      }
    );

  const raw =
    await response.text();

  let result = {};

  if (raw) {
    try {
      result =
        JSON.parse(raw);
    } catch {
      throw new Error(
        `Live Class API returned invalid JSON. HTTP ${response.status}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Unable to schedule Live Class. HTTP ${response.status}`
    );
  }

  return result;
}

/* =========================================================
   DIGITAL TEACHER → GET LIVE CLASSES
========================================================= */

export async function getMyDigitalLiveClasses() {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  const teacherUid =
    currentUser.uid;

  const token =
    await currentUser.getIdToken(
      true
    );

  const response =
    await fetch(
      `/api/digital-classroom/teacher/${encodeURIComponent(
        teacherUid
      )}/live-classes`,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        cache: "no-store",
      }
    );

  const raw =
    await response.text();

  let result = {};

  if (raw) {
    try {
      result =
        JSON.parse(raw);
    } catch {
      throw new Error(
        `Live Classes API returned invalid JSON. HTTP ${response.status}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Unable to load Live Classes. HTTP ${response.status}`
    );
  }

  return result;
}

/* =========================================================
   DIGITAL TEACHER → DELETE LIVE CLASS
========================================================= */

export async function deleteDigitalLiveClass(
  classId
) {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  if (!classId) {
    throw new Error(
      "Live Class ID is required."
    );
  }

  const teacherUid =
    currentUser.uid;

  const token =
    await currentUser.getIdToken(
      true
    );

  const response =
    await fetch(
      `/api/digital-classroom/teacher/${encodeURIComponent(
        teacherUid
      )}/live-classes`,
      {
        method: "DELETE",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body: JSON.stringify({
          classId,
        }),
      }
    );

  const raw =
    await response.text();

  let result = {};

  if (raw) {
    try {
      result =
        JSON.parse(raw);
    } catch {
      throw new Error(
        `Delete Live Class API returned invalid JSON. HTTP ${response.status}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Unable to delete Live Class. HTTP ${response.status}`
    );
  }

  return result;
}

/* =========================================================
   DIGITAL TEACHER → UPDATE LIVE CLASS
========================================================= */

export async function updateDigitalLiveClass(
  data
) {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  if (!data?.classId) {
    throw new Error(
      "Live Class ID is required."
    );
  }

  const teacherUid =
    currentUser.uid;

  const token =
    await currentUser.getIdToken(
      true
    );

  const response =
    await fetch(
      `/api/digital-classroom/teacher/${encodeURIComponent(
        teacherUid
      )}/live-classes`,
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body:
          JSON.stringify(data),
      }
    );

  const raw =
    await response.text();

  let result = {};

  if (raw) {
    try {
      result =
        JSON.parse(raw);
    } catch {
      throw new Error(
        `Update Live Class API returned invalid JSON. HTTP ${response.status}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Unable to update Live Class. HTTP ${response.status}`
    );
  }

  return result;
}

/* =========================================================
   DIGITAL TEACHER → GET CENTRAL ADMIN MESSAGES
========================================================= */

export async function getDigitalTeacherAdminMessages() {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  const teacherUid =
    currentUser.uid;

  const token =
    await currentUser.getIdToken(
      true
    );

  const response =
    await fetch(
      `/api/digital-classroom/teacher/${encodeURIComponent(
        teacherUid
      )}/messages/admin`,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        cache: "no-store",
      }
    );

  const raw =
    await response.text();

  let result = {};

  if (raw) {
    try {
      result =
        JSON.parse(raw);
    } catch {
      throw new Error(
        `Admin Messages API returned invalid JSON. HTTP ${response.status}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Unable to load Central Admin messages. HTTP ${response.status}`
    );
  }

  return result;
}

/* =========================================================
   DIGITAL TEACHER → MARK ADMIN MESSAGE AS READ
========================================================= */

export async function markDigitalTeacherAdminMessageRead(
  noticeId
) {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  if (!noticeId) {
    throw new Error(
      "Notice ID is required."
    );
  }

  const teacherUid =
    currentUser.uid;

  const token =
    await currentUser.getIdToken(
      true
    );

  const response =
    await fetch(
      `/api/digital-classroom/teacher/${encodeURIComponent(
        teacherUid
      )}/messages/admin`,
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body:
          JSON.stringify({
            noticeId,
          }),
      }
    );

  const raw =
    await response.text();

  let result = {};

  if (raw) {
    try {
      result =
        JSON.parse(raw);
    } catch {
      throw new Error(
        `Mark Admin Message Read API returned invalid JSON. HTTP ${response.status}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Unable to mark message as read. HTTP ${response.status}`
    );
  }

  return result;
}

/* =========================================================
   DIGITAL TEACHER → SEND MESSAGE TO STUDENTS
========================================================= */

export async function sendDigitalTeacherStudentMessage(
  data
) {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  if (!data?.title?.trim()) {
    throw new Error(
      "Message title is required."
    );
  }

  if (!data?.message?.trim()) {
    throw new Error(
      "Message is required."
    );
  }

  if (!data?.recipientType) {
    throw new Error(
      "Recipient type is required."
    );
  }

  const teacherUid =
    currentUser.uid;

  const token =
    await currentUser.getIdToken(
      true
    );

  const response =
    await fetch(
      `/api/digital-classroom/teacher/${encodeURIComponent(
        teacherUid
      )}/messages/students`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body:
          JSON.stringify({
            title:
              data.title.trim(),

            message:
              data.message.trim(),

            recipientType:
              data.recipientType,

            className:
              data.className ||
              "",

            studentUid:
              data.studentUid ||
              "",
          }),
      }
    );

  const raw =
    await response.text();

  let result = {};

  if (raw) {
    try {
      result =
        JSON.parse(raw);
    } catch {
      throw new Error(
        `Send Student Message API returned invalid JSON. HTTP ${response.status}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Unable to send message. HTTP ${response.status}`
    );
  }

  return result;
}


/* =========================================================
   DIGITAL TEACHER → GET SENT STUDENT MESSAGES
========================================================= */

export async function getDigitalTeacherSentMessages() {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  const teacherUid =
    currentUser.uid;

  const token =
    await currentUser.getIdToken(
      true
    );

  const response =
    await fetch(
      `/api/digital-classroom/teacher/${encodeURIComponent(
        teacherUid
      )}/messages/students`,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        cache: "no-store",
      }
    );

  const raw =
    await response.text();

  let result = {};

  if (raw) {
    try {
      result =
        JSON.parse(raw);
    } catch {
      throw new Error(
        `Sent Messages API returned invalid JSON. HTTP ${response.status}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Unable to load sent messages. HTTP ${response.status}`
    );
  }

  return result;
}



export async function deleteDigitalTeacherStudentMessage(
  messageId
) {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  if (!messageId) {
    throw new Error(
      "Message ID is required."
    );
  }

  const teacherUid =
    currentUser.uid;

  const token =
    await currentUser.getIdToken(
      true
    );

  const response =
    await fetch(
      `/api/digital-classroom/teacher/${encodeURIComponent(
        teacherUid
      )}/messages/students`,
      {
        method: "DELETE",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body:
          JSON.stringify({
            messageId,
          }),
      }
    );

  const raw =
    await response.text();

  let result = {};

  if (raw) {
    try {
      result =
        JSON.parse(raw);
    } catch {
      throw new Error(
        `Delete Message API returned invalid JSON. HTTP ${response.status}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Unable to delete message. HTTP ${response.status}`
    );
  }

  return result;
}

/* =========================================================
   DIGITAL TEACHER → JOIN LIVE CLASS
========================================================= */

export async function joinDigitalLiveClass(
  classId
) {
  if (!classId) {
    throw new Error(
      "Live Class ID is required."
    );
  }


  const currentUser =
    auth.currentUser;


  if (!currentUser) {
    throw new Error(
      "Please login again."
    );
  }


  const teacherUid =
    currentUser.uid;


  const token =
    await currentUser.getIdToken(
      true
    );


  const url =
    `/api/digital-classroom/teacher/${encodeURIComponent(
      teacherUid
    )}/live-classes/join`;


  const response =
    await fetch(
      url,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body:
          JSON.stringify({
            classId,
          }),

        cache:
          "no-store",
      }
    );


  const raw =
    await response.text();


  let data = {};


  if (raw) {
    try {

      data =
        JSON.parse(raw);

    } catch {

      console.error(
        "INVALID TEACHER JOIN RESPONSE:",
        raw
      );

      throw new Error(
        `Teacher Join API returned invalid JSON. HTTP ${response.status}`
      );
    }
  }


  console.log(
    "TEACHER SECURE JOIN RESPONSE:",
    {
      status:
        response.status,

      success:
        data?.success,

      classId:
        data?.classId,

      meet:
        data?.meet,
    }
  );


  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Unable to authorize Live Class. HTTP ${response.status}`
    );
  }


  if (
    data?.success !== true
  ) {
    throw new Error(
      data?.message ||
      "Unable to authorize Live Class."
    );
  }


  /*
   * IMPORTANT:
   *
   * CREATOR_APP_ONLY flow does NOT
   * use joinUrl anymore.
   *
   * The secure API returns:
   *
   * data.meet.meetingCode
   * data.meet.googleSpaceName
   * data.meet.entryPointAccess
   * data.meet.creatorAppOnly
   */

  



  return data;
}