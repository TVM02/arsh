import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "./firebase";

/**
 * Upload file to Firebase Storage
 */
export const uploadFile = async (file, folder = "smart-class") => {
  if (!file) {
    throw new Error("No file provided for upload");
  }

  // Validate file size (25MB limit for PDFs, 10MB for images)
  const maxSize =
    file.type === "application/pdf" ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(
      `File size should be less than ${maxSize / (1024 * 1024)}MB`,
    );
  }

  // Upload images to Firebase Storage
  if (file.type.startsWith("image/")) {
    try {
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.name}`;
      const storageRef = ref(storage, `${folder}/images/${filename}`);

      const metadata = {
        contentType: file.type,
      };
      const snapshot = await uploadBytes(storageRef, file, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);

      return {
        url: downloadURL,
        type: "image",
        path: snapshot.ref.fullPath,
        originalName: file.name,
        size: file.size,
        storageType: "firebase",
      };
    } catch (error) {
      console.error("Error uploading image to Firebase Storage:", error);
      throw new Error("Failed to upload image. Please try again.");
    }
  }

  // Upload PDFs to Firebase Storage
  if (file.type === "application/pdf") {
    try {
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.name}`;
      const storageRef = ref(storage, `${folder}/pdfs/${filename}`);

      const metadata = { contentDisposition: "attachment" };
      const snapshot = await uploadBytes(storageRef, file, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);

      return {
        url: downloadURL,
        type: "pdf",
        path: snapshot.ref.fullPath,
        originalName: file.name,
        size: file.size,
        storageType: "firebase",
      };
    } catch (error) {
      console.error("Error uploading PDF to Firebase Storage:", error);
      throw new Error("Failed to upload PDF. Please try again.");
    }
  }

  throw new Error("Unsupported file type. Only images and PDFs are allowed.");
};

/**
 * Delete file from storage (Firebase Storage or Cloudinary)
 */
export const deleteFile = async (fileData) => {
  if (!fileData) return;

  try {
    if (fileData.storageType === "firebase" && fileData.path) {
      // Delete from Firebase Storage
      const fileRef = ref(storage, fileData.path);
      await deleteObject(fileRef);
    }
  } catch (error) {
    console.error("Error deleting file from storage:", error);
    // Don't throw error for deletion failures to avoid blocking other operations
  }
};

/**
 * Get file type from filename, MIME type, or URL
 */
export const getFileType = (file) => {
  if (typeof file === "string") {
    // It's a filename or URL
    if (file.toLowerCase().endsWith(".pdf")) return "pdf";
    if (file.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)) return "image";
    if (file.toLowerCase().match(/\.(mp4|avi|mov|wmv|flv|webm)$/))
      return "video";
    if (
      file.includes("youtube.com") ||
      file.includes("youtu.be") ||
      file.includes("vimeo.com")
    )
      return "video";
    return "unknown";
  }

  // It's a File object
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "unknown";
};

const parseTimeToSeconds = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);

  // Supports formats like 1h2m3s, 90s, 2m, 1m30s
  const re = /(\d+)(h|m|s)/gi;
  let total = 0;
  let match;
  while ((match = re.exec(trimmed)) !== null) {
    const n = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (Number.isNaN(n)) continue;
    if (unit === "h") total += n * 3600;
    if (unit === "m") total += n * 60;
    if (unit === "s") total += n;
  }
  return total > 0 ? total : null;
};

export const getYouTubeEmbedUrl = (inputUrl) => {
  try {
    if (!inputUrl || typeof inputUrl !== "string") return null;
    const url = new URL(inputUrl.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    let videoId = null;
    let playlistId = null;

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] || null;
    } else if (host.endsWith("youtube.com")) {
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v");
        playlistId = url.searchParams.get("list");
      } else if (url.pathname.startsWith("/shorts/")) {
        videoId = url.pathname.split("/")[2] || null;
      } else if (url.pathname.startsWith("/embed/")) {
        videoId = url.pathname.split("/")[2] || null;
      } else if (url.pathname.startsWith("/live/")) {
        videoId = url.pathname.split("/")[2] || null;
      } else if (url.pathname === "/playlist") {
        playlistId = url.searchParams.get("list");
      }
    }

    const params = new URLSearchParams();
    params.set("modestbranding", "1");
    params.set("rel", "0");

    const startFromT = parseTimeToSeconds(url.searchParams.get("t") || "");
    const startFromStart = parseTimeToSeconds(
      url.searchParams.get("start") || "",
    );
    const start = startFromStart ?? startFromT;
    if (typeof start === "number" && start > 0)
      params.set("start", String(start));

    if (videoId) {
      const base = `https://www.youtube-nocookie.com/embed/${videoId}`;
      return `${base}?${params.toString()}`;
    }

    // Playlist-only embeds
    if (playlistId) {
      const base = `https://www.youtube-nocookie.com/embed/videoseries`;
      params.set("list", playlistId);
      return `${base}?${params.toString()}`;
    }

    return null;
  } catch {
    return null;
  }
};

export const getVimeoEmbedUrl = (inputUrl) => {
  try {
    if (!inputUrl || typeof inputUrl !== "string") return null;
    const url = new URL(inputUrl.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.endsWith("vimeo.com")) return null;

    // Common formats: vimeo.com/123456789, player.vimeo.com/video/123456789
    const parts = url.pathname.split("/").filter(Boolean);
    let id = null;
    if (host === "player.vimeo.com" && parts[0] === "video") id = parts[1];
    else id = parts[0];

    if (!id || !/^\d+$/.test(id)) return null;
    return `https://player.vimeo.com/video/${id}?title=0&byline=0&portrait=0`;
  } catch {
    return null;
  }
};

/**
 * Validate video URL
 */
export const validateVideoUrl = (url) => {
  if (!url || typeof url !== "string") return false;

  // Check for common video platforms
  const videoPatterns = [
    /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)[\w-]+/,
    /^https?:\/\/(www\.)?vimeo\.com\/\d+/,
    /^https?:\/\/.*\.(mp4|avi|mov|wmv|flv|webm)$/i,
  ];

  return videoPatterns.some((pattern) => pattern.test(url));
};

const storageService = {
  uploadFile,
  deleteFile,
  getFileType,
  validateVideoUrl,
  getYouTubeEmbedUrl,
  getVimeoEmbedUrl,
};

export default storageService;
