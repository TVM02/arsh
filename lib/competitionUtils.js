import { Timestamp } from "firebase/firestore";

export const CATEGORIES = {
  senior: { key: "senior", label: "Senior", labelAr: "كبار" },
  higher: { key: "higher", label: "Higher", labelAr: "متوسط" },
  junior: { key: "junior", label: "Junior", labelAr: "صغار" },
  subJunior: { key: "subJunior", label: "Sub Junior", labelAr: "أصغر" },
};

export const CATEGORY_ORDER = ["senior", "higher", "junior", "subJunior"];

export const EVENT_TYPES = {
  individual: "Individual",
  group: "Group",
};

// Each mark is out of 50, total out of 150
export function calcGrade(total) {
  if (total >= 135) return "A+";
  if (total >= 115) return "A";
  if (total >= 95) return "B+";
  if (total >= 75) return "B";
  if (total >= 55) return "C";
  return "D";
}

// Normalize dateOfBirth from any stored format to a JS Date
function normalizeDob(dob) {
  if (!dob) return null;
  if (dob instanceof Date) return dob;
  if (typeof dob === "object" && typeof dob.toDate === "function")
    return dob.toDate();
  if (dob instanceof Timestamp) return dob.toDate();
  if (typeof dob === "object" && typeof dob.seconds === "number")
    return new Date(dob.seconds * 1000);
  const parsed = new Date(dob);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Student is eligible if born ON OR AFTER the dobCutoff string ("YYYY-MM-DD").
 * Admin sets the earliest allowed DOB per category (e.g. "2016-01-01" for Sub Junior).
 */
export function isEligible(student, dobCutoff) {
  if (!dobCutoff) return true;
  const dob = normalizeDob(student.dateOfBirth);
  if (!dob) return false;
  return dob >= new Date(dobCutoff);
}

export function calcTotal(mark1, mark2, mark3) {
  const m1 = Number(mark1) || 0;
  const m2 = Number(mark2) || 0;
  const m3 = Number(mark3) || 0;
  return m1 + m2 + m3;
}
