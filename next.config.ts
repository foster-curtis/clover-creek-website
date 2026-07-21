import type { NextConfig } from "next";

// Gallery photos are served from Supabase Storage. Allow the hosted Supabase
// domain in production, plus whatever NEXT_PUBLIC_SUPABASE_URL points at (e.g.
// http://127.0.0.1:54321 in local dev) so images load in every environment.
type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

const remotePatterns: RemotePattern[] = [
  {
    protocol: "https",
    hostname: "*.supabase.co",
    pathname: "/storage/v1/object/public/**",
  },
];

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    remotePatterns.push({
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port || undefined,
      pathname: "/storage/v1/object/public/**",
    });
  } catch {
    // Malformed URL — fall back to the hosted pattern above.
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
    // Placeholder art is local SVG
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
