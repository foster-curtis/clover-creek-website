// One door for sending a booking message: the row and the email notification
// go out together, server-side. Sending them separately from the browser meant
// a message could land in the database while its notification was lost to a
// closed tab — the guest would never hear about a reply they were waiting on.

import { NextResponse, type NextRequest } from "next/server";
import { canEmail, notifyNewMessage } from "@/lib/email";
import { SITE } from "@/lib/site";
import { currentUser, hasSupabase, isAdminUser, supabaseServer } from "@/lib/supabase/server";

const MAX_BODY = 4000;

export async function POST(request: NextRequest) {
  if (!hasSupabase()) return NextResponse.json({ ok: false }, { status: 503 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let payload: { bookingId?: string; body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const bookingId = payload.bookingId;
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!bookingId || !body) return NextResponse.json({ ok: false }, { status: 400 });
  if (body.length > MAX_BODY) return NextResponse.json({ ok: false }, { status: 413 });

  // Which side of the conversation this is comes from the profile, never from
  // the request — a guest must not be able to post as the owner.
  const fromAdmin = await isAdminUser(user);
  const db = await supabaseServer();

  // The insert *is* the authorization check: RLS lets an admin write to any
  // booking and a guest only to their own, so there is nothing to re-check
  // here that the database doesn't already decide.
  const { error } = await db.from("messages").insert({
    booking_id: bookingId,
    sender_id: user.id,
    from_admin: fromAdmin,
    body,
  });
  if (error) return NextResponse.json({ ok: false }, { status: 403 });

  // Same client, so this read is bounded by the same policies.
  const { data: booking } = await db
    .from("bookings")
    .select("id, guest_name, guest_email")
    .eq("id", bookingId)
    .single();
  if (!booking) return NextResponse.json({ ok: true, emailed: false });

  if (fromAdmin) {
    // A manual booking may have no real address behind it; the message still
    // stands, the guest just has to be reached another way.
    if (!canEmail(booking.guest_email)) return NextResponse.json({ ok: true, emailed: false });
    await notifyNewMessage(
      booking.guest_email,
      SITE.name,
      body,
      `${SITE.url}/account/bookings/${booking.id}`,
      SITE.ownerEmail
    );
  } else {
    await notifyNewMessage(
      SITE.ownerEmail,
      booking.guest_name,
      body,
      `${SITE.url}/admin/messages/${booking.id}`,
      canEmail(booking.guest_email) ? booking.guest_email : undefined
    );
  }
  return NextResponse.json({ ok: true, emailed: true });
}
