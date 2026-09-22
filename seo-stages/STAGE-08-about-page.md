# Stage 08 — About page & Person entity

**Source:** SEO_PLAN.md §12.4, §6.4, §8.3, §3.1, defects A8 and A16.

**Depends on:** Stage 03 (`JsonLd`, `SCHEMA_IDS`), Stage 04 (breadcrumbs).

## Goal

Build the page AI engines use to decide a business is real, and Google uses to judge
Experience — the first "E" in E-E-A-T, which the March 2026 core update amplified (§3.1).

SEO_PLAN.md calls this *"the biggest E-E-A-T lever available, and it is free"* (§16) and
*"one of the highest-leverage pages a small lodging site can have"* (§1, defect A8).

## Who does what

| Step | Who |
|---|---|
| 1–7 (page, schema, nav, wiring) | **[AGENT]** |
| The owner's real name | **[HUMAN]** — Stage 00 |
| A photograph of the owner or family | **[HUMAN]** — dropped in as `public/about-owner.jpg` |
| The story: how the farmhouse became a guest house, how long they have hosted, why the valley | **[HUMAN]** — Admin → Site Content, after deploy |

**This is the split that matters most in the whole plan.** The agent can build the page,
the markup and the navigation. It absolutely cannot supply the content — a fabricated owner
name or invented family history would be a lie published under a real business's name, and
it would poison the exact entity signal this page exists to create.

So the page is built to **degrade honestly**: with no name set, it renders the story
without a byline and emits no `Person` node at all. Nothing is fake, nothing is broken, and
the moment the owner supplies a name it all switches on.

---

## Steps

### 1. **[AGENT]** Add the owner identity to `SITE`

In [src/lib/site.ts](../src/lib/site.ts):

```ts
// The named human behind the business. E-E-A-T and AI entity resolution both weight
// a real name, a real photo and a real story heavily (SEO_PLAN.md §12.4) — but a
// fabricated one is far worse than none, so every field here is optional and each
// suppresses its own markup when blank. Filled in by the owner, never guessed.
owner: {
  name: "",                    // e.g. "Jane Doe" — leave blank until the owner confirms
  role: "Host",
  /** Path under /public. Leave blank until a real photo exists. */
  photo: "",                   // e.g. "/about-owner.jpg"
} as { name: string; role: string; photo: string },
```

Type it as a mutable-shaped object rather than letting `as const` narrow the empty strings
to literal `""` types, or every comparison against it becomes a type error.

### 2. **[AGENT]** Add three content slugs

In [src/lib/content.ts](../src/lib/content.ts), added to `CONTENT_SLUGS` and
`DEFAULT_CONTENT`:

| Slug | Label | Default |
|---|---|---|
| `about_story` | About — our story | A short, honest paragraph that claims nothing specific: that the farmhouse sits on a working family farm in Rush Valley and is rented to guests a few at a time. **No dates, no names, no invented history.** |
| `about_valley` | About — why this valley | A paragraph about Rush Valley itself, adapted from the existing `area` copy but not copied verbatim (near-duplicate blocks across pages get suppressed, §3.1). |
| `about_hosting` | About — what to expect as a guest | What a stay is actually like: self check-in, quiet, dark, a working farm around you. |

Write the defaults in the site's existing voice. Every default must remain true no matter
who the owner turns out to be — that is the test for whether a sentence belongs there.

### 3. **[AGENT]** Build `src/app/about/page.tsx`

- `export const revalidate = 3600;`
- `export const metadata = pageMetadata({ path: "/about", title: "About Us & the Farm", description: ... })` — description from §7.2: *"Meet the family behind Clover Creek Guest House, how the farmhouse came to be a guest house, and what a stay in Rush Valley is really like."*
- `<Breadcrumbs crumbs={[{ name: "About" }]} />`
- `<h1>About Clover Creek Guest House</h1>`
- The three content sections, each under its own `<h2>`.
- **Conditionally**, when `SITE.owner.name` is set: a byline block — name, role, and the
  photo if `SITE.owner.photo` is set, via `next/image` with real `width`/`height` and
  descriptive alt text.
- A visible NAP block: name, `Rush Valley, UT 84069`, email, and phone when set. This page
  is where a directory reviewer or an AI crawler looks to confirm the business is real
  (§6.4).
- Contextual links out to `/book`, `/gallery` and `/blog` with descriptive anchor text.

**When `SITE.owner.name` is empty**, render the story sections and the NAP block and
nothing else. Do not render "Your Name Here", a silhouette avatar, or any other placeholder
that implies missing content — an absent byline is invisible; a placeholder byline looks
like an abandoned site.

### 4. **[AGENT]** `Person` and `AboutPage` schema

In [src/lib/schema.ts](../src/lib/schema.ts):

```ts
const PERSON_ID = `${SITE.url}/about#person`;

