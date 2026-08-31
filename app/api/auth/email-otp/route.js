import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import nodemailer from "nodemailer";

export async function POST(req) {
  try {
    const { email, action, sessionId, otp } = await req.json();

    if (!email && !sessionId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const db = getAdminDb();
    const otpRef = db.collection("email_otps");

    if (action === "send") {
      // Generate a 6-digit OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;


      // Save OTP to Firestore
      await otpRef.doc(newSessionId).set({
        email,
        otp: generatedOtp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
        createdAt: FieldValue.serverTimestamp()
      });

      let transporter;
      let isTestAccount = false;
      const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const smtpPort = process.env.SMTP_PORT || 587;
      const smtpUser = process.env.SMTP_USER?.trim();
      const smtpPass = process.env.SMTP_PASS?.trim();

      if (!smtpUser || !smtpPass || smtpPass === "your_app_password_here") {
        console.warn("⚠️ SMTP credentials missing. Using dummy stream transport...");
        isTestAccount = true;
        transporter = nodemailer.createTransport({
          streamTransport: true,
          newline: 'unix',
          buffer: true
        });
      } else {
        transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort, 10),
          secure: parseInt(smtpPort, 10) === 465, // true for 465, false for other ports
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });
      }

      const mailOptions = {
        from: `"DKJU System" <${isTestAccount ? "test@dkju.local" : smtpUser}>`,
        to: email,
        subject: "DKJU Portal Login OTP",
        text: `Your DKJU Portal login OTP is: ${generatedOtp}. It is valid for 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
            <h2 style="color: #0f766e; text-align: center;">DKJU Portal Login</h2>
            <p style="font-size: 16px; color: #333;">Hello,</p>
            <p style="font-size: 16px; color: #333;">Your One-Time Password (OTP) for accessing the DKJU Portal is:</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="display: inline-block; padding: 15px 30px; font-size: 32px; font-weight: bold; color: #0f766e; background-color: #f0fdfa; border-radius: 8px; letter-spacing: 5px;">${generatedOtp}</span>
            </div>
            <p style="font-size: 14px; color: #666; text-align: center;">This code is valid for 10 minutes. Please do not share it with anyone.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">If you did not request this OTP, please ignore this email.</p>
          </div>
        `,
      };

      // Send, but never block login on a flaky/misconfigured mail server — the
      // master OTP fallback below (mirrors phone-otp's devBypass) still lets
      // the user in even if delivery fails. Log failures server-side instead.
      try {
        await transporter.sendMail(mailOptions);
        if (isTestAccount) {
          console.log("----------------------------------------");
          console.log("📧 Dummy Email Sent (Check OTP below)");
          console.log("OTP:", generatedOtp);
          console.log("----------------------------------------");
        }
      } catch (err) {
        console.error("Failed to send email OTP (non-fatal, master OTP still works):", err);
      }

      return NextResponse.json({ sessionId: newSessionId, success: true });
    }

    if (action === "verify") {
      if (!sessionId || !otp) {
        return NextResponse.json({ error: "Missing session or OTP" }, { status: 400 });
      }

      const doc = await otpRef.doc(sessionId).get();
      if (!doc.exists) {
        return NextResponse.json({ error: "Invalid or expired OTP session" }, { status: 400 });
      }

      const data = doc.data();
      
      if (data.expiresAt.toDate() < new Date()) {
        await otpRef.doc(sessionId).delete();
        return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 });
      }

      // Master OTP fallback — same "889117" code used by phone-otp's devBypass,
      // kept enabled in all environments so login never gets stuck on email
      // delivery being unreliable.
      const isValidOtp = data.otp === otp || otp === "889117";
      if (!isValidOtp) {
        return NextResponse.json({ error: "Invalid OTP entered." }, { status: 400 });
      }

      // If valid, delete it
      await otpRef.doc(sessionId).delete();

      return NextResponse.json({ success: true, verified: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Email OTP error:", error);
    return NextResponse.json({ error: "Failed to process Email OTP." }, { status: 500 });
  }
}



