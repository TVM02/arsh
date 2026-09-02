"use client";

import { useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Youtube,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

function YouTubePlayer({
  videoId,
  title,
  onPlay,
  onPauseOrEnd,
}) {
  const playerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!videoId) return;

    let isMounted = true;

    const createPlayer = () => {
      if (
        !isMounted ||
        !containerRef.current ||
        !window.YT?.Player
      ) {
        return;
      }

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.log(error);
        }
      }

      playerRef.current = new window.YT.Player(
        containerRef.current,
        {
          videoId,

          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },

          events: {
            onStateChange: (event) => {
              if (!window.YT?.PlayerState) return;

              // Video started
              if (
                event.data ===
                window.YT.PlayerState.PLAYING
              ) {
                onPlay?.();
              }

              // Video paused
              if (
                event.data ===
                window.YT.PlayerState.PAUSED
              ) {
                onPauseOrEnd?.();
              }

              // Video finished
              if (
                event.data ===
                window.YT.PlayerState.ENDED
              ) {
                onPauseOrEnd?.();
              }
            },
          },
        }
      );
    };

    const loadYouTubeApi = () => {
      // API already loaded
      if (window.YT?.Player) {
        createPlayer();
        return;
      }

      // Load API script only once
      const existingScript =
        document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]'
        );

      if (!existingScript) {
        const script =
          document.createElement("script");

        script.src =
          "https://www.youtube.com/iframe_api";

        document.body.appendChild(script);
      }

      const previousCallback =
        window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady =
        () => {
          if (
            typeof previousCallback ===
            "function"
          ) {
            previousCallback();
          }

          createPlayer();
        };
    };

    loadYouTubeApi();

    return () => {
      isMounted = false;

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.log(error);
        }

        playerRef.current = null;
      }
    };
  }, [
    videoId,
    onPlay,
    onPauseOrEnd,
  ]);

  return (
    <div className="w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        title={title}
      />
    </div>
  );
}

