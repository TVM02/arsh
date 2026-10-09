"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/authUtils";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/digitalclassroom/Layout";
import {
  DashboardStat,
  DashboardCard,
  AssignmentStatus,
  DashboardLoading,
  EmptyWidget,
  RightListItem,
  StudentInfo,
  MiniCalendar,
  MosqueSilhouette,
  IslamicPattern,
} from "@/components/digitalclassroom/dashborad";
import {
  getMyAssignedDigitalStudents,
  getMyDigitalLiveClasses,
  getDigitalTeacherAdminMessages,
} from "@/lib/digitalClassTeacherService";

import {
  BookOpen,
  FileText,
  CalendarDays,
  Bell,
  Clock3,

  ChevronRight,
 
  Video,
  ArrowRight,
  CheckCircle2,

  Users,
  MoreVertical,
  Play,
  Scale,
  Landmark,
  Languages,

} from "lucide-react";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import { format, isValid } from "date-fns";




export default function DigitalTeacherDashboard() {
  const { user, userData } = useAuthStore();
  const [teacherData, setTeacherData] = useState(null);
  const [
  assignedStudents,
  setAssignedStudents,
] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [
  liveClasses,
  setLiveClasses,
] = useState([]);
const [
  currentTime,
  setCurrentTime,
] = useState(
  new Date()
);
  const [assignments, setAssignments] = useState([]);
  const [notices, setNotices] = useState([]);
const [
  liveClassesLoading,
  setLiveClassesLoading,
] = useState(true);

const [
  noticesLoading,
  setNoticesLoading,
] = useState(true);

  const [recentResults, setRecentResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingWidgets, setLoadingWidgets] = useState(true);
  const [error, setError] = useState("");
 const handleStartClass = (item) => {
    console.log("Start class:", item);
  };
  // Helper function to safely format dates
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";

    try {
      let date;
      if (timestamp.toDate && typeof timestamp.toDate === "function") {
        date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (
        typeof timestamp === "string" ||
        typeof timestamp === "number"
      ) {
        date = new Date(timestamp);
      } else {
        return "N/A";
      }

      if (isValid(date)) {
        return format(date, "MMM dd, yyyy");
      } else {
        return "N/A";
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return "N/A";
    }
  };
useEffect(() => {
  const timer =
    setInterval(() => {
      setCurrentTime(
        new Date()
      );
    }, 30000);

  return () => {
    clearInterval(timer);
  };
}, []);


  useEffect(() => {
  let active = true;

  const loadAssignedStudents =
    async () => {
      if (!user?.uid) {
        return;
      }

      try {
        const result =
          await getMyAssignedDigitalStudents();

        if (!active) {
          return;
        }

        const students =
          Array.isArray(
            result?.students
          )
            ? result.students
            : [];

        setAssignedStudents(
          students
        );
      } catch (error) {
        console.error(
          "LOAD DASHBOARD ASSIGNED STUDENTS ERROR:",
          error
        );

        if (active) {
          setAssignedStudents([]);
        }
      }
    };

  loadAssignedStudents();

  return () => {
    active = false;
  };
}, [user?.uid]);


useEffect(() => {
  let active = true;

  const loadStudyMaterials =
    async () => {
      if (!user?.uid) {
        return;
      }

      try {
        const materialsQuery =
          query(
            collection(
              db,
              "digitalStudyMaterials"
            ),
            where(
              "teacherUid",
              "==",
              user.uid
            )
          );

        const snapshot =
          await getDocs(
            materialsQuery
          );

        if (!active) {
          return;
        }

        const materialData =
          snapshot.docs.map(
            (document) => ({
              id:
                document.id,

              ...document.data(),
            })
          );

        setMaterials(
          materialData
        );
      } catch (error) {
        console.error(
          "LOAD DASHBOARD STUDY MATERIALS ERROR:",
          error
        );

        if (active) {
          setMaterials([]);
        }
      }
    };

  loadStudyMaterials();

  return () => {
    active = false;
  };
}, [user?.uid]);


useEffect(() => {
  let active = true;

  const loadLiveClasses =
    async () => {
      setLiveClassesLoading(true);
      if (!user?.uid) {
        return;
      }

      try {
        const result =
          await getMyDigitalLiveClasses();

        if (!active) {
          return;
        }

        const classes =
          Array.isArray(
            result?.classes
          )
            ? result.classes
            : [];

        setLiveClasses(
          classes
        );
      } catch (error) {
  console.error(
    "LOAD DASHBOARD LIVE CLASSES ERROR:",
    error
  );

  if (active) {
    setLiveClasses([]);
  }
} finally {
  if (active) {
    setLiveClassesLoading(false);
  }
}
    };

  loadLiveClasses();

  return () => {
    active = false;
  };
}, [user?.uid]);

useEffect(() => {
  let active = true;

  const loadRecentNotices =
  async () => {
      setNoticesLoading(true);
      if (!user?.uid) {
        return;
      }

      try {
        const result =
          await getDigitalTeacherAdminMessages();

        if (!active) {
          return;
        }

        const messages =
          Array.isArray(
            result?.messages
          )
            ? result.messages
            : [];

        const recentNotices =
          messages
            .slice(0, 5)
            .map((notice) => {
              const createdDate =
                notice.createdAt
                  ? new Date(
                      notice.createdAt
                    )
                  : null;

              const validDate =
                createdDate &&
                !Number.isNaN(
                  createdDate.getTime()
                );

              return {
                ...notice,

                dateLabel:
                  validDate
                    ? createdDate.toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )
                    : "",

                timeLabel:
                  validDate
                    ? createdDate.toLocaleTimeString(
                        "en-IN",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )
                    : "",
              };
            });

        setNotices(
          recentNotices
        );
      } catch (error) {
  console.error(
    "LOAD DASHBOARD CENTRAL ADMIN NOTICES ERROR:",
    error
  );

  if (active) {
    setNotices([]);
  }
} finally {
  if (active) {
    setNoticesLoading(false);
  }
}
    };

  loadRecentNotices();

  return () => {
    active = false;
  };
}, [user?.uid]);


 useEffect(() => {
  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      setError("");

      if (!user?.uid) {
        setError("Digital Teacher is not logged in.");
        setLoading(false);
        return;
      }

      // ==========================================
      // AUTH STORE DATA
      // ==========================================

      let currentTeacherData = {
        ...(userData || {}),
        uid: user.uid,
        email:
          userData?.email ||
          user?.email ||
          null,
      };


      // ==========================================
      // USERS/{UID}
      // ==========================================

      try {
        const userSnap =
          await getDoc(
            doc(
              db,
              "users",
              user.uid,
            ),
          );

        if (userSnap.exists()) {
          currentTeacherData = {
            ...currentTeacherData,
            ...userSnap.data(),
            uid: user.uid,
          };
        }
      } catch (error) {
        console.error(
          "Unable to load teacher user document:",
          error,
        );
      }


      // ==========================================
      // VERIFY DIGITAL TEACHER ACCESS
      // ==========================================

      const isDigitalTeacher =
        currentTeacherData?.role ===
          "teacher" &&
        currentTeacherData
          ?.digitalTeacher === true &&
        currentTeacherData
          ?.digitalClassAccess === true &&
        (
          !currentTeacherData
            ?.digitalTeacherStatus ||
          currentTeacherData
            ?.digitalTeacherStatus ===
            "active"
        );

      if (!isDigitalTeacher) {
        setError(
          "Digital Teacher access is not active.",
        );

        setLoading(false);
        return;
      }


      // ==========================================
      // DIGITAL TEACHER APPLICATION
      // ==========================================

      try {
        const teacherQuery =
          query(
            collection(
              db,
              "digitalClassTeacherRegistrations",
            ),
            where(
              "sourceTeacherUid",
              "==",
              user.uid,
            ),
            limit(1),
          );

        const teacherSnapshot =
          await getDocs(
            teacherQuery,
          );

        if (
          !teacherSnapshot.empty
        ) {
          const applicationDoc =
            teacherSnapshot.docs[0];

          currentTeacherData = {
            ...currentTeacherData,
            ...applicationDoc.data(),

            applicationId:
              applicationDoc.id,

            uid:
              user.uid,

            role:
              "teacher",

            digitalTeacher:
              true,

            digitalClassAccess:
              true,
          };
        }
      } catch (error) {
        console.error(
          "Unable to load Digital Teacher application:",
          error,
        );
      }


      setTeacherData(
        currentTeacherData,
      );

      setLoading(false);
    } catch (error) {
      console.error(
        "Error loading Digital Teacher dashboard:",
        error,
      );

      setError(
        "Failed to load Digital Teacher dashboard.",
      );

      setLoading(false);
    }
  };


  if (user?.uid) {
    fetchTeacherData();
  }
}, [
  user?.uid,
  user?.email,
  userData,
]);

