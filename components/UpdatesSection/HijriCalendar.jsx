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
const KERALA_DISTRICTS = [
  {
    name: "Thiruvananthapuram",
    apiCity: "Thiruvananthapuram",
  },
  {
    name: "Kollam",
    apiCity: "Kollam",
  },
  {
    name: "Pathanamthitta",
    apiCity: "Pathanamthitta",
  },
  {
    name: "Alappuzha",
    apiCity: "Alappuzha",
  },
  {
    name: "Kottayam",
    apiCity: "Kottayam",
  },
  {
    name: "Idukki",
    apiCity: "Painavu",
  },
  {
    name: "Ernakulam",
    apiCity: "Kochi",
  },
  {
    name: "Thrissur",
    apiCity: "Thrissur",
  },
  {
    name: "Palakkad",
    apiCity: "Palakkad",
  },
  {
    name: "Malappuram",
    apiCity: "Malappuram",
  },
  {
    name: "Kozhikode",
    apiCity: "Kozhikode",
  },
  {
    name: "Wayanad",
    apiCity: "Kalpetta",
  },
  {
    name: "Kannur",
    apiCity: "Kannur",
  },
  {
    name: "Kasaragod",
    apiCity: "Kasaragod",
  },
];

function formatGregorianDate(dateStr) {
  const [day, month, year] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
const KAABA_LAT = 21.422487;
const KAABA_LNG = 39.826206;

export default function HijriCalendar() {
  const [calendar, setCalendar] = useState(null);
  const [prayerData, setPrayerData] = useState(null);
 const [district, setDistrict] =
  useState("Kollam");
  const [nextPrayerName, setNextPrayerName] = useState("");
  const [countdown, setCountdown] = useState("");
  const [modalUrl, setModalUrl] = useState("");
  const [quthbaData, setQuthbaData] = useState(null);
  const [quthbaModalOpen, setQuthbaModalOpen] = useState(false);
  const [qiblafinder, setQiblafinder] = useState(false);
  const [selectedQuthbaIndex, setSelectedQuthbaIndex] = useState(0);
  const [holidaysData, setHolidaysData] = useState([]);
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [holidayFilterMonth, setHolidayFilterMonth] = useState("");
  const [holidayFilterYear, setHolidayFilterYear] = useState("");
  const [quthbaSearchTerm, setQuthbaSearchTerm] = useState("");
    const [location, setLocation] = useState(null);
  const [qibla, setQibla] = useState(null);
  const [heading, setHeading] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      const selectedDistrict =
        KERALA_DISTRICTS.find(
          (item) =>
            item.name === district,
        );

      if (!selectedDistrict) {
        return;
      }

      console.log(
        "PRAYER DISTRICT:",
        selectedDistrict.name,
      );

      console.log(
        "PRAYER API CITY:",
        selectedDistrict.apiCity,
      );

      const data =
        await getPrayerTimes(
          selectedDistrict.apiCity,
        );

      setPrayerData(data);

    } catch (error) {
      console.error(
        "PRAYER TIMES ERROR:",
        error,
      );
    }
  };

  fetchPrayerTimes();
}, [district]);

  const getQibla = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://api.aladhan.com/v1/qibla/${lat}/${lng}`
      );

      if (!response.ok) {
        throw new Error("Qibla API failed");
      }

      const result = await response.json();

      if (!result?.data?.direction) {
        throw new Error("Invalid Qibla response");
      }

      setQibla(result.data.direction);
    } catch (err) {
      console.error(err);
      setError("Unable to calculate Qibla direction.");
    }
  };

  // --------------------------------------------------
  // Get user location
  // --------------------------------------------------
  const getLocation = () => {
    setLoading(true);
    setError("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setLocation({
          lat,
          lng,
        });

        await getQibla(lat, lng);

        setLoading(false);
      },
      (err) => {
        console.error(err);

        setError(
          "Location permission denied. Please allow location access."
        );

        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // --------------------------------------------------
  // Request compass permission
  // --------------------------------------------------
  const enableCompass = async () => {
    try {
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        const permission =
          await DeviceOrientationEvent.requestPermission();

        if (permission !== "granted") {
          setError("Compass permission was denied.");
          return;
        }
      }

      window.addEventListener(
        "deviceorientationabsolute",
        handleOrientation,
        true
      );

      window.addEventListener(
        "deviceorientation",
        handleOrientation,
        true
      );
    } catch (err) {
      console.error(err);
      setError("Unable to access compass.");
    }
  };

  // --------------------------------------------------
  // Device compass
  // --------------------------------------------------
  const handleOrientation = (event) => {
    let currentHeading = null;

    // iPhone / iPad
    if (typeof event.webkitCompassHeading === "number") {
      currentHeading = event.webkitCompassHeading;
    }

    // Android / other browsers
    else if (typeof event.alpha === "number") {
      currentHeading = 360 - event.alpha;
    }

    if (currentHeading !== null) {
      setHeading(normalizeDegrees(currentHeading));
    }
  };

  // --------------------------------------------------
  // Start
  // --------------------------------------------------
  const startQibla = async () => {
    await enableCompass();
    getLocation();
  };

  // --------------------------------------------------
  // Normalize angle
  // --------------------------------------------------
  const normalizeDegrees = (degree) => {
    return ((degree % 360) + 360) % 360;
  };

  // --------------------------------------------------
  // Distance to Kaaba
  // --------------------------------------------------
  const calculateDistance = () => {
    if (!location) return null;

    const R = 6371;

    const lat1 = toRadians(location.lat);
    const lat2 = toRadians(KAABA_LAT);

    const deltaLat = toRadians(
      KAABA_LAT - location.lat
    );

    const deltaLng = toRadians(
      KAABA_LNG - location.lng
    );

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLng / 2) ** 2;

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return R * c;
  };

  const toRadians = (degree) => {
    return (degree * Math.PI) / 180;
  };

  const distance = calculateDistance();

  // --------------------------------------------------
  // Qibla arrow rotation
  // --------------------------------------------------
  const arrowRotation =
    qibla !== null
      ? normalizeDegrees(qibla - heading)
      : 0;

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

              <div className="flex-1 md:w-[220px]">
  <label
    className="block mb-1.5 text-[0.75rem] font-semibold text-[#4a5568]"
    htmlFor="prayer-district"
  >
    Select District
  </label>

  <div className="relative">
    <select
      id="prayer-district"
      className="w-full px-3 py-[0.5rem] bg-white border-2 border-[#0f766e] rounded-md text-[#2d3748] text-[0.9rem] font-medium cursor-pointer appearance-none focus:outline-none"
      value={district}
      onChange={(e) =>
        setDistrict(
          e.target.value,
        )
      }
    >
      {KERALA_DISTRICTS.map(
        (item) => (
          <option
            key={item.name}
            value={item.name}
          >
            {item.name}
          </option>
        ),
      )}
    </select>

    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#0f766e]">
      <svg
        className="fill-current h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
      >
        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
      </svg>
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
              href="/#"
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
              أذكار — Adhkar
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
              Broadcast Live
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
            <button
              onClick={() => setQiblafinder(true)}
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
            </button>
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
{qiblafinder && (
  <div
    className="
      fixed inset-0 z-[9999]
      bg-black/80
      overflow-y-auto
      px-4 py-6
      md:px-8
    "
  >
    {/* Top Close Button */}
    <div className="flex justify-end mb-3">
      <button
        onClick={() => setQiblafinder(false)}
        className="
          bg-[#cbb47b]
          hover:bg-[#bda66d]
          text-white
          font-semibold
          px-6 py-3
          rounded-md
          shadow
          transition
        "
      >
        Close Window
      </button>
    </div>

    {/* Main White Popup */}
    <div
      className="
        w-full
        min-h-[90vh]
        bg-white
        rounded-xl
        shadow-2xl
        px-5 py-6
        md:px-8 md:py-8
      "
    >
      {/* Popup Header */}
      <div
        className="
          flex flex-col
          md:flex-row
          md:items-center
          md:justify-between
          gap-4
          border-b
          border-[#d5b66f]
          pb-4
          mb-7
        "
      >
        <div>
          <h1
            className="
              text-3xl
              font-semibold
              text-[#244a2d]
            "
          >
            Qibla Finder
          </h1>

          <p className="text-gray-500 mt-1 text-sm">
            Find the direction of the Holy Kaaba
          </p>
        </div>

        <div className="text-sm text-gray-500">
          📍 Location based Qibla direction
        </div>
      </div>

      {/* Finder Section */}
      <div
        className="
          border
          border-[#d9bd7a]
          rounded-xl
          p-5
          md:p-8
          bg-[#fffefa]
        "
      >
        <div
          className="
            mx-auto
            max-w-5xl
            grid
            grid-cols-1
            lg:grid-cols-[1fr_420px]
            gap-8
            items-center
          "
        >
          {/* LEFT SIDE - Compass */}
          <div className="flex flex-col items-center justify-center">
            {/* Status */}
            <div className="mb-6 text-center">
              {loading ? (
                <p className="text-amber-600 font-medium">
                  📍 Getting your location...
                </p>
              ) : qibla !== null ? (
                <p className="text-green-700 font-medium">
                  ✓ Qibla direction detected
                </p>
              ) : (
                <p className="text-gray-500">
                  Tap the button to find your Qibla
                </p>
              )}
            </div>

            {/* Compass */}
            <div
              className="
                relative
                w-[260px]
                h-[260px]
                sm:w-[320px]
                sm:h-[320px]
                rounded-full
                bg-[#163528]
                shadow-2xl
                border-[10px]
                border-[#e0c98f]
              "
            >
              {/* Inner Circle */}
              <div
                className="
                  absolute inset-3
                  rounded-full
                  border
                  border-white/20
                  bg-gradient-to-br
                  from-[#27583f]
                  to-[#071b15]
                "
              >
                {/* Directions */}
                <span
                  className="
                    absolute top-4 left-1/2
                    -translate-x-1/2
                    font-bold
                    text-red-400
                    text-lg
                  "
                >
                  N
                </span>

                <span
                  className="
                    absolute right-4 top-1/2
                    -translate-y-1/2
                    font-semibold
                    text-white
                  "
                >
                  E
                </span>

                <span
                  className="
                    absolute bottom-4 left-1/2
                    -translate-x-1/2
                    font-semibold
                    text-white
                  "
                >
                  S
                </span>

                <span
                  className="
                    absolute left-4 top-1/2
                    -translate-y-1/2
                    font-semibold
                    text-white
                  "
                >
                  W
                </span>

                {/* Arrow + Center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="
                      absolute
                      w-2
                      h-[120px]
                      sm:h-[145px]
                      origin-bottom
                      transition-transform
                      duration-300
                    "
                    style={{
                      transform: `translateY(-50%) rotate(${arrowRotation}deg)`,
                    }}
                  >
                    <div
                      className="
                        absolute
                        bottom-0
                        left-1/2
                        -translate-x-1/2
                        w-2
                        h-[105px]
                        sm:h-[125px]
                        bg-[#e4c16c]
                        rounded-full
                        shadow-[0_0_15px_rgba(228,193,108,.8)]
                      "
                    />

                    <div
                      className="
                        absolute
                        top-0
                        left-1/2
                        -translate-x-1/2
                        border-l-[14px]
                        border-r-[14px]
                        border-b-[28px]
                        border-l-transparent
                        border-r-transparent
                        border-b-[#e4c16c]
                      "
                    />
                  </div>

                  <div
                    className="
                      relative z-10
                      w-16 h-16
                      rounded-full
                      bg-black
                      border-4
                      border-[#e4c16c]
                      flex
                      items-center
                      justify-center
                      text-2xl
                      shadow-xl
                    "
                  >
                    🕋
                  </div>
                </div>
              </div>
            </div>

            {/* Bearing */}
            <div className="mt-6 text-center">
              <div className="text-4xl font-bold text-[#8d6f2b]">
                {qibla !== null
                  ? `${qibla.toFixed(1)}°`
                  : "--"}
              </div>

              <p className="text-sm text-gray-500 mt-1">
                Qibla bearing from North
              </p>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div>
            <div
              className="
                bg-white
                border
                border-gray-200
                rounded-xl
                shadow-sm
                p-6
              "
            >
              <h2 className="text-xl font-semibold text-[#244a2d] mb-5">
                Location Information
              </h2>

              <div className="space-y-3">
                {/* Latitude */}
                <div
                  className="
                    flex
                    justify-between
                    items-center
                    bg-gray-50
                    rounded-lg
                    px-4 py-3
                  "
                >
                  <span className="text-gray-500">
                    Latitude
                  </span>

                  <span className="font-semibold text-gray-800">
                    {location
                      ? location.lat.toFixed(5)
                      : "--"}
                  </span>
                </div>

                {/* Longitude */}
                <div
                  className="
                    flex
                    justify-between
                    items-center
                    bg-gray-50
                    rounded-lg
                    px-4 py-3
                  "
                >
                  <span className="text-gray-500">
                    Longitude
                  </span>

                  <span className="font-semibold text-gray-800">
                    {location
                      ? location.lng.toFixed(5)
                      : "--"}
                  </span>
                </div>

                {/* Qibla */}
                <div
                  className="
                    flex
                    justify-between
                    items-center
                    bg-gray-50
                    rounded-lg
                    px-4 py-3
                  "
                >
                  <span className="text-gray-500">
                    Qibla
                  </span>

                  <span className="font-semibold text-[#8d6f2b]">
                    {qibla !== null
                      ? `${qibla.toFixed(1)}°`
                      : "--"}
                  </span>
                </div>

                {/* Distance */}
                <div
                  className="
                    flex
                    justify-between
                    items-center
                    bg-gray-50
                    rounded-lg
                    px-4 py-3
                  "
                >
                  <span className="text-gray-500">
                    Distance
                  </span>

                  <span className="font-semibold text-gray-800">
                    {distance !== null &&
                    distance !== undefined
                      ? `${distance.toFixed(0)} km`
                      : "--"}
                  </span>
                </div>
              </div>

              {/* Button */}
              <button
                onClick={startQibla}
                disabled={loading}
                className="
                  mt-6
                  w-full
                  rounded-lg
                  bg-[#cbb47b]
                  hover:bg-[#bca56a]
                  disabled:opacity-50
                  text-white
                  font-semibold
                  py-3.5
                  transition
                  shadow
                "
              >
                {loading
                  ? "Finding Qibla..."
                  : "📍 Find My Qibla"}
              </button>

              {/* Error */}
              {error && (
                <div
                  className="
                    mt-4
                    bg-red-50
                    border
                    border-red-200
                    text-red-600
                    rounded-lg
                    px-4 py-3
                    text-sm
                  "
                >
                  {error}
                </div>
              )}

              {/* Help */}
              <p className="mt-5 text-xs text-gray-400 text-center leading-relaxed">
                Allow location and compass permissions for
                accurate Qibla direction.
              </p>
            </div>
          </div>
        </div>
      </div>
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
  function InfoBox({ title, value }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">

      <p className="text-xs text-emerald-200/50 mb-1">
        {title}
      </p>

      <p className="font-semibold">
        {value}
      </p>

    </div>
  );
}
}
