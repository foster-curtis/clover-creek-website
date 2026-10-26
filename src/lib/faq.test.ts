import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "./content";
import { EXTRA_TEXT, faqEntries, faqSchemaItems, MIN_STAY_ID, minStayAnswer } from "./faq";
import { DEFAULT_PRICING } from "./pricing";

const entries = faqEntries(DEFAULT_CONTENT, DEFAULT_PRICING);

describe("faqEntries", () => {
  it("lists fifteen questions with unique anchor ids", () => {
    expect(entries).toHaveLength(15);
    expect(new Set(entries.map((e) => e.id)).size).toBe(15);
    for (const e of entries) expect(e.id).toMatch(/^[a-z-]+$/);
  });

  it("places the generated minimum-stay answer right after fees", () => {
    const i = entries.findIndex((e) => e.id === "fees");
    expect(entries[i + 1].id).toBe(MIN_STAY_ID);
  });

  it("gives every question a non-empty default answer", () => {
    for (const e of entries) expect(e.answer.trim()).not.toBe("");
  });
});

describe("minStayAnswer", () => {
  it("tracks pricing.minStayNights", () => {
    expect(minStayAnswer({ minStayNights: 1 })).toBe("No — we accept single-night bookings.");
    expect(minStayAnswer({ minStayNights: 3 })).toBe("Yes — the minimum stay is 3 nights.");
  });
});

describe("faqSchemaItems", () => {
  const items = faqSchemaItems(entries);

  it("is plain text only", () => {
    for (const i of items) expect(i.answer).not.toMatch(/[<>]/);
  });

  it("appends each extra's plain text so markup matches the page", () => {
    const pets = items[entries.findIndex((e) => e.id === "pets")];
    expect(pets.answer).toBe(`${DEFAULT_CONTENT.faq_pets} ${EXTRA_TEXT.pets}`);
    const cancel = items[entries.findIndex((e) => e.id === "cancel")];
    expect(cancel.answer).toContain("6 weeks or more before check-in — full refund, no fee.");
  });
});
