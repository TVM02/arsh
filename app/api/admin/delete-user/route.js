export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { requireCentralAdmin } from "@/lib/serverAuth";

const withTimeout = (promise, ms, label) => {
  let id;
  const t = new Promise((_, reject) => {
    id = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, t]).finally(() => clearTimeout(id));
};

export async function DELETE(req) {
  try {
    await requireCentralAdmin(req);
    const { uid } = await req.json();

    console.log("[delete-user] request received", { hasUid: Boolean(uid) });

    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 });
    }

    // Build (or reuse) the admin app — throws with a clear message if misconfigured
    let auth;
    let db;
    try {
      auth = getAdminAuth();
      db = getAdminDb();
    } catch (initErr) {
      console.error("[delete-user] Admin SDK init failed:", initErr.message);
      return NextResponse.json(
        { error: "Server is not configured to delete Auth users" },
        { status: 500 },
      );
    }

    // Delete Auth user — treat user-not-found as already deleted (success)
    console.log("[delete-user] deleting auth user");
    try {
      await withTimeout(auth.deleteUser(uid), 10_000, "auth.deleteUser");
      console.log("[delete-user] auth user deleted");
    } catch (authErr) {
      if (
        authErr?.errorInfo?.code === "auth/user-not-found" ||
        authErr?.code === "auth/user-not-found"
      ) {
        // User was already deleted (e.g. by a partially-run Cloud Function call). Continue to clean up Firestore.
        console.warn(
          "[delete-user] auth user not found (already deleted?), continuing",
          { hasUid: Boolean(uid) },
        );
      } else {
        // Unexpected auth error — re-throw so the caller knows
        throw authErr;
      }
    }

    // Always delete Firestore user doc (source of truth for the app)
    try {
      await db.collection("users").doc(uid).delete();
      console.log("[delete-user] firestore doc deleted");
    } catch (err) {
      console.warn("[delete-user] firestore delete failed (non-fatal)", {
        message: err?.message,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[delete-user] Error:", error);
    if (error.status) {
      return NextResponse.json({ error: "Not authorized" }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to delete user from Auth" },
      { status: 500 },
    );
  }
}
