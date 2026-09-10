import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import { hasSupabase, isAdminUser } from "@/lib/supabase/server";

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
        <AdminNav variant="sidebar" />
      </aside>
      <div className="min-w-0 flex-1">
        <AdminNav variant="pills" />
        {children}
      </div>
    </div>
  );
}
