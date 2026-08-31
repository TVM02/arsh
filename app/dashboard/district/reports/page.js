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
  FileText, 
  Download,
  Calendar,
  TrendingUp,
  Users,
  Building,
  GraduationCap,
  MapPin,
  BarChart3,
  PieChart,
  Filter,
  Search
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

export default function MekhalaReports() {
  const { user, userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [districts, setDistricts] = useState([]);
  const [madarsas, setMadarsas] = useState([]);
  const [stats, setStats] = useState({
    totalDistricts: 0,
    totalMadarsas: 0,
    totalStudents: 0,
    totalTeachers: 0,
    activeDistricts: 0,
    activeMadarsas: 0
  });
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState('overview');

  useEffect(() => {
    if (userData && userData.role === 'mekhala_admin') {
      const fetchReportsData = async () => {
        try {
          setLoading(true);

          // Get current mekhala admin's ID
          const mekhalaId = userData.uid || userData.id;

          // Fetch districts assigned to this mekhala
          const districtsQuery = query(
            collection(db, 'districts'),
            where('mekhalaId', '==', mekhalaId),
            orderBy('name', 'asc')
          );
          const districtsSnapshot = await getDocs(districtsQuery);
          const districtsData = districtsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setDistricts(districtsData);

          // Fetch madarsas in assigned districts
          if (districtsData.length > 0) {
            const districtNames = districtsData.map(d => d.name);
            
            // Fetch all madarsas and filter by district
            const madarsasQuery = query(
              collection(db, 'madarsas'),
              orderBy('name', 'asc')
            );
            const madarsasSnapshot = await getDocs(madarsasQuery);
            const allMadarsas = madarsasSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));

            // Filter madarsas by district
            const filteredMadarsas = allMadarsas.filter(madarsa => 
              districtNames.includes(madarsa.district)
            );
            setMadarsas(filteredMadarsas);

            // Calculate comprehensive stats
            let totalStudents = 0;
            let totalTeachers = 0;

            // Get student and teacher counts
            for (const madarsa of filteredMadarsas) {
              try {
                // Get students count
                const studentsQuery = query(
                  collection(db, 'students'),
                  where('madarsaId', '==', madarsa.madarsaId || madarsa.id)
                );
                const studentsSnapshot = await getDocs(studentsQuery);
                totalStudents += studentsSnapshot.size;

                // Get teachers count
                const teachersQuery = query(
                  collection(db, 'teachers'),
                  where('madarsaId', '==', madarsa.madarsaId || madarsa.id)
                );
                const teachersSnapshot = await getDocs(teachersQuery);
                totalTeachers += teachersSnapshot.size;
              } catch (error) {
                console.error(`Error fetching counts for madarsa ${madarsa.id}:`, error);
              }
            }

            const activeDistricts = districtsData.filter(d => d.status === 'active').length;
            const activeMadarsas = filteredMadarsas.filter(m => m.status === 'active').length;

            setStats({
              totalDistricts: districtsData.length,
              totalMadarsas: filteredMadarsas.length,
              totalStudents,
              totalTeachers,
              activeDistricts,
              activeMadarsas
            });

          } else {
            setMadarsas([]);
            setStats({
              totalDistricts: 0,
              totalMadarsas: 0,
              totalStudents: 0,
              totalTeachers: 0,
              activeDistricts: 0,
              activeMadarsas: 0
            });
          }

        } catch (error) {
          console.error('Error fetching reports data:', error);
          toast.error('Failed to fetch reports data');
        } finally {
          setLoading(false);
        }
      };

      fetchReportsData();
    } else {
      setLoading(false);
    }
  }, [userData]);

  // Generate district-wise report data
  const districtWiseData = districts.map(district => {
    const districtMadarsas = madarsas.filter(m => m.district === district.name);
    const studentCount = districtMadarsas.reduce((sum, m) => sum + (m.studentCount || 0), 0);
    const teacherCount = districtMadarsas.reduce((sum, m) => sum + (m.teacherCount || 0), 0);
    
    return {
      district: district.name,
      madarsas: districtMadarsas.length,
      students: studentCount,
      teachers: teacherCount,
      status: district.status || 'active'
    };
  });

  const downloadReport = (reportType) => {
    // Here you would implement actual PDF/Excel generation
    toast.success(`${reportType} report download initiated`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading reports...</div>
        </div>
      </Layout>
    );
  }

  if (!userData || userData.role !== 'mekhala_admin') {
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
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">
            Reports & Analytics
          </h1>
          <p className="text-purple-100">
            Comprehensive reports and analytics for your mekhala administration
          </p>
        </div>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Districts</p>
                  <p className="text-2xl font-bold">{stats.totalDistricts}</p>
                  <p className="text-xs text-green-600">{stats.activeDistricts} active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Building className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Madrasas</p>
                  <p className="text-2xl font-bold">{stats.totalMadarsas}</p>
                  <p className="text-xs text-green-600">{stats.activeMadarsas} active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Students</p>
                  <p className="text-2xl font-bold">{stats.totalStudents}</p>
                  <p className="text-xs text-gray-500">Total enrolled</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Teachers</p>
                  <p className="text-2xl font-bold">{stats.totalTeachers}</p>
                  <p className="text-xs text-gray-500">Total faculty</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Types */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Reports */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Quick Reports
              </CardTitle>
              <CardDescription>
                Generate and download standard reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-between"
                onClick={() => downloadReport('District Summary')}
              >
                <span>District Summary</span>
                <Download className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-between"
                onClick={() => downloadReport('Madarsa List')}
              >
                <span>Madrasa List</span>
                <Download className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-between"
                onClick={() => downloadReport('Student Statistics')}
              >
                <span>Student Statistics</span>
                <Download className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-between"
                onClick={() => downloadReport('Teacher Report')}
              >
                <span>Teacher Report</span>
                <Download className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-between"
                onClick={() => downloadReport('Comprehensive Report')}
              >
                <span>Comprehensive Report</span>
                <Download className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Analytics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics Overview
              </CardTitle>
              <CardDescription>
                Key performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">District Coverage</span>
                  <Badge variant="outline">{stats.totalDistricts} districts</Badge>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${(stats.activeDistricts / Math.max(stats.totalDistricts, 1)) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Active Madrasas</span>
                  <Badge variant="outline">{stats.activeMadrassas}/{stats.totalMadrassas}</Badge>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${(stats.activeMadarsas / Math.max(stats.totalMadarsas, 1)) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Student-Teacher Ratio</span>
                  <Badge variant="outline">
                    {stats.totalTeachers > 0 ? (stats.totalStudents / stats.totalTeachers).toFixed(1) : '0'}:1
                  </Badge>
                </div>
              </div>

              <div className="pt-4">
                <Button variant="outline" className="w-full">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Detailed Analytics
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Latest updates and activities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Reports last updated</span>
                </div>
                <p className="text-xs text-gray-500 ml-4">
                  {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                </p>
              </div>
              
              <div className="text-sm text-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Data synchronization</span>
                </div>
                <p className="text-xs text-gray-500 ml-4">
                  All district and madarsa data synchronized
                </p>
              </div>

              <div className="text-sm text-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>System status</span>
                </div>
                <p className="text-xs text-gray-500 ml-4">
                  All systems operational
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* District-wise Report Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              District-wise Summary
            </CardTitle>
            <CardDescription>
              Detailed breakdown by district
            </CardDescription>
          </CardHeader>
          <CardContent>
            {districtWiseData.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No districts assigned</h3>
                <p className="text-gray-500">District data will appear here when districts are assigned to your mekhala</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>District</TableHead>
                      <TableHead>Madrasas</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Teachers</TableHead>
                      <TableHead>Avg. Students/Madrasa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {districtWiseData.map((district, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{district.district}</TableCell>
                        <TableCell>{district.madarsas}</TableCell>
                        <TableCell>{district.students}</TableCell>
                        <TableCell>{district.teachers}</TableCell>
                        <TableCell>
                          {district.madarsas > 0 ? (district.students / district.madarsas).toFixed(1) : '0'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={district.status === 'active' ? 'default' : 'secondary'}
                            className={district.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                          >
                            {district.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => downloadReport(`District Report - ${district.district}`)}
                          >
                            <Download className="h-4 w-4" />
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
    </Layout>
  );
}
