"use client";

import { useMemo } from "react";
import {
  Search,
  Bell,
  BookOpen,
  CheckCircle2,
  CalendarDays,
  BarChart3,
  Video,
  PlayCircle,
  Download,
  ClipboardList,
  Megaphone,
  Clock3,
  ChevronRight,
  MoonStar,
  Sparkles,
  GraduationCap,
} from "lucide-react";
  import {
      StatCard,
      QuickAction
  } from "@/components/digitalclassroom/dashborad";
import Layout from "@/components/digitalclassroom/Layout";

import useAuthStore from "@/lib/authStore";

const upcomingClasses = [
  {
    id: 1,
    subject: "Quran Studies",
    lesson: "Surah Al-Baqarah - Part 3",
    date: "Today",
    time: "10:00 AM",
    status: "live",
    icon: BookOpen,
  },
  {
    id: 2,
    subject: "Islamic History",
    lesson: "The Early Muslim Community",
    date: "Today",
    time: "02:00 PM",
    status: "live",
    icon: GraduationCap,
  },
  {
    id: 3,
    subject: "Arabic Language",
    lesson: "Basic Grammar - Lesson 5",
    date: "Tomorrow",
    time: "10:00 AM",
    status: "scheduled",
    icon: BookOpen,
  },
  {
    id: 4,
    subject: "Fiqh",
    lesson: "Purity and Prayer",
    date: "Tomorrow",
    time: "02:00 PM",
    status: "scheduled",
    icon: BookOpen,
  },
];

const announcements = [
  {
    id: 1,
    title: "Class Schedule Update",
    description:
      "Tomorrow's Islamic History class is rescheduled to 2:00 PM.",
    date: "Today",
    icon: CalendarDays,
  },
  {
    id: 2,
    title: "New Study Material",
    description:
      "Chapter 5 notes for Arabic Language are now available.",
    date: "Yesterday",
    icon: BookOpen,
  },
];

