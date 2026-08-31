import Image from "next/image";
import Link from "next/link";

import { videos } from "@/data/youtube";

export default function YoutubeSection() {
  const featuredVideo = videos[0];
  const sideVideos = videos.slice(1);

  return (
    <section className="relative py-20 overflow-hidden bg-[url('/images/fbg.jpeg')] bg-cover">
      <div className="relative z-10 w-[calc(100%-4rem)] max-w-[1400px] mx-auto">
        <h2 className="mb-12 text-[44.8px] font-bold text-center text-[#f7f3ea] font-serif">
          DKIMVB on Youtube
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Link
            href={featuredVideo.url}
            className="bg-white border border-[#c4a96b]/[0.15] overflow-hidden no-underline p-1 rounded shadow-[0_4px_12px_rgba(0,0,0,0.04)] block"
          >
            <div className="relative w-full aspect-[12/9] max-[1024px]:h-[220px] max-[1024px]:aspect-auto">
              <Image
                src={featuredVideo.thumbnail}
                alt={featuredVideo.title}
                fill
                sizes="100vw"
                className="object-cover"
              />
            </div>
          </Link>

          {sideVideos.map((video) => (
            <Link
              key={video.id}
              href={video.url}
              className="bg-white border border-[#c4a96b]/[0.15] overflow-hidden no-underline p-1 rounded shadow-[0_4px_12px_rgba(0,0,0,0.04)] block"
            >
              <div className="relative w-full aspect-[12/9] max-[1024px]:h-[220px] max-[1024px]:aspect-auto">
                <Image
                  src={video.thumbnail}
                  alt={video.title}
                  fill
                  sizes="100vw"
                  className="object-cover"
                />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
