# Stage 05 — FAQ rebuild & direct-answer blocks

**Source:** SEO_PLAN.md §12.1, §12.2, §8.3, defect A10.

**Depends on:** Stage 03 (`JsonLd`). Independent of Stage 04, but if Stage 04 has run, keep
the breadcrumb at the top of `/faq`.

## Goal

Two things AI answer engines reward, and this site currently gets wrong:

1. **Collapsed content is a known weak spot** (§3.2). Every FAQ answer lives inside a
   `<details>` element, and every question is a `<summary>` rather than a heading. The text
   *is* in the raw HTML, but the structure tells a parser nothing.
2. **Nothing on the site answers its core question in the first 60 words.** §12.1 asks for
   a short, self-contained, quotable paragraph near the top of every important page.

## Who does what

| Step | Who |
|---|---|
| 1–7 (all code) | **[AGENT]** |
| Reviewing and improving the six new default answers | **[HUMAN]** — Admin → Site Content, after deploy |

The agent ships conservative, factually safe defaults for the new questions. They are
honest but generic; the owner's real answers will be better and are edited in the admin
panel with no code change. **The agent must not invent specifics** — no drive times to the
Onaqui range, no Bortle numbers, no winter activity claims it cannot source.

---

## Steps

### 1. **[AGENT]** Add six new content slugs

In [src/lib/content.ts](../src/lib/content.ts), add to `CONTENT_SLUGS` and
`DEFAULT_CONTENT`. Adding a slug automatically adds a field to Admin → Site Content — no
admin-page change is needed.

§12.2 lists nine suggested questions; three of them (groceries, two dogs, distance from
Salt Lake City) are already answered by existing slugs, and one (minimum stay) is generated
from live pricing in step 3. These six are the genuinely new ones:

| Slug | Question it answers | Default answer to ship |
|---|---|---|
| `faq_airport` | How far is the house from Salt Lake City International Airport? | `About an hour's drive from the airport, on the same route as downtown Salt Lake City — head southwest around the Oquirrh Mountains.` |
| `faq_onaqui` | Can I see the Onaqui wild horses from the guest house? | `Not from the porch — the Onaqui herd ranges in the hills west of the valley, so you drive out to find them. Sightings are common but never guaranteed; the herd moves with the season and the weather.` |
| `faq_cell` | Is there cell service in Rush Valley? | `Yes. Cell service in the area is reliable on essentially every carrier, and there is Wi-Fi at the guest house.` |
| `faq_stargazing` | Is the property good for stargazing? | `Yes — that is one of the main reasons people come. There is no town light nearby, so on a clear moonless night the sky is genuinely dark from the fire pit. Bring a red flashlight and let your eyes adjust for twenty minutes.` |
| `faq_winter` | What is there to do near Rush Valley in winter? | `Winter is the quiet season here, and the nights are the longest and clearest of the year for stargazing. Salt Lake City and its canyons are about an hour away, and Tooele is roughly half an hour for supplies.` |
| `faq_things_nearby` | What is there to do nearby? | `The valley sits near the Onaqui wild horse range, the Pony Express Trail, and day-trip drives out to the Bonneville Salt Flats. Our Area Guide covers each one in detail.` |

**Every one of these is deliberately free of unverified numbers.** The only figures reused
are ones already published on the live site (about an hour to Salt Lake City, about thirty
minutes to Tooele). Do not add distances to the Onaqui range, the salt flats, or the Pony
Express Trail — those are unmeasured (Stage 00 §A) and Stage 09 renders them once the owner
supplies them.

Write a `hint` for each slug in the same voice as the existing ones, so the admin form
explains what the field is for.

### 2. **[AGENT]** Create `src/lib/faq.ts`

One list of questions, consumed by both the page and the `FAQPage` markup, so the two can
never fall out of sync.

