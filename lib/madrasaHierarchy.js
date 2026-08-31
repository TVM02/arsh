// Centralized District → Mekhala mapping for attendance/result filtering.
// Values are treated as display strings (case-insensitive match against stored Firestore fields).

export const DISTRICT_TO_MEHKALA = {
  Thiruvananthapuram: [
    "Thiruvananthapuram",
    "Balaramapuram",
    "Kaniyapuram",
    "Tholikode",
    "Poovachal",
    "Panachamoodu",
    "Navayikkulam",
    "Pallikkal",
    "Varkala",
    "POTHENCODE",
    "Kilimanoor",
    "Peringammala",
    "Kallara",
    "Attingal",
    "Panavoor",
    "Nedumangad",
  ],
  Kollam: [
    "Kollam",
    "Chavara",
    "Karunagappally",
    "Sasthamkotta",
    "Kannanalloor",
    "Punalur",
    "Kulathupuzha",
    "Madathara",
    "Pathanapuram",
    "Kadakkal",
    "Oyoor",
    "Poruvazhy",
  ],
  Pathanamthitta: ["Pathanamthitta", "Adoor"],
  Alappuzha: [
    "Alappuzha",
    "Chandiroor",
    "Kanjipuzha",
    "Charummoodu",
    "Kayamkulam",
  ],
  Kottayam: [
    "Kottayam",
    "Changanassery",
    "Erattupetta",
    "Kanjirappally",
    "Mundakkayam",
    "Erumely",
    "Vaypoor",
  ],
  Idukki: ["Adimali", "Thodupuzha", "Pattam Colony", "Periyar"],
  Ernakulam: [
    "Pallarimangalam",
    "Muvattupuzha",
    "Kothamangalam",
    "Nellikuzhi",
    "Mulavoor",
    "Perumbavoor",
    "Aluva",
    "Edathala",
    "Pattimattam",
    "Kochi",
    "Kanjiramattom",
    "Paravoor",
  ],
};

export const DISTRICT_ORDER = Object.keys(DISTRICT_TO_MEHKALA);

// Common district aliases seen in UI/data.
// Keys are normalized (uppercased) via `normalizeKey`.
const DISTRICT_ALIASES = {
  // Old stored names / alternate names → canonical Thiruvananthapuram
  TRIVANDRUM: "Thiruvananthapuram",
  THIRUVANATHAPURAM: "Thiruvananthapuram",
  // Eranakulam typo
  ERANAKULAM: "Ernakulam",
  ERNAKULAM: "Ernakulam",
};

// Common mekhala/town aliases (typos) seen in stored madrasa docs.
// Keys are normalized (uppercased) via `normalizeKey`.
const MEKHALA_ALIASES = {
  // Thiruvananthapuram variants
  THIRUVANATHAPURAM: "Thiruvananthapuram",
  // Tholikode variants
  THOLIKKOD: "Tholikode",
  THOLICODE: "Tholikode",
  THOLIKOD: "Tholikode",
  // Panachamoodu variants
  PANACHAMOOD: "Panachamoodu",
  PANACHAMOODU: "Panachamoodu",
  // Navayikkulam variants
  NAVAYIKULAM: "Navayikkulam",
  NAVAIKULAM: "Navayikkulam",
  // Pothencode variants
  POTHENCODE: "POTHENCODE",
  POTHANCODE: "POTHENCODE",
  POTHANCOD: "POTHENCODE",
  POTHENCOD: "POTHENCODE",
  POTHAN_CODE: "POTHENCODE",
  POTHEN_CODE: "POTHENCODE",
  // Kollam centre variants
  PUNALOOR: "Punalur",
  OYUR: "Oyoor",
  SASTHAMCOTTA: "Sasthamkotta",
  KULATHUPUZA: "Kulathupuzha",
  // Charummoodu variants
  CHARUMMOOD: "Charummoodu",
  CHARUMOOD: "Charummoodu",
  CHARUMODU: "Charummoodu",
  CHARUMOODU: "Charummoodu",
  // Alappuzha centre variants
  KANJIPPUZHA: "Kanjipuzha",
  KANJIPUZA: "Kanjipuzha",
  // Kottayam centre variants
  CHANGANASSERI: "Changanassery",
  ERATUPETTA: "Erattupetta",
  KANJIRAPPALLI: "Kanjirappally",
  ERUMELI: "Erumely",
  VAIPUR: "Vaypoor",
  VAIPOOR: "Vaypoor",
  MUNDAKAYAM: "Mundakkayam",
  // Idukki centre variants
  PATTOM_COLONY: "Pattam Colony",
  PATTOMCOLONY: "Pattam Colony",
  // Ernakulam centre variants
  MOOVATTUPUZHA: "Muvattupuzha",
  MUVATTUPUZHA: "Muvattupuzha",
  NELLIKKUZHI: "Nellikuzhi",
  ALUWA: "Aluva",
  KANJIRAMATTAM: "Kanjiramattom",
  COCHIN: "Kochi",
  PARAVUR: "Paravoor",
  PATTIMATTOM: "Pattimattam",
  // Kannanalloor variants
  KANNANALLUR: "Kannanalloor",
  KANNANALUR: "Kannanalloor",
  KANNANALLOR: "Kannanalloor",
};

