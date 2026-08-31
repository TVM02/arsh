"use client";

import { useState, useEffect, useCallback } from "react";
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
  Grid3X3,
  Minimize2,
} from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import { getYouTubeEmbedUrl, getVimeoEmbedUrl } from "@/lib/storageService";
import { toast } from "sonner";

export default function StudentSmartClassPage() {
  const { userData } = useAuthStore();
  const rawClassValue =
    userData?.classLevel ?? userData?.class ?? userData?.std ?? null;
  const studentClass = (() => {
    if (
      rawClassValue === null ||
      rawClassValue === undefined ||
      rawClassValue === ""
    )
      return null;
    const str = String(rawClassValue).trim();
    if (!str) return null;

    // UKG / ukg / U.K.G variants → canonical "Ukg"
    if (str.toUpperCase().replace(/\./g, "") === "UKG") return "Ukg";

    // LKG variants → canonical "LKG"
    if (str.toUpperCase().replace(/\./g, "") === "LKG") return "LKG";

    // Common formats: "Class 1" -> "1"
    const classPrefixMatch = str.match(/^Class\s+(\d{1,2})$/i);
    if (classPrefixMatch) return classPrefixMatch[1];

    // Numeric string/number: "1" / 1
    const numericMatch = str.match(/^\d{1,2}$/);
    if (numericMatch) return str;

    // Roman numerals commonly used in the app
    const romanMap = {
      I: "1",
      II: "2",
      III: "3",
      IV: "4",
      V: "5",
      VI: "6",
      VII: "7",
      VIII: "8",
      IX: "9",
      X: "10",
      XI: "11",
      XII: "12",
    };
    const upper = str.toUpperCase();
    if (romanMap[upper]) return romanMap[upper];

    // Last resort: extract the first number from the string.
    const anyDigits = str.match(/\b(\d{1,2})\b/);
    return anyDigits ? anyDigits[1] : null;
  })();

  const [activeTab, setActiveTab] = useState("syllabus");
  const [syllabusContent, setSyllabusContent] = useState([]);
  const [studyContent, setStudyContent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Enhanced content protection
  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
      toast.error("Right-click is disabled for content protection");
      return false;
    };

    const handleKeyDown = (e) => {
      // Disable common shortcuts including print, save, etc.
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "s": // Save
          case "p": // Print
          case "a": // Select all
          case "c": // Copy
          case "x": // Cut
          case "u": // View source
            e.preventDefault();
            toast.error("This action is disabled for content protection");
            return false;
        }
      }

      // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (
        e.key === "F12" ||
        (e.ctrlKey &&
          e.shiftKey &&
          (e.key === "I" || e.key === "J" || e.key === "C")) ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
        toast.error("Developer tools are disabled");
        return false;
      }

      // Escape key to exit full screen
      if (e.key === "Escape" && isFullScreen) {
        handleExitFullScreen();
      }
    };

    const handleSelectStart = (e) => {
      e.preventDefault();
      return false;
    };

    const handleDragStart = (e) => {
      e.preventDefault();
      return false;
    };

    // Prevent image/video dragging and right-click
    const preventMediaActions = (e) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("selectstart", handleSelectStart);
    document.addEventListener("dragstart", handleDragStart);

    // Add event listeners to all media elements
    const mediaElements = document.querySelectorAll("img, video, iframe");
    mediaElements.forEach((element) => {
      element.addEventListener("contextmenu", preventMediaActions);
      element.addEventListener("dragstart", preventMediaActions);
    });

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("selectstart", handleSelectStart);
      document.removeEventListener("dragstart", handleDragStart);

      mediaElements.forEach((element) => {
        element.removeEventListener("contextmenu", preventMediaActions);
        element.removeEventListener("dragstart", preventMediaActions);
      });
    };
  }, [isFullScreen]);

  const handleEnterFullScreen = (content) => {
    setSelectedContent(content);

    // Small delay to ensure state is updated before entering fullscreen
    setTimeout(() => {
      const element = document.documentElement;
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
      setIsFullScreen(true);
    }, 100);
  };

  const handleExitFullScreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    setIsFullScreen(false);
    setSelectedContent(null);
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullScreenChange = () => {
      const fullscreen = !!document.fullscreenElement;
      setIsFullScreen(fullscreen);
      if (!fullscreen) {
        setSelectedContent(null);
      }
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullScreenChange);
    document.addEventListener("mozfullscreenchange", handleFullScreenChange);
    document.addEventListener("MSFullscreenChange", handleFullScreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullScreenChange,
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullScreenChange,
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullScreenChange,
      );
    };
  }, []);

  const fetchContent = useCallback(async () => {
    if (!studentClass) return;

    setLoading(true);
    try {
      // Query with all UKG variants for backward-compat with old Firestore docs
      const classValues =
        studentClass === "Ukg" ? ["Ukg", "UKG", "ukg"] : [studentClass];

      const syllabusQuery = query(
        collection(db, "smartClassSyllabus"),
        where("class", "in", classValues),
      );

      const syllabusSnapshot = await getDocs(syllabusQuery);
      const syllabusData = syllabusSnapshot.docs.map((doc) => ({
        id: doc.id,
        section: "syllabus",
        ...doc.data(),
      }));

      const contentsQuery = query(
        collection(db, "smartClassContents"),
        where("class", "in", classValues),
      );

      const contentsSnapshot = await getDocs(contentsQuery);
      const contentsData = contentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        section: "contents",
        ...doc.data(),
      }));

      const byCreatedDesc = (a, b) => {
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
      };

      setSyllabusContent([...syllabusData].sort(byCreatedDesc));
      setStudyContent([...contentsData].sort(byCreatedDesc));
    } catch (error) {
      console.error("Error fetching content:", error);
      toast.error("Failed to load content");
    } finally {
      setLoading(false);
    }
  }, [studentClass]);

  useEffect(() => {
    if (studentClass) {
      fetchContent();
    }
  }, [studentClass, fetchContent]);

  // NOTE: studentClass already updates when userData changes.

  const getCurrentContent = () => {
    if (activeTab === "all") {
      return [...syllabusContent, ...studyContent].sort((a, b) => {
        const dateA = new Date(a.createdAt?.seconds * 1000 || a.createdAt);
        const dateB = new Date(b.createdAt?.seconds * 1000 || b.createdAt);
        return dateB - dateA;
      });
    }
    return activeTab === "syllabus" ? syllabusContent : studyContent;
  };

  // Enhanced media protection component
  const ProtectedMedia = ({ file, type }) => {
    const [isLoading, setIsLoading] = useState(true);

    const handleMediaLoad = () => {
      setIsLoading(false);
    };

    if (type === "image") {
      return (
        <div className="relative flex justify-center">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
          )}
          <img
            src={file.url}
            alt={file.originalName}
            className="max-w-full h-auto rounded-lg shadow-2xl"
            style={{
              maxHeight: "85vh",
              display: isLoading ? "none" : "block",
            }}
            onLoad={handleMediaLoad}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          />
        </div>
      );
    }

    if (type === "video") {
      const youTubeEmbedUrl = getYouTubeEmbedUrl(file.url);
      const vimeoEmbedUrl = getVimeoEmbedUrl(file.url);

      return (
        <div className="w-full max-w-6xl mx-auto bg-black rounded-xl overflow-hidden shadow-2xl">
          {youTubeEmbedUrl ? (
            <iframe
              src={youTubeEmbedUrl}
              className="w-full h-[70vh]"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              frameBorder="0"
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : vimeoEmbedUrl ? (
            <iframe
              src={vimeoEmbedUrl}
              className="w-full h-[70vh]"
              allowFullScreen
              frameBorder="0"
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : (
            <video
              controls
              className="w-full h-[70vh]"
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              onContextMenu={(e) => e.preventDefault()}
            >
              <source src={file.url} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          )}
        </div>
      );
    }

    if (type === "pdf") {
      return (
        <div className="w-full max-w-6xl mx-auto h-[85vh] rounded-xl shadow-2xl overflow-hidden">
          <iframe
            src={`${file.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            className="w-full h-full"
            title={file.originalName}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      );
    }

    return null;
  };

  // Full Screen Content Viewer Component
  const FullScreenViewer = () => {
    if (!selectedContent || !isFullScreen) return null;

    return (
      <div className="fixed inset-0 bg-white z-50 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 truncate">
                {selectedContent.title}
              </h1>
              {selectedContent.description && (
                <p className="text-gray-600 mt-1 truncate">
                  {selectedContent.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 ml-4">
              <Badge variant="secondary" className="text-sm">
                {selectedContent.section === "syllabus"
                  ? "Syllabus"
                  : "Study Content"}
              </Badge>
              <Button
                variant="outline"
                onClick={handleExitFullScreen}
                className="flex items-center gap-2"
                size="lg"
              >
                <Minimize2 className="h-4 w-4" />
                Exit Fullscreen
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleExitFullScreen}
                className="h-10 w-10"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto p-4 space-y-8">
          {selectedContent.files ? (
            selectedContent.files.map((file, index) => (
              <div key={index} className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  {file.type === "image" && (
                    <Book className="h-5 w-5 text-blue-600" />
                  )}
                  {file.type === "pdf" && (
                    <FileText className="h-5 w-5 text-red-600" />
                  )}
                  {file.type === "video" && (
                    <Video className="h-5 w-5 text-green-600" />
                  )}
                  <span className="text-lg font-semibold text-gray-800">
                    {file.originalName}
                  </span>
                  <Badge variant="outline" className="text-sm">
                    {file.type === "image"
                      ? "Image"
                      : file.type === "video"
                        ? "Video"
                        : "PDF"}
                  </Badge>
                </div>
                <ProtectedMedia file={file} type={file.type} />
              </div>
            ))
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                {selectedContent.fileType === "image" && (
                  <Book className="h-5 w-5 text-blue-600" />
                )}
                {selectedContent.fileType === "pdf" && (
                  <FileText className="h-5 w-5 text-red-600" />
                )}
                {selectedContent.fileType === "video" && (
                  <Video className="h-5 w-5 text-green-600" />
                )}
                <span className="text-lg font-semibold text-gray-800">
                  {selectedContent.originalName || selectedContent.title}
                </span>
              </div>
              <ProtectedMedia
                file={{
                  url: selectedContent.fileUrl,
                  originalName:
                    selectedContent.originalName || selectedContent.title,
                }}
                type={selectedContent.fileType}
              />
            </div>
          )}
        </div>

        {/* Watermark */}
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3e%3ctext x='50%25' y='50%25' font-family='Arial' font-size='24' fill='rgba(13,148,136,0.05)' text-anchor='middle' dominant-baseline='middle' transform='rotate(-45 100 100)'%3eDKJU Smart Class%3c/text%3e%3c/svg%3e\")",
            backgroundRepeat: "repeat",
            backgroundSize: "300px 300px",
          }}
        />
      </div>
    );
  };

  return (
    <>
      <style jsx global>{`
        body {
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        /* Enhanced protection styles */
        * {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -khtml-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }

        img,
        video,
        iframe,
        canvas,
        svg {
          -webkit-user-drag: none;
          -khtml-user-drag: none;
          -moz-user-drag: none;
          -o-user-drag: none;
          user-drag: none;
          pointer-events: none;
        }

        /* Allow controls for video and iframe */
        video::-webkit-media-controls,
        iframe[src*="pdf"],
        iframe[src*="youtube"],
        iframe[src*="vimeo"] {
          pointer-events: auto !important;
        }

        /* Full screen styles */
        :fullscreen {
          background: white;
        }

        :-webkit-full-screen {
          background: white;
        }

        :-moz-full-screen {
          background: white;
        }

        :-ms-fullscreen {
          background: white;
        }

        @media print {
          body * {
            display: none !important;
          }
        }
      `}</style>

      <Layout>
        {/* Full Screen Viewer */}
        <FullScreenViewer />

        {/* Main Content (Hidden when in fullscreen) */}
        <div
          className={`space-y-4 md:space-y-6 ${isFullScreen ? "hidden" : "block"}`}
        >
          {/* Header */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              Smart Class
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Access Madrasa syllabus and study materials
            </p>
          </div>

          {/* Student Class Info */}
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-xl flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-teal-600" />
                Your Class Content
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              {studentClass ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Enrolled Class:</span>
                  <Badge variant="default" className="text-lg px-3 py-1">
                    {`Class ${studentClass}`}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No class information available. Please contact admin.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Content Grid */}
          {studentClass ? (
            <Card>
              <CardHeader className="p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="text-lg md:text-xl">
                    {`Class ${studentClass}`} Study Materials
                    {!loading && (
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        (
                        {activeTab === "all"
                          ? syllabusContent.length + studyContent.length
                          : activeTab === "syllabus"
                            ? syllabusContent.length
                            : studyContent.length}{" "}
                        items)
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant={activeTab === "all" ? "default" : "outline"}
                      onClick={() => setActiveTab("all")}
                      className="flex items-center gap-2 min-h-[44px] text-sm md:text-base"
                    >
                      <Grid3X3 className="h-4 w-4" />
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
                      Study Content
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                {loading ? (
                  <div className="text-center py-8 text-sm md:text-base">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
                    Loading{" "}
                    {activeTab === "all"
                      ? "all content"
                      : activeTab === "syllabus"
                        ? "syllabus"
                        : "study content"}
                    ...
                  </div>
                ) : getCurrentContent().length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm md:text-base">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>
                      No{" "}
                      {activeTab === "all"
                        ? "content"
                        : activeTab === "syllabus"
                          ? "syllabus"
                          : "study content"}{" "}
                      available for Class {studentClass} yet.
                    </p>
                    <p className="text-xs mt-2">
                      Content will be added by the administration.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getCurrentContent().map((content) => (
                      <Card
                        key={content.id}
                        className="border border-gray-200 hover:shadow-md transition-shadow cursor-pointer group"
                        onClick={() => handleEnterFullScreen(content)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              {content.files ? (
                                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                                  <FileText className="h-5 w-5 text-purple-600" />
                                </div>
                              ) : content.fileType === "image" ? (
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                  <FileText className="h-5 w-5 text-blue-600" />
                                </div>
                              ) : content.fileType === "video" ? (
                                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                                  <Video className="h-5 w-5 text-green-600" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                                  <FileText className="h-5 w-5 text-red-600" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-gray-900 truncate text-sm md:text-base group-hover:text-teal-700 transition-colors">
                                {content.title}
                              </h3>
                              {content.description && (
                                <p className="text-xs md:text-sm text-gray-600 mt-1 line-clamp-2">
                                  {content.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {activeTab === "all" && (
                                  <Badge
                                    variant={
                                      content.section === "syllabus"
                                        ? "default"
                                        : "secondary"
                                    }
                                    className="text-xs"
                                  >
                                    {content.section === "syllabus"
                                      ? "Syllabus"
                                      : "Content"}
                                  </Badge>
                                )}
                                {content.files ? (
                                  content.files
                                    .slice(0, 2)
                                    .map((file, index) => (
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
                                        {content.files.length > 2 &&
                                          index === 1 &&
                                          ` +${content.files.length - 2}`}
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
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <GraduationCap className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-600">
                  No class assigned to your account.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Please contact the administration to get assigned to a class.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    </>
  );
}