/**
 * The named host. Returns null when no name is configured — an anonymous or
 * placeholder Person node is worse than no node (SEO_PLAN.md §12.4).
 */
export function personSchema() {
  if (!SITE.owner.name) return null;
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: SITE.owner.name,
    jobTitle: SITE.owner.role,
    worksFor: { "@id": ORG_ID },
    ...(SITE.owner.photo ? { image: `${SITE.url}${SITE.owner.photo}` } : {}),
    url: absoluteUrl("/about"),
  };
}

export function aboutPageGraph(opts: { description: string }) {
  const person = personSchema();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${SITE.url}/about#webpage`,
        url: absoluteUrl("/about"),
        name: `About ${SITE.name}`,
        description: opts.description,
        about: { "@id": SCHEMA_IDS.business },
        isPartOf: { "@id": SCHEMA_IDS.website },
      },
      ...(person ? [person] : []),
    ],
  };
}
```

Add `person: PERSON_ID` to the exported `SCHEMA_IDS` so Stage 06's blog bylines can
reference it.

Also: when a `Person` exists, add `founder: { "@id": PERSON_ID }` to `organizationSchema()`
and `employee: { "@id": PERSON_ID }` to `lodgingBusinessSchema()` — conditionally, in both
cases. That is what connects the human to the business across the whole site.

### 5. **[AGENT]** Navigation (§10.3 rule 5, defect A16)

*"Nav placement is what distinguishes a legitimate location page from a doorway page."*

In `NAV_LINKS` in [src/lib/site.ts](../src/lib/site.ts):

- **Remove `{ href: "/", label: "Home" }`.** The logo in `<Header>` already links home, and
  three new pages are arriving across this stage and Stage 09 — the desktop nav will not
  hold ten items.
- Add `{ href: "/about", label: "About" }` after Gallery.

Check the result at 1024px and 1280px widths. `<Header>` renders the nav at `lg:flex` and
`<MobileNav>` handles narrow screens, so both need a look. If the desktop row is tight
*after Stage 09 adds two more*, that is Stage 10's problem to solve — do not pre-emptively
restructure the nav here.

### 6. **[AGENT]** Wire the page in

- **Sitemap** — add `/about` to the static list in
  [src/app/sitemap.ts](../src/app/sitemap.ts) at `priority: 0.8`. It is a top-level trust
  page, more important than a blog post.
- **Footer** — add "About us" to the first column in
  [src/components/Footer.tsx](../src/components/Footer.tsx).
- Home-page and cross-page links to `/about` are Stage 10 (§10.4).

### 7. **[AGENT]** Verify

```
npm run lint && npm run typecheck && npm test && npm run build
npm run dev
curl -s http://localhost:3000/about | grep -o '"@type":"[A-Za-z]*"' | sort | uniq -c
curl -s http://localhost:3000/about | grep -i 'rel="canonical"'
curl -s http://localhost:3000/sitemap.xml | grep about
```

With `SITE.owner.name` empty: `AboutPage` appears, `Person` does not, and the page reads
as a complete page rather than a stub. Then set a test name locally, confirm the `Person`
node and byline appear, and **revert the test value before committing**.

**[HUMAN]** *After deploy:* set the real name in `SITE.owner` (hand it to an agent — it is
a one-line change), drop `public/about-owner.jpg` in, and write the three story sections in
Admin → Site Content.

---

## Do not

- **Do not invent the owner's name, family details, how long they have hosted, or how the
  farmhouse came to be a guest house.** This is the single hardest rule in the plan to
  follow, because the page reads like it wants a story. Write around the gap instead.
- Do not use a stock photo of a person, a generated portrait, or an avatar illustration.
  §9.5's point about original photography applies double to a face.
- Do not add `Person` markup without a real name.
- Do not copy the `area` content slug verbatim into `about_valley` — near-duplicate blocks
  get suppressed (§3.1).
- Do not add `/about` to the header nav *and* leave "Home" in it. Check the nav width.

## Acceptance criteria

- [ ] `/about` renders, is in the sitemap, has a canonical, a breadcrumb and a footer link.
- [ ] The three story sections are editable in Admin → Site Content.
- [ ] With no owner name set: no `Person` node, no placeholder byline, page still reads as
      complete.
- [ ] With a name set: `Person` node emitted, byline visible, `founder`/`employee`
      references appear on the site-wide entities.
- [ ] "About" is in the header nav and "Home" has been removed; the nav fits at 1024px.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass.
- [ ] No invented biographical fact appears anywhere in the diff.

## Commit

```
Add the About page and optional Person entity

Builds /about with owner-editable story sections, a visible NAP block, and
AboutPage markup. The Person node, byline and photo are emitted only when a
real owner name and photo are configured — never placeholders. Adds About to
the nav, footer and sitemap. Fixes SEO_PLAN.md defect A8 and part of A16.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