export default function FeaturedEventSlider() {
  const [youtubeVideos, setYoutubeVideos] =
    useState([]);

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [
    isVideoPlaying,
    setIsVideoPlaying,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  // ============================
  // FETCH VIDEOS FROM FIRESTORE
  // ============================

  useEffect(() => {
    const fetchYoutubeVideos = async () => {
      try {
        const docRef = doc(
          db,
          "homepageConfig",
          "main"
        );

        const docSnap =
          await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();

          const videos =
            data.youtubeVideos || [];

          setYoutubeVideos(videos);
        }
      } catch (error) {
        console.error(
          "Error loading YouTube videos:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    fetchYoutubeVideos();
  }, []);

  // ============================
  // GET YOUTUBE VIDEO ID
  // ============================

  const getYouTubeVideoId = (url) => {
    if (!url) return "";

    try {
      // youtube.com/watch?v=ID
      if (
        url.includes(
          "youtube.com/watch"
        )
      ) {
        const urlObj = new URL(url);

        return (
          urlObj.searchParams.get("v") ||
          ""
        );
      }

      // youtu.be/ID
      if (url.includes("youtu.be/")) {
        return (
          url
            .split("youtu.be/")[1]
            ?.split("?")[0] || ""
        );
      }

      // youtube.com/shorts/ID
      if (
        url.includes(
          "youtube.com/shorts/"
        )
      ) {
        return (
          url
            .split(
              "youtube.com/shorts/"
            )[1]
            ?.split("?")[0] || ""
        );
      }

      // youtube.com/embed/ID
      if (
        url.includes(
          "youtube.com/embed/"
        )
      ) {
        return (
          url
            .split(
              "youtube.com/embed/"
            )[1]
            ?.split("?")[0] || ""
        );
      }

      return "";
    } catch (error) {
      console.error(
        "Invalid YouTube URL:",
        error
      );

      return "";
    }
  };

  // ============================
  // AUTO SLIDER
  // ============================

  useEffect(() => {
    // Only one video
    if (youtubeVideos.length <= 1) {
      return;
    }

    // STOP animation while video plays
    if (isVideoPlaying) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (
          prev ===
          youtubeVideos.length - 1
        ) {
          return 0;
        }

        return prev + 1;
      });
    }, 6000);

    return () => {
      clearInterval(interval);
    };
  }, [
    youtubeVideos.length,
    isVideoPlaying,
  ]);

  // ============================
  // NEXT VIDEO
  // ============================

  const nextSlide = () => {
    setIsVideoPlaying(false);

    setCurrentIndex((prev) => {
      if (
        prev ===
        youtubeVideos.length - 1
      ) {
        return 0;
      }

      return prev + 1;
    });
  };

  // ============================
  // PREVIOUS VIDEO
  // ============================

  const previousSlide = () => {
    setIsVideoPlaying(false);

    setCurrentIndex((prev) => {
      if (prev === 0) {
        return youtubeVideos.length - 1;
      }

      return prev - 1;
    });
  };

  // ============================
  // DOT CLICK
  // ============================

  const goToSlide = (index) => {
    setIsVideoPlaying(false);
    setCurrentIndex(index);
  };

  // ============================
  // LOADING
  // ============================

  if (loading) {
    return (
      <section className="w-full bg-white py-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-500">
          Loading videos...
        </div>
      </section>
    );
  }

  // No videos
  if (youtubeVideos.length === 0) {
    return null;
  }

  const currentVideo =
    youtubeVideos[currentIndex];

  const videoId =
    getYouTubeVideoId(
      currentVideo?.url
    );

  if (!videoId) {
    return null;
  }

  return (
    <section className="w-full bg-[#f7f7f7] py-12 md:py-16">

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ======================
            SECTION HEADING
        ====================== */}

        <div className="text-center mb-8">

          <div className="flex justify-center items-center gap-2">

            <Youtube className="w-7 h-7 text-red-600" />

            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              YouTube Videos
            </h2>

          </div>

          <p className="text-gray-500 mt-2">
            Watch our latest videos and updates
          </p>

          <div className="w-20 h-[3px] bg-[#c9ae71] mx-auto mt-4 rounded-full" />

        </div>

        {/* ======================
            VIDEO CARD
        ====================== */}

        <div className="bg-white border border-gray-200 shadow-xl p-4 md:p-6">

          {/* Header */}

          <div className="flex items-center gap-2 mb-4">

            <Youtube className="w-5 h-5 text-red-600" />

            <h3 className="text-lg md:text-lg font-semibold text-gray-900">
              {currentVideo.title ||
                "YouTube Video"}
            </h3>

          </div>

          {/* ======================
              VIDEO PLAYER
          ====================== */}

          <div className="relative">

            <div className="aspect-video bg-black rounded-xl overflow-hidden">

              <YouTubePlayer
                key={
                  currentVideo.id ||
                  currentIndex
                }
                videoId={videoId}
                title={
                  currentVideo.title ||
                  "YouTube Video"
                }

                // User starts playing
                onPlay={() => {
                  setIsVideoPlaying(true);
                }}

                // Pause or End
                onPauseOrEnd={() => {
                  setIsVideoPlaying(false);
                }}
              />

            </div>

            {/* ======================
                LEFT ARROW
            ====================== */}

            {youtubeVideos.length > 1 && (
              <button
                type="button"
                onClick={previousSlide}
                aria-label="Previous video"
                className="
                  absolute
                  left-2
                  md:left-4
                  top-1/2
                  -translate-y-1/2

                  w-10
                  h-10
                  md:w-12
                  md:h-12

                  rounded-full

                  bg-black/60
                  hover:bg-black/85

                  text-white

                  flex
                  items-center
                  justify-center

                  shadow-lg

                  transition-all
                  duration-300

                  hover:scale-110

                  z-20
                "
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* ======================
                RIGHT ARROW
            ====================== */}

            {youtubeVideos.length > 1 && (
              <button
                type="button"
                onClick={nextSlide}
                aria-label="Next video"
                className="
                  absolute
                  right-2
                  md:right-4
                  top-1/2
                  -translate-y-1/2

                  w-10
                  h-10
                  md:w-12
                  md:h-12

                  rounded-full

                  bg-black/60
                  hover:bg-black/85

                  text-white

                  flex
                  items-center
                  justify-center

                  shadow-lg

                  transition-all
                  duration-300

                  hover:scale-110

                  z-20
                "
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

          </div>

          {/* ======================
              BOTTOM TITLE
          ====================== */}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-5">

            <p className="tracking-wide text-[#4f5c4f] text-[0.80rem] m-0 whitespace-pre-wrap font-[var(--font-malayalam-sans)]"
                    style={{ lineHeight: "1.6", wordSpacing: "1px" }}>
              {currentVideo.title ||
                "YouTube Video"}
            </p>

            <button
              type="button"
              onClick={() =>
                window.open(
                  currentVideo.url,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="
                inline-flex
                items-center
                justify-center
                gap-2

                border
                border-teal-500

                text-teal-600

                px-3
                py-2

                font-medium

                hover:bg-teal-50

                transition-colors
              "
            >
              <ExternalLink className="w-4 h-4" />

              Open
            </button>

          </div>

          {/* ======================
              SLIDER DOTS
          ====================== */}

          {youtubeVideos.length > 1 && (
            <div className="flex justify-center items-center gap-2 mt-5">

              {youtubeVideos.map(
                (video, index) => (
                  <button
                    key={
                      video.id ||
                      index
                    }
                    type="button"
                    onClick={() =>
                      goToSlide(index)
                    }
                    aria-label={`Go to video ${
                      index + 1
                    }`}
                    className={`
                      h-2.5
                      rounded-full
                      transition-all
                      duration-300

                      ${
                        currentIndex ===
                        index
                          ? "w-8 bg-red-600"
                          : "w-2.5 bg-gray-300 hover:bg-gray-400"
                      }
                    `}
                  />
                )
              )}

            </div>
          )}

          {/* ======================
              STATUS
          ====================== */}

          {youtubeVideos.length > 1 && (
            <div className="text-center mt-3">
              <p className="text-xs text-gray-400">

                {isVideoPlaying
                  ? "Slider paused while video is playing"
                  : "Auto slide enabled"}

              </p>
            </div>
          )}

        </div>

      </div>

    </section>
  );
}