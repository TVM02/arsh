import {

  FileCheck,
  CalendarDays,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Trophy,

  ChevronRight,
 
  ClipboardList,

  Timer,
  Eye,
  Download,
} from "lucide-react";


function ExamCard({ exam }) {
  const upcoming =
    exam.status === "upcoming";

  return (
    <article className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">

      {/* top strip */}

      <div
        className={`h-1.5 ${
          upcoming
            ? "bg-gradient-to-r from-teal-500 to-emerald-400"
            : "bg-gradient-to-r from-blue-500 to-violet-500"
        }`}
      />

      <div className="p-5 sm:p-6">

        {/* heading */}

        <div className="flex items-start justify-between gap-4">

          <div className="flex items-start gap-4">

            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                upcoming
                  ? "bg-teal-50 text-teal-700"
                  : "bg-blue-50 text-blue-700"
              }`}
            >
              <FileCheck className="h-6 w-6" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
                {exam.subject}
              </span>

              <h3 className="mt-1 text-lg font-bold text-slate-900">
                {exam.title}
              </h3>
            </div>

          </div>

          <StatusBadge
            status={exam.status}
          />

        </div>

        {/* Details */}

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-4">

          <ExamInfo
            icon={CalendarDays}
            label="Date"
            value={exam.date}
          />

          <ExamInfo
            icon={Clock3}
            label="Time"
            value={exam.time}
          />

          <ExamInfo
            icon={Timer}
            label="Duration"
            value={exam.duration}
          />

          <ExamInfo
            icon={Trophy}
            label="Marks"
            value={exam.totalMarks}
          />

        </div>

        {/* Registered */}

        {upcoming && (
          <div className="mt-5">

            {exam.registered ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">

                <CheckCircle2 className="h-4 w-4" />

                Registered for this exam

              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">

                <AlertCircle className="h-4 w-4" />

                Registration required

              </div>
            )}

          </div>
        )}

        {/* Result */}

        {!upcoming &&
          exam.marks !== undefined && (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-xs font-medium text-emerald-700">
                    Your Score
                  </p>

                  <p className="mt-1 text-2xl font-bold text-emerald-800">
                    {exam.marks}
                    <span className="text-sm font-medium">
                      /{exam.totalMarks}
                    </span>
                  </p>
                </div>

                <Trophy className="h-8 w-8 text-amber-500" />

              </div>

            </div>
          )}

        {/* Actions */}

        <div className="mt-5 flex flex-wrap gap-3">

          {upcoming ? (
            <>
              {exam.registered ? (
                <button className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800">

                  <FileCheck className="h-4 w-4" />

                  View Exam

                  <ChevronRight className="h-4 w-4" />

                </button>
              ) : (
                <button className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-semibold text-white transition hover:bg-amber-600">

                  <ClipboardList className="h-4 w-4" />

                  Register Exam

                </button>
              )}

              <button className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">

                <Eye className="h-4 w-4" />

                Details

              </button>
            </>
          ) : (
            <>
              <button className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800">

                <Eye className="h-4 w-4" />

                View Result

              </button>

              <button className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">

                <Download className="h-4 w-4" />

                Certificate

              </button>
            </>
          )}

        </div>

      </div>
    </article>
  );
}

/* =====================================
   EXAM INFO
===================================== */

function ExamInfo({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div>

      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>

      <p className="mt-1 text-xs font-semibold text-slate-700 sm:text-sm">
        {value}
      </p>

    </div>
  );
}

/* =====================================
   STATUS
===================================== */

function StatusBadge({ status }) {
  if (status === "completed") {
    return (
      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
        Completed
      </span>
    );
  }

  return (
    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
      Upcoming
    </span>
  );
}

/* =====================================
   STAT CARD
===================================== */

function StatCard({
  icon: Icon,
  value,
  label,
  iconClass,
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">

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

          <p className="text-sm text-slate-500">
            {label}
          </p>
        </div>

      </div>

    </div>
  );
}

/* =====================================
   EMPTY STATE
===================================== */

function EmptyExam() {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[26px] border border-dashed border-slate-300 bg-white p-8 text-center">

      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-50">
        <FileCheck className="h-9 w-9 text-teal-700" />
      </div>

      <h3 className="mt-5 text-lg font-bold text-slate-900">
        No exams found
      </h3>

      <p className="mt-2 text-sm text-slate-500">
        No exams match the selected
        search or filters.
      </p>

    </div>
  );
}

export {
  ExamCard,
  StatCard,
  EmptyExam,
};