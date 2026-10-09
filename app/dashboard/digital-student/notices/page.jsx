"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Bell,
  CheckCheck,
  Clock3,
  Inbox,
  Mail,
  MailOpen,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import Layout from "@/components/digitalclassroom/Layout";

import useAuthStore from "@/lib/authStore";

import {
  getMyDigitalStudentMessages,
  markDigitalStudentMessageRead,
} from "@/lib/digitalClassStudentService";


/* =========================================================
   FORMAT DATE
========================================================= */

function formatMessageDate(
  value
) {
  if (!value) {
    return {
      date: "-",
      time: "",
    };
  }

  try {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return {
        date: "-",
        time: "",
      };
    }

    const now =
      new Date();

    const today =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

    const messageDay =
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );

    const difference =
      Math.round(
        (
          today.getTime() -
          messageDay.getTime()
        ) /
          86400000
      );

    let dateText;

    if (
      difference === 0
    ) {
      dateText =
        "Today";
    } else if (
      difference === 1
    ) {
      dateText =
        "Yesterday";
    } else {
      dateText =
        date.toLocaleDateString(
          "en-IN",
          {
            day:
              "2-digit",

            month:
              "short",

            year:
              "numeric",
          }
        );
    }

    const timeText =
      date.toLocaleTimeString(
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

    return {
      date:
        dateText,

      time:
        timeText,
    };
  } catch {
    return {
      date: "-",
      time: "",
    };
  }
}


/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  icon: Icon,
  title,
  value,
  description,
  iconClass,
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-center gap-4">

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">

          <p className="text-2xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-0.5 text-sm font-semibold text-slate-700">
            {title}
          </p>

          <p className="mt-0.5 text-xs text-slate-400">
            {description}
          </p>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   PAGE
========================================================= */

