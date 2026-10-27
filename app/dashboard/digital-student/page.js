"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import Image from "next/image";

import Layout from "@/components/digitalclassroom/Layout";

import {
  DashboardStat,
  DashboardCard,
  DashboardLoading,
  EmptyWidget,
  StudentInfo,
  MiniCalendar,
  MosqueSilhouette,
  IslamicPattern,
} from "@/components/digitalclassroom/dashborad";

import {
  BookOpen,
  CalendarDays,
  Bell,
  Clock3,
  Megaphone,
  Video,
  ArrowRight,
  UserRound,
  Radio,
  MessageCircle,
  GraduationCap,
  CheckCircle2,
} from "lucide-react";

import useAuthStore from "@/lib/authStore";

import {
  auth,
} from "@/lib/firebase";


/* =========================================================
   API PATHS
========================================================= */

const MESSAGES_API =
  "/api/digital-classroom/student/messages";

/*
 * Primary student Live Class API.
 *
 * If your project uses:
 * /api/digital-classroom/student/classes
 *
 * the fallback below will automatically try it.
 */
const LIVE_CLASS_API_PATHS = [
  "/api/digital-classroom/student/live-classes",
  "/api/digital-classroom/student/classes",
];


/* =========================================================
   HELPERS
========================================================= */

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}


function normalizeValue(value) {
  return cleanText(value)
    .toLowerCase();
}


/* =========================================================
   INDIA DATE
========================================================= */

function getIndiaToday() {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Asia/Kolkata",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    );


  const parts =
    formatter.formatToParts(
      new Date()
    );


  const year =
    parts.find(
      (item) =>
        item.type ===
        "year"
    )?.value;


  const month =
    parts.find(
      (item) =>
        item.type ===
        "month"
    )?.value;


  const day =
    parts.find(
      (item) =>
        item.type ===
        "day"
    )?.value;


  return `${year}-${month}-${day}`;
}


/* =========================================================
   LIVE CLASS STATUS
========================================================= */

function getLiveClassStatus(
  liveClass
) {
  const date =
    cleanText(
      liveClass?.date
    );

  const startTime =
    cleanText(
      liveClass?.startTime
    );

  const endTime =
    cleanText(
      liveClass?.endTime
    );


  if (
    !date ||
    !startTime ||
    !endTime
  ) {
    return (
      normalizeValue(
        liveClass?.status
      ) ||
      "upcoming"
    );
  }


  const start =
    new Date(
      `${date}T${startTime}:00+05:30`
    );


  const end =
    new Date(
      `${date}T${endTime}:00+05:30`
    );


  const now =
    new Date();


  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    )
  ) {
    return (
      normalizeValue(
        liveClass?.status
      ) ||
      "upcoming"
    );
  }


  if (now < start) {
    return "upcoming";
  }


  if (
    now >= start &&
    now < end
  ) {
    return "ongoing";
  }


  return "completed";
}


/* =========================================================
   TIME FORMAT
========================================================= */

function formatClassTime(value) {
  if (!value) {
    return "--";
  }

  const valueString =
    String(value);


  const match =
    valueString.match(
      /^(\d{1,2}):(\d{2})/
    );


  if (!match) {
    return valueString;
  }


  let hour =
    Number(match[1]);

  const minute =
    match[2];


  const period =
    hour >= 12
      ? "PM"
      : "AM";


  hour =
    hour % 12 || 12;


  return `${hour}:${minute} ${period}`;
}


/* =========================================================
   MESSAGE DATE
========================================================= */

function formatMessageDate(value) {
  if (!value) {
    return "";
  }


  try {
    const date =
      value?.toDate
        ? value.toDate()
        : new Date(value);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }


    return new Intl.DateTimeFormat(
      "en-IN",
      {
        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",
      }
    ).format(date);
  } catch {
    return "";
  }
}


/* =========================================================
   GET FIREBASE TOKEN
========================================================= */

