export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import {
  SPECIAL_ADMIN_PASSWORDS as SPECIAL_ADMINS,
  ADMIN_HARDCODED_CREDS,
  HOME_PORTAL_CREDS,
} from "@/lib/adminCredentials";

const FIREBASE_AUTH_REST_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";

const PASSWORD_KEYS = new Set([
  "password",
  "adminPassword",
  "confirmPassword",
  "currentPassword",
  "newPassword",
]);

const INTERNAL_KEYS = new Set(["ref"]);

const env = (name) => process.env[name] || process.env[`NEXT_${name}`] || "";
const normalize = (value) => String(value || "").trim();
const normalizeEmail = (value) => normalize(value).toLowerCase();
const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
const cleanStoredText = (value) => {
  const text = normalize(value);
  return ["null", "undefined", "n/a", "na"].includes(text.toLowerCase())
    ? ""
    : text;
};
const pickStoredPhone = (...values) =>
  values.map(cleanStoredText).find((value) => normalizePhone(value)) || "";

const sanitize = (value, seen = new WeakSet()) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitize(item, seen))
      .filter((item) => item !== undefined);
  }

  if (!value || typeof value !== "object") return value;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (seen.has(value)) return undefined;
  seen.add(value);

  const clean = {};
  for (const [key, child] of Object.entries(value)) {
    if (PASSWORD_KEYS.has(key) || INTERNAL_KEYS.has(key)) continue;

    const sanitizedChild = sanitize(child, seen);
    if (sanitizedChild !== undefined) {
      clean[key] = sanitizedChild;
    }
  }

  seen.delete(value);
  return clean;
};

const errorResponse = (message, status = 401) =>
  NextResponse.json({ error: message }, { status });

