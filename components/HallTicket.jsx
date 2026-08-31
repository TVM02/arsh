import React, { useState, useEffect } from "react";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { convertMinutesToHours, formatDuration } from "@/lib/hallTicketUtils";
import { authFetch } from "@/lib/authFetch";

const fetchStudentMadarsaDetails = async (madarsaId) => {
  if (!madarsaId) return null;

  const response = await authFetch(
    `/api/student/madarsa-details?madarsaId=${encodeURIComponent(madarsaId)}`,
    { cache: "no-store" },
  );

  if (!response.ok) return null;
  return response.json();
};

/**
 * Reusable Hall Ticket Component
 *
 * @param {Object} props
 * @param {Object} props.data - Hall ticket data
 * @param {string} props.data.hallTicketNumber - Hall ticket number
 * @param {string} props.data.examTitle - Exam title
 * @param {string} props.data.fullName - Student full name
 * @param {string} props.data.middleName - Student middle name
 * @param {string} props.data.midNumber - Student mid number
 * @param {string} props.data.admissionNumber - Admission number
 * @param {string|number} props.data.classLevel - Class level
 * @param {string} props.data.gender - Gender
 * @param {string} props.data.guardianPhone - Guardian phone
 * @param {string} props.data.madarsa - Madarsa/Exam center name
 * @param {string} props.data.madarsaId - Madarsa ID to fetch sadar details
 * @param {string} props.data.examDate - Exam date
 * @param {string} props.data.createdAt - Registration date
 * @param {string} props.data.profilePictureUrl - Profile picture URL
 * @param {Function} props.formatDate - Function to format dates (optional)
 * @param {Function} props.toRomanIfNumber - Function to convert numbers to Roman (optional)
 */
