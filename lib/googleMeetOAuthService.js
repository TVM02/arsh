async function getCentralAdminToken() {

  const { auth } =
    await import(
      "@/lib/firebase"
    );

  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Please login as Central Admin."
    );
  }

  return await currentUser
    .getIdToken(true);
}


async function parseResponse(
  response
) {
  const text =
    await response.text();

  let data = {};

  if (text) {
    try {
      data =
        JSON.parse(text);
    } catch {
      throw new Error(
        `Server returned invalid response. HTTP ${response.status}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Request failed. HTTP ${response.status}`
    );
  }

  return data;
}


/* ==========================================
   GOOGLE MEET CONNECTION STATUS
========================================== */

export async function
getGoogleMeetConnectionStatus() {

  const token =
    await getCentralAdminToken();


  const response =
    await fetch(
      "/api/digital-classroom/google-meet/oauth/status",
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


  return await parseResponse(
    response
  );
}


/* ==========================================
   START GOOGLE OAUTH
========================================== */

export async function
startGoogleMeetOAuth() {

  const token =
    await getCentralAdminToken();


  const response =
    await fetch(
      "/api/digital-classroom/google-meet/oauth/start",
      {
        method: "POST",

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
    await parseResponse(
      response
    );


  if (!data?.authorizationUrl) {
    throw new Error(
      "Google authorization URL is missing."
    );
  }


  return data;
}