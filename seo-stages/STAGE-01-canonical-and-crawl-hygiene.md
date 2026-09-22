# Stage 01 — Canonical URLs & crawl hygiene

**Source:** SEO_PLAN.md §13.1, §10.5, §7.1. Fixes defects A1, A2, A13, A14, A15.

**Depends on:** nothing. This is the first code stage and the most important one —
SEO_PLAN.md §16: *"Add canonical tags and pick one host. Nothing else works reliably until
this is fixed."*

## Goal

Every indexable page declares exactly one canonical URL on exactly one host, and the three
routes that should never be indexed say so. Introduce the `pageMetadata()` helper that
every later stage builds on.

## Who does what

| Step | Who |
|---|---|
| 1–8 (all code) | **[AGENT]** |
| 9 — 301 redirect apex → www in Vercel | **[HUMAN]** — Vercel dashboard, outside the repo |

Step 9 is not required for this stage to ship. The canonical tags alone tell Google which
host is real; the 301 makes it unambiguous. Ship the code, then ask the owner to do step 9.

## Decision this stage bakes in

**`www` is the canonical host.** The deployed `NEXT_PUBLIC_SITE_URL` already resolves to
`https://www.clovercreekguesthouse.com`, while the hard-coded fallback in `src/lib/site.ts`
is the apex domain — so if the env var were ever cleared, the site would silently emit
apex URLs into every canonical tag and the sitemap (§13.1, notes on #2 and #3). This stage
aligns the fallback to `www`.

If the owner has said they want the apex domain instead, stop and confirm before starting.

---

## Steps

### 1. **[AGENT]** Align the default host

In [src/lib/site.ts](../src/lib/site.ts):

```ts
const DEFAULT_SITE_URL = "https://www.clovercreekguesthouse.com";
```

Update the comment above `resolveSiteUrl()` to note that the fallback must match the
deployed `NEXT_PUBLIC_SITE_URL` host, and why (an apex/www mismatch silently poisons every
canonical tag).

### 2. **[AGENT]** Create `src/lib/seo.ts`

The one place canonical URLs and per-page Open Graph metadata are assembled. Every page
metadata export in the codebase routes through it from here on.

```ts
import type { Metadata } from "next";
import { SITE } from "./site";

/** Absolute URL for a site-relative path. Always canonical-host, no trailing slash. */
export function absoluteUrl(path: string): string {
  if (!path || path === "/") return SITE.url;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface PageMetaInput {
  /** Site-relative path, e.g. "/faq" or "/blog/onaqui-wild-horses-rush-valley". */
  path: string;
  /** Page title *before* the "— Clover Creek Guest House" template suffix. */
  title?: string;
  description?: string;
  /** Absolute or site-relative image URL. Defaults to the site OG image (Stage 02). */
  image?: string;
  /** Set for pages that must stay out of the index (§10.5). */
  noindex?: boolean;
  /** "article" for blog posts; everything else is a website page. */
  type?: "website" | "article";
}

/**
 * Canonical + Open Graph for one page. Canonicals are the fix for defect A1 — every
 * page needs one, and it must be absolute and on the canonical host (§13.1).
 */
export function pageMetadata(input: PageMetaInput): Metadata {
  const url = absoluteUrl(input.path);
  return {
    ...(input.title ? { title: input.title } : {}),
    ...(input.description ? { description: input.description } : {}),
    alternates: { canonical: url },
    openGraph: {
      url,
      type: input.type ?? "website",
      ...(input.title ? { title: input.title } : {}),
      ...(input.description ? { description: input.description } : {}),
    },
    ...(input.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
```

Leave the `image` field unused for now — Stage 02 wires it to the OG image it creates.
Keep it in the interface so Stage 02 is a one-function change rather than a signature
change across every call site.

### 3. **[AGENT]** Add canonical metadata to every indexable page

Convert each page's existing `metadata` export to `pageMetadata()`. **Keep the current
title and description strings exactly as they are** — the §7.2 copy rewrites are Stage 10,
and mixing them in here makes this stage hard to review.

| File | `path` | Note |
|---|---|---|
| [src/app/page.tsx](../src/app/page.tsx) | `/` | **Has no `metadata` export today** — add one. Title and description come from the root layout defaults, so pass neither; only `path`. |
| [src/app/gallery/page.tsx](../src/app/gallery/page.tsx) | `/gallery` | |
| [src/app/book/page.tsx](../src/app/book/page.tsx) | `/book` | |
| [src/app/reviews/page.tsx](../src/app/reviews/page.tsx) | `/reviews` | |
| [src/app/blog/page.tsx](../src/app/blog/page.tsx) | `/blog` | |
| [src/app/faq/page.tsx](../src/app/faq/page.tsx) | `/faq` | |
| [src/app/contact/page.tsx](../src/app/contact/page.tsx) | `/contact` | |
| [src/app/house-rules/page.tsx](../src/app/house-rules/page.tsx) | `/house-rules` | |
| [src/app/terms/page.tsx](../src/app/terms/page.tsx) | `/terms` | Currently `{ title: "Terms of Service" }` |
| [src/app/privacy/page.tsx](../src/app/privacy/page.tsx) | `/privacy` | Currently `{ title: "Privacy Policy" }` |

For [src/app/blog/\[slug\]/page.tsx](../src/app/blog/[slug]/page.tsx), the metadata is
generated per post — update `generateMetadata` to return
`pageMetadata({ path: `/blog/${slug}`, title: post.title, description: post.excerpt ?? undefined, type: "article" })`.
Keep the existing `if (!post) return { title: "Post not found" }` branch, but add
`robots: { index: false, follow: false }` to it — a 404-shaped page should never be
indexed.

### 4. **[AGENT]** `noindex` the three routes that need it (defect A13, §10.5)

- **`/book/success`** — [src/app/book/success/page.tsx](../src/app/book/success/page.tsx)
  is a server component. Add
  `export const metadata = pageMetadata({ path: "/book/success", title: "Booking confirmed", noindex: true });`
- **`/login`** — [src/app/login/page.tsx](../src/app/login/page.tsx) is a **client
  component** (`"use client"`), and client components cannot export `metadata`. Create
  **`src/app/login/layout.tsx`**:

  ```tsx
  import type { Metadata } from "next";
  import { pageMetadata } from "@/lib/seo";

  // /login is a client component and cannot export metadata itself, so the
  // noindex directive lives in this layout (SEO_PLAN.md §10.5, defect A13).
  export const metadata: Metadata = pageMetadata({
    path: "/login",
    title: "Sign In",
    noindex: true,
  });

  export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return children;
  }
  ```

- **`/auth/callback`** — a route handler
  ([src/app/auth/callback/route.ts](../src/app/auth/callback/route.ts)), so there is no
  metadata to export. Add an `X-Robots-Tag` response header in
  [next.config.ts](../next.config.ts) instead:

  ```ts
  async headers() {
    return [
      {
        // Route handlers have no metadata export; this is the only way to keep
        // the auth callback out of the index (SEO_PLAN.md §10.5).
        source: "/auth/callback",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  ```

  **Do not** add `/auth/callback` to `robots.txt` disallow. A disallowed URL is never
  crawled, so the `noindex` is never seen — the two directives cancel each other out.

### 5. **[AGENT]** Sitemap: `lastModified` and the two missing pages (defect A14)

In [src/app/sitemap.ts](../src/app/sitemap.ts):

- Add `lastModified: new Date()` to the static entries. Blog posts already carry theirs.
- Add `/terms` and `/privacy` to the static list at `priority: 0.3`.
- Leave `/about`, `/directions` and `/stargazing` out — they do not exist yet. Stages 07
  and 08 add their own routes here.

### 6. **[AGENT]** `/reviews`: `force-dynamic` → `revalidate` (defect A15)

In [src/app/reviews/page.tsx](../src/app/reviews/page.tsx), replace
`export const dynamic = "force-dynamic";` with `export const revalidate = 300;`.

**Be honest about what this does.** The page calls `currentUser()` (to decide whether to
show the review form or a sign-in prompt), and so does `<Header>` in the root layout — both
read cookies, which opts every route out of static rendering regardless. So this change
aligns the file with §13.1 #7 and removes a misleading directive, but it will **not** make
the page cacheable on its own. Do not claim a performance win for it. The underlying issue
is recorded as out of scope in [README.md](README.md).

### 7. **[AGENT]** Update `.env.example`

- Change `NEXT_PUBLIC_SITE_URL` to `https://www.clovercreekguesthouse.com` so the example
  matches the canonical host.
- Add the missing `NEXT_PUBLIC_PHONE` entry — `src/lib/site.ts` reads it but it is not
  documented anywhere:

  ```
  # Publicly displayed phone number, e.g. +1-435-555-0134. Shown in the footer and
  # emitted as `telephone` in the structured data. Leave blank until decided (Stage 00).
  NEXT_PUBLIC_PHONE=
  ```

### 8. **[AGENT]** Verify locally

```
npm run lint && npm run typecheck && npm test && npm run build
npm run dev
```

Then confirm in the rendered HTML:

```
curl -s http://localhost:3000/faq        | grep -i 'rel="canonical"'
curl -s http://localhost:3000/           | grep -i 'rel="canonical"'
curl -s http://localhost:3000/login      | grep -i 'noindex'
curl -s http://localhost:3000/book/success | grep -i 'noindex'
curl -s -I http://localhost:3000/auth/callback | grep -i 'x-robots-tag'
curl -s http://localhost:3000/sitemap.xml | head -30
```

Every canonical must be absolute and start `https://www.clovercreekguesthouse.com`.

### 9. **[HUMAN]** 301 the apex domain to `www` (§13.1 #2)

In the **Vercel dashboard** → Project → Settings → Domains: set
`clovercreekguesthouse.com` to redirect to `www.clovercreekguesthouse.com` (permanent,
308/301). Confirm `NEXT_PUBLIC_SITE_URL` in the project's environment variables is
`https://www.clovercreekguesthouse.com` with no trailing slash.

An agent cannot do this — it is outside the repository. Verify afterwards with:

```
curl -sI https://clovercreekguesthouse.com | head -5
```

Expect a `301`/`308` and a `location:` header pointing at the `www` host.

---

## Do not

- Do not set a canonical in the root layout. A root-level `alternates.canonical` leaks to
  any page that does not override it, which is how sites end up declaring every URL
  canonical to the homepage.
- Do not change any title or description text. That is Stage 10.
- Do not add `noindex` to `/account` or `/admin` — they are already disallowed in
  `robots.txt`, and adding both directives to the same URL is contradictory.
- Do not touch `src/app/robots.ts`. It is correct as written, including leaving AI crawlers
  (GPTBot, PerplexityBot, ClaudeBot, Google-Extended) allowed (§12.5).

## Acceptance criteria

- [ ] Every page in the step-3 table emits an absolute `<link rel="canonical">` on the
      `www` host.
- [ ] `/blog/[slug]` emits a per-post canonical; a missing post returns noindex metadata.
- [ ] `/login`, `/book/success` emit `<meta name="robots" content="noindex, nofollow">`.
- [ ] `/auth/callback` responds with an `X-Robots-Tag: noindex, nofollow` header.
- [ ] `sitemap.xml` includes `/terms` and `/privacy`, and every entry has a `lastmod`.
- [ ] `/reviews` no longer declares `force-dynamic`.
- [ ] `DEFAULT_SITE_URL` and `.env.example` both use the `www` host.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass.
- [ ] The site renders correctly with no `.env.local` present.

## Commit

```
Add canonical URLs, noindex directives and sitemap lastModified

Introduces src/lib/seo.ts with pageMetadata(), routes every page's metadata
through it, and aligns the default host with the deployed www canonical.
Fixes SEO_PLAN.md defects A1, A2, A13, A14, A15.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
