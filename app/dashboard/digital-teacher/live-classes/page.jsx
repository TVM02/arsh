"use client";

import {
  useMemo,
  useState,
} from "react";

import Layout from "@/components/digitalclassroom/Layout";
import {StatCard, QuickAction, TodayClassRow, LiveClassCard} from "@/components/digitalclassroom/tecaherstudent"
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,

  Clock3,
  History,
  Link2,
  MoreVertical,
  Play,
  Plus,
  Radio,
  Search,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import {
  MiniCalendar,
} from "@/components/digitalclassroom/dashborad";

/* =========================================================
   DEMO LIVE CLASS DATA
========================================================= */

const DEMO_CLASSES = [
  {
    id: "class-1",
    title: "Quran Recitation",
    subject: "Quran",
    className: "Class 5",
    
    dateLabel: "Live Now",
    date: "2026-09-24",
    time: "10:00 AM",
    endTime: "10:45 AM",
    studentsCount: 22,
    status: "ongoing",
    statusText: "Started 15 mins ago",
    iconType: "book",
    students: [
      {
        name: "Muhammed Jasim",
        image: "",
      },
      {
        name: "Ahmed Ali",
        image: "",
      },
      {
        name: "Muhammed Riyas",
        image: "",
      },
    ],
  },
  {
    id: "class-2",
    title: "Tajweed Class",
    subject: "Tajweed",
    className: "Class 7",
   
    dateLabel: "Today, 10:30 AM",
    date: "2026-09-24",
    time: "10:30 AM",
    endTime: "11:15 AM",
    studentsCount: 18,
    status: "upcoming",
    statusText: "Scheduled in 45 mins",
    iconType: "video",
    students: [
      {
        name: "Fathima",
        image: "",
      },
      {
        name: "Sinan",
        image: "",
      },
    ],
  },
  {
    id: "class-3",
    title: "Islamic History",
    subject: "Islamic History",
    className: "Class 6",
  
    dateLabel: "Today, 02:00 PM",
    date: "2026-09-24",
    time: "02:00 PM",
    endTime: "02:45 PM",
    studentsCount: 20,
    status: "upcoming",
    statusText: "In 4 hours",
    iconType: "book",
    students: [
      {
        name: "Hanan",
        image: "",
      },
      {
        name: "Rashid",
        image: "",
      },
    ],
  },
  {
    id: "class-4",
    title: "Fiqh Basics",
    subject: "Fiqh",
    className: "Class 8",
 
    dateLabel: "Tomorrow, 09:00 AM",
    date: "2026-09-25",
    time: "09:00 AM",
    endTime: "09:45 AM",
    studentsCount: 16,
    status: "upcoming",
    statusText: "Tomorrow",
    iconType: "book",
    students: [
      {
        name: "Naseem",
        image: "",
      },
      {
        name: "Suhail",
        image: "",
      },
    ],
  },
  {
    id: "class-5",
    title: "Arabic Language",
    subject: "Arabic",
    className: "Class 5",
  
    dateLabel: "Tomorrow, 11:30 AM",
    date: "2026-09-25",
    time: "11:30 AM",
    endTime: "12:15 PM",
    studentsCount: 19,
    status: "upcoming",
    statusText: "Tomorrow",
    iconType: "book",
    students: [
      {
        name: "Faris",
        image: "",
      },
      {
        name: "Maryam",
        image: "",
      },
      {
        name: "Mishab",
        image: "",
      },
    ],
  },
  {
    id: "class-6",
    title: "Hadith Studies",
    subject: "Hadith",
    className: "Class 7",
    
    dateLabel: "25 Sep 2026",
    date: "2026-09-25",
    time: "03:30 PM",
    endTime: "04:15 PM",
    studentsCount: 21,
    status: "upcoming",
    statusText: "In 2 days",
    iconType: "book",
    students: [
      {
        name: "Rahman",
        image: "",
      },
      {
        name: "Ameen",
        image: "",
      },
    ],
  },
  {
    id: "class-7",
    title: "Arabic Grammar",
    subject: "Arabic",
    className: "Class 6",

    dateLabel: "20 Sep 2026",
    date: "2026-09-20",
    time: "09:30 AM",
    endTime: "10:15 AM",
    studentsCount: 24,
    status: "completed",
    statusText: "Completed",
    iconType: "book",
    students: [],
  },
];





