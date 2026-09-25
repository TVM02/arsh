"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";

import Layout from "@/components/digitalclassroom/Layout";

import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Users,
} from "lucide-react";

import {
  MiniCalendar,
} from "@/components/digitalclassroom/dashborad";
import { StatCard,} from "@/components/digitalclassroom/tecaherstudent"
/* =========================================================
   DEMO ASSIGNMENTS
   Later replace with Firebase data
========================================================= */

const DEMO_ASSIGNMENTS = [
  {
    id: "ass-1",
    title:
      "Quran Memorization - Surah Al-Falaq",
    className: "Class 5",
    subject: "Quran",
    description:
      "Memorize Surah Al-Falaq and submit audio recitation.",
    dueDate: "25 Sep 2026",
    dueText: "2 days left",
    totalStudents: 22,
    submitted: 18,
    checked: 12,
    status: "pending",
    type: "assignment",
  },

  {
    id: "ass-2",
    title:
      "Tajweed Rules Worksheet",
    className: "Class 7",
    subject: "Tajweed",
    description:
      "Complete the Tajweed rules worksheet and upload.",
    dueDate: "23 Sep 2026",
    dueText: "Today",
    totalStudents: 20,
    submitted: 20,
    checked: 20,
    status: "checked",
    type: "worksheet",
  },

  {
    id: "ass-3",
    title:
      "Islamic History Essay",
    className: "Class 6",
    subject:
      "Islamic History",
    description:
      "Write a short essay on the life of Prophet Muhammad (PBUH).",
    dueDate: "28 Sep 2026",
    dueText: "5 days left",
    totalStudents: 18,
    submitted: 12,
    checked: 6,
    status: "pending",
    type: "essay",
  },

  {
    id: "ass-4",
    title:
      "Arabic Vocabulary Practice",
    className: "Class 5",
    subject: "Arabic",
    description:
      "Record and submit pronunciation of 20 Arabic words.",
    dueDate: "20 Sep 2026",
    dueText: "Overdue",
    totalStudents: 22,
    submitted: 22,
    checked: 22,
    status: "checked",
    type: "audio",
  },

  {
    id: "ass-5",
    title:
      "Fiqh Basics - Chapter Notes",
    className: "Class 8",
    subject: "Fiqh",
    description:
      "Read Chapter 1 and submit your notes.",
    dueDate: "26 Sep 2026",
    dueText: "3 days left",
    totalStudents: 16,
    submitted: 10,
    checked: 5,
    status: "pending",
    type: "notes",
  },

  {
    id: "ass-6",
    title:
      "Aqeedah Mind Map",
    className: "Class 6",
    subject: "Aqeedah",
    description:
      "Create a mind map of the main Aqeedah topics.",
    dueDate: "18 Sep 2026",
    dueText: "Overdue",
    totalStudents: 20,
    submitted: 15,
    checked: 7,
    status: "pending",
    type: "image",
  },

  {
    id: "ass-7",
    title:
      "Arabic Grammar Exercise",
    className: "Class 7",
    subject: "Arabic",
    description:
      "Complete the Arabic grammar exercise.",
    dueDate: "30 Sep 2026",
    dueText: "7 days left",
    totalStudents: 19,
    submitted: 9,
    checked: 2,
    status: "pending",
    type: "worksheet",
  },

  {
    id: "ass-8",
    title:
      "Hadith Memorization",
    className: "Class 8",
    subject: "Hadith",
    description:
      "Memorize and submit the selected Hadith.",
    dueDate: "01 Oct 2026",
    dueText: "8 days left",
    totalStudents: 18,
    submitted: 8,
    checked: 0,
    status: "pending",
    type: "assignment",
  },
];


/* =========================================================
   ASSIGNMENT TYPE STYLE
========================================================= */

function getAssignmentStyle(
  type,
) {
  const styles = {
    assignment: {
      bg:
        "bg-gradient-to-br from-pink-50 to-rose-50",
      icon:
        "bg-pink-500 text-white",
    },

    worksheet: {
      bg:
        "bg-gradient-to-br from-blue-50 to-sky-50",
      icon:
        "bg-blue-500 text-white",
    },

    essay: {
      bg:
        "bg-gradient-to-br from-violet-50 to-purple-50",
      icon:
        "bg-violet-500 text-white",
    },

    audio: {
      bg:
        "bg-gradient-to-br from-emerald-50 to-teal-50",
      icon:
        "bg-emerald-500 text-white",
    },

    notes: {
      bg:
        "bg-gradient-to-br from-amber-50 to-orange-50",
      icon:
        "bg-amber-500 text-white",
    },

    image: {
      bg:
        "bg-gradient-to-br from-violet-50 to-fuchsia-50",
      icon:
        "bg-violet-500 text-white",
    },
  };

  return (
    styles[type] ||
    styles.assignment
  );
}



