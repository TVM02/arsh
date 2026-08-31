"use client";
import { useEffect, useState } from "react";
import {
  GraduationCap,
  Users,
  BookOpen,
  Award,
  Star,
  CheckCircle,
  ArrowRight,
  Phone,
  Crown,
  Shield,
  Heart,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import useAuthStore from "@/lib/authStore";

export default function Leaders() {
  const [activeLeader, setActiveLeader] = useState(0);

    const { logout, clearAuth } = useAuthStore();
  
    useEffect(() => {
      const clearAllAuth = async () => {
        try {
          localStorage.clear();
  
          sessionStorage.clear();
          
          await logout();
          
          clearAuth();
          
          console.log('✅ All authentication data cleared on home page visit');
        } catch (error) {
          console.error('❌ Error clearing authentication:', error);
          localStorage.clear();
          sessionStorage.clear();
          clearAuth();
        }
      };
  
      clearAllAuth();
    }, [logout, clearAuth]);

  const leaders = [
    {
      name: "O Abu Thalha Abdu Rahman Hajrath Al Qasimi",
      position: "President",
      image: "/person1.jpg",
      icon: Crown,
      color: "teal",
      experience: "25+ Years",
    },
    {
      name: "Muhammed Kunju Maulavi",
      position: "General Secretary",
      image: "https://mosherhan.github.io/dkimv/images/about-02.jpg",
      icon: Shield,
      color: "yellow",
      experience: "20+ Years",
    },
    {
      name: "Kadakkal Abdul Azeez Maulavi",
      position: "President Jama'ath Federation",
      image: "https://mosherhan.github.io/dkimv/images/about-03.jpg",
      icon: Users,
      color: "green",
      experience: "18+ Years",
    },
    {
      name: "Pangode Kamarudheen Moulavi",
      position: "Secretary, DKIMVB",
      image: "https://mosherhan.github.io/dkimv/images/about-04.jpg",
      icon: BookOpen,
      color: "blue",
      experience: "15+ Years",
    },
      {
      name: "A.K. Umar Maulavi",
      position: "Chairman, DKIMVB",
      image: "/leader.png",
      icon: BookOpen,
      color: "blue",
      experience: "15+ Years",
    },
  ];

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-teal-900 text-white py-12 sm:py-20 px-4 sm:px-8">


        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 rounded-full bg-yellow-400/20 border border-yellow-400/30 backdrop-blur-sm mb-6 sm:mb-8">
              <Crown className="w-4 h-4 text-white mr-2" />
              <span className="text-white text-xs sm:text-sm font-bold">
                Our Leadership Team
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 sm:mb-8">
              <span className="block bg-gradient-to-r from-white to-teal-100 bg-clip-text text-transparent">
                Leaders
              </span>
              <span className="block text-yellow-400 text-2xl sm:text-4xl md:text-5xl mt-2 sm:mt-4">
                Guiding Our Vision
              </span>
            </h1>

            <p className="text-base sm:text-xl text-teal-100 leading-relaxed max-w-3xl mx-auto">
              Meet the dedicated leaders who are steering our institution
              towards excellence in Islamic education and community development.
            </p>
          </div>
        </div>
      </section>

      {/* Leaders Grid Section */}
      <section className="py-12 sm:py-24 bg-gray-50 relative">
        <div className="container mx-auto px-4 relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-6xl mx-auto">
            {leaders.map((leader, index) => (
              <div
                key={index}
                className="group bg-white rounded-xl sm:rounded-3xl overflow-hidden shadow-md sm:shadow-lg border border-gray-100 hover:shadow-xl sm:hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 sm:hover:-translate-y-2"
                onMouseEnter={() => setActiveLeader(index)}
              >
                <div className="relative">
                  {/* Profile Image */}
                  <div className="relative h-48 sm:h-64 overflow-hidden">
                    <img
                      src={leader.image}
                      alt={leader.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent"></div>
                  </div>

                  {/* Content */}
                  <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                    <div className="space-y-2 sm:space-y-3">
                      <h3 className="text-lg sm:text-2xl font-bold text-gray-900 group-hover:text-teal-600 transition-colors">
                        {leader.name}
                      </h3>
                      <p className={`text-${leader.color}-600 font-semibold text-sm sm:text-lg`}>
                        {leader.position}
                      </p>
                      <div className="flex items-center text-sm sm:text-base text-gray-600">
                        <leader.icon className={`h-4 w-4 sm:h-5 sm:w-5 text-${leader.color}-500 mr-2`} />
                        <span>{leader.experience} Experience</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership Philosophy Section */}
      <section className="py-12 sm:py-24 bg-gradient-to-br from-gray-900 via-teal-900 to-gray-900 text-white relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12 sm:mb-20">
            <div className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 rounded-full bg-yellow-400/20 border border-yellow-400/30 backdrop-blur-sm mb-6 sm:mb-8">
              <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-white mr-2" />
              <span className="text-white text-xs sm:text-sm font-bold">
                LEADERSHIP PHILOSOPHY
              </span>
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6 sm:mb-8">
              <span className="block text-yellow-400">
                Visionary Leadership
              </span>
              <span className="block text-white">For Excellence</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                title: "Educational Innovation",
                description: "Leading the transformation of traditional Islamic education through modern technology and innovative teaching methodologies.",
                icon: BookOpen,
                stats: "3000++ Madrasas",
              },
              {
                title: "Community Development",
                description: "Building stronger communities through educational empowerment and social initiatives that benefit all stakeholders.",
                icon: Users,
                stats: "25+ Years Experience",
              },
              {
                title: "Strategic Vision",
                description: "Guiding the organization towards sustainable growth while maintaining core Islamic values and educational excellence.",
                icon: Crown,
                stats: "1000+ Students",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-sm sm:backdrop-blur-lg rounded-xl sm:rounded-3xl p-6 sm:p-8 border border-white/20 hover:bg-white/20 transition-all hover:scale-[1.02] sm:hover:scale-105"
              >
                <div className="space-y-4 sm:space-y-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-yellow-400/20 rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <item.icon className="h-5 w-5 sm:h-8 sm:w-8 text-yellow-400" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm sm:text-base text-teal-200 leading-relaxed">
                    {item.description}
                  </p>
                  <div className="pt-3 sm:pt-4 border-t border-white/20">
                    <span className="text-yellow-400 font-bold text-base sm:text-lg">
                      {item.stats}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-12 w-full bg-gradient-to-br from-gray-50 to-white relative">
        <div className="container mx-auto px-4">
          <div className="max-w-full sm:max-w-[95vw] mx-auto">
            <div className="bg-gradient-to-r from-teal-600 via-teal-700 to-teal-800 rounded-xl sm:rounded-3xl overflow-hidden shadow-lg sm:shadow-2xl relative">
              <div className="relative z-10 p-6 sm:p-8 lg:p-12">
                <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
                  <div className="space-y-6 sm:space-y-8">
                    <div className="space-y-4 sm:space-y-6">
                      <div className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 rounded-full bg-yellow-400/20 border border-yellow-400/30 backdrop-blur-sm">
                        <div className="w-2 h-2 bg-white rounded-full mr-3 animate-pulse"></div>
                        <span className="text-white text-xs sm:text-sm font-bold">
                          ADMISSION OPEN NOW
                        </span>
                      </div>

                      <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold leading-tight text-white">
                        Admission is open
                        <span className="block text-yellow-400">
                          for the next year batch
                        </span>
                      </h2>

                      <p className="text-base sm:text-xl text-teal-100 leading-relaxed">
                        Join our prestigious institution under the guidance of
                        our experienced leadership team. Get started on your
                        journey towards educational excellence.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                      <button
                        className="bg-yellow-400 hover:bg-yellow-500 text-teal-800 font-bold px-6 py-3 sm:px-10 sm:py-4 rounded-lg sm:rounded-xl shadow-md sm:shadow-lg hover:shadow-xl sm:hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center text-sm sm:text-base"
                        onClick={() => (window.location.href = "/admission/form")}
                      >
                        <GraduationCap className="mr-2 sm:mr-3 h-4 w-4 sm:h-6 sm:w-6" />
                        Enroll
                        <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                      </button>

                      <div className="flex items-center space-x-3 sm:space-x-4 bg-white/10 rounded-lg sm:rounded-xl px-4 py-3 sm:px-6 sm:py-4 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors">
                        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-yellow-400 rounded-lg sm:rounded-xl flex items-center justify-center">
                          <Phone className="h-4 w-4 sm:h-6 sm:w-6 text-teal-800" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm text-teal-200">
                            Call us now
                          </div>
                          <div className="text-sm sm:text-lg font-bold text-white">
                            +91 8891177850
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trust Indicators */}
                  <div className="space-y-6 sm:space-y-8">
                    <div className="grid grid-cols-1 gap-4 sm:gap-6">
                      {[
                        {
                          icon: Crown,
                          title: "Expert Leadership",
                          desc: "Guided by experienced professionals",
                          color: "yellow",
                        },
                        {
                          icon: CheckCircle,
                          title: "Proven Track Record",
                          desc: "Decades of educational excellence",
                          color: "green",
                        },
                        {
                          icon: Star,
                          title: "Quality Education",
                          desc: "Comprehensive Islamic learning",
                          color: "blue",
                        },
                      ].map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3 sm:space-x-4 bg-white/10 rounded-lg sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all hover:scale-[1.02] sm:hover:scale-105"
                        >
                          <div
                            className={`w-10 h-10 sm:w-14 sm:h-14 bg-${item.color}-400/20 rounded-lg sm:rounded-xl flex items-center justify-center`}
                          >
                            <item.icon
                              className={`h-5 w-5 sm:h-7 sm:w-7 text-${item.color}-400`}
                            />
                          </div>
                          <div>
                            <div className="text-sm sm:text-lg font-bold text-white">
                              {item.title}
                            </div>
                            <div className="text-xs sm:text-sm text-teal-200">
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
        </div>
      </section>

      <Footer />
    </div>
  );
}