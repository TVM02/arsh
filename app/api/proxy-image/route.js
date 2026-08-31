export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { getAdminStorageBucket } from "@/lib/firebase-admin";

/**
 * GET /api/proxy-image?url=<encodedFirebaseStorageUrl>
 * Returns the image binary directly, stripping Content-Disposition: attachment.
 * Strategy (in order):
 *  1. Admin SDK file.download() – bypasses token expiry/revocation entirely
 *  2. Direct fetch of the original URL
 *  3. Tokenless fetch (relies on storage rules: allow read: true)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = sanitizeExternalUrl(searchParams.get("url"));

    if (!imageUrl || !isSupportedUrl(imageUrl)) {
      return new NextResponse(null, { status: 400 });
    }

    // ── Strategy 1: Admin SDK download (works even if token is expired/revoked) ──
    const parsed = parseFirebaseStorageObjectFromUrl(imageUrl);
    if (parsed) {
      try {
        const bucket = getAdminStorageBucket(parsed.bucket);
        const file = bucket.file(parsed.objectPath);
        const [[metadata], [contents]] = await Promise.all([
          file.getMetadata(),
          file.download(),
        ]);
        const contentType = metadata?.contentType || "image/jpeg";
        // contents is a Node.js Buffer (subclass of Uint8Array) – NextResponse accepts it
        return new NextResponse(contents, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": "inline",
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err) {
        console.warn(
          "Admin SDK download failed, trying direct fetch:",
          err?.message,
        );
      }
    }

    // ── Strategy 2: Direct fetch of the original URL ──
    const tryFetch = async (url) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10000);
      try {
        return await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept:
              "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://www.dkju.in/",
          },
        });
      } finally {
        clearTimeout(t);
      }
    };

    let response = await tryFetch(imageUrl).catch(() => null);

    // ── Strategy 3: Tokenless fetch (storage rules: allow read: if true) ──
    if ((!response || !response.ok) && parsed) {
      const tokenlessUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(parsed.bucket)}/o/${encodeURIComponent(parsed.objectPath)}?alt=media`;
      response = await tryFetch(tokenlessUrl).catch(() => null);
    }

    if (!response || !response.ok) {
      const upstreamText = response
        ? await response
            .clone()
            .text()
            .catch(() => "")
        : "";
      console.warn(
        `Proxy all strategies failed for: ${imageUrl}`,
        upstreamText.slice(0, 200),
      );
      return emptyImageResponse();
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const msg = error?.name === "AbortError" ? "Timed out" : error?.message;
    console.warn("Image proxy GET error:", msg);
    return new NextResponse(null, { status: 500 });
  }
}

function emptyImageResponse() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function isSupportedUrl(url) {
  return (
    typeof url === "string" &&
    (url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("gs://"))
  );
}

function sanitizeExternalUrl(url) {
  if (typeof url !== "string") return null;
  const cleaned = url.replace(/\s+/g, "").trim();
  return cleaned || null;
}

function bufferToDataUrl(buffer, mimeType) {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${mimeType || "image/jpeg"};base64,${base64}`;
}

function parseFirebaseStorageObjectFromUrl(imageUrl) {
  if (typeof imageUrl !== "string") return null;

  if (imageUrl.startsWith("gs://")) {
    const withoutScheme = imageUrl.slice("gs://".length);
    const firstSlash = withoutScheme.indexOf("/");
    if (firstSlash === -1) return null;
    const bucket = withoutScheme.slice(0, firstSlash);
    const objectPath = withoutScheme.slice(firstSlash + 1);
    if (!bucket || !objectPath) return null;
    return { bucket, objectPath };
  }

  try {
    const url = new URL(imageUrl);
    if (url.hostname !== "firebasestorage.googleapis.com") return null;

    const parts = url.pathname.split("/").filter(Boolean);
    // /v0/b/<bucket>/o/<object>
    const bIndex = parts.indexOf("b");
    const oIndex = parts.indexOf("o");
    if (bIndex === -1 || oIndex === -1) return null;
    const bucket = parts[bIndex + 1];
    const objectEncoded = parts[oIndex + 1];
    if (!bucket || !objectEncoded) return null;
    const objectPath = decodeURIComponent(objectEncoded);
    return { bucket, objectPath };
  } catch {
    return null;
  }
}

async function fetchFirebaseStorageAsDataUrl(imageUrl) {
  const parsed = parseFirebaseStorageObjectFromUrl(imageUrl);
  if (!parsed) return null;

  try {
    const bucket = getAdminStorageBucket(parsed.bucket);
    const file = bucket.file(parsed.objectPath);
    const [metadata] = await file.getMetadata();
    const [contents] = await file.download();
    const contentType = metadata?.contentType || "image/jpeg";
    return bufferToDataUrl(contents, contentType);
  } catch (error) {
    console.warn(
      "Firebase Storage proxy fetch failed:",
      error?.message || error,
    );
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const imageUrl = sanitizeExternalUrl(body?.url);

    if (!imageUrl) {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    if (!isSupportedUrl(imageUrl)) {
      return NextResponse.json(
        { dataUrl: "", error: "Unsupported URL" },
        { status: 200 },
      );
    }

    // Prefer admin-based Firebase Storage access when possible (avoids 401 for protected URLs).
    const firebaseDataUrl = await fetchFirebaseStorageAsDataUrl(imageUrl);
    if (firebaseDataUrl) {
      return NextResponse.json({ dataUrl: firebaseDataUrl }, { status: 200 });
    }

    // console.log("Proxying image:", imageUrl);

    const controller = new AbortController();
    const timeoutMs = 8000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      // Avoid caching auth failures.
      cache: "no-store",
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.error(
        `Upstream fetch failed: ${response.status} ${response.statusText}`,
      );
      // Don't hard-fail the whole PDF generation for image auth/CORS problems.
      // Return an empty dataUrl so the client can proceed without an image.
      return NextResponse.json(
        {
          dataUrl: "",
          upstreamStatus: response.status,
          error: `Failed to fetch image: ${response.status} ${response.statusText}`,
        },
        { status: 200 },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get("content-type") || "image/jpeg";
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({ dataUrl });
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? "Upstream fetch timed out"
        : error?.message || String(error);
    console.warn("Image proxy error:", message);
    return NextResponse.json(
      { dataUrl: "", error: `Failed to process image: ${message}` },
      { status: 200 },
    );
  }
}
