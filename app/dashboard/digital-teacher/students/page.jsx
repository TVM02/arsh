"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Layout from "@/components/digitalclassroom/Layout";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Grid2X2,
  List,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  Plus,
} from "lucide-react";


import useAuthStore from "@/lib/authStore";

import {FilterSelect, StatCard, ActionButton} from "@/components/digitalclassroom/tecaherstudent";
import {
  getMyAssignedDigitalStudents,
} from "@/lib/digitalClassTeacherService";

;



export default function DigitalTeacherStudentsPage() {
  const [
    students, setStudents] = useState([]);
 const [
    studentsLoading, setStudentLoading] = useState(true);
  const [
    search,
    setSearch,
  ] = useState("");

 

  const [
    selectedClass,
    setSelectedClass,
  ] = useState("all");

  const [
    selectedGender,
    setSelectedGender,
  ] = useState("all");

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState("all");

  const [
    activeTab,
    setActiveTab,
  ] = useState("all");

  const [
    sortBy,
    setSortBy,
  ] = useState("recent");

  const [
    viewMode,
    setViewMode,
  ] = useState("list");

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);
 const { user, userData } = useAuthStore();
  const PAGE_SIZE = 8;


  /* =====================================================
     STATS
  ===================================================== */




/* =====================================================
   LOAD LOGGED-IN DIGITAL TEACHER STUDENTS
===================================================== */

