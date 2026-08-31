"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const defaultEvents = [
  {
    id: "1",
    image: "/buildings/three.jpg",
    text: "കേരളാ മദ്രസാദ്ധ്യാപക ക്ഷേമനിധി അപേക്ഷ. 1. വിവാഹ ധനസഹായം (ക്ഷേമനിധി അംഗത്തിനും അംഗത്തിന്റെ 2 പെണ്കുട്ടിയുടെ വിവാഹത്തിന് 25,000/-രൂപ)****വിവാഹ ധനസഹായത്തിനുള്ള അപേക്ഷയോടൊപ്പം വിവാഹ സർട്ടിഫിക്കറ്റ് (പഞ്ചായത്ത് / കോർപ്പറേഷൻ നൽകുന്നത്) നിർബന്ധമാണ് *",
  },
  {
    id: "2",
    image: "/buildings/five.jpg",
    text: "Educational Programme 2026",
  },
  {
    id: "3",
    image: "/buildings/seven.jpg",
    text: "Madrasa Annual Celebration",
  },
];

export default function FeaturedEventSlider() {
  const [events, setEvents] = useState(defaultEvents);
  const [activeIndex, setActiveIndex] = useState(0);

  // Fetch events from Firebase
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const snap = await getDoc(
          doc(db, "homepageConfig", "main")
        );

        if (snap.exists()) {
          const data = snap.data();

          if (
            Array.isArray(data.featuredNews) &&
            data.featuredNews.length > 0
          ) {
            setEvents(data.featuredNews);
          }
        }
      } catch (error) {
        console.error("Error loading featured events:", error);
      }
    };

    fetchEvents();
  }, []);

  // Auto change every 5 seconds
  useEffect(() => {
    if (events.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % events.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [events.length]);

  if (!events.length) return null;

  const event = events[activeIndex];

  const eventText =
    event.text ||
    event.title ||
    "";

  return (
    <section className="w-full py-8 md:py-12">

      <div className="mx-auto w-full max-w-5xl px-4">

        {/* MAIN BOX */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-5">
          <h3
        className="
          font-serif
          text-[#274629]
          text-[1.45rem]
          font-normal
          mb-5
          pb-3
          border-b
          border-[#c9b37e]/35
        "
      >
         Explore Our Latest Events
      </h3>

          {/* IMAGE FRAME */}
          <div
            key={`image-${activeIndex}`}
            className="
              relative
              h-[190px]
              w-full
              overflow-hidden
              rounded-md
              border
              border-gray-200
              bg-gray-50
              sm:h-[280px]
              md:h-[360px]
              lg:h-[420px]
              animate-[featuredImage_1s_ease-out]
            "
          >
            {event.image && (
              <Image
                src={event.image}
                alt={eventText || "Featured Event"}
                fill
                priority={activeIndex === 0}
                sizes="
                  (max-width: 640px) 100vw,
                  (max-width: 1024px) 90vw,
                  900px
                "
                className="
                  object-contain
                  transition-transform
                  duration-[5000ms]
                  ease-out
                  scale-[1.02]
                "
              />
            )}
          </div>

          {/* EVENT TEXT */}
          <div
            key={`text-${activeIndex}`}
            className="
              mt-4
              px-1
              sm:mt-5
              sm:px-2
              animate-[featuredText_0.8s_ease-out]
            "
          >
            <p
              className="tracking-wide text-[#4f5c4f] text-[0.80rem] m-0 whitespace-pre-wrap font-[var(--font-malayalam-sans)] text-center"
                    style={{ lineHeight: "1.6", wordSpacing: "1px" }}
            >
              {eventText}
            </p>
          </div>

        </div>

        {/* DOTS */}
        {events.length > 1 && (
          <div className="mt-5 flex items-center justify-center gap-2">

            {events.map((item, index) => (
              <button
                key={item.id || index}
                onClick={() => setActiveIndex(index)}
                aria-label={`Show event ${index + 1}`}
                className={`
                  h-[3px]
                  rounded-full
                  transition-all
                  duration-500
                  ${
                    index === activeIndex
                      ? "w-10 bg-gray-900"
                      : "w-3 bg-gray-300 hover:bg-gray-500"
                  }
                `}
              />
            ))}

          </div>
        )}

      </div>
    </section>
  );
}