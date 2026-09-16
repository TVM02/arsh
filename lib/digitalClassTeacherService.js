import {
  getAuth,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

const BASE_URL =
  "/api/digital-classroom/teacher";

/* ============================================
   REGISTER DIGITAL TEACHER
============================================ */

export async function registerDigitalTeacher(data) {
  try {
    const response = await fetch(
      `${BASE_URL}/register`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(data),
      },
    );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result?.message ||
          "Digital Teacher registration failed.",
      );
    }

    return result;
  } catch (error) {
    console.error(
      "REGISTER DIGITAL TEACHER ERROR:",
      error,
    );

    throw error;
  }
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
  studentIds,
) {
  if (!teacherId) {
    throw new Error(
      "Digital Teacher ID is required.",
    );
  }

  if (
    !Array.isArray(studentIds) ||
    studentIds.length === 0
  ) {
    throw new Error(
      "Please select at least one Digital Student.",
    );
  }

  const token =
    await getDigitalTeacherAdminToken();

  const response = await fetch(
    `/api/digital-classroom/teacher/${encodeURIComponent(
      teacherId,
    )}/students/assign`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        Authorization:
          `Bearer ${token}`,
      },

      body: JSON.stringify({
        studentIds,
      }),
    },
  );

  return await parseDigitalTeacherApiResponse(
    response,
  );
}

/* =========================================================
   3. UNASSIGN DIGITAL STUDENT
========================================================= */

export async function unassignDigitalStudent(
  teacherId,
  studentUid,
) {
  if (!teacherId) {
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
    await getDigitalTeacherAdminToken();

  const response = await fetch(
    `/api/digital-classroom/teacher/${encodeURIComponent(
      teacherId,
    )}/students/${encodeURIComponent(
      studentUid,
    )}`,
    {
      method: "DELETE",

      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    },
  );

  return await parseDigitalTeacherApiResponse(
    response,
  );
}