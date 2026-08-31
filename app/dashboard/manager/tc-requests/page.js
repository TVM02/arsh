'use client';

import { useState, useEffect } from 'react';
import useAuthStore from '@/lib/authStore';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  CheckCircle, XCircle, RefreshCw, Eye, Users, GraduationCap,
  ArrowRightLeft, History
} from 'lucide-react';
import {
  collection, getDocs, query, where, orderBy, doc,
  updateDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

const formatDate = (v) => {
  if (!v) return '—';
  if (v?.toDate) return v.toDate().toLocaleString('en-IN');
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleString('en-IN');
};

const STUDENT_STEPS = [
  { key: 'pending_manager_a',  short: 'Submitted' },
  { key: 'approved_manager_a', short: 'Mgr A Approved' },
  { key: 'approved_sadar_a',   short: 'Sadar A Approved' },
  { key: 'approved_manager_b', short: 'Mgr B Approved' },
  { key: 'completed',          short: 'Complete' },
];

const TEACHER_STEPS = [
  { key: 'pending_manager_a',  short: 'Submitted' },
  { key: 'approved_manager_a', short: 'Mgr A Approved' },
  { key: 'approved_mekhala',   short: 'Mekhala Approved' },
  { key: 'completed',          short: 'Complete' },
];

const statusBadge = (status) => {
  const map = {
    pending_manager_a:  { label: 'Awaiting Mgr A Approval', cls: 'bg-yellow-100 text-yellow-700' },
    approved_manager_a: { label: 'Awaiting Outgoing Sign-off', cls: 'bg-orange-100 text-orange-700' },
    approved_sadar_a:   { label: 'Awaiting Mgr B Approval', cls: 'bg-indigo-100 text-indigo-700' },
    approved_mekhala:   { label: 'Awaiting Mgr B Approval', cls: 'bg-indigo-100 text-indigo-700' },
    approved_manager_b: { label: 'Ready to Complete',      cls: 'bg-purple-100 text-purple-700' },
    completed:          { label: 'Completed',              cls: 'bg-green-100 text-green-700' },
    rejected:           { label: 'Rejected',               cls: 'bg-red-100 text-red-700' },
  };
  return map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
};

const StatusTimeline = ({ req }) => {
  if (!req) return null;
  const status = req.status;
  const steps = req.type === 'teacher' ? TEACHER_STEPS : STUDENT_STEPS;
  const idx = steps.findIndex(s => s.key === status);
  if (status === 'rejected') return (
    <div className="flex items-center gap-2 text-red-600 text-sm">
      <XCircle className="w-4 h-4" /> Rejected
    </div>
  );
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0
            ${i <= idx ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
            {i <= idx ? '✓' : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 w-4 flex-shrink-0 ${i < idx ? 'bg-teal-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
};

export default function ManagerTCRequestsPage() {
  const { userData } = useAuthStore();

  const [sourceRequests, setSourceRequests] = useState([]);
  const [destRequests, setDestRequests]     = useState([]);
  const [historyReqs, setHistoryReqs]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('source');

  const [actionReq, setActionReq]   = useState(null);
  const [actionType, setActionType] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [approveNote, setApproveNote]   = useState('');
  const [processing, setProcessing] = useState(false);
  const [detailReq, setDetailReq] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!userData) return;
    fetchRequests();
  }, [userData]);

  const getMadarsaIds = () => {
    if (!userData) return [];
    if (userData.managedMadarsas?.length) return userData.managedMadarsas;
    if (userData.madarsaId) return [userData.madarsaId];
    return [];
  };

  const fetchRequests = async () => {
    const madarsaIds = getMadarsaIds();
    if (!madarsaIds.length) { setLoading(false); return; }
    try {
      setLoading(true);
      const chunk = madarsaIds.slice(0, 30);
      const sortByDate = (arr) =>
        arr.sort((a, b) => {
          const da = a.updatedAt?.toDate?.() ?? a.createdAt?.toDate?.() ?? new Date(a.updatedAt ?? a.createdAt ?? 0);
          const db2 = b.updatedAt?.toDate?.() ?? b.createdAt?.toDate?.() ?? new Date(b.updatedAt ?? b.createdAt ?? 0);
          return db2 - da;
        });

      // Use single-field 'in' queries only — no composite index needed.
      // All status filtering is done client-side to avoid missing-index errors.
      const [srcSnap, dstSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'tc_requests'),
          where('sourceMadarsaId', 'in', chunk)
        )),
        getDocs(query(
          collection(db, 'tc_requests'),
          where('destinationMadarsaId', 'in', chunk)
        )),
      ]);

      const srcDocs = srcSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const dstDocs = dstSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Pending approvals — filtered client-side
      setSourceRequests(sortByDate(srcDocs.filter(d => d.status === 'pending_manager_a')));
      setDestRequests(sortByDate(dstDocs.filter(d => 
        (d.type === 'student' && d.status === 'approved_sadar_a') || 
        (d.type === 'teacher' && d.status === 'approved_mekhala')
      )));

      // History — merge src + dst, deduplicate by id
      const histSrcStatuses = new Set(['pending_manager_a', 'approved_manager_a', 'approved_sadar_a', 'approved_mekhala', 'approved_manager_b', 'completed', 'rejected']);
      const histDstStatuses = new Set(['approved_sadar_a', 'approved_mekhala', 'approved_manager_b', 'completed', 'rejected']);

      const histMap = new Map();
      srcDocs
        .filter(d => histSrcStatuses.has(d.status))
        .forEach(d => histMap.set(d.id, d));
      dstDocs
        .filter(d => histDstStatuses.has(d.status))
        .forEach(d => histMap.set(d.id, d));
      setHistoryReqs(sortByDate(Array.from(histMap.values())));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load TC requests');
    } finally {
      setLoading(false);
    }
  };

  const openAction = (req, type) => {
    setActionReq(req);
    setActionType(type);
    setRejectReason('');
    setApproveNote('');
  };

  const handleAction = async () => {
    if (!actionReq) return;
    if (actionType === 'reject' && !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      setProcessing(true);
      const isApprove = actionType !== 'reject';
      const isOfflineSourceApproval =
        isApprove &&
        actionType === 'approve_source' &&
        (actionReq.transferMode || 'online') === 'offline';
      
      const newStatus =
        !isApprove ? 'rejected' :
        isOfflineSourceApproval ? 'completed' :
        actionType === 'approve_source' ? 'approved_manager_a' :
        (actionReq.type === 'teacher' ? 'completed' : 'approved_manager_b');

      const roleName = actionType === 'approve_source' ? 'manager_a' : 'manager_b';
      const historyEntry = {
        status: newStatus,
        by: userData.id || userData.uid,
        byName: userData.fullName || userData.name,
        byRole: roleName,
        madarsaName: userData.madarsaName || '',
        timestamp: new Date().toISOString(),
        note: !isApprove ? rejectReason : approveNote,
      };
      await updateDoc(doc(db, 'tc_requests', actionReq.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        statusHistory: [...(actionReq.statusHistory || []), historyEntry],
        ...(!isApprove && { rejectedBy: userData.fullName || userData.name, rejectionReason: rejectReason }),
        ...((isOfflineSourceApproval || newStatus === 'completed') && {
          completedBy: userData.fullName || userData.name,
          completedAt: serverTimestamp(),
          ...(isOfflineSourceApproval && { offlineCompletedAtManagerA: true }),
        }),
      });

      // Update student/teacher doc if complete
      if (newStatus === 'completed') {
        try {
          const destId = actionReq.destinationMadarsaId;
          const destName = actionReq.destinationMadarsaName || "";
          const coll = actionReq.type === "teacher" ? "teachers" : "students";
          const rid = actionReq.requesterId;
          let docToUpdate = null;
          const snap1 = await getDocs(query(collection(db, coll), where("id", "==", rid)));
          if (!snap1.empty) {
            docToUpdate = snap1.docs[0];
          } else {
            const snap2 = await getDocs(query(collection(db, coll), where("uid", "==", rid)));
            if (!snap2.empty) docToUpdate = snap2.docs[0];
          }
          if (docToUpdate) {
            let updatePayload = {
              madarsaId: destId,
              madarsaName: destName,
              status: "active",
              updatedAt: serverTimestamp(),
            };

            if (coll === "students") {
               try {
                 const res = await fetch("/api/public/admission-number", {
                   method: "POST",
                   headers: { "Content-Type": "application/json" },
                   body: JSON.stringify({ madarsaId: destId })
                 });
                 const data = await res.json();
                 if (data.admissionNumber) {
                   updatePayload.admissionNumber = `mid-${data.admissionNumber}`;
                 }
               } catch (e) {
                 console.error("Failed to generate new MID", e);
               }
            }

            await updateDoc(doc(db, coll, docToUpdate.id), updatePayload);
          }
        } catch (transferErr) {
          console.error("Failed to update madarsaId after TC complete:", transferErr);
        }
      }

      toast.success(
        !isApprove
          ? 'Request rejected'
          : isOfflineSourceApproval
          ? 'Offline request completed at Source Manager'
          : 'Request approved and forwarded',
      );
      setActionReq(null);
      fetchRequests();
    } catch (err) {
      console.error(err);
      toast.error('Action failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['manager']}>
        <Layout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const renderRow = (req, actions = []) => {
    const badge = statusBadge(req.status);
    return (
      <TableRow key={req.id}>
        <TableCell>
          <div className="flex items-center gap-1.5">
            {req.type === 'teacher'
              ? <GraduationCap className="w-4 h-4 text-blue-500 flex-shrink-0" />
              : <Users className="w-4 h-4 text-teal-500 flex-shrink-0" />}
            <span className="font-medium">{req.requesterName || '—'}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {req.type === 'student' ? `Class: ${req.requesterClass || '—'}` : req.requesterEmail || '—'}
            {' · '}
            {(req.transferMode || 'online').toUpperCase()}
          </p>
        </TableCell>
        <TableCell>
          <p className="text-xs text-gray-500">{req.sourceMadarsaName || req.sourceMadarsaId || '—'}</p>
          <p className="text-xs">→</p>
          <p className="text-xs text-gray-500">{req.destinationMadarsaName || req.destinationMadarsaId || '—'}</p>
        </TableCell>
        <TableCell><StatusTimeline req={req} /></TableCell>
        <TableCell><Badge className={badge.cls}>{badge.label}</Badge></TableCell>
        <TableCell className="text-gray-500 text-xs">{formatDate(req.updatedAt || req.createdAt)}</TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setDetailReq(req)}>
              <Eye className="w-4 h-4" />
            </Button>
            {actions.map((action) => (
              <Button key={action.label} size="sm" className={action.cls} onClick={() => openAction(req, action.type)}>
                {action.label}
              </Button>
            ))}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <ProtectedRoute allowedRoles={['manager']}>
      <Layout>
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">TC Requests</h1>
              <p className="text-sm text-gray-500 mt-1">Approve or reject Transfer Certificate requests passing through your zone</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchRequests}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'source', label: `Source Approval (${sourceRequests.length})`, icon: ArrowRightLeft, badge: sourceRequests.length, badgeCls: 'bg-orange-400 text-white' },
              { key: 'dest',   label: `Dest. Approval (${destRequests.length})`,    icon: CheckCircle,    badge: destRequests.length,   badgeCls: 'bg-indigo-400 text-white' },
              { key: 'history',label: `History (${historyReqs.length})`,            icon: History,        badge: 0,                     badgeCls: '' },
            ].map(({ key, label, icon: Icon, badge, badgeCls }) => (
              <Button
                key={key}
                variant={tab === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTab(key)}
                className={tab === key ? 'bg-teal-600 hover:bg-teal-700' : ''}
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
                {badge > 0 && <span className={`ml-2 text-xs px-1.5 rounded-full ${badgeCls}`}>{badge}</span>}
              </Button>
            ))}
          </div>

          {tab === 'source' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">Source Approval — requests from your zone awaiting your sign-off</CardTitle>
                  <div className="flex gap-1">{['all','student','teacher'].map(f => (
                    <Button key={f} size="sm" variant={typeFilter===f?'default':'outline'}
                      onClick={()=>setTypeFilter(f)}
                      className={`h-7 text-xs ${typeFilter===f?'bg-teal-600 hover:bg-teal-700':''}`}>
                      {f.charAt(0).toUpperCase()+f.slice(1)}
                    </Button>
                  ))}</div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead><TableHead>Route</TableHead><TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead><TableHead>Updated</TableHead><TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sourceRequests.length === 0
                      ? <TableRow><TableCell colSpan={6} className="text-center py-10 text-gray-500">No pending source approvals</TableCell></TableRow>
                      : (typeFilter==='all'?sourceRequests:sourceRequests.filter(r=>r.type===typeFilter)).map(r => renderRow(r, [
                          { label: 'Approve', type: 'approve_source', cls: 'bg-teal-600 hover:bg-teal-700 text-white' },
                          { label: 'Reject',  type: 'reject',         cls: 'bg-red-600 hover:bg-red-700 text-white' },
                        ]))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {tab === 'dest' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">Destination Approval — approved by source manager, needs your zone&apos;s approval</CardTitle>
                  <div className="flex gap-1">{['all','student','teacher'].map(f => (
                    <Button key={f} size="sm" variant={typeFilter===f?'default':'outline'}
                      onClick={()=>setTypeFilter(f)}
                      className={`h-7 text-xs ${typeFilter===f?'bg-teal-600 hover:bg-teal-700':''}`}>
                      {f.charAt(0).toUpperCase()+f.slice(1)}
                    </Button>
                  ))}</div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead><TableHead>Route</TableHead><TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead><TableHead>Updated</TableHead><TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {destRequests.length === 0
                      ? <TableRow><TableCell colSpan={6} className="text-center py-10 text-gray-500">No pending destination approvals</TableCell></TableRow>
                      : (typeFilter==='all'?destRequests:destRequests.filter(r=>r.type===typeFilter)).map(r => renderRow(r, [
                          { label: 'Approve', type: 'approve_dest', cls: 'bg-teal-600 hover:bg-teal-700 text-white' },
                          { label: 'Reject',  type: 'reject',       cls: 'bg-red-600 hover:bg-red-700 text-white' },
                        ]))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {tab === 'history' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">All TC Requests — related to your zone</CardTitle>
                  <div className="flex gap-1">{['all','student','teacher'].map(f => (
                    <Button key={f} size="sm" variant={typeFilter===f?'default':'outline'}
                      onClick={()=>setTypeFilter(f)}
                      className={`h-7 text-xs ${typeFilter===f?'bg-teal-600 hover:bg-teal-700':''}`}>
                      {f.charAt(0).toUpperCase()+f.slice(1)}
                    </Button>
                  ))}</div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead><TableHead>Route</TableHead><TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead><TableHead>Updated</TableHead><TableHead className="text-right">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyReqs.length === 0
                      ? <TableRow><TableCell colSpan={6} className="text-center py-10 text-gray-500">No history yet</TableCell></TableRow>
                      : (typeFilter==='all'?historyReqs:historyReqs.filter(r=>r.type===typeFilter)).map(r => renderRow(r, []))} 
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Dialog */}
        <Dialog open={!!actionReq} onOpenChange={() => { setActionReq(null); setRejectReason(''); setApproveNote(''); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {actionType === 'reject' ? 'Reject TC Request' :
                 actionType === 'approve_source' ? 'Approve — Source Manager' : 'Approve — Destination Manager'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {actionReq && (
                <div className="bg-gray-50 rounded-md p-3 text-sm">
                  <p><span className="text-gray-500">Person:</span> <strong>{actionReq.requesterName}</strong></p>
                  <p><span className="text-gray-500">Type:</span> {actionReq.type}</p>
                  <p><span className="text-gray-500">Route:</span> {actionReq.sourceMadarsaName || actionReq.sourceMadarsaId} → {actionReq.destinationMadarsaName || actionReq.destinationMadarsaId}</p>
                </div>
              )}
              {actionType !== 'reject' && (
                <div>
                  <Label htmlFor="anote">Remark (Optional)</Label>
                  <Textarea id="anote" placeholder="Add a remark..." value={approveNote} onChange={e => setApproveNote(e.target.value)} rows={2} className="mt-1" />
                </div>
              )}
              {actionType === 'reject' && (
                <div>
                  <Label htmlFor="rreason">Rejection Reason <span className="text-red-500">*</span></Label>
                  <Textarea id="rreason" placeholder="Explain why..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} className="mt-1" />
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setActionReq(null)}>Cancel</Button>
                <Button
                  disabled={processing}
                  onClick={handleAction}
                  className={actionType === 'reject' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white'}
                >
                  {processing ? 'Processing...' : actionType === 'reject' ? 'Reject' : 'Approve & Forward'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={!!detailReq} onOpenChange={() => setDetailReq(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>TC Request Details</DialogTitle></DialogHeader>
            {detailReq && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Name', detailReq.requesterName],
                    ['Type', detailReq.type],
                    ['Mode', detailReq.transferMode || 'online'],
                    ['Email', detailReq.requesterEmail],
                    ['Class', detailReq.requesterClass || '—'],
                    ['Adm. No.', detailReq.requesterAdmissionNo || '—'],
                    ['From', detailReq.sourceMadarsaName || detailReq.sourceMadarsaId],
                    ['To', detailReq.destinationMadarsaName || detailReq.destinationMadarsaId],
                    ['Reason', detailReq.reason],
                    ['Submitted', formatDate(detailReq.createdAt)],
                    ...(detailReq.rejectionReason ? [['Rejection Reason', detailReq.rejectionReason]] : []),
                    ...(detailReq.teacherRating ? [['Teacher Rating', `${detailReq.teacherRating}/5`]] : []),
                    ...(detailReq.teacherRatingComment ? [['Rating Comment', detailReq.teacherRatingComment]] : []),
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k}><p className="text-gray-500">{k}</p><p className="font-medium">{v}</p></div>
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
