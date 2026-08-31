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
import { Briefcase, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "@/lib/authStore";
import { getUserLocation, logLoginDetails } from "@/lib/loggingUtils";
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

const PORTAL_KEY = "manager";

export default function ManagerLogin() {
  const [formData, setFormData] = useState({ phone: "", password: "" });
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
    setAttemptState(getLoginAttemptState(PORTAL_KEY, formData.phone));
  }, [formData.phone]);

  // Pre-warm the invisible reCAPTCHA silently when the page loads
  useEffect(() => {
    prewarmRecaptcha();
  }, []);


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
    getUserLocation().then((location) => {
      logLoginDetails(
        sessionUser,
        "manager",
        location,
        pendingLogin.userData.name || pendingLogin.userData.fullName,
      ).catch((err) => console.error("Logging failed:", err));
    });
    toast.success("Welcome to the Management Portal!");
    router.push("/dashboard/manager");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const phoneInput = formData.phone.trim();

    try {
      const currentAttemptState = getLoginAttemptState(PORTAL_KEY, phoneInput);
      setAttemptState(currentAttemptState);
      if (currentAttemptState.locked) {
        setError("Too many wrong password attempts. Login is temporarily blocked.");
        return;
      }

      const login = await securePortalLogin({
        portal: PORTAL_KEY,
        identifier: phoneInput,
        password: formData.password,
      });

      const userData = login.userData;
      const phone = pickPhone(login.phone, userData.phone);
      if (!phone) {
        setError(REGISTERED_PHONE_REQUIRED_MESSAGE);
        return;
      }
      const otpPayload = {
        portal: "Manager Portal",
        role: "manager",
        userId: login.user.uid,
        email: userData.email || `${phoneInput}@dkju.in`,
        name: userData.name,
        phone,
        identifier: phoneInput,
      };
      const challenge = await requestPortalOtp(otpPayload);
      resetLoginFailures(PORTAL_KEY, phoneInput);
      setAttemptState(getLoginAttemptState(PORTAL_KEY, phoneInput));
      setPendingLogin({
        user: login.user,
        userData,
        restoreCustomToken: login.restoreCustomToken,
        otpPayload,
      });
      setOtpChallenge(challenge);
      toast.success("OTP sent to registered number.");
    } catch (err) {
      console.error("Manager login error:", err);
      if (err.message?.includes("Invalid")) {
        const nextState = recordLoginFailure(PORTAL_KEY, formData.phone);
        setAttemptState(nextState);
        setError("Invalid phone number or password.");
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
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
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-teal-50 to-cyan-50 flex items-center flex-col justify-center p-4 relative overflow-hidden">
      <div className="flex w-full md:w-fit items-center bg-teal-700 p-2 rounded-lg space-x-3 mb-4 md:fixed top-5 left-5">
        <div className="w-12 h-12 bg-gradient-to-br from-teal-200 to-white rounded-xl flex items-center justify-center shadow-lg">
          <Image src="/logo.png" alt="Logo" width={48} height={48} />
        </div>
        <div>
          <span className="text-xl font-bold text-white">DKJU</span>
          <p className="text-xs text-teal-100">Smart Islamic Education</p>
        </div>
      </div>

      <div className="absolute inset-0 opacity-30">
        <div className="w-full h-full bg-gradient-to-r from-teal-100/20 to-cyan-100/20" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-t-lg">
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-semibold text-center">
              Management Portal
            </CardTitle>
            <CardDescription className="text-center text-teal-100">
              Sign in with your manager credentials
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            {!otpChallenge ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <PasswordAttemptNotice attemptState={attemptState} />

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  required
                  className="border-gray-200 focus:border-teal-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    className="border-gray-200 focus:border-teal-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5"
                disabled={loading}
              >
                {loading ? "Sending OTP..." : "Send OTP"}
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

            <div className="mt-6 text-center text-sm text-gray-500">
              <Link href="/dkju-axis" className="text-teal-600 hover:underline">
                ← Back to Portals
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
