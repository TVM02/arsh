"use client";

import Image from "next/image";
import Link from "next/link";
import { Twitter, Instagram, Facebook } from "lucide-react";

const QUICK_LINKS = [
  { href: "/about", label: "About Us" },
  { href: "/events", label: "Events & News" },
  { href: "/dkju-axis", label: "Portals" },
  { href: "/contact", label: "Contact" },
];

const RESOURCES = [
  { href: "/brand-guide", label: "Brand Style Guide" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
];

export default function HomeFooter() {
  return (
    <footer style={{ backgroundColor: "#0A2A22" }} className="text-white">
      <div className="container mx-auto px-4 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10 border-b border-white/10">
          {/* Column 1 — Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-200 to-white rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <Image src="/logo.png" alt="DKJU Logo" width={40} height={40} />
              </div>
              <div>
                <p className="font-bold text-lg leading-tight">DKJU</p>
                <p className="text-xs text-white/50">
                  Smart Islamic Education Platform
                </p>
              </div>
            </div>
            <p className="text-sm text-white/60 leading-relaxed mb-5">
              A pioneer in Islamic educational excellence, bridging traditional
              values with contemporary digital learning tools for a brighter
              future.
            </p>
            <div className="flex gap-3 mb-5">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:border-teal-400 hover:text-teal-400 transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:border-teal-400 hover:text-teal-400 transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:border-teal-400 hover:text-teal-400 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
            </div>
            <p className="text-xs text-white/50">
              Contact Technical Support:{" "}
              <a
                href="tel:8891177850"
                className="text-teal-400 hover:text-teal-300 font-semibold transition-colors"
              >
                8891177850
              </a>
            </p>
          </div>

          {/* Column 2 — Quick Links */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-5">
              Quick Links
            </h4>
            <ul className="space-y-3">
              {QUICK_LINKS.map(({ href, label }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-white/70 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Resources */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-5">
              Resources
            </h4>
            <ul className="space-y-3">
              {RESOURCES.map(({ href, label }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-white/70 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 — Address + Map */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-5">
              Address
            </h4>
            <p className="text-sm font-semibold text-white/90 mb-1">
              Dakshina Kerala Islam Matha Vidyabhyasa Board, Jonakappuram
            </p>
            <p className="text-sm text-white/55 leading-relaxed mb-4">
              Pallithottam. P. O Kollam - 691006
            </p>
            {/* Google Maps embed */}
            <div className="rounded-xl overflow-hidden border border-white/10 w-full h-44">
              <iframe
                title="DKJU Location"
                src="https://maps.google.com/maps?q=Jonakappuram+Juma+Masjid+Pallithottam+Kollam+Kerala&output=embed&z=15"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <p>© 2026 DKJU IT Division. All rights reserved</p>
        </div>
      </div>
    </footer>
  );
}
