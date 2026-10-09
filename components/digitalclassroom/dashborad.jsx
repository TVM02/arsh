"use client";


import {
  
  BookOpen,
  FileText,
  Download,
  Eye,
  Video,
  File,
 
  GraduationCap,
  CalendarDays,
 
  FolderOpen,
  MoonStar,
 
   ChevronRight,
  CheckCircle2,
} from "lucide-react";

// ==========================================
// DASHBOARD STAT
// ==========================================

function DashboardStat({
  icon: Icon,
  value,
  title,
  subtitle,
  iconClass = "bg-teal-50 text-teal-600",
}) {
  return (
    <div
      className="
        group flex items-center gap-3
        rounded-[18px]
        border border-slate-100
        bg-white p-4
        shadow-[0_8px_30px_rgba(15,23,42,0.04)]
        transition
        hover:-translate-y-0.5
        hover:shadow-lg
      "
    >
      <div
        className={`
          flex h-12 w-12 shrink-0
          items-center justify-center
          rounded-xl
          ${iconClass}
        `}
      >
        <Icon className="h-6 w-6" />
      </div>

      <div className="min-w-0">
        <p className="text-xl font-extrabold text-[#07184c]">
          {value}
        </p>

        <p className="truncate text-[11px] font-medium text-slate-500">
          {title}
        </p>

        {subtitle && (
          <p className="text-[10px] text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}


// ==========================================
// DASHBOARD CARD
// ==========================================

function DashboardCard({ children, className = "" }) {
  return (
    <div
      className={`
        rounded-[20px]
        border border-slate-100
        bg-white
        p-5
        shadow-[0_10px_35px_rgba(15,23,42,0.04)]
        ${className}
      `}
    >
      {children}
    </div>
  );
}


// ==========================================
// ASSIGNMENT STATUS
// ==========================================

function AssignmentStatus({ status }) {
  const completed =
    status?.toLowerCase() === "completed";

  return (
    <span
      className={`
        hidden rounded-lg
        px-2.5 py-1.5
        text-[10px] font-bold
        sm:inline-flex
        ${
          completed
            ? "bg-emerald-50 text-emerald-600"
            : "bg-orange-50 text-orange-500"
        }
      `}
    >
      {completed ? "Completed" : "Pending"}
    </span>
  );
}


// ==========================================
// LOADING
// ==========================================

function DashboardLoading({
  text = "Loading...",
}) {
  return (
    <div className="py-10 text-center">
      <div
        className="
          mx-auto h-7 w-7
          animate-spin
          rounded-full
          border-2
          border-teal-100
          border-t-teal-600
        "
      />

      <p className="mt-3 text-xs text-slate-400">
        {text}
      </p>
    </div>
  );
}


// ==========================================
// EMPTY WIDGET
// ==========================================

function EmptyWidget({
  icon: Icon,
  text = "No data available",
}) {
  return (
    <div className="py-10 text-center">
      <div
        className="
          mx-auto flex h-12 w-12
          items-center justify-center
          rounded-full
          bg-slate-50
          text-slate-300
        "
      >
        {Icon && <Icon className="h-5 w-5" />}
      </div>

      <p className="mt-3 text-xs font-medium text-slate-400">
        {text}
      </p>
    </div>
  );
}


// ==========================================
// RIGHT LIST ITEM
// ==========================================

function RightListItem({
  icon: Icon,
  title,
  description,
  iconClass = "bg-teal-50 text-teal-600",
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3 py-4
        ${onClick ? "cursor-pointer" : ""}
      `}
    >
      <div
        className={`
          flex h-10 w-10 shrink-0
          items-center justify-center
          rounded-xl
          ${iconClass}
        `}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-slate-800">
          {title}
        </p>

        <p className="mt-1 text-[11px] text-slate-400">
          {description}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 text-slate-300" />
    </div>
  );
}


// ==========================================
// STUDENT INFO
// ==========================================

function StudentInfo({
  label,
  value,
  status = false,
}) {
  return (
    <div
      className="
        flex items-center justify-between
        border-b border-slate-50
        py-3 last:border-0
      "
    >
      <span className="text-xs font-medium text-slate-400">
        {label}
      </span>

      {status ? (
        <span
          className="
            inline-flex items-center gap-1
            rounded-full
            bg-emerald-50
            px-2.5 py-1
            text-[10px]
            font-bold capitalize
            text-emerald-600
          "
        >
          <CheckCircle2 className="h-3 w-3" />

          {value}
        </span>
      ) : (
        <span
          className="
            max-w-[150px]
            truncate
            text-xs
            font-bold
            text-slate-700
          "
        >
          {value}
        </span>
      )}
    </div>
  );
}


// ==========================================
// MINI CALENDAR
// ==========================================

function MiniCalendar() {
  const today = new Date();

  const year = today.getFullYear();
  const month = today.getMonth();

  const firstDay =
    new Date(year, month, 1).getDay();

  const daysInMonth =
    new Date(year, month + 1, 0).getDate();

  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 text-center">
        {[
          "Sun",
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
        ].map((day) => (
          <span
            key={day}
            className="text-[9px] font-semibold text-slate-400"
          >
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {days.map((day, index) => {
          const active =
            day === today.getDate();

          return (
            <div
              key={index}
              className="flex h-8 items-center justify-center"
            >
              {day && (
                <span
                  className={`
                    flex h-7 w-7
                    items-center justify-center
                    rounded-full
                    text-[10px]
                    font-semibold
                    transition
                    ${
                      active
                        ? "bg-teal-600 text-white shadow-md shadow-teal-100"
                        : "text-slate-600 hover:bg-teal-50"
                    }
                  `}
                >
                  {day}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ==========================================
// MOSQUE SILHOUETTE
// ==========================================

function MosqueSilhouette() {
  return (
    <svg
      viewBox="0 0 1200 120"
      fill="currentColor"
      className="w-full text-teal-700"
      preserveAspectRatio="none"
    >
      <path
        d="
          M0 120 V95 H80 V80 H90 V48
          Q100 20 110 48 V80 H130
          Q160 45 190 80 H230
          V55 H240 V35
          Q250 15 260 35 V55 H280
          Q320 20 360 55 V120

          M360 120 H450 V75
          Q490 25 530 75 V120

          M530 120 H640 V60 H650 V35
          Q660 12 670 35 V60 H690
          Q730 25 770 60 V120

          M770 120 H870 V82
          Q900 45 930 82 V120

          M930 120 H1020 V60 H1030 V35
          Q1040 10 1050 35 V60 H1070
          Q1110 25 1150 60 V120 Z
        "
      />
    </svg>
  );
}


// ==========================================
// ISLAMIC PATTERN
// ==========================================

function IslamicPattern() {
  return (
    <svg
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="dcIslamicPattern"
          width="60"
          height="60"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M30 0 L60 30 L30 60 L0 30 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />

          <circle
            cx="30"
            cy="30"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </pattern>
      </defs>

      <rect
        width="100%"
        height="100%"
        fill="url(#dcIslamicPattern)"
        className="text-teal-700"
      />
    </svg>
  );
}
function StatCard({
  icon: Icon,
  value,
  label,
  iconClass,
}) {
  return (
    <div className="group rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconClass}`}
        >
          <Icon className="h-7 w-7" />
        </div>

        <div>
          <p className="text-2xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-0.5 text-sm text-slate-500">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  className,
}) {
  return (
    <button
      type="button"
      className={`flex min-h-[82px] flex-col items-start justify-center gap-2 rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${className}`}
    >
      <Icon className="h-5 w-5" />

      <span className="text-xs font-bold sm:text-sm">
        {label}
      </span>
    </button>
  );
}
function MaterialCard({ material, onView, onDownload, downloading = false, }) {
  const Icon = getMaterialIcon(material.type);
const isYouTube =
  material?.materialType === "youtube" ||
  material?.type === "Video" ||
  Boolean(material?.youtubeUrl);
  return (
    <article className="group overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">

      <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-teal-50 via-emerald-50 to-amber-50">

        <div className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-teal-700 shadow-sm">
          {material.type}
        </div>

        <MoonStar className="absolute -bottom-5 -right-5 h-28 w-28 text-teal-700/[0.04]" />

        <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-white text-teal-700 shadow-lg shadow-teal-900/10">
          <Icon className="h-9 w-9" />
        </div>

      </div>

      <div className="p-5">

        <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
          {material.subject}
        </p>

        <h3 className="mt-2 line-clamp-2 text-lg font-bold text-slate-900">
          {material.title}
        </h3>

        <p className="mt-2 line-clamp-2 min-h-[40px] text-sm leading-5 text-slate-500">
          {material.description}
        </p>

        <div className="mt-4 space-y-2 text-xs text-slate-500">

          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-slate-400" />
            {material.teacher}
          </div>

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              {material.date}
            </div>

            <span>{material.size}</span>

          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">

          <button
  type="button"
  onClick={() =>
    onView?.(
      material
    )
  }
  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
>
  <Eye className="h-4 w-4" />

  View
</button>

         {isYouTube ? (

  <button
    type="button"
    
    onClick={() =>
    onView?.(
      material
    )
  }
    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <Video className="h-4 w-4" />

    Watch Video
  </button>

) : (

  <button
  type="button"
  disabled={
    !material?.fileUrl ||
    downloading
  }
  onClick={() => {
    onDownload?.(material);
  }}
  className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
>
  {downloading ? (
    <>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      Downloading...
    </>
  ) : (
    <>
      <Download className="h-4 w-4" />
      Download
    </>
  )}
</button>

)}

        </div>

      </div>
    </article>
  );
}

/* =====================================
   LIST ITEM
===================================== */

function MaterialListItem({
  material,
  last,
   onView,
   onDownload,
   downloading = false,
}) {
  const Icon = getMaterialIcon(material.type);
  const isYouTube =
  material?.materialType === "youtube" ||
  material?.type === "Video" ||
  Boolean(material?.youtubeUrl);

  return (
    <div
      className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center ${
        !last
          ? "border-b border-slate-100"
          : ""
      }`}
    >

      <div className="flex flex-1 items-center gap-4">

        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <Icon className="h-6 w-6" />
        </div>

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">

            <h3 className="truncate font-bold text-slate-900">
              {material.title}
            </h3>

            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold uppercase text-teal-700">
              {material.type}
            </span>

          </div>

          <p className="mt-1 text-sm font-medium text-teal-700">
            {material.subject}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">

            <span>{material.teacher}</span>

            <span>{material.date}</span>

            <span>{material.size}</span>

          </div>

        </div>
      </div>

      <div className="flex gap-2 sm:shrink-0">

        <button onClick={() =>
  onView?.(
    material
  )
}
         className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          <Eye className="h-4 w-4" />
          View
        </button>

        {isYouTube ? (

  <button
    type="button"
    onClick={() =>
    onView?.(
      material
    )
  }
    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <Video className="h-4 w-4" />

    Watch Video
  </button>

) : (
<button
  type="button"
  disabled={
    !material?.fileUrl ||
    downloading
  }
  onClick={() => {
    onDownload?.(material);
  }}
  className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
>
  {downloading ? (
    <>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      Downloading...
    </>
  ) : (
    <>
      <Download className="h-4 w-4" />
      Download
    </>
  )}
</button>

)}

      </div>

    </div>
  );
}

/* =====================================
   STAT CARD
===================================== */



/* =====================================
   EMPTY
===================================== */

function EmptyMaterials() {
  return (
    <div className="flex min-h-[350px] flex-col items-center justify-center rounded-[26px] border border-dashed border-slate-300 bg-white p-8 text-center">

      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-50">
        <FolderOpen className="h-9 w-9 text-teal-600" />
      </div>

      <h3 className="mt-5 text-lg font-bold text-slate-900">
        No study materials found
      </h3>

      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Try changing your search or subject filter.
      </p>

    </div>
  );
}

/* =====================================
   ICON
===================================== */

function getMaterialIcon(type) {
  if (type === "Video") {
    return Video;
  }

  if (type === "PDF") {
    return FileText;
  }

  if (type === "Document") {
    return File;
  }

  return BookOpen;
}


function getYouTubeEmbedUrl(
  url
) {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl =
      new URL(url);

    let videoId =
      null;

    if (
      parsedUrl.hostname.includes(
        "youtu.be"
      )
    ) {
      videoId =
        parsedUrl.pathname
          .replace("/", "")
          .split("/")[0];
    }

    if (
      parsedUrl.hostname.includes(
        "youtube.com"
      )
    ) {
      videoId =
        parsedUrl.searchParams.get(
          "v"
        );

      if (
        !videoId &&
        parsedUrl.pathname.includes(
          "/shorts/"
        )
      ) {
        videoId =
          parsedUrl.pathname
            .split(
              "/shorts/"
            )[1]
            ?.split("/")[0];
      }

      if (
        !videoId &&
        parsedUrl.pathname.includes(
          "/embed/"
        )
      ) {
        videoId =
          parsedUrl.pathname
            .split(
              "/embed/"
            )[1]
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
// ==========================================
// EXPORT ALL
// ==========================================

export {
  getMaterialIcon,
  MaterialCard,
  MaterialListItem,
  EmptyMaterials,
  StatCard,
  QuickAction,
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
  getYouTubeEmbedUrl,
};