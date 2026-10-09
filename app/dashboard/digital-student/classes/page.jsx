"use client";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
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

  import {
  getMyDigitalStudentLiveClasses,
} from "@/lib/digitalClassStudentService";

import Layout from "@/components/digitalclassroom/Layout";

import useAuthStore from "@/lib/authStore";

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
  const [liveClasses, setLiveClasses] = useState([]);
  const [liveClassesLoading, setLiveClassesLoading] = useState(true);

const [currentTime, setCurrentTime] = useState(new Date());

  const studentName = useMemo(() => {
    return (
      userData?.fullName ||
      userData?.studentName ||
      user?.displayName ||
      "Student"
    );
  }, [userData, user]);

  useEffect(() => {
  let active = true;

  const loadLiveClasses =
    async () => {
      if (!user?.uid) {
        return;
      }

      try {
        setLiveClassesLoading(
          true
        );

        const result =
          await getMyDigitalStudentLiveClasses();

        if (!active) {
          return;
        }

        setLiveClasses(
          Array.isArray(
            result?.classes
          )
            ? result.classes
            : []
        );
      } catch (error) {
        console.error(
          "LOAD STUDENT LIVE CLASSES ERROR:",
          error
        );

        if (active) {
          setLiveClasses([]);
        }
      } finally {
        if (active) {
          setLiveClassesLoading(
            false
          );
        }
      }
    };

  loadLiveClasses();

  return () => {
    active = false;
  };
}, [user?.uid]);

useEffect(() => {
  if (!user?.uid) {
    return;
  }

  const timer =
    setInterval(
      async () => {
        try {
          const result =
            await getMyDigitalStudentLiveClasses();

          setLiveClasses(
            Array.isArray(
              result?.classes
            )
              ? result.classes
              : []
          );

          setCurrentTime(
            new Date()
          );
        } catch (error) {
          console.error(
            "AUTO REFRESH STUDENT CLASSES ERROR:",
            error
          );
        }
      },
      30000
    );

  return () => {
    clearInterval(timer);
  };
}, [user?.uid]);

const getLocalDateString =
  (date) => {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };


const today =
  new Date(
    currentTime
  );

const tomorrow =
  new Date(
    currentTime
  );

tomorrow.setDate(
  tomorrow.getDate() + 1
);

const todayDate =
  getLocalDateString(
    today
  );

const tomorrowDate =
  getLocalDateString(
    tomorrow
  );


