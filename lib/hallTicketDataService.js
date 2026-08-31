import { doc, setDoc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Save hall ticket data for later PDF generation
 * Storage path: hallTickets/{examId}/students/{studentId}
 */
export const saveHallTicketData = async (examId, studentId, hallTicketData) => {
  const docRef = doc(db, "hallTickets", examId, "students", studentId);
  await setDoc(docRef, {
    ...hallTicketData,
    createdAt: new Date(),
    generatedPdfUrl: null,
  });
};

/**
 * Batch save hall ticket data for multiple students
 * Uses Firestore batch writes (max 500 per batch)
 */
export const batchSaveHallTicketData = async (examId, hallTicketsData) => {
  const batchSize = 500; // Firestore limit
  const batches = [];

  for (let i = 0; i < hallTicketsData.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = hallTicketsData.slice(i, i + batchSize);

    chunk.forEach(({ studentId, data }) => {
      const docRef = doc(db, "hallTickets", examId, "students", studentId);
      batch.set(docRef, {
        ...data,
        createdAt: new Date(),
        generatedPdfUrl: null,
      });
    });

    batches.push(batch.commit());
  }

  await Promise.all(batches);
};

/**
 * Get hall ticket data for PDF generation
 */
export const getHallTicketData = async (examId, studentId) => {
  const docRef = doc(db, "hallTickets", examId, "students", studentId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
};

/**
 * Update hall ticket data (merges with existing data)
 */
export const updateHallTicketData = async (examId, studentId, updateData) => {
  const docRef = doc(db, "hallTickets", examId, "students", studentId);
  await setDoc(
    docRef,
    {
      ...updateData,
      updatedAt: new Date(),
    },
    { merge: true },
  );
};

/**
 * Batch update hall ticket data
 */
export const batchUpdateHallTicketData = async (examId, updates) => {
  const batchSize = 500;
  const batches = [];

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = updates.slice(i, i + batchSize);

    chunk.forEach(({ studentId, data }) => {
      const docRef = doc(db, "hallTickets", examId, "students", studentId);
      batch.set(
        docRef,
        {
          ...data,
          updatedAt: new Date(),
        },
        { merge: true },
      );
    });

    batches.push(batch.commit());
  }

  await Promise.all(batches);
};

/**
 * Update PDF URL after generation
 */
export const updateHallTicketPdfUrl = async (examId, studentId, pdfUrl) => {
  const docRef = doc(db, "hallTickets", examId, "students", studentId);
  await setDoc(docRef, { generatedPdfUrl: pdfUrl }, { merge: true });
};
