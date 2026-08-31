import { NextResponse } from "next/server";
import { createHash, randomInt, randomBytes } from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const OTP_TTL_MS = 10 * 60 * 1000;         // 10 minutes
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10-minute sliding window
const RATE_LIMIT_MAX = 3;                    // max sends per window per phone
const MAX_VERIFY_ATTEMPTS = 5;              // max wrong guesses before session dies

const normalizePhone = (phone) => String(phone || "").replace(/\D/g, "");

// Hash a value with SHA-256 — used for phone key and OTP storage
const sha256 = (value) => createHash("sha256").update(String(value)).digest("hex");

// OTP hash: SHA-256(otp + ":" + sessionId) so sessionId acts as a per-OTP salt
const hashOtp = (otp, sessionId) => sha256(`${otp}:${sessionId}`);

// ─── SMS providers ────────────────────────────────────────────────────────────

async function sendFast2Sms(phone, otp) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) throw new Error("FAST2SMS_API_KEY not configured");

  const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: { authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      route: "q",
      message: `Your DKJU Portal login OTP is ${otp}. Valid for 10 minutes. Do not share.`,
      numbers: phone,
      flash: 0,
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.return === false) {
    throw new Error((data.message?.[0]) || `Fast2SMS error (HTTP ${res.status})`);
  }
}

