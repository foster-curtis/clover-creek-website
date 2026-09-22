# Clover Creek Guest House — UI/UX Design Audit

**Audited:** 2026-09-21 · **Branch:** `stg` @ `9cdc2b7` · **Scope:** all 24 routes, 14 shared components, global stylesheet
**Verdict:** Functionally complete, systemically under-designed. **Weighted score: 27.6 / 100.**

---

## 0. Executive summary

The site works. Booking, payments, reviews, messaging, and admin are all real and coherent. What's missing is not features — it's a **design system**. Every visual decision in this codebase was made locally, at the point of use, in a Tailwind class string. Nothing is named, nothing is reused, and nothing is enforced.

That is the precise, mechanical reason it "looks like basic HTML with rounded corners." A few measurements tell the whole story:

| Signal | Count in codebase | What a designed site looks like |
|---|---|---|
| `transition` declarations, sitewide | **4** | Every interactive element |
| `shadow` declarations, sitewide | **4** (3 are the bare default) | A 4-step elevation scale |
| `focus:outline-none` with no replacement ring | **13** | Zero — this is a WCAG failure |
| Distinct `<h1>` class strings | **6** for one element | One `<PageTitle>` component |
| `inputCls` redefined per-file | **4+ copies** | One `<Input>` primitive |

The brand problem has the same root. There *is* a brand mark — a four-leaf clover in cream on a moss gradient, at [icon.svg](src/app/icon.svg) — and it appears **nowhere in the interface**. The header logo is a text string. The palette defines `hay` and `cream` as brand colors; `hay` is used **twice** in the entire application. The brand is declared and then never spent.

The good news: the bones are right. The moss/cream/serif direction is a genuinely good farmhouse foundation, the content is warm and specific, and the information architecture is sound. This audit does not propose a redesign. It proposes **making the existing identity explicit, systematic, and felt** — which is mostly additive work in one stylesheet plus a handful of new primitives.

---

## 1. The rubric

