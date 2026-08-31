export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settingsService";

const DEFAULT_ADMISSION_AMOUNT_PAISE = 2000; // ₹20 fallback

const parsePositiveNumber = (value) => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : null;
};

export async function POST(req) {
  try {
    const body = await req.json();
    const { admissionNum, amount, purpose, examId, studentId, studentClass } =
      body;

    // Validate required fields based on purpose
    if (purpose === "exam_registration") {
      if (!amount || !examId || !studentId) {
        return NextResponse.json(
          {
            error:
              "Amount, examId, and studentId are required for exam registration",
          },
          { status: 400 },
        );
      }
    } else {
      // Default admission flow
      if (!admissionNum) {
        return NextResponse.json(
          { error: "Admission number is required" },
          { status: 400 },
        );
      }
    }

    // Basic Auth (key_id:key_secret → Base64)
    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
    ).toString("base64");

    // Order details
    let finalAmountPaise;
    if (purpose === "exam_registration") {
      const parsedAmount = parsePositiveNumber(amount);
      if (!parsedAmount) {
        return NextResponse.json(
          { error: "Invalid amount for exam registration" },
          { status: 400 },
        );
      }
      finalAmountPaise = Math.round(parsedAmount);
    } else {
      const normalizedClass = (studentClass || "").toString().toLowerCase();
      // Load the per-class fees map from settings; fall back to legacy ukgAdmissionFee
      const admissionFees = await getSetting("admissionFees", null);
      let classFeeInr;
      if (
        admissionFees &&
        typeof admissionFees === "object" &&
        normalizedClass in admissionFees
      ) {
        const raw = admissionFees[normalizedClass];
        classFeeInr = typeof raw === "number" ? raw : Number(raw);
      } else {
        // Legacy fallback: if no admissionFees map, try ukgAdmissionFee for ukg
        if (normalizedClass === "ukg") {
          const legacyFee = await getSetting("ukgAdmissionFee", 100);
          classFeeInr =
            typeof legacyFee === "number" ? legacyFee : Number(legacyFee);
        } else {
          classFeeInr = DEFAULT_ADMISSION_AMOUNT_PAISE / 100; // ₹20 default
        }
      }
      if (Number.isFinite(classFeeInr) && classFeeInr >= 0) {
        finalAmountPaise =
          classFeeInr === 0 ? 0 : Math.round(classFeeInr * 100);
      } else {
        finalAmountPaise = DEFAULT_ADMISSION_AMOUNT_PAISE;
      }
    }

    const payload = {
      amount: finalAmountPaise, // in paise
      currency: "INR",
      receipt:
        purpose === "exam_registration"
          ? `exam_${examId}_${studentId}_${Date.now().toString().slice(-6)}`
          : `rcpt_${admissionNum}_${Date.now().toString().slice(-6)}`,
    };

    // POST request to Razorpay Orders API
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data }, { status: res.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("Error creating order:", err);
    return NextResponse.json(
      { error: "Unable to create payment order" },
      { status: 500 },
    );
  }
}
