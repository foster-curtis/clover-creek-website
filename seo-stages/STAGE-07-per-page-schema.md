# Stage 07 — Per-page schema

**Source:** SEO_PLAN.md §8.3 table, defect A7.

**Depends on:** Stage 03 (`JsonLd`, `SCHEMA_IDS`, merge-node pattern), Stage 04
(breadcrumbs already on these pages), Stage 05 (`FAQPage` is done there, not here),
Stage 06 (posts are `.mdx` files, so `BlogPosting` is written once against the final data
source — covers and bylines included, rather than against database rows that are about to
be retired).

## Goal

Close out the §8.3 table. Today structured data exists on the home page only; `/reviews`
(19 real reviews), `/blog`, all thirteen posts, `/gallery`, `/house-rules` and `/book`
carry none (defect A7).

## Who does what

| Step | Who |
|---|---|
| 1–7 (all code) | **[AGENT]** |
| Validating the deployed pages | **[HUMAN]** — Rich Results Test + Schema.org validator |

The validators fetch a deployed URL, so an agent cannot run them. §8.3: *"Validate
everything at the Rich Results Test and Schema.org validator after deploy, and watch
Search Console's Enhancements reports for two weeks afterwards."*

---

## Steps

All builders go in [src/lib/schema.ts](../src/lib/schema.ts) and all rendering goes through
`<JsonLd>`. Each page gets **one** additional JSON-LD block on top of the site-wide graph
and its breadcrumb.

### 1. **[AGENT]** `/reviews` — the 19 reviews

`reviewNode()` already exists in `schema.ts` (used by `VacationRental`). Reuse it; do not
write a second one.

```ts
/**
 * Reviews attached to the site-wide business entity by @id, so the reviews page
 * enriches the same node the layout emits rather than declaring a second business.
 */
export function reviewsPageGraph(opts: {
  reviews: Review[];
  aggregateRating?: AggregateRatingInput | null;
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LodgingBusiness",
        "@id": SCHEMA_IDS.business,
        ...(opts.aggregateRating ? { aggregateRating: aggregateRating(opts.aggregateRating) } : {}),
        review: opts.reviews.map(reviewNode),
      },
    ],
  };
}
```

Render it in [src/app/reviews/page.tsx](../src/app/reviews/page.tsx) from the reviews it
already fetches. Emit **all** approved reviews here (the home page caps at 12 deliberately;
this is the reviews page, so the full set belongs).

> Reviews an entity collects about itself are self-serving under Google policy and will
> never render stars (§3.1, defect A6). This markup is for machine readability, and it is
> retained deliberately per §8.1. Do not report it as a stars-in-search win.

### 2. **[AGENT]** `/blog` — `Blog` + `ItemList`

Helps crawlers see the thirteen posts as one body of work rather than thirteen orphans
(§8.3).

```ts
export function blogIndexSchema(posts: PostMeta[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${SITE.url}/blog#blog`,
    name: "Rush Valley Area Guide",
    url: absoluteUrl("/blog"),
    publisher: { "@id": SCHEMA_IDS.org },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      "@id": `${absoluteUrl(`/blog/${p.slug}`)}#post`,
      headline: p.title,
      url: absoluteUrl(`/blog/${p.slug}`),
      description: p.excerpt,
      datePublished: p.publishedAt,
    })),
  };
}
```

`title`, `excerpt` and `publishedAt` are required in `PostMeta`, so none of the optional
spreading the database version needed applies here — that is one of the small wins of
Stage 06.

Using `@id`s that match the individual post pages means the two representations are
understood as the same articles.

### 3. **[AGENT]** `/blog/[slug]` — `BlogPosting` (currently missing on all 13 posts)

Takes `PostMeta` from the Stage 06 registry, so every field is real data rather than a
placeholder:

```ts
import type { PostMeta } from "@/content/blog/types";

