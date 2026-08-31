"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/authUtils";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, AlertCircle, Download, FileText, ExternalLink } from "lucide-react";
import {
  getDocuments,
  COLLECTIONS,
} from "@/lib/firestoreService";
import { orderBy } from "firebase/firestore";
import useAuthStore from "@/lib/authStore";
import Image from "next/image";

const formatDate = (dateValue) => {
  if (!dateValue) return "Not available";
  if (dateValue?.toDate) return dateValue.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function MadarsaExamTimetablesPage() {
  const { user } = useAuth();
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timetables, setTimetables] = useState([]);

  const fetchTimetables = useCallback(async () => {
    try {
      // Fetch exams instead of exam_timetables
      const constraints = [orderBy("createdAt", "desc")];
      const exams = await getDocuments(COLLECTIONS.EXAMS, constraints);
      
      // Filter exams that have timetable information
      const examsWithTimetables = exams.filter(exam => 
        exam.generatedTimetableImage || 
        exam.uploadedTimetableImage || 
        (exam.timetableEntries && exam.timetableEntries.length > 0)
      );
      
      setTimetables(examsWithTimetables);
    } catch (error) {
      console.error("Error fetching timetables:", error);
      setError("Failed to load timetables");
    }
  }, []);

  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);
        await fetchTimetables();
      } catch (error) {
        console.error("Error initializing data:", error);
        setError("Failed to load timetables");
      } finally {
        setLoading(false);
      }
    };

    if (user || userData) {
      initializeData();
    }
  }, [user, userData, fetchTimetables]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Exam Timetables</h1>
          <p className="text-purple-100">Download and view exam schedules</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {timetables.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium">No timetables available</p>
            </div>
          ) : (
            timetables.map((exam) => (
              <Card key={exam.id} className="hover:shadow-lg transition-all duration-300 flex flex-col h-full">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="mb-2">{exam.class || "General"}</Badge>
                    <span className="text-xs text-gray-500">{formatDate(exam.createdAt)}</span>
                  </div>
                  <CardTitle className="text-xl">{exam.title}</CardTitle>
                  <CardDescription>{exam.timetableDescription || "Exam Schedule"}</CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1">
                  {/* Preview Image if available */}
                  {(exam.generatedTimetableImage || exam.uploadedTimetableImage) && (
                    <div className="relative h-48 w-full mb-4 rounded-lg overflow-hidden border bg-gray-100 group cursor-pointer"
                         onClick={() => window.open(exam.generatedTimetableImage || exam.uploadedTimetableImage, '_blank')}>
                      <Image
                        src={exam.generatedTimetableImage || exam.uploadedTimetableImage}
                        alt="Timetable Preview"
                        fill
                        className="object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <ExternalLink className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {exam.generatedTimetableImage && (
                      <Button variant="outline" className="w-full justify-start" onClick={() => window.open(exam.generatedTimetableImage, '_blank')}>
                        <FileText className="h-4 w-4 mr-2 text-blue-500" />
                        View Generated Timetable
                      </Button>
                    )}
                    
                    {exam.uploadedTimetableImage && (
                      <Button variant="outline" className="w-full justify-start" onClick={() => window.open(exam.uploadedTimetableImage, '_blank')}>
                        <Download className="h-4 w-4 mr-2 text-green-500" />
                        Download Uploaded Schedule
                      </Button>
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