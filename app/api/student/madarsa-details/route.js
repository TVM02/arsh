export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

const getBearerToken = (request) =>
  (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

const cleanText = (value) => {
  const text = String(value ?? "").trim();
  if (!text || ["null", "undefined", "n/a", "na"].includes(text.toLowerCase())) {
    return "";
  }
  return text;
};

const pickPhone = (primary, fallback) => cleanText(primary) || cleanText(fallback);

const publicMadarsaDetails = (id, data) => ({
  id,
  madarsaId: data.madarsaId || id,
  name: cleanText(data.name) || cleanText(data.madarsaName),
  madarsaName: cleanText(data.madarsaName) || cleanText(data.name),
  district: cleanText(data.district),
  mekhala: cleanText(data.mekhala),
  address: cleanText(data.address),
  adminName: cleanText(data.adminName),
  sadarName: cleanText(data.adminName) || cleanText(data.sadarName),
  adminPhone: pickPhone(data.adminPhone, data.phone),
  sadarPhone: pickPhone(data.adminPhone, data.phone),
});

export async function GET(request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
    }

    await getAdminAuth().verifyIdToken(token, true);

    const { searchParams } = new URL(request.url);
    const madarsaId = searchParams.get("madarsaId");
    if (!madarsaId) {
      return NextResponse.json({ error: "madarsaId is required" }, { status: 400 });
    }

    const db = getAdminDb();
    const direct = await db.collection("madarsas").doc(String(madarsaId)).get();
    if (direct.exists) {
      return NextResponse.json(publicMadarsaDetails(direct.id, direct.data() || {}));
    }

    const snap = await db
      .collection("madarsas")
      .where("madarsaId", "==", String(madarsaId))
      .limit(1)
      .get();

    if (snap.empty) return NextResponse.json(null, { status: 404 });

    const doc = snap.docs[0];
    return NextResponse.json(publicMadarsaDetails(doc.id, doc.data() || {}));
  } catch (error) {
    console.error("[student/madarsa-details] error:", error);
    return NextResponse.json(
      { error: error.message || "Unable to load madrasa details" },
      { status: error.status || 500 },
    );
  }
}
