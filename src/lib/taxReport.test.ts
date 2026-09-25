import { describe, expect, it } from "vitest";
import { computeLodgingTax } from "./pricing";
import {
  csvFilename,
  parsePeriodKey,
  periodDueDate,
  periodKey,
  periodLabel,
  periodOfDate,
  periodsPresent,
  propertyDateOf,
  quarterOfMonth,
  refundDateOf,
  reportRows,
  rowsInPeriod,
  summarize,
  toCsv,
  wasPaid,
  type ReportableBooking,
} from "./taxReport";

function booking(over: Partial<ReportableBooking> = {}): ReportableBooking {
  return {
    id: "b1",
    stay: "[2026-08-17,2026-08-20)",
    guest_name: "Ada Lovelace",
    status: "confirmed",
    total_cents: 50_000,
    created_at: "2026-07-04T18:00:00.000Z",
    stripe_payment_intent: "pi_1",
    refund_cents: 0,
    refunded_at: null,
    ...over,
  };
}

describe("quarterOfMonth", () => {
  it("maps each month to its quarter", () => {
    expect([1, 2, 3].map(quarterOfMonth)).toEqual([1, 1, 1]);
    expect([4, 5, 6].map(quarterOfMonth)).toEqual([2, 2, 2]);
    expect([7, 8, 9].map(quarterOfMonth)).toEqual([3, 3, 3]);
    expect([10, 11, 12].map(quarterOfMonth)).toEqual([4, 4, 4]);
  });
});

describe("propertyDateOf", () => {
  it("resolves the date at the property, not in UTC", () => {
    // 6pm on New Year's Eve in Utah is already 1 January in UTC. Taking the UTC
    // date would file this payment in the wrong year *and* the wrong quarter.
    expect(propertyDateOf("2027-01-01T01:30:00.000Z")).toBe("2026-12-31");
    expect(periodOfDate(propertyDateOf("2027-01-01T01:30:00.000Z"))).toEqual({
      year: 2026,
      quarter: 4,
    });
  });

  it("keeps a midday payment on its own date", () => {
    expect(propertyDateOf("2026-07-04T18:00:00.000Z")).toBe("2026-07-04");
  });
});

describe("period keys", () => {
  it("round-trips", () => {
    const p = { year: 2026, quarter: 3 };
    expect(periodKey(p)).toBe("2026-Q3");
    expect(parsePeriodKey(periodKey(p))).toEqual(p);
  });

  it("rejects anything that isn't a quarter", () => {
    expect(parsePeriodKey("2026-Q5")).toBeNull();
    expect(parsePeriodKey("2026-Q0")).toBeNull();
    expect(parsePeriodKey("nonsense")).toBeNull();
    expect(parsePeriodKey(undefined)).toBeNull();
  });

  it("labels a period readably", () => {
    expect(periodLabel({ year: 2026, quarter: 3 })).toBe("Q3 2026 · Jul–Sep");
  });
});

describe("periodDueDate", () => {
  it("is the last day of the month after the quarter", () => {
    expect(periodDueDate({ year: 2026, quarter: 1 })).toBe("2026-04-30");
    expect(periodDueDate({ year: 2026, quarter: 2 })).toBe("2026-07-31");
    expect(periodDueDate({ year: 2026, quarter: 3 })).toBe("2026-10-31");
  });

  it("rolls Q4 into the following January", () => {
    expect(periodDueDate({ year: 2026, quarter: 4 })).toBe("2027-01-31");
  });
});

describe("wasPaid", () => {
  it("counts confirmed and completed bookings", () => {
    expect(wasPaid(booking({ status: "confirmed" }))).toBe(true);
    expect(wasPaid(booking({ status: "completed" }))).toBe(true);
  });

  it("never counts a pending hold — the money has not arrived", () => {
    expect(wasPaid(booking({ status: "pending", stripe_payment_intent: null }))).toBe(false);
  });

  it("excludes a cancelled booking that never took money", () => {
    // An expired hold or an abandoned checkout: no payment intent, no refund.
    expect(
      wasPaid(booking({ status: "cancelled", stripe_payment_intent: null, refund_cents: 0 }))
    ).toBe(false);
  });

  it("includes a cancelled booking that was charged", () => {
    // Cancelled inside the no-refund window: the owner kept every cent, and it
    // is taxable revenue even though the status says cancelled.
    expect(
      wasPaid(booking({ status: "cancelled", stripe_payment_intent: "pi_1", refund_cents: 0 }))
    ).toBe(true);
  });

  it("includes a cancelled booking proved paid by its refund alone", () => {
    expect(
      wasPaid(booking({ status: "cancelled", stripe_payment_intent: null, refund_cents: 1 }))
    ).toBe(true);
  });
});

