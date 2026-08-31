export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

const cleanText = (value) => {
  const text = String(value ?? "").trim();
  if (!text || ["null", "undefined", "n/a", "na"].includes(text.toLowerCase())) {
    return "";
  }
  return text;
};

const publicMadarsa = (id, data) => ({
  id,
  value: cleanText(data.madarsaId) || id,
  label: cleanText(data.name) || cleanText(data.madarsaName) || "Unknown madrasa",
  madarsaId: cleanText(data.madarsaId) || id,
  name: cleanText(data.name) || cleanText(data.madarsaName),
  madarsaName: cleanText(data.madarsaName) || cleanText(data.name),
  district: cleanText(data.district),
  mekhala: cleanText(data.mekhala),
  address: cleanText(data.address),
  status: cleanText(data.status) || "active",
});

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const madarsaId = searchParams.get("madarsaId");
    const db = getAdminDb();

    if (madarsaId) {
      const direct = await db.collection("madarsas").doc(String(madarsaId)).get();
      if (direct.exists) {
        return NextResponse.json(publicMadarsa(direct.id, direct.data() || {}));
      }

      const snap = await db
        .collection("madarsas")
        .where("madarsaId", "==", String(madarsaId))
        .limit(1)
        .get();

      if (snap.empty) return NextResponse.json(null, { status: 404 });
      const doc = snap.docs[0];
      return NextResponse.json(publicMadarsa(doc.id, doc.data() || {}));
    }

    const snap = await db
      .collection("madarsas")
      .where("status", "==", "active")
      .orderBy("name", "asc")
      .get();

    return NextResponse.json(
      snap.docs.map((doc) => publicMadarsa(doc.id, doc.data() || {})),
    );
  } catch (error) {
    console.error("[public/madarsas] error:", error);
    return NextResponse.json(
      { error: "Unable to load public madrasa list" },
      { status: 500 },
    );
  }
}
