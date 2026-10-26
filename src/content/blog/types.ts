import type { StaticImageData } from "next/image";

/** The `export const meta` every post in this folder declares. */
export interface PostMeta {
  /** Must match the filename. Every slug is a live, indexed URL — never change one. */
  slug: string;
  title: string;
  excerpt: string;
  /** YYYY-MM-DD */
  publishedAt: string;
  /** Only when the post is genuinely revised. */
  updatedAt?: string;
  /** Byline (SEO_PLAN.md §12.4). Absent means no byline — never invent one. */
  author?: string;
  /** Omitted or false = published. */
  draft?: boolean;
  /**
   * A static import of a co-located image (./images/…), so Next supplies the width,
   * height and blur placeholder and the cover never shifts the layout.
   */
  cover?: { src: StaticImageData; alt: string };
}
