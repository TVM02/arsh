import { initializeApp, getApp as getFirebaseApp, getApps } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const REQUIRED_CONFIG_KEYS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

const getRuntimeConfig = () =>
  typeof window !== "undefined" ? window.__DKJU_FIREBASE_CONFIG__ : null;

const getEnvConfig = () => ({
  apiKey:
    process.env.NEXT_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain:
    process.env.NEXT_FIREBASE_AUTH_DOMAIN ||
    process.env.FIREBASE_AUTH_DOMAIN,
  projectId:
    process.env.NEXT_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID,
  storageBucket:
    process.env.NEXT_FIREBASE_STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    process.env.NEXT_FIREBASE_MESSAGING_SENDER_ID ||
    process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId:
    process.env.NEXT_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
  appCheckSiteKey:
    process.env.NEXT_FIREBASE_APPCHECK_SITE_KEY ||
    process.env.FIREBASE_APPCHECK_SITE_KEY,
});

const compactConfig = (config) =>
  Object.fromEntries(
    Object.entries(config || {}).filter(([, value]) => Boolean(value)),
  );

const validateFirebaseConfig = (config) => {
  const missing = REQUIRED_CONFIG_KEYS.filter((key) => !config?.[key]);

  if (missing.length > 0) {
    throw new Error(
      `Firebase client config is not loaded. Missing: ${missing.join(", ")}`,
    );
  }
};

const getFirebaseConfig = () => {
  const config = {
    ...compactConfig(getEnvConfig()),
    ...compactConfig(getRuntimeConfig()),
  };
  validateFirebaseConfig(config);
  return config;
};

const config = getFirebaseConfig();
const app = getApps().length ? getFirebaseApp() : initializeApp(config);

// App Check is production-only: in dev its reCAPTCHA Enterprise falls back to v2
// which blocks Phone Auth's own invisible reCAPTCHA verifier.
if (typeof window !== "undefined" && config.appCheckSiteKey && process.env.NODE_ENV === "production") {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(config.appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.warn("App Check initialization failed:", error);
  }
}

export const auth = getAuth(app);
if (typeof window !== "undefined") {
  setPersistence(auth, browserSessionPersistence).catch(console.error);
}
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export const getAuthInstance = () => auth;
export const getDbInstance = () => db;
export const getStorageInstance = () => storage;
export const getFunctionsInstance = () => functions;
export const getApp = () => app;
export const ensureInitialized = () => Promise.resolve(app);

export default app;
