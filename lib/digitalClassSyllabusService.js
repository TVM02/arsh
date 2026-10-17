
import { getAuth } from "firebase/auth";

const API_URL =
  "/api/digital-classroom/settings/syllabus";

async function getAuthorizationHeaders() {
  const user = getAuth().currentUser;

  if (!user) {
    throw new Error(
      "Please log in to continue."
    );
  }

  const token = await user.getIdToken();

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(
      data.message || "Request failed."
    );
  }

  return data;
}

/* ============================================
   LOAD ALL SYLLABUS SETTINGS
============================================ */

export async function getDigitalSyllabusSettings() {
  const headers = await getAuthorizationHeaders();

  const response = await fetch(API_URL, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  return handleResponse(response);
}

/* ============================================
   SAVE SELECTED CLASS SUBJECTS
============================================ */

export async function saveDigitalSyllabusSettings({
  className,
  subjects,
}) {
  const headers = await getAuthorizationHeaders();

  const response = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      className,
      subjects,
    }),
  });

  return handleResponse(response);
}
