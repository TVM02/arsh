import {
  auth,
} from "@/lib/firebase";


const BASE_URL = "/api/digital-classroom/student";

// ==========================================
// Register Student
// ==========================================
export async function registerDigitalStudent(data) {
  const response = await fetch(`${BASE_URL}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Registration failed");
  }

  return result;
}

// ==========================================
// Get All Students
// ==========================================
export async function getDigitalStudents() {
  const response = await fetch(
    BASE_URL,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const result =
    await response.json();

  if (!response.ok) {
    throw new Error(
      result.message ||
      "Failed to fetch Digital Classroom students"
    );
  }

  return result;
}

// ==========================================
// Get Single Student
// ==========================================
export async function getDigitalStudent(id) {
  if (!id) {
    throw new Error("Student registration ID is required");
  }

  const response = await fetch(`${BASE_URL}/${id}`, {
    method: "GET",
    cache: "no-store",
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to fetch student");
  }

  return result;
}

// ==========================================
// Update Student
// ==========================================
export async function updateDigitalStudent(
  id,
  data
) {
  const response = await fetch(
    `/api/digital-classroom/student/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error(
      "UPDATE DIGITAL STUDENT API ERROR:",
      result
    );

    throw new Error(
      result.message ||
        "Failed to update student"
    );
  }

  return result;
}

// ==========================================
// Delete Student
// ==========================================
export async function deleteDigitalStudent(id) {
  const response = await fetch(
    `/api/digital-classroom/student/${id}`,
    {
      method: "DELETE",
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message ||
        "Failed to delete Digital Classroom student"
    );
  }

  return result;
}

// ==========================================
// Approve Student
// ==========================================
export async function approveDigitalStudent(
  id,
  credentials
) {
  const response = await fetch(
    `/api/digital-classroom/student/${id}/approve`,
    {
      method: "PATCH",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        adminUid: credentials.adminUid,
        email: credentials.email,
        password: credentials.password,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message ||
        "Student approval failed"
    );
  }

  return result;
}
// -------------------------------------
// Reject Digital Student
// -------------------------------------

export async function rejectDigitalStudent(
  id,
  reason,
  adminUid
) {
  const response = await fetch(
    `${BASE_URL}/${id}/reject`,
    {
      method: "PATCH",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        reason,
        adminUid,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message ||
        "Student rejection failed"
    );
  }

  return result;
}

// ==========================================
// Check Registration Status
// ==========================================
export async function getStudentByOldMid(mid) {
  const response = await fetch(
    `/api/digital-classroom/student/by-mid/${encodeURIComponent(
      mid
    )}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const result = await response.json();

  if (response.status === 404) {
    return {
      success: false,
      found: false,
    };
  }

  if (!response.ok) {
    throw new Error(
      result.message ||
        "Failed to search student"
    );
  }

  return result;
}



export async function getMyDigitalStudentLiveClasses() {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  const token =
    await currentUser.getIdToken(
      true
    );

  const response =
    await fetch(
      "/api/digital-classroom/student/live-classes",
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${token}`,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        "Unable to load Live Classes."
    );
  }

  return data;
}

/* =========================================================
   GET LOGGED-IN DIGITAL STUDENT STUDY MATERIALS
========================================================= */

export async function getMyDigitalStudentStudyMaterials() {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  const token =
    await currentUser.getIdToken(
      true
    );

  const response =
    await fetch(
      "/api/digital-classroom/student/study-materials",
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${token}`,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );

  const raw =
    await response.text();

  let data = {};

  try {
    data =
      raw
        ? JSON.parse(raw)
        : {};
  } catch (error) {
    console.error(
      "INVALID STUDENT STUDY MATERIALS RESPONSE:",
      raw
    );

    throw new Error(
      "Study Materials API returned invalid JSON."
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Unable to load Study Materials. HTTP ${response.status}`
    );
  }

  return data;
}

/* =========================================================
   DOWNLOAD DIGITAL STUDENT STUDY MATERIAL
========================================================= */

export async function downloadDigitalStudentStudyMaterial(
  materialOrId
) {
  const materialId =
    typeof materialOrId ===
    "string"
      ? materialOrId.trim()
      : String(
          materialOrId?.id ||
            ""
        ).trim();

  if (!materialId) {
    throw new Error(
      "Material ID is required."
    );
  }

  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  const token =
    await currentUser.getIdToken(
      true
    );

  const response =
    await fetch(
      "/api/digital-classroom/student/study-materials/download",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            materialId,
          }),

        cache:
          "no-store",
      }
    );

  if (!response.ok) {
    const raw =
      await response.text();

    let message =
      `Download failed. HTTP ${response.status}`;

    try {
      const data =
        raw
          ? JSON.parse(raw)
          : {};

      message =
        data?.message ||
        data?.error ||
        message;
    } catch {
      // keep default message
    }

    throw new Error(
      message
    );
  }

  const blob =
    await response.blob();

  const disposition =
    response.headers.get(
      "content-disposition"
    ) || "";

  let fileName =
    "study-material";

  const match =
    disposition.match(
      /filename="?([^"]+)"?/i
    );

  if (match?.[1]) {
    fileName =
      match[1];
  }

  const objectUrl =
    window.URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    objectUrl;

  link.download =
    fileName;

  document.body.appendChild(
    link
  );

  link.click();

  document.body.removeChild(
    link
  );

  window.URL.revokeObjectURL(
    objectUrl
  );

  return {
    success: true,
  };
}

/* =========================================================
   DIGITAL STUDENT MESSAGES
========================================================= */

export async function getMyDigitalStudentMessages() {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  const token =
    await currentUser.getIdToken(
      true
    );

  const response =
    await fetch(
      "/api/digital-classroom/student/messages",
      {
        method:
          "GET",

        headers: {
          Authorization:
            `Bearer ${token}`,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );

  const raw =
    await response.text();

  let data = {};

  try {
    data =
      raw
        ? JSON.parse(raw)
        : {};
  } catch {
    throw new Error(
      `Messages API returned invalid JSON. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Unable to load messages. HTTP ${response.status}`
    );
  }

  return data;
}


/* =========================================================
   MARK STUDENT MESSAGE READ
========================================================= */

export async function markDigitalStudentMessageRead(
  source,
  messageId
) {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login first."
    );
  }

  if (
    !source ||
    !messageId
  ) {
    throw new Error(
      "Message information is required."
    );
  }

  const token =
    await currentUser.getIdToken(
      true
    );

  const response =
    await fetch(
      "/api/digital-classroom/student/messages",
      {
        method:
          "PATCH",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify({
            source,
            messageId,
          }),

        cache:
          "no-store",
      }
    );

  const raw =
    await response.text();

  let data = {};

  try {
    data =
      raw
        ? JSON.parse(raw)
        : {};
  } catch {
    throw new Error(
      `Message API returned invalid JSON. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        "Unable to mark message as read."
    );
  }

  return data;
}