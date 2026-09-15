"use client";

import { useMemo, useState } from "react";
import {
  Search,
  BookOpen,
  FileText,
  Download,
  Eye,
  Video,
  File,
  Filter,
  Grid3X3,
  List,
  BookMarked,
  GraduationCap,
  CalendarDays,
  Clock3,
  FolderOpen,
  MoonStar,
  Sparkles,
  X,
} from "lucide-react";
import Layout from "@/components/digitalclassroom/Layout";
import {
 getMaterialIcon,
 StatCard,
  MaterialCard,
  MaterialListItem,
  EmptyMaterials,
} from "@/components/digitalclassroom/dashborad";

import useAuthStore from "@/lib/authStore";

const MATERIALS = [
  {
    id: 1,
    title: "Surah Al-Baqarah – Lesson Notes",
    subject: "Quran Studies",
    teacher: "Usthad Abdul Rahman",
    type: "PDF",
    size: "2.4 MB",
    date: "12 Sep 2026",
    description:
      "Detailed lesson notes, meanings and important points from the class.",
  },
  {
    id: 2,
    title: "Arabic Grammar – Lesson 5",
    subject: "Arabic Language",
    teacher: "Usthad Muhammad",
    type: "PDF",
    size: "1.8 MB",
    date: "11 Sep 2026",
    description:
      "Arabic grammar notes with simple examples and exercises.",
  },
  {
    id: 3,
    title: "Purity and Prayer",
    subject: "Fiqh",
    teacher: "Usthad Hamza",
    type: "Document",
    size: "1.2 MB",
    date: "10 Sep 2026",
    description:
      "Study notes covering Taharah, Wudu and basic prayer rules.",
  },
  {
    id: 4,
    title: "The Early Muslim Community",
    subject: "Islamic History",
    teacher: "Usthad Salim",
    type: "PDF",
    size: "3.1 MB",
    date: "09 Sep 2026",
    description:
      "Important events and lessons from the early Muslim community.",
  },
  {
    id: 5,
    title: "Arabic Vocabulary Practice",
    subject: "Arabic Language",
    teacher: "Usthad Muhammad",
    type: "Video",
    size: "18 Min",
    date: "08 Sep 2026",
    description:
      "Vocabulary practice lesson with pronunciation and examples.",
  },
  {
    id: 6,
    title: "Daily Duas",
    subject: "Islamic Studies",
    teacher: "Usthad Kareem",
    type: "PDF",
    size: "900 KB",
    date: "07 Sep 2026",
    description:
      "Collection of important daily duas for students.",
  },
];

const SUBJECTS = [
  "All",
  "Quran Studies",
  "Arabic Language",
  "Fiqh",
  "Islamic History",
  "Islamic Studies",
];

export default function StudyMaterialsPage() {
  const { userData, user } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [subject, setSubject] = useState("All");
  const [viewMode, setViewMode] = useState("grid");

  const studentName =
    userData?.fullName ||
    userData?.studentName ||
    user?.displayName ||
    "Student";

  const filteredMaterials = useMemo(() => {
    return MATERIALS.filter((item) => {
      const matchesSearch =
        item.title
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        item.subject
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        item.teacher
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesSubject =
        subject === "All" ||
        item.subject === subject;

      return matchesSearch && matchesSubject;
    });
  }, [searchTerm, subject]);

  return (
  <Layout user={user}>
  <main className="min-h-screen bg-[#f8faf8]">
  
      <div className="min-h-screen ">

        {/* =====================================
            PAGE CONTENT
        ====================================== */}

        <div className="space-y-6 p-4 sm:p-6 lg:p-8">

          {/* =====================================
              HEADER BANNER
          ====================================== */}

          <section className="relative overflow-hidden rounded-[30px] border border-teal-100 bg-gradient-to-r from-[#fffdf7] via-[#f5fbf8] to-[#ddf4ef] p-6 shadow-sm sm:p-8">

            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[22px] border-teal-700/5" />

            <MoonStar className="absolute right-12 top-8 h-20 w-20 text-amber-400/10" />

            <div className="relative z-10 max-w-3xl">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-600">
                <Sparkles className="h-4 w-4" />
                Digital Madrasa
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Study Materials
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Assalamu Alaikum {studentName}. Access your
                lesson notes, PDF materials, documents and
                educational resources from one place.
              </p>

              <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                <BookOpen className="h-4 w-4" />
                Learn • Practice • Grow
              </div>
            </div>
          </section>

          {/* =====================================
              STAT CARDS
          ====================================== */}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <StatCard
              icon={FolderOpen}
              value={MATERIALS.length}
              label="Total Materials"
              iconClass="bg-teal-100 text-teal-700"
            />

            <StatCard
              icon={FileText}
              value={
                MATERIALS.filter(
                  (item) => item.type === "PDF"
                ).length
              }
              label="PDF Notes"
              iconClass="bg-blue-100 text-blue-700"
            />

            <StatCard
              icon={Video}
              value={
                MATERIALS.filter(
                  (item) => item.type === "Video"
                ).length
              }
              label="Video Materials"
              iconClass="bg-violet-100 text-violet-700"
            />

            <StatCard
              icon={BookMarked}
              value="5"
              label="Subjects"
              iconClass="bg-amber-100 text-amber-700"
            />

          </section>

          {/* =====================================
              SEARCH / FILTER BAR
          ====================================== */}

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">

              {/* Search */}

              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(e.target.value)
                  }
                  placeholder="Search study materials..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-11 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                />

                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Subject filter */}

              <div className="relative min-w-[220px]">
                <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <select
                  value={subject}
                  onChange={(e) =>
                    setSubject(e.target.value)
                  }
                  className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                >
                  {SUBJECTS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              {/* View switch */}

              <div className="flex h-12 items-center rounded-2xl border border-slate-200 bg-slate-50 p-1">

                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`flex h-9 w-10 items-center justify-center rounded-xl transition ${
                    viewMode === "grid"
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-slate-400"
                  }`}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`flex h-9 w-10 items-center justify-center rounded-xl transition ${
                    viewMode === "list"
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-slate-400"
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>

              </div>
            </div>

          </section>

          {/* =====================================
              TITLE
          ====================================== */}

          <section>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Available Materials
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredMaterials.length} materials found
                </p>
              </div>
            </div>
          </section>

          {/* =====================================
              MATERIALS
          ====================================== */}

          {filteredMaterials.length === 0 ? (
            <EmptyMaterials />
          ) : viewMode === "grid" ? (
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {filteredMaterials.map((material) => (
                <MaterialCard
                  key={material.id}
                  material={material}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              {filteredMaterials.map(
                (material, index) => (
                  <MaterialListItem
                    key={material.id}
                    material={material}
                    last={
                      index ===
                      filteredMaterials.length - 1
                    }
                  />
                )
              )}
            </div>
          )}
        </div>
      </div>
    </main>
    </Layout>
  );
}