```ts
import type { ContentSlug } from "./content";

export interface FaqItem {
  /** Stable anchor id — used for #deep-links and never changed once published. */
  id: string;
  question: string;
  /** Owner-editable answer body. */
  slug: ContentSlug;
  /**
   * Extra content the page renders after the answer text. The schema uses the
   * plain answer only, so anything here must be supplementary, never load-bearing.
   */
  extra?: "pets" | "cancellation";
}

export const FAQ_ITEMS: FaqItem[] = [
  { id: "check-in",    question: "What time is check-in and check-out?",             slug: "faq_checkin" },
  { id: "fees",        question: "Are there extra fees on top of the nightly rate?", slug: "faq_fees" },
  { id: "guests",      question: "How many people can stay?",                        slug: "faq_guests" },
  { id: "pets",        question: "Can I bring my dog?",                              slug: "faq_pets", extra: "pets" },
  { id: "wifi",        question: "Is there Wi-Fi at the guest house?",               slug: "faq_wifi" },
  { id: "cell",        question: "Is there cell service in Rush Valley?",            slug: "faq_cell" },
  { id: "distance",    question: "How far is the house from Salt Lake City?",        slug: "faq_distance" },
  { id: "airport",     question: "How far is the house from Salt Lake City airport?",slug: "faq_airport" },
  { id: "grocery",     question: "Where is the nearest grocery store and gas?",      slug: "faq_grocery" },
  { id: "stargazing",  question: "Is the property good for stargazing?",             slug: "faq_stargazing" },
  { id: "onaqui",      question: "Can I see the Onaqui wild horses from the guest house?", slug: "faq_onaqui" },
  { id: "nearby",      question: "What is there to do nearby?",                      slug: "faq_things_nearby" },
  { id: "winter",      question: "What is there to do near Rush Valley in winter?",  slug: "faq_winter" },
  { id: "cancel",      question: "Can I cancel my booking?",                         slug: "faq_cancel", extra: "cancellation" },
];
```

Question wording matters here: these are phrased the way a person types them into an
assistant, which is the entire point of §12.2.

### 3. **[AGENT]** Add the minimum-stay question, generated from live pricing

Do **not** make this a content slug. `PricingConfig.minStayNights` already exists (default
`1`) and drives the booking engine — a hand-written answer could contradict it. Render it in
the page from `pricing.minStayNights`:

- `1` → "No — we accept single-night bookings."
- `n > 1` → "Yes — the minimum stay is {n} nights."

Give it the stable id `minimum-stay` and place it after `fees`. Include it in the
`FAQPage` markup with the same generated text.

### 4. **[AGENT]** Rebuild `/faq` (defect A10)

Rewrite [src/app/faq/page.tsx](../src/app/faq/page.tsx):

- **Every question becomes an `<h2>`** with `id={item.id}` and `scroll-mt-24` so anchor
  links land cleanly below the sticky header.
- **Every answer is visible body text.** Remove `<details>`/`<summary>` entirely — no
  expand/collapse, on any answer. §12.2 permits keeping it for unusually long answers; none
  of these qualify.
- Keep the existing rich extras: the pet-policy link on `pets`, and the refund-tier list
  plus account link on `cancellation`, driven by the `extra` field.
- Add a table-of-contents list of anchor links at the top. It gives the page internal
  structure and gives Google jump-link candidates.
- Keep the existing `revalidate = 3600` and the Stage 01 `pageMetadata()` call.

Layout suggestion, matching the site's existing card style:

```tsx
<section key={item.id} className="rounded-xl border border-stone-200 bg-white p-5">
  <h2 id={item.id} className="scroll-mt-24 font-semibold text-stone-800">{item.question}</h2>
  <div className="mt-2 leading-relaxed text-stone-600">{answer}</div>
</section>
```

### 5. **[AGENT]** Add `FAQPage` markup (§8.3)

In [src/lib/schema.ts](../src/lib/schema.ts):

```ts
export function faqPageSchema(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
}
```

Feed it the **plain-text** answers — the raw content-slug strings plus the generated
minimum-stay sentence. For the two items with `extra` content, append a plain-text version
of the extra (the pet-policy sentence; the refund tiers rendered with `describeRefund()`)
so the markup and the page say the same thing. Never put JSX or HTML in `acceptedAnswer`.

> Google deprecated FAQ rich results on 7 May 2026 (§3.1). This markup will not produce a
> SERP feature and is not expected to. It is here because AI engines parse Q&A pairs well
> and it costs nothing. Do not report it as a rich-result win.

### 6. **[AGENT]** Direct-answer blocks (§12.1)

