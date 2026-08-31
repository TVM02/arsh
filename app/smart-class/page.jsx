"use client";
import { useEffect } from "react";
import {
  Monitor,
  Book,
  BookOpen,
  GraduationCap,
  Users,
  FileText,
  Lock,
  Shield,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import useAuthStore from "@/lib/authStore";

export default function SmartClassLanding() {
  const { logout, clearAuth } = useAuthStore();

  useEffect(() => {
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
      icon: Book,
      title: "Digital Syllabus",
      description:
        "Comprehensive digital syllabus for all classes with structured learning paths",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      icon: BookOpen,
      title: "Study Materials",
      description:
        "Rich collection of textbooks, images, and educational content",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      icon: Shield,
      title: "Secure Access",
      description:
        "Protected content with proper authentication and access controls",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      icon: Monitor,
      title: "Interactive Learning",
      description:
        "Modern digital interface designed for enhanced learning experience",
      color: "text-teal-600",
      bgColor: "bg-teal-100",
    },
  ];

  const userTypes = [
    {
      title: "Students",
      description: "Access your class-specific syllabus and study materials",
      features: [
        "View class-wise syllabus",
        "Access study contents",
        "Download restrictions for security",
        "Easy navigation and search",
      ],
      loginPath: "/auth/login/student",
      icon: GraduationCap,
      color: "from-blue-600 to-blue-700",
    },
    {
      title: "Teachers",
      description: "Explore teaching materials across all classes",
      features: [
        "Access all class materials",
        "View comprehensive syllabus",
        "Teaching resource library",
        "Content overview for planning",
      ],
      loginPath: "/auth/login/teacher",
      icon: Users,
      color: "from-green-600 to-green-700",
    },
    {
      title: "Administrators",
      description: "Manage and upload educational content",
      features: [
        "Upload syllabus content",
        "Manage study materials",
        "Content administration",
        "User access management",
      ],
      loginPath: "/auth/login/dkju-control",
      icon: FileText,
      color: "from-purple-600 to-purple-700",
    },
  ];

  const stats = [
    { label: "Classes Covered", value: "10+", icon: BookOpen },
    { label: "Digital Resources", value: "500+", icon: FileText },
    { label: "Active Students", value: "10,000+", icon: Users },
    { label: "Secure Access", value: "100%", icon: Shield },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-teal-900 text-white py-12 sm:py-20 px-4 sm:px-8">
        <div className="relative container mx-auto max-w-6xl">
          <div className="text-center space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-white bg-opacity-20 rounded-full backdrop-blur-sm">
              <Monitor className="h-5 w-5 text-yellow-400" />
              <span className="text-sm font-medium">
                DKJU Smart Class Platform
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold leading-tight">
              Digital Learning for
              <span className="block text-yellow-400">Madrasa Education</span>
            </h1>

            <p className="text-lg sm:text-xl text-teal-100 max-w-3xl mx-auto leading-relaxed">
              Access comprehensive digital syllabus and study materials designed
              for modern Islamic education. Secure, organized, and easily
              accessible learning resources for students and teachers.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Link href="/auth/login/student">
                <Button
                  size="lg"
                  className="bg-yellow-400 hover:bg-yellow-500 text-teal-900 px-8 py-4 text-lg font-semibold transition-all transform hover:scale-105 shadow-xl"
                >
                  Access Smart Class
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/about">
                <Button
                  variant="outline"
                  size="lg"
                  className="bg-transparent border-white text-white hover:bg-white hover:text-teal-900 px-8 py-4 text-lg font-semibold transition-all"
                >
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-8 max-w-6xl">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Smart Class Features
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Discover the powerful features that make our Smart Class platform
              the ideal choice for modern Madrasa education.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border-0 shadow-lg"
              >
                <CardContent className="p-6 sm:p-8 text-center">
                  <div
                    className={`w-16 h-16 mx-auto mb-4 ${feature.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                  >
                    <feature.icon className={`h-8 w-8 ${feature.color}`} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* User Types Section */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-8 max-w-6xl">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Access Based on Your Role
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose your access level to explore the Smart Class platform with
              role-specific features and content.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {userTypes.map((userType, index) => (
              <Card
                key={index}
                className="group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-0 shadow-lg overflow-hidden"
              >
                <div className={`h-2 bg-gradient-to-r ${userType.color}`}></div>
                <CardContent className="p-6 sm:p-8">
                  <div className="text-center mb-6">
                    <div
                      className={`w-16 h-16 mx-auto mb-4 bg-gradient-to-r ${userType.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                    >
                      <userType.icon className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {userType.title}
                    </h3>
                    <p className="text-gray-600">{userType.description}</p>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {userType.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href={userType.loginPath}>
                    <Button
                      className={`w-full bg-gradient-to-r ${userType.color} hover:opacity-90 text-white py-3 text-lg font-semibold transition-all transform group-hover:scale-105`}
                    >
                      Login as {userType.title}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-teal-600 to-teal-800 text-white">
        <div className="container mx-auto px-4 sm:px-8 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Smart Class by Numbers
            </h2>
            <p className="text-teal-100 text-lg max-w-2xl mx-auto">
              Join thousands of students and teachers already benefiting from
              our digital learning platform.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="text-center group hover:scale-105 transition-transform duration-300"
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-yellow-400 rounded-xl flex items-center justify-center group-hover:bg-yellow-300 transition-colors">
                  <stat.icon className="h-8 w-8 text-teal-900" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-yellow-400 mb-2">
                  {stat.value}
                </div>
                <div className="text-teal-100 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Notice */}
      <section className="py-12 sm:py-16 bg-gray-900 text-white">
        <div className="container mx-auto px-4 sm:px-8 max-w-4xl text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Lock className="h-6 w-6 text-yellow-400" />
            <h3 className="text-xl sm:text-2xl font-bold">
              Secure & Protected Content
            </h3>
          </div>
          <p className="text-gray-300 leading-relaxed">
            All educational materials in Smart Class are protected with advanced
            security measures. Content cannot be downloaded, copied, or printed
            to ensure intellectual property protection while maintaining easy
            access for authorized users.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 bg-yellow-400">
        <div className="container mx-auto px-4 sm:px-8 max-w-4xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-teal-900 mb-4">
            Ready to Start Learning?
          </h2>
          <p className="text-teal-800 text-lg mb-8 max-w-2xl mx-auto">
            Join our Smart Class platform today and experience the future of
            Islamic education with digital learning tools designed for modern
            students and teachers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/login/student">
              <Button
                size="lg"
                className="bg-teal-900 hover:bg-teal-800 text-white px-8 py-4 text-lg font-semibold transition-all transform hover:scale-105"
              >
                Student Login
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/auth/login/teacher">
              <Button
                size="lg"
                variant="outline"
                className="border-teal-900 text-teal-900 hover:bg-teal-900 hover:text-white px-8 py-4 text-lg font-semibold transition-all"
              >
                Teacher Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
