// PDF Generation utilities
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

// Helper function to format dates for PDF
const formatExamDate = (dateValue) => {
  if (!dateValue) return "N/A";

  try {
    // Handle Firestore Timestamp
    if (dateValue && typeof dateValue.toDate === "function") {
      return dateValue.toDate().toLocaleDateString();
    }

    // Handle Date object or string
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return "Invalid date";
    }

    return date.toLocaleDateString();
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Date error";
  }
};

// Helper function to format DOB (Date of Birth)
const formatDOB = (dobValue) => {
  if (!dobValue) return "";

  try {
    // If it's already a properly formatted string (DD/MM/YYYY or similar), return it
    if (typeof dobValue === "string") {
      // Check if it's a valid date string (not a random number string)
      if (dobValue.length > 10 || /^\d{10,}$/.test(dobValue)) {
        // Invalid format - likely a timestamp or malformed data
        return "";
      }
      // Check if it looks like a date (contains slashes or dashes)
      if (/[\/-]/.test(dobValue)) {
        return dobValue;
      }
    }

    // Handle Firestore Timestamp
    if (dobValue && typeof dobValue.toDate === "function") {
      return dobValue.toDate().toLocaleDateString("en-GB");
    }

    // Handle Date object or valid date string
    const date = new Date(dobValue);
    if (isNaN(date.getTime())) {
      return "";
    }

    // Format as DD/MM/YYYY
    return date.toLocaleDateString("en-GB");
  } catch (error) {
    console.error("Error formatting DOB:", error);
    return "";
  }
};

// Helper function to load images for PDF
const loadImage = async (imagePath) => {
  try {
    const response = await fetch(imagePath);
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`Error loading image ${imagePath}:`, error);
    return null;
  }
};

// Trim surrounding whitespace from a PNG/JPEG dataURL by cropping to non-white pixels.
// This is used to make inline header images scale based on actual glyph bounds,
// rather than being limited by big transparent/white margins in the source image.
const trimImageWhitespace = async (dataUrl) => {
  try {
    if (!dataUrl) return dataUrl;
    if (typeof window === "undefined") return dataUrl;

    const img = new Image();
    img.crossOrigin = "anonymous";

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return dataUrl;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return dataUrl;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    // Consider pixels with alpha > 10 and not near-white as content.
    const alphaThreshold = 10;
    const whiteThreshold = 245;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        if (a <= alphaThreshold) continue;
        if (r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold)
          continue;

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    // If nothing found, keep original.
    if (maxX < 0 || maxY < 0) return dataUrl;

    // Add a small padding so the crop doesn't cut off anti-aliasing.
    const pad = 2;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width - 1, maxX + pad);
    maxY = Math.min(height - 1, maxY + pad);

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    if (cropW <= 0 || cropH <= 0) return dataUrl;

    const out = document.createElement("canvas");
    out.width = cropW;
    out.height = cropH;
    const outCtx = out.getContext("2d");
    if (!outCtx) return dataUrl;

    outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    return out.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
};

export const generateAdmissionSlip = (studentData, madarsaData = null) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setFont(undefined, "bold");
  doc.text("DARUL KHAIR JAMIA UNIVERSITY", 105, 20, { align: "center" });

  doc.setFontSize(14);
  doc.setFont(undefined, "normal");
  doc.text("Admission Slip", 105, 30, { align: "center" });

  // Add a line
  doc.line(20, 35, 190, 35);

  // Student Information
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Student Information:", 20, 50);

  doc.setFont(undefined, "normal");
  let yPosition = 60;
  const lineHeight = 8;

  const studentInfo = [
    ["Name:", studentData.fullName || "N/A"],
    ["Email:", studentData.email || "N/A"],
    ["Phone:", studentData.phone || "N/A"],
    ["Date of Birth:", studentData.dateOfBirth || "N/A"],
    ["Gender:", studentData.gender || "N/A"],
    ["Address:", studentData.address || "N/A"],
    ["Class:", studentData.class || "N/A"],
    ["Mahal:", madarsaData?.name || "N/A"],
    [
      "Admission Date:",
      new Date(
        studentData.createdAt?.seconds * 1000 || studentData.createdAt,
      ).toLocaleDateString(),
    ],
    ["Student ID:", studentData.id || "N/A"],
  ];

  studentInfo.forEach(([label, value]) => {
    doc.text(label, 25, yPosition);
    doc.text(value, 80, yPosition);
    yPosition += lineHeight;
  });

  // Parent Information (if available)
  if (studentData.parentDetails) {
    yPosition += 10;
    doc.setFont(undefined, "bold");
    doc.text("Parent/Guardian Information:", 20, yPosition);
    yPosition += 10;

    doc.setFont(undefined, "normal");
    const parentInfo = [
      ["Father's Name:", studentData.parentDetails.fatherName || "N/A"],
      ["Mother's Name:", studentData.parentDetails.motherName || "N/A"],
      ["Parent Phone:", studentData.parentDetails.phone || "N/A"],
      ["Parent Email:", studentData.parentDetails.email || "N/A"],
    ];

    parentInfo.forEach(([label, value]) => {
      doc.text(label, 25, yPosition);
      doc.text(value, 80, yPosition);
      yPosition += lineHeight;
    });
  }

  // Footer
  yPosition = 250;
  doc.line(20, yPosition, 190, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.text(
    "This is a computer-generated document and does not require a signature.",
    105,
    yPosition,
    { align: "center" },
  );
  yPosition += 5;
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, yPosition, {
    align: "center",
  });

  // Add logo placeholder
  doc.setFontSize(8);
  doc.text("DKJU Logo", 20, 20);

  return doc;
};

export const generateTeacherSlip = (teacherData, madarsaData = null) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setFont(undefined, "bold");
  doc.text("DARUL KHAIR JAMIA UNIVERSITY", 105, 20, { align: "center" });

  doc.setFontSize(14);
  doc.setFont(undefined, "normal");
  doc.text("Teacher Information Slip", 105, 30, { align: "center" });

  // Add a line
  doc.line(20, 35, 190, 35);

  // Teacher Information
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Teacher Information:", 20, 50);

  doc.setFont(undefined, "normal");
  let yPosition = 60;
  const lineHeight = 8;

  const teacherInfo = [
    ["Name:", teacherData.fullName || "N/A"],
    ["Email:", teacherData.email || "N/A"],
    ["Phone:", teacherData.phone || "N/A"],
    ["Subject:", teacherData.subject || "N/A"],
    ["Qualification:", teacherData.qualification || "N/A"],
    ["Experience:", teacherData.experience || "N/A"],
    ["Date of Birth:", teacherData.dateOfBirth || "N/A"],
    ["Address:", teacherData.address || "N/A"],
    ["Mahal:", madarsaData?.name || "N/A"],
    [
      "Joining Date:",
      new Date(
        teacherData.createdAt?.seconds * 1000 || teacherData.createdAt,
      ).toLocaleDateString(),
    ],
    ["Teacher ID:", teacherData.id || "N/A"],
  ];

  teacherInfo.forEach(([label, value]) => {
    doc.text(label, 25, yPosition);
    doc.text(value, 80, yPosition);
    yPosition += lineHeight;
  });

  // Specializations (if available)
  if (teacherData.specializations && teacherData.specializations.length > 0) {
    yPosition += 10;
    doc.setFont(undefined, "bold");
    doc.text("Specializations:", 20, yPosition);
    yPosition += 8;

    doc.setFont(undefined, "normal");
    teacherData.specializations.forEach((spec, index) => {
      doc.text(`${index + 1}. ${spec}`, 25, yPosition);
      yPosition += lineHeight;
    });
  }

  // Footer
  yPosition = 250;
  doc.line(20, yPosition, 190, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.text(
    "This is a computer-generated document and does not require a signature.",
    105,
    yPosition,
    { align: "center" },
  );
  yPosition += 5;
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, yPosition, {
    align: "center",
  });

  return doc;
};

