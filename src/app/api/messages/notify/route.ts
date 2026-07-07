// Emails the other party when a chat message is sent, so nobody needs to keep
// a tab open. The message itself is written by the client via Supabase RLS.

import { NextResponse, type NextRequest } from "next/server";
import { notifyNewMessage } from "@/lib/email";
import { SITE } from "@/lib/site";
import { currentUser, hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user || !hasServiceRole()) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { bookingId?: string; fromAdmin?: boolean; preview?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const { bookingId, fromAdmin, preview } = body;
  if (!bookingId || typeof preview !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: booking } = await db
    .from("bookings")
    .select("id, user_id, guest_name, guest_email")
    .eq("id", bookingId)
    .single();
  if (!booking) return NextResponse.json({ ok: false }, { status: 404 });

  if (fromAdmin) {
    // Verify the sender really is the admin, then notify the guest.
    const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ ok: false }, { status: 403 });
    await notifyNewMessage(
      booking.guest_email,
      SITE.name,
      preview,
      `${SITE.url}/account/bookings/${booking.id}`
    );
  } else {
    // Guest sender must own the booking; notify the owner.
    if (booking.user_id !== user.id) return NextResponse.json({ ok: false }, { status: 403 });
    await notifyNewMessage(
      SITE.ownerEmail,
      booking.guest_name,
      preview,
      `${SITE.url}/admin/messages/${booking.id}`
    );
  }
  return NextResponse.json({ ok: true });
}
