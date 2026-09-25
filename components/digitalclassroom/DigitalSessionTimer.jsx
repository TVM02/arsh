"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import useAuthStore from "@/lib/authStore";


/* =========================================================
   SESSION SETTINGS
========================================================= */

const IDLE_TIMEOUT_MS =
  10 * 60 * 1000; // 10 minutes

const WARNING_AT_MS =
  9 * 60 * 1000; // warning after 9 minutes

const WARNING_DURATION_S =
  60; // 1 minute countdown

const ACTIVITY_THROTTLE_MS =
  1000;


/* =========================================================
   ACTIVITY EVENTS
========================================================= */

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
];


/* =========================================================
   SESSION EXPIRED SCREEN
========================================================= */

function DigitalSessionExpiredScreen() {
  return (
    <div
      className="
        fixed
        inset-0
        z-[99999]
        flex
        items-center
        justify-center
        bg-gradient-to-br
        from-slate-50
        via-white
        to-teal-50
      "
    >
      <div
        className="
          mx-4
          w-full
          max-w-md
          rounded-3xl
          border
          border-slate-200
          bg-white
          px-8
          py-10
          text-center
          shadow-2xl
        "
      >
        {/* ICON */}

        <div
          className="
            mx-auto
            mb-5
            flex
            h-20
            w-20
            items-center
            justify-center
            rounded-full
            bg-red-50
            text-red-500
          "
        >
          <svg
            className="h-10 w-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="
                M12 9v2m0 4h.01
                M10.29 3.86
                L1.82 18
                a2 2 0 001.71 3
                h16.94
                a2 2 0 001.71-3
                L13.71 3.86
                a2 2 0 00-3.42 0z
              "
            />
          </svg>
        </div>


        <h2
          className="
            text-2xl
            font-bold
            text-slate-900
          "
        >
          Digital Session Expired
        </h2>


        <p
          className="
            mt-3
            text-sm
            leading-6
            text-slate-500
          "
        >
          Your Digital Classroom session
          expired because there was no activity
          for 10 minutes.
        </p>


        <p
          className="
            mt-1
            text-sm
            text-slate-400
          "
        >
          Please sign in again to continue.
        </p>


        {/* REDIRECT */}

        <div
          className="
            mt-7
            flex
            items-center
            justify-center
            gap-2
            text-sm
            font-semibold
            text-teal-600
          "
        >
          <svg
            className="
              h-4
              w-4
              animate-spin
            "
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />

            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>

          Redirecting to login...
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   DIGITAL SESSION TIMER
========================================================= */

export default function DigitalSessionTimer() {
  const {
    logout,
    user,
    userData,
  } = useAuthStore();


  const [
    showWarning,
    setShowWarning,
  ] = useState(false);


  const [
    showExpired,
    setShowExpired,
  ] = useState(false);


  const [
    countdown,
    setCountdown,
  ] = useState(
    WARNING_DURATION_S,
  );


  /* =====================================================
     REFS
  ===================================================== */

  const idleTimerRef =
    useRef(null);

  const warningTimerRef =
    useRef(null);

  const countdownIntervalRef =
    useRef(null);

  const redirectTimerRef =
    useRef(null);

  const warningShownRef =
    useRef(false);

  const lastActivityRef =
    useRef(0);


  /* =====================================================
     CLEAR TIMERS
  ===================================================== */

  const clearSessionTimers =
    useCallback(() => {
      if (
        warningTimerRef.current
      ) {
        clearTimeout(
          warningTimerRef.current,
        );

        warningTimerRef.current =
          null;
      }

      if (
        idleTimerRef.current
      ) {
        clearTimeout(
          idleTimerRef.current,
        );

        idleTimerRef.current =
          null;
      }

      if (
        countdownIntervalRef.current
      ) {
        clearInterval(
          countdownIntervalRef.current,
        );

        countdownIntervalRef.current =
          null;
      }
    }, []);


  const clearAllTimers =
    useCallback(() => {
      clearSessionTimers();

      if (
        redirectTimerRef.current
      ) {
        clearTimeout(
          redirectTimerRef.current,
        );

        redirectTimerRef.current =
          null;
      }
    }, [
      clearSessionTimers,
    ]);


  /* =====================================================
     GET DIGITAL LOGIN PAGE
  ===================================================== */

  const getDigitalLoginUrl =
    useCallback(() => {
      if (
        typeof window ===
        "undefined"
      ) {
        return "/auth/login";
      }

      const path =
        window.location.pathname;


      /* =====================================
         FIRST USE CURRENT DIGITAL PORTAL
      ====================================== */

      if (
        path.includes(
          "/dashboard/digital-teacher",
        )
      ) {
        return "/auth/login/digital-teacher";
      }


      if (
        path.includes(
          "/dashboard/digital-student",
        )
      ) {
        return "/auth/login/digital-student";
      }


      /* =====================================
         DIGITAL TEACHER ACCOUNT

         Same normal Teacher Firebase account.
      ====================================== */

      const isDigitalTeacher =
        userData?.role ===
          "teacher" &&
        userData?.digitalTeacher ===
          true &&
        userData?.digitalClassAccess ===
          true &&
        (
          !userData?.digitalTeacherStatus ||
          userData?.digitalTeacherStatus ===
            "active"
        );


      if (isDigitalTeacher) {
        return "/auth/login/digital-teacher";
      }


      /* =====================================
         DIGITAL STUDENT
      ====================================== */

      const isDigitalStudent =
        userData?.role ===
          "student" &&
        userData?.userType ===
          "digital_student";


      if (isDigitalStudent) {
        return "/auth/login/digital-student";
      }


      return "/auth/login";
    }, [
      userData,
    ]);


  /* =====================================================
     MANUAL LOGOUT
  ===================================================== */

  const handleLogout =
    useCallback(() => {
      clearAllTimers();

      setShowWarning(false);

      const loginUrl =
        getDigitalLoginUrl();


      if (
        typeof logout ===
        "function"
      ) {
        logout();
      }


      if (
        typeof window !==
        "undefined"
      ) {
        window.location.href =
          loginUrl;
      }
    }, [
      logout,
      clearAllTimers,
      getDigitalLoginUrl,
    ]);


  /* =====================================================
     SESSION EXPIRE
  ===================================================== */

  const handleExpire =
    useCallback(() => {
      clearSessionTimers();

      warningShownRef.current =
        true;

      setShowWarning(false);

      setShowExpired(true);


      const loginUrl =
        getDigitalLoginUrl();


      /* =====================================
         LOGOUT FIREBASE
      ====================================== */

      if (
        typeof logout ===
        "function"
      ) {
        logout();
      }


      /* =====================================
         SHOW EXPIRED SCREEN THEN REDIRECT
      ====================================== */

      redirectTimerRef.current =
        setTimeout(() => {
          if (
            typeof window !==
            "undefined"
          ) {
            window.location.href =
              loginUrl;
          }
        }, 2500);
    }, [
      logout,
      clearSessionTimers,
      getDigitalLoginUrl,
    ]);


  /* =====================================================
     START / RESET SESSION
  ===================================================== */

  const resetTimer =
    useCallback(() => {
      clearSessionTimers();


      warningShownRef.current =
        false;


      setShowWarning(false);

      setCountdown(
        WARNING_DURATION_S,
      );


      /* =====================================
         9 MINUTE WARNING
      ====================================== */

      warningTimerRef.current =
        setTimeout(() => {
          warningShownRef.current =
            true;

          setShowWarning(true);

          setCountdown(
            WARNING_DURATION_S,
          );


          let remaining =
            WARNING_DURATION_S;


          countdownIntervalRef.current =
            setInterval(() => {
              remaining -= 1;


              setCountdown(
                Math.max(
                  remaining,
                  0,
                ),
              );


              if (
                remaining <= 0
              ) {
                if (
                  countdownIntervalRef.current
                ) {
                  clearInterval(
                    countdownIntervalRef.current,
                  );

                  countdownIntervalRef.current =
                    null;
                }
              }
            }, 1000);
        }, WARNING_AT_MS);


      /* =====================================
         10 MINUTE LOGOUT
      ====================================== */

      idleTimerRef.current =
        setTimeout(() => {
          handleExpire();
        }, IDLE_TIMEOUT_MS);
    }, [
      clearSessionTimers,
      handleExpire,
    ]);


  /* =====================================================
     ACTIVITY
  ===================================================== */

  const handleActivity =
    useCallback(() => {
      /*
       * Once warning popup is open,
       * movement/clicks in background do not
       * automatically extend the session.
       *
       * User must click "Stay Logged In".
       */

      if (
        warningShownRef.current
      ) {
        return;
      }


      const now =
        Date.now();


      /*
       * Prevent mousemove from resetting
       * hundreds of timers every second.
       */

      if (
        now -
          lastActivityRef.current <
        ACTIVITY_THROTTLE_MS
      ) {
        return;
      }


      lastActivityRef.current =
        now;


      resetTimer();
    }, [
      resetTimer,
    ]);


  /* =====================================================
     START TIMER
  ===================================================== */

  useEffect(() => {
    /*
     * Don't start an authenticated session
     * timer before Firebase Auth is ready.
     */

    if (!user) {
      return;
    }


    lastActivityRef.current =
      Date.now();


    resetTimer();


    ACTIVITY_EVENTS.forEach(
      (eventName) => {
        window.addEventListener(
          eventName,
          handleActivity,
          {
            passive: true,
          },
        );
      },
    );


    return () => {
      clearAllTimers();


      ACTIVITY_EVENTS.forEach(
        (eventName) => {
          window.removeEventListener(
            eventName,
            handleActivity,
          );
        },
      );
    };
  }, [
    user,
    resetTimer,
    handleActivity,
    clearAllTimers,
  ]);


  /* =====================================================
     EXPIRED
  ===================================================== */

  if (showExpired) {
    return (
      <DigitalSessionExpiredScreen />
    );
  }


  /* =====================================================
     NOTHING TO SHOW
  ===================================================== */

  if (!showWarning) {
    return null;
  }


  /* =====================================================
     WARNING POPUP
  ===================================================== */

  return (
    <div
      className="
        fixed
        inset-0
        z-[99999]
        flex
        items-center
        justify-center
        bg-slate-950/50
        px-4
        backdrop-blur-sm
      "
    >
      <div
        className="
          w-full
          max-w-[410px]
          overflow-hidden
          rounded-3xl
          border
          border-orange-100
          bg-white
          shadow-2xl
        "
      >
        {/* TOP */}

        <div
          className="
            bg-gradient-to-br
            from-orange-50
            via-amber-50
            to-white
            px-7
            pb-6
            pt-8
            text-center
          "
        >
          <div
            className="
              mx-auto
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-full
              bg-orange-100
              text-orange-500
            "
          >
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="
                  M12 9v2m0 4h.01
                  M10.29 3.86
                  L1.82 18
                  a2 2 0 001.71 3
                  h16.94
                  a2 2 0 001.71-3
                  L13.71 3.86
                  a2 2 0 00-3.42 0z
                "
              />
            </svg>
          </div>


          <h2
            className="
              mt-4
              text-xl
              font-bold
              text-slate-900
            "
          >
            Digital Session Expiring
          </h2>


          <p
            className="
              mt-2
              text-sm
              leading-6
              text-slate-500
            "
          >
            You have been inactive for a while.
            Your Digital Classroom session will
            expire in:
          </p>


          {/* COUNTDOWN */}

          <div
            className="
              mt-5
              font-mono
              text-5xl
              font-bold
              tracking-tight
              text-orange-500
            "
          >
            {String(
              Math.floor(
                countdown / 60,
              ),
            ).padStart(
              2,
              "0",
            )}
            :
            {String(
              countdown % 60,
            ).padStart(
              2,
              "0",
            )}
          </div>
        </div>


        {/* BUTTON AREA */}

        <div
          className="
            border-t
            border-slate-100
            px-6
            py-5
          "
        >
          <p
            className="
              mb-4
              text-center
              text-xs
              text-slate-400
            "
          >
            Click Stay Logged In to continue
            your Digital Classroom session.
          </p>


          <div
            className="
              grid
              grid-cols-2
              gap-3
            "
          >
            <button
              type="button"
              onClick={
                handleLogout
              }
              className="
                h-11
                rounded-xl
                border
                border-slate-200
                bg-white
                px-4
                text-sm
                font-semibold
                text-slate-600
                transition
                hover:border-red-200
                hover:bg-red-50
                hover:text-red-600
              "
            >
              Log Out
            </button>


            <button
              type="button"
              onClick={
                resetTimer
              }
              className="
                h-11
                rounded-xl
                bg-gradient-to-r
                from-emerald-500
                to-teal-600
                px-4
                text-sm
                font-semibold
                text-white
                shadow-md
                shadow-teal-100
                transition
                hover:from-emerald-600
                hover:to-teal-700
                hover:shadow-lg
              "
            >
              Stay Logged In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}