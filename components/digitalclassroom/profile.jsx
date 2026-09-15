"use client";
import {
  User,
  GraduationCap,
  
  ShieldCheck,
  Pencil,
  BookOpen,
  CheckCircle2,
  BarChart3,
  CalendarDays,

  Phone,
  Mail,
  MapPin,
  Users,
  Hash,
  Save,
  X,
} from "lucide-react";
import { useState } from "react";

function PersonalInformation({
  student,
  formData,
  editMode,
  handleChange,
  setEditMode,
  handleCancelEdit,
  handleSave,
}) {
  return (
    <div>

      {/* Header */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <User className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Personal Information
            </h2>

            <p className="text-xs text-slate-500">
              Your basic profile details
            </p>
          </div>

        </div>

        {!editMode ? (
          <button
            type="button"
            onClick={() =>
              setEditMode(true)
            }
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            <Pencil className="h-4 w-4" />
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">

            <button
              type="button"
              onClick={
                handleCancelEdit
              }
              className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="flex h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <Save className="h-4 w-4" />
              Save
            </button>

          </div>
        )}

      </div>

      {/* Fields */}

      <div className="mt-6 grid gap-5 md:grid-cols-2">

        <ProfileField
          label="Full Name"
          name="fullName"
          value={
            editMode
              ? formData.fullName
              : student.fullName
          }
          editable={editMode}
          onChange={
            handleChange
          }
          icon={User}
        />

        <ProfileField
          label="Date of Birth"
          value={
            student.dateOfBirth
          }
          icon={CalendarDays}
        />

        <ProfileField
          label="Email Address"
          value={student.email}
          icon={Mail}
        />

        <ProfileField
          label="Phone Number"
          name="phone"
          value={
            editMode
              ? formData.phone
              : student.phone
          }
          editable={editMode}
          onChange={
            handleChange
          }
          icon={Phone}
        />

        <ProfileField
          label="Gender"
          value={
            student.gender
          }
          icon={User}
        />

        <ProfileField
          label="Address"
          name="address"
          value={
            editMode
              ? formData.address
              : student.address
          }
          editable={editMode}
          onChange={
            handleChange
          }
          icon={MapPin}
        />

        <ProfileField
          label="Guardian Name"
          name="guardianName"
          value={
            editMode
              ? formData.guardianName
              : student.guardianName
          }
          editable={editMode}
          onChange={
            handleChange
          }
          icon={Users}
        />

        <ProfileField
          label="Guardian Phone"
          name="guardianPhone"
          value={
            editMode
              ? formData.guardianPhone
              : student.guardianPhone
          }
          editable={editMode}
          onChange={
            handleChange
          }
          icon={Phone}
        />

      </div>

      {/* Islamic message */}

      <div className="mt-6 flex gap-4 rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50 to-emerald-50 p-5">

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm">
          <BookOpen className="h-5 w-5" />
        </div>

        <div>
          <p className="font-semibold text-teal-900">
            May Allah make your journey
            of knowledge easy and blessed.
          </p>

          <p className="mt-1 text-sm text-teal-700">
            Stay consistent and keep
            learning.
          </p>
        </div>

      </div>

      {/* Stats */}

      <div className="mt-6 grid gap-4 md:grid-cols-3">

        <ProfileStat
          icon={BookOpen}
          value="5"
          label="Enrolled Courses"
          className="bg-blue-50 text-blue-700"
        />

        <ProfileStat
          icon={CheckCircle2}
          value="12"
          label="Classes Completed"
          className="bg-emerald-50 text-emerald-700"
        />

        <ProfileStat
          icon={BarChart3}
          value="85%"
          label="Overall Progress"
          className="bg-violet-50 text-violet-700"
        />

      </div>

    </div>
  );
}

/* =====================================
   ACADEMIC DETAILS
===================================== */

function AcademicDetails({
  student,
}) {
  return (
    <div>

      <div className="flex items-center gap-3">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
          <GraduationCap className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Academic Details
          </h2>

          <p className="text-xs text-slate-500">
            Digital Classroom enrollment
            information
          </p>
        </div>

      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">

        <InfoCard
          label="Digital Admission Number"
          value={
            student.digitalAdmissionNumber
          }
        />

        <InfoCard
          label="Current Class"
          value={
            student.applyingClass
          }
        />

        <InfoCard
          label="Account Type"
          value="Digital Classroom Student"
        />

        <InfoCard
          label="Account Status"
          value={
            student.accountStatus
          }
        />

      </div>

      <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/60 p-5">

        <div className="flex gap-4">

          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

          <div>
            <h3 className="font-semibold text-slate-900">
              Digital Madrasa
              Learning
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              Your courses, classes,
              assignments, exams and study
              materials are connected to
              your current Digital
              Classroom enrollment.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}

/* =====================================
   SETTINGS
===================================== */

function SettingsTab() {
  const [notifications, setNotifications] =
    useState(true);

  const [classReminder, setClassReminder] =
    useState(true);

  return (
    <div>

      <h2 className="text-lg font-bold text-slate-900">
        Profile Settings
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Manage your Digital Classroom
        preferences.
      </p>

      <div className="mt-6 space-y-4">

        <SettingRow
          title="Notifications"
          description="Receive Digital Classroom notifications."
          enabled={notifications}
          onChange={() =>
            setNotifications(
              !notifications
            )
          }
        />

        <SettingRow
          title="Class Reminders"
          description="Receive reminders before live classes."
          enabled={
            classReminder
          }
          onChange={() =>
            setClassReminder(
              !classReminder
            )
          }
        />

      </div>

    </div>
  );
}

/* =====================================
   SECURITY
===================================== */

function SecurityTab({ email }) {
  return (
    <div>

      <div className="flex items-center gap-3">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
          <ShieldCheck className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Account Security
          </h2>

          <p className="text-xs text-slate-500">
            Your login and account
            information.
          </p>
        </div>

      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">

        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Login Email
        </p>

        <p className="mt-2 font-semibold text-slate-800">
          {email ||
            "Not available"}
        </p>

      </div>

      <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-5">
  <p className="font-semibold text-slate-900">
    Password Changes
  </p>

  <p className="mt-1 text-sm leading-6 text-slate-600">
    Contact Digital Classroom administration if you need to
    reset your login password.
  </p>

  <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3">
    <Phone className="h-4 w-4 text-teal-700" />

    <div>
      <p className="text-xs text-slate-500">
        Administration Contact
      </p>

      <a
        href="tel:8891177850"
        className="text-sm font-bold text-teal-700 hover:text-teal-900"
      >
        8891177850
      </a>
    </div>
  </div>
</div>

    </div>
  );
}

/* =====================================
   PROFILE FIELD
===================================== */

function ProfileField({
  label,
  name,
  value,
  editable = false,
  onChange,
  icon: Icon,
}) {
  return (
    <div>

      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <div className="relative">

        <Icon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          name={name}
          value={value || ""}
          onChange={onChange}
          readOnly={!editable}
          placeholder={
            value
              ? ""
              : "Not available"
          }
          className={`h-12 w-full rounded-xl border pl-11 pr-4 text-sm outline-none transition ${
            editable
              ? "border-teal-300 bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        />

      </div>

    </div>
  );
}

/* =====================================
   LEFT META
===================================== */

function ProfileMeta({
  icon: Icon,
  label,
  value,
  status = false,
}) {
  return (
    <div className="flex items-center gap-3">

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">

        <p className="text-xs text-slate-400">
          {label}
        </p>

        <div className="mt-0.5 flex items-center gap-2">

          {status && (
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                value === "active"
                  ? "bg-emerald-500"
                  : value ===
                    "suspended"
                  ? "bg-red-500"
                  : "bg-amber-500"
              }`}
            />
          )}

          <p className="truncate text-sm font-semibold capitalize text-slate-700">
            {value ||
              "Not available"}
          </p>

        </div>

      </div>

    </div>
  );
}

