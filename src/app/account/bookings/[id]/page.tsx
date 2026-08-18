import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import BookingChat from "@/components/BookingChat";
import { fullRefundDeadline, propertyToday, refundFor } from "@/lib/cancellation";
import { formatUSD, type Quote } from "@/lib/pricing";
import { SITE } from "@/lib/site";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function parseStay(stay: string): { checkIn: string; checkOut: string } {
  const m = /^[\[(]([\d-]+),([\d-]+)[)\]]$/.exec(stay);
  return { checkIn: m?.[1] ?? "", checkOut: m?.[2] ?? "" };
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/account/bookings/${id}`);

  const supabase = await supabaseServer();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, stay, guests, pets, status, total_cents, quote, guest_name")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!booking) notFound();

  const { checkIn, checkOut } = parseStay(booking.stay);
  const quote = booking.quote as Quote | null;

  // What this booking is worth back if the guest cancels today.
  const today = propertyToday();
  const refund = refundFor(checkIn, today, booking.total_cents);
  const fullUntil = fullRefundDeadline(checkIn);
  const cancellable = booking.status === "pending" || booking.status === "confirmed";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/account" className="text-sm text-moss underline">
        ← My stays
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-stone-800">
        {checkIn} → {checkOut}
      </h1>
      <p className="mt-1 text-stone-600">
        {booking.guests} guest{booking.guests > 1 ? "s" : ""}
        {booking.pets > 0 && ` · ${booking.pets} dog${booking.pets > 1 ? "s" : ""}`} · status:{" "}
        <strong>{booking.status}</strong>
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-5 text-sm">
          <h2 className="font-bold text-stone-800">Price breakdown</h2>
          {quote ? (
            <ul className="mt-3 space-y-1 text-stone-600">
              {quote.nights.map((n) => (
                <li key={n.date} className="flex justify-between">
                  <span>
                    {n.date}
                    {n.holiday ? ` · ${n.holiday}` : n.weekendRate ? " · weekend" : ""}
                  </span>
                  <span>{formatUSD(n.subtotal)}</span>
                </li>
              ))}
              {quote.petFee > 0 && (
                <li className="flex justify-between">
                  <span>Pet fee</span>
                  <span>{formatUSD(quote.petFee)}</span>
                </li>
              )}
              <li className="flex justify-between border-t border-stone-200 pt-2 font-semibold text-stone-800">
                <span>Total (cleaning &amp; taxes included)</span>
                <span>{formatUSD(booking.total_cents / 100)}</span>
              </li>
            </ul>
          ) : (
            <p className="mt-3 text-stone-600">Total: {formatUSD(booking.total_cents / 100)}</p>
          )}
          <h2 className="mt-6 font-bold text-stone-800">Good to know</h2>
          <ul className="mt-2 space-y-1 text-stone-600">
            <li>Check-in from {SITE.checkInTime}</li>
            <li>Check-out by {SITE.checkOutTime}</li>
            <li>
              <Link href="/house-rules" className="text-moss underline">
                House rules &amp; checkout checklist
              </Link>
            </li>
          </ul>
          {cancellable && (
            <>
              <h2 className="mt-6 font-bold text-stone-800">If you need to cancel</h2>
              <p className="mt-2 text-stone-600">
                {refund.refundCents > 0 ? (
                  <>
                    Cancel today and you&apos;d be refunded{" "}
                    <strong>{formatUSD(refund.refundCents / 100)}</strong> ({refund.percent}% of{" "}
                    {formatUSD(booking.total_cents / 100)}).
                  </>
                ) : (
                  <>
                    Check-in is {refund.daysBefore < 0 ? "past" : "less than a week away"}, so a
                    cancellation now wouldn&apos;t be refunded under our policy.
                  </>
                )}
                {refund.percent === 100 && <> A full refund applies through {fullUntil}.</>}
              </p>
              <p className="mt-2 text-xs text-stone-500">
                Send a message below to cancel, or see the full{" "}
                <Link href="/faq" className="text-moss underline">
                  cancellation policy
                </Link>
                .
              </p>
            </>
          )}
        </div>

        <div>
          <h2 className="mb-2 font-bold text-stone-800">Message the host</h2>
          <BookingChat bookingId={booking.id} asAdmin={false} userId={user.id} />
        </div>
      </div>
    </div>
  );
}
