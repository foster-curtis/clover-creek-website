import Link from "next/link";
import { NAV_LINKS, SITE } from "@/lib/site";
import { currentUser, isAdminUser } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/Logo";
import HeaderNav from "./HeaderNav";
import HeaderShell from "./HeaderShell";
import MobileNav from "./MobileNav";

export default async function Header() {
  const user = await currentUser();
  const admin = await isAdminUser(user);

  const links = [...NAV_LINKS, ...(admin ? [{ href: "/admin", label: "Admin" }] : [])];

  return (
    <HeaderShell>
      <div className="mx-auto flex max-w-[var(--w-wide)] items-center justify-between gap-4 px-4 py-3">
        <Link href="/" aria-label={SITE.name}>
          <Logo title="Clover Creek" subtitle="Guest House" />
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
    </HeaderShell>
  );
}