export const generateMahalReport = (
  madarsaData,
  studentsData = [],
  teachersData = [],
) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setFont(undefined, "bold");
  doc.text("DARUL KHAIR JAMIA UNIVERSITY", 105, 20, { align: "center" });

  doc.setFontSize(14);
  doc.setFont(undefined, "normal");
  doc.text("Madrasa Report", 105, 30, { align: "center" });

  // Add a line
  doc.line(20, 35, 190, 35);

  // Madrasa Information
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Mahal Information:", 20, 50);

  doc.setFont(undefined, "normal");
  let yPosition = 60;
  const lineHeight = 8;

  const madarsaInfo = [
    ["Mahal Name:", madarsaData.name || "N/A"],
    ["Address:", madarsaData.address || "N/A"],
    ["Phone:", madarsaData.phone || "N/A"],
    ["Email:", madarsaData.email || "N/A"],
    ["Admin Name:", madarsaData.adminName || "N/A"],
    ["Admin Email:", madarsaData.adminEmail || "N/A"],
    ["Capacity:", madarsaData.capacity || "N/A"],
    ["Established:", madarsaData.established || "N/A"],
    ["Total Students:", studentsData.length],
    ["Total Teachers:", teachersData.length],
  ];

  madarsaInfo.forEach(([label, value]) => {
    doc.text(label, 25, yPosition);
    doc.text(value, 80, yPosition);
    yPosition += lineHeight;
  });

  // Students Table
  if (studentsData.length > 0) {
    yPosition += 15;
    doc.setFont(undefined, "bold");
    doc.text("Students List:", 20, yPosition);
    yPosition += 10;

    const studentTableData = studentsData.map((student, index) => [
      index + 1,
      student.fullName || "N/A",
      student.class || "N/A",
      student.email || "N/A",
      student.phone || "N/A",
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["#", "Name", "Class", "Email", "Phone"]],
      body: studentTableData,
      theme: "striped",
      headStyles: { fillColor: [45, 45, 45] },
      margin: { left: 20, right: 20 },
    });

    yPosition = doc.lastAutoTable.finalY + 15;
  }

  // Teachers Table
  if (teachersData.length > 0) {
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFont(undefined, "bold");
    doc.text("Teachers List:", 20, yPosition);
    yPosition += 10;

    const teacherTableData = teachersData.map((teacher, index) => [
      index + 1,
      teacher.fullName || "N/A",
      teacher.subject || "N/A",
      teacher.email || "N/A",
      teacher.phone || "N/A",
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["#", "Name", "Subject", "Email", "Phone"]],
      body: teacherTableData,
      theme: "striped",
      headStyles: { fillColor: [45, 45, 45] },
      margin: { left: 20, right: 20 },
    });
  }

  // Footer
  const finalY = doc.internal.pageSize.height - 20;
  doc.line(20, finalY - 10, 190, finalY - 10);

  doc.setFontSize(10);
  doc.text("This is a computer-generated report.", 105, finalY - 5, {
    align: "center",
  });
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, finalY, {
    align: "center",
  });

  return doc;
};

export const downloadPDF = (doc, filename) => {
  doc.save(filename);
};

export const generateNoticesReport = (notices, madarsas = []) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setFont(undefined, "bold");
  doc.text("DARUL KHAIR JAMIA UNIVERSITY", 105, 20, { align: "center" });

  doc.setFontSize(14);
  doc.setFont(undefined, "normal");
  doc.text("Central Admin Notices Report", 105, 30, { align: "center" });

  // Add a line
  doc.line(20, 35, 190, 35);

  // Summary
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Summary:", 20, 50);

  doc.setFont(undefined, "normal");
  let yPosition = 60;
  const lineHeight = 8;

  const summary = [
    ["Total Notices:", notices.length.toString()],
    ["Active Madrasas:", madarsas.length.toString()],
    [
      "High Priority:",
      notices.filter((n) => n.priority === "high").length.toString(),
    ],
    [
      "Medium Priority:",
      notices.filter((n) => n.priority === "medium").length.toString(),
    ],
    [
      "Low Priority:",
      notices.filter((n) => n.priority === "low").length.toString(),
    ],
    ["Generated On:", new Date().toLocaleDateString()],
  ];

  summary.forEach(([label, value]) => {
    doc.text(label, 25, yPosition);
    doc.text(value, 80, yPosition);
    yPosition += lineHeight;
  });

  // Notices Table
  if (notices.length > 0) {
    yPosition += 15;
    doc.setFont(undefined, "bold");
    doc.text("Notices Details:", 20, yPosition);
    yPosition += 10;

    const noticesTableData = notices.map((notice, index) => [
      index + 1,
      notice.title || "N/A",
      notice.priority || "N/A",
      notice.targetAudience || "N/A",
      notice.targetMahals?.length === 0
        ? "All Madrasas"
        : `${notice.targetMahals?.length || 0} Madrasas`,
      new Date(
        notice.createdAt?.seconds * 1000 || notice.createdAt,
      ).toLocaleDateString(),
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["#", "Title", "Priority", "Audience", "Target", "Date"]],
      body: noticesTableData,
      theme: "striped",
      headStyles: { fillColor: [45, 45, 45] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
      },
    });

    yPosition = doc.lastAutoTable.finalY + 15;
  }

  // Mahals Summary
  if (madarsas.length > 0) {
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFont(undefined, "bold");
    doc.text("Active Madarsas:", 20, yPosition);
    yPosition += 10;

    const madarsasTableData = madarsas.map((madarsa, index) => [
      index + 1,
      madarsa.name || "N/A",
      madarsa.address || "N/A",
      madarsa.adminName || "N/A",
      madarsa.phone || "N/A",
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["#", "Mahal Name", "Address", "Admin", "Phone"]],
      body: madarsasTableData,
      theme: "striped",
      headStyles: { fillColor: [45, 45, 45] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 9 },
    });
  }

  // Footer
  const finalY = doc.internal.pageSize.height - 20;
  doc.line(20, finalY - 10, 190, finalY - 10);

  doc.setFontSize(10);
  doc.text(
    "This is a computer-generated report from Central Admin Dashboard.",
    105,
    finalY - 5,
    { align: "center" },
  );
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, finalY, {
    align: "center",
  });

  return doc;
};

