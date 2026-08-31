'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  CheckCircle, XCircle, RefreshCw, Eye, Search, ArrowRightLeft,
  Users, GraduationCap, Clock, Filter, Building, MapPin, Paperclip,
} from 'lucide-react';
import {
  collection, getDocs, query, orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

/* ─── helpers ─────────────────────────────────────────────── */
const formatDate = (v) => {
  if (!v) return '—';
  if (v?.toDate) return v.toDate().toLocaleString('en-IN');
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleString('en-IN');
};

const STATUS_STEPS = [
  { key: 'pending_sadar_a',    label: 'Student Submitted',        short: 'Submitted',      color: 'bg-yellow-500' },
  { key: 'approved_sadar_a',   label: 'Approved by Sadar A',      short: 'Sadar A ✓',      color: 'bg-blue-500' },
  { key: 'approved_manager_a', label: 'Approved by Manager A',    short: 'Mgr A ✓',        color: 'bg-indigo-500' },
  { key: 'approved_manager_b', label: 'Approved by Manager B',    short: 'Mgr B ✓',        color: 'bg-purple-500' },
  { key: 'completed',          label: 'Transfer Complete',        short: 'Complete',        color: 'bg-green-500' },
];

const STAGE_LABEL = {
  pending_sadar_a:    { label: 'Awaiting Sadar A',         cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  approved_sadar_a:   { label: 'Awaiting Source Manager',  cls: 'bg-orange-100 text-orange-800 border-orange-300' },
  approved_manager_a: { label: 'Awaiting Dest. Manager',   cls: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  approved_manager_b: { label: 'Awaiting Dest. Sadar',     cls: 'bg-purple-100 text-purple-800 border-purple-300' },
  completed:          { label: 'Completed',                cls: 'bg-green-100 text-green-800 border-green-300' },
  rejected:           { label: 'Rejected',                 cls: 'bg-red-100 text-red-800 border-red-300' },
};

const stepIndex = (status) => STATUS_STEPS.findIndex(s => s.key === status);

const StatusTimeline = ({ status }) => {
  const idx = stepIndex(status);
  if (status === 'rejected') return (
    <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
      <XCircle className="w-4 h-4" /> Rejected
    </div>
  );
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STATUS_STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          <div
            title={step.label}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors
              ${i < idx ? 'bg-teal-600 text-white' :
                i === idx ? 'bg-teal-600 text-white ring-2 ring-teal-300' :
                'bg-gray-200 text-gray-400'}`}
          >
            {i < idx ? '✓' : i + 1}
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div className={`h-0.5 w-5 flex-shrink-0 ${i < idx ? 'bg-teal-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
};

const StageBadge = ({ status }) => {
  const s = STAGE_LABEL[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
      {status === 'completed' ? <CheckCircle className="w-3 h-3 mr-1" /> :
       status === 'rejected'  ? <XCircle className="w-3 h-3 mr-1" /> :
       <Clock className="w-3 h-3 mr-1" />}
      {s.label}
    </span>
  );
};

/* ─── detail modal ────────────────────────────────────────── */
const DetailModal = ({ req, onClose }) => {
  if (!req) return null;
  const idx = stepIndex(req.status);

  return (
    <Dialog open={!!req} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-teal-600" />
            TC Request — {req.requesterName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {/* Current Stage Banner */}
          <div className={`rounded-lg p-3 border flex items-center gap-3 ${STAGE_LABEL[req.status]?.cls || 'bg-gray-50 border-gray-200'}`}>
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <div className="text-sm font-semibold">
              Currently at: {STAGE_LABEL[req.status]?.label || req.status}
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">Journey Progress</p>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {STATUS_STEPS.map((step, i) => (
                <div key={step.key} className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                      ${i < idx ? 'bg-teal-600 text-white' :
                        i === idx ? 'bg-teal-600 text-white ring-4 ring-teal-100' :
                        'bg-gray-200 text-gray-400'}`}>
                      {i < idx ? '✓' : i + 1}
                    </div>
                    <span className="text-[10px] mt-1 text-center text-gray-500 max-w-[64px]">{step.short}</span>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`h-0.5 w-8 flex-shrink-0 mt-[-14px] ${i < idx ? 'bg-teal-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
              {req.status === 'rejected' && (
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] mt-1 text-red-600">Rejected</span>
                </div>
              )}
            </div>
          </div>

          {/* Person & Route */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Person</p>
              <p className="font-medium text-gray-900">{req.requesterName}</p>
              <Badge variant="outline" className="capitalize">{req.type || 'student'}</Badge>
              {req.requesterAdmissionNo && <p className="text-gray-500">MID: {req.requesterAdmissionNo}</p>}
              {req.requesterClass && <p className="text-gray-500">Class: {req.requesterClass}</p>}
              {req.requesterEmail && <p className="text-gray-500">{req.requesterEmail}</p>}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Route</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 text-xs bg-gray-100 rounded px-2 py-1">
                  {req.sourceMadarsaName || req.sourceMadarsaId}
                </span>
                <ArrowRightLeft className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="font-medium text-teal-700 text-xs bg-teal-50 rounded px-2 py-1">
                  {req.destinationMadarsaName || req.destinationMadarsaId}
                </span>
              </div>
            </div>
          </div>

          {/* Reason */}
          {req.reason && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Reason</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border">{req.reason}</p>
            </div>
          )}

          {/* Rejection reason */}
          {req.status === 'rejected' && req.rejectionReason && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Rejection Reason</p>
              <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3 border border-red-200">{req.rejectionReason}</p>
            </div>
          )}

          {/* Documents */}
          {req.documents?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Documents ({req.documents.length})</p>
              <div className="space-y-1">
                {req.documents.map((d, i) => (
                  <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-indigo-600 hover:underline bg-indigo-50 rounded px-3 py-2 border border-indigo-100">
                    <Paperclip className="h-4 w-4 flex-shrink-0" /> {d.name || `Document ${i + 1}`}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Status History */}
          {req.statusHistory?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Activity Log</p>
              <div className="border rounded-lg divide-y">
                {req.statusHistory.map((h, i) => (
                  <div key={i} className="px-3 py-2 text-sm">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="font-medium text-gray-800">{h.byName || h.by}</span>
                        <span className="text-gray-400 text-xs ml-1">({h.byRole})</span>
                        {h.note && <p className="text-gray-600 text-xs mt-0.5">{h.note}</p>}
                      </div>
                      <span className="text-gray-400 text-xs flex-shrink-0">
                        {h.timestamp ? formatDate(h.timestamp) : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-400 text-right">
            Submitted: {formatDate(req.createdAt)} &nbsp;|&nbsp; Last updated: {formatDate(req.updatedAt)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ─── main page ───────────────────────────────────────────── */
export default function AdminTCRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailReq, setDetailReq] = useState(null);

  // filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStage, setFilterStage] = useState('all');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(
        query(collection(db, 'tc_requests'), orderBy('createdAt', 'desc'))
      );
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load TC requests');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return requests.filter(r => {
      // search: name, MID, madrasa, mekhala
      if (search) {
        const q = search.toLowerCase();
        const hit =
          r.requesterName?.toLowerCase().includes(q) ||
          String(r.requesterAdmissionNo || '').toLowerCase().includes(q) ||
          r.sourceMadarsaName?.toLowerCase().includes(q) ||
          r.destinationMadarsaName?.toLowerCase().includes(q) ||
          r.sourceMadarsaId?.toLowerCase?.().includes(q) ||
          r.destinationMadarsaId?.toLowerCase?.().includes(q) ||
          r.requesterEmail?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      // type filter
      if (filterType !== 'all' && (r.type || 'student') !== filterType) return false;
      // status group filter (ongoing vs completed vs rejected)
      if (filterStatus === 'ongoing' && ['completed', 'rejected'].includes(r.status)) return false;
      if (filterStatus === 'completed' && r.status !== 'completed') return false;
      if (filterStatus === 'rejected' && r.status !== 'rejected') return false;
      // stage filter (exact status)
      if (filterStage !== 'all' && r.status !== filterStage) return false;
      return true;
    });
  }, [requests, search, filterStatus, filterType, filterStage]);

  // summary counts
  const counts = useMemo(() => ({
    total:     requests.length,
    ongoing:   requests.filter(r => !['completed','rejected'].includes(r.status)).length,
    completed: requests.filter(r => r.status === 'completed').length,
    rejected:  requests.filter(r => r.status === 'rejected').length,
  }), [requests]);

  return (
    <ProtectedRoute requiredRole="central_admin">
      <Layout>
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ArrowRightLeft className="h-6 w-6 text-teal-600" />
                TC Requests
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Monitor all Transfer Certificate requests across the system
              </p>
            </div>
            <Button variant="outline" onClick={fetchAll} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Requests', val: counts.total,     cls: 'border-gray-200',  icon: ArrowRightLeft, textCls: 'text-gray-700' },
              { label: 'In Progress',    val: counts.ongoing,   cls: 'border-orange-200', icon: Clock,          textCls: 'text-orange-600' },
              { label: 'Completed',      val: counts.completed, cls: 'border-green-200',  icon: CheckCircle,    textCls: 'text-green-600' },
              { label: 'Rejected',       val: counts.rejected,  cls: 'border-red-200',    icon: XCircle,        textCls: 'text-red-600' },
            ].map(({ label, val, cls, icon: Icon, textCls }) => (
              <Card key={label} className={`border ${cls}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gray-50 ${textCls}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className={`text-2xl font-bold ${textCls}`}>{val}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                {/* Search */}
                <div className="flex-1 min-w-[220px]">
                  <Label className="text-xs text-gray-500 mb-1 block">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Name, MID, madrasa, email…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Status group */}
                <div className="min-w-[160px]">
                  <Label className="text-xs text-gray-500 mb-1 block">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="ongoing">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Current Stage */}
                <div className="min-w-[200px]">
                  <Label className="text-xs text-gray-500 mb-1 block">Current Stage</Label>
                  <Select value={filterStage} onValueChange={setFilterStage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      <SelectItem value="pending_sadar_a">Awaiting Sadar A</SelectItem>
                      <SelectItem value="approved_sadar_a">Awaiting Source Manager</SelectItem>
                      <SelectItem value="approved_manager_a">Awaiting Dest. Manager</SelectItem>
                      <SelectItem value="approved_manager_b">Awaiting Dest. Sadar</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Type */}
                <div className="min-w-[140px]">
                  <Label className="text-xs text-gray-500 mb-1 block">Type</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Reset */}
                {(search || filterStatus !== 'all' || filterType !== 'all' || filterStage !== 'all') && (
                  <Button variant="ghost" size="sm" onClick={() => {
                    setSearch(''); setFilterStatus('all'); setFilterType('all'); setFilterStage('all');
                  }} className="text-gray-500">
                    Clear filters
                  </Button>
                )}
              </div>

              {filtered.length !== requests.length && (
                <p className="text-xs text-gray-500 mt-2">
                  Showing <span className="font-semibold text-gray-700">{filtered.length}</span> of {requests.length} requests
                </p>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-800">
                All TC Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No requests found</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Person</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead className="min-w-[220px]">Progress</TableHead>
                        <TableHead>Current Stage</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(req => (
                        <TableRow key={req.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {req.type === 'teacher'
                                ? <GraduationCap className="h-4 w-4 text-purple-500 flex-shrink-0" />
                                : <Users className="h-4 w-4 text-teal-500 flex-shrink-0" />}
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{req.requesterName}</p>
                                {req.requesterAdmissionNo && (
                                  <p className="text-xs text-gray-400">MID: {req.requesterAdmissionNo}</p>
                                )}
                                {req.requesterClass && (
                                  <p className="text-xs text-gray-400">Class: {req.requesterClass}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {req.type || 'student'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-0.5">
                              <p className="text-gray-500 font-medium">{req.sourceMadarsaName || req.sourceMadarsaId || '—'}</p>
                              <ArrowRightLeft className="h-3 w-3 text-gray-400" />
                              <p className="text-teal-700 font-medium">{req.destinationMadarsaName || req.destinationMadarsaId || '—'}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusTimeline status={req.status} />
                          </TableCell>
                          <TableCell>
                            <StageBadge status={req.status} />
                          </TableCell>
                          <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                            {formatDate(req.createdAt)}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                            {formatDate(req.updatedAt || req.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDetailReq(req)}
                              className="h-7 w-7 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Detail Modal */}
        <DetailModal req={detailReq} onClose={() => setDetailReq(null)} />

      </Layout>
    </ProtectedRoute>
  );
}
