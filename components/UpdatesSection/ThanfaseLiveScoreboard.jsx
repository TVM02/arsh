"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  Crown,
  Radio,
  School,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import {
  subscribeToPublishedMekhalaMarks,
} from "@/lib/competitionService";
/* =========================================================
   SETTINGS
========================================================= */

const CARDS_PER_PAGE = 5;

const WINNERS_PER_CARD = 5;

// Change 5 winner rows every 3.2 seconds
const WINNER_BATCH_TIME = 3200;

// Change to next 5 Mekhalas after all 3 batches
const MEKHALA_GROUP_TIME = 10500;

/* =========================================================
   DEMO DATA

   Later replace this with Firebase data.
========================================================= */

function buildMekhalaScoreboard(
  marks,
) {
  const mekhalaMap =
    new Map();

  marks.forEach(
    (mark) => {
      /* =====================================
         HOME PAGE
         ONLY PUBLISHED A GRADE RESULTS
      ====================================== */

      const grade = String(
        mark?.grade || "",
      )
        .trim()
        .toUpperCase();

      if (grade !== "A") {
        return;
      }


      const mekhalaId =
        mark?.mekhalaId ||
        mark?.mekhalaName;

      if (!mekhalaId) {
        return;
      }


      const mekhalaName =
        mark?.mekhalaName ||
        "Mekhala";


      if (
        !mekhalaMap.has(
          mekhalaId,
        )
      ) {
        mekhalaMap.set(
          mekhalaId,
          {
            id: mekhalaId,
            name: mekhalaName,

            madrasas:
              new Set(),

            winners:
              new Map(),
          },
        );
      }

      const mekhala =
        mekhalaMap.get(
          mekhalaId,
        );


      if (mark?.madarsaId) {
        mekhala.madrasas.add(
          mark.madarsaId,
        );
      }


      const eventName =
        mark?.eventName ||
        "Competition Item";

      const category =
        mark?.category ||
        "General";

      const key =
        `${
          mark?.eventId ||
          eventName
        }__${category}`;


      const studentName =
        Array.isArray(
          mark?.students,
        ) &&
        mark.students.length > 0
          ? mark.students
              .map(
                (student) =>
                  student?.name,
              )
              .filter(Boolean)
              .join(", ")
          : mark?.studentName ||
            "Student";


      const score =
        Number(
          mark?.total ??
            mark?.finalScore ??
            0,
        ) || 0;


      const existing =
        mekhala.winners.get(
          key,
        );


      if (
        !existing ||
        score >
          existing.score
      ) {
        mekhala.winners.set(
          key,
          {
            id: mark.id,

            item:
              eventName,

            category,

            student:
              studentName,

            students:
              mark?.students ||
              [],

            madarsaId:
              mark?.madarsaId ||
              "",

            madarsaName:
              mark?.madarsaName ||
              "",

            score,

            grade:
              grade,
          },
        );
      }
    },
  );


  return Array.from(
    mekhalaMap.values(),
  )
    .map(
      (mekhala) => ({
        id:
          mekhala.id,

        name:
          mekhala.name,

        madrasas:
          mekhala.madrasas.size,

        winners:
          Array.from(
            mekhala.winners.values(),
          ),
      }),
    )
    .filter(
      (mekhala) =>
        mekhala.winners.length >
        0,
    )
    .sort((a, b) =>
      a.name.localeCompare(
        b.name,
      ),
    );
}

/* =========================================================
   CATEGORY STYLE
========================================================= */

function getCategoryClass(category) {
  switch (category) {
    case "subJunior":
      return "bg-emerald-50 text-emerald-700";

    case "junior":
      return "bg-amber-50 text-amber-700";

    case "senior":
      return "bg-blue-50 text-blue-700";

    case "higher":
      return "bg-violet-50 text-violet-700";

    default:
      return "bg-slate-50 text-slate-600";
  }
}


/* =========================================================
   MEKHALA CARD
========================================================= */

