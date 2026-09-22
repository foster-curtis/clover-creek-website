# Stage 06 — Move the blog from the database to MDX

**Source:** Architecture decision, 2026-09-10 (SEO_PLAN.md §13.4). Unblocks §9.5, §10.3,
§12.4 and defect A9.

**Depends on:** Stage 01 (`pageMetadata`), Stage 04 (breadcrumbs on the post page).

## Goal

The thirteen Area Guide posts stop being markdown strings in Postgres and become `.mdx`
files in the repository. They are evergreen local reference pages that need inline images,
components, cross-links and schema — that is product surface, and product surface belongs
in version control.

**This stage is what makes the rest of the content plan affordable.** §9.5 needs all
thirteen posts expanded from ~340 to 800–1,200 words with original photos; §10.3 needs
cluster links and booking CTAs inside the bodies; §12.4 needs bylines and first-hand
framing. As database rows that is thirteen sessions of copy-paste into a textarea. As files
it is ordinary reviewable code work.

## The trade-off being accepted

**The owner can no longer publish or edit blog posts without a developer.** That is a real
loss and it is deliberate: the content push ahead is developer-assisted, and the posts are
reference pages rather than a news feed. Everything else the owner edits — home page copy,
FAQ answers, house rules, gallery, pricing, reviews — stays in the admin panel exactly as
it is. Only the blog moves.

If the owner ever needs to publish independently again, the `blog_posts` table and its RLS
policies are left intact by this stage; only the code that reads and writes them is
retired.

## Who does what

| Step | Who |
|---|---|
| 1–9 (toolchain, loader, migration of the 13 posts, retiring the admin UI) | **[AGENT]** |
| Exporting post bodies, if `.env.local` has no Supabase credentials | **[HUMAN]** — see step 4 |
| Reviewing the 13 converted posts for fidelity | **[HUMAN]** — a skim, after deploy |
| Taking the original photographs | **[HUMAN]** — Stage 00 §F, ongoing |
| Expanding post bodies to 800–1,200 words | **[AGENT]**, from the owner's first-hand notes — this becomes possible *because* of this stage |

---

## Architecture

Decided up front so agents do not improvise:

```
src/content/blog/
  index.ts                                 # registry: slug -> module
  onaqui-wild-horses-rush-valley.mdx       # each post: `export const meta` + body
  bonneville-salt-flats-guide.mdx
  …
  images/
    onaqui-herd-morning.jpg                # co-located, statically imported
```

Four decisions worth stating, because the obvious alternatives are worse here:

1. **`@next/mdx`, compiled at build time** — not `next-mdx-remote`. Every route on this
   site renders dynamically (`<Header>` reads cookies), so a runtime MDX compiler would
   recompile the post on **every request**. `@next/mdx` compiles once at build.
2. **`export const meta = {…}` inside the MDX, not `---` frontmatter.** MDX supports ESM
   exports natively, so this needs no `remark-frontmatter` / `remark-mdx-frontmatter`
   plugins and no config. It is also type-checkable against an interface, which `---`
   frontmatter is not.
3. **An explicit registry of static imports**, not `import()` with a template-literal path
   and not `fs.readFile`. A dynamic path relies on bundler context-module behaviour;
   `fs` reads need `outputFileTracingIncludes` or they 404 in production while working
   locally. A thirteen-line registry has neither failure mode. Adding a post means adding
   a file and a line.
4. **The existing route stays.** `/blog/[slug]` and `/blog` keep their URLs and their page
   components; only the data source under them changes. No URL changes, no redirects, no
   re-indexing.

---

## Steps

### 1. **[AGENT]** Install and configure the toolchain

```
npm install @next/mdx @mdx-js/loader @mdx-js/react @types/mdx
```

In [next.config.ts](../next.config.ts), wrap the existing config with `withMDX`. Keep every
existing setting — the `remotePatterns` logic for Supabase Storage and the SVG CSP are both
load-bearing:

```ts
import createMDX from "@next/mdx";

const withMDX = createMDX({});           // no plugins needed; `export const meta` is native MDX

export default withMDX(nextConfig);
```

Do **not** set `pageExtensions`. That is only for file-based MDX routes under `app/`, and
this design keeps the existing `[slug]` route.

Create `mdx-components.tsx` in the **project root** (required by `@next/mdx`) mapping
markdown elements onto the site's styles. The `.prose-simple` class in
[src/app/globals.css](../src/app/globals.css) already handles the basics — the component map
is where `a` becomes `next/link` and `img` becomes `next/image`:

