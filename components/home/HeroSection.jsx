"use client";

import { useEffect, useState } from "react";
import ImageSlider from "@/components/common/ImageSlider";

export default function HeroSection() {
  const [sliderImages, setSliderImages] = useState([]);

  useEffect(() => {
    fetch("/api/hero-images")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.images)) setSliderImages(data.images);
      })
      .catch(() => {});
  }, []);

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ height: "calc(100vh - 72px)" }}
    >
      <ImageSlider images={sliderImages} fullScreen />
    </section>
  );
}
