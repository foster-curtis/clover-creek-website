// The cancellation & refund policy. One pure module used by the FAQ, the terms
// page, the guest booking page, the admin refund action and the cancellation
// email — so the published policy and the money actually refunded can never
// disagree.
//
// The refund is a percentage of the booking total (cleaning and taxes are
// folded into that total, so they scale with the tier). Stripe's processing fee
// is not returned to the owner on a refund; that cost is accepted.

import { formatUSD } from "./pricing";
import { SITE } from "./site";

export interface RefundTier {
  /** Applies when cancelling at least this many days before check-in. */
  minDaysBefore: number;
  percent: number;
  /** Guest-facing name for the band, e.g. "4 to 6 weeks". */
  label: string;
}

/** Ordered most- to least-generous; the first tier whose threshold is met wins. */
export const REFUND_TIERS: readonly RefundTier[] = [
  { minDaysBefore: 42, percent: 100, label: "6 weeks or more" },
  { minDaysBefore: 28, percent: 75, label: "4 to 6 weeks" },
  { minDaysBefore: 14, percent: 50, label: "2 to 4 weeks" },
  { minDaysBefore: 7, percent: 25, label: "1 to 2 weeks" },
  { minDaysBefore: 0, percent: 0, label: "Less than 1 week" },
] as const;

/** Days before check-in at or above which the guest gets everything back. */
export const FULL_REFUND_DAYS = REFUND_TIERS[0].minDaysBefore;

// --- date helpers ----------------------------------------------------------
// Plain YYYY-MM-DD dates compared in UTC, so a DST transition between the
// cancellation date and check-in can't shift the day count by one and drop the
// guest into a stingier tier.

function utcMs(isoDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new Error(`Invalid date: ${isoDate}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole days from `asOf` to `checkIn`. Negative once the stay has started. */
export function daysUntilCheckIn(checkIn: string, asOf: string): number {
  return (utcMs(checkIn) - utcMs(asOf)) / 86_400_000;
}

/**
 * Today's date at the property. Tier boundaries are day-granular, so this must
 * be the owner's local date — on a UTC server, an evening cancellation in Utah
 * would otherwise count as the next day.
 */
export function propertyToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE.location.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Last date on which a cancellation still earns a full refund. */
export function fullRefundDeadline(checkIn: string): string {
  return new Date(utcMs(checkIn) - FULL_REFUND_DAYS * 86_400_000).toISOString().slice(0, 10);
}

// --- the policy ------------------------------------------------------------

export interface RefundOutcome {
  tier: RefundTier;
  percent: number;
  refundCents: number;
  daysBefore: number;
}

export function tierFor(daysBefore: number): RefundTier {
  return (
    REFUND_TIERS.find((t) => daysBefore >= t.minDaysBefore) ?? REFUND_TIERS[REFUND_TIERS.length - 1]
  );
}

/**
 * What a booking cancelled on `cancelledOn` is owed back.
 * Both dates are plain YYYY-MM-DD at the property.
 */
export function refundFor(
  checkIn: string,
  cancelledOn: string,
  totalCents: number
): RefundOutcome {
  const daysBefore = daysUntilCheckIn(checkIn, cancelledOn);
  const tier = tierFor(daysBefore);
  return {
    tier,
    percent: tier.percent,
    refundCents: Math.round((totalCents * tier.percent) / 100),
    daysBefore,
  };
}

/** "full refund, no fee" / "75% refund" / "no refund" — for policy copy. */
export function describeRefund(percent: number): string {
  if (percent >= 100) return "full refund, no fee";
  if (percent <= 0) return "no refund";
  return `${percent}% refund`;
}

// --- owner overrides -------------------------------------------------------
// The tiers above are what the guest is *owed*. The owner may pay back more —
// a death in the family, a well that stopped running, a guest we'd rather keep.
// Sizing that refund is the one decision the admin screen and the server action
// must agree on exactly, because the confirmation names the amount and Stripe
// then moves it. So it lives here, pure, rather than in either of them.

/** How the owner asked for the refund to be sized. */
export type RefundInstruction =
  | { kind: "policy" }
  | { kind: "full" }
  | { kind: "amount"; dollars: string };

export interface ResolvedRefund {
  refundCents: number;
  /** The tier outcome for the same day, applied or not — kept for the record. */
  policy: RefundOutcome;
  /** The amount differs from what the tiers alone would have paid. */
  overridden: boolean;
  /** The guest is getting every cent back. */
  full: boolean;
}

/**
 * Size a refund. Throws rather than guessing when an amount is unusable, so a
 * typo in the override box can never be silently rounded into a real refund.
 */
export function resolveRefund(
  instruction: RefundInstruction,
  checkIn: string,
  cancelledOn: string,
  totalCents: number
): ResolvedRefund {
  const policy = refundFor(checkIn, cancelledOn, totalCents);

  let refundCents: number;
  if (instruction.kind === "policy") {
    refundCents = policy.refundCents;
  } else if (instruction.kind === "full") {
    refundCents = totalCents;
  } else {
    const raw = instruction.dollars.trim();
    // Number("") is 0, which would quietly turn a blank box into a $0 refund.
    if (!raw) throw new Error("Invalid refund override");
    const cents = Math.round(Number(raw) * 100);
    if (!Number.isFinite(cents) || cents < 0) throw new Error("Invalid refund override");
    if (cents > totalCents) throw new Error("Refund can't exceed the amount paid");
    refundCents = cents;
  }

  return {
    refundCents,
    policy,
    overridden: refundCents !== policy.refundCents,
    // A $0 booking is refunded "in full" only in the arithmetic sense; there is
    // no money to return, and saying "in full" to the guest would be a lie.
    full: totalCents > 0 && refundCents === totalCents,
  };
}

/**
 * One line for the booking's `notes`, naming what was actually done — a full
 * refund, the policy amount, or an override — and what the policy would have
 * paid. This is the only record of *why* a given number went back, so it leads
 * with the action rather than the tier: a note opening "50% refund" on a
 * booking that was refunded in full is worse than no note at all.
 */
export function describeRefundAction(r: ResolvedRefund): string {
  const amount = formatUSD(r.refundCents / 100);
  const band = `${r.policy.tier.label.toLowerCase()} before check-in`;

  if (!r.overridden) {
    if (r.full) return `full refund ${amount} (policy: ${band})`;
    if (r.refundCents === 0) return `no refund (policy: ${band})`;
    return `policy refund ${amount} (${r.policy.percent}%, ${band})`;
  }

  // An override is only legible next to the number it replaced.
  const said = `policy said ${r.policy.percent}% — ${formatUSD(r.policy.refundCents / 100)}`;
  if (r.full) return `full refund ${amount} (owner override; ${said})`;
  if (r.refundCents === 0) return `no refund (owner override; ${said})`;
  return `override refund ${amount} (${said})`;
}
