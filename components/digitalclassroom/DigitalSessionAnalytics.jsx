"use client";

import {
  useCallback,
  useEffect,
  useRef,
} from "react";

import {
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";


/* =========================================================
   SETTINGS
========================================================= */

const UPDATE_INTERVAL_MS =
  10000; // update every 10 seconds


/* =========================================================
   DIGITAL SESSION ANALYTICS
========================================================= */

export default function DigitalSessionAnalytics() {
  const cancelledRef =
    useRef(false);

  const logDocRef =
    useRef(null);

  const activeSessionIdRef =
    useRef("");

  const sessionStartRef =
    useRef(0);

  const updatingRef =
    useRef(false);


  /* =====================================================
     READ CURRENT LOGIN SESSION
  ===================================================== */

  const readSession =
    useCallback(() => {
      if (
        typeof window ===
        "undefined"
      ) {
        return {
          sessionId: "",
          logId: "",
          startedAt: 0,
        };
      }

      return {
        sessionId:
          sessionStorage.getItem(
            "dkju-active-login-session",
          ) || "",

        logId:
          sessionStorage.getItem(
            "dkju-active-login-log-id",
          ) || "",

        startedAt:
          Number(
            sessionStorage.getItem(
              "dkju-session-start",
            ) || 0,
          ),
      };
    }, []);


  /* =====================================================
     RESOLVE LOGIN LOG DOCUMENT
  ===================================================== */

  const resolveLog =
    useCallback(() => {
      const current =
        readSession();


      if (
        !current.sessionId ||
        !current.startedAt ||
        !current.logId
      ) {
        return false;
      }


      /* =====================================
         SESSION CHANGED
      ====================================== */

      if (
        current.sessionId !==
        activeSessionIdRef.current
      ) {
        activeSessionIdRef.current =
          current.sessionId;

        sessionStartRef.current =
          current.startedAt;

        logDocRef.current =
          doc(
            db,
            "LoginLogs",
            current.logId,
          );
      }


      return Boolean(
        logDocRef.current,
      );
    }, [
      readSession,
    ]);


  /* =====================================================
     UPDATE SESSION DURATION
  ===================================================== */

  const updateDuration =
    useCallback(
      async (
        status = "active",
      ) => {
        if (
          cancelledRef.current
        ) {
          return;
        }


        if (!resolveLog()) {
          return;
        }


        /* Prevent overlapping writes */

        if (
          updatingRef.current &&
          status === "active"
        ) {
          return;
        }


        const startedAt =
          sessionStartRef.current;


        if (!startedAt) {
          return;
        }


        const durationSeconds =
          Math.max(
            0,
            Math.round(
              (
                Date.now() -
                startedAt
              ) / 1000,
            ),
          );


        try {
          updatingRef.current =
            true;


          await updateDoc(
            logDocRef.current,
            {
              durationSeconds,

              lastSeenAt:
                serverTimestamp(),

              lastSeenAtClient:
                new Date().toISOString(),

              status,
            },
          );
        } catch (error) {
          /*
           * Don't break the Digital Portal
           * if analytics update fails.
           */

          console.warn(
            "Unable to update digital session analytics:",
            error,
          );
        } finally {
          updatingRef.current =
            false;
        }
      },
      [
        resolveLog,
      ],
    );


  /* =====================================================
     EFFECT
  ===================================================== */

  useEffect(() => {
    cancelledRef.current =
      false;


    /* =====================================
       FIRST UPDATE
    ====================================== */

    updateDuration(
      "active",
    );


    /* =====================================
       UPDATE EVERY 10 SECONDS
    ====================================== */

    const interval =
      window.setInterval(
        () => {
          updateDuration(
            "active",
          );
        },
        UPDATE_INTERVAL_MS,
      );


    /* =====================================
       LOGIN SESSION START EVENT
    ====================================== */

    const handleSessionStarted =
      () => {
        /*
         * Force session reference to
         * resolve again.
         */

        activeSessionIdRef.current =
          "";

        logDocRef.current =
          null;

        sessionStartRef.current =
          0;


        updateDuration(
          "active",
        );
      };


    /* =====================================
       TAB VISIBILITY
    ====================================== */

    const handleVisibilityChange =
      () => {
        /*
         * When user returns to tab,
         * immediately refresh lastSeen.
         */

        if (
          document.visibilityState ===
          "visible"
        ) {
          updateDuration(
            "active",
          );
        }
      };


    /* =====================================
       PAGE CLOSE
    ====================================== */

    const handlePageHide =
      () => {
        /*
         * Best-effort final update.
         *
         * Firestore write may not always
         * finish if browser closes instantly.
         */

        updateDuration(
          "closed",
        );
      };


    /* =====================================
       EVENTS
    ====================================== */

    window.addEventListener(
      "dkju-session-started",
      handleSessionStarted,
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    window.addEventListener(
      "pagehide",
      handlePageHide,
    );


    /* =====================================
       CLEANUP
    ====================================== */

    return () => {
      window.clearInterval(
        interval,
      );


      window.removeEventListener(
        "dkju-session-started",
        handleSessionStarted,
      );


      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );


      window.removeEventListener(
        "pagehide",
        handlePageHide,
      );


      cancelledRef.current =
        true;
    };
  }, [
    updateDuration,
  ]);


  return null;
}