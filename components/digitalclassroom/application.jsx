import {
   X,
} from "lucide-react";


function StatCard({
  icon: Icon,
  title,
  value,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-center gap-4">

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50">
          <Icon className="h-5 w-5 text-teal-700" />
        </div>

        <div>
          <p className="text-xs font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {value}
          </p>
        </div>

      </div>

    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending:
      "border-amber-200 bg-amber-50 text-amber-700",

    approved:
      "border-emerald-200 bg-emerald-50 text-emerald-700",

    rejected:
      "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize ${
        styles[status] ||
        "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {status || "pending"}
    </span>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4">

      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-white shadow-2xl ${
          wide
            ? "max-w-4xl"
            : "max-w-3xl"
        }`}
      >

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">

          <h2 className="text-xl font-bold text-slate-900">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>

        </div>

        <div className="p-6">
          {children}
        </div>

      </div>

    </div>
  );
}

function InfoSection({
  title,
  children,
}) {
  return (
    <div>
      <h3 className="mb-4 font-bold text-slate-900">
        {title}
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

      <div className="flex gap-3">

        <Icon className="mt-0.5 h-4 w-4 text-teal-700" />

        <div>
          <p className="text-xs text-slate-500">
            {label}
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-800">
            {value || "Not provided"}
          </p>
        </div>

      </div>

    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="flex gap-3">

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50">
        <Icon className="h-5 w-5 text-teal-700" />
      </div>

      <div>
        <h3 className="font-bold text-slate-900">
          {title}
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>

    </div>
  );
}

function AssignmentSection({
  icon,
  title,
  options,
  selected,
  onToggle,
}) {
  return (
    <div>

      <SectionHeading
        icon={icon}
        title={title}
        description={`Select ${title.toLowerCase()} for this Digital Teacher.`}
      />

      <div className="mt-4 flex flex-wrap gap-3">

        {options.map((item) => {
          const active =
            selected.includes(item);

          return (
            <button
              type="button"
              key={item}
              onClick={() =>
                onToggle(item)
              }
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "border-teal-600 bg-teal-50 text-teal-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-teal-300"
              }`}
            >
              {active && "✓ "}
              {item}
            </button>
          );
        })}

      </div>

    </div>
  );
}
export {
  StatCard,
  StatusBadge,
  Modal,
  InfoSection,
  InfoField,
  SectionHeading,
  AssignmentSection
};