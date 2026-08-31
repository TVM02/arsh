"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import Header from "@/components/Header";
import HomeFooter from "@/components/home/HomeFooter";

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
        {category && (
          <span className="absolute top-3 right-3 bg-teal-700 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            {category}
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <p className="text-xs text-gray-400 mb-2">{formattedDate}</p>
        <h3 className="text-base font-bold text-gray-900 leading-snug mb-2 line-clamp-2">
          {title}
        </h3>
        <p className="text-sm text-gray-500 leading-relaxed flex-1 line-clamp-4">
          {description}
        </p>
        <span className="inline-flex items-center gap-1 text-teal-600 text-sm font-semibold mt-4 cursor-pointer hover:text-teal-800 transition-colors w-fit">
          Read More <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </article>
  );
}

const CATEGORIES = [
  "All",
  "Announcement",
  "Conference",
  "Technology",
  "General",
];

export default function NewsPage() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    fetch("/api/news?limit=50")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.news)) setNews(data.news);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = news.filter((item) => {
    const matchSearch =
      !search ||
      item.title?.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      selectedCategory === "All" || item.category === selectedCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />

      {/* Page hero */}
      <div className="bg-teal-800 text-white py-14 px-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-teal-300 mb-2">
          Stay Updated
        </p>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">
          News &amp; Updates
        </h1>
        <p className="text-teal-200 max-w-xl mx-auto text-sm">
          Latest announcements, events, and developments from DKJU
        </p>
      </div>

      <main className="flex-1 container mx-auto px-4 py-12">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search news..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  selectedCategory === cat
                    ? "bg-teal-700 text-white border-teal-700"
                    : "bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 animate-pulse overflow-hidden"
              >
                <div className="h-48 bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">&#128240;</p>
            <p className="text-lg font-semibold text-gray-700 mb-2">
              No news found
            </p>
            <p className="text-sm text-gray-400">
              {search || selectedCategory !== "All"
                ? "Try adjusting your search or filters."
                : "News articles will appear here once published."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item) => (
              <NewsCard key={item.id} news={item} />
            ))}
          </div>
        )}
      </main>

      <HomeFooter />
    </div>
  );
}
