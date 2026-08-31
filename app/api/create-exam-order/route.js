export const dynamic = "force-dynamic"; 

import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { admissionNum, amount, purpose, examId, studentId } = body;

    // Validate required fields based on purpose
    if (purpose === "exam_registration") {
      if (!amount || !examId || !studentId) {
        return NextResponse.json(
          { error: "Amount, examId, and studentId are required for exam registration" },
          { status: 400 }
        );
      }
    } else {
      // Default admission flow
      if (!admissionNum) {
        return NextResponse.json(
          { error: "Admission number is required" },
          { status: 400 }
        );
      }
    }

    // Basic Auth (key_id:key_secret → Base64)
    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString("base64");

    // Generate short receipt (max 40 chars for Razorpay)
    const timestamp = Date.now().toString().slice(-10); // 10 digits for uniqueness
    let receipt;
    
    if (purpose === "exam_registration") {
      // Simple format: exam_XXXXXXXXXX (exam_ + 10 char timestamp = 15 chars)
      receipt = `exam_${timestamp}`;
    } else {
      // Admission format - keep original if short enough
      const tempReceipt = `rcpt_${admissionNum}_${timestamp.slice(-6)}`;
      if (tempReceipt.length <= 40) {
        receipt = tempReceipt;
      } else {
        // Fallback to simple format
        receipt = `adm_${timestamp}`;
      }
    }
    
    // Final safety check
    if (receipt.length > 40) {
      receipt = `ord_${timestamp}`;
    }

    // Order details
    const payload = {
      amount: amount || 2000, // in paise, default ₹500 for admission
      currency: "INR",
      receipt: receipt,
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
      { status: 500 }
    );
  }
}
