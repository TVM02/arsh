"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Layout from "@/components/digitalclassroom/Layout";
import useAuthStore from "@/lib/authStore";
import { toast } from "sonner";

import {
  getMyAssignedDigitalStudents,
  saveDigitalTeacherAttendance,
    getDigitalTeacherAttendance,
} from "@/lib/digitalClassTeacherService";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  RotateCcw,
  Save,
  Search,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";


function getTodayDate() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      now.getDate(),
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/* =========================================================
   STUDENT AVATAR
========================================================= */

function StudentAvatar({
  student,
}) {
  const [
    imageError,
    setImageError,
  ] = useState(false);

  const image =
    student?.profilePictureUrl ||
    student?.profilePicture ||
    student?.photoURL ||
    "";

  const initials =
    String(
      student?.name ||
        "Student",
    )
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part.charAt(0),
      )
      .join("")
      .toUpperCase();

  return (
    <div
      className="
        flex
        h-11
        w-11
        shrink-0
        items-center
        justify-center
        overflow-hidden
        rounded-full
        border-2
        border-white
        bg-gradient-to-br
        from-teal-100
        to-emerald-50
        shadow-sm
      "
    >
      {image &&
      !imageError ? (
        <img
          src={image}
          alt={
            student?.name ||
            "Student"
          }
          onError={() =>
            setImageError(true)
          }
          className="
            h-full
            w-full
            object-cover
          "
        />
      ) : (
        <span
          className="
            text-[11px]
            font-bold
            text-teal-700
          "
        >
          {initials || (
            <UserRound className="h-4 w-4" />
          )}
        </span>
      )}
    </div>
  );
}


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
    Icon || Users;

  const styles = {
    teal: {
      card:
        "border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50",
      icon:
        "bg-teal-100 text-teal-600",
    },

    green: {
      card:
        "border-emerald-100 bg-gradient-to-br from-emerald-50 to-green-50",
      icon:
        "bg-emerald-100 text-emerald-600",
    },

    red: {
      card:
        "border-red-100 bg-gradient-to-br from-red-50 to-rose-50",
      icon:
        "bg-red-100 text-red-500",
    },

    amber: {
      card:
        "border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50",
      icon:
        "bg-amber-100 text-amber-600",
    },
  };

  const current =
    styles[type] ||
    styles.teal;

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
            h-12
            w-12
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
   ATTENDANCE BUTTON
========================================================= */

