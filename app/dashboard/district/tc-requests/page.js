"use client";

import { useState, useEffect } from "react";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, XCircle, RefreshCw, Eye, GraduationCap, ArrowRightLeft } from "lucide-react";
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

export default function MekhalaTCRequestsPage() {
  const { userData } = useAuthStore();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionReq, setActionReq] = useState(null);
  const [actionType, setActionType] = useState(""); // 'approve' | 'reject'
  const [rejectReason, setRejectReason] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [detailReq, setDetailReq] = useState(null);

  useEffect(() => {
    if (userData) {
      fetchRequests();
    }
  }, [userData]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // Fetch all teacher TC requests that are currently waiting for Mekhala approval
      const q = query(
        collection(db, "tc_requests"),
        where("type", "==", "teacher"),
        where("status", "==", "approved_manager_a")
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Filter based on mekhala assignment of logged-in mekhala_admin
      const mekhalaName = userData.mekhalaName || userData.district || "";
      const filtered = docs.filter((r) => {
        // Match source or destination madarsa mekhala/district
        const srcMatch = r.sourceMadarsaName?.toLowerCase().includes(mekhalaName.toLowerCase());
        const dstMatch = r.destinationMadarsaName?.toLowerCase().includes(mekhalaName.toLowerCase());
        return srcMatch || dstMatch;
      });

      setRequests(filtered);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load TC requests");
    } finally {
      setLoading(false);
    }
  };

  const openAction = (req, type) => {
    setActionReq(req);
    setActionType(type);
    setRejectReason("");
    setApproveNote("");
  };

  const handleAction = async () => {
    if (!actionReq) return;
    if (actionType === "reject" && !rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setProcessing(true);
    try {
      const isApprove = actionType === "approve";
      const newStatus = isApprove ? "approved_mekhala" : "rejected";
      const historyEntry = {
        status: newStatus,
        by: userData.id || userData.uid,
        byName: userData.fullName || userData.name,
        byRole: "mekhala_admin",
        timestamp: new Date().toISOString(),
        note: isApprove ? approveNote : rejectReason,
      };

      await updateDoc(doc(db, "tc_requests", actionReq.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        statusHistory: [...(actionReq.statusHistory || []), historyEntry],
        ...(actionType === "reject" && {
          rejectedBy: userData.fullName || userData.name,
          rejectionReason: rejectReason,
        }),
      });

      toast.success(isApprove ? "Request approved and forwarded to Manager B" : "Request rejected");
      setActionReq(null);
      fetchRequests();
    } catch (err) {
      console.error(err);
      toast.error("Failed to process TC request");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="mekhala_admin">
      <Layout>
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ArrowRightLeft className="h-6 w-6 text-teal-600" />
                Teacher TC Approvals (Mekhala)
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Review and approve teacher Transfer Certificate requests for your Mekhala.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchRequests}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>

          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-base">Awaiting Your Approval</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-teal-600" />
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  No pending teacher TC requests for your Mekhala.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-medium text-slate-900">
                            <GraduationCap className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            {r.requesterName}
                          </div>
                          <p className="text-xs text-gray-500">{r.requesterEmail}</p>
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {r.sourceMadarsaName} → {r.destinationMadarsaName}
                        </TableCell>
                        <TableCell className="text-sm italic text-gray-600">
                          &ldquo;{r.reason}&rdquo;
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setDetailReq(r)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              className="bg-teal-600 hover:bg-teal-700 text-white"
                              onClick={() => openAction(r, "approve")}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openAction(r, "reject")}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Dialog */}
        <Dialog open={!!actionReq} onOpenChange={() => setActionReq(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {actionType === "reject" ? "Reject TC Request" : "Approve TC Request"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {actionReq && (
                <div className="bg-gray-50 rounded-md p-3 text-sm">
                  <p><span className="text-gray-500">Teacher:</span> <strong>{actionReq.requesterName}</strong></p>
                  <p><span className="text-gray-500">Route:</span> {actionReq.sourceMadarsaName} → {actionReq.destinationMadarsaName}</p>
                </div>
              )}
              {actionType === "approve" ? (
                <div>
                  <Label htmlFor="anote">Remark (Optional)</Label>
                  <Textarea
                    id="anote"
                    placeholder="Add an approval remark..."
                    value={approveNote}
                    onChange={(e) => setApproveNote(e.target.value)}
                    rows={2}
                    className="mt-1"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="rreason">Rejection Reason <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="rreason"
                    placeholder="Explain why this request is rejected..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    className="mt-1"
                  />
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setActionReq(null)}>Cancel</Button>
                <Button
                  disabled={processing}
                  onClick={handleAction}
                  className={actionType === "reject" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-teal-600 hover:bg-teal-700 text-white"}
                >
                  {processing ? "Processing..." : actionType === "reject" ? "Reject" : "Approve"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={!!detailReq} onOpenChange={() => setDetailReq(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>TC Request Details</DialogTitle>
            </DialogHeader>
            {detailReq && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Name", detailReq.requesterName],
                    ["Type", detailReq.type],
                    ["From", detailReq.sourceMadarsaName],
                    ["To", detailReq.destinationMadarsaName],
                    ["Reason", detailReq.reason],
                    ["Submitted", detailReq.createdAt ? new Date(detailReq.createdAt.toDate()).toLocaleString("en-IN") : "—"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-gray-500">{k}</p>
                      <p className="font-medium">{v}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-semibold mb-3">Status History</p>
                  <div className="space-y-4">
                    {(() => {
                      const fullHistory = [...(detailReq.statusHistory || [])];
                      if (fullHistory.length === 0 || fullHistory[0].status !== "pending_manager_a") {
                        fullHistory.unshift({
                          status: "pending_manager_a",
                          byName: detailReq.requesterName || "Requester",
                          byRole: detailReq.type || "user",
                          timestamp: detailReq.createdAt?.toDate?.()?.toISOString() || detailReq.createdAt,
                          note: detailReq.reason
                        });
                      }
                      
                      const getStatusLabel = (st) => {
                        const map = {
                          pending_manager_a: "Submitted by Requester",
                          approved_manager_a: "Action by Source Manager",
                          approved_sadar_a: "Action by Source Sadar",
                          approved_mekhala: "Action by Mekhala Admin",
                          approved_manager_b: "Action by Destination Manager",
                          completed: "Transfer Completed",
                          rejected: "Request Rejected"
                        };
                        return map[st] || String(st).replace(/_/g, " ");
                      };

                      return fullHistory.map((h, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-6 h-6 rounded-full bg-teal-600 flex items-center justify-center">
                              <CheckCircle className="w-3 h-3 text-white" />
                            </div>
                            {i < fullHistory.length - 1 && (
                              <div className="w-0.5 h-full bg-teal-200 mt-1 min-h-[20px]" />
                            )}
                          </div>
                          <div className="pb-4 w-full">
                            <p className="text-sm font-semibold text-gray-900 capitalize">
                              {getStatusLabel(h.status)}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {h.byName} <span className="uppercase text-[10px] bg-gray-100 px-1.5 py-0.5 rounded ml-1">{h.byRole}</span>
                              <span className="mx-2">•</span>
                              {h.timestamp ? new Date(h.timestamp).toLocaleString("en-IN") : "—"}
                            </p>
                            {h.note && (
                              <div className="mt-2 bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-800 relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 rounded-l-md"></div>
                                <span className="font-medium text-xs text-gray-500 uppercase block mb-1">Remark</span>
                                {h.note}
                              </div>
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  );
}
