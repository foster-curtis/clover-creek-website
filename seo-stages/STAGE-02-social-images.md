# Stage 02 — Social share images

**Source:** SEO_PLAN.md §7.3, §9.6. Fixes defect A4 and the 5.3 MB hero image noted in §9.6.

**Depends on:** Stage 01 (`src/lib/seo.ts` must exist).

## Goal

Every share of this site — Facebook, iMessage, Slack, Pinterest, Reddit, and several AI
assistant answer cards — renders a photograph instead of a bare text link. And the image
the home-page JSON-LD already points at stops being a 5.3 MB iPhone JPEG.

## Who does what

| Step | Who |
|---|---|
| 1–5 (image generation and wiring) | **[AGENT]** |
| Optional: supply a better source photo | **[HUMAN]** — see "If the owner wants a different photo" |

The agent produces a usable OG image from the photo already in the repo. The owner can
replace it later without any code change, by overwriting `public/og-default.jpg` at the
same 1200×630 size.

---

## Steps

### 1. **[AGENT]** Compress `public/guest-house-main.JPG`

It is 5.3 MB, it is referenced by `MAIN_IMAGE_URL` in
[src/lib/schema.ts](../src/lib/schema.ts), and §9.6 asks for ≤ 500 KB.

`sharp` is already present in `node_modules` (Next.js depends on it). Use a throwaway
script in the scratchpad directory — **do not add a script file to the repo**:

```js
// scratchpad/compress.js
const sharp = require("sharp");
sharp("public/guest-house-main.JPG")
  .rotate()                       // honour EXIF orientation before stripping metadata
  .resize({ width: 2000, withoutEnlargement: true })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile("public/guest-house-main.compressed.jpg")
  .then((info) => console.log(info));
```

Then replace the original in place, keeping the exact filename and extension
(`guest-house-main.JPG`) so the schema URL does not change. Confirm the result is under
500 KB and that the image still looks correct — check orientation especially, since iPhone
JPEGs carry EXIF rotation that is lost when metadata is stripped.

> Renaming to a lowercase, keyword-bearing filename would be marginally better (§9.4), but
> it changes a URL that is already published in the home-page JSON-LD. Not worth it for one
> file. §9.4 applies at the next bulk photo refresh, which is Stage 00 work.

### 2. **[AGENT]** Generate `public/og-default.jpg`

1200×630, derived from the compressed hero photo, with a small text overlay reading
`Clover Creek Guest House · Rush Valley, Utah` (§7.3). Again, a throwaway script:

```js
// scratchpad/og.js
const sharp = require("sharp");

const overlay = Buffer.from(`
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="55%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.72)"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#fade)"/>
  <text x="60" y="540" font-family="Georgia, 'Times New Roman', serif" font-size="54"
        font-weight="bold" fill="#ffffff">Clover Creek Guest House</text>
  <text x="60" y="586" font-family="Helvetica, Arial, sans-serif" font-size="28"
        fill="#e7e5e4">Rush Valley, Utah</text>
</svg>`);

sharp("public/guest-house-main.JPG")
  .rotate()
  .resize(1200, 630, { fit: "cover", position: "attention" })
  .composite([{ input: overlay, top: 0, left: 0 }])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile("public/og-default.jpg")
  .then((info) => console.log(info));
```

**Open the result and look at it before continuing.** Automated cropping can behead a
building or bury the text against a bright sky. If `position: "attention"` crops badly,
try `position: "centre"` or `position: sharp.strategy.entropy`. Target under 300 KB.

> **Fallback if `sharp` compositing fails in this environment:** create
> `src/app/opengraph-image.tsx` using `ImageResponse` from `next/og` (available in Next
> 15.5) to render the card at build time. It is more code and produces a plainer image, so
> prefer the static file.

### 3. **[AGENT]** Wire the image into the root layout

In [src/app/layout.tsx](../src/app/layout.tsx), extend the metadata export:

