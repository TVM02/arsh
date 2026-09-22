"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import useAuthStore from "@/lib/authStore";

import Layout from "@/components/Layout";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Button,
} from "@/components/ui/button";

import {
  Badge,
} from "@/components/ui/badge";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  CheckCircle2,
  Clock3,
  Globe,
  Loader2,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import {
  toast,
} from "sonner";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

import {
  CATEGORIES,
} from "@/lib/competitionUtils";


/* =========================================================
   GRADE COLOR
========================================================= */

function gradeColor(grade) {
  switch (grade) {
    case "A+":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";

    case "A":
      return "bg-green-100 text-green-800 border-green-200";

    case "B+":
      return "bg-blue-100 text-blue-800 border-blue-200";

    case "B":
      return "bg-sky-100 text-sky-800 border-sky-200";

    case "C":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";

    default:
      return "bg-red-100 text-red-800 border-red-200";
  }
}


/* =========================================================
   MAIN PAGE
========================================================= */

export default function MekhalaScoreVerificationPage() {
  const {
    user,
    userData,
  } = useAuthStore();


  const [
    mekhalaMarks,
    setMekhalaMarks,
  ] = useState([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    actionId,
    setActionId,
  ] = useState(null);


  const [
    confirmVerify,
    setConfirmVerify,
  ] = useState(null);


  const [
    confirmPublish,
    setConfirmPublish,
  ] = useState(null);

const [
  confirmUnpublish,
  setConfirmUnpublish,
] = useState(null);

  /* =======================================================
     CURRENT MEKHALA

     Adjust only this mapping if your authStore uses
     another exact field.
  ======================================================= */

  const mekhalaId =
    userData?.mekhalaId ||
    userData?.mekhala?.id ||
    userData?.mekhalaID ||
    "";


  const mekhalaName =
    userData?.name ||
    userData?.mekhala?.name ||
    "";


  /* =======================================================
     LOAD MEKHALA MARKS
  ======================================================= */
const load = useCallback(
  async () => {
    setLoading(true);

    try {
      if (
        !mekhalaId &&
        !mekhalaName
      ) {
        setMekhalaMarks([]);

        toast.error(
          "Mekhala information not found.",
        );

        return;
      }

      const requests = [];


      /* =====================================
         QUERY BY MEKHALA ID
      ====================================== */

      if (mekhalaId) {
        requests.push(
          getDocs(
            query(
              collection(
                db,
                "competition_mekhala_marks",
              ),
              where(
                "mekhalaId",
                "==",
                mekhalaId,
              ),
            ),
          ),
        );
      }


      /* =====================================
         QUERY BY MEKHALA NAME
      ====================================== */

      if (mekhalaName) {
        requests.push(
          getDocs(
            query(
              collection(
                db,
                "competition_mekhala_marks",
              ),
              where(
                "mekhalaName",
                "==",
                mekhalaName,
              ),
            ),
          ),
        );
      }


      /* =====================================
         GET ALL MATCHING RESULTS
      ====================================== */

      const snapshots =
        await Promise.all(
          requests,
        );


      /* =====================================
         MERGE + REMOVE DUPLICATES
      ====================================== */

      const resultMap =
        new Map();


      snapshots.forEach(
        (snapshot) => {
          snapshot.docs.forEach(
            (resultDoc) => {
              resultMap.set(
                resultDoc.id,
                {
                  id:
                    resultDoc.id,

                  ...resultDoc.data(),
                },
              );
            },
          );
        },
      );


      const results =
        Array.from(
          resultMap.values(),
        );


      console.log(
        "Mekhala ID:",
        mekhalaId,
      );

      console.log(
        "Mekhala Name:",
        mekhalaName,
      );

      console.log(
        "Total Mekhala Marks:",
        results.length,
      );

      console.table(
        results.map(
          (mark) => ({
            id:
              mark.id,

            student:
              mark.students
                ?.map(
                  (student) =>
                    student.name,
                )
                .join(", ") ||
              mark.studentName ||
              "",

            event:
              mark.eventName,

            mekhalaId:
              mark.mekhalaId,

            mekhalaName:
              mark.mekhalaName,

            status:
              mark.verificationStatus ||
              "pending",

            total:
              mark.total,
          }),
        ),
      );


      setMekhalaMarks(
        results,
      );
    } catch (error) {
      console.error(
        "Failed to load Mekhala marks:",
        error,
      );

      setMekhalaMarks([]);

      toast.error(
        error?.message ||
          "Failed to load Mekhala marks",
      );
    } finally {
      setLoading(false);
    }
  },

  [
    mekhalaId,
    mekhalaName,
  ],
);


  useEffect(() => {
    load();
  }, [load]);


  /* =======================================================
     RESULT GROUPS
  ======================================================= */

  const pending =
    useMemo(
      () =>
        mekhalaMarks.filter(
          (mark) =>
            !mark.verificationStatus ||
            mark.verificationStatus ===
              "pending",
        ),

      [mekhalaMarks],
    );


  const verified =
    useMemo(
      () =>
        mekhalaMarks.filter(
          (mark) =>
            mark.verificationStatus ===
            "verified",
        ),

      [mekhalaMarks],
    );


  const published =
    useMemo(
      () =>
        mekhalaMarks.filter(
          (mark) =>
            mark.verificationStatus ===
            "published",
        ),

      [mekhalaMarks],
    );


  /* =======================================================
     VERIFY RESULT

     pending → verified
  ======================================================= */

  const handleVerify =
    async (mark) => {
      if (!mark?.id) {
        return;
      }

      setActionId(mark.id);

      try {
        await updateDoc(
          doc(
            db,
            "competition_mekhala_marks",
            mark.id,
          ),

          {
            verificationStatus:
              "verified",

            verifiedAt:
              serverTimestamp(),

            verifiedBy:
              user?.uid ||
              null,

            updatedAt:
              serverTimestamp(),
          },
        );


        toast.success(
          `${mark.eventName || "Result"} verified successfully`,
        );


        await load();
      } catch (error) {
        console.error(
          "Mekhala result verification error:",
          error,
        );

        toast.error(
          "Failed to verify result",
        );
      } finally {
        setActionId(null);
      }
    };


  /* =======================================================
     PUBLISH RESULT

     verified → published
  ======================================================= */

  const handlePublish =
    async (mark) => {
      if (!mark?.id) {
        return;
      }


      if (
        mark.verificationStatus !==
        "verified"
      ) {
        toast.error(
          "Verify this result before publishing.",
        );

        return;
      }


      setActionId(mark.id);


      try {
        await updateDoc(
          doc(
            db,
            "competition_mekhala_marks",
            mark.id,
          ),

          {
            verificationStatus:
              "published",

            publishedAt:
              serverTimestamp(),

            publishedBy:
              user?.uid ||
              null,

            updatedAt:
              serverTimestamp(),
          },
        );


        toast.success(
          `${mark.eventName || "Result"} published to live scoreboard`,
        );


        await load();
      } catch (error) {
        console.error(
          "Mekhala result publishing error:",
          error,
        );

        toast.error(
          "Failed to publish result",
        );
      } finally {
        setActionId(null);
      }
    };

    /* =======================================================
   UNPUBLISH RESULT

   published → verified
======================================================= */

const handleUnpublish =
  async (mark) => {
    if (!mark?.id) {
      return;
    }

    if (
      mark.verificationStatus !==
      "published"
    ) {
      toast.error(
        "This result is not published.",
      );

      return;
    }

    setActionId(mark.id);

    try {
      await updateDoc(
        doc(
          db,
          "competition_mekhala_marks",
          mark.id,
        ),
        {
          verificationStatus:
            "verified",

          publishedAt:
            null,

          publishedBy:
            null,

          unpublishedAt:
            serverTimestamp(),

          unpublishedBy:
            user?.uid || null,

          updatedAt:
            serverTimestamp(),
        },
      );

      toast.success(
        `${mark.eventName || "Result"} unpublished successfully`,
      );

      await load();
    } catch (error) {
      console.error(
        "Mekhala result unpublish error:",
        error,
      );

      toast.error(
        "Failed to unpublish result",
      );
    } finally {
      setActionId(null);
    }
  };

  /* =======================================================
     TABLE ROW
  ======================================================= */

  const renderTableRow = (
    mark,
    mode,
  ) => {
    const isLoading =
      actionId === mark.id;


    const studentNames =
      Array.isArray(
        mark.students,
      )
        ? mark.students
            .map(
              (student) =>
                student?.name,
            )
            .filter(Boolean)
        : [];


    return (
      <TableRow
        key={mark.id}
        className="
          hover:bg-teal-50/40
        "
      >
        {/* STUDENT */}

        <TableCell className="font-medium">
          <div
            className="
              flex
              flex-col
              gap-1
            "
          >
            {studentNames.length >
            0 ? (
              studentNames.map(
                (
                  name,
                  index,
                ) => (
                  <span
                    key={index}
                    className="whitespace-nowrap"
                  >
                    {name}
                  </span>
                ),
              )
            ) : (
              <span>
                {mark.studentName ||
                  "—"}
              </span>
            )}
          </div>
        </TableCell>


        {/* EVENT */}

        <TableCell className="font-medium">
          {mark.eventName ||
            "—"}
        </TableCell>


        {/* CATEGORY */}

        <TableCell>
          <Badge variant="outline">
            {CATEGORIES[
              mark.category
            ]?.label ||
              mark.category ||
              "—"}
          </Badge>
        </TableCell>


        {/* MADRASA */}

        <TableCell className="whitespace-nowrap">
          <div>
            <p className="font-medium text-slate-800">
              {mark.madarsaName ||
                "—"}
            </p>

            {mark.madarsaId && (
              <p
                className="
                  mt-0.5
                  text-xs
                  text-gray-400
                "
              >
                {mark.madarsaId}
              </p>
            )}
          </div>
        </TableCell>


        {/* M1 */}

        <TableCell
          className="
            border-l
            text-center
          "
        >
          {mark.mark1 ??
            "—"}
        </TableCell>


        {/* M2 */}

        <TableCell className="text-center">
          {mark.mark2 ??
            "—"}
        </TableCell>


        {/* M3 */}

        <TableCell className="text-center">
          {mark.mark3 ??
            "—"}
        </TableCell>


        {/* TOTAL */}

        <TableCell
          className="
            border-l
            border-teal-100
            bg-teal-50/60
            text-center
            text-lg
            font-bold
            text-teal-800
          "
        >
          {mark.total ??
            mark.finalScore ??
            "—"}
        </TableCell>


        {/* GRADE */}

        <TableCell
          className="
            border-r
            border-teal-100
            bg-teal-50/60
          "
        >
          {mark.grade ? (
            <Badge
              className={gradeColor(
                mark.grade,
              )}
            >
              {mark.grade}
            </Badge>
          ) : (
            "—"
          )}
        </TableCell>


        {/* STATUS */}

        <TableCell>
          {mode ===
            "pending" && (
            <Badge
              variant="outline"
              className="
                border-amber-200
                bg-amber-50
                text-amber-700
              "
            >
              Pending
            </Badge>
          )}


          {mode ===
            "verified" && (
            <Badge
              variant="outline"
              className="
                border-teal-200
                bg-teal-50
                text-teal-700
              "
            >
              Verified
            </Badge>
          )}


          {mode ===
            "published" && (
            <Badge
              variant="outline"
              className="
                border-emerald-200
                bg-emerald-50
                text-emerald-700
              "
            >
              Published
            </Badge>
          )}
        </TableCell>


        {/* ACTION */}

      
          <TableCell className="text-center">
  {/* PENDING → VERIFY */}

  {mode === "pending" && (
    <Button
      size="sm"
      onClick={() =>
        setConfirmVerify(mark)
      }
      disabled={isLoading}
      className="
        gap-1
        bg-teal-600
        text-white
        shadow-sm
        hover:bg-teal-700
      "
    >
      {isLoading ? (
        <Loader2
          className="
            h-3
            w-3
            animate-spin
          "
        />
      ) : (
        <ShieldCheck className="h-3 w-3" />
      )}

      Verify
    </Button>
  )}


  {/* VERIFIED → PUBLISH */}

  {mode === "verified" && (
    <Button
      size="sm"
      onClick={() =>
        setConfirmPublish(mark)
      }
      disabled={isLoading}
      className="
        gap-1
        bg-emerald-600
        text-white
        shadow-sm
        hover:bg-emerald-700
      "
    >
      {isLoading ? (
        <Loader2
          className="
            h-3
            w-3
            animate-spin
          "
        />
      ) : (
        <Globe className="h-3 w-3" />
      )}

      Publish
    </Button>
  )}


  {/* PUBLISHED → UNPUBLISH */}

  {mode === "published" && (
    <Button
      size="sm"
      variant="outline"
      onClick={() =>
        setConfirmUnpublish(mark)
      }
      disabled={isLoading}
      className="
        gap-1
        border-red-200
        bg-red-50
        text-red-700
        hover:border-red-300
        hover:bg-red-100
        hover:text-red-800
      "
    >
      {isLoading ? (
        <Loader2
          className="
            h-3
            w-3
            animate-spin
          "
        />
      ) : (
        <Globe className="h-3 w-3" />
      )}

      Unpublish
    </Button>
  )}
</TableCell>
       
      </TableRow>
    );
  };


  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <Layout>
        <div
          className="
            flex
            h-64
            items-center
            justify-center
            gap-3
            text-gray-400
          "
        >
          <Loader2
            className="
              h-5
              w-5
              animate-spin
              text-teal-600
            "
          />

          Loading Mekhala results…
        </div>
      </Layout>
    );
  }


  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <Layout>
      <div
        className="
          mx-auto
          max-w-[1400px]
          space-y-6
          p-6
        "
      >
        {/* =====================================
            HEADER
        ====================================== */}

        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <div
            className="
              rounded-lg
              bg-teal-100
              p-2
            "
          >
            <ShieldCheck
              className="
                h-6
                w-6
                text-teal-700
              "
            />
          </div>


          <div>
            <h1
              className="
                text-2xl
                font-semibold
                text-teal-900
              "
            >
              Mekhala Score Verification
            </h1>

            <p
              className="
                text-sm
                text-gray-500
              "
            >
              Review, verify and publish
              Mekhala Fest results to the
              public live scoreboard
            </p>
          </div>
        </div>


        {/* =====================================
            MEKHALA INFO
        ====================================== */}

        <Card
          className="
            border-teal-100
            bg-gradient-to-r
            from-teal-50
            to-emerald-50
          "
        >
          <CardContent className="p-4">
            <div
              className="
                flex
                flex-wrap
                items-center
                justify-between
                gap-4
              "
            >
              <div>
                <p
                  className="
                    text-xs
                    font-medium
                    uppercase
                    tracking-wider
                    text-teal-600
                  "
                >
                  Current Mekhala
                </p>

                <p
                  className="
                    mt-1
                    text-lg
                    font-bold
                    text-teal-900
                  "
                >
                  {mekhalaName ||
                    mekhalaMarks?.[0]
                      ?.mekhalaName ||
                    "Mekhala"}
                </p>
              </div>


              <Trophy
                className="
                  h-7
                  w-7
                  text-amber-500
                "
              />
            </div>
          </CardContent>
        </Card>


        {/* =====================================
            SUMMARY
        ====================================== */}

        <div
          className="
            grid
            grid-cols-1
            gap-4
            sm:grid-cols-3
          "
        >
          {/* PENDING */}

          <Card
            className="
              border
              border-amber-200
              bg-amber-50
              text-amber-700
            "
          >
            <CardContent
              className="
                p-4
                text-center
              "
            >
              <Clock3
                className="
                  mx-auto
                  mb-2
                  h-5
                  w-5
                "
              />

              <p className="text-3xl font-bold">
                {pending.length}
              </p>

              <p className="text-sm font-medium">
                Pending
              </p>
            </CardContent>
          </Card>


          {/* VERIFIED */}

          <Card
            className="
              border
              border-teal-200
              bg-teal-50
              text-teal-700
            "
          >
            <CardContent
              className="
                p-4
                text-center
              "
            >
              <ShieldCheck
                className="
                  mx-auto
                  mb-2
                  h-5
                  w-5
                "
              />

              <p className="text-3xl font-bold">
                {verified.length}
              </p>

              <p className="text-sm font-medium">
                Verified
              </p>
            </CardContent>
          </Card>


          {/* PUBLISHED */}

          <Card
            className="
              border
              border-emerald-200
              bg-emerald-50
              text-emerald-700
            "
          >
            <CardContent
              className="
                p-4
                text-center
              "
            >
              <CheckCircle2
                className="
                  mx-auto
                  mb-2
                  h-5
                  w-5
                "
              />

              <p className="text-3xl font-bold">
                {published.length}
              </p>

              <p className="text-sm font-medium">
                Published
              </p>
            </CardContent>
          </Card>
        </div>


        {/* =====================================
            NO RESULTS
        ====================================== */}

        {mekhalaMarks.length ===
          0 && (
          <Card
            className="
              border-2
              border-dashed
              border-teal-100
              bg-teal-50/30
            "
          >
            <CardContent
              className="
                py-12
                text-center
                font-medium
                text-teal-600
              "
            >
              No Mekhala marks found.
            </CardContent>
          </Card>
        )}


        {/* =====================================
            PENDING TABLE
        ====================================== */}

        {pending.length >
          0 && (
          <Card
            className="
              overflow-hidden
              border-amber-200
              shadow-md
            "
          >
            <CardHeader
              className="
                border-b
                border-amber-100
                bg-amber-50
                py-4
              "
            >
              <CardTitle
                className="
                  text-sm
                  font-semibold
                  text-amber-800
                "
              >
                Pending Verification (
                {pending.length})
              </CardTitle>
            </CardHeader>


            <CardContent
              className="
                overflow-x-auto
                p-0
              "
            >
              <Table>
                <ResultTableHeader
                  showAction
                />

                <TableBody>
                  {pending.map(
                    (mark) =>
                      renderTableRow(
                        mark,
                        "pending",
                      ),
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}


        {/* =====================================
            VERIFIED TABLE
        ====================================== */}

        {verified.length >
          0 && (
          <Card
            className="
              mt-6
              overflow-hidden
              border-teal-200
              shadow-md
            "
          >
            <CardHeader
              className="
                border-b
                border-teal-100
                bg-teal-50
                py-4
              "
            >
              <CardTitle
                className="
                  text-sm
                  font-semibold
                  text-teal-800
                "
              >
                Verified Results (
                {verified.length})
              </CardTitle>
            </CardHeader>


            <CardContent
              className="
                overflow-x-auto
                p-0
              "
            >
              <Table>
                <ResultTableHeader
                  showAction
                />

                <TableBody>
                  {verified.map(
                    (mark) =>
                      renderTableRow(
                        mark,
                        "verified",
                      ),
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}


        {/* =====================================
            PUBLISHED TABLE
        ====================================== */}

        {published.length >
          0 && (
          <Card
            className="
              mt-6
              overflow-hidden
              border-emerald-200
              shadow-md
            "
          >
            <CardHeader
              className="
                border-b
                border-emerald-100
                bg-emerald-50
                py-4
              "
            >
              <CardTitle
                className="
                  text-sm
                  font-semibold
                  text-emerald-800
                "
              >
                Published Results (
                {published.length})
              </CardTitle>
            </CardHeader>


            <CardContent
              className="
                overflow-x-auto
                p-0
              "
            >
              <Table>
                <ResultTableHeader />

                <TableBody>
                  {published.map(
                    (mark) =>
                      renderTableRow(
                        mark,
                        "published",
                      ),
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>


      {/* =========================================
          VERIFY CONFIRMATION
      ========================================== */}

      <AlertDialog
        open={
          !!confirmVerify
        }
        onOpenChange={(
          open,
        ) => {
          if (!open) {
            setConfirmVerify(
              null,
            );
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Verify Result?
            </AlertDialogTitle>

            <AlertDialogDescription>
              Verify{" "}

              <strong>
                {
                  confirmVerify
                    ?.eventName
                }
              </strong>

              {" "}result for{" "}

              <strong>
                {
                  confirmVerify
                    ?.madarsaName
                }
              </strong>
              ?

              <br />
              <br />

              After verification, the
              result can be published to
              the public live scoreboard.
            </AlertDialogDescription>
          </AlertDialogHeader>


          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() =>
                setConfirmVerify(
                  null,
                )
              }
            >
              Cancel
            </AlertDialogCancel>


            <AlertDialogAction
              className="
                bg-teal-600
                text-white
                hover:bg-teal-700
              "
              onClick={() => {
                const mark =
                  confirmVerify;

                setConfirmVerify(
                  null,
                );

                handleVerify(
                  mark,
                );
              }}
            >
              Verify Result
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* =========================================
          PUBLISH CONFIRMATION
      ========================================== */}

      <AlertDialog
        open={
          !!confirmPublish
        }
        onOpenChange={(
          open,
        ) => {
          if (!open) {
            setConfirmPublish(
              null,
            );
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Publish Result?
            </AlertDialogTitle>

            <AlertDialogDescription>
              Publish{" "}

              <strong>
                {
                  confirmPublish
                    ?.eventName
                }
              </strong>

              {" "}to the public
              Thanfase live scoreboard?

              <br />
              <br />

              Once published, this result
              becomes publicly visible.
            </AlertDialogDescription>
          </AlertDialogHeader>


          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() =>
                setConfirmPublish(
                  null,
                )
              }
            >
              Cancel
            </AlertDialogCancel>


            <AlertDialogAction
              className="
                bg-emerald-600
                text-white
                hover:bg-emerald-700
              "
              onClick={() => {
                const mark =
                  confirmPublish;

                setConfirmPublish(
                  null,
                );

                handlePublish(
                  mark,
                );
              }}
            >
              Publish Result
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* =========================================
    UNPUBLISH CONFIRMATION
========================================== */}

<AlertDialog
  open={!!confirmUnpublish}
  onOpenChange={(open) => {
    if (!open) {
      setConfirmUnpublish(null);
    }
  }}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>
        Unpublish Result?
      </AlertDialogTitle>

      <AlertDialogDescription>
        Are you sure you want to remove{" "}

        <strong>
          {confirmUnpublish?.eventName}
        </strong>

        {" "}from the public Thanfase live
        scoreboard?

        <br />
        <br />

        The result will remain verified and
        can be published again later.
      </AlertDialogDescription>
    </AlertDialogHeader>

    <AlertDialogFooter>
      <AlertDialogCancel
        onClick={() =>
          setConfirmUnpublish(null)
        }
      >
        Cancel
      </AlertDialogCancel>

      <AlertDialogAction
        className="
          bg-red-600
          text-white
          hover:bg-red-700
        "
        onClick={() => {
          const mark =
            confirmUnpublish;

          setConfirmUnpublish(null);

          handleUnpublish(mark);
        }}
      >
        Unpublish Result
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
    </Layout>
  );
}


/* =========================================================
   TABLE HEADER
========================================================= */

function ResultTableHeader({
  showAction = false,
}) {
  return (
    <TableHeader>
      <TableRow
        className="
          border-b
          bg-gray-50
        "
      >
        <TableHead className="font-semibold text-slate-700">
          Student(s)
        </TableHead>

        <TableHead className="font-semibold text-slate-700">
          Event
        </TableHead>

        <TableHead className="font-semibold text-slate-700">
          Category
        </TableHead>

        <TableHead className="font-semibold text-slate-700">
          Madrasa
        </TableHead>

        <TableHead className="border-l text-center font-semibold text-slate-700">
          M1
        </TableHead>

        <TableHead className="text-center font-semibold text-slate-700">
          M2
        </TableHead>

        <TableHead className="text-center font-semibold text-slate-700">
          M3
        </TableHead>

        <TableHead
          className="
            border-l
            border-teal-100
            bg-teal-50/60
            text-center
            font-bold
            text-teal-800
          "
        >
          Total
        </TableHead>

        <TableHead
          className="
            border-r
            border-teal-100
            bg-teal-50/60
            font-bold
            text-teal-800
          "
        >
          Grade
        </TableHead>

        <TableHead className="font-semibold text-slate-700">
          Status
        </TableHead>

       
          <TableHead
            className="
              text-center
              font-semibold
              text-slate-700
            "
          >
            Action
          </TableHead>

      </TableRow>
    </TableHeader>
  );
}