"use client";

import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import { 
  CheckSquare, 
  UserCheck,
  Users,
  FileText,
  CreditCard,
  RotateCcw,
  Ticket,
  Copyright,
  Globe,
  AlertTriangle,
  ShieldCheck,
  Link2,
  Ban,
  Edit,
  Scale,
  Phone
} from "lucide-react";

export default function TermsAndConditions() {
  const sections = [
    {
      id: "acceptance-of-terms",
      title: "1. Acceptance of Terms",
      icon: <CheckSquare className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="text-[#4a5568]">By using this Website, registering an account, submitting an admission application, making a payment, or accessing any services provided through the Website, you acknowledge that you have read, understood, and agreed to these Terms & Conditions and our Privacy Policy.</p>
        </>
      )
    },
    {
      id: "eligibility",
      title: "2. Eligibility",
      icon: <UserCheck className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">Users must provide accurate and complete information during the admission process.</p>
          <p className="text-[#4a5568]">If an applicant is under the age of majority, the application should be completed by or with the consent of a parent or legal guardian, where applicable.</p>
        </>
      )
    },
    {
      id: "user-responsibilities",
      title: "3. User Responsibilities",
      icon: <Users className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">Users agree to:</p>
          <ul className="list-disc pl-5 space-y-2 text-[#4a5568] mb-4">
            <li>Provide true, accurate, and complete information.</li>
            <li>Keep login credentials confidential.</li>
            <li>Update information whenever necessary.</li>
            <li>Use the Website only for lawful purposes.</li>
            <li>Refrain from attempting unauthorized access to the Website or its systems.</li>
            <li>Not interfere with the security, functionality, or availability of the Website.</li>
          </ul>
          <p className="text-[#4a5568]">Users are solely responsible for any activity performed using their account.</p>
        </>
      )
    },
    {
      id: "admission-applications",
      title: "4. Admission Applications",
      icon: <FileText className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">Submission of an application does not guarantee admission or examination eligibility.</p>
          <p className="text-[#4a5568]">The organization reserves the right to verify all submitted information and supporting documents. Applications containing false, misleading, incomplete, or fraudulent information may be rejected without prior notice.</p>
        </>
      )
    },
    {
      id: "payments",
      title: "5. Payments",
      icon: <CreditCard className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">Where applicable, application or examination fees must be paid through the approved payment methods available on the Website.</p>
          <p className="mb-4 text-[#4a5568]">Payment processing is handled by secure third-party payment providers.</p>
          <p className="text-[#4a5568]">Successful payment does not automatically guarantee admission, registration, or examination eligibility.</p>
        </>
      )
    },
    {
      id: "refund-policy",
      title: "6. Refund Policy",
      icon: <RotateCcw className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">Application and examination fees are generally non-refundable unless otherwise stated by the organization or where required under applicable law.</p>
          <p className="text-[#4a5568]">Any approved refund shall be processed according to the organization&apos;s refund procedures.</p>
        </>
      )
    },
    {
      id: "hall-tickets",
      title: "7. Hall Tickets and Examination Services",
      icon: <Ticket className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">Applicants are responsible for downloading and verifying their hall tickets before the examination.</p>
          <p className="text-[#4a5568]">Any discrepancies in personal information should be reported promptly through the official support channels.</p>
        </>
      )
    },
    {
      id: "intellectual-property",
      title: "8. Intellectual Property",
      icon: <Copyright className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">All content available on this Website, including text, graphics, logos, icons, software, layouts, images, documents, and other materials, is the property of the respective owner or licensed for use and is protected under applicable intellectual property laws.</p>
          <p className="text-[#4a5568]">No content may be copied, reproduced, modified, distributed, or used for commercial purposes without prior written permission.</p>
        </>
      )
    },
    {
      id: "website-availability",
      title: "9. Website Availability",
      icon: <Globe className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">We strive to maintain uninterrupted access to the Website; however, availability cannot be guaranteed at all times.</p>
          <p className="text-[#4a5568]">The Website may be temporarily unavailable due to maintenance, technical issues, system upgrades, network interruptions, or circumstances beyond our reasonable control.</p>
        </>
      )
    },
    {
      id: "limitation-of-liability",
      title: "10. Limitation of Liability",
      icon: <AlertTriangle className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">To the maximum extent permitted by applicable law, the organization shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from the use of, or inability to use, the Website.</p>
          <p className="text-[#4a5568]">Nothing in these Terms excludes or limits liability where such exclusion or limitation is prohibited by applicable law.</p>
        </>
      )
    },
    {
      id: "data-protection",
      title: "11. Data Protection",
      icon: <ShieldCheck className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">Personal information collected through the Website is processed in accordance with our Privacy Policy.</p>
          <p className="text-[#4a5568]">Users are encouraged to review the Privacy Policy to understand how their information is collected, used, and protected.</p>
        </>
      )
    },
    {
      id: "third-party-services",
      title: "12. Third-Party Services",
      icon: <Link2 className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">The Website may integrate with third-party services, including payment gateways, hosting providers, analytics providers, communication platforms, and other technology providers.</p>
          <p className="text-[#4a5568]">The organization is not responsible for the content, availability, or privacy practices of third-party services.</p>
        </>
      )
    },
    {
      id: "suspension",
      title: "13. Suspension or Termination",
      icon: <Ban className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="text-[#4a5568]">The organization reserves the right to suspend, restrict, or terminate access to the Website without prior notice where there is reasonable belief of misuse, fraudulent activity, security risks, or violation of these Terms.</p>
        </>
      )
    },
    {
      id: "modifications",
      title: "14. Modifications",
      icon: <Edit className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">The organization may update these Terms & Conditions from time to time.</p>
          <p className="text-[#4a5568]">Updated versions become effective upon publication on this Website. Continued use of the Website after publication constitutes acceptance of the revised Terms.</p>
        </>
      )
    },
    {
      id: "governing-law",
      title: "15. Governing Law",
      icon: <Scale className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">These Terms & Conditions shall be governed by and interpreted in accordance with the laws of India.</p>
          <p className="text-[#4a5568]">Any disputes arising from the use of this Website shall be subject to the jurisdiction of the competent courts having jurisdiction over the organization&apos;s registered office, unless otherwise required by applicable law.</p>
        </>
      )
    },
    {
      id: "contact-information",
      title: "16. Contact Information",
      icon: <Phone className="w-6 h-6 text-[#c9b37e]" />,
      content: (
        <>
          <p className="mb-4 text-[#4a5568]">For any questions regarding these Terms & Conditions, please contact:</p>
          <ul className="list-disc pl-5 space-y-2 text-[#4a5568]">
            <li><strong>Organization:</strong> DKJU (Dakshina Kerala Jem-Iyyathul Ulama)</li>
            <li><strong>Website:</strong> <a href="https://dkju.in" className="text-[#274629] hover:text-[#c9b37e] underline">https://dkju.in</a></li>
            <li><strong>Email:</strong> support@dkju.in</li>
            <li><strong>Phone:</strong> +91 8891177850</li>
          </ul>
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
          <h1 className="text-4xl md:text-5xl font-serif mb-4 text-[#d8bf78]">Terms & Conditions</h1>
          <p className="text-[#d9d4c5] text-lg">Last Updated: 17 July 2026</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow py-12 px-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border border-[#d8bf78]/20">
          
          {/* Introduction */}
          <div className="p-8 md:p-10 border-b border-gray-100 bg-[#faf8f2]">
            <p className="text-lg text-[#274629] leading-relaxed">
              Welcome to DKJU. These Terms & Conditions (&quot;Terms&quot;) govern your access to and use of the DKJU website and online admission portal (&quot;Website&quot;). By accessing or using this Website, you agree to comply with and be bound by these Terms. If you do not agree with any part of these Terms, please discontinue use of the Website.
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

          {/* Conclusion */}
          <div className="p-8 md:p-10 border-t border-gray-100 bg-[#faf8f2] text-center">
             <p className="text-[#274629] font-medium">By using this Website, you acknowledge that you have read, understood, and agreed to these Terms & Conditions.</p>
          </div>

        </div>
      </div>

      <Footer />
    </main>
  );
}
