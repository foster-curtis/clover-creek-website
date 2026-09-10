# Stage 03 — Site-wide entity schema

**Source:** SEO_PLAN.md §8.1, §8.3, §6.4. Closes the "⏳ partial" row in the §8.3 table.

**Depends on:** Stage 02 (`OG_IMAGE_URL` in `src/lib/schema.ts`).

## Goal

`Organization`, `LodgingBusiness` and `WebSite` render on **every page**, not just the home
page, so Google and the AI engines can resolve this business as one entity wherever they
land. This is the direct fix for the failure in SEO_PLAN.md §1: *the site does not rank for
its own brand name*.

## Who does what

| Step | Who |
|---|---|
| 1–7 (all code) | **[AGENT]** |
| Supplying live listing URLs for `sameAs` | **[HUMAN]** — Stage 00 §D; the code ships with an empty list |

`sameAs` is the single most important field for the branded-search failure (§8.1), and it
cannot be populated until the Yelp, TripAdvisor, Airbnb, VRBO, Facebook and Instagram
listings exist. This stage builds the mechanism and leaves it empty. Adding a URL later is
a one-line edit to `SITE.sameAs`.

## The design

Today `src/app/page.tsx` fetches reviews and pricing, then emits all three entities. Moving
that to the root layout would put a database round trip on every page render. So:

- **Root layout** emits `Organization` + `LodgingBusiness` + `WebSite` built from **static
  constants only** — no database access.
- **The home page** emits a second graph with the `VacationRental` node plus a *merge node*:
  a bare `{"@id": ".../#lodging", priceRange, aggregateRating}` object. Schema.org consumers
  merge nodes sharing an `@id` within a page, so the live rating and price attach to the
  site-wide business entity without duplicating it.

That merge-node pattern is reused on `/reviews` in Stage 07.

---

## Steps

### 1. **[AGENT]** Add the canonical description and `sameAs` to `SITE`

In [src/lib/site.ts](../src/lib/site.ts), inside the `SITE` object:

```ts
// The canonical one-sentence description of the business. Used verbatim in every
// schema block, and it is the sentence the OTA listings and directory entries should
// match word for word — entity consistency is the whole mechanic (SEO_PLAN.md §6.2).
description:
  "A farmhouse cottage in Rush Valley, Utah, sleeping six, one hour from Salt Lake City. Dog friendly, with a fire pit under some of the darkest skies in northern Utah.",

// Profiles and listings that are the same business. Populated as each listing goes
// live (SEO_PLAN.md §11.1) — this is the direct antidote to the branded-search
// failure. Only add URLs that are live and verified; a dead sameAs is worse than none.
sameAs: [] as readonly string[],
```

The description is taken verbatim from §8.1. Do not paraphrase it, and do not let it drift
from what the owner writes on Airbnb and Yelp.

### 2. **[AGENT]** Rework `src/lib/schema.ts`

Existing exports stay; these are the changes:

**a. Use the constants.** `organizationSchema()` and `lodgingBusinessSchema()` currently
take a `description` argument that the home page passes from owner-editable content. Change
both to default to `SITE.description` so schema text cannot drift from page to page. Keep
the parameter optional for future overrides.

**b. Add `sameAs`.** In `organizationSchema()` and `lodgingBusinessSchema()`, emit
`sameAs` only when `SITE.sameAs.length > 0` — an empty array in JSON-LD is noise.

**c. Use the OG image for the `Organization` logo.** `logo: OG_IMAGE_URL` reads better in
knowledge panels than a 2000px-wide photo. Keep `image: MAIN_IMAGE_URL`.

**d. Make `priceRange` and `aggregateRating` optional on `lodgingBusinessSchema()`** — the
layout has neither.

**e. Add `webSiteSchema()`** (§8.3, "enables sitelinks searchbox eligibility"):

```ts
const WEBSITE_ID = `${SITE.url}/#website`;

export function webSiteSchema() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE.url,
    name: SITE.name,
    description: SITE.description,
    publisher: { "@id": ORG_ID },
    inLanguage: "en-US",
  };
}
```

> **No `SearchAction`.** §8.3 mentions the sitelinks searchbox, but this site has no search
> page — claiming a `SearchAction` that points nowhere is markup that lies about the site.
> Add it if and when a `/search` route exists.

**f. Export the shared ids** so other pages can reference them:

```ts
export const SCHEMA_IDS = { org: ORG_ID, business: BUSINESS_ID, rental: RENTAL_ID, website: WEBSITE_ID } as const;
```

**g. Add `siteGraph()`** — what the root layout renders:

```ts
/**
 * The entity graph rendered on every page (SEO_PLAN.md §8.1). Static constants only —
 * this runs in the root layout, so it must never touch the database.
 */
export function siteGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationSchema(), lodgingBusinessSchema(), webSiteSchema()],
  };
}
```

**h. Add `businessRatingNode()`** — the merge node described above:

```ts
/**
 * A partial LodgingBusiness carrying only live values. Consumers merge nodes that
 * share an @id within a page, so this attaches the current rating and price range to
 * the site-wide business entity without repeating it.
 */
