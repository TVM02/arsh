import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  canonicalDistrictName,
  canonicalMekhalaName,
  madrasaMatchesDistrict,
  madrasaMatchesMekhala,
} from "@/lib/madrasaHierarchy";
import { requireCentralAdmin } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await requireCentralAdmin(request);

    const db = getAdminDb();

    // Fetch all madarsas
    const snap = await db.collection("madarsas").get();
    const madarsas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const matchingDetails = madarsas.map(m => {
      const isPathanamthitta = madrasaMatchesDistrict(m, "Pathanamthitta");
      const isTrivandrum = madrasaMatchesDistrict(m, "Thiruvananthapuram");
      return {
        id: m.id,
        name: m.name,
        madarsaId: m.madarsaId,
        district: m.district || null,
        districtName: m.districtName || null,
        mekhala: m.mekhala || null,
        mekhalaName: m.mekhalaName || null,
        mehkala: m.mehkala || null,
        isPathanamthitta,
        isTrivandrum,
      };
    });

    const trivandrumMatches = matchingDetails.filter(d => d.isTrivandrum);
    const pathanamthittaMatches = matchingDetails.filter(d => d.isPathanamthitta);
    const nonMatches = matchingDetails.filter(d => !d.isTrivandrum && !d.isPathanamthitta);

    return NextResponse.json({
      totalMadarsas: madarsas.length,
      pathanamthittaMatchesCount: pathanamthittaMatches.length,
      trivandrumMatchesCount: trivandrumMatches.length,
      trivandrumMatches: trivandrumMatches.slice(0, 10),
      sampleNonMatches: nonMatches.slice(0, 10),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Forbidden" }, { status: error.status || 500 });
  }
}
