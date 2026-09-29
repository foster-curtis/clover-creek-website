import Link from "next/link";
import { notFound } from "next/navigation";
import BookingChat from "@/components/BookingChat";
import { canEmail } from "@/lib/email";
import { parseStay } from "@/lib/pricing";
import { currentUser, hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageTitle } from "@/components/ui/Heading";
import { markMessagesRead } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminChatPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const user = await currentUser();
  if (!user || !hasServiceRole()) notFound();

  const db = supabaseAdmin();
  const { data: booking } = await db
    .from("bookings")
    .select("id, guest_name, guest_email, guest_phone, stay, guests, pets, status")
    .eq("id", bookingId)
    .single();
  if (!booking) notFound();

  await markMessagesRead(bookingId);
  const { checkIn, checkOut } = parseStay(booking.stay);
  const reachable = canEmail(booking.guest_email);

  return (
    <div>
      <Link
        href="/admin/messages"
        className="inline-flex items-center gap-1 text-sm text-moss underline"
      >
        <ArrowLeftIcon className="h-4 w-4" /> All messages
      </Link>
      <PageTitle className="mt-3">{booking.guest_name}</PageTitle>
      <p className="mt-1 text-sm text-ink-muted">
        {checkIn} → {checkOut} · {booking.guests} guests
        {booking.pets ? ` · ${booking.pets} dogs` : ""} · {booking.status}
        {reachable && (
          <>
            {" · "}
            <a href={`mailto:${booking.guest_email}`} className="text-moss underline">
              {booking.guest_email}
            </a>
          </>
        )}
        {booking.guest_phone && ` · ${booking.guest_phone}`}
      </p>
      {!reachable && (
        <p className="mt-3 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-stone-700">
          No email on file for this guest, so a message here won&apos;t reach them —{" "}
          {booking.guest_phone ? `call ${booking.guest_phone} instead.` : "call them instead."}
        </p>
      )}
      <div className="mt-6 max-w-2xl">
        <BookingChat bookingId={booking.id} asAdmin />
      </div>
    </div>
  );
}