export const generateAttendanceSheet = async (
  examData,
  registeredStudents,
  selectedClass = null,
  selectedMahal = null,
  rowCount = null,
  language = "ml", // 'ml' for Malayalam, 'en' for English
  madarsaData = null,
) => {
  const doc = new jsPDF();

  // console.log(registeredStudents);

  console.log(selectedMahal);
  console.log("examData", examData);

  // Load Noto Sans Malayalam font for both English and Malayalam
  try {
    // Attempt to load Noto Sans Malayalam font
    // Note: Font file should be placed in public folder
    const fontResponse = await fetch("/fonts/NotoSansMalayalam-Regular.ttf");
    if (fontResponse.ok) {
      const fontBlob = await fontResponse.blob();
      const fontBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(fontBlob);
      });

      doc.addFileToVFS("NotoSansMalayalam-Regular.ttf", fontBase64);
      doc.addFont(
        "NotoSansMalayalam-Regular.ttf",
        "NotoSansMalayalam",
        "normal",
      );
      doc.setFont("NotoSansMalayalam");
    }
  } catch (error) {
    console.warn(
      "Noto Sans Malayalam font not found, using default font:",
      error,
    );
  }

  // Helper function to set font based on language
  const setLangFont = (doc, language, style = "normal") => {
    if (language === "ml") {
      doc.setFont("NotoSansMalayalam", style);
    } else {
      doc.setFont("helvetica", style);
    }
  };

  // Full class mapping for headers and counting
  const classMapping = {
    all: "all",
    ukg: "Ukg",
    lkg: "LKG",
    UKG: "Ukg",
    Ukg: "Ukg",
    LKG: "LKG",
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
    9: "IX",
    10: "X",
    11: "XI",
    12: "XII",
    I: "I",
    II: "II",
    III: "III",
    IV: "IV",
    V: "V",
    VI: "VI",
    VII: "VII",
    VIII: "VIII",
    IX: "IX",
    X: "X",
    XI: "XI",
    XII: "XII",
  };

  const classDisplayOrder = [
    "LKG",
    "Ukg",
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ];

  const sortClassLabels = (arr) =>
    [...arr].sort(
      (a, b) =>
        (classDisplayOrder.indexOf(a) === -1
          ? 99
          : classDisplayOrder.indexOf(a)) -
        (classDisplayOrder.indexOf(b) === -1
          ? 99
          : classDisplayOrder.indexOf(b)),
    );

  const getActiveClassLabels = () => {
    // Derive unique class labels from the actual registered students
    const deriveFromStudents = () => {
      const unique = [
        ...new Set(
          registeredStudents
            .map((s) => {
              const raw = s?.classLevel || s?.class || s?.standard || "";
              return (
                classMapping[raw] ||
                classMapping[String(raw).toLowerCase()] ||
                classMapping[String(raw).toUpperCase()] ||
                raw
              );
            })
            .filter((v) => Boolean(v) && v !== "all"),
        ),
      ];
      return unique.length > 0 ? sortClassLabels(unique).join(", ") : "";
    };

    if (!selectedClass || selectedClass.length === 0) {
      return deriveFromStudents();
    }
    const classArr = Array.isArray(selectedClass)
      ? selectedClass
      : selectedClass.split(",").map((s) => s.trim());

    if (classArr.includes("all")) return deriveFromStudents();

    return sortClassLabels(classArr.map((c) => classMapping[c] || c)).join(
      ", ",
    );
  };

  const activeClassesStr = getActiveClassLabels();

  // Extract year from exam title if available
  let displayYear = "2026";
  let hijraYear = "1447";
  const yearMatch = examData.title?.match(/20\d{2}/);
  if (yearMatch) {
    displayYear = yearMatch[0];
    hijraYear = (parseInt(displayYear) - 579).toString();
  }

  const texts = {
    ml: {
      header1Prefix: `ഹിജ്‌റ: ${hijraYear} (${displayYear}) ലെ `,
      header1Classes: activeClassesStr,
      header1Suffix: " ക്ലാസ്സുകളിലെ",
      header2:
        "പബ്ലിക്  പരീക്ഷയിൽ പങ്കെടുക്കുന്ന  കുട്ടികളുടെ  ഹാജർ രേഖപ്പെടുത്താനുള്ള ഫോറം",
      mekhala: "മേഘല:",
      madrasa: "മദ്രസ:",
      address: "വിലാസം:",
      place: "സ്ഥലം:",
      srNo: "ക്രമ നമ്പർ",
      mid: "MID",
      rollNo: "ഹാൾ ടിക്കറ്റ് നമ്പർ",
      totalStudents: "ആകെ വിദ്യാർത്ഥികൾ",
      totalLabel: "ആകെപ്പെട്ട",
      stdLabel: "Std",
      marks: "മാർക്ക്",
      grade: "ഗ്രേഡ്",
      supervisorName: "സൂപ്പർവൈസറുടെ പേരും ഒപ്പും",
      instruction:
        "ഈ ഹാജർപ്പട്ടിക കോൺവീനർ കൊണ്ടുവരണം എന്നുള്ളതും എപ്പോഴും ഓർമിപ്പിക്കുന്നു.",
      supervisor: "സൂപ്പർവൈസർ/കൺവീനർ കോൺവീനർ ഇന്റെ ഒപ്പും മുദ്രയും",
      centerNote: "പരീക്ഷാ കേന്ദ്രം പോലും മുഹൂർത്തം",
      examBoard: "പരീക്ഷാ ബോർഡ് DKIMVB",
      address1: "പാലുവള്ളി - അബ്ബൂബക്കർ മർക്കം",
      address2: "ജുമുഅ മസ്ജിദ് - മൊറക്ക മുക്ക്",
      address3: "മുതുകുളം പി.ഒ, നെയ്യാറ്റിൻകര: 695603",
      phone: "ഫോൺ: 8891177850",
    },
    en: {
      header1:
        "Form for recording the attendance of students appearing for the Public Examination ",
      header2Prefix: "of classes ",
      header2Classes: activeClassesStr,
      header2Suffix: ` in Hijra: ${hijraYear} (${displayYear}).`,
      mekhala: "Mekhala:",
      madrasa: "Madrasa:",
      address: "Address:",
      place: "Place:",
      srNo: "S.No",
      mid: "MID",
      rollNo: "Hall Ticket",
      totalStudents: "Total Students",
      totalLabel: "Total",
      stdLabel: "Std",
      marks: "Marks",
      grade: "Grade",
      supervisorName: "Name and Signature of Supervisor",
      instruction: "This attendance sheet must be brought by the Convener",
      supervisor: "Supervisor / Convener Signature & Seal",
      centerNote: "Examination Center Note",
      examBoard: "DKIMVB Examination Board",
      address1: "Paluvally - Abbubakar Markam",
      address2: "Jumu'ah Masjid - Morakka Mukku",
      address3: "Muthukulam P.O, Neyyattinkara: 695603",
      phone: "Phone: 8891177850",
    },
  };

  const t = texts[language] || texts.en;

  // Page setup
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // --- HEADER SECTION WITH TOP BANNER ---
  let yPosition = 10;

  try {
    // Load and display top banner image (htup.png)
    const imgUp = await loadImage("/htup.png");
    if (imgUp) {
      const bannerWidth = 150;
      const bannerHeight = 15;
      doc.addImage(
        imgUp,
        "PNG",
        (pageWidth - bannerWidth) / 2,
        yPosition,
        bannerWidth,
        bannerHeight,
      );
      yPosition += bannerHeight + 5;
    }
  } catch (error) {
    console.error("Error loading top banner image:", error);
  }

  // Main heading
  doc.setFontSize(10);
  setLangFont(doc, language, "normal");

  // Space to move down after rendering the main heading.
  // For Malayalam (image-based) heading we expand this based on image height
  // to avoid overlap with the next section.
  let headerAdvance = 10;

  if (language === "ml") {
    // CTO request: avoid spelling issues by using an image for the Malayalam heading.
    // Requirement: start the heading image immediately after the class text.
    // Preferred file: public/dkjuheadmeaster.png
    // Fallback: public/dkju-headermalayalam.png
    let headingImg = null;
    try {
      headingImg = await loadImage("/dkju-headermalayalam.png");
      // Remove large margins in the PNG so inline scaling can match text height.
      headingImg = await trimImageWhitespace(headingImg);
    } catch (error) {
      console.error("Error loading attendance heading image:", error);
    }

    const prefixText = t.header1Prefix;
    const classesText = t.header1Classes;

    setLangFont(doc, language, "normal");
    const prefixWidth = doc.getTextWidth(prefixText);

    setLangFont(doc, language, "bold");
    const classesWidth = doc.getTextWidth(classesText);
    setLangFont(doc, language, "normal");

    // Scale the image to fit inline after the classes.
    let imgW = 0;
    let imgH = 0;
    const gap = 3;
    if (headingImg) {
      try {
        const props = doc.getImageProperties(headingImg);
        // Target inline height. Width is still constrained to the remaining line width.
        // Keep it on ONE line by constraining to the remaining space within margins.
        const maxH = 152;
        const maxInlineW = Math.max(
          0,
          contentWidth - prefixWidth - classesWidth - gap,
        );
        const scaleH = maxH / props.height;
        const scaleW = maxInlineW / props.width;
        const scale = Math.min(scaleH, scaleW);
        imgW = props.width * scale;
        imgH = props.height * scale;
      } catch {
        headingImg = null;
      }
    }

    const totalWidth =
      prefixWidth + classesWidth + (headingImg ? gap + imgW : 0);
    // Place the full heading on a single line ending at the right margin.
    // This keeps the suffix image at the end of the line.
    const startX = pageWidth - margin - totalWidth;

    doc.text(prefixText, startX, yPosition);
    setLangFont(doc, language, "bold");
    doc.text(classesText, startX + prefixWidth, yPosition);
    setLangFont(doc, language, "normal");

    if (headingImg) {
      const imgX = startX + prefixWidth + classesWidth + gap;
      // Align the image with the text baseline.
      const imgY = yPosition - imgH;
      doc.addImage(headingImg, "PNG", imgX, imgY, imgW, imgH);

      // Ensure we move far enough down for the next section.
      headerAdvance = Math.max(headerAdvance, imgH + 4);
    }
  } else {
    doc.text(t.header1, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 6;
    doc.setFontSize(9);

    const fullHeader2 = `${t.header2Prefix}${t.header2Classes}${t.header2Suffix}`;
    const totalWidth = doc.getTextWidth(fullHeader2);
    const startX = (pageWidth - totalWidth) / 2;

    doc.text(t.header2Prefix, startX, yPosition);
    const prefixWidth = doc.getTextWidth(t.header2Prefix);

    // Draw Classes (Bold)
    setLangFont(doc, language, "bold");
    doc.text(t.header2Classes, startX + prefixWidth, yPosition);
    const classesWidth = doc.getTextWidth(t.header2Classes);
    setLangFont(doc, language, "normal");

    // Draw Suffix
    doc.text(t.header2Suffix, startX + prefixWidth + classesWidth, yPosition);
  }

  yPosition += headerAdvance;

  // Form fields section
  doc.setFontSize(10);
  setLangFont(doc, language, "normal");

  const mekhalaValue =
    madarsaData?.mekhala ||
    madarsaData?.mekhalaName ||
    madarsaData?.mehkala ||
    madarsaData?.mehkalaName ||
    registeredStudents?.[0]?.mekhala ||
    registeredStudents?.[0]?.mekhalaName ||
    registeredStudents?.[0]?.mehkala ||
    registeredStudents?.[0]?.mehkalaName ||
    "";

  // First line: Mekhala (full width)
  doc.text(t.mekhala, margin, yPosition);
  setLangFont(doc, language, "normal");
  const mekhalLabelWidth = language === "ml" ? 16 : 18;
  doc.text(String(mekhalaValue || ""), margin + mekhalLabelWidth, yPosition);

  // Draw underline for mekhala
  doc.setLineWidth(0.3);

  yPosition += 6;

  // New line: Address (full width)
  doc.text(t.address, margin, yPosition);
  const addressLabelWidth = language === "ml" ? 16 : 18;
  const addressValue =
    madarsaData?.address || registeredStudents[0]?.madarsaAddress || "";
  doc.text(addressValue, margin + addressLabelWidth, yPosition);

  // Draw underline for address

  yPosition += 6;

  // Second line: Madrasa and Place (side by side)
  const col1Start = margin;
  const col2Start = pageWidth / 2;

  // Madrasa label and value
  doc.text(t.madrasa, col1Start, yPosition);
  setLangFont(doc, language, "normal");
  const madrasaLabelWidth = language === "ml" ? 16 : 18;
  const madrasaValue = selectedMahal ? selectedMahal : "";
  doc.text(madrasaValue, col1Start + madrasaLabelWidth, yPosition);

  // Draw underline for madrasa

  // Draw underline for place

  yPosition += 3;
  const subjectColumns = [];
  if (examData.timetableEntries && examData.timetableEntries.length > 0) {
    // Sort entries by date
    const sortedEntries = [...examData.timetableEntries].sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateA - dateB;
    });

    sortedEntries.forEach((entry) => {
      if (entry.subject || entry.title) {
        subjectColumns.push({
          subject: entry.subject || entry.title || "Subject",
          date: entry.date
            ? new Date(entry.date).toLocaleDateString("en-GB")
            : "",
          startTime: entry.startTime || "8:30 AM",
          endTime: entry.endTime || "10:30 AM",
          time:
            entry.time ||
            `${entry.startTime || "8:30 AM"} - ${entry.endTime || "10:30 AM"}`,
        });
      }
    });
  }

  // Default to 2 subject columns if none provided
  if (subjectColumns.length === 0) {
    subjectColumns.push({
      subject: "Subject : _________",
      date: "Date : __________",
      time: "___________________",
      startTime: "______ : ",
      endTime: "______",
    });
  }

  // Group subjects by date
  const dateGroups = {};
  subjectColumns.forEach((subjectInfo) => {
    const date = subjectInfo.date || "No Date";
    if (!dateGroups[date]) {
      dateGroups[date] = [];
    }
    dateGroups[date].push(subjectInfo);
  });

  // Create table header with single row containing divided cells
  const tableHeaderRow = [];

  // Image-based header labels. If images are missing, we fall back to text.
  // Files expected in /public:
  // - serial_number.png
  // - hall_ticket.png
  // - mark.png
  // - grade.png
  const headerLabelImages =
    language === "ml"
      ? {
          slno: await loadImage("/serial_number.png"),
          hallticket: await loadImage("/hall_ticket.png"),
          mark: await loadImage("/mark.png"),
          grade: await loadImage("/grade.png"),
        }
      : {
          slno: null,
          hallticket: null,
          mark: null,
          grade: null,
        };

  // Add fixed columns with rowSpan
  tableHeaderRow.push({
    content: headerLabelImages.slno ? "" : t.srNo,
    styles: { halign: "center", fontSize: 8 },
    rowSpan: 2,
  });
  tableHeaderRow.push({
    content: t.mid,
    styles: { halign: "center", fontSize: 8 },
    rowSpan: 2,
  });
  tableHeaderRow.push({
    content: headerLabelImages.hallticket ? "" : t.rollNo,
    styles: { halign: "center", fontSize: 8 },
    rowSpan: 2,
  });
  tableHeaderRow.push({
    content: headerLabelImages.mark ? "" : t.marks,
    styles: { halign: "center", fontSize: 8 },
    rowSpan: 2,
  });
  tableHeaderRow.push({
    content: headerLabelImages.grade ? "" : t.grade,
    styles: { halign: "center", fontSize: 8 },
    rowSpan: 2,
  });

  // Add date headers with colSpan
  Object.keys(dateGroups).forEach((date) => {
    const subjectsForDate = dateGroups[date];
    tableHeaderRow.push({
      content: date,
      colSpan: subjectsForDate.length,
      styles: { halign: "center", fontSize: 8, fontStyle: "normal" },
    });
  });

  // Create second header row with subject names and times
  const subjectHeaderRow = [];

  // Add subject names and times for each date group
  Object.keys(dateGroups).forEach((date) => {
    const subjectsForDate = dateGroups[date];

    subjectsForDate.forEach((subjectInfo) => {
      subjectHeaderRow.push({
        content: `${subjectInfo.subject}\n(${subjectInfo.time})`,
        styles: { halign: "center", fontSize: 6 },
      });
    });
  });

  // Create head with two rows
  const tableHead = [tableHeaderRow, subjectHeaderRow];

  // Determine number of rows
  const totalRows = rowCount || registeredStudents.length || 30;

  // Create table rows with prefilled data if available
  const tableRows = [];
  for (let i = 0; i < totalRows; i++) {
    const student = registeredStudents[i];
    const row = [];

    // Serial number (1, 2, 3, ...)
    row.push((i + 1).toString());

    // MID Number
    const midNumber = student.admissionNumber || student.midNumber || "N/A";
    row.push(midNumber);

    // Roll number (admissionNumber, rollNumber, midNumber, studentId, or uid)
    // Hall Ticket Number Calculation (matching generateHallTicketPDF logic)
    const hallTicketNumber =
      student.hallTicketNumber || student.rollNumber || "N/A";
    row.push(hallTicketNumber);

    // Add empty cells for Marks and Grade
    row.push(""); // Marks
    row.push(""); // Grade

    // Add empty cells for each subject (for attendance marking)
    subjectColumns.forEach(() => row.push(""));
    tableRows.push(row);
  }

  autoTable(doc, {
    head: tableHead,
    body: tableRows,
    startY: yPosition,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: {
      font: language === "ml" ? "NotoSansMalayalam" : "helvetica",
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      font: language === "ml" ? "NotoSansMalayalam" : "helvetica",
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "normal",
      halign: "center",
      valign: "middle",
      lineWidth: 0.3,
      lineColor: [0, 0, 0],
      cellPadding: 2,
      minCellHeight: 18,
    },
    columnStyles: {
      0: { cellWidth: 12 }, // Sr. No
      1: { cellWidth: 20 }, // MID
      2: { cellWidth: 25 }, // Roll No
      3: { cellWidth: 15 }, // Marks
      4: { cellWidth: 15 }, // Grade
      // Subject columns will auto-distribute remaining width
    },
    didDrawCell: (data) => {
      if (language !== "ml") return;
      if (data.section !== "head") return;
      if (data.row.index !== 0) return; // only the first header row

      const drawImg = (imgData) => {
        if (!imgData) return;
        const padding = 0.5;
        const maxW = data.cell.width - padding * 2;
        const maxH = data.cell.height - padding * 2;
        if (maxW <= 0 || maxH <= 0) return;

        let drawW = maxW;
        let drawH = maxH;
        try {
          const props = doc.getImageProperties(imgData);
          const scale = Math.min(maxW / props.width, maxH / props.height);
          drawW = props.width * scale;
          drawH = props.height * scale;
        } catch {
          // keep fallback sizing
          drawH = Math.min(maxH, 8);
          drawW = Math.min(maxW, drawH * 4);
        }

        const x = data.cell.x + (data.cell.width - drawW) / 2;
        const y = data.cell.y + (data.cell.height - drawH) / 2;
        try {
          doc.addImage(imgData, "PNG", x, y, drawW, drawH);
        } catch (e) {
          // Ignore image draw issues and keep text fallback
        }
      };

      // Column order: 0=SlNo, 1=MID, 2=Hall Ticket, 3=Mark, 4=Grade
      if (data.column.index === 0) drawImg(headerLabelImages.slno);
      if (data.column.index === 2) drawImg(headerLabelImages.hallticket);
      if (data.column.index === 3) drawImg(headerLabelImages.mark);
      if (data.column.index === 4) drawImg(headerLabelImages.grade);
    },
  });

  // --- FOOTER SECTION ---
  // Always add a new page for class counts and supervisor section
  doc.addPage();
  yPosition = margin + 10;

  // Calculate class-wise student counts - reuse classMapping defined above

  const classCounts = {};

  // Count students per class
  registeredStudents.forEach((student) => {
    if (student) {
      const classLevel = (student.classLevel || student.std || "").toString();
      const romanClass = classMapping[classLevel];

      if (romanClass) {
        classCounts[romanClass] = (classCounts[romanClass] || 0) + 1;
      }
    }
  });

  // Get unique sorted class levels from students
  const availableClasses = Object.keys(classCounts).sort((a, b) => {
    const classOrder = [
      "lkg",
      "ukg",
      "I",
      "II",
      "III",
      "IV",
      "V",
      "VI",
      "VII",
      "VIII",
      "IX",
      "X",
      "XI",
      "XII",
    ];
    return classOrder.indexOf(a) - classOrder.indexOf(b);
  });

  // Create a small table for class-wise counts (matching image layout)
  const stdLabel = t.stdLabel;
  const totalLabel = t.totalLabel;

  // Draw vertical table with class counts
  const tableStartY = yPosition;
  const rowHeight = 6;
  const col1Width = 15; // Std column
  const col2Width = 20; // Class number column
  const col3Width = 50; // Total count column

  doc.setFontSize(8);

  // Draw header row
  doc.setLineWidth(0.3);
  doc.rect(margin, tableStartY, col1Width, rowHeight);
  doc.rect(margin + col1Width, tableStartY, col2Width, rowHeight);
  doc.rect(margin + col1Width + col2Width, tableStartY, col3Width, rowHeight);

  setLangFont(doc, language, "normal");
  doc.text(stdLabel, margin + col1Width / 2, tableStartY + 4, {
    align: "center",
  });
  doc.text("Class", margin + col1Width + col2Width / 2, tableStartY + 4, {
    align: "center",
  });
  doc.text(
    totalLabel,
    margin + col1Width + col2Width + col3Width / 2,
    tableStartY + 4,
    { align: "center" },
  );

  // Draw data rows
  availableClasses.forEach((classLevel, index) => {
    const count = classCounts[classLevel] || 0;
    const currentY = tableStartY + rowHeight + index * rowHeight;

    // Draw cell borders
    doc.rect(margin, currentY, col1Width, rowHeight);
    doc.rect(margin + col1Width, currentY, col2Width, rowHeight);
    doc.rect(margin + col1Width + col2Width, currentY, col3Width, rowHeight);

    // Add text content centered
    setLangFont(doc, language, "normal");
    doc.setFontSize(8);
    doc.text(stdLabel, margin + col1Width / 2, currentY + 4, {
      align: "center",
    });
    doc.text(classLevel, margin + col1Width + col2Width / 2, currentY + 4, {
      align: "center",
    });
    doc.text(
      count.toString(),
      margin + col1Width + col2Width + col3Width / 2,
      currentY + 4,
      { align: "center" },
    );
  });

  yPosition = tableStartY + rowHeight * (availableClasses.length + 1) + 8;

  setLangFont(doc, language, "normal");
  doc.setFontSize(7);
  doc.text(t.instruction, pageWidth / 2, yPosition, { align: "center" });

  // Space after instruction
  yPosition += 10;

  // Check if supervisor section fits on current page
  if (yPosition + 45 > pageHeight - margin) {
    doc.addPage();
    yPosition = margin + 10;
  }

  // ---------- Supervisor + dotted signature line ----------
  setLangFont(doc, language, "normal");
  doc.setFontSize(7);

  // Supervisor label
  const labelText = t.supervisorName || "Supervisor";
  doc.text(labelText, margin, yPosition);

  // Calculate dotted line start after text
  const textWidth = doc.getTextWidth(labelText);
  const lineStartX = margin + textWidth + 4;

  // Dotted line
  doc.setLineWidth(0.4);
  doc.setLineDash([0.5, 1]); // dotted effect

  // Reset dash (important)
  doc.setLineDash([]);

  // Space after supervisor line
  yPosition += 10;

  const supervisorBoxStartY = yPosition;
  let supervisorLineY = supervisorBoxStartY + 4;

  // Convener details with border
  doc.setLineWidth(0.5);
  doc.rect(margin, yPosition, 150, 35);

  // Supervisor name and signature line

  // Stamp area
  try {
    // Load and add stamp image
    const stampImg = await loadImage("/stp.png");
    if (stampImg) {
      doc.addImage(stampImg, "PNG", margin + 5, supervisorLineY + 3, 20, 20);
    }
  } catch (error) {
    console.error("Error loading stamp image:", error);
  }

  // Convener information
  const convenerX = margin + 30;
  let convenerY = supervisorBoxStartY + 5;

  setLangFont(doc, language, "normal");
  doc.setFontSize(7);
  doc.text(t.supervisor, convenerX, convenerY);
  convenerY += 4;
  doc.text(t.centerNote, convenerX, convenerY);
  convenerY += 5;

  setLangFont(doc, language, "normal");
  doc.setFontSize(6);
  doc.text(t.examBoard, convenerX, convenerY);
  convenerY += 4;

  setLangFont(doc, language, "normal");
  doc.setFontSize(6);

  // Contact details
  doc.text(t.address1, convenerX, convenerY);
  convenerY += 3;
  doc.text(t.address2, convenerX, convenerY);
  convenerY += 3;
  doc.text(t.address3, convenerX, convenerY);
  convenerY += 3;
  doc.text(t.phone, convenerX, convenerY);

  // Add page numbers to all pages
  const totalPages = doc.internal.pages.length - 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.text(`[${pageNum}]`, pageWidth - margin - 10, pageHeight - 10, {
      align: "right",
    });
  }

  return doc;
};

