export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

const CENTRAL_ADMIN_ROLES = new Set(["central_admin", "admin"]);

const envList = (name) =>
  String(process.env[name] || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const isConfiguredCentralAdmin = (email) => {
  const normEmail = (email || "").toLowerCase().trim();
  const allowedEmails = [
    "dev@mwus.in",
    "sudarsanan.in@gmail.com",
    "makewithus.in@gmail.com",
    "krrishsinghal42@gmail.com",
    ...envList("CENTRAL_ADMIN_EMAILS"),
    ...envList("ADMIN_EMAILS"),
    ...envList("SUPER_ADMIN_EMAILS")
  ];
  return allowedEmails.includes(normEmail);
};

const publicUser = (decoded, userData, role) => ({
  uid: decoded.uid,
  email: decoded.email || userData?.email || null,
  displayName: decoded.name || userData?.fullName || userData?.name || null,
  role,
  userData: userData
    ? {
        id: userData.id || null,
        uid: userData.uid || decoded.uid,
        email: userData.email || decoded.email || null,
        fullName: userData.fullName || userData.name || decoded.name || null,
        name: userData.name || userData.fullName || decoded.name || null,
        role,
        status: userData.status || "active",
        profileComplete: userData.profileComplete ?? true,
        madarsaId: userData.madarsaId || null,
        madarsaName: userData.madarsaName || null,
        madarsaAddress: userData.madarsaAddress || null,
        teacherId: userData.teacherId || null,
        studentId: userData.studentId || null,
        classLevel: userData.classLevel || userData.class || userData.std || null,
        class: userData.class || userData.classLevel || userData.std || null,
        admissionNumber: userData.admissionNumber || null,
        assignedMadarsas: userData.assignedMadarsas || [],
        assignedDistricts: userData.assignedDistricts || [],
        assignedDistrict: userData.assignedDistrict || null,
        allowedTime: userData.allowedTime || 3600,
        phone: userData.phone || null,
      }
    : {
        uid: decoded.uid,
        email: decoded.email || null,
        fullName: decoded.name || decoded.email || "Authenticated User",
        name: decoded.name || decoded.email || "Authenticated User",
        role,
        status: "active",
        profileComplete: true,
      },
});

const getUserByEmail = async (db, email) => {
  const normalized = String(email || "").trim();
  if (!normalized) return null;

  const snap = await db
    .collection("users")
    .where("email", "==", normalized)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
};

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const auth = getAdminAuth();
    const db = getAdminDb();
    const decoded = await auth.verifyIdToken(token);
    const claimsRole = decoded.role || null;
    const email = decoded.email || "";

    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const userData = userSnap.exists
      ? { id: userSnap.id, ...userSnap.data() }
      : await getUserByEmail(db, email);

    let role = claimsRole || userData?.role || null;
    if (!role && isConfiguredCentralAdmin(email)) {
      role = "central_admin";
    }

    if (CENTRAL_ADMIN_ROLES.has(role)) {
      const isAllowed =
        CENTRAL_ADMIN_ROLES.has(claimsRole) ||
        isConfiguredCentralAdmin(email);

      if (!isAllowed) {
        return NextResponse.json(
          { error: "Central admin access requires a server-side allowlist or custom claim." },
          { status: 403 },
        );
      }

      role = "central_admin";
    }

    return NextResponse.json(publicUser(decoded, userData, role));
  } catch (error) {
    console.error("[auth/resolve-role] error:", error);
    return NextResponse.json(
      { error: "Unable to resolve authenticated role" },
      { status: 401 },
    );
  }
}
