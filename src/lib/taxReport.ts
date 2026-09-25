// Grouping booking money into tax filing periods.
//
// The tax arithmetic itself lives in @/lib/pricing (computeLodgingTax); this
// module only decides *which return* each amount belongs on, and how the lines
// add up. Shared by the admin report page, its CSV export and the dashboard's
// year-to-date card, so they cannot disagree.
//
// Three deliberate choices, all stated in the report UI:
//
//  1. Every figure is derived from an amount in cents via computeLodgingTax,
//     never read from the stored `quote.tax`. Bookings taken before the tax
//     split existed have no `quote.tax`, and deriving covers every row alike.
//
//  2. A payment is filed in the quarter it was *received* (created_at), not the
//     quarter of the stay — the cash basis "gross received" implies.
//
//  3. A refund is filed in the quarter it was *issued* (refunded_at), as a
//     reduction of that quarter's receipts. It does not reach back and change
//     the quarter the booking was paid for, so a return already filed stays
//     correct as filed and never needs amending.
//
// Receipts and refunds are therefore two kinds of line on the same report, and
// a single booking can put one of each on two different returns.

import { propertyToday } from "./cancellation";
import { computeLodgingTax, parseStay, type TaxBreakdown } from "./pricing";

/**
 * The statuses the report has to load.
 *
 * `cancelled` is in the list because it is overloaded: it covers expired holds
 * and abandoned checkouts, where no money ever arrived, *and* paid stays that
 * were later refunded, where it did. `wasPaid()` tells them apart. `pending`
 * is never included — the money has not arrived yet by definition.
 */
export const REPORTED_STATUSES = ["confirmed", "completed", "cancelled"] as const;

/** The columns the report needs off a `bookings` row. */
export interface ReportableBooking {
  id: string;
  stay: string;
  guest_name: string;
  status: string;
  total_cents: number;
  created_at: string;
  stripe_payment_intent: string | null;
  refund_cents: number;
  refunded_at: string | null;
}

export interface FilingPeriod {
  year: number;
  /** 1–4. */
  quarter: number;
}

/** A receipt adds to a period's taxable receipts; a refund subtracts from them. */
export type LineKind = "receipt" | "refund";

export interface TaxReportRow {
  /** Booking id. A booking with a refund contributes two rows, so this is not
   * unique across rows — `key` is. */
  id: string;
  key: string;
  kind: LineKind;
  guestName: string;
  checkIn: string;
  checkOut: string;
  /** The date this line lands on, at the property: payment date for a receipt,
   * refund date for a refund. */
  date: string;
  period: FilingPeriod;
  /** Signed: every figure on a refund row is negative. */
  tax: TaxBreakdown;
}

/**
 * Per-period totals. Adds up the per-line figures rather than re-taxing a
 * summed amount, so the table on screen reconciles to the summary cent for
 * cent. Everything from `taxableBaseCents` down is net of refunds.
 */
export interface PeriodTotals {
  /** Bookings paid for in this period. */
  bookings: number;
  /** Refunds issued in this period. */
  refunds: number;
  /** Taken in, before refunds. */
  grossReceivedCents: number;
  /** Given back, as a positive magnitude. */
  refundedCents: number;
  /** grossReceived − refunded: the receipts this period's returns are built on. */
  grossCents: number;
  taxableBaseCents: number;
  salesTaxCents: number;
  stateTrtCents: number;
  countyTrtCents: number;
  trtTotalCents: number;
  totalTaxCents: number;
}

// --- periods ---------------------------------------------------------------

export function quarterOfMonth(month: number): number {
  return Math.floor((month - 1) / 3) + 1;
}

/**
 * The property-local date a timestamp falls on, as YYYY-MM-DD.
 *
 * A payment taken at 6pm in Utah on 31 December is already 1 January in UTC,
 * and filing it in the wrong quarter would be a real filing error — so the date
 * is resolved at the property's clock, exactly as cancellation deadlines are.
 */
export function propertyDateOf(timestamp: string): string {
  return propertyToday(new Date(timestamp));
}

export function periodOfDate(isoDate: string): FilingPeriod {
  return {
    year: Number(isoDate.slice(0, 4)),
    quarter: quarterOfMonth(Number(isoDate.slice(5, 7))),
  };
}

