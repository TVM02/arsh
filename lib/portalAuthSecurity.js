"use client";

import { signInWithPhoneNumber, RecaptchaVerifier } from "firebase/auth";
import { auth } from "@/lib/firebase";

export const MAX_PASSWORD_ATTEMPTS = 3;
export const PASSWORD_LOCK_MS = 4 * 60 * 60 * 1000;
export const OTP_SESSION_MS = 10 * 60 * 1000; // 10 minutes
export const DEV_OTP = "123456";
export const REGISTERED_PHONE_REQUIRED_MESSAGE =
  "No registered phone number is saved for this account. Please contact the administrator to add it before OTP login.";

function storageKey(portal, identifier) {
  return `dkju-login-attempts:${portal}:${String(identifier || "").trim().toLowerCase()}`;
}

export function getLoginAttemptState(portal, identifier) {
  if (typeof window === "undefined") {
    return { failures: 0, remaining: MAX_PASSWORD_ATTEMPTS, locked: false };
  }

  try {
    const raw = window.localStorage.getItem(storageKey(portal, identifier));
    const data = raw ? JSON.parse(raw) : {};
    const lockedUntil = Number(data.lockedUntil || 0);
    const locked = lockedUntil > Date.now();

    if (!locked && lockedUntil) {
      window.localStorage.removeItem(storageKey(portal, identifier));
      return { failures: 0, remaining: MAX_PASSWORD_ATTEMPTS, locked: false };
    }

    const failures = Number(data.failures || 0);
    return {
      failures,
      remaining: Math.max(0, MAX_PASSWORD_ATTEMPTS - failures),
      locked,
      lockedUntil,
    };
  } catch {
    return { failures: 0, remaining: MAX_PASSWORD_ATTEMPTS, locked: false };
  }
}

export function recordLoginFailure(portal, identifier) {
  if (typeof window === "undefined") return getLoginAttemptState(portal, identifier);

  const previous = getLoginAttemptState(portal, identifier);
  const failures = previous.locked ? previous.failures : previous.failures + 1;
  const lockedUntil =
    failures >= MAX_PASSWORD_ATTEMPTS ? Date.now() + PASSWORD_LOCK_MS : 0;

  window.localStorage.setItem(
    storageKey(portal, identifier),
    JSON.stringify({ failures, lockedUntil }),
  );

  return getLoginAttemptState(portal, identifier);
}

export function resetLoginFailures(portal, identifier) {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(storageKey(portal, identifier));
  }
}

