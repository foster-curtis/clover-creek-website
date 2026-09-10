# Stage 04 — Breadcrumbs

**Source:** SEO_PLAN.md §10.3 rule 7, §8.3, defect A11.

**Depends on:** Stage 03 (`JsonLd` component and `SCHEMA_IDS`).

## Goal

Give the site hierarchy. Right now every page is one hop from every other page, so nothing
signals which pages matter (§10.1). Visible breadcrumbs plus `BreadcrumbList` markup fix
that for both readers and crawlers, and breadcrumbs are one of the few rich results Google
still renders reliably.

## Who does what

| Step | Who |
|---|---|
| 1–5 (all code) | **[AGENT]** |

No human input needed. This stage is entirely self-contained.

---

## Steps

### 1. **[AGENT]** Add `breadcrumbListSchema()` to `src/lib/schema.ts`

```ts
export interface Crumb {
  name: string;
  /** Site-relative path. Omit on the final crumb — the current page. */
  path?: string;
}

/**
 * BreadcrumbList for a page (SEO_PLAN.md §10.3). "Home" is prepended automatically,
 * so callers pass only the trail below it.
 */
export function breadcrumbListSchema(crumbs: Crumb[]) {
  const all: Crumb[] = [{ name: "Home", path: "/" }, ...crumbs];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.path ? { item: absoluteUrl(c.path) } : {}),
    })),
  };
}
```

Import `absoluteUrl` from `./seo`. The last item deliberately has no `item` URL — that is
Google's documented pattern for the current page.

### 2. **[AGENT]** Create `src/components/Breadcrumbs.tsx`

One component renders both the visible trail and the markup, so the two can never disagree:

```tsx
import Link from "next/link";
import JsonLd from "./JsonLd";
import { breadcrumbListSchema, type Crumb } from "@/lib/schema";

/**
 * Visible breadcrumb trail plus its BreadcrumbList markup. "Home" is added
 * automatically; pass only the trail below it, ending with the current page
 * (no `path` on the last crumb).
 */
export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const all: Crumb[] = [{ name: "Home", path: "/" }, ...crumbs];
  return (
    <>
      <JsonLd data={breadcrumbListSchema(crumbs)} />
      <nav aria-label="Breadcrumb" className="text-sm text-stone-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          {all.map((c, i) => (
            <li key={c.name} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true" className="text-stone-300">/</span>}
              {c.path ? (
                <Link href={c.path} className="hover:text-moss hover:underline">
                  {c.name}
                </Link>
              ) : (
                <span className="text-stone-600" aria-current="page">{c.name}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
```

### 3. **[AGENT]** Place breadcrumbs on every page except the home page

Insert `<Breadcrumbs crumbs={...} />` as the first child inside each page's outer
container, immediately **above** the `<h1>`. Keep the existing container padding; add
`mb-4` or similar spacing so the `<h1>` does not collide with the trail.

| Page | `crumbs` |
|---|---|
| `/gallery` | `[{ name: "Photo Gallery" }]` |
| `/book` | `[{ name: "Book a Stay" }]` |
| `/reviews` | `[{ name: "Guest Reviews" }]` |
| `/blog` | `[{ name: "Area Guide" }]` |
| `/blog/[slug]` | `[{ name: "Area Guide", path: "/blog" }, { name: post.title }]` |
| `/faq` | `[{ name: "FAQ" }]` |
| `/contact` | `[{ name: "Contact" }]` |
| `/house-rules` | `[{ name: "House Rules" }]` |
| `/terms` | `[{ name: "Terms of Service" }]` |
| `/privacy` | `[{ name: "Privacy Policy" }]` |

Crumb names should match the page's `<h1>`, not its `<title>` — that is what a reader
expects and what Google's guidance describes.

**Do not** add breadcrumbs to `/`, `/login`, `/book/success`, `/account/*` or `/admin/*`.
The home page is the root of the trail, and the rest are not indexable pages.

### 4. **[AGENT]** Replace the blog post back-link

[src/app/blog/\[slug\]/page.tsx](../src/app/blog/[slug]/page.tsx) currently opens with a
`← Area Guide` link. The breadcrumb replaces it — remove the old link rather than having
two ways back stacked on top of each other (§10.3 rule 7 calls the current single link out
by name).

### 5. **[AGENT]** Verify

```
npm run lint && npm run typecheck && npm test && npm run build
npm run dev
curl -s http://localhost:3000/blog/<any-published-slug> | grep -o 'BreadcrumbList'
curl -s http://localhost:3000/faq | grep -o '"position":[0-9]*'
```

Then in a browser, tab through the trail on a couple of pages: links must be reachable by
keyboard, and the current page must be announced via `aria-current="page"`.

If Supabase is not configured, `/blog/[slug]` returns 404 for every slug — that is expected
and not a failure of this stage. Check `/faq` and `/gallery` instead.

**[HUMAN]** *After deploy:* run one blog post through the Rich Results Test and confirm the
Breadcrumbs enhancement is detected.

---

## Do not

- Do not build a breadcrumb from `usePathname()` or route segments. Auto-derived trails
  produce things like "Blog › onaqui-wild-horses-rush-valley"; explicit crumbs read like
  language.
- Do not add breadcrumbs to the home page.
- Do not deep-link crumb paths that do not exist as pages. Every `path` in a crumb must be
  a real route.

## Acceptance criteria

- [ ] All ten pages in the step-3 table render a visible trail and a `BreadcrumbList`.
- [ ] The final crumb has no `item` URL and carries `aria-current="page"`.
- [ ] Blog posts show `Home / Area Guide / <post title>` and the old `← Area Guide` link is
      gone.
- [ ] The home page has no breadcrumb.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass.

## Commit

```
Add visible breadcrumbs and BreadcrumbList markup

One component renders both the trail and its structured data, so they cannot
disagree. Replaces the single back-link on blog posts. Fixes SEO_PLAN.md
defect A11 and §10.3 rule 7.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
