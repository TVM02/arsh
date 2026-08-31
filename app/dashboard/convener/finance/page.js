'use client';

import { useState, useEffect } from 'react';
import useAuthStore from '@/lib/authStore';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  IndianRupee, Search, Building, Users, TrendingUp, RefreshCw, Eye, CheckCircle, Clock, Loader2
} from 'lucide-react';
import {
  collection, getDocs, query, where, orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { getAuthorizedDistricts } from "@/lib/convenerData";
import { fetchMadarsasByDistricts, madrasaMatchesDistrict } from "@/lib/madrasaHierarchy";

const formatDate = (v) => {
  if (!v) return '—';
  if (v?.toDate) return v.toDate().toLocaleDateString('en-IN');
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN');
};

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function MekhalaFinancePage() {
  const { userData } = useAuthStore();

  const [loading, setLoading]       = useState(true);
  const [exams, setExams]           = useState([]);
  const [madarsaMap, setMadarsaMap] = useState({});   // id → name
  const [rows, setRows]             = useState([]);   // per-madrasa rows
  const [allRegs, setAllRegs]       = useState([]);

  const [search, setSearch]         = useState('');
  const [filterExam, setFilterExam] = useState('all');

  // Detail dialog
  const [detailMadarsa, setDetailMadarsa] = useState(null);

  /* ─── fetch ─────────────────────────────────────── */
  useEffect(() => {
    if (!userData || userData.role !== 'convener_admin') return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Determine assigned districts using unified logic
      let districtsData = await getAuthorizedDistricts(userData, db);

      const districtNames = districtsData.map(d => d.name).filter(Boolean);

      // 2. Madarsas — use the shared alias-aware district matcher (and its
      // cached fetch) so counts stay consistent with the rest of the portal.
      const candidateMadarsas = await fetchMadarsasByDistricts(db, query, collection, where, getDocs, districtNames);
      const mekhalaM = candidateMadarsas.filter(m =>
        districtNames.some(dn => {
          try { return madrasaMatchesDistrict(m, dn); } catch { return false; }
        })
      ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const ids = mekhalaM.map(m => m.madarsaId || m.id);
      const nameMap = {};
      mekhalaM.forEach(m => { nameMap[m.madarsaId || m.id] = { name: m.name, district: m.district }; });
      setMadarsaMap(nameMap);

      // 3. Exams
      const examsSnap = await getDocs(query(collection(db, 'exams'), orderBy('createdAt', 'desc')));
      setExams(examsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 4. Registrations in batches (capped at 30, Firestore's max for an
      // 'in' filter). Each chunk is caught individually so one failing
      // query can't abort the whole fetch and leave the page stuck loading.
      const batches = [];
      for (let i = 0; i < ids.length; i += 30) batches.push(ids.slice(i, i + 30));
      const regs = [];
      await Promise.all(batches.map(async (batch) => {
        try {
          const snap = await getDocs(
            query(collection(db, 'examRegistrations'), where('madarsaId', 'in', batch))
          );
          snap.docs.forEach(d => regs.push({ id: d.id, ...d.data() }));
        } catch (err) {
          console.error('Failed to load an examRegistrations batch:', err);
        }
      }));
      setAllRegs(regs);

      // 5. Build per-madrasa rows
      buildRows(ids, nameMap, regs);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load finance data');
    } finally {
      setLoading(false);
    }
  };

  const buildRows = (ids, nameMap, regs) => {
    const map = {};
    ids.forEach(id => {
      map[id] = {
        madarsaId: id,
        name: nameMap[id]?.name || id,
        district: nameMap[id]?.district || '',
        total: 0, paid: 0, pending: 0,
        totalAmount: 0, paidAmount: 0, pendingAmount: 0,
        registrations: [],
      };
    });
    regs.forEach(r => {
      const entry = map[r.madarsaId];
      if (!entry) return;
      const amt = parseFloat(r.paymentAmount) || parseFloat(r.examFees) || 0;
      const isPaid = r.paymentStatus === 'completed' || r.paymentStatus === 'paid';
      entry.total++;
      entry.totalAmount += amt;
      entry.registrations.push(r);
      if (isPaid) {
        entry.paid++;
        entry.paidAmount += amt;
      } else {
        entry.pending++;
        entry.pendingAmount += amt;
      }
    });
    setRows(Object.values(map));
  };

  /* ─── filtered rows ──────────────────────────────── */
  const getFilteredRegs = (regs) => {
    if (filterExam === 'all') return regs;
    return regs.filter(r => r.examId === filterExam);
  };

  const filteredRows = rows
    .map(r => {
      const filteredRegs = getFilteredRegs(r.registrations);
      const paid = filteredRegs.filter(reg => reg.paymentStatus === 'completed' || reg.paymentStatus === 'paid');
      const paidAmt = paid.reduce((s, reg) => s + (parseFloat(reg.paymentAmount) || parseFloat(reg.examFees) || 0), 0);
      const totalAmt = filteredRegs.reduce((s, reg) => s + (parseFloat(reg.paymentAmount) || parseFloat(reg.examFees) || 0), 0);
      return {
        ...r,
        total: filteredRegs.length,
        paid: paid.length,
        pending: filteredRegs.length - paid.length,
        paidAmount: paidAmt,
        pendingAmount: totalAmt - paidAmt,
        totalAmount: totalAmt,
        filteredRegs,
      };
    })
    .filter(r =>
      !search ||
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.madarsaId?.toLowerCase().includes(search.toLowerCase())
    );

  const totals = filteredRows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      paid: acc.paid + r.paid,
      pending: acc.pending + r.pending,
      paidAmount: acc.paidAmount + r.paidAmount,
      pendingAmount: acc.pendingAmount + r.pendingAmount,
      totalAmount: acc.totalAmount + r.totalAmount,
    }),
    { total: 0, paid: 0, pending: 0, paidAmount: 0, pendingAmount: 0, totalAmount: 0 }
  );

  /* ─── loading ────────────────────────────────────── */
  if (loading) {
    return (
      <ProtectedRoute requiredRole="convener_admin">
        <Layout>
          <div className="flex h-[80vh] items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="convener_admin">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">Finance</h1>
                <p className="text-emerald-100">Exam fee payments across madarsas in your mekhala</p>
              </div>
              <Button variant="outline" size="sm" className="text-emerald-700 bg-white hover:bg-emerald-50" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </div>
          </div>

          {/* Grand Totals */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Registrations', value: totals.total, icon: Users, color: 'bg-teal-100 text-teal-600' },
              { label: 'Paid', value: totals.paid, icon: CheckCircle, color: 'bg-teal-100 text-teal-600' },
              { label: 'Pending', value: totals.pending, icon: Clock, color: 'bg-yellow-100 text-yellow-600' },
              { label: 'Total Amount', value: fmt(totals.totalAmount), icon: IndianRupee, color: 'bg-teal-100 text-teal-600' },
              { label: 'Collected', value: fmt(totals.paidAmount), icon: TrendingUp, color: 'bg-emerald-100 text-emerald-600' },
              { label: 'Pending Amount', value: fmt(totals.pendingAmount), icon: IndianRupee, color: 'bg-red-100 text-red-600' },
            ].map(item => (
              <Card key={item.label}>
                <CardContent className="p-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${item.color}`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <p className="text-lg font-bold">{item.value}</p>
                  <p className="text-xs text-gray-500">{item.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search madarsa..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterExam} onValueChange={setFilterExam}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filter by exam" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exams</SelectItem>
                {exams.map(ex => (
                  <SelectItem key={ex.id} value={ex.id}>{ex.name || ex.examName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Per-Madrasa Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Summary by Madarsa</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Madarsa</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead className="text-center">Registrations</TableHead>
                    <TableHead className="text-center">Paid</TableHead>
                    <TableHead className="text-center">Pending</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead className="text-right">Pending Amt</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">No data found</TableCell>
                    </TableRow>
                  ) : filteredRows.map(r => (
                    <TableRow key={r.madarsaId}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-gray-500">{r.district}</TableCell>
                      <TableCell className="text-center">{r.total}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-teal-100 text-teal-700">{r.paid}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={r.pending > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}>
                          {r.pending}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">{fmt(r.paidAmount)}</TableCell>
                      <TableCell className="text-right text-red-500">{fmt(r.pendingAmount)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm" variant="outline"
                          disabled={r.filteredRegs.length === 0}
                          onClick={() => setDetailMadarsa({ ...r, regs: r.filteredRegs })}
                        >
                          <Eye className="w-4 h-4 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  {filteredRows.length > 0 && (
                    <TableRow className="bg-gray-50 font-semibold">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-center">{totals.total}</TableCell>
                      <TableCell className="text-center text-teal-600">{totals.paid}</TableCell>
                      <TableCell className="text-center text-yellow-600">{totals.pending}</TableCell>
                      <TableCell className="text-right text-emerald-600">{fmt(totals.paidAmount)}</TableCell>
                      <TableCell className="text-right text-red-500">{fmt(totals.pendingAmount)}</TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Detail Dialog */}
        <Dialog open={!!detailMadarsa} onOpenChange={() => setDetailMadarsa(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{detailMadarsa?.name} — Registrations</DialogTitle>
            </DialogHeader>
            {detailMadarsa && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailMadarsa.regs.map(r => {
                    const exam = exams.find(e => e.id === r.examId);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{r.studentName || r.fullName || '—'}</TableCell>
                        <TableCell>{exam?.name || exam?.examName || r.examId || '—'}</TableCell>
                        <TableCell>{r.class || r.classLevel || '—'}</TableCell>
                        <TableCell>{fmt(r.paymentAmount || r.examFees)}</TableCell>
                        <TableCell>
                          <Badge className={
                            r.paymentStatus === 'completed' || r.paymentStatus === 'paid'
                              ? 'bg-teal-100 text-teal-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }>
                            {r.paymentStatus || 'pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(r.createdAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  );
}
