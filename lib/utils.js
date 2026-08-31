import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize any UKG variant (ukg, UKG, Ukg, U.K.G, etc.) to canonical "Ukg".
 * All other class values are returned as-is (trimmed).
 */
export function normalizeClassDisplay(classVal) {
  if (!classVal) return "";
  const s = String(classVal).trim();
  const upper = s.toUpperCase().replace(/\./g, "");
  if (upper === "UKG") return "Ukg";
  return s;
}

/**
 * Returns a safe image src for profile pictures.
 * Returns the URL as-is; use the <ProfileImage> component which
 * automatically falls back to the server proxy on load failure.
 */
export function profileImageSrc(url) {
  if (!url) return null;
  return url;
}
