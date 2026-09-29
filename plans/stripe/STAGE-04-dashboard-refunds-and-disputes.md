# Stage 04 — Dashboard refunds & disputes

**Depends on:** Stage 00 (events subscribed on both endpoints), Stage 01 (`stripe_events`).

The Stripe Dashboard is the natural place to refund someone, and a refund issued there never
reaches this database. So is a chargeback.

## Who does what

| Step | Who |
|---|---|
| Subscribing `charge.refunded`, `charge.dispute.*` on both endpoints | **[HUMAN]** — Stage 00, step 3 |
| Migration, handlers, backfill, admin display | **[AGENT]** |

---

## Why

**Dashboard refunds are invisible here.** The webhook subscribes to exactly two event types.
A refund issued from the Stripe Dashboard — the obvious thing to do when a guest phones —
leaves the booking `confirmed`, its dates blocked, `refund_cents` at `0`, and the lodging tax
report claiming a receipt that was handed back. The owner has no reason to suspect a
discrepancy, because from the Dashboard the refund plainly worked.

**Partial refunds overwrite each other.** `refundBooking()` writes
`refund_cents: refundCents` — an assignment, not an accumulation. The read side is already
better than the write side: it sums *every* non-failed refund Stripe holds when sizing the
next one. So the code knows partial refunds stack and the schema cannot express it. One
column cannot hold two refunds, and `bookings_refund_within_total` will reject the honest
total once it exceeds what one column was sized for.

**Disputes are unhandled entirely.** A chargeback pulls the money back and the booking
carries on reading `confirmed`.

## What to change

### 1. Migration `supabase/migrations/0009_refunds_as_rows.sql`

```sql
create table public.booking_refunds (
  id text primary key,                 -- Stripe's re_… id; makes replay idempotent
  booking_id uuid not null references public.bookings (id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  reason text,
  source text not null check (source in ('admin', 'dashboard', 'dispute')),
  issued_at timestamptz not null,      -- Stripe's created, not ours
  recorded_at timestamptz not null default now()
);

create index booking_refunds_booking_idx on public.booking_refunds (booking_id);
create index booking_refunds_issued_idx on public.booking_refunds (issued_at);
```

- **Stripe's refund id as the primary key** makes a replayed `charge.refunded` a no-op at
  the database, the same trick `stripe_events` uses.
- `issued_at` is Stripe's timestamp. It decides which return a refund reduces, and Stripe's
  clock is the one that matters — see [src/lib/taxReport.ts](../../src/lib/taxReport.ts).
- `source` is what lets the owner tell "I did this in the admin panel" from "this was a
  chargeback" a year later.

**Backfill and keep the old columns.** `bookings.refund_cents` and `refunded_at` stay, as a
derived cache of the rows, because [src/lib/taxReport.ts](../../src/lib/taxReport.ts) and
the admin dashboard read them and rewriting those is not this stage. Insert one
`booking_refunds` row per booking that currently has `refund_cents > 0`, with
`source = 'admin'` and `id` synthesised as `legacy:<booking_id>` where no Stripe id is
known. Say in the migration comment that a synthesised id is deliberately not a Stripe id so
nothing mistakes it for one.

Keep the cache honest with a trigger on `booking_refunds` that recomputes
`bookings.refund_cents = sum(amount_cents)` and `refunded_at = max(issued_at)`. Then the
existing tax report keeps working unchanged and a later stage can move it onto the rows
properly.

**`bookings_refund_within_total` has to go, or loosen.** With disputes and price corrections
in play, refunds can legitimately exceed `total_cents` — see the audit's point that
`total_cents` is what the stay was *priced* at, not what was *captured*. Replace it with a
check against nothing, and explain the removal, rather than leaving a constraint that will
reject a true fact.

### 2. `charge.refunded` handler

Through the Stage 01 `claimEvent()` gate, like everything else.

```
find the booking by payment_intent
for each refund on the charge:
  upsert booking_refunds on conflict do nothing
if the booking is still confirmed/pending and the charge is fully refunded:
  cancel it, note "refunded in the Stripe dashboard"
```

- The event carries the full `charge`, so read `charge.refunds.data` rather than assuming
  one refund per event.
- **A refund this app issued also fires this event.** That is fine and is the reason the
  primary key is Stripe's id: `refundBooking()` writes its row, the webhook arrives, the
  upsert conflicts, nothing happens twice. Verify this explicitly — it is the case most
  likely to double-count.
- A *partial* dashboard refund records the money and leaves the booking alone. The owner
  refunding half of something is not a cancellation, and guessing otherwise would free dates
  the guest still holds.
- **No guest email from this handler.** Stripe already emails its own refund receipt, and a
  second message from the site saying the same thing invites a reply to an inbox nobody
  reads. Stage 05 notifies the *owner*, which is the gap that matters.

### 3. `charge.dispute.created` and `charge.dispute.closed`

`created` records the dispute and alerts — money has left and the dates are still blocked,
which is the owner's decision to make, not the site's. Do **not** auto-cancel: contesting a
dispute while having cancelled the booking is a worse position than either alone.

`closed` records the outcome. If `status` is `lost`, the funds are gone for good: record it
as a `source: 'dispute'` row in `booking_refunds` so the tax report stops counting it as a
receipt. If `won`, record nothing and alert.

Both need `stripe_payment_intent` → booking lookup, same as above. Where the dispute is on a
charge this site does not recognise, settle the event as `ignored` — do not fail it, or
Stripe retries for days.

### 4. Show it in the admin UI

[src/app/admin/calendar/page.tsx](../../src/app/admin/calendar/page.tsx) currently shows
`notes` prose under the status. Add the refunds for the row beneath it — amount, date, and
`source` — so "was this refunded, and by whom?" is answerable without leaving the page. One
line per refund; most bookings have none.

## Acceptance

- A refund issued in the Stripe test Dashboard appears in `booking_refunds` within seconds,
  with `source: 'dashboard'`.
- A *full* dashboard refund also cancels the booking and frees the dates.
- A *partial* dashboard refund records the amount and leaves the booking confirmed.
- A refund issued through `/admin/calendar` produces **exactly one** `booking_refunds` row,
  not two, once the webhook for it arrives.
- Two successive partial refunds sum correctly in `bookings.refund_cents` and appear as two
  rows.
- `stripe trigger charge.dispute.created` records the dispute and does not cancel anything.
- The tax report's totals are unchanged for every booking that existed before the migration.

## Verify locally

```
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# book, pay with 4242…, then refund it in the test dashboard
stripe trigger charge.dispute.created
```

`4000 0000 0000 0259` is the test card that produces a dispute after a successful charge, if
a real disputed payment is wanted rather than a triggered event.

## Gate

```
npm run lint && npm run typecheck && npm test && npm run build
```

## Commit

```
Learn about refunds issued outside this site, and about disputes

The Dashboard is the obvious place to refund a guest who phones, and a
refund issued there left the booking confirmed, its dates blocked, and
the tax report counting a receipt that had been handed back.

Refunds become rows keyed on Stripe's refund id, so a dashboard refund,
an admin refund and a redelivered event all converge on one record and
partial refunds accumulate instead of overwriting. refund_cents stays as
a derived cache so the tax report keeps working untouched.

Disputes are recorded and alerted but never auto-cancel: contesting one
while having cancelled the booking is worse than either alone.
```
