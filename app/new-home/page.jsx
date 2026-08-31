import Header from "@/components/Header";
import HeroSection from "@/components/home/HeroSection";
import WhyChooseUs from "@/components/home/WhyChooseUs";
import LatestNews from "@/components/home/LatestNews";
import SmartMadrasa from "@/components/home/SmartMadrasa";
import HomeFooter from "@/components/home/HomeFooter";

export const metadata = {
  title: "DKJU - Smart Islamic Education Platform",
  description:
    "Dakshina Kerala SMART — Nurturing knowledge, character, and values through authentic Islamic education with modern learning approaches.",
};

export default function NewHomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <WhyChooseUs />
        <LatestNews limit={3} />
        <SmartMadrasa />
      </main>
      <HomeFooter />
    </div>
  );
}