export default function DigitalClassroomPage() {
  const { userData, user } = useAuthStore();

  const studentName = useMemo(() => {
    return (
      userData?.fullName ||
      userData?.studentName ||
      user?.displayName ||
      "Student"
    );
  }, [userData, user]);

  return (
    <Layout user={user}>
      
    <main className="min-h-screen bg-[#f8faf8]">
      {/* 
        If your dashboard layout already gives left margin
        for Sidebar, REMOVE lg:ml-64 below.
      */}
      <div className=" min-h-screen">
        {/* ========================================= */}
        {/* TOP HEADER */}
        {/* ========================================= */}

        
        {/* ========================================= */}
        {/* PAGE CONTENT */}
        {/* ========================================= */}

        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          {/* ========================================= */}
          {/* HERO */}
          {/* ========================================= */}

          <section className="relative overflow-hidden rounded-[30px] border border-teal-100 bg-gradient-to-r from-[#fffdf7] via-[#f4fbf8] to-[#ddf4ef] shadow-sm">
            {/* Islamic decoration */}
            <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full border-[24px] border-teal-600/5" />

            <div className="pointer-events-none absolute left-[45%] top-5 opacity-[0.07]">
              <MoonStar className="h-32 w-32 text-teal-900" />
            </div>

            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.25fr_0.75fr] lg:p-10">
              <div className="relative z-10">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-600">
                  <Sparkles className="h-4 w-4" />
                  Assalamu Alaikum
                </div>

                <p className="text-xl font-semibold text-teal-900 sm:text-2xl">
                  Welcome back,
                </p>

                <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                  {studentName}!
                </h1>

                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  Continue your journey of knowledge. Join your live
                  classes, watch recordings and access study materials
                  anytime from your Digital Madrasa classroom.
                </p>

                <div className="mt-6 max-w-xl rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4">
                  <p className="font-medium italic leading-6 text-slate-700">
                    “Seeking knowledge is a path of worship and
                    excellence.”
                  </p>

                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    Learn • Practice • Grow
                  </p>
                </div>
              </div>

              {/* Islamic visual */}
              <div className="relative hidden min-h-[230px] items-end justify-center lg:flex">
                <div className="absolute right-4 top-1 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                  <MoonStar className="h-7 w-7 text-amber-500" />
                </div>

                {/* Mosque silhouette */}
                <div className="absolute bottom-0 flex items-end gap-3 opacity-15">
                  <div className="h-24 w-8 rounded-t-full bg-teal-900" />

                  <div className="relative h-28 w-28 rounded-t-[55%] bg-teal-900">
                    <div className="absolute -top-8 left-1/2 h-10 w-2 -translate-x-1/2 rounded-full bg-teal-900" />
                  </div>

                  <div className="h-20 w-8 rounded-t-full bg-teal-900" />
                </div>

                <div className="relative z-10 w-[260px] rounded-[26px] border border-white/70 bg-white/80 p-5 shadow-xl shadow-teal-900/10 backdrop-blur">
                  <div className="flex h-32 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50">
                    <div className="text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg">
                        <BookOpen className="h-7 w-7" />
                      </div>

                      <p className="mt-3 text-sm font-bold text-teal-950">
                        Digital Madrasa
                      </p>

                      <p className="text-xs text-slate-500">
                        Knowledge with values
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================= */}
          {/* STATS */}
          {/* ========================================= */}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={BookOpen}
              value="5"
              label="Enrolled Courses"
              iconClass="bg-emerald-100 text-emerald-700"
            />

            <StatCard
              icon={CheckCircle2}
              value="12"
              label="Classes Completed"
              iconClass="bg-teal-100 text-teal-700"
            />

            <StatCard
              icon={CalendarDays}
              value="3"
              label="Upcoming Classes"
              iconClass="bg-amber-100 text-amber-700"
            />

            <StatCard
              icon={BarChart3}
              value="85%"
              label="Overall Progress"
              iconClass="bg-violet-100 text-violet-700"
            />
          </section>

          {/* ========================================= */}
          {/* LOWER CONTENT */}
          {/* ========================================= */}

          <section className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
            {/* Upcoming Classes */}
            <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <CalendarDays className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="font-bold text-slate-900">
                      Upcoming Classes
                    </h2>

                    <p className="text-xs text-slate-500">
                      Your next learning sessions
                    </p>
                  </div>
                </div>

                <button className="text-sm font-semibold text-teal-700 hover:text-teal-900">
                  View All
                </button>
              </div>

              <div>
                {upcomingClasses.map((classItem) => {
                  const Icon = classItem.icon;
                  const live = classItem.status === "live";

                  return (
                    <div
                      key={classItem.id}
                      className="grid gap-4 border-b border-slate-100 px-5 py-5 last:border-b-0 sm:px-6 lg:grid-cols-[1.2fr_0.6fr_auto] lg:items-center"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <Icon className="h-6 w-6" />
                        </div>

                        <div>
                          <h3 className="font-bold text-slate-900">
                            {classItem.subject}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {classItem.lesson}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {classItem.date}, {classItem.time}
                        </p>

                        <div
                          className={`mt-1 flex items-center gap-1.5 text-xs font-semibold ${
                            live
                              ? "text-red-500"
                              : "text-blue-600"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              live
                                ? "animate-pulse bg-red-500"
                                : "bg-blue-500"
                            }`}
                          />

                          {live ? "Live Class" : "Scheduled"}
                        </div>
                      </div>

                      {live ? (
                        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800">
                          <Video className="h-4 w-4" />
                          Join Now
                        </button>
                      ) : (
                        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                          View Details
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT */}
            <div className="space-y-6">
              {/* Quick actions */}
              <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Sparkles className="h-5 w-5" />
                  </div>

                  <h2 className="font-bold text-slate-900">
                    Quick Actions
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <QuickAction
                    icon={Video}
                    label="Join Live Class"
                    className="bg-emerald-50 text-emerald-800"
                  />

                  <QuickAction
                    icon={PlayCircle}
                    label="View Recordings"
                    className="bg-blue-50 text-blue-800"
                  />

                  <QuickAction
                    icon={Download}
                    label="Download Notes"
                    className="bg-violet-50 text-violet-800"
                  />

                  <QuickAction
                    icon={ClipboardList}
                    label="Assignments"
                    className="bg-amber-50 text-amber-800"
                  />
                </div>
              </div>

              {/* Announcements */}
              <div className="rounded-[26px] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
                  <div className="flex items-center gap-3">
                    <Megaphone className="h-5 w-5 text-teal-700" />

                    <h2 className="font-bold text-slate-900">
                      Recent Announcements
                    </h2>
                  </div>

                  <button className="text-xs font-semibold text-teal-700">
                    View All
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {announcements.map((announcement) => {
                    const Icon = announcement.icon;

                    return (
                      <div
                        key={announcement.id}
                        className="flex gap-4 p-5"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            {announcement.title}
                          </h3>

                          <p className="mt-1 text-sm leading-5 text-slate-500">
                            {announcement.description}
                          </p>

                          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                            <Clock3 className="h-3.5 w-3.5" />
                            {announcement.date}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
    </Layout>
  );
}



