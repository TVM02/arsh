export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { requireCentralAdmin } from "@/lib/serverAuth";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);

    const q = query(
      collection(db, "news"),
      orderBy("createdAt", "desc"),
      limit(limitParam),
    );
    const snap = await getDocs(q);
    const news = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ news });
  } catch (err) {
    console.error("GET /api/news error:", err);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await requireCentralAdmin(req);
    const body = await req.json();
    const { image, date, title, description, category } = body;
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const docRef = await getAdminDb().collection("news").add({
      image: image || "",
      date: date || new Date().toISOString().split("T")[0],
      title,
      description: description || "",
      category: category || "General",
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ id: docRef.id, title });
  } catch (err) {
    console.error("POST /api/news error:", err);
    if (err.status) {
      return NextResponse.json({ error: "Not authorized" }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Failed to create news" },
      { status: 500 },
    );
  }
}
