// Stripe webhook: flips bookings to confirmed on successful payment and
// releases the dates when a checkout session expires unpaid.
//
// The status code is how Stripe learns what happened: a 2xx means "done, never
// send this again", anything else means "retry". So a failed write answers 500
// and Stripe's own retry schedule is the recovery path. That makes redelivery
// routine, so every event is claimed in stripe_events before any work runs and
// the work happens once — see @/lib/stripeEvents.

import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  notifyOwnerNewBooking,
  sendBookingConfirmation,
  type SendOutcome,
} from "@/lib/email";
import { getSiteContent } from "@/lib/content";
import { parseStay, type Quote } from "@/lib/pricing";
import {
  claimEvent,
  isBookingId,
  settleEvent,
  type Claim,
  type Settlement,
} from "@/lib/stripeEvents";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";

// Held well inside CLAIM_TIMEOUT_MS (five minutes), so a `processing` claim old
// enough to be reclaimed belongs to an attempt that has been killed, never to
// one still running.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key || !hasServiceRole()) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    const { default: StripeSdk } = await import("stripe");
    const stripe = new StripeSdk(key);
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = supabaseAdmin();

  let claim: Claim;
  try {
    claim = await claimEvent(db, event);
  } catch (err) {
    console.error(`Stripe event ${event.id}: claim failed:`, err);
    return NextResponse.json({ error: reasonOf(err) }, { status: 500 });
  }
  if (!claim.fresh) {
    // `processing` is another delivery still running it. If that attempt goes
    // on to fail, a 200 here would already have told Stripe the event was done,
    // and the retry that should recover it would never come. A 409 sends Stripe
    // back later to find it settled. `handled` and `ignored` are finished: 200.
    if (claim.status === "processing") {
      return NextResponse.json({ error: "Event is already being processed" }, { status: 409 });
    }
    return NextResponse.json({ received: true, duplicate: claim.status });
  }

  let settlement: Settlement;
  try {
    settlement = await handle(db, event);
  } catch (err) {
    const reason = reasonOf(err);
    console.error(`Stripe event ${event.id} (${event.type}) failed:`, err);
    try {
      await settleEvent(db, event.id, { status: "failed", error: reason });
    } catch (settleErr) {
      // The row stays `processing` and is reclaimable once the claim goes
      // stale, so the 500 below still brings Stripe back to a row it can take.
      console.error(`Stripe event ${event.id}: recording the failure failed too:`, settleErr);
    }
    return NextResponse.json({ error: reason }, { status: 500 });
  }

  try {
    await settleEvent(db, event.id, settlement);
  } catch (err) {
    // The work is done but not recorded. A 200 would leave the row `processing`
    // with nothing ever coming back for it; a 500 brings Stripe back, the claim
    // goes stale, and the retry runs the handler again. The booking writes are
    // safe to repeat; the emails are not, so the guest and owner may get theirs
    // twice. Accepted: a duplicate email is visible and harmless, an event that
    // silently never finished is neither.
    console.error(`Stripe event ${event.id}: settling as ${settlement.status} failed:`, err);
    return NextResponse.json({ error: reasonOf(err) }, { status: 500 });
  }

  return NextResponse.json({ received: true, status: settlement.status });
}

/**
 * Does the event's work. Throws for anything that must not be answered 2xx —
 * every failed write, including an overlap a retry may never clear.
 */
async function handle(db: SupabaseClient, event: Stripe.Event): Promise<Settlement> {
  switch (event.type) {
    case "checkout.session.completed":
      return confirm(db, event.data.object);
    case "checkout.session.expired":
      return release(db, event.data.object);
    default:
      return { status: "ignored", error: `No handler for ${event.type}` };
  }
}

