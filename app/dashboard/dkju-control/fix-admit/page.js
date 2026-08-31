"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/authUtils";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import fixAdmitForExam, {
  fetchEligibleRegistrations,
  prepareHallTicketData,
  uploadHallTicketForRegistration,
  uploadAllRegistrations,
} from "../fix-admit";
import { getDocuments, COLLECTIONS, getDocument } from "@/lib/firestoreService";
import { generateHallTicketHTML } from "@/lib/hallTicketUtils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "recharts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function FixAdmitPage() {
  const { user, role } = useAuth();
  const [examId, setExamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState([]);
  const [madrasas, setMadrasas] = useState([]);
  const [mekhalas, setMekhalas] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });

  // Fetch exams, madrasas, and mekhalas on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [examsData, madrasasData, mekhalasData] = await Promise.all([
          getDocuments(COLLECTIONS.EXAMS),
          getDocuments(COLLECTIONS.MADRASAS),
          getDocuments(COLLECTIONS.MEKHALAS),
        ]);
        setExams(examsData);
        setMadrasas(madrasasData);
        setMekhalas(mekhalasData);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
      }
    };
    fetchData();
  }, []);

  const handleFixAdmit = async () => {
    if (!examId.trim()) {
      toast.error("Please enter an exam ID");
      return;
    }

    setLoading(true);
    try {
      await fixAdmitForExam(examId.trim(), madrasas, mekhalas);
      toast.success(
        "Hall tickets generated successfully for all eligible registrations",
      );
    } catch (error) {
      console.error("Error fixing admit:", error);
      toast.error(`Failed to generate hall tickets: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadRegistrations = async () => {
    if (!examId.trim()) {
      toast.error("Please enter an exam ID");
      return;
    }

    setLoadingRegistrations(true);
    try {
      const regs = await fetchEligibleRegistrations(examId.trim());

      // populate student data for display
      const regsWithStudent = await Promise.all(
        regs.map(async (r) => {
          try {
            const student = await getDocument(
              COLLECTIONS.STUDENTS,
              r.studentId,
            );
            return { ...r, student };
          } catch (err) {
            return { ...r, student: null };
          }
        }),
      );

      setRegistrations(regsWithStudent);
      toast.success(
        `Loaded ${regsWithStudent.length} eligible registration(s)`,
      );
    } catch (error) {
      console.error("Error loading registrations:", error);
      toast.error("Failed to load registrations");
    } finally {
      setLoadingRegistrations(false);
    }
  };

  const handleDownload = async (registration) => {
    try {
      const examObj =
        exams.find((e) => e.id === examId) ||
        (await getDocument(COLLECTIONS.EXAMS, examId));
      const student =
        registration.student ||
        (await getDocument(COLLECTIONS.STUDENTS, registration.studentId));
      const data = await prepareHallTicketData(
        student,
        registration,
        examObj,
        madrasas,
        mekhalas,
      );

      const { jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;
      const doc = new jsPDF("p", "mm", "a4");

      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.width = "210mm";
      container.style.backgroundColor = "white";
      container.style.padding = "10mm";
      container.innerHTML = generateHallTicketHTML(data);
      document.body.appendChild(container);

      const images = container.querySelectorAll("img");
      await Promise.all(
        Array.from(images).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }),
      );

      const canvas = await html2canvas(container, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
      });
      document.body.removeChild(container);
      const imgData = canvas.toDataURL("image/jpeg", 0.5);
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();
      doc.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      const fileName = `hall_ticket_${data.admissionNumber || registration.id}.pdf`;
      doc.save(fileName);
      toast.success("Downloaded hall ticket");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download hall ticket");
    }
  };

  const handleUpload = async (registration) => {
    try {
      const examObj =
        exams.find((e) => e.id === examId) ||
        (await getDocument(COLLECTIONS.EXAMS, examId));
      const url = await uploadHallTicketForRegistration(
        registration,
        examObj,
        madrasas,
        mekhalas,
      );
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === registration.id ? { ...r, hallTicketUrl: url } : r,
        ),
      );
      toast.success(
        `Hall ticket uploaded for ${registration.student?.fullName || registration.id}`,
      );
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload hall ticket");
    }
  };

  const handleBulkUpload = async () => {
    if (!examId.trim()) return toast.error("Please enter exam ID");
    setUploadProgress({ current: 0, total: 0 });
    try {
      const exam =
        exams.find((e) => e.id === examId) ||
        (await getDocument(COLLECTIONS.EXAMS, examId));
      const regs = await fetchEligibleRegistrations(examId.trim());
      const pendingRegs = regs.filter((r) => !r.hallTicketUrl);
      setUploadProgress({ current: 0, total: pendingRegs.length });
      for (let i = 0; i < pendingRegs.length; i++) {
        const reg = pendingRegs[i];
        try {
          const url = await uploadHallTicketForRegistration(
            reg,
            exam,
            madrasas,
            mekhalas,
          );
          setRegistrations((prev) =>
            prev.map((r) =>
              r.id === reg.id ? { ...r, hallTicketUrl: url } : r,
            ),
          );
          setUploadProgress({ current: i + 1, total: pendingRegs.length });
        } catch (err) {
          console.error(`Failed uploading registration ${reg.id}:`, err);
          // continue with next
        }
      }
      toast.success("Bulk upload finished");
    } catch (error) {
      console.error("Bulk upload error:", error);
      toast.error("Bulk upload failed");
    }
  };

  //   if (role !== "admin") {
  //     return (
  //       <Layout>
  //         <div className="container mx-auto p-6">
  //           <Alert>
  //             <AlertDescription>
  //               You don't have permission to access this page.
  //             </AlertDescription>
  //           </Alert>
  //         </div>
  //       </Layout>
  //     );
  //   }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Fix Admit - Generate Hall Tickets</CardTitle>
            <CardDescription>
              Generate hall tickets for all registrations with payment status
              &apos;completed&apos; or &apos;waived&apos; for a specific exam.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="examId">Exam ID</Label>
              <Input
                id="examId"
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                placeholder="Enter exam ID"
                disabled={loading}
              />
            </div>

            <div>
              <Label>Available Exams</Label>
              <div className="max-h-40 overflow-y-auto border rounded p-2 mt-1">
                {exams.map((exam) => (
                  <div
                    key={exam.id}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => setExamId(exam.id)}
                  >
                    <div className="font-medium">{exam.title}</div>
                    <div className="text-sm text-gray-600">ID: {exam.id}</div>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleFixAdmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Hall Tickets
            </Button>

            <Alert>
              <AlertDescription>
                This will:
                <ul className="list-disc list-inside mt-2">
                  <li>
                    Fetch all registrations for the exam with payment status
                    &apos;completed&apos; or &apos;waived&apos;
                  </li>
                  <li>Generate hall ticket data for each registration</li>
                  <li>
                    Generate and upload hall ticket PDF to Firebase Storage
                    under exams/hallticket/{examId}
                  </li>
                  <li>
                    Save hall ticket data inside each registration&apos;s{" "}
                    <strong>hallTicket</strong> field and PDF URL in{" "}
                    <strong>hallTicketUrl</strong>
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Registrations (eligible)</CardTitle>
            <CardDescription>
              Load, preview (download) and upload hall tickets per registration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Button
                onClick={handleLoadRegistrations}
                disabled={loadingRegistrations}
              >
                {loadingRegistrations ? "Loading..." : "Load Registrations"}
              </Button>
              <Button
                onClick={handleBulkUpload}
                disabled={
                  uploadProgress.current > 0 &&
                  uploadProgress.current < uploadProgress.total
                }
              >
                {uploadProgress.total
                  ? `Uploading ${uploadProgress.current}/${uploadProgress.total}`
                  : "Bulk Upload All"}
              </Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {registrations.length === 0 && (
                <div className="text-sm text-gray-600">
                  No registrations loaded.
                </div>
              )}
              {registrations.length > 0 && (
                <>
                  <div className="text-sm text-gray-700 mb-2">
                    Total: {registrations.length} | Uploaded:{" "}
                    {registrations.filter((r) => r.hallTicketUrl).length} |
                    Pending:{" "}
                    {registrations.filter((r) => !r.hallTicketUrl).length}
                  </div>
                  <Tabs defaultValue="pending" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="pending">
                        Pending Upload (
                        {registrations.filter((r) => !r.hallTicketUrl).length})
                      </TabsTrigger>
                      <TabsTrigger value="uploaded">
                        Uploaded (
                        {registrations.filter((r) => r.hallTicketUrl).length})
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="pending" className="space-y-2">
                      {registrations
                        .filter((r) => !r.hallTicketUrl)
                        .map((reg) => (
                          <div
                            key={reg.id}
                            className="p-3 border rounded flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium">
                                {reg.student?.fullName || reg.studentId}
                              </div>
                              <div className="text-sm text-gray-600">
                                Reg ID: {reg.id} • Payment: {reg.paymentStatus}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleDownload(reg)}
                              >
                                Download
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleUpload(reg)}
                              >
                                Upload
                              </Button>
                            </div>
                          </div>
                        ))}
                      {registrations.filter((r) => !r.hallTicketUrl).length ===
                        0 && (
                        <div className="text-sm text-gray-600">
                          No pending registrations.
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="uploaded" className="space-y-2">
                      {registrations
                        .filter((r) => r.hallTicketUrl)
                        .map((reg) => (
                          <div
                            key={reg.id}
                            className="p-3 border rounded flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium">
                                {reg.student?.fullName || reg.studentId}
                              </div>
                              <div className="text-sm text-gray-600">
                                Reg ID: {reg.id} • Payment: {reg.paymentStatus}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleDownload(reg)}
                              >
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpload(reg)}
                              >
                                Re-upload
                              </Button>
                              <Button
                                size="sm"
                                onClick={() =>
                                  window.open(reg.hallTicketUrl, "_blank")
                                }
                              >
                                Open Hall Ticket
                              </Button>
                            </div>
                          </div>
                        ))}
                      {registrations.filter((r) => r.hallTicketUrl).length ===
                        0 && (
                        <div className="text-sm text-gray-600">
                          No uploaded registrations.
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
