'use client';

import { useState, useEffect } from 'react';
import useAuthStore from '@/lib/authStore';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Building, 
  Users, 
  GraduationCap,
  Search,
  Eye,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Filter,
  Download,
  Loader2
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  query, 
  where,
  orderBy 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import {
  fetchMadarsasByDistricts,
  madrasaMatchesDistrict,
  madrasaMatchesMekhala,
  isTrueDistrictName,
} from "@/lib/madrasaHierarchy";
import { getAuthorizedDistricts } from "@/lib/convenerData";
import { SearchableSelect } from "@/components/ui/searchable-select";

const normalizeMadarsaIdKey = (id) => {
  if (!id) return "";
  const s = String(id).trim().toLowerCase();
  return s.replace(/^(mid|mld)-/, ""); // remove prefix if any
};

export default function MekhalaMadarsas() {
  const { user, userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [madarsas, setMadarsas] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMekhala, setFilterMekhala] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [stats, setStats] = useState({
    totalMadarsas: 0,
    totalStudents: 0,
    totalTeachers: 0,
    activeMadarsas: 0
  });

  useEffect(() => {
    if (userData && userData.role === 'convener_admin') {
      const fetchMadarsasData = async () => {
        try {
          setLoading(true);

          // Determine assigned districts (shared with the rest of the convener portal
          // so district assignment logic never drifts between pages).
          const allDistrictsSnapshot = await getDocs(collection(db, "districts"));
          const allDistrictsCount = allDistrictsSnapshot.size;

          let districtsData = await getAuthorizedDistricts(userData, db);
          const isStateLevel = districtsData.length >= allDistrictsCount && allDistrictsCount > 0;

          districtsData.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
          setDistricts(districtsData);

          // Get district names
          const districtNames = districtsData.map(d => d.name);

          if (districtNames.length > 0) {
            // fetchMadarsasByDistricts returns ALL madarsas statewide (it relies
            // on callers to filter), so scope the result to our districts here.
            const candidateMadarsas = await fetchMadarsasByDistricts(
              db,
              query,
              collection,
              where,
              getDocs,
              districtNames
            );
            const filteredMadarsas = isStateLevel
              ? candidateMadarsas
              : candidateMadarsas.filter((m) =>
                  districtNames.some((d) => {
                    try {
                      return madrasaMatchesDistrict(m, d);
                    } catch {
                      return false;
                    }
                  })
                );

            // Sort by name
            filteredMadarsas.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

            // Student/teacher counts come from a server-cached endpoint (one
            // full scan shared across all users every 5 minutes) instead of
            // dozens of chunked `madarsaId in [...]` reads issued directly
            // from the browser on every page load — that pattern was
            // exhausting the Firestore read quota under real traffic.
            let studentCountMap = {};
            let teacherCountMap = {};
            try {
              const countsRes = await fetch('/api/convener/madarsa-counts', {
                headers: { 'Cache-Control': 'no-cache' },
              });
              if (countsRes.ok) {
                const countsJson = await countsRes.json();
                studentCountMap = countsJson.studentCounts || {};
                teacherCountMap = countsJson.teacherCounts || {};
              }
            } catch (err) {
              console.error('Failed to load madarsa counts:', err);
            }

            const madarsasWithCounts = filteredMadarsas.map((m) => {
              const primaryKey = normalizeMadarsaIdKey(m.madarsaId);
              const fallbackKey = normalizeMadarsaIdKey(m.id);
              const sCount = studentCountMap[primaryKey] || studentCountMap[fallbackKey] || 0;
              const tCount = teacherCountMap[primaryKey] || teacherCountMap[fallbackKey] || 0;
              return {
                ...m,
                studentCount: sCount,
                teacherCount: tCount,
              };
            });

            setMadarsas(madarsasWithCounts);

            // Calculate stats
            const totalStudents = madarsasWithCounts.reduce((sum, m) => sum + (m.studentCount || 0), 0);
            const totalTeachers = madarsasWithCounts.reduce((sum, m) => sum + (m.teacherCount || 0), 0);
            // Madarsas with no `status` field are treated as active everywhere
            // in this UI (badges default to "active"), so the stat must use
            // the same fallback or the active/inactive counts won't add up
            // to the total.
            const activeMadarsas = madarsasWithCounts.filter(m => (m.status || 'active') === 'active').length;

            setStats({
              totalMadarsas: madarsasWithCounts.length,
              totalStudents,
              totalTeachers,
              activeMadarsas
            });
          } else {
            setMadarsas([]);
            setStats({
              totalMadarsas: 0,
              totalStudents: 0,
              totalTeachers: 0,
              activeMadarsas: 0
            });
          }

        } catch (error) {
          console.error('Error fetching madarsas:', error);
          toast.error('Failed to fetch madarsas data');
        } finally {
          setLoading(false);
        }
      };

      fetchMadarsasData();
    } else {
      setLoading(false);
    }
  }, [userData]);

  // Options shown in the Mekhala dropdown. The `districts` collection also
  // contains a handful of legacy docs named after a true parent District
  // (e.g. "ALAPPUZHA") rather than a Mekhala sub-unit — exclude those here
  // so the filter only offers actual mekhalas to pick from.
  const mekhalaOptions = districts.filter((d) => !isTrueDistrictName(d.name));

  // Filter madarsas based on search term, mekhala, and status
  const filteredMadarsas = madarsas.filter(madarsa => {
    const matchesSearch = madarsa.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         madarsa.madarsaId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         madarsa.adminName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         madarsa.adminEmail?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMekhala = filterMekhala === 'all' ||
      (() => {
        try {
          return madrasaMatchesMekhala(madarsa, filterMekhala);
        } catch {
          return madarsa.district === filterMekhala;
        }
      })();
    const status = madarsa.status || 'active';
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
    const instType = (madarsa.type || madarsa.institutionType || 'Madrasa').toLowerCase();
    const matchesType = filterType === 'all' || instType === filterType.toLowerCase();

    return matchesSearch && matchesMekhala && matchesStatus && matchesType;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMadarsas.length / itemsPerPage));
  const paginatedMadarsas = filteredMadarsas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterMekhala, filterStatus, filterType]);

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
        </div>
      </Layout>
    );
  }

  if (!userData || userData.role !== 'convener_admin') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You need to be logged in as a Mekhala Admin to access this page.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">
            Madarsa Management
          </h1>
          <p className="text-green-100">
            Manage and monitor madarsas in your assigned districts
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Building className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Madrasas</p>
                  <p className="text-2xl font-bold">{stats.totalMadarsas}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Students</p>
                  <p className="text-2xl font-bold">{stats.totalStudents}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Teachers</p>
                  <p className="text-2xl font-bold">{stats.totalTeachers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Building className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Madrasas</p>
                  <p className="text-2xl font-bold">{stats.activeMadarsas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Madrasas Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 justify-between">
              <span className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Madrasas ({filteredMadarsas.length})
              </span>
              <Button
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => {
                  const headers = ['Name','Mekhala','Type','Status','Students','Teachers','Manager','Phone','Address'];
                  const rows = filteredMadarsas.map(m => [
                    m.name || '',
                    m.district || '',
                    m.type || m.institutionType || 'Madrasa',
                    m.status || 'active',
                    m.studentCount || 0,
                    m.teacherCount || 0,
                    m.managerName || m.adminName || '',
                    m.adminPhone || m.phone || '',
                    m.address || ''
                  ]);
                  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'madarsas.csv'; a.click();
                  URL.revokeObjectURL(url);
                  toast.success('CSV exported successfully');
                }}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </CardTitle>
            <CardDescription>
              Madrasas in your assigned districts
            </CardDescription>
            
            {/* Search and Filters */}
            <div className="flex flex-col gap-4 mt-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by name, ID, admin name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                {/* Mekhala Filter */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Mekhala:</span>
                  <SearchableSelect
                    value={filterMekhala}
                    onValueChange={setFilterMekhala}
                    options={mekhalaOptions}
                    placeholder="Select a mekhala"
                    searchPlaceholder="Search mekhala..."
                    getOptionLabel={(d) => d.name}
                    getOptionValue={(d) => d.name}
                    allOptionText="All Mekhala"
                    className="max-w-sm"
                  />
                </div>

                {/* Type Filter */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Institution Type:</span>
                  <div className="flex gap-2 flex-wrap">
                    {['all', 'Madrasa'].map(t => (
                      <Button
                        key={t}
                        variant={filterType === t ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterType(t)}
                      >
                        {t === 'all' ? 'All' : t}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Status:</span>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant={filterStatus === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterStatus('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant={filterStatus === 'active' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterStatus('active')}
                    >
                      Active
                    </Button>
                    <Button
                      variant={filterStatus === 'inactive' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterStatus('inactive')}
                    >
                      Inactive
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredMadarsas.length === 0 ? (
              <div className="text-center py-12">
                <Building className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  {searchTerm || filterMekhala !== 'all' || filterStatus !== 'all'
                    ? 'No madarsas found'
                    : 'No madarsas in your mekhalas'
                  }
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm || filterMekhala !== 'all' || filterStatus !== 'all'
                    ? 'Try adjusting your search criteria or filters'
                    : 'Madrasas will appear here when they are added to your assigned mekhalas'
                  }
                </p>
                {(searchTerm || filterMekhala !== 'all' || filterStatus !== 'all') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      setFilterMekhala('all');
                      setFilterStatus('all');
                      setFilterType('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Madrasa Details</TableHead>
                      <TableHead>Mekhala</TableHead>
                      <TableHead>Manager Contact</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Teachers</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedMadarsas.map((madarsa) => (
                      <TableRow key={madarsa.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <div className="font-semibold text-gray-900">{madarsa.name || "N/A"}</div>
                            <Badge variant="outline" className="mt-1 bg-blue-50 text-blue-700">
                              {madarsa.madarsaId || "N/A"}
                            </Badge>
                            {madarsa.established && (
                              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Est. {madarsa.established}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-gray-100">
                            {madarsa.district || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{madarsa.managerName || madarsa.adminName || "N/A"}</div>
                            <div className="text-gray-500 flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {madarsa.adminPhone || madarsa.phone || "N/A"}
                            </div>
                            <div className="text-gray-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {madarsa.address || "N/A"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <GraduationCap className="h-4 w-4 text-blue-600" />
                            </div>
                            {madarsa.studentCount === undefined ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : <span className="font-semibold">{madarsa.studentCount || 0}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                              <Users className="h-4 w-4 text-purple-600" />
                            </div>
                            {madarsa.teacherCount === undefined ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : <span className="font-semibold">{madarsa.teacherCount || 0}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={(madarsa.status || 'active') === 'active' ? 'default' : 'secondary'}
                            className={(madarsa.status || 'active') === 'active' ? 'bg-green-100 text-green-800' : ''}
                          >
                            {madarsa.status || 'active'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-4 mt-4 border-t border-gray-100">
                  <div className="text-sm text-gray-500">
                    Showing <span className="font-medium text-gray-900">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-medium text-gray-900">{Math.min(currentPage * itemsPerPage, filteredMadarsas.length)}</span> of <span className="font-medium text-gray-900">{filteredMadarsas.length}</span> madarsas
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = currentPage;
                        if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;
                        
                        if (pageNum <= 0 || pageNum > totalPages) return null;

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
