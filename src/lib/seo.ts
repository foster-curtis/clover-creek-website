import type { Metadata } from "next";
import { SITE } from "./site";

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
    },
    ...(input.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