export const generateHallTicketPDF = (
  studentData,
  examData,
  timetableData = null,
  noticesData = null,
) => {
  const doc = new jsPDF();

  // Page setup for A4
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Header with DKJU Branding
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("Dakshina Kerala Islam Matha Vidyabhyasa Board", pageWidth / 2, 25, {
    align: "center",
  });

  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text("ദക്ഷിണ കേരള ഇസ്ലാം മഠ വിദ്യാഭ്യാസ ബോർഡ്", pageWidth / 2, 32, {
    align: "center",
  });

  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("EXAMINATION HALL TICKET", pageWidth / 2, 40, { align: "center" });

  // Exam title background
  doc.setFillColor(240, 248, 255);
  doc.rect(margin, 50, pageWidth - margin * 2, 12, "F");
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text(examData.title || "N/A", pageWidth / 2, 58, { align: "center" });

  // Hall Ticket Number
  doc.setFillColor(255, 240, 240);
  doc.rect(margin, 68, pageWidth - margin * 2, 12, "F");
  doc.setTextColor(139, 0, 0);
  doc.setFontSize(10);
  doc.setFont(undefined, "bold");

  // Generate hall ticket number
  const baseId = studentData?.admissionNumber || studentData?.uid || "default";
  let hash = 0;
  for (let i = 0; i < baseId.length; i++) {
    const char = baseId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const consistentNumber = Math.abs(hash) % 10000;
  const hallTicketNumber = studentData?.admissionNumber
    ? `${studentData.admissionNumber.substring(
        4,
      )}-${new Date().getFullYear()}-${String(consistentNumber).padStart(
        4,
        "0",
      )}`
    : `${new Date().getFullYear()}${String(consistentNumber).padStart(4, "0")}`;

  doc.text(`Hall Ticket No: ${hallTicketNumber}`, pageWidth / 2, 76, {
    align: "center",
  });
  doc.setTextColor(0, 0, 0);

  let yPosition = 90;

  // Student Information Section
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text("Student Information:", margin, yPosition);
  yPosition += 8;

  doc.setFont(undefined, "normal");
  doc.setFontSize(9);

  // Left side - Student details
  const leftX = margin + 5;
  const rightX = margin + 80;

  const studentInfo = [
    ["Name:", studentData.fullName || "N/A"],
    ["Mid Number:", studentData.middleName || studentData.midNumber || "N/A"],
    ["Admission No:", studentData.admissionNumber || "N/A"],
    ["Class:", studentData.classLevel || "N/A"],
    ["Gender:", studentData.gender || "N/A"],
    ["Parent Phone:", studentData.guardianPhone || "N/A"],
    ["Exam Center:", studentData.madarsa || examData.madarsa || "N/A"],
  ];

  studentInfo.forEach(([label, value]) => {
    doc.text(label, leftX, yPosition);
    doc.text(value, rightX, yPosition);
    yPosition += 5;
  });

  // Photo placeholder (right side)
  const photoX = pageWidth - margin - 35;
  const photoY = 95;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(photoX, photoY, 30, 40);
  doc.setFontSize(7);
  doc.text("Photo", photoX + 15, photoY + 25, { align: "center" });

  yPosition += 10;

  // Exam Details Section
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text("Examination Details:", margin, yPosition);
  yPosition += 8;

  doc.setFont(undefined, "normal");
  doc.setFontSize(9);

  const examDetails = [
    ["Exam Title:", examData.title || "N/A"],
    ["Exam Date:", formatExamDate(examData.examDate) || "N/A"],
    ["Registration Date:", formatExamDate(examData.createdAt) || "N/A"],
    ["Registration Fee:", `₹${examData.examFees || 0}`],
    ["Status:", "APPROVED"],
  ];

  examDetails.forEach(([label, value]) => {
    doc.text(label, leftX, yPosition);
    doc.text(value, rightX, yPosition);
    yPosition += 5;
  });

  yPosition += 10;

  // Timetable Section
  if (timetableData && timetableData.length > 0) {
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("Exam Timetable:", margin, yPosition);
    yPosition += 8;

    doc.setFont(undefined, "normal");
    doc.setFontSize(8);

    timetableData.forEach((timetable, index) => {
      doc.text(`${index + 1}. ${timetable.title || "N/A"}`, leftX, yPosition);
      yPosition += 4;
      if (timetable.description) {
        doc.text(timetable.description, leftX + 5, yPosition);
        yPosition += 4;
      }
    });

    yPosition += 5;
  }

  // Rules Section
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text("Rules to be Obeyed:", margin, yPosition);
  yPosition += 8;

  doc.setFont(undefined, "normal");
  doc.setFontSize(8);
  doc.setFillColor(255, 255, 224);
  doc.rect(margin, yPosition - 3, pageWidth - margin * 2, 35, "F");

  const rules = [
    "• Students must arrive at the examination center 30 minutes before the scheduled time",
    "• Bring this hall ticket and valid photo ID proof to the examination center",
    "• Mobile phones, electronic devices, and prohibited items are strictly not allowed",
    "• Follow all instructions given by the examination invigilators",
    "• Maintain discipline and silence during the examination",
    "• Report any discrepancies in the question paper or hall ticket immediately",
    "• Do not indulge in any malpractices or unfair means",
    "• Leave the examination hall only after submitting the answer sheet",
  ];

  rules.forEach((rule, index) => {
    doc.text(rule, margin + 5, yPosition + index * 4);
  });

  yPosition += 45;

  // Important Notices
  if (noticesData && noticesData.length > 0) {
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("Important Notices:", margin, yPosition);
    yPosition += 8;

    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setFillColor(240, 248, 255);
    doc.rect(
      margin,
      yPosition - 3,
      pageWidth - margin * 2,
      noticesData.length * 6 + 6,
      "F",
    );

    noticesData.forEach((notice, index) => {
      doc.text(`• ${notice.content}`, margin + 5, yPosition + index * 5);
    });

    yPosition += noticesData.length * 6 + 10;
  }

  // Signatures Section
  const signatureY = yPosition;
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");

  // Student Signature
  doc.text("Student Signature", margin + 15, signatureY + 15, {
    align: "center",
  });
  doc.line(margin + 5, signatureY + 10, margin + 25, signatureY + 10);

  // Supervisor Signature
  doc.text("Supervisor Signature", pageWidth / 2, signatureY + 15, {
    align: "center",
  });
  doc.line(
    pageWidth / 2 - 15,
    signatureY + 10,
    pageWidth / 2 + 15,
    signatureY + 10,
  );

  // General Convener Signature (placeholder for image)
  doc.text(
    "General Convener Signature",
    pageWidth - margin - 15,
    signatureY + 15,
    { align: "center" },
  );
  doc.line(
    pageWidth - margin - 25,
    signatureY + 10,
    pageWidth - margin - 5,
    signatureY + 10,
  );

  // Footer
  const footerY = pageHeight - 25;
  doc.setFontSize(8);
  doc.setFont(undefined, "normal");
  doc.text(
    `Generated: ${new Date().toLocaleString()} | DKJU - Exam Dept.`,
    pageWidth / 2,
    footerY,
    { align: "center" },
  );
  doc.text(
    "Computer generated hall ticket. No signature required.",
    pageWidth / 2,
    footerY + 5,
    { align: "center" },
  );

  return doc;
};

export const generateHallTicketNumber = (examId, studentId, classLevel) => {
  const baseId = studentId || "default";

  // Create a stable numeric hash
  let hash = 0;
  for (let i = 0; i < baseId.length; i++) {
    hash = (hash * 31 + baseId.charCodeAt(i)) >>> 0;
  }

  // Convert hash to 10-digit number
  let number = (hash % 1_000_000_0000) // 10 digits max range
    .toString()
    .padStart(10, "0");

  number = "0" + number;

  return number;
};

export const generateResultSheet = async (
  examData,
  registeredStudents,
  selectedClass = null,
  selectedMahal = null,
  language = "ml",
  madarsaData = null,
) => {
  const doc = new jsPDF();

  console.log(registeredStudents);

  // Load Noto Sans Malayalam font for both English and Malayalam
  try {
    // Attempt to load Noto Sans Malayalam font from public folder (local file)
    const fontResponse = await fetch("/fonts/NotoSansMalayalam-Regular.ttf");
    if (fontResponse.ok) {
      const fontBlob = await fontResponse.blob();
      const fontBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(fontBlob);
      });

      doc.addFileToVFS("NotoSansMalayalam-Regular.ttf", fontBase64);
      doc.addFont(
        "NotoSansMalayalam-Regular.ttf",
        "NotoSansMalayalam",
        "normal",
      );
    }
  } catch (error) {
    console.warn(
      "Noto Sans Malayalam font not found, using default font:",
      error,
    );
  }

  // Helper function to set font based on language
  const setLangFont = (doc, language, style = "normal") => {
    if (language === "ml") {
      doc.setFont("NotoSansMalayalam", style);
    } else {
      doc.setFont("helvetica", style);
    }
  };

  // Class mapping for headers and counting
  const classMapping = {
    all: "all",
    ukg: "Ukg",
    lkg: "lkg",
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
    9: "IX",
    10: "X",
    11: "XI",
    12: "XII",
    V: "V",
    VII: "VII",
    X: "X",
    XII: "XII",
  };

  const getActiveClassLabels = () => {
    if (
      !selectedClass ||
      selectedClass.includes("all") ||
      selectedClass.length === 0
    ) {
      return "V, VII, X, XII";
    }
    return (Array.isArray(selectedClass) ? selectedClass : [selectedClass])
      .map((c) => classMapping[c] || c)
      .sort((a, b) => {
        const order = [
          "lkg",
          "ukg",
          "I",
          "II",
          "III",
          "IV",
          "V",
          "VI",
          "VII",
          "VIII",
          "IX",
          "X",
          "XI",
          "XII",
        ];
        return (
          (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) -
          (order.indexOf(b) === -1 ? 99 : order.indexOf(b))
        );
      })
      .join(", ");
  };

  const activeClassesStr = getActiveClassLabels();

  // Extract year from exam title if available
  let displayYear = "2026";
  let hijraYear = "1447";
  const yearMatch = examData.title?.match(/20\d{2}/);
  if (yearMatch) {
    displayYear = yearMatch[0];
    hijraYear = (parseInt(displayYear) - 579).toString(); // Rough Hijra conversion if not found
  }

  const texts = {
    ml: {
      header1Prefix: `${displayYear} (ഹിജ്‌റ ${hijraYear}) ലെ `,
      header1Classes: activeClassesStr,
      header1Suffix: " ക്ലാസ്സുകളിലെ പബ്ലിക് ",
      header2: "പരീക്ഷയ്ക്ക് ചേരാനുള്ള അപേക്ഷാ ഫാറം",
      madrasaFullName: "മദ്രസയുടെ പൂർണ്ണ നാമം",
      address: "വിലാസം",
      class: "ക്ലാസ്",
      examCenter: "പരീക്ഷാകേന്ദ്രം",
      mekhala: "മേഖല",
      slNo: "Sl.\nNo.",
      rollNo: "HallTicket\nNumber",
      regNo: "Register\nNumber",
      studentName: "Student\nName",
      fatherName: "Father\nName",
      dob: "DOB",
      marks: "Marks",
      grade: "Grade",
      totalLabel: "ആകെപ്പെട്ട",
      stdLabel: "Std",
      sadarName: "സദർ നാമം,ഫോൺ നമ്പർ:",
      className: "ക്ലാസ്സ് നാമം,ഫോൺ നമ്പർ:",
      mekhalaConvener: "മേഖല കൺവീനർ പേര്, ഫോൺ നമ്പർ:",
      signatureAndSeal: "ഒപ്പും സീലും",
      madrasaSeal: "മദ്രസ / ജമാഅത്ത് സീൽ",
      madrasaJamathSecretary: "മദ്രസ/ജമാഅത്ത് സെക്രട്ടറി നാമം,ഫോൺ നമ്പർ:,ഒപ്പ്",
      instruction:
        "ഈ ഫലപ്പട്ടിക കോൺവീനർ കൊണ്ടുവരണം എന്നുള്ളതും എപ്പോഴും ഓർമിപ്പിക്കുന്നു.",
      supervisorName: "സൂപ്പർവൈസറുടെ പേരും ഒപ്പും",
      supervisor: "സൂപ്പർവൈസർ/കൺവീനർ കോൺവീനർ ഇന്റെ ഒപ്പും മുദ്രയും",
      centerNote: "പരീക്ഷാ കേന്ദ്രം പോലും മുഹൂർത്തം",
      examBoard: "പരീക്ഷാ ബോർഡ് DKIMVB",
      address1: "പാലുവള്ളി - അബ്ബൂബക്കർ മർക്കം",
      address2: "ജുമുഅ മസ്ജിദ് - മൊറക്ക മുക്ക്",
      address3: "മുതുകുളം പി.ഒ, നെയ്യാറ്റിൻകര: 695603",
      phone: "ഫോൺ: 8891177850",
    },
    en: {
      header1Prefix: "Result Sheet for Public Examination of classes ",
      header1Classes: activeClassesStr,
      header1Suffix: "",
      header2: `in Hijra: ${hijraYear} (${displayYear}).`,
      madrasaFullName: "MADRASA FULL NAME",
      address: "ADDRESS",
      class: "CLASS",
      examCenter: "EXM CENTER",
      mekhala: "MEKHALA",
      slNo: "Sl.\nNo.",
      rollNo: "HallTicket\nNumber",
      regNo: "Register\nNumber",
      studentName: "Student\nName",
      fatherName: "Father\nName",
      dob: "DOB",
      marks: "Marks",
      grade: "Grade",
      totalLabel: "Total",
      stdLabel: "Std",
      sadarName: "SADAR NAME, PHONE NUM:",
      className: "CLASS NAME, PHONE NUM:",
      mekhalaConvener: "MEKHALA CONVENER NAME, PHONE NUM:",
      signatureAndSeal: "SIGNATURE & SEAL",
      madrasaSeal: "MADRASA/ JAMAATH SEAL",
      madrasaJamathSecretary:
        "MADRASA/JAMAATH SECRETARY NAME,PHONE NUM:,SIGNATUE",
      instruction: "This result sheet must be brought by the Convener",
      supervisorName: "Name and Signature of Supervisor",
      supervisor: "Supervisor / Convener Signature & Seal",
      centerNote: "Examination Center Note",
      examBoard: "DKIMVB Examination Board",
      address1: "Paluvally - Abbubakar Markam",
      address2: "Jumu'ah Masjid - Morakka Mukku",
      address3: "Muthukulam P.O, Neyyattinkara: 695603",
      phone: "Phone: 8891177850",
    },
  };

  const t = texts[language] || texts.en;

  // Filter students by class and madarsa
  let filteredStudents = registeredStudents;

  // Filter by madarsa if selected
  if (selectedMahal && selectedMahal !== "all") {
    filteredStudents = filteredStudents.filter(
      (student) => student.madarsa === selectedMahal,
    );
  }

  // Filter by class if selected
  if (
    selectedClass &&
    selectedClass.length > 0 &&
    !selectedClass.includes("all")
  ) {
    filteredStudents = filteredStudents.filter((student) =>
      selectedClass.includes(student.classLevel),
    );
  }

  // Page setup
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // --- HEADER SECTION WITH TOP BANNER ---
  let yPosition = 10;

  try {
    // Load and display top banner image (htup.png)
    const imgUp = await loadImage("/htup.png");
    if (imgUp) {
      const bannerWidth = 150;
      const bannerHeight = 15;
      doc.addImage(
        imgUp,
        "PNG",
        (pageWidth - bannerWidth) / 2,
        yPosition,
        bannerWidth,
        bannerHeight,
      );
      yPosition += bannerHeight + 5;
    }
  } catch (error) {
    console.error("Error loading top banner image:", error);
  }

  // Main heading
  doc.setFontSize(10);
  setLangFont(doc, language, "normal");
  const fullHeader1 = `${t.header1Prefix}${t.header1Classes}${t.header1Suffix}`;
  const totalWidth = doc.getTextWidth(fullHeader1);
  const startX = (pageWidth - totalWidth) / 2;

  // Draw prefix
  doc.text(t.header1Prefix, startX, yPosition);
  const prefixWidth = doc.getTextWidth(t.header1Prefix);

  // Draw Classes (Bold)
  setLangFont(doc, language, "bold");
  doc.text(t.header1Classes, startX + prefixWidth, yPosition);
  const classesWidth = doc.getTextWidth(t.header1Classes);
  setLangFont(doc, language, "normal");

  // Draw Suffix
  doc.text(t.header1Suffix, startX + prefixWidth + classesWidth, yPosition);
  yPosition += 6;
  doc.setFontSize(9);
  setLangFont(doc, language, "normal");
  doc.text(t.header2, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 10;

  // Form fields section matching the image layout
  doc.setFontSize(7);
  doc.setLineWidth(0.3);

  // Line 1: MADRASA FULL NAME (full width)
  setLangFont(doc, language, "normal");
  doc.text(t.madrasaFullName, margin, yPosition);
  const madrasaLabelWidth = language === "ml" ? 45 : 48;
  const madrasaValue = selectedMahal ? selectedMahal : "";
  setLangFont(doc, language, "normal");
  doc.text(madrasaValue, margin + madrasaLabelWidth, yPosition);

  yPosition += 6;

  // Line 2: ADDRESS (Full width)
  setLangFont(doc, language, "normal");
  doc.text(t.address, margin, yPosition);
  const addressLabelWidth = language === "ml" ? 15 : 18;
  const addressValue =
    madarsaData?.address || filteredStudents[0]?.madarsaAddress || "";
  doc.text(addressValue, margin + addressLabelWidth, yPosition);

  yPosition += 6;

  // Line 3: EXM CENTER (Full width)
  setLangFont(doc, language, "normal");
  doc.text(t.examCenter, margin, yPosition);
  const examCenterLabelWidth = language === "ml" ? 35 : 28;

  yPosition += 6;

  // Line 4: MEKHALA (Full width)
  setLangFont(doc, language, "normal");
  doc.text(t.mekhala, margin, yPosition);
  const mekhalaLabelWidth = language === "ml" ? 15 : 18;

  yPosition += 5;

  // --- TABLE SECTION ---
  // Get subjects from timetable if available
  const subjectColumns = [];
  if (examData.timetableEntries && examData.timetableEntries.length > 0) {
    // Sort entries by date
    const sortedEntries = [...examData.timetableEntries].sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateA - dateB;
    });

    sortedEntries.forEach((entry) => {
      if (entry.subject || entry.title) {
        subjectColumns.push({
          subject: entry.subject || entry.title || "Subject",
          date: entry.date
            ? new Date(entry.date).toLocaleDateString("en-GB")
            : "",
        });
      }
    });
  }

  // Default to 3 subjects if none provided
  if (subjectColumns.length === 0) {
    subjectColumns.push(
      { subject: "Subject 1", date: "" },
      { subject: "Subject 2", date: "" },
      { subject: "Subject 3", date: "" },
    );
  }

  // Create table header with fixed columns and subject columns
  const tableHeaderRow = [
    {
      content: t.slNo,
      rowSpan: 2,
      styles: { halign: "center", fontSize: 7, valign: "middle" },
    },
    {
      content: t.rollNo,
      rowSpan: 2,
      styles: { halign: "center", fontSize: 7, valign: "middle" },
    },
    {
      content: t.regNo,
      rowSpan: 2,
      styles: { halign: "center", fontSize: 7, valign: "middle" },
    },
    {
      content: t.studentName,
      rowSpan: 2,
      styles: { halign: "center", fontSize: 7, valign: "middle" },
    },
    {
      content: t.fatherName,
      rowSpan: 2,
      styles: { halign: "center", fontSize: 7, valign: "middle" },
    },
    {
      content: t.dob,
      rowSpan: 2,
      styles: { halign: "center", fontSize: 7, valign: "middle" },
    },
    {
      content: t.class,
      rowSpan: 2,
      styles: { halign: "center", fontSize: 7, valign: "middle" },
    },
  ];

  // Add subject headers with colSpan for marks and grade
  subjectColumns.forEach((subjectInfo) => {
    tableHeaderRow.push({
      content: `${subjectInfo.subject}${
        subjectInfo.date ? "\n" + subjectInfo.date : ""
      }`,
      colSpan: 2,
      styles: { halign: "center", fontSize: 6 },
    });
  });

  // Create second header row with marks and grade for each subject
  const subjectHeaderRow = [];
  subjectColumns.forEach(() => {
    subjectHeaderRow.push(
      { content: t.marks, styles: { halign: "center", fontSize: 6 } },
      { content: t.grade, styles: { halign: "center", fontSize: 6 } },
    );
  });

  // Create head with two rows
  const tableHead = [tableHeaderRow, subjectHeaderRow];

  // Determine number of rows
  const totalRows = filteredStudents.length || 30;

  // Create table rows with prefilled data if available
  const tableRows = [];
  for (let i = 0; i < totalRows; i++) {
    const student = filteredStudents[i];
    const rowData = [
      (i + 1).toString(), // Sl. No.
      student
        ? student.hallTicketNumber ||
          student.admissionNumber ||
          student.midNumber ||
          ""
        : "", // Roll Number
      student
        ? student.admissionNumber || student.registrationNumber || ""
        : "", // Register Number
      student ? student.fullName || "" : "", // Student Name
      student
        ? student.guardianName || student.parentDetails?.fatherName || ""
        : "", // Guardian Name
      student ? formatDOB(student.dateOfBirth || student.dob) : "", // DOB
      student ? student.classLevel || "" : "", // Class
    ];

    // Add empty cells for each subject (marks and grade)
    subjectColumns.forEach(() => {
      rowData.push(""); // Marks
      rowData.push(""); // Grade
    });

    tableRows.push(rowData);
  }

  autoTable(doc, {
    head: tableHead,
    body: tableRows,
    startY: yPosition,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: {
      font: language === "ml" ? "NotoSansMalayalam" : "helvetica",
      fontSize: 6,
      cellPadding: 1,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      font: language === "ml" ? "NotoSansMalayalam" : "helvetica",
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "normal",
      halign: "center",
      valign: "middle",
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
      cellPadding: 1,
      minCellHeight: 8,
    },
    columnStyles: {
      0: { cellWidth: 10 }, // Sl. No.
      1: { cellWidth: 15 }, // Roll Number
      2: { cellWidth: 15 }, // Register Number
      3: { cellWidth: 25 }, // Student Name
      4: { cellWidth: 25 }, // Guardian Name
      5: { cellWidth: 15 }, // DOB
      6: { cellWidth: 12 }, // Class
      // Subject columns (marks and grade) will auto-distribute remaining width
    },
  });

  // --- FOOTER SECTION ---
  yPosition = doc.lastAutoTable.finalY + 10;

  if (yPosition + 60 > pageHeight - margin) {
    doc.addPage();
    yPosition = margin + 10;
  }

  const footerWidth = contentWidth;
  const col1Width = footerWidth * 0.4;
  const col2Width = footerWidth * 0.15;
  const col3Width = footerWidth * 0.45;
  const footerHeight = 45;

  doc.setLineWidth(0.2);
  doc.rect(margin, yPosition, footerWidth, footerHeight);

  // Column Dividers
  doc.line(
    margin + col1Width,
    yPosition,
    margin + col1Width,
    yPosition + footerHeight,
  );
  doc.line(
    margin + col1Width + col2Width,
    yPosition,
    margin + col1Width + col2Width,
    yPosition + footerHeight,
  );

  // --- COLUMN 1: Names and Phone Numbers ---
  doc.setFontSize(7);
  setLangFont(doc, language);
  let col1Y = yPosition + 8;
  const lineGap = 10;

  const leftLabels = [
    {
      text:
        language === "ml"
          ? "സദർ മുഅല്ലിമിൻ്റെ പേര്, ഫോൺ നമ്പർ :"
          : "SADAR NAME, PHONE NUM:",
      y: col1Y,
    },
    {
      text:
        language === "ml"
          ? "ക്ലാസ് മുഅല്ലിമിൻ്റെ പേര്, ഫോൺ നമ്പർ :"
          : "CLASS NAME, PHONE NUM:",
      y: col1Y + lineGap,
    },
    {
      text:
        language === "ml"
          ? "മേഖല കൺവീനറുടെ പേര്, ഫോൺ നമ്പർ :"
          : "MEKHALA CONVENER NAME, PHONE NUM:",
      y: col1Y + lineGap * 2,
    },
  ];

  leftLabels.forEach((label) => {
    doc.text(label.text, margin + 2, label.y);
    // Dotted line for input
    const textWidth = doc.getTextWidth(label.text);
    doc.setLineDash([0.5, 0.5]);
    doc.setLineDash([]);
  });

  // Signature & Seal at bottom of Col 1
  doc.text(t.signatureAndSeal, margin + 2, yPosition + footerHeight - 5);

  // --- COLUMN 2: COUNT Table ---
  // Calculate class-wise student counts

  const classCounts = {};

  // Count students per class
  filteredStudents.forEach((student) => {
    if (student) {
      const classLevel = (student.classLevel || student.std || "").toString();
      const romanClass = classMapping[classLevel];

      if (romanClass) {
        classCounts[romanClass] = (classCounts[romanClass] || 0) + 1;
      }
    }
  });

  // Header "COUNT"
  doc.setFontSize(7);
  const countLabel = language === "ml" ? "ആകെ കുട്ടികൾ" : "COUNT";
  doc.text(countLabel, margin + col1Width + col2Width / 2, yPosition + 5, {
    align: "center",
  });
  doc.line(
    margin + col1Width,
    yPosition + 8,
    margin + col1Width + col2Width,
    yPosition + 8,
  );

  // Class Rows - only show classes present in the data
  const classes = Object.keys(classCounts).sort((a, b) => {
    const order = [
      "lkg",
      "ukg",
      "I",
      "II",
      "III",
      "IV",
      "V",
      "VI",
      "VII",
      "VIII",
      "IX",
      "X",
      "XI",
      "XII",
    ];
    return (
      (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) -
      (order.indexOf(b) === -1 ? 99 : order.indexOf(b))
    );
  });
  let countY = yPosition + 15;

  classes.forEach((cls, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`STD. ${cls}`, margin + col1Width + 2, countY);

    // Display actual count
    const count = classCounts[cls] || 0;
    doc.setFont("helvetica", "normal");
    doc.text(count.toString(), margin + col1Width + col2Width - 5, countY, {
      align: "right",
    });

    // Row Divider
    if (i < classes.length - 1) {
      doc.line(
        margin + col1Width,
        countY + 4,
        margin + col1Width + col2Width,
        countY + 4,
      );
    }
    countY += 9;
  });

  // --- COLUMN 3: Secretary & Seal ---
  const col3X = margin + col1Width + col2Width;
  doc.setFontSize(7);
  setLangFont(doc, language);

  const secText =
    language === "ml"
      ? "മദ്രസ / ജമാഅത്ത് സെക്രട്ടറിയുടെ പേര്, ഫോൺ നമ്പർ, ഒപ്പ്."
      : "MADRASA/JAMATH SECRETARY NAME, PHONE NUM, SIGNATURE";

  // Split text to wrap if necessary
  const splitSecText = doc.splitTextToSize(secText, col3Width - 4);
  doc.text(splitSecText, col3X + 2, yPosition + 5);

  // Dotted lines for signature/info
  doc.setLineDash([0.5, 0.5]);
  doc.setLineDash([]);

  // Madrasa Seal at bottom
  const sealLabel =
    language === "ml" ? "മദ്രസ / ജമാഅത്ത് സീൽ" : "MADRASA / JAMATH SEAL";
  doc.text(sealLabel, col3X + col3Width - 2, yPosition + footerHeight - 5, {
    align: "right",
  });

  // --- End Footer ---

  // Add page numbers to all pages
  const totalPages = doc.internal.pages.length - 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    doc.text(`[${pageNum}]`, pageWidth - margin - 5, pageHeight - margin, {
      align: "right",
    });
  }

  return doc;
};
