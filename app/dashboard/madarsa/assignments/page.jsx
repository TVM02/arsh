'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Plus, Search, Trash2, Upload, Users, User, BookOpen, Calendar, Edit2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { collection, getDocs, getDoc, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import useAuthStore from '@/lib/authStore';
import Image from 'next/image';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetType: 'both', // 'students', 'teachers', or 'both'
    dueDate: '',
    file: null,
    filePreview: null
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { user, userData } = useAuthStore();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    if (userData || user) {
      fetchAssignments();
    }
  }, [userData, user]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      let assignmentsQuery;
      let needsClientSort = false;

      if (userData?.role === 'admin' || userData?.role === 'central_admin') {
        assignmentsQuery = query(
          collection(db, 'assignments'),
          orderBy('createdAt', 'desc')
        );
      } else if (userData?.madarsaId) {
        assignmentsQuery = query(
          collection(db, 'assignments'),
          where('madarsaId', '==', userData.madarsaId)
        );
        needsClientSort = true;
      } else {
        // Fallback for missing madarsaId
        assignmentsQuery = query(
          collection(db, 'assignments'),
          where('createdBy', '==', user?.uid)
        );
        needsClientSort = true;
      }
      
      const snapshot = await getDocs(assignmentsQuery);
      
      const userCache = {};
      let assignmentsData = await Promise.all(snapshot.docs.map(async docSnap => {
        const data = docSnap.data();
        let creatorName = data.createdByName;

        if (!creatorName && data.createdBy && data.createdBy !== 'unknown') {
          if (!userCache[data.createdBy]) {
            try {
              const userDocRef = doc(db, 'users', data.createdBy);
              const userDoc = await getDoc(userDocRef);
              if (userDoc.exists()) {
                const ud = userDoc.data();
                userCache[data.createdBy] = ud.adminName || ud.fullName || ud.name || data.createdBy;
              } else {
                userCache[data.createdBy] = data.createdBy;
              }
            } catch (err) {
              userCache[data.createdBy] = data.createdBy;
            }
          }
          creatorName = userCache[data.createdBy];
        }

        return {
          id: docSnap.id,
          ...data,
          creatorName: creatorName || data.createdBy || 'Unknown'
        };
      }));
      
      if (needsClientSort) {
        assignmentsData.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || new Date(a.createdAt).getTime() || 0;
          const timeB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || new Date(b.createdAt).getTime() || 0;
          return timeB - timeA;
        });
      }
      
      setAssignments(assignmentsData);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Failed to fetch assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      setFormData(prev => ({
        ...prev,
        file,
        filePreview: URL.createObjectURL(file)
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.title.trim()) {
      toast.error('Please enter a title for the assignment');
      return;
    }

    if (!formData.file) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Upload to Firebase Storage
      toast.info('Uploading image to Firebase Storage...');
      const imageUrl = await uploadToFirebaseStorage(formData.file);
      
      if (!imageUrl || typeof imageUrl !== 'string') {
        throw new Error('Failed to get valid image URL from upload');
      }

      toast.success('Image uploaded successfully!');

      // Step 2: Save to Firebase
      toast.info('Saving assignment to database...');
      setUploadProgress(90);

      // Prepare Firestore data with validated values
      const assignmentData = {
        title: formData.title.trim(),
        description: formData.description?.trim() || '',
        targetType: formData.targetType || 'both',
        dueDate: formData.dueDate || null,
        imageUrl: imageUrl,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'unknown',
        createdByName: userData?.adminName || userData?.fullName || userData?.name || 'Sadar Admin',
        madarsaId: userData?.madarsaId || 'madarsa-001' // Default to 'madarsa-001' if not set
      };

      // Validate that all required fields are present and not undefined
      if (!assignmentData.title || !assignmentData.imageUrl) {
        throw new Error('Missing required fields after validation');
      }

      // console.log('Saving to Firestore:', assignmentData);

      // Save to Firestore
      await addDoc(collection(db, 'assignments'), assignmentData);
      
      setUploadProgress(100);
      toast.success('Assignment uploaded successfully!');
      
      // Reset form and close dialog
      setIsDialogOpen(false);
      resetForm();
      
      // Refresh assignments list
      fetchAssignments();
    } catch (error) {
      console.error('Error in assignment submission:', error);
      const errorMessage = error.message || 'Failed to upload assignment';
      toast.error(errorMessage);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

const uploadToFirebaseStorage = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided for upload'));
      return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `assignments/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storageRef = ref(storage, fileName);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(progress);
      },
      (error) => {
        console.error('Error uploading to Firebase Storage:', error);
        setUploadProgress(0);
        reject(new Error(`Image upload failed: ${error.message}`));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setUploadProgress(100);
          resolve(downloadURL);
        } catch (error) {
          console.error('Error getting download URL:', error);
          reject(new Error('Failed to retrieve uploaded image URL'));
        }
      }
    );
  });
};

  const resetForm = () => {
    // Clean up file preview URL to prevent memory leaks
    if (formData.filePreview) {
      URL.revokeObjectURL(formData.filePreview);
    }
    
    setFormData({
      title: '',
      description: '',
      targetType: 'both',
      dueDate: '',
      file: null,
      filePreview: null
    });
    setUploadProgress(0);
  };

  const handleDialogClose = (open) => {
    if (!open && !uploading) {
      resetForm();
    }
    setIsDialogOpen(open);
  };

  const handleDeleteAssignment = async (assignment) => {
    // Check if user has permission to delete
    const canDelete = userData?.role === 'admin' || userData?.role === 'madarsa-admin' || userData?.role === 'madarsa_admin' || userData?.role === 'manager' || userData?.role === 'sadar' || assignment.createdBy === user?.uid;
    
    if (!canDelete) {
      toast.error('You do not have permission to delete this assignment');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${assignment.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'assignments', assignment.id));
      
      toast.success('Assignment deleted successfully!');
      
      // Refresh assignments list
      fetchAssignments();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error('Failed to delete assignment');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      toast.error("Title cannot be empty");
      return;
    }
    try {
      await updateDoc(doc(db, 'assignments', editingAssignment.id), {
        title: editTitle.trim(),
      });
      toast.success("Assignment title updated!");
      setEditDialogOpen(false);
      setEditingAssignment(null);
      setEditTitle('');
      fetchAssignments();
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast.error('Failed to update assignment title');
    }
  };

  const filteredAssignments = assignments.filter(assignment =>
    assignment.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout user={user} role={userData?.role || user?.role}>
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-tight">Assignments</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">Upload and manage assignments for students and teachers</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto min-h-[44px] font-medium">
                <Plus className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>New Assignment</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl bg-white max-h-[90vh] overflow-y-auto mx-auto">
              <DialogHeader className="pb-4">
                <DialogTitle className="text-lg sm:text-xl">Upload New Assignment</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="mt-1 h-10 sm:h-9"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="mt-1 h-10 sm:h-9"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="targetType" className="text-sm font-medium">Target Audience *</Label>
                    <select
                      id="targetType"
                      value={formData.targetType}
                      onChange={(e) => setFormData({...formData, targetType: e.target.value})}
                      className="flex h-10 sm:h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                      required
                    >
                      <option value="students">Students Only</option>
                      <option value="teachers">Teachers Only</option>
                      <option value="both">Both Students and Teachers</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="dueDate" className="text-sm font-medium">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                      className="mt-1 h-10 sm:h-9"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="file" className="text-sm font-medium">Assignment File (Image) *</Label>
                  <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-300 px-4 sm:px-6 py-6 sm:py-10">
                    <div className="text-center w-full">
                      {formData.filePreview ? (
                        <div className="space-y-3">
                          <div className="relative h-32 sm:h-40 w-full max-w-sm mx-auto">
                            <Image
                              src={formData.filePreview}
                              alt="Assignment preview"
                              fill
                              className="object-contain rounded-md"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (formData.filePreview) {
                                URL.revokeObjectURL(formData.filePreview);
                              }
                              setFormData(prev => ({...prev, file: null, filePreview: null}));
                            }}
                            className="min-h-[36px]"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-y-3 sm:gap-y-4">
                          <Upload className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
                          <div className="flex flex-col sm:flex-row text-sm text-gray-600">
                            <label
                              htmlFor="file-upload"
                              className="relative cursor-pointer rounded-md bg-white font-medium text-teal-600 hover:text-teal-500 min-h-[44px] flex items-center justify-center px-3 py-2"
                            >
                              <span>Upload a file</span>
                              <input
                                id="file-upload"
                                name="file-upload"
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={handleFileChange}
                              />
                            </label>
                            <p className="pl-0 sm:pl-1 mt-1 sm:mt-0 text-center">or drag and drop</p>
                          </div>
                          <p className="text-xs text-gray-500 text-center">PNG, JPG, GIF up to 10MB</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Upload Progress</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="w-full" />
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button type="submit" disabled={uploading} className="bg-teal-600 hover:bg-teal-700 min-h-[44px] font-medium flex-1 sm:flex-none">
                    {uploading ? `Uploading... ${uploadProgress}%` : 'Upload Assignment'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => handleDialogClose(false)} disabled={uploading} className="min-h-[44px] font-medium flex-1 sm:flex-none">
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search assignments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 sm:h-9"
            />
          </div>
          <Badge variant="secondary" className="self-start sm:self-center px-3 py-1 text-sm">
            {filteredAssignments.length} assignments
          </Badge>
        </div>

        {/* Assignments List */}
        {loading ? (
          <div className="text-center py-8 sm:py-10 md:py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-teal-600 border-t-transparent mx-auto"></div>
            <p className="text-gray-600 mt-4 text-sm sm:text-base">Loading assignments...</p>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 sm:py-10 md:py-12">
              <p className="text-gray-600 text-sm sm:text-base">No assignments found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {filteredAssignments.map((assignment) => (
              <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-5 md:p-6">
                  <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 lg:gap-6">
                    <div className="w-full lg:w-1/3">
                      <div className="relative h-40 sm:h-48 w-full rounded-md overflow-hidden bg-gray-100">
                        <Image
                          src={assignment.imageUrl}
                          alt={assignment.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight mb-2">{assignment.title}</h3>
                          <Badge variant="secondary" className="text-xs font-medium">
                            {assignment.targetType === 'both' ? 'Students & Teachers' : 
                             assignment.targetType === 'students' ? 'Students Only' : 'Teachers Only'}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-row lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2 lg:ml-4">
                          <Button variant="outline" size="sm" asChild className="flex-1 lg:flex-none min-h-[36px] text-xs sm:text-sm">
                            <a href={assignment.imageUrl} target="_blank" rel="noopener noreferrer">
                              <BookOpen className="w-4 h-4 mr-1 lg:mr-2" />
                              <span>View</span>
                            </a>
                          </Button>
                          {(userData?.role === 'admin' || userData?.role === 'madarsa_admin' || userData?.role === 'madarsa-admin' || userData?.role === 'manager' || userData?.role === 'sadar' || assignment.createdBy === user?.uid) && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  setEditingAssignment(assignment);
                                  setEditTitle(assignment.title);
                                  setEditDialogOpen(true);
                                }}
                                className="flex-1 lg:flex-none min-h-[36px] text-xs sm:text-sm"
                              >
                                <Edit2 className="w-4 h-4 mr-1 lg:mr-2" />
                                <span>Edit</span>
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleDeleteAssignment(assignment)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-1 lg:flex-none min-h-[36px] text-xs sm:text-sm"
                              >
                                <Trash2 className="w-4 h-4 mr-1 lg:mr-2" />
                                <span>Delete</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {assignment.description && (
                        <p className="mt-3 text-gray-600 text-sm sm:text-base leading-relaxed">{assignment.description}</p>
                      )}
                      
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                        <div className="flex items-center space-x-2 min-w-0">
                          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate"><span className="font-medium">Created at:</span> {assignment.createdAt?.toDate ? assignment.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}) : 'N/A'}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2 min-w-0">
                          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate"><span className="font-medium">Posted:</span> {assignment.createdAt?.toDate ? assignment.createdAt.toDate().toLocaleDateString() : 'N/A'}</span>
                        </div>
                        
                        {assignment.dueDate && (
                          <div className="flex items-center space-x-2 min-w-0 sm:col-span-2">
                            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="truncate"><span className="font-medium">Due:</span> {new Date(assignment.dueDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Edit Assignment Title</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
            <div>
              <Label htmlFor="editTitle">Title *</Label>
              <Input
                id="editTitle"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}