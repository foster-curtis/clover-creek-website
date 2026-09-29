"use server";

// Admin server actions. Every action re-verifies the admin role server-side
// before touching data with the service-role client.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import {
  describeRefundAction,
  propertyToday,
  resolveRefund,
  type RefundInstruction,
} from "@/lib/cancellation";
import { getHolidays, getPricing } from "@/lib/data";
import { notifyOwnerCancellation, sendCancellationConfirmation } from "@/lib/email";
import { formatUSD, parseStay, quoteStay, validateStay } from "@/lib/pricing";
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

export async function blockDates(formData: FormData) {
  const db = await requireAdmin();
  const from = String(formData.get("from"));
  const to = String(formData.get("to"));
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from < to) {
    await db.from("blocked_dates").insert({ span: `[${from},${to})`, reason });
  }
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
}

export async function unblockDates(formData: FormData) {
  const db = await requireAdmin();
  await db.from("blocked_dates").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
}

export async function createManualBooking(formData: FormData) {
  const db = await requireAdmin();
  const checkIn = String(formData.get("from"));
  const checkOut = String(formData.get("to"));
  const guests = Number(formData.get("guests") ?? 2);
  const pets = Number(formData.get("pets") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || "manual@booking.local";

  const pricing = await getPricing();
  const stay = { checkIn, checkOut, guests, pets };
  if (!name || validateStay(stay, pricing)) return;

  const holidays = await getHolidays();
  const quote = quoteStay(stay, holidays, pricing);
  await db.from("bookings").insert({
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
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
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
 */
export async function refundBooking(formData: FormData) {
  const db = await requireAdmin();
  const id = String(formData.get("id"));
  const { data: booking } = await db
    .from("bookings")
    .select("stay, guest_name, guest_email, total_cents, stripe_payment_intent")
    .eq("id", id)
    .single();
  if (!booking) throw new Error("Booking not found");

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
    // Without the key we cannot move the money, and writing refund_cents anyway
    // would tell the guest their refund is coming and hand the lodging tax
    // report a deduction that never happened. Fail instead.
    if (!process.env.STRIPE_SECRET_KEY)
      throw new Error("STRIPE_SECRET_KEY is not set — refusing to record a refund Stripe never issued");
    const { default: StripeSdk } = await import("stripe");
    stripe = new StripeSdk(process.env.STRIPE_SECRET_KEY);
    try {
      const [intent, refunds] = await Promise.all([
        stripe.paymentIntents.retrieve(booking.stripe_payment_intent),
        stripe.refunds.list({ payment_intent: booking.stripe_payment_intent, limit: 100 }),
      ]);
      const alreadyRefunded = refunds.data
        .filter((r) => r.status !== "failed" && r.status !== "canceled")
        .reduce((sum, r) => sum + r.amount, 0);
      basisCents = intent.amount_received;
      refundableCents = intent.amount_received - alreadyRefunded;
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Couldn't read the payment from Stripe: ${why}. The booking was not cancelled and no money moved.`
      );
    }
  }

  const resolved = resolveRefund(instruction, checkIn, cancelledOn, basisCents);
  const { policy: outcome, overridden, full } = resolved;
  let refundCents = resolved.refundCents;

  if (refundableCents !== null && refundCents > refundableCents) {
    // "In full" means every cent still held, so an earlier partial refund just
    // lowers the ceiling rather than making the request impossible. A number the
    // owner typed is a specific intent, and quietly shrinking it would hide that
    // this payment is not what they think it is.
    if (instruction.kind === "full") refundCents = refundableCents;
    else
      throw new Error(
        `Stripe holds ${formatUSD(refundableCents / 100)} for this booking, less than the ` +
          `${formatUSD(refundCents / 100)} requested. The booking was not cancelled and no money moved.`
      );
  }

  if (refundCents > 0 && stripe && booking.stripe_payment_intent) {
    try {
      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent,
        amount: refundCents,
      });
    } catch (e) {
      // Stripe still refuses for reasons we can't see up front — a charge past
      // the ~180-day refund window, a dispute, insufficient balance. Say which,
      // and say plainly that the booking is untouched, because the next question
      // is always "did it half happen?". Nothing below this line has run.
      const why = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Stripe refused the refund: ${why}. The booking was not cancelled and no money moved.`
      );
    }
  }

  const note = `cancelled · ${describeRefundAction(resolved)}`;
  // `notes` stays human-readable prose; refund_cents/refunded_at are what the
  // tax report reads, and the date decides which return the refund reduces.
  const { error: writeError } = await db
    .from("bookings")
    .update({
      status: "cancelled",
      notes: note,
      refund_cents: refundCents,
      refunded_at: refundCents > 0 ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (writeError) {
    // Every other failure in this action happens before Stripe and ends with
    // "no money moved". This one is the opposite: the guest has been refunded
    // and we failed to write it down. Left unsaid, the booking still reads
    // confirmed, the dates stay blocked, and the lodging tax report counts a
    // receipt that was handed back. There is no safe automatic recovery —
    // re-refunding would send the money twice — so name the row and the amount
    // and hand it to the owner. The server log keeps the full error; the
    // message survives into production, where the error boundary shows only a
    // digest.
    console.error("Refund succeeded but the booking write failed", {
      bookingId: id,
      refundCents,
      writeError,
    });
    throw new Error(
      `The refund of ${formatUSD(refundCents / 100)} WENT THROUGH, but saving it to the ` +
        `booking failed: ${writeError.message}. The guest has their money. Booking ${id} still ` +
        `shows as confirmed and its dates are still blocked — set it to cancelled by hand, and ` +
        `do not refund it again. No cancellation email was sent, so tell the guest yourself.`
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