/* =========================================================
   ASSIGNMENT ROW
========================================================= */

function AssignmentRow({
  assignment,
}) {
  const style =
    getAssignmentStyle(
      assignment.type,
    );

  const isChecked =
    assignment.status ===
    "checked";

  const overdue =
    assignment.dueText ===
    "Overdue";

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
          className={`
            flex
            h-[58px]
            w-[58px]
            shrink-0
            items-center
            justify-center
            rounded-xl

            ${style.bg}
          `}
        >
          <div
            className={`
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              shadow-sm

              ${style.icon}
            `}
          >
            <ClipboardList className="h-5 w-5" />
          </div>
        </div>


        {/* DETAILS */}

        <div
          className="
            min-w-0
            flex-1
          "
        >
          <h3
            className="
              text-sm
              font-bold
              text-slate-900
            "
          >
            {assignment.title}
          </h3>

          <div
            className="
              mt-1
              flex
              flex-wrap
              items-center
              gap-2
              text-[10px]
              text-slate-500
            "
          >
            <span>
              {assignment.className}
            </span>

            <span className="text-slate-300">
              •
            </span>

            <span>
              {assignment.subject}
            </span>
          </div>

          <p
            className="
              mt-1.5
              text-[10px]
              leading-4
              text-slate-500
            "
          >
            {assignment.description}
          </p>
        </div>


        {/* DUE + SUBMISSIONS */}

        <div
          className="
            min-w-[180px]
            space-y-2
            text-[10px]
          "
        >
          <div
            className="
              flex
              items-start
              gap-2
              text-slate-500
            "
          >
            <CalendarDays className="mt-0.5 h-4 w-4 text-slate-400" />

            <div>
              <p>
                Due:{" "}
                {
                  assignment.dueDate
                }
              </p>

              <p
                className={
                  overdue ||
                  assignment.dueText ===
                    "Today"
                    ? "font-semibold text-red-500"
                    : "font-medium text-slate-500"
                }
              >
                {
                  assignment.dueText
                }
              </p>
            </div>
          </div>

          <div
            className="
              flex
              items-center
              gap-2
              text-slate-500
            "
          >
            <Users className="h-4 w-4 text-slate-400" />

            <span>
              {
                assignment.submitted
              }
              /
              {
                assignment.totalStudents
              }{" "}
              submitted
            </span>
          </div>
        </div>


        {/* STATUS */}

        <div className="min-w-[90px]">
          <span
            className={`
              inline-flex
              min-w-[78px]
              items-center
              justify-center
              rounded-full
              px-3
              py-1.5
              text-[10px]
              font-semibold

              ${
                isChecked
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }
            `}
          >
            {isChecked
              ? "Checked"
              : "Pending"}
          </span>
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
            href={`/dashboard/digital-teacher/assignments/${assignment.id}`}
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
            title="View Assignment"
          >
            <Eye className="h-4 w-4" />
          </Link>


          {/* CHECK / MARK */}

          <Link
            href={`/dashboard/digital-teacher/assignments/${assignment.id}/submissions`}
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              border
              border-violet-100
              bg-violet-50
              text-violet-600
              transition
              hover:bg-violet-100
            "
            title="Check & Mark Assignment"
          >
            <BarChart3 className="h-4 w-4" />
          </Link>


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
   UPCOMING DEADLINE
========================================================= */

function DeadlineItem({
  assignment,
}) {
  const style =
    getAssignmentStyle(
      assignment.type,
    );

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
        className={`
          flex
          h-10
          w-10
          shrink-0
          items-center
          justify-center
          rounded-xl

          ${style.bg}
        `}
      >
        <ClipboardList
          className="
            h-5
            w-5
            text-rose-500
          "
        />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="
            truncate
            text-[11px]
            font-bold
            text-slate-800
          "
        >
          {assignment.title}
        </p>

        <p
          className="
            mt-1
            text-[9px]
            text-slate-400
          "
        >
          {assignment.className}
          {" • "}
          {assignment.submitted}/
          {
            assignment.totalStudents
          }{" "}
          submitted
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
          {assignment.dueDate}
        </p>

        <p
          className={`
            mt-1
            text-[9px]

            ${
              assignment.dueText ===
                "Overdue" ||
              assignment.dueText ===
                "Today"
                ? "font-semibold text-red-500"
                : "text-red-400"
            }
          `}
        >
          {assignment.dueText}
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
  icon: Icon,
  type,
  href,
}) {
  const SafeIcon =
    Icon ||
    ClipboardList;

  const styles = {
    green:
      "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",

    blue:
      "bg-blue-50 text-blue-600 hover:bg-blue-100",

    violet:
      "bg-violet-50 text-violet-600 hover:bg-violet-100",

    pink:
      "bg-pink-50 text-pink-600 hover:bg-pink-100",
  };

  const classes = `
    flex
    min-h-[92px]
    flex-col
    items-center
    justify-center
    gap-2
    rounded-xl
    p-3
    text-center
    transition
    hover:-translate-y-0.5

    ${styles[type] || styles.green}
  `;

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
      >
        <SafeIcon className="h-5 w-5" />

        <span
          className="
            text-[9px]
            font-semibold
          "
        >
          {title}
        </span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classes}
    >
      <SafeIcon className="h-5 w-5" />

      <span
        className="
          text-[9px]
          font-semibold
        "
      >
        {title}
      </span>
    </button>
  );
}


