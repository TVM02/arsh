"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  Landmark,
  Mic,
  Music,
  Palette,
  PenTool,
  Radio,
  School,
  Trophy,
  Users,
  Volume2,
} from "lucide-react";


/* =========================================================
   SETTINGS
========================================================= */

const AUTO_SLIDE_TIME = 7000;


/* =========================================================
   ICON MAP
========================================================= */

const ITEM_ICONS = {
  speech: Mic,
  quran: BookOpen,
  "madh-song": Music,
  "arabic-song": Music,
  essay: FileText,
  quiz: CircleHelp,
  hifz: Landmark,
  "story-telling": Users,
  calligraphy: PenTool,
  adhan: Volume2,
  recitation: BookOpen,
  drawing: Palette,
};


/* =========================================================
   DEMO DATA

   Later this can come from Firebase.
========================================================= */

const mekhalaData = [
  {
    id: "pothencode",

    name: "Pothencode Mekhala",

    madrasas: 40,

    bannerImage:
      "/thanfase/mekhala/pothencode-banner.jpg",

    winners: [
      {
        id: 1,
        item: "Speech",
        iconKey: "speech",
        category: "Junior",
        studentName: "Muhammed Jasim",
        madrasaName:
          "Noorul Huda Madrasa",
        madrasaId: "MID-3016",
        photo:
          "/thanfase/students/jasim.jpg",
      },

      {
        id: 2,
        item: "Quran",
        iconKey: "quran",
        category: "Sub Junior",
        studentName: "Najin Rahman",
        madrasaName:
          "Darul Irshad Madrasa",
        madrasaId: "MID-3042",
        photo:
          "/thanfase/students/najin.jpg",
      },

      {
        id: 3,
        item: "Madh Song",
        iconKey: "madh-song",
        category: "Senior",
        studentName:
          "Fahad Abdul Rahman",
        madrasaName:
          "Al Hidaya Madrasa",
        madrasaId: "MID-2987",
        photo:
          "/thanfase/students/fahad.jpg",
      },

      {
        id: 4,
        item: "Arabic Song",
        iconKey: "arabic-song",
        category: "Super Senior",
        studentName:
          "Shahana Fathima",
        madrasaName:
          "Markazul Uloom Madrasa",
        madrasaId: "MID-3105",
        photo:
          "/thanfase/students/shahana.jpg",
      },

      {
        id: 5,
        item: "Essay",
        iconKey: "essay",
        category: "Senior",
        studentName: "Ramees Ali",
        madrasaName:
          "Badria Madrasa",
        madrasaId: "MID-2991",
        photo:
          "/thanfase/students/ramees.jpg",
      },

      {
        id: 6,
        item: "Quiz",
        iconKey: "quiz",
        category: "Junior",
        studentName:
          "Shibil Noufal",
        madrasaName:
          "Suffa Madrasa",
        madrasaId: "MID-3028",
        photo:
          "/thanfase/students/shibil.jpg",
      },

      {
        id: 7,
        item: "Hifz",
        iconKey: "hifz",
        category: "Super Senior",
        studentName:
          "Fathima Nihala",
        madrasaName:
          "Jamiathul Banath Madrasa",
        madrasaId: "MID-3110",
        photo:
          "/thanfase/students/nihala.jpg",
      },

      {
        id: 8,
        item: "Story Telling",
        iconKey: "story-telling",
        category: "Sub Junior",
        studentName:
          "Ibrahim Rayan",
        madrasaName:
          "Al Falah Madrasa",
        madrasaId: "MID-3056",
        photo:
          "/thanfase/students/rayan.jpg",
      },

      {
        id: 9,
        item: "Calligraphy",
        iconKey: "calligraphy",
        category: "Junior",
        studentName:
          "Adnan Latheef",
        madrasaName:
          "Rashadiya Madrasa",
        madrasaId: "MID-3033",
        photo:
          "/thanfase/students/adnan.jpg",
      },

      {
        id: 10,
        item: "Adhan",
        iconKey: "adhan",
        category: "Senior",
        studentName:
          "Muhammed Shamil",
        madrasaName:
          "Thariqul Huda Madrasa",
        madrasaId: "MID-3007",
        photo:
          "/thanfase/students/shamil.jpg",
      },

      {
        id: 11,
        item: "Recitation",
        iconKey: "recitation",
        category: "Sub Junior",
        studentName:
          "Amina Sherin",
        madrasaName:
          "Noorul Huda Madrasa",
        madrasaId: "MID-3048",
        photo:
          "/thanfase/students/amina.jpg",
      },

      {
        id: 12,
        item: "Drawing",
        iconKey: "drawing",
        category: "Super Senior",
        studentName:
          "Rinsha Parveen",
        madrasaName:
          "Al Manar Madrasa",
        madrasaId: "MID-3099",
        photo:
          "/thanfase/students/rinsha.jpg",
      },
    ],
  },


  /* =======================================================
     SECOND MEKHALA
  ======================================================= */

  {
    id: "kaniyapuram",

    name: "Kaniyapuram Mekhala",

    madrasas: 36,

    bannerImage:
      "/thanfase/mekhala/kaniyapuram-banner.jpg",

    winners: [
      {
        id: 1,
        item: "Speech",
        iconKey: "speech",
        category: "Sub Junior",
        studentName:
          "Muhammed Ameen",
        madrasaName:
          "Hidayathul Islam Madrasa",
        madrasaId: "MID-4012",
        photo:
          "/thanfase/students/ameen.jpg",
      },

      {
        id: 2,
        item: "Quran",
        iconKey: "quran",
        category: "Junior",
        studentName:
          "Abdul Rahman",
        madrasaName:
          "Rahmaniya Madrasa",
        madrasaId: "MID-4021",
        photo:
          "/thanfase/students/rahman.jpg",
      },

      {
        id: 3,
        item: "Madh Song",
        iconKey: "madh-song",
        category: "Senior",
        studentName:
          "Shihabudheen",
        madrasaName:
          "Darussalam Madrasa",
        madrasaId: "MID-4034",
        photo:
          "/thanfase/students/shihab.jpg",
      },

      {
        id: 4,
        item: "Arabic Song",
        iconKey: "arabic-song",
        category: "Super Senior",
        studentName:
          "Fathima Nasreen",
        madrasaName:
          "Noorul Islam Madrasa",
        madrasaId: "MID-4051",
        photo:
          "/thanfase/students/nasreen.jpg",
      },

      {
        id: 5,
        item: "Essay",
        iconKey: "essay",
        category: "Senior",
        studentName:
          "Shameem Ali",
        madrasaName:
          "Al Huda Madrasa",
        madrasaId: "MID-4059",
        photo:
          "/thanfase/students/shameem.jpg",
      },

      {
        id: 6,
        item: "Quiz",
        iconKey: "quiz",
        category: "Junior",
        studentName:
          "Ashiq Rahman",
        madrasaName:
          "Markaz Madrasa",
        madrasaId: "MID-4065",
        photo:
          "/thanfase/students/ashiq.jpg",
      },

      {
        id: 7,
        item: "Hifz",
        iconKey: "hifz",
        category: "Super Senior",
        studentName:
          "Nihal Basheer",
        madrasaName:
          "Darul Quran Madrasa",
        madrasaId: "MID-4070",
        photo:
          "/thanfase/students/nihal.jpg",
      },

      {
        id: 8,
        item: "Story Telling",
        iconKey: "story-telling",
        category: "Sub Junior",
        studentName:
          "Safiya Rahman",
        madrasaName:
          "Al Ameen Madrasa",
        madrasaId: "MID-4078",
        photo:
          "/thanfase/students/safiya.jpg",
      },

      {
        id: 9,
        item: "Calligraphy",
        iconKey: "calligraphy",
        category: "Junior",
        studentName:
          "Anas Mohammed",
        madrasaName:
          "Hidaya Madrasa",
        madrasaId: "MID-4085",
        photo:
          "/thanfase/students/anas.jpg",
      },

      {
        id: 10,
        item: "Adhan",
        iconKey: "adhan",
        category: "Senior",
        studentName:
          "Rashid Ahmed",
        madrasaName:
          "Thaqwa Madrasa",
        madrasaId: "MID-4091",
        photo:
          "/thanfase/students/rashid.jpg",
      },

      {
        id: 11,
        item: "Recitation",
        iconKey: "recitation",
        category: "Sub Junior",
        studentName:
          "Aysha Mariyam",
        madrasaName:
          "Safa Madrasa",
        madrasaId: "MID-4097",
        photo:
          "/thanfase/students/aysha.jpg",
      },

      {
        id: 12,
        item: "Drawing",
        iconKey: "drawing",
        category: "Super Senior",
        studentName:
          "Hiba Fathima",
        madrasaName:
          "Al Furqan Madrasa",
        madrasaId: "MID-4104",
        photo:
          "/thanfase/students/hiba.jpg",
      },
    ],
  },
];


