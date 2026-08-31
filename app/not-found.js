"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Home, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f3f0e7] flex items-center flex-col justify-center p-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="w-full h-full bg-[#d8bf78]/10"></div>
      </div>

      <div className="w-full max-w-lg relative z-10 text-center space-y-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-xl border border-[#d8bf78]/30">
            <Image src="/logo.png" alt="DKJU Logo" width={80} height={80} className="object-contain" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#274629] tracking-tight">DKJU</h2>
            <p className="text-sm font-medium text-[#274629]/70">Smart Islamic Education</p>
          </div>
        </div>

        <div className="space-y-4 bg-white/90 backdrop-blur-md p-8 rounded-3xl shadow-lg border border-[#d8bf78]/20">
          <div className="flex justify-center">
            <Compass className="w-16 h-16 text-[#d8bf78] animate-pulse" />
          </div>
          <h1 className="text-6xl font-extrabold text-[#274629]">
            404
          </h1>
          <h3 className="text-2xl font-semibold text-slate-800">Page Not Found</h3>
          <p className="text-slate-600 max-w-md mx-auto leading-relaxed">
            Oops! It seems you&apos;ve wandered into an unknown path. The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          </p>

          <div className="pt-6 flex justify-center w-full">
            <Link href="/">
              <Button className="h-12 px-8 bg-[#274629] hover:bg-[#1a2f1b] text-[#f3f0e7] font-semibold rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
                <Home className="w-5 h-5" />
                Return to Homepage
              </Button>
            </Link>
          </div>
        </div>

        <div className="text-sm text-slate-500 font-medium pt-8">
          Need assistance? Contact Technical Support: <span className="text-[#274629] font-bold">8891177850</span>
        </div>
      </div>
    </div>
  );
}
