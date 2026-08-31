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



export default function Home() {
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

      <AboutSection />
      
      <UpdatesSection />
      <LatestEvents />
      
      <MushawaraSection />
      <Quotes /> 
      <OrganizationsSection />
      <Footer />
    </main>
  );
}
