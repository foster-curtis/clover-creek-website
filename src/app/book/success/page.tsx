import Link from "next/link";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  let booking: { guest_name: string; stay: string; status: string } | null = null;
  if (session_id && hasServiceRole()) {
    const { data } = await supabaseAdmin()
      .from("bookings")
      .select("guest_name, stay, status")
      .eq("stripe_session_id", session_id)
      .single();
    booking = data;
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="rounded-2xl border border-stone-200 bg-white p-10">
        <p className="text-5xl">🌾</p>
        <h1 className="mt-4 text-3xl font-bold text-stone-800">
          {booking?.status === "confirmed" ? "You're booked!" : "Payment received"}
        </h1>
        <p className="mt-3 text-stone-600">
          {booking
            ? `Thanks, ${booking.guest_name.split(" ")[0]}! A confirmation email with your dates,
               price breakdown and arrival details is on its way.`
            : `Thanks! Your payment is processing — a confirmation email with your dates and
               arrival details will arrive shortly.`}
        </p>
        <p className="mt-3 text-sm text-stone-500">
          Check-in from {SITE.checkInTime} · Check-out by {SITE.checkOutTime}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/account"
            className="rounded-full bg-moss px-6 py-2.5 font-semibold text-white hover:bg-moss-dark"
          >
            View my booking
          </Link>
          <Link
            href="/house-rules"
            className="rounded-full border border-stone-300 px-6 py-2.5 text-stone-700 hover:border-moss hover:text-moss"
          >
            House rules
          </Link>
        </div>
      </div>
    </div>
  );
}
