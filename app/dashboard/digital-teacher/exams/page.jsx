"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";

import Layout from "@/components/digitalclassroom/Layout";

import {
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  GraduationCap,
  MoreHorizontal,
  Search,
  Trophy,
  Users,
} from "lucide-react";


/* =========================================================
   DEMO EXAMS
   Later replace with Firebase data
========================================================= */

const DEMO_EXAMS = [
  {
    id: "exam-1",

    title:
      "Quran Monthly Assessment",

    examName:
      "September Monthly Exam",

    className:
      "Class 5",

    subject:
      "Quran",

    date:
      "26 Sep 2026",

    dateValue:
      "2026-09-26",

    startTime:
      "10:00 AM",

    endTime:
      "11:00 AM",

    duration:
      "60 min",

    totalMarks:
      100,

    passMarks:
      40,

    studentsCount:
      22,

    marksEntered:
      10,

    status:
      "upcoming",

    resultStatus:
      "not_published",
  },

  {
    id: "exam-2",

    title:
      "Arabic Language Test",

    examName:
      "September Monthly Exam",

    className:
      "Class 6",

    subject:
      "Arabic",

    date:
      "24 Sep 2026",

    dateValue:
      "2026-09-24",

    startTime:
      "02:00 PM",

    endTime:
      "03:00 PM",

    duration:
      "60 min",

    totalMarks:
      100,

    passMarks:
      40,

    studentsCount:
      20,

    marksEntered:
      0,

    status:
      "ongoing",

    resultStatus:
      "not_published",
  },

  {
    id: "exam-3",

    title:
      "Tajweed Written Exam",

    examName:
      "September Monthly Exam",

    className:
      "Class 7",

    subject:
      "Tajweed",

    date:
      "22 Sep 2026",

    dateValue:
      "2026-09-22",

    startTime:
      "09:30 AM",

    endTime:
      "10:30 AM",

    duration:
      "60 min",

    totalMarks:
      80,

    passMarks:
      32,

    studentsCount:
      18,

    marksEntered:
      18,

    status:
      "completed",

    resultStatus:
      "published",
  },

  {
    id: "exam-4",

    title:
      "Islamic History Assessment",

    examName:
      "September Monthly Exam",

    className:
      "Class 6",

    subject:
      "Islamic History",

    date:
      "20 Sep 2026",

    dateValue:
      "2026-09-20",

    startTime:
      "11:00 AM",

    endTime:
      "12:00 PM",

    duration:
      "60 min",

    totalMarks:
      100,

    passMarks:
      40,

    studentsCount:
      20,

    marksEntered:
      20,

    status:
      "completed",

    resultStatus:
      "published",
  },

  {
    id: "exam-5",

    title:
      "Fiqh Chapter Test",

    examName:
      "September Monthly Exam",

    className:
      "Class 8",

    subject:
      "Fiqh",

    date:
      "28 Sep 2026",

    dateValue:
      "2026-09-28",

    startTime:
      "10:30 AM",

    endTime:
      "11:15 AM",

    duration:
      "45 min",

    totalMarks:
      50,

    passMarks:
      20,

    studentsCount:
      16,

    marksEntered:
      0,

    status:
      "upcoming",

    resultStatus:
      "not_published",
  },

  {
    id: "exam-6",

    title:
      "Hadith Memorization",

    examName:
      "September Monthly Exam",

    className:
      "Class 8",

    subject:
      "Hadith",

    date:
      "30 Sep 2026",

    dateValue:
      "2026-09-30",

    startTime:
      "01:30 PM",

    endTime:
      "02:30 PM",

    duration:
      "60 min",

    totalMarks:
      100,

    passMarks:
      40,

    studentsCount:
      16,

    marksEntered:
      0,

    status:
      "upcoming",

    resultStatus:
      "not_published",
  },

  {
    id: "exam-7",

    title:
      "Aqeedah Assessment",

    examName:
      "September Monthly Exam",

    className:
      "Class 7",

    subject:
      "Aqeedah",

    date:
      "18 Sep 2026",

    dateValue:
      "2026-09-18",

    startTime:
      "10:00 AM",

    endTime:
      "11:00 AM",

    duration:
      "60 min",

    totalMarks:
      100,

    passMarks:
      40,

    studentsCount:
      18,

    marksEntered:
      14,

    status:
      "completed",

    resultStatus:
      "pending",
  },
];


