"use client";

import { useEffect } from "react";
import {
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const UPDATE_INTERVAL_MS = 10000;

export default function SessionAnalytics() {
  useEffect(() => {
    let cancelled = false;
    let logDocRef = null;
    let activeSessionId = "";
    let sessionStart = 0;

    const readSession = () => ({
      sessionId: sessionStorage.getItem("dkju-active-login-session") || "",
      logId: sessionStorage.getItem("dkju-active-login-log-id") || "",
      startedAt: Number(sessionStorage.getItem("dkju-session-start") || 0),
    });

    const resolveLog = () => {
      const current = readSession();
      if (!current.sessionId || !current.startedAt) return false;
      if (!current.logId) return false;

      if (current.sessionId !== activeSessionId) {
        activeSessionId = current.sessionId;
        sessionStart = current.startedAt;
        logDocRef = doc(db, "LoginLogs", current.logId);
      }
      return Boolean(logDocRef);
    };

    const updateDuration = async (status = "active") => {
      if (!resolveLog() || cancelled) return;
      const durationSeconds = Math.max(0, Math.round((Date.now() - sessionStart) / 1000));
      try {
        await updateDoc(logDocRef, {
          durationSeconds,
          lastSeenAt: serverTimestamp(),
          lastSeenAtClient: new Date().toISOString(),
          status,
        });
      } catch (error) {
        console.warn("Unable to update session analytics:", error);
      }
    };

    const touchActiveSession = () => updateDuration("active");
    touchActiveSession();
    const interval = window.setInterval(touchActiveSession, UPDATE_INTERVAL_MS);
    const handleUnload = () => updateDuration("closed");

    window.addEventListener("dkju-session-started", touchActiveSession);
    window.addEventListener("visibilitychange", touchActiveSession);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("dkju-session-started", touchActiveSession);
      window.removeEventListener("visibilitychange", touchActiveSession);
      window.removeEventListener("pagehide", handleUnload);
      cancelled = true;
    };
  }, []);

  return null;
}
