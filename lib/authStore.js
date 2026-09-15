import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { getDocument, getDocumentsByField } from "./firestoreService";

const CUSTOM_PORTAL_ROLES = ["convener_admin", "mekhala_admin"];
const CUSTOM_PORTAL_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const OTP_SESSION_MAX_AGE_MS = 10 * 60 * 1000; // OTP is only the login challenge window.

const cleanAuthField = (value) => {
  const text = String(value ?? "").trim();
  if (!text || ["null", "undefined", "n/a", "na"].includes(text.toLowerCase())) {
    return "";
  }
  return text;
};

const pickAuthPhone = (...values) =>
  values.map(cleanAuthField).find((value) => value) || "";

const hasFreshOtpSession = (userData) => {
  const otpVerifiedAt = Number(userData?.otpVerifiedAt || 0);
  return otpVerifiedAt > 0 && Date.now() - otpVerifiedAt < OTP_SESSION_MAX_AGE_MS;
};

const hasLiveCustomPortalSession = (userData) => {
  const issuedAt = Number(userData?.authSessionIssuedAt || 0);
  return (
    !!userData &&
    CUSTOM_PORTAL_ROLES.includes(userData.role) &&
    issuedAt > 0 &&
    Date.now() - issuedAt < CUSTOM_PORTAL_SESSION_MAX_AGE_MS
  );
};

