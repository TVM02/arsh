"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, X } from "lucide-react";
import { verifyPortalOtp } from "@/lib/portalAuthSecurity";

const OTP_VALIDITY_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;

export default function PortalOtpVerification({
  challenge,
  onVerified,
  onCancel,
  onResend,
}) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [verified, setVerified] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(OTP_VALIDITY_SECONDS);
  const [isExpired, setIsExpired] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset all timers and input whenever a new challenge arrives (i.e. after resend)
  useEffect(() => {
    if (!mounted) return;
    setTimeRemaining(OTP_VALIDITY_SECONDS);
    setIsExpired(false);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setOtp("");
    setError("");
  }, [challenge?.sessionId, mounted]);

  // OTP expiry countdown (10 min)
  useEffect(() => {
    if (!mounted || isExpired || verified) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [mounted, isExpired, verified, challenge?.sessionId]);

  // Resend cooldown countdown (60 s)
  useEffect(() => {
    if (!mounted || resendCooldown <= 0 || verified || isExpired) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [mounted, resendCooldown, verified, isExpired, challenge?.sessionId]);

  if (!challenge || !mounted || verified) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleResend = async () => {
    if (!onResend || resendCooldown > 0 || resending) return;
    setResending(true);
    setError("");
    try {
      await onResend();
      // Parent updates `challenge` prop → useEffect on sessionId fires and resets state
    } catch (err) {
      setError(err.message || "Failed to resend OTP. Please try again.");
      setResending(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await verifyPortalOtp(challenge, otp);
      setVerified(true);
      await onVerified();
    } catch (err) {
      setVerified(false);
      setError(err.message || "Invalid OTP.");
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }
  };

  if (isExpired) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center overflow-y-auto bg-black/60 px-4 py-6 backdrop-blur-sm">
        <div className="w-full max-w-[420px] space-y-5 rounded-lg bg-white p-5 shadow-2xl ring-1 ring-black/5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-base font-semibold text-red-600">
                <ShieldCheck className="h-5 w-5" />
                OTP Expired
              </div>
              <p className="mt-2 text-sm text-gray-600">
                The OTP has expired. Request a new one to continue.
              </p>
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-2">
            {onResend ? (
              <Button
                type="button"
                disabled={resending}
                onClick={handleResend}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {resending ? "Sending..." : "Resend OTP"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onCancel}
                className="bg-teal-600 hover:bg-teal-700"
              >
                Request New OTP
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onCancel}>
              Back to Login
            </Button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center overflow-y-auto bg-black/60 px-4 py-6 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[420px] space-y-5 rounded-lg bg-white p-5 shadow-2xl ring-1 ring-black/5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-teal-900">
              <ShieldCheck className="h-5 w-5" />
              OTP verification required
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {challenge.provider === "email" ? (
                <>
                  OTP has been sent to your email address:{" "}
                  <span className="font-semibold text-gray-900">
                    {challenge.emailMasked}
                  </span>
                </>
              ) : (
                <>
                  OTP has been sent to the registered number ending with{" "}
                  <span className="font-semibold text-gray-900">
                    {challenge.phoneMasked || "xxxxxx0000"}
                  </span>
                  .
                </>
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close OTP verification"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2">
          <span className="text-xs text-blue-700 font-medium">OTP valid for:</span>
          <span className={`text-sm font-bold ${timeRemaining <= 60 ? "text-red-600" : "text-blue-700"}`}>
            {formatTime(timeRemaining)}
          </span>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="otp">OTP</Label>
          <Input
            id="otp"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            placeholder="Enter 6 digit OTP"
            required
            autoFocus
          />

        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="min-w-0 bg-teal-600 hover:bg-teal-700"
          >
            {loading ? "Verifying..." : "Verify & Continue"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Back
          </Button>
        </div>

        {onResend && (
          <div className="text-center text-sm pt-1">
            {resendCooldown > 0 ? (
              <span className="text-gray-400">
                Resend OTP in {resendCooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || loading}
                className="text-teal-600 hover:text-teal-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending ? "Sending..." : "Didn't receive it? Resend OTP"}
              </button>
            )}
          </div>
        )}
      </form>
    </div>,
    document.body,
  );
}
