import { describe, expect, it } from "vitest";
import { bookAnswer, faqAnswer, homeAnswer } from "./answers";
import { DEFAULT_PRICING, type PricingConfig } from "./pricing";

const words = (s: string) => s.trim().split(/\s+/).length;

const ANSWERS = { homeAnswer, bookAnswer, faqAnswer };

// A config at the wordy end of plausible: three-digit rates and a multi-night minimum.
const WORDY: PricingConfig = { ...DEFAULT_PRICING, weekdayBase: 125, weekendBase: 165, minStayNights: 3 };

describe("direct-answer paragraphs", () => {
  for (const [name, fn] of Object.entries(ANSWERS)) {
    it(`${name} stays within 40-60 words`, () => {
      for (const pricing of [DEFAULT_PRICING, WORDY]) {
        const n = words(fn(pricing));
        expect(n).toBeGreaterThanOrEqual(40);
        expect(n).toBeLessThanOrEqual(60);
      }
    });
  }

  it("are distinct from one another", () => {
    const texts = Object.values(ANSWERS).map((fn) => fn(DEFAULT_PRICING));
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("take their numbers from live pricing", () => {
    expect(homeAnswer(WORDY)).toContain("$125");
    expect(bookAnswer(WORDY)).toContain("$165");
    expect(bookAnswer(WORDY)).toContain("minimum stay is 3 nights");
    expect(bookAnswer(DEFAULT_PRICING)).toContain("Single-night stays are welcome");
    expect(faqAnswer({ ...DEFAULT_PRICING, maxGuests: 4 })).toContain("up to 4 guests");
  });
});