async function getStudentToken() {
  const currentUser =
    auth.currentUser;


  if (!currentUser) {
    throw new Error(
      "Please login again."
    );
  }


  return await currentUser
    .getIdToken();
}


/* =========================================================
   LOAD MESSAGES
========================================================= */

async function loadStudentMessages() {
  const token =
    await getStudentToken();


  const response =
    await fetch(
      MESSAGES_API,
      {
        method:
          "GET",

        headers: {
          Authorization:
            `Bearer ${token}`,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );


  const raw =
    await response.text();


  let data = {};


  try {
    data =
      raw
        ? JSON.parse(raw)
        : {};
  } catch {
    throw new Error(
      "Messages API returned invalid JSON."
    );
  }


  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      "Unable to load messages."
    );
  }


  return data;
}


/* =========================================================
   LOAD LIVE CLASSES

   Supports both possible student API paths.
========================================================= */

async function loadStudentLiveClasses() {
  const token =
    await getStudentToken();


  let lastError = null;


  for (
    const url
    of LIVE_CLASS_API_PATHS
  ) {
    try {
      const response =
        await fetch(
          url,
          {
            method:
              "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,

              Accept:
                "application/json",
            },

            cache:
              "no-store",
          }
        );


      /*
       * Try next path if
       * route does not exist.
       */
      if (
        response.status ===
        404
      ) {
        continue;
      }


      const raw =
        await response.text();


      let data = {};


      try {
        data =
          raw
            ? JSON.parse(raw)
            : {};
      } catch {
        throw new Error(
          "Live Classes API returned invalid JSON."
        );
      }


      if (!response.ok) {
        throw new Error(
          data?.message ||
          data?.error ||
          "Unable to load Live Classes."
        );
      }


      return data;

    } catch (error) {
      lastError =
        error;
    }
  }


  throw (
    lastError ||
    new Error(
      "Student Live Classes API was not found."
    )
  );
}


/* =========================================================
   LIVE CLASS STATUS BADGE
========================================================= */

function LiveStatusBadge({
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
          px-2.5
          py-1
          text-[10px]
          font-extrabold
          text-red-600
        "
      >
        <span
          className="
            h-2
            w-2
            animate-pulse
            rounded-full
            bg-red-500
          "
        />

        LIVE
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
          gap-1
          rounded-full
          bg-slate-100
          px-2.5
          py-1
          text-[10px]
          font-bold
          text-slate-500
        "
      >
        <CheckCircle2
          className="h-3 w-3"
        />

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
        bg-teal-50
        px-2.5
        py-1
        text-[10px]
        font-bold
        text-teal-700
      "
    >
      <Clock3
        className="h-3 w-3"
      />

      Upcoming
    </span>
  );
}


/* =========================================================
   PAGE
========================================================= */

