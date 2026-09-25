import { describe, expect, it } from "vitest";
import { holidayMap } from "./holidays";
import {
  computeLodgingTax,
  DEFAULT_PRICING,
  parseStay,
  quoteStay,
  TAX_RATE,
  TAX_RATES,
  validateStay,
} from "./pricing";

// 2026 reference dates: 2026-01-05 is a Monday; 2026-01-09 is a Friday.
const holidays = holidayMap(2026, 2027, [{ day: "2026-07-24", label: "Pioneer Day" }]);

describe("validateStay", () => {
  it("rejects checkout before checkin", () => {
    expect(
      validateStay({ checkIn: "2026-01-10", checkOut: "2026-01-09", guests: 2, pets: 0 })
    ).toMatch(/check-out/i);
  });

  it("rejects more than 6 guests and more than 2 pets", () => {
    expect(
      validateStay({ checkIn: "2026-01-05", checkOut: "2026-01-06", guests: 7, pets: 0 })
    ).toMatch(/6 guests/);
    expect(
      validateStay({ checkIn: "2026-01-05", checkOut: "2026-01-06", guests: 2, pets: 3 })
    ).toMatch(/2 pets/);
  });

  it("rejects past check-in relative to today", () => {
    expect(
      validateStay(
        { checkIn: "2026-01-05", checkOut: "2026-01-06", guests: 2, pets: 0 },
        DEFAULT_PRICING,
        "2026-02-01"
      )
    ).toMatch(/past/);
  });

  it("rejects same-day check-in", () => {
    expect(
      validateStay(
        { checkIn: "2026-02-01", checkOut: "2026-02-02", guests: 2, pets: 0 },
        DEFAULT_PRICING,
        "2026-02-01"
      )
    ).toMatch(/advance/);
  });

  it("rejects check-in more than a year out, bookable through end of that month", () => {
    // today is 2026-08-17 → bookable through 2027-08-31.
    expect(
      validateStay(
        { checkIn: "2027-08-30", checkOut: "2027-08-31", guests: 2, pets: 0 },
        DEFAULT_PRICING,
        "2026-08-17"
      )
    ).toBeNull();
    expect(
      validateStay(
        { checkIn: "2027-09-01", checkOut: "2027-09-02", guests: 2, pets: 0 },
        DEFAULT_PRICING,
        "2026-08-17"
      )
    ).toMatch(/advance/);
    // Check-out itself can't land past the cutoff, even one extra day.
    expect(
      validateStay(
        { checkIn: "2027-08-31", checkOut: "2027-09-01", guests: 2, pets: 0 },
        DEFAULT_PRICING,
        "2026-08-17"
      )
    ).toMatch(/advance/);
  });

  it("accepts a valid stay", () => {
    expect(
      validateStay({ checkIn: "2026-01-05", checkOut: "2026-01-08", guests: 4, pets: 1 })
    ).toBeNull();
  });
});

describe("quoteStay", () => {
  it("prices a weekday night at $75 for two guests", () => {
    const q = quoteStay(
      { checkIn: "2026-01-05", checkOut: "2026-01-06", guests: 2, pets: 0 },
      holidays
    );
    expect(q.total).toBe(75);
    expect(q.nights[0].weekendRate).toBe(false);
  });

  it("prices Friday and Saturday nights at $105", () => {
    // Jan 9 2026 = Friday, Jan 10 = Saturday
    const q = quoteStay(
      { checkIn: "2026-01-09", checkOut: "2026-01-11", guests: 2, pets: 0 },
      holidays
    );
    expect(q.nights.map((n) => n.base)).toEqual([105, 105]);
    expect(q.total).toBe(210);
  });

  it("Sunday night is a weekday rate", () => {
    // Jan 11 2026 = Sunday
    const q = quoteStay(
      { checkIn: "2026-01-11", checkOut: "2026-01-12", guests: 2, pets: 0 },
      holidays
    );
    expect(q.nights[0].base).toBe(75);
  });

  it("charges $20/extra guest on weekdays and $25 on weekends", () => {
    // Mon night, 4 guests: 75 + 2*20 = 115
    const wk = quoteStay(
      { checkIn: "2026-01-05", checkOut: "2026-01-06", guests: 4, pets: 0 },
      holidays
    );
    expect(wk.total).toBe(115);
    // Fri night, 6 guests: 105 + 4*25 = 205
    const we = quoteStay(
      { checkIn: "2026-01-09", checkOut: "2026-01-10", guests: 6, pets: 0 },
      holidays
    );
    expect(we.total).toBe(205);
  });

  it("charges $20 per pet per night", () => {
    const q = quoteStay(
      { checkIn: "2026-01-05", checkOut: "2026-01-08", guests: 2, pets: 2 },
      holidays
    );
    // 3 weekday nights (Mon-Wed) = 225 lodging + 2 pets * 3 nights * 20 = 120
    expect(q.lodgingSubtotal).toBe(225);
    expect(q.petFee).toBe(120);
    expect(q.total).toBe(345);
  });

  it("prices holidays (and holiday eves) at the weekend rate", () => {
    // July 4 2026 falls on a Saturday; use Thanksgiving 2026 (Thu Nov 26).
    // Night of Nov 25 (Wed) is a holiday eve, night of Nov 26 is the holiday.
    const q = quoteStay(
      { checkIn: "2026-11-25", checkOut: "2026-11-27", guests: 2, pets: 0 },
      holidays
    );
    expect(q.nights[0].base).toBe(105);
    expect(q.nights[0].holiday).toBe("Thanksgiving");
    expect(q.nights[1].base).toBe(105);
    expect(q.total).toBe(210);
  });

  it("a plain midweek night is never weekend-priced", () => {
    // 2026-03-10 is a Tuesday with no nearby holiday
    const q = quoteStay(
      { checkIn: "2026-03-10", checkOut: "2026-03-11", guests: 2, pets: 0 },
      holidays
    );
    expect(q.nights[0].weekendRate).toBe(false);
  });

  it("computes totalCents for Stripe", () => {
    const q = quoteStay(
      { checkIn: "2026-01-05", checkOut: "2026-01-06", guests: 2, pets: 1 },
      holidays
    );
    expect(q.totalCents).toBe(9500);
  });

  it("throws on invalid input", () => {
    expect(() =>
      quoteStay({ checkIn: "2026-01-05", checkOut: "2026-01-05", guests: 2, pets: 0 }, holidays)
    ).toThrow();
  });
});

