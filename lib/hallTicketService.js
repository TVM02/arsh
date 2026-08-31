import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "./firebase";

/**
 * Get the next hall ticket number for an exam
 * @param {string} examId - The exam ID
 * @returns {Promise<string>} - 6-digit padded hall ticket number
 */
export const getNextHallTicketNumber = async (examId) => {
  try {
    const counterRef = doc(db, "hallTicketCounters", examId);

    const hallTicketNumber = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      let currentCounter = 0;
      if (counterDoc.exists()) {
        currentCounter = counterDoc.data().counter || 0;
      }

      const nextCounter = currentCounter + 1;

      // Save back to Firestore
      transaction.set(
        counterRef,
        {
          counter: nextCounter,
          examId: examId,
          lastUpdated: new Date().toISOString(),
        },
        { merge: true }
      );

      // Return 6-digit padded number
      return String(nextCounter).padStart(6, "0");
    });

    return hallTicketNumber;
  } catch (error) {
    console.error("Error generating hall ticket number:", error);
    throw new Error("Failed to generate hall ticket number");
  }
};

/**
 * Generate multiple hall ticket numbers in batch using transaction
 * @param {string} examId - The exam ID
 * @param {number} count - Number of hall tickets needed
 * @returns {Promise<string[]>} - Array of 6-digit padded hall ticket numbers
 */
export const batchGenerateHallTicketNumbers = async (examId, count) => {
  try {
    const counterRef = doc(db, "hallTicketCounters", examId);

    const hallTicketNumbers = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      let currentCounter = 0;
      if (counterDoc.exists()) {
        currentCounter = counterDoc.data().counter || 0;
      }

      // Generate array of numbers
      const numbers = [];
      for (let i = 1; i <= count; i++) {
        const nextNumber = currentCounter + i;
        numbers.push(String(nextNumber).padStart(6, "0"));
      }

      // Update counter atomically
      const newCounter = currentCounter + count;
      transaction.set(
        counterRef,
        {
          counter: newCounter,
          examId: examId,
          lastUpdated: new Date().toISOString(),
        },
        { merge: true }
      );

      return numbers;
    });

    return hallTicketNumbers;
  } catch (error) {
    console.error("Error batch generating hall ticket numbers:", error);
    console.error("Path attempted:", `hallTicketCounters/${examId}`);
    console.error(
      "Auth status:",
      auth.currentUser
        ? `Authenticated as ${auth.currentUser.uid}`
        : "Not Authenticated"
    );
    if (!auth.currentUser) {
      throw new Error(
        "Authentication required: You must be logged in to generate hall ticket numbers."
      );
    }
    throw new Error(
      `Failed to batch generate hall ticket numbers: ${error.message}`
    );
  }
};

/**
 * Backfill hall ticket numbers for existing registrations
 * This should be run once to assign numbers to existing registrations
 * @param {string} examId - The exam ID to backfill
 * @returns {Promise<number>} - Number of registrations updated
 */
export const backfillHallTicketNumbers = async (examId) => {
  try {
    // Get all registrations for this exam that don't have hall ticket numbers
    const registrationsRef = collection(db, "examRegistrations");
    const q = query(
      registrationsRef,
      where("examId", "==", examId),
      orderBy("createdAt", "asc")
    );

    const snapshot = await getDocs(q);
    const registrations = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Only process if no hall ticket number exists
      if (!data.hallTicketNumber) {
        registrations.push({ id: doc.id, ...data });
      }
    });

    if (registrations.length === 0) {
      console.log("No registrations to backfill for exam:", examId);
      return 0;
    }

    console.log(
      `Backfilling ${registrations.length} registrations for exam:`,
      examId
    );

    // Get or initialize counter
    const counterRef = doc(db, "hallTicketCounters", examId);
    const counterDoc = await getDoc(counterRef);

    let currentCounter = 0;
    if (counterDoc.exists()) {
      currentCounter = counterDoc.data().counter || 0;
    }

    // Update each registration
    const updatePromises = registrations.map(async (registration, index) => {
      const hallTicketNumber = String(currentCounter + index + 1).padStart(
        6,
        "0"
      );
      const regRef = doc(db, "examRegistrations", registration.id);

      await updateDoc(regRef, {
        hallTicketNumber: hallTicketNumber,
        updatedAt: new Date(),
      });

      console.log(
        `Updated registration ${registration.id} with hall ticket: ${hallTicketNumber}`
      );
    });

    await Promise.all(updatePromises);

    // Update the counter
    const newCounter = currentCounter + registrations.length;
    await setDoc(
      counterRef,
      {
        counter: newCounter,
        examId: examId,
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log(
      `Backfill complete. Updated counter to ${newCounter} for exam:`,
      examId
    );

    return registrations.length;
  } catch (error) {
    console.error("Error backfilling hall ticket numbers:", error);
    throw error;
  }
};

