import type { NextConfig } from "next";

// Every image the site serves is a committed file under public/ — there are no
// remote image hosts, so `images.remotePatterns` stays empty and the optimizer
// can never be pointed at a third party. Photos are managed in
// src/content/gallery.ts; see README.md, "Adding or changing photos".

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

export default nextConfig;