function AttendanceButton({
  active,
  onClick,
  icon: Icon,
  label,
  type,
}) {
  const styles = {
    present: active
      ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-100"
      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",

    absent: active
      ? "border-red-500 bg-red-500 text-white shadow-md shadow-red-100"
      : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100",

    
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex
        h-9
        items-center
        justify-center
        gap-1.5
        rounded-lg
        border
        px-3
        text-[10px]
        font-semibold
        transition-all

        ${styles[type]}
      `}
    >
      <Icon className="h-3.5 w-3.5" />

      {label}
    </button>
  );
}


/* =========================================================
   MAIN PAGE
========================================================= */

export default function DigitalTeacherAttendancePage() {
const [students, setStudents] = useState([]);
const [studentsLoading, setStudentsLoading] = useState(true);

const { user } = useAuthStore();

  const [
    selectedClass,
    setSelectedClass,
  ] = useState("");

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    getTodayDate(),
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    attendance,
    setAttendance,
  ] = useState({});
const [
  savedAttendance,
  setSavedAttendance,
] = useState({});
  const [
    saving,
    setSaving,
  ] = useState(false);


  /* =====================================================
     CLASSES
  ===================================================== */

  const classOptions =
    useMemo(() => {
      return [
        ...new Set(
          students
            .map(
              (student) =>
                student.applyingclass,
            )
            .filter(Boolean),
        ),
      ].sort(
        (a, b) =>
          Number(
            String(a).replace(
              /\D/g,
              "",
            ),
          ) -
          Number(
            String(b).replace(
              /\D/g,
              "",
            ),
          ),
      );
    }, [students]);
useEffect(() => {
  if (
    !selectedClass &&
    classOptions.length > 0
  ) {
    setSelectedClass(
      String(classOptions[0])
    );
  }
}, [classOptions, selectedClass]);

useEffect(() => {
  let cancelled = false;

  const loadSavedAttendance =
    async () => {
      if (
        !user?.uid ||
        !selectedDate ||
        !selectedClass
      ) {
        if (!cancelled) {
          setSavedAttendance({});
        }

        return;
      }

      try {
        /*
         * Clear temporary selections whenever
         * date/class changes.
         */
        setAttendance({});

        const result =
          await getDigitalTeacherAttendance({
            date:
              selectedDate,

            className:
              selectedClass,
          });

        const records =
          result?.attendanceByStudent &&
          typeof result.attendanceByStudent ===
            "object"
            ? result.attendanceByStudent
            : {};

        if (!cancelled) {
          setSavedAttendance(
            records
          );
        }
      } catch (error) {
        console.error(
          "LOAD SAVED ATTENDANCE ERROR:",
          error
        );

        if (!cancelled) {
          setSavedAttendance(
            {}
          );

          toast.error(
            error?.message ||
              "Failed to load saved attendance."
          );
        }
      }
    };

  loadSavedAttendance();

  return () => {
    cancelled = true;
  };
}, [
  user?.uid,
  selectedDate,
  selectedClass,
]);

    useEffect(() => {
  let cancelled = false;

  const loadStudents = async () => {
    if (!user?.uid) {
      setStudentsLoading(false);
      return;
    }

    try {
      setStudentsLoading(true);

      const result = await getMyAssignedDigitalStudents();

      const assignedStudents = Array.isArray(result?.students)
        ? result.students
        : [];

      if (!cancelled) {
        setStudents(assignedStudents);
      }
    } catch (error) {
      console.error(
        "LOAD ATTENDANCE STUDENTS ERROR:",
        error
      );

      if (!cancelled) {
        toast.error(
          error?.message ||
            "Failed to load assigned Digital Students."
        );

        setStudents([]);
      }
    } finally {
      if (!cancelled) {
        setStudentsLoading(false);
      }
    }
  };

  loadStudents();

  return () => {
    cancelled = true;
  };
}, [user?.uid]);

  const classStudents =
    useMemo(() => {
      return students.filter(
        (student) =>
          selectedClass ===
            "all" ||
          student.applyingclass ===
            selectedClass,
      );
    }, [
      students,
      selectedClass,
    ]);


  /* =====================================================
     SEARCH
  ===================================================== */

  const filteredStudents =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      if (!text) {
        return classStudents;
      }

      return classStudents.filter(
        (student) => {
          const searchable =
            [
              student.name,
              student.digitalAdmissionNumber,
              student.madrasa,
              student.applyingclass,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return searchable.includes(
            text,
          );
        },
      );
    }, [
      classStudents,
      search,
    ]);


  /* =====================================================
     SET ATTENDANCE
  ===================================================== */

const setStudentAttendance =
  (
    studentId,
    status
  ) => {
    /*
     * Already saved in Firebase.
     * Do not allow second marking.
     */
    if (
      savedAttendance[
        studentId
      ]
    ) {
      toast.info(
        "Attendance is already marked for this student."
      );

      return;
    }

    setAttendance(
      (previous) => ({
        ...previous,

        [studentId]:
          status,
      })
    );
  };

  /* =====================================================
     MARK ALL PRESENT
  ===================================================== */

  const markAllPresent =
  () => {
    setAttendance(
      (previous) => {
        const next = {
          ...previous,
        };

        classStudents.forEach(
          (student) => {
            /*
             * Don't touch attendance
             * already saved in Firebase.
             */
            if (
              savedAttendance[
                student.id
              ]
            ) {
              return;
            }

            next[
              student.id
            ] = "present";
          }
        );

        return next;
      }
    );
  };


  /* =====================================================
     RESET
  ===================================================== */

  const resetAttendance =
    () => {
      setAttendance({});
    };


  /* =====================================================
     SUMMARY
  ===================================================== */

  const getStudentAttendanceStatus =
  (studentId) => {
    return (
      savedAttendance[
        studentId
      ]?.status ||
      attendance[
        studentId
      ] ||
      ""
    );
  };

const presentCount =
  classStudents.filter(
    (student) =>
      getStudentAttendanceStatus(
        student.id
      ) === "present"
  ).length;

const absentCount =
  classStudents.filter(
    (student) =>
      getStudentAttendanceStatus(
        student.id
      ) === "absent"
  ).length;

const lateCount =
  classStudents.filter(
    (student) =>
      getStudentAttendanceStatus(
        student.id
      ) === "late"
  ).length;

const markedCount =
  presentCount +
  absentCount +
  lateCount;

const unmarkedCount =
  Math.max(
    classStudents.length -
      markedCount,
    0
  );

const attendancePercentage =
  classStudents.length > 0
    ? Math.round(
        (presentCount /
          classStudents.length) *
          100
      )
    : 0;

  /* =====================================================
     SAVE
  ===================================================== */

const handleSaveAttendance =
  async () => {
    if (
      classStudents.length === 0
    ) {
      toast.error(
        "No students found in this class."
      );

      return;
    }

    if (!selectedDate) {
      toast.error(
        "Please select attendance date."
      );

      return;
    }

    if (!selectedClass) {
      toast.error(
        "Please select a class."
      );

      return;
    }

    /*
     * Students already saved in Firebase
     * must never be saved again.
     */
    const unsavedStudents =
      classStudents.filter(
        (student) =>
          !savedAttendance[
            student.id
          ]
      );

    if (
      unsavedStudents.length === 0
    ) {
      toast.info(
        "Attendance is already marked for all students."
      );

      return;
    }

    /*
     * Only check students that have
     * not already been saved.
     */
    const unmarkedUnsavedStudents =
      unsavedStudents.filter(
        (student) =>
          !attendance[
            student.id
          ]
      );

    if (
      unmarkedUnsavedStudents.length >
      0
    ) {
      toast.error(
        `Please mark attendance for all remaining students. ${unmarkedUnsavedStudents.length} student(s) are not marked.`
      );

      return;
    }

    setSaving(true);

    try {
      const attendanceRecords =
        unsavedStudents.map(
          (student) => ({
            studentId:
              student.id,

            studentName:
              student.name ||
              student.fullName ||
              student.studentName ||
              "",

            admissionNumber:
              student.digitalAdmissionNumber ||
              student.admissionNumber ||
              student.admissionNo ||
              "",

            status:
              attendance[
                student.id
              ],
          })
        );

      const result =
        await saveDigitalTeacherAttendance(
          {
            date:
              selectedDate,

            className:
              selectedClass,

            attendance:
              attendanceRecords,
          }
        );

      /*
       * Immediately lock successfully
       * saved students in the UI.
       */
      const newlySaved = {};

      unsavedStudents.forEach(
        (student) => {
          newlySaved[
            student.id
          ] = {
            studentId:
              student.id,

            studentName:
              student.name,

            status:
              attendance[
                student.id
              ],

            date:
              selectedDate,

            className:
              selectedClass,
          };
        }
      );

      setSavedAttendance(
        (previous) => ({
          ...previous,
          ...newlySaved,
        })
      );

      setAttendance({});

      toast.success(
        result?.message ||
          "Attendance saved successfully."
      );
    } catch (error) {
      console.error(
        "SAVE ATTENDANCE ERROR:",
        error
      );

      toast.error(
        error?.message ||
          "Failed to save attendance."
      );
    } finally {
      setSaving(false);
    }
  };


  return (
    <Layout>

      {studentsLoading && (
  <div className="flex min-h-[400px] items-center justify-center">
    <div className="text-center">
      <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-teal-100 border-t-teal-600" />

      <p className="mt-3 text-sm font-medium text-slate-500">
        Loading assigned students...
      </p>
    </div>
  </div>
)}{!studentsLoading && (
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
                <CheckCircle2 className="h-6 w-6" />
              </div>

              <div>
                <h1
                  className="
                    text-2xl
                    font-bold
                    text-slate-900
                  "
                >
                  Student Attendance
                </h1>

                <p
                  className="
                    mt-1
                    text-sm
                    text-slate-500
                  "
                >
                  Mark and manage
                  attendance for your
                  Digital Classroom
                  students
                </p>
              </div>
            </div>


            <button
              type="button"
              onClick={
                handleSaveAttendance
              }
              disabled={saving}
              className="
                inline-flex
                h-11
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-gradient-to-r
                from-emerald-500
                to-teal-600
                px-5
                text-sm
                font-semibold
                text-white
                shadow-lg
                shadow-teal-100
                transition
                hover:-translate-y-0.5
                hover:shadow-xl
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              <Save className="h-4 w-4" />

              {saving
                ? "Saving..."
                : "Save Attendance"}
            </button>
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
              title="Total Students"
              value={
                classStudents.length
              }
              description={
                selectedClass ===
                "all"
                  ? "All assigned classes"
                  : selectedClass
              }
              icon={Users}
              type="teal"
            />

            <SummaryCard
              title="Present"
              value={
                presentCount
              }
              description={`${attendancePercentage}% attendance`}
              icon={
                CheckCircle2
              }
              type="green"
            />

            <SummaryCard
              title="Absent"
              value={
                absentCount
              }
              description="Absent students"
              icon={XCircle}
              type="red"
            />

          
          </div>


          {/* =====================================
              FILTERS
          ====================================== */}

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
                xl:grid-cols-[180px_180px_minmax(260px,1fr)_auto]
              "
            >
              {/* CLASS */}

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
                  Class
                </label>

                <select
                  value={
                    selectedClass
                  }
                  onChange={(
                    event,
                  ) => {
                    setSelectedClass(
                      event.target
                        .value,
                    );

                    setAttendance({});
                  }}
                  className="
                    h-10
                    w-full
                    rounded-lg
                    border
                    border-slate-200
                    bg-white
                    px-3
                    text-sm
                    font-medium
                    text-slate-700
                    outline-none
                    focus:border-teal-400
                    focus:ring-2
                    focus:ring-teal-100
                  "
                >
                  

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
                       Class {className}
                      </option>
                    ),
                  )}
                </select>
              </div>


              {/* DATE */}

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
                  Attendance Date
                </label>

                <div className="relative">
                  <CalendarDays
                    className="
                      pointer-events-none
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
                    type="date"
                    value={
                      selectedDate
                    }
                    onChange={(
                      event,
                    ) => {
                      setSelectedDate(
                        event.target
                          .value,
                      );

                      setAttendance(
                        {},
                      );
                    }}
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
                      focus:border-teal-400
                      focus:ring-2
                      focus:ring-teal-100
                    "
                  />
                </div>
              </div>


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
                  Student Search
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
                    value={search}
                    onChange={(
                      event,
                    ) =>
                      setSearch(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Search student name or admission number..."
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


              {/* MARK ALL */}

              <div
                className="
                  flex
                  items-end
                "
              >
                <button
                  type="button"
                  onClick={
                    markAllPresent
                  }
                  className="
                    inline-flex
                    h-10
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-lg
                    border
                    border-emerald-200
                    bg-emerald-50
                    px-4
                    text-xs
                    font-semibold
                    text-emerald-700
                    transition
                    hover:bg-emerald-100
                    xl:w-auto
                  "
                >
                  <CheckCircle2 className="h-4 w-4" />

                  Mark All Present
                </button>
              </div>
            </div>
          </div>


          {/* =====================================
              PROGRESS
          ====================================== */}

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
                flex-wrap
                items-center
                justify-between
                gap-3
              "
            >
              <div>
                <p
                  className="
                    text-xs
                    font-semibold
                    text-slate-700
                  "
                >
                  Attendance Progress
                </p>

                <p
                  className="
                    mt-1
                    text-[10px]
                    text-slate-400
                  "
                >
                  {markedCount} of{" "}
                  {
                    classStudents.length
                  }{" "}
                  students marked
                </p>
              </div>

              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >
                <span
                  className="
                    text-xs
                    font-bold
                    text-teal-600
                  "
                >
                  {classStudents.length >
                  0
                    ? Math.round(
                        (markedCount /
                          classStudents.length) *
                          100,
                      )
                    : 0}
                  %
                </span>

                <button
                  type="button"
                  onClick={
                    resetAttendance
                  }
                  className="
                    inline-flex
                    items-center
                    gap-1
                    rounded-lg
                    px-2.5
                    py-1.5
                    text-[10px]
                    font-semibold
                    text-slate-500
                    hover:bg-slate-100
                  "
                >
                  <RotateCcw className="h-3.5 w-3.5" />

                  Reset
                </button>
              </div>
            </div>


            <div
              className="
                mt-3
                h-2
                overflow-hidden
                rounded-full
                bg-slate-100
              "
            >
              <div
                style={{
                  width:
                    classStudents.length >
                    0
                      ? `${
                          (markedCount /
                            classStudents.length) *
                          100
                        }%`
                      : "0%",
                }}
                className="
                  h-full
                  rounded-full
                  bg-gradient-to-r
                  from-emerald-500
                  to-teal-500
                  transition-all
                  duration-500
                "
              />
            </div>
          </div>


          {/* =====================================
              STUDENT TABLE
          ====================================== */}

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
            <div
              className="
                flex
                flex-wrap
                items-center
                justify-between
                gap-3
                border-b
                border-slate-100
                px-5
                py-4
              "
            >
              <div>
                <h2
                  className="
                    text-sm
                    font-bold
                    text-slate-900
                  "
                >
                  {selectedClass ===
                  "all"
                    ? "All Students"
                    : `${selectedClass} Students`}
                </h2>

                <p
                  className="
                    mt-1
                    text-[10px]
                    text-slate-400
                  "
                >
                  Attendance date:{" "}
                  {selectedDate}
                </p>
              </div>

              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-3
                  text-[9px]
                  font-medium
                "
              >
                <span
                  className="
                    flex
                    items-center
                    gap-1
                    text-emerald-600
                  "
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Present
                </span>

                <span
                  className="
                    flex
                    items-center
                    gap-1
                    text-red-500
                  "
                >
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Absent
                </span>

                
              </div>
            </div>


            <div className="overflow-x-auto">
              <table
                className="
                  w-full
                  min-w-[900px]
                "
              >
                <thead>
                  <tr
                    className="
                      bg-slate-50
                      text-left
                      text-[10px]
                      font-semibold
                      uppercase
                      tracking-wide
                      text-slate-500
                    "
                  >
                    <th className="px-4 py-3">
                      #
                    </th>

                    <th className="px-4 py-3">
                      Student
                    </th>

                    <th className="px-4 py-3">
                      Admission No
                    </th>

                    <th className="px-4 py-3">
                      Class
                    </th>

                    <th className="px-4 py-3">
                      Phone Number
                    </th>
                    <th className="px-4 py-3">
                      parents Name
                    </th>

                    <th className="px-4 py-3 text-center">
                      Attendance
                    </th>
                  </tr>
                </thead>


                <tbody>
                  {filteredStudents.map(
                    (
                      student,
                      index,
                    ) => {
                      const savedRecord =
  savedAttendance[
    student.id
  ];

const isSaved =
  Boolean(
    savedRecord
  );

const status =
  savedRecord?.status ||
  attendance[
    student.id
  ] ||
  "";

                      return (
                        <tr
                          key={
                            student.id
                          }
                          className={`
                            border-t
                            border-slate-100
                            transition

                            ${
                              status ===
                              "present"
                                ? "bg-emerald-50/20"
                                : status ===
                                  "absent"
                                ? "bg-red-50/20"
                                : "hover:bg-slate-50"
                            }
                          `}
                        >
                          <td
                            className="
                              px-4
                              py-3
                              text-xs
                              text-slate-400
                            "
                          >
                            {index +
                              1}
                          </td>


                          <td className="px-4 py-3">
                            <div
                              className="
                                flex
                                items-center
                                gap-3
                              "
                            >
                              <StudentAvatar
                                student={
                                  student
                                }
                              />

                              <div>
                                <p
                                  className="
                                    text-xs
                                    font-bold
                                    text-slate-900
                                  "
                                >
                                  {
                                    student.name
                                  }
                                </p>

                                <p
                                  className="
                                    mt-0.5
                                    text-[9px]
                                    text-slate-400
                                  "
                                >
                                  Digital Student
                                </p>
                              </div>
                            </div>
                          </td>


                          <td
                            className="
                              px-4
                              py-3
                              text-xs
                              font-medium
                              text-slate-600
                            "
                          >
                            {
                              student.digitalAdmissionNumber || "-"
                            }
                          </td>


                          <td className="px-4 py-3">
                            <span
                              className="
                                inline-flex
                                rounded-md
                                bg-blue-50
                                px-2.5
                                py-1
                                text-[10px]
                                font-semibold
                                text-blue-600
                              "
                            >
                              {
                                student.applyingclass
                              }
                            </span>
                          </td>


                          <td
                            className="
                              px-4
                              py-3
                              text-xs
                              text-slate-500
                            "
                          >
                            {
                              student.phone || "-"
                            }
                          </td>
                          <td
                            className="
                              px-4
                              py-3
                              text-xs
                              text-slate-500
                            "
                          >
                            {
                              student.guardianName || "NA"
                            }
                          </td>


                          <td className="px-4 py-3">
                           <div className="flex items-center justify-center">
                           {isSaved ? (
  <div
    className={`
      inline-flex
      h-10
      items-center
      gap-2
      rounded-xl
      px-4
      text-sm
      font-semibold
      ${
        status === "present"
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : status === "absent"
          ? "bg-red-50 text-red-700 ring-1 ring-red-200"
          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      }
    `}
  >
    {status ===
      "present" && (
      <CheckCircle2 className="h-4 w-4" />
    )}

    {status ===
      "absent" && (
      <XCircle className="h-4 w-4" />
    )}

    {status ===
      "late" && (
      <Clock3 className="h-4 w-4" />
    )}

    <span>
      {status === "present"
        ? "Present"
        : status === "absent"
        ? "Absent"
        : "Late"}

      {selectedDate ===
      getTodayDate()
        ? " Today"
        : ` • ${selectedDate}`}
    </span>
  </div>
) : (
  <div className="inline-flex
      h-10
      items-center
      gap-3
      rounded-xl
      px-4
      text-sm
      font-semibold
      ">
    <AttendanceButton
      active={
        status ===
        "present"
      }
      onClick={() =>
        setStudentAttendance(
          student.id,
          "present"
        )
      }
      icon={
        CheckCircle2
      }
      label="Present"
      type="present"
    />

    <AttendanceButton
      active={
        status ===
        "absent"
      }
      onClick={() =>
        setStudentAttendance(
          student.id,
          "absent"
        )
      }
      icon={
        XCircle
      }
      label="Absent"
      type="absent"
    />

   
  </div>
)}
</div>

                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>


            {filteredStudents.length ===
              0 && (
              <div
                className="
                  px-6
                  py-16
                  text-center
                "
              >
                <Users
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
                  No students found
                </p>

                <p
                  className="
                    mt-1
                    text-xs
                    text-slate-400
                  "
                >
                  Select another class
                  or change the search.
                </p>
              </div>
            )}
          </div>


          {/* =====================================
              BOTTOM SAVE
          ====================================== */}

          <div
            className="
              flex
              flex-col
              gap-3
              rounded-2xl
              border
              border-teal-100
              bg-gradient-to-r
              from-teal-50
              to-emerald-50
              p-4
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <div>
              <p
                className="
                  text-sm
                  font-bold
                  text-teal-900
                "
              >
                Ready to save attendance?
              </p>

              <p
                className="
                  mt-1
                  text-[10px]
                  text-teal-700
                "
              >
                {markedCount}/
                {
                  classStudents.length
                }{" "}
                students marked
                {unmarkedCount >
                  0 &&
                  ` • ${unmarkedCount} remaining`}
              </p>
            </div>


            <button
              type="button"
              onClick={
                handleSaveAttendance
              }
              disabled={
                saving ||
                classStudents.length ===
                  0
              }
              className="
                inline-flex
                h-11
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-gradient-to-r
                from-emerald-500
                to-teal-600
                px-6
                text-sm
                font-semibold
                text-white
                shadow-md
                transition
                hover:-translate-y-0.5
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              <Save className="h-4 w-4" />

              {saving
                ? "Saving..."
                : "Save Attendance"}
            </button>
          </div>
        </div>
      </div>
)}
    </Layout>
  );
}