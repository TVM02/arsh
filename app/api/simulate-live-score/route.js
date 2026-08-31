import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireCentralAdmin } from "@/lib/serverAuth";

const KNOWN_MAPPING = {
  "kaniyapuram": "Thiruvananthapuram", "kannanalloor": "Kollam", "kadakkal": "Kollam",
  "kanjirappally": "Kottayam", "navayikkulam": "Thiruvananthapuram", "pothencode": "Thiruvananthapuram",
  "muvattupuzha": "Ernakulam", "kallara": "Thiruvananthapuram", "kollam": "Kollam",
  "punalur": "Kollam", "kochi": "Ernakulam", "changanassery": "Kottayam",
  "mundakkayam": "Kottayam", "alappuzha": "Alappuzha", "vaypoor": "Pathanamthitta",
  "adimali": "Idukki", "peringammala": "Thiruvananthapuram", "poovachal": "Thiruvananthapuram",
  "varkala": "Thiruvananthapuram", "kothamangalam": "Ernakulam", "thiruvananthapuram": "Thiruvananthapuram",
  "palakkad": "Palakkad", "malappuram": "Malappuram", "kozhikode": "Kozhikode",
  "wayanad": "Wayanad", "kannur": "Kannur", "kasaragod": "Kasaragod", "thrissur": "Thrissur"
};

function getTrueDistrict(raw) {
  if (!raw) return "Thiruvananthapuram";
  const norm = raw.trim().toLowerCase();
  for (const [key, trueDist] of Object.entries(KNOWN_MAPPING)) {
    if (norm.includes(key)) return trueDist;
  }
  const KERALA_DISTRICTS = ["Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha", "Kottayam", "Idukki", "Ernakulam", "Thrissur", "Palakkad", "Malappuram", "Kozhikode", "Wayanad", "Kannur", "Kasaragod"];
  let hash = 0;
  for (let i = 0; i < norm.length; i++) hash = (hash << 5) - hash + norm.charCodeAt(i);
  return KERALA_DISTRICTS[Math.abs(hash) % KERALA_DISTRICTS.length];
}

// Events and Institutions will be fetched dynamically from Firestore

function calcTotal(m1, m2, m3) { return (m1 || 0) + (m2 || 0) + (m3 || 0); }
function calcGrade(total) {
  if (total >= 135) return "A+";
  if (total >= 120) return "A";
  if (total >= 105) return "B+";
  if (total >= 90) return "B";
  if (total >= 75) return "C";
  return "D";
}

export async function GET(request) {
  try {
    await requireCentralAdmin(request);

    const adminDb = getAdminDb();

    // Fetch a random student
    const studentsSnap = await adminDb.collection("students")
      .where("fullName", "!=", "")
      .limit(50)
      .get();

    let actualStudents = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    actualStudents = actualStudents.filter(s => s.fullName && s.fullName !== "Unknown Student");

    if (actualStudents.length === 0) {
      return NextResponse.json({ success: false, error: "No valid students found" }, { status: 400 });
    }

    const eventsSnap = await adminDb.collection("competition_events").get();
    const REAL_EVENTS = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (REAL_EVENTS.length === 0) {
      return NextResponse.json({ success: false, error: "No real competition events found in DB!" }, { status: 400 });
    }

    const madarsasSnap = await adminDb.collection("madarsas").get();
    const instMap = {};
    madarsasSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.madarsaId) instMap[data.madarsaId] = data;
    });

    const student = actualStudents[Math.floor(Math.random() * actualStudents.length)];
    const event = REAL_EVENTS[Math.floor(Math.random() * REAL_EVENTS.length)];

    const madarsaId = student.madarsaId || student.mid;
    const inst = instMap[madarsaId] || {};

    const rawDistrict = inst.district || inst.districtName || "";
    const districtName = getTrueDistrict(rawDistrict);
    const mekhalaName = inst.mekhala || inst.mekhalaName || rawDistrict || "Unknown Mekhala";
    const madarsaName = inst.name || inst.madarsaName || "Unknown Madarsa";

    // Give them a very high score so it's noticeable and shifts ranks!
    const s1 = Math.floor(Math.random() * 5) + 45; // 45-49
    const s2 = Math.floor(Math.random() * 5) + 45; // 45-49
    const s3 = Math.floor(Math.random() * 5) + 45; // 45-49
    const sTotal = calcTotal(s1, s2, s3);
    const sGrade = calcGrade(sTotal);

    const payload = {
      studentId: student.id,
      studentName: student.fullName,
      studentPhoto: student.profilePictureUrl || student.profilePicture || "",
      eventId: event.id,
      eventName: event.name,
      category: event.category,
      type: event.type,
      madarsaId: madarsaId || "mid-unknown",
      madarsaName,
      mekhalaId: "mek-" + madarsaId,
      mekhalaName,
      districtName,
      students: [{ id: student.id, name: student.fullName, profilePictureUrl: student.profilePictureUrl || "" }],
      finalScore: sTotal,
      finalGrade: sGrade,
      mark1: s1, mark2: s2, mark3: s3,
      position: 1, // Let's pretend they got 1st rank
      publishedAt: FieldValue.serverTimestamp()
    };

    await adminDb.collection("competition_results").add(payload);

    return NextResponse.json({ success: true, message: `Added live result for ${student.fullName} in ${districtName} with score ${sTotal}!` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message || "Forbidden" }, { status: error.status || 500 });
  }
}
