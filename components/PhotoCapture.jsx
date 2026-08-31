"use client";
import React, { useRef, useState, useEffect } from "react";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Upload, Loader2, CheckCircle } from "lucide-react";

const CameraCapture = ({ onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [stream, setStream] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState(null);

  const dataURLtoFile = (dataurl, filename) => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const savePhotoToStorage = async () => {
    if (!photo) return;

    setIsUploading(true);
    try {
      const file = dataURLtoFile(photo, `captured-photo-${Date.now()}.png`);

      // Upload to Firebase Storage
      const timestamp = Date.now();
      const fileName = `captured-photos/${timestamp}_${file.name}`;
      const storageRef = ref(storage, fileName);

      const snapshot = await uploadBytes(storageRef, file, {
        contentDisposition: "attachment",
      });
      const downloadURL = await getDownloadURL(snapshot.ref);

      setUploadedUrl(downloadURL);
      if (onCapture) onCapture(downloadURL);
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert(`Failed to save photo: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      setStream(mediaStream);
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("Camera access denied or not available.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      alert("Video not ready. Please wait for camera to load.");
      return;
    }

    const context = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/png");
    setPhoto(dataUrl);

    // Stop camera after capturing photo
    stopCamera();
  };

  const retakePhoto = () => {
    setPhoto(null);
    setUploadedUrl(null);
    startCamera();
  };

  // Handle video stream setup
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg ">
      {!photo ? (
        // Camera View
        <div className="space-y-4">
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg border-2 border-teal-200"
            />
          ) : (
            <div className="w-full h-64 bg-teal-50 rounded-lg flex items-center justify-center border-2 border-teal-200">
              <span className="text-teal-600">Camera not started</span>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            {stream ? (
              <button
                onClick={capturePhoto}
                className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Capture
              </button>
            ) : (
              <button
                onClick={startCamera}
                className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Start Camera
              </button>
            )}
          </div>
        </div>
      ) : (
        // Photo Review View
        <div className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt="Captured"
            className="w-full rounded-lg border-2 border-teal-200"
          />

          <div className="flex gap-3 justify-center">
            {!uploadedUrl ? (
              <button
                onClick={savePhotoToStorage}
                disabled={isUploading}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white transition-colors ${
                  isUploading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-teal-500 hover:bg-teal-600"
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload
                  </>
                )}
              </button>
            ) : (
              <span className="flex items-center gap-1 text-teal-600 font-medium">
                <CheckCircle className="h-4 w-4" />
                Upload Successful!
              </span>
            )}

            <button
              onClick={retakePhoto}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Retake
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

export default CameraCapture;
