// The FAQ — one list of questions, consumed by both the /faq page and its FAQPage
// markup, so the two can never fall out of sync (SEO_PLAN.md §12.2, §8.3).
//
// Question wording is deliberate: each is phrased the way a person types it into an
// assistant. The anchor ids are public deep links — never change one once published.

import { describeRefund, REFUND_TIERS } from "./cancellation";
import type { ContentSlug } from "./content";
import type { PricingConfig } from "./pricing";

export type FaqExtra = "pets" | "cancellation" | "area-guide";

export interface FaqItem {
  /** Stable anchor id — used for #deep-links and never changed once published. */
  id: string;
  question: string;
  /** Owner-editable answer body. */
  slug: ContentSlug;
  /**
   * Extra content the page renders after the answer text. The schema uses the
   * plain answer plus EXTRA_TEXT, so anything here must be supplementary, never
   * load-bearing.
   */
  extra?: FaqExtra;
}

export const FAQ_ITEMS: FaqItem[] = [
  { id: "check-in", question: "What time is check-in and check-out?", slug: "faq_checkin" },
  { id: "fees", question: "Are there extra fees on top of the nightly rate?", slug: "faq_fees" },
  { id: "guests", question: "How many people can stay?", slug: "faq_guests" },
  { id: "pets", question: "Can I bring my dog?", slug: "faq_pets", extra: "pets" },
  { id: "wifi", question: "Is there Wi-Fi at the guest house?", slug: "faq_wifi" },
  { id: "cell", question: "Is there cell service in Rush Valley?", slug: "faq_cell" },
  { id: "distance", question: "How far is the house from Salt Lake City?", slug: "faq_distance" },
  { id: "airport", question: "How far is the house from Salt Lake City airport?", slug: "faq_airport" },
  { id: "grocery", question: "Where is the nearest grocery store and gas?", slug: "faq_grocery" },
  { id: "stargazing", question: "Is the property good for stargazing?", slug: "faq_stargazing" },
  {
    id: "onaqui",
    question: "Can I see the Onaqui wild horses from the guest house?",
    slug: "faq_onaqui",
  },
  {
    id: "nearby",
    question: "What is there to do nearby?",
    slug: "faq_things_nearby",
    extra: "area-guide",
  },
  { id: "winter", question: "What is there to do near Rush Valley in winter?", slug: "faq_winter" },
  { id: "cancel", question: "Can I cancel my booking?", slug: "faq_cancel", extra: "cancellation" },
];

/**
 * Plain-text versions of what the page renders for each `extra`, appended to the
 * answer in the FAQPage markup. Keep these word for word with the JSX in
 * src/app/faq/page.tsx — the markup must say what the page says.
 */
export const EXTRA_TEXT: Record<FaqExtra, string> = {
  pets: "Please read the pet policy — the property isn't fenced, and skunks live in the valley, so pets shouldn't be left outside unattended.",
  cancellation: [
    ...REFUND_TIERS.map((t) => `${t.label} before check-in — ${describeRefund(t.percent)}.`),
    "That schedule is the least we'll refund, not the most. We're a small family place, not a chain — if something serious has happened, tell us, and we can refund more than the schedule requires, up to everything you paid.",
    "Please contact us as soon as your plans change — reach out via your booking page or by email and we'll take care of the refund.",
  ].join(" "),
  // A bare link to /blog adds no information the answer text doesn't already give.
  "area-guide": "",
};

/**
 * Generated from live pricing rather than a content slug: minStayNights drives the
 * booking engine, and a hand-written answer could contradict it.
 */
export const MIN_STAY_ID = "minimum-stay";
export const MIN_STAY_QUESTION = "Is there a minimum stay?";

export function minStayAnswer(pricing: Pick<PricingConfig, "minStayNights">): string {
  const n = pricing.minStayNights;
  return n > 1 ? `Yes — the minimum stay is ${n} nights.` : "No — we accept single-night bookings.";
}

export interface FaqEntry {
  id: string;
  question: string;
  /** The answer body as the page shows it, before any `extra`. Plain text. */
  answer: string;
  extra?: FaqExtra;
}

/** Every question in page order, with the minimum-stay answer placed after `fees`. */
export function faqEntries(
  content: Record<ContentSlug, string>,
  pricing: Pick<PricingConfig, "minStayNights">
): FaqEntry[] {
  return FAQ_ITEMS.flatMap((item) => {
    const entry: FaqEntry = {
      id: item.id,
      question: item.question,
      answer: content[item.slug],
      extra: item.extra,
    };
    return item.id === "fees"
      ? [entry, { id: MIN_STAY_ID, question: MIN_STAY_QUESTION, answer: minStayAnswer(pricing) }]
      : [entry];
  });
}

/** The question/answer pairs for faqPageSchema — answer plus its extra, plain text only. */
export function faqSchemaItems(entries: FaqEntry[]): Array<{ question: string; answer: string }> {
  return entries.map((e) => {
    const extra = e.extra ? EXTRA_TEXT[e.extra] : "";
    return { question: e.question, answer: extra ? `${e.answer} ${extra}` : e.answer };
  });
}
