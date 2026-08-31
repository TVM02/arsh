export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { requireCentralAdmin } from "@/lib/serverAuth";

export async function POST(req) {
  try {
    const { db } = await requireCentralAdmin(req);
    const body = await req.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required" },
        { status: 400 }
      );
    }

    // Convert dates to Firestore Timestamps
    const startTimestamp = Timestamp.fromDate(new Date(startDate));
    // Add one day to include the end date
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endTimestamp = Timestamp.fromDate(endDateObj);

    const querySnapshot = await db
      .collection("admissions")
      .where("createdAt", ">=", startTimestamp)
      .where("createdAt", "<=", endTimestamp)
      .get();

    const admissions = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.();
      const updatedAt = data.updatedAt?.toDate?.();
      return {
        id: doc.id,
        ...data,
        createdAt: createdAt?.toISOString?.() || data.createdAt,
        updatedAt: updatedAt?.toISOString?.() || data.updatedAt,
        approvedAt: data.approvedAt || null,
        submittedAt: data.submittedAt || null,
        paidAt: data.paidAt || null,
      };
    });

    // Sort by createdAt descending
    admissions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({ admissions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching admissions:", error);
    if (error.status) {
      return NextResponse.json({ error: "Not authorized" }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch admissions" },
      { status: 500 }
    );
  }
}
