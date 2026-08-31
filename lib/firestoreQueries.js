import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getCountFromServer,
  or,
  and,
  getAggregateFromServer,
  sum,
  count,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Helper: check if a registration matches the class filter client-side.
 * Covers both "classLevel" and "class" fields, and handles string/number variants.
 */
const matchesClassFilter = (registration, classLevel) => {
  if (!classLevel || classLevel === "all") return true;
  const classNum = parseInt(classLevel);
  const variants = [String(classLevel)];
  if (!isNaN(classNum)) variants.push(String(classNum));

  const regClass =
    registration.classLevel !== undefined
      ? registration.classLevel
      : registration.class;
  return variants.includes(String(regClass));
};

/**
 * Build server-side Firestore query.
 * NOTE: classLevel is intentionally excluded here — it's handled client-side
 * to avoid composite index requirements (or() on two fields needs special indexes).
 */
export const buildRegistrationQuery = (
  filters = {},
  pageSize = 20,
  lastDoc = null,
) => {
  const {
    examId,
    mekhalaId,
    districtName,
    madrasaId,
    gender,
    paymentStatus = ["completed", "waived"],
  } = filters;

  const regRef = collection(db, "examRegistrations");

  const filterConstraints = [
    where(
      "paymentStatus",
      "in",
      Array.isArray(paymentStatus) ? paymentStatus : [paymentStatus],
    ),
  ];

  if (examId && examId !== "all") {
    filterConstraints.push(where("examId", "==", examId));
  }

  if (madrasaId && madrasaId !== "all") {
    filterConstraints.push(where("madarsaId", "==", madrasaId));
  }

  const paginationConstraints = [orderBy("createdAt", "desc"), limit(pageSize)];
  if (lastDoc) paginationConstraints.push(startAfter(lastDoc));

  return query(regRef, ...filterConstraints, ...paginationConstraints);
};

/**
 * Fetch registrations with filtering.
 * - When classLevel is active: fetches a large server batch (no class in query),
 *   filters client-side, then paginates manually using filters._page.
 * - When no classLevel: normal cursor-based server pagination.
 */
export const fetchFilteredRegistrations = async (
  filters,
  pageSize = 20,
  lastDoc = null,
) => {
  const { classLevel } = filters;

  if (classLevel && classLevel !== "all") {
    // Class filter active — fetch large batch, filter + paginate client-side
    const {
      examId,
      madrasaId,
      paymentStatus = ["completed", "waived"],
    } = filters;

    const regRef = collection(db, "examRegistrations");
    const filterConstraints = [
      where(
        "paymentStatus",
        "in",
        Array.isArray(paymentStatus) ? paymentStatus : [paymentStatus],
      ),
    ];
    if (examId && examId !== "all") {
      filterConstraints.push(where("examId", "==", examId));
    }
    if (madrasaId && madrasaId !== "all") {
      filterConstraints.push(where("madarsaId", "==", madrasaId));
    }

    const q = query(
      regRef,
      ...filterConstraints,
      orderBy("createdAt", "desc"),
      limit(2000),
    );
    const snapshot = await getDocs(q);
    const all = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Client-side class filter
    const filtered = all.filter((r) => matchesClassFilter(r, classLevel));

    // Manual pagination using page number passed via filters._page
    const page = filters._page || 1;
    const start = (page - 1) * pageSize;
    const paginated = filtered.slice(start, start + pageSize);

    return {
      registrations: paginated,
      lastVisible: null,
      _totalFiltered: filtered.length,
    };
  }

  // No class filter — normal cursor-based server pagination
  const q = buildRegistrationQuery(filters, pageSize, lastDoc);
  const snapshot = await getDocs(q);

  const registrations = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const lastVisible =
    snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

  return { registrations, lastVisible };
};

/**
 * Fetch ALL filtered registrations (without pagination) for bulk operations
 */
