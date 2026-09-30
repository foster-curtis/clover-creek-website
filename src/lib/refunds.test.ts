import { describe, expect, it } from "vitest";
import {
  countsAsRefunded,
  isFullyRefunded,
  refundLines,
  refundsCoverPayment,
  stripeRefundRows,
} from "./refunds";

const refund = (over: Partial<Parameters<typeof stripeRefundRows>[0][number]> = {}) => ({
  id: "re_1",
  amount: 10_000,
  created: 1_790_000_000, // 2026-09-21T14:13:20Z
  reason: null,
  status: "succeeded" as string | null,
  ...over,
});

describe("countsAsRefunded", () => {
  it("counts everything but a failed or cancelled refund", () => {
    for (const status of ["succeeded", "pending", "requires_action", null]) {
      expect(countsAsRefunded({ status })).toBe(true);
    }
    expect(countsAsRefunded({ status: "failed" })).toBe(false);
    expect(countsAsRefunded({ status: "canceled" })).toBe(false);
  });
});

describe("stripeRefundRows", () => {
  it("keys each row on Stripe's id and dates it by Stripe's clock", () => {
    expect(stripeRefundRows([refund({ reason: "requested_by_customer" })])).toEqual([
      {
        id: "re_1",
        amount_cents: 10_000,
        issued_at: "2026-09-21T14:13:20.000Z",
        reason: "requested_by_customer",
      },
    ]);
  });

  it("leaves out refunds that never reached the guest", () => {
    const rows = stripeRefundRows([
      refund({ id: "re_ok" }),
      refund({ id: "re_failed", status: "failed" }),
      refund({ id: "re_canceled", status: "canceled" }),
      refund({ id: "re_pending", status: "pending" }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["re_ok", "re_pending"]);
  });

  it("drops a zero amount rather than trip the table's check and fail the event for days", () => {
    expect(stripeRefundRows([refund({ amount: 0 })])).toEqual([]);
  });
});

describe("isFullyRefunded", () => {
  const rows = (...amounts: number[]) => amounts.map((amount_cents) => ({ amount_cents }));

  it("is a partial refund until the refunds reach what was captured", () => {
    expect(isFullyRefunded(rows(10_000), 25_000)).toBe(false);
    expect(isFullyRefunded(rows(10_000, 15_000), 25_000)).toBe(true);
  });

  it("lets a second partial refund complete the first", () => {
    // The event for the first refund can arrive after the second was made;
    // what decides is the list, which holds both.
    expect(isFullyRefunded(rows(20_000, 5_000), 25_000)).toBe(true);
  });

  it("is judged on what counts: a failed refund doesn't complete anything", () => {
    const listed = stripeRefundRows([
      refund({ id: "re_a", amount: 10_000 }),
      refund({ id: "re_b", amount: 15_000, status: "failed" }),
    ]);
    expect(isFullyRefunded(listed, 25_000)).toBe(false);
  });

  it("never calls an uncaptured charge refunded", () => {
    expect(isFullyRefunded(rows(), 0)).toBe(false);
    expect(isFullyRefunded(rows(100), 0)).toBe(false);
  });
});

describe("refundsCoverPayment", () => {
  it("is true once refunds reach the amount paid", () => {
    expect(refundsCoverPayment(25_000, 25_000)).toBe(true);
    expect(refundsCoverPayment(26_000, 25_000)).toBe(true);
  });

  it("is false for a partial refund, none, or a payment with no amount", () => {
    expect(refundsCoverPayment(10_000, 25_000)).toBe(false);
    expect(refundsCoverPayment(0, 25_000)).toBe(false);
    expect(refundsCoverPayment(0, 0)).toBe(false);
    expect(refundsCoverPayment(100, 0)).toBe(false);
    expect(refundsCoverPayment(100, null)).toBe(false);
  });
});

describe("refundLines", () => {
  it("writes one line per refund, oldest first, naming who moved the money", () => {
    expect(
      refundLines([
        { amount_cents: 5_050, issued_at: "2026-09-20T18:00:00+00:00", source: "dispute" },
        { amount_cents: 22_500, issued_at: "2026-09-12T18:00:00+00:00", source: "admin" },
        { amount_cents: 1_000, issued_at: "2026-09-15T18:00:00+00:00", source: "dashboard" },
      ])
    ).toEqual([
      "Refunded $225 · 2026-09-12 · admin panel",
      "Refunded $10 · 2026-09-15 · Stripe dashboard",
      "Charged back $50.50 · 2026-09-20 · lost dispute",
    ]);
  });

  it("dates a refund at the property, not in UTC", () => {
    // 9pm on 30 September in Utah is already 1 October in UTC.
    expect(
      refundLines([{ amount_cents: 100, issued_at: "2026-10-01T03:00:00Z", source: "admin" }])
    ).toEqual(["Refunded $1 · 2026-09-30 · admin panel"]);
  });

  it("has nothing to say about a booking with no refunds", () => {
    expect(refundLines([])).toEqual([]);
  });
});
