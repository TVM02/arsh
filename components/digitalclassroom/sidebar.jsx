"use client";

import Link from "next/link";
import Image from "next/image";

import {
  Home,
  ClipboardList,
  FolderOpen,
  FileCheck,
  BarChart3,
  MessageSquare,
  User,
  LogOut,
  X,
  BookOpen,
  Users,
  UserCheck,
  Video
} from "lucide-react";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

import useAuthStore from "@/lib/authStore";
import { closeActiveSessionLog } from "@/lib/loggingUtils";
import { cn } from "@/lib/utils";


export default function StudentSidebar({
  isOpen,
  onClose,
}) {
const pathname = usePathname();

const dcRole = pathname.includes("/dashboard/digital-teacher")
  ? "teacher"
  : "student";
  const router = useRouter();

  const {
    user,
    userData,
    clearAuth,
  } = useAuthStore();

  const [logoutLoading, setLogoutLoading] =
    useState(false);


  // ==========================================
  // DIGITAL CLASSROOM NAVIGATION
  // ==========================================

  const getNavigationItems = () => {
  switch (dcRole) {
    case "student":
      return [
        {
          name: "Dashboard",
          href: "/dashboard/digital-student/",
          icon: Home,
        },
        {
          name: "Classes",
          href: "/dashboard/digital-student/classes",
          icon: BookOpen,
        },
        {
          name: "Assignments",
          href: "/dashboard/digital-student/assignments",
          icon: ClipboardList,
        },
        {
          name: "Study Materials",
          href: "/dashboard/digital-student/materials",
          icon: FolderOpen,
        },
        {
          name: "Exams",
          href: "/dashboard/digital-student/exams",
          icon: FileCheck,
        },
        
        {
          name: "Messages",
          href: "/dashboard/digital-student/notices",
          icon: MessageSquare,
        },
        {
          name: "Profile",
          href: "/dashboard/digital-student/profile",
          icon: User,
        },
      ];

    case "teacher":
      return [
        {
          name: "Dashboard",
          href: "/dashboard/digital-teacher",
          icon: Home,
        },
        {
          name: "My Student",
          href: "/dashboard/digital-teacher/students",
          icon: Users,
        },
        {
          name: "Live Classes",
          href: "/dashboard/digital-teacher/live-classes",
          icon: Video,
        },
        {
          name: "Study Materials",
          href: "/dashboard/digital-teacher/study-materials",
          icon: FolderOpen,
        },
        {
          name: "Assignments",
          href: "/dashboard/digital-teacher/assignments",
          icon: ClipboardList,
        },
        {
          name: "Attendance",
          href: "/dashboard/digital-teacher/attendance",
          icon: UserCheck,
        },
        {
          name: "Exams",
          href: "/dashboard/digital-teacher/exams",
          icon: FileCheck,
        },
        {
          name: "Messages",
          href: "/dashboard/digital-teacher/messages",
          icon: MessageSquare,
        },
        {
          name: "Profile",
          href: "/dashboard/digital-teacher/profile",
          icon: User,
        },
      ];

    default:
      return [];
  }
};

  // ==========================================
  // ACTIVE ROUTE
  // ==========================================

  const isItemActive = (item) => {
    if (item.matchExact) {
      return pathname === item.href;
    }

    return (
      pathname === item.href ||
      pathname.startsWith(
        `${item.href}/`
      )
    );
  };


  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = async () => {
    setLogoutLoading(true);

    try {
      await closeActiveSessionLog();

      await signOut(auth);

      clearAuth();

      localStorage.removeItem(
        "auth-storage"
      );

      sessionStorage.removeItem(
        "dkju-active-login-session"
      );

      sessionStorage.removeItem(
        "dkju-active-login-log-id"
      );

      sessionStorage.removeItem(
        "dkju-session-start"
      );

      router.push(
        "/digital-class"
      );

    } catch (error) {
      console.error(
        "Error signing out:",
        error
      );

    } finally {
      setLogoutLoading(false);
    }
  };


  // ==========================================
  // STUDENT NAME
  // ==========================================

  const studentName =
    userData?.fullName ||
    userData?.name ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Student";


  // ==========================================
  // COMPONENT
  // ==========================================

  return (
    <aside
      className={cn(
        `
        fixed
        inset-y-0
        left-0
        z-50
        flex
        w-64
        flex-col
        overflow-hidden
        border-r
        border-slate-100
        bg-white
        shadow-[8px_0_40px_rgba(15,23,42,0.05)]
        transition-transform
        duration-300
        lg:translate-x-0
        `,
        isOpen
          ? "translate-x-0"
          : "-translate-x-full"
      )}
    >

      {/* ======================================
          TOP IMAGE
      ====================================== */}

      <div className="relative h-[220px] shrink-0 overflow-hidden bg-gradient-to-br from-teal-500 to-teal-700">

        <Image
          src={"/logo.png"}
          alt="Digital Classroom"
          fill
          priority
          className="object-cover"
        />


        {/* DARK / TEAL OVERLAY */}

        <div className="absolute inset-0 bg-gradient-to-t from-teal-800/20 via-transparent to-transparent" />


        {/* MOBILE CLOSE */}

        <button
          type="button"
          onClick={onClose}
          className="
            absolute
            right-3
            top-3
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-full
            bg-white/90
            text-slate-700
            shadow-md
            backdrop-blur
            transition
            hover:bg-white
            lg:hidden
          "
        >
          <X className="h-5 w-5" />
        </button>

      </div>


      {/* ======================================
          WHITE SIDEBAR BODY
      ====================================== */}

      <div
        className="
          relative
          -mt-4
          flex
          min-h-0
          flex-1
          flex-col
          rounded-t-[24px]
          bg-gradient-to-b
          from-white
          via-white
          to-teal-50/60
        "
      >

        {/* ======================================
            NAVIGATION
        ====================================== */}

        <nav
          className="
            flex-1
            space-y-2
            overflow-y-auto
            px-4
            py-5
            scrollbar-hide
          "
        >

          {getNavigationItems().map(
            (item) => {

              const Icon = item.icon;

              const active =
                isItemActive(item);


              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    `
                    group
                    flex
                    items-center
                    gap-4
                    rounded-xl
                    px-4
                    py-3.5
                    text-sm
                    font-semibold
                    transition-all
                    duration-200
                    `,
                    active
                      ? `
                        bg-gradient-to-r
                        from-teal-500
                        to-teal-600
                        text-white
                        shadow-lg
                        shadow-teal-100
                      `
                      : `
                        text-slate-700
                        hover:bg-teal-50
                        hover:text-teal-700
                      `
                  )}
                >

                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition",
                      active
                        ? "text-white"
                        : "text-slate-500 group-hover:text-teal-600"
                    )}
                  />


                  <span className="truncate">
                    {item.name}
                  </span>

                </Link>
              );
            }
          )}

        </nav>

  


        {/* ======================================
            LOGOUT
        ====================================== */}

        <div className="border-t border-slate-100 px-4 py-3">

          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutLoading}
            className="
              flex
              w-full
              items-center
              gap-3
              rounded-xl
              px-4
              py-3
              text-sm
              font-semibold
              text-slate-600
              transition
              hover:bg-red-50
              hover:text-red-600
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >

            {logoutLoading ? (

              <div
                className="
                  h-5
                  w-5
                  animate-spin
                  rounded-full
                  border-2
                  border-red-400
                  border-t-transparent
                "
              />

            ) : (

              <LogOut className="h-5 w-5" />

            )}


            <span>
              {logoutLoading
                ? "Signing out..."
                : "Sign Out"}
            </span>

          </button>

        </div>


        {/* ======================================
            ISLAMIC FOOTER
        ====================================== */}

        <div className="relative overflow-hidden px-4 pb-5 pt-2">

          {/* MOSQUE */}

          <div className="pointer-events-none absolute bottom-0 left-0 right-0 opacity-[0.10]">

            <svg
              viewBox="0 0 300 110"
              className="w-full text-teal-500"
              fill="currentColor"
            >

              {/* Center */}

              <rect
                x="115"
                y="55"
                width="70"
                height="55"
              />

              <path
                d="
                  M115 55
                  Q150 10
                  185 55
                  Z
                "
              />


              {/* Left */}

              <rect
                x="55"
                y="72"
                width="45"
                height="38"
              />

              <path
                d="
                  M55 72
                  Q77.5 42
                  100 72
                  Z
                "
              />


              {/* Right */}

              <rect
                x="200"
                y="72"
                width="45"
                height="38"
              />

              <path
                d="
                  M200 72
                  Q222.5 42
                  245 72
                  Z
                "
              />


              {/* Minaret Left */}

              <rect
                x="32"
                y="42"
                width="10"
                height="68"
              />

              <path
                d="
                  M28 42
                  Q37 25
                  46 42
                  Z
                "
              />


              {/* Minaret Right */}

              <rect
                x="260"
                y="38"
                width="10"
                height="72"
              />

              <path
                d="
                  M256 38
                  Q265 20
                  274 38
                  Z
                "
              />

            </svg>

          </div>


          {/* BOARD NAME */}

          <div className="relative z-10 pt-5 text-center">

            <p className="text-[10px] font-bold leading-4 text-teal-700">

              Dakshina Kerala Islam
              <br />
              Matha Vidyabhyasa Board

            </p>


            <div className="mx-auto my-2 h-px w-10 bg-teal-300" />


            <p className="text-[9px] font-medium text-slate-400">

              Knowledge Builds a Better Tomorrow

            </p>

          </div>

        </div>

      </div>

    </aside>
  );
}