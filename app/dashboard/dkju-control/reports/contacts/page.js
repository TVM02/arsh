"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Download, Users, Phone, Search, Loader2, Plus } from "lucide-react";
import { collection, getDocs, query, where, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Pagination } from "@/components/ui/pagination";

import {
  madrasaMatchesDistrict,
  madrasaMatchesMekhala,
} from "@/lib/madrasaHierarchy";
import { SearchableSelect } from "@/components/ui/searchable-select";


const getCleanPhone = (d) => {
  if (!d) return "N/A";
  const isPhone = (val) => {
    const cleaned = val.replace(/\D/g, "");
    return cleaned.length >= 8 && !/[a-zA-Z]/.test(val);
  };
  const candidates = [d.phone, d.phoneNumber, d.mobile, d.guardianPhone, d.loginId, d.email];
  for (const c of candidates) {
    const val = String(c || "").trim();
    if (val && isPhone(val)) return val;
  }
  return "N/A";
};

// Normalize raw madrasa ID to MID-XXXX format
const normalizeMID = (rawId) => {
  if (!rawId) return "";
  const str = String(rawId).trim();
  const numeric = str.replace(/^[a-zA-Z]+-/i, "");
  if (/^\d+$/.test(numeric)) return `MID-${numeric}`;
  return str.toUpperCase();
};

const formatMadrasaOption = (madarsa) => {
  const name = String(madarsa?.name || "UNKNOWN MADRASA").trim();
  const rawId = madarsa?.madarsaId || madarsa?.madrasaId || madarsa?.mid || madarsa?.id || "";
  const mid = normalizeMID(rawId);
  return mid ? `${name} (${mid})` : name;
};


