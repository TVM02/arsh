import { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getDocument, getDocumentsByField, COLLECTIONS } from "./firestoreService";

export const ROLES = {
  STUDENT: "student",
  TEACHER: "teacher",
  MAHAL_ADMIN: "madarsa_admin",
  CENTRAL_ADMIN: "central_admin",
  INSPECTOR: "inspector",
  MEKHALA_ADMIN: "mekhala_admin",
  MANAGER: "manager",
};

const isActiveRecord = (record) =>
  record && record.status !== "inactive" && record.isActive !== false;

const getFirstDocumentByField = async (collectionName, fieldName, fieldValue) => {
  if (!fieldValue) return null;

  const documents = await getDocumentsByField(collectionName, fieldName, fieldValue);
  return documents.length > 0 ? documents[0] : null;
};

const getRoleFromClaims = async (user) => {
  try {
    const idTokenResult = await user.getIdTokenResult();
    return idTokenResult.claims.role || null;
  } catch (error) {
    console.error("Error refreshing user token claims:", error);

    try {
      const idTokenResult = await user.getIdTokenResult();
      return idTokenResult.claims.role || null;
    } catch (fallbackError) {
      console.error("Error reading cached user token claims:", fallbackError);
      return null;
    }
  }
};

export const resolveServerRole = async (user) => {
  if (!user) return null;

  const token = await user.getIdToken();
  const response = await fetch("/api/auth/resolve-role", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error || "Unable to verify this account.";
    throw new Error(message);
  }

  return data;
};

export const getFirestoreUserRole = async (user) => {
  if (!user) return null;

  const email = user.email?.trim();

  const userDoc =
    (await getDocument(COLLECTIONS.USERS, user.uid)) ||
    (await getFirstDocumentByField(COLLECTIONS.USERS, "uid", user.uid)) ||
    (await getFirstDocumentByField(COLLECTIONS.USERS, "email", email));

  if (userDoc?.role) {
    return userDoc.role;
  }

  const teacherDoc = await getFirstDocumentByField("teachers", "email", email);
  if (teacherDoc) {
    return ROLES.TEACHER;
  }

  const studentDoc = await getFirstDocumentByField("students", "email", email);
  if (studentDoc) {
    return ROLES.STUDENT;
  }

  const madarsaDoc =
    (await getFirstDocumentByField("madarsas", "firebaseAuthUid", user.uid)) ||
    (await getFirstDocumentByField("madarsas", "adminEmail", email));
  if (madarsaDoc) {
    return ROLES.MAHAL_ADMIN;
  }

  const managerDoc =
    (await getFirstDocumentByField("managers", "firebaseAuthUid", user.uid)) ||
    (await getFirstDocumentByField("managers", "email", email));
  if (managerDoc) {
    return ROLES.MANAGER;
  }

  const parikshaConvenerDoc =
    (await getFirstDocumentByField(
      "pariksha_board_convener",
      "firebaseAuthUid",
      user.uid,
    )) ||
    (await getFirstDocumentByField("pariksha_board_convener", "email", email));
  if (isActiveRecord(parikshaConvenerDoc)) {
    return "pariksha_board_convener";
  }

  return null;
};

export const getUserRole = async (user) => {
  if (!user) return null;

  try {
    try {
      const serverUser = await resolveServerRole(user);
      if (serverUser?.role) return serverUser.role;
    } catch (serverError) {
      console.error("Error resolving server role:", serverError);
      throw serverError;
    }

    // First try to get role from custom claims (for admin-set roles)
    // forceRefresh=true ensures we get the latest custom claims from the server
    // This is critical when claims are set server-side and the client needs to see them
    const claimRole = await getRoleFromClaims(user);
    if (claimRole) {
      return claimRole;
    }

    return await getFirestoreUserRole(user);
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
};

export const checkUserPermission = (userRole, requiredRole) => {
  const roleHierarchy = {
    [ROLES.STUDENT]: 1,
    [ROLES.TEACHER]: 2,
    [ROLES.INSPECTOR]: 3,
    [ROLES.MEKHALA_ADMIN]: 4,
    [ROLES.MAHAL_ADMIN]: 4,
    [ROLES.CENTRAL_ADMIN]: 5,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);

      if (user) {
        try {
          const userRole = await getUserRole(user);
          setUser(user);
          setRole(userRole);
        } catch (error) {
          console.error("Error setting user role:", error);
          setUser(user);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, role, loading };
};
