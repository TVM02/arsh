
import {  
  MoreHorizontal,
   UserRound,
  BookOpen,
  Clock3, 
  MoreVertical,
  Play,
FileImage,
  Users,
  Video,

 Download,
  FileText,
  Folder,
  Headphones,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";

function FilterSelect({
  label,
  value,
  onChange,
  children,
}) {
  return (
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
        {label}
      </label>

      <select
        value={value}
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
          )
        }
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
          transition
          focus:border-teal-400
          focus:ring-2
          focus:ring-teal-100
        "
      >
        {children}
      </select>
    </div>
  );
}


/* =========================================================
   ACTION BUTTON
========================================================= */

function ActionButton({
  icon: Icon,
  type,
}) {
    const SafeIcon =
    Icon || MoreHorizontal;

  return (
    <button
      type="button"
      className={`
        flex
        h-8
        w-8
        items-center
        justify-center
        rounded-lg
        border
        transition

        ${
          type === "view"
            ? "border-blue-100 bg-blue-50 text-blue-500 hover:bg-blue-100"
            : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
        }
      `}
    >
      <SafeIcon className="h-6 w-6" />
    </button>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  type,
  rightText,
}) {
     const SafeIcon =
    Icon || UserRound;
  const styles = {
    green: {
      card:
        "border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50",

      icon:
        "bg-emerald-100 text-emerald-600",
    },

    blue: {
      card:
        "border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50",

      icon:
        "bg-blue-100 text-blue-600",
    },

    pink: {
      card:
        "border-pink-100 bg-gradient-to-br from-pink-50 to-rose-50",

      icon:
        "bg-pink-100 text-pink-600",
    },

    orange: {
      card:
        "border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50",

      icon:
        "bg-orange-100 text-orange-500",
    },

    violet: {
      card:
        "border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50",

      icon:
        "bg-violet-100 text-violet-600",
    },
    
  };

  return (
    <div
      className={`
        rounded-2xl
        border
        p-4
        shadow-[0_7px_20px_rgba(15,23,42,0.04)]

        ${styles[type].card}
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
            shrink-0
            items-center
            justify-center
            rounded-2xl

            ${styles[type].icon}
          `}
        >
<SafeIcon className="h-6 w-6" />
        </div>

        <div className="min-w-0">
          <p
            className="
              text-[10px]
              font-medium
              text-slate-500
            "
          >
            {title}
          </p>

          <div
            className="
              mt-0.5
              flex
              items-center
              gap-2
            "
          >
            <p
              className="
                text-2xl
                font-bold
                text-slate-900
              "
            >
              {value}
            </p>

            {rightText && (
              <span
                className="
                  text-[10px]
                  font-semibold
                  text-emerald-600
                "
              >
                {rightText}
              </span>
            )}
          </div>

          <p
            className="
              mt-1
              truncate
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


function LiveClassCard({
  classItem,
}) {
  const isLive =
    classItem.status ===
    "ongoing";

  const isCompleted =
    classItem.status ===
    "completed";

  return (
    <div
      className={`
        group
        rounded-2xl
        border
        bg-white
        p-4
        shadow-[0_5px_18px_rgba(15,23,42,0.04)]
        transition-all
        duration-300
        hover:-translate-y-0.5
        hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]

        ${
          isLive
            ? "border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-teal-50/40"
            : "border-slate-200"
        }
      `}
    >
      <div
        className="
          flex
          flex-col
          gap-4
          lg:flex-row
          lg:items-center
        "
      >
        {/* ICON */}

        <div
          className={`
            flex
            h-14
            w-14
            shrink-0
            items-center
            justify-center
            rounded-2xl

            ${
              isLive
                ? "bg-emerald-100 text-emerald-600"
                : isCompleted
                ? "bg-violet-100 text-violet-600"
                : "bg-blue-100 text-blue-600"
            }
          `}
        >
          {classItem.iconType ===
          "book" ? (
            <BookOpen className="h-6 w-6" />
          ) : (
            <Video className="h-6 w-6" />
          )}
        </div>


        {/* INFORMATION */}

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
              items-center
              gap-2
            "
          >
            {isLive ? (
              <span
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-full
                  bg-red-500
                  px-3
                  py-1
                  text-[9px]
                  font-bold
                  uppercase
                  text-white
                "
              >
                <span
                  className="
                    h-1.5
                    w-1.5
                    animate-pulse
                    rounded-full
                    bg-white
                  "
                />

                Live Now
              </span>
            ) : (
              <span
                className={`
                  rounded-full
                  px-3
                  py-1
                  text-[9px]
                  font-bold

                  ${
                    isCompleted
                      ? "bg-violet-50 text-violet-600"
                      : "bg-blue-50 text-blue-600"
                  }
                `}
              >
                {classItem.dateLabel}
              </span>
            )}

            <h3
              className="
                text-sm
                font-bold
                text-slate-900
                sm:text-base
              "
            >
              {classItem.title}
            </h3>
          </div>


          <div
            className="
              mt-1.5
              flex
              flex-wrap
              items-center
              gap-2
              text-[11px]
              text-slate-500
            "
          >
            <span>
              {classItem.className}
            </span>

           

            <span className="text-slate-300">
              •
            </span>

            <span>
              {classItem.subject}
            </span>
          </div>


          <div
            className="
              mt-3
              flex
              flex-wrap
              items-center
              gap-4
              text-[11px]
              text-slate-500
            "
          >
            <span
              className="
                inline-flex
                items-center
                gap-1.5
              "
            >
              <Users className="h-4 w-4 text-slate-400" />

              {classItem.studentsCount} students
            </span>

            <span
              className="
                inline-flex
                items-center
                gap-1.5
              "
            >
              <Clock3 className="h-4 w-4 text-slate-400" />

              {classItem.statusText}
            </span>
          </div>
        </div>


        


        {/* ACTION */}

        <div
          className="
            flex
            shrink-0
            items-center
            gap-2
          "
        >
          {!isCompleted && (
            <button
              type="button"
              className={`
                inline-flex
                h-10
                items-center
                justify-center
                gap-2
                rounded-lg
                px-4
                text-xs
                font-semibold
                transition-all

                ${
                  isLive
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md hover:shadow-lg"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50"
                }
              `}
            >
              <Video className="h-4 w-4" />

              {isLive
                ? "Join Class"
                : "Start Class"}
            </button>
          )}

          {isCompleted && (
            <button
              type="button"
              className="
                inline-flex
                h-10
                items-center
                justify-center
                gap-2
                rounded-lg
                border
                border-slate-200
                bg-white
                px-4
                text-xs
                font-semibold
                text-slate-600
                hover:bg-slate-50
              "
            >
              <Play className="h-4 w-4" />

              Recording
            </button>
          )}

          <button
            type="button"
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-lg
              text-slate-400
              transition
              hover:bg-slate-100
              hover:text-slate-700
            "
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}


function TodayClassRow({
  classItem,
}) {
  return (
    <div
      className="
        flex
        items-center
        gap-3
        border-b
        border-slate-100
        py-3
        last:border-b-0
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
          bg-teal-50
          text-teal-600
        "
      >
        <BookOpen className="h-5 w-5" />
      </div>


      <div className="min-w-0 flex-1">
        <div
          className="
            flex
            items-center
            gap-2
          "
        >
          {classItem.status ===
            "ongoing" && (
            <span
              className="
                rounded
                bg-red-500
                px-1.5
                py-0.5
                text-[8px]
                font-bold
                text-white
              "
            >
              LIVE
            </span>
          )}

          <p
            className="
              truncate
              text-xs
              font-bold
              text-slate-800
            "
          >
            {classItem.title}
          </p>
        </div>

        <p
          className="
            mt-1
            text-[9px]
            text-slate-400
          "
        >
          {classItem.className} •{" "}
          {classItem.studentsCount} students
        </p>
      </div>


      <div
        className="
          whitespace-nowrap
          text-right
          text-[9px]
          font-medium
          text-slate-500
        "
      >
        {classItem.time}
        <br />
        {classItem.endTime}
      </div>
    </div>
  );
}


/* =========================================================
   QUICK ACTION
========================================================= */

function QuickAction({
  icon: Icon,
  title,
  type,
}) {
  const SafeIcon =
    Icon || Video;

  const styles = {
    green:
      "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",

    blue:
      "bg-blue-50 text-blue-600 hover:bg-blue-100",

    pink:
      "bg-pink-50 text-pink-600 hover:bg-pink-100",
  };

  return (
    <button
      type="button"
      className={`
        flex
        min-h-[90px]
        flex-col
        items-center
        justify-center
        gap-2
        rounded-xl
        p-3
        text-center
        transition-all
        duration-300
        hover:-translate-y-0.5

        ${
          styles[type] ||
          styles.green
        }
      `}
    >
      <SafeIcon className="h-5 w-5" />

      <span
        className="
          text-[10px]
          font-semibold
        "
      >
        {title}
      </span>
    </button>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  type,
}) {
  const SafeIcon =
    Icon || FileText;

  const styles = {
    green: {
      card:
        "border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50",
      icon:
        "bg-emerald-100 text-emerald-600",
    },

    blue: {
      card:
        "border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50",
      icon:
        "bg-blue-100 text-blue-600",
    },

    pink: {
      card:
        "border-pink-100 bg-gradient-to-br from-pink-50 to-rose-50",
      icon:
        "bg-pink-100 text-pink-600",
    },

    orange: {
      card:
        "border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50",
      icon:
        "bg-orange-100 text-orange-500",
    },
  };

  const current =
    styles[type] ||
    styles.green;

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
      <div className="flex items-center gap-4">
        <div
          className={`
            flex
            h-14
            w-14
            shrink-0
            items-center
            justify-center
            rounded-2xl

            ${current.icon}
          `}
        >
          <SafeIcon className="h-7 w-7" />
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-1 text-3xl font-bold leading-none text-slate-900">
            {value}
          </p>

          <p className="mt-2 text-[10px] text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   MATERIAL PREVIEW
========================================================= */

function MaterialPreview({
  material,
}) {
  const type =
    getMaterialType(
      material.type,
    );

  const Icon =
    type.icon;

  return (
    <div
      className={`
        relative
        flex
        h-[86px]
        w-[112px]
        shrink-0
        items-center
        justify-center
        overflow-hidden
        rounded-xl

        ${type.container}
      `}
    >
      <div
        className={`
          flex
          h-11
          w-11
          items-center
          justify-center
          rounded-xl
          shadow-sm

          ${type.iconStyle}
        `}
      >
        <Icon className="h-6 w-6" />
      </div>

      {material.type ===
        "video" && (
        <div
          className="
            absolute
            bottom-2
            right-2
            rounded-md
            bg-slate-900/80
            px-1.5
            py-0.5
            text-[8px]
            font-semibold
            text-white
          "
        >
          {material.duration}
        </div>
      )}

      {material.type ===
        "record" && (
        <div
          className="
            absolute
            bottom-2
            right-2
            flex
            h-6
            w-6
            items-center
            justify-center
            rounded-full
            bg-white
            text-emerald-600
            shadow
          "
        >
          <Play className="h-3 w-3 fill-current" />
        </div>
      )}
    </div>
  );
}


/* =========================================================
   MATERIAL ROW
========================================================= */

function MaterialRow({
  material,
  onView,
  onDelete,
  deleting = false,
}) {
  const type =
    getMaterialType(
      material.materialType,
    );

  return (
    <div
      className="
        group
        border-b
        border-slate-100
        px-4
        py-4
        transition
        last:border-b-0
        hover:bg-teal-50/20
      "
    >
      <div
        className="
          flex
          flex-col
          gap-4
          lg:flex-row
          lg:items-center
        "
      >
        <MaterialPreview
          material={
            material
          }
        />


        {/* DETAILS */}

        <div
          className="
            min-w-0
            flex-1
          "
        >
          <h3
            className="
              text-sm
              font-bold
              text-slate-900
            "
          >
            {material.title}
          </h3>

          <div
            className="
              mt-1
              flex
              flex-wrap
              items-center
              gap-2
              text-[10px]
              text-slate-500
            "
          >
            <span>
              {material.className}
            </span>

            <span className="text-slate-300">
              •
            </span>

            <span>
              {material.subjectName}
            </span>

            <span className="text-slate-300">
              •
            </span>

            <span>
              {material.createdAt}
            </span>
          </div>

          

          <div
            className="
              mt-2
              flex
              items-center
              gap-2
            "
          >
            <span
              className={`
                rounded-md
                border
                px-2
                py-0.5
                text-[9px]
                font-semibold

                ${type.badge}
              `}
            >
              {type.label}
            </span>

           
          </div>
        </div>


        {/* STATS */}

        <div
          className="
            flex
            min-w-[190px]
            flex-col
            gap-2
            text-[10px]
            text-slate-500
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <Download className="h-4 w-4 text-slate-400" />

            <span>
              {material.downloads}{" "}
              {material.type ===
              "video"
                ? "views"
                : "downloads"}
            </span>
          </div>

          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <Users className="h-4 w-4 text-slate-400" />

            <span>
              Shared with{" "}
              {material.className}{" "}
              {material.sharedClasses ===
              1
                ? "class"
                : "classes"}
            </span>
          </div>
        </div>


        {/* ACTIONS */}
<div className="ml-auto flex shrink-0 items-center gap-2">

  {/* VIEW */}
  <button
    type="button"
    onClick={() =>
      onView?.(material)
    }
    title="View Material"
    className="
      inline-flex
      h-9
      w-9
      items-center
      justify-center
      rounded-lg
      border
      border-teal-200
      bg-teal-50
      text-teal-600
      transition
      hover:border-teal-300
      hover:bg-teal-100
      hover:text-teal-700
    "
  >
    <Eye className="h-4 w-4" />
  </button>

  {/* DELETE */}
  <button
    type="button"
    disabled={deleting}
    onClick={() =>
      onDelete?.(material)
    }
    title="Delete Material"
    className="
      inline-flex
      h-9
      w-9
      items-center
      justify-center
      rounded-lg
      border
      border-red-200
      bg-red-50
      text-red-500
      transition
      hover:border-red-300
      hover:bg-red-100
      hover:text-red-600
      disabled:cursor-not-allowed
      disabled:opacity-50
    "
  >
    {deleting ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : (
      <Trash2 className="h-4 w-4" />
    )}
  </button>

</div>
      </div>
    </div>
  );
}


/* =========================================================
   FOLDER ROW
========================================================= */

function FolderRow({
  folder,
}) {
  const colors = {
    green:
      "bg-emerald-50 text-emerald-500",

    blue:
      "bg-blue-50 text-blue-500",

    orange:
      "bg-orange-50 text-orange-500",

    violet:
      "bg-violet-50 text-violet-500",

    pink:
      "bg-pink-50 text-pink-500",

    slate:
      "bg-slate-100 text-slate-500",
  };

  return (
    <div
      className="
        flex
        items-center
        gap-3
        border-b
        border-slate-100
        py-2.5
        last:border-b-0
      "
    >
      <div
        className={`
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          rounded-lg

          ${
            colors[
              folder.type
            ] ||
            colors.green
          }
        `}
      >
        <Folder className="h-4 w-4" />
      </div>

      <p
        className="
          min-w-0
          flex-1
          truncate
          text-xs
          font-semibold
          text-slate-700
        "
      >
        {folder.name}
      </p>

      <span
        className="
          rounded-full
          bg-slate-100
          px-2
          py-1
          text-[9px]
          font-semibold
          text-slate-500
        "
      >
        {folder.count}
      </span>

      <button
        type="button"
        className="
          flex
          h-7
          w-7
          items-center
          justify-center
          rounded-md
          text-slate-400
          hover:bg-slate-100
        "
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
function getMaterialType(type) {
  const types = {
    pdf: {
      label: "PDF",
      icon: FileText,
      container:
        "bg-gradient-to-br from-red-50 to-rose-50",
      iconStyle:
        "bg-red-500 text-white",
      badge:
        "border-red-100 bg-red-50 text-red-600",
    },

    youtube: {
      label: "Video",
      icon: Video,
      container:
        "bg-gradient-to-br from-blue-50 to-sky-50",
      iconStyle:
        "bg-blue-500 text-white",
      badge:
        "border-violet-100 bg-violet-50 text-violet-600",
    },

    image: {
      label: "Image",
      icon: FileImage,
      container:
        "bg-gradient-to-br from-emerald-50 to-teal-50",
      iconStyle:
        "bg-emerald-500 text-white",
      badge:
        "border-emerald-100 bg-emerald-50 text-emerald-600",
    },
  };

  return (
    types[type] ||
    types.pdf
  );
}

/* =========================================================
   RECENT UPLOAD ROW
========================================================= */

function RecentUpload({
  material,
}) {
  const type =
    getMaterialType(
      material.type,
    );

  const Icon =
    type.icon;

  return (
    <div
      className="
        flex
        items-center
        gap-3
        border-b
        border-slate-100
        py-2.5
        last:border-b-0
      "
    >
      <div
        className={`
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          rounded-lg

          ${type.container}
        `}
      >
        <Icon
          className={`
            h-4
            w-4

            ${
              material.type ===
              "pdf"
                ? "text-red-500"
                : material.type ===
                  "video"
                ? "text-blue-500"
                : "text-emerald-500"
            }
          `}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="
            truncate
            text-[11px]
            font-semibold
            text-slate-700
          "
        >
          {material.title}
        </p>

        <div
          className="
            mt-1
            flex
            flex-wrap
            items-center
            gap-1.5
            text-[9px]
            text-slate-400
          "
        >
          <span
            className="
              font-medium
              text-teal-600
            "
          >
            {type.label}
          </span>

          <span>
            {material.date}
          </span>

          <span>
            •
          </span>

          <span>
            {material.size}
          </span>
        </div>
      </div>
    </div>
  );
}



export {FilterSelect, StatCard, ActionButton,
     QuickAction, TodayClassRow, LiveClassCard,
     MaterialRow, FolderRow, RecentUpload, SummaryCard

}