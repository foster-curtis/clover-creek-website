import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/data";
import { SITE } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  // Legal pages change rarely and shouldn't compete with the pages that sell the stay.
  const lowPriority = new Set(["/terms", "/privacy"]);
  const staticPages = [
    "",
    "/gallery",
    "/book",
    "/reviews",
    "/blog",
    "/faq",
    "/contact",
    "/house-rules",
    "/terms",
    "/privacy",
  ].map((path) => ({
    url: `${SITE.url}${path}`,
    changeFrequency: "weekly" as const,
    lastModified: now,
    priority: path === "" ? 1 : lowPriority.has(path) ? 0.3 : 0.7,
  }));
  const posts = (await getPublishedPosts()).map((post) => ({
    url: `${SITE.url}/blog/${post.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.5,
    lastModified: post.publishedAt ?? undefined,
  }));
  return [...staticPages, ...posts];
}
