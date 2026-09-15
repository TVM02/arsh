"use client";

import { useMemo, useState } from "react";
import {
  User,
  GraduationCap,
  Settings,
  ShieldCheck,
  
  CheckCircle2,
  
  BadgeCheck,
  
  Hash,
  
} from "lucide-react";
import {
  ProfileTab,
  ProfileMeta,
  PersonalInformation,
  AcademicDetails,
  SettingsTab,
  SecurityTab
} from "@/components/digitalclassroom/profile";

import useAuthStore from "@/lib/authStore";
import Layout from "@/components/digitalclassroom/Layout";

export default function DigitalStudentProfilePage() {
  const { userData, user } = useAuthStore();

  const [activeTab, setActiveTab] =
    useState("personal");

  const [editMode, setEditMode] =
    useState(false);

  const student = useMemo(() => {
    return {
      fullName:
        userData?.fullName ||
        userData?.studentName ||
        user?.displayName ||
        "Digital Student",

      email:
        userData?.studentEmail ||
        userData?.email ||
        user?.email ||
        "",

      phone:
        userData?.phone ||
        "",

      dateOfBirth:
        userData?.dateOfBirth ||
        "",

      gender:
        userData?.gender ||
        "",

      address:
        userData?.address ||
        "",

      guardianName:
        userData?.guardianName ||
        "",

      guardianPhone:
        userData?.guardianPhone ||
        "",

      digitalAdmissionNumber:
        userData?.digitalAdmissionNumber ||
        "Not Assigned",

      applyingClass:
        userData?.applyingclass ||
        userData?.classLevel ||
        userData?.class ||
        "Not Assigned",

      accountStatus:
        userData?.accountStatus ||
        "active",

      profilePicture:
        userData?.profilePicture ||
        userData?.profilePictureUrl ||
        "",
    };
  }, [userData, user]);

  const [formData, setFormData] =
    useState({
      fullName: student.fullName,
      phone: student.phone,
      address: student.address,
      guardianName: student.guardianName,
      guardianPhone:
        student.guardianPhone,
    });

  const initials = student.fullName
    .split(" ")
    .filter(Boolean)
    .map((item) => item[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]:
        e.target.value,
    }));
  };

  const handleCancelEdit = () => {
    setFormData({
      fullName:
        student.fullName,
      phone: student.phone,
      address: student.address,
      guardianName:
        student.guardianName,
      guardianPhone:
        student.guardianPhone,
    });

    setEditMode(false);
  };

  const handleSave = async () => {
    /*
      Later connect this to:

      updateDigitalStudent(
        userData.id,
        formData
      );

      For now UI only.
    */

    console.log(
      "PROFILE UPDATE:",
      formData
    );

    setEditMode(false);
  };

  return (
    <Layout user={user}>
    <main className="min-h-screen bg-[#f8faf8]">
    
      <div className="min-h-screen">

        <div className="space-y-6 p-4 sm:p-6 lg:p-8">

          {/* =====================================
              PAGE TITLE
          ====================================== */}

          <section className="relative overflow-hidden rounded-[26px] border border-teal-100 bg-gradient-to-r from-white via-[#f7fcfa] to-[#e8f7f2] px-6 py-6 shadow-sm">

            <div className="absolute bottom-0 right-10 hidden opacity-[0.06] lg:block">
              <div className="flex items-end gap-2">
                <div className="h-16 w-5 rounded-t-full bg-teal-900" />

                <div className="h-24 w-20 rounded-t-[50%] bg-teal-900" />

                <div className="h-20 w-5 rounded-t-full bg-teal-900" />

                <div className="h-28 w-24 rounded-t-[50%] bg-teal-900" />

                <div className="h-16 w-5 rounded-t-full bg-teal-900" />
              </div>
            </div>

            <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <p className="text-sm font-semibold text-teal-700">
                  Digital Madrasa
                </p>

                <h1 className="mt-1 text-3xl font-bold text-slate-900">
                  My Profile
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                  Manage your personal information
                  and account details.
                </p>
              </div>

              <div className="max-w-md rounded-2xl border border-amber-100 bg-amber-50/70 px-5 py-4">

                <p
                  dir="rtl"
                  className="text-lg font-bold text-teal-900"
                >
                  وَقُل رَّبِّ زِدْنِي عِلْمًا
                </p>

                <p className="mt-1 text-xs text-slate-600">
                  “My Lord, increase me in
                  knowledge.”
                </p>

                <p className="mt-1 text-[11px] font-semibold text-amber-700">
                  Quran 20:114
                </p>

              </div>

            </div>

          </section>

          {/* =====================================
              MAIN GRID
          ====================================== */}

          <section className="grid gap-6 xl:grid-cols-[310px_1fr]">

            {/* =====================================
                LEFT PROFILE CARD
            ====================================== */}

            <aside className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">

              {/* Photo */}

              <div className="text-center">

                {student.profilePicture ? (
                  <img
                    src={
                      student.profilePicture
                    }
                    alt={
                      student.fullName
                    }
                    className="mx-auto h-32 w-32 rounded-full border-4 border-teal-50 object-cover shadow-md"
                  />
                ) : (
                  <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-emerald-400 text-4xl font-bold text-white shadow-lg">
                    {initials}
                  </div>
                )}

                <h2 className="mt-5 text-xl font-bold text-slate-900">
                  {student.fullName}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Digital Student
                </p>

                <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-700">
                  <BadgeCheck className="h-4 w-4" />
                  Digital Madrasa Student
                </div>

                <p className="mx-auto mt-6 max-w-[220px] border-b border-amber-100 pb-6 text-sm italic leading-6 text-teal-800">
                  “Knowledge is light.
                  Seek it always.”
                </p>

              </div>

              {/* Basic account info */}

              <div className="mt-6 space-y-4">

                <ProfileMeta
                  icon={Hash}
                  label="Student ID"
                  value={
                    student.digitalAdmissionNumber
                  }
                />

                <ProfileMeta
                  icon={GraduationCap}
                  label="Class / Grade"
                  value={
                    student.applyingClass
                  }
                />

                <ProfileMeta
                  icon={User}
                  label="Account Type"
                  value="Digital Student"
                />

                <ProfileMeta
                  icon={CheckCircle2}
                  label="Account Status"
                  value={
                    student.accountStatus
                  }
                  status
                />

              </div>

            </aside>

            {/* =====================================
                RIGHT CONTENT
            ====================================== */}

            <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">

              {/* Tabs */}

              <div className="overflow-x-auto border-b border-slate-200">

                <div className="flex min-w-[650px]">

                  <ProfileTab
                    active={
                      activeTab ===
                      "personal"
                    }
                    icon={User}
                    label="Personal Information"
                    onClick={() =>
                      setActiveTab(
                        "personal"
                      )
                    }
                  />

                  <ProfileTab
                    active={
                      activeTab ===
                      "academic"
                    }
                    icon={
                      GraduationCap
                    }
                    label="Academic Details"
                    onClick={() =>
                      setActiveTab(
                        "academic"
                      )
                    }
                  />

                  <ProfileTab
                    active={
                      activeTab ===
                      "settings"
                    }
                    icon={Settings}
                    label="Settings"
                    onClick={() =>
                      setActiveTab(
                        "settings"
                      )
                    }
                  />

                  <ProfileTab
                    active={
                      activeTab ===
                      "security"
                    }
                    icon={ShieldCheck}
                    label="Security"
                    onClick={() =>
                      setActiveTab(
                        "security"
                      )
                    }
                  />

                </div>

              </div>

              {/* Tab content */}

              <div className="p-5 sm:p-6">

                {activeTab ===
                  "personal" && (
                  <PersonalInformation
                    student={
                      student
                    }
                    formData={
                      formData
                    }
                    editMode={
                      editMode
                    }
                    handleChange={
                      handleChange
                    }
                    setEditMode={
                      setEditMode
                    }
                    handleCancelEdit={
                      handleCancelEdit
                    }
                    handleSave={
                      handleSave
                    }
                  />
                )}

                {activeTab ===
                  "academic" && (
                  <AcademicDetails
                    student={
                      student
                    }
                  />
                )}

                {activeTab ===
                  "settings" && (
                  <SettingsTab />
                )}

                {activeTab ===
                  "security" && (
                  <SecurityTab
                    email={
                      student.email
                    }
                  />
                )}

              </div>

            </div>

          </section>

        </div>
      </div>
    </main>
    </Layout>
  );
}

