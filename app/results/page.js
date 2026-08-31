"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Search,
  GraduationCap,
  BookOpen,
  Award,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Printer,
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { COLLECTIONS } from "@/lib/firestoreService";
import { toast } from "sonner";
import { getSetting } from "@/lib/settingsService";
import { AlertCircle } from "lucide-react";

export default function ResultSearchPage() {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [hallTicketNumber, setHallTicketNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [examsLoading, setExamsLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isServiceAvailable, setIsServiceAvailable] = useState(true);
  const [checkingService, setCheckingService] = useState(true);
  const [resultWindow, setResultWindow] = useState(15);

  // Check service availability
  useEffect(() => {
    const checkAvailability = async () => {
      const available = await getSetting("showResults", true);
      const windowDays = await getSetting("resultWindow", 15);
      setIsServiceAvailable(available);
      setResultWindow(windowDays);
      setCheckingService(false);
    };
    checkAvailability();
  }, []);

  // Fetch available exams
  useEffect(() => {
    if (!isServiceAvailable) return;

    const fetchExams = async () => {
      try {
        const examsSnapshot = await getDocs(collection(db, COLLECTIONS.EXAMS));
        const examsList = examsSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((exam) => !!exam.title);

        setExams(
          examsList.sort(
            (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
          ),
        );
      } catch (err) {
        console.error("Error fetching exams:", err);
        toast.error("Failed to load exams");
      } finally {
        setExamsLoading(false);
      }
    };

    if (!checkingService && isServiceAvailable) {
      fetchExams();
    }
  }, [isServiceAvailable, checkingService]);

  if (checkingService) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!isServiceAvailable) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-grow flex h-[90vh] items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="bg-red-100 p-4 none-full w-16 h-16 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Results Page Unavailable
            </h1>
            <p className="text-gray-600">
              The exam results portal is currently closed. Please check back
              later or contact the administration for more information.
            </p>
            <Button
              className="mt-4"
              onClick={() => (window.location.href = "/")}
            >
              Return Home
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!selectedExamId) {
      toast.error("Please select an exam");
      return;
    }
    if (!hallTicketNumber.trim()) {
      toast.error("Please enter your hall ticket number");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Use the deterministic ID format: selectedExamId_hallTicketNumber
      const docId = `${selectedExamId}_${hallTicketNumber.trim()}`;
      const docRef = doc(db, COLLECTIONS.EXAM_RESULTS || "results", docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        let resultData = docSnap.data();

        // FIX: Override corrupted madarsa details by fetching correct data
        try {
          let studentQ = query(
            collection(db, "hallTickets", selectedExamId, "students"),
            where("hallTicketNumber", "==", hallTicketNumber.trim()),
          );
          let studentSnap = await getDocs(studentQ);

          if (studentSnap.empty && !isNaN(hallTicketNumber)) {
            studentQ = query(
              collection(db, "hallTickets", selectedExamId, "students"),
              where("hallTicketNumber", "==", Number(hallTicketNumber.trim())),
            );
            studentSnap = await getDocs(studentQ);
          }

          if (!studentSnap.empty) {
            const studentData = studentSnap.docs[0].data();
            const madarsaId = studentData.madarsaId || studentData.madarsa;

            if (madarsaId) {
              let foundMadarsa = null;

              try {
                const response = await fetch(
                  `/api/public/madarsas?madarsaId=${encodeURIComponent(
                    String(madarsaId),
                  )}`,
                  { cache: "no-store" },
                );
                if (response.ok) {
                  foundMadarsa = await response.json();
                }
              } catch (e) {
                // Ignore public lookup failures and fall back to ticket data.
              }

              if (foundMadarsa) {
                resultData.madarsaName =
                  foundMadarsa.name ||
                  foundMadarsa.madarsaName ||
                  resultData.madarsaName;
                resultData.mid =
                  foundMadarsa.madarsaId ||
                  foundMadarsa.id ||
                  String(madarsaId);
              } else if (studentData.madarsaName || studentData.madarsa) {
                const possibleName =
                  studentData.madarsaName || studentData.madarsa;
                if (typeof possibleName === "string") {
                  resultData.madarsaName = possibleName;
                }
                resultData.mid = studentData.madarsaId || String(madarsaId);
              }
            }
          }
        } catch (error) {
          console.error("Error fetching correct madarsa details:", error);
        }

        if (!resultData.isPublished) {
          setError(
            "No result found for the provided details. Please check and try again.",
          );
          return;
        }

        // Check window (if enabled)
        if (resultWindow > 0) {
          const now = new Date();
          // Check updatedAt first, then uploadedAt
          const dateField = resultData.updatedAt || resultData.uploadedAt;

          if (dateField) {
            const resultDate = dateField.toDate
              ? dateField.toDate()
              : new Date(dateField.seconds * 1000 || 0);

            const diffTime = Math.abs(now - resultDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > resultWindow) {
              setError(
                "The viewing period for this result has expired. Results are only available for " +
                  resultWindow +
                  " days after being published.",
              );
              return;
            }
          }
        }

        setResult(resultData);
      } else {
        setError(
          "No result found for the provided details. Please check and try again.",
        );
      }
    } catch (err) {
      console.error("Error searching result:", err);
      toast.error("Something went wrong. Please try again later.");
      setError("An error occurred while fetching your result.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!result) return;
    const originalTitle = document.title;
    const studentInfo =
      `${result.studentName}_${result.hallTicketNumber}`.replace(
        /[^a-z0-9]/gi,
        "_",
      );
    document.title = `Result_${studentInfo}`;
    window.print();
    // Use a small delay for restoration to ensure print dialog picks up the title
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-12 max-w-4xl">
        <Card className="shadow-xl border-teal-100 mb-8 print:hidden">
          <CardHeader className="bg-gradient-to-r from-teal-700 to-teal-800 text-white none-t-lg">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Student Result Search
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <form
              onSubmit={handleSearch}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end"
            >
              <div className="space-y-2">
                <Label htmlFor="exam">Select Examination</Label>
                <SearchableSelect
                  value={selectedExamId}
                  onValueChange={setSelectedExamId}
                  disabled={examsLoading}
                  options={exams}
                  placeholder={
                    examsLoading ? "Loading exams..." : "Choose Exam"
                  }
                  getOptionLabel={(exam) => exam.title}
                  getOptionValue={(exam) => exam.id}
                  showAllOption={false}
                  triggerClassName="h-12 border-teal-100 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hallTicket">Reg Number / Hall Ticket No</Label>
                <Input
                  id="hallTicket"
                  placeholder="Enter Register Number"
                  value={hallTicketNumber}
                  onChange={(e) => setHallTicketNumber(e.target.value)}
                  className="h-12 border-teal-100 focus:ring-teal-500 uppercase"
                />
              </div>

              <Button
                type="submit"
                className="md:col-span-2 h-12 bg-teal-600 hover:bg-teal-700 text-lg font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-5 w-5" />
                    Check Result
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-8 flex items-center gap-3">
            <AlertTriangle className="text-red-400 h-6 w-6" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                }
                body { 
                  background: white !important; 
                  font-family: sans-serif !important; 
                  padding: 10mm !important;
                }
                .print-hidden, header, footer, .no-print, [data-sonner-toaster] { 
                  display: none !important; 
                  height: 0 !important; 
                  margin: 0 !important; 
                  padding: 0 !important;
                }
                .min-h-screen {
                  min-height: auto !important;
                  height: auto !important;
                  display: block !important;
                }
                main { 
                  padding: 0 !important; 
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
                  page-break-after: avoid !important;
                  position: relative !important;
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
                  pointer-events: none !important;
                  white-space: nowrap !important;
                  display: block !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
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

            {/* Print Header - Matching Hall Ticket Style */}
            <div className="print-only mb-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <img
                  src="/htleft.jpg"
                  alt=""
                  className="w-20 h-20 object-contain shadow-sm"
                />
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
                      {exams.find((e) => e.id === selectedExamId)?.title ||
                        "EXAMINATION"}
                    </p>
                    <h2 className="text-base font-black mt-0.5 text-teal-800">
                      RESULT CARD / MARK SHEET
                    </h2>
                  </div>
                </div>
                <img
                  src="/htright.jpg"
                  alt=""
                  className="w-20 h-20 object-contain shadow-sm"
                />
              </div>
            </div>

            <Card className="shadow-2xl border-0 overflow-hidden print:border-2 print:border-teal-600 print-card relative">
              {/* Print Watermark */}
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
                    variant="secondary"
                    size="sm"
                    className="bg-white/10 hover:bg-white/20 text-white border-0"
                    onClick={handlePrint}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                </div>
              </div>

              <CardContent className="p-0">
                <div className="p-6 grid grid-cols-2 gap-8 border-b print:p-4 print:gap-4">
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
                  <div className="space-y-4 text-right">
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block font-black">
                        Exam & Center
                      </Label>
                      <p className="text-lg font-black text-teal-700 uppercase print:text-base leading-tight">
                        {exams.find((e) => e.id === selectedExamId)?.title}
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
                        <th className="px-8 py-4 text-left font-black text-gray-900 uppercase text-[10px] tracking-widest border-r print:px-4">
                          Subject
                        </th>
                        <th className="px-4 py-4 text-center font-black text-gray-900 uppercase text-[10px] tracking-widest border-r">
                          Max
                        </th>
                        <th className="px-4 py-4 text-center font-black text-gray-900 uppercase text-[10px] tracking-widest border-r">
                          Min
                        </th>
                        <th className="px-6 py-4 text-center font-black text-gray-900 uppercase text-[10px] tracking-widest border-r print:px-2">
                          Obtained
                        </th>
                        <th className="px-4 py-4 text-center font-black text-gray-900 uppercase text-[10px] tracking-widest border-r">
                          Grade
                        </th>
                        <th className="px-4 py-4 text-center font-black text-gray-900 uppercase text-[10px] tracking-widest">
                          Result
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-b">
                      {result.result?.map((sub, idx) => {
                        const currentExam = exams.find(
                          (e) => e.id === selectedExamId,
                        );
                        const subjectEntry =
                          currentExam?.timetableEntries?.find(
                            (te) =>
                              te.subject === sub.subject ||
                              te.title === sub.subject,
                          );
                        const passMark =
                          subjectEntry?.passMark || sub.passMark || 30;
                        const isPass =
                          Number(sub.marks) >= Number(passMark) &&
                          !["F", "E", "AB", "Absent", "NA", "-1"].includes(
                            sub.grade?.toString().trim(),
                          );

                        return (
                          <tr key={idx} className="print:leading-tight">
                            <td className="px-8 py-4 font-black text-gray-900 uppercase text-xs border-r print:px-4">
                              {sub.subject}
                            </td>
                            <td className="px-4 py-4 text-center text-gray-500 font-bold border-r">
                              100
                            </td>
                            <td className="px-4 py-4 text-center text-gray-500 font-bold border-r">
                              {passMark}
                            </td>
                            <td className="px-6 py-4 text-center text-lg font-black text-black border-r">
                              {sub.marks}
                            </td>
                            <td className="px-4 py-4 text-center border-r align-middle">
                              <div className="flex justify-center items-center w-full">
                                <Badge
                                  className={`${
                                    isPass
                                      ? "bg-teal-50 text-teal-700 border-teal-100"
                                      : "bg-red-50 text-red-700 border-red-100"
                                  } font-bold text-xs px-4 py-1.5 rounded-full border justify-center flex`}
                                  variant="outline"
                                >
                                  {sub.grade?.toString().trim() || "-"}
                                </Badge>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-1 rounded-sm border ${
                                  isPass
                                    ? "border-black text-black"
                                    : "border-black text-black"
                                }`}
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

                <div className="p-6 bg-gray-50 flex justify-between items-end print:p-4 print:bg-white border-b-2 border-black">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Total Marks Obtained
                    </Label>
                    <p className="text-3xl font-black text-black leading-none">
                      {result.result?.reduce(
                        (sum, item) => sum + (Number(item.marks) || 0),
                        0,
                      ) || 0}{" "}
                      <span className="text-sm text-gray-400">
                        / {(result.result?.length || 0) * 100}
                      </span>
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Overall Result
                    </Label>
                    <p
                      className={`text-3xl font-black leading-none mb-2 text-black`}
                    >
                      {result.status || "N/A"}
                    </p>
                    {result.status === "PASS" &&
                      (result.result?.reduce(
                        (sum, item) => sum + (Number(item.marks) || 0),
                        0,
                      ) || 0) >=
                        (result.result?.length || 0) * 100 * 0.9 && (
                        <Badge className="mr-2 bg-teal-300">
                          ⭐ FIRST CLASS
                        </Badge>
                      )}
                    {hasSecuredAPlus(result) && (
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
      </main>

      <Footer />
    </div>
  );
}
