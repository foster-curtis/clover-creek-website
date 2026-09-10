import Link from "next/link";
import { NAV_LINKS, SITE } from "@/lib/site";
import { currentUser, isAdminUser } from "@/lib/supabase/server";
import HeaderNav from "./HeaderNav";
import MobileNav from "./MobileNav";

export default async function Header() {
  const user = await currentUser();
  const admin = await isAdminUser(user);

  const links = [...NAV_LINKS, ...(admin ? [{ href: "/admin", label: "Admin" }] : [])];

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-serif text-lg font-bold text-moss sm:text-xl">
          {SITE.name}
        </Link>
        <HeaderNav links={links} signedIn={!!user} />
        <MobileNav
          links={[
            ...links,
            user
              ? { href: "/account", label: "My Stays" }
              : { href: "/login", label: "Sign In" },
          ]}
        />
      </div>
    </header>
  );
}
