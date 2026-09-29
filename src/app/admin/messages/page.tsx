import Link from "next/link";
import { propertyToday } from "@/lib/cancellation";
import { buildThreads, type ThreadBooking, type ThreadMessage } from "@/lib/messageThreads";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import Button, { buttonClasses } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PageTitle, SectionTitle } from "@/components/ui/Heading";
import { archiveInquiry } from "../actions";

export const dynamic = "force-dynamic";

const BOOKING_FIELDS = "id, guest_name, stay, status";

export default async function AdminMessagesPage() {
  if (!hasServiceRole()) {
    return <p className="text-stone-600">Set SUPABASE_SERVICE_ROLE_KEY to view messages.</p>;
  }
  const db = supabaseAdmin();
  const today = propertyToday();

  const [{ data: messages }, { data: active }, { data: inquiries }] = await Promise.all([
    db
      .from("messages")
      .select("booking_id, body, from_admin, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    // Every stay still on the books — the owner can open any of these and
    // write first, without waiting for the guest to start.
    db
      .from("bookings")
      .select(BOOKING_FIELDS)
      .in("status", ["pending", "confirmed"])
      .order("stay")
      .limit(200),
    db
      .from("inquiries")
      .select("id, name, email, body, created_at")
      .eq("archived", false)
      .order("created_at", { ascending: false }),
  ]);

  // Older or cancelled stays don't come back in that query, but their
  // conversations still belong in the list, so fetch whatever is missing.
  const known = new Set((active ?? []).map((b) => b.id));
  const missing = [...new Set((messages ?? []).map((m) => m.booking_id))].filter(
    (id) => !known.has(id)
  );
  const { data: past } = missing.length
    ? await db.from("bookings").select(BOOKING_FIELDS).in("id", missing)
    : { data: [] };

  const threads = buildThreads(
    (messages ?? []) as ThreadMessage[],
    [...((active ?? []) as ThreadBooking[]), ...((past ?? []) as ThreadBooking[])],
    today
  );

  return (
    <div>
      <PageTitle>Messages</PageTitle>

      <SectionTitle as="h2" className="mt-6 text-lg">
        Guest conversations
      </SectionTitle>
      <p className="mt-1 text-xs text-ink-subtle">
        Every current and upcoming stay is here — open one to write first.
      </p>
      <div className="mt-3 space-y-2">
        {threads.length === 0 && (
          <p className="text-sm text-ink-subtle">No stays to message yet.</p>
        )}
        {threads.map((t) => (
          <Link key={t.bookingId} href={`/admin/messages/${t.bookingId}`} className="block">
            <Card variant="interactive" className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-stone-800">
                  {t.guestName}
                  <span className="ml-2 text-xs font-normal text-ink-subtle">
                    {t.checkIn} → {t.checkOut} · {t.status}
                  </span>
                </p>
                {t.unread > 0 && (
                  <span className="shrink-0 rounded-full bg-moss px-2 py-0.5 text-xs font-bold text-white">
                    {t.unread} new
                  </span>
                )}
              </div>
              {t.last ? (
                <p className="mt-1 truncate text-sm text-ink-muted">{t.last}</p>
              ) : (
                <p className="mt-1 text-sm italic text-ink-subtle">
                  No messages yet — start the conversation.
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>

      <SectionTitle as="h2" className="mt-10 text-lg">
        Website inquiries
      </SectionTitle>
      <p className="mt-1 text-xs text-ink-subtle">
        From the contact form — reply by email, then archive.
      </p>
      <div className="mt-3 space-y-2">
        {(inquiries ?? []).length === 0 && (
          <p className="text-sm text-ink-subtle">No open inquiries.</p>
        )}
        {(inquiries ?? []).map((inq) => (
          <Card key={inq.id} variant="flat" className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-stone-800">
                {inq.name}{" "}
                <a href={`mailto:${inq.email}`} className="text-xs font-normal text-moss underline">
                  {inq.email}
                </a>
              </p>
              <time className="text-xs text-ink-subtle">
                {new Date(inq.created_at).toLocaleDateString()}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">{inq.body}</p>
            <div className="mt-3 flex gap-2">
              <a
                href={`mailto:${inq.email}?subject=Re: your Clover Creek inquiry`}
                className={buttonClasses("secondary", "sm")}
              >
                Reply by email
              </a>
              <form action={archiveInquiry}>
                <input type="hidden" name="id" value={inq.id} />
                <Button type="submit" variant="secondary" size="sm">
                  Archive
                </Button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
