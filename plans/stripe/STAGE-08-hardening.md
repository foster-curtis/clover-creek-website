# Stage 08 — Hardening: rate limits & fail-closed availability

**Depends on:** Stage 03 (the availability check this stage makes fail closed).

Two defects that are not bugs in the payment logic, but let someone else — or a bad
afternoon at Supabase — cause the same damage.

## Who does what

| Step | Who |
|---|---|
| Rate limiter, fail-closed availability, hold-window review | **[AGENT]** |
| Nothing | [HUMAN] |

---

## Why

**`/api/checkout` has no rate limit.** Every POST that passes validation inserts a `pending`
booking with a 30-minute hold, and the `bookings_no_overlap` exclusion constraint means each
hold blocks its dates against everyone else. A loop over next summer's dates makes the
calendar unbookable for half an hour at a time, renewable indefinitely, and creates a Stripe
Checkout Session per request while it does.

The only thing in the way is the honeypot field, which stops naïve form-fillers and nothing
that reads the JSON body. No CAPTCHA, no per-IP limit, no per-email limit, no cap on
outstanding holds.

This is cheap to exploit and needs no motive beyond a broken script. It is also the one
finding in the audit that a stranger can trigger.

**`getUnavailableRanges()` fails open.** In [src/lib/data.ts](../../src/lib/data.ts):

```ts
} catch {
  return [];
}
```

An empty array means *everything is available*. A Supabase timeout, a network blip, a bad
deploy — and the booking calendar renders every date in the next year as bookable. Stage 03
means a bad pick is rejected at submit, so the money is safe, but the guest gets a calendar
of lies and an unexplained error when they try to use it.

Fail-open is the right default for the parts of this app that degrade to placeholders. It is
the wrong default for availability, where the cost of a wrong "yes" is a stranger's
disappointment and the cost of a wrong "no" is a refreshed page.

## What to change

### 1. Rate-limit `/api/checkout`

No new infrastructure. Two limits, both enforced against the database that is already being
queried:

- **Per IP**: count `bookings` rows created in the last hour from the same IP. This needs a
  column — add `created_ip inet` in a small migration, or store it in the existing `quote`
  JSON if a migration feels disproportionate. Prefer the column; it is also useful in the
  event log. Read the IP from `x-forwarded-for` and take the **left-most** entry, noting in
  a comment that Vercel appends the client IP and that trusting the header is only safe
  because the platform rewrites it.
- **Per email**: refuse a fourth outstanding `pending` hold for the same address. A real
  guest does not hold four rooms at once.

Both return **429** with copy a real guest could plausibly hit and understand — "You have a
few holds open already; finish or cancel one before starting another." Never explain the
limit's shape.

Apply the limit **after** validation and **before** the insert, so a bot spending requests on
malformed bodies never reaches the counting query.

**Do not add a CAPTCHA.** It is a third-party account, a consent-banner question, and a
conversion cost on the one page that earns money. These two limits cover the realistic case.

### 2. Make availability fail closed

Change `getUnavailableRanges()` to distinguish "no ranges" from "could not tell":

```ts
type Availability =
  | { known: true; ranges: DateRange[] }
  | { known: false };
```

When it is `known: false`, the booking page shows the calendar in a disabled state with an
honest message — "We can't load availability right now. Please try again in a moment, or
call us." — and `SITE.phoneDisplay` beside it, since the phone line works when the database
does not.

Keep `hasSupabase() === false` returning `{ known: true, ranges: [] }`. An unconfigured site
showing an open calendar is the documented zero-environment behaviour (SEO stages, ground
rule 2) and is a different situation from a configured site that cannot reach its database.

Check every caller: `/book`, the iCal route, and anything else `grep` finds. The iCal feed in
particular must not emit an empty busy list on an error — a calendar sync that says "free"
is worse than one that fails, because Airbnb and VRBO act on it.

### 3. Re-examine the 30-minute hold

Not a defect, but the number is load-bearing in three places and set once each:
`HOLD_MINUTES` in the checkout route, `expires_at` on the Stripe session, and
`hold_expires_at` on the row. Stripe's session expiry and the DB hold expire at the *same
instant*, and `expire_stale_holds()` runs on every `/book` page load — so a guest completing
payment at minute 29:59 can have their row cancelled by another visitor's page view while
Stripe is still accepting the payment.

Stage 01 makes the consequence loud rather than silent (the update fails, Stripe retries, the
owner is alerted) but the race is still there. **Give the database hold a few minutes of
grace beyond the Stripe expiry** — the row should outlive the session that can still pay for
it, not the other way round. A single constant with a comment explaining the ordering is the
whole fix.

## Acceptance

- Fifteen rapid POSTs from one IP: the first few succeed, the rest get 429, and no Stripe
  session is created for the refused ones.
- A fourth concurrent hold on one email is refused.
- A legitimate guest booking twice in a week is never limited.
- With Supabase unreachable, `/book` shows the disabled calendar and the phone number — not
  an open calendar.
- The iCal feed errors rather than reporting everything free.
- A payment completing in the last seconds of the hold still confirms.

## Gate

```
npm run lint && npm run typecheck && npm test && npm run build
```

## Commit

```
Close two ways to break booking without touching the payment logic

/api/checkout had no rate limit, and each request holds its dates for 30
minutes against the exclusion constraint — so a loop over next summer
made the calendar unbookable, renewably, and created a Stripe session
per request. Two limits, both counted against the database already being
queried: no CAPTCHA, no new service.

getUnavailableRanges() caught everything and returned [], which reads as
"every date is free". Fail-open is right where this app degrades to
placeholders and wrong for availability, where a wrong yes costs a
stranger their plans and a wrong no costs a page refresh.

Also gives the database hold a few minutes past the Stripe session's
expiry, so the row outlives the session that can still pay for it.
```
