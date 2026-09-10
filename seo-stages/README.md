# SEO Implementation Stages

Executable breakdown of [SEO_PLAN.md](../SEO_PLAN.md). The strategy document explains
*why*; these files say *what to change, in what order, and who does it*.

Each stage is a self-contained unit of work: one agent runs it, one reviewer reviews it,
one commit lands it. **Every stage leaves the site fully functional and deployable** — no
stage depends on a later stage to compile, render, or build.

## Stage order

| # | Stage | Depends on | Who runs it | Est. |
|---|---|---|---|---|
| 00 | [Owner prerequisites & off-site work](STAGE-00-owner-prerequisites.md) | — | **Human only** — no code | 1 hr + ongoing |
| 01 | [Canonical URLs & crawl hygiene](STAGE-01-canonical-and-crawl-hygiene.md) | — | Agent + 1 human step (Vercel redirect) | ~2 hr |
| 02 | [Social share images](STAGE-02-social-images.md) | 01 | Agent (human may swap the photo later) | ~1.5 hr |
| 03 | [Site-wide entity schema](STAGE-03-sitewide-entity-schema.md) | 02 | Agent only | ~2 hr |
| 04 | [Breadcrumbs](STAGE-04-breadcrumbs.md) | 03 | Agent only | ~1.5 hr |
| 05 | [FAQ rebuild & direct-answer blocks](STAGE-05-faq-and-answer-blocks.md) | 03 | Agent + human answer review | ~3 hr |
| 06 | [**Blog → MDX**](STAGE-06-blog-to-mdx.md) | 01, 04 | Agent; human skims the converted posts | ~4 hr |
| 07 | [Per-page schema](STAGE-07-per-page-schema.md) | 03, 04, 05, 06 | Agent + human validation run | ~3 hr |
| 08 | [About page & Person entity](STAGE-08-about-page.md) | 03, 04 | Agent builds; **human supplies name, photo, story** | ~2.5 hr |
| 09 | [Directions & stargazing pages](STAGE-09-directions-and-stargazing.md) | 03, 04, 08 | Agent builds; **human supplies verified distances** | ~3 hr |
| 10 | [Internal linking & metadata rewrites](STAGE-10-internal-linking-and-metadata.md) | 01, 06, 08, 09 | Agent only | ~2.5 hr |

