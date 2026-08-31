"use client";

import Link from "next/link";
import { Building2, BookOpen, Lightbulb, Globe } from "lucide-react";

const STATS = [
  { icon: Building2, value: "3,000+", label: "Connected Madrasas" },
  { icon: BookOpen, value: "100%", label: "Digital Content" },
  { icon: Lightbulb, value: "Smart", label: "Learning Tools" },
  { icon: Globe, value: "24/7", label: "Platform Access" },
];

export default function SmartMadrasa() {
  return (
    <section
      className="py-16 md:py-24 relative"
      style={{
        backgroundImage: "url('/bghome.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* LEFT — text */}
          <div className="flex-1 max-w-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-300 mb-3">
              Digital Islamic Education Initiative
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-5">
              Smart Madrasa
            </h2>
            <p className="text-teal-200 leading-relaxed mb-8">
              Empowering{" "}
              <span className="text-white font-semibold">3500+ madrasas</span>{" "}
              with digital content, comprehensive teacher training, and
              real-time analytics for effective Islamic education.
            </p>
            <Link
              href="/smart-class"
              className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-teal-900 font-semibold px-6 py-3 rounded-lg transition-all transform hover:scale-105 shadow-lg"
            >
              Learn More <span aria-hidden>&#x2192;</span>
            </Link>
          </div>

          {/* RIGHT — stat cards */}
          <div className="flex-1 w-full">
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto lg:max-w-none lg:ml-auto">
              {STATS.map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-6 flex flex-col items-start gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-teal-200" />
                  </div>
                  <p className="text-3xl font-bold text-white leading-none">
                    {value}
                  </p>
                  <p className="text-xs font-bold uppercase tracking-widest text-teal-300">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
