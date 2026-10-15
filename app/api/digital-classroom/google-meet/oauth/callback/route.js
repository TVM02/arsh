import {
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COLLECTION =
  "googleMeetOAuthStates";

const CONNECTION_COLLECTION =
  "googleMeetOAuthConnections";


function htmlResponse(
  title,
  message,
  success = false
) {
  const safeTitle =
    String(title || "")
      .replace(/[<>]/g, "");

  const safeMessage =
    String(message || "")
      .replace(/[<>]/g, "");

  return new Response(
    `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />

          <title>
            ${safeTitle}
          </title>

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: Arial, sans-serif;
              background: #0f172a;
              color: white;
            }

            .card {
              width: min(
                440px,
                calc(100% - 32px)
              );
              padding: 32px;
              border-radius: 24px;
              background: #ffffff;
              color: #0f172a;
              text-align: center;
              box-shadow:
                0 24px 80px
                rgba(0,0,0,.35);
            }

            .icon {
              width: 64px;
              height: 64px;
              margin: 0 auto 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 20px;
              font-size: 30px;
              background:
                ${
                  success
                    ? "#ccfbf1"
                    : "#fee2e2"
                };
            }

            h1 {
              margin: 0;
              font-size: 22px;
            }

            p {
              margin-top: 12px;
              color: #64748b;
              line-height: 1.6;
            }
          </style>
        </head>

        <body>

          <div class="card">

            <div class="icon">
              ${
                success
                  ? "✓"
                  : "!"
              }
            </div>

            <h1>
              ${safeTitle}
            </h1>

            <p>
              ${safeMessage}
            </p>

          </div>


          ${
            success
              ? `
                <script>
                  try {
                    if (
                      window.opener
                    ) {
                      window.opener.postMessage(
                        {
                          type:
                            "DKJU_GOOGLE_MEET_CONNECTED"
                        },
                        window.location.origin
                      );
                    }

                    setTimeout(
                      function () {
                        window.close();
                      },
                      1200
                    );
                  } catch {}
                </script>
              `
              : ""
          }

        </body>
      </html>
    `,
    {
      status:
        success ? 200 : 400,

      headers: {
        "Content-Type":
          "text/html; charset=utf-8",
      },
    }
  );
}


export async function GET(
  request
) {
  const db =
    getAdminDb();

  let stateRef = null;

  try {

    const url =
      new URL(request.url);

    const code =
      url.searchParams.get(
        "code"
      );

    const state =
      url.searchParams.get(
        "state"
      );

    const oauthError =
      url.searchParams.get(
        "error"
      );


    if (oauthError) {

      return htmlResponse(
        "Google authorization cancelled",
        oauthError,
        false
      );
    }


    if (
      !code ||
      !state
    ) {

      return htmlResponse(
        "Invalid Google authorization",
        "Authorization code or state is missing.",
        false
      );
    }


    stateRef =
      db
        .collection(
          STATE_COLLECTION
        )
        .doc(state);


    const stateSnapshot =
      await stateRef.get();


    if (!stateSnapshot.exists) {

      return htmlResponse(
        "Invalid authorization request",
        "This Google authorization request is invalid or has already been used.",
        false
      );
    }


    const stateData =
      stateSnapshot.data() ||
      {};


    /*
     * State may only be used once.
     */
    await stateRef.delete();


    const expiresAt =
      stateData?.expiresAt
        ?.toDate
        ? stateData
            .expiresAt
            .toDate()
        : new Date(
            stateData?.expiresAt
          );


    if (
      !expiresAt ||
      Number.isNaN(
        expiresAt.getTime()
      ) ||
      expiresAt.getTime() <
        Date.now()
    ) {

      return htmlResponse(
        "Authorization expired",
        "Please start Google Meet connection again.",
        false
      );
    }


    const adminUid =
      String(
        stateData?.adminUid ||
        ""
      ).trim();


    if (!adminUid) {

      return htmlResponse(
        "Authorization failed",
        "Central Admin information is missing.",
        false
      );
    }


    const clientId =
      process.env
        .GOOGLE_MEET_CLIENT_ID;

    const clientSecret =
      process.env
        .GOOGLE_MEET_CLIENT_SECRET;

    const redirectUri =
      process.env
        .GOOGLE_MEET_REDIRECT_URI;


    if (
      !clientId ||
      !clientSecret ||
      !redirectUri
    ) {

      throw new Error(
        "Google Meet OAuth environment variables are missing."
      );
    }


    /*
     * Exchange Google authorization code
     * for access + refresh tokens.
     */
    const tokenResponse =
      await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body:
            new URLSearchParams({

              client_id:
                clientId,

              client_secret:
                clientSecret,

              code,

              grant_type:
                "authorization_code",

              redirect_uri:
                redirectUri,

            }),

          cache: "no-store",
        }
      );


    const tokenData =
      await tokenResponse.json();


    if (!tokenResponse.ok) {

      console.error(
        "GOOGLE TOKEN ERROR:",
        tokenData
      );

      throw new Error(
        tokenData
          ?.error_description ||
        tokenData
          ?.error ||
        "Google token exchange failed."
      );
    }


    const connectionRef =
      db
        .collection(
          CONNECTION_COLLECTION
        )
        .doc("default");


    const existingSnapshot =
      await connectionRef.get();


    const existing =
      existingSnapshot.exists
        ? existingSnapshot.data()
        : {};


    /*
     * Google does not always return
     * refresh_token on later consent flows.
     * Keep previous refresh token if necessary.
     */
    const refreshToken =
      tokenData?.refresh_token ||
      existing?.refreshToken ||
      "";


    if (!refreshToken) {

      throw new Error(
        "Google did not provide a refresh token. Please reconnect the Google account."
      );
    }


    const expiresIn =
      Number(
        tokenData?.expires_in ||
        3600
      );


    await connectionRef.set(
      {

        connected:
          true,

        provider:
          "google_meet",

        connectedBy:
          adminUid,

        accessToken:
          tokenData?.access_token ||
          "",

        refreshToken,

        tokenType:
          tokenData?.token_type ||
          "Bearer",

        scope:
          tokenData?.scope ||
          "",

        accessTokenExpiresAt:
          new Date(
            Date.now() +
            expiresIn *
              1000
          ),

        connectedAt:
          existing?.connectedAt ||
          new Date(),

        updatedAt:
          new Date(),

      },
      {
        merge: true,
      }
    );


    return htmlResponse(
      "Google Meet Connected",
      "DKJU Digital Classroom is now connected to Google Meet.",
      true
    );


  } catch (error) {

    console.error(
      "GOOGLE MEET OAUTH CALLBACK ERROR:",
      error
    );


    try {
      if (stateRef) {
        await stateRef.delete();
      }
    } catch {}


    return htmlResponse(
      "Google Meet Connection Failed",
      error?.message ||
        "Unable to connect Google Meet.",
      false
    );
  }
}