const envList = (name) =>
  String(process.env[name] || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const isConfiguredCentralAdmin = (email) =>
  [
    "dev@mwus.in",
    "sudarsanan.in@gmail.com",
    "makewithus.in@gmail.com",
    "krrishsinghal42@gmail.com",
    ...envList("CENTRAL_ADMIN_EMAILS"),
    ...envList("ADMIN_EMAILS"),
    ...envList("SUPER_ADMIN_EMAILS"),
  ].includes(normalizeEmail(email));

async function getFirstByField(db, collectionName, fieldName, fieldValue) {
  const value = normalize(fieldValue);
  if (!value) return null;

  const snap = await db
    .collection(collectionName)
    .where(fieldName, "==", value)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function getFirstByFields(db, collectionName, pairs) {
  for (const [fieldName, fieldValue] of pairs) {
    const doc = await getFirstByField(db, collectionName, fieldName, fieldValue);
    if (doc) return doc;
  }
  return null;
}

async function getAllByFields(db, collectionName, pairs) {
  const docs = [];
  const seenIds = new Set();
  
  for (const [fieldName, fieldValue] of pairs) {
    const value = normalize(fieldValue);
    if (!value) continue;
    
    const snap = await db
      .collection(collectionName)
      .where(fieldName, "==", value)
      .get();
      
    if (!snap.empty) {
      snap.docs.forEach(doc => {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          docs.push({ id: doc.id, ...doc.data() });
        }
      });
    }
  }
  return docs;
}

async function getUserDoc(db, uid, email) {
  if (uid) {
    const snap = await db.collection("users").doc(uid).get();
    if (snap.exists) return { id: snap.id, ...snap.data() };
  }
  return getFirstByField(db, "users", "email", email);
}

async function verifyFirebasePassword(email, password) {
  const apiKey = env("FIREBASE_API_KEY");
  if (!apiKey) return { success: false, reason: "server_error" };

  let response, body;
  try {
    response = await fetch(
      `${FIREBASE_AUTH_REST_URL}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    body = await response.json();
  } catch {
    return { success: false, reason: "server_error" };
  }

  if (response.ok && body?.localId) {
    return { success: true, localId: body.localId };
  }

  const msg = String(body?.error?.message || "");
  if (msg.includes("TOO_MANY_ATTEMPTS") || response.status === 429) {
    return { success: false, reason: "too_many_attempts" };
  }
  if (
    msg.includes("INVALID_LOGIN_CREDENTIALS") ||
    msg.includes("INVALID_PASSWORD") ||
    msg.includes("EMAIL_NOT_FOUND") ||
    msg.includes("INVALID_EMAIL")
  ) {
    return { success: false, reason: "invalid_credentials" };
  }
  if (msg.includes("USER_DISABLED")) {
    return { success: false, reason: "user_disabled" };
  }
  return { success: false, reason: "server_error" };
}

async function verifyPassword(email, password, legacyPassword) {
  if (legacyPassword && String(legacyPassword) === String(password || "").trim()) {
    return { verified: true, source: "legacy" };
  }

  if (email) {
    const result = await verifyFirebasePassword(email, password);
    if (result.success) {
      return { verified: true, source: "firebase", uid: result.localId };
    }
    return { verified: false, reason: result.reason };
  }

  return { verified: false, reason: "invalid_credentials" };
}

function credentialError(reason) {
  if (reason === "too_many_attempts") {
    return new Error("Too many login attempts. Please wait a few minutes and try again.");
  }
  if (reason === "server_error") {
    return new Error("Server error while verifying credentials. Please try again.");
  }
  if (reason === "user_disabled") {
    return new Error("This account has been disabled. Please contact the administrator.");
  }
  return new Error("Invalid login credentials or password");
}

async function getAuthUserByEmail(auth, email) {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code === "auth/user-not-found") return null;
    throw error;
  }
}

async function ensureFirebaseSession({
  auth,
  db,
  email,
  password,
  displayName,
  role,
  profile,
  updatePassword,
}) {
  let user = await getAuthUserByEmail(auth, email);

  if (!user) {
    user = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
      disabled: false,
    });
  } else {
    const update = {
      displayName: displayName || user.displayName || email,
      emailVerified: true,
      disabled: false,
    };
    if (updatePassword) update.password = password;
    user = await auth.updateUser(user.uid, update);
  }

  const claimsPromise = auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    role,
  });

  const dbPromise = db
    .collection("users")
    .doc(user.uid)
    .set(
      {
        ...sanitize(profile),
        uid: user.uid,
        email,
        fullName: profile.fullName || profile.name || displayName || email,
        name: profile.name || profile.fullName || displayName || email,
        role,
        status: profile.status || "active",
        profileComplete: profile.profileComplete ?? true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  const tokenPromise = auth.createCustomToken(user.uid, { role });

  const [, , token] = await Promise.all([claimsPromise, dbPromise, tokenPromise]);

  return {
    token,
    user: {
      uid: user.uid,
      email: user.email,
      displayName: displayName || user.displayName || email,
      photoURL: user.photoURL || null,
    },
  };
}

function okPayload({ token = null, user, userData, phone, restoreEmail = "" }) {
  const cleanUserData = sanitize(userData);
  const foundPhone = pickStoredPhone(
    phone,
    cleanUserData.phone,
    cleanUserData.adminPhone,
    cleanUserData.phoneNumber,
    cleanUserData.guardianPhone,
    cleanUserData.contact,
    cleanUserData.contactNumber
  );
  return NextResponse.json({
    firebaseCustomToken: token,
    restoreEmail,
    user,
    userData: cleanUserData,
    phone: normalizePhone(foundPhone),
  });
}

async function authBackedLogin({
  auth,
  db,
  email,
  password,
  role,
  profile,
  displayName,
  legacyPassword,
  phone,
}) {
  const verified = await verifyPassword(email, password, legacyPassword);
  if (!verified.verified) {
    throw credentialError(verified.reason);
  }

  const session = await ensureFirebaseSession({
    auth,
    db,
    email,
    password,
    displayName,
    role,
    profile,
    updatePassword: verified.source === "legacy",
  });

  return okPayload({
    token: session.token,
    user: session.user,
    userData: {
      ...profile,
      uid: session.user.uid,
      email,
      role,
    },
    phone,
    restoreEmail: email,
  });
}

// SPECIAL_ADMINS and ADMIN_HARDCODED_CREDS are imported from lib/adminCredentials.js
// (env-var-first, with the previous hardcoded values kept as fallback — see that
// file for the rotation plan).

async function loginCentralAdminAsConvener({ auth, db, identifier, password }) {
  const email = normalizeEmail(identifier);
  let uid = null;

  // 1. Check SPECIAL_ADMINS
  if (SPECIAL_ADMINS[email] && SPECIAL_ADMINS[email] === String(password || "").trim()) {
    let user;
    try { user = await auth.getUserByEmail(email); }
    catch (e) {
      if (e.code === "auth/user-not-found") {
        user = await auth.createUser({ email, password, emailVerified: true, displayName: "Admin" });
      } else throw e;
    }
    uid = user.uid;
  }
  // 2. Check hardcoded admin creds
  else if (ADMIN_HARDCODED_CREDS[email] && ADMIN_HARDCODED_CREDS[email] === String(password || "").trim()) {
    let user;
    try { user = await auth.getUserByEmail(email); }
    catch (e) {
      if (e.code === "auth/user-not-found") {
        user = await auth.createUser({ email, password, emailVerified: true, displayName: "Admin" });
      } else throw e;
    }
    uid = user.uid;
  }
  // 3. Firebase Auth verification (for central_admin users with Firebase passwords)
  else {
    const authResult = await verifyFirebasePassword(email, password);
    if (!authResult.success) throw credentialError(authResult.reason);
    const user = await auth.getUser(authResult.localId);
    const existingRole = user.customClaims?.role;
    if (existingRole !== "central_admin" && existingRole !== "admin" && !isConfiguredCentralAdmin(email)) {
      throw new Error("Invalid login credentials or password");
    }
    uid = authResult.localId;
  }

  if (!uid) throw new Error("Invalid login credentials or password");

  const userDoc = await getUserDoc(db, uid, email);
  const phone   = pickStoredPhone(userDoc?.phone, userDoc?.adminPhone);

  const profileData = {
    ...(userDoc || {}),
    uid,
    email,
    role: "convener_admin",
    name: "State Portal Admin",
    fullName: "State Portal Admin",
    districts: [],
    status: "active",
  };

  await Promise.all([
    auth.setCustomUserClaims(uid, { role: "convener_admin" }),
    db.collection("users").doc(uid).set(profileData, { merge: true })
  ]);

  const token = await auth.createCustomToken(uid, { role: "convener_admin" });

  return okPayload({
    token,
    user: {
      uid,
      email,
      displayName: "State Portal Admin",
      photoURL: null,
    },
    userData: profileData,
    phone,
    restoreEmail: email,
  });
}

async function loginHomePortal({ auth, db, identifier, password }) {
  const email = normalizeEmail(identifier);
  
  const devPasswordAllowed = process.env.NODE_ENV === "development" && password === "123456";

  // Sourced from lib/adminCredentials.js (env-var-first, hardcoded fallback).
  const validCreds = HOME_PORTAL_CREDS;

  const isPasswordValid = validCreds[email] === String(password || "").trim() || devPasswordAllowed;

  if (!isPasswordValid) {
    throw new Error("Invalid login credentials or password");
  }

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (e) {
    if (e.code === "auth/user-not-found") {
      user = await auth.createUser({
        email,
        password: validCreds[email] || "defaultPass123",
        emailVerified: true,
        displayName: "Home Portal Admin",
      });
    } else {
      throw e;
    }
  }

  const userDoc = await getUserDoc(db, user.uid, email);

  let assignedPhone = userDoc?.phone || "6238719566";
  if (email === "dev@mwus.in") assignedPhone = "+918265940243";

  const profile = {
    ...(userDoc || {}),
    uid: user.uid,
    email,
    role: "home_admin",
    fullName: userDoc?.fullName || "Home Portal Admin",
    name: userDoc?.name || "Home Portal Admin",
    status: userDoc?.status || "active",
    phone: assignedPhone,
    profileComplete: true,
    updatedAt: FieldValue.serverTimestamp(),
  };

  const [token] = await Promise.all([
    auth.createCustomToken(user.uid, { role: "home_admin" }),
    auth.setCustomUserClaims(user.uid, { ...(user?.customClaims || {}), role: "home_admin" }),
    db.collection("users").doc(user.uid).set(profile, { merge: true })
  ]);
  return okPayload({
    token,
    user: {
      uid: user.uid,
      email,
      displayName: profile.fullName,
      photoURL: null,
    },
    userData: profile,
    phone: profile.phone,
    restoreEmail: email,
  });
}

async function loginCentralAdmin({ auth, db, identifier, password }) {
  const email = normalizeEmail(identifier);
  
  if ((SPECIAL_ADMINS[email] && SPECIAL_ADMINS[email] === String(password || "").trim()) || 
      (ADMIN_HARDCODED_CREDS[email] && ADMIN_HARDCODED_CREDS[email] === String(password || "").trim())) {
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch (e) {
      if (e.code === "auth/user-not-found") {
        user = await auth.createUser({
          email,
          password: password,
          emailVerified: true,
          displayName: "Special Admin",
        });
      } else {
        throw e;
      }
    }
    
    const userDoc = await getUserDoc(db, user.uid, email);
    const profile = {
      ...(userDoc || {}),
      uid: user.uid,
      email,
      role: "central_admin",
      fullName: userDoc?.fullName || userDoc?.name || user.displayName || "Special Admin",
      name: userDoc?.name || userDoc?.fullName || user.displayName || "Special Admin",
      status: userDoc?.status || "active",
      profileComplete: true,
      phone: userDoc?.phone || userDoc?.adminPhone || "6238719566"
    };
    
    const [token] = await Promise.all([
      auth.createCustomToken(user.uid, { role: "central_admin" }),
      auth.setCustomUserClaims(user.uid, { ...(user?.customClaims || {}), role: "central_admin" }),
      db.collection("users").doc(user.uid).set(profile, { merge: true })
    ]);
    return okPayload({
      token,
      user: {
        uid: user.uid,
        email,
        displayName: profile.fullName,
        photoURL: null,
      },
      userData: profile,
      phone: profile.phone,
      restoreEmail: email,
    });
  }

  const authResult = await verifyFirebasePassword(email, password);
  if (!authResult.success) {
    throw credentialError(authResult.reason);
  }

  const user = await auth.getUser(authResult.localId);
  const userDoc = await getUserDoc(db, user.uid, email);
  
  const hasCentralAccess = 
    userDoc?.role === "central_admin" || 
    userDoc?.role === "admin" ||
    user.customClaims?.role === "central_admin" || 
    user.customClaims?.role === "admin" || 
    isConfiguredCentralAdmin(email);

  if (!hasCentralAccess) {
    throw new Error("Invalid credentials. Please use the correct login portal for your role.");
  }

  const profile = {
    ...(userDoc || {}),
    uid: user.uid,
    email,
    role: "central_admin",
    fullName: userDoc?.fullName || userDoc?.name || user.displayName || email,
    name: userDoc?.name || userDoc?.fullName || user.displayName || email,
    status: userDoc?.status || "active",
    profileComplete: true,
  };

  const [token] = await Promise.all([
    auth.createCustomToken(user.uid, { role: "central_admin" }),
    auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), role: "central_admin" })
  ]);
  return okPayload({
    token,
    user: {
      uid: user.uid,
      email,
      displayName: profile.fullName,
      photoURL: user.photoURL || null,
    },
    userData: profile,
    phone: profile.phone || userDoc?.adminPhone || "",
    restoreEmail: email,
  });
}

async function loginInspector({ auth, db, identifier, password }) {
  const email = normalizeEmail(identifier);
  
  let profile = null;
  const snap1 = await db.collection("users")
    .where("email", "==", email)
    .where("role", "==", "inspector")
    .limit(1)
    .get();
    
  if (!snap1.empty) {
    profile = { id: snap1.docs[0].id, ...snap1.docs[0].data() };
  } else {
    const snap2 = await db.collection("users")
      .where("loginId", "==", identifier)
      .where("role", "==", "inspector")
      .limit(1)
      .get();
    if (!snap2.empty) {
      profile = { id: snap2.docs[0].id, ...snap2.docs[0].data() };
    }
  }

  if (!profile || profile.role !== "inspector") {
    throw new Error("Invalid login credentials or password");
  }

  return authBackedLogin({
    auth,
    db,
    email: profile.email || email,
    password,
    role: "inspector",
    profile,
    displayName: profile.fullName || profile.name,
    legacyPassword: profile.password,
    phone: profile.phone,
  });
}

async function loginManager({ auth, db, identifier, password }) {
  const phone = normalizePhone(identifier);
  const mid = normalize(identifier).toUpperCase();

  let profile = null;

  if (phone) {
    profile = await getFirstByField(db, "managers", "phone", phone);
  }

  // Fallback to searching by madarsaId
  if (!profile && mid) {
    profile = await getFirstByField(db, "managers", "madarsaId", mid);
    
    // Try padded MID format
    if (!profile && mid.startsWith("MID")) {
      const parts = mid.match(/(?:mid|MID)-?(\d+)/i);
      if (parts && parts[1]) {
        profile = await getFirstByField(db, "managers", "madarsaId", `MID-${parts[1].padStart(3, "0")}`);
      }
    }
  }

  if (!profile) throw new Error("Invalid login credentials or password");

  const email = profile.email || (profile.phone ? `${profile.phone}@dkju.in` : `${profile.madarsaId.toLowerCase().replace(/[^a-z0-9]/g, "")}@dkju.in`);

  return authBackedLogin({
    auth,
    db,
    email,
    password,
    role: "manager",
    profile: {
      ...profile,
      fullName: profile.name,
      profileComplete: true,
    },
    displayName: profile.name,
    legacyPassword: profile.password,
    phone: profile.phone,
  });
}

async function loginStudent({ auth, db, identifier, password }) {
  const email = normalizeEmail(identifier);
  const credential = String(identifier || "").trim();
  const idPrefix = credential.split("@")[0].toUpperCase();
  const profile = await getFirstByFields(db, "students", [
    ["email", email],
    ["email", credential],
    ["admissionNumber", credential],
    ["studentId", credential],
    ["admissionNumber", idPrefix],
    ["studentId", idPrefix]
  ]);
  if (!profile) throw new Error("No student account found with this email address or ID.");
  if (String(profile.status || "active").toLowerCase() !== "active") {
    throw new Error("Your account is not active. Please contact the administrator.");
  }

  return authBackedLogin({
    auth,
    db,
    email: profile.email || email,
    password,
    role: "student",
    profile: {
      ...profile,
      fullName: profile.fullName || profile.name,
      role: profile.role || "student",
    },
    displayName: profile.fullName || profile.name,
    legacyPassword: profile.password,
    phone: profile.phone || profile.guardianPhone,
  });
}

async function loginTeacher({ auth, db, identifier, password }) {
  const credential = normalize(identifier);
  const email = normalizeEmail(credential);
  const idPrefix = credential.split("@")[0].toUpperCase();
  const profiles = await getAllByFields(db, "teachers", [
    ["email", email],
    ["mhrId", credential],
    ["teacherId", credential],
    ["mhrId", idPrefix],
    ["teacherId", idPrefix]
  ]);
  
  if (profiles.length === 0) throw new Error("No teacher account found with this Email / ID.");

  let profile = null;
  let firebaseVerificationError = null;

  // First try to match legacy password directly
  for (const p of profiles) {
    if (String(p.status || "active").toLowerCase() !== "active") continue;
    if (p.password && String(p.password) === String(password || "").trim()) {
      profile = p;
      break;
    }
  }

  // If no match found using legacy password, we check Firebase Auth
  if (!profile) {
    for (const p of profiles) {
      if (String(p.status || "active").toLowerCase() !== "active") continue;
      
      const verified = await verifyPassword(p.email || email, password, p.password);
      if (verified.verified) {
        profile = p;
        break; // Match found
      } else {
        firebaseVerificationError = verified.reason;
      }
    }
  }

  if (!profile) {
    if (firebaseVerificationError) throw credentialError(firebaseVerificationError);
    
    // Check if there are only inactive accounts
    const hasInactive = profiles.some(p => String(p.status || "active").toLowerCase() !== "active");
    if (hasInactive && profiles.length === 1) {
      throw new Error("Your account is not active. Please contact the administrator.");
    }
    
    throw new Error("Invalid login credentials or password");
  }

  return authBackedLogin({
    auth,
    db,
    email: profile.email,
    password,
    role: "teacher",
    profile: {
      ...profile,
      fullName: profile.fullName || profile.name,
      teacherId: profile.mhrId || profile.teacherId || null,
      profileComplete: profile.profileComplete ?? true,
    },
    displayName: profile.fullName || profile.name,
    legacyPassword: profile.password,
    phone: profile.phone,
  });
}

async function loginMadarsaAdmin({ auth, db, identifier, password }) {
  const email = normalizeEmail(identifier);
  const profile = await getFirstByField(db, "madarsas", "adminEmail", email);
  if (!profile) throw new Error("Invalid email or password");
  const phone = pickStoredPhone(profile.adminPhone, profile.phone);

  return authBackedLogin({
    auth,
    db,
    email: profile.adminEmail || email,
    password,
    role: "madarsa_admin",
    profile: {
      ...profile,
      email: profile.adminEmail || email,
      fullName: profile.adminName,
      name: profile.adminName,
      madarsaId: profile.madarsaId || profile.id,
      madarsaName: profile.name,
      madarsaAddress: profile.address,
      phone,
      profileComplete: true,
    },
    displayName: profile.adminName,
    legacyPassword: profile.adminPassword || profile.password,
    phone,
  });
}

async function loginParikshaConvener({ auth, db, identifier, password }) {
  const credential = normalizeEmail(identifier);
  const profile = await getFirstByFields(db, "pariksha_board_convener", [
    ["email", credential],
    ["loginId", identifier],
  ]);
  if (!profile || profile.isActive === false) {
    throw new Error("Invalid email or password");
  }

  return authBackedLogin({
    auth,
    db,
    email: profile.email || credential,
    password,
    role: "pariksha_board_convener",
    profile: {
      ...profile,
      fullName: profile.name,
      profileComplete: true,
    },
    displayName: profile.name,
    legacyPassword: profile.password,
    phone: profile.phone,
  });
}

async function customPortalLogin({ auth, db, collectionName, pairs, password, role, type, portalType }) {
  const profile = await getFirstByFields(db, collectionName, pairs);
  if (!profile || String(profile.password || "") !== String(password || "").trim()) {
    throw new Error("Invalid login credentials or password");
  }

  const userData = {
    ...profile,
    uid: profile.id,
    role,
    mekhalaDocType: type || profile.mekhalaDocType || null,
    portalType: portalType || profile.portalType || null,
    status: profile.status || "active",
  };

  return okPayload({
    token: await auth.createCustomToken(profile.id, { role }),
    user: {
      uid: profile.id,
      email: profile.email || "",
      displayName: profile.name || profile.fullName || "",
      role,
    },
    userData,
    phone: pickStoredPhone(profile.adminPhone, profile.phone),
  });
}
async function loginDigitalStudent({
  auth,
  db,
  identifier,
  password,
}) {
  const credential = normalize(identifier);
  const email = normalizeEmail(identifier);

  // Allow login by:
  // 1. Email
  // 2. Digital Admission Number
  const profile = await getFirstByFields(
    db,
    "digitalClassStudentRegistrations",
    [
      ["studentEmail", email],
      ["email", email],
     
    ]
  );

  if (!profile) {
    throw new Error(
      "No Digital Classroom student account found."
    );
  }

  // ------------------------------------
  // Registration approval check
  // ------------------------------------

  if (
    String(profile.status || "")
      .toLowerCase() !== "approved"
  ) {
    throw new Error(
      "Your Digital Classroom registration is not approved yet."
    );
  }

  // ------------------------------------
  // Account status check
  // ------------------------------------

  const accountStatus =
    String(
      profile.accountStatus || "active"
    ).toLowerCase();

  if (accountStatus === "inactive") {
    throw new Error(
      "Your Digital Classroom account is inactive. Please contact the administrator."
    );
  }

  if (accountStatus === "suspended") {
    throw new Error(
      "Your Digital Classroom account has been suspended. Please contact the administrator."
    );
  }

  if (accountStatus !== "active") {
    throw new Error(
      "Your Digital Classroom account is not active."
    );
  }

  // ------------------------------------
  // Digital access check
  // ------------------------------------

  if (profile.digitalClassAccess !== true) {
    throw new Error(
      "Digital Classroom access is disabled."
    );
  }

  // ------------------------------------
  // Determine login email
  // ------------------------------------

  const loginEmail =
    profile.studentEmail ||
    profile.email ||
    email;

  if (!loginEmail) {
    throw new Error(
      "No login email is configured for this Digital Classroom account."
    );
  }

  // ------------------------------------
  // Verify password
  // ------------------------------------

  const verified =
    await verifyPassword(
      loginEmail,
      password,
      profile.password
    );

  if (!verified.verified) {
    throw credentialError(
      verified.reason
    );
  }

  // ------------------------------------
  // Ensure Firebase Auth session
  // ------------------------------------

  const session =
    await ensureFirebaseSession({
      auth,
      db,

      email: loginEmail,

      password,

      displayName:
        profile.fullName ||
        profile.studentName ||
        "Digital Student",

      role: "student",

      profile: {
        ...profile,

        uid:
          profile.uid || undefined,

        email:
          loginEmail,

        studentEmail:
          loginEmail,

        fullName:
          profile.fullName ||
          profile.studentName ||
          "Digital Student",

        role:
          "student",

        userType:
          "digital_student",

        profileComplete:
          true,
      },

      updatePassword:
        verified.source === "legacy",
    });

  // ------------------------------------
  // Keep UID in Digital registration
  // ------------------------------------

  if (
    !profile.uid ||
    profile.uid !== session.user.uid
  ) {
   await db
  .collection("users")
  .doc(session.user.uid)
  .set(
    {
      uid: session.user.uid,

      email: loginEmail,

      fullName:
        profile.fullName ||
        profile.studentName ||
        "Digital Student",

      role: "student",

      // VERY IMPORTANT
      userType: "digital_student",

      digitalAdmissionNumber:
        profile.digitalAdmissionNumber ||
        null,

      accountStatus:
        profile.accountStatus ||
        "active",

      digitalClassAccess: true,

      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    }
  );
  }

  // ------------------------------------
  // Return login payload
  // ------------------------------------

  return okPayload({
  token: session.token,

  user: session.user,

  userData: {
    ...profile,

    id: profile.id,

    uid: session.user.uid,

    email: loginEmail,

    studentEmail: loginEmail,

    role: "student",

    // IMPORTANT
    userType: "digital_student",

    status: profile.status,

    accountStatus:
      profile.accountStatus ||
      "active",

    paymentStatus:
      profile.paymentStatus ||
      "pending",

    digitalClassAccess: true,

    digitalAdmissionNumber:
      profile.digitalAdmissionNumber ||
      null,
  },

  phone:
    profile.phone ||
    profile.guardianPhone,

  restoreEmail: loginEmail,
});
}

export async function POST(req) {
  try {
    const { portal, identifier, password } = await req.json();
    const normalizedPortal = normalize(portal);
    const trimmedIdentifier = normalize(identifier);
    const trimmedPassword = String(password || "");

    if (!normalizedPortal || !trimmedIdentifier || !trimmedPassword) {
      return errorResponse("Missing login credentials", 400);
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    switch (normalizedPortal) {
      case "central-admin":
      case "admin":
        return await loginCentralAdmin({
          auth,
          db,
          identifier: trimmedIdentifier,
          password: trimmedPassword,
        });

      case "home-control":
        return await loginHomePortal({
          auth,
          db,
          identifier: trimmedIdentifier,
          password: trimmedPassword,
        });

      case "inspector":
        return await loginInspector({
          auth,
          db,
          identifier: trimmedIdentifier,
          password: trimmedPassword,
        });

      case "manager":
        return await loginManager({
          auth,
          db,
          identifier: trimmedIdentifier,
          password: trimmedPassword,
        });

      case "student":
        return await loginStudent({
          auth,
          db,
          identifier: trimmedIdentifier,
          password: trimmedPassword,
        });
case "digital-student":
case "digital_student":
  return await loginDigitalStudent({
    auth,
    db,
    identifier: trimmedIdentifier,
    password: trimmedPassword,
  });
      case "teacher":
        return await loginTeacher({
          auth,
          db,
          identifier: trimmedIdentifier,
          password: trimmedPassword,
        });

      case "madarsa-admin":
        return await loginMadarsaAdmin({
          auth,
          db,
          identifier: trimmedIdentifier,
          password: trimmedPassword,
        });

      case "pariksha-board-convener":
        return await loginParikshaConvener({
          auth,
          db,
          identifier: trimmedIdentifier,
          password: trimmedPassword,
        });

      case "convener": {
        try {
          return await customPortalLogin({
            auth,
            db,
            collectionName: "conveners",
            pairs: [
              ["loginId", trimmedIdentifier],
              ["email", trimmedIdentifier],
            ],
            password: trimmedPassword,
            role: "convener_admin",
          });
        } catch (_convenerErr) {
          try {
            return await customPortalLogin({
              auth,
              db,
              collectionName: "pariksha_board_convener",
              pairs: [
                ["loginId", trimmedIdentifier],
                ["email", trimmedIdentifier],
              ],
              password: trimmedPassword,
              role: "convener_admin",
            });
          } catch (_pbErr) {
            // Fall back: central admin credentials → issue a convener_admin session
            // so the user lands on the state portal dashboard, not the admin dashboard
            return await loginCentralAdminAsConvener({
              auth,
              db,
              identifier: trimmedIdentifier,
              password: trimmedPassword,
            });
          }
        }
      }

      case "mekhala":
        return await customPortalLogin({
          auth,
          db,
          collectionName: "mekhala",
          pairs: [
            ["loginId", trimmedIdentifier],
            ["email", trimmedIdentifier],
            ["phone", trimmedIdentifier],
          ],
          password: trimmedPassword,
          role: "mekhala_admin",
          type: "district",
          portalType: "district_portal",
        });

      case "mekhala-admin":
        return await customPortalLogin({
          auth,
          db,
          collectionName: "districts",
          pairs: [
            ["loginId", trimmedIdentifier],
            ["phone", trimmedIdentifier],
            ["email", trimmedIdentifier],
          ],
          password: trimmedPassword,
          role: "mekhala_admin",
          type: "sub_mekhala",
          portalType: "mekhala_portal",
        });

      default:
        return errorResponse("Unknown login portal", 400);
    }
  } catch (error) {
    console.error("[auth/portal-login] error:", error);
    return errorResponse(error.message || "Invalid login credentials or password");
  }
}
