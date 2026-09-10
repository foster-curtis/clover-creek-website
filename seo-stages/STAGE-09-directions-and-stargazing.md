# Stage 09 — Directions & stargazing pages

**Source:** SEO_PLAN.md §6.4, §6.5, §5.2, §12.3, §4.2, defect A16.

**Depends on:** Stage 03, Stage 04, Stage 08 (the nav pattern and `aboutBusinessPageSchema`
from Stage 07 are both reused here).

## Goal

Build two of the three location pages §6.5 sanctions — *"build three, not thirty"*.

- **`/stargazing`** is called *"the single highest-value new page on this plan"* (§5.2).
  Competitors are actively claiming dark skies they have less of: a Stansbury Park rental
  markets a "dark sky community" from inside the Salt Lake light dome. This property has a
  genuinely stronger claim and no page making it.
- **`/directions`** carries the distance table, which §6.4 calls *"the single most reusable
  content asset on the site"* — the same numbers get reused in schema, blog posts, OTA
  listings and directory entries.

## Who does what

| Step | Who |
|---|---|
| 1–8 (pages, data module, schema, nav) | **[AGENT]** |
| **Measuring every distance and drive time** | **[HUMAN]** — Stage 00 §A |
| Turn-by-turn route description, landmarks, "last gas" advice | **[HUMAN]** — Admin → Site Content |
| A Bortle rating or light-pollution-map reference, if one is ever obtained | **[HUMAN]** |

**The hard constraint on this stage:** §6.4 says *"Verify each figure before publishing —
these are the sort of details that get quoted back at you"*, and §12.3 says *"a wrong number
quoted back by an assistant is worse than no number."* The distance table in SEO_PLAN.md
§6.4 is mostly empty dashes for exactly this reason.

So the data module ships with a `verified` flag per row, **only verified rows render**, and
the agent seeds only the two figures already published on this site today. Everything else
stays dark until the owner measures it. The page is useful on day one and gets better
without a code change to its markup.

---

## Steps

### 1. **[AGENT]** Create `src/lib/local.ts`

```ts
/**
 * Distances and drive times from the guest house (SEO_PLAN.md §6.4). These numbers get
 * reused in schema, blog posts, OTA listings and directory entries, and assistants quote
 * them back verbatim — so a row renders only when `verified` is true.
 *
 * To add one: the owner measures it, then set the values and flip the flag. Never
 * estimate, and never infer a figure from a map without driving or routing it.
 */
export interface Destination {
  name: string;
  /** Driving distance in miles. Undefined until measured. */
  miles?: number;
  /** Typical driving time in minutes. Undefined until measured. */
  minutes?: number;
  /** What a guest actually goes there for. */
  note?: string;
  /** Only verified rows are rendered anywhere on the site. */
  verified: boolean;
}

export const DESTINATIONS: Destination[] = [
  // Verified: already published on this site today ("about an hour", "about 30 minutes").
  { name: "Salt Lake City", minutes: 60, note: "Downtown, Temple Square and the airport are all about the same drive.", verified: true },
  { name: "Tooele", minutes: 30, note: "Nearest full grocery store, gas and pharmacy.", verified: true },

  // Unverified — SEO_PLAN.md §6.4 leaves these blank deliberately. Owner measures, then
  // fill in and flip `verified`. Do not guess these.
  { name: "Salt Lake City International Airport (SLC)", verified: false },
  { name: "Grantsville", verified: false },
  { name: "Onaqui wild horse range", verified: false },
  { name: "Bonneville Salt Flats", verified: false },
  { name: "Pony Express Trail trailhead", verified: false },
  { name: "Dugway", verified: false },
  { name: "Vernon", verified: false },
];

export const VERIFIED_DESTINATIONS = DESTINATIONS.filter((d) => d.verified);

/**
 * Bortle class for the property, if it is ever measured (SEO_PLAN.md §11.3 warns that an
 * unsupported superlative is a liability). Blank means the page says nothing numeric
 * about sky darkness.
 */
export const BORTLE_CLASS = "";
```

