"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Award,
  Check,
  ChevronDown,
  Clock3,
  Crown,
  Filter,
  Medal,
  Radio,
  School,
  Search,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {EmptyResults, 
    StatCard,
    GradeBadge, 
    GroupAvatars,
    publishedMillis ,
    getPublishedTime,
    normalizeText,
    getCategoryLabel,
    getResultStudentNames,
    getScore,
    normalizeGrade,
    getStudents,
    getStudentName,
     formatTime,
     StudentAvatar,
    TickerResults} from "@/components/competition"

import {
  subscribeToPublishedMekhalaMarks,
} from "@/lib/competitionService";






/* =========================================================
   MAIN PAGE
========================================================= */

export default function LiveScorePage() {
  const [
    results,
    setResults,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    selectedMekhala,
    setSelectedMekhala,
  ] = useState("all");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    mekhalaOpen,
    setMekhalaOpen,
  ] = useState(false);
const [
  recentWinnerPage,
  setRecentWinnerPage,
] = useState(0);

const RECENT_WINNERS_PER_PAGE = 4;


const tickerRef = useRef(null);
const tickerPausedRef = useRef(false);

const [
  recentVisible,
  setRecentVisible,
] = useState(false);

const [
  recentProgress,
  setRecentProgress,
] = useState(false);




  
  useEffect(() => {
    const unsubscribe =
      subscribeToPublishedMekhalaMarks(
        (data) => {
          const sorted =
            [...data].sort(
              (a, b) =>
                publishedMillis(b) -
                publishedMillis(a),
            );

          setResults(sorted);

          setLoading(false);

          setLoadError("");
        },

        (error) => {
          console.error(
            "Live scoreboard error:",
            error,
          );

          setResults([]);

          setLoading(false);

          setLoadError(
            "Unable to load live results.",
          );
        },
      );

    return () => {
      if (
        typeof unsubscribe ===
        "function"
      ) {
        unsubscribe();
      }
    };
  }, []);


  /* =====================================================
     MEKHALAS
  ===================================================== */

  const mekhalas =
    useMemo(() => {
      const map =
        new Map();

      results.forEach(
        (result) => {
          const id =
            result?.mekhalaId ||
            result?.mekhalaName;

          const name =
            result?.mekhalaName ||
            result?.mekhalaId;

          if (
            id &&
            name
          ) {
            map.set(
              id,
              {
                id,
                name,
              },
            );
          }
        },
      );

      return Array.from(
        map.values(),
      ).sort((a, b) =>
        a.name.localeCompare(
          b.name,
        ),
      );
    }, [results]);
useEffect(() => {
  setRecentVisible(false);
  setRecentProgress(false);

  const showTimer =
    window.setTimeout(
      () => {
        setRecentVisible(true);
      },
      60,
    );

  const progressTimer =
    window.setTimeout(
      () => {
        setRecentProgress(true);
      },
      100,
    );

  return () => {
    window.clearTimeout(
      showTimer,
    );

    window.clearTimeout(
      progressTimer,
    );
  };
}, [
  recentWinnerPage,
]);

  /* =====================================================
     FILTERED RESULTS
  ===================================================== */
