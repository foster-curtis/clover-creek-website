// Importing other listing sites' calendars into this one.
//
// The house is listed in more than one place. /api/ical has always published
// this site's busy dates outward; this is the way back in, so a stay booked on
// Airbnb blocks the same nights here.
//
// Imported events become ordinary `blocked_dates` rows tagged with their feed.
// That tag is the whole design: availability (getUnavailableRanges), the
// outbound feed and the booking overlap check already read `blocked_dates`, so
// an imported night blocks the calendar with nothing else to change, while
// `feed_id is null` still means "the owner blocked this by hand" and sync never
// touches those rows.

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseIcs, type ParsedEvent } from "./ical";
import { SITE } from "./site";

/** A feed row, narrowed to what syncing actually reads. */
export interface IcalFeed {
  id: string;
  label: string;
  url: string;
}

export interface SyncResult {
  feedId: string;
  label: string;
  ok: boolean;
  /** Events imported, on success. */
  eventCount: number;
  /** Why it failed, in words the owner can act on. */
  error?: string;
}

/** How long a feed may be stale before an on-demand path refreshes it. */
export const STALE_AFTER_MS = 15 * 60 * 1000;

/** A single feed fetch's budget. Airbnb is usually well under a second. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Cap on a feed's size. A year of nightly bookings is perhaps 60KB; 5MB is
 * room for a decade of them and still small enough that a misconfigured URL
 * pointing at something enormous can't exhaust the function's memory.
 */
const MAX_BYTES = 5 * 1024 * 1024;

// --- the URL -----------------------------------------------------------------

/**
 * Normalise and vet a subscription URL.
 *
 * The owner types this in and the *server* fetches it, which makes it a
 * server-side request forgery surface: a URL naming an internal address would
 * have the server reach somewhere the internet can't, and report back what it
 * found. Only the admin console can reach this and the owner has no reason to
 * attack their own site, but the check is a few lines and the failure mode is
 * bad enough to be worth them.
 *
 * Returns the URL to fetch, or a message explaining the refusal.
 */
export function normalizeFeedUrl(input: string): { url: string } | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: "Paste the calendar link from the other site." };

  let parsed: URL;
  try {
    // Calendar links are handed out as webcal:// so a click opens a calendar
    // app. Over the wire it is plain HTTPS.
    parsed = new URL(trimmed.replace(/^webcal:\/\//i, "https://"));
  } catch {
    return { error: "That doesn't look like a link. It should start with https:// or webcal://." };
  }

  if (parsed.protocol !== "https:") {
    return { error: "Only https:// calendar links are accepted (webcal:// is fine too)." };
  }
  if (parsed.port && parsed.port !== "443") {
    return { error: "Calendar links shouldn't specify a port." };
  }
  if (isPrivateHost(parsed.hostname)) {
    return { error: "That link points at a private address, not a listing site." };
  }
  return { url: parsed.toString() };
}

/**
 * Hostnames that resolve inside the network rather than out on the internet.
 *
 * Literal addresses and localhost only. A DNS name that *resolves* to a private
 * address gets through, which would need resolving the name here and pinning
 * the connection to the address checked — more machinery than an admin-only
 * form warrants. This stops the accidents and the obvious attempts.
 */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return true;

  // IPv6: loopback, link-local (fe80::/10) and unique-local (fc00::/7).
  if (host.includes(":")) {
    return (
      host === "::1" ||
      host === "::" ||
      /^f[cd][0-9a-f]{2}:/.test(host) ||
      /^fe[89ab][0-9a-f]:/.test(host) ||
      // ::ffff:10.0.0.1 — an IPv4 private address wearing an IPv6 hat.
      /^::ffff:/.test(host)
    );
  }

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!v4) return false;
  const [a, b] = v4.slice(1).map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) || // link-local, incl. the cloud metadata endpoint
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    a >= 224 // multicast and reserved
  );
}

// --- fetching ----------------------------------------------------------------

/** Fetch a feed and parse it. Throws with a message meant for the owner. */
export async function fetchFeedEvents(url: string): Promise<ParsedEvent[]> {
  const response = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Accept: "text/calendar, text/plain;q=0.9, */*;q=0.8",
      // Some hosts serve a bot page to a blank agent. Say who we are.
      "User-Agent": `${SITE.name} calendar sync (+${SITE.url})`,
    },
  });

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "The listing site returned 404 — the link may have been regenerated. Copy it again."
        : `The listing site returned ${response.status} ${response.statusText}.`
    );
  }

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new Error("That calendar is too large to import.");

  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error("That calendar is too large to import.");

  // An expired or wrong link usually comes back 200 with an HTML sign-in page,
  // which would otherwise parse to zero events and read as "all dates free".
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new Error("That link didn't return a calendar. Check it's the iCal export URL.");
  }

  return parseIcs(text, SITE.location.timezone);
}

