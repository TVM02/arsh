"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/authUtils";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileCheck,
  Calendar,
  Clock,
  DollarSign,
  AlertCircle,
  IndianRupee,
} from "lucide-react";
import {
  getDocuments,
  createDocument,
  COLLECTIONS,
} from "@/lib/firestoreService";
import { where, orderBy, limit } from "firebase/firestore";
import useAuthStore from "@/lib/authStore";
import { toast } from "sonner";
import { getNextHallTicketNumber, generateFormattedHallTicketNumber } from "@/lib/hallTicketService";
// import { uploadHallTicketForRegistration } from "../../admin/fix-admit";
import { saveHallTicketData } from "@/lib/hallTicketDataService";
import { formatDate, formatDateTime } from "@/lib/dateUtils";
import { getSetting } from "@/lib/settingsService";

// Load Razorpay script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// Helper function to extract numeric class from class string
const extractClassNumber = (classString) => {
  if (!classString) return null;

  // Convert to lowercase and extract numbers
  const cleanClass = classString.toLowerCase().trim();

  // Look for patterns like "class 7", "7", "grade 7", "7th", etc.
  const numberMatch = cleanClass.match(/(\d+)/);

  if (numberMatch) {
    return parseInt(numberMatch[1], 10);
  }

  return null;
};

// Helper function to check if exam class matches student class
const isClassMatch = (examClass, studentClass) => {
  if (!examClass || !studentClass) {
    return false; // If either class is not specified, don't show the exam
  }

  // Exact string match first (for cases like "3" === "3")
  if (examClass.trim() === studentClass.trim()) {
    return true;
  }

  const examClassNum = extractClassNumber(examClass);
  const studentClassNum = extractClassNumber(studentClass);

  // If we can't extract numbers, try case-insensitive string comparison
  if (examClassNum === null || studentClassNum === null) {
    const examClassLower = examClass.toLowerCase().trim();
    const studentClassLower = studentClass.toLowerCase().trim();

    // Check for common variations
    const isMatch =
      examClassLower === studentClassLower ||
      examClassLower.includes(studentClassLower) ||
      studentClassLower.includes(examClassLower);

    return isMatch;
  }

  const isMatch = examClassNum === studentClassNum;

  return isMatch;
};

const normalizeExamType = (value) =>
  String(value || "PUBLIC").trim().toUpperCase();

const normalizeClassName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^class\s+/, "");

const getResultClass = (result) =>
  normalizeClassName(result.class || result.classLevel || result.examClass);

const isFailedResult = (result) => {
  const status = String(
    result.resultStatus || result.status || result.promotedStatus || "",
  ).toLowerCase();

  if (status.includes("fail")) return true;
  if (status.includes("pass")) return false;
  if (result.isPassed === false || result.passed === false) return true;

  if (Array.isArray(result.result)) {
    return result.result.some((subject) => {
      const passMark = Number(subject.passMark || 30);
      const marks = Number(subject.marks);
      return Number.isFinite(marks) && marks < passMark;
    });
  }

  return false;
};

