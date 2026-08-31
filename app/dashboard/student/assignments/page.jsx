'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, BookOpen, Clock, AlertCircle, Download, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import useAuthStore from '@/lib/authStore';
import Layout from '@/components/Layout';
import { format, isAfter } from 'date-fns';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function StudentAssignmentsPage() {
  const { user, userData } = useAuthStore();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [imageCarouselStates, setImageCarouselStates] = useState({});

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        setLoading(true);
        setError('');

        if (!user?.email) {
          setError('User not logged in');
          setLoading(false);
          return;
        }

        // First try to use userData if available
        let studentData = userData;
        
        // If userData doesn't have all required fields, fetch from students collection
        if (!studentData || !studentData.madarsaId) {
          const q = query(
            collection(db, "students"),
            where("email", "==", user.email)
          );
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
            setError("Student not found");
            return;
          }

          const studentDoc = querySnapshot.docs[0];
          studentData = studentDoc.data();
        }

        // console.log('Student data:', studentData);

        if (!studentData.madarsaId) {
          setError('Student information not complete - missing madarsa ID');
          return;
        }

        // Get class level from various possible field names
        const classLevel = studentData.classLevel || studentData.class || studentData.grade;

        const assignmentsQuery = query(
          collection(db, 'assignments'),
          where('madarsaId', '==', studentData.madarsaId),
          where('targetType', '==', 'students'),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(assignmentsQuery);
        const assignmentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        
        // console.log(studentData)

        const filteredAssignments = assignmentsData.filter(assignment => {
          // If assignment doesn't specify classLevel, it's for all classes
          if (!assignment.classLevel) return true;
          
          // If assignment is for "All" classes
          if (assignment.classLevel === "All" || assignment.classLevel === "all") return true;
          
          // If student has no class level, show all assignments
          if (!classLevel) return true;

          if(studentData.classLevel && assignment.classLevel === studentData.classLevel) return true;
          
          // Check if assignment is for student's specific class
          if (Array.isArray(assignment.classLevel)) {
            return assignment.classLevel.includes(classLevel) || assignment.classLevel.includes("All");
          }
          
          return assignment.classLevel === classLevel;
        });
        
        setAssignments(filteredAssignments);
      } catch (err) {
        console.error('Error fetching assignments:', err);
        setError('Failed to load assignments. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (user?.email) {
      fetchAssignments();
    }
  }, [user, userData]);

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return isAfter(new Date(), new Date(dueDate));
  };

  const getStatusBadge = (dueDate) => {
    if (!dueDate) {
      return <Badge variant="outline">No Due Date</Badge>;
    }
    if (isOverdue(dueDate)) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const upcomingAssignments = assignments.filter(a => a.dueDate && !isOverdue(a.dueDate));
  const pastAssignments = assignments.filter(a => a.dueDate && isOverdue(a.dueDate));
  const noDueDateAssignments = assignments.filter(a => !a.dueDate);

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

  const handleViewDetails = (assignment) => {
    setSelectedAssignment(assignment);
    setIsDialogOpen(true);
  };

  const handleDownload = (imageUrl, title) => {
    if (imageUrl) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `${title}.jpg`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const ImageCarousel = ({ assignment }) => {
    const imageUrls = assignment.imageUrls || (assignment.imageUrl ? [assignment.imageUrl] : []);
    const currentIndex = imageCarouselStates[assignment.id] || 0;
    
    if (imageUrls.length === 0) {
      return (
        <div className="relative h-32 md:h-40 w-full rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
          <span className="text-gray-400 text-sm">No image available</span>
        </div>
      );
    }
    
    if (imageUrls.length === 1) {
      return (
        <div className="relative h-32 md:h-40 w-full rounded-md overflow-hidden">
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
      <div className="relative h-32 md:h-40 w-full rounded-md overflow-hidden bg-gray-100 group">
        <Image
          src={imageUrls[currentIndex]}
          alt={`${assignment.title} - Image ${currentIndex + 1}`}
          fill
          className="object-cover transition-opacity duration-300"
        />
        
        {/* Navigation Buttons */}
        <button
          onClick={() => handleCarouselNavigation(assignment.id, 'prev')}
          className="absolute left-1 md:left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-1.5 md:p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-opacity-70"
        >
          <ChevronLeft className="w-3 h-3 md:w-4 md:h-4" />
        </button>
        
        <button
          onClick={() => handleCarouselNavigation(assignment.id, 'next')}
          className="absolute right-1 md:right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-1.5 md:p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-opacity-70"
        >
          <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
        </button>
        
        {/* Image Counter */}
        <div className="absolute bottom-1 md:bottom-2 right-1 md:right-2 bg-black bg-opacity-50 text-white px-1.5 md:px-2 py-0.5 md:py-1 rounded text-xs">
          {currentIndex + 1} / {imageUrls.length}
        </div>
        
        {/* Dots Indicator */}
        <div className="absolute bottom-1 md:bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
          {imageUrls.map((_, index) => (
            <button
              key={index}
              onClick={() => setImageCarouselStates(prev => ({
                ...prev,
                [assignment.id]: index
              }))}
              className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-colors duration-200 ${
                index === currentIndex ? 'bg-white' : 'bg-white bg-opacity-50'
              }`}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <Layout user={user}>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Assignments</h1>
            <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">
              Work assigned{userData?.classLevel || userData?.class ? ` for Class ${userData.classLevel || userData.class}` : ''}
            </p>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center space-x-3">
                <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-blue-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-gray-600">Upcoming Assignments</p>
                  <p className="text-lg md:text-xl font-bold">{upcomingAssignments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-gray-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-gray-600">Past Assignments</p>
                  <p className="text-lg md:text-xl font-bold">{pastAssignments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="sm:col-span-2 lg:col-span-1">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center space-x-3">
                <Clock className="w-6 h-6 md:w-8 md:h-8 text-green-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm text-gray-600">No Due Date</p>
                  <p className="text-lg md:text-xl font-bold">{noDueDateAssignments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 md:px-4 py-3 rounded text-sm md:text-base">
            {error}
          </div>
        )}

        {/* Upcoming Assignments */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center space-x-2 text-lg md:text-xl">
              <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
              <span>Current Assignments ({upcomingAssignments.length + noDueDateAssignments.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            {loading ? (
              <div className="text-center py-6 md:py-8">
                <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
                <p className="text-gray-600 mt-4 text-sm md:text-base">Loading assignments...</p>
              </div>
            ) : (upcomingAssignments.length + noDueDateAssignments.length) === 0 ? (
              <div className="text-center py-6 md:py-8">
                <BookOpen className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-sm md:text-base">No current assignments</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                {[...upcomingAssignments, ...noDueDateAssignments].map((assignment) => (
                  <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3 md:p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                        <h3 className="text-base md:text-lg font-semibold break-words pr-2">{assignment.title}</h3>
                        {getStatusBadge(assignment.dueDate)}
                      </div>
                      
                      <p className="text-gray-600 text-sm md:text-base line-clamp-3 break-words">{assignment.description}</p>
                      
                      {(assignment.imageUrl || (assignment.imageUrls && assignment.imageUrls.length > 0)) && (
                        <ImageCarousel assignment={assignment} />
                      )}
                      
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs md:text-sm text-gray-500">
                        {assignment.dueDate && (
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                            <span>Due: {format(new Date(assignment.dueDate), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                          <span>Posted: {assignment.createdAt?.toDate ? 
                            format(assignment.createdAt.toDate(), 'MMM d, yyyy') : 
                            format(new Date(assignment.createdAt), 'MMM d, yyyy')
                          }</span>
                        </div>
                      </div>
                      
                      <Button 
                        variant="outline" 
                        className="w-full mt-2 text-sm"
                        onClick={() => handleViewDetails(assignment)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past Assignments */}
        {pastAssignments.length > 0 && (
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center space-x-2 text-lg md:text-xl">
                <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
                <span>Past Assignments ({pastAssignments.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                {pastAssignments.map((assignment) => (
                  <Card key={assignment.id} className="opacity-75 hover:opacity-100 transition-opacity">
                    <CardContent className="p-3 md:p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                        <h3 className="text-base md:text-lg font-semibold break-words pr-2">{assignment.title}</h3>
                        {getStatusBadge(assignment.dueDate)}
                      </div>
                      
                      <p className="text-gray-600 text-sm md:text-base line-clamp-3 break-words">{assignment.description}</p>
                      
                      {(assignment.imageUrl || (assignment.imageUrls && assignment.imageUrls.length > 0)) && (
                        <ImageCarousel assignment={assignment} />
                      )}
                      
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs md:text-sm text-gray-500">
                        {assignment.dueDate && (
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                            <span>Was due: {format(new Date(assignment.dueDate), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                      </div>
                      
                      <Button 
                        variant="outline" 
                        className="w-full mt-2 text-sm"
                        onClick={() => handleViewDetails(assignment)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Assignment Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white mx-4 w-[calc(100vw-2rem)] md:w-full">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl font-bold break-words pr-8">
              {selectedAssignment?.title}
            </DialogTitle>
          </DialogHeader>
          
          {selectedAssignment && (
            <div className="space-y-4 md:space-y-6">
              {/* Status and Due Date */}
              <div className="flex flex-wrap gap-2 md:gap-3">
                {getStatusBadge(selectedAssignment.dueDate)}
                {selectedAssignment.dueDate && (
                  <Badge variant="outline" className="flex items-center gap-1 text-xs">
                    <Calendar className="w-3 h-3" />
                    Due: {format(new Date(selectedAssignment.dueDate), 'MMM d, yyyy')}
                  </Badge>
                )}
                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                  <Clock className="w-3 h-3" />
                  Posted: {selectedAssignment.createdAt?.toDate ? 
                    format(selectedAssignment.createdAt.toDate(), 'MMM d, yyyy') : 
                    format(new Date(selectedAssignment.createdAt), 'MMM d, yyyy')
                  }
                </Badge>
              </div>

              {/* Description */}
              {selectedAssignment.description && (
                <div>
                  <h3 className="text-base md:text-lg font-semibold mb-2">Description</h3>
                  <p className="text-gray-600 whitespace-pre-line text-sm md:text-base break-words">
                    {selectedAssignment.description}
                  </p>
                </div>
              )}

              {/* Assignment Images */}
              {(selectedAssignment.imageUrl || (selectedAssignment.imageUrls && selectedAssignment.imageUrls.length > 0)) && (
                <div>
                  <h3 className="text-base md:text-lg font-semibold mb-2">Assignment Content</h3>
                  <div className="space-y-4">
                    {(() => {
                      const imageUrls = selectedAssignment.imageUrls || (selectedAssignment.imageUrl ? [selectedAssignment.imageUrl] : []);
                      const currentIndex = imageCarouselStates[selectedAssignment.id] || 0;
                      
                      if (imageUrls.length === 1) {
                        return (
                          <div className="relative w-full max-w-3xl mx-auto">
                            <Image
                              src={imageUrls[0]}
                              alt={selectedAssignment.title}
                              width={800}
                              height={600}
                              className="w-full h-auto rounded-lg border"
                              style={{ objectFit: 'contain' }}
                            />
                          </div>
                        );
                      }
                      
                      return (
                        <div className="relative w-full max-w-3xl mx-auto group">
                          <Image
                            src={imageUrls[currentIndex]}
                            alt={`${selectedAssignment.title} - Image ${currentIndex + 1}`}
                            width={800}
                            height={600}
                            className="w-full h-auto rounded-lg border transition-opacity duration-300"
                            style={{ objectFit: 'contain' }}
                          />
                          
                          {/* Navigation Buttons */}
                          <button
                            onClick={() => handleCarouselNavigation(selectedAssignment.id, 'prev')}
                            className="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 md:p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-opacity-70"
                          >
                            <ChevronLeft className="w-4 h-4 md:w-6 md:h-6" />
                          </button>
                          
                          <button
                            onClick={() => handleCarouselNavigation(selectedAssignment.id, 'next')}
                            className="absolute right-2 md:right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 md:p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-opacity-70"
                          >
                            <ChevronRight className="w-4 h-4 md:w-6 md:h-6" />
                          </button>
                          
                          {/* Image Counter */}
                          <div className="absolute top-2 md:top-4 right-2 md:right-4 bg-black bg-opacity-50 text-white px-2 md:px-3 py-1 rounded text-xs md:text-sm">
                            {currentIndex + 1} / {imageUrls.length}
                          </div>
                          
                          {/* Dots Indicator */}
                          <div className="absolute bottom-2 md:bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-1 md:space-x-2">
                            {imageUrls.map((_, index) => (
                              <button
                                key={index}
                                onClick={() => setImageCarouselStates(prev => ({
                                  ...prev,
                                  [selectedAssignment.id]: index
                                }))}
                                className={`w-2 h-2 md:w-3 md:h-3 rounded-full transition-colors duration-200 ${
                                  index === currentIndex ? 'bg-white' : 'bg-white bg-opacity-50'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    
                    <div className="flex justify-center">
                      <Button 
                        onClick={() => {
                          const imageUrls = selectedAssignment.imageUrls || (selectedAssignment.imageUrl ? [selectedAssignment.imageUrl] : []);
                          const currentIndex = imageCarouselStates[selectedAssignment.id] || 0;
                          const currentImageUrl = imageUrls[currentIndex];
                          handleDownload(currentImageUrl, `${selectedAssignment.title}-${currentIndex + 1}`);
                        }}
                        className="bg-teal-600 hover:bg-teal-700 text-sm w-full sm:w-auto"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Current Image
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 pt-4 border-t">
                <div>
                  <h4 className="font-medium text-gray-700 text-sm md:text-base">Target Audience</h4>
                  <p className="text-gray-600 capitalize text-sm md:text-base">{selectedAssignment.targetType}</p>
                </div>
                
                {selectedAssignment.classLevel && (
                  <div>
                    <h4 className="font-medium text-gray-700 text-sm md:text-base">Class Level</h4>
                    <p className="text-gray-600 text-sm md:text-base break-words">{selectedAssignment.classLevel}</p>
                  </div>
                )}
                
                {selectedAssignment.createdByName && (
                  <div>
                    <h4 className="font-medium text-gray-700 text-sm md:text-base">Created By</h4>
                    <p className="text-gray-600 text-sm md:text-base break-words">{selectedAssignment.createdByName}</p>
                  </div>
                )}
                
                <div>
                  <h4 className="font-medium text-gray-700 text-sm md:text-base">Status</h4>
                  <p className="text-gray-600 text-sm md:text-base">
                    {selectedAssignment.dueDate ? 
                      (isOverdue(selectedAssignment.dueDate) ? 'Overdue' : 'Active') : 
                      'No Due Date'
                    }
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                {(selectedAssignment.imageUrl || (selectedAssignment.imageUrls && selectedAssignment.imageUrls.length > 0)) && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      const imageUrls = selectedAssignment.imageUrls || (selectedAssignment.imageUrl ? [selectedAssignment.imageUrl] : []);
                      const currentIndex = imageCarouselStates[selectedAssignment.id] || 0;
                      const currentImageUrl = imageUrls[currentIndex];
                      handleDownload(currentImageUrl, `${selectedAssignment.title}-${currentIndex + 1}`);
                    }}
                    className="text-sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Current
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="text-sm"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}