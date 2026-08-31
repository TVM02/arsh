"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

function NewsCard({ news }) {
  const { image, date, title, description, category } = news;

  const formattedDate = (() => {
    try {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return date || "";
    }
  })();

  return (
    <article className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Image */}
      <div className="relative w-full h-48 bg-gray-100 overflow-hidden flex-shrink-0">
        {image ? (
          <Image
            src={image}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover transition-transform duration-300 hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <svg
              className="w-16 h-16 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        {/* Category badge */}
        {category && (
          <span className="absolute top-3 right-3 bg-teal-700 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow">
            {category}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <p className="text-xs text-gray-400 mb-2">{formattedDate}</p>
        <h3 className="text-base font-bold text-gray-900 leading-snug mb-2 line-clamp-2">
          {title}
        </h3>
        <p className="text-sm text-gray-500 leading-relaxed flex-1 line-clamp-3">
          {description}
        </p>
        <Link
          href={`/news`}
          className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-800 text-sm font-semibold mt-4 transition-colors"
        >
          Read More <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

/* ─── Skeleton for loading state ─────────────────────────────────────────── */
function NewsCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-200" />
      <div className="p-5 space-y-3">
        <div className="h-3 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-4/5" />
      </div>
    </div>
  );
}

/* ─── Section ─────────────────────────────────────────────────────────────── */
export default function LatestNews({ limit = 3 }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/news?limit=${limit}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.news)) setNews(data.news.slice(0, limit));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [limit]);

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Header row */}
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2">
              Stay Updated
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Latest News &amp; Updates
            </h2>
          </div>
          <Link
            href="/news"
            className="inline-flex items-center gap-2 border border-teal-700 text-teal-700 hover:bg-teal-700 hover:text-white font-semibold px-5 py-2.5 rounded-full transition-all text-sm"
          >
            View All News <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading
            ? Array.from({ length: limit }).map((_, i) => (
                <NewsCardSkeleton key={i} />
              ))
            : news.length > 0
              ? news.map((item) => <NewsCard key={item.id} news={item} />)
              : Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    <div className="h-48 bg-gray-100 flex items-center justify-center">
                      <span className="text-gray-300 text-sm">No image</span>
                    </div>
                    <div className="p-5">
                      <p className="text-xs text-gray-400 mb-2">
                        {
                          [
                            "October 24, 2023",
                            "October 14, 2023",
                            "October 02, 2023",
                          ][i]
                        }
                      </p>
                      <h3 className="text-base font-bold text-gray-900 mb-2">
                        {
                          [
                            "Annual Madrasa Teachers Conference 2023",
                            "Scholarship Enrollment Now Open for 2024",
                            "New Mobile Learning App for Students Launched",
                          ][i]
                        }
                      </h3>
                      <p className="text-sm text-gray-500 line-clamp-3">
                        {
                          [
                            "The board hosted a statewide conference to discuss the implementation of digital tools in traditional contexts.",
                            "Eligible students can now apply for the Merit-cum-Means scholarship for the upcoming academic session online or offline.",
                            "The board is proud to introduce the official DKJU learning app, designed to make distance studies accessible on the go.",
                          ][i]
                        }
                      </p>
                      <Link
                        href="/news"
                        className="inline-flex items-center gap-1 text-teal-600 text-sm font-semibold mt-4 hover:text-teal-800 transition-colors"
                      >
                        Read More <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
        </div>
      </div>
    </section>
  );
}
