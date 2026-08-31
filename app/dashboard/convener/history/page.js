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
  Clock, Search, Users, GraduationCap, RefreshCw, Eye,
  ArrowRightLeft, UserX, Building, XCircle, Loader2
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

const statusColor = (s) => {
  if (s === 'inactive') return 'bg-red-100 text-red-700';
  if (s === 'transferred') return 'bg-orange-100 text-orange-700';
  return 'bg-gray-100 text-gray-600';
};

export default function MekhalaHistoryPage() {
  const { userData } = useAuthStore();

  const [loading, setLoading]         = useState(true);
  const [students, setStudents]       = useState([]);
  const [teachers, setTeachers]       = useState([]);
  const [failedResults, setFailedResults] = useState([]);
  const [madarsaMap, setMadarsaMap]   = useState({});

  const [tab, setTab]                 = useState('students');
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDistrict, setFilterDistrict] = useState('all');
  const [districtNames, setDistrictNames] = useState([]);
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');

  const [selected, setSelected]       = useState(null);

  /* ─── fetch ─────────────────────────────────────── */
  useEffect(() => {
    if (!userData || userData.role !== 'convener_admin') return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const mekhalaId = userData.uid || userData.id;

      // Determine assigned districts using unified logic
      let districtsData = await getAuthorizedDistricts(userData, db);

      const dNames = districtsData.map(d => d.name).filter(Boolean);
      setDistrictNames(dNames);

      // 2. Madarsas — use the shared alias-aware district matcher (and its
      // cached fetch) so counts stay consistent with the rest of the portal.
      const candidateMadarsas = await fetchMadarsasByDistricts(db, query, collection, where, getDocs, dNames);
      const mekhalaM = candidateMadarsas.filter(m =>
        dNames.some(dn => {
          try { return madrasaMatchesDistrict(m, dn); } catch { return false; }
        })
      ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const ids = mekhalaM.map(m => m.madarsaId || m.id);
      const nameMap = {};
      mekhalaM.forEach(m => { nameMap[m.madarsaId || m.id] = { name: m.name, district: m.district }; });
      setMadarsaMap(nameMap);

      if (ids.length === 0) {
        setStudents([]);
        setTeachers([]);
        setLoading(false);
        return;
      }

      // 3. Inactive/transferred students
      // Batches are capped at 30 (Firestore's max array size for an 'in'
      // filter) for single-'in' queries. The students/teachers queries below
      // also filter on `status in [...]` (3 values) — Firestore expands two
      // combined 'in' filters into a cartesian-product disjunction internally
      // (batchSize × statusCount) and caps that total at 30, so those two
      // queries need a smaller batch of 10 (10 × 3 = 30) or they fail with
      // "Too many disjunctions after normalization".
      const batches = [];
      for (let i = 0; i < ids.length; i += 30) batches.push(ids.slice(i, i + 30));
      const statusBatches = [];
      for (let i = 0; i < ids.length; i += 10) statusBatches.push(ids.slice(i, i + 10));

      const inactiveStudents = [];
      const inactiveTeachers = [];

      // Each chunk is caught individually so one failing/slow query (e.g. a
      // missing index) can't reject the whole Promise.all and leave the page
      // stuck on the loading spinner — it just logs and contributes no rows.
      await Promise.all([
        ...statusBatches.map(async (batch) => {
          try {
            const snap = await getDocs(
              query(
                collection(db, 'students'),
                where('madarsaId', 'in', batch),
                where('status', 'in', ['inactive', 'transferred', 'suspended'])
              )
            );
            snap.docs.forEach(d => inactiveStudents.push({ id: d.id, ...d.data() }));
          } catch (err) {
            console.error('Failed to load a students batch:', err);
          }
        }),
        ...statusBatches.map(async (batch) => {
          try {
            const snap = await getDocs(
              query(
                collection(db, 'teachers'),
                where('madarsaId', 'in', batch),
                where('status', 'in', ['inactive', 'transferred', 'suspended'])
              )
            );
            snap.docs.forEach(d => inactiveTeachers.push({ id: d.id, ...d.data() }));
          } catch (err) {
            console.error('Failed to load a teachers batch:', err);
          }
        }),
      ]);

      // Sort newest first by updatedAt
      const sortByDate = (a, b) => {
        const aTime = a.updatedAt?.toDate?.()?.getTime() || new Date(a.updatedAt || 0).getTime();
        const bTime = b.updatedAt?.toDate?.()?.getTime() || new Date(b.updatedAt || 0).getTime();
        return bTime - aTime;
      };

      setStudents(inactiveStudents.sort(sortByDate));
      setTeachers(inactiveTeachers.sort(sortByDate));

      // 4. Failed exam results
      const failedRes = [];
      await Promise.all(
        batches.map(async (batch) => {
          try {
            const snap = await getDocs(
              query(collection(db, 'results'), where('madarsaId', 'in', batch), where('status', '==', 'failed'))
            );
            snap.docs.forEach(d => failedRes.push({ id: d.id, ...d.data() }));
          } catch (err) {
            console.error('Failed to load a results batch:', err);
          }
        })
      );
      setFailedResults(failedRes.sort(sortByDate));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load history data');
    } finally {
      setLoading(false);
    }
  };

  /* ─── filter ─────────────────────────────────────── */
  const applyFilters = (list) => {
    return list.filter(item => {
      // Search
      const matchSearch = !search || [
        item.fullName, item.name, item.email,
        item.admissionNumber, item.employeeId, item.madarsaId
      ].some(f => f?.toLowerCase().includes(search.toLowerCase()));

      // Status
      const matchStatus = filterStatus === 'all' || item.status === filterStatus;

      // District
      const madarsaDistrict = madarsaMap[item.madarsaId]?.district || '';
      const matchDistrict = filterDistrict === 'all' ||
        madarsaDistrict.toLowerCase() === filterDistrict.toLowerCase();

      // Date range on updatedAt
      let matchDate = true;
      if (dateFrom || dateTo) {
        const itemDate = item.updatedAt?.toDate?.() || (item.updatedAt ? new Date(item.updatedAt) : null);
        if (itemDate) {
          if (dateFrom && itemDate < new Date(dateFrom)) matchDate = false;
          if (dateTo && itemDate > new Date(dateTo + 'T23:59:59')) matchDate = false;
        } else {
          matchDate = false;
        }
      }

      return matchSearch && matchStatus && matchDistrict && matchDate;
    });
  };

  const filteredStudents = applyFilters(students);
  const filteredTeachers = applyFilters(teachers);

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
          <div className="bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">History</h1>
                <p className="text-slate-300">Inactive and transferred students &amp; teachers across your mekhala</p>
              </div>
              <Button variant="outline" size="sm" className="text-slate-700 bg-white hover:bg-slate-50" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <UserX className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Inactive Students</p>
                  <p className="text-2xl font-bold">{students.filter(s => s.status === 'inactive').length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Transferred Students</p>
                  <p className="text-2xl font-bold">{students.filter(s => s.status === 'transferred').length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <UserX className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Inactive Teachers</p>
                  <p className="text-2xl font-bold">{teachers.filter(t => t.status === 'inactive').length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Transferred Teachers</p>
                  <p className="text-2xl font-bold">{teachers.filter(t => t.status === 'transferred').length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search name / email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDistrict} onValueChange={setFilterDistrict}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="District" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Districts</SelectItem>
                {districtNames.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">From</label>
              <Input type="date" className="w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">To</label>
              <Input type="date" className="w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            {(search || filterStatus !== 'all' || filterDistrict !== 'all' || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => {
                setSearch(''); setFilterStatus('all'); setFilterDistrict('all');
                setDateFrom(''); setDateTo('');
              }}>Clear filters</Button>
            )}
          </div>

          {/* Tab Toggle */}
          <div className="flex gap-2">
            <Button
              variant={tab === 'students' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('students')}
              className={tab === 'students' ? 'bg-slate-700 hover:bg-slate-800' : ''}
            >
              <Users className="w-4 h-4 mr-2" /> Students ({filteredStudents.length})
            </Button>
            <Button
              variant={tab === 'teachers' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('teachers')}
              className={tab === 'teachers' ? 'bg-slate-700 hover:bg-slate-800' : ''}
            >
              <GraduationCap className="w-4 h-4 mr-2" /> Teachers ({filteredTeachers.length})
            </Button>
            <Button
              variant={tab === 'failed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('failed')}
              className={tab === 'failed' ? 'bg-teal-700 hover:bg-teal-800' : ''}
            >
              <XCircle className="w-4 h-4 mr-2" /> Failed Exam ({failedResults.length})
            </Button>
          </div>

          {/* Students Table */}
          {tab === 'students' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Inactive / Transferred Students ({filteredStudents.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Admission No.</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Madarsa</TableHead>
                      <TableHead>District</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          No records found
                        </TableCell>
                      </TableRow>
                    ) : filteredStudents.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.fullName || s.name || '—'}</TableCell>
                        <TableCell className="text-gray-500">{s.admissionNumber || '—'}</TableCell>
                        <TableCell>{s.class || s.classLevel || s.std || '—'}</TableCell>
                        <TableCell>{madarsaMap[s.madarsaId]?.name || s.madarsaId || '—'}</TableCell>
                        <TableCell className="text-gray-500">{madarsaMap[s.madarsaId]?.district || '—'}</TableCell>
                        <TableCell>
                          <Badge className={statusColor(s.status)}>{s.status}</Badge>
                        </TableCell>
                        <TableCell className="text-gray-500">{formatDate(s.updatedAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelected({ type: 'student', data: s })}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Teachers Table */}
          {tab === 'teachers' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Inactive / Transferred Teachers ({filteredTeachers.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Madarsa</TableHead>
                      <TableHead>District</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeachers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          No records found
                        </TableCell>
                      </TableRow>
                    ) : filteredTeachers.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.fullName || t.name || '—'}</TableCell>
                        <TableCell className="text-gray-500">{t.email || '—'}</TableCell>
                        <TableCell>{madarsaMap[t.madarsaId]?.name || t.madarsaId || '—'}</TableCell>
                        <TableCell className="text-gray-500">{madarsaMap[t.madarsaId]?.district || '—'}</TableCell>
                        <TableCell>
                          <Badge className={statusColor(t.status)}>{t.status}</Badge>
                        </TableCell>
                        <TableCell className="text-gray-500 max-w-[120px] truncate" title={t.inactiveReason || t.transferReason || ''}>
                          {t.inactiveReason || t.transferReason || '—'}
                        </TableCell>
                        <TableCell className="text-gray-500">{formatDate(t.updatedAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelected({ type: 'teacher', data: t })}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Failed Exam Results */}
          {tab === 'failed' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-teal-600" />
                  Failed Exam Results ({failedResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {failedResults.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <XCircle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    No failed exam results found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Exam</TableHead>
                        <TableHead>Madarsa</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {failedResults.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{r.studentName || r.fullName || '—'}</p>
                            {r.admissionNumber && <p className="text-xs text-gray-400">#{r.admissionNumber}</p>}
                          </TableCell>
                          <TableCell className="text-sm">{r.classLevel || '—'}</TableCell>
                          <TableCell className="text-sm">{r.examTitle || r.examName || '—'}</TableCell>
                          <TableCell className="text-sm">{madarsaMap[r.madarsaId]?.name || r.madarsaName || r.madarsaId || '—'}</TableCell>
                          <TableCell>
                            {r.percentage != null ? (
                              <Badge className="bg-red-100 text-red-700">{r.percentage}%</Badge>
                            ) : r.obtainedMarks != null ? (
                              <Badge className="bg-red-100 text-red-700">{r.obtainedMarks}/{r.totalMarks}</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700">Failed</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{formatDate(r.createdAt || r.updatedAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Detail Dialog */}
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selected?.type === 'student' ? 'Student Details' : 'Teacher Details'}
              </DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-3">
                {[
                  ['Name', selected.data.fullName || selected.data.name],
                  ['Email', selected.data.email],
                  ...(selected.type === 'student' ? [
                    ['Admission No.', selected.data.admissionNumber],
                    ['Class', selected.data.class || selected.data.classLevel || selected.data.std],
                    ['DOB', formatDate(selected.data.dateOfBirth || selected.data.dob)],
                  ] : [
                    ['Employee ID', selected.data.employeeId],
                    ['Qualification', selected.data.qualification],
                  ]),
                  ['Madarsa', madarsaMap[selected.data.madarsaId]?.name || selected.data.madarsaId],
                  ['District', madarsaMap[selected.data.madarsaId]?.district],
                  ['Status', selected.data.status],
                  ['Inactive Reason', selected.data.inactiveReason],
                  ['Transfer Reason', selected.data.transferReason],
                  ['Transfer To', selected.data.transferTo || selected.data.newMadarsaId],
                  ['Updated', formatDate(selected.data.updatedAt)],
                  ['Created', formatDate(selected.data.createdAt)],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="flex gap-3 text-sm">
                    <span className="w-36 text-gray-500 shrink-0">{label}</span>
                    <span className="font-medium break-all">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  );
}



