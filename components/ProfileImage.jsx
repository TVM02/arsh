"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { User } from "lucide-react";
import { resolveAndPersistProfilePicture } from "@/lib/profilePictureUtils";

/**
 * Normalise the `src` prop into a plain https:// string (or null).
 * Handles:
 *   - plain string URL
 *   - Cloudinary response object  { secure_url: "https://res.cloudinary.com/..." }
 *   - any object with a `url` field
 *   - empty string / null / undefined → null
 */
function normaliseSrc(src) {
  const sanitizeUrlString = (value) => {
    if (typeof value !== "string") return null;
    const cleaned = value.replace(/\s+/g, "").trim();
    return cleaned || null;
  };

  if (!src) return null;
  if (typeof src === "string") {
    const normalized = sanitizeUrlString(src);
    if (!normalized) return null;
    return normalized.startsWith("http") || normalized.startsWith("data:image/")
      ? normalized
      : null;
  }
  const isDisplayable = (value) =>
    typeof sanitizeUrlString(value) === "string" &&
    (sanitizeUrlString(value).startsWith("http") ||
      sanitizeUrlString(value).startsWith("data:image/"));

  const asDisplayable = (value) => {
    const normalized = sanitizeUrlString(value);
    return isDisplayable(normalized) ? normalized : null;
  };

  // Cloudinary / object shapes — use optional chaining for safety
  const url =
    asDisplayable(src?.secure_url) ??
    asDisplayable(src?.profilePicture) ??
    asDisplayable(src?.profilePictureUrl) ??
    asDisplayable(src?.photoURL) ??
    asDisplayable(src?.photo) ??
    asDisplayable(src?.imageUrl) ??
    asDisplayable(src?.profileImageUrl) ??
    asDisplayable(src?.url) ??
    asDisplayable(src?.downloadURL);
  return url ?? null;
}

/**
 * Parses a Firebase Storage URL (https or gs://) into { bucket, objectPath }.
 * Returns null for non-Firebase URLs.
 */
