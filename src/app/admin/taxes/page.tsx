import { cookies } from "next/headers";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Field";
import { PageTitle, SectionTitle } from "@/components/ui/Heading";
import { formatUSD, TAX_RATE, TAX_RATES } from "@/lib/pricing";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import {
  csvFilename,
  parsePeriodKey,
  periodDueDate,
  periodKey,
  periodLabel,
  periodsPresent,
  REPORTED_STATUSES,
  reportRows,
  rowsInPeriod,
  samePeriod,
  summarize,
  type FilingPeriod,
  type ReportableBooking,
} from "@/lib/taxReport";
import EstimateNotice, { NOTICE_COOKIE } from "./EstimateNotice";

export const dynamic = "force-dynamic";

const pct = (rate: number) => `${(rate * 100).toFixed(2).replace(/\.?0+$/, "")}%`;

/** One line of the summary. `emphasis` marks a figure that gets filed. */
function SummaryLine({
  label,
  cents,
  hint,
  emphasis,
  strong,
}: {
  label: string;
  cents: number;
  hint?: string;
  emphasis?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1.5 ${
        strong ? "border-t border-line pt-2 font-semibold text-ink" : ""
      }`}
    >
      <span className={strong ? "" : "text-ink-muted"}>
        {label}
        {hint && <span className="block text-xs text-ink-subtle">{hint}</span>}
      </span>
      <span
        className={`whitespace-nowrap tabular-nums ${
          emphasis ? "text-lg font-bold text-moss" : ""
        }`}
      >
        {formatUSD(cents / 100)}
      </span>
    </div>
  );
}

export default async function AdminTaxesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  if (!hasServiceRole()) {
    return <p className="text-ink-muted">Set SUPABASE_SERVICE_ROLE_KEY to see tax reporting.</p>;
  }

  const db = supabaseAdmin();
  const { data } = await db
    .from("bookings")
    .select(
      "id, stay, guest_name, status, total_cents, created_at, stripe_payment_intent, refund_cents, refunded_at"
    )
    .in("status", REPORTED_STATUSES)
    .order("created_at", { ascending: false });

  const rows = reportRows((data ?? []) as ReportableBooking[]);

  const periods = periodsPresent(rows);
  const requested = parsePeriodKey((await searchParams).period);

  // Read server-side so a page the owner has already dismissed the notice on
  // never flashes the tall card up before hydration collapses it.
  const noticeDismissed = (await cookies()).get(NOTICE_COOKIE)?.value === "1";
  const selected: FilingPeriod | null = requested ?? periods[0] ?? null;

  // A quarter with nothing in it is a legitimate thing to ask for — you still
  // file a zero return — so keep it in the selector rather than silently
  // snapping back to the newest period.
  const options =
    selected && !periods.some((p) => samePeriod(p, selected))
      ? [selected, ...periods].sort((a, b) => b.year - a.year || b.quarter - a.quarter)
      : periods;

  const periodRows = selected ? rowsInPeriod(rows, selected) : [];
  const totals = summarize(periodRows);

  if (!selected) {
    return (
      <div>
        <PageTitle>Taxes &amp; Revenue</PageTitle>
        <Card variant="flat" className="mt-6 p-6 text-sm text-ink-muted">
          No bookings have taken payment yet, so there is nothing to file. This page will fill in
          as bookings come through.
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageTitle>Taxes &amp; Revenue</PageTitle>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Rates are tax-inclusive: guests pay the advertised price and the {pct(TAX_RATE)} is backed
        out of it for filing. Nothing here is ever added on top of a price a guest saw.
      </p>

      {/* What this page is, and is not. Placed above the figures on purpose. */}
      <EstimateNotice
        defaultOpen={!noticeDismissed}
        title="An estimate to plan with — not a filed return"
        summary="Estimate only — verify the amounts before filing."
      >
        <p className="mt-2 text-ink-muted">
          This site works these figures out itself, from Utah&apos;s{" "}
          {pct(TAX_RATES.salesTax)} state sales tax on accommodations plus the transient room tax —{" "}
          {pct(TAX_RATES.stateTrt)} state and {pct(TAX_RATES.countyTrt)} Tooele County. They are
          not an official assessment, and nobody has checked them against your registration.
        </p>
        <p className="mt-2 text-ink-muted">
          <strong className="text-ink">Nothing here has been withheld or paid to anyone.</strong>{" "}
          Every dollar a guest paid, tax included, landed in your account — so the tax shown is
          money still to set aside and remit yourself. The point of the page is that the bill is
          never a surprise.
        </p>
        <p className="mt-2 text-ink-muted">
          Have your accountant, or the Utah State Tax Commission, confirm the rates and the amounts
          before you file anything. Rates change, and your registration may put you on different
          ones or on a different filing schedule. These two lodging taxes are all this page covers —
          income tax and everything else sit outside it.
        </p>
      </EstimateNotice>

      {/* Period selector */}
      <Card variant="flat" className="mt-6 p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="Filing period" htmlFor="period" className="w-64">
            <Select id="period" name="period" defaultValue={periodKey(selected)}>
              {options.map((p) => (
                <option key={periodKey(p)} value={periodKey(p)}>
                  {periodLabel(p)}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" size="sm">
            Show period
          </Button>
          <a
            href={`/api/admin/taxes?period=${periodKey(selected)}`}
            download={csvFilename(selected)}
            className="text-sm text-moss underline"
          >
            Download CSV
          </a>
        </form>
        <p className="mt-2 text-xs text-ink-subtle">
          A booking counts in the quarter it was <strong>paid</strong>, and a refund in the quarter
          it was <strong>issued</strong> — not the quarter of the stay. Pending holds are never
          counted. Utah&apos;s return for this quarter is due {periodDueDate(selected)}.
        </p>
      </Card>

      {/* Summary */}
      <SectionTitle className="mt-8">{periodLabel(selected)}</SectionTitle>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <Card variant="flat" className="p-5 text-sm">
          <h3 className="font-bold text-ink">Receipts</h3>
          <div className="mt-2">
            <SummaryLine
              label="Gross received"
              cents={totals.grossReceivedCents}
              hint={`${totals.bookings} booking${
                totals.bookings === 1 ? "" : "s"
              } paid for this quarter, tax included`}
            />
            <SummaryLine
              label="Less refunds issued"
              cents={-totals.refundedCents}
              hint={
                totals.refunds === 0
                  ? "No refunds were issued this quarter"
                  : `${totals.refunds} refund${totals.refunds === 1 ? "" : "s"} issued this quarter`
              }
            />
            <SummaryLine
              label="Net received"
              cents={totals.grossCents}
              strong
            />
            <SummaryLine
              label="Taxable base"
              cents={totals.taxableBaseCents}
              hint="Net received, less tax — the receipt to report"
            />
            <SummaryLine label="Total tax" cents={totals.totalTaxCents} strong />
          </div>
        </Card>

        <div className="grid gap-4">
          {/* The two figures go on different returns, so they get different cards. */}
          <Card variant="flat" className="border-l-4 border-l-moss p-5 text-sm">
            <h3 className="font-bold text-ink">Sales tax return</h3>
            <p className="text-xs text-ink-subtle">Utah sales tax on accommodations</p>
            <div className="mt-2">
              <SummaryLine
                label={`Sales tax (${pct(TAX_RATES.salesTax)})`}
                cents={totals.salesTaxCents}
                emphasis
              />
            </div>
          </Card>

          <Card variant="flat" className="border-l-4 border-l-hay p-5 text-sm">
            <h3 className="font-bold text-ink">Transient room tax return</h3>
            <p className="text-xs text-ink-subtle">Filed separately from sales tax</p>
            <div className="mt-2">
              <SummaryLine
                label={`State TRT (${pct(TAX_RATES.stateTrt)})`}
                cents={totals.stateTrtCents}
              />
              <SummaryLine
                label={`Tooele County TRT (${pct(TAX_RATES.countyTrt)})`}
                cents={totals.countyTrtCents}
              />
              <SummaryLine label="TRT subtotal" cents={totals.trtTotalCents} emphasis strong />
            </div>
          </Card>
        </div>
      </div>

      {/* The basis these figures are on. */}
      <Card variant="flat" className="mt-6 border-l-4 border-l-clay p-5 text-sm">
        <h3 className="font-bold text-ink">Basis: net of refunds, in the quarter refunded</h3>
        <p className="mt-1 text-ink-muted">
          A refund returns a share of the total <em>including</em> that total&apos;s tax, so it has
          to come back off a return. It comes off{" "}
          <strong>the quarter the refund was issued</strong>, not the quarter the booking was paid
          for — so a return you have already filed stays correct as filed, and you never have to
          amend one. A quarter that refunds more than it takes in will show a credit.
        </p>
        {totals.grossCents < 0 && (
          <p className="mt-2 font-semibold text-clay">
            This quarter refunded more than it received, so the figures above are negative — a
            credit to carry against what you owe.
          </p>
        )}
        <p className="mt-2 text-ink-subtle">
          A booking that was paid for and then cancelled still counts here: the money arrived, and
          whatever was not refunded is taxable. Bookings cancelled without ever taking payment —
          expired holds, abandoned checkouts — are excluded entirely. The one case the report
          cannot see is a cash or phone booking settled outside Stripe and then cancelled; adjust
          that by hand.
        </p>
      </Card>

      {/* Per-line detail, so the summary is auditable. */}
      <SectionTitle className="mt-10">Lines in this period</SectionTitle>
      <Card variant="flat" className="mt-3 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Guest</th>
              <th className="px-3 py-2">Stay</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Taxable base</th>
              <th className="px-3 py-2 text-right">Sales tax</th>
              <th className="px-3 py-2 text-right">State TRT</th>
              <th className="px-3 py-2 text-right">County TRT</th>
              <th className="px-3 py-2 text-right">TRT subtotal</th>
              <th className="px-3 py-2 text-right">Total tax</th>
            </tr>
          </thead>
          <tbody>
            {periodRows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-ink-subtle">
                  Nothing was received or refunded in this period.
                </td>
              </tr>
            )}
            {periodRows.map((r) => {
              const refund = r.kind === "refund";
              return (
                <tr
                  key={r.key}
                  className={`border-t border-line ${refund ? "text-clay" : ""}`}
                >
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.date}
                    {refund && (
                      <span className="block text-xs font-semibold uppercase">Refund</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.guestName}</td>
                  <td
                    className={`whitespace-nowrap px-3 py-2 ${refund ? "" : "text-ink-muted"}`}
                  >
                    {r.checkIn} → {r.checkOut}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatUSD(r.tax.grossCents / 100)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatUSD(r.tax.taxableBaseCents / 100)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatUSD(r.tax.salesTaxCents / 100)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      refund ? "" : "text-ink-muted"
                    }`}
                  >
                    {formatUSD(r.tax.stateTrtCents / 100)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      refund ? "" : "text-ink-muted"
                    }`}
                  >
                    {formatUSD(r.tax.countyTrtCents / 100)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatUSD(r.tax.trtTotalCents / 100)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatUSD(r.tax.totalTaxCents / 100)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {periodRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-line-strong bg-surface-sunken font-semibold">
                <td className="px-3 py-2" colSpan={3}>
                  Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatUSD(totals.grossCents / 100)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatUSD(totals.taxableBaseCents / 100)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatUSD(totals.salesTaxCents / 100)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatUSD(totals.stateTrtCents / 100)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatUSD(totals.countyTrtCents / 100)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatUSD(totals.trtTotalCents / 100)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatUSD(totals.totalTaxCents / 100)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </div>
  );
}
