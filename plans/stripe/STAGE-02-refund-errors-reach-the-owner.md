# Stage 02 — Refund errors that reach the owner

**Depends on:** nothing. Independent of Stage 01; either order is fine.

The refund logic is the best-engineered code in the repository. Its error messages are
written with real care, and **in production the owner never sees a word of them.**

## Who does what

| Step | Who |
|---|---|
| `ActionResult`, action signature changes, form state wiring | **[AGENT]** |
| Nothing | [HUMAN] |

---

## Why

`refundBooking()` in [src/app/admin/actions.ts](../../src/app/admin/actions.ts) reports
every failure by throwing, and [src/app/admin/error.tsx](../../src/app/admin/error.tsx)
renders `error.message`. That works perfectly in `npm run dev`.

**Next.js redacts Server Action error messages in production builds** and replaces them with
a generic string plus a digest. The error boundary's own comment already says so — the
consequence just has not been followed through. In production the owner sees "an unexpected
error occurred" and a hex digest, for all of these:

| What actually happened | What the owner is told in production |
|---|---|
| `Stripe holds $450.00 for this booking, less than the $600.00 requested. The booking was not cancelled and no money moved.` | a digest |
| `Stripe refused the refund: <reason>. The booking was not cancelled and no money moved.` | a digest |
| `The refund of $600.00 WENT THROUGH, but saving it to the booking failed… do not refund it again.` | a digest |

The last one is the important one. It is the only message in the codebase that tells the
owner money has moved and the database does not know it — that the booking still reads
`confirmed`, its dates are still blocked, the tax report is counting a receipt that was
handed back, and **re-clicking the button would send the money a second time**. A digest
does not communicate any of that, and the obvious reaction to an unexplained error is to
try again.

This is also a failure mode that only appears in production. Nothing about dev or preview
testing will surface it.

## What to change

### 1. `src/lib/actionResult.ts`

```ts
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; severity: "blocked" | "money-moved" };

export const blocked = (message: string): ActionResult => …
export const moneyMoved = (message: string): ActionResult => …
export const done = (message?: string): ActionResult => …
```

The two severities are not decoration. `blocked` means nothing happened and retrying is
reasonable. `money-moved` means the refund succeeded and retrying would double it — the UI
has to render those differently, and the type is what forces the call site to say which.

### 2. `refundBooking()` returns instead of throwing

Change the signature to `(prev: ActionResult | null, formData: FormData) => Promise<ActionResult>`
and convert each failure:

| Current | Becomes |
|---|---|
| booking not found | `blocked(…)` |
| `STRIPE_SECRET_KEY` unset | `blocked(…)` |
| couldn't read the payment from Stripe | `blocked(…)` |
| requested more than Stripe holds | `blocked(…)` |
| Stripe refused the refund | `blocked(…)` |
| **refund succeeded, write failed** | **`moneyMoved(…)`** |
| success | `done("Refunded $X and cancelled the booking.")` |

Keep every message string exactly as written. They are good, and this stage is about
delivery, not rewording. Keep the `console.error` on the money-moved path too — the server
log is still the durable copy.

`requireAdmin()` keeps throwing. An unauthorised call is not a user-facing outcome and
should not render as a tidy red box.

### 3. `RefundControls` renders the result

[src/app/admin/calendar/RefundControls.tsx](../../src/app/admin/calendar/RefundControls.tsx)
is already a client component, so this is `useActionState`:

- Render `blocked` failures inline, in the existing `text-clay` style the override-validation
  error uses.
- Render `money-moved` failures **prominently and persistently** — a bordered panel, not a
  line of small text — and **disable both submit buttons** once one appears. The message
  says "do not refund it again"; the UI should make that hard rather than relying on the
  owner reading carefully under stress.
- Use the pending state from `useActionState` to disable the buttons during submission. The
  current code can be double-submitted while a refund is in flight, which is its own way to
  refund twice.
- Success replaces the controls with the confirmation line. The row re-renders as `cancelled`
  on revalidation anyway.

### 4. Leave the error boundary in place

`admin/error.tsx` stays exactly as it is. It is still the right backstop for genuine
unexpected errors — `requireAdmin()`, a render crash — and its comment about production
redaction is now accurate about what it is for, rather than describing a path the refund
messages travel down.

### 5. Do not convert the other actions

`saveContent`, `savePricing`, `setBookingStatus` and the rest keep throwing. They are not in
the money path, converting them is churn, and ground rule 9 is one stage, one commit. If
they should change, that is its own stage.

## Acceptance

- `npm run build && npm start`, then trigger each failure against a test-mode booking and
  read the actual message in the browser. **This must be verified against a production
  build** — a dev-server check proves nothing here, since dev is exactly where the bug is
  invisible.
- The money-moved panel disables both buttons and survives a re-render.
- Double-clicking "Cancel & refund" issues one refund.
- A booking whose refund succeeds shows the success line and flips to `cancelled`.

## Gate

```
npm run lint && npm run typecheck && npm test && npm run build
```

## Commit

```
Let the owner read why a refund failed, in production

refundBooking() reported failure by throwing, and Next.js redacts server
action messages in production builds — so the one message that says the
money moved and the database doesn't know it arrived as a hex digest.

Failures are returned as values now and rendered by the form. The
money-moved case gets its own panel and disables the buttons, because
the advice it carries is "do not refund it again" and an unexplained
error invites exactly that.
```