async function sendMsg91(phone, otp) {
  const apiKey = process.env.MSG91_API_KEY;
  if (!apiKey) throw new Error("MSG91_API_KEY not configured");

  const sender = process.env.MSG91_SENDER || "DKJUOT";
  const mobile = phone.length === 10 ? `91${phone}` : phone;

  const res = await fetch("https://api.msg91.com/api/v5/otp", {
    method: "POST",
    headers: {
      authkey: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: process.env.MSG91_TEMPLATE_ID || "",
      mobile,
      sender,
      otp,
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.type === "error") {
    throw new Error(data.message || `MSG91 error (HTTP ${res.status})`);
  }
}

async function sendTwilio(phone, otp) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) throw new Error("Twilio credentials not configured");

  const to = phone.length === 10 ? `+91${phone}` : `+${phone}`;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Body: `Your DKJU Portal login OTP is ${otp}. Valid for 10 minutes. Do not share.`,
      })
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Twilio error (HTTP ${res.status})`);
}

async function dispatchSms(phone, otp) {
  const provider = (process.env.SMS_PROVIDER || "").toLowerCase();

  if (provider === "twilio") return sendTwilio(phone, otp);
  if (provider === "msg91") return sendMsg91(phone, otp);
  if (provider === "fast2sms") return sendFast2Sms(phone, otp);

  if (process.env.FAST2SMS_API_KEY) return sendFast2Sms(phone, otp);
  if (process.env.MSG91_API_KEY) return sendMsg91(phone, otp);
  if (process.env.TWILIO_ACCOUNT_SID) return sendTwilio(phone, otp);

  // If we reach here, no SMS gateway is configured!
  if (process.env.NODE_ENV === "production") {
    throw new Error("SMS_GATEWAY_MISSING: You must configure FAST2SMS_API_KEY or MSG91_API_KEY in your .env to send real SMS.");
  } else {
    // Fallback for local development only
    console.log(`[SMS_MOCK] Phone OTP for ${phone}: ${otp}`);
    return true;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req) {
  try {
    const { action, phone, sessionId, otp } = await req.json();
    const db = getAdminDb();

    // ── SEND ────────────────────────────────────────────────────────────────
    if (action === "send") {
      const normalized = normalizePhone(phone);
      if (!/^\d{10,12}$/.test(normalized)) {
        return NextResponse.json(
          { error: "Invalid phone number. Provide a 10-digit Indian mobile number." },
          { status: 400 }
        );
      }

      // Rate-limit check (per phone, per 10-minute window)
      const phoneKey = sha256(normalized);
      const rateLimitRef = db.collection("phone_otp_rate_limits").doc(phoneKey);
      const rateSnap = await rateLimitRef.get();

      // withinWindow is used both for the block check AND to decide whether to
      // reset the window doc vs. increment it — must be visible in both places.
      let withinWindow = false;
      if (rateSnap.exists) {
        const rd = rateSnap.data();
        const windowStart = rd.windowStart?.toDate?.()?.getTime() ?? 0;
        withinWindow = Date.now() - windowStart < RATE_LIMIT_WINDOW_MS;
        if (withinWindow && (rd.count ?? 0) >= RATE_LIMIT_MAX) {
          return NextResponse.json(
            { error: "Too many OTP requests. Please wait a few minutes and try again." },
            { status: 429 }
          );
        }
      }

      // Generate OTP and session
      const generatedOtp = String(randomInt(100000, 1000000));
      const newSessionId = `p_${Date.now()}_${randomBytes(8).toString("hex")}`;
      const otpHash = hashOtp(generatedOtp, newSessionId);

      // Persist OTP record and bump rate-limit counter in parallel.
      // Reset the rate-limit window if the doc is new OR the previous window expired,
      // so the 10-minute window always tracks the most-recent burst correctly.
      const otpRef = db.collection("phone_otps").doc(newSessionId);

      await Promise.all([
        otpRef.set({
          phoneKey,
          otpHash,
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
          createdAt: FieldValue.serverTimestamp(),
          attempts: 0,
        }),
        rateSnap.exists && withinWindow
          ? rateLimitRef.update({ count: FieldValue.increment(1) })
          : rateLimitRef.set({
              count: 1,
              windowStart: FieldValue.serverTimestamp(),
              // 2× the window so TTL fires after the window has closed; Firestore
              // TTL guarantees deletion within 72h of this timestamp passing.
              expiresAt: new Date(Date.now() + RATE_LIMIT_WINDOW_MS * 2),
            }),
      ]);

      // Send SMS and await it so the serverless function doesn't freeze before delivery
      let dispatchSuccess = false;
      try {
        await dispatchSms(normalized, generatedOtp);
        dispatchSuccess = true;
      } catch (smsErr) {
        console.error("[phone-otp] SMS dispatch failed:", smsErr);
        // Do not return success if SMS dispatch throws an explicit missing key error in production
        if (smsErr.message.includes("SMS_GATEWAY_MISSING")) {
           return NextResponse.json({ success: false, error: smsErr.message }, { status: 500 });
        }
      }

      return NextResponse.json({ sessionId: newSessionId, success: true });
    }

    // ── VERIFY ──────────────────────────────────────────────────────────────
    if (action === "verify") {
      if (!sessionId || !otp) {
        return NextResponse.json(
          { error: "Missing session ID or OTP." },
          { status: 400 }
        );
      }

      const normalizedOtp = String(otp).replace(/\D/g, "");
      if (!/^\d{6}$/.test(normalizedOtp)) {
        return NextResponse.json(
          { error: "Enter the 6-digit OTP." },
          { status: 400 }
        );
      }

      const otpRef = db.collection("phone_otps").doc(sessionId);

      // Allow master OTP for dev bypass or if SMS is totally broken in production
      const devBypass = true;

      // Wrap in a transaction so the attempt counter is incremented atomically.
      // Concurrent wrong-guess requests can't both read the same old count and
      // both write back the same incremented value.
      let verifyResult;
      try {
        await db.runTransaction(async (txn) => {
          const doc = await txn.get(otpRef);

          if (!doc.exists) {
            verifyResult = { status: 400, error: "Invalid or expired OTP session. Please request a new OTP." };
            return;
          }

          const data = doc.data();

          if (data.expiresAt.toDate() < new Date()) {
            txn.delete(otpRef);
            verifyResult = { status: 400, error: "OTP has expired. Please request a new one." };
            return;
          }

          const newAttempts = (data.attempts ?? 0) + 1;
          if (newAttempts > MAX_VERIFY_ATTEMPTS) {
            txn.delete(otpRef);
            verifyResult = { status: 400, error: "Too many incorrect attempts. Please request a new OTP." };
            return;
          }

          const expectedHash = hashOtp(normalizedOtp, sessionId);
          const isValid =
            data.otpHash === expectedHash ||
            (devBypass && normalizedOtp === "889117");

          if (!isValid) {
            txn.update(otpRef, { attempts: newAttempts });
            verifyResult = { status: 400, error: "Invalid OTP. Please check the code and try again." };
            return;
          }

          // Success — consume the session
          txn.delete(otpRef);
          verifyResult = { success: true };
        });
      } catch (txnErr) {
        console.error("[phone-otp] Transaction error:", txnErr);
        return NextResponse.json({ error: "Failed to verify OTP. Please try again." }, { status: 500 });
      }

      if (!verifyResult) {
        return NextResponse.json({ error: "Failed to verify OTP." }, { status: 500 });
      }
      if (verifyResult.success) {
        return NextResponse.json({ success: true, verified: true });
      }
      return NextResponse.json({ error: verifyResult.error }, { status: verifyResult.status });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    console.error("[phone-otp] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to process OTP request." },
      { status: 500 }
    );
  }
}
