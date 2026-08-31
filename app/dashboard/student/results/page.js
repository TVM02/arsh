"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Award,
  FileText,
  Calendar,
  GraduationCap,
  BookOpen,
  Eye,
  CheckCircle,
  XCircle,
  Printer,
  AlertCircle,
  Download,
  Search,
} from "lucide-react";
import { where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getDocuments, COLLECTIONS } from "@/lib/firestoreService";
import useAuthStore from "@/lib/authStore";
import { format, isValid } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";

export default function StudentResults() {
  const { user, userData } = useAuthStore();
  const [hallTickets, setHallTickets] = useState([]);
  const [selectedHallTicket, setSelectedHallTicket] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resultLoading, setResultLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewingResult, setViewingResult] = useState(null);

  // Helper function to safely format dates
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";

    try {
      let date;
      if (timestamp.toDate && typeof timestamp.toDate === "function") {
        date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (
        typeof timestamp === "string" ||
        typeof timestamp === "number"
      ) {
        date = new Date(timestamp);
      } else {
        return "N/A";
      }

      if (isValid(date)) {
        return format(date, "MMM dd, yyyy");
      } else {
        return "N/A";
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return "N/A";
    }
  };

  // Fetch student's exam registrations (which contain hall ticket info)
  useEffect(() => {
    const fetchExamRegistrations = async () => {
      const studentId = userData?.uid || user?.uid;
      const admissionNo = userData?.admissionNumber;

      if (!studentId && !admissionNo) {
        if (!user) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        // Try studentId first, then admissionNumber if needed
        let registrationsData = [];

        if (studentId) {
          registrationsData = await getDocuments(
            COLLECTIONS.EXAM_REGISTRATIONS,
            [where("studentId", "==", studentId)],
          );
        }

        registrationsData.sort((a, b) => {
          const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return tb - ta;
        });

        if (registrationsData.length === 0 && admissionNo) {
          registrationsData = await getDocuments(
            COLLECTIONS.EXAM_REGISTRATIONS,
            [where("admissionNumber", "==", admissionNo)],
          );
        }

        registrationsData.sort((a, b) => {
          const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return tb - ta;
        });

        console.log("All Registered Exams Found:", registrationsData);

        // Filter by registered or approved status (same as exam/registrations page)
        const validRegistrations = registrationsData.filter(
          (reg) => reg.status === "registered" || reg.status === "approved",
        );

        setHallTickets(validRegistrations);

        // Auto-select first registration if available
        if (validRegistrations.length > 0) {
          setSelectedHallTicket(validRegistrations[0]);
          const latestResult = await fetchResult(validRegistrations[0]);
          if (latestResult) {
            setViewingResult(latestResult);
          }
        }
      } catch (error) {
        console.error("Error fetching exam registrations:", error);
        setError("Failed to load your exams. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchExamRegistrations();
  }, [user, userData?.uid, userData?.admissionNumber]);

  // Fetch result for selected hall ticket
  const fetchResult = async (hallTicket) => {
    if (!hallTicket) return;

    try {
      setResultLoading(true);
      setError("");

      const docId = `${hallTicket.examId}_${hallTicket.hallTicketNumber}`;
      const resultRef = doc(db, COLLECTIONS.EXAM_RESULTS || "results", docId);
      const resultSnap = await getDoc(resultRef);

      // Also fetch exam details for timetableEntries (pass marks, etc.)
      const examRef = doc(db, COLLECTIONS.EXAMS || "exams", hallTicket.examId);
      const examSnap = await getDoc(examRef);
      const examData = examSnap.exists()
        ? { id: examSnap.id, ...examSnap.data() }
        : null;

      if (resultSnap.exists()) {
        const data = resultSnap.data();
        if (!data.isPublished) {
          setResult(null);
          setError("Result not yet published for this exam.");
          return null;
        }
        const resultData = resultSnap.id
          ? { id: resultSnap.id, ...data, examDetails: examData }
          : { ...data, examDetails: examData };
        setResult(resultData);
        return resultData;
      } else {
        setResult(null);
        setError("Result not yet published for this exam.");
        return null;
      }
    } catch (error) {
      console.error("Error fetching result:", error);
      setError("Failed to load result. Please try again.");
      setResult(null);
      return null;
    } finally {
      setResultLoading(false);
    }
  };

  // Handle exam selection
  const handleExamChange = async (hallTicketId) => {
    const selected = hallTickets.find((ht) => ht.id === hallTicketId);
    setSelectedHallTicket(selected);
    if (selected) {
      await fetchResult(selected);
    }
  };

  // Calculate total marks
  const calculateTotal = (resultData) => {
    if (!resultData?.result || !Array.isArray(resultData.result)) return 0;
    return resultData.result.reduce(
      (sum, sub) => sum + (parseFloat(sub.marks) || 0),
      0,
    );
  };

  const hasSecuredAPlus = (resultData) => {
    if (!resultData?.result || !Array.isArray(resultData.result)) return false;
    if (resultData.result.length === 0) return false;

    return resultData.result.every((sub) => {
      const grade = String(sub?.grade || "")
        .trim()
        .toUpperCase();
      return grade === "A+";
    });
  };

  const getResultStatus = (resultData) => {
    if (!resultData?.result)
      return {
        status: "N/A",
        color: "gray",
        isFirstClass: false,
        isAllAPlus: false,
      };

    let isPassed = true;
    resultData.result.forEach((sub) => {
      const subjectEntry = resultData.examDetails?.timetableEntries?.find(
        (te) => te.subject === sub.subject || te.title === sub.subject,
      );
      const passMark = subjectEntry?.passMark || sub.passMark || 30;
      if (Number(sub.marks) < Number(passMark)) {
        isPassed = false;
      }
    });

    const totalObtained = calculateTotal(resultData);
    const totalPossible = (resultData.result?.length || 0) * 100;
    const isFirstClass =
      isPassed && totalPossible > 0 && totalObtained >= totalPossible * 0.9;

    return {
      status: isPassed ? "PASS" : "FAIL",
      color: isPassed ? "green" : "red",
      isFirstClass,
      isAllAPlus: hasSecuredAPlus(resultData),
    };
  };

  // Print function
  const handlePrint = () => {
    if (!viewingResult && !result) return;
    const targetResult = viewingResult || result;
    const originalTitle = document.title;
    const studentInfo =
      `${targetResult.studentName}_${targetResult.hallTicketNumber}`.replace(
        /[^a-z0-9]/gi,
        "_",
      );
    document.title = `Result_${studentInfo}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin none-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your exams...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-800 none-xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden print:hidden">
          {/* Subtle background pattern */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 none-full -mr-20 -mt-20 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 none-full -ml-20 -mb-20 blur-3xl" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h1 className="text-2xl sm:text-3xl font-black flex items-center justify-center md:justify-start gap-3">
                <Award className="h-8 w-8 text-teal-300" />
                MY EXAMINATION RESULTS
              </h1>
              <p className="text-teal-100 mt-2 font-medium">
                Official marksheet and performance overview
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-md none-2xl p-4 sm:p-6 border border-white/20 text-center min-w-[140px]">
              <div className="text-3xl sm:text-4xl font-black text-white">
                {hallTickets.length}
              </div>
              <div className="text-[10px] sm:text-xs text-teal-200 font-bold uppercase tracking-widest mt-1">
                Total Exams
              </div>
            </div>
          </div>
        </div>

        {/* Exam Selection */}
        {hallTickets.length > 0 ? (
          <Card className="border-gray-200 shadow-sm print:hidden">
            <CardHeader>
              <CardTitle className="text-lg">Select Examination</CardTitle>
              <CardDescription>
                Choose an exam to view your results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SearchableSelect
                value={selectedHallTicket?.id}
                onValueChange={handleExamChange}
                options={hallTickets}
                placeholder="Search registered exams..."
                getOptionLabel={(ht) =>
                  `${ht.examTitle} (${ht.hallTicketNumber})`
                }
                getOptionValue={(ht) => ht.id}
                triggerClassName="h-12 border-gray-200 focus:ring-teal-500"
                getOptionSearchText={(ht) =>
                  `${ht.examTitle} ${ht.hallTicketNumber}`.toLowerCase()
                }
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="print:hidden">
            <CardContent className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Exams Found
              </h3>
              <p className="text-gray-600">
                You havent registered for any exams yet. Exams will appear here
                once you register.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error Alert */}
        {error && (
          <Alert className="border-amber-200 bg-amber-50 print:hidden">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Result Display */}
        {selectedHallTicket && !resultLoading && result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <style
              dangerouslySetInnerHTML={{
                __html: `
                @media print {
                  @page { size: A4; margin: 0; }
                  html, body { 
                    height: auto !important; 
                    overflow: visible !important; 
                    margin: 0 !important; 
                    padding: 0 !important;
                    background: white !important;
                  }
                  #root, .min-h-screen {
                    min-height: auto !important;
                    height: auto !important;
                    display: block !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                  /* Hide Navigation/Sidebar Elements only */
                  nav, aside, .sticky, .fixed,
                  header, footer, 
                  .print-hidden, .no-print, [data-sonner-toaster], .print\\:hidden,
                  #sidebar-overlay, #mobile-menu-button { 
                    display: none !important; 
                    width: 0 !important;
                    height: 0 !important;
                  }
                  /* Ensure the content wrapper is visible but takes full width */
                  .lg\\:pl-64 { 
                    padding-left: 0 !important; 
                    margin-left: 0 !important; 
                    display: block !important;
                    width: 100% !important;
                  }
                  div { box-shadow: none !important; }
                  main { 
                    padding: 10mm !important; 
                    margin: 0 !important; 
                    display: block !important;
                    width: 100% !important;
                    max-width: 100% !important;
                  }
                  .print-only { display: block !important; }
                  .print-card { 
                    box-shadow: none !important;
                    border: 2px solid #0d9488 !important;
                    border-radius: 0 !important;
                    width: 100% !important;
                    margin: 0 auto !important;
                    padding: 0 !important;
                    page-break-inside: avoid !important;
                  }
                  .print-watermark {
                    position: absolute !important;
                    top: 50% !important;
                    left: 50% !important;
                    transform: translate(-50%, -50%) rotate(-45deg) !important;
                    font-size: 150px !important;
                    font-weight: 900 !important;
                    color: rgba(13, 148, 136, 0.05) !important;
                    z-index: 0 !important;
                    display: block !important;
                    white-space: nowrap !important;
                    pointer-events: none !important;
                  }
                  .print-header-banner {
                    background-color: #0d9488 !important;
                    color: white !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    padding: 15px !important;
                  }
                  .print-bg-gray {
                    background-color: #f3f4f6 !important;
                    -webkit-print-color-adjust: exact;
                    padding: 10px !important;
                  }
                  table { page-break-inside: avoid; position: relative !important; z-index: 10 !important; }
                  .print-header-banner { position: relative !important; z-index: 10 !important; }
                }
                .print-only { display: none; }
                .print-watermark { display: none; }
              `,
              }}
            />

            {/* Print Header */}
            <div className="print-only mb-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <img src="/htleft.jpg" alt="" className="w-20 h-20" />
                <div className="flex-1 text-center">
                  <div className="mb-2">
                    <img
                      src="/htup.png"
                      alt=""
                      className="w-full max-h-12 object-contain mx-auto"
                    />
                  </div>
                  <h1 className="text-xl font-black text-black leading-tight uppercase tracking-tighter">
                    Dakshina Kerala Islam Matha Vidyabhyasa Board
                  </h1>
                  <p className="text-[11px] font-bold text-gray-800 mt-1">
                    ദക്ഷിണ കേരള ഇസ്ലാം മത വിദ്യാഭ്യാസ ബോർഡ്
                  </p>
                  <div className="mt-2 border-y-2 border-teal-600 py-1 uppercase">
                    <p className="text-[10px] font-black text-teal-700 tracking-widest">
                      {result.examDetails?.title ||
                        selectedHallTicket.examTitle}
                    </p>
                    <h2 className="text-base font-black mt-0.5 text-teal-800">
                      RESULT CARD / MARK SHEET
                    </h2>
                  </div>
                </div>
                <img src="/htright.jpg" alt="" className="w-20 h-20" />
              </div>
            </div>

            <Card className="shadow-2xl border-0 overflow-hidden print:border-2 print:border-teal-600 print-card relative">
              <div className="print-watermark">DKJU</div>
              <div className="bg-teal-700 p-8 text-white text-center sm:text-left sm:flex sm:items-center sm:justify-between print-header-banner">
                <div>
                  <h2 className="text-2xl font-black mb-1 uppercase tracking-tighter print:text-xl">
                    {result.studentName}
                  </h2>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-teal-50 font-bold text-xs uppercase tracking-widest print:text-white">
                    {result.admissionNumber && (
                      <span className="flex items-center gap-1.5">
                        Adm No: {result.admissionNumber}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      Class: {result.class}
                    </span>
                    <span className="flex items-center gap-1.5">
                      Reg No: {result.hallTicketNumber}
                    </span>
                  </div>
                </div>
                <div className="mt-6 sm:mt-0 flex gap-3 justify-center print:hidden">
                  <Button
                    onClick={() => setViewingResult(result)}
                    className="bg-white/10 hover:bg-white/20 text-white border-0 font-bold h-10 px-4"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Marks
                  </Button>
                  <Button
                    variant="secondary"
                    className="bg-white text-teal-700 hover:bg-teal-50 font-bold h-10 px-4"
                    onClick={handlePrint}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Result
                  </Button>
                </div>
              </div>

              <CardContent className="p-0">
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 border-b print:p-4 print:gap-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block font-black">
                        Institution Details
                      </Label>
                      <p className="text-lg font-black text-gray-900 leading-tight uppercase print:text-base">
                        {result.madarsaName}
                      </p>
                      <p className="text-xs font-bold text-gray-600">
                        ID: {result.mid}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4 md:text-right">
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block font-black">
                        Exam & Center
                      </Label>
                      <p className="text-lg font-black text-teal-700 uppercase print:text-base leading-tight">
                        {result.examDetails?.title ||
                          selectedHallTicket.examTitle}
                      </p>
                      <p className="text-[10px] font-bold text-gray-900 uppercase mt-1">
                        Center: {result.zone}{" "}
                        {result.place && ` - ${result.place}`}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 mt-1">
                        Date: {new Date().toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b print:bg-gray-100">
                        <th className="px-4 sm:px-8 py-4 text-left font-black text-gray-900 uppercase text-[10px] tracking-widest border-r">
                          Subject
                        </th>
                        <th className="px-2 sm:px-4 py-4 text-center font-black text-gray-900 uppercase text-[10px] tracking-widest border-r">
                          Max
                        </th>
                        <th className="px-2 sm:px-4 py-4 text-center font-black text-gray-900 uppercase text-[10px] tracking-widest border-r">
                          Min
                        </th>
                        <th className="px-4 sm:px-6 py-4 text-center font-black text-gray-900 uppercase text-[10px] tracking-widest border-r">
                          Obtained
                        </th>
                        <th className="px-4 sm:px-6 py-4 text-center font-black text-gray-900 uppercase text-[10px] tracking-widest border-r">
                          Grade
                        </th>
                        <th className="px-2 sm:px-4 py-4 text-center font-black text-gray-900 uppercase text-[10px] tracking-widest">
                          Result
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-b text-sm sm:text-base">
                      {result.result?.map((sub, idx) => {
                        const subjectEntry =
                          result.examDetails?.timetableEntries?.find(
                            (te) =>
                              te.subject === sub.subject ||
                              te.title === sub.subject,
                          );
                        const passMark = subjectEntry?.passMark || 30;
                        const isPass =
                          Number(sub.marks) >= Number(passMark) &&
                          !["F", "E", "AB", "Absent", "NA", "-1"].includes(
                            sub.grade?.toString().trim(),
                          );

                        return (
                          <tr key={idx} className="print:leading-tight">
                            <td className="px-4 sm:px-8 py-4 font-black text-gray-900 uppercase text-[10px] sm:text-xs border-r">
                              {sub.subject}
                            </td>
                            <td className="px-2 sm:px-4 py-4 text-center text-gray-500 font-bold border-r text-[10px] sm:text-xs">
                              100
                            </td>
                            <td className="px-2 sm:px-4 py-4 text-center text-gray-500 font-bold border-r text-[10px] sm:text-xs">
                              {passMark}
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-center text-base sm:text-lg font-black text-black border-r">
                              {sub.marks}
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-center border-r align-middle">
                              <div className="flex justify-center items-center">
                                <span
                                  className={`px-4 py-1.5 rounded-full text-sm font-bold border ${
                                    isPass
                                      ? "bg-teal-50 text-teal-700 border-teal-100"
                                      : "bg-red-50 text-red-700 border-red-100"
                                  }`}
                                >
                                  {sub.grade?.toString().trim() || "-"}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 sm:px-4 py-4 text-center">
                              <span
                                className={`text-[8px] sm:text-[10px] font-black uppercase px-2 py-1 none-sm border border-black text-black`}
                              >
                                {isPass ? "PASS" : "FAIL"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-6 bg-gray-50 flex flex-col sm:flex-row justify-between items-center sm:items-end gap-4 print:p-4 print:bg-white border-b-2 border-black">
                  <div className="space-y-1 text-center sm:text-left">
                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Total Marks Obtained
                    </Label>
                    <p className="text-2xl sm:text-3xl font-black text-black leading-none">
                      {calculateTotal(result)}{" "}
                      <span className="text-xs sm:text-sm text-gray-400">
                        / {(result.result?.length || 0) * 100}
                      </span>
                    </p>
                  </div>
                  <div className="space-y-1 text-center sm:text-right">
                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Overall Result
                    </Label>
                    <p
                      className={`text-2xl sm:text-3xl font-black leading-none text-black`}
                    >
                      {getResultStatus(result).status}
                    </p>
                    {getResultStatus(result).isFirstClass && (
                      <Badge className="bg-yellow-500 text-white font-black px-3 py-1 mt-2 uppercase tracking-tighter animate-pulse">
                        ⭐ FIRST CLASS
                      </Badge>
                    )}
                    {getResultStatus(result).isAllAPlus && (
                      <Badge className="bg-amber-100 text-amber-800 font-black px-3 py-1 mt-2 uppercase tracking-tighter border border-amber-200">
                        A+
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading State */}
        {resultLoading && (
          <Card>
            <CardContent className="text-center py-12">
              <div className="animate-spin none-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading result...</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detailed View Modal */}
      {viewingResult && selectedHallTicket && (
        <Dialog open={true} onOpenChange={() => setViewingResult(null)}>
          <DialogContent className="max-w-4xl bg-white border-none shadow-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between pr-8 sm:pr-10">
                <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen className="h-6 w-6 text-teal-600" />
                  Detailed Result Sheet
                </DialogTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="print:hidden"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Student Info */}
              <div className="bg-teal-50/50 border border-teal-100 none-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Student Name</p>
                    <p className="font-bold text-gray-900 text-lg">
                      {viewingResult.studentName || selectedHallTicket.fullName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      Hall Ticket Number
                    </p>
                    <p className="font-bold text-gray-900 font-mono">
                      {viewingResult.hallTicketNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Class</p>
                    <p className="font-semibold text-gray-900">
                      Class {viewingResult.class}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Madarsa</p>
                    <p className="font-semibold text-gray-900">
                      {viewingResult.madarsaName || selectedHallTicket.madarsa}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subject-wise Results */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-gray-500" />
                  Subject-wise Performance
                </h3>
                <div className="border border-gray-200 none-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="font-bold">Subject</TableHead>
                        <TableHead className="text-center font-bold">
                          Max Marks
                        </TableHead>
                        <TableHead className="text-center font-bold">
                          Pass Marks
                        </TableHead>
                        <TableHead className="text-center font-bold">
                          Obtained
                        </TableHead>
                        <TableHead className="text-center font-bold">
                          Grade
                        </TableHead>
                        <TableHead className="text-center font-bold">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingResult.result?.map((sub, idx) => {
                        const subjectEntry =
                          viewingResult.examDetails?.timetableEntries?.find(
                            (te) =>
                              te.subject === sub.subject ||
                              te.title === sub.subject,
                          );
                        const passMark = subjectEntry?.passMark || 30;
                        const isPassed = Number(sub.marks) >= Number(passMark);

                        return (
                          <TableRow
                            key={idx}
                            className={!isPassed ? "bg-red-50/30" : ""}
                          >
                            <TableCell className="font-bold text-xs uppercase">
                              {sub.subject}
                            </TableCell>
                            <TableCell className="text-center font-bold text-gray-500 text-xs">
                              100
                            </TableCell>
                            <TableCell className="text-center text-gray-400 text-xs">
                              {passMark}
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`font-black text-lg ${!isPassed ? "text-red-600" : "text-teal-600"}`}
                              >
                                {sub.marks}
                              </span>
                            </TableCell>
                            <TableCell className="text-center align-middle">
                              <div className="flex justify-center items-center w-full">
                                <Badge
                                  className={`${
                                    isPassed
                                      ? "bg-teal-50 text-teal-700 border-teal-100"
                                      : "bg-red-50 text-red-700 border-red-100"
                                  } font-bold text-xs px-4 py-1 rounded-full border justify-center flex`}
                                  variant="outline"
                                >
                                  {sub.grade?.toString().trim() || "-"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-1 none-sm border ${isPassed ? "border-green-600 text-green-600" : "border-red-600 text-red-600"}`}
                              >
                                {isPassed ? "PASS" : "FAIL"}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-gray-50/80 font-black">
                        <TableCell
                          colSpan={3}
                          className="text-gray-500 uppercase tracking-widest text-[10px]"
                        >
                          Cumulative Performance
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="text-2xl font-black text-teal-700 leading-none">
                            {calculateTotal(viewingResult)}
                          </div>
                          <div className="text-[10px] text-gray-400 uppercase mt-1">
                            Total Marks
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={`${getResultStatus(viewingResult).status === "PASS" ? "bg-green-600" : "bg-red-600"} text-white font-black px-4 py-1.5 uppercase tracking-tighter`}
                          >
                            {getResultStatus(viewingResult).status}
                          </Badge>
                          {getResultStatus(viewingResult).isFirstClass && (
                            <div className="mt-2">
                              <Badge className="bg-yellow-500 text-white font-black px-4 py-1.5 uppercase tracking-tighter">
                                ⭐ FIRST CLASS
                              </Badge>
                            </div>
                          )}
                          {getResultStatus(viewingResult).isAllAPlus && (
                            <div className="mt-2">
                              <Badge className="bg-amber-100 text-amber-800 font-black px-4 py-1.5 uppercase tracking-tighter border border-amber-200">
                                A+
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
