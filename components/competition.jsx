import {
  CATEGORIES,
} from "@/lib/competitionUtils";
import { useState } from "react";

import {
 Trophy,
} from "lucide-react";

function StatCard({
  title,
  value,
  icon: Icon,
  type,
}) {
  const styles = {
    blue:
      "from-blue-500 to-indigo-600",

    green:
      "from-emerald-500 to-teal-600",

    orange:
      "from-amber-500 to-orange-600",

    pink:
      "from-pink-500 to-rose-600",
  };

  return (
    <div
      className={`
        relative
        overflow-hidden
        rounded-2xl
        bg-gradient-to-br
        p-5
        text-white
        shadow-lg

        ${styles[type]}
      `}
    >
      <div
        className="
          absolute
          -right-8
          -top-8
          h-28
          w-28
          rounded-full
          bg-white/10
        "
      />

      <div
        className="
          relative
          flex
          items-center
          justify-between
          gap-3
        "
      >
        <div>
          <p
            className="
              text-xs
              font-bold
              uppercase
              tracking-wide
              text-white/80
            "
          >
            {title}
          </p>

          <p
            className="
              mt-2
              text-3xl
              font-bold
            "
          >
            {value}
          </p>
        </div>

        <div
          className="
            flex
            h-14
            w-14
            items-center
            justify-center
            rounded-xl
            bg-white/15
          "
        >
          <Icon className="h-7 w-7" />
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   EMPTY
========================================================= */

function EmptyResults() {
  return (
    <div
      className="
        flex
        flex-col
        items-center
        justify-center
        px-6
        py-14
        text-center
      "
    >
      <div
        className="
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-full
          bg-teal-50
          text-teal-600
        "
      >
        <Trophy className="h-6 w-6" />
      </div>

      <p
        className="
          mt-3
          font-semibold
          text-slate-700
        "
      >
        No published results found
      </p>

      <p
        className="
          mt-1
          text-xs
          text-slate-400
        "
      >
        Try another Mekhala or
        clear the search filter.
      </p>
    </div>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function normalizeGrade(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}


function getCategoryLabel(category) {
  return (
    CATEGORIES?.[category]?.label ||
    category ||
    "—"
  );
}


function getStudents(result) {
  if (
    Array.isArray(result?.students) &&
    result.students.length > 0
  ) {
    return result.students;
  }

  if (result?.studentName) {
    return [
      {
        name: result.studentName,

        profilePicture:
          result.profilePicture ||
          result.profilePictureUrl ||
          result.photoURL ||
          "",
      },
    ];
  }

  return [];
}


function getStudentName(student) {
  return (
    student?.name ||
    student?.studentName ||
    student?.fullName ||
    "Student"
  );
}



function getStudentImage(student) {
  return (
    student?.profilePictureUrl ||
    student?.profilePicture ||
    student?.photoURL ||
    student?.image ||
    student?.avatar ||
    ""
  );
}


function getResultStudentNames(result) {
  const students =
    getStudents(result);

  if (students.length > 0) {
    return students
      .map(getStudentName)
      .filter(Boolean)
      .join(", ");
  }

  return (
    result?.studentName ||
    "Student"
  );
}


function getScore(result) {
  return (
    Number(
      result?.total ??
        result?.finalScore ??
        result?.score ??
        0,
    ) || 0
  );
}


function formatTime(timestamp) {
  if (!timestamp) {
    return "—";
  }

  try {
    let date;

    if (
      typeof timestamp?.toDate ===
      "function"
    ) {
      date =
        timestamp.toDate();
    } else {
      date =
        new Date(timestamp);
    }

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return "—";
    }

    return date.toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    );
  } catch {
    return "—";
  }
}


function getPublishedTime(result) {
  return (
    result?.publishedAt ||
    result?.updatedAt ||
    result?.verifiedAt ||
    null
  );
}


function publishedMillis(result) {
  const timestamp =
    getPublishedTime(result);

  if (!timestamp) {
    return 0;
  }

  if (
    typeof timestamp?.toMillis ===
    "function"
  ) {
    return timestamp.toMillis();
  }

  if (
    typeof timestamp?.toDate ===
    "function"
  ) {
    return timestamp
      .toDate()
      .getTime();
  }

  const parsed =
    new Date(timestamp).getTime();

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}


/* =========================================================
   PROFILE AVATARS
========================================================= */

function StudentAvatar({
  student,
  size = "md",
}) {
  const name =
    getStudentName(student);

  const image =
    getStudentImage(student);

  const [imageError, setImageError] =
    useState(false);

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0),
    )
    .join("")
    .toUpperCase();

  const sizes = {
    sm: "h-8 w-8 text-[10px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
  };

  const showImage =
    image &&
    !imageError;

  return (
    <div
      className={`
        relative
        shrink-0
        overflow-hidden
        rounded-full
        border-2
        border-white
        bg-gradient-to-br
        from-teal-100
        via-emerald-50
        to-amber-50
        shadow-sm

        ${sizes[size]}
      `}
      title={name}
    >
      {showImage ? (
        <img
          src={image}
          alt={name}
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
        <div
          className="
            flex
            h-full
            w-full
            items-center
            justify-center
            font-bold
            uppercase
            text-teal-700
          "
        >
          {initials || (
            <UserRound className="h-4 w-4" />
          )}
        </div>
      )}
    </div>
  );
}

