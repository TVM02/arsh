/**
 * Hall Ticket Utility Functions
 * Contains reusable functions for hall ticket generation
 */

/**
 * Convert class number to Roman numeral
 * @param {number|string} num - Class level number
 * @returns {string} Roman numeral or original value
 */
export const toRomanIfNumber = (num) => {
  if (!num) return "N/A";
  const numberValue = parseInt(num);
  if (isNaN(numberValue)) return num;

  const romanNumerals = [
    { value: 12, numeral: "XII" },
    { value: 11, numeral: "XI" },
    { value: 10, numeral: "X" },
    { value: 9, numeral: "IX" },
    { value: 8, numeral: "VIII" },
    { value: 7, numeral: "VII" },
    { value: 6, numeral: "VI" },
    { value: 5, numeral: "V" },
    { value: 4, numeral: "IV" },
    { value: 3, numeral: "III" },
    { value: 2, numeral: "II" },
    { value: 1, numeral: "I" },
  ];

  const found = romanNumerals.find((rn) => rn.value === numberValue);
  return found ? found.numeral : num;
};

/**
 * Format date value for display
 * @param {Date|Object|string} dateValue - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (dateValue) => {
  if (!dateValue || dateValue === "N/A" || dateValue === "NA") return "N/A";

  try {
    let dateObj;
    if (dateValue && typeof dateValue.toDate === "function") {
      dateObj = dateValue.toDate();
    } else if (
      dateValue &&
      typeof dateValue === "object" &&
      "seconds" in dateValue
    ) {
      // Handle serialized Firebase Timestamp
      dateObj = new Date(
        dateValue.seconds * 1000 + (dateValue.nanoseconds || 0) / 1000000,
      );
    } else if (
      typeof dateValue === "string" &&
      dateValue.includes("Timestamp(")
    ) {
      // Handle Timestamp string representation like "Timestamp(seconds=1375747200, nanoseconds=0)"
      const secondsMatch = dateValue.match(/seconds=(\d+)/);
      const nanosecondsMatch = dateValue.match(/nanoseconds=(\d+)/);
      if (secondsMatch) {
        const seconds = parseInt(secondsMatch[1]);
        const nanoseconds = nanosecondsMatch
          ? parseInt(nanosecondsMatch[1])
          : 0;
        dateObj = new Date(seconds * 1000 + nanoseconds / 1000000);
      } else {
        dateObj = new Date(dateValue);
      }
    } else {
      dateObj = new Date(dateValue);
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      return "Invalid date";
    }

    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const year = dateObj.getFullYear();

    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Date error";
  }
};

/**
 * Convert 24-hour time to 12-hour format with AM/PM
 * @param {string} time24 - Time in 24-hour format (HH:MM)
 * @returns {string} Time in 12-hour format with AM/PM
 */
export const formatTime12Hour = (time24) => {
  if (!time24) return "";

  try {
    const [hours, minutes] = time24.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
  } catch (error) {
    return time24;
  }
};

/**
 * Convert minutes to hours with 2 decimal places
 * @param {number|string} minutes - Duration in minutes
 * @returns {string} - Duration in hours (e.g., "1.50")
 */
export const convertMinutesToHours = (minutes) => {
  if (!minutes || minutes === 0) return "N/A";

  try {
    const mins = parseInt(minutes);
    if (isNaN(mins)) return "N/A";
    const hours = mins / 60;
    return hours.toFixed(2);
  } catch (error) {
    return "N/A";
  }
};

/**
 * Format duration from minutes to readable format (e.g., "1 hr 30 mins")
 * @param {number|string} minutes - Duration in minutes
 * @returns {string} - Formatted duration string
 */
export const formatDuration = (minutes) => {
  if (!minutes || minutes === 0) return "N/A";

  try {
    const mins = parseInt(minutes);
    if (isNaN(mins)) return "N/A";

    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;

    if (hours === 0) {
      return `${remainingMins}min${remainingMins !== 1 ? "s" : ""}`;
    } else if (remainingMins === 0) {
      return `${hours}hr${hours !== 1 ? "s" : ""}`;
    } else {
      return `${hours}hr${hours !== 1 ? "s" : ""} ${remainingMins}min${
        remainingMins !== 1 ? "s" : ""
      }`;
    }
  } catch (error) {
    return "N/A";
  }
};

