// Direct-answer paragraphs (SEO_PLAN.md §12.1): one per important page, answering
// that page's core question in 40-60 words of complete sentences, quotable without
// the surrounding page. Every number comes from live config so the copy can never
// contradict the booking engine. Each page answers its *own* question — near-duplicate
// text across pages is exactly what gets suppressed (§3.1).
//
// Keep the wording aligned with SITE.description and the OTA listings (§6.2, §11.4).

import { REFUND_TIERS } from "./cancellation";
import type { PricingConfig } from "./pricing";
import { formatUSD } from "./pricing";
import { SITE } from "./site";

type AnswerPricing = Pick<
  PricingConfig,
  "weekdayBase" | "weekendBase" | "maxGuests" | "maxPets" | "petFeePerDay" | "minStayNights"
>;

/** `/` — what the place is, where, and what it costs. */
export function homeAnswer(pricing: AnswerPricing): string {
  return `${SITE.name} is a farmhouse cottage in Rush Valley, Utah, about an hour southwest of Salt Lake City. It sleeps ${pricing.maxGuests}, welcomes up to ${pricing.maxPets} dogs, and sits on a working farm under some of the darkest skies in northern Utah. Rates start at ${formatUSD(pricing.weekdayBase)} a night for two guests, with cleaning and taxes included.`;
}

/** `/book` — what booking direct gets you. */
export function bookAnswer(pricing: AnswerPricing): string {
  const minStay =
    pricing.minStayNights > 1
      ? `The minimum stay is ${pricing.minStayNights} nights`
      : "Single-night stays are welcome";
  const fullRefund = REFUND_TIERS[0].label;
  return `Booking direct with ${SITE.name} means no listing-site service fee. Nightly rates start at ${formatUSD(pricing.weekdayBase)} on weeknights and ${formatUSD(pricing.weekendBase)} on Friday, Saturday and holiday nights for two guests, with cleaning and taxes already included. ${minStay}, and cancelling ${fullRefund} before check-in earns a full refund.`;
}

/** `/faq` — what the house is, where, and the practicals guests ask first. */
export function faqAnswer(pricing: AnswerPricing): string {
  return `${SITE.name} is a one-bedroom farmhouse cottage with a sleeping loft in Rush Valley, Utah, west of the Oquirrh Mountains. The whole house is yours for up to ${pricing.maxGuests} guests. Check-in is from ${SITE.checkInTime}, check-out by ${SITE.checkOutTime}, and up to ${pricing.maxPets} dogs are welcome at ${formatUSD(pricing.petFeePerDay)} per dog per day.`;
}
