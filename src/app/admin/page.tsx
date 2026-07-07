import Link from "next/link";
import { formatUSD } from "@/lib/pricing";
import { supabaseAdmin, hasServiceRole } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function parseStay(stay: string): { checkIn: string; checkOut: string } {
  const m = /^[\[(]([\d-]+),([\d-]+)[)\]]$/.exec(stay);
  return { checkIn: m?.[1] ?? "", checkOut: m?.[2] ?? "" };
}

export default async function AdminDashboard() {
  if (!hasServiceRole()) {
    return <p className="text-stone-600">Set SUPABASE_SERVICE_ROLE_KEY to enable the dashboard.</p>;
  }
  const db = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const [upcoming, pendingReviews, unread, inquiries, revenue] = await Promise.all([
    db
      .from("bookings")
      .select("id, stay, guest_name, guests, pets, status, total_cents")
      .in("status", ["pending", "confirmed"])
      .gte("stay", `[${today},${today}]`)
      .order("stay")
      .limit(6),
    db.from("reviews").select("id", { count: "exact", head: true }).eq("approved", false),
    db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("from_admin", false)
      .is("read_at", null),
    db
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("archived", false),
    db.from("bookings").select("total_cents").eq("status", "confirmed"),
  ]);

  const totalRevenue = (revenue.data ?? []).reduce((s, b) => s + b.total_cents, 0) / 100;
  const posthogUrl = process.env.NEXT_PUBLIC_POSTHOG_KEY ? "https://us.posthog.com" : null;

  const cards = [
    { label: "Unread guest messages", value: unread.count ?? 0, href: "/admin/messages" },
    { label: "Reviews awaiting approval", value: pendingReviews.count ?? 0, href: "/admin/reviews" },
    { label: "Open inquiries", value: inquiries.count ?? 0, href: "/admin/messages" },
    { label: "Confirmed revenue (all time)", value: formatUSD(totalRevenue), href: "/admin/calendar" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800">Dashboard</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-stone-200 bg-white p-4 hover:border-moss"
          >
            <p className="text-2xl font-bold text-moss">{c.value}</p>
            <p className="mt-1 text-xs text-stone-500">{c.label}</p>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-bold text-stone-800">Upcoming stays</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-2">Dates</th>
              <th className="px-4 py-2">Guest</th>
              <th className="px-4 py-2">Party</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(upcoming.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-stone-400">
                  No upcoming stays.
                </td>
              </tr>
            )}
            {(upcoming.data ?? []).map((b) => {
              const { checkIn, checkOut } = parseStay(b.stay);
              return (
                <tr key={b.id} className="border-t border-stone-100">
                  <td className="px-4 py-2">{checkIn} → {checkOut}</td>
                  <td className="px-4 py-2">{b.guest_name}</td>
                  <td className="px-4 py-2">
                    {b.guests} guests{b.pets ? `, ${b.pets} dogs` : ""}
                  </td>
                  <td className="px-4 py-2">{b.status}</td>
                  <td className="px-4 py-2 text-right">{formatUSD(b.total_cents / 100)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-10 rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
        <h2 className="font-bold text-stone-800">Site traffic</h2>
        {posthogUrl ? (
          <p className="mt-2">
            Analytics are collected with PostHog.{" "}
            <a href={posthogUrl} target="_blank" className="text-moss underline">
              Open the PostHog dashboard
            </a>{" "}
            to see visits, unique visitors and booking-funnel conversion.
          </p>
        ) : (
          <p className="mt-2">
            Analytics aren&apos;t connected yet — add a NEXT_PUBLIC_POSTHOG_KEY (see SETUP.md) to
            start tracking visits.
          </p>
        )}
      </div>
    </div>
  );
}
