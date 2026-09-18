"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Banknote,
  BookOpen,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  GraduationCap,
  Headphones,
  Landmark,
  Pencil,
  Phone,
  Send,
  ShieldCheck,
  User,
  Users,
  Video,
} from "lucide-react";

import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/digitalclassroom/Layout";
import {StatCard, Pill, SectionCard, InfoRow, formatDate, clean, normalizeArray, safeText} from "@/components/digitalclassroom/teacherprofile"



export default function DigitalTeacherProfilePage() {
  const {
    user,
    userData,
  } = useAuthStore();

  const [
    applicationData,
    setApplicationData,
  ] = useState(null);



  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    let cancelled =
      false;

    const loadApplication =
      async () => {
        try {
          const teacherQuery =
            query(
              collection(
                db,
                "digitalClassTeacherRegistrations",
              ),

              where(
                "sourceTeacherUid",
                "==",
                user.uid,
              ),

              limit(1),
            );

          const snapshot =
            await getDocs(
              teacherQuery,
            );

          if (
            cancelled ||
            snapshot.empty
          ) {
            return;
          }

          const teacherDoc =
            snapshot.docs[0];

          setApplicationData({
            id: teacherDoc.id,
            ...teacherDoc.data(),
          });
        } catch (error) {
          console.error(
            "DIGITAL TEACHER PROFILE LOAD ERROR:",
            error,
          );
        }
      };

    loadApplication();

    return () => {
      cancelled = true;
    };
  }, [
    user?.uid,
  ]);


  /* =======================================================
     MERGE USER + APPLICATION
  ======================================================= */

  const teacher = useMemo(() => {
  const data = {
    ...(userData || {}),
    ...(applicationData || {}),
  };

  // ==========================================
  // TEACHING ASSIGNMENT
  // ==========================================

  const assignment =
    applicationData?.teachingAssignment ||
    data.teachingAssignment ||
    data.digitalTeachingAssignment ||
    {};

  const classes =
    normalizeArray(
      assignment?.classes,
    );

  const sortedClasses =
    [...classes].sort((a, b) => {
      const aNumber =
        parseInt(
          String(a).replace(
            /\D/g,
            "",
          ),
          10,
        ) || 0;

      const bNumber =
        parseInt(
          String(b).replace(
            /\D/g,
            "",
          ),
          10,
        ) || 0;

      return aNumber - bNumber;
    });

  const subjects =
    normalizeArray(
      assignment?.subjects,
    );

  const languages =
    normalizeArray(
      assignment?.languages,
    );


  // ==========================================
  // QUALIFICATION
  // ==========================================

  const qualification =
    data?.qualification &&
    typeof data.qualification ===
      "object"
      ? data.qualification
      : {};

  const generalEducation =
    qualification?.generalEducation &&
    typeof qualification
      .generalEducation ===
      "object"
      ? qualification.generalEducation
      : {};

  const islamicEducation =
    qualification?.islamicEducation &&
    typeof qualification
      .islamicEducation ===
      "object"
      ? qualification.islamicEducation
      : {};

  const computerKnowledge =
    qualification?.computerKnowledge &&
    typeof qualification
      .computerKnowledge ===
      "object"
      ? qualification.computerKnowledge
      : {};

const bankDetails =
  data?.bankDetails &&
  typeof data.bankDetails === "object"
    ? data.bankDetails

    : data?.bankingDetails &&
      typeof data.bankingDetails === "object"
      ? data.bankingDetails

      : data?.bank &&
        typeof data.bank === "object"
        ? data.bank

        : {};
  // ==========================================
  // RETURN TEACHER
  // ==========================================

  return {
    fullName:
      data.fullName ||
      data.teacherName ||
      data.name ||
      user?.displayName ||
      "Digital Teacher",

    email:
      data.digitalTeacherEmail ||
      data.teacherEmail ||
      data.email ||
      user?.email ||
      "",

    phone:
      data.phone ||
      data.mobile ||
      data.phoneNumber ||
      "",

    mhrId:
      data.mhrId ||
      data.mhrID ||
      data.teacherId ||
      "N/A",

    gender:
      safeText(
        data.gender,
      ),

    dateOfBirth:
      data.dateOfBirth ||
      data.dob ||
      null,

    address:
      typeof data.address ===
      "string"
        ? data.address
        : "N/A",

    // IMPORTANT
    classes:
      sortedClasses,

    subjects,

    languages,

    qualification,

    generalEducation: {
      highestQualification:
        generalEducation
          ?.highestQualification ||
        "N/A",

      courseName:
        generalEducation
          ?.courseName ||
        "N/A",

      institution:
        generalEducation
          ?.institution ||
        "N/A",
    },

    islamicEducation: {
      highestQualification:
        islamicEducation
          ?.highestQualification ||
        "N/A",

      courseName:
        islamicEducation
          ?.courseName ||
        "N/A",

      institution:
        islamicEducation
          ?.institution ||
        "N/A",

      yearOfPassing:
        islamicEducation
          ?.yearOfPassing ||
        "N/A",
    },

    computerKnowledge:
      computerKnowledge?.level ||
      "N/A",

    teachingExperience:
      qualification
        ?.teachingExperience ||
      "N/A",

    certificateUrl:
      qualification
        ?.certificateUrl ||
      "",

    accountStatus:
      data.digitalTeacherStatus ||
      data.accountStatus ||
      "active",

    profilePicture:
      data.digitalTeacherProfilePicture ||
      data.profilePicture ||
      data.profilePictureUrl ||
      user?.photoURL ||
      "",
      bankAccountHolder:
  safeText(
    bankDetails?.accountHolderName ||
    bankDetails?.accountName ||
    bankDetails?.holderName ||
    data?.accountHolderName ||
    data?.bankAccountHolderName,
  ),

bankName:
  safeText(
    bankDetails?.bankName ||
    bankDetails?.name ||
    data?.bankName,
  ),

bankAccountNumber:
  safeText(
    bankDetails?.accountNumber ||
    bankDetails?.accountNo ||
    bankDetails?.bankAccountNumber ||
    data?.accountNumber ||
    data?.bankAccountNumber,
  ),

ifscCode:
  safeText(
    bankDetails?.ifscCode ||
    bankDetails?.ifsc ||
    bankDetails?.IFSC ||
    data?.ifscCode ||
    data?.IFSC,
  ),

bankBranch:
  safeText(
    bankDetails?.branch ||
    bankDetails?.branchName ||
    data?.bankBranch ||
    data?.branchName,
  ),
  };
}, [
  userData,
  applicationData,
  user,
]);


  /* =======================================================
     INITIALS
  ======================================================= */

  const initials =
    teacher.fullName
      .split(" ")
      .filter(Boolean)
      .map(
        (name) =>
          name[0],
      )
      .join("")
      .slice(0, 2)
      .toUpperCase();


  /* =======================================================
     UI
  ======================================================= */

  return (
    <Layout user={user}>
      <main
        className="
          min-h-screen
          bg-[#fafbf7]
        "
      >
        <div
          className="
            mx-auto
            max-w-[1700px]
            space-y-4
            px-4
            py-5
            md:px-6
            lg:px-7
          "
        >
          {/* =================================================
              PAGE HEADER
          ================================================== */}

          <section
            className="
              relative
              overflow-hidden
              px-1
              pb-2
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                right-[22%]
                top-0
                hidden
                items-end
                gap-2
                opacity-[0.05]
                lg:flex
              "
            >
              <div
                className="
                  h-16
                  w-4
                  rounded-t-full
                  bg-[#0b513f]
                "
              />

              <div
                className="
                  h-20
                  w-20
                  rounded-t-[60px]
                  bg-[#0b513f]
                "
              />

              <div
                className="
                  h-24
                  w-5
                  rounded-t-full
                  bg-[#0b513f]
                "
              />

              <div
                className="
                  h-16
                  w-16
                  rounded-t-[50px]
                  bg-[#0b513f]
                "
              />
            </div>


            <div
              className="
                relative
                z-10
                flex
                flex-col
                justify-between
                gap-4
                lg:flex-row
                lg:items-end
              "
            >
              <div>
                <h1
                  className="
                    font-serif
                    text-3xl
                    font-bold
                    text-[#102943]
                    md:text-4xl
                  "
                >
                  Teacher Profile
                </h1>

                <p
                  className="
                    mt-1
                    text-sm
                    text-slate-500
                  "
                >
                  Manage your digital
                  teaching profile and
                  account details.
                </p>
              </div>


              <div className="text-right">
                <p
                  dir="rtl"
                  className="
                    text-2xl
                    font-semibold
                    text-[#0e4f43]
                  "
                >
                  رَبِّ زِدْنِي عِلْمًا
                </p>

                <p
                  className="
                    mt-1
                    text-xs
                    text-slate-500
                  "
                >
                  “My Lord, increase me
                  in knowledge”
                </p>

                <p
                  className="
                    mt-1
                    text-[10px]
                    text-slate-400
                  "
                >
                  Qur&apos;an 20:114
                </p>
              </div>
            </div>
          </section>


          {/* =================================================
              HERO PROFILE
          ================================================== */}

          <section
            className="
              relative
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-[0_5px_22px_rgba(15,23,42,0.05)]
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                inset-y-0
                right-0
                hidden
                w-[50%]
                bg-gradient-to-l
                from-[#f1ead7]
                via-[#f7f2e6]
                to-transparent
                lg:block
              "
            />


            <div
              className="
                pointer-events-none
                absolute
                bottom-0
                right-16
                hidden
                opacity-[0.09]
                lg:block
              "
            >
              <Landmark
                className="
                  h-44
                  w-44
                  text-[#806d45]
                "
              />
            </div>


            <div
              className="
                relative
                z-10
                flex
                flex-col
                gap-6
                p-5
                md:flex-row
                md:items-center
                md:p-6
              "
            >
              {/* PROFILE IMAGE */}

              <div
                className="
                  relative
                  shrink-0
                "
              >
                {teacher.profilePicture ? (
                  <img
                    src={
                      teacher.profilePicture
                    }
                    alt={
                      teacher.fullName
                    }
                    className="
                      h-36
                      w-36
                      rounded-full
                      border-[5px]
                      border-white
                      object-cover
                      shadow-[0_0_0_2px_#315c52]
                    "
                  />
                ) : (
                  <div
                    className="
                      flex
                      h-36
                      w-36
                      items-center
                      justify-center
                      rounded-full
                      border-[5px]
                      border-white
                      bg-gradient-to-br
                      from-[#0c6657]
                      to-[#48a67a]
                      text-4xl
                      font-bold
                      text-white
                      shadow-[0_0_0_2px_#315c52]
                    "
                  >
                    {initials}
                  </div>
                )}


                <button
                  type="button"
                  className="
                    absolute
                    bottom-1
                    right-0
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-full
                    border-[3px]
                    border-white
                    bg-[#163d4c]
                    text-white
                    shadow-md
                  "
                >
                  <Camera
                    className="
                      h-4
                      w-4
                    "
                  />
                </button>
              </div>


              {/* TEACHER DETAILS */}

              <div
                className="
                  min-w-0
                  flex-1
                "
              >
                <h2
                  className="
                    font-serif
                    text-2xl
                    font-bold
                    text-[#102943]
                    md:text-3xl
                  "
                >
                  {teacher.fullName}
                </h2>


                <div className="mt-2">
                  <Pill>
                    Digital Teacher
                  </Pill>
                </div>


                <p
                  className="
                    mt-3
                    max-w-2xl
                    font-serif
                    text-sm
                    italic
                    text-[#35566c]
                  "
                >
                  “Teaching is a trust
                  from Allah, and a path
                  to continuing Sadaqah
                  Jariyah.”
                </p>


                <div
                  className="
                    mt-5
                    flex
                    flex-wrap
                    gap-2
                  "
                >
                  <span
                    className="
                      inline-flex
                      items-center
                      gap-2
                      rounded-lg
                      bg-emerald-100
                      px-3
                      py-2
                      text-xs
                      font-semibold
                      text-emerald-700
                    "
                  >
                    <CheckCircle2
                      className="
                        h-4
                        w-4
                      "
                    />

                    {teacher.accountStatus ===
                    "active"
                      ? "Active"
                      : safeText(
                          teacher.accountStatus,
                        )}
                  </span>


                  <span
                    className="
                      inline-flex
                      items-center
                      gap-2
                      rounded-lg
                      bg-blue-100
                      px-3
                      py-2
                      text-xs
                      font-semibold
                      text-blue-700
                    "
                  >
                    <ShieldCheck
                      className="
                        h-4
                        w-4
                      "
                    />

                    Verified
                  </span>


                  <span
                    className="
                      inline-flex
                      items-center
                      gap-2
                      rounded-lg
                      bg-slate-100
                      px-3
                      py-2
                      text-xs
                      font-medium
                      text-slate-600
                    "
                  >
                    <CalendarDays
                      className="
                        h-4
                        w-4
                      "
                    />

                    Joined on{" "}
                    {formatDate(
                      teacher.joinedDate,
                    )}
                  </span>
                </div>
              </div>


              {/* QUOTE */}

              <div
                className="
                  hidden
                  w-[250px]
                  shrink-0
                  text-center
                  xl:block
                "
              >
                <p
                  className="
                    font-serif
                    text-lg
                    leading-7
                    text-[#164d3f]
                  "
                >
                  “Spreading
                  <br />
                  Knowledge
                  <br />
                  Nurturing Good
                  Character
                  <br />
                  Building a Brighter
                  Ummah”
                </p>
              </div>
            </div>
          </section>


          {/* =================================================
              INFORMATION GRID
          ================================================== */}

          <div
            className="
              grid
              grid-cols-1
              gap-4
              xl:grid-cols-[1fr_1fr_320px]
            "
          >
            {/* =================================================
                LEFT
            ================================================== */}

            <div className="space-y-4">

              {/* PERSONAL */}

              <SectionCard
                icon={User}
                title="Personal Information"
                action="Edit Profile"
              >
                <div className="space-y-2">
                  <InfoRow
                    label="Full Name"
                    value={
                      teacher.fullName
                    }
                  />

                  <InfoRow
                    label="MHR ID"
                    value={
                      teacher.mhrId
                    }
                  />

                  <InfoRow
                    label="Gender"
                    value={
                      teacher.gender
                    }
                  />

                  <InfoRow
                    label="Date of Birth"
                    value={formatDate(
                      teacher.dateOfBirth,
                    )}
                  />

                  <InfoRow
                    label="Address"
                    value={
                      teacher.address
                    }
                  />
                </div>
              </SectionCard>


              {/* QUALIFICATION */}

              <SectionCard
                icon={GraduationCap}
                title="General Education"
              >
                <div className="space-y-2">
                  <InfoRow
                    label="Qualification"
                    value={
                      teacher?.generalEducation
                        ?.highestQualification
                    }
                  />

                  <InfoRow
                    label="Course"
                    value={
                      teacher?.generalEducation
                        ?.courseName
                    }
                  />

                  <InfoRow
                    label="Institution"
                    value={
                      teacher?.generalEducation
                        ?.institution
                    }
                  />
                  <InfoRow
                    label="Level of computer knowledge"
                    value={
                      teacher.computerKnowledge
                        
                    }
                  />

                 
                  </div>
                  </SectionCard>

<SectionCard
                icon={GraduationCap}
                title="Islamic Academic Qualification"
              >
                <div className="space-y-2">

                     <InfoRow
                    label="Qualification"
                    value={
                      teacher?.islamicEducation
                        ?.highestQualification
                    }
                  />
                     <InfoRow
                    label="Institution"
                    value={
                      teacher?.islamicEducation
                        ?.institution
                    }
                  />
                     <InfoRow
                    label="Year Of Passing"
                    value={
                      teacher?.islamicEducation
                        ?.yearOfPassing
                    }
                  />
                     <InfoRow
                    label="Course"
                    value={
                      teacher
                        ?.islamicEducation
                        ?.courseName
                    }
                  />
                     <InfoRow
                    label="Quran Qualification"
                    value={
                      teacher
                         ?.islamicEducation
                        ?.quranQualification  
                    }
                  />

 <InfoRow
                    label="Teaching Experience"
                    value={
                      teacher?.islamicEducation
                        ?.teachingExperience
                    }
                  />

                  {teacher.certificateUrl && (
                    <div
                      className="
                        grid
                        grid-cols-[125px_12px_1fr]
                        gap-2
                        text-[13px]
                        leading-5
                      "
                    >
                      <span className="text-slate-500">
                        Certificate
                      </span>

                      <span className="text-slate-400">
                        :
                      </span>

                      <a
                        href={
                          teacher.certificateUrl
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="
                          font-semibold
                          text-teal-700
                          hover:underline
                        "
                      >
                        View Certificate
                      </a>
                    </div>
                  )}


                  <div
                    className="
                      grid
                      grid-cols-[125px_12px_1fr]
                      gap-2
                      pt-1
                      text-[13px]
                    "
                  >
                    <span className="text-slate-500">
                      Languages
                    </span>

                    <span className="text-slate-400">
                      :
                    </span>

                    <div
                      className="
                        flex
                        flex-wrap
                        gap-2
                      "
                    >
                      {teacher.languages.length >
                      0 ? (
                        teacher.languages.map(
                          (
                            language,
                            index,
                          ) => (
                            <Pill
                              key={`${language}-${index}`}
                              tone={
                                [
                                  "green",
                                  "blue",
                                  "amber",
                                ][
                                  index %
                                    3
                                ]
                              }
                            >
                              {
                                language
                              }
                            </Pill>
                          ),
                        )
                      ) : (
                        <span>
                          N/A
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>


              {/* BANK */}

              <SectionCard
                icon={Banknote}
                title="Banking Details"
                action="Update Details"
              >
                <div className="space-y-2">
                  <InfoRow
                    label="Account Holder"
                    value={
                      teacher.bankAccountHolder
                    }
                  />

                  <InfoRow
                    label="Bank Name"
                    value={
                      teacher.bankName
                    }
                  />

                  <InfoRow
                    label="Account Number"
                    value={
                      teacher.bankAccountNumber
                    }
                  />

                  <InfoRow
                    label="IFSC Code"
                    value={
                      teacher.ifscCode
                    }
                  />
                </div>


                <div
                  className="
                    mt-4
                    flex
                    items-center
                    gap-3
                    rounded-xl
                    bg-slate-50
                    px-4
                    py-3
                    text-xs
                    text-slate-500
                  "
                >
                  <ShieldCheck
                    className="
                      h-5
                      w-5
                      text-[#0b6c5d]
                    "
                  />

                  Your banking details are
                  kept secure and
                  confidential.
                </div>
              </SectionCard>
            </div>


            {/* =================================================
                CENTER
            ================================================== */}

            <div className="space-y-4">

              {/* CONTACT */}

              <SectionCard
                icon={Phone}
                title="Contact Details"
                action="Update Details"
              >
                <div className="space-y-2">
                  <InfoRow
                    label="Email"
                    value={
                      teacher.email
                    }
                  />

                  <InfoRow
                    label="Phone Number"
                    value={
                      teacher.phone
                    }
                  />

                  <InfoRow
                    label="Alternate Number"
                    value={
                      teacher.alternatePhone
                    }
                  />

                  <InfoRow
                    label="Emergency Contact"
                    value={
                      teacher.emergencyContact
                    }
                  />
                </div>
              </SectionCard>


              {/* TEACHING ASSIGNMENT */}

              <SectionCard
                icon={BookOpen}
                title="Teaching Assignment"
                
              >
                <div className="space-y-4">

                  {/* CLASSES */}

                  <div
                    className="
                      grid
                      grid-cols-[125px_12px_1fr]
                      gap-2
                      text-[13px]
                    "
                  >
                    <span className="text-slate-500">
                      Assigned Classes
                    </span>

                    <span className="text-slate-400">
                      :
                    </span>

                    <div
                      className="
                        flex
                        flex-wrap
                        gap-2
                      "
                    >
                      {teacher.classes.length >
                      0 ? (
                        teacher.classes.map(
                          (
                            item,
                            index,
                          ) => (
                            <Pill
                              key={`${item}-${index}`}
                            >
                              {item}
                            </Pill>
                          ),
                        )
                      ) : (
                        <span>
                          N/A
                        </span>
                      )}
                    </div>
                  </div>


                  {/* SUBJECTS */}

                  <div
                    className="
                      grid
                      grid-cols-[125px_12px_1fr]
                      gap-2
                      text-[13px]
                    "
                  >
                    <span className="text-slate-500">
                      Assigned Subjects
                    </span>

                    <span className="text-slate-400">
                      :
                    </span>

                    <div
                      className="
                        flex
                        flex-wrap
                        gap-2
                      "
                    >
                      {teacher.subjects.length >
                      0 ? (
                        teacher.subjects.map(
                          (
                            item,
                            index,
                          ) => (
                            <Pill
                              key={`${item}-${index}`}
                              tone={
                                index %
                                  2 ===
                                0
                                  ? "amber"
                                  : "blue"
                              }
                            >
                              {item}
                            </Pill>
                          ),
                        )
                      ) : (
                        <span>
                          N/A
                        </span>
                      )}
                    </div>
                  </div>


                  <InfoRow
                    label="Account Status"
                    value={
                      teacher.accountStatus
                    }
                  />

                  <InfoRow
                    label="Joined Date"
                    value={formatDate(
                      teacher.joinedDate,
                    )}
                  />
                </div>
              </SectionCard>


              {/* ABOUT */}

              <SectionCard
                icon={BookOpen}
                title="About Teacher"
                
              >
                <p
                  className="
                    text-[13px]
                    leading-6
                    text-slate-600
                  "
                >
                  {teacher.about ||
                    `Assalamu Alaikum. I am ${teacher.fullName}, a Digital Teacher committed to providing meaningful Islamic education, nurturing good character and helping students grow in knowledge and values.`}
                </p>
              </SectionCard>
            </div>


            {/* =================================================
                RIGHT
            ================================================== */}

            <aside className="space-y-4">

              {/* TEACHING OVERVIEW */}

              <SectionCard
                icon={Building2}
                title="Teaching Overview"
              >
                <div
                  className="
                    grid
                    grid-cols-2
                    gap-3
                  "
                >
                  <StatCard
                    icon={Users}
                    value={
                      teacher.assignedStudents
                    }
                    label="Assigned Students"
                    className="
                      bg-blue-50
                      text-blue-600
                    "
                  />

                  <StatCard
                    icon={BookOpen}
                    value={
                      teacher.classes
                        .length
                    }
                    label="Classes"
                    className="
                      bg-emerald-50
                      text-emerald-600
                    "
                  />

                  <StatCard
                    icon={GraduationCap}
                    value={
                      teacher.subjects
                        .length
                    }
                    label="Subjects"
                    className="
                      bg-amber-50
                      text-amber-600
                    "
                  />

                  <StatCard
                    icon={Video}
                    value={
                      teacher.liveSessions
                    }
                    label="Live Sessions"
                    className="
                      bg-violet-50
                      text-violet-600
                    "
                  />
                </div>
              </SectionCard>


              {/* QUOTE CARD */}

              <section
                className="
                  relative
                  overflow-hidden
                  rounded-2xl
                  border
                  border-emerald-100
                  bg-gradient-to-b
                  from-[#e4f3e5]
                  via-[#f6f1dc]
                  to-[#e1eee0]
                  px-6
                  py-8
                  text-center
                  shadow-sm
                "
              >
                <BookOpen
                  className="
                    mx-auto
                    h-7
                    w-7
                    text-[#087665]
                  "
                />

                <p
                  className="
                    mt-4
                    font-serif
                    text-sm
                    leading-6
                    text-[#17493e]
                  "
                >
                  “A teacher plants seeds
                  that continue to grow
                  forever.”
                </p>

                <div
                  className="
                    mt-5
                    flex
                    items-end
                    justify-center
                    gap-1
                    opacity-40
                  "
                >
                  <div
                    className="
                      h-10
                      w-3
                      rounded-t-full
                      bg-emerald-700
                    "
                  />

                  <Landmark
                    className="
                      h-16
                      w-16
                      text-emerald-700
                    "
                  />

                  <div
                    className="
                      h-12
                      w-3
                      rounded-t-full
                      bg-emerald-700
                    "
                  />
                </div>

                <p
                  className="
                    mt-3
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.25em]
                    text-emerald-700
                  "
                >
                  Ilm • Amal • Akhlaq
                </p>
              </section>


              {/* HELP */}

              <SectionCard
                icon={Headphones}
                title="Need Help?"
              >
                <p
                  className="
                    text-xs
                    leading-5
                    text-slate-500
                  "
                >
                  For any support or
                  account related
                  queries, please contact
                  the administration.
                </p>

                <a
  href="tel:8891177850"
  className="
    mt-4
    inline-flex
    items-center
    gap-2
    rounded-lg
    bg-[#087665]
    px-5
    py-3
    text-xs
    font-semibold
    text-white
    shadow
    transition
    hover:bg-[#075e52]
  "
>
  <Send className="h-4 w-4" />

  Contact Admin - 8891177850
</a>
              </SectionCard>
            </aside>
          </div>


          {/* =================================================
              FOOTER
          ================================================== */}

          <footer
            className="
              flex
              flex-col
              justify-between
              gap-3
              border-t
              border-amber-200
              px-2
              py-4
              text-[10px]
              text-slate-500
              sm:flex-row
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              <Landmark
                className="
                  h-5
                  w-5
                  text-[#0b6c5d]
                "
              />

              <span>
                Digital Madrasa
                E-Learning • Spreading
                Knowledge
              </span>
            </div>

            <span>
              In service of Deen • For a
              brighter tomorrow
            </span>
          </footer>
        </div>
      </main>
    </Layout>
  );
}