Stages 01–07 are the highest-return work in the plan (SEO_PLAN.md §15: *"Phases 1 and 2 are
where the return is concentrated"*). Stage 00 runs in parallel with all of them and blocks
nothing in code — every code stage is written to degrade gracefully while the owner's
decisions are outstanding.

```
00   human track — runs in parallel throughout, blocks nothing

01 ─> 02 ─> 03 ─> 04 ─┬─> 05 ─┐
                      ├─> 06 ─┴─> 07
                      └─> 08 ─> 09 ─┐
                          06 ───────┴─> 10
```

## After the stages: the content push

Stages 01–10 are plumbing. The work that actually moves rankings comes next, and Stage 06
is what makes it affordable:

- **Expand the thirteen posts to 800–1,200 words with original photos** (§9.5, defect A9).
  Post-by-post commits, drafted from the owner's first-hand knowledge, reviewed as diffs.
- **Add first-hand framing and direct-answer blocks** to each post (§12.1, §12.4).
- **Publish one new post a month** against the seasonal calendar (§4.4).

None of that needs a new stage file — once the posts are `.mdx` files it is ordinary
content work in the repo.

## Who does what

Work in this plan splits into two kinds, and every stage file opens with its own
**Who does what** table:

- **[AGENT]** — changes inside this repository: files, code, migrations, generated assets.
  A coding agent does these end to end and commits them.
- **[HUMAN]** — work outside the codebase: decisions only the owner can make, accounts only
  the owner can hold, photographs only the owner can take, and third-party consoles
  (Vercel, Google Search Console, Supabase Studio, Yelp, and the site's own `/admin` panel).
  **An agent must never attempt these, invent their inputs, or mark them done.**

Individual steps carry the same markers inline. Where a stage has human steps, it states
explicitly what ships without them — in every case the answer is "a working site, with that
one piece suppressed until the human input arrives."

Stage 00 is entirely human. Stages 03, 04 and 10 are entirely agent. The rest are agent
work with a named human contribution that can arrive before or after the code lands.

**A note on the `/admin` panel.** Editing site copy, gallery alt text and photos happens in
a browser against the live database. That is human work even though it looks like content
work an agent could do — agents must not write to Supabase. From Stage 06 onward, **blog
posts are the exception**: they live in the repo, so they are agent work.

## Ground rules for every stage

These apply to all code stages. Re-read them before starting one.

1. **Never invent a fact.** Distances, drive times, Bortle ratings, owner names, phone
   numbers, square footage, animal counts, local history. If a value is not already
   published on this site or stated in SEO_PLAN.md, it does not get rendered. The pattern
   throughout these stages is a `verified: false` flag or an empty constant that suppresses
   the markup entirely — an omitted number is always better than a wrong one, because
   assistants quote these numbers back verbatim (SEO_PLAN.md §12.3).
   **This rule gets sharper after Stage 06:** blog bodies become editable by agents, and
   they are full of local claims that only the owner can source.
2. **The site must build and render with zero environment variables.** `src/lib/data.ts`
   and `src/lib/content.ts` already degrade to placeholders when Supabase is absent, and
   from Stage 06 the blog does not need Supabase at all. Any new page must render sensibly
   in that state.
3. **NAP lives in exactly two places** — `SITE` in [src/lib/site.ts](../src/lib/site.ts)
   and the builders in [src/lib/schema.ts](../src/lib/schema.ts). Never hardcode the name,
   address, phone, or URL anywhere else (SEO_PLAN.md §6.2).
4. **Structural text stays in code; descriptive paragraphs go through `CONTENT_SLUGS`**
   in [src/lib/content.ts](../src/lib/content.ts) so the owner can edit them in
   Admin → Site Content. Adding a slug automatically adds a field to the admin form — no
   admin-page changes needed.
5. **Match the existing house style.** Tailwind classes only, existing palette tokens
   (`moss`, `moss-dark`, `cream`, `stone-*`), server components by default, `"use client"`
   only where interactivity demands it. Comment density like the surrounding files: brief,
   explaining *why* rather than *what*.
6. **Gate before you finish.** Every stage ends with:
   ```
   npm run lint && npm run typecheck && npm test && npm run build
   ```
   All four must pass. Report honestly if one does not.
7. **One stage, one commit.** Do not fold work from another stage in, even if it looks
   trivial while you are already in the file. Each stage file ends with its commit message.

## Conventions these stages introduce

New shared modules, created once and reused. If a later stage needs one that does not yet
exist, its prerequisite stage has not been run.

| Module | Created in | Purpose |
|---|---|---|
| `src/lib/seo.ts` | 01 | `absoluteUrl()`, `pageMetadata()` — canonical + OG on every page |
| `src/components/JsonLd.tsx` | 03 | Renders a JSON-LD `<script>` tag |
| `src/lib/schema.ts` (extended) | 03–08 | All JSON-LD builders — the NAP single source of truth |
| `src/components/Breadcrumbs.tsx` | 04 | Visible trail + `BreadcrumbList` |
| `src/lib/faq.ts` | 05 | FAQ questions, shared by the page and its schema |
| `src/lib/answers.ts` | 05 | 40–60 word direct-answer blocks (SEO_PLAN.md §12.1) |
| `src/content/blog/` | 06 | The thirteen posts as `.mdx`, plus the slug registry |
| `src/lib/local.ts` | 09 | Distances and landmarks, each with a `verified` flag |
| `src/lib/clusters.ts` | 10 | Blog slug → topic cluster, drives related-post links |

## Deliberately out of scope

- **`llms.txt`** — SEO_PLAN.md §12.5. Do not create one under any circumstance.
- **Auto-generated town pages** — §6.5. Three deep location pages, not thirty thin ones.
- **Dropping the `blog_posts` table.** Stage 06 stops reading it but leaves the table, its
  data and its RLS policies intact as the rollback path. Dropping it is a later, separate
  decision.
- **Anything requiring an external account** — Google Search Console, Yelp, TripAdvisor,
  Bing Places. That is Stage 00, and it is human work.
- **Making the site statically renderable.** `<Header>` calls `currentUser()`, which reads
  cookies, so every route renders dynamically today regardless of its `revalidate` value.
  This is a real crawler-facing TTFB cost, but fixing it means moving auth state to the
  client or adopting PPR — a bigger refactor than any stage here, and SEO_PLAN.md rates the
  site's speed as already adequate (§13.2). Noted, not addressed. It is also why Stage 06
  compiles MDX at build time rather than per request.
