"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUserLocation, logLoginDetails } from "@/lib/loggingUtils";
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
import { Users, Eye, EyeOff, Mail } from "lucide-react";
import useAuthStore from "@/lib/authStore";
import Image from "next/image";
import { toast } from "sonner";
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
  prewarmRecaptcha,
  resetLoginFailures,
  withVerifiedOtpSession,
} from "@/lib/portalAuthSecurity";

const PORTAL_KEY = "madarsa-admin";

export default function MahalAdminLogin() {
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

  // Pre-warm the invisible reCAPTCHA silently when the page loads
  useEffect(() => {
    prewarmRecaptcha();
  }, []);

  const startOtpLogin = async ({
    user,
    userData,
    madarsaData,
    loginPhone,
    isNewUser = false,
    restoreCustomToken = null,
  }) => {
    const phone = pickPhone(madarsaData.adminPhone, loginPhone, madarsaData.phone);
    if (!phone) {
      setError(REGISTERED_PHONE_REQUIRED_MESSAGE);
      return;
    }

    const otpPayload = {
      portal: "Sadar Admin Portal",
      role: "madarsa_admin",
      userId: user.uid,
      email: madarsaData.adminEmail,
      name: madarsaData.adminName,
      phone,
      identifier: formData.email,
    };
    const challenge = await requestPortalOtp(otpPayload);
    resetLoginFailures(PORTAL_KEY, formData.email);
    setAttemptState(getLoginAttemptState(PORTAL_KEY, formData.email));
    setPendingLogin({
      user,
      userData,
      adminName: madarsaData.adminName,
      isNewUser,
      restoreCustomToken,
      otpPayload,
    });
    setOtpChallenge(challenge);
    toast.success("OTP sent to registered number.");
  };

  const handleResendOtp = async () => {
    if (!pendingLogin?.otpPayload) return;
    const newChallenge = await requestPortalOtp(pendingLogin.otpPayload);
    setOtpChallenge(newChallenge);
    toast.success("New OTP sent to registered number.");
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
        "madarsa_admin",
        location,
        pendingLogin.adminName,
        pendingLogin.isNewUser,
      ).catch((err) => console.error("Logging failed:", err));
    });

    router.push("/dashboard/madarsa");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const email = formData.email.trim();

    try {
      const currentAttemptState = getLoginAttemptState(PORTAL_KEY, email);
      setAttemptState(currentAttemptState);
      if (currentAttemptState.locked) {
        setError("Too many wrong password attempts. Login is temporarily blocked.");
        return;
      }

      const login = await securePortalLogin({
        portal: PORTAL_KEY,
        identifier: email,
        password: formData.password,
      });

      await startOtpLogin({
        user: login.user,
        userData: login.userData,
        loginPhone: login.phone,
        madarsaData: {
          ...login.userData,
          adminEmail: login.userData.email || login.userData.adminEmail,
          adminName: login.userData.fullName || login.userData.name || login.userData.adminName,
          adminPhone: login.userData.adminPhone || login.phone || login.userData.phone,
        },
        restoreCustomToken: login.restoreCustomToken,
      });
    } catch (error) {
      console.error("Login error:", error);
      if (error.message?.includes("Invalid")) {
        const nextState = recordLoginFailure(PORTAL_KEY, email);
        setAttemptState(nextState);
        setError("Invalid email or password. Please check your credentials.");
      } else {
        setError(error.message || "An error occurred during login. Please try again.");
      }
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
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-orange-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center space-y-4 bg-white/80 p-8 rounded-2xl shadow-xl backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <h2 className="text-xl font-semibold text-teal-800">Redirecting to Dashboard...</h2>
          <p className="text-sm text-teal-600 text-center max-w-xs">Please wait while we securely set up your session and load the dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-indigo-50 to-blue-50 flex items-center flex-col justify-center p-4 relative overflow-hidden">
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
        <div className="w-full h-full bg-gradient-to-r from-teal-100/20 to-blue-100/20"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-t-lg">
            <CardTitle className="text-2xl font-semibold text-center">
              Sadar Admin Login
            </CardTitle>
            <CardDescription className="text-center text-teal-100">
              Enter your credentials to manage your madrasa
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
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="h-12 border-gray-200 focus:border-teal-500 focus:ring-teal-500 bg-gray-50 focus:bg-white transition-all duration-200"
                    placeholder="admin@madarsa.com"
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

                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Home
          </Link>
        </div>
        <div className="flex  bottom-0 w-full items-center text-center mt-8 justify-center  py-4  bg-teal-900">
          <span className="text-sm text-white">
            {"Contact technical Support : 8891177850"}
          </span>
        </div>
      </div>
    </div>
  );
}
