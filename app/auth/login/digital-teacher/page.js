"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Star,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

import PasswordAttemptNotice from "@/components/PasswordAttemptNotice";
import { connectDigitalGoogleAccount } from "@/lib/digitalGoogleAuth";
import useAuthStore from "@/lib/authStore";

import {
  getLoginAttemptState,
  recordLoginFailure,
  resetLoginFailures,
} from "@/lib/portalAuthSecurity";

import {
  restorePortalFirebaseSession,
  securePortalLogin,
} from "@/lib/securePortalLogin";

import { getUserLocation, logLoginDetails } from "@/lib/loggingUtils";
import { toast } from "sonner";



const PORTAL_KEY = "digital_teacher";


export default function DigitalTeacherLoginPage() {



  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [attemptState, setAttemptState] = useState(
    getLoginAttemptState(PORTAL_KEY, "")
  );

  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showGoogleConnect, setShowGoogleConnect] = useState(false);
const [googleConnecting, setGoogleConnecting] = useState(false);
const [googleConnectError, setGoogleConnectError] = useState("");

  const router = useRouter();

  const {
    setUser,
    setUserData,
  } = useAuthStore();


  // ==========================================
  // FEATURES
  // ==========================================

  const features = [
  {
    icon: BookOpen,
    title: "Manage Classes",
    description: "Access your assigned digital classes",
    bg: "bg-blue-100",
    color: "text-blue-600",
  },
  {
    icon: GraduationCap,
    title: "Manage Students",
    description: "View your assigned students",
    bg: "bg-emerald-100",
    color: "text-emerald-600",
  },
  {
    icon: BarChart3,
    title: "Teaching Activities",
    description: "Manage your classroom activities",
    bg: "bg-cyan-100",
    color: "text-cyan-600",
  },
  {
    icon: Star,
    title: "Digital Teaching",
    description: "Teach and guide students online",
    bg: "bg-teal-100",
    color: "text-teal-600",
  },
];

  // ==========================================
  // LOGIN ATTEMPT STATE
  // ==========================================

  useEffect(() => {
    setAttemptState(
      getLoginAttemptState(
        PORTAL_KEY,
        formData.email
      )
    );
  }, [formData.email]);

const handleConnectGoogle = async () => {
  setGoogleConnectError("");
  setGoogleConnecting(true);

  try {
    const result = await connectDigitalGoogleAccount("teacher");

    const connectedUserData = {
      googleAuth: {
        connected: true,
        email: result.email,
        provider: "google.com",
        ...(result.googleAuth || {}),
      },
    };

    setUserData((prev) => ({
      ...(prev || {}),
      ...connectedUserData,
    }));

    setShowGoogleConnect(false);
    setIsRedirecting(true);

    toast.success("Google account connected successfully.");

    router.push("/dashboard/digital-teacher");
  } catch (error) {
    console.error("Teacher Google connection error:", error);

    setGoogleConnectError(
      error?.message ||
        "Unable to connect your Google account. Please try again."
    );
  } finally {
    setGoogleConnecting(false);
  }
};
  



  const handleChange = (e) => {

    const {
      name,
      value,
    } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };




  const failPasswordAttempt = (message) => {

    const nextState = recordLoginFailure(
      PORTAL_KEY,
      formData.email
    );

    setAttemptState(nextState);

    setError(
      nextState.locked
        ? "Too many wrong password attempts. Login is temporarily blocked."
        : message
    );
  };







  

 