Built from current design-system practice ([W3C Design Tokens spec, stable since 2025.10](https://www.digitalapplied.com/blog/design-systems-2026-scale-ui-without-chaos-methodology)), Nielsen's usability heuristics, [WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html), and hospitality-sector conversion research. Ten weighted dimensions, each scored 0–5.

| # | Dimension | Weight | What a 5 looks like |
|---|---|---:|---|
| 1 | **Token foundation** | 10 | Every color, size, space, radius, shadow, and duration is a named token. No raw values at point of use. |
| 2 | **Typographic system** | 12 | A modular scale (1.2–1.33 ratio), fluid via `clamp()`, enforced hierarchy, controlled measure (60–75ch), deliberate line-height per size. |
| 3 | **Color & contrast** | 12 | Semantic tokens (`surface`/`ink`/`brand`/`line`), not raw palette. All text ≥ 4.5:1, UI ≥ 3:1. Accent colors carry meaning. |
| 4 | **Spacing, layout & rhythm** | 10 | A single spacing scale on a 4pt grid. Consistent section rhythm and container widths. Intentional whitespace. |
| 5 | **Depth, elevation & surface** | 8 | A defined elevation ladder. Shadows tinted to the palette, never neutral black. Layering communicates hierarchy. |
| 6 | **Shape & form language** | 6 | One radius scale, consistently applied by component role. Shape reads as a deliberate brand signature. |
| 7 | **Component architecture** | 12 | Shared primitives with variant APIs (`Button`, `Card`, `Input`, `Badge`, `Section`). Zero duplicated class strings. |
| 8 | **Motion & micro-interaction** | 8 | Tokenized durations/easings on all state changes. Purposeful, fast (120–320ms). `prefers-reduced-motion` honored. |
| 9 | **Accessibility & interaction states** | 12 | Visible focus ring everywhere (2.4.7 AA). All five states designed. Targets ≥ 24×24px (2.5.8). |
| 10 | **Brand expression & editorial craft** | 10 | Identity visible in mark, type, color, texture, voice, imagery. Distinctive, not template-derived. |

### Scorecard

| # | Dimension | Score | Weighted | Evidence |
|---|---|:---:|---:|---|
| 1 | Token foundation | 1/5 | 2.0 | 4 colors + 2 fonts total; no space/radius/shadow/motion tokens |
| 2 | Typographic system | 1/5 | 2.4 | `<h1>` is `text-2xl` in 11 places, `text-3xl` in 10; h1 and h2 collide |
| 3 | Color & contrast | 2/5 | 4.8 | 3 measured contrast failures; `hay` brand color used twice |
| 4 | Spacing & rhythm | 2/5 | 4.0 | 5 competing section paddings; 8 container widths |
| 5 | Depth & elevation | 1/5 | 1.6 | 4 shadows sitewide, 3 of them the bare default |
| 6 | Shape & form | 2/5 | 2.4 | 4 radii competing; inputs `rounded` (4px) vs cards `rounded-xl` (12px) |
| 7 | Component architecture | 1/5 | 2.4 | `inputCls` copy-pasted across 4+ files; no primitives |
| 8 | Motion | 1/5 | 1.6 | 4 transitions sitewide; no reduced-motion support |
| 9 | Accessibility & states | 1/5 | 2.4 | `focus:outline-none` ×13 — WCAG 2.4.7 AA failure |
| 10 | Brand expression | 2/5 | 4.0 | Clover mark exists but never rendered; no texture, no motif |
| | **Total** | | **27.6 / 100** | |

---

## 2. Findings

### 2.1 — Token foundation · 1/5

The entire design language is [globals.css:3-11](src/app/globals.css#L3-L11):

```css
@theme {
  --color-cream: #faf7f0;  --color-moss: #4d7c0f;
  --color-moss-dark: #3f6212;  --color-hay: #d9c58a;
  --font-serif: var(--font-lora), Georgia, serif;
  --font-sans: var(--font-inter), system-ui, sans-serif;
}
```

Four colors and two fonts. There are **no tokens for spacing, radius, elevation, duration, easing, or type scale** — so every one of those decisions is re-made by hand at each call site, and drifts. Everything below in this report is a downstream symptom of this one gap.

### 2.2 — Typographic system · 1/5

**The page title has no fixed size.** Six different class strings render `<h1>`:

- `text-2xl font-bold text-stone-800` — 11 occurrences
- `text-3xl font-bold text-stone-800` — 10 occurrences
- `mt-4 text-3xl font-bold text-stone-800` — 3
- plus 3 more one-offs

So a guest moving between pages sees the page title change size with no meaning attached to the change. Worse, **`<h2>` is also `text-2xl` in 5 places** — h1 and h2 are literally the same size on those pages. Hierarchy is not expressed.

**The interface is shrunken.** Of 246 font-size declarations:

| `text-sm` | `text-xs` | `text-base` | everything ≥ `text-lg` |
|---:|---:|---:|---:|
| 110 | 70 | **3** | 63 |

**73% of all sized text is smaller than body copy**, and base size is used three times. This is the single largest contributor to the "basic/unconfident" feeling — a hospitality site should read generously, not like a dense admin console. Body copy inherits the browser default 16px because it is never set at all.

**No measure control.** Long-form prose sits in `max-w-3xl` (768px), which at 16px yields ~95 characters per line — well past the 60–75ch comfortable reading range.

**Serif is applied but never exploited.** [globals.css:19](src/app/globals.css#L19) assigns Lora to all headings, but Lora is only asked to do display work in two places (the hero and the CTA). Elsewhere it renders at 20–24px, where it reads as "a serif font" rather than as a voice. There is no display weight, no optical sizing, no letter-spacing correction at large sizes.

### 2.3 — Color & contrast · 2/5

I computed WCAG ratios for every palette pair in use. **Three measured failures:**

| Foreground | Background | Ratio | Required | Status |
|---|---|---:|---:|---|
| `text-stone-500` #78716c | cream #faf7f0 | **4.48:1** | 4.5:1 | ✗ AA text (54 uses) |
| `text-stone-400` #a8a29e | cream #faf7f0 | **2.36:1** | 4.5:1 | ✗ AA text (30 uses) |
| `text-amber-500` #f59e0b (stars) | white | **2.15:1** | 3:1 non-text | ✗ AA non-text |

The star rating is the sharpest one: [Stars.tsx:3](src/components/Stars.tsx#L3) renders the rating in `amber-500` at **2.15:1**. Star ratings are a primary trust signal on a booking site, and they are currently among the least legible elements on the page. `text-stone-500` misses by 0.02 — trivially fixable, but it's on guest-facing pages. `text-stone-400` is mostly admin-side, so lower priority, but it's a real 2.36:1.

**The brand palette is barely used.** Across the whole application: `moss` 161 uses, but `cream` **3**, `hay` **2**. Meanwhile `stone-*` accounts for 361 uses across 9 shades. Functionally the site is **grey with a green accent** — not a farmhouse palette. `hay` (#d9c58a) is unusable as a foreground anyway at 1.60:1 on cream; it was defined as a brand color but has no legible role, so it went unused.

**No semantic layer.** There is no `--color-surface`, `--color-ink`, `--color-line`. Components reach directly for `bg-white`, `text-stone-800`, `border-stone-200`, which is why there's no way to adjust surfaces globally — and why a dark mode is currently impossible without touching all 24 routes.

### 2.4 — Spacing, layout & rhythm · 2/5

**Five competing section paddings:** `py-12` (6×), `py-10` (13×), `py-16` (4×), `py-8` (1×), `py-6` (3×). Vertical rhythm is therefore arbitrary — the home page alternates `py-12` sections while every other page opens with `py-10`, so section breathing changes as you navigate.

**Eight container widths** in use: `max-w-3xl` (11×), `max-w-6xl` (6×), `max-w-5xl` (6×), `max-w-xl` (5×), `max-w-2xl` (2×), `max-w-md` (2×), `max-w-4xl` (1×), `max-w-xs` (1×). The home page alone switches between `max-w-3xl`, `max-w-5xl`, and `max-w-6xl` across consecutive sections, so the left edge of content visibly shifts as you scroll — a subtle but constant signal of un-deliberateness.

Spacing is also **not on a consistent grid**: `py-1.5`, `py-2.5`, `py-0.5`, and `text-[11px]` appear alongside the standard scale.

### 2.5 — Depth, elevation & surface · 1/5

Four shadow declarations exist in the entire codebase — three are the bare default `shadow` and one is `shadow-lg`. There is **no elevation system at all.**

Consequences:
- Cards are outlined boxes (`rounded-xl border border-stone-200 bg-white`), repeated ~39 times, with no lift. This is the literal "basic component with rounded corners" pattern.
- The sticky header ([Header.tsx:14](src/components/Header.tsx#L14)) has a border but no shadow, so content slides under it with no depth cue.
- The gallery lightbox — a modal at z-50 — has no elevation treatment beyond a backdrop.
- Where shadows do appear they're default Tailwind, i.e. **neutral black**. On a warm cream ground (#faf7f0) neutral shadows read as grey and dirty. Shadows should be tinted toward the palette's brown.

### 2.6 — Shape & form language · 2/5

Four radii compete with no rule: `rounded-full` (41), `rounded-xl` (39), `rounded-lg` (10), `rounded-2xl` (3).

The mismatch that most damages perceived quality: **form inputs use bare `rounded` (4px) while the cards containing them use `rounded-xl` (12px)**. See [BookingWidget.tsx:90](src/components/BookingWidget.tsx#L90) — a 4px-radius input sitting inside a 12px-radius card. Nested shapes with unrelated radii always read as unfinished.

### 2.7 — Component architecture · 1/5

**There are no UI primitives.** No `Button`, `Card`, `Input`, `Badge`, `Section`. Every component re-implements them inline.

`inputCls` is **copy-pasted across at least four files** with subtle divergence:

| File | Definition |
|---|---|
| [BookingWidget.tsx:90](src/components/BookingWidget.tsx#L90) | `w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm …` |
| [ContactForm.tsx:32](src/components/ContactForm.tsx#L32) | identical string, re-declared |
| [admin/blog/[id]/page.tsx:7](src/app/admin/blog/[id]/page.tsx#L7) | adds `mt-1 block` |
| [admin/calendar/page.tsx:15](src/app/admin/calendar/page.tsx#L15) | `py-1.5` instead of `py-2` |

Buttons are worse — every button is a bespoke class string. The primary CTA appears as `rounded-full bg-moss px-6 py-3 font-semibold text-white shadow hover:bg-moss-dark` on the hero, but `rounded-full px-4 py-1.5 text-white bg-moss` in the nav, and other variants elsewhere. There is no canonical button.

**No icon system.** ~330 Unicode glyphs (`←` `→` `✕` `✓` `★` `·`) are used as interface icons. Exactly **one** `<svg>` exists in the codebase — the hamburger in [MobileNav.tsx:20](src/components/MobileNav.tsx#L20). Text glyphs render in the user's system font, vary across platforms, can't be sized or aligned optically, and are the most recognizable signature of an unstyled prototype. The `✓` amenity checkmarks on the home page and the `←`/`→`/`✕` lightbox controls are the most visible offenders.

### 2.8 — Motion & micro-interaction · 1/5

Four transition declarations sitewide. One `hover:scale-105` on gallery tiles is the only micro-interaction in the product.

This means ~60 hover states (`hover:bg-moss-dark` ×19, `hover:text-moss` ×23, `hover:border-moss` ×12) **snap instantly** between colors with no easing. Instant color jumps are the difference between an interface that feels responsive and one that feels like a static document with `:hover` rules — this is a large part of the "not intentional" feeling.

Also absent: no loading/skeleton states (the booking widget's `submitting` state only disables the button), no entrance animation, no `prefers-reduced-motion` handling anywhere.

### 2.9 — Accessibility & interaction states · 1/5

**This is the most serious finding in the audit.**

The pattern `focus:outline-none focus:border-moss` appears **13 times** — on every text input, select, and textarea in the application (booking form, contact form, review form, all admin forms). It removes the browser's focus ring and replaces it with a 1px border color change.

That fails [WCAG 2.2 SC 2.4.7 Focus Visible (Level AA)](https://testparty.ai/blog/wcag-focus-visible-guide). A 1px border shifting from `stone-300` to `moss` is not a sufficient focus indicator — it's a hairline change that keyboard users routinely miss. (For precision: 2.4.7 AA requires that a visible indicator exist; SC 2.4.13 Focus Appearance, which sets the measurable perimeter and 3:1 thresholds, is Level **AAA** in WCAG 2.2. The site fails the AA one.)

Concretely: **a keyboard user cannot reliably tell which field they're typing into on the booking form** — the primary revenue path.

Related state gaps:
- `:focus` is used instead of `:focus-visible` throughout, so ring styling can't distinguish mouse from keyboard.
- **Disabled states are undesigned.** The booking widget's submit button relies on `canSubmit` but has no distinct disabled treatment, so "can't submit yet" is invisible.
- Only **two** of five interaction states (default, hover) are consistently designed. Active/pressed, focus, and disabled are largely absent.
- Several targets fall below the 24×24px minimum of SC 2.5.8 — notably `px-2 py-1 text-xs` admin buttons and the `px-3 py-1` lightbox close control.

### 2.10 — Brand expression & editorial craft · 2/5

**The brand mark is invisible.** [icon.svg](src/app/icon.svg) contains a well-made four-leaf clover — cream petals on a moss gradient, 22px-radius squircle. It is used as a favicon and **never rendered in the application**. The header logo at [Header.tsx:16](src/components/Header.tsx#L16) is a text string in Lora. The footer is the same. A guest never sees the mark on the site.

**No texture, no motif.** A farmhouse identity has obvious material vocabulary available — paper grain, linen weave, a hairline botanical rule, a barn-door arch, letterpress-style small caps. None is present. The clover form itself is an unused motif that could serve as list bullets, section dividers, and rating glyphs.

**Leftover scaffolding.** `public/` still contains the Next.js starter assets: `next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`.

**Imagery is under-art-directed.** The hero is a single `object-cover` fill with a generic black gradient scrim ([page.tsx:53-62](src/app/page.tsx#L53-L62)). Photography is the strongest asset a rental property has, and current hospitality practice leans hard on [editorial, magazine-style layouts](https://mediaboom.com/news/hotel-website-design-trends/) — asymmetric image/text pairings, full-bleed breaks, generous negative space. Every image here is in a uniform grid or a plain rectangle.

**Voice is strong; typography doesn't carry it.** The copy is genuinely good — "Out here, the stars still shine," "Ready for some quiet?" — but it's set in the same `text-2xl font-bold text-stone-800` as everything else. The writing has personality the type treatment doesn't honor.

### 2.11 — Responsive behavior (cross-cutting)

Only **31 responsive modifiers** exist sitewide (`sm:` 18, `lg:` 8, `md:` 5) across 24 routes. Most layouts are single-breakpoint or not adaptive at all. Type never scales responsively except the hero (`text-3xl sm:text-5xl`) — so headings are identical on a 360px phone and a 2560px display. The pricing table, review grid, and admin tables have no small-screen treatment beyond stacking.

---

## 3. Remediation plan

Ordered by (impact × confidence) ÷ effort. Phases 1–2 are where nearly all the perceived-quality gain lives.

### Phase 1 — Foundation + the accessibility fix
*Highest leverage. One stylesheet, plus a find-and-replace.*

**1.1 — Install a real token layer.** Replace the `@theme` block in [globals.css](src/app/globals.css) wholesale. Every ratio below was measured, not estimated:

```css
@theme {
  /* ---- Brand palette (ratios measured against cream #faf7f0) ---- */
  --color-cream:      #faf7f0;  /* page ground */
  --color-parchment:  #f4efe4;  /* alternating section ground */
  --color-moss:       #4d7c0f;  /* 4.67:1  AA */
  --color-moss-dark:  #3f6212;  /* 6.61:1  AA */
  --color-moss-deep:  #35520f;  /* 8.30:1  AA — display headings */
  --color-clay:       #9c4f2f;  /* 5.49:1  AA — warm secondary accent */
  --color-harvest:    #b45309;  /* 4.69:1  AA — stars (was amber-500 @ 2.15:1) */
  --color-hay-ink:    #6b5a28;  /* 6.29:1  AA — legible form of the hay brand color */
  --color-hay:        #d9c58a;  /* decorative fills and rules ONLY — 1.60:1 */

  /* ---- Semantic aliases: components reference these, never raw palette ---- */
  --color-surface:         var(--color-cream);
  --color-surface-raised:  #ffffff;
  --color-surface-sunken:  var(--color-parchment);
  --color-ink:             #292524;  /* 14.18:1 */
  --color-ink-muted:       #57534e;  /*  7.13:1 — replaces stone-500 @ 4.48:1 */
  --color-ink-subtle:      #6d6862;  /*  5.4:1  — replaces stone-400 @ 2.36:1 */
  --color-line:            #e2ddd2;  /* warm rule, replaces cool stone-200 */
  --color-line-strong:     #cfc7b6;
  --color-focus:           var(--color-moss-dark);

  /* ---- Fluid type scale · 1.25 ratio ---- */
  --text-xs:   0.8125rem;
  --text-sm:   0.9375rem;
  --text-base: clamp(1rem,     0.96rem + 0.20vw, 1.0625rem);
  --text-lg:   clamp(1.125rem, 1.08rem + 0.22vw, 1.1875rem);
  --text-xl:   clamp(1.25rem,  1.18rem + 0.35vw, 1.375rem);
  --text-2xl:  clamp(1.5rem,   1.38rem + 0.60vw, 1.75rem);
  --text-3xl:  clamp(1.875rem, 1.68rem + 0.98vw, 2.25rem);
  --text-4xl:  clamp(2.25rem,  1.95rem + 1.50vw, 3rem);
  --text-5xl:  clamp(2.75rem,  2.25rem + 2.50vw, 4rem);

  /* ---- Elevation · warm-tinted (stone-800 41,37,36), never neutral black ---- */
  --shadow-1: 0 1px 2px rgb(41 37 36 / .05), 0 1px 3px   rgb(41 37 36 / .06);
  --shadow-2: 0 2px 4px rgb(41 37 36 / .05), 0 4px 8px   rgb(41 37 36 / .06);
  --shadow-3: 0 4px 8px rgb(41 37 36 / .05), 0 12px 24px rgb(41 37 36 / .08);
  --shadow-4: 0 8px 16px rgb(41 37 36 / .06), 0 24px 48px rgb(41 37 36 / .10);

  /* ---- Radius ---- */
  --radius-sm: 0.375rem;  --radius-md: 0.625rem;
  --radius-lg: 0.875rem;  --radius-xl: 1.25rem;  --radius-pill: 9999px;

  /* ---- Motion ---- */
  --ease-out:      cubic-bezier(.22, 1, .36, 1);
  --ease-standard: cubic-bezier(.4, 0, .2, 1);
  --dur-fast: 120ms;  --dur-base: 200ms;  --dur-slow: 320ms;

  /* ---- Section rhythm ---- */
  --space-section: clamp(3rem, 2rem + 5vw, 6rem);
}
```

**1.2 — Fix the focus failure.** This is the one change to make before any other. Add a global default so no element can lose its ring:

```css
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

Then delete all 13 `focus:outline-none` occurrences. Where a custom ring is wanted, use `focus-visible:ring-2 focus-visible:ring-moss-dark focus-visible:ring-offset-2` — never `outline-none` alone. Note the switch from `:focus` to `:focus-visible` so mouse clicks don't show rings.

**1.3 — Fix the three contrast failures.**
- [Stars.tsx:3](src/components/Stars.tsx#L3): `text-amber-500` → `text-harvest` (2.15:1 → 5.02:1 on white).
- Guest-facing `text-stone-500` → `text-ink-muted` (4.48:1 → 7.13:1). 54 occurrences.
- `text-stone-400` → `text-ink-subtle` (2.36:1 → 5.4:1). 30 occurrences, mostly admin.

**1.4 — Set body type properly.** Currently body size is never declared:

```css
body {
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: 1.65;
}
```

**1.5 — Global motion default + reduced-motion.**

```css
a, button, input, select, textarea, [role="button"] {
  transition: color var(--dur-fast) var(--ease-standard),
              background-color var(--dur-fast) var(--ease-standard),
              border-color var(--dur-fast) var(--ease-standard),
              box-shadow var(--dur-base) var(--ease-out),
              transform var(--dur-base) var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important;
  }
}
```

This single rule animates all ~60 existing hover states at once — one of the largest perceived-quality gains available for the effort.

> **Note:** [layout.tsx:29](src/app/layout.tsx#L29) sets `scroll-smooth` on `<html>`. The `scroll-behavior: auto` override above is required for vestibular safety.

---

### Phase 2 — Component primitives
*Eliminates the duplication that causes drift. ~5 new files.*

**2.1 — `Button`** (`src/components/ui/Button.tsx`) with variants `primary | secondary | ghost | danger` and sizes `sm | md | lg`. Replace every bespoke button string. Must include designed **disabled** and **loading** states — the booking submit button currently has neither.

**2.2 — `Input` / `Field`** — one implementation, replacing all four `inputCls` copies. Radius `--radius-md` (10px) to sit correctly inside `--radius-xl` cards. Include label, hint, and error slots; error styling is currently ad-hoc.

**2.3 — `Card`** with `flat | raised | interactive` variants, replacing the ~39 hand-written `rounded-xl border border-stone-200 bg-white` strings. `interactive` gets `--shadow-2` → `--shadow-3` with a 1px lift on hover.

**2.4 — `Section`** — normalizes the five section paddings and eight container widths to `--space-section` and two canonical widths (`--w-prose` 68ch, `--w-wide` 72rem).

**2.5 — `PageTitle` / `SectionTitle`** — ends the six-different-`<h1>` problem. `PageTitle` = `--text-4xl`, Lora, `--color-moss-deep`, `tracking-tight`. `SectionTitle` = `--text-2xl`. This alone restores hierarchy across all 24 routes.

**2.6 — Icon set.** Add ~12 inline SVG icons (arrow-left/right, close, check, star, wifi, pet, bed, bath, kitchen, map-pin, calendar) at 1.5px stroke to match Lora's weight. Replace all ~330 Unicode glyphs. Highest-visibility wins: the home-page amenity `✓` list, `Stars`, and the lightbox controls.

---

### Phase 3 — Brand expression
*Where "farmhouse" becomes felt rather than asserted.*

**3.1 — Put the clover mark in the UI.** Extract [icon.svg](src/app/icon.svg) into a `<Logo>` component; render it in the header beside the wordmark and in the footer. Use the single-clover silhouette as: list bullets (replacing `•` in the FAQ), a section divider glyph, and the empty-state motif.

**3.2 — Give the wordmark a lockup.** Header currently: `font-serif text-lg font-bold text-moss`. Replace with mark + two-line lockup — "Clover Creek" in Lora, "GUEST HOUSE" beneath in Inter small-caps, `tracking-[0.18em]`, `--color-ink-muted`. Instantly reads as an identity rather than a link.

**3.3 — Add material texture.** A very low-opacity paper grain on `--color-surface` (a tiled SVG `feTurbulence`, ~2–3% opacity) plus a hairline `--color-hay` rule under section titles. Subtle, but it's what separates "cream background" from "paper."

**3.4 — Alternate section grounds.** The home page alternates `bg-white` and cream. Use `--color-parchment` for alternates instead — warmer, and it makes white cards read as genuinely raised.

**3.5 — Editorial hero.** Replace the black scrim with a moss-tinted gradient (`from-moss-deep/70`), move the headline off a centered block into an asymmetric editorial position, and set `SITE.name` at `--text-5xl` in Lora with `tracking-tight`. Consider a serif/italic pairing on the tagline.

**3.6 — Art-direct the content sections.** Break the uniform grid with at least two asymmetric image/text pairings (60/40 split, image bleeding to the viewport edge) — the standard for [boutique hospitality sites](https://motopress.com/blog/boutique-hotel-website-design/).

**3.7 — Delete starter assets.** Remove `next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg` from `public/`.

---

### Phase 4 — Depth, polish & responsive
- Apply the elevation ladder: cards `--shadow-1`, raised/interactive `--shadow-2`, dropdowns/mobile nav `--shadow-3`, lightbox `--shadow-4`.
- Add `--shadow-2` to the sticky header, applied on scroll only.
- Constrain prose to `--w-prose` (68ch) — fixes the ~95ch measure on long-form pages.
- Add skeleton/loading states to the booking widget and gallery.
- Raise sub-24px targets to meet SC 2.5.8 (admin `px-2 py-1` buttons, lightbox close).
- Add `md:` breakpoint coverage — currently 5 uses sitewide.
- Redesign the pricing cards as the visual centerpiece they should be (currently two plain bordered boxes).
- Give the `StayCalendar` selected range a designed treatment: moss fill for endpoints, `--color-moss/10` for the in-between band, clear disabled hatching.

---

## 4. Effort vs. impact

| Phase | Effort | Perceived-quality gain | Fixes |
|---|---|---|---|
| **1 — Foundation + a11y** | ~1 day | **Very high** | Tokens, WCAG 2.4.7 AA, 3 contrast failures, all 60 hover states, fluid type |
| **2 — Primitives** | ~2 days | **High** | Duplication, hierarchy, icon system, disabled/loading states |
| **3 — Brand** | ~2 days | **Very high** | The actual "no brand identity" complaint |
| **4 — Polish** | ~2 days | Medium | Depth, responsive, measure, target sizes |

**Projected score after all four phases: ~85/100.**

If only one phase ships, ship **Phase 1** — it is a single stylesheet plus a find-and-replace, it closes the accessibility failure on the revenue path, and the global transition rule alone changes how the entire site feels to use.

---

## 5. Non-negotiables

Regardless of scope, these three are defects rather than preferences:

1. **`focus:outline-none` ×13** — WCAG 2.2 SC 2.4.7 Level AA failure on every form in the product, including checkout.
2. **`Stars` at 2.15:1** — the primary trust signal is below the 3:1 non-text minimum.
3. **`text-stone-500` at 4.48:1** — misses AA text by 0.02 across 54 guest-facing uses.

---

## Sources

- [Understanding SC 2.4.13: Focus Appearance — W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
- [Accessible Focus Indicators for WCAG 2.4.7 — TestParty](https://testparty.ai/blog/wcag-focus-visible-guide)
- [WCAG 2.2 New Success Criteria: Implementation Guide — TestParty](https://testparty.ai/blog/wcag-22-new-success-criteria)
- [Design Systems in 2026: Scale UI Without the Chaos — Digital Applied](https://www.digitalapplied.com/blog/design-systems-2026-scale-ui-without-chaos-methodology)
- [Modern Fluid Typography Using CSS Clamp — Smashing Magazine](https://www.smashingmagazine.com/2022/01/modern-fluid-typography-css-clamp/)
- [Complete Guide to Modern CSS in 2026 — CSSAWWWARDS](https://cssawwwards.com/blog/complete-guide-modern-css-2026)
- [Responsive Typography Mastery: Fluid Scaling & Hierarchy](https://timgraf.com/ui/responsive-typography-mastery-fluid-scaling-hierarchy-and-readability-strategies-for-multi-device-ux-ui-in-2026/)
- [Top 13 Hotel Website Design Trends for 2026 — Mediaboom](https://mediaboom.com/news/hotel-website-design-trends/)
- [10 Boutique Hotel Website Design Examples & Tips — MotoPress](https://motopress.com/blog/boutique-hotel-website-design/)
- [Hotel Website Design: Best Practices — Cloudbeds](https://www.cloudbeds.com/articles/hotel-website-design/)
