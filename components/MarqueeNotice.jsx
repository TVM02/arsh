"use client";

import { useState, useEffect } from "react";
import { X, Bell } from "lucide-react";
import { collection, getDocs, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const getDateValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  if (typeof value._seconds === "number")
    return new Date(value._seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isActiveDashboardNotice = (notice) => {
  if (
    notice.deleted ||
    notice.isActive === false ||
    notice.showOnDashboard === false
  ) {
    return false;
  }

  const expiryDate = getDateValue(
    notice.expiryDate || notice.expiresAt || notice.endDate,
  );

  return !expiryDate || expiryDate >= new Date();
};

export default function MarqueeNotice() {
  const [marqueeTexts, setMarqueeTexts] = useState([]);
  const [isVisible, setIsVisible] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (marqueeTexts.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % marqueeTexts.length);
      }, 80000); // 25 seconds per message
      return () => clearInterval(interval);
    }
  }, [marqueeTexts]);

  useEffect(() => {
    const marqueeQuery = query(
      collection(db, "marqueeTexts")
    );

    const unsubscribe = onSnapshot(marqueeQuery, { includeMetadataChanges: true }, (snapshot) => {
      // Prevent UI glitch: Ignore the initial stale cache hit and only render fresh server data
      if (snapshot.metadata.fromCache) {
        return;
      }

      let marqueeData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Filter active notices
      marqueeData = marqueeData.filter(m => m.isActive === true);
      
      // Sort by priority (asc) then createdAt (desc) in memory to avoid missing Firestore indexes
      marqueeData.sort((a, b) => {
        const priorityA = a.priority || 0;
        const priorityB = b.priority || 0;
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      
      setMarqueeTexts(marqueeData);
    }, (error) => {
      console.error("Error listening to marquee texts:", error);
    });

    return () => unsubscribe();
  }, []);

  if (marqueeTexts.length === 0 || !isVisible) return null;

  const currentNotice = marqueeTexts[currentIndex];

  return (
    <div className="text-black bg-white py-2 px-4 relative overflow-hidden border-b-2 border-[#c9b37e]/50 shadow-[0_3px_12px_rgba(39,70,41,0.08),0_1px_0_rgba(201,179,126,0.3)] backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="flex items-center space-x-2 flex-shrink-0">
            <div className="w-1 h-6 rounded-full bg-gradient-to-b from-[#c9b37e] to-[#355a2c] mr-2 flex-shrink-0" />
            <Bell className="h-4 w-4 animate-pulse" />
            <span className="font-semibold text-sm">Notice:</span>
          </div>
          <div className="overflow-hidden w-full">
            <div className="marquee-slide-wrapper">
              <div
                key={currentNotice.id + currentIndex} // change key to reset animation
                className="marquee-slide-text"
                style={{
                  color: currentNotice.textColor || "#000000",
                }}
              >
                {currentNotice.text}
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="ml-4 flex-shrink-0 hover:bg-black hover:bg-opacity-20 rounded-full p-1 transition-colors"
          aria-label="Close notice"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <style jsx>{`
        .marquee-slide-wrapper {
          width: 100%;
          overflow: hidden;
          position: relative;
        }

        .marquee-slide-text {
          display: inline-block;
          white-space: nowrap;
          animation: slide-left 80s linear 1;
        }

        @keyframes slide-left {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }

        @media (hover: hover) {
          .marquee-slide-text:hover {
            animation-play-state: paused;
          }
        }
      `}</style>
    </div>
  );
}
