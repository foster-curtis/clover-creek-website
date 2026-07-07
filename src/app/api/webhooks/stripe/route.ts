// Stripe webhook: flips bookings to confirmed on successful payment and
// releases the dates when a checkout session expires unpaid.

import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { sendBookingConfirmation, notifyOwnerNewBooking } from "@/lib/email";
import { getSiteContent } from "@/lib/content";
import type { Quote } from "@/lib/pricing";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";

function parseStay(stay: string): { checkIn: string; checkOut: string } {
  const m = /^[\[(]([\d-]+),([\d-]+)[)\]]$/.exec(stay);
  return { checkIn: m?.[1] ?? "", checkOut: m?.[2] ?? "" };
}

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.booking_id;
    if (bookingId) {
      const { data: booking } = await db
        .from("bookings")
        .update({
          status: "confirmed",
          hold_expires_at: null,
          stripe_payment_intent:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        })
        .eq("id", bookingId)
        .select("guest_name, guest_email, stay, guests, pets, quote")
        .single();

      if (booking) {
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
        await Promise.all([sendBookingConfirmation(info), notifyOwnerNewBooking(info)]);
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.booking_id;
    if (bookingId) {
      await db
        .from("bookings")
        .update({ status: "cancelled", notes: "checkout expired" })
        .eq("id", bookingId)
        .eq("status", "pending");
    }
  }

  return NextResponse.json({ received: true });
}
