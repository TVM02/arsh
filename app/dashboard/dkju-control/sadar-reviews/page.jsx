'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  FileText, 
  Eye, 
  Trash2, 
  Calendar,
  Search,
  Filter,
  Download,
  ImageIcon,
  Check,
  X,
  Clock,
  Edit,
  Building,
  User,
  MessageSquare
} from 'lucide-react';

export default function SadarReviewsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [filteredReviews, setFilteredReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReview, setSelectedReview] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        fetchReviews();
      } else {
        router.push('/auth/login/dkju-control');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      // Fetch all madarsas first to resolve IDs and names
      const madarsasSnapshot = await getDocs(collection(db, 'madarsas'));
      const madarsaMapByUid = {};
      const madarsaMapByEmail = {};
      const madarsaMapByDocId = {};

      madarsasSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const info = {
          mid: data.madarsaId || doc.id,
          name: data.name || data.madarsaName || 'Unknown'
        };
        if (data.firebaseAuthUid) {
          madarsaMapByUid[data.firebaseAuthUid] = info;
        }
        if (data.adminEmail) {
          madarsaMapByEmail[data.adminEmail] = info;
        }
        madarsaMapByDocId[doc.id] = info;
      });

      // Fetch all madarsa admin users to resolve their authentication UIDs to MID codes and Madrasa Names
      try {
        const usersQuery = query(collection(db, 'users'), where('role', '==', 'madarsa_admin'));
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const info = {
            mid: data.madarsaId || doc.id,
            name: data.madarsaName || data.name || data.fullName || 'Unknown'
          };
          madarsaMapByUid[doc.id] = info;
          if (data.email) {
            madarsaMapByEmail[data.email] = info;
          }
          if (data.adminEmail) {
            madarsaMapByEmail[data.adminEmail] = info;
          }
        });
      } catch (userError) {
        console.error('Error fetching madarsa admin users map:', userError);
      }

      const reviewsRef = collection(db, 'sadarReviews');
      const q = query(reviewsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const reviewsData = snapshot.docs.map(doc => {
        const data = doc.data();
        let resolvedMID = data.madarsaId;
        let resolvedName = data.madarsaName;

        const lookup = madarsaMapByUid[data.madarsaId] || madarsaMapByDocId[data.madarsaId] || madarsaMapByEmail[data.madarsaEmail];
        if (lookup) {
          resolvedMID = lookup.mid;
          resolvedName = lookup.name;
        }

        return {
          id: doc.id,
          ...data,
          resolvedMadarsaId: resolvedMID,
          resolvedMadarsaName: resolvedName,
          createdAt: data.createdAt?.toDate(),
          submittedAt: data.submittedAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        };
      });
      setReviews(reviewsData);
      setFilteredReviews(reviewsData);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast({
        title: "Error",
        description: "Failed to fetch reviews",
        variant: "destructive"
      });
    } finally {
      setLoadingReviews(false);
    }
  };

  // Filter and search logic
  useEffect(() => {
    let filtered = reviews;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(review => review.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(review =>
        review.reviewTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.madarsaName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.resolvedMadarsaName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.resolvedMadarsaId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.remarks?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredReviews(filtered);
  }, [reviews, searchTerm, statusFilter]);

  const deleteReview = async (reviewId) => {
    try {
      await deleteDoc(doc(db, 'sadarReviews', reviewId));
      toast({
        title: "Success",
        description: "Review deleted successfully"
      });
      fetchReviews();
    } catch (error) {
      console.error('Error deleting review:', error);
      toast({
        title: "Error",
        description: "Failed to delete review",
        variant: "destructive"
      });
    }
  };

  const updateReviewStatus = async (reviewId, newStatus, remarks = '') => {
    try {
      const updateData = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      if (remarks) {
        updateData.adminRemarks = remarks;
      }

      await updateDoc(doc(db, 'sadarReviews', reviewId), updateData);
      
      toast({
        title: "Success",
        description: `Review ${newStatus} successfully`
      });
      fetchReviews();
    } catch (error) {
      console.error('Error updating review status:', error);
      toast({
        title: "Error",
        description: "Failed to update review status",
        variant: "destructive"
      });
    }
  };

  const exportToCSV = () => {
    const csvData = filteredReviews.map(review => ({
      'Review Title': review.reviewTitle,
      'Madrasa Name': review.resolvedMadarsaName || review.madarsaName,
      'MID Code': review.resolvedMadarsaId || review.madarsaId || '-',
      'Status': review.status,
      'Files Count': review.files?.length || 0,
      'Created Date': review.createdAt?.toLocaleDateString() || '',
      'Submitted Date': review.submittedAt?.toLocaleDateString() || '',
      'Remarks': review.remarks?.replace(/\n/g, ' ') || ''
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sadar-reviews-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'draft':
        return <Edit className="h-4 w-4" />;
      case 'submitted':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <Check className="h-4 w-4" />;
      case 'rejected':
        return <X className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'secondary';
      case 'submitted':
        return 'default';
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const ViewReviewDialog = ({ review, open, onOpenChange }) => {
    const [adminRemarks, setAdminRemarks] = useState('');

    if (!review) return null;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {review.reviewTitle}
            </DialogTitle>
            <DialogDescription>
              Review details and attachments
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Review Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Madrasa Name
                </Label>
                <p className="text-sm bg-gray-50 p-2 rounded">
                  {review.resolvedMadarsaName || review.madarsaName}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  MID Code
                </Label>
                <p className="text-sm bg-gray-50 p-2 rounded font-mono">
                  {review.resolvedMadarsaId || review.madarsaId || 'N/A'}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Badge variant={getStatusColor(review.status)} className="flex items-center gap-1">
                    {getStatusIcon(review.status)}
                    Status
                  </Badge>
                </Label>
                <p className="text-sm bg-gray-50 p-2 rounded capitalize">{review.status}</p>
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Created Date
                </Label>
                <p className="text-sm bg-gray-50 p-2 rounded">
                  {review.createdAt?.toLocaleDateString() || 'Unknown'}
                </p>
              </div>
              
              {review.submittedAt && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Submitted Date
                  </Label>
                  <p className="text-sm bg-gray-50 p-2 rounded">
                    {review.submittedAt.toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Madrasa Remarks
              </Label>
              <div className="bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">{review.remarks}</p>
              </div>
            </div>

            {/* Admin Remarks */}
            {review.adminRemarks && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Admin Remarks
                </Label>
                <div className="bg-teal-50 p-3 rounded max-h-32 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{review.adminRemarks}</p>
                </div>
              </div>
            )}

            {/* Files */}
            {review.files && review.files.length > 0 && (
              <div className="space-y-2">
                <Label>Uploaded Files ({review.files.length})</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {review.files.map((file, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {file.type === 'image' ? (
                            <ImageIcon className="h-4 w-4 text-teal-500" />
                          ) : (
                            <FileText className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm font-medium truncate">{file.name}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(file.url, '_blank')}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Actions */}
            {review.status === 'submitted' && (
              <div className="space-y-4 border-t pt-4">
                <Label>Admin Action</Label>
                <Textarea
                  placeholder="Add admin remarks (optional)..."
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      updateReviewStatus(review.id, 'approved', adminRemarks);
                      onOpenChange(false);
                      setAdminRemarks('');
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      updateReviewStatus(review.id, 'rejected', adminRemarks);
                      onOpenChange(false);
                      setAdminRemarks('');
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 p-3 sm:p-4 md:p-6 lg:p-0">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg p-4 sm:p-5 md:p-6 text-white">
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-2 leading-tight">
            Sadar Reviews Management
          </h1>
          <p className="text-sm md:text-base text-teal-100 leading-relaxed">
            Manage all Thafteesh reviews submitted by Madrasas
          </p>
        </div>

        {/* Filters and Search */}
        <Card className="mb-4 md:mb-6 hover:shadow-md transition-shadow">
          <CardHeader className="p-4 sm:p-5 md:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl font-semibold">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label htmlFor="search" className="text-sm md:text-base font-medium">Search Reviews</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search by title, madarsa, or remarks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-auto py-3 text-sm md:text-base"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status-filter" className="text-sm md:text-base font-medium">Filter by Status</Label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm md:text-base"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <Button onClick={exportToCSV} className="flex items-center gap-2 w-full h-auto py-3 text-sm md:text-base font-medium">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reviews List */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="p-4 sm:p-5 md:p-6">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base sm:text-lg md:text-xl font-semibold">
                <FileText className="h-5 w-5" />
                Sadar Reviews ({filteredReviews.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
          {loadingReviews ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading reviews...</p>
            </div>
            ) : filteredReviews.length === 0 ? (
              <div className="text-center py-8 sm:py-10 md:py-12">
                <FileText className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-300" />
                <p className="mt-3 sm:mt-4 text-gray-500 text-sm md:text-base font-medium">
                  {searchTerm || statusFilter !== 'all' ? 'No reviews found matching your criteria' : 'No reviews submitted yet'}
                </p>
                <p className="text-gray-400 text-xs md:text-sm mt-1">
                  {searchTerm || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Reviews will appear here when madarsas submit them'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {filteredReviews.map((review) => (
                  <div key={review.id} className="border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                          <h3 className="font-semibold text-base sm:text-lg truncate">{review.reviewTitle}</h3>
                          <Badge variant={getStatusColor(review.status)} className="flex items-center gap-1 w-fit">
                            {getStatusIcon(review.status)}
                            <span className="text-xs font-medium">
                              {review.status.charAt(0).toUpperCase() + review.status.slice(1)}
                            </span>
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                          <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                            <Building className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              {review.resolvedMadarsaName || review.madarsaName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                            <span className="font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-sm border border-gray-200">
                              MID: {review.resolvedMadarsaId || review.madarsaId || 'N/A'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                            <Calendar className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{review.createdAt?.toLocaleDateString() || 'Unknown date'}</span>
                          </div>
                          
                          {review.files?.length > 0 && (
                            <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                              <FileText className="h-4 w-4 flex-shrink-0" />
                              {review.files.length} file(s)
                            </div>
                          )}
                        </div>
                        
                        <p className="text-gray-600 text-xs md:text-sm line-clamp-2 leading-relaxed">{review.remarks}</p>
                      </div>
                      
                      <div className="flex flex-row lg:flex-col gap-2 lg:ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReview(review);
                            setViewDialogOpen(true);
                          }}
                          className="flex items-center gap-1 h-auto py-2 px-3 text-xs md:text-sm font-medium"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline">View</span>
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 flex items-center gap-1 h-auto py-2 px-3 text-xs md:text-sm font-medium"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Review</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this review? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteReview(review.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          )}
        </CardContent>
      </Card>

      {/* View Review Dialog */}
      <ViewReviewDialog 
        review={selectedReview} 
        open={viewDialogOpen} 
        onOpenChange={setViewDialogOpen}
      />
      </div>
    </Layout>
  );
}