/**
 * District abbreviation map for hall ticket number formatting
 */
const DISTRICT_ABBR = {
  "thiruvananthapuram": "TVM",
  "trivandrum": "TVM",
  "kollam": "KLM",
  "pathanamthitta": "PTA",
  "alappuzha": "ALP",
  "alappey": "ALP",
  "kottayam": "KTM",
  "idukki": "IDK",
  "ernakulam": "EKM",
  "thrissur": "TSR",
  "palakkad": "PKD",
  "malappuram": "MLP",
  "kozhikode": "KZD",
  "calicut": "KZD",
  "wayanad": "WYD",
  "kannur": "KNR",
  "kasaragod": "KSD",
  "kasaragode": "KSD",
};

/**
 * Get abbreviation for a district/mekhala name
 * @param {string} name - Full district name
 * @returns {string} - 3-letter abbreviation
 */
export const getDistrictAbbr = (name) => {
  if (!name) return "DKJ";
  const lower = name.trim().toLowerCase();
  for (const [key, val] of Object.entries(DISTRICT_ABBR)) {
    if (lower.includes(key)) return val;
  }
  // Fallback: first 3 uppercase letters
  return name.trim().replace(/\s+/g, "").slice(0, 3).toUpperCase();
};

/**
 * Generate a formatted hall ticket number
 * Format: {DISTRICT_ABBR}-{MEKHALA_NUM}-{MADRASA_SHORT}-{6_DIGIT_SERIAL}
 * @param {string} examId - The exam ID
 * @param {object} opts - { districtName, mekhalaNumber, madarsaId }
 * @returns {Promise<string>}
 */
export const generateFormattedHallTicketNumber = async (examId, opts = {}) => {
  const serial = await getNextHallTicketNumber(examId);
  const distAbbr = getDistrictAbbr(opts.districtName || "");
  const mekhNum = opts.mekhalaNumber ? String(opts.mekhalaNumber).padStart(2, "0") : "00";
  const madarsaRaw = opts.madarsaId ? String(opts.madarsaId).replace(/\s+/g, "") : "";
  const madarsaDigits = madarsaRaw.replace(/\D/g, "");
  const madShort = madarsaRaw
    ? (madarsaDigits || madarsaRaw).slice(-4).padStart(4, "0").toUpperCase()
    : "MDRSA";
  return `${distAbbr}-${mekhNum}-${madShort}-${serial}`;
};

/**
 * Get hall ticket number for a specific registration
 * If it doesn't exist, generate and save it
 * @param {string} registrationId - The registration document ID
 * @param {string} examId - The exam ID
 * @returns {Promise<string>} - 6-digit padded hall ticket number
 */
export const getOrCreateHallTicketNumber = async (registrationId, examId) => {
  try {
    const registrationRef = doc(db, "examRegistrations", registrationId);
    const registrationDoc = await getDoc(registrationRef);

    if (!registrationDoc.exists()) {
      throw new Error("Registration not found");
    }

    const data = registrationDoc.data();

    // If hall ticket number already exists, return it
    if (data.hallTicketNumber) {
      return data.hallTicketNumber;
    }

    // Generate new hall ticket number
    const hallTicketNumber = await getNextHallTicketNumber(examId);

    // Update the registration
    await updateDoc(registrationRef, {
      hallTicketNumber: hallTicketNumber,
      updatedAt: new Date(),
    });

    return hallTicketNumber;
  } catch (error) {
    console.error("Error getting/creating hall ticket number:", error);
    throw error;
  }
};

/**
 * Reset counter for an exam (use with caution!)
 * @param {string} examId - The exam ID
 * @returns {Promise<void>}
 */
export const resetExamCounter = async (examId) => {
  try {
    const counterRef = doc(db, "hallTicketCounters", examId);

    await setDoc(counterRef, {
      counter: 0,
      examId: examId,
      lastUpdated: new Date().toISOString(),
    });

    console.log(`Counter reset to 0 for exam: ${examId}`);
  } catch (error) {
    console.error("Error resetting counter:", error);
    throw error;
  }
};
