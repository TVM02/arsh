export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "crypto";

const ALLOWED_STEPS = new Set(["madarsa", "management", "sadar"]);

function isLikelyUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

// image/heic and image/heif for iOS cameras; image/webp for some Android cameras.
// Compressed images will always be re-sent as image/jpeg from the client,
// but we keep these here as a server-side safety net.
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function sanitizeFilename(name) {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildDownloadUrl(bucketName, storagePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    storagePath,
  )}?alt=media&token=${encodeURIComponent(token)}`;
}

async function linkUploadedFiles({ sessionId, uploadedFiles }) {
  const sessionRef = getAdminDb()
    .collection("mobileUploadSessions")
    .doc(sessionId);
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) {
    return { error: "Invalid session", status: 404 };
  }

  const session = sessionSnap.data() || {};
  const expiresAt = session.expiresAt?.toDate?.() || null;
  const now = new Date();

  if (!expiresAt || now > expiresAt) {
    return { error: "Session expired", status: 410 };
  }

  const draftId = session.draftId;
  const step = session.step;

  if (!draftId || typeof draftId !== "string") {
    return { error: "Session is missing draftId", status: 500 };
  }

  if (!step || typeof step !== "string" || !ALLOWED_STEPS.has(step)) {
    return { error: "Session has invalid step", status: 500 };
  }

  const sanitized = uploadedFiles
    .map((f) => ({
      name: f?.name,
      url: f?.url,
      type: f?.type,
      size: f?.size,
      uploadedAt: f?.uploadedAt,
      storagePath: f?.storagePath,
    }))
    .filter(
      (f) =>
        typeof f.name === "string" &&
        f.name.length > 0 &&
        isLikelyUrl(f.url) &&
        typeof f.type === "string" &&
        typeof f.size === "number" &&
        f.size > 0,
    );

  if (sanitized.length === 0) {
    return { error: "uploadedFiles payload invalid", status: 400 };
  }

  const inspectionRef = getAdminDb().collection("inspections").doc(draftId);
  const field = `${step}FormFiles`;

  await getAdminDb().runTransaction(async (tx) => {
    const inspectionSnap = await tx.get(inspectionRef);
    if (!inspectionSnap.exists) {
      throw new Error("Draft not found");
    }

    const sessionSnap2 = await tx.get(sessionRef);
    if (!sessionSnap2.exists) {
      throw new Error("Session not found");
    }

    tx.update(inspectionRef, {
      [field]: FieldValue.arrayUnion(...sanitized),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.update(sessionRef, {
      uploadCount: FieldValue.increment(sanitized.length),
      files: FieldValue.arrayUnion(...sanitized),
      lastUploadAt: Timestamp.now(),
      status: "uploaded",
    });
  });

  return { ok: true, draftId, step, added: sanitized.length };
}

/**
 * POST /api/mobile-upload/upload
 *
 * Supports:
 * - multipart/form-data: { sessionId, file } (preferred, production-ready, works without Firebase Auth on phone)
 * - application/json: { sessionId, uploadedFiles } (fallback for internal callers)
 */
export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      const sessionId = body?.sessionId;
      const uploadedFiles = Array.isArray(body?.uploadedFiles)
        ? body.uploadedFiles
        : [];

      if (!sessionId || typeof sessionId !== "string") {
        return NextResponse.json(
          { error: "Missing or invalid sessionId" },
          { status: 400 },
        );
      }

      const result = await linkUploadedFiles({ sessionId, uploadedFiles });
      if (result?.error) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status },
        );
      }
      return NextResponse.json(result);
    }

    // Preferred: multipart/form-data for raw file upload
    const form = await request.formData();
    const sessionId = String(form.get("sessionId") || "");
    const file = form.get("file");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // Validate session first to obtain draftId/step
    const sessionRef = getAdminDb()
      .collection("mobileUploadSessions")
      .doc(sessionId);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      return NextResponse.json({ error: "Invalid session" }, { status: 404 });
    }

    const session = sessionSnap.data() || {};
    const expiresAt = session.expiresAt?.toDate?.() || null;
    const now = new Date();

    if (!expiresAt || now > expiresAt) {
      return NextResponse.json({ error: "Session expired" }, { status: 410 });
    }

    const draftId = session.draftId;
    const step = session.step;

    if (!draftId || typeof draftId !== "string") {
      return NextResponse.json(
        { error: "Session is missing draftId" },
        { status: 500 },
      );
    }

    if (!step || typeof step !== "string" || !ALLOWED_STEPS.has(step)) {
      return NextResponse.json(
        { error: "Session has invalid step" },
        { status: 500 },
      );
    }

    const contentTypeFile = String(file.type || "");
    const size = Number(file.size || 0);
    const name = sanitizeFilename(file.name);

    if (!ALLOWED_TYPES.has(contentTypeFile)) {
      return NextResponse.json(
        {
          error: `Unsupported file type "${contentTypeFile || "(unknown)"}" — only JPG, PNG, WEBP, HEIC, and PDF are allowed`,
        },
        { status: 400 },
      );
    }

    if (size <= 0 || size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 },
      );
    }

    let bucket;
    try {
      bucket = getAdminStorageBucket();
    } catch (bucketErr) {
      console.error("Storage bucket init failed:", bucketErr);
      return NextResponse.json(
        { error: `Storage initialisation error: ${bucketErr.message}` },
        { status: 500 },
      );
    }

    const timestamp = Date.now();
    const storagePath = `inspections/${step}-forms/${timestamp}_${name}`;

    const buf = Buffer.from(await file.arrayBuffer());
    const token = randomUUID();

    try {
      await bucket.file(storagePath).save(buf, {
        resumable: false,
        contentType: contentTypeFile,
        metadata: {
          contentDisposition: "attachment",
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        },
      });
    } catch (saveErr) {
      console.error("Firebase Storage save failed:", saveErr);
      return NextResponse.json(
        { error: `Storage upload failed: ${saveErr.message}` },
        { status: 500 },
      );
    }

    const url = buildDownloadUrl(bucket.name, storagePath, token);
    const uploadedMeta = {
      name: file.name,
      url,
      type: contentTypeFile,
      size,
      uploadedAt: Timestamp.now(),
      storagePath,
    };

    const linkResult = await linkUploadedFiles({
      sessionId,
      uploadedFiles: [uploadedMeta],
    });

    if (linkResult?.error) {
      return NextResponse.json(
        { error: linkResult.error },
        { status: linkResult.status },
      );
    }

    return NextResponse.json({
      ...linkResult,
      fileUrl: url,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Mobile upload route failed:", error);

    const message = String(error?.message || "");
    if (message.includes("Draft not found")) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    // Return the actual error message so it surfaces in the mobile toast
    // instead of the opaque "Failed to link upload" fallback.
    return NextResponse.json(
      { error: message || "Unexpected server error" },
      { status: 500 },
    );
  }
}
