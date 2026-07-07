import Link from "next/link";
import { hasSupabase, isAdminUser } from "@/lib/supabase/server";

const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/calendar", label: "Calendar & Bookings" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/gallery", label: "Gallery" },
  { href: "/admin/content", label: "Site Content" },
  { href: "/admin/pricing", label: "Pricing & Holidays" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/blog", label: "Blog" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabase()) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center text-stone-600">
        <h1 className="text-2xl font-bold text-stone-800">Admin</h1>
        <p className="mt-4">
          The admin dashboard becomes available once the site is connected to Supabase (see
          SETUP.md in the project).
        </p>
      </div>
    );
  }

  const admin = await isAdminUser();
  if (!admin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center text-stone-600">
        <h1 className="text-2xl font-bold text-stone-800">Not authorized</h1>
        <p className="mt-4">This area is for the property owner. If that&apos;s you, make sure
        you&apos;re signed in with the admin account.</p>
        <Link href="/login?next=/admin" className="mt-4 inline-block text-moss underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8">
      <aside className="hidden w-48 shrink-0 md:block">
        <nav className="sticky top-20 space-y-1 text-sm">
          {ADMIN_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block rounded px-3 py-2 text-stone-600 hover:bg-moss/10 hover:text-moss-dark"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <nav className="mb-4 flex flex-wrap gap-2 text-xs md:hidden">
          {ADMIN_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full border border-stone-300 px-3 py-1 text-stone-600"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