export default function DigitalTeacherLiveClassesPage() {
  const [
    classes,
  ] = useState(
    DEMO_CLASSES,
  );

  const [
    activeTab,
    setActiveTab,
  ] = useState("all");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    monthFilter,
    setMonthFilter,
  ] = useState("month");


  /* =====================================================
     COUNTS
  ===================================================== */

  const totalClasses =
    classes.length;

  const upcomingCount =
    classes.filter(
      (item) =>
        item.status ===
        "upcoming",
    ).length;

  const ongoingCount =
    classes.filter(
      (item) =>
        item.status ===
        "ongoing",
    ).length;

  const completedCount =
    classes.filter(
      (item) =>
        item.status ===
        "completed",
    ).length;


  /* =====================================================
     FILTER CLASSES
  ===================================================== */

  const filteredClasses =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      return classes.filter(
        (item) => {
          if (
            activeTab !==
              "all" &&
            item.status !==
              activeTab
          ) {
            return false;
          }

          if (text) {
            const searchable =
              [
                item.title,
                item.subject,
                item.className,
           
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            if (
              !searchable.includes(
                text,
              )
            ) {
              return false;
            }
          }

          return true;
        },
      );
    }, [
      classes,
      activeTab,
      search,
    ]);


  /* =====================================================
     TODAY
  ===================================================== */

  const todaysClasses =
    classes
      .filter(
        (item) =>
          item.date ===
          "2026-09-24",
      )
      .slice(0, 3);


  /* =====================================================
     TABS
  ===================================================== */

  const tabs = [
    {
      id: "all",
      label: "All Classes",
      count:
        totalClasses,
      icon: Video,
    },

    {
      id: "upcoming",
      label: "Upcoming",
      count:
        upcomingCount,
      icon: CalendarDays,
    },

    {
      id: "ongoing",
      label: "Ongoing",
      count:
        ongoingCount,
      icon: Radio,
    },

    {
      id: "completed",
      label: "Completed",
      count:
        completedCount,
      icon:
        CheckCircle2,
    },
  ];


  return (
    <Layout>
      <div
        className="
          min-h-screen
          bg-[#f7f9fb]
          p-4
          md:p-6
        "
      >
        <div
          className="
            mx-auto
            max-w-[1500px]
            space-y-5
          "
        >
          {/* =====================================
              HEADER
          ====================================== */}

          <div
            className="
              flex
              flex-col
              gap-4
              md:flex-row
              md:items-start
              md:justify-between
            "
          >
            <div
              className="
                flex
                items-start
                gap-3
              "
            >
              <div
                className="
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-2xl
                  bg-emerald-100
                  text-emerald-600
                "
              >
                <Video className="h-6 w-6" />
              </div>

              <div>
                <h1
                  className="
                    text-2xl
                    font-bold
                    text-slate-900
                  "
                >
                  Live Classes
                </h1>

                <p
                  className="
                    mt-1
                    text-sm
                    text-slate-500
                  "
                >
                  Conduct and manage your online classes
                </p>
              </div>
            </div>


            <button
              type="button"
              className="
                inline-flex
                h-11
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-gradient-to-r
                from-emerald-500
                to-teal-500
                px-5
                text-sm
                font-semibold
                text-white
                shadow-lg
                shadow-teal-100
                transition
                hover:-translate-y-0.5
                hover:shadow-xl
              "
            >
              <Plus className="h-4 w-4" />

              Schedule New Class
            </button>
          </div>


          {/* =====================================
              STATS
          ====================================== */}

          <div
            className="
              grid
              grid-cols-1
              gap-4
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >
            <StatCard
              title="Total Classes"
              value={
                totalClasses
              }
              description="This month"
              icon={Video}
              type="green"
            />

            <StatCard
              title="Upcoming Classes"
              value={
                upcomingCount
              }
              description="Scheduled"
              icon={Play}
              type="blue"
            />

            <StatCard
              title="Ongoing Classes"
              value={
                ongoingCount
              }
              description="Live now"
              icon={Radio}
              type="pink"
            />

            <StatCard
              title="Completed Classes"
              value={
                completedCount
              }
              description="This month"
              icon={
                CheckCircle2
              }
              type="violet"
            />
          </div>


    

          <div
            className="
              flex
              flex-col
              gap-4
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-3
              shadow-sm
              xl:flex-row
              xl:items-center
              xl:justify-between
            "
          >
            {/* TABS */}

            <div
              className="
                flex
                flex-wrap
                items-center
                gap-2
              "
            >
              {tabs.map(
                (tab) => {
                  const Icon =
                    tab.icon;

                  const selected =
                    activeTab ===
                    tab.id;

                  return (
                    <button
                      type="button"
                      key={
                        tab.id
                      }
                      onClick={() =>
                        setActiveTab(
                          tab.id,
                        )
                      }
                      className={`
                        inline-flex
                        items-center
                        gap-2
                        rounded-full
                        px-4
                        py-2
                        text-xs
                        font-semibold
                        transition-all

                        ${
                          selected
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }
                      `}
                    >
                      <Icon className="h-4 w-4" />

                      {tab.label}

                      <span>
                        ({tab.count})
                      </span>

                      {tab.id ===
                        "ongoing" &&
                        ongoingCount >
                          0 && (
                          <span
                            className="
                              h-2
                              w-2
                              animate-pulse
                              rounded-full
                              bg-red-500
                            "
                          />
                        )}
                    </button>
                  );
                },
              )}
            </div>


            {/* SEARCH */}

            <div
              className="
                flex
                flex-col
                gap-2
                sm:flex-row
              "
            >
              <select
                value={
                  monthFilter
                }
                onChange={(
                  event,
                ) =>
                  setMonthFilter(
                    event.target
                      .value,
                  )
                }
                className="
                  h-10
                  rounded-lg
                  border
                  border-slate-200
                  bg-white
                  px-3
                  text-xs
                  font-semibold
                  text-slate-700
                  outline-none
                  focus:border-teal-400
                "
              >
                <option value="month">
                  This Month
                </option>

                <option value="week">
                  This Week
                </option>

                <option value="today">
                  Today
                </option>
              </select>


              <div className="relative">
                <Search
                  className="
                    absolute
                    left-3
                    top-1/2
                    h-4
                    w-4
                    -translate-y-1/2
                    text-slate-400
                  "
                />

                <input
                  type="text"
                  value={search}
                  onChange={(
                    event,
                  ) =>
                    setSearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search by class name, subject..."
                  className="
                    h-10
                    w-full
                    min-w-[280px]
                    rounded-lg
                    border
                    border-slate-200
                    bg-white
                    pl-9
                    pr-3
                    text-sm
                    text-slate-700
                    outline-none
                    transition
                    placeholder:text-slate-400
                    focus:border-teal-400
                    focus:ring-2
                    focus:ring-teal-100
                  "
                />
              </div>
            </div>
          </div>


          {/* =====================================
              CONTENT
          ====================================== */}

          <div
            className="
              grid
              grid-cols-1
              gap-5
              xl:grid-cols-[minmax(0,1fr)_350px]
            "
          >
            {/* LEFT */}

            <div className="space-y-3">
              {filteredClasses.map(
                (
                  classItem,
                ) => (
                  <LiveClassCard
                    key={
                      classItem.id
                    }
                    classItem={
                      classItem
                    }
                  />
                ),
              )}


              {filteredClasses.length ===
                0 && (
                <div
                  className="
                    rounded-2xl
                    border
                    border-dashed
                    border-slate-200
                    bg-white
                    px-5
                    py-16
                    text-center
                  "
                >
                  <Video
                    className="
                      mx-auto
                      h-8
                      w-8
                      text-slate-300
                    "
                  />

                  <p
                    className="
                      mt-3
                      text-sm
                      font-semibold
                      text-slate-600
                    "
                  >
                    No classes found
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-slate-400
                    "
                  >
                    Try another filter or schedule a new class.
                  </p>
                </div>
              )}
            </div>


            {/* RIGHT */}

            <aside className="space-y-4">
                <div
                className="
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  p-4
                  shadow-sm
                "
              >
             <div className="mb-5 flex items-center justify-between">
             
                               <h2 className="text-base font-extrabold text-[#07184c]">
                                 {new Date().toLocaleString("default", {
                                   month: "long",
                                 })}{" "}
                                 {new Date().getFullYear()}
                               </h2>
             
                               <CalendarDays className="h-5 w-5 text-teal-600" />
             
                             </div>
             
                             <MiniCalendar />

</div>
              {/* TODAY */}

              <div
                className="
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  p-4
                  shadow-sm
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <CalendarDays className="h-5 w-5 text-emerald-600" />

                    <h3
                      className="
                        text-sm
                        font-bold
                        text-slate-900
                      "
                    >
                      Today's Classes
                    </h3>
                  </div>

                  <button
                    type="button"
                    className="
                      text-[10px]
                      font-semibold
                      text-blue-600
                    "
                  >
                    View All
                  </button>
                </div>


                <div className="mt-2">
                  {todaysClasses.map(
                    (
                      classItem,
                    ) => (
                      <TodayClassRow
                        key={
                          classItem.id
                        }
                        classItem={
                          classItem
                        }
                      />
                    ),
                  )}
                </div>
              </div>


              {/* QUICK ACTIONS */}

              <div
                className="
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  p-4
                  shadow-sm
                "
              >
                <div
                  className="
                    mb-4
                    flex
                    items-center
                    gap-2
                  "
                >
                  <Clock3 className="h-5 w-5 text-emerald-600" />

                  <h3
                    className="
                      text-sm
                      font-bold
                      text-slate-900
                    "
                  >
                    Quick Actions
                  </h3>
                </div>


                <div
                  className="
                    grid
                    grid-cols-3
                    gap-2
                  "
                >
                  <QuickAction
                    icon={
                      CalendarDays
                    }
                    title="Schedule Class"
                    type="green"
                  />

                  <QuickAction
                    icon={Link2}
                    title="Join with Code"
                    type="blue"
                  />

                  <QuickAction
                    icon={History}
                    title="View Recordings"
                    type="pink"
                  />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </Layout>
  );
}