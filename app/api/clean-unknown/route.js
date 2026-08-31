import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireCentralAdmin } from "@/lib/serverAuth";

export async function GET(request) {
  try {
    await requireCentralAdmin(request);

    const adminDb = getAdminDb();

    const collectionsToClean = [
      "competition_mekhala_marks",
      "competition_district_marks",
      "competition_state_marks",
      "competition_results"
    ];

    let totalDeleted = 0;

    for (const col of collectionsToClean) {
      const snap = await adminDb.collection(col).get();
      const deleteBatch = adminDb.batch();
      let deleteCount = 0;

      snap.forEach(doc => {
        const data = doc.data();
        if (data.studentName === "Unknown Student") {
          deleteBatch.delete(doc.ref);
          deleteCount++;
        }
      });

      if (deleteCount > 0) {
        await deleteBatch.commit();
        console.log(`Deleted ${deleteCount} Unknown Student records from ${col}`);
        totalDeleted += deleteCount;
      }
    }

    return NextResponse.json({ success: true, message: `Successfully deleted ${totalDeleted} Unknown Student records!` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message || "Forbidden" }, { status: error.status || 500 });
  }
}