const upcomingClasses =
  liveClasses.filter(
    (item) => {
      const validDate =
        item.date ===
          todayDate ||
        item.date ===
          tomorrowDate;

      const validStatus =
        item.status ===
          "upcoming" ||
        item.status ===
          "ongoing";

      return (
        validDate &&
        validStatus
      );
    }
  );
  const completedClasses =
  useMemo(() => {
    return liveClasses.filter(
      (classItem) =>
        classItem?.status ===
        "completed"
    );
  }, [liveClasses]);

  const recentCompletedClasses =
  useMemo(() => {
    return completedClasses
      .sort((a, b) => {
        const first =
          `${a?.date || ""} ${
            a?.startTime || ""
          }`;

        const second =
          `${b?.date || ""} ${
            b?.startTime || ""
          }`;

        return second.localeCompare(
          first
        );
      })
      .slice(0, 4);
  }, [completedClasses]);

  const formatClassTime =
  (time) => {
    if (!time) {
      return "";
    }

    const [
      hours,
      minutes,
    ] = time
      .split(":")
      .map(Number);

    const date =
      new Date();

    date.setHours(
      hours,
      minutes,
      0,
      0
    );

    return date.toLocaleTimeString(
      "en-IN",
      {
        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          true,
      }
    );
  };


  const getClassDateLabel = (dateValue) => {
  if (!dateValue) {
    return "";
  }

  const formatDate = (date) => {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const today =
    new Date();

  const tomorrow =
    new Date();

  tomorrow.setDate(
    tomorrow.getDate() + 1
  );

  if (
    dateValue ===
    formatDate(today)
  ) {
    return "Today";
  }

  if (
    dateValue ===
    formatDate(tomorrow)
  ) {
    return "Tomorrow";
  }

  try {
    const date =
      new Date(
        `${dateValue}T00:00:00`
      );

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  } catch {
    return dateValue;
  }
};

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
              icon={CheckCircle2}
              value={completedClasses.length}
              label="Classes Completed"
              iconClass="bg-teal-100 text-teal-700"
            />

            <StatCard
              icon={CalendarDays}
              value={upcomingClasses.length}
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

                
              </div>

              <div>
               {liveClassesLoading ? (

  <div className="flex min-h-[220px] items-center justify-center">

    <div className="text-center">

      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-teal-100 border-t-teal-600" />

      <p className="mt-3 text-sm font-medium text-slate-500">
        Loading classes...
      </p>

    </div>

  </div>

) : upcomingClasses.length === 0 ? (

  <div className="px-6 py-16 text-center">

    <CalendarDays className="mx-auto h-9 w-9 text-slate-300" />

    <p className="mt-3 text-sm font-semibold text-slate-600">
      No upcoming classes
    </p>

    <p className="mt-1 text-xs text-slate-400">
      Today and tomorrow&apos;s classes will appear here.
    </p>

  </div>

) : (

  upcomingClasses.map(
    (classItem) => {

      const live =
        classItem.status ===
        "ongoing";

      const dateLabel =
        classItem.date ===
        todayDate
          ? "Today"
          : classItem.date ===
              tomorrowDate
            ? "Tomorrow"
            : classItem.date;

      return (
        <div
          key={
            classItem.id
          }
          className="grid gap-4 border-b border-slate-100 px-5 py-5 last:border-b-0 sm:px-6 lg:grid-cols-[1.2fr_0.6fr_auto] lg:items-center"
        >

          <div className="flex items-center gap-4">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <BookOpen className="h-6 w-6" />
            </div>

            <div>

              <h3 className="font-bold text-slate-900">
                {
                  classItem.subject
                }
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {
                  classItem.title
                }
              </p>

              {classItem.teacherName && (
                <p className="mt-1 text-xs text-slate-400">
                  Ustad:{" "}
                  {
                    classItem.teacherName
                  }
                </p>
              )}

            </div>

          </div>


          <div>

            <p className="text-sm font-semibold text-slate-700">
              {dateLabel},{" "}
              {formatClassTime(
                classItem.startTime
              )}
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

              {live
                ? "Live Now"
                : "Scheduled"}

            </div>

          </div>


          {live ? (

            <button
              type="button"
              onClick={() => {
                if (
                  classItem.meetLink
                ) {
                  window.open(
                    classItem.meetLink,
                    "_blank",
                    "noopener,noreferrer"
                  );
                }
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
            >
              <Video className="h-4 w-4" />

              Join Now
            </button>

          ) : (

            <button
              type="button"
              disabled
              className="inline-flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 text-sm font-semibold text-slate-400"
            >
              Scheduled

              <ChevronRight className="h-4 w-4" />
            </button>

          )}

        </div>
      );
    }
  )

)}
              </div>
            </div>

            {/* RIGHT */}
            <div className="space-y-6">
              
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
          {/* ========================================= */}
{/* RECENTLY COMPLETED CLASSES */}
{/* ========================================= */}

<section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">

  {/* HEADER */}

  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">

    <div className="flex items-center gap-3">

      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
        <CheckCircle2 className="h-5 w-5" />
      </div>

      <div>

        <h2 className="font-bold text-slate-900">
          Recently Completed Classes
        </h2>

        <p className="text-xs text-slate-500">
          Your latest completed learning sessions
        </p>

      </div>

    </div>

   

  </div>


  {/* CONTENT */}

  {liveClassesLoading ? (

    <div className="flex min-h-[180px] items-center justify-center">

      <div className="text-center">

        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-teal-100 border-t-teal-600" />

        <p className="mt-3 text-sm text-slate-500">
          Loading completed classes...
        </p>

      </div>

    </div>

  ) : recentCompletedClasses.length === 0 ? (

    <div className="px-6 py-14 text-center">

      <CheckCircle2 className="mx-auto h-9 w-9 text-slate-300" />

      <p className="mt-3 text-sm font-semibold text-slate-600">
        No completed classes yet
      </p>

      <p className="mt-1 text-xs text-slate-400">
        Completed Live Classes will appear here.
      </p>

    </div>

  ) : (

    <div className="divide-y divide-slate-100">

      {recentCompletedClasses.map(
        (classItem) => {

          const dateLabel =
            getClassDateLabel(
              classItem.date
            );

          const startTime =
            formatClassTime(
              classItem.startTime
            );

          const endTime =
            formatClassTime(
              classItem.endTime
            );

          return (
            <div
              key={classItem.id}
              className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[1.2fr_0.7fr_auto] lg:items-center"
            >

              {/* CLASS */}

              <div className="flex items-center gap-4">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">

                  <BookOpen className="h-6 w-6" />

                </div>

                <div className="min-w-0">

                  <h3 className="font-bold text-slate-900">
                    {classItem.subject ||
                      "Digital Class"}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {classItem.title ||
                      "Completed Class"}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">

                    {classItem.className && (
                      <span>
                        {
                          classItem.className
                        }
                      </span>
                    )}

                    {classItem.teacherName && (
                      <>
                        <span>•</span>

                        <span>
                          Ustad:{" "}
                          {
                            classItem.teacherName
                          }
                        </span>
                      </>
                    )}

                  </div>

                </div>

              </div>


              {/* TIME */}

              <div>

                <p className="text-sm font-semibold text-slate-700">
                  {dateLabel}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {startTime}

                  {endTime
                    ? ` - ${endTime}`
                    : ""}
                </p>

              </div>


              {/* STATUS */}

              <div className="flex lg:justify-end">

                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">

                  <CheckCircle2 className="h-3.5 w-3.5" />

                  Completed

                </span>

              </div>

            </div>
          );
        }
      )}

    </div>

  )}

</section>
        </div>
      </div>
    </main>
    </Layout>
  );
}



