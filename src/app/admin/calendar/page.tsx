import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageTitle, SectionTitle } from "@/components/ui/Heading";
import { propertyToday, refundFor } from "@/lib/cancellation";
import { formatUSD, parseStay } from "@/lib/pricing";
import { SITE } from "@/lib/site";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import {
  blockDates,
  createManualBooking,
  refundBooking,
  setBookingStatus,
  unblockDates,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  if (!hasServiceRole()) {
    return <p className="text-ink-muted">Set SUPABASE_SERVICE_ROLE_KEY to manage bookings.</p>;
  }
  const db = supabaseAdmin();
  await db.rpc("expire_stale_holds");

  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    db
      .from("bookings")
      .select(
        "id, stay, guest_name, guest_email, guest_phone, guests, pets, status, total_cents, stripe_payment_intent, notes, created_at"
      )
      .order("stay", { ascending: false })
      .limit(100),
    db.from("blocked_dates").select("id, span, reason").order("span"),
  ]);

  const icalToken = process.env.ICAL_FEED_TOKEN;
  const today = propertyToday();

  return (
    <div>
      <PageTitle>Calendar &amp; Bookings</PageTitle>

      {/* Sync info */}
      <Card variant="flat" className="mt-4 p-4 text-sm text-ink-muted">
        <p className="font-semibold text-ink">Calendar sync</p>
        <p className="mt-1">
          Subscribe from Google Calendar (Settings → Add calendar → From URL) using{" "}
          <code className="rounded bg-surface-sunken px-1">
            {SITE.url}/api/ical{icalToken ? `?key=${icalToken}` : ""}
          </code>
          {icalToken
            ? " — this private link includes guest names."
            : " — set ICAL_FEED_TOKEN to get a private link with guest names."}{" "}
          For Airbnb/VRBO availability sync, give them the public link{" "}
          <code className="rounded bg-surface-sunken px-1">{SITE.url}/api/ical</code> (busy dates only).
        </p>
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
                <li key={b.id} className="flex items-center justify-between rounded bg-surface-sunken px-3 py-2">
                  <span>
                    {checkIn} → {checkOut}
                    {b.reason && <span className="text-ink-subtle"> · {b.reason}</span>}
                  </span>
                  <form action={unblockDates}>
                    <input type="hidden" name="id" value={b.id} />
                    <Button type="submit" variant="secondary" size="sm">Unblock</Button>
                  </form>
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
              const refund = refundFor(checkIn, today, b.total_cents);
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
                  <td className="px-3 py-2">{formatUSD(b.total_cents / 100)}</td>
                  <td className="px-3 py-2">
                    {b.status}
                    {b.notes && <p className="text-xs text-ink-subtle">{b.notes}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
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
                          <form action={refundBooking} className="flex flex-col gap-1">
                            <input type="hidden" name="id" value={b.id} />
                            <Button type="submit" variant="danger" size="sm">
                              Cancel &amp; refund {formatUSD(refund.refundCents / 100)}
                            </Button>
                            <span className="text-[11px] text-ink-subtle">
                              {refund.percent}% · {refund.tier.label} out
                            </span>
                            <input
                              type="number"
                              name="override"
                              step="0.01"
                              min={0}
                              max={b.total_cents / 100}
                              placeholder="override $"
                              title="Refund a different amount instead of the policy amount"
                              className="w-24 rounded border border-line px-1 py-0.5 text-[11px]"
                            />
                          </form>
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
    </div>
  );
}
