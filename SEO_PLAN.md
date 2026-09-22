# SEO & AI Search Plan — Clover Creek Guest House

**Prepared:** September 4, 2026
**Site:** https://www.clovercreekguesthouse.com
**Goal:** Make the direct-booking site the first result travelers find — in Google, and in
ChatGPT / Perplexity / Gemini / Claude — so bookings shift off Airbnb/VRBO and their fees.

This plan is built on (a) a live audit of the deployed site and its source, and (b) research
into what actually works in search and AI answer engines as of mid-2026. Every finding below
was verified either in the codebase or against the live site — nothing here is assumed.
Sources are listed at the end.

**Contents**

1. [Executive summary](#1-executive-summary) · 2. [Current-state audit](#2-current-state-audit) ·
3. [Research foundation](#3-research-foundation--what-actually-works-in-2026) ·
4. [Keyword strategy](#4-keyword-strategy) · 5. [Competitor evaluation](#5-competitor-evaluation) ·
6. [Local SEO](#6-local-seo) · 7. [Meta information](#7-meta-information--titles-and-descriptions) ·
8. [Structured data](#8-structured-data-schema-plan) · 9. [Images and alt text](#9-images-and-alt-text) ·
10. [Internal linking](#10-internal-linking-structure) · 11. [Backlinks](#11-backlinks-and-citations) ·
12. [AI search / GEO](#12-ai-search-optimisation-geo-concretely) · 13. [Technical SEO](#13-technical-seo) ·
14. [Measurement](#14-measurement) · 15. [Roadmap](#15-phased-roadmap) ·
16. [The short version](#16-the-short-version) · 17. [Sources](#17-sources)

---

## 1. Executive summary

The site is technically well built. Next.js 15 with server rendering, clean URLs, a real
sitemap, a sensible `robots.txt`, thirteen genuinely useful local blog posts, nineteen real
guest reviews, and fast static-ish pages. That is a much stronger starting position than most
independent rentals ever reach.

But it is close to invisible, and the reasons are specific and fixable:

1. **No canonical tags anywhere.** Verified in the live `<head>`. The site answers on both
   `clovercreekguesthouse.com` and `www.clovercreekguesthouse.com`, and nothing tells Google
   which one is the real page.
2. **The site does not rank for its own brand name.** A search for
   `"Clover Creek Guest House" Rush Valley Utah` returns a Yelp aggregator page, a Booking.com
   listing for a *competitor* (Royal Creek Ranches), campgrounds, and a historic-preservation
   page — but not this site. That is an entity-recognition failure, not a content failure.
3. **All fifteen gallery photos share one alt text:** `"Clover Creek Guest House"`. The
   `alt` column in Supabase is empty for every row, so `getGallery()` falls back to the site
   name. Fifteen photos of bedrooms, kitchen, fire pit and valley are contributing nothing.
4. **Structured data exists on exactly one page**, and the type chosen (`VacationRental`)
   cannot produce a rich result without a Google Hotel Center partnership the property does
   not have. Meanwhile `/reviews` (19 reviews), `/faq`, `/house-rules`, and all 13 blog posts
   carry no schema at all. *(Update 2026-09-08: the home page now emits a valid
   `Organization` + `LodgingBusiness` + `VacationRental` `@graph` via `src/lib/schema.ts`,
   §8. The other pages still carry no schema, and the entity blocks are not yet site-wide.)*
5. **No `og:image`.** Every share on Facebook, iMessage, Pinterest, Reddit or a Slack channel
   renders as a bare text link. `twitter:card` is `summary`, not `summary_large_image`.
6. **No About page.** For E-E-A-T and for AI entity resolution, the "who is behind this" page
   is one of the highest-leverage pages a small lodging site can have, and it does not exist.
7. **The blog posts average ~340 words and contain zero images.** They are well-targeted and
   genuinely local — the raw material is good — but they are half-built.

None of this requires a rewrite. The highest-impact fixes are three days of work.

### The strategic reality to accept up front

Two research findings should shape expectations:

- **Google Business Profile is probably not available.** Google's business eligibility
  guidelines require someone who serves customers in person during business hours. Individual
  vacation rentals without on-site staff are generally not eligible, and profiles created
  anyway get suspended. The realistic local-SEO path is *not* GBP — it is entity building
  across many third-party sources plus a strong on-site location footprint. This plan takes
  that path. (Section 6 covers the one legitimate Google route: Google Vacation Rentals free
  booking links.)
- **AI answer engines cite OTAs, not host sites.** A 2025 Cloudbeds study of 810 prompts found
  OTAs account for ~55% of AI travel citations; TripAdvisor dominates Perplexity (~95%),
  Booking.com dominates ChatGPT (~54%). And a 2026 vacation-rental study found that when a
  user names your brand you get cited ~97% of the time, but for unbranded intent queries
  ("where should we stay near the Bonneville Salt Flats?") citation rates collapse to 10–15%.

  **The implication is the whole strategy in one line:** you win AI search by being described
  consistently *everywhere else* — Airbnb, VRBO, TripAdvisor, Yelp, BringFido, tourism sites,
  local blogs — with the same name, same facts, same distinctive hooks, all pointing back to
  the direct site. On-site work makes you citable; off-site work makes you *found*.

---

## 2. Current-state audit

Verified against the live site and the repository on September 4, 2026.

### 2.1 What is already right

| Item | Status |
|---|---|
| HTTPS, HTTP/2, Vercel edge hosting | Good |
| Server-rendered HTML (content in raw source, crawlable) | Good |
| Clean, readable URLs (`/blog/onaqui-wild-horses-rush-valley`) | Good |
| `robots.txt` allows `/`, blocks `/admin`, `/account`, `/api` | Good |
| `sitemap.xml` auto-generated, includes all 13 blog posts | Good |
| Unique `<title>` and `<meta description>` per page | Good |
| Single `<h1>` per page | Good |
| `metadataBase` set, title template applied | Good |
| Next.js `<Image>` with `sizes` and `priority` on the hero | Good |
| 13 locally-focused blog posts already published | Good — best asset on the site |
| 19 real guest reviews with verified-stay badges | Good — second-best asset |
| Mobile-responsive, `lang="en"` | Good |

### 2.2 Defects found

| # | Finding | Where | Severity |
|---|---|---|---|
| A1 | No `<link rel="canonical">` on any page | Live `<head>`; nothing sets `alternates.canonical` in `src/` | **Critical** |
| A2 | www / non-www both resolve, no declared canonical host | `DEFAULT_SITE_URL` in `src/lib/site.ts` is non-www; the deployed `NEXT_PUBLIC_SITE_URL` is www | **Critical** |
| A3 | All 15 gallery images share alt `"Clover Creek Guest House"` | Supabase `gallery_images.alt` is null; fallback in `src/lib/data.ts` | **Critical** |
| A4 | No `og:image` / `twitter:image`; `twitter:card` is `summary` | `src/app/layout.tsx` | **High** |
| A5 | `VacationRental` schema cannot earn a rich result without Hotel Center access — *2026-09-08: `LodgingBusiness` + `Organization` added alongside it in a `@graph`; `VacationRental` kept and its markup made valid (see §8)* | `src/lib/schema.ts`, `src/app/page.tsx` | **High** → partial |
| A6 | `aggregateRating` on own site is a self-serving review under Google policy — *retained deliberately for machine readability per §8.1; still will not render stars* | `src/lib/schema.ts` | **High** → accepted |
| A7 | No schema on `/reviews`, `/faq`, `/house-rules`, `/gallery`, `/blog`, `/blog/[slug]` — *still open; `/` now covered (§8.3)* | all pages | **High** |
| A8 | No About page (no owner name, no photo, no story, no author byline) | site-wide | **High** |
| A9 | Blog posts ~340 words, zero in-body images — *2026-09-10: the authoring blocker is removed (§13.4); the writing and photography are still outstanding* | 13 posts | **High** |
| A10 | FAQ answers live inside collapsed `<details>`; questions are `<summary>`, not headings | `src/app/faq/page.tsx` | **Medium** |
| A11 | No breadcrumbs (visible or schema) | site-wide | **Medium** |
| A12 | Image filenames are `1787611312870-3B79EF1A-….JPG` | Supabase Storage `gallery/` | **Medium** |
| A13 | `/login`, `/book/success`, `/auth/callback` are crawlable with no `noindex` | those routes | **Medium** |
| A14 | Sitemap has no `lastModified` on static pages | `src/app/sitemap.ts` | **Low** |
| A15 | `/reviews` is `force-dynamic` — no cache on a page you want indexed and fast | `src/app/reviews/page.tsx` | **Low** |
| A16 | No `/about`, `/directions`, or nearby-attraction hub pages in navigation | `NAV_LINKS` in `src/lib/site.ts` | **Medium** |

---

## 3. Research foundation — what actually works in 2026

Rather than assume, here is what the current evidence says, and what each finding means for
this specific site.

### 3.1 Traditional search has changed shape

- **Core Web Vitals are a confirmed ranking signal, weighted more heavily since the March 2026
  core update** — but they act as a tie-breaker between comparably relevant pages, not as an
  override for content quality. Thresholds: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1. INP is the
  most commonly failed metric (~43% of sites).
  → *For us:* the site is already fast. Don't over-invest here; verify and hold.

- **Google deprecated FAQ rich results on May 7, 2026.** The SERP feature is gone; the
  `FAQPage` schema type is not deprecated and causes no harm.
  → *For us:* still add `FAQPage` — not for stars in the SERP, but because AI engines parse
  Q&A pairs well and it costs nothing. Just don't expect a visual payoff.

- **Review snippets: Google removed `LocalBusiness` and `Organization` from review-snippet
  eligibility.** Reviews an entity collects about *itself* are "self-serving" and ineligible.
  → *For us:* the homepage `aggregateRating` will never render stars. Keep it for machine
  readability, but stop treating it as a rich-result play (Section 8 explains the handling).

- **Thin, near-duplicate location pages get suppressed, not penalized.** The 2026 guidance is
  consistent: if two city pages are 90% identical, only one will ever surface.
  → *For us:* build *few, deep* location pages, each genuinely different and each linked from
  real navigation. Do not spin up "Vacation rental near {every town in Tooele County}".

- **E-E-A-T's first "E" — Experience — was amplified by the March 2026 core update.** Named
  authors with real bios, About pages with real names, photos and addresses, first-hand detail
  and original photography now outrank comprehensive-but-impersonal content.
  → *For us:* the single biggest content lever available, and it is free. The owner has
  first-hand experience of the valley that no aggregator can fake.

### 3.2 AI answer engines (GEO / AEO)

- **Google says structured data is not required for AI Overviews or AI Mode**, and explicitly
  says it does not use `llms.txt`. A May 2026 study found adding JSON-LD did not measurably
  increase AI citations for pages already visible in AI Overviews. Separately, 68% of pages
  cited in AI Overviews *do* carry structured data — correlation, not proven causation.
  → *For us:* add schema because it helps Google resolve entities and because other engines
  (Bing/Copilot, Perplexity) parse it. **Do not build an `llms.txt`** — it is cargo cult.

- **What measurably lifts AI citation rates**, per the published GEO research: statistics with
  a clear source (+25.9%), direct quotes (+27.8%), explicit citations (+24.9%), and fluent,
  readable prose. Plus 40–60 word direct-answer blocks placed near the top of a page.
  → *For us:* every page should answer its core question in the first 60 words, in plain
  sentences, with specific numbers — distances, drive times, prices, capacities.

- **Anything behind a login, paywall, or interactive element is invisible to AI crawlers.**
  → *For us:* the FAQ page `<details>` elements are the concern (A10). The text *is* in the raw
  HTML so it is crawlable, but collapsed-by-default content is a known weak spot. Make the
  answers plain, visible prose with proper headings.

- **Entity consistency is the core GEO mechanic.** AI engines cite brands they can resolve
  confidently: same name, same address format, same descriptive facts across every source.
  → *For us:* this is defect #2 from the summary and the most valuable item on this list. See
  Sections 6 and 11.

- **Overlap between top-10 Google results and AI citations has fallen sharply.** Ranking well
  no longer guarantees being quoted; the two need separate work.

### 3.3 The travel-specific finding that matters most

Repeating it because it drives the budget allocation:

> Branded query → cited ~97% of the time. Unbranded intent query → cited 10–15% of the time.
> OTAs supply roughly 55% of all AI travel citations.

**Therefore:** roughly 60% of effort should go to off-site presence and entity consistency
(Sections 6 and 11), 40% to on-site work (Sections 5, 7–10). The on-site work is a
prerequisite — an AI engine that follows a citation to a thin page will not cite you twice —
but it is not sufficient on its own.

---

## 4. Keyword strategy

### 4.1 A caveat worth stating plainly

Every keyword below is qualitative, assigned by intent, competition, and fit. **No search
volume figures are included, because I have no access to volume data and inventing numbers
would be worse than omitting them.** Rush Valley (population ~500) sits in genuinely tiny
volume territory; most of these terms will show "0–10/mo" or "no data" in any keyword tool,
which is *not* a reason to skip them. In hyper-local lodging, ten searches a month from someone
who wants a farmhouse near the Onaqui herd beats ten thousand generic impressions.

Validate volumes in **Google Search Console's Performance report** — real queries this site
already receives impressions for — before touching Keyword Planner. GSC is free, accurate, and
specific to this property.

### 4.2 Keyword map — one primary target per page

| Page | Primary keyword | Secondary keywords | Intent |
|---|---|---|---|
| `/` | Rush Valley Utah vacation rental | farmhouse stay Utah, farm stay Rush Valley, guest house Rush Valley UT | Transactional |
| `/` (secondary) | dog friendly cabin near Tooele Utah | pet friendly vacation rental Tooele County | Transactional |
| `/book` | book Rush Valley Utah farmhouse direct | Clover Creek Guest House availability | Transactional |
| `/gallery` | Rush Valley farmhouse rental photos | Clover Creek Guest House photos | Navigational |
| `/reviews` | Clover Creek Guest House reviews | Rush Valley guest house reviews | Consideration |
| `/faq` | Rush Valley vacation rental check in, pets, wifi | — | Informational |
| `/house-rules` | dog friendly rental Utah pet policy | vacation rental pet rules Utah | Informational |
| `/about` *(new)* | Clover Creek Guest House owners Rush Valley | farm stay hosts Tooele County | Trust / entity |
| `/directions` *(new)* | how to get to Rush Valley from Salt Lake City | drive time SLC to Rush Valley Utah | Informational |
| `/stargazing` *(new)* | dark sky stargazing near Salt Lake City | where to stargaze Tooele County Utah | Informational — high value |
| `/blog/onaqui-wild-horses-rush-valley` | Onaqui wild horses where to see | Onaqui herd viewing Utah, wild horses near Salt Lake City | Informational |
| `/blog/bonneville-salt-flats-guide` | Bonneville Salt Flats where to stay | salt flats day trip from Salt Lake City | Informational |
| `/blog/pony-express-trail-guide` | Pony Express Trail Utah drive | Pony Express National Historic Trail Utah guide | Informational |
| `/blog/tooele-county-rodeos` | Tooele County rodeo schedule | Utah small town rodeo summer | Seasonal |
| `/blog/hunting-near-rush-valley` | hunting near Rush Valley Utah | west desert hunting units lodging | Seasonal — high intent |

### 4.3 The four keyword clusters, ranked by opportunity

**Cluster 1 — Hyper-local lodging.** *Highest conversion, lowest volume.*
`rush valley utah vacation rental`, `guest house rush valley ut`, `farmhouse rental tooele
county`, `places to stay near dugway utah`, `vacation rental near vernon utah`.
Winnable outright. The only competition is OTA category pages, and those are thin. **Own these
first.**

**Cluster 2 — Attribute + region.** *The real volume.*
`dog friendly cabin utah`, `pet friendly farmhouse near salt lake city`, `farm stay utah`,
`dark sky rental utah`, `stargazing airbnb near salt lake city`, `quiet getaway near salt lake
city`, `rental with fire pit utah`.
Harder — Airbnb, VRBO, Hipcamp and Glamping Hub category pages rank here — but the property
genuinely qualifies on every attribute. Win with depth (a real `/stargazing` page beats an
Airbnb filter page), not keyword density.

**Cluster 3 — Attraction-adjacent, "where to stay near X".**
`where to stay near bonneville salt flats`, `lodging near onaqui wild horses`, `stay near pony
express trail utah`, `hotels near dugway proving ground`, `where to stay tooele county rodeo`.
**The strongest AI-search cluster.** These are exactly the intent-shaped questions people ask
ChatGPT, and the blog already targets nine of them. They need depth, images, and a
direct-answer paragraph up top.

**Cluster 4 — Branded / defensive.**
`clover creek guest house`, `clover creek guest house rush valley`, `clover creek guesthouse
utah`.
Currently *losing* — the site does not surface for its own name. Fix via canonical tags,
`Organization` schema with `sameAs`, and consistent NAP citations. **The fastest available
win.**

### 4.4 Seasonal calendar

| Season | Push | Content to publish or refresh |
|---|---|---|
| Jan–Feb | Quiet-season stays, dark winter skies | Winter stargazing; "cheapest months to visit Utah's west desert" |
| Mar–May | Wild horse foaling, spring rodeo | Refresh Onaqui and rodeo posts |
| Jun–Aug | Salt flats, Pony Express drives, family trips | Salt Flats guide; SLC day trips |
| Sep–Oct | **Hunting season — highest intent of the year** | Hunting post expansion; west desert unit guide |
| Nov–Dec | Holiday quiet getaways | Holiday pricing; "unplugged Christmas" |

Hunting deserves special mention: `hunting near rush valley utah` attracts searchers who need
multi-night lodging, book early, and rarely price-shop. It is the most undervalued term in the
entire set.

---

## 5. Competitor evaluation

### 5.1 Who you are actually competing against

The competitive set is not "other farmhouses." Verified SERPs for the target queries return
four distinct competitor types, and each needs a different response.

| # | Competitor type | Who shows up | Their strength | Their weakness | Your play |
|---|---|---|---|---|---|
| 1 | **OTA category pages** | Vrbo `/vacation-rentals/usa/utah/rush-valley`, Airbnb `/tooele-county-ut/stays/pet-friendly`, Expedia, Travelocity | Enormous domain authority; own nearly every head term | Zero local knowledge; templated; no Onaqui herd, no Pony Express, no dark skies | Cannot outrank them on head terms. **Beat them on the long tail they cannot template.** |
| 2 | **Niche vertical directories** | BringFido (Tooele + Grantsville), Hipcamp, Glamping Hub, TheDyrt, Yelp | Rank for attribute queries (`pet friendly Tooele`) | Aggregators — they need listings | **Do not fight these. Join them.** Each is a citation and a backlink. See Section 11. |
| 3 | **Direct local competitors** | **Royal Creek Ranches** (Rush Valley, 17-bedroom lodge/retreat centre, listed on Booking.com); Stansbury Park dark-sky rental; Grantsville horse-property Airbnb | Actually in the valley; Royal Creek has Booking.com distribution | Royal Creek serves a *different* market (large groups, retreats) | **Complement, don't compete.** You already have a blog post about them — turn it into a real relationship (Section 11). |
| 4 | **Chain hotels** | Holiday Inn Express Tooele, Comfort Inn & Suites Tooele | Brand trust; capture "hotel Tooele" | Generic; pet fees; no experience | Position explicitly against them: "the alternative to a highway hotel room." |

### 5.2 What the competitive picture tells you

**Royal Creek Ranches is the sharpest signal in the whole audit.** They appear on Booking.com
for a Rush Valley query. Your site does not appear for its *own name*. They are a neighbour,
not a rival — a 17-bedroom retreat centre and a 6-guest farmhouse serve opposite ends of the
market. Overflow guests from a full retreat weekend are natural referrals in both directions.

**No competitor owns the informational layer.** Nobody has written the definitive "where to
stay near the Onaqui wild horses" or "Pony Express Trail from the Rush Valley end" page. The
blog already stakes claims on nine such topics. Deepening those thirteen posts is a cheaper
and more defensible win than trying to outrank Airbnb.

**Dark skies are being claimed by others.** A Stansbury Park rental markets a "dark sky
community"; Under Canvas holds DarkSky certification in southern Utah; East Zion Resort sells
stargazer cabins. This property has *genuinely* darker skies than Stansbury Park (which is
inside the Salt Lake light dome) — but it has no page saying so. **`/stargazing` is the single
highest-value new page on this plan.**

### 5.3 Competitor monitoring, quarterly

1. Search each Cluster 1 and 3 term in an incognito window; log the top 10.
2. Ask the same question of ChatGPT, Perplexity, Gemini and Claude; log who gets cited.
   (Unbranded prompts only — branded prompts always return you and prove nothing.)
3. Check whether Royal Creek Ranches, the Tooele chain hotels, or new Airbnb listings have
   added a direct-booking site.
4. Track your own listing positions on BringFido, Hipcamp, and Vrbo category pages.

Thirty minutes a quarter. Log it in a spreadsheet; the trend matters more than any snapshot.

---

## 6. Local SEO

### 6.1 The Google Business Profile question — read this before creating one

Standard advice says "create a Google Business Profile." **For an individual vacation rental,
that advice is probably wrong.** Google's business eligibility guidelines require someone who
serves customers in person during business hours at the listed address. Rental properties
without on-site staff are generally not eligible; profiles created anyway are commonly
suspended, and a suspension is harder to unwind than never having filed.

There is also a privacy dimension: a GBP requires a verified street address, and this is a
working farm and a family residence. Publishing the exact address invites drop-ins. *(As of
2026-09-08 the owner has chosen to publish the street address in the site's schema — see 6.2.
That is a separate decision from whether to file a GBP; the GBP recommendation below stands.)*

**Recommendation:** do not create a standard GBP for the guest house.

**Two legitimate alternatives:**

1. **Google Vacation Rentals free booking links.** This is Google's actual product for
   short-term rentals, it charges no commission, and it puts availability and rates directly in
   Google's travel surfaces linking to *your* booking page. Single-property hosts qualify when
   they operate as a registered business with a direct-booking website — which describes this
   property exactly. Access is normally via an approved connectivity partner rather than direct
   integration. **Action:** confirm current eligibility in Google's own documentation, then
   investigate connectivity partners. Note this is also the only route to `VacationRental` rich
   results (see 8.2). Treat it as a Q2 project, not a launch-week task — verify requirements
   before committing, as partner lists change.

2. **If a GBP is attempted anyway** — and there is a defensible argument if the owner
   registers as a lodging/property-management business and meets guests in person at check-in —
   then it must be a service-area business with the street address hidden, the exact NAP used
   everywhere else, and full acceptance of suspension risk. Get it right the first time.

### 6.2 NAP — lock the canonical form now, before anything else

Every citation, listing, and schema block must use **byte-identical** text. Decide once:

```
Name:     Clover Creek Guest House
Street:   1475 W Hwy 199        (owner chose to publish it — 2026-09-08, see note below)
Locality: Rush Valley, UT 84069
Region:   Tooele County, Utah
Phone:    (set NEXT_PUBLIC_PHONE — see 6.3)
Email:    clovercreek@gmail.com   (see 6.3)
Website:  https://www.clovercreekguesthouse.com
Geo:      40.3376757, -112.4813979
```

> **Street address — 2026-09-08.** This plan originally recommended keeping the street
> address private (6.1, and Phase 0). The owner has since decided to publish
> `1475 W Hwy 199` in the `Organization`, `LodgingBusiness` and `VacationRental` schema
> blocks (it now lives in `SITE.location.streetAddress`). If that changes, it must be
> pulled from `src/lib/schema.ts` and every external listing at the same time — a
> half-removed address is worse than either choice.

Consistency rules — these are the entire mechanic:

- **"Guest House" as two words, always.** The Yelp entity currently reads "Clover Creek
  Guesthouse" (one word). Pick two words, then correct Yelp. Every variant splits the entity.
- **Never abbreviate** to "Clover Creek" or expand to "Clover Creek Farm Guest House."
- **Same locality string everywhere:** `Rush Valley, UT 84069`. Not "Rush Valley, Utah", not
  "Tooele County, UT", not "near Tooele."
- **Same website form everywhere:** with `www`, with `https`, no trailing slash.

### 6.3 Two decisions the owner must make

**A phone number.** `SITE.phoneDisplay` reads `NEXT_PUBLIC_PHONE`, which is currently unset —
so no phone number appears anywhere on the site. Local SEO and E-E-A-T both weight a visible,
consistent phone number heavily, and it is a required field on most directory listings. If the
owner does not want to publish a personal mobile, a free Google Voice number forwarding to it
solves this in ten minutes. **This is a blocker for Section 11 — most citations cannot be
built without it.**

**A real business email.** `clovercreek@gmail.com` works but reads as a hobby. A domain email
(`stay@clovercreekguesthouse.com`, forwarding to Gmail — free with most registrars) is a
meaningful trust signal to both directories and human guests.

### 6.4 On-site local signals to add

| Signal | Where | Notes |
|---|---|---|
| `LocalBusiness`/`LodgingBusiness` JSON-LD | Root layout, every page | See 8.1 — *done on `/` as of 2026-09-08; root-layout rollout still pending* |
| Visible NAP in footer | `src/components/Footer.tsx` | Add phone; keep "Rush Valley, UT 84069" |
| `/directions` page | New | Turn-by-turn from SLC, SLC airport, I-80, Tooele; drive times; "last gas" advice; embedded map |
| `/about` page | New | Owner name, photo, story, how long they have hosted, why the valley |
| Nearby-landmark distances | `/directions` + homepage | See table below |
| County and region naming | Throughout | Say "Tooele County" and "Utah's west desert" in body copy — the site currently under-uses both |

**Distance table** — put this on `/directions`, and reuse the numbers in schema, blog posts and
OTA descriptions. AI engines reward specific, consistent numbers, and this is the single most
reusable content asset on the site. **Verify each figure before publishing — these are the
sort of details that get quoted back at you.**

| Destination | Distance | Drive time |
|---|---|---|
| Salt Lake City | ~55 mi | ~1 hr |
| Salt Lake City International Airport (SLC) | ~55 mi | ~1 hr |
| Tooele (groceries, gas) | ~20 mi | ~30 min |
| Grantsville | — | — |
| Onaqui wild horse range | — | — |
| Bonneville Salt Flats | — | — |
| Pony Express Trail trailhead | — | — |
| Dugway | — | — |
| Vernon | — | — |

### 6.5 Location pages — build three, not thirty

Thin near-duplicate city pages get filtered out (Section 3.1). Build only pages that can be
genuinely different, and link each from real navigation:

1. **`/stargazing`** — Bortle class if measurable, best months, what is visible, the fire pit,
   Milky Way season, why it is darker here than Stansbury Park. The strongest differentiator
   the property has.
2. **`/directions`** — the distance table above, expanded with real advice.
3. **`/hunting`** *(seasonal, or expand the existing blog post)* — units, seasons, why a
   multi-night base beats a motel in Tooele, where to hang game.

Do **not** create "Vacation rental near Grantsville," "near Vernon," "near Stockton." Those
belong as *sections within* the directions page or as blog posts with real content.

---

## 7. Meta information — titles and descriptions

### 7.1 Rules

- **Titles:** 50–60 characters before truncation. Primary keyword first, brand last. The
  template in `src/app/layout.tsx` already appends `— Clover Creek Guest House`, so page-level
  titles must stay short — currently several overflow once the suffix lands.
- **Descriptions:** 140–160 characters. Not a ranking factor; a click-through factor. Lead with
  the differentiator (dark skies, taxes included, dog friendly), end with an implicit CTA.
- **Every page** needs an explicit `alternates.canonical`.
- **Every page** needs `openGraph.images`.

### 7.2 Rewrites

Current titles are decent. These sharpen keyword placement and fix length once the brand suffix
is appended.

| Page | Title (before suffix) | Meta description |
|---|---|---|
| `/` | *(full title, no suffix)* `Rush Valley Utah Farm Stay — Clover Creek Guest House` | Sleep 6 in a farmhouse cottage an hour from Salt Lake City. Dark skies, fire pit, dog friendly. Book direct — cleaning and taxes included. |
| `/book` | `Check Availability & Book Direct` | See exact prices for your dates. Cleaning fee and Utah taxes are already included — no surprise fees at checkout. Book in under two minutes. |
| `/gallery` | `Photos of the Farmhouse & Valley` | Fifteen photos of the king bedroom, loft, full kitchen, patio, fire pit and the Rush Valley skyline. See exactly what you are booking. |
| `/reviews` | `Guest Reviews` | Read all 19 reviews from guests who have stayed at our Rush Valley farmhouse, including verified-stay reviews from direct bookings. |
| `/faq` | `FAQ — Check-in, Pets, Wi-Fi & Directions` | Check-in times, the dog policy, Wi-Fi and cell coverage, distance from Salt Lake City, groceries, and how cancellations work. |
| `/house-rules` | `House Rules & Dog Policy` | Our house rules, checkout checklist, and the full pet policy — two dogs up to 50 lbs, $20 per dog per night, no cats. |
| `/blog` | `Rush Valley Area Guide` | Thirteen guides to Utah's west desert from people who live here: the Onaqui wild horses, Bonneville Salt Flats, Pony Express Trail and more. |
| `/about` *(new)* | `About Us & the Farm` | Meet the family behind Clover Creek Guest House, how the farmhouse came to be a guest house, and what a stay in Rush Valley is really like. |
| `/directions` *(new)* | `How to Find Us from Salt Lake City` | Turn-by-turn directions from Salt Lake City, SLC airport and I-80, plus drive times to the salt flats, the Onaqui herd and Tooele. |
| `/stargazing` *(new)* | `Stargazing in Utah's West Desert` | One of the darkest skies within an hour of Salt Lake City. What you can see, the best months, and how to use the fire pit as an observatory. |
| `/contact` | `Contact Us` | Questions about dates, the house or bringing your dog? Message us directly — we usually reply the same day. |

**Blog post title pattern:** `{Topic}: {Specific Hook}` and keep it under ~55 characters so the
brand suffix survives. Several current titles are too long — *"The Pony Express Trail: Ride
Utah's West Desert History from Rush Valley"* renders at 103 characters with the suffix and
will be cut. Suggested: `Pony Express Trail: Utah's West Desert Ride`.

### 7.3 Open Graph images

No `og:image` exists. Create two 1200×630 JPEGs:

- `/public/og-default.jpg` — the best exterior or fire-pit-at-dusk photo, with a small text
  overlay reading `Clover Creek Guest House · Rush Valley, Utah`.
- Per-page images later for `/gallery`, `/stargazing` and top blog posts.

Add to `src/app/layout.tsx` metadata, and set `twitter.card` to `summary_large_image`. This
also matters for AI: several assistants surface OG images in their answer cards.

---

## 8. Structured data (schema) plan

> **Implementation status — September 8, 2026.** A shared builder module
> `src/lib/schema.ts` now exists (8.3), and the home page emits an `Organization` +
> `LodgingBusiness` + `VacationRental` `@graph` in place of the old lone `VacationRental`
> object. All three nodes carry the full street address (`1475 W Hwy 199, Rush Valley,
> UT 84069`, stored once as `SITE.location.streetAddress`; `regionCode` `"UT"` is used in
> schema while the human-facing `region` stays `"Utah"`). The `VacationRental` Rich
> Results Test errors (missing `image`, `containsPlace`, `identifier`) and the
> `additionalType` / `review` warnings are cleared: `image` leads with
> `/public/guest-house-main.JPG` and appends every gallery photo (clears Google's
> 8-image minimum in production), `containsPlace` is an `Accommodation`, `identifier` is
> a stable `PropertyValue`. `LodgingBusiness` carries `priceRange` `$75-$105` (derived
> from the pricing config) and the same photo. `aggregateRating` is retained on both the
> lodging and rental nodes for machine readability, as 8.1 recommends.
> **Still pending:** promoting `LodgingBusiness`/`Organization` to the root layout so
> they render site-wide (home page only today); `sameAs` population (11.1); the per-page
> schema in the 8.3 table; breadcrumbs; compressing `guest-house-main.JPG` (5.3 MB, see 9.6).

### 8.1 Fix the primary business entity

The homepage currently emits `VacationRental` with a self-serving `aggregateRating`. Two
problems (A5, A6). The fix:

**Emit `LodgingBusiness` from the root layout**, so it appears on every page and Google can
resolve the entity site-wide. Include `sameAs` — this is the single most important field for
the branded-search failure and for AI entity resolution.

> **Done (2026-09-08), with one deviation:** the `LodgingBusiness` block below is
> implemented via `lodgingBusinessSchema()` in `src/lib/schema.ts` and rendered on the
> home page — *not yet* the root layout, so it is not site-wide. `sameAs` is omitted
> until the first listings exist. `telephone` is emitted only once `NEXT_PUBLIC_PHONE`
> is set (Phase 0). All other fields shown here are present.

```jsonc
{
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  "@id": "https://www.clovercreekguesthouse.com/#business",
  "name": "Clover Creek Guest House",
  "description": "A farmhouse cottage in Rush Valley, Utah, sleeping six, one hour from Salt Lake City. Dog friendly, with a fire pit under some of the darkest skies in northern Utah.",
  "url": "https://www.clovercreekguesthouse.com",
  "telephone": "+1-XXX-XXX-XXXX",
  "email": "stay@clovercreekguesthouse.com",
  "image": [
    "https://www.clovercreekguesthouse.com/og-default.jpg"
  ],
  "priceRange": "$75-$105",
  "currenciesAccepted": "USD",
  "paymentAccepted": "Credit Card",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Rush Valley",
    "addressRegion": "UT",
    "postalCode": "84069",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 40.3376757,
    "longitude": -112.4813979
  },
  "checkinTime": "15:00",
  "checkoutTime": "11:00",
  "petsAllowed": true,
  "numberOfRooms": 2,          // master bedroom + loft — confirm this is how you want it counted
  "maximumAttendeeCapacity": 6,
  "smokingAllowed": false,
  "amenityFeature": [
    { "@type": "LocationFeatureSpecification", "name": "Free WiFi", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Full kitchen", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Washer and dryer", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Air conditioning", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Fire pit", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Free parking", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Pets allowed", "value": true }
  ],
  "sameAs": [
    "https://www.airbnb.com/rooms/YOUR_LISTING",
    "https://www.vrbo.com/YOUR_LISTING",
    "https://www.yelp.com/biz/YOUR_LISTING",
    "https://www.facebook.com/YOUR_PAGE",
    "https://www.instagram.com/YOUR_HANDLE",
    "https://www.bringfido.com/YOUR_LISTING"
  ]
}
```

`sameAs` is how you tell Google and AI engines that the Airbnb listing, the Yelp entry, the
Facebook page and this site are all *one business*. Populate it as each listing goes live
(Section 11). It is the direct antidote to the branded-search failure.

**On `aggregateRating`:** keep it in the markup for machine readability, but understand it will
not produce stars — self-serving reviews are ineligible. If you want stars in search results,
they have to come from a third-party platform's own page, which is another argument for the
TripAdvisor and Yelp listings in Section 11.

### 8.2 `VacationRental` — keep or drop?

`VacationRental` rich results require an existing relationship with a Google Technical Account
Manager and Hotel Center access via the Early Adopters Program, plus at least eight photos (one
each of bedroom, bathroom, common area), five-decimal geo precision, and a stable `identifier`.
The property has fifteen photos and precise coordinates, so it would qualify technically — but
without the partnership the markup does nothing.

**Recommendation:** make `LodgingBusiness` the primary entity now. Revisit `VacationRental`
only if the Google Vacation Rentals path in 6.1 goes ahead, at which point add it alongside
(both types can coexist in a `@graph`).

> **Decision (2026-09-08):** the owner opted to *keep* `VacationRental` and make its
> markup valid now rather than drop it, so the Rich Results Test reads clean. It sits in
> the same `@graph` as `LodgingBusiness` (`vacationRentalSchema()` in `src/lib/schema.ts`).
> This does not change the substance of the recommendation — it still cannot produce a
> rich result without Hotel Center access, and `LodgingBusiness` remains the entity to
> build around.

### 8.3 Schema to add, page by page

| Page | Type | Status | Notes |
|---|---|---|---|
| All pages | `LodgingBusiness` | ⏳ partial | Built as `lodgingBusinessSchema()`; rendered on `/` only — root-layout rollout still to do |
| All pages | `WebSite` + `SearchAction` | ☐ | Enables sitelinks searchbox eligibility |
| All non-home pages | `BreadcrumbList` | ☐ | Pairs with visible breadcrumbs (Section 10) |
| `/` | `Organization` + `LodgingBusiness` + `VacationRental` `@graph` | ✅ 2026-09-08 | `homeGraph()`; reviews inlined on the rental node (not yet `@id`-referenced from a separate `Review` set) |
| `/reviews` | `Review` array on the `LodgingBusiness` `@id` | ☐ | 19 reviews, each with `author`, `datePublished`, `reviewRating`, `reviewBody` |
| `/faq` | `FAQPage` | ☐ | No rich result since May 2026, but AI engines parse Q&A well |
| `/blog/[slug]` | `BlogPosting` | ☐ | `headline`, `datePublished`, `dateModified`, `author`, `image`, `mainEntityOfPage`, `publisher` — **currently missing on all 13 posts** |
| `/blog` | `Blog` + `ItemList` | ☐ | Helps crawlers see the 13 posts as a set |
| `/gallery` | `ImageGallery` + `ImageObject` per photo | ☐ | `contentUrl`, `caption`, `creator`, `license` |
| `/house-rules` | `WebPage` with `about` → `LodgingBusiness` | ☐ | Ties the pet policy to the entity |
| `/about` | `AboutPage` + `Person` for the owner | ☐ | E-E-A-T; the `Person` node is what author bylines reference |
| `/directions` | `Place` + `TouristAttraction` refs | ☐ | Reinforces geography |
| `/book` | `Offer` / `AggregateOffer` | ☐ | Price range, currency, availability |

**Implementation note:** define the JSON-LD builders in one place — a new `src/lib/schema.ts`
exporting `lodgingBusiness()`, `breadcrumbs()`, `blogPosting()` and so on — rather than
inlining objects per page as `src/app/page.tsx` does today. One source of truth means the NAP
can never drift between pages, which is the whole point of Section 6.2.

> ✅ **Done (2026-09-08):** `src/lib/schema.ts` created, exporting `organizationSchema()`,
> `lodgingBusinessSchema()`, `vacationRentalSchema()` and `homeGraph()`, plus a shared
> `postalAddress()` / `geoCoordinates()` / `amenityFeature()` so the NAP is defined once.
> `src/app/page.tsx` no longer inlines any schema object. `breadcrumbs()` and
> `blogPosting()` remain to be added.

**Validate everything** at the Rich Results Test and Schema.org validator after deploy, and
watch Search Console's Enhancements reports for two weeks afterwards.

---

## 9. Images and alt text

### 9.1 The headline problem

All fifteen gallery photos carry the same alt text: `"Clover Creek Guest House"`. The `alt`
column in the `gallery_images` table is empty for every row, so `getGallery()` falls back to
the site name. Filenames are `1787611312870-3B79EF1A-408B-4043-8F49-0F66D12C93D6.JPG` —
carrying no signal either.

Fifteen photos of a real property, doing nothing.

### 9.2 Alt text rules

- **80–140 characters** is the practical sweet spot: descriptive enough for search and AI,
  short enough for a screen reader.
- **Describe what is in the frame,** then add context. Not "bedroom" — "King bed with white
  linens in the master bedroom, morning light through the window."
- **Work in a keyword naturally, once.** Never stuff. `alt="rush valley utah vacation rental
  dog friendly cabin"` is worse than useless.
- **Location words earn their place** on exterior and view shots, not on a photo of a kettle.
- **Decorative images get `alt=""`,** never a missing attribute.
- Alt text is also an **accessibility obligation**, not only an SEO tactic. Write it for a
  person who cannot see the photo; the SEO benefit follows.

### 9.3 Rewrite the fifteen

Do this in **Admin → Gallery**, where each image already has an editable `alt` field. Patterns
to work from — the owner should adapt each to the actual photo:

| Subject | Alt text |
|---|---|
| Exterior / hero | `The Clover Creek Guest House farmhouse at dusk, with the Oquirrh Mountains behind it in Rush Valley, Utah` |
| Master bedroom | `King bed with white linens and extra pillows in the master bedroom of the Rush Valley farmhouse` |
| Loft | `Loft sleeping area with two double beds under the farmhouse eaves, sleeping four more guests` |
| Kitchen | `Full farmhouse kitchen with cookware, coffee and tea bar, and windows over the valley` |
| Bathroom | `Full bathroom with tub and shower combination, fresh towels and complimentary toiletries` |
| Living area | `Living room with sofa and television, the common area of the six-guest farmhouse cottage` |
| Fire pit | `Stone fire pit ringed with chairs under the dark night sky at Clover Creek Guest House` |
| Patio | `Covered patio with grill, picnic table and porch swing looking out over the farm` |
| Laundry | `Washer and dryer with detergent provided, in the farmhouse laundry room` |
| Valley view | `Rush Valley farmland and the Stansbury Mountains seen from the guest house porch` |
| Night sky | `The Milky Way over Rush Valley, Utah, photographed from the guest house fire pit` |
| Farm animals | `{Animals} on the working farm at Clover Creek Guest House in Tooele County, Utah` |
| Dining | `Dining table set for six in the farmhouse, with the kitchen behind` |
| Winter exterior | `The farmhouse under snow in winter, Rush Valley, Utah` |
| Sunrise/sunset | `Sunrise over the Oquirrh Mountains from the Clover Creek Guest House patio` |

### 9.4 Filenames

Next.js proxies through `/_next/image?url=…`, so the Supabase Storage filename still appears in
the URL and Google still reads it. Rename on re-upload:

```
clover-creek-guest-house-exterior-dusk.jpg
clover-creek-master-bedroom-king.jpg
clover-creek-loft-two-double-beds.jpg
clover-creek-kitchen-full.jpg
clover-creek-fire-pit-night-sky.jpg
rush-valley-utah-milky-way-view.jpg
```

Lowercase, hyphens, no UUIDs, no `.JPG` uppercase extensions. Worth doing at the next photo
refresh; not worth re-uploading fifteen files for on its own.

### 9.5 Blog post images — the biggest content gap

**All thirteen blog posts contain zero images.** A 340-word post with no image is a weak result
in Google, effectively absent from Google Images, and less likely to be cited by AI engines
that favour illustrated pages.

Each post needs **one to three original photos** — the emphasis on *original* is the point. A
stock photo of a wild horse is worthless; a photo the owner took of the Onaqui herd from the
road outside is an E-E-A-T signal no aggregator can match. Same for the salt flats, the Pony
Express marker, the rodeo, the drive into Tooele.

Priority order: Onaqui wild horses → Bonneville Salt Flats → Pony Express Trail → stargazing →
hunting → rodeos.

> **Update 2026-09-10.** Posts move from the database to `.mdx` files in the repository
> (§13.4), which is what makes this section actionable. Images can now be co-located with
> the post and imported directly, so each one gets real `next/image` optimisation, correct
> dimensions and a blur placeholder — none of which was reachable through `marked` output.
> The photographs themselves are still owner work, and *original* still matters more than
> polished.

### 9.6 Technical image checks

| Item | Status | Action |
|---|---|---|
| Next.js `<Image>` with `sizes` | In place | None |
| `priority` on hero LCP image | In place | None |
| WebP/AVIF conversion | Automatic via Next | None |
| Lazy loading below the fold | Automatic | None |
| Source file size | Unverified — files are direct iPhone JPEGs; `public/guest-house-main.JPG` (schema image, added 2026-09-08) is **5.3 MB** | Compress to ≤ 500 KB — `guest-house-main.JPG` first, since it is referenced from the home-page JSON-LD |
| `ImageObject` schema on `/gallery` | Missing | Add (8.3) |
| Photo captions visible on the page | Only in the lightbox | Consider showing captions in the grid — caption text is a real ranking signal for Google Images |

---

## 10. Internal linking structure

### 10.1 What exists

The current structure is a flat hub-and-spoke: header and footer link to eight pages, `/blog`
links to each post, and posts link back. Verified on `/blog/onaqui-wild-horses-rush-valley`,
the in-body links are `/blog`, `/blog/pony-express-trail-guide`, `/`, `/faq`, `/book` — five
contextual links, which is genuinely good and better than most rental blogs manage.

What is missing is **hierarchy** and **topical clustering**. Every page is one hop from every
other page, so nothing signals which pages matter most, and the thirteen posts do not read as a
coherent body of local expertise.

### 10.2 Target architecture

```
/  (homepage — the hub, strongest internal authority)
│
├── /book ............................ money page: link from EVERY page
├── /gallery
├── /reviews
├── /about ........................... NEW — trust hub
├── /directions ...................... NEW — logistics hub
├── /stargazing ...................... NEW — differentiator hub
├── /faq
├── /house-rules
│
└── /blog  (Area Guide — topical hub)
    │
    ├── CLUSTER: Wildlife & landscape
    │     onaqui-wild-horses ·  bonneville-salt-flats ·  near-dugway-utah-west-desert
    │
    ├── CLUSTER: History & heritage
    │     pony-express-trail ·  wendover-utah ·  temple-square-salt-lake-city
    │
    ├── CLUSTER: Towns & everyday logistics
    │     tooele-utah ·  grantsville-utah ·  salt-lake-city-day-trip ·  byu-provo-day-trip
    │
    └── CLUSTER: Seasonal & local life
          tooele-county-rodeos ·  hunting-near-rush-valley ·  royal-creek-ranches
```

### 10.3 Rules

1. **Every blog post links to `/book`** at least once, in the body, with descriptive anchor
   text — not "click here." Already partly done; verify all thirteen.
2. **Every blog post links to two or three sibling posts in its cluster.** This is what turns
   thirteen isolated pages into a recognised topical authority on Utah's west desert.
3. **Every cluster's strongest post links up** to `/blog`, and `/blog` links down to all
   thirteen with a one-line description each (the excerpt already does this).
4. **The homepage links down to the three or four strongest posts by name** — not just "Area
   Guide" in the nav. Add a "Guides to the valley" section between the reviews teaser and the
   map. This passes real authority to the posts most likely to earn AI citations.
5. **`/stargazing`, `/directions` and `/about` go in the header nav**, not only the footer.
   Nav placement is what distinguishes a legitimate location page from a doorway page.
6. **Anchor text should be varied and descriptive.** Ten posts all linking with "book your
   stay" is a weaker signal than a mix of "check dates for your stay," "our nightly rates,"
   "see what is available in October."
7. **Add breadcrumbs** — visible and `BreadcrumbList` schema:
   `Home › Area Guide › The Onaqui Wild Horses`. Currently the only way back is a "← Area
   Guide" link.

> **Update 2026-09-10 on rules 1 and 2.** With posts as `.mdx` files (§13.4), links inside
> post bodies are editable in the repo. The implementation splits them: the systematic ones
> — the cluster block and the booking CTA every post needs — are rendered by the page
> component from a cluster map, so adding or renaming a post cannot leave thirteen stale
> hand-written blocks behind. Contextual links, the ones that belong inside a sentence, go
> in the prose during each post's content expansion.

### 10.4 Specific links to add

| From | To | Anchor text |
|---|---|---|
| `/` | `/stargazing` | `some of the darkest skies within an hour of Salt Lake City` |
| `/` | `/blog/onaqui-wild-horses-rush-valley` | `the Onaqui wild horse herd` |
| `/` | `/about` | `the family who runs the farm` |
| `/` | `/directions` | `an hour from Salt Lake City — here is the drive` |
| `/faq` (distance answer) | `/directions` | `full turn-by-turn directions` |
| `/faq` (pets answer) | `/house-rules#pets` | already present |
| `/house-rules` | `/faq` | `other common questions` |
| `/gallery` | `/book` | `check dates for these rooms` |
| `/reviews` | `/book` | `book the same stay` |
| `/blog/hunting-near-rush-valley` | `/book` + `/directions` | `base yourself here for the season` |
| `/blog/bonneville-salt-flats-guide` | `/stargazing` | `stay out after dark` |
| `/blog/tooele-utah-guide` | `/directions` | `how to get here from Tooele` |
| `/stargazing` | `/gallery`, `/book`, salt flats post | contextual |
| Every post | 2–3 cluster siblings | contextual |

### 10.5 Crawl hygiene

- `noindex` on `/login`, `/book/success`, `/auth/callback` — currently crawlable with no
  directive (A13). Add `robots: { index: false, follow: false }` to each page's metadata.
  `/admin` and `/account` are already disallowed in `robots.txt`.
- Add `lastModified` to the static entries in `src/app/sitemap.ts` (A14). Blog posts already
  have it.
- Consider adding `/about`, `/directions`, `/stargazing`, `/terms`, `/privacy` to the sitemap
  once they exist.
- `/reviews` is `force-dynamic` (A15). Switch to `revalidate = 300` like the other pages —
  reviews do not change minute to minute, and this is a page you want fast for crawlers.

---

## 11. Backlinks and citations

This is where roughly 60% of the effort belongs, and it is the part the codebase cannot solve.

### 11.1 Tier 1 — foundational citations (do first, ~4 hours total)

Every one of these creates a NAP citation, most create a link, and each becomes a `sameAs`
entry in the schema. **These directly address the branded-search failure.**

| Platform | Why it matters | Cost | Notes |
|---|---|---|---|
| **Yelp** | An entity already exists as "Clover Creek Guesthouse" and it currently outranks the site | Free | **Claim it and correct the name to two words.** Highest priority item on this list. |
| **Bing Places** | Feeds Bing and Microsoft Copilot | Free | Different eligibility rules from Google |
| **Apple Business Connect** | Apple Maps, Siri | Free | Rentals more readily accepted than on Google |
| **TripAdvisor** | **The #1 source Perplexity cites for travel (~95%)** | Free listing | Single highest-leverage AI-visibility action available |
| **BringFido** | Already ranks for `pet friendly Tooele` and `Grantsville` | Free/paid tiers | The property is a natural fit |
| **Facebook Page** | Entity signal, `sameAs`, review surface | Free | Even if barely used |
| **Instagram** | Where dark-sky and farm-stay photos actually travel | Free | Real payoff for the night-sky photography |

### 11.2 Tier 2 — local and tourism authority (highest value per link)

Official tourism and `.gov`/`.org` links carry trust that is hard to earn any other way. One
link from the county tourism site outweighs dozens of directory links.

| Target | Approach |
|---|---|
| **Explore Tooele County** (`exploretooele.org/lodging/`) | Has a lodging page. Ask to be added. Free, and directly topically relevant. |
| **Visit Tooele County** (`visittooelecounty.com`) | Same. |
| **Tooele County Chamber of Commerce & Tourism** | 154 S Main St, Tooele · (435) 882-0690 · 360+ members. Membership buys a directory listing on a trusted local domain plus real referrals. Worth the fee. |
| **Utah Office of Tourism / visitutah.com** | Partner listing process — enquire. Highest-authority target on this list. |
| **Rush Valley Town / Tooele County government** | Local business listings where they exist. |

### 11.3 Tier 3 — relationships and content links

- **Royal Creek Ranches.** The blog already features them. Convert that into a reciprocal
  relationship: they take large groups and retreats, you take couples and small families.
  Overflow referrals both directions, and a link from a Booking.com-listed neighbour.
- **Local businesses to cross-link with:** Tooele restaurants and cafés, guide and outfitter
  services for west-desert hunts, ATV rental operators, the Deseret Peak complex and rodeo
  organisers, Bonneville Salt Flats tour operators.
- **Astronomy and dark-sky communities.** Utah astronomy clubs, Salt Lake Astronomical Society,
  DarkSky International's Utah chapter, r/AskSLC and r/Utah when genuinely relevant. Dark-sky
  people actively hunt for accommodation near dark sites — and they link.
- **Wild horse advocacy and photography groups.** The Onaqui herd has a devoted following with
  active blogs and Facebook groups. Being *the* place to stay near the herd is a defensible
  niche nobody currently owns.
- **Hunting forums and outfitters.** Utah hunting forums, Monster Muleys, west-desert unit
  discussions. Genuine participation, not link-dropping.
- **Travel bloggers and micro-influencers.** A complimentary off-season night in exchange for
  an honest write-up. Target Utah-focused and dark-sky/van-life/dog-travel writers rather than
  general travel accounts. Discuss the link expectation up front, and disclose the comp.
- **Digital PR angle:** "the darkest sky within an hour of Salt Lake City" is a pitchable
  story for Salt Lake City outlets, Utah lifestyle publications and astronomy media — *if* the
  claim can be substantiated with a Bortle rating or a light-pollution map reference. Verify
  before pitching; an unsupported superlative is a liability.

### 11.4 The OTA question

Keeping Airbnb and VRBO listings live is **good for SEO and essential for AI visibility**, even
though the whole point is to shift bookings direct.

- OTAs supply ~55% of AI travel citations. Delisting removes you from the corpus AI engines
  read most.
- Each listing is a citation and a `sameAs` target.
- OTA listings are how people discover you; the direct site is how they book the second time.

**Make the OTA listings work for the direct site:** use the exact same NAP and the exact same
descriptive language ("farmhouse cottage," "Rush Valley," "dark skies," "sleeps six," "dog
friendly," "cleaning and taxes included"). Consistency across sources is precisely what makes
an AI engine confident enough to name you. Note that OTAs restrict outbound links to your own
site — do not try to work around that; the consistency itself is the asset.

### 11.5 What not to do

Paid link schemes, private blog networks, mass directory submissions, comment-spam links,
reciprocal-link swaps with unrelated sites, and any "500 backlinks for $50" service. For a
site this small, a link penalty would be far more damaging than the current invisibility.

---

## 12. AI search optimisation (GEO), concretely

On-site changes that make the site *citable*, in priority order.

### 12.1 Direct-answer blocks

Add a 40–60 word paragraph near the top of every important page that answers the page's core
question in complete, self-contained sentences — quotable without surrounding context.

Homepage, immediately under the hero:

> Clover Creek Guest House is a two-bedroom farmhouse cottage in Rush Valley, Utah, about an
> hour southwest of Salt Lake City. It sleeps six, welcomes up to two dogs, and sits on a
> working farm under some of the darkest skies in northern Utah. Rates start at $75 a night
> with cleaning and taxes included.

Every number in that paragraph is checkable and repeated in the schema, the OTA listings and
the directory entries. That is what entity consistency looks like in practice.

### 12.2 Make the FAQ answers plainly visible

The `<details>` pattern is fine for humans but works against you for AI. Restructure `/faq` so
each question is a real `<h2>` with the answer as visible body text beneath it. Keep an
optional expand/collapse for long answers only. Add `FAQPage` schema on top.

Then **add questions people actually ask an assistant**, which the current eight do not cover:

- How far is Clover Creek Guest House from Salt Lake City airport?
- Can I see the Onaqui wild horses from the guest house?
- Is there cell service in Rush Valley?
- What is the closest grocery store?
- Can I bring two dogs?
- Is the property good for stargazing?
- What is there to do near Rush Valley in winter?
- Do you have a minimum stay?
- How dark is the sky, really?

### 12.3 Specificity over adjectives

AI engines quote facts, not atmosphere. Replace vague copy with checkable numbers throughout:

| Instead of | Write |
|---|---|
| "about an hour from Salt Lake City" | "55 miles and roughly 65 minutes from downtown Salt Lake City" |
| "dark skies" | "Bortle class N skies, with the Milky Way visible from the fire pit April through September" |
| "nearby hiking" | "the Onaqui herd range begins X miles west; the Pony Express Trail crosses Y miles south" |
| "sleeps 6" | "sleeps six: a king bed in the master bedroom and two double beds in the loft" |

Fill in the real values before publishing — a wrong number quoted back by an assistant is worse
than no number.

### 12.4 Entity and authorship signals

- **`/about` with a named human, a photo, and a story.** This is the page AI engines use to
  decide the business is real.
- **Byline the blog posts** with the owner's name, linked to the `Person` node on `/about`.
- **First-hand framing:** "We watched the Onaqui herd cross the road below the house last
  April" outperforms "The Onaqui herd can be seen in the area." Experience is the amplified
  E-E-A-T signal, and it is the one thing an aggregator structurally cannot produce.
- **`sameAs` in the schema**, populated as listings go live (8.1).

> **Update 2026-09-10.** Bylines are now a `meta.author` field on each post file (§13.4),
> resolved against the `Person` node on `/about` — so the byline and the entity cannot
> drift apart. The first-hand framing point above is unaffected by the move and becomes
> *more* important because of it: a developer or an agent can now draft a post, and neither
> knows what crossed the road last April. That detail has to come from the owner, or the
> post loses the one signal an aggregator cannot reproduce.

### 12.5 Do not build an llms.txt

Google says it does not use it. No major engine has committed to it. It is a maintenance burden
with no demonstrated return. Skip it. Keep `robots.txt` permissive to AI crawlers instead —
verify that GPTBot, PerplexityBot, ClaudeBot and Google-Extended are not blocked. The current
`robots.ts` uses a single `*` rule allowing `/`, so they are not. Leave it that way.

### 12.6 Measuring AI visibility

There is no Search Console for AI. Test manually, monthly, and log it:

Ask each of ChatGPT, Perplexity, Gemini and Claude:

1. "Where can I stay near the Bonneville Salt Flats?"
2. "Dog friendly vacation rental near Salt Lake City with dark skies"
3. "Where should I stay to see the Onaqui wild horses?"
4. "Farm stay in Utah for a family of six"
5. "Quiet getaway an hour from Salt Lake City"
6. "Clover Creek Guest House" *(branded control)*

Record: cited or not, what was said, which source was credited. Expect near-zero on 1–5 at the
start — that is the baseline, and the branded control confirms the engines can find you at all.

---

## 13. Technical SEO

### 13.1 Fix immediately

| # | Fix | Where |
|---|---|---|
| 1 | Add `alternates: { canonical }` to every page's metadata | all `page.tsx` |
| 2 | Pick one host — www or apex — and 301 the other | Vercel domain settings + `NEXT_PUBLIC_SITE_URL` |
| 3 | Align `DEFAULT_SITE_URL` in `src/lib/site.ts` with the deployed value | `src/lib/site.ts` |
| 4 | Add `og:image` and `twitter:card: summary_large_image` | `src/app/layout.tsx` |
| 5 | `noindex` on `/login`, `/book/success`, `/auth/callback` | those pages |
| 6 | `lastModified` on static sitemap entries | `src/app/sitemap.ts` |
| 7 | `/reviews` → `revalidate = 300` instead of `force-dynamic` | `src/app/reviews/page.tsx` |

On #2 and #3: the deployed `NEXT_PUBLIC_SITE_URL` resolves to `www`, while the hard-coded
fallback in `site.ts` is the apex domain. Right now that only bites if the env var is ever
cleared — but it would silently emit apex URLs into the sitemap and every canonical tag. Make
them match.

### 13.2 Verify and hold

- **Google Search Console** — verify the property (a Vercel DNS TXT record), submit the
  sitemap, then watch Coverage weekly for the first month. **This is step zero of the whole
  plan; nothing else can be measured without it.**
- **Bing Webmaster Tools** — same, and it feeds Copilot.
- **PageSpeed Insights** on `/`, `/gallery` and a blog post. Targets: LCP ≤ 2.5s, INP ≤ 200ms,
  CLS ≤ 0.1. The `/gallery` page loads fifteen full-resolution iPhone JPEGs through the Next
  image optimiser — most likely fine given the `sizes` attribute is correct, but it is the one
  page worth measuring on a real mobile connection rather than assuming.
- **Mobile usability** — most lodging searches are mobile.

### 13.3 Deliberately not doing

- `llms.txt` (12.5)
- AMP (deprecated)
- Separate mobile URLs
- Keyword-stuffed footer link blocks
- Auto-generated town pages (Section 6.5)

### 13.4 Content architecture — the blog moves to MDX

> **Decision, 2026-09-10.** The thirteen Area Guide posts move out of the `blog_posts`
> table and into `src/content/blog/*.mdx`, compiled at build time. URLs and slugs are
> unchanged. The Admin → Blog editor is retired; every other admin section is untouched.

This is not an SEO tactic on its own — it is the change that makes several of the tactics
above affordable, and it has three genuine SEO consequences.

**Why:**

1. **It unblocks §9.5 and §12.4.** Expanding thirteen posts to 800–1,200 words with images,
   cross-links and bylines is the largest remaining item in this plan. As database rows,
   every one of those edits is manual work in a textarea. As files they are reviewable
   diffs that a developer or a coding agent can produce, and that the owner reads back.
2. **Images become real.** Post bodies previously rendered through `marked` into
   `dangerouslySetInnerHTML`, so an in-body image was a bare `<img>` — no `next/image`, no
   dimensions, no lazy-loading control, and a CLS risk on the exact pages §9.5 wants
   illustrated. Co-located static imports fix all of that.
3. **The blog stops being a Supabase dependency.** `getPublishedPosts()` catches errors and
   returns an empty array, so an outage or a cleared environment variable silently empties
   `/blog` *and drops all thirteen posts out of `sitemap.xml`*. A crawl during that window
   sees a site with no content section. Files cannot fail that way.

**What it costs:** the owner can no longer publish or edit a post without a developer.
That is a real loss, accepted deliberately — these posts are evergreen reference pages
rather than a news feed, and the content push ahead is developer-assisted. The
`blog_posts` table, its data and its RLS policies are left in place as the rollback path.

**What does *not* change:** home page copy, FAQ answers, house rules, the amenity list,
gallery photos and alt text, pricing, holidays and review moderation all stay owner-editable
in the admin panel. Only the blog moves.

Implementation is Stage 06 in [seo-stages/](seo-stages/README.md).

---

## 14. Measurement

### 14.1 Set the baseline this week

Nothing here can be evaluated without a starting point. Before any changes ship, record:

| Metric | Source | Baseline |
|---|---|---|
| Indexed pages | GSC Coverage | *(not yet verified — do this first)* |
| Impressions, 28 days | GSC Performance | — |
| Clicks, 28 days | GSC Performance | — |
| Branded query position | GSC | Currently absent from at least one major index |
| Direct bookings/month | Stripe + admin dashboard | — |
| Referral sources | Vercel Analytics | — |
| AI citation rate | Manual test (12.6) | Assume ~0% unbranded |
| Backlinks | Ahrefs/Moz free tier | — |

### 14.2 Targets

| Horizon | Target |
|---|---|
| 30 days | All pages indexed; branded search returns the site #1; 10+ Tier-1 citations live |
| 90 days | Top 3 for Cluster 1 terms; 2+ blog posts ranking page 1 for their long-tail; 2+ tourism backlinks |
| 6 months | Page 1 for several Cluster 2 terms; cited by at least one AI engine on an unbranded prompt; measurable direct-booking lift |
| 12 months | Direct bookings exceed OTA bookings |

Note the standard caveat: SEO typically takes three to six months to show meaningful ranking
movement. The branded-search and citation fixes should move faster than that; the Cluster 2
work will not.

### 14.3 Cadence

- **Weekly (15 min):** GSC Coverage for errors; new reviews to approve.
- **Monthly (1 hr):** GSC Performance; run the six AI prompts; publish or refresh one post.
- **Quarterly (2 hr):** competitor sweep (5.3); content-freshness pass on all posts; backlink
  check; verify NAP consistency across every listing.

---

## 15. Phased roadmap

> **Execution plans:** the phases below are broken into eleven independently runnable,
> reviewable and committable stages in [seo-stages/](seo-stages/README.md), each marked for
> whether it is developer work or owner work. Start at
> [seo-stages/README.md](seo-stages/README.md).

### Phase 0 — Prerequisites (owner decisions, blocks everything else)

- [ ] Decide on a published phone number (Google Voice if a personal mobile is not acceptable)
- [ ] Decide on a domain email address
- [ ] Decide the canonical host: `www` or apex
- [x] Confirm the exact street address *(2026-09-08: `1475 W Hwy 199` — owner chose to **publish** it in schema, reversing the "private only" recommendation; see 6.2)*
- [ ] Gather the real distance and drive-time figures for Section 6.4

### Phase 1 — Foundation (week 1, ~1 day of dev)

- [ ] Verify Google Search Console and Bing Webmaster Tools; submit the sitemap
- [ ] Add canonical tags site-wide
- [ ] 301 the non-canonical host; align `DEFAULT_SITE_URL`
- [ ] Create and wire up `og-default.jpg`; switch to `summary_large_image`
- [ ] `noindex` on `/login`, `/book/success`, `/auth/callback`
- [ ] Rewrite all fifteen gallery alt texts in Admin → Gallery
- [ ] Claim the Yelp listing; correct "Guesthouse" → "Guest House"

### Phase 2 — Entity and schema (week 2, ~1 day of dev)

- [x] Create `src/lib/schema.ts` *(2026-09-08 — `Organization` + `LodgingBusiness` + `VacationRental` `@graph` on `/`; also cleared the `VacationRental` Rich Results errors and added the street address to all three)*
- [ ] Move `LodgingBusiness` + `Organization` into the root layout so they render site-wide (currently `/` only)
- [ ] Add `Review` schema to `/reviews`, `BlogPosting` to all 13 posts, `FAQPage` to `/faq`
- [ ] Add `BreadcrumbList` and visible breadcrumbs
- [ ] Register on Bing Places, Apple Business Connect, TripAdvisor, BringFido
- [ ] Create the Facebook and Instagram pages
- [ ] Populate `sameAs` as each listing goes live

### Phase 3 — Content (weeks 3–6)

- [ ] **Move the blog to MDX (§13.4)** — do this before the post work below, or the post
      work has to be done twice
- [ ] Write `/about` with a real name, photo and story; add the `Person` node
- [ ] Write `/directions` with verified distances
- [ ] Write `/stargazing`
- [ ] Add these three to the header nav
- [ ] Add direct-answer blocks to `/`, `/book`, `/faq` and the top blog posts
- [ ] Restructure `/faq`: real `<h2>` headings, visible answers, nine new questions
- [ ] Expand the six priority blog posts to 800–1,200 words with original photos —
      *owner supplies the first-hand knowledge and the photographs; drafting is dev work
      once §13.4 lands*
- [ ] Add cluster cross-links across all 13 posts
- [ ] Byline every post

### Phase 4 — Authority (months 2–4, ongoing)

- [ ] Apply to Explore Tooele County and Visit Tooele County lodging pages
- [ ] Join the Tooele County Chamber of Commerce
- [ ] Enquire about a Utah Office of Tourism partner listing
- [ ] Approach Royal Creek Ranches about mutual referrals
- [ ] Reach out to dark-sky and wild-horse communities
- [ ] Investigate Google Vacation Rentals free booking links (6.1)
- [ ] Expand the remaining seven blog posts
- [ ] Publish one new post per month against the seasonal calendar

### Phase 5 — Sustain (ongoing)

- [ ] Monthly AI-visibility test
- [ ] Quarterly competitor sweep and freshness pass
- [ ] Encourage direct-booking guests to review on TripAdvisor and Yelp, not only on-site
- [ ] Keep OTA listings live and verbally identical to the site

### Effort estimate

| Phase | Dev | Owner | Elapsed |
|---|---|---|---|
| 0 | — | 1 hr | — |
| 1 | ~8 hr | 2 hr | 1 week |
| 2 | ~8 hr | 3 hr | 1 week |
| 3 | ~4 hr → **~16 hr** | 12–20 hr → **4–6 hr** | 4 weeks |
| 4 | ~2 hr → **~8 hr** | 10–15 hr → **6–8 hr** | 3 months |
| 5 | — | 2 hr/month | ongoing |

Phases 1 and 2 are where the return is concentrated: roughly two days of development work
against defects that are currently costing the site its own brand name.

> **Revised 2026-09-10 for §13.4.** Phases 3 and 4 shift from owner hours to dev hours: the
> MDX move costs ~4 hr of dev up front, and post expansion becomes dev-assisted drafting
> rather than owner typing. The owner's remaining hours are the part that cannot be
> delegated — supplying first-hand knowledge, taking the photographs, and reading each post
> back before it ships. Total effort across both phases is roughly unchanged; who spends it
> is not.

---

## 16. The short version

If only five things get done:

1. **Add canonical tags and pick one host.** Nothing else works reliably until this is fixed.
2. **Rewrite the fifteen gallery alt texts.** Thirty minutes in the admin panel; fifteen assets
   go from zero to contributing.
3. **Claim Yelp and list on TripAdvisor.** The two places you are already losing your own brand
   name and the source Perplexity trusts most.
4. **Write `/about` with a real name and a real photo.** The biggest E-E-A-T lever available,
   and free.
5. **Give the thirteen blog posts photos and 800 words.** The content is already correctly
   targeted; it is simply half-built.

---

## 17. Sources

Research conducted September 4, 2026.

**AI search / GEO / AEO**
- [Mastering generative engine optimization in 2026 — Search Engine Land](https://searchengineland.com/mastering-generative-engine-optimization-in-2026-full-guide-469142)
- [Generative Engine Optimization: The Complete 2026 Guide — Enrich Labs](https://www.enrichlabs.ai/blog/generative-engine-optimization-geo-complete-guide-2026)
- [GEO, AEO, and SEO in 2026 — WRITER](https://writer.com/blog/geo-aeo-optimization/)
- [Answer Engine Optimization: What Actually Works in 2026 — Euracle](https://www.euracle.com/blog/answer-engine-optimization)
- [What Is llms.txt and How to Implement It — Elementera](https://www.elementera.com/blog/what-is-llms-txt-how-implement-for-ai-bots-2026-guide)

**Travel-specific AI visibility**
- [AI Hotel Booking: 90 Days Inside ChatGPT and Perplexity — MapAtlas](https://mapatlas.eu/blog/chatgpt-perplexity-hotel-booking-90-days)
- [AI Hotel Landscape 2026 — Hotelrank Research](https://hotelrank.ai/research/ai-hotel-landscape-2026)
- [Vacation Rental SEO + AI Search Visibility in 2026 — Crafted Stays](https://craftedstays.co/vacation-rental-seo/)
- [Travel & Hospitality AI Visibility Report 2026 — AIVO Research](https://www.tryaivo.com/resources/research/travel-hospitality-ai-visibility-april-2026)
- [Perplexity AI Travel Recommendations Explained — StayStrategy](https://staystrategy.co/knowledge/perplexity-ai-travel-recommendations-explained)

**Structured data**
- [Vacation rental (VacationRental) structured data — Google Search Central](https://developers.google.com/search/docs/appearance/structured-data/vacation-rental)
- [Review snippet structured data — Google Search Central](https://developers.google.com/search/docs/appearance/structured-data/review-snippet)
- [Making Review Rich Results more helpful — Google Search Central Blog](https://developers.google.com/search/blog/2019/09/making-review-rich-results-more-helpful)
- [Google's self-serving reviews rule — JSON Schema App](https://jsonschemaapp.com/blog/google-self-serving-reviews-rule/)
- [Can local businesses use review schema? — BrightLocal](https://www.brightlocal.com/learn/review-schema/)
- [Google Drops FAQ Rich Results From Search — Search Engine Journal](https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/)
- [Hotel Schema Markup in 2026 — Travel Visibility](https://www.travelvisibility.com/hotel-schema-markup-in-2026-the-structured-data-checklist-that-feeds-google-and-ai-engines)

**Local SEO and Google Business Profile**
- [Business eligibility and ownership guidelines — Google Business Profile Help](https://support.google.com/business/answer/13763036?hl=en)
- [Google My Business for Vacation Rentals — Online Ownership](https://onlineownership.com/google-my-business-for-vacation-rentals-holiday-homes-clearing-up-the-confusion/)
- [Google Vacation Rentals for Hosts: 2026 Guide — DirectStay Solutions](https://directstaysolutions.com/google-vacation-rentals-for-hosts-eligibility-setup-and-direct-links/)
- [Local SEO Guide for Vacation Rentals — Lodgify](https://www.lodgify.com/blog/local-seo/)
- [Do City Pages Still Work in 2026? — VisionEFX](https://www.visionefx.net/do-city-pages-still-work-2026/)
- [Doorway Pages vs Landing Pages — Big Red SEO](https://www.bigredseo.com/doorway-pages-vs-landing-pages/)

**Link building**
- [Vacation Rental Link Building Guide — Magnetic Strategy](https://magneticstrategy.com/vacation-rental-seo/link-building/)
- [7 Link-Building Tips for Hospitality 2026 — US Tech Automations](https://ustechautomations.com/resources/blog/link-building-for-travel-hospitality-2026)
- [Vacation Rental SEO Guide, updated for 2026 — BuildUp Bookings](https://www.buildupbookings.com/blog/vacation-rental-seo/)

**Technical, E-E-A-T and images**
- [Core Web Vitals 2026: INP, LCP & CLS — Digital Applied](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide)
- [E-E-A-T in March 2026: Google Experience Content Guide — Digital Applied](https://www.digitalapplied.com/blog/e-e-a-t-march-2026-google-rewards-experience-content-guide)
- [E-E-A-T for Small Business SEO — Sprout Sage Solutions](https://sproutsagesolutions.com/eeat-for-small-business-seo/)
- [Alt Text SEO Best Practices: 9 Rules for 2026 — AltText.ai](https://alttext.ai/blog/image-alt-text-seo-best-practices)
- [Image SEO 2026: 12 Alt-Text Patterns That Actually Rank — SEOScore](https://seoscore.tools/blog/image-seo/)

**Competitive landscape (verified SERPs)**
- [Rush Valley Vacation Rentals — Vrbo](https://www.vrbo.com/vacation-rentals/usa/utah/rush-valley)
- [Tooele County Pet-Friendly Vacation Rentals — Airbnb](https://www.airbnb.com/tooele-county-ut/stays/pet-friendly)
- [Royal Creek Ranches, Rush Valley — Booking.com](https://www.booking.com/hotel/us/royal-creek-ranches.html)
- [Lodging — Explore Tooele County](https://exploretooele.org/lodging/)
- [Visit Tooele County](https://visittooelecounty.com/)
- [Pet Friendly Vacation Rentals in Tooele, UT — BringFido](https://www.bringfido.com/lodging/rentals/city/tooele_ut_us/)
