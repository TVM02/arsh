"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  canonicalDistrictName,
  canonicalMekhalaName,
  madrasaMatchesDistrict,
  madrasaMatchesMekhala,
} from "@/lib/madrasaHierarchy";

export default function TestCountPage() {
  const [madarsas, setMadarsas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const snap = await getDocs(collection(db, "madarsas"));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMadarsas(list);
        setLoading(false);
      } catch (err) {
        setError(err.message || String(err));
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div>Loading madarsas...</div>;
  if (error) return <div>Error: {error}</div>;

  const getUniqueMadarsaKey = (m) =>
    String(m?.madarsaId || m?.id || "")
      .trim()
      .toLowerCase();

  const uniqueMadarsas = (list) => {
    const seen = new Set();
    return list.filter((m) => {
      const key = getUniqueMadarsaKey(m);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // 1. How the districts portal counts them
  // For Thiruvananthapuram:
  // In districts portal:
  const thiruvananthapuramDistrictName = "Thiruvananthapuram";
  const canonDist = thiruvananthapuramDistrictName.toLowerCase().trim();

  // The districts management page has "selectedMekhala" representing the District,
  // and loop over child districts (which represent mekhalas).
  // So all matching Thiruvananthapuram district are:
  const districtsPortalMatches = madarsas.filter((m) => {
    // districtName here is the mekhala name, which can be any of the child mekhalas of Thiruvananthapuram.
    // Wait, let's see if the districts portal only matches if it belongs to one of Thiruvananthapuram's mekhalas.
    // In districts portal:
    // If we count all madarsas matching Thiruvananthapuram:
    if (!madrasaMatchesDistrict(m, "Thiruvananthapuram")) return false;
    return true;
  });

  const uniquePortalMatches = uniqueMadarsas(districtsPortalMatches);

  // Let's filter like getMadrasasForDistrict does:
  // Thiruvananthapuram has 11 mekhalas. Let's see if there are any that don't match any mekhala!
  const mekhalasOfTrivandrum = [
    "Thiruvananthapuram",
    "Kaniyapuram",
    "Nedumangad",
    "Venjaramoodu",
    "Varkala",
    "Kilimanoor",
    "Attingal",
    "Neyyattinkara",
    "Balaramapuram",
    "Kattakada",
    "Malayinkeezhu"
  ];

  const matchedByMekhalaGroup = uniquePortalMatches.filter((m) => {
    const storedRaw = (m.district || m.districtName || "").trim();
    const storedCanon = (canonicalMekhalaName(storedRaw) || storedRaw)
      .toLowerCase()
      .trim();
    return mekhalasOfTrivandrum.some(mek => mek.toLowerCase().trim() === storedCanon);
  });

  // Let's find the ones that are in uniquePortalMatches but NOT in matchedByMekhalaGroup
  const notInAnyMekhala = uniquePortalMatches.filter(m => !matchedByMekhalaGroup.includes(m));

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Thiruvananthapuram Madrasa Counts Analysis</h1>
      <p id="total-raw-count">Total Raw Madrasas: {madarsas.length}</p>
      <p id="district-matches-count">
        Unique madrasaMatchesDistrict(&apos;Thiruvananthapuram&apos;) count: {uniquePortalMatches.length}
      </p>
      <p id="mekhala-group-count">
        Unique matching one of the 11 mekhalas count: {matchedByMekhalaGroup.length}
      </p>

      <h2>Madarsas not matching any of the 11 mekhalas (Count: {notInAnyMekhala.length})</h2>
      <ul id="not-in-mekhala-list">
        {notInAnyMekhala.map((m) => (
          <li key={m.id}>
            [{m.madarsaId || "no id"}] <strong>{m.name || "no name"}</strong> |
            district/mekhala fields:
            district: &quot;{m.district}&quot;, districtName: &quot;{m.districtName}&quot;,
            mekhala: &quot;{m.mekhala}&quot;, mekhalaName: &quot;{m.mekhalaName}&quot;, mehkala: &quot;{m.mehkala}&quot;
          </li>
        ))}
      </ul>

      <h2>All Unique Thiruvananthapuram District Madarsas (Count: {uniquePortalMatches.length})</h2>
      <table border="1" cellPadding="5" style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>ID / Doc ID</th>
            <th>Name</th>
            <th>district</th>
            <th>districtName</th>
            <th>mekhala</th>
            <th>mekhalaName</th>
            <th>mehkala</th>
          </tr>
        </thead>
        <tbody id="all-matched-tbody">
          {uniquePortalMatches.map((m) => {
            const isMatchedMekhala = mekhalasOfTrivandrum.some(mek => 
              mek.toLowerCase().trim() === (canonicalMekhalaName(m.district || m.districtName || "") || m.district || m.districtName || "").toLowerCase().trim()
            );
            return (
              <tr key={m.id} style={{ backgroundColor: isMatchedMekhala ? "#f0fff0" : "#fff0f0" }}>
                <td>{m.madarsaId} / {m.id}</td>
                <td>{m.name}</td>
                <td>{m.district}</td>
                <td>{m.districtName}</td>
                <td>{m.mekhala}</td>
                <td>{m.mekhalaName}</td>
                <td>{m.mehkala}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
