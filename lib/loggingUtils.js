import { db } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

const createLogRef = () => {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return doc(collection(db, "LoginLogs"), id);
};

/**
 * Get user's approximate location
 * @returns {Promise<Object>} Object containing latitude, longitude, accuracy or error
 */
export const getUserLocation = async () => {
  try {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return { error: "Geolocation not supported" };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          console.warn("Geolocation error:", error);
          resolve({ error: "Location access denied or unavailable" });
        },
        { timeout: 10000, enableHighAccuracy: false, maximumAge: 60000 },
      );
    });
  } catch (error) {
    console.warn("Location error:", error);
    return { error: "Location unavailable" };
  }
};

/**
 * Log login activity to Firestore
 * @param {Object} user Firebase user object
 * @param {string} userRole Role of the user
 * @param {Object} location Location object from getUserLocation
 * @param {string} name Full name of the user
 * @param {boolean} isNewUser Whether this is a new Firebase Auth user
 */
/**
 * Log application approval or rejection by a sadar/madarsa admin
 */
export const logApplicationActivity = async (user, userRole, activityType, applicationData) => {
  try {
    const logData = {
      userId: user.uid,
      email: user.email,
      name: user.displayName || user.email || "N/A",
      role: userRole,
      loginTimestamp: serverTimestamp(),
      activityType,
      actionPerformed:
        activityType === "application_approved"
          ? `One Student Application is Approved (${applicationData?.applicantName || applicationData?.fullName || ""} – ${applicationData?.admissionNumber || ""})`
          : `One Student Application is Rejected (${applicationData?.applicantName || applicationData?.fullName || ""} – ${applicationData?.admissionNumber || ""}${applicationData?.reason ? " | Reason: " + applicationData.reason : ""})`,
      details:
        activityType === "application_approved"
          ? `Approved admission application for ${applicationData?.fullName || ""}`
          : `Rejected admission application for ${applicationData?.fullName || ""}. Reason: ${applicationData?.reason || "Not provided"}`,
      applicantName: applicationData?.fullName || "",
      admissionNumber: applicationData?.admissionNumber || "",
      rejectionReason: applicationData?.reason || null,
      platform: "web",
      loginMethod: "email_password",
      ip: "Client-side",
      location: null,
    };
    await setDoc(createLogRef(), logData);
    return true;
  } catch (error) {
    console.error("Error logging application activity:", error);
    return false;
  }
};

export const logLoginDetails = async (
  user,
  userRole,
  location,
  name,
  isNewUser = false,
) => {
  try {
    let clientContext = {};
    try {
      const response = await fetch("/api/security/client-context", {
        cache: "no-store",
      });
      clientContext = await response.json();
    } catch (contextError) {
      console.warn("Client context unavailable:", contextError);
    }

    const sessionId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const logRef = createLogRef();
    const clientEntryTime = new Date();
    const visitKey = `dkju-visits:${user.uid || user.email || "anonymous"}`;
    let visits = 1;
    if (typeof window !== "undefined") {
      visits = Number(localStorage.getItem(visitKey) || "0") + 1;
      localStorage.setItem(visitKey, String(visits));
      sessionStorage.setItem("dkju-active-login-session", sessionId);
      sessionStorage.setItem("dkju-active-login-log-id", logRef.id);
      sessionStorage.setItem("dkju-session-start", String(Date.now()));
    }

    const loginData = {
      sessionId,
      userId: user.uid,
      email: user.email,
      name: name || user.displayName || "N/A",
      role: userRole,
      loginTimestamp: serverTimestamp(),
      entryTime: serverTimestamp(),
      entryTimeClient: clientEntryTime.toISOString(),
      sessionStartedAtMs: clientEntryTime.getTime(),
      lastSeenAt: serverTimestamp(),
      lastSeenAtClient: clientEntryTime.toISOString(),
      durationSeconds: 0,
      visitCount: visits,
      location: location || null,
      userAgent:
        clientContext.userAgent ||
        (typeof navigator !== "undefined" ? navigator.userAgent : "N/A"),
      ip: clientContext.ip || "Unavailable",
      device: clientContext.device || "Unknown",
      system: clientContext.system || "Unknown",
      browser: clientContext.browser || "Unknown",
      os: clientContext.os || "Unknown",
      botScore: clientContext.botScore ?? null,
      botStatus: clientContext.botStatus || "likely_human",
      botScoreSource: clientContext.botScoreSource || "heuristic",
      botSignals: clientContext.botSignals || [],
      status: "active",
      loginMethod: "email_password",
      platform: "web",
      isNewAuthUser: isNewUser,
      authCreatedDuringLogin: isNewUser,
    };

    await setDoc(logRef, loginData);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("dkju-session-started"));
    }
    console.log("Login logged successfully:", loginData);
    return true;
  } catch (error) {
    console.error("Error logging login details:", error);
    // Return false instead of throwing to avoid blocking the login flow
    return false;
  }
};

export const closeActiveSessionLog = async () => {
  try {
    if (typeof window === "undefined") return false;
    const logId = sessionStorage.getItem("dkju-active-login-log-id");
    const sessionStart = Number(sessionStorage.getItem("dkju-session-start") || 0);
    if (!logId || !sessionStart) return false;

    await updateDoc(doc(db, "LoginLogs", logId), {
      durationSeconds: Math.max(0, Math.round((Date.now() - sessionStart) / 1000)),
      lastSeenAt: serverTimestamp(),
      lastSeenAtClient: new Date().toISOString(),
      status: "closed",
    });
    return true;
  } catch (error) {
    console.warn("Unable to close active session log:", error);
    return false;
  }
};
