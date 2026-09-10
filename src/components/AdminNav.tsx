"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavHref } from "@/lib/nav";

const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/calendar", label: "Calendar & Bookings" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/gallery", label: "Gallery" },
  { href: "/admin/content", label: "Site Content" },
  { href: "/admin/pricing", label: "Pricing & Holidays" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/blog", label: "Blog" },
] as const;

const ADMIN_HREFS = ADMIN_LINKS.map((l) => l.href);

/**
 * The admin nav, in two shapes: a sidebar on desktop and a row of pills above
 * the content on small screens. A client component only so it can read the
 * current path and mark the section you're in; the layout around it stays a
 * server component.
 */
export default function AdminNav({ variant }: { variant: "sidebar" | "pills" }) {
  const active = activeNavHref(usePathname(), ADMIN_HREFS);

  if (variant === "pills") {
    return (
      <nav className="mb-4 flex flex-wrap gap-2 text-xs md:hidden">
        {ADMIN_LINKS.map((l) => {
          const isActive = l.href === active;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${
                isActive
                  ? "border-moss bg-moss font-medium text-white"
                  : "border-stone-300 text-stone-600"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="sticky top-20 space-y-1 text-sm">
      {ADMIN_LINKS.map((l) => {
        const isActive = l.href === active;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive ? "page" : undefined}
            className={`block rounded px-3 py-2 ${
              isActive
                ? "bg-moss/10 font-semibold text-moss-dark"
                : "text-stone-600 hover:bg-moss/10 hover:text-moss-dark"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
