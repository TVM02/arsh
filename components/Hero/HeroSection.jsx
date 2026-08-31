"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

import { buildings as defaultBuildings } from "@/data/buildings";
import MarqueeSection from "@/components/Marquee/Marquee";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const AUTOPLAY_INTERVAL_MS = 5000;

export default function HeroSection() {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState(null);
  const [direction, setDirection] = useState("forward");

  useEffect(() => {
    const fetchCarousel = async () => {
      try {
        const snap = await getDoc(doc(db, "homepageConfig", "main"));
        if (snap.exists() && snap.data().carousel && snap.data().carousel.length > 0) {
            const carouselItems = snap.data().carousel.map((c, idx) => ({
              id: `dynamic-${idx}`,
              image: c.image,
              mobileImage: c.mobileImage || c.image,
              title: c.title,
              description: "",
            }));
          setBuildings(carouselItems);
        } else {
          setBuildings(defaultBuildings);
        }
      } catch (error) {
        console.error("Error fetching carousel:", error);
        setBuildings(defaultBuildings);
      } finally {
        setLoading(false);
      }
    };
    fetchCarousel();
  }, []);

  const goToSlide = useCallback(
    (nextIndex, slideDirection) => {
      if (nextIndex === currentIndex) return;

      setDirection(
        slideDirection ?? (nextIndex > currentIndex ? "forward" : "backward"),
      );
      setPreviousIndex(currentIndex);
      setCurrentIndex(nextIndex);
    },
    [currentIndex],
  );

  const goToPrevious = useCallback(() => {
    if (buildings.length === 0) return;
    goToSlide(
      (currentIndex - 1 + buildings.length) % buildings.length,
      "backward",
    );
  }, [currentIndex, goToSlide, buildings.length]);

  const goToNext = useCallback(() => {
    if (buildings.length === 0) return;
    goToSlide((currentIndex + 1) % buildings.length, "forward");
  }, [currentIndex, goToSlide, buildings.length]);

  useEffect(() => {
    const timer = window.setInterval(goToNext, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [goToNext]);

  useEffect(() => {
    if (previousIndex === null) return;

    const timer = window.setTimeout(() => {
      setPreviousIndex(null);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [previousIndex]);

  return (
    <section
      id="home"
      className="relative w-full overflow-hidden"
      aria-label="Campus gallery"
    >
      <style>{`
        @keyframes slideInFromRight { from { transform: translateX(100%); } to { transform: translateX(0%); } }
        @keyframes slideInFromLeft { from { transform: translateX(-100%); } to { transform: translateX(0%); } }
        @keyframes slideOutToLeft { from { transform: translateX(0%); } to { transform: translateX(-100%); } }
        @keyframes slideOutToRight { from { transform: translateX(0%); } to { transform: translateX(100%); } }
      `}</style>
      <MarqueeSection />
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] md:aspect-[21/9] lg:aspect-[24/9] bg-white overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#274629]" />
          </div>
        ) : (
          <>
            <div className="absolute inset-0 overflow-hidden">
            {buildings.map((building, index) => {
            const isActive = index === currentIndex;
            const isPrevious = index === previousIndex;
            const isTransitioning = previousIndex !== null;

            return (
              <div
                key={building.id}
                className={`
                  absolute inset-0 z-10 invisible
                  ${isActive && !isTransitioning ? "!visible z-30 translate-x-0" : ""}
                  ${isActive && isTransitioning && direction === "forward" ? "!visible z-30 animate-[slideInFromRight_1200ms_ease_forwards]" : ""}
                  ${isActive && isTransitioning && direction === "backward" ? "!visible z-30 animate-[slideInFromLeft_1200ms_ease_forwards]" : ""}
                  ${isPrevious && direction === "forward" ? "!visible z-20 animate-[slideOutToLeft_1200ms_ease_forwards]" : ""}
                  ${isPrevious && direction === "backward" ? "!visible z-20 animate-[slideOutToRight_1200ms_ease_forwards]" : ""}
                `}
              >
                <div className="hidden sm:block w-full h-full relative">
                  <Image
                    src={building.image}
                    alt=""
                    fill
                    sizes="100vw"
                    priority={index === 0}
                    className="object-cover object-top"
                  />
                </div>
                <div className="block sm:hidden w-full h-full relative">
                  <Image
                    src={building.mobileImage || building.image}
                    alt=""
                    fill
                    sizes="100vw"
                    priority={index === 0}
                    className="object-cover object-top"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="absolute top-1/2 -translate-y-1/2 left-8 max-[768px]:left-4 rounded-full cursor-pointer text-2xl transition-colors duration-250 w-[56px] h-[56px] z-50 bg-white border-[1.9px] border-[#c9b37e] text-[#274629] shadow-[0_2px_10px_rgba(39,70,41,.05)] max-[768px]:w-[44px] max-[768px]:h-[44px] max-[768px]:text-[1.2rem] flex items-center justify-center"
          onClick={goToPrevious}
          aria-label="Previous image"
        >
          ←
        </button>

        <button
          type="button"
          className="absolute top-1/2 -translate-y-1/2 right-8 max-[768px]:right-4 rounded-full cursor-pointer text-2xl transition-colors duration-250 w-[56px] h-[56px] z-50 bg-white border-[1.9px] border-[#c9b37e] text-[#274629] shadow-[0_2px_10px_rgba(39,70,41,.05)] max-[768px]:w-[44px] max-[768px]:h-[44px] max-[768px]:text-[1.2rem] flex items-center justify-center"
          onClick={goToNext}
          aria-label="Next image"
        >
          →
        </button>

        <div
          className="absolute bottom-5 left-1/2 z-50 flex gap-2 -translate-x-1/2"
          role="tablist"
        >
          {buildings.map((building, index) => (
            <button
              key={building.id}
              type="button"
              role="tab"
              className={`w-[10px] h-[10px] p-0 border border-[#c9b37e]/[0.55] rounded-full bg-[#f7f3ea]/[0.65] cursor-pointer transition-colors duration-200 hover:bg-[#c9b37e]/45 hover:border-[#c9b37e]/75 ${
                index === currentIndex
                  ? "!bg-[#c9b37e] !border-[#c9b37e] hover:!bg-[#d4c08f] hover:!border-[#d4c08f]"
                  : ""
              }`}
              onClick={() => goToSlide(index)}
              aria-selected={index === currentIndex}
            />
          ))}
        </div>
          </>
        )}
      </div>
    </section>
  );
}
