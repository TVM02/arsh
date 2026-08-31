import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireCentralAdmin } from "@/lib/serverAuth";

export async function GET(request) {
  try {
    await requireCentralAdmin(request);

    const adminDb = getAdminDb();

    const snap = await adminDb.collection("students").limit(3).get();
    const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ success: true, students });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message || "Forbidden" }, { status: error.status || 500 });
  }
}
