"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getStudentByOldMid,
} from "@/lib/digitalClassStudentService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  registerDigitalStudent,
} from "@/lib/digitalClassStudentService";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { IslamicPattern} from "@/components/digitalclassroom/dashborad";
import {
  GraduationCap,
  Upload,
  CheckCircle,
  Check,
  ChevronsUpDown,
  Camera,
  X,
  Loader2,
  ArrowLeft,
  ArrowRight,
  UserRound,
  BookOpen,
  Phone,
  ShieldCheck,
  Heart,
  Sparkles,
} from "lucide-react";
import admissionFormConfig from "@/data/digitaladmission.json";
import configDropdowns from "@/data/configDropdowns.json";

import { cn } from "@/lib/utils";

// Load Razorpay script


export default function AdmissionForm() {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
const [midLoading, setMidLoading] =  useState(false);

const [midFound, setMidFound] =  useState(false);

const [midChecked, setMidChecked] =  useState(false);
  // Show all errors as top-right toasts instead of inline banners
  useEffect(() => {
    if (error) {
      toast.error(error, { duration: 5000 });
    }
  }, [error]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
 

  const [madarsas, setMahals] = useState([]);
  const [madarsasLoading, setMahalsLoading] = useState(false);
  const [madarsaSearchOpen, setMahalSearchOpen] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [videoRef, setVideoRef] = useState(null);
  const [stream, setStream] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [showAdmissions, setShowAdmissions] = useState(true);
  const [checkingSettings, setCheckingSettings] = useState(true);
 
  const router = useRouter();
  // Fetch madarsas from database
  const fetchMahals = async () => {
    try {
      setMahalsLoading(true);
      const response = await fetch("/api/public/madarsas", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load public madrasa list");
      }
      const madarsasData = await response.json();

      setMahals(madarsasData);
    } catch (error) {
      console.error("Error fetching mekhalas:", error);
      setError("Failed to load mekhalas. Please refresh the page.");
    } finally {
      setMahalsLoading(false);
    }
  };

  useEffect(() => {
    const checkAdmissionSettings = async () => {
      try {
        const { getSetting } = await import("@/lib/settingsService");
        const isOpen = await getSetting("showAdmissions", true);
        // Load per-class fees map; fall back to legacy ukgAdmissionFee
        
        setShowAdmissions(isOpen);
        if (!isOpen) {
          toast.error("Admissions are currently closed.");
        }
      } catch (err) {
        console.error("Error checking settings:", err);
      } finally {
        setCheckingSettings(false);
      }
    };
    checkAdmissionSettings();

    // Load Razorpay script
        // Fetch madarsas from database
    fetchMahals();

    // Initialize form data with default values
    const initialData = {};
    admissionFormConfig.sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.type === "date" && field.validation?.maxDate === "today") {
          initialData[field.id] = new Date().toISOString().split("T")[0];
        } else {
          initialData[field.id] = "";
        }
      });
    });
    setFormData(initialData);
  }, []);

  // Cleanup camera stream on component unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const handleInputChange = (fieldId, value) => {
    setFormData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));

    // Clear error when user starts typing
    if (error && fieldId === "email") {
      setError("");
    }
  };

  const validateEmail = (email) => {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailPattern.test(email);
  };

  const uploadToFirebase = async (file) => {
    if (!file) {
      throw new Error("No file provided for upload");
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("File size should be less than 5MB");
    }

    // Determine correct content type with fallback
    let contentType = file.type;
    if (!contentType || !contentType.startsWith("image/")) {
      // Fallback: detect from filename extension
      const filename = file.name.toLowerCase();
      if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
        contentType = "image/jpeg";
      } else if (filename.endsWith(".png")) {
        contentType = "image/png";
      } else if (filename.endsWith(".gif")) {
        contentType = "image/gif";
      } else if (filename.endsWith(".webp")) {
        contentType = "image/webp";
      } else if (filename.endsWith(".heic")) {
        contentType = "image/heic";
      } else if (filename.endsWith(".heif")) {
        contentType = "image/heif";
      } else {
        // Default to JPEG if we can't determine
        contentType = "image/jpeg";
      }
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Create a unique filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const fileName = `students/profile-picture/${timestamp}_${sanitizedName}`;

      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: contentType,
      });

      return new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => {
            console.error("Firebase upload error:", {
              code: error.code,
              message: error.message,
              serverResponse: error.serverResponse,
            });
            setUploading(false);
            setUploadProgress(0);

            // Format error message based on error code
            let errorMessage = "Upload failed";
            if (error.code === "storage/unauthorized") {
              errorMessage = "Permission denied. Please check if the file is a valid image.";
            } else if (error.code === "storage/invalid-argument") {
              errorMessage = "Invalid file. Please ensure it's a JPEG, PNG, or GIF image.";
            } else if (error.code === "storage/retry-limit-exceeded") {
              errorMessage = "Upload timeout. Please check your internet and try again.";
            } else {
              errorMessage = `Upload failed: ${error.message}`;
            }

            reject(new Error(errorMessage));
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setUploading(false);
              setUploadProgress(100);

              // Small delay to show 100% progress
              await new Promise((r) => setTimeout(r, 500));

              resolve(downloadURL);
            } catch (error) {
              setUploading(false);
              console.error("Failed to get download URL:", error);
              reject(new Error("Failed to get download URL: " + error.message));
            }
          },
        );
      });
    } catch (error) {
      setUploading(false);
      setUploadProgress(0);
      console.error("Error initiating upload:", error);
      throw error;
    }
  };

  const handleProfileImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Clear any previous errors
      setError("");

      setFormData((prev) => ({
        ...prev,
        profileImage: file,
      }));

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData((prev) => ({
          ...prev,
          profileImagePreview: e.target.result,
        }));
      };
      reader.readAsDataURL(file);

      // Upload immediately after file selection
      try {
        const uploadedUrl = await uploadToFirebase(file);

        // Store the uploaded URL — now the form can be submitted
        setFormData((prev) => ({
          ...prev,
          profilePictureUrl: uploadedUrl,
        }));
      } catch (error) {
        console.error("❌ Upload failed:", error.message);
        // Clear the file so validation blocks submission until user re-selects
        setFormData((prev) => ({
          ...prev,
          profileImage: null,
          profileImagePreview: null,
          profilePictureUrl: null,
        }));
        setError(
          `Photo upload failed: ${error.message}. Please select the photo again.`,
        );
      }
    }
  };

  // This function is no longer needed since we upload immediately
  // keeping it for backward compatibility but it now just returns the stored URL
  const uploadProfileImage = async () => {
    if (formData.profilePictureUrl) {
      //console.log("🔗 Using already uploaded image URL:", formData.profilePictureUrl);
      return formData.profilePictureUrl;
    }
    return null;
  };

  // Camera functionality
  const startCamera = async () => {
    try {
      setError(""); // Clear any previous errors

      // Check if browser supports camera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera is not supported in this browser.");
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      setShowCamera(true);
    } catch (error) {
      console.error("Error accessing camera:", error);

      let errorMessage = "Unable to access camera. ";
      if (error.name === "NotAllowedError") {
        errorMessage += "Please allow camera permissions and try again.";
      } else if (error.name === "NotFoundError") {
        errorMessage += "No camera device found.";
      } else if (error.name === "NotReadableError") {
        errorMessage += "Camera is already in use by another application.";
      } else {
        errorMessage += error.message || "Please check your camera settings.";
      }

      setError(errorMessage);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef || !stream) {
      setError("Camera not ready. Please try again.");
      return;
    }

    setCapturing(true);
    setError(""); // Clear any previous errors

    try {
      const canvas = document.createElement("canvas");
      const video = videoRef;

      // Ensure video has loaded
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error(
          "Camera not ready. Please wait a moment and try again.",
        );
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(
        async (blob) => {
          if (blob) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const file = new File([blob], `profile-photo-${timestamp}.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });

            setFormData((prev) => ({
              ...prev,
              profileImage: file,
            }));

            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
              setFormData((prev) => ({
                ...prev,
                profileImagePreview: e.target.result,
              }));
            };
            reader.readAsDataURL(file);

            // Upload immediately after capture
            try {
              //console.log("📸 Starting upload for captured photo:", file.name);
              const uploadedUrl = await uploadToFirebase(file);
              // console.log("✅ Capture & Upload successful! Cloudinary URL:", uploadedUrl);

              // Store the uploaded URL
              setFormData((prev) => ({
                ...prev,
                profilePictureUrl: uploadedUrl,
              }));
            } catch (error) {
              console.error("❌ Upload failed:", error.message);
              setError(`Upload failed: ${error.message}`);
            }

            stopCamera();
          } else {
            setError("Failed to capture photo. Please try again.");
          }
          setCapturing(false);
        },
        "image/jpeg",
        0.9, // Higher quality
      );
    } catch (error) {
      console.error("Error capturing photo:", error);
      setError(error.message || "Failed to capture photo. Please try again.");
      setCapturing(false);
    }
  };

  // Set video ref when camera is shown
  const setVideoElement = (element) => {
    setVideoRef(element);
    if (element && stream) {
      element.srcObject = stream;
    }
  };

  /**
   * Generate a unique sequential admission number for a given madarsa.
   *
   * This is delegated to the server (/api/public/admission-number), which uses
   * the Firebase Admin SDK. The admission form is a public, unauthenticated
   * page, and firestore.rules intentionally does not allow anonymous clients
   * to list the `admissions`/`students` collections (that would leak other
   * applicants' data) — so this can't be done with client-side Firestore
   * reads without either exposing data or hitting permission-denied.
   */
  const generateAdmissionNumber = async (selectedMahal) => {
    let response;
    try {
      response = await fetch("/api/public/admission-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ madarsaId: selectedMahal }),
      });
    } catch (networkError) {
      throw new Error(
        "Could not reserve an admission number. Please check your connection and try again.",
      );
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.admissionNumber) {
      throw new Error(
        data.error || "Could not reserve an admission number. Please try again.",
      );
    }

    return {
      admissionNumber: data.admissionNumber,
      madarsaId: selectedMahal,
      nextCounterValue: data.nextCounterValue,
    };
  };

 const handleOldMidSearch = async () => {
  const mid =
    formData.oldRegistrationNumber?.trim();

  if (!mid) {
    toast.error(
      "Please enter old MID number"
    );
    return;
  }

  setMidLoading(true);
  setMidChecked(false);
  setMidFound(false);

  try {
    const result =
      await getStudentByOldMid(mid);

    setMidChecked(true);

    if (!result.found) {
      setMidFound(false);

      toast.error(
        "Student not found. Please enter details manually."
      );

      return;
    }

    const student = result.student;

    setMidFound(true);

    setFormData((prev) => ({
      ...prev,

      hasOldRegistration: "yes",

      oldRegistrationNumber:
        student.oldRegistrationNumber ||
        prev.oldRegistrationNumber,

      studentId:
        student.studentId || null,

      uid:
        student.uid || null,

      fullName:
        student.fullName || "",

      dateOfBirth:
        student.dateOfBirth || "",

      gender:
        student.gender || "",

      email:
        student.email || "",

      phone:
        student.phone || "",

      guardianName:
        student.guardianName || "",

      guardianPhone:
        student.guardianPhone || "",

      address:
        student.address || "",

      previousmadarsa:
        student.previousmadarsa || "",

      profilePicture:
        student.profilePicture || "",

      profilePictureUrl:
        student.profilePicture || "",
    }));

    toast.success(
      "Student found. Details filled automatically."
    );
  } catch (error) {
    console.error(
      "MID search error:",
      error
    );

    toast.error(
      error.message ||
        "Failed to search student"
    );
  } finally {
    setMidLoading(false);
  }
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validate required fields
      const requiredFields = ["fullName", "phone", "dateOfBirth"];
      for (const field of requiredFields) {
        if (!formData[field]) {
          throw new Error(
            `Please fill in the ${field
              .replace(/([A-Z])/g, " $1")
              .toLowerCase()} field`,
          );
        }
      }

      // Validate profile picture — require upload to be fully completed (URL in hand)
      if (!formData.profilePictureUrl) {
        if (uploading) {
          throw new Error(
            "Please wait for the photo upload to finish before submitting.",
          );
        }
        throw new Error("Please upload a profile picture before submitting.");
      }

      // Validate madarsa selection if it's a required field
      const madarsaField = admissionFormConfig.sections
        .flatMap((section) => section.fields)
        .find((field) => field.options === "madarsas");

      if (madarsaField && madarsaField.required && !formData[madarsaField.id]) {
        throw new Error("Please select a madarsa");
      }

      // Validate email format
      if (formData.email && !validateEmail(formData.email)) {
        throw new Error("Please enter a valid email address");
      }

      // Validate Aadhar number length if provided
      if (formData.aadharNumber && formData.aadharNumber.length !== 12) {
        throw new Error("Aadhar number must be exactly 12 digits");
      }

      // Profile picture URL is already validated above
      const profilePictureUrl = formData.profilePictureUrl;

      // Generate sequential admission number
      const selectedMahal = formData.madarsa || "madarsa-001";

      const admissionData = await generateAdmissionNumber(selectedMahal);
      const admissionNum = admissionData.admissionNumber;
      const madarsaId = admissionData.madarsaId;

      // Double-check uniqueness (extra safety)
      // const isUnique = await isAdmissionNumberUnique(admissionNum);
      // if (!isUnique) {
      //   throw new Error("Generated admission number already exists. Please try again.");
      // }

      // Prepare submission data (without payment info initially)
      const submissionData = {
  ...formData,

  profilePicture: profilePictureUrl,

  status: "pending",
};

// Don't send File/preview objects
delete submissionData.profileImagePreview;
delete submissionData.profileImage;

const result = await registerDigitalStudent(
  submissionData
);

const digitalAdmissionNumber =
  result.digitalAdmissionNumber;

toast.success(
  "Digital Class admission submitted successfully!",
  {
    duration: 3000,
  }
);

sessionStorage.setItem(
  "admissionData",
  JSON.stringify({
    ...submissionData,
    digitalAdmissionNumber,
  })
);

await new Promise((resolve) =>
  setTimeout(resolve, 800)
);

router.push(
  `/digital-admission/confirmation?admissionNumber=${encodeURIComponent(
    digitalAdmissionNumber
  )}`
);

return;
    } catch (error) {
  console.error("Submission error:", error);

  setError(
    error.message ||
      "Failed to submit application. Please try again."
  );
} finally {
  setLoading(false);
}
  };

  const renderField = (field) => {
    switch (field.type) {
      case "text":
      case "tel":
      case "email":
        // Special handling for Aadhar number with 4 boxes
        if (field.id === "aadharNumber") {
          const aadharValue = formData[field.id] || "";
          const aadharParts = [
            aadharValue.slice(0, 4),
            aadharValue.slice(4, 8),
            aadharValue.slice(8, 12),
          ];

          const handleAadharChange = (index, value) => {
            // Only allow digits
            const numericValue = value.replace(/\D/g, "");

            // Create new parts array
            const newParts = [...aadharParts];
            newParts[index] = numericValue.slice(0, 4); // Max 4 digits per box

            // Combine all parts and update form data
            const combinedValue = newParts.join("");
            handleInputChange(field.id, combinedValue);

            // Auto-focus next input if current is filled and not the last box
            if (newParts[index].length === 4 && index < 2) {
              const nextInput = document.getElementById(`aadhar-${index + 1}`);
              if (nextInput) nextInput.focus();
            }
          };

          const handleAadharKeyDown = (index, e) => {
            if (e.key === "Backspace" && !aadharParts[index] && index > 0) {
              const prevInput = document.getElementById(`aadhar-${index - 1}`);
              if (prevInput) prevInput.focus();
            }
          };

          return (
            <div className="space-y-1">
              <div className="flex space-x-2">
                {aadharParts.map((part, index) => (
                  <Input
                    key={index}
                    id={`aadhar-${index}`}
                    type="text"
                    value={part}
                    onChange={(e) => handleAadharChange(index, e.target.value)}
                    onKeyDown={(e) => handleAadharKeyDown(index, e)}
                    placeholder="0000"
                    maxLength={4}
                    required={field.required && index === 0}
                    className="h-11 text-center flex-1 placeholder:text-gray-600 font-mono tracking-widest"
                  />
                ))}
              </div>
              {aadharValue.length > 0 && aadharValue.length !== 12 && (
                <p className="text-xs text-red-500">
                  Aadhar number must be 12 digits
                </p>
              )}
            </div>
          );
        }

        return (
          <div className="space-y-1">
            <Input
              id={field.id}
              type={field.type}
              value={formData[field.id] || ""}
              onChange={(e) => handleInputChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              className={`h-11 flex placeholder:text-gray-600 ${
                field.type === "email" &&
                formData[field.id] &&
                !validateEmail(formData[field.id])
                  ? "border-red-500 focus:border-red-500"
                  : ""
              }`}
            />
            {field.type === "email" &&
              formData[field.id] &&
              !validateEmail(formData[field.id]) && (
                <p className="text-xs text-red-500">
                  Please enter a valid email address
                </p>
              )}
          </div>
        );

      case "date":
        return (
          <Input
            id={field.id}
            type="date"
            value={formData[field.id] || ""}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            required={field.required}
            className="h-11 placeholder:text-gray-600"
            max={
              field.validation?.maxDate === "today"
                ? new Date().toISOString().split("T")[0]
                : undefined
            }
          />
        );

      case "textarea":
        return (
          <Textarea
            id={field.id}
            value={formData[field.id] || ""}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            rows={field.rows || 3}
            className="placeholder:text-gray-600"
          />
        );

      case "select":
        // Handle madarsa selection with searchable dropdown
        if (field.options === "madarsas") {
          return (
            <Popover open={madarsaSearchOpen} onOpenChange={setMahalSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={madarsaSearchOpen}
                  className="h-auto min-h-[44px] w-full justify-between text-left font-normal p-3"
                >
                  <div className="flex flex-col items-start space-y-1 min-w-0 flex-1">
                    {formData[field.id] ? (
                      <>
                        <span className="font-medium text-gray-900 truncate">
                          {madarsas.find(
                            (madarsa) => madarsa.value === formData[field.id],
                          )?.label || "Selected Mahal"}
                        </span>
                        {madarsas.find(
                          (madarsa) => madarsa.value === formData[field.id],
                        )?.address && (
                          <span className="text-xs text-gray-500 truncate">
                            📍{" "}
                            {
                              madarsas.find(
                                (madarsa) =>
                                  madarsa.value === formData[field.id],
                              )?.address
                            }
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-600">
                        {field.placeholder || "Select madarsa..."}
                      </span>
                    )}
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0 bg-white overflow-hidden"
                align="start"
                side="bottom"
                sideOffset={6}
                avoidCollisions={false}
              >
                <Command className="max-h-[360px]">
                  <CommandInput
                    placeholder="Search madrasa by name, place, or MID..."
                    className="h-12 placeholder:text-gray-600"
                  />
                  <CommandEmpty>
                    {madarsasLoading
                      ? "Loading madrasas..."
                      : "No madrasa found."}
                  </CommandEmpty>
                  <CommandGroup className="max-h-[308px] overflow-y-auto overflow-x-hidden">
                    {madarsasLoading ? (
                      <CommandItem disabled>
                        <span className="text-gray-500">
                          Loading madrasas...
                        </span>
                      </CommandItem>
                    ) : (
                      madarsas.map((madarsa) => (
                        <CommandItem
                          key={madarsa.id}
                          value={`${madarsa.label} ${madarsa.address || ""} ${
                            madarsa.value
                          }`}
                          onSelect={() => {
                            handleInputChange(field.id, madarsa.value);
                            setMahalSearchOpen(false);
                          }}
                          className="px-4 py-3 cursor-pointer hover:bg-gray-50"
                        >
                          <Check
                            className={`mr-3 h-4 w-4 flex-shrink-0 ${
                              formData[field.id] === madarsa.value
                                ? "opacity-100 text-teal-600"
                                : "opacity-0"
                            }`}
                          />
                          <div className="flex flex-col space-y-1 min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <span className="font-medium text-gray-900 truncate">
                                {madarsa.label}
                              </span>
                              <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full flex-shrink-0">
                                {madarsa.value}
                              </span>
                            </div>
                            {madarsa.address && (
                              <span className="text-sm text-gray-500 truncate">
                                📍 {madarsa.address}
                              </span>
                            )}
                            <div className="flex items-center space-x-4 text-xs text-gray-400">
                              {madarsa.phone && <span>📞 {madarsa.phone}</span>}
                              {madarsa.email && <span>✉️ {madarsa.email}</span>}
                            </div>
                          </div>
                        </CommandItem>
                      ))
                    )}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          );
        }

        // Handle other select fields (classes, etc.)
        const options =
          field.options === "classes" ? configDropdowns.classes : [];
        return (
          <Select
            value={formData[field.id] || ""}
            onValueChange={(value) => handleInputChange(field.id, value)}
          >
            <SelectTrigger className="h-11 [&>span]:text-gray-600">
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto bg-white">
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "radio":
        return (
          <RadioGroup
            value={formData[field.id] || ""}
            onValueChange={(value) => handleInputChange(field.id, value)}
            className="flex space-x-6"
          >
            {field.options.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={option.value}
                  id={`${field.id}-${option.value}`}
                />
                <Label htmlFor={`${field.id}-${option.value}`}>
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "file":
        return (
          <div className="space-y-2">
            <Input
              id={field.id}
              type="file"
              accept={field.accept}
              onChange={handleProfileImageChange}
              className="h-11 placeholder:text-gray-600"
            />
            {formData.profileImage && (
              <p className="text-sm text-gray-600">
                Selected: {formData.profileImage.name}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (checkingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!showAdmissions) {
    return (
      <div className="min-h-screen flex flex-col">
       
        <main className="flex-1 flex items-center justify-center p-4 bg-gray-50">
          <Card className="max-w-md w-full text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <X className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Admissions Closed
              </CardTitle>
              <CardDescription className="text-gray-600 mt-2">
                We are sorry, but the admission process is currently closed.
                Please check back later or contact the administration for more
                information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => router.push("/")}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </main>
       
      </div>
    );
  }

  return (
  <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-teal-50">
   

    {/* Background */}
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-32 top-20 h-[420px] w-[420px] rounded-full bg-blue-100/40 blur-[100px]" />
      <div className="absolute -right-32 top-10 h-[500px] w-[500px] rounded-full bg-teal-100/50 blur-[110px]" />
      <div className="absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-emerald-100/30 blur-[100px]" />

      <div className="absolute inset-0 opacity-[0.025]">
        <IslamicPattern />
      </div>
    </div>

    <main className="relative z-10">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#effcfc]">
  {/* Hero background artwork */}
  <div className="absolute inset-0">
    <Image
      src="/admission-hero.png"
      alt="hero image"
      fill
      priority
      className="object-cover object-center"
      sizes="100vw"
    />

    {/* Soft overlay so live text stays readable */}
    <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/75 to-transparent" />
  </div>
  {/* Quote Card */}
<div
  className="
    absolute
    right-8
    top-8
    z-20
    hidden
    max-w-[210px]
    rounded-2xl
    border
    border-white/70
    bg-white/80
    px-5
    py-4
    text-center
    shadow-[0_10px_30px_rgba(15,23,42,0.08)]
    backdrop-blur-md
    lg:block
  "
>
  <p className="text-sm font-semibold italic leading-6 text-[#07184c]">
    “Seek knowledge from the cradle to the grave.”
  </p>

  <p className="mt-2 text-[11px] font-medium text-slate-500">
    — Prophet Muhammad (ﷺ)
  </p>
</div>
{/* Right Side Message */}
<div
  className="
    absolute
    bottom-12
    right-8
    z-20
    hidden
    max-w-[180px]
    -rotate-3
    text-center
    lg:block
  "
>
  <p className="text-lg font-bold italic leading-7 text-teal-700">
    Knowledge
    <br />
    Builds a Better
    <br />
    Tomorrow
  </p>

  <div className="mx-auto mt-2 h-0.5 w-16 rounded-full bg-teal-500" />
</div>

  <div className="relative z-10 mx-auto min-h-[340px] max-w-7xl px-5 sm:px-8 lg:px-10">
    {/* Back button */}
    <div className="pt-7">
      <button
        type="button"
        onClick={() => router.push("/digital-class")}
        className="
          inline-flex items-center gap-2
          rounded-xl
          border border-white/80
          bg-white/85
          px-4 py-2.5
          text-xs font-semibold text-teal-700
          shadow-[0_6px_20px_rgba(15,23,42,0.06)]
          backdrop-blur-md
          transition-all duration-300
          hover:-translate-y-0.5
          hover:bg-white
          hover:shadow-md
        "
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </button>
    </div>

    {/* Main content */}
    <div className="flex min-h-[275px] items-center">
      <div className="max-w-[570px] pb-8 pt-7">
        {/* Logo / organization */}
        <div className="mb-7 flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="DKJU"
            width={58}
            height={58}
            className="h-14 w-auto object-contain"
          />

          <div>
            <p className="text-xl font-extrabold leading-none text-teal-700">
              DKIMVB
            </p>

            
          </div>
        </div>

        {/* Heading */}
        <h1
          className="
            text-[34px]
            font-black
            leading-[1.05]
            tracking-[-0.035em]
            text-[#07184c]
            sm:text-[44px]
            lg:text-[50px]
          "
        >
          Digital{" "}
          <span className="text-teal-500">
           Class Admission
          </span>
        </h1>

        <h2 className="mt-3 text-[15px] font-bold text-[#073d5d] sm:text-base">
          Begin a beautiful journey of Islamic learning
        </h2>

        <p className="mt-3 max-w-[510px] text-[12px] leading-5 text-slate-500 sm:text-[13px]">
          Fill in the details below to apply for admission to your
          preferred madrasa.
          <br className="hidden sm:block" />
          Let&apos;s nurture a brighter tomorrow together.
        </p>
      </div>
    </div>
  </div>

  {/* bottom fade */}
  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/30 to-transparent" />
</section>

      {/* STEPS */}
    

      {/* FORM + SIDEBAR */}
      <div className="mx-auto grid max-w-7xl gap-7 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* OLD REGISTRATION CHECK */}
<Card className="overflow-hidden rounded-[24px] border border-slate-100/80 bg-white/90 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur-xl">
  <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-teal-50/80 via-white to-white px-6 py-5">
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
        <ShieldCheck className="h-5 w-5" />
      </div>

      <div>
        <CardTitle className="text-lg font-extrabold text-[#07184c]">
          Previous Registration
        </CardTitle>

        <CardDescription className="mt-1 text-xs text-slate-400">
          Check whether the student already has an old registration number
        </CardDescription>
      </div>
    </div>
  </CardHeader>

  <CardContent className="p-6">
    <div className="space-y-5">

      {/* QUESTION */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-gray-700">
          Do you have an old Registration Number?
          <span className="ml-1 text-red-500">*</span>
        </Label>

        <RadioGroup
          value={formData.hasOldRegistration || ""}
          onValueChange={(value) => {
            handleInputChange(
              "hasOldRegistration",
              value
            );

            if (value === "no") {
              handleInputChange(
                "oldRegistrationNumber",
                ""
              );

              setMidFound(false);
              setMidChecked(false);
            }
          }}
          className="flex items-center gap-8"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem
              value="yes"
              id="has-old-registration-yes"
            />

            <Label
              htmlFor="has-old-registration-yes"
              className="cursor-pointer font-normal"
            >
              Yes
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <RadioGroupItem
              value="no"
              id="has-old-registration-no"
            />

            <Label
              htmlFor="has-old-registration-no"
              className="cursor-pointer font-normal"
            >
              No
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* OLD MID SEARCH */}
      {formData.hasOldRegistration === "yes" && (
        <div className="space-y-2">
          <Label
            htmlFor="oldRegistrationNumber"
            className="text-sm font-medium text-gray-600"
          >
            Old MID Number
          </Label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="oldRegistrationNumber"
              value={
                formData.oldRegistrationNumber ||
                ""
              }
              onChange={(e) => {
                handleInputChange(
                  "oldRegistrationNumber",
                  e.target.value
                );

                setMidFound(false);
                setMidChecked(false);
              }}
              placeholder="MID-736-000076"
              className="h-11 flex-1 rounded-xl border-slate-200 bg-white placeholder:text-gray-400 focus-visible:border-teal-500 focus-visible:ring-teal-500/10"
            />

            <Button
              type="button"
              onClick={handleOldMidSearch}
              disabled={
                midLoading ||
                !formData.oldRegistrationNumber?.trim()
              }
              className="h-11 rounded-xl bg-teal-600 px-6 font-semibold text-white hover:bg-teal-700"
            >
              {midLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "Check MID"
              )}
            </Button>
          </div>

          {midChecked && midFound && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              <CheckCircle className="h-4 w-4" />
              Student found. Existing details loaded.
            </div>
          )}

          {midChecked && !midFound && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              Student not found. Please enter the details manually.
            </div>
          )}
        </div>
      )}
    </div>
  </CardContent>
</Card>
          {admissionFormConfig.sections.map((section, sectionIndex) => (
            <Card
              key={section.id}
              className="overflow-hidden rounded-[24px] border border-slate-100/80 bg-white/90 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur-xl"
            >
              <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-teal-50/80 via-white to-white px-6 py-5">
               
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                    {sectionIndex === 0 ? (
                      <UserRound className="h-5 w-5" />
                    ) : (
                      <GraduationCap className="h-5 w-5" />
                    )}
                  </div>
                  

                  <div>
                    <CardTitle className="text-lg font-extrabold text-[#07184c]">
                      {section.title}
                    </CardTitle>

                    <CardDescription className="mt-1 text-xs text-slate-400">
                      Please provide the required information
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid gap-x-6 gap-y-5 p-6 md:grid-cols-2">
                {section.fields.map((field) => {
  // Check conditional field
  if (
    field.conditional &&
    formData[field.conditional.field] !== field.conditional.value
  ) {
    return null;
  }

  return (
    <div key={field.id} className="space-y-2">
      <Label
        htmlFor={field.id}
        className="text-sm font-medium text-gray-600"
      >
        {field.label}

        {field.required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </Label>

      {renderField(field)}
    </div>
  );
})}
              </CardContent>
            </Card>
          ))}

          {/* PROFILE PHOTO */}
          <Card className="overflow-hidden rounded-[24px] border border-slate-100 bg-white/90 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                  <Camera className="h-5 w-5" />
                </div>

                <div>
                  <CardTitle className="text-lg font-extrabold text-[#07184c]">
                    Profile Picture
                  </CardTitle>

                  <CardDescription>
                    Upload or capture the student&apos;s photo
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <input
                type="file"
                id="profileImage"
                accept="image/*"
                onChange={handleProfileImageChange}
                className="hidden"
              />

              <div className="rounded-[20px] border-2 border-dashed border-teal-100 bg-gradient-to-br from-teal-50/50 to-white p-6">
                <div className="flex flex-col items-center justify-center text-center">
                  {formData.profileImagePreview ? (
                    <div className="relative mb-5 h-28 w-28 overflow-hidden rounded-2xl border-4 border-white shadow-lg">
                      <Image
                        src={formData.profileImagePreview}
                        alt="Profile preview"
                        fill
                        className="object-cover"
                        sizes="112px"
                      />
                    </div>
                  ) : (
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100 text-teal-600">
                      <Camera className="h-7 w-7" />
                    </div>
                  )}

                  <h3 className="font-bold text-[#07184c]">
                    Student Profile Photo
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    JPG, PNG, GIF or WebP • Maximum 5MB
                  </p>

                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <label
                      htmlFor="profileImage"
                      className="inline-flex cursor-pointer items-center rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-100 transition hover:bg-teal-700"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Choose Photo
                    </label>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={showCamera ? stopCamera : startCamera}
                      className="h-10 rounded-xl border-slate-200 bg-white px-5 text-slate-600"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {showCamera ? "Cancel Camera" : "Take Photo"}
                    </Button>
                  </div>

                  {uploading && (
                    <div className="mt-6 w-full max-w-md">
                      <div className="mb-2 flex justify-between text-xs">
                        <span className="font-semibold text-teal-700">
                          Uploading photo...
                        </span>

                        <span className="font-bold text-teal-600">
                          {Math.round(uploadProgress)}%
                        </span>
                      </div>

                      <Progress value={uploadProgress} />
                    </div>
                  )}
                </div>
              </div>

              {showCamera && (
                <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <video
                    ref={setVideoElement}
                    autoPlay
                    playsInline
                    className="mx-auto h-64 w-full max-w-md rounded-xl bg-black object-cover"
                  />

                  <div className="mt-4 flex justify-center gap-3">
                    <Button
                      type="button"
                      onClick={capturePhoto}
                      disabled={capturing}
                      className="rounded-xl bg-teal-600 hover:bg-teal-700"
                    >
                      {capturing && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}

                      {capturing ? "Capturing..." : "Capture Photo"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={stopCamera}
                      className="rounded-xl"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SUBMIT - NO PAYMENT */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/")}
              className="h-12 rounded-xl border-slate-200 px-7 text-slate-600"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={loading || uploading}
              className="h-12 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 px-8 font-bold text-white shadow-lg shadow-teal-200/60 transition-all hover:-translate-y-0.5 hover:from-teal-600 hover:to-emerald-700 hover:shadow-xl disabled:translate-y-0"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting Application...
                </>
              ) : uploading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Uploading Photo...
                </>
              ) : (
                <>
                  Submit Application
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
        

        {/* RIGHT SIDE */}
        <aside className="space-y-5">
          <div className="rounded-[22px] border border-slate-100 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <BookOpen className="h-5 w-5" />
              </div>

              <h3 className="text-sm font-extrabold text-[#07184c]">
                Why Choose Madrasa Education?
              </h3>
            </div>

            <div className="space-y-4">
              {[
                "Strong Islamic foundation",
                "Moral and ethical character building",
                "Qualified and experienced teachers",
                "Safe and nurturing environment",
                "Balanced religious and modern education",
              ].map((item) => (
                <div key={item} className="flex gap-3">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />

                  <span className="text-xs leading-5 text-slate-500">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-teal-100 bg-gradient-to-br from-teal-50 to-cyan-50 p-6 text-center">
            <p className="font-serif text-lg font-semibold italic leading-7 text-[#07184c]">
              “Knowledge is a light that guides you through life.”
            </p>
          </div>

          <div className="rounded-[22px] border border-slate-100 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                <Phone className="h-5 w-5" />
              </div>

              <div>
                <h3 className="font-bold text-[#07184c]">
                  Need Help?
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-400">
                  If you have any questions, feel free to contact our
                  technical support.
                </p>

                <a
                  href="tel:8891177850"
                  className="mt-3 inline-flex items-center text-sm font-bold text-teal-600 hover:text-teal-700"
                >
                  8891177850
                  <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* BOTTOM ISLAMIC BANNER */}
     <section
  className="relative min-h-[180px] overflow-hidden bg-cover bg-center bg-no-repeat"
  style={{
    backgroundImage: "url('/footer-bg.png')",
  }}
>
  <div className="relative z-10 mx-auto flex min-h-[180px] max-w-7xl items-center justify-between px-8">
    <div>
      <p className="text-sm font-bold leading-6 text-[#07395d]">
        Knowledge
        <br />
        Guidance
        <br />
        Righteous Future
      </p>
    </div>

    <div className="text-right">
      <p
        dir="rtl"
        className="text-3xl font-bold text-teal-700"
      >
        رَبِّ زِدْنِي عِلْمًا
      </p>

      <p className="mt-2 text-xs text-[#35627a]">
        “My Lord, increase me in knowledge”
      </p>

      <p className="mt-1 text-[10px] font-semibold text-[#35627a]">
        (Quran 20:114)
      </p>
    </div>
  </div>

</section>
    </main>


  </div>
);
}
