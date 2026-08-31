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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, AlertCircle, Download } from "lucide-react";
import { getDocuments, COLLECTIONS } from "@/lib/firestoreService";
import { orderBy } from "firebase/firestore";
import useAuthStore from "@/lib/authStore";
import Image from "next/image";
import { formatDate } from "@/lib/dateUtils";

export default function StudentExamTimetablesPage() {
  const { user } = useAuth();
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data States
  const [examTimetables, setExamTimetables] = useState([]);

  const handleDownload = async (e, url, title) => {
    e.stopPropagation();
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${title.replace(/\s+/g, "_")}_timetable.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      window.open(url, "_blank");
    }
  };

  // Fetch exam timetables
  const fetchExamTimetables = useCallback(async () => {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      // Fetch from EXAMS collection as timetables are now part of exam documents
      const fetchedExams = await getDocuments(COLLECTIONS.EXAMS, constraints);


      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const examsWithTimetables = fetchedExams.filter((exam) => {
        const hasTimetable =
          exam.generatedTimetableImage ||
          exam.uploadedTimetableImage ||
          (exam.timetableEntries && exam.timetableEntries.length > 0);

        if (!hasTimetable) return false;

        const studentClass = userData.classLevel || userData.class || userData.grade || user?.classLevel || user?.class;
        
        if (String(studentClass) !== String(exam.class)) {
          return false;
        }

        // Check if exam date is today or in the future
        if (!exam.examDate) return false;

        let examDateObj;
        try {
          if (typeof exam.examDate.toDate === "function") {
            examDateObj = exam.examDate.toDate();
          } else {
            examDateObj = new Date(exam.examDate);
          }

          // Reset time part for accurate date comparison
          examDateObj.setHours(0, 0, 0, 0);

          return examDateObj >= today;
        } catch (err) {
          console.warn("Invalid date for exam:", exam.id, err);
          return false;
        }
      });

      setExamTimetables(examsWithTimetables);
    } catch (error) {
      console.error("Error fetching exam timetables:", error);
      setError("Failed to load exam timetables");
    }
  }, []);

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);
        await fetchExamTimetables();
      } catch (error) {
        console.error("Error initializing data:", error);
        setError("Failed to load exam timetables");
      } finally {
        setLoading(false);
      }
    };

    if (user || userData) {
      initializeData();
    }
  }, [user, userData, fetchExamTimetables]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading exam timetables...</p>
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
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Exam Timetables
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">
              View exam schedules and timetables
            </p>
          </div>
        </div>

        {/* Timetables List */}
        <div className="grid gap-4">
          {examTimetables.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium mb-2">
                  No timetables available
                </p>
                <p className="text-gray-400">
                  Check back later for exam schedules
                </p>
              </CardContent>
            </Card>
          ) : (
            examTimetables.map((exam) => (
              <Card key={exam.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                    <div>
                      <CardTitle className="text-lg md:text-xl mb-1 md:mb-2 text-wrap break-words">
                        {exam.title}
                      </CardTitle>
                      {exam.description && (
                        <CardDescription className="text-sm">
                          {exam.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant="outline" className="w-fit shrink-0">
                      {exam.class ? `Class ${exam.class}` : "All Classes"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Exam Details */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Exam Date: {formatDate(exam.examDate)}</span>
                      </div>
                      {exam.createdByName && (
                        <>
                          <span className="hidden sm:inline text-gray-400">
                            |
                          </span>
                          <span className="text-gray-500 text-xs sm:text-sm">
                            Published by: {exam.createdByName}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Timetable Images/Files */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {/* Generated Timetable */}
                      {exam.generatedTimetableImage && (
                        <div
                          className="group relative aspect-[4/3] rounded-lg border bg-gray-50 overflow-hidden cursor-pointer"
                          onClick={(e) =>
                            handleDownload(
                              e,
                              exam.generatedTimetableImage,
                              exam.title
                            )
                          }
                        >
                          <Image
                            src={exam.generatedTimetableImage}
                            alt="Generated Timetable"
                            fill
                            className="object-contain p-2 transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 bg-white/90 px-3 py-1 rounded-full text-sm font-medium shadow-sm transition-opacity flex items-center gap-2">
                              <Download className="h-4 w-4" />
                              Download PNG
                            </span>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-white/90 p-2 text-xs text-center font-medium border-t">
                            Official Timetable
                          </div>
                        </div>
                      )}

                      {/* Uploaded Timetable */}
                      {exam.uploadedTimetableImage && (
                        <div
                          className="group relative aspect-[4/3] rounded-lg border bg-gray-50 overflow-hidden cursor-pointer"
                          onClick={() =>
                            window.open(exam.uploadedTimetableImage, "_blank")
                          }
                        >
                          {exam.uploadedTimetableFileType ===
                          "application/pdf" ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                              <svg
                                className="h-12 w-12 mb-2"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                />
                              </svg>
                              <span className="font-medium">
                                View PDF Timetable
                              </span>
                            </div>
                          ) : (
                            <Image
                              src={exam.uploadedTimetableImage}
                              alt="Uploaded Timetable"
                              fill
                              className="object-contain p-2 transition-transform group-hover:scale-105"
                            />
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-white/90 p-2 text-xs text-center font-medium border-t">
                            Uploaded Schedule
                          </div>
                        </div>
                      )}

                      {/* Timetable Entries */}
                      {/* {exam.timetableEntries?.map((entry, index) => (
                        <div 
                          key={index}
                          className="group relative aspect-[4/3] rounded-lg border bg-gray-50 overflow-hidden cursor-pointer"
                          onClick={() => window.open(entry.timetableImage, '_blank')}
                        >
                          {entry.timetableFileType === 'application/pdf' ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                              <svg className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              <span className="font-medium">View PDF</span>
                            </div>
                          ) : (
                            <Image
                              src={entry.timetableImage}
                              alt={entry.timetableTitle || `Timetable ${index + 1}`}
                              fill
                              className="object-contain p-2 transition-transform group-hover:scale-105"
                            />
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-white/90 p-2 text-xs text-center font-medium border-t">
                            {entry.timetableTitle || entry.subject || `Schedule ${index + 1}`}
                            {entry.date && <span className="block text-[10px] text-gray-500">{formatDate(entry.date)}</span>}
                          </div>
                        </div>
                      ))} */}
                    </div>

                    {exam.timetableDescription && (
                      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                        <p className="font-medium mb-1">Note:</p>
                        <p>{exam.timetableDescription}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
