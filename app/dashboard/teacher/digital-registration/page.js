"use client";

import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import {
  User,
  GraduationCap,
  Landmark,
  UploadCloud,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  Hash,
  CalendarDays,
  Building2,
  BriefcaseBusiness,
  Save,
} from "lucide-react";
import {SectionCard, ReadOnlyField, FormField, ProcessCard, ComputerKnowledgeCard } from "@/components/digitalclassroom/From";
import useAuthStore from "@/lib/authStore";
import {
  registerDigitalTeacher,
  getDigitalTeacherStatus,
} from "@/lib/digitalClassTeacherService";

import { storage } from "@/lib/firebase";

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";




export default function DigitalTeacherRegistrationPage() {
  const { user, userData } = useAuthStore();

  const [submitting, setSubmitting] =
    useState(false);
    const [applicationStatus, setApplicationStatus] =
  useState("form");
  const [applicationData, setApplicationData] =
  useState(null);

  const [message, setMessage] =
    useState("");

  const [formData, setFormData] =
    useState({
      // General / School Education
generalQualification: "",
generalCourseName: "",
generalInstitution: "",

// Computer Knowledge
computerKnowledge: "",
otherComputerSkill: "",

// Islamic / Arabic Qualification
islamicHighestQualification: "",
islamicQualificationName: "",
islamicInstitution: "",
islamicYearOfPassing: "",
islamicTeachingExperience: "",
quranQualification: "",

      accountHolderName: "",
      bankName: "",
      accountNumber: "",
      confirmAccountNumber: "",
      ifscCode: "",
      branchName: "",
      upiId: "",
      profileFile: null,
profilePreview: "",

      certificateFile: null,

      declaration: false,
    });

  useEffect(() => {
    if (!userData) return;

    setFormData((prev) => ({
      ...prev,

      accountHolderName:
        prev.accountHolderName ||
        userData?.fullName ||
        userData?.name ||
        "",
    }));
  }, [userData]);
  

  const teacher = {
    uid:
      user?.uid ||
      userData?.uid ||
      "",

    teacherId:
      userData?.id ||
      userData?.teacherId ||
      "",

    mhrId:
      userData?.mhrId ||
      userData?.teacherId ||
      "",

    fullName:
      userData?.fullName ||
      userData?.name ||
      user?.displayName ||
      "Teacher",

    email:
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

    madarsaName:
      userData?.madarsaId ||
      userData?.institutionName ||
      "",

    profilePicture:
      userData?.profilePicture ||
      userData?.profilePictureUrl ||
      "",
  };
useEffect(() => {
  if (!teacher.uid) return;

  let cancelled = false;

  const loadApplicationStatus =
    async () => {
      try {
        const result =
          await getDigitalTeacherStatus(
            teacher.uid,
          );

        if (cancelled) return;

        if (!result?.exists) {
          setApplicationStatus("form");
          setApplicationData(null);
          return;
        }

        setApplicationStatus(
          result?.status || "pending",
        );
        setApplicationData(
  result?.application || null,
);
      } catch (error) {
        console.error(
          "DIGITAL TEACHER STATUS LOAD ERROR:",
          error,
        );
      }
    };

  loadApplicationStatus();

  return () => {
    cancelled = true;
  };
}, [teacher.uid]);
  const handleChange = (e) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    setFormData((prev) => ({
      ...prev,

      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));

    setMessage("");
  };

  const handleCertificate = (e) => {
    const file =
      e.target.files?.[0] || null;

    setFormData((prev) => ({
      ...prev,
      certificateFile: file,
    }));
  };
  const handleProfileImage = (e) => {
  const file =
    e.target.files?.[0] || null;

  if (!file) {
    return;
  }

  if (
    !file.type.startsWith("image/")
  ) {
    setMessage(
      "Please select a valid image file.",
    );

    return;
  }

  // Maximum 5 MB
  if (
    file.size >
    5 * 1024 * 1024
  ) {
    setMessage(
      "Profile image must be below 5 MB.",
    );

    return;
  }

  const preview =
    URL.createObjectURL(file);

  setFormData((prev) => ({
    ...prev,

    profileFile:
      file,

    profilePreview:
      preview,
  }));

  setMessage("");
};

  const handleSubmit = async (e) => {
  e.preventDefault();

  setMessage("");

  /* ============================================
     VALIDATE TEACHER ACCOUNT
  ============================================ */

  if (!teacher.uid) {
    setMessage(
      "Teacher account could not be identified.",
    );

    return;
  }




if (
  !formData.generalQualification ||
  !formData.generalCourseName
) {
  setMessage(
    "Please complete General Education details.",
  );

  return;
}

if (!formData.computerKnowledge) {
  setMessage(
    "Please select your Computer Knowledge level.",
  );

  return;
}



if (
  !formData.islamicHighestQualification ||
  !formData.islamicYearOfPassing ||
  !formData.islamicTeachingExperience ||
  !formData.quranQualification
) {
  setMessage(
    "Please complete Islamic / Arabic Qualification details.",
  );

  return;
}

if (
  formData.islamicHighestQualification === "degree" &&
  !formData.islamicQualificationName
) {
  setMessage(
    "Please select your Islamic Degree Course Name.",
  );

  return;
}
  if (
  formData.computerKnowledge === "other" &&
  !formData.otherComputerSkill.trim()
) {
  setMessage(
    "Please specify your computer skills.",
  );

  return;
}

  /* ============================================
     BANK VALIDATION
  ============================================ */

  if (
    !formData.accountHolderName ||
    !formData.bankName ||
    !formData.accountNumber ||
    !formData.ifscCode
  ) {
    setMessage(
      "Please complete bank account details.",
    );

    return;
  }

  if (
    formData.accountNumber.trim() !==
    formData.confirmAccountNumber.trim()
  ) {
    setMessage(
      "Bank account numbers do not match.",
    );

    return;
  }

  /* ============================================
     DECLARATION
  ============================================ */

  if (!formData.declaration) {
    setMessage(
      "Please accept the declaration.",
    );

    return;
  }
  if (!formData.profileFile) {
  setMessage(
    "Please upload your Digital Teacher profile photo.",
  );

  return;
}

  setSubmitting(true);

  try {
  let profileImageUrl =
  teacher?.profilePicture ||
  null;

if (formData.profileFile) {
  profileImageUrl =
    await uploadDigitalTeacherProfile(
      formData.profileFile,
    );
}

    const registrationData = {
  /* ========================================
     EXISTING NORMAL TEACHER ACCOUNT
  ======================================== */

  sourceTeacherId:
    teacher.teacherId || null,

  sourceTeacherUid:
    teacher.uid,

  /*
    SAME Firebase UID will become
    Digital Teacher UID after approval.
  */
  digitalTeacherUid:
    teacher.uid,

  /*
    SAME Teacher login email.
  */
  email:
    teacher.email || null,

  digitalTeacherEmail:
    teacher.email || null,

  /* ========================================
     PERSONAL INFORMATION
  ======================================== */

  fullName:
    teacher.fullName,

  mhrId:
    teacher.mhrId || null,

  phone:
    teacher.phone || null,

  gender:
    teacher.gender || null,

  dateOfBirth:
    teacher.dateOfBirth || null,

  address:
    teacher.address || null,

  madarsaName:
    teacher.madarsaName || null,

profilePicture:
  profileImageUrl,

  /* ========================================
     QUALIFICATION
  ======================================== */

  qualification: {
    generalEducation: {
      highestQualification:
        formData.generalQualification,

      courseName:
        formData.generalCourseName,

      institution:
        formData.generalInstitution ||
        null,
    },

    computerKnowledge: {
      level:
        formData.computerKnowledge,

      otherDetails:
        formData.computerKnowledge ===
        "other"
          ? formData.otherComputerSkill.trim()
          : null,
    },

    islamicEducation: {
      highestQualification:
        formData.islamicHighestQualification,

      courseName:
        formData.islamicQualificationName,

      institution:
        formData.islamicInstitution,

      yearOfPassing:
        formData.islamicYearOfPassing,

      teachingExperience:
        formData.islamicTeachingExperience,

      QuranQualification:
        formData.isQuranQualification,
    },

    certificateUrl:
      null,
  },

  /* ========================================
     BANK
  ======================================== */

  bankDetails: {
    accountHolderName:
      formData.accountHolderName,

    bankName:
      formData.bankName,

    accountNumber:
      formData.accountNumber.trim(),

    ifscCode:
      formData.ifscCode
        .trim()
        .toUpperCase(),

    branchName:
      formData.branchName ||
      null,

    upiId:
      formData.upiId ||
      null,
  },

  certificateUrl:
    null,
};

    /* ============================================
       SEND TO API
    ============================================ */

    const result =
      await registerDigitalTeacher(
        registrationData,
      );
      setApplicationStatus(
  result?.status || "pending",
);

    console.log(
      "DIGITAL TEACHER REGISTERED:",
      result,
    );

    setMessage(
      "Digital Teacher application submitted successfully. Your application is now waiting for Board approval.",
    );

    /* ============================================
       RESET APPLICATION FIELDS
    ============================================ */

    setFormData((prev) => ({
      ...prev,
generalQualification: "",
generalCourseName: "",
generalInstitution: "",

computerKnowledge: "",
otherComputerSkill: "",

islamicHighestQualification: "",
islamicQualificationName: "",
islamicInstitution: "",
islamicYearOfPassing: "",
islamicTeachingExperience: "",
quranQualification: "",

      bankName: "",
      accountNumber: "",
      confirmAccountNumber: "",
      ifscCode: "",
      branchName: "",
      upiId: "",
      profileFile: null,
profilePreview: "",

      certificateFile: null,

      declaration: false,
    }));
  } catch (error) {
    console.error(
      "DIGITAL TEACHER SUBMIT ERROR:",
      error,
    );

    setMessage(
      error?.message ||
        "Unable to submit Digital Teacher application.",
    );
  } finally {
    setSubmitting(false);
  }
};
const uploadDigitalTeacherProfile =
  async (file) => {
    if (!file) {
      return null;
    }

    if (!teacher?.uid) {
      throw new Error(
        "Teacher UID not found.",
      );
    }

    const safeFileName =
      file.name
        .replace(
          /[^a-zA-Z0-9._-]/g,
          "_",
        );

    const storagePath =
      `digital-teachers/profile-images/${teacher.uid}/${Date.now()}_${safeFileName}`;

    const storageRef =
      ref(
        storage,
        storagePath,
      );

    const uploadTask =
      uploadBytesResumable(
        storageRef,
        file,
        {
          contentType:
            file.type,
        },
      );

    return await new Promise(
      (
        resolve,
        reject,
      ) => {
        uploadTask.on(
          "state_changed",

          () => {},

          (error) => {
            console.error(
              "PROFILE IMAGE UPLOAD ERROR:",
              error,
            );

            reject(
              new Error(
                "Unable to upload profile image.",
              ),
            );
          },

          async () => {
            try {
              const downloadURL =
                await getDownloadURL(
                  uploadTask
                    .snapshot
                    .ref,
                );

              resolve(
                downloadURL,
              );
            } catch (error) {
              reject(error);
            }
          },
        );
      },
    );
  };



  return (
    <Layout>
    <main className="min-h-screen bg-[#f8faf8]">
     

      <div className="min-h-screen">
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">

          {/* ============================= */}
          {/* PAGE TITLE */}
          {/* ============================= */}

          <div>
            <p className="text-sm font-semibold text-teal-700">
              Digital Classroom
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Digital Teacher Registration
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Submit your qualification and
  bank details to apply as a
  Digital Classroom teacher.
  After approval, your existing
  Teacher login credentials can
  also be used to access the
  Digital Teacher portal.
            </p>
          </div>

          {/* ============================= */}
          {/* PROCESS */}
          {/* ============================= */}

          <div className="grid gap-3 md:grid-cols-3">

  <ProcessCard
    number="1"
    title="Submit Application"
    description="Qualification and bank details"
    active={
      applicationStatus === "form"
    }
    completed={
      applicationStatus !== "form"
    }
  />

  <ProcessCard
    number="2"
    title="Board Review"
    description="Board reviews request"
    active={
      applicationStatus === "pending"
    }
    completed={
      applicationStatus === "approved"
    }
  />

  <ProcessCard
    number="3"
    title="Account Approval"
    description="Digital Classroom access enabled"
    active={
      applicationStatus === "approved"
    }
  />

</div>

         {applicationStatus === "form" ? (
  <form
    onSubmit={handleSubmit}
    className="space-y-6"
  >
            {/* ============================= */}
            {/* EXISTING TEACHER DETAILS */}
            {/* ============================= */}

            <SectionCard
              icon={User}
              title="Teacher Information"
              description="Information from your existing Teacher Portal account."
            >

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

                <ReadOnlyField
                  icon={User}
                  label="Full Name"
                  value={
                    teacher.fullName
                  }
                />

                <ReadOnlyField
                  icon={Hash}
                  label="Teacher ID / MHR ID"
                  value={
                    teacher.mhrId
                  }
                />

                <ReadOnlyField
                  icon={Mail}
                  label="Email"
                  value={
                    teacher.email
                  }
                />

                <ReadOnlyField
                  icon={Phone}
                  label="Phone"
                  value={
                    teacher.phone
                  }
                />

                <ReadOnlyField
                  icon={CalendarDays}
                  label="Date of Birth"
                  value={
                    teacher.dateOfBirth
                  }
                />

                <ReadOnlyField
                  icon={User}
                  label="Gender"
                  value={
                    teacher.gender
                  }
                />

                <ReadOnlyField
                  icon={Building2}
                  label="Madrasa"
                  value={
                    teacher.madarsaId
                  }
                />

                <ReadOnlyField
                  icon={MapPin}
                  label="Address"
                  value={
                    teacher.address
                  }
                />


              </div>
              <div className="mt-6 border-t border-slate-200 pt-6">

  <label className="mb-3 block text-sm font-semibold text-slate-800">
    Digital Teacher Profile Photo
  </label>

  <div
    className="
      flex
      flex-col
      gap-5
      rounded-2xl
      border
      border-slate-200
      bg-slate-50
      p-5
      sm:flex-row
      sm:items-center
    "
  >

    {/* Preview */}
    <div
      className="
        flex
        h-24
        w-24
        shrink-0
        items-center
        justify-center
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
      "
    >

      {formData.profilePreview ||
      teacher?.profilePicture ? (

        <img
          src={
            formData.profilePreview ||
            teacher.profilePicture
          }
          alt="Digital Teacher"
          className="h-full w-full object-cover"
        />

      ) : (

        <User className="h-10 w-10 text-slate-300" />

      )}

    </div>


    <div className="flex-1">

      <p className="text-sm font-semibold text-slate-800">
        Upload Profile Image
      </p>

      <p className="mt-1 text-xs text-slate-500">
        JPG, JPEG, PNG or WEBP. Maximum 5 MB.
      </p>


      <label
        className="
          mt-4
          inline-flex
          cursor-pointer
          items-center
          gap-2
          rounded-xl
          bg-teal-600
          px-4
          py-2.5
          text-sm
          font-semibold
          text-white
          transition
          hover:bg-teal-700
        "
      >
        <UploadCloud className="h-4 w-4" />

        Choose Photo

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={
            handleProfileImage
          }
          className="hidden"
        />
      </label>


      {formData.profileFile && (

        <p className="mt-2 text-xs font-medium text-teal-700">
          {
            formData
              .profileFile
              .name
          }
        </p>

      )}

    </div>

  </div>

</div>

              <div className="mt-5 rounded-2xl border border-teal-100 bg-teal-50 p-4">

                <div className="flex gap-3">

                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />

                  <div>
                    <p className="text-sm font-semibold text-teal-900">
                      Existing Teacher Account
                    </p>

                    <p className="mt-1 text-xs leading-5 text-teal-700">
                      These details are taken
                      from your normal Teacher
                      Portal account and cannot
                      be changed from this
                      application.
                    </p>
                  </div>

                </div>

              </div>

            </SectionCard>

            {/* ============================= */}
            {/* QUALIFICATION */}
            {/* ============================= */}

            <SectionCard
  icon={GraduationCap}
  title="Qualification Details"
  description="Provide your general education, computer knowledge and Islamic / Arabic qualification details."
>

  {/* ==========================================
      GENERAL / SCHOOL EDUCATION
  =========================================== */}

  <div>
    <div className="mb-5">
      <h3 className="text-base font-bold text-slate-900">
        General / School Education
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Enter your general academic qualification.
      </p>
    </div>

    <div className="grid gap-5 md:grid-cols-2">

      {/* Qualification */}

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Highest Qualification
          <span className="ml-1 text-red-500">*</span>
        </label>

        <select
          name="generalQualification"
          value={formData.generalQualification}
          onChange={handleChange}
          required
          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
        >
          <option value="">
            Select Qualification
          </option>

          <option value="sslc">
            Sslc
          </option>
          <option value="plus-two">
            Plus Two
          </option>

          <option value="degree">
            Degree
          </option>

          <option value="diploma">
            Diploma
          </option>

          <option value="other">
            Other
          </option>
        </select>
      </div>

      <FormField
        label="Qualification / Course Name"
        name="generalCourseName"
        value={formData.generalCourseName}
        onChange={handleChange}
        placeholder="Example: BA English / B.Com / Diploma"
        required
      />

      <FormField
        label="Institution"
        name="generalInstitution"
        value={formData.generalInstitution}
        onChange={handleChange}
        placeholder="School / College / University"
        
      />

    </div>
  </div>

  {/* ==========================================
      COMPUTER KNOWLEDGE
  =========================================== */}

  <div className="mt-8 border-t border-slate-100 pt-7">

    <div className="mb-5">
      <h3 className="text-base font-bold text-slate-900">
        Computer Knowledge
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Select your current computer skill level.
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-3">

      <ComputerKnowledgeCard
        title="Basic"
        value="basic"
        description="MS Office, Google Meet and basic computer usage."
        selected={
          formData.computerKnowledge === "basic"
        }
        onSelect={() =>
          setFormData((prev) => ({
            ...prev,
            computerKnowledge: "basic",
          }))
        }
      />

      <ComputerKnowledgeCard
        title="Intermediate"
        value="intermediate"
        description="PDF creation, document preparation and online classroom tools."
        selected={
          formData.computerKnowledge === "intermediate"
        }
        onSelect={() =>
          setFormData((prev) => ({
            ...prev,
            computerKnowledge: "intermediate",
          }))
        }
      />

      <ComputerKnowledgeCard
        title="Advanced"
        value="advanced"
        description="AI tools, AI video creation and digital content creation."
        selected={
          formData.computerKnowledge === "advanced"
        }
        onSelect={() =>
          setFormData((prev) => ({
            ...prev,
            computerKnowledge: "advanced",
          }))
        }
      />
      <ComputerKnowledgeCard
        title="Other"
        value="other"
        description="Other computer skills not listed above."
        selected={
          formData.computerKnowledge === "other"
        }
        onSelect={() =>
          setFormData((prev) => ({
            ...prev,
            computerKnowledge: "other",
          }))
        }
      />
      </div>
      {formData.computerKnowledge === "other" && (
  <div className="mt-5">
    <label className="mb-2 block text-sm font-medium text-slate-700">
      Please specify your computer skills
      <span className="ml-1 text-red-500">*</span>
    </label>

    <textarea
      name="otherComputerSkill"
      value={formData.otherComputerSkill}
      onChange={handleChange}
      rows={4}
      placeholder="Enter your computer knowledge / skills..."
      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
    />
  </div>
)}

    

  </div>

  {/* ==========================================
      ISLAMIC / ARABIC QUALIFICATION
  =========================================== */}

  <div className="mt-8 border-t border-slate-100 pt-7">

    <div className="mb-5">
      <h3 className="text-base font-bold text-slate-900">
        Islamic Academic Qualification
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Enter your Islamic or Arabic educational qualification.
      </p>
    </div>

    <div className="grid gap-5 md:grid-cols-2">

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Highest Qualification
          <span className="ml-1 text-red-500">*</span>
        </label>

        <select
          name="islamicHighestQualification"
          value={formData.islamicHighestQualification}
          onChange={handleChange}
          required
          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
        >
          <option value="">
            Select Qualification
          </option>

          <option value="sslc">
            Sslc
          </option>
          <option value="plus-two">
            Plus Two
          </option>

          <option value="degree">
            Degree
          </option>
          <option value="other">
            Other
          </option>
        </select>
      </div>
      {formData.islamicHighestQualification === "degree" && (
        <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Cource Name
          <span className="ml-1 text-red-500">*</span>
        </label>

        <select
          name="islamicQualificationName"
          value={formData.islamicQualificationName}
          onChange={handleChange}
          required
          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
        >
          <option value="">
            Select Qualification
          </option>

          <option value="nadwi">
           Nadwi	ندوي
          </option>
          <option value="deobandi">
           Deobandi	دیوبندی
          </option>

          <option value="qasimi">
            Qasimi	قاسمي
          </option>
          <option value="madani">
          Madani	مدني
          </option>
          <option value="azhari">
          Azhari	أزهري
          </option>
          <option value="farooqi">
          Farooqi	فاروقي
          </option>
          <option value="rahmani">
          Rahmani	رحماني
          </option>
          <option value="qadiri">
          Qadiri	قادري
          </option>
          <option value="rashidi">
          Rashidi	رشيدي
          </option>
          <option value="ashrafi">
          Ashrafi	أشرفي
          </option>
          <option value="chishty">
          Chishty 	چشتی	
          </option>
          <option value="faizy">
          Faizy	فيضي
          </option>
          <option value="hudawi">
          Hudawi	هدوي	
          </option>
          <option value="saqafi">
          Saqafi	ثقافي	
          </option>
          <option value="wafy">
          Wafy	وافي	
          </option>
          <option value="wafiyya">
          Wafiyya	وافية	
          </option>
          <option value="baqavi">
          Baqavi	باقوي	
          </option>
          <option value="rahmani">
          Rahmani	رحماني
          </option>
          <option value="azhari">
          Azhari	أزهري
          </option>
          <option value="maniyi">
          Maniyi	—
          </option>
          <option value="zahravi">
          Zahravi	زهراوي
          </option>
        </select>
      </div>
  
)}
      
      
    

      <FormField
        label="Institution"
        name="islamicInstitution"
        value={formData.islamicInstitution}
        onChange={handleChange}
        placeholder="Madrasa / Arabic College / Institution"
       
      />

      <FormField
        label="Year of Passing"
        name="islamicYearOfPassing"
        value={formData.islamicYearOfPassing}
        onChange={handleChange}
        placeholder="Example: 2022"
        type="number"
        required
      />

      <FormField
        label="Teaching Experience"
        name="islamicTeachingExperience"
        value={formData.islamicTeachingExperience}
        onChange={handleChange}
        placeholder="Example: 5 Years"
        required
      />
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Quran Qualification
          <span className="ml-1 text-red-500">*</span>
        </label>

        <select
          name="quranQualification"
          value={formData.quranQualification}
          onChange={handleChange}
          required
          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
        >
          <option value="">
            Select Qualification
          </option>

          <option value="hizb">
            Hizb (حزب)
          </option>
          <option value="hafiz">
            Hafiz  (حافظ)
          </option>

          <option value="general">
            General (عام)
          </option>
          
        </select>
      </div>

    </div>

  </div>

  {/* ==========================================
      CERTIFICATE
  =========================================== */}

  <div className="mt-8 border-t border-slate-100 pt-7">

    <label className="mb-2 block text-sm font-semibold text-slate-700">
      Qualification Certificate
    </label>

    <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-teal-400 hover:bg-teal-50/40">

      <UploadCloud className="h-9 w-9 text-teal-600" />

      <p className="mt-3 text-sm font-semibold text-slate-800">
        Upload qualification certificate
      </p>

      <p className="mt-1 text-xs text-slate-500">
        PDF, JPG or PNG
      </p>

      <input
        type="file"
        accept=".pdf,image/*"
        onChange={handleCertificate}
        className="hidden"
      />

      {formData.certificateFile && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-teal-700 shadow-sm">
          <FileText className="h-4 w-4" />

          {formData.certificateFile.name}
        </div>
      )}

    </label>

  </div>

</SectionCard>

            {/* ============================= */}
            {/* BANK */}
            {/* ============================= */}

            <SectionCard
              icon={Landmark}
              title="Bank Account Details"
              description="Provide the bank account to be used for Digital Classroom payment processing."
            >

              <div className="grid gap-5 md:grid-cols-2">

                <FormField
                  label="Account Holder Name"
                  name="accountHolderName"
                  value={
                    formData.accountHolderName
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Account holder name"
                  required
                />

                <FormField
                  label="Bank Name"
                  name="bankName"
                  value={
                    formData.bankName
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Bank name"
                  required
                />

                <FormField
                  label="Account Number"
                  name="accountNumber"
                  value={
                    formData.accountNumber
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Bank account number"
                  required
                />

                <FormField
                  label="Confirm Account Number"
                  name="confirmAccountNumber"
                  value={
                    formData.confirmAccountNumber
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Re-enter account number"
                  required
                />

                <FormField
                  label="IFSC Code"
                  name="ifscCode"
                  value={
                    formData.ifscCode
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Example: SBIN0001234"
                  required
                  uppercase
                />

                <FormField
                  label="Branch Name"
                  name="branchName"
                  value={
                    formData.branchName
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Bank branch"
                />

                <FormField
                  label="UPI ID"
                  name="upiId"
                  value={
                    formData.upiId
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Optional"
                />

              </div>

              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">

                <div className="flex gap-3">

                  <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                  <p className="text-xs leading-5 text-amber-800">
                    Please verify your bank
                    information carefully before
                    submitting the application.
                    Bank details will be visible
                    only to authorized
                    administration.
                  </p>

                </div>

              </div>

            </SectionCard>

            {/* ============================= */}
            {/* DECLARATION */}
            {/* ============================= */}

            <SectionCard
              icon={CheckCircle2}
              title="Declaration"
              description="Confirm the information before submitting."
            >

              <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">

                <input
                  type="checkbox"
                  name="declaration"
                  checked={
                    formData.declaration
                  }
                  onChange={
                    handleChange
                  }
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />

                <div>
                  <p className="font-semibold text-slate-800">
                    I confirm that the information
                    provided is correct.
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    I understand that this
                    application will be reviewed
                    by Central Admin. Digital
                    Teacher login credentials,
                    assigned classes, subjects
                    and teaching medium will be
                    configured only after
                    approval.
                  </p>
                </div>

              </label>

            </SectionCard>

            {/* ============================= */}
            {/* MESSAGE */}
            {/* ============================= */}

            {message && (
              <div className="rounded-2xl border border-teal-100 bg-teal-50 px-5 py-4 text-sm font-medium text-teal-800">
                {message}
              </div>
            )}

            {/* ============================= */}
            {/* SUBMIT */}
            {/* ============================= */}

            <div className="flex justify-end">

              <button
                type="submit"
                disabled={
                  submitting
                }
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-7 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />

                    Submitting...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Submit Digital Teacher Application
                  </>
                )}
              </button>

            </div>

          </form>
) : applicationStatus === "pending" ? (

  <div className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm">

    <div className="flex items-start gap-4">

      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50">
        <ShieldCheck className="h-6 w-6 text-amber-700" />
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-900">
          Application Under Board Review
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Your Digital Teacher application has been
          submitted successfully. The Board is currently
          reviewing your qualification and other details.
        </p>

        <div className="mt-4 inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
          Status: Pending Review
        </div>
      </div>

    </div>

  </div>

) : applicationStatus === "approved" ? (

  <div className="space-y-6">

    {/* APPROVED MESSAGE */}

    <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">

      <div className="flex items-start gap-4">

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50">
          <CheckCircle2 className="h-6 w-6 text-emerald-700" />
        </div>

        <div>
          <p className="text-sm font-semibold text-emerald-700">
            Digital Classroom
          </p>

          <h2 className="mt-1 text-xl font-bold text-slate-900">
            Digital Teacher Account Approved
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Your Digital Teacher application has been approved.
            Your Digital Classroom account and teaching
            assignments are now ready.
          </p>

          <div className="mt-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            Account Status: Active
          </div>
        </div>

      </div>

    </div>

    {/* LOGIN ACCOUNT */}

    <SectionCard
      icon={User}
      title="Digital Teacher Account"
      description="Use this account to access the Digital Teacher Portal."
    >

      <div className="grid gap-5 md:grid-cols-2">

        <ReadOnlyField
          icon={Mail}
          label="Digital Teacher Email"
          value={
            applicationData?.digitalTeacherEmail ||
            "Not assigned"
          }
        />

        <ReadOnlyField
          icon={ShieldCheck}
          label="Account Status"
          value={
            applicationData?.accountStatus ||
            "active"
          }
        />

        <ReadOnlyField
          icon={CheckCircle2}
          label="Digital Classroom Access"
          value={
            applicationData?.digitalClassAccess
              ? "Enabled"
              : "Disabled"
          }
        />

      </div>

    </SectionCard>

    {/* TEACHING ASSIGNMENT */}

    <SectionCard
      icon={GraduationCap}
      title="Teaching Assignment"
      description="Classes, subjects and teaching medium assigned by Central Admin."
    >

      <div className="grid gap-6 lg:grid-cols-3">

        {/* CLASSES */}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">

          <p className="text-sm font-bold text-slate-900">
            Assigned Classes
          </p>

          <div className="mt-4 flex flex-wrap gap-2">

            {applicationData?.teachingAssignment?.classes
              ?.length > 0 ? (
              applicationData.teachingAssignment.classes.map(
                (item) => (
                  <span
                    key={item}
                    className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700"
                  >
                    {item}
                  </span>
                ),
              )
            ) : (
              <span className="text-sm text-slate-500">
                No classes assigned
              </span>
            )}

          </div>

        </div>

        {/* SUBJECTS */}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">

          <p className="text-sm font-bold text-slate-900">
            Assigned Subjects
          </p>

          <div className="mt-4 flex flex-wrap gap-2">

            {applicationData?.teachingAssignment?.subjects
              ?.length > 0 ? (
              applicationData.teachingAssignment.subjects.map(
                (item) => (
                  <span
                    key={item}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
                  >
                    {item}
                  </span>
                ),
              )
            ) : (
              <span className="text-sm text-slate-500">
                No subjects assigned
              </span>
            )}

          </div>

        </div>

        {/* LANGUAGE */}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">

          <p className="text-sm font-bold text-slate-900">
            Teaching Medium
          </p>

          <div className="mt-4 flex flex-wrap gap-2">

            {applicationData?.teachingAssignment?.languages
              ?.length > 0 ? (
              applicationData.teachingAssignment.languages.map(
                (item) => (
                  <span
                    key={item}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
                  >
                    {item}
                  </span>
                ),
              )
            ) : (
              <span className="text-sm text-slate-500">
                No medium assigned
              </span>
            )}

          </div>

        </div>

      </div>

    </SectionCard>

    {/* LOGIN BUTTON */}

    <div className="flex justify-end">

      <a
        href="/auth/login/digital-teacher"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-7 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800"
      >
        <User className="h-4 w-4" />

        Go to Digital Teacher Login
      </a>

    </div>

  </div>

) : applicationStatus === "rejected" ? (

  <div className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm">

    <h2 className="text-lg font-bold text-red-700">
      Application Rejected
    </h2>

    <p className="mt-2 text-sm text-slate-600">
      {applicationData?.rejectionReason ||
        "Your Digital Teacher application was not approved."}
    </p>

  </div>

) : null}

        </div>
      </div>
    </main>
    </Layout>
  );
}

