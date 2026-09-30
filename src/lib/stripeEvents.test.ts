import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import {
  CLAIM_TIMEOUT_MS,
  claimEvent,
  isBookingId,
  isReclaimable,
  settleEvent,
} from "./stripeEvents";

// --- a stub client ------------------------------------------------------------
// Just enough of the PostgREST builder for these queries: each from() takes the
// next scripted result, and records what was asked so a test can check the
// filters that make the reclaim a compare-and-swap. Like PostgREST, an insert
// or update returns no rows unless `.select()` was chained — so a reclaim that
// forgot it would read as a lost race — and rows come back as an array unless
// `.maybeSingle()` was chained, where a lost race's `[]` would read as a win.
// The tests below would catch either.

interface Scripted {
  data?: unknown;
  error?: { code?: string; message: string } | null;
}

interface Query {
  table: string;
  op: "insert" | "update" | "select" | null;
  selected: boolean;
  single: boolean;
  values?: Record<string, unknown>;
  filters: [string, unknown][];
}

function stubDb(script: Scripted[]) {
  const queries: Query[] = [];
  const db = {
    from(table: string) {
      const next = script.shift();
      if (!next) throw new Error(`unexpected query on ${table}`);
      const query: Query = { table, op: null, selected: false, single: false, filters: [] };
      queries.push(query);
      const builder = {
        insert(values: Record<string, unknown>) {
          query.op = "insert";
          query.values = values;
          return builder;
        },
        update(values: Record<string, unknown>) {
          query.op = "update";
          query.values = values;
          return builder;
        },
        select() {
          query.op ??= "select";
          query.selected = true;
          return builder;
        },
        eq(column: string, value: unknown) {
          query.filters.push([column, value]);
          return builder;
        },
        maybeSingle() {
          query.single = true;
          return builder;
        },
        then<T>(resolve: (r: { data: unknown; error: unknown }) => T, reject?: (e: unknown) => T) {
          const rows = next.data == null ? [] : [next.data];
          const data = !query.selected ? null : query.single ? (rows[0] ?? null) : rows;
          return Promise.resolve({ data, error: next.error ?? null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { db: db as unknown as SupabaseClient, queries };
}

/** Each query's operation, whether it asked for rows back, and whether for one row. */
const shape = (queries: Query[]) => queries.map((q) => [q.op, q.selected, q.single]);

const NOW = new Date("2026-09-29T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MINUTE = 60_000;

const event = {
  id: "evt_test_1",
  type: "checkout.session.completed",
  data: { object: { metadata: {} } },
} as unknown as Stripe.Event;

const duplicate = { error: { code: "23505", message: "duplicate key value" } };

// --- claimEvent ---------------------------------------------------------------

describe("claimEvent", () => {
  it("takes a new event with a single insert", async () => {
    const { db, queries } = stubDb([{}]);
    await expect(claimEvent(db, event, NOW)).resolves.toEqual({ fresh: true });
    expect(shape(queries)).toEqual([["insert", false, false]]);
    expect(queries[0]).toMatchObject({
      table: "stripe_events",
      op: "insert",
      values: {
        id: "evt_test_1",
        type: "checkout.session.completed",
        payload: event,
        claimed_at: NOW.toISOString(),
      },
    });
  });

  it.each(["handled", "ignored"] as const)(
    "turns away a redelivery of a %s event without touching the row",
    async (status) => {
      const { db, queries } = stubDb([
        duplicate,
        { data: { status, claimed_at: ago(2 * MINUTE), attempts: 1 } },
      ]);
      await expect(claimEvent(db, event, NOW)).resolves.toEqual({ fresh: false, status });
      expect(shape(queries)).toEqual([
        ["insert", false, false],
        ["select", true, true],
      ]);
    }
  );

  it("does not treat a long-finished event as reclaimable just because it is old", async () => {
    const { db } = stubDb([
      duplicate,
      { data: { status: "handled", claimed_at: ago(90 * 24 * 60 * MINUTE), attempts: 1 } },
    ]);
    await expect(claimEvent(db, event, NOW)).resolves.toEqual({ fresh: false, status: "handled" });
  });

  // The recovery path: the 500 that made Stripe retry left the row `failed`,
  // and the retry has to be allowed to run rather than bounce off the key.
  it("reclaims a failed event, however recently it failed", async () => {
    const { db, queries } = stubDb([
      duplicate,
      { data: { status: "failed", claimed_at: ago(10_000), attempts: 2 } },
      { data: { id: "evt_test_1" } },
    ]);
    await expect(claimEvent(db, event, NOW)).resolves.toEqual({ fresh: true });

    // The update has to ask for its row back: that row is how a win is told
    // apart from a lost race.
    expect(shape(queries)).toEqual([
      ["insert", false, false],
      ["select", true, true],
      ["update", true, true],
    ]);
    const take = queries[2];
    expect(take.values).toEqual({
      status: "processing",
      claimed_at: NOW.toISOString(),
      attempts: 3,
      completed_at: null,
    });
    // The compare-and-swap: only the row exactly as it was read.
    expect(take.filters).toEqual([
      ["id", "evt_test_1"],
      ["status", "failed"],
      ["attempts", 2],
    ]);
  });

  it("reclaims a processing row whose claim has gone stale", async () => {
    const { db, queries } = stubDb([
      duplicate,
      { data: { status: "processing", claimed_at: ago(6 * MINUTE), attempts: 1 } },
      { data: { id: "evt_test_1" } },
    ]);
    await expect(claimEvent(db, event, NOW)).resolves.toEqual({ fresh: true });
    expect(shape(queries)).toEqual([
      ["insert", false, false],
      ["select", true, true],
      ["update", true, true],
    ]);
    expect(queries[2].filters).toEqual([
      ["id", "evt_test_1"],
      ["status", "processing"],
      ["attempts", 1],
    ]);
  });

  it("refuses a processing row whose claim is still fresh, so the caller answers non-2xx", async () => {
    const { db, queries } = stubDb([
      duplicate,
      { data: { status: "processing", claimed_at: ago(1 * MINUTE), attempts: 1 } },
    ]);
    await expect(claimEvent(db, event, NOW)).resolves.toEqual({
      fresh: false,
      status: "processing",
    });
    expect(shape(queries)).toEqual([
      ["insert", false, false],
      ["select", true, true],
    ]);
  });

  it("backs off when another delivery wins the reclaim first", async () => {
    const { db, queries } = stubDb([
      duplicate,
      { data: { status: "failed", claimed_at: ago(MINUTE), attempts: 1 } },
      { data: null }, // the conditional update matched nothing
    ]);
    await expect(claimEvent(db, event, NOW)).resolves.toEqual({
      fresh: false,
      status: "processing",
    });
    expect(shape(queries)).toEqual([
      ["insert", false, false],
      ["select", true, true],
      ["update", true, true],
    ]);
  });

  it("throws on any insert error other than the collision", async () => {
    const { db } = stubDb([{ error: { code: "08006", message: "connection failure" } }]);
    await expect(claimEvent(db, event, NOW)).rejects.toThrow(/connection failure/);
  });

  it("throws when the existing row can't be read", async () => {
    const { db } = stubDb([duplicate, { error: { message: "timeout" } }]);
    await expect(claimEvent(db, event, NOW)).rejects.toThrow(/timeout/);
  });

  it("throws when the row it collided with has vanished", async () => {
    const { db } = stubDb([duplicate, { data: null }]);
    await expect(claimEvent(db, event, NOW)).rejects.toThrow(/can't be read back/);
  });

  it("throws when the reclaim itself errors", async () => {
    const { db } = stubDb([
      duplicate,
      { data: { status: "failed", claimed_at: ago(MINUTE), attempts: 1 } },
      { error: { message: "deadlock detected" } },
    ]);
    await expect(claimEvent(db, event, NOW)).rejects.toThrow(/deadlock detected/);
  });
});

// --- isReclaimable ------------------------------------------------------------

describe("isReclaimable", () => {
  it("measures staleness from the claim, with the window exclusive", () => {
    const at = (ms: number) => ({ status: "processing" as const, claimed_at: ago(ms) });
    expect(isReclaimable(at(CLAIM_TIMEOUT_MS - 1), NOW)).toBe(false);
    expect(isReclaimable(at(CLAIM_TIMEOUT_MS), NOW)).toBe(false);
    expect(isReclaimable(at(CLAIM_TIMEOUT_MS + 1), NOW)).toBe(true);
  });

  it("reads the microsecond timestamps Postgres returns", () => {
    expect(
      isReclaimable({ status: "processing", claimed_at: "2026-09-29T11:54:59.123456+00:00" }, NOW)
    ).toBe(true);
    expect(
      isReclaimable({ status: "processing", claimed_at: "2026-09-29T11:59:00.654321+00:00" }, NOW)
    ).toBe(false);
  });

  it("never reclaims a finished event", () => {
    for (const status of ["handled", "ignored"] as const) {
      expect(isReclaimable({ status, claimed_at: ago(365 * 24 * 60 * MINUTE) }, NOW)).toBe(false);
    }
  });
});

// --- settleEvent --------------------------------------------------------------

describe("settleEvent", () => {
  it("writes the outcome, and links the booking only when one is given", async () => {
    const { db, queries } = stubDb([{}, {}]);
    await settleEvent(db, "evt_a", { status: "ignored", error: "No booking_id in the session metadata" });
    await settleEvent(db, "evt_b", {
      status: "handled",
      bookingId: "0b7c2f0e-1d7a-4a8e-9c1e-6a2b5d4f3e21",
    });

    expect(queries[0].values).toMatchObject({
      status: "ignored",
      error: "No booking_id in the session metadata",
    });
    expect(queries[0].values).not.toHaveProperty("booking_id");
    expect(queries[0].filters).toEqual([["id", "evt_a"]]);

    // A clean handled clears whatever a failed attempt left in `error`.
    expect(queries[1].values).toMatchObject({
      status: "handled",
      error: null,
      booking_id: "0b7c2f0e-1d7a-4a8e-9c1e-6a2b5d4f3e21",
    });
    expect(typeof queries[1].values?.completed_at).toBe("string");
  });

  it("throws when the write fails, so the caller can answer 500", async () => {
    const { db } = stubDb([{ error: { message: "permission denied" } }]);
    await expect(settleEvent(db, "evt_a", { status: "handled" })).rejects.toThrow(
      /settle Stripe event evt_a as handled: permission denied/
    );
  });
});

// --- isBookingId --------------------------------------------------------------

describe("isBookingId", () => {
  it("accepts a uuid in either case", () => {
    expect(isBookingId("0b7c2f0e-1d7a-4a8e-9c1e-6a2b5d4f3e21")).toBe(true);
    expect(isBookingId("0B7C2F0E-1D7A-4A8E-9C1E-6A2B5D4F3E21")).toBe(true);
  });

  // Most of these would be a 22P02 from Postgres, and so a 500, if queried.
  // The bare-hex form Postgres would accept, but no booking id is written that
  // way, so refusing it costs nothing.
  it("rejects anything but a canonical uuid", () => {
    for (const value of [
      undefined,
      null,
      "",
      "booking_123",
      "0b7c2f0e1d7a4a8e9c1e6a2b5d4f3e21",
      " 0b7c2f0e-1d7a-4a8e-9c1e-6a2b5d4f3e21",
      "0b7c2f0e-1d7a-4a8e-9c1e-6a2b5d4f3e21x",
      42,
    ]) {
      expect(isBookingId(value)).toBe(false);
    }
  });
});
