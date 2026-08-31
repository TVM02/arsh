"use client";

import { useEffect, useState } from "react";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function IslamicCalendarSection() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-indexed
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchCalendar = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(
          `https://api.aladhan.com/v1/calendarByCity/${year}/${month}?city=Kollam&country=India&method=1`
        );
        if (!res.ok) throw new Error("API error");
        const json = await res.json();
        setCalendarData(json.data || []);
      } catch (err) {
        console.error("IslamicCalendarSection fetch error:", err);
        setError(true);
        setCalendarData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCalendar();
  }, [year, month]);

  const goToPrev = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goToNext = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // Build a map from gregorian day number -> day data
  const dayMap = {};
  let hijriMonthLabel = "";
  calendarData.forEach((entry) => {
    const gDay = parseInt(entry.date?.gregorian?.day, 10);
    if (!isNaN(gDay)) {
      dayMap[gDay] = entry;
    }
    // Collect hijri month name (use last seen, they span two months at most)
    if (entry.date?.hijri?.month?.en) {
      if (!hijriMonthLabel) {
        hijriMonthLabel = entry.date.hijri.month.en + " " + entry.date.hijri.year;
      }
    }
  });

  // Build full grid
  // First day of the Gregorian month
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  const gridCells = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    gridCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    gridCells.push(d);
  }

  const todayDay = today.getDate();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month;

  return (
    <section
      id="madrasa-calendar"
      className="pt-[1.75rem] pb-[2.5rem] sm:pt-[2.5rem]"
    >
      <div className="relative z-10 w-[calc(100%-4rem)] max-w-[1400px] mx-auto">
        <div className="bg-white border border-[#c9b37e]/45 rounded-md p-5 sm:p-7 shadow-[0_2px_12px_rgba(39,70,41,0.06)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={goToPrev}
              aria-label="Previous month"
              className="w-9 h-9 flex items-center justify-center rounded border border-[#c9b37e]/45 text-[#274629] hover:border-[#355a2c] hover:bg-[rgba(201,179,126,0.12)] transition-all duration-200 text-[1.1rem] font-bold"
            >
              &#8249;
            </button>

            <div className="text-center">
              <h2 className="text-[1.2rem] font-serif text-[#274629] leading-tight">
                {MONTH_NAMES[month - 1]} {year}
              </h2>
              {hijriMonthLabel && (
                <p className="text-[0.8rem] text-[#6b7a6b] mt-[0.15rem]">
                  {hijriMonthLabel}
                </p>
              )}
            </div>

            <button
              onClick={goToNext}
              aria-label="Next month"
              className="w-9 h-9 flex items-center justify-center rounded border border-[#c9b37e]/45 text-[#274629] hover:border-[#355a2c] hover:bg-[rgba(201,179,126,0.12)] transition-all duration-200 text-[1.1rem] font-bold"
            >
              &#8250;
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_OF_WEEK.map((d) => (
              <div
                key={d}
                className="text-center text-[0.72rem] font-semibold text-[#6b7a6b] tracking-[0.08em] py-2 uppercase"
              >
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            /* Skeleton */
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded h-[70px] bg-[#ebe4d6]/40 animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <p className="text-center text-[#6b7a6b] py-8 text-[0.95rem]">
              Failed to load calendar. Please try again later.
            </p>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {gridCells.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="rounded h-[70px]" />;
                }

                const entry = dayMap[day];
                const hijriDay = entry?.date?.hijri?.day;
                const hijriMonthEn = entry?.date?.hijri?.month?.en;
                const holidays = entry?.date?.hijri?.holidays || [];
                const hasHoliday = holidays.length > 0;
                const isToday = isCurrentMonth && day === todayDay;

                return (
                  <div
                    key={day}
                    title={hasHoliday ? holidays.join(", ") : undefined}
                    className={`rounded p-1 h-[70px] flex flex-col items-center justify-start pt-[0.45rem] border transition-colors duration-150 ${
                      hasHoliday
                        ? "bg-teal-50 border-teal-300"
                        : isToday
                        ? "bg-[#355a2c]/[0.07] border-[#355a2c]/40"
                        : "bg-[#ebe4d6]/20 border-[#c9b37e]/20 hover:bg-[#c9b37e]/[0.07]"
                    }`}
                  >
                    <span
                      className={`text-[1.05rem] font-serif leading-none ${
                        isToday
                          ? "text-[#355a2c] font-bold"
                          : hasHoliday
                          ? "text-teal-700"
                          : "text-[#274629]"
                      }`}
                    >
                      {day}
                    </span>
                    {hijriDay && (
                      <span className="text-[0.6rem] text-[#6b7a6b] leading-tight mt-[0.2rem] text-center">
                        {hijriDay} {hijriMonthEn}
                      </span>
                    )}
                    {hasHoliday && (
                      <span className="text-[0.55rem] text-teal-700 font-medium leading-tight mt-[0.15rem] text-center line-clamp-2 px-[0.1rem]">
                        {holidays[0]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
