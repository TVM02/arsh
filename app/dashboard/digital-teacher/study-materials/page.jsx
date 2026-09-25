"use client";

import {
  useMemo,
  useState,
} from "react";

import Layout from "@/components/digitalclassroom/Layout";

import {
  BarChart3,
  BookOpen,
  Clock3,
  Download,
  FileText,
  Folder,
  Headphones,
  Layers3,
  Link2,
  MoreVertical,
  Play,
  Plus,
  Search,
  Users,
  Video,
} from "lucide-react";
import { MaterialRow, FolderRow, RecentUpload, SummaryCard} from "@/components/digitalclassroom/tecaherstudent"

/* =========================================================
   DEMO DATA
========================================================= */

const DEMO_MATERIALS = [
  {
    id: "mat-1",
    title: "Quran Recitation - Lesson 1",
    className: "Class 5",
    subject: "Tajweed",
    type: "pdf",
    description:
      "Basic Tajweed rules with examples and practice exercises.",
    size: "2.4 MB",
    date: "24 Sep 2026",
    downloads: 156,
    sharedClasses: 3,
    folder: "Quran & Tajweed",
  },

  {
    id: "mat-2",
    title: "Tajweed Rules Explanation",
    className: "Class 7",
    subject: "Tajweed",
    type: "video",
    description:
      "Video explanation of important Tajweed rules for better recitation.",
    size: "120 MB",
    duration: "12:45",
    date: "22 Sep 2026",
    downloads: 324,
    sharedClasses: 2,
    folder: "Quran & Tajweed",
  },

  {
    id: "mat-3",
    title: "Seerah of Prophet Muhammad (PBUH)",
    className: "Class 6",
    subject: "Islamic History",
    type: "pdf",
    description:
      "Complete notes on the life of Prophet Muhammad (PBUH).",
    size: "1.8 MB",
    date: "20 Sep 2026",
    downloads: 198,
    sharedClasses: 4,
    folder: "Islamic History",
  },

  {
    id: "mat-4",
    title: "Arabic Vocabulary - Part 1",
    className: "Class 5",
    subject: "Arabic",
    type: "record",
    description:
      "Audio pronunciation for basic Arabic words.",
    size: "8.2 MB",
    duration: "08:20",
    date: "18 Sep 2026",
    downloads: 212,
    sharedClasses: 3,
    folder: "Arabic Language",
  },

  {
    id: "mat-5",
    title: "Fiqh Basics - Chapter 1",
    className: "Class 8",
    subject: "Fiqh",
    type: "pdf",
    description:
      "Introduction to Fiqh and basic rulings.",
    size: "3.1 MB",
    date: "15 Sep 2026",
    downloads: 289,
    sharedClasses: 2,
    folder: "Fiqh",
  },

  {
    id: "mat-6",
    title: "Arabic Grammar Video",
    className: "Class 6",
    subject: "Arabic",
    type: "video",
    description:
      "Simple Arabic grammar explanation for students.",
    size: "95 MB",
    duration: "18:30",
    date: "13 Sep 2026",
    downloads: 174,
    sharedClasses: 2,
    folder: "Arabic Language",
  },

  {
    id: "mat-7",
    title: "Surah Recitation Practice",
    className: "Class 7",
    subject: "Quran",
    type: "record",
    description:
      "Recorded recitation for student listening practice.",
    size: "11 MB",
    duration: "10:10",
    date: "12 Sep 2026",
    downloads: 118,
    sharedClasses: 4,
    folder: "Quran & Tajweed",
  },

  {
    id: "mat-8",
    title: "Aqeedah Lesson Notes",
    className: "Class 8",
    subject: "Aqeedah",
    type: "pdf",
    description:
      "Study material for basic Islamic belief topics.",
    size: "2.2 MB",
    date: "10 Sep 2026",
    downloads: 101,
    sharedClasses: 1,
    folder: "Aqeedah",
  },
];


const FOLDERS = [
  {
    name: "Quran & Tajweed",
    count: 18,
    type: "green",
  },
  {
    name: "Islamic History",
    count: 12,
    type: "blue",
  },
  {
    name: "Fiqh",
    count: 10,
    type: "orange",
  },
  {
    name: "Arabic Language",
    count: 14,
    type: "violet",
  },
  {
    name: "Aqeedah",
    count: 8,
    type: "pink",
  },
  {
    name: "General",
    count: 6,
    type: "slate",
  },
];



