"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#about", label: "About" },
  { href: "#updates", label: "News" },
  { href: "#events", label: "Events" },
  { href: "#mushawara", label: "Leaders" },
];

const UTILITY_LINKS = [];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    setOrgOpen(false);
  };

  return (
    <header className="sticky top-0 w-full z-[1000] bg-white border-b border-[#c9b37e]/35 shadow-[0_2px_10px_rgba(39,70,41,0.05),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-[8px]">
      <div className="relative w-[calc(100%-2.5rem)] md:w-[calc(100%-4rem)] max-w-[1400px] mx-auto flex items-center justify-between gap-[0.55rem] min-[481px]:gap-[0.75rem] min-[901px]:gap-6 py-[0.5rem] min-[481px]:py-[0.6rem] min-[901px]:py-2">

        {/* Logo + Brand */}
        <a
          href="/"
          className="flex gap-[0.3rem] min-[481px]:gap-[0.5rem] min-[901px]:gap-2 items-center min-w-0 no-underline shrink-0"
          onClick={closeMenu}
        >
          <Image
            src="/images/logo2.png"
            alt="DKJU Logo"
            width={60}
            height={60}
            className="shrink-0 w-[34px] h-[34px] min-[481px]:w-[38px] min-[481px]:h-[38px] min-[901px]:w-[48px] min-[901px]:h-[48px]"
          />
<div className="hidden min-[481px]:block">
            <h1 className="text-[0.72rem] min-[901px]:text-[0.95rem] text-[#274629] m-0 font-serif font-normal leading-[1.3] min-[901px]:leading-[1.35] whitespace-nowrap">
              Dakshina Kerala Jem-Iyyathul Ulama (DKJU)
            </h1>
          </div>
        </a>

        {/* Mobile utility chips */}
        <div className="hidden max-[900px]:flex items-center gap-[0.4rem] ml-auto">
          {UTILITY_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-2 py-[0.35rem] text-[0.72rem] border border-[#c9b37e] rounded whitespace-nowrap text-[#274629] no-underline tracking-[0.03em] transition-colors duration-250 hover:text-[#c9b37e]"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Hamburger */}
        <button
          type="button"
          className={`hidden max-[900px]:flex flex-col justify-center gap-[5px] w-9 h-9 min-[481px]:w-10 min-[481px]:h-10 p-[0.4rem] border border-[#c9b37e]/45 rounded-md bg-[#274629]/[0.06] cursor-pointer shrink-0 transition-colors duration-200 hover:bg-[#274629]/10 hover:border-[#c9b37e]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c9b37e] focus-visible:outline-offset-2 ${
            menuOpen ? "group" : ""
          }`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          <span className={`block w-full h-[2px] bg-[#274629] rounded-[1px] transition-all duration-250 ${menuOpen ? "translate-y-[7px] rotate-45" : ""}`} />
          <span className={`block w-full h-[2px] bg-[#274629] rounded-[1px] transition-all duration-250 ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`block w-full h-[2px] bg-[#274629] rounded-[1px] transition-all duration-250 ${menuOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
        </button>

        {/* Nav panel */}
        <div
          id="primary-navigation"
          className={`flex flex-col items-end gap-[1.2rem] ml-auto max-[900px]:absolute max-[900px]:top-[calc(100%+1px)] max-[900px]:left-0 max-[900px]:right-0 max-[900px]:items-stretch max-[900px]:gap-0 max-[900px]:ml-0 max-[900px]:py-2 max-[900px]:pb-4 max-[900px]:bg-white max-[900px]:border-b max-[900px]:border-[#c9b37e]/35 max-[900px]:shadow-[0_12px_24px_rgba(39,70,41,0.08)] max-[900px]:transition-all max-[900px]:duration-250 min-[901px]:!opacity-100 min-[901px]:!visible min-[901px]:!translate-y-0 min-[901px]:!pointer-events-auto ${
            menuOpen
              ? "max-[900px]:opacity-100 max-[900px]:visible max-[900px]:translate-y-0 max-[900px]:pointer-events-auto"
              : "max-[900px]:opacity-0 max-[900px]:invisible max-[900px]:-translate-y-2 max-[900px]:pointer-events-none"
          }`}
        >
          {/* Utility row (desktop) */}
          <div className="flex items-center gap-[0.75rem] max-[900px]:flex-col max-[900px]:items-stretch max-[900px]:gap-0 max-[900px]:py-1">
            {UTILITY_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 border border-[#c9b37e]/70 rounded text-[#274629] no-underline text-[0.95rem] tracking-[0.03em] whitespace-nowrap transition-colors duration-250 hover:text-[#c9b37e] max-[900px]:hidden"
                onClick={closeMenu}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Main nav links */}
          <nav className="flex items-center gap-[1.5rem] max-[1100px]:gap-[1.1rem] max-[900px]:flex-col max-[900px]:items-stretch max-[900px]:gap-0">

            {/* Standard nav links */}
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  closeMenu();
                  const targetId = link.href.substring(1);
                  const element = document.getElementById(targetId);
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth" });
                  } else if (link.href === "#home") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="no-underline bg-none border-none cursor-pointer text-[#274629] text-[0.95rem] max-[1100px]:text-[0.88rem] whitespace-nowrap transition-colors duration-250 hover:text-[#c9b37e] max-[900px]:block max-[900px]:w-full max-[900px]:px-4 max-[900px]:py-[0.85rem] max-[900px]:text-[0.92rem] max-[900px]:text-left max-[900px]:hover:bg-[#c9b37e]/[0.08]"
              >
                {link.label}
              </a>
            ))}

            {/* Digital E-Learning button */}
            <Link
              href="/digital-class"
              onClick={closeMenu}
              className="px-3 py-1.5 bg-[#355a2c]/10 border border-[#355a2c]/30 rounded text-[#355a2c] text-[0.82rem] font-medium whitespace-nowrap hover:bg-[#355a2c]/20 transition-colors duration-200 max-[900px]:block max-[900px]:w-full max-[900px]:px-4 max-[900px]:py-[0.85rem] max-[900px]:rounded-none max-[900px]:border-x-0 max-[900px]:border-t-0 max-[900px]:hover:bg-[#c9b37e]/[0.08]"
            >
              Digital E-Learning
            </Link>

            {/* Organisation dropdown */}
            <div className="relative max-[900px]:flex max-[900px]:flex-col">
              {/* Desktop toggle button */}
              <button
                type="button"
                onClick={() => setOrgOpen((o) => !o)}
                className="group/org flex items-center gap-[0.3rem] no-underline cursor-pointer text-[#274629] text-[0.95rem] max-[1100px]:text-[0.88rem] whitespace-nowrap transition-colors duration-250 hover:text-[#c9b37e] bg-transparent border-none p-0 max-[900px]:w-full max-[900px]:px-4 max-[900px]:py-[0.85rem] max-[900px]:text-[0.92rem] max-[900px]:text-left max-[900px]:hover:bg-[#c9b37e]/[0.08]"
                aria-expanded={orgOpen}
              >
                Organisation
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${orgOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Dropdown panel */}
              <div
                className={`min-[901px]:absolute min-[901px]:top-[calc(100%+0.6rem)] min-[901px]:right-0 min-[901px]:w-[13.5rem] min-[901px]:bg-white min-[901px]:border min-[901px]:border-[#c9b37e]/35 min-[901px]:shadow-[0_8px_24px_rgba(39,70,41,0.1)] min-[901px]:py-[0.35rem] min-[901px]:rounded-sm max-[900px]:pl-3 overflow-hidden transition-all duration-200 ${
                  orgOpen
                    ? "opacity-100 visible translate-y-0"
                    : "min-[901px]:opacity-0 min-[901px]:invisible min-[901px]:-translate-y-1 min-[901px]:pointer-events-none max-[900px]:hidden"
                }`}
              >
                <Link
                  href="/dkimvb"
                  onClick={closeMenu}
                  className="block px-4 py-[0.9rem] text-[#274629] text-[0.88rem] no-underline hover:bg-[#c9b37e]/[0.08] max-[900px]:pl-6"
                >
                  DKIMVB Website
                </Link>

                <div
                  className="h-[1px] bg-gradient-to-r from-transparent via-[#c9b37e]/45 to-transparent max-[900px]:via-[#c9b37e]/55 max-[900px]:mx-4 max-[900px]:mt-[0.35rem] max-[900px]:mb-[0.15rem]"
                  aria-hidden="true"
                />

                <Link
                  href="https://dklm.in"
                  onClick={closeMenu}
                  className="block px-4 py-[0.9rem] text-[#274629] text-[0.88rem] no-underline hover:bg-[#c9b37e]/[0.08] max-[900px]:pl-6"
                >
                  DKLM Website
                </Link>

                <div
                  className="h-[1px] bg-gradient-to-r from-transparent via-[#c9b37e]/45 to-transparent max-[900px]:via-[#c9b37e]/55 max-[900px]:mx-4 max-[900px]:mt-[0.35rem] max-[900px]:mb-[0.15rem]"
                  aria-hidden="true"
                />

                <Link
                  href="https://www.ejamaath.com/"
                  onClick={closeMenu}
                  className="block px-4 py-[0.9rem] text-[#274629] text-[0.88rem] no-underline hover:bg-[#c9b37e]/[0.08] max-[900px]:pl-6"
                >
                  EJAMAATH
                </Link>

                <div
                  className="h-[1px] bg-gradient-to-r from-transparent via-[#c9b37e]/45 to-transparent max-[900px]:via-[#c9b37e]/55 max-[900px]:mx-4 max-[900px]:mt-[0.35rem] max-[900px]:mb-[0.15rem]"
                  aria-hidden="true"
                />

                <Link
                  href="https://mufied.in/"
                  onClick={closeMenu}
                  className="block px-4 py-[0.9rem] text-[#274629] text-[0.88rem] no-underline hover:bg-[#c9b37e]/[0.08] max-[900px]:pl-6"
                >
                  MUFIED
                </Link>
              </div>
            </div>
          </nav>
        </div>
      </div>

      <div className="h-[1px] bg-gradient-to-r from-transparent via-[#c9b37e]/55 to-transparent" />
    </header>
  );
}
