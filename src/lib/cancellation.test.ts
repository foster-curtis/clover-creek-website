import { describe, expect, it } from "vitest";
import {
  daysUntilCheckIn,
  describeRefund,
  describeRefundAction,
  fullRefundDeadline,
  refundFor,
  REFUND_TIERS,
  resolveRefund,
  tierFor,
} from "./cancellation";
import { formatUSD } from "./pricing";

// A $500.00 booking, so each tier lands on a round number of cents.
const TOTAL = 50_000;

describe("daysUntilCheckIn", () => {
  it("counts whole days", () => {
    expect(daysUntilCheckIn("2026-09-01", "2026-08-17")).toBe(15);
    expect(daysUntilCheckIn("2026-08-17", "2026-08-17")).toBe(0);
  });

  it("goes negative once the stay has started", () => {
    expect(daysUntilCheckIn("2026-08-10", "2026-08-17")).toBe(-7);
  });

  it("is unaffected by the DST transition in between", () => {
    // US DST ends 2026-11-01; a naive local-time subtraction yields 30.04 days.
    expect(daysUntilCheckIn("2026-11-15", "2026-10-16")).toBe(30);
    // ...and starts 2026-03-08, where the naive result is 29.96 days.
    expect(daysUntilCheckIn("2026-03-20", "2026-02-18")).toBe(30);
  });
});

describe("tierFor — band boundaries", () => {
  it("pays 100% at exactly 6 weeks and beyond", () => {
    expect(tierFor(365).percent).toBe(100);
    expect(tierFor(43).percent).toBe(100);
    expect(tierFor(42).percent).toBe(100);
    expect(tierFor(41).percent).toBe(75);
  });

  it("pays 75% from 4 weeks up to 6", () => {
    expect(tierFor(28).percent).toBe(75);
    expect(tierFor(27).percent).toBe(50);
  });

  it("pays 50% from 2 weeks up to 4", () => {
    expect(tierFor(14).percent).toBe(50);
    expect(tierFor(13).percent).toBe(25);
  });

  it("pays 25% from 1 week up to 2", () => {
    expect(tierFor(7).percent).toBe(25);
    expect(tierFor(6).percent).toBe(0);
  });

  it("pays nothing inside the last week, on the day, or after check-in", () => {
    expect(tierFor(1).percent).toBe(0);
    expect(tierFor(0).percent).toBe(0);
    expect(tierFor(-5).percent).toBe(0);
  });
});

describe("refundFor", () => {
  it("returns the whole total 6+ weeks out", () => {
    const r = refundFor("2026-10-01", "2026-08-17", TOTAL);
    expect(r.daysBefore).toBe(45);
    expect(r.percent).toBe(100);
    expect(r.refundCents).toBe(50_000);
  });

  it("applies each partial tier to the total", () => {
    expect(refundFor("2026-09-24", "2026-08-25", TOTAL).refundCents).toBe(37_500); // 30 days → 75%
    expect(refundFor("2026-09-10", "2026-08-25", TOTAL).refundCents).toBe(25_000); // 16 days → 50%
    expect(refundFor("2026-09-04", "2026-08-25", TOTAL).refundCents).toBe(12_500); // 10 days → 25%
    expect(refundFor("2026-08-28", "2026-08-25", TOTAL).refundCents).toBe(0); //  3 days → 0%
  });

  it("rounds to whole cents", () => {
    // 75% of $333.33 = $249.9975
    const r = refundFor("2026-10-01", "2026-09-01", 33_333);
    expect(r.percent).toBe(75);
    expect(r.refundCents).toBe(25_000);
    expect(Number.isInteger(r.refundCents)).toBe(true);
  });

  it("never refunds more than was paid", () => {
    for (const tier of REFUND_TIERS) {
      expect(refundFor("2026-10-01", "2026-08-17", TOTAL).refundCents).toBeLessThanOrEqual(TOTAL);
      expect(tier.percent).toBeLessThanOrEqual(100);
    }
  });

  it("rejects malformed dates rather than guessing a tier", () => {
    expect(() => refundFor("not-a-date", "2026-08-17", TOTAL)).toThrow(/Invalid date/);
  });
});

describe("fullRefundDeadline", () => {
  it("is 42 days before check-in", () => {
    expect(fullRefundDeadline("2026-10-01")).toBe("2026-08-20");
    expect(refundFor("2026-10-01", "2026-08-20", TOTAL).percent).toBe(100);
    expect(refundFor("2026-10-01", "2026-08-21", TOTAL).percent).toBe(75);
  });

  it("crosses month and year boundaries", () => {
    expect(fullRefundDeadline("2027-01-10")).toBe("2026-11-29");
  });
});

describe("describeRefund", () => {
  it("words each tier for policy copy", () => {
    expect(describeRefund(100)).toBe("full refund, no fee");
    expect(describeRefund(75)).toBe("75% refund");
    expect(describeRefund(0)).toBe("no refund");
  });
});

