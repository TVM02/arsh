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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  FileCheck, Search, Users, UserX, Calendar, Eye, BookOpen, RefreshCw
} from 'lucide-react';
import {
  collection, getDocs, query, where, orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

const formatDate = (v) => {
  if (!v) return '—';
  if (v?.toDate) return v.toDate().toLocaleDateString('en-IN');
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN');
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const getExamTitle = (exam) => exam.title || exam.name || exam.examName || '—';
const getRegistrationExamId = (registration) =>
  registration.examId || registration.examID || registration.exam_id || '';
const isExamActive = (exam) => {
  const status = normalizeText(exam.status || exam.examStatus || exam.registrationStatus);
  if (exam.isActive === true || exam.active === true) return true;
  if (exam.isActive === false || exam.active === false) {
    return ['active', 'open', 'published', 'ongoing'].includes(status);
  }
  return !['inactive', 'closed', 'disabled', 'archived', 'completed'].includes(status);
};
const chunk = (items, size = 30) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

export default function MekhalaExamPage() {
  const { userData } = useAuthStore();

  const [loading, setLoading]         = useState(true);
  const [exams, setExams]             = useState([]);
  const [madarsaIds, setMadarsaIds]   = useState([]);
  const [madarsaMap, setMadarsaMap]   = useState({});
  const [regMap, setRegMap]           = useState({});   // examId → { madarsaId → count }
  const [searchTerm, setSearchTerm]   = useState('');

  // Detail dialog
  const [selected, setSelected]       = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [examStudents, setExamStudents]   = useState([]);
  const [unregistered, setUnregistered]   = useState([]);

  /* ─── fetch ─────────────────────────────────────── */
  useEffect(() => {
    if (!userData || userData.role !== 'mekhala_admin') return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const mekhalaId = userData.uid || userData.id;

      // 1. Districts
      const districtsSnap = await getDocs(
        query(collection(db, 'districts'), where('mekhalaId', '==', mekhalaId))
      );
      const districtNames = districtsSnap.docs.map(d => d.data().name).filter(Boolean);

      // Merge with userData.districts to cover entries without a districts-collection doc
      const userDataDistricts = [
        userData.district,
        userData.districtName,
        userData.name,
        ...(userData.districts || []),
        ...(userData.assignedDistricts || []),
      ].filter(Boolean);
      const allDistrictNamesLower = new Set([
        ...districtNames.map(normalizeText),
        ...userDataDistricts.map(normalizeText)
      ]);

      // 2. Madarsas in those districts
      const madarsasSnap = await getDocs(
        query(collection(db, 'madarsas'), orderBy('name', 'asc'))
      );
      const allMadarsas = madarsasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = allMadarsas.filter(m =>
        allDistrictNamesLower.has(normalizeText(m.district)) ||
        m.mekhalaId === mekhalaId ||
        normalizeText(m.mekhala) === normalizeText(userData.name)
      );
      const ids = filtered.map(m => m.madarsaId || m.id);
      const nameMap = {};
      filtered.forEach(m => { nameMap[m.madarsaId || m.id] = m.name; });
      setMadarsaIds(ids);
      setMadarsaMap(nameMap);

      // 3. All exams
      const examsSnap = await getDocs(
        query(collection(db, 'exams'), orderBy('createdAt', 'desc'))
      );
      const examList = examsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExams(examList);

      // 4. Registrations for madarsas in this mekhala
      if (ids.length > 0) {
        const batches = chunk(ids);
        const allRegs = [];
        await Promise.all(batches.map(async (batch) => {
          const snap = await getDocs(
            query(collection(db, 'examRegistrations'), where('madarsaId', 'in', batch))
          );
          snap.docs.forEach(d => allRegs.push({ id: d.id, ...d.data() }));
        }));

        // Build map: examId → { madarsaId → count, total }
        const map = {};
        allRegs.forEach(r => {
          const examId = getRegistrationExamId(r);
          if (!examId) return;
          if (!map[examId]) map[examId] = { total: 0, paid: 0 };
          map[examId].total++;
          if (r.paymentStatus === 'completed' || r.paymentStatus === 'paid') {
            map[examId].paid++;
          }
        });
        setRegMap(map);
      } else {
        setRegMap({});
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load exam data');
    } finally {
      setLoading(false);
    }
  };

  /* ─── open detail dialog ─────────────────────────── */
  const openDetail = async (exam) => {
    setSelected(exam);
    setDetailLoading(true);
    setExamStudents([]);
    setUnregistered([]);
    try {
      // Registered students for this exam from mekhala madarsas
      const batches = chunk(madarsaIds);
      const regs = [];
      await Promise.all(batches.map(async (batch) => {
        const snap = await getDocs(
          query(
            collection(db, 'examRegistrations'),
            where('examId', '==', exam.id),
            where('madarsaId', 'in', batch)
          )
        );
        snap.docs.forEach(d => regs.push({ id: d.id, ...d.data() }));
      }));
      setExamStudents(regs);

      // Unregistered: all students in mekhala madarsas not in reg list
      const registeredStudentIds = new Set(regs.map(r => r.studentId).filter(Boolean));
      const allStudents = [];
      await Promise.all(batches.map(async (batch) => {
        const snap = await getDocs(
          query(collection(db, 'students'), where('madarsaId', 'in', batch), where('status', '==', 'active'))
        );
        snap.docs.forEach(d => allStudents.push({ id: d.id, ...d.data() }));
      }));
      setUnregistered(allStudents.filter(s => !registeredStudentIds.has(s.id)));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load exam details');
    } finally {
      setDetailLoading(false);
    }
  };

  /* ─── filtered exams ─────────────────────────────── */
  const filtered = exams.filter(e =>
    !searchTerm ||
    getExamTitle(e).toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.examCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* ─── render ─────────────────────────────────────── */
  if (loading) {
    return (
      <ProtectedRoute requiredRole="mekhala_admin">
        <Layout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="mekhala_admin">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">Exam Section</h1>
                <p className="text-teal-100">View exams and student registration status across your mekhala</p>
              </div>
              <Button variant="outline" size="sm" className="text-teal-700 bg-white hover:bg-teal-50" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Exams</p>
                  <p className="text-2xl font-bold">{exams.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Active Exams</p>
                  <p className="text-2xl font-bold">{exams.filter(isExamActive).length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Registered</p>
                  <p className="text-2xl font-bold">
                    {Object.values(regMap).reduce((s, v) => s + (v.total || 0), 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Madarsas</p>
                  <p className="text-2xl font-bold">{madarsaIds.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search exams..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Exams Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Exams</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Exam Date</TableHead>
                    <TableHead className="text-center">Registered (Mekhala)</TableHead>
                    <TableHead className="text-center">Paid</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No exams found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(exam => (
                      <TableRow key={exam.id}>
                        <TableCell className="font-medium">
                          {getExamTitle(exam)}
                          {exam.examCode && <span className="ml-2 text-xs text-gray-400">#{exam.examCode}</span>}
                        </TableCell>
                        <TableCell>
                          <Badge className={isExamActive(exam) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                            {isExamActive(exam) ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(exam.examDate || exam.date)}</TableCell>
                        <TableCell className="text-center font-semibold">
                          {regMap[exam.id]?.total || 0}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-blue-100 text-blue-700">
                            {regMap[exam.id]?.paid || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => openDetail(exam)}>
                            <Eye className="w-4 h-4 mr-1" /> Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Detail Dialog */}
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selected ? getExamTitle(selected) : 'Exam'} — Mekhala View</DialogTitle>
            </DialogHeader>
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-teal-600 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-teal-600">{examStudents.length}</p>
                      <p className="text-sm text-gray-500 mt-1">Registered Students</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-orange-500">{unregistered.length}</p>
                      <p className="text-sm text-gray-500 mt-1">Unregistered Students</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Registered */}
                <div>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-600" /> Registered Students ({examStudents.length})
                  </h3>
                  <div className="rounded-md border max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Madarsa</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Payment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {examStudents.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-4 text-gray-500">No registrations</TableCell></TableRow>
                        ) : examStudents.map(r => (
                          <TableRow key={r.id}>
                            <TableCell>{r.studentName || r.fullName || '—'}</TableCell>
                            <TableCell>{madarsaMap[r.madarsaId] || r.madarsaId || '—'}</TableCell>
                            <TableCell>{r.class || r.classLevel || '—'}</TableCell>
                            <TableCell>
                              <Badge className={
                                r.paymentStatus === 'completed' || r.paymentStatus === 'paid'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }>
                                {r.paymentStatus || 'pending'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Unregistered */}
                <div>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <UserX className="w-4 h-4 text-orange-500" /> Unregistered Students ({unregistered.length})
                  </h3>
                  <div className="rounded-md border max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Madarsa</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Admission No.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unregistered.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-4 text-gray-500">All active students are registered!</TableCell></TableRow>
                        ) : unregistered.map(s => (
                          <TableRow key={s.id}>
                            <TableCell>{s.fullName || s.name || '—'}</TableCell>
                            <TableCell>{madarsaMap[s.madarsaId] || s.madarsaId || '—'}</TableCell>
                            <TableCell>{s.class || s.classLevel || s.std || '—'}</TableCell>
                            <TableCell>{s.admissionNumber || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
