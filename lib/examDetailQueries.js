import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  documentId,
  getCountFromServer,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "./firestoreService";
import { DISTRICT_ORDER, canonicalDistrictName } from "./madrasaHierarchy";

/**
 * Fetch 20 registration IDs for a specific exam with filters
 */
export const fetchExamRegistrationIds = async (
  examId,
  filters = {},
  pageSize = 20,
  lastDoc = null,
) => {
  const { classLevel, madarsaId, gender, searchTerm, page } = filters;

  // If search term is present, use client-side filtering
  if (searchTerm && searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase().trim();

    // Fetch ALL registrations for this exam (with other filters applied)
    const registrationsRef = collection(db, COLLECTIONS.EXAM_REGISTRATIONS);
    const constraints = [where("examId", "==", examId)];

    if (classLevel && classLevel !== "all") {
      constraints.push(where("classLevel", "==", classLevel));
    }

    if (madarsaId && madarsaId !== "all") {
      constraints.push(where("madarsaId", "==", madarsaId));
    }

    // Order by hall ticket number
    // constraints.push(orderBy("hallTicketNumber", "asc"));

    const q = query(registrationsRef, ...constraints);
    const snapshot = await getDocs(q);

    let allRegistrations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter in JS
    allRegistrations = allRegistrations.filter((reg) => {
      return (
        (reg.studentName &&
          reg.studentName.toLowerCase().includes(searchLower)) ||
        (reg.admissionNumber &&
          reg.admissionNumber.toString().toLowerCase().includes(searchLower)) ||
        (reg.hallTicketNumber &&
          reg.hallTicketNumber
            .toString()
            .toLowerCase()
            .includes(searchLower)) ||
        (reg.studentEmail &&
          reg.studentEmail.toLowerCase().includes(searchLower)) ||
        (reg.studentPhone && reg.studentPhone.includes(searchLower))
      );
    });

    // Sort by hallTicketNumber
    allRegistrations.sort((a, b) => {
      const htA = a.hallTicketNumber || "";
      const htB = b.hallTicketNumber || "";
      return htA.localeCompare(htB, undefined, { numeric: true });
    });

    // Pagination
    const currentPage = page || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedRegistrations = allRegistrations.slice(startIndex, endIndex);

    return { registrations: paginatedRegistrations, lastVisible: null };
  }

  const registrationsRef = collection(db, COLLECTIONS.EXAM_REGISTRATIONS);
  const constraints = [where("examId", "==", examId)];

  // Server-side filters
  if (classLevel && classLevel !== "all") {
    constraints.push(where("classLevel", "==", classLevel));
  }

  if (madarsaId && madarsaId !== "all") {
    constraints.push(where("madarsaId", "==", madarsaId));
  }

  // Order and pagination
  constraints.push(orderBy("hallTicketNumber", "asc"));
  constraints.push(limit(pageSize));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(registrationsRef, ...constraints);
  const snapshot = await getDocs(q);

  const registrations = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const lastVisible =
    snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

  return { registrations, lastVisible };
};

/**
 * Fetch student documents by IDs (batch fetch)
 */
export const fetchStudentsByIds = async (studentIds) => {
  if (!studentIds || studentIds.length === 0) {
    return [];
  }

  // Firestore 'in' query supports max 10 items, so batch if needed
  const batchSize = 10;
  const batches = [];

  for (let i = 0; i < studentIds.length; i += batchSize) {
    const batch = studentIds.slice(i, i + batchSize);
    const studentsRef = collection(db, COLLECTIONS.STUDENTS);
    const q = query(studentsRef, where(documentId(), "in", batch));
    const snapshot = await getDocs(q);

    const students = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    batches.push(...students);
  }

  return batches;
};

/**
 * Fetch unregistered students for an exam with server-side filtering
 */
