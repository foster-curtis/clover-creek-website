import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BLOCKED_DATES_CONFLICT, isDatesTaken, rangesOverlap } from "./availability";

const range = (checkIn: string, checkOut: string) => ({ checkIn, checkOut });

describe("rangesOverlap", () => {
  it("does not clash when one stay checks out the day the next checks in", () => {
    // The block-then-booking case the stage was written for: [Mar 1, Mar 8)
    // and [Mar 8, Mar 12) share a date but not a night.
    expect(rangesOverlap(range("2027-03-01", "2027-03-08"), range("2027-03-08", "2027-03-12"))).toBe(
      false
    );
  });

  it("gives the same answer whichever range comes first", () => {
    const early = range("2027-03-01", "2027-03-08");
    const late = range("2027-03-08", "2027-03-12");
    const straddling = range("2027-03-07", "2027-03-09");
    expect(rangesOverlap(late, early)).toBe(false);
    expect(rangesOverlap(early, straddling)).toBe(true);
    expect(rangesOverlap(straddling, early)).toBe(true);
    expect(rangesOverlap(late, straddling)).toBe(true);
    expect(rangesOverlap(straddling, late)).toBe(true);
  });

  it("clashes on a single shared night", () => {
    expect(rangesOverlap(range("2027-03-01", "2027-03-08"), range("2027-03-07", "2027-03-12"))).toBe(
      true
    );
  });

  it("clashes when one range contains the other", () => {
    const week = range("2027-03-01", "2027-03-08");
    const midweek = range("2027-03-03", "2027-03-05");
    expect(rangesOverlap(week, midweek)).toBe(true);
    expect(rangesOverlap(midweek, week)).toBe(true);
  });

  it("clashes with an identical range", () => {
    const week = range("2027-03-01", "2027-03-08");
    expect(rangesOverlap(week, { ...week })).toBe(true);
  });

  it("handles one-night ranges", () => {
    const night = range("2027-03-05", "2027-03-06");
    expect(rangesOverlap(night, range("2027-03-05", "2027-03-06"))).toBe(true);
    expect(rangesOverlap(night, range("2027-03-06", "2027-03-07"))).toBe(false);
    expect(rangesOverlap(night, range("2027-03-04", "2027-03-05"))).toBe(false);
    expect(rangesOverlap(night, range("2027-03-01", "2027-03-08"))).toBe(true);
  });

  it("does not clash across a gap", () => {
    expect(rangesOverlap(range("2027-03-01", "2027-03-04"), range("2027-03-06", "2027-03-09"))).toBe(
      false
    );
  });

  it("treats an empty range as overlapping nothing, as Postgres does", () => {
    const week = range("2027-03-01", "2027-03-08");
    expect(rangesOverlap(week, range("2027-03-04", "2027-03-04"))).toBe(false);
    expect(rangesOverlap(range("2027-03-04", "2027-03-04"), week)).toBe(false);
  });

  it("compares across month and year boundaries", () => {
    expect(rangesOverlap(range("2026-12-29", "2027-01-03"), range("2027-01-02", "2027-01-05"))).toBe(
      true
    );
    expect(rangesOverlap(range("2027-02-26", "2027-03-01"), range("2027-03-01", "2027-03-03"))).toBe(
      false
    );
  });
});

describe("isDatesTaken", () => {
  it("treats a clash with a block the same as a clash with a booking", () => {
    expect(isDatesTaken("23P01")).toBe(true);
    expect(isDatesTaken("CC001")).toBe(true);
  });

  it("matches every CC… code the migrations raise", () => {
    // The route maps this code to a 409; if a migration raises another, a
    // blocked week comes back to the guest as a 500.
    const dir = join(process.cwd(), "supabase/migrations");
    const raised = readdirSync(dir)
      .filter((file) => file.endsWith(".sql"))
      .flatMap((file) =>
        [...readFileSync(join(dir, file), "utf8").matchAll(/errcode\s*=\s*'(CC[0-9A-Z]*)'/gi)].map(
          (m) => `${file}: ${m[1]}`
        )
      );
    expect(raised.length).toBeGreaterThan(0);
    for (const found of raised) expect(found).toMatch(new RegExp(`: ${BLOCKED_DATES_CONFLICT}$`));
  });

  it("leaves every other failure alone", () => {
    expect(isDatesTaken("23505")).toBe(false);
    expect(isDatesTaken("PGRST116")).toBe(false);
    expect(isDatesTaken("")).toBe(false);
    expect(isDatesTaken(undefined)).toBe(false);
    expect(isDatesTaken(null)).toBe(false);
  });
});
