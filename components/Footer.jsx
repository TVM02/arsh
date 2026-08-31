import Image from "next/image";
import React from "react";
import { Facebook, Twitter, Instagram, MapPin } from "lucide-react";

function Footer() {
  return (
    <footer style={{ background: '#001827' }} className="text-white py-10 sm:py-14 relative overflow-hidden">
      {/* Glow orb */}
      <div style={{ position:'absolute', top:-80, right:-60, width:360, height:360, background:'radial-gradient(circle, rgba(107,238,208,0.08) 0%, transparent 65%)', filter:'blur(70px)', borderRadius:'50%', pointerEvents:'none' }} />
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-10 md:gap-14 lg:gap-20 border-b border-white/10 pb-8 sm:pb-10">

          {/* Logo & Brand */}
          <div className="flex flex-col items-center lg:items-start min-w-[220px]">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-[#6beed0] to-[#4dd4b8] rounded-2xl flex items-center justify-center shadow-lg mb-3">
              <Image src={"/logo.png"} alt="Logo" width={48} height={48} className="p-1 rounded-xl" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-1">DKJU</h3>
            <p className="text-[#6ee7b7] max-w-xs mb-4 text-sm text-center lg:text-left">Smart Islamic Education Platform</p>
            <div className="flex space-x-3 mb-4">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#6beed0]/30 transition-colors border border-white/10">
                <Facebook size={16} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#6beed0]/30 transition-colors border border-white/10">
                <Twitter size={16} />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#6beed0]/30 transition-colors border border-white/10">
                <Instagram size={16} />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#6beed0]/30 transition-colors border border-white/10">
                {/* YouTube icon (lucide doesn't export it—use simple svg) */}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
            </div>

          </div>

          {/* Quick Links */}
          <div className="flex flex-col items-center lg:items-start min-w-[150px]">
            <h4 className="font-semibold text-base sm:text-lg mb-4 text-white">Quick Links</h4>
            <ul className="space-y-2.5 text-center lg:text-left">
              {[
                ['/#home',   'Home'],
                ['/#about',  'About'],
                ['/#updates', 'News'],
                ['/#events', 'Events'],
                ['/#mushawara', 'Leaders'],
              ].map(([href, label]) => (
                <li key={label}>
                  <a href={href} className="text-[#6ee7b7] text-sm hover:text-[#fbbf24] transition-colors inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#6beed0] rounded-full" />{label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div className="flex flex-col items-center lg:items-start min-w-[150px]">
            <h4 className="font-semibold text-base sm:text-lg mb-4 text-white">Resources</h4>
            <ul className="space-y-2.5 text-center lg:text-left">
              {[
                ['/brand-guide',  'Brand Style Guide'],
              ].map(([href, label]) => (
                <li key={label}>
                  <a href={href} className="text-[#6ee7b7] text-sm hover:text-[#fbbf24] transition-colors inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#6beed0] rounded-full" />{label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Address & Map */}
          <div className="flex flex-col items-center lg:items-start gap-4 min-w-[220px] w-full lg:w-auto">
            <div className="text-center lg:text-left">
              <h4 className="font-semibold text-base sm:text-lg mb-2 text-white">Address</h4>
              <p className="text-[#6ee7b7] text-sm leading-relaxed max-w-xs">
                <span className="text-[#fbbf24] font-medium">Dakshina Kerala Islam Matha Vidyabhyasa Board</span><br />
                Jonakappuram, Pallithottam. P. O, Kollam - 691006
              </p>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-white/15 hover:bg-white/10 transition-colors text-[#6ee7b7]">
                <MapPin size={13} className="text-[#6beed0]" /> View on Map
              </a>
              <div className="flex-1 rounded-xl overflow-hidden h-16 shadow-lg border border-white/10">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15767.869140390987!2d76.5595954871582!3d8.882633599999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3b05fc43e92211ef%3A0x31ef4ce6cf4f5946!2sJonakappuram%20Juma%20Masjid%20Kollam!5e0!3m2!1sen!2sin!4v1755028886875!5m2!1sen!2sin"
                  width="100%" height="100%" style={{ border: 0 }}
                  allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                  title="Location Map"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4 text-xs text-[#6ee7b7] border-t border-white/5 pt-6">
          <p>© {new Date().getFullYear()} DKJU IT Division. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="/privacy-policy" className="hover:text-[#fbbf24] transition-colors">Privacy Policy</a>
            <a href="/terms-and-conditions" className="hover:text-[#fbbf24] transition-colors">Terms & Conditions</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