async function confirm(db: SupabaseClient, session: Stripe.Checkout.Session): Promise<Settlement> {
  // Only "paid" means the money exists. "unpaid" is a delayed method (ACH,
  // Klarna, Cash App Pay) still settling: confirming now would tell the guest
  // their stay is booked before it is, and async_payment_failed is not handled,
  // so it could never be undone. "no_payment_required" is what a 100%-off
  // promotion code produces, and allow_promotion_codes is on at checkout — so
  // whether a free stay confirms needs the owner's decision (Stage 00 item 4,
  // Stage 09). Until then it is recorded here, the booking is left pending and
  // its hold lapses.
  if (session.payment_status !== "paid") {
    return {
      status: "ignored",
      error: `payment_status is "${session.payment_status}", not "paid"`,
    };
  }

  const bookingId = session.metadata?.booking_id;
  if (!isBookingId(bookingId)) return unknownBooking(bookingId);

  // Retries are routine now, and one may land after the stay has moved on. Only
  // this webhook sets stripe_payment_intent, which is what tells the two kinds
  // of `cancelled` apart: a hold that lapsed before a late payment landed has
  // none and must still confirm; a stay paid and then cancelled or refunded has
  // one, and must never be flipped back and the guest emailed. Nor may a
  // `completed` stay.
  const { data: booking, error } = await db
    .from("bookings")
    .update({
      status: "confirmed",
      hold_expires_at: null,
      stripe_payment_intent:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
    })
    .eq("id", bookingId)
    .or("status.in.(pending,confirmed),and(status.eq.cancelled,stripe_payment_intent.is.null)")
    .select("guest_name, guest_email, stay, guests, pets, quote")
    .maybeSingle();
  // This write is what Stripe retries for. Any error — the overlap constraint,
  // if the hold lapsed and the dates were resold before payment landed, or a
  // transient fault — has to reach Stripe as a 500. (A blocked date never
  // refuses it: the 0008 trigger lets a landing payment through.)
  if (error) throw new Error(`Couldn't confirm booking ${bookingId}: ${error.message}`);
  if (!booking) {
    // No such booking, or one the guard refused. Look it up to say which.
    const { data: existing, error: lookupError } = await db
      .from("bookings")
      .select("status")
      .eq("id", bookingId)
      .maybeSingle();
    if (lookupError) throw new Error(`Couldn't look up booking ${bookingId}: ${lookupError.message}`);
    if (!existing) return unknownBooking(bookingId);
    return {
      status: "ignored",
      bookingId,
      error: `Booking is ${existing.status}; not re-confirmed`,
    };
  }

  // The booking is confirmed, which is all a retry would be for. An email
  // failure from here on is recorded rather than thrown: retrying would not
  // un-confirm anything, and would re-send whichever email did get out.
  try {
    const { checkIn, checkOut } = parseStay(booking.stay);
    const content = await getSiteContent();
    const info = {
      guestName: booking.guest_name,
      guestEmail: booking.guest_email,
      checkIn,
      checkOut,
      guests: booking.guests,
      pets: booking.pets,
      quote: booking.quote as Quote,
      arrivalNotes: content.arrival_notes,
    };
    // Settled, not all: one email failing to render must not hide whether the
    // other went out.
    const [guest, owner] = await Promise.allSettled([
      sendBookingConfirmation(info),
      notifyOwnerNewBooking(info),
    ]);
    const failed = [
      emailProblem("the guest confirmation", guest),
      emailProblem("the owner notification", owner),
    ].filter(Boolean);
    if (failed.length > 0) {
      return { status: "handled", bookingId, error: `Booking confirmed, but ${failed.join(" and ")}` };
    }
  } catch (err) {
    console.error(`Booking ${bookingId} confirmed, but its emails failed:`, err);
    return {
      status: "handled",
      bookingId,
      error: `Booking confirmed, but the confirmation emails failed: ${reasonOf(err)}`,
    };
  }
  return { status: "handled", bookingId };
}

async function release(db: SupabaseClient, session: Stripe.Checkout.Session): Promise<Settlement> {
  const bookingId = session.metadata?.booking_id;
  if (!isBookingId(bookingId)) return unknownBooking(bookingId);

  // Pending only: an expired session must never cancel a booking that has
  // since been paid.
  const { data: released, error } = await db
    .from("bookings")
    .update({ status: "cancelled", notes: "checkout expired" })
    .eq("id", bookingId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Couldn't release booking ${bookingId}: ${error.message}`);
  if (released) return { status: "handled", bookingId };

  // Nothing pending to release: it was paid after all, or expire_stale_holds()
  // got there first. Both are fine. The lookup is only so the event is linked
  // to its booking — and so an id that matches nothing reads as ignored.
  const { data: existing, error: lookupError } = await db
    .from("bookings")
    .select("id")
    .eq("id", bookingId)
    .maybeSingle();
  if (lookupError) throw new Error(`Couldn't look up booking ${bookingId}: ${lookupError.message}`);
  return existing ? { status: "handled", bookingId } : unknownBooking(bookingId);
}

// A Dashboard test event, or a session something else created, names no booking
// of ours. There is nothing a retry could fix, so it is recorded and answered
// 200 — a 500 would have Stripe redeliver it for days.
function unknownBooking(bookingId: string | undefined): Settlement {
  return {
    status: "ignored",
    error: bookingId
      ? `No booking matches booking_id "${bookingId}"`
      : "No booking_id in the session metadata",
  };
}

function reasonOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Why one email didn't go out, or null. A render error rejects; a send failure resolves `failed`. */
function emailProblem(which: string, result: PromiseSettledResult<SendOutcome>): string | null {
  if (result.status === "rejected") return `${which} failed (${reasonOf(result.reason)})`;
  return result.value.status === "failed" ? `${which} failed (${result.value.error})` : null;
}
