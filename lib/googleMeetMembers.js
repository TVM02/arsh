
const DEFAULT_MEET_MEMBER_ROLE = "ROLE_UNSPECIFIED";

function cleanText(value) {
  return String(value ?? "").trim();
}

/* =========================================================
   GET GOOGLE MEET ACCESS TOKEN
========================================================= */

export async function getGoogleMeetAccessToken(db) {
  const connectionRef = db
    .collection("googleMeetOAuthConnections")
    .doc("default");

  const snapshot = await connectionRef.get();

  if (!snapshot.exists) {
    throw new Error(
      "Google Meet is not connected. Please connect Google Meet from Central Admin."
    );
  }

  const connection = snapshot.data() || {};

  if (connection?.connected !== true) {
    throw new Error(
      "Google Meet is not connected. Please reconnect Google Meet from Central Admin."
    );
  }

  /* -------------------------------------------------------
     CHECK CURRENT ACCESS TOKEN
  ------------------------------------------------------- */

  const expiresAt =
    connection?.accessTokenExpiresAt?.toDate
      ? connection.accessTokenExpiresAt.toDate()
      : new Date(
          connection?.accessTokenExpiresAt || 0
        );

  const currentAccessToken =
    cleanText(
      connection?.accessToken
    );

  if (
    currentAccessToken &&
    expiresAt instanceof Date &&
    !Number.isNaN(
      expiresAt.getTime()
    ) &&
    expiresAt.getTime() >
      Date.now() + 2 * 60 * 1000
  ) {
    return currentAccessToken;
  }

  /* -------------------------------------------------------
     ACCESS TOKEN EXPIRED
     REFRESH USING REFRESH TOKEN
  ------------------------------------------------------- */

  const refreshToken =
    cleanText(
      connection?.refreshToken
    );

  if (!refreshToken) {
    throw new Error(
      "Google refresh token is missing. Please reconnect Google Meet from Central Admin."
    );
  }

  const clientId =
    process.env.GOOGLE_MEET_CLIENT_ID;

  const clientSecret =
    process.env.GOOGLE_MEET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Meet OAuth environment variables are missing."
    );
  }

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),

      cache: "no-store",
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
      `Google token endpoint returned invalid response. HTTP ${response.status}`
    );
  }

  /* -------------------------------------------------------
     REFRESH TOKEN INVALID / REVOKED
  ------------------------------------------------------- */

  if (!response.ok) {
    console.error(
      "GOOGLE OAUTH TOKEN REFRESH ERROR:",
      {
        status:
          response.status,

        error:
          data?.error,

        description:
          data?.error_description,
      }
    );

    if (
      data?.error ===
      "invalid_grant"
    ) {
      throw new Error(
        "The Central Admin Google Meet connection has expired or been revoked. Please reconnect Google Meet from Central Admin."
      );
    }

    throw new Error(
      data?.error_description ||
        data?.error ||
        "Unable to refresh Google access token."
    );
  }

  const accessToken =
    cleanText(
      data?.access_token
    );

  if (!accessToken) {
    throw new Error(
      "Google access token was not returned."
    );
  }

  const expiresIn =
    Number(
      data?.expires_in || 3600
    );

  const newExpiresAt =
    new Date(
      Date.now() +
        expiresIn * 1000
    );

  /*
   * Google normally does NOT return
   * a new refresh_token during refresh.
   *
   * Therefore we intentionally preserve
   * the existing refreshToken in Firestore.
   */
  await connectionRef.set(
    {
      connected: true,

      accessToken,

      accessTokenExpiresAt:
        newExpiresAt,

      updatedAt:
        new Date(),
    },
    {
      merge: true,
    }
  );

  return accessToken;
}

/* =========================================================
   ADD GOOGLE MEET MEMBER
========================================================= */

export async function addGoogleMeetMember({
  accessToken,
  googleSpaceName,
  email,
  role = DEFAULT_MEET_MEMBER_ROLE,

  /*
   * Optional:
   * Pass db when you want automatic token refresh
   * after a Google Meet 401 response.
   */
  db = null,
}) {
  const cleanEmail =
    cleanText(email).toLowerCase();

  if (!cleanEmail) {
    return {
      success: false,
      skipped: true,
      email: "",
      role,
      message:
        "Google email is missing.",
    };
  }

  if (!googleSpaceName) {
    return {
      success: false,
      skipped: true,
      email: cleanEmail,
      role,
      message:
        "Google Meet space name is missing.",
    };
  }

  if (!accessToken) {
    return {
      success: false,
      email: cleanEmail,
      role,
      message:
        "Google Meet access token is missing.",
    };
  }

  async function sendRequest(token) {
    return fetch(
      `https://meet.googleapis.com/v2/${googleSpaceName}/members`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          email: cleanEmail,
          role,
        }),

        cache: "no-store",
      }
    );
  }

  try {
    let response =
      await sendRequest(
        accessToken
      );

    /*
     * If Google says the access token
     * is expired, refresh it once and retry.
     */
    if (
      response.status === 401 &&
      db
    ) {
      console.warn(
        "GOOGLE MEET ACCESS TOKEN EXPIRED. REFRESHING..."
      );

      try {
        const freshAccessToken =
          await getGoogleMeetAccessToken(
            db
          );

        response =
          await sendRequest(
            freshAccessToken
          );
      } catch (refreshError) {
        console.error(
          "GOOGLE MEET TOKEN REFRESH FAILED:",
          refreshError
        );

        return {
          success: false,

          email:
            cleanEmail,

          role,

          status: 401,

          message:
            refreshError?.message ||
            "Google Meet access token has expired or been revoked.",
        };
      }
    }

    const raw =
      await response.text();

    let data = {};

    try {
      data =
        raw
          ? JSON.parse(raw)
          : {};
    } catch {
      data = {
        raw,
      };
    }


/* -------------------------------------------------------
   MEMBER ALREADY EXISTS
------------------------------------------------------- */

const googleMessage =
  cleanText(
    data?.error?.message
  );

const isAlreadyMember =
  response.status === 409 ||
  googleMessage
    .toLowerCase()
    .includes("member already exists");

if (isAlreadyMember) {
  console.info(
    "GOOGLE MEET MEMBER ALREADY EXISTS:",
    {
      email: cleanEmail,
      role,
      status: response.status,
    }
  );

  return {
    success: true,

    alreadyExists: true,

    email:
      cleanEmail,

    role,

    status:
      response.status,

    member:
      data,

    message:
      "Google Meet member already exists.",
  };
}

/* -------------------------------------------------------
   OTHER GOOGLE MEET MEMBER ERROR
------------------------------------------------------- */

if (!response.ok) {
  console.error(
    "GOOGLE MEET MEMBER ERROR:",
    {
      email:
        cleanEmail,

      role,

      status:
        response.status,

      data,
    }
  );

  return {
    success: false,

    email:
      cleanEmail,

    role,

    status:
      response.status,

    errorStatus:
      data?.error?.status ||
      null,

    message:
      googleMessage ||
      `Unable to add Google Meet member. HTTP ${response.status}`,
  };
}


    return {
      success: true,

      email:
        cleanEmail,

      role,

      member:
        data,
    };
  } catch (error) {
    console.error(
      "GOOGLE MEET MEMBER REQUEST ERROR:",
      error
    );

    return {
      success: false,

      email:
        cleanEmail,

      role,

      message:
        error?.message ||
        "Unable to add Google Meet member.",
    };
  }
}
