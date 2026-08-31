"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  X,
  Upload,
  FileText,
  Image,
  Trash2,
  Eye,
  Users,
  Building,
  UserCheck,
  Info,
  CheckCircle,
  Edit,
} from "lucide-react";
import useAuthStore from "@/lib/authStore";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { toast } from "sonner";
import InspectorLayout from "@/components/InspectorLayout";

const INSPECTION_STEPS = [
  {
    id: 1,
    title: "Student Count Review",
    description: "Review the number of students per class",
    icon: Users,
  },
  {
    id: 2,
    title: "Madarsa Form",
    description: "Upload images and documentation of the madarsa",
    icon: Building,
  },
  {
    id: 3,
    title: "Management Form",
    description: "Review and document management aspects",
    icon: UserCheck,
  },
  {
    id: 4,
    title: "Sadar Info/Form",
    description: "General information and administrative details",
    icon: Info,
  },
  {
    id: 5,
    title: "Review & Submit",
    description: "Review all information and submit the inspection",
    icon: CheckCircle,
  },
];

export default function InspectionPage() {
  const params = useParams();
  const router = useRouter();
  const { user, userData, setActiveInspectorDistrict } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [madarsaData, setMadarsaData] = useState(null);
  const [studentsByClass, setStudentsByClass] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [inspectionData, setInspectionData] = useState({
    step1: {
      remarks: "",
      studentCounts: {},
    },
    step2: {
      remarks: "",
      attachments: [],
    },
    step3: {
      remarks: "",
      attachments: [],
    },
    step4: {
      remarks: "",
      attachments: [],
    },
  });
  const [existingDraft, setExistingDraft] = useState(null);
  const [location, setLocation] = useState(null);

  const madarsaId = params.madarsaId;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Get Location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.error("Could not get location:", err)
          );
        }

        // Check if user has access to this madarsa
        if (!userData?.assignedMadarsas?.includes(madarsaId)) {
          toast.error("You don't have access to inspect this madarsa");
          router.push("/dashboard/inspector/madarsas");
          return;
        }

        // Fetch madarsa details
        const madarsaQuery = query(
          collection(db, "madarsas"),
          where("madarsaId", "==", madarsaId)
        );
        const madarsaSnapshot = await getDocs(madarsaQuery);
        
        if (madarsaSnapshot.empty) {
          toast.error("Madarsa not found");
          router.push("/dashboard/inspector/madarsas");
          return;
        }

        const madarsa = { id: madarsaSnapshot.docs[0].id, ...madarsaSnapshot.docs[0].data() };
        setMadarsaData(madarsa);
        if (setActiveInspectorDistrict && (madarsa.district || madarsa.districtName)) {
          setActiveInspectorDistrict(madarsa.district || madarsa.districtName);
        }

        // Fetch students by class
        const studentsQuery = query(
          collection(db, "students"),
          where("madarsaId", "==", madarsaId)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        // Group students by class
        const classCounts = {};
        studentsSnapshot.docs.forEach((doc) => {
          const student = doc.data();
          const className = student.class || "Unknown";
          classCounts[className] = (classCounts[className] || 0) + 1;
        });

        const classArray = Object.entries(classCounts).map(([className, count]) => ({
          class: className,
          count,
        }));

        setStudentsByClass(classArray);

        // Check for existing draft
        const draftQuery = query(
          collection(db, "inspectionReports"),
          where("madarsaId", "==", madarsaId),
          where("inspectorId", "==", user.uid),
          where("status", "==", "draft")
        );
        const draftSnapshot = await getDocs(draftQuery);
        
        if (!draftSnapshot.empty) {
          const draft = { id: draftSnapshot.docs[0].id, ...draftSnapshot.docs[0].data() };
          setExistingDraft(draft);
          if (draft.inspectionData) {
            setInspectionData(draft.inspectionData);
          }
          if (draft.currentStep) {
            setCurrentStep(draft.currentStep);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching inspection data:", error);
        toast.error("Failed to load inspection data");
        setLoading(false);
      }
    };

    if (madarsaId && userData && user) {
      fetchData();
    }
  }, [madarsaId, userData, user, router]);

  const handleStepChange = (step) => {
    if (step >= 1 && step <= 5) {
      setCurrentStep(step);
    }
  };

  const handleRemarksChange = (step, value) => {
    setInspectionData(prev => ({
      ...prev,
      [`step${step}`]: {
        ...prev[`step${step}`],
        remarks: value,
      },
    }));
  };

  const handleFileUpload = async (step, files) => {
    toast.info("Uploading files...");
    setSaving(true);
    try {
      const filePromises = Array.from(files).map(async (file) => {
        const fileRef = ref(storage, `inspections/${madarsaId}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(fileRef, file, { contentType: file.type });
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return {
          name: file.name,
          size: file.size,
          type: file.type,
          url: downloadURL,
          uploadedAt: new Date().toISOString(),
        };
      });

      const uploadedFiles = await Promise.all(filePromises);

      setInspectionData(prev => ({
        ...prev,
        [`step${step}`]: {
          ...prev[`step${step}`],
          attachments: [...(prev[`step${step}`].attachments || []), ...uploadedFiles],
        },
      }));
      toast.success("Files uploaded successfully");
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Failed to upload files");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAttachment = (step, index) => {
    setInspectionData(prev => ({
      ...prev,
      [`step${step}`]: {
        ...prev[`step${step}`],
        attachments: prev[`step${step}`].attachments.filter((_, i) => i !== index),
      },
    }));
  };

  const saveDraft = async () => {
    try {
      setSaving(true);

      const draftData = {
        madarsaId,
        madarsaName: madarsaData?.name,
        inspectorId: user.uid,
        inspectorName: userData?.name || userData?.fullName,
        inspectionData,
        currentStep,
        location,
        status: "draft",
        updatedAt: serverTimestamp(),
      };

      if (existingDraft) {
        await updateDoc(doc(db, "inspectionReports", existingDraft.id), draftData);
        toast.success("Draft updated successfully");
      } else {
        const docRef = await addDoc(collection(db, "inspectionReports"), {
          ...draftData,
          createdAt: serverTimestamp(),
        });
        setExistingDraft({ id: docRef.id, ...draftData });
        toast.success("Draft saved successfully");
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const submitInspection = async () => {
    try {
      setSaving(true);

      const submissionData = {
        madarsaId,
        madarsaName: madarsaData?.name,
        inspectorId: user.uid,
        inspectorName: userData?.name || userData?.fullName,
        inspectionData,
        location,
        status: "submitted",
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (existingDraft) {
        await updateDoc(doc(db, "inspectionReports", existingDraft.id), submissionData);
      } else {
        await addDoc(collection(db, "inspectionReports"), {
          ...submissionData,
          createdAt: serverTimestamp(),
        });
      }

      toast.success("Inspection submitted successfully");
      router.push("/dashboard/inspector/reports");
    } catch (error) {
      console.error("Error submitting inspection:", error);
      toast.error("Failed to submit inspection");
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Student Count by Class</CardTitle>
                <CardDescription>
                  Review the current student enrollment per class
                </CardDescription>
              </CardHeader>
              <CardContent>
                {studentsByClass.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No students found for this madarsa
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead>Number of Students</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentsByClass.map((classData, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {classData.class}
                          </TableCell>
                          <TableCell>{classData.count}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-gray-50">
                        <TableCell className="font-bold">Total</TableCell>
                        <TableCell className="font-bold">
                          {studentsByClass.reduce((sum, cls) => sum + cls.count, 0)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Remarks</CardTitle>
                <CardDescription>
                  Add any observations about the student count
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Enter your remarks about the student count..."
                  value={inspectionData.step1.remarks}
                  onChange={(e) => handleRemarksChange(1, e.target.value)}
                  className="min-h-32"
                />
              </CardContent>
            </Card>
          </div>
        );

      case 2:
      case 3:
      case 4:
        const stepNumber = currentStep;
        const stepTitles = {
          2: "Madarsa Form",
          3: "Management Form",
          4: "Sadar Info/Form",
        };
        
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Documents</CardTitle>
                <CardDescription>
                  Upload images or PDF files for {stepTitles[stepNumber]}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor={`file-upload-${stepNumber}`} className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Images (JPG, PNG) or PDF files
                      </p>
                    </div>
                  </Label>
                  <Input
                    id={`file-upload-${stepNumber}`}
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileUpload(stepNumber, e.target.files)}
                    className="hidden"
                  />
                </div>

                {inspectionData[`step${stepNumber}`].attachments?.length > 0 && (
                  <div className="space-y-2">
                    <Label>Uploaded Files</Label>
                    {inspectionData[`step${stepNumber}`].attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          {file.type?.startsWith("image/") ? (
                            <Image className="h-4 w-4 text-blue-500" alt="Image file" />
                          ) : (
                            <FileText className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-gray-500">
                            ({Math.round(file.size / 1024)} KB)
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveAttachment(stepNumber, index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Remarks</CardTitle>
                <CardDescription>
                  Add your observations and notes for {stepTitles[stepNumber]}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder={`Enter your remarks about ${stepTitles[stepNumber].toLowerCase()}...`}
                  value={inspectionData[`step${stepNumber}`].remarks}
                  onChange={(e) => handleRemarksChange(stepNumber, e.target.value)}
                  className="min-h-32"
                />
              </CardContent>
            </Card>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Inspection Summary</CardTitle>
                <CardDescription>
                  Review all sections before submitting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {INSPECTION_STEPS.slice(0, 4).map((step) => (
                  <div key={step.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <step.icon className="h-4 w-4" />
                        {step.title}
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentStep(step.id)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                    
                    {step.id === 1 && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 mb-2">Student Count Summary:</p>
                        <p className="text-sm">
                          Total students: {studentsByClass.reduce((sum, cls) => sum + cls.count, 0)} 
                          across {studentsByClass.length} classes
                        </p>
                      </div>
                    )}

                    {step.id > 1 && inspectionData[`step${step.id}`].attachments?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 mb-2">Attachments:</p>
                        <div className="flex flex-wrap gap-2">
                          {inspectionData[`step${step.id}`].attachments.map((file, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {file.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-sm text-gray-600 mb-1">Remarks:</p>
                      <p className="text-sm bg-gray-50 p-2 rounded">
                        {inspectionData[`step${step.id}`].remarks || "No remarks added"}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceedToNext = () => {
    // You can add validation logic here
    return true;
  };

  if (loading) {
    return (
      <InspectorLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </InspectorLayout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Inspection: {madarsaData?.name}
            </h1>
            <p className="text-gray-600">
              Madarsa ID: {madarsaId} • Step {currentStep} of 5
            </p>
          </div>
          <Badge variant={existingDraft ? "secondary" : "outline"}>
            {existingDraft ? "Draft Saved" : "New Inspection"}
          </Badge>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
          {INSPECTION_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  step.id === currentStep
                    ? "bg-blue-600 text-white"
                    : step.id < currentStep
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                <step.icon className="h-5 w-5" />
              </div>
              {index < INSPECTION_STEPS.length - 1 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    step.id < currentStep ? "bg-green-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Current Step Title */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {INSPECTION_STEPS[currentStep - 1]?.icon && 
                React.createElement(INSPECTION_STEPS[currentStep - 1].icon, { className: "h-6 w-6" })
              }
              Step {currentStep}: {INSPECTION_STEPS[currentStep - 1]?.title}
            </CardTitle>
            <CardDescription>
              {INSPECTION_STEPS[currentStep - 1]?.description}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Step Content */}
        {renderStepContent()}

        {/* Navigation Controls */}
        <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <Button
                variant="outline"
                onClick={() => handleStepChange(currentStep - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-1" />
              Save Draft
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(true)}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>

            {currentStep < 5 && (
              <Button
                onClick={() => handleStepChange(currentStep + 1)}
                disabled={!canProceedToNext()}
              >
                {currentStep === 4 ? "Review" : "Next"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {currentStep === 5 && (
              <Button
                onClick={submitInspection}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700"
              >
                Submit Inspection
              </Button>
            )}
          </div>
        </div>

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Inspection</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel this inspection? Any unsaved changes will be lost.
                You can save as draft to preserve your progress.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Continue Inspection</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => router.push("/dashboard/inspector/madarsas")}
              >
                Cancel Inspection
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