/** Stable, sortable and URL-safe: "2026-Q3". */
export function periodKey(p: FilingPeriod): string {
  return `${p.year}-Q${p.quarter}`;
}

export function parsePeriodKey(key: string | undefined | null): FilingPeriod | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(key ?? "");
  return m ? { year: Number(m[1]), quarter: Number(m[2]) } : null;
}

const QUARTER_MONTHS = ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"] as const;

export function periodLabel(p: FilingPeriod): string {
  return `Q${p.quarter} ${p.year} · ${QUARTER_MONTHS[p.quarter - 1]}`;
}

/** Utah quarterly returns are due the last day of the month after the quarter. */
export function periodDueDate(p: FilingPeriod): string {
  const monthAfter = p.quarter * 3 + 1; // 1-based, may overflow into next year
  const year = monthAfter > 12 ? p.year + 1 : p.year;
  const month = monthAfter > 12 ? monthAfter - 12 : monthAfter;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function samePeriod(a: FilingPeriod, b: FilingPeriod): boolean {
  return a.year === b.year && a.quarter === b.quarter;
}

// --- did the money arrive? -------------------------------------------------

/**
 * Whether this booking actually took money, and so belongs on a return.
 *
 * `confirmed` and `completed` always did. `cancelled` is the ambiguous one: a
 * hold that expired or a checkout that was abandoned never charged anyone,
 * while a stay that was paid for and then cancelled did. Two things prove a
 * charge happened — a Stripe payment intent, and a refund, since nothing can be
 * refunded that was not first taken.
 *
 * The gap: a cash or phone booking (no payment intent) that is later cancelled
 * with no refund recorded reads as unpaid. Whatever the owner settled in cash
 * is outside the system either way, so it has to be adjusted by hand.
 */
export function wasPaid(b: ReportableBooking): boolean {
  if (b.status === "confirmed" || b.status === "completed") return true;
  if (b.status !== "cancelled") return false;
  return Boolean(b.stripe_payment_intent) || b.refund_cents > 0;
}

/**
 * The property-local date a refund reduces a return on.
 *
 * Falls back to the booking date for rows backfilled by migration 0005, where
 * the refund date was never recorded because refundBooking() only wrote prose.
 * Those refunds land in the quarter the booking was paid for, which is the one
 * place they are certain not to be *later* than they really were.
 */
export function refundDateOf(b: ReportableBooking): string {
  return propertyDateOf(b.refunded_at ?? b.created_at);
}

// --- rows ------------------------------------------------------------------

/** Flips every figure in a breakdown, so a refund subtracts. */
function negate(t: TaxBreakdown): TaxBreakdown {
  return {
    grossCents: -t.grossCents,
    taxableBaseCents: -t.taxableBaseCents,
    salesTaxCents: -t.salesTaxCents,
    stateTrtCents: -t.stateTrtCents,
    countyTrtCents: -t.countyTrtCents,
    trtTotalCents: -t.trtTotalCents,
    totalTaxCents: -t.totalTaxCents,
    rate: t.rate,
  };
}

/**
 * Every line a set of bookings puts on a return: one receipt per booking that
 * took money, plus one refund per booking that gave some back. The two can fall
 * in different periods, which is the whole point of keeping them separate.
 */
export function reportRows(bookings: readonly ReportableBooking[]): TaxReportRow[] {
  const rows: TaxReportRow[] = [];
  for (const b of bookings) {
    const { checkIn, checkOut } = parseStay(b.stay);
    const common = { id: b.id, guestName: b.guest_name, checkIn, checkOut };

    if (wasPaid(b)) {
      const date = propertyDateOf(b.created_at);
      rows.push({
        ...common,
        key: `${b.id}:receipt`,
        kind: "receipt",
        date,
        period: periodOfDate(date),
        tax: computeLodgingTax(b.total_cents),
      });
    }

    if (b.refund_cents > 0) {
      const date = refundDateOf(b);
      rows.push({
        ...common,
        key: `${b.id}:refund`,
        kind: "refund",
        date,
        period: periodOfDate(date),
        tax: negate(computeLodgingTax(b.refund_cents)),
      });
    }
  }
  return rows;
}

/** Every period with at least one line, newest first. */
export function periodsPresent(rows: readonly TaxReportRow[]): FilingPeriod[] {
  const seen = new Map<string, FilingPeriod>();
  for (const r of rows) seen.set(periodKey(r.period), r.period);
  return [...seen.values()].sort((a, b) => b.year - a.year || b.quarter - a.quarter);
}

export function rowsInPeriod(rows: readonly TaxReportRow[], p: FilingPeriod): TaxReportRow[] {
  return rows
    .filter((r) => samePeriod(r.period, p))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.guestName.localeCompare(b.guestName) ||
        a.kind.localeCompare(b.kind)
    );
}

