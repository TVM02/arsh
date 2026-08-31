export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCentralAdmin } from "@/lib/serverAuth";

const MAX_LIMIT = 5000;

const serializeValue = (value) => {
  if (!value) return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, serializeValue(child)]),
    );
  }
  return value;
};

export async function GET(request) {
  try {
    const { db } = await requireCentralAdmin(request);
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") || 2000);
    const limit = Math.max(1, Math.min(MAX_LIMIT, requestedLimit));

    const snap = await db
      .collection("LoginLogs")
      .orderBy("loginTimestamp", "desc")
      .limit(limit)
      .get();

    return NextResponse.json({
      logs: snap.docs.map((doc) => ({
        id: doc.id,
        ...serializeValue(doc.data()),
      })),
      fetchedAt: new Date().toISOString(),
      limit,
    });
  } catch (error) {
    console.error("[admin/visitor-reports] error:", error);
    return NextResponse.json(
      { error: error.message || "Unable to load visitor reports" },
      { status: error.status || 500 },
    );
  }
}
