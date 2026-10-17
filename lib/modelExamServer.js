import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const MODEL_EXAM_CLASSES = ["Class 4", "Class 5", "Class 9", "Class 10"];

// Change these to match your project's exact exam-board role IDs.
const EDITOR_ROLES = new Set([
  "admin", "central_admin", "exam_board", "exam_board_admin",
  "exam_admin", "examination_board",
]);

export class ModelExamError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function authorizeModelExam(request) {
  const header = request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/i.test(header)) {
    throw new ModelExamError("Please sign in to manage hall tickets.", 401);
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(header.replace(/^Bearer\s+/i, "").trim());
  } catch {
    throw new ModelExamError("Your session has expired. Please sign in again.", 401);
  }

  const userSnap = await getAdminDb().collection("users").doc(decoded.uid).get();
  const docRole = String(userSnap.data()?.role || "").toLowerCase();
  const claimRole = String(decoded.role || "").toLowerCase();

  if (!(decoded.admin === true || EDITOR_ROLES.has(docRole) || EDITOR_ROLES.has(claimRole))) {
    throw new ModelExamError("Only Exam Board / Central Admin can manage hall tickets.", 403);
  }
  return { uid: decoded.uid, db: getAdminDb() };
}

export function failModelExam(error) {
  console.error("MODEL EXAM API ERROR:", error);
  const status = Number.isInteger(error?.status) ? error.status : 500;
  return NextResponse.json({ success: false, message: status === 500 ? "An internal error occurred." : error.message }, { status });
}

const clean = (value) => typeof value === "string" ? value.trim() : "";

export function validateTicket(input) {
  const name = clean(input?.name);
  const gender = clean(input?.gender);
  const examCenter = clean(input?.examCenter);
  const className = clean(input?.className);
  const hallTicketNumber = clean(input?.hallTicketNumber);
  const mekhala = clean(input?.mekhala);

  if (!name || name.length > 140) throw new ModelExamError("Enter the student's name (up to 140 characters).");
  if (!["Male", "Female", "Other"].includes(gender)) throw new ModelExamError("Select a valid gender.");
  if (!examCenter || examCenter.length > 180) throw new ModelExamError("Enter the exam center (up to 180 characters).");
  if (!MODEL_EXAM_CLASSES.includes(className)) throw new ModelExamError("Select Class 4, 5, 9 or 10.");
  if (!/^\d{1,16}$/.test(hallTicketNumber)) throw new ModelExamError("Hall Ticket Number must contain 1–16 digits.");
  if (mekhala.length > 160) throw new ModelExamError("Mekhala must be within 160 characters.");

  return { name, gender, examCenter, className, hallTicketNumber, mekhala };
}

export const DEFAULT_MODEL_EXAM_SETTINGS = {
  boardName: "ദക്ഷിണ കേരള ഇസ്ലാം മത വിദ്യാഭ്യാസ ബോർഡ്",
  examName: "മോഡൽ പരീക്ഷ",
  academicYear: "2027",
  timetables: Object.fromEntries(MODEL_EXAM_CLASSES.map(c => [c, []])),
};

export function normalizeSettings(input) {
  const boardName = clean(input?.boardName);
  const examName = clean(input?.examName);
  const academicYear = clean(input?.academicYear);
  if (!boardName || boardName.length > 200) throw new ModelExamError("Enter the board / organization name.");
  if (!examName || examName.length > 120) throw new ModelExamError("Enter the examination name.");
  if (!/^\d{4}(?:-\d{2,4})?$/.test(academicYear)) throw new ModelExamError("Enter a valid academic year, for example 2027.");

  const timetables = {};
  for (const className of MODEL_EXAM_CLASSES) {
    const rows = input?.timetables?.[className] ?? [];
    if (!Array.isArray(rows) || rows.length > 7) {
      throw new ModelExamError(`${className}: maximum 7 timetable rows per A4 ticket.`);
    }
    timetables[className] = rows.map((row, index) => {
      const date = clean(row?.date);
      const subject = clean(row?.subject);
      const time = clean(row?.time);
      const duration = clean(row?.duration);
      if (!date || !subject || !time || !duration) {
        throw new ModelExamError(`${className}, row ${index + 1}: complete Date, Subject, Time and Duration.`);
      }
      if ([date, subject, time, duration].some(v => v.length > 100)) {
        throw new ModelExamError(`${className}, row ${index + 1}: each field must be 100 characters or less.`);
      }
      return { date, subject, time, duration };
    });
  }
  return { boardName, examName, academicYear, timetables };
}
