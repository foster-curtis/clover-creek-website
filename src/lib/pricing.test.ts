import { describe, expect, it } from "vitest";
import { holidayMap } from "./holidays";
import { DEFAULT_PRICING, quoteStay, validateStay } from "./pricing";

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
