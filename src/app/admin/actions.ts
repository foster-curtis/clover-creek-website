"use server";

// Admin server actions. Every action re-verifies the admin role server-side
// before touching data with the service-role client.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { blocked, done, moneyMoved, type ActionResult } from "@/lib/actionResult";
import { BLOCKED_DATES_CONFLICT, isDatesTaken } from "@/lib/availability";
import {
  describeRefundAction,
  propertyToday,
  resolveRefund,
  type RefundInstruction,
  type ResolvedRefund,
} from "@/lib/cancellation";
import { getHolidays, getPricing } from "@/lib/data";
import {
  normalizeFeedUrl,
  syncAllFeeds,
  syncFeed,
  type IcalFeed,
} from "@/lib/icalSync";
import {
  notifyOwnerCancellation,
  sendCancellationConfirmation,
  PLACEHOLDER_GUEST_EMAIL,
} from "@/lib/email";
import { formatUSD, parseStay, quoteStay, validateStay } from "@/lib/pricing";
import { countsAsRefunded } from "@/lib/refunds";
import { SITE } from "@/lib/site";
import { isAdminUser, supabaseAdmin } from "@/lib/supabase/server";

async function requireAdmin() {
  if (!(await isAdminUser())) throw new Error("Not authorized");
  return supabaseAdmin();
}

function revalidatePublic() {
  for (const path of ["/", "/gallery", "/book", "/reviews", "/blog", "/house-rules", "/faq"]) {
    revalidatePath(path);
  }
}

// --- site content ---------------------------------------------------------

export async function saveContent(formData: FormData) {
  const db = await requireAdmin();
  const slug = String(formData.get("slug"));
  const content = String(formData.get("content") ?? "").trim();
  await db
    .from("site_content")
    .upsert({ slug, content, updated_at: new Date().toISOString() });
  revalidatePublic();
  revalidatePath("/admin/content");
}

// --- pricing & holidays ---------------------------------------------------

