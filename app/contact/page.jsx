"use client";
import { useState, useEffect } from "react";
import {
  Phone,
  Mail,
  MapPin,
  Send,
  CheckCircle,
  User,
  MessageSquare,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import emailjs from "@emailjs/browser";
import useAuthStore from "@/lib/authStore";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [emailError, setEmailError] = useState(null);

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

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
    if (publicKey && publicKey !== "your_public_key") {
      emailjs.init(publicKey);
    }
  }, []);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.message.trim()) {
      newErrors.message = "Message is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setEmailError(null);

    try {
      // Check if EmailJS is properly configured
      const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
      const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
      const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

      if (
        !serviceId ||
        serviceId === "your_service_id" ||
        !templateId ||
        templateId === "your_template_id" ||
        !publicKey ||
        publicKey === "your_public_key"
      ) {
        throw new Error(
          "EmailJS is not properly configured. Please check your environment variables.",
        );
      }

      // Send ONE email only (no user confirmation, no CC copies)
      const templateParams = {
        from_name: formData.name,
        from_email: formData.email,
        message: formData.message,
        reply_to: formData.email,
        subject: `New Contact Form Message from ${formData.name}`,
      };

      // Send main email to DKJU team
      const result = await emailjs.send(
        serviceId,
        templateId,
        templateParams,
        publicKey,
      );

      console.log("Main email sent successfully:", result);

      setShowSuccess(true);
      setFormData({ name: "", email: "", message: "" });

      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    } catch (error) {
      console.error("EmailJS error:", error);
      setEmailError(
        error.message ||
          "Failed to send message. Please try again or contact us directly at 8891177850.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: Phone,
      title: "Phone Number",
      details: ["8891177850"],
    },
    {
      icon: Mail,
      title: "Email Address",
      details: ["info@dkju.in", "support@dkju.in"],
    },
    {
      icon: MapPin,
      title: "Address",
      details: ["Dakshina Kerala Jamiyyathul Ulama", "Kerala, India"],
    },
    {
      icon: Clock,
      title: "Office Hours",
      details: [
        "Monday - Friday: 9:00 AM - 5:00 PM",
        "Saturday: 9:00 AM - 1:00 PM",
      ],
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
              <MessageSquare className="w-4 h-4 text-white mr-2" />
              <span className="text-white text-xs sm:text-sm font-bold">
                Get In Touch
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 sm:mb-8">
              <span className="block bg-gradient-to-r from-white to-teal-100 bg-clip-text text-transparent">
                Contact Us
              </span>
              <span className="block text-yellow-400 text-2xl sm:text-4xl md:text-5xl mt-2 sm:mt-4">
                Dakshina Kerala Islam Matha
              </span>
              <span className="block text-yellow-400 text-2xl sm:text-4xl md:text-5xl">
                Vidyabhyasa Board
              </span>
            </h1>

            <p className="text-base sm:text-xl text-teal-100 leading-relaxed max-w-3xl mx-auto">
              Have questions about Islamic education? Need assistance with
              admissions? We&apos;re here to help you on your educational
              journey through innovative digital learning experiences.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 bg-gray-50 relative">
        <div className="container mx-auto px-4 relative">
          {/* Header */}
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center px-4 py-1.5 sm:px-6 sm:py-2 rounded-full bg-teal-50 text-teal-700 text-xs sm:text-sm font-semibold border border-teal-200 mb-6">
              <Phone className="w-4 h-4 mr-2" />
              Contact Information
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
              Get In <span className="text-teal-600">Touch</span>
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              We&apos;re committed to providing prompt and helpful responses to
              all your inquiries about Islamic education and our programs.
            </p>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {contactInfo.map((info, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 sm:p-8 border border-gray-200 hover:border-teal-300 transition-colors duration-200"
              >
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">
                  {info.title}
                </h3>
                <div className="space-y-1">
                  {info.details.map((detail, idx) => (
                    <p
                      key={idx}
                      className="text-sm sm:text-base text-gray-700 leading-relaxed"
                    >
                      {info.icon === Mail ? (
                        <a
                          href={`mailto:${detail}`}
                          className="hover:text-teal-600 transition-colors"
                        >
                          {detail}
                        </a>
                      ) : info.icon === Phone ? (
                        <a
                          href={`tel:${detail}`}
                          className="hover:text-teal-600 transition-colors"
                        >
                          {detail}
                        </a>
                      ) : (
                        detail
                      )}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-2 sm:py-24 px-4 sm:px-8">
        <div className="container mx-auto relative">
          <div className="text-center mb-12 sm:mb-20">
            <div className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 rounded-full bg-teal-100 text-teal-700 text-xs sm:text-sm font-bold mb-6 sm:mb-8 border border-teal-200">
              <Send className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Send Message
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6 sm:mb-8 leading-tight">
              Send Us a<span className="block text-teal-600">Message</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Fill out the form below and we&apos;ll get back to you as soon as
              possible. You&apos;ll receive a confirmation email immediately
              after submitting the form.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            {showSuccess && (
              <div className="mb-6 sm:mb-8">
                <div className="bg-green-50 rounded-xl sm:rounded-3xl p-6 sm:p-8 shadow-lg border border-green-200">
                  <div className="flex items-center">
                    <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
                    <div>
                      <p className="text-green-800 font-medium text-lg mb-2">
                        Thank you for contacting us! We have received your
                        message.
                      </p>
                      <p className="text-green-700">
                        A confirmation email has been sent to {formData.email}.
                        Our team will get back to you within 24-48 hours.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl sm:rounded-3xl p-6 sm:p-8 border border-gray-100">
              <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <div>
                    <Label
                      htmlFor="name"
                      className="text-gray-700 font-bold text-sm sm:text-base mb-2 sm:mb-3 block"
                    >
                      Full Name *
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={`pl-10 h-12 sm:h-14 border-2 rounded-xl text-sm sm:text-base ${
                          errors.name
                            ? "border-red-500 focus:border-red-500"
                            : "border-gray-200 focus:border-teal-500"
                        } focus:ring-teal-500`}
                        placeholder="Enter your full name"
                      />
                    </div>
                    {errors.name && (
                      <p className="text-red-500 text-sm mt-2">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="email"
                      className="text-gray-700 font-bold text-sm sm:text-base mb-2 sm:mb-3 block"
                    >
                      Email Address *
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`pl-10 h-12 sm:h-14 border-2 rounded-xl text-sm sm:text-base ${
                          errors.email
                            ? "border-red-500 focus:border-red-500"
                            : "border-gray-200 focus:border-teal-500"
                        } focus:ring-teal-500`}
                        placeholder="Enter your email address"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-red-500 text-sm mt-2">
                        {errors.email}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="message"
                    className="text-gray-700 font-bold text-sm sm:text-base mb-2 sm:mb-3 block"
                  >
                    Message *
                  </Label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      className={`pl-10 pt-3 min-h-[120px] sm:min-h-[140px] border-2 rounded-xl text-sm sm:text-base resize-none ${
                        errors.message
                          ? "border-red-500 focus:border-red-500"
                          : "border-gray-200 focus:border-teal-500"
                      } focus:ring-teal-500`}
                      placeholder="Tell us about your inquiry, questions about Islamic education, admissions, or how we can help you..."
                    />
                  </div>
                  {errors.message && (
                    <p className="text-red-500 text-sm mt-2">
                      {errors.message}
                    </p>
                  )}
                </div>

                {emailError && (
                  <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                    <p className="text-red-800 text-sm">{emailError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 sm:h-14 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-sm sm:text-base"
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Sending Message...
                    </div>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
