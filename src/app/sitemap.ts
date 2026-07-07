import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/data";
import { SITE } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = ["", "/gallery", "/book", "/reviews", "/blog", "/faq", "/contact", "/house-rules"].map(
    (path) => ({
      url: `${SITE.url}${path}`,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })
  );
  const posts = (await getPublishedPosts()).map((post) => ({
    url: `${SITE.url}/blog/${post.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.5,
    lastModified: post.publishedAt ?? undefined,
  }));
  return [...staticPages, ...posts];
}
