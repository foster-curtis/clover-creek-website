# Stage 06 — Booking event log

**Depends on:** Stage 01 (`stripe_events` exists; this is its human-readable counterpart).

A booking row records what it *is*. Nothing records what happened to it.

## Who does what

| Step | Who |
|---|---|
| Migration, recording helper, call sites, admin timeline | **[AGENT]** |
| Nothing | [HUMAN] |

---

## Why

Questions the database cannot answer today about any booking:

- **When did this confirm?** `created_at` is when the *pending* row was inserted, before the
  guest ever reached Stripe. There is no `updated_at` at all.
- **Who cancelled this?** `setBookingStatus()` writes a status and nothing else — no actor,
  no timestamp, no note.
- **Did the guest get their confirmation email?** Nothing records a send.
- **Was this hold abandoned, or did the guest pay and the webhook fail?** Both end at
  `cancelled`.

`notes` is doing the job badly. Four different meanings share the column — `hold expired`,
`checkout expired`, `manual booking (phone/walk-in)`, `cancelled · 75% refund $562.50` — with
inconsistent semantics: `expire_stale_holds()` appends with ` | `, everything else
overwrites. The webhook's `checkout expired` silently destroys whatever was there.

Migration `0005` already made this argument once and won it, for money: it moved refunds out
of prose and into `refund_cents`/`refunded_at` because the tax report was regexing dollars
out of an English sentence. State transitions are the same problem, one column over.

The practical cost is that reconstructing an incident means the Stripe Dashboard's 30-day
event list plus Vercel logs that are already gone.

## What to change

### 1. Migration `supabase/migrations/0010_booking_events.sql`

```sql
create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind text not null,                  -- 'created' | 'confirmed' | 'cancelled' | …
  actor text not null                  -- 'guest' | 'owner' | 'stripe' | 'system'
    check (actor in ('guest', 'owner', 'stripe', 'system')),
  actor_id uuid,                       -- the admin's profile id, when actor = 'owner'
  detail text,                         -- prose, for a person
  data jsonb,                          -- structured, for code
  stripe_event_id text references public.stripe_events (id) on delete set null,
  at timestamptz not null default now()
);

create index booking_events_booking_idx on public.booking_events (booking_id, at);
```

- **Append-only.** No update path, no delete path. A log that can be rewritten is not a log —
  say so in the migration comment so nobody adds an "edit note" feature later.
- `kind` is deliberately not a check constraint: new kinds will be added and a migration per
  kind is friction for no safety. Keep the vocabulary in a TypeScript union in
  `src/lib/bookingEvents.ts` instead, where it is actually enforced at the call sites.
- `stripe_event_id` ties a transition to the Stripe event that caused it. That link is the
  whole point — it is what turns "cancelled at 14:02" into "cancelled at 14:02 because
  `evt_…` said the session expired".
- Service-role only, like `stripe_events`. This is an operator's table.

**Backfill what can be known honestly.** One `created` event per booking from `created_at`,
and a `cancelled` event for cancelled bookings — with `at` set to `refunded_at` where one
exists and left at `created_at` otherwise. Do **not** invent confirmation timestamps. Mark
backfilled rows in `data` (`{"backfilled": true}`) so a reader can tell a reconstruction
from a recording. `0005`'s backfill comment is the model for how to explain this.

### 2. `src/lib/bookingEvents.ts`

```ts
export type EventKind =
  | "created" | "confirmed" | "cancelled" | "completed"
  | "hold_expired" | "checkout_expired" | "refunded"
  | "email_sent" | "email_failed" | "dispute_opened" | "dispute_closed";

export async function recordEvent(db, event: NewBookingEvent): Promise<void>
```

`recordEvent` never throws. A log write failing must not fail a refund — log the failure and
carry on. Note in a comment that this is the one place in the payment path where swallowing
an error is correct, because the alternative is a logging bug that costs a booking.

### 3. Record at every transition

| Call site | Kind | Actor |
|---|---|---|
| `/api/checkout` after the insert | `created` | `guest` |
| Webhook `completed` | `confirmed` | `stripe` |
| Webhook `expired` | `checkout_expired` | `stripe` |
| `expire_stale_holds()` | `hold_expired` | `system` |
| `refundBooking()` | `refunded` | `owner` |
| `setBookingStatus()` | the new status | `owner` |
| `createManualBooking()` | `created` | `owner` |
| Each email send / failure | `email_sent` / `email_failed` | `system` |
| Stage 04 dispute handlers | `dispute_opened` / `dispute_closed` | `stripe` |

`expire_stale_holds()` is a SQL function, so its events are inserted by the same statement —
extend the function rather than calling it from TypeScript, and keep its existing `notes`
append for one release so nothing that reads the prose breaks at once.

`actor_id` comes from `currentUser()` in the admin actions. `requireAdmin()` already resolves
the user; thread it through rather than resolving twice.

### 4. Show the timeline

A booking's history belongs where the booking is. Add it to the admin booking detail view as
a plain reverse-chronological list — time, kind, actor, detail. No new page, no filtering,
no pagination. Most bookings will have four or five rows and the value is entirely in being
able to read them in one glance.

### 5. Leave `notes` alone

`notes` keeps being written exactly as it is today. It is rendered in the admin calendar, and
migrating those reads is not this stage. Once the timeline has been live for a while and is
trusted, retiring `notes` to owner-authored prose only is a separate, easy change.

## Acceptance

- A full booking — quote, pay, confirm — produces `created`, `confirmed` and `email_sent`
  events in order, with the `confirmed` row linked to its `stripe_events` id.
- An abandoned checkout produces `created` then `checkout_expired` or `hold_expired`,
  distinguishably.
- A refund produces a `refunded` event carrying the amount in `data` and the admin's
  `actor_id`.
- Deleting a booking cascades its events away; nothing is orphaned.
- A forced failure in `recordEvent` does not fail the refund that called it.
- `npx supabase db reset` replays cleanly and the seed's six bookings all have backfilled
  `created` events.

## Gate

```
npm run lint && npm run typecheck && npm test && npm run build
```

## Commit

```
Record what happens to a booking, not just what it is

A booking row had no updated_at, no actor on any transition, and four
different meanings sharing the notes column with inconsistent
append-versus-overwrite semantics. Reconstructing an incident meant the
Stripe Dashboard's 30-day window plus Vercel logs that had already
expired.

booking_events is append-only and links each transition to the Stripe
event that caused it, which is what turns "cancelled at 14:02" into
"cancelled at 14:02 because evt_… said the session expired".

Migration 0005 made this argument for money. This is the same argument
one column over.
```
