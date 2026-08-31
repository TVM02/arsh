"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Search, Loader2, User, MapPin, X, GraduationCap, AlertCircle, ShieldCheck, Building2, Phone } from "lucide-react";

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError("");
    setSearchResult(null);

    try {
      const res = await fetch(`/api/public/search-person?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setSearchError(data.error || "Something went wrong");
      } else {
        setSearchResult(data);
      }
    } catch (err) {
      setSearchError("Failed to search. Try again.");
    } finally {
      setIsSearching(false);
    }
  };

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMenuOpen && !event.target.closest(".mobile-menu-container")) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <header className="sticky top-0 z-50 isolate bg-white text-gray-800 shadow-sm border-b border-gray-100">
      <div className="container mx-auto px-4 py-3">
        <nav className="flex items-center justify-between">
          {/* Logo Section */}
          <a href="/" className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center">
              <Image
                src={"/logo.png"}
                alt="Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <div>
              <span className="text-xl font-bold text-gray-900">DKJU</span>
              <p className="text-xs text-[#0f766e] font-medium">
                Smart Islamic Education
              </p>
            </div>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-7 bg-white">
            {[
              ["/", "Home"],
              ["/about", "About"],
              ["/events", "Events"],
              ["/leaders", "Leaders"],
              ["/dkju-axis", "Portals"],
              ["/contact", "Contact"],
            ].map(([href, label]) => {
              const isActive =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <a
                  key={href}
                  href={href}
                  className={`relative group text-sm font-medium transition-colors ${
                    isActive
                      ? "text-[#00a86b] font-semibold"
                      : "text-gray-600 hover:text-[#00a86b]"
                  }`}
                >
                  {label}
                  <span
                    className={`absolute -bottom-1 left-0 h-0.5 bg-[#00a86b] rounded-full transition-all ${
                      isActive ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </a>
              );
            })}

            {(() => {
              const isActive = pathname.startsWith("/results");
              return (
                <a
                  href="/results"
                  className={`relative group text-sm font-medium transition-colors ${
                    isActive
                      ? "text-[#00a86b] font-semibold"
                      : "text-gray-600 hover:text-[#00a86b]"
                  }`}
                >
                  Results
                  <span
                    className={`absolute -bottom-1 left-0 h-0.5 bg-[#00a86b] rounded-full transition-all ${
                      isActive ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </a>
              );
            })()}

            <a
              href="/brand-guide"
              className="text-sm px-5 py-2.5 inline-flex items-center gap-1.5 font-bold border border-[#00a86b] text-[#00a86b] hover:bg-[#00a86b] hover:text-white rounded-full transition-all"
            >
              Download
            </a>

            <a
              href="/admission/form"
              className="text-sm px-5 py-2.5 inline-flex items-center gap-1.5 font-bold"
              style={{
                borderRadius: "9999px",
                background: "linear-gradient(135deg,#facc15,#f59e0b)",
                color: "#1a3a2a",
                fontWeight: 700,
                boxShadow: "0 4px 16px rgba(245,158,11,0.3)",
                transition: "all 0.25s ease",
              }}
            >
              Admission
            </a>

            <form onSubmit={handleSearch} className="relative flex items-center ml-4">
              <input
                type="text"
                placeholder="Search MID / MSR ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-3 pr-8 py-[0.45rem] text-[0.85rem] border border-gray-300 rounded outline-none text-gray-800 focus:border-[#00a86b] transition-colors w-[200px]"
              />
              <button type="submit" disabled={isSearching} className="absolute right-2 text-gray-400 hover:text-[#00a86b]">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>

              {(searchResult || searchError) && (
                <div className="absolute top-[calc(100%+14px)] right-0 w-[320px] bg-white border border-gray-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] rounded-2xl p-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex justify-between items-center p-3 pb-2 border-b border-gray-50 mb-2">
                    <h4 className="text-[0.8rem] font-bold text-gray-400 uppercase tracking-wider">{searchError ? "Error" : "Search Result"}</h4>
                    <button type="button" onClick={() => { setSearchResult(null); setSearchError(""); setSearchQuery(""); }} className="p-1 rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {searchError ? (
                    <div className="p-4 pt-2 flex flex-col items-center justify-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      </div>
                      <p className="text-red-600 text-sm font-medium">{searchError}</p>
                    </div>
                  ) : searchResult ? (
                    <div className="p-3 pt-1 space-y-3 max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#00a86b]/20 to-[#00a86b]/5 flex items-center justify-center shadow-inner border border-[#00a86b]/10 shrink-0">
                          {searchResult.type === "student" ? (
                            <GraduationCap className="w-6 h-6 text-[#00a86b]" />
                          ) : searchResult.type === "madrasa" ? (
                            <Building2 className="w-6 h-6 text-[#00a86b]" />
                          ) : (
                            <User className="w-6 h-6 text-[#00a86b]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[1.05rem] font-bold text-gray-800 truncate leading-tight mb-0.5">{searchResult.name}</p>
                          <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[0.65rem] font-bold tracking-wide uppercase border border-gray-200">
                            {searchResult.id}
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 rounded-xl p-3 space-y-2.5 border border-gray-100">
                        {searchResult.type === "student" && (
                          <div className="flex items-start gap-2.5">
                            <ShieldCheck className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Guardian</p>
                              <p className="text-sm font-medium text-gray-700 leading-none uppercase break-words">{searchResult.guardianName || "N/A"}</p>
                            </div>
                          </div>
                        )}
                        {searchResult.type === "student" && searchResult.dob && searchResult.dob !== "N/A" && (
                          <div className="flex items-start gap-2.5">
                            <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Date of Birth</p>
                              <p className="text-sm font-medium text-gray-700 leading-none uppercase break-words">{searchResult.dob}</p>
                            </div>
                          </div>
                        )}
                        {(searchResult.type === "student" || searchResult.type === "teacher") && searchResult.madarsaName && (
                          <div className="flex items-start gap-2.5">
                            <Building2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Madrasa</p>
                              <p className="text-sm font-medium text-gray-700 leading-tight uppercase break-words">
                                {searchResult.madarsaName} ({searchResult.madarsaId})
                              </p>
                            </div>
                          </div>
                        )}
                        {(searchResult.type === "student" || searchResult.type === "teacher") && searchResult.phoneLast3 && searchResult.phoneLast3 !== "N/A" && (
                          <div className="flex items-start gap-2.5">
                            <Phone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Phone (Last 3)</p>
                              <p className="text-sm font-medium text-gray-700 leading-none uppercase break-words">***{searchResult.phoneLast3}</p>
                            </div>
                          </div>
                        )}
                        {searchResult.type === "teacher" && searchResult.qualification && searchResult.qualification !== "N/A" && (
                          <div className="flex items-start gap-2.5">
                            <GraduationCap className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Qualification</p>
                              <p className="text-sm font-medium text-gray-700 leading-none uppercase break-words">{searchResult.qualification}</p>
                            </div>
                          </div>
                        )}
                        {(searchResult.type === "student" || searchResult.type === "madrasa") && searchResult.managerPhone && searchResult.managerPhone !== "N/A" && (
                          <div className="flex items-start gap-2.5">
                            <Phone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Manager Phone</p>
                              <p className="text-sm font-medium text-gray-700 leading-none uppercase break-words">{searchResult.managerPhone}</p>
                            </div>
                          </div>
                        )}
                        {(searchResult.type === "student" || searchResult.type === "madrasa") && searchResult.sadarPhone && searchResult.sadarPhone !== "N/A" && (
                          <div className="flex items-start gap-2.5">
                            <Phone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Sadar Phone</p>
                              <p className="text-sm font-medium text-gray-700 leading-none uppercase break-words">{searchResult.sadarPhone}</p>
                            </div>
                          </div>
                        )}
                        {(searchResult.type === "madrasa" || searchResult.type === "student" || searchResult.type === "teacher") && searchResult.district && searchResult.district !== "N/A" && (
                          <div className="flex items-start gap-2.5">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">District</p>
                              <p className="text-sm font-medium text-gray-700 leading-tight uppercase break-words">
                                {searchResult.district}
                              </p>
                            </div>
                          </div>
                        )}
                        {(searchResult.type === "madrasa" || searchResult.type === "student" || searchResult.type === "teacher") && searchResult.mekhala && searchResult.mekhala !== "N/A" && (
                          <div className="flex items-start gap-2.5">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Mekhala</p>
                              <p className="text-sm font-medium text-gray-700 leading-tight uppercase break-words">
                                {searchResult.mekhala}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-2.5">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Address</p>
                            <p className="text-sm font-medium text-gray-700 leading-tight break-words">{(searchResult.address || "N/A").toUpperCase()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </form>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-800 focus:outline-none"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Sidebar Menu */}
      <div
        className={`mobile-menu-container fixed inset-0 z-50 transform ${isMenuOpen ? "translate-x-0" : "-translate-x-full"} md:hidden transition-transform duration-300 ease-in-out`}
      >
        {/* Overlay */}
        {isMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setIsMenuOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <div className="fixed left-0 top-0 h-full w-64 bg-[#052e2b] shadow-2xl overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-[#0f766e]/40">
            <a
              href="/"
              className="flex items-center space-x-3"
              onClick={() => setIsMenuOpen(false)}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center">
                <Image
                  src={"/logo.png"}
                  alt="Logo"
                  width={48}
                  height={48}
                  className="object-contain"
                />
              </div>
              <span className="text-lg font-bold">DKJU</span>
            </a>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="text-white focus:outline-none"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <nav className="p-4 space-y-4">
            {[
              ["/", "Home"],
              ["/about", "About"],
              ["/smart-class", "Smart Class"],
              ["/events", "Events"],
              ["/leaders", "Leaders"],
              ["/dkju-axis", "Portals"],
              ["/contact", "Contact"],
            ].map(([href, label]) => {
              const isActive =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <a
                  key={href}
                  href={href}
                  className={`block px-4 py-3 rounded-xl text-white transition-colors ${
                    isActive
                      ? "bg-[#00a86b]/30 text-[#22c55e] font-semibold"
                      : "hover:bg-white/10"
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {label}
                </a>
              );
            })}
            <a
              href="/results"
              className={`block px-4 py-3 rounded-lg transition-colors ${
                pathname.startsWith("/results")
                  ? "bg-teal-600 text-yellow-400 font-semibold"
                  : "hover:bg-teal-700 text-white"
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Results
            </a>
            <a
              href="/brand-guide"
              className="block px-4 py-3 rounded-full text-center font-bold transition-all border border-[#00a86b] text-[#00a86b] hover:bg-[#00a86b] hover:text-white mb-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Download
            </a>
            <a
              href="/admission/form"
              className="block px-4 py-3 rounded-full text-center font-bold transition-all"
              style={{
                background: "linear-gradient(135deg,#facc15,#f59e0b)",
                color: "#1a3a2a",
              }}
              onClick={() => setIsMenuOpen(false)}
            >
              Admission
            </a>
            
            <form onSubmit={handleSearch} className="relative flex items-center px-4 py-2">
              <input
                type="text"
                placeholder="Search MID / MSR ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-[0.85rem] border border-[#0f766e]/40 rounded outline-none text-white bg-[#052e2b] focus:border-[#00a86b] transition-colors"
              />
              <button type="submit" disabled={isSearching} className="absolute right-6 text-[#00a86b] hover:text-white">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>

              {(searchResult || searchError) && (
                <div className="absolute top-[calc(100%+10px)] left-4 right-4 bg-[#052e2b] border border-[#00a86b]/30 shadow-2xl rounded-2xl p-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex justify-between items-center p-3 pb-2 border-b border-white/5 mb-2">
                    <h4 className="text-[0.8rem] font-bold text-[#00a86b] uppercase tracking-wider">{searchError ? "Error" : "Search Result"}</h4>
                    <button type="button" onClick={() => { setSearchResult(null); setSearchError(""); setSearchQuery(""); }} className="p-1 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {searchError ? (
                    <div className="p-4 pt-2 flex flex-col items-center justify-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      </div>
                      <p className="text-red-400 text-sm font-medium">{searchError}</p>
                    </div>
                  ) : searchResult ? (
                    <div className="p-3 pt-1 space-y-3 max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#00a86b]/30 to-[#00a86b]/10 flex items-center justify-center shadow-inner border border-[#00a86b]/20 shrink-0">
                          {searchResult.type === "student" ? (
                            <GraduationCap className="w-6 h-6 text-[#6ee7b7]" />
                          ) : searchResult.type === "madrasa" ? (
                            <Building2 className="w-6 h-6 text-[#6ee7b7]" />
                          ) : (
                            <User className="w-6 h-6 text-[#6ee7b7]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[1.05rem] font-bold text-white truncate leading-tight mb-0.5">{searchResult.name}</p>
                          <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/10 text-[#6ee7b7] text-[0.65rem] font-bold tracking-wide uppercase border border-white/10">
                            {searchResult.id}
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-black/20 rounded-xl p-3 space-y-2.5 border border-white/5">
                        {searchResult.type === "student" && (
                          <div className="flex items-start gap-2.5">
                            <ShieldCheck className="w-4 h-4 text-[#00a86b] mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Guardian</p>
                              <p className="text-sm font-medium text-gray-200 leading-none uppercase break-words">{searchResult.guardianName || "N/A"}</p>
                            </div>
                          </div>
                        )}
                        {searchResult.type === "student" && searchResult.dob && searchResult.dob !== "N/A" && (
                          <div className="flex items-start gap-2.5">
                            <User className="w-4 h-4 text-[#00a86b] mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Date of Birth</p>
                              <p className="text-sm font-medium text-gray-200 leading-none uppercase break-words">{searchResult.dob}</p>
                            </div>
                          </div>
                        )}
                        {(searchResult.type === "student" || searchResult.type === "teacher") && searchResult.madarsaName && (
                          <div className="flex items-start gap-2.5">
                            <Building2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Madrasa</p>
                              <p className="text-sm font-medium text-gray-200 leading-tight uppercase break-words">
                                {searchResult.madarsaName} ({searchResult.madarsaId})
                              </p>
                            </div>
                          </div>
                        )}
                        {(searchResult.type === "student" || searchResult.type === "teacher") && searchResult.phoneLast3 && searchResult.phoneLast3 !== "N/A" && (
                          <div className="flex items-start gap-2.5">
                            <Phone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Phone (Last 3)</p>
                              <p className="text-sm font-medium text-gray-200 leading-none uppercase break-words">***{searchResult.phoneLast3}</p>
                            </div>
                          </div>
                        )}
                        {searchResult.type === "teacher" && searchResult.qualification && searchResult.qualification !== "N/A" && (
                          <div className="flex items-start gap-2.5">
                            <GraduationCap className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Qualification</p>
                              <p className="text-sm font-medium text-gray-200 leading-none uppercase break-words">{searchResult.qualification}</p>
                            </div>
                          </div>
                        )}
                        {(searchResult.type === "student" || searchResult.type === "madrasa") && searchResult.managerPhone && searchResult.managerPhone !== "N/A" && (
                          <div className="flex items-start gap-2.5">
                            <Phone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Manager Phone</p>
                              <p className="text-sm font-medium text-gray-200 leading-none uppercase break-words">{searchResult.managerPhone}</p>
                            </div>
                          </div>
                        )}
                        {(searchResult.type === "student" || searchResult.type === "madrasa") && searchResult.sadarPhone && searchResult.sadarPhone !== "N/A" && (
                          <div className="flex items-start gap-2.5">
                            <Phone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Sadar Phone</p>
                              <p className="text-sm font-medium text-gray-200 leading-none uppercase break-words">{searchResult.sadarPhone}</p>
                            </div>
                          </div>
                        )}
                        {(searchResult.type === "madrasa" || searchResult.type === "student" || searchResult.type === "teacher") && searchResult.district && searchResult.district !== "N/A" && (
                          <div className="flex items-start gap-2.5">
                            <MapPin className="w-4 h-4 text-[#00a86b] mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">District</p>
                              <p className="text-sm font-medium text-gray-200 leading-tight uppercase break-words">
                                {searchResult.district}
                              </p>
                            </div>
                          </div>
                        )}
                        {(searchResult.type === "madrasa" || searchResult.type === "student" || searchResult.type === "teacher") && searchResult.mekhala && searchResult.mekhala !== "N/A" && (
                          <div className="flex items-start gap-2.5">
                            <MapPin className="w-4 h-4 text-[#00a86b] mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Mekhala</p>
                              <p className="text-sm font-medium text-gray-200 leading-tight uppercase break-words">
                                {searchResult.mekhala}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-2.5">
                          <MapPin className="w-4 h-4 text-[#00a86b] mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Address</p>
                            <p className="text-sm font-medium text-gray-200 leading-tight break-words">{(searchResult.address || "N/A").toUpperCase()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </form>
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
