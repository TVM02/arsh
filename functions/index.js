import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

initializeApp(); // ✅ NO serviceAccountKey

const db = getFirestore();
const adminAuth = getAuth();

export const deleteInspectorUser = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { uid } = request.data || {};
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "uid is required");
  }

  // Authorization: only admin / central_admin can delete users
  const callerSnap = await db.collection("users").doc(request.auth.uid).get();
  const callerRole = callerSnap.exists ? callerSnap.data()?.role : null;
  if (callerRole !== "central_admin" && callerRole !== "admin") {
    throw new HttpsError("permission-denied", "Not allowed");
  }

  console.log("[deleteInspectorUser] deleting", {
    targetUid: uid,
    callerUid: request.auth.uid,
    callerRole,
  });

  // Delete Auth user first (this is what frees the email)
  try {
    await adminAuth.deleteUser(uid);
  } catch (err) {
    // If user isn't in Auth, still proceed to delete Firestore doc
    console.warn("[deleteInspectorUser] auth delete failed", {
      targetUid: uid,
      message: err?.message,
      code: err?.code,
    });
  }

  // Delete Firestore user document
  try {
    await db.collection("users").doc(uid).delete();
  } catch (err) {
    console.error("[deleteInspectorUser] firestore delete failed", {
      targetUid: uid,
      message: err?.message,
    });
    throw new HttpsError("internal", "Failed to delete Firestore user");
  }

  return { success: true };
});

export const syncStudentToHallTickets = onDocumentUpdated(
  "students/{studentId}",
  async (event) => {
    const studentId = event.params.studentId;
    const student = event.data?.after.data();

    if (!student) return;

    const updatedFields = {
      fullName: student.fullName ?? null,
      gender: student.gender ?? null,
      guardianPhone: student.guardianPhone ?? null,
      classLevel: student.classLevel ?? null,
      admissionNumber: student.admissionNumber ?? null,
      madarsaId: student.madarsaId ?? null,
      profilePictureUrl: student.profilePicture ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    };

    const snap = await db
      .collectionGroup("students")
      .where("studentId", "==", studentId)
      .get();

    if (snap.empty) return;

    let batch = db.batch();
    let count = 0;

    for (const doc of snap.docs) {
      batch.update(doc.ref, updatedFields);
      count++;

      if (count === 450) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    console.log(`Synced ${snap.size} hall tickets for student ${studentId}`);
  },
);
