'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Plus, Search, Trash2, Upload, BookOpen, Calendar, Download, Edit3, X, ChevronLeft, ChevronRight, Eye, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, where, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import useAuthStore from '@/lib/authStore';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';


export default function TeacherAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [imageCarouselStates, setImageCarouselStates] = useState({});
  const [previewAssignment, setPreviewAssignment] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [creatorInfo, setCreatorInfo] = useState({});
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetType: 'students',
    classLevel: 'all',
    dueDate: '',
    files: [],
    existingImages: [],
    filePreviews: []
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { user, userData } = useAuthStore();

  const classOptions = [
    { value: 'all', label: 'All Classes' },
    { value: '1', label: 'Class 1' },
    { value: '2', label: 'Class 2' },
    { value: '3', label: 'Class 3' },
    { value: '4', label: 'Class 4' },
    { value: '5', label: 'Class 5' },
    { value: '6', label: 'Class 6' },
    { value: '7', label: 'Class 7' },
    { value: '8', label: 'Class 8' },
    { value: '9', label: 'Class 9' },
    { value: '10', label: 'Class 10' },
    { value: '11', label: 'Class 11' },
    { value: '12', label: 'Class 12' }
  ];

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        setLoading(true);

        let madarsaId = userData?.madarsaId || 'madarsa-001'; // Default or fallback madarsa ID

        if (!madarsaId) {
          toast.error('No madarsa assigned');
          return;
        }

        const assignmentsQuery = query(
          collection(db, 'assignments'),
          where('madarsaId', '==', madarsaId),
          where('targetType', 'in', ['students', 'both']),
          orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(assignmentsQuery);
        const assignmentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setAssignments(assignmentsData);
      } catch (error) {
        console.error('Error fetching assignments:', error);
        toast.error('Failed to fetch assignments');
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();
  }, [userData?.madarsaId]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);

      let madarsaId = userData?.madarsaId || 'madarsa-001'; // Default or fallback madarsa ID

      if (!madarsaId) {
        toast.error('No madarsa assigned');
        return;
      }

      const assignmentsQuery = query(
        collection(db, 'assignments'),
        where('madarsaId', '==', madarsaId),
        where('targetType', 'in', ['students', 'both']),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(assignmentsQuery);
      const assignmentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setAssignments(assignmentsData);
      
      // Fetch creator information for all assignments
      await fetchCreatorInfo(assignmentsData);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Failed to fetch assignments');
    } finally {
      setLoading(false);
    }
  };

  const fetchCreatorInfo = async (assignments) => {
    const creators = {};
    const uniqueCreatorIds = [...new Set(assignments.map(a => a.createdBy).filter(Boolean))];
    
    for (const creatorId of uniqueCreatorIds) {
      try {
        // Try to find in users collection first
        const userDoc = await getDoc(doc(db, 'users', creatorId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          creators[creatorId] = {
            name: userData.fullName || userData.name || 'Unknown User',
            role: userData.role || 'user',
            email: userData.email || ''
          };
          continue;
        }

        // Try teachers collection
        const teachersQuery = query(collection(db, 'teachers'), where('uid', '==', creatorId));
        const teachersSnapshot = await getDocs(teachersQuery);
        if (!teachersSnapshot.empty) {
          const teacherData = teachersSnapshot.docs[0].data();
          creators[creatorId] = {
            name: teacherData.fullName || teacherData.name || 'Unknown Teacher',
            role: 'teacher',
            email: teacherData.email || ''
          };
          continue;
        }

        // Fallback
        creators[creatorId] = {
          name: 'Unknown User',
          role: 'user',
          email: ''
        };
      } catch (error) {
        console.error(`Error fetching creator info for ${creatorId}:`, error);
        creators[creatorId] = {
          name: 'Unknown User',
          role: 'user',
          email: ''
        };
      }
    }
    
    setCreatorInfo(creators);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      
      // Validate each file
      const validFiles = [];
      const newPreviews = [];
      
      for (const file of newFiles) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large. File size must be less than 10MB`);
          continue;
        }
        
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image. Please select image files only`);
          continue;
        }
        
        validFiles.push(file);
        newPreviews.push(URL.createObjectURL(file));
      }
      
      if (validFiles.length > 0) {
        setFormData(prev => ({
          ...prev,
          files: [...prev.files, ...validFiles],
          filePreviews: [...prev.filePreviews, ...newPreviews]
        }));
      }
    }
  };

  const removeFile = (index) => {
    setFormData(prev => {
      // Revoke URL for preview
      URL.revokeObjectURL(prev.filePreviews[index]);
      
      return {
        ...prev,
        files: prev.files.filter((_, i) => i !== index),
        filePreviews: prev.filePreviews.filter((_, i) => i !== index)
      };
    });
  };

  const removeExistingImage = (index) => {
    setFormData(prev => ({
      ...prev,
      existingImages: prev.existingImages.filter((_, i) => i !== index)
    }));
  };

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'dkjuerp');
    
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/dglkp24ki/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      );
      
      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.secure_url) {
        throw new Error('No secure URL returned from Cloudinary');
      }
      
      return data.secure_url;
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw new Error('Failed to upload image. Please try again.');
    }
  };

  const uploadMultipleToCloudinary = async (files) => {
    const uploadPromises = files.map(file => uploadToCloudinary(file));
    return Promise.all(uploadPromises);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Please enter a title for the assignment');
      return;
    }

    if (!isEditMode && formData.files.length === 0) {
      toast.error('Please select at least one image to upload');
      return;
    }

    if (isEditMode && formData.files.length === 0 && formData.existingImages.length === 0) {
      toast.error('Please keep at least one image or upload new ones');
      return;
    }

    setUploading(true);
    setUploadProgress(20);

    try {
      let imageUrls = [...formData.existingImages];
      
      // Upload new files if any
      if (formData.files.length > 0) {
        setUploadProgress(40);
        const newImageUrls = await uploadMultipleToCloudinary(formData.files);
        imageUrls = [...imageUrls, ...newImageUrls];
      }
      
      setUploadProgress(70);

      const assignmentData = {
        title: formData.title.trim(),
        description: formData.description.trim() || '',
        targetType: 'students',
        classLevel: formData.classLevel,
        dueDate: formData.dueDate || null,
        imageUrls: imageUrls,
        // Keep backward compatibility
        imageUrl: imageUrls[0] || '',
        updatedAt: serverTimestamp(),
      };

      if (isEditMode) {
        await updateDoc(doc(db, 'assignments', editingAssignment.id), assignmentData);
        toast.success('Assignment updated successfully!');
      } else {
        assignmentData.createdAt = serverTimestamp();
        assignmentData.createdBy = user?.uid || '';
        assignmentData.madarsaId = userData?.madarsaId || 'madarsa-001';
        
        await addDoc(collection(db, 'assignments'), assignmentData);
        toast.success('Assignment created successfully!');
      }
      
      setUploadProgress(100);
      setIsDialogOpen(false);
      resetForm();
      fetchAssignments();
    } catch (error) {
      console.error('Error saving assignment:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save assignment');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    // Revoke all preview URLs
    formData.filePreviews.forEach(url => URL.revokeObjectURL(url));
    
    setFormData({
      title: '',
      description: '',
      targetType: 'students',
      classLevel: 'all',
      dueDate: '',
      files: [],
      existingImages: [],
      filePreviews: []
    });
    setIsEditMode(false);
    setEditingAssignment(null);
  };

  const handleEdit = (assignment) => {
    setIsEditMode(true);
    setEditingAssignment(assignment);
    
    // Convert single imageUrl to array for backward compatibility
    const existingImages = assignment.imageUrls || (assignment.imageUrl ? [assignment.imageUrl] : []);
    
    setFormData({
      title: assignment.title,
      description: assignment.description || '',
      targetType: assignment.targetType || 'students',
      classLevel: assignment.classLevel || 'all',
      dueDate: assignment.dueDate || '',
      files: [],
      existingImages: existingImages,
      filePreviews: []
    });
    setIsDialogOpen(true);
  };

  const handlePreview = (assignment) => {
    setPreviewAssignment(assignment);
    setIsPreviewOpen(true);
  };

  const generatePDF = async () => {
    if (!previewAssignment) return;
    
    setGeneratingPDF(true);
    try {
      const element = document.getElementById('assignment-preview');
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      // Add watermark on each page
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(50);
        pdf.setTextColor(200, 200, 200);
        pdf.setFont(undefined, 'bold');
        
        // Rotate and add watermark
        pdf.saveGraphicsState();
        pdf.setGState(new pdf.GState({opacity: 0.1}));
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        pdf.text('DKJU', pageWidth / 2, pageHeight / 2, {
          angle: 45,
          align: 'center'
        });
        
        pdf.restoreGraphicsState();
      }

      const fileName = `${previewAssignment.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_assignment.pdf`;
      pdf.save(fileName);
      
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleDelete = async (assignment) => {
    if (assignment.createdBy !== user?.uid) {
      toast.error('You can only delete assignments you created');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${assignment.title}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'assignments', assignment.id));
      toast.success('Assignment deleted successfully');
      fetchAssignments();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error('Failed to delete assignment');
    }
  };

  const filteredAssignments = assignments.filter(assignment =>
    assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (assignment.description && assignment.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getClassBadge = (classLevel) => {
    return (
      <Badge variant="outline" className="mr-2">
        {classLevel === 'all' ? 'All Classes' : `Class ${classLevel}`}
      </Badge>
    );
  };

  const handleCarouselNavigation = (assignmentId, direction) => {
    setImageCarouselStates(prev => {
      const currentIndex = prev[assignmentId] || 0;
      const assignment = assignments.find(a => a.id === assignmentId);
      const imageUrls = assignment?.imageUrls || (assignment?.imageUrl ? [assignment.imageUrl] : []);
      const maxIndex = imageUrls.length - 1;
      
      let newIndex;
      if (direction === 'next') {
        newIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
      } else {
        newIndex = currentIndex <= 0 ? maxIndex : currentIndex - 1;
      }
      
      return {
        ...prev,
        [assignmentId]: newIndex
      };
    });
  };

  const ImageCarousel = ({ assignment }) => {
    const imageUrls = assignment.imageUrls || (assignment.imageUrl ? [assignment.imageUrl] : []);
    const currentIndex = imageCarouselStates[assignment.id] || 0;
    
    if (imageUrls.length === 0) {
      return (
        <div className="relative h-48 w-full rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
          <span className="text-gray-400">No image available</span>
        </div>
      );
    }
    
    if (imageUrls.length === 1) {
      return (
        <div className="relative h-48 w-full rounded-md overflow-hidden bg-gray-100">
          <Image
            src={imageUrls[0]}
            alt={assignment.title}
            fill
            className="object-cover"
          />
        </div>
      );
    }
    
    return (
      <div className="relative h-48 w-full rounded-md overflow-hidden bg-gray-100 group">
        <Image
          src={imageUrls[currentIndex]}
          alt={`${assignment.title} - Image ${currentIndex + 1}`}
          fill
          className="object-cover transition-opacity duration-300"
        />
        
        {/* Navigation Buttons */}
        <button
          onClick={() => handleCarouselNavigation(assignment.id, 'prev')}
          className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-opacity-70"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => handleCarouselNavigation(assignment.id, 'next')}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-opacity-70"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        
        {/* Image Counter */}
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
          {currentIndex + 1} / {imageUrls.length}
        </div>
        
        {/* Dots Indicator */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
          {imageUrls.map((_, index) => (
            <button
              key={index}
              onClick={() => setImageCarouselStates(prev => ({
                ...prev,
                [assignment.id]: index
              }))}
              className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                index === currentIndex ? 'bg-white' : 'bg-white bg-opacity-50'
              }`}
            />
          ))}
        </div>
      </div>
    );
  };

  const PreviewDialog = () => {
    if (!previewAssignment) return null;
    
    const imageUrls = previewAssignment.imageUrls || (previewAssignment.imageUrl ? [previewAssignment.imageUrl] : []);
    const creator = creatorInfo[previewAssignment.createdBy] || { name: 'Unknown User', role: 'user' };
    
    return (
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Assignment Preview</span>
              <div className="flex gap-2">
                <Button
                  onClick={generatePDF}
                  disabled={generatingPDF}
                  className="bg-blue-600 hover:bg-blue-700 mt-4"
                  size="sm"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  {generatingPDF ? 'Generating...' : 'Download PDF'}
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div id="assignment-preview" className="bg-white p-8">
            {/* Header */}
            <div className="text-center mb-8 border-b pb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">DKJU Assignment</h1>
            </div>

            {/* Assignment Details */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{previewAssignment.title}</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-semibold text-gray-700">Class Level:</span>
                  <p className="text-gray-900">{previewAssignment.classLevel === 'all' ? 'All Classes' : `Class ${previewAssignment.classLevel}`}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Created By:</span>
                  <p className="text-gray-900">{userData.fullName} ({userData.role === 'teacher' ? 'Teacher' : 'Admin'})</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Posted Date:</span>
                  <p className="text-gray-900">
                    {previewAssignment.createdAt?.toDate ? 
                      previewAssignment.createdAt.toDate().toLocaleDateString() : 
                      new Date(previewAssignment.createdAt).toLocaleDateString()
                    }
                  </p>
                </div>
                {previewAssignment.dueDate && (
                  <div>
                    <span className="font-semibold text-gray-700">Due Date:</span>
                    <p className="text-gray-900">{new Date(previewAssignment.dueDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {previewAssignment.description && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-700 mb-2">Description:</h3>
                  <p className="text-gray-900 leading-relaxed">{previewAssignment.description}</p>
                </div>
              )}
            </div>

            {/* Images Section */}
     {imageUrls.length > 0 && (
  <div className="mb-6">
    <h3 className="font-semibold text-gray-700 mb-4">Assignment Content:</h3>
    <div className="flex flex-col gap-4">
      {imageUrls.map((imageUrl, index) => (
        <div key={index} className="border rounded-lg overflow-hidden bg-gray-50 p-4">
          <div className="relative w-full">
            <Image
              src={imageUrl}
              alt={`Assignment image ${index + 1}`}
              width={800} // or auto-calculated
              height={600} // maintain aspect ratio
              className="w-full h-auto object-contain rounded"
            />
          </div>
          <div className="pt-2 text-center text-sm text-gray-600">
            Image {index + 1} of {imageUrls.length}
          </div>
        </div>
      ))}
    </div>
  </div>
)}


            {/* Footer */}
            <div className="mt-8 pt-6 border-t text-center text-gray-500">
              <p className="text-sm">Generated on {new Date().toLocaleDateString()} • DKJU Assignment System</p>
              <p className="text-xs mt-1">© Made by Vaibhav - All Rights Reserved</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
      <Layout user={user} role={userData?.role || user?.role}>
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Student Assignments</h1>
              <p className="text-gray-600 mt-2 text-sm md:text-base">Create and manage assignments for your students</p>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  New Assignment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white mx-4 md:mx-auto w-[calc(100vw-2rem)] md:w-full">
                <DialogHeader className="p-4 md:p-6 pb-2 md:pb-4">
                  <DialogTitle className="text-lg md:text-xl">
                    {isEditMode ? 'Edit Assignment' : 'Create New Assignment'}
                  </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4 p-4 md:p-6">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="classLevel">Class *</Label>
                      <Select
                        value={formData.classLevel}
                        onValueChange={(value) => setFormData({...formData, classLevel: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select class"  />
                        </SelectTrigger>
                        <SelectContent className='bg-white'>
                          {classOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="dueDate">Due Date</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="file">Assignment Images {isEditMode ? '' : '*'}</Label>
                    
                    {/* Existing Images (Edit Mode) */}
                    {isEditMode && formData.existingImages.length > 0 && (
                      <div className="mt-2 mb-4">
                        <Label className="text-sm text-gray-600">Current Images:</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                          {formData.existingImages.map((imageUrl, index) => (
                            <div key={index} className="relative group">
                              <div className="relative h-32 w-full rounded-md overflow-hidden bg-gray-100">
                                <Image
                                  src={imageUrl}
                                  alt={`Existing image ${index + 1}`}
                                  fill
                                  className="object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeExistingImage(index)}
                                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New Images Preview */}
                    {formData.filePreviews.length > 0 && (
                      <div className="mt-2 mb-4">
                        <Label className="text-sm text-gray-600">New Images to Upload:</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                          {formData.filePreviews.map((preview, index) => (
                            <div key={index} className="relative group">
                              <div className="relative h-32 w-full rounded-md overflow-hidden bg-gray-100">
                                <Image
                                  src={preview}
                                  alt={`Preview ${index + 1}`}
                                  fill
                                  className="object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeFile(index)}
                                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Upload Area */}
                    <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-300 px-4 py-6 md:px-6 md:py-10">
                      <div className="flex flex-col items-center justify-center gap-y-3 md:gap-y-4">
                        <Upload className="h-8 w-8 md:h-12 md:w-12 text-gray-400" />
                        <label className="cursor-pointer">
                          <span className="text-teal-600 hover:text-teal-500 font-medium text-sm md:text-base">
                            Upload {formData.filePreviews.length > 0 || formData.existingImages.length > 0 ? 'more images' : 'images'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="sr-only"
                            onChange={handleFileChange}
                          />
                        </label>
                        <p className="text-xs text-gray-500 text-center">PNG, JPG, GIF up to 10MB each • Multiple images allowed</p>
                      </div>
                    </div>
                  </div>
                  
                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  )}
                  
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button type="submit" disabled={uploading} className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto">
                      {uploading ? 'Saving...' : (isEditMode ? 'Update Assignment' : 'Create Assignment')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={uploading} className="w-full sm:w-auto">
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search assignments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Badge variant="secondary" className="self-start md:self-auto text-xs md:text-sm">
                  {filteredAssignments.length} assignments
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Assignments List */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-600"></div>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 md:py-12 px-4">
                <BookOpen className="h-10 w-10 md:h-12 md:w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-base md:text-lg font-medium text-gray-900">No assignments found</h3>
                <p className="text-gray-600 text-sm md:text-base">
                  {searchTerm ? 'Try adjusting your search term' : 'Create your first assignment'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredAssignments.map((assignment) => (
                <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
                      <div className="w-full lg:w-1/3">
                        <ImageCarousel assignment={assignment} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-3 sm:space-y-0">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base md:text-lg font-semibold break-words">{assignment.title}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {getClassBadge(assignment.classLevel)}
                              <Badge variant="secondary" className="text-xs">
                                {assignment.targetType === 'both' ? 'Students & Teachers' : 'Students Only'}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handlePreview(assignment)}
                              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 text-xs sm:text-sm"
                            >
                              <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                              <span className="hidden sm:inline">Preview</span>
                              <span className="sm:hidden">View</span>
                            </Button>
                            <Button variant="outline" size="sm" asChild className="text-xs sm:text-sm">
                              <a 
                                href={assignment.imageUrl || assignment.imageUrls?.[0]} 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">Download</span>
                                <span className="sm:hidden">Get</span>
                              </a>
                            </Button>
                            {assignment.createdBy === user?.uid && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(assignment)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs sm:text-sm"
                                >
                                  <Edit3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                  <span className="hidden sm:inline">Edit</span>
                                  <span className="sm:hidden">Edit</span>
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleDelete(assignment)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs sm:text-sm"
                                >
                                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                  <span className="hidden sm:inline">Delete</span>
                                  <span className="sm:hidden">Del</span>
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {assignment.description && (
                          <p className="mt-3 text-gray-600 text-sm md:text-base break-words">{assignment.description}</p>
                        )}
                        
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 text-xs md:text-sm">
                          <div className="flex items-center space-x-1 md:space-x-2">
                            <Calendar className="w-3 h-3 md:w-4 md:h-4 text-gray-400 flex-shrink-0" />
                            <span>
                              Posted: {assignment.createdAt?.toDate ? 
                                assignment.createdAt.toDate().toLocaleDateString() : 
                                new Date(assignment.createdAt).toLocaleDateString()
                              }
                            </span>
                          </div>
                          
                          {assignment.dueDate && (
                            <div className="flex items-center space-x-1 md:space-x-2">
                              <Calendar className="w-3 h-3 md:w-4 md:h-4 text-gray-400 flex-shrink-0" />
                              <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
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
        
        {/* Preview Dialog */}
        <PreviewDialog />
      </Layout>
  );
}