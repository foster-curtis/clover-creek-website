# Stage 10 — Internal linking & metadata rewrites

**Source:** SEO_PLAN.md §10.2–10.4, §7.2, §12.3.

**Depends on:** Stage 01 (`pageMetadata`), Stage 06 (posts are `.mdx`), Stage 08
(`/about` exists), Stage 09 (`/directions` and `/stargazing` exist). All three page targets
must be live before this stage links to them.

## Goal

Turn a flat hub-and-spoke into a hierarchy with topical clusters, and sharpen every title
and description.

§10.1: *"Every page is one hop from every other page, so nothing signals which pages matter
most, and the thirteen posts do not read as a coherent body of local expertise."*

## Who does what

| Step | Who |
|---|---|
| 1–6 (all code) | **[AGENT]** |

Entirely agent work. Stage 06 moved the posts into the repo, so nothing here needs database
access or owner input.

## Two kinds of link, handled two different ways

§10.3 asks for cluster links and booking links inside post bodies. Since Stage 06 those are
editable — a `.mdx` file takes a `<Link>` anywhere. But "can" is not "should", and the two
kinds of link want different treatment:

- **Systematic links** — the "more from this cluster" block and the booking CTA that every
  post needs (§10.3 rules 1 and 2) — are **rendered by the page component** from a cluster
  map. Thirteen hand-written link blocks would be thirteen things to update whenever a post
  is added, renamed or unpublished. One map is not.
- **Contextual links** — a sentence in the Onaqui post that naturally points at
  `/stargazing` — belong **in the prose**, inside the MDX, where the surrounding sentence
  gives them meaning. These land during the per-post content expansion that follows the
  stages, not here.

This stage builds the first kind and the §10.4 site-page links. It does not touch post
prose.

---

## Steps

### 1. **[AGENT]** Get the real post slugs

§10.2 lists cluster members in shorthand (`onaqui-wild-horses`), while §4.2 shows fuller
slugs (`onaqui-wild-horses-rush-valley`, `bonneville-salt-flats-guide`,
`pony-express-trail-guide`, `tooele-utah-guide`). **Do not guess** — read them off the
filesystem:

```
ls src/content/blog/*.mdx
```

Those filenames are the slugs, and the registry in `src/content/blog/index.ts` is the
authoritative list.

### 2. **[AGENT]** Create `src/lib/clusters.ts`

The four clusters from §10.2:

```ts
/**
 * Topic clusters for the Area Guide (SEO_PLAN.md §10.2). Grouping the posts is what
 * turns thirteen isolated pages into a recognised topical authority on Utah's west
 * desert (§10.3 rule 2).
 *
 * Slugs are matched against what the registry actually exports — a post that is
 * marked `draft` or removed simply drops out of the related list rather than 404ing.
 */
export interface Cluster {
  id: string;
  label: string;
  slugs: string[];
}

export const CLUSTERS: Cluster[] = [
  { id: "wildlife", label: "Wildlife & landscape",       slugs: [/* … */] },
  { id: "history",  label: "History & heritage",         slugs: [/* … */] },
  { id: "towns",    label: "Towns & everyday logistics", slugs: [/* … */] },
  { id: "seasonal", label: "Seasonal & local life",      slugs: [/* … */] },
];

/**
 * Sibling posts to show under a post. Falls back to the most recent other posts when
 * the current post is in no cluster, so a newly authored post is never left with an
 * empty block.
 */
export function relatedPosts<T extends { slug: string }>(currentSlug: string, published: T[], limit = 3): T[] {
  const cluster = CLUSTERS.find((c) => c.slugs.includes(currentSlug));
  const bySlug = new Map(published.map((p) => [p.slug, p]));
  const siblings = cluster
    ? cluster.slugs.filter((s) => s !== currentSlug).map((s) => bySlug.get(s)).filter((p): p is T => Boolean(p))
    : [];
  if (siblings.length >= limit) return siblings.slice(0, limit);
  const filler = published.filter((p) => p.slug !== currentSlug && !siblings.includes(p));
  return [...siblings, ...filler].slice(0, limit);
}
```

