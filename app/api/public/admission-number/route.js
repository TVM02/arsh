export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function POST(req) {
  try {
    const { madarsaId } = await req.json();

    if (!madarsaId) {
      return NextResponse.json(
        { error: "madarsaId is required" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const counterRef = db.collection("counters").doc(`admission_${madarsaId}`);

    // ── Bootstrap counter if missing ─────────────────────────────────────────
    const counterSnap = await counterRef.get();
    if (!counterSnap.exists) {
      const [admSnap, stuSnap] = await Promise.all([
        db.collection("admissions").where("madarsa", "==", madarsaId).get(),
        db.collection("students").where("madarsaId", "==", madarsaId).get(),
      ]);

      let maxSeq = 0;
      const parseSeq = (num) => {
        if (!num || typeof num !== "string") return 0;
        const parts = num.split("-");
        const seqStr = parts[parts.length - 1];
        const val = parseInt(seqStr, 10);
        return isNaN(val) ? 0 : val;
      };

      admSnap.forEach((doc) => {
        maxSeq = Math.max(maxSeq, parseSeq(doc.data().admissionNumber));
      });
      stuSnap.forEach((doc) => {
        maxSeq = Math.max(maxSeq, parseSeq(doc.data().admissionNumber));
      });

      try {
        await counterRef.set(
          { count: maxSeq, initializedAt: new Date() },
          { merge: true }
        );
      } catch (err) {
        console.warn("Could not write initial counter (non-fatal):", err);
      }
    }

    // ── Run Transaction and Check Uniqueness ──────────────────────────────────
    let admissionNumber = "";
    let nextCounterValue = 0;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts++;

      // 1. Transaction to increment
      await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        const currentCount = counterDoc.exists ? (counterDoc.data().count ?? 0) : 0;
        const nextNumber = currentCount + 1;

        transaction.set(counterRef, { count: nextNumber }, { merge: true });

        const formatted = String(nextNumber).padStart(6, "0");
        admissionNumber = `${madarsaId}-${formatted}`;
        nextCounterValue = nextNumber;
      });

      // 2. Uniqueness double check
      const [dupInAdmissions, dupInStudents] = await Promise.all([
        db.collection("admissions").where("admissionNumber", "==", admissionNumber).limit(1).get(),
        db.collection("students").where("admissionNumber", "==", admissionNumber).limit(1).get(),
      ]);

      if (dupInAdmissions.empty && dupInStudents.empty) {
        // Safe to use!
        break;
      } else {
        console.warn(
          `⚠️ Collision detected on server for "${admissionNumber}". Re-running transaction.`
        );
      }
    }

    return NextResponse.json({
      admissionNumber,
      nextCounterValue,
    });
  } catch (error) {
    console.error("[generate-admission-number] error:", error);
    return NextResponse.json(
      { error: "Unable to generate admission number: " + error.message },
      { status: 500 }
    );
  }
}
