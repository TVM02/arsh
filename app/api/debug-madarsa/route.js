import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireCentralAdmin } from "@/lib/serverAuth";

export async function GET(request) {
  try {
    await requireCentralAdmin(request);

    const adminDb = getAdminDb();
    const mSnap = await adminDb.collection("madarsas").limit(5).get();
    const data = mSnap.docs.map(d => ({ docId: d.id, madarsaIdField: d.data().madarsaId, name: d.data().name, district: d.data().district }));

    const sSnap = await adminDb.collection("students").limit(5).get();
    const sData = sSnap.docs.map(d => ({ docId: d.id, studentMadarsaId: d.data().madarsaId, mid: d.data().mid }));

    return NextResponse.json({ madarsas: data, students: sData });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Forbidden" }, { status: error.status || 500 });
  }
}
