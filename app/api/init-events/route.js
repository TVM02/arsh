import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireCentralAdmin } from "@/lib/serverAuth";

const EVENTS_TO_SEED = [
  { name: "Qira'at", category: "junior", type: "individual" },
  { name: "Elocution English", category: "senior", type: "individual" },
  { name: "Elocution Malayalam", category: "junior", type: "individual" },
  { name: "Group Song", category: "higher", type: "group", participantsRequired: 5 },
  { name: "Essay Writing", category: "senior", type: "individual" },
  { name: "Daffmuttu", category: "higher", type: "group", participantsRequired: 10 },
  { name: "Quiz", category: "junior", type: "individual" },
  { name: "Calligraphy", category: "subJunior", type: "individual" },
  { name: "Story Telling", category: "subJunior", type: "individual" },
  { name: "Debate", category: "senior", type: "group", participantsRequired: 3 }
];

export async function GET(request) {
  try {
    await requireCentralAdmin(request);

    const adminDb = getAdminDb();

    // Check if these already exist to avoid duplicating
    const existingSnap = await adminDb.collection("competition_events").get();
    const existingNames = new Set(existingSnap.docs.map(d => d.data().name));

    const batch = adminDb.batch();
    let addedCount = 0;

    for (const ev of EVENTS_TO_SEED) {
      if (!existingNames.has(ev.name)) {
        const ref = adminDb.collection("competition_events").doc();
        batch.set(ref, {
          ...ev,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: "system_init"
        });
        addedCount++;
      }
    }

    if (addedCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ success: true, message: `Added ${addedCount} new standard events to the system.` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message || "Forbidden" }, { status: error.status || 500 });
  }
}
