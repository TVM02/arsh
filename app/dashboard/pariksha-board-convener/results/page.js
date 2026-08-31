"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  FileText,
  Eye,
  Upload,
  Calendar,
  Search,
  BookOpen,
  ArrowRight,
  TrendingUp,
  History,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  collection,
  query,
  orderBy,
  getDocs,
  where,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestoreService";
import { toast } from "sonner";

export default function ExamResultsOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [examStats, setExamStats] = useState({});

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const examsQuery = query(
          collection(db, COLLECTIONS.EXAMS),
          orderBy("createdAt", "desc"),
        );
        const snapshot = await getDocs(examsQuery);
        const examsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setExams(examsData);

        // Fetch result counts for each exam
        const stats = {};
        await Promise.all(
          examsData.map(async (exam) => {
            const countQuery = query(
              collection(db, COLLECTIONS.EXAM_RESULTS || "results"),
              where("examID", "==", exam.id),
            );
            const countSnap = await getCountFromServer(countQuery);
            stats[exam.id] = countSnap.data().count;
          }),
        );
        setExamStats(stats);
      } catch (error) {
        console.error("Error fetching exams:", error);
        toast.error("Failed to load examinations");
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  const filteredExams = exams.filter(
    (exam) =>
      exam.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.subject?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-teal-600" />
              Examination Results
            </h1>
            <p className="text-gray-600">
              Manage and process results for all registered examinations
            </p>
          </div>
        </div>

        {/* Search and Quick Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-teal-50/50 p-4 rounded-2xl border border-teal-100">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-teal-400" />
            <Input
              placeholder="Search by exam title or subject..."
              className="pl-10 border-teal-200 focus-visible:ring-teal-500 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-teal-700 font-medium">
            <History className="h-4 w-4" />
            <span>Found {filteredExams.length} Examinations</span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 bg-gray-100 animate-pulse rounded-2xl border"
              ></div>
            ))}
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No examinations found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredExams.map((exam) => (
              <Card
                key={exam.id}
                className="overflow-hidden group hover:shadow-2xl transition-all duration-300 border-none ring-1 ring-gray-200 hover:ring-teal-200"
              >
                <div className="h-2 bg-gradient-to-r from-teal-500 to-teal-400"></div>
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge
                      variant="secondary"
                      className="bg-teal-50 text-teal-700 border-teal-100"
                    >
                      {exam.class || "General"}
                    </Badge>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Processed
                      </span>
                      <span className="text-xl font-black text-teal-600">
                        {examStats[exam.id] || 0}
                      </span>
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-teal-700 transition-colors">
                    {exam.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    {exam.examDate
                      ? new Date(exam.examDate).toLocaleDateString()
                      : "Date TBD"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="border-gray-200 hover:border-teal-200 hover:bg-teal-50 text-gray-700"
                      onClick={() =>
                        router.push(
                          `/dashboard/pariksha-board-convener/results/${exam.id}/view`,
                        )
                      }
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button
                      className="bg-teal-600 hover:bg-teal-700 shadow-md hover:shadow-lg transition-all"
                      onClick={() =>
                        router.push(
                          `/dashboard/pariksha-board-convener/results/${exam.id}`,
                        )
                      }
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Process
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full text-teal-700 hover:text-teal-800 hover:bg-teal-50 font-semibold group"
                    onClick={() =>
                      router.push(
                        `/dashboard/pariksha-board-convener/results/${exam.id}/view`,
                      )
                    }
                  >
                    View All Details
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
