"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Save, Loader2, Trash2, Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { saveMarks, updateMarks, deleteMarks } from "@/lib/competitionService";
import { calcGrade, calcTotal, CATEGORIES } from "@/lib/competitionUtils";

function gradeColor(grade) {
  switch (grade) {
    case "A+": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "A":  return "bg-green-100 text-green-800 border-green-200";
    case "B+": return "bg-blue-100 text-blue-800 border-blue-200";
    case "B":  return "bg-sky-100 text-sky-800 border-sky-200";
    case "C":  return "bg-yellow-100 text-yellow-800 border-yellow-200";
    default:   return "bg-red-100 text-red-800 border-red-200";
  }
}

export default function StateCompetitionData({ user }) {
  const [districtMarksReceived, setDistrictMarksReceived] = useState([]);
  const [stateMarks, setStateMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markInputs, setMarkInputs] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [dmSnap, smSnap] = await Promise.all([
        getDocs(collection(db, "competition_district_marks")),
        getDocs(collection(db, "competition_state_marks"))
      ]);
      const dm = dmSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sm = smSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDistrictMarksReceived(dm);
      setStateMarks(sm);

      const inputs = {};
      sm.forEach(m => {
        if (m.districtMarkId) {
          inputs[m.districtMarkId] = { mark1: m.mark1 ?? "", mark2: m.mark2 ?? "", mark3: m.mark3 ?? "" };
        }
      });
      setMarkInputs(inputs);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load state marks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const getInput = (key) => markInputs[key] || { mark1: "", mark2: "", mark3: "" };
  const setInput = (key, field, val) =>
    setMarkInputs((prev) => ({ ...prev, [key]: { ...getInput(key), [field]: val } }));

  const handleSaveStateMark = async (distMark) => {
    const key = distMark.id;
    const inp = getInput(key);
    const m1 = Number(inp.mark1), m2 = Number(inp.mark2), m3 = Number(inp.mark3);
    if ([m1, m2, m3].some((m) => isNaN(m) || m < 0 || m > 50)) { toast.error("Each mark must be 0–50"); return; }
    const total = calcTotal(m1, m2, m3);
    const grade = calcGrade(total);
    const payload = {
      districtMarkId: distMark.id,
      registrationId: distMark.registrationId,
      eventId: distMark.eventId,
      eventName: distMark.eventName,
      category: distMark.category,
      type: distMark.type,
      madarsaId: distMark.madarsaId,
      madarsaName: distMark.madarsaName,
      mekhalaId: distMark.mekhalaId,
      mekhalaName: distMark.mekhalaName,
      districtName: distMark.districtName,
      studentIds: distMark.studentIds,
      students: distMark.students,
      districtTotal: distMark.total,
      districtGrade: distMark.grade,
      mark1: m1, mark2: m2, mark3: m3, total, grade,
    };
    // Strip undefined
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, v]) => v !== undefined)
    );

    setSavingId(key);
    try {
      const existing = stateMarks.find((m) => m.districtMarkId === key);
      if (existing) { await updateMarks("state", existing.id, cleanPayload); toast.success("State marks updated"); }
      else          { await saveMarks("state", cleanPayload, user?.uid);      toast.success("State marks saved"); }
      await load();
    } catch (err) { console.error("Save state mark error:", err); toast.error("Failed to save: " + (err.message || err)); }
    finally { setSavingId(null); }
  };

  const handleDeleteStateMark = async (distMark) => {
    try { 
      const existing = stateMarks.find((m) => m.districtMarkId === distMark.id);
      if (existing) {
        await deleteMarks("state", existing.id); 
      }
      await deleteMarks("district", distMark.id);
      
      setMarkInputs((prev) => {
        const next = { ...prev };
        delete next[distMark.id];
        return next;
      });
      toast.success("Entry completely deleted"); 
      await load(); 
    }
    catch (err) { 
      toast.error(`Failed to delete: ${err.message}`); 
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="animate-spin inline-block h-6 w-6 text-teal-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">District Results — Enter State Marks ({districtMarksReceived.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto scrollbar-hide">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>District</TableHead><TableHead>Mekhala</TableHead><TableHead>Madrasa</TableHead>
                <TableHead>Event</TableHead><TableHead>Category</TableHead><TableHead>Students</TableHead>
                <TableHead>Dist.</TableHead><TableHead>M1</TableHead><TableHead>M2</TableHead>
                <TableHead>M3</TableHead><TableHead>Total</TableHead><TableHead>Grade</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {districtMarksReceived.map((dm) => {
                const key = dm.id;
                const inp = getInput(key);
                const m1 = Number(inp.mark1)||0, m2 = Number(inp.mark2)||0, m3 = Number(inp.mark3)||0;
                const hasAll = inp.mark1!==""&&inp.mark2!==""&&inp.mark3!=="";
                const prevTotal = hasAll ? calcTotal(m1,m2,m3) : "—";
                const prevGrade = typeof prevTotal==="number" ? calcGrade(prevTotal) : "—";
                const existing = stateMarks.find((m) => m.districtMarkId === key);
                return (
                  <TableRow key={key} className={existing ? "bg-emerald-50/40" : ""}>
                    <TableCell className="font-semibold text-gray-700">{dm.districtName}</TableCell>
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">{dm.mekhalaName}</TableCell>
                    <TableCell className="text-sm font-medium whitespace-nowrap">{dm.madarsaName}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{dm.eventName}</TableCell>
                    <TableCell><Badge variant="outline">{CATEGORIES[dm.category]?.label}</Badge></TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <div className="flex flex-col gap-1">
                        {dm.students?.map((s, idx) => (
                          <span key={idx} className="whitespace-nowrap">{s.name}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{dm.total}</span>{" "}
                      <Badge className={gradeColor(dm.grade)} variant="outline">{dm.grade}</Badge>
                    </TableCell>
                    {["mark1","mark2","mark3"].map((f) => (
                      <TableCell key={f}>
                        <Input type="number" min="0" max="50" className="w-16 h-8 text-center border-gray-300 shadow-sm bg-white"
                          value={inp[f]} onChange={(e) => setInput(key, f, e.target.value)} />
                      </TableCell>
                    ))}
                    <TableCell className="font-semibold">{prevTotal}</TableCell>
                    <TableCell>
                      {typeof prevGrade==="string"&&prevGrade!=="—"
                        ? <Badge className={gradeColor(prevGrade)}>{prevGrade}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="grid grid-cols-[32px_auto_32px] gap-2 items-center w-full max-w-[140px] mx-auto">
                        <div />
                        <Button size="sm" className="bg-teal-700 hover:bg-teal-800 h-8 px-4 font-medium transition-all"
                          onClick={() => handleSaveStateMark(dm)} disabled={savingId === key}>
                          {savingId === key ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            : existing ? <Check className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                          {existing ? "Update" : "Save"}
                        </Button>
                        <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 rounded-full p-0 flex items-center justify-center transition-all"
                          onClick={() => setDeleteTarget(dm)} title="Delete entry completely">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* Single Top-Level Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete State Marks?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the state marks for this entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => {
              if (deleteTarget) {
                handleDeleteStateMark(deleteTarget);
                setDeleteTarget(null);
              }
            }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