export const fetchUnregisteredStudents = async (
  examId,
  filters = {},
  pageSize = 20,
  lastDoc = null,
) => {
  const { classLevel, madarsaId, gender, searchTerm, page } = filters;

  // First, get all registered student IDs for this exam
  const registrationsRef = collection(db, COLLECTIONS.EXAM_REGISTRATIONS);
  const regQuery = query(registrationsRef, where("examId", "==", examId));
  const regSnapshot = await getDocs(regQuery);
  const registeredStudentIds = regSnapshot.docs.map(
    (doc) => doc.data().studentId,
  );

  // Build student query with filters
  const studentsRef = collection(db, COLLECTIONS.STUDENTS);
  const constraints = [where("status", "==", "active")];

  // Server-side filters
  if (classLevel && classLevel !== "all") {
    constraints.push(where("classLevel", "==", classLevel));
  }

  if (madarsaId && madarsaId !== "all") {
    constraints.push(where("madarsaId", "==", madarsaId));
  }

  if (gender && gender !== "all") {
    constraints.push(where("gender", "==", gender));
  }

  // If search term is present, use client-side filtering
  if (searchTerm && searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase().trim();
    console.log(`[fetchUnregisteredStudents] Searching for: "${searchLower}"`);

    // Fetch ALL matching students (no limit)
    // Removed orderBy to avoid requiring composite indexes for every filter combination
    // constraints.push(orderBy("fullName", "asc"));
    const q = query(studentsRef, ...constraints);
    const snapshot = await getDocs(q);

    console.log(
      `[fetchUnregisteredStudents] Fetched ${snapshot.docs.length} total students for filtering`,
    );

    let allStudents = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(
        (student) =>
          !student.deleted && !registeredStudentIds.includes(student.id),
      );

    console.log(
      `[fetchUnregisteredStudents] ${allStudents.length} students after excluding registered (${registeredStudentIds.length})`,
    );

    // Filter in JS
    allStudents = allStudents.filter((student) => {
      const match =
        (student.fullName &&
          student.fullName.toLowerCase().includes(searchLower)) ||
        (student.admissionNumber &&
          student.admissionNumber
            .toString()
            .toLowerCase()
            .includes(searchLower)) ||
        (student.email && student.email.toLowerCase().includes(searchLower)) ||
        (student.phone && student.phone.includes(searchLower));
      return match;
    });

    console.log(
      `[fetchUnregisteredStudents] ${allStudents.length} students match search term`,
    );

    // Sort by fullName
    allStudents.sort((a, b) =>
      (a.fullName || "").localeCompare(b.fullName || ""),
    );

    // Pagination
    const currentPage = page || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedStudents = allStudents.slice(startIndex, endIndex);

    return { students: paginatedStudents, lastVisible: null };
  }

  // Search by name prefix (limited Firestore capability) - ONLY if no robust search needed
  // But we replaced it with client-side above if searchTerm is present.
  // So this block is for NO search term.

  // Order and pagination
  constraints.push(orderBy("fullName", "asc"));
  constraints.push(limit(pageSize * 10)); // Fetch considerably more to account for registered filtering

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(studentsRef, ...constraints);
  const snapshot = await getDocs(q);

  const students = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter(
      (student) =>
        !student.deleted && !registeredStudentIds.includes(student.id),
    )
    .slice(0, pageSize); // Take only pageSize after filtering

  const lastVisible =
    snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

  return { students, lastVisible };
};

/**
 * Get total count of registrations for an exam
 */
export const getExamRegistrationsCount = async (examId, filters = {}) => {
  const { classLevel, madarsaId, gender, searchTerm } = filters;

  const registrationsRef = collection(db, COLLECTIONS.EXAM_REGISTRATIONS);
  const constraints = [where("examId", "==", examId)];

  if (classLevel && classLevel !== "all") {
    constraints.push(where("classLevel", "==", classLevel));
  }

  if (madarsaId && madarsaId !== "all") {
    constraints.push(where("madarsaId", "==", madarsaId));
  }

  if (gender && gender !== "all") {
    constraints.push(where("gender", "==", gender));
  }

  // If search term is present, we must fetch and filter to get count
  if (searchTerm && searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase().trim();
    const q = query(registrationsRef, ...constraints);
    const snapshot = await getDocs(q);

    const count = snapshot.docs.filter((doc) => {
      const reg = doc.data();
      return (
        (reg.studentName &&
          reg.studentName.toLowerCase().includes(searchLower)) ||
        (reg.admissionNumber &&
          reg.admissionNumber.toString().toLowerCase().includes(searchLower)) ||
        (reg.hallTicketNumber &&
          reg.hallTicketNumber
            .toString()
            .toLowerCase()
            .includes(searchLower)) ||
        (reg.studentEmail &&
          reg.studentEmail.toLowerCase().includes(searchLower)) ||
        (reg.studentPhone && reg.studentPhone.includes(searchLower))
      );
    }).length;
    return count;
    return count;
  }

  const q = query(registrationsRef, ...constraints);
  const snapshot = await getCountFromServer(q);

  return snapshot.data().count;
};

