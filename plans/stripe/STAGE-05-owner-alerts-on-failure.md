# Stage 05 — Owner alerts on silent failure

**Depends on:** Stage 01 (failures are now detected), Stage 04 (disputes exist to alert on).

Every failure in the payment path currently notifies nobody. Stage 01 made them visible to
Stripe; this stage makes the ones that need a human visible to the owner.

## Who does what

| Step | Who |
|---|---|
| Alert helper, call sites, throttling, email delivery check | **[AGENT]** |
| Deciding whether the alert address should differ from `OWNER_EMAIL` | **[HUMAN]** |

---

## Why

From the audit's notification table, the column that matters is the one that is empty:

| Event | Owner told? |
|---|---|
| Checkout session creation fails | no |
| Webhook signature rejected | no |
| Webhook handler fails (post-Stage 01: Stripe retries, then gives up) | no |
| Confirmation email fails to send | no |
| Refund recorded but write failed | only on screen, only at that moment |
| Dispute opened | only by Stripe's own mail |

Stripe retries a failing webhook for about three days and then stops. Without an alert, the
outcome is the same silence as before — just delayed. A retry schedule nobody is watching is
a slower way to lose a booking.

The refund case is different and worth stating plainly: Stage 02 puts the message on screen,
but it is on screen **once**, and only for whoever clicked. If the owner closes the tab, the
one record that money moved without being written down is gone from every surface a person
looks at. That one needs an email, with the same text.

## What to change

### 1. `notifyOwnerPaymentProblem()` in `src/lib/email.ts`

```ts
export interface PaymentProblem {
  /** Short, specific: "Refund recorded but not saved". Becomes the subject. */
  headline: string;
  /** The same prose the owner would have read on screen. */
  detail: string;
  bookingId?: string;
  /** What to do — always present. An alert with no next step is noise. */
  action: string;
  /** Stripe event id / payment intent, so the Dashboard can be searched. */
  references?: Record<string, string>;
}
```

Build it with the existing `emailLayout` helpers so it matches the other messages. Subject
should be greppable and urgent-looking — `[Clover Creek] Payment problem: <headline>` — and
`replyTo` should be `SITE.ownerEmail`, since there is no guest in this conversation.

**Use `canEmail()`** — already in `src/lib/email.ts` — before sending, so nothing tries to
mail the placeholder address.

### 2. Wire the call sites

| Where | When | Action text |
|---|---|---|
| `refundBooking()` | the money-moved branch | "Set the booking to cancelled by hand. Do not refund it again. Tell the guest yourself — no cancellation email was sent." |
| Webhook handler | a `checkout.session.completed` settles as `failed` | "A guest has paid and their booking is not confirmed. Open the booking, confirm it by hand, and check the guest got their email." |
| Webhook handler | confirmation email throws after a successful confirm | "The booking is confirmed but the guest was not emailed. Send them the details." |
| `/api/checkout` | the `catch` around session creation | "A guest could not reach the payment page. If this repeats, the Stripe key or the Stripe API may be the problem." |
| `charge.dispute.created` (Stage 04) | always | "Respond in the Stripe Dashboard before the deadline. The dates are still held — decide whether to release them." |

**Not** on signature-verification failure. That endpoint is public and takes scanner traffic;
alerting on it means alerting on the internet. It stays a `console.error`, and Stage 01's
`stripe_events` gives the real deliveries a record.

### 3. Alerting must not take down the thing it is watching

The failure paths this hooks into are already failing. An alert that throws inside a catch
block turns a recoverable failure into a crash.

- Every call is `void`-ed and wrapped; `sendEmail` already swallows its own errors, but the
  construction of the message must not throw either.
- **Never alert before completing the response.** In the webhook, the 500 that makes Stripe
  retry is the important half. Send the alert after the status is decided, and never let it
  change the status.

### 4. Throttle, or the retries become a mailbox full

Stripe retries a failing event on a backoff for ~3 days. Naïvely alerting per attempt sends
a dozen identical emails about one booking, which trains the owner to ignore them.

Key the throttle on `stripe_events.id` where there is one, and on booking id otherwise:
alert on the first failure for a key, then not again for that key. The `stripe_events` row
is the natural place to record that an alert went out — add an `alerted_at timestamptz`
column in a small migration, or reuse `error` if a separate column feels heavy. State which
in the commit.

### 5. Fix the placeholder-address send in `refundBooking()`

Unrelated to alerts but in the same file and the same breath: `refundBooking()` still guards
the guest email with `if (booking.guest_email)`, which is true for the placeholder address a
manual phone booking gets. `canEmail()` exists now and is exactly this check. Swap it, and
when it returns false, say so in the owner's cancellation notification — "this guest has no
email address; phone them" — because otherwise nobody knows the guest was never told.

## Acceptance

- Forcing the refund write to fail produces both the on-screen panel and an email carrying
  the same text and the booking id.
- A webhook whose write fails alerts **once**, not once per Stripe retry.
- An alert send that itself fails does not change the HTTP status the webhook returned.
- With `RESEND_API_KEY` unset, every alert path logs and completes — no throw.
- A manual booking with the placeholder address is refunded without attempting a guest email,
  and the owner's notification says the guest must be phoned.

## Gate

```
npm run lint && npm run typecheck && npm test && npm run build
```

## Commit

```
Tell the owner when the payment path fails

Stripe retries a failing webhook for about three days and then gives up.
Nobody was watching, so the outcome was the same silence as before, just
slower. Failures that need a person now send one email — throttled per
event, so a retry storm doesn't become a mailbox full of duplicates.

The refund money-moved case gets one too: on screen it is shown once, to
whoever clicked, and closing the tab was enough to lose the only notice
that money moved without being written down.

Signature failures deliberately don't alert — that endpoint is public and
takes scanner traffic.
```