const handleSubmit = async (e) => {
  e.preventDefault();

  setLoading(true);
  setError("");

  const email = formData.email.trim();

  try {
    const currentAttemptState = getLoginAttemptState(
      PORTAL_KEY,
      email
    );

    setAttemptState(currentAttemptState);

    if (currentAttemptState.locked) {
      setError(
        "Too many wrong password attempts. Login is temporarily blocked."
      );
      return;
    }

    const login = await securePortalLogin({
      portal: PORTAL_KEY,
      identifier: email,
      password: formData.password,
    });

    const loginData = login?.userData || {};

    if (loginData.role !== "teacher") {
      throw new Error("This account is not a Teacher account.");
    }

    if (loginData.digitalTeacher !== true) {
      throw new Error(
        "Digital Teacher registration is not approved for this account."
      );
    }

    if (loginData.digitalClassAccess !== true) {
      throw new Error(
        "Digital Classroom access is not enabled for this Teacher."
      );
    }

    if (
      loginData.digitalTeacherStatus &&
      loginData.digitalTeacherStatus !== "active"
    ) {
      throw new Error(
        "Your Digital Teacher account is not active."
      );
    }

    let sessionUser = login.user;

    if (login.restoreCustomToken) {
      sessionUser =
        (await restorePortalFirebaseSession(
          login.restoreCustomToken
        )) || sessionUser;
    }

    setUser(sessionUser);
    setUserData(loginData);

    resetLoginFailures(PORTAL_KEY, email);
    setAttemptState(getLoginAttemptState(PORTAL_KEY, email));

    getUserLocation()
      .then((location) =>
        logLoginDetails(
          sessionUser,
          "teacher",
          location,
          loginData.fullName || loginData.name || "Digital Teacher",
          false
        ).catch((err) => {
          console.error("Logging failed:", err);
        })
      )
      .catch((err) => {
        console.error("Location lookup failed:", err);
      });

    const googleConnected =
      loginData?.googleAuth?.connected === true &&
      !!loginData?.googleAuth?.email;

    if (!googleConnected) {
      setShowGoogleConnect(true);
      return;
    }

    toast.success("Digital Teacher login successful!");

    setIsRedirecting(true);
    router.push("/dashboard/digital-teacher");

  } catch (error) {
    console.error("Login error:", error);

    const message = error?.message || "";

    if (message.toLowerCase().includes("invalid")) {
      failPasswordAttempt(
        "Invalid username or password. Please try again."
      );
    } else {
      setError(
        message ||
          "An error occurred during login. Please try again."
      );
    }
  } finally {
    setLoading(false);
  }
};



  // ==========================================
  // REDIRECTING SCREEN
  // ==========================================

  if (isRedirecting) {

    return (

      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50 p-4">

        <div className="flex flex-col items-center justify-center space-y-4 rounded-3xl border border-teal-100 bg-white/90 p-9 shadow-2xl backdrop-blur-xl">

          <div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />

         <h2 className="text-xl font-bold text-slate-900">
  Redirecting to Digital Teacher Portal...
</h2>

<p className="max-w-xs text-center text-sm leading-6 text-slate-500">
  Please wait while we securely prepare your Digital Teacher session.
</p>

        </div>

      </div>
    );
  }


  // ==========================================
  // PAGE
  // ==========================================

  return (

    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-teal-50">


      {/* ======================================
          BACKGROUND GLOW
      ====================================== */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">

        <div className="absolute -left-40 -top-40 h-[550px] w-[550px] rounded-full bg-blue-100/60 blur-[120px]" />

        <div className="absolute -right-44 top-20 h-[650px] w-[650px] rounded-full bg-teal-100/60 blur-[140px]" />

        <div className="absolute bottom-10 left-1/2 h-[400px] w-[650px] -translate-x-1/2 rounded-full bg-emerald-50/70 blur-[120px]" />

      </div>


      {/* ======================================
          ISLAMIC PATTERN LEFT
      ====================================== */}

      <div className="pointer-events-none absolute -left-20 top-40 h-[450px] w-[450px] opacity-[0.04]">

        <svg
          viewBox="0 0 500 500"
          className="h-full w-full text-blue-700"
        >

          <defs>

            <pattern
              id="loginPatternLeft"
              width="90"
              height="90"
              patternUnits="userSpaceOnUse"
            >

              <path
                d="M45 0 L55 35 L90 45 L55 55 L45 90 L35 55 L0 45 L35 35 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />

              <circle
                cx="45"
                cy="45"
                r="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />

            </pattern>

          </defs>

          <rect
            width="500"
            height="500"
            fill="url(#loginPatternLeft)"
          />

        </svg>

      </div>


      {/* ======================================
          ISLAMIC PATTERN RIGHT
      ====================================== */}

      <div className="pointer-events-none absolute -right-24 top-20 h-[520px] w-[520px] opacity-[0.04]">

        <svg
          viewBox="0 0 500 500"
          className="h-full w-full text-teal-700"
        >

          <defs>

            <pattern
              id="loginPatternRight"
              width="90"
              height="90"
              patternUnits="userSpaceOnUse"
            >

              <path
                d="M45 0 L55 35 L90 45 L55 55 L45 90 L35 55 L0 45 L35 35 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />

              <circle
                cx="45"
                cy="45"
                r="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />

            </pattern>

          </defs>


          <rect
            width="500"
            height="500"
            fill="url(#loginPatternRight)"
          />

        </svg>

      </div>


      {/* ======================================
          HEADER
      ====================================== */}

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-10">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-100">

            <BookOpen className="h-6 w-6 text-white" />

          </div>


          <div>

            <h2 className="text-lg font-bold leading-tight text-slate-900 sm:text-xl">

              Digital{" "}

              <span className="text-teal-600">
                Class Room
              </span>

            </h2>


            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.28em] text-slate-400">

              Learn • Practice • Grow

            </p>

          </div>

        </div>


        <Link
          href="/digital-class"
          className="flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 sm:px-5 sm:py-2.5 sm:text-sm"
        >

          <ArrowLeft className="h-4 w-4" />

          <span className="hidden sm:inline">
            Back to Portal
          </span>

          <span className="sm:hidden">
            Back
          </span>

        </Link>

      </header>


      {/* ======================================
          MAIN CONTENT
      ====================================== */}

      <section className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-5 pb-44 pt-6 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:pt-10">


        {/* ======================================
            LEFT SIDE
        ====================================== */}

        <div className="relative">

          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-blue-500 sm:text-sm">

           Teacher Portal

          </p>


          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">

            Welcome{" "}

            <span className="text-teal-600">
              Back!
            </span>

          </h1>


          <p className="mt-5 max-w-lg text-base leading-7 text-slate-500 sm:text-lg">

            Login with your existing Teacher account and
continue to your Digital Classroom teaching portal.
          </p>


          {/* FEATURES */}

          <div className="mt-10 grid max-w-xl grid-cols-1 gap-6 sm:grid-cols-2">

            {features.map((feature) => {

              const Icon =
                feature.icon;


              return (

                <div
                  key={feature.title}
                  className="flex items-center gap-4"
                >

                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${feature.bg}`}
                  >

                    <Icon
                      className={`h-6 w-6 ${feature.color}`}
                    />

                  </div>


                  <div>

                    <h3 className="text-sm font-bold text-slate-900 sm:text-base">

                      {feature.title}

                    </h3>


                    <p className="mt-1 text-xs text-slate-500 sm:text-sm">

                      {feature.description}

                    </p>

                  </div>

                </div>
              );
            })}

          </div>


          {/* MOTIVATION */}

          <div className="mt-10 hidden max-w-xs rotate-[-4deg] text-center text-2xl font-medium italic leading-relaxed text-blue-300 lg:block">

            Knowledge
            <br />

            Builds
            <br />

            a Better Tomorrow

          </div>

        </div>


        {/* ======================================
            LOGIN CARD
        ====================================== */}

        <div className="mx-auto w-full max-w-lg">

          <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-9">


            {/* ======================================
                IF OTP NOT STARTED
            ====================================== */}

       

              <>

                {/* ICON */}

                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">

                  <GraduationCap className="h-10 w-10 text-blue-600" />

                </div>


                {/* TITLE */}

                <div className="mt-5 text-center">

                  <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
  Digital Teacher{" "}
  <span className="text-teal-600">
    Login
  </span>
</h2>


                  <p className="mt-2 text-sm text-slate-500">

                    Use your existing Teacher email and
  password to access Digital Classroom.

                  </p>

                </div>


                {/* FORM */}

                <form
                  onSubmit={handleSubmit}
                  className="mt-8 space-y-5"
                >


                  {/* ======================================
                      PASSWORD ATTEMPT NOTICE
                  ====================================== */}

                  <PasswordAttemptNotice
                    attemptState={attemptState}
                  />


                  {/* ======================================
                      ERROR ALERT
                  ====================================== */}

                  {error && (

                    <Alert
                      variant="destructive"
                      className="border-red-200 bg-red-50 text-red-800"
                    >

                      <AlertDescription className="flex items-start gap-2 text-sm font-medium">

                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">

                          !

                        </span>


                        <span>
                          {error}
                        </span>

                      </AlertDescription>

                    </Alert>
                  )}


                  {/* ======================================
                      EMAIL / USERNAME
                  ====================================== */}

                  <div>

                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-semibold text-slate-800"
                    >

                      Email / Username

                    </label>


                    <div className="relative">

                      <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />


                      <input
                        id="email"
                        name="email"
                        type="text"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Enter your email or username"
                        autoComplete="username"
                        className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                        required
                      />

                    </div>

                  </div>


                  {/* ======================================
                      PASSWORD
                  ====================================== */}

                  <div>

                    <label
                      htmlFor="password"
                      className="mb-2 block text-sm font-semibold text-slate-800"
                    >

                      Password

                    </label>


                    <div className="relative">

                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />


                      <input
                        id="password"
                        name="password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                        required
                      />


                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (prev) => !prev
                          )
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >

                        {showPassword ? (

                          <EyeOff className="h-5 w-5" />

                        ) : (

                          <Eye className="h-5 w-5" />

                        )}

                      </button>

                    </div>

                  </div>


                  {/* ======================================
                      LOGIN BUTTON
                  ====================================== */}

                  <button
                    type="submit"
                    disabled={loading}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-200 transition-all duration-300 hover:from-teal-600 hover:to-emerald-600 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    {loading ? (

                      <>

                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />


                        <span>

                        Logging in...
                      

                        </span>

                      </>

                    ) : (

                      <>

                        <span>

                          Login

                        </span>


                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />

                      </>

                    )}

                  </button>

                </form>


                {/* ======================================
                    DIVIDER
                ====================================== */}

                <div className="my-7 flex items-center gap-4">

                  <div className="h-px flex-1 bg-slate-200" />

                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">

                    Support

                  </span>

                  <div className="h-px flex-1 bg-slate-200" />

                </div>


                {/* ======================================
                    TECHNICAL SUPPORT
                ====================================== */}

                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-5 text-center">

                  <p className="text-sm text-slate-500">

                    Need Technical Assistance?

                  </p>


                  <a
                    href="tel:8891177850"
                    className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-teal-600 transition hover:text-teal-700 hover:underline"
                  >

                    <Phone className="h-4 w-4" />

                    8891177850

                  </a>

                </div>


                {/* SECURITY */}

                <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400">

                  <ShieldCheck className="h-4 w-4 text-emerald-500" />

                  Secure Digital Classroom Teacher Portal

                </div>

              </>

           
          </div>

        </div>

      </section>


      {/* ======================================
          MOSQUE SILHOUETTE
      ====================================== */}

      <div className="pointer-events-none absolute bottom-[70px] left-0 hidden opacity-[0.07] lg:block">

        <svg
          width="700"
          height="330"
          viewBox="0 0 700 330"
          fill="currentColor"
          className="text-blue-700"
        >

          <rect
            x="210"
            y="210"
            width="260"
            height="120"
          />

          <path d="M220 210 Q340 70 460 210 Z" />

          <circle
            cx="340"
            cy="105"
            r="7"
          />

          <rect
            x="80"
            y="140"
            width="32"
            height="190"
          />

          <path d="M73 140 Q96 95 119 140 Z" />

          <rect
            x="530"
            y="150"
            width="32"
            height="180"
          />

          <path d="M523 150 Q546 105 569 150 Z" />

          <rect
            x="145"
            y="245"
            width="70"
            height="85"
          />

          <path d="M145 245 Q180 195 215 245 Z" />

          <rect
            x="465"
            y="245"
            width="70"
            height="85"
          />

          <path d="M465 245 Q500 195 535 245 Z" />

        </svg>

      </div>


      {/* ======================================
          BOTTOM WAVES
      ====================================== */}

      <div className="pointer-events-none absolute bottom-0 left-0 right-0">

        <svg
          viewBox="0 0 1440 190"
          className="block h-[150px] w-full sm:h-[180px]"
          preserveAspectRatio="none"
        >

          <path
            d="M0,90 C220,180 480,150 700,150 C930,150 1130,20 1440,45 L1440,190 L0,190 Z"
            fill="#ccfbf1"
          />

          <path
            d="M0,115 C260,205 500,175 720,165 C970,155 1180,55 1440,75 L1440,190 L0,190 Z"
            fill="#5eead4"
          />

          <path
            d="M0,135 C270,200 510,190 760,180 C1020,170 1190,80 1440,95 L1440,190 L0,190 Z"
            fill="#0d9488"
          />

        </svg>


        {/* ORGANIZATION */}

        <div className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 sm:block">

          <p className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.3em] text-white/90 md:text-[10px]">

            Dakshina Kerala Islam Matha Vidyabhyasa Board

          </p>

        </div>

      </div>
{showGoogleConnect && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
        <span className="text-2xl font-extrabold text-blue-600">
          G
        </span>
      </div>

      <div className="mt-5 text-center">
        <h2 className="text-2xl font-extrabold text-slate-900">
          Connect Your Google Account
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          Connect your Google account to access DKJU Digital
          Classroom Live Classes securely.
        </p>
      </div>

      {googleConnectError && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {googleConnectError}
        </div>
      )}

      <button
        type="button"
        onClick={handleConnectGoogle}
        disabled={googleConnecting}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {googleConnecting ? (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            Connecting Google Account...
          </>
        ) : (
          <>
            <span className="text-lg font-extrabold text-blue-600">
              G
            </span>
            Continue with Google
          </>
        )}
      </button>

      <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

        <p className="text-xs leading-5 text-slate-500">
          You only need to connect your Google account once.
          Future Digital Teacher logins will use the saved
          connection automatically.
        </p>
      </div>

    </div>
  </div>
)}
    </main>
  );
}