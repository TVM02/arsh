"use client";
import { useEffect, useState } from "react";
import {
  GraduationCap,
  Star,
  CheckCircle,
  ArrowRight,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Eye,
  Heart,
  Share2,
} from "lucide-react";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import useAuthStore from "@/lib/authStore";

export default function Events() {
  const [activeEvent, setActiveEvent] = useState(0);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAdmissions, setShowAdmissions] = useState(false);

  const { logout, clearAuth } = useAuthStore();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { getSetting } = await import("@/lib/settingsService");
        const isOpen = await getSetting("showAdmissions", false);
        setShowAdmissions(isOpen);
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

  // Events data object - ready for admin management
  const eventsData = {
    categories: [
      { id: "all", name: "All Events", color: "teal" },
      { id: "workshop", name: "Workshops", color: "blue" },
      { id: "seminar", name: "Seminars", color: "green" },
      { id: "conference", name: "Conferences", color: "purple" },
      { id: "training", name: "Training", color: "yellow" },
    ],

    events: [
      {
        id: 1,
        title: "Digital Learning Workshop",
        category: "workshop",
        date: "2024-12-15",
        time: "10:00 AM - 4:00 PM",
        location: "DKIMVB Main Campus, Kerala",
        image: "/events-01.png",
        description:
          "Comprehensive workshop on implementing digital learning solutions in madrasas. Learn modern teaching methodologies while preserving traditional Islamic values.",
        instructor: "Dr. Mohammed Rahman",
        capacity: 50,
        registered: 35,
        price: "Free",
        status: "upcoming",
        features: [
          "Digital Content Creation",
          "Interactive Teaching Tools",
          "Progress Tracking",
          "Certificate Provided",
        ],
        rating: 4.8,
        reviews: 24,
      },
      {
        id: 2,
        title: "Islamic Education Conference 2024",
        category: "conference",
        date: "2024-12-20",
        time: "9:00 AM - 6:00 PM",
        location: "Convention Center, Kochi",
        image: "/events-02.jpg",
        description:
          "Annual conference bringing together educators, scholars, and administrators to discuss the future of Islamic education in the digital age.",
        instructor: "Multiple Speakers",
        capacity: 200,
        registered: 150,
        price: "₹500",
        status: "upcoming",
        features: [
          "Keynote Sessions",
          "Panel Discussions",
          "Networking",
          "Resource Materials",
        ],
        rating: 4.9,
        reviews: 68,
      },
      {
        id: 3,
        title: "Teacher Training Seminar",
        category: "seminar",
        date: "2024-12-25",
        time: "2:00 PM - 5:00 PM",
        location: "Online Virtual Event",
        image: "/events-03.jpg",
        description:
          "Professional development seminar for madrasa teachers focusing on student engagement and assessment techniques.",
        instructor: "Prof. Aisha Siddiqui",
        capacity: 100,
        registered: 75,
        price: "₹200",
        status: "upcoming",
        features: [
          "Live Interactive Sessions",
          "Q&A with Experts",
          "Downloadable Resources",
          "Follow-up Support",
        ],
        rating: 4.7,
        reviews: 42,
      },
      {
        id: 4,
        title: "Smart Madrasa Implementation",
        category: "training",
        date: "2024-12-30",
        time: "10:00 AM - 3:00 PM",
        location: "Regional Training Center",
        image: "/events-4.jpg",
        description:
          "Hands-on training session for implementing Smart Madrasa technology solutions and managing digital learning platforms.",
        instructor: "Tech Team DKIMVB",
        capacity: 30,
        registered: 28,
        price: "Free",
        status: "upcoming",
        features: [
          "Hands-on Practice",
          "Technology Setup",
          "System Management",
          "Technical Support",
        ],
        rating: 4.9,
        reviews: 31,
      },
    ],
    testimonials: [],
  };

  const filteredEvents =
    selectedCategory === "all"
      ? eventsData.events
      : eventsData.events.filter(
          (event) => event.category === selectedCategory,
        );

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) =>
      prev === eventsData.testimonials.length - 1 ? 0 : prev + 1,
    );
  };

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) =>
      prev === 0 ? eventsData.testimonials.length - 1 : prev - 1,
    );
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-teal-900 text-white py-12 px-4 md:py-16 lg:py-20 md:px-8">
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute top-0 left-0 w-full h-full"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          ></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center px-4 py-2 md:px-6 md:py-3 rounded-full bg-yellow-400/20 border border-yellow-400/30 backdrop-blur-sm mb-6 md:mb-8">
              <Calendar className="w-3 h-3 md:w-4 md:h-4 text-white mr-2" />
              <span className="text-white text-xs md:text-sm font-bold">
                Upcoming Events & Programs
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 md:mb-8 leading-tight">
              <span className="block bg-gradient-to-r from-white to-teal-100 bg-clip-text text-transparent">
                Events &
              </span>
              <span className="block text-yellow-400 text-2xl sm:text-3xl md:text-4xl lg:text-5xl mt-2 md:mt-4">
                Workshops
              </span>
            </h1>

            <p className="text-base md:text-lg lg:text-xl text-teal-100 leading-relaxed max-w-3xl mx-auto px-4 md:px-0">
              Join our educational events, workshops, and conferences designed
              to enhance Islamic education and professional development.
            </p>
          </div>
        </div>
      </section>

      {/* Events Section */}
      <section className="py-8 md:py-12 lg:py-14 bg-gray-50 relative">
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23134e4a' fill-opacity='0.1'%3E%3Cpath d='M20 20c0 11.046-8.954 20-20 20s-20-8.954-20-20 8.954-20 20-20 20 8.954 20 20zm10 0c0-11.046 8.954-20 20-20s20 8.954 20 20-8.954 20-20 20-20-8.954-20-20z'/%3E%3C/g%3E%3C/svg%3E")`,
            }}
          ></div>
        </div>

        <div className="container mx-auto px-4 relative">
          {/* Section Header */}
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
              Upcoming Events
            </h2>
            <p className="text-gray-600 text-sm md:text-base lg:text-lg max-w-2xl mx-auto px-4 md:px-0">
              Discover workshops, conferences, and training sessions designed to
              enhance your knowledge
            </p>
          </div>

          {/* Category Filter */}
          <div className="mb-8 md:mb-12">
            <div className="flex flex-wrap justify-center gap-2 md:gap-4">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-4 py-2 md:px-6 md:py-3 rounded-full text-sm md:text-base font-semibold transition-all duration-300 min-h-[44px] touch-manipulation ${
                  selectedCategory === "all"
                    ? "bg-teal-600 text-white shadow-lg scale-105"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                All Events
              </button>
              {eventsData.categories.slice(1).map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 md:px-6 md:py-3 rounded-full text-sm md:text-base font-semibold transition-all duration-300 min-h-[44px] touch-manipulation ${
                    selectedCategory === category.id
                      ? `bg-${category.color}-600 text-white shadow-lg scale-105`
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Events Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {filteredEvents.map((event, index) => (
              <div
                key={event.id}
                className="group bg-white rounded-2xl md:rounded-3xl overflow-hidden shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
                onMouseEnter={() => setActiveEvent(index)}
              >
                <div className="relative">
                  <div className="relative h-40 md:h-48 overflow-hidden">
                    <Image
                      src={event.image}
                      alt={event.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      loading="lazy"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent"></div>

                  {/* <div className="absolute top-4 right-4 bg-yellow-400 text-teal-800 px-3 py-1 rounded-full text-sm font-bold">
                    {event.price}
                  </div> */}

                  {/* <div className="absolute bottom-4 left-4 flex items-center space-x-2">
                    <div className="flex text-yellow-400 space-x-1">
                      {Array.from({ length: Math.floor(event.rating) }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-current" />
                      ))}
                    </div>
                    <span className="text-white text-sm font-medium">({event.reviews})</span>
                  </div> */}
                </div>

                <div className="p-4 md:p-6 space-y-3 md:space-y-4">
                  <div className="flex items-center justify-between">
                    <span
                      className={(() => {
                        const categoryColor = eventsData.categories.find(
                          (c) => c.id === event.category,
                        )?.color;
                        const baseClasses =
                          "px-2 py-1 md:px-3 md:py-1 rounded-full text-xs md:text-sm font-medium";

                        switch (categoryColor) {
                          case "teal":
                            return `${baseClasses} bg-teal-100 text-teal-700`;
                          case "blue":
                            return `${baseClasses} bg-blue-100 text-blue-700`;
                          case "green":
                            return `${baseClasses} bg-green-100 text-green-700`;
                          case "purple":
                            return `${baseClasses} bg-purple-100 text-purple-700`;
                          case "yellow":
                            return `${baseClasses} bg-yellow-100 text-yellow-700`;
                          default:
                            return `${baseClasses} bg-teal-100 text-teal-700`;
                        }
                      })()}
                    >
                      {
                        eventsData.categories.find(
                          (c) => c.id === event.category,
                        )?.name
                      }
                    </span>
                    <div className="flex items-center space-x-1 text-gray-500">
                      <Eye className="w-3 h-3 md:w-4 md:h-4" />
                      <span className="text-xs md:text-sm">
                        {event.registered}/{event.capacity}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg md:text-xl font-bold text-gray-900 group-hover:text-teal-600 transition-colors line-clamp-2">
                    {event.title}
                  </h3>

                  <p className="text-gray-600 text-sm md:text-base line-clamp-3">
                    {event.description}
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center text-gray-500 text-xs md:text-sm">
                      <Calendar className="w-3 h-3 md:w-4 md:h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">
                        {new Date(event.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center text-gray-500 text-xs md:text-sm">
                      <Clock className="w-3 h-3 md:w-4 md:h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{event.time}</span>
                    </div>
                    <div className="flex items-center text-gray-500 text-xs md:text-sm">
                      <MapPin className="w-3 h-3 md:w-4 md:h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  </div>

                  <div className="pt-3 md:pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-3 md:mb-4">
                      <div className="text-xs md:text-sm text-gray-600 truncate flex-1 mr-2">
                        By {event.instructor}
                      </div>
                      <div className="flex space-x-2 flex-shrink-0">
                        <button
                          className="w-9 h-9 md:w-10 md:h-10 bg-gray-100 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors min-h-[44px] min-w-[44px] touch-manipulation"
                          aria-label="Add to favorites"
                        >
                          <Heart className="w-4 h-4 text-gray-600 hover:text-red-600" />
                        </button>
                        <button
                          className="w-9 h-9 md:w-10 md:h-10 bg-gray-100 hover:bg-blue-100 rounded-full flex items-center justify-center transition-colors min-h-[44px] min-w-[44px] touch-manipulation"
                          aria-label="Share event"
                        >
                          <Share2 className="w-4 h-4 text-gray-600 hover:text-blue-600" />
                        </button>
                      </div>
                    </div>

                    <button className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 md:py-4 rounded-xl font-semibold transition-all hover:scale-105 flex items-center justify-center min-h-[48px] touch-manipulation text-sm md:text-base">
                      Register Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {showAdmissions && (
        <section className="py-8 md:py-12 w-full bg-gradient-to-br from-gray-50 to-white relative">
          <div className="container mx-auto">
            <div className="max-w-[95vw] mx-auto">
              <div className="bg-gradient-to-r from-teal-600 via-teal-700 to-teal-800 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl relative">
                <div className="absolute inset-0">
                  <div className="absolute top-0 right-0 w-64 h-64 md:w-96 md:h-96 bg-yellow-400/10 rounded-full blur-3xl transform translate-x-32 md:translate-x-48 -translate-y-32 md:-translate-y-48"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 md:w-72 md:h-72 bg-yellow-300/10 rounded-full blur-3xl transform -translate-x-24 md:-translate-x-36 translate-y-24 md:translate-y-36"></div>
                </div>

                <div className="relative z-10 p-6 md:p-12 lg:p-16">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
                    <div className="space-y-6 md:space-y-8">
                      <div className="space-y-4 md:space-y-6">
                        <div className="inline-flex items-center px-4 py-2 md:px-6 md:py-3 rounded-full bg-yellow-400/20 border border-yellow-400/30 backdrop-blur-sm">
                          <div className="w-2 h-2 bg-white rounded-full mr-3 animate-pulse"></div>
                          <span className="text-white text-xs md:text-sm font-bold">
                            ADMISSION OPEN NOW
                          </span>
                        </div>

                        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-white">
                          Admission is open
                          <span className="block text-yellow-400">
                            for the next year batch
                          </span>
                        </h2>

                        <p className="text-base md:text-lg lg:text-xl text-teal-100 leading-relaxed">
                          Join our upcoming events and educational programs. Get
                          started on your journey towards excellence in Islamic
                          education.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
                        <button
                          className="bg-yellow-400 hover:bg-yellow-500 text-teal-800 font-bold px-6 py-3 md:px-10 md:py-4 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center group min-h-[48px] touch-manipulation text-sm md:text-base"
                          onClick={() =>
                            (window.location.href = "/admission/form")
                          }
                        >
                          <GraduationCap className="mr-2 md:mr-3 h-5 w-5 md:h-6 md:w-6" />
                          Enroll
                          <ArrowRight className="ml-2 h-4 w-4 md:h-5 md:w-5 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <div className="flex items-center space-x-3 md:space-x-4 bg-white/10 rounded-xl px-4 py-3 md:px-6 md:py-4 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors min-h-[48px]">
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-400 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Phone className="h-5 w-5 md:h-6 md:w-6 text-teal-800" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs md:text-sm text-teal-200">
                              Call us now
                            </div>
                            <div className="text-base md:text-lg font-bold text-white truncate">
                              +91 8891177850
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6 md:space-y-8">
                      <div className="grid grid-cols-1 gap-4 md:gap-6">
                        {[
                          {
                            icon: Calendar,
                            title: "Upcoming Events",
                            desc: "Join our educational programs",
                            color: "yellow",
                          },
                          {
                            icon: CheckCircle,
                            title: "Free Registration",
                            desc: "Many events are completely free",
                            color: "green",
                          },
                          {
                            icon: Star,
                            title: "Expert Instructors",
                            desc: "Learn from industry professionals",
                            color: "blue",
                          },
                        ].map((item, index) => {
                          const getIconClasses = () => {
                            const baseClasses =
                              "w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center flex-shrink-0";
                            switch (item.color) {
                              case "yellow":
                                return `${baseClasses} bg-yellow-400/20`;
                              case "green":
                                return `${baseClasses} bg-green-400/20`;
                              case "blue":
                                return `${baseClasses} bg-blue-400/20`;
                              default:
                                return `${baseClasses} bg-yellow-400/20`;
                            }
                          };

                          const getIconColorClasses = () => {
                            const baseClasses = "h-6 w-6 md:h-7 md:w-7";
                            switch (item.color) {
                              case "yellow":
                                return `${baseClasses} text-yellow-400`;
                              case "green":
                                return `${baseClasses} text-green-400`;
                              case "blue":
                                return `${baseClasses} text-blue-400`;
                              default:
                                return `${baseClasses} text-yellow-400`;
                            }
                          };

                          return (
                            <div
                              key={index}
                              className="flex items-center space-x-3 md:space-x-4 bg-white/10 rounded-2xl p-4 md:p-6 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all hover:scale-105"
                            >
                              <div className={getIconClasses()}>
                                <item.icon className={getIconColorClasses()} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-base md:text-lg font-bold text-white truncate">
                                  {item.title}
                                </div>
                                <div className="text-xs md:text-sm text-teal-200">
                                  {item.desc}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