export function businessRatingNode(opts: {
  priceRange?: string;
  aggregateRating?: AggregateRatingInput | null;
}) {
  return {
    "@type": "LodgingBusiness",
    "@id": BUSINESS_ID,
    ...(opts.priceRange ? { priceRange: opts.priceRange } : {}),
    ...(opts.aggregateRating ? { aggregateRating: aggregateRating(opts.aggregateRating) } : {}),
  };
}
```

**i. Replace `homeGraph()`** with a version that no longer repeats `Organization` and
`LodgingBusiness` in full:

```ts
export function homeGraph(opts: {
  images: string[];
  reviews: Review[];
  priceRange: string;
  aggregateRating?: AggregateRatingInput | null;
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      businessRatingNode({ priceRange: opts.priceRange, aggregateRating: opts.aggregateRating }),
      vacationRentalSchema({
        image: opts.images,
        reviews: opts.reviews,
        aggregateRating: opts.aggregateRating,
      }),
    ],
  };
}
```

Keep `VacationRental` exactly as it is otherwise. §8.2 records the owner's decision to
retain it and keep its markup valid, including the eight-image minimum, the
`containsPlace` accommodation and the stable `identifier`. **Do not remove or "simplify"
any of those** — they were added deliberately on 2026-09-08.

### 3. **[AGENT]** Create `src/components/JsonLd.tsx`

```tsx
/**
 * Renders a JSON-LD block. Every structured-data script on the site goes through
 * this so the serialisation is identical everywhere.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

### 4. **[AGENT]** Render the graph in the root layout

In [src/app/layout.tsx](../src/app/layout.tsx), inside `<body>` before `<Header />`:

```tsx
<JsonLd data={siteGraph()} />
```

Next.js hoists `<script type="application/ld+json">` correctly from the body; it does not
need to be in `<head>`, and Google reads it either way.

### 5. **[AGENT]** Simplify the home page

In [src/app/page.tsx](../src/app/page.tsx):

- Replace the inline `<script type="application/ld+json">` with `<JsonLd data={jsonLd} />`.
- Drop the `description` argument from the `homeGraph()` call — the description now comes
  from `SITE.description`, not from `content.home_intro`.
- Keep the `schemaImages` construction exactly as it is. The eight-image minimum for
  `VacationRental` depends on it.

### 6. **[AGENT]** Add the phone to the footer (§6.4)

In [src/components/Footer.tsx](../src/components/Footer.tsx), under the locality line:

```tsx
{SITE.phoneDisplay && (
  <p className="mt-1">
    <a href={`tel:${SITE.phoneDisplay.replace(/[^+\d]/g, "")}`} className="hover:text-moss">
      {SITE.phoneDisplay}
    </a>
  </p>
)}
```

Also change the locality line to render the full canonical form —
`Rush Valley, UT 84069` — using `SITE.location.regionCode` and `postalCode`, so the visible
NAP matches the schema byte for byte (§6.2). Nothing renders for the phone until the owner
sets `NEXT_PUBLIC_PHONE` (Stage 00 §A).

### 7. **[AGENT]** Verify

```
npm run lint && npm run typecheck && npm test && npm run build
npm run dev
```

Check that the entity graph appears on a page that is not the home page, and that the home
page has exactly one full copy of each entity:

```
curl -s http://localhost:3000/faq   | grep -c 'application/ld+json'     # expect 1
curl -s http://localhost:3000/      | grep -c 'application/ld+json'     # expect 2
curl -s http://localhost:3000/faq   | grep -o '"@type":"[A-Za-z]*"' | sort | uniq -c
```

`/faq` should show exactly one each of `Organization`, `LodgingBusiness`, `WebSite`. The
home page adds `VacationRental` plus the merge node — that second `LodgingBusiness` with
only an `@id` is intentional, not a duplicate.

**[HUMAN]** *After deploy:* paste the live home page and one interior page into Google's
Rich Results Test and the Schema.org validator (§8.3). Both must be error-free. An agent
cannot run these — they fetch the deployed URL.

---

## Do not

- Do not fetch from Supabase in the root layout. It would add a database round trip to
  every page on the site, including 404s.
- Do not put `aggregateRating` in the layout graph. Ratings come from live data, and a
  hardcoded rating is a fabricated fact.
- Do not remove `VacationRental` or its `identifier` / `containsPlace` / eight-image
  handling — §8.2 records why they stay.
- Do not add `SearchAction` (see step 2e) or `llms.txt` (§12.5).
- Do not add a `sameAs` URL that has not been verified live by the owner.

## Acceptance criteria

- [ ] `Organization`, `LodgingBusiness` and `WebSite` render on every page including
      `/faq`, `/blog`, `/terms`.
- [ ] The home page renders `VacationRental` plus a rating merge node, and does **not**
      repeat the full `Organization` or `LodgingBusiness`.
- [ ] Schema description text comes from `SITE.description` everywhere.
- [ ] `sameAs` is absent from the output while `SITE.sameAs` is empty.
- [ ] The footer shows `Rush Valley, UT 84069`, and shows a phone number only when
      `NEXT_PUBLIC_PHONE` is set.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass.
- [ ] The site renders with no `.env.local` present.

## Commit

```
Render the business entity graph site-wide

Moves Organization + LodgingBusiness into the root layout, adds WebSite, and
leaves live pricing and ratings attached to the same @id from the home page.
Adds an empty SITE.sameAs ready for listings, and the visible NAP to the footer.
Implements SEO_PLAN.md §8.1 and the pending rows in §8.3.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
