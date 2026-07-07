# Clover Creek Guest House — Website Development Plan

A direct-booking vacation rental website for the Clover Creek Guest House in Rush Valley, Utah — an alternative to listing solely on Airbnb/VRBO/DirectStay, with booking, payment, reviews, and owner administration all in one place.

- **Domain:** clovercreekguesthouse.com
- **Email:** clovercreek@gmail.com
- **Tech stack:** Next.js (App Router) + TypeScript, hosted on Vercel; Vercel Edge Functions for backend; Supabase (Postgres, Auth, Storage, Realtime)

---

## 1. Business Rules

These rules drive the pricing engine, booking flow, and policy pages. They are the source of truth — encode them in one shared module so the calendar, checkout, and confirmation emails never disagree.

### 1.1 Pricing

| Item | Weekday (Sun–Thu) | Weekend & Holidays |
|---|---|---|
| Base price (2 guests) | $75 / night | $105 / night |
| Each additional guest (up to 6 total) | +$20 / night | +$25 / night |
| Pet fee (dogs only, max 2) | $20 / pet / day | $20 / pet / day |

- Cleaning fee and taxes are **included** in the prices above — display "taxes and cleaning included, no hidden fees" prominently (it's a selling point).
- Maximum occupancy: **6 guests**.
- A night is priced by the day it starts (e.g., Friday night = weekend rate).
- **Holidays** count as weekend pricing. Maintain an admin-editable holiday date list (seeded with US federal holidays + local ones like Pioneer Day) rather than hardcoding.

### 1.2 Pet Policy

- Dogs only — **no cats**. Max **2** pets, **50 lb limit each**. $20 per pet per day.
- Guests are responsible for pet care, safety, and all cleanup; the property assumes no responsibility.
- No fencing on the property — crate and lanyard available for guest use.
- Inside accidents or messes left in the yard incur an additional cleaning fee of **$100 or more**.
- **Skunk warning:** do not leave pets unattended outside, especially outside full daylight.
- Pets must not be left loose in the house when guests leave — unattended pets must be crated. Crate pets at night. **No pets in or on beds.**
- Booking flow must collect pet count + weights and require acknowledgment of this policy.

### 1.3 House Rules

- Check-in: generally **3 p.m. or later** unless special arrangements are made.
- Check-out: by **11 a.m.** unless later is pre-approved.
- No smoking of any kind. No parties or large gatherings. No kids standing on furniture (especially under the TV).

**At checkout:** leave used beds unmade (don't dump bedding on the floor), leave used towels in the bathtub, leave perishable food in the refrigerator (disposed of Friday, garbage day), turn off lights/heaters/fans/AC, lock the door.

Guests must accept house rules + pet policy as part of the booking flow (store timestamped acceptance with the booking).

---

## 2. Feature Set

### 2.1 Public Site (visitors, no login required)

1. **Home / listing page** — hero photos, the property description (king bed master, loft with 2 doubles, full bath, full kitchen with coffee/tea bar, laundry, climate control, patio with grill/swing/picnic table, fire pit, night sky), amenity list, pricing table, house rules, pet policy. Mostly static text for SEO.
2. **Photo gallery** — images stored in Supabase Storage (seeded from the Google Drive photos), served through Next.js `<Image>` for optimization. Lightbox viewing, ordered/captioned by admin.
3. **Availability calendar + booking** — see §2.3.
4. **Map & area** — HERE Maps + geocoding API showing the location and nearby attractions.
5. **Reviews** — display imported historical reviews (from Google Drive, **excluding Summer's**) plus new on-site reviews. "Verified stay" badge for reviewers with a completed booking.
6. **Blog** — posts about the local area and ways to use the house (stargazing, hunting/ATV trips, family reunions). MDX or DB-backed; strong SEO value.
7. **Contact / inquiry** — simple form that emails the owner and appears in the admin chat inbox, for pre-booking questions.

### 2.2 Accounts & Roles

Supabase Auth with two roles enforced by Postgres row-level security:

- **Visitor** (email magic-link or Google sign-in; only required to book, review, or chat):
  - View gallery / rental information (no login needed)
  - Book a stay: pick dates, guests, pets → pay → confirmation
  - Leave a review (auto-tagged "verified stay" when they have a completed booking)
  - Message the owner about their booking; view/cancel their bookings
- **Admin** (the owner):
  - Upload/delete/reorder gallery images
  - Edit descriptive text content only — main paragraphs, feature lists. Structural text (titles, button labels, navigation) is **not** editable. Implemented as a `site_content` table keyed by slug, rendered into otherwise-static pages.
  - Manage calendar: block/unblock dates, view/cancel bookings, add manual bookings (phone/walk-in)
  - Edit pricing values and the holiday list (so a rate change never requires a developer)
  - Moderate reviews (approve before publish, hide spam)
  - Chat with guests (see §2.5)
  - View site usage stats (see §2.6)
  - Manage blog posts

### 2.3 Booking & Calendar

Build the booking calendar **in-app** (single source of truth in Supabase) rather than embedding Calendly/Cal.com — those are appointment schedulers and handle nightly stays, per-guest pricing, and pet fees poorly. Keep everything in one place:

- `bookings` table (dates, guest count, pet details, price breakdown, status: pending → confirmed → completed / cancelled) + `blocked_dates` table.
- Availability check enforced with a Postgres exclusion constraint on the date range so double-booking is impossible even under concurrent checkouts.
- **Date-range picker** with unavailable dates greyed out; live price quote (nightly breakdown showing weekday/weekend/holiday rates, guest and pet add-ons) before payment.
- **Google Calendar sync (one-way out)**: push confirmed bookings to the owner's Google Calendar via API — she sees bookings on her phone without logging in. Simpler and more reliable than Apps Script.
- **iCal feed (`.ics`) export** and import: standard channel-sync so availability stays consistent if the house remains listed on Airbnb/VRBO/DirectStay. This is the industry-standard mechanism and prevents double-bookings across platforms.
- Booking policies to confirm with the owner and encode: minimum stay (suggest 1–2 nights), maximum stay, how far out booking opens, same-day booking cutoff, cancellation/refund policy.

### 2.4 Payments (Stripe)

- **Stripe Checkout** for the initial build — hosted payment page, minimal PCI scope, supports cards / Apple Pay / Google Pay.
- Server computes the price (never trust the client), creates a Checkout Session; a webhook confirms payment and flips the booking to confirmed. Unpaid holds expire after ~30 minutes, releasing the dates.
- Refunds for cancellations issued from the admin dashboard per the cancellation policy.
- Keep the pricing engine as one pure, unit-tested function used by the quote UI, the Checkout session, and the confirmation email.

### 2.5 Messaging (owner ↔ guest)

- In-app chat scoped to a booking/inquiry, built on **Supabase Realtime** (already in the stack — no extra service).
- Email notification (see §2.7) when either side receives a message while offline, with a link back into the app — the owner shouldn't need to keep a tab open.
- Fallback/alternative if in-app chat proves unused: a "Text/WhatsApp the host" link. Cheap to add later; start with in-app since it keeps history attached to bookings.

### 2.6 Analytics

- **PostHog (free tier)** or **Vercel Web Analytics** — both are cookieless-capable and avoid Google Analytics' consent-banner burden. PostHog recommended: page views, unique visitors, booking-funnel conversion.
- Surface a simple summary card in the admin dashboard (visits, uniques, top pages, bookings started vs. completed) via the PostHog API, so the owner never needs a second dashboard.

### 2.7 Email & Notifications

Transactional email via **Resend** (or Postmark), sent from the domain (`clovercreekguesthouse.com`) with SPF/DKIM configured, forwarding replies to clovercreek@gmail.com:

- Booking confirmation with dates, price breakdown, house rules, and check-in details
- Pre-arrival reminder (check-in time, directions, door/access info) ~2 days before
- Checkout-morning reminder with the checkout checklist
- Post-stay "leave a review" request
- New-booking, new-message, and new-review notifications to the owner
- Cancellation/refund confirmations

### 2.8 SEO & Content

- Static-first rendering (SSG/ISR) — as much crawlable text as possible, per the requirements doc.
- `schema.org/VacationRental` + `LodgingBusiness` structured data (rates, amenities, geo, reviews) for rich results.
- Per-page metadata, Open Graph images, sitemap.xml, robots.txt, canonical URLs.
- Blog for long-tail local keywords ("cabin near Rush Valley", "Tooele County getaway", stargazing, etc.).
- Register with Google Search Console + Google Business Profile.

---

## 3. Suggested Additions (not in the original spec)

Things worth including that the requirements missed:

1. **Cancellation & refund policy** — must exist before taking real money; drives the refund logic. Needs an owner decision (e.g., full refund ≥7 days out, 50% within 7 days).
2. **Rental agreement acceptance** — checkbox + timestamp stored with each booking covering house rules, pet policy, and liability (the "we assume no responsibility" language). Cheap legal protection.
3. **Damage/incident workflow** — admin can record an incident and charge an extra-fee payment link via Stripe (covers the "$100+ pet mess fee" without needing security deposits).
4. **iCal channel sync** (§2.3) — critical if the DirectStay/other listings stay live; prevents double-bookings.
5. **Legal pages** — privacy policy and terms of service (required by Stripe, analytics, and general good practice).
6. **FAQ page** — check-in logistics, directions, cell coverage, nearest grocery/gas, quiet hours; reduces repetitive questions (SEO-friendly too).
7. **Good-neighbor/local info page** — well water, septic quirks, garbage day (Friday), skunks — doubles as the digital guestbook.
8. **Spam protection** — Cloudflare Turnstile on contact/review forms, rate limiting on chat.
9. **Accessibility & mobile-first design** — most direct-booking traffic is mobile.
10. **Lodging-tax compliance check** — prices include tax, but confirm the owner's Utah transient room tax registration/remittance; keep booking exports (CSV) for her records.
11. **Backups/exports** — Supabase point-in-time recovery + admin CSV export of bookings.
12. **Photo prep** — compress/convert images (WebP/AVIF), add alt text (SEO + accessibility).

---

## 4. Data Model (Supabase / Postgres)

```
profiles         id (auth.users FK), role (admin|visitor), name, phone
site_content     slug, markdown/text, updated_at            -- admin-editable copy
gallery_images   id, storage_path, caption, sort_order
pricing_config   singleton row: weekday_base, weekend_base, extra_guest_wd,
                 extra_guest_we, pet_fee, max_guests, max_pets, min_stay
holidays         date, label
bookings         id, user_id, date_range (daterange, EXCLUDE constraint),
                 guests, pets jsonb, quote jsonb (price breakdown),
                 status, stripe_session_id, rules_accepted_at
blocked_dates    date_range, reason
reviews          id, user_id (nullable for imports), booking_id (nullable),
                 rating, body, verified boolean, approved boolean, created_at
messages         id, booking_id/inquiry_id, sender_id, body, read_at, created_at
inquiries        id, name, email, body, created_at           -- pre-booking contact
blog_posts       id, slug, title, body (MDX), published_at
```

All tables protected by row-level security: visitors see only their own bookings/messages; admin sees everything; public reads limited to approved reviews, gallery, published posts, and content.

---

## 5. Build Phases

### Phase 0 — Setup (est. a few days)
- Register domain, set up DNS on Vercel; create clovercreek@gmail.com
- Create Supabase project, Stripe account, Resend account, PostHog project, HERE API key
- Scaffold Next.js + TypeScript app; CI (lint, typecheck, tests) via GitHub Actions; deploy skeleton to Vercel

### Phase 1 — Public site (MVP content)
- Home/listing page with description, amenities, pricing table, house rules, pet policy
- Photo gallery (images migrated from Google Drive into Supabase Storage)
- HERE map, contact form, FAQ, legal pages
- SEO foundations: metadata, structured data, sitemap, analytics wired up
- **Milestone: site is live and indexable — can replace/supplement the DirectStay listing for discovery even before booking works**

### Phase 2 — Booking & payments (the core)
- Pricing engine (pure function + unit tests covering weekday/weekend/holiday boundaries, guest counts, pet fees)
- Availability calendar, date-range picker, live quote
- Supabase Auth (visitor sign-in), booking creation with rules acceptance
- Stripe Checkout + webhook confirmation; expiring holds
- Confirmation/reminder emails; Google Calendar push; iCal export/import
- Admin: calendar management, block dates, manual bookings, refunds
- **Milestone: first real paid booking end-to-end in Stripe test mode, then live**

### Phase 3 — Admin CMS & reviews
- Admin dashboard: gallery management, `site_content` editing, pricing/holiday editor
- Review submission + moderation + verified-stay tagging; import historical reviews (excluding Summer's)
- Analytics summary card in admin

### Phase 4 — Messaging & blog
- Booking-scoped chat with Realtime + email notifications
- Blog authoring and first 3–5 area posts
- Post-stay review-request automation

### Phase 5 — Polish & launch
- Accessibility pass, Lighthouse/perf tuning, mobile QA
- Search Console + Google Business Profile submission
- Owner walkthrough/training and a one-page "how to run the site" doc
- Booking CSV export, backup verification

---

## 6. Key Technical Decisions (and why)

| Decision | Choice | Rationale |
|---|---|---|
| Booking calendar | Build in-app, not Calendly/Cal.com | Appointment tools don't model nightly pricing, occupancy, or pet fees; in-app keeps one source of truth |
| Payments | Stripe Checkout | Per requirements (over Clover); hosted page = minimal compliance burden |
| External calendar | Google Calendar push + iCal feeds | Owner visibility on her phone; iCal is the standard for cross-platform availability sync |
| Chat | Supabase Realtime in-app | Already in the stack, history tied to bookings; WhatsApp link as cheap fallback |
| Analytics | PostHog free tier | Cookieless option, generous free tier, API to embed stats in admin |
| Email | Resend on own domain | Deliverability (SPF/DKIM) for booking confirmations; Gmail alone would land in spam |
| Content editing | `site_content` table, slug-scoped | Satisfies "editable paragraphs but not titles/buttons" precisely, keeps pages static-renderable via ISR |
| Maps | HERE Maps API | Per requirements; generous free tier |

---

## 7. Open Questions for the Owner

1. Cancellation/refund policy terms?
2. Minimum stay (1 night ok, or 2 on weekends/holidays)? How far in advance can guests book?
3. Which holidays get weekend pricing (federal only, or also Pioneer Day/local events)?
4. Keep the DirectStay/other listings live (→ iCal sync needed) or go direct-only?
5. Is a security deposit wanted, or is the incident-fee approach enough?
6. Utah transient room tax: registered and remitting? (Prices include tax, so remittance is on the owner.)
7. Confirm the historical reviews and photos to import from Google Drive.
