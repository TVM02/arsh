import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export async function uploadInspectionFilesToStorage(files, step) {
  const fileArray = Array.from(files || []);
  const uploadedFiles = [];
  const errors = [];

  for (const file of fileArray) {
    if (!file) continue;

    if (!ALLOWED_TYPES.includes(file.type)) {
      errors.push(`${file.name}: Only JPG, PNG, and PDF files are allowed`);
      continue;
    }

    if (file.size > MAX_SIZE_BYTES) {
      errors.push(`${file.name}: File size must be less than 10MB`);
      continue;
    }

    const timestamp = Date.now();
    const sanitizedName = String(file.name || "file").replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );

    const fileName = `inspections/${step}-forms/${timestamp}_${sanitizedName}`;

    const storageRef = ref(storage, fileName);
    try {
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type,
        contentDisposition: "attachment",
      });
      const downloadURL = await getDownloadURL(snapshot.ref);

      uploadedFiles.push({
        name: file.name,
        url: downloadURL,
        type: file.type,
        size: file.size,
        uploadedAt: new Date(),
        storagePath: snapshot.ref.fullPath,
      });
    } catch (error) {
      console.error(`Error uploading ${file.name}:`, error);
      errors.push(`Failed to upload ${file.name}: Something went wrong`);
    }
  }

  return { uploadedFiles, errors };
}