export function canonicalMekhalaName(value) {
  const raw = normalizeLabel(value);
  if (!raw) return "";
  const alias = MEKHALA_ALIASES[normalizeKey(raw)];
  return alias || raw;
}

export function stripDistrictWord(value) {
  const raw = normalizeLabel(value);
  if (!raw) return "";
  // Normalize variants like "Trivandrum District" -> "Trivandrum"
  return raw.replace(/\s*district\s*$/i, "");
}

export function normalizeLabel(value) {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

export function normalizeKey(value) {
  return normalizeLabel(value).toUpperCase();
}

export function canonicalDistrictName(value) {
  const raw = stripDistrictWord(value);
  if (!raw) return "";

  // Accept inputs like "Kollam District" (as sometimes used in UI lists)
  const withoutSuffix = raw.replace(/\s+district$/i, "").trim();

  const upper = withoutSuffix.toUpperCase();

  // Alias support (e.g., "Thiruvananthapuram" -> "TRIVANDRUM")
  const alias = DISTRICT_ALIASES[upper];
  if (alias) return alias;

  const match = DISTRICT_ORDER.find((d) => d.toUpperCase() === upper);
  return match || withoutSuffix;
}

export function getMekhalaListForDistrict(districtName) {
  const district = canonicalDistrictName(districtName);
  const configured = DISTRICT_TO_MEHKALA[district];
  return Array.isArray(configured) ? configured : [];
}

// The Firestore `districts` collection actually stores Mekhala-level sub-units
// (e.g. "POTHENCODE", "mekala_01"), but some legacy/duplicate docs are named
// after the true parent District (e.g. "ALAPPUZHA", "KOTTAYAM"). This tells
// those apart so UI can label/count each group correctly instead of lumping
// them together as "Districts".
export function isTrueDistrictName(name) {
  const raw = normalizeLabel(name);
  if (!raw) return false;
  const upper = raw.toUpperCase();
  if (DISTRICT_ALIASES[upper]) return true;
  return DISTRICT_ORDER.some((d) => d.toUpperCase() === upper);
}

// Splits raw `districts` collection docs into true Districts vs Mekhala
// sub-units, and aggregates each true District with its child Mekhalas.
// `madarsaCountsByName` is a map of doc.name -> madarsa count (as already
// computed elsewhere via madrasaMatchesDistrict against each doc's name).
export function splitDistrictsAndMekhalas(districtDocs, madarsaCountsByName = {}) {
  const docs = Array.isArray(districtDocs) ? districtDocs : [];
  const mekhalas = docs.filter((d) => !isTrueDistrictName(d.name));

  const districtRows = DISTRICT_ORDER.map((districtName) => {
    const childMekhalas = mekhalas.filter((m) => {
      const canon = canonicalMekhalaName(m.name) || m.name;
      return getMekhalaListForDistrict(districtName).some(
        (town) => normalizeKey(town) === normalizeKey(canon),
      );
    });
    const madarsaCount = childMekhalas.reduce(
      (sum, m) => sum + (madarsaCountsByName[m.name] || 0),
      0,
    );
    return {
      name: districtName,
      mekhalaCount: childMekhalas.length,
      madarsaCount,
    };
  }).filter((row) => row.mekhalaCount > 0);

  return { mekhalas, districts: districtRows };
}

export function madrasaMatchesDistrict(madrasa, districtName) {
  const district = canonicalDistrictName(districtName);
  if (!district || district === "all") return true;

  const candidates = [
    madrasa?.district,
    madrasa?.districtName,
    madrasa?.district_id,
    madrasa?.districtId,
    // In some parts of this codebase (legacy swapped labels), the *district* is stored under mekhala
    madrasa?.mekhala,
    madrasa?.mekhalaName,
    madrasa?.mekhala_id,
    madrasa?.mekhalaId,
    // common misspelling
    madrasa?.mehkala,
    madrasa?.mehkalaId,
  ];

  const directMatch = candidates
    .map((c) => canonicalDistrictName(c))
    .filter(Boolean)
    .some((c) => normalizeKey(c) === normalizeKey(district));
  if (directMatch) return true;

  // Backward-compat: some older madrasa docs only store the *mekhala/town* (often in `district`).
  // For our configured districts, consider a madrasa in the district if its town is in the
  // configured district→mekhala list.
  const configuredTowns = getMekhalaListForDistrict(district);
  if (configuredTowns.length === 0) return false;

  // Check ALL possible location fields — some docs store the town in mekhala/mekhalaName/mehkala
  const locationCandidates = [
    madrasa?.district,
    madrasa?.districtName,
    madrasa?.mekhala,
    madrasa?.mekhalaName,
    madrasa?.mehkala,
    madrasa?.mehkalaName,
    madrasa?.district_id,
    madrasa?.mekhala_id,
  ]
    .map(normalizeLabel)
    .filter(Boolean);

  return locationCandidates.some((candidate) =>
    configuredTowns.some(
      (town) => normalizeKey(town) === normalizeKey(candidate),
    ),
  );
}

export function madrasaMatchesMekhala(madarsa, mekhalaName) {
  const mekhala = canonicalMekhalaName(mekhalaName);
  if (!mekhala || mekhala === "all") return true;

  // 1. Check if the target is a parent district name
  const isParentDistrict = DISTRICT_ORDER.some(d => canonicalDistrictName(d).toLowerCase() === mekhala.toLowerCase());

  // 2. Extract the specific sub-mekhala name from the madarsa.
  // In the swapped database schema, the specific sub-mekhala is stored in the 'district' fields.
  const specificMekhalaCandidates = [
    madarsa?.district,
    madarsa?.districtName,
    madarsa?.district_id,
    madarsa?.districtId,
  ].map(c => canonicalMekhalaName(c)).filter(Boolean);

  const hasSpecificMekhala = specificMekhalaCandidates.length > 0;
  
  // Check if any of the specific candidates match the target mekhalaName
  const matchesSpecific = specificMekhalaCandidates.some(
    (c) => normalizeKey(c) === normalizeKey(mekhala)
  );

  if (matchesSpecific) {
    return true;
  }

  // If the target mekhala name is a parent district, and the madarsa has a specific sub-mekhala
  // that is DIFFERENT from the target mekhala name, then this madarsa does NOT match the target.
  if (isParentDistrict && hasSpecificMekhala) {
    const isDifferentSpecificMekhala = specificMekhalaCandidates.some(
      (c) => normalizeKey(c) !== normalizeKey(mekhala) && 
             !DISTRICT_ORDER.some(d => canonicalDistrictName(d).toLowerCase() === c.toLowerCase())
    );
    if (isDifferentSpecificMekhala) {
      return false;
    }
  }

  const candidates = [
    madarsa?.mekhala,
    madarsa?.mekhalaName,
    madarsa?.mekhala_id,
    madarsa?.mekhalaId,
    // common misspelling seen in some older docs
    madarsa?.mehkala,
    madarsa?.mehkalaId,
    // In swapped-label flows, the *mekhala/town* may be stored under district
    madarsa?.district,
    madarsa?.districtName,
    madarsa?.district_id,
    madarsa?.districtId,
  ];

  return candidates
    .map((c) => canonicalMekhalaName(c))
    .filter(Boolean)
    .some((c) => normalizeKey(c) === normalizeKey(mekhala));
}

export function sortMadarsasByIdThenName(items) {
  const getNum = (m) => {
    const v = m?.madarsaId ?? m?.madrasaId ?? m?.midNumber;
    if (v == null) return Number.POSITIVE_INFINITY;
    const s = String(v);
    const n = parseInt(s.replace(/\D+/g, ""), 10);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  };

  return [...(items || [])].sort((a, b) => {
    const na = getNum(a);
    const nb = getNum(b);
    if (na !== nb) return na - nb;
    return normalizeLabel(a?.name).localeCompare(normalizeLabel(b?.name));
  });
}

export function getDistrictQueryCandidates(districtName) {
  if (!districtName) return [];
  const canon = canonicalDistrictName(districtName) || districtName;
  const list = new Set([
    canon,
    canon.toUpperCase(),
    canon.toLowerCase(),
    districtName,
    districtName.toUpperCase(),
    districtName.toLowerCase(),
  ]);
  
  const upper = canon.toUpperCase();
  if (upper === "THIRUVANANTHAPURAM" || upper === "TRIVANDRUM" || upper === "THIRUVANATHAPURAM") {
    list.add("Thiruvananthapuram");
    list.add("THIRUVANANTHAPURAM");
    list.add("thiruvananthapuram");
    list.add("Trivandrum");
    list.add("TRIVANDRUM");
    list.add("trivandrum");
    list.add("Thiruvanathapuram");
    list.add("THIRUVANATHAPURAM");
    list.add("thiruvanathapuram");
  } else if (upper === "ERNAKULAM" || upper === "ERANAKULAM") {
    list.add("Ernakulam");
    list.add("ERNAKULAM");
    list.add("ernakulam");
    list.add("Eranakulam");
    list.add("ERANAKULAM");
    list.add("eranakulam");
  }
  return Array.from(list).filter(Boolean);
}

export function getParentDistrictsForMekhalas(mekhalas) {
  const parentDistricts = new Set();
  const rawList = Array.isArray(mekhalas) ? mekhalas : [];
  rawList.forEach((m) => {
    if (!m) return;
    const canonicalMek = (canonicalMekhalaName(m) || m).toLowerCase();
    for (const [dist, list] of Object.entries(DISTRICT_TO_MEHKALA)) {
      if (list.some((item) => (canonicalMekhalaName(item) || item).toLowerCase() === canonicalMek)) {
        parentDistricts.add(dist);
      }
    }
  });
  return Array.from(parentDistricts);
}

export async function fetchMadarsasByDistricts(db, query, collection, where, getDocs, districts) {
  const rawDistricts = Array.isArray(districts) ? districts : [];
  if (rawDistricts.length === 0) return [];
  
  try {
    // If a request is already in flight, wait for it instead of making a duplicate
    // Use window namespace to ensure cross-module cache synchronization in the browser
    if (typeof window !== 'undefined') {
      if (!window._globalMadarsasPromise) {
        window._globalMadarsasPromise = fetch('/api/inspector/madarsas', {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache', // The API handles its own caching
          }
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }
          const json = await response.json();
          return json.madarsas || [];
        }).catch(err => {
          window._globalMadarsasPromise = null; // Reset on failure
          throw err;
        });
      }
      return await window._globalMadarsasPromise;
    } else {
      // Server-side fallback (if ever run in SSR context, though it shouldn't be)
      const response = await fetch('/api/inspector/madarsas', { method: 'GET' });
      if (!response.ok) throw new Error("API error");
      const json = await response.json();
      return json.madarsas || [];
    }
  } catch (error) {
    console.error("Failed to fetch madarsas from optimized API, falling back to direct fetch:", error);
    // Fallback to direct fetch if the API fails
    const snap = await getDocs(collection(db, "madarsas"));
    const results = [];
    snap.docs.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() });
    });
    return results;
  }
}
