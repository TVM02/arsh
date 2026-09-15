"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const defaultNews = [
   
  ];

export default function NewsList() {
  const [news, setNews] = useState(defaultNews);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const snap = await getDoc(
          doc(db, "homepageConfig", "main")
        );

        if (snap.exists() && snap.data().news) {
          setNews(snap.data().news);
        }
      } catch (error) {
        console.error("Error fetching news:", error);
      }
    };

    fetchNews();
  }, []);

  const toggleReadMore = (index) => {
    setExpandedIndex(
      expandedIndex === index ? null : index
    );
  };

  const shouldScroll = news.length > 5;

  return (
    <div
      className="
        bg-white
        border
        border-[#c9b37e]/45
        rounded-md
        p-6
        shadow-[0_2px_12px_rgba(39,70,41,0.06)]
      "
    >

      {/* Heading */}
      <h3
        className="
          font-serif
          text-[#274629]
          text-[1.45rem]
          font-normal
          mb-5
          pb-3
          border-b
          border-[#c9b37e]/35
        "
      >
        Latest Government Updates
      </h3>


      {/* ================================
          NEWS VIEWPORT
      ================================= */}

      <div
        className={`
          relative
          overflow-hidden
          ${shouldScroll ? "h-[430px]" : ""}
        `}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >

        <div
          className={`
            flex
            flex-col
            ${shouldScroll && !isPaused
              ? "animate-news-scroll"
              : ""
            }
          `}
        >

          {news.map((item, index) => {

            const isExpanded =
              expandedIndex === index;

            const isLong =
              item.title &&
              item.title.length > 100;

            const previewText =
              item.title?.slice(0, 100);

            return (
              <div
                key={index}
                className="
                  grid
                  grid-cols-[120px_minmax(0,1fr)]
                  gap-x-4
                  items-start
                  py-4
                  border-b
                  border-[#c9b37e]/[0.22]
                  last:border-b-0
                  first:pt-0
                  shrink-0
                "
              >

                {/* DATE / MONTH */}

                <span
                  className="
                    w-[120px]
                    pt-[0.3rem]
                    text-[0.72rem]
                    tracking-[0.12em]
                    font-[var(--font-malayalam-sans)]
                    text-left
                    text-[#355a2c]
                    leading-[1.4]
                    break-words
                  "
                  style={{ lineHeight: "1.6", wordSpacing: "1px" }}
                >
                  {item.month}
                  <span className="block text-[0.40rem] text-[#4f5c4f] mt-1">
                  {item.createdAt && `Posted On: ${item.createdAt}`}
                </span>
                </span>


                {/* NEWS */}

                <div className="min-w-0">

                  <p
                    className="tracking-wide text-[#4f5c4f] text-[0.80rem] m-0 whitespace-pre-wrap font-[var(--font-malayalam-sans)]"
                    style={{ lineHeight: "1.6", wordSpacing: "1px" }}
                  >
                    {isLong && !isExpanded
                      ? `${previewText}...`
                      : item.title}
                  </p>


                  {/* READ MORE */}

                  {isLong && (
                    <button
                      type="button"
                      onClick={() =>
                        toggleReadMore(index)
                      }
                      className="
                        mt-2
                        text-[#c9b37e]
                        text-[0.85rem]
                        font-semibold
                        hover:text-[#274629]
                        transition-colors
                      "
                    >
                      {isExpanded
                        ? "Show Less"
                        : "Read More"}
                    </button>
                  )}
                  {item.startDate && (
    <p
      className="mt-1 text-[0.58rem] text-[#4f5c4f]"
    >
      Start date: {item.startDate}
    </p>
    )}
    {item.endDate && (
    <p
      className="mt-1 text-[0.58rem] text-[#4f5c4f]"
    >
       Closing date: {item.endDate}
    </p>
    
  )}

                </div>

              </div>
            );
          })}

        </div>

      </div>


      {/* Scroll hint */}

      {shouldScroll && (
        <p className="mt-3 text-center text-[11px] text-[#7d877d]">
          Hover to pause
        </p>
      )}

    </div>
  );
}