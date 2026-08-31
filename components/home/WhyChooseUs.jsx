"use client";

import { BookOpen, Users, Award } from "lucide-react";

/* ─── Hijri Calendar UI ────────────────────────────────────────────────────── */
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// Static calendar data matching the design — Shaban 1445 AH (Feb/Mar 2024)
const CALENDAR_DATA = {
  hijriYear: "1445 AH",
  hijriMonth: "Shaban 1445 AH",
  gregorianRange: "FEB/MAR 2024",
  today: 15,
  leadingBlanks: 3, // Shaban 1 falls on Thursday
  totalDays: 29,
  upcomingEvents: [
    { name: "Ramadan Begins", date: "10 Mar 2024" },
    { name: "Eid al-Fitr", date: "9 Apr 2024" },
  ],
};

function HijriCalendar() {
  const cells = [];
  for (let i = 0; i < CALENDAR_DATA.leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= CALENDAR_DATA.totalDays; d++) cells.push(d);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden w-full max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-teal-700 flex items-center justify-center text-white text-xs font-bold">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-800">
            Arabic (Hijri) Calendar
          </span>
        </div>
        <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-1 rounded-full">
          {CALENDAR_DATA.hijriYear}
        </span>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
        <button className="text-gray-400 hover:text-teal-700 p-1 rounded transition-colors">
          &#8249;
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-800">
            {CALENDAR_DATA.hijriMonth}
          </p>
          <p className="text-xs text-gray-400">
            {CALENDAR_DATA.gregorianRange}
          </p>
        </div>
        <button className="text-gray-400 hover:text-teal-700 p-1 rounded transition-colors">
          &#8250;
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-semibold text-gray-400 py-2"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 px-2 py-2 gap-y-1">
        {cells.map((day, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-center h-8 w-8 mx-auto rounded-full text-xs font-medium transition-colors
              ${day === null ? "" : ""}
              ${
                day === CALENDAR_DATA.today
                  ? "bg-teal-700 text-white font-bold shadow"
                  : day
                    ? "text-gray-700 hover:bg-teal-50 cursor-pointer"
                    : ""
              }`}
          >
            {day || ""}
          </div>
        ))}
      </div>

      {/* Upcoming events */}
      <div className="px-4 pb-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
          Upcoming Islamic Events
        </p>
        <div className="space-y-2">
          {CALENDAR_DATA.upcomingEvents.map((ev) => (
            <div key={ev.name} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">&#9790;</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{ev.name}</p>
                <p className="text-xs text-gray-400">{ev.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Feature Cards ──────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: BookOpen,
    title: "Immersive Learning",
    desc: "Interactive modules, multimedia content & practical exercises.",
    active: false,
  },
  {
    icon: Users,
    title: "Collaborative Growth",
    desc: "Connect with peers, teachers & mentors worldwide.",
    active: false,
  },
  {
    icon: Award,
    title: "Achievement Tracking",
    desc: "Monitor progress with certificates & milestone reports.",
    active: true,
  },
];

/* ─── Main Section ───────────────────────────────────────────────────────── */
export default function WhyChooseUs() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4">
        {/* Section tag */}
        <p className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2">
          Why Choose Us
        </p>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
          {/* LEFT */}
          <div className="flex-1 max-w-lg">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">
              Revolutionary <span className="text-teal-600">Learning</span>
              <br />
              Platform
            </h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Discover innovative teaching methodologies that seamlessly blend
              traditional Islamic wisdom with modern educational technology.
            </p>

            <div className="space-y-4">
              {FEATURES.map(({ icon: Icon, title, desc, active }) => (
                <div
                  key={title}
                  className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                    active
                      ? "border-teal-200 bg-teal-50 shadow-sm"
                      : "border-gray-100 bg-white hover:border-teal-100 hover:bg-teal-50/40"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      active
                        ? "bg-teal-700 text-white"
                        : "bg-teal-50 text-teal-600"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p
                      className={`font-semibold text-sm ${active ? "text-teal-700" : "text-gray-800"}`}
                    >
                      {title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Calendar */}
          <div className="flex-1 flex justify-center items-start">
            <HijriCalendar />
          </div>
        </div>
      </div>
    </section>
  );
}
