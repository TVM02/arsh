import { getDocuments, updateDocument, createDocument, COLLECTIONS, getDocument } from "@/lib/firestoreService";
import { getOrCreateHallTicketNumber } from "@/lib/hallTicketService";
import { uploadFile } from "@/lib/storageService";
import { generateHallTicketHTML } from "@/lib/hallTicketUtils";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

// Helper: Get profile picture
async function getProfilePicture(student, admissionNumber, madarsaId) {
  if (student?.profilePictureUrl || student?.profilePicture) {
    return student.profilePictureUrl || student.profilePicture;
  }

  if (admissionNumber && madarsaId) {
    try {
      const admissionsData = await getDocuments(COLLECTIONS.ADMISSIONS, [
        where("admissionNumber", "==", admissionNumber),
        where("madarsa", "==", madarsaId)
      ]);

      if (admissionsData.length > 0) {
        const admission = admissionsData[0];
        return admission.profilePicture || admission.profilePictureUrl || "";
      }
    } catch (error) {
      console.error("Error fetching profile picture from admissions:", error);
    }
  }

  return "";
}

// Helper: Prepare hall ticket data (copied from page.js)
export async function prepareHallTicketData(student, registration, exam, madrasas, mekhalas) {
  let hallTicketNumber = registration?.hallTicketNumber;
  if (!hallTicketNumber && registration) {
    hallTicketNumber = await getOrCreateHallTicketNumber(registration.id, exam.id);
  }
  if (!hallTicketNumber) {
    hallTicketNumber = "000000";
  }

  const profilePictureUrl = await getProfilePicture(student, student.admissionNumber, student.madarsaId);
  const madarsaId = student?.madarsaId || null;
  let mekhala = "N/A";
  let sadarName = "N/A";
  let sadarAddress = "N/A";
  if (madarsaId) {
    try {
      const madarsasRef = collection(db, 'madarsas');
      const q = query(madarsasRef, where('madarsaId', '==', madarsaId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const madarsaData = querySnapshot.docs[0].data();
        mekhala = madarsaData.district || "N/A";
        sadarName = madarsaData.adminName || "N/A";
        sadarAddress = madarsaData.address || "N/A";
      }
    } catch (error) {
      console.error("Error fetching madarsa details for hall ticket:", error);
    }
  }
  let timetableEntries = [];
  const examTitle = exam?.title;
  if (examTitle) {
    try {
      const examsRef = collection(db, "exams");
      const q = query(examsRef, where("title", "==", examTitle));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const exams = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        exams.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return bTime - aTime;
        });
        const latestExam = exams[0];
        timetableEntries = latestExam.timetableEntries || [];
      }
    } catch (error) {
      console.error("Error fetching exam timetable:", error);
    }
  }
  return {
    hallTicketNumber,
    examTitle: exam?.title || "N/A",
    fullName: student.fullName || "N/A",
    middleName: student?.middleName || student?.midNumber || "",
    midNumber: student?.midNumber || "",
    admissionNumber: student.admissionNumber || "N/A",
    classLevel: student.classLevel || "N/A",
    gender: student.gender || "N/A",
    guardianPhone: student.guardianPhone || "N/A",
    madarsa: student?.madarsaId || "N/A",
    madarsaId: madarsaId,
    mekhala: mekhala,
    sadarName: sadarName,
    sadarAddress: sadarAddress,
    examDate: exam?.examDate,
    createdAt: new Date(),
    profilePictureUrl,
    examFees: exam?.fees || 0,
    timetableEntries: timetableEntries
  };
}

// Exported helpers
export const fetchEligibleRegistrations = async (examId) => {
  const constraints = [
    where("examId", "==", examId),
    where("paymentStatus", "in", ["completed", "waived"])
  ];
  return await getDocuments(COLLECTIONS.EXAM_REGISTRATIONS, constraints);
};

export const uploadHallTicketForRegistration = async (registration, exam, madrasas, mekhalas) => {
  if (!registration) throw new Error('Registration required');

  console.log(`Starting hall ticket upload for registration ${registration.id}, exam ${exam.id}`);

  const student = await getDocument(COLLECTIONS.STUDENTS, registration.studentId);
  if (!student) throw new Error('Student not found');

  const hallTicketData = await prepareHallTicketData(student, registration, exam, madrasas, mekhalas);
  console.log(`Prepared hall ticket data for student ${student.fullName}`);

  // Generate PDF
  console.log('Generating PDF...');
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  const doc = new jsPDF('p', 'mm', 'a4');

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '210mm';
  container.style.backgroundColor = 'white';
  container.style.padding = '10mm';
  container.innerHTML = generateHallTicketHTML(hallTicketData);
  document.body.appendChild(container);

  const images = container.querySelectorAll('img');
  await Promise.all(Array.from(images).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
  }));

    const canvas = await html2canvas(container, { scale: 1.5, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });
  document.body.removeChild(container);
    const imgData = canvas.toDataURL('image/jpeg', 0.5);
  const pdfWidth = doc.internal.pageSize.getWidth();
  const pdfHeight = doc.internal.pageSize.getHeight();
  doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

  // Convert to blob
  const pdfBlob = doc.output('blob');
  const pdfFile = new File([pdfBlob], `hall_ticket_${hallTicketData.admissionNumber || registration.id}.pdf`, { type: 'application/pdf' });
  console.log('PDF generated successfully');

  // Upload to Firebase Storage
  console.log(`Uploading PDF to Firebase Storage under exams/hallticket/${exam.id}...`);
  const uploadResult = await uploadFile(pdfFile, `exams/hallticket/${exam.id}`);
  console.log(`PDF uploaded successfully. Download URL: ${uploadResult.url}`);

  // Save hall ticket data and URL directly inside the registration document
  console.log('Saving hall ticket data and URL to Firestore...');
  await updateDocument(COLLECTIONS.EXAM_REGISTRATIONS, registration.id, {
    hallTicket: hallTicketData,
    hallTicketUrl: uploadResult.url
  });
  console.log(`Hall ticket data and URL saved for registration ${registration.id}`);

  return uploadResult.url;
};

export const uploadAllRegistrations = async (examId, madrasas = [], mekhalas = [], onProgress = null) => {
  const exam = await getDocument(COLLECTIONS.EXAMS, examId);
  if (!exam) throw new Error("Exam not found");

  const registrations = await fetchEligibleRegistrations(examId);
  for (let i = 0; i < registrations.length; i++) {
    const reg = registrations[i];
    try {
      await uploadHallTicketForRegistration(reg, exam, madrasas, mekhalas);
      if (onProgress) onProgress(i + 1, registrations.length, reg);
    } catch (err) {
      console.error(`Failed uploading registration ${reg.id}:`, err);
      // continue with next
    }
  }

  return registrations.length;
};

// Main fix-admit function
export default async function fixAdmitForExam(examId, madrasas, mekhalas) {
  // 1. Fetch exam
  const exam = await getDocument(COLLECTIONS.EXAMS, examId);
  if (!exam) throw new Error("Exam not found");

  // 2. Upload all eligible registrations (sequential)
  const count = await uploadAllRegistrations(examId, madrasas, mekhalas);
  return count;
}
