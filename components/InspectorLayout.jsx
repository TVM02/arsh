"use client";

import Layout from "@/components/Layout";
import { useInspectorTimer } from "@/hooks/useInspectorTimer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, MapPin } from "lucide-react";
import useAuthStore from "@/lib/authStore";
import { useState, useEffect } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";

const InspectorLayout = ({ children }) => {
  const { userData } = useAuthStore();
  const [locationGranted, setLocationGranted] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("inspectorLocationGranted") === "true";
    }
    return false;
  });
  const [locationError, setLocationError] = useState(false);
  const [settingsUrl, setSettingsUrl] = useState("ms-settings:privacy-location");

  const {
    timeRemaining,
    sessionActive,
    showRulesDialog,
    setShowRulesDialog,
    formatTimeRemaining,
    getTimerColor,
    handleRulesAcknowledged
  } = useInspectorTimer(userData, locationGranted);

  
  const rawAllowedTime = Number(userData?.allowedTime || 60);
  const allowedTimeMinutes =
    Number.isFinite(rawAllowedTime) && rawAllowedTime > 1440
      ? Math.ceil(rawAllowedTime / 60)
      : rawAllowedTime || 60;
  // Inspector rules
  const inspectorRules = [
    "You must complete your inspection within the allocated time limit.",
    "Refreshing the page will keep your active session, but save your work frequently.",
    "Take detailed notes and photos during inspection.",
    "Submit your inspection report before the session expires.",
    "Be thorough and objective in your assessment.",
    "Follow all safety protocols during site visits.",
    "Maintain confidentiality of inspection findings until official submission.",
    "Contact admin immediately if you encounter technical issues.",
    "Your session will automatically expire - save your work frequently.",
    "You will receive a warning 5 minutes before session expiry."
  ];

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent.toLowerCase();
      if (ua.includes("mac os") || ua.includes("macintosh")) {
        setSettingsUrl("x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices");
      } else {
        setSettingsUrl("ms-settings:privacy-location");
      }
    }
  }, []);

  useEffect(() => {
    // If already granted this session, skip the GPS call entirely
    if (typeof window !== "undefined" && sessionStorage.getItem("inspectorLocationGranted") === "true") {
      setLocationGranted(true);
      setLocationError(false);
      return;
    }

    if (!navigator.geolocation) {
      setLocationError(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocationGranted(true);
        setLocationError(false);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("inspectorLocationGranted", "true");
        }
        try {
          if (userData?.uid) {
            const loc = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: new Date().toISOString()
            };
            await updateDoc(doc(db, "users", userData.uid), {
              recentLocations: arrayUnion(loc)
            });
          }
        } catch (error) {
          console.error("Error saving location:", error);
        }
      },
      (error) => {
        console.error("Location error:", error);
        setLocationGranted(false);
        setLocationError(true);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("inspectorLocationGranted");
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, [userData?.uid]);

  if (locationError || !locationGranted) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-white/80 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-8 max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <MapPin className="h-10 w-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Location Access Required</h2>
          <p className="text-gray-600 font-medium">
            To access this page, you must allow location access.
          </p>
          {typeof window !== "undefined" && !window.isSecureContext ? (
            <p className="text-red-600 bg-red-50 p-3 rounded border border-red-200 text-sm text-left">
              <strong>Developer Notice:</strong> You are accessing this portal via an insecure connection (HTTP over LAN). Browsers automatically block the location pop-up on insecure networks. To fix this, please test using <strong>http://localhost:3000</strong> directly on the host machine.
            </p>
          ) : (
            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded border text-left">
              If you blocked location access, please click the <strong>site information icon (lock icon)</strong> in your browser&apos;s address bar, change Location to <strong>Allow</strong>, and try again.
            </p>
          )}
          <div className="flex flex-col gap-3 mt-6">
            <a 
              href={settingsUrl} 
              className="w-full flex items-center justify-center h-12 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-md transition-colors border border-gray-300"
            >
              Go to Settings
            </a>
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg"
            >
              I have enabled Location
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Layout 
        showTimer={true}
        timeRemaining={timeRemaining}
        sessionActive={sessionActive}
        formatTimeRemaining={formatTimeRemaining}
        getTimerColor={getTimerColor}
        allowedTime={allowedTimeMinutes}
      >
        {children}
      </Layout>

      {/* Inspector Rules Dialog */}
      <Dialog open={showRulesDialog} onOpenChange={() => {}}>
        <DialogContent className="max-w-2xl bg-white max-h-[80vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
              Inspector Guidelines & Rules
            </DialogTitle>
            <DialogDescription>
              Please read and acknowledge these important guidelines before starting your inspection session.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-800">Session Information</span>
              </div>
              <p className="text-blue-700 text-sm">
                Your inspection session is limited to <strong>{allowedTimeMinutes} minutes</strong>.
                The timer will start immediately after acknowledging these rules.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Important Rules:</h3>
              <ul className="space-y-2">
                {inspectorRules.map((rule, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-700">{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="font-semibold text-red-800">Critical Warning</span>
              </div>
              <p className="text-red-700 text-sm">
                <strong>Save your work frequently.</strong> Your session will continue after a page refresh, but unsaved form changes may be lost.
                Complete inspections before the timer expires.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <Button 
                onClick={handleRulesAcknowledged}
                className="bg-teal-600 hover:bg-teal-700"
              >
                I Understand - Start Session
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InspectorLayout;
