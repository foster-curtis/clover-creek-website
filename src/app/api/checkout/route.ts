// Creates a pending booking (hard-blocked against double-booking and blocked
// dates by the database — see 0001 and 0008) and a Stripe Checkout session. The
// price is always recomputed server-side — the client's quote is display-only.

import { NextResponse, type NextRequest } from "next/server";
import { isDatesTaken } from "@/lib/availability";
import { getHolidays, getPricing } from "@/lib/data";
import { syncAllFeeds } from "@/lib/icalSync";
import { quoteStay, toISODate, validateStay } from "@/lib/pricing";
import { SITE } from "@/lib/site";
import { withDeadline } from "@/lib/supabase/deadline";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";

const HOLD_MINUTES = 30;

// One answer whether a booking or a block holds the dates: to the guest they
// are simply gone, and why is not their business.
const DATES_TAKEN = "Sorry — those dates were just booked by someone else. Please pick different dates.";
const BOOKING_FAILED = "Could not create the booking. Please try again.";

/** How long the pre-checkout calendar refresh may hold up the guest. */
const SYNC_DEADLINE_MS = 2500;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: bots fill every field; humans never see this one.
  if (typeof body.website === "string" && body.website.length > 0) {
    return NextResponse.json({ error: "Unable to process request." }, { status: 400 });
  }

  const checkIn = String(body.checkIn ?? "");
  const checkOut = String(body.checkOut ?? "");
  const guests = Number(body.guests);
  const pets = Number(body.pets);
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();

  if (name.length < 2 || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "Please provide your name and a valid email." }, { status: 400 });
  }
  if (!body.rulesAccepted) {
    return NextResponse.json({ error: "Please accept the house rules." }, { status: 400 });
  }
  if (pets > 0 && !body.petPolicyAccepted) {
    return NextResponse.json({ error: "Please accept the pet policy." }, { status: 400 });
  }

  const pricing = await getPricing();
  const stay = { checkIn, checkOut, guests, pets };
  const invalid = validateStay(stay, pricing, toISODate(new Date()));
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  if (!hasServiceRole() || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Online booking isn't live yet — please use the contact page and we'll book you in directly." },
      { status: 503 }
    );
  }

  const holidays = await getHolidays();
  const quote = quoteStay(stay, holidays, pricing);

  const db = supabaseAdmin();
  await db.rpc("expire_stale_holds");

  // Last chance to hear about a stay booked on another site before we take
  // money for the same nights. Only feeds older than STALE_AFTER_MS are
  // refetched, and the whole thing is capped: a listing site being slow must
  // not stall a checkout. If the deadline passes we proceed on what we have —
  // the same position we were in before any of this existed.
  await withDeadline(syncAllFeeds(db, { onlyStale: true }), SYNC_DEADLINE_MS, []);

  // Blocked nights are greyed out on the calendar, but a tab opened before the
  // owner blocked them, or a POST that never saw a calendar, can still ask for
  // them. Checked after the refresh above so a stay just imported counts, and
  // against every block, the owner's and imported alike. The 0008 trigger would
  // refuse the insert anyway; asking here means the refusal doesn't depend on
  // that migration having reached this database. A failed read is not "no clash".
  const { data: clash, error: clashError } = await db
    .from("blocked_dates")
    .select("id")
    .overlaps("span", `[${checkIn},${checkOut})`)
    .limit(1);
  if (clashError) {
    console.error("Checkout: couldn't read blocked dates:", clashError);
    return NextResponse.json({ error: BOOKING_FAILED }, { status: 500 });
  }
  if (clash.length > 0) return NextResponse.json({ error: DATES_TAKEN }, { status: 409 });

  // Insert the pending booking; the exclusion constraint rejects an overlap
  // with another booking, the 0008 trigger one with a block.
  const { data: booking, error: insertError } = await db
    .from("bookings")
    .insert({
      guest_name: name,
      guest_email: email,
      guest_phone: phone || null,
      stay: `[${checkIn},${checkOut})`,
      guests,
      pets,
      quote,
      total_cents: quote.totalCents,
      status: "pending",
      rules_accepted_at: new Date().toISOString(),
      hold_expires_at: new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !booking) {
    const conflict = isDatesTaken(insertError?.code);
    return NextResponse.json(
      { error: conflict ? DATES_TAKEN : BOOKING_FAILED },
      { status: conflict ? 409 : 500 }
    );
  }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = request.headers.get("origin") ?? SITE.url;
    const nightsLabel = `${quote.nightCount} night${quote.nightCount > 1 ? "s" : ""}, ${guests} guest${guests > 1 ? "s" : ""}${pets ? `, ${pets} dog${pets > 1 ? "s" : ""}` : ""}`;

    const session = await stripe.checkout.sessions.create({
      ui_mode: "hosted_page",
      mode: "payment",
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      // Off by design: rates are tax-inclusive and the lodging tax is backed
      // out of the total in src/lib/pricing.ts for the owner's records.
      // Letting Stripe Tax calculate on top would charge the guest twice.
      automatic_tax: { enabled: false },
      allow_promotion_codes: true,
      submit_type: "auto",
      // No saved_payment_method_options here: guests are one-off bookers, so we
      // never create a Stripe Customer, and Stripe rejects that parameter
      // outright on a customerless session ("requires a customer"). With no
      // Customer there is nowhere to save a card, so not offering to is already
      // the behaviour — customer_email only prefills the field and the receipt.
      integration_identifier: "hosted_web_0001",
      origin_context: "web",
      customer_email: email,
      expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: quote.totalCents,
            product_data: {
              name: `${SITE.name}: ${checkIn} to ${checkOut}`,
              description: `${nightsLabel}. Cleaning fee and taxes included.`,
            },
          },
        },
      ],
      metadata: { booking_id: booking.id },
      success_url: `${origin}/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book`,
    });

    await db.from("bookings").update({ stripe_session_id: session.id }).eq("id", booking.id);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout failed:", err);
    // Free the dates again — payment never started.
    await db.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
    return NextResponse.json(
      { error: "Payment setup failed. Please try again in a moment." },
      { status: 502 }
    );
  }
}
