"use client";

import {
  useMemo,
  useState,
} from "react";

import Layout from "@/components/digitalclassroom/Layout";

import {
  Bell,
  CheckCheck,
  ChevronRight,
  Clock3,
  Mail,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";


/* =========================================================
   DEMO CENTRAL ADMIN MESSAGES
   Later replace with Firebase
========================================================= */

const ADMIN_MESSAGES = [
  {
    id: "admin-1",
    title: "Digital Classroom Guidelines",
    message:
      "All Digital Teachers are requested to follow the updated online class guidelines from October 2026.",
    senderName: "Central Admin",
    date: "24 Sep 2026",
    time: "10:15 AM",
    priority: "important",
    read: false,
  },

  {
    id: "admin-2",
    title: "Teacher Training Programme",
    message:
      "A Digital Teacher training session will be conducted this Saturday. Please check your schedule.",
    senderName: "Central Admin",
    date: "23 Sep 2026",
    time: "04:30 PM",
    priority: "normal",
    read: true,
  },

  {
    id: "admin-3",
    title: "Study Material Upload",
    message:
      "Teachers are requested to upload the study materials for assigned classes before the upcoming week.",
    senderName: "Central Admin",
    date: "21 Sep 2026",
    time: "09:20 AM",
    priority: "normal",
    read: true,
  },
];


/* =========================================================
   DEMO DIGITAL STUDENTS
========================================================= */

const STUDENTS = [
  {
    id: "stu-1",
    name: "Muhammed Jasim",
    admissionNo: "DS001",
    className: "Class 5",
    profilePictureUrl: "",
  },
  {
    id: "stu-2",
    name: "Ahmed Faris",
    admissionNo: "DS002",
    className: "Class 5",
    profilePictureUrl: "",
  },
  {
    id: "stu-3",
    name: "Fathima Nihala",
    admissionNo: "DS003",
    className: "Class 5",
    profilePictureUrl: "",
  },
  {
    id: "stu-4",
    name: "Maryam Irha",
    admissionNo: "DS004",
    className: "Class 6",
    profilePictureUrl: "",
  },
  {
    id: "stu-5",
    name: "Muhammed Hanan",
    admissionNo: "DS005",
    className: "Class 6",
    profilePictureUrl: "",
  },
  {
    id: "stu-6",
    name: "Rameesa Sherin",
    admissionNo: "DS006",
    className: "Class 7",
    profilePictureUrl: "",
  },
];


/* =========================================================
   DEMO SENT MESSAGES
========================================================= */

const INITIAL_SENT_MESSAGES = [
  {
    id: "sent-1",
    title: "Assignment Reminder",
    message:
      "Please submit your Quran assignment before tomorrow evening.",
    recipientName: "Class 5 - All Students",
    className: "Class 5",
    date: "24 Sep 2026",
    time: "09:20 AM",
    status: "delivered",
  },

  {
    id: "sent-2",
    title: "Live Class Update",
    message:
      "Today's Arabic live class will start at 3:30 PM.",
    recipientName: "Maryam Irha",
    className: "Class 6",
    date: "23 Sep 2026",
    time: "02:15 PM",
    status: "read",
  },
];


/* =========================================================
   AVATAR
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
      student?.name || "Student",
    )
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0),
      )
      .join("")
      .toUpperCase();

  return (
    <div
      className="
        flex
        h-10
        w-10
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
          alt={student?.name}
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
            text-[10px]
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
    Icon || Mail;

  const styles = {
    teal: {
      card:
        "border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50",

      icon:
        "bg-teal-100 text-teal-600",
    },

    blue: {
      card:
        "border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50",

      icon:
        "bg-blue-100 text-blue-600",
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
   ADMIN MESSAGE CARD
========================================================= */

function AdminMessageCard({
  message,
  selected,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full
        border-b
        border-slate-100
        p-4
        text-left
        transition
        last:border-b-0

        ${
          selected
            ? "bg-teal-50"
            : "bg-white hover:bg-slate-50"
        }
      `}
    >
      <div
        className="
          flex
          gap-3
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
            bg-teal-100
            text-teal-600
          "
        >
          <ShieldCheck className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="
              flex
              items-start
              justify-between
              gap-2
            "
          >
            <div className="min-w-0">
              <p
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-wide
                  text-teal-600
                "
              >
                {message.senderName}
              </p>

              <h3
                className={`
                  mt-1
                  truncate
                  text-xs
                  text-slate-900

                  ${
                    !message.read
                      ? "font-bold"
                      : "font-semibold"
                  }
                `}
              >
                {message.title}
              </h3>
            </div>

            {!message.read && (
              <span
                className="
                  mt-1
                  h-2
                  w-2
                  shrink-0
                  rounded-full
                  bg-teal-500
                "
              />
            )}
          </div>

          <p
            className="
              mt-1
              line-clamp-2
              text-[10px]
              leading-4
              text-slate-500
            "
          >
            {message.message}
          </p>

          <div
            className="
              mt-2
              flex
              items-center
              justify-between
              gap-2
            "
          >
            <span
              className="
                text-[9px]
                text-slate-400
              "
            >
              {message.date} •{" "}
              {message.time}
            </span>

            {message.priority ===
              "important" && (
              <span
                className="
                  rounded-full
                  bg-red-50
                  px-2
                  py-0.5
                  text-[8px]
                  font-bold
                  uppercase
                  text-red-500
                "
              >
                Important
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}


/* =========================================================
   MAIN PAGE
========================================================= */

export default function DigitalTeacherMessagesPage() {
  const [
    adminMessages,
  ] = useState(
    ADMIN_MESSAGES,
  );

  const [
    sentMessages,
    setSentMessages,
  ] = useState(
    INITIAL_SENT_MESSAGES,
  );

  const [
    activeTab,
    setActiveTab,
  ] = useState("admin");

  const [
    selectedAdminMessage,
    setSelectedAdminMessage,
  ] = useState(
    ADMIN_MESSAGES[0] || null,
  );

  const [
    selectedClass,
    setSelectedClass,
  ] = useState("Class 5");

  const [
    selectedStudent,
    setSelectedStudent,
  ] = useState("all");

  const [
    studentSearch,
    setStudentSearch,
  ] = useState("");

  const [
    messageTitle,
    setMessageTitle,
  ] = useState("");

  const [
    messageBody,
    setMessageBody,
  ] = useState("");

  const [
    sending,
    setSending,
  ] = useState(false);


  /* =====================================================
     CLASSES
  ===================================================== */

  const classOptions =
    useMemo(() => {
      return [
        ...new Set(
          STUDENTS.map(
            (student) =>
              student.className,
          ),
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
    }, []);


  /* =====================================================
     CLASS STUDENTS
  ===================================================== */

  const classStudents =
    useMemo(() => {
      const text =
        studentSearch
          .trim()
          .toLowerCase();

      return STUDENTS.filter(
        (student) => {
          if (
            student.className !==
            selectedClass
          ) {
            return false;
          }

          if (!text) {
            return true;
          }

          return [
            student.name,
            student.admissionNo,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(text);
        },
      );
    }, [
      selectedClass,
      studentSearch,
    ]);


  /* =====================================================
     COUNTS
  ===================================================== */

  const unreadAdmin =
    adminMessages.filter(
      (message) =>
        !message.read,
    ).length;


  /* =====================================================
     SEND MESSAGE
  ===================================================== */

  const handleSendMessage =
    async () => {
      if (
        !selectedClass
      ) {
        alert(
          "Please select a class",
        );

        return;
      }

      if (
        !messageTitle.trim()
      ) {
        alert(
          "Please enter message title",
        );

        return;
      }

      if (
        !messageBody.trim()
      ) {
        alert(
          "Please enter message",
        );

        return;
      }


      const recipient =
        selectedStudent ===
        "all"
          ? {
              name: `${selectedClass} - All Students`,
            }
          : STUDENTS.find(
              (student) =>
                student.id ===
                selectedStudent,
            );


      if (
        selectedStudent !==
          "all" &&
        !recipient
      ) {
        alert(
          "Student not found",
        );

        return;
      }


      setSending(true);


      try {
        /*
         * Firebase send will be added here.
         */

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              500,
            ),
        );


        const now =
          new Date();


        const sentMessage = {
          id:
            `sent-${Date.now()}`,

          title:
            messageTitle.trim(),

          message:
            messageBody.trim(),

          recipientName:
            recipient?.name ||
            "Students",

          className:
            selectedClass,

          date:
            now.toLocaleDateString(
              "en-IN",
            ),

          time:
            now.toLocaleTimeString(
              "en-IN",
              {
                hour:
                  "2-digit",
                minute:
                  "2-digit",
              },
            ),

          status:
            "delivered",
        };


        setSentMessages(
          (previous) => [
            sentMessage,
            ...previous,
          ],
        );


        setMessageTitle("");

        setMessageBody("");


        alert(
          "Message sent successfully",
        );
      } catch (error) {
        console.error(
          "Message send error:",
          error,
        );
      } finally {
        setSending(false);
      }
    };


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
                bg-emerald-100
                text-emerald-600
              "
            >
              <MessageCircle className="h-6 w-6" />
            </div>

            <div>
              <h1
                className="
                  text-2xl
                  font-bold
                  text-slate-900
                "
              >
                Messages
              </h1>

              <p
                className="
                  mt-1
                  text-sm
                  text-slate-500
                "
              >
                View Central Admin
                messages and communicate
                with your Digital Students
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
              sm:grid-cols-3
            "
          >
            <SummaryCard
              title="Admin Messages"
              value={
                adminMessages.length
              }
              description={`${unreadAdmin} unread`}
              icon={ShieldCheck}
              type="teal"
            />

            <SummaryCard
              title="Sent Messages"
              value={
                sentMessages.length
              }
              description="Teacher to students"
              icon={Send}
              type="blue"
            />

            <SummaryCard
              title="Assigned Students"
              value={
                STUDENTS.length
              }
              description="Digital classroom"
              icon={Users}
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
            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "admin",
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
                transition

                ${
                  activeTab ===
                  "admin"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                    : "bg-white text-slate-600"
                }
              `}
            >
              <Bell className="h-4 w-4" />

              Central Admin

              {unreadAdmin > 0 && (
                <span
                  className="
                    flex
                    h-5
                    min-w-5
                    items-center
                    justify-center
                    rounded-full
                    bg-red-500
                    px-1
                    text-[9px]
                    font-bold
                    text-white
                  "
                >
                  {unreadAdmin}
                </span>
              )}
            </button>


            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "compose",
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
                transition

                ${
                  activeTab ===
                  "compose"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                    : "bg-white text-slate-600"
                }
              `}
            >
              <Send className="h-4 w-4" />

              Message Students
            </button>


            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "sent",
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
                transition

                ${
                  activeTab ===
                  "sent"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                    : "bg-white text-slate-600"
                }
              `}
            >
              <CheckCheck className="h-4 w-4" />

              Sent Messages
            </button>
          </div>


          {/* =====================================
              CENTRAL ADMIN MESSAGES
          ====================================== */}

          {activeTab ===
            "admin" && (
            <div
              className="
                grid
                grid-cols-1
                overflow-hidden
                rounded-2xl
                border
                border-slate-200
                bg-white
                shadow-sm
                lg:grid-cols-[360px_minmax(0,1fr)]
              "
            >
              {/* MESSAGE LIST */}

              <div
                className="
                  border-b
                  border-slate-200
                  lg:border-b-0
                  lg:border-r
                "
              >
                <div
                  className="
                    border-b
                    border-slate-100
                    px-4
                    py-4
                  "
                >
                  <h2
                    className="
                      text-sm
                      font-bold
                      text-slate-900
                    "
                  >
                    Central Admin
                  </h2>

                  <p
                    className="
                      mt-1
                      text-[10px]
                      text-slate-400
                    "
                  >
                    Official messages and
                    announcements
                  </p>
                </div>


                {adminMessages.map(
                  (message) => (
                    <AdminMessageCard
                      key={
                        message.id
                      }
                      message={
                        message
                      }
                      selected={
                        selectedAdminMessage
                          ?.id ===
                        message.id
                      }
                      onClick={() =>
                        setSelectedAdminMessage(
                          message,
                        )
                      }
                    />
                  ),
                )}
              </div>


              {/* MESSAGE VIEW */}

              <div
                className="
                  min-h-[470px]
                  p-5
                  md:p-7
                "
              >
                {selectedAdminMessage ? (
                  <>
                    <div
                      className="
                        flex
                        items-start
                        gap-3
                        border-b
                        border-slate-100
                        pb-5
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
                          bg-teal-100
                          text-teal-600
                        "
                      >
                        <ShieldCheck className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p
                          className="
                            text-[10px]
                            font-bold
                            uppercase
                            tracking-wider
                            text-teal-600
                          "
                        >
                          Central Admin
                        </p>

                        <h2
                          className="
                            mt-1
                            text-lg
                            font-bold
                            text-slate-900
                          "
                        >
                          {
                            selectedAdminMessage.title
                          }
                        </h2>

                        <p
                          className="
                            mt-1
                            text-[10px]
                            text-slate-400
                          "
                        >
                          {
                            selectedAdminMessage.date
                          }{" "}
                          •{" "}
                          {
                            selectedAdminMessage.time
                          }
                        </p>
                      </div>
                    </div>


                    <div
                      className="
                        py-6
                        text-sm
                        leading-7
                        text-slate-600
                      "
                    >
                      {
                        selectedAdminMessage.message
                      }
                    </div>


                    <div
                      className="
                        rounded-xl
                        border
                        border-blue-100
                        bg-blue-50
                        p-4
                      "
                    >
                      <div
                        className="
                          flex
                          items-start
                          gap-3
                        "
                      >
                        <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-500" />

                        <div>
                          <p
                            className="
                              text-xs
                              font-bold
                              text-blue-800
                            "
                          >
                            Official Admin Message
                          </p>

                          <p
                            className="
                              mt-1
                              text-[10px]
                              leading-5
                              text-blue-600
                            "
                          >
                            Messages from
                            Central Admin are
                            view-only for
                            Digital Teachers.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div
                    className="
                      flex
                      h-full
                      min-h-[400px]
                      items-center
                      justify-center
                      text-center
                    "
                  >
                    <div>
                      <Mail
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
                          text-slate-500
                        "
                      >
                        Select a message
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}


          {/* =====================================
              MESSAGE STUDENTS
          ====================================== */}

          {activeTab ===
            "compose" && (
            <div
              className="
                grid
                grid-cols-1
                gap-5
                xl:grid-cols-[330px_minmax(0,1fr)]
              "
            >
              {/* RECIPIENT */}

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
                  <Users className="h-5 w-5 text-teal-600" />

                  <h2
                    className="
                      text-sm
                      font-bold
                      text-slate-900
                    "
                  >
                    Select Students
                  </h2>
                </div>


                {/* CLASS */}

                <div className="mt-5">
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

                      setSelectedStudent(
                        "all",
                      );
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
                      text-slate-700
                      outline-none
                      focus:border-teal-400
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
                          {className}
                        </option>
                      ),
                    )}
                  </select>
                </div>


                {/* SEARCH */}

                <div className="relative mt-3">
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
                      studentSearch
                    }
                    onChange={(
                      event,
                    ) =>
                      setStudentSearch(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Search student..."
                    className="
                      h-10
                      w-full
                      rounded-lg
                      border
                      border-slate-200
                      pl-9
                      pr-3
                      text-sm
                      outline-none
                      focus:border-teal-400
                    "
                  />
                </div>


                {/* ALL STUDENTS */}

                <button
                  type="button"
                  onClick={() =>
                    setSelectedStudent(
                      "all",
                    )
                  }
                  className={`
                    mt-4
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-xl
                    border
                    p-3
                    text-left
                    transition

                    ${
                      selectedStudent ===
                      "all"
                        ? "border-teal-300 bg-teal-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }
                  `}
                >
                  <div
                    className="
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-full
                      bg-teal-100
                      text-teal-600
                    "
                  >
                    <Users className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className="
                        text-xs
                        font-bold
                        text-slate-800
                      "
                    >
                      All Students
                    </p>

                    <p
                      className="
                        mt-0.5
                        text-[9px]
                        text-slate-400
                      "
                    >
                      {
                        classStudents.length
                      }{" "}
                      students
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>


                {/* STUDENTS */}

                <div
                  className="
                    mt-3
                    max-h-[350px]
                    space-y-2
                    overflow-y-auto
                  "
                >
                  {classStudents.map(
                    (
                      student,
                    ) => (
                      <button
                        type="button"
                        key={
                          student.id
                        }
                        onClick={() =>
                          setSelectedStudent(
                            student.id,
                          )
                        }
                        className={`
                          flex
                          w-full
                          items-center
                          gap-3
                          rounded-xl
                          border
                          p-2.5
                          text-left
                          transition

                          ${
                            selectedStudent ===
                            student.id
                              ? "border-teal-300 bg-teal-50"
                              : "border-slate-100 hover:bg-slate-50"
                          }
                        `}
                      >
                        <StudentAvatar
                          student={
                            student
                          }
                        />

                        <div className="min-w-0">
                          <p
                            className="
                              truncate
                              text-xs
                              font-semibold
                              text-slate-800
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
                            {
                              student.admissionNo
                            }
                          </p>
                        </div>
                      </button>
                    ),
                  )}
                </div>
              </div>


              {/* COMPOSE */}

              <div
                className="
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  p-5
                  shadow-sm
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-2
                    border-b
                    border-slate-100
                    pb-4
                  "
                >
                  <Send className="h-5 w-5 text-teal-600" />

                  <div>
                    <h2
                      className="
                        text-sm
                        font-bold
                        text-slate-900
                      "
                    >
                      New Message
                    </h2>

                    <p
                      className="
                        mt-0.5
                        text-[10px]
                        text-slate-400
                      "
                    >
                      Send a message to
                      your Digital Students
                    </p>
                  </div>
                </div>


                {/* TO */}

                <div
                  className="
                    mt-5
                    rounded-xl
                    border
                    border-teal-100
                    bg-teal-50
                    p-3
                  "
                >
                  <p
                    className="
                      text-[9px]
                      font-semibold
                      uppercase
                      tracking-wide
                      text-teal-600
                    "
                  >
                    Message To
                  </p>

                  <p
                    className="
                      mt-1
                      text-sm
                      font-bold
                      text-teal-900
                    "
                  >
                    {selectedStudent ===
                    "all"
                      ? `${selectedClass} - All Students`
                      : STUDENTS.find(
                          (
                            student,
                          ) =>
                            student.id ===
                            selectedStudent,
                        )?.name ||
                        "Select Student"}
                  </p>
                </div>


                {/* TITLE */}

                <div className="mt-5">
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
                    Subject / Title
                  </label>

                  <input
                    value={
                      messageTitle
                    }
                    onChange={(
                      event,
                    ) =>
                      setMessageTitle(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Enter message title..."
                    maxLength={100}
                    className="
                      h-11
                      w-full
                      rounded-xl
                      border
                      border-slate-200
                      px-4
                      text-sm
                      text-slate-700
                      outline-none
                      focus:border-teal-400
                      focus:ring-2
                      focus:ring-teal-100
                    "
                  />
                </div>


                {/* MESSAGE */}

                <div className="mt-4">
                  <div
                    className="
                      mb-1.5
                      flex
                      items-center
                      justify-between
                    "
                  >
                    <label
                      className="
                        text-[10px]
                        font-semibold
                        uppercase
                        tracking-wide
                        text-slate-500
                      "
                    >
                      Message
                    </label>

                    <span
                      className="
                        text-[9px]
                        text-slate-400
                      "
                    >
                      {
                        messageBody.length
                      }
                      /1000
                    </span>
                  </div>

                  <textarea
                    value={
                      messageBody
                    }
                    onChange={(
                      event,
                    ) =>
                      setMessageBody(
                        event.target
                          .value,
                      )
                    }
                    maxLength={1000}
                    rows={10}
                    placeholder="Write your message to students..."
                    className="
                      w-full
                      resize-none
                      rounded-xl
                      border
                      border-slate-200
                      p-4
                      text-sm
                      leading-6
                      text-slate-700
                      outline-none
                      focus:border-teal-400
                      focus:ring-2
                      focus:ring-teal-100
                    "
                  />
                </div>


                <div
                  className="
                    mt-5
                    flex
                    items-center
                    justify-end
                  "
                >
                  <button
                    type="button"
                    onClick={
                      handleSendMessage
                    }
                    disabled={
                      sending
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
                      shadow-teal-100
                      transition
                      hover:-translate-y-0.5
                      hover:shadow-lg
                      disabled:opacity-50
                    "
                  >
                    <Send className="h-4 w-4" />

                    {sending
                      ? "Sending..."
                      : "Send Message"}
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* =====================================
              SENT MESSAGES
          ====================================== */}

          {activeTab ===
            "sent" && (
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
                  border-b
                  border-slate-100
                  px-5
                  py-4
                "
              >
                <h2
                  className="
                    text-sm
                    font-bold
                    text-slate-900
                  "
                >
                  Sent Messages
                </h2>

                <p
                  className="
                    mt-1
                    text-[10px]
                    text-slate-400
                  "
                >
                  Messages sent to your
                  Digital Students
                </p>
              </div>


              {sentMessages.map(
                (message) => (
                  <div
                    key={
                      message.id
                    }
                    className="
                      flex
                      flex-col
                      gap-3
                      border-b
                      border-slate-100
                      p-4
                      last:border-b-0
                      md:flex-row
                      md:items-center
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
                        bg-blue-50
                        text-blue-500
                      "
                    >
                      <Send className="h-4 w-4" />
                    </div>

                    <div
                      className="
                        min-w-0
                        flex-1
                      "
                    >
                      <h3
                        className="
                          text-xs
                          font-bold
                          text-slate-900
                        "
                      >
                        {
                          message.title
                        }
                      </h3>

                      <p
                        className="
                          mt-1
                          line-clamp-1
                          text-[10px]
                          text-slate-500
                        "
                      >
                        {
                          message.message
                        }
                      </p>

                      <div
                        className="
                          mt-2
                          flex
                          flex-wrap
                          items-center
                          gap-2
                          text-[9px]
                          text-slate-400
                        "
                      >
                        <span>
                          To:{" "}
                          {
                            message.recipientName
                          }
                        </span>

                        <span>
                          •
                        </span>

                        <span>
                          {
                            message.date
                          }{" "}
                          {
                            message.time
                          }
                        </span>
                      </div>
                    </div>


                    <div>
                      <span
                        className={`
                          inline-flex
                          items-center
                          gap-1.5
                          rounded-full
                          px-3
                          py-1
                          text-[9px]
                          font-semibold

                          ${
                            message.status ===
                            "read"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-blue-50 text-blue-600"
                          }
                        `}
                      >
                        <CheckCheck className="h-3 w-3" />

                        {message.status ===
                        "read"
                          ? "Read"
                          : "Delivered"}
                      </span>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}