function GroupAvatars({
  result,
}) {
  const students =
    getStudents(result);

  const visible =
    students.slice(0, 3);

  if (
    visible.length === 0
  ) {
    return (
      <StudentAvatar
        student={{
          name:
            result?.studentName ||
            "Student",

          profilePicture:
            result?.profilePicture ||
            result?.profilePictureUrl ||
            "",
        }}
        size="md"
      />
    );
  }

  return (
    <div className="flex shrink-0 -space-x-2">
      {visible.map(
        (student, index) => (
          <StudentAvatar
            key={
              student?.id ||
              student?.studentId ||
              index
            }
            student={student}
            size="md"
          />
        ),
      )}

      {students.length > 3 && (
        <div
          className="
            relative
            z-10
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            border-2
            border-white
            bg-slate-100
            text-[10px]
            font-bold
            text-slate-600
          "
        >
          +{students.length - 3}
        </div>
      )}
    </div>
  );
}


/* =========================================================
   GRADE BADGE
========================================================= */

function GradeBadge({
  grade,
}) {
  const value =
    normalizeGrade(grade);

  let classes =
    "border-slate-200 bg-slate-50 text-slate-600";

  if (value === "A") {
    classes =
      "border-emerald-200 bg-emerald-50 text-emerald-700";
  }  else if (
    value === "B"
  ) {
    classes =
      "border-violet-200 bg-violet-50 text-violet-700";
  } else if (
    value === "C"
  ) {
    classes =
      "border-amber-200 bg-amber-50 text-amber-700";
  }

  return (
    <span
      className={`
        inline-flex
        min-w-[38px]
        items-center
        justify-center
        rounded-md
        border
        px-2
        py-1
        text-[10px]
        font-bold

        ${classes}
      `}
    >
      {value || "—"}
    </span>
  );
}

function TickerResults({
  results,
  prefix,
}) {
  return (
    <div
      className="
        flex
        min-w-max
        items-center
        gap-8
        py-2
        pr-8
        text-xs
      "
    >
      {results
        .slice(0, 10)
        .map((result) => (
          <div
            key={`${prefix}-${result.id}`}
            className="
              flex
              items-center
              gap-2
              whitespace-nowrap
            "
          >
            <span
              className="
                h-1.5
                w-1.5
                shrink-0
                rounded-full
                bg-teal-500
              "
            />

            <span
              className="
                font-bold
                text-teal-600
              "
            >
              {getResultStudentNames(
                result,
              )}
            </span>

            <span className="text-slate-300">
              •
            </span>

            <span className="text-slate-500">
              {result.eventName ||
                "Competition"}
            </span>

            <span
              className="
                font-bold
                text-emerald-600
              "
            >
              {getScore(result)} pts
            </span>

            <span className="text-slate-300">
              •
            </span>

            <span
              className="
                font-medium
                text-slate-500
              "
            >
              {result.mekhalaName ||
                "--"}
            </span>
          </div>
        ))}
    </div>
  );
}

export {EmptyResults, StatCard, GradeBadge, GroupAvatars,
    StudentAvatar, publishedMillis , getPublishedTime, normalizeText,
    getCategoryLabel, getResultStudentNames, getScore,
    formatTime, normalizeGrade, getStudents, getStudentName, TickerResults}