/**
 * Generate hall ticket HTML for PDF generation
 * @param {Object} hallTicketData - Hall ticket data object
 * @param {string} hallTicketData.hallTicketNumber - Hall ticket number
 * @param {string} hallTicketData.examTitle - Exam title
 * @param {string} hallTicketData.fullName - Student full name
 * @param {string} hallTicketData.admissionNumber - Admission number
 * @param {string} hallTicketData.classLevel - Class level
 * @param {string} hallTicketData.gender - Gender
 * @param {string} hallTicketData.guardianName - Guardian name
 * @param {string} hallTicketData.guardianPhone - Guardian phone
 * @param {string} hallTicketData.madarsa - Madarsa name
 * @param {string} hallTicketData.mekhala - Mekhala name
 * @param {string} hallTicketData.sadarName - Sadar name
 * @param {string} hallTicketData.sadarAddress - Sadar address
 * @param {Date} hallTicketData.examDate - Exam date
 * @param {Date} hallTicketData.createdAt - Registration date
 * @param {string} hallTicketData.profilePictureUrl - Profile picture URL
 * @param {Array} hallTicketData.timetableEntries - Timetable entries array
 * @returns {string} HTML string for hall ticket
 
 */
export const generateHallTicketHTML = (hallTicketData) => {
  // Generate timetable HTML if available (placed after rules section like in HallTicket.jsx)
  const timetableHTML =
    hallTicketData.timetableEntries &&
    hallTicketData.timetableEntries.length > 0
      ? `
    <div class="mb-2" style="margin-bottom: 12px;">
      <h3 style="font-size: 14px; font-weight: 600; color: #111827; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin-bottom: 10px;">
        Examination Timetable
      </h3>
      <div style="border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden;">
        <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #F9FAFB; border-bottom: 1px solid #E5E7EB;">
              <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #374151; border-right: 1px solid #E5E7EB;">Date</th>
              <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #374151; border-right: 1px solid #E5E7EB;">Subject</th>
              <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #374151; border-right: 1px solid #E5E7EB;">Time</th>
              <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #374151;">Duration</th>
            </tr>
          </thead>
          <tbody>
            ${hallTicketData.timetableEntries
              .map(
                (entry, index) => `
              <tr style="background-color: ${
                index % 2 === 0 ? "#FFFFFF" : "#F9FAFB"
              }; border-bottom: ${
                index === hallTicketData.timetableEntries.length - 1
                  ? "none"
                  : "1px solid #E5E7EB"
              };">
                <td style="padding: 8px 12px; color: #111827; font-weight: 500; border-right: 1px solid #E5E7EB;">
                  ${formatDate(entry.date)}
                </td>
                <td style="padding: 8px 12px; color: #111827; border-right: 1px solid #E5E7EB;">
                  ${entry.subject}
                </td>
                <td style="padding: 8px 12px; color: #4B5563; border-right: 1px solid #E5E7EB;">
                  ${
                    entry.startTime && entry.endTime
                      ? `${formatTime12Hour(
                          entry.startTime,
                        )} - ${formatTime12Hour(entry.endTime)}`
                      : "N/A"
                  }
                </td>
                <td style="padding: 8px 12px; color: #4B5563;">
                  ${entry.duration ? formatDuration(entry.duration) : "N/A"}
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `
      : "";

  // Extract the first part and last 6 digits of hall ticket number
  const hallTicketFirstPart = hallTicketData.hallTicketNumber
    ? hallTicketData.hallTicketNumber.slice(0, -6)
    : "";
  const hallTicketLastSix = hallTicketData.hallTicketNumber
    ? hallTicketData.hallTicketNumber.slice(-6)
    : "N/A";

  return `
    <div class="hall-ticket-container bg-white p-3 border-2 border-gray-200 rounded-lg" style="font-family: Arial, sans-serif; font-size: 11px; line-height: 1.3; width: 190mm; margin: 0 auto; box-sizing: border-box;">
      <!-- Header Section -->
      <div class="mb-2" style="margin-bottom: 8px;">
        <div class="flex items-center justify-between gap-3 mb-1" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px;">
          <div class="w-24 flex-shrink-0" style="width: 80px; flex-shrink: 0;">
            <img src="/htleft.jpg" alt="Left logo" style="width: 80px; height: 80px; object-fit: contain;" />
          </div>

          <div class="flex-1 text-center" style="flex: 1; text-align: center;">
            <div class="w-full mb-2" style="width: 100%; margin-bottom: 8px;">
              <img src="/htup.png" alt="Header banner" style="width: 100%; height: auto; object-fit: contain; margin: 0 auto;" />
            </div>
            <h1 style="font-size: 16px; font-weight: bold; color: #111827; line-height: 1.1; margin: 2px 0;">
              Dakshina Kerala Islam Matha Vidyabhyasa Board
            </h1>
            <p style="color: #4B5563; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 1px 0;">
              ദക്ഷിണ കേരള ഇസ്ലാം മത വിദ്യാഭ്യാസ ബോർഡ്
            </p>
            <p style="color: #4B5563; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 1px 0;">
              EXAMINATION HALL TICKET
            </p>
          </div>

          <div class="w-24 flex-shrink-0 text-right" style="width: 80px; flex-shrink: 0; text-align: right;">
            <img src="/htright.jpg" alt="Right logo" style="width: 80px; height: 80px; object-fit: contain;" />
          </div>
        </div>

        <div class="bg-teal-50 p-2 rounded-lg mt-2 text-center w-full" style="background-color: #F0FDFA; padding: 8px; border-radius: 0px; margin-top: 8px; text-align: center; width: 100%;">
          <h2 style="font-size: 16px; font-weight: 600; color: #134E4A; margin: 0; text-transform: capitalize;">
            ${hallTicketData.examTitle?.toLowerCase() || "N/A"}
          </h2>
        </div>
      </div>

 <div class="text-center mb-2">
  <div   style="
    background:#FEF2F2;
    border:2px solid #FECACA;
    padding:6px 10px;
    display:inline-flex;
    align-items:center;
    justify-content:center;"
