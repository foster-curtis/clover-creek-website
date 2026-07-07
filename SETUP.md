# Setup Guide — Clover Creek Guest House

The site is fully built and runs today with placeholder photos and booking disabled.
Each feature switches on automatically as you connect the service behind it. Work through
this list top to bottom; **steps 1–3 are the core** (site + database + payments), the rest
can happen any time after launch.

Everything you set up lands in environment variables — copy [.env.example](.env.example) to
`.env.local` for local development, and add the same variables in Vercel for production.

---

## 1. Supabase (database, sign-in, photos, chat) — ~20 minutes

1. Create a free project at [supabase.com](https://supabase.com) (pick a US region).
2. In the dashboard, open **SQL Editor**, paste the entire contents of
   [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql), and run it.
   This creates every table, security policy, the photo storage bucket, and seeds your
   pricing ($75/$105, +$20/$25, $20 pet fee).
3. **Project Settings → API**: copy these into your env vars:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret — server only)
4. **Make yourself admin**: sign in once on the site (email link), then run in SQL Editor:
   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'clovercreek@gmail.com');
   ```
   (Use whichever email the owner signs in with.) The **Admin** link then appears in the
   site header.
5. **Auth settings** (Authentication → URL Configuration): set Site URL to
   `https://clovercreekguesthouse.com` and add `https://clovercreekguesthouse.com/auth/callback`
   (plus `http://localhost:3000/auth/callback` for dev) to the redirect allow-list.

## 2. Vercel (hosting) + domain — ~30 minutes

1. Push this repo to GitHub, then import it at [vercel.com](https://vercel.com) (defaults are fine).
2. Add all environment variables from `.env.example` in **Settings → Environment Variables**.
3. Buy/transfer `clovercreekguesthouse.com` (Vercel can sell it to you directly, or use any
   registrar and point DNS at Vercel per their instructions).
4. Set `NEXT_PUBLIC_SITE_URL=https://clovercreekguesthouse.com`.

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

1. Create a free account at [resend.com](https://resend.com) → API key → `RESEND_API_KEY`.
2. Add and verify the domain `clovercreekguesthouse.com` (they give you 3 DNS records to add).
3. Set `EMAIL_FROM=Clover Creek Guest House <stay@clovercreekguesthouse.com>`.

Without this, bookings still work — the site just logs emails instead of sending them.

## 5. Content (do these in the Admin dashboard once #1 is done)

- **Admin → Gallery**: upload the house photos from Google Drive. Order them; photo #1 is
  the home-page hero. Add short captions and alt text.
- **Admin → Reviews**: import the old reviews from Google Drive (leaving out Summer's).
- **Admin → Site Content**: adjust the description, amenity list, area paragraph, and the
  arrival notes that go in confirmation emails.
- **Admin → Pricing & Holidays**: rates are pre-seeded; add local holiday dates you want
  weekend-priced (Pioneer Day 2026/27 is pre-seeded).
- **Admin → Blog**: write 2–3 short posts (stargazing in Rush Valley, Pony Express Trail,
  "planning a family reunion at the house") — these do a lot for Google ranking.
- Update the exact property coordinates in [src/lib/site.ts](src/lib/site.ts) (the
  `location` block — currently set to the town center of Rush Valley).

## 6. Calendar sync (keep other listings from double-booking)

- Set `ICAL_FEED_TOKEN` to any long random string.
- **Owner's phone**: in Google Calendar → Settings → *Add calendar → From URL*, paste
  `https://clovercreekguesthouse.com/api/ical?key=<your token>`. Bookings appear
  automatically with guest names.
- **Airbnb/VRBO/DirectStay**: in their calendar-sync settings, import
  `https://clovercreekguesthouse.com/api/ical` (no key — busy dates only), and export
  *their* iCal URL. Currently their bookings must be blocked manually in Admin → Calendar
  (an automatic importer is a good next feature if the other listings stay active).

## 7. Nice-to-haves (any time)

| Service | Env var | What it adds |
|---|---|---|
| [HERE Maps](https://platform.here.com) (free tier) | `NEXT_PUBLIC_HERE_API_KEY` | Interactive HERE map (site shows OpenStreetMap until then) |
| [PostHog](https://posthog.com) (free tier) | `NEXT_PUBLIC_POSTHOG_KEY` | Visits, unique visitors, booking funnel — linked from the admin dashboard |
| [Google Search Console](https://search.google.com/search-console) | — | Submit `https://clovercreekguesthouse.com/sitemap.xml` after launch |
| Google Business Profile | — | Show up on Google Maps searches |

## 8. Decisions the owner still needs to make

These are written into the site loosely and should be firmed up:

1. **Cancellation policy** — currently the site says "contact us"; refunds are issued
   manually from Admin → Calendar (one click, via Stripe). Decide real terms and update
   [src/app/terms/page.tsx](src/app/terms/page.tsx) and the FAQ.
2. **Minimum stay** — currently 1 night; change in Admin → Pricing.
3. **Utah taxes** — prices include tax, so the owner must be registered to remit Utah
   sales + transient room tax on lodging revenue. Worth a quick check with an accountant.
4. **Wi-Fi/cell answer for the FAQ** — see the placeholder in
   [src/app/faq/page.tsx](src/app/faq/page.tsx).

---

## Local development

```bash
npm install
npm run dev    # http://localhost:3000
npm test       # pricing engine unit tests
npm run build  # production build (what Vercel runs)
```

## How things fit together

- **Pricing engine** — [src/lib/pricing.ts](src/lib/pricing.ts), one pure function used by
  the live quote, the checkout API, and emails. Unit-tested in
  [src/lib/pricing.test.ts](src/lib/pricing.test.ts).
- **Double-booking protection** — a Postgres exclusion constraint on the bookings table;
  even two simultaneous checkouts can't overlap. Pending bookings hold dates for 30
  minutes, then auto-release if payment doesn't complete.
- **Roles** — `profiles.role` is `admin` or `visitor`; every table is protected by
  row-level security, and admin server actions re-verify the role on each call.
- **Graceful degradation** — every integration is optional; missing keys turn features
  off with friendly messages instead of breaking the site.
