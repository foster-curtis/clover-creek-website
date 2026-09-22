import Link from "next/link";
import Card from "@/components/ui/Card";
import { PageTitle, SectionTitle } from "@/components/ui/Heading";
import { formatUSD, parseStay } from "@/lib/pricing";
import { supabaseAdmin, hasServiceRole } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  if (!hasServiceRole()) {
    return <p className="text-ink-muted">Set SUPABASE_SERVICE_ROLE_KEY to enable the dashboard.</p>;
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

  const cards = [
    { label: "Unread guest messages", value: unread.count ?? 0, href: "/admin/messages" },
    { label: "Reviews awaiting approval", value: pendingReviews.count ?? 0, href: "/admin/reviews" },
    { label: "Open inquiries", value: inquiries.count ?? 0, href: "/admin/messages" },
    { label: "Confirmed revenue (all time)", value: formatUSD(totalRevenue), href: "/admin/calendar" },
  ];

  return (
    <div>
      <PageTitle>Dashboard</PageTitle>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="block">
            <Card variant="interactive" className="p-4">
              <p className="text-2xl font-bold text-moss">{c.value}</p>
              <p className="mt-1 text-xs text-ink-muted">{c.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <SectionTitle className="mt-10">Upcoming stays</SectionTitle>
      <Card variant="flat" className="mt-3 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-muted">
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
                <td colSpan={5} className="px-4 py-6 text-center text-ink-subtle">
                  No upcoming stays.
                </td>
              </tr>
            )}
            {(upcoming.data ?? []).map((b) => {
              const { checkIn, checkOut } = parseStay(b.stay);
              return (
                <tr key={b.id} className="border-t border-line">
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
      </Card>

      <Card variant="flat" className="mt-10 p-5 text-sm text-ink-muted">
        <h2 className="font-bold text-ink">Site traffic</h2>
        <p className="mt-2">
          Analytics are collected with Vercel Web Analytics.{" "}
          <a
            href="https://vercel.com/clovercreekguesthouse/clover-creek-website/analytics"
            target="_blank"
            className="text-moss underline"
          >
            Open the Vercel dashboard
          </a>{" "}
          and select this project&apos;s Analytics tab to see visits, unique visitors and top
          pages.
        </p>
      </Card>
    </div>
  );
}
