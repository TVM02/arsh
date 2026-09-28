"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Layout from "@/components/digitalclassroom/Layout";

import {

  BookOpen,
  Clock3,
  Download,
  FileText,

  Headphones,
  Layers3,
  Link2,

  Plus,
  Search,
  Users,
  Video,
   ArrowLeft,
  CalendarDays,
  FileImage,
  Upload,
  UserRound,
  Youtube,
  Eye,
  Trash2,
  X,
} from "lucide-react";



import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import {
  db,
  storage,
} from "@/lib/firebase";

import { toast } from "sonner";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { MaterialRow, FolderRow, RecentUpload, SummaryCard} from "@/components/digitalclassroom/tecaherstudent"
import useAuthStore from "@/lib/authStore";
/* =========================================================
   DEMO DATA
========================================================= */


function formatFileSize(
  bytes,
) {
  if (
    !bytes ||
    bytes <= 0
  ) {
    return null;
  }

  const kb =
    bytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(
      1,
    )} KB`;
  }

  const mb =
    kb / 1024;

  return `${mb.toFixed(
    1,
  )} MB`;
}
function formatMaterialDate(
  timestamp,
) {
  if (!timestamp) {
    return "Just now";
  }

  try {
    const date =
      typeof timestamp?.toDate === "function"
        ? timestamp.toDate()
        : new Date(timestamp);

    return date.toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    );
  } catch {
    return "-";
  }
}


export default function DigitalTeacherStudyMaterialsPage() {
const [ materials, setMaterials,] = useState([]);
const [materialsLoading, setMaterialsLoading,] = useState(true);
const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const { user, userData } = useAuthStore();
const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [activeType, setActiveType] = useState("all");
  const [selectedClass, setSelectedClass ] = useState("all");
 const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");

 const [subjectName, setSubjectName] = useState("");
  const [title, setTitle] = useState("");
  const [className, setClassName] = useState("");
  const [materialType, setMaterialType] = useState("pdf");

  const [file, setFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
const [selectedMaterial, setSelectedMaterial] =
  useState(null);

const [isViewMaterialOpen, setIsViewMaterialOpen] =
  useState(false);

const [
  deletingMaterialId,
  setDeletingMaterialId,
] = useState(null);


  const ustadName =
    userData?.fullName ||
    userData?.name ||
    userData?.teacherName ||
    user?.displayName ||
    "Ustad";

  /* =====================================================
     AUTO DATE
  ===================================================== */

  const currentDate = useMemo(() => {
    return new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, []);

/* =====================================================
   LOAD LOGGED-IN USTAD MATERIALS
===================================================== */

useEffect(() => {
  if (!user?.uid) {
    setMaterials([]);
    setMaterialsLoading(false);

    return;
  }

  setMaterialsLoading(true);

  const materialsQuery =
    query(
      collection(
        db,
        "digitalStudyMaterials",
      ),
      where(
        "teacherUid",
        "==",
        user.uid,
      ),
    );

  const unsubscribe =
    onSnapshot(
      materialsQuery,

      (snapshot) => {
        const loadedMaterials =
          snapshot.docs
            .map((document) => {
              const data =
                document.data();

              const createdAtMillis =
                typeof data?.createdAt?.toMillis ===
                "function"
                  ? data.createdAt.toMillis()
                  : 0;

              return {
  id: document.id,

  title:
    data?.title ||
    "Untitled Material",

  subject:
    data?.subjectName ||
    data?.subject ||
    "",

  subjectName:
    data?.subjectName ||
    "",

  className:
    data?.className ||
    "",

  type:
    data?.materialType ||
    data?.type ||
    "",

  materialType:
    data?.materialType ||
    "",

  ustadName:
    data?.ustadName ||
    "",

  teacherUid:
    data?.teacherUid ||
    "",

  teacherEmail:
    data?.teacherEmail ||
    "",

  fileUrl:
    data?.fileUrl ||
    null,

 fileName:
  data?.fileName || null,

storagePath:
  data?.storagePath || null,

  fileSize:
    data?.fileSize ||
    null,

  youtubeUrl:
    data?.youtubeUrl ||
    null,

  size:
    data?.fileSize
      ? formatFileSize(
          data.fileSize,
        )
      : null,

  date:
    formatMaterialDate(
      data?.createdAt,
    ),

  downloads:
    Number(
      data?.downloads || 0,
    ),

  sharedClasses: 1,

  description:
    data?.description ||
    "",

  folder:
    data?.subjectName ||
    "Study Materials",

  status:
    data?.status ||
    "active",

  // IMPORTANT: STRING, NOT FIREBASE TIMESTAMP OBJECT
  createdAt:
    formatMaterialDate(
      data?.createdAt,
    ),

  // NUMBER FOR SORTING
  createdAtMillis,
};
            })
            .sort(
              (a, b) =>
                b.createdAtMillis -
                a.createdAtMillis,
            );

        setMaterials(
          loadedMaterials,
        );

        setMaterialsLoading(
          false,
        );
      },

      (error) => {
        console.error(
          "LOAD STUDY MATERIALS ERROR:",
          error,
        );

        setMaterials([]);

        setMaterialsLoading(
          false,
        );

        toast.error(
          "Unable to load study materials.",
        );
      },
    );

  return () => {
    unsubscribe();
  };
}, [user?.uid]);


function getYouTubeEmbedUrl(url) {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl =
      new URL(url);

    let videoId = null;

    if (
      parsedUrl.hostname.includes(
        "youtu.be",
      )
    ) {
      videoId =
        parsedUrl.pathname
          .replace("/", "")
          .split("/")[0];
    }

    if (
      parsedUrl.hostname.includes(
        "youtube.com",
      )
    ) {
      videoId =
        parsedUrl.searchParams.get(
          "v",
        );

      if (
        !videoId &&
        parsedUrl.pathname.includes(
          "/shorts/",
        )
      ) {
        videoId =
          parsedUrl.pathname
            .split("/shorts/")[1]
            ?.split("/")[0];
      }

      if (
        !videoId &&
        parsedUrl.pathname.includes(
          "/embed/",
        )
      ) {
        videoId =
          parsedUrl.pathname
            .split("/embed/")[1]
            ?.split("/")[0];
      }
    }

    if (!videoId) {
      return null;
    }

    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

const handleViewMaterial = (
  material,
) => {
  setSelectedMaterial(
    material,
  );

  setIsViewMaterialOpen(
    true,
  );
};

const handleDeleteMaterial =
  async (material) => {
    if (!material?.id) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${material.title}"?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingMaterialId(
        material.id,
      );

      /* =====================================
         DELETE STORAGE FILE
      ====================================== */

      if (
        material.materialType ===
          "pdf" ||
        material.materialType ===
          "image"
      ) {
        if (material.storagePath) {
          try {
            await deleteObject(
              ref(
                storage,
                material.storagePath,
              ),
            );
          } catch (storageError) {
            console.error(
              "STORAGE DELETE ERROR:",
              storageError,
            );
          }
        } else if (
          material.fileUrl
        ) {
          try {
            await deleteObject(
              ref(
                storage,
                material.fileUrl,
              ),
            );
          } catch (storageError) {
            console.error(
              "OLD STORAGE FILE DELETE ERROR:",
              storageError,
            );
          }
        }
      }

      /* =====================================
         DELETE FIRESTORE DOCUMENT
      ====================================== */

      await deleteDoc(
        doc(
          db,
          "digitalStudyMaterials",
          material.id,
        ),
      );

      toast.success(
        "Study material deleted.",
      );

      if (
        selectedMaterial?.id ===
        material.id
      ) {
        setSelectedMaterial(
          null,
        );

        setIsViewMaterialOpen(
          false,
        );
      }
    } catch (error) {
      console.error(
        "DELETE STUDY MATERIAL ERROR:",
        error,
      );

      toast.error(
        error?.message ||
          "Unable to delete material.",
      );
    } finally {
      setDeletingMaterialId(
        null,
      );
    }
  };

const pdfCount =
  materials.filter(
    (material) =>
      material.type === "pdf",
  ).length;

const imageCount =
  materials.filter(
    (material) =>
      material.type === "image",
  ).length;

const youtubeCount =
  materials.filter(
    (material) =>
      material.type === "youtube",
  ).length;

const assignedClasses = useMemo(() => {
  const classes =
    userData?.teachingAssignment?.classes;

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


const assignedSubjects = useMemo(() => {
  const subjects =
    userData?.teachingAssignment?.subjects;

  if (!Array.isArray(subjects)) {
    return [];
  }

  return [...new Set(subjects)]
    .filter(Boolean)
    .sort((a, b) =>
      String(a).localeCompare(
        String(b),
      ),
    );
}, [userData]);
  /* =====================================================
     TYPE COUNTS
  ===================================================== */

 

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
                  material.materialType,
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
    label: "All Materials",
    count: materials.length,
    icon: Layers3,
  },

  {
    id: "pdf",
    label: "PDF",
    count: pdfCount,
    icon: FileText,
  },

  {
    id: "image",
    label: "Images",
    count: imageCount,
    icon: FileImage,
  },

  {
    id: "youtube",
    label: "YouTube",
    count: youtubeCount,
    icon: Youtube,
  },
];

const handleSubmit = async (event) => {
  event.preventDefault();

  if (!user?.uid) {
    toast.error("Please login again.");
    return;
  }

  if (!subjectName) {
    toast.error("Please select subject.");
    return;
  }

  if (!className) {
    toast.error("Please select class.");
    return;
  }

  if (!title.trim()) {
    toast.error("Please enter title.");
    return;
  }

  try {
     setUploadingMaterial(true);
    let fileUrl = null;
    let fileName = null;
    let storagePath = null;

    // PDF OR IMAGE
    if (
      materialType === "pdf" ||
      materialType === "image"
    ) {
      if (!file) {
        toast.error("Please select a file.");
        return;
      }

      const safeName =
        file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_",
        );

    storagePath =
  `digital-study-materials/` +
  `${user.uid}/` +
  `${Date.now()}_${safeName}`;

const storageRef =
  ref(
    storage,
    storagePath,
  );

      await uploadBytes(
        storageRef,
        file,
      );

      fileUrl =
        await getDownloadURL(
          storageRef,
        );

      fileName =
        file.name;
    }

    // YOUTUBE
    if (
      materialType === "youtube" &&
      !youtubeUrl.trim()
    ) {
      toast.error(
        "Please enter YouTube link.",
      );
      return;
    }

    const materialData = {
      subjectName,
      title: title.trim(),
      className,

      ustadName,

      teacherUid:
        user.uid,

      teacherEmail:
        user?.email ||
        userData?.email ||
        null,

      materialType,

      fileUrl,
      fileName,

      youtubeUrl:
        materialType === "youtube"
          ? youtubeUrl.trim()
          : null,

      storagePath,
      status: "active",

      downloads: 0,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    };

    const docRef =
      await addDoc(
        collection(
          db,
          "digitalStudyMaterials",
        ),
        materialData,
      );

    console.log(
      "MATERIAL CREATED:",
      docRef.id,
    );

    toast.success(
      "Study material uploaded successfully.",
    );

    setSubjectName("");
    setTitle("");
    setClassName("");
    setMaterialType("pdf");
    setFile(null);
    setYoutubeUrl("");

    setIsUploadOpen(false);
  } catch (error) {
    console.error(
      "UPLOAD MATERIAL ERROR:",
      error,
    );

    toast.error(
      error?.message ||
        "Unable to upload material.",
    );
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
  onClick={() =>
    setIsUploadOpen(true)
  }
  className="
    inline-flex
    items-center
    gap-2
    rounded-xl
    bg-teal-600
    px-4
    py-2.5
    text-sm
    font-semibold
    text-white
    shadow-sm
    transition
    hover:bg-teal-700
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
              {materialsLoading ? (
  /* =====================================
      LOADING
  ====================================== */

  <div
    className="
      flex
      min-h-[300px]
      items-center
      justify-center
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

      <p className="mt-3 text-sm font-medium text-slate-500">
        Loading study materials...
      </p>
    </div>
  </div>
) : filteredMaterials.length > 0 ? (
  /* =====================================
      MATERIAL LIST
  ====================================== */

  filteredMaterials.map((material) => (
    <MaterialRow
  key={material.id}
  material={material}
  onView={handleViewMaterial}
  onDelete={handleDeleteMaterial}
  deleting={
    deletingMaterialId === material.id
  }
/>
  ))
) : (
  /* =====================================
      EMPTY STATE
  ====================================== */

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
      Try another class, material type or search term.
    </p>
  </div>
)}
            </div>


            {/* =====================================
                RIGHT SIDE
            ====================================== */}

            <aside className="space-y-4">
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
      {isUploadOpen && (
  <div
    className="
      fixed
      inset-0
      z-[9999]
      overflow-y-auto
      bg-black/50
      p-4
      backdrop-blur-sm
    "
    onClick={() =>
      setIsUploadOpen(false)
    }
  >
    <div
      className="
        mx-auto
        my-6
        max-w-5xl
        rounded-3xl
        bg-[#f7f9fb]
        p-4
        shadow-2xl
        md:p-6
      "
      onClick={(event) =>
        event.stopPropagation()
      }
    >

          {/* ==========================================
              HEADER
          ========================================== */}

          <div className="mb-6">

  {/* BACK BUTTON */}

  <button
  type="button"
  onClick={() =>
    setIsUploadOpen(false)
  }
  className="
    mb-4
    inline-flex
    items-center
    gap-2
    rounded-lg
    border
    border-slate-200
    bg-white
    px-3
    py-2
    text-sm
    font-semibold
    text-slate-600
    shadow-sm
    transition
    hover:border-teal-200
    hover:bg-teal-50
    hover:text-teal-700
  "
>
  <ArrowLeft className="h-4 w-4" />

  Back
</button>


  {/* PAGE TITLE */}

  <div className="flex items-center gap-3">
    <div
      className="
        flex
        h-11
        w-11
        items-center
        justify-center
        rounded-xl
        bg-teal-600
        text-white
        shadow-sm
      "
    >
      <BookOpen className="h-5 w-5" />
    </div>

    <div>
      <h1 className="text-2xl font-bold text-slate-900">
        Study Materials
      </h1>

      <p className="mt-1 text-sm text-slate-500">
        Add learning materials for your Digital Classroom students.
      </p>
    </div>
  </div>
</div>


          {/* ==========================================
              FORM CARD
          ========================================== */}

          <form
            onSubmit={handleSubmit}
            className="
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-sm
            "
          >
            {/* FORM HEADER */}

            <div
              className="
                border-b
                border-slate-100
                bg-gradient-to-r
                from-teal-50
                via-white
                to-emerald-50
                px-5
                py-4
                md:px-6
              "
            >
              <h2 className="font-bold text-slate-900">
                Add Study Material
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Enter the material information below.
              </p>
            </div>


            <div className="space-y-6 p-5 md:p-6">

              {/* ======================================
                  USTAD + DATE
              ====================================== */}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                {/* USTAD NAME */}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Ustad Name
                  </label>

                  <div className="relative">
                    <UserRound
                      className="
                        absolute
                        left-3
                        top-1/2
                        h-4
                        w-4
                        -translate-y-1/2
                        text-teal-500
                      "
                    />

                    <input
                      type="text"
                      value={ustadName}
                      readOnly
                      className="
                        h-11
                        w-full
                        rounded-xl
                        border
                        border-slate-200
                        bg-slate-50
                        pl-10
                        pr-3
                        text-sm
                        font-semibold
                        text-slate-700
                        outline-none
                      "
                    />
                  </div>

                </div>


                {/* DATE */}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Date
                  </label>

                  <div className="relative">
                    <CalendarDays
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
                      value={currentDate}
                      readOnly
                      className="
                        h-11
                        w-full
                        rounded-xl
                        border
                        border-slate-200
                        bg-slate-50
                        pl-10
                        pr-3
                        text-sm
                        font-medium
                        text-slate-700
                        outline-none
                      "
                    />
                  </div>
                </div>

              </div>


              {/* ======================================
                  SUBJECT + CLASS
              ====================================== */}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                {/* SUBJECT */}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Subject Name
                    <span className="ml-1 text-red-500">*</span>
                  </label>

                  <select
  required
  value={subjectName}
  onChange={(event) =>
    setSubjectName(
      event.target.value,
    )
  }
  disabled={
    assignedSubjects.length === 0
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
    {assignedSubjects.length > 0
      ? "Select Assigned Subject"
      : "No Subject Assigned"}
  </option>

  {assignedSubjects.map(
    (subject) => (
      <option
        key={subject}
        value={subject}
      >
        {subject}
      </option>
    ),
  )}
</select>
{assignedSubjects.length === 0 && (
  <p className="mt-1.5 text-[11px] font-medium text-red-500">
    No subjects are assigned to your Digital Teacher account.
  </p>
)}
                </div>


                {/* CLASS */}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Class
                    <span className="ml-1 text-red-500">*</span>
                  </label>

                  <select
  required
  value={className}
  onChange={(event) =>
    setClassName(
      event.target.value,
    )
  }
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

              </div>


              {/* ======================================
                  TITLE
              ====================================== */}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Title
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <input
                  type="text"
                  required
                  value={title}
                  onChange={(event) =>
                    setTitle(
                      event.target.value,
                    )
                  }
                  placeholder="Enter study material title"
                  className="
                    h-11
                    w-full
                    rounded-xl
                    border
                    border-slate-200
                    px-3
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


              {/* ======================================
                  DOCUMENT TYPE
              ====================================== */}

              <div>
                <label className="mb-3 block text-xs font-semibold text-slate-700">
                  Document Type
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

                  {/* PDF */}

                  <button
                    type="button"
                    onClick={() => {
                      setMaterialType("pdf");
                      setFile(null);
                      setYoutubeUrl("");
                    }}
                    className={`
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      border
                      p-4
                      text-left
                      transition

                      ${
                        materialType === "pdf"
                          ? "border-teal-400 bg-teal-50 ring-2 ring-teal-100"
                          : "border-slate-200 hover:bg-slate-50"
                      }
                    `}
                  >
                    <FileText className="h-5 w-5 text-red-500" />

                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        PDF
                      </p>

                      <p className="text-[10px] text-slate-400">
                        Upload PDF document
                      </p>
                    </div>
                  </button>


                  {/* IMAGE */}

                  <button
                    type="button"
                    onClick={() => {
                      setMaterialType("image");
                      setFile(null);
                      setYoutubeUrl("");
                    }}
                    className={`
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      border
                      p-4
                      text-left
                      transition

                      ${
                        materialType === "image"
                          ? "border-teal-400 bg-teal-50 ring-2 ring-teal-100"
                          : "border-slate-200 hover:bg-slate-50"
                      }
                    `}
                  >
                    <FileImage className="h-5 w-5 text-sky-500" />

                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        Image
                      </p>

                      <p className="text-[10px] text-slate-400">
                        JPG, PNG or WEBP
                      </p>
                    </div>
                  </button>


                  {/* YOUTUBE */}

                  <button
                    type="button"
                    onClick={() => {
                      setMaterialType("youtube");
                      setFile(null);
                    }}
                    className={`
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      border
                      p-4
                      text-left
                      transition

                      ${
                        materialType === "youtube"
                          ? "border-teal-400 bg-teal-50 ring-2 ring-teal-100"
                          : "border-slate-200 hover:bg-slate-50"
                      }
                    `}
                  >
                    <Youtube className="h-5 w-5 text-red-500" />

                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        YouTube
                      </p>

                      <p className="text-[10px] text-slate-400">
                        Add YouTube link
                      </p>
                    </div>
                  </button>

                </div>
              </div>


              {/* ======================================
                  PDF
              ====================================== */}

              {materialType === "pdf" && (
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Upload PDF
                  </label>

                  <label
                    className="
                      flex
                      min-h-[140px]
                      cursor-pointer
                      flex-col
                      items-center
                      justify-center
                      rounded-2xl
                      border-2
                      border-dashed
                      border-slate-200
                      bg-slate-50
                      p-5
                      text-center
                      transition
                      hover:border-teal-300
                      hover:bg-teal-50/30
                    "
                  >
                    <Upload className="mb-2 h-7 w-7 text-teal-500" />

                    <p className="text-sm font-semibold text-slate-700">
                      {file
                        ? file.name
                        : "Choose PDF file"}
                    </p>

                    <p className="mt-1 text-[10px] text-slate-400">
                      PDF files only
                    </p>

                    <input
                      type="file"
                      accept="application/pdf"
                      required
                      className="hidden"
                      onChange={(event) =>
                        setFile(
                          event.target.files?.[0] ||
                            null,
                        )
                      }
                    />
                  </label>
                </div>
              )}


              {/* ======================================
                  IMAGE
              ====================================== */}

              {materialType === "image" && (
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Upload Image
                  </label>

                  <label
                    className="
                      flex
                      min-h-[140px]
                      cursor-pointer
                      flex-col
                      items-center
                      justify-center
                      rounded-2xl
                      border-2
                      border-dashed
                      border-slate-200
                      bg-slate-50
                      p-5
                      text-center
                      transition
                      hover:border-teal-300
                      hover:bg-teal-50/30
                    "
                  >
                    <FileImage className="mb-2 h-7 w-7 text-sky-500" />

                    <p className="text-sm font-semibold text-slate-700">
                      {file
                        ? file.name
                        : "Choose image"}
                    </p>

                    <p className="mt-1 text-[10px] text-slate-400">
                      JPG, JPEG, PNG or WEBP
                    </p>

                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      required
                      className="hidden"
                      onChange={(event) =>
                        setFile(
                          event.target.files?.[0] ||
                            null,
                        )
                      }
                    />
                  </label>
                </div>
              )}


              {/* ======================================
                  YOUTUBE
              ====================================== */}

              {materialType === "youtube" && (
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    YouTube Link
                  </label>

                  <div className="relative">
                    <Link2
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
                      type="url"
                      required
                      value={youtubeUrl}
                      onChange={(event) =>
                        setYoutubeUrl(
                          event.target.value,
                        )
                      }
                      placeholder="https://youtube.com/watch?v=..."
                      className="
                        h-11
                        w-full
                        rounded-xl
                        border
                        border-slate-200
                        pl-10
                        pr-3
                        text-sm
                        outline-none
                        focus:border-teal-400
                        focus:ring-2
                        focus:ring-teal-100
                      "
                    />
                  </div>
                </div>
              )}

            </div>


            {/* ==========================================
                FOOTER
            ========================================== */}

            <div
              className="
                flex
                justify-end
                border-t
                border-slate-100
                bg-slate-50/50
                px-5
                py-4
                md:px-6
              "
            >
<button
  type="submit"
  disabled={
    uploadingMaterial ||
    assignedClasses.length === 0 ||
    assignedSubjects.length === 0
  }
  className="
    inline-flex
    h-11
    items-center
    justify-center
    gap-2
    rounded-xl
    bg-teal-600
    px-6
    text-sm
    font-bold
    text-white
    shadow-sm
    transition
    hover:bg-teal-700
    disabled:cursor-not-allowed
    disabled:bg-slate-300
    disabled:shadow-none
  "
>
  {uploadingMaterial ? (
    <>
      <div
        className="
          h-4
          w-4
          animate-spin
          rounded-full
          border-2
          border-white/40
          border-t-white
        "
      />

      Uploading...
    </>
  ) : (
    <>
      <Upload className="h-4 w-4" />

      Add Material
    </>
  )}
</button>
            </div>

          </form>
        </div>
      </div>
      )}
      {isViewMaterialOpen &&
  selectedMaterial && (
    <div
      className="
        fixed
        inset-0
        z-[10000]
        flex
        items-center
        justify-center
        bg-black/60
        p-4
        backdrop-blur-sm
      "
      onClick={() => {
        setIsViewMaterialOpen(
          false,
        );

        setSelectedMaterial(
          null,
        );
      }}
    >
      <div
        className="
          max-h-[92vh]
          w-full
          max-w-5xl
          overflow-hidden
          rounded-2xl
          bg-white
          shadow-2xl
        "
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        {/* HEADER */}

        <div
          className="
            flex
            items-center
            justify-between
            border-b
            border-slate-200
            px-5
            py-4
          "
        >
          <div>
            <p
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.14em]
                text-teal-600
              "
            >
              Study Material
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
                selectedMaterial.title
              }
            </h2>

            <p
              className="
                mt-1
                text-xs
                text-slate-500
              "
            >
              {
                selectedMaterial.subject
              }
              {" • "}
              {
                selectedMaterial.className
              }
              {" • "}
              {
                selectedMaterial.ustadName
              }
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsViewMaterialOpen(
                false,
              );

              setSelectedMaterial(
                null,
              );
            }}
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-full
              bg-slate-100
              text-slate-500
              transition
              hover:bg-slate-200
              hover:text-slate-900
            "
          >
            <X className="h-5 w-5" />
          </button>
        </div>


        {/* CONTENT */}

        <div
          className="
            max-h-[calc(92vh-85px)]
            overflow-y-auto
            bg-slate-50
            p-4
            md:p-6
          "
        >

          {/* ==============================
              YOUTUBE
          ============================== */}

          {selectedMaterial.type ===
            "youtube" && (
            <>
              {getYouTubeEmbedUrl(
                selectedMaterial.youtubeUrl,
              ) ? (
                <div
                  className="
                    overflow-hidden
                    rounded-2xl
                    bg-black
                    shadow-sm
                  "
                >
                  <div
                    className="
                      relative
                      aspect-video
                      w-full
                    "
                  >
                    <iframe
                      src={getYouTubeEmbedUrl(
                        selectedMaterial.youtubeUrl,
                      )}
                      title={
                        selectedMaterial.title
                      }
                      className="
                        absolute
                        inset-0
                        h-full
                        w-full
                      "
                      allow="
                        accelerometer;
                        autoplay;
                        clipboard-write;
                        encrypted-media;
                        gyroscope;
                        picture-in-picture;
                        web-share
                      "
                      allowFullScreen
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="
                    rounded-xl
                    border
                    border-red-200
                    bg-red-50
                    p-5
                    text-sm
                    text-red-600
                  "
                >
                  Invalid YouTube link.
                </div>
              )}
            </>
          )}


          {/* ==============================
              PDF
          ============================== */}

          {selectedMaterial.type ===
            "pdf" && (
            <>
              {selectedMaterial.fileUrl ? (
                <div
                  className="
                    overflow-hidden
                    rounded-2xl
                    border
                    border-slate-200
                    bg-white
                  "
                >
                  <iframe
                    src={
                      selectedMaterial.fileUrl
                    }
                    title={
                      selectedMaterial.title
                    }
                    className="
                      h-[75vh]
                      w-full
                    "
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  PDF file not available.
                </p>
              )}
            </>
          )}


          {/* ==============================
              IMAGE
          ============================== */}

          {selectedMaterial.type ===
            "image" && (
            <>
              {selectedMaterial.fileUrl ? (
                <div
                  className="
                    flex
                    justify-center
                    rounded-2xl
                    border
                    border-slate-200
                    bg-white
                    p-4
                  "
                >
                  <img
                    src={
                      selectedMaterial.fileUrl
                    }
                    alt={
                      selectedMaterial.title ||
                      "Study material"
                    }
                    className="
                      max-h-[75vh]
                      max-w-full
                      rounded-xl
                      object-contain
                    "
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Image not available.
                </p>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )}
    </Layout>
  );
}