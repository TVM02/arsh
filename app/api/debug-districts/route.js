import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireCentralAdmin } from "@/lib/serverAuth";

export async function GET(request) {
  try {
    await requireCentralAdmin(request);

    const adminDb = getAdminDb();
    const dSnap = await adminDb.collection("districts").get();
    const dData = dSnap.docs.map(d => ({ id: d.id, name: d.data().name }));

    const mSnap = await adminDb.collection("mekhala").get();
    const mData = mSnap.docs.map(d => ({ id: d.id, name: d.data().name, districtId: d.data().districtId }));

    return NextResponse.json({ districts: dData, mekhalas: mData });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Forbidden" }, { status: error.status || 500 });
  }
}