```ts
openGraph: {
  siteName: SITE.name,
  type: "website",
  locale: "en_US",
  images: [
    {
      url: "/og-default.jpg",
      width: 1200,
      height: 630,
      alt: "The Clover Creek Guest House farmhouse in Rush Valley, Utah",
    },
  ],
},
twitter: {
  card: "summary_large_image",
  title: `${SITE.name} — Farm Stay Vacation Rental in Rush Valley, Utah`,
  description:
    "A farmhouse cottage an hour from Salt Lake City. Sleeps 6, dog friendly, dark skies.",
  images: ["/og-default.jpg"],
},
```

`metadataBase` is already set, so the relative `/og-default.jpg` resolves to an absolute
URL automatically. `summary_large_image` replaces the current implicit `summary` card
(defect A4).

### 4. **[AGENT]** Let `pageMetadata()` carry per-page images

In [src/lib/seo.ts](../src/lib/seo.ts), make the `image` field from Stage 01 real:

```ts
export const DEFAULT_OG_IMAGE = "/og-default.jpg";
```

and inside `pageMetadata()`, add to the `openGraph` object:

```ts
images: [{ url: input.image ?? DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
```

Only set explicit `width`/`height` when the image is the default; for a caller-supplied
image, pass just `{ url: input.image }` since its dimensions are unknown. Do not pass an
`images` array on `twitter` per page — the root layout's card applies unless overridden,
and Stage 06 will override it where a post has its own cover photo.

### 5. **[AGENT]** Add an OG image constant to the schema module

In [src/lib/schema.ts](../src/lib/schema.ts), next to `MAIN_IMAGE_URL`:

```ts
/** 1200x630 social share card. Also the Organization logo stand-in until one exists. */
export const OG_IMAGE_URL = `${SITE.url}/og-default.jpg`;
```

Do not change any existing schema builder in this stage — Stage 03 restructures them, and
it will decide where `OG_IMAGE_URL` belongs.

### 6. **[AGENT]** Verify

```
npm run lint && npm run typecheck && npm test && npm run build
npm run dev
curl -s http://localhost:3000/ | grep -iE 'og:image|twitter:card|twitter:image'
curl -s http://localhost:3000/faq | grep -i 'og:image'
ls -la public/og-default.jpg public/guest-house-main.JPG
```

- `og:image` must be an **absolute** URL (Facebook rejects relative ones).
- `twitter:card` must read `summary_large_image`.
- Both files should be well under 500 KB.

**[HUMAN]** *After deploy:* paste the live URL into the Facebook Sharing Debugger and
LinkedIn Post Inspector to confirm the card renders and to prime their caches. An agent
cannot do this — both tools require a logged-in account.

---

## If the owner wants a different photo

**[HUMAN]** Overwrite `public/og-default.jpg` with any 1200×630 JPEG under ~500 KB. No code
change is needed — the filename is what is wired up. §7.3 suggests the best exterior or
fire-pit-at-dusk shot. Per-page images for `/gallery`, `/stargazing` and top blog posts are
later work (Stage 06 handles blog covers).

## Do not

- Do not add a build-time image script to `package.json`. This is a one-off conversion; a
  permanent script implies an ongoing pipeline that does not exist.
- Do not commit the scratchpad scripts.
- Do not delete `public/guest-house-main.JPG` or change its name — the deployed home-page
  JSON-LD references that exact URL.
- Do not generate images with text claiming facts (prices, distances, "darkest skies"). The
  overlay is a name and a place, nothing more.

## Acceptance criteria

- [ ] `public/og-default.jpg` exists, is 1200×630, under ~300 KB, and looks correct when
      opened.
- [ ] `public/guest-house-main.JPG` is under 500 KB, same filename, correct orientation.
- [ ] Every page emits an absolute `og:image` and `twitter:card: summary_large_image`.
- [ ] `pageMetadata()` accepts a per-page `image` and falls back to the default.
- [ ] `OG_IMAGE_URL` is exported from `src/lib/schema.ts` (unused this stage is fine).
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass.

## Commit

```
Add Open Graph image and compress the hero photo

Generates public/og-default.jpg (1200x630) from the exterior photo, switches
the Twitter card to summary_large_image, and compresses guest-house-main.JPG
from 5.3 MB to under 500 KB. Fixes SEO_PLAN.md defect A4 and the §9.6 note.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