export default function StudentDashboard() {

  const {
    user,
    userData,
  } =
    useAuthStore();


  const [
    studentData,
    setStudentData,
  ] =
    useState(null);


  const [
    todayClasses,
    setTodayClasses,
  ] =
    useState([]);


  const [
    teacherMessages,
    setTeacherMessages,
  ] =
    useState([]);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    loadingWidgets,
    setLoadingWidgets,
  ] =
    useState(true);


  const [
    error,
    setError,
  ] =
    useState("");


  /* =======================================================
     STUDENT DATA
  ======================================================= */

  useEffect(() => {

    if (!user) {
      return;
    }


    if (!userData) {
      return;
    }


    setStudentData(
      userData
    );


    setError("");

    setLoading(
      false
    );

  }, [
    user,
    userData,
  ]);


  /* =======================================================
     LOAD TODAY LIVE CLASSES
     + TEACHER MESSAGES
  ======================================================= */

  useEffect(() => {

    let active =
      true;


    const loadWidgets =
      async () => {

        if (
          !user?.uid
        ) {
          return;
        }


        try {
          setLoadingWidgets(
            true
          );


          const [
            liveClassResult,
            messageResult,
          ] =
            await Promise.allSettled([
              loadStudentLiveClasses(),
              loadStudentMessages(),
            ]);


          /* =====================================
             TODAY LIVE CLASSES
          ===================================== */

          if (
            liveClassResult.status ===
            "fulfilled"
          ) {
            const result =
              liveClassResult.value;


            const allClasses =
              Array.isArray(
                result?.classes
              )
                ? result.classes

                : Array.isArray(
                    result?.liveClasses
                  )
                  ? result.liveClasses

                  : Array.isArray(
                      result?.data
                    )
                    ? result.data

                    : [];


            const today =
              getIndiaToday();


            const todayOnly =
              allClasses
                .filter(
                  (liveClass) =>
                    cleanText(
                      liveClass?.date
                    ) ===
                    today
                )
                .map(
                  (liveClass) => ({
                    ...liveClass,

                    status:
                      getLiveClassStatus(
                        liveClass
                      ),
                  })
                )
                .sort(
                  (a, b) =>
                    cleanText(
                      a?.startTime
                    ).localeCompare(
                      cleanText(
                        b?.startTime
                      )
                    )
                );


            if (active) {
              setTodayClasses(
                todayOnly
              );
            }

          } else {
            console.error(
              "LOAD TODAY LIVE CLASSES ERROR:",
              liveClassResult.reason
            );


            if (active) {
              setTodayClasses(
                []
              );
            }
          }


          /* =====================================
             TEACHER MESSAGES ONLY
             MAX 5
          ===================================== */

          if (
            messageResult.status ===
            "fulfilled"
          ) {
            const result =
              messageResult.value;


            const allMessages =
              Array.isArray(
                result?.messages
              )
                ? result.messages
                : [];


            const messages =
              allMessages
                .filter(
                  (message) =>
                    message?.source ===
                      "teacher" ||
                    message?.senderType ===
                      "teacher"
                )
                .sort(
                  (a, b) =>
                    new Date(
                      b?.createdAt ||
                      0
                    ).getTime() -
                    new Date(
                      a?.createdAt ||
                      0
                    ).getTime()
                )
                .slice(
                  0,
                  5
                );


            if (active) {
              setTeacherMessages(
                messages
              );
            }

          } else {
            console.error(
              "LOAD TEACHER MESSAGES ERROR:",
              messageResult.reason
            );


            if (active) {
              setTeacherMessages(
                []
              );
            }
          }

        } catch (loadError) {

          console.error(
            "LOAD DIGITAL STUDENT DASHBOARD WIDGETS ERROR:",
            loadError
          );

        } finally {

          if (active) {
            setLoadingWidgets(
              false
            );
          }
        }
      };


    loadWidgets();


    return () => {
      active =
        false;
    };

  }, [
    user?.uid,
  ]);


  /* =======================================================
     ASSIGNED TEACHER

     Uses student users document fields.
     No extra Firestore request needed.
  ======================================================= */

  const assignedTeacher =
    useMemo(
      () => {

        if (
          !studentData
            ?.teacherAssigned &&
          !studentData
            ?.assignedDigitalTeacherUid
        ) {
          return null;
        }


        return {
          uid:
            studentData
              ?.assignedDigitalTeacherUid ||
            "",

          fullName:
            studentData
              ?.assignedDigitalTeacherName ||
            "Digital Teacher",

          email:
            studentData
              ?.assignedDigitalTeacherEmail ||
            "",

          mhrId:
            studentData
              ?.assignedDigitalTeacherMhrId ||
            "",

          status:
            "active",
        };
      },
      [
        studentData,
      ]
    );


  /* =======================================================
     CLASS NAME
  ======================================================= */

  const studentClass =

    studentData?.applyingclass


  /* =======================================================
     UNREAD TEACHER MESSAGES
  ======================================================= */

  const unreadTeacherMessages =
    teacherMessages.filter(
      (message) =>
        !message?.read
    ).length;


  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <Layout user={user}>

        <div
          className="
            flex
            min-h-[60vh]
            items-center
            justify-center
            bg-[#f7fbfc]
          "
        >

          <div
            className="
              flex
              items-center
              gap-3
              text-slate-600
            "
          >

            <div
              className="
                h-9
                w-9
                animate-spin
                rounded-full
                border-2
                border-teal-100
                border-t-teal-600
              "
            />

            <span
              className="
                text-sm
                font-semibold
              "
            >
              Loading dashboard...
            </span>

          </div>

        </div>

      </Layout>
    );
  }


  /* =======================================================
     ERROR
  ======================================================= */

  if (error) {
    return (
      <Layout user={user}>

        <div
          className="
            p-4
            md:p-6
          "
        >

          <div
            className="
              rounded-xl
              border
              border-red-200
              bg-red-50
              px-4
              py-3
              text-sm
              font-medium
              text-red-700
            "
          >
            {error}
          </div>

        </div>

      </Layout>
    );
  }


  /* =======================================================
     UI
  ======================================================= */

  return (

    <Layout user={user}>

      <div
        className="
          min-h-screen
          bg-[#f7fbfc]
        "
      >

        <main
          className="
            px-4
            py-5
            md:px-6
            lg:px-7
          "
        >

          <div
            className="
              mx-auto
              max-w-[1600px]
            "
          >

            <div
              className="
                grid
                grid-cols-1
                gap-5
                xl:grid-cols-[minmax(0,1fr)_300px]
              "
            >

              {/* =================================================
                  LEFT
              ================================================= */}

              <div
                className="
                  min-w-0
                  space-y-5
                "
              >

                {/* =================================================
                    HERO
                ================================================= */}

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

                  <div
                    className="
                      pointer-events-none
                      absolute
                      -left-16
                      -top-20
                      h-56
                      w-56
                      rounded-full
                      bg-white/30
                      blur-3xl
                    "
                  />


                  <div
                    className="
                      pointer-events-none
                      absolute
                      right-[25%]
                      top-5
                      h-40
                      w-40
                      rounded-full
                      bg-cyan-200/20
                      blur-3xl
                    "
                  />


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

                      <p
                        className="
                          mb-1
                          text-base
                          font-bold
                          text-slate-800
                          md:text-lg
                        "
                      >
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

                        {studentData
                          ?.fullName ||
                          studentData
                            ?.studentName ||
                          studentData
                            ?.name ||
                          user
                            ?.displayName ||
                          "Student"}

                        !
                      </h1>


                      <p
                        className="
                          mt-4
                          max-w-lg
                          text-sm
                          leading-6
                          text-slate-600
                          md:text-[15px]
                        "
                      >
                        Continue your learning journey and stay
                        connected with today&apos;s classes and
                        your Ustad.
                      </p>


                      <Link
                        href="/dashboard/digital-student/classes"
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
                        View Classes

                        <ArrowRight
                          className="h-4 w-4"
                        />

                      </Link>

                    </div>

                  </div>


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
                      className="
                        object-cover
                        object-center
                      "
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


                {/* =================================================
                    STATS
                ================================================= */}

                <section
                  className="
                    grid
                    grid-cols-2
                    gap-3
                    lg:grid-cols-4
                  "
                >

                  <DashboardStat
                    icon={Video}
                    value={
                      todayClasses.length
                    }
                    title="Today's Classes"
                    iconClass="
                      bg-red-50
                      text-red-500
                    "
                  />


                  <DashboardStat
                    icon={MessageCircle}
                    value={
                      teacherMessages.length
                    }
                    title="Teacher Messages"
                    subtitle={
                      unreadTeacherMessages >
                      0
                        ? `${unreadTeacherMessages} unread`
                        : "Latest messages"
                    }
                    iconClass="
                      bg-blue-50
                      text-blue-600
                    "
                  />


                  <DashboardStat
                    icon={GraduationCap}
                    value={
                      studentClass
                    }
                    title="Assigned Class"
                    iconClass="
                      bg-violet-50
                      text-violet-600
                    "
                  />


                  <DashboardStat
                    icon={UserRound}
                    value={
                      assignedTeacher
                        ? "Active"
                        : "Pending"
                    }
                    title="Teacher Assignment"
                    iconClass="
                      bg-emerald-50
                      text-emerald-600
                    "
                  />

                </section>


                {/* =================================================
                    TODAY LIVE CLASS + TEACHER ANNOUNCEMENTS
                ================================================= */}

                <section
                  className="
                    grid
                    grid-cols-1
                    gap-5
                    lg:grid-cols-2
                  "
                >

                  {/* =================================================
                      TODAY LIVE CLASSES
                  ================================================= */}

                  <div
                    className="
                      overflow-hidden
                      rounded-[20px]
                      border
                      border-slate-100
                      bg-white
                      shadow-[0_10px_35px_rgba(15,23,42,0.04)]
                    "
                  >

                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        border-b
                        border-slate-100
                        px-5
                        py-5
                      "
                    >

                      <div
                        className="
                          flex
                          items-center
                          gap-2
                        "
                      >

                        <div
                          className="
                            flex
                            h-9
                            w-9
                            items-center
                            justify-center
                            rounded-xl
                            bg-red-50
                            text-red-500
                          "
                        >
                          <Video
                            className="h-4 w-4"
                          />
                        </div>


                        <div>

                          <h2
                            className="
                              text-lg
                              font-extrabold
                              text-[#07184c]
                            "
                          >
                            Today&apos;s Live Classes
                          </h2>


                          <p
                            className="
                              mt-0.5
                              text-[11px]
                              font-medium
                              text-slate-400
                            "
                          >
                            {getIndiaToday()}
                          </p>

                        </div>

                      </div>


                      <Link
                        href="/dashboard/digital-student/classes"
                        className="
                          flex
                          items-center
                          gap-1
                          text-xs
                          font-bold
                          text-teal-600
                          hover:text-teal-700
                        "
                      >
                        View All

                        <ArrowRight
                          className="h-3.5 w-3.5"
                        />

                      </Link>

                    </div>


                    <div
                      className="
                        px-5
                        pb-5
                      "
                    >

                      {loadingWidgets ? (

                        <DashboardLoading
                          text="Loading today's classes..."
                        />

                      ) : todayClasses.length >
                        0 ? (

                        <div
                          className="
                            divide-y
                            divide-slate-100
                          "
                        >

                          {todayClasses.map(
                            (
                              liveClass
                            ) => {

                              const status =
                                getLiveClassStatus(
                                  liveClass
                                );


                              const meetLink =
                                liveClass
                                  ?.meetLink ||
                                liveClass
                                  ?.googleMeetLink ||
                                liveClass
                                  ?.meetingLink ||
                                liveClass
                                  ?.link ||
                                "";


                              return (

                                <div
                                  key={
                                    liveClass.id
                                  }
                                  className="
                                    py-4
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
                                      className={`
                                        flex
                                        h-11
                                        w-11
                                        shrink-0
                                        items-center
                                        justify-center
                                        rounded-xl

                                        ${
                                          status ===
                                          "ongoing"

                                            ? "bg-red-50 text-red-500"

                                            : "bg-teal-50 text-teal-600"
                                        }
                                      `}
                                    >

                                      {status ===
                                      "ongoing" ? (

                                        <Radio
                                          className="
                                            h-5
                                            w-5
                                          "
                                        />

                                      ) : (

                                        <Video
                                          className="
                                            h-5
                                            w-5
                                          "
                                        />

                                      )}

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
                                          items-start
                                          justify-between
                                          gap-2
                                        "
                                      >

                                        <div
                                          className="
                                            min-w-0
                                          "
                                        >

                                          <h3
                                            className="
                                              truncate
                                              text-sm
                                              font-extrabold
                                              text-slate-800
                                            "
                                          >
                                            {liveClass
                                              ?.title ||
                                              liveClass
                                                ?.subject ||
                                              "Live Class"}
                                          </h3>


                                          <p
                                            className="
                                              mt-1
                                              text-xs
                                              font-medium
                                              text-slate-500
                                            "
                                          >
                                            {liveClass
                                              ?.subject ||
                                              "Subject"}

                                            {" • "}

                                            {liveClass
                                              ?.className ||
                                              studentClass}
                                          </p>

                                        </div>


                                        <LiveStatusBadge
                                          status={
                                            status
                                          }
                                        />

                                      </div>


                                      <div
                                        className="
                                          mt-3
                                          flex
                                          flex-wrap
                                          items-center
                                          justify-between
                                          gap-3
                                        "
                                      >

                                        <div
                                          className="
                                            flex
                                            items-center
                                            gap-1.5
                                            text-xs
                                            font-semibold
                                            text-slate-500
                                          "
                                        >

                                          <Clock3
                                            className="
                                              h-3.5
                                              w-3.5
                                              text-teal-500
                                            "
                                          />

                                          {formatClassTime(
                                            liveClass
                                              ?.startTime
                                          )}

                                          {liveClass
                                            ?.endTime
                                            ? ` - ${formatClassTime(
                                                liveClass
                                                  .endTime
                                              )}`
                                            : ""}

                                        </div>


                                        

                                      </div>


                                      {liveClass
                                        ?.description ? (

                                        <p
                                          className="
                                            mt-2
                                            line-clamp-2
                                            text-xs
                                            leading-5
                                            text-slate-400
                                          "
                                        >
                                          {liveClass
                                            .description}
                                        </p>

                                      ) : null}

                                    </div>

                                  </div>

                                </div>

                              );
                            }
                          )}

                        </div>

                      ) : (

                        <EmptyWidget
                          icon={
                            CalendarDays
                          }
                          text="No live classes scheduled for today"
                        />

                      )}

                    </div>

                  </div>


                  {/* =================================================
                      TEACHER ANNOUNCEMENTS
                      ONLY TEACHER MESSAGES
                      MAXIMUM 5
                  ================================================= */}

                  <div
                    className="
                      overflow-hidden
                      rounded-[20px]
                      border
                      border-slate-100
                      bg-white
                      shadow-[0_10px_35px_rgba(15,23,42,0.04)]
                    "
                  >

                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        border-b
                        border-slate-100
                        px-5
                        py-5
                      "
                    >

                      <div
                        className="
                          flex
                          items-center
                          gap-2
                        "
                      >

                        <div
                          className="
                            flex
                            h-9
                            w-9
                            items-center
                            justify-center
                            rounded-xl
                            bg-orange-50
                            text-orange-500
                          "
                        >
                          <Megaphone
                            className="h-4 w-4"
                          />
                        </div>


                        <div>

                          <h2
                            className="
                              text-lg
                              font-extrabold
                              text-[#07184c]
                            "
                          >
                            Teacher Announcements
                          </h2>


                          <p
                            className="
                              mt-0.5
                              text-[11px]
                              font-medium
                              text-slate-400
                            "
                          >
                            Messages from your assigned Ustad
                          </p>

                        </div>

                      </div>


                      <Link
                        href="/dashboard/digital-student/notices"
                        className="
                          flex
                          items-center
                          gap-1
                          text-xs
                          font-bold
                          text-teal-600
                          hover:text-teal-700
                        "
                      >
                        View All

                        <ArrowRight
                          className="h-3.5 w-3.5"
                        />

                      </Link>

                    </div>


                    <div
                      className="
                        px-5
                        pb-5
                      "
                    >

                      {loadingWidgets ? (

                        <DashboardLoading
                          text="Loading teacher messages..."
                        />

                      ) : teacherMessages.length >
                        0 ? (

                        <div
                          className="
                            divide-y
                            divide-slate-100
                          "
                        >

                          {teacherMessages
                            .slice(
                              0,
                              5
                            )
                            .map(
                              (
                                message,
                                index
                              ) => (

                                <Link
                                  key={
                                    `${message.id}-${index}`
                                  }
                                  href="/dashboard/digital-student/notices"
                                  className="
                                    group
                                    flex
                                    gap-3
                                    py-4
                                  "
                                >

                                  <div
                                    className="
                                      relative
                                      flex
                                      h-11
                                      w-11
                                      shrink-0
                                      items-center
                                      justify-center
                                      rounded-xl
                                      bg-orange-50
                                      text-orange-500
                                    "
                                  >

                                    <Megaphone
                                      className="
                                        h-5
                                        w-5
                                      "
                                    />


                                    {!message
                                      ?.read ? (

                                      <span
                                        className="
                                          absolute
                                          -right-0.5
                                          -top-0.5
                                          h-2.5
                                          w-2.5
                                          rounded-full
                                          border-2
                                          border-white
                                          bg-red-500
                                        "
                                      />

                                    ) : null}

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
                                        items-start
                                        justify-between
                                        gap-2
                                      "
                                    >

                                      <h3
                                        className="
                                          truncate
                                          text-sm
                                          font-extrabold
                                          text-slate-800
                                          transition
                                          group-hover:text-teal-600
                                        "
                                      >
                                        {message
                                          ?.title ||
                                          "Teacher Message"}
                                      </h3>


                                      {!message
                                        ?.read ? (

                                        <span
                                          className="
                                            shrink-0
                                            rounded-full
                                            bg-teal-50
                                            px-2
                                            py-0.5
                                            text-[9px]
                                            font-extrabold
                                            uppercase
                                            tracking-wide
                                            text-teal-600
                                          "
                                        >
                                          New
                                        </span>

                                      ) : null}

                                    </div>


                                    <p
                                      className="
                                        mt-1
                                        line-clamp-2
                                        text-xs
                                        leading-5
                                        text-slate-500
                                      "
                                    >
                                      {message
                                        ?.message ||
                                        message
                                          ?.content ||
                                        "No message content"}
                                    </p>


                                    <div
                                      className="
                                        mt-2
                                        flex
                                        items-center
                                        justify-between
                                        gap-3
                                      "
                                    >

                                      <p
                                        className="
                                          truncate
                                          text-[11px]
                                          font-semibold
                                          text-slate-400
                                        "
                                      >
                                        {message
                                          ?.senderName ||
                                          studentData
                                            ?.assignedDigitalTeacherName ||
                                          "Digital Teacher"}
                                      </p>


                                      <p
                                        className="
                                          shrink-0
                                          text-[10px]
                                          font-medium
                                          text-slate-400
                                        "
                                      >
                                        {formatMessageDate(
                                          message
                                            ?.createdAt
                                        )}
                                      </p>

                                    </div>

                                  </div>


                                  <ArrowRight
                                    className="
                                      mt-3
                                      h-4
                                      w-4
                                      shrink-0
                                      text-slate-300
                                      transition
                                      group-hover:translate-x-0.5
                                      group-hover:text-teal-500
                                    "
                                  />

                                </Link>

                              )
                            )}

                        </div>

                      ) : (

                        <EmptyWidget
                          icon={Bell}
                          text="No teacher announcements available"
                        />

                      )}

                    </div>

                  </div>

                </section>


                {/* =================================================
                    ISLAMIC BANNER
                ================================================= */}

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

                      <BookOpen
                        className="
                          mx-auto
                          mb-3
                          h-8
                          w-8
                          text-teal-600
                        "
                      />


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


                      <p
                        className="
                          mt-3
                          text-xs
                          font-semibold
                          text-teal-600
                        "
                      >
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


              {/* =================================================
                  RIGHT SIDEBAR
              ================================================= */}

              <aside
                className="
                  space-y-5
                "
              >

                {/* =================================================
                    CALENDAR
                ================================================= */}

                <DashboardCard>

                  <div
                    className="
                      mb-5
                      flex
                      items-center
                      justify-between
                    "
                  >

                    <h2
                      className="
                        text-base
                        font-extrabold
                        text-[#07184c]
                      "
                    >
                      {new Date()
                        .toLocaleString(
                          "default",
                          {
                            month:
                              "long",
                          }
                        )}{" "}

                      {new Date()
                        .getFullYear()}
                    </h2>


                    <CalendarDays
                      className="
                        h-5
                        w-5
                        text-teal-600
                      "
                    />

                  </div>


                  <MiniCalendar />

                </DashboardCard>


                {/* =================================================
                    TEACHER INFORMATION
                ================================================= */}

                <div
                  className="
                    rounded-[20px]
                    border
                    border-slate-100
                    bg-white
                    p-5
                    shadow-sm
                  "
                >

                  <div
                    className="
                      mb-5
                      flex
                      items-center
                      justify-between
                    "
                  >

                    <h3
                      className="
                        text-[12px]
                        font-bold
                        uppercase
                        tracking-wide
                        text-slate-400
                      "
                    >
                      Teacher Information
                    </h3>


                    <UserRound
                      className="
                        h-4
                        w-4
                        text-teal-500
                      "
                    />

                  </div>


                  {assignedTeacher ? (

                    <div
                      className="
                        space-y-0
                      "
                    >

                      <div
                        className="
                          flex
                          items-center
                          justify-between
                          border-b
                          border-slate-100
                          py-3
                        "
                      >

                        <span
                          className="
                            text-xs
                            text-slate-400
                          "
                        >
                          Teacher Name
                        </span>


                        <span
                          className="
                            max-w-[160px]
                            truncate
                            text-right
                            text-xs
                            font-semibold
                            text-slate-800
                          "
                        >
                          {assignedTeacher
                            .fullName}
                        </span>

                      </div>


                      <div
                        className="
                          flex
                          items-center
                          justify-between
                          border-b
                          border-slate-100
                          py-3
                        "
                      >

                        <span
                          className="
                            text-xs
                            text-slate-400
                          "
                        >
                          Teacher ID
                        </span>


                        <span
                          className="
                            text-xs
                            font-semibold
                            text-slate-800
                          "
                        >
                          {assignedTeacher
                            .mhrId ||
                            "-"}
                        </span>

                      </div>


                      <div
                        className="
                          flex
                          items-center
                          justify-between
                          py-3
                        "
                      >

                        <span
                          className="
                            text-xs
                            text-slate-400
                          "
                        >
                          Status
                        </span>


                        <span
                          className="
                            inline-flex
                            items-center
                            gap-1
                            rounded-full
                            bg-emerald-50
                            px-3
                            py-1
                            text-[10px]
                            font-bold
                            text-emerald-600
                          "
                        >

                          <span
                            className="
                              h-2
                              w-2
                              rounded-full
                              bg-emerald-500
                            "
                          />

                          Active

                        </span>

                      </div>

                    </div>

                  ) : (

                    <div
                      className="
                        flex
                        min-h-[150px]
                        items-center
                        justify-center
                        text-center
                      "
                    >

                      <div>

                        <UserRound
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
                          No Teacher Assigned
                        </p>


                        <p
                          className="
                            mt-1
                            text-xs
                            text-slate-400
                          "
                        >
                          A Digital Teacher has not been assigned yet.
                        </p>

                      </div>

                    </div>

                  )}

                </div>


                {/* =================================================
                    STUDENT INFORMATION
                ================================================= */}

                <DashboardCard>

                  <p
                    className="
                      mb-4
                      text-xs
                      font-bold
                      uppercase
                      tracking-wider
                      text-slate-400
                    "
                  >
                    Student Information
                  </p>


                  <StudentInfo
                    label="Class"
                    value={
                      studentClass
                    }
                  />


                  <StudentInfo
                    label="Digital Admission No."
                    value={
                      studentData
                        ?.digitalAdmissionNumber ||
                      "N/A"
                    }
                  />


                  <StudentInfo
                    label="Status"
                    value={
                      studentData
                        ?.accountStatus ||
                      studentData
                        ?.status ||
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