function parseFirebaseUrl(url) {
  if (!url) return null;

  if (url.startsWith("gs://")) {
    const without = url.slice("gs://".length);
    const slash = without.indexOf("/");
    if (slash === -1) return null;
    return {
      bucket: without.slice(0, slash),
      objectPath: without.slice(slash + 1),
    };
  }

  if (url.includes("firebasestorage.googleapis.com")) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split("/").filter(Boolean);
      const bIdx = parts.indexOf("b");
      const oIdx = parts.indexOf("o");
      if (bIdx === -1 || oIdx === -1) return null;
      const bucket = parts[bIdx + 1];
      const encodedPath = parts.slice(oIdx + 1).join("/");
      const objectPath = decodeURIComponent(encodedPath);
      if (!bucket || !objectPath) return null;
      return { bucket, objectPath };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Converts any Firebase Storage URL / gs:// path to the tokenless
 * public download URL: ?alt=media  (works when storage rules allow read: if true)
 */
function toTokenlessUrl(url) {
  const parsed = parseFirebaseUrl(url);
  if (!parsed) return null;
  const { bucket, objectPath } = parsed;
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectPath)}?alt=media`;
}

/**
 * Returns true for Cloudinary URLs – they must be proxied server-side to avoid
 * OpaqueResponseBlocking / CORS errors in the browser.
 */
function isCloudinaryUrl(url) {
  if (!url || typeof url !== "string") return false;
  return url.includes("res.cloudinary.com") || url.includes("cloudinary.com");
}

// Verified by direct HTTP request: every Cloudinary cloud name this app has
// ever stored a student photo under ("dxggxnjjw" and "dglkp24ki") currently
// returns 401 "cloud_name ... is disabled" — a Cloudinary account-level
// suspension, not a per-asset problem. That means EVERY res.cloudinary.com
// URL in this system is dead right now, so treat any of them as known-dead
// up front instead of wasting a proxy round trip discovering that. If the
// Cloudinary account(s) are ever reactivated, narrow this back down.
function isKnownDisabledCloudinaryUrl(url) {
  return typeof url === "string" && url.includes("res.cloudinary.com/");
}

/**
 * Derive the initial display state for a given src.
 * Known-dead Cloudinary URLs start at "recovering" — never rendered as an
 * <img>, since that account will always 401 and briefly flashes the
 * browser's native broken-image glyph while the recovery effect runs.
 * Firebase Storage URLs start at "tokenless".
 * Cloudinary URLs start at "proxy" (skip direct – avoids OpaqueResponseBlocking).
 * Everything else starts at "direct".
 */
function initialState(src) {
  const url = normaliseSrc(src);
  if (!url) return "failed";
  if (url.startsWith("data:image/")) return "direct";
  if (isKnownDisabledCloudinaryUrl(url)) return "recovering";
  if (toTokenlessUrl(url)) return "tokenless";
  if (isCloudinaryUrl(url)) return "proxy";
  return "direct";
}

/**
 * ProfileImage component
 *
 * For Firebase Storage URLs (tokenized or gs://):
 *   1. Tokenless ?alt=media URL (no Admin SDK – works with allow read: if true)
 *   2. Server proxy /api/proxy-image
 *   3. Placeholder
 *
 * For all other URLs:
 *   1. Direct
 *   2. Server proxy
 *   3. Placeholder
 *
 * Resets automatically when `src` changes (handles async-loaded src).
 */
export default function ProfileImage({
  src,
  alt = "Profile Picture",
  className = "w-full h-full object-cover",
  fallbackClassName = "w-full h-full flex flex-col items-center justify-center",
  iconClassName = "h-16 w-16 text-gray-400 mb-2",
  showText = true,
  sourceData = null,
  onResolved = null,
}) {
  const [recoveredSrc, setRecoveredSrc] = useState(null);
  const failedUrlsRef = useRef(new Set());
  const onResolvedRef = useRef(onResolved);

  useEffect(() => {
    onResolvedRef.current = onResolved;
  }, [onResolved]);

  // Normalise src: handles strings, Cloudinary objects, gs:// etc.
  const effectiveSrc = useMemo(
    () => normaliseSrc(recoveredSrc || src),
    [recoveredSrc, src],
  );

  const [state, setState] = useState(() => initialState(recoveredSrc || src));

  // Reset whenever src changes (e.g. async-loaded modal data)
  useEffect(() => {
    setRecoveredSrc(null);
    failedUrlsRef.current = new Set();
    setState(initialState(src));
  }, [src]);

  useEffect(() => {
    if (!isKnownDisabledCloudinaryUrl(effectiveSrc)) return;

    let cancelled = false;
    const recoverBeforeRender = async () => {
      failedUrlsRef.current.add(effectiveSrc);
      if (!sourceData) {
        setState("failed");
        return;
      }

      try {
        const recovered = await resolveAndPersistProfilePicture(sourceData, {
          failedUrls: [effectiveSrc],
        });
        if (cancelled) return;
        if (recovered && recovered !== effectiveSrc) {
          setRecoveredSrc(recovered);
          setState(initialState(recovered));
          onResolvedRef.current?.(recovered);
        } else {
          setState("failed");
        }
      } catch (error) {
        console.warn(
          "[ProfileImage] pre-render recovery failed:",
          error?.message ?? error,
        );
        if (!cancelled) setState("failed");
      }
    };

    recoverBeforeRender();
    return () => {
      cancelled = true;
    };
  }, [effectiveSrc, sourceData]);

  const tokenless = useMemo(() => toTokenlessUrl(effectiveSrc), [effectiveSrc]);

  if (!effectiveSrc || state === "failed" || state === "recovering") {
    return (
      <div className={fallbackClassName}>
        <User className={iconClassName} />
        {showText && (
          <p className="text-xs text-gray-500 text-center px-2">
            No Profile Picture
          </p>
        )}
      </div>
    );
  }

  let imgSrc;
  if (state === "tokenless") {
    imgSrc = tokenless || effectiveSrc;
  } else if (state === "proxy") {
    imgSrc = `/api/proxy-image?url=${encodeURIComponent(effectiveSrc)}`;
  } else {
    imgSrc = effectiveSrc;
  }

  const tryRecoverAlternate = async () => {
    if (!sourceData || !effectiveSrc) return false;
    try {
      const failedUrls = Array.from(failedUrlsRef.current).concat(effectiveSrc);
      const recovered = await resolveAndPersistProfilePicture(sourceData, {
        failedUrls,
      });
      if (
        recovered &&
        recovered !== effectiveSrc &&
        !failedUrlsRef.current.has(recovered)
      ) {
        setRecoveredSrc(recovered);
        setState(initialState(recovered));
        onResolvedRef.current?.(recovered);
        return true;
      }
    } catch (error) {
      console.warn("[ProfileImage] recovery failed:", error?.message ?? error);
    }
    return false;
  };

  const handleError = async () => {
    if (effectiveSrc) failedUrlsRef.current.add(effectiveSrc);

    if (state === "tokenless") {
      setState("proxy");
      return;
    }
    if (state === "direct") {
      setState("proxy");
      return;
    }

    const recovered = await tryRecoverAlternate();
    if (!recovered) setState("failed");
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imgSrc} alt={alt} className={className} onError={handleError} />
  );
}