describe("resolveRefund", () => {
  // 16 days out, so the policy pays 50% — far enough from the boundaries that a
  // full refund is unambiguously an override.
  const CHECK_IN = "2026-09-10";
  const ON = "2026-08-25";

  it("follows the tiers when nothing is overridden", () => {
    const r = resolveRefund({ kind: "policy" }, CHECK_IN, ON, TOTAL);
    expect(r.refundCents).toBe(25_000);
    expect(r.overridden).toBe(false);
    expect(r.full).toBe(false);
  });

  it("returns every cent on a full refund, and says it overrode the policy", () => {
    const r = resolveRefund({ kind: "full" }, CHECK_IN, ON, TOTAL);
    expect(r.refundCents).toBe(TOTAL);
    expect(r.full).toBe(true);
    expect(r.overridden).toBe(true);
    // The tier is still reported, so the record can say what was waived.
    expect(r.policy.percent).toBe(50);
  });

  it("is not an override when the policy already pays everything", () => {
    const r = resolveRefund({ kind: "full" }, "2026-10-01", "2026-08-17", TOTAL);
    expect(r.refundCents).toBe(TOTAL);
    expect(r.full).toBe(true);
    expect(r.overridden).toBe(false);
  });

  it("refunds in full inside the no-refund week — the point of the override", () => {
    const r = resolveRefund({ kind: "full" }, "2026-08-28", ON, TOTAL);
    expect(r.policy.percent).toBe(0);
    expect(r.refundCents).toBe(TOTAL);
    expect(r.overridden).toBe(true);
  });

  it("takes a typed amount in dollars", () => {
    const r = resolveRefund({ kind: "amount", dollars: "300" }, CHECK_IN, ON, TOTAL);
    expect(r.refundCents).toBe(30_000);
    expect(r.overridden).toBe(true);
    expect(r.full).toBe(false);
  });

  it("counts a typed amount equal to the total as full", () => {
    const r = resolveRefund({ kind: "amount", dollars: "500.00" }, CHECK_IN, ON, TOTAL);
    expect(r.full).toBe(true);
    expect(r.overridden).toBe(true);
  });

  it("is not an override when the typed amount matches the tier", () => {
    const r = resolveRefund({ kind: "amount", dollars: "250" }, CHECK_IN, ON, TOTAL);
    expect(r.refundCents).toBe(25_000);
    expect(r.overridden).toBe(false);
  });

  it("rejects an amount larger than was paid", () => {
    expect(() => resolveRefund({ kind: "amount", dollars: "500.01" }, CHECK_IN, ON, TOTAL)).toThrow(
      /exceed the amount paid/
    );
  });

  it("rejects junk rather than rounding it into a refund", () => {
    for (const dollars of ["", "  ", "abc", "-5", "1,200", "12.5.5", "NaN"]) {
      expect(() => resolveRefund({ kind: "amount", dollars }, CHECK_IN, ON, TOTAL)).toThrow();
    }
  });

  it("never calls a $0 booking a full refund", () => {
    const r = resolveRefund({ kind: "full" }, CHECK_IN, ON, 0);
    expect(r.refundCents).toBe(0);
    expect(r.full).toBe(false);
  });

  it("rounds a typed amount to whole cents", () => {
    const r = resolveRefund({ kind: "amount", dollars: "33.335" }, CHECK_IN, ON, TOTAL);
    expect(Number.isInteger(r.refundCents)).toBe(true);
    expect(r.refundCents).toBe(3_334);
  });
});

describe("describeRefundAction", () => {
  // The same 50% tier as above, so every override is visibly a departure.
  const CHECK_IN = "2026-09-10";
  const ON = "2026-08-25";
  const note = (i: Parameters<typeof resolveRefund>[0], total = TOTAL) =>
    describeRefundAction(resolveRefund(i, CHECK_IN, ON, total));

  // formatUSD drops the cents on a whole number of dollars, so $500 not $500.00.

  it("names a full refund as full, never by the tier it overrode", () => {
    const n = note({ kind: "full" });
    expect(n).toBe("full refund $500 (owner override; policy said 50% — $250)");
    // The bug this replaced: a note that opened "50% refund" on a booking
    // refunded in full.
    expect(n).not.toMatch(/^50% refund/);
  });

  it("names the policy refund as the policy's", () => {
    expect(note({ kind: "policy" })).toBe("policy refund $250 (50%, 2 to 4 weeks before check-in)");
  });

  it("names a partial override as an override, beside what the policy said", () => {
    expect(note({ kind: "amount", dollars: "300" })).toBe(
      "override refund $300 (policy said 50% — $250)"
    );
  });

  it("credits the policy, not the owner, when the tier already pays everything", () => {
    expect(
      describeRefundAction(resolveRefund({ kind: "full" }, "2026-10-01", "2026-08-17", TOTAL))
    ).toBe("full refund $500 (policy: 6 weeks or more before check-in)");
  });

  it("distinguishes 'the policy paid nothing' from 'the owner chose nothing'", () => {
    expect(describeRefundAction(resolveRefund({ kind: "policy" }, "2026-08-28", ON, TOTAL))).toBe(
      "no refund (policy: less than 1 week before check-in)"
    );
    expect(note({ kind: "amount", dollars: "0" })).toBe(
      "no refund (owner override; policy said 50% — $250)"
    );
  });

  it("records a full refund granted inside the no-refund week", () => {
    expect(describeRefundAction(resolveRefund({ kind: "full" }, "2026-08-28", ON, TOTAL))).toBe(
      "full refund $500 (owner override; policy said 0% — $0)"
    );
  });

  it("always states the amount that actually moved", () => {
    for (const i of [
      { kind: "policy" } as const,
      { kind: "full" } as const,
      { kind: "amount", dollars: "333.33" } as const,
    ]) {
      const r = resolveRefund(i, CHECK_IN, ON, TOTAL);
      if (r.refundCents > 0) {
        expect(describeRefundAction(r)).toContain(formatUSD(r.refundCents / 100));
      }
    }
  });
});

describe("REFUND_TIERS", () => {
  it("is ordered most- to least-generous and ends with a catch-all", () => {
    for (let i = 1; i < REFUND_TIERS.length; i++) {
      expect(REFUND_TIERS[i].minDaysBefore).toBeLessThan(REFUND_TIERS[i - 1].minDaysBefore);
      expect(REFUND_TIERS[i].percent).toBeLessThan(REFUND_TIERS[i - 1].percent);
    }
    expect(REFUND_TIERS[REFUND_TIERS.length - 1].minDaysBefore).toBe(0);
  });
});
