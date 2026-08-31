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
    await getAdminDb().collection("heroSliderImages").doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/hero-images/[id] error:", err);
    if (err.status) {
      return NextResponse.json({ error: "Not authorized" }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 },
    );
  }
}