export function formatLockTime(lockedUntil) {
  const diff = Math.max(0, Number(lockedUntil || 0) - Date.now());
  const totalMinutes = Math.max(1, Math.ceil(diff / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const hourText =
    hours === 1 ? "1 hour" : hours > 1 ? `${hours} hours` : "";
  const minuteText =
    minutes === 1 ? "1 minute" : minutes > 1 ? `${minutes} minutes` : "";

  return [hourText, minuteText].filter(Boolean).join(" ") || "1 minute";
}

export function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

export function pickPhone(...values) {
  return values.map(normalizePhone).find((value) => /^\d{10,15}$/.test(value)) || "";
}

function maskPhone(phone) {
  const normalized = normalizePhone(phone);
  return normalized ? `xxxxxx${normalized.slice(-4)}` : "";
}

function isDevBypassEnabled() {
  return process.env.NODE_ENV !== "production";
}

export function withVerifiedOtpSession(userData) {
  return {
    ...userData,
    authSessionIssuedAt: Date.now(),
    otpVerifiedAt: Date.now(),
  };
}

// ── Firebase Phone Auth helpers ───────────────────────────────────────────
// Invisible reCAPTCHA verifier — reused across OTP sends, recreated on error.
let _recaptchaVerifier = null;
// Map<sessionId, ConfirmationResult> — stores Firebase OTP sessions
const _fbConfirmations = new Map();

function _getOrCreateVerifier() {
  if (_recaptchaVerifier) return _recaptchaVerifier;
  // Dynamically create a hidden container if it doesn't exist yet.
  if (!document.getElementById("dkju-recaptcha-root")) {
    const el = document.createElement("div");
    el.id = "dkju-recaptcha-root";
    el.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;";
    document.body.appendChild(el);
  }
  _recaptchaVerifier = new RecaptchaVerifier(auth, "dkju-recaptcha-root", {
    size: "invisible",
    callback: () => {},
    "expired-callback": () => { _recaptchaVerifier = null; },
  });
  return _recaptchaVerifier;
}

function _destroyVerifier() {
  if (_recaptchaVerifier) {
    try { _recaptchaVerifier.clear(); } catch {}
    _recaptchaVerifier = null;
  }
}

// Called on login-page mount so the invisible widget is pre-rendered and
// the first OTP send is faster (no extra round-trip for reCAPTCHA solve).
export function prewarmRecaptcha() {
  if (typeof window === "undefined") return;
  try { _getOrCreateVerifier(); } catch {}
}

let _otpSendInFlight = false;

export async function requestPortalOtp(payload) {
  if (_otpSendInFlight) {
    throw new Error("An OTP send is already in progress. Please wait a moment.");
  }
  _otpSendInFlight = true;
  try {
    return await _doRequestPortalOtp(payload);
  } finally {
    _otpSendInFlight = false;
  }
}

async function _doRequestPortalOtp(payload) {
  const isSpecialEmailUser = [
    "yourletters2me@gmail.com",
    "yourletters2me@live.com",
    
  ].includes(String(payload.identifier || payload.email || "").trim().toLowerCase());

  if (isSpecialEmailUser) {
    const targetEmail = payload.email || payload.identifier;
    const emailResponse = await fetch("/api/auth/email-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: targetEmail, action: "send" }),
    });
    const data = await emailResponse.json().catch(() => ({}));
    if (!emailResponse.ok || !data.success) {
      throw new Error(data.error || "Failed to send email OTP.");
    }
    return {
      sessionId: data.sessionId,
      provider: "email",
      emailMasked: targetEmail.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + "*".repeat(gp3.length)),
    };
  }

  const phone = normalizePhone(payload.phone);
  if (!/^\d{10,15}$/.test(phone)) {
    throw new Error("A valid phone number is required for OTP login.");
  }

  const phoneMasked = maskPhone(phone);

  // Dev bypass — no Firebase call; OTP accepted as DEV_OTP ("123456")
  if (isDevBypassEnabled()) {
    return {
      sessionId: `dev_${Date.now()}`,
      portal: payload.portal || "Portal",
      phoneMasked,
      provider: "phone",
      devMode: true,
      debugOtp: DEV_OTP,
    };
  }

  // Production: Firebase Phone Auth — Firebase sends the SMS directly.
  // No third-party SMS gateway keys required.
  const e164 = phone.length === 10 ? `+91${phone}` : `+${phone}`;
  try {
    const verifier = _getOrCreateVerifier();
    const confirmationResult = await signInWithPhoneNumber(auth, e164, verifier);
    const sessionId = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    _fbConfirmations.set(sessionId, confirmationResult);
    // Auto-expire session after 15 minutes
    setTimeout(() => _fbConfirmations.delete(sessionId), 15 * 60 * 1000);
    return {
      sessionId,
      portal: payload.portal || "Portal",
      phoneMasked,
      provider: "firebase_phone",
    };
  } catch (err) {
    _destroyVerifier(); // reset so next attempt gets a fresh verifier
    const code = err?.code || "";
    if (code === "auth/invalid-phone-number")
      throw new Error("Invalid phone number format. Please contact the administrator.");
    if (code === "auth/too-many-requests")
      throw new Error("Too many OTP requests for this number. Please try again later.");
    if (code === "auth/quota-exceeded")
      throw new Error("SMS quota exceeded. Please try again later.");
    throw new Error(err.message || "Failed to send OTP. Please try again.");
  }
}

export async function verifyPortalOtp(challenge, otp) {
  const normalizedOtp = String(otp || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw new Error("Enter the 6 digit OTP.");
  }

  // Email OTP path (unchanged — already backend-verified)
  if (challenge?.provider === "email") {
    if (!challenge.sessionId) {
      throw new Error("OTP session expired. Please request OTP again.");
    }

    if ((challenge?.devMode || isDevBypassEnabled()) && normalizedOtp === DEV_OTP) {
      return { verified: true, devMode: true };
    }

    const response = await fetch("/api/auth/email-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "verify",
        sessionId: challenge.sessionId,
        otp: normalizedOtp,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Invalid OTP. Please check the code and try again.");
    }
    return { verified: true };
  }

  // Dev bypass for phone OTP
  if (challenge?.devMode || isDevBypassEnabled()) {
    if (normalizedOtp !== DEV_OTP) {
      throw new Error(`Invalid OTP. Use ${DEV_OTP} in development.`);
    }
    return { verified: true, devMode: true };
  }

  // Firebase Phone Auth path — verify client-side, no backend round-trip
  if (challenge?.provider === "firebase_phone") {
    const confirmationResult = _fbConfirmations.get(challenge.sessionId);
    if (!confirmationResult) {
      throw new Error("OTP session expired. Please request a new OTP.");
    }
    try {
      await confirmationResult.confirm(normalizedOtp);
      _fbConfirmations.delete(challenge.sessionId);
      return { verified: true };
    } catch (err) {
      const code = err?.code || "";
      if (code === "auth/invalid-verification-code")
        throw new Error("Invalid OTP. Please check the code and try again.");
      if (code === "auth/code-expired")
        throw new Error("OTP has expired. Please request a new one.");
      if (code === "auth/too-many-requests")
        throw new Error("Too many incorrect attempts. Please request a new OTP.");
      throw new Error(err.message || "OTP verification failed. Please try again.");
    }
  }

  throw new Error("OTP session expired. Please request OTP again.");
}
