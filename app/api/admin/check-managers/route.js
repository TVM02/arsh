import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const db = await getAdminDb();
    const snap = await db.collection("managers").get();
    const data = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    });
    return NextResponse.json({ managers: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