export async function savePricing(formData: FormData) {
  const db = await requireAdmin();
  const num = (name: string) => Number(formData.get(name));
  await db
    .from("pricing_config")
    .update({
      weekday_base: num("weekdayBase"),
      weekend_base: num("weekendBase"),
      extra_guest_weekday: num("extraGuestWeekday"),
      extra_guest_weekend: num("extraGuestWeekend"),
      pet_fee_per_day: num("petFeePerDay"),
      max_guests: num("maxGuests"),
      max_pets: num("maxPets"),
      pet_weight_limit_lbs: num("petWeightLimitLbs"),
      min_stay_nights: num("minStayNights"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  revalidatePublic();
  revalidatePath("/admin/pricing");
}

export async function addHoliday(formData: FormData) {
  const db = await requireAdmin();
  const day = String(formData.get("day"));
  const label = String(formData.get("label") ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(day) && label) {
    await db.from("holidays").upsert({ day, label });
  }
  revalidatePath("/admin/pricing");
  revalidatePath("/book");
}

export async function deleteHoliday(formData: FormData) {
  const db = await requireAdmin();
  await db.from("holidays").delete().eq("day", String(formData.get("day")));
  revalidatePath("/admin/pricing");
  revalidatePath("/book");
}

// --- calendar: blocks, manual bookings, status changes ---------------------

/**
 * Block dates by hand. The database refuses a block over a live booking (the
 * 0008 trigger), and the owner needs to hear which booking is in the way — so,
 * like refundBooking, the outcome is returned rather than thrown past
 * production's redaction.
 */
export async function blockDates(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const db = await requireAdmin();
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return blocked("Choose both dates. Nothing was blocked.");
  if (from >= to)
    return blocked("The reopen date has to be after the first night. Nothing was blocked.");

  // A hold that timed out but hasn't been swept yet still reads as pending, and
  // would refuse the block for a guest who is long gone.
  await db.rpc("expire_stale_holds");

  const span = `[${from},${to})`;
  const { error } = await db.from("blocked_dates").insert({ span, reason });
  if (error) {
    if (error.code === BLOCKED_DATES_CONFLICT) return blocked(await datesInUse(db, span, error.message));
    return blocked(`Couldn't block those dates: ${error.message}. Nothing was blocked.`);
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/book");
  return done(`Blocked ${from} → ${to}.`);
}

/**
 * Names every live booking on the dates, by guest, for the owner. The trigger's
 * message deliberately says nothing about the row in the way (see 0008), so the
 * detail comes from this lookup, made as the owner; the message is the fallback
 * if it comes back empty (the booking was cancelled in between) or fails.
 */
async function datesInUse(
  db: ReturnType<typeof supabaseAdmin>,
  span: string,
  triggerMessage: string
): Promise<string> {
  const { data: inTheWay } = await db
    .from("bookings")
    .select("guest_name, stay, status, hold_expires_at")
    .in("status", ["pending", "confirmed"])
    .overlaps("stay", span)
    .order("stay");
  if (!inTheWay?.length) return `Nothing was blocked: ${triggerMessage}.`;

  const holdEnds = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE.location.timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  const reasons = inTheWay.map((b) => {
    const { checkIn, checkOut } = parseStay(b.stay);
    const dates = `${checkIn} → ${checkOut}`;
    // blockDates swept expired holds first, so a pending one with a hold is a
    // guest at Stripe right now. Cancelling it wouldn't close their checkout —
    // they could still pay, and a payment is let through a block — so the only
    // safe advice is to wait.
    if (b.status === "pending" && b.hold_expires_at)
      return (
        `${b.guest_name} is paying for ${dates} right now; their hold ends at ` +
        `${holdEnds.format(new Date(b.hold_expires_at))} — try again after that.`
      );
    return (
      `${b.guest_name}'s ${b.status} booking (${dates}) is on those dates — cancel or move ` +
      "it first, or block the nights around it."
    );
  });
  return `Nothing was blocked. ${reasons.join(" ")}`;
}

// Only the owner's own blocks can be lifted here. An imported one would be
// re-created by the next sync — the other site still has the stay — so the
// `.is("feed_id", null)` filter enforces at the data layer what the UI already
// says, rather than leaving an unblock that silently undoes itself.
export async function unblockDates(formData: FormData) {
  const db = await requireAdmin();
  await db
    .from("blocked_dates")
    .delete()
    .eq("id", String(formData.get("id")))
    .is("feed_id", null);
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
}

/**
 * A refused booking comes back as a redirect carrying the reason, as addIcalFeed
 * does, rather than a thrown error that production would redact to a digest:
 * "those dates are blocked" is the whole of what the owner needs to read.
 */
export async function createManualBooking(formData: FormData) {
  const db = await requireAdmin();
  const checkIn = String(formData.get("from"));
  const checkOut = String(formData.get("to"));
  const guests = Number(formData.get("guests") ?? 2);
  const pets = Number(formData.get("pets") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || PLACEHOLDER_GUEST_EMAIL;

  const pricing = await getPricing();
  const stay = { checkIn, checkOut, guests, pets };
  if (!name || validateStay(stay, pricing)) return;

  const holidays = await getHolidays();
  const quote = quoteStay(stay, holidays, pricing);
  // An expired hold not yet swept would otherwise be reported as an overlap.
  await db.rpc("expire_stale_holds");
  const { error } = await db.from("bookings").insert({
    guest_name: name,
    guest_email: email,
    stay: `[${checkIn},${checkOut})`,
    guests,
    pets,
    quote,
    total_cents: quote.totalCents,
    status: "confirmed",
    notes: "manual booking (phone/walk-in)",
  });
  // An overlap used to vanish here without a word: the page reloaded and the
  // booking simply wasn't there.
  if (error)
    manualBookingError(
      isDatesTaken(error.code)
        ? "That booking wasn't added: those dates overlap another booking or blocked dates."
        : `That booking wasn't added: ${error.message}`
    );
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
  // Clear any error left in the URL from a previous attempt.
  redirect("/admin/calendar");
}

function manualBookingError(message: string): never {
  redirect(`/admin/calendar?manualError=${encodeURIComponent(message)}`);
}

export async function setBookingStatus(formData: FormData) {
  const db = await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (["pending", "confirmed", "completed", "cancelled"].includes(status)) {
    await db.from("bookings").update({ status }).eq("id", id);
  }
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
}

/**
 * Cancel a booking and refund per the published policy (see @/lib/cancellation).
 * Two things override the tier for today's date: a `refundFull` submit, which
 * returns every cent Stripe still holds, and an `override` amount in dollars for
 * anything in between. Every amount is sized against what Stripe actually
 * captured rather than the booking's recorded total — see the comment below.
 * Stripe's processing fee is not returned on a refund; that cost sits with the
 * owner either way.
 *
 * Failures are returned, not thrown: production redacts a thrown Server Action
 * message to a digest, and these are the messages the owner most needs to read —
 * above all the one saying the money moved. `blocked` means nothing happened;
 * `money-moved` means the refund went out and must not be retried. Only
 * requireAdmin() still throws, since an unauthorised call is not an outcome to
 * show.
 */
export async function refundBooking(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const db = await requireAdmin();
  const id = String(formData.get("id"));
  const { data: booking } = await db
    .from("bookings")
    .select("stay, guest_name, guest_email, total_cents, stripe_payment_intent, status")
    .eq("id", id)
    .single();
  if (!booking) return blocked("Booking not found");

  // The controls only appear on pending and confirmed bookings, but this action
  // can run twice in a row — useActionState queues a second dispatch if a
  // double-click slips past the disabled buttons, and two admin tabs can do the
  // same. The second run must stop here, before Stripe, and this is money rather
  // than bookkeeping: after a 50%-tier refund the policy amount equals what
  // Stripe still holds, so a second policy run passes the ceiling check below and
  // refunds.create fires again — a second real payout. (A second "in full" run
  // would instead clamp to the $0 left and overwrite the first run's note with
  // "no refund".)
  if (booking.status !== "pending" && booking.status !== "confirmed")
    return blocked(
      `This booking is already ${booking.status} — nothing was refunded and no money moved.`
    );

  const { checkIn } = parseStay(booking.stay);
  const cancelledOn = propertyToday();

  // The full-refund submit wins over a typed amount: if the owner clicked it,
  // whatever is sitting in the override box is not what they asked for.
  const overrideRaw = String(formData.get("override") ?? "").trim();
  const instruction: RefundInstruction = formData.get("refundFull")
    ? { kind: "full" }
    : overrideRaw
      ? { kind: "amount", dollars: overrideRaw }
      : { kind: "policy" };

  // `total_cents` is what the booking was *priced* at. What can be refunded is
  // what Stripe actually captured and still holds, and the two are not the same
  // fact: an earlier partial refund, a payment intent attached by hand, or a
  // price corrected after payment all separate them. Refunding the nominal
  // total then either overshoots the charge — Stripe rejects it — or, if the
  // charge were larger, quietly returns too little. So ask Stripe first and
  // size everything against the money.
  let stripe: Stripe | null = null;
  let basisCents = booking.total_cents;
  let refundableCents: number | null = null;

  if (booking.stripe_payment_intent) {
    // Without the key we cannot move the money, and cancelling anyway would
    // tell the guest their refund is coming when it never will. Fail instead.
    if (!process.env.STRIPE_SECRET_KEY)
      return blocked("STRIPE_SECRET_KEY is not set — refusing to record a refund Stripe never issued");
    const { default: StripeSdk } = await import("stripe");
    stripe = new StripeSdk(process.env.STRIPE_SECRET_KEY);
    try {
      const [intent, refunds] = await Promise.all([
        stripe.paymentIntents.retrieve(booking.stripe_payment_intent),
        stripe.refunds.list({ payment_intent: booking.stripe_payment_intent, limit: 100 }),
      ]);
      const alreadyRefunded = refunds.data
        .filter(countsAsRefunded)
        .reduce((sum, r) => sum + r.amount, 0);
      basisCents = intent.amount_received;
      refundableCents = intent.amount_received - alreadyRefunded;
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      // A returned value is not logged the way a thrown error was.
      console.warn("Refund blocked: couldn't read the payment from Stripe", {
        bookingId: id,
        reason: why,
      });
      return blocked(
        `Couldn't read the payment from Stripe: ${why}. The booking was not cancelled and no money moved.`
      );
    }
  }

  // Sized against what Stripe holds, so an override the page accepted (it checks
  // the booking's total) can still be too big here. That is the owner's to read
  // too, and it happens before any Stripe write.
  let resolved: ResolvedRefund;
  try {
    resolved = resolveRefund(instruction, checkIn, cancelledOn, basisCents);
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return blocked(`${why}. The booking was not cancelled and no money moved.`);
  }
  const { policy: outcome, overridden, full } = resolved;
  let refundCents = resolved.refundCents;

  if (refundableCents !== null && refundCents > refundableCents) {
    // "In full" means every cent still held, so an earlier partial refund just
    // lowers the ceiling rather than making the request impossible. A number the
    // owner typed is a specific intent, and quietly shrinking it would hide that
    // this payment is not what they think it is.
    if (instruction.kind === "full") refundCents = refundableCents;
    else
      return blocked(
        `Stripe holds ${formatUSD(refundableCents / 100)} for this booking, less than the ` +
          `${formatUSD(refundCents / 100)} requested. The booking was not cancelled and no money moved.`
      );
  }

  // What Stripe handed back, so the record carries Stripe's id, amount and clock.
  // Null for a $0 outcome or a booking with no payment on file: no money left,
  // so nothing is recorded as refunded and the success message says so.
  let refund: Stripe.Refund | null = null;
  if (refundCents > 0 && stripe && booking.stripe_payment_intent) {
    try {
      refund = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent,
        amount: refundCents,
      });
    } catch (e) {
      // Stripe still refuses for reasons we can't see up front — a charge past
      // the ~180-day refund window, a dispute, insufficient balance. Say which,
      // and say plainly that the booking is untouched, because the next question
      // is always "did it half happen?". Nothing below this line has run.
      const why = e instanceof Error ? e.message : String(e);
      console.warn("Refund blocked: Stripe refused the refund", { bookingId: id, reason: why });
      return blocked(
        `Stripe refused the refund: ${why}. The booking was not cancelled and no money moved.`
      );
    }
  }

  // The clamped amount: after an earlier partial refund "in full" sends less
  // than resolved.refundCents, and the note and row must say what actually moved.
  const described = describeRefundAction({ ...resolved, refundCents });
  const note = `cancelled · ${described}`;
  // One transaction: the refund row and the cancellation are saved together or
  // not at all, so there is one way for this to fail and the message below can
  // say exactly what is missing. `notes` stays human-readable prose; the row is
  // what the tax report counts (bookings.refund_cents is summed from the rows by
  // trigger now, and never written here), dated by Stripe's clock.
  //
  // The row is written admin-wins. This refund fires charge.refunded too, and
  // if that webhook got here first it recorded the refund as a dashboard one
  // and, for a full refund, cancelled the booking with the dashboard's note.
  // This knows for certain it issued the id, so it claims the row and its note
  // replaces that one. Whichever lands first, the end state is one admin row.
  // See 0009_refunds_as_rows.sql, point 4.
  const { error: writeError } = await db.rpc("record_admin_refund", {
    p_booking_id: id,
    p_notes: note,
    ...(refund
      ? {
          p_refund_id: refund.id,
          p_amount_cents: refund.amount,
          p_issued_at: new Date(refund.created * 1000).toISOString(),
          p_reason: described,
        }
      : {}),
  });

  if (writeError) {
    if (!refund) {
      return blocked(
        `Saving the cancellation failed: ${writeError.message}. The booking was not cancelled and no money moved.`
      );
    }
    // Every other failure in this action happens before Stripe and ends with
    // "no money moved". This one is the opposite: the guest has been refunded
    // and we failed to write it down. Left unsaid, the booking still reads
    // confirmed, the dates stay blocked, and the lodging tax report counts a
    // receipt that was handed back. There is no safe automatic recovery —
    // re-refunding would send the money twice — so name the row, the amount and
    // Stripe's refund id, and hand it to the owner. The server log keeps the
    // full error; returning the message (rather than throwing it) is what gets
    // it past production's redaction, and the `money-moved` severity is what
    // makes the form lock its buttons.
    console.error("Refund succeeded but recording it failed", {
      bookingId: id,
      refundId: refund.id,
      refundCents,
      writeError,
    });
    return moneyMoved(
      `The refund of ${formatUSD(refundCents / 100)} WENT THROUGH (Stripe refund ${refund.id}), ` +
        `but saving it failed: ${writeError.message}. The guest has their money. Nothing was ` +
        `saved here: booking ${id} still shows as confirmed, its dates are still blocked, and this ` +
        `refund is not recorded here, so the tax report still counts it as money received. ` +
        `Stripe's webhook normally records the refund within a minute, so check the booking's ` +
        `refund lines on this page before changing anything. If it never appears, set the booking to ` +
        `cancelled by hand. Do not refund it again. No cancellation email was sent, so tell ` +
        `the guest yourself.`
    );
  }

  // Matches the booking flow: the guest gets a confirmation, the owner a record.
  const emailInfo = {
    guestName: booking.guest_name,
    guestEmail: booking.guest_email,
    checkIn,
    totalCents: booking.total_cents,
    refundCents,
    percent: overridden ? null : outcome.percent,
    tierLabel: outcome.tier.label,
    full,
  };
  if (booking.guest_email) await sendCancellationConfirmation(emailInfo);
  await notifyOwnerCancellation(emailInfo);

  revalidatePath("/admin/calendar");
  revalidatePath("/account");
  revalidatePath("/book");

  // Keyed on whether Stripe was actually called, not on the amount: a $0
  // outcome (nothing due under the policy, or Stripe already holds nothing)
  // never reached Stripe, so don't say money was refunded.
  return done(
    refund
      ? `Refunded ${formatUSD(refundCents / 100)} and cancelled the booking.`
      : "Cancelled the booking. No refund was issued."
  );
}

// --- calendar: imported feeds ----------------------------------------------
// Subscriptions to the other sites the house is listed on. Their events become
// blocked_dates rows tagged with the feed; see @/lib/icalSync.

/**
 * Add a feed and import it straight away.
 *
 * The first sync runs inline rather than waiting for the daily one, because
 * pasting a link and watching nothing happen reads as a failure — and if the
 * link is wrong, this is the moment to find out.
 *
 * A bad link comes back as a redirect carrying the reason, not a thrown error
 * like most of this file: production replaces a thrown message with a generic
 * one (see admin/error.tsx), and mistyping a URL is an everyday slip that has
 * to say what was wrong with it, next to the field, with the page still there.
 * refundBooking returns its failures for the first of those reasons.
 */
export async function addIcalFeed(formData: FormData) {
  const db = await requireAdmin();
  const label = String(formData.get("label") ?? "").trim();
  const normalized = normalizeFeedUrl(String(formData.get("url") ?? ""));

  if (!label) return feedError("Give the feed a name, like “Airbnb”.");
  if ("error" in normalized) return feedError(normalized.error);

  const { data: feed, error } = await db
    .from("ical_feeds")
    .insert({ label, url: normalized.url })
    .select("id, label, url")
    .single();
  if (error || !feed) return feedError(error?.message ?? "Could not save the feed.");

  // Whether this first sync succeeds is shown on the feed's own row, where
  // every later sync reports too — one place to look rather than two.
  await syncFeed(db, feed as IcalFeed);
  revalidateCalendar();
  // Clear any error left in the URL from a previous attempt.
  redirect("/admin/calendar");
}

function feedError(message: string): never {
  redirect(`/admin/calendar?feedError=${encodeURIComponent(message)}`);
}

export async function removeIcalFeed(formData: FormData) {
  const db = await requireAdmin();
  // The blocks go with it — `on delete cascade` on blocked_dates.feed_id — so
  // removing a listing reopens the nights only that listing was holding.
  await db.from("ical_feeds").delete().eq("id", String(formData.get("id")));
  revalidateCalendar();
}

/**
 * Pause or resume a feed.
 *
 * Pausing stops syncing and leaves the nights it has already blocked alone,
 * which is what you want while a feed is misbehaving: stop believing it, but
 * don't throw open dates that may well still be sold.
 */
export async function setIcalFeedActive(formData: FormData) {
  const db = await requireAdmin();
  await db
    .from("ical_feeds")
    .update({ active: formData.get("active") === "true" })
    .eq("id", String(formData.get("id")));
  revalidateCalendar();
}

/** Sync one feed, or all of them when no id is given. */
export async function syncIcalFeeds(formData: FormData) {
  const db = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  if (id) {
    const { data: feed } = await db
      .from("ical_feeds")
      .select("id, label, url")
      .eq("id", id)
      .single();
    if (feed) await syncFeed(db, feed as IcalFeed);
  } else {
    await syncAllFeeds(db);
  }

  // Failures are recorded on the feed row and shown on the page rather than
  // thrown: with several feeds, one being down shouldn't replace the whole
  // screen with an error boundary and hide the others' results.
  revalidateCalendar();
}

function revalidateCalendar() {
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
}

// Photos are no longer editable here — they live in src/content/gallery.ts and
// public/gallery/, so alt text and captions are reviewed in a diff and image
// weights are set at commit time. See README.md, "Adding or changing photos".

// --- reviews ----------------------------------------------------------------

export async function setReviewApproval(formData: FormData) {
  const db = await requireAdmin();
  await db
    .from("reviews")
    .update({ approved: formData.get("approved") === "true" })
    .eq("id", String(formData.get("id")));
  revalidatePublic();
  revalidatePath("/admin/reviews");
}

export async function setReviewFeatured(formData: FormData) {
  const db = await requireAdmin();
  await db
    .from("reviews")
    .update({ featured: formData.get("featured") === "true" })
    .eq("id", String(formData.get("id")));
  revalidatePublic();
  revalidatePath("/admin/reviews");
}

export async function deleteReview(formData: FormData) {
  const db = await requireAdmin();
  await db.from("reviews").delete().eq("id", String(formData.get("id")));
  revalidatePublic();
  revalidatePath("/admin/reviews");
}

export async function importReview(formData: FormData) {
  const db = await requireAdmin();
  const authorName = String(formData.get("authorName") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const rating = Number(formData.get("rating"));
  const stayedOn = String(formData.get("stayedOn") ?? "");
  if (!authorName || !body || !Number.isInteger(rating) || rating < 1 || rating > 5) return;
  await db.from("reviews").insert({
    author_name: authorName,
    body,
    rating,
    stayed_on: /^\d{4}-\d{2}-\d{2}$/.test(stayedOn) ? stayedOn : null,
    verified: false,
    approved: true, // imported by the owner, so pre-approved
  });
  revalidatePublic();
  revalidatePath("/admin/reviews");
}

// Imported reviews (no user_id — never submitted through the site) are the
// only ones an owner can edit. The `.is("user_id", null)` filter enforces
// that at the data layer too, so a customer's review can't be edited even if
// a request were crafted to try.
export async function updateReview(formData: FormData) {
  const db = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const authorName = String(formData.get("authorName") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const rating = Number(formData.get("rating"));
  const stayedOn = String(formData.get("stayedOn") ?? "");
  if (!id || !authorName || !body || !Number.isInteger(rating) || rating < 1 || rating > 5) return;
  await db
    .from("reviews")
    .update({
      author_name: authorName,
      body,
      rating,
      stayed_on: /^\d{4}-\d{2}-\d{2}$/.test(stayedOn) ? stayedOn : null,
    })
    .eq("id", id)
    .is("user_id", null);
  revalidatePublic();
  revalidatePath("/admin/reviews");
}

// --- blog --------------------------------------------------------------------

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export async function savePost(formData: FormData) {
  const db = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim() || null;
  const published = formData.get("published") === "on";
  if (!title || !body) return;

  const slug = String(formData.get("slug") ?? "").trim() || slugify(title);
  const row = {
    title,
    slug,
    excerpt,
    body,
    published,
    published_at: published ? new Date().toISOString() : null,
  };
  if (id) {
    await db.from("blog_posts").update(row).eq("id", id);
  } else {
    await db.from("blog_posts").insert(row);
  }
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  revalidatePath("/admin/blog");
  redirect("/admin/blog");
}

export async function deletePost(formData: FormData) {
  const db = await requireAdmin();
  await db.from("blog_posts").delete().eq("id", String(formData.get("id")));
  revalidatePath("/blog");
  revalidatePath("/admin/blog");
}

// --- messages & inquiries -----------------------------------------------------

export async function markMessagesRead(bookingId: string) {
  const db = await requireAdmin();
  await db
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("booking_id", bookingId)
    .eq("from_admin", false)
    .is("read_at", null);
}

export async function archiveInquiry(formData: FormData) {
  const db = await requireAdmin();
  await db.from("inquiries").update({ archived: true }).eq("id", String(formData.get("id")));
  revalidatePath("/admin/messages");
}
