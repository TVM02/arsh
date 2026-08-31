import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { toast } from "sonner";

/**
 * Inspector Session Manager
 * Handles session timing and automatic logout for inspectors
 */

class InspectorSessionManager {
  constructor() {
    this.sessionTimer = null;
    this.warningTimer = null;
    this.sessionListener = null;
    this.userId = null;
    this.allowedTime = null;
    this.isActive = false;
    this.activityCleanup = null;
    this.lastActivityUpdate = 0;
  }

  /**
   * Start session for inspector
   * @param {string} userId - Inspector user ID
   * @param {number} allowedTime - Session time in minutes
   * @param {{ preserveExistingWindow?: boolean, sessionStart?: number, sessionEnd?: number }} options
   */
  async startSession(userId, allowedTime, options = {}) {
    const {
      preserveExistingWindow = false,
      sessionStart: providedSessionStart,
      sessionEnd: providedSessionEnd,
    } = options;

    if (
      this.isActive &&
      this.userId === userId &&
      this.allowedTime === allowedTime &&
      this.sessionListener
    ) {
      return;
    }

    this.stopSession();

    this.userId = userId;
    this.allowedTime = allowedTime;
    this.isActive = true;

    const sessionStartTime = providedSessionStart
      ? new Date(providedSessionStart)
      : new Date();
    const sessionEndTime = providedSessionEnd
      ? new Date(providedSessionEnd)
      : new Date(sessionStartTime.getTime() + allowedTime * 60 * 1000);

    this.expectedSessionEndTime = sessionEndTime;
    this.sessionInitializedAt = Date.now();

    try {
      if (preserveExistingWindow) {
        await updateDoc(doc(db, "users", userId), {
          active: true,
          sessionEndTime,
          lastActivity: new Date(),
        });
      } else {
        await updateDoc(doc(db, "users", userId), {
          sessionStartTime,
          sessionEndTime,
          active: true,
          lastActivity: sessionStartTime,
        });
      }

      const remainingMinutes = Math.max(
        0,
        (sessionEndTime.getTime() - Date.now()) / 60000,
      );

      this.startSessionTimer(remainingMinutes);
      this.startSessionListener(userId);

      console.log(`Inspector session started: ${allowedTime} minutes`);
    } catch (error) {
      console.error("Error starting inspector session:", error);
      toast.error("Failed to start session");
    }
  }

  /**
   * Start the session timer
   * @param {number} allowedTime - Session time in minutes
   */
  startSessionTimer(allowedTime) {
    const sessionDuration = Math.max(0, allowedTime * 60 * 1000); // Convert to milliseconds
    if (sessionDuration <= 0) {
      this.endSession();
      return;
    }

    const warningTime = Math.min(
      sessionDuration,
      Math.max(300000, sessionDuration * 0.1),
    ); // 5 minutes or 10% of session, whichever is greater

    const warningDelay = Math.max(0, sessionDuration - warningTime);

    this.warningTimer = setTimeout(() => {
      const remainingMinutes = Math.max(1, Math.ceil(warningTime / 60000));
      toast.warning(
        `Session will expire in ${remainingMinutes} minutes. Please save your work.`,
        {
          duration: 10000,
        },
      );
    }, warningDelay);

    this.sessionTimer = setTimeout(async () => {
      await this.endSession();
    }, sessionDuration);
  }