>
    <p style="font-size:13px;margin:0;">
      <span style="font-weight:700;color:#7F1D1D;">
        Hall Ticket No:
      </span>
      <span style="font-weight:900;color:#7F1D1D;">
        ${hallTicketData.hallTicketNumber || hallTicketLastSix}
      </span>
      <span style="font-weight:700;color:#7F1D1D;">
        &nbsp;| Class:
      </span>
      <span style="font-weight:900;color:#7F1D1D;">
        ${toRomanIfNumber(hallTicketData.classLevel)}
      </span>
    </p>
  </div>
</div>


      <!-- Student Information and Photo -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 12px;">
        <div style="margin-bottom: 4px;">
          <h3 style="font-size: 13px; font-weight: 600; color: #111827; border-bottom: 1px solid #E5E7EB; padding-bottom: 2px; margin-bottom: 6px;">
            Student Information
          </h3>
          <div style="font-size: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 500; color: #374151;">Name:</span>
              <span style="color: #111827; text-transform: capitalize;">${
                hallTicketData.fullName?.toLowerCase() || "N/A"
              }</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 500; color: #374151;">Admission No:</span>
              <span style="color: #111827; text-transform: uppercase;">${
                hallTicketData.admissionNumber?.toLowerCase() || "N/A"
              }</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 500; color: #374151;">Gender:</span>
              <span style="color: #111827; text-transform: capitalize;">${
                hallTicketData.gender?.toLowerCase() || "N/A"
              }</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 500; color: #374151;">Date of Birth:</span>
              <span style="color: #111827;">${formatDate(hallTicketData.dateOfBirth)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 500; color: #374151;">Guardian Name:</span>
              <span style="color: #111827; text-transform: capitalize;">${
                hallTicketData.guardianName?.toLowerCase() || "NA"
              }</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 500; color: #374151;">Parent Phone:</span>
              <span style="color: #111827;">${
                hallTicketData.guardianPhone || "N/A"
              }</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 500; color: #374151;">Exam Center:</span>
              <span style="color: #111827; text-transform: capitalize;">${
                hallTicketData.madarsa?.toLowerCase() || "N/A"
              }</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 500; color: #374151;">Mekhala:</span>
              <span style="color: #111827; text-transform: capitalize;">${
                hallTicketData.mekhala?.toLowerCase() || "N/A"
              }</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 500; color: #374151;">Madrasa:</span>
              <span style="color: #111827; text-transform: capitalize;">${
                hallTicketData.sadarName?.toLowerCase() || "N/A"
              }</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 500; color: #374151;">Madrasa Address:</span>
              <span style="color: #111827; text-transform: capitalize;">${
                hallTicketData.sadarAddress?.toLowerCase() || "N/A"
              }</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 4px;">
          <h4 style="font-size: 13px; font-weight: 600; color: #111827; border-bottom: 1px solid #E5E7EB; padding-bottom: 2px; margin-bottom: 6px;">
            Photo
          </h4>
          <div style="width: 80px; height: 106px; border: 2px solid #D1D5DB; display: flex; align-items: center; justify-content: center; border-radius: 0px; background-color: #F9FAFB; overflow: hidden;">
            ${
              hallTicketData.profilePictureUrl
                ? `<img src="${hallTicketData.profilePictureUrl}" crossorigin="anonymous" alt="Student Photo" style="width: 100%; height: 100%; object-fit: cover; border-radius: 0px;" />`
                : '<span style="font-size: 10px; color: #6B7280;">No Photo</span>'
            }
          </div>
        </div>
      </div>

      <!-- Examination Details -->
      <div class="mb-2" style="margin-bottom: 8px;">
        <h3 style="font-size: 13px; font-weight: 600; color: #111827; border-bottom: 1px solid #E5E7EB; padding-bottom: 2px; margin-bottom: 6px;">
          Examination Details
        </h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: 500; color: #374151;">Exam Title:</span>
            <span style="color: #111827; text-transform: capitalize;">${
              hallTicketData.examTitle?.toLowerCase() || "N/A"
            }</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: 500; color: #374151;">Exam Date:</span>
            <span style="color: #111827;">${formatDate(
              hallTicketData.examDate,
            )}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: 500; color: #374151;">Registration Date:</span>
            <span style="color: #111827;">${formatDate(
              hallTicketData.createdAt,
            )}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: 500; color: #374151;">Status:</span>
            <span style="color: #059669; font-weight: 600;">APPROVED</span>
          </div>
        </div>
      </div>

     

      <!-- Timetable Section (After Rules) -->
      ${timetableHTML}

       <!-- Rules Section -->
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2" style="background-color: #FEFCE8; border: 1px solid #FDE047; border-radius: 0px; padding: 10px; margin-bottom: 8px;">
        <h3 style="font-size: 13px; font-weight: 600; color: #854D0E; margin-bottom: 6px;">
          നിബന്ധനകൾ:
        </h3>
        <ol style="font-size: 11px; color: #713F12; margin: 0; padding-left: 18px; list-style: decimal;">
          <li style="margin-bottom: 2px;">ഉത്തരപ്പേപ്പറിൽ രജിസ്റ്റർ നമ്പർ മാത്രം എഴുതുക.</li>
          <li style="margin-bottom: 2px;">ഹാൾ ടിക്കറ്റ് പരീക്ഷയുടെ അവസാന നിമിഷം വരെ സൂക്ഷിക്കുക.</li>
          <li style="margin-bottom: 2px;">ഫിഖ്ഹ് പേപ്പറുകളിൽ ശാഫികൾ "ശാഫി" എന്നും ഹഫികൾ "ഹനഫി" എന്നും എഴുതുക.</li>
          <li style="margin-bottom: 2px;">തിരിച്ചറിയാൻ കഴിയുന്ന വിധത്തിൽ പേന കൊണ്ട് വൃത്തിയാക്കി എഴുതുക.</li>
          <li style="margin-bottom: 2px;">നിശ്ചിത സമയം കഴിഞ്ഞ് 15 മിനിട്ട് താമസിച്ച് വരുന്നവർക്ക് പരീക്ഷാ ഹാളിൽ പ്രവേശനം ലഭിക്കുന്നതല്ല.</li>
          <li style="margin-bottom: 2px;">ക്രമക്കേട് കാണിക്കുന്നവരെ പുറത്താക്കാനുള്ള അധികാരം സൂപ്പർവൈസർക്ക് ഉണ്ടായിരിക്കുന്നതാണ്.</li>
          <li style="margin-bottom: 2px;">പരീക്ഷാ ഹാളിൽ നിർബന്ധമായും മൊബൈൽ ഫോൺ ഒഴിവാക്കേണ്ടതാണ്. എന്നാൽ സൂപ്പർവൈസർക്ക് പരീക്ഷാ സംബന്ധമായി അടിയന്തിര അന്വേഷണം ആവശ്യമായി വന്നാൽ ഹാളിന് പുറത്ത് ഉപയോഗിക്കാവുന്നതാണ്.</li>
        </ol>
      </div>

      <!-- Signatures -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; padding-top: 8px; border-top: 1px solid #E5E7EB;">
        <div style="text-align: center;">
          <div style="height: 36px; border-bottom: 1px dashed #9CA3AF; margin-bottom: 2px;"></div>
          <p style="font-size: 11px; font-weight: 500; color: #374151; margin: 0;">Student Signature</p>
        </div>
        <div style="text-align: center;">
          <div style="height: 36px; border-bottom: 1px dashed #9CA3AF; margin-bottom: 2px;"></div>
          <p style="font-size: 11px; font-weight: 500; color: #374151; margin: 0;">Supervisor Signature</p>
        </div>
        <div style="text-align: center;">
          <div style="height: 36px; display: flex; align-items: center; justify-content: center; margin-bottom: 2px;">
            <img src="/gcsign.png" alt="General Convener Signature" style="width: 70px; height: 32px; object-fit: contain;" />
          </div>
          <p style="font-size: 11px; font-weight: 500; color: #374151; margin: 0;">General Convener Signature</p>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 12px; padding-top: 6px; border-top: 1px solid #E5E7EB;">
        <p style="font-size: 10px; color: #6B7280; margin: 0;">
          Generated: ${new Date().toLocaleString()} | DKJU - Exam Dept.
        </p>
        <p style="font-size: 10px; color: #9CA3AF; margin: 0;">
          Computer generated hall ticket. No signature required.
        </p>
      </div>
    </div>
  `;
};

/**
 * Convert image URL to Base64 string
 * @param {string} url - Image URL
 * @returns {Promise<string>} Base64 string
 */
const convertImageToBase64 = async (url) => {
  if (!url) return "";
  try {
    // Use internal proxy to avoid CORS issues
    const response = await fetch("/api/proxy-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      // Common for protected Firebase Storage URLs (401) or intermittent upstream failures.
      // Treat as non-fatal: caller will proceed without an image.
      return "";
    }

    const data = await response.json();
    return data.dataUrl || "";
  } catch (error) {
    // Non-fatal; proceed without an image.
    console.warn("Error converting image to base64:", error);
    return ""; // Return empty string on failure to prevent crash
  }
};

const renderHallTicketInIframe = (htmlContent) => {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 794px; height: 1123px;
      border: none; opacity: 0;
      pointer-events: none; z-index: -1;
    `;

    iframe.onload = () => resolve(iframe);
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      resolve(iframe);
      return;
    }

    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fff; font-family: Arial, sans-serif; }
      </style>
    </head><body>${htmlContent}</body></html>`);
    doc.close();
  });
};

/**
 * Download hall ticket as PDF
 * @param {Object} hallTicketData - Hall ticket data object
 * @returns {Promise<void>}
 */
export const downloadHallTicket = async (hallTicketData) => {
  if (typeof window === "undefined") return;

  try {
    // Convert profile picture to Base64 to avoid CORS issues in PDF
    if (hallTicketData.profilePictureUrl) {
      const base64Img = await convertImageToBase64(
        hallTicketData.profilePictureUrl,
      );
      hallTicketData = {
        ...hallTicketData,
        // If conversion fails, drop the URL entirely so html2canvas won't attempt a cross-origin fetch.
        profilePictureUrl: base64Img || "",
      };
    }

    const html2pdf = (await import("html2pdf.js")).default;
    const htmlContent = generateHallTicketHTML(hallTicketData);

    const iframe = await renderHallTicketInIframe(htmlContent);
    const iframeDoc =
      iframe.contentDocument || iframe.contentWindow?.document || null;
    const element = iframeDoc?.body?.firstElementChild;

    if (!element) {
      iframe.parentNode?.removeChild(iframe);
      throw new Error("Failed to render hall ticket content for PDF");
    }

    // Give layout/images/fonts time to settle before html2canvas snapshots.
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    await new Promise((resolve) => setTimeout(resolve, 200));

    const opt = {
      margin: 0, // We handle margins via CSS padding/centering
      filename: `hall_ticket_${
        hallTicketData.admissionNumber || "student"
      }.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true,
        windowWidth: 794, // A4 width in px at 96dpi approx
        scrollX: 0,
        scrollY: 0,
        backgroundColor: "#ffffff",
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } finally {
      iframe.parentNode?.removeChild(iframe);
    }
  } catch (error) {
    console.error("Error in downloadHallTicket utility:", error);
    throw error;
  }
};

