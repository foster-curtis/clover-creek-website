// Refunds as rows: what the webhook records from Stripe, and how the admin
// calendar reads the rows back. The rows live in booking_refunds, one per
// Stripe refund or lost dispute — see
// supabase/migrations/0009_refunds_as_rows.sql.

import type Stripe from "stripe";
import { propertyToday } from "./cancellation";
import { formatUSD } from "./pricing";

/** A refund as record_stripe_refunds() takes it. */
export interface StripeRefundRow {
  id: string;
  amount_cents: number;
  issued_at: string;
  reason: string | null;
}

type ListedRefund = Pick<Stripe.Refund, "id" | "amount" | "created" | "reason" | "status">;

/**
 * Whether a refund counts as money handed back. A failed or cancelled one never
 * reached the guest. The same test refundBooking() applies when it works out
 * how much Stripe still holds, so the two cannot disagree about a refund.
 */
export function countsAsRefunded(refund: Pick<Stripe.Refund, "status">): boolean {
  return refund.status !== "failed" && refund.status !== "canceled";
}

/**
 * Stripe's refunds as rows. `issued_at` is Stripe's `created`, not the time the
 * event arrived: it decides which return the refund reduces.
 */
export function stripeRefundRows(refunds: readonly ListedRefund[]): StripeRefundRow[] {
  return refunds
    .filter((r) => countsAsRefunded(r) && r.amount > 0)
    .map((r) => ({
      id: r.id,
      amount_cents: r.amount,
      issued_at: new Date(r.created * 1000).toISOString(),
      reason: r.reason ?? null,
    }));
}

/**
 * Whether everything captured has gone back. Judged on Stripe's current list,
 * never on the event that prompted the check: events arrive out of order, and
 * a second partial refund can be what completes the first.
 */
export function isFullyRefunded(
  rows: readonly Pick<StripeRefundRow, "amount_cents">[],
  capturedCents: number
): boolean {
  if (capturedCents <= 0) return false;
  return rows.reduce((sum, r) => sum + r.amount_cents, 0) >= capturedCents;
}

/**
 * Whether refunds already recorded cover the whole payment, for confirm(): a
 * booking refunded before its payment was confirmed must not be confirmed.
 * `amountTotal` is the session's, null or 0 for a free checkout, which no
 * refund can "cover".
 */
export function refundsCoverPayment(refundedCents: number, amountTotal: number | null): boolean {
  return amountTotal !== null && amountTotal > 0 && refundedCents >= amountTotal;
}

/** A booking_refunds row as the admin calendar embeds it. */
export interface RefundLineRow {
  amount_cents: number;
  issued_at: string;
  source: string;
}

const SOURCE_LABEL: Record<string, string> = {
  admin: "admin panel",
  dashboard: "Stripe dashboard",
  dispute: "lost dispute",
};

/**
 * One line per refund, oldest first: "Refunded $225 · 2026-09-12 · admin panel".
 * A lost dispute reads "Charged back $X · date · lost dispute": the guest's bank
 * took it, nobody refunded it.
 * The date is the property's, like every other date the owner reads.
 */
export function refundLines(rows: readonly RefundLineRow[]): string[] {
  return [...rows]
    .sort((a, b) => Date.parse(a.issued_at) - Date.parse(b.issued_at))
    .map(
      (r) =>
        `${r.source === "dispute" ? "Charged back" : "Refunded"} ${formatUSD(r.amount_cents / 100)} · ` +
        `${propertyToday(new Date(r.issued_at))} · ${SOURCE_LABEL[r.source] ?? r.source}`
    );
}