const getLocalDateString = (
  date
) => {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
};


const formatClassTime = (
  time
) => {
  if (!time) {
    return "";
  }

  const [
    hour,
    minute,
  ] = time
    .split(":")
    .map(Number);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return time;
  }

  const date =
    new Date();

  date.setHours(
    hour,
    minute,
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
    }
  );
};


const normalizeClassName = (
  value
) => {
  return String(
    value || ""
  )
    .toLowerCase()
    .replace(
      /^class\s*/i,
      ""
    )
    .trim();
};

const todayDate =
  getLocalDateString(
    currentTime
  );

const tomorrow =
  new Date(
    currentTime
  );

tomorrow.setDate(
  tomorrow.getDate() + 1
);

const tomorrowDate =
  getLocalDateString(
    tomorrow
  );


const myClasses =
  liveClasses
    .map((item) => {
      const date =
        item?.date || "";

      const startTime =
        item?.startTime || "";

      const endTime =
        item?.endTime || "";

      let status =
        item?.status ||
        "upcoming";

      if (
        date &&
        startTime &&
        endTime
      ) {
        const startDate =
          new Date(
            `${date}T${startTime}:00`
          );

        const endDate =
          new Date(
            `${date}T${endTime}:00`
          );

        if (
          !Number.isNaN(
            startDate.getTime()
          ) &&
          !Number.isNaN(
            endDate.getTime()
          )
        ) {
          if (
            currentTime <
            startDate
          ) {
            status =
              "upcoming";
          } else if (
            currentTime >=
              startDate &&
            currentTime <=
              endDate
          ) {
            status =
              "ongoing";
          } else {
            status =
              "completed";
          }
        }
      }

      const studentsCount =
        assignedStudents.filter(
          (student) => {
            const studentClass =
              student
                ?.applyingclass ||
              student
                ?.assignedDigitalTeacherClass ||
              student
                ?.className ||
              student?.class;

            return (
              normalizeClassName(
                studentClass
              ) ===
              normalizeClassName(
                item.className
              )
            );
          }
        ).length;

      return {
        ...item,

        status,

        name:
          item.title ||
          `${item.subject || "Live Class"} – ${item.className || ""}`,

        subject:
          item.subject ||
          "",

        students:
          studentsCount,

        nextSession:
          date ===
          todayDate
            ? "Today"
            : date ===
                tomorrowDate
              ? "Tomorrow"
              : date,

        time:
          formatClassTime(
            startTime
          ),

        icon:
          Video,

        iconClass:
          status ===
          "ongoing"
            ? "bg-red-500"
            : "bg-teal-600",
      };
    })
    .filter((item) => {
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
    })
    .sort((a, b) => {
      const first =
        `${a.date} ${
          a.startTime ||
          ""
        }`;

      const second =
        `${b.date} ${
          b.startTime ||
          ""
        }`;

      return first.localeCompare(
        second
      );
    });
    const assignedClassList =
  Array.isArray(
    teacherData
      ?.digitalTeachingAssignment
      ?.classes
  )
    ? teacherData
        .digitalTeachingAssignment
        .classes
    : [];

