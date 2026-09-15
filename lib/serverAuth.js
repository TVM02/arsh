import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

const ADMIN_ROLES = new Set(["central_admin", "admin"]);

const envList = (name) =>
  String(process.env[name] || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const isConfiguredCentralAdmin = (email) => {
  const normEmail = (email || "").toLowerCase().trim();
  const allowedEmails = [
    
    ...envList("CENTRAL_ADMIN_EMAILS"),
    ...envList("ADMIN_EMAILS"),
    ...envList("SUPER_ADMIN_EMAILS")
  ];
  return allowedEmails.includes(normEmail);
};

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

export async function requireServerRole(request, allowedRoles = ["central_admin"]) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    const error = new Error("Missing authorization token");
    error.status = 401;
    throw error;
  }

  const auth = getAdminAuth();
  const db = getAdminDb();
  const decoded = await auth.verifyIdToken(token, true);
  const allowed = new Set(allowedRoles);

  if (allowed.has(decoded.role)) {
    return { decoded, db, auth, role: decoded.role };
  }

  const userSnap = await db.collection("users").doc(decoded.uid).get();
  const uidUserData = userSnap.exists
    ? { id: userSnap.id, ...userSnap.data() }
    : null;
  const userRole = uidUserData?.role || null;

  if (allowed.has(userRole)) {
    return { decoded, db, auth, role: userRole, userData: uidUserData };
  }

  const emailUserData = await getUserByEmail(db, decoded.email);
  const emailUserRole = emailUserData?.role || null;

  if (allowed.has(emailUserRole)) {
    return { decoded, db, auth, role: emailUserRole, userData: emailUserData };
  }

  if (
    (allowed.has("central_admin") || allowed.has("admin")) &&
    isConfiguredCentralAdmin(decoded.email)
  ) {
    return { decoded, db, auth, role: "central_admin" };
  }

  const error = new Error("Forbidden");
  error.status = 403;
  throw error;
}

export async function requireCentralAdmin(request) {
  return requireServerRole(request, Array.from(ADMIN_ROLES));
}
