import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const MODEL_EXAM_CLASSES = ["Class 5", "Class 7", "Class 10", "Class 12"];

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
    decoded = await getAdminAuth().verifyIdToken(
      header.replace(/^Bearer\s+/i, "").trim()
    );
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
  return NextResponse.json({
    success: false,
    message: status === 500 ? "An internal error occurred." : error.message,
  }, { status });
}

const clean = (value) => typeof value === "string" ? value.trim() : "";

export function validateTicket(input) {
  const name = clean(input?.name);
  const gender = clean(input?.gender);
  const examCenter = clean(input?.examCenter);
  const className = clean(input?.className);
  const hallTicketNumber = clean(input?.hallTicketNumber);
  const mekhala = clean(input?.mekhala);

  // Store selected Madrasa so the dropdown remains selected when editing.
  // Keep optional for hall tickets created before this feature existed.
  const madarsaId = clean(input?.madarsaId);
  const madarsaName = clean(input?.madarsaName);
  const mekhalaId = clean(input?.mekhalaId);

  if (!name || name.length > 140) throw new ModelExamError("Enter the student's name (up to 140 characters).");
  if (!["Male", "Female", "Other"].includes(gender)) throw new ModelExamError("Select a valid gender.");
  if (!MODEL_EXAM_CLASSES.includes(className)) throw new ModelExamError("Select Class 5, 7, 10 or 12.");
  if (!/^\d{1,16}$/.test(hallTicketNumber)) throw new ModelExamError("Hall Ticket Number must contain 1–16 digits.");
  if (mekhala.length > 160) throw new ModelExamError("Mekhala must be within 160 characters.");
  if (madarsaId.length > 120) throw new ModelExamError("Madrasa ID must be within 120 characters.");
  if (madarsaName.length > 200) throw new ModelExamError("Madrasa name must be within 200 characters.");
  if (mekhalaId.length > 120) throw new ModelExamError("Mekhala ID must be within 120 characters.");

  return {
    name, gender, examCenter, className, hallTicketNumber, mekhala,
    madarsaId, madarsaName, mekhalaId,
  };
}

export const DEFAULT_MODEL_EXAM_SETTINGS = {
  boardName: "ദക്ഷിണ കേരള ഇസ്ലാം മത വിദ്യാഭ്യാസ ബോർഡ്",
  examName: "മോഡൽ പരീക്ഷ",
  academicYear: "2027",
  timetables: Object.fromEntries(MODEL_EXAM_CLASSES.map((c) => [c, []])),
};

// Time-picker support, with old timetable formats kept compatible.
function normalizeTime(value) {
  const match = clean(value).match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)?$/i);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = match[2];
  const period = match[3]?.toUpperCase();
  if (period) {
    if (hour < 1 || hour > 12) return "";
    hour = hour % 12 + (period === "PM" ? 12 : 0);
  } else if (hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function calculateTimeRange(start, end) {
  const startTime = normalizeTime(start);
  const endTime = normalizeTime(end);
  if (!startTime || !endTime) return null;
  const [h1, m1] = startTime.split(":").map(Number);
  const [h2, m2] = endTime.split(":").map(Number);
  const diff = h2 * 60 + m2 - (h1 * 60 + m1);
  if (diff <= 0) return null;
  const fmt = (time) => {
    const [h, m] = time.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  const duration = [
    hours ? `${hours} ${hours === 1 ? "Hour" : "Hours"}` : "",
    minutes ? `${minutes} ${minutes === 1 ? "Minute" : "Minutes"}` : "",
  ].filter(Boolean).join(" ");
  return { startTime, endTime, time: `${fmt(startTime)} - ${fmt(endTime)}`, duration };
}

export function normalizeSettings(input) {
  const boardName = clean(input?.boardName);
  const examName = clean(input?.examName);
  const academicYear = clean(input?.academicYear);
  if (!boardName || boardName.length > 200) throw new ModelExamError("Enter the board / organization name.");
  if (!examName || examName.length > 120) throw new ModelExamError("Enter the examination name.");
  if (!/^\d{4}(?:-\d{2,4})?$/.test(academicYear)) {
    throw new ModelExamError("Enter a valid academic year, for example 2027.");
  }

  const timetables = {};
  for (const className of MODEL_EXAM_CLASSES) {
    const rows = input?.timetables?.[className] ?? [];
    if (!Array.isArray(rows) || rows.length > 7) {
      throw new ModelExamError(`${className}: maximum 7 timetable rows per A4 ticket.`);
    }
    timetables[className] = rows.map((row, index) => {
      const date = clean(row?.date);
      const subject = clean(row?.subject);
      if (!date || !subject) {
        throw new ModelExamError(`${className}, row ${index + 1}: enter Date and Subject.`);
      }
      if (date.length > 100 || subject.length > 100) {
        throw new ModelExamError(`${className}, row ${index + 1}: Date and Subject must be 100 characters or less.`);
      }

      // New time-picker fields are recalculated server-side.
      const timeRange = clean(row?.startTime) && clean(row?.endTime)
        ? calculateTimeRange(row.startTime, row.endTime)
        : null;
      if (clean(row?.startTime) || clean(row?.endTime)) {
        if (!timeRange) {
          throw new ModelExamError(`${className}, row ${index + 1}: End Time must be after Start Time.`);
        }
        return { date, subject, ...timeRange };
      }

      // Legacy saved timetables may still contain only Time and Duration.
      const time = clean(row?.time);
      const duration = clean(row?.duration);
      if (!time || !duration || time.length > 100 || duration.length > 100) {
        throw new ModelExamError(`${className}, row ${index + 1}: complete Time and Duration.`);
      }
      return { date, subject, time, duration };
    });
  }
  return { boardName, examName, academicYear, timetables };
}