export function summarize(rows: readonly TaxReportRow[]): PeriodTotals {
  return rows.reduce<PeriodTotals>(
    (t, r) => ({
      bookings: t.bookings + (r.kind === "receipt" ? 1 : 0),
      refunds: t.refunds + (r.kind === "refund" ? 1 : 0),
      grossReceivedCents: t.grossReceivedCents + (r.kind === "receipt" ? r.tax.grossCents : 0),
      refundedCents: t.refundedCents + (r.kind === "refund" ? -r.tax.grossCents : 0),
      grossCents: t.grossCents + r.tax.grossCents,
      taxableBaseCents: t.taxableBaseCents + r.tax.taxableBaseCents,
      salesTaxCents: t.salesTaxCents + r.tax.salesTaxCents,
      stateTrtCents: t.stateTrtCents + r.tax.stateTrtCents,
      countyTrtCents: t.countyTrtCents + r.tax.countyTrtCents,
      trtTotalCents: t.trtTotalCents + r.tax.trtTotalCents,
      totalTaxCents: t.totalTaxCents + r.tax.totalTaxCents,
    }),
    {
      bookings: 0,
      refunds: 0,
      grossReceivedCents: 0,
      refundedCents: 0,
      grossCents: 0,
      taxableBaseCents: 0,
      salesTaxCents: 0,
      stateTrtCents: 0,
      countyTrtCents: 0,
      trtTotalCents: 0,
      totalTaxCents: 0,
    }
  );
}

// --- CSV -------------------------------------------------------------------

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Cents as a bare decimal — no "$", so a spreadsheet reads it as a number. */
function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export const CSV_COLUMNS = [
  "Booking ID",
  "Type",
  "Guest",
  "Date",
  "Check-in",
  "Check-out",
  "Amount",
  "Taxable base",
  "Sales tax (6.6%)",
  "State TRT (1.07%)",
  "County TRT (4.5%)",
  "TRT subtotal",
  "Total tax",
] as const;

/**
 * The period's lines plus a TOTAL, ready to attach to a return. Refunds appear
 * as negative amounts, so the columns sum to the figures that get filed.
 */
export function toCsv(rows: readonly TaxReportRow[]): string {
  const totals = summarize(rows);
  const body = rows.map((r) =>
    [
      r.id,
      r.kind === "refund" ? "Refund" : "Receipt",
      r.guestName,
      r.date,
      r.checkIn,
      r.checkOut,
      dollars(r.tax.grossCents),
      dollars(r.tax.taxableBaseCents),
      dollars(r.tax.salesTaxCents),
      dollars(r.tax.stateTrtCents),
      dollars(r.tax.countyTrtCents),
      dollars(r.tax.trtTotalCents),
      dollars(r.tax.totalTaxCents),
    ]
      .map(csvCell)
      .join(",")
  );
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const totalLine = [
    "",
    "TOTAL",
    `${plural(totals.bookings, "booking")}, ${plural(totals.refunds, "refund")}`,
    "",
    "",
    "",
    dollars(totals.grossCents),
    dollars(totals.taxableBaseCents),
    dollars(totals.salesTaxCents),
    dollars(totals.stateTrtCents),
    dollars(totals.countyTrtCents),
    dollars(totals.trtTotalCents),
    dollars(totals.totalTaxCents),
  ]
    .map(csvCell)
    .join(",");

  return [CSV_COLUMNS.join(","), ...body, totalLine].join("\r\n") + "\r\n";
}

export function csvFilename(p: FilingPeriod): string {
  return `clover-creek-lodging-tax-${periodKey(p)}.csv`;
}
