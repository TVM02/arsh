"use client";

import {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useMemo,
} from "react";
import { subscribeToResults } from "@/lib/competitionService";
import { CATEGORIES } from "@/lib/competitionUtils";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Trophy,
  Star,
  Medal,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Minus,
  Zap,
  ChevronRight,
  Users,
  Award,
  CheckCircle,
} from "lucide-react";
import Image from "next/image";

// ─── Helpers ────────────────────────────────────────────────────────────────

function gradeColor(grade) {
  switch (grade) {
    case "A+": return "text-emerald-600";
    case "A":  return "text-green-600";
    case "B+": return "text-blue-600";
    case "B":  return "text-sky-600";
    case "C":  return "text-yellow-600";
    default:   return "text-red-600";
  }
}

function gradeBadge(grade) {
  switch (grade) {
    case "A+": return "bg-emerald-50 border-emerald-200 text-emerald-700";
    case "A":  return "bg-green-50 border-green-200 text-green-700";
    case "B+": return "bg-blue-50 border-blue-200 text-blue-700";
    case "B":  return "bg-sky-50 border-sky-200 text-sky-700";
    case "C":  return "bg-yellow-50 border-yellow-200 text-yellow-700";
    default:   return "bg-red-50 border-red-200 text-red-700";
  }
}

// ─── Avatar ─────────────────────────────────────────────────────────────────

