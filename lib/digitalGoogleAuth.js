
"use client";

import {
  GoogleAuthProvider,
  linkWithPopup,
  getIdToken,
  unlink,
} from "firebase/auth";

import { auth } from "@/lib/firebase";


/* =========================================================
   CONNECT DIGITAL GOOGLE ACCOUNT
========================================================= */

export async function connectDigitalGoogleAccount(
  role
) {

  const currentUser =
    auth.currentUser;


  if (!currentUser) {
    throw new Error(
      "Your DKJU session has expired. Please log in again."
    );
  }


  if (
    role !== "student" &&
    role !== "teacher"
  ) {
    throw new Error(
      "Invalid digital classroom role."
    );
  }


  const provider =
    new GoogleAuthProvider();


  provider.setCustomParameters({
    prompt:
      "select_account",
  });


  try {

    /*
     * Normal first-time Google connection.
     */
    const result =
      await linkWithPopup(
        currentUser,
        provider
      );


    const linkedUser =
      result.user;


    const googleProvider =
      linkedUser.providerData?.find(
        (providerData) =>
          providerData.providerId ===
          "google.com"
      );


    if (!googleProvider) {
      throw new Error(
        "Google account could not be verified."
      );
    }


    const idToken =
      await getIdToken(
        linkedUser,
        true
      );


    const endpoint =
      role === "teacher"
        ? "/api/digital-classroom/teacher/google-auth/connect"
        : "/api/digital-classroom/student/google-auth/connect";


    const response =
      await fetch(
        endpoint,
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${idToken}`,
          },

          cache:
            "no-store",
        }
      );


    const data =
      await response
        .json()
        .catch(
          () => ({})
        );


    if (!response.ok) {
      throw new Error(
        data?.error ||
        data?.message ||
        "Unable to save Google account connection."
      );
    }


    return {
      success:
        true,

      uid:
        linkedUser.uid,

      email:
        data?.googleAuth?.email ||
        googleProvider.email ||
        "",

      provider:
        "google.com",

      googleAuth:
        data?.googleAuth ||
        null,
    };

  } catch (error) {

    /* =====================================================
       GOOGLE PROVIDER ALREADY LINKED

       This happens when:

       Firebase Auth:
         google.com = still linked

       but Firestore:
         users/{uid}.googleAuth = null

       We unlink the old provider and allow the
       student/teacher to connect a new Google account.
    ===================================================== */

    if (
      error?.code ===
        "auth/provider-already-linked"
    ) {

      try {

        /*
         * Remove the existing Google provider
         * from the CURRENT DKJU Firebase account.

         * This does NOT delete the DKJU account.
         */
        await unlink(
          currentUser,
          "google.com"
        );


        /*
         * Now ask the user to select the
         * new Google account.
         */
        const reconnectResult =
          await linkWithPopup(
            currentUser,
            provider
          );


        const reconnectUser =
          reconnectResult.user;


        const reconnectGoogleProvider =
          reconnectUser.providerData?.find(
            (providerData) =>
              providerData.providerId ===
              "google.com"
          );


        if (
          !reconnectGoogleProvider
        ) {
          throw new Error(
            "Google account could not be verified."
          );
        }


        const reconnectIdToken =
          await getIdToken(
            reconnectUser,
            true
          );


        const reconnectEndpoint =
          role === "teacher"
            ? "/api/digital-classroom/teacher/google-auth/connect"
            : "/api/digital-classroom/student/google-auth/connect";


        const reconnectResponse =
          await fetch(
            reconnectEndpoint,
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${reconnectIdToken}`,
              },

              cache:
                "no-store",
            }
          );


        const reconnectData =
          await reconnectResponse
            .json()
            .catch(
              () => ({})
            );


        if (
          !reconnectResponse.ok
        ) {
          throw new Error(
            reconnectData?.error ||
            reconnectData?.message ||
            "Unable to save the new Google account connection."
          );
        }


        return {
          success:
            true,

          uid:
            reconnectUser.uid,

          email:
            reconnectData?.googleAuth?.email ||
            reconnectGoogleProvider.email ||
            "",

          provider:
            "google.com",

          googleAuth:
            reconnectData?.googleAuth ||
            null,
        };

      } catch (unlinkError) {

        console.error(
          "DIGITAL GOOGLE RECONNECT ERROR:",
          unlinkError
        );


        throw new Error(
          unlinkError?.message ||
          "The previous Google account could not be disconnected. Please log out and log in again."
        );
      }
    }


    /* =====================================================
       USER CLOSED POPUP
    ===================================================== */

    if (
      error?.code ===
        "auth/popup-closed-by-user"
    ) {

      throw new Error(
        "Google account connection was cancelled."
      );
    }


    /* =====================================================
       GOOGLE ACCOUNT ALREADY BELONGS TO
       ANOTHER FIREBASE ACCOUNT
    ===================================================== */

    if (
      error?.code ===
        "auth/account-exists-with-different-credential"
    ) {

      throw new Error(
        "This Google account is already connected to another Firebase account."
      );
    }


    if (
      error?.code ===
        "auth/credential-already-in-use"
    ) {

      throw new Error(
        "This Google account is already connected to another DKJU account."
      );
    }


    /* =====================================================
       POPUP BLOCKED
    ===================================================== */

    if (
      error?.code ===
        "auth/popup-blocked"
    ) {

      throw new Error(
        "Google sign-in popup was blocked. Please allow popups and try again."
      );
    }


    /* =====================================================
       LOG AND RETURN OTHER ERRORS
    ===================================================== */

    console.error(
      "Digital Google account connection failed:",
      error
    );


    throw new Error(
      error?.message ||
      "Unable to connect your Google account."
    );
  }
}


/* =========================================================
   UNLINK DIGITAL GOOGLE ACCOUNT

   This can be used when the CURRENT logged-in
   DKJU user wants to disconnect Google.

   It does NOT delete the DKJU Firebase account.
========================================================= */

export async function unlinkDigitalGoogleAccount() {

  const currentUser =
    auth.currentUser;


  if (!currentUser) {
    throw new Error(
      "Your DKJU session has expired. Please log in again."
    );
  }


  const googleProvider =
    currentUser.providerData?.find(
      (provider) =>
        provider.providerId ===
        "google.com"
    );


  if (!googleProvider) {

    return {
      success:
        true,

      alreadyUnlinked:
        true,
    };
  }


  try {

    await unlink(
      currentUser,
      "google.com"
    );


    return {
      success:
        true,

      alreadyUnlinked:
        false,
    };

  } catch (error) {

    console.error(
      "Digital Google account unlink failed:",
      error
    );


    throw new Error(
      error?.message ||
      "Unable to unlink the Google account."
    );
  }
}
