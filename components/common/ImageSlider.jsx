"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * ImageSlider — dynamic, admin-controlled.
 * Accepts `images` prop: array of { id, imageUrl, order }
 * Falls back to local `fallbackImages` (public/) when no remote images are available.
 */
const DEFAULT_FALLBACK = [
  "/one.jpg",
  "/two.jpg",
  "/three.jpg",
  "/four.jpg",
  "/five.jpg",
];

export default function ImageSlider({
  images = [],
  fallbackImages = DEFAULT_FALLBACK,
  autoPlayInterval = 3500,
  className = "",
  fullScreen = false,
}) {
  const slides =
    images.length > 0 ? images.map((i) => i.imageUrl) : fallbackImages;
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(next, autoPlayInterval);
  }, [next, autoPlayInterval]);

  useEffect(() => {
    resetTimer();
    return () => clearInterval(timerRef.current);
  }, [resetTimer]);

  const handlePrev = () => {
    prev();
    resetTimer();
  };

  const handleNext = () => {
    next();
    resetTimer();
  };

  if (slides.length === 0) return null;

  return (
    <div
      className={`relative w-full h-full overflow-hidden group select-none ${fullScreen ? "" : "min-h-[320px] rounded-2xl"} ${className}`}
    >
      {/* Slides */}
      {slides.map((src, idx) => (
        <div
          key={idx}
          className={`absolute inset-0 transition-opacity duration-700 ${
            idx === current ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
        >
          <Image
            src={src}
            alt={`Slide ${idx + 1}`}
            fill
            sizes="100vw"
            className="object-cover"
            priority={idx === 0}
          />
        </div>
      ))}

      {/* Prev / Next arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 transition-all opacity-0 group-hover:opacity-100"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 transition-all opacity-0 group-hover:opacity-100"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrent(idx);
                resetTimer();
              }}
              className={`block rounded-full transition-all duration-300 ${
                idx === current
                  ? "w-5 h-2 bg-yellow-400"
                  : "w-2 h-2 bg-white/50 hover:bg-white/80"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
