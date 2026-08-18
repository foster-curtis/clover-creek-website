import { describe, expect, it } from "vitest";
import {
  daysUntilCheckIn,
  describeRefund,
  fullRefundDeadline,
  refundFor,
  REFUND_TIERS,
  tierFor,
} from "./cancellation";

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

describe("REFUND_TIERS", () => {
  it("is ordered most- to least-generous and ends with a catch-all", () => {
    for (let i = 1; i < REFUND_TIERS.length; i++) {
      expect(REFUND_TIERS[i].minDaysBefore).toBeLessThan(REFUND_TIERS[i - 1].minDaysBefore);
      expect(REFUND_TIERS[i].percent).toBeLessThan(REFUND_TIERS[i - 1].percent);
    }
    expect(REFUND_TIERS[REFUND_TIERS.length - 1].minDaysBefore).toBe(0);
  });
});
