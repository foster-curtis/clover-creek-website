// iCalendar feed of booked/blocked dates.
// - Public (no key): busy dates only, no guest details — safe to give to
//   Airbnb/VRBO for availability sync.
// - With ?key=<ICAL_FEED_TOKEN>: includes guest names/counts — for the owner's
//   personal Google/Apple calendar subscription.
// - With ?source=<feed id>: leaves out the blocks imported from that feed, so a
//   platform is never handed its own events back. See the note below.

import { NextResponse, type NextRequest } from "next/server";
import { buildIcs } from "@/lib/ical";
import { parseStay } from "@/lib/pricing";
import { SITE } from "@/lib/site";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasServiceRole()) {
    return new NextResponse("Calendar not configured", { status: 503 });
  }

  const key = request.nextUrl.searchParams.get("key");
  const detailed = Boolean(
    process.env.ICAL_FEED_TOKEN && key === process.env.ICAL_FEED_TOKEN
  );

  /**
   * Which imported feed is asking, if the owner gave that platform its own
   * link. Its events are then left out of the response.
   *
   * Without this the sync feeds back on itself. Airbnb's reservations arrive
   * here as blocked_dates rows; exporting them means Airbnb re-reads its own
   * events through us. Cancel that reservation on Airbnb and it disappears from
   * their feed — but our copy lives on, we keep publishing it, and Airbnb
   * imports it back as an external block. The nights stay shut on both sites
   * with no reservation anywhere to explain why, and nothing in either admin UI
   * points at the cause.
   *
   * A UUID is not a secret, but nothing here is: this parameter only ever
   * removes events from a feed that is already public.
   */
  const source = request.nextUrl.searchParams.get("source");

  const db = supabaseAdmin();
  let blockQuery = db.from("blocked_dates").select("id, span, reason");
  if (source && /^[0-9a-f-]{36}$/i.test(source)) {
    // `or` rather than `neq`: a null feed_id (the owner's manual blocks) fails
    // every comparison in SQL, and those must always be published.
    blockQuery = blockQuery.or(`feed_id.is.null,feed_id.neq.${source}`);
  }

  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    db
      .from("bookings")
      .select("id, stay, guest_name, guests, pets, status")
      .in("status", ["pending", "confirmed"]),
    blockQuery,
  ]);

  const events = [
    ...(bookings ?? []).map((b) => {
      const { checkIn: from, checkOut: to } = parseStay(b.stay);
      return {
        uid: `booking-${b.id}`,
        start: from,
        end: to,
        summary: detailed
          ? `${b.guest_name} (${b.guests} guests${b.pets ? `, ${b.pets} dogs` : ""})${b.status === "pending" ? " — PENDING" : ""}`
          : "Booked",
      };
    }),
    ...(blocks ?? []).map((b) => {
      const { checkIn: from, checkOut: to } = parseStay(b.span);
      return {
        uid: `block-${b.id}`,
        start: from,
        end: to,
        summary: detailed ? (b.reason ?? "Blocked") : "Unavailable",
      };
    }),
  ];

  const ics = buildIcs(events, SITE.name);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="clover-creek.ics"',
      "Cache-Control": "no-cache",
    },
  });
}
