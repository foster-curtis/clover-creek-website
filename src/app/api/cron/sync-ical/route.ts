// Scheduled import of the other listing sites' calendars.
//
// Registered as a Vercel cron in vercel.json. The Hobby plan allows one run a
// day, which is the floor rather than the plan: the paths that actually matter
// refresh on their own — /book kicks off a background sync when a feed is
// stale, and /api/checkout refreshes before it will take money. This run is the
// backstop for a day nobody visits.
//
// Authorised by CRON_SECRET. Vercel sends it as `Authorization: Bearer …`; the
// query-string form is there so the owner can trigger a run from a browser.

import { NextResponse, type NextRequest } from "next/server";
import { syncAllFeeds } from "@/lib/icalSync";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
/** Several feeds, each with a 10s fetch budget. */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Refuse rather than run unauthenticated: the endpoint makes the server fetch
  // arbitrary URLs, so it must never be open because a variable is unset.
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }

  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ")
    ? header.slice(7)
    : request.nextUrl.searchParams.get("key");
  if (provided !== secret) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  if (!hasServiceRole()) {
    return NextResponse.json({ error: "Calendar sync not configured" }, { status: 503 });
  }

  const results = await syncAllFeeds(supabaseAdmin());
  const failed = results.filter((r) => !r.ok);

  // 200 even when a feed failed: a non-2xx would have Vercel retry and alert on
  // a listing site being briefly down, which is not an incident. The failures
  // are in the body, on the feed row, and in red on /admin/calendar.
  return NextResponse.json({
    synced: results.length,
    failed: failed.length,
    feeds: results.map((r) => ({
      label: r.label,
      ok: r.ok,
      events: r.eventCount,
      ...(r.error ? { error: r.error } : {}),
    })),
  });
}
