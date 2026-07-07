"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { GalleryImage } from "@/lib/data";

export default function GalleryGrid({ images }: { images: GalleryImage[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (lightbox === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? null : (i + 1) % images.length));
      if (e.key === "ArrowLeft")
        setLightbox((i) => (i === null ? null : (i - 1 + images.length) % images.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, images.length]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setLightbox(i)}
            className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-stone-200"
            aria-label={`View photo: ${img.alt}`}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover transition group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-h-[85vh] w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={images[lightbox].src}
                alt={images[lightbox].alt}
                fill
                sizes="100vw"
                className="rounded-lg object-contain"
              />
            </div>
            {images[lightbox].caption && (
              <p className="mt-2 text-center text-sm text-stone-200">{images[lightbox].caption}</p>
            )}
            <button
              type="button"
              onClick={() => setLightbox((lightbox - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white hover:bg-black/70"
              aria-label="Previous photo"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setLightbox((lightbox + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white hover:bg-black/70"
              aria-label="Next photo"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute -top-3 right-0 rounded-full bg-black/50 px-3 py-1 text-white hover:bg-black/70"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
