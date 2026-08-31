"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Book,
  FileText,
  GraduationCap,
  BookOpen,
  Video,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getYouTubeEmbedUrl, getVimeoEmbedUrl } from "@/lib/storageService";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { toast } from "sonner";

const CLASS_LEVELS = [
  "Ukg",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
];

export default function TeacherSmartClassPage() {
  const { userData } = useAuthStore();
  const [selectedClass, setSelectedClass] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [syllabusContent, setSyllabusContent] = useState([]);
  const [studyContent, setStudyContent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewingContent, setViewingContent] = useState(null);
  const [viewingFileIndex, setViewingFileIndex] = useState(0);

  // Set default class from user data or first class
  useEffect(() => {
    if (userData?.classLevel) {
      // Normalise incoming classLevel to Ukg if it's any ukg variant
      const raw = userData.classLevel.replace("Class ", "");
      const norm = ["ukg", "UKG", "Ukg"].includes(raw) ? "Ukg" : raw;
      setSelectedClass(norm);
    } else {
      setSelectedClass(CLASS_LEVELS[0].replace("Class ", ""));
    }
  }, [userData]);

  const fetchContent = useCallback(async () => {
    if (!selectedClass) return;

    setLoading(true);
    try {
      let content = [];
      // Build query class values: handle all UKG variants for backward-compat
      const isUkg = ["Ukg", "UKG", "ukg"].includes(selectedClass);
      const classValues = isUkg ? ["Ukg", "UKG", "ukg"] : [selectedClass];

      if (activeTab === "all") {
        // Fetch from both collections
        const syllabusQuery = query(
          collection(db, "smartClassSyllabus"),
          where("class", "in", classValues),
        );

        const contentsQuery = query(
          collection(db, "smartClassContents"),
          where("class", "in", classValues),
        );

        const [syllabusSnapshot, contentsSnapshot] = await Promise.all([
          getDocs(syllabusQuery),
          getDocs(contentsQuery),
        ]);

        const syllabusData = syllabusSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          source: "syllabus",
        }));

        const contentsData = contentsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          source: "contents",
        }));

        content = [...syllabusData, ...contentsData].sort((a, b) => {
          const aTime = a.createdAt?.seconds
            ? a.createdAt.seconds * 1000
            : a.createdAt
              ? new Date(a.createdAt).getTime()
              : 0;
          const bTime = b.createdAt?.seconds
            ? b.createdAt.seconds * 1000
            : b.createdAt
              ? new Date(b.createdAt).getTime()
              : 0;
          return bTime - aTime;
        });

        setStudyContent(content);
      } else {
        const collectionName =
          activeTab === "syllabus"
            ? "smartClassSyllabus"
            : "smartClassContents";
        const contentQuery = query(
          collection(db, collectionName),
          where("class", "in", classValues),
        );

        const snapshot = await getDocs(contentQuery);
        const content = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => {
            const aTime = a.createdAt?.seconds
              ? a.createdAt.seconds * 1000
              : a.createdAt
                ? new Date(a.createdAt).getTime()
                : 0;
            const bTime = b.createdAt?.seconds
              ? b.createdAt.seconds * 1000
              : b.createdAt
                ? new Date(b.createdAt).getTime()
                : 0;
            return bTime - aTime;
          });

        //   console.log(content)

        if (activeTab === "syllabus") {
          setSyllabusContent(content);
        } else {
          setStudyContent(content);
        }
      }
    } catch (error) {
      console.error("Error fetching content:", error);
      toast.error("Failed to load content");
    } finally {
      setLoading(false);
    }
  }, [selectedClass, activeTab]);

  // Fetch content when class or tab changes
  useEffect(() => {
    if (selectedClass) {
      fetchContent();
    }
  }, [selectedClass, fetchContent]);

  const getVideoSrcForPreview = (url) => {
    return getYouTubeEmbedUrl(url) || getVimeoEmbedUrl(url) || url;
  };

  const getDocViewerUrl = (url) => {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  };

  const handleContentView = (content) => {
    setViewingFileIndex(0);
    setViewingContent(content);
  };

  const closeViewer = () => setViewingContent(null);

  // Block devtools / print / copy shortcuts while viewer is open
  useEffect(() => {
    if (!viewingContent) return;

    const block = (e) => {
      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) ||
        (e.ctrlKey && ["s", "S", "p", "P", "u", "U"].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
      // Esc closes the viewer
      if (e.key === "Escape") closeViewer();
    };

    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, [viewingContent]);

  const getCurrentContent = () => {
    return activeTab === "syllabus" ? syllabusContent : studyContent;
  };

  // Build the list of viewable items for the current content
  const getViewerItems = (content) => {
    if (!content) return [];
    if (content.files && content.files.length > 0) return content.files;
    // legacy single-file format
    return [
      {
        type: content.fileType,
        url: content.fileUrl,
        originalName: content.title,
      },
    ];
  };

  const viewerItems = getViewerItems(viewingContent);
  const currentItem = viewerItems[viewingFileIndex] || null;

  return (
    <Layout>
      {/* ── Fullscreen Content Viewer Overlay ── */}
      {viewingContent && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col bg-black"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          style={{ userSelect: "none", WebkitUserSelect: "none" }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-semibold text-teal-400 truncate">
                {viewingContent.title}
              </span>
              {viewerItems.length > 1 && (
                <span className="text-xs text-gray-400">
                  {viewingFileIndex + 1} / {viewerItems.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Prev / Next when multiple files */}
              {viewerItems.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setViewingFileIndex((i) => Math.max(0, i - 1))
                    }
                    disabled={viewingFileIndex === 0}
                    className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() =>
                      setViewingFileIndex((i) =>
                        Math.min(viewerItems.length - 1, i + 1),
                      )
                    }
                    disabled={viewingFileIndex === viewerItems.length - 1}
                    className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30"
                    aria-label="Next"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
              <button
                onClick={closeViewer}
                className="p-1.5 rounded hover:bg-red-600 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Watermark */}
          <div
            className="pointer-events-none select-none"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) rotate(-45deg)",
              fontSize: "64px",
              color: "rgba(255,255,255,0.04)",
              fontWeight: "bold",
              zIndex: 1,
              whiteSpace: "nowrap",
            }}
          >
            DKJU Smart Class
          </div>

          {/* Content area */}
          <div
            className="flex-1 overflow-hidden relative"
            style={{ zIndex: 2 }}
          >
            {currentItem ? (
              currentItem.type === "image" ? (
                <div className="h-full flex items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentItem.url}
                    alt={currentItem.originalName}
                    className="max-h-full max-w-full object-contain"
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                </div>
              ) : currentItem.type === "video" ? (
                <iframe
                  src={getVideoSrcForPreview(currentItem.url)}
                  title={currentItem.originalName}
                  className="w-full h-full border-0"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                />
              ) : (
                /* Wrap in relative container so we can overlay shields over
                   every Google Docs Viewer button (top toolbar, right-edge
                   "open in browser" arrow, bottom page-nav bar). */
                <div className="relative w-full h-full overflow-hidden">
                  <iframe
                    src={getDocViewerUrl(currentItem.url)}
                    title={currentItem.originalName}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                  />
                  {/* Shield: full-width top bar (Google Docs header + title row) */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "72px",
                      zIndex: 20,
                      cursor: "default",
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  {/* Shield: right-edge strip — covers the ↗ open-in-tab arrow that appears on hover */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      width: "72px",
                      height: "100%",
                      zIndex: 20,
                      cursor: "default",
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  {/* Shield: bottom bar (page number / zoom controls) */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      width: "100%",
                      height: "56px",
                      zIndex: 20,
                      cursor: "default",
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  {/* Shield: left-edge strip */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "72px",
                      height: "100%",
                      zIndex: 20,
                      cursor: "default",
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                </div>
              )
            ) : null}
          </div>

          {/* File tabs when multiple files */}
          {viewerItems.length > 1 && (
            <div className="flex gap-2 px-4 py-2 bg-gray-900 overflow-x-auto flex-shrink-0">
              {viewerItems.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setViewingFileIndex(i)}
                  className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                    i === viewingFileIndex
                      ? "bg-teal-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {f.originalName || `File ${i + 1}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            Smart Class
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Access Madrasa syllabus and teaching materials
          </p>
        </div>

        {/* Class Selection */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-teal-600" />
              Select Class
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {CLASS_LEVELS.map((classLevel) => (
                <Button
                  key={classLevel}
                  variant={
                    selectedClass === classLevel.replace("Class ", "")
                      ? "default"
                      : "outline"
                  }
                  onClick={() =>
                    setSelectedClass(classLevel.replace("Class ", ""))
                  }
                  className="min-h-[44px] text-sm md:text-base"
                >
                  {classLevel}
                </Button>
              ))}
            </div>
            {userData?.classLevel && (
              <div className="text-xs text-gray-500 mt-3">
                Your assigned class:{" "}
                <Badge variant="secondary">{userData.classLevel}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Tabs */}
        {selectedClass && (
          <Card>
            <CardHeader className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-lg md:text-xl">
                  {selectedClass} Content
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={activeTab === "all" ? "default" : "outline"}
                    onClick={() => setActiveTab("all")}
                    className="flex items-center gap-2 min-h-[44px] text-sm md:text-base"
                  >
                    <Book className="h-4 w-4" />
                    All
                  </Button>
                  <Button
                    variant={activeTab === "syllabus" ? "default" : "outline"}
                    onClick={() => setActiveTab("syllabus")}
                    className="flex items-center gap-2 min-h-[44px] text-sm md:text-base"
                  >
                    <Book className="h-4 w-4" />
                    Syllabus
                  </Button>
                  <Button
                    variant={activeTab === "contents" ? "default" : "outline"}
                    onClick={() => setActiveTab("contents")}
                    className="flex items-center gap-2 min-h-[44px] text-sm md:text-base"
                  >
                    <BookOpen className="h-4 w-4" />
                    Contents
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              {loading ? (
                <div className="text-center py-8 text-sm md:text-base">
                  Loading content...
                </div>
              ) : getCurrentContent().length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm md:text-base">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No items available for this class yet.</p>
                  <p className="text-xs mt-2">
                    Content will be added by the administration.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getCurrentContent().map((content) => (
                    <Card
                      key={content.id}
                      className="border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleContentView(content)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            {content.files ? (
                              // Multiple files - show mixed icon
                              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                <FileText className="h-5 w-5 text-purple-600" />
                              </div>
                            ) : content.fileType === "image" ? (
                              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <FileText className="h-5 w-5 text-blue-600" />
                              </div>
                            ) : content.fileType === "video" ? (
                              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <Video className="h-5 w-5 text-green-600" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                <FileText className="h-5 w-5 text-red-600" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-gray-900 truncate text-sm md:text-base">
                              {content.title}
                            </h3>
                            {content.description && (
                              <p className="text-xs md:text-sm text-gray-600 mt-1 line-clamp-2">
                                {content.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {content.files ? (
                                // Show multiple file type badges
                                content.files.map((file, index) => (
                                  <Badge
                                    key={index}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {file.type === "image"
                                      ? "Image"
                                      : file.type === "video"
                                        ? "Video"
                                        : "PDF"}
                                  </Badge>
                                ))
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  {content.fileType === "image"
                                    ? "Image"
                                    : content.fileType === "video"
                                      ? "Video"
                                      : "PDF"}
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500">
                                {new Date(
                                  content.createdAt?.seconds * 1000 ||
                                    content.createdAt,
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
