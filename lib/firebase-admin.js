import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

/**
 * Reconstruct a PEM private key so cert() always receives a valid DER-encoded key.
 *
 * Handles EVERY Vercel env-var encoding variant:
 *   • Literal "\n"  (backslash + n)  — most common from Vercel UI paste
 *   • Literal "\\n" (two backslashes + n) — double-escaped
 *   • Actual newlines — correctly stored
 *   • CRLF / CR — Windows/old-Mac line endings
 *
 * After conversion the body is stripped of ALL whitespace and reformatted at
 * exactly 64 characters per line (RFC 7468). This is immune to any truncation
 * or stray character that crept in during env-var round-tripping.
 */
function normalizePemKey(rawKey) {
  if (!rawKey) return rawKey;

  // Step 1: collapse every newline encoding to a real newline.
  // We must handle double-escaped FIRST to avoid partial replacement artefacts.
  let key = rawKey
    .replace(/\\\\n/g, "\n") // literal \\n  → newline
    .replace(/\\n/g, "\n") // literal \n   → newline
    .replace(/\r\n/g, "\n") // CRLF         → LF
    .replace(/\r/g, "\n"); // CR           → LF

  // Step 2: full PEM reconstruction — strips corrupted line breaks in the body
  // and rewraps at the standard 64-char width.
  const headerMatch = key.match(/-----BEGIN [A-Z ]+-----/);
  const footerMatch = key.match(/-----END [A-Z ]+-----/);

  if (headerMatch && footerMatch) {
    const header = headerMatch[0];
    const footer = footerMatch[0];
    const bodyRaw = key
      .substring(key.indexOf(header) + header.length, key.lastIndexOf(footer))
      .replace(/[^A-Za-z0-9+/=]/g, ""); // keep only valid base64 chars

    if (bodyRaw.length > 0) {
      const lines = bodyRaw.match(/.{1,64}/g) || [];
      key = `${header}\n${lines.join("\n")}\n${footer}\n`;
    }
  }

  return key;
}

/**
 * Build a service-account credential object from environment variables.
 *
 * Strategy (tried in order):
 *
 * 1. INDIVIDUAL vars  — FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL
 *    This is the most reliable pattern for Vercel because you store just the
 *    PEM key in one var (no JSON escaping, no nested quotes).
 *    Set in Vercel dashboard:
 *      FIREBASE_CLIENT_EMAIL  = firebase-adminsdk-xxx@<project>.iam.gserviceaccount.com
 *      FIREBASE_PRIVATE_KEY   = -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
 *                               (paste the raw value from the JSON file — keep \n as-is)
 *
 * 2. FULL JSON  — FIREBASE_SERVICE_ACCOUNT_KEY
 *    The entire serviceAccount JSON pasted as a plain string.  Works when
 *    copied from the downloaded .json file and pasted verbatim into Vercel.
 */
function buildServiceAccountCredential() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // ── Strategy 1: individual env vars ──────────────────────────────────────
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (privateKeyRaw && clientEmail) {
    const privateKey = normalizePemKey(privateKeyRaw);
    return {
      type: "service_account",
      project_id: projectId,
      private_key: privateKey,
      client_email: clientEmail,
    };
  }

  // ── Strategy 2: full JSON env var ────────────────────────────────────────
  const keyStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!keyStr) return null;

  let str = keyStr.trim();

  // Unwrap outer string-escaping if Vercel stored it as a JSON string literal
  if (str.startsWith('"') && str.endsWith('"')) {
    try {
      str = JSON.parse(str);
    } catch (_) {
      /* ignore */
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(str);
  } catch (e) {
    console.error(
      "Firebase Admin: FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON:",
      e.message,
    );
    return null;
  }

  if (!parsed?.private_key || !parsed?.client_email) {
    console.error(
      "Firebase Admin: service account JSON is missing private_key or client_email.",
    );
    return null;
  }

  parsed.private_key = normalizePemKey(parsed.private_key);

  if (!parsed.private_key?.includes("-----BEGIN")) {
    console.error(
      "Firebase Admin: private_key does not look like a valid PEM key after normalisation.",
    );
    return null;
  }

  return parsed;
}

const APP_NAME = "firebase-admin-app";

function createAdminApp() {
  // Return existing named app if already initialised
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const serviceAccount = buildServiceAccountCredential();

  if (!serviceAccount) {
    console.error(
      "Firebase Admin: No valid credentials found.\n" +
        "  Option A (recommended): set FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL in Vercel.\n" +
        "  Option B: set FIREBASE_SERVICE_ACCOUNT_KEY to the full service account JSON.",
    );
    // Last-resort: Application Default Credentials (only works on GCP infra)
    return initializeApp({ projectId }, APP_NAME);
  }

  return initializeApp(
    {
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
    },
    APP_NAME,
  );
}

// ─── Lazy singletons ────────────────────────────────────────────────────────
// IMPORTANT: Do NOT call any of these at module-level (i.e. outside a function
// body).  Next.js evaluates module-level code during `next build`'s
// "Collecting page data" phase, which runs before environment variables are
// fully available on Vercel.  Keeping initialization lazy means Firebase Admin
// only boots at actual request time.

let _adminApp = null;
let _adminDb = null;
let _adminAuth = null;
let _adminStorage = null;

export function getAdminApp() {
  if (!_adminApp) _adminApp = createAdminApp();
  return _adminApp;
}

export function getAdminDb() {
  if (!_adminDb) _adminDb = getFirestore(getAdminApp());
  return _adminDb;
}

export function getAdminAuth() {
  if (!_adminAuth) _adminAuth = getAuth(getAdminApp());
  return _adminAuth;
}

export function getAdminStorageInstance() {
  if (!_adminStorage) _adminStorage = getStorage(getAdminApp());
  return _adminStorage;
}

export function getAdminStorageBucket(bucketName) {
  const resolvedBucketName =
    bucketName || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!resolvedBucketName) {
    throw new Error(
      "Missing Firebase storage bucket name (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)",
    );
  }
  return getAdminStorageInstance().bucket(resolvedBucketName);
}
