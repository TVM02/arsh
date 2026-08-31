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
import { COLLECTIONS } from "./firestoreService";

/**
 * Build dynamic Firestore query for applications
 */
export const buildApplicationQuery = (
  filters = {},
  pageSize = 20,
  lastDoc = null,
) => {
  const { status, madarsaId } = filters;

  const applicationsRef = collection(db, COLLECTIONS.ADMISSIONS);
  const constraints = [];

  // Madarsa filter (field stored as "madarsa" on each document)
  if (madarsaId && madarsaId.trim()) {
    constraints.push(where("madarsa", "==", madarsaId.trim()));
  }

  // Status filter
  if (status && status !== "all") {
    if (status === "pending") {
      constraints.push(where("status", "in", ["pending", "confirmed"]));
    } else {
      constraints.push(where("status", "==", status));
    }
  }

  // Order and pagination
  constraints.push(orderBy("createdAt", "desc"));
  constraints.push(limit(pageSize));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  return query(applicationsRef, ...constraints);
};

/**
 * Fetch applications with server-side filtering and pagination
 */
export const fetchFilteredApplications = async (
  filters,
  pageSize = 20,
  lastDoc = null,
) => {
  const q = buildApplicationQuery(filters, pageSize, lastDoc);
  const snapshot = await getDocs(q);

  const applications = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const lastVisible =
    snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

  return { applications, lastVisible };
};

/**
 * Search applications by name, email, phone, or admission number
 */
export const searchApplications = async (
  searchTerm,
  filters = {},
  maxResults = 1000,
) => {
  if (!searchTerm || searchTerm.trim() === "") {
    return { applications: [], total: 0 };
  }

  const { status, madarsaId } = filters;
  const applicationsRef = collection(db, COLLECTIONS.ADMISSIONS);
  const constraints = [];

  // Madarsa filter
  if (madarsaId && madarsaId.trim()) {
    constraints.push(where("madarsa", "==", madarsaId.trim()));
  }

  // Status filter
  if (status && status !== "all") {
    if (status === "pending") {
      constraints.push(where("status", "in", ["pending", "confirmed"]));
    } else {
      constraints.push(where("status", "==", status));
    }
  }

  // Fetch more records for searching
  constraints.push(orderBy("createdAt", "desc"));
  constraints.push(limit(maxResults));

  const q = query(applicationsRef, ...constraints);
  
  // Perform parallel direct queries for exact field matches (ignores 1000-limit cutoff)
  const exactQueries = [];
  const searchTrimmed = searchTerm.trim();
  
  if (searchTrimmed) {
    if (searchTrimmed.toLowerCase().includes("-") || searchTrimmed.toLowerCase().startsWith("mid")) {
      exactQueries.push(
        getDocs(query(applicationsRef, where("admissionNumber", "==", searchTrimmed)))
      );
      exactQueries.push(
        getDocs(query(applicationsRef, where("admissionNumber", "==", searchTrimmed.toUpperCase())))
      );
      exactQueries.push(
        getDocs(query(applicationsRef, where("admissionNumber", "==", searchTrimmed.toLowerCase())))
      );
    }
    
    if (searchTrimmed.includes("@")) {
      exactQueries.push(
        getDocs(query(applicationsRef, where("email", "==", searchTrimmed)))
      );
      exactQueries.push(
        getDocs(query(applicationsRef, where("email", "==", searchTrimmed.toLowerCase())))
      );
    }
    
    if (/^\d+$/.test(searchTrimmed)) {
      exactQueries.push(
        getDocs(query(applicationsRef, where("phone", "==", searchTrimmed)))
      );
      exactQueries.push(
        getDocs(query(applicationsRef, where("guardianPhone", "==", searchTrimmed)))
      );
      exactQueries.push(
        getDocs(query(applicationsRef, where("whatsappNumber", "==", searchTrimmed)))
      );
    }
  }

  const [snapshot, ...exactSnapshots] = await Promise.all([
    getDocs(q),
    ...exactQueries
  ]);

  const allApplicationsMap = new Map();

  // Add exact matches first
  exactSnapshots.forEach((snap) => {
    snap.docs.forEach((doc) => {
      const appData = doc.data();
      // Apply filters client-side to exact matches if filters are active
      if (madarsaId && madarsaId.trim() && appData.madarsa !== madarsaId.trim()) return;
      if (status && status !== "all" && appData.status !== status) return;
      
      allApplicationsMap.set(doc.id, {
        id: doc.id,
        ...appData,
      });
    });
  });

  // Add the recent applications snapshot
  snapshot.docs.forEach((doc) => {
    allApplicationsMap.set(doc.id, {
      id: doc.id,
      ...doc.data(),
    });
  });

  const allApplications = Array.from(allApplicationsMap.values());

  // Client-side filtering by search term
  const searchLower = searchTerm.toLowerCase();
  const filteredApplications = allApplications.filter(
    (app) =>
      app.fullName?.toLowerCase().includes(searchLower) ||
      app.email?.toLowerCase().includes(searchLower) ||
      app.phone?.includes(searchTerm) ||
      app.guardianPhone?.includes(searchTerm) ||
      app.whatsappNumber?.includes(searchTerm) ||
      app.admissionNumber?.toLowerCase().includes(searchLower),
  );

  // Sort them by createdAt desc
  filteredApplications.sort((a, b) => {
    const aTime = a.createdAt?.seconds || a.createdAt ? new Date(a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt).getTime() : 0;
    const bTime = b.createdAt?.seconds || b.createdAt ? new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  return {
    applications: filteredApplications,
    total: filteredApplications.length,
  };
};

/**
 * Get total count of applications
 */
export const getApplicationsCount = async (filters = {}) => {
  const { status, madarsaId } = filters;
  const applicationsRef = collection(db, COLLECTIONS.ADMISSIONS);
  const constraints = [];

  // Madarsa filter
  if (madarsaId && madarsaId.trim()) {
    constraints.push(where("madarsa", "==", madarsaId.trim()));
  }

  if (status && status !== "all") {
    if (status === "pending") {
      constraints.push(where("status", "in", ["pending", "confirmed"]));
    } else {
      constraints.push(where("status", "==", status));
    }
  }

  const q = query(applicationsRef, ...constraints);
  const snapshot = await getCountFromServer(q);

  return snapshot.data().count;
};
