export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireCentralAdmin } from "@/lib/serverAuth";

export async function GET() {
  try {
    const q = query(
      collection(db, "heroSliderImages"),
      orderBy("order", "asc"),
    );
    const snap = await getDocs(q);
    const images = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ images });
  } catch (err) {
    console.error("GET /api/hero-images error:", err);
    return NextResponse.json(
      { error: "Failed to fetch images" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await requireCentralAdmin(req);
    const body = await req.json();
    const { imageUrl, order } = body;
    if (!imageUrl) {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 },
      );
    }
    const docRef = await getAdminDb().collection("heroSliderImages").add({
      imageUrl,
      order: typeof order === "number" ? order : 0,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ id: docRef.id, imageUrl, order });
  } catch (err) {
    console.error("POST /api/hero-images error:", err);
    if (err.status) {
      return NextResponse.json({ error: "Not authorized" }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to add image" }, { status: 500 });
  }
}
