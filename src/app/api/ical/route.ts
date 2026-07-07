// iCalendar feed of booked/blocked dates.
// - Public (no key): busy dates only, no guest details — safe to give to
//   Airbnb/VRBO for availability sync.
// - With ?key=<ICAL_FEED_TOKEN>: includes guest names/counts — for the owner's
//   personal Google/Apple calendar subscription.

import { NextResponse, type NextRequest } from "next/server";
import { buildIcs } from "@/lib/ical";
import { SITE } from "@/lib/site";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function parseStay(stay: string): { from: string; to: string } {
  const m = /^[\[(]([\d-]+),([\d-]+)[)\]]$/.exec(stay);
  return { from: m?.[1] ?? "", to: m?.[2] ?? "" };
}

export async function GET(request: NextRequest) {
  if (!hasServiceRole()) {
    return new NextResponse("Calendar not configured", { status: 503 });
  }

  const key = request.nextUrl.searchParams.get("key");
  const detailed = Boolean(
    process.env.ICAL_FEED_TOKEN && key === process.env.ICAL_FEED_TOKEN
  );

  const db = supabaseAdmin();
  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    db
      .from("bookings")
      .select("id, stay, guest_name, guests, pets, status")
      .in("status", ["pending", "confirmed"]),
    db.from("blocked_dates").select("id, span, reason"),
  ]);

  const events = [
    ...(bookings ?? []).map((b) => {
      const { from, to } = parseStay(b.stay);
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
      const { from, to } = parseStay(b.span);
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
