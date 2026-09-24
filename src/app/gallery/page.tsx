import type { Metadata } from "next";
import GalleryGrid from "@/components/GalleryGrid";
import { PageTitle } from "@/components/ui/Heading";
import { getGallery } from "@/lib/data";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "/gallery",
  title: "Photo Gallery",
  description:
    "Photos of the Clover Creek Guest House — bedrooms, kitchen, patio, fire pit and the Rush Valley scenery.",
});

// No `revalidate` — the photos are committed files, so this page is fully static.

export default function GalleryPage() {
  const images = getGallery();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageTitle>Photo Gallery</PageTitle>
      <p className="mt-2 text-stone-600">Take a look around the house and the valley.</p>
      <div className="mt-8">
        <GalleryGrid images={images} />
      </div>
    </div>
  );
}