  /**
   * Listen for session status changes in Firestore
   * @param {string} userId - Inspector user ID
   */
  startSessionListener(userId) {
    let isFirstSnapshot = true;

    this.sessionListener = onSnapshot(
      doc(db, "users", userId),
      (doc) => {
        // Always skip the very first snapshot — it fires immediately with the
        // existing (stale) document state, before our updateDoc({ active: true })
        // has been written to Firestore. Acting on it causes an instant forceLogout.
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          return;
        }

        if (doc.exists()) {
          const data = doc.data();
          const timeSinceInit = Date.now() - (this.sessionInitializedAt || 0);

          if (!data.active && this.isActive) {
            // Ignore stale active:false snapshots arriving immediately after initialization
            // Also ignore local cache snapshots that haven't synced with the server
            if (timeSinceInit > 10000 && !doc.metadata.hasPendingWrites) {
              this.forceLogout();
            }
          }

          if (data.sessionEndTime && this.isActive) {
            const now = new Date();
            const endTime =
              typeof data.sessionEndTime?.toDate === "function"
                ? data.sessionEndTime.toDate()
                : new Date(data.sessionEndTime);

            // Ignore stale snapshots where endTime is older than what we just wrote
            const isStaleEndTime = this.expectedSessionEndTime && 
              endTime.getTime() < this.expectedSessionEndTime.getTime() - 1000;

            if (now >= endTime && !isStaleEndTime) {
              this.endSession();
            }
          }
        }
      },
      (error) => {
        console.warn("Inspector session listener error:", error);
      },
    );
  }

  /**
   * Update last activity timestamp
   */
  async updateActivity() {
    if (!this.userId || !this.isActive) return;

    const now = Date.now();
    if (now - this.lastActivityUpdate < 30000) return;

    this.lastActivityUpdate = now;

    try {
      await updateDoc(doc(db, "users", this.userId), {
        lastActivity: new Date(),
      });
    } catch (error) {
      if (error?.code !== "permission-denied") {
        console.error("Error updating activity:", error);
      }
    }
  }

  /**
   * End the session normally
   */
  async endSession() {
    if (!this.isActive) return;

    this.isActive = false;
    this.clearTimers();

    try {
      // Update user document
      await updateDoc(doc(db, "users", this.userId), {
        active: false,
        sessionEndTime: new Date(),
        lastActivity: new Date(),
      });

      toast.error("Session expired. You will be logged out.", {
        duration: 5000,
      });

      // Logout user
      setTimeout(async () => {
        await this.logout();
      }, 2000);
    } catch (error) {
      console.error("Error ending session:", error);
      await this.logout();
    }
  }

  /**
   * Force logout (called when session is ended externally)
   */
  async forceLogout() {
    this.isActive = false;
    this.clearTimers();

    toast.error("Your session has been terminated by an administrator.", {
      duration: 5000,
    });

    setTimeout(async () => {
      await this.logout();
    }, 2000);
  }

  /**
   * Extend session (if needed in future)
   * @param {number} additionalMinutes - Additional time in minutes
   */
  async extendSession(additionalMinutes) {
    if (!this.isActive || !this.userId) return;

    try {
      const newEndTime = new Date(Date.now() + additionalMinutes * 60 * 1000);

      await updateDoc(doc(db, "users", this.userId), {
        sessionEndTime: newEndTime,
      });

      // Restart timer with new duration
      this.clearTimers();
      const remainingTime = Math.ceil((newEndTime - new Date()) / 60000);
      this.startSessionTimer(remainingTime);

      toast.success(`Session extended by ${additionalMinutes} minutes.`);
    } catch (error) {
      console.error("Error extending session:", error);
      toast.error("Failed to extend session");
    }
  }

  /**
   * Clear all timers
   */
  clearTimers() {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.sessionListener) {
      this.sessionListener();
      this.sessionListener = null;
    }
    if (this.activityCleanup) {
      this.activityCleanup();
      this.activityCleanup = null;
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      this.stopSession();
      await signOut(auth);
      // Redirect will be handled by auth state listener
      window.location.href = "/auth/login/inspector";
    } catch (error) {
      console.error("Error during logout:", error);
      // Force redirect even if logout fails
      window.location.href = "/auth/login/inspector";
    }
  }

  /**
   * Stop session manager
   */
  stopSession() {
    this.isActive = false;
    this.userId = null;
    this.allowedTime = null;
    this.lastActivityUpdate = 0;
    this.clearTimers();
  }
}

// Export singleton instance
export const inspectorSessionManager = new InspectorSessionManager();

/**
 * Activity tracker for updating last activity
 */
export const startActivityTracking = () => {
  if (inspectorSessionManager.activityCleanup) {
    inspectorSessionManager.activityCleanup();
    inspectorSessionManager.activityCleanup = null;
  }

  const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];

  const updateActivity = () => {
    inspectorSessionManager.updateActivity();
  };

  events.forEach((event) => {
    document.addEventListener(event, updateActivity, { passive: true });
  });

  inspectorSessionManager.activityCleanup = () => {
    events.forEach((event) => {
      document.removeEventListener(event, updateActivity);
    });
  };

  return inspectorSessionManager.activityCleanup;
};
