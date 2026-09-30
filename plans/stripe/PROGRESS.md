# Stripe payment path — progress log

Branch: `stripe/payment-path`, created from `working` at `e80f708`.
Standing instructions: [ORCHESTRATOR.md](ORCHESTRATOR.md).

## Preflight (2026-09-29, 22:32 local)

- Usage: 5h 20%, 7d 14% (5h resets Tue Sep 29 11:10 PM; 7d resets Mon Oct 5 9:00 PM).
- Keys: `STRIPE_SECRET_KEY` is `sk_test_…`; `NEXT_PUBLIC_SUPABASE_URL` is `http://127.0.0.1:54321`.
  No `sk_live_` anywhere in the repo or `.env.local`.
- `RESEND_API_KEY` is already commented out in `.env.local` (Stage 00 item 6 satisfied locally).
- Local stack up (`supabase_db_clover-creek-website` healthy). Nothing on port 3000; no `stripe listen`.
- Baseline gate on the untouched branch: lint ✅, typecheck ✅, test ✅ (188 tests, 10 files), build ✅.

## Decisions on record

- **Promotion codes (Stage 00 item 4 / Stage 09):** none recorded in `STRIPE_INTEGRATION_TODO.md`
  or `SETUP.md` — still open. `allow_promotion_codes` is left exactly as it is.
- **Alert address (Stage 05):** none recorded — still open. Alerts go to `OWNER_EMAIL`
  (`SITE.ownerEmail`), the plan's default; no new variable is introduced.

## Migration numbers

| Number | Stage | Status |
|---|---|---|
| 0006 | (pre-existing: iCal feeds) | — |
| 0007 | 01 `stripe_events` | committed (Stage 01) |
| 0008 | 03 bookings respect blocks | allocated |
| 0009 | 04 refunds as rows | allocated |
| 0010 | 06 booking events | allocated |
| 0011+ | 05 / 08 / 09 extras, in landing order | — |

## Stages

| # | Status | Commit | Notes |
|---|---|---|---|
| 00 | human only | — | not started (human) |
| 01 | done | see git log ("Stop the webhook reporting success over a failed write") | details below |
| 02 | not started | — | |
| 03 | not started | — | |
| 04 | not started | — | |
| 07 | not started | — | |
| 05 | not started | — | |
| 06 | not started | — | |
| 08 | not started | — | |
| 09 | not started | — | |

## Production read-only findings (2026-09-29)

- Hosted migrations: `0001`–`0005` recorded under their numbers, but **0006 is recorded as
  version `20260929212650` ("ical_feeds")**, not `0006`. `supabase migration list` will show
  a mismatch, and pushing would try to re-run `0006_ical_feeds.sql` (which fails on
  `create table ical_feeds`). The human must reconcile this (e.g. `migration repair`) before
  applying 0007+ — see REPORT.md.
- Stage 03 back-check (active bookings vs `blocked_dates` overlaps): **0 rows**.
- Shape: 7 bookings (all `cancelled`), 1 with `refund_cents > 0` (has `refunded_at`),
  1 with a payment intent; 7 blocked-date rows, all imported from 1 iCal feed.

## Stage 01 — Webhook retries & idempotency

Usage at start: 5h 25%, 7d 14%. At commit: 5h 9% (window reset 23:10), 7d 19%.

**Landed:** `0007_stripe_events.sql`, `src/lib/stripeEvents.ts` (+19 tests), webhook route
rewrite, `sendEmail` now returns a `SendOutcome` (+4 tests in `email.test.ts`).

**Deviations from the plan (deliberate, reviewed):**
- `failed` rows are reclaimable (otherwise Stripe's retry after a 500 would hit the unique key
  and get a 200); stale (>5 min) `processing` rows too. Reclaim is a compare-and-swap on
  `(status, attempts)`.
- Two extra columns: `claimed_at` (staleness clock; `received_at` never rewritten) and
  `attempts` (CAS version + delivery count).
- A delivery that finds a fresh `processing` row gets **409**, not 200, so an in-flight
  attempt that later fails still gets its retry.
- `booking_id` (FK) is written only by `settleEvent`, once the booking is known to exist;
  metadata is UUID-validated first (unknown / malformed → `ignored`, 200).
- `settleEvent(db, id, { status, error?, bookingId? })` instead of positional args.
- `confirm()` update guarded: matches only `pending`/`confirmed`, or `cancelled` with a null
  `stripe_payment_intent` (a lapsed hold). A retry can no longer revive a booking paid and then
  cancelled/refunded, or `completed` → `ignored` "Booking is <status>; not re-confirmed".
- `sendEmail` returns `sent | skipped | failed(error)` so a Resend failure reaches the event
  row's `error` (the plan assumed a throw, but `sendEmail` swallows). Needed by Stage 06 too.
- `export const maxDuration = 60` on the webhook route, so a 5-minute-old claim can only belong
  to a killed attempt.
- Behaviour change: `payment_status` other than `paid` (incl. `no_payment_required` from a
  100%-off promotion code) is `ignored` and the hold lapses.

**Verified here** (`npm start` production build + `stripe listen`, CLI `--api-key` from
`.env.local`, sandbox account; `RESEND_API_KEY` unset → email counted from the skip log):
- `stripe trigger checkout.session.completed` (no metadata) → 200, `ignored` "No booking_id".
- Real `/api/checkout` booking + trigger with `metadata[booking_id]` → `confirmed`, PI set,
  event `handled` + linked, exactly 2 email attempts.
- `stripe events resend` of that event → 200, still 1 row, attempts 1, no new emails.
- Lapsed hold + dates resold → 500, event `failed` with the exclusion-constraint reason;
  after freeing the dates, resend → reclaimed (attempts 2), `handled`, booking `confirmed`.
- `checkout.session.expired` → pending booking cancelled "checkout expired"; for a confirmed
  booking → untouched; both `handled` + linked.
- Signed local event with `payment_status: "unpaid"` → 200 `ignored`, booking stays `pending`.
- Bad signature → 400, no row.
- Email render failure (quote `{}`) → booking `confirmed`, event `handled`, reason in `error`.
- Guard: booking refunded+cancelled (sim), event forced `failed`, resend → `ignored`
  "Booking is cancelled; not re-confirmed", no emails. Lapsed hold (via `expire_stale_holds()`)
  + late payment → still `confirmed`.
- `npx supabase db reset` replays 0001–0007 + seed cleanly.
- Mutation checks: dropping `.select("id")` or `.maybeSingle()` from the CAS fails 3 tests.

**Left for the human:** the real 4242 card payment through Stripe's hosted page and a Dashboard
"Resend" (CLI equivalents above passed). Apply 0007 to hosted **before** deploying this code —
without the table every webhook 500s (Stripe retries, so it recovers once applied).

**Open review findings (not acted on):**
- `settleEvent` isn't tied to the claim's `attempts`; safe only because `maxDuration = 60` is well
  under the 5-minute claim window (true on Vercel).
- Event types without a handler are settled `ignored` for good. If `charge.refunded` /
  `charge.dispute.*` are subscribed before Stage 04's code deploys, those events are recorded
  but never re-run (payload is kept, so they can be replayed by hand). Subscribe after deploying.
- A `skipped` email (no `RESEND_API_KEY` in production) settles as a clean `handled`.
