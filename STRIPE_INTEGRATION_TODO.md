# Stripe Integration — Remaining Setup

This file is the single source of truth for what is left to do after the Checkout Studio
parameters were applied to the existing Checkout Session call.

**Scenario A** was detected: the site already had a working Checkout Session call at
[src/app/api/checkout/route.ts](src/app/api/checkout/route.ts#L99). Only the parameters
inside that call were changed. No new files, routes, or infrastructure were added.

---

## Values to Replace

**None.** Every `sample_only` parameter (`mode`, `success_url`, `cancel_url`, `line_items`)
already held a real, non-placeholder value, so all four were preserved as-is:

| Field | Existing value kept | Why it was not replaced |
|-------|--------------------|--------------------------|
| mode | `payment` | A nightly stay is a one-time charge, not recurring billing. |
| success_url | `${origin}/book/success?session_id={CHECKOUT_SESSION_ID}` | Real page at [src/app/book/success/page.tsx](src/app/book/success/page.tsx); already keeps the `{CHECKOUT_SESSION_ID}` template. |
| cancel_url | `${origin}/book` | Real booking page. |
| line_items | Dynamic `price_data` built from `quote.totalCents` | Prices are computed server-side per stay, so there is no fixed Stripe Price ID to substitute. |

---

## Configured Parameters

These were configured in Checkout Studio and are now set in the code.

**Files containing these parameters:**
- [src/app/api/checkout/route.ts](src/app/api/checkout/route.ts#L99)

| Parameter | Value |
|-----------|-------|
| ui_mode | `hosted_page` |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` — **deliberately overridden**, see below |
| allow_promotion_codes | `true` |
| submit_type | `auto` |
| saved_payment_method_options | **deliberately omitted**, see below |
| integration_identifier | `hosted_web_0001` |
| origin_context | `web` |

### Notes on three parameters

- **`ui_mode: "hosted_page"`** — correct for the installed SDK. `stripe@22.3.2` is at or above
  21.0.0, which is the cutoff where `hosted` became `hosted_page`. If you ever downgrade the SDK
  below 21.0.0, change this back to `hosted`.
- **`payment_method_collection: "always"` was deliberately omitted.** This parameter only applies
  when `mode` is `"subscription"`. This session is `mode: "payment"`, so including it would be
  rejected by the API. If the site ever sells a recurring product, add it there.
- **`saved_payment_method_options` was deliberately omitted.** **Decided: we do not save payment
  information.** Setting `payment_method_save` either way requires a Customer on the session — the
  API rejects the parameter on a customerless one — and this call passes only `customer_email`, so
  no Customer is ever created. With nowhere to save a card, not offering to is already the
  behaviour, and passing `"disabled"` to say so only buys a rejected call. If the owner ever wants
  guests to save cards, that needs `customer` or `customer_creation` on the session first, and
  then this parameter. `customer_email` only prefills the email field and addresses the receipt.

---

## Parameters kept although absent from the Checkout Studio config

Three existing parameters are not part of the Checkout Studio field set. They were **kept**
rather than removed, because each one is load-bearing for booking fulfillment and removing
them would silently break the site. Please confirm you want them kept.

| Parameter | Why removing it would break things |
|-----------|-----------------------------------|
| `metadata: { booking_id }` | The webhook at [src/app/api/webhooks/stripe/route.ts](src/app/api/webhooks/stripe/route.ts#L36) reads `session.metadata.booking_id` to flip the booking to `confirmed` and send the confirmation email. Without it, guests would pay and never get a booking. |
| `expires_at` | Pins the Stripe session to the same 30-minute hold as the DB row. Without it Stripe defaults to 24 hours, so the `checkout.session.expired` handler would not free abandoned dates until the next day. |
| `customer_email` | Prefills the email the guest already typed, and keeps the Stripe receipt address matching the booking record. |

---

## Blocking setup steps before going live

1. **Verify the promotion codes decision.** `allow_promotion_codes: true` adds a discount box to
   checkout. Any code redeemed there reduces the Stripe charge but **not** `total_cents` in the
   bookings table, so payouts and booking records would disagree. Create codes in
   Dashboard → Products → Coupons, or set this to `false` if you do not plan to use them.
   Note this also skews the tax figures below, which are derived from the booking total.

---

## Tax: handled in this codebase, not by Stripe Tax

**Decision made.** `automatic_tax` is `enabled: false`. Stripe does not calculate, add, or record
any tax. Lodging tax is instead backed out of the tax-inclusive total by
[src/lib/pricing.ts](src/lib/pricing.ts) so the owner has a per-booking figure for filing.

An earlier draft of this file claimed `pricing.ts` already computed tax. It did not — `quoteStay`
returned `lodgingSubtotal + petFee` and nothing else, and the site's "taxes included" copy was a
pricing posture with no tax identified anywhere. That gap is what `computeLodgingTax` now closes.

**Rates** (`TAX_RATES` in [src/lib/pricing.ts](src/lib/pricing.ts)), per the Utah State Tax
Commission:

| Component | Rate | Return |
|-----------|------|--------|
| Utah statewide sales tax on accommodations | 6.60% | Sales tax |
| Utah state transient room tax | 1.07% | TRT |
| Tooele County transient room tax | 4.50% | TRT |
| Municipal TRT (none applies in Rush Valley) | 0.00% | — |
| **Combined** | **12.17%** | |

**How it works.** `computeLodgingTax(grossCents)` divides the gross by 1.1217 to get the taxable
base and treats the remainder as tax, then splits that into the sales tax, state TRT and county
TRT shares. Sales tax and TRT are filed on separate returns, so the result also carries
`trtTotalCents` (state + county) as a standalone figure.

Rounding is arranged so everything reconciles exactly: `taxableBase + totalTax === gross`, and the
three components sum to `totalTax` with no cent lost. Verified across every amount from $0 to
$2,000 in the test suite. The guest pays the same total and the owner receives the same amount;
only the bookkeeping changes.

On a $150 stay: $133.73 base, $8.83 sales tax, $1.43 state TRT, $6.01 county TRT — $7.44 TRT
subtotal, $16.27 tax in total.

The breakdown is stored on `quote.tax`, which the checkout route already persists to the
`bookings.quote` JSON column — **no schema migration needed**. `computeLodgingTax` also works
standalone on any gross amount, so bookings taken before this change can be reported on by
passing their `total_cents` straight from the row.

**Confirmed with the Utah State Tax Commission:** pet fees are part of the taxable accommodation
charge, so tax applies to the full stay total rather than the lodging line alone.

Registration and filing remain manual: this produces the numbers, it does not file the return.

---

## Environment variables

Already correct — no changes needed. This is a **Next.js** project (not Vite), so server-only
secrets carry no public prefix and are never exposed to the browser.

| Variable | Where | Status |
|----------|-------|--------|
| `STRIPE_SECRET_KEY` | Server only, no prefix | Declared in [.env.example](.env.example); fill in `.env.local` and Vercel |
| `STRIPE_WEBHOOK_SECRET` | Server only, no prefix | Declared in [.env.example](.env.example); fill in `.env.local` and Vercel |
| `NEXT_PUBLIC_SITE_URL` | Browser-visible, `NEXT_PUBLIC_` prefix | Already set |

No publishable key is needed: hosted Checkout redirects the browser to Stripe, so no Stripe.js
runs on the site. The Stripe client is constructed with no API version argument, so it uses the
version pinned to your account.

Until `STRIPE_SECRET_KEY` is set, the route returns a 503 with a "booking isn't live yet" message
rather than erroring — that guard is at [route.ts:49](src/app/api/checkout/route.ts#L49).

---

## How the flow works

1. Guest submits the form in [src/components/BookingWidget.tsx](src/components/BookingWidget.tsx).
2. `POST /api/checkout` revalidates dates and **recomputes the price server-side** — the client
   quote is display-only.
3. A `pending` booking row is inserted. A Postgres exclusion constraint hard-blocks
   double-booking; an overlap returns 409.
4. A Checkout Session is created with a 30-minute expiry and `booking_id` in metadata, and the
   session id is saved to the booking row.
5. The browser is redirected to the Stripe-hosted page.
6. On `checkout.session.completed` the webhook confirms the booking and sends the guest
   confirmation plus the owner notification. On `checkout.session.expired` it releases the dates.
7. If session creation throws, the pending booking is cancelled so the dates free up immediately.

## Webhook

Already implemented at [src/app/api/webhooks/stripe/route.ts](src/app/api/webhooks/stripe/route.ts)
with signature verification. Point the endpoint at `https://<site>/api/webhooks/stripe` and
subscribe to `checkout.session.completed` and `checkout.session.expired`.

## Testing

Use test keys (`sk_test_...`) first. Test cards — any future expiry, any CVC, any postal code:

| Number | Result |
|--------|--------|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |
| `4000 0000 0000 9995` | Declined (insufficient funds) |
| `4000 0000 0000 0002` | Declined (generic) |

Forward webhooks locally with `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
and use the `whsec_...` it prints as your local `STRIPE_WEBHOOK_SECRET`.

Worth testing end to end: a successful booking, an abandoned checkout (confirm the dates free up
after 30 minutes), and two overlapping bookings at once (confirm the second gets the 409).

## Next steps

- Build the `/admin/taxes` reporting page so the owner can read the figures off at filing time,
  grouped by filing period, with sales tax and the TRT subtotal shown separately.
- Register for the Utah sales tax and transient room tax accounts if not already done — this
  computes the numbers but does not file the returns.
- Decide how refunds affect the tax report: `refundFor` in
  [src/lib/cancellation.ts](src/lib/cancellation.ts) returns a percentage of the total including
  its tax portion, so a refunded booking over-reports tax if the period was already filed.
- Decide on promotion codes.
- Consider recording `stripe_payment_intent` refunds against the cancellation policy in
  [src/lib/cancellation.ts](src/lib/cancellation.ts) — refunds are currently manual in the Dashboard.

## Resources

- https://docs.stripe.com/mcp
- https://support.stripe.com