/**
 * Get total count of unregistered students for an exam
 */
export const getUnregisteredStudentsCount = async (examId, filters = {}) => {
  const { classLevel, madarsaId, gender, searchTerm } = filters;

  // If search term is present, we must fetch and filter to get count
  if (searchTerm && searchTerm.trim()) {
    // This is expensive but necessary for accurate counts with search
    const { students } = await fetchUnregisteredStudents(
      examId,
      { ...filters, page: 1 },
      10000, // Fetch a large number to count
    );
    return students.length;
  }

  // Build student query with filters
  const studentsRef = collection(db, COLLECTIONS.STUDENTS);
  const constraints = [where("status", "==", "active")];

  // Server-side filters
  if (classLevel && classLevel !== "all") {
    constraints.push(where("classLevel", "==", classLevel));
  }

  if (madarsaId && madarsaId !== "all") {
    constraints.push(where("madarsaId", "==", madarsaId));
  }

  if (gender && gender !== "all") {
    constraints.push(where("gender", "==", gender));
  }

  const q = query(studentsRef, ...constraints);
  const snapshot = await getCountFromServer(q);
  const totalStudentsCount = snapshot.data().count;

  // Get count of REGISTERED students matching the SAME filters
  const registeredCount = await getExamRegistrationsCount(examId, filters);

  return Math.max(0, totalStudentsCount - registeredCount);
};

/**
 * Fetch madrasas and mekhalas metadata (for caching)
 */
export const fetchInstitutionsMetadata = async () => {
  // Fetch madrasas
  const madrasasSnap = await getDocs(
    query(collection(db, "madarsas"), orderBy("name", "asc")),
  );

  const madrasas = madrasasSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Fetch mekhalas
  const mekhalasSnap = await getDocs(
    query(collection(db, "mekhala"), orderBy("name", "asc")),
  );

  const mekhalas = mekhalasSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Create Maps for O(1) lookup
  const madrasaMap = new Map(madrasas.map((m) => [m.madarsaId, m]));
  const mekhalaMap = new Map(mekhalas.map((m) => [m.id, m]));

  // District dropdown options should only show configured districts
  // (even if there is extra/legacy district data in Firestore).
  const districts = DISTRICT_ORDER.map((name) => ({
    name: canonicalDistrictName(name) || name,
  }));

  return { madrasas, mekhalas, madrasaMap, mekhalaMap, districts };
};

/**
 * Get unique classes from students (for filter dropdown)
 */
export const fetchUniqueClasses = async () => {
  const studentsRef = collection(db, COLLECTIONS.STUDENTS);
  const q = query(
    studentsRef,
    where("status", "==", "active"),
    orderBy("classLevel", "asc"),
  );
  const snapshot = await getDocs(q);

  const classSet = new Set();
  snapshot.docs.forEach((doc) => {
    const classLevel = doc.data().classLevel;
    if (classLevel) {
      classSet.add(classLevel);
    }
  });

  return Array.from(classSet).sort();
};
/**
 * Fetch hall ticket data from hallTickets collection
 */
export const fetchHallTicketData = async (examId, studentId) => {
  try {
    const hallTicketRef = doc(db, "hallTickets", examId, "students", studentId);
    const hallTicketSnapshot = await getDoc(hallTicketRef);

    if (hallTicketSnapshot.exists()) {
      const data = hallTicketSnapshot.data();
      // Convert timestamps to Date objects
      if (data.createdAt && data.createdAt.toDate) {
        data.createdAt = data.createdAt.toDate();
      }
      if (data.examDate && data.examDate.toDate) {
        data.examDate = data.examDate.toDate();
      }
      return data;
    } else {
      // Return null to indicate not found, allowing fallback
      return null;
    }
  } catch (error) {
    console.error("Error fetching hall ticket data:", error);
    // Return null on error to allow fallback
    return null;
  }
};