export default function CentralAdminContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filter states
  const [roleFilter, setRoleFilter] = useState("all_students");
  const [mekhalas, setMekhalas] = useState([]);
  const [selectedMekhala, setSelectedMekhala] = useState("all");
  const [subMekhalas, setSubMekhalas] = useState([]);
  const [selectedSubMekhala, setSelectedSubMekhala] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Add Contact states
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", location: "", role: "" });
  const [addingContact, setAddingContact] = useState(false);

  const [selectedMadarsa, setSelectedMadarsa] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");

  const classOptions = ["all", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

  // Madrasas list for lookup mapping
  const [madrasas, setMadrasas] = useState([]);
  const [madrasaMap, setMadrasaMap] = useState(new Map());

  // Refs for metadata to prevent fetchContacts from re-executing on metadata load
  const mekhalasRefState = useRef([]);
  const subMekhalasRefState = useRef([]);
  const madrasasRefState = useRef([]);

  useEffect(() => {
    mekhalasRefState.current = mekhalas;
  }, [mekhalas]);

  useEffect(() => {
    subMekhalasRefState.current = subMekhalas;
  }, [subMekhalas]);

  useEffect(() => {
    madrasasRefState.current = madrasas;
  }, [madrasas]);

  // Load basic metadata once
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [mekhalasSnap, madarsasSnap, districtsSnap] = await Promise.all([
          getDocs(query(collection(db, "mekhala"), orderBy("name", "asc"))),
          getDocs(collection(db, "madarsas")),
          getDocs(query(collection(db, "districts"), orderBy("name", "asc"))),
        ]);

        const mekhData = mekhalasSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMekhalas(mekhData);

        const madrData = madarsasSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        madrData.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setMadrasas(madrData);

        const distData = districtsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSubMekhalas(distData);

        const mMap = new Map();
        madrData.forEach((m) => {
          mMap.set(m.id, m);
          if (m.madarsaId) {
            mMap.set(m.madarsaId, m);
          }
        });
        setMadrasaMap(mMap);
      } catch (error) {
        console.error("Error loading metadata:", error);
        toast.error("Failed to load filter metadata");
      }
    };
    loadMetadata();
  }, []);

  const filteredSubMekhalas = useMemo(() => {
    if (selectedMekhala === "all") return subMekhalas;
    const sourceMekhala = mekhalas.find((m) => m.id === selectedMekhala);
    const allIds = new Set();
    allIds.add(selectedMekhala);
    if (sourceMekhala) {
      mekhalas
        .filter(
          (m) =>
            (m.name || "").toLowerCase().trim() ===
            (sourceMekhala.name || "").toLowerCase().trim()
        )
        .forEach((m) => allIds.add(m.id));
    }
    return subMekhalas.filter((sm) => allIds.has((sm.mekhalaId || "").trim()));
  }, [subMekhalas, selectedMekhala, mekhalas]);

  // Fetch contacts based on roleFilter and selectedMekhala
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const mekhalas = mekhalasRefState.current;
      const subMekhalas = subMekhalasRefState.current;
      const madrasas = madrasasRefState.current;

      const chunk = (array, size) => {
        const result = [];
        for (let i = 0; i < array.length; i += size) {
          result.push(array.slice(i, i + size));
        }
        return result;
      };
      const getMadarsaIds = (items) => {
        const ids = new Set();
        items.forEach((m) => {
          if (m.id) {
            ids.add(String(m.id).trim());
            ids.add(String(m.id).trim().toUpperCase());
            ids.add(String(m.id).trim().toLowerCase());
          }
          if (m.madarsaId) {
            ids.add(String(m.madarsaId).trim());
            ids.add(String(m.madarsaId).trim().toUpperCase());
            ids.add(String(m.madarsaId).trim().toLowerCase());
          }
          if (m.mid) {
            ids.add(String(m.mid).trim());
            ids.add(String(m.mid).trim().toUpperCase());
            ids.add(String(m.mid).trim().toLowerCase());
          }
        });
        return Array.from(ids).filter(Boolean);
      };
      const getDistrictMadrasas = () => {
        const targetDistrict = mekhalas.find((m) => m.id === selectedMekhala);
        const districtName = targetDistrict?.name;
        return madrasas.filter(
          (m) =>
            m.mekhalaId === selectedMekhala ||
            (districtName && madrasaMatchesDistrict(m, districtName)),
        );
      };
      let fetched = [];
      if (roleFilter === "all_students") {
        let q;
        if (searchTerm.trim()) {
          const s = searchTerm.trim();
          let sq = query(collection(db, "students"));
          if (s.includes("@")) {
            sq = query(collection(db, "students"), where("email", "==", s));
          } else if (/^[\d\+]+$/.test(s.replace(/\s/g, "")) && s.length >= 4) {
            sq = query(collection(db, "students"), where("phone", ">=", s), where("phone", "<=", s + "\uf8ff"));
          } else if (s.toLowerCase().startsWith("mid-") || s.toLowerCase().startsWith("mld-")) {
            sq = query(collection(db, "students"), where("admissionNumber", "==", s.toUpperCase()));
          } else {
            const sCap = s.charAt(0).toUpperCase() + s.slice(1);
            sq = query(collection(db, "students"), where("fullName", ">=", sCap), where("fullName", "<=", sCap + "\uf8ff"));
          }
          if (sq) {
            const snap = await getDocs(sq);
            fetched = snap.docs
              .map((doc) => {
                const d = doc.data();
                return {
                  id: doc.id,
                  name: d.fullName || d.studentName || d.name || "N/A",
                  role: "Student",
                  phone: getCleanPhone(d),
                  madarsaId: d.madarsaId || "",
                  mekhalaId: d.mekhalaId || "",
                  secondary: d.classLevel ? `Class ${d.classLevel}` : "N/A",
                  classLevel: d.classLevel || "",
                  deleted: !!d.deleted, mid: d.mid || d.admissionNumber || d.studentId || d.mhrId || d.teacherId || "N/A",
                };
              })
              .filter((s) => !s.deleted);
          }
        } else if (selectedMadarsa !== "all") {
          const targetMad = madrasas.find((m) => m.id === selectedMadarsa || m.madarsaId === selectedMadarsa);
          const targetIds = getMadarsaIds(targetMad ? [targetMad] : []);
          q = query(collection(db, "students"), where("madarsaId", "in", targetIds));
        } else if (selectedSubMekhala !== "all") {
          const targetSubMekhala = subMekhalas.find((sm) => sm.id === selectedSubMekhala);
          const subMekhalaName = targetSubMekhala?.name;
          const matchingMadarasas = madrasas.filter((m) => subMekhalaName && madrasaMatchesMekhala(m, subMekhalaName));
          const madarsaIds = getMadarsaIds(matchingMadarasas);
          if (madarsaIds.length > 0) {
            const chunks = chunk(madarsaIds, 30);
            const promises = chunks.map((c) =>
              getDocs(query(collection(db, "students"), where("madarsaId", "in", c)))
            );
            const snaps = await Promise.all(promises);
            const docs = snaps.flatMap((snap) => snap.docs);
            fetched = docs.map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                name: d.fullName || d.studentName || d.name || "N/A",
                role: "Student",
                phone: getCleanPhone(d),
                madarsaId: d.madarsaId || "",
                mekhalaId: d.mekhalaId || "",
                secondary: d.classLevel ? `Class ${d.classLevel}` : "N/A",
                classLevel: d.classLevel || "",
                deleted: !!d.deleted, mid: d.mid || d.admissionNumber || d.studentId || d.mhrId || d.teacherId || "N/A",
              };
            }).filter((s) => !s.deleted);
          }
        } else if (selectedMekhala !== "all") {
          q = query(collection(db, "students"), where("mekhalaId", "==", selectedMekhala));
        } else if (selectedClass !== "all") {
          q = query(collection(db, "students"), where("classLevel", "==", selectedClass));
        } else {
          q = query(collection(db, "students"));
        }

        if (q && fetched.length === 0) {
          const snap = await getDocs(q);
          fetched = snap.docs
            .map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                name: d.fullName || d.studentName || d.name || "N/A",
                role: "Student",
                phone: getCleanPhone(d),
                madarsaId: d.madarsaId || "",
                mekhalaId: d.mekhalaId || "",
                secondary: d.classLevel ? `Class ${d.classLevel}` : "N/A",
                classLevel: d.classLevel || "",
                deleted: !!d.deleted, mid: d.mid || d.admissionNumber || d.studentId || d.mhrId || d.teacherId || "N/A",
              };
            })
            .filter((s) => !s.deleted);
        }
      } else if (roleFilter === "all_teachers") {
        if (searchTerm.trim()) {
          const s = searchTerm.trim();
          let q = query(collection(db, "teachers"));
          if (s.includes("@")) {
            q = query(collection(db, "teachers"), where("email", "==", s));
          } else if (/^[\d\+]+$/.test(s.replace(/\s/g, "")) && s.length >= 4) {
            q = query(collection(db, "teachers"), where("phone", ">=", s), where("phone", "<=", s + "\uf8ff"));
          } else if (s.toLowerCase().startsWith("msr-")) {
            q = query(collection(db, "teachers"), where("mhrId", "==", s.toUpperCase()));
          } else {
            const sCap = s.charAt(0).toUpperCase() + s.slice(1);
            q = query(collection(db, "teachers"), where("name", ">=", sCap), where("name", "<=", sCap + "\uf8ff"));
          }
          const snap = await getDocs(q);
          fetched = snap.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              name: d.name || "N/A",
              role: "Teacher",
              phone: getCleanPhone(d),
              madarsaId: d.madarsaId || "",
              secondary: d.qualification || d.degree || "N/A",
              deleted: !!d.deleted, mid: d.mid || d.admissionNumber || d.studentId || d.mhrId || d.teacherId || "N/A",
            };
          }).filter((t) => !t.deleted);
        } else if (selectedMadarsa !== "all") {
          const targetMad = madrasas.find((m) => m.id === selectedMadarsa || m.madarsaId === selectedMadarsa);
          const targetIds = getMadarsaIds(targetMad ? [targetMad] : []);
          const q = query(collection(db, "teachers"), where("madarsaId", "in", targetIds));
          const snap = await getDocs(q);
          fetched = snap.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              name: d.name || "N/A",
              role: "Teacher",
              phone: getCleanPhone(d),
              madarsaId: d.madarsaId || "",
              secondary: d.qualification || d.degree || "N/A",
              deleted: !!d.deleted, mid: d.mid || d.admissionNumber || d.studentId || d.mhrId || d.teacherId || "N/A",
            };
          }).filter((t) => !t.deleted);
        } else if (selectedSubMekhala !== "all") {
          const targetSubMekhala = subMekhalas.find((sm) => sm.id === selectedSubMekhala);
          const subMekhalaName = targetSubMekhala?.name;
          const matchingMadarasas = madrasas.filter((m) => subMekhalaName && madrasaMatchesMekhala(m, subMekhalaName));
          const madarsaIds = getMadarsaIds(matchingMadarasas);
          if (madarsaIds.length > 0) {
            const chunks = chunk(madarsaIds, 30);
            const promises = chunks.map((c) =>
              getDocs(query(collection(db, "teachers"), where("madarsaId", "in", c)))
            );
            const snaps = await Promise.all(promises);
            const docs = snaps.flatMap((snap) => snap.docs);
            fetched = docs.map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                name: d.name || "N/A",
                role: "Teacher",
                phone: getCleanPhone(d),
                madarsaId: d.madarsaId || "",
                secondary: d.qualification || d.degree || "N/A",
                deleted: !!d.deleted, mid: d.mid || d.admissionNumber || d.studentId || d.mhrId || d.teacherId || "N/A",
              };
            }).filter((t) => !t.deleted);
          }
        } else if (selectedMekhala !== "all") {
          const matchingMadarsaIds = getMadarsaIds(getDistrictMadrasas());
          if (matchingMadarsaIds.length > 0) {
            const chunks = chunk(matchingMadarsaIds, 30);
            const promises = chunks.map(async (c) => {
              const q = query(
                collection(db, "teachers"),
                where("madarsaId", "in", c)
              );
              const snap = await getDocs(q);
              return snap.docs.map((doc) => {
                const d = doc.data();
                return {
                  id: doc.id,
                  name: d.name || "N/A",
                  role: "Teacher",
                  phone: getCleanPhone(d),
                  madarsaId: d.madarsaId || "",
                  secondary: d.qualification || d.degree || "N/A",
                  deleted: !!d.deleted, mid: d.mid || d.admissionNumber || d.studentId || d.mhrId || d.teacherId || "N/A",
                };
              });
            });
            const results = await Promise.all(promises);
            fetched = results.flat().filter((t) => !t.deleted);
          }
        } else {
          const q = query(collection(db, "teachers"), limit(250));
          const snap = await getDocs(q);
          fetched = snap.docs
            .map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                name: d.name || "N/A",
                role: "Teacher",
                phone: getCleanPhone(d),
                madarsaId: d.madarsaId || "",
                secondary: d.qualification || d.degree || "N/A",
                deleted: !!d.deleted, mid: d.mid || d.admissionNumber || d.studentId || d.mhrId || d.teacherId || "N/A",
              };
            })
            .filter((t) => !t.deleted);
        }
      } else if (roleFilter === "all_sadars") {
        if (searchTerm.trim()) {
          const s = searchTerm.trim();
          let q = query(collection(db, "users"), where("role", "==", "madarsa_admin"), limit(250));
          if (s.includes("@")) {
            q = query(collection(db, "users"), where("role", "==", "madarsa_admin"), where("email", "==", s));
          } else if (/^\d{8,}$/.test(s.replace(/\D/g, ""))) {
            q = query(collection(db, "users"), where("role", "==", "madarsa_admin"), where("phone", "==", s));
          }
          const snap = await getDocs(q);
          fetched = snap.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              name: d.name || d.fullName || "N/A",
              role: "Sadar",
              phone: getCleanPhone(d),
              madarsaId: d.madarsaId || "",
              secondary: "Sadar",
            };
          });
        } else if (selectedMadarsa !== "all") {
          const targetMad = madrasas.find((m) => m.id === selectedMadarsa || m.madarsaId === selectedMadarsa);
          const targetIds = getMadarsaIds(targetMad ? [targetMad] : []);
          const q = query(collection(db, "users"), where("role", "==", "madarsa_admin"), where("madarsaId", "in", targetIds));
          const snap = await getDocs(q);
          fetched = snap.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              name: d.name || d.fullName || "N/A",
              role: "Sadar",
              phone: getCleanPhone(d),
              madarsaId: d.madarsaId || "",
              secondary: "Sadar",
            };
          });
        } else if (selectedSubMekhala !== "all") {
          const targetSubMekhala = subMekhalas.find((sm) => sm.id === selectedSubMekhala);
          const subMekhalaName = targetSubMekhala?.name;
          const matchingMadarasas = madrasas.filter((m) => subMekhalaName && madrasaMatchesMekhala(m, subMekhalaName));
          const madarsaIds = getMadarsaIds(matchingMadarasas);
          if (madarsaIds.length > 0) {
            const chunks = chunk(madarsaIds, 30);
            const promises = chunks.map((c) =>
              getDocs(query(collection(db, "users"), where("role", "==", "madarsa_admin"), where("madarsaId", "in", c)))
            );
            const snaps = await Promise.all(promises);
            const docs = snaps.flatMap((snap) => snap.docs);
            fetched = docs.map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                name: d.name || d.fullName || "N/A",
                role: "Sadar",
                phone: getCleanPhone(d),
                madarsaId: d.madarsaId || "",
                secondary: "Sadar",
              };
            });
          }
        } else if (selectedMekhala !== "all") {
          const matchingMadarsaIds = getMadarsaIds(getDistrictMadrasas());
          if (matchingMadarsaIds.length > 0) {
            const chunks = chunk(matchingMadarsaIds, 30);
            const promises = chunks.map(async (c) => {
              const q = query(
                collection(db, "users"),
                where("role", "==", "madarsa_admin"),
                where("madarsaId", "in", c)
              );
              const snap = await getDocs(q);
              return snap.docs.map((doc) => {
                const d = doc.data();
                return {
                  id: doc.id,
                  name: d.name || d.fullName || "N/A",
                  role: "Sadar",
                  phone: getCleanPhone(d),
                  madarsaId: d.madarsaId || "",
                  secondary: "Sadar",
                };
              });
            });
            const results = await Promise.all(promises);
            fetched = results.flat();
          }
        } else {
          const q = query(collection(db, "users"), where("role", "==", "madarsa_admin"), limit(250));
          const snap = await getDocs(q);
          fetched = snap.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              name: d.name || d.fullName || "N/A",
              role: "Sadar",
              phone: getCleanPhone(d),
              madarsaId: d.madarsaId || "",
              secondary: "Sadar",
            };
          });
        }
      } else if (roleFilter === "all_managers") {
        if (searchTerm.trim()) {
          const s = searchTerm.trim();
          let q = query(collection(db, "managers"), limit(250));
          if (s.includes("@")) {
            q = query(collection(db, "managers"), where("email", "==", s));
          } else if (/^\d{8,}$/.test(s.replace(/\D/g, ""))) {
            q = query(collection(db, "managers"), where("phone", "==", s));
          } else {
            const sCap = s.charAt(0).toUpperCase() + s.slice(1);
            q = query(collection(db, "managers"), where("name", ">=", sCap), where("name", "<=", sCap + "\uf8ff"), limit(250));
          }
          const snap = await getDocs(q);
          fetched = snap.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              name: d.name || "N/A",
              role: "Manager",
              phone: getCleanPhone(d),
              madarsaId: d.madarsaId || "",
              secondary: d.position ? `Manager - ${d.position}` : "Manager",
            };
          });
        } else if (selectedMadarsa !== "all") {
          const targetMad = madrasas.find((m) => m.id === selectedMadarsa || m.madarsaId === selectedMadarsa);
          const targetIds = getMadarsaIds(targetMad ? [targetMad] : []);
          const q = query(collection(db, "managers"), where("madarsaId", "in", targetIds));
          const snap = await getDocs(q);
          fetched = snap.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              name: d.name || "N/A",
              role: "Manager",
              phone: getCleanPhone(d),
              madarsaId: d.madarsaId || "",
              secondary: d.position ? `Manager - ${d.position}` : "Manager",
            };
          });
        } else if (selectedSubMekhala !== "all") {
          const targetSubMekhala = subMekhalas.find((sm) => sm.id === selectedSubMekhala);
          const subMekhalaName = targetSubMekhala?.name;
          const matchingMadarasas = madrasas.filter((m) => subMekhalaName && madrasaMatchesMekhala(m, subMekhalaName));
          const madarsaIds = getMadarsaIds(matchingMadarasas);
          if (madarsaIds.length > 0) {
            const chunks = chunk(madarsaIds, 30);
            const promises = chunks.map((c) =>
              getDocs(query(collection(db, "managers"), where("madarsaId", "in", c)))
            );
            const snaps = await Promise.all(promises);
            const docs = snaps.flatMap((snap) => snap.docs);
            fetched = docs.map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                name: d.name || "N/A",
                role: "Manager",
                phone: getCleanPhone(d),
                madarsaId: d.madarsaId || "",
                secondary: d.position ? `Manager - ${d.position}` : "Manager",
              };
            });
          }
        } else if (selectedMekhala !== "all") {
          const matchingMadarsaIds = getMadarsaIds(getDistrictMadrasas());
          if (matchingMadarsaIds.length > 0) {
            const chunks = chunk(matchingMadarsaIds, 30);
            const promises = chunks.map(async (c) => {
              const q = query(
                collection(db, "managers"),
                where("madarsaId", "in", c)
              );
              const snap = await getDocs(q);
              return snap.docs.map((doc) => {
                const d = doc.data();
                return {
                  id: doc.id,
                  name: d.name || "N/A",
                  role: "Manager",
                  phone: getCleanPhone(d),
                  madarsaId: d.madarsaId || "",
                  secondary: d.position ? `Manager - ${d.position}` : "Manager",
                };
              });
            });
            const results = await Promise.all(promises);
            fetched = results.flat();
          }
        } else {
          const q = query(collection(db, "managers"), limit(250));
          const snap = await getDocs(q);
          fetched = snap.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              name: d.name || "N/A",
              role: "Manager",
              phone: getCleanPhone(d),
              madarsaId: d.madarsaId || "",
              secondary: d.position ? `Manager - ${d.position}` : "Manager",
            };
          });
        }
      } else if (roleFilter === "all_conveners") {
        const [pbSnap, convSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "pariksha_board_convener")),
          getDocs(collection(db, "conveners")),
          getDocs(query(collection(db, "users"), where("role", "in", ["pariksha_board_convener", "convener_admin"]))),
        ]);

        const list = [];
        pbSnap.docs.forEach((doc) => {
          const d = doc.data();
          list.push({
            id: doc.id,
            name: d.name || d.fullName || "N/A",
            role: "Board Convener",
            phone: getCleanPhone(d),
            secondary: "Board Convener",
          });
        });

        convSnap.docs.forEach((doc) => {
          const d = doc.data();
          list.push({
            id: doc.id,
            name: d.name || d.fullName || "N/A",
            role: "Convener Admin",
            phone: getCleanPhone(d),
            secondary: "Convener Admin",
          });
        });

        usersSnap.docs.forEach((doc) => {
          const d = doc.data();
          list.push({
            id: doc.id,
            name: d.name || d.fullName || "N/A",
            role: d.role === "pariksha_board_convener" ? "Board Convener" : "Convener Admin",
            phone: getCleanPhone(d),
            secondary: d.role === "pariksha_board_convener" ? "Board Convener" : "Convener Admin",
          });
        });

        const seen = new Set();
        fetched = list.filter((item) => {
          const cleanPhone = String(item.phone || "").replace(/\D/g, "");
          const key = cleanPhone && cleanPhone.length >= 8 ? cleanPhone : item.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      } else if (roleFilter === "all_mekhala") {
        const [distSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "districts")),
          getDocs(query(collection(db, "users"), where("role", "==", "mekhala_admin"))),
        ]);

        const list = [];
        const mekhMap = new Map(mekhalas.map((m) => [m.id, m.name]));

        distSnap.docs.forEach((doc) => {
          const d = doc.data();
          list.push({
            id: doc.id,
            name: d.name || "N/A",
            role: "Mekhala Owner",
            phone: getCleanPhone(d),
            mekhalaId: d.mekhalaId || "",
            secondary: mekhMap.get(d.mekhalaId) || d.mekhalaId || "N/A",
          });
        });

        usersSnap.docs.forEach((doc) => {
          const d = doc.data();
          if (d.portalType === "mekhala_portal" || d.mekhalaDocType === "sub_mekhala") {
            list.push({
              id: doc.id,
              name: d.name || d.fullName || "N/A",
              role: "Mekhala Owner",
              phone: getCleanPhone(d),
              mekhalaId: d.mekhalaId || "",
              secondary: d.mekhalaName || d.name || "N/A",
            });
          }
        });

        const seen = new Set();
        fetched = list.filter((item) => {
          const cleanPhone = String(item.phone || "").replace(/\D/g, "");
          const key = cleanPhone && cleanPhone.length >= 8 ? cleanPhone : item.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      } else if (roleFilter === "all_district") {
        const [mekhSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "mekhala")),
          getDocs(query(collection(db, "users"), where("role", "==", "mekhala_admin"))),
        ]);

        const list = [];
        mekhSnap.docs.forEach((doc) => {
          const d = doc.data();
          list.push({
            id: doc.id,
            name: d.name || "N/A",
            role: "District Owner",
            phone: getCleanPhone(d),
            mekhalaId: doc.id,
            secondary: d.name || "N/A",
          });
        });

        usersSnap.docs.forEach((doc) => {
          const d = doc.data();
          if (d.portalType !== "mekhala_portal" && d.mekhalaDocType !== "sub_mekhala") {
            list.push({
              id: doc.id,
              name: d.name || d.fullName || "N/A",
              role: "District Owner",
              phone: getCleanPhone(d),
              mekhalaId: doc.id,
              secondary: d.district || d.mekhalaName || "N/A",
            });
          }
        });

        const seen = new Set();
        fetched = list.filter((item) => {
          const cleanPhone = String(item.phone || "").replace(/\D/g, "");
          const key = cleanPhone && cleanPhone.length >= 8 ? cleanPhone : item.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      // Fetch manual directory_contacts for all filters
      try {
        const manualSnap = await getDocs(collection(db, "directory_contacts"));
        manualSnap.docs.forEach((doc) => {
          const d = doc.data();
          const r = String(d.role || "").toLowerCase().trim();
          
          let shouldAdd = false;
          if (roleFilter === "all_contacts" || roleFilter === "all_others") {
            shouldAdd = true;
          }

          if (shouldAdd) {
            if (searchTerm.trim()) {
              const term = searchTerm.trim().toLowerCase();
              const n = String(d.name || "").toLowerCase();
              const p = String(d.phone || "").toLowerCase();
              const l = String(d.location || "").toLowerCase();
              const ro = String(d.role || "").toLowerCase();
              if (!n.includes(term) && !p.includes(term) && !l.includes(term) && !ro.includes(term)) {
                return; // skip adding if it doesn't match search
              }
            }
            fetched.push({
              id: doc.id,
              name: d.name || "N/A",
              role: (d.role || "Other").charAt(0).toUpperCase() + String(d.role || "").slice(1).toLowerCase(),
              phone: getCleanPhone(d),
              secondary: d.location || "N/A",
              madarsaId: "",
              createdAt: d.createdAt?.toMillis?.() || (d.createdAt ? new Date(d.createdAt).getTime() : 0) || 0,
            });
          }
        });
      } catch (err) {
        console.error("Error fetching manual contacts:", err);
      }

      setContacts(fetched);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error("Failed to load contacts data");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, selectedMekhala, selectedSubMekhala, selectedMadarsa, selectedClass, searchTerm]);

  // Trigger fetch when filters change
  useEffect(() => {
    fetchContacts();
  }, [roleFilter, selectedMekhala, selectedSubMekhala, selectedMadarsa, selectedClass, searchTerm, fetchContacts]);

  // Reset other filters when role filter changes
  useEffect(() => {
    setSelectedSubMekhala("all");
    setSelectedMadarsa("all");
    setSelectedClass("all");
    setCurrentPage(1);
  }, [roleFilter]);

  // Reset madarsa and sub-mekhala when selected mekhala (district) changes
  useEffect(() => {
    setSelectedSubMekhala("all");
    setSelectedMadarsa("all");
    setCurrentPage(1);
  }, [selectedMekhala]);

  // Reset page index when search, class, or sub-mekhala filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedClass, selectedMadarsa, selectedSubMekhala]);

  // Filtered madrasas for searchable dropdown
  // SearchableSelect handles its own internal search, so we only filter by the
  // selected mekhala/sub-mekhala cascading hierarchy here.
  const filteredMadrasasForDropdown = useMemo(() => {
    let list = [...madrasas];
    if (selectedMekhala !== "all") {
      const targetMekhala = mekhalas.find((m) => m.id === selectedMekhala);
      const mekhalaName = targetMekhala?.name;
      list = list.filter(
        (m) =>
          m.mekhalaId === selectedMekhala ||
          (mekhalaName && madrasaMatchesDistrict(m, mekhalaName))
      );
    }
    if (selectedSubMekhala !== "all") {
      const targetSubMekhala = subMekhalas.find((sm) => sm.id === selectedSubMekhala);
      const subMekhalaName = targetSubMekhala?.name;
      if (subMekhalaName) {
        list = list.filter((m) => madrasaMatchesMekhala(m, subMekhalaName));
      }
    }
    return list;
  }, [madrasas, selectedMekhala, mekhalas, selectedSubMekhala, subMekhalas]);


  const getMadrasaName = (madarsaId) => {
    const name = madrasaMap.get(madarsaId)?.name;
    if (name) return name;
    return madarsaId ? "Unknown Madrasa" : "N/A";
  };

  const formatMID = (madarsaId) => {
    if (!madarsaId) return "N/A";
    const idStr = String(madarsaId).trim();
    // If already formatted like mid-XXXX or MID-XXXX, normalize to MID-XXXX
    const numericPart = idStr.replace(/^[a-zA-Z]+-/i, "");
    if (/^\d+$/.test(numericPart)) return `MID-${numericPart}`;
    return idStr.toUpperCase();
  };

  const getMadrasaDisplay = (madarsaId) => {
    const madrasa = madrasaMap.get(madarsaId);
    const name = madrasa?.name || "";
    const mid = formatMID(madrasa?.madarsaId || madarsaId);
    if (name) return `${name} (${mid})`;
    return mid;
  };

  // Apply search & filters client-side
  useEffect(() => {
    let result = [...contacts];

    // Filter by Mekhala/District if selected
    if (selectedMekhala !== "all") {
      const targetMekhala = mekhalas.find((m) => m.id === selectedMekhala);
      const mekhalaName = targetMekhala?.name;

      result = result.filter((c) => {
        if (c.role === "Student" || c.role === "Teacher" || c.role === "Sadar" || c.role === "Manager") {
          if (c.role === "Student" && c.mekhalaId === selectedMekhala) return true;
          
          const cMidStr = String(c.madarsaId || "").toLowerCase();
          const madarsa = madrasas.find((m) => 
            String(m.id).toLowerCase() === cMidStr || 
            String(m.madarsaId).toLowerCase() === cMidStr ||
            String(m.mid || "").toLowerCase() === cMidStr
          );
          if (!madarsa) return false;

          return (
            madarsa.mekhalaId === selectedMekhala ||
            (mekhalaName && madrasaMatchesDistrict(madarsa, mekhalaName))
          );
        }

        if (c.role === "Mekhala Owner" || c.role === "District Owner") {
          return (
            c.mekhalaId === selectedMekhala ||
            c.id === selectedMekhala ||
            (mekhalaName &&
              c.secondary?.toLowerCase().includes(mekhalaName.toLowerCase()))
          );
        }

        return false;
      });
    }

    // Filter by Sub-Mekhala if selected
    if (selectedSubMekhala !== "all") {
      const targetSubMekhala = subMekhalas.find((sm) => sm.id === selectedSubMekhala);
      const subMekhalaName = targetSubMekhala?.name;

      result = result.filter((c) => {
        if (c.role === "Student" || c.role === "Teacher" || c.role === "Sadar" || c.role === "Manager") {
          const cMidStr = String(c.madarsaId || "").toLowerCase();
          const madarsa = madrasas.find((m) => 
            String(m.id).toLowerCase() === cMidStr || 
            String(m.madarsaId).toLowerCase() === cMidStr ||
            String(m.mid || "").toLowerCase() === cMidStr
          );
          if (!madarsa) return false;

          return subMekhalaName && madrasaMatchesMekhala(madarsa, subMekhalaName);
        }
        return false;
      });
    }

    // Filter by Madrasa if selected
    if (selectedMadarsa !== "all") {
      const targetMad = madrasas.find((m) => m.id === selectedMadarsa || m.madarsaId === selectedMadarsa);
      const targetMids = new Set(
        [targetMad?.id, targetMad?.madarsaId, targetMad?.mid].filter(Boolean).map(String).map(s => s.toLowerCase())
      );

      result = result.filter((c) => {
        if (c.role === "Student" || c.role === "Teacher" || c.role === "Sadar" || c.role === "Manager") {
          const cMid = String(c.madarsaId || "").toLowerCase();
          if (targetMids.has(cMid)) return true;
          const cleanCMid = cMid.replace(/^[a-zA-Z]+-/, "");
          return Array.from(targetMids).some((tId) => {
            const cleanTId = tId.replace(/^[a-zA-Z]+-/, "");
            return cleanTId && cleanCMid && cleanTId === cleanCMid;
          });
        }
        return false;
      });
    }

    // Filter by Class if selected (only applies to Students)
    if (selectedClass !== "all") {
      result = result.filter((c) => {
        if (c.role === "Student") {
          return String(c.classLevel) === String(selectedClass);
        }
        return false;
      });
    }

    // Search filter
    if (searchTerm.trim() !== "") {
      const s = searchTerm.toLowerCase();
      result = result.filter((c) => {
        const madrasaName =
          c.madarsaId && (c.role === "Student" || c.role === "Teacher" || c.role === "Sadar" || c.role === "Manager" || c.role === "Manager")
            ? getMadrasaName(c.madarsaId)
            : "";

        return (
          (c.name || "").toLowerCase().includes(s) ||
          (c.role || "").toLowerCase().includes(s) ||
          (c.phone || "").toLowerCase().includes(s) ||
          (c.email || "").toLowerCase().includes(s) ||
          (c.madarsaId || "").toLowerCase().includes(s) ||
          (c.secondary || "").toLowerCase().includes(s) ||
          (c.mid || "").toLowerCase().includes(s) ||
          (c.location || "").toLowerCase().includes(s) ||
          madrasaName.toLowerCase().includes(s)
        );
      });
    }

    // Sort newly added manual contacts to the top
    result.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt || 0);
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt || 0);
      return timeB - timeA;
    });

    setFilteredContacts(result);
  }, [contacts, selectedMekhala, selectedSubMekhala, selectedMadarsa, selectedClass, searchTerm, mekhalas, subMekhalas, madrasas]);

  // Paginated contacts for current view page
  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredContacts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredContacts, currentPage, itemsPerPage]);

  // Exports
  const handleDownloadCSV = () => {
    if (filteredContacts.length === 0) {
      toast.info("No contacts to export");
      return;
    }

    const headers = [
      "Name",
      "Role",
      "Contact Number",
      "Class",
      "Madrasa Number",
      "Institution / Zone Info"
    ];
    const rows = filteredContacts.map((c) => [
      c.name,
      c.role,
      c.phone || "N/A",
      c.role === "Student" ? (c.secondary || "N/A") : "N/A",
      c.madarsaId && (c.role === "Student" || c.role === "Teacher" || c.role === "Sadar" || c.role === "Manager") ? (c.madarsaId || "N/A") : "N/A",
      c.madarsaId && (c.role === "Student" || c.role === "Teacher" || c.role === "Sadar" || c.role === "Manager")
        ? getMadrasaName(c.madarsaId)
        : (c.secondary || "N/A"),
    ]);

    const csvContent = [headers, ...rows]
      .map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `contacts_directory_${roleFilter}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Downloaded Successfully");
  };

  const handleDownloadPDF = async () => {
    if (filteredContacts.length === 0) {
      toast.info("No contacts to export");
      return;
    }
    
    let toastId = toast.loading("Generating PDF report...");
    try {
      const doc = new jsPDF("landscape");
      
      const loadImage = (src) => new Promise((resolve) => {
        const img = document.createElement("img");
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });

      const logoImg = await loadImage("/logo.png");
      if (logoImg) {
        doc.addImage(logoImg, "PNG", 14, 10, 20, 20);
      }
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(15, 118, 110);
      doc.text("DKJU Central Control", 40, 18);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      const titleType = roleFilter === "all" ? "All Contacts" : roleFilter.replace("all_", "").toUpperCase();
      doc.text(`Contact Directory - ${titleType}`, 40, 26);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, 235, 26);

      const tableColumn = [
        "S.No",
        "Name",
        "Role",
        "Contact Number",
        "Class",
        "Madrasa Number",
        "Institution / Zone Info"
      ];
      
      const tableRows = filteredContacts.map((c, index) => [
        index + 1,
        c.name,
        c.role,
        c.phone || "N/A",
        c.role === "Student" ? (c.secondary || "N/A") : "N/A",
        c.madarsaId && (c.role === "Student" || c.role === "Teacher" || c.role === "Sadar" || c.role === "Manager") ? (c.madarsaId || "N/A") : "N/A",
        c.madarsaId && (c.role === "Student" || c.role === "Teacher" || c.role === "Sadar" || c.role === "Manager")
          ? getMadrasaName(c.madarsaId)
          : (c.secondary || "N/A"),
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2, textColor: [40, 40, 40], overflow: "linebreak", font: "helvetica" },
        headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold", halign: "center", valign: "middle" },
        columnStyles: {
          0: { halign: "center", cellWidth: 15 },
          1: { halign: "left" },
          2: { halign: "center", cellWidth: 30 },
          3: { halign: "center", cellWidth: 40 },
          4: { halign: "center", cellWidth: 20 },
          5: { halign: "center", cellWidth: 35 },
          6: { halign: "left" }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 35, left: 10, right: 10 }
      });

      doc.save(`contacts_directory_${roleFilter}.pdf`);
      toast.success("PDF Downloaded Successfully", { id: toastId });
    } catch (e) {
      console.error("PDF Export error:", e);
      toast.error("Failed to generate PDF", { id: toastId });
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!newContact.name.trim() || !newContact.phone.trim() || !newContact.role.trim() || !newContact.location.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setAddingContact(true);
    try {
      await addDoc(collection(db, "directory_contacts"), {
        ...newContact,
        createdAt: serverTimestamp()
      });
      toast.success("Contact added successfully");
      setIsAddContactOpen(false);
      setNewContact({ name: "", phone: "", location: "", role: "" });
      fetchContacts();
    } catch (error) {
      console.error("Error adding contact:", error);
      toast.error("Failed to add contact");
    } finally {
      setAddingContact(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="h-8 w-8 text-teal-600" />
              Contact Directory
            </h1>
            <p className="text-slate-600 mt-1">
              Query and export contact details for students, teachers, sadars, and admins.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadCSV}
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button
              onClick={handleDownloadPDF}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white ml-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-white">
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddContact} className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium">Name *</label>
                    <Input
                      value={newContact.name}
                      onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                      required
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Phone Number *</label>
                    <Input
                      value={newContact.phone}
                      onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                      required
                      placeholder="9876543210"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Location *</label>
                    <Input
                      value={newContact.location}
                      onChange={(e) => setNewContact({...newContact, location: e.target.value})}
                      required
                      placeholder="City/District"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Role *</label>
                    <Input
                      value={newContact.role}
                      onChange={(e) => setNewContact({...newContact, role: e.target.value})}
                      required
                      placeholder="e.g. Volunteer, Donor"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddContactOpen(false)} disabled={addingContact}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addingContact} className="bg-blue-600 hover:bg-blue-700">
                      {addingContact ? "Adding..." : "Add Contact"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filter Panel */}
        <Card className="relative z-20 border border-slate-200 shadow-sm bg-white/50 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {/* Role Select */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Role Section</label>
                <SearchableSelect
                  value={roleFilter}
                  onValueChange={setRoleFilter}
                  placeholder="Select Role"
                  searchPlaceholder="Search role..."
                  options={[
                    { label: "ALL CONTACTS (DIRECTORY)", value: "all_contacts" },
                    { label: "ALL STUDENTS", value: "all_students" },
                    { label: "ALL TEACHERS", value: "all_teachers" },
                    { label: "ALL SADARS", value: "all_sadars" },
                    { label: "ALL MANAGERS", value: "all_managers" },
                    { label: "ALL CONVENERS", value: "all_conveners" },
                    { label: "ALL MEKHALAS", value: "all_mekhala" },
                    { label: "ALL DISTRICTS", value: "all_district" },
                    { label: "ALL OTHERS", value: "all_others" },
                  ]}
                  showAllOption={false}
                  triggerClassName="w-full bg-white border-slate-200 text-slate-900"
                  selectedClassName="bg-teal-50 text-teal-700 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Filter by District</label>
                <SearchableSelect
                  value={selectedMekhala}
                  onValueChange={setSelectedMekhala}
                  placeholder="All Districts"
                  searchPlaceholder="Search district..."
                  options={mekhalas.map(m => ({ label: m.name, value: m.id }))}
                  allOptionText="All Districts"
                  showAllOption={true}
                  triggerClassName="w-full bg-white border-slate-200 text-slate-900"
                  selectedClassName="bg-teal-50 text-teal-700 font-medium"
                />
              </div>

              {/* Mekhala Select (Only for Students, Teachers, Sadars, Managers) */}
              {(roleFilter === "all_students" || roleFilter === "all_teachers" || roleFilter === "all_sadars" || roleFilter === "all_managers") && (
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Filter by Mekhala</label>
                  <SearchableSelect
                    value={selectedSubMekhala}
                    onValueChange={setSelectedSubMekhala}
                    placeholder="All Mekhalas"
                    searchPlaceholder="Search mekhala..."
                    options={filteredSubMekhalas.map(sm => ({ label: sm.name, value: sm.id }))}
                    allOptionText="All Mekhalas"
                    showAllOption={true}
                    triggerClassName="w-full bg-white border-slate-200 text-slate-900"
                    selectedClassName="bg-teal-50 text-teal-700 font-medium"
                  />
                </div>
              )}

              {(roleFilter === "all_students" || roleFilter === "all_teachers" || roleFilter === "all_sadars" || roleFilter === "all_managers") && (
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Filter by Madrasa</label>
                  <SearchableSelect
                    value={selectedMadarsa}
                    onValueChange={(val) => {
                      setSelectedMadarsa(val);
                      setCurrentPage(1);
                    }}
                    placeholder="All Madrasas"
                    searchPlaceholder="Search by name or MID..."
                    options={filteredMadrasasForDropdown}
                    getOptionLabel={(m) => m.name || "UNKNOWN"}
                    getOptionValue={(m) => m.id || m.madarsaId}
                    getOptionSearchText={(m) =>
                      `${m.name || ""} ${normalizeMID(m.madarsaId || m.mid || m.id)}`
                    }
                    allOptionText="All Madrasas"
                    emptyText="No madrasas found"
                    showAllOption={true}
                    triggerClassName="w-full bg-white border-slate-200 text-slate-900"
                    selectedClassName="bg-teal-50 text-teal-700 font-medium"
                  />
                </div>
              )}

              {/* Class Filter (Only for Students) */}
              {roleFilter === "all_students" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Filter by Class</label>
                  <SearchableSelect
                    value={selectedClass}
                    onValueChange={setSelectedClass}
                    placeholder="All Classes"
                    searchPlaceholder="Search class..."
                    options={classOptions.slice(1).map(cls => ({ label: `Class ${cls}`, value: cls }))}
                    allOptionText="ALL CLASSES"
                    showAllOption={true}
                    triggerClassName="w-full bg-white border-slate-200 text-slate-900"
                    selectedClassName="bg-teal-50 text-teal-700 font-medium"
                  />
                </div>
              )}

              {/* Search */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Search Name/Phone</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white border-slate-200"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Directory Table */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between py-4 gap-2">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Contacts list ({filteredContacts.length} found)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="h-10 w-10 animate-spin text-teal-600 mb-2" />
                Loading contacts...
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                No contacts found matching the filters.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold text-slate-700">Name</TableHead>
                        <TableHead className="font-bold text-slate-700">Role</TableHead>
                        <TableHead className="font-bold text-slate-700">Phone Number</TableHead>
                        <TableHead className="font-bold text-slate-700">Madrasa ID</TableHead>
                        <TableHead className="font-bold text-slate-700">Location / Info</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedContacts.map((c) => (
                        <TableRow key={`${c.role}-${c.id}`} className="hover:bg-slate-50/50">
                          <TableCell className="font-medium text-slate-900">{c.name}</TableCell>
                          <TableCell className="text-slate-600">{c.role}</TableCell>
                          <TableCell className="text-slate-900 font-mono tracking-tight flex items-center gap-1.5 mt-1">
                            {c.phone && c.phone !== "N/A" ? (
                              <>
                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                                {c.phone}
                              </>
                            ) : (
                              <span className="text-slate-400 italic text-sm font-sans">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600 font-mono text-xs">
                            {c.madarsaId && (c.role === "Student" || c.role === "Teacher" || c.role === "Sadar" || c.role === "Manager") ? (
                              <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium border border-amber-100">
                                {formatMID(madrasaMap.get(c.madarsaId)?.madarsaId || c.madarsaId)}
                              </span>
                            ) : (
                              "N/A"
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600 font-medium">
                            {c.madarsaId && (c.role === "Student" || c.role === "Teacher" || c.role === "Sadar" || c.role === "Manager") ? (
                              getMadrasaName(c.madarsaId)
                            ) : (
                              c.secondary || "N/A"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-4 border-t border-slate-100">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(filteredContacts.length / itemsPerPage)}
                    onPageChange={setCurrentPage}
                    itemsPerPage={itemsPerPage}
                    totalItems={filteredContacts.length}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
