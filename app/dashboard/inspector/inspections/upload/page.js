"use client";

import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InspectorLayout from "@/components/InspectorLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { uploadInspectionFilesToStorage } from "@/lib/inspectionUpload";
import { db } from "@/lib/firebase";
import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

const STEP_META = {
  madarsa: { title: "Madrasa Form", stepKey: "madarsa" },
  management: { title: "Management Form", stepKey: "management" },
  sadar: { title: "Sadar Info/Form", stepKey: "sadar" },
};

function InspectionMobileUploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sessionId = searchParams.get("sessionId") || "";

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const draftId = searchParams.get("draft") || "";
  const stepParam = searchParams.get("step") || "";

  // If a new-style sessionId is provided, redirect to the dedicated mobile route.
  // This keeps old links working while allowing a clean, public /mobile-upload endpoint.
  useEffect(() => {
    if (!sessionId) return;
    router.replace(`/mobile-upload?sessionId=${encodeURIComponent(sessionId)}`);
  }, [router, sessionId]);

  const stepInfo = useMemo(() => STEP_META[stepParam] || null, [stepParam]);

  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const handleUpload = async (files) => {
    if (!draftId || !stepInfo) return;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const draftRef = doc(db, "inspections", draftId);
      const snap = await getDoc(draftRef);
      if (!snap.exists()) {
        toast.error("Draft not found. Please reopen QR from desktop.");
        return;
      }

      const { uploadedFiles, errors } = await uploadInspectionFilesToStorage(
        files,
        stepInfo.stepKey,
      );
      errors.forEach((m) => toast.error(m));

      if (uploadedFiles.length === 0) return;

      const field = `${stepInfo.stepKey}FormFiles`;
      await updateDoc(draftRef, {
        [field]: arrayUnion(...uploadedFiles),
        updatedAt: serverTimestamp(),
      });

      setUploadedCount((c) => c + uploadedFiles.length);
      toast.success(`${uploadedFiles.length} file(s) uploaded`);
    } catch (error) {
      console.error("Mobile upload failed:", error);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const isValid = Boolean(draftId && stepInfo);

  return (
    <InspectorLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Mobile Upload</h1>
            <p className="text-sm text-gray-600">
              Upload files for:{" "}
              <span className="font-medium">{stepInfo?.title || "—"}</span>
            </p>
          </div>
        </div>

        {!isValid ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Invalid upload link. Please scan the QR again from the desktop
              inspection page.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Documents & Images
                </CardTitle>
                <CardDescription>
                  Scan QR → choose Take Photo or Upload File. JPG/PNG/PDF up to
                  10MB each.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div className="text-xs text-gray-500">
                  Draft: <span className="font-mono break-all">{draftId}</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </InspectorLayout>
  );
}

export default function InspectionMobileUploadPage() {
  return (
    <Suspense fallback={
      <InspectorLayout>
        <div className="p-6">
          <div className="text-center py-8">Loading...</div>
        </div>
      </InspectorLayout>
    }>
      <InspectionMobileUploadContent />
    </Suspense>
  );
}
