import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Build dynamic Firestore query for teachers
 */
export const buildTeacherQuery = (
  filters = {},
  pageSize = 20,
  lastDoc = null
) => {
  const { madarsaId, status } = filters;

  const teachersRef = collection(db, "teachers");
  const constraints = [];

  // Madrasa filter
  if (madarsaId && madarsaId !== "all") {
    constraints.push(where("madarsaId", "==", madarsaId));
  }

  // Status filter
  if (status && status !== "all") {
    constraints.push(where("status", "==", status));
  }

  // Order and pagination
  constraints.push(orderBy("createdAt", "desc"));
  constraints.push(limit(pageSize));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  return query(teachersRef, ...constraints);
};

/**
 * Fetch teachers with server-side filtering and pagination
 */
export const fetchFilteredTeachers = async (
  filters,
  pageSize = 20,
  lastDoc = null
) => {
  const q = buildTeacherQuery(filters, pageSize, lastDoc);
  const snapshot = await getDocs(q);

  // Filter out deleted teachers client-side
  const teachers = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
      };
    })
    .filter((teacher) => !teacher.deleted);

  const lastVisible =
    snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

  return { teachers, lastVisible };
};

/**
 * Search teachers by name, email, or MSR ID across larger dataset
 */
export const searchTeachers = async (
  searchTerm,
  filters = {},
  maxResults = 1000
) => {
  if (!searchTerm || searchTerm.trim() === "") {
    return { teachers: [], total: 0 };
  }

  const { madarsaId, status } = filters;
  const teachersRef = collection(db, "teachers");
  const constraints = [];

  // Madrasa filter
  if (madarsaId && madarsaId !== "all") {
    constraints.push(where("madarsaId", "==", madarsaId));
  }

  // Status filter
  if (status && status !== "all") {
    constraints.push(where("status", "==", status));
  }

  // Fetch all records for client-side searching
  // Removing limit and orderBy ensures we search the entire dataset and don't miss older records

  const q = query(teachersRef, ...constraints);
  const snapshot = await getDocs(q);

  const allTeachers = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
      };
    })
    .filter((teacher) => !teacher.deleted); // Filter deleted client-side

  // Client-side filtering by search term
  const searchLower = searchTerm.toLowerCase();
  const filteredTeachers = allTeachers.filter(
    (teacher) =>
      String(teacher.name || "").toLowerCase().includes(searchLower) ||
      String(teacher.email || "").toLowerCase().includes(searchLower) ||
      String(teacher.mhrId || "").toLowerCase().includes(searchLower) ||
      String(teacher.teacherId || "").toLowerCase().includes(searchLower)
  );

  return {
    teachers: filteredTeachers,
    total: filteredTeachers.length,
  };
};

/**
 * Get total count of teachers using server-side aggregation
 */
export const getTeachersCount = async (filters = {}) => {
  const { madarsaId, status } = filters;
  const teachersRef = collection(db, "teachers");
  const constraints = [];

  if (madarsaId && madarsaId !== "all") {
    constraints.push(where("madarsaId", "==", madarsaId));
  }

  if (status && status !== "all") {
    constraints.push(where("status", "==", status));
  }

  const q = query(teachersRef, ...constraints);
  const snapshot = await getDocs(q);

  // Count non-deleted teachers client-side
  const count = snapshot.docs.filter((doc) => !doc.data().deleted).length;
  return count;
};

/**
 * Fetch madrasas for caching
 */
export const fetchMadrasasMetadata = async () => {
  const madrasasSnap = await getDocs(
    query(collection(db, "madarsas"), orderBy("name", "asc"))
  );

  const madrasas = madrasasSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Create Map for O(1) lookup by ID
  const madrasaMap = new Map(madrasas.map((m) => [m.id, m]));

  return { madrasas, madrasaMap };
};