useEffect(() => {
  let cancelled = false;


  const loadStudents =
    async () => {
      if (!user?.uid) {
        setStudentLoading(
          false,
        );

        return;
      }


      try {
        setStudentLoading(
          true,
        );


        const result =
  await getMyAssignedDigitalStudents();


        const assignedStudents =
          Array.isArray(
            result?.students,
          )
            ? result.students
            : [];
        if (!cancelled) {
          setStudents(
            assignedStudents,
          );
        }
      } catch (error) {
        console.error(
          "LOAD ASSIGNED DIGITAL STUDENTS ERROR:",
          error,
        );


        if (!cancelled) {
          toast.error(
            error?.message ||
              "Failed to load assigned Digital Students.",
          );


          setStudents([]);
        }
      } finally {
        if (!cancelled) {
          setStudentLoading(
            false,
          );
        }
      }
    };


  loadStudents();


  return () => {
    cancelled = true;
  };
}, [user?.uid]);

  const totalStudents =
    students.length;

  const boys =
    students.filter(
      (student) =>
        student.gender ===
        "male",
    ).length;

  const girls =
    students.filter(
      (student) =>
        student.gender ===
        "female",
    ).length;

  const activeStudents =
    students.filter(
      (student) =>
        student.accountStatus ===
        "active",
    ).length;

  const inactiveStudents =
    totalStudents -
    activeStudents;

  const classCount =
    new Set(
      students.map(
        (student) =>
          student.applyingclass,
      ),
    ).size;


  /* =====================================================
     FILTER OPTIONS
  ===================================================== */

  

  const classes =
    useMemo(
      () =>
        [
          ...new Set(
            students.map(
              (student) =>
                student.applyingclass,
            ),
          ),
        ].sort(
          (a, b) =>
            Number(a) -
            Number(b),
        ),
      [students],
    );


  /* =====================================================
     FILTER DATA
  ===================================================== */

  const filteredStudents =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      let list =
        students.filter(
          (student) => {
            

            if (
              selectedClass !==
                "all" &&
              student.applyingclass !==
                selectedClass
            ) {
              return false;
            }

            if (
              selectedGender !==
                "all" &&
              student.gender !==
                selectedGender
            ) {
              return false;
            }

            if (
              selectedStatus !==
                "all" &&
              student.accountStatus !==
                selectedStatus
            ) {
              return false;
            }

            if (
              activeTab ===
                "boys" &&
              student.gender !==
                "male"
            ) {
              return false;
            }

            if (
              activeTab ===
                "girls" &&
              student.gender !==
                "female"
            ) {
              return false;
            }

            if (
              activeTab ===
                "active" &&
              student.accountStatus !==
                "active"
            ) {
              return false;
            }

            if (
              activeTab ===
                "inactive" &&
              student.accountStatus !==
                "inactive"
            ) {
              return false;
            }

            if (text) {
              const searchable =
                [
                  student.name,
                  student.digitalAdmissionNumber,
                  student.phone,
                  student.madrasa,
                 
                  student.applyingclass,
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
        sortBy === "name"
      ) {
        list = [
          ...list,
        ].sort((a, b) =>
          a.name.localeCompare(
            b.name,
          ),
        );
      }

      if (
        sortBy === "class"
      ) {
        list = [
          ...list,
        ].sort(
          (a, b) =>
            Number(
              a.applyingclass,
            ) -
            Number(
              b.applyingclass,
            ),
        );
      }

      return list;
    }, [
      students,
      search,
     
      selectedClass,
      selectedGender,
      selectedStatus,
      activeTab,
      sortBy,
    ]);


  /* =====================================================
     PAGINATION
  ===================================================== */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredStudents.length /
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

  const visibleStudents =
    filteredStudents.slice(
      startIndex,
      startIndex +
        PAGE_SIZE,
    );


  /* =====================================================
     TAB DATA
  ===================================================== */

  const tabs = [
    {
      id: "all",
      label: "All Students",
      count:
        totalStudents,
      icon: Users,
      style:
        "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md",
    },
    {
  id: "boys",
  label: "Boys",
  count: boys,
  icon: UserRound,
},
{
  id: "girls",
  label: "Girls",
  count: girls,
  icon: UserRound,
},
    {
      id: "active",
      label: "Active",
      count:
        activeStudents,
      icon: ShieldCheck,
    },
    {
      id: "inactive",
      label: "Inactive",
      count:
        inactiveStudents,
      icon: CheckCircle2,
    },
  ];


  return (
    <Layout>
      {!studentsLoading && (
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
              sm:flex-row
              sm:items-start
              sm:justify-between
            "
          >
            <div>
              <h1
                className="
                  text-2xl
                  font-bold
                  text-slate-900
                "
              >
                Students
              </h1>

              <p
                className="
                  mt-1
                  text-sm
                  text-slate-500
                "
              >
                Manage and view all
                students from your
                madrasa
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
              gap-3
              sm:grid-cols-2
              lg:grid-cols-3
              xl:grid-cols-5
            "
          >
            <StatCard
              title="Total Students"
              value={
                totalStudents
              }
              description="Active registered students"
              icon={Users}
              type="green"
              rightText="+12%"
            />

            <StatCard
              title="Boys"
  value={boys}
  description="Male students"
  icon={UserRound}
  type="blue"
             
            />

            <StatCard
              title="Girls"
              value={girls}
              description="Female students"
              icon={UserRound}
              type="pink"
            
            />

            <StatCard
              title="Classes"
              value={classCount}
              description="All class groups"
              icon={BookOpen}
              type="orange"
            />

            <StatCard
              title="Active Students"
              value={
                activeStudents
              }
              description="Actively participating"
              icon={
                ShieldCheck
              }
              type="violet"
              
            />
          </div>


          {/* =====================================
              FILTER AREA
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
                xl:grid-cols-[150px_150px_130px_140px_minmax(260px,1fr)]
              "
            >
              


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

                {classes.map(
                  (
                    applyingclass,
                  ) => (
                    <option
                      key={
                        applyingclass
                      }
                      value={
                        applyingclass
                      }
                    >
                      Class{" "}
                      {applyingclass}
                    </option>
                  ),
                )}
              </FilterSelect>


              <FilterSelect
                label="Gender"
                value={
                  selectedGender
                }
                onChange={(
                  value,
                ) => {
                  setSelectedGender(
                    value,
                  );

                  setCurrentPage(
                    1,
                  );
                }}
              >
                <option value="all">
                  All
                </option>

                <option value="male">
                  Boy
                </option>

                <option value="female">
                  Girl
                </option>
              </FilterSelect>


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
                  All
                </option>

                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </FilterSelect>


              <div>
                <label
                  className="
                    mb-1.5
                    block
                    text-[11px]
                    font-semibold
                    text-slate-600
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
                    type="text"
                    value={search}
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
                    placeholder="Search by name, admission no, phone..."
                    className="
                      h-10
                      w-full
                      rounded-lg
                      border
                      border-slate-200
                      bg-slate-50/40
                      pl-9
                      pr-3
                      text-sm
                      text-slate-700
                      outline-none
                      transition
                      placeholder:text-slate-400
                      focus:border-teal-400
                      focus:bg-white
                      focus:ring-2
                      focus:ring-teal-100
                    "
                  />
                </div>
              </div>
            </div>
          </div>


          {/* =====================================
              TABS + SORT
          ====================================== */}

          <div
            className="
              flex
              flex-col
              gap-4
              lg:flex-row
              lg:items-center
              lg:justify-between
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
              {tabs.map(
                (tab) => {
                  const Icon =
                    tab.icon;

                  const active =
                    activeTab ===
                    tab.id;

                  return (
                    <button
                      key={
                        tab.id
                      }
                      type="button"
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
                        transition-all

                        ${
                          active
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                            : "bg-white text-slate-500 hover:bg-slate-100"
                        }
                      `}
                    >
                      <Icon
                        className="
                          h-4
                          w-4
                        "
                      />

                      {tab.label}

                      <span>
                        ({tab.count})
                      </span>
                    </button>
                  );
                },
              )}
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
                  text-slate-500
                "
              >
                Sort by
              </span>

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
                  h-9
                  rounded-lg
                  border
                  border-slate-200
                  bg-white
                  px-3
                  text-xs
                  font-medium
                  text-slate-700
                  outline-none
                "
              >
                <option value="recent">
                  Recently Added
                </option>

                <option value="name">
                  Student Name
                </option>

                <option value="class">
                  Class
                </option>
              </select>


              <button
                type="button"
                onClick={() =>
                  setViewMode(
                    "list",
                  )
                }
                className={`
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-lg
                  border

                  ${
                    viewMode ===
                    "list"
                      ? "border-teal-300 bg-teal-50 text-teal-600"
                      : "border-slate-200 bg-white text-slate-400"
                  }
                `}
              >
                <List className="h-4 w-4" />
              </button>


              <button
                type="button"
                onClick={() =>
                  setViewMode(
                    "grid",
                  )
                }
                className={`
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-lg
                  border

                  ${
                    viewMode ===
                    "grid"
                      ? "border-teal-300 bg-teal-50 text-teal-600"
                      : "border-slate-200 bg-white text-slate-400"
                  }
                `}
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
            </div>
          </div>


          {/* =====================================
              STUDENTS
          ====================================== */}

          {viewMode ===
          "list" ? (
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
                  overflow-x-auto
                "
              >
                <table
                  className="
                    w-full
                    min-w-[1050px]
                  "
                >
                  <thead>
                    <tr
                      className="
                        bg-slate-50
                        text-left
                        text-[10px]
                        font-semibold
                        text-slate-600
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
                        Gender
                      </th>

                      <th className="px-4 py-3">
                        Phone
                      </th>

                      <th className="px-4 py-3">
                        Status
                      </th>

                      <th className="px-4 py-3 text-center">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleStudents.map(
                      (
                        student,
                        index,
                      ) => (
                        <tr
                          key={
                            student.id
                          }
                          className="
                            border-t
                            border-slate-100
                            transition
                            hover:bg-teal-50/30
                          "
                        >
                          <td
                            className="
                              px-4
                              py-3
                              text-xs
                              text-slate-500
                            "
                          >
                            {startIndex +
                              index +
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
                              

                              <div className="min-w-0">
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
                                  {
                                    student.madrasa
                                  }
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
                              student.digitalAdmissionNumber
                            }
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className="
                                inline-flex
                                h-7
                                min-w-7
                                items-center
                                justify-center
                                rounded-md
                                bg-sky-100
                                px-2
                                text-xs
                                font-bold
                                text-black-600
                              "
                            >
                              {
                                student.applyingclass
                              }
                            </span>
                          </td>

                        

                          <td className="px-4 py-3">
                            <span
                              className="
                                inline-flex
                                items-center
                                gap-1.5
                                text-xs
                                text-slate-600
                              "
                            >
                             
                              {student.gender ===
                              "female"
                                ? "Female"
                                : "Male"}
                            </span>
                          </td>

                          <td
                            className="
                              px-4
                              py-3
                              text-xs
                              text-slate-600
                            "
                          >
                            {
                              student.phone
                            }
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`
                                inline-flex
                                rounded-full
                                px-3
                                py-1
                                text-[10px]
                                font-semibold

                                ${
                                  student.accountStatus ===
                                  "active"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                }
                              `}
                            >
                              {student.accountStatus ===
                              "active"
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div
                              className="
                                flex
                                items-center
                                justify-center
                                gap-2
                              "
                            >
                              <ActionButton
                                icon={
                                  Eye
                                }
                                type="view"
                              />
                    
                              
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>


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
                  {filteredStudents.length >
                  0
                    ? startIndex +
                      1
                    : 0}{" "}
                  to{" "}
                  {Math.min(
                    startIndex +
                      PAGE_SIZE,
                    filteredStudents.length,
                  )}{" "}
                  of{" "}
                  {
                    filteredStudents.length
                  }{" "}
                  students
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
                      disabled:cursor-not-allowed
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
                      disabled:cursor-not-allowed
                      disabled:opacity-40
                    "
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* =====================================
               GRID VIEW
            ====================================== */

            <div
              className="
                grid
                grid-cols-1
                gap-4
                sm:grid-cols-2
                lg:grid-cols-3
                xl:grid-cols-4
              "
            >
              {visibleStudents.map(
                (student) => (
                  <div
                    key={
                      student.id
                    }
                    className="
                      rounded-2xl
                      border
                      border-slate-200
                      bg-white
                      p-5
                      shadow-sm
                      transition
                      hover:-translate-y-1
                      hover:border-teal-200
                      hover:shadow-lg
                    "
                  >
                    <div
                      className="
                        flex
                        items-start
                        justify-between
                        gap-3
                      "
                    >
                     

                      <span
                        className={`
                          rounded-full
                          px-2.5
                          py-1
                          text-[9px]
                          font-semibold

                          ${
                            student.accountStatus ===
                            "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }
                        `}
                      >
                        {
                          student.accountStatus
                        }
                      </span>
                    </div>

                    <h3
                      className="
                        mt-4
                        font-bold
                        text-slate-900
                      "
                    >
                      {student.name}
                    </h3>

                    <p
                      className="
                        mt-1
                        text-xs
                        text-slate-400
                      "
                    >
                      {
                        student.madrasa
                      }
                    </p>

                    <div
                      className="
                        mt-4
                        space-y-2
                        border-t
                        border-slate-100
                        pt-4
                        text-xs
                        text-slate-500
                      "
                    >
                      <p>
                        Admission:{" "}
                        <strong className="text-slate-700">
                          {
                            student.digitalAdmissionNumber
                          }
                        </strong>
                      </p>

                      <p>
                        Class:{" "}
                        <strong className="text-slate-700">
                          {
                            student.applyingclass
                          }
                        </strong>
                      </p>

                     
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
        
      </div>
      )}
      {studentsLoading && (
  <div
    className="
      flex
      min-h-[300px]
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
          h-8
          w-8
          animate-spin
          rounded-full
          border-2
          border-teal-100
          border-t-teal-600
        "
      />

      <p
        className="
          mt-3
          text-sm
          font-medium
          text-slate-500
        "
      >
        Loading assigned students...
      </p>
    </div>
  </div>
)}
    </Layout>
  );
}