const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null, // Firebase auth user
      userData: null, // User document from Firestore
      loading: true,
      initialized: false,
      _hasHydrated: false,

      // Actions
      setUser: (user) => set({ user }),
      setUserData: (userData) =>
        set({
          userData: userData
            ? {
                ...userData,
                authSessionIssuedAt:
                  userData.authSessionIssuedAt || Date.now(),
              }
            : null,
        }),
      setLoading: (loading) => set({ loading }),
      setInitialized: (initialized) => set({ initialized }),
      setHasHydrated: (val) => set({ _hasHydrated: val }),

      // Initialize auth listener
      initializeAuth: () => {
        const state = get();

        // Custom-portal roles (convener, mekhala) use Firestore auth —
        // Firebase Auth is irrelevant for them. Skip the entire Firebase listener
        // to avoid the 10s wait and never clear their persisted session.
        const CUSTOM_AUTH_ROLES = CUSTOM_PORTAL_ROLES;
        if (
          state.userData?.role &&
          CUSTOM_AUTH_ROLES.includes(state.userData.role)
        ) {
          set({ loading: false });
          return null;
        }

        // Check if we have a mismatch between Firebase and store state
        const firebaseUser = auth.currentUser;
        const hasMismatch = firebaseUser && !state.user;

        if (state.initialized && !hasMismatch) {
          // console.log('Auth already initialized, skipping...');
          return null;
        }

        if (hasMismatch) {
          set({ initialized: false });
        }

        // console.log('�🚀 Initializing auth listener...', {
        //   authInstance: !!auth,
        //   currentUser: auth.currentUser ? auth.currentUser.email : 'null',
        //   appReady: !!auth.app,
        //   hasMismatch
        // });

        // Check if Firebase is properly configured
        if (!auth || !auth.app) {
          console.error("❌ Firebase auth not properly initialized");
          set({ loading: false, initialized: false });
          return null;
        }

        set({ initialized: true });

        // Safety timeout — if Firebase never responds (offline/cold start), unblock the UI
        const authTimeoutId = setTimeout(() => {
          if (get().loading) {
            console.warn("Auth init timeout after 2s — forcing loading:false");
            set({ loading: false });
          }
        }, 2000);

        // If there's already a Firebase user but no store user, process it immediately
        if (auth.currentUser && !state.user) {
          setTimeout(() => {
            // Trigger the auth state change manually
            const currentUser = auth.currentUser;
            if (currentUser) {
              // console.log('⚡ Manually triggering auth state processing for:', currentUser.email);
              // We'll process this in the onAuthStateChanged callback below
            }
          }, 100);
        }

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          const cachedUserData = get().userData;
          const cachedUser = get().user;

          // Custom portal user: Firebase has no user → just unblock UI, keep session.
          if (
            !firebaseUser &&
            cachedUserData?.role &&
            CUSTOM_AUTH_ROLES.includes(cachedUserData.role)
          ) {
            clearTimeout(authTimeoutId);
            set({ loading: false });
            return;
          }

          const hasSameUserCache = !!(
            firebaseUser &&
            cachedUserData &&
            cachedUser?.uid === firebaseUser.uid
          );

          // If we already have valid cached data for this user, don't block the UI.
          // Let the page render immediately; we'll refresh the data silently in background.
          if (!hasSameUserCache) {
            set({ loading: true });
          }

          if (firebaseUser) {
            // console.log('👤 Processing authenticated user:', firebaseUser.email);
            try {
              // First try to get user data from users collection
              let userDoc = await getDocument("users", firebaseUser.uid);
              let userRole = null;

              try {
                const idTokenResult = await firebaseUser.getIdTokenResult();
                userRole = idTokenResult.claims.role || null;
              } catch (tokenError) {
                console.error("Error refreshing user token claims:", tokenError);
                try {
                  const idTokenResult = await firebaseUser.getIdTokenResult();
                  userRole = idTokenResult.claims.role || null;
                } catch (cachedTokenError) {
                  console.error(
                    "Error reading cached user token claims:",
                    cachedTokenError,
                  );
                }
              }

              // If not found by UID, try by email in users collection
              if (!userDoc && firebaseUser.email) {
                const users = await getDocumentsByField(
                  "users",
                  "email",
                  firebaseUser.email,
                );
                if (users.length > 0) {
                  userDoc = users[0];
                }
              }

              // If still not found, check teachers collection
              if (!userDoc && firebaseUser.email) {
                const teachers = await getDocumentsByField(
                  "teachers",
                  "email",
                  firebaseUser.email,
                );
                if (teachers.length > 0) {
                  userDoc = teachers[0];
                  userRole = "teacher";
                }
              }

              // If still not found, check students collection
              if (!userDoc && firebaseUser.email) {
                const students = await getDocumentsByField(
                  "students",
                  "email",
                  firebaseUser.email,
                );
                if (students.length > 0) {
                  userDoc = students[0];
                  userRole = "student";
                }
              }

              // If still not found, check madarsas collection for madarsa admin
              if (!userDoc) {
                // Try by UID first (if supported/linked)
                let madarsas = await getDocumentsByField(
                  "madarsas",
                  "firebaseAuthUid",
                  firebaseUser.uid,
                );

                // Fallback to email
                if (madarsas.length === 0 && firebaseUser.email) {
                  madarsas = await getDocumentsByField(
                    "madarsas",
                    "adminEmail",
                    firebaseUser.email,
                  );
                }

                if (madarsas.length > 0) {
                  const madarsaData = madarsas[0];
                  userDoc = {
                    id: madarsaData.id, // Capture Firestore Doc ID
                    uid: firebaseUser.uid,
                    email: madarsaData.adminEmail,
                    fullName: madarsaData.adminName,
                    role: "madarsa_admin",
                    status: madarsaData.status || "active",
                    profileComplete: true,
                    madarsaId: madarsaData.madarsaId || madarsas[0].id,
                    madarsaName: madarsaData.name,
                    madarsaAddress: madarsaData.address,
                    phone: pickAuthPhone(madarsaData.adminPhone, madarsaData.phone),
                    createdAt:
                      madarsaData.createdAt || new Date().toISOString(),
                    updatedAt:
                      madarsaData.updatedAt || new Date().toISOString(),
                  };
                  userRole = "madarsa_admin";
                }
              }

              // If still not found, check managers collection
              if (!userDoc && firebaseUser.email) {
                const managers = await getDocumentsByField(
                  "managers",
                  "email",
                  firebaseUser.email,
                );
                if (managers.length > 0) {
                  const managerData = managers[0];
                  userDoc = {
                    id: managerData.id,
                    uid: firebaseUser.uid,
                    email: managerData.email,
                    fullName: managerData.name,
                    name: managerData.name,
                    role: "manager",
                    status: managerData.status || "active",
                    profileComplete: true,
                    madarsaId: managerData.madarsaId,
                    madarsaName: managerData.madarsaName,
                    createdAt:
                      managerData.createdAt || new Date().toISOString(),
                    updatedAt:
                      managerData.updatedAt || new Date().toISOString(),
                  };
                  userRole = "manager";
                }
              }

              // If still not found, check pariksha_board_convener collection
              if (!userDoc) {
                // Try by UID first (since login page sets this)
                let conveners = await getDocumentsByField(
                  "pariksha_board_convener",
                  "firebaseAuthUid",
                  firebaseUser.uid,
                );

                // Fallback to email
                if (conveners.length === 0 && firebaseUser.email) {
                  conveners = await getDocumentsByField(
                    "pariksha_board_convener",
                    "email",
                    firebaseUser.email,
                  );
                }

                if (conveners.length > 0 && conveners[0].isActive !== false) {
                  const convenerData = conveners[0];
                  userDoc = {
                    id: convenerData.id, // Capture Firestore Doc ID
                    uid: firebaseUser.uid,
                    email: convenerData.email,
                    fullName: convenerData.name,
                    role: "pariksha_board_convener",
                    status: "active",
                    profileComplete: true,
                    phone: convenerData.phone,
                    name: convenerData.name,
                    createdAt:
                      convenerData.createdAt || new Date().toISOString(),
                    updatedAt:
                      convenerData.updatedAt || new Date().toISOString(),
                  };
                  userRole = "pariksha_board_convener";
                }
              }

              // Some admin-set accounts are represented by Firebase custom claims
              // only. Keep those sessions valid even if there is no matching
              // Firestore profile document.
              if (!userDoc && userRole) {
                userDoc = {
                  id: firebaseUser.uid,
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  fullName:
                    firebaseUser.displayName ||
                    firebaseUser.email ||
                    "Authenticated User",
                  name:
                    firebaseUser.displayName ||
                    firebaseUser.email ||
                    "Authenticated User",
                  role: userRole,
                  status: "active",
                  profileComplete: true,
                  createdAt: null,
                  updatedAt: null,
                };
              }

              // If a minimal user doc exists in `users` (or role detection is ambiguous),
              // but the canonical student profile lives in `students`, merge it so
              // student pages (like Smart Class) keep `classLevel/class/std` after refresh.
              if (userDoc && firebaseUser.email) {
                const missingStudentClass =
                  userDoc.classLevel == null &&
                  userDoc.class == null &&
                  userDoc.std == null;
                const isDigitalStudent = userDoc?.userType === "digital_student";

                const shouldCheckStudents =
                  !isDigitalStudent &&
                  (
                    userRole === "student" ||
                    userDoc.role === "student" ||
                    (!userRole && !userDoc.role && missingStudentClass)
                  );

                if (shouldCheckStudents) {
                  const students = await getDocumentsByField(
                    "students",
                    "email",
                    firebaseUser.email,
                  );
                  if (students.length > 0) {
                    const studentDoc = students[0];
                    userDoc = {
                      ...userDoc,
                      ...studentDoc,
                      id: studentDoc.id || userDoc.id,
                      userType: userDoc.userType || "normal_student",
                    };
                    userRole = "student";
                  }
                }
              }

              // Digital Classroom student profile lives in
              // digitalClassStudentRegistrations, not in the normal students collection.
              if (userDoc?.userType === "digital_student") {
                try {
                  const digitalStudents = await getDocumentsByField(
                    "digitalClassStudentRegistrations",
                    "uid",
                    firebaseUser.uid,
                  );

                  if (digitalStudents.length > 0) {
                    const digitalStudent = digitalStudents[0];

                    userDoc = {
                      ...userDoc,
                      ...digitalStudent,

                      // Keep the auth/session identity from users/{uid}.
                      id: digitalStudent.id || userDoc.id,
                      uid: firebaseUser.uid,
                      email:
                        digitalStudent.studentEmail ||
                        digitalStudent.email ||
                        userDoc.email ||
                        firebaseUser.email,
                      fullName:
                        digitalStudent.fullName ||
                        digitalStudent.studentName ||
                        userDoc.fullName ||
                        userDoc.name,
                      role: "student",
                      userType: "digital_student",

                      // Keep generic auth status active/inactive/suspended.
                      // Registration approval remains available separately.
                      status:
                        digitalStudent.accountStatus ||
                        userDoc.status ||
                        "active",
                      registrationStatus: digitalStudent.status || null,
                      accountStatus: digitalStudent.accountStatus || "active",
                      paymentStatus: digitalStudent.paymentStatus || "pending",
                      digitalClassAccess: digitalStudent.digitalClassAccess === true,
                      digitalAdmissionNumber:
                        digitalStudent.digitalAdmissionNumber || null,
                      classLevel: digitalStudent.applyingclass || null,
                      class: digitalStudent.applyingclass || null,
                      phone: digitalStudent.phone || userDoc.phone || null,
                      guardianPhone:
                        digitalStudent.guardianPhone ||
                        userDoc.guardianPhone ||
                        null,
                    };

                    userRole = "student";
                  }
                } catch (error) {
                  console.error(
                    "Error loading Digital Student profile:",
                    error,
                  );
                }
              }

              if (userDoc) {
                // console.log('✅ User document found:', {
                //   email: userDoc.email,
                //   role: userDoc.role || userRole,
                //   collection: userRole ? (userRole === 'teacher' ? 'teachers' : userRole === 'student' ? 'students' : userRole === 'madarsa_admin' ? 'madarsas' : 'unknown') : 'users'
                // });

                const existingUserData = get().userData;
                const normalizedClassLevel =
                  userDoc.classLevel ?? userDoc.class ?? userDoc.std ?? null;

                set({
                  user: {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName,
                    photoURL: firebaseUser.photoURL,
                  },
                  userData: {
                    id: userDoc.id || null, // Include Firestore ID
                    uid: userDoc.uid || firebaseUser.uid,
                    email: userDoc.email,
                    fullName: userDoc.fullName || userDoc.name,
                    role: userRole || userDoc.role,
                    userType:
                      userDoc.userType ||
                      ((userRole || userDoc.role) === "student"
                        ? "normal_student"
                        : null),
                    status: userDoc.status,
                    registrationStatus: userDoc.registrationStatus || null,
                    accountStatus: userDoc.accountStatus || null,
                    paymentStatus: userDoc.paymentStatus || null,
                    digitalClassAccess: userDoc.digitalClassAccess ?? false,
                    digitalAdmissionNumber:
                      userDoc.digitalAdmissionNumber || null,
                    profileComplete: userDoc.profileComplete,
                    createdAt: userDoc.createdAt,
                    updatedAt: userDoc.updatedAt,
                    lastLogin: userDoc.lastLogin,
                    madarsaId: userDoc.madarsaId || null,
                    // Add additional fields for teachers/students/madarsa admins
                    teacherId: userDoc.teacherId || null,
                    studentId: userDoc.studentId || null,
                    classLevel: normalizedClassLevel || null,
                    class:
                      userDoc.class ||
                      userDoc.classLevel ||
                      userDoc.std ||
                      null,
                    admissionNumber: userDoc.admissionNumber || null,
                    madarsaName: userDoc.madarsaName || null,
                    madarsaAddress: userDoc.madarsaAddress || null,
                    // Add inspector-specific fields
                    assignedMadarsas: userDoc.assignedMadarsas || [],
                    assignedDistricts:
                      userDoc.assignedDistricts ||
                      (userDoc.assignedDistrict
                        ? [userDoc.assignedDistrict]
                        : []),
                    assignedDistrict: userDoc.assignedDistrict || null,
                    allowedTime: userDoc.allowedTime || 3600, // Inspector session time limit
                    name: userDoc.name || userDoc.fullName,
                    fullName: userDoc.fullName || userDoc.name,
                    phone:
                pickAuthPhone(
                  mergedDoc.phone,
                  mergedDoc.guardianPhone,
                  userDoc.phone,
                  userDoc.adminPhone,
                ) || null,
                    authSessionIssuedAt:
                      hasFreshOtpSession(existingUserData) &&
                      existingUserData?.uid === (userDoc.uid || firebaseUser.uid)
                        ? existingUserData.authSessionIssuedAt
                        : Date.now(),
                    otpVerifiedAt:
                      hasFreshOtpSession(existingUserData) &&
                      existingUserData?.uid === (userDoc.uid || firebaseUser.uid)
                        ? existingUserData.otpVerifiedAt
                        : null,
                  },
                  loading: false,
                });
              } else {
                // console.log('⚠️ No user document found for:', firebaseUser.email);
                set({
                  user: {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                  },
                  userData: null,
                  loading: false,
                });
              }
            } catch (error) {
              console.error("❌ Error fetching user data:", error);
              // Preserve any existing cached userData (from persist store) so a transient
              // Firestore failure doesn't wipe the session and cause an /unauthorized redirect.
              const existingUserData = get().userData;
              set({
                user: {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                },
                userData: existingUserData || null,
                loading: false,
              });
            }
          } else {
            // console.log('🚫 No authenticated user (logged out or initial state)');
            set({
              user: null,
              userData: null,
              loading: false,
            });
          }
        });

        return unsubscribe;
      },

      // Clear auth state
      clearAuth: () => {
        set({
          user: null,
          userData: null,
          loading: false,
          initialized: false, // Reset initialization state
        });
      },

      // Reset auth store (useful for development/debugging)
      resetAuth: () => {
        set({
          user: null,
          userData: null,
          loading: true,
          initialized: false,
        });
      },

      // Logout
      logout: async () => {
        try {
          await signOut(auth);
        } catch (error) {
          console.error("Error during logout:", error);
        }

        set({
          user: null,
          userData: null,
          loading: false,
          initialized: false, // Reset initialization state on logout
        });
      },

      // Check if user has required role
      hasRole: (requiredRole) => {
        const { userData } = get();
        if (!userData || !userData.role) return false;

        const roleHierarchy = {
          student: 1,
          teacher: 2,
          madarsa_admin: 3,
          pariksha_board_convener: 3,
          mekhala_admin: 3,
          inspector: 3,
          manager: 3,
          central_admin: 4,
        };

        // For exact role matching (like pariksha_board_convener), check for exact match
        if (
          requiredRole === "pariksha_board_convener" ||
          requiredRole === "convener_admin" ||
          requiredRole === "mekhala_admin" ||
          requiredRole === "inspector" ||
          requiredRole === "manager" ||
          requiredRole === "home_admin"
        ) {
          return (
            userData.role === requiredRole || userData.role === "central_admin"
          );
        }

        return roleHierarchy[userData.role] >= roleHierarchy[requiredRole];
      },

      // SECURITY FIX: Validate that the user's session is genuinely active
      // Returns true if session is valid, false if session should be cleared
      isSessionValid: () => {
        const { user, userData } = get();
        const firebaseUser = auth.currentUser;
        const CUSTOM_AUTH_ROLES = CUSTOM_PORTAL_ROLES;

        // Custom portal users don't need Firebase auth
        if (CUSTOM_AUTH_ROLES.includes(userData?.role)) {
          return hasLiveCustomPortalSession(userData);
        }

        // For Firebase auth users, we need:
        // 1. An active Firebase user
        // 2. Store user to match the Firebase user
        if (!firebaseUser) {
          return false; // No active Firebase session
        }

        if (!user) {
          return false; // Store doesn't have user info
        }

        // Verify UID matches
        if (user.uid !== firebaseUser.uid) {
          return false; // Mismatch between store and Firebase
        }

        // Session is valid
        return true;
      },

      // Refresh user data from Firestore
      refreshUserData: async () => {
        const { user, userData } = get();
        if (!user) return null;

        set({ loading: true });
        try {
          const userDoc = await getDocument("users", user.uid);
          if (userDoc) {
            let mergedDoc = userDoc;

            // Normal student: merge the canonical profile from `students`.
            if (
              userData?.role === "student" &&
              userData?.userType !== "digital_student" &&
              user.email
            ) {
              try {
                const students = await getDocumentsByField(
                  "students",
                  "email",
                  user.email,
                );
                if (students.length > 0) {
                  mergedDoc = {
                    ...mergedDoc,
                    ...students[0],
                    userType: mergedDoc.userType || "normal_student",
                  };
                }
              } catch (e) {
                console.error("Error merging student profile on refresh:", e);
              }
            }

            // Digital student: merge from digitalClassStudentRegistrations by UID.
            if (userData?.userType === "digital_student") {
              try {
                const digitalStudents = await getDocumentsByField(
                  "digitalClassStudentRegistrations",
                  "uid",
                  user.uid,
                );

                if (digitalStudents.length > 0) {
                  const digitalStudent = digitalStudents[0];

                  mergedDoc = {
                    ...mergedDoc,
                    ...digitalStudent,
                    id: digitalStudent.id || mergedDoc.id,
                    uid: user.uid,
                    email:
                      digitalStudent.studentEmail ||
                      digitalStudent.email ||
                      mergedDoc.email ||
                      user.email,
                    fullName:
                      digitalStudent.fullName ||
                      digitalStudent.studentName ||
                      mergedDoc.fullName ||
                      mergedDoc.name,
                    role: "student",
                    userType: "digital_student",
                    status:
                      digitalStudent.accountStatus ||
                      mergedDoc.status ||
                      "active",
                    registrationStatus: digitalStudent.status || null,
                    accountStatus: digitalStudent.accountStatus || "active",
                    paymentStatus: digitalStudent.paymentStatus || "pending",
                    digitalClassAccess: digitalStudent.digitalClassAccess === true,
                    digitalAdmissionNumber:
                      digitalStudent.digitalAdmissionNumber || null,
                    classLevel: digitalStudent.applyingclass || null,
                    class: digitalStudent.applyingclass || null,
                    phone: digitalStudent.phone || mergedDoc.phone || null,
                    guardianPhone:
                      digitalStudent.guardianPhone ||
                      mergedDoc.guardianPhone ||
                      null,
                  };
                }
              } catch (e) {
                console.error(
                  "Error merging Digital Student profile on refresh:",
                  e,
                );
              }
            }

            const updatedUserData = {
              uid: mergedDoc.uid || userDoc.uid || user.uid,
              email: mergedDoc.email || userDoc.email || user.email,
              fullName:
                mergedDoc.fullName ||
                mergedDoc.name ||
                userDoc.fullName ||
                userDoc.name,
              role: mergedDoc.role || userDoc.role,
              userType:
                mergedDoc.userType ||
                userDoc.userType ||
                ((mergedDoc.role || userDoc.role) === "student"
                  ? "normal_student"
                  : null),
              status: mergedDoc.status || userDoc.status,
              registrationStatus: mergedDoc.registrationStatus || null,
              accountStatus: mergedDoc.accountStatus || null,
              paymentStatus: mergedDoc.paymentStatus || null,
              digitalClassAccess: mergedDoc.digitalClassAccess ?? false,
              digitalAdmissionNumber:
                mergedDoc.digitalAdmissionNumber || null,
              profileComplete:
                mergedDoc.profileComplete ?? userDoc.profileComplete,
              createdAt: userDoc.createdAt,
              updatedAt: userDoc.updatedAt,
              lastLogin: userDoc.lastLogin,
              madarsaId: userDoc.madarsaId || null,
              assignedMadarsas: userDoc.assignedMadarsas || [],
              allowedTime: userDoc.allowedTime || 3600,
              name: userDoc.name || userDoc.fullName,
              phone: pickAuthPhone(userDoc.phone, userDoc.adminPhone) || null,
              teacherId: userDoc.teacherId || null,
              studentId: userDoc.studentId || null,
              classLevel:
                mergedDoc.classLevel ||
                mergedDoc.class ||
                mergedDoc.std ||
                null,
              class:
                mergedDoc.class ||
                mergedDoc.classLevel ||
                mergedDoc.std ||
                null,
              admissionNumber: mergedDoc.admissionNumber || null,
              madarsaName: mergedDoc.madarsaName || null,
              madarsaAddress: mergedDoc.madarsaAddress || null,
            };
            set({ userData: updatedUserData, loading: false });
            return updatedUserData;
          }
          return null;
        } catch (error) {
          console.error("Error refreshing user data:", error);
          set({ loading: false });
          return null;
        }
      },

      // Update specific user data fields
      updateUserData: (updates) => {
        const { userData } = get();
        if (!userData) return;

        set({
          userData: {
            ...userData,
            ...updates,
            updatedAt: new Date().toISOString(),
          },
        });
      },

      // Store admin session temporarily (for user creation scenarios)
      tempAdminSession: null,
      storeAdminSession: () => {
        const { user, userData } = get();
        set({ tempAdminSession: { user, userData } });
      },

      // Restore admin session
      restoreAdminSession: () => {
        const { tempAdminSession } = get();
        if (tempAdminSession) {
          set({
            user: tempAdminSession.user,
            userData: tempAdminSession.userData,
            loading: false,
            tempAdminSession: null,
          });
        }
      },

      // Debug function to check current auth state
      debugAuthState: () => {
        const state = get();
        // console.log('🔍 Current Auth State:', {
        //   user: state.user,
        //   userData: state.userData,
        //   loading: state.loading,
        //   initialized: state.initialized,
        //   firebaseCurrentUser: auth.currentUser ? {
        //     uid: auth.currentUser.uid,
        //     email: auth.currentUser.email
        //   } : null
        // });
        return state;
      },

      // Force re-initialization of auth (useful when mismatch detected)
      forceReinitializeAuth: () => {
        // console.log('🔄 Force re-initializing auth...');
        set({ initialized: false, loading: true });
        return get().initializeAuth();
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        userData: state.userData,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
      },
      // Add version for migration if needed
      version: 2,
      // Merge stored state with initial state
      merge: (persistedState, currentState) => {
        // Custom-portal roles don't use Firebase Auth; keep them only while
        // their own issued-at session is still inside the configured max age.
        const CUSTOM_AUTH_ROLES = CUSTOM_PORTAL_ROLES;
        const isCustomPortal = CUSTOM_AUTH_ROLES.includes(
          persistedState?.userData?.role,
        );

        if (isCustomPortal && hasLiveCustomPortalSession(persistedState?.userData)) {
          return {
            ...currentState,
            ...persistedState,
            loading: false,
            initialized: false,
            user: null, // Clear Firebase user, will be re-verified
          };
        } else if (!isCustomPortal && persistedState?.userData && persistedState?.user) {
          // Firebase-backed sessions are verified by onAuthStateChanged on each
          // refresh/navigation. The OTP timestamp should not become a 10-minute
          // dashboard expiry and log out a valid Firebase session mid-work.
          return {
            ...currentState,
            ...persistedState,
            loading: true,
            initialized: false,
          };
        } else {
          // No usable persisted session; wait for Firebase/custom login.
          return {
            ...currentState,
            user: null,
            userData: null,
            loading: true,
            initialized: false,
          };
        }
      },
    },
  ),
);

export default useAuthStore;
