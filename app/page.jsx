"use client";

import AboutSection from "@/components/AboutSection/AboutSection";
import Footer from "@/components/Footer/Footer";
import HeroSection from "@/components/Hero/HeroSection";
import MushawaraSection from "@/components/MushawaraSection/MushawaraSection";
import UpdatesSection from "@/components/UpdatesSection/UpdatesSection";
import Navbar from "@/components/Navbar/Navbar";
import LatestEvents from "@/components/UpdatesSection/LatestEvents";
import OrganizationsSection from "@/components/OrganizationsSection/OrganizationsSection";
import HijriCalendar from "@/components/UpdatesSection/HijriCalendar";
import Quotes from "@/components/UpdatesSection/Quotes";
import ThanfaseLiveScoreboard
  from "@/components/UpdatesSection/ThanfaseLiveScoreboard";
import { useEffect, useState } from "react";
import { getCompetitionConfig } from "@/lib/competitionService";

export default function Home() {
  const [homeThanfasLiveScoreVisible, setHomeThanfasLiveScoreVisible] =
  useState(false);

const [thanfasConfigLoading, setThanfasConfigLoading] =
  useState(true);

useEffect(() => {
  const loadCompetitionConfig =
    async () => {
      try {
        setThanfasConfigLoading(true);

        const cfg =
          await getCompetitionConfig();

        setHomeThanfasLiveScoreVisible(
          cfg?.homeThanfasLiveScoreVisible ??
            true,
        );
      } catch (error) {
        console.error(
          "HOME COMPETITION CONFIG ERROR:",
          error,
        );

        setHomeThanfasLiveScoreVisible(
          false,
        );
      } finally {
        setThanfasConfigLoading(false);
      }
    };

  loadCompetitionConfig();
}, []);
  return (
    <main
      style={{
        backgroundColor: "#ffffff",
        color: "#222222",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      <Navbar />
      <HeroSection />
      <HijriCalendar />
{!thanfasConfigLoading &&
  homeThanfasLiveScoreVisible && (
      <div className="w-full min-w-0 max-w-full overflow-hidden">
      <ThanfaseLiveScoreboard />
   </div>
  )}
      <UpdatesSection />
      <LatestEvents />
      
      <MushawaraSection />
      <Quotes /> 
      <AboutSection />
      <OrganizationsSection />
      <Footer />
    </main>
  );
}
