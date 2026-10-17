"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Layout from "@/components/Layout";

import { getAuth } from "firebase/auth";

import {
  BookOpen,
  CheckCircle2,
  Plus,
  Save,
  X,
} from "lucide-react";

import {toast,} from "sonner";
import {
  getDigitalSyllabusSettings,
  saveDigitalSyllabusSettings,
} from "@/lib/digitalClassSyllabusService";




const DIGITAL_CLASS_SUBJECTS = [
  "Taalim",
  "Salsarani",
  "Thaalum",
  "Sullam",
  "Quran",
  "Hiphul Quran",
  "Aqeedah",
  "Fiqh",
  "Aghlaq",
  "Seerah",
  "Deeniyath",
  "Tajveet",
  "Sirat al-Nabi(PBUH)",
  "Al-Fiqh Shafi'i",
  "Al-Fiqh al-Hanafi",
  "Tariq",
  "Indian Parabaram",
  "Thadreesul Quran",
  "Al-Fiqh",
  "Khasasul Abiah",
  "Allugathul Abiyyay",
  "Tahdibuthullab",
  "Mufidath",
  "Adabul-Islamiyya",
  "Mughtaarath (Hadhis)",
];

const CLASS_OPTIONS = [
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


/*
  Temporary UI data.

  Next step we will load/save this
  from Firebase through API.
*/
const INITIAL_SYLLABUS = {
  "LKG": [],
  "UKG": [],

  "Class 1": [
    "Arabic",
    "Zeera",
    "Quran",
  ],

  "Class 2": [
    "Arabic",
    "Fiqh",
    "Quran",
  ],

  "Class 3": [],
  "Class 4": [],
  "Class 5": [],
  "Class 6": [],
  "Class 7": [],
  "Class 8": [],
  "Class 9": [],
  "Class 10": [],
  "Class 11": [],
  "Class 12": [],
};


export default function DigitalSyllabusSettingsPage() {
  const [
    selectedClass,
    setSelectedClass,
  ] = useState(
    "Class 1"
  );

const [syllabusSettings, setSyllabusSettings] =
  useState({});

const [loading, setLoading] = useState(true);

  const [
    subjectName,
    setSubjectName,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);


  const subjects =
    useMemo(
      () =>
        syllabusSettings[
          selectedClass
        ] || [],
      [
        syllabusSettings,
        selectedClass,
      ]
    );



    /* ============================================
   LOAD SYLLABUS SETTINGS FROM FIREBASE
============================================ */

useEffect(() => {
  let cancelled = false;

  const loadSettings = async () => {
    try {
      setLoading(true);

      const result =
        await getDigitalSyllabusSettings();

      if (cancelled) return;

      setSyllabusSettings(result.settings || {});
    } catch (error) {
      if (cancelled) return;

      console.error(
        "LOAD SYLLABUS SETTINGS ERROR:",
        error
      );

      toast.error(
        error?.message ||
        "Unable to load syllabus settings."
      );
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  };

  loadSettings();

  return () => {
    cancelled = true;
  };
}, []);

  /* ============================================
     ADD SUBJECT
  ============================================ */

  const handleAddSubject = () => {
    const cleanSubject =
      subjectName.trim();

    if (!cleanSubject) {
      toast.error(
        "Please enter a subject name."
      );

      return;
    }


    const alreadyExists =
      subjects.some(
        (subject) =>
          String(subject)
            .trim()
            .toLowerCase() ===
          cleanSubject.toLowerCase()
      );


    if (alreadyExists) {
      toast.error(
        "This subject is already added."
      );

      return;
    }


    setSyllabusSettings(
      (previous) => ({
        ...previous,

        [selectedClass]: [
          ...(
            previous[
              selectedClass
            ] || []
          ),

          cleanSubject,
        ],
      })
    );


    setSubjectName("");
  };


  /* ============================================
     REMOVE SUBJECT
  ============================================ */

  const handleRemoveSubject =
    (subjectNameToRemove) => {
      setSyllabusSettings(
        (previous) => ({
          ...previous,

          [selectedClass]:
            (
              previous[
                selectedClass
              ] || []
            ).filter(
              (subject) =>
                subject !==
                subjectNameToRemove
            ),
        })
      );
    };






const handleSave = async () => {
  if (loading || saving) return;

  const classToSave = selectedClass;
  const subjectsToSave = [...subjects];

  try {
    setSaving(true);

    const result =
      await saveDigitalSyllabusSettings({
        className: classToSave,
        subjects: subjectsToSave,
      });

    setSyllabusSettings((previous) => ({
      ...previous,
      [classToSave]:
        result.subjects || subjectsToSave,
    }));

    toast.success(
      `${classToSave} subjects saved successfully.`
    );
  } catch (error) {
    console.error(
      "SAVE SYLLABUS SETTINGS ERROR:",
      error
    );

    toast.error(
      error?.message ||
      "Unable to save syllabus settings."
    );
  } finally {
    setSaving(false);
  }
};


  return (
    <Layout>

      <main
        className="
          min-h-screen
          bg-[#f8faf8]
        "
      >

        <div
          className="
            space-y-6
            p-4
            sm:p-6
            lg:p-8
          "
        >

          {/* =====================================
              HEADER
          ====================================== */}

          <div
            className="
              flex
              flex-col
              gap-4
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >

            <div>

              <p
                className="
                  text-sm
                  font-semibold
                  text-teal-700
                "
              >
                Digital Classroom
              </p>


              <h1
                className="
                  mt-1
                  text-2xl
                  font-bold
                  text-slate-900
                  sm:text-3xl
                "
              >
                Syllabus Settings
              </h1>


              <p
                className="
                  mt-2
                  text-sm
                  text-slate-500
                "
              >
                Configure subjects for each
                Digital Classroom class.
              </p>

            </div>


            <button
              type="button"
              onClick={
                handleSave
              }
              disabled={saving || loading}
              className="
                inline-flex
                h-11
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-teal-700
                px-5
                text-sm
                font-bold
                text-white
                transition
                hover:bg-teal-800
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >

              <Save
                className="
                  h-4
                  w-4
                "
              />

              {
               loading
  ? "Loading..."
  : saving
  ? "Saving..."
  : "Save Settings"
              }

            </button>

          </div>


          {/* =====================================
              MAIN
          ====================================== */}

          <div
            className="
              grid
              gap-6
              lg:grid-cols-[280px_1fr]
            "
          >

            {/* ===================================
                CLASS LIST
            ==================================== */}

            <div
              className="
                rounded-2xl
                border
                border-slate-200
                bg-white
                p-4
                shadow-sm
              "
            >

              <div
                className="
                  mb-4
                  flex
                  items-center
                  gap-3
                "
              >

                <div
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    bg-teal-50
                    text-teal-700
                  "
                >
                  <BookOpen
                    className="
                      h-5
                      w-5
                    "
                  />
                </div>


                <div>

                  <p
                    className="
                      font-bold
                      text-slate-900
                    "
                  >
                    Classes
                  </p>

                  <p
                    className="
                      text-xs
                      text-slate-500
                    "
                  >
                    Select a class
                  </p>

                </div>

              </div>


              <div
                className="
                  space-y-2
                "
              >

                {
                  CLASS_OPTIONS.map(
                    (
                      className
                    ) => {

                      const count =
                        syllabusSettings[
                          className
                        ]?.length || 0;


                      const active =
                        selectedClass ===
                        className;


                      return (
                        <button
                          key={
                            className
                          }
                          type="button"
                          onClick={() =>
                            setSelectedClass(
                              className
                            )
                          }
                          className={`
                            flex
                            w-full
                            items-center
                            justify-between
                            rounded-xl
                            px-4
                            py-3
                            text-left
                            text-sm
                            font-semibold
                            transition

                            ${
                              active
                                ? "bg-teal-700 text-white shadow-sm"
                                : "bg-slate-50 text-slate-700 hover:bg-teal-50 hover:text-teal-800"
                            }
                          `}
                        >

                          <span>
                            {
                              className
                            }
                          </span>


                          <span
                            className={`
                              flex
                              h-6
                              min-w-6
                              items-center
                              justify-center
                              rounded-full
                              px-2
                              text-xs

                              ${
                                active
                                  ? "bg-white/20 text-white"
                                  : "bg-white text-slate-500"
                              }
                            `}
                          >
                            {
                              count
                            }
                          </span>

                        </button>
                      );
                    }
                  )
                }

              </div>

            </div>


            {/* ===================================
                SUBJECT SETTINGS
            ==================================== */}

            <div
              className="
                rounded-2xl
                border
                border-slate-200
                bg-white
                shadow-sm
              "
            >

              {/* HEADER */}

              <div
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-slate-100
                  px-5
                  py-5
                  sm:px-6
                "
              >

                <div>

                  <p
                    className="
                      text-xs
                      font-bold
                      uppercase
                      tracking-wide
                      text-teal-700
                    "
                  >
                    Selected Class
                  </p>


                  <h2
                    className="
                      mt-1
                      text-xl
                      font-bold
                      text-slate-900
                    "
                  >
                    {
                      selectedClass
                    }
                  </h2>

                </div>


                <div
                  className="
                    rounded-full
                    bg-teal-50
                    px-3
                    py-1.5
                    text-xs
                    font-semibold
                    text-teal-700
                  "
                >
                  {
                    subjects.length
                  }{" "}
                  Subjects
                </div>

              </div>


              <div
                className="
                  p-5
                  sm:p-6
                "
              >

                {/* ADD SUBJECT */}

                <div
                  className="
                    rounded-2xl
                    border
                    border-slate-200
                    bg-slate-50
                    p-4
                  "
                >

                  <label
                    className="
                      mb-2
                      block
                      text-sm
                      font-semibold
                      text-slate-800
                    "
                  >
                    Add Subject
                  </label>


                  <div
                    className="
                      flex
                      flex-col
                      gap-3
                      sm:flex-row
                    "
                  >

                   
<select
  value={subjectName}
  onChange={(event) =>
    setSubjectName(event.target.value)
  }
  className="
    h-11
    min-w-0
    flex-1
    rounded-xl
    border
    border-slate-200
    bg-white
    px-4
    text-sm
    text-slate-700
    outline-none
    transition
    focus:border-teal-500
    focus:ring-4
    focus:ring-teal-500/10
  "
>
  <option value="">
    Select Subject
  </option>

  {DIGITAL_CLASS_SUBJECTS.map((subject) => (
    <option
      key={subject}
      value={subject}
      disabled={subjects.includes(subject)}
    >
      {subject}
      {subjects.includes(subject)
        ? " (Already Added)"
        : ""}
    </option>
  ))}
</select>



                    <button
                      type="button"
                      onClick={
                        handleAddSubject
                      }
                      className="
                        inline-flex
                        h-11
                        items-center
                        justify-center
                        gap-2
                        rounded-xl
                        bg-slate-900
                        px-5
                        text-sm
                        font-semibold
                        text-white
                        transition
                        hover:bg-slate-800
                      "
                    >

                      <Plus
                        className="
                          h-4
                          w-4
                        "
                      />

                      Add Subject

                    </button>

                  </div>

                </div>


                {/* SUBJECT LIST */}

                <div
                  className="
                    mt-6
                  "
                >

                  <div
                    className="
                      mb-4
                      flex
                      items-center
                      justify-between
                    "
                  >

                    <div>

                      <h3
                        className="
                          font-bold
                          text-slate-900
                        "
                      >
                        Subjects
                      </h3>

                      <p
                        className="
                          mt-1
                          text-xs
                          text-slate-500
                        "
                      >
                        Subjects available
                        for{" "}
                        {
                          selectedClass
                        }.
                      </p>

                    </div>

                  </div>


                  {
                    subjects.length >
                    0 ? (

                      <div
                        className="
                          grid
                          gap-3
                          sm:grid-cols-2
                          xl:grid-cols-3
                        "
                      >

                        {
                          subjects.map(
                            (
                              subject
                            ) => (

                              <div
                                key={
                                  subject
                                }
                                className="
                                  flex
                                  items-center
                                  justify-between
                                  rounded-xl
                                  border
                                  border-teal-100
                                  bg-teal-50
                                  px-4
                                  py-3
                                "
                              >

                                <div
                                  className="
                                    flex
                                    items-center
                                    gap-3
                                  "
                                >

                                  <div
                                    className="
                                      flex
                                      h-8
                                      w-8
                                      items-center
                                      justify-center
                                      rounded-lg
                                      bg-white
                                      text-teal-700
                                    "
                                  >
                                    <CheckCircle2
                                      className="
                                        h-4
                                        w-4
                                      "
                                    />
                                  </div>


                                  <span
                                    className="
                                      text-sm
                                      font-semibold
                                      text-slate-800
                                    "
                                  >
                                    {
                                      subject
                                    }
                                  </span>

                                </div>


                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveSubject(
                                      subject
                                    )
                                  }
                                  className="
                                    flex
                                    h-8
                                    w-8
                                    items-center
                                    justify-center
                                    rounded-lg
                                    text-slate-400
                                    transition
                                    hover:bg-red-50
                                    hover:text-red-600
                                  "
                                  title="Remove subject"
                                >
                                  <X
                                    className="
                                      h-4
                                      w-4
                                    "
                                  />
                                </button>

                              </div>

                            )
                          )
                        }

                      </div>

                    ) : (

                      <div
                        className="
                          rounded-2xl
                          border
                          border-dashed
                          border-slate-300
                          bg-slate-50
                          px-6
                          py-12
                          text-center
                        "
                      >

                        <BookOpen
                          className="
                            mx-auto
                            h-9
                            w-9
                            text-slate-300
                          "
                        />


                        <p
                          className="
                            mt-3
                            text-sm
                            font-semibold
                            text-slate-700
                          "
                        >
                          No subjects added
                        </p>


                        <p
                          className="
                            mt-1
                            text-xs
                            text-slate-500
                          "
                        >
                          Add subjects for{" "}
                          {
                            selectedClass
                          }.
                        </p>

                      </div>

                    )
                  }

                </div>

              </div>

            </div>

          </div>

        </div>

      </main>

    </Layout>
  );
}