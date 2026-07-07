import type { Metadata } from "next";
import GalleryGrid from "@/components/GalleryGrid";
import { getGallery } from "@/lib/data";

export const metadata: Metadata = {
  title: "Photo Gallery",
  description: "Photos of the Clover Creek Guest House — bedrooms, kitchen, patio, fire pit and the Rush Valley scenery.",
};

export const revalidate = 300;

export default async function GalleryPage() {
  const images = await getGallery();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-800">Photo Gallery</h1>
      <p className="mt-2 text-stone-600">Take a look around the house and the valley.</p>
      <div className="mt-8">
        <GalleryGrid images={images} />
      </div>
    </div>
  );
}
