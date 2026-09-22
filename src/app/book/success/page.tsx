import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PageTitle } from "@/components/ui/Heading";
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
      <Card variant="flat" className="!rounded-2xl !p-10">
        <p className="text-5xl">🌾</p>
        <PageTitle className="mt-4">
          {booking?.status === "confirmed" ? "You're booked!" : "Payment received"}
        </PageTitle>
        <p className="mt-3 text-stone-600">
          {booking
            ? `Thanks, ${booking.guest_name.split(" ")[0]}! A confirmation email with your dates,
               price breakdown and arrival details is on its way.`
            : `Thanks! Your payment is processing — a confirmation email with your dates and
               arrival details will arrive shortly.`}
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          Check-in from {SITE.checkInTime} · Check-out by {SITE.checkOutTime}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/account" className={buttonClasses("primary", "md")}>
            View my booking
          </Link>
          <Link href="/house-rules" className={buttonClasses("secondary", "md")}>
            House rules
          </Link>
        </div>
      </Card>
    </div>
  );
}
