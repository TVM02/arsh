"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import {
  Upload,
  Trash2,
  Plus,
  ImageIcon,
  Newspaper,
  Save,
  X,
  GripVertical,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import Header from "@/components/Header";
import { uploadFile } from "@/lib/storageService";
import ProtectedRoute from "@/components/ProtectedRoute";
import { authFetch } from "@/lib/authFetch";

/* ─── Toast ─────────────────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  return (
    <div
      className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium transition-all ${
        type === "success" ? "bg-teal-700" : "bg-red-600"
      }`}
    >
      {type === "success" ? (
        <CheckCircle className="w-4 h-4" />
      ) : (
        <AlertCircle className="w-4 h-4" />
      )}
      {msg}
      <button onClick={onClose}>
        <X className="w-4 h-4 opacity-70 hover:opacity-100" />
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   SECTION 1 — Hero Image Manager
─────────────────────────────────────────────────────────────────────────── */
function HeroImageManager({ toast }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newOrder, setNewOrder] = useState("0");
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileRef = useRef();

  const fetchImages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hero-images");
      const data = await res.json();
      if (Array.isArray(data.images)) setImages(data.images);
    } catch {
      toast("Failed to load hero images", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const uploadResult = await uploadFile(selectedFile, "hero-slider");
      const imageUrl = uploadResult.url;
      const res = await authFetch("/api/hero-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, order: parseInt(newOrder, 10) || 0 }),
      });
      if (!res.ok) throw new Error();
      toast("Image uploaded successfully", "success");
      setSelectedFile(null);
      setPreview(null);
      setNewOrder(String(images.length));
      if (fileRef.current) fileRef.current.value = "";
      await fetchImages();
    } catch {
      toast("Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this hero image?")) return;
    try {
      await authFetch(`/api/hero-images/${id}`, { method: "DELETE" });
      toast("Image deleted", "success");
      await fetchImages();
    } catch {
      toast("Delete failed", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-teal-600" />
          Upload New Hero Image
        </h3>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            className="flex-1 border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors"
          >
            {preview ? (
              <div className="relative w-full h-36">
                <Image
                  src={preview}
                  alt="Preview"
                  fill
                  className="object-contain rounded-lg"
                />
              </div>
            ) : (
              <>
                <ImageIcon className="w-8 h-8 text-gray-300" />
                <p className="text-sm text-gray-500">Click to select image</p>
                <p className="text-xs text-gray-400">
                  JPEG, PNG, WebP — max 10 MB
                </p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Order + save */}
          <div className="flex flex-col gap-3 justify-center min-w-[160px]">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Display Order
            </label>
            <input
              type="number"
              min={0}
              value={newOrder}
              onChange={(e) => setNewOrder(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="bg-teal-700 hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {uploading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {uploading ? "Uploading…" : "Save Image"}
            </button>
          </div>
        </div>
      </div>

      {/* Image list */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-teal-600" />
          Current Hero Images ({images.length})
        </h3>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-video bg-gray-100 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : images.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No hero images uploaded yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-video bg-gray-100 rounded-xl overflow-hidden border border-gray-200"
              >
                <Image
                  src={img.imageUrl}
                  alt={`Slide ${img.order}`}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => handleDelete(img.id)}
                    className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                  #{img.order}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   SECTION 2 — News Manager
─────────────────────────────────────────────────────────────────────────── */
const CATEGORIES = [
  "General",
  "Announcement",
  "Conference",
  "Technology",
  "Event",
];

const EMPTY_FORM = {
  title: "",
  description: "",
  date: new Date().toISOString().split("T")[0],
  category: "General",
  image: "",
};

function NewsManager({ toast }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef();

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/news?limit=50");
      const data = await res.json();
      if (Array.isArray(data.news)) setNews(data.news);
    } catch {
      toast("Failed to load news", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePublish = async () => {
    if (!form.title.trim()) {
      toast("Title is required", "error");
      return;
    }
    setPublishing(true);
    try {
      let imageUrl = form.image;
      if (imageFile) {
        const newsUpload = await uploadFile(imageFile, "dkju-news");
        imageUrl = newsUpload.url;
      }
      const res = await authFetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, image: imageUrl }),
      });
      if (!res.ok) throw new Error();
      toast("News published successfully", "success");
      resetForm();
      await fetchNews();
    } catch {
      toast("Failed to publish news", "error");
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this news article?")) return;
    try {
      await authFetch(`/api/news/${id}`, { method: "DELETE" });
      toast("News deleted", "success");
      await fetchNews();
    } catch {
      toast("Delete failed", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
          <Plus className="w-4 h-4 text-teal-600" />
          Create News Article
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Image upload */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors min-h-[140px]"
          >
            {imagePreview ? (
              <div className="relative w-full h-32">
                <Image
                  src={imagePreview}
                  alt="News preview"
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
            ) : (
              <>
                <Newspaper className="w-8 h-8 text-gray-300" />
                <p className="text-sm text-gray-500">Upload article image</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                Title *
              </label>
              <input
                type="text"
                placeholder="Article title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
            Description
          </label>
          <textarea
            rows={4}
            placeholder="Article description..."
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors"
          >
            {publishing ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {publishing ? "Publishing…" : "Publish"}
          </button>
          <button
            onClick={resetForm}
            className="border border-gray-200 hover:border-gray-300 text-gray-600 text-sm font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* News list */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-teal-600" />
          Published Articles ({news.length})
        </h3>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-gray-100 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : news.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No articles published yet.
          </p>
        ) : (
          <div className="space-y-3">
            {news.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 relative">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Newspaper className="w-5 h-5 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {item.date} &bull; {item.category}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   PAGE
─────────────────────────────────────────────────────────────────────────── */
const TABS = [
  { id: "hero", label: "Hero Images", icon: ImageIcon },
  { id: "news", label: "News", icon: Newspaper },
];

export default function CentralAccessPage() {
  const [activeTab, setActiveTab] = useState("hero");
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState("success");

  const showToast = (msg, type = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(""), 3500);
  };

  return (
    <ProtectedRoute requiredRole="central_admin">
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header />

        <Toast msg={toastMsg} type={toastType} onClose={() => setToastMsg("")} />

        {/* Page header */}
        <div className="bg-teal-800 text-white py-10 px-4">
          <div className="container mx-auto">
            <h1 className="text-2xl md:text-3xl font-bold mb-1">
              Central Access
            </h1>
            <p className="text-teal-200 text-sm">
              Manage homepage content — hero images and news articles
            </p>
          </div>
        </div>

        <main className="flex-1 container mx-auto px-4 py-8">
          {/* Tabs */}
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit mb-8">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === id
                    ? "bg-teal-700 text-white shadow-sm"
                    : "text-gray-600 hover:text-teal-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {activeTab === "hero" && <HeroImageManager toast={showToast} />}
          {activeTab === "news" && <NewsManager toast={showToast} />}
        </main>
      </div>
    </ProtectedRoute>
  );
}
