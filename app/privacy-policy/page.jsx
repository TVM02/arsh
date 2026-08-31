"use client";

import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import { 
  ShieldCheck, 
  FileText, 
  Target, 
  Share2, 
  Cookie, 
  Database, 
  UserCheck, 
  Users 
} from "lucide-react";

export default function PrivacyPolicy() {
  const sections = [
    {
      id: "information-collected",
      title: "1. Information We Collect",
      icon: <FileText className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">During the admission and examination process, we may collect the following information:</p>
          <ul className="list-disc pl-5 space-y-2 text-[#4a5568]">
            <li>Full Name</li>
            <li>Date of Birth</li>
            <li>Gender</li>
            <li>Parent/Guardian Information</li>
            <li>Residential Address</li>
            <li>Email Address</li>
            <li>Mobile Number</li>
            <li>Educational or Madrasa Information</li>
            <li>Passport-size Photograph</li>
            <li>Supporting Documents uploaded by the applicant</li>
            <li>Payment details required for processing application fees (payment card or banking information is processed securely by our payment service providers and is not stored by us unless specifically stated)</li>
            <li>IP Address</li>
            <li>Browser and Device Information</li>
            <li>Website usage information collected through cookies and similar technologies</li>
          </ul>
        </>
      )
    },
    {
      id: "purpose",
      title: "2. Purpose of Collecting Information",
      icon: <Target className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">Your information is collected solely for legitimate administrative and operational purposes, including:</p>
          <ul className="list-disc pl-5 space-y-2 text-[#4a5568]">
            <li>Processing admission applications</li>
            <li>Verifying applicant information</li>
            <li>Managing examination registration</li>
            <li>Generating hall tickets and examination records</li>
            <li>Communicating important notifications</li>
            <li>Providing customer support</li>
            <li>Processing and verifying payments</li>
            <li>Preventing fraud and unauthorized access</li>
            <li>Maintaining website security</li>
            <li>Improving our services and user experience</li>
            <li>Complying with applicable legal and regulatory requirements</li>
          </ul>
        </>
      )
    },
    {
      id: "data-security",
      title: "3. Data Security",
      icon: <ShieldCheck className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">We implement reasonable technical, administrative, and organizational measures designed to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
          <p className="text-[#4a5568]">While we strive to safeguard your information using industry-standard security practices, no method of electronic storage or transmission over the internet can be guaranteed to be completely secure. Accordingly, we cannot guarantee absolute security.</p>
        </>
      )
    },
    {
      id: "sharing",
      title: "4. Sharing of Information",
      icon: <Share2 className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">We do not sell, rent, or trade your personal information.</p>
          <p className="mb-4 text-[#4a5568]">Your information may be shared only when necessary with:</p>
          <ul className="list-disc pl-5 space-y-2 text-[#4a5568]">
            <li>Authorized administrators and examination officials</li>
            <li>Educational institutions or affiliated organizations involved in the admission process</li>
            <li>Trusted payment gateway providers for payment processing</li>
            <li>Government authorities or law enforcement agencies where required by applicable law</li>
            <li>Technology service providers assisting in website operation under appropriate confidentiality obligations</li>
          </ul>
        </>
      )
    },
    {
      id: "cookies",
      title: "5. Cookies and Analytics",
      icon: <Cookie className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">Our website may use cookies and similar technologies to:</p>
          <ul className="list-disc pl-5 space-y-2 text-[#4a5568] mb-4">
            <li>Maintain secure user sessions</li>
            <li>Improve website functionality</li>
            <li>Analyze website performance and usage</li>
            <li>Enhance user experience</li>
          </ul>
          <p className="text-[#4a5568]">You may choose to disable cookies through your browser settings; however, some features of the website may not function properly.</p>
        </>
      )
    },
    {
      id: "retention",
      title: "6. Data Retention",
      icon: <Database className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">We retain personal information only for as long as reasonably necessary to:</p>
          <ul className="list-disc pl-5 space-y-2 text-[#4a5568] mb-4">
            <li>Complete the admission and examination process</li>
            <li>Maintain academic and administrative records</li>
            <li>Resolve disputes</li>
            <li>Meet legal, regulatory, or audit obligations</li>
            <li>Enforce our policies</li>
          </ul>
          <p className="text-[#4a5568]">After the applicable retention period, information may be securely deleted or anonymized where appropriate.</p>
        </>
      )
    },
    {
      id: "user-responsibilities",
      title: "7. User Responsibilities",
      icon: <UserCheck className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">Applicants are responsible for ensuring that all information submitted through the website is accurate, complete, and up to date.</p>
          <p className="text-[#4a5568]">Submission of false, misleading, or fraudulent information may result in rejection of the application or other administrative action in accordance with applicable rules.</p>
        </>
      )
    },
    {
      id: "children-privacy",
      title: "8. Children's Privacy",
      icon: <Users className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="text-[#4a5568]">Where applicants are minors, parents or legal guardians are responsible for ensuring that the information submitted is accurate and truthful.</p>
        </>
      )
    }
  ];

  return (
    <main className="min-h-screen bg-[#f7f3e9] flex flex-col font-sans">
      <Navbar />
      
      {/* Page Header */}
      <div className="bg-[#182a1c] text-[#f7f3e9] py-16 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('/images/fbg.jpeg')] bg-cover bg-center" />
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <h1 className="text-4xl md:text-5xl font-serif mb-4 text-[#d8bf78]">Privacy Policy</h1>
          <p className="text-[#d9d4c5] text-lg">Last Updated: 17 July 2026</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow py-12 px-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border border-[#d8bf78]/20">
          
          {/* Introduction */}
          <div className="p-8 md:p-10 border-b border-gray-100 bg-[#faf8f2]">
            <p className="text-lg text-[#274629] leading-relaxed">
              Welcome to DKJU (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We value your privacy and are committed to protecting the personal information you provide while using our website and online admission portal. By accessing or using this website, you agree to the collection and use of your information in accordance with this Privacy Policy.
            </p>
          </div>

          {/* Sections */}
          <div className="p-8 md:p-10 space-y-10">
            {sections.map((section, index) => (
              <div key={section.id} className="group">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#f7f3e9] border border-[#d8bf78]/30 group-hover:bg-[#d8bf78]/10 transition-colors duration-300">
                    {section.icon}
                  </div>
                  <h2 className="text-2xl font-serif text-[#182a1c]">{section.title}</h2>
                </div>
                <div className="pl-16">
                  {section.content}
                </div>
                {index !== sections.length - 1 && (
                  <div className="mt-10 ml-16 h-[1px] bg-gray-100" />
                )}
              </div>
            ))}
          </div>

        </div>
      </div>

      <Footer />
    </main>
  );
}