/**
 * Generate hall ticket PDF and return as ArrayBuffer
 * @param {Object} hallTicketData - Hall ticket data object
 * @returns {Promise<ArrayBuffer>}
 */
export const generateHallTicketPDFBlob = async (hallTicketData) => {
  if (typeof window === "undefined") return null;

  try {
    // Convert profile picture to Base64 to avoid CORS issues in PDF
    if (hallTicketData.profilePictureUrl) {
      const base64Img = await convertImageToBase64(
        hallTicketData.profilePictureUrl,
      );
      hallTicketData = {
        ...hallTicketData,
        // If conversion fails, drop the URL entirely so html2canvas won't attempt a cross-origin fetch.
        profilePictureUrl: base64Img || "",
      };
    }

    const html2pdf = (await import("html2pdf.js")).default;
    const htmlContent = generateHallTicketHTML(hallTicketData);

    const iframe = await renderHallTicketInIframe(htmlContent);
    const iframeDoc =
      iframe.contentDocument || iframe.contentWindow?.document || null;
    const element = iframeDoc?.body?.firstElementChild;

    if (!element) {
      iframe.parentNode?.removeChild(iframe);
      throw new Error("Failed to render hall ticket content for PDF");
    }

    // Give layout/images/fonts time to settle before html2canvas snapshots.
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    await new Promise((resolve) => setTimeout(resolve, 200));

    const opt = {
      margin: 0, // We handle margins via CSS padding/centering
      filename: `hall_ticket_${
        hallTicketData.admissionNumber || "student"
      }.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true,
        windowWidth: 794, // A4 width in px at 96dpi approx
        scrollX: 0,
        scrollY: 0,
        backgroundColor: "#ffffff",
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    try {
      const pdfBuffer = await html2pdf()
        .set(opt)
        .from(element)
        .output("arraybuffer");
      return pdfBuffer;
    } finally {
      iframe.parentNode?.removeChild(iframe);
    }
  } catch (error) {
    console.error("Error in generateHallTicketPDFBlob utility:", error);
    throw error;
  }
};
