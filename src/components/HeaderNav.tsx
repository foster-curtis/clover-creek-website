"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavHref, type NavLink } from "@/lib/nav";

/**
 * The desktop site nav. A client component only so it can read the current
 * path and mark the tab you're on; Header itself stays a server component so
 * it can keep loading the signed-in user.
 */
export default function HeaderNav({
  links,
  signedIn,
}: {
  links: readonly NavLink[];
  signedIn: boolean;
}) {
  const pathname = usePathname();
  // The account/sign-in link is part of the match set even though it renders
  // separately below, so /account beats /  when both would match.
  const active = activeNavHref(pathname, [
    ...links.map((l) => l.href),
    signedIn ? "/account" : "/login",
  ]);

  // Inactive links carry a transparent underline so marking one active never
  // shifts the row.
  const textLink = (href: string) =>
    href === active
      ? "border-b-2 border-moss font-semibold text-moss"
      : "border-b-2 border-transparent text-stone-600 hover:text-moss";

  return (
    <nav className="hidden items-center gap-5 text-sm lg:flex">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.href === active ? "page" : undefined}
          className={textLink(link.href)}
        >
          {link.label}
        </Link>
      ))}
      {signedIn ? (
        <Link
          href="/account"
          aria-current={active === "/account" ? "page" : undefined}
          className={`rounded-full border border-moss px-4 py-1.5 ${
            active === "/account"
              ? "bg-moss font-medium text-white"
              : "text-moss hover:bg-moss hover:text-white"
          }`}
        >
          My Stays
        </Link>
      ) : (
        <>
          <Link
            href="/login"
            aria-current={active === "/login" ? "page" : undefined}
            className={textLink("/login")}
          >
            Sign In
          </Link>
          {/* No aria-current here: the "Book a Stay" nav link above already
              carries it when you're on /book. */}
          <Link
            href="/book"
            className={`rounded-full px-4 py-1.5 text-white ${
              active === "/book" ? "bg-moss-dark" : "bg-moss hover:bg-moss-dark"
            }`}
          >
            Book a Stay
          </Link>
        </>
      )}
    </nav>
  );
}