export const fetchAllFilteredRegistrations = async (filters) => {
  const {
    examId,
    classLevel,
    madrasaId,
    paymentStatus = ["completed", "waived"],
  } = filters;

  const regRef = collection(db, "examRegistrations");

  const filterConstraints = [
    where(
      "paymentStatus",
      "in",
      Array.isArray(paymentStatus) ? paymentStatus : [paymentStatus],
    ),
  ];

  if (examId && examId !== "all") {
    filterConstraints.push(where("examId", "==", examId));
  }

  if (madrasaId && madrasaId !== "all") {
    filterConstraints.push(where("madarsaId", "==", madrasaId));
  }

  const q = query(regRef, ...filterConstraints, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  const all = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Client-side class filter
  return classLevel && classLevel !== "all"
    ? all.filter((r) => matchesClassFilter(r, classLevel))
    : all;
};

/**
 * Search registrations by name/email/admission number across entire dataset.
 * Class filter is applied client-side after fetching.
 */
export const searchRegistrations = async (searchTerm, filters = {}) => {
  if (!searchTerm || searchTerm.trim() === "") {
    return { registrations: [], total: 0 };
  }

  const {
    examId,
    classLevel,
    madrasaId,
    paymentStatus = ["completed", "waived"],
  } = filters;

  const regRef = collection(db, "examRegistrations");
  const term = searchTerm.trim();
  const termLower = term.toLowerCase();

  // Server-side filter constraints (no class — done client-side)
  const filterConstraints = [
    where(
      "paymentStatus",
      "in",
      Array.isArray(paymentStatus) ? paymentStatus : [paymentStatus],
    ),
  ];

  if (examId && examId !== "all") {
    filterConstraints.push(where("examId", "==", examId));
  }
  if (madrasaId && madrasaId !== "all") {
    filterConstraints.push(where("madarsaId", "==", madrasaId));
  }

  try {
    const q = query(
      regRef,
      ...filterConstraints,
      orderBy("createdAt", "desc"),
      limit(1000),
    );

    const snapshot = await getDocs(q);

    const results = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((data) => matchesClassFilter(data, classLevel))
      .filter((data) => {
        const nameMatch = data.studentName?.toLowerCase().includes(termLower);
        const admissionMatch = data.admissionNumber
          ?.toString()
          .toLowerCase()
          .includes(termLower);
        const emailMatch = data.studentEmail?.toLowerCase().includes(termLower);
        const hallTicketMatch = data.hallTicketNumber
          ?.toLowerCase()
          .includes(termLower);

        return nameMatch || admissionMatch || emailMatch || hallTicketMatch;
      });

    return {
      registrations: results,
      total: results.length,
    };
  } catch (error) {
    console.warn("Search failed, falling back to limited fetch:", error);
    return await fallbackClientSideSearch(
      regRef,
      filterConstraints,
      term,
      classLevel,
    );
  }
};

const fallbackClientSideSearch = async (
  collectionRef,
  constraints,
  term,
  classLevel,
) => {
  const q = query(
    collectionRef,
    ...constraints,
    orderBy("createdAt", "desc"),
    limit(500),
  );
  const snap = await getDocs(q);
  const termLower = term.toLowerCase();

  const results = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((data) => matchesClassFilter(data, classLevel))
    .filter(
      (data) =>
        data.studentName?.toLowerCase().includes(termLower) ||
        data.admissionNumber?.toString().includes(termLower) ||
        data.studentEmail?.toLowerCase().includes(termLower) ||
        data.hallTicketNumber?.toLowerCase().includes(termLower),
    );

  return { registrations: results, total: results.length };
};

/**
 * Search students collection by name, admission number, etc.
 */
export const searchStudents = async (searchTerm, filters = {}) => {
  if (!searchTerm || searchTerm.trim() === "") return [];

  const { madarsaId, classLevel, gender } = filters;
  const studentsRef = collection(db, "students");
  const term = searchTerm.trim();
  const termLower = term.toLowerCase();

  const baseConstraints = [where("status", "==", "active")];
  if (madarsaId && madarsaId !== "all")
    baseConstraints.push(where("madarsaId", "==", madarsaId));
  if (classLevel && classLevel !== "all")
    baseConstraints.push(where("classLevel", "==", classLevel));
  if (gender && gender !== "all")
    baseConstraints.push(where("gender", "==", gender));

  try {
    const queries = [];

    // 1. Name Prefix
    queries.push(
      getDocs(
        query(
          studentsRef,
          ...baseConstraints,
          where("fullName", ">=", term),
          where("fullName", "<=", term + "\uf8ff"),
          limit(50),
        ),
      ),
    );

    // 2. Admission Number Prefix
    queries.push(
      getDocs(
        query(
          studentsRef,
          ...baseConstraints,
          where("admissionNumber", ">=", term),
          where("admissionNumber", "<=", term + "\uf8ff"),
          limit(50),
        ),
      ),
    );

    // 3. Email Exact
    queries.push(
      getDocs(
        query(
          studentsRef,
          ...baseConstraints,
          where("email", "==", termLower),
          limit(20),
        ),
      ),
    );

    const snapshots = await Promise.all(queries);
    const resultsMap = new Map();
    snapshots.forEach((snap) => {
      snap.docs.forEach((doc) => {
        resultsMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
    });

    return Array.from(resultsMap.values());
  } catch (error) {
    console.warn("Student search failed, using fallback:", error);
    const q = query(studentsRef, ...baseConstraints, limit(500));
    const snap = await getDocs(q);
    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(
        (s) =>
          s.fullName?.toLowerCase().includes(termLower) ||
          s.admissionNumber?.toString().includes(termLower) ||
          s.email?.toLowerCase().includes(termLower),
      );
  }
};

/**
 * Get total count using server-side aggregation.
 * When classLevel is active, fetches all matching docs and counts client-side.
 */
export const getRegistrationsCount = async (filters = {}) => {
  const {
    examId,
    classLevel,
    madarsaId,
    paymentStatus = ["completed", "waived"],
  } = filters;
  const regRef = collection(db, "examRegistrations");

  const filterConstraints = [
    where(
      "paymentStatus",
      "in",
      Array.isArray(paymentStatus) ? paymentStatus : [paymentStatus],
    ),
  ];

  if (examId && examId !== "all") {
    filterConstraints.push(where("examId", "==", examId));
  }

  if (madarsaId && madarsaId !== "all") {
    filterConstraints.push(where("madarsaId", "==", madarsaId));
  }

  // When class filter is active, we can't use getCountFromServer (no index)
  // so fetch docs and count client-side
  if (classLevel && classLevel !== "all") {
    const q = query(
      regRef,
      ...filterConstraints,
      orderBy("createdAt", "desc"),
      limit(2000),
    );
    const snapshot = await getDocs(q);
    const all = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return all.filter((r) => matchesClassFilter(r, classLevel)).length;
  }

  const q = query(regRef, ...filterConstraints);
  const countSnap = await getCountFromServer(q);
  return countSnap.data().count;
};

/**
 * Fetch students by IDs (for current page only)
 */
export const fetchStudentsByIds = async (studentIds) => {
  if (!studentIds || studentIds.length === 0) return [];

  const studentsRef = collection(db, "students");
  const batchSize = 10; // Firestore 'in' query limit
  const students = [];

  for (let i = 0; i < studentIds.length; i += batchSize) {
    const batchIds = studentIds.slice(i, i + batchSize);
    const q = query(studentsRef, where("__name__", "in", batchIds));
    const snapshot = await getDocs(q);

    snapshot.docs.forEach((doc) => {
      students.push({ id: doc.id, ...doc.data() });
    });
  }

  return students;
};

/**
 * Fetch metadata (madrasas & mekhalas) - cache these
 */
export const fetchMetadata = async () => {
  const [madrasasSnap, mekhalasSnap] = await Promise.all([
    getDocs(query(collection(db, "madarsas"), orderBy("name", "asc"))),
    getDocs(query(collection(db, "mekhala"), orderBy("name", "asc"))),
  ]);

  const madrasas = madrasasSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  const mekhalas = mekhalasSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Create Maps for O(1) lookup
  // IMPORTANT: Use madarsaId as key since that's what students reference (e.g., "mid-656")
  const madrasaMap = new Map(madrasas.map((m) => [m.madarsaId, m]));
  const mekhalaMap = new Map(mekhalas.map((mk) => [mk.id, mk]));

  return { madrasas, mekhalas, madrasaMap, mekhalaMap };
};

/**
 * Get aggregated dashboard stats for convener
 */
export const getConvenerDashboardStats = async () => {
  const regRef = collection(db, "examRegistrations");

  // Base query: Include all valid registrations (completed, waived, paid)
  // Also check 'status' field as a fallback for some records
  const baseQ = query(
    regRef,
    or(
      where("paymentStatus", "in", [
        "completed",
        "waived",
        "paid",
        "Completed",
        "Waived",
        "Paid",
      ]),
      where("status", "in", [
        "registered",
        "Registered",
        "completed",
        "Completed",
      ]),
    ),
  );

  // Revenue query: ONLY completed or paid (exclude waived)
  const revenueQ = query(
    regRef,
    or(
      where("paymentStatus", "in", ["completed", "paid", "Completed", "Paid"]),
      where("status", "in", ["completed", "Completed"]),
    ),
  );

  // Aggregate stats
  const [baseSnap, revenueSnap] = await Promise.all([
    getAggregateFromServer(baseQ, { totalCount: count() }),
    getAggregateFromServer(revenueQ, { totalRevenue: sum("examFees") }),
  ]);

  const totalCount = baseSnap.data().totalCount || 0;
  const totalRevenue = revenueSnap.data().totalRevenue || 0;

  // Get gender counts as subset of baseQ
  const maleQ = query(
    regRef,
    and(
      or(
        where("paymentStatus", "in", [
          "completed",
          "waived",
          "paid",
          "Completed",
          "Waived",
          "Paid",
        ]),
        where("status", "in", [
          "registered",
          "Registered",
          "completed",
          "Completed",
        ]),
      ),
      or(
        where("gender", "==", "male"),
        where("hallTicket.gender", "==", "male"),
      ),
    ),
  );

  const femaleQ = query(
    regRef,
    and(
      or(
        where("paymentStatus", "in", [
          "completed",
          "waived",
          "paid",
          "Completed",
          "Waived",
          "Paid",
        ]),
        where("status", "in", [
          "registered",
          "Registered",
          "completed",
          "Completed",
        ]),
      ),
      or(
        where("gender", "==", "female"),
        where("hallTicket.gender", "==", "female"),
      ),
    ),
  );

  const [maleSnap, femaleSnap] = await Promise.all([
    getCountFromServer(maleQ),
    getCountFromServer(femaleQ),
  ]);

  return {
    totalRegistrations: totalCount,
    totalRevenue: totalRevenue,
    maleStudents: maleSnap.data().count || 0,
    femaleStudents: femaleSnap.data().count || 0,
  };
};
