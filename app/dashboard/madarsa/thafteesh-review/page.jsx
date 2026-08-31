"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  ImageIcon,
  Save,
  Send,
  Eye,
  Edit,
  Calendar,
  AlertCircle,
  Check,
  Clock,
  X,
  Trash2,
} from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";

export default function ThafteeshReviewPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("create");

  // Form state
  const [formData, setFormData] = useState({
    reviewTitle: "",
    remarks: "",
    files: [],
    status: "draft",
  });

  // Reviews list
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const fetchReviews = useCallback(async () => {
    if (!user?.uid) return;

    setLoadingReviews(true);
    try {
      const reviewsRef = collection(db, "sadarReviews");
      const q = query(
        reviewsRef,
        where("madarsaId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const reviewsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setReviews(reviewsData);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      toast({
        title: "Error",
        description: "Failed to fetch reviews",
        variant: "destructive",
      });
    } finally {
      setLoadingReviews(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push("/auth/login/madarsa-admin");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (user?.uid) {
      fetchReviews();
    }
  }, [user?.uid, fetchReviews]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const uploadedFile = await uploadToCloudinary(file, "sadar-reviews");
        return {
          name: file.name,
          url: uploadedFile.secure_url,
          publicId: uploadedFile.public_id,
          type: file.type.startsWith("image/") ? "image" : "pdf",
          size: file.size,
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      setFormData((prev) => ({
        ...prev,
        files: [...prev.files, ...uploadedFiles],
      }));

      toast({
        title: "Success",
        description: `${uploadedFiles.length} file(s) uploaded successfully`,
      });
    } catch (error) {
      console.error("Error uploading files:", error);
      toast({
        title: "Error",
        description: "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index) => {
    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  const saveDraft = async () => {
    if (!formData.reviewTitle.trim()) {
      toast({
        title: "Error",
        description: "Review title is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const reviewData = {
        ...formData,
        madarsaId: user.uid,
        madarsaName: user.displayName || "Unknown Madrasa",
        status: "draft",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "sadarReviews"), reviewData);

      toast({
        title: "Success",
        description: "Draft saved successfully",
      });

      // Reset form
      setFormData({
        reviewTitle: "",
        remarks: "",
        files: [],
        status: "draft",
      });

      // Refresh reviews list
      fetchReviews();
      setActiveTab("list");
    } catch (error) {
      console.error("Error saving draft:", error);
      toast({
        title: "Error",
        description: "Failed to save draft",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitReview = async () => {
    if (!formData.reviewTitle.trim()) {
      toast({
        title: "Error",
        description: "Review title is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.remarks.trim()) {
      toast({
        title: "Error",
        description: "Remarks are required for submission",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const reviewData = {
        ...formData,
        madarsaId: user.uid,
        madarsaName: user.displayName || "Unknown Madrasa",
        status: "submitted",
        submittedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "sadarReviews"), reviewData);

      toast({
        title: "Success",
        description: "Review submitted successfully",
      });

      // Reset form
      setFormData({
        reviewTitle: "",
        remarks: "",
        files: [],
        status: "draft",
      });

      // Refresh reviews list
      fetchReviews();
      setActiveTab("list");
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        title: "Error",
        description: "Failed to submit review",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const editReview = (review) => {
    setFormData({
      reviewTitle: review.reviewTitle,
      remarks: review.remarks,
      files: review.files || [],
      status: review.status,
      editingId: review.id,
    });
    setActiveTab("create");
  };

  const updateReview = async (shouldSubmit = false) => {
    if (!formData.editingId) return;

    if (!formData.reviewTitle.trim() || !formData.remarks.trim()) {
      toast({
        title: "Error",
        description: "Review title and remarks are required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const reviewRef = doc(db, "sadarReviews", formData.editingId);
      
      // Get the current review to check its status
      const currentReview = reviews.find(r => r.id === formData.editingId);
      
      // Determine new status based on action
      let newStatus;
      if (shouldSubmit) {
        newStatus = "submitted";
      } else {
        // If editing a submitted review, change status back to draft
        newStatus = currentReview?.status === "submitted" ? "draft" : formData.status;
      }
      
      await updateDoc(reviewRef, {
        reviewTitle: formData.reviewTitle,
        remarks: formData.remarks,
        files: formData.files,
        status: newStatus,
        updatedAt: serverTimestamp(),
        ...(shouldSubmit && { submittedAt: serverTimestamp() }),
      });

      toast({
        title: "Success",
        description: shouldSubmit 
          ? "Review updated and submitted successfully" 
          : currentReview?.status === "submitted" 
            ? "Review updated and moved back to draft status" 
            : "Review updated successfully",
      });

      // Reset form
      setFormData({
        reviewTitle: "",
        remarks: "",
        files: [],
        status: "draft",
      });

      // Refresh reviews list
      fetchReviews();
      setActiveTab("list");
    } catch (error) {
      console.error("Error updating review:", error);
      toast({
        title: "Error",
        description: "Failed to update review",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteReview = async (reviewId) => {
    try {
      await deleteDoc(doc(db, "sadarReviews", reviewId));
      
      toast({
        title: "Success",
        description: "Review deleted successfully",
      });

      // Refresh reviews list
      fetchReviews();
    } catch (error) {
      console.error("Error deleting review:", error);
      toast({
        title: "Error",
        description: "Failed to delete review",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "draft":
        return <Edit className="h-4 w-4" />;
      case "submitted":
        return <Clock className="h-4 w-4" />;
      case "approved":
        return <Check className="h-4 w-4" />;
      case "rejected":
        return <X className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "draft":
        return "secondary";
      case "submitted":
        return "default";
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 p-3 sm:p-4 md:p-6 lg:p-0">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-4 sm:p-5 md:p-6 text-white">
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-2 leading-tight">
            Thafteesh Review/Report
          </h1>
          <p className="text-sm md:text-base text-purple-100 leading-relaxed">
            Create and manage Sadar reviews and reports
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4 md:space-y-6"
        >
          <TabsList className="grid w-full grid-cols-2 h-auto bg-gray-100 p-1 rounded-lg ">
            <TabsTrigger
              value="create"
              className="flex items-center justify-center gap-2 py-3 px-4 text-sm md:text-base font-medium rounded-md transition-all duration-200 hover:bg-white  data-[state=active]:bg-white  data-[state=active]:text-blue-600 data-[state=active]:border data-[state=active]:border-blue-200 cursor-pointer"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">
                {formData.editingId ? "Edit Review" : "Create Review"}
              </span>
              <span className="sm:hidden">
                {formData.editingId ? "Edit" : "Create"}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="list"
              className="flex items-center justify-center gap-2 py-3 px-4 text-sm md:text-base font-medium rounded-md transition-all duration-200 hover:bg-white  data-[state=active]:bg-white data- data-[state=active]:text-blue-600 data-[state=active]:border data-[state=active]:border-blue-200 cursor-pointer"
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">My Reviews</span>
              <span className="sm:hidden">Reviews</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 md:space-y-6">
            <Card className=" transition-shadow">
              <CardHeader className="p-4 sm:p-5 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl font-semibold">
                  <FileText className="h-5 w-5" />
                  {formData.editingId
                    ? "Edit Sadar Review"
                    : "Create New Sadar Review"}
                </CardTitle>
                {formData.editingId && (
                  <div className="mt-3">
                    {(() => {
                      const currentReview = reviews.find(r => r.id === formData.editingId);
                      if (currentReview?.status === "submitted") {
                        return (
                          <Alert className="border-orange-200 bg-orange-50">
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                            <AlertDescription className="text-orange-800">
                              <strong>Note:</strong> This review was previously submitted for approval. 
                              Making changes will move it back to draft status and require resubmission.
                            </AlertDescription>
                          </Alert>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4 md:space-y-6 p-4 sm:p-5 md:p-6 pt-0">
                {/* Review Title */}
                <div className="space-y-2">
                  <Label htmlFor="reviewTitle">Review Title *</Label>
                  <input
                    id="reviewTitle"
                    type="text"
                    placeholder="Enter review title..."
                    value={formData.reviewTitle}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        reviewTitle: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* File Upload */}
                <div className="space-y-3 md:space-y-4">
                  <Label className="text-sm md:text-base font-medium">
                    Upload Documents (Images or PDFs)
                  </Label>
                  
                  {/* Main Upload Area */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 hover:border-gray-400 transition-colors">
                    <div className="text-center">
                      <Upload className="mx-auto h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-gray-400" />
                      <div className="mt-3 md:mt-4">
                        <label htmlFor="file-upload" className="cursor-pointer">
                          <span className="mt-2 block text-sm md:text-base font-medium text-gray-900">
                            Click to upload or drag and drop multiple files
                          </span>
                          <span className="mt-1 block text-xs md:text-sm text-gray-500">
                            PNG, JPG, PDF up to 10MB each. Select multiple files at once.
                          </span>
                        </label>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          multiple
                          accept="image/*,.pdf"
                          onChange={handleFileUpload}
                          disabled={uploading}
                        />
                      </div>
                      
                      {/* Add More Files Button */}
                      {formData.files.length > 0 && (
                        <div className="mt-4">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('file-upload').click()}
                            disabled={uploading}
                            className="flex items-center gap-2"
                          >
                            <Upload className="h-4 w-4" />
                            Add More Files
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {uploading && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Uploading files... Please wait.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Uploaded Files */}
                  {formData.files.length > 0 && (
                    <div className="space-y-2 md:space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm md:text-base font-medium">
                          Uploaded Files ({formData.files.length})
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData(prev => ({ ...prev, files: [] }))}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Clear All
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {formData.files.map((file, index) => (
                          <div
                            key={index}
                            className="border rounded-lg p-3 hover:shadow-sm transition-shadow bg-gray-50"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {file.type === "image" ? (
                                  <ImageIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                ) : (
                                  <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                                )}
                                <span className="text-xs md:text-sm font-medium truncate">
                                  {file.name}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(index)}
                                className="text-red-500 hover:text-red-700 flex-shrink-0 h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            {/* File Details */}
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span className="capitalize">
                                {file.type === "image" ? "Image" : "PDF"}
                              </span>
                              <span>
                                {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                              </span>
                            </div>
                            
                            {/* Preview/View Button */}
                            <div className="mt-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(file.url, '_blank')}
                                className="w-full h-auto py-1 text-xs"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Preview
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Upload Summary */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                          <FileText className="h-4 w-4" />
                          <span className="font-medium">
                            {formData.files.length} file(s) ready for submission
                          </span>
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          Total size: {formData.files.reduce((total, file) => total + (file.size || 0), 0) > 0 
                            ? `${(formData.files.reduce((total, file) => total + (file.size || 0), 0) / 1024 / 1024).toFixed(2)} MB`
                            : 'Unknown'
                          }
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Remarks */}
                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks *</Label>
                  <Textarea
                    id="remarks"
                    placeholder="Enter your remarks and observations..."
                    value={formData.remarks}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        remarks: e.target.value,
                      }))
                    }
                    rows={6}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t">
                  {formData.editingId ? (
                    <>
                      <Button
                        onClick={() => updateReview(false)}
                        disabled={submitting}
                        className="flex items-center justify-center gap-2 h-auto py-3 text-sm md:text-base font-medium"
                      >
                        <Save className="h-4 w-4" />
                        {submitting ? "Updating..." : "Update Review"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => updateReview(true)}
                        disabled={submitting || uploading}
                        className="flex items-center justify-center gap-2 h-auto py-3 text-sm md:text-base font-medium"
                      >
                        <Send className="h-4 w-4" />
                        {submitting ? "Submitting..." : "Update & Submit"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={saveDraft}
                        disabled={submitting || uploading}
                        className="flex items-center justify-center gap-2 h-auto py-3 text-sm md:text-base font-medium"
                      >
                        <Save className="h-4 w-4" />
                        {submitting ? "Saving..." : "Save as Draft"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={submitReview}
                        disabled={submitting || uploading}
                        className="flex items-center justify-center gap-2 h-auto py-3 text-sm md:text-base font-medium"
                      >
                        <Send className="h-4 w-4" />
                        {submitting ? "Submitting..." : "Submit Review"}
                      </Button>
                    </>
                  )}
                  {formData.editingId && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFormData({
                          reviewTitle: "",
                          remarks: "",
                          files: [],
                          status: "draft",
                        });
                        setActiveTab("list");
                      }}
                      className="h-auto py-3 text-sm md:text-base font-medium"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list" className="space-y-4 md:space-y-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="p-4 sm:p-5 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl font-semibold">
                  <Eye className="h-5 w-5" />
                  My Reviews ({reviews.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
                {loadingReviews ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading reviews...</p>
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="text-center py-8 sm:py-10 md:py-12">
                    <FileText className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-300" />
                    <p className="mt-3 sm:mt-4 text-gray-500 text-sm md:text-base font-medium">
                      No reviews created yet
                    </p>
                    <p className="text-gray-400 text-xs md:text-sm mt-1">
                      Create your first review to get started
                    </p>
                    <Button
                      onClick={() => setActiveTab("create")}
                      className="mt-4 h-auto py-3 px-6 text-sm md:text-base font-medium"
                    >
                      Create First Review
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 md:space-y-4">
                    {reviews.map((review) => (
                      <div
                        key={review.id}
                        className="border rounded-lg p-3 sm:p-4 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                              <h3 className="font-semibold text-base sm:text-lg truncate">
                                {review.reviewTitle}
                              </h3>
                              <Badge
                                variant={getStatusColor(review.status)}
                                className="flex items-center gap-1 w-fit"
                              >
                                {getStatusIcon(review.status)}
                                <span className="text-xs font-medium">
                                  {review.status.charAt(0).toUpperCase() +
                                    review.status.slice(1)}
                                </span>
                              </Badge>
                            </div>

                            <p className="text-gray-600 mb-3 text-sm md:text-base line-clamp-2 leading-relaxed">
                              {review.remarks}
                            </p>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs md:text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">
                                  {review.createdAt
                                    ?.toDate?.()
                                    ?.toLocaleDateString() || "Unknown date"}
                                </span>
                              </span>
                              {review.files?.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-4 w-4 flex-shrink-0" />
                                  {review.files.length} file(s)
                                </span>
                              )}
                            </div>

                            {/* Display all uploaded files */}
                            {review.files?.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">
                                  Uploaded Files:
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {review.files.map((file, index) => (
                                    <div
                                      key={index}
                                      className="border border-gray-200 rounded-lg p-2 hover:shadow-sm transition-shadow"
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-gray-600 truncate">
                                          {file.name || `File ${index + 1}`}
                                        </span>
                                        <span className="text-xs text-gray-500 capitalize">
                                          {file.type === "image" ? "IMG" : "PDF"}
                                        </span>
                                      </div>
                                      
                                      {file.type === "image" ? (
                                        <div className="mb-2">
                                          <Image
                                            src={file.url}
                                            alt={file.name || `Image ${index + 1}`}
                                            width={200}
                                            height={64}
                                            className="w-full h-16 object-cover rounded border"
                                          />
                                        </div>
                                      ) : (
                                        <div className="mb-2 flex items-center justify-center h-16 bg-gray-50 rounded border">
                                          <FileText className="h-6 w-6 text-gray-400" />
                                        </div>
                                      )}
                                      
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(file.url, "_blank")}
                                        className="w-full h-auto py-1 text-xs"
                                      >
                                        <Eye className="h-3 w-3 mr-1" />
                                        View
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-row lg:flex-col gap-2 lg:ml-4">
                            {/* Edit Button - Allow editing for draft, rejected, and submitted reviews */}
                            {(review.status === "draft" || review.status === "rejected" || review.status === "submitted") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => editReview(review)}
                                className="flex items-center gap-1 h-auto py-2 px-3 text-xs md:text-sm font-medium"
                              >
                                <Edit className="h-4 w-4" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                            )}
                            
                            {/* View All Files Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Open all files in new tabs
                                if (review.files?.length) {
                                  review.files.forEach((file, index) => {
                                    setTimeout(() => {
                                      window.open(file.url, "_blank");
                                    }, index * 100); // Small delay between opening files
                                  });
                                }
                              }}
                              className="flex items-center gap-1 h-auto py-2 px-3 text-xs md:text-sm font-medium"
                              disabled={!review.files?.length}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="hidden sm:inline">
                                View All ({review.files?.length || 0})
                              </span>
                              <span className="sm:hidden">View</span>
                            </Button>

                            {/* Delete Button - Allow deleting for draft, rejected, and submitted reviews */}
                            {(review.status === "draft" || review.status === "rejected" || review.status === "submitted") && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1 h-auto py-2 px-3 text-xs md:text-sm font-medium"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="hidden sm:inline">Delete</span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-white">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Review</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete &ldquo;{review.reviewTitle}&rdquo;? This action cannot be undone and will permanently remove the review and all associated files.
                                      {review.status === "submitted" && (
                                        <span className="block mt-2 text-orange-600 font-medium">
                                          Note: This review has been submitted for approval. Deleting it will remove it from the admin review queue.
                                        </span>
                                      )}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteReview(review.id)}
                                      className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                                    >
                                      Delete Review
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
