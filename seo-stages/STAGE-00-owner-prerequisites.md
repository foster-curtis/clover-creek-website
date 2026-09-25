# Stage 00 — Owner prerequisites & off-site work

> **HUMAN ONLY. There is no code in this stage.** An agent must not attempt any item
> here, must not invent answers to the decisions, and must not tick any box on the
> owner's behalf. If you are an agent and you were pointed at this file, the correct
> action is to tell the user which decisions are outstanding, and stop.

**Source:** SEO_PLAN.md §6.1–6.3, §11, §13.2, §14, Phase 0 and Phase 4.

## Why this exists as a stage

Roughly 60% of the value in SEO_PLAN.md is off-site (§3.3): entity consistency across
Yelp, TripAdvisor, Airbnb and the tourism directories is what makes AI engines confident
enough to name this property. None of that lives in a repository.

The code stages are written so that **nothing here blocks them**. Every field the owner
has not yet decided is emitted conditionally — no phone number means no `telephone` in
the schema and no phone in the footer, not a broken build. Deliver the decisions when they
are ready and the site picks them up.

## Who does what

| Task | Who |
|---|---|
| Every item on this page | **[HUMAN]** — the owner, in a browser |
| Wiring a decision into code once it is made | **[AGENT]** — see "Handing results back" |

---

## A. Blocking decisions (SEO_PLAN.md Phase 0)

These gate the off-site work in section D. None of them gate a code stage.

- [x] **Publish a phone number** — **landed 2026-09-24**: `385-204-6622`, the Google Voice
      number decided on 2026-09-23. `NEXT_PUBLIC_PHONE` is now set in **every environment**
      (local `.env.local` and Vercel development, preview and production), and the same
      value is the default in `.env.example`. This was **the single biggest blocker in
      Stage 00** (§6.3) and it no longer gates section D: every listing there can now be
      filed with a phone number, and the number becomes the fourth field of the
      byte-identical NAP rule (§6.2).

      Two things the landing does *not* settle:

      - [ ] **[HUMAN]** Consider re-setting the value to E.164 form, `+1-385-204-6622`.
            §6.3 asked for E.164 and `src/lib/schema.ts` emits `telephone` verbatim, so the
            country code is what lets an engine match the site's entity to the directory
            listings. Change it in Vercel and `.env.local` together and update
            `.env.example` to match — whichever form is chosen has to be the form used on
            every listing in section D.
      - [ ] **[AGENT]** **The number is currently invisible to human visitors.**
            `SITE.phoneDisplay` is read in `src/lib/schema.ts` and nowhere else, so the
            number reaches the JSON-LD but not the page. **Stage 03 step 6** — the footer
            NAP block (§6.4) — has not shipped, and Stage 08's About-page NAP block reads
            the same value. Until step 6 runs, a crawler sees the phone and a guest does
            not.
- [x] **Business email** — decided 2026-09-23, and it is **two addresses, not one** (§6.3):
      - `stay@clovercreekguesthouse.com` is the domain `EMAIL_FROM` alias, verified in
        Resend. It is **send-only — there is no inbox behind it**, which is why every send
        in `src/lib/email.ts` sets `Reply-To` to a real address.
      - `clovercreekguesthouse@gmail.com` is the monitored inbox and the value of
        `OWNER_EMAIL` in Vercel. This is the one rendered publicly (footer, contact,
        privacy, terms) and the one that must appear on every directory listing in
        section D, so it is the address the byte-identical NAP rule applies to.
- [x] **Canonical host** — confirmed 2026-09-23: **`www`**, already configured. Stage 01
      proceeds on that assumption; `.env.example` still shows the apex host and Stage 01
      §7 corrects it.
- [x] **Street address** — decided 2026-09-08: `1475 W Hwy 199` is published in the schema.
      If that is ever reversed it must be pulled from `src/lib/schema.ts` and every
      external listing on the same day; a half-removed address is worse than either
      choice (§6.2).
- [x] **Distances and drive times** — supplied by the owner 2026-09-23. Stage 09 fills
      `src/lib/local.ts` from the table below and flips `verified: true` on these rows.
      Drive times are the owner's mapped estimates, not stopwatch figures, so the copy
      should round them ("about an hour") rather than quote them to the minute.

      | Destination | Miles | Drive time |
      |---|---|---|
      | Grantsville | 22 | ~27 min |
      | Onaqui wild horse range | 37 | ~60 min |
      | Bonneville Salt Flats | 116 | ~1 hr 40 min |
      | Pony Express Trail trailhead | 16 | ~16 min |
      | Dugway | 19 | ~27 min |
      | Vernon | 22 | ~21 min |
      | Salt Lake City International Airport (SLC) | 51 | ~57 min |

