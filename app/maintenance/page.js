"use client";

import { AlertTriangle, Settings, HardHat } from "lucide-react";
import Image from "next/image";

export default function MaintenancePage() {
  return (
    <div className="flex min-h-[calc(100vh-100px)] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto flex max-w-2xl flex-col items-center space-y-8 rounded-2xl bg-white p-10 shadow-xl ring-1 ring-black/5 sm:p-16">
        
        {/* Logo or Icon */}
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-teal-50">
          <div className="absolute inset-0 animate-ping rounded-full bg-teal-100 opacity-75"></div>
          <Settings className="relative z-10 h-12 w-12 animate-spin-slow text-teal-600" style={{ animationDuration: '4s' }} />
        </div>

        {/* Text Content */}
        <div className="space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            The Admission is currently closed.
          </h1>
        </div>

        {/* Decorative Badge */}
        <div className="flex flex-col items-center space-y-6">
          <div className="flex items-center space-x-2 rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 ring-1 ring-inset ring-orange-600/20">
            <HardHat className="h-4 w-4" />
            <span>Work in Progress</span>
          </div>
          
          <div className="text-sm font-medium text-gray-500">
            Contact technical Support: <a href="tel:8891177850" className="text-teal-600 hover:underline hover:text-teal-700">8891177850</a>
          </div>
        </div>
      </div>
    </div>
  );
}
