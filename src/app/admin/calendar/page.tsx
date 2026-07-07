import { formatUSD } from "@/lib/pricing";
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

function parseStay(stay: string): { checkIn: string; checkOut: string } {
  const m = /^[\[(]([\d-]+),([\d-]+)[)\]]$/.exec(stay);
  return { checkIn: m?.[1] ?? "", checkOut: m?.[2] ?? "" };
}

const inputCls =
  "rounded border border-stone-300 bg-white px-3 py-1.5 text-sm focus:border-moss focus:outline-none";
const btnCls =
  "rounded-full bg-moss px-4 py-1.5 text-sm font-semibold text-white hover:bg-moss-dark";
const smallBtnCls =
  "rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:border-moss hover:text-moss";

export default async function AdminCalendarPage() {
  if (!hasServiceRole()) {
    return <p className="text-stone-600">Set SUPABASE_SERVICE_ROLE_KEY to manage bookings.</p>;
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800">Calendar &amp; Bookings</h1>

      {/* Sync info */}
      <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
        <p className="font-semibold text-stone-800">Calendar sync</p>
        <p className="mt-1">
          Subscribe from Google Calendar (Settings → Add calendar → From URL) using{" "}
          <code className="rounded bg-stone-100 px-1">
            {SITE.url}/api/ical{icalToken ? `?key=${icalToken}` : ""}
          </code>
          {icalToken
            ? " — this private link includes guest names."
            : " — set ICAL_FEED_TOKEN to get a private link with guest names."}{" "}
          For Airbnb/VRBO availability sync, give them the public link{" "}
          <code className="rounded bg-stone-100 px-1">{SITE.url}/api/ical</code> (busy dates only).
        </p>
      </div>

      {/* Block dates */}
      <section className="mt-6 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="font-bold text-stone-800">Block dates</h2>
        <form action={blockDates} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-stone-500">
            First night
            <input type="date" name="from" required className={inputCls + " mt-1 block"} />
          </label>
          <label className="text-xs text-stone-500">
            Reopen on (checkout day)
            <input type="date" name="to" required className={inputCls + " mt-1 block"} />
          </label>
          <label className="text-xs text-stone-500">
            Reason (optional)
            <input type="text" name="reason" placeholder="Family visit" className={inputCls + " mt-1 block"} />
          </label>
          <button type="submit" className={btnCls}>Block</button>
        </form>
        {(blocks ?? []).length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {(blocks ?? []).map((b) => {
              const { checkIn, checkOut } = parseStay(b.span);
              return (
                <li key={b.id} className="flex items-center justify-between rounded bg-stone-50 px-3 py-2">
                  <span>
                    {checkIn} → {checkOut}
                    {b.reason && <span className="text-stone-400"> · {b.reason}</span>}
                  </span>
                  <form action={unblockDates}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" className={smallBtnCls}>Unblock</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Manual booking */}
      <section className="mt-6 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="font-bold text-stone-800">Add a manual booking (phone / walk-in)</h2>
        <form action={createManualBooking} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-stone-500">
            Check-in
            <input type="date" name="from" required className={inputCls + " mt-1 block"} />
          </label>
          <label className="text-xs text-stone-500">
            Check-out
            <input type="date" name="to" required className={inputCls + " mt-1 block"} />
          </label>
          <label className="text-xs text-stone-500">
            Guest name
            <input type="text" name="name" required className={inputCls + " mt-1 block"} />
          </label>
          <label className="text-xs text-stone-500">
            Email (optional)
            <input type="email" name="email" className={inputCls + " mt-1 block"} />
          </label>
          <label className="text-xs text-stone-500">
            Guests
            <input type="number" name="guests" min={1} max={6} defaultValue={2} className={inputCls + " mt-1 block w-20"} />
          </label>
          <label className="text-xs text-stone-500">
            Dogs
            <input type="number" name="pets" min={0} max={2} defaultValue={0} className={inputCls + " mt-1 block w-20"} />
          </label>
          <button type="submit" className={btnCls}>Add booking</button>
        </form>
        <p className="mt-2 text-xs text-stone-400">
          Priced automatically from the current rates; marked as confirmed (collect payment
          yourself).
        </p>
      </section>

      {/* Bookings table */}
      <h2 className="mt-8 text-lg font-bold text-stone-800">All bookings</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
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
                <tr key={b.id} className="border-t border-stone-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{checkIn} → {checkOut}</td>
                  <td className="px-3 py-2">
                    {b.guest_name}
                    <br />
                    <span className="text-xs text-stone-400">{b.guest_email}</span>
                    {b.guest_phone && (
                      <>
                        <br />
                        <span className="text-xs text-stone-400">{b.guest_phone}</span>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {b.guests}g{b.pets ? ` ${b.pets}d` : ""}
                  </td>
                  <td className="px-3 py-2">{formatUSD(b.total_cents / 100)}</td>
                  <td className="px-3 py-2">
                    {b.status}
                    {b.notes && <p className="text-xs text-stone-400">{b.notes}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {b.status === "pending" && (
                        <form action={setBookingStatus}>
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="status" value="confirmed" />
                          <button type="submit" className={smallBtnCls}>Confirm</button>
                        </form>
                      )}
                      {b.status === "confirmed" && (
                        <form action={setBookingStatus}>
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="status" value="completed" />
                          <button type="submit" className={smallBtnCls}>Complete</button>
                        </form>
                      )}
                      {(b.status === "pending" || b.status === "confirmed") &&
                        (b.stripe_payment_intent ? (
                          <form action={refundBooking}>
                            <input type="hidden" name="id" value={b.id} />
                            <button type="submit" className={smallBtnCls + " text-red-600"}>
                              Cancel &amp; refund
                            </button>
                          </form>
                        ) : (
                          <form action={setBookingStatus}>
                            <input type="hidden" name="id" value={b.id} />
                            <input type="hidden" name="status" value="cancelled" />
                            <button type="submit" className={smallBtnCls + " text-red-600"}>
                              Cancel
                            </button>
                          </form>
                        ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