export function blogPostingSchema(meta: PostMeta) {
  const url = absoluteUrl(`/blog/${meta.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#post`,
    headline: meta.title.slice(0, 110),      // Google truncates beyond ~110 chars
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    description: meta.excerpt,
    datePublished: meta.publishedAt,
    dateModified: meta.updatedAt ?? meta.publishedAt,
    image: meta.cover ? `${SITE.url}${meta.cover.src.src}` : OG_IMAGE_URL,
    publisher: { "@id": SCHEMA_IDS.org },
    author: postAuthor(meta),
    isPartOf: { "@id": `${SITE.url}/blog#blog` },
    inLanguage: "en-US",
  };
}
```

Three fields worth care:

- **`author`** — a small `postAuthor(meta)` helper with three cases, in order: the `Person`
  `@id` when `meta.author` matches `SITE.owner.name` and Stage 08 has supplied a real name;
  a plain `{ "@type": "Person", name: meta.author }` when the post carries a byline that
  does not match the site owner; the Organization `@id` when there is no byline at all.
  **Never invent a byline** — an unbylined post gets the Organization, which is valid
  markup and honest.
- **`image`** — `meta.cover.src` is a static import, so `.src` is the emitted path and
  needs `SITE.url` prefixed to become absolute. Falls back to the site OG image on posts
  that have no cover yet, which will be most of them until the owner's photographs arrive
  (Stage 00 §F).
- **`dateModified`** — `meta.updatedAt` when the post has genuinely been revised, otherwise
  it mirrors `datePublished`. **Do not set it to the build date or to today.** A post that
  claims to be modified every deploy is a freshness signal that is simply false.

### 4. **[AGENT]** `/gallery` — `ImageGallery` + `ImageObject`

```ts
export function imageGallerySchema(images: Array<{ src: string; alt: string; caption: string | null }>) {
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    "@id": `${SITE.url}/gallery#gallery`,
    name: `Photos of ${SITE.name}`,
    url: absoluteUrl("/gallery"),
    about: { "@id": SCHEMA_IDS.business },
    associatedMedia: images.map((img) => ({
      "@type": "ImageObject",
      contentUrl: img.src,
      ...(img.caption ? { caption: img.caption } : {}),
      description: img.alt,
      creator: { "@id": SCHEMA_IDS.org },
      copyrightNotice: SITE.name,
    })),
  };
}
```

The `description` values are only as good as the alt text in the database, which is empty
for all fifteen rows today (defect A3). That is Stage 00 §C human work — this markup starts
paying off the moment the owner rewrites them, with no further code change.

### 5. **[AGENT]** `/house-rules` — `WebPage` about the business

Ties the pet policy to the entity, which is what makes "dog friendly rental Utah pet
policy" resolvable (§4.2, §8.3):

```ts
export function aboutBusinessPageSchema(opts: { path: string; name: string; description: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${absoluteUrl(opts.path)}#webpage`,
    url: absoluteUrl(opts.path),
    name: opts.name,
    description: opts.description,
    about: { "@id": SCHEMA_IDS.business },
    isPartOf: { "@id": SCHEMA_IDS.website },
  };
}
```

Make it generic — Stage 09 reuses it for `/directions` and `/stargazing`.

### 6. **[AGENT]** `/book` — `Offer`

Real prices from the live pricing config, never hardcoded:

```ts
export function bookingOfferSchema(pricing: PricingConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "AggregateOffer",
    "@id": `${SITE.url}/book#offer`,
    url: absoluteUrl("/book"),
    priceCurrency: "USD",
    lowPrice: pricing.weekdayBase,
    highPrice: pricing.weekendBase,
    offerCount: 2,
    availability: "https://schema.org/InStock",
    itemOffered: { "@id": SCHEMA_IDS.rental },
    seller: { "@id": SCHEMA_IDS.org },
  };
}
```

`lowPrice`/`highPrice` are the two-guest base rates, matching what the page displays.
Extra-guest and pet fees are not part of the base offer — do not fold them in, and do not
claim a total price the booking engine would not quote.

### 7. **[AGENT]** Gallery captions in the grid (§9.6)

Not schema, but it belongs with the `/gallery` work above and it is a ten-line change.

In [src/components/GalleryGrid.tsx](../src/components/GalleryGrid.tsx), show the caption
under each thumbnail when one exists — captions currently appear only in the lightbox, and
*"caption text is a real ranking signal for Google Images."*

Keep the tile height stable when a caption is absent, keep the whole tile clickable, and
keep the existing ``aria-label={`View photo: ${img.alt}`}``.

Captions are empty for every row today. Filling them is Stage 00 §C human work, and this
change is what makes that work visible.

### 8. **[AGENT]** Verify

```
npm run lint && npm run typecheck && npm test && npm run build
npm run dev
for p in reviews blog gallery house-rules book; do
  echo "--- /$p"; curl -s "http://localhost:3000/$p" | grep -o '"@type":"[A-Za-z]*"' | sort | uniq -c
done
```

Each page should show the site-wide three, its breadcrumb, and exactly one new type. Then
paste each page's JSON-LD into <https://validator.schema.org/> — that validator accepts
pasted markup, so it works before deploy. Fix every error and every warning that is not a
deliberate omission documented above.

**[HUMAN]** *After deploy:* run each page through Google's Rich Results Test, then watch
Search Console → Enhancements for two weeks (§8.3).

---

## Do not

- Do not re-declare `Organization` or `LodgingBusiness` in full on any of these pages.
  Reference them by `@id` — that is why Stage 03 exported `SCHEMA_IDS`.
- Do not add `FAQPage` here; Stage 05 owns it.
- Do not invent `dateModified`, author names, image URLs, or a `priceValidUntil`.
- Do not add `Product` or `Offer` markup that implies stars or price snippets the site is
  not eligible for (§3.1).
- Do not emit an `ImageObject` for placeholder gallery art when Supabase is unconfigured —
  check that the images came from the database, or accept that a zero-config local render
  describes placeholder SVGs. Prefer skipping the block entirely when `getGallery()`
  returns the placeholder set.

## Acceptance criteria

- [ ] `/reviews` emits every approved review, attached to the business `@id`.
- [ ] `/blog` emits `Blog` with one `BlogPosting` entry per published post.
- [ ] `/blog/[slug]` emits `BlogPosting` built from `PostMeta`, with a cover image when the
      post has one and the Organization as author when it has no byline.
- [ ] `/gallery` emits `ImageGallery` with one `ImageObject` per real photo.
- [ ] Gallery captions are visible in the grid without shifting the layout.
- [ ] `/house-rules` emits `WebPage` with `about` → the business.
- [ ] `/book` emits `AggregateOffer` with prices read from the pricing config.
- [ ] No page re-declares the business entity in full.
- [ ] validator.schema.org reports no errors for any of the six pages.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass.

## Commit

```
Add per-page structured data to reviews, blog, gallery, rules and booking

Review, Blog + ItemList, BlogPosting, ImageGallery, WebPage and AggregateOffer,
each referencing the site-wide entity by @id rather than re-declaring it.
BlogPosting reads the MDX post metadata, so covers and bylines are wired from
the start. Also makes gallery captions visible in the grid.
Fixes SEO_PLAN.md defect A7 and completes the §8.3 table apart from the pages
that do not exist yet.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
