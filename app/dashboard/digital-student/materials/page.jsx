"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Search,
  BookOpen,
  FileText,
  Download,
  Eye,
  Video,
  File,
  Filter,
  Grid3X3,
  List,
  BookMarked,
  GraduationCap,
  CalendarDays,
  Clock3,
  FolderOpen,
  MoonStar,
  Sparkles,
  X,
} from "lucide-react";
import Layout from "@/components/digitalclassroom/Layout";
import {
 getMaterialIcon,
 StatCard,
  MaterialCard,
  MaterialListItem,
  EmptyMaterials,
  getYouTubeEmbedUrl,
} from "@/components/digitalclassroom/dashborad";

import useAuthStore from "@/lib/authStore";
import {
  getMyDigitalStudentStudyMaterials,
  downloadDigitalStudentStudyMaterial,
} from "@/lib/digitalClassStudentService";



export default function StudyMaterialsPage() {
  const { userData, user } = useAuthStore();
  const [materials, setMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [subject, setSubject] = useState("All");
  const [viewMode, setViewMode] = useState("grid");
  const [
  selectedMaterial,
  setSelectedMaterial,
] = useState(null);

const [
  isViewMaterialOpen,
  setIsViewMaterialOpen,
] = useState(false);
const [downloadingMaterialId, setDownloadingMaterialId,] = useState(null);

  const studentName =
    userData?.fullName ||
    userData?.studentName ||
    user?.displayName ||
    "Student";

  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      const matchesSearch =
        item.title
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        item.subject
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        item.teacher
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesSubject =
        subject === "All" ||
        item.subject === subject;

      return matchesSearch && matchesSubject;
    });
  }, [materials, searchTerm, subject]);

  const handleViewMaterial = (
  material
) => {
  setSelectedMaterial(
    material
  );

  setIsViewMaterialOpen(
    true
  );
};

  function formatFileSize(bytes) {
  const value =
    Number(bytes);

  if (
    !value ||
    value <= 0
  ) {
    return null;
  }

  const kb =
    value / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(
      1
    )} KB`;
  }

  const mb =
    kb / 1024;

  return `${mb.toFixed(
    1
  )} MB`;
}

useEffect(() => {
  let active = true;

  const loadMaterials =
    async () => {
      if (!user?.uid) {
        if (active) {
          setMaterials([]);
          setMaterialsLoading(
            false
          );
        }

        return;
      }

      try {
        setMaterialsLoading(
          true
        );

        const result =
          await getMyDigitalStudentStudyMaterials();

        if (!active) {
          return;
        }

        const loadedMaterials =
          Array.isArray(
            result?.materials
          )
            ? result.materials.map(
                (item) => ({
                  ...item,

                  
             

                  teacher:
                    item?.teacherName ||
                    item?.ustadName ||
                    result?.teacherName ||
                    "Ustad",

                  type:
                    getMaterialDisplayType(
                      item?.materialType ||
                        item?.type
                    ),

                  size:
                    formatFileSize(
                      item?.fileSize
                    ),

                  date:
                    formatMaterialDate(
                      item?.createdAt
                    ),

                  subject:
                    item?.subject ||
                    item?.subjectName ||
                    "",
                })
              )
            : [];

        setMaterials(
          loadedMaterials
        );

        console.log(
          "DIGITAL STUDENT STUDY MATERIALS:",
          loadedMaterials
        );
      } catch (error) {
        console.error(
          "LOAD DIGITAL STUDENT STUDY MATERIALS ERROR:",
          error
        );

        if (active) {
          setMaterials([]);
        }
      } finally {
        if (active) {
          setMaterialsLoading(
            false
          );
        }
      }
    };

  loadMaterials();

  return () => {
    active = false;
  };
}, [user?.uid]);

function formatMaterialDate(
  value
) {
  if (!value) {
    return "-";
  }

  try {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }

    return date.toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  } catch {
    return "-";
  }
}

const handleDownloadMaterial =
  async (materialOrId) => {
    const materialId =
      typeof materialOrId === "string"
        ? materialOrId
        : materialOrId?.id;

    if (!materialId) {
      alert(
        "Study material ID is missing."
      );

      return;
    }

    try {
      setDownloadingMaterialId(
        materialId
      );

      await downloadDigitalStudentStudyMaterial(
        materialId
      );
    } catch (error) {
      console.log(
        "DOWNLOAD ERROR:",
        error?.message
      );

      alert(
        error?.message ||
        "Unable to download material."
      );
    } finally {
      setDownloadingMaterialId(
        null
      );
    }
  };

function getMaterialDisplayType(
  type
) {
  const value =
    String(type || "")
      .trim()
      .toLowerCase();

  if (value === "pdf") {
    return "PDF";
  }

  if (
    value === "youtube" ||
    value === "video"
  ) {
    return "Video";
  }

  if (value === "image") {
    return "Image";
  }

  return "Document";
}

const subjectOptions =
  useMemo(() => {
    const subjects =
      materials
        .map(
          (item) =>
            item?.subject
        )
        .filter(Boolean);

    return [
      "All",
      ...new Set(subjects),
    ];
  }, [materials]);
  return (
  <Layout user={user}>
  <main className="min-h-screen bg-[#f8faf8]">
  
      <div className="min-h-screen ">

        {/* =====================================
            PAGE CONTENT
        ====================================== */}

        <div className="space-y-6 p-4 sm:p-6 lg:p-8">

          {/* =====================================
              HEADER BANNER
          ====================================== */}

          <section className="relative overflow-hidden rounded-[30px] border border-teal-100 bg-gradient-to-r from-[#fffdf7] via-[#f5fbf8] to-[#ddf4ef] p-6 shadow-sm sm:p-8">

            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[22px] border-teal-700/5" />

            <MoonStar className="absolute right-12 top-8 h-20 w-20 text-amber-400/10" />

            <div className="relative z-10 max-w-3xl">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-600">
                <Sparkles className="h-4 w-4" />
                Digital Madrasa
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Study Materials
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Assalamu Alaikum {studentName}. Access your
                lesson notes, PDF materials, documents and
                educational resources from one place.
              </p>

              <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                <BookOpen className="h-4 w-4" />
                Learn • Practice • Grow
              </div>
            </div>
          </section>

          {/* =====================================
              STAT CARDS
          ====================================== */}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <StatCard
              icon={FolderOpen}
              value={materials.length}
              label="Total Materials"
              iconClass="bg-teal-100 text-teal-700"
            />

            <StatCard
              icon={FileText}
              value={
                materials.filter(
                  (item) => item.type === "PDF"
                ).length
              }
              label="PDF Notes"
              iconClass="bg-blue-100 text-blue-700"
            />

            <StatCard
              icon={Video}
              value={
                materials.filter(
                  (item) => item.type === "Video"
                ).length
              }
              label="Video Materials"
              iconClass="bg-violet-100 text-violet-700"
            />

            <StatCard
              icon={BookMarked}
              value={
  subjectOptions.filter(
    (item) =>
      item !== "All"
  ).length
}
              label="Subjects"
              iconClass="bg-amber-100 text-amber-700"
            />

          </section>

          {/* =====================================
              SEARCH / FILTER BAR
          ====================================== */}

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">

              {/* Search */}

              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(e.target.value)
                  }
                  placeholder="Search study materials..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-11 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                />

                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Subject filter */}

              <div className="relative min-w-[220px]">
                <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <select
                  value={subject}
                  onChange={(e) =>
                    setSubject(e.target.value)
                  }
                  className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                >
                  {subjectOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              {/* View switch */}

              <div className="flex h-12 items-center rounded-2xl border border-slate-200 bg-slate-50 p-1">

                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`flex h-9 w-10 items-center justify-center rounded-xl transition ${
                    viewMode === "grid"
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-slate-400"
                  }`}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`flex h-9 w-10 items-center justify-center rounded-xl transition ${
                    viewMode === "list"
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-slate-400"
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>

              </div>
            </div>

          </section>

          {/* =====================================
              TITLE
          ====================================== */}

          <section>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Available Materials
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredMaterials.length} materials found
                </p>
              </div>
            </div>
          </section>

          {/* =====================================
              MATERIALS
          ====================================== */}

          {materialsLoading ? (

  <div className="flex min-h-[260px] items-center justify-center rounded-[24px] border border-slate-200 bg-white">

    <div className="text-center">

      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-teal-100 border-t-teal-600" />

      <p className="mt-3 text-sm font-medium text-slate-500">
        Loading study materials...
      </p>

    </div>

  </div>

) : filteredMaterials.length === 0 ? (

  <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-16 text-center">

    <FolderOpen className="mx-auto h-10 w-10 text-slate-300" />

    <p className="mt-3 text-sm font-semibold text-slate-700">
      No study materials found
    </p>

    <p className="mt-1 text-xs text-slate-400">
      Materials shared by your assigned Digital Teacher will appear here.
    </p>

  </div>

) : viewMode === "grid" ? (

  <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">

    {filteredMaterials.map(
      (material) => (
        <MaterialCard
          key={material.id}
          material={material}
           onView={
    handleViewMaterial
  }
  onDownload={
    handleDownloadMaterial
  }
  downloading={
    downloadingMaterialId ===
    material.id
  }

        />
      )
    )}

  </div>

) : (

  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">

    {filteredMaterials.map(
      (
        material,
        index
      ) => (
        <MaterialListItem
  key={material.id}
  material={material}
  onView={
    handleViewMaterial
  }
  onDownload={
    handleDownloadMaterial
  }
   downloading={
    downloadingMaterialId ===
    material.id
  }
  last={
    index ===
    filteredMaterials.length - 1
  }
/>
      )
    )}

  </div>

)}
        </div>
      </div>
    </main>
    {isViewMaterialOpen &&
  selectedMaterial && (
    <div
      className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
      onClick={() => {
        setIsViewMaterialOpen(
          false
        );

        setSelectedMaterial(
          null
        );
      }}
    >
      <div
        className="mx-auto my-6 w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(
          event
        ) =>
          event.stopPropagation()
        }
      >

        {/* HEADER */}

        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">

          <div className="min-w-0">

            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
              Study Material
            </p>

            <h2 className="mt-1 truncate text-xl font-bold text-slate-900">
              {
                selectedMaterial.title
              }
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">

              {selectedMaterial.subject && (
                <span>
                  {
                    selectedMaterial.subject
                  }
                </span>
              )}

              {selectedMaterial.className && (
                <>
                  <span>•</span>

                  <span>
                    {
                      selectedMaterial.className
                    }
                  </span>
                </>
              )}

              {selectedMaterial.teacher && (
                <>
                  <span>•</span>

                  <span>
                    Ustad:{" "}
                    {
                      selectedMaterial.teacher
                    }
                  </span>
                </>
              )}

            </div>

          </div>


          <button
            type="button"
            onClick={() => {
              setIsViewMaterialOpen(
                false
              );

              setSelectedMaterial(
                null
              );
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>

        </div>


        {/* PREVIEW */}

        <div className="bg-slate-50 p-4 sm:p-6">

          {/* YOUTUBE */}

          {(
            selectedMaterial
              ?.materialType ===
              "youtube" ||
            selectedMaterial
              ?.type ===
              "Video" ||
            selectedMaterial
              ?.youtubeUrl
          ) ? (

            getYouTubeEmbedUrl(
              selectedMaterial
                ?.youtubeUrl
            ) ? (

              <div className="overflow-hidden rounded-2xl bg-black shadow-sm">

                <div className="aspect-video">

                  <iframe
                    src={getYouTubeEmbedUrl(
                      selectedMaterial
                        .youtubeUrl
                    )}
                    title={
                      selectedMaterial.title
                    }
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />

                </div>

              </div>

            ) : (

              <div className="flex min-h-[350px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-center">

                <div>
                  <Video className="mx-auto h-10 w-10 text-slate-300" />

                  <p className="mt-3 text-sm font-semibold text-slate-600">
                    Video unavailable
                  </p>
                </div>

              </div>

            )

          ) : selectedMaterial
              ?.materialType ===
              "image" ? (

            /* IMAGE */

            selectedMaterial
              ?.fileUrl ? (

              <div className="flex min-h-[400px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">

                <img
                  src={
                    selectedMaterial.fileUrl
                  }
                  alt={
                    selectedMaterial.title ||
                    "Study material"
                  }
                  className="max-h-[70vh] max-w-full rounded-xl object-contain"
                />

              </div>

            ) : null

          ) : (

            /* PDF / DOCUMENT */

            selectedMaterial
              ?.fileUrl ? (

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

                <iframe
                  src={
                    selectedMaterial.fileUrl
                  }
                  title={
                    selectedMaterial.title
                  }
                  className="h-[70vh] w-full"
                />

              </div>

            ) : (

              <div className="flex min-h-[350px] items-center justify-center rounded-2xl border border-slate-200 bg-white">

                <div className="text-center">

                  <FileText className="mx-auto h-10 w-10 text-slate-300" />

                  <p className="mt-3 text-sm font-semibold text-slate-600">
                    Preview unavailable
                  </p>

                </div>

              </div>

            )

          )}

        </div>


        {/* DESCRIPTION / ACTION */}

        <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">

          <div>

            {selectedMaterial.description && (
              <p className="max-w-2xl text-sm leading-6 text-slate-500">
                {
                  selectedMaterial.description
                }
              </p>
            )}

          </div>


          {/* NO DOWNLOAD FOR YOUTUBE */}

          {!selectedMaterial
              ?.youtubeUrl &&
            selectedMaterial
              ?.fileUrl && (

              <button
                type="button"
                onClick={() =>
                  window.open(
                    selectedMaterial.fileUrl,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
              >
                <Download className="h-4 w-4" />

                Open File
              </button>

            )}

        </div>

      </div>
    </div>
  )}
    </Layout>
  );
}