/* =========================================================
   MAIN PAGE
========================================================= */

export default function DigitalTeacherAssignmentsPage() {
  const [
    assignments,
  ] = useState(
    DEMO_ASSIGNMENTS,
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
    selectedStatus,
    setSelectedStatus,
  ] = useState("all");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    sortBy,
    setSortBy,
  ] = useState("recent");

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const PAGE_SIZE = 6;


  /* =====================================================
     FILTER OPTIONS
  ===================================================== */

  const classOptions =
    useMemo(() => {
      return [
        ...new Set(
          assignments.map(
            (item) =>
              item.className,
          ),
        ),
      ].sort(
        (a, b) => {
          const aNo =
            Number(
              a.replace(
                /\D/g,
                "",
              ),
            );

          const bNo =
            Number(
              b.replace(
                /\D/g,
                "",
              ),
            );

          return aNo - bNo;
        },
      );
    }, [assignments]);


  const subjectOptions =
    useMemo(() => {
      return [
        ...new Set(
          assignments.map(
            (item) =>
              item.subject,
          ),
        ),
      ].sort();
    }, [assignments]);


  /* =====================================================
     COUNTS
  ===================================================== */

  const totalAssignments =
    assignments.length;

  const totalSubmitted =
    assignments.reduce(
      (total, item) =>
        total +
        item.submitted,
      0,
    );

  const totalChecked =
    assignments.reduce(
      (total, item) =>
        total +
        item.checked,
      0,
    );

  const pendingSubmissions =
    Math.max(
      totalSubmitted -
        totalChecked,
      0,
    );


  /* =====================================================
     FILTER
  ===================================================== */

  const filteredAssignments =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      let list =
        assignments.filter(
          (assignment) => {
            /* TAB */

            if (
              activeTab ===
                "pending" &&
              assignment.status !==
                "pending"
            ) {
              return false;
            }

            if (
              activeTab ===
                "checked" &&
              assignment.status !==
                "checked"
            ) {
              return false;
            }

            if (
              activeTab ===
                "submitted" &&
              assignment.submitted <=
                0
            ) {
              return false;
            }


            /* CLASS */

            if (
              selectedClass !==
                "all" &&
              assignment.className !==
                selectedClass
            ) {
              return false;
            }


            /* SUBJECT */

            if (
              selectedSubject !==
                "all" &&
              assignment.subject !==
                selectedSubject
            ) {
              return false;
            }


            /* STATUS */

            if (
              selectedStatus !==
                "all" &&
              assignment.status !==
                selectedStatus
            ) {
              return false;
            }


            /* SEARCH */

            if (text) {
              const searchable =
                [
                  assignment.title,
                  assignment.className,
                  assignment.subject,
                  assignment.description,
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


      if (
        sortBy ===
        "title"
      ) {
        list = [
          ...list,
        ].sort((a, b) =>
          a.title.localeCompare(
            b.title,
          ),
        );
      }

      if (
        sortBy ===
        "submission"
      ) {
        list = [
          ...list,
        ].sort(
          (a, b) =>
            b.submitted -
            a.submitted,
        );
      }

      return list;
    }, [
      assignments,
      activeTab,
      selectedClass,
      selectedSubject,
      selectedStatus,
      search,
      sortBy,
    ]);


  /* =====================================================
     PAGINATION
  ===================================================== */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredAssignments.length /
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

  const visibleAssignments =
    filteredAssignments.slice(
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
      label:
        "All Assignments",
      count:
        totalAssignments,
      icon:
        ClipboardList,
    },

    {
      id: "pending",
      label: "Pending",
      count:
        pendingSubmissions,
      icon: Clock3,
    },

    {
      id: "submitted",
      label: "Submitted",
      count:
        totalSubmitted,
      icon: Send,
    },

    {
      id: "checked",
      label: "Checked",
      count:
        totalChecked,
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
                <ClipboardList className="h-6 w-6" />
              </div>

              <div>
                <h1
                  className="
                    text-2xl
                    font-bold
                    text-slate-900
                  "
                >
                  Assignments
                </h1>

                <p
                  className="
                    mt-1
                    text-sm
                    text-slate-500
                  "
                >
                  Create, manage and
                  check student
                  assignments
                </p>
              </div>
            </div>


            <Link
              href="/dashboard/digital-teacher/assignments/create"
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

              Create Assignment
            </Link>
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
            <StatCard
              title="Total Assignments"
              value={
                totalAssignments
              }
              description="All time"
              icon={
                ClipboardList
              }
              type="green"
            />

            <StatCard
              title="Submitted"
              value={
                totalSubmitted
              }
              description="Student submissions"
              icon={Users}
              type="blue"
            />

            <StatCard
              title="Pending"
              value={
                pendingSubmissions
              }
              description="Need checking"
              icon={Clock3}
              type="pink"
            />

            <StatCard
              title="Checked"
              value={
                totalChecked
              }
              description="Marked submissions"
              icon={
                CheckCircle2
              }
              type="violet"
            />
          </div>


          {/* =====================================
              TABS + SORT
          ====================================== */}

          <div
            className="
              flex
              flex-col
              gap-3
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >
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
                      <Icon className="h-3.5 w-3.5" />

                      {tab.label}

                      <span>
                        ({tab.count})
                      </span>
                    </button>
                  );
                },
              )}
            </div>


            <select
              value={sortBy}
              onChange={(
                event,
              ) =>
                setSortBy(
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
              "
            >
              <option value="recent">
                Recently Created
              </option>

              <option value="title">
                Title A-Z
              </option>

              <option value="submission">
                Most Submitted
              </option>
            </select>
          </div>


          {/* =====================================
              MAIN CONTENT
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
                  p-3
                  shadow-sm
                "
              >
                <div
                  className="
                    grid
                    grid-cols-1
                    gap-3
                    md:grid-cols-2
                    xl:grid-cols-[150px_160px_150px_minmax(250px,1fr)]
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


                  {/* STATUS */}

                  <FilterSelect
                    label="Status"
                    value={
                      selectedStatus
                    }
                    onChange={(
                      value,
                    ) => {
                      setSelectedStatus(
                        value,
                      );

                      setCurrentPage(
                        1,
                      );
                    }}
                  >
                    <option value="all">
                      All Status
                    </option>

                    <option value="pending">
                      Pending
                    </option>

                    <option value="checked">
                      Checked
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
                        placeholder="Search by title, subject, class..."
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


              {/* ASSIGNMENTS LIST */}

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
                {visibleAssignments.length >
                0 ? (
                  visibleAssignments.map(
                    (
                      assignment,
                    ) => (
                      <AssignmentRow
                        key={
                          assignment.id
                        }
                        assignment={
                          assignment
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
                    <ClipboardList
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
                      No assignments found
                    </p>

                    <p
                      className="
                        mt-1
                        text-xs
                        text-slate-400
                      "
                    >
                      Try another filter
                      or create a new
                      assignment.
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
                    {filteredAssignments.length >
                    0
                      ? startIndex +
                        1
                      : 0}{" "}
                    to{" "}
                    {Math.min(
                      startIndex +
                        PAGE_SIZE,
                      filteredAssignments.length,
                    )}{" "}
                    of{" "}
                    {
                      filteredAssignments.length
                    }{" "}
                    assignments
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
                        safePage === 1
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
                      Upcoming Deadlines
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

                {assignments
                  .filter(
                    (item) =>
                      item.status ===
                      "pending",
                  )
                  .slice(
                    0,
                    3,
                  )
                  .map(
                    (
                      assignment,
                    ) => (
                      <DeadlineItem
                        key={
                          assignment.id
                        }
                        assignment={
                          assignment
                        }
                      />
                    ),
                  )}
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
                  <ClipboardList className="h-5 w-5 text-emerald-600" />

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
                    grid-cols-2
                    gap-2
                    sm:grid-cols-4
                    xl:grid-cols-4
                  "
                >
                  <QuickAction
                    title="Create Assignment"
                    icon={
                      ClipboardList
                    }
                    type="green"
                    href="/dashboard/digital-teacher/assignments/create"
                  />

                  <QuickAction
                    title="View Submissions"
                    icon={Users}
                    type="blue"
                  />

                  <QuickAction
                    title="Check Assignments"
                    icon={
                      FileCheck2
                    }
                    type="violet"
                  />

                  <QuickAction
                    title="Export Report"
                    icon={Download}
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