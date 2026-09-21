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

const mekhalaData = [
  {
    id: "pothencode",
    name: "Pothencode Mekhala",
    madrasas: 40,

    winners: [
      {
        item: "Speech",
        category: "Junior",
        student: "Muhammed Jasim",
      },
      {
        item: "Quran",
        category: "Sub Junior",
        student: "Najin Rahman",
      },
      {
        item: "Mappilappattu",
        category: "Senior",
        student: "Shamil",
      },
      {
        item: "Arabic Song",
        category: "Super Senior",
        student: "Rizwan",
      },
      {
        item: "Essay",
        category: "Senior",
        student: "Safwan",
      },
      {
        item: "Quiz",
        category: "Junior",
        student: "Adhil",
      },
      {
        item: "Story Telling",
        category: "Sub Junior",
        student: "Salman",
      },
      {
        item: "Duff Muttu",
        category: "Senior",
        student: "Shihab",
      },
      {
        item: "Calligraphy",
        category: "Junior",
        student: "Rayan",
      },
      {
        item: "Hifz",
        category: "Junior",
        student: "Muadh",
      },
      {
        item: "Elocution",
        category: "Senior",
        student: "Suhail",
      },
      {
        item: "Nasheed",
        category: "Super Senior",
        student: "Hamdan",
      },
    ],
  },

  {
    id: "kaniyapuram",
    name: "Kaniyapuram Mekhala",
    madrasas: 36,

    winners: [
      {
        item: "Speech",
        category: "Sub Junior",
        student: "Fadil",
      },
      {
        item: "Quran",
        category: "Junior",
        student: "Muhsin",
      },
      {
        item: "Mappilappattu",
        category: "Senior",
        student: "Shafeek",
      },
      {
        item: "Arabic Song",
        category: "Super Senior",
        student: "Nihal",
      },
      {
        item: "Essay",
        category: "Junior",
        student: "Ameen",
      },
      {
        item: "Quiz",
        category: "Junior",
        student: "Hashim",
      },
      {
        item: "Story Telling",
        category: "Sub Junior",
        student: "Zayan",
      },
      {
        item: "Duff Muttu",
        category: "Senior",
        student: "Sameer",
      },
      {
        item: "Calligraphy",
        category: "Junior",
        student: "Fahad",
      },
      {
        item: "Hifz",
        category: "Junior",
        student: "Rashid",
      },
      {
        item: "Elocution",
        category: "Senior",
        student: "Noufal",
      },
      {
        item: "Nasheed",
        category: "Super Senior",
        student: "Ilyas",
      },
    ],
  },

  {
    id: "POOVACHAL",
    name: "POOVACHAL Mekhala",
    madrasas: 31,

    winners: [
      {
        item: "Speech",
        category: "Junior",
        student: "Shamil",
      },
      {
        item: "Quran",
        category: "Junior",
        student: "Ramees",
      },
      {
        item: "Essay",
        category: "Sub Junior",
        student: "Fathima",
      },
      {
        item: "Quiz",
        category: "Senior",
        student: "Ashraf",
      },
      {
        item: "Hifz",
        category: "Junior",
        student: "Nihal",
      },
      {
        item: "Story Telling",
        category: "Sub Junior",
        student: "Aysha",
      },
      {
        item: "Adhan",
        category: "Junior",
        student: "Sajid",
      },
      {
        item: "Recitation",
        category: "Senior",
        student: "Naseem",
      },
      {
        item: "Drawing",
        category: "Sub Junior",
        student: "Hiba",
      },
      {
        item: "Calligraphy",
        category: "Senior",
        student: "Adnan",
      },
      {
        item: "Madh Song",
        category: "Junior",
        student: "Fayas",
      },
      {
        item: "Arabic Song",
        category: "Senior",
        student: "Afnan",
      },
    ],
  },

  {
    id: "nedumangad",
    name: "Nedumangad Mekhala",
    madrasas: 34,

    winners: [
      {
        item: "Speech",
        category: "Senior",
        student: "Adhil",
      },
      {
        item: "Quran",
        category: "Sub Junior",
        student: "Hanan",
      },
      {
        item: "Story Telling",
        category: "Junior",
        student: "Rishal",
      },
      {
        item: "Essay",
        category: "Junior",
        student: "Nabeel",
      },
      {
        item: "Quiz",
        category: "Senior",
        student: "Irshad",
      },
      {
        item: "Hifz",
        category: "Junior",
        student: "Amaan",
      },
      {
        item: "Adhan",
        category: "Junior",
        student: "Sahil",
      },
      {
        item: "Madh Song",
        category: "Senior",
        student: "Riyas",
      },
      {
        item: "Recitation",
        category: "Junior",
        student: "Naufal",
      },
      {
        item: "Drawing",
        category: "Sub Junior",
        student: "Rifa",
      },
      {
        item: "Calligraphy",
        category: "Senior",
        student: "Shameem",
      },
      {
        item: "Arabic Song",
        category: "Senior",
        student: "Nizam",
      },
    ],
  },

  {
    id: "attingal",
    name: "Attingal Mekhala",
    madrasas: 29,

    winners: [
      {
        item: "Speech",
        category: "Sub Junior",
        student: "Shameem",
      },
      {
        item: "Quran",
        category: "Senior",
        student: "Najla",
      },
      {
        item: "Essay",
        category: "Junior",
        student: "Fawaz",
      },
      {
        item: "Quiz",
        category: "Junior",
        student: "Basith",
      },
      {
        item: "Hifz",
        category: "Super Senior",
        student: "Shanid",
      },
      {
        item: "Story Telling",
        category: "Sub Junior",
        student: "Rifna",
      },
      {
        item: "Adhan",
        category: "Junior",
        student: "Ramees",
      },
      {
        item: "Recitation",
        category: "Senior",
        student: "Nihala",
      },
      {
        item: "Drawing",
        category: "Junior",
        student: "Farhan",
      },
      {
        item: "Calligraphy",
        category: "Junior",
        student: "Ashiq",
      },
      {
        item: "Madh Song",
        category: "Senior",
        student: "Rifas",
      },
      {
        item: "Arabic Song",
        category: "Super Senior",
        student: "Amina",
      },
    ],
  },

  /* =======================================================
     SECOND 5 CARDS
  ======================================================= */

  {
    id: "Navayikkulam",
    name: "Navayikkulam Mekhala",
    madrasas: 27,
    winners: [
      { item: "Speech", category: "Junior", student: "Afsal" },
      { item: "Quran", category: "Sub Junior", student: "Shamil" },
      { item: "Essay", category: "Senior", student: "Rashid" },
      { item: "Quiz", category: "Junior", student: "Favas" },
      { item: "Hifz", category: "Junior", student: "Muhsin" },
      { item: "Story Telling", category: "Sub Junior", student: "Rifna" },
      { item: "Adhan", category: "Senior", student: "Shafeek" },
      { item: "Recitation", category: "Junior", student: "Ameen" },
      { item: "Drawing", category: "Sub Junior", student: "Hiba" },
      { item: "Calligraphy", category: "Senior", student: "Nihal" },
      { item: "Madh Song", category: "Junior", student: "Noufal" },
      { item: "Arabic Song", category: "Senior", student: "Sameer" },
    ],
  },

  {
    id: "PERINGAMMALA",
    name: "PERINGAMMALA Mekhala",
    madrasas: 33,
    winners: [
      { item: "Speech", category: "Senior", student: "Aman" },
      { item: "Quran", category: "Junior", student: "Aadil" },
      { item: "Essay", category: "Junior", student: "Nabil" },
      { item: "Quiz", category: "Senior", student: "Shiyas" },
      { item: "Hifz", category: "Junior", student: "Fadil" },
      { item: "Story Telling", category: "Sub Junior", student: "Hana" },
      { item: "Adhan", category: "Junior", student: "Rafi" },
      { item: "Recitation", category: "Senior", student: "Ajmal" },
      { item: "Drawing", category: "Junior", student: "Aysha" },
      { item: "Calligraphy", category: "Senior", student: "Anas" },
      { item: "Madh Song", category: "Junior", student: "Navas" },
      { item: "Arabic Song", category: "Senior", student: "Faizal" },
    ],
  },

  {
    id: "Tholikode",
    name: "Tholikode Mekhala",
    madrasas: 30,
    winners: [
      { item: "Speech", category: "Junior", student: "Muneer" },
      { item: "Quran", category: "Senior", student: "Hafiz" },
      { item: "Essay", category: "Sub Junior", student: "Fathima" },
      { item: "Quiz", category: "Junior", student: "Adhil" },
      { item: "Hifz", category: "Senior", student: "Basheer" },
      { item: "Story Telling", category: "Junior", student: "Amina" },
      { item: "Adhan", category: "Junior", student: "Yaseen" },
      { item: "Recitation", category: "Senior", student: "Rashad" },
      { item: "Drawing", category: "Sub Junior", student: "Rifa" },
      { item: "Calligraphy", category: "Junior", student: "Fayaz" },
      { item: "Madh Song", category: "Senior", student: "Junaid" },
      { item: "Arabic Song", category: "Senior", student: "Sameer" },
    ],
  },

  {
    id: "kallara",
    name: "Kallara Mekhala",
    madrasas: 25,
    winners: [
      { item: "Speech", category: "Senior", student: "Sahal" },
      { item: "Quran", category: "Junior", student: "Rafi" },
      { item: "Essay", category: "Sub Junior", student: "Nasrin" },
      { item: "Quiz", category: "Senior", student: "Nizam" },
      { item: "Hifz", category: "Junior", student: "Shamil" },
      { item: "Story Telling", category: "Sub Junior", student: "Hana" },
      { item: "Adhan", category: "Junior", student: "Amaan" },
      { item: "Recitation", category: "Senior", student: "Favas" },
      { item: "Drawing", category: "Junior", student: "Hiba" },
      { item: "Calligraphy", category: "Senior", student: "Faris" },
      { item: "Madh Song", category: "Junior", student: "Adnan" },
      { item: "Arabic Song", category: "Senior", student: "Rashid" },
    ],
  },

  {
    id: "KILIMANOOR",
    name: "KILIMANOOR Mekhala",
    madrasas: 32,
    winners: [
      { item: "Speech", category: "Junior", student: "Afnan" },
      { item: "Quran", category: "Sub Junior", student: "Nihal" },
      { item: "Essay", category: "Senior", student: "Fawas" },
      { item: "Quiz", category: "Junior", student: "Ramees" },
      { item: "Hifz", category: "Senior", student: "Rizwan" },
      { item: "Story Telling", category: "Junior", student: "Rinsha" },
      { item: "Adhan", category: "Junior", student: "Ashraf" },
      { item: "Recitation", category: "Senior", student: "Suhail" },
      { item: "Drawing", category: "Sub Junior", student: "Amina" },
      { item: "Calligraphy", category: "Junior", student: "Haris" },
      { item: "Madh Song", category: "Senior", student: "Shameem" },
      { item: "Arabic Song", category: "Senior", student: "Noufal" },
    ],
  },
];


