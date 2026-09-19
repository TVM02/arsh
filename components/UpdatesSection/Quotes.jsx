"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";


/* =========================================================
   FALLBACK DATA
========================================================= */

const quotesdemo = [];


/* =========================================================
   COMPONENT
========================================================= */

export default function Quotes() {
  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0);

  const [
    visibleCards,
    setVisibleCards,
  ] = useState(4);

  const [
    isPaused,
    setIsPaused,
  ] = useState(false);

  const [
    selectedQuote,
    setSelectedQuote,
  ] = useState(null);

  const [
    quotes,
    setQuotes,
  ] = useState(quotesdemo);

  const intervalRef =
    useRef(null);


  /* =======================================================
     FETCH QUOTES
  ======================================================= */

  const fetchQuotes =
    async () => {
      try {
        const snap =
          await getDoc(
            doc(
              db,
              "homepageConfig",
              "main",
            ),
          );

        if (
          snap.exists() &&
          Array.isArray(
            snap.data()?.quotes,
          )
        ) {
          setQuotes(
            snap.data().quotes,
          );
        }
      } catch (error) {
        console.error(
          "Error fetching quotes:",
          error,
        );
      }
    };


  /* =======================================================
     RESPONSIVE CARD COUNT
  ======================================================= */

  useEffect(() => {
    const updateCards =
      () => {
        if (
          window.innerWidth <
          640
        ) {
          setVisibleCards(1);
        } else if (
          window.innerWidth <
          1024
        ) {
          setVisibleCards(2);
        } else {
          setVisibleCards(4);
        }
      };

    updateCards();
    fetchQuotes();

    window.addEventListener(
      "resize",
      updateCards,
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateCards,
      );
    };
  }, []);


  /* =======================================================
     MAX SLIDE INDEX
  ======================================================= */

  const maxIndex =
    Math.max(
      0,
      quotes.length -
        visibleCards,
    );


  /* =======================================================
     KEEP INDEX VALID
  ======================================================= */

  useEffect(() => {
    if (
      currentIndex >
      maxIndex
    ) {
      setCurrentIndex(0);
    }
  }, [
    currentIndex,
    maxIndex,
  ]);


  /* =======================================================
     NEXT SLIDE
  ======================================================= */

  const nextSlide = () => {
    setCurrentIndex(
      (previous) => {
        if (
          previous >=
          maxIndex
        ) {
          return 0;
        }

        return previous + 1;
      },
    );
  };


  /* =======================================================
     PREVIOUS SLIDE
  ======================================================= */

  const prevSlide = () => {
    setCurrentIndex(
      (previous) => {
        if (
          previous <= 0
        ) {
          return maxIndex;
        }

        return previous - 1;
      },
    );
  };


  /* =======================================================
     AUTO PLAY
  ======================================================= */

  useEffect(() => {
    if (
      isPaused ||
      selectedQuote ||
      quotes.length <=
        visibleCards
    ) {
      return;
    }

    intervalRef.current =
      window.setInterval(
        () => {
          setCurrentIndex(
            (previous) => {
              if (
                previous >=
                maxIndex
              ) {
                return 0;
              }

              return (
                previous + 1
              );
            },
          );
        },
        4000,
      );

    return () => {
      if (
        intervalRef.current
      ) {
        window.clearInterval(
          intervalRef.current,
        );
      }
    };
  }, [
    isPaused,
    selectedQuote,
    maxIndex,
    quotes.length,
    visibleCards,
  ]);


  /* =======================================================
     POPUP ESCAPE + BODY LOCK
  ======================================================= */

  useEffect(() => {
    if (!selectedQuote) {
      return;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    const handleEscape =
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          setSelectedQuote(
            null,
          );
        }
      };

    document.addEventListener(
      "keydown",
      handleEscape,
    );

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape,
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    selectedQuote,
  ]);


  /* =======================================================
     DOT COUNT
  ======================================================= */

  const dotCount =
    quotes.length > 0
      ? maxIndex + 1
      : 0;


  /* =======================================================
     UI
  ======================================================= */

  return (
    <section
      className="
        relative
        w-full
        overflow-hidden
        bg-[#fbfaf6]
        py-16
        sm:py-20
        lg:py-24
      "
    >
      {/* ===================================================
          BACKGROUND
      ==================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          inset-0
          bg-[radial-gradient(circle_at_50%_0%,rgba(214,180,92,0.08),transparent_38%)]
        "
      />


      {/* LEFT MOSQUE */}

      <div
        className="
          pointer-events-none
          absolute
          left-0
          top-8
          hidden
          h-[260px]
          w-[360px]
          opacity-[0.035]
          md:block
        "
      >
        <svg
          viewBox="0 0 360 260"
          className="
            h-full
            w-full
            text-[#075c4a]
          "
          fill="currentColor"
        >
          <rect
            x="45"
            y="115"
            width="20"
            height="145"
          />

          <rect
            x="285"
            y="100"
            width="18"
            height="160"
          />

          <rect
            x="103"
            y="160"
            width="160"
            height="100"
          />

          <path
            d="
              M103 160
              C120 110 150 87 183 87
              C216 87 246 110 263 160
              Z
            "
          />

          <path
            d="
              M52 115
              C54 85 63 70 72 60
              C64 58 60 50 60 40
              C60 48 55 55 47 60
              C53 72 56 88 58 115
              Z
            "
          />

          <path
            d="
              M291 100
              C293 70 302 55 310 45
              C302 43 298 35 298 25
              C298 34 293 40 285 45
              C291 57 294 72 296 100
              Z
            "
          />
        </svg>
      </div>


      {/* RIGHT MOSQUE */}

      <div
        className="
          pointer-events-none
          absolute
          right-0
          top-20
          hidden
          h-[240px]
          w-[340px]
          scale-x-[-1]
          opacity-[0.03]
          md:block
        "
      >
        <svg
          viewBox="0 0 360 260"
          className="
            h-full
            w-full
            text-[#075c4a]
          "
          fill="currentColor"
        >
          <rect
            x="45"
            y="115"
            width="20"
            height="145"
          />

          <rect
            x="285"
            y="100"
            width="18"
            height="160"
          />

          <rect
            x="103"
            y="160"
            width="160"
            height="100"
          />

          <path
            d="
              M103 160
              C120 110 150 87 183 87
              C216 87 246 110 263 160
              Z
            "
          />
        </svg>
      </div>


      {/* ===================================================
          HEADER
      ==================================================== */}

      <div
        className="
          relative
          z-10
          mx-auto
          mb-12
          max-w-4xl
          px-5
          text-center
          sm:mb-14
        "
      >
        {/* ORNAMENT */}

        <div
          className="
            mb-5
            flex
            items-center
            justify-center
            gap-4
          "
        >
          <span
            className="
              h-px
              w-16
              bg-gradient-to-r
              from-transparent
              to-[#bd9440]
            "
          />

          <div
            className="
              relative
              flex
              h-9
              w-9
              rotate-45
              items-center
              justify-center
              border
              border-[#c59b42]
              bg-[#fffdf7]
            "
          >
            <div
              className="
                h-3
                w-3
                border
                border-[#0b6755]
              "
            />
          </div>

          <span
            className="
              h-px
              w-16
              bg-gradient-to-l
              from-transparent
              to-[#bd9440]
            "
          />
        </div>


        <p
          className="
            mb-2
            text-[10px]
            font-bold
            uppercase
            tracking-[0.35em]
            text-[#a47a28]
            sm:text-xs
          "
        >
          Knowledge • Character •
          Wisdom
        </p>


        <h2
          className="
            font-serif
            text-4xl
            font-semibold
            tracking-[-0.03em]
            text-[#075744]
            sm:text-5xl
            lg:text-[58px]
            lg:leading-[1.05]
          "
        >
          Voices OF Knowledge
        </h2>


        <p
          className="
            mx-auto
            mt-4
            max-w-2xl
            text-sm
            leading-6
            text-slate-600
            sm:text-base
            md:text-[17px]
          "
        >
          Reflections, insights, and
          words from those who
          inspire us.
        </p>


        <div
          className="
            mt-6
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
              bg-[#d2b262]
            "
          />

          <span
            className="
              h-2
              w-2
              rotate-45
              border
              border-[#b58a31]
            "
          />

          <span
            className="
              h-px
              w-12
              bg-[#d2b262]
            "
          />
        </div>
      </div>


      {/* ===================================================
          MAIN CONTAINER
      ==================================================== */}

      <div
        className="
          relative
          z-10
          mx-auto
          w-full
          max-w-[1500px]
          px-5
          sm:px-10
          lg:px-16
        "
      >
        {/* =================================================
            CAROUSEL
        ================================================== */}

        <div
          className="relative"
          onMouseEnter={() =>
            setIsPaused(true)
          }
          onMouseLeave={() =>
            setIsPaused(false)
          }
          onTouchStart={() =>
            setIsPaused(true)
          }
          onTouchEnd={() =>
            setIsPaused(false)
          }
        >
          {/* ===============================================
              LEFT BUTTON
          ================================================ */}

          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous testimonials"
            className="
              group
              absolute
              left-0
              top-1/2
              z-30
              hidden
              h-14
              w-14
              -translate-x-1/2
              -translate-y-1/2
              items-center
              justify-center
              rounded-full
              border
              border-[#c99d3a]
              bg-[#fffdf8]
              text-[#075744]
              shadow-[0_8px_24px_rgba(41,59,50,0.12)]
              transition-all
              duration-300
              hover:scale-110
              hover:bg-[#075744]
              hover:text-white
              sm:flex
            "
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="
                h-6
                w-6
                transition-transform
                duration-300
                group-hover:-translate-x-1
              "
            >
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>


          {/* ===============================================
              CARDS VIEWPORT
          ================================================ */}

          <div
            className="
              overflow-hidden
              px-1
              py-4
            "
          >
            <div
              className="
                flex
                transition-transform
                duration-700
                ease-[cubic-bezier(0.22,1,0.36,1)]
              "
              style={{
                transform: `translateX(-${
                  currentIndex *
                  (100 /
                    visibleCards)
                }%)`,
              }}
            >
              {quotes.map(
                (
                  item,
                  index,
                ) => {
                  const quoteText =
                    typeof item?.quotes ===
                    "string"
                      ? item.quotes
                      : "";

                  return (
                    <div
                      key={`${
                        item?.name ||
                        "quote"
                      }-${index}`}
                      className="
                        shrink-0
                        px-2
                        sm:px-3
                        lg:px-3
                      "
                      style={{
                        width: `${
                          100 /
                          visibleCards
                        }%`,
                      }}
                    >
                      {/* =================================
                          CARD
                      ================================== */}

                      <article
                        className="
                          knowledge-card
                          group
                          relative
                          flex
                          h-[440px]
                          flex-col
                          overflow-hidden
                          rounded-[24px]
                          border-[1.5px]
                          border-[#cba13f]
                          bg-[#fffefa]/95
                          px-6
                          py-7
                          text-left
                          shadow-[0_12px_35px_rgba(38,59,49,0.08)]
                          backdrop-blur-sm
                          transition-all
                          duration-500
                          hover:-translate-y-2
                          hover:border-[#ae7e1e]
                          hover:shadow-[0_22px_55px_rgba(35,73,60,0.15)]

                          sm:h-[450px]
                          sm:px-7
                          sm:py-8
                        "
                      >
                        {/* INNER GOLD BORDER */}

                        <div
                          className="
                            pointer-events-none
                            absolute
                            inset-[5px]
                            rounded-[19px]
                            border
                            border-[#dfc477]/25
                          "
                        />


                        {/* GEOMETRIC DECORATION */}

                        <div
                          className="
                            pointer-events-none
                            absolute
                            -right-9
                            -top-9
                            h-36
                            w-36
                            rotate-12
                            opacity-[0.16]
                          "
                        >
                          <div
                            className="
                              absolute
                              inset-5
                              rotate-45
                              border
                              border-[#b98d2f]
                            "
                          />

                          <div
                            className="
                              absolute
                              inset-9
                              rotate-45
                              border
                              border-[#b98d2f]
                            "
                          />

                          <div
                            className="
                              absolute
                              inset-12
                              rotate-45
                              border
                              border-[#b98d2f]
                            "
                          />
                        </div>


                        {/* BOTTOM DECORATION */}

                        <div
                          className="
                            pointer-events-none
                            absolute
                            -bottom-10
                            -right-10
                            h-32
                            w-32
                            rounded-full
                            border-[14px]
                            border-[#d4b45a]/[0.07]
                          "
                        />


                        {/* =================================
                            CARD CONTENT
                        ================================== */}

                        <div
                          className="
                            relative
                            z-10
                            flex
                            h-full
                            w-full
                            flex-col
                          "
                        >
                          {/* QUOTE ICON */}

                          <div
                            className="
                              mb-5
                              flex
                              h-12
                              w-12
                              shrink-0
                              items-center
                              justify-center
                              rounded-full
                              bg-gradient-to-br
                              from-[#edf5ee]
                              to-[#f9f2dd]
                              text-[#075744]
                              shadow-sm
                              transition-transform
                              duration-500
                              group-hover:scale-110
                            "
                          >
                            <span
                              className="
                                font-serif
                                text-4xl
                                font-bold
                                leading-none
                              "
                            >
                              “
                            </span>
                          </div>


                          {/* =================================
                              FIXED QUOTE AREA
                          ================================== */}

                          <div
                            className="
                              h-[150px]
                              shrink-0
                              overflow-hidden
                            "
                          >
                            <p
                             className="
                   
                    pt-[0.3rem]
                    text-[0.80rem]
                    tracking-[0.12em]
                    font-[var(--font-malayalam-sans)]
                    text-left
                    text-[#355a2c]
                    leading-[1.4]
                    
                  "
                  style={{ lineHeight: "1.6", wordSpacing: "1px" }}
                            >
                              {quoteText}
                            </p>
                          </div>


                          {/* =================================
                              READ MORE
                          ================================== */}

                          <div
                            className="
                              mt-4
                              h-[36px]
                              shrink-0
                            "
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedQuote(
                                  item,
                                )
                              }
                              className="
                                group/read
                                inline-flex
                                items-center
                                gap-2
                                text-[14px]
                                font-bold
                                text-[#075744]
                                transition-all
                                duration-300
                                hover:text-[#ad8128]
                              "
                            >
                              Read More

                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                className="
                                  h-4
                                  w-4
                                  transition-transform
                                  duration-300
                                  group-hover/read:translate-x-1
                                "
                              >
                                <path
                                  d="M5 12H19M13 6L19 12L13 18"
                                  stroke="currentColor"
                                  strokeWidth="1.7"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>


                          {/* FLEX SPACER */}

                          <div className="flex-1" />


                          {/* =================================
                              AUTHOR
                          ================================== */}

                          <div className="shrink-0">
                            {/* GOLD DIVIDER */}

                            <div
                              className="
                                mb-5
                                h-px
                                w-14
                                bg-gradient-to-r
                                from-[#b98c2e]
                                to-transparent
                              "
                            />


                            <div
                              className="
                                flex
                                min-h-[58px]
                                items-start
                                gap-3
                              "
                            >
                              {/* AUTHOR ICON */}

                              <div
                                className="
                                  mt-0.5
                                  flex
                                  h-9
                                  w-9
                                  shrink-0
                                  items-center
                                  justify-center
                                  rounded-full
                                  bg-[#f7f0dc]
                                  text-[#a87d25]
                                "
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  className="
                                    h-4
                                    w-4
                                  "
                                >
                                  <path
                                    d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                  />

                                  <path
                                    d="M4 22C4 17.5817 7.58172 14 12 14C16.4183 14 20 17.5817 20 22"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </div>


                              {/* AUTHOR DETAILS */}

                              <div
                                className="
                                  min-w-0
                                  flex-1
                                "
                              >
                                <p
                                  className="
                                      mt-1
    min-h-[40px]
    whitespace-pre-wrap
    break-words
    font-[var(--font-malayalam-sans)]
    text-[13px]
    leading-5
    text-[#6d746f]
                                  "
                                >
                                  {item?.name ||
                                    "N/A"}
                                </p>


                                <p
  className="
    mt-1
    min-h-[40px]
    whitespace-pre-wrap
    break-words
    font-[var(--font-malayalam-sans)]
    text-[11px]
    leading-5
    text-[#6d746f]
  "
>
  {item?.specialized || "\u00A0"}
</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    </div>
                  );
                },
              )}
            </div>
          </div>


          {/* ===============================================
              RIGHT BUTTON
          ================================================ */}

          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next testimonials"
            className="
              group
              absolute
              right-0
              top-1/2
              z-30
              hidden
              h-14
              w-14
              translate-x-1/2
              -translate-y-1/2
              items-center
              justify-center
              rounded-full
              border
              border-[#c99d3a]
              bg-[#fffdf8]
              text-[#075744]
              shadow-[0_8px_24px_rgba(41,59,50,0.12)]
              transition-all
              duration-300
              hover:scale-110
              hover:bg-[#075744]
              hover:text-white
              sm:flex
            "
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="
                h-6
                w-6
                transition-transform
                duration-300
                group-hover:translate-x-1
              "
            >
              <path
                d="M9 6L15 12L9 18"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>


        {/* =================================================
            MOBILE BUTTONS
        ================================================== */}

        <div
          className="
            mt-6
            flex
            items-center
            justify-center
            gap-4
            sm:hidden
          "
        >
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous"
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-full
              border
              border-[#c99d3a]
              bg-[#fffdf8]
              text-[#075744]
              shadow-md
              transition
              hover:bg-[#075744]
              hover:text-white
            "
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>


          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next"
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-full
              border
              border-[#c99d3a]
              bg-[#fffdf8]
              text-[#075744]
              shadow-md
              transition
              hover:bg-[#075744]
              hover:text-white
            "
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M9 6L15 12L9 18"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>


        {/* =================================================
            DOTS
        ================================================== */}

        {dotCount > 0 && (
          <div
            className="
              mt-9
              flex
              items-center
              justify-center
              gap-2
            "
          >
            {Array.from({
              length: dotCount,
            }).map(
              (
                _,
                index,
              ) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Go to slide ${
                    index + 1
                  }`}
                  onClick={() =>
                    setCurrentIndex(
                      index,
                    )
                  }
                  className={`
                    rounded-full
                    transition-all
                    duration-500

                    ${
                      currentIndex ===
                      index
                        ? "h-2.5 w-7 bg-[#075744]"
                        : "h-2.5 w-2.5 bg-[#d7d6cd] hover:bg-[#b49a58]"
                    }
                  `}
                />
              ),
            )}
          </div>
        )}


        {/* =================================================
            PAUSE / RESUME
        ================================================== */}

        {quotes.length >
          visibleCards && (
          <div
            className="
              mt-4
              flex
              justify-center
            "
          >
            <button
              type="button"
              onClick={() =>
                setIsPaused(
                  (previous) =>
                    !previous,
                )
              }
              className="
                rounded-full
                px-4
                py-2
                text-[11px]
                font-medium
                text-[#7d817e]
                transition
                hover:bg-white
                hover:text-[#075744]
              "
            >
              {isPaused
                ? "▶ Resume"
                : "Ⅱ Pause"}
            </button>
          </div>
        )}
      </div>


      {/* ===================================================
          QUOTE DETAILS POPUP
      ==================================================== */}

      {selectedQuote && (
        <div
          className="
            fixed
            inset-0
            z-[9999]
            flex
            items-center
            justify-center
            bg-[#031c17]/65
            px-4
            py-6
            backdrop-blur-[6px]
          "
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedQuote(
                null,
              );
            }
          }}
        >
          <div
            className="
              quote-popup
              relative
              w-full
              max-w-[720px]
              overflow-hidden
              rounded-[28px]
              border
              border-[#c99b37]
              bg-[#fffdf7]
              shadow-[0_35px_100px_rgba(0,0,0,0.35)]
            "
          >
            {/* INNER BORDER */}

            <div
              className="
                pointer-events-none
                absolute
                inset-[6px]
                rounded-[22px]
                border
                border-[#e0c479]/30
              "
            />


            {/* DECORATIVE CORNER */}

            <div
              className="
                pointer-events-none
                absolute
                -right-12
                -top-12
                h-48
                w-48
                rotate-12
                opacity-[0.12]
              "
            >
              <div
                className="
                  absolute
                  inset-6
                  rotate-45
                  border
                  border-[#b7892d]
                "
              />

              <div
                className="
                  absolute
                  inset-12
                  rotate-45
                  border
                  border-[#b7892d]
                "
              />

              <div
                className="
                  absolute
                  inset-[72px]
                  rotate-45
                  border
                  border-[#b7892d]
                "
              />
            </div>


            {/* CLOSE */}

            <button
              type="button"
              onClick={() =>
                setSelectedQuote(
                  null,
                )
              }
              aria-label="Close quote"
              className="
                absolute
                right-5
                top-5
                z-30
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-full
                border
                border-[#dcc68a]
                bg-white
                text-[#075744]
                shadow-sm
                transition-all
                duration-300
                hover:rotate-90
                hover:bg-[#075744]
                hover:text-white
              "
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
              >
                <path
                  d="M6 6L18 18M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>


            {/* ===============================================
                POPUP CONTENT
            ================================================ */}

            <div
              className="
                relative
                z-10
                p-7
                sm:p-9
                md:p-11
              "
            >
              {/* TOP LABEL */}

              <div
                className="
                  mb-7
                  flex
                  items-center
                  gap-3
                "
              >
                <span
                  className="
                    h-px
                    w-12
                    bg-[#c49a3d]
                  "
                />

                <div
                  className="
                    h-2
                    w-2
                    rotate-45
                    border
                    border-[#b4872f]
                  "
                />

                <span
                  className="
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-[0.25em]
                    text-[#a47b2c]
                  "
                >
                  Voice of Knowledge
                </span>
              </div>


              {/* QUOTE ICON */}

              <div
                className="
                  mb-6
                  flex
                  h-14
                  w-14
                  items-center
                  justify-center
                  rounded-full
                  bg-gradient-to-br
                  from-[#e6f2e9]
                  to-[#f8efd6]
                  text-[#075744]
                  shadow-sm
                "
              >
                <span
                  className="
                    font-serif
                    text-5xl
                    font-bold
                    leading-none
                  "
                >
                  “
                </span>
              </div>


              {/* COMPLETE QUOTE */}

              <div
                className="
                  max-h-[52vh]
                  overflow-y-auto
                  pr-2
                "
              >
                <p
                  className="
                    whitespace-pre-wrap
                    font-[var(--font-malayalam-sans)]
                    text-[16px]
                    leading-[1.9]
                    text-[#24453c]
                    sm:text-[17px]
                    md:text-[18px]
                  "
                  style={{
                    wordSpacing:
                      "1px",
                  }}
                >
                  {
                    selectedQuote?.quotes
                  }
                </p>
              </div>


              {/* GOLD LINE */}

              <div
                className="
                  my-7
                  h-px
                  w-20
                  bg-gradient-to-r
                  from-[#b98729]
                  via-[#d7ba69]
                  to-transparent
                "
              />


              {/* =============================================
                  AUTHOR
              ============================================== */}

              <div
                className="
                  flex
                  items-center
                  gap-4
                "
              >
                <div
                  className="
                    flex
                    h-12
                    w-12
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-[#dfc77f]
                    bg-[#faf4e3]
                    text-[#a67d28]
                  "
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="
                      h-5
                      w-5
                    "
                  >
                    <path
                      d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />

                    <path
                      d="M4 22C4 17.5817 7.58172 14 12 14C16.4183 14 20 17.5817 20 22"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>


                <div
                  className="
                    min-w-0
                    flex-1
                  "
                >
                  <h4
                    className="
                      text-[15px]
                      font-extrabold
                      uppercase
                      tracking-[0.08em]
                      text-[#183e34]
                      sm:text-base
                    "
                  >
                    {selectedQuote?.name ||
                      "N/A"}
                  </h4>


                  {selectedQuote
                    ?.specialized && (
                    <p
                      className="
                        mt-1
                        font-[var(--font-malayalam-sans)]
                        text-xs
                        leading-5
                        text-[#747b77]
                      "
                    >
                      {
                        selectedQuote.specialized
                      }
                    </p>
                  )}
                </div>
              </div>


              {/* BOTTOM NOTE */}

              <div
                className="
                  mt-8
                  rounded-xl
                  border
                  border-[#eee3c5]
                  bg-[#faf7ed]
                  px-4
                  py-3
                  text-center
                "
              >
                <p
                  className="
                    font-serif
                    text-xs
                    italic
                    text-[#68746e]
                  "
                >
                  Knowledge • Character
                  • A Brighter Tomorrow
                </p>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ===================================================
          ANIMATIONS
      ==================================================== */}

      <style>
        {`
          /* ==============================================
             CARD GOLD SHINE
          =============================================== */

          .knowledge-card::after {
            content: "";

            position: absolute;

            top: -130%;
            left: -80%;

            width: 45%;
            height: 360%;

            transform: rotate(20deg);

            background:
              linear-gradient(
                90deg,
                transparent,
                rgba(
                  255,
                  240,
                  190,
                  0.28
                ),
                transparent
              );

            transition:
              left
              850ms
              ease;

            pointer-events: none;
          }


          .knowledge-card:hover::after {
            left: 145%;
          }


          /* ==============================================
             POPUP
          =============================================== */

          @keyframes quotePopupOpen {
            0% {
              opacity: 0;

              transform:
                translateY(30px)
                scale(0.94);
            }

            70% {
              opacity: 1;

              transform:
                translateY(-3px)
                scale(1.01);
            }

            100% {
              opacity: 1;

              transform:
                translateY(0)
                scale(1);
            }
          }


          .quote-popup {
            animation:
              quotePopupOpen
              420ms
              cubic-bezier(
                0.16,
                1,
                0.3,
                1
              )
              both;
          }


          /* ==============================================
             SCROLLBAR
          =============================================== */

          .quote-popup ::-webkit-scrollbar {
            width: 5px;
          }

          .quote-popup ::-webkit-scrollbar-track {
            background: transparent;
          }

          .quote-popup ::-webkit-scrollbar-thumb {
            background: #d0b163;
            border-radius: 999px;
          }


          /* ==============================================
             REDUCED MOTION
          =============================================== */

          @media (
            prefers-reduced-motion:
            reduce
          ) {
            .knowledge-card,
            .knowledge-card::after,
            .quote-popup {
              animation: none !important;
              transition: none !important;
            }
          }
        `}
      </style>
    </section>
  );
}