// --- reconciling -------------------------------------------------------------

export interface ImportedBlock {
  feed_id: string;
  external_uid: string;
  span: string;
  reason: string;
}

/**
 * The rows one feed's events become.
 *
 * Duplicate UIDs are collapsed — the unique index would reject the second of
 * them and fail the whole batch, and a feed repeating a UID means one event,
 * described twice.
 */
export function toBlockRows(feed: IcalFeed, events: ParsedEvent[]): ImportedBlock[] {
  const byUid = new Map<string, ImportedBlock>();
  for (const event of events) {
    byUid.set(event.uid, {
      feed_id: feed.id,
      external_uid: event.uid,
      span: `[${event.start},${event.end})`,
      // Read by a human in the admin block list and in the owner's private
      // calendar feed, so name the source: "Airbnb · Reserved".
      reason: event.summary ? `${feed.label} · ${event.summary}` : feed.label,
    });
  }
  return [...byUid.values()];
}

/**
 * Fetch one feed and make `blocked_dates` match it.
 *
 * Never throws: a feed failing is a normal Tuesday, and one broken feed must
 * not abort the others or the request that triggered the sync. The outcome is
 * recorded on the feed row and returned.
 */
export async function syncFeed(db: SupabaseClient, feed: IcalFeed): Promise<SyncResult> {
  try {
    const events = await fetchFeedEvents(feed.url);
    const rows = toBlockRows(feed, events);

    // Upsert on (feed_id, external_uid): a stay whose dates changed is rewritten
    // in place rather than stacked on top of its old span.
    if (rows.length > 0) {
      const { error } = await db
        .from("blocked_dates")
        .upsert(rows, { onConflict: "feed_id,external_uid" });
      if (error) throw new Error(error.message);
    }

    // Then drop this feed's rows that are no longer in it — a cancellation
    // elsewhere, reopening the nights. Scoped by feed_id, so a manual block
    // (feed_id null) and every other feed's rows are untouched.
    //
    // Deleting after upserting, rather than clearing the feed first, is what
    // keeps the nights continuously blocked: there is no instant where the
    // calendar shows a still-booked stay as free, and so no window for a guest
    // to book dates Airbnb has already sold.
    const keep = rows.map((r) => r.external_uid);
    const stale = db.from("blocked_dates").delete().eq("feed_id", feed.id);
    const { error: deleteError } = await (keep.length > 0
      ? stale.not("external_uid", "in", `(${keep.map(quoteForIn).join(",")})`)
      : stale);
    if (deleteError) throw new Error(deleteError.message);

    await db
      .from("ical_feeds")
      .update({
        last_synced_at: new Date().toISOString(),
        last_status: "ok",
        last_error: null,
        last_event_count: rows.length,
      })
      .eq("id", feed.id);

    return { feedId: feed.id, label: feed.label, ok: true, eventCount: rows.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);

    // Note what happened, and change nothing else. A failed fetch must never
    // clear the blocks already imported: a flaky response would otherwise
    // reopen nights another site has sold, and the site would cheerfully take
    // a payment for them. Stale availability is recoverable; a double booking
    // is a phone call to a guest.
    await db
      .from("ical_feeds")
      .update({ last_synced_at: new Date().toISOString(), last_status: "error", last_error: error })
      .eq("id", feed.id);

    console.error(`iCal sync failed for feed ${feed.id} (${feed.label}):`, e);
    return { feedId: feed.id, label: feed.label, ok: false, eventCount: 0, error };
  }
}

/**
 * PostgREST's `in` filter takes a bare comma-separated list, so a UID
 * containing a comma or a quote would end the list early and delete rows that
 * should have been kept. Double-quote each value and escape what's inside.
 */
function quoteForIn(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Sync every active feed, in parallel. Returns one result per feed. */
export async function syncAllFeeds(
  db: SupabaseClient,
  options: { onlyStale?: boolean } = {}
): Promise<SyncResult[]> {
  const { data, error } = await db
    .from("ical_feeds")
    .select("id, label, url, last_synced_at")
    .eq("active", true);
  if (error || !data) return [];

  const cutoff = Date.now() - STALE_AFTER_MS;
  const due = options.onlyStale
    ? data.filter((f) => !f.last_synced_at || new Date(f.last_synced_at).getTime() < cutoff)
    : data;

  return Promise.all(due.map((feed) => syncFeed(db, feed as IcalFeed)));
}