export default function DigitalStudentMessagesPage() {
  const {
    user,
    userData,
  } = useAuthStore();


  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    activeTab,
    setActiveTab,
  ] = useState("all");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    selectedMessage,
    setSelectedMessage,
  ] = useState(null);

  const [
    markingReadId,
    setMarkingReadId,
  ] = useState(null);


  const studentName =
    userData?.fullName ||
    userData?.studentName ||
    user?.displayName ||
    "Student";


  /* =====================================================
     LOAD MESSAGES
  ===================================================== */

  const loadMessages =
    useCallback(
      async (
        silent = false
      ) => {
        if (!user?.uid) {
          setMessages([]);
          setLoading(false);

          return;
        }

        try {
          if (silent) {
            setRefreshing(
              true
            );
          } else {
            setLoading(
              true
            );
          }

          const result =
            await getMyDigitalStudentMessages();

          const loaded =
            Array.isArray(
              result?.messages
            )
              ? result.messages
              : [];

          setMessages(
            loaded
          );
        } catch (error) {
          console.log(
            "LOAD STUDENT MESSAGES ERROR:",
            error?.message
          );

          setMessages([]);
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      [user?.uid]
    );


  useEffect(() => {
    loadMessages();
  }, [loadMessages]);


  /* =====================================================
     COUNTS
  ===================================================== */

  const unreadCount =
    useMemo(
      () =>
        messages.filter(
          (message) =>
            !message?.read
        ).length,
      [messages]
    );


  const centralCount =
    useMemo(
      () =>
        messages.filter(
          (message) =>
            message?.source ===
            "central_admin"
        ).length,
      [messages]
    );


  const teacherCount =
    useMemo(
      () =>
        messages.filter(
          (message) =>
            message?.source ===
            "teacher"
        ).length,
      [messages]
    );


  /* =====================================================
     FILTER
  ===================================================== */

  const filteredMessages =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return messages.filter(
        (message) => {
          if (
            activeTab ===
              "central" &&
            message?.source !==
              "central_admin"
          ) {
            return false;
          }

          if (
            activeTab ===
              "teacher" &&
            message?.source !==
              "teacher"
          ) {
            return false;
          }

          if (
            activeTab ===
              "unread" &&
            message?.read
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return (
            String(
              message?.title ||
              ""
            )
              .toLowerCase()
              .includes(query) ||

            String(
              message?.message ||
              ""
            )
              .toLowerCase()
              .includes(query) ||

            String(
              message?.senderName ||
              ""
            )
              .toLowerCase()
              .includes(query)
          );
        }
      );
    }, [
      messages,
      activeTab,
      search,
    ]);


  /* =====================================================
     OPEN MESSAGE
  ===================================================== */

  const handleOpenMessage =
    async (
      message
    ) => {
      if (!message) {
        return;
      }

      setSelectedMessage(
        message
      );

      if (
        message?.read
      ) {
        return;
      }

      const readKey =
        `${message.source}_${message.id}`;

      try {
        setMarkingReadId(
          readKey
        );

        /*
         * Update UI immediately.
         */

        setMessages(
          (previous) =>
            previous.map(
              (item) =>
                item.id ===
                  message.id &&
                item.source ===
                  message.source
                  ? {
                      ...item,
                      read:
                        true,
                    }
                  : item
            )
        );

        setSelectedMessage(
          (current) =>
            current
              ? {
                  ...current,
                  read:
                    true,
                }
              : current
        );

        await markDigitalStudentMessageRead(
          message.source,
          message.id
        );
      } catch (error) {
        console.log(
          "MARK MESSAGE READ ERROR:",
          error?.message
        );
      } finally {
        setMarkingReadId(
          null
        );
      }
    };


  /* =====================================================
     TAB
  ===================================================== */

  const tabs = [
    {
      id:
        "all",

      label:
        "All",

      count:
        messages.length,
    },

    {
      id:
        "central",

      label:
        "Central Admin",

      count:
        centralCount,
    },

    {
      id:
        "teacher",

      label:
        "Teacher",

      count:
        teacherCount,
    },

    {
      id:
        "unread",

      label:
        "Unread",

      count:
        unreadCount,
    },
  ];


  return (
    <Layout user={user}>

      <main className="min-h-screen bg-[#f7faf9]">

        <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">


          {/* =====================================
              HEADER
          ====================================== */}

          <section className="relative overflow-hidden rounded-[30px] border border-teal-100 bg-gradient-to-r from-white via-[#f5fbf8] to-[#dff5ef] p-6 shadow-sm sm:p-8">

            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full border-[24px] border-teal-700/5" />

            <Bell className="absolute right-12 top-8 h-20 w-20 text-teal-700/5" />

            <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              <div>

                <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">

                  <MessageCircle className="h-4 w-4" />

                  Digital Classroom

                </div>

                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Messages
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  Assalamu Alaikum{" "}
                  {studentName}. View
                  important messages from
                  Central Admin and your
                  assigned Digital Teacher.
                </p>

              </div>


              <button
                type="button"
                onClick={() =>
                  loadMessages(true)
                }
                disabled={
                  refreshing
                }
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-teal-200 bg-white px-4 text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />

                Refresh
              </button>

            </div>

          </section>


          {/* =====================================
              SUMMARY
          ====================================== */}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <SummaryCard
              icon={Inbox}
              value={
                messages.length
              }
              title="Total Messages"
              description="Central Admin + Teacher"
              iconClass="bg-teal-100 text-teal-700"
            />

            <SummaryCard
              icon={Mail}
              value={
                unreadCount
              }
              title="Unread"
              description="Needs your attention"
              iconClass="bg-amber-100 text-amber-700"
            />

            <SummaryCard
              icon={ShieldCheck}
              value={
                centralCount
              }
              title="Central Admin"
              description="DKJU announcements"
              iconClass="bg-blue-100 text-blue-700"
            />

            <SummaryCard
              icon={UserRound}
              value={
                teacherCount
              }
              title="Teacher Messages"
              description="From your Digital Teacher"
              iconClass="bg-violet-100 text-violet-700"
            />

          </section>


          {/* =====================================
              TOOLBAR
          ====================================== */}

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">


              {/* TABS */}

              <div className="flex flex-wrap gap-2">

                {tabs.map(
                  (tab) => {
                    const active =
                      activeTab ===
                      tab.id;

                    return (
                      <button
                        key={
                          tab.id
                        }
                        type="button"
                        onClick={() =>
                          setActiveTab(
                            tab.id
                          )
                        }
                        className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                          active
                            ? "bg-teal-700 text-white shadow-sm"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {
                          tab.label
                        }

                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            active
                              ? "bg-white/15 text-white"
                              : "bg-white text-slate-500"
                          }`}
                        >
                          {
                            tab.count
                          }
                        </span>

                      </button>
                    );
                  }
                )}

              </div>


              {/* SEARCH */}

              <div className="relative w-full xl:max-w-sm">

                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  value={
                    search
                  }
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event.target
                        .value
                    )
                  }
                  placeholder="Search messages..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-10 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

              </div>

            </div>

          </section>


          {/* =====================================
              MESSAGE LIST
          ====================================== */}

          <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">

              <div>

                <h2 className="font-bold text-slate-900">
                  Inbox
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {
                    filteredMessages.length
                  }{" "}
                  messages found
                </p>

              </div>

              {unreadCount >
                0 && (
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">

                  <Mail className="h-3.5 w-3.5" />

                  {
                    unreadCount
                  }{" "}
                  unread

                </div>
              )}

            </div>


            {loading ? (

              <div className="flex min-h-[360px] items-center justify-center">

                <div className="text-center">

                  <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-teal-100 border-t-teal-600" />

                  <p className="mt-4 text-sm font-medium text-slate-500">
                    Loading messages...
                  </p>

                </div>

              </div>

            ) : filteredMessages
                .length ===
              0 ? (

              <div className="px-6 py-20 text-center">

                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50">

                  <Inbox className="h-8 w-8 text-slate-300" />

                </div>

                <h3 className="mt-4 font-bold text-slate-700">
                  No messages found
                </h3>

                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
                  Messages from Central
                  Admin and your assigned
                  Digital Teacher will
                  appear here.
                </p>

              </div>

            ) : (

              <div className="divide-y divide-slate-100">

                {filteredMessages.map(
                  (
                    message
                  ) => {
                    const {
                      date,
                      time,
                    } =
                      formatMessageDate(
                        message
                          ?.createdAt
                      );

                    const isCentral =
                      message
                        ?.source ===
                      "central_admin";

                    const readKey =
                      `${message.source}_${message.id}`;

                    const isMarking =
                      markingReadId ===
                      readKey;

                    return (
                      <button
                        key={
                          readKey
                        }
                        type="button"
                        onClick={() =>
                          handleOpenMessage(
                            message
                          )
                        }
                        className={`group flex w-full flex-col gap-4 px-5 py-5 text-left transition hover:bg-slate-50/80 sm:px-6 lg:flex-row lg:items-center ${
                          !message.read
                            ? "bg-teal-50/30"
                            : "bg-white"
                        }`}
                      >

                        {/* ICON */}

                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                            isCentral
                              ? "bg-blue-50 text-blue-700"
                              : "bg-violet-50 text-violet-700"
                          }`}
                        >
                          {isCentral ? (
                            <ShieldCheck className="h-5 w-5" />
                          ) : (
                            <UserRound className="h-5 w-5" />
                          )}
                        </div>


                        {/* CONTENT */}

                        <div className="min-w-0 flex-1">

                          <div className="flex flex-wrap items-center gap-2">

                            <h3
                              className={`truncate text-sm text-slate-900 sm:text-base ${
                                !message.read
                                  ? "font-bold"
                                  : "font-semibold"
                              }`}
                            >
                              {
                                message.title
                              }
                            </h3>

                            {!message
                              .read && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                            )}

                            {message
                              ?.priority ===
                              "high" && (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                                Important
                              </span>
                            )}

                          </div>


                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {
                              message.senderName
                            }
                          </p>


                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                            {
                              message.message
                            }
                          </p>

                        </div>


                        {/* META */}

                        <div className="flex shrink-0 items-center gap-4 lg:flex-col lg:items-end">

                          <div className="flex items-center gap-1.5 text-xs text-slate-400">

                            <Clock3 className="h-3.5 w-3.5" />

                            <span>
                              {date}

                              {time
                                ? ` • ${time}`
                                : ""}
                            </span>

                          </div>


                          <div
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                              message.read
                                ? "text-slate-400"
                                : "text-teal-700"
                            }`}
                          >
                            {isMarking ? (

                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" />

                            ) : message
                                .read ? (

                              <CheckCheck className="h-4 w-4" />

                            ) : (

                              <Mail className="h-4 w-4" />

                            )}

                            {message.read
                              ? "Read"
                              : "Unread"}

                          </div>

                        </div>

                      </button>
                    );
                  }
                )}

              </div>

            )}

          </section>

        </div>


        {/* =====================================
            MESSAGE VIEW MODAL
        ====================================== */}

        {selectedMessage && (

          <div
            className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
            onClick={() =>
              setSelectedMessage(
                null
              )
            }
          >

            <div
              className="mx-auto my-10 w-full max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-2xl"
              onClick={(
                event
              ) =>
                event.stopPropagation()
              }
            >

              {/* MODAL HEADER */}

              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">

                <div className="flex min-w-0 items-start gap-3">

                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      selectedMessage
                        ?.source ===
                      "central_admin"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-violet-50 text-violet-700"
                    }`}
                  >

                    {selectedMessage
                      ?.source ===
                    "central_admin" ? (

                      <ShieldCheck className="h-5 w-5" />

                    ) : (

                      <UserRound className="h-5 w-5" />

                    )}

                  </div>

                  <div className="min-w-0">

                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                      {selectedMessage
                        ?.source ===
                      "central_admin"
                        ? "Central Admin"
                        : "Digital Teacher"}
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {
                        selectedMessage.title
                      }
                    </h2>

                  </div>

                </div>


                <button
                  type="button"
                  onClick={() =>
                    setSelectedMessage(
                      null
                    )
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>


              {/* SENDER */}

              <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">

                <div className="flex flex-wrap items-center justify-between gap-3">

                  <div>

                    <p className="text-xs text-slate-400">
                      From
                    </p>

                    <p className="mt-1 text-sm font-bold text-slate-700">
                      {
                        selectedMessage.senderName
                      }
                    </p>

                  </div>


                  <div className="text-right">

                    <p className="text-xs text-slate-400">
                      Received
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-600">

                      {
                        formatMessageDate(
                          selectedMessage
                            .createdAt
                        ).date
                      }

                      {" • "}

                      {
                        formatMessageDate(
                          selectedMessage
                            .createdAt
                        ).time
                      }

                    </p>

                  </div>

                </div>

              </div>


              {/* BODY */}

              <div className="px-5 py-7 sm:px-6">

                <p className="whitespace-pre-wrap text-[15px] leading-8 text-slate-600">
                  {
                    selectedMessage.message
                  }
                </p>

              </div>


              {/* FOOTER */}

              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 sm:px-6">

                <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600">

                  <MailOpen className="h-4 w-4" />

                  Message read

                </div>


                <button
                  type="button"
                  onClick={() =>
                    setSelectedMessage(
                      null
                    )
                  }
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
                >
                  Close
                </button>

              </div>

            </div>

          </div>

        )}

      </main>

    </Layout>
  );
}