import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { unstable_cache } from "next/cache";

export const dynamic = 'force-dynamic';

const getCachedMadarsas = unstable_cache(
  async () => {
    const adminDb = getAdminDb();
    const snapshot = await adminDb.collection("madarsas").get();
    const madarsas = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      madarsas.push({
        id: doc.id,
        madarsaId: data.madarsaId || data.madrasaId || data.midNumber || null,
        name: data.name || null,
        address: data.address || null,
        district: data.district || null,
        districtName: data.districtName || null,
        districtId: data.districtId || data.district_id || null,
        mekhala: data.mekhala || null,
        mekhalaName: data.mekhalaName || null,
        mekhalaId: data.mekhalaId || data.mekhala_id || null,
        mehkala: data.mehkala || null,
        mehkalaName: data.mehkalaName || null,
        mehkalaId: data.mehkalaId || null,
        status: data.status || null,
      });
    });
    return madarsas;
  },
  ['inspector-madarsas-cache-v1'],
  { revalidate: 300 } // 5 minutes cache
);

export async function GET() {
  try {
    const madarsas = await getCachedMadarsas();
    return NextResponse.json({ madarsas });
  } catch (error) {
    console.error("Error fetching madarsas in API:", error);
    return NextResponse.json({ error: "Failed to fetch madarsas" }, { status: 500 });
  }
}