useEffect(() => {
  const track =
    tickerRef.current;

  if (!track) {
    return;
  }

  let animationFrame;
  let position = 0;

  const speed = 0.45;

  const animate = () => {
    if (
      !tickerPausedRef.current
    ) {
      position -= speed;

      const halfWidth =
        track.scrollWidth / 2;

      if (
        Math.abs(position) >=
        halfWidth
      ) {
        position = 0;
      }

      track.style.transform =
        `translate3d(${position}px, 0, 0)`;
    }

    animationFrame =
      requestAnimationFrame(
        animate,
      );
  };

  animationFrame =
    requestAnimationFrame(
      animate,
    );

  return () => {
    cancelAnimationFrame(
      animationFrame,
    );
  };
}, [results]);



  const filteredResults =
    useMemo(() => {
      const queryText =
        normalizeText(
          search,
        );

      return results.filter(
        (result) => {
          const resultMekhala =
            result?.mekhalaId ||
            result?.mekhalaName;

          if (
            selectedMekhala !==
              "all" &&
            resultMekhala !==
              selectedMekhala
          ) {
            return false;
          }

          if (!queryText) {
            return true;
          }

          const studentNames =
            getResultStudentNames(
              result,
            );

          const haystack = [
            studentNames,
            result?.eventName,
            result?.itemName,
            result?.madarsaName,
            result?.madarsaId,
            result?.mekhalaName,
            result?.category,
            result?.grade,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(
            queryText,
          );
        },
      );
    }, [
      results,
      selectedMekhala,
      search,
    ]);

const recentPublished10 =
  useMemo(() => {
    return [...filteredResults]
      .sort(
        (a, b) =>
          publishedMillis(b) -
          publishedMillis(a),
      )
      .slice(0, 12);
  }, [filteredResults]);


const recentWinnerPageCount =
  Math.max(
    1,
    Math.ceil(
      recentPublished10.length /
        RECENT_WINNERS_PER_PAGE,
    ),
  );


const recentWinnerStart =
  recentWinnerPage *
  RECENT_WINNERS_PER_PAGE;


const visibleRecentWinners =
  recentPublished10.slice(
    recentWinnerStart,
    recentWinnerStart +
      RECENT_WINNERS_PER_PAGE,
  );


  useEffect(() => {
  if (
    recentWinnerPageCount <= 1
  ) {
    return;
  }

  const timer =
    window.setInterval(
      () => {
        setRecentWinnerPage(
          (previous) =>
            (previous + 1) %
            recentWinnerPageCount,
        );
      },
      4500,
    );

  return () =>
    window.clearInterval(timer);
}, [
  recentWinnerPageCount,
]);

useEffect(() => {
  setRecentWinnerPage(0);
}, [
  recentPublished10.length,
]);



  /* =====================================================
     STATS
  ===================================================== */

  const totalResults =
    filteredResults.length;


  const topScore =
    useMemo(() => {
      if (
        filteredResults.length ===
        0
      ) {
        return 0;
      }

      return Math.max(
        ...filteredResults.map(
          getScore,
        ),
      );
    }, [
      filteredResults,
    ]);


  const topGrade =
    useMemo(() => {
      const order = [
        "A+",
        "A",
        "B+",
        "B",
        "C",
      ];

      return (
        order.find(
          (grade) =>
            filteredResults.some(
              (result) =>
                normalizeGrade(
                  result?.grade,
                ) === grade,
            ),
        ) || "—"
      );
    }, [
      filteredResults,
    ]);


  /* =====================================================
     TOP CANDIDATES
  ===================================================== */

  const topCandidates =
    useMemo(() => {
      return [
        ...filteredResults,
      ]
        .sort(
          (a, b) =>
            getScore(b) -
            getScore(a),
        )
        .slice(0, 6);
    }, [
      filteredResults,
    ]);


  /* =====================================================
     RECENT RESULTS
  ===================================================== */

  const recentResults =
    useMemo(
      () =>
        filteredResults.slice(
          0,
          12,
        ),
      [filteredResults],
    );


  const recentWinners =
    useMemo(
      () =>
        [...filteredResults]
          .sort(
            (a, b) =>
              getScore(b) -
              getScore(a),
          )
          .slice(0, 4),
      [filteredResults],
    );


  /* =====================================================
     ACTIVE MEKHALA LABEL
  ===================================================== */

  const selectedMekhalaLabel =
    selectedMekhala === "all"
      ? "All Mekhalas"
      : mekhalas.find(
            (mekhala) =>
              mekhala.id ===
              selectedMekhala,
          )?.name ||
        "Mekhala";


  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <main
      className="
        min-h-screen
        bg-[#f4f7f8]
        text-slate-800
      "
    >
      {/* =================================================
          TOP HEADER
      ================================================== */}

      <header
        className="
          border-b
          border-teal-100
          bg-white
        "
      >
        <div
          className="
            mx-auto
            flex
            max-w-[1450px]
            items-center
            justify-between
            gap-4
            px-4
            py-3
            lg:px-6
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
                h-11
                w-11
                items-center
                justify-center
                rounded-full
                bg-teal-100
                text-teal-700
              "
            >
              <a href="/"><Trophy className="h-6 w-6" /></a>
            </div>

            <div>
              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-2
                "
              >
                <h1
                  className="
                    text-lg
                    font-bold
                    text-slate-900
                    md:text-xl
                  "
                >
                  DKJU Competition
                </h1>

                <span
                  className="
                    text-sm
                    font-semibold
                    text-teal-600
                  "
                >
                  التنافس
                </span>
              </div>

              <p
                className="
                  text-xs
                  text-slate-500
                "
              >
                Live Results Board
              </p>
            </div>
          </div>


          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <span
              className="
                inline-flex
                items-center
                gap-2
                rounded-full
                border
                border-red-200
                bg-red-50
                px-3
                py-1.5
                text-xs
                font-bold
                text-red-600
              "
            >
              <span
                className="
                  h-2
                  w-2
                  animate-pulse
                  rounded-full
                  bg-red-500
                "
              />

              LIVE
            </span>

            <span
              className="
                hidden
                rounded-md
                border
                border-teal-100
                bg-teal-50
                px-3
                py-1.5
                text-xs
                font-semibold
                text-teal-700
                sm:inline-flex
              "
            >
              {results.length} results
            </span>
          </div>
        </div>
      </header>


    

{/* =================================================
    RUNNING LATEST RESULTS
================================================== */}

<div
  className="
    relative
    overflow-hidden
    border-b
    border-teal-100
    bg-white
  "
>
  {/* FIXED LATEST */}

  <div
    className="
      absolute
      left-0
      top-0
      z-20
      flex
      h-full
      items-center
      border-r
      border-teal-100
      bg-white
      px-4
      shadow-[8px_0_15px_rgba(255,255,255,0.9)]
    "
  >
    <span
      className="
        flex
        items-center
        gap-1.5
        whitespace-nowrap
        text-xs
        font-bold
        uppercase
        text-teal-700
      "
    >
      <Sparkles className="h-3.5 w-3.5" />

      Latest
    </span>
  </div>


  {/* RUNNING CONTENT */}

  <div
    className="
      overflow-hidden
      pl-[95px]
    "
    onMouseEnter={() => {
      tickerPausedRef.current =
        true;
    }}
    onMouseLeave={() => {
      tickerPausedRef.current =
        false;
    }}
  >
    <div
      ref={tickerRef}
      className="
        flex
        w-max
        will-change-transform
      "
    >
      {/* COPY 1 */}

      <TickerResults
        results={results}
        prefix="ticker-a"
      />

      {/* COPY 2 */}

      <TickerResults
        results={results}
        prefix="ticker-b"
      />
    </div>
  </div>
</div>


      <div
        className="
          mx-auto
          max-w-[1450px]
          space-y-6
          px-4
          py-6
          lg:px-6
        "
      >
        {/* =================================================
            JOURNEY
        ================================================== */}

        <section
          className="
            rounded-2xl
            border
            border-teal-100
            bg-white
            p-5
            shadow-sm
          "
        >
          <p
            className="
              mb-4
              text-[11px]
              font-bold
              uppercase
              tracking-[0.18em]
              text-slate-500
            "
          >
            Competition Journey
          </p>

          <div
            className="
              flex
              flex-wrap
              items-center
              gap-2
            "
          >
            {[
              
              [
                "Mekhala",
                "Mark Entry",
              ],
              [
                "District",
                "Mark Entry",
              ],
              [
                "State",
                "Final Marks",
              ],
              [
                "Verification",
                "Verify & Publish",
              ],
              [
                "Live Score",
                "You are here",
              ],
            ].map(
              (
                item,
                index,
              ) => (
                <div
                  key={
                    item[0]
                  }
                  className="
                    flex
                    items-center
                    gap-2
                  "
                >
                  <div
                    className={`
                      min-w-[108px]
                      rounded-xl
                      border
                      px-3
                      py-3
                      text-center

                      ${
                        index ===
                        0
                          ? "border-teal-300 bg-teal-50"
                          : "border-slate-200 bg-slate-50"
                      }
                    `}
                  >
                    <Trophy
                      className={`
                        mx-auto
                        mb-1
                        h-4
                        w-4

                        ${
                          index ===
                         0
                            ? "text-teal-600"
                            : "text-slate-500"
                        }
                      `}
                    />

                    <p
                      className="
                        text-xs
                        font-bold
                        text-slate-700
                      "
                    >
                      {item[0]}
                    </p>

                    <p
                      className="
                        mt-0.5
                        text-[10px]
                        text-slate-500
                      "
                    >
                      {item[1]}
                    </p>
                  </div>

                  {index < 4 && (
                    <span
                      className="
                        font-bold
                        text-teal-400
                      "
                    >
                      →
                    </span>
                  )}
                </div>
              ),
            )}
          </div>
        </section>


        {/* =================================================
            FILTERS
        ================================================== */}

        <section
          className="
            relative
            z-30
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-4
            shadow-sm
          "
        >
          <div
            className="
              flex
              flex-col
              gap-3
              md:flex-row
              md:items-end
            "
          >
            {/* MEKHALA FILTER */}

            <div className="relative">
              <label
                className="
                  mb-1.5
                  block
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-wide
                  text-slate-500
                "
              >
                Mekhala
              </label>

              <button
                type="button"
                onClick={() =>
                  setMekhalaOpen(
                    (value) =>
                      !value,
                  )
                }
                className="
                  flex
                  h-10
                  w-full
                  min-w-[250px]
                  items-center
                  justify-between
                  gap-3
                  rounded-lg
                  border
                  border-teal-200
                  bg-white
                  px-3
                  text-sm
                  font-medium
                  text-slate-700
                  hover:bg-teal-50
                  md:w-[300px]
                "
              >
                <span
                  className="
                    flex
                    min-w-0
                    items-center
                    gap-2
                  "
                >
                  <School
                    className="
                      h-4
                      w-4
                      shrink-0
                      text-teal-600
                    "
                  />

                  <span className="truncate">
                    {selectedMekhalaLabel}
                  </span>
                </span>

                <ChevronDown className="h-4 w-4" />
              </button>

              {mekhalaOpen && (
                <div
                  className="
                    absolute
                    left-0
                    top-full
                    z-50
                    mt-2
                    max-h-[320px]
                    w-full
                    min-w-[300px]
                    overflow-y-auto
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    p-2
                    shadow-xl
                  "
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMekhala(
                        "all",
                      );

                      setMekhalaOpen(
                        false,
                      );
                    }}
                    className="
                      flex
                      w-full
                      items-center
                      justify-between
                      rounded-lg
                      px-3
                      py-2.5
                      text-left
                      text-sm
                      hover:bg-teal-50
                    "
                  >
                    <span>
                      All Mekhalas
                    </span>

                    {selectedMekhala ===
                      "all" && (
                      <Check className="h-4 w-4 text-teal-600" />
                    )}
                  </button>

                  {mekhalas.map(
                    (mekhala) => (
                      <button
                        type="button"
                        key={
                          mekhala.id
                        }
                        onClick={() => {
                          setSelectedMekhala(
                            mekhala.id,
                          );

                          setMekhalaOpen(
                            false,
                          );
                        }}
                        className="
                          flex
                          w-full
                          items-center
                          justify-between
                          rounded-lg
                          px-3
                          py-2.5
                          text-left
                          text-sm
                          hover:bg-teal-50
                        "
                      >
                        <span>
                          {mekhala.name}
                        </span>

                        {selectedMekhala ===
                          mekhala.id && (
                          <Check className="h-4 w-4 text-teal-600" />
                        )}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>


            {/* SEARCH */}

            <div
              className="
                min-w-[220px]
                flex-1
              "
            >
              <label
                className="
                  mb-1.5
                  block
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-wide
                  text-slate-500
                "
              >
                Search
              </label>

              <div className="relative">
                <Search
                  className="
                    absolute
                    left-3
                    top-1/2
                    h-4
                    w-4
                    -translate-y-1/2
                    text-slate-400
                  "
                />

                <input
                  value={search}
                  onChange={(
                    event,
                  ) =>
                    setSearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search student, madrasa or item..."
                  className="
                    h-10
                    w-full
                    rounded-lg
                    border
                    border-slate-200
                    bg-white
                    pl-9
                    pr-10
                    text-sm
                    outline-none
                    transition
                    focus:border-teal-400
                    focus:ring-2
                    focus:ring-teal-100
                  "
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      text-slate-400
                      hover:text-red-500
                    "
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>


            {(selectedMekhala !==
              "all" ||
              search) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMekhala(
                    "all",
                  );

                  setSearch("");
                }}
                className="
                  flex
                  h-10
                  items-center
                  gap-2
                  rounded-lg
                  px-3
                  text-sm
                  font-semibold
                  text-slate-500
                  hover:bg-red-50
                  hover:text-red-600
                "
              >
                <Filter className="h-4 w-4" />

                Clear
              </button>
            )}
          </div>
        </section>


        {/* =================================================
            SUMMARY CARDS
        ================================================== */}

        <section
          className="
            grid
            grid-cols-1
            gap-4
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          <StatCard
            title="Total Results"
            value={totalResults}
            icon={Trophy}
            type="blue"
          />

          <StatCard
            title="Mekhalas"
            value={
              selectedMekhala ===
              "all"
                ? mekhalas.length
                : 1
            }
            icon={School}
            type="green"
          />

          <StatCard
            title="Top Score"
            value={topScore}
            icon={Crown}
            type="orange"
          />

          <StatCard
            title="Top Grade"
            value={topGrade}
            icon={Medal}
            type="pink"
          />
        </section>


        {/* =================================================
            LOADING / ERROR
        ================================================== */}

        {loading && (
          <div
            className="
              rounded-2xl
              border
              bg-white
              py-16
              text-center
              text-sm
              text-slate-500
            "
          >
            Loading live results...
          </div>
        )}

        {!loading &&
          loadError && (
            <div
              className="
                rounded-2xl
                border
                border-red-200
                bg-red-50
                px-5
                py-10
                text-center
                text-sm
                font-medium
                text-red-600
              "
            >
              {loadError}
            </div>
          )}


        {!loading &&
          !loadError && (
            <section
              className="
                grid
                grid-cols-1
                gap-5
                xl:grid-cols-[minmax(0,1fr)_370px]
              "
            >
              {/* =========================================
                  LEFT SIDE
              ========================================== */}

              <div className="space-y-5">
               


{/* =================================================
    RECENT PUBLISHED WINNERS
================================================== */}

<section
  className="
    relative
    overflow-hidden
    rounded-[24px]
    border
    border-amber-100
    bg-white
    p-5
    shadow-[0_10px_35px_rgba(15,80,65,0.08)]
  "
>
  {/* HEADER */}

  <div
    className="
      mb-5
      flex
      flex-wrap
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
          h-10
          w-10
          items-center
          justify-center
          rounded-xl
          bg-amber-500
          text-white
          shadow-md
        "
      >
        <Trophy className="h-5 w-5" />
      </div>

      <div>
        <h2
          className="
            text-base
            font-bold
            text-slate-900
            sm:text-lg
          "
        >
          Recent Published Winners
        </h2>

        <p
          className="
            mt-0.5
            text-[10px]
            text-slate-400
          "
        >
          Latest 10 verified competition results
        </p>
      </div>
    </div>


    <div
      className="
        flex
        items-center
        gap-2
        rounded-full
        border
        border-emerald-100
        bg-emerald-50
        px-3
        py-1.5
        text-[10px]
        font-bold
        text-emerald-700
      "
    >
      <span
        className="
          h-2
          w-2
          animate-pulse
          rounded-full
          bg-emerald-500
        "
      />

      AUTO LIVE
    </div>
  </div>


  {/* CARDS */}

  <div
    className="
      grid
      grid-cols-1
      gap-4
      sm:grid-cols-2
      xl:grid-cols-4
    "
  >
    {visibleRecentWinners.map(
      (result, index) => {
        const students =
          getStudents(result);

        const delays = [
          "delay-0",
          "delay-100",
          "delay-200",
          "delay-300",
        ];

        return (
          <article
            key={`${recentWinnerPage}-${result.id}`}
            className={`
              group
              relative
              flex
              min-h-[320px]
              flex-col
              overflow-hidden
              rounded-[20px]
              border
              border-slate-200
              bg-white
              p-4
              shadow-[0_7px_24px_rgba(15,23,42,0.06)]
              transition-all
              duration-700
              ease-out
              hover:-translate-y-1
              hover:border-amber-200
              hover:shadow-[0_18px_38px_rgba(15,80,65,0.12)]

              ${delays[index] || ""}

              ${
                recentVisible
                  ? "translate-y-0 scale-100 opacity-100"
                  : "translate-y-8 scale-95 opacity-0"
              }
            `}
          >
            {/* TOP ACCENT */}

            <div
              className="
                absolute
                left-0
                right-0
                top-0
                h-[3px]
                bg-gradient-to-r
                from-amber-400
                via-yellow-300
                to-teal-500
              "
            />


            {/* NUMBER */}

            <span
              className="
                absolute
                right-3
                top-3
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-full
                bg-amber-50
                text-[10px]
                font-bold
                text-amber-700
              "
            >
              {recentWinnerStart +
                index +
                1}
            </span>


            {/* =====================================
                PROFILE IMAGES
            ====================================== */}

            <div
              className={`
                mt-4
                flex
                min-h-[68px]
                items-center
                justify-center
                transition-all
                duration-700
                delay-150
                ease-out

                ${
                  recentVisible
                    ? "translate-y-0 scale-100 opacity-100"
                    : "-translate-y-5 scale-75 opacity-0"
                }
              `}
            >
              {students.length >
              0 ? (
                <div
                  className="
                    flex
                    items-center
                    justify-center
                    -space-x-3
                  "
                >
                  {students
                    .slice(0, 4)
                    .map(
                      (
                        student,
                        studentIndex,
                      ) => (
                        <div
                          key={
                            student?.id ||
                            student
                              ?.studentId ||
                            studentIndex
                          }
                          className="
                            rounded-full
                            border-[3px]
                            border-white
                            shadow-lg
                            transition-transform
                            duration-300
                            group-hover:-translate-y-1
                          "
                        >
                          <StudentAvatar
                            student={
                              student
                            }
                            size="lg"
                          />
                        </div>
                      ),
                    )}

                  {students.length >
                    4 && (
                    <div
                      className="
                        relative
                        z-10
                        flex
                        h-12
                        w-12
                        items-center
                        justify-center
                        rounded-full
                        border-[3px]
                        border-white
                        bg-teal-50
                        text-[10px]
                        font-bold
                        text-teal-700
                        shadow-lg
                      "
                    >
                      +
                      {students.length -
                        4}
                    </div>
                  )}
                </div>
              ) : (
                <StudentAvatar
                  student={{
                    name:
                      result.studentName ||
                      "Student",

                    profilePicture:
                      result.profilePictureUrl ||
                      result.profilePicture ||
                      "",
                  }}
                  size="lg"
                />
              )}
            </div>


            {/* =====================================
                STUDENT NAMES
            ====================================== */}

            <div
              className={`
                mt-3
                min-h-[55px]
                text-center
                transition-all
                duration-700
                delay-300
                ease-out

                ${
                  recentVisible
                    ? "translate-x-0 opacity-100"
                    : "-translate-x-5 opacity-0"
                }
              `}
            >
              {students.length >
              0 ? (
                students.map(
                  (
                    student,
                    studentIndex,
                  ) => (
                    <p
                      key={
                        student?.id ||
                        student
                          ?.studentId ||
                        studentIndex
                      }
                      className="
                        whitespace-normal
                        break-words
                        text-[12px]
                        font-bold
                        leading-[17px]
                        text-slate-900
                      "
                    >
                      {getStudentName(
                        student,
                      )}
                    </p>
                  ),
                )
              ) : (
                <p
                  className="
                    whitespace-normal
                    break-words
                    text-[12px]
                    font-bold
                    leading-[17px]
                    text-slate-900
                  "
                >
                  {getResultStudentNames(
                    result,
                  )}
                </p>
              )}
            </div>


            {/* ITEM */}

            <div
              className={`
                mt-3
                flex
                justify-center
                transition-all
                duration-700
                delay-500

                ${
                  recentVisible
                    ? "scale-100 opacity-100"
                    : "scale-75 opacity-0"
                }
              `}
            >
              <span
                className="
                  inline-flex
                  max-w-full
                  rounded-full
                  border
                  border-teal-100
                  bg-teal-50
                  px-3
                  py-1
                  text-center
                  text-[9px]
                  font-semibold
                  text-teal-700
                "
              >
                {result.eventName ||
                  result.itemName ||
                  "Competition"}
              </span>
            </div>


            {/* SCORE + GRADE */}

            <div
              className={`
                mt-auto
                flex
                items-end
                justify-between
                gap-3
                pt-5
                transition-all
                duration-700
                delay-500

                ${
                  recentVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-5 opacity-0"
                }
              `}
            >
              <div>
                <p
                  className="
                    text-[8px]
                    font-bold
                    uppercase
                    tracking-[0.15em]
                    text-slate-400
                  "
                >
                  Score
                </p>

                <div
                  className="
                    mt-1
                    flex
                    items-baseline
                    gap-1
                  "
                >
                  <span
                    className="
                      text-2xl
                      font-black
                      text-teal-600
                    "
                  >
                    {getScore(
                      result,
                    )}
                  </span>

                  <span
                    className="
                      text-[9px]
                      font-semibold
                      text-teal-500
                    "
                  >
                    pts
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p
                  className="
                    mb-1
                    text-[8px]
                    font-bold
                    uppercase
                    text-slate-400
                  "
                >
                  Grade
                </p>

                <GradeBadge
                  grade={
                    result.grade
                  }
                />
              </div>
            </div>


            {/* FOOTER */}

            <div
              className="
                mt-4
                flex
                items-end
                justify-between
                gap-3
                border-t
                border-slate-100
                pt-3
              "
            >
              <div className="min-w-0">
                <p
                  className="
                    truncate
                    text-[9px]
                    font-bold
                    uppercase
                    tracking-wide
                    text-teal-600
                  "
                >
                  {result.mekhalaName ||
                    "Mekhala"}
                </p>

                <p
                  className="
                    mt-1
                    truncate
                    text-[9px]
                    text-slate-400
                  "
                >
                  {result.madarsaName ||
                    result.madarsaId ||
                    ""}
                </p>
              </div>

              <Trophy
                className="
                  h-5
                  w-5
                  shrink-0
                  text-amber-500
                  transition-all
                  duration-300
                  group-hover:-rotate-12
                  group-hover:scale-125
                "
              />
            </div>
          </article>
        );
      },
    )}
  </div>


  {/* DOTS */}

  {recentWinnerPageCount >
    1 && (
    <div
      className="
        mt-5
        flex
        justify-center
        gap-2
      "
    >
      {Array.from({
        length:
          recentWinnerPageCount,
      }).map(
        (_, index) => (
          <span
            key={index}
            className={`
              h-2
              rounded-full
              transition-all
              duration-500

              ${
                recentWinnerPage ===
                index
                  ? "w-7 bg-teal-600"
                  : "w-2 bg-slate-200"
              }
            `}
          />
        ),
      )}
    </div>
  )}


  {/* AUTO PROGRESS */}

  <div
    className="
      mx-auto
      mt-3
      h-[2px]
      w-[180px]
      overflow-hidden
      rounded-full
      bg-slate-100
    "
  >
    <div
      className={`
        h-full
        bg-gradient-to-r
        from-amber-400
        to-teal-500
        transition-[width]
        duration-[4400ms]
        ease-linear

        ${
          recentProgress
            ? "w-full"
            : "w-0"
        }
      `}
    />
  </div>
</section>
                <div
                  className="
                    overflow-hidden
                    rounded-2xl
                    border
                    border-slate-200
                    bg-white
                    shadow-sm
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      border-b
                      border-slate-100
                      px-5
                      py-4
                    "
                  >
                    <div
                      className="
                        flex
                        items-center
                        gap-2
                      "
                    >
                      <Award className="h-5 w-5 text-teal-600" />

                      <h2
                        className="
                          font-bold
                          text-slate-900
                        "
                      >
                        Latest Published Results
                      </h2>
                    </div>

                    <span
                      className="
                        flex
                        items-center
                        gap-2
                        text-[10px]
                        font-medium
                        text-slate-500
                      "
                    >
                      <span
                        className="
                          h-2
                          w-2
                          animate-pulse
                          rounded-full
                          bg-teal-500
                        "
                      />

                      Auto-refreshing
                    </span>
                  </div>


                  <div className="overflow-x-auto">
                    <table
                      className="
                        w-full
                        min-w-[900px]
                        border-collapse
                      "
                    >
                      <thead>
                        <tr
                          className="
                            bg-teal-50/70
                            text-left
                            text-[10px]
                            uppercase
                            tracking-wide
                            text-slate-500
                          "
                        >
                          <th className="px-4 py-3">
                            #
                          </th>

                          <th className="px-4 py-3">
                            Student
                          </th>

                          <th className="px-4 py-3">
                            Item
                          </th>

                          <th className="px-4 py-3">
                            Category
                          </th>

                          <th className="px-4 py-3">
                            Madrasa
                          </th>

                          <th className="px-4 py-3">
                            Mekhala
                          </th>

                          <th className="px-4 py-3 text-center">
                            Score
                          </th>

                          <th className="px-4 py-3 text-center">
                            Grade
                          </th>

                          <th className="px-4 py-3">
                            Time
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {recentResults.map(
                          (
                            result,
                            index,
                          ) => (
                            <tr
                              key={
                                result.id
                              }
                              className="
                                border-t
                                border-slate-100
                                text-sm
                                transition
                                hover:bg-teal-50/30
                              "
                            >
                              <td
                                className="
                                  px-4
                                  py-3
                                  text-xs
                                  text-slate-400
                                "
                              >
                                {index +
                                  1}
                              </td>

                              <td className="px-4 py-3">
                                <div
                                  className="
                                    flex
                                    items-center
                                    gap-3
                                  "
                                >
                                  <GroupAvatars
                                    result={
                                      result
                                    }
                                  />

                                  <div className="min-w-0">
                                    {getStudents(
                                      result,
                                    ).length >
                                    0 ? (
                                      getStudents(
                                        result,
                                      ).map(
                                        (
                                          student,
                                          studentIndex,
                                        ) => (
                                          <p
                                            key={
                                              student?.id ||
                                              student?.studentId ||
                                              studentIndex
                                            }
                                            className="
                                              whitespace-normal
                                              text-xs
                                              font-semibold
                                              leading-5
                                              text-slate-800
                                            "
                                          >
                                            {getStudentName(
                                              student,
                                            )}
                                          </p>
                                        ),
                                      )
                                    ) : (
                                      <p
                                        className="
                                          font-semibold
                                          text-slate-800
                                        "
                                      >
                                        {getResultStudentNames(
                                          result,
                                        )}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td
                                className="
                                  px-4
                                  py-3
                                  font-medium
                                  text-slate-700
                                "
                              >
                                {result.eventName ||
                                  result.itemName ||
                                  "—"}
                              </td>

                              <td className="px-4 py-3">
                                <span
                                  className="
                                    rounded-full
                                    bg-slate-100
                                    px-2.5
                                    py-1
                                    text-[10px]
                                    font-semibold
                                    text-slate-600
                                  "
                                >
                                  {getCategoryLabel(
                                    result.category,
                                  )}
                                </span>
                              </td>

                              <td className="px-4 py-3">
                                <p
                                  className="
                                    text-xs
                                    font-semibold
                                    text-slate-700
                                  "
                                >
                                  {result.madarsaName ||
                                    "—"}
                                </p>

                                {result.madarsaId && (
                                  <p
                                    className="
                                      mt-0.5
                                      text-[10px]
                                      text-slate-400
                                    "
                                  >
                                    {
                                      result.madarsaId
                                    }
                                  </p>
                                )}
                              </td>

                              <td
                                className="
                                  px-4
                                  py-3
                                  text-xs
                                  text-slate-600
                                "
                              >
                                {result.mekhalaName ||
                                  "—"}
                              </td>

                              <td
                                className="
                                  px-4
                                  py-3
                                  text-center
                                  text-base
                                  font-bold
                                  text-teal-600
                                "
                              >
                                {getScore(
                                  result,
                                )}
                              </td>

                              <td className="px-4 py-3 text-center">
                                <GradeBadge
                                  grade={
                                    result.grade
                                  }
                                />
                              </td>

                              <td
                                className="
                                  px-4
                                  py-3
                                  text-xs
                                  text-slate-400
                                "
                              >
                                <div
                                  className="
                                    flex
                                    items-center
                                    gap-1
                                  "
                                >
                                  <Clock3 className="h-3 w-3" />

                                  {formatTime(
                                    getPublishedTime(
                                      result,
                                    ),
                                  )}
                                </div>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>


                  {recentResults.length ===
                    0 && (
                    <EmptyResults />
                  )}
                </div>


                {/* RECENT WINNERS */}

                
              </div>


              {/* =========================================
                  RIGHT SIDE — TOP CANDIDATES
              ========================================== */}

              <aside
                className="
                  h-fit
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  p-5
                  shadow-sm
                "
              >
                <div
                  className="
                    mb-4
                    flex
                    items-center
                    gap-2
                    border-b
                    border-slate-100
                    pb-4
                  "
                >
                  <Crown className="h-5 w-5 text-amber-500" />

                  <h2
                    className="
                      font-bold
                      text-slate-900
                    "
                  >
                    Top Candidates
                  </h2>
                </div>


                <div className="space-y-3">
                  {topCandidates.map(
                    (
                      result,
                      index,
                    ) => (
                      <div
                        key={
                          result.id
                        }
                        className={`
                          rounded-xl
                          border
                          p-3

                          ${
                            index === 0
                              ? "border-amber-300 bg-amber-50/70"
                              : index === 1
                              ? "border-slate-300 bg-slate-50"
                              : index === 2
                              ? "border-orange-200 bg-orange-50/50"
                              : "border-slate-200 bg-white"
                          }
                        `}
                      >
                        <div
                          className="
                            flex
                            items-center
                            gap-3
                          "
                        >
                          <div
                            className={`
                              flex
                              h-7
                              w-7
                              shrink-0
                              items-center
                              justify-center
                              rounded-full
                              text-xs
                              font-bold

                              ${
                                index ===
                                0
                                  ? "bg-amber-500 text-white"
                                  : index ===
                                    1
                                  ? "bg-slate-200 text-slate-700"
                                  : index ===
                                    2
                                  ? "bg-orange-200 text-orange-700"
                                  : "bg-slate-100 text-slate-500"
                              }
                            `}
                          >
                            {index +
                              1}
                          </div>

                          <GroupAvatars
                            result={
                              result
                            }
                          />

                          <div
                            className="
                              min-w-0
                              flex-1
                            "
                          >
                            <p
                              className="
                                whitespace-normal
                                break-words
                                text-sm
                                font-bold
                                leading-5
                                text-slate-900
                              "
                            >
                              {getResultStudentNames(
                                result,
                              )}
                            </p>

                            <p
                              className="
                                mt-0.5
                                text-[10px]
                                uppercase
                                tracking-wide
                                text-slate-500
                              "
                            >
                              {result.eventName ||
                                "Competition"}
                            </p>

                            <p
                              className="
                                mt-0.5
                                truncate
                                text-[10px]
                                text-slate-400
                              "
                            >
                              {result.mekhalaName ||
                                result.madarsaName ||
                                ""}
                            </p>
                          </div>

                          <div className="text-right">
                            <p
                              className="
                                text-xl
                                font-bold
                                text-teal-600
                              "
                            >
                              {getScore(
                                result,
                              )}
                            </p>

                            <div className="mt-1">
                              <GradeBadge
                                grade={
                                  result.grade
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ),
                  )}


                  {topCandidates.length ===
                    0 && (
                    <p
                      className="
                        py-10
                        text-center
                        text-sm
                        text-slate-400
                      "
                    >
                      No candidates found.
                    </p>
                  )}
                </div>
              </aside>
            </section>
          )}


        {/* =================================================
            FOOTER STATUS
        ================================================== */}

        <div
          className="
            flex
            flex-wrap
            items-center
            justify-between
            gap-3
            border-t
            border-slate-200
            py-5
            text-xs
            text-slate-500
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <Radio
              className="
                h-4
                w-4
                animate-pulse
                text-teal-600
              "
            />

            Live Auto Update
          </div>

          <div>
            {selectedMekhala ===
            "all"
              ? `Showing all ${mekhalas.length} Mekhalas`
              : `Showing ${selectedMekhalaLabel}`}
          </div>

          <div>
            DKJU Competition •
            Live Results Board
          </div>
        </div>
        
      </div>
    </main>
  );
}


