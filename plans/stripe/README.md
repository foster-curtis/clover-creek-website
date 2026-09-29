# Stripe Payment Path — Implementation Stages

Executable breakdown of the payments audit (2026-09-29). The audit said *what is wrong*;
these files say *what to change, in what order, and who does it*.

Scope is the money path and nothing else: `POST /api/checkout` → Stripe hosted Checkout →
`POST /api/webhooks/stripe` → `refundBooking()`, plus the tables, emails and tests that
path depends on.

Each stage is a self-contained unit of work: one agent runs it, one reviewer reviews it,
one commit lands it. **Every stage leaves the site fully functional and deployable**, and
every stage leaves the payment path no worse than it found it — no stage depends on a
later stage to take money correctly.

## Stage order

| # | Stage | Depends on | Who runs it | Est. |
|---|---|---|---|---|
| 00 | [Console prerequisites & environment verification](STAGE-00-console-prerequisites.md) | — | **Human only** — no code | ~1.5 hr |
| 01 | [Webhook retries & idempotency](STAGE-01-webhook-retries-and-idempotency.md) | — | Agent only | ~3 hr |
| 02 | [Refund errors that reach the owner](STAGE-02-refund-errors-reach-the-owner.md) | — | Agent only | ~2 hr |
| 03 | [Blocked dates enforced at checkout](STAGE-03-blocked-dates-at-checkout.md) | — | Agent only | ~2.5 hr |
| 04 | [Dashboard refunds & disputes](STAGE-04-dashboard-refunds-and-disputes.md) | 00, 01 | Agent + 1 human step | ~3.5 hr |
| 05 | [Owner alerts on silent failure](STAGE-05-owner-alerts-on-failure.md) | 01, 04 | Agent only | ~2 hr |
| 06 | [Booking event log](STAGE-06-booking-event-log.md) | 01 | Agent only | ~3 hr |
| 07 | [Integration tests for the money paths](STAGE-07-money-path-tests.md) | 01, 02, 03, 04 | Agent only | ~4 hr |
| 08 | [Hardening: rate limits & fail-closed availability](STAGE-08-hardening.md) | 03 | Agent only | ~2.5 hr |
| 09 | [Tax report accuracy](STAGE-09-tax-report-accuracy.md) | 00, 04 | Agent + owner decision | ~2.5 hr |

**Stages 01, 02 and 03 are the ones that fix money-correctness bugs reachable today.** They
have no dependencies on each other and none on Stage 00 — run them first, in any order, and
ship each one on its own. Everything from 04 onward is about being able to answer *"what
happened to this booking?"* six months later without opening the Stripe Dashboard.

```
00   human track — runs in parallel; blocks 04 and 09 only

01 ─┬─> 04 ─> 05
    ├─> 06
    └─> 07 <── 02, 03
03 ─> 08
04 ─> 09
```

## Who does what

The same split the SEO stages use, and every stage file opens with its own **Who does what**
table:

- **[AGENT]** — changes inside this repository: files, code, migrations, tests.
- **[HUMAN]** — the Stripe Dashboard, the Vercel project's environment variables, the
  Supabase dashboard, and any decision about how the business behaves (promotion codes,
  what counts as an alert worth sending).
  **An agent must never attempt these, invent their inputs, or mark them done.**

Stage 00 is entirely human. Stages 01, 02, 03, 05, 06, 07 and 08 are entirely agent.
Stages 04 and 09 are agent work with one named human step.

## Ground rules for every stage

These apply to all code stages. Re-read them before starting one.

1. **Never make money move as a side effect of a refactor.** If a change alters which
   Stripe calls fire, in what order, or with what amount, that *is* the change — say so in
   the commit message and test it. A stage that claims to be "just plumbing" must not touch
   the arguments to `stripe.refunds.create` or `stripe.checkout.sessions.create`.
2. **A failure the owner cannot see is worse than a failure that throws.** Every `catch`
   added in these stages ends in one of three places: a non-2xx returned to Stripe so it
   retries, a message returned to the admin UI, or an owner alert. Never a bare
   `console.error` followed by a success response. The audit's worst single finding was a
   `200` returned over a failed write.
