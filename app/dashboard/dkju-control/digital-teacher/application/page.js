"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import {
  getDigitalTeachers,
  approveDigitalTeacher,
  rejectDigitalTeacher,
} from "@/lib/digitalClassTeacherService";

import {
  Users,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Mail,
  GraduationCap,
  BookOpen,
  Languages,
  User,
  Phone,
  Building2,
  Landmark,
  ShieldCheck,
  Loader2,
 
} from "lucide-react";
import {
StatCard,
  StatusBadge,
  Modal,
  InfoSection,
  InfoField,
  SectionHeading,
  AssignmentSection} from "@/components/digitalclassroom/application";


const CLASS_OPTIONS = [
  "LKG",
  "UKG",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
];

const SUBJECT_OPTIONS = [
  "Quran",
  "Arabic",
  "Islamic Studies",
  "Fiqh",
  "Aqeedah",
  "Hadees",
  "Seerah",
  "Dua",
];

const LANGUAGE_OPTIONS = [
  "Malayalam",
  "Arabic",
  "English",
];

export default function DigitalTeacherApplicationsPage() {
  const [teachers, setTeachers] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("pending");

  const [selectedTeacher, setSelectedTeacher] =
    useState(null);

  const [detailsOpen, setDetailsOpen] =
    useState(false);

  const [approveOpen, setApproveOpen] =
    useState(false);

  const [message, setMessage] =
    useState("");

const [approvalForm, setApprovalForm] =
  useState({
    assignedClasses: [],
    assignedSubjects: [],
    languages: [],
  });
  

const [approveLoading, setApproveLoading] =
  useState(false);
const [rejectOpen, setRejectOpen] =
  useState(false);

const [rejectLoading, setRejectLoading] =
  useState(false);

const [rejectionReason, setRejectionReason] =
  useState("");
  /* ============================================
     LOAD APPLICATIONS
  ============================================ */

  const loadTeachers = async () => {
    try {
      setLoading(true);
      setMessage("");

      const result =
        await getDigitalTeachers();

      const list = Array.isArray(result)
        ? result
        : result?.teachers ||
          result?.data ||
          result?.applications ||
          [];

      setTeachers(list);
    } catch (error) {
      console.error(
        "LOAD DIGITAL TEACHERS ERROR:",
        error,
      );

      setMessage(
        error?.message ||
          "Unable to load Digital Teacher applications.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  /* ============================================
     FILTER
  ============================================ */

  const filteredTeachers =
    useMemo(() => {
      const keyword =
        search.trim().toLowerCase();

      return teachers.filter((teacher) => {
        const statusMatch =
          statusFilter === "all" ||
          teacher.status === statusFilter;

        if (!statusMatch) {
          return false;
        }

        if (!keyword) {
          return true;
        }

        const text = [
          teacher.fullName,
          teacher.mhrId,
          teacher.email,
          teacher.phone,
          teacher.madarsaName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(keyword);
      });
    }, [
      teachers,
      search,
      statusFilter,
    ]);

  /* ============================================
     COUNTS
  ============================================ */

  const pendingCount =
    teachers.filter(
      (item) => item.status === "pending",
    ).length;

  const approvedCount =
    teachers.filter(
      (item) => item.status === "approved",
    ).length;

  const rejectedCount =
    teachers.filter(
      (item) => item.status === "rejected",
    ).length;

 

  const openApprove = (teacher) => {
  setSelectedTeacher(teacher);

  setApprovalForm({
    assignedClasses: [],
    assignedSubjects: [],
    languages: [],
  });

  setMessage("");

  setApproveOpen(true);
};

  /* ============================================
     TOGGLE ARRAY VALUE
  ============================================ */

  const toggleValue = (
    field,
    value,
  ) => {
    setApprovalForm((prev) => {
      const current =
        prev[field] || [];

      const exists =
        current.includes(value);

      return {
        ...prev,

        [field]: exists
          ? current.filter(
              (item) =>
                item !== value,
            )
          : [
              ...current,
              value,
            ],
      };
    });
  };

  /* ============================================
     FRONTEND APPROVAL VALIDATION
  ============================================ */

  const handleApproveTeacher =
  async () => {
    if (
      !selectedTeacher?.id
    ) {
      setMessage(
        "Digital Teacher application not found.",
      );

      return;
    }

    if (!selectedTeacher?.id) {
  setMessage(
    "Digital Teacher application not found.",
  );

  return;
}

    if (
      approvalForm
        .assignedClasses
        .length === 0
    ) {
      setMessage(
        "Please assign at least one class.",
      );

      return;
    }

    if (
      approvalForm
        .assignedSubjects
        .length === 0
    ) {
      setMessage(
        "Please assign at least one subject.",
      );

      return;
    }

    if (
      approvalForm.languages
        .length === 0
    ) {
      setMessage(
        "Please select at least one teaching medium.",
      );

      return;
    }

    setApproveLoading(true);
    setMessage("");

    try {
      const result =
  await approveDigitalTeacher(
    selectedTeacher.id,
    {
      assignedClasses:
        approvalForm
          .assignedClasses,

      assignedSubjects:
        approvalForm
          .assignedSubjects,

      languages:
        approvalForm
          .languages,
    },
  );

      console.log(
        "DIGITAL TEACHER APPROVED:",
        result,
      );

      setMessage(
        "Digital Teacher approved successfully.",
      );

      setApproveOpen(false);

      setSelectedTeacher(
        null,
      );

      await loadTeachers();
    } catch (error) {
      console.error(
        "APPROVE DIGITAL TEACHER ERROR:",
        error,
      );

      setMessage(
        error?.message ||
          "Unable to approve Digital Teacher.",
      );
    } finally {
      setApproveLoading(
        false,
      );
    }
  };
  const handleRejectTeacher =
  async () => {
    if (!selectedTeacher?.id) {
      setMessage(
        "Digital Teacher application not found.",
      );

      return;
    }

    if (
      !rejectionReason.trim()
    ) {
      setMessage(
        "Please enter a rejection reason.",
      );

      return;
    }

    setRejectLoading(true);
    setMessage("");

    try {
      const result =
        await rejectDigitalTeacher(
          selectedTeacher.id,
          {
            reason:
              rejectionReason.trim(),
          },
        );

      console.log(
        "DIGITAL TEACHER REJECTED:",
        result,
      );

      setMessage(
        "Digital Teacher application rejected successfully.",
      );

      setRejectOpen(false);

      setRejectionReason("");

      setSelectedTeacher(null);

      await loadTeachers();
    } catch (error) {
      console.error(
        "REJECT DIGITAL TEACHER ERROR:",
        error,
      );

      setMessage(
        error?.message ||
          "Unable to reject Digital Teacher application.",
      );
    } finally {
      setRejectLoading(false);
    }
  };

  return (
    <Layout>
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">

        <div className="mx-auto max-w-7xl space-y-6">

          {/* =========================
              HEADER
          ========================== */}

          <div>
            <p className="text-sm font-semibold text-teal-700">
              Digital Classroom
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Digital Teacher Applications
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Review Digital Teacher applications,
              verify qualifications and approve
              teacher accounts.
            </p>
          </div>

          {/* =========================
              STATS
          ========================== */}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <StatCard
              icon={Users}
              title="Total Applications"
              value={teachers.length}
            />

            <StatCard
              icon={ShieldCheck}
              title="Pending Review"
              value={pendingCount}
            />

            <StatCard
              icon={CheckCircle2}
              title="Approved"
              value={approvedCount}
            />

            <StatCard
              icon={XCircle}
              title="Rejected"
              value={rejectedCount}
            />

          </div>

          {/* =========================
              FILTERS
          ========================== */}

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex flex-col gap-4 md:flex-row md:items-center">

              <div className="relative flex-1">

                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value,
                    )
                  }
                  placeholder="Search teacher, MHR ID, phone or madrasa..."
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none focus:border-teal-500 focus:bg-white"
                />

              </div>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value,
                  )
                }
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none"
              >
                <option value="all">
                  All Applications
                </option>

                <option value="pending">
                  Pending
                </option>

                <option value="approved">
                  Approved
                </option>

                <option value="rejected">
                  Rejected
                </option>
              </select>

            </div>

          </div>

          {/* =========================
              MESSAGE
          ========================== */}

          {message && (
            <div className="rounded-2xl border border-teal-100 bg-teal-50 px-5 py-4 text-sm font-medium text-teal-800">
              {message}
            </div>
          )}

          {/* =========================
              APPLICATION TABLE
          ========================== */}

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center">

                <Loader2 className="h-7 w-7 animate-spin text-teal-700" />

              </div>
            ) : filteredTeachers.length ===
              0 ? (
              <div className="p-12 text-center">

                <Users className="mx-auto h-10 w-10 text-slate-300" />

                <p className="mt-4 font-semibold text-slate-700">
                  No Digital Teacher applications found.
                </p>

              </div>
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead className="bg-slate-50">

                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">

                      <th className="px-5 py-4">
                        Teacher
                      </th>

                      <th className="px-5 py-4">
                        MHR ID
                      </th>

                      <th className="px-5 py-4">
                        Madrasa
                      </th>

                      <th className="px-5 py-4">
                        Status
                      </th>

                      <th className="px-5 py-4 text-right">
                        Action
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {filteredTeachers.map(
                      (teacher) => (
                        <tr
                          key={teacher.id}
                          className="hover:bg-slate-50/70"
                        >

                          <td className="px-5 py-4">

                            <div>
                              <p className="font-semibold text-slate-900">
                                {teacher.fullName ||
                                  "Teacher"}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {teacher.phone ||
                                  teacher.email ||
                                  "-"}
                              </p>
                            </div>

                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {teacher.mhrId ||
                              "-"}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {teacher.madarsaName ||
                              "-"}
                          </td>

                          <td className="px-5 py-4">

                            <StatusBadge
                              status={
                                teacher.status
                              }
                            />

                          </td>

                          <td className="px-5 py-4">

                            <div className="flex justify-end gap-2">

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTeacher(
                                    teacher,
                                  );

                                  setDetailsOpen(
                                    true,
                                  );
                                }}
                                className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </button>

                              {teacher.status === "pending" && (
  <>
    <button
      type="button"
      onClick={() =>
        openApprove(teacher)
      }
      className="flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
    >
      <CheckCircle2 className="h-4 w-4" />
      Approve
    </button>

    <button
      type="button"
      onClick={() => {
        setSelectedTeacher(
          teacher,
        );

        setRejectionReason("");

        setRejectOpen(true);
      }}
      className="flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
    >
      <XCircle className="h-4 w-4" />
      Reject
    </button>
  </>
)}

                            </div>

                          </td>

                        </tr>
                      ),
                    )}

                  </tbody>

                </table>

              </div>
            )}

          </div>

        </div>

        {/* ===================================
            DETAILS DIALOG
        ==================================== */}

        {detailsOpen &&
          selectedTeacher && (
            <Modal
              title="Digital Teacher Application"
              onClose={() =>
                setDetailsOpen(false)
              }
            >

              <div className="space-y-6">

                <InfoSection
                  title="Teacher Information"
                >

                  <InfoField
                    icon={User}
                    label="Full Name"
                    value={
                      selectedTeacher.fullName
                    }
                  />

                  <InfoField
                    icon={Phone}
                    label="Phone"
                    value={
                      selectedTeacher.phone
                    }
                  />

                  <InfoField
                    icon={Mail}
                    label="Email"
                    value={
                      selectedTeacher.email
                    }
                  />

                  <InfoField
                    icon={Building2}
                    label="Madrasa"
                    value={
                      selectedTeacher.madarsaName
                    }
                  />

                </InfoSection>

                <InfoSection
                  title="General Education"
                >

                  <InfoField
                    icon={GraduationCap}
                    label="Qualification"
                    value={
                      selectedTeacher
                        ?.qualification
                        ?.generalEducation
                        ?.highestQualification
                    }
                  />

                  <InfoField
                    icon={BookOpen}
                    label="Course"
                    value={
                      selectedTeacher
                        ?.qualification
                        ?.generalEducation
                        ?.courseName
                    }
                  />

                  <InfoField
                    icon={Building2}
                    label="Institution"
                    value={
                      selectedTeacher
                        ?.qualification
                        ?.generalEducation
                        ?.institution
                    }
                  />

                </InfoSection>
                <InfoSection
                  title="Computer Knowledge"
                >
<InfoField
                    icon={GraduationCap}
                    label="Level of computer knowledge"
                    value={
                      selectedTeacher
                        ?.qualification
                        ?.computerKnowledge
                        ?.level
                    }
                  />
<InfoField
                    icon={GraduationCap}
                    label="Other details"
                    value={
                      selectedTeacher
                        ?.qualification
                        ?.computerKnowledge
                        ?.otherDetails
                    }
                  />

                </InfoSection>

                <InfoSection
                  title="Islamic Academic Qualification"
                >

                  <InfoField
                    icon={GraduationCap}
                    label="Qualification"
                    value={
                      selectedTeacher
                        ?.qualification
                        ?.islamicEducation
                        ?.highestQualification
                    }
                  />

                  <InfoField
                    icon={BookOpen}
                    label="Course"
                    value={
                      selectedTeacher
                        ?.qualification
                        ?.islamicEducation
                        ?.courseName
                    }
                  />

                  <InfoField
                    icon={ShieldCheck}
                    label="Quran Qualification"
                    value={
                      selectedTeacher
                        ?.qualification
                        ?.islamicEducation
                        ?.quranQualification
                    }
                  />

                  <InfoField
                    icon={GraduationCap}
                    label="Teaching Experience"
                    value={
                      selectedTeacher
                        ?.qualification
                        ?.islamicEducation
                        ?.teachingExperience
                    }
                  />

                </InfoSection>

                <InfoSection
                  title="Bank Details"
                >

                  <InfoField
                    icon={Landmark}
                    label="Account Holder"
                    value={
                      selectedTeacher
                        ?.bankDetails
                        ?.accountHolderName
                    }
                  />

                  <InfoField
                    icon={Landmark}
                    label="Bank"
                    value={
                      selectedTeacher
                        ?.bankDetails
                        ?.bankName
                    }
                  />

                  <InfoField
                    icon={Landmark}
                    label="Account Number"
                    value={
                      selectedTeacher
                        ?.bankDetails
                        ?.accountNumber
                    }
                  />

                  <InfoField
                    icon={Landmark}
                    label="IFSC"
                    value={
                      selectedTeacher
                        ?.bankDetails
                        ?.ifscCode
                    }
                  />
                  <InfoField
                    icon={Landmark}
                    label="UPI id"
                    value={
                      selectedTeacher
                        ?.bankDetails
                        ?.upiId
                    }
                  />

                </InfoSection>

                {selectedTeacher.status ===
                  "pending" && (
                  <div className="flex justify-end">

                    <button
                      type="button"
                      onClick={() => {
                        setDetailsOpen(
                          false,
                        );

                        openApprove(
                          selectedTeacher,
                        );
                      }}
                      className="rounded-xl bg-teal-700 px-6 py-3 text-sm font-bold text-white hover:bg-teal-800"
                    >
                      Continue to Approval
                    </button>

                  </div>
                )}

              </div>

            </Modal>
          )}

        {/* ===================================
            APPROVAL DIALOG
        ==================================== */}

        {approveOpen &&
          selectedTeacher && (
            <Modal
              title="Approve Digital Teacher"
              onClose={() =>
                setApproveOpen(false)
              }
              wide
            >

              <div className="space-y-7">

                
                {/* CLASSES */}

                <AssignmentSection
                  icon={GraduationCap}
                  title="Classes"
                  options={CLASS_OPTIONS}
                  selected={
                    approvalForm.assignedClasses
                  }
                  onToggle={(value) =>
                    toggleValue(
                      "assignedClasses",
                      value,
                    )
                  }
                />

                {/* SUBJECTS */}

                <AssignmentSection
                  icon={BookOpen}
                  title="Subjects"
                  options={SUBJECT_OPTIONS}
                  selected={
                    approvalForm.assignedSubjects
                  }
                  onToggle={(value) =>
                    toggleValue(
                      "assignedSubjects",
                      value,
                    )
                  }
                />

                {/* LANGUAGE */}

                <AssignmentSection
                  icon={Languages}
                  title="Teaching Language / Medium"
                  options={
                    LANGUAGE_OPTIONS
                  }
                  selected={
                    approvalForm.languages
                  }
                  onToggle={(value) =>
                    toggleValue(
                      "languages",
                      value,
                    )
                  }
                />

                {/* BUTTONS */}

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">

                  <button
                    type="button"
                    onClick={() =>
                      setApproveOpen(false)
                    }
                    className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700"
                  >
                    Cancel
                  </button>

                  <button
  type="button"
  onClick={
    handleApproveTeacher
  }
  disabled={
    approveLoading
  }
  className="flex h-11 items-center gap-2 rounded-xl bg-teal-700 px-6 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
>
  {approveLoading ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      Approving...
    </>
  ) : (
    <>
      <CheckCircle2 className="h-4 w-4" />
      Approve Teacher
    </>
  )}
</button>

                </div>

              </div>

            </Modal>
          )}

      </main>
      {rejectOpen &&
  selectedTeacher && (
    <Modal
      title="Reject Digital Teacher Application"
      onClose={() => {
        if (rejectLoading) return;

        setRejectOpen(false);
        setRejectionReason("");
      }}
    >
      <div className="space-y-6">

        <div className="rounded-2xl border border-red-100 bg-red-50 p-5">

          <div className="flex gap-3">

            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <div>
              <p className="font-bold text-red-900">
                Reject Application
              </p>

              <p className="mt-1 text-sm leading-6 text-red-700">
                You are rejecting the Digital Teacher
                application of{" "}
                <span className="font-bold">
                  {selectedTeacher.fullName}
                </span>
                .
              </p>
            </div>

          </div>

        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Rejection Reason
            <span className="ml-1 text-red-500">
              *
            </span>
          </label>

          <textarea
            value={rejectionReason}
            onChange={(e) =>
              setRejectionReason(
                e.target.value,
              )
            }
            rows={5}
            placeholder="Enter the reason for rejecting this application..."
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-500/10"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">

          <button
            type="button"
            disabled={rejectLoading}
            onClick={() => {
              setRejectOpen(false);
              setRejectionReason("");
            }}
            className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={rejectLoading}
            onClick={
              handleRejectTeacher
            }
            className="flex h-11 items-center gap-2 rounded-xl bg-red-600 px-6 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rejectLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Rejecting...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Confirm Rejection
              </>
            )}
          </button>

        </div>

      </div>
    </Modal>
  )}
    </Layout>
  );
}