describe("parseStay", () => {
  it("reads the half-open range Postgres returns", () => {
    expect(parseStay("[2026-08-17,2026-08-20)")).toEqual({
      checkIn: "2026-08-17",
      checkOut: "2026-08-20",
    });
  });

  it("accepts either bracket style", () => {
    expect(parseStay("(2026-01-01,2026-01-02]")).toEqual({
      checkIn: "2026-01-01",
      checkOut: "2026-01-02",
    });
  });

  it("yields empty strings rather than throwing on junk", () => {
    expect(parseStay("")).toEqual({ checkIn: "", checkOut: "" });
    expect(parseStay("not a range")).toEqual({ checkIn: "", checkOut: "" });
  });
});

describe("computeLodgingTax", () => {
  it("backs the tax out of the total instead of adding to it", () => {
    // $150.00 gross at 12.17% inclusive: base 133.73, tax 16.27.
    const t = computeLodgingTax(15000);
    expect(t.grossCents).toBe(15000);
    expect(t.taxableBaseCents).toBe(13373);
    expect(t.totalTaxCents).toBe(1627);
  });

  it("splits the tax into sales tax and the two TRT shares", () => {
    const t = computeLodgingTax(15000);
    expect(t.salesTaxCents).toBe(883); // 13373 * 6.6%
    expect(t.stateTrtCents).toBe(143); // 13373 * 1.07%
    expect(t.countyTrtCents).toBe(601); // the remainder, 13373 * 4.5%
  });

  it("reports the TRT subtotal separately from sales tax", () => {
    const t = computeLodgingTax(15000);
    // The two taxes go on different returns, so the TRT figure stands alone.
    expect(t.trtTotalCents).toBe(t.stateTrtCents + t.countyTrtCents);
    expect(t.trtTotalCents).toBe(744);
    expect(t.trtTotalCents + t.salesTaxCents).toBe(t.totalTaxCents);
  });

  it("always reconciles exactly, with no rounding drift", () => {
    for (let gross = 0; gross <= 20000; gross += 3) {
      const t = computeLodgingTax(gross);
      expect(t.taxableBaseCents + t.totalTaxCents).toBe(gross);
      expect(t.salesTaxCents + t.stateTrtCents + t.countyTrtCents).toBe(t.totalTaxCents);
      expect(t.countyTrtCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles a zero total", () => {
    expect(computeLodgingTax(0)).toMatchObject({
      grossCents: 0,
      taxableBaseCents: 0,
      totalTaxCents: 0,
      salesTaxCents: 0,
      stateTrtCents: 0,
      countyTrtCents: 0,
      trtTotalCents: 0,
    });
  });

  it("never returns a negative amount", () => {
    const t = computeLodgingTax(-500);
    expect(t.grossCents).toBe(0);
    expect(t.totalTaxCents).toBe(0);
  });

  it("keeps the headline rate equal to the sum of its components", () => {
    expect(TAX_RATES.salesTax + TAX_RATES.stateTrt + TAX_RATES.countyTrt).toBe(TAX_RATE);
    expect(TAX_RATE).toBe(0.1217);
  });
});

describe("quoteStay tax", () => {
  it("records the tax without changing what the guest pays", () => {
    const quote = quoteStay(
      { checkIn: "2026-01-05", checkOut: "2026-01-07", guests: 2, pets: 0 },
      holidays
    );
    // Two weekday nights at $75 — the total is untouched by the tax split.
    expect(quote.totalCents).toBe(15000);
    expect(quote.tax.grossCents).toBe(quote.totalCents);
    expect(quote.tax.taxableBaseCents + quote.tax.totalTaxCents).toBe(quote.totalCents);
  });

  it("taxes the pet fee along with the lodging", () => {
    const quote = quoteStay(
      { checkIn: "2026-01-05", checkOut: "2026-01-06", guests: 2, pets: 1 },
      holidays
    );
    expect(quote.petFee).toBe(20);
    expect(quote.tax.grossCents).toBe(9500); // $75 + $20, both taxed
    expect(quote.tax.totalTaxCents).toBe(1031);
  });
});