/* =====================================
   TAB
===================================== */

function ProfileTab({
  active,
  icon: Icon,
  label,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-[160px] flex-1 items-center justify-center gap-2 border-b-2 px-5 py-4 text-sm font-semibold transition ${
        active
          ? "border-teal-600 bg-teal-50 text-teal-800"
          : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

/* =====================================
   PROFILE STAT
===================================== */

function ProfileStat({
  icon: Icon,
  value,
  label,
  className,
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">

      <div className="flex items-center gap-3">

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${className}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <p className="text-xl font-bold text-slate-900">
            {value}
          </p>

          <p className="text-xs text-slate-500">
            {label}
          </p>
        </div>

      </div>

    </div>
  );
}

/* =====================================
   ACADEMIC INFO CARD
===================================== */

function InfoCard({
  label,
  value,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">

      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 font-bold capitalize text-slate-800">
        {value ||
          "Not available"}
      </p>

    </div>
  );
}

/* =====================================
   SETTING ROW
===================================== */

function SettingRow({
  title,
  description,
  enabled,
  onChange,
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-5">

      <div className="pr-5">

        <h3 className="font-semibold text-slate-900">
          {title}
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>

      </div>

      <button
        type="button"
        onClick={onChange}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          enabled
            ? "bg-teal-600"
            : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
            enabled
              ? "left-6"
              : "left-1"
          }`}
        />
      </button>

    </div>
  );
}
export { ProfileTab, ProfileStat, InfoCard, SettingRow, ProfileMeta, ProfileField, PersonalInformation, AcademicDetails, SettingsTab, SecurityTab };