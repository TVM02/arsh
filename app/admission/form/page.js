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
import { createDocument, COLLECTIONS } from "@/lib/firestoreService";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  GraduationCap,
  Upload,
  CheckCircle,
  CreditCard,
  Check,
  ChevronsUpDown,
  Camera,
  X,
  Loader2,
} from "lucide-react";
import admissionFormConfig from "@/data/admissionForm.json";
import configDropdowns from "@/data/configDropdowns.json";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";

// Load Razorpay script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function AdmissionForm() {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Show all errors as top-right toasts instead of inline banners
  useEffect(() => {
    if (error) {
      toast.error(error, { duration: 5000 });
    }
  }, [error]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [madarsas, setMahals] = useState([]);
  const [madarsasLoading, setMahalsLoading] = useState(false);
  const [madarsaSearchOpen, setMahalSearchOpen] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [videoRef, setVideoRef] = useState(null);
  const [stream, setStream] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [showAdmissions, setShowAdmissions] = useState(true);
  const [checkingSettings, setCheckingSettings] = useState(true);
  const [classAdmissionFees, setClassAdmissionFees] = useState({});
  const router = useRouter();

  const selectedClassValue = (formData?.class || "").toString().toLowerCase();
  // Look up the configured fee for the selected class; fallback to 20 INR
  // Case-insensitive: try lowercase key first, then capitalized (e.g. "ukg" and "Ukg")
  const payableAmountInr = (() => {
    if (!selectedClassValue) return 0;
    const capitalizedKey =
      selectedClassValue.charAt(0).toUpperCase() + selectedClassValue.slice(1);
    const fee =
      classAdmissionFees[selectedClassValue] ??
      classAdmissionFees[capitalizedKey];
    return Number.isFinite(Number(fee)) && Number(fee) >= 0 ? Number(fee) : 20;
  })();

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
        const feesMap = await getSetting("admissionFees", null);
        if (feesMap && typeof feesMap === "object" && !Array.isArray(feesMap)) {
          setClassAdmissionFees(feesMap);
        } else {
          // Legacy: build map from ukgAdmissionFee
          const ukgFeeRaw = await getSetting("ukgAdmissionFee", 100);
          const ukgFee =
            typeof ukgFeeRaw === "number" ? ukgFeeRaw : parseInt(ukgFeeRaw, 10);
          setClassAdmissionFees({
            ukg: Number.isFinite(ukgFee) ? ukgFee : 100,
          });
        }
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
    loadRazorpayScript().then((loaded) => {
      setRazorpayLoaded(loaded);
      if (!loaded) {
        console.error("Failed to load Razorpay script");
      }
    });

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

  const initiatePayment = async (admissionNum, submissionData) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (!razorpayLoaded || !window.Razorpay) {
          reject(new Error("Razorpay not loaded"));
          return;
        }

        // 🔑 get order from backend
        const res = await fetch("/api/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            admissionNum,
            studentClass: (submissionData?.class || "")
              .toString()
              .toLowerCase(),
          }),
        });

        // Check if the response is ok
        if (!res.ok) {
          const errorText = await res.text();
          console.error("API Error Response:", errorText);
          reject(
            new Error(
              `Failed to create order: ${res.status} ${res.statusText}`,
            ),
          );
          return;
        }

        // Check content type before parsing JSON
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const responseText = await res.text();
          console.error("Non-JSON response received:", responseText);
          reject(new Error("Invalid response format from server"));
          return;
        }

        let order;
        try {
          order = await res.json();
        } catch (jsonError) {
          console.error("JSON parsing error:", jsonError);
          const responseText = await res.text();
          console.error("Raw response:", responseText);
          reject(new Error("Failed to parse server response"));
          return;
        }

        // Check if the order creation was successful
        if (order.error) {
          reject(new Error(order.error));
          return;
        }

        // console.log("Order created:", order);

        const options = {
          key: process.env.NEXT_RAZORPAY_KEY_ID, // loaded from .env
          amount: order.amount, // from backend
          currency: order.currency,
          name: "DKJU - Admission Fee",
          description: `Admission Fee for ${
            submissionData.fullName || "Student"
          }`,
          order_id: order.id, // ✅ required
          prefill: {
            name: submissionData.fullName || "",
            email: submissionData.email || "",
            contact: submissionData.phone || "",
          },
          notes: {
            admission_number: admissionNum,
            purpose: "admission_fee",
          },
          theme: { color: "#0f766e" },

          // 🔥 Handler after payment is successful
          handler: async function (response) {
            try {
              // ✅ Payment is captured
              const paymentData = {
                ...submissionData,
                paymentId: response.razorpay_payment_id,
                orderId: order?.id || null,
                paymentStatus: "completed",
                paymentAmount: order.amount / 100, // convert paise → INR
                paymentMethod: "razorpay",
                paidAt: new Date().toISOString(),
              };

              resolve(paymentData);
            } catch (err) {
              reject(new Error("Payment verification error: " + err.message));
            }
          },

          modal: {
            ondismiss: function () {
              reject(new Error("Payment cancelled by user"));
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } catch (err) {
        reject(err);
      }
    });
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
        admissionNumber: admissionNum,
        status: "pending",
        submittedAt: new Date().toISOString(),
        paymentStatus: "pending",
      };

      // Remove preview data before saving
      delete submissionData.profileImagePreview;
      delete submissionData.profileImage;

      // Check if Razorpay is loaded
      if (!razorpayLoaded) {
        throw new Error(
          "Payment system not loaded. Please refresh and try again.",
        );
      }

      // Free admission (fee = 0) — skip Razorpay
      if (payableAmountInr === 0) {
        const freePaymentData = {
          ...submissionData,
          admissionNumber: admissionNum,
          status: "confirmed",
          submittedAt: new Date().toISOString(),
          paymentStatus: "free",
          paymentId: null,
          orderId: null,
          amount: 0,
          paymentAmount: 0,
        };
        await createDocument(COLLECTIONS.ADMISSIONS, freePaymentData);
        toast.success(
          "Application submitted! Redirecting to confirmation page...",
          { duration: 3000 },
        );
        sessionStorage.setItem(
          "admissionData",
          JSON.stringify(freePaymentData),
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        router.push(`/admission/confirmation?admissionNumber=${admissionNum}`);
        return;
      }

      // Initiate payment
      // Save pending admission to localStorage as backup in case Firestore write fails after payment
      const pendingKey = `pendingAdmission_${admissionNum}`;
      try {
        localStorage.setItem(
          pendingKey,
          JSON.stringify({
            ...submissionData,
            _pendingKey: pendingKey,
            _madarsaId: madarsaId,
          }),
        );
      } catch (e) {
        /* localStorage unavailable */
      }

      setPaymentProcessing(true);
      const paymentData = await initiatePayment(admissionNum, submissionData);

      // console.log(paymentData);

      // Save to Firestore with payment information
      try {
        await createDocument(COLLECTIONS.ADMISSIONS, paymentData);
        // Clear localStorage backup on successful Firestore save
        try {
          localStorage.removeItem(pendingKey);
        } catch (e) {}
      } catch (firestoreError) {
        console.error("Firestore save failed after payment:", firestoreError);
        // Keep localStorage backup — confirmation page will attempt recovery
        toast.error(
          `Payment was successful but application save failed. Your payment ID: ${paymentData?.paymentId || "unknown"}. Please contact the school admin.`,
          { duration: 8000 },
        );
        sessionStorage.setItem("admissionData", JSON.stringify(paymentData));
        await new Promise((resolve) => setTimeout(resolve, 2000));
        router.push(`/admission/confirmation?admissionNumber=${admissionNum}`);
        return;
      }

      // Show success toast
      toast.success("Payment successful! Redirecting to confirmation page...", {
        duration: 3000,
      });

      // Store data in sessionStorage for confirmation page
      sessionStorage.setItem("admissionData", JSON.stringify(paymentData));

      // Small delay to show toast before redirect
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Redirect to confirmation page
      router.push(`/admission/confirmation?admissionNumber=${admissionNum}`);
    } catch (error) {
      console.error("Submission error:", error);
      if (error.message === "Payment cancelled by user") {
        setError(
          "Payment was cancelled. Please try again to complete your admission.",
        );
      } else {
        setError(
          error.message || "Failed to submit application. Please try again.",
        );
      }
    } finally {
      setLoading(false);
      setPaymentProcessing(false);
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
        <Header />
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
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50">
      <Header />

      <div className="container mt-8 mx-auto px-4 max-w-4xl pb-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center">
              <GraduationCap className="h-7 w-7 text-white" />
            </div>
            <span className="text-3xl font-bold text-teal-800">
              {admissionFormConfig.title}
            </span>
          </div>
          <p className="text-gray-600 text-lg">
            {admissionFormConfig.description}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {admissionFormConfig.sections.map((section) => (
            <Card key={section.id} className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-xl text-teal-800">
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {section.fields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label
                      htmlFor={field.id}
                      className="text-sm font-medium text-gray-600"
                    >
                      {field.label}
                      {field.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </Label>
                    {renderField(field)}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          {/* Profile Picture Upload Section */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-xl text-teal-800">
                Profile Picture
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label className="text-sm font-medium text-gray-600">
                  Upload Profile Picture <span className="text-red-500">*</span>
                </Label>

                {/* File Input and Camera Options */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-4 flex-wrap gap-2">
                    <input
                      type="file"
                      id="profileImage"
                      accept="image/*"
                      onChange={handleProfileImageChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="profileImage"
                      className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </label>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={showCamera ? stopCamera : startCamera}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {showCamera ? "Cancel Camera" : "Take Photo"}
                    </Button>
                  </div>

                  {formData.profileImage && (
                    <span className="text-sm text-gray-600">
                      Selected: {formData.profileImage.name}
                    </span>
                  )}
                </div>

                {/* Camera View */}
                {showCamera && (
                  <div className="space-y-4 p-4 border-2 border-gray-200 rounded-lg bg-gray-50">
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-gray-700 mb-4">
                        Camera
                      </h3>
                      <div className="relative w-full max-w-md mx-auto">
                        <video
                          ref={setVideoElement}
                          autoPlay
                          playsInline
                          className="w-full h-64 bg-black rounded-lg object-cover"
                        />
                      </div>
                      <div className="flex justify-center space-x-4 mt-4">
                        <Button
                          type="button"
                          onClick={capturePhoto}
                          disabled={capturing}
                          className="bg-teal-600 hover:bg-teal-700 text-white"
                        >
                          {capturing ? "Capturing..." : "Capture Photo"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={stopCamera}
                          className="border-gray-300 text-gray-600 hover:bg-gray-50"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Close Camera
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload Progress */}
                {uploading && (
                  <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-700 font-medium">
                        Uploading image to cloud storage...
                      </span>
                      <span className="text-blue-600 font-semibold">
                        {uploadProgress}%
                      </span>
                    </div>
                    <Progress value={uploadProgress} className="w-full h-2" />
                    <div className="text-xs text-blue-600">
                      {uploadProgress < 30 && "Preparing upload..."}
                      {uploadProgress >= 30 &&
                        uploadProgress < 80 &&
                        "Uploading to server..."}
                      {uploadProgress >= 80 &&
                        uploadProgress < 100 &&
                        "Processing image..."}
                      {uploadProgress === 100 && "Upload complete!"}
                    </div>
                  </div>
                )}

                {/* Image Preview */}
                {formData.profileImagePreview && !uploading && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-600">
                      Preview:
                    </Label>
                    <div className="flex items-center space-x-4">
                      <div className="relative w-24 h-24 border-2 border-gray-200 rounded-lg overflow-hidden">
                        <Image
                          src={formData.profileImagePreview}
                          alt="Profile preview"
                          fill
                          className="object-cover"
                          sizes="100px"
                        />
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-600">
                            Image selected successfully
                          </span>
                          {formData.profilePictureUrl && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                              ✓ Uploaded to Cloud
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600">
                          File size:{" "}
                          {formData.profileImage
                            ? (
                                formData.profileImage.size /
                                1024 /
                                1024
                              ).toFixed(2)
                            : 0}{" "}
                          MB
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Supported formats: JPG, PNG, GIF, WebP. Maximum file size:
                  10MB.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card className="shadow-lg border-0 bg-gradient-to-r from-teal-50 to-blue-50">
            <CardHeader>
              <CardTitle className="text-xl text-teal-800 flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white p-6 rounded-lg border border-teal-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      Admission Fee
                    </h3>
                    <p className="text-gray-600">One-time registration fee</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-teal-600">
                      ₹{payableAmountInr}
                    </div>
                    <div className="text-sm text-gray-500">
                      Including all taxes
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <span>✓ Secure payment powered by Razorpay</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <span>✓ Multiple payment options available</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <span>✓ Instant confirmation after payment</span>
                  </div>
                </div>
              </div>

              {!razorpayLoaded && (
                <Alert>
                  <AlertDescription>
                    Loading payment system... Please wait.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button
              type="submit"
              size="lg"
              className="bg-teal-600 hover:bg-teal-700 text-white px-12 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                loading || uploading || paymentProcessing || !razorpayLoaded
              }
            >
              {uploading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {loading
                ? "Processing..."
                : uploading
                  ? "Uploading Image..."
                  : paymentProcessing
                    ? "Processing Payment..."
                    : `Pay ₹${payableAmountInr} & Submit Application`}
            </Button>
          </div>
        </form>
      </div>
      <div className="flex items-center mb-4 justify-center px-8 py-4 space-x-4 bg-teal-900">
        <span className="text-sm text-white">
          {"Contact technical Support : 8891177850"}
        </span>
      </div>
      <Footer />
    </div>
  );
}