```tsx
import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: (props) => <h2 className="mt-8 text-2xl font-bold text-stone-800" {...props} />,
    // …h3, p, ul, li, blockquote to match the existing prose-simple output
    a: ({ href = "", ...props }) =>
      href.startsWith("/") ? <Link href={href} {...props} /> : <a href={href} rel="noopener" {...props} />,
    ...components,
  };
}
```

The rendered result should be visually identical to what `marked` + `.prose-simple`
produces today. Compare a converted post side by side with the live one before moving on.

### 2. **[AGENT]** Define the post module contract

`src/content/blog/types.ts`:

```ts
export interface PostMeta {
  slug: string;                 // must match the filename
  title: string;
  excerpt: string;
  publishedAt: string;          // YYYY-MM-DD
  updatedAt?: string;           // only when the post is genuinely revised
  author?: string;              // byline (SEO_PLAN.md §12.4)
  draft?: boolean;              // omitted or false = published
  cover?: { src: StaticImageData; alt: string };
}
```

`cover.src` is a **static import** of a co-located image, so Next supplies width, height
and a blur placeholder automatically — that is what fixes the CLS and image-optimization
gap §9.5 cares about.

### 3. **[AGENT]** Build the registry and swap the loader

`src/content/blog/index.ts` — one static import per post, and the helpers the pages need:

```ts
import * as onaqui from "./onaqui-wild-horses-rush-valley.mdx";
// …twelve more

const MODULES = [onaqui /* , … */];

export const ALL_POSTS = MODULES.map((m) => ({ meta: m.meta, Content: m.default }))
  .filter((p) => !p.meta.draft)
  .sort((a, b) => b.meta.publishedAt.localeCompare(a.meta.publishedAt));
```

Then rewrite `getPublishedPosts()` and `getPost()` in
[src/lib/data.ts](../src/lib/data.ts) to read from the registry. **Keep the exported
`BlogPost` shape as close to the current one as possible** — `slug`, `title`, `excerpt`,
`publishedAt` all stay, so [src/app/sitemap.ts](../src/app/sitemap.ts) and
[src/app/blog/page.tsx](../src/app/blog/page.tsx) need almost no change. Replace the `body:
string` field with `Content: ComponentType` and add `cover` and `author`.

Both functions become synchronous, but **leave them `async`**. They are awaited in four
places and a `Promise.all` in the post page; changing the signature turns a contained
change into a sprawling one for no benefit.

Delete the Supabase branches and the `hasSupabase()` guards from these two functions only.
Note in a comment that the blog no longer depends on Supabase — which also means a Supabase
outage no longer empties `/blog` **and drops all thirteen posts out of `sitemap.xml`**, the
quiet failure mode this architecture removes.

### 4. **[AGENT]** Export the thirteen existing posts

Read-only, from the live database. This is the one place an agent touches Supabase, and
only with `select`:

```js
// scratchpad/export-posts.js — read-only, do not commit
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local,
// selects slug/title/excerpt/body/published_at, writes one .mdx per row.
```

For each row, write `src/content/blog/<slug>.mdx` with `export const meta = {…}` followed
by the body markdown **unchanged**. Valid markdown is valid MDX, with two exceptions to fix
by hand:

- Bare `<` or `{` in prose are parsed as JSX/expressions — escape them.
- Raw HTML blocks must be valid JSX (`class` → `className`, self-closed tags).

If `.env.local` has no Supabase credentials, stop and hand it to a **[HUMAN]**: they can
export from Supabase Studio (`select slug, title, excerpt, body, published_at from
blog_posts order by published_at`) and paste the results. **Do not reconstruct a post body
from the deployed HTML, and absolutely do not rewrite one from memory** — these are the
owner's words about places they live near.

Verify: thirteen files, thirteen slugs matching the old sitemap exactly. **A changed slug
is a dead URL and a lost ranking.**

### 5. **[AGENT]** Update the post page

In [src/app/blog/\[slug\]/page.tsx](../src/app/blog/[slug]/page.tsx):

- Replace `marked.parse()` + `dangerouslySetInnerHTML` with `<post.Content />` wrapped in
  the existing `.prose-simple` container. Remove the `marked` import — and drop the
  dependency from `package.json` if nothing else uses it (check first; the admin editor
  may preview with it).
- Add `generateStaticParams()` returning every slug, so posts prerender at build.
- Render the cover image above the `<h1>` when `meta.cover` exists: `next/image`,
  `priority` (it is the LCP element there), `placeholder="blur"` from the static import.
- Render the byline under the date when `meta.author` is set, linked to `/about` when it
  matches `SITE.owner.name` (§12.4). This is the piece that connects a post to the `Person`
  node Stage 08 creates.
- Keep the breadcrumb from Stage 04 and the `pageMetadata()` call from Stage 01. Pass
  `image: meta.cover` into `pageMetadata()` so a shared post uses its own photo.

