import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { addGoogleMeetMember } from "@/lib/googleMeetMembers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    // ==========================================
    // GET FIREBASE ID TOKEN
    // ==========================================

    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return Response.json(
        {
          error: "Authentication token is required.",
        },
        { status: 401 }
      );
    }

    const idToken =
      authorization.substring(7).trim();

    if (!idToken) {
      return Response.json(
        {
          error: "Authentication token is missing.",
        },
        { status: 401 }
      );
    }


    // ==========================================
    // ADMIN SERVICES
    // ==========================================

    const adminAuth = getAdminAuth();
    const db = getAdminDb();


    // ==========================================
    // VERIFY FIREBASE ID TOKEN
    // ==========================================

    const decodedToken =
      await adminAuth.verifyIdToken(idToken);

    const uid =
      String(decodedToken?.uid || "").trim();

    if (!uid) {
      return Response.json(
        {
          error: "Invalid Firebase authentication.",
        },
        { status: 401 }
      );
    }


    // ==========================================
    // GET FIREBASE USER
    // ==========================================

    const userRecord =
      await adminAuth.getUser(uid);

    if (!userRecord) {
      return Response.json(
        {
          error: "Firebase user account was not found.",
        },
        { status: 404 }
      );
    }


    // ==========================================
    // VERIFY DIGITAL STUDENT ACCOUNT
    // ==========================================

    const userRef =
      db.collection("users").doc(uid);

    const userSnapshot =
      await userRef.get();

    if (!userSnapshot.exists) {
      return Response.json(
        {
          error: "Student account was not found.",
        },
        { status: 404 }
      );
    }

    const userData =
      userSnapshot.data() || {};

    if (
      userData.role !== "student" ||
      userData.userType !== "digital_student"
    ) {
      return Response.json(
        {
          error:
            "This account is not authorized for Digital Classroom.",
        },
        { status: 403 }
      );
    }


    // ==========================================
    // FIND GOOGLE PROVIDER
    // ==========================================

    const googleProvider =
      userRecord.providerData?.find(
        (provider) =>
          provider.providerId === "google.com"
      );

    if (!googleProvider) {
      return Response.json(
        {
          error:
            "A Google account is not connected to this Firebase account.",
        },
        { status: 400 }
      );
    }


    // ==========================================
    // GET VERIFIED GOOGLE EMAIL
    // ==========================================

    const googleEmail =
      String(
        googleProvider.email || ""
      )
        .trim()
        .toLowerCase();

    if (!googleEmail) {
      return Response.json(
        {
          error:
            "The connected Google account does not have a valid email address.",
        },
        { status: 400 }
      );
    }


    // ==========================================
    // SAVE GOOGLE CONNECTION
    // ==========================================

    await userRef.set(
      {
        googleAuth: {
          connected: true,
          email: googleEmail,
          provider: "google.com",
          connectedAt: new Date(),
        },
      },
      {
        merge: true,
      }
    );


    // ==========================================
    // SUCCESS RESPONSE
    // ==========================================

    return Response.json({
      success: true,

      googleAuth: {
        connected: true,
        email: googleEmail,
        provider: "google.com",
      },
    });

  } catch (error) {

    console.error(
      "DIGITAL STUDENT GOOGLE AUTH CONNECT ERROR:",
      error
    );

    // ==========================================
    // FIREBASE AUTH ERRORS
    // ==========================================

    if (
      error?.code ===
      "auth/id-token-expired"
    ) {
      return Response.json(
        {
          error:
            "Your authentication session has expired. Please log in again.",
        },
        { status: 401 }
      );
    }

    if (
      error?.code ===
      "auth/id-token-revoked"
    ) {
      return Response.json(
        {
          error:
            "Your authentication session is no longer valid. Please log in again.",
        },
        { status: 401 }
      );
    }

    if (
      error?.code ===
      "auth/invalid-id-token"
    ) {
      return Response.json(
        {
          error:
            "Invalid authentication token. Please log in again.",
        },
        { status: 401 }
      );
    }


    // ==========================================
    // GENERIC ERROR
    // ==========================================

    return Response.json(
      {
        error:
          error?.message ||
          "Unable to connect your Google account.",
      },
      { status: 500 }
    );
  }
}