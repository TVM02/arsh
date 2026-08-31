"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function MarqueeSection() {
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "homepageConfig", "main"),
      (snap) => {
        if (snap.exists() && snap.data().marquee) {
          setAnnouncements(snap.data().marquee.map((m) => m.text));
        }
      },
      (error) => {
        console.error("Error listening to marquee:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  if (announcements.length === 0) return null;

  return (
    <section className="relative z-40 bg-gradient-to-r from-[#274629] via-[#1e361f] to-[#274629] border-y-[3px] border-[#c9b37e]/80 shadow-[0_6px_16px_rgba(0,0,0,0.25)] overflow-hidden group">
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
      <div className="w-full overflow-hidden">
        <div className="flex w-max animate-[marquee_25s_linear_infinite] group-hover:[animation-play-state:paused] group-hover:opacity-85">
          {[...announcements, ...announcements].map((item, index) => (
            <span
              key={index}
              className="shrink-0 px-10 py-[0.9rem] text-[#f7f3ea] text-[0.95rem] font-medium tracking-[0.03em] drop-shadow-md relative after:content-['•'] after:ml-24 after:text-[#c9b37e]/80"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
