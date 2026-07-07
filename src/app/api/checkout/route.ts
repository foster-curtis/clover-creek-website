// Creates a pending booking (hard-blocked against double-booking by the DB's
// exclusion constraint) and a Stripe Checkout session. The price is always
// recomputed server-side — the client's quote is display-only.

import { NextResponse, type NextRequest } from "next/server";
import { getHolidays, getPricing } from "@/lib/data";
import { quoteStay, toISODate, validateStay } from "@/lib/pricing";
import { SITE } from "@/lib/site";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";

const HOLD_MINUTES = 30;

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

  // Insert the pending booking; the exclusion constraint rejects overlaps.
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
    const conflict = insertError?.code === "23P01"; // exclusion constraint violation
    return NextResponse.json(
      {
        error: conflict
          ? "Sorry — those dates were just booked by someone else. Please pick different dates."
          : "Could not create the booking. Please try again.",
      },
      { status: conflict ? 409 : 500 }
    );
  }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = request.headers.get("origin") ?? SITE.url;
    const nightsLabel = `${quote.nightCount} night${quote.nightCount > 1 ? "s" : ""}, ${guests} guest${guests > 1 ? "s" : ""}${pets ? `, ${pets} dog${pets > 1 ? "s" : ""}` : ""}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
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
