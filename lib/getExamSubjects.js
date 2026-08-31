import { db } from "./firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { COLLECTIONS } from "./firestoreService";

/**
 * Fetches all available subjects for a specific exam, combining core timetable subjects
 * and extra subjects while respecting the deleted subjects blocklist.
 *
 * @param {string} examId - The Document ID of the exam
 * @returns {Promise<Array>} - Array of subject objects with metadata
 */
export const getExamSubjects = async (examId) => {
  if (!examId) return [];

  try {
    const examDoc = await getDoc(doc(db, COLLECTIONS.EXAMS, examId));
    if (!examDoc.exists()) {
      return [];
    }

    const examData = examDoc.data();
    const subjectsMap = new Map();

    // 1. Process Core Exam Subjects (from timetableEntries)
    if (examData.timetableEntries) {
      examData.timetableEntries.forEach((entry) => {
        const subName = entry.subject || entry.title;
        if (subName) {
          subjectsMap.set(subName, {
            subject: subName,
            isCore: true,
            passMark: entry.passMark || 35,
            totalMarks: entry.totalMarks || 100,
            class: entry.class || entry.target || "all",
            date: entry.date || null,
          });
        }
      });
    }

    // 2. Process Extra Subjects (from resultSubjectTemp)
    if (examData.resultSubjectTemp) {
      examData.resultSubjectTemp.forEach((s) => {
        const subObj = typeof s === "string" ? { subject: s, class: "all" } : s;
        if (subObj.subject && !subjectsMap.has(subObj.subject)) {
          subjectsMap.set(subObj.subject, {
            ...subObj,
            isCore: false,
            passMark: subObj.passMark || 35,
            totalMarks: subObj.totalMarks || 100,
          });
        }
      });
    }

    // 3. Filter out deleted subjects (blocklist)
    const deletedSubs = examData.deletedResultSubjects || [];
    const availableSubjects = Array.from(subjectsMap.values()).filter(
      (s) => !deletedSubs.includes(s.subject),
    );

    return availableSubjects;
  } catch (error) {
    console.error("Error in getExamSubjects utility:", error);
    throw error;
  }
};

/**
 * Fetches subjects for a specific student from the hallTickets collection.
 * Queries hallTickets/{examId}/students where hallTicketNumber == hallTicket.
 *
 * @param {string} examId - The exam document ID
 * @param {string} hallTicket - The student's hall ticket number
 * @returns {Promise<Array>} - Array of timetableEntry objects from the student's hall ticket
 */
export const getSubjectsByHallTicket = async (examId, hallTicket) => {
  if (!examId || !hallTicket) return [];

  try {
    const studentsRef = collection(db, "hallTickets", examId, "students");
    const q = query(
      studentsRef,
      where("hallTicketNumber", "==", hallTicket.toString()),
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.warn(
        `No hall ticket doc found for HT: ${hallTicket} in exam: ${examId}`,
      );
      return [];
    }

    const studentData = snapshot.docs[0].data();
    const entries = studentData.timetableEntries || [];

    return entries
      .map((entry) => ({
        subject: entry.subject || entry.title || "",
        passMark: entry.passMark || 35,
        totalMarks: entry.totalMarks || 100,
        date: entry.date || null,
        class: entry.class || entry.target || "all",
      }))
      .filter((e) => e.subject);
  } catch (error) {
    console.error("Error in getSubjectsByHallTicket:", error);
    throw error;
  }
};