/* =========================================================
   CATEGORY COLORS
========================================================= */

function getCategoryClass(category) {
  switch (category) {
    case "Sub Junior":
      return `
        bg-[#dff4e9]
        text-[#186148]
      `;

    case "Junior":
      return `
        bg-[#fff0bd]
        text-[#76570d]
      `;

    case "Senior":
      return `
        bg-[#dcefeb]
        text-[#155f55]
      `;

    case "Super Senior":
      return `
        bg-[#d9f1e7]
        text-[#145d4a]
      `;

    default:
      return `
        bg-slate-100
        text-slate-600
      `;
  }
}


/* =========================================================
   STUDENT PHOTO
========================================================= */

function StudentPhoto({
  src,
  name,
}) {
  const [
    imageError,
    setImageError,
  ] = useState(false);

  const initials = String(
    name || "S",
  )
    .split(" ")
    .filter(Boolean)
    .map((item) => item[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (
    !src ||
    imageError
  ) {
    return (
      <div
        className="
          flex
          h-[72px]
          w-[72px]
          shrink-0
          items-center
          justify-center
          rounded-full
          border-[3px]
          border-white
          bg-gradient-to-br
          from-[#0d6656]
          to-[#83bca4]
          text-lg
          font-bold
          text-white
          shadow-md
        "
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() =>
        setImageError(true)
      }
      className="
        h-[72px]
        w-[72px]
        shrink-0
        rounded-full
        border-[3px]
        border-white
        object-cover
        shadow-md
      "
    />
  );
}


/* =========================================================
   1ST PRIZE BADGE
========================================================= */

function FirstPrizeBadge() {
  return (
    <div
      className="
        absolute
        right-3
        top-3
        z-20
        flex
        h-[48px]
        w-[48px]
        items-center
        justify-center
        rounded-full
        border-[3px]
        border-[#f4ce67]
        bg-gradient-to-br
        from-[#c72222]
        via-[#a81717]
        to-[#8f0d0d]
        text-center
        text-[9px]
        font-extrabold
        leading-[10px]
        text-[#ffe8a3]
        shadow-[0_5px_14px_rgba(120,20,20,0.30)]
      "
    >
      <span>
        1st
        <br />
        Prize
      </span>

      <div
        className="
          absolute
          -bottom-3
          left-[8px]
          h-5
          w-3
          rotate-[12deg]
          bg-[#d7a734]
          [clip-path:polygon(0_0,100%_0,70%_100%,50%_72%,25%_100%)]
        "
      />

      <div
        className="
          absolute
          -bottom-3
          right-[8px]
          h-5
          w-3
          -rotate-[12deg]
          bg-[#d7a734]
          [clip-path:polygon(0_0,100%_0,75%_100%,50%_72%,30%_100%)]
        "
      />
    </div>
  );
}


/* =========================================================
   WINNER CARD
========================================================= */

function WinnerCard({
  winner,
  index,
}) {
  const ItemIcon =
    ITEM_ICONS[
      winner.iconKey
    ] || Trophy;

  return (
    <article
      className="
        thanfase-winner-card
        group
        relative
        min-h-[128px]
        overflow-hidden
        rounded-[18px]
        border
        border-[#e8e2d5]
        bg-white/95
        p-4
        pr-[62px]
        shadow-[0_5px_18px_rgba(42,58,45,0.07)]
        transition-all
        duration-500
        hover:-translate-y-2
        hover:border-[#d5b767]
        hover:shadow-[0_18px_38px_rgba(16,79,65,0.16)]
      "
      style={{
        animationDelay:
          `${index * 90}ms`,
      }}
    >
      {/* hover light */}

      <div
        className="
          pointer-events-none
          absolute
          -right-16
          -top-16
          h-32
          w-32
          rounded-full
          bg-[#f3d985]/0
          blur-2xl
          transition
          duration-500
          group-hover:bg-[#f3d985]/20
        "
      />


      <FirstPrizeBadge />


      <div
        className="
          relative
          z-10
          flex
          items-center
          gap-4
        "
      >
        {/* STUDENT */}

        <div className="relative">
          <StudentPhoto
            src={winner.photo}
            name={
              winner.studentName
            }
          />

          <div
            className="
              absolute
              -bottom-1
              -left-1
              flex
              h-7
              w-7
              items-center
              justify-center
              rounded-full
              border-2
              border-white
              bg-gradient-to-br
              from-[#f6d466]
              to-[#b57b19]
              text-[11px]
              font-extrabold
              text-white
              shadow
            "
          >
            1
          </div>
        </div>


        {/* INFORMATION */}

        <div
          className="
            min-w-0
            flex-1
          "
        >
          <div
            className="
              flex
              flex-wrap
              items-center
              gap-x-2
              gap-y-1
            "
          >
            <ItemIcon
              className="
                h-4
                w-4
                text-[#075d50]
                transition-transform
                duration-500
                group-hover:scale-125
                group-hover:rotate-3
              "
            />

            <h4
              className="
                font-serif
                text-[15px]
                font-extrabold
                text-[#17372f]
                md:text-[16px]
              "
            >
              {winner.item}
            </h4>
          </div>


          <div className="mt-1.5">
            <span
              className={`
                inline-flex
                rounded-full
                px-3
                py-[3px]
                text-[10px]
                font-semibold
                ${getCategoryClass(
                  winner.category,
                )}
              `}
            >
              {winner.category}
            </span>
          </div>


          <h5
            className="
              mt-2
              truncate
              font-serif
              text-[14px]
              font-extrabold
              text-[#102d29]
            "
          >
            {winner.studentName}
          </h5>

          <p
            className="
              mt-[2px]
              truncate
              text-[11px]
              font-medium
              text-slate-600
            "
          >
            {winner.madrasaName}
          </p>

          <p
            className="
              mt-[1px]
              truncate
              text-[10px]
              font-semibold
              text-slate-500
            "
          >
            Madrasa ID:{" "}
            {winner.madrasaId}
          </p>
        </div>
      </div>
    </article>
  );
}


/* =========================================================
   MAIN SECTION
========================================================= */

export default function ThanfaseLiveScoreboard() {
  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0);

  const [
    paused,
    setPaused,
  ] = useState(false);


  const currentMekhala =
    mekhalaData[
      currentIndex
    ];


  const previousMekhala =
    useMemo(() => {
      const index =
        currentIndex === 0
          ? mekhalaData.length -
            1
          : currentIndex - 1;

      return mekhalaData[index];
    }, [
      currentIndex,
    ]);


  const nextMekhala =
    useMemo(() => {
      return mekhalaData[
        (currentIndex + 1) %
          mekhalaData.length
      ];
    }, [
      currentIndex,
    ]);


  /* =======================================================
     NEXT
  ======================================================= */

  const handleNext = () => {
    setCurrentIndex(
      (previous) =>
        (previous + 1) %
        mekhalaData.length,
    );
  };


  /* =======================================================
     PREVIOUS
  ======================================================= */

  const handlePrevious =
    () => {
      setCurrentIndex(
        (previous) =>
          previous === 0
            ? mekhalaData.length -
              1
            : previous - 1,
      );
    };


  /* =======================================================
     AUTO SLIDE
  ======================================================= */

  useEffect(() => {
    if (
      paused ||
      mekhalaData.length <=
        1
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          setCurrentIndex(
            (previous) =>
              (previous + 1) %
              mekhalaData.length,
          );
        },
        AUTO_SLIDE_TIME,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [
    paused,
  ]);


  return (
    <section
     className="
    relative
    overflow-hidden
    bg-[#f8f4e9]
    bg-cover
    bg-top
    bg-no-repeat
    py-12
    md:py-16
    lg:py-20
  "
      style={{
    backgroundImage:
      "url('/scorebg.png')",
  }}
    >
      {/* ===================================================
          BACKGROUND
      ==================================================== */}

    



     


      <div
        className="
          relative
          z-10
          mx-auto
          max-w-[1500px]
          px-4
          md:px-6
        "
      >
        {/* =================================================
            HEADER
        ================================================== */}

        <header
          className="
            mx-auto
            mb-8
            max-w-5xl
            text-center
            
          "
        >
          <div
            className="
              flex
              items-center
              justify-center
              gap-4
            "
          >
            <span
              className="
                hidden
                h-px
                w-16
                bg-[#d4b65f]
                sm:block
              "
            />

            <p
              className="
                text-xs
                font-bold
                uppercase
                tracking-[0.45em]
                text-[#9a7a2f]
              "
            >
              Madrasa Fest
            </p>

            <span
              className="
                hidden
                h-px
                w-16
                bg-[#d4b65f]
                sm:block
              "
            />
          </div>


          <div
            className="
              mt-4
              flex
              flex-wrap
              items-center
              justify-center
              gap-4
            "
          >
            <h2
              className="
                  font-serif
    text-4xl
    font-extrabold
    tracking-tight
    text-[#073f3a]
    sm:text-5xl
    lg:text-[58px]
  "
            >
              Thanfase Live
              Scoreboard
            </h2>


            <span
              className="
                inline-flex
                items-center
                gap-2
                rounded-full
                border
                border-red-400/40
                bg-red-600/90
                px-3
                py-1.5
                text-xs
                font-bold
                text-white
                shadow-[0_0_20px_rgba(239,68,68,0.45)]
              "
            >
              <span
                className="
                  h-2
                  w-2
                  animate-pulse
                  rounded-full
                  bg-white
                "
              />

              LIVE
            </span>
          </div>


          <h3
            className="
               mt-2
    font-serif
    text-xl
    font-semibold
    text-[#315f58]
    sm:text-2xl
            "
          >
            Mekhala-wise First
            Prize Winners
          </h3>


          <p
            className="
              mt-3
    text-sm
    font-medium
    text-[#5f7771]
    md:text-base
            "
          >
            Celebrating Young
            Talents
            <span className="mx-2 text-[#dfc46c]">
              •
            </span>
            Nurturing Imaan
            <span className="mx-2 text-[#dfc46c]">
              •
            </span>
            Building Tomorrow
          </p>
        </header>


        {/* =================================================
            MAIN SCOREBOARD
        ================================================== */}

        <div
          className="
            relative
          "
          onMouseEnter={() =>
            setPaused(true)
          }
          onMouseLeave={() =>
            setPaused(false)
          }
        >
          {/* =================================================
              PREVIOUS BUTTON
          ================================================== */}

          <div
            className="
              absolute
              -left-2
              top-1/2
              z-30
              hidden
              -translate-x-full
              -translate-y-1/2
              flex-col
              items-center
              lg:flex
            "
          >
            <button
              type="button"
              onClick={
                handlePrevious
              }
              className="
                flex
                h-14
                w-14
                items-center
                justify-center
                rounded-full
                border-2
                border-[#d0ae54]
                bg-[#075246]
                text-[#f5d77f]
                shadow-xl
                transition
                duration-300
                hover:scale-110
                hover:bg-[#0a6d5c]
              "
            >
              <ChevronLeft className="h-7 w-7" />
            </button>

            <p
              className="
                mt-3
                max-w-[80px]
                text-center
                text-[11px]
                font-semibold
                text-[#183d35]
              "
            >
              Previous
              <br />
              Mekhala
            </p>
          </div>


          {/* =================================================
              NEXT BUTTON
          ================================================== */}

          <div
            className="
              absolute
              -right-2
              top-1/2
              z-30
              hidden
              translate-x-full
              -translate-y-1/2
              flex-col
              items-center
              lg:flex
            "
          >
            <button
              type="button"
              onClick={
                handleNext
              }
              className="
                flex
                h-14
                w-14
                items-center
                justify-center
                rounded-full
                border-2
                border-[#d0ae54]
                bg-[#075246]
                text-[#f5d77f]
                shadow-xl
                transition
                duration-300
                hover:scale-110
                hover:bg-[#0a6d5c]
              "
            >
              <ChevronRight className="h-7 w-7" />
            </button>

            <p
              className="
                mt-3
                max-w-[110px]
                text-center
                text-[11px]
                font-semibold
                text-[#183d35]
              "
            >
              Next:
              <br />

              {
                nextMekhala.name
              }
            </p>
          </div>


          {/* =================================================
              CONTAINER

              Key changes when Mekhala changes.
              This restarts slide animations.
          ================================================== */}

          <div
            key={
              currentMekhala.id
            }
            className="
  thanfase-slide
  overflow-hidden
  rounded-[26px]
  border-[5px]
  border-white/90
  bg-[#fffdf8]/95
  shadow-[0_22px_65px_rgba(31,70,60,0.14)]
  backdrop-blur-[2px]
"
          >
            {/* =================================================
                MEKHALA HEADER
            ================================================== */}

            <div
              className="
                relative
                overflow-hidden
                border-b
                border-[#e2d8bd]
                bg-gradient-to-r
                from-[#f5f2e7]
                via-[#fffef9]
                to-[#f7f1df]
                px-5
                py-5
                md:px-8
              "
            >
              {currentMekhala
                .bannerImage && (
                <img
                  src={
                    currentMekhala.bannerImage
                  }
                  alt=""
                  className="
                    absolute
                    inset-0
                    h-full
                    w-full
                    object-cover
                    opacity-[0.12]
                  "
                />
              )}


              <div
                className="
                  absolute
                  inset-0
                  bg-gradient-to-r
                  from-[#f9f7ee]/95
                  via-white/85
                  to-[#f4ebd6]/80
                "
              />


              <div
                className="
                  relative
                  z-10
                  flex
                  flex-col
                  items-center
                  justify-between
                  gap-5
                  lg:flex-row
                "
              >
                <div
                  className="
                    flex
                    flex-col
                    items-center
                    gap-4
                    text-center
                    sm:flex-row
                    sm:text-left
                  "
                >
                  <div
                    className="
                      flex
                      h-16
                      w-16
                      items-center
                      justify-center
                      rounded-2xl
                      border
                      border-[#cba95a]
                      bg-[#075246]
                      text-[#f2d57a]
                      shadow-md
                    "
                  >
                    <School className="h-8 w-8" />
                  </div>


                  <div>
                    <h3
                      className="
                        font-serif
                        text-3xl
                        font-extrabold
                        text-[#103d34]
                        md:text-4xl
                      "
                    >
                      {
                        currentMekhala.name
                      }
                    </h3>

                    <p
                      className="
                        mt-1
                        text-xs
                        font-medium
                        text-[#467166]
                      "
                    >
                      Knowledge
                      <span className="mx-2 text-[#c59f45]">
                        •
                      </span>
                      Character
                      <span className="mx-2 text-[#c59f45]">
                        •
                      </span>
                      Community
                    </p>
                  </div>
                </div>


                <div
                  className="
                    flex
                    flex-wrap
                    items-center
                    justify-center
                    gap-4
                    text-sm
                    font-semibold
                    text-[#183e35]
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <Users
                      className="
                        h-5
                        w-5
                        text-[#075d50]
                      "
                    />

                    <strong>
                      {
                        currentMekhala.madrasas
                      }
                    </strong>

                    Madrasas Participating
                  </div>


                  <span
                    className="
                      hidden
                      h-6
                      w-px
                      bg-[#ceb86d]
                      sm:block
                    "
                  />


                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <Radio
                      className="
                        h-5
                        w-5
                        text-[#075d50]
                      "
                    />

                    Live Updates
                  </div>
                </div>
              </div>
            </div>


            {/* =================================================
                WINNERS GRID
            ================================================== */}

            <div
              className="
                grid
                grid-cols-1
                gap-3
                p-4
                sm:grid-cols-2
                lg:grid-cols-3
                xl:grid-cols-4
                md:p-5
              "
            >
              {currentMekhala.winners.map(
                (
                  winner,
                  index,
                ) => (
                  <WinnerCard
                    key={
                      winner.id
                    }
                    winner={
                      winner
                    }
                    index={
                      index
                    }
                  />
                ),
              )}
            </div>


            {/* =================================================
                MOBILE ARROWS
            ================================================== */}

            <div
              className="
                flex
                items-center
                justify-between
                border-t
                border-[#e8dfca]
                px-4
                py-3
                lg:hidden
              "
            >
              <button
                type="button"
                onClick={
                  handlePrevious
                }
                className="
                  flex
                  items-center
                  gap-2
                  rounded-full
                  bg-[#075246]
                  px-4
                  py-2
                  text-xs
                  font-semibold
                  text-white
                "
              >
                <ChevronLeft className="h-4 w-4" />

                Previous
              </button>


              <button
                type="button"
                onClick={
                  handleNext
                }
                className="
                  flex
                  items-center
                  gap-2
                  rounded-full
                  bg-[#075246]
                  px-4
                  py-2
                  text-xs
                  font-semibold
                  text-white
                "
              >
                Next

                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>


          {/* =================================================
              CONTROLS
          ================================================== */}

          <div
            className="
              mt-6
              flex
              flex-col
              items-center
              justify-center
              gap-5
            "
          >
            {/* DOTS */}

            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              {mekhalaData.map(
                (
                  mekhala,
                  index,
                ) => (
                  <button
                    key={
                      mekhala.id
                    }
                    type="button"
                    onClick={() =>
                      setCurrentIndex(
                        index,
                      )
                    }
                    aria-label={`Show ${mekhala.name}`}
                    className={`
                      rounded-full
                      transition-all
                      duration-300
                      ${
                        currentIndex ===
                        index
                          ? "h-3 w-8 bg-[#07574b]"
                          : "h-3 w-3 bg-[#cdc7b3] hover:bg-[#9d967e]"
                      }
                    `}
                  />
                ),
              )}
            </div>


            {/* VIEW MORE */}

            <a
              href={`/thanfase/${currentMekhala.id}`}
              className="
                group
                inline-flex
                min-w-[190px]
                items-center
                justify-center
                gap-3
                rounded-full
                border
                border-[#d2b15a]
                bg-gradient-to-r
                from-[#06483e]
                via-[#076152]
                to-[#06483e]
                px-8
                py-3.5
                font-serif
                text-base
                font-bold
                text-white
                shadow-[0_12px_25px_rgba(7,82,70,0.20)]
                transition-all
                duration-300
                hover:-translate-y-1
                hover:shadow-[0_18px_32px_rgba(7,82,70,0.30)]
              "
            >
              View More

              <ChevronRight
                className="
                  h-5
                  w-5
                  transition-transform
                  duration-300
                  group-hover:translate-x-1
                "
              />
            </a>
          </div>
        </div>


        {/* =================================================
            BOTTOM QUOTE
        ================================================== */}

        <div
          className="
            mt-10
            text-center
          "
        >
          <p
            className="
              font-serif
              text-base
              italic
              text-[#42665d]
            "
          >
            “Talents are Amanah.
            Let&apos;s Celebrate
            them for a Better
            Ummah.”
          </p>
        </div>
      </div>


      {/* ===================================================
          ANIMATIONS
      ==================================================== */}

      <style>
        {`

          /* ================================================
             WHOLE MEKHALA SLIDE
          ================================================= */

          @keyframes thanfaseSlideIn {

            0% {
              opacity: 0;
              transform:
                translateX(55px)
                scale(0.985);
              filter: blur(3px);
            }

            55% {
              opacity: 1;
              filter: blur(0);
            }

            100% {
              opacity: 1;
              transform:
                translateX(0)
                scale(1);
            }

          }


          .thanfase-slide {
            animation:
              thanfaseSlideIn
              750ms
              cubic-bezier(
                0.16,
                1,
                0.3,
                1
              )
              both;
          }



          /* ================================================
             CARD STAGGER ANIMATION
          ================================================= */

          @keyframes thanfaseCardEnter {

            0% {
              opacity: 0;
              transform:
                translateY(30px)
                scale(0.94);
            }

            60% {
              opacity: 1;
              transform:
                translateY(-4px)
                scale(1.01);
            }

            100% {
              opacity: 1;
              transform:
                translateY(0)
                scale(1);
            }

          }


          .thanfase-winner-card {
            opacity: 0;

            animation:
              thanfaseCardEnter
              650ms
              cubic-bezier(
                0.22,
                1,
                0.36,
                1
              )
              forwards;
          }



          /* ================================================
             SUBTLE SHINE
          ================================================= */

          .thanfase-winner-card::after {

            content: "";

            position: absolute;

            top: -100%;

            left: -130%;

            width: 70%;

            height: 300%;

            transform:
              rotate(22deg);

            background:
              linear-gradient(
                90deg,
                transparent,
                rgba(
                  255,
                  255,
                  255,
                  0.45
                ),
                transparent
              );

            transition:
              left
              700ms
              ease;

            pointer-events: none;

          }


          .thanfase-winner-card:hover::after {
            left: 150%;
          }



          /* ================================================
             ACCESSIBILITY
          ================================================= */

          @media (
            prefers-reduced-motion:
            reduce
          ) {

            .thanfase-slide,
            .thanfase-winner-card {
              animation: none !important;
              opacity: 1 !important;
            }

          }

        `}
      </style>
    </section>
  );
}