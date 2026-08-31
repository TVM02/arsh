"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";

const STEP_META = {
  madarsa: { title: "Madrasa Form", stepKey: "madarsa" },
  management: { title: "Management Form", stepKey: "management" },
  sadar: { title: "Sadar Info/Form", stepKey: "sadar" },
  "manager-docs": { title: "Manager Document", stepKey: "manager-docs" },
  "tc-request": { title: "TC Request Document", stepKey: "tc-request" },
};

export default function MobileUploadPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [sessionStatus, setSessionStatus] = useState("loading");
  const [sessionStep, setSessionStep] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const stepInfo = useMemo(() => {
    if (!sessionStep) return null;
    return STEP_META[sessionStep] || null;
  }, [sessionStep]);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (!sessionId) {
        setSessionStatus("invalid");
        return;
      }

      setSessionStatus("loading");
      try {
        // Read session directly from Firestore — no admin SDK required.
        const snap = await getDoc(doc(db, "mobileUploadSessions", sessionId));
        if (cancelled) return;

        if (!snap.exists()) {
          setSessionStatus("invalid");
          return;
        }

        const session = snap.data() || {};
        const expiresAt = session.expiresAt?.toDate?.();
        if (!expiresAt || new Date() > expiresAt) {
          setSessionStatus("expired");
          return;
        }
        // Accept both "active" and "uploaded" — user may reload after a prior upload.
        if (session.status !== "active" && session.status !== "uploaded") {
          setSessionStatus("invalid");
          return;
        }

        setSessionStep(session.step || null);
        setSessionStatus("ready");
      } catch (e) {
        console.error(e);
        if (!cancelled) setSessionStatus("error");
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  /**
   * Compress an image file using a canvas to:
   *  - Reduce size well below typical nginx 1 MB body limits
   *  - Normalise the MIME type to image/jpeg (avoids HEIC / blank-type rejections)
   *  - Cap the longer dimension at 1920 px for reasonable quality
   */
  const compressImage = (file) =>
    new Promise((resolve, reject) => {
      const MAX_DIM = 1920;
      const QUALITY = 0.82;

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas compression failed"));
              return;
            }
            // Keep a sane filename with .jpg extension
            const baseName = (file.name || "photo").replace(/\.[^.]+$/, "");
            resolve(
              new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }),
            );
          },
          "image/jpeg",
          QUALITY,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image load failed during compression"));
      };
      img.src = url;
    });

  const handleUpload = async (files) => {
    if (!sessionId || !stepInfo) return;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const fileArray = Array.from(files);
      let successCount = 0;

      for (const rawFile of fileArray) {
        // Compress / normalise images so MIME type is always image/jpeg
        // and the file is small enough for any upstream body-size limit.
        let file = rawFile;
        let inferredType = rawFile.type;

        if (!inferredType) {
          const lowerName = (rawFile.name || "").toLowerCase();
          if (lowerName.endsWith(".pdf")) inferredType = "application/pdf";
          else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) inferredType = "image/jpeg";
          else if (lowerName.endsWith(".png")) inferredType = "image/png";
        }

        if (inferredType.startsWith("image/") || inferredType === "") {
          try {
            file = await compressImage(rawFile);
            inferredType = "image/jpeg"; // compressImage always outputs jpeg
          } catch (compressErr) {
            console.warn(
              "Compression failed, uploading original:",
              compressErr,
            );
            // Fall back to original; MIME type might still be wrong but we try.
          }
        }

        // Use the secure server API route which works without phone authentication
        const formData = new FormData();
        formData.append("sessionId", sessionId);
        formData.append("file", file);

        const response = await fetch("/api/mobile-upload/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          let errText = "Unknown error";
          try {
            const data = await response.json();
            errText = data.error || errText;
          } catch {
            errText = await response.text();
          }
          throw new Error(errText);
        }

        successCount += 1;
      }

      setUploadedCount((c) => c + successCount);
      toast.success(`${successCount} file(s) uploaded`);
    } catch (error) {
      console.error("Mobile upload failed:", error);
      toast.error("Failed to load, something went wrong. Please try again.");

      if (
        String(error?.message || "")
          .toLowerCase()
          .includes("expired")
      ) {
        setSessionStatus("expired");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Mobile Upload</h1>
          <p className="text-sm text-gray-600">
            Scan QR → Take Photo or Upload File
          </p>
        </div>

        {sessionStatus !== "ready" ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {sessionStatus === "loading"
                ? "Loading upload session…"
                : sessionStatus === "expired"
                  ? "This upload link has expired. Please rescan a new QR from desktop."
                  : sessionStatus === "invalid"
                    ? "Invalid upload link. Please scan the QR again from desktop."
                    : "Could not load session. Please try again."}
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Documents & Images
              </CardTitle>
              <CardDescription>
                Upload for:{" "}
                <span className="font-medium">{stepInfo?.title}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  disabled={uploading}
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full"
                >
                  Take Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  Upload File
                </Button>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                disabled={uploading}
                onChange={(e) => handleUpload(e.target.files)}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                multiple
                disabled={uploading}
                onChange={(e) => handleUpload(e.target.files)}
                className="hidden"
              />

              {uploadedCount > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Uploaded in this session: <strong>{uploadedCount}</strong>
                    <br />
                    You can close this page and continue on desktop.
                  </AlertDescription>
                </Alert>
              )}


            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
