import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  limit,
  startAfter,
  getCountFromServer,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";

// Collections
export const COLLECTIONS = {
  USERS: "users",
  STUDENTS: "students",
  ADMISSIONS: "admissions",
  MAHALS: "mahals",
  CLASSES: "classes",
  CONTENT: "content",
  CONFIG: "config",
  EXAMS: "exams",
  EXAM_REGISTRATIONS: "examRegistrations",
  EXAM_NOTICES: "examNotices",
  EXAM_TIMETABLES: "examTimetables",
  EXAM_MARKS: "exammarks",
  PUBLISHED_RESULTS: "publishedresults",
  MEKHALAS: "mekhala",
  MADRASAS: "madarsas",
  EXAM_RESULTS: "results",
};

/**
 * Creates a new document in the specified collection
 * @param {string} collectionName - Name of the collection
 * @param {object|string} dataOrDocId - Document data or document ID
 * @param {object|null} data - Document data (if docId is provided)
 * @param {boolean} merge - Whether to merge with existing document
 * @returns {Promise<string>} - Document ID
 */
export const createDocument = async (
  collectionName,
  dataOrDocId,
  data = null,
  merge = false,
) => {
  try {
    // If data is null, it means we're using the old signature (collectionName, data)
    if (data === null) {
      const docRef = await addDoc(collection(db, collectionName), {
        ...dataOrDocId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } else {
      // New signature: (collectionName, docId, data, merge)
      const docRef = doc(db, collectionName, dataOrDocId);
      const documentData = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      // Only add createdAt if it's not a merge operation
      if (!merge) {
        documentData.createdAt = serverTimestamp();
      }

      await setDoc(docRef, documentData, { merge });
      return dataOrDocId;
    }
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw new Error(`Failed to create document: ${error.message}`);
  }
};

/**
 * Updates an existing document
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @param {object} data - Data to update
 * @returns {Promise<boolean>} - True if successful
 */
export const updateDocument = async (collectionName, docId, data) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error(
      `Error updating document ${docId} in ${collectionName}:`,
      error,
    );
    throw new Error(`Failed to update document: ${error.message}`);
  }
};

/**
 * Deletes a document
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @returns {Promise<boolean>} - True if successful
 */
export const deleteDocument = async (collectionName, docId) => {
  try {
    await deleteDoc(doc(db, collectionName, docId));
    return true;
  } catch (error) {
    console.error(
      `Error deleting document ${docId} from ${collectionName}:`,
      error,
    );
    throw new Error(`Failed to delete document: ${error.message}`);
  }
};

/**
 * Gets a single document
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @returns {Promise<object|null>} - Document data or null if not found
 */
export const getDocument = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...convertTimestamps(docSnap.data()),
      };
    }
    return null;
  } catch (error) {
    console.error(
      `Error getting document ${docId} from ${collectionName}:`,
      error,
    );
    throw new Error(`Failed to get document: ${error.message}`);
  }
};

/**
 * Gets multiple documents with optional query constraints
 * @param {string} collectionName - Name of the collection
 * @param {Array} constraints - Array of query constraints (where, orderBy, etc.)
 * @returns {Promise<Array>} - Array of documents
 */
export const getDocuments = async (collectionName, constraints = []) => {
  try {
    // build query only once
    const ref = collection(db, collectionName);
    const q = constraints.length > 0 ? query(ref, ...constraints) : ref;

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data({ serverTimestamps: "estimate" }), // faster than convertTimestamps
    }));
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Gets documents by a specific field value
 * @param {string} collectionName - Name of the collection
 * @param {string} fieldName - Name of the field to filter by
 * @param {any} fieldValue - Value to filter by
 * @returns {Promise<Array>} - Array of documents
 */
export const getDocumentsByField = async (
  collectionName,
  fieldName,
  fieldValue,
) => {
  try {
    const q = query(
      collection(db, collectionName),
      where(fieldName, "==", fieldValue),
    );

    const querySnapshot = await getDocs(q);
    const documents = [];

    querySnapshot.forEach((doc) => {
      documents.push({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      });
    });

    return documents;
  } catch (error) {
    console.error(
      `Error getting documents from ${collectionName} by ${fieldName}:`,
      error,
    );
    throw new Error(`Failed to get documents: ${error.message}`);
  }
};

/**
 * Converts Firestore Timestamps to JavaScript Dates
 * @param {object} data - Document data
 * @returns {object} - Data with converted timestamps
 */
const convertTimestamps = (data) => {
  if (!data) return data;

  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value instanceof Timestamp) {
      acc[key] = value.toDate();
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      acc[key] = convertTimestamps(value);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
};

/**
 * Generates a unique admission number using a per-madarsa atomic counter.
 * Uses a Firestore transaction so concurrent submissions never collide.
 * @param {string} mahalId - ID of the mahal / madarsa
 * @returns {Promise<string>} - Generated admission number e.g. "mid-1234-000001"
 */
export const generateAdmissionNumber = async (mahalId) => {
  try {
    const counterRef = doc(db, "counters", `admission_${mahalId}`);

    const { admissionNumber } = await runTransaction(
      db,
      async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        const currentCount = counterDoc.exists()
          ? (counterDoc.data().count ?? 0)
          : 0;
        const nextNumber = currentCount + 1;
        transaction.set(counterRef, { count: nextNumber }, { merge: true });
        const formatted = String(nextNumber).padStart(6, "0");
        return { admissionNumber: `${mahalId}-${formatted}` };
      },
    );

    return admissionNumber;
  } catch (error) {
    console.error("Error generating admission number:", error);
    throw new Error(`Failed to generate admission number: ${error.message}`);
  }
};

/**
 * Checks if a document exists
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @returns {Promise<boolean>} - True if document exists
 */
export const documentExists = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    console.error(
      `Error checking document existence ${docId} in ${collectionName}:`,
      error,
    );
    throw new Error(`Failed to check document existence: ${error.message}`);
  }
};

/**
 * Gets documents with pagination
 * @param {string} collectionName - Name of the collection
 * @param {number} limitCount - Number of documents per page
 * @param {Array} constraints - Query constraints
 * @param {object|null} lastDocument - Last document from previous page
 * @returns {Promise<{data: Array, lastDoc: object|null}>} - Paginated results
 */
export const getPaginatedDocuments = async (
  collectionName,
  limitCount,
  constraints = [],
  lastDocument = null,
) => {
  try {
    let q = query(
      collection(db, collectionName),
      ...constraints,
      orderBy("createdAt", "desc"),
      limit(limitCount),
    );

    if (lastDocument) {
      q = query(q, startAfter(lastDocument));
    }

    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertTimestamps(doc.data()),
    }));

    return {
      data,
      lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
    };
  } catch (error) {
    console.error(
      `Error getting paginated documents from ${collectionName}:`,
      error,
    );
    throw new Error(`Failed to get paginated documents: ${error.message}`);
  }
};

/**
 * Gets the count of documents matching the constraints
 * @param {string} collectionName - Name of the collection
 * @param {Array} constraints - Query constraints
 * @returns {Promise<number>} - Count of documents
 */
export const getCount = async (collectionName, constraints = []) => {
  try {
    const ref = collection(db, collectionName);
    const q = constraints.length > 0 ? query(ref, ...constraints) : ref;
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (error) {
    console.error(`Error counting documents in ${collectionName}:`, error);
    throw new Error(`Failed to count documents: ${error.message}`);
  }
};
