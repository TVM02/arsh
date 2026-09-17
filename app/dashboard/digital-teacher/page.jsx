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
  BookOpen,
  FileText,
  CalendarDays,
  Bell,
  Clock3,
  TrendingUp,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Megaphone,
  Video,
  ArrowRight,
  CheckCircle2,
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

export default function StudentDashboard() {
  const { user, userData } = useAuthStore();
  const [teacherData, setTeacherData] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [notices, setNotices] = useState([]);
  const [recentResults, setRecentResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingWidgets, setLoadingWidgets] = useState(true);
  const [error, setError] = useState("");

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
    const fetchTeacherData = async () => {
      try {
        setLoading(true);
        setError("");

        if (!user?.email) {
          setError("User not logged in");
          return;
        }

        let currentTeacherData = userData;

        if (!currentTeacherData.classLevel || !currentTeacherData.madarsaId) {
          const studentsQuery = query(
            collection(db, "students"),
            where("email", "==", user.email),
          );
          const studentsSnapshot = await getDocs(studentsQuery);

          if (!studentsSnapshot.empty) {
            currentTeacherData = studentsSnapshot.docs[0].data();
          }
        }

        if (!currentTeacherData) {
          setError("Student data not found");
          return;
        }

        setTeacherData(currentTeacherData);
        setLoading(false); // Do not block rendering for widget data

        if (currentTeacherData.madarsaId) {
          setLoadingWidgets(true);
          const assignmentsQuery = query(
            collection(db, "assignments"),
            where("madarsaId", "==", currentTeacherData.madarsaId),
            where("targetType", "==", "students"),
            orderBy("createdAt", "desc"),
            limit(10),
          );

          const madarsaQuery = query(
            collection(db, "madarsas"),
            where("madarsaId", "==", currentTeacherData.madarsaId)
          );

          const localNoticesQuery = query(
            collection(db, "notices"),
            where("madarsaId", "==", currentTeacherData.madarsaId),
            where("targetAudience", "in", ["students", "all"]),
          );
          
          const centralNoticesQuery = query(
            collection(db, "notices"),
            where("targetAudience", "in", ["students", "all"])
          );

          const mekhalaNoticesQuery = query(
            collection(db, "notices"),
            where("createdByRole", "==", "mekhala_admin"),
          );

          let registrationsQuery = null;
          if (currentTeacherData.admissionNumber) {
            registrationsQuery = query(
              collection(db, "examRegistrations"),
              where("admissionNumber", "==", currentTeacherData.admissionNumber),
              where("status", "==", "registered"),
            );
          }

          // Run widget queries concurrently in the background
          Promise.all([
            getDocs(assignmentsQuery),
            getDocs(madarsaQuery),
            getDocs(localNoticesQuery),
            getDocs(centralNoticesQuery),
            getDocs(mekhalaNoticesQuery)
          ]).then(([assignmentsSnapshot, madarsaSnapshot, localSnap, centralSnap, mekhalaSnap]) => {
            const assignmentsData = assignmentsSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));

            const filteredAssignments = assignmentsData.filter((assignment) => {
              return assignment.classLevel === currentTeacherData.classLevel || assignment.classLevel === "all";
            }).slice(0, 3);

            setAssignments(filteredAssignments);

            let madarsaDataObj = null;
            let madarsaDocId = "";
            if (!madarsaSnapshot.empty) {
              madarsaDataObj = madarsaSnapshot.docs[0].data();
              madarsaDocId = madarsaSnapshot.docs[0].id;
            }

            const localNotices = localSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            const centralNotices = centralSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            const mekhalaNotices = mekhalaSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

            const allNotices = [...localNotices, ...centralNotices, ...mekhalaNotices];
            const deduplicatedNoticesMap = new Map();
            allNotices.forEach(n => deduplicatedNoticesMap.set(n.id, n));
            
            const mergedNotices = Array.from(deduplicatedNoticesMap.values());
            const classLevel = currentTeacherData.classLevel || currentTeacherData.class || currentTeacherData.grade;

            const filteredNotices = mergedNotices.filter((notice) => {
              if (notice.isActive === false) return false;
              if (notice.deleted === true) return false;

              if (notice.createdByRole === "mekhala_admin") {
                if (notice.targetType === "all" || notice.targetType === "students_portal") {
                  return madarsaDataObj && notice.targetDistricts?.includes(madarsaDataObj.district);
                }
                if (notice.targetType === "specific_districts") {
                  return madarsaDataObj && notice.targetDistricts?.includes(madarsaDataObj.district);
                }
                if (notice.targetType === "specific_madarsas") {
                  return notice.targetMadarsas?.includes(currentTeacherData.madarsaId) || (madarsaDocId && notice.targetMadarsas?.includes(madarsaDocId));
                }
                return false;
              }

              if (notice.type === "central") {
                if (notice.targetMahals && notice.targetMahals.length > 0) {
                  if (!notice.targetMahals.includes(currentTeacherData.madarsaId)) {
                    return false;
                  }
                }
              }

              if (!notice.classLevel) return true;
              if (notice.classLevel === "All" || notice.classLevel === "all") return true;
              if (!classLevel) return true;
              if (Array.isArray(notice.classLevel)) {
                return notice.classLevel.includes(classLevel) || notice.classLevel.includes("All");
              }
              return notice.classLevel === classLevel;
            });

            // Fix expiry logic by matching Notice menu EXACTLY
            const activeNotices = filteredNotices.filter((notice) => {
              if (!notice.expiryDate) return true;
              const expiryDate = notice.expiryDate.seconds
                ? new Date(notice.expiryDate.seconds * 1000)
                : new Date(notice.expiryDate.toDate ? notice.expiryDate.toDate() : notice.expiryDate);
              return expiryDate > new Date(); // Only keep if expiry is in future
            });

            activeNotices.sort((a, b) => {
              const dateA = a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
              const dateB = b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
              return dateB - dateA;
            });

            setNotices(activeNotices.slice(0, 3));
          }).catch(e => {
            console.error("Error loading widgets:", e);
          }).finally(() => {
            setLoadingWidgets(false);
          });

          if (registrationsQuery) {
            getDocs(registrationsQuery).then(async (registrationsSnapshot) => {
              if (registrationsSnapshot.docs.length > 0) {
                const fifteenDaysAgo = new Date();
                fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

                const registrations = registrationsSnapshot.docs.map(doc => doc.data());
                const publishedExams = [];
                
                await Promise.all(
                  registrations.map(async (reg) => {
                    try {
                      const resultDocId = `${reg.examId}_${reg.hallTicketNumber}`;
                      const resultDoc = await getDoc(doc(db, "results", resultDocId));
                      if (resultDoc.exists()) {
                        const data = resultDoc.data();
                        if (data.isPublished && data.uploadedAt) {
                          const uploadDate = data.uploadedAt.toDate ? data.uploadedAt.toDate() : new Date(data.uploadedAt);
                          if (uploadDate >= fifteenDaysAgo) {
                            const examSnap = await getDoc(doc(db, "exams", reg.examId));
                            publishedExams.push({
                              id: reg.examId,
                              name: examSnap.exists() ? examSnap.data().title : "Exam",
                              date: uploadDate,
                            });
                          }
                        }
                      }
                    } catch (e) {
                      console.error(e);
                    }
                  })
                );
                setRecentResults(publishedExams);
              }
            }).catch(e => console.error(e));
          }
        }
      } catch (err) {
        console.error("Error fetching student data:", err);
        setError("Failed to load dashboard data");
        setLoading(false);
      }
    };

    if (user?.email) {
      fetchTeacherData();
    }
  }, [user, userData]);

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
                      Continue your learning journey and make every
                      day a step towards knowledge.
                    </p>


                    <Link
                      href="/digital-classroom/student/classes"
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
                  icon={BookOpen}
                  value={assignments.length}
                  title="Pending Assignments"
                  iconClass="bg-blue-50 text-blue-600"
                />


                {/* Exams */}

                <DashboardStat
                  icon={CalendarDays}
                  value={recentResults.length}
                  title="Recent Exam Results"
                  iconClass="bg-orange-50 text-orange-500"
                />


                {/* Progress */}

                <DashboardStat
                  icon={TrendingUp}
                  value="85%"
                  title="Overall Progress"
                  iconClass="bg-violet-50 text-violet-600"
                />


                {/* Study Hours */}

                <DashboardStat
                  icon={Clock3}
                  value="12"
                  title="Study Hours"
                  subtitle="This Month"
                  iconClass="bg-emerald-50 text-emerald-600"
                />

              </section>


              {/* ===============================
                  ASSIGNMENTS + ANNOUNCEMENTS
              =============================== */}

              <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">

                {/* =================================
                    RECENT ASSIGNMENTS
                ================================= */}

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

                  <div className="flex items-center justify-between px-5 py-5">

                    <h2 className="text-lg font-extrabold text-[#07184c]">
                      Recent Assignments
                    </h2>

                    <Link
                      href="/digital-classroom/student/assignments"
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

                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>

                  </div>


                  <div className="px-5 pb-5">

                    {loadingWidgets ? (

                      <DashboardLoading text="Loading assignments..." />

                    ) : assignments.length > 0 ? (

                      <div className="divide-y divide-slate-100">

                        {assignments.slice(0, 3).map((assignment) => (

                          <Link
                            key={assignment.id}
                            href="/digital-classroom/student/assignments"
                            className="
                              group
                              flex
                              items-center
                              gap-3
                              py-4
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
                                bg-emerald-50
                                text-emerald-600
                              "
                            >
                              <ClipboardList className="h-5 w-5" />
                            </div>


                            <div className="min-w-0 flex-1">

                              <h3
                                className="
                                  truncate
                                  text-sm
                                  font-bold
                                  text-slate-800
                                  transition
                                  group-hover:text-teal-600
                                "
                              >
                                {assignment.title}
                              </h3>

                              <p className="mt-1 truncate text-xs text-slate-400">
                                Due: {formatDate(assignment.dueDate)}
                              </p>

                            </div>


                            <AssignmentStatus
                              status={assignment.status}
                            />


                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />

                          </Link>

                        ))}

                      </div>

                    ) : (

                      <EmptyWidget
                        icon={ClipboardList}
                        text="No assignments available"
                      />

                    )}

                  </div>

                </div>


                {/* =================================
                    ANNOUNCEMENTS
                ================================= */}

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

                  <div className="flex items-center justify-between px-5 py-5">

                    <h2 className="text-lg font-extrabold text-[#07184c]">
                      Announcements
                    </h2>

                    <Link
                      href="/digital-classroom/student/notices"
                      className="
                        flex
                        items-center
                        gap-1
                        text-xs
                        font-bold
                        text-teal-600
                      "
                    >
                      View All

                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>

                  </div>


                  <div className="px-5 pb-5">

                    {loadingWidgets ? (

                      <DashboardLoading text="Loading announcements..." />

                    ) : notices.length > 0 ? (

                      <div className="divide-y divide-slate-100">

                        {notices.slice(0, 3).map((notice, index) => (

                          <div
                            key={notice.id}
                            className="flex gap-3 py-4"
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
                                  index % 2 === 0
                                    ? "bg-orange-50 text-orange-500"
                                    : "bg-blue-50 text-blue-600"
                                }
                              `}
                            >
                              {index % 2 === 0 ? (
                                <Megaphone className="h-5 w-5" />
                              ) : (
                                <FileText className="h-5 w-5" />
                              )}
                            </div>


                            <div className="min-w-0 flex-1">

                              <h3 className="truncate text-sm font-bold text-slate-800">
                                {notice.title}
                              </h3>

                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                {notice.content}
                              </p>


                              <p className="mt-1 text-[11px] font-medium text-slate-400">
                                {formatDate(notice.createdAt)}
                              </p>

                            </div>


                            <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-slate-300" />

                          </div>

                        ))}

                      </div>

                    ) : (

                      <EmptyWidget
                        icon={Bell}
                        text="No announcements available"
                      />

                    )}

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


             

              {/* =================================
                  TODAY SCHEDULE
              ================================= */}

              <DashboardCard>

                <div className="mb-2 flex items-center justify-between">

                  <h2 className="text-base font-extrabold text-[#07184c]">
                    Today&apos;s Schedule
                  </h2>

                  <Link
                    href="/digital-classroom/student/classes"
                    className="text-xs font-bold text-teal-600"
                  >
                    View All
                  </Link>

                </div>


                <RightListItem
                  icon={Video}
                  title="Live Class"
                  description="No class scheduled"
                  iconClass="bg-emerald-50 text-emerald-600"
                />

              </DashboardCard>


              {/* =================================
                  STUDENT DETAILS
              ================================= */}

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
