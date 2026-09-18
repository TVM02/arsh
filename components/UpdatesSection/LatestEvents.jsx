"use client";

import Image from "next/image";
import {
  useEffect,
  useState,
} from "react";

import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Sprout,
} from "lucide-react";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";


/* ==========================================
   SETTINGS
========================================== */

const defaultEvents = [];

const AUTO_SLIDE_TIME = 7000;


/* ==========================================
   DATE HELPERS
========================================== */

function getDateObject(value) {
  if (!value) {
    return null;
  }

  try {
    // Firestore Timestamp
    if (
      typeof value?.toDate ===
      "function"
    ) {
      return value.toDate();
    }

    // Serialized Firestore Timestamp
    if (value?.seconds) {
      return new Date(
        value.seconds * 1000,
      );
    }

    // YYYY-MM-DD
    if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(
        value,
      )
    ) {
      const [
        year,
        month,
        day,
      ] = value
        .split("-")
        .map(Number);

      return new Date(
        year,
        month - 1,
        day,
      );
    }

    const date =
      new Date(value);

    if (
      !Number.isNaN(
        date.getTime(),
      )
    ) {
      return date;
    }
  } catch (error) {
    console.error(
      "Invalid event date:",
      error,
    );
  }

  return null;
}


function formatSingleDate(value) {
  const date =
    getDateObject(value);

  if (!date) {
    return value || "Date TBA";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}


function formatEventDate(event) {
  if (event?.dateDisplay) {
    return event.dateDisplay;
  }

  const start =
    getDateObject(
      event?.startDate ||
        event?.date,
    );

  const end =
    getDateObject(
      event?.endDate,
    );

  if (start && end) {
    const sameMonth =
      start.getMonth() ===
        end.getMonth() &&
      start.getFullYear() ===
        end.getFullYear();

    if (sameMonth) {
      const startDay =
        String(
          start.getDate(),
        ).padStart(
          2,
          "0",
        );

      const endDay =
        String(
          end.getDate(),
        ).padStart(
          2,
          "0",
        );

      const month =
        end.toLocaleDateString(
          "en-US",
          {
            month: "short",
          },
        );

      return `${startDay} - ${endDay} ${month} ${end.getFullYear()}`;
    }

    return `${formatSingleDate(
      start,
    )} - ${formatSingleDate(
      end,
    )}`;
  }

  return formatSingleDate(
    event?.date ||
      event?.startDate,
  );
}


/* ==========================================
   EVENT SLIDE
========================================== */

function EventSlide({
  event,
}) {
  const [
    expanded,
    setExpanded,
  ] = useState(false);

  const description =
    event?.description || "";

  const isLong =
    description.length > 220;

  const category =
    event?.category ||
    event?.eventType ||
    "Madrasa Event";

  const dateText =
    formatEventDate(event);


  const handleRegister = () => {
    const url =
      event?.registrationUrl ||
      event?.registerUrl ||
      event?.link;

    if (url) {
      window.open(
        url,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };


  return (
    <div
      className={`
        relative
        grid
        overflow-hidden
        rounded-[28px]
        border
        border-emerald-100/80
        bg-white
        shadow-[0_20px_70px_rgba(22,70,45,0.10)]
        lg:grid-cols-[1.05fr_1fr]
      `}
    >
      {/* =====================================
          LEFT POSTER
      ====================================== */}

      <div
        className={`
          relative
          p-3
          sm:p-4
          lg:p-5
          lg:pr-0
        `}
      >
        <div
          className={`
            event-image-popup
            relative
            flex
            h-[320px]
            items-center
            justify-center
            overflow-hidden
            rounded-[22px]
            bg-[#f3f6ed]
            sm:h-[430px]
            lg:h-[535px]
          `}
        >
          {event?.image ? (
            <Image
              src={event.image}
              alt={
                event?.title ||
                "Event"
              }
              fill
              priority
              sizes="
                (max-width: 1024px) 100vw,
                52vw
              "
              className={`
                object-contain
                object-center
              `}
            />
          ) : (
            <div
              className={`
                flex
                h-full
                w-full
                items-center
                justify-center
                bg-gradient-to-br
                from-emerald-50
                via-[#faf9ef]
                to-green-100
              `}
            >
              <CalendarDays
                className="
                  h-20
                  w-20
                  text-emerald-700/20
                "
              />
            </div>
          )}


          {/* DATE BADGE */}

          <div
            className={`
              absolute
              bottom-5
              left-5
              z-20
              flex
              items-center
              gap-3
              rounded-[16px]
              border
              border-white/80
              bg-[#0d643e]/95
              px-5
              py-3
              text-white
              shadow-xl
              backdrop-blur-md
            `}
          >
            <CalendarDays
              className="
                h-5
                w-5
                shrink-0
              "
            />

            <span
              className="
                text-[13px]
                font-semibold
              "
            >
              {dateText}
            </span>
          </div>
        </div>
      </div>


      {/* =====================================
          RIGHT CONTENT
      ====================================== */}

      <div
        className={`
          event-content-popup
          relative
          flex
          flex-col
          justify-center
          px-6
          pb-9
          pt-7
          sm:px-10
          lg:px-14
          lg:py-12
        `}
      >
        {/* CATEGORY */}

        <div>
          <span
            className={`
              inline-flex
              items-center
              gap-2
              rounded-full
              bg-[#f1f5e7]
              px-4
              py-2
              text-[12px]
              font-semibold
              text-[#23613f]
            `}
          >
            <span
              className="
                h-2
                w-2
                rounded-full
                bg-[#c5a72c]
              "
            />

            {category}
          </span>
        </div>


        {/* TITLE */}

        <h3
          className={`
            mt-6
            text-[20px]
            font-semibold
            leading-[1.6]
            text-[#0d5137]
            sm:text-[26px]
            lg:text-[30px]
            font-[var(--font-malayalam-sans)]
          `}
        >
          {event?.title ||
            "Upcoming Madrasa Event"}
        </h3>


        {/* DECORATION */}

        <div
          className="
            my-7
            flex
            items-center
            gap-4
          "
        >
          <div
            className="
              h-px
              flex-1
              bg-gradient-to-r
              from-[#c8b977]
              to-transparent
            "
          />

          <Sprout
            className="
              h-5
              w-5
              text-[#74a05a]
            "
          />

          <div
            className="
              h-px
              flex-1
              bg-gradient-to-l
              from-[#c8b977]
              to-transparent
            "
          />
        </div>


        {/* =====================================
            DATE + LOCATION
        ====================================== */}

        <div
          className="
            grid
            gap-6
            sm:grid-cols-2
          "
        >
          {/* DATE */}

          <div
            className="
              flex
              items-start
              gap-4
            "
          >
            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-emerald-50
              "
            >
              <CalendarDays
                className="
                  h-5
                  w-5
                  text-[#218049]
                "
              />
            </div>

            <div>
              <p
                className="
                  text-[12px]
                  font-medium
                  text-slate-400
                "
              >
                Date
              </p>

              <p
                className="
                  mt-1
                  text-[14px]
                  font-semibold
                  text-slate-700
                "
              >
                {dateText}
              </p>
            </div>
          </div>


          {/* LOCATION */}

          <div
            className="
              flex
              items-start
              gap-4
            "
          >
            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-emerald-50
              "
            >
              <MapPin
                className="
                  h-5
                  w-5
                  text-[#218049]
                "
              />
            </div>

            <div>
              <p
                className="
                  text-[12px]
                  font-medium
                  text-slate-400
                "
              >
                Location
              </p>

              <p
                className="
                  mt-1
                  text-[13px]
                  leading-7
                  text-slate-600
                  font-[var(--font-malayalam-sans)]
                "
              >
                {event?.location ||
                  "Location TBA"}
              </p>
            </div>
          </div>
        </div>


        {/* =====================================
            DESCRIPTION
        ====================================== */}

        {description && (
          <div
            className="
              mt-8
              max-w-[680px]
            "
          >
            <p
              className={`
                text-[14px]
                leading-[2]
                text-slate-500
                font-[var(--font-malayalam-sans)]
                ${
                  !expanded &&
                  isLong
                    ? "line-clamp-3"
                    : ""
                }
              `}
            >
              {description}
            </p>

            {isLong && (
              <button
                type="button"
                onClick={() =>
                  setExpanded(
                    (value) =>
                      !value,
                  )
                }
                className="
                  mt-2
                  text-[13px]
                  font-semibold
                  text-[#167345]
                  transition-colors
                  hover:text-[#0a5732]
                "
              >
                {expanded
                  ? "Show Less"
                  : "Read More"}
              </button>
            )}
          </div>
        )}


        {/* =====================================
            REGISTER BUTTON
        ====================================== */}

        <div className="mt-8">
          <button
            type="button"
            onClick={
              handleRegister
            }
            className={`
              group
              flex
              min-w-[210px]
              items-center
              justify-between
              gap-8
              rounded-[15px]
              bg-gradient-to-r
              from-[#12623d]
              to-[#1b7b4c]
              px-7
              py-4
              text-[15px]
              font-semibold
              text-white
              shadow-[0_8px_24px_rgba(20,105,65,0.22)]
              transition-all
              duration-300
              hover:-translate-y-1
              hover:shadow-[0_12px_30px_rgba(20,105,65,0.30)]
            `}
          >
            <span>
              Register Now
            </span>

            <ArrowRight
              className="
                h-5
                w-5
                transition-transform
                duration-300
                group-hover:translate-x-1
              "
            />
          </button>
        </div>


        {/* BACKGROUND LEAF */}

        <div
          className="
            pointer-events-none
            absolute
            bottom-2
            right-2
            hidden
            opacity-[0.08]
            md:block
          "
        >
          <Sprout
            className="
              h-32
              w-32
              text-[#438244]
            "
          />
        </div>
      </div>
    </div>
  );
}


/* ==========================================
   MAIN COMPONENT
========================================== */

export default function LatestEvents() {
  const [
    events,
    setEvents,
  ] = useState(defaultEvents);

  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0);

  const [
    isPaused,
    setIsPaused,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);


  /* ========================================
     FETCH FIRESTORE EVENTS
  ======================================== */

  useEffect(() => {
    let mounted = true;

    const fetchEvents =
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

          if (!mounted) {
            return;
          }

          if (
            snap.exists() &&
            Array.isArray(
              snap.data()?.events,
            )
          ) {
            const data =
              snap
                .data()
                .events
                .map(
                  (
                    event,
                    index,
                  ) => ({
                    id:
                      event?.id ||
                      `event-${index}`,

                    ...event,
                  }),
                );

            setEvents(data);

            setCurrentIndex(0);
          }
        } catch (error) {
          console.error(
            "Error fetching events:",
            error,
          );
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    fetchEvents();

    return () => {
      mounted = false;
    };
  }, []);


  /* ========================================
     KEEP INDEX VALID
  ======================================== */

  useEffect(() => {
    if (
      events.length === 0
    ) {
      setCurrentIndex(0);
      return;
    }

    if (
      currentIndex >=
      events.length
    ) {
      setCurrentIndex(0);
    }
  }, [
    events.length,
    currentIndex,
  ]);


  /* ========================================
     AUTO SLIDE
  ======================================== */

  useEffect(() => {
    if (
      events.length <= 1 ||
      isPaused
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          setCurrentIndex(
            (previousIndex) =>
              (
                previousIndex +
                1
              ) %
              events.length,
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
    events.length,
    isPaused,
  ]);


  /* ========================================
     PREVIOUS
  ======================================== */

  const previousEvent = () => {
    if (
      events.length <= 1
    ) {
      return;
    }

    setCurrentIndex(
      (previousIndex) =>
        previousIndex === 0
          ? events.length - 1
          : previousIndex - 1,
    );
  };


  /* ========================================
     NEXT
  ======================================== */

  const nextEvent = () => {
    if (
      events.length <= 1
    ) {
      return;
    }

    setCurrentIndex(
      (previousIndex) =>
        (
          previousIndex + 1
        ) % events.length,
    );
  };


  const currentEvent =
    events[
      currentIndex
    ] || null;


  return (
    <section
      id="events"
      className={`
        relative
        overflow-hidden
        bg-[#fcfdf8]
        py-16
        sm:py-20
        lg:py-24
      `}
    >
      {/* =====================================
          BACKGROUND DECORATION
      ====================================== */}

      <div
        className="
          pointer-events-none
          absolute
          -left-32
          -top-32
          h-[350px]
          w-[350px]
          rounded-full
          bg-green-100/50
          blur-3xl
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          -bottom-40
          -right-32
          h-[400px]
          w-[400px]
          rounded-full
          bg-emerald-100/50
          blur-3xl
        "
      />


      <div
        className={`
          relative
          z-10
          mx-auto
          w-[calc(100%-2rem)]
          max-w-[1500px]
          sm:w-[calc(100%-4rem)]
        `}
      >
        {/* =====================================
            HEADER
        ====================================== */}

        <div
          className="
            mx-auto
            mb-12
            max-w-[950px]
            text-center
          "
        >
          <Sprout
            className="
              mx-auto
              mb-3
              h-8
              w-8
              text-[#5b9750]
            "
          />

          <div
            className="
              flex
              items-center
              justify-center
              gap-5
            "
          >
            <div
              className="
                hidden
                h-px
                w-20
                bg-gradient-to-r
                from-transparent
                to-[#73a266]
                sm:block
              "
            />

            <p
              className="
                text-[13px]
                font-semibold
                uppercase
                tracking-[0.4em]
                text-[#347746]
              "
            >
              Our Events
            </p>

            <div
              className="
                hidden
                h-px
                w-20
                bg-gradient-to-l
                from-transparent
                to-[#73a266]
                sm:block
              "
            />
          </div>


          <h2
            className="
              mt-4
              font-serif
              text-[clamp(2.5rem,5vw,4.5rem)]
              font-semibold
              leading-none
            "
          >
            <span
              className="
                text-[#0c3934]
              "
            >
              Upcoming
            </span>{" "}

            <span
              className="
                text-[#55934d]
              "
            >
              Events
            </span>
          </h2>


          <p
            className="
              mt-5
              text-[14px]
              leading-8
              text-slate-500
              sm:text-[16px]
              font-[var(--font-malayalam-sans)]
            "
          >
            Catch our upcoming events here.
          </p>
        </div>


        {/* =====================================
            LOADING
        ====================================== */}

        {loading && (
          <div
            className="
              flex
              min-h-[400px]
              items-center
              justify-center
            "
          >
            <div
              className="
                h-10
                w-10
                animate-spin
                rounded-full
                border-4
                border-emerald-200
                border-t-emerald-600
              "
            />
          </div>
        )}


        {/* =====================================
            EVENT SLIDER
        ====================================== */}

        {!loading &&
          currentEvent && (
            <div
              className="
                relative
              "
              onMouseEnter={() =>
                setIsPaused(true)
              }
              onMouseLeave={() =>
                setIsPaused(false)
              }
            >
              {/* ANIMATED EVENT */}

              <div
                key={
                  currentEvent.id
                }
                className="
                  event-slide-animation
                "
              >
                <EventSlide
                  event={
                    currentEvent
                  }
                />
              </div>


              {/* =================================
                  DESKTOP LEFT ARROW
              ================================== */}

              {events.length >
                1 && (
                <button
                  type="button"
                  onClick={
                    previousEvent
                  }
                  aria-label="Previous event"
                  className={`
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
                    border-emerald-100
                    bg-white
                    text-[#17603e]
                    shadow-[0_10px_30px_rgba(0,0,0,0.12)]
                    transition-all
                    hover:scale-110
                    hover:bg-emerald-50
                    lg:flex
                  `}
                >
                  <ChevronLeft
                    className="
                      h-6
                      w-6
                    "
                  />
                </button>
              )}


              {/* =================================
                  DESKTOP RIGHT ARROW
              ================================== */}

              {events.length >
                1 && (
                <button
                  type="button"
                  onClick={
                    nextEvent
                  }
                  aria-label="Next event"
                  className={`
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
                    border-emerald-100
                    bg-white
                    text-[#17603e]
                    shadow-[0_10px_30px_rgba(0,0,0,0.12)]
                    transition-all
                    hover:scale-110
                    hover:bg-emerald-50
                    lg:flex
                  `}
                >
                  <ChevronRight
                    className="
                      h-6
                      w-6
                    "
                  />
                </button>
              )}


              {/* =================================
                  MOBILE ARROWS
              ================================== */}

              {events.length >
                1 && (
                <div
                  className="
                    mt-6
                    flex
                    justify-center
                    gap-3
                    lg:hidden
                  "
                >
                  <button
                    type="button"
                    onClick={
                      previousEvent
                    }
                    className="
                      flex
                      h-11
                      w-11
                      items-center
                      justify-center
                      rounded-full
                      bg-white
                      text-emerald-700
                      shadow-md
                    "
                  >
                    <ChevronLeft
                      className="
                        h-5
                        w-5
                      "
                    />
                  </button>

                  <button
                    type="button"
                    onClick={
                      nextEvent
                    }
                    className="
                      flex
                      h-11
                      w-11
                      items-center
                      justify-center
                      rounded-full
                      bg-white
                      text-emerald-700
                      shadow-md
                    "
                  >
                    <ChevronRight
                      className="
                        h-5
                        w-5
                      "
                    />
                  </button>
                </div>
              )}


              {/* =================================
                  PAGINATION DOTS
              ================================== */}

              {events.length >
                1 && (
                <div
                  className="
                    mt-10
                    flex
                    items-center
                    justify-center
                    gap-4
                  "
                >
                  <div
                    className="
                      hidden
                      h-px
                      w-20
                      bg-gradient-to-r
                      from-transparent
                      to-emerald-500
                      sm:block
                    "
                  />

                  <div
                    className="
                      flex
                      items-center
                      gap-3
                    "
                  >
                    {events.map(
                      (
                        event,
                        index,
                      ) => (
                        <button
                          key={
                            event.id
                          }
                          type="button"
                          aria-label={`Show event ${
                            index +
                            1
                          }`}
                          onClick={() =>
                            setCurrentIndex(
                              index,
                            )
                          }
                          className={`
                            rounded-full
                            transition-all
                            duration-300

                            ${
                              index ===
                              currentIndex
                                ? "h-4 w-4 scale-110 bg-[#167a49]"
                                : "h-3 w-3 bg-slate-300 hover:bg-emerald-300"
                            }
                          `}
                        />
                      ),
                    )}
                  </div>

                  <div
                    className="
                      hidden
                      h-px
                      w-20
                      bg-gradient-to-l
                      from-transparent
                      to-emerald-500
                      sm:block
                    "
                  />
                </div>
              )}


              {/* AUTO SLIDE INDICATOR */}

              {events.length >
                1 && (
                <div
                  key={`progress-${currentIndex}`}
                  className="
                    mx-auto
                    mt-5
                    h-[3px]
                    max-w-[180px]
                    overflow-hidden
                    rounded-full
                    bg-emerald-100
                  "
                >
                  {!isPaused && (
                    <div
                      className="
                        event-auto-progress
                        h-full
                        bg-emerald-600
                      "
                    />
                  )}
                </div>
              )}
            </div>
          )}


        {/* =====================================
            NO EVENTS
        ====================================== */}

        {!loading &&
          !currentEvent && (
            <div
              className="
                rounded-[28px]
                border
                border-emerald-100
                bg-white
                px-6
                py-20
                text-center
                shadow-sm
              "
            >
              <CalendarDays
                className="
                  mx-auto
                  h-12
                  w-12
                  text-emerald-200
                "
              />

              <p
                className="
                  mt-4
                  text-sm
                  text-slate-500
                "
              >
                No upcoming events
                available.
              </p>
            </div>
          )}
      </div>


      {/* =====================================
          ANIMATIONS
      ====================================== */}

      <style>{`
        /*
         * Whole slide animation
         */
        .event-slide-animation {
          animation:
            eventSlideIn 0.75s
            cubic-bezier(
              0.22,
              1,
              0.36,
              1
            );
        }

        @keyframes eventSlideIn {
          0% {
            opacity: 0;
            transform:
              translateX(55px)
              scale(0.98);
          }

          100% {
            opacity: 1;
            transform:
              translateX(0)
              scale(1);
          }
        }


        /*
         * Poster animation
         */
        .event-image-popup {
          animation:
            eventImagePopup 0.8s
            cubic-bezier(
              0.22,
              1,
              0.36,
              1
            );
        }

        @keyframes eventImagePopup {
          0% {
            opacity: 0;
            transform:
              scale(0.92)
              translateY(20px);
          }

          100% {
            opacity: 1;
            transform:
              scale(1)
              translateY(0);
          }
        }


        /*
         * Text content popup animation
         */
        .event-content-popup {
          animation:
            eventContentPopup
            0.85s
            0.12s
            cubic-bezier(
              0.22,
              1,
              0.36,
              1
            )
            both;
        }

        @keyframes eventContentPopup {
          0% {
            opacity: 0;
            transform:
              translateY(35px)
              scale(0.96);
          }

          60% {
            opacity: 1;
          }

          100% {
            opacity: 1;
            transform:
              translateY(0)
              scale(1);
          }
        }


        /*
         * Automatic 5 second progress
         */
        .event-auto-progress {
          width: 0%;
          animation:
            eventProgress
            ${AUTO_SLIDE_TIME}ms
            linear
            forwards;
        }

        @keyframes eventProgress {
          from {
            width: 0%;
          }

          to {
            width: 100%;
          }
        }


        /*
         * Reduce animations for users
         * requesting reduced motion.
         */
        @media (
          prefers-reduced-motion:
          reduce
        ) {
          .event-slide-animation,
          .event-image-popup,
          .event-content-popup,
          .event-auto-progress {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}