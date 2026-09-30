// The idempotency gate every Stripe webhook handler goes through.
//
// Stripe delivers at least once, and the webhook answers 500 on failure so that
// Stripe retries — which makes redelivery the recovery path, not an edge case.
// Each event is claimed in `stripe_events` before any of its work runs, keyed on
// Stripe's own event id, so a redelivery finds the row and the work runs once.
// See supabase/migrations/0007_stripe_events.sql.

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

export type EventStatus = "processing" | "handled" | "ignored" | "failed";

/**
 * The outcome of trying to take an event. When it is not fresh, `status` is
 * what the caller answers on — the webhook route says why `processing` gets a
 * 409 rather than a 200.
 */
export type Claim = { fresh: true } | { fresh: false; status: EventStatus };

/** How a handler left an event: what settleEvent writes. */
export interface Settlement {
  status: Exclude<EventStatus, "processing">;
  /** Why it was ignored or failed; on a handled event, what went wrong after the write. */
  error?: string | null;
  /** Only once the booking is known to exist — the column is a foreign key. */
  bookingId?: string | null;
}

/**
 * How long a `processing` claim is trusted.
 *
 * An attempt that dies before settling — a crash, a timeout, a failed settle —
 * leaves its row `processing`. Without a window that row would turn away every
 * retry and the event could never be processed at all. Five minutes is well
 * past the webhook route's maxDuration, so a claim that old belongs to an
 * attempt that is no longer running, not a slow one that still is.
 */
export const CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

const UNIQUE_VIOLATION = "23505";

interface ClaimRow {
  status: EventStatus;
  claimed_at: string;
  attempts: number;
}

/** Whether a new delivery may take over a row an earlier one left behind. */
export function isReclaimable(
  row: Pick<ClaimRow, "status" | "claimed_at">,
  now: Date = new Date()
): boolean {
  if (row.status === "failed") return true;
  return (
    row.status === "processing" &&
    now.getTime() - new Date(row.claimed_at).getTime() > CLAIM_TIMEOUT_MS
  );
}

/**
 * Take an event before doing any of its work.
 *
 * Insert-or-lose: the primary key collision is the lock. An existing row is
 * taken over only if its last attempt failed or went stale, and then by a
 * compare-and-swap on (status, attempts). Postgres re-checks an UPDATE's WHERE
 * once it holds the row lock, so of two retries racing for the same row exactly
 * one matches; the other updates nothing and backs off.
 */
export async function claimEvent(
  db: SupabaseClient,
  event: Stripe.Event,
  now: Date = new Date()
): Promise<Claim> {
  const { error } = await db.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    payload: event,
    claimed_at: now.toISOString(),
  });
  if (!error) return { fresh: true };
  if (error.code !== UNIQUE_VIOLATION) {
    throw new Error(`Couldn't record Stripe event ${event.id}: ${error.message}`);
  }

  const { data, error: readError } = await db
    .from("stripe_events")
    .select("status, claimed_at, attempts")
    .eq("id", event.id)
    .maybeSingle();
  if (readError) throw new Error(`Couldn't read Stripe event ${event.id}: ${readError.message}`);
  const row = data as ClaimRow | null;
  if (!row) throw new Error(`Stripe event ${event.id} collided on insert but can't be read back`);
  if (!isReclaimable(row, now)) return { fresh: false, status: row.status };

  // `error` is left as the previous attempt wrote it, so a reclaimed row that
  // dies too still says why the one before it failed. settleEvent overwrites it.
  const { data: taken, error: takeError } = await db
    .from("stripe_events")
    .update({
      status: "processing",
      claimed_at: now.toISOString(),
      attempts: row.attempts + 1,
      completed_at: null,
    })
    .eq("id", event.id)
    .eq("status", row.status)
    .eq("attempts", row.attempts)
    .select("id")
    .maybeSingle();
  if (takeError) {
    throw new Error(`Couldn't reclaim Stripe event ${event.id}: ${takeError.message}`);
  }
  // Nothing matched: another delivery took it between the read and the update,
  // and is running it now.
  return taken ? { fresh: true } : { fresh: false, status: "processing" };
}

/** Close a claimed row out. `failed` is the one that goes with a 500, so Stripe retries. */
export async function settleEvent(
  db: SupabaseClient,
  id: string,
  settlement: Settlement
): Promise<void> {
  const { error } = await db
    .from("stripe_events")
    .update({
      status: settlement.status,
      error: settlement.error ?? null,
      completed_at: new Date().toISOString(),
      ...(settlement.bookingId ? { booking_id: settlement.bookingId } : {}),
    })
    .eq("id", id);
  if (error) {
    throw new Error(`Couldn't settle Stripe event ${id} as ${settlement.status}: ${error.message}`);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a metadata value can be looked up as a booking id. Checked before
 * querying because Postgres answers a malformed uuid with an error (22P02), not
 * an empty result — and an error means a 500 and days of Stripe retries for an
 * event that was never ours.
 */
export function isBookingId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