/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  type,
}) {
  const SafeIcon =
    Icon ||
    GraduationCap;

  const styles = {
    green: {
      card:
        "border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50",

      icon:
        "bg-emerald-100 text-emerald-600",
    },

    blue: {
      card:
        "border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50",

      icon:
        "bg-blue-100 text-blue-600",
    },

    pink: {
      card:
        "border-pink-100 bg-gradient-to-br from-pink-50 to-rose-50",

      icon:
        "bg-pink-100 text-pink-600",
    },

    violet: {
      card:
        "border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50",

      icon:
        "bg-violet-100 text-violet-600",
    },
  };

  const current =
    styles[type] ||
    styles.green;

  return (
    <div
      className={`
        rounded-2xl
        border
        p-4
        shadow-[0_6px_20px_rgba(15,23,42,0.04)]

        ${current.card}
      `}
    >
      <div
        className="
          flex
          items-center
          gap-4
        "
      >
        <div
          className={`
            flex
            h-13
            w-13
            shrink-0
            items-center
            justify-center
            rounded-2xl

            ${current.icon}
          `}
        >
          <SafeIcon className="h-6 w-6" />
        </div>

        <div>
          <p
            className="
              text-[10px]
              font-medium
              text-slate-500
            "
          >
            {title}
          </p>

          <p
            className="
              mt-1
              text-2xl
              font-bold
              text-slate-900
            "
          >
            {value}
          </p>

          <p
            className="
              mt-1
              text-[9px]
              text-slate-400
            "
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   FILTER SELECT
========================================================= */

function FilterSelect({
  label,
  value,
  onChange,
  children,
}) {
  return (
    <div>
      <label
        className="
          mb-1.5
          block
          text-[10px]
          font-semibold
          uppercase
          tracking-wide
          text-slate-500
        "
      >
        {label}
      </label>

      <select
        value={value}
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
          )
        }
        className="
          h-10
          w-full
          rounded-lg
          border
          border-slate-200
          bg-white
          px-3
          text-xs
          font-semibold
          text-slate-700
          outline-none
          transition
          focus:border-teal-400
          focus:ring-2
          focus:ring-teal-100
        "
      >
        {children}
      </select>
    </div>
  );
}


/* =========================================================
   STATUS BADGE
========================================================= */

function ExamStatusBadge({
  status,
}) {
  if (
    status ===
    "ongoing"
  ) {
    return (
      <span
        className="
          inline-flex
          items-center
          gap-1.5
          rounded-full
          bg-red-50
          px-3
          py-1
          text-[9px]
          font-bold
          text-red-600
        "
      >
        <span
          className="
            h-1.5
            w-1.5
            animate-pulse
            rounded-full
            bg-red-500
          "
        />

        Ongoing
      </span>
    );
  }


  if (
    status ===
    "completed"
  ) {
    return (
      <span
        className="
          inline-flex
          items-center
          gap-1.5
          rounded-full
          bg-emerald-50
          px-3
          py-1
          text-[9px]
          font-semibold
          text-emerald-700
        "
      >
        <CheckCircle2 className="h-3 w-3" />

        Completed
      </span>
    );
  }


  return (
    <span
      className="
        inline-flex
        items-center
        gap-1.5
        rounded-full
        bg-blue-50
        px-3
        py-1
        text-[9px]
        font-semibold
        text-blue-600
      "
    >
      <CalendarDays className="h-3 w-3" />

      Upcoming
    </span>
  );
}


/* =========================================================
   RESULT STATUS
========================================================= */

