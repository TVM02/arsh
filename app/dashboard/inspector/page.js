"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";

// ── Cache constants ────────────────────────────────────────────────────────
const _FRESH_MS  = 60 * 60 * 1000;  // 60 min — skip refetch if data is this fresh
const _STALE_MS  = 2  * 60 * 60 * 1000;  // 2 h  — discard if older than this

// ── Persistent localStorage helpers (L2 cache) ────────────────────────────
function _lsGet(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { d, t } = JSON.parse(raw);
    if (Date.now() - t > _STALE_MS) { localStorage.removeItem(key); return null; }
    return d;
  } catch { return null; }
}
function _lsSet(key, data) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify({ d: data, t: Date.now() })); } catch {}
}
function _lsAge(key) {
  if (typeof window === "undefined") return Infinity;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return Infinity;
    return Date.now() - JSON.parse(raw).t;
  } catch { return Infinity; }
}

// ── Module-level in-memory cache (L1 — survives client-side navigation) ───
const _hierarchyCache = { data: null, fetchedAt: 0, TTL: 30 * 60 * 1000 };

const _getHierarchyData = async (db, collection, getDocs) => {
  const now = Date.now();
  if (_hierarchyCache.data && now - _hierarchyCache.fetchedAt < _hierarchyCache.TTL) {
    return _hierarchyCache.data;
  }
  const ls = _lsGet("dkju_insp_hierarchy");
  if (ls) {
    _hierarchyCache.data = ls;
    _hierarchyCache.fetchedAt = now;
    return ls;
  }
  const [mekhalasSnap, districtDocsSnap] = await Promise.all([
    getDocs(collection(db, "mekhala")),
    getDocs(collection(db, "districts")),
  ]);
  const data = {
    mekhalas: mekhalasSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    districtDocs: districtDocsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
  _hierarchyCache.data = data;
  _hierarchyCache.fetchedAt = now;
  _lsSet("dkju_insp_hierarchy", data);
  return data;
};

// ── Targeted madarsa fetcher — replaces full-collection scan ───────────────
// Instead of reading every madarsa doc (500+ in production), queries only the
// district/mekhala slices relevant to this inspector. 5–10× faster on cold start.
async function _getMadarsasByDistricts(db, collection, query, where, getDocs, districts, mekhalaIdSet) {
  if (districts.length === 0 && mekhalaIdSet.size === 0) return [];

  // Build name variants for each assigned district (handles typos & casing).
  const rawVariants = [];
  for (const d of districts) {
    const c = String(d || "").trim();
    if (!c) continue;
    const u = c.toUpperCase();
    const l = c.toLowerCase();
    const title = c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
    rawVariants.push(c, u, l, title);
  }
  const variants = [...new Set(rawVariants)].filter(Boolean);

  const chunkArr = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  const variantChunks   = variants.length     > 0 ? chunkArr(variants, 30)                   : [];
  const mekhalaIdChunks = mekhalaIdSet.size   > 0 ? chunkArr([...mekhalaIdSet], 30)           : [];

  const promises = [
    ...variantChunks.flatMap(chunk => [
      getDocs(query(collection(db, "madarsas"), where("district",     "in", chunk))),
      getDocs(query(collection(db, "madarsas"), where("districtName", "in", chunk))),
    ]),
    ...mekhalaIdChunks.map(chunk =>
      getDocs(query(collection(db, "madarsas"), where("mekhalaId", "in", chunk)))
    ),
  ];

  const snaps = await Promise.all(promises);
  const seen  = new Set();
  const docs  = [];
  for (const snap of snaps) {
    for (const d of snap.docs) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      docs.push({ id: d.id, ...d.data() });
    }
  }
  return docs;
}

