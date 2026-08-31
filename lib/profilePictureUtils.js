/**
 * profilePictureUtils.js
 *
 * Exhaustive resolver for student profile picture URLs.
 *
 * Tries every known field name and every known Firestore collection / path
 * where a profile picture URL may have been stored at any point in the app's
 * history.  Falls back gracefully (never throws) and returns null only when
 * truly nothing is found.
 *
 * Strategy order:
 *   0. Quick-check on the already-loaded student object (no Firestore hit)
 *   1. Fresh students doc  by uid / doc-id
 *   2. Students collection query  by email
 *   3. Admissions doc  by admissionId  (the Firestore doc ID stored in student.admissionId)
 *   4. Admissions query  by studentUid == uid  (field added on approval)
 *   5. Admissions query  by admissionNumber
 *   6. Admissions query  by email
 *   7. Users doc  by uid
 *   8. Users query  by email
 *   9. hallTickets subcollection (collectionGroup "students") by admissionNumber
 *  10. hallTickets subcollection (collectionGroup "students") by studentId
 *  11. examRegistrations  by admissionNumber
 *  12. examRegistrations  by studentId (uid)
 *
 * Every strategy above is keyed by a value that uniquely identifies one
 * student (doc id/uid, a direct admissionId link, the globally-unique
 * admissionNumber, email, or aadhar). There is deliberately no fallback that
 * matches by full name or scans a madarsa for "any" photo — full name is not
 * unique, and an earlier version of this file that did that ended up
 * attaching a same-named student's photo to the wrong record (and
 * persisting it, via resolveAndPersistProfilePicture). Returning null when
 * every unique-key lookup fails is correct; it must not be replaced with a
 * guess.
 *
 * On each document found we try these field names (extractPicFromDoc):
 *   profilePicture | profilePictureUrl | photoURL | photo | imageUrl |
 *   downloadURL | image | pictureUrl | studentPhoto | studentImage | avatar |
 *   profileImage | profileImageUrl | photoUrl | cloudinaryUrl | firebaseUrl |
 *   nested documents/forms/personalInfo/image objects
 */

import {
  doc,
  getDoc,
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  limit,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract a valid https:// URL from any of these shapes:
 *   "https://..."                    plain string
 *   { secure_url: "https://..." }    Cloudinary response object
 *   { url: "https://..." }           generic object
 *   { downloadURL: "https://..." }   Firebase Storage helper shape
 *   { imageUrl / pictureUrl / image / avatar / photo … }
 */
function sanitizeUrlString(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, "").trim();
  if (!cleaned) return null;
  return cleaned;
}

export function pickUrl(val) {
  if (!val) return null;

  if (typeof val === "string") {
    const normalized = sanitizeUrlString(val);
    if (!normalized) return null;
    return normalized.startsWith("http") || normalized.startsWith("data:image/")
      ? normalized
      : null;
  }

  if (typeof val === "object") {
    const candidates = [
      val.secure_url,
      val.url,
      val.downloadURL,
      val.imageUrl,
      val.pictureUrl,
      val.image,
      val.avatar,
      val.photo,
      val.profilePicture,
      val.profilePictureUrl,
      val.photoURL,
      val.studentPhoto,
      val.studentImage,
      val.profileImage,
      val.profileImageUrl,
      val.photoUrl,
      val.cloudinaryUrl,
      val.firebaseUrl,
      val.fileUrl,
      val.publicUrl,
      val.src,
    ];
    for (const c of candidates) {
      if (typeof c !== "string") continue;
      const normalized = sanitizeUrlString(c);
      if (
        normalized &&
        (normalized.startsWith("http") || normalized.startsWith("data:image/"))
      )
        return normalized;
    }
  }

  return null;
}

/**
 * Return the first valid URL found across all known picture fields of a document.
 */
export function extractPicFromDoc(data, options = {}) {
  if (!data) return null;
  const excludedUrls = new Set((options.failedUrls || []).filter(Boolean));

  const fields = [
    data.profilePicture,
    data.profilePictureUrl,
    data.photoURL,
    data.photo,
    data.imageUrl,
    data.downloadURL,
    data.image,
    data.pictureUrl,
    data.avatar,
    data.studentPhoto,
    data.studentImage,
    data.profileImage,
    data.profileImageUrl,
    data.photoUrl,
    data.cloudinaryUrl,
    data.firebaseUrl,
    data.fileUrl,
    data.publicUrl,
    data.documents?.profilePicture,
    data.documents?.profilePictureUrl,
    data.documents?.profileImage,
    data.documents?.photo,
    data.documentUrls?.profilePicture,
    data.documentUrls?.photo,
    data.personalInfo?.profilePicture,
    data.personalInfo?.profilePictureUrl,
    data.personalInfo?.photo,
    data.student?.profilePicture,
    data.student?.profilePictureUrl,
    data.student?.photo,
    data.application?.profilePicture,
    data.application?.profilePictureUrl,
    data.application?.photo,
    data.formData?.profilePicture,
    data.formData?.profilePictureUrl,
    data.formData?.photo,
  ];

  for (const f of fields) {
    const url = pickUrl(f);
    if (url && !excludedUrls.has(url)) return url;
  }

  return null;
}

