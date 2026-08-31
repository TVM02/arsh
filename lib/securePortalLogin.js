"use client";

import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

export async function securePortalLogin({ portal, identifier, password }) {
  let response;
  try {
    response = await fetch("/api/auth/portal-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portal, identifier, password }),
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    throw new Error("Network timeout: Unable to reach the authentication server. Please try again.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Invalid login credentials or password");
  }

  return {
    ...data,
    user: data.user || null,
    restoreCustomToken: data.token || data.firebaseCustomToken || null,
    restoreEmail: data.restoreEmail || data.userData?.email || data.user?.email || "",
  };
}

export async function restorePortalFirebaseSession(customToken) {
  if (!customToken) return null;
  const credential = await signInWithCustomToken(auth, customToken);
  return {
    uid: credential.user.uid,
    email: credential.user.email,
    displayName: credential.user.displayName,
    photoURL: credential.user.photoURL,
  };
}