Also export a small `formatDistance(d: Destination)` that renders whichever of miles and
minutes is present — `"55 miles · about 1 hour"`, `"about 30 minutes"` — so no caller has
to handle the undefined cases.

### 2. **[AGENT]** Add content slugs

| Slug | Label | Default |
|---|---|---|
| `directions_route` | Directions — the drive from Salt Lake City | A short, honest description of the route: southwest out of Salt Lake City, around the south end of the Oquirrh Mountains, onto Highway 199 into Rush Valley. **No exit numbers, no mile markers, no turn counts** — the agent has not driven it. |
| `directions_arrival` | Directions — arriving and parking | What to expect on arrival: a working farm, where to park, that check-in is self-service. |
| `stargazing_intro` | Stargazing — what the sky is like | Descriptive, not numeric. No town lights nearby, the fire pit as the viewing spot, letting your eyes adjust. |
| `stargazing_when` | Stargazing — best times to come | Seasonal guidance: moonless nights, the Milky Way core in summer, winter's long clear nights. Nothing that requires an almanac the agent has not checked. |

The route slug is the important one. The address is `1475 W Hwy 199, Rush Valley, UT 84069`
and that is enough to describe the route in shape, which is genuinely useful. The
turn-by-turn detail §6.4 asks for is owner knowledge — leave a clear hint on the admin
field saying so.

### 3. **[AGENT]** Build `src/app/directions/page.tsx`

- `revalidate = 3600`, `pageMetadata({ path: "/directions", title: "How to Find Us from Salt Lake City", description: … })` — description from §7.2.
- `<Breadcrumbs crumbs={[{ name: "Directions" }]} />`, `<h1>`.
- A direct-answer paragraph at the top (the `AnswerBlock` component from Stage 05), built
  from `VERIFIED_DESTINATIONS` so it states only measured figures.
- **The distance table**, rendered from `VERIFIED_DESTINATIONS` only. With two verified
  rows it is a two-row table — that is correct and honest. Do not render the unverified
  names with blank cells or "TBD"; an assistant will quote an empty cell as a fact about
  the property.
- The `directions_route` and `directions_arrival` sections under `<h2>` headings.
- `<LocationMap />` — the existing component
  ([src/components/LocationMap.tsx](../src/components/LocationMap.tsx)) already handles the
  HERE-key-or-OpenStreetMap fallback. Reuse it; do not write a second map.
- "Open in Maps" links built from `SITE.location.lat/lng`:
  - `https://maps.google.com/?q=<lat>,<lng>`
  - `https://maps.apple.com/?ll=<lat>,<lng>&q=<encoded name>`
- The full address block, and a link to `/faq#distance`.

### 4. **[AGENT]** Build `src/app/stargazing/page.tsx`

Same skeleton — metadata from §7.2 (*"Stargazing in Utah's West Desert"*), breadcrumb,
answer block, `<h2>` sections from `stargazing_intro` and `stargazing_when`.

Plus:

- A "how to use the fire pit as an observatory" section — genuinely practical, and it ties
  the differentiator to an amenity the property actually has.
- If `BORTLE_CLASS` is non-empty, render it. **If it is empty, render no numeric darkness
  claim at all** — §11.3: *"an unsupported superlative is a liability."* Qualitative
  description of what an unlit valley looks like at night is fine; a class number the owner
  has not measured is not.
- Links to `/gallery`, `/book` and `/blog` with varied, descriptive anchor text (§10.3
  rule 6).
- A link out to a public light-pollution map (e.g. lightpollutionmap.info) so a reader can
  check the claim themselves. Citing a checkable external source is one of the things that
  measurably lifts AI citation rates (§3.2).

**Do not claim DarkSky certification, a specific Bortle class, or "the darkest sky within
an hour of Salt Lake City" as fact.** That last phrase appears in §11.3 as a *pitchable
story if the claim can be substantiated* — it is a hypothesis, not a verified fact.

### 5. **[AGENT]** Schema

Reuse `aboutBusinessPageSchema()` from Stage 07 for both pages.