The existing `notFound()` behaviour stays — an unknown slug still 404s.

### 6. **[AGENT]** Update the blog index

[src/app/blog/page.tsx](../src/app/blog/page.tsx) reads from the registry. Show a thumbnail
on cards that have a cover, and keep the card height stable whether or not one exists — a
grid that reflows on data is a CLS problem on the page that links to everything else.

### 7. **[AGENT]** Retire the admin blog UI

Delete, in one commit with the rest so the tree is never half-migrated:

- `src/app/admin/blog/page.tsx` and `src/app/admin/blog/[id]/page.tsx`
- `savePost` and `deletePost` from [src/app/admin/actions.ts](../src/app/admin/actions.ts),
  plus the now-unused `slugify` helper if nothing else calls it
- The Blog link in the admin nav ([src/app/admin/layout.tsx](../src/app/admin/layout.tsx))

Add a short note in place of the nav item, or in the admin dashboard, saying Area Guide
posts now live in the repository. An admin panel with a silently missing section reads as
a bug.

**Leave the `blog_posts` table, its RLS policies and its data in place.** Do not write a
`drop table` migration. It costs nothing, it is the rollback path, and dropping it is a
separate decision once the MDX posts have been live and correct for a while.

### 8. **[AGENT]** TypeScript and lint

- `@types/mdx` supplies the `.mdx` module declarations. If `next typegen && tsc --noEmit`
  still cannot resolve `export const meta`, add a `src/content/blog/mdx.d.ts` declaring the
  module shape (`default: ComponentType`, `meta: PostMeta`).
- ESLint does not lint `.mdx` by default. Do not add an MDX ESLint plugin in this stage —
  it is a separate discussion and `--max-warnings=0` makes any new rule a build breaker.

### 9. **[AGENT]** Verify

```
npm run lint && npm run typecheck && npm test && npm run build
npm run dev
```

```
# Every old URL still resolves
curl -s http://localhost:3000/sitemap.xml | grep -o '/blog/[a-z0-9-]*' | sort > /tmp/new-slugs.txt
# Compare against the deployed sitemap — the two lists must be identical
curl -s https://www.clovercreekguesthouse.com/sitemap.xml | grep -o '/blog/[a-z0-9-]*' | sort > /tmp/old-slugs.txt
diff /tmp/old-slugs.txt /tmp/new-slugs.txt
```

`diff` must be empty. Then:

- Open three posts and compare rendering against the live site — headings, lists, links and
  spacing should be indistinguishable.
- Confirm `/blog` and a post render **with no `.env.local` present**. This is the new
  behaviour worth checking: the blog is now independent of Supabase.
- Confirm the build prerenders the post routes rather than marking them dynamic.

**[HUMAN]** *After deploy:* skim the thirteen posts for conversion damage — a mangled list,
a dropped link, a smart quote turned into an escape. Then confirm in Search Console that no
blog URL has started 404ing.

---

## Do not

- **Do not change a single slug.** Every one is a live, indexed URL.
- **Do not rewrite, summarise, or "improve" post bodies during the conversion.** This stage
  is a format migration and nothing else. Expanding the posts (§9.5) is real work that
  deserves its own review — do it in follow-up commits, one post at a time, from the
  owner's first-hand knowledge rather than invented local detail.
- Do not drop the `blog_posts` table.
- Do not use `next-mdx-remote` or runtime MDX compilation (see Architecture, decision 1).
- Do not add `pageExtensions` to `next.config.ts`.
- Do not add stock photography. §9.5's argument is that original photos are the whole
  differentiator.
- Do not invent a byline. If `meta.author` is absent, render no byline.

## Acceptance criteria

- [ ] Thirteen `.mdx` files exist, one per current post, with byte-identical slugs.
- [ ] `/blog` and every `/blog/[slug]` render correctly and match the previous output.
- [ ] `sitemap.xml` lists exactly the same thirteen blog URLs as before.
- [ ] Posts render with no Supabase configuration present.
- [ ] Post routes are prerendered at build time; no MDX compilation happens per request.
- [ ] Covers and bylines render when present in `meta`, and are absent otherwise.
- [ ] The admin blog UI and its server actions are gone, with a note explaining where posts
      live now.
- [ ] The `blog_posts` table is untouched.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass.

## Commit

```
Move the Area Guide from the database to MDX files

The thirteen posts become src/content/blog/*.mdx, compiled at build time via
@next/mdx with metadata as a native `export const meta`. Slugs and URLs are
unchanged. Adds inline next/image support, cover images and bylines, and
removes the blog's dependency on Supabase — an outage no longer empties /blog
or the sitemap. Retires the admin blog editor; the blog_posts table is left in
place as the rollback path.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
