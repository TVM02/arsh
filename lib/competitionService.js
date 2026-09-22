import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ──────────────────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────────────────

const CONFIG_REF = () => doc(db, "competition", "config");

export async function getCompetitionConfig() {
  const snap = await getDoc(CONFIG_REF());
  return snap.exists() ? snap.data() : null;
}

export async function saveCompetitionConfig(data, uid) {
  await setDoc(
    CONFIG_REF(),
    { ...data, updatedAt: serverTimestamp(), updatedBy: uid },
    { merge: true },
  );
}

// ──────────────────────────────────────────────────────────────────────────
// EVENTS
// ──────────────────────────────────────────────────────────────────────────

const eventsRef = () => collection(db, "competition_events");

export async function getEvents(category = null) {
  const constraints = [orderBy("createdAt", "asc")];
  if (category) constraints.unshift(where("category", "==", category));
  const snap = await getDocs(query(eventsRef(), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createEvent(data, uid) {
  return addDoc(eventsRef(), {
    ...data,
    createdAt: serverTimestamp(),
    createdBy: uid,
  });
}

export async function updateEvent(eventId, data) {
  await updateDoc(doc(db, "competition_events", eventId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEvent(eventId) {
  await deleteDoc(doc(db, "competition_events", eventId));
}

// ──────────────────────────────────────────────────────────────────────────
// REGISTRATIONS (Phase 2)
// ──────────────────────────────────────────────────────────────────────────

const registrationsRef = () => collection(db, "competition_registrations");

export async function getRegistrationsByMadarsa(madarsaId) {
  const snap = await getDocs(
    query(registrationsRef(), where("madarsaId", "==", madarsaId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getRegistrationsByEvent(eventId) {
  const snap = await getDocs(
    query(registrationsRef(), where("eventId", "==", eventId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveRegistration(data, uid) {
  return addDoc(registrationsRef(), {
    ...data,
    registeredAt: serverTimestamp(),
    registeredBy: uid,
  });
}

export async function updateRegistration(regId, data) {
  await updateDoc(doc(db, "competition_registrations", regId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRegistration(regId) {
  await deleteDoc(doc(db, "competition_registrations", regId));
}

// ──────────────────────────────────────────────────────────────────────────
// MARKS — generic helpers for each phase collection
// ──────────────────────────────────────────────────────────────────────────

const MARK_COLLECTIONS = {
  mekhala: "competition_mekhala_marks",
  district: "competition_district_marks",
  state: "competition_state_marks",
};

function marksColRef(phase) {
  const col = MARK_COLLECTIONS[phase];
  if (!col) throw new Error(`Unknown marks phase: ${phase}`);
  return collection(db, col);
}

export async function getMarksByMadarsa(phase, madarsaId) {
  const snap = await getDocs(
    query(marksColRef(phase), where("madarsaId", "==", madarsaId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getMarksByMekhala(phase, mekhalaId) {
  const snap = await getDocs(
    query(marksColRef(phase), where("mekhalaId", "==", mekhalaId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getMarksByDistrict(phase, districtName) {
  const snap = await getDocs(
    query(marksColRef(phase), where("districtName", "==", districtName)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveMarks(
  phase,
  data,
  uid,
) {
  return addDoc(
    marksColRef(phase),
    {
      ...data,

      resultStatus:
        "draft",

      enteredAt:
        serverTimestamp(),

      enteredBy:
        uid || null,

      verifiedAt:
        null,

      verifiedBy:
        null,

      publishedAt:
        null,

      publishedBy:
        null,
    },
  );
}

export async function updateMarks(phase, markId, data) {
  await updateDoc(doc(db, MARK_COLLECTIONS[phase], markId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMarks(phase, markId) {
  await deleteDoc(doc(db, MARK_COLLECTIONS[phase], markId));
}

// ──────────────────────────────────────────────────────────────────────────
// RESULTS (public, Phase 6)
// ──────────────────────────────────────────────────────────────────────────

const resultsRef = () => collection(db, "competition_results");

export async function publishResult(data, uid) {
  return addDoc(resultsRef(), {
    ...data,
    publishedAt: serverTimestamp(),
    verifiedBy: uid || null,
  });
}

export function subscribeToResults(callback) {
  return onSnapshot(
    query(resultsRef(), orderBy("finalScore", "desc")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
}
// ─────────────────────────────────────────────────────────────
// LIVE MEKHALA MARKS
// Used by homepage live scoreboard
// ─────────────────────────────────────────────────────────────

export function subscribeToMekhalaMarks(
  callback,
  onError,
) {
  const ref = collection(
    db,
    "competition_mekhala_marks",
  );

  return onSnapshot(
    ref,

    (snapshot) => {
      const marks =
        snapshot.docs.map(
          (markDoc) => ({
            id: markDoc.id,
            ...markDoc.data(),
          }),
        );

      callback(marks);
    },

    (error) => {
      console.error(
        "Mekhala marks live subscription error:",
        error,
      );

      if (onError) {
        onError(error);
      }
    },
  );
}

export async function verifyMekhalaResult(
  markId,
  uid,
) {
  await updateDoc(
    doc(
      db,
      "competition_mekhala_marks",
      markId,
    ),
    {
      resultStatus:
        "verified",

      verifiedBy:
        uid || null,

      verifiedAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    },
  );
}


export async function publishMekhalaResult(
  markId,
  uid,
) {
  const ref = doc(
    db,
    "competition_mekhala_marks",
    markId,
  );

  const snap =
    await getDoc(ref);

  if (!snap.exists()) {
    throw new Error(
      "Result not found",
    );
  }

  const data =
    snap.data();

  if (
    data.resultStatus !==
    "verified"
  ) {
    throw new Error(
      "Please verify the result before publishing.",
    );
  }

  await updateDoc(
    ref,
    {
      resultStatus:
        "published",

      publishedBy:
        uid || null,

      publishedAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    },
  );
}

export async function unpublishMekhalaResult(
  markId,
  uid,
) {
  await updateDoc(
    doc(
      db,
      "competition_mekhala_marks",
      markId,
    ),
    {
      resultStatus:
        "verified",

      publishedBy:
        null,

      publishedAt:
        null,

      updatedBy:
        uid || null,

      updatedAt:
        serverTimestamp(),
    },
  );
}
export function subscribeToPublishedMekhalaMarks(
  callback,
  onError,
) {
  const q = query(
    collection(
      db,
      "competition_mekhala_marks",
    ),
    where(
      "verificationStatus",
      "==",
      "published",
    ),
  );

  return onSnapshot(
    q,

    (snapshot) => {
      const results =
        snapshot.docs.map(
          (resultDoc) => ({
            id: resultDoc.id,
            ...resultDoc.data(),
          }),
        );

      callback(results);
    },

    (error) => {
      console.error(
        "Published Mekhala result subscription error:",
        error,
      );

      if (onError) {
        onError(error);
      }
    },
  );
}