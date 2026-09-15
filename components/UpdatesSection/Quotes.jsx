"use client";

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { useEffect, useRef, useState } from "react";
import { name } from "@cloudinary/url-gen/actions/namedTransformation";
const quotesdemo = [
  
    
  
];

export default function Quotes() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCards, setVisibleCards] = useState(4);
  const [isPaused, setIsPaused] = useState(false);
 const [expandedIndex, setExpandedIndex] = useState(null);
  

  const intervalRef = useRef(null);

  const [quotes, setQuotes] = useState(quotesdemo);
 

 const fetchQuotes = async () => {
      try {
        const snap = await getDoc(doc(db, "homepageConfig", "main"));
        if (snap.exists() && snap.data().quotes) {
          setQuotes(snap.data().quotes);
        }
      } catch (error) {
        console.error("Error fetching quotes:", error);
      }
    };
 

  useEffect(() => {
    const updateCards = () => {
      if (window.innerWidth < 640) {
        setVisibleCards(1);
      } else if (window.innerWidth < 1024) {
        setVisibleCards(2);
      } else {
        setVisibleCards(4);
      }
    };

    updateCards();
    fetchQuotes();

    window.addEventListener("resize", updateCards);

    return () => {
      window.removeEventListener("resize", updateCards);
    };
  }, []);

  /*
   ----------------------------------------------------
   Maximum slide index
   ----------------------------------------------------
  */

  const maxIndex = Math.max(
    0,
    quotes.length - visibleCards
  );

  /*
   ----------------------------------------------------
   Keep index valid when screen size changes
   ----------------------------------------------------
  */

  useEffect(() => {
    if (currentIndex > maxIndex) {
      setCurrentIndex(0);
    }
  }, [visibleCards, currentIndex, maxIndex]);

  /*
   ----------------------------------------------------
   Next
   ----------------------------------------------------
  */

  const nextSlide = () => {
    setCurrentIndex((prev) => {
      if (prev >= maxIndex) {
        return 0;
      }

      return prev + 1;
    });
  };

  /*
   ----------------------------------------------------
   Previous
   ----------------------------------------------------
  */

  const prevSlide = () => {
    setCurrentIndex((prev) => {
      if (prev <= 0) {
        return maxIndex;
      }

      return prev - 1;
    });
  };

  /*
   ----------------------------------------------------
   Auto play
   ----------------------------------------------------
  */

  useEffect(() => {
    if (isPaused) return;

    intervalRef.current = setInterval(() => {
      nextSlide();
    }, 4000);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [isPaused, visibleCards, maxIndex]);

  /*
   ----------------------------------------------------
   Dot count
   ----------------------------------------------------
  */

  const dotCount = maxIndex + 1;

  return (
    <section className="relative w-full overflow-hidden bg-[#f8f8f6] py-20 sm:py-24 lg:py-28">

      {/* Decorative glow */}
      <div className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-white blur-3xl" />
      <div className="mb-12 text-center">
          <h2
            className="
              text-3xl
              font-serif
              tracking-tight
              text-[#075c3f]
              sm:text-4xl
              md:text-5xl
              font-normal
            "
          >
            Voices of Knowledge
          </h2>

          <p
            className="
              mt-3
              text-sm
              text-gray-700
              sm:text-base
              md:text-lg
              
            "
          >
            Reflections, insights, and words from those who inspire us.
          </p>
        </div>

      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12">

        {/* =================================================
            CAROUSEL
        ================================================= */}

        <div
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >

          {/* LEFT ARROW */}

          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous testimonials"
            className="
              group
              absolute
              left-0
              top-1/2
              z-20
              hidden
              h-12
              w-12
              -translate-x-1/2
              -translate-y-1/2
              items-center
              justify-center
              rounded-full
              bg-white
              text-[#1c2724]
              shadow-md
              transition-all
              duration-300
              hover:scale-110
              hover:shadow-xl
              sm:flex
              lg:-translate-x-1/2
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
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>


          {/* =================================================
              CARDS VIEWPORT
          ================================================= */}

          <div className="overflow-hidden px-1 py-3">

            <div
              className="
                flex
                transition-transform
                duration-700
                ease-[cubic-bezier(0.22,1,0.36,1)]
              "
              style={{
                transform: `translateX(-${
                  currentIndex * (100 / visibleCards)
                }%)`,
              }}
            >

              {quotes.map((item, index) => {
  const isExpanded = expandedIndex === index;
  const isLongText = item.quotes?.length > 120;

  const previewText = item.quotes?.slice(0, 120);

  return (
    <div
      key={`${item.name}-${index}`}
      className="shrink-0 px-2.5 sm:px-3 lg:px-3"
      style={{
        width: `${100 / visibleCards}%`,
      }}
    >
      <article
        className={`
          group
          relative
          flex
          flex-col
          rounded-[14px]
          border
          border-black/[0.05]
          bg-white
          px-7
          py-8
          text-center
          shadow-[0_8px_30px_rgba(0,0,0,0.08)]
          transition-all
          duration-500
          hover:-translate-y-1
          hover:shadow-[0_18px_40px_rgba(0,0,0,0.12)]

          ${isExpanded
            ? "min-h-[500px]"
            : "h-[350px]"
          }

          sm:${isExpanded
            ? "min-h-[500px]"
            : "h-[360px]"
          }

          lg:${isExpanded
            ? "min-h-[500px]"
            : "h-[350px]"
          }
        `}
      >

        {/* ================================
            CONTENT
        ================================= */}

        <div className="flex flex-1 flex-col items-center">

          {/* Quote */}

          <p
            className="tracking-wide text-[#4f5c4f] text-[0.90rem] m-0 whitespace-pre-wrap font-[var(--font-malayalam-sans)] text-left"
                    style={{ lineHeight: "1.6", wordSpacing: "1px" }}
          >
            &ldquo;

            {isExpanded || !isLongText
              ? item.quotes
              : `${previewText}...`}

            &rdquo;
          </p>


          {/* ================================
              READ MORE
          ================================= */}

          {isLongText && (
            <button
              type="button"
              onClick={() => {
                setExpandedIndex(
                  isExpanded ? null : index
                );
              }}
              className="
                mt-5
                shrink-0
                text-[15px]
                font-semibold
                text-[#243a35]
                transition-all
                duration-300
                hover:text-[#075c3f]
                hover:underline
              "
            >
              {isExpanded
                ? "Show Less"
                : "... Read More"}
            </button>
          )}

        </div>


     

        <div className="mt-auto pt-6">

          <p
            className="
              text-[15px]
              font-medium
              tracking-[-0.01em]
              text-[#26332f]
            "
          >
            - {item.name} <span className="tracking-wide text-[#4f5c4f] text-[0.80rem] m-0 whitespace-pre-wrap font-[var(--font-malayalam-sans)] "
                    style={{ lineHeight: "1.6", wordSpacing: "1px" }}> ({item.specialized})</span>
          </p>
          
        </div>

      </article>
    </div>
  );
})}

            </div>

          </div>


          {/* RIGHT ARROW */}

          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next testimonials"
            className="
              group
              absolute
              right-0
              top-1/2
              z-20
              hidden
              h-12
              w-12
              translate-x-1/2
              -translate-y-1/2
              items-center
              justify-center
              rounded-full
              bg-white
              text-[#1c2724]
              shadow-md
              transition-all
              duration-300
              hover:scale-110
              hover:shadow-xl
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
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

        </div>


        {/* =================================================
            MOBILE ARROWS
        ================================================= */}

        <div className="mt-6 flex items-center justify-center gap-4 sm:hidden">

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
              bg-white
              shadow-md
              transition
              hover:scale-105
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
                strokeWidth="1.5"
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
              bg-white
              shadow-md
              transition
              hover:scale-105
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
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

        </div>


        {/* =================================================
            DOTS
        ================================================= */}

        <div className="mt-8 flex items-center justify-center gap-2">

          {Array.from({ length: dotCount }).map((_, index) => (

            <button
              key={index}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              onClick={() => setCurrentIndex(index)}
              className={`
                h-2.5
                rounded-full
                transition-all
                duration-500
                ${
                  currentIndex === index
                    ? "w-2.5 bg-[#243a35]"
                    : "w-2.5 bg-[#c9ccca] hover:bg-[#8f9693]"
                }
              `}
            />

          ))}

        </div>


        {/* =================================================
            AUTO PLAY INDICATOR
        ================================================= */}

        <div className="mt-5 flex justify-center">

          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            className="
              text-xs
              text-black/40
              transition-colors
              hover:text-black/70
            "
          >
            {isPaused ? "▶ Resume" : "Ⅱ Pause"}
          </button>

        </div>

      </div>


      {/* =================================================
          DECORATIVE STAR
      ================================================= */}

      <div className="pointer-events-none absolute bottom-5 right-8 hidden opacity-60 sm:block">

        <svg
          width="42"
          height="42"
          viewBox="0 0 42 42"
          fill="none"
        >
          <path
            d="M21 0C22.8 13.2 28.8 19.2 42 21C28.8 22.8 22.8 28.8 21 42C19.2 28.8 13.2 22.8 0 21C13.2 19.2 19.2 13.2 21 0Z"
            fill="white"
          />
        </svg>

      </div>

    </section>
  );
}