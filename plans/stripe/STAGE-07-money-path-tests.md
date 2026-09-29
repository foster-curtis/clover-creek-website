# Stage 07 — Integration tests for the money paths

**Depends on:** Stages 01, 02, 03, 04 — the behaviour worth testing has to exist first.

131 tests pass. Not one of them touches a path that moves money.

## Who does what

| Step | Who |
|---|---|
| Fixtures, tests, any seam needed to make code testable | **[AGENT]** |
| Nothing | [HUMAN] |

---

## Why

The suite covers `pricing`, `cancellation`, `taxReport`, `nav` and `gallery` — all pure
functions, all well covered. Everything that talks to Stripe or the database is untested.

`refundBooking()` is the clearest case. It branches five ways after reading Stripe:

1. the Stripe read fails → refuse, nothing moved
2. the request exceeds what Stripe still holds → refuse, unless it was "in full", which
   clamps instead
3. `refunds.create` throws → refuse, nothing moved
4. the refund succeeds but the booking write fails → **money moved, database wrong**
5. everything succeeds

Branch 4 is the most consequential code in the repository and the least likely to ever run
by accident in manual testing. Branch 2's clamp-versus-refuse distinction is a deliberate
judgement — "in full" means whatever Stripe still holds, a typed number is a specific intent
and gets refused — and a refactor could invert it without any visible symptom until a real
partial refund happened.

The webhook has the same shape: `payment_status` gating, the idempotency claim, failure
returning 500, an email failure *not* returning 500. All of it is conditional logic over
external input, which is exactly what unit tests are good at, and none of it needs a network.

This stage is deliberately after 01–04 rather than before: writing tests against the current
behaviour would mean encoding the bugs.

## What to change

### 1. `src/lib/__fixtures__/stripe.ts`

A hand-written fake, not a mocking framework. The surface actually used is small:

```ts
stripe.paymentIntents.retrieve(id)
stripe.refunds.list({ payment_intent, limit })
stripe.refunds.create({ payment_intent, amount })
stripe.checkout.sessions.create({ … })
stripe.webhooks.constructEvent(payload, sig, secret)
```

Build a `fakeStripe({ intents, refunds, onCreate })` that returns exactly that shape and can
be told to throw on any call. Keeping it hand-written makes the test read as a description of
what Stripe returned, which is the thing under test.

Also provide `signedEvent(type, object)` — builds a payload and a real HMAC signature with a
known test secret — so the webhook tests exercise `constructEvent` for real rather than
stubbing it. Signature verification is security-relevant and cheap to test honestly.

### 2. A seam for the Stripe client

Both `refundBooking()` and the webhook do `await import("stripe")` and `new Stripe(key)`
inline. That is good for cold-start time and untestable without module mocking.

Add a single `getStripe()` in `src/lib/stripe.ts` that keeps the dynamic import and lazy
construction exactly as they are, and let tests substitute it. **Do not change when the
import happens or what the client is constructed with** — ground rule 1. The commit should
be able to say the runtime behaviour is byte-for-byte the same.

Same treatment for the database: the actions call `supabaseAdmin()` directly. A minimal
in-memory fake of the few `from().select().eq()` chains used is enough, and is less work than
it sounds because the query shapes are simple and repetitive.

### 3. `src/app/admin/actions.refund.test.ts`

One test per branch above, plus:

- an "in full" request against a payment with an earlier partial refund clamps to what
  remains, and does **not** throw
- a typed override exceeding what remains is refused, and `refunds.create` is never called
- a policy refund of `$0` (inside the no-refund tier) writes `refund_cents: 0`,
  `refunded_at: null`, and calls Stripe not at all
- failed and canceled refunds in `refunds.list` are excluded from the already-refunded total
- the guest email is skipped for the placeholder address and sent for a real one

Assert on **which Stripe calls were made with what arguments**, not just the return value.
The bug this catches is refunding the right amount against the wrong intent.

### 4. `src/app/api/webhooks/stripe/route.test.ts`

- a valid `completed` with `payment_status: "paid"` confirms and sends two emails
- the same event delivered twice confirms once, emails once, returns 200 both times
- `payment_status: "unpaid"` leaves the booking `pending`
- a DB error on the update returns **500**
- an email throw after a successful confirm returns **200** — the regression guard for the
  retry semantics Stage 01 established
- an unknown `booking_id` returns 200 and settles `ignored`
- a bad signature returns 400 and writes no `stripe_events` row
- `expired` cancels a `pending` booking and leaves a `confirmed` one alone

### 5. `src/app/api/checkout/route.test.ts`

- the server price is used, not the client's — post a body carrying a tampered quote and
  assert `line_items[0].price_data.unit_amount` equals the recomputed total. This is the
  single most valuable test in the stage.
- an overlapping booking returns 409 and creates no Stripe session
- a blocked range returns 409 and creates no Stripe session (Stage 03)
- a session-creation throw cancels the pending booking — the compensating write
- the honeypot returns 400 before any database work
- missing `STRIPE_SECRET_KEY` returns 503 and inserts nothing

### 6. Keep it in `npm test`

No separate command, no test database, no Docker dependency. If a test needs a live Postgres
it belongs in this stage's manual verification, not the suite — CI runs `npm test` on every
push to `stg` and `master` and it has to stay fast and hermetic.

## Acceptance

- `npm test` covers all five `refundBooking` branches and all eight webhook cases.
- Reverting any one of Stages 01–04 makes at least one test fail. Check this by actually
  reverting them locally one at a time — a test that does not fail when the bug returns is
  not protecting anything.
- The suite stays hermetic: no network, no Docker, no `.env` dependency.
- Total runtime stays under ~30s.

## Gate

```
npm run lint && npm run typecheck && npm test && npm run build
```

## Commit

```
Cover the paths that move money

131 tests passed and none of them touched Stripe or the database. The
five-way branch in refundBooking() — most importantly the one where the
refund succeeds and the write fails — was the most consequential code in
the repo and the least likely to run by accident in manual testing.

getStripe() exists only as a seam for these tests: same dynamic import,
same lazy construction, same arguments. Runtime behaviour is unchanged.

The checkout test that asserts the Stripe line item equals the
server-recomputed price is the one to keep if any of these ever become a
maintenance burden.
```
