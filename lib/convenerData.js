import { collection, getDocs, query, where, getCountFromServer } from "firebase/firestore";
import { fetchMadarsasByDistricts, madrasaMatchesDistrict, splitDistrictsAndMekhalas } from "@/lib/madrasaHierarchy";

export const getAuthorizedDistricts = async (userData, db) => {
  const mekhalaId = userData.uid || userData.id;

  const districtsSnapshot = await getDocs(collection(db, "districts"));
  const allDistricts = districtsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const profileDistrictNames = [
    userData.district,
    userData.districtName,
    userData.name,
    ...(userData.districts || []),
    ...(userData.assignedDistricts || []),
  ].filter(Boolean);

  let districtsData = allDistricts.filter(d => 
    d.mekhalaId === mekhalaId || 
    profileDistrictNames.some(p => p.toLowerCase() === d.name?.toLowerCase())
  );

  if (districtsData.length === 0) {
    districtsData = allDistricts;
  }

  return districtsData;
};

// Trims only — this value is sent to Firestore as a literal `in` filter
// against the stored `madarsaId` field, which is case-sensitive, so it must
// NOT be lowercased (unlike the lookup-key normalization used elsewhere in
// this codebase for local, JS-side map comparisons).
const cleanMadarsaId = (idStr) => {
  if (!idStr) return null;
  const s = String(idStr).trim();
  return s || null;
};

export const fetchConvenerStats = async (userData, db) => {
  const districtsData = await getAuthorizedDistricts(userData, db);
  const districtNames = districtsData.map(d => d.name).filter(Boolean);

  const allDistrictsSnapshot = await getDocs(collection(db, "districts"));
  const allDistrictsCount = allDistrictsSnapshot.size;
  const isStateLevel = (districtsData.length >= allDistrictsCount && allDistrictsCount > 0);

  if (districtNames.length === 0) {
    return {
      districts: 0,
      mekhalas: 0,
      trueDistricts: 0,
      madarsas: 0,
      students: 0,
      teachers: 0,
      authorizedDistrictNames: [],
    };
  }

  // Fetch madarsa candidates and scope them to the authorized districts.
  // fetchMadarsasByDistricts returns ALL madarsas statewide (it relies on
  // callers to filter), so this filtering step is required for correctness.
  const candidateMadarsas = await fetchMadarsasByDistricts(
    db,
    query,
    collection,
    where,
    getDocs,
    districtNames
  );
  const filteredMadarsas = isStateLevel
    ? candidateMadarsas
    : candidateMadarsas.filter((m) =>
        districtNames.some((d) => {
          try {
            return madrasaMatchesDistrict(m, d);
          } catch {
            return false;
          }
        })
      );

  // Get all unique madarsa IDs to filter students and teachers
  const madarsaIds = Array.from(new Set(
    filteredMadarsas.flatMap(m => {
      const p = cleanMadarsaId(m.madarsaId);
      const f = cleanMadarsaId(m.id);
      return [p, f].filter(Boolean);
    })
  ));

  let totalStudents = 0;
  let totalTeachers = 0;

  if (isStateLevel) {
    const [studentSnap, teacherSnap] = await Promise.all([
      getCountFromServer(collection(db, "students")),
      getCountFromServer(collection(db, "teachers"))
    ]);
    totalStudents = studentSnap.data().count;
    totalTeachers = teacherSnap.data().count;
  } else if (madarsaIds.length > 0) {
    // Chunk madarsa IDs into arrays of 30 for the 'in' query
    const chunks = [];
    for (let i = 0; i < madarsaIds.length; i += 30) {
      chunks.push(madarsaIds.slice(i, i + 30));
    }

    const studentPromises = chunks.map(chunk =>
      getCountFromServer(query(
        collection(db, "students"), 
        where("madarsaId", "in", chunk)
      ))
    );

    const teacherPromises = chunks.map(chunk =>
      getCountFromServer(query(
        collection(db, "teachers"), 
        where("madarsaId", "in", chunk)
      ))
    );

    const studentSnaps = await Promise.all(studentPromises);
    const teacherSnaps = await Promise.all(teacherPromises);

    totalStudents = studentSnaps.reduce((sum, snap) => sum + snap.data().count, 0);
    totalTeachers = teacherSnaps.reduce((sum, snap) => sum + snap.data().count, 0);
  }

  // Per-name madarsa counts, needed to aggregate madarsas under each true
  // District from its child Mekhala entries.
  const madarsaCountsByName = {};
  districtsData.forEach((d) => {
    if (!d.name) return;
    madarsaCountsByName[d.name] = filteredMadarsas.filter((m) => {
      try {
        return madrasaMatchesDistrict(m, d.name);
      } catch {
        return false;
      }
    }).length;
  });
  const { mekhalas, districts: trueDistrictRows } = splitDistrictsAndMekhalas(
    districtsData,
    madarsaCountsByName
  );

  return {
    districts: districtsData.length,
    mekhalas: mekhalas.length,
    trueDistricts: trueDistrictRows.length,
    trueDistrictRows,
    madarsas: filteredMadarsas.length,
    students: totalStudents,
    teachers: totalTeachers,
    authorizedDistrictNames: districtNames,
    authorizedDistrictsData: districtsData,
  };
};
