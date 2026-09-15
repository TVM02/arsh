import {
  CheckCircle2,

} from "lucide-react";

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}) {
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

      <div className="mb-6 flex items-start gap-3">

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {title}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {description}
          </p>
        </div>

      </div>

      {children}

    </section>
  );
}

/* =====================================
   READ ONLY FIELD
===================================== */

function ReadOnlyField({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div>

      <label className="mb-2 block text-sm font-medium text-slate-600">
        {label}
      </label>

      <div className="relative">

        <Icon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          value={
            value ||
            "Not available"
          }
          readOnly
          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none"
        />

      </div>

    </div>
  );
}

/* =====================================
   FORM FIELD
===================================== */

function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  uppercase = false,
}) {
  return (
    <div>

      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        required={required}
        placeholder={
          placeholder
        }
        onChange={(e) => {
          if (uppercase) {
            e.target.value =
              e.target.value.toUpperCase();
          }

          onChange(e);
        }}
        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
      />

    </div>
  );
}

/* =====================================
   PROCESS CARD
===================================== */

function ProcessCard({
  number,
  title,
  description,
  active = false,
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        active
          ? "border-teal-200 bg-teal-50"
          : "border-slate-200 bg-white"
      }`}
    >

      <div className="flex items-center gap-3">

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            active
              ? "bg-teal-700 text-white"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {number}
        </div>

        <div>
          <p className="text-sm font-bold text-slate-800">
            {title}
          </p>

          <p className="mt-0.5 text-xs text-slate-500">
            {description}
          </p>
        </div>

      </div>

    </div>
  );
}
function ComputerKnowledgeCard({
  title,
  description,
  selected,
  onSelect,
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl border p-5 text-left transition ${
        selected
          ? "border-teal-500 bg-teal-50 ring-4 ring-teal-500/10"
          : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center justify-between gap-3">

        <h4
          className={`font-bold ${
            selected
              ? "text-teal-800"
              : "text-slate-800"
          }`}
        >
          {title}
        </h4>

        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full border ${
            selected
              ? "border-teal-600 bg-teal-600"
              : "border-slate-300"
          }`}
        >
          {selected && (
            <CheckCircle2 className="h-4 w-4 text-white" />
          )}
        </span>

      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        {description}
      </p>

    </button>
  );
}
export { SectionCard, ReadOnlyField, FormField, ProcessCard, ComputerKnowledgeCard };