"use client";
import { useEffect } from "react";
import {
  GraduationCap,
  Users,
  BookOpen,
  Award,
  Star,
  CheckCircle,
  Calendar,
  Target,
  Heart,
  Globe,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Linkedin,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Image from "next/image";
import useAuthStore from "@/lib/authStore";

export default function About() {
  const { logout, clearAuth } = useAuthStore();

  useEffect(() => {
    const clearAllAuth = async () => {
      try {
        localStorage.clear();

        sessionStorage.clear();

        await logout();

        clearAuth();

        console.log("✅ About page visit - auth cleared");
      } catch (error) {
        console.error("❌ Error clearing authentication:", error);
        localStorage.clear();
        sessionStorage.clear();
        clearAuth();
      }
    };

    clearAllAuth();
  }, [logout, clearAuth]);

  const organizations = [
    {
      icon: "🎓",
      title: "DKIMVB",
      subtitle: "Dakshina Kerala Islamic Religious Education Board",
      description: "Leading Islamic education initiatives across Kerala",
      color: "teal",
    },
    {
      icon: "👨‍🏫",
      title: "DKLM",
      subtitle: "Dakshina Kerala Lajnathul Muallimeen",
      description: "Dedicated to teacher training and development",
      color: "yellow",
    },
    {
      icon: "🌟",
      title: "KMYF",
      subtitle: "Dakshina Kerala Muslim Yuvajana Federation",
      description: "Empowering youth through Islamic values",
      color: "green",
    },
    {
      icon: "📚",
      title: "DKISF",
      subtitle: "Dakshina Kerala Islamic Students Federation",
      description: "Supporting student community development",
      color: "blue",
    },
  ];

  const achievements = [
    {
      year: "2017",
      title: "Foundation of Digital Initiative",
      description: "Launched the first digital learning platform for madrasas",
    },
    {
      year: "2019",
      title: "Smart Madrasa Program",
      description: "Introduced technology-integrated teaching methods",
    },
    {
      year: "2020",
      title: "Online Learning Revolution",
      description: "Adapted to digital-first education during pandemic",
    },
    {
      year: "2021",
      title: "10,000+ Students Milestone",
      description: "Reached significant enrollment across all programs",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-teal-900 text-white py-12 sm:py-20 px-4 sm:px-8">


        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 rounded-full bg-yellow-400/20 border border-yellow-400/30 backdrop-blur-sm mb-6 sm:mb-8">
              <BookOpen className="w-4 h-4 text-white mr-2" />
              <span className="text-white text-xs sm:text-sm font-bold">
                About Our Institution
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 sm:mb-8">
              <span className="block bg-gradient-to-r from-white to-teal-100 bg-clip-text text-transparent">
                About Us
              </span>
              <span className="block text-yellow-400 text-2xl sm:text-4xl md:text-5xl mt-2 sm:mt-4">
                Dakshina Kerala Islam Matha
              </span>
              <span className="block text-yellow-400 text-2xl sm:text-4xl md:text-5xl">
                Vidyabhyasa Board
              </span>
            </h1>

            <p className="text-base sm:text-xl text-teal-100 leading-relaxed max-w-3xl mx-auto">
              We provide the best online courses, revolutionizing Islamic
              education through innovative digital learning experiences that
              honor tradition while embracing the future.
            </p>
          </div>
        </div>
      </section>

      {/* History Section */}
      <section className="py-12 sm:py-24 bg-gray-50 relative">
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-12 sm:mb-20">
            <div className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 rounded-full bg-teal-100 text-teal-700 text-xs sm:text-sm font-bold mb-6 sm:mb-8 border border-teal-200">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Our Foundation
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6 sm:mb-8 leading-tight">
              Our
              <span className="block text-teal-600">Heritage</span>
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 sm:gap-16 items-center">
            <div className="space-y-6 sm:space-y-8">
              <div className="bg-white rounded-xl sm:rounded-3xl p-6 sm:p-8 shadow-lg border border-gray-100">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6">
                  <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
                  Founded in 1955
                </h3>
                <div className="text-sm sm:text-lg text-gray-700 leading-relaxed mb-4 sm:mb-6">
                  <p className="mb-3 sm:mb-4">
                    The Dakshina Kerala Jam-Iyyathul Ulama was established on{" "}
                    <span className="font-bold text-teal-600">
                      June 26, 1955
                    </span>{" "}
                    by visionary scholars:
                  </p>
                  <ul className="space-y-2 sm:space-y-3">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-teal-600 mr-2 sm:mr-3" />
                      M. Shihabuddin Maulavi
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-teal-600 mr-2 sm:mr-3" />
                      P.K. Yusuf Maulavi
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-teal-600 mr-2 sm:mr-3" />
                      Umarkutty Maulavi
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-teal-600 mr-2 sm:mr-3" />
                      Hafeed Maulavi (R)
                    </li>
                  </ul>
                  <p className="mt-3 sm:mt-4 text-gray-600">
                    These great scholars laid the foundation of our institution.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-2 sm:-inset-4 bg-gradient-to-r from-teal-200/50 to-yellow-200/50 rounded-xl sm:rounded-3xl blur-xl"></div>
              <div className="relative bg-white rounded-xl sm:rounded-3xl p-6 sm:p-8 shadow-lg sm:shadow-2xl border border-gray-100">
                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                  {[
                    { value: "69", label: "Years of Excellence", icon: "🏆" },
                    { value: "3000+", label: "Madrasas", icon: "🏛️" },
                    { value: "1000+", label: "Students", icon: "👥" },
                    { value: "50+", label: "Expert Teachers", icon: "👨‍🏫" },
                  ].map((stat, index) => (
                    <div
                      key={index}
                      className="text-center p-4 sm:p-6 bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg sm:rounded-2xl hover:scale-105 transition-transform cursor-pointer"
                    >
                      <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">
                        {stat.icon}
                      </div>
                      <div className="text-xl sm:text-3xl font-bold text-teal-600 mb-1">
                        {stat.value}
                      </div>
                      <div className="text-xs sm:text-sm text-teal-700 font-medium">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Organizations Section */}
      <section className="py-12 sm:py-24 bg-white relative overflow-hidden">
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-12 sm:mb-20">
            <div className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 rounded-full bg-yellow-100 text-yellow-700 text-xs sm:text-sm font-bold mb-6 sm:mb-8 border border-yellow-200">
              <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Our Network
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6 sm:mb-8 leading-tight">
              Associated
              <span className="block text-teal-600">Organizations</span>
            </h2>
            <p className="text-base sm:text-xl text-gray-600 max-w-3xl mx-auto">
              A comprehensive network of educational and community organizations
              working together for the advancement of Islamic education
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {organizations.map((org, index) => (
              <div
                key={index}
                className="group bg-white rounded-xl sm:rounded-3xl p-6 sm:p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 sm:hover:-translate-y-2"
              >
                <div className="text-center space-y-4 sm:space-y-6">
                  <div className="text-4xl sm:text-6xl mb-3 sm:mb-4 group-hover:scale-110 transition-transform flex justify-center items-center ">
                    <Image
                      src={"/logo.png"}
                      alt={org.title}
                      width={100}
                      height={100}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2 group-hover:text-teal-600 transition-colors">
                      {org.title}
                    </h3>
                    <p className="text-xs sm:text-sm font-medium text-gray-600 mb-2 sm:mb-4">
                      {org.subtitle}
                    </p>
                    <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                      {org.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Teaching Philosophy Section */}
      <section className="py-12 sm:py-24 bg-gradient-to-br from-gray-900 via-teal-900 to-gray-900 text-white relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12 sm:mb-20">
            <div className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 rounded-full bg-yellow-400/20 border border-yellow-400/30 backdrop-blur-sm mb-6 sm:mb-8">
              <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-white mr-2" />
              <span className="text-white text-xs sm:text-sm font-bold">
                OUR PHILOSOPHY
              </span>
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6 sm:mb-8">
              <span className="block text-yellow-400">Teaching Makes You</span>
              <span className="block text-white">Productive</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                number: "01",
                title: "Empowering Through Quality Education",
                description:
                  "Providing comprehensive Islamic education that empowers students with knowledge and values for a successful future.",
                icon: Target,
              },
              {
                number: "02",
                title: "Teaching That Transforms",
                description:
                  "Our innovative teaching methodologies transform lives by combining traditional wisdom with modern educational techniques.",
                icon: GraduationCap,
              },
              {
                number: "03",
                title: "Learn Better. Grow Smarter.",
                description:
                  "Fostering an environment where students can excel academically while developing strong moral character and leadership skills.",
                icon: Star,
              },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-sm sm:backdrop-blur-lg rounded-xl sm:rounded-3xl p-6 sm:p-8 border border-white/20 hover:bg-white/20 transition-all hover:scale-[1.02] sm:hover:scale-105"
              >
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-4xl sm:text-6xl font-bold text-yellow-400/30">
                      {item.number}
                    </span>
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-yellow-400/20 rounded-lg sm:rounded-2xl flex items-center justify-center">
                      <item.icon className="h-5 w-5 sm:h-8 sm:w-8 text-yellow-400" />
                    </div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm sm:text-base text-teal-200 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Achievements Timeline */}
      <section className="py-12 sm:py-24 bg-gray-50 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-20">
            <div className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 rounded-full bg-teal-100 text-teal-700 text-xs sm:text-sm font-bold mb-6 sm:mb-8 border border-teal-200">
              <Award className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Our Journey
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6 sm:mb-8 leading-tight">
              Great
              <span className="block text-teal-600">Achievements</span>
            </h2>
          </div>

          <div className="relative">
            {/* Mobile Timeline Line */}
            <div className="absolute left-6 sm:left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-teal-500 to-yellow-500 rounded-full hidden sm:block"></div>

            <div className="space-y-8 sm:space-y-16">
              {achievements.map((achievement, index) => (
                <div
                  key={index}
                  className={`flex flex-col sm:items-center ${index % 2 === 0 ? "sm:flex-row" : "sm:flex-row-reverse"
                    } sm:space-x-8 lg:space-x-16 space-y-4 sm:space-y-0`}
                >
                  {/* Content */}
                  <div className="sm:w-1/2 w-full">
                    <div
                      className={`bg-white rounded-xl sm:rounded-3xl p-6 sm:p-8 shadow-lg border border-gray-100 hover:shadow-xl sm:hover:shadow-2xl transition-all hover:-translate-y-1 sm:hover:-translate-y-2 text-center sm:text-left`}
                    >
                      <div className="space-y-3 sm:space-y-4">
                        <div className="text-2xl sm:text-4xl font-bold text-teal-600">
                          {achievement.year}
                        </div>
                        <h3 className="text-lg sm:text-2xl font-bold text-gray-900">
                          {achievement.title}
                        </h3>
                        <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                          {achievement.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Timeline Dot - Hidden on mobile */}
                  <div className="hidden sm:block">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-teal-500 to-yellow-500 rounded-full border-4 border-white shadow-lg"></div>
                  </div>

                  {/* Empty Space for desktop */}
                  <div className="sm:w-1/2 hidden sm:block"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Social Media Section */}
      <section className="py-12 sm:py-24 bg-white relative overflow-hidden">
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-12 sm:mb-20">
            <div className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 rounded-full bg-yellow-100 text-yellow-700 text-xs sm:text-sm font-bold mb-6 sm:mb-8 border border-yellow-200">
              <Globe className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Stay Connected
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6 sm:mb-8 leading-tight">
              Follow Us On
              <span className="block text-teal-600">Social Media</span>
            </h2>
            <p className="text-base sm:text-xl text-gray-600 max-w-3xl mx-auto">
              Stay updated with our latest news, events, and educational content
              across all social media platforms
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 sm:gap-6 max-w-6xl mx-auto">
            {[
              {
                name: "Facebook",
                icon: Facebook,
                color: "blue-600",
                bgColor: "blue-50",
                hoverColor: "blue-100",
                followers: "10K+",
                handle: "@dkimvb",
              },
              {
                name: "Twitter",
                icon: Twitter,
                color: "sky-500",
                bgColor: "sky-50",
                hoverColor: "sky-100",
                followers: "5K+",
                handle: "@dkimvb_edu",
              },
              {
                name: "Instagram",
                icon: Instagram,
                color: "pink-600",
                bgColor: "pink-50",
                hoverColor: "pink-100",
                followers: "8K+",
                handle: "@dkimvb_official",
              },
              {
                name: "YouTube",
                icon: Youtube,
                color: "red-600",
                bgColor: "red-50",
                hoverColor: "red-100",
                followers: "15K+",
                handle: "DKIMVB Channel",
              },
              {
                name: "LinkedIn",
                icon: Linkedin,
                color: "blue-700",
                bgColor: "blue-50",
                hoverColor: "blue-100",
                followers: "3K+",
                handle: "DKIMVB",
              },
            ].map((social, index) => (
              <div
                key={index}
                className={`bg-${social.bgColor} hover:bg-${social.hoverColor} rounded-xl sm:rounded-3xl p-4 sm:p-6 text-center transition-all duration-300 hover:-translate-y-1 sm:hover:-translate-y-2 cursor-pointer group border border-gray-100 hover:shadow-md sm:hover:shadow-lg`}
              >
                <div className="space-y-2 sm:space-y-4">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 bg-${social.color}/10 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform`}
                  >
                    <social.icon
                      className={`h-5 w-5 sm:h-6 sm:w-6 text-${social.color}`}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-1">
                      {social.name}
                    </h3>
                    <p
                      className={`text-xs sm:text-sm text-${social.color} font-medium mb-1`}
                    >
                      {social.followers} Followers
                    </p>
                    <p className="text-xs text-gray-600">{social.handle}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Social Media CTA */}
          <div className="mt-12 sm:mt-20 text-center">
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl sm:rounded-3xl p-8 sm:p-12 max-w-4xl mx-auto">
              <div className="space-y-4 sm:space-y-6">
                <h3 className="text-2xl sm:text-4xl font-bold text-white">
                  Join Our Community
                </h3>
                <p className="text-base sm:text-xl text-teal-100 max-w-2xl mx-auto">
                  Be part of our growing community and stay updated with the
                  latest in Islamic education, events, and inspirational
                  content.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                  <button
                    className="bg-yellow-400 hover:bg-yellow-500 text-teal-800 font-bold px-6 py-3 sm:px-8 sm:py-4 rounded-lg sm:rounded-xl transition-all hover:scale-105 flex items-center justify-center text-sm sm:text-base"
                    onClick={() => window.open("/admission/form", "_blank")}
                  >
                    <Globe className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Enroll Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