/* =========================================================
   CATEGORY STYLE
========================================================= */

function getCategoryClass(category) {
  switch (category) {
    case "Sub Junior":
      return "bg-emerald-50 text-emerald-700";

    case "Junior":
      return "bg-amber-50 text-amber-700";

    case "Senior":
      return "bg-blue-50 text-blue-700";

    case "Super Senior":
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
    href="/live-score"
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
        flex
        h-[470px]
        flex-col
        overflow-hidden
        rounded-[24px]
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
          NUMBER BADGE
      ====================================== */}

     


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
          pt-10
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
              h-10
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


          <div
            className="
              mt-3
              flex
              items-center
              gap-2
              text-[11px]
              text-white/70
            "
          >
            <Users className="h-3.5 w-3.5" />

            <span>
              {mekhala.madrasas} Madrasas
            </span>
          </div>
        </div>
      </div>


      {/* =====================================
          TABLE HEADER
      ====================================== */}

      <div
        className="
          grid
          shrink-0
          grid-cols-[1fr_.95fr_1.1fr]
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
                  grid-cols-[1fr_.95fr_1.1fr]
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
                  >
                    {winner.category}
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

                  <span
                    className="
                      truncate
                      text-[11px]
                      font-bold
                      text-[#153d34]
                    "
                  >
                    {winner.student}
                  </span>
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
    pageIndex,
    setPageIndex,
  ] = useState(0);


  const totalPages =
    Math.ceil(
      mekhalaData.length /
        CARDS_PER_PAGE,
    );


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
        overflow-hidden
        bg-[#f8f5ea]
        py-16
        lg:py-20
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
          max-w-[1750px]
          px-4
          md:px-6
          lg:px-8
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
                text-4xl
                font-bold
                tracking-tight
                text-[#07483e]
                sm:text-5xl
                lg:text-[58px]
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
            5 MEKHALA CARDS
        ====================================== */}

        <div
          key={
            pageIndex
          }
          className="
            mekhala-group
            grid
            grid-cols-1
            gap-4
            sm:grid-cols-2
            lg:grid-cols-3
            2xl:grid-cols-5
          "
        >
          {currentMekhalas.map(
            (
              mekhala,
              index,
            ) => (
              <MekhalaCard
                key={
                  mekhala.id
                }
                mekhala={
                  mekhala
                }
                index={
                  index
                }
                cardNumber={
                  pageIndex *
                    CARDS_PER_PAGE +
                  index +
                  1
                }
              />
            ),
          )}
        </div>


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
                totalPages,
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
            

            The results shown above are for demonstration only.<br/>
Please share your Mekhala Fest result list with us to update the official scoreboard.
          </div>

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


          {/* AUTO PROGRESS */}

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