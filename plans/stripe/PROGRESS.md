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
| 01 | done | `0f6edfe` | details below |
| 02 | done | see git log ("Let the owner read why a refund failed, in production") | browser checks left for the human |
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

## Stage 02 — Refund errors that reach the owner

Usage at start: 5h 9%, 7d 19%. At commit: 5h 26%, 7d 22%.

**Landed:** `src/lib/actionResult.ts` (+3 trivial tests); `refundBooking(prev, formData)` returns
`ActionResult` (messages byte-identical to before; `requireAdmin()` still throws);
`RefundControls` renders `blocked` inline and `money-moved` in a bordered, persistent panel that
disables both buttons. No migration.

**Deviations (deliberate, reviewed):**
- **Server-side status guard** (behaviour change): `refundBooking` returns `blocked("This booking
  is already <status> — nothing was refunded and no money moved.")` unless the booking is
  `pending`/`confirmed`, before any Stripe call. Without it a queued double-submit (or a stale
  second tab) after a partial-tier refund passes the Stripe ceiling again and sends the same
  amount a second time; "in full" would instead clamp to $0 and overwrite `refund_cents` with 0.
- `resolveRefund()` throwing (bad or oversized override — sized against Stripe, so the page's
  own check can pass) is returned as `blocked` too, instead of reaching production as a digest.
- Forms use `onSubmit` + `startTransition(() => formAction(data))`, not `action={…}`: React 19
  resets a form after an action and skips a focused number input, which (now that failures
  render inline) could blank the override box while the confirm text still named the typed
  amount — the next submit would then refund the policy amount. A `useRef` flag closes the
  same-frame double-submit gap; released when `isPending` falls.
- Success message is keyed on whether `refunds.create` actually ran ("Refunded $X and cancelled
  the booking." vs "Cancelled the booking. No refund was issued.").
- `console.warn` on the two blocked Stripe paths so they still reach the server log.

**Verified here** (scratch vitest calling the real `refundBooking` with `isAdminUser` mocked,
local DB, Stripe test mode, PaymentIntents created with `pm_card_visa`):
- policy refund → `done("Refunded $225 …")`, booking `cancelled`, `refund_cents` 22500;
  a second run ("in full") → `blocked` before Stripe; Stripe still holds exactly one refund and
  `refund_cents` is intact.
- "in full" after a $100 Dashboard-style refund → clamps, refunds $125.
- typed override of $200 when Stripe holds $125 → `blocked` "Stripe holds $125 … less than the
  $200 requested …", no Stripe write, booking still `confirmed`.
- bogus payment intent → `blocked` "Couldn't read the payment from Stripe: … no money moved."
- temporary local trigger refusing the cancel write → `money-moved` "… WENT THROUGH …", one
  refund in Stripe, booking still `confirmed`; a retry → `blocked`, still one refund.
- Gate green (214 tests).

**Left for the human** (needs the admin UI in a browser, on `npm run build && npm start`):
see REPORT.md — each message readable in production, the money-moved panel + disabled buttons,
double-click issues one refund, success flips the row to `cancelled`, the focused-override
check, and `isPending` greying the buttons.

**Open review findings (not acted on):**
- The success line will rarely be seen: the revalidated row flips to `cancelled` and unmounts
  the controls in the same commit. (The plan expects this.)
- The money-moved lock lasts only until reload/navigation; the booking still reads `confirmed`,
  so a reload re-enables the buttons. Stage 05's email is the durable notice.
- `admin/error.tsx`'s header still cites "Stripe declining a refund" as a thrown error; left
  untouched per the plan.
- A process death between `refunds.create` and the booking write could still double-refund on
  retry; closing that needs an idempotency key on `refunds.create` (a ground-rule-1 change).
- Stage 07's DB fake must return `status`; add the status-guard and resolveRefund-throws branches.
