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
| 0008 | 03 bookings respect blocks | committed (Stage 03) |
| 0009 | 04 refunds as rows | committed (Stage 04) |
| 0010 | 06 booking events | allocated |
| 0011+ | 05 / 08 / 09 extras, in landing order | — |

## Stages

| # | Status | Commit | Notes |
|---|---|---|---|
| 00 | human only | — | not started (human) |
| 01 | done | `0f6edfe` | details below |
| 02 | done | `8b13228` | browser checks left for the human |
| 03 | done | `2bf6da3` | browser checks left for the human |
| 04 | done | see git log ("Learn about refunds issued outside this site, and about disputes") | event subscription + browser check left for the human |
| 07 | in progress (paused) | WIP `70b518b` on `wip/stripe-stage-07` | implemented + mutation-checked; needs review, gate, commit |
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

## Stage 03 — Blocked dates enforced at checkout

Usage at start: 5h 26%, 7d 22%. The first session stopped here when Claude Code's auto-mode
classifier stopped returning verdicts (no Bash); resumed 2026-09-30 in a new session after
restarting Docker. At commit: 5h 6% (window reset), 7d 28%.

**Landed:** `0008_bookings_respect_blocks.sql` (two triggers + shared advisory lock),
`src/lib/availability.ts` (`BLOCKED_DATES_CONFLICT = "CC001"`, `isDatesTaken()`,
`rangesOverlap()`; +12 tests incl. a drift test that scans every migration's `errcode`),
checkout pre-check, `blockDates()` → `ActionResult` with a new `BlockDatesForm` client
component, `createManualBooking()` error reporting.

**Deviations from the plan (deliberate, reviewed):** the plan predates the iCal import (0006).
- **Imported blocks (`feed_id` set) are never refused** by the `blocked_dates` trigger: one
  refusal would fail the feed's whole batch upsert, and what it refused is the cross-site double
  sale the owner most needs on record. Only manual blocks are checked against bookings.
- **The bookings trigger checks only when a row becomes active or its dates move while
  active** — never on `pending → confirmed` (the hold passed the check at insert; an imported
  block may land during the 30-minute hold) and never on a payment landing on a lapsed hold
  (`cancelled → confirmed` in the write that sets `stripe_payment_intent`, which only the webhook
  does): Stripe has the money by then, so refusing only hides it. A resold stay is still refused
  by `bookings_no_overlap`. Any other reactivation (admin `cancelled → confirmed`) is checked.
- **SQLSTATE `CC001`** (a class of the project's own; `PT…` avoided since PostgREST maps it to an
  HTTP status). The route maps it with `23P01` to the same 409, by code only.
- **Trigger messages are generic** ("Booking [a,b) overlaps blocked dates" / "Blocked dates
  [a,b) overlap an active booking"): the trigger runs before RLS `WITH CHECK` as SECURITY
  DEFINER and 0002 grants anon INSERT, so naming the row in the way would leak another booking's
  id/status. `blockDates()` looks up and names the bookings itself.
- `blockDates()` sweeps expired holds first; for a live pending hold it says the guest is paying
  now and when the hold ends (cancelling wouldn't close their Stripe session).
- `createManualBooking()` sweeps expired holds first and reports a refusal via
  `?manualError=` (the `feedError` pattern — a thrown message is redacted in production); success
  now redirects to `/admin/calendar` so a stale error doesn't linger. Still not an `ActionResult`.
- The checkout pre-check runs after the pre-checkout feed refresh, against every block.

**Verified here:**
- `npm start` production build + curl (previous session): `/api/checkout` over the seed block,
  over a block added after "page load", and over an imported block → 409, no booking row, no new
  Stripe session; adjacent dates → 200 + session.
- Real `blockDates()` (scratch vitest, admin mocked, local DB): over a confirmed booking → names
  it, blocks nothing; adjacent → done; an expired-but-unswept hold → swept, block succeeds; bad
  dates → blocked; over a live pending hold → "<name> is paying for … right now; their hold ends
  at h:mm — try again after that."
- Real `createManualBooking()`: over the seed block → redirect with the exact `manualError` text
  and no row; free dates → redirect to `/admin/calendar`, row `confirmed`.
- psql (implementer, rolled back): every trigger branch (29 cases) incl. the late-payment skip
  (`pi_x` write allowed, the same write without an intent → CC001, a resold stay → 23P01),
  imported-block upserts allowed, notes/refund updates never re-judged; both race orders
  serialise on the lock and the second raises CC001 (control run with the function STABLE let
  both commit). Anon PostgREST probe → 400 CC001 with no id/status in the message.
- `npx supabase db reset` replays 0001–0008 + seed; the seed's block and bookings coexist
  (0 active overlaps locally). Production back-check (2026-09-29, read-only): 0 overlaps.
- Gate green (226 tests).

**Left for the human** (admin UI in a browser, `npm run build && npm start`): the block form
shows a refusal inline and keeps the typed dates, clears them after a success, and greys the
button while pending; a refused manual booking shows the `manualError` line under its form;
a real stale `/book` tab gets the "just booked" message at submit (curl equivalent passed).
Re-run the overlap back-check against production right before applying 0008 (see REPORT.md).

**Open review findings (not acted on):**
- 0002's anon INSERT grants on `bookings`/`blocked_dates` stay; the CC001 message reveals only
  that the dates are busy, which the public calendar already shows.
- `setBookingStatus()` discards its update error, so a refused reactivation (CC001) vanishes
  silently. Pre-existing; the UI offers no reactivation.
- Re-running `seed.sql` by hand days after a reset can raise CC001 (BEFORE INSERT fires even for
  rows `on conflict do nothing` then skips). Dev-only; `db reset` clears it.
- An echo of our own booking re-imported from a listing site keeps its nights shut for a while
  after it's cancelled. Predates this stage; 0008 only enforces what the calendar already greys.
- The imported-block upsert takes no lock, so it can race a booking insert — the state
  deviation 1 already accepts.
- Stage 07: add the route-level "blocked range → 409, no Stripe session" test.

## Stage 04 — Dashboard refunds & disputes

Usage at start: 5h 6%, 7d 28%. At commit: 5h 68% (resets 7:50 PM), 7d 37%.

**Landed:** `0009_refunds_as_rows.sql` — `booking_refunds` (keyed on Stripe's `re_…`/`du_…`/`dp_…`
id; service-role only), backfill of one `legacy:<booking_id>` row per refunded booking, a cache
trigger keeping `bookings.refund_cents = sum` / `refunded_at = max(issued_at)`, RPCs
`record_stripe_refunds()` (webhook) and `record_admin_refund()` (`refundBooking`), both
service-role only; `bookings_refund_within_total` dropped; unique partial index on
`bookings.stripe_payment_intent`. Webhook handlers for `charge.refunded`,
`charge.dispute.created`, `charge.dispute.closed` (all through `claimEvent()`);
`src/lib/refunds.ts` (+ tests); refund lines under each booking on `/admin/calendar`; the tax
report files each `booking_refunds` row on its own date; the seed's b…02 refund is a row.

**Deviations from the plan (deliberate, reviewed):**
- **Refunds are listed from Stripe** (`refunds.list({charge})`): `charge.refunds` is not on the
  Charge object on this API version (2026-06-24.dahlia). "Fully refunded" = Stripe's current
  non-failed/non-canceled total ≥ `amount_captured`, so out-of-order events converge.
- **Admin-wins:** an admin refund's own `charge.refunded` can land before `refundBooking()`
  saves; the webhook inserts `on conflict do nothing`, `record_admin_refund()` upserts
  `source='admin'` and its note replaces the webhook's. Either order ends as one admin row.
- **Legacy rows are replaced by Stripe's list** (one transaction, under the booking lock) when a
  `charge.refunded` arrives for a pre-0009 refunded booking, so the refund isn't counted twice.
  Replacing rows at/before the legacy date are tagged `admin` (for 0005's undated rows the
  cut-off is when 0009 ran).
- **`refundBooking()`'s writes are one RPC** (refund row + cancel), so there is one failure mode.
  A booking with no payment intent now records no refund (it used to write `refund_cents` with
  no Stripe call; unreachable from the UI). A $0 outcome whose write fails is `blocked`.
- **Review M1 — the tax report reads the rows now** (the minimal part of Stage 09 §3, brought
  forward): `reportRows()` emits one refund line per `booking_refunds` row dated by its
  `issued_at` when the caller loads them (all three readers do). Without it,
  `refunded_at = max(issued_at)` put the whole sum on the latest refund's quarter — a Q3 refund
  plus a Q4 lost dispute would take the Q3 refund off the Q4 return a second time. A legacy row
  is dated exactly as `refundDateOf()` dated the cache, so no pre-existing line moves (tested).
  Stage 09 still owns the CSV `source` column, the legacy-row flag, `paid_at`,
  `amount_received_cents`.
- **Review M2 — a refund/dispute before `confirm()` lands:** when no booking has the intent,
  the webhook resolves it through the Checkout Session's `booking_id`; and `confirm()` refuses
  (`ignored`, no emails) when the booking's recorded refunds already cover `amount_total`.
  Otherwise a Dashboard refund during a failing `confirm()` retry was ignored for good, and a
  later successful retry re-confirmed a refunded guest and emailed them.
- Smaller: the note/reason use the clamped refund amount (was pre-clamp); `refundBooking` uses
  the shared `countsAsRefunded`; the money-moved text says the webhook normally records the
  refund within a minute; the calendar shows a bookings-query error instead of an empty table;
  lost disputes read "Charged back $X · date · lost dispute".

**Verified here** (`npm start` production build + `stripe listen`, sandbox account, local DB):
- `stripe refunds create` half, then the rest, on a booking paid via triggered checkout → one
  `dashboard` row, booking `confirmed`; then two rows, `refund_cents` 3000, `cancelled` "refunded
  in the Stripe dashboard"; events `handled` + linked.
- Replay: `stripe events resend` → 200 duplicate; forced `failed` + resend → the handler re-ran
  (attempts 2), still 2 rows / 3000.
- Real `refundBooking()` (scratch vitest, admin mocked) with the webhook live: full → exactly
  one `re_…` row `admin`, 22500, `cancelled`, admin note; a $100 override then a Dashboard refund
  of the rest → rows `[10000 admin, 12500 dashboard]`, `refund_cents` 22500, admin note kept.
  Re-run after the review fixes: same.
- `pm_card_createDispute` on a booking → `charge.dispute.created` `handled` + linked, booking
  stays `confirmed`; `stripe disputes close` → `du_…` row `dispute` 20000, still `confirmed`;
  replay of the close → no change. `stripe trigger charge.dispute.created` (not our charge) →
  `ignored`. Re-run after the fixes: same.
- M2 end to end: lapsed hold + dates resold → `completed` 500 (`failed`, intent never set); full
  Dashboard refund → `charge.refunded` `handled`, linked via the session, one `dashboard` row,
  booking left `cancelled`; dates freed + redelivery → `ignored` "Refunded before the payment
  was confirmed; not confirmed", booking still `cancelled`, 0 emails attempted.
- Implementer (psql/harness): cache sums/dates/duplicate/delete/move/cascade; two-session race —
  with the lock the second writer waited and wrote the correct 8000, a control without it wrote
  a stale 3000; admin-vs-webhook on one id in both orders → one admin row, no deadlock; the
  legacy swap; anon denied on the table and both RPCs; the unique intent index refuses a
  duplicate.
- Backfill: 0009 applied with `migration up --local` over existing data (incl. an undated
  0005-style refund) → every booking's `refund_cents`/`refunded_at` and the rendered tax report
  identical. `db reset` replays 0001–0009 + seed; b…02 unchanged (10500).
- Gate green (241 tests).

**Left for the human:**
- Subscribe `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed` (Stage 00
  step 3) **after** deploying this code (Stage 01: unhandled types settle `ignored` for good).
- Deploy order: apply 0009 to hosted **right before** deploying — old code with 0009 applied
  writes `refund_cents` with no row and the next recompute on that booking erases it; new code
  without 0009 gets money-moved on every admin refund and 500s on `charge.refunded`. The hosted
  0006 version mismatch must be reconciled first.
- Browser: refund lines under a booking on `/admin/calendar` (admin panel / Stripe dashboard /
  "Charged back … lost dispute"), and `/admin/taxes` + its CSV for a refunded booking.
- A real 4242 payment through Stripe's hosted page, then a Dashboard refund (CLI equivalent
  passed).

**Open review findings (not acted on):**
- A refund that fails or is cancelled *after* being recorded stays counted, and a `pending`
  refund counts toward "fully refunded"; nothing handles `charge.refund.updated`. Rare for cards.
- `refunds.list` is capped at 100 with no pagination (same as `refundBooking`).
- An open dispute is visible only as a linked `stripe_events` row until Stage 05 alerts on it
  (Stage 06 puts it on the timeline). `// Stage 05 alerts here` marks both places.
- The legacy admin cut-off compares Stripe's `created` with our server clock (label only).
- Stage 07 must cover: admin-wins in both orders, the legacy swap, the confirm-refund guard, the
  session fallback, lost/won disputes, and `reportRows` per-row refunds.

## Stage 07 — Money-path tests (paused 2026-09-30, 17:23 local)

Usage at start: 5h 69%, 7d 37%. Paused at 5h 79% (resets Wed Sep 30 7:50 PM), 7d 38%
(resets Mon Oct 5 9:00 PM) — the stage could not be reviewed and gated under the 80% line.

**On `wip/stripe-stage-07` (`70b518b`, one commit on top of `973e6df`):** `src/lib/stripe.ts`
`getStripe(key)` seam replacing the three inline `import("stripe")` + `new …(key)` blocks
(orchestrator read the diff: same dynamic import at the same point, same key, no options);
`src/lib/__fixtures__/stripe.ts` (`fakeStripe`, `signedEvent` with a real signature via
`generateTestHeaderString`) and `db.ts` (scripted DB fake); `actions.refund.test.ts` (25),
`webhooks/stripe/route.test.ts` (35), `checkout/route.test.ts` (12, incl. the tampered-quote
test asserting `unit_amount` 48500 hand-computed from `DEFAULT_PRICING`, clock pinned);
new `vitest.config.mts` (only the `@` alias). Implementer's gate: lint ✅ typecheck ✅ test ✅
313 passed + 1 todo, 18s. Not yet run by the orchestrator; build not run.

**Mutation checks (implementer, hand edits restored):** every one caught — 01 200-on-write-error,
01 claim-always-fresh, 02 throw-not-money-moved, 02 no status guard, 03 no pre-check, 03 CC001
ignored, 04 our amount not Stripe's, 04 always cancel, 04 no confirm refund guard; plus client
price trusted, no clamp, failed refunds counted, no session fallback, expired cancels any
status, no compensating cancel, no payment_status check, wrong intent, failed settled handled,
throw answered 200, dispute upsert without ignoreDuplicates, blocked-dates read error ignored.

**Findings:** `refundBooking` emails the placeholder address of a manual booking (only a falsy
`guest_email` is skipped) — that is Stage 05 item 5; the suite leaves an `it.todo` for it. The
SQL-side behaviours (admin-wins in both orders, the legacy swap) can't be exercised by a hermetic
suite; the tests assert what the TypeScript sends to those RPCs, and Stage 04's live
verification above covers the SQL. `reportRows` per-row refunds are covered in
`taxReport.test.ts` (Stage 04).