const hasAssignedClasses =
  assignedClassList.length > 0;

  if (loading) {
    return (
      <Layout user={user}>
        <div className="p-4 md:p-6">
          <div className="flex justify-center items-center h-48 md:h-64">
            <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-b-2 border-teal-600"></div>
            <div className="ml-4 text-base md:text-lg">
              Loading dashboard...
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout user={user}>
        <div className="p-4 md:p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 md:px-4 py-3 rounded text-sm md:text-base">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        </div>
      </Layout>
    );
  }

 
   return (
  <Layout user={user}>
    <div className="min-h-screen bg-[#f7fbfc]">

      {/* =========================================
          DASHBOARD CONTENT
      ========================================= */}

      <main className="px-4 py-5 md:px-6 lg:px-7">

        <div className="mx-auto max-w-[1600px]">

          {/* =====================================
              MAIN GRID
          ===================================== */}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">

            {/* ===================================
                LEFT CONTENT
            =================================== */}

            <div className="min-w-0 space-y-5">

              {/* ===============================
                  WELCOME HERO
              =============================== */}

              <section
                className="
                  relative
                  min-h-[250px]
                  overflow-hidden
                  rounded-[24px]
                  border
                  border-teal-100
                  bg-gradient-to-r
                  from-[#d9fbfa]
                  via-[#e7fbf8]
                  to-[#c9f5f0]
                  shadow-[0_15px_45px_rgba(15,118,110,0.08)]
                "
              >

                {/* Decorative circles */}

                <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-white/30 blur-3xl" />

                <div className="pointer-events-none absolute right-[25%] top-5 h-40 w-40 rounded-full bg-cyan-200/20 blur-3xl" />


                {/* Content */}

                <div
                  className="
                    relative
                    z-10
                    flex
                    min-h-[250px]
                    items-center
                    px-6
                    py-8
                    md:px-8
                    lg:w-[58%]
                  "
                >

                  <div>

                    <p className="mb-1 text-base font-bold text-slate-800 md:text-lg">
                      Assalamu Alaikum,
                    </p>

                    <h1
                      className="
                        max-w-xl
                        text-2xl
                        font-extrabold
                        leading-tight
                        tracking-tight
                        text-[#07184c]
                        sm:text-3xl
                        lg:text-[36px]
                      "
                    >
                      Welcome Back,{" "}
                      {teacherData?.fullName ||
                        teacherData?.name ||
                        user?.displayName ||
                        "Student"}
                      !
                    </h1>


                    <p className="mt-4 max-w-lg text-sm leading-6 text-slate-600 md:text-[15px]">
                      Here's what's happening with your madrasa classes today.
                    </p>


                    <Link
                      href="/dashboard/digital-teacher/class"
                      className="
                        mt-6
                        inline-flex
                        items-center
                        gap-3
                        rounded-xl
                        bg-gradient-to-r
                        from-teal-500
                        to-teal-600
                        px-5
                        py-3
                        text-sm
                        font-bold
                        text-white
                        shadow-lg
                        shadow-teal-200/50
                        transition
                        hover:-translate-y-0.5
                        hover:shadow-xl
                      "
                    >
                      Keep Learning

                      <ArrowRight className="h-4 w-4" />
                    </Link>

                  </div>

                </div>


                {/* =================================
                    HERO IMAGE
                ================================= */}

                <div
                  className="
                    absolute
                    bottom-0
                    right-0
                    hidden
                    h-full
                    w-[48%]
                    md:block
                  "
                >
                  <Image
                    src="/admission-hero.png"
                    alt="Digital Classroom Student"
                    fill
                    priority
                    className="object-cover object-center"
                  />

                  <div
                    className="
                      absolute
                      inset-0
                      bg-gradient-to-r
                      from-[#e3fbf8]
                      via-transparent
                      to-transparent
                    "
                  />
                </div>

              </section>


              {/* ===============================
                  STAT CARDS
              =============================== */}

              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">

                {/* Assignments */}

                <DashboardStat
  icon={Users}
  value={assignedStudents.length}
  title="Assigned Students"
  iconClass="bg-blue-50 text-blue-600"
/>

<DashboardStat
  icon={BookOpen}
  value={
    teacherData
      ?.digitalTeachingAssignment
      ?.classes?.length ||
    teacherData
      ?.teachingAssignment
      ?.classes?.length ||
    0
  }
  title="Assigned Classes"
  iconClass="bg-emerald-50 text-emerald-600"
/>

<DashboardStat
  icon={FileText}
  value={materials.length}
  title="Study Materials"
  iconClass="bg-orange-50 text-orange-500"
/>

<DashboardStat
  icon={Video}
  value={
    liveClassesLoading
      ? "..."
      : liveClasses.length
  }
  title="Live Classes"
  iconClass="bg-violet-50 text-violet-600"
/>
                {/* Study Hours */}

              

              </section>


              {/* ===============================
                  ASSIGNMENTS + ANNOUNCEMENTS
              =============================== */}

              <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">

                {/* =================================
                    RECENT ASSIGNMENTS
                ================================= */}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
              <Landmark className="h-5 w-5 text-emerald-700" />
            </div>

            <h2 className="text-lg font-bold text-slate-800">
              My Classes
            </h2>
          </div>

          <Link
      href="/dashboard/digital-teacher/live-classes"
      className="flex items-center gap-1 text-sm font-medium text-blue-600 transition hover:text-blue-700"
    >
      View All

      <ChevronRight className="h-4 w-4" />
    </Link>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <div className="grid grid-cols-[2fr_.7fr_1.1fr_.9fr_.2fr] bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500">
            <div>Class Name</div>
            <div>Students</div>
            <div>Next Session</div>
           
            <div />
          </div>

          <div>
  {!hasAssignedClasses ? (

  <div className="flex min-h-[200px] items-center justify-center px-5 text-center">

    <div>

      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <BookOpen className="h-5 w-5 text-slate-400" />
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-700">
        No Classes Assigned
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-400">
        No Digital Classroom classes have been assigned to you yet.
      </p>

    </div>

  </div>

) : liveClassesLoading ? (
    <div className="flex min-h-[180px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600" />

        <p className="text-xs font-medium text-slate-500">
          Loading classes...
        </p>
      </div>
    </div>
  ) : myClasses.length === 0 ? (
    <div className="flex min-h-[180px] items-center justify-center px-5 text-center">
      <div>
        <Video className="mx-auto h-8 w-8 text-slate-300" />

        <p className="mt-3 text-sm font-semibold text-slate-600">
          No upcoming classes
        </p>

        <p className="mt-1 text-xs text-slate-400">
          Today and tomorrow&apos;s classes will appear here.
        </p>
      </div>
    </div>
  ) : (
    myClasses.map((item) => {
             const ClassIcon =
               item.icon || BookOpen;

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[2fr_.7fr_1.1fr_.9fr_.2fr] items-center border-t border-slate-100 px-5 py-3 transition hover:bg-slate-50"
                >
                  {/* Class */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${item.iconClass}`}
                    >
                      <ClassIcon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {item.name}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {item.subject}
                      </p>
                    </div>
                  </div>

                  {/* Students */}
                  <div className="text-sm font-medium text-slate-700">
                    {item.students}
                  </div>

                  {/* Session */}
                  <div>
                    <p className="text-sm text-slate-700">
                      {item.nextSession}
                    </p>

                    <p className="text-xs text-slate-500">
                      {item.time}
                    </p>
                    
                  </div>

        
                  

                  {/* Menu */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
  ))}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 p-4 md:hidden">
          {myClasses.map((item) => {
  const ClassIcon =
    item.icon || BookOpen;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${item.iconClass}`}
                  >
                    <ClassIcon className="h-5 w-5" />
                  </div>

                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">
                      {item.name}
                    </p>

                    <p className="text-xs text-slate-500">
                      {item.subject}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">
                      Students
                    </p>
                    <p className="mt-1 font-semibold text-slate-700">
                      {item.students}
                    </p>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">
                      Next Session
                    </p>
                    <p className="mt-1 font-semibold text-slate-700">
                      {item.nextSession}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.time}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartClass(item)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Start Class
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================
          RIGHT SIDE
      ====================================================== */}

      <div className="space-y-5">
        {/* =================================================
            RECENT ACTIVITY
        ================================================== */}

        {/* =================================================
    RECENT CENTRAL ADMIN NOTICES
================================================== */}

<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

  {/* Header */}

  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">

    <div className="flex items-center gap-3">

      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50">

        <Bell className="h-5 w-5 text-teal-600" />

      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-800">
          Recent Notices
        </h2>

        <p className="mt-0.5 text-[10px] text-slate-400">
          Central Admin announcements
        </p>
      </div>

    </div>

    <Link
      href="/dashboard/digital-teacher/messages"
      className="flex items-center gap-1 text-sm font-medium text-blue-600 transition hover:text-blue-700"
    >
      View All

      <ChevronRight className="h-4 w-4" />
    </Link>

  </div>


  {/* Notices */}

  <div className="px-5">

  {noticesLoading ? (

  <div className="flex min-h-[200px] items-center justify-center">

    <div className="flex flex-col items-center gap-3">

      <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600" />

      <p className="text-xs font-medium text-slate-500">
        Loading notices...
      </p>

    </div>

  </div>

) : notices.length === 0 ? (

      <div className="flex min-h-[180px] flex-col items-center justify-center text-center">

        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">

          <Bell className="h-5 w-5 text-slate-400" />

        </div>

        <p className="mt-3 text-sm font-semibold text-slate-600">
          No recent notices
        </p>

        <p className="mt-1 text-xs text-slate-400">
          Central Admin notices will appear here.
        </p>

      </div>

    ) : (

      notices.map(
        (notice, index) => (

          <div
            key={notice.id}
            className={`flex gap-3 py-4 ${
              index !==
              notices.length - 1
                ? "border-b border-slate-100"
                : ""
            }`}
          >

            {/* Icon */}

            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                notice.priority ===
                "important"
                  ? "bg-red-50 text-red-500"
                  : "bg-teal-50 text-teal-600"
              }`}
            >
              <Bell className="h-5 w-5" />
            </div>


            {/* Content */}

            <div className="min-w-0 flex-1">

              <div className="flex items-start justify-between gap-2">

                <p className="text-[13px] font-semibold leading-5 text-slate-800">
                  {notice.title}
                </p>

                {!notice.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                )}

              </div>

              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                {notice.message}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">

                <span>
                  {notice.dateLabel}
                </span>

                {notice.timeLabel && (
                  <>
                    <span>•</span>

                    <span>
                      {notice.timeLabel}
                    </span>
                  </>
                )}

                {notice.priority ===
                  "important" && (

                  <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-500">
                    Important
                  </span>

                )}

              </div>

            </div>

          </div>

        )
      )

    )}

  </div>

</div>

        {/* =================================================
            ISLAMIC QUOTE CARD
        ================================================== */}

        <div className="relative overflow-hidden rounded-2xl border border-[#e8dfc4] bg-gradient-to-r from-[#fbf9eb] via-[#f8f7e9] to-[#eef5e9] px-6 py-6 shadow-sm">
          {/* background decoration */}

          <div className="pointer-events-none absolute -bottom-12 right-0 opacity-10">
            <Landmark className="h-40 w-40 text-emerald-800" />
          </div>

          <div className="pointer-events-none absolute right-8 top-5 text-amber-500/80">
            <div className="h-8 w-8 rounded-full border-[8px] border-amber-500 border-r-transparent border-t-transparent rotate-[-35deg]" />
          </div>

          <div className="relative z-10 max-w-[340px]">
            <h3 className="font-serif text-2xl font-bold leading-tight text-emerald-800">
              Knowledge Builds
              <br />
              Better Generations
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              “The best of you are those who learn the Qur&apos;an
              and teach it.”
            </p>

            <p className="mt-2 text-xs font-medium text-emerald-600">
              — Sahih al-Bukhari
            </p>
          </div>
        </div>
      </div>

              </section>


              {/* ===================================
                  BOTTOM ISLAMIC BANNER
              =================================== */}

              <section
                className="
                  relative
                  min-h-[190px]
                  overflow-hidden
                  rounded-[24px]
                  border
                  border-teal-100
                  bg-gradient-to-r
                  from-[#d5f8f3]
                  via-[#e9fbf7]
                  to-[#c9f2eb]
                  shadow-[0_15px_40px_rgba(15,118,110,0.06)]
                "
              >

                <div
                  className="
                    absolute
                    inset-0
                    opacity-[0.08]
                  "
                >
                  <IslamicPattern />
                </div>


                <div
                  className="
                    relative
                    z-10
                    flex
                    min-h-[190px]
                    items-center
                    justify-center
                    px-6
                    py-8
                    text-center
                  "
                >

                  <div>

                    <BookOpen className="mx-auto mb-3 h-8 w-8 text-teal-600" />

                    <p
                      className="
                        mx-auto
                        max-w-2xl
                        text-lg
                        font-bold
                        italic
                        leading-7
                        text-teal-800
                        md:text-xl
                      "
                    >
                      “The best among you are those who learn
                      the Qur&apos;an and teach it.”
                    </p>


                    <p className="mt-3 text-xs font-semibold text-teal-600">
                      Knowledge • Character • Progress
                    </p>

                  </div>

                </div>


                <div
                  className="
                    absolute
                    bottom-0
                    left-0
                    right-0
                    opacity-[0.12]
                  "
                >
                  <MosqueSilhouette />
                </div>

              </section>

            </div>


    

            <aside className="space-y-5">

              {/* =================================
                  CALENDAR
              ================================= */}

              <DashboardCard>

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

              </DashboardCard>
           
              <DashboardCard>

                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Teacher Information
                </p>


                <StudentInfo
                  label="Email"
                  value={
                    teacherData?.digitalTeacherEmail ||
                    
                    "N/A"
                  }
                />

                <StudentInfo
                  label="Mhr Id."
                  value={
                    teacherData?.mhrId ||
                    "N/A"
                  }
                />


                <StudentInfo
                  label="Status"
                  value={
                    teacherData?.accountStatus ||
                    "Active"
                  }
                  status
                />

              </DashboardCard>

            </aside>

          </div>

        </div>

      </main>

    </div>
  </Layout>
);
}
