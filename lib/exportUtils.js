import { getDocs } from "firebase/firestore";
import { buildRegistrationQuery } from "./firestoreQueries";
import { buildTeacherQuery } from "./teacherQueries";

/**
 * Stream CSV export in batches to avoid memory issues
 */
export const exportRegistrationsToCSV = async (filters, exams, onProgress) => {
  const BATCH_SIZE = 500;
  const headers = [
    "Student Name",
    "Email",
    "Phone",
    "Gender",
    "Admission Number",
    "Exam Title",
    "Exam Fees",
    "Payment Status",
    "Registration Date",
    "Madarsa",
    "Hall Ticket Number",
    "Student ID",
  ];

  // UTF-8 BOM for proper encoding in Excel
  const BOM = "\uFEFF";
  let csvContent = BOM + headers.join(",") + "\n";
  let lastDoc = null;
  let totalProcessed = 0;

  // Fetch in batches
  while (true) {
    const q = buildRegistrationQuery(filters, BATCH_SIZE, lastDoc);
    const snapshot = await getDocs(q);

    if (snapshot.empty) break;

    // Process batch
    snapshot.docs.forEach((doc) => {
      const registration = doc.data();
      const exam = exams.find((e) => e.id === registration.examId);

      const row = [
        registration.studentName || "",
        registration.studentEmail || "",
        registration.studentPhone || "",
        registration.hallTicket?.gender || registration.gender || "",
        registration.admissionNumber || "",
        exam?.title || "",
        exam?.fees || 0,
        registration.paymentStatus || "",
        registration.createdAt?.toDate?.()?.toLocaleDateString() || "",
        registration.madarsaId || "",
        registration.hallTicket?.hallTicketNumber ||
          registration.hallTicketNumber ||
          "",
        registration.studentId || "",
      ];

      // Escape fields properly for CSV (handle commas, quotes, newlines)
      csvContent +=
        row
          .map((field) => {
            const fieldStr = String(field);
            // Escape quotes by doubling them
            const escaped = fieldStr.replace(/"/g, '""');
            // Wrap in quotes if contains comma, quote, or newline
            if (
              escaped.includes(",") ||
              escaped.includes('"') ||
              escaped.includes("\n")
            ) {
              return `"${escaped}"`;
            }
            return escaped;
          })
          .join(",") + "\n";
    });

    totalProcessed += snapshot.docs.length;

    if (onProgress) {
      onProgress(totalProcessed);
    }

    if (snapshot.docs.length < BATCH_SIZE) break;

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  // Create blob with UTF-8 encoding
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `exam_registrations_${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return totalProcessed;
};

/**
 * Stream CSV export for teachers in batches
 */
export const exportTeachersToCSV = async (filters, madrasaMap, onProgress) => {
  const BATCH_SIZE = 500;
  const headers = [
    "Name",
    "Email",
    "Phone",
    "Madrasa",
    "MSR ID",
    "Qualification",
    "Degree",
    "Moallim Training",
    "Training Details",
    "Status",
    "Date Joined",
  ];

  // UTF-8 BOM for proper encoding in Excel
  const BOM = "\uFEFF";
  let csvContent = BOM + headers.join(",") + "\n";
  let lastDoc = null;
  let totalProcessed = 0;

  // Fetch in batches
  while (true) {
    const q = buildTeacherQuery(filters, BATCH_SIZE, lastDoc);
    const snapshot = await getDocs(q);

    if (snapshot.empty) break;

    // Process batch
    snapshot.docs.forEach((doc) => {
      const teacher = doc.data();
      const madrasa = madrasaMap.get(teacher.madarsaId);

      const row = [
        teacher.name || "",
        teacher.email || "",
        teacher.phone || "",
        madrasa?.name || teacher.madarsaId || "",
        teacher.mhrId || "",
        teacher.qualification || "",
        teacher.degree || "",
        teacher.moallimTraining ? "Yes" : "No",
        teacher.moallimTrainingDetails || "",
        teacher.status || "",
        teacher.createdAt?.toDate?.()?.toLocaleDateString() || "",
      ];

      // Escape fields properly for CSV
      csvContent +=
        row
          .map((field) => {
            const fieldStr = String(field);
            const escaped = fieldStr.replace(/"/g, '""');
            if (
              escaped.includes(",") ||
              escaped.includes('"') ||
              escaped.includes("\n")
            ) {
              return `"${escaped}"`;
            }
            return escaped;
          })
          .join(",") + "\n";
    });

    totalProcessed += snapshot.docs.length;

    if (onProgress) {
      onProgress(totalProcessed);
    }

    if (snapshot.docs.length < BATCH_SIZE) break;

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  // Create blob with UTF-8 encoding
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `teachers_${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return totalProcessed;
};
