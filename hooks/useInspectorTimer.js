"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  inspectorSessionManager,
  startActivityTracking,
} from "@/lib/inspectorSessionManager";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";

export const useInspectorTimer = (userData, enabled = true) => {
  const router = useRouter();
  const pathname = usePathname();
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [showRulesDialog, setShowRulesDialog] = useState(false);
  const hasInitializedRef = useRef(false);
  const hasHandledExpiryRef = useRef(false);
  const lastUserIdRef = useRef(null);
  const skipSessionRef = useRef(false);

  const formatTimeRemaining = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const normalizeAllowedTimeMinutes = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return 60;

    // Older auth payloads sometimes carried seconds (3600) while inspector
    // admin settings store minutes (60).
    return numericValue > 1440 ? Math.ceil(numericValue / 60) : numericValue;
  };

  const getTimerColor = (seconds) => {
    const minutes = seconds / 60;
    if (minutes <= 5) return "text-red-600";
    if (minutes <= 15) return "text-orange-600";
    return "text-green-600";
  };

  const sessionKey = userData?.uid ? `inspector_session_${userData.uid}` : null;
  const sessionStartKey = userData?.uid
    ? `inspector_session_start_${userData.uid}`
    : null;
  const sessionEndKey = userData?.uid
    ? `inspector_session_end_${userData.uid}`
    : null;
  const rulesSeenKey = userData?.uid
    ? `inspector_rules_seen_${userData.uid}`
    : null;

  const clearLocalSession = useCallback(() => {
    if (!sessionKey || !sessionStartKey || !sessionEndKey) return;
    localStorage.removeItem(sessionKey);
    localStorage.removeItem(sessionStartKey);
    localStorage.removeItem(sessionEndKey);
  }, [sessionEndKey, sessionKey, sessionStartKey]);

  const handleSessionExpiry = useCallback(async () => {
    if (!userData?.uid || hasHandledExpiryRef.current) return;
    hasHandledExpiryRef.current = true;
    setSessionActive(false);

    try {
      await updateDoc(doc(db, "users", userData.uid), {
        active: false,
        sessionEndTime: new Date(),
        lastActivity: new Date(),
        logoutReason: "session_expired",
      });
    } catch (error) {
      console.error("Error updating session on expiry:", error);
    }

    clearLocalSession();
    inspectorSessionManager.stopSession();
    toast.error("Session expired! Redirecting to login.");

    setTimeout(() => {
      router.replace("/auth/login/inspector");
    }, 1200);
  }, [clearLocalSession, router, userData?.uid]);

  const startOrResumeSession = useCallback(
    async (allowedTimeMinutes) => {
      if (!userData?.uid || !sessionKey || !sessionStartKey || !sessionEndKey) {
        return;
      }

      const allowedMinutes = normalizeAllowedTimeMinutes(allowedTimeMinutes);
      const existingSession = localStorage.getItem(sessionKey);
      const storedSessionEndTime = localStorage.getItem(sessionEndKey);

      if (existingSession === "active" && storedSessionEndTime) {
        const sessionEnd = Number(storedSessionEndTime);
        if (!Number.isFinite(sessionEnd)) {
          clearLocalSession();
        } else {
          const remaining = Math.max(
            0,
            Math.ceil((sessionEnd - Date.now()) / 1000),
          );

          if (remaining > 0) {
            await inspectorSessionManager.startSession(
              userData.uid,
              allowedMinutes,
              { preserveExistingWindow: true, sessionEnd },
            );
            startActivityTracking();
            setTimeRemaining(remaining);
            setSessionActive(true);
            return;
          }
          // Stale expired session — clear it and fall through to start a fresh one
          clearLocalSession();
        }
      }

      const sessionStart = Date.now();
      const sessionEnd = sessionStart + allowedMinutes * 60 * 1000;

      localStorage.setItem(sessionKey, "active");
      localStorage.setItem(sessionStartKey, String(sessionStart));
      localStorage.setItem(sessionEndKey, String(sessionEnd));

      await inspectorSessionManager.startSession(
        userData.uid,
        allowedMinutes,
        {
          sessionStart,
          sessionEnd,
        },
      );
      startActivityTracking();

      setTimeRemaining(
        Math.max(0, Math.ceil((sessionEnd - Date.now()) / 1000)),
      );
      setSessionActive(true);
    },
    [
      clearLocalSession,
      handleSessionExpiry,
      sessionEndKey,
      sessionKey,
      sessionStartKey,
      userData?.uid,
    ],
  );

  const handleRulesAcknowledged = useCallback(async () => {
    if (!userData?.uid || !rulesSeenKey) return;

    localStorage.setItem(rulesSeenKey, "true");
    setShowRulesDialog(false);

    try {
      let allowedTimeMinutes = userData?.allowedTime
        ? normalizeAllowedTimeMinutes(userData.allowedTime)
        : 60;

      if (!userData?.allowedTime) {
        try {
          const userDocSnap = await getDoc(doc(db, "users", userData.uid));
          if (userDocSnap.exists()) {
            allowedTimeMinutes = normalizeAllowedTimeMinutes(
              userDocSnap.data()?.allowedTime || 60,
            );
          }
        } catch {
          // use default
        }
      }

      await startOrResumeSession(allowedTimeMinutes);
      toast.success("Inspection session started.");
    } catch (error) {
      console.error("Error starting session after acknowledgment:", error);
      toast.error("Failed to start session. Please try again.");
    }
  }, [rulesSeenKey, startOrResumeSession, userData?.uid, userData?.allowedTime]);



  useEffect(() => {
    if (!enabled) return;
    if (!userData?.uid) return;
    if (skipSessionRef.current) return; // Skip session setup if page was refreshed

    if (lastUserIdRef.current !== userData.uid) {
      hasInitializedRef.current = false;
      hasHandledExpiryRef.current = false;
      lastUserIdRef.current = userData.uid;
    }

    if (hasInitializedRef.current) return;

    const setupSession = async () => {
      try {
        // Use allowedTime from in-memory userData first — avoids a Firestore
        // round-trip that can fail in production due to auth/rule timing.
        let allowedTimeMinutes = userData?.allowedTime
          ? normalizeAllowedTimeMinutes(userData.allowedTime)
          : 60;

        // Only fall back to Firestore if allowedTime is missing from userData
        if (!userData?.allowedTime) {
          try {
            const userDocSnap = await getDoc(doc(db, "users", userData.uid));
            if (userDocSnap.exists()) {
              allowedTimeMinutes = normalizeAllowedTimeMinutes(
                userDocSnap.data()?.allowedTime || 60,
              );
            }
          } catch {
            // Firestore read failed; use default 60 min
          }
        }

        const hasSeenRules = rulesSeenKey
          ? localStorage.getItem(rulesSeenKey)
          : null;
        const existingSession = sessionKey
          ? localStorage.getItem(sessionKey)
          : null;
        const storedSessionEndTime = sessionEndKey
          ? localStorage.getItem(sessionEndKey)
          : null;

        if (existingSession === "active" && storedSessionEndTime) {
          await startOrResumeSession(allowedTimeMinutes);
        } else if (!hasSeenRules) {
          setShowRulesDialog(true);
        } else {
          await startOrResumeSession(allowedTimeMinutes);
        }

        hasInitializedRef.current = true;
      } catch (error) {
        console.error("Error initializing inspector session:", error);
      }
    };

    setupSession();
  }, [
    rulesSeenKey,
    sessionEndKey,
    sessionKey,
    startOrResumeSession,
    userData?.uid,
    userData?.allowedTime,
    enabled,
  ]);

  useEffect(() => {
    let timerInterval;

    if (sessionActive && sessionEndKey) {
      timerInterval = setInterval(() => {
        const storedSessionEndTime = localStorage.getItem(sessionEndKey);
        const remaining = storedSessionEndTime
          ? Math.max(
              0,
              Math.ceil((Number(storedSessionEndTime) - Date.now()) / 1000),
            )
          : 0;

        setTimeRemaining(remaining);

        if (remaining <= 0) {
          clearInterval(timerInterval);
          handleSessionExpiry();
        }
      }, 1000);
    }

    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [handleSessionExpiry, sessionActive, sessionEndKey]);

  useEffect(() => {
    if (!userData?.uid) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && sessionActive) {
        inspectorSessionManager.updateActivity();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Clean up the inspector session timer and global activity tracker on unmount
      inspectorSessionManager.stopSession();
    };
  }, [sessionActive, userData?.uid, pathname]);

  return {
    timeRemaining,
    sessionActive,
    showRulesDialog,
    setShowRulesDialog,
    formatTimeRemaining,
    getTimerColor,
    handleRulesAcknowledged,
  };
};