## B. Measurement baseline — do this first (§13.2, §14.1)

Nothing in this plan can be evaluated without a starting point, and the baseline has to be
recorded *before* Stage 01 ships.

- [x] **[HUMAN]** Verified in **Google Search Console** and sitemap submitted (2026-09-23).
- [x] **[HUMAN]** Verified in **Bing Webmaster Tools** and the same sitemap submitted
      (2026-09-23). Bing feeds Microsoft Copilot.
- [ ] **[HUMAN]** Record the baseline table from §14.1: indexed pages, 28-day impressions
      and clicks, branded query position, direct bookings per month, referral sources,
      backlink count.
- [ ] **[HUMAN]** Run the six AI prompts in §12.6 against ChatGPT, Perplexity, Gemini and
      Claude, and log what each one cites. Expect near-zero on the five unbranded prompts —
      that is the point of a baseline.

## C. Admin-panel content work (§9.3, §12.2)

Browser work against the live database, in the site's own `/admin` panel. An agent cannot
do this: it writes to Supabase.

- [x] **[HUMAN]** *(Done 2026-09-23.)* **Rewrite all fifteen gallery alt texts** in Admin → Gallery. Every photo
      currently carries the same alt text, `"Clover Creek Guest House"`, so fifteen real
      assets contribute nothing (§9.1). Patterns to adapt are in §9.3 — 80–140 characters,
      describe what is actually in the frame, location words only on exteriors and views.
      **Thirty minutes, and one of the top five items in the entire plan** (§16).
- [x] **[HUMAN]** *(Done 2026-09-23.)* Add a caption to each gallery photo while you are in there. Stage 07
      makes captions visible in the grid, and caption text is a real Google Images signal
      (§9.6).
- [ ] **[HUMAN]** *After Stage 05 ships:* review the nine new FAQ answers in Admin → Site
      Content. They ship with honest, conservative defaults; the owner's real answers are
      better.
- [ ] **[HUMAN]** *After Stage 08 ships:* write the About page story in Admin → Site
      Content.

> **The blog is no longer edited here.** From Stage 06 the thirteen Area Guide posts live
> in the repository as `.mdx` files and the Admin → Blog section is removed. Everything
> else on this list is unaffected — site copy, FAQ answers, house rules, gallery, pricing
> and reviews all stay in the admin panel. See section G for what the owner contributes to
> the posts instead.

## D. Tier 1 citations — the branded-search fix (§11.1)

The site does not currently rank for its own name (§1, defect 2). These listings are the
direct antidote, and each one becomes a `sameAs` entry in the schema.

- [ ] **[HUMAN]** **Claim the Yelp listing and correct "Clover Creek Guesthouse" to
      "Clover Creek Guest House"** (two words). The Yelp entity currently outranks the real
      site for its own brand name. **Highest-priority item in this section.**
- [ ] **[HUMAN]** **TripAdvisor.** Perplexity cites TripAdvisor in roughly 95% of travel
      answers — the single highest-leverage AI-visibility action available.
- [ ] **[HUMAN]** Bing Places (feeds Copilot), Apple Business Connect (Maps and Siri),
      BringFido (already ranks for `pet friendly Tooele`), a Facebook Page, Instagram.
- [ ] **[HUMAN]** **Do not create a standard Google Business Profile** without re-reading
      §6.1. Individual rentals without on-site staff are generally ineligible and get
      suspended, and a suspension is harder to unwind than never having filed.

**Use byte-identical NAP on every one of these** (§6.2): "Clover Creek Guest House",
`Rush Valley, UT 84069`, `https://www.clovercreekguesthouse.com` (www, https, no trailing
slash). Every variant splits the entity and undoes the point of the exercise.

## E. Tier 2 and 3 authority (§11.2, §11.3) — months 2–4

- [ ] **[HUMAN]** Ask Explore Tooele County and Visit Tooele County to add the property to
      their lodging pages.
- [ ] **[HUMAN]** Join the Tooele County Chamber of Commerce.
- [ ] **[HUMAN]** Enquire about a Utah Office of Tourism partner listing — the
      highest-authority target on the list.
