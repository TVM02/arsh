"use client";


import {

  Pencil,
 
} from "lucide-react";


function clean(value) {
  const text =
    String(
      value ?? "",
    ).trim();

  return text || "N/A";
}


function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  try {
    let date;

    if (
      typeof value?.toDate ===
      "function"
    ) {
      date =
        value.toDate();
    }

    else if (
      value?.seconds
    ) {
      date =
        new Date(
          value.seconds *
            1000,
        );
    }

    else {
      date =
        new Date(value);
    }

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return clean(value);
    }

    return date.toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    );
  } catch {
    return clean(value);
  }
}


function InfoRow({
  label,
  value,
}) {
  return (
    <div
      className="
        grid
        grid-cols-[120px_12px_1fr]
        gap-2
        text-[13px]
        leading-5
      "
    >
      <span
        className="
          text-slate-500
        "
      >
        {label}
      </span>

      <span
        className="
          text-slate-400
        "
      >
        :
      </span>

      <span
        className="
          break-words
          font-medium
          text-slate-700
        "
      >
        {value || "N/A"}
      </span>
    </div>
  );
}


function SectionCard({
  icon: Icon,
  title,
  action,
  children,
  className = "",
}) {
  return (
    <section
      className={`
        relative
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-5
        shadow-[0_4px_18px_rgba(15,23,42,0.04)]
        ${className}
      `}
    >
      {/* faint Islamic pattern */}
      <div
        className="
          pointer-events-none
          absolute
          -right-8
          top-16
          h-36
          w-36
          rotate-12
          rounded-[36px]
          border-[12px]
          border-amber-100/25
        "
      />

      <div
        className="
          relative
          z-10
        "
      >
        <div
          className="
            mb-4
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
              gap-3
            "
          >
            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-lg
                bg-[#087665]
                text-white
                shadow-sm
              "
            >
              <Icon
                className="
                  h-5
                  w-5
                "
              />
            </div>

            <h2
              className="
                font-serif
                text-[16px]
                font-bold
                text-[#102943]
              "
            >
              {title}
            </h2>
          </div>

          {action && (
            <button
              type="button"
              className="
                flex
                items-center
                gap-2
                rounded-lg
                border
                border-slate-200
                bg-slate-50
                px-3
                py-2
                text-[11px]
                font-semibold
                text-slate-600
                transition
                hover:bg-slate-100
              "
            >
              <Pencil
                className="
                  h-3.5
                  w-3.5
                "
              />

              {action}
            </button>
          )}
        </div>

        {children}
      </div>
    </section>
  );
}


function Pill({
  children,
  tone = "green",
}) {
  const styles = {
    green:
      "bg-emerald-100 text-emerald-700",

    blue:
      "bg-blue-100 text-blue-700",

    amber:
      "bg-amber-100 text-amber-700",

    violet:
      "bg-violet-100 text-violet-700",
  };

  return (
    <span
      className={`
        inline-flex
        items-center
        rounded-full
        px-3
        py-1
        text-[11px]
        font-semibold
        ${
          styles[tone] ||
          styles.green
        }
      `}
    >
      {children}
    </span>
  );
}


function StatCard({
  icon: Icon,
  value,
  label,
  className,
}) {
  return (
    <div
      className={`
        flex
        min-h-[86px]
        items-center
        gap-3
        rounded-xl
        p-4
        ${className}
      `}
    >
      <Icon
        className="
          h-7
          w-7
          shrink-0
        "
      />

      <div>
        <p
          className="
            text-xl
            font-extrabold
            text-[#102943]
          "
        >
          {value}
        </p>

        <p
          className="
            mt-0.5
            text-[10px]
            text-slate-500
          "
        >
          {label}
        </p>
      </div>
    </div>
  );
}
function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      // Normal string / number
      if (
        typeof item === "string" ||
        typeof item === "number"
      ) {
        return String(item).trim();
      }

      // Object values
      if (
        item &&
        typeof item === "object"
      ) {
        return String(
          item.name ||
          item.label ||
          item.title ||
          item.value ||
          "",
        ).trim();
      }

      return "";
    })
    .filter(Boolean);
}

function safeText(
  value,
  fallback = "N/A",
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const text =
      String(value).trim();

    return text || fallback;
  }

  return fallback;
}


export {StatCard, Pill, SectionCard, InfoRow, formatDate, clean, normalizeArray, safeText}