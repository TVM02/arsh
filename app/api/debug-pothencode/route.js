import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireCentralAdmin } from "@/lib/serverAuth";

export async function GET(request) {
  try {
    await requireCentralAdmin(request);

    const db = getAdminDb();
    const managersSnap = await db.collection("managers").get();
    const madrasasSnap = await db.collection("madarsas").get();

    const madrasas = madrasasSnap.docs.map(d => ({id: d.id, ...d.data()}));
    const managers = managersSnap.docs.map(d => ({id: d.id, ...d.data()}));

    // Find all madrasas in Pothencode
    const pothencodeMadrasas = madrasas.filter(m =>
      (m.district || "").toUpperCase() === "POTHENCODE" ||
      (m.mekhala || "").toUpperCase() === "POTHENCODE"
    );

    const pothencodeMadrasaIds = pothencodeMadrasas.map(m => m.madarsaId);
    const pothencodeMadrasaDocIds = pothencodeMadrasas.map(m => m.id);
    const pothencodeMadrasaNames = pothencodeMadrasas.map(m => (m.name || "").trim().toLowerCase());

    // Find all managers belonging to these madrasas
    const pothencodeManagers = managers.filter(m => {
      const mId = m.madarsaId;
      const mName = (m.madarsaName || "").trim().toLowerCase();

      return pothencodeMadrasaIds.includes(mId) ||
             pothencodeMadrasaDocIds.includes(mId) ||
             pothencodeMadrasaNames.includes(mName);
    });

    return NextResponse.json({
      madrasasCount: pothencodeMadrasas.length,
      managersCount: pothencodeManagers.length,
      pothencodeMadrasas: pothencodeMadrasas.map(m => ({
          name: m.name, madarsaId: m.madarsaId, district: m.district, mekhala: m.mekhala
      })),
      missingMadrasas: pothencodeMadrasas.filter(m => {
          const mId = m.madarsaId;
          const mName = (m.name || "").trim().toLowerCase();
          return !managers.some(mgr =>
              mgr.madarsaId === mId ||
              mgr.madarsaId === m.id ||
              (mgr.madarsaName || "").trim().toLowerCase() === mName
          );
      }).map(m => ({name: m.name, madarsaId: m.madarsaId}))
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Forbidden" }, { status: error.status || 500 });
  }
}
