import type { Metadata } from "next";
import Link from "next/link";
import GalleryGrid from "@/components/GalleryGrid";
import { buttonClasses } from "@/components/ui/Button";
import { PageTitle, SectionTitle } from "@/components/ui/Heading";
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

      {/* The photos are what people decide on, so the booking ask follows them. */}
      <section className="mt-12 rounded-2xl bg-moss px-6 py-12 text-center text-white">
        <SectionTitle className="!text-white sm:!text-3xl">Like what you see?</SectionTitle>
        <p className="mx-auto mt-2 max-w-md text-white/85">
          Book direct and skip the platform fees — cleaning and taxes are always included.
        </p>
        <Link
          href="/book"
          className={buttonClasses("primary", "lg", "mt-6 !bg-white !text-moss hover:!bg-cream")}
        >
          Check availability
        </Link>
      </section>
    </div>
  );
}
