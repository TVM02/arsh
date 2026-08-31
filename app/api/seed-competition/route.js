import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireCentralAdmin } from "@/lib/serverAuth";

// Events will be fetched dynamically from Firestore

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

    // Clean up ALL records previously inserted (including Unknown Students and previously seeded students)
    const collectionsToClean = [
      "competition_mekhala_marks",
      "competition_district_marks",
      "competition_state_marks",
      "competition_results"
    ];

    for (const col of collectionsToClean) {
      const snap = await adminDb.collection(col).get();
      const deleteBatch = adminDb.batch();
      snap.forEach(doc => { deleteBatch.delete(doc.ref); });
      await deleteBatch.commit();
      console.log(`Cleaned up all records from ${col}`);
    }

    // Now, fetch 100 actual students from the database who have a fullName
    const studentsSnap = await adminDb.collection("students")
      .where("fullName", "!=", "")
      .limit(100)
      .get();

    let actualStudents = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Just to be absolutely safe, filter locally as well
    actualStudents = actualStudents.filter(s => s.fullName && s.fullName !== "Unknown Student");

    if (actualStudents.length === 0) {
      return NextResponse.json({ success: false, error: "No valid students found in the database!" }, { status: 400 });
    }

    // Fetch REAL events
    const eventsSnap = await adminDb.collection("competition_events").get();
    const REAL_EVENTS = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (REAL_EVENTS.length === 0) {
      return NextResponse.json({ success: false, error: "No real competition events found in DB! Please create events in the admin portal first." }, { status: 400 });
    }

    const madarsasSnap = await adminDb.collection("madarsas").get();
    const instMap = {};
    madarsasSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.madarsaId) {
        instMap[data.madarsaId] = data;
      }
    });

    const batch = adminDb.batch();
    let seededCount = 0;

    for (let i = 0; i < actualStudents.length; i++) {
      const student = actualStudents[i];
      const eventIndex = i % REAL_EVENTS.length;
      const event = REAL_EVENTS[eventIndex];

      const madarsaId = student.madarsaId || student.mid;
      const inst = instMap[madarsaId] || {};

      // Use REAL location data from the Madarsa
      const rawDistrict = inst.district || inst.districtName || "";
      const districtName = getTrueDistrict(rawDistrict);
      const mekhalaName = inst.mekhala || inst.mekhalaName || rawDistrict || "Unknown Mekhala";
      const madarsaName = inst.name || inst.madarsaName || "Unknown Madarsa";

      const studentId = student.id;
      const studentName = student.fullName;
      const studentPhoto = student.profilePictureUrl || student.profilePicture || "";

      const m1 = Math.floor(Math.random() * 20) + 30; // 30-49
      const m2 = Math.floor(Math.random() * 20) + 30;
      const m3 = Math.floor(Math.random() * 20) + 30;
      const total = calcTotal(m1, m2, m3);
      const grade = calcGrade(total);

      const d1 = Math.floor(Math.random() * 20) + 25;
      const d2 = Math.floor(Math.random() * 20) + 25;
      const d3 = Math.floor(Math.random() * 20) + 25;
      const dTotal = calcTotal(d1, d2, d3);
      const dGrade = calcGrade(dTotal);

      const s1 = Math.floor(Math.random() * 20) + 30;
      const s2 = Math.floor(Math.random() * 20) + 30;
      const s3 = Math.floor(Math.random() * 20) + 30;
      const sTotal = calcTotal(s1, s2, s3);
      const sGrade = calcGrade(sTotal);

      const payload = {
        studentId,
        studentName,
        studentPhoto,
        eventId: event.id,
        eventName: event.name,
        category: event.category,
        type: event.type,
        madarsaId,
        madarsaName,
        mekhalaId: "mek-" + madarsaId,
        mekhalaName,
        districtName,
        students: [{ id: studentId, name: studentName, profilePictureUrl: studentPhoto }]
      };

      // 1. Mekhala Marks
      const mekRef = adminDb.collection("competition_mekhala_marks").doc();
      batch.set(mekRef, {
        ...payload,
        mark1: m1, mark2: m2, mark3: m3, total, grade
      });

      // 2. District Marks
      const distRef = adminDb.collection("competition_district_marks").doc();
      batch.set(distRef, {
        ...payload,
        mark1: d1, mark2: d2, mark3: d3, total: dTotal, grade: dGrade
      });

      // 3. State Marks
      const stateRef = adminDb.collection("competition_state_marks").doc();
      batch.set(stateRef, {
        ...payload,
        districtTotal: dTotal, districtGrade: dGrade,
        mark1: s1, mark2: s2, mark3: s3, total: sTotal, grade: sGrade,
        verificationStatus: "published",
        verifiedAt: FieldValue.serverTimestamp(),
        publishedAt: FieldValue.serverTimestamp()
      });

      // 4. Live Results
      const resRef = adminDb.collection("competition_results").doc();
      batch.set(resRef, {
        ...payload,
        stateMarkId: stateRef.id,
        finalScore: sTotal,
        finalGrade: sGrade,
        mark1: s1, mark2: s2, mark3: s3,
        position: Math.floor(Math.random() * 5) + 1,
        publishedAt: FieldValue.serverTimestamp()
      });

      seededCount++;
    }

    await batch.commit();

    return NextResponse.json({ success: true, message: `Successfully seeded records for ${seededCount} valid actual students with names and real institutions!` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message || "Forbidden" }, { status: error.status || 500 });
  }
}
