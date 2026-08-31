"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const defaultEvents = [
  {
    id: 1,
    image: "/buildings/eight.jpg",
    title: "Annual Madrasa Conference",
    date: "15 June 2026",
    location: "Jonakappuram",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod temporincididunt ut labore et dolore magn.",
  },
  {
    id: 2,
    image: "/buildings/five.jpg",
    title: "Qur'an Recitation Competition",
    date: "22 June 2026",
    location: "Kollam",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
  {
    id: 3,
    image: "/buildings/nine.jpg",
    title: "Teachers' Training Workshop",
    date: "5 July 2026",
    location: "Convention Center, Kochi",
    description:
      "Lorem ipsum dolor sit ametconadipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
  {
    id: 4,
    image: "/buildings/seven.jpg",
    title: "Parent Teacher Mushawara",
    date: "12 July 2026",
    location: "Regional Centre",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscingelitte elit. Sed do eiusmod tempor incididunt ut labore et dolorealiqua.",
  },
];

const EventCard = ({ event }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongText = event.description && event.description.length > 90;

  return (
    <article className="relative flex flex-col bg-white border border-[#c9b37e]/45 rounded-md overflow-hidden shadow-[0_2px_12px_rgba(39,70,41,0.06)] before:absolute before:inset-2 before:border before:border-[#c9b37e]/28 before:rounded before:pointer-events-none before:z-[2] h-full">
      <div className="relative h-[180px] sm:h-[200px] shrink-0 border-b border-[#c9b37e]/35 bg-[#f7f3ea]/30">
        <Image
          src={event.image}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-contain"
        />
      </div>

      <div className="flex flex-col flex-1 p-[1.1rem_1.15rem_1.35rem] sm:p-[1.25rem_1.35rem_1.5rem]">
        <h4 className="m-0 font-serif text-[0.80rem] sm:text-[1.0rem] font-normal leading-[1.4] text-[#274629] font-[var(--font-malayalam-sans)]" style={{ lineHeight: "1.6", wordSpacing: "1px" }}>
          {event.title}
        </h4>

        <div
          className="h-[1px] my-[0.85rem] bg-gradient-to-r from-transparent via-[#c9b37e]/65 to-transparent shrink-0"
          aria-hidden="true"
        />

        <div className="flex flex-col gap-2 mb-[1.2rem] shrink-0">
          <p className="flex justify-between items-baseline gap-4 m-0 text-[0.92rem]">
            <span className="text-[#6b7a6b] tracking-[0.04em] text-[0.78rem] shrink-0">
              Date
            </span>
            <span className="text-[#355a2c] font-serif text-right">
              {event.date}
            </span>
          </p>
          <p className="flex justify-between items-baseline gap-4 m-0 text-[0.92rem]">
            <span className="text-[#6b7a6b] tracking-[0.04em] text-[0.78rem] shrink-0">
              Location
            </span>
            <span className="text-[#355a2c] font-serif text-right text-[0.70rem] font-[var(--font-malayalam-sans)]" style={{ lineHeight: "1.6", wordSpacing: "1px" }}>
              {event.location}
            </span>
          </p>
        </div>

        <div className="mb-5 flex-1 flex flex-col justify-start">
          <p className={`m-0 text-[#4f5c4f] text-[0.75rem] leading-[1.65] transition-all duration-300 font-[var(--font-malayalam-sans)] ${!isExpanded && isLongText ? 'line-clamp-3' : ''}`} style={{ lineHeight: "1.6", wordSpacing: "1px" }}>
            {event.description}
          </p>
          {isLongText && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[#c9b37e] text-[0.85rem] font-semibold mt-1 self-start hover:text-[#b09b6a] transition-colors"
            >
              {isExpanded ? "Show Less" : "Read More"}
            </button>
          )}
        </div>

        <button
          type="button"
          className="w-full mt-auto border border-[#355a2c] rounded bg-[#355a2c] text-[#f7f3ea] px-[1.25rem] py-[0.65rem] cursor-pointer text-[0.88rem] tracking-[0.04em] transition-colors duration-200 hover:bg-[#274629] hover:border-[#274629]"
        >
          Register Now
        </button>
      </div>
    </article>
  );
};

export default function LatestEvents() {
  const [events, setEvents] = useState(defaultEvents);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const snap = await getDoc(doc(db, "homepageConfig", "main"));
        if (snap.exists() && snap.data().events) {
          const eventsData = snap.data().events.map((e, idx) => ({
            id: `event-${idx}`,
            ...e,
          }));
          setEvents(eventsData);
        }
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };
    fetchEvents();
  }, []);

  return (
    <div id="events" className="py-10 sm:py-16">
      <div className="relative z-10 w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)] max-w-[1400px] mx-auto">
        <div className="mt-2">
          <h3 className="text-center text-[#274629] font-serif text-[clamp(2rem,4vw,3rem)] font-normal mb-8 sm:mb-12">
            Upcoming Events
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
