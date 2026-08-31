import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { unstable_cache } from "next/cache";

export const dynamic = 'force-dynamic';

// Mirrors the normalization used on the convener Madrasas page client-side
// (lib/madrasaHierarchy consumers) so cached counts line up with the ids
// looked up there — including the MID-/MLD- prefix some madarsa records use.
const normalizeMadarsaIdKey = (idStr) => {
  if (!idStr) return null;
  const s = String(idStr).trim().toLowerCase();
  return s.replace(/^(mid|mld)-/, "") || null;
};

// Per-madarsa student/teacher counts, computed from a single server-side
// scan of each collection and shared across every convener/admin session
// for 5 minutes. The convener Madrasas page previously recomputed this by
// issuing dozens of chunked `where(madarsaId in [...])` reads directly from
// the browser on every page load, which — multiplied across users — was
// exhausting the Firestore read quota. This route makes that scan happen at
// most once per cache window instead of once per page view.
const getCachedCounts = unstable_cache(
  async () => {
    const adminDb = getAdminDb();
    const [studentsSnap, teachersSnap] = await Promise.all([
      adminDb.collection("students").select("madarsaId").get(),
      adminDb.collection("teachers").select("madarsaId").get(),
    ]);

    const studentCounts = {};
    studentsSnap.forEach((doc) => {
      const key = normalizeMadarsaIdKey(doc.data().madarsaId);
      if (key) studentCounts[key] = (studentCounts[key] || 0) + 1;
    });

    const teacherCounts = {};
    teachersSnap.forEach((doc) => {
      const key = normalizeMadarsaIdKey(doc.data().madarsaId);
      if (key) teacherCounts[key] = (teacherCounts[key] || 0) + 1;
    });

    return { studentCounts, teacherCounts };
  },
  ['convener-madarsa-counts-cache-v1'],
  { revalidate: 300 } // 5 minutes cache
);

export async function GET() {
  try {
    const counts = await getCachedCounts();
    return NextResponse.json(counts);
  } catch (error) {
    console.error("Error fetching madarsa counts in API:", error);
    return NextResponse.json({ error: "Failed to fetch madarsa counts" }, { status: 500 });
  }
}
