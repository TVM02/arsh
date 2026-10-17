"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import useAuthStore from "@/lib/authStore";
import { toast } from "sonner";
import {
  scheduleDigitalLiveClass,
  getMyDigitalLiveClasses,
    getMyAssignedDigitalStudents,
     deleteDigitalLiveClass,
     updateDigitalLiveClass,
     joinDigitalLiveClass,
     getDigitalTeacherClassSubjects,
} from "@/lib/digitalClassTeacherService";
import Layout from "@/components/digitalclassroom/Layout";
import {StatCard, TodayClassRow, LiveClassCard, getLiveClassStatus} from "@/components/digitalclassroom/tecaherstudent"
import {
  CalendarDays,
  CheckCircle2,
   Play,
  Plus,
  Radio,
  Search,
  Video,
  Trash2,
} from "lucide-react";
import {
  MiniCalendar,
} from "@/components/digitalclassroom/dashborad";









export default function DigitalTeacherLiveClassesPage() {
const [ classes, setClasses,] = useState([]);
const [
  classesLoading,
  setClassesLoading,
] = useState(true);
const [
  currentTime,
  setCurrentTime,
] = useState(Date.now());
   const [
  scheduling,
  setScheduling,
] = useState(false);
  const [
  showScheduleForm,
  setShowScheduleForm,
] = useState(false);
const [
  assignedStudents,
  setAssignedStudents,
] = useState([]);
const [
  editingClass,
  setEditingClass,
] = useState(null);
const [
  joiningClassId,
  setJoiningClassId,
] = useState(null);


const [
  classForm,
  setClassForm,
] = useState({
  title: "",
  subject: "",
  className: "",
  date: "",
  startTime: "",
  endTime: "",
  description: "",
});

const [classSubjects, setClassSubjects] =
  useState([]);

const [classSubjectsLoading, setClassSubjectsLoading] =
  useState(false);

const [classSubjectsError, setClassSubjectsError] =
  useState("");
const { user, userData } = useAuthStore();

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


  const classesWithStatus =
  useMemo(() => {
    return classes.map(
      (item) => {
        const status =
          getLiveClassStatus(
            item
          );

        return {
          ...item,

          status,

          statusText:
            status ===
            "ongoing"
              ? "Live Now"
              : status ===
                  "completed"
                ? "Completed"
                : "Scheduled",
        };
      }
    );
  }, [
    classes,
    currentTime,
  ]);
const [
  deleteClass,
  setDeleteClass,
] = useState(null);

const [
  deletingClassId,
  setDeletingClassId,
] = useState(null);

  const totalClasses =
   classesWithStatus.length;

  const upcomingCount =
   classesWithStatus.filter(
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





const handleClassFormChange = (event) => {
  const { name, value } = event.target;

  setClassForm((previous) => ({
    ...previous,
    [name]: value,

    // Clear the previous subject when
    // the selected class changes.
    ...(name === "className"
      ? { subject: "" }
      : {}),
  }));

  if (name === "className") {
    setClassSubjects([]);
    setClassSubjectsError("");
  }
};



  const filteredClasses =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      return classesWithStatus.filter(
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
      classesWithStatus,
      activeTab,
      search,
    ]);




useEffect(() => {
  const loadAssignedStudents =
    async () => {
      if (!user?.uid) {
        return;
      }

      try {
        const result =
          await getMyAssignedDigitalStudents();

        setAssignedStudents(
          Array.isArray(result?.students)
            ? result.students
            : []
        );
      } catch (error) {
        console.error(
          "LOAD ASSIGNED STUDENTS ERROR:",
          error
        );
      }
    };

  loadAssignedStudents();
}, [user?.uid]);
const getClassStudentCount =
  (className) => {
    const normalizeClass =
      (value) =>
        String(value || "")
          .toLowerCase()
          .replace(/^class\s*/i, "")
          .trim();

    return assignedStudents.filter(
      (student) =>
        normalizeClass(
          student.applyingclass
        ) ===
        normalizeClass(
          className
        )
    ).length;
  };

const handleJoinClass = async (classItem) => {
  if (!classItem?.id) {
    toast.error("Live Class ID is missing.");
    return;
  }

  const popupWidth = 1280;
  const popupHeight = 820;

  const left = Math.max(
    0,
    Math.round(
      window.screenX +
        (window.outerWidth - popupWidth) / 2
    )
  );

  const top = Math.max(
    0,
    Math.round(
      window.screenY +
        (window.outerHeight - popupHeight) / 2
    )
  );

  const meetWindow = window.open(
    "",
    "dkju-teacher-live-class",
    `
      popup=yes,
      width=${popupWidth},
      height=${popupHeight},
      left=${left},
      top=${top},
      resizable=yes,
      scrollbars=yes
    `.replace(/\s+/g, "")
  );

  if (!meetWindow) {
    toast.error(
      "Please allow pop-ups for DKJU."
    );
    return;
  }

  try {
    setJoiningClassId(classItem.id);

    meetWindow.document.title =
      "DKJU Live Class";

    meetWindow.document.body.innerHTML = `
      <div style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#0f172a;
        color:white;
        font-family:Arial,sans-serif;
      ">
        <div style="
          text-align:center;
          padding:40px;
        ">
          <h2>DKJU Digital Classroom</h2>
          <p>Verifying and connecting to Google Meet...</p>
        </div>
      </div>
    `;

    const result =
      await joinDigitalLiveClass(
        classItem.id
      );

    if (!result?.joinUrl) {
      throw new Error(
        "Google Meet room is unavailable."
      );
    }

    try {
      meetWindow.opener = null;
    } catch {}

    meetWindow.location.replace(
      result.joinUrl
    );
  } catch (error) {
    console.error(
      "TEACHER JOIN LIVE CLASS ERROR:",
      error
    );

    try {
      meetWindow.close();
    } catch {}

    toast.error(
      error?.message ||
        "Unable to join Live Class."
    );
  } finally {
    setJoiningClassId(null);
  }
};



  const handleDeleteClass =
  async () => {
    if (!deleteClass?.id) {
      toast.error(
        "Live Class ID is missing."
      );

      return;
    }

    setDeletingClassId(
      deleteClass.id
    );

    try {
      const result =
        await deleteDigitalLiveClass(
          deleteClass.id
        );

      setClasses(
        (previous) =>
          previous.filter(
            (item) =>
              item.id !==
              deleteClass.id
          )
      );

      toast.success(
        result?.message ||
          "Live Class deleted successfully."
      );

      setDeleteClass(null);
    } catch (error) {
      console.error(
        "DELETE LIVE CLASS ERROR:",
        error
      );

      toast.error(
        error?.message ||
          "Unable to delete Live Class."
      );
    } finally {
      setDeletingClassId(null);
    }
  };

const handleEditClass =
  (classItem) => {
    if (!classItem?.id) {
      toast.error(
        "Live Class ID is missing."
      );

      return;
    }

    setEditingClass(
      classItem
    );

    setClassForm({
  title:
    classItem.title ||
    "",

  subject:
    classItem.subject ||
    "",

  className:
    classItem.className ||
    "",

  date:
    classItem.date ||
    "",

  startTime:
    classItem.startTime ||
    classItem.time ||
    "",

  endTime:
    classItem.endTime ||
    "",

  description:
    classItem.description ||
    "",
});

    setShowScheduleForm(
      true
    );
  };




  /* =====================================================
     TODAY
  ===================================================== */

  const todayDate = (() => {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
})();

const todaysClasses =
  classesWithStatus
    .filter(
      (item) =>
        item.date === todayDate
    )
    .sort((a, b) =>
      String(
        a.startTime ||
        a.time ||
        ""
      ).localeCompare(
        String(
          b.startTime ||
          b.time ||
          ""
        )
      )
    )
    .slice(0, 3);

useEffect(() => {
  let active = true;

  const loadLiveClasses =
    async () => {
      if (!user?.uid) {
        return;
      }

      setClassesLoading(true);

      try {
        const result =
          await getMyDigitalLiveClasses();

        if (!active) {
          return;
        }

        const liveClasses =
          Array.isArray(
            result?.classes
          )
            ? result.classes
            : [];

        const formattedClasses =
          liveClasses.map(
            (item) => ({
              ...item,

              id:
                item.id,

              time:
                item.startTime ||
                "",

              endTime:
                item.endTime ||
                "",

              dateLabel:
                item.date ||
                "",

              studentsCount:
  getClassStudentCount(
    item.className
  ),

              status:
                item.status ||
                "upcoming",

              statusText:
                item.status ===
                "ongoing"
                  ? "Live Now"
                  : item.status ===
                      "completed"
                    ? "Completed"
                    : "Scheduled",

              iconType:
                "video",

              students: [],
            })
          );

        setClasses(
          formattedClasses
        );
      } catch (error) {
        console.error(
          "LOAD LIVE CLASSES ERROR:",
          error
        );

        if (active) {
          toast.error(
            error?.message ||
              "Failed to load Live Classes."
          );
        }
      } finally {
        if (active) {
          setClassesLoading(
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
  const timer =
    setInterval(() => {
      setCurrentTime(
        Date.now()
      );
    }, 30000);

  return () => {
    clearInterval(timer);
  };
}, []);

const handleScheduleClass =
  async (event) => {

    event.preventDefault();


    /* =========================================
       REQUIRED FIELDS
    ========================================= */

    if (
      !classForm.title ||
      !classForm.subject ||
      !classForm.className ||
      !classForm.date ||
      !classForm.startTime ||
      !classForm.endTime
    ) {

      toast.error(
        "Please fill all required fields."
      );

      return;
    }


  
/* =========================================
   VALIDATE CLASS-WISE SUBJECT
========================================= */

if (
  !assignedClasses.includes(
    classForm.className
  )
) {
  toast.error(
    "This class is not assigned to you."
  );
  return;
}

if (classSubjectsLoading) {
  toast.error(
    "Please wait for class subjects to load."
  );
  return;
}

if (classSubjectsError) {
  toast.error(classSubjectsError);
  return;
}

if (
  !classSubjects.includes(
    classForm.subject
  )
) {
  toast.error(
    `The selected subject is not available for ${classForm.className}.`
  );
  return;
}


    if (
      classForm.endTime <=
      classForm.startTime
    ) {

      toast.error(
        "End time must be after start time."
      );

      return;
    }


    setScheduling(
      true
    );


    try {

      /* =======================================
         NO GOOGLE MEET LINK SENT

         Backend automatically resolves:
         teacherUid + className
      ======================================= */

      const payload = {

        title:
          classForm.title,

        subject:
          classForm.subject,

        className:
          classForm.className,

        date:
          classForm.date,

        startTime:
          classForm.startTime,

        endTime:
          classForm.endTime,

        description:
          classForm.description,
      };


      let result;


      /* =======================================
         EDIT
      ======================================= */

      if (
        editingClass?.id
      ) {

        result =
          await updateDigitalLiveClass({

            classId:
              editingClass.id,

            ...payload,
          });


        const updatedClass =
          result?.liveClass;


        if (
          updatedClass?.id
        ) {

          setClasses(
            (previous) =>
              previous.map(
                (item) =>
                  item.id ===
                  updatedClass.id
                    ? {
                        ...item,

                        ...updatedClass,

                        time:
                          updatedClass.startTime,

                        dateLabel:
                          updatedClass.date,

                        iconType:
                          "video",
                      }
                    : item
              )
          );
        }


        toast.success(
          result?.message ||
          "Live Class updated successfully."
        );

      }


      /* =======================================
         CREATE
      ======================================= */

      else {

        result =
          await scheduleDigitalLiveClass(
            payload
          );


        const createdClass =
          result?.liveClass;


        if (
          createdClass?.id
        ) {

          setClasses(
            (previous) => [

              {
                ...createdClass,

                time:
                  createdClass.startTime,

                dateLabel:
                  createdClass.date,

                status:
                  createdClass.status ||
                  "upcoming",

                statusText:
                  "Scheduled",

                iconType:
                  "video",

                students: [],
              },

              ...previous,
            ]
          );
        }


        toast.success(
          result?.message ||
          "Live Class scheduled successfully."
        );
      }


      /* =======================================
         RESET
      ======================================= */

      setClassForm({
        title: "",
        subject: "",
        className: "",
        date: "",
        startTime: "",
        endTime: "",
        description: "",
      });


      setEditingClass(
        null
      );


      setShowScheduleForm(
        false
      );

    } catch (error) {

      console.error(
        editingClass
          ? "UPDATE LIVE CLASS ERROR:"
          : "SCHEDULE LIVE CLASS ERROR:",
        error
      );


      toast.error(
        error?.message ||
        (
          editingClass
            ? "Failed to update Live Class."
            : "Failed to schedule Live Class."
        )
      );

    } finally {

      setScheduling(
        false
      );
    }
  };

  const assignedClasses = useMemo(() => {
    const classes =
      userData?.digitalTeachingAssignment?.classes;
  
    if (!Array.isArray(classes)) {
      return [];
    }
  
    return [...new Set(classes)]
      .filter(Boolean)
      .sort((a, b) => {
        const classA = Number(
          String(a).replace(/\D/g, ""),
        );
  
        const classB = Number(
          String(b).replace(/\D/g, ""),
        );
  
        return classA - classB;
      });
  }, [userData]);
  
  
useEffect(() => {
  let cancelled = false;

  const loadClassSubjects = async () => {
    const selectedClass = classForm.className;

    setClassSubjects([]);
    setClassSubjectsError("");


    if (
      !showScheduleForm ||
      !user?.uid ||
      !selectedClass ||
      !assignedClasses.includes(selectedClass)
    ) {
      setClassSubjectsLoading(false);
      return;
    }

    /* ========================================
       FETCH CLASS SUBJECTS FROM FIREBASE
    ======================================== */

    try {
      setClassSubjectsLoading(true);

      const subjects =
        await getDigitalTeacherClassSubjects(
          selectedClass
        );

      if (cancelled) return;

      const cleanSubjects = [
        ...new Set(
          (Array.isArray(subjects)
            ? subjects
            : []
          )
            .filter(
              (subject) =>
                typeof subject === "string"
            )
            .map((subject) => subject.trim())
            .filter(Boolean)
        ),
      ].sort((a, b) =>
        a.localeCompare(b)
      );

      setClassSubjects(cleanSubjects);
    } catch (error) {
      if (cancelled) return;

      console.error(
        "LOAD CLASS SUBJECTS ERROR:",
        error
      );

      setClassSubjectsError(
        error?.message ||
        "Unable to load class subjects."
      );
    } finally {
      if (!cancelled) {
        setClassSubjectsLoading(false);
      }
    }
  };

  loadClassSubjects();

  return () => {
    cancelled = true;
  };
}, [
  classForm.className,
  assignedClasses,
  showScheduleForm,
  user?.uid,
]);


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
              onClick={() =>
  setShowScheduleForm(true)
}
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
              {classesLoading ? (
  <div
    className="
      flex
      min-h-[280px]
      items-center
      justify-center
      rounded-2xl
      border
      border-slate-200
      bg-white
    "
  >
    <div className="text-center">
      <div
        className="
          mx-auto
          h-9
          w-9
          animate-spin
          rounded-full
          border-4
          border-slate-200
          border-t-teal-500
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
        Loading Live Classes...
      </p>
    </div>
  </div>
) : (
              filteredClasses.map(
                (
                  classItem,
                ) => (
                  <LiveClassCard
  key={
    classItem.id ||
    `${classItem.date}-${classItem.startTime || classItem.time}-${classItem.title}`
  }

  classItem={{
    ...classItem,

    studentsCount:
      getClassStudentCount(
        classItem.className
      ),
  }}

  onJoin={() =>
    handleJoinClass(
      classItem
    )
  }

  joining={
    joiningClassId ===
    classItem.id
  }

  onEdit={
    handleEditClass
  }

  onDelete={() =>
    setDeleteClass(
      classItem
    )
  }
/>
                ),
              ))}

{!classesLoading &&
              filteredClasses.length ===
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
            </aside>
          </div>
        </div>
      </div>
      {showScheduleForm && (
  <div
    className="
      fixed
      inset-0
      z-50
      flex
      items-center
      justify-center
      bg-slate-950/40
      p-4
      backdrop-blur-sm
    "
  >
    <div
      className="
        max-h-[90vh]
        w-full
        max-w-2xl
        overflow-y-auto
        rounded-3xl
        bg-white
        shadow-2xl
      "
    >
      {/* HEADER */}

      <div
        className="
          flex
          items-center
          justify-between
          border-b
          border-slate-100
          px-6
          py-5
        "
      >
        <div>
          <h2
            className="
              text-xl
              font-bold
              text-slate-900
            "
          >
            {editingClass
  ? "Edit Live Class"
  : "Schedule Live Class"}
          </h2>

          <p
            className="
              mt-1
              text-sm
              text-slate-500
            "
          >
          {editingClass
  ? "Update the Live Class details. Google Meet room is managed automatically."
  : "Schedule your class. Google Meet room is assigned automatically by Central Admin."}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowScheduleForm(
              false
            )
          }
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            bg-slate-100
            text-xl
            text-slate-500
            hover:bg-slate-200
          "
        >
          ×
        </button>
      </div>

      {/* FORM */}

      <form
        onSubmit={
          handleScheduleClass
        }
        className="p-6"
      >
        <div
          className="
            grid
            grid-cols-1
            gap-5
            md:grid-cols-2
          "
        >
          {/* TITLE */}

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-semibold text-slate-600">
              Class Title *
            </label>

            <input
              type="text"
              name="title"
              value={
                classForm.title
              }
              onChange={
                handleClassFormChange
              }
              placeholder="Example: Quran Recitation"
              className="
                h-11
                w-full
                rounded-xl
                border
                border-slate-200
                px-4
                text-sm
                outline-none
                focus:border-teal-400
                focus:ring-2
                focus:ring-teal-100
              "
            />
          </div>

          {/* SUBJECT */}

         <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          

                {/* CLASS */}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Class
                    <span className="ml-1 text-red-500">*</span>
                  </label>

                  <select
  required
value={classForm.className}
  name="className"
onChange={handleClassFormChange}
  disabled={
    assignedClasses.length === 0
  }
  className="
    h-11
    w-full
    rounded-xl
    border
    border-slate-200
    bg-white
    px-3
    text-sm
    text-slate-700
    outline-none
    transition
    focus:border-teal-400
    focus:ring-2
    focus:ring-teal-100
    disabled:cursor-not-allowed
    disabled:bg-slate-100
    disabled:text-slate-400
  "
>
  <option value="">
    {assignedClasses.length > 0
      ? "Select Assigned Class"
      : "No Class Assigned"}
  </option>

  {assignedClasses.map(
    (item) => (
      <option
        key={item}
        value={item}
      >
        {item}
      </option>
    ),
  )}
</select>
{assignedClasses.length === 0 && (
  <p className="mt-1.5 text-[11px] font-medium text-red-500">
    No classes are assigned to your Digital Teacher account.
  </p>
)}
                </div>
                


<div>
  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
    Subject Name
    <span className="ml-1 text-red-500">*</span>
  </label>

  <select
    required
    name="subject"
    value={classForm.subject}
    onChange={handleClassFormChange}
    disabled={
      !classForm.className ||
      classSubjectsLoading ||
      Boolean(classSubjectsError) ||
      classSubjects.length === 0
    }
    className="
      h-11
      w-full
      rounded-xl
      border
      border-slate-200
      bg-white
      px-3
      text-sm
      text-slate-700
      outline-none
      transition
      focus:border-teal-400
      focus:ring-2
      focus:ring-teal-100
      disabled:cursor-not-allowed
      disabled:bg-slate-100
      disabled:text-slate-400
    "
  >
    <option value="">
      {!classForm.className
        ? "Select Class First"
        : classSubjectsLoading
          ? "Loading Subjects..."
          : classSubjectsError
            ? "Unable to Load Subjects"
            : classSubjects.length === 0
              ? "No Subjects Available"
              : "Select Class Subject"}
    </option>

    {classSubjects.map((subject) => (
      <option
        key={subject}
        value={subject}
      >
        {subject}
      </option>
    ))}
  </select>

  {classSubjectsError && (
    <p className="mt-1.5 text-xs font-medium text-red-600">
      {classSubjectsError}
    </p>
  )}

  {classForm.className &&
    !classSubjectsLoading &&
    !classSubjectsError &&
    classSubjects.length === 0 && (
      <p className="mt-1.5 text-xs text-amber-700">
        No subjects configured for {classForm.className}.
      </p>
    )}
</div>


              </div>


          {/* DATE */}

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600">
              Date *
            </label>

            <input
              type="date"
              name="date"
              value={
                classForm.date
              }
              onChange={
                handleClassFormChange
              }
              className="
                h-11
                w-full
                rounded-xl
                border
                border-slate-200
                px-4
                text-sm
                outline-none
                focus:border-teal-400
                focus:ring-2
                focus:ring-teal-100
              "
            />
          </div>

          {/* START TIME */}

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600">
              Start Time *
            </label>

            <input
              type="time"
              name="startTime"
              value={
                classForm.startTime
              }
              onChange={
                handleClassFormChange
              }
              className="
                h-11
                w-full
                rounded-xl
                border
                border-slate-200
                px-4
                text-sm
                outline-none
                focus:border-teal-400
                focus:ring-2
                focus:ring-teal-100
              "
            />
          </div>

          {/* END TIME */}

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600">
              End Time *
            </label>

            <input
              type="time"
              name="endTime"
              value={
                classForm.endTime
              }
              onChange={
                handleClassFormChange
              }
              className="
                h-11
                w-full
                rounded-xl
                border
                border-slate-200
                px-4
                text-sm
                outline-none
                focus:border-teal-400
                focus:ring-2
                focus:ring-teal-100
              "
            />
          </div>

          {/* GOOGLE MEET */}

          {/* =====================================
    GOOGLE MEET ROOM
===================================== */}

<div
  className="
    md:col-span-2
  "
>

  <div
    className="
      flex
      items-start
      gap-3
      rounded-2xl
      border
      border-teal-100
      bg-teal-50
      p-4
    "
  >

    <div
      className="
        flex
        h-11
        w-11
        shrink-0
        items-center
        justify-center
        rounded-xl
        bg-white
        text-teal-600
        shadow-sm
      "
    >

      <Video
        className="
          h-5
          w-5
        "
      />

    </div>


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

        <p
          className="
            text-sm
            font-bold
            text-slate-800
          "
        >
          Google Meet Room
        </p>


        {classForm.className && (

          <span
            className="
              inline-flex
              items-center
              gap-1
              rounded-full
              bg-emerald-100
              px-2.5
              py-1
              text-[10px]
              font-bold
              text-emerald-700
            "
          >

            <CheckCircle2
              className="
                h-3
                w-3
              "
            />

            Auto Assigned

          </span>

        )}

      </div>


      {classForm.className ? (

        <>

          <p
            className="
              mt-2
              text-sm
              font-bold
              text-teal-700
            "
          >
            {classForm.className}
          </p>


          <p
            className="
              mt-1
              text-xs
              leading-5
              text-slate-500
            "
          >
            The Google Meet room assigned
           automatically for{" "}

            <strong
              className="
                text-slate-700
              "
            >
              {classForm.className}
            </strong>{" "}

            will be used automatically.
                      </p>

        </>

      ) : (

        <p
          className="
            mt-2
            text-xs
            leading-5
            text-slate-500
          "
        >
          Select an assigned class first.
          The correct Google Meet room
          will be selected automatically.
        </p>

      )}

    </div>

  </div>

</div>

          {/* DESCRIPTION */}

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-semibold text-slate-600">
              Description
            </label>

            <textarea
              name="description"
              value={
                classForm.description
              }
              onChange={
                handleClassFormChange
              }
              rows={4}
              placeholder="Optional class instructions..."
              className="
                w-full
                resize-none
                rounded-xl
                border
                border-slate-200
                p-4
                text-sm
                outline-none
                focus:border-teal-400
                focus:ring-2
                focus:ring-teal-100
              "
            />
          </div>
        </div>

        {/* BUTTONS */}

        <div
          className="
            mt-6
            flex
            items-center
            justify-end
            gap-3
            border-t
            border-slate-100
            pt-5
          "
        >
          <button
            type="button"
            onClick={() =>
              setShowScheduleForm(
                false
              )
            }
            className="
              h-11
              rounded-xl
              border
              border-slate-200
              px-5
              text-sm
              font-semibold
              text-slate-600
              hover:bg-slate-50
            "
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={scheduling}
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
              shadow-lg
              shadow-teal-100
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            <Video className="h-4 w-4" />
{scheduling
  ? editingClass
    ? "Updating..."
    : "Scheduling..."
  : editingClass
    ? "Update Class"
    : "Schedule Class"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
{deleteClass && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-[2px]">

    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">

      <div className="p-6">

        <div className="flex items-start gap-4">

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Delete Live Class?
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Are you sure you want to delete this Live Class?
              This action cannot be undone.
            </p>
          </div>

        </div>


        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">

          <p className="text-sm font-semibold text-slate-800">
            {deleteClass.title ||
              "Live Class"}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">

            {deleteClass.className && (
              <span>
                {deleteClass.className}
              </span>
            )}

            {deleteClass.subject && (
              <span>
                {deleteClass.subject}
              </span>
            )}

            {deleteClass.date && (
              <span>
                {deleteClass.date}
              </span>
            )}

          </div>

        </div>


        <div className="mt-6 flex justify-end gap-3">

          <button
            type="button"
            disabled={
              deletingClassId ===
              deleteClass.id
            }
            onClick={() =>
              setDeleteClass(null)
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={
              deletingClassId ===
              deleteClass.id
            }
            onClick={
              handleDeleteClass
            }
            className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deletingClassId ===
            deleteClass.id ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete Class
              </>
            )}
          </button>

        </div>

      </div>

    </div>

  </div>
)}


    </Layout>
  );
}