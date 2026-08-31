"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { getUserLocation, logLoginDetails } from "@/lib/loggingUtils";
import useAuthStore from "@/lib/authStore";
import {
  restorePortalFirebaseSession,
  securePortalLogin,
} from "@/lib/securePortalLogin";
import PortalOtpVerification from "@/components/PortalOtpVerification";
import PasswordAttemptNotice from "@/components/PasswordAttemptNotice";
import {
  getLoginAttemptState,
  REGISTERED_PHONE_REQUIRED_MESSAGE,
  pickPhone,
  recordLoginFailure,
  requestPortalOtp,
  resetLoginFailures,
  withVerifiedOtpSession,
  prewarmRecaptcha,
} from "@/lib/portalAuthSecurity";

const PORTAL_KEY = "inspector";

export default function InspectorLogin() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [attemptState, setAttemptState] = useState(
    getLoginAttemptState(PORTAL_KEY, ""),
  );
  const [otpChallenge, setOtpChallenge] = useState(null);
  const [pendingLogin, setPendingLogin] = useState(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();
  const { setUser, setUserData } = useAuthStore();

  useEffect(() => {
    setAttemptState(getLoginAttemptState(PORTAL_KEY, formData.email));
  }, [formData.email]);

  useEffect(() => {
    prewarmRecaptcha();
  }, []);



  const handleResendOtp = async () => {
    if (!pendingLogin) return;
    try {
      if (pendingLogin.emailForResend) {
        const emailResponse = await fetch("/api/auth/email-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send", email: pendingLogin.emailForResend }),
          signal: AbortSignal.timeout(12000),
        });
        const emailData = await emailResponse.json().catch(() => ({}));
        if (!emailResponse.ok || !emailData.success) {
          toast.error("Failed to resend email OTP.");
          return;
        }
        setOtpChallenge((prev) => ({ ...prev, sessionId: emailData.sessionId }));
        toast.success("New OTP sent to your email address.");
      } else if (pendingLogin.otpPayload) {
        const newChallenge = await requestPortalOtp(pendingLogin.otpPayload);
        setOtpChallenge(newChallenge);
        toast.success("New OTP sent to registered number.");
      }
    } catch (error) {
      toast.error("Failed to resend OTP. Please try again.");
    }
  };

  const completeOtpLogin = async () => {
    if (!pendingLogin) return;
    setIsRedirecting(true);
    let sessionUser = pendingLogin.user;
    if (pendingLogin.restoreCustomToken) {
      sessionUser =
        (await restorePortalFirebaseSession(pendingLogin.restoreCustomToken)) ||
        sessionUser;
    }
    setUser(sessionUser);
    setUserData(withVerifiedOtpSession(pendingLogin.userData));
    toast.success("Login successful! Welcome back.");
    getUserLocation().then((location) => {
      logLoginDetails(
        sessionUser,
        "inspector",
        location,
        pendingLogin.userData.name || pendingLogin.userData.fullName,
      ).catch((err) => console.error("Async logging failed:", err));
    });
    setTimeout(() => router.push("/dashboard/inspector"), 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const currentAttemptState = getLoginAttemptState(PORTAL_KEY, formData.email);
      setAttemptState(currentAttemptState);
      if (currentAttemptState.locked) {
        setError("Too many wrong password attempts. Login is temporarily blocked.");
        return;
      }

      const login = await securePortalLogin({
        portal: PORTAL_KEY,
        identifier: formData.email,
        password: formData.password,
      });
      const userDoc = login.userData;
      const inspectorName = userDoc?.name || userDoc?.fullName || "N/A";

      const userEmail = (login.user.email || formData.email).toLowerCase();

      let challenge;
      let pendingExtra = {};

      const phone = pickPhone(login.phone, userDoc?.phone);
      if (!phone) {
        throw new Error(REGISTERED_PHONE_REQUIRED_MESSAGE);
      }
      
      const otpPayload = {
        portal: "Inspector Portal",
        role: "inspector",
        userId: login.user.uid,
        email: login.user.email,
        name: inspectorName,
        phone,
        identifier: formData.email,
      };
      
      challenge = await requestPortalOtp(otpPayload);
      pendingExtra = { otpPayload };

      resetLoginFailures(PORTAL_KEY, formData.email);
      setAttemptState(getLoginAttemptState(PORTAL_KEY, formData.email));
      setPendingLogin({
        user: login.user,
        userData: {
          ...(userDoc || {}),
          uid: login.user.uid,
          email: login.user.email,
          fullName: userDoc?.fullName || userDoc?.name || inspectorName,
          name: inspectorName,
          role: "inspector",
          status: userDoc?.status || "active",
          phone: userDoc?.phone || "",
        },
        restoreCustomToken: login.restoreCustomToken,
        ...pendingExtra,
      });
      setOtpChallenge(challenge);
      toast.success("OTP sent to registered phone number.");
    } catch (error) {
      console.error("Login error:", error);
      if (error.message?.includes("Invalid")) {
        const nextState = recordLoginFailure(PORTAL_KEY, formData.email);
        setAttemptState(nextState);
      }
      setError(error.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center space-y-4 bg-white/80 p-8 rounded-2xl shadow-xl backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <h2 className="text-xl font-semibold text-teal-800">Redirecting to Dashboard...</h2>
          <p className="text-sm text-teal-600 text-center max-w-xs">Please wait while we securely set up your inspection session.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-teal-50 to-cyan-50 flex items-center flex-col justify-center p-4 relative overflow-x-hidden overflow-y-auto">
      <div className="flex w-full md:w-fit items-center bg-teal-700 p-2 rounded-lg space-x-3 mb-4 md:fixed top-5 left-5 ">
        <div className="w-12 h-12 bg-gradient-to-br from-teal-200 to-white rounded-xl flex items-center justify-center shadow-lg">
          <Image src={"/logo.png"} alt="Logo" width={48} height={48} />
        </div>
        <div>
          <span className="text-xl font-bold  text-white">DKJU</span>
          <p className="text-xs text-teal-100">Smart Islamic Education</p>
        </div>
      </div>

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="w-full h-full bg-gradient-to-r from-teal-100/20 to-cyan-100/20"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-t-lg">
            <CardTitle className="text-2xl font-semibold text-center">
              Inspector Login
            </CardTitle>
            <CardDescription className="text-center text-teal-100">
              Enter your inspector credentials to access the dashboard
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            {!otpChallenge ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <PasswordAttemptNotice attemptState={attemptState} />

              {error && (
                <Alert
                  variant="destructive"
                  className="bg-red-50 border-red-200 text-red-800"
                >
                  <AlertDescription className="font-medium">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-semibold text-gray-700"
                >
                  Inspector Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="h-12 border-gray-200 focus:border-teal-500 focus:ring-teal-500 bg-gray-50 focus:bg-white transition-all duration-200"
                  placeholder="inspector@islamportal.com"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-semibold text-gray-700"
                >
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="h-12 pr-12 border-gray-200 focus:border-teal-500 focus:ring-teal-500 bg-gray-50 focus:bg-white transition-all duration-200"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center  transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold text-base shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Sending OTP...</span>
                  </div>
                ) : (
                  "Send OTP"
                )}
              </Button>
            </form>

            ) : (
              <PortalOtpVerification
                challenge={otpChallenge}
                onVerified={completeOtpLogin}
                onResend={handleResendOtp}
                onCancel={() => {
                  setOtpChallenge(null);
                  setPendingLogin(null);
                }}
              />
            )}

            <div className="mt-8 space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Access other portals:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                  <Link
                    href="/auth/login/student"
                    className="inline-flex items-center px-3 py-2 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-800 font-medium transition-colors"
                  >
                    Student Portal
                  </Link>
                  <Link
                    href="/auth/login/teacher"
                    className="inline-flex items-center px-3 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 font-medium transition-colors"
                  >
                    Teacher Portal
                  </Link>
                  <Link
                    href="/auth/login/madarsa-admin"
                    className="inline-flex items-center px-3 py-2 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 font-medium transition-colors"
                  >
                    Sadar Admin
                  </Link>

                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Home
          </Link>
          <div className="flex  bottom-0 w-full items-center text-center mt-8 justify-center  py-4  bg-teal-900">
            <span className="text-sm text-white">
              {"Contact technical Support : 8891177850"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