Fill the `slugs` arrays with the **real** slugs from step 1, grouped per §10.2. A slug that
does not match a file in `src/content/blog/` does not belong here.

> A `cluster` field in each post's `meta` would be an equally valid design now that posts
> are files. Keep the central map: §10.2 expresses the taxonomy as four groups with labels
> and an order, and one file that shows the whole shape is easier to reason about — and to
> rebalance — than the same information smeared across thirteen.

### 3. **[AGENT]** Related posts and a booking CTA on every post

In [src/app/blog/\[slug\]/page.tsx](../src/app/blog/[slug]/page.tsx), after the rendered
body:

- **"More from the Area Guide"** — up to three sibling posts from `relatedPosts()`, each as
  a card with title and excerpt. Label the block with the cluster name when there is one
  (§10.3 rule 2, rule 3). This requires fetching the published list alongside the post;
  `getPublishedPosts()` already exists, so use `Promise.all`.
- **A booking CTA** linking to `/book` (§10.3 rule 1: *"every blog post links to `/book` at
  least once, with descriptive anchor text — not 'click here'"*).

**Vary the anchor text** (§10.3 rule 6): *"Ten posts all linking with 'book your stay' is a
weaker signal than a mix."* Pick deterministically from the slug so it is stable across
renders — e.g. hash the slug into a small array of phrasings:

```ts
const CTA_PHRASES = [
  "check dates for your stay",
  "see our nightly rates",
  "look at what is available",
  "base yourself here for the trip",
  "book the farmhouse direct",
];
```

Render nothing at all when there are no other published posts — an empty "More from the
Area Guide" heading is worse than no heading.

### 4. **[AGENT]** Homepage: link down to the strongest posts (§10.3 rule 4)

Add a **"Guides to the valley"** section to [src/app/page.tsx](../src/app/page.tsx),
between the reviews teaser and the area/map section, linking to three or four posts *by
name*. This passes real authority to the pages most likely to earn AI citations.

Select them from `getPublishedPosts()` — prefer a `FEATURED_GUIDE_SLUGS` list in
`clusters.ts` (the Onaqui, salt flats and Pony Express posts are the §4.3 Cluster 3
priorities), falling back to the most recent posts when a featured slug is not published.
Render nothing if the list comes back empty, so a zero-config build still renders a clean
home page.

### 5. **[AGENT]** The §10.4 link table

Add each of these with the given anchor text. All are contextual, in-body links — not nav,
not footer.

| From | To | Anchor text |
|---|---|---|
| `/` | `/stargazing` | `some of the darkest skies within an hour of Salt Lake City` |
| `/` | `/about` | `the family who runs the farm` |
| `/` | `/directions` | `an hour from Salt Lake City — here is the drive` |
| `/faq` (distance answer) | `/directions` | `full turn-by-turn directions` — done in Stage 09, verify it is there |
| `/house-rules` | `/faq` | `other common questions` |
| `/gallery` | `/book` | `check dates for these rooms` |
| `/reviews` | `/book` | `book the same stay` |
| `/stargazing` | `/gallery`, `/book` | contextual — done in Stage 09, verify |

The homepage links belong in prose, in the existing intro and area sections — not stacked
in a row of buttons. A link inside a sentence carries context that a button does not.

The `/` → Onaqui post link from §10.4 is covered by the "Guides to the valley" section in
step 4; do not add a second hardcoded one, since a hardcoded slug 404s if the post is
unpublished.

### 6. **[AGENT]** Rewrite titles and descriptions (§7.2)

Now that `pageMetadata()` is everywhere (Stage 01), this is a string change per page. Use
§7.2's table verbatim:

| Page | Title (before the ` — Clover Creek Guest House` suffix) |
|---|---|
| `/` | `Rush Valley Utah Farm Stay` — note the home page uses the **full** title from §7.2 with no suffix; set `title: { absolute: "Rush Valley Utah Farm Stay — Clover Creek Guest House" }` |
| `/book` | `Check Availability & Book Direct` |
| `/gallery` | `Photos of the Farmhouse & Valley` |
| `/reviews` | `Guest Reviews` |
| `/faq` | `FAQ — Check-in, Pets, Wi-Fi & Directions` |
| `/house-rules` | `House Rules & Dog Policy` |
| `/blog` | `Rush Valley Area Guide` |
| `/about` | `About Us & the Farm` |
| `/directions` | `How to Find Us from Salt Lake City` |
| `/stargazing` | `Stargazing in Utah's West Desert` |
| `/contact` | `Contact Us` |

Descriptions come from the same table. Two rules to check against, not just paste (§7.1):

- **Titles: 50–60 characters *including* the suffix.** The template in `layout.tsx` appends
  `— Clover Creek Guest House` (26 characters), so a page title over ~32 characters gets
  truncated in the SERP. Several current ones overflow. Count them.
- **Descriptions: 140–160 characters.** Count these too.

§7.2's `/reviews` description says "all 19 reviews". **Do not hardcode 19** — build the
sentence from the review count the page already fetches, or omit the number. A count that
drifts is a wrong fact on the page.

**Blog post titles are now editable too** — they are `meta.title` in the `.mdx` files. §7.2
flags *"The Pony Express Trail: Ride Utah's West Desert History from Rush Valley"* as
rendering at 103 characters with the suffix and getting cut, and suggests
`Pony Express Trail: Utah's West Desert Ride`. Apply the §7.2 pattern —
`{Topic}: {Specific Hook}`, under ~55 characters — to any post title that overflows.

Two cautions:

- **Changing `meta.title` does not change the slug**, and it must not. The URL stays,
  the `<h1>` and `<title>` change.
- A title is the owner's words about a place they know. Shortening for length is fine;
  re-angling the topic is not. If a shorter title would change what the post is *about*,
  leave it and flag it for the owner.

### 7. **[AGENT]** Verify

```
npm run lint && npm run typecheck && npm test && npm run build
npm run dev
curl -s http://localhost:3000/ | grep -o 'href="/blog/[a-z0-9-]*"' | sort -u
curl -s http://localhost:3000/blog/<slug> | grep -o 'href="/book"' | wc -l
```

Then click every link added in step 5 in a browser. **A 404 from an internal link is worse
than no link** — it wastes crawl budget and signals neglect. Since Stage 06 the posts no
longer need Supabase, so this check works fully with no `.env.local` present.

Check the rendered `<title>` lengths:

```
curl -s http://localhost:3000/faq | grep -o '<title>[^<]*</title>'
```

---

## Do not

- **Do not rewrite post prose in this stage.** The `.mdx` files are editable now, which
  makes it tempting. Expanding and enriching the posts (§9.5) is real content work that
  deserves its own commits and its own review — mixing it into a linking-and-metadata diff
  hides it. Titles are the one exception, per step 6.
- Do not hardcode a blog slug in a `<Link>` without checking it is in the registry.
- Do not add a keyword-stuffed footer link block (§13.3).
- Do not use "click here", "read more", or "book now" as anchor text for the links in
  step 5 — descriptive anchors are the point (§10.3 rule 1 and rule 6).
- Do not hardcode the review count, the post count, or any price into a meta description.
- Do not change page `<h1>` text in this stage. Titles and descriptions only; the headings
  are already correct and changing both at once makes the diff unreviewable.

## Acceptance criteria

- [ ] Every published post renders up to three cluster siblings and one `/book` link with
      varied, descriptive anchor text.
- [ ] The home page has a "Guides to the valley" section linking to real posts by name, and
      renders cleanly when no posts exist.
- [ ] Every link in the §10.4 table resolves — no 404s.
- [ ] Titles fit in 50–60 characters including the brand suffix; descriptions in 140–160.
- [ ] No count or price is hardcoded into a description.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass.

## Commit

```
Add topic clusters, contextual links and sharpened metadata

Related-post blocks and booking CTAs are rendered around post bodies from a
cluster map, so the thirteen posts read as one body of local expertise without
any database edits. Adds the §10.4 contextual links and rewrites every title
and description per §7.2. Implements SEO_PLAN.md §10.2-10.4 and §7.2.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
