"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WifiOff, RefreshCw, Home, AlertCircle } from "lucide-react";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Check initial connection status
    setIsOnline(navigator.onLine);

    // Add event listeners for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup event listeners on component unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRefresh = () => {
    if (isOnline) {
      window.location.reload();
    } else {
      // Try to go back to homepage
      window.location.href = '/';
    }
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-teal-200 to-white rounded-xl flex items-center justify-center shadow-lg mx-auto mb-4">
            <Image src="/logo.png" alt="DKJU Logo" width={60} height={60} />
          </div>
          <h1 className="text-2xl font-bold text-teal-700">DKJU</h1>
          <p className="text-sm text-teal-600">Smart Islamic Education</p>
        </div>

        {/* Offline Status Card */}
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4">
              {isOnline ? (
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 text-green-600" />
                </div>
              ) : (
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                  <WifiOff className="h-8 w-8 text-orange-600" />
                </div>
              )}
            </div>
            <CardTitle className="text-xl">
              {isOnline ? "Connection Restored!" : "You're Offline"}
            </CardTitle>
            <CardDescription className="text-base">
              {isOnline 
                ? "Your internet connection has been restored. You can now reload the page."
                : "It looks like you're not connected to the internet. Please check your connection and try again."
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Connection Status */}
            <div className={`p-3 rounded-lg flex items-center gap-3 ${
              isOnline 
                ? "bg-green-50 border border-green-200" 
                : "bg-orange-50 border border-orange-200"
            }`}>
              <AlertCircle className={`h-5 w-5 ${
                isOnline ? "text-green-600" : "text-orange-600"
              }`} />
              <div>
                <p className={`font-medium ${
                  isOnline ? "text-green-800" : "text-orange-800"
                }`}>
                  {isOnline ? "Online" : "Offline"}
                </p>
                <p className={`text-sm ${
                  isOnline ? "text-green-600" : "text-orange-600"
                }`}>
                  {isOnline 
                    ? "Ready to continue" 
                    : "Check your internet connection"
                  }
                </p>
              </div>
            </div>

            {/* Offline Tips */}
            {!isOnline && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">While you&apos;re offline:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Check your Wi-Fi or mobile data connection</li>
                  <li>• Try moving to a location with better signal</li>
                  <li>• Some cached pages may still be available</li>
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-4">
              <Button 
                onClick={handleRefresh}
                className={`w-full ${
                  isOnline 
                    ? "bg-green-600 hover:bg-green-700" 
                    : "bg-teal-600 hover:bg-teal-700"
                }`}
                disabled={!isOnline}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {isOnline ? "Reload Page" : "Retry Connection"}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleGoHome}
                className="w-full"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Homepage
              </Button>
            </div>

            {/* PWA Info */}
            <div className="text-center pt-4 border-t">
              <p className="text-xs text-gray-500">
                This app works offline with limited functionality
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-teal-600">
            Smart Islamic Education Management System
          </p>
        </div>
      </div>
    </div>
  );
}