import Link from "next/link";
import { NAV_LINKS, SITE } from "@/lib/site";
import { currentUser, isAdminUser } from "@/lib/supabase/server";
import MobileNav from "./MobileNav";

export default async function Header() {
  const user = await currentUser();
  const admin = user ? await isAdminUser() : false;

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-serif text-lg font-bold text-moss sm:text-xl">
          {SITE.name}
        </Link>
        <nav className="hidden items-center gap-5 text-sm lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-stone-600 hover:text-moss">
              {link.label}
            </Link>
          ))}
          {admin && (
            <Link href="/admin" className="text-stone-600 hover:text-moss">
              Admin
            </Link>
          )}
          {user ? (
            <Link
              href="/account"
              className="rounded-full border border-moss px-4 py-1.5 text-moss hover:bg-moss hover:text-white"
            >
              My Stays
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-stone-600 hover:text-moss">
                Sign In
              </Link>
              <Link
                href="/book"
                className="rounded-full bg-moss px-4 py-1.5 text-white hover:bg-moss-dark"
              >
                Book a Stay
              </Link>
            </>
          )}
        </nav>
        <MobileNav
          links={[
            ...NAV_LINKS.map((l) => ({ ...l })),
            ...(admin ? [{ href: "/admin", label: "Admin" }] : []),
            user
              ? { href: "/account", label: "My Stays" }
              : { href: "/login", label: "Sign In" },
          ]}
        />
      </div>
    </header>
  );
}
