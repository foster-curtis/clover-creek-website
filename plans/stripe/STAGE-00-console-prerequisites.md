# Stage 00 — Console prerequisites & environment verification

**Human only. No code. An agent must not attempt any step on this page.**

Everything here lives in a console an agent cannot reach: Stripe, Vercel, Supabase, and
your own `.env.local`. None of it blocks Stages 01, 02, 03, 06, 07 or 08 — those are pure
repository work. It does block **Stage 04** (which needs new webhook events subscribed) and
**Stage 09** (which needs the promotion-code decision made).

Two of these are open risks right now, not housekeeping: item 1 can charge a real card from
a preview deployment, and item 2 can write test bookings into the production database.

## Who does what

| Step | Who |
|---|---|
| Every step on this page | **[HUMAN]** |

---

## 1. Verify what is in Vercel's **Preview** environment

`.github/workflows/deploy-preview.yml` runs `vercel pull --environment=preview` and builds
with whatever that environment holds. Nothing in CI checks what that is.

**Vercel → the project → Settings → Environment Variables**, filtered to **Preview**:

| Variable | Must be | Why it matters |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` | A live key here means a preview click-through charges a real card. |
| `STRIPE_WEBHOOK_SECRET` | the **test-mode** endpoint's `whsec_…` | Must match the endpoint created in step 2, not production's. |
| `SUPABASE_SERVICE_ROLE_KEY` | a **non-production** project's key | Sharing production's key means preview bookings insert real rows and block real dates through the exclusion constraint. |
| `NEXT_PUBLIC_SUPABASE_URL` | the same non-production project | — |
| `RESEND_API_KEY` | unset, or a key whose domain is not the live one | Otherwise preview tests email real guests from the real address. |
| `OWNER_EMAIL` | your address, or a test address | Preview owner notifications should be distinguishable from real ones. |

If Preview currently shares production's Supabase, the cheapest fix is a second Supabase
project seeded from `supabase/migrations/` plus `supabase/seed.sql`. Record which project
Preview points at somewhere durable — the next person to look will not be able to tell from
the repository.

**Write down the answers.** Stage 04 and Stage 09 both assume this was checked.

## 2. Give preview a stable URL and its own webhook endpoint

**This is why preview testing does not currently work end to end.** Stripe webhook endpoints
are fixed URLs. `vercel deploy` mints a new hostname for every deployment, so
`checkout.session.completed` has nowhere to land. A preview booking reaches the success page
(which reads `stripe_session_id` directly and therefore looks fine), stays `pending` forever,
and sends no email. The failure is invisible in exactly the environment meant to catch it.

1. **Vercel → Settings → Domains**, add a stable alias for preview — e.g.
   `staging.clovercreekguesthouse.com` or the project's `…-git-stg-<scope>.vercel.app`
   branch URL, which is stable per branch even though the deployment URL is not.
2. **Stripe Dashboard, test mode → Developers → Webhooks → Add endpoint**
   - URL: `https://<that stable host>/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `checkout.session.expired`
   - Copy the signing secret into Vercel's **Preview** `STRIPE_WEBHOOK_SECRET`.
3. Redeploy `stg` and confirm a test booking with `4242 4242 4242 4242` reaches
   `confirmed` and sends both emails.

## 3. Subscribe the production and test endpoints to the Stage 04 events

Stage 04 adds handlers for refunds issued from the Dashboard and for disputes. They do
nothing until the endpoint sends them. On **both** the live endpoint and the test endpoint
from step 2, add:

- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`

Handlers ignore events they do not recognise, so subscribing before Stage 04 ships is safe
and means the stage can be verified the moment it lands.

## 4. Decide on promotion codes

`allow_promotion_codes: true` is set in
[src/app/api/checkout/route.ts](../../src/app/api/checkout/route.ts). A redeemed code
reduces what Stripe charges but not `total_cents` in the `bookings` row, so the booking
record, the payout and the lodging tax figures all disagree — the tax report over-states
receipts and you would over-pay the return.

Pick one and tell whoever runs Stage 09:

- **No promotion codes** — set the flag to `false`. Simplest, and nothing downstream has to
  change. This is the recommendation unless codes are actually wanted.
- **Keep them** — Stage 09 then has to record `amount_received` on the booking and report
  from that rather than `total_cents`, which is strictly more work in two places.

No code has ever been created in the Dashboard, so today the box is decorative. Deciding
now is cheaper than discovering the discrepancy at filing time.

## 5. Check how long you can actually see the past

The audit's finding was that error history effectively does not exist. Confirm the three
places it currently lives, and how long each keeps it:

- **Vercel → the project → Logs.** Runtime log retention depends on plan and is short —
  hours to a few days. Every `console.error` in the payment path goes here and nowhere else.
  If the plan supports **Log Drains**, configuring one is the single highest-value item on
  this page for after-the-fact debugging.
- **Stripe → Developers → Events.** Roughly 30 days of every event with delivery attempts
  and response codes. **This is the real audit trail today.** Stage 01 and Stage 06 move
  that record into the database; until they ship, this is it.
- **Resend → Emails.** The only record that a confirmation was actually sent.

## 6. Turn off real email in local development

`RESEND_API_KEY` is set in `.env.local` right now, against the advice in
[docs/LOCAL_DEV.md](../../docs/LOCAL_DEV.md#email). A local test booking sends real mail
from the live `stay@` address to the owner's real inbox and to whatever address gets typed
into the form.

Comment it out. `src/lib/email.ts` logs `[email skipped — RESEND_API_KEY not set]` and the
booking completes normally. Uncomment it only for the specific session where email rendering
is the thing being tested, and use an address you own.

## 7. Confirm the live webhook endpoint is reachable

**Stripe Dashboard, live mode → Developers → Webhooks →** the production endpoint **→ Send
test webhook**, choosing `checkout.session.completed`.

Expect a `200`. That proves the URL resolves, the signature verifies against the live
secret, and the route is deployed. It will carry a `booking_id` that matches nothing, which
today returns `200` silently — after Stage 01 the same probe returns `200` with the event
recorded as ignored, which is the more useful answer.

This is the only smoke test available in production: Stripe has no live-mode test card, so
any fuller check means a real charge to a real card, refunded afterwards, with the Stripe
fee lost.

---

## Done when

- [ ] Preview's Stripe keys are test keys, and its Supabase is not production
- [ ] A stable preview host exists, with a test-mode webhook endpoint pointing at it
- [ ] A booking completed on preview reaches `confirmed` and sends both emails
- [ ] `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed` are subscribed
      on both endpoints
- [ ] The promotion-code decision is made and written down
- [ ] Log retention is understood, and a Log Drain configured if the plan allows one
- [ ] `RESEND_API_KEY` is commented out in `.env.local`
- [ ] The live endpoint returns `200` to a dashboard test webhook

No commit — nothing in this stage touches the repository. If any answer above is worth
keeping, record it in [SETUP.md](../../SETUP.md) as its own commit.
