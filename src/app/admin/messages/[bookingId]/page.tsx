import Link from "next/link";
import { notFound } from "next/navigation";
import BookingChat from "@/components/BookingChat";
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
        {booking.pets ? ` · ${booking.pets} dogs` : ""} · {booking.status} ·{" "}
        <a href={`mailto:${booking.guest_email}`} className="text-moss underline">
          {booking.guest_email}
        </a>
        {booking.guest_phone && ` · ${booking.guest_phone}`}
      </p>
      <div className="mt-6 max-w-2xl">
        <BookingChat bookingId={booking.id} asAdmin userId={user.id} />
      </div>
    </div>
  );
}
