import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  Users,
  UserPlus 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PortalsPage() {
  const portals = [
    {
      icon: GraduationCap,
      title: "Student",
      description: "Access your classes, assignments, notes and more",
      href: "/auth/login/digital-student",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      cardBorder: "border-blue-100",
      button:
        "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200",
    },
    {
      icon: BookOpen,
      title: "Teacher",
      description: "Manage your classes, teaching materials and students",
      href: "/auth/login/teacher",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      cardBorder: "border-emerald-100",
      button:
        "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200",
    },
  ];

  const features = [
    {
      icon: BookOpen,
      title: "Quality Learning",
    },
    {
      icon: Users,
      title: "Expert Teachers",
    },
    {
      icon: ShieldCheck,
      title: "Safe & Secure",
    },
    {
      icon: BarChart3,
      title: "Better Future",
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-white">
      {/* ================= BACKGROUND ================= */}

      {/* Soft background gradients */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-blue-50/70 blur-3xl" />
        <div className="absolute -right-40 top-40 h-[500px] w-[500px] rounded-full bg-teal-50/80 blur-3xl" />
      </div>

      {/* Islamic pattern - right side */}
      <div className="pointer-events-none absolute right-[-120px] top-[100px] h-[600px] w-[600px] opacity-[0.035]">
        <svg
          viewBox="0 0 500 500"
          className="h-full w-full text-teal-900"
        >
          <defs>
            <pattern
              id="islamicPattern"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M40 0 L50 30 L80 40 L50 50 L40 80 L30 50 L0 40 L30 30 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle
                cx="40"
                cy="40"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </pattern>
          </defs>

          <rect
            width="500"
            height="500"
            fill="url(#islamicPattern)"
          />
        </svg>
      </div>

      {/* ================= HEADER ================= */}

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 md:px-10">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-100">
            <BookOpen className="h-6 w-6 text-white" />
          </div>

          <div>
            <h2 className="text-lg font-bold leading-tight text-slate-900 sm:text-xl">
              Digital{" "}
              <span className="text-teal-600">Class Room</span>
            </h2>

            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.28em] text-slate-400">
              Learn • Practice • Grow
            </p>
          </div>
        </div>

        {/* Access badge */}
        <div className="hidden items-center  px-5 py-2.5 text-teal-700 sm:flex">
          <a
  href="/digital-admission/form"
  className="
    group
    inline-flex
    h-12
    items-center
    justify-center
    gap-2.5
    rounded-2xl
    border
    border-teal-400/20
    bg-gradient-to-r
    from-teal-500
    via-teal-600
    to-emerald-600
    px-6
    text-sm
    font-bold
    text-white
    shadow-[0_8px_24px_rgba(13,148,136,0.22)]
    transition-all
    duration-300
    hover:-translate-y-0.5
    hover:from-teal-600
    hover:via-teal-600
    hover:to-emerald-700
    hover:shadow-[0_12px_30px_rgba(13,148,136,0.32)]
    active:translate-y-0
    active:scale-[0.98]
  "
>
  <span
    className="
      flex
      h-8
      w-8
      items-center
      justify-center
      rounded-xl
      bg-white/15
      transition-all
      duration-300
      group-hover:bg-white/20
      group-hover:scale-105
    "
  >
    <UserPlus className="h-4 w-4" />
  </span>

  <span>New Admission</span>

  <ArrowRight
    className="
      h-4
      w-4
      opacity-80
      transition-transform
      duration-300
      group-hover:translate-x-1
    "
  />
</a>
        </div>
      </header>

      {/* ================= HERO ================= */}

      <section className="relative z-10 px-4 pb-44 pt-10 sm:px-6 md:pt-14">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-slate-700 sm:text-sm">
            Welcome To Our
          </p>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl lg:text-7xl">
            Digital{" "}
            <span className="text-teal-600">
              Class Room
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg">
            Select your role to access personalized features and tools
            designed for your learning journey.
          </p>

          {/* Small divider */}
          <div className="mt-7 flex items-center justify-center gap-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-teal-300" />

            <BookOpen className="h-6 w-6 text-teal-600" />

            <div className="h-px w-16 bg-gradient-to-l from-transparent to-teal-300" />
          </div>

          {/* ================= PORTAL CARDS ================= */}

          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
            {portals.map((item) => {
              const Icon = item.icon;

              return (
                <Card
                  key={item.title}
                  className={`group overflow-hidden rounded-3xl border bg-white/90 shadow-lg shadow-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${item.cardBorder}`}
                >
                  <CardContent className="p-7 sm:p-8">
                    <div
                      className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${item.iconBg}`}
                    >
                      <Icon
                        className={`h-8 w-8 ${item.iconColor}`}
                      />
                    </div>

                    <h2 className="mt-5 text-xl font-bold text-slate-900">
                      {item.title}
                    </h2>

                    <p className="mx-auto mt-2 min-h-[48px] max-w-[260px] text-sm leading-6 text-slate-500">
                      {item.description}
                    </p>

                    <Link
                      href={item.href}
                      className={`mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold shadow-lg transition-all duration-300 hover:gap-3 ${item.button}`}
                    >
                      Login
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ================= FEATURES ================= */}

          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="flex flex-col items-center"
                >
                  <Icon className="mb-2 h-6 w-6 text-teal-700" />

                  <span className="text-xs font-medium text-slate-500">
                    {feature.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= BOTTOM DECORATION ================= */}

      <div className="pointer-events-none absolute bottom-0 left-0 right-0">
        {/* Mosque silhouette */}
        <div className="absolute bottom-12 left-4 hidden opacity-[0.07] lg:block">
          <svg
            width="390"
            height="230"
            viewBox="0 0 390 230"
            fill="currentColor"
            className="text-teal-900"
          >
            <rect x="60" y="120" width="220" height="110" />

            <path d="M80 120 Q170 25 260 120 Z" />

            <rect x="20" y="70" width="30" height="160" />
            <path d="M15 70 Q35 30 55 70 Z" />

            <rect x="300" y="90" width="28" height="140" />
            <path d="M295 90 Q314 50 333 90 Z" />

            <circle cx="170" cy="50" r="7" />

            <path
              d="M174 37 A15 15 0 1 0 174 63 A11 11 0 1 1 174 37"
              fill="white"
            />
          </svg>
        </div>

        {/* Wave */}
        <svg
          viewBox="0 0 1440 180"
          className="block w-full"
          preserveAspectRatio="none"
        >
          <path
            d="M0,105 C220,190 420,120 650,140 C900,165 1080,35 1440,70 L1440,180 L0,180 Z"
            fill="#ccfbf1"
          />

          <path
            d="M0,125 C250,205 500,155 720,155 C970,155 1150,65 1440,90 L1440,180 L0,180 Z"
            fill="#99f6e4"
          />

          <path
            d="M0,145 C270,200 520,175 760,170 C1000,165 1180,95 1440,110 L1440,180 L0,180 Z"
            fill="#0f9f8f"
          />
        </svg>

        {/* Organization */}
        <div className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 sm:block">
          <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.3em] text-white/90">
            Dakshina Kerala Islam Matha Vidyabhyasa Board
          </p>
        </div>
      </div>
    </main>
  );
}