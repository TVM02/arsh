export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCentralAdmin } from "@/lib/serverAuth";

const ALL = "all";
const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 500;
const IN_QUERY_LIMIT = 30;

const serializeValue = (value) => {
  if (!value) return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, serializeValue(child)]),
    );
  }
  return value;
};

const cleanText = (value) => {
  const text = String(value ?? "").trim();
  if (!text || ["null", "undefined", "n/a", "na"].includes(text.toLowerCase())) {
    return "";
  }
  return text;
};

const isActiveFilter = (value) => {
  const text = cleanText(value);
  return text && text.toLowerCase() !== ALL;
};

const normalize = (value) => cleanText(value).toLowerCase();

const normalizeClass = (value) =>
  normalize(value)
    .replace(/^class\s+/i, "")
    .replace(/standard|std\.?/gi, "")
    .trim();

const getValue = (item, keys) => {
  for (const key of keys) {
    const value = cleanText(item?.[key]);
    if (value) return value;
  }
  return "";
};

const uniqueSorted = (items) =>
  Array.from(new Set(items.map(cleanText).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );

const chunk = (items, size = IN_QUERY_LIMIT) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const madarsaKeys = (madarsa) =>
  uniqueSorted([
    madarsa.id,
    madarsa.madarsaId,
    madarsa.madrasaId,
    madarsa.code,
    madarsa.mid,
    madarsa.loginId,
    madarsa.name,
    madarsa.madarsaName,
    madarsa.madrasaName,
  ]);

const buildMadarsaIndex = (madarsas) => {
  const index = new Map();
  madarsas.forEach((madarsa) => {
    madarsaKeys(madarsa).forEach((key) => index.set(String(key), madarsa));
  });
  return index;
};

const resolveStudentMadarsa = (student, madarsaIndex) => {
  const key = getValue(student, ["madarsaId", "madarsa", "madrasaId", "madrasa"]);
  return madarsaIndex.get(String(key)) || null;
};

const matchText = (actual, expected) =>
  !isActiveFilter(expected) || normalize(actual) === normalize(expected);

const matchClass = (actual, expected) =>
  !isActiveFilter(expected) || normalizeClass(actual) === normalizeClass(expected);

const studentMatches = (student, madarsa, filters) => {
  if (student.deleted === true) return false;

  const district =
    getValue(student, ["district", "districtName"]) ||
    getValue(madarsa, ["district", "districtName"]);
  const mekhala =
    getValue(student, ["mekhala", "mekhalaName"]) ||
    getValue(madarsa, ["mekhala", "mekhalaName"]);
  const studentMadarsa =
    getValue(student, ["madarsaName", "madarsa", "madrasa"]) ||
    getValue(madarsa, ["name", "madarsaName", "madrasaName", "madarsaId", "id"]);
  const classLevel = getValue(student, ["classLevel", "class", "std"]);

  return (
    matchText(district, filters.district) &&
    matchText(mekhala, filters.mekhala) &&
    (!isActiveFilter(filters.madrasa) ||
      madarsaKeys(madarsa || {}).some((key) => normalize(key) === normalize(filters.madrasa)) ||
      normalize(studentMadarsa) === normalize(filters.madrasa)) &&
    matchClass(classLevel, filters.classLevel)
  );
};

const enrichStudent = (student, madarsaIndex) => {
  const madarsa = resolveStudentMadarsa(student, madarsaIndex);
  return {
    ...student,
    district:
      getValue(student, ["district", "districtName"]) ||
      getValue(madarsa, ["district", "districtName"]),
    mekhala:
      getValue(student, ["mekhala", "mekhalaName"]) ||
      getValue(madarsa, ["mekhala", "mekhalaName"]),
    madarsaName:
      getValue(student, ["madarsaName", "madarsa", "madrasa"]) ||
      getValue(madarsa, ["name", "madarsaName", "madrasaName"]),
    mid:
      getValue(student, ["mid", "madarsaId", "madrasaId"]) ||
      getValue(madarsa, ["mid", "madarsaId", "madrasaId"]),
    classLevel: getValue(student, ["classLevel", "class", "std"]),
  };
};

const getFilteredMadarsas = (madarsas, filters) =>
  madarsas.filter((madarsa) => {
    if (!matchText(getValue(madarsa, ["district", "districtName"]), filters.district)) {
      return false;
    }
    if (!matchText(getValue(madarsa, ["mekhala", "mekhalaName"]), filters.mekhala)) {
      return false;
    }
    if (isActiveFilter(filters.madrasa)) {
      return madarsaKeys(madarsa).some((key) => normalize(key) === normalize(filters.madrasa));
    }
    return true;
  });

const addDocs = (map, docs) => {
  docs.forEach((doc) => {
    if (!map.has(doc.id)) {
      map.set(doc.id, { id: doc.id, ...serializeValue(doc.data()) });
    }
  });
};

const fetchCandidateStudents = async (
  db,
  filters,
  candidateMadarsas,
  limitCount,
) => {
  const selectFields = [
    "fullName", "name", "class", "classLevel", "std", 
    "madarsaName", "madarsa", "madrasa", "certificateNumber", 
    "regNo", "district", "districtName", "mekhala", "mekhalaName", 
    "madarsaId", "madrasaId", "deleted"
  ];
  const studentsRef = db.collection("students").select(...selectFields);
  const candidates = new Map();
  const hasHierarchyFilter =
    isActiveFilter(filters.district) ||
    isActiveFilter(filters.mekhala) ||
    isActiveFilter(filters.madrasa);
  const hasClassFilter = isActiveFilter(filters.classLevel);

  if (hasHierarchyFilter && candidateMadarsas.length > 0) {
    const keys = uniqueSorted(candidateMadarsas.flatMap(madarsaKeys));
    const chunks = chunk(keys, IN_QUERY_LIMIT);
    
    for (const field of ["madarsaId", "madarsa", "madrasaId", "madrasa"]) {
      for (const keyChunk of chunks) {
        if (candidates.size >= limitCount) break;
        const snap = await studentsRef
          .where(field, "in", keyChunk)
          .limit(limitCount)
          .get();
        addDocs(candidates, snap.docs);
      }
      if (candidates.size >= limitCount) break;
    }
  }

  if (!hasHierarchyFilter && hasClassFilter) {
    const raw = cleanText(filters.classLevel);
    const variants = uniqueSorted([raw, raw.toUpperCase(), raw.toLowerCase()]);
    const promises = ["classLevel", "class", "std"].map((field) =>
      studentsRef.where(field, "in", variants).limit(limitCount).get()
    );
    const snaps = await Promise.all(promises);
    snaps.forEach((snap) => addDocs(candidates, snap.docs));
  }

  if (candidates.size === 0) {
    const snap = await studentsRef.limit(limitCount).get();
    addDocs(candidates, snap.docs);
  }

  return Array.from(candidates.values());
};

let globalMadarsasCache = null;
let globalMadarsasCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request) {
  try {
    const { db } = await requireCentralAdmin(request);
    const { searchParams } = new URL(request.url);
    const filters = {
      district: searchParams.get("district") || ALL,
      mekhala: searchParams.get("mekhala") || ALL,
      madrasa: searchParams.get("madrasa") || ALL,
      classLevel: searchParams.get("classLevel") || ALL,
    };
    const limitCount = Math.min(
      Math.max(
        parseInt(searchParams.get("limit") || DEFAULT_LIMIT, 10) ||
          DEFAULT_LIMIT,
        1,
      ),
      MAX_LIMIT,
    );

    let madarsas;
    const now = Date.now();
    if (globalMadarsasCache && now - globalMadarsasCacheTime < CACHE_TTL) {
      madarsas = globalMadarsasCache;
    } else {
      const selectFields = [
        "name", "madarsaName", "madrasaName", "district", "districtName",
        "mekhala", "mekhalaName", "code", "mid", "loginId", "madarsaId", "madrasaId"
      ];
      const madarsasSnap = await db.collection("madarsas").select(...selectFields).get();
      madarsas = madarsasSnap.docs
        .map((doc) => ({
          id: doc.id,
          ...serializeValue(doc.data()),
        }))
        .sort((a, b) =>
          getValue(a, ["name", "madarsaName", "madrasaName"]).localeCompare(
            getValue(b, ["name", "madarsaName", "madrasaName"]),
          ),
        );
      globalMadarsasCache = madarsas;
      globalMadarsasCacheTime = now;
    }

    const madarsaIndex = buildMadarsaIndex(madarsas);
    const candidateMadarsas = getFilteredMadarsas(madarsas, filters);
    const candidates = await fetchCandidateStudents(
      db,
      filters,
      candidateMadarsas.length ? candidateMadarsas : madarsas,
      limitCount,
    );

    const students = candidates
      .map((student) => enrichStudent(student, madarsaIndex))
      .filter((student) =>
        studentMatches(
          student,
          resolveStudentMadarsa(student, madarsaIndex),
          filters,
        ),
      )
      .sort((a, b) =>
        String(a.fullName || a.name || "").localeCompare(
          String(b.fullName || b.name || ""),
        ),
      )
      .slice(0, limitCount)
      .map((s) => ({
        id: s.id,
        fullName: s.fullName || "",
        name: s.name || "",
        class: s.class || "",
        classLevel: s.classLevel || "",
        std: s.std || "",
        madarsaName: s.madarsaName || "",
        madarsa: s.madarsa || "",
        madrasa: s.madrasa || "",
        certificateNumber: s.certificateNumber || "",
        regNo: s.regNo || "",
        district: s.district || "",
        mekhala: s.mekhala || "",
        mid: s.mid || "",
      }));

    const res = NextResponse.json({
      students,
      options: {
        districts: uniqueSorted(
          madarsas.map((m) => getValue(m, ["district", "districtName"])),
        ),
        mekhalas: uniqueSorted(
          getFilteredMadarsas(madarsas, {
            ...filters,
            mekhala: ALL,
            madrasa: ALL,
          }).map((m) => getValue(m, ["mekhala", "mekhalaName"])),
        ),
        madrasas: Array.from(
          new Map(
            candidateMadarsas
              .map((m) => ({
                label: cleanText(getValue(m, ["name", "madarsaName", "madrasaName"])),
                value: cleanText(getValue(m, ["name", "madarsaName", "madrasaName"])),
                madarsaId: getValue(m, ["mid", "madarsaId", "madrasaId"]) || "",
              }))
              .filter((m) => m.label)
              .map((m) => [m.label, m])
          ).values()
        ).sort((a, b) => a.label.localeCompare(b.label)),
        classes: uniqueSorted(
          students.map((s) => getValue(s, ["class", "classLevel", "std"])),
        ),
      },
      limit: limitCount,
      limited: students.length >= limitCount,
      fetchedAt: new Date().toISOString(),
    });
    
    return res;
  } catch (error) {
    console.error("[admin/certificates-data] error:", error);
    return NextResponse.json(
      { error: error.message || "Unable to load certificate data" },
      { status: error.status || 500 },
    );
  }
}
