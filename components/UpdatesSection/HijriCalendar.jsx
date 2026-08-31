"use client";

import { useEffect, useState } from "react";
import { getHijriDate } from "@/lib/hijri";
import { getPrayerTimes } from "@/lib/prayer";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sunrise, Sun, Sunset, Moon, SunDim, Calendar as CalendarIcon, MoreVertical } from "lucide-react";

const PRAYER_LIST = [
  { id: "Fajr", label: "Fajr", icon: Sunrise },
  { id: "Sunrise", label: "Shurooq", icon: Sunrise },
  { id: "Dhuhr", label: "Zuhr", icon: Sun },
  { id: "Asr", label: "Asr", icon: SunDim },
  { id: "Maghrib", label: "Maghrib", icon: Sunset },
  { id: "Isha", label: "Isha", icon: Moon }
];
const CITIES = ["Kollam", "Kozhikode", "Malappuram", "Kochi"];

function formatGregorianDate(dateStr) {
  const [day, month, year] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function HijriCalendar() {
  const [calendar, setCalendar] = useState(null);
  const [prayerData, setPrayerData] = useState(null);
  const [city, setCity] = useState("Kollam");
  const [nextPrayerName, setNextPrayerName] = useState("");
  const [countdown, setCountdown] = useState("");
  const [modalUrl, setModalUrl] = useState("");
  const [quthbaData, setQuthbaData] = useState(null);
  const [quthbaModalOpen, setQuthbaModalOpen] = useState(false);
  const [selectedQuthbaIndex, setSelectedQuthbaIndex] = useState(0);
  const [holidaysData, setHolidaysData] = useState([]);
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [holidayFilterMonth, setHolidayFilterMonth] = useState("");
  const [holidayFilterYear, setHolidayFilterYear] = useState("");
  const [quthbaSearchTerm, setQuthbaSearchTerm] = useState("");

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const data = await getHijriDate();
        setCalendar(data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchCalendar();
  }, []);

  useEffect(() => {
    const fetchQuthba = async () => {
      try {
        const snap = await getDoc(doc(db, "homepageConfig", "friday_quthba"));
        if (snap.exists()) setQuthbaData(snap.data());
      } catch (error) {
        console.error("Error fetching friday quthba:", error);
      }
    };
    fetchQuthba();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "homepageConfig", "madrasa_holidays"), (snap) => {
      if (snap.exists() && snap.data().holidays) {
        setHolidaysData(snap.data().holidays);
      } else {
        setHolidaysData([]);
      }
    }, (error) => {
      console.error("Error listening to madrasa holidays:", error);
    });
    
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchPrayerTimes = async () => {
      try {
        const data = await getPrayerTimes(city);
        setPrayerData(data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchPrayerTimes();
  }, [city]);

  useEffect(() => {
    if (!prayerData || !prayerData.timings) return;

    const updateCountdown = () => {
      const now = new Date();

      const prayers = PRAYER_LIST.map((p) => [
        p.id,
        prayerData.timings[p.id],
      ]).filter(([id, time]) => time !== undefined);

      let nextPrayer = null;

      for (const [id, time] of prayers) {
        const [hours, minutes] = time.split(":");

        const prayerTime = new Date();
        prayerTime.setHours(Number(hours), Number(minutes), 0, 0);

        if (prayerTime > now) {
          nextPrayer = { id, time: prayerTime };
          break;
        }
      }

      if (!nextPrayer && prayerData.timings.Fajr) {
        const [hours, minutes] = prayerData.timings.Fajr.split(":");

        const fajrTomorrow = new Date();
        fajrTomorrow.setDate(fajrTomorrow.getDate() + 1);
        fajrTomorrow.setHours(Number(hours), Number(minutes), 0, 0);

        nextPrayer = { id: "Fajr", time: fajrTomorrow };
      }

      if (!nextPrayer) return;

      const diff = nextPrayer.time.getTime() - now.getTime();

      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      setNextPrayerName(nextPrayer.id);
      setCountdown(
        `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [prayerData]);

  if (!calendar) {
    return (
      <section className="pt-[1.75rem] pb-[2.5rem] md:pt-[2.5rem] md:pb-0 sm:pt-[2.5rem] sm:pb-0">
        <div className="relative z-10 w-[calc(100%-4rem)] max-w-[1400px] mx-auto">
          <div className="bg-white border border-[#c9b37e]/45 rounded-md p-5 sm:p-7 h-full text-[#274629] shadow-[0_2px_12px_rgba(39,70,41,0.06)]">
            <p className="text-center text-[#6b7a6b] text-[0.95rem] py-8">
              Loading calendar…
            </p>
          </div>
        </div>
      </section>
    );
  }

  const { hijri, gregorian } = calendar;

  return (
    <section className="pt-[1.75rem] pb-[2.5rem] md:pt-[2.5rem] mb-10 md:pb-0 sm:pt-[2.5rem] sm:pb-0">
      <div className="relative z-10 w-[calc(100%-4rem)] max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-5 items-start">
          <div className="bg-white border border-[#e5e5e5] rounded-xl p-5 sm:p-6 h-full text-[#274629] shadow-sm">
            <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-6 mb-5">
              
              <div className="flex flex-col gap-2 min-w-0 md:justify-center">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <CalendarIcon className="w-5 h-5 text-[#6b7a6b]" strokeWidth={2} />
                  <span className="text-[1.05rem] font-bold text-[#2d3748]">
                    {hijri.day} {hijri.month.en} {hijri.year} 
                  </span>
                  <span className="text-[1.05rem] font-bold text-[#2d3748] mx-0.5">:</span>
                  <span className="text-[1.05rem] font-bold text-[#2d3748]">
                    {formatGregorianDate(gregorian.date)}
                  </span>
                </div>
                
                {countdown && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[0.9rem] font-bold text-[#0f766e] uppercase tracking-wide">
                      NEXT PRAYER:
                    </span>
                    <span className="text-[0.9rem] font-bold text-[#0f766e] capitalize">
                      {PRAYER_LIST.find(p => p.id === nextPrayerName)?.label || nextPrayerName}
                    </span>
                    <span className="text-[0.9rem] font-bold text-[#0f766e] tabular-nums ml-1">
                      {countdown}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-end gap-3 w-full md:w-auto">
                <div className="flex-1 md:w-[180px]">
                  <label className="block mb-1.5 text-[0.75rem] font-semibold text-[#4a5568]" htmlFor="prayer-city">
                    Select City
                  </label>
                  <div className="relative">
                    <select
                      id="prayer-city"
                      className="w-full px-3 py-[0.5rem] bg-white border-2 border-[#0f766e] rounded-md text-[#2d3748] text-[0.9rem] font-medium cursor-pointer appearance-none focus:outline-none"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    >
                      {CITIES.map((cityName) => (
                        <option key={cityName} value={cityName}>
                          {cityName}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#0f766e]">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-t border-[#e2e8f0] mb-5" />

            <div className="grid grid-cols-1 min-[561px]:grid-cols-2 lg:grid-cols-3 gap-3">
              {PRAYER_LIST.map((prayer) => {
                const isActive = prayer.id === nextPrayerName;
                const Icon = prayer.icon;
                
                // Format time to 12-hour AM/PM if needed (Aladhan usually returns 24h)
                let timeStr = prayerData?.timings?.[prayer.id] ?? "-";
                let suffix = "";
                if (timeStr !== "-") {
                   let [h, m] = timeStr.split(":");
                   let hn = parseInt(h, 10);
                   suffix = hn >= 12 ? "pm" : "am";
                   hn = hn % 12 || 12;
                   timeStr = `${String(hn).padStart(2, '0')}:${m}`;
                }

                return (
                  <div
                    key={prayer.id}
                    className={`flex flex-row items-center justify-between px-4 py-3 rounded-lg transition-all duration-300 ${
                      isActive
                        ? "bg-[#0f766e] border-[#0f766e] border shadow-[0_2px_8px_rgba(15,118,110,0.3)] z-10"
                        : "bg-white border border-[#e2e8f0] hover:border-[#cbd5e1]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {Icon && (
                        <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-[#4a5568]"}`} strokeWidth={isActive ? 2.5 : 2} />
                      )}
                      <span
                        className={`text-[1rem] tracking-[0.02em] ${isActive ? "text-white font-bold" : "text-[#1a2e1b] font-medium"}`}
                      >
                        {prayer.label}
                      </span>
                    </div>
                    <span className={`text-[1rem] tabular-nums font-bold ${isActive ? "text-white" : "text-[#2d3748]"}`}>
                      {timeStr} <span className="text-[0.85rem] font-semibold">{suffix}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="bg-white border border-[#c9b37e]/45 rounded-md p-5 sm:p-7 shadow-[0_2px_12px_rgba(39,70,41,0.06)] grid grid-cols-2 gap-4 h-fit">
            <button
              onClick={() => setModalUrl("https://www.mp3quran.net/eng")}
              style={{ transition: "all 0.2s ease" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "#355a2c";
                e.currentTarget.style.borderTopColor = "#355a2c";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(39,70,41,0.18)";
                e.currentTarget.style.background = "rgba(201,179,126,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.borderTopColor = "";
                e.currentTarget.style.boxShadow = "";
                e.currentTarget.style.background = "";
              }}
              className="flex items-center justify-center min-h-[64px] bg-white border border-[#c9b37e]/45 border-t-2 border-t-[#c9b37e] rounded text-[#274629] no-underline text-[0.95rem] font-medium cursor-pointer"
            >
              Quran
            </button>
            <a
              href="https://www.awqaf.gov.ae/?lang=en"
              target="_blank"
              rel="noopener noreferrer"
              style={{ transition: "all 0.2s ease", width: "100%" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "#355a2c";
                e.currentTarget.style.borderTopColor = "#355a2c";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(39,70,41,0.18)";
                e.currentTarget.style.background = "rgba(201,179,126,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.borderTopColor = "";
                e.currentTarget.style.boxShadow = "";
                e.currentTarget.style.background = "";
              }}
              className="flex items-center justify-center min-h-[64px] bg-white border border-[#c9b37e]/45 border-t-2 border-t-[#c9b37e] rounded text-[#274629] no-underline text-[0.95rem] font-medium cursor-pointer"
            >
              Prayer Timings
            </a>
            <a
              href="https://www.awqaf.gov.ae/en/mosque/mosquelesson"
              target="_blank"
              rel="noopener noreferrer"
              style={{ transition: "all 0.2s ease" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "#355a2c";
                e.currentTarget.style.borderTopColor = "#355a2c";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(39,70,41,0.18)";
                e.currentTarget.style.background = "rgba(201,179,126,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.borderTopColor = "";
                e.currentTarget.style.boxShadow = "";
                e.currentTarget.style.background = "";
              }}
              className="flex items-center justify-center min-h-[64px] bg-white border border-[#c9b37e]/45 border-t-2 border-t-[#c9b37e] rounded text-[#274629] no-underline text-[0.95rem] font-medium cursor-pointer"
            >
              Mosque Lessons
            </a>
            <button
              onClick={() => setModalUrl("https://shamela.ws")}
              style={{ transition: "all 0.2s ease" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "#355a2c";
                e.currentTarget.style.borderTopColor = "#355a2c";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(39,70,41,0.18)";
                e.currentTarget.style.background = "rgba(201,179,126,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.borderTopColor = "";
                e.currentTarget.style.boxShadow = "";
                e.currentTarget.style.background = "";
              }}
              className="flex items-center justify-center min-h-[64px] bg-white border border-[#c9b37e]/45 border-t-2 border-t-[#c9b37e] rounded text-[#274629] no-underline text-[0.95rem] font-medium cursor-pointer"
            >
              Al Maktaba al Shamela
            </button>
            <a
              href="#"
              style={{ transition: "all 0.2s ease" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "#355a2c";
                e.currentTarget.style.borderTopColor = "#355a2c";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(39,70,41,0.18)";
                e.currentTarget.style.background = "rgba(201,179,126,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.borderTopColor = "";
                e.currentTarget.style.boxShadow = "";
                e.currentTarget.style.background = "";
              }}
              className="flex items-center justify-center min-h-[64px] bg-white border border-[#c9b37e]/45 border-t-2 border-t-[#c9b37e] rounded text-[#274629] no-underline text-[0.95rem] font-medium cursor-pointer"
            >
              AI Digital University
            </a>
            <a
              href="/qibla"
              style={{ transition: "all 0.2s ease" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "#355a2c";
                e.currentTarget.style.borderTopColor = "#355a2c";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(39,70,41,0.18)";
                e.currentTarget.style.background = "rgba(201,179,126,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.borderTopColor = "";
                e.currentTarget.style.boxShadow = "";
                e.currentTarget.style.background = "";
              }}
              className="flex items-center justify-center min-h-[64px] bg-white border border-[#c9b37e]/45 border-t-2 border-t-[#c9b37e] rounded text-[#274629] no-underline text-[0.95rem] font-medium cursor-pointer"
            >
              Qibla Finder
            </a>
            <button
              onClick={() => setQuthbaModalOpen(true)}
              style={{ transition: "all 0.2s ease" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "#355a2c";
                e.currentTarget.style.borderTopColor = "#355a2c";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(39,70,41,0.18)";
                e.currentTarget.style.background = "rgba(201,179,126,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.borderTopColor = "";
                e.currentTarget.style.boxShadow = "";
                e.currentTarget.style.background = "";
              }}
              className="flex items-center justify-center min-h-[64px] bg-white border border-[#c9b37e]/45 border-t-2 border-t-[#c9b37e] rounded text-[#274629] no-underline text-[0.95rem] font-medium cursor-pointer"
            >
              Friday Quthba
            </button>
            <button
              onClick={() => setHolidayModalOpen(true)}
              style={{ transition: "all 0.2s ease" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "#355a2c";
                e.currentTarget.style.borderTopColor = "#355a2c";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(39,70,41,0.18)";
                e.currentTarget.style.background = "rgba(201,179,126,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.borderTopColor = "";
                e.currentTarget.style.boxShadow = "";
                e.currentTarget.style.background = "";
              }}
              className="flex items-center justify-center min-h-[64px] bg-white border border-[#c9b37e]/45 border-t-2 border-t-[#c9b37e] rounded text-[#274629] no-underline text-[0.95rem] font-medium cursor-pointer"
            >
              Madrasa Holidays
            </button>
          </aside>
        </div>
      </div>

      {quthbaModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
            padding: "2vh 2vw",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "12px",
            }}
          >
            <button
              onClick={() => setQuthbaModalOpen(false)}
              style={{
                background: "#c9b37e",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "16px",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#b6a06b")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#c9b37e")
              }
            >
              Close Window
            </button>
          </div>
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              borderRadius: "8px",
              overflow: "auto",
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #c9b37e", paddingBottom: "0.75rem", marginBottom: "0.5rem" }}>
              <h2 style={{ fontFamily: "serif", fontSize: "1.75rem", color: "#274629", margin: 0 }}>
                Friday Quthba
              </h2>
              {quthbaData && quthbaData.entries && quthbaData.entries.length > 0 && (
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <input 
                    type="text"
                    placeholder="Search Friday Quthba..."
                    value={quthbaSearchTerm}
                    onChange={(e) => setQuthbaSearchTerm(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "4px",
                      border: "1px solid #c9b37e",
                      color: "#274629",
                      backgroundColor: "#fff",
                      fontFamily: "inherit",
                      fontSize: "0.95rem",
                      outline: "none",
                      minWidth: "200px"
                    }}
                  />
                  <select 
                    value={selectedQuthbaIndex} 
                    onChange={(e) => setSelectedQuthbaIndex(Number(e.target.value))}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "4px",
                      border: "1px solid #c9b37e",
                      color: "#274629",
                      backgroundColor: "#fff",
                      fontFamily: "inherit",
                      fontSize: "0.95rem",
                      cursor: "pointer",
                      outline: "none"
                    }}
                  >
                    {quthbaData.entries.map((entry, idx) => (
                      <option key={entry.id || idx} value={idx}>
                        {entry.date ? new Date(entry.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : `Entry ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {quthbaData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                {(quthbaData.entries && quthbaData.entries.length > 0) ? (
                  (() => {
                    if (quthbaSearchTerm.trim()) {
                      const filteredEntries = quthbaData.entries.filter(entry => 
                        (entry.message || "").toLowerCase().includes(quthbaSearchTerm.toLowerCase()) ||
                        (entry.date && new Date(entry.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }).toLowerCase().includes(quthbaSearchTerm.toLowerCase()))
                      );

                      if (filteredEntries.length === 0) {
                        return <p style={{ color: "#6b7a6b" }}>No Quthba found matching your search.</p>;
                      }

                      return filteredEntries.map((entry, idx) => (
                        <div key={entry.id || idx} style={{ border: "1px solid #c9b37e", borderRadius: "8px", padding: "1.5rem" }}>
                          {entry.date && (
                            <h3 style={{ color: "#355a2c", marginTop: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>
                              {new Date(entry.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </h3>
                          )}
                          {entry.message && (
                            <p style={{ color: "#274629", lineHeight: "1.8", whiteSpace: "pre-wrap", fontSize: "1rem" }}>
                              {entry.message}
                            </p>
                          )}
                          {entry.fileUrl && (
                            <div style={{ marginTop: "1rem" }}>
                              <iframe
                                src={
                                  entry.fileType === "pdf"
                                    ? entry.fileUrl
                                    : `https://docs.google.com/viewer?url=${encodeURIComponent(entry.fileUrl)}&embedded=true`
                                }
                                style={{
                                  width: "100%",
                                  minHeight: "50vh",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "4px",
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ));
                    } else {
                      const entry = quthbaData.entries[selectedQuthbaIndex] || quthbaData.entries[0];
                      return (
                        <div key={entry.id || selectedQuthbaIndex} style={{ border: "1px solid #c9b37e", borderRadius: "8px", padding: "1.5rem" }}>
                          {entry.date && (
                            <h3 style={{ color: "#355a2c", marginTop: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>
                              {new Date(entry.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </h3>
                          )}
                          {entry.message && (
                            <p style={{ color: "#274629", lineHeight: "1.8", whiteSpace: "pre-wrap", fontSize: "1rem" }}>
                              {entry.message}
                            </p>
                          )}
                          {entry.fileUrl && (
                            <div style={{ marginTop: "1rem" }}>
                              <iframe
                                src={
                                  entry.fileType === "pdf"
                                    ? entry.fileUrl
                                    : `https://docs.google.com/viewer?url=${encodeURIComponent(entry.fileUrl)}&embedded=true`
                                }
                                style={{
                                  width: "100%",
                                  minHeight: "50vh",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "4px",
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    }
                  })()
                ) : (quthbaData.message || quthbaData.fileUrl) ? (
                  <div style={{ border: "1px solid #c9b37e", borderRadius: "8px", padding: "1.5rem" }}>
                      <h3 style={{ color: "#355a2c", marginTop: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>Latest Quthba</h3>
                      {quthbaData.message && (
                        <p style={{ color: "#274629", lineHeight: "1.8", whiteSpace: "pre-wrap", fontSize: "1rem" }}>
                          {quthbaData.message}
                        </p>
                      )}
                      {quthbaData.fileUrl && (
                        <div style={{ marginTop: "1rem" }}>
                          <iframe
                            src={
                              quthbaData.fileType === "pdf"
                                ? quthbaData.fileUrl
                                : `https://docs.google.com/viewer?url=${encodeURIComponent(quthbaData.fileUrl)}&embedded=true`
                            }
                            style={{
                              width: "100%",
                              minHeight: "50vh",
                              border: "1px solid #e2e8f0",
                              borderRadius: "4px",
                            }}
                          />
                        </div>
                      )}
                  </div>
                ) : (
                  <p style={{ color: "#6b7a6b" }}>No content available yet.</p>
                )}
              </div>
            ) : (
              <p style={{ color: "#6b7a6b" }}>Loading...</p>
            )}
          </div>
        </div>
      )}

      {modalUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
            padding: "2vh 2vw",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "12px",
            }}
          >
            <button
              onClick={() => setModalUrl("")}
              style={{
                background: "#c9b37e",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "16px",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#b6a06b")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#c9b37e")
              }
            >
              Close Window
            </button>
          </div>
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <iframe
              src={modalUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          </div>
        </div>
      )}
      {holidayModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
            padding: "2vh 2vw",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "12px",
            }}
          >
            <button
              onClick={() => setHolidayModalOpen(false)}
              style={{
                background: "#c9b37e",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "16px",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#b6a06b")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#c9b37e")
              }
            >
              Close Window
            </button>
          </div>
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              borderRadius: "8px",
              overflow: "auto",
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              maxWidth: "800px",
              margin: "0 auto",
              width: "100%",
            }}
          >
            <div style={{ borderBottom: "2px solid #c9b37e", paddingBottom: "1rem", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <h2 style={{ fontFamily: "serif", fontSize: "1.75rem", color: "#274629", margin: 0 }}>
                Madrasa Holidays
              </h2>
              <div style={{ display: "flex", gap: "1rem" }}>
                <div className="w-[140px]">
                  <Select value={holidayFilterMonth} onValueChange={setHolidayFilterMonth}>
                    <SelectTrigger className="w-full bg-white border-[#c9b37e]/45 text-[#274629] focus:ring-1 focus:ring-[#355a2c] hover:border-[#c9b37e] transition-colors rounded">
                      <SelectValue placeholder="All Months" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="all" className="cursor-pointer">All Months</SelectItem>
                      <SelectItem value="0" className="cursor-pointer">January</SelectItem>
                      <SelectItem value="1" className="cursor-pointer">February</SelectItem>
                      <SelectItem value="2" className="cursor-pointer">March</SelectItem>
                      <SelectItem value="3" className="cursor-pointer">April</SelectItem>
                      <SelectItem value="4" className="cursor-pointer">May</SelectItem>
                      <SelectItem value="5" className="cursor-pointer">June</SelectItem>
                      <SelectItem value="6" className="cursor-pointer">July</SelectItem>
                      <SelectItem value="7" className="cursor-pointer">August</SelectItem>
                      <SelectItem value="8" className="cursor-pointer">September</SelectItem>
                      <SelectItem value="9" className="cursor-pointer">October</SelectItem>
                      <SelectItem value="10" className="cursor-pointer">November</SelectItem>
                      <SelectItem value="11" className="cursor-pointer">December</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[120px]">
                  <Select value={holidayFilterYear} onValueChange={setHolidayFilterYear}>
                    <SelectTrigger className="w-full bg-white border-[#c9b37e]/45 text-[#274629] focus:ring-1 focus:ring-[#355a2c] hover:border-[#c9b37e] transition-colors rounded">
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="all" className="cursor-pointer">All Years</SelectItem>
                      {Array.from(new Set(holidaysData.map(h => new Date(h.date).getFullYear()))).sort().map(year => (
                        <SelectItem key={year} value={year.toString()} className="cursor-pointer">{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", paddingRight: "0.5rem" }}>
              {(() => {
                const filteredHolidays = (holidaysData || [])
                  .filter(h => {
                    if (!h.date) return false;
                    const d = new Date(h.date);
                    if (holidayFilterMonth && holidayFilterMonth !== "all" && d.getMonth() !== parseInt(holidayFilterMonth)) return false;
                    if (holidayFilterYear && holidayFilterYear !== "all" && d.getFullYear() !== parseInt(holidayFilterYear)) return false;
                    return true;
                  })
                  .sort((a, b) => new Date(a.date) - new Date(b.date));

                return filteredHolidays.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {filteredHolidays.map((holiday, idx) => (
                      <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", border: "1px solid #c9b37e", borderRadius: "8px", padding: "1.25rem 1.5rem", background: "#f8f9fa" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                          <h3 style={{ color: "#274629", margin: 0, fontSize: "1.1rem", fontWeight: "600" }}>{holiday.title}</h3>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                            <span style={{ color: "#355a2c", fontSize: "1rem", fontWeight: "500", background: "#e2e8f0", padding: "4px 12px", borderRadius: "16px", whiteSpace: "nowrap" }}>
                              {new Date(holiday.date).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                            {holiday.hijriDate && (
                              <span style={{ color: "#6b7a6b", fontSize: "0.85rem", fontWeight: "500", padding: "0 4px" }}>
                                {holiday.hijriDate}
                              </span>
                            )}
                          </div>
                        </div>
                        {holiday.message && (
                          <p style={{ color: "#4f5c4f", margin: 0, fontSize: "0.95rem", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                            {holiday.message}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "#6b7a6b", textAlign: "center", padding: "2rem 0" }}>No holidays found for the selected filter.</p>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