function ResultStatus({
  status,
}) {
  if (
    status ===
    "published"
  ) {
    return (
      <span
        className="
          rounded-full
          bg-emerald-100
          px-3
          py-1
          text-[9px]
          font-semibold
          text-emerald-700
        "
      >
        Published
      </span>
    );
  }


  if (
    status ===
    "pending"
  ) {
    return (
      <span
        className="
          rounded-full
          bg-amber-100
          px-3
          py-1
          text-[9px]
          font-semibold
          text-amber-700
        "
      >
        Pending
      </span>
    );
  }


  return (
    <span
      className="
        rounded-full
        bg-slate-100
        px-3
        py-1
        text-[9px]
        font-semibold
        text-slate-500
      "
    >
      Not Published
    </span>
  );
}


/* =========================================================
   EXAM ROW
========================================================= */

function ExamRow({
  exam,
}) {
  const percentage =
    exam.studentsCount > 0
      ? Math.round(
          (
            exam.marksEntered /
            exam.studentsCount
          ) * 100,
        )
      : 0;

  return (
    <div
      className="
        border-b
        border-slate-100
        px-4
        py-4
        transition
        last:border-b-0
        hover:bg-teal-50/20
      "
    >
      <div
        className="
          flex
          flex-col
          gap-4
          xl:flex-row
          xl:items-center
        "
      >
        {/* ICON */}

        <div
          className="
            flex
            h-[58px]
            w-[58px]
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-gradient-to-br
            from-violet-50
            to-purple-50
          "
        >
          <div
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              bg-violet-500
              text-white
              shadow-sm
            "
          >
            <FileText className="h-5 w-5" />
          </div>
        </div>


        {/* INFO */}

        <div
          className="
            min-w-0
            flex-1
          "
        >
          <div
            className="
              flex
              flex-wrap
              items-center
              gap-2
            "
          >
            <h3
              className="
                text-sm
                font-bold
                text-slate-900
              "
            >
              {exam.title}
            </h3>

            <ExamStatusBadge
              status={
                exam.status
              }
            />
          </div>

          <p
            className="
              mt-1
              text-[10px]
              font-medium
              text-slate-400
            "
          >
            {exam.examName}
          </p>

          <div
            className="
              mt-2
              flex
              flex-wrap
              items-center
              gap-2
              text-[10px]
              text-slate-500
            "
          >
            <span
              className="
                rounded-md
                bg-blue-50
                px-2
                py-1
                font-semibold
                text-blue-600
              "
            >
              {exam.className}
            </span>

            <span>
              {exam.subject}
            </span>

            <span className="text-slate-300">
              •
            </span>

            <span>
              Total:{" "}
              {exam.totalMarks}
            </span>

            <span className="text-slate-300">
              •
            </span>

            <span>
              Pass:{" "}
              {exam.passMarks}
            </span>
          </div>
        </div>


        {/* DATE */}

        <div
          className="
            min-w-[150px]
            space-y-2
            text-[10px]
            text-slate-500
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <CalendarDays className="h-4 w-4 text-slate-400" />

            <span>
              {exam.date}
            </span>
          </div>

          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <Clock3 className="h-4 w-4 text-slate-400" />

            <span>
              {exam.startTime}
              {" - "}
              {exam.endTime}
            </span>
          </div>
        </div>


        {/* STUDENTS / MARKS */}

        <div
          className="
            min-w-[175px]
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              gap-3
              text-[10px]
            "
          >
            <span
              className="
                flex
                items-center
                gap-1.5
                text-slate-500
              "
            >
              <Users className="h-4 w-4 text-slate-400" />

              {exam.studentsCount}
              {" "}
              students
            </span>

            <span
              className="
                font-bold
                text-teal-600
              "
            >
              {percentage}%
            </span>
          </div>

          <div
            className="
              mt-2
              h-1.5
              overflow-hidden
              rounded-full
              bg-slate-100
            "
          >
            <div
              style={{
                width:
                  `${percentage}%`,
              }}
              className="
                h-full
                rounded-full
                bg-gradient-to-r
                from-emerald-500
                to-teal-500
                transition-all
              "
            />
          </div>

          <p
            className="
              mt-1.5
              text-[9px]
              text-slate-400
            "
          >
            {exam.marksEntered}/
            {exam.studentsCount}
            {" "}
            marks entered
          </p>
        </div>


        {/* RESULT */}

        <div
          className="
            min-w-[110px]
          "
        >
          <ResultStatus
            status={
              exam.resultStatus
            }
          />
        </div>


        {/* ACTIONS */}

        <div
          className="
            flex
            shrink-0
            items-center
            gap-2
          "
        >
          {/* VIEW */}

          <Link
            href={`/dashboard/digital-teacher/exams/${exam.id}`}
            title="View Exam"
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              border
              border-blue-100
              bg-blue-50
              text-blue-500
              transition
              hover:bg-blue-100
            "
          >
            <Eye className="h-4 w-4" />
          </Link>


          {/* MARK ENTRY */}

          {(exam.status ===
            "ongoing" ||
            exam.status ===
              "completed") && (
            <Link
              href={`/dashboard/digital-teacher/exams/${exam.id}/marks`}
              title="Enter Marks"
              className="
                flex
                h-9
                items-center
                justify-center
                gap-1.5
                rounded-lg
                border
                border-violet-100
                bg-violet-50
                px-3
                text-[10px]
                font-semibold
                text-violet-600
                transition
                hover:bg-violet-100
              "
            >
              <FileCheck2 className="h-4 w-4" />

              Marks
            </Link>
          )}


          <button
            type="button"
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              border
              border-slate-100
              bg-slate-50
              text-slate-500
              hover:bg-slate-100
            "
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   UPCOMING EXAM
========================================================= */

function UpcomingExam({
  exam,
}) {
  return (
    <div
      className="
        flex
        items-center
        gap-3
        border-b
        border-slate-100
        py-3
        last:border-b-0
      "
    >
      <div
        className="
          flex
          h-10
          w-10
          shrink-0
          items-center
          justify-center
          rounded-xl
          bg-violet-50
          text-violet-600
        "
      >
        <BookOpen className="h-5 w-5" />
      </div>

      <div
        className="
          min-w-0
          flex-1
        "
      >
        <p
          className="
            truncate
            text-[11px]
            font-bold
            text-slate-800
          "
        >
          {exam.title}
        </p>

        <p
          className="
            mt-1
            text-[9px]
            text-slate-400
          "
        >
          {exam.className}
          {" • "}
          {exam.subject}
        </p>
      </div>

      <div
        className="
          shrink-0
          text-right
        "
      >
        <p
          className="
            text-[10px]
            font-semibold
            text-slate-700
          "
        >
          {exam.date}
        </p>

        <p
          className="
            mt-1
            text-[9px]
            text-teal-600
          "
        >
          {exam.startTime}
        </p>
      </div>
    </div>
  );
}


/* =========================================================
   QUICK ACTION
========================================================= */

function QuickAction({
  title,
  description,
  icon: Icon,
  type,
  href,
}) {
  const SafeIcon =
    Icon || FileText;

  const styles = {
    green:
      "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",

    blue:
      "bg-blue-50 text-blue-600 hover:bg-blue-100",

    violet:
      "bg-violet-50 text-violet-600 hover:bg-violet-100",

    amber:
      "bg-amber-50 text-amber-600 hover:bg-amber-100",
  };

  const body = (
    <>
      <div
        className="
          flex
          h-9
          w-9
          items-center
          justify-center
          rounded-xl
          bg-white/70
        "
      >
        <SafeIcon className="h-4 w-4" />
      </div>

      <div
        className="
          min-w-0
          flex-1
          text-left
        "
      >
        <p
          className="
            text-[10px]
            font-bold
          "
        >
          {title}
        </p>

        <p
          className="
            mt-0.5
            text-[8px]
            opacity-70
          "
        >
          {description}
        </p>
      </div>

      <ChevronRight className="h-4 w-4" />
    </>
  );


  const className = `
    flex
    w-full
    items-center
    gap-3
    rounded-xl
    p-3
    transition
    hover:-translate-y-0.5

    ${styles[type] || styles.green}
  `;


  if (href) {
    return (
      <Link
        href={href}
        className={
          className
        }
      >
        {body}
      </Link>
    );
  }


  return (
    <button
      type="button"
      className={
        className
      }
    >
      {body}
    </button>
  );
}


/* =========================================================
   MAIN PAGE
========================================================= */

export default function DigitalTeacherExamsPage() {
  const [
    exams,
  ] = useState(
    DEMO_EXAMS,
  );

  const [
    activeTab,
    setActiveTab,
  ] = useState("all");

  const [
    selectedClass,
    setSelectedClass,
  ] = useState("all");

  const [
    selectedSubject,
    setSelectedSubject,
  ] = useState("all");

  const [
    selectedResultStatus,
    setSelectedResultStatus,
  ] = useState("all");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const PAGE_SIZE = 5;


  /* =====================================================
     OPTIONS
  ===================================================== */

  const classOptions =
    useMemo(() => {
      return [
        ...new Set(
          exams
            .map(
              (exam) =>
                exam.className,
            )
            .filter(Boolean),
        ),
      ].sort(
        (a, b) =>
          Number(
            a.replace(
              /\D/g,
              "",
            ),
          ) -
          Number(
            b.replace(
              /\D/g,
              "",
            ),
          ),
      );
    }, [exams]);


  const subjectOptions =
    useMemo(() => {
      return [
        ...new Set(
          exams
            .map(
              (exam) =>
                exam.subject,
            )
            .filter(Boolean),
        ),
      ].sort();
    }, [exams]);


  /* =====================================================
     COUNTS
  ===================================================== */

  const totalExams =
    exams.length;

  const upcomingCount =
    exams.filter(
      (exam) =>
        exam.status ===
        "upcoming",
    ).length;

  const ongoingCount =
    exams.filter(
      (exam) =>
        exam.status ===
        "ongoing",
    ).length;

  const completedCount =
    exams.filter(
      (exam) =>
        exam.status ===
        "completed",
    ).length;


  /* =====================================================
     FILTER
  ===================================================== */

  const filteredExams =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      return exams.filter(
        (exam) => {
          /* STATUS TAB */

          if (
            activeTab !==
              "all" &&
            exam.status !==
              activeTab
          ) {
            return false;
          }


          /* CLASS */

          if (
            selectedClass !==
              "all" &&
            exam.className !==
              selectedClass
          ) {
            return false;
          }


          /* SUBJECT */

          if (
            selectedSubject !==
              "all" &&
            exam.subject !==
              selectedSubject
          ) {
            return false;
          }


          /* RESULT */

          if (
            selectedResultStatus !==
              "all" &&
            exam.resultStatus !==
              selectedResultStatus
          ) {
            return false;
          }


          /* SEARCH */

          if (text) {
            const searchable =
              [
                exam.title,
                exam.examName,
                exam.className,
                exam.subject,
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
      exams,
      activeTab,
      selectedClass,
      selectedSubject,
      selectedResultStatus,
      search,
    ]);


  /* =====================================================
     PAGINATION
  ===================================================== */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredExams.length /
          PAGE_SIZE,
      ),
    );


  const safePage =
    Math.min(
      currentPage,
      totalPages,
    );


  const startIndex =
    (safePage - 1) *
    PAGE_SIZE;


  const visibleExams =
    filteredExams.slice(
      startIndex,
      startIndex +
        PAGE_SIZE,
    );


  /* =====================================================
     TABS
  ===================================================== */

  const tabs = [
    {
      id: "all",
      label: "All Exams",
      count:
        totalExams,
      icon:
        GraduationCap,
    },

    {
      id: "upcoming",
      label: "Upcoming",
      count:
        upcomingCount,
      icon:
        CalendarDays,
    },

    {
      id: "ongoing",
      label: "Ongoing",
      count:
        ongoingCount,
      icon:
        Clock3,
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


  /* =====================================================
     UPCOMING SIDEBAR
  ===================================================== */

  const upcomingExams =
    exams
      .filter(
        (exam) =>
          exam.status ===
          "upcoming",
      )
      .slice(0, 4);


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
                bg-violet-100
                text-violet-600
              "
            >
              <GraduationCap className="h-6 w-6" />
            </div>

            <div>
              <h1
                className="
                  text-2xl
                  font-bold
                  text-slate-900
                "
              >
                Exams
              </h1>

              <p
                className="
                  mt-1
                  text-sm
                  text-slate-500
                "
              >
                View exams,
                manage student marks
                and monitor results
              </p>
            </div>
          </div>


          {/* =====================================
              SUMMARY
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
            <SummaryCard
              title="Total Exams"
              value={
                totalExams
              }
              description="Assigned exams"
              icon={
                GraduationCap
              }
              type="green"
            />

            <SummaryCard
              title="Upcoming"
              value={
                upcomingCount
              }
              description="Scheduled exams"
              icon={
                CalendarDays
              }
              type="blue"
            />

            <SummaryCard
              title="Ongoing"
              value={
                ongoingCount
              }
              description="Currently active"
              icon={Clock3}
              type="pink"
            />

            <SummaryCard
              title="Completed"
              value={
                completedCount
              }
              description="Finished exams"
              icon={
                Trophy
              }
              type="violet"
            />
          </div>


          {/* =====================================
              TABS
          ====================================== */}

          <div
            className="
              flex
              flex-wrap
              gap-2
            "
          >
            {tabs.map(
              (tab) => {
                const Icon =
                  tab.icon;

                const active =
                  activeTab ===
                  tab.id;

                return (
                  <button
                    type="button"
                    key={
                      tab.id
                    }
                    onClick={() => {
                      setActiveTab(
                        tab.id,
                      );

                      setCurrentPage(
                        1,
                      );
                    }}
                    className={`
                      inline-flex
                      items-center
                      gap-2
                      rounded-full
                      px-4
                      py-2
                      text-xs
                      font-semibold
                      transition

                      ${
                        active
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                          : "bg-white text-slate-600 hover:bg-slate-100"
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


          {/* =====================================
              CONTENT
          ====================================== */}

          <div
            className="
              grid
              grid-cols-1
              gap-5
              xl:grid-cols-[minmax(0,1fr)_340px]
            "
          >
            {/* LEFT */}

            <div className="space-y-3">
              {/* FILTERS */}

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
                    grid
                    grid-cols-1
                    gap-3
                    md:grid-cols-2
                    xl:grid-cols-[150px_160px_170px_minmax(250px,1fr)]
                  "
                >
                  {/* CLASS */}

                  <FilterSelect
                    label="Class"
                    value={
                      selectedClass
                    }
                    onChange={(
                      value,
                    ) => {
                      setSelectedClass(
                        value,
                      );

                      setCurrentPage(
                        1,
                      );
                    }}
                  >
                    <option value="all">
                      All Classes
                    </option>

                    {classOptions.map(
                      (
                        className,
                      ) => (
                        <option
                          key={
                            className
                          }
                          value={
                            className
                          }
                        >
                          {className}
                        </option>
                      ),
                    )}
                  </FilterSelect>


                  {/* SUBJECT */}

                  <FilterSelect
                    label="Subject"
                    value={
                      selectedSubject
                    }
                    onChange={(
                      value,
                    ) => {
                      setSelectedSubject(
                        value,
                      );

                      setCurrentPage(
                        1,
                      );
                    }}
                  >
                    <option value="all">
                      All Subjects
                    </option>

                    {subjectOptions.map(
                      (
                        subject,
                      ) => (
                        <option
                          key={
                            subject
                          }
                          value={
                            subject
                          }
                        >
                          {subject}
                        </option>
                      ),
                    )}
                  </FilterSelect>


                  {/* RESULT STATUS */}

                  <FilterSelect
                    label="Result Status"
                    value={
                      selectedResultStatus
                    }
                    onChange={(
                      value,
                    ) => {
                      setSelectedResultStatus(
                        value,
                      );

                      setCurrentPage(
                        1,
                      );
                    }}
                  >
                    <option value="all">
                      All Results
                    </option>

                    <option value="not_published">
                      Not Published
                    </option>

                    <option value="pending">
                      Pending
                    </option>

                    <option value="published">
                      Published
                    </option>
                  </FilterSelect>


                  {/* SEARCH */}

                  <div>
                    <label
                      className="
                        mb-1.5
                        block
                        text-[10px]
                        font-semibold
                        uppercase
                        tracking-wide
                        text-slate-500
                      "
                    >
                      Search
                    </label>

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
                        value={
                          search
                        }
                        onChange={(
                          event,
                        ) => {
                          setSearch(
                            event
                              .target
                              .value,
                          );

                          setCurrentPage(
                            1,
                          );
                        }}
                        placeholder="Search exam, subject or class..."
                        className="
                          h-10
                          w-full
                          rounded-lg
                          border
                          border-slate-200
                          bg-white
                          pl-9
                          pr-3
                          text-sm
                          text-slate-700
                          outline-none
                          placeholder:text-slate-400
                          focus:border-teal-400
                          focus:ring-2
                          focus:ring-teal-100
                        "
                      />
                    </div>
                  </div>
                </div>
              </div>


              {/* EXAM LIST */}

              <div
                className="
                  overflow-hidden
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  shadow-sm
                "
              >
                {visibleExams.length >
                0 ? (
                  visibleExams.map(
                    (exam) => (
                      <ExamRow
                        key={
                          exam.id
                        }
                        exam={
                          exam
                        }
                      />
                    ),
                  )
                ) : (
                  <div
                    className="
                      px-6
                      py-16
                      text-center
                    "
                  >
                    <GraduationCap
                      className="
                        mx-auto
                        h-9
                        w-9
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
                      No exams found
                    </p>

                    <p
                      className="
                        mt-1
                        text-xs
                        text-slate-400
                      "
                    >
                      Change your
                      class, subject or
                      status filter.
                    </p>
                  </div>
                )}


                {/* PAGINATION */}

                <div
                  className="
                    flex
                    flex-col
                    gap-3
                    border-t
                    border-slate-100
                    px-4
                    py-4
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                  "
                >
                  <p
                    className="
                      text-[10px]
                      text-slate-500
                    "
                  >
                    Showing{" "}
                    {filteredExams.length >
                    0
                      ? startIndex +
                        1
                      : 0}
                    {" "}
                    to{" "}
                    {Math.min(
                      startIndex +
                        PAGE_SIZE,
                      filteredExams.length,
                    )}
                    {" "}
                    of{" "}
                    {
                      filteredExams.length
                    }{" "}
                    exams
                  </p>


                  <div
                    className="
                      flex
                      items-center
                      gap-1
                    "
                  >
                    <button
                      type="button"
                      disabled={
                        safePage ===
                        1
                      }
                      onClick={() =>
                        setCurrentPage(
                          (
                            page,
                          ) =>
                            Math.max(
                              1,
                              page -
                                1,
                            ),
                        )
                      }
                      className="
                        flex
                        h-8
                        w-8
                        items-center
                        justify-center
                        rounded-lg
                        border
                        border-slate-200
                        bg-white
                        text-slate-500
                        disabled:opacity-40
                      "
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>


                    {Array.from({
                      length:
                        Math.min(
                          totalPages,
                          5,
                        ),
                    }).map(
                      (
                        _,
                        index,
                      ) => {
                        const page =
                          index +
                          1;

                        return (
                          <button
                            type="button"
                            key={
                              page
                            }
                            onClick={() =>
                              setCurrentPage(
                                page,
                              )
                            }
                            className={`
                              flex
                              h-8
                              min-w-8
                              items-center
                              justify-center
                              rounded-lg
                              px-2
                              text-xs
                              font-semibold

                              ${
                                safePage ===
                                page
                                  ? "bg-teal-500 text-white"
                                  : "border border-slate-200 bg-white text-slate-600"
                              }
                            `}
                          >
                            {page}
                          </button>
                        );
                      },
                    )}


                    <button
                      type="button"
                      disabled={
                        safePage ===
                        totalPages
                      }
                      onClick={() =>
                        setCurrentPage(
                          (
                            page,
                          ) =>
                            Math.min(
                              totalPages,
                              page +
                                1,
                            ),
                        )
                      }
                      className="
                        flex
                        h-8
                        w-8
                        items-center
                        justify-center
                        rounded-lg
                        border
                        border-slate-200
                        bg-white
                        text-slate-500
                        disabled:opacity-40
                      "
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>


            {/* =====================================
                RIGHT SIDE
            ====================================== */}

            <aside className="space-y-4">
              {/* UPCOMING EXAMS */}

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
                    mb-2
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
                    <CalendarDays className="h-5 w-5 text-teal-600" />

                    <h2
                      className="
                        text-sm
                        font-bold
                        text-slate-900
                      "
                    >
                      Upcoming Exams
                    </h2>
                  </div>

                  <span
                    className="
                      rounded-full
                      bg-teal-50
                      px-2
                      py-1
                      text-[9px]
                      font-semibold
                      text-teal-600
                    "
                  >
                    {
                      upcomingCount
                    }
                  </span>
                </div>


                {upcomingExams.map(
                  (exam) => (
                    <UpcomingExam
                      key={
                        exam.id
                      }
                      exam={
                        exam
                      }
                    />
                  ),
                )}
              </div>


              {/* MARK ENTRY PROGRESS */}

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
                    gap-2
                  "
                >
                  <FileCheck2 className="h-5 w-5 text-violet-600" />

                  <h2
                    className="
                      text-sm
                      font-bold
                      text-slate-900
                    "
                  >
                    Mark Entry
                  </h2>
                </div>


                <div className="mt-4 space-y-4">
                  {exams
                    .filter(
                      (exam) =>
                        exam.status ===
                          "completed" &&
                        exam.marksEntered <
                          exam.studentsCount,
                    )
                    .slice(
                      0,
                      3,
                    )
                    .map(
                      (exam) => {
                        const progress =
                          Math.round(
                            (
                              exam.marksEntered /
                              exam.studentsCount
                            ) *
                              100,
                          );

                        return (
                          <div
                            key={
                              exam.id
                            }
                          >
                            <div
                              className="
                                flex
                                items-center
                                justify-between
                                gap-2
                              "
                            >
                              <div className="min-w-0">
                                <p
                                  className="
                                    truncate
                                    text-[10px]
                                    font-semibold
                                    text-slate-700
                                  "
                                >
                                  {
                                    exam.title
                                  }
                                </p>

                                <p
                                  className="
                                    mt-0.5
                                    text-[8px]
                                    text-slate-400
                                  "
                                >
                                  {
                                    exam.className
                                  }
                                </p>
                              </div>

                              <span
                                className="
                                  text-[9px]
                                  font-bold
                                  text-violet-600
                                "
                              >
                                {progress}
                                %
                              </span>
                            </div>

                            <div
                              className="
                                mt-2
                                h-1.5
                                overflow-hidden
                                rounded-full
                                bg-slate-100
                              "
                            >
                              <div
                                style={{
                                  width:
                                    `${progress}%`,
                                }}
                                className="
                                  h-full
                                  rounded-full
                                  bg-violet-500
                                "
                              />
                            </div>
                          </div>
                        );
                      },
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
                  <Award className="h-5 w-5 text-amber-500" />

                  <h2
                    className="
                      text-sm
                      font-bold
                      text-slate-900
                    "
                  >
                    Quick Actions
                  </h2>
                </div>


                <div className="space-y-2">
                  <QuickAction
                    title="Enter Marks"
                    description="Add student exam marks"
                    icon={
                      FileCheck2
                    }
                    type="green"
                    href="/dashboard/digital-teacher/exams/marks"
                  />

                  <QuickAction
                    title="View Results"
                    description="Published exam results"
                    icon={Trophy}
                    type="blue"
                    href="/dashboard/digital-teacher/exams/results"
                  />

                  <QuickAction
                    title="Exam Timetable"
                    description="View exam schedules"
                    icon={
                      CalendarDays
                    }
                    type="violet"
                    href="/dashboard/digital-teacher/exams/timetable"
                  />

                  <QuickAction
                    title="Exam Report"
                    description="Student performance report"
                    icon={Award}
                    type="amber"
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