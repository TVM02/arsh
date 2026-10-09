import Link from "next/link";
import {
  Award,
  BookOpen,
  Building,
  CheckCircle,
  GraduationCap,
  Search,
  Star,
  Trophy,
  Users,
 MonitorCog
} from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PortalsPage() {
  const portals = [
    {
      icon: GraduationCap,
      title: "Student",
      href: "/auth/login/student",
      color: "blue",
    },
    {
      icon: BookOpen,
      title: "Teacher",
      href: "/auth/login/teacher",
      color: "green",
    },
    {
      icon: Users,
      title: "Sadar",
      href: "/auth/login/madarsa-admin",
      color: "purple",
    },
    {
      icon: Search,
      title: "Inspector (Thaftheesh)",
      href: "/auth/login/inspector",
      color: "teal",
    },

    {
      icon: Star,
      title: "District Portal",
      href: "/auth/login/district",
      color: "yellow",
    },
    {
      icon: Building,
      title: "Mekhala Portal",
      href: "/auth/login/mekhala-admin",
      color: "teal",
    },
    {
      icon: Award,
      title: "Convener Portal",
      href: "/auth/login/convener",
      color: "indigo",
    },
    {
      icon: CheckCircle,
      title: "Exam Board",
      href: "/auth/login/pariksha-board-convener",
      color: "orange",
    },
    {
      icon: Users,
      title: "Management Portal",
      href: "/auth/login/manager",
      color: "teal",
    },
    {
      icon: Trophy,
      title: "State Portal",
      href: "/auth/login/state",
      color: "teal",
    },
    {
      icon: MonitorCog,
      title: "IT Coordinators",
      href: "/coming-soon",
      color: "teal",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section className="py-16 sm:py-24 bg-white relative overflow-hidden px-4 sm:px-8">
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-12 sm:mb-20">
            <div className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 rounded-full bg-teal-100 text-teal-700 text-xs sm:text-sm font-medium mb-6 sm:mb-8 border border-teal-200">
              <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Access Portal
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight">
              Choose Your&nbsp;
              <span className="text-teal-600">Portal</span>
            </h1>

            <p className="text-base sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Select your role to access personalized features and tools
              designed for your needs
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-7xl mx-auto">
            {portals.map((item) => (
              <Card
                key={item.title}
                className="hover:shadow-md sm:hover:shadow-lg transition-shadow duration-300 cursor-pointer group"
              >
                <CardContent className="p-4 sm:p-6 text-center">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 bg-${item.color}-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:bg-${item.color}-200 transition-colors`}
                  >
                    <item.icon
                      className={`h-5 w-5 sm:h-6 sm:w-6 text-${item.color}-600`}
                    />
                  </div>
                  <h2 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">
                    {item.title}
                  </h2>
                  <Link href={item.href}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs sm:text-sm"
                    >
                      Login
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
