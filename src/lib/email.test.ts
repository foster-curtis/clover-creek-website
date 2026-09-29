import { describe, expect, it } from "vitest";
import { canEmail, PLACEHOLDER_GUEST_EMAIL } from "./email";

describe("canEmail", () => {
  it("accepts an ordinary address", () => {
    expect(canEmail("guest@example.com")).toBe(true);
    expect(canEmail(" Guest@Example.co.uk ")).toBe(true);
  });

  it("rejects the manual-booking placeholder", () => {
    expect(canEmail(PLACEHOLDER_GUEST_EMAIL)).toBe(false);
    expect(canEmail("  MANUAL@BOOKING.LOCAL ")).toBe(false);
  });

  it("rejects nothing at all", () => {
    expect(canEmail("")).toBe(false);
    expect(canEmail(null)).toBe(false);
    expect(canEmail(undefined)).toBe(false);
  });

  it("rejects what isn't an address", () => {
    expect(canEmail("no-at-sign")).toBe(false);
    expect(canEmail("guest@localhost")).toBe(false);
    expect(canEmail("two parts@example.com")).toBe(false);
  });
});
