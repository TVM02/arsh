import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { unstable_cache } from "next/cache";

export const dynamic = 'force-dynamic';

// Distinct active-student class levels, used to populate filter dropdowns.
// Several pages previously computed this client-side with an unbounded
// `getDocs` scan of the entire (54k+ document) students collection, which
// under real load either took a very long time or ran into the Firestore
// read-quota backoff — from the UI it just looked like the page was stuck on
// "Loading..." forever with no error. Class levels change essentially never,
// so this is computed server-side (with a field-projected scan) and cached.
const getCachedClassLevels = unstable_cache(
  async () => {
    const adminDb = getAdminDb();
    const snapshot = await adminDb
      .collection("students")
      .where("status", "==", "active")
      .select("classLevel")
      .get();

    const classSet = new Set();
    snapshot.forEach((doc) => {
      const classLevel = doc.data().classLevel;
      if (classLevel) classSet.add(classLevel);
    });

    return Array.from(classSet).sort();
  },
  ['students-class-levels-cache-v1'],
  { revalidate: 1800 } // 30 minutes cache
);

export async function GET() {
  try {
    const classes = await getCachedClassLevels();
    return NextResponse.json({ classes });
  } catch (error) {
    console.error("Error fetching class levels in API:", error);
    return NextResponse.json({ error: "Failed to fetch class levels" }, { status: 500 });
  }
}
