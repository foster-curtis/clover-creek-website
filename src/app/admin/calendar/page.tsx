import { cookies } from "next/headers";
import Link from "next/link";
import Button, { buttonClasses } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageTitle, SectionTitle } from "@/components/ui/Heading";
import { propertyToday } from "@/lib/cancellation";
import { computeLodgingTax, formatUSD, parseStay } from "@/lib/pricing";
import { SITE } from "@/lib/site";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import {
  addIcalFeed,
  blockDates,
  createManualBooking,
  removeIcalFeed,
  setBookingStatus,
  setIcalFeedActive,
  syncIcalFeeds,
  unblockDates,
} from "../actions";
import RefundControls from "./RefundControls";
import SyncNotice, { SYNC_NOTICE_COOKIE } from "./SyncNotice";

export const dynamic = "force-dynamic";

/** "4 minutes ago" — how fresh an imported calendar is, at a glance. */
function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return "just now";
  const units: Array<[number, string]> = [
    [60, "minute"],
    [60, "hour"],
    [24, "day"],
  ];
  let value = seconds;
  let unit = "second";
  for (const [size, name] of units) {
    if (value < size) break;
    value = Math.round(value / size);
    unit = name;
  }
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ feedError?: string }>;
}) {
  if (!hasServiceRole()) {
    return <p className="text-ink-muted">Set SUPABASE_SERVICE_ROLE_KEY to manage bookings.</p>;
  }
  const db = supabaseAdmin();
  await db.rpc("expire_stale_holds");

  const [{ data: bookings }, { data: blocks }, { data: feeds }] = await Promise.all([
    db
      .from("bookings")
      .select(
        "id, stay, guest_name, guest_email, guest_phone, guests, pets, status, total_cents, stripe_payment_intent, notes, created_at"
      )
      .order("stay", { ascending: false })
      .limit(100),
    db.from("blocked_dates").select("id, span, reason, feed_id").order("span"),
    db
      .from("ical_feeds")
      .select("id, label, url, active, last_synced_at, last_status, last_error, last_event_count")
      .order("created_at"),
  ]);

  const icalToken = process.env.ICAL_FEED_TOKEN;
  const today = propertyToday();
  const feedError = (await searchParams).feedError;

  // Read server-side so a page the owner has already dismissed the notice on
  // never flashes the tall card up before hydration collapses it.
  const noticeDismissed = (await cookies()).get(SYNC_NOTICE_COOKIE)?.value === "1";

  return (
    <div>
      <PageTitle>Calendar &amp; Bookings</PageTitle>

      {/* Bookings table */}
      <SectionTitle className="mt-8">All bookings</SectionTitle>
      <Card variant="flat" className="mt-3 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-3 py-2">Dates</th>
              <th className="px-3 py-2">Guest</th>
              <th className="px-3 py-2">Party</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((b) => {
              const { checkIn, checkOut } = parseStay(b.stay);
              return (
                <tr key={b.id} className="border-t border-line align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{checkIn} → {checkOut}</td>
                  <td className="px-3 py-2">
                    {b.guest_name}
                    <br />
                    <span className="text-xs text-ink-subtle">{b.guest_email}</span>
                    {b.guest_phone && (
                      <>
                        <br />
                        <span className="text-xs text-ink-subtle">{b.guest_phone}</span>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {b.guests}g{b.pets ? ` ${b.pets}d` : ""}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatUSD(b.total_cents / 100)}
                    {/* Tax is inside the total, never on top of it — see @/lib/pricing. */}
                    <span className="block text-xs text-ink-subtle">
                      incl. {formatUSD(computeLodgingTax(b.total_cents).totalTaxCents / 100)} tax
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {b.status}
                    {b.notes && <p className="text-xs text-ink-subtle">{b.notes}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Link
                        href={`/admin/messages/${b.id}`}
                        className={buttonClasses("secondary", "sm")}
                      >
                        Message
                      </Link>
                      {b.status === "pending" && (
                        <form action={setBookingStatus}>
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="status" value="confirmed" />
                          <Button type="submit" variant="secondary" size="sm">Confirm</Button>
                        </form>
                      )}
                      {b.status === "confirmed" && (
                        <form action={setBookingStatus}>
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="status" value="completed" />
                          <Button type="submit" variant="secondary" size="sm">Complete</Button>
                        </form>
                      )}
                      {(b.status === "pending" || b.status === "confirmed") &&
                        (b.stripe_payment_intent ? (
                          <RefundControls
                            id={b.id}
                            guestName={b.guest_name}
                            checkIn={checkIn}
                            today={today}
                            totalCents={b.total_cents}
                          />
                        ) : (
                          <form action={setBookingStatus}>
                            <input type="hidden" name="id" value={b.id} />
                            <input type="hidden" name="status" value="cancelled" />
                            <Button type="submit" variant="danger" size="sm">Cancel</Button>
                          </form>
                        ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Block dates */}
      <Card variant="flat" className="mt-6 p-4">
        <SectionTitle as="h2" className="text-lg">Block dates</SectionTitle>
        <form action={blockDates} className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="First night" htmlFor="block-from" className="w-40">
            <Input id="block-from" type="date" name="from" required />
          </Field>
          <Field label="Reopen on (checkout day)" htmlFor="block-to" className="w-40">
            <Input id="block-to" type="date" name="to" required />
          </Field>
          <Field label="Reason (optional)" htmlFor="block-reason" className="w-48">
            <Input id="block-reason" type="text" name="reason" placeholder="Family visit" />
          </Field>
          <Button type="submit" size="sm">Block</Button>
        </form>
        {(blocks ?? []).length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {(blocks ?? []).map((b) => {
              const { checkIn, checkOut } = parseStay(b.span);
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 rounded bg-surface-sunken px-3 py-2">
                  <span className="min-w-0">
                    {checkIn} → {checkOut}
                    {b.reason && <span className="text-ink-subtle"> · {b.reason}</span>}
                  </span>
                  {b.feed_id ? (
                    // No Unblock button for an imported block: the next sync
                    // would bring it straight back, because the other site
                    // still has the stay. Pause or remove the feed instead.
                    <span className="shrink-0 text-xs text-ink-subtle">
                      imported — manage above
                    </span>
                  ) : (
                    <form action={unblockDates} className="shrink-0">
                      <input type="hidden" name="id" value={b.id} />
                      <Button type="submit" variant="secondary" size="sm">Unblock</Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Manual booking */}
      <Card variant="flat" className="mt-6 p-4">
        <SectionTitle as="h2" className="text-lg">Add a manual booking (phone / walk-in)</SectionTitle>
        <form action={createManualBooking} className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Check-in" htmlFor="manual-from" className="w-40">
            <Input id="manual-from" type="date" name="from" required />
          </Field>
          <Field label="Check-out" htmlFor="manual-to" className="w-40">
            <Input id="manual-to" type="date" name="to" required />
          </Field>
          <Field label="Guest name" htmlFor="manual-name" className="w-48">
            <Input id="manual-name" type="text" name="name" required />
          </Field>
          <Field label="Email (optional)" htmlFor="manual-email" className="w-56">
            <Input id="manual-email" type="email" name="email" />
          </Field>
          <Field label="Guests" htmlFor="manual-guests" className="w-20">
            <Input id="manual-guests" type="number" name="guests" min={1} max={6} defaultValue={2} />
          </Field>
          <Field label="Dogs" htmlFor="manual-pets" className="w-20">
            <Input id="manual-pets" type="number" name="pets" min={0} max={2} defaultValue={0} />
          </Field>
          <Button type="submit" size="sm">Add booking</Button>
        </form>
        <p className="mt-2 text-xs text-ink-subtle">
          Priced automatically from the current rates; marked as confirmed (collect payment
          yourself).
        </p>
      </Card>

      {/* Sync info, then the feeds themselves. Both sit below the day-to-day
          work: they are reference and setup you need on the day you add a
          listing and rarely again. */}
      <SyncNotice
        defaultOpen={!noticeDismissed}
        title="Sharing this calendar with other sites"
        summary="One of these links shows guest names — keep it to yourself."
      >
        <p className="mt-2 text-ink-muted">
          <strong className="text-ink">Your own calendar.</strong> Subscribe from Google Calendar
          (Settings → Add calendar → From URL), or Apple Calendar, using{" "}
          <code className="rounded bg-surface-sunken px-1 break-all">
            {SITE.url}/api/ical{icalToken ? `?key=${icalToken}` : ""}
          </code>
          {icalToken
            ? " — this link is private and includes guest names, so don't give it to a listing site."
            : " — set ICAL_FEED_TOKEN to get a private link with guest names on it."}
        </p>
        <p className="mt-2 text-ink-muted">
          <strong className="text-ink">Other listing sites.</strong> Give Airbnb or VRBO the link
          shown beside their feed under &ldquo;Import calendars from other sites&rdquo; below, so
          they block the nights sold here. Those links say only which dates are busy — never who is
          staying.
        </p>
        <p className="mt-2 text-ink-muted">
          Each site gets its own link because a link leaves out that site&apos;s own reservations.
          Handing a site back the events it just gave you means a stay cancelled there is still
          blocked here, which then re-blocks it there, and nothing on either site explains why.
          Without a feed of their own, the plain{" "}
          <code className="rounded bg-surface-sunken px-1 break-all">{SITE.url}/api/ical</code> is
          fine.
        </p>
      </SyncNotice>

      {/* Imported calendars */}
      <Card variant="flat" className="mt-6 p-4">
        <SectionTitle as="h2" className="text-lg">
          Import calendars from other sites
        </SectionTitle>
        <p className="mt-1 text-sm text-ink-muted">
          Paste the iCal export link from Airbnb, VRBO or anywhere else the house is listed. Stays
          booked there will block these dates automatically.
        </p>
        <form action={addIcalFeed} className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Site name" htmlFor="feed-label" className="w-40">
            <Input id="feed-label" type="text" name="label" placeholder="Airbnb" required />
          </Field>
          <Field label="Calendar link (iCal / .ics)" htmlFor="feed-url" className="w-96 max-w-full">
            <Input
              id="feed-url"
              type="text"
              name="url"
              inputMode="url"
              placeholder="https://www.airbnb.com/calendar/ical/12345.ics?s=…"
              required
            />
          </Field>
          <Button type="submit" size="sm">Add &amp; import</Button>
        </form>
        {feedError && (
          <p role="alert" className="mt-2 text-sm text-clay">
            {feedError}
          </p>
        )}

        {(feeds ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-ink-subtle">No calendars imported yet.</p>
        ) : (
          <>
            <ul className="mt-4 space-y-2 text-sm">
              {(feeds ?? []).map((f) => (
                <li key={f.id} className="rounded bg-surface-sunken px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-semibold text-ink">{f.label}</span>
                      {!f.active && (
                        <span className="ml-2 rounded-full bg-line-strong px-2 py-0.5 text-xs text-ink-muted">
                          paused
                        </span>
                      )}
                      <span className="ml-2 text-xs text-ink-subtle">
                        {f.last_status === "error" ? (
                          <span className="text-clay">
                            failed {timeAgo(f.last_synced_at)}
                          </span>
                        ) : (
                          <>
                            {f.last_event_count} date
                            {f.last_event_count === 1 ? "" : "s"} blocked · synced{" "}
                            {timeAgo(f.last_synced_at)}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1">
                      <form action={syncIcalFeeds}>
                        <input type="hidden" name="id" value={f.id} />
                        <Button type="submit" variant="secondary" size="sm">Sync now</Button>
                      </form>
                      <form action={setIcalFeedActive}>
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="active" value={f.active ? "false" : "true"} />
                        <Button type="submit" variant="ghost" size="sm">
                          {f.active ? "Pause" : "Resume"}
                        </Button>
                      </form>
                      <form action={removeIcalFeed}>
                        <input type="hidden" name="id" value={f.id} />
                        <Button type="submit" variant="danger" size="sm">Remove</Button>
                      </form>
                    </div>
                  </div>
                  {f.last_status === "error" && f.last_error && (
                    // Dates already imported stay blocked through a failure, so
                    // say that plainly — the question this raises is always
                    // "are my dates open right now?".
                    <p className="mt-1 text-xs text-clay">
                      {f.last_error} Previously imported dates are still blocked.
                    </p>
                  )}
                  <p className="mt-1 text-xs break-all text-ink-subtle">
                    Give {f.label} this link:{" "}
                    <code className="rounded bg-surface px-1">
                      {SITE.url}/api/ical?source={f.id}
                    </code>
                  </p>
                </li>
              ))}
            </ul>
            <form action={syncIcalFeeds} className="mt-3">
              <Button type="submit" variant="secondary" size="sm">Sync all now</Button>
            </form>
          </>
        )}
        <p className="mt-3 text-xs text-ink-subtle">
          Calendars refresh on their own — in the background when someone opens the booking page,
          again right before a guest pays, and once a day on a schedule. &ldquo;Sync now&rdquo; is
          for when you want to see it happen.
        </p>
      </Card>
    </div>
  );
}
