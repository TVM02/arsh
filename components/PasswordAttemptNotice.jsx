"use client";

import { useEffect, useState } from "react";
import { MAX_PASSWORD_ATTEMPTS, formatLockTime } from "@/lib/portalAuthSecurity";

export default function PasswordAttemptNotice({ attemptState }) {
  const [, refreshNow] = useState(Date.now());
  const remaining = attemptState?.remaining ?? MAX_PASSWORD_ATTEMPTS;
  const lockedUntil = Number(attemptState?.lockedUntil || 0);
  const locked = Boolean(attemptState?.locked && lockedUntil > Date.now());

  useEffect(() => {
    if (!locked) return undefined;
    const intervalId = window.setInterval(() => refreshNow(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, [locked, lockedUntil]);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {locked
        ? `Login blocked after ${MAX_PASSWORD_ATTEMPTS} wrong password attempts. Try again after ${formatLockTime(lockedUntil)}.`
        : `Password chances remaining: ${remaining}/${MAX_PASSWORD_ATTEMPTS}`}
    </div>
  );
}