// ── Read assigned-madarsas cache at module-load (before first React render) ─
// This allows the very first render to already have data — zero skeleton flash
// for returning users. Also exposes freshness so fetchData can skip a refetch.
function _readAssignedCache() {
  if (typeof window === "undefined") return { data: null, fresh: false, uid: null };
  try {
    const authRaw = sessionStorage.getItem("auth-storage");
    if (!authRaw) return { data: null, fresh: false, uid: null };
    const uid = JSON.parse(authRaw)?.state?.userData?.uid;
    if (!uid) return { data: null, fresh: false, uid: null };
    const key = `dkju_insp_assigned_${uid}`;
    const data = _lsGet(key);
    if (!data) return { data: null, fresh: false, uid };
    const fresh = _lsAge(key) < _FRESH_MS;
    return { data, fresh, uid };
  } catch { return { data: null, fresh: false, uid: null }; }
}
const _initCache = _readAssignedCache();
const _preloadedMadarsas = _initCache.data;
const _preloadedFresh    = _initCache.fresh;
import Link from "next/link";
import InspectorLayout from "@/components/InspectorLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building, Bell, Eye, Search, X } from "lucide-react";
import useAuthStore from "@/lib/authStore";
import {
  collection,
  query,
  where,
  documentId,
  getCountFromServer,
  getDocs,
  getDoc,
  doc,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import {
  canonicalDistrictName,
  canonicalMekhalaName,
  getMekhalaListForDistrict,
  madrasaMatchesDistrict,
  madrasaMatchesMekhala,
  getDistrictQueryCandidates,
  DISTRICT_TO_MEHKALA,
  DISTRICT_ORDER,
} from "@/lib/madrasaHierarchy";

export default function InspectorDashboard() {
  const { user, userData, initializeAuth, setUserData } = useAuthStore();

  const [loading, setLoading] = useState(false);
  // _preloadedMadarsas is read from localStorage at module load — if data exists
  // the very first render shows it immediately (no skeleton flash).
  const [madarsasLoading, setMadarsasLoading] = useState(!_preloadedMadarsas);
  const [assignedMadarsas, setAssignedMadarsas] = useState(_preloadedMadarsas || []);
  const [recentNotices, setRecentNotices] = useState([]);
  const [approvedMadarsaIds, setApprovedMadarsaIds] = useState(() => new Set());

  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedMekhala, setSelectedMekhala] = useState("");
  const [madarsaSearchTerm, setMadarsaSearchTerm] = useState("");
  const [assignmentUserData, setAssignmentUserData] = useState(userData);

  useEffect(() => {
    if (userData) setAssignmentUserData(userData);
  }, [userData]);

  const showAlreadyInspectedToast = () => {
    toast.error("Already Inspected");
  };

  const allowedDistricts = useMemo(() => {
    const directRaw = Array.isArray(assignmentUserData?.assignedDistricts)
      ? assignmentUserData.assignedDistricts
      : assignmentUserData?.assignedDistrict
        ? [assignmentUserData.assignedDistrict]
        : [];

    const directCanonical = directRaw
      .map((d) => canonicalDistrictName(d) || String(d || "").trim())
      .filter(Boolean);

    // ONLY return assigned districts from userData, never derive from madarsas
    return Array.from(new Set(directCanonical));
  }, [assignmentUserData]);

  // Mekhalas explicitly assigned by Central Admin.
  // When non-empty, the drilldown will only show these mekhalas.
  const allowedMekhalaList = useMemo(() => {
    const raw = Array.isArray(assignmentUserData?.assignedMekhalas)
      ? assignmentUserData.assignedMekhalas
      : [];
    return Array.from(
      new Set(
        raw
          .map((m) => canonicalMekhalaName(m) || String(m || "").trim())
          .filter(Boolean),
      ),
    );
  }, [assignmentUserData]);

  const allowedMekhalas = useMemo(
    () => new Set(allowedMekhalaList.map((m) => m.toLowerCase())),
    [allowedMekhalaList],
  );

  const normalizeKey = useCallback((value) => String(value || "").trim(), []);
  const toDisplayKey = useCallback(
    (value) => {
      const v = normalizeKey(value);
      return v ? v.toUpperCase() : "";
    },
    [normalizeKey],
  );

  const getMadarsaDistrict = useCallback(
    (madarsa) => {
      for (const d of allowedDistricts) {
        try {
          if (madrasaMatchesDistrict(madarsa, d)) return toDisplayKey(d);
        } catch {
          // ignore
        }
      }

      const canonical = canonicalDistrictName(madarsa?.district);
      const v = toDisplayKey(canonical || madarsa?.district);
      return v || "UNKNOWN DISTRICT";
    },
    [allowedDistricts, toDisplayKey],
  );

  const getMadarsaMekhala = useCallback(
    (madarsa, districtHint = "") => {
      // Highest priority: if this inspector has explicit mekhala assignments,
      // resolve using those first for stable/accurate per-mekhala counts.
      const matchedAssignedMekhala = allowedMekhalaList.find((candidate) => {
        try {
          return madrasaMatchesMekhala(madarsa, candidate);
        } catch {
          return false;
        }
      });
      if (matchedAssignedMekhala) {
        return toDisplayKey(matchedAssignedMekhala);
      }

      if (madarsa?._centralMekhala) {
        return toDisplayKey(madarsa._centralMekhala);
      }

      const directCanonical = canonicalMekhalaName(
        madarsa?.mekhala ||
          madarsa?.mekhalaName ||
          madarsa?.mehkala ||
          madarsa?.district ||
          madarsa?.districtName,
      );

      // Return directCanonical if it is NOT one of the top-level district names.
      // Previously this used `directCanonical !== canonicalDistrictName(directCanonical)`,
      // but canonicalDistrictName() falls back to returning its input unchanged for unknown
      // values (like "Kannanalloor"), making the condition always false for mekhala names
      // not in DISTRICT_ALIASES — causing them to be silently lost.
      if (directCanonical && !DISTRICT_ORDER.includes(directCanonical)) {
        return toDisplayKey(directCanonical);
      }

      const districtName =
        canonicalDistrictName(districtHint) || getMadarsaDistrict(madarsa);

      if (districtName) {
        const districtMekhalas = getMekhalaListForDistrict(districtName);
        const matchedMekhala = districtMekhalas.find((candidate) => {
          try {
            return madrasaMatchesMekhala(madarsa, candidate);
          } catch {
            return false;
          }
        });

        if (matchedMekhala) {
          return toDisplayKey(matchedMekhala);
        }
      }

      const fallback = toDisplayKey(
        directCanonical ||
          madarsa?.mekhala ||
          madarsa?.mekhalaName ||
          madarsa?.mehkala ||
          madarsa?.district ||
          madarsa?.districtName,
      );

      return fallback || "UNKNOWN MEKHALA";
    },
    [allowedMekhalaList, getMadarsaDistrict, toDisplayKey],
  );

  const getCentralMekhalaScope = useCallback(async (assignedDistricts) => {
    const districts = Array.isArray(assignedDistricts)
      ? assignedDistricts
          .map((d) => canonicalDistrictName(d) || String(d || "").trim())
          .filter(Boolean)
      : [];
    if (districts.length === 0) {
      return {
        mekhalaIds: new Set(),
        mekhalaNames: new Set(),
        mekhalaNameById: new Map(),
      };
    }

    const { mekhalas, districtDocs } = await _getHierarchyData(
      db,
      collection,
      getDocs,
    );

    const districtKeys = new Set(
      districts.map((d) => String(canonicalDistrictName(d) || d).toUpperCase()),
    );

    const parentIds = new Set();
    mekhalas.forEach((m) => {
      const topDistrict = canonicalDistrictName(m?.district || m?.name || "");
      if (topDistrict && districtKeys.has(String(topDistrict).toUpperCase())) {
        parentIds.add(String(m.id || "").trim());
      }
    });

    const mekhalaIds = new Set();
    const mekhalaNames = new Set();
    const mekhalaNameById = new Map();

    districtDocs.forEach((d) => {
      const parentId = String(d?.mekhalaId || "").trim();
      if (!parentId || !parentIds.has(parentId)) return;

      const subId = String(d?.id || "").trim();
      const subName =
        canonicalMekhalaName(d?.name) ||
        String(d?.name || "").trim() ||
        String(d?.district || "").trim();

      if (subId) {
        mekhalaIds.add(subId);
        if (subName) mekhalaNameById.set(subId, subName);
      }
      if (subName) {
        mekhalaNames.add(String(subName).toUpperCase());
      }
    });

    // Fallback: include configured mekhala/town names for the assigned districts.
    districts.forEach((d) => {
      getMekhalaListForDistrict(d).forEach((name) => {
        const canonical =
          canonicalMekhalaName(name) || String(name || "").trim();
        if (canonical) mekhalaNames.add(String(canonical).toUpperCase());
      });
    });

    return { mekhalaIds, mekhalaNames, mekhalaNameById };
  }, []);

  const fetchMadarsasByIds = useCallback(async (madarsaIds) => {
    const rawIds = Array.isArray(madarsaIds) ? madarsaIds : [];
    const rawStringIds = rawIds
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);

    const stringVariantSet = new Set();
    const numberVariantSet = new Set();

    rawStringIds.forEach((id) => {
      const numericStr = id.replace(/^[a-zA-Z]+-/, "");
      const numericVal = Number(numericStr);

      stringVariantSet.add(id);
      stringVariantSet.add(numericStr);
      if (numericStr) {
        stringVariantSet.add(`mid-${numericStr}`);
        stringVariantSet.add(`mld-${numericStr}`);
      }

      if (Number.isFinite(numericVal) && numericVal > 0) {
        numberVariantSet.add(numericVal);
      }
    });

    const stringIds = Array.from(stringVariantSet).filter(Boolean);
    const numberIds = Array.from(numberVariantSet);

    if (
      rawStringIds.length === 0 &&
      stringIds.length === 0 &&
      numberIds.length === 0
    ) {
      return [];
    }

    const queryFieldInChunks = async (field, values, chunkSize = 10) => {
      if (!values.length) return [];
      const chunks = [];
      for (let i = 0; i < values.length; i += chunkSize) {
        chunks.push(values.slice(i, i + chunkSize));
      }
      const out = [];
      for (const chunk of chunks) {
        const snap = await getDocs(
          query(collection(db, "madarsas"), where(field, "in", chunk)),
        );
        snap.docs.forEach((doc) => out.push({ id: doc.id, ...doc.data() }));
      }
      return out;
    };

    const [byStringId, byNumericId, byDocId] = await Promise.all([
      queryFieldInChunks("madarsaId", stringIds),
      queryFieldInChunks("madarsaId", numberIds),
      queryFieldInChunks(documentId(), rawStringIds),
    ]);

    let results = [...byStringId, ...byNumericId, ...byDocId];

    // Deduplicate by madarsaId
    const seen = new Set();
    return results.filter((m) => {
      const uniqueKey =
        String(m?.madarsaId ?? "").trim() || String(m?.id ?? "").trim();
      if (!uniqueKey) return false;
      if (seen.has(uniqueKey)) return false;
      seen.add(uniqueKey);
      return true;
    });
  }, []);

  const filterAssignedMadarsas = useCallback(
    (madarsasData, assignedDistricts) => {
      const canonicalDistricts = Array.isArray(assignedDistricts)
        ? assignedDistricts
            .map((d) => canonicalDistrictName(d) || String(d || "").trim())
            .filter(Boolean)
        : [];

      if (canonicalDistricts.length === 0) {
        return Array.isArray(madarsasData) ? madarsasData : [];
      }

      return (Array.isArray(madarsasData) ? madarsasData : []).filter(
        (madarsa) =>
          canonicalDistricts.some((district) => {
            try {
              return madrasaMatchesDistrict(madarsa, district);
            } catch {
              return false;
            }
          }),
      );
    },
    [],
  );

  const deriveMadarsasFromAssignedDistricts = useCallback(
    async (
      assignedDistricts,
      selectedMekhalas = [],
      precomputedScope = null,
    ) => {
      const districts = Array.isArray(assignedDistricts)
        ? assignedDistricts
            .map((d) => canonicalDistrictName(d) || String(d || "").trim())
            .filter(Boolean)
        : [];
      if (districts.length === 0) return [];

      const canonicalSelectedMekhalas = Array.isArray(selectedMekhalas)
        ? selectedMekhalas
            .map((m) => canonicalMekhalaName(m) || String(m || "").trim())
            .filter(Boolean)
        : [];
      const selectedMekhalaKeys = new Set(
        canonicalSelectedMekhalas.map((m) => m.toUpperCase()),
      );

      const centralScope =
        precomputedScope || (await getCentralMekhalaScope(districts));

      // Targeted district queries — fetch only madarsas that belong to the
      // inspector's assigned districts/mekhalas. 5–10× faster than a full scan
      // because we pull ~50–100 docs instead of 500+.
      // getDistrictQueryCandidates() covers canonical names + common typos/aliases.
      const districtVariants = [
        ...new Set(
          districts.flatMap((d) => getDistrictQueryCandidates(d) || [
            String(d || "").trim(),
            String(d || "").trim().toUpperCase(),
          ])
        ),
      ].filter(Boolean);
      const allMadarsas = await _getMadarsasByDistricts(
        db, collection, query, where, getDocs,
        districtVariants,
        centralScope.mekhalaIds,
      );
      const filtered = allMadarsas
        .filter((m) => {
          const linkedId = String(
            m?.mekhalaId ||
              m?.districtId ||
              m?.mekhala_id ||
              m?.district_id ||
              "",
          ).trim();

          const inAssignedDistrict =
            districts.some((d) => {
              try {
                return madrasaMatchesDistrict(m, d);
              } catch {
                return false;
              }
            }) ||
            (linkedId && centralScope.mekhalaIds.has(linkedId));

          if (!inAssignedDistrict) {
            const candidateNames = [
              m?.mekhala,
              m?.mekhalaName,
              m?.mehkala,
              m?.district,
              m?.districtName,
            ]
              .map((v) => canonicalMekhalaName(v) || String(v || "").trim())
              .filter(Boolean)
              .map((v) => String(v).toUpperCase());

            if (
              !candidateNames.some((name) =>
                centralScope.mekhalaNames.has(name),
              )
            ) {
              return false;
            }
          }

          if (selectedMekhalaKeys.size === 0) return true;

          const linkedMekhalaName = linkedId
            ? centralScope.mekhalaNameById.get(linkedId)
            : "";
          const linkedKey = linkedMekhalaName
            ? String(
                canonicalMekhalaName(linkedMekhalaName) || linkedMekhalaName,
              )
                .trim()
                .toUpperCase()
            : "";
          if (linkedKey && selectedMekhalaKeys.has(linkedKey)) return true;

          return canonicalSelectedMekhalas.some((mk) => {
            try {
              return madrasaMatchesMekhala(m, mk);
            } catch {
              return false;
            }
          });
        });

      const seen = new Set();
      return filtered.filter((m) => {
        const mid =
          String(m?.madarsaId || "").trim() || String(m?.id || "").trim();
        if (!mid) return false;
        if (seen.has(mid)) return false;
        seen.add(mid);
        return true;
      });
    },
    [getCentralMekhalaScope],
  );

  const madarsaSearchResults = useMemo(() => {
    const term = normalizeKey(madarsaSearchTerm).toLowerCase();
    if (!term) return [];

    const matches = assignedMadarsas.filter((m) => {
      const district = getMadarsaDistrict(m);
      const mekhala = getMadarsaMekhala(m, district);
      const name = normalizeKey(m?.name);
      const mid = normalizeKey(m?.madarsaId);
      const address = normalizeKey(m?.address);

      const haystack = `${district} ${mekhala} ${name} ${mid} ${address}`
        .toLowerCase()
        .trim();

      return haystack.includes(term);
    });

    return matches.sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || "")),
    );
  }, [
    assignedMadarsas,
    getMadarsaDistrict,
    getMadarsaMekhala,
    madarsaSearchTerm,
    normalizeKey,
  ]);

  const drilldown = useMemo(() => {
    const districtsMap = new Map();

    // ONLY use allowedDistricts from userData, never derive from madarsas
    const allowed = allowedDistricts
      .map((d) => ({ raw: d, key: toDisplayKey(d) }))
      .filter((d) => d.key);

    // If no districts assigned, return empty structure
    if (allowed.length === 0) {
      return { districts: [] };
    }

    // Always show the districts assigned by Central Admin, even if no madarsas match yet.
    if (allowed.length > 0) {
      for (const d of allowed) {
        if (!districtsMap.has(d.key)) {
          districtsMap.set(d.key, {
            district: d.key,
            madarsaCount: 0,
            mekhalas: new Map(),
          });
        }
      }
    }

    for (const m of assignedMadarsas) {
      // Only show districts actually assigned by Central Admin
      let matchedDistrict = "";
      for (const d of allowed) {
        try {
          if (madrasaMatchesDistrict(m, d.raw)) {
            matchedDistrict = d.key;
            break;
          }
        } catch {
          // ignore
        }
      }

      if (!matchedDistrict) continue;

      const district = matchedDistrict;
      const mekhala = getMadarsaMekhala(m, district);

      if (!districtsMap.has(district)) {
        districtsMap.set(district, {
          district,
          madarsaCount: 0,
          mekhalas: new Map(),
        });
      }

      const districtEntry = districtsMap.get(district);
      districtEntry.madarsaCount += 1;

      if (!districtEntry.mekhalas.has(mekhala)) {
        districtEntry.mekhalas.set(mekhala, {
          mekhala,
          madarsas: [],
        });
      }
      districtEntry.mekhalas.get(mekhala).madarsas.push(m);
    }

    // Build a per-district set of restricted mekhalas:
    // assignedMekhalas only constrain the district(s) those mekhalas belong to.
    // Districts that have NO assigned mekhalas show ALL their mekhalas.
    const mekhalaToDistrictMap = new Map();
    for (const [dist, mekhalas] of Object.entries(DISTRICT_TO_MEHKALA)) {
      for (const mek of mekhalas) {
        mekhalaToDistrictMap.set(mek.toLowerCase(), dist.toUpperCase());
      }
    }
    // Build: districtKey → Set of restricted mekhala display-keys
    const districtMekhalaRestrictions = new Map(); // districtKey → Set<string>
    if (allowedMekhalas.size > 0) {
      for (const mek of allowedMekhalas) {
        const canonMek = canonicalMekhalaName(mek) || mek;
        const parentDist = mekhalaToDistrictMap.get(canonMek.toLowerCase());
        const distKey = parentDist ? parentDist : null;
        if (!distKey) continue;
        if (!districtMekhalaRestrictions.has(distKey)) {
          districtMekhalaRestrictions.set(distKey, new Set());
        }
        districtMekhalaRestrictions.get(distKey).add(toDisplayKey(canonMek));
      }
    }

    // Build reverse map: canonical mekhala name (lower) → canonical district name
    const mekhalaToDistrict = new Map();
    for (const [dist, mekhalas] of Object.entries(DISTRICT_TO_MEHKALA)) {
      for (const mek of mekhalas) {
        mekhalaToDistrict.set(mek.toLowerCase(), dist);
      }
    }

    // If specific mekhalas were assigned, ensure they always appear as entries
    // ONLY under the district they actually belong to per the hierarchy.
    if (allowedMekhalas.size > 0) {
      for (const mek of allowedMekhalas) {
        const canonicalMek = canonicalMekhalaName(mek) || mek;
        const parentDistrict = mekhalaToDistrict.get(
          canonicalMek.toLowerCase(),
        );
        // parentDistrict is the canonical district name (e.g. "Trivandrum", "Ernakulam")
        const targetKey = parentDistrict ? toDisplayKey(parentDistrict) : null;

        for (const [districtKey, districtEntry] of districtsMap) {
          // Skip if this mekhala doesn't belong to this district
          if (targetKey && districtKey !== targetKey) continue;

          const displayKey = toDisplayKey(canonicalMek);
          if (!districtEntry.mekhalas.has(displayKey)) {
            districtEntry.mekhalas.set(displayKey, {
              mekhala: displayKey,
              madarsas: [],
            });
          }
        }
      }
    }

    const districts = Array.from(districtsMap.values())
      .map((d) => ({
        ...d,
        // Per-district mekhala filter:
        // If Central Admin restricted mekhalas for THIS district, only show those.
        // Districts with no mekhala restrictions show all their mekhalas.
        mekhalas: Array.from(d.mekhalas.values())
          .filter((mk) => {
            const restrictions = districtMekhalaRestrictions.get(d.district);
            if (!restrictions || restrictions.size === 0) return true; // unrestricted district
            return restrictions.has(mk.mekhala);
          })
          .sort((a, b) => a.mekhala.localeCompare(b.mekhala)),
      }))
      .sort((a, b) => a.district.localeCompare(b.district));

    return { districts };
  }, [
    assignedMadarsas,
    allowedDistricts,
    allowedMekhalas,
    getMadarsaMekhala,
    toDisplayKey,
  ]);

  useEffect(() => {
    if (!selectedDistrict) {
      if (selectedMekhala) setSelectedMekhala("");
      return;
    }

    const districtExists = drilldown.districts.some(
      (d) => d.district === selectedDistrict,
    );

    if (!districtExists) {
      setSelectedDistrict("");
      setSelectedMekhala("");
      return;
    }

    if (!selectedMekhala) return;
    const mekhalas =
      drilldown.districts.find((d) => d.district === selectedDistrict)
        ?.mekhalas || [];
    const mekhalaExists = mekhalas.some((m) => m.mekhala === selectedMekhala);
    if (!mekhalaExists) setSelectedMekhala("");
  }, [drilldown.districts, selectedDistrict, selectedMekhala]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async (liveUserData) => {
      try {
        if (cancelled || !user?.uid || !liveUserData) {
          if (!cancelled) setMadarsasLoading(false);
          return;
        }

        const madarsaIds = Array.isArray(liveUserData?.assignedMadarsas)
          ? liveUserData.assignedMadarsas
          : [];
        const selectedMekhalas = Array.isArray(liveUserData?.assignedMekhalas)
          ? liveUserData.assignedMekhalas
              .map((m) => canonicalMekhalaName(m) || String(m || "").trim())
              .filter(Boolean)
          : [];
        const districts = Array.isArray(liveUserData?.assignedDistricts)
          ? liveUserData.assignedDistricts
          : liveUserData?.assignedDistrict
            ? [liveUserData.assignedDistrict]
            : [];

        if (madarsaIds.length === 0 && districts.length === 0) {
          if (!cancelled) setMadarsasLoading(false);
          return;
        }

        const _assignedCacheKey = `dkju_insp_assigned_${user.uid}`;

        // ── Stale-while-revalidate ─────────────────────────────────────────
        // If the cache was populated at module-load AND is still fresh (< 60 min),
        // skip the heavy Firestore fetch entirely and just refresh notices.
        if (_preloadedFresh && _preloadedMadarsas && _initCache.uid === user.uid) {
          if (!cancelled) {
            setAssignedMadarsas(_preloadedMadarsas);
            setMadarsasLoading(false);
          }
          // Still refresh notices (tiny query)
          const noticesSnap = await getDocs(
            query(
              collection(db, "notices"),
              where("targetAudience", "in", ["all", "inspector"]),
              limit(10),
            ),
          ).catch(() => null);
          if (!cancelled && noticesSnap) {
            setRecentNotices(
              noticesSnap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => {
                  const ta = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds * 1000 ?? 0;
                  const tb = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds * 1000 ?? 0;
                  return tb - ta;
                })
                .slice(0, 5),
            );
          }
          return;
        }

        const [loadedMadarsas, approvedSnap, noticesSnapshot] =
          await Promise.all([
            (async () => {
              const centralScope =
                districts.length > 0
                  ? await getCentralMekhalaScope(districts)
                  : {
                      mekhalaIds: new Set(),
                      mekhalaNames: new Set(),
                      mekhalaNameById: new Map(),
                    };

              // Run BOTH sources in parallel:
              //  - district-wide query  → madarsas matched by field-name values
              //  - ID-specific query    → madarsas explicitly assigned (field format unknown)
              const [districtMadarsas, idMadarsas] = await Promise.all([
                districts.length > 0
                  ? deriveMadarsasFromAssignedDistricts(
                      districts,
                      selectedMekhalas,
                      centralScope,
                    )
                  : Promise.resolve([]),
                madarsaIds.length > 0
                  ? fetchMadarsasByIds(madarsaIds)
                  : Promise.resolve([]),
              ]);

              // District-derived madarsas: apply district filter (already correct, belt+suspenders)
              const filteredDistrict =
                districts.length > 0
                  ? filterAssignedMadarsas(districtMadarsas, districts)
                  : districtMadarsas;

              // ID-assigned madarsas: NEVER filter by district — they were explicitly assigned
              // regardless of how (or whether) their district field is stored.

              // Merge and deduplicate — district results first, then ID results fill gaps
              const seen = new Set();
              const merged = [];
              for (const m of [...filteredDistrict, ...idMadarsas]) {
                const key = String(m?.madarsaId || m?.id || "").trim();
                if (!key || seen.has(key)) continue;
                seen.add(key);

                const linkedId = String(
                  m?.mekhalaId ||
                    m?.districtId ||
                    m?.mekhala_id ||
                    m?.district_id ||
                    "",
                ).trim();
                const resolvedFromCentral = linkedId
                  ? centralScope.mekhalaNameById.get(linkedId)
                  : "";

                const singleAssignedMekhala =
                  !resolvedFromCentral && selectedMekhalas.length === 1
                    ? selectedMekhalas[0]
                    : "";

                merged.push(
                  resolvedFromCentral || singleAssignedMekhala
                    ? {
                        ...m,
                        _centralMekhala:
                          resolvedFromCentral || singleAssignedMekhala,
                      }
                    : m,
                );
              }

              return merged;
            })(),
            getDocs(
              query(
                collection(db, "inspections"),
                where("inspectorId", "==", user.uid),
                where("status", "==", "approved"),
              ),
            ).catch(() => null),
            getDocs(
              query(
                collection(db, "notices"),
                where("targetAudience", "in", ["all", "inspector"]),
                limit(10),
              ),
            ).catch(() => null),
          ]);

        if (cancelled) return;

        setAssignedMadarsas(loadedMadarsas);
        setMadarsasLoading(false);

        // Persist to localStorage so next visit (even new tab) is instant
        _lsSet(_assignedCacheKey, loadedMadarsas);

        if (approvedSnap) {
          const ids = new Set();
          approvedSnap.docs.forEach((d) => {
            const data = d.data();
            const mid = String(
              data?.selectedMadarsaId || data?.madarsaId || "",
            ).trim();
            if (mid) ids.add(mid);
          });
          setApprovedMadarsaIds(ids);
        } else {
          setApprovedMadarsaIds(new Set());
        }

        const notices = (noticesSnapshot?.docs || [])
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title,
              content: data.content,
              priority: data.priority,
              targetAudience: data.targetAudience,
              showOnDashboard: data.showOnDashboard,
              createdAt: data.createdAt?.toDate(),
              createdByName: data.createdByName,
              expiryDate: data.expiryDate?.toDate(),
            };
          })
          .filter((n) => n.showOnDashboard === true)
          .sort((a, b) => {
            const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
            const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
            return tb - ta;
          })
          .slice(0, 5);

        setRecentNotices(notices);
      } catch (error) {
        if (!cancelled && user?.uid) {
          console.error("Error fetching inspector dashboard data:", error);
        }
        if (!cancelled) setMadarsasLoading(false);
      }
    };

    if (user) {
      setMadarsasLoading(true);
      (async () => {
        if (userData) {
          setAssignmentUserData(userData);
          await fetchData(userData);
          return;
        }

        let live = null;
        try {
          const freshSnap = await getDoc(doc(db, "users", user.uid));
          if (cancelled) return;
          if (freshSnap.exists()) {
            live = { id: freshSnap.id, ...freshSnap.data() };
            setUserData(live);
          }
        } catch (error) {
          if (!cancelled && user?.uid) {
            console.warn("Unable to refresh inspector profile; using cached data if available.");
          }
        }
        setAssignmentUserData(live || null);
        await fetchData(live);
      })().catch(() => setMadarsasLoading(false));
    } else {
      setMadarsasLoading(false);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    getCentralMekhalaScope,
    deriveMadarsasFromAssignedDistricts,
    fetchMadarsasByIds,
    filterAssignedMadarsas,
    setUserData,
    user,
    // userData intentionally excluded to avoid infinite loops
  ]);

  return (
    <ProtectedRoute requiredRole="inspector">
      <InspectorLayout>
        <div className="p-6 space-y-6">
        {/* Marquee Notice Banner */}
        {recentNotices.length > 0 && (
          <div className="bg-green-600 text-white py-2 sm:py-3 px-4 rounded-lg shadow-md overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 flex-shrink-0 animate-pulse" />
              <span className="text-xs sm:text-sm font-semibold">
                Latest Notices:
              </span>
            </div>
            <div className="relative overflow-hidden">
              <div className="animate-marquee whitespace-nowrap inline-block">
                {[...recentNotices, ...recentNotices].map((notice, index) => (
                  <span
                    key={`${notice.id}-${index}`}
                    className="inline-flex items-center mr-8 sm:mr-12"
                  >
                    <span className="text-sm sm:text-base font-medium">
                      {notice.title}
                    </span>
                    <span className="mx-2 sm:mx-3 text-green-200">•</span>
                    <span className="text-xs sm:text-sm text-green-100">
                      {notice.content?.substring(0, 100)}...
                    </span>
                    {index < recentNotices.length * 2 - 1 && (
                      <span className="mx-3 sm:mx-4 text-green-300">|</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Inspector Dashboard
            </h1>
            <p className="text-gray-600">
              Welcome back, {userData?.name || user?.email}
            </p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assigned Districts */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Assigned Districts
                    </CardTitle>
                    <CardDescription>
                      Search by district, mekhala, madrasa name, or MID
                    </CardDescription>
                  </div>

                  <div className="w-full sm:w-[320px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        value={madarsaSearchTerm}
                        onChange={(e) => setMadarsaSearchTerm(e.target.value)}
                        placeholder="Search..."
                        className="pl-9 pr-9"
                      />
                      {madarsaSearchTerm && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                          onClick={() => setMadarsaSearchTerm("")}
                          aria-label="Clear search"
                        >
                          <X className="h-4 w-4 text-gray-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {madarsasLoading && assignedMadarsas.length === 0 ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : assignedMadarsas.length === 0 ? (
                  <div className="text-center py-8">
                    <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No madarsas assigned yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {madarsaSearchTerm.trim() ? (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600">
                            Results:{" "}
                            <span className="font-medium">
                              {madarsaSearchResults.length}
                            </span>
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setMadarsaSearchTerm("")}
                          >
                            Clear
                          </Button>
                        </div>

                        {madarsaSearchResults.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-gray-500">
                              No matching madarsas found
                            </p>
                          </div>
                        ) : (
                          madarsaSearchResults.map((madarsa, index) => (
                            <div
                              key={madarsa.id}
                              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50"
                            >
                              <div className="w-8 shrink-0 text-center text-2xl font-bold leading-none text-red-600">
                                {index + 1}
                              </div>
                              <div className="flex flex-1 items-center justify-between gap-3">
                                <div>
                                  <h3 className="font-semibold">
                                    {madarsa.name}
                                  </h3>
                                  <p className="text-sm text-gray-600">
                                    {getMadarsaDistrict(madarsa)} •{" "}
                                    {getMadarsaMekhala(madarsa)}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline">
                                      MID: {madarsa.madarsaId}
                                    </Badge>
                                    <Badge
                                      variant={
                                        madarsa.status === "active"
                                          ? "default"
                                          : "secondary"
                                      }
                                    >
                                      {madarsa.status}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {approvedMadarsaIds.has(madarsa.madarsaId) ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      aria-disabled="true"
                                      onClick={showAlreadyInspectedToast}
                                      className="opacity-60 cursor-not-allowed"
                                    >
                                      Already Inspected
                                    </Button>
                                  ) : (
                                    <Button variant="outline" size="sm" asChild>
                                      <Link
                                        href={`/dashboard/inspector/madarsas/${madarsa.madarsaId}`}
                                      >
                                        <Eye className="h-4 w-4 mr-1" />
                                        Inspect
                                      </Link>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </>
                    ) : !selectedDistrict ? (
                      <>
                        {drilldown.districts.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-gray-500">
                              No districts found for your assignment.
                            </p>
                          </div>
                        ) : (
                          drilldown.districts.map((d) => (
                            <button
                              key={d.district}
                              type="button"
                              onClick={() => {
                                setSelectedDistrict(d.district);
                                setSelectedMekhala("");
                              }}
                              className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 text-left"
                            >
                              <div>
                                <h3 className="font-semibold">{d.district}</h3>
                                <p className="text-sm text-gray-600">
                                  {d.madarsaCount} madarsa(s) •{" "}
                                  {d.mekhalas.length} mekhala(s)
                                </p>
                              </div>
                              <Badge variant="outline">Select</Badge>
                            </button>
                          ))
                        )}
                      </>
                    ) : !selectedMekhala ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm text-gray-600">District</p>
                            <p className="font-semibold text-gray-900">
                              {selectedDistrict}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedDistrict("");
                              setSelectedMekhala("");
                            }}
                          >
                            Back
                          </Button>
                        </div>

                        {(
                          drilldown.districts.find(
                            (d) => d.district === selectedDistrict,
                          )?.mekhalas || []
                        ).length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-gray-500">
                              No mekhalas found for this district.
                            </p>
                          </div>
                        ) : (
                          (
                            drilldown.districts.find(
                              (d) => d.district === selectedDistrict,
                            )?.mekhalas || []
                          ).map((mk) => (
                            <button
                              key={mk.mekhala}
                              type="button"
                              onClick={() => setSelectedMekhala(mk.mekhala)}
                              className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 text-left"
                            >
                              <div>
                                <h3 className="font-semibold">{mk.mekhala}</h3>
                                <p className="text-sm text-gray-600">
                                  {mk.madarsas.length} madarsa(s)
                                </p>
                              </div>
                              <Badge variant="outline">Select</Badge>
                            </button>
                          ))
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm text-gray-600">
                              {selectedDistrict} / {selectedMekhala}
                            </p>
                            <p className="font-semibold text-gray-900">
                              Madarsas
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedMekhala("")}
                          >
                            Back
                          </Button>
                        </div>

                        {(
                          drilldown.districts
                            .find((d) => d.district === selectedDistrict)
                            ?.mekhalas.find(
                              (m) => m.mekhala === selectedMekhala,
                            )?.madarsas || []
                        ).length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-gray-500">
                              No madarsas found for this mekhala.
                            </p>
                          </div>
                        ) : (
                          (
                            drilldown.districts
                              .find((d) => d.district === selectedDistrict)
                              ?.mekhalas.find(
                                (m) => m.mekhala === selectedMekhala,
                              )?.madarsas || []
                          ).map((madarsa, index) => (
                            <div
                              key={madarsa.id}
                              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50"
                            >
                              <div className="w-8 shrink-0 text-center text-2xl font-bold leading-none text-red-600">
                                {index + 1}
                              </div>
                              <div className="flex flex-1 items-center justify-between gap-3">
                                <div>
                                  <h3 className="font-semibold">
                                    {madarsa.name}
                                  </h3>
                                  <p className="text-sm text-gray-600">
                                    {madarsa.address}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline">
                                      ID: {madarsa.madarsaId}
                                    </Badge>
                                    <Badge
                                      variant={
                                        madarsa.status === "active"
                                          ? "default"
                                          : "secondary"
                                      }
                                    >
                                      {madarsa.status}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {approvedMadarsaIds.has(madarsa.madarsaId) ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      aria-disabled="true"
                                      onClick={showAlreadyInspectedToast}
                                      className="opacity-60 cursor-not-allowed"
                                    >
                                      Already Inspected
                                    </Button>
                                  ) : (
                                    <Button variant="outline" size="sm" asChild>
                                      <Link
                                        href={`/dashboard/inspector/madarsas/${madarsa.madarsaId}`}
                                      >
                                        <Eye className="h-4 w-4 mr-1" />
                                        Inspect
                                      </Link>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Notices */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Recent Notices
                </CardTitle>
                <CardDescription>Latest announcements</CardDescription>
              </CardHeader>
              <CardContent>
                {recentNotices.length === 0 ? (
                  <div className="text-center py-8">
                    <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No recent notices</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentNotices.map((notice) => (
                      <div
                        key={notice.id}
                        className="p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-semibold text-sm">
                            {notice.title}
                          </h4>
                          <Badge
                            variant={
                              notice.priority === "high"
                                ? "destructive"
                                : notice.priority === "medium"
                                  ? "default"
                                  : "secondary"
                            }
                            className="text-xs"
                          >
                            {notice.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {notice.content}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {notice.createdAt?.toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </InspectorLayout>
    </ProtectedRoute>
  );
}