export default function DigitalTeacherStudyMaterialsPage() {
  const [
    materials,
  ] = useState(
    DEMO_MATERIALS,
  );

  const [
    activeType,
    setActiveType,
  ] = useState("all");

  const [
    selectedClass,
    setSelectedClass,
  ] = useState("all");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    sortBy,
    setSortBy,
  ] = useState("recent");


  /* =====================================================
     TYPE COUNTS
  ===================================================== */

  const pdfCount =
    materials.filter(
      (material) =>
        material.type ===
        "pdf",
    ).length;

  const videoCount =
    materials.filter(
      (material) =>
        material.type ===
        "video",
    ).length;

  const recordCount =
    materials.filter(
      (material) =>
        material.type ===
        "record",
    ).length;


  /* =====================================================
     CLASS OPTIONS
  ===================================================== */

  const classOptions =
    useMemo(() => {
      return [
        ...new Set(
          materials
            .map(
              (material) =>
                material.className,
            )
            .filter(Boolean),
        ),
      ].sort(
        (a, b) => {
          const aNumber =
            Number(
              String(
                a,
              ).replace(
                /\D/g,
                "",
              ),
            );

          const bNumber =
            Number(
              String(
                b,
              ).replace(
                /\D/g,
                "",
              ),
            );

          return (
            aNumber -
            bNumber
          );
        },
      );
    }, [materials]);


  /* =====================================================
     FILTERED MATERIALS
  ===================================================== */

  const filteredMaterials =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      let list =
        materials.filter(
          (material) => {
            /* TYPE */

            if (
              activeType !==
                "all" &&
              material.type !==
                activeType
            ) {
              return false;
            }


            /* CLASS */

            if (
              selectedClass !==
                "all" &&
              material.className !==
                selectedClass
            ) {
              return false;
            }


            /* SEARCH */

            if (query) {
              const searchable =
                [
                  material.title,
                  material.subject,
                  material.className,
                  material.description,
                  material.folder,
                  material.type,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();

              if (
                !searchable.includes(
                  query,
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
        "downloads"
      ) {
        list = [
          ...list,
        ].sort(
          (a, b) =>
            b.downloads -
            a.downloads,
        );
      }


      return list;
    }, [
      materials,
      activeType,
      selectedClass,
      search,
      sortBy,
    ]);


  /* =====================================================
     STATS
  ===================================================== */

  const totalDownloads =
    materials.reduce(
      (
        total,
        material,
      ) =>
        total +
        Number(
          material.downloads ||
            0,
        ),
      0,
    );

  const sharedClassCount =
    new Set(
      materials.map(
        (material) =>
          material.className,
      ),
    ).size;


  /* =====================================================
     FILTER BUTTONS
  ===================================================== */

  const typeFilters = [
    {
      id: "all",
      label:
        "All Materials",
      count:
        materials.length,
      icon: Layers3,
    },

    {
      id: "pdf",
      label: "PDF",
      count: pdfCount,
      icon: FileText,
    },

    {
      id: "video",
      label: "Video",
      count: videoCount,
      icon: Video,
    },

    {
      id: "record",
      label: "Record",
      count: recordCount,
      icon: Headphones,
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
                <BookOpen className="h-6 w-6" />
              </div>

              <div>
                <h1
                  className="
                    text-2xl
                    font-bold
                    text-slate-900
                  "
                >
                  Study Materials
                </h1>

                <p
                  className="
                    mt-1
                    text-sm
                    text-slate-500
                  "
                >
                  Upload, manage and share study
                  materials with your students
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
            >
              <Plus className="h-4 w-4" />

              Upload Material
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
              title="Total Materials"
              value={
                materials.length
              }
              description="All time"
              icon={FileText}
              type="green"
            />

            <SummaryCard
              title="Shared with Classes"
              value={
                sharedClassCount
              }
              description="Class groups"
              icon={Users}
              type="blue"
            />

            <SummaryCard
              title="Total Downloads"
              value={
                totalDownloads.toLocaleString()
              }
              description="By students"
              icon={Download}
              type="pink"
            />

            <SummaryCard
              title="Folders"
              value={
                FOLDERS.length
              }
              description="Organized"
              icon={Folder}
              type="orange"
            />
          </div>


          {/* =====================================
              FILTER BAR
          ====================================== */}

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
                flex
                flex-col
                gap-3
                xl:flex-row
                xl:items-center
                xl:justify-between
              "
            >
              {/* TYPE FILTERS */}

              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-2
                "
              >
                {typeFilters.map(
                  (filter) => {
                    const Icon =
                      filter.icon;

                    const active =
                      activeType ===
                      filter.id;

                    return (
                      <button
                        type="button"
                        key={
                          filter.id
                        }
                        onClick={() =>
                          setActiveType(
                            filter.id,
                          )
                        }
                        className={`
                          inline-flex
                          h-9
                          items-center
                          gap-2
                          rounded-full
                          px-4
                          text-xs
                          font-semibold
                          transition-all

                          ${
                            active
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                          }
                        `}
                      >
                        <Icon className="h-3.5 w-3.5" />

                        {filter.label}

                        <span>
                          ({filter.count})
                        </span>
                      </button>
                    );
                  },
                )}
              </div>


              {/* RIGHT FILTERS */}

              <div
                className="
                  flex
                  flex-col
                  gap-2
                  sm:flex-row
                  sm:items-center
                "
              >
                {/* CLASS FILTER */}

                <select
                  value={
                    selectedClass
                  }
                  onChange={(
                    event,
                  ) =>
                    setSelectedClass(
                      event.target
                        .value,
                    )
                  }
                  className="
                    h-10
                    min-w-[150px]
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
                </select>


                {/* SEARCH */}

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
                    placeholder="Search by title, subject, class..."
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


                {/* SORT */}

                <select
                  value={
                    sortBy
                  }
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
                    min-w-[145px]
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
                    Recently Added
                  </option>

                  <option value="title">
                    Title A-Z
                  </option>

                  <option value="downloads">
                    Most Downloaded
                  </option>
                </select>
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
              xl:grid-cols-[minmax(0,1fr)_340px]
            "
          >
            {/* LEFT */}

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
              {filteredMaterials.length >
              0 ? (
                filteredMaterials.map(
                  (
                    material,
                  ) => (
                    <MaterialRow
                      key={
                        material.id
                      }
                      material={
                        material
                      }
                    />
                  ),
                )
              ) : (
                <div
                  className="
                    px-6
                    py-20
                    text-center
                  "
                >
                  <FileText
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
                    No study materials found
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-slate-400
                    "
                  >
                    Try another class, material type or
                    search term.
                  </p>
                </div>
              )}
            </div>


            {/* =====================================
                RIGHT SIDE
            ====================================== */}

            <aside className="space-y-4">
              {/* FOLDERS */}

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
                    mb-3
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
                    <Folder className="h-5 w-5 text-blue-500" />

                    <h2
                      className="
                        text-sm
                        font-bold
                        text-slate-900
                      "
                    >
                      Folders / Categories
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="
                      inline-flex
                      items-center
                      gap-1
                      rounded-lg
                      bg-blue-50
                      px-2.5
                      py-1.5
                      text-[10px]
                      font-semibold
                      text-blue-600
                      hover:bg-blue-100
                    "
                  >
                    <Plus className="h-3.5 w-3.5" />

                    Add
                  </button>
                </div>

                {FOLDERS.map(
                  (folder) => (
                    <FolderRow
                      key={
                        folder.name
                      }
                      folder={
                        folder
                      }
                    />
                  ),
                )}
              </div>


              {/* RECENT UPLOADS */}

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
                    mb-3
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
                    <Clock3 className="h-5 w-5 text-teal-500" />

                    <h2
                      className="
                        text-sm
                        font-bold
                        text-slate-900
                      "
                    >
                      Recent Uploads
                    </h2>
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

                {materials
                  .slice(
                    0,
                    5,
                  )
                  .map(
                    (
                      material,
                    ) => (
                      <RecentUpload
                        key={
                          material.id
                        }
                        material={
                          material
                        }
                      />
                    ),
                  )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </Layout>
  );
}