function MekhalaCard({
  mekhala,
  index,
  cardNumber,
}) {
  const [
    winnerPage,
    setWinnerPage,
  ] = useState(0);

  const winnerPageCount =
    Math.max(
      1,
      Math.ceil(
        mekhala.winners.length /
          WINNERS_PER_CARD,
      ),
    );


  /* =========================================
     RESET WHEN MEKHALA CHANGES
  ========================================= */

  useEffect(() => {
    setWinnerPage(0);
  }, [mekhala.id]);


  /* =========================================
     AUTO WINNER ROTATION
  ========================================= */

  useEffect(() => {
    if (
      winnerPageCount <= 1
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          setWinnerPage(
            (previous) =>
              (previous + 1) %
              winnerPageCount,
          );
        },
        WINNER_BATCH_TIME,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [
    mekhala.id,
    winnerPageCount,
  ]);


  /* =========================================
     CURRENT 5 WINNERS
  ========================================= */

  const startIndex =
    winnerPage *
    WINNERS_PER_CARD;

  const visibleWinners =
    mekhala.winners.slice(
      startIndex,
      startIndex +
        WINNERS_PER_CARD,
    );


  return (
      <Link
    href="/mekala-live-score"
    className="
      block
      h-full
      focus:outline-none
    "
    aria-label={`View live score for ${mekhala.name}`}
  >
    <article
  className="
    mekhala-score-card
    group
    relative
    mx-auto
    flex
    h-[470px]
    w-full
    min-w-0
    max-w-[340px]
    flex-col
    overflow-hidden
    rounded-[22px]
    border
    border-[#d2b059]
    bg-[#fffdf8]
    shadow-[0_14px_40px_rgba(16,72,59,0.10)]
    transition-all
    duration-500
    hover:-translate-y-1
    hover:shadow-[0_24px_55px_rgba(16,72,59,0.16)]
  "
  style={{
    animationDelay:
      `${index * 120}ms`,
  }}
>
      {/* =====================================
          INNER GOLD BORDER
      ====================================== */}

      <div
        className="
          pointer-events-none
          absolute
          inset-[5px]
          z-20
          rounded-[19px]
          border
          border-[#ebd89e]/40
        "
      />




     


      {/* =====================================
          MEKHALA HEADER
      ====================================== */}

      <div
        className="
          relative
          shrink-0
          overflow-hidden
          bg-gradient-to-br
          from-[#063f36]
          via-[#075549]
          to-[#0b6b59]
          px-5
          pb-5
          pt-8
          text-white
        "
      >
        <div
          className="
            pointer-events-none
            absolute
            -right-12
            -top-12
            h-32
            w-32
            rounded-full
            bg-[#d7b651]/15
            blur-2xl
          "
        />


        <div className="relative z-10">
          <div
            className="
              mb-3
              flex
              h-5
              w-10
              items-center
              justify-center
              rounded-xl
              border
              border-[#e5c66b]/50
              bg-white/10
              text-[#f2d37a]
            "
          >
            <School className="h-5 w-5" />
          </div>


          <h3
            className="
              min-h-[48px]
              font-serif
              text-xl
              font-bold
              leading-tight
              text-[#fff7df]
            "
          >
            {mekhala.name}
          </h3>


          
        </div>
      </div>


      {/* =====================================
          TABLE HEADER
      ====================================== */}

      <div
        className="
          grid
          shrink-0
          grid-cols-[minmax(0,1fr)_minmax(0,.9fr)_minmax(0,1.1fr)]
          border-b
          border-[#e4dbc4]
          bg-[#f4f0e4]
          px-3
          py-2.5
          text-[9px]
          font-bold
          uppercase
          tracking-wide
          text-[#476057]
        "
      >
        <span>
          Item
        </span>

        <span>
          Category
        </span>

        <span>
          First Prize
        </span>
      </div>


      {/* =====================================
          5 WINNERS AUTO SLIDER
      ====================================== */}

      <div
        className="
          relative
          h-[230px]
          shrink-0
          overflow-hidden
        "
      >
        <div
          key={`${mekhala.id}-${winnerPage}`}
          className="
            winner-batch
            absolute
            inset-0
          "
        >
          {visibleWinners.map(
            (
              winner,
              winnerIndex,
            ) => (
              <div
                key={`${winner.item}-${winnerPage}-${winnerIndex}`}
                className="
                  winner-row
                  grid
                  h-[46px]
                  grid-cols-[minmax(0,1fr)_minmax(0,.9fr)_minmax(0,1.1fr)]
                  items-center
                  border-b
                  border-[#eee9dc]
                  px-3
                  transition-colors
                  duration-300
                  last:border-b-0
                  hover:bg-[#f7f4e9]
                "
                style={{
                  animationDelay:
                    `${
                      winnerIndex *
                      80
                    }ms`,
                }}
              >
                {/* ITEM */}

                <p
                  className="
                    truncate
                    pr-1
                    text-[11px]
                    font-semibold
                    text-[#233d35]
                  "
                >
                  {winner.item}
                </p>


                {/* CATEGORY */}

                <div
                  className="
                    min-w-0
                    pr-1
                  "
                >
                  <span
                    className={`
                      inline-flex
                      max-w-full
                      truncate
                      rounded-full
                      px-2
                      py-1
                      text-[8px]
                      font-semibold

                      ${getCategoryClass(
                        winner.category,
                      )}
                    `}
                  >{winner.category === "subJunior"
  ? "Sub Junior"
  : winner.category === "junior"
  ? "Junior"
  : winner.category === "senior"
  ? "Senior"
  : winner.category === "higher"
  ? "Higher"
  : winner.category}
                    
                  </span>
                </div>


                {/* WINNER */}

                <div
                  className="
                    flex
                    min-w-0
                    items-center
                    gap-1.5
                  "
                >
                  <Crown
                    className="
                      h-3
                      w-3
                      shrink-0
                      text-[#bf8b24]
                    "
                  />

                <div className="min-w-0">
  <p
    className="
      truncate
      text-[11px]
      font-bold
      text-[#153d34]
    "
  >
    {winner.student}
  </p>

  <p
    className="
      mt-0.5
      truncate
      text-[8px]
      text-[#7d8984]
    "
  >
    {winner.madarsaId ||
      ""}
  </p>
</div>
                </div>
              </div>
            ),
          )}


          {/* EMPTY ROWS SO CARD ALWAYS SAME HEIGHT */}

          {Array.from({
            length:
              WINNERS_PER_CARD -
              visibleWinners.length,
          }).map(
            (_, emptyIndex) => (
              <div
                key={`empty-${emptyIndex}`}
                className="
                  h-[46px]
                  border-b
                  border-[#eee9dc]/60
                "
              />
            ),
          )}
        </div>
      </div>


      {/* =====================================
          CARD FOOTER
      ====================================== */}

      <div
        className="
          mt-auto
          shrink-0
          border-t
          border-[#eadfbe]
          bg-gradient-to-r
          from-[#faf5e4]
          via-[#fffdf6]
          to-[#f7eed5]
          px-4
          py-3
        "
      >
        <div
          className="
            flex
            items-center
            justify-between
            gap-3
          "
        >
          <div>
            <p
              className="
                text-[9px]
                font-semibold
                uppercase
                tracking-[0.18em]
                text-[#917333]
              "
            >
              First Prize Winners
            </p>

            <p
              className="
                mt-1
                text-[9px]
                text-[#8a8e83]
              "
            >
              Showing{" "}
              {startIndex + 1}
              –
              {Math.min(
                startIndex +
                  WINNERS_PER_CARD,
                mekhala.winners
                  .length,
              )}{" "}
              of{" "}
              {
                mekhala.winners
                  .length
              }
            </p>
          </div>


          <Trophy
            className="
              h-4
              w-4
              text-[#b88622]
            "
          />
        </div>


        {/* WINNER BATCH DOTS */}

        <div
          className="
            mt-2
            flex
            gap-1.5
          "
        >
          {Array.from({
            length:
              winnerPageCount,
          }).map(
            (_, dotIndex) => (
              <span
                key={
                  dotIndex
                }
                className={`
                  h-1.5
                  rounded-full
                  transition-all
                  duration-500

                  ${
                    winnerPage ===
                    dotIndex
                      ? "w-5 bg-[#075447]"
                      : "w-1.5 bg-[#d4c8a7]"
                  }
                `}
              />
            ),
          )}
        </div>
      </div>
      
    </article>
    </Link>
  );
}


/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function ThanfaseLiveScoreboard() {
  const [
    publishedMarks,
    setPublishedMarks,
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
    pageIndex,
    setPageIndex,
  ] = useState(0);


  /* =========================================
     LIVE PUBLISHED RESULTS
  ========================================= */

  useEffect(() => {
    const unsubscribe =
      subscribeToPublishedMekhalaMarks(
        (data) => {
          setPublishedMarks(
            Array.isArray(data)
              ? data
              : [],
          );

          setLoading(false);
          setLoadError("");
        },

        (error) => {
          console.error(
            "Live Mekhala result error:",
            error,
          );

          setPublishedMarks([]);
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


  /* =========================================
     BUILD MEKHALA DATA
     Must be declared BEFORE totalPages.
  ========================================= */

  const mekhalaData =
    useMemo(
      () =>
        buildMekhalaScoreboard(
          publishedMarks,
        ),
      [publishedMarks],
    );


  /* =========================================
     TOTAL PAGES
  ========================================= */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        mekhalaData.length /
          CARDS_PER_PAGE,
      ),
    );


  /* =========================================
     KEEP PAGE INDEX VALID
  ========================================= */

  useEffect(() => {
    if (
      pageIndex >=
      totalPages
    ) {
      setPageIndex(0);
    }
  }, [
    pageIndex,
    totalPages,
  ]);


  /* =========================================
     CURRENT 5 MEKHALAS
  ========================================= */

  const currentMekhalas =
    useMemo(() => {
      const start =
        pageIndex *
        CARDS_PER_PAGE;

      return mekhalaData.slice(
        start,
        start +
          CARDS_PER_PAGE,
      );
    }, [
      pageIndex,
      mekhalaData,
    ]);


  /* =========================================
     FULL AUTO — NEXT 5 MEKHALAS
  ========================================= */

  useEffect(() => {
    if (
      totalPages <= 1
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          setPageIndex(
            (previous) =>
              previous >=
              totalPages - 1
                ? 0
                : previous +
                  1,
          );
        },
        MEKHALA_GROUP_TIME,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [
    totalPages,
  ]);


  return (
    <section
  className="
    relative
    w-full
    min-w-0
    max-w-full
    overflow-hidden
    bg-[#f8f5ea]
    py-12
    lg:py-16
  "
>
      {/* BACKGROUND */}

      <div
        className="
          pointer-events-none
          absolute
          inset-0
          bg-[radial-gradient(circle_at_50%_0%,rgba(205,170,78,0.12),transparent_42%)]
        "
      />


      <div
        className="
          pointer-events-none
          absolute
          -left-36
          top-12
          h-80
          w-80
          rounded-full
          border-[40px]
          border-[#0b6755]/[0.025]
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          -right-32
          bottom-10
          h-96
          w-96
          rounded-full
          border-[45px]
          border-[#c69e3b]/[0.04]
        "
      />


      <div
  className="
    relative
    z-10
    mx-auto
    w-full
    min-w-0
    max-w-full
    px-4
    md:px-5
    lg:px-6
  "
>
        {/* =====================================
            HEADER
        ====================================== */}

        <div
          className="
            mx-auto
            mb-12
            max-w-4xl
            text-center
          "
        >
          <div
            className="
              mb-4
              flex
              items-center
              justify-center
              gap-3
            "
          >
            <span
              className="
                h-px
                w-12
                bg-[#be9535]
              "
            />

            <Sparkles
              className="
                h-5
                w-5
                text-[#b98928]
              "
            />

            <span
              className="
                h-px
                w-12
                bg-[#be9535]
              "
            />
          </div>


          <p
            className="
              text-[10px]
              font-bold
              uppercase
              tracking-[0.4em]
              text-[#9b7628]
              sm:text-xs
            "
          >
            Madrasa Fest
          </p>


          <div
            className="
              mt-3
              flex
              flex-wrap
              items-center
              justify-center
              gap-3
            "
          >
            <h2
              className="
  font-serif
  text-[30px]
  font-bold
  leading-tight
  tracking-tight
  text-[#07483e]
  sm:text-[38px]
  lg:text-[46px]
  xl:text-[52px]
"
            >
              
Tanafus Live
              Scoreboard
            </h2>


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
                text-[10px]
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
          </div>


          <p
            className="
              mt-4
              text-sm
              text-[#66766f]
              md:text-base
            "
          >
            Mekhala-wise First
            Prize Winners

            <span className="mx-2 text-[#b4913b]">
              •
            </span>

            Celebrating Young
            Talents
          </p>
        </div>


        {/* =====================================
            LOADING / ERROR / EMPTY STATES
        ====================================== */}

        {loading && (
          <div
            className="
              mx-auto
              mb-8
              max-w-2xl
              rounded-2xl
              border
              border-[#e1d4af]
              bg-[#fffdf8]
              px-6
              py-10
              text-center
              shadow-sm
            "
          >
            <div
              className="
                mx-auto
                h-8
                w-8
                animate-spin
                rounded-full
                border-2
                border-[#d9c27e]
                border-t-[#075447]
              "
            />

            <p
              className="
                mt-4
                text-sm
                font-semibold
                text-[#49665d]
              "
            >
              Loading published Mekhala results…
            </p>
          </div>
        )}


        {!loading && loadError && (
          <div
            className="
              mx-auto
              mb-8
              max-w-2xl
              rounded-2xl
              border
              border-red-200
              bg-red-50
              px-6
              py-8
              text-center
            "
          >
            <p
              className="
                text-sm
                font-semibold
                text-red-700
              "
            >
              {loadError}
            </p>
          </div>
        )}


        {!loading &&
          !loadError &&
          mekhalaData.length === 0 && (
          <div
            className="
              mx-auto
              mb-8
              max-w-2xl
              rounded-2xl
              border
              border-dashed
              border-[#d3bd7d]
              bg-[#fffdf8]
              px-6
              py-10
              text-center
            "
          >
            <Trophy
              className="
                mx-auto
                h-8
                w-8
                text-[#b68a29]
              "
            />

            <h3
              className="
                mt-3
                font-serif
                text-lg
                font-bold
                text-[#17483d]
              "
            >
              Results Coming Soon
            </h3>

            <p
              className="
                mt-2
                text-sm
                text-[#74807a]
              "
            >
              Published Mekhala Fest results
              will appear here.
            </p>
          </div>
        )}


        {/* =====================================
            5 MEKHALA CARDS
        ====================================== */}

        {!loading &&
          !loadError &&
          mekhalaData.length > 0 && (
        <div
  className="
    w-full
    min-w-0
    max-w-full
    overflow-hidden
  "
>
  <div
    key={pageIndex}
    className="
      mekhala-group
      grid
      w-full
      min-w-0
      grid-cols-1
      gap-4

      sm:grid-cols-2
      lg:grid-cols-3
      xl:grid-cols-4
      2xl:grid-cols-5
    "
  >
    {currentMekhalas.map(
      (mekhala, index) => (
        <div
          key={mekhala.id}
          className="
            min-w-0
            w-full
          "
        >
          <MekhalaCard
            mekhala={mekhala}
            index={index}
            cardNumber={
              pageIndex *
                CARDS_PER_PAGE +
              index +
              1
            }
          />
        </div>
      ),
    )}
  </div>
</div>
        )}


        {/* =====================================
            AUTO STATUS
        ====================================== */}

        <div
          className="
            mt-9
            flex
            flex-col
            items-center
            gap-4
          "
        >
          {/* PAGE INDICATOR */}

          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            {Array.from({
              length:
                mekhalaData.length > 0
                  ? totalPages
                  : 0,
            }).map(
              (
                _,
                index,
              ) => (
                <span
                  key={
                    index
                  }
                  className={`
                    h-2.5
                    rounded-full
                    transition-all
                    duration-500

                    ${
                      pageIndex ===
                      index
                        ? "w-8 bg-[#075447]"
                        : "w-2.5 bg-[#d5d0c1]"
                    }
                  `}
                />
              ),
            )}
          </div>


          <div
            className="
              flex
              items-center
              gap-2
              text-xs
              font-semibold
              text-[#60726b]
            "
          >
            <Radio
              className="
                h-4
                w-4
                animate-pulse
                text-[#07816c]
              "
            />

            Live Auto Update
          </div>

<div
            className="
              flex
              items-center
              
              text-xs
              font-semibold
              text-[red]
              text-center
            "
          >
            
Please share your Mekhala Fest result<br/> list with us to update the official scoreboard.
          </div>

          {mekhalaData.length > 0 && (
            <p
              className="
                text-[11px]
                text-[#89918d]
              "
            >
              Showing Mekhalas{" "}
              {pageIndex *
                CARDS_PER_PAGE +
                1}
              –
              {Math.min(
                (pageIndex + 1) *
                  CARDS_PER_PAGE,
                mekhalaData.length,
              )}
            </p>
          )}


          {/* AUTO PROGRESS */}

          {mekhalaData.length > 0 && (
            <div
              key={`progress-${pageIndex}`}
              className="
                h-[3px]
                w-[240px]
                overflow-hidden
                rounded-full
                bg-[#ddd6c4]
              "
            >
              <div
                className="
                  mekhala-progress
                  h-full
                  rounded-full
                  bg-gradient-to-r
                  from-[#b98b28]
                  to-[#075447]
                "
              />
            </div>
          )}
        </div>
      </div>


      {/* =====================================
          ANIMATIONS
      ====================================== */}

      <style>
        {`

          /* =================================
             COMPLETE MEKHALA GROUP
          ================================== */

          @keyframes mekhalaGroupEnter {

            0% {
              opacity: 0;
              transform:
                translateY(45px);
            }

            100% {
              opacity: 1;
              transform:
                translateY(0);
            }

          }


          .mekhala-group {
            animation:
              mekhalaGroupEnter
              700ms
              cubic-bezier(
                0.16,
                1,
                0.3,
                1
              )
              both;
          }



          /* =================================
             EACH MEKHALA CARD
          ================================== */

          @keyframes mekhalaCardUp {

            0% {
              opacity: 0;

              transform:
                translateY(90px)
                scale(0.94);

              filter:
                blur(4px);
            }

            60% {
              opacity: 1;

              transform:
                translateY(-6px)
                scale(1.01);

              filter:
                blur(0);
            }

            100% {
              opacity: 1;

              transform:
                translateY(0)
                scale(1);
            }

          }


          .mekhala-score-card {
            opacity: 0;

            animation:
              mekhalaCardUp
              850ms
              cubic-bezier(
                0.16,
                1,
                0.3,
                1
              )
              forwards;
          }



          /* =================================
             COMPLETE WINNER BATCH
          ================================== */

          @keyframes winnerBatchUp {

            0% {
              opacity: 0;

              transform:
                translateY(55px);
            }

            100% {
              opacity: 1;

              transform:
                translateY(0);
            }

          }


          .winner-batch {
            animation:
              winnerBatchUp
              580ms
              cubic-bezier(
                0.16,
                1,
                0.3,
                1
              )
              both;
          }



          /* =================================
             EACH WINNER ROW
          ================================== */

          @keyframes winnerRowUp {

            0% {
              opacity: 0;

              transform:
                translateY(28px);
            }

            100% {
              opacity: 1;

              transform:
                translateY(0);
            }

          }


          .winner-row {
            opacity: 0;

            animation:
              winnerRowUp
              520ms
              cubic-bezier(
                0.16,
                1,
                0.3,
                1
              )
              forwards;
          }



          /* =================================
             PAGE AUTO PROGRESS
          ================================== */

          @keyframes mekhalaProgress {

            from {
              width: 0%;
            }

            to {
              width: 100%;
            }

          }


          .mekhala-progress {
            width: 0%;

            animation:
              mekhalaProgress
              ${MEKHALA_GROUP_TIME}ms
              linear
              forwards;
          }



          /* =================================
             REDUCED MOTION
          ================================== */

          @media (
            prefers-reduced-motion:
            reduce
          ) {

            .mekhala-group,
            .mekhala-score-card,
            .winner-batch,
            .winner-row,
            .mekhala-progress {

              opacity: 1 !important;

              animation:
                none !important;

              transform:
                none !important;
            }

          }

        `}
      </style>
    </section>
  );
}