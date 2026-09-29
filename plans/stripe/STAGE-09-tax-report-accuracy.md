# Stage 09 — Tax report accuracy

**Depends on:** Stage 00 (the promotion-code decision), Stage 04 (refunds as rows).

The tax report's arithmetic is exact and well tested. Its **inputs** have three defects, and
each one moves a number on a filed return.

## Who does what

| Step | Who |
|---|---|
| The promotion-code decision | **[HUMAN]** — Stage 00, step 4 |
| `paid_at`, promo handling, refund source, report changes | **[AGENT]** |

---

## Why

[src/lib/taxReport.ts](../../src/lib/taxReport.ts) reconciles to the cent — `taxableBase +
totalTax === gross`, verified across every amount from $0 to $2,000. None of what follows is
a problem with that code. All three are about what it is handed.

### 1. A receipt is dated by `created_at`, which is not when it was paid

`reportRows()` dates a receipt with `propertyDateOf(b.created_at)`. `created_at` is when the
**pending** row was inserted — before the guest reached Stripe, up to 30 minutes before
payment, and possibly never followed by a payment at all.

For a booking created 23:50 on 31 March and paid 00:05 on 1 April, the receipt is filed in
Q1 and the money arrived in Q2. That is a real misstatement on two returns, and it is
exactly the kind of thing that is hard to explain later because the database has no record
of when payment happened. The file's own header commits to "a payment is filed in the
quarter it was *received*" — `created_at` is standing in for a fact nobody recorded.

### 2. Promotion codes make `total_cents` a fiction

`allow_promotion_codes: true` is set in the checkout route. A redeemed code reduces what
Stripe charges and leaves `total_cents` alone, so the report over-states receipts and the
return over-pays. No code has ever been created, so nothing is wrong yet — which is why this
is cheap to settle now and expensive to discover at filing time.

The same gap covers any case where the charge and the price differ: a manually attached
payment intent, a price corrected after payment. `refundBooking()` already treats
`intent.amount_received` as the truth and says why in a long comment. The report should
agree with it.

### 3. Refunds are read from a cache, and the legacy fallback is silently wrong

Post-Stage 04, `bookings.refund_cents` is a trigger-maintained cache over `booking_refunds`.
The report should read the rows, because only the rows carry `source` — and a `dispute` row
is not a refund in the same sense as an `admin` one, even if it reduces receipts identically.

There is also `refundDateOf()`, which falls back to `created_at` when `refunded_at` is null.
`0005`'s comment is honest about why (the date genuinely was not recorded for backfilled
rows) but the effect is that a legacy refund reduces the quarter the booking was *paid for*
rather than the quarter it was *issued in*. Those rows are finite and known. They should be
identified in the report rather than quietly absorbed.

## What to change

### 1. Record when payment actually happened

Add `paid_at timestamptz` to `bookings` in a migration, set by the webhook from the Stripe
event — use the payment intent's or charge's `created`, **not** `now()` at handling time, so
a retried webhook dates the money when the money moved.

Backfill from `created_at` for existing rows and record that it is an approximation, in the
same spirit as `0005`'s null `refunded_at`. Then:

```ts
const date = propertyDateOf(b.paid_at ?? b.created_at);
```

with a comment naming the fallback and pointing at the backfill. `wasPaid()` gains a cleaner
signal too: `paid_at` being set is a better answer than inferring from status plus payment
intent plus refund amount.

### 2. Report from what Stripe charged

Add `amount_received_cents int` to `bookings`, written by the webhook from
`session.amount_total` (or the payment intent). Then `grossReceived` comes from what was
charged, falling back to `total_cents` when it is null — manual bookings, and every row that
predates the column.

This makes the report correct **whichever way the promotion-code decision goes**, which is
why it is worth doing even if codes are switched off. If Stage 00 decided against codes, also
set `allow_promotion_codes: false` in the checkout route in this commit and delete the
warning from [STRIPE_INTEGRATION_TODO.md](../../STRIPE_INTEGRATION_TODO.md) — that file has
carried it as an open question long enough.

**The tax math does not change.** `computeLodgingTax` still backs tax out of a tax-inclusive
gross; only which gross it is handed changes. If a discount was applied, the tax owed is on
what the guest actually paid.

### 3. Read refunds from the rows

Replace the `refund_cents` read in `reportRows()` with a join over `booking_refunds`. One
report line per refund rather than one per booking — the CSV gains rows for a booking
refunded twice, which is the correct answer and which the current shape cannot express.

Surface `source` in the CSV. An accountant looking at a lost dispute should be able to see
that is what it was.

Keep the `refunded_at ?? created_at` fallback for rows with a synthesised legacy id, and
**mark those rows in the output** — a footnote on the page and a column value in the CSV.
An approximation that announces itself is defensible; one that does not is the thing
`0005` was written to stop.

### 4. Extend the tests

[src/lib/taxReport.test.ts](../../src/lib/taxReport.test.ts) is already thorough. Add:

- a booking paid in a different quarter from the one it was created in, filed by `paid_at`
- a discounted booking reported on `amount_received_cents`, not `total_cents`
- two partial refunds on one booking producing two report lines
- a `dispute`-sourced refund appearing with its source
- a legacy refund with no `refunded_at` still reported, and flagged

### 5. Say plainly what changed

`/admin/taxes` already carries a dismissible notice that it is an estimate, not a filed
return. If any figure for a **past** period moves as a result of this stage, that notice
should say so until the next filing — the owner may have already filed from the old numbers,
and a figure that changes without explanation is worse than one that is slightly wrong.

Determining whether any past figure actually moves is part of this stage: run the report over
every past period before and after and diff it.

## Acceptance

- A booking created in Q1 and paid in Q2 is filed in Q2.
- A discounted booking reports on what Stripe charged.
- Two partial refunds produce two report lines with the correct dates.
- Every existing test still passes unchanged, except those deliberately updated.
- A before/after diff of every past period is produced and reported — with an explanation
  for every line that moved.
- The CSV and the on-screen table still agree exactly, since both are built from the same
  helpers.

## Gate

```
npm run lint && npm run typecheck && npm test && npm run build
```

## Commit

```
Report tax on what was charged, dated when it was paid

The arithmetic reconciled to the cent; the inputs didn't. A receipt was
dated by created_at — when the pending row was inserted, up to 30
minutes before payment and sometimes in the previous quarter — because
nothing recorded when payment actually happened. paid_at does now,
taken from Stripe's timestamp so a retried webhook still dates the money
correctly.

Receipts come from amount_received_cents rather than total_cents, which
is what refundBooking() has always treated as the truth, and makes the
report right whichever way the promotion-code decision went.

Refunds are read from booking_refunds, so a booking refunded twice
produces two lines instead of one, and a lost dispute is visible as one.
```