const HallTicket = ({
  data,
  formatDate = (date) => {
    if (!date) return "Not available";
    try {
      if (date && typeof date.toDate === "function") {
        return date.toDate().toLocaleDateString();
      }
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return "Invalid date";
      }
      return dateObj.toLocaleDateString();
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Date error";
    }
  },
  formatTime12Hour = (time24) => {
    if (!time24) return "";
    try {
      const [hours, minutes] = time24.split(":").map(Number);
      const period = hours >= 12 ? "PM" : "AM";
      const hours12 = hours % 12 || 12;
      return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
    } catch (error) {
      return time24;
    }
  },
  toRomanIfNumber = (num) => {
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
  },
}) => {
  const [madarsaDetails, setMadarsaDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [examDetails, setExamDetails] = useState(null);
  const [loadingExam, setLoadingExam] = useState(false);
  const [profilePicture, setProfilePicture] = useState(
    data.profilePictureUrl || null,
  );
  const [loadingPhoto, setLoadingPhoto] = useState(false);

  // Fetch profile picture from admissions collection if not provided
  useEffect(() => {
    const fetchProfilePicture = async () => {
      if (data.profilePictureUrl) {
        setProfilePicture(data.profilePictureUrl);
        return;
      }

      if (!data.admissionNumber) {
        console.log("No admission number provided to fetch profile picture");
        return;
      }

      setLoadingPhoto(true);
      try {
        const admissionsRef = collection(db, "admissions");
        const q = query(
          admissionsRef,
          where("admissionNumber", "==", data.admissionNumber),
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const admissionData = querySnapshot.docs[0].data();
          const profileUrl =
            admissionData.profilePictureUrl || admissionData.profilePicture;
          if (profileUrl) {
            setProfilePicture(profileUrl);
          }
        } else {
          console.log(
            "No admission found with admissionNumber:",
            data.admissionNumber,
          );
        }
      } catch (error) {
        console.error("Error fetching profile picture from admissions:", error);
      } finally {
        setLoadingPhoto(false);
      }
    };

    fetchProfilePicture();
  }, [data.profilePictureUrl, data.admissionNumber]);

  // Fetch madarsa details when madarsaId is available
  useEffect(() => {
    const fetchMadarsaDetails = async () => {
      if (!data.madarsaId) {
        console.log("No madarsaId provided");
        return;
      }

      setLoading(true);
      try {
        const madarsaData = await fetchStudentMadarsaDetails(data.madarsaId);

        if (madarsaData) {
          setMadarsaDetails({
            sadarName:
              madarsaData.sadarName || madarsaData.adminName || "N/A",
            sadarAddress: madarsaData.address || "N/A",
            mekhala: madarsaData.district || "N/A",
          });
        } else {
          console.log("No madarsa found with madarsaId:", data.madarsaId);
        }
      } catch (error) {
        console.error("Error fetching madarsa details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMadarsaDetails();
  }, [data.madarsaId]);

  // Fetch exam details and timetable based on examTitle
  useEffect(() => {
    const fetchExamDetails = async () => {
      if (!data.examTitle) {
        console.log("No examTitle provided");
        return;
      }

      setLoadingExam(true);
      try {
        const examsRef = collection(db, "exams");
        const q = query(examsRef, where("title", "==", data.examTitle));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Get the latest exam if multiple exist
          const exams = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Sort by createdAt descending to get the latest
          exams.sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
            const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
            return bTime - aTime;
          });

          const latestExam = exams[0];

          setExamDetails({
            timetableImage:
              latestExam.uploadedTimetableImage ||
              latestExam.generatedTimetableImage ||
              latestExam.timetableImage?.secure_url ||
              null,
            timetableEntries: latestExam.timetableEntries || [],
            timetableDescription: latestExam.timetableDescription || "",
            timetableTitle: latestExam.timetableTitle || "",
          });
        } else {
          console.log("No exam found with title:", data.examTitle);
        }
      } catch (error) {
        console.error("Error fetching exam details:", error);
      } finally {
        setLoadingExam(false);
      }
    };

    fetchExamDetails();
  }, [data.examTitle]);

  return (
    <>
      {/* Print Styles */}
      <style jsx>{`
        @media print {
          /* Hide everything except hall ticket content */
          body > *:not(#hall-ticket-content) {
            display: none !important;
          }

          #hall-ticket-content {
            display: block !important;
            position: relative;
            width: 100%;
            height: auto;
            margin: 0;
            padding: 10mm;
            page-break-inside: avoid;
            page-break-before: auto;
            page-break-after: auto;
          }

          .hall-ticket-container {
            width: 100%;
            max-width: 100%;
            height: auto;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.4;
            box-sizing: border-box;
            border: none !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
          }

          @page {
            size: A4;
            margin: 0;
          }

          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-family: Arial, sans-serif;
          }

          .hall-ticket-container * {
            box-sizing: border-box;
            page-break-inside: avoid !important;
          }

          .hall-ticket-container img {
            max-width: 100%;
            height: auto;
          }

          /* Adjust font sizes for better fit */
          .hall-ticket-container h1 {
            font-size: 18px !important;
          }

          .hall-ticket-container h2 {
            font-size: 16px !important;
          }

          .hall-ticket-container h3 {
            font-size: 14px !important;
          }

          .hall-ticket-container p,
          .hall-ticket-container span,
          .hall-ticket-container div {
            font-size: 11px !important;
          }

          /* Adjust spacing for better fit */
          .hall-ticket-container .mb-4 {
            margin-bottom: 0.5rem !important;
          }
          .hall-ticket-container .mb-2 {
            margin-bottom: 0.25rem !important;
          }
          .hall-ticket-container .mb-3 {
            margin-bottom: 0.375rem !important;
          }
          .hall-ticket-container .mt-4 {
            margin-top: 0.5rem !important;
          }
          .hall-ticket-container .mt-2 {
            margin-top: 0.25rem !important;
          }
          .hall-ticket-container .p-4 {
            padding: 0.5rem !important;
          }
          .hall-ticket-container .p-2 {
            padding: 0.25rem !important;
          }
          .hall-ticket-container .p-3 {
            padding: 0.375rem !important;
          }

          /* Adjust grid gaps */
          .hall-ticket-container .gap-4 {
            gap: 0.5rem !important;
          }
          .hall-ticket-container .gap-2 {
            gap: 0.25rem !important;
          }

          /* Adjust photo size */
          .hall-ticket-container .w-24 {
            width: 3rem !important;
          }
          .hall-ticket-container .h-32 {
            height: 4rem !important;
          }

          /* Adjust logo sizes */
          .hall-ticket-container .w-30 {
            width: 2.5rem !important;
          }
        }
      `}</style>

      {/* Hall Ticket Content */}
      <div
        id="hall-ticket-content"
        className="hall-ticket-container bg-white p-4 border-2 border-gray-200 rounded-lg text-sm"
      >
        {/* Header Section */}
        <div className="mb-4">
          {/* Left - Center - Right logos */}
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="w-30 flex-shrink-0">
              <Image
                src="/htleft.jpg"
                alt="Left logo"
                width={120}
                height={120}
                className="object-contain"
              />
            </div>

            <div className="flex-1 text-center">
              <div className="w-full mb-2">
                <Image
                  src="/htup.png"
                  alt="Header banner"
                  width={1123}
                  height={100}
                  className="w-full h-auto object-contain mx-auto"
                />
              </div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                Dakshina Kerala Islam Matha Vidyabhyasa Board
              </h1>
              <p className="text-gray-600 text-sm uppercase tracking-wide">
                ദക്ഷിണ കേരള ഇസ്ലാം മത വിദ്യാഭ്യാസ ബോർഡ്
              </p>
              <p className="text-gray-600 text-sm uppercase tracking-wide">
                EXAMINATION HALL TICKET
              </p>
            </div>

            <div className="w-30 flex-shrink-0 text-right">
              <Image
                src="/htright.jpg"
                alt="Right logo"
                width={120}
                height={120}
                className="object-contain"
              />
            </div>
          </div>

          {/* Exam title */}
          <div className="bg-teal-50 p-2 rounded-lg mt-2 text-center w-full">
            <h2
              className="text-base font-semibold text-teal-900"
              style={{ textTransform: "capitalize" }}
            >
              {data.examTitle?.toLowerCase() || "N/A"}
            </h2>
          </div>
        </div>

        {/* Hall Ticket Number */}
        <div className="text-center mb-4">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-2 inline-block">
            <p className="text-sm font-bold text-red-800">
              Hall Ticket No:{" "}
              <span className="font-extrabold text-red-900">
                {data.hallTicketNumber || "N/A"}
              </span>
              {" | Class: "}
              <span className="font-extrabold text-red-900">
                {toRomanIfNumber(data.classLevel)}
              </span>
            </p>
          </div>
        </div>

        {/* Student Information Section */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Left Column - Student Details */}
          <div className="col-span-2 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 border-b pb-1">
              Student Information
            </h3>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Name:</span>
                <span
                  className="text-gray-900"
                  style={{ textTransform: "capitalize" }}
                >
                  {data.fullName?.toLowerCase() || "N/A"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Admission No:</span>
                <span
                  className="text-gray-900"
                  style={{ textTransform: "uppercase" }}
                >
                  {data.admissionNumber?.toLowerCase() || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Gender:</span>
                <span
                  className="text-gray-900"
                  style={{ textTransform: "capitalize" }}
                >
                  {data.gender?.toLowerCase() || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Parent Phone:</span>
                <span className="text-gray-900">
                  {data.guardianPhone || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Exam Center:</span>
                <span
                  className="text-gray-900"
                  style={{ textTransform: "capitalize" }}
                >
                  {data.madarsa?.toLowerCase() || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Mekhala:</span>
                <span
                  className="text-gray-900"
                  style={{ textTransform: "capitalize" }}
                >
                  {loading
                    ? "Loading..."
                    : madarsaDetails?.mekhala?.toLowerCase() || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Sadar:</span>
                <span
                  className="text-gray-900"
                  style={{ textTransform: "capitalize" }}
                >
                  {loading
                    ? "Loading..."
                    : madarsaDetails?.sadarName?.toLowerCase() || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">
                  Sadar Address:
                </span>
                <span
                  className="text-gray-900"
                  style={{ textTransform: "capitalize" }}
                >
                  {loading
                    ? "Loading..."
                    : madarsaDetails?.sadarAddress?.toLowerCase() || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column - Photo */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-900 border-b pb-1">
              Photo
            </h4>
            <div className="w-24 h-32 border-2 border-gray-300 flex items-center justify-center rounded-lg bg-gray-50">
              {loadingPhoto ? (
                <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-xs text-gray-500">Loading...</span>
                </div>
              ) : profilePicture ? (
                <Image
                  src={profilePicture}
                  alt="Student Photo"
                  width={96}
                  height={128}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-xs text-gray-500">No Photo</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Exam Details Section */}
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-900 border-b pb-1 mb-2">
            Examination Details
          </h3>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex justify-between">
              <span className="font-medium text-gray-700">Exam Title:</span>
              <span
                className="text-gray-900"
                style={{ textTransform: "capitalize" }}
              >
                {data.examTitle?.toLowerCase() || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-700">Exam Date:</span>
              <span className="text-gray-900">{formatDate(data.examDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-700">
                Registration Date:
              </span>
              <span className="text-gray-900">
                {formatDate(data.createdAt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-700">Status:</span>
              <span className="text-green-600 font-semibold">APPROVED</span>
            </div>
          </div>
        </div>

        {/* Timetable Section */}
        {examDetails?.timetableEntries?.length > 0 && (
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-900 border-b pb-1 mb-2">
              Examination Timetable
            </h3>

            <div className="bg-teal-50 border border-teal-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-teal-600 text-white">
                    <th className="p-2 text-left border-r border-teal-500">
                      Date
                    </th>
                    <th className="p-2 text-left border-r border-teal-500">
                      Subject
                    </th>
                    <th className="p-2 text-left border-r border-teal-500">
                      Time
                    </th>
                    <th className="p-2 text-left">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {examDetails.timetableEntries.map((entry, index) => (
                    <tr
                      key={index}
                      className={`${
                        index % 2 === 0 ? "bg-teal-50" : "bg-white"
                      } border-b border-teal-200`}
                    >
                      <td className="p-2 font-medium text-teal-900 border-r border-teal-200">
                        {formatDate(entry.date)}
                      </td>
                      <td className="p-2 text-teal-700 border-r border-teal-200">
                        {entry.subject}
                      </td>
                      <td className="p-2 text-teal-700 border-r border-teal-200">
                        {entry.startTime && entry.endTime
                          ? `${formatTime12Hour(entry.startTime)} - ${formatTime12Hour(entry.endTime)}`
                          : "N/A"}
                      </td>
                      <td className="p-2 text-teal-700">
                        {entry.duration
                          ? formatDuration(entry.duration)
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Loading indicator for timetable */}
        {loadingExam && (
          <div className="mb-3 text-center">
            <p className="text-xs text-gray-500">Loading timetable...</p>
          </div>
        )}

        {/* Rules to be Obeyed */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">
            നിബന്ധനകൾ:
          </h3>
          <ol className="text-xs text-yellow-700 space-y-1 list-decimal list-inside">
            <li>ഉത്തരപ്പേപ്പറിൽ രജിസ്റ്റർ നമ്പർ മാത്രം എഴുതുക.</li>
            <li>ഹാൾ ടിക്കറ്റ് പരീക്ഷയുടെ അവസാന നിമിഷം വരെ സൂക്ഷിക്കുക.</li>
            <li>
              ഫിഖ്ഹ് പേപ്പറുകളിൽ ശാഫികൾ &quot;ശാഫി&quot; എന്നും ഹഫികൾ
              &quot;ഹനഫി&quot; എന്നും എഴുതുക.
            </li>
            <li>
              തിരിച്ചറിയാൻ കഴിയുന്ന വിധത്തിൽ പേന കൊണ്ട് വൃത്തിയാക്കി എഴുതുക.
            </li>
            <li>
              നിശ്ചിത സമയം കഴിഞ്ഞ് 15 മിനിട്ട് താമസിച്ച് വരുന്നവർക്ക് പരീക്ഷാ
              ഹാളിൽ പ്രവേശനം ലഭിക്കുന്നതല്ല.
            </li>
            <li>
              ക്രമക്കേട് കാണിക്കുന്നവരെ പുറത്താക്കാനുള്ള അധികാരം സൂപ്പർവൈസർക്ക്
              ഉണ്ടായിരിക്കുന്നതാണ്.
            </li>
            <li>
              പരീക്ഷാ ഹാളിൽ നിർബന്ധമായും മൊബൈൽ ഫോൺ ഒഴിവാക്കേണ്ടതാണ്. എന്നാൽ
              സൂപ്പർവൈസർക്ക് പരീക്ഷാ സംബന്ധമായി അടിയന്തിര അന്വേഷണം ആവശ്യമായി
              വന്നാൽ ഹാളിന് പുറത്ത് ഉപയോഗിക്കാവുന്നതാണ്.
            </li>
          </ol>
        </div>

        {/* Signatures Section */}
        <div className="grid grid-cols-3 gap-4 pt-3 border-t">
          <div className="text-center">
            <div className="h-12 border-b border-dashed border-gray-400 mb-1"></div>
            <p className="text-xs font-medium text-gray-700">
              Student Signature
            </p>
          </div>
          <div className="text-center">
            <div className="h-12 border-b border-dashed border-gray-400 mb-1"></div>
            <p className="text-xs font-medium text-gray-700">
              Supervisor Signature
            </p>
          </div>
          <div className="text-center">
            <div className="h-12 flex items-center justify-center mb-1">
              <Image
                src="/gcsign.png"
                alt="General Convener Signature"
                width={80}
                height={40}
                className="object-contain"
              />
            </div>
            <p className="text-xs font-medium text-gray-700">
              General Convener Signature
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-4 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Generated: {new Date().toLocaleString()} | DKJU - Exam Dept.
          </p>
          <p className="text-xs text-gray-400">
            Computer generated hall ticket. No signature required.
          </p>
        </div>
      </div>
    </>
  );
};

export default HallTicket;