Create `src/lib/answers.ts` — 40–60 word, self-contained, quotable paragraphs built from
live data so no number can drift:

```ts
import type { PricingConfig } from "./pricing";
import { formatUSD } from "./pricing";
import { SITE } from "./site";

/**
 * A 40-60 word paragraph that answers the page's core question in complete
 * sentences, quotable without surrounding context (SEO_PLAN.md §12.1). Every
 * number comes from live config so the copy can never contradict the booking engine.
 */
export function homeAnswer(pricing: PricingConfig): string {
  return `${SITE.name} is a farmhouse cottage in Rush Valley, Utah, about an hour southwest of Salt Lake City. It sleeps ${pricing.maxGuests}, welcomes up to ${pricing.maxPets} dogs, and sits on a working farm under some of the darkest skies in northern Utah. Rates start at ${formatUSD(pricing.weekdayBase)} a night with cleaning and taxes included.`;
}

export function bookAnswer(pricing: PricingConfig): string { /* … */ }
```

Then a small `src/components/AnswerBlock.tsx` that renders one as a lead paragraph —
larger type, `text-stone-700`, no card chrome. It must read as the page's opening sentence,
not as a callout box.

Place it:

| Page | Position |
|---|---|
| `/` | Immediately under the hero, above "A cozy retreat on a working farm" |
| `/book` | Under the `<h1>`, replacing or preceding the existing intro line |
| `/faq` | Under the `<h1>`, above the table of contents |

The `/book` and `/faq` paragraphs should answer *those* pages' questions (what booking
direct gets you; what the house is and where), not repeat the home page verbatim — near
duplicate text across pages is exactly what §3.1 warns gets suppressed.

Keep the wording aligned with `SITE.description` and with what the owner writes on Airbnb
and Yelp. That consistency is the mechanic (§6.2, §11.4).

### 7. **[AGENT]** Verify

```
npm run lint && npm run typecheck && npm test && npm run build
npm run dev
curl -s http://localhost:3000/faq | grep -c '<details'          # expect 0
curl -s http://localhost:3000/faq | grep -o '<h2 id="[a-z-]*"'  # expect 15
curl -s http://localhost:3000/faq | grep -o '"@type":"Question"' | wc -l
```

Then read the three answer blocks out loud. If a sentence needs the page around it to make
sense, it is not a direct answer — rewrite it.

**[HUMAN]** *After deploy:* open Admin → Site Content and replace the six default answers
with real ones. The defaults are safe, not good.

---

## Do not

- Do not invent a distance, drive time, Bortle rating, or seasonal claim. If the answer
  needs a number that has not been measured, write the answer without the number.
- Do not keep `<details>` anywhere on `/faq`.
- Do not put the minimum-stay answer in a content slug — it must track
  `pricing.minStayNights`.
- Do not put HTML inside `acceptedAnswer.text`.
- Do not link to a specific blog post slug from an FAQ answer. A slug hardcoded in a
  content-slug string is unchecked either way — before Stage 06 a post can be unpublished
  from the admin panel, and after it a file can be renamed — and both produce a 404 that
  nothing catches. Link to `/blog`; Stage 10 adds per-post links that are checked against
  the registry.

## Acceptance criteria

- [ ] `/faq` renders 15 questions as `<h2>` elements with stable anchor ids and visible
      answers; no `<details>` remains.
- [ ] The minimum-stay answer reflects `pricing.minStayNights`.
- [ ] `FAQPage` markup is present, plain-text only, and matches the visible answers.
- [ ] The six new answers are editable in Admin → Site Content.
- [ ] `/`, `/book` and `/faq` each open with a distinct 40–60 word direct-answer paragraph
      whose numbers come from live config.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass.
- [ ] The site renders with no `.env.local` present (defaults supply every answer).

## Commit

```
Rebuild the FAQ as visible headings and add direct-answer blocks

Replaces the collapsed <details> pattern with h2 questions and visible
answers, adds six questions people actually ask an assistant, generates the
minimum-stay answer from live pricing, and adds FAQPage markup. Adds 40-60
word direct-answer paragraphs to /, /book and /faq.
Fixes SEO_PLAN.md defect A10 and implements §12.1, §12.2.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
