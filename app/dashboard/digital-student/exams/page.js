"use client";

import { useMemo, useState } from "react";
import {
  Search,
  FileCheck,
  CalendarDays,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Trophy,
  BookOpen,
  ChevronRight,
  Filter,
  ClipboardList,
  GraduationCap,
  Timer,
  Eye,
  Download,
} from "lucide-react";
import Layout from "@/components/digitalclassroom/Layout";
import {
  ExamCard,
  StatCard,
  EmptyExam,
} from "@/components/digitalclassroom/exam";

import useAuthStore from "@/lib/authStore";

const EXAMS = [
  {
    id: 1,
    title: "Quran Studies Monthly Exam",
    subject: "Quran Studies",
    date: "18 Sep 2026",
    time: "10:00 AM",
    duration: "45 Minutes",
    totalMarks: 50,
    status: "upcoming",
    registered: true,
  },
  {
    id: 2,
    title: "Arabic Language Assessment",
    subject: "Arabic Language",
    date: "20 Sep 2026",
    time: "02:00 PM",
    duration: "60 Minutes",
    totalMarks: 100,
    status: "upcoming",
    registered: true,
  },
  {
    id: 3,
    title: "Fiqh Unit Test",
    subject: "Fiqh",
    date: "24 Sep 2026",
    time: "11:00 AM",
    duration: "45 Minutes",
    totalMarks: 50,
    status: "upcoming",
    registered: false,
  },
  {
    id: 4,
    title: "Islamic History Exam",
    subject: "Islamic History",
    date: "05 Sep 2026",
    time: "10:00 AM",
    duration: "60 Minutes",
    totalMarks: 100,
    status: "completed",
    registered: true,
    marks: 84,
  },
];

const SUBJECTS = [
  "All",
  "Quran Studies",
  "Arabic Language",
  "Fiqh",
  "Islamic History",
];

export default function DigitalStudentExamPage() {
   const { userData, user } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [subjectFilter, setSubjectFilter] =
    useState("All");

  const filteredExams = useMemo(() => {
    return EXAMS.filter((exam) => {
      const matchesSearch =
        exam.title
          .toLowerCase()
          .includes(
            searchTerm.toLowerCase()
          ) ||
        exam.subject
          .toLowerCase()
          .includes(
            searchTerm.toLowerCase()
          );

      const matchesStatus =
        statusFilter === "all" ||
        exam.status === statusFilter;

      const matchesSubject =
        subjectFilter === "All" ||
        exam.subject === subjectFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSubject
      );
    });
  }, [
    searchTerm,
    statusFilter,
    subjectFilter,
  ]);

  const upcomingCount =
    EXAMS.filter(
      (exam) =>
        exam.status === "upcoming"
    ).length;

  const completedCount =
    EXAMS.filter(
      (exam) =>
        exam.status === "completed"
    ).length;

  const registeredCount =
    EXAMS.filter(
      (exam) => exam.registered
    ).length;

  return (
    <Layout user={user}>
    <main className="min-h-screen bg-[#f8faf8]">

      <div className="min-h-screen ">

        <div className="space-y-6 p-4 sm:p-6 lg:p-8">

          {/* =====================================
              PAGE TITLE
          ====================================== */}

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div>
              <p className="text-sm font-semibold text-teal-700">
                Digital Madrasa
              </p>

              <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
                Exams
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                View upcoming exams,
                registrations and results.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3">

              <GraduationCap className="h-5 w-5 text-teal-700" />

              <div>
                <p className="text-xs text-slate-500">
                  Student
                </p>

                <p className="text-sm font-semibold text-slate-800">
                  {userData?.fullName ||
                    userData?.studentName ||
                    "Digital Student"}
                </p>
              </div>

            </div>
          </div>

          {/* =====================================
              STATS
          ====================================== */}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <StatCard
              icon={CalendarDays}
              value={upcomingCount}
              label="Upcoming Exams"
              iconClass="bg-blue-100 text-blue-700"
            />

            <StatCard
              icon={CheckCircle2}
              value={completedCount}
              label="Completed Exams"
              iconClass="bg-emerald-100 text-emerald-700"
            />

            <StatCard
              icon={ClipboardList}
              value={registeredCount}
              label="Registered Exams"
              iconClass="bg-violet-100 text-violet-700"
            />

            <StatCard
              icon={Trophy}
              value="84%"
              label="Latest Score"
              iconClass="bg-amber-100 text-amber-700"
            />

          </section>

          {/* =====================================
              SEARCH + FILTER
          ====================================== */}

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">

            <div className="flex flex-col gap-3 xl:flex-row">

              {/* Search */}

              <div className="relative flex-1">

                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <input
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                  placeholder="Search exam or subject..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                />

              </div>

              {/* Subject */}

              <div className="relative min-w-[220px]">

                <BookOpen className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <select
                  value={subjectFilter}
                  onChange={(e) =>
                    setSubjectFilter(
                      e.target.value
                    )
                  }
                  className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none focus:border-teal-500"
                >
                  {SUBJECTS.map(
                    (subject) => (
                      <option
                        key={subject}
                        value={subject}
                      >
                        {subject}
                      </option>
                    )
                  )}
                </select>

              </div>

              {/* Status */}

              <div className="relative min-w-[190px]">

                <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value
                    )
                  }
                  className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none focus:border-teal-500"
                >
                  <option value="all">
                    All Exams
                  </option>

                  <option value="upcoming">
                    Upcoming
                  </option>

                  <option value="completed">
                    Completed
                  </option>
                </select>

              </div>

            </div>

          </section>

          {/* =====================================
              EXAM SECTION
          ====================================== */}

          <section>

            <div className="mb-4 flex items-center justify-between">

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Available Exams
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredExams.length} exams
                  available
                </p>
              </div>

            </div>

            {filteredExams.length ===
            0 ? (
              <EmptyExam />
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">

                {filteredExams.map(
                  (exam) => (
                    <ExamCard
                      key={exam.id}
                      exam={exam}
                    />
                  )
                )}

              </div>
            )}

          </section>

          {/* =====================================
              EXAM NOTICE
          ====================================== */}

          <section className="rounded-[24px] border border-amber-200 bg-amber-50/70 p-5">

            <div className="flex gap-4">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <AlertCircle className="h-5 w-5" />
              </div>

              <div>
                <h3 className="font-bold text-slate-900">
                  Exam Instructions
                </h3>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Please join your exam
                  before the scheduled
                  starting time. Keep a
                  stable internet connection
                  and follow all instructions
                  provided by your teacher.
                </p>
              </div>

            </div>

          </section>

        </div>
      </div>
    </main>
    </Layout>
  );
}

