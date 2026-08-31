export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const admissionNumber = searchParams.get("admissionNumber");

    if (!admissionNumber) {
      return NextResponse.json(
        { error: "admissionNumber is required" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const admissionsSnap = await db
      .collection("admissions")
      .where("admissionNumber", "==", admissionNumber)
      .limit(1)
      .get();

    if (admissionsSnap.empty) {
      return NextResponse.json(
        { error: "Admission record not found" },
        { status: 404 }
      );
    }

    const doc = admissionsSnap.docs[0];
    const data = doc.data();

    return NextResponse.json({
      id: doc.id,
      ...data,
    });
  } catch (error) {
    console.error("[public-admission-get] error:", error);
    return NextResponse.json(
      { error: "Unable to retrieve admission record: " + error.message },
      { status: 500 }
    );
  }
}