3. **Stripe is the source of truth for money; the database is the source of truth for the
   booking.** When they disagree, read Stripe and write the database — never the reverse,
   and never size a refund from `total_cents` when a payment intent exists. `refundBooking()`
   already gets this right; keep it that way.
4. **Webhook handlers are idempotent from Stage 01 onward.** Stripe guarantees at-least-once
   delivery. Any handler added after Stage 01 goes through the `stripe_events` gate — no
   exceptions, including handlers that "only send an email".
5. **Migrations are numbered by hand** and never edited once pushed — see
   [docs/LOCAL_DEV.md](../../docs/LOCAL_DEV.md#migrations). These stages expect `0007`
   through `0010` to be free. If another branch has taken a number, renumber and update the
   stage file rather than reusing it.
6. **Test keys only, in every environment an agent can reach.** An agent must never be in a
   position to issue a live refund. Where a stage needs a real Stripe call to verify, it
   runs against `sk_test_` with `stripe listen` forwarding.
7. **Match the existing house style.** Server components by default, `"use client"` only
   where interactivity demands it, comment density like the surrounding files — brief, and
   explaining *why* rather than *what*. [src/app/admin/actions.ts](../../src/app/admin/actions.ts)
   and [src/lib/taxReport.ts](../../src/lib/taxReport.ts) are the models.
8. **Gate before you finish.** Every stage ends with:
   ```
   npm run lint && npm run typecheck && npm test && npm run build
   ```
   All four must pass. Report honestly if one does not. **Do not run `npm run build` while
   `npm run dev` is running** — on Windows it corrupts `.next` and produces phantom 500s.
9. **One stage, one commit.** Each stage file ends with its commit message.

## Conventions these stages introduce

New shared modules and tables, created once and reused. If a later stage needs one that does
not exist yet, its prerequisite stage has not been run.

| Module / table | Created in | Purpose |
|---|---|---|
| `public.stripe_events` | 01 | Idempotency gate, and the local record of every event Stripe delivered |
| `src/lib/stripeEvents.ts` | 01 | `claimEvent()` — the claim-or-skip helper every handler calls first |
| `src/lib/actionResult.ts` | 02 | `ActionResult` — admin actions return failure instead of throwing it |
| `public.booking_refunds` | 04 | One row per refund, so partial refunds accumulate instead of overwriting |
| `notifyOwnerPaymentProblem()` | 05 | The alert channel for everything ground rule 2 describes |
| `public.booking_events` | 06 | Append-only status transitions: what changed, when, and who did it |
| `src/lib/__fixtures__/stripe.ts` | 07 | The mocked Stripe client the money-path tests are built on |

## Deliberately out of scope

- **Saving cards / creating Stripe Customers.** Decided against in
  [STRIPE_INTEGRATION_TODO.md](../../STRIPE_INTEGRATION_TODO.md) — guests are one-off
  bookers. Nothing here should put a `customer` on the Checkout Session.
- **Stripe Tax.** `automatic_tax` stays `false`. Lodging tax is backed out of a
  tax-inclusive total in [src/lib/pricing.ts](../../src/lib/pricing.ts) and that decision is
  settled. Stage 09 fixes *reporting* accuracy, not the tax model.
- **Deposits, split payments or payment plans.** One charge per stay.
- **Replacing hosted Checkout with embedded elements.** Hosted Checkout is why no Stripe.js
  runs on the site and no publishable key is needed. Keep it.
- **A job queue or dead-letter infrastructure.** Stripe's own retry schedule is the retry
  mechanism (Stage 01), and Resend's dashboard is the email log. Adding a runtime to this
  project is a separate decision, not a stage.
- **A hosted error tracker (Sentry and friends).** Worth doing, needs an account and a
  budget line, and it is a Stage 00-shaped decision the owner has not made. Stage 05 routes
  the alerts that actually matter through email instead, which needs nothing new.
- **Anything about the guest messaging thread.** It shares `src/lib/email.ts` but not the
  money path. Leave it alone.
