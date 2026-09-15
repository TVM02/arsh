// lib/digitalClassStudentService.js

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