function uniqueValues(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (value === null || value === undefined || value === "") return false;
    const key = `${typeof value}:${String(value).trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function admissionNumberCandidates(value) {
  if (value === null || value === undefined || value === "N/A") return [];
  const raw = String(value).trim();
  if (!raw) return [];
  const candidates = [raw];
  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) {
    candidates.push(numeric);
    candidates.push(String(numeric));
  }
  return uniqueValues(candidates);
}

async function queryFirstPic(
  collectionName,
  fields,
  values,
  label,
  options = {},
) {
  for (const field of fields) {
    for (const value of uniqueValues(values)) {
      const docs = await safeQuery(
        query(
          collection(db, collectionName),
          where(field, "==", value),
          limit(10),
        ),
        `${label} ${field}`,
      );
      for (const d of docs) {
        const pic = extractPicFromDoc(d.data(), options);
        if (pic) {
          console.log(`[ProfilePic] ✅ ${label} (${field})`);
          return pic;
        }
      }
    }
  }
  return null;
}

async function collectionGroupFirstPic(
  groupName,
  fields,
  values,
  label,
  options = {},
) {
  for (const field of fields) {
    for (const value of uniqueValues(values)) {
      const docs = await safeQuery(
        query(
          collectionGroup(db, groupName),
          where(field, "==", value),
          limit(10),
        ),
        `${label} ${field}`,
      );
      for (const d of docs) {
        const pic = extractPicFromDoc(d.data(), options);
        if (pic) {
          console.log(`[ProfilePic] ✅ ${label} (${field})`);
          return pic;
        }
      }
    }
  }
  return null;
}

// This resolver runs a long chain of best-effort fallback strategies, several
// of which are expected to fail for a given caller/document shape — a
// student resolving their own picture will be denied by broader staff-only
// queries (security rules working as intended), and some collectionGroup
// lookups need a composite index that doesn't exist for every field variant
// tried. Neither case should block resolution (later strategies still run)
// or spam the console; only genuinely unexpected errors are worth logging.
function isExpectedResolverError(e) {
  return e?.code === "permission-denied" || e?.code === "failed-precondition";
}

/** Run a Firestore query safely; returns [] on permission / index errors. */
async function safeQuery(q, label) {
  try {
    const snap = await getDocs(q);
    return snap.docs;
  } catch (e) {
    if (!isExpectedResolverError(e)) {
      console.warn(`[ProfilePic] ${label} failed:`, e?.message ?? e);
    }
    return [];
  }
}

/** Get a single Firestore doc safely; returns null on error / not-found. */
async function safeGet(docRef, label) {
  try {
    const snap = await getDoc(docRef);
    return snap.exists() ? snap : null;
  } catch (e) {
    if (!isExpectedResolverError(e)) {
      console.warn(`[ProfilePic] ${label} failed:`, e?.message ?? e);
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main resolver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a student's profile picture URL by checking every possible source.
 *
 * @param {object} studentData  Any subset of: id, uid, admissionId, admissionNumber,
 *                              email, profilePicture, profilePictureUrl, photoURL, …
 * @param {object} [options]
 * @param {boolean} [options.skipFirestore=false]  Use only already-loaded fields.
 * @returns {Promise<string|null>}
 */
export async function resolveProfilePicture(studentData, options = {}) {
  const {
    id,
    uid,
    admissionId,
    admissionNumber,
    email,
    phone,
    guardianPhone,
    aadharNumber,
    fullName,
    name,
    studentName,
    madarsaId,
    profilePicture,
    profilePictureUrl,
    photoURL,
    photo,
    imageUrl,
    downloadURL,
    studentPhoto,
    studentImage,
    avatar,
  } = studentData ?? {};

  const _name = fullName || studentName || name;

  // ── Strategy 0: Quick check on already-loaded data (no Firestore hit) ────
  const quick = extractPicFromDoc(studentData ?? {}, options);
  if (quick) return quick;

  if (options.skipFirestore) return null;

  const studentDocId = uid || id;
  const admissionNumbers = admissionNumberCandidates(admissionNumber);
  const safeAdmNum = admissionNumbers[0] || null;

  console.log(
    "[ProfilePic] Resolving for:",
    _name,
    "| uid:",
    studentDocId,
    "| admissionId:",
    admissionId,
    "| admissionNumber:",
    safeAdmNum,
    "| email:",
    email,
  );

  // ── Strategy 1: Fresh students doc by uid / doc-id ───────────────────────
  if (studentDocId) {
    const snap = await safeGet(
      doc(db, "students", studentDocId),
      "students/id",
    );
    if (snap) {
      const pic = extractPicFromDoc(snap.data(), options);
      if (pic) {
        console.log("[ProfilePic] ✅ Strategy 1 (students doc)");
        return pic;
      } else
        console.log(
          "[ProfilePic] ❌ Strategy 1: doc found but no pic field. profilePicture=",
          snap.data()?.profilePicture?.slice?.(0, 40),
        );
    } else
      console.log(
        "[ProfilePic] ❌ Strategy 1: no doc found for uid",
        studentDocId,
      );
  }

  // ── Strategy 2: Students collection query by email ───────────────────────
  if (email) {
    const docs = await safeQuery(
      query(collection(db, "students"), where("email", "==", email), limit(5)),
      "students by email",
    );
    for (const d of docs) {
      const pic = extractPicFromDoc(d.data(), options);
      if (pic) {
        console.log("[ProfilePic] ✅ Strategy 2 (students by email)");
        return pic;
      }
    }
    if (docs.length === 0)
      console.log(
        "[ProfilePic] ❌ Strategy 2: no students found for email",
        email,
      );
  }

  // ── Strategy 3: Admissions doc by admissionId ────────────────────────────
  if (admissionId) {
    const snap = await safeGet(
      doc(db, "admissions", admissionId),
      "admissions/admissionId",
    );
    if (snap) {
      const pic = extractPicFromDoc(snap.data(), options);
      if (pic) {
        console.log("[ProfilePic] ✅ Strategy 3 (admissions by admissionId)");
        return pic;
      } else
        console.log(
          "[ProfilePic] ❌ Strategy 3: admissions doc found but no pic. profilePicture=",
          snap.data()?.profilePicture?.slice?.(0, 40),
          "profilePictureUrl=",
          snap.data()?.profilePictureUrl?.slice?.(0, 40),
        );
    } else
      console.log(
        "[ProfilePic] ❌ Strategy 3: no admissions doc for id",
        admissionId,
      );
  } else {
    console.log("[ProfilePic] ⚠️  Strategy 3 skipped: no admissionId");
  }

  // ── Strategy 4: Admissions query by studentUid (set on approval) ─────────
  if (studentDocId) {
    const docs = await safeQuery(
      query(
        collection(db, "admissions"),
        where("studentUid", "==", studentDocId),
        limit(5),
      ),
      "admissions by studentUid",
    );
    for (const d of docs) {
      const pic = extractPicFromDoc(d.data(), options);
      if (pic) {
        console.log("[ProfilePic] ✅ Strategy 4 (admissions by studentUid)");
        return pic;
      }
    }
    if (docs.length === 0)
      console.log(
        "[ProfilePic] ❌ Strategy 4: no admissions found for studentUid",
        studentDocId,
      );
    else
      console.log(
        "[ProfilePic] ❌ Strategy 4:",
        docs.length,
        "admissions found but no pic",
      );
  }

  // ── Strategy 5: Admissions query by admissionNumber ──────────────────────
  if (admissionNumbers.length) {
    const pic = await queryFirstPic(
      "admissions",
      [
        "admissionNumber",
        "admissionNo",
        "admission_number",
        "admission_no",
        "studentAdmissionNumber",
      ],
      admissionNumbers,
      "Strategy 5 admissions by admission number",
      options,
    );
    if (pic) return pic;
  }

  // ── Strategy 5b: Admissions query by high-confidence identity fields ─────
  const isValidAadhar = aadharNumber && String(aadharNumber).trim().length >= 12 && !/^0+$/.test(String(aadharNumber).trim());
  let identityPic = null;
  if (isValidAadhar) {
    identityPic = await queryFirstPic(
      "admissions",
      ["aadharNumber"],
      [aadharNumber],
      "Strategy 5b admissions by identity",
      options,
    );
  }
  if (identityPic) return identityPic;

  // ── Strategy 6: Admissions query by email ────────────────────────────────
  if (email) {
    const docs = await safeQuery(
      query(
        collection(db, "admissions"),
        where("email", "==", email),
        limit(5),
      ),
      "admissions by email",
    );
    for (const d of docs) {
      const pic = extractPicFromDoc(d.data(), options);
      if (pic) {
        console.log("[ProfilePic] ✅ Strategy 6 (admissions by email)");
        return pic;
      }
    }
    if (docs.length === 0)
      console.log(
        "[ProfilePic] ❌ Strategy 6: no admissions found for email",
        email,
      );
    else
      console.log(
        "[ProfilePic] ❌ Strategy 6:",
        docs.length,
        "admissions found but no pic",
      );
  }

  // ── Strategy 7: Users doc by uid ─────────────────────────────────────────
  if (studentDocId) {
    const snap = await safeGet(doc(db, "users", studentDocId), "users/uid");
    if (snap) {
      const pic = extractPicFromDoc(snap.data(), options);
      if (pic) {
        console.log("[ProfilePic] ✅ Strategy 7 (users by uid)");
        return pic;
      }
    }
  }

  // ── Strategy 8: Users query by email ─────────────────────────────────────
  if (email) {
    const docs = await safeQuery(
      query(collection(db, "users"), where("email", "==", email), limit(5)),
      "users by email",
    );
    for (const d of docs) {
      const pic = extractPicFromDoc(d.data(), options);
      if (pic) {
        console.log("[ProfilePic] ✅ Strategy 8 (users by email)");
        return pic;
      }
    }
  }

  // ── Strategy 9: hallTickets subcollection by admissionNumber ─────────────
  if (admissionNumbers.length) {
    const pic = await collectionGroupFirstPic(
      "students",
      ["admissionNumber", "admissionNo", "admission_number", "admission_no"],
      admissionNumbers,
      "Strategy 9 hallTickets by admission number",
      options,
    );
    if (pic) return pic;
  }

  // ── Strategy 10: hallTickets subcollection by studentId ──────────────────
  if (studentDocId) {
    const docs = await safeQuery(
      query(
        collectionGroup(db, "students"),
        where("studentId", "==", studentDocId),
        limit(10),
      ),
      "hallTickets collectionGroup by studentId",
    );
    for (const d of docs) {
      const pic = extractPicFromDoc(d.data(), options);
      if (pic) {
        console.log("[ProfilePic] ✅ Strategy 10 (hallTickets by studentId)");
        return pic;
      }
    }
  }

  // ── Strategy 11: examRegistrations by admissionNumber ────────────────────
  if (admissionNumbers.length) {
    const pic = await queryFirstPic(
      "examRegistrations",
      ["admissionNumber", "admissionNo", "admission_number", "admission_no"],
      admissionNumbers,
      "Strategy 11 examRegistrations by admission number",
      options,
    );
    if (pic) return pic;
  }

  // ── Strategy 12: examRegistrations by studentId ──────────────────────────
  if (studentDocId) {
    const docs = await safeQuery(
      query(
        collection(db, "examRegistrations"),
        where("studentId", "==", studentDocId),
        limit(10),
      ),
      "examRegistrations by studentId",
    );
    for (const d of docs) {
      const pic = extractPicFromDoc(d.data(), options);
      if (pic) {
        console.log(
          "[ProfilePic] ✅ Strategy 12 (examRegistrations by studentId)",
        );
        return pic;
      }
    }
  }

  // NOTE: A previous "Strategy 13/14" fallback here matched students by
  // full name (and a madarsa-wide bucket scan keyed partly on name) when no
  // photo could be found via any unique identifier. Full name is NOT unique
  // across students, so this silently attached a same-named student's photo
  // to the wrong record — and because callers persist whatever is resolved
  // here (resolveAndPersistProfilePicture), that wrong photo got baked
  // permanently into Firestore. Removed: every remaining strategy above is
  // keyed by a value that uniquely identifies one student (own doc id/uid,
  // own admissionId link, own globally-unique admissionNumber, own email,
  // own aadhar), so returning null below (genuinely no photo found) is
  // correct and must not be papered over with a guess.

  console.log("[ProfilePic] ❌ All strategies exhausted for", _name);
  return null;
}

export async function resolveAndPersistProfilePicture(
  studentData,
  options = {},
) {
  const studentDocId = studentData?.uid || studentData?.id;
  const profilePic = await resolveProfilePicture(
    {
      ...studentData,
      id: studentDocId,
      uid: studentData?.uid || studentDocId,
    },
    options,
  );

  if (!profilePic) return null;

  const updates = {
    profilePicture: profilePic,
    profilePictureUrl: profilePic,
  };

  if (studentDocId) {
    try {
      await updateDoc(doc(db, "students", studentDocId), updates);
    } catch (e) {
      console.warn(
        "[ProfilePic] Failed to patch students doc:",
        e?.message ?? e,
      );
    }
  }

  if (studentData?.admissionId) {
    try {
      await updateDoc(doc(db, "admissions", studentData.admissionId), updates);
    } catch (e) {
      console.warn(
        "[ProfilePic] Failed to patch admissions doc:",
        e?.message ?? e,
      );
    }
  }

  return profilePic;
}
