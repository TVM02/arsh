"use client";
import { useEffect } from "react";
import Image from "next/image";
import useAuthStore from "@/lib/authStore";

function Carousel() {
  const images = [
    "/one.jpg",
    "/two.jpg",
    "/three.jpg",
    "/four.jpg",
    "/five.jpg",
    "/six.jpg",
    "/seven.jpg",
    "/eight.jpg",
    "/nine.jpg",
  ];
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 3000); // 3 seconds
    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-[inherit] group">
      {images.map((src, idx) => (
        <Image
          key={src}
          src={src}
          alt={`Slide ${idx + 1}`}
          fill
          sizes="(max-width: 768px) 100vw, 700px"
          className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-700 ${
            idx === current ? "opacity-100 z-10" : "opacity-0 z-0"
          } group-hover:scale-105`}
          style={{ transitionProperty: "opacity, transform" }}
          priority={idx === 0}
        />
      ))}
      {/* Optional: Dots indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {images.map((_, idx) => (
          <span
            key={idx}
            className={`block w-2 h-2 rounded-full ${
              idx === current ? "bg-yellow-400" : "bg-white/40"
            }`}
          ></span>
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  GraduationCap,
  Users,
  BookOpen,
  Award,
  Star,
  Search,
  CheckCircle,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  Building2,
  Lightbulb,
  Globe,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MarqueeNotice from "@/components/MarqueeNotice";

export default function Home() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [showAdmissions, setShowAdmissions] = useState(false);
  const { logout, clearAuth } = useAuthStore();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { getSetting } = await import("@/lib/settingsService");
        const isVisible = await getSetting("showAdmissions", false);
        setShowAdmissions(isVisible);
      } catch (error) {
        console.error("Error fetching admission settings:", error);
      }
    };
    fetchSettings();

    const clearAllAuth = async () => {
      try {
        localStorage.clear();

        sessionStorage.clear();

        await logout();

        clearAuth();

        console.log("✅ All authentication data cleared on home page visit");
      } catch (error) {
        console.error("❌ Error clearing authentication:", error);
        localStorage.clear();
        sessionStorage.clear();
        clearAuth();
      }
    };

    clearAllAuth();
  }, [logout, clearAuth]);

  const features = [
    {
      icon: GraduationCap,
      title: "Student Management",
      description: "Comprehensive student admission and management system",
    },
    {
      icon: Users,
      title: "Multi-Role Access",
      description: "Role-based access for students, teachers, and Sadars",
    },
    {
      icon: BookOpen,
      title: "Learning Materials",
      description: "Digital content management and distribution",
    },
    {
      icon: Award,
      title: "Islamic Excellence",
      description: "Focused on Islamic education and values",
    },
  ];

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <Header />

      {/* Marquee Notice */}
      <MarqueeNotice />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 px-4 sm:px-8">
        {/* Background — herobg-2.png */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/herobg-2.png)",
            backgroundSize: "cover",
            backgroundPosition: "center center",
            backgroundRepeat: "no-repeat",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />
        {/* Very subtle dark overlay to deepen contrast slightly */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,40,30,0.18)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
        <div className="hero-bubble hero-bubble-main" />
        <div className="hero-bubble hero-bubble-small hero-float-delay" />
        {/* Soft bottom-left glow orb */}
        <div
          style={{
            width: 220,
            height: 220,
            bottom: -20,
            left: -40,
            opacity: 0.18,
            background:
              "radial-gradient(circle, rgba(107,238,208,0.15) 0%, transparent 65%)",
            filter: "blur(70px)",
            position: "absolute",
            borderRadius: "50%",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        <div className="container w-[90vw] mx-auto  px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-16 items-center">
            {/* Content */}
            <div className="space-y-6 sm:space-y-8">
              <div className="space-y-4 sm:space-y-6">
                <div className="inline-flex items-center px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-[#007060]/10 border border-[#007060]/20">
                  <Star
                    className="w-4 h-4 mr-2"
                    style={{ color: "#007060", fill: "#007060" }}
                  />
                  <span
                    className="text-xs sm:text-sm font-bold"
                    style={{ color: "#007060" }}
                  >
                    Excellence in Islamic Education
                  </span>
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
                  <span className="block text-[#08253c]">Dakshina Kerala</span>
                  <span className="block" style={{ color: "#007060" }}>
                    Islam Matha
                  </span>
                  <span className="block text-gray-700 text-xl sm:text-2xl md:text-3xl font-normal mt-1">
                    Vidyabhyasa Board
                  </span>
                </h1>
              </div>

              <p className="text-sm sm:text-lg text-gray-600 leading-relaxed max-w-xl font-arabic">
                قال النَّبِيُّ ﷺ : مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ
                عِلْمًا، سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ
              </p>

              <p className="text-sm sm:text-base text-gray-900 leading-relaxed max-w-xl">
                Nurturing knowledge, character, and values through authentic
                Islamic education with modern learning approaches.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
                <button
                  className="btn-primary inline-flex items-center justify-center text-sm sm:text-base gap-2"
                  onClick={() => (window.location.href = "/admission/form")}
                >
                  <GraduationCap className="h-5 w-5" />
                  Begin Your Journey
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button className="btn-explore inline-flex items-center justify-center text-sm sm:text-base gap-2">
                  <BookOpen className="h-5 w-5" />
                  Explore Programs
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Hero Image — white bubble card matching reference */}
            <div className="relative hidden sm:block">
              {/* Small decorative floating dots around card */}
              <div
                className="absolute top-5 -left-2 w-3.5 h-3.5 rounded-full hero-float-delay"
                style={{
                  background: "rgba(185,255,240,0.95)",
                  boxShadow: "0 0 18px rgba(107,238,208,0.6)",
                  zIndex: 5,
                  pointerEvents: "none",
                }}
              />
              <div
                className="absolute top-14 left-3 w-2 h-2 rounded-full hero-float"
                style={{
                  background: "rgba(255,255,255,0.9)",
                  boxShadow: "0 0 12px rgba(255,255,255,0.8)",
                  zIndex: 5,
                  pointerEvents: "none",
                }}
              />

              {/* White bubble card */}
              <div
                className="hero-image-bubble hero-float"
                style={{ marginLeft: "auto" }}
              >
                {/* Image */}
                <div className="hero-image-inner">
                  <Carousel />
                </div>

                {/* Stat badges INSIDE the card at the bottom */}
                <div className="flex gap-3 pt-3 pb-2 px-2">
                  <div className="hero-stat-sq">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(0,112,96,0.13)" }}
                    >
                      <GraduationCap
                        className="h-5 w-5"
                        style={{ color: "#007060", fill: "#007060" }}
                      />
                    </div>
                    <div>
                      <div
                        className="text-base font-extrabold leading-tight"
                        style={{ color: "#007060" }}
                      >
                        100K+
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 whitespace-nowrap">
                        Active Students
                      </div>
                    </div>
                  </div>
                  <div className="hero-stat-sq">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(0,112,96,0.13)" }}
                    >
                      <BookOpen
                        className="h-5 w-5"
                        style={{ color: "#007060", fill: "#007060" }}
                      />
                    </div>
                    <div>
                      <div
                        className="text-base font-extrabold leading-tight"
                        style={{ color: "#007060" }}
                      >
                        58+
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 whitespace-nowrap">
                        Madrasa Centers
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 sm:py-10 bg-white border-t border-gray-100">
        <div className="container w-[90vw] mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
            {[
              { icon: Users, value: "100K+", label: "Active Students" },
              { icon: BookOpen, value: "10K+", label: "Expert Teachers" },
              { icon: GraduationCap, value: "58+", label: "Madrasa Centers" },
              { icon: Award, value: "24/7", label: "Digital Access" },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-2 group">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-1 group-hover:scale-105 transition-transform"
                  style={{ background: "rgba(0,112,96,0.10)" }}
                >
                  <s.icon
                    className="h-6 w-6"
                    style={{ color: "#007060", fill: "#007060" }}
                  />
                </div>
                <div
                  className="text-2xl sm:text-3xl font-bold"
                  style={{ color: "#007060" }}
                >
                  {s.value}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 font-medium">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="py-16 sm:py-24 gradient-bg relative overflow-hidden"
      >
        <div className="container mx-auto px-4 sm:px-8 relative">
          {/* Subtle background glow */}
          <div
            className="glow-orb glow-orb-primary"
            style={{
              width: 400,
              height: 400,
              top: -100,
              left: -80,
              opacity: 0.5,
            }}
          />
          <div
            className="glow-orb glow-orb-secondary"
            style={{
              width: 350,
              height: 350,
              bottom: -60,
              right: -60,
              opacity: 0.4,
            }}
          />

          <div className="text-center mb-12 sm:mb-16 relative z-10">
            <div
              className="inline-flex items-center px-4 py-2 rounded-full bg-[#007060]/10 border border-[#007060]/20 text-xs sm:text-sm font-semibold mb-5"
              style={{ color: "#007060" }}
            >
              <BookOpen
                className="w-3.5 h-3.5 mr-2"
                style={{ color: "#007060", fill: "#007060" }}
              />
              Why Choose Us
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-5 leading-tight">
              Revolutionary <span style={{ color: "#007060" }}>Learning</span>{" "}
              Platform
            </h2>
            <p className="text-base sm:text-xl text-gray-500 max-w-3xl mx-auto leading-relaxed">
              Discover innovative teaching methodologies that seamlessly blend
              traditional Islamic wisdom with modern educational technology.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
            {[
              {
                icon: BookOpen,
                title: "Immersive Learning",
                desc: "Interactive lessons, multimedia content & practical exercises",
              },
              {
                icon: Users,
                title: "Collaborative Growth",
                desc: "Connect with peers, teachers & mentors worldwide",
              },
              {
                icon: Award,
                title: "Achievement Tracking",
                desc: "Monitor progress with certificates & milestone reports",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="glass-card p-6 sm:p-8 text-center cursor-pointer"
                onMouseEnter={() => setActiveFeature(index)}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: "rgba(0,112,96,0.10)" }}
                >
                  <item.icon
                    className="h-7 w-7"
                    style={{ color: "#007060", fill: "#007060" }}
                  />
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">
                  {item.title}
                </h4>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Smart Madrasa Section */}
      <section
        className="py-10 sm:py-14 text-white relative overflow-hidden px-4 sm:px-8"
        style={{
          backgroundImage: "url(/bghome.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
            {/* LEFT — text */}
            <div className="flex-1 max-w-md space-y-4">
              <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
                <span className="text-[#6beed0]">Smart </span>
                <span className="text-white">Madrasa</span>
              </h2>
              <p className="text-[#6ee7b7] text-sm sm:text-base font-medium">
                Digital Transformation Initiative
              </p>
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                Empowering{" "}
                <span className="text-white font-semibold">3000+ madrasas</span>{" "}
                with digital content, comprehensive teacher training, and
                real-time analytics for effective Islamic education.
              </p>
              <button className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-teal-900 font-semibold px-5 py-2.5 rounded-full transition-all shadow-lg text-sm">
                Learn More <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* RIGHT — 2×2 stat grid */}
            <div className="flex-1 w-full hidden sm:block">
              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto lg:max-w-none lg:ml-auto">
                {[
                  {
                    Icon: Building2,
                    value: "3,000+",
                    label: "Connected Madrasas",
                  },
                  { Icon: BookOpen, value: "100%", label: "Digital Content" },
                  { Icon: Lightbulb, value: "Smart", label: "Learning Tools" },
                  { Icon: Globe, value: "24/7", label: "Platform Access" },
                ].map(({ Icon, value, label }, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-white/10 p-5 flex flex-col items-start gap-2 hover:bg-white/5 transition-colors"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(107,238,208,0.12)" }}
                    >
                      <Icon className="w-4 h-4 text-[#6beed0]" />
                    </div>
                    <p className="text-2xl font-bold text-white leading-none">
                      {value}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#6beed0]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Admission CTA Section */}
      {showAdmissions && (
        <section
          id="admission"
          className="py-16 sm:py-24 gradient-bg relative overflow-hidden"
        >
          {/* Glow orbs */}
          <div
            className="glow-orb glow-orb-primary"
            style={{
              width: 500,
              height: 500,
              top: -80,
              right: -80,
              opacity: 0.6,
            }}
          />
          <div
            className="glow-orb glow-orb-yellow"
            style={{
              width: 300,
              height: 300,
              bottom: -60,
              left: 80,
              opacity: 0.3,
            }}
          />

          <div className="mx-auto px-4 relative z-10">
            <div className="max-w-full sm:max-w-[90%] mx-auto">
              <div
                className="relative rounded-3xl overflow-hidden shadow-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, #052e2b 0%, #063f37 55%, #064e3b 100%)",
                }}
              >
                {/* bgsmall.png — full card background, anchored left so the mosque image shows on left side */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: "url(/bgsmall.png)",
                    backgroundSize: "cover",
                    backgroundPosition: "left center",
                    backgroundRepeat: "no-repeat",
                    zIndex: 0,
                    pointerEvents: "none",
                  }}
                />
                {/* Directional overlay: transparent on left (image visible) → opaque dark-green right (text legible) */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to right, rgba(5,46,43,0.30) 0%, rgba(5,46,43,0.65) 35%, rgba(5,46,43,0.93) 65%, rgba(5,46,43,0.98) 100%)",
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                />
                {/* Teal colour cast over the image area */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to right, rgba(0,112,96,0.28) 0%, transparent 55%)",
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                />
                {/* Inner top-right glow */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 400,
                    height: 400,
                    background:
                      "radial-gradient(circle, rgba(107,238,208,0.07) 0%, transparent 65%)",
                    borderRadius: "50%",
                    filter: "blur(60px)",
                    pointerEvents: "none",
                    zIndex: 1,
                  }}
                />

                <div className="relative z-10 p-6 sm:p-12 lg:p-16">
                  <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
                    <div className="space-y-6 sm:space-y-8">
                      <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold leading-tight text-white">
                        Admission Open
                        <span className="block text-[#fbbf24]">2026–2027</span>
                      </h2>
                      <p className="text-base sm:text-xl text-[#6ee7b7] leading-relaxed">
                        Join thousands of students in our quality Islamic
                        education program and build your future on the
                        foundations of knowledge and faith.
                      </p>

                      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                        <button
                          className="btn-primary inline-flex items-center justify-center gap-2 text-sm sm:text-base"
                          onClick={() =>
                            (window.location.href = "/admission/form")
                          }
                        >
                          <GraduationCap className="h-5 w-5" />
                          Apply Now
                          <ArrowRight className="h-4 w-4" />
                        </button>

                        <div className="flex items-center gap-3 btn-secondary">
                          <div className="w-9 h-9 bg-[#fbbf24] rounded-xl flex items-center justify-center flex-shrink-0">
                            <Phone className="h-4 w-4 text-[#1a3a2a]" />
                          </div>
                          <div>
                            <div className="text-xs text-[#6ee7b7]">
                              Contact Admission Office
                            </div>
                            <div className="text-sm font-bold text-white">
                              +91 8891177850
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Trust Indicators */}
                    <div className="grid grid-cols-1 gap-3 sm:gap-4">
                      {[
                        {
                          icon: CheckCircle,
                          title: "100% Placement Rate",
                          desc: "Qualified graduates placed successfully",
                          accent: "#6beed0",
                        },
                        {
                          icon: Star,
                          title: "Minimal Registration Fee",
                          desc: "Affordable Islamic education for all",
                          accent: "#6beed0",
                        },
                        {
                          icon: Award,
                          title: "24/7 Student Support",
                          desc: "Always here to help your learning journey",
                          accent: "#6beed0",
                        },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className="glass-card-dark flex items-center gap-4 p-4 sm:p-5 hover:scale-[1.02] transition-transform"
                        >
                          <div
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: item.accent + "22" }}
                          >
                            <item.icon
                              className="h-5 w-5 sm:h-6 sm:w-6"
                              style={{ color: item.accent }}
                            />
                          </div>
                          <div>
                            <div className="text-sm sm:text-base font-bold text-white">
                              {item.title}
                            </div>
                            <div className="text-xs text-[#6ee7b7]">
                              {item.desc}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Quick Access Section */}
      {null}

      <Footer />

      <style jsx>{`
        .hero-top-right-bg {
          position: absolute;
          top: -60px;
          right: -60px;
          width: 500px;
          height: 500px;
          object-fit: cover;
          object-position: center center;
          pointer-events: none;
          z-index: 1;
          display: block;
          opacity: 1;
          border-radius: 50% 50% 50% 50% / 55% 55% 45% 45%;
          filter: drop-shadow(0 8px 40px rgba(0, 168, 107, 0.28));
        }

        .hero-bubble {
          position: absolute;
          border-radius: 9999px;
          pointer-events: none;
          z-index: 0;
        }

        .hero-bubble-main {
          top: 104px;
          right: 325px;
          width: 18px;
          height: 18px;
          background: rgba(185, 255, 240, 0.85);
          box-shadow: 0 0 24px rgba(107, 238, 208, 0.45);
        }

        .hero-bubble-small {
          top: 158px;
          right: 292px;
          width: 10px;
          height: 10px;
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 0 18px rgba(255, 255, 255, 0.55);
        }

        /* The white card — rectangular with mild rounded corners (matches reference) */
        .hero-image-bubble {
          position: relative;
          width: min(100%, 490px);
          border-radius: 20px;
          padding: 10px;
          background: #ffffff;
          box-shadow:
            0 24px 70px rgba(6, 78, 59, 0.15),
            0 6px 24px rgba(107, 238, 208, 0.14),
            0 0 0 1px rgba(255, 255, 255, 0.95);
          overflow: hidden;
          z-index: 2;
        }

        /* The image inside the card — rectangular */
        .hero-image-inner {
          width: 100%;
          aspect-ratio: 4 / 3;
          border-radius: 12px;
          overflow: hidden;
        }

        /* Squarish stat badges inside card */
        .hero-stat-sq {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          background: #ffffff;
          border-radius: 12px;
          padding: 14px 14px;
          border: 1px solid rgba(0, 112, 96, 0.1);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
          min-width: 0;
          box-sizing: border-box;
        }

        .hero-float {
          animation: heroFloat 5.5s ease-in-out infinite;
        }

        .hero-float-delay {
          animation: heroFloat 6.8s ease-in-out infinite 1.4s;
        }

        @keyframes heroFloat {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          40% {
            transform: translate3d(0, -10px, 0) scale(1.012);
          }
          70% {
            transform: translate3d(0, -6px, 0) scale(1.006);
          }
        }

        /* Bubble float for herobg gradient image */
        .hero-sea-float {
          animation: bubbleFloat 7s ease-in-out infinite;
          transform-origin: center center;
        }

        @keyframes bubbleFloat {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          30% {
            transform: translate3d(-6px, -12px, 0) scale(1.018);
          }
          60% {
            transform: translate3d(4px, -8px, 0) scale(1.01);
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @media (max-width: 1280px) {
          .hero-top-right-bg {
            width: 400px;
            height: 400px;
            right: -50px;
            top: -50px;
          }

          .hero-image-bubble {
            width: min(100%, 430px);
          }
        }

        @media (max-width: 1024px) {
          .hero-top-right-bg {
            width: 300px;
            height: 300px;
            right: -40px;
            top: -40px;
          }

          .hero-image-bubble {
            width: min(100%, 380px);
          }
        }
      `}</style>
    </div>
  );
}
