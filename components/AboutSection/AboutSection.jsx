"use client";

import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AboutSection() {
  const [aboutImage, setAboutImage] = useState("/images/about.png");

  const [aboutText, setAboutText] = useState(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
  );

  const [visionText, setVisionText] = useState(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
  );

  const [missionText, setMissionText] = useState(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
  );

  // ============================================================
  // FIREBASE DATA
  // ============================================================
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(
          doc(db, "homepageConfig", "main")
        );

        if (snap.exists()) {
          const data = snap.data();

          if (data.aboutUs) {
            if (data.aboutUs.image) {
              setAboutImage(data.aboutUs.image);
            }

            if (data.aboutUs.text) {
              setAboutText(data.aboutUs.text);
            }

            if (data.aboutUs.vision) {
              setVisionText(data.aboutUs.vision);
            }

            if (data.aboutUs.mission) {
              setMissionText(data.aboutUs.mission);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching about config:", error);
      }
    };

    fetchConfig();
  }, []);

  return (
    <section
      id="about"
      className="
        relative
        py-20
        md:py-24
        bg-[#fcfbf7]
        overflow-hidden
      "
    >
      {/* ======================================================
          DECORATIVE BACKGROUND
      ====================================================== */}

      <div className="absolute top-0 left-0 w-72 h-72 bg-[#274629]/[0.025] rounded-full blur-3xl pointer-events-none" />

      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#c9b37e]/[0.05] rounded-full blur-3xl pointer-events-none" />


      <div
        className="
          relative
          z-10
          max-w-[1400px]
          mx-auto
          px-6
          md:px-10
          lg:px-14
        "
      >

        {/* ======================================================
            MAIN GRID
        ====================================================== */}

        <div
          className="
            grid
            grid-cols-1
            lg:grid-cols-[0.9fr_1.1fr]
            gap-16
            lg:gap-20
            items-center
          "
        >


          {/* ==================================================
              LEFT IMAGE
          ================================================== */}

          <div className="relative flex justify-center">

            {/* Outer decorative frame */}

            <div
              className="
                absolute
                -inset-4
                rounded-2xl
                border
                border-[#c9b37e]/35
                pointer-events-none
              "
            />

            <div
              className="
                absolute
                -inset-7
                rounded-3xl
                border
                border-[#c9b37e]/15
                pointer-events-none
              "
            />


            {/* Image container */}

            <div
              className="
                relative
                w-full
                max-w-[520px]
                bg-white
                rounded-2xl
                p-3
                border
                border-[#c9b37e]/50
                shadow-[0_20px_55px_rgba(39,70,41,0.12)]
              "
            >

              <div
                className="
                  relative
                  overflow-hidden
                  rounded-xl
                  border
                  border-gray-200
                "
              >

                <img
                  src={aboutImage}
                  alt="About Us"
                  className="
                    w-full
                    h-auto
                    max-h-[680px]
                    object-cover
                    block
                    transition-transform
                    duration-700
                    hover:scale-[1.025]
                  "
                />

                {/* Soft overlay */}

                <div
                  className="
                    absolute
                    inset-0
                    bg-gradient-to-t
                    from-[#274629]/10
                    via-transparent
                    to-transparent
                    pointer-events-none
                  "
                />

              </div>

            </div>

          </div>


          {/* ==================================================
              RIGHT CONTENT
          ================================================== */}

          <div className="text-[#274629]">


            {/* ==================================================
                TITLE
            ================================================== */}

            <div className="mb-7">

              <h2
                className="
                  text-3.5xl
                  md:text-5xl
                  lg:text-[3.5rem]
                  leading-tight
                  font-serif
                  font-medium
                  text-[#274629]
                "
              >
                About Us
              </h2>


              {/* Decorative divider */}

              <div className="flex items-center gap-3 mt-5">

                <div className="h-px w-20 bg-[#c9b37e]" />

                <div
                  className="
                    w-2
                    h-2
                    bg-[#c9b37e]
                    rotate-45
                  "
                />

                <div className="h-px w-20 bg-[#c9b37e]" />

              </div>

            </div>


            {/* ==================================================
                ABOUT TEXT
            ================================================== */}

            <p
              className="
                text-[1.00rem]
                text-[#4f5c4f]
                mb-9
                whitespace-pre-wrap
                font-[var(--font-malayalam-sans)]
              "
style={{ lineHeight: "1.8", wordSpacing: "1px" }}
            >
              {aboutText}
            </p>


            {/* ==================================================
                VISION CARD
            ================================================== */}

            <div
              className="
                group
                relative
                bg-white
                rounded-2xl
                border
                border-[#d8c99d]/70
                p-6
                md:p-7
                mb-6
                shadow-[0_6px_25px_rgba(39,70,41,0.055)]
                hover:shadow-[0_15px_40px_rgba(39,70,41,0.10)]
                hover:-translate-y-1
                transition-all
                duration-300
                overflow-hidden
                font-[var(--font-malayalam-sans)]
              "
            >

              {/* Top gradient */}

              <div
                className="
                  absolute
                  top-0
                  left-0
                  right-0
                  h-1
                  bg-gradient-to-r
                  from-[#274629]
                  via-[#3f7445]
                  to-[#c9b37e]
                "
              />


              <div className="flex gap-5">


               

                {/* Vision Content */}

                <div className="flex-1">

                  <h3
                    className="
                      text-2xl
                      font-serif
                      font-medium
                      text-[#274629]
                      mb-3
                    "
                  >
                    Our Vision
                  </h3>

                  <p
                    className="tracking-wide text-[#4f5c4f] text-[0.90rem] m-0 whitespace-pre-wrap font-[var(--font-malayalam-sans)]"
                    style={{ lineHeight: "1.6", wordSpacing: "1px" }}
                  >
                    {visionText}
                  </p>

                </div>

              </div>

            </div>


            {/* ==================================================
                MISSION CARD
            ================================================== */}

            <div
              className="
                group
                relative
                bg-white
                rounded-2xl
                border
                border-[#d8c99d]/70
                p-6
                md:p-7
                shadow-[0_6px_25px_rgba(39,70,41,0.055)]
                hover:shadow-[0_15px_40px_rgba(39,70,41,0.10)]
                hover:-translate-y-1
                transition-all
                duration-300
                overflow-hidden
              "
            >

              {/* Top gradient */}

              <div
                className="
                  absolute
                  top-0
                  left-0
                  right-0
                  h-1
                  bg-gradient-to-r
                  from-[#274629]
                  via-[#3f7445]
                  to-[#c9b37e]
                "
              />


              <div className="flex gap-5">


                
                {/* Mission Content */}

                <div className="flex-1">

                  <h3
                    className="
                      text-2xl
                      font-serif
                      font-medium
                      text-[#274629]
                      mb-3
                    "
                  >
                    Our Mission
                  </h3>

                  <p
                    className="tracking-wide text-[#4f5c4f] text-[0.90rem] m-0 whitespace-pre-wrap font-[var(--font-malayalam-sans)]"
                    style={{ lineHeight: "1.6", wordSpacing: "1px" }}
                  >
                    {missionText}
                  </p>

                </div>

              </div>

            </div>


            {/* ==================================================
                BOTTOM DECORATION
            ================================================== */}

            <div
              className="
                flex
                items-center
                justify-center
                gap-3
                mt-9
              "
            >

              <div className="h-px flex-1 bg-[#d8c99d]" />

              <div
                className="
                  w-3
                  h-3
                  rotate-45
                  bg-[#c9b37e]
                "
              />

              <div className="h-px flex-1 bg-[#d8c99d]" />

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}