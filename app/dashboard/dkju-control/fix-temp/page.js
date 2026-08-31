"use client";

import React, { useState } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  runTransaction,
  query,
  where,
  getDoc,
  setDoc,
} from "firebase/firestore";

const COLLECTIONS = {
  ADMISSIONS: "admissions",
  STUDENTS: "students",
};

export default function FixTempIdsPage() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => {
    setLogs((prev) => [...prev, msg]);
    console.log(msg);
  };

  const generateAdmissionNumber = async (selectedMahal) => {
    const counterRef = doc(db, "counters", `admission_${selectedMahal}`);
    const counterSnap = await getDoc(counterRef);

    if (!counterSnap.exists()) {
      const [admSnap, stuSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.ADMISSIONS), where("madarsa", "==", selectedMahal))),
        getDocs(query(collection(db, COLLECTIONS.STUDENTS), where("madarsaId", "==", selectedMahal))),
      ]);
      let bootstrapMax = 0;
      const scanSeq = (snap) => {
        snap.forEach((d) => {
          const num = d.data().admissionNumber || d.data().studentId;
          if (num && typeof num === "string" && !num.startsWith("temp_")) {
            const parts = num.split("-");
            const seq = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(seq) && seq > bootstrapMax && seq < 100000) {
              bootstrapMax = seq;
            }
          }
        });
      };
      scanSeq(admSnap);
      scanSeq(stuSnap);
      if (bootstrapMax > 0) {
        await setDoc(counterRef, { count: bootstrapMax }, { merge: true });
      }
    }

    let admissionNumber;
    let nextCounterValue;

    try {
      ({ admissionNumber, nextCounterValue } = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        const currentCount = counterDoc.exists() ? (counterDoc.data().count ?? 0) : 0;
        const nextNumber = currentCount + 1;
        transaction.set(counterRef, { count: nextNumber }, { merge: true });
        const formatted = String(nextNumber).padStart(6, "0");
        return {
          admissionNumber: `${selectedMahal}-${formatted}`,
          nextCounterValue: nextNumber,
        };
      }));
    } catch (txError) {
      throw new Error("Could not reserve an admission number.");
    }

    try {
      const [dupInAdmissions, dupInStudents] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.ADMISSIONS), where("admissionNumber", "==", admissionNumber))),
        getDocs(query(collection(db, COLLECTIONS.STUDENTS), where("admissionNumber", "==", admissionNumber))),
      ]);

      const hasDuplicate = !dupInAdmissions.empty || !dupInStudents.empty;

      if (hasDuplicate) {
        const [admissionsSnap, studentsSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.ADMISSIONS), where("madarsa", "==", selectedMahal))),
          getDocs(query(collection(db, COLLECTIONS.STUDENTS), where("madarsaId", "==", selectedMahal))),
        ]);

        let maxSeq = nextCounterValue;
        const countSeq = (snap) => {
          snap.forEach((d) => {
            const num = d.data().admissionNumber || d.data().studentId;
            if (num && typeof num === "string" && !num.startsWith("temp_")) {
              const parts = num.split("-");
              const seq = parseInt(parts[parts.length - 1], 10);
              if (!isNaN(seq) && seq > maxSeq && seq < 100000) {
                maxSeq = seq;
              }
            }
          });
        };
        countSeq(admissionsSnap);
        countSeq(studentsSnap);

        const safeNumber = maxSeq + 1;
        await setDoc(counterRef, { count: safeNumber }, { merge: true });
        const formatted = String(safeNumber).padStart(6, "0");
        admissionNumber = `${selectedMahal}-${formatted}`;
      }
    } catch (e) {
      const fallbackNumber = Date.now().toString().slice(-6);
      admissionNumber = `${selectedMahal}-${fallbackNumber}`;
    }

    return admissionNumber;
  };

  const handleFixRecords = async () => {
    setLoading(true);
    setLogs([]);
    try {
      addLog("Fetching all admissions...");
      const admissionsSnap = await getDocs(collection(db, COLLECTIONS.ADMISSIONS));
      const admissionsToFix = admissionsSnap.docs.filter(
        (doc) => doc.data().admissionNumber?.startsWith("temp_")
      );
      addLog(`Found ${admissionsToFix.length} admission records to fix.`);

      for (const d of admissionsToFix) {
        const data = d.data();
        const madarsaId = data.madarsa || data.madarsaId;
        if (!madarsaId) {
          addLog(`Skipping ${d.id}: no madarsa ID found.`);
          continue;
        }

        const newId = await generateAdmissionNumber(madarsaId);
        addLog(`Updating admission ${d.id} (${data.admissionNumber}) -> ${newId}`);
        await updateDoc(doc(db, COLLECTIONS.ADMISSIONS, d.id), {
          admissionNumber: newId,
        });
      }

      addLog("Fetching all students...");
      const studentsSnap = await getDocs(collection(db, COLLECTIONS.STUDENTS));
      const studentsToFix = studentsSnap.docs.filter(
        (doc) =>
          doc.data().studentId?.startsWith("temp_") ||
          doc.data().admissionNumber?.startsWith("temp_")
      );
      addLog(`Found ${studentsToFix.length} student records to fix.`);

      for (const d of studentsToFix) {
        const data = d.data();
        const madarsaId = data.madarsaId || data.madarsa;
        if (!madarsaId) {
          addLog(`Skipping ${d.id}: no madarsa ID found.`);
          continue;
        }

        const newId = await generateAdmissionNumber(madarsaId);
        addLog(`Updating student ${d.id} (${data.studentId || data.admissionNumber}) -> ${newId}`);
        await updateDoc(doc(db, COLLECTIONS.STUDENTS, d.id), {
          studentId: newId,
          admissionNumber: newId, // Sometimes students use admissionNumber field too
        });
      }

      addLog("All temp records have been fixed!");
      toast.success("All temp records fixed successfully");
    } catch (error) {
      console.error(error);
      addLog(`Error: ${error.message}`);
      toast.error("Failed to fix some records. Check logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["central_admin"]} redirectTo="/auth/login">
      <Layout>
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fix Temporary MIDs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-gray-600">
                This utility will scan the entire database for any students or
                admissions that got stuck with a <code>temp_XXXXX</code> ID.
                It will sequentially assign them valid <code>MID-XXXX</code> numbers
                without causing duplicates.
              </p>
              <Button onClick={handleFixRecords} disabled={loading}>
                {loading ? "Processing..." : "Fix Temp Records"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Execution Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-black text-green-400 p-4 rounded-md h-64 overflow-y-auto font-mono text-sm">
                {logs.length === 0 && <span className="text-gray-500">No logs yet...</span>}
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