- [ ] **[HUMAN]** Approach Royal Creek Ranches about mutual referrals. A 17-bedroom retreat
      centre and a 6-guest farmhouse serve opposite ends of the market, so overflow
      referrals run both directions (§5.2).
- [ ] **[HUMAN]** Reach out to dark-sky and Onaqui wild-horse communities.
- [ ] **[HUMAN]** Investigate Google Vacation Rentals free booking links (§6.1) — the only
      legitimate Google route for a rental, and the only thing that would make the existing
      `VacationRental` schema capable of a rich result.
- [ ] **[HUMAN]** Keep the Airbnb and VRBO listings live, worded identically to the site
      (§11.4). Delisting removes the property from the corpus AI engines read most.

## F. Original photography (§9.5)

- [ ] **[HUMAN]** Photograph, in priority order: the Onaqui wild horses, the Bonneville
      Salt Flats, a Pony Express marker, the night sky from the fire pit, a hunting-season
      scene, a Tooele County rodeo. One to three per blog post.
      **Original matters more than polished.** A stock wild-horse photo is worthless; a
      slightly crooked one taken from the road outside is an E-E-A-T signal no aggregator
      can fake. Stage 06 builds the plumbing to display them.
- [ ] **[HUMAN]** Hand the photos over with a one-line note each: what it is, where it was
      taken, roughly when. That note becomes the alt text and the caption, and it is
      information nobody else has.

## G. What the owner contributes to the blog now (§9.5, §12.4)

Stage 06 moves the posts into the repository, so the owner no longer types them — but the
posts are still theirs, and the part that matters most is still theirs to supply.
§9.5 needs all thirteen expanded from ~340 to 800–1,200 words, and §12.4 is explicit about
why that has to come from the owner:

> *"We watched the Onaqui herd cross the road below the house last April" outperforms "The
> Onaqui herd can be seen in the area." Experience is the amplified E-E-A-T signal, and it
> is the one thing an aggregator structurally cannot produce.*

An agent can draft, structure, link and format. It cannot know what crossed the road last
April.

- [ ] **[HUMAN]** For each priority post, give a developer or an agent rough notes: what
      you actually know, what you tell guests who ask, what you have seen, what the common
      mistakes are, which months are right. Bullet points are fine — a voice memo is fine.
      **This is the raw material for the whole content push.**
- [ ] **[HUMAN]** Read back each expanded post before it ships. An agent will not know it
      has got a local detail subtly wrong; you will.
- [ ] **[HUMAN]** For a genuinely new post idea, say the idea and the facts. The drafting is
      developer work now.

---

## Handing results back to an agent

When a decision lands, the code change is small and an agent can make it:

| Decision | What changes, and who |
|---|---|
| Phone number | **Done 2026-09-24** — set in Vercel **[HUMAN]** and added to `.env.example` **[AGENT]**. The schema picks it up automatically; the footer does not until Stage 03 step 6 ships. |
| Domain email | Set `OWNER_EMAIL` in Vercel **[HUMAN]**; update the `.env.example` default **[AGENT]**. |
| Canonical host | Handled in Stage 01. If the answer is "apex", say so before Stage 01 runs. |
| Verified distances | Fill in `src/lib/local.ts` and flip `verified: true` **[AGENT]**, using figures the owner measured. |
| Live listing URLs | Add each URL to `SITE.sameAs` **[AGENT]** — see Stage 03. |
| Owner name and photo | Set `SITE.owner` and add `public/about-owner.jpg` **[AGENT]** — see Stage 08. |
| Post photographs | Add to `src/content/blog/images/` and reference from the post's `meta.cover` **[AGENT]** — see Stage 06. |
| Notes for a post expansion | Drafted into the `.mdx` file **[AGENT]**, then read back by the owner before it ships. |

## Acceptance

This stage is never "done" — sections E, F and G are ongoing. It is **ready enough** for
the code stages when section A's phone-number and canonical-host decisions are made and
section B's Search Console verification is complete. **All three of those conditions have
been met as of 2026-09-24**, so no code stage is waiting on this page any longer; what is
left here is the off-site work in sections D–G.

## Commit

Nothing to commit — no files in this repository change. The one exception has now been
taken: the phone number landing on 2026-09-24 put a real default into `.env.example`, which
is the `[AGENT]` half of the handing-back row above.
