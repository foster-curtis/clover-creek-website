# Stage 01 — Webhook retries & idempotency

**Depends on:** nothing. Run this first.

This stage fixes the worst finding in the audit: a guest can pay, and the booking can fail
to confirm, and nobody — not Stripe, not the owner, not the guest — is ever told.

## Who does what

| Step | Who |
|---|---|
| Migration, helper module, webhook rewrite, tests | **[AGENT]** |
| Nothing | [HUMAN] |

---

## Why

[src/app/api/webhooks/stripe/route.ts](../../src/app/api/webhooks/stripe/route.ts) discards
the result of the update that confirms a booking:

```ts
const { data: booking } = await db.from("bookings").update({ … }).select(…).single();
if (booking) { …emails… }
```

When that update errors or matches nothing, execution falls through to
`return NextResponse.json({ received: true })` — a **200**. Stripe reads 200 as "handled"
and never retries. The money is captured, the booking is still `pending`, no email went out,
and the only trace is the absence of one.

This is reachable today, not theoretical:

- `.single()` throws when the row is missing.
- The update can violate the `bookings_no_overlap` exclusion constraint. `expire_stale_holds()`
  runs on **every** `/book` page load ([src/lib/data.ts](../../src/lib/data.ts)), so a hold
  that ages out at minute 30 can be cancelled and its dates taken by someone else while the
  original guest is still completing payment.
- Any transient Supabase error at all.

Two related defects ride along in the same handler:

**No idempotency.** Stripe delivers at least once. A redelivery re-runs the update and sends
the guest confirmation and the owner notification a second time. Returning non-2xx (as this
stage starts doing) makes redelivery *more* likely, so the two changes have to land together
— fixing retries without idempotency would trade a silent failure for duplicate emails.

**No `payment_status` check.** The handler confirms on `checkout.session.completed` whatever
the payment actually did. Cards make that equivalent today. Two things break it: a 100%
promotion code produces `no_payment_required`, and any delayed-notification method enabled
in the Dashboard (ACH, Klarna, Cash App Pay) produces `unpaid` — the guest would get "Your
stay is confirmed" before the money existed, and `async_payment_failed` is neither
subscribed nor handled, so it would never be undone.

## What to change

### 1. Migration `supabase/migrations/0007_stripe_events.sql`

An append-only record of every event Stripe delivered, which doubles as the idempotency
gate. The primary key is Stripe's own event id, so a redelivery collides on insert — that
collision *is* the gate, which makes it atomic without a transaction or an advisory lock.

```sql
create table public.stripe_events (
  id text primary key,                 -- Stripe's evt_… id
  type text not null,
  booking_id uuid references public.bookings (id) on delete set null,
  payload jsonb not null,
  status text not null default 'processing'
    check (status in ('processing', 'handled', 'ignored', 'failed')),
  error text,
  received_at timestamptz not null default now(),
  completed_at timestamptz
);

create index stripe_events_booking_idx on public.stripe_events (booking_id, received_at desc);
create index stripe_events_type_idx on public.stripe_events (type, received_at desc);
```

- **No RLS policy granting access.** This table is service-role only; nothing in the browser
  reads it. Follow the pattern the other tables use for enabling RLS with no permissive
  policy.
- `payload` stores the verified event, which is what makes after-the-fact reconstruction
  possible. It is small and low-volume — a booking generates two or three rows.
- Retention is not this stage's problem. Add a note in the migration that a cleanup of rows
  older than a year is a later decision, so nobody assumes it is handled.

### 2. `src/lib/stripeEvents.ts`

```ts
export type Claim = { fresh: true } | { fresh: false; status: string };

/** Insert-or-lose: the primary key collision is the lock. */
export async function claimEvent(db, event): Promise<Claim>

/** Close a claimed row out. `failed` is what makes Stripe retry. */
export async function settleEvent(db, id, status, error?): Promise<void>
```

`claimEvent` inserts `{ id, type, payload, status: 'processing' }`. A `23505` unique
violation means another delivery already has it — return `{ fresh: false }` and let the
caller return 200 without doing the work again.

One case needs care: a row stuck in `processing` because the previous attempt crashed
mid-flight. Treat a `processing` row older than five minutes as reclaimable, and say in a
comment why the window exists — the alternative is an event that can never be retried.

### 3. Rewrite the handler

Shape:

```
verify signature                                  → 400 on failure (unchanged)
claimEvent()                                      → 200 "already seen" when not fresh
  switch (event.type)
    checkout.session.completed → confirm()
    checkout.session.expired   → release()
    default                    → settleEvent('ignored'), 200
settleEvent('handled') → 200
on any throw: settleEvent('failed', message) → 500 so Stripe retries
```

Specifics:

- **`confirm()` checks `session.payment_status === "paid"` first.** Anything else is
  recorded as `ignored` with the status in `error`, and does not confirm the booking. Note
  in a comment that `no_payment_required` will need a decision if promotion codes are ever
  turned on (Stage 00 item 4, Stage 09).
- **Check the update's error and row count.** Prefer `.maybeSingle()` over `.single()` so a
  missing row is a value rather than a throw, then decide deliberately: a missing
  `booking_id` is `ignored` (a dashboard test webhook lands here), but an *error* on the
  update is `failed` and a 500.
- **Emails stay best-effort and stay after the write.** If `sendBookingConfirmation` throws,
  the booking is already confirmed and the event must not be retried — the write is the part
  Stripe is retrying for. Catch around the email block, record the failure in the event row's
  `error`, and still settle as `handled`. Stage 05 turns that into an owner alert.
- **Keep the `.eq("status", "pending")` guard on the expiry path.** It is already correct:
  an expired session must never cancel a booking that has since been paid.
- **The 503 when unconfigured stays a 503.** Stripe retries it, which is right — a
  deployment that is missing its keys should not lose events.

### 4. Tests — `src/lib/stripeEvents.test.ts`

Pure-function coverage of the claim logic with a stubbed client: fresh claim, duplicate
claim, stale `processing` row reclaimed, fresh `processing` row refused. The handler itself
gets covered in Stage 07; do not build the full harness here.

## Acceptance

- A `checkout.session.completed` whose DB write fails returns **500**, and the `stripe_events`
  row reads `failed` with the reason.
- The same event delivered twice confirms once and sends one pair of emails; the second
  delivery returns 200 and writes no second row.
- A session with `payment_status: "unpaid"` leaves the booking `pending` and records
  `ignored`.
- A dashboard test webhook with an unknown `booking_id` returns 200 and records `ignored` —
  it must not 500, or Stripe will retry it for days.
- An email failure does not cause a retry: booking `confirmed`, event `handled`, reason in
  `error`.
- `npx supabase db reset` replays cleanly from `0001`.

## Verify locally

```
npx supabase db reset
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

Then the real path: a booking with `4242 4242 4242 4242`, and a redelivery from
**Stripe → Developers → Events → the event → Resend**. Check `stripe_events` in Studio after
each.

## Gate

```
npm run lint && npm run typecheck && npm test && npm run build
```

## Commit

```
Stop the webhook reporting success over a failed write

A 200 told Stripe the event was handled, so it never retried — a paid
booking could stay pending with no email and no trace. Failures now
return 500 and Stripe's own retry schedule is the recovery path.

Retries need idempotency to be safe, so both land together: stripe_events
keys on Stripe's event id and the primary-key collision is the lock. The
table doubles as the local record of what Stripe actually sent.

Also stops confirming a booking whose payment_status isn't "paid".
```
