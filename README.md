# Clover Creek Guest House

Direct-booking website for the Clover Creek Guest House, a farm-stay vacation rental in
Rush Valley, Utah. Built with Next.js + TypeScript, Supabase, Stripe, and Tailwind, hosted
on Vercel.

- **[SETUP.md](SETUP.md)** — how to connect the accounts (Supabase, Stripe, domain, email)
  and launch. Start here.
- **[DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)** — the original feature plan and
  architecture decisions.

## Features

- Availability calendar with live pricing quotes ($75 weeknights / $105 weekends &
  holidays for 2 guests, extra-guest and dog fees, cleaning & taxes included)
- Stripe Checkout payments with 30-minute date holds and database-enforced
  double-booking protection
- Guest accounts (passwordless email sign-in), booking history, and realtime chat with
  the owner
- Reviews with automatic "verified stay" badges and owner moderation
- Admin dashboard: bookings, refunds, blocked dates, manual bookings, photo gallery,
  editable site copy, pricing & holidays, review moderation, blog authoring, inquiries
- iCal feeds for the owner's Google Calendar and Airbnb/VRBO availability sync
- Booking confirmation / notification emails (Resend), SEO (structured data, sitemap),
  HERE map with OpenStreetMap fallback, optional PostHog analytics

## Development

```bash
npm install
npm run dev    # http://localhost:3000
npm test       # pricing engine tests
npm run build  # production build
```

The site runs with zero configuration (placeholder photos, booking disabled) and each
integration switches on as its environment variables are added — see
[.env.example](.env.example).
