import type { Metadata } from "next";
import { SITE } from "./site";

/**
 * The site-wide social share card (1200x630, public/og-default.jpg). Site-relative on
 * purpose — `metadataBase` in the root layout resolves it to an absolute URL, which is
 * what Facebook requires.
 */
export const DEFAULT_OG_IMAGE = "/og-default.jpg";

/** Absolute URL for a site-relative path. Always canonical-host, no trailing slash. */
export function absoluteUrl(path: string): string {
  if (!path || path === "/") return SITE.url;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface PageMetaInput {
  /** Site-relative path, e.g. "/faq" or "/blog/onaqui-wild-horses-rush-valley". */
  path: string;
  /** Page title *before* the "— Clover Creek Guest House" template suffix. */
  title?: string;
  description?: string;
  /** Absolute or site-relative image URL. Defaults to the site OG image (Stage 02). */
  image?: string;
  /** Set for pages that must stay out of the index (§10.5). */
  noindex?: boolean;
  /** "article" for blog posts; everything else is a website page. */
  type?: "website" | "article";
}

/**
 * Canonical + Open Graph for one page. Canonicals are the fix for defect A1 — every
 * page needs one, and it must be absolute and on the canonical host (§13.1).
 */
export function pageMetadata(input: PageMetaInput): Metadata {
  const url = absoluteUrl(input.path);
  return {
    ...(input.title ? { title: input.title } : {}),
    ...(input.description ? { description: input.description } : {}),
    alternates: { canonical: url },
    openGraph: {
      url,
      type: input.type ?? "website",
      ...(input.title ? { title: input.title } : {}),
      ...(input.description ? { description: input.description } : {}),
      // Dimensions are only safe to assert for the default card, which we generated
      // at exactly 1200x630. A caller-supplied image is an unknown size, so let the
      // consumer read it rather than advertising a shape it may not have.
      images: input.image
        ? [{ url: input.image }]
        : [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
    },
    ...(input.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