export default function StudentExamPage() {
  const { user } = useAuth();
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State variables
  const [exams, setExams] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [madrasas, setMadrasas] = useState([]);
  const [mekhalas, setMekhalas] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null); // Explicit fetch from students collection
  const [revaluationEnabled, setRevaluationEnabled] = useState(false);
  const [failedExamClasses, setFailedExamClasses] = useState(new Set());

  // Get exam status based on dates and student's registrations
  const getExamStatus = (exam) => {
    const now = new Date();
    const examDate = exam.examDate?.toDate
      ? exam.examDate.toDate()
      : new Date(exam.examDate);
    const registrationDeadline = exam.registrationDeadline?.toDate
      ? exam.registrationDeadline.toDate()
      : new Date(exam.registrationDeadline);

    // Check if student is already registered
    const registration = myRegistrations.find((reg) => reg.examId === exam.id);
    if (registration) {
      if (
        registration.status === "registered" ||
        registration.status === "approved"
      ) {
        return {
          status: "registered",
          text: "Registered",
          color: "bg-green-500",
        };
      } else if (registration.status === "pending") {
        return {
          status: "pending",
          text: "Pending Approval",
          color: "bg-yellow-500",
        };
      } else if (registration.status === "rejected") {
        return { status: "rejected", text: "Rejected", color: "bg-red-500" };
      }
    }

    // Check registration status based on dates
    if (now > examDate) {
      return {
        status: "completed",
        text: "Exam Completed",
        color: "bg-gray-500",
      };
    } else if (now > registrationDeadline) {
      return {
        status: "closed",
        text: "Registration Closed",
        color: "bg-red-500",
      };
    } else {
      return {
        status: "open",
        text: "Registration Open",
        color: "bg-green-500",
      };
    }
  };

  const fetchStudentData = useCallback(async () => {
    if (!userData?.uid) {
      console.log(
        "No user ID found, cannot fetch student data.0",
        user,
        userData,
      );
      return;
    }
    try {
      // Use uid to query, as explicitly requested
      const users = await getDocuments(COLLECTIONS.STUDENTS, [
        where("uid", "==", userData.uid),
      ]);
      if (users.length > 0) {
        setStudentProfile(prev => {
          // Prevent unnecessary state updates if data is structurally identical
          if (prev && JSON.stringify(prev) === JSON.stringify(users[0])) return prev;
          return users[0];
        });
        // console.log("Explicitly fetched student profile:", users[0]);
      }
    } catch (err) {
      console.error("Error fetching student profile:", err);
    }
  }, [user, userData?.uid]);

  const fetchExams = useCallback(async () => {
    try {
      const constraints = [
        where("isActive", "==", true),
        orderBy("createdAt", "desc"),
      ];
      const fetchedExams = await getDocuments(COLLECTIONS.EXAMS, constraints);

      const currentUser = studentProfile || userData;

      // If user data is not yet loaded, we cannot filter by class
      if (!currentUser) {
        console.log("FetchExams: User data not loaded yet.");
        return;
      }

      // Filter exams by student's class and ensure they are active
      const studentClass =
        currentUser?.classLevel ||
        currentUser?.admissionClass ||
        currentUser?.class;

      const filteredExams = fetchedExams.filter((exam) => {
        if (exam.isActive !== true) {
          return false;
        }

        const examType = normalizeExamType(exam.examType);

        if (examType === "SAY") {
          const examClass = normalizeClassName(exam.class);
          return failedExamClasses.has(examClass);
        }

        if (!studentClass || !isClassMatch(exam.class, studentClass)) {
          return false;
        }

        if (examType === "PUBLIC") return true;
        if (examType === "REVALUATION") return revaluationEnabled;
        return false;
      });
      setExams(filteredExams);

    } catch (error) {
      console.error("Error fetching exams:", error);
      setError("Failed to fetch exams");
    }
  }, [userData, studentProfile, revaluationEnabled, failedExamClasses]);

  const fetchExamVisibilityControls = useCallback(async () => {
    try {
      const enabled = await getSetting("revaluationEnabled", false);
      setRevaluationEnabled(prev => prev === Boolean(enabled) ? prev : Boolean(enabled));
    } catch (error) {
      console.error("Error fetching exam visibility settings:", error);
      setRevaluationEnabled(prev => prev === false ? prev : false);
    }
  }, []);

  const fetchFailedResultClasses = useCallback(async () => {
    const currentUser = studentProfile || userData;
    if (!currentUser) return;

    const identifiers = [
      currentUser.uid,
      currentUser.id,
      currentUser.admissionNumber,
      currentUser.email,
    ].filter(Boolean);

    try {
      const fields = [
        "studentId",
        "uid",
        "studentUid",
        "admissionNumber",
        "email",
        "studentEmail",
      ];
      const resultsMap = new Map();

      await Promise.all(
        fields.flatMap((field) =>
          identifiers.map(async (identifier) => {
            try {
              const matches = await getDocuments(
                COLLECTIONS.EXAM_RESULTS || "results",
                [where(field, "==", identifier), limit(25)],
              );
              matches.forEach((result) => resultsMap.set(result.id, result));
            } catch (error) {
              console.warn(`Failed result lookup skipped for ${field}:`, error);
            }
          }),
        ),
      );

      const failedClasses = new Set();
      resultsMap.forEach((result) => {
        const belongsToStudent = [
          result.studentId,
          result.uid,
          result.studentUid,
          result.admissionNumber,
          result.email,
          result.studentEmail,
        ]
          .filter(Boolean)
          .some((value) => identifiers.includes(value));
        if (!belongsToStudent) return;

        if (isFailedResult(result)) {
          const className = getResultClass(result);
          if (className) failedClasses.add(className);
        }
      });
      setFailedExamClasses(prev => {
        if (prev.size === failedClasses.size && [...prev].every(c => failedClasses.has(c))) {
          return prev;
        }
        return failedClasses;
      });
    } catch (error) {
      console.error("Error fetching failed result classes:", error);
      setFailedExamClasses(prev => prev.size === 0 ? prev : new Set());
    }
  }, [studentProfile, userData]);

  const fetchMyRegistrations = useCallback(async () => {
    if (!userData?.uid && !user?.uid) return;

    try {
      const constraints = [
        where("studentId", "==", userData?.uid || user?.uid),
        orderBy("createdAt", "desc"),
      ];
      const fetchedRegistrations = await getDocuments(
        COLLECTIONS.EXAM_REGISTRATIONS,
        constraints,
      );
      setMyRegistrations(fetchedRegistrations);
    } catch (error) {
      console.error("Error fetching my registrations:", error);
    }
  }, [userData?.uid, user?.uid]);

  const fetchInstitutions = useCallback(async () => {
    try {
      const [madrasasData, mekhalasData] = await Promise.all([
        getDocuments(COLLECTIONS.MADRASAS),
        getDocuments(COLLECTIONS.MEKHALAS),
      ]);
      setMadrasas(madrasasData);
      setMekhalas(mekhalasData);
    } catch (error) {
      console.error("Error fetching institutions:", error);
    }
  }, []);

  // Initialize payment system
  const initiateExamPayment = async (examData, registrationData, htCtx = {}) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (!razorpayLoaded || !window.Razorpay) {
          reject(new Error("Payment system not loaded"));
          return;
        }

        // Create order for exam registration
        const res = await fetch("/api/create-exam-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Math.round((parseFloat(examData.fees) || 0) * 100), // Convert to paise
            purpose: "exam_registration",
            examId: examData.id,
            studentId: registrationData.studentId,
          }),
        });

        if (!res.ok) {
          reject(new Error(`Failed to create payment order: ${res.status}`));
          return;
        }

        const order = await res.json();
        if (order.error) {
          reject(new Error(order.error));
          return;
        }

        // Add CSS to ensure Razorpay popup has highest z-index
        const addRazorpayStyles = () => {
          const existingStyle = document.getElementById("razorpay-z-index-fix");
          if (!existingStyle) {
            const style = document.createElement("style");
            style.id = "razorpay-z-index-fix";
            style.innerHTML = `
              .razorpay-checkout-frame {
                z-index: 999999 !important;
              }
              .razorpay-overlay {
                z-index: 999998 !important;
              }
              .razorpay-container {
                z-index: 999999 !important;
              }
            `;
            document.head.appendChild(style);
          }
        };

        addRazorpayStyles();

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: order.currency,
          name: "DKJU - Exam Registration",
          description: `Registration fee for ${examData.title}`,
          order_id: order.id,
          prefill: {
            name: registrationData.studentName,
            email: registrationData.studentEmail,
            contact: userData.phone || "",
          },
          notes: {
            exam_id: examData.id,
            student_id: registrationData.studentId,
            purpose: "exam_registration",
          },
          theme: { color: "#0f766e" },

          handler: async function (response) {
            try {
              // Generate hall ticket number
              const hallTicketNumber = await generateFormattedHallTicketNumber(
                examData.id,
                htCtx,
              );

              // Payment successful - save registration
              const finalRegistrationData = {
                ...registrationData,
                hallTicketNumber: hallTicketNumber,
                paymentId: response.razorpay_payment_id,
                orderId: order.id,
                paymentStatus: "completed",
                paymentAmount: order.amount / 100,
                paymentMethod: "razorpay",
                paidAt: new Date(),
                status: "registered", // Mark as registered after successful payment
              };

              resolve(finalRegistrationData);
            } catch (err) {
              reject(new Error("Payment verification error: " + err.message));
            }
          },

          modal: {
            ondismiss: function () {
              reject(new Error("Payment cancelled by user"));
            },
          },
        };

        const rzp = new window.Razorpay(options);

        // Additional safety: Ensure popup opens properly
        setTimeout(() => {
          rzp.open();
        }, 100);
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleRegistration = async () => {
    // Use the freshest profile data if available
    const currentUser = studentProfile || userData;

    if (!selectedExam || !currentUser) return;

    const studentClass =
      currentUser?.classLevel ||
      currentUser?.admissionClass ||
      currentUser?.class;

    try {
      setPaymentProcessing(true);

      // Check if Razorpay is loaded
      if (!razorpayLoaded) {
        throw new Error(
          "Payment system not loaded. Please refresh and try again.",
        );
      }

      // Close the dialog before opening Razorpay to prevent z-index conflicts
      setIsRegistrationOpen(false);

      // Small delay to ensure dialog is closed
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Prepare registration data
      const registrationData = {
        examId: selectedExam.id,
        examTitle: selectedExam.title,
        examDate: selectedExam.examDate,
        examFees: selectedExam.fees,
        studentId: userData.uid,
        studentName:
          userData.fullName ||
          userData.name ||
          userData.displayName ||
          "Unknown",
        studentEmail: userData.email,
        studentGender:
          userData.gender || userData.studentGender || "Not Specified",
        madarsa: userData.madarsaId || "Not specified",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Resolve hall ticket context for formatted number
      const htMadrasaObj = madrasas.find((m) => m.madarsaId === userData.madarsaId || m.id === userData.madarsaId);
      let htMekhalaObj = mekhalas.find((m) => m.id === userData.mekhalaId);
      if (!htMekhalaObj && htMadrasaObj?.mekhala)
        htMekhalaObj = mekhalas.find((m) => m.name === htMadrasaObj.mekhala);
      const htCtx = {
        districtName: htMadrasaObj?.district || userData.district || "",
        mekhalaNumber: htMekhalaObj?.mekhalaNumber || "",
        madarsaId: userData.madarsaId || "",
      };

      let paymentData;
      const fees = parseFloat(selectedExam.fees) || 0;

      if (fees > 0) {
        // Initiate payment for paid exams
        paymentData = await initiateExamPayment(selectedExam, registrationData, htCtx);
      } else {
        // Handle free exams - generate formatted hall ticket number
        const hallTicketNumber = await generateFormattedHallTicketNumber(selectedExam.id, htCtx);
        paymentData = {
          ...registrationData,
          hallTicketNumber: hallTicketNumber,
          paymentId: "FREE_" + Date.now(),
          orderId: "FREE_" + Date.now(),
          paymentStatus: "completed",
          paymentAmount: 0,
          paymentMethod: "free",
          paidAt: new Date(),
          status: "registered",
        };
      }

      // Save registration with payment details
      const docRef = await createDocument(
        COLLECTIONS.EXAM_REGISTRATIONS,
        paymentData,
      );

      // --- Hall Ticket Data Saving Logic ---
      try {
        // Resolve Madrasa Details
        const madrasaObj = madrasas.find(
          (m) => m.madarsaId === userData.madarsaId,
        );
        const madrasaName = madrasaObj?.name || userData.madarsaId || "N/A";

        // Resolve Mekhala Details
        let mekhalaObj = mekhalas.find(
          (m) => m.mekhalaId === userData.mekhalaId,
        );
        let mekhalaId = userData.mekhalaId;

        // Fallback: Try to find mekhala by name if ID match fails but name is in madrasa object
        if (!mekhalaObj && madrasaObj?.mekhala) {
          mekhalaObj = mekhalas.find((m) => m.name === madrasaObj.mekhala);
          if (mekhalaObj) {
            mekhalaId = mekhalaObj.id;
          }
        }

        // console.log("Madrasa Details:", madrasaObj);

        const hallTicketData = {
          examId: selectedExam.id,
          examTitle: selectedExam.title,
          examDate: selectedExam.examDate,
          // New fields as per recent updates
          examFees: selectedExam.fees || 0,
          subject: selectedExam.subject || "",
          duration: selectedExam.duration || "",
          totalMarks: selectedExam.totalMarks || "",

          studentId: currentUser.uid,
          fullName:
            currentUser.fullName ||
            currentUser.name ||
            currentUser.displayName ||
            "Unknown",
          admissionNumber: currentUser.admissionNumber || "N/A",
          classLevel: studentClass || "N/A",
          gender: currentUser.gender || currentUser.studentGender || "N/A",
          guardianName:
            currentUser.guardianName || currentUser.guardian || "N/A",
          dateOfBirth: currentUser.dateOfBirth || "N/A",
          guardianPhone:
            currentUser.guardianPhone || currentUser.phone || "N/A",
          profilePictureUrl:
            currentUser.profilePicture || currentUser.profilePictureUrl || null,

          madarsa: madrasaName,
          madarsaId: currentUser.madarsaId,
          mekhala: madrasaObj?.district || mekhalaObj?.name || "PothenCode",
          mekhalaId: mekhalaId || "",
          sadarName: madrasaObj?.adminName || "N/A",
          sadarAddress: madrasaObj?.address || "N/A",

          hallTicketNumber: paymentData.hallTicketNumber,
          createdAt: new Date(),
          timetableEntries:
            selectedExam.timetableEntries || selectedExam.timetable || [],
          generatedPdfUrl: null,
        };
        // console.log("Hall ticket data:", hallTicketData);

        await saveHallTicketData(
          selectedExam.id,
          currentUser.uid,
          hallTicketData,
        );
        console.log("Hall ticket data saved successfully");
      } catch (htError) {
        console.error("Failed to save hall ticket data:", htError);
        // We don't block success message here, as registration is done.
        // Admin can regenerate if needed.
      }

      toast.success("Payment successful! You are now registered for the exam.");

      // Clear selected exam
      setSelectedExam(null);
      await fetchMyRegistrations();
    } catch (error) {
      console.error("Registration error:", error);
      if (error.message === "Payment cancelled by user") {
        toast.error("Payment was cancelled. Registration not completed.");
        setIsRegistrationOpen(true);
      } else {
        toast.error(
          error.message || "Failed to complete registration. Please try again.",
        );
        setIsRegistrationOpen(true);
      }
    } finally {
      setPaymentProcessing(false);
    }
  };

  useEffect(() => {
    // Load Razorpay script
    loadRazorpayScript().then((loaded) => {
      setRazorpayLoaded(loaded);
      if (!loaded) {
        console.error("Failed to load Razorpay script");
      }
    });

    const fetchAllData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchExamVisibilityControls(),
          fetchFailedResultClasses(),
        ]);
        await Promise.all([
          fetchExams(),
          fetchMyRegistrations(),
          fetchInstitutions(),
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load exam data");
      } finally {
        setLoading(false);
      }
    };

    if (user || userData) {
      fetchAllData();
    }
  }, [
    user,
    userData,
    fetchExamVisibilityControls,
    fetchFailedResultClasses,
    fetchExams,
    fetchMyRegistrations,
    fetchInstitutions,
  ]);

  // Fetch student data separately when user/userData is available
  useEffect(() => {
    if (user?.uid || userData?.uid) {
      fetchStudentData();
    }
  }, [fetchStudentData, user?.uid, userData?.uid]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading exams...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Available Exams
            </h1>
            <p className="text-gray-600 mt-2">
              Register for upcoming examinations
            </p>
            {(userData?.class || userData?.admissionClass) && (
              <div className="mt-2">
                <Badge
                  variant="outline"
                  className="text-blue-600 border-blue-200"
                >
                  Showing exams for{" "}
                  {userData?.class || userData?.admissionClass}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Available Exams */}
        <div className="grid gap-4">
          {exams.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <FileCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No exams available
                </h3>
                {userData?.class || userData?.admissionClass ? (
                  <p className="text-gray-500">
                    No active exams found for{" "}
                    {userData?.class || userData?.admissionClass}. Check back
                    later for new exam announcements.
                  </p>
                ) : (
                  <p className="text-gray-500">
                    No active exams available. Please ensure your class
                    information is updated in your profile.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            exams.map((exam) => {
              const examStatus = getExamStatus(exam);
              const canRegister = examStatus.status === "open";

              return (
                <Card key={exam.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                      <div className="flex-1 w-full">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold break-words">
                            {exam.title}
                          </h3>
                          <Badge
                            className={`${examStatus.color} text-white shrink-0`}
                          >
                            {examStatus.text}
                          </Badge>
                        </div>

                        <div className="text-gray-600 mb-4 text-sm md:text-base">
                          <p>{exam.description}</p>
                        </div>

                        {/* Subject, Class, Duration, Marks */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                          <div>
                            <span className="text-xs font-medium text-gray-500 uppercase block mb-1">
                              Subject
                            </span>
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {exam.subject || "Not specified"}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-500 uppercase block mb-1">
                              Class
                            </span>
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {exam.class || "Not specified"}
                            </p>
                          </div>
                          {exam.duration && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 uppercase block mb-1">
                                Duration
                              </span>
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {exam.duration}
                              </p>
                            </div>
                          )}
                          {exam.totalMarks && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 uppercase block mb-1">
                                Total Marks
                              </span>
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {exam.totalMarks}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 shrink-0" />
                            <span>Exam: {formatDateTime(exam.examDate)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 shrink-0" />
                            <span>
                              Deadline: {formatDate(exam.registrationDeadline)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <IndianRupee className="h-4 w-4 shrink-0" />
                            <span>Fees: ₹{exam.fees}</span>
                          </div>
                        </div>

                        {exam.notice && (
                          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-yellow-800">
                                  Important Notice:
                                </p>
                                <p className="text-sm text-yellow-700 whitespace-pre-wrap break-words">
                                  {exam.notice}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="w-full md:w-auto md:ml-6 mt-4 md:mt-0">
                        {canRegister ? (
                          <Button
                            className="w-full md:w-auto"
                            onClick={() => {
                              setSelectedExam(exam);
                              setIsRegistrationOpen(true);
                            }}
                          >
                            Register Now
                          </Button>
                        ) : (
                          <Button
                            disabled
                            variant="outline"
                            className="w-full md:w-auto"
                          >
                            {examStatus.status === "registered"
                              ? "Already Registered"
                              : examStatus.status === "pending"
                                ? "Payment Pending"
                                : "Registration Closed"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Registration Dialog */}
        <Dialog
          open={isRegistrationOpen}
          onOpenChange={!paymentProcessing ? setIsRegistrationOpen : undefined}
        >
          <DialogContent className="bg-white overflow-auto h-[80vh]">
            <DialogHeader>
              <DialogTitle>Confirm Exam Registration & Payment</DialogTitle>
              <DialogDescription>
                Please review the exam details and proceed with payment to
                complete your registration.
              </DialogDescription>
            </DialogHeader>

            {selectedExam && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">{selectedExam.title}</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    {selectedExam.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Subject:</span>
                    <p>{selectedExam.subject || "Not specified"}</p>
                  </div>
                  <div>
                    <span className="font-medium">Class:</span>
                    <p>{selectedExam.class || "Not specified"}</p>
                  </div>
                  <div>
                    <span className="font-medium">Exam Date:</span>
                    <p>{formatDateTime(selectedExam.examDate)}</p>
                  </div>
                  <div>
                    <span className="font-medium">Registration Deadline:</span>
                    <p>{formatDate(selectedExam.registrationDeadline)}</p>
                  </div>
                  {selectedExam.duration && (
                    <div>
                      <span className="font-medium">Duration:</span>
                      <p>{selectedExam.duration}</p>
                    </div>
                  )}
                  {selectedExam.totalMarks && (
                    <div>
                      <span className="font-medium">Total Marks:</span>
                      <p>{selectedExam.totalMarks}</p>
                    </div>
                  )}
                </div>

                {selectedExam.rulesAndRegulations && (
                  <div className="bg-gray-50 p-3 rounded-lg border">
                    <h5 className="font-medium text-sm mb-1">
                      Rules & Regulations
                    </h5>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {selectedExam.rulesAndRegulations}
                    </p>
                  </div>
                )}

                {/* Student and Payment Info */}
                <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Student Name:</span>
                    <span>
                      {userData?.fullName ||
                        userData?.name ||
                        userData?.displayName ||
                        "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Registration Fee:</span>
                    <span className="text-lg font-bold text-blue-600">
                      ₹{selectedExam.fees}
                    </span>
                  </div>
                </div>

                {/* Payment Notice */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-yellow-600" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800">
                        Payment Required
                      </p>
                      <p className="text-yellow-700">
                        You will be redirected to secure payment gateway.
                        Registration will be completed only after successful
                        payment.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payment System Status */}
                {!razorpayLoaded && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Loading payment system... Please wait.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsRegistrationOpen(false)}
                    disabled={paymentProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRegistration}
                    disabled={paymentProcessing || !razorpayLoaded}
                    className="min-w-[140px]"
                  >
                    {paymentProcessing ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Processing...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <IndianRupee className="h-4 w-4" />
                        Pay & Register
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