For `/directions`, add a `Place` node with the geo coordinates and address, referencing the
business (§8.3). Do **not** add `TouristAttraction` references to the Onaqui range, the
salt flats or the Pony Express Trail: doing that well means asserting distances that are
not yet measured, and doing it badly means claiming attractions as part of this property.
Revisit once the distances are verified.

### 6. **[AGENT]** Navigation and wiring

- `NAV_LINKS`: add `{ href: "/stargazing", label: "Stargazing" }` and
  `{ href: "/directions", label: "Directions" }`. §10.3 rule 5 requires header placement —
  it is what distinguishes a location page from a doorway page.
- **Check the nav width now.** With Home removed in Stage 08 the desktop row is: Gallery,
  About, Stargazing, Directions, Book a Stay, Reviews, Area Guide, FAQ, Contact — nine
  items plus the sign-in and booking buttons. If it wraps or crowds at 1024px, move
  "Contact" to footer-only (it is already in the footer) and note the change in the commit.
  Do not shrink the font or hide items behind a hamburger on desktop.
- Sitemap: add both routes at `priority: 0.8`.
- Footer: add both to the "The house" column.

### 7. **[AGENT]** Link from `/faq`

The distance answer on `/faq` should link to `/directions` with the anchor text
*"full turn-by-turn directions"* (§10.4). That is a one-line change to the `faq_distance`
rendering in [src/app/faq/page.tsx](../src/app/faq/page.tsx) — use the same `extra` pattern
Stage 05 established for the pets and cancellation answers rather than putting a link in
the content slug.

### 8. **[AGENT]** Verify

```
npm run lint && npm run typecheck && npm test && npm run build
npm run dev
curl -s http://localhost:3000/directions | grep -o '"@type":"[A-Za-z]*"' | sort | uniq -c
curl -s http://localhost:3000/stargazing | grep -iE 'bortle|darkest'   # expect nothing
curl -s http://localhost:3000/sitemap.xml | grep -E 'directions|stargazing'
```

Then read both pages and check every factual sentence against a source. **If you cannot say
where a number came from, delete it.**

**[HUMAN]** *After deploy:* measure the seven outstanding distances (Stage 00 §A), hand
them to an agent to fill in, and write the real route description and stargazing copy in
Admin → Site Content.

---

## Do not

- **Do not fill in an unverified distance, ever** — not from memory, not from a map, not
  "approximately". The row stays hidden.
- Do not claim a Bortle class, DarkSky certification, or a "darkest within X" superlative.
- Do not write turn-by-turn directions the agent cannot source. Route *shape* from a known
  address is fine; exit numbers and mile markers are not.
- Do not create `/hunting` in this stage. §6.5 lists it as the third location page, but the
  existing `hunting-near-rush-valley` blog post already holds that ground, and §6.5 itself
  offers "or expand the existing blog post" as the alternative. Expanding the post is Stage
  00 §F and Stage 06 work; a thin third page would be the exact mistake §6.5 warns against.
- Do not build "vacation rental near Grantsville / Vernon / Stockton" pages (§6.5).

## Acceptance criteria

- [ ] `/directions` and `/stargazing` render, with canonicals, breadcrumbs, answer blocks,
      sitemap entries, header nav links and footer links.
- [ ] The distance table shows only rows where `verified` is true — two rows on first ship.
- [ ] No unverified number, Bortle class, or superlative claim appears on either page.
- [ ] The map renders on `/directions` with and without `NEXT_PUBLIC_HERE_API_KEY`.
- [ ] `/faq` links to `/directions` from the distance answer.
- [ ] The desktop nav fits at 1024px.
- [ ] All four copy sections are editable in Admin → Site Content.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass.

## Commit

```
Add the directions and stargazing pages

Two of the three location pages sanctioned by SEO_PLAN.md §6.5. Introduces
src/lib/local.ts, where each distance carries a `verified` flag and only
verified rows render — the two figures already published on the site ship
verified, the other seven stay hidden until measured. No Bortle class or
darkness superlative is claimed without a source.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