describe("refundDateOf", () => {
  it("uses the date the refund was issued", () => {
    const b = booking({ refund_cents: 100, refunded_at: "2026-10-05T18:00:00.000Z" });
    expect(refundDateOf(b)).toBe("2026-10-05");
  });

  it("falls back to the booking date for rows backfilled by migration 0005", () => {
    const b = booking({ refund_cents: 100, refunded_at: null });
    expect(refundDateOf(b)).toBe("2026-07-04");
  });
});

describe("reportRows", () => {
  it("derives tax from the amount, ignoring any stored quote", () => {
    const [receipt] = reportRows([booking()]);
    expect(receipt.tax).toEqual(computeLodgingTax(50_000));
    expect(receipt.checkIn).toBe("2026-08-17");
    expect(receipt.checkOut).toBe("2026-08-20");
  });

  it("files a receipt by payment date, not by the dates of the stay", () => {
    // Paid in Q3, stay is in Q4.
    const [receipt] = reportRows([
      booking({ created_at: "2026-09-20T18:00:00.000Z", stay: "[2026-11-01,2026-11-04)" }),
    ]);
    expect(receipt.date).toBe("2026-09-20");
    expect(receipt.period).toEqual({ year: 2026, quarter: 3 });
  });

  it("emits no line at all for a booking that never took money", () => {
    expect(
      reportRows([booking({ status: "cancelled", stripe_payment_intent: null })])
    ).toEqual([]);
  });

  it("splits a refunded booking into a receipt and a negative refund", () => {
    const rows = reportRows([
      booking({
        status: "cancelled",
        total_cents: 50_000,
        refund_cents: 25_000,
        refunded_at: "2026-07-20T18:00:00.000Z",
      }),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["receipt", "refund"]);
    expect(rows[0].tax.grossCents).toBe(50_000);
    expect(rows[1].tax.grossCents).toBe(-25_000);
    expect(rows[1].tax.salesTaxCents).toBe(-computeLodgingTax(25_000).salesTaxCents);
    expect(rows[1].tax.trtTotalCents).toBe(-computeLodgingTax(25_000).trtTotalCents);
  });

  it("gives the two lines distinct keys", () => {
    const rows = reportRows([booking({ refund_cents: 1_000, refunded_at: booking().created_at })]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
    expect(rows.every((r) => r.id === "b1")).toBe(true);
  });

  it("puts the refund on the quarter it was issued, not the quarter paid", () => {
    // Paid in Q3, refunded in Q4 — two returns, one booking. The Q3 return,
    // already filed, stays correct as filed.
    const rows = reportRows([
      booking({
        status: "cancelled",
        created_at: "2026-08-01T18:00:00.000Z",
        refund_cents: 20_000,
        refunded_at: "2026-10-02T18:00:00.000Z",
      }),
    ]);
    expect(rows[0].period).toEqual({ year: 2026, quarter: 3 });
    expect(rows[1].period).toEqual({ year: 2026, quarter: 4 });
  });
});

describe("summarize", () => {
  const rows = reportRows([
    booking({ id: "a", total_cents: 33_333 }),
    booking({ id: "b", total_cents: 12_345 }),
    booking({ id: "c", total_cents: 1 }),
  ]);
  const totals = summarize(rows);

  it("counts the bookings and their gross", () => {
    expect(totals.bookings).toBe(3);
    expect(totals.refunds).toBe(0);
    expect(totals.grossReceivedCents).toBe(33_333 + 12_345 + 1);
    expect(totals.grossCents).toBe(totals.grossReceivedCents);
  });

  it("reconciles: base + tax is the gross, to the cent", () => {
    expect(totals.taxableBaseCents + totals.totalTaxCents).toBe(totals.grossCents);
  });

  it("reconciles: the three components sum to the total tax", () => {
    expect(totals.salesTaxCents + totals.stateTrtCents + totals.countyTrtCents).toBe(
      totals.totalTaxCents
    );
  });

  it("keeps the TRT subtotal apart from sales tax", () => {
    expect(totals.trtTotalCents).toBe(totals.stateTrtCents + totals.countyTrtCents);
    expect(totals.trtTotalCents + totals.salesTaxCents).toBe(totals.totalTaxCents);
  });

  it("is empty-safe", () => {
    expect(summarize([])).toMatchObject({ bookings: 0, grossCents: 0, totalTaxCents: 0 });
  });

  it("nets a refund out of the period it was issued in", () => {
    const netted = summarize(
      reportRows([
        booking({
          status: "cancelled",
          total_cents: 50_000,
          refund_cents: 25_000,
          refunded_at: "2026-07-20T18:00:00.000Z",
        }),
      ])
    );
    expect(netted.bookings).toBe(1);
    expect(netted.refunds).toBe(1);
    expect(netted.grossReceivedCents).toBe(50_000);
    expect(netted.refundedCents).toBe(25_000);
    expect(netted.grossCents).toBe(25_000);
    // And the tax filed is the tax on what was actually kept.
    expect(netted.taxableBaseCents + netted.totalTaxCents).toBe(25_000);
  });

  it("reports the full total when a paid booking is cancelled with no refund", () => {
    // The old confirmed-only report dropped this booking entirely and
    // under-reported every cent of it.
    const kept = summarize(
      reportRows([
        booking({ status: "cancelled", stripe_payment_intent: "pi_1", refund_cents: 0 }),
      ])
    );
    expect(kept.grossCents).toBe(50_000);
    expect(kept.totalTaxCents).toBe(computeLodgingTax(50_000).totalTaxCents);
  });

  it("can go negative when a period refunds more than it takes in", () => {
    // A quiet quarter that refunds a booking paid for in a busier one. The
    // return legitimately reports a credit.
    const rows = reportRows([
      booking({
        status: "cancelled",
        created_at: "2026-08-01T18:00:00.000Z",
        refund_cents: 40_000,
        refunded_at: "2026-10-02T18:00:00.000Z",
      }),
    ]);
    const q4 = summarize(rowsInPeriod(rows, { year: 2026, quarter: 4 }));
    expect(q4.grossCents).toBe(-40_000);
    expect(q4.totalTaxCents).toBeLessThan(0);
    expect(q4.taxableBaseCents + q4.totalTaxCents).toBe(-40_000);
  });
});

describe("periodsPresent / rowsInPeriod", () => {
  const rows = reportRows([
    booking({ id: "a", created_at: "2026-02-10T18:00:00.000Z" }),
    booking({ id: "b", created_at: "2026-08-10T18:00:00.000Z" }),
    booking({ id: "c", created_at: "2026-09-10T18:00:00.000Z" }),
    booking({ id: "d", created_at: "2025-11-10T18:00:00.000Z" }),
  ]);

  it("lists each period once, newest first", () => {
    expect(periodsPresent(rows).map(periodKey)).toEqual(["2026-Q3", "2026-Q1", "2025-Q4"]);
  });

  it("selects only the chosen period", () => {
    expect(rowsInPeriod(rows, { year: 2026, quarter: 3 }).map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("returns nothing for a period with no lines", () => {
    expect(rowsInPeriod(rows, { year: 2024, quarter: 1 })).toEqual([]);
  });

  it("surfaces a period that only has a refund in it", () => {
    const refundOnly = reportRows([
      booking({
        status: "cancelled",
        created_at: "2026-08-01T18:00:00.000Z",
        refund_cents: 10_000,
        refunded_at: "2027-01-05T18:00:00.000Z",
      }),
    ]);
    expect(periodsPresent(refundOnly).map(periodKey)).toEqual(["2027-Q1", "2026-Q3"]);
  });
});

describe("toCsv", () => {
  const rows = reportRows([booking({ id: "a", total_cents: 50_000 })]);

  it("writes a header, a line per row and a TOTAL line", () => {
    const lines = toCsv(rows).trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^Booking ID,Type,Guest,Date,/);
    expect(lines[1]).toContain("Ada Lovelace");
    expect(lines[2]).toContain("TOTAL");
    expect(lines[2]).toContain("1 booking, 0 refunds");
  });

  it("writes amounts as bare decimals a spreadsheet can total", () => {
    const tax = computeLodgingTax(50_000);
    expect(toCsv(rows)).toContain(`,500.00,${(tax.taxableBaseCents / 100).toFixed(2)},`);
    expect(toCsv(rows)).not.toContain("$");
  });

  it("writes refunds as negative amounts that sum to the filed figure", () => {
    const csv = toCsv(
      reportRows([
        booking({
          status: "cancelled",
          total_cents: 50_000,
          refund_cents: 25_000,
          refunded_at: "2026-07-20T18:00:00.000Z",
        }),
      ])
    );
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[2]).toContain("Refund");
    expect(lines[2]).toContain("-250.00");
    expect(lines[3]).toContain("250.00"); // TOTAL: 500 taken, 250 back
    expect(lines[3]).toContain("1 booking, 1 refund");
  });

  it("quotes a guest name containing a comma", () => {
    const csv = toCsv(reportRows([booking({ guest_name: 'Doe, "Jane"' })]));
    expect(csv).toContain('"Doe, ""Jane"""');
  });

  it("still produces a filable file with no lines", () => {
    const lines = toCsv([]).trimEnd().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("0 bookings, 0 refunds");
  });
});

describe("csvFilename", () => {
  it("names the file after the period", () => {
    expect(csvFilename({ year: 2026, quarter: 3 })).toBe(
      "clover-creek-lodging-tax-2026-Q3.csv"
    );
  });
});
