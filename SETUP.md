# Setup Guide — Clover Creek Guest House

The site is fully built and runs today with placeholder photos and booking disabled.
Each feature switches on automatically as you connect the service behind it. Work through
this list top to bottom; **steps 1–3 are the core** (site + database + payments), the rest
can happen any time after launch.

Everything you set up lands in environment variables — copy [.env.example](.env.example) to
`.env.local` for local development, and add the same variables in Vercel for production.

---

## 1. Supabase (database, sign-in, photos, chat) — ~20 minutes

**DONE**

## 2. Vercel (hosting) + domain — ~30 minutes

**DONE**

## 3. Stripe (payments) — ~30 minutes

1. Create an account at [stripe.com](https://stripe.com) and complete business verification
   (bank account for payouts).
2. **Developers → API keys**: copy the secret key → `STRIPE_SECRET_KEY`.
   Start with the **test** key (`sk_test_…`) and do a fake booking with card
   `4242 4242 4242 4242` before switching to the live key.
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://clovercreekguesthouse.com/api/webhooks/stripe`
   - Events: `checkout.session.completed` and `checkout.session.expired`
   - Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.

Once these are set, the Book page takes real reservations end to end: dates are held for
30 minutes while the guest pays, double-bookings are impossible (enforced by the database),
and confirmation emails go out on payment.

## 4. Resend (emails) — ~20 minutes

**DONE**

## 5. Content (do these in the Admin dashboard once #1 is done)

**DONE**

## 6. Calendar sync (keep other listings from double-booking)

- Set `ICAL_FEED_TOKEN` to any long random string. **DONE**
- **Owner's phone**: in Google Calendar → Settings → _Add calendar → From URL_, paste
  `https://clovercreekguesthouse.com/api/ical?key=<your token>`. Bookings appear
  automatically with guest names. **DONE**
- **Airbnb/VRBO/DirectStay**: in their calendar-sync settings, import
  `https://clovercreekguesthouse.com/api/ical` (no key — busy dates only), and export
  _their_ iCal URL. Currently their bookings must be blocked manually in Admin → Calendar
  (an automatic importer is a good next feature if the other listings stay active).

## 7. Nice-to-haves (any time)

**DONE**

## 8. Decisions the owner still needs to make

These are written into the site loosely and should be firmed up:

1. **Minimum stay** — currently 1 night; change in Admin → Pricing.
2. **Utah taxes** — prices include tax, so the owner must be registered to remit Utah
   sales + transient room tax on lodging revenue. Worth a quick check with an accountant.

---

## Local development

```bash
npm install
npm run dev    # http://localhost:3000
npm test       # pricing engine + cancellation policy unit tests
npm run build  # production build (what Vercel runs)
```
