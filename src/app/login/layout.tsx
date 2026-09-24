import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// /login is a client component and cannot export metadata itself, so the
// noindex directive lives in this layout (SEO_PLAN.md §10.5, defect A13).
export const metadata: Metadata = pageMetadata({
  path: "/login",
  title: "Sign In",
  noindex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