function Avatar({ src, name, size = 40 }) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const proxySrc =
    src && !imgError
      ? src.startsWith("http")
        ? `/api/proxy-image?url=${encodeURIComponent(src)}`
        : null
      : null;

  if (!proxySrc || imgError) {
    return (
      <div
        className="rounded-full bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center flex-shrink-0 font-bold text-teal-500 border border-teal-300"
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0 border border-teal-200"
      style={{ width: size, height: size }}
    >
      <Image
        src={proxySrc}
        alt={name || ""}
        width={size}
        height={size}
        className="object-cover w-full h-full"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

// ─── Count-up number ────────────────────────────────────────────────────────

function CountUp({ value, className = "" }) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);
  const rafRef  = useRef(null);
  const prefersReduced = useRef(false);

  useEffect(() => {
    prefersReduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (prefersReduced.current) { setDisplayed(value); prevRef.current = value; return; }
    const start = prevRef.current;
    const diff  = value - start;
    if (diff === 0) return;
    const DURATION   = 700;
    const startTime  = performance.now();
    const animate    = (now) => {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + diff * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = value;
      }
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return <span className={className}>{displayed}</span>;
}

// ─── Pipeline flow visualization ────────────────────────────────────────────

const PIPELINE_STEPS = [
  { icon: Award,       label: "Central Admin",  sub: "Config & Events" },
  { icon: Users,       label: "Sadar",          sub: "Registration" },
  { icon: Star,        label: "Mekhala",        sub: "Mark Entry" },
  { icon: TrendingUp,  label: "District",       sub: "Mark Entry" },
  { icon: Medal,       label: "State",          sub: "Final Marks" },
  { icon: CheckCircle, label: "Verification",   sub: "Verify & Publish" },
  { icon: Trophy,      label: "Live Score",     sub: "You are here", active: true },
];

function PipelineFlow({ resultCount }) {
  return (
    <div className="bg-white border border-teal-100 shadow-sm rounded-xl p-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">
        Competition Journey
      </p>
      <div className="flex items-center gap-0 min-w-max">
        {PIPELINE_STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="flex items-center">
              <div
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-center min-w-[80px] ${
                  step.active
                    ? "bg-teal-50 border border-teal-200"
                    : "bg-gray-50 border border-gray-200"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${step.active ? "text-teal-700" : "text-slate-500"}`}
                />
                <span
                  className={`text-xs font-semibold leading-tight ${
                    step.active ? "text-teal-500" : "text-slate-600"
                  }`}
                >
                  {step.label}
                </span>
                <span className="text-xs text-slate-500 leading-tight">{step.sub}</span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div className="flex items-center mx-1 flex-shrink-0">
                  <div className="h-px w-3 bg-teal-300" />
                  <ChevronRight className="h-3 w-3 text-teal-500" />
                </div>
              )}
            </div>
          );
        })}
        {/* Live count badge */}
        <div className="flex items-center ml-3 flex-shrink-0">
          <div className="text-center px-3 py-2 bg-teal-500/10 border border-teal-500/30 rounded-lg">
            <p className="text-2xl font-bold text-teal-700">{resultCount}</p>
            <p className="text-xs text-slate-500">published</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Ticker ─────────────────────────────────────────────────────────────────

function Ticker({ results }) {
  if (!results.length) return null;
  const items = [...results, ...results]; // duplicate for seamless loop
  return (
    <div className="overflow-hidden bg-white/80 border-b border-teal-100 shadow-sm h-8 flex items-center flex-shrink-0">
      <div className="flex-shrink-0 px-3 text-xs text-teal-700 font-semibold border-r border-teal-200 h-full flex items-center gap-1">
        <Zap className="h-3 w-3 animate-pulse" />
        <span>LATEST</span>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="ticker-fast flex gap-10 whitespace-nowrap">
          {items.map((r, i) => (
            <span key={i} className="text-xs text-slate-600 inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 inline-block" />
              <span className="text-teal-500 font-medium">{r.studentName}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">{r.eventName}</span>
              <span className="text-slate-500">·</span>
              <span className={`font-bold ${gradeColor(r.finalGrade)}`}>{r.finalScore} pts</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-500">{r.districtName}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Rank change indicator ───────────────────────────────────────────────────

function RankChange({ delta }) {
  if (delta > 0)
    return (
      <span className="flex items-center gap-0.5 text-emerald-600 text-xs font-semibold">
        <ArrowUp className="h-3 w-3" />
        {delta}
      </span>
    );
  if (delta < 0)
    return (
      <span className="flex items-center gap-0.5 text-red-600 text-xs font-semibold">
        <ArrowDown className="h-3 w-3" />
        {Math.abs(delta)}
      </span>
    );
  return <Minus className="h-3 w-3 text-slate-500" />;
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function LiveScorePage() {
  const [results,    setResults]    = useState([]);
  const [newIds,     setNewIds]     = useState(new Set());
  const [prevRanks,  setPrevRanks]  = useState({});
  const [tick,       setTick]       = useState(0);
  const [photoMap,   setPhotoMap]   = useState({});

  // FLIP refs
  const rowRefs         = useRef({});
  const snapshots       = useRef({});
  const perfRefs        = useRef({});
  const perfSnapshots   = useRef({});
  const prefersReduced  = useRef(false);
  const clearTimerRef  = useRef(null);

  useEffect(() => {
    prefersReduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Real-time Firestore subscription
  useEffect(() => {
    const unsub = subscribeToResults((data) => {
      setResults((prev) => {
        const prevIdSet = new Set(prev.map((r) => r.id));
        const brandNew  = new Set(data.filter((r) => !prevIdSet.has(r.id)).map((r) => r.id));
        if (brandNew.size > 0) {
          setNewIds(brandNew);
          clearTimeout(clearTimerRef.current);
          clearTimerRef.current = setTimeout(() => setNewIds(new Set()), 2800);
        }
        return data;
      });
    });
    return () => { unsub(); clearTimeout(clearTimerRef.current); };
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch actual student photos from students collection
  useEffect(() => {
    if (!results.length) return;

    // Collect all unique student IDs across results and group members
    const ids = new Set();
    results.forEach((r) => {
      if (r.studentId) ids.add(r.studentId);
      (r.students || []).forEach((s) => { if (s.id) ids.add(s.id); });
    });

    // Only fetch IDs we haven't resolved yet
    const toFetch = [...ids].filter((id) => id && !(id in photoMap));
    if (!toFetch.length) return;

    Promise.all(
      toFetch.map((id) =>
        getDoc(doc(db, "students", id))
          .then((snap) => ({
            id,
            photo: snap.exists()
              ? (snap.data().profilePictureUrl || snap.data().profilePicture || "")
              : "",
          }))
          .catch(() => {
            // Silently fall back to empty photo to avoid console spam
            return { id, photo: "" };
          })
      )
    ).then((entries) => {
      setPhotoMap((prev) => {
        const next = { ...prev };
        entries.forEach(({ id, photo }) => { next[id] = photo; });
        return next;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  // District ranking
  const districtRanking = useMemo(() => {
    const map = results.reduce((acc, r) => {
      const d = r.districtName || "Unknown";
      acc[d] = (acc[d] || 0) + (r.finalScore || 0);
      return acc;
    }, {});
    return Object.entries(map)
      .map(([district, points]) => ({ district, points }))
      .sort((a, b) => b.points - a.points);
  }, [results]);

  // Rank-change tracking (update prevRanks after animation plays)
  const rankChanges = useMemo(() => {
    const changes = {};
    districtRanking.forEach((item, idx) => {
      const prev = prevRanks[item.district];
      changes[item.district] = prev === undefined ? 0 : prev - (idx + 1);
    });
    return changes;
  }, [districtRanking, prevRanks]);

  useEffect(() => {
    const next = {};
    districtRanking.forEach((item, idx) => { next[item.district] = idx + 1; });
    const t = setTimeout(() => setPrevRanks(next), 700);
    return () => clearTimeout(t);
  }, [districtRanking]);

  // FLIP animation for district ranking
  useLayoutEffect(() => {
    if (prefersReduced.current) return;

    // Read current natural positions (before any transforms this render)
    const current = {};
    Object.entries(rowRefs.current).forEach(([district, el]) => {
      if (el) current[district] = el.getBoundingClientRect().top;
    });

    // Apply inverse transforms where position changed
    Object.entries(current).forEach(([district, newTop]) => {
      const el    = rowRefs.current[district];
      if (!el) return;
      const stored = snapshots.current[district];
      if (stored === undefined) return;
      const delta = stored - newTop;
      if (Math.abs(delta) < 1) return;

      el.style.transition = "none";
      el.style.transform  = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 550ms cubic-bezier(0.4, 0, 0.2, 1)";
        el.style.transform  = "";
      });
    });

    // Store current natural positions for next render
    snapshots.current = current;
  }, [districtRanking]);

  // FLIP animation for top performers
  useLayoutEffect(() => {
    if (prefersReduced.current) return;

    const current = {};
    Object.entries(perfRefs.current).forEach(([id, el]) => {
      if (el) current[id] = el.getBoundingClientRect().top;
    });

    Object.entries(current).forEach(([id, newTop]) => {
      const el    = perfRefs.current[id];
      if (!el) return;
      const stored = perfSnapshots.current[id];
      if (stored === undefined) return;
      const delta = stored - newTop;
      if (Math.abs(delta) < 1) return;

      el.style.transition = "none";
      el.style.transform  = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 550ms cubic-bezier(0.4, 0, 0.2, 1)";
        el.style.transform  = "";
      });
    });

    perfSnapshots.current = current;
  }, [results]);

  // Derived data
  const maxPoints = districtRanking[0]?.points || 1;

  const topPerformers = useMemo(
    () => [...results].sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0)).slice(0, 5),
    [results],
  );

  const latestResults = useMemo(
    () =>
      [...results]
        .sort((a, b) => (b.publishedAt?.seconds || 0) - (a.publishedAt?.seconds || 0))
        .slice(0, 10),
    [results],
  );

  const byCategory = useMemo(
    () =>
      Object.keys(CATEGORIES).map((key) => {
        const cat = results.filter((r) => r.category === key);
        return {
          key,
          label: CATEGORIES[key].label,
          labelAr: CATEGORIES[key].labelAr,
          count: cat.length,
          best: cat.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))[0],
        };
      }),
    [results],
  );

  const now     = new Date();
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const medalEmoji = (i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-50 bg-white/98 border-b border-teal-200 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="h-8 w-8 bg-teal-100 rounded-full flex items-center justify-center pulse-ring">
              <Trophy className="h-4 w-4 text-teal-700" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-none tracking-tight">
                DKJU Competition{" "}
                <span className="text-teal-700">التنافس</span>
              </h1>
              <p className="text-xs text-slate-500">Live Results Board</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 bg-red-600/15 border border-red-600/30 rounded-full px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold text-red-600">LIVE</span>
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums">{timeStr}</span>
            <span className="text-xs text-slate-500 border border-teal-100 rounded px-2 py-0.5">
              {results.length} results
            </span>
          </div>
        </div>

        {/* Ticker strip */}
        {latestResults.length > 0 && <Ticker results={latestResults} />}
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* ── Pipeline flow ── */}
        <PipelineFlow resultCount={results.length} />

        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-500">
            <Trophy className="h-12 w-12 opacity-20" />
            <p className="text-lg font-medium">No results published yet.</p>
            <p className="text-sm">
              Results appear here instantly as they are verified and published.
            </p>
          </div>
        ) : (
          <>
            {/* ── Stats row ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Results",  val: results.length,                      icon: Trophy,     bg: "bg-gradient-to-br from-blue-600 to-indigo-700" },
                { label: "Districts",      val: districtRanking.length,              icon: TrendingUp, bg: "bg-gradient-to-br from-emerald-500 to-teal-700" },
                { label: "Top Score",      val: topPerformers[0]?.finalScore ?? "—", icon: Star,       bg: "bg-gradient-to-br from-amber-500 to-orange-600" },
                { label: "Top Grade",      val: topPerformers[0]?.finalGrade ?? "—", icon: Medal,      bg: "bg-gradient-to-br from-rose-500 to-pink-700" },
              ].map((s) => (
                <div
                  key={s.label}
                  className={`${s.bg} shadow-lg rounded-2xl p-5 flex items-center justify-between text-white transform transition hover:scale-105`}
                >
                  <div>
                    <p className="text-sm font-medium opacity-80 uppercase tracking-wider">{s.label}</p>
                    <p className="text-4xl font-extrabold mt-1 tracking-tight drop-shadow-sm">
                      {s.val}
                    </p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <s.icon className="h-8 w-8 text-white drop-shadow-sm" />
                  </div>
                </div>
              ))}
            </div>

            {/* ── MAIN DASHBOARD GRID (Election Style) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* LEFT COLUMN: District Ranking */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                    <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-indigo-600" />
                      Live District Leaderboard
                    </h2>
                    <span className="text-xs font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full uppercase tracking-wider">
                      Points Aggregate
                    </span>
                  </div>

                  <div className="space-y-4">
                {districtRanking.map((d, i) => {
                  const pct    = Math.round((d.points / maxPoints) * 100);
                  const change = rankChanges[d.district] || 0;
                  return (
                    <div
                      key={d.district}
                      ref={(el) => { rowRefs.current[d.district] = el; }}
                      className="group"
                    >
                      <div className="flex items-center gap-3 mb-1">
                        {/* Rank number */}
                        <div className="w-7 text-right flex-shrink-0">
                          {i === 0 ? (
                            <span className="text-lg">🥇</span>
                          ) : i === 1 ? (
                            <span className="text-lg">🥈</span>
                          ) : i === 2 ? (
                            <span className="text-lg">🥉</span>
                          ) : (
                            <span className="text-sm text-slate-500 font-mono">{i + 1}</span>
                          )}
                        </div>

                        {/* District name + rank change */}
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-800 truncate">
                            {d.district}
                          </span>
                          <RankChange delta={change} />
                        </div>

                        {/* Points count-up */}
                        <div className="text-right flex-shrink-0">
                          <CountUp
                            value={d.points}
                            className="font-bold text-teal-500 text-lg tabular-nums"
                          />
                          <span className="text-xs text-slate-500 ml-1">pts</span>
                        </div>

                        {/* Percentage */}
                        <div className="w-10 text-right flex-shrink-0">
                          <span className="text-xs text-slate-500">{pct}%</span>
                        </div>
                      </div>

                      {/* Animated bar with vibrant election colors */}
                      <div className="ml-10 h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${pct}%`,
                            background: [
                              "linear-gradient(90deg, #4f46e5, #818cf8)", // Indigo
                              "linear-gradient(90deg, #e11d48, #fb7185)", // Rose
                              "linear-gradient(90deg, #059669, #34d399)", // Emerald
                              "linear-gradient(90deg, #d97706, #fbbf24)", // Amber
                              "linear-gradient(90deg, #7c3aed, #a78bfa)", // Violet
                              "linear-gradient(90deg, #2563eb, #60a5fa)", // Blue
                              "linear-gradient(90deg, #db2777, #f472b6)", // Pink
                              "linear-gradient(90deg, #ea580c, #fb923c)", // Orange
                              "linear-gradient(90deg, #0891b2, #22d3ee)", // Cyan
                              "linear-gradient(90deg, #65a30d, #a3e635)", // Lime
                              "linear-gradient(90deg, #be123c, #fb7185)", // Deep Rose
                              "linear-gradient(90deg, #047857, #34d399)", // Deep Emerald
                              "linear-gradient(90deg, #b45309, #fbbf24)", // Deep Amber
                              "linear-gradient(90deg, #4338ca, #818cf8)", // Deep Indigo
                            ][i % 14],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Top Performers */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl p-6 h-full">
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                  Top Candidates
                </h2>
              </div>
              <div className="space-y-4">
                {topPerformers.map((r, i) => {
                  const isNew = newIds.has(r.id);
                  return (
                    <div
                      key={r.id}
                      ref={(el) => { perfRefs.current[r.id] = el; }}
                      className={`relative flex items-center gap-3 p-3 rounded-xl border shadow-sm transition-all duration-500 ${
                        i === 0
                          ? "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300 shadow-amber-100"
                          : i === 1
                          ? "bg-gradient-to-r from-slate-50 to-gray-100 border-slate-300 shadow-slate-200"
                          : i === 2
                          ? "bg-gradient-to-r from-orange-50 to-orange-100 border-orange-300 shadow-orange-100"
                          : "bg-white border-slate-200 hover:border-indigo-300"
                      } ${isNew ? "pop-in scale-105 shadow-xl ring-2 ring-indigo-400" : ""}`}
                    >
                      <div className="w-8 text-center flex-shrink-0">
                        {medalEmoji(i) ? (
                          <span className="text-2xl drop-shadow-sm">{medalEmoji(i)}</span>
                        ) : (
                          <span className="text-sm font-bold text-slate-400 bg-slate-100 rounded-full w-6 h-6 inline-flex items-center justify-center">{i + 1}</span>
                        )}
                      </div>
                      <Avatar src={photoMap[r.studentId] || r.studentPhoto} name={r.studentName} size={42} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate">{r.studentName}</p>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 truncate mt-0.5">
                          {r.eventName}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {r.districtName}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <p className={`text-xl font-extrabold tabular-nums ${i === 0 ? "text-amber-600" : "text-indigo-600"}`}>
                          {r.finalScore}
                        </p>
                        <span className={`text-[10px] font-bold border rounded uppercase px-1.5 py-0.5 ${gradeBadge(r.finalGrade)}`}>
                          {r.finalGrade}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Category breakdown ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {byCategory.map((cat) => (
                <div
                  key={cat.key}
                  className="bg-white border border-teal-100 shadow-sm rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      {cat.label}
                    </p>
                    <span className="text-xs text-slate-500 font-arabic">{cat.labelAr}</span>
                  </div>
                  <CountUp value={cat.count} className="text-3xl font-bold text-teal-700" />
                  {cat.best && (
                    <div className="flex items-center gap-2 pt-1 border-t border-teal-100">
                      <Avatar src={photoMap[cat.best.studentId] || cat.best.studentPhoto} name={cat.best.studentName} size={26} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-400 truncate">
                          {cat.best.studentName}
                        </p>
                        <p className={`text-xs font-bold ${gradeColor(cat.best.finalGrade)}`}>
                          {cat.best.finalScore} · {cat.best.finalGrade}
                        </p>
                      </div>
                    </div>
                  )}
                  {!cat.best && (
                    <p className="text-xs text-slate-400">No results yet</p>
                  )}
                </div>
              ))}
            </div>

            {/* ── All Published Results table ── */}
            <div className="bg-white border border-teal-100 shadow-sm rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-teal-100">
                <h2 className="font-semibold text-sm text-slate-400">
                  All Published Results ({results.length})
                </h2>
              </div>
              <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-teal-100 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Student</th>
                      <th className="px-4 py-3 text-left">Event</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">District</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Grade</th>
                      <th className="px-4 py-3 text-center">Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const isNew = newIds.has(r.id);
                      return (
                        <tr
                          key={r.id}
                          className={`border-b border-teal-100/50 transition-colors duration-300 ${
                            isNew
                              ? "entry-highlight"
                              : "hover:bg-teal-50/40"
                          }`}
                        >
                          <td className="px-4 py-3 text-slate-500 text-xs">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar
                                src={photoMap[r.studentId] || r.studentPhoto}
                                name={r.studentName}
                                size={32}
                              />
                              <span className="font-medium text-slate-800 truncate max-w-[140px]">
                                {r.studentName}
                              </span>
                              {isNew && (
                                <span className="text-xs bg-teal-500/20 text-teal-500 border border-teal-500/30 rounded px-1.5 py-0.5 font-semibold flex-shrink-0">
                                  NEW
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-sm">{r.eventName}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs border border-gray-700 rounded px-2 py-0.5 text-slate-600">
                              {CATEGORIES[r.category] ? CATEGORIES[r.category].label : ''}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-sm">{r.districtName}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xl font-bold text-slate-900 tabular-nums">
                              {r.finalScore}
                            </span>
                            <span className="text-slate-500 text-xs ml-1">/150</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-sm font-bold border rounded px-2 py-0.5 ${gradeBadge(r.finalGrade)}`}>
                              {r.finalGrade}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {r.position ? (
                              <span className="text-sm font-bold text-yellow-600">
                                #{r.position}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <footer className="border-t border-teal-100 mt-12 py-5 text-center text-xs text-slate-400">
        <p>DKJU Competition Live Board · Results update in real-time</p>
        <p className="mt-1 text-gray-800">Powered by DKJU · Kerala</p>
      </footer>
    </div>
  );
}
