"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { GraduationCap, Search, Eye, Phone, Mail } from "lucide-react";
import useAuthStore from "@/lib/authStore";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function ManagerTeachersPage() {
  const { userData } = useAuthStore();
  const [teachers, setTeachers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const madarsaId = userData?.madarsaId;

  useEffect(() => {
    if (!madarsaId) return;
    const fetchTeachers = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "teachers"),
          where("madarsaId", "==", madarsaId),
        );
        const snap = await getDocs(q);
        setTeachers(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeachers();
  }, [madarsaId]);

  useEffect(() => {
    const term = search.toLowerCase();
    setFiltered(
      teachers.filter(
        (t) =>
          (t.name || "").toLowerCase().includes(term) ||
          (t.email || "").toLowerCase().includes(term) ||
          (t.mhrId || "").toLowerCase().includes(term),
      ),
    );
  }, [search, teachers]);

  return (
    <ProtectedRoute allowedRoles={["manager"]}>
      <Layout>
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
              <p className="text-sm text-gray-500 mt-1">
                {userData?.madarsaName} — {teachers.length} total teachers
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, or MHR ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Total Teachers", value: teachers.length },
              {
                label: "Moallim Trained",
                value: teachers.filter((t) => t.moallimTraining).length,
              },
            ].map((c) => (
              <Card key={c.label}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-gray-500">{c.label}</p>
                  <p className="text-2xl font-bold text-teal-700">{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="h-5 w-5 text-teal-600" />
                Teacher List
                <Badge className="ml-2 bg-teal-100 text-teal-700">
                  {filtered.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-center text-gray-400 py-10 text-sm">
                  Loading teachers…
                </p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">
                  No teachers found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {["#", "Name", "MHR ID", "Qualification", "Phone", "Moallim", "Action"].map((h) => (
                          <th
                            key={h}
                            className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t, idx) => (
                        <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 px-4 text-gray-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-medium text-gray-900">{t.name}</td>
                          <td className="py-3 px-4 text-gray-600 font-mono text-xs">{t.mhrId || "—"}</td>
                          <td className="py-3 px-4 text-gray-600">{t.qualification || "—"}</td>
                          <td className="py-3 px-4 text-gray-600">{t.phone || "—"}</td>
                          <td className="py-3 px-4">
                            <Badge className={t.moallimTraining ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500"}>
                              {t.moallimTraining ? "Yes" : "No"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelected(t)}
                              className="text-teal-600 hover:bg-teal-50"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {selected && (
          <Dialog open={Boolean(selected)} onOpenChange={() => setSelected(null)}>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
              <DialogHeader>
                <DialogTitle>Teacher Details</DialogTitle>
                <DialogDescription>Complete teacher information</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-sm">
                {[
                  ["Name", selected.name],
                  ["MHR ID", selected.mhrId],
                  ["Email", selected.email],
                  ["Phone", selected.phone],
                  ["Address", selected.address],
                  ["Qualification", selected.qualification],
                  ["Degree", selected.degree],
                  ["Moallim Training", selected.moallimTraining ? "Yes" : "No"],
                  ["Moallim Details", selected.moallimTrainingDetails],
                ].map(([label, val]) =>
                  val ? (
                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className="font-medium text-gray-900">{val}</p>
                    </div>
                  ) : null,
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
