export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { formatDate } from "@/lib/dateUtils";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    // Normalize query (handle mid-2753, m|id-2753, etc.)
    const cleanStr = query.toUpperCase().replace(/[^A-Z0-9]/g, "");
    let normalizedQuery = query.toUpperCase();
    if (cleanStr.startsWith("MID") && /\d+/.test(cleanStr)) {
      normalizedQuery = `MID-${cleanStr.replace("MID", "")}`;
    } else if (cleanStr.startsWith("MSR") && /\d+/.test(cleanStr)) {
      normalizedQuery = `MSR-${cleanStr.replace("MSR", "")}`;
    } else if (cleanStr.startsWith("MHR") && /\d+/.test(cleanStr)) {
      normalizedQuery = `MHR-${cleanStr.replace("MHR", "")}`;
    }

    const searchValues = [...new Set([normalizedQuery, query, query.toUpperCase()])];

    const db = getAdminDb();
    
    const getMadarsaData = async (madarsaId) => {
      if (!madarsaId) return null;
      const searchIds = [...new Set([madarsaId, madarsaId.toUpperCase(), madarsaId.toLowerCase()])];
      const mSnap = await db.collection("madarsas").where("madarsaId", "in", searchIds).limit(1).get();
      if (!mSnap.empty) return mSnap.docs[0].data();
      
      for (const id of searchIds) {
        const mDoc = await db.collection("madarsas").doc(id).get();
        if (mDoc.exists) return mDoc.data();
      }
      return null;
    };

    const getManagerData = async (madarsaId) => {
      if (!madarsaId) return null;
      const searchIds = [...new Set([madarsaId, madarsaId.toUpperCase(), madarsaId.toLowerCase()])];
      const snap = await db.collection("managers").where("madarsaId", "in", searchIds).limit(1).get();
      if (!snap.empty) return snap.docs[0].data();
      return null;
    };

    // Check madrasas first
    const madarsaSnap = await db.collection("madarsas").where("madarsaId", "in", searchValues).limit(1).get();
    if (!madarsaSnap.empty) {
      const data = madarsaSnap.docs[0].data();
      const manager = await getManagerData(data.madarsaId);
      return NextResponse.json({
        type: "madrasa",
        name: data.name || "N/A",
        id: data.madarsaId || "N/A",
        address: data.address || data.location || "N/A",
        district: data.mekhala || data.mekhalaName || "N/A",
        mekhala: data.district || "N/A",
        sadarPhone: data.adminPhone || data.phone || "N/A",
        managerPhone: manager?.phone || data.managerPhone || "N/A",
      });
    }

    // Check students
    const studentSnap = await db.collection("students").where("admissionNumber", "in", searchValues).limit(1).get();
    if (!studentSnap.empty) {
      const data = studentSnap.docs[0].data();
      const madarsa = await getMadarsaData(data.madarsaId);
      const manager = await getManagerData(data.madarsaId);
      return NextResponse.json({
        type: "student",
        name: data.fullName || data.name || "N/A",
        guardianName: data.guardianName || "N/A",
        id: data.admissionNumber,
        address: data.address || "N/A",
        phoneLast3: data.phone ? data.phone.slice(-3) : "N/A",
        madarsaName: madarsa?.name || "N/A",
        madarsaId: data.madarsaId || "N/A",
        district: madarsa?.mekhala || madarsa?.mekhalaName || "N/A",
        mekhala: madarsa?.district || "N/A",
        dob: formatDate(data.dob || data.dateOfBirth, "N/A"),
        sadarPhone: madarsa?.adminPhone || madarsa?.phone || "N/A",
        managerPhone: manager?.phone || madarsa?.managerPhone || "N/A",
      });
    }

    // Check teachers
    const teacherSnap = await db.collection("teachers").where("mhrId", "in", searchValues).limit(1).get();
    if (!teacherSnap.empty) {
      const data = teacherSnap.docs[0].data();
      const madarsa = await getMadarsaData(data.madarsaId || data.madrasaId);
      return NextResponse.json({
        type: "teacher",
        name: data.fullName || data.name || "N/A",
        id: `MSR ${data.mhrId || data.msrId || "N/A"}`,
        address: data.address || "N/A",
        madarsaName: madarsa?.name || "N/A",
        madarsaId: data.madarsaId || data.madrasaId || "N/A",
        district: madarsa?.mekhala || madarsa?.mekhalaName || "N/A",
        mekhala: madarsa?.district || "N/A",
        phoneLast3: data.phone ? data.phone.slice(-3) : "N/A",
        qualification: data.qualification || data.highestQualification || "N/A",
      });
    }

    // Also check teacher with msrId if different
    const teacherMsrSnap = await db.collection("teachers").where("msrId", "in", searchValues).limit(1).get();
    if (!teacherMsrSnap.empty) {
      const data = teacherMsrSnap.docs[0].data();
      const madarsa = await getMadarsaData(data.madarsaId || data.madrasaId);
      return NextResponse.json({
        type: "teacher",
        name: data.fullName || data.name || "N/A",
        id: `MSR ${data.msrId || data.mhrId || "N/A"}`,
        address: data.address || "N/A",
        madarsaName: madarsa?.name || "N/A",
        madarsaId: data.madarsaId || data.madrasaId || "N/A",
        district: madarsa?.mekhala || madarsa?.mekhalaName || "N/A",
        mekhala: madarsa?.district || "N/A",
        phoneLast3: data.phone ? data.phone.slice(-3) : "N/A",
        qualification: data.qualification || data.highestQualification || "N/A",
      });
    }

    return NextResponse.json({ error: "No matching record found" }, { status: 404 });
  } catch (error) {
    console.error("Error searching:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
