export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import { requireServerRole } from "@/lib/serverAuth";

const SESSION_TTL_MINUTES = 10;
const ALLOWED_STEPS = new Set(["madarsa", "management", "sadar"]);

function newSessionId() {
  return randomUUID();
}

export async function POST(request) {
  try {
    await requireServerRole(request, ["central_admin", "admin", "inspector"]);
    const body = await request.json();
    const draftId = body?.draftId;
    const step = body?.step;

    if (!draftId || typeof draftId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid draftId" },
        { status: 400 },
      );
    }

    if (!step || typeof step !== "string" || !ALLOWED_STEPS.has(step)) {
      return NextResponse.json(
        { error: "Missing or invalid step" },
        { status: 400 },
      );
    }

    const draftRef = getAdminDb().collection("inspections").doc(draftId);
    const draftSnap = await draftRef.get();
    if (!draftSnap.exists) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    const sessionId = newSessionId();
    const createdAt = Timestamp.now();
    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000),
    );

    await getAdminDb().collection("mobileUploadSessions").doc(sessionId).set({
      draftId,
      step,
      status: "active",
      createdAt,
      expiresAt,
      uploadCount: 0,
      lastUploadAt: null,
    });

    return NextResponse.json({
      sessionId,
      expiresAt: expiresAt.toDate().toISOString(),
      ttlMinutes: SESSION_TTL_MINUTES,
    });
  } catch (error) {
    console.error("Create mobile upload session failed:", error);
    if (error.status) {
      return NextResponse.json({ error: "Not authorized" }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 },
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId") || "";

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const sessionRef = getAdminDb()
      .collection("mobileUploadSessions")
      .doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Invalid session" }, { status: 404 });
    }

    const session = snap.data() || {};
    const expiresAt = session.expiresAt?.toDate?.() || null;
    const now = new Date();

    if (!expiresAt || now > expiresAt) {
      return NextResponse.json(
        {
          error: "Session expired",
          status: "expired",
          step: session.step || null,
        },
        { status: 410 },
      );
    }

    return NextResponse.json({
      status: session.status || "active",
      step: session.step,
      expiresAt: expiresAt.toISOString(),
      uploadCount: session.uploadCount || 0,
    });
  } catch (error) {
    console.error("Get mobile upload session failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 },
    );
  }
}
