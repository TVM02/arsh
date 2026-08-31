export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireCentralAdmin } from "@/lib/serverAuth";

export async function DELETE(req, { params }) {
  try {
    await requireCentralAdmin(req);
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }
    await getAdminDb().collection("news").doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/news/[id] error:", err);
    if (err.status) {
      return NextResponse.json({ error: "Not authorized" }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Failed to delete news" },
      { status: 500 },
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    await requireCentralAdmin(req);
    const { id } = params;
    const body = await req.json();
    await getAdminDb().collection("news").doc(id).update({
      ...body,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/news/[id] error:", err);
    if (err.status) {
      return NextResponse.json({ error: "Not authorized" }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Failed to update news" },
      { status: 500 },
    );
  }
}
