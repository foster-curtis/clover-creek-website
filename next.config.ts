import createMDX from "@next/mdx";
import type { NextConfig } from "next";

// Every image the site serves is a committed file — under public/, or co-located
// with an Area Guide post in src/content/blog/images/ — so there are no remote
// image hosts, `images.remotePatterns` stays empty and the optimizer can never be
// pointed at a third party. Photos are managed in src/content/gallery.ts; see
// README.md, "Adding or changing photos".

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Route handlers have no metadata export; this header is the only way to
        // keep the auth callback out of the index (SEO_PLAN.md §10.5). It is
        // deliberately NOT disallowed in robots.txt — a URL that is never crawled
        // is a URL where this noindex is never seen.
        source: "/auth/callback",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

// Compiles the Area Guide posts (src/content/blog/*.mdx) at build time. No plugins:
// post metadata is a native `export const meta`, not frontmatter. No pageExtensions
// either — the posts are imported by the existing /blog/[slug] route, not routed as
// files.
const withMDX = createMDX({});

export default withMDX(nextConfig);
