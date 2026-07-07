import Link from "next/link";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import { archiveInquiry } from "../actions";

export const dynamic = "force-dynamic";

function parseStay(stay: string): { checkIn: string; checkOut: string } {
  const m = /^[\[(]([\d-]+),([\d-]+)[)\]]$/.exec(stay);
  return { checkIn: m?.[1] ?? "", checkOut: m?.[2] ?? "" };
}

export default async function AdminMessagesPage() {
  if (!hasServiceRole()) {
    return <p className="text-stone-600">Set SUPABASE_SERVICE_ROLE_KEY to view messages.</p>;
  }
  const db = supabaseAdmin();

  const [{ data: messages }, { data: inquiries }] = await Promise.all([
    db
      .from("messages")
      .select("booking_id, body, from_admin, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("inquiries")
      .select("id, name, email, body, created_at")
      .eq("archived", false)
      .order("created_at", { ascending: false }),
  ]);

  // Group chat threads by booking
  const threads = new Map<
    string,
    { last: string; lastAt: string; unread: number }
  >();
  for (const m of messages ?? []) {
    const t = threads.get(m.booking_id) ?? { last: "", lastAt: "", unread: 0 };
    if (!t.lastAt) {
      t.last = m.body;
      t.lastAt = m.created_at;
    }
    if (!m.from_admin && !m.read_at) t.unread++;
    threads.set(m.booking_id, t);
  }

  const bookingIds = [...threads.keys()];
  const { data: bookings } = bookingIds.length
    ? await db
        .from("bookings")
        .select("id, guest_name, stay")
        .in("id", bookingIds)
    : { data: [] };
  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]));

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800">Messages</h1>

      <h2 className="mt-6 text-lg font-bold text-stone-800">Guest conversations</h2>
      <div className="mt-3 space-y-2">
        {threads.size === 0 && (
          <p className="text-sm text-stone-400">No conversations yet.</p>
        )}
        {[...threads.entries()]
          .sort((a, b) => (a[1].lastAt < b[1].lastAt ? 1 : -1))
          .map(([bookingId, t]) => {
            const booking = bookingById.get(bookingId);
            const stay = booking ? parseStay(booking.stay) : null;
            return (
              <Link
                key={bookingId}
                href={`/admin/messages/${bookingId}`}
                className="block rounded-xl border border-stone-200 bg-white p-4 hover:border-moss"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-stone-800">
                    {booking?.guest_name ?? "Guest"}
                    {stay && (
                      <span className="ml-2 text-xs font-normal text-stone-400">
                        {stay.checkIn} → {stay.checkOut}
                      </span>
                    )}
                  </p>
                  {t.unread > 0 && (
                    <span className="rounded-full bg-moss px-2 py-0.5 text-xs font-bold text-white">
                      {t.unread} new
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-stone-500">{t.last}</p>
              </Link>
            );
          })}
      </div>

      <h2 className="mt-10 text-lg font-bold text-stone-800">Website inquiries</h2>
      <p className="mt-1 text-xs text-stone-400">
        From the contact form — reply by email, then archive.
      </p>
      <div className="mt-3 space-y-2">
        {(inquiries ?? []).length === 0 && (
          <p className="text-sm text-stone-400">No open inquiries.</p>
        )}
        {(inquiries ?? []).map((inq) => (
          <div key={inq.id} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-stone-800">
                {inq.name}{" "}
                <a href={`mailto:${inq.email}`} className="text-xs font-normal text-moss underline">
                  {inq.email}
                </a>
              </p>
              <time className="text-xs text-stone-400">
                {new Date(inq.created_at).toLocaleDateString()}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">{inq.body}</p>
            <div className="mt-3 flex gap-2">
              <a
                href={`mailto:${inq.email}?subject=Re: your Clover Creek inquiry`}
                className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:border-moss hover:text-moss"
              >
                Reply by email
              </a>
              <form action={archiveInquiry}>
                <input type="hidden" name="id" value={inq.id} />
                <button
                  type="submit"
                  className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:border-moss hover:text-moss"
                >
                  Archive
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
