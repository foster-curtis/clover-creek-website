import Link from "next/link";
import { notFound } from "next/navigation";
import BookingChat from "@/components/BookingChat";
import { currentUser, hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import { markMessagesRead } from "../../actions";

export const dynamic = "force-dynamic";

function parseStay(stay: string): { checkIn: string; checkOut: string } {
  const m = /^[\[(]([\d-]+),([\d-]+)[)\]]$/.exec(stay);
  return { checkIn: m?.[1] ?? "", checkOut: m?.[2] ?? "" };
}

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
      <Link href="/admin/messages" className="text-sm text-moss underline">
        ← All messages
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-stone-800">{booking.guest_name}</h1>
      <p className="mt-1 text-sm text-stone-500">
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
