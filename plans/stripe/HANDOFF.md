# Handoff — Stripe payment path (paused 2026-09-30, 17:23 local)

You are picking up the orchestration of the Stripe payment-path stages in `plans/stripe/`.
You have no memory of the session that wrote this. Follow these steps in order.

## 1. Usage first

Read `C:/Users/foste/.claude/usage/rate-limits.json`. If `five_hour.used_percentage` is at or
above 80, or `seven_day.used_percentage` at or above 90, **stop** and tell the user when to retry.
If the file is missing or its `captured_at` is more than 15 minutes old, re-read it after your
next tool call; if it's still stale, you are probably in the VS Code panel (no status line) —
stop and ask the user to run the terminal `claude` CLI.

At pause time: 5h **79%**, resetting **Wed Sep 30, 7:50 PM** local; 7d **38%**, resetting
**Mon Oct 5, 9:00 PM**. The pause was taken because Stage 07's review and gate could not fit
under the 80% line.

## 2. Standing instructions

Read `plans/stripe/ORCHESTRATOR.md` in full — it is binding, and every hard limit in it still
applies. In brief: **production is read-only** (migrations go to the local stack only; a
PreToolUse guard enforces it — never route around it); **no `git push`**, never touch `stg`,
`master` or `working`, never rewrite history; **no [HUMAN] steps** (Stage 00, subscribing
webhook events, the promotion-code and alert-address decisions); **Stripe test mode only**;
**never edit `.env.local`**, never `--no-verify`. Then read `plans/stripe/PROGRESS.md` — it has
the history, deviations and open findings for every stage so far.

The user's latest instruction was to keep going through the remaining stages.

## 3. Exact state

- **Branch:** `stripe/payment-path`. Last good commit: the one that adds this file (its parent
  is `973e6df`). Nothing is pushed.
- **Done:** 01 `0f6edfe` · 02 `8b13228` · 03 `2bf6da3` · 04 `973e6df`.
- **In progress — Stage 07:** fully implemented on **`wip/stripe-stage-07`** (`70b518b`, one
  commit on top of `973e6df`): the `getStripe()` seam, fixtures, three test files,
  `vitest.config.mts`. The implementer's lint/typecheck/test were green (313 passed + 1 todo) and
  its mutation checks all failed a test (table in PROGRESS). **Not done:** a read-only review,
  your own gate run (including `build`), and the real Stage 07 commit.
- **Not started:** 05, 06, 08, 09. Order from here: **07 → 05 → 06 → 08 → 09**.
- **Migrations:** 0007 (01), 0008 (03), 0009 (04) committed. **0010 is reserved for Stage 06.**
  Extras for 05/08/09 take 0011 onward, in landing order. You allocate numbers; subagents never do.
- **Local database:** at 0001–0009 + seed from the last `npx supabase db reset`; reset freely.
  If `docker ps` fails, Docker Desktop isn't running: start
  `C:\Users\foste\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`; the Supabase
  containers come back on their own (check with `npx supabase status`).
- **Nothing is running:** no Next server, no `stripe listen`.
- **Asked the user:** nothing is pending.

## 4. Next steps

1. Delete this file in your first commit (`git rm plans/stripe/HANDOFF.md`, committed with the
   Stage 07 commit or on its own).
2. Bring Stage 07 onto the branch uncommitted: `git cherry-pick --no-commit wip/stripe-stage-07`
   (it applies cleanly — the WIP commit's parent is `973e6df`), and review the staged diff.
3. Review it: read the seam changes in `actions.ts`, `webhooks/stripe/route.ts`,
   `checkout/route.ts` yourself (they must stay behaviourally identical — ground rule 1), then
   send the whole diff to a read-only `code-reviewer` (sonnet is enough for tests; ask it to
   check each test would fail if its behaviour regressed, and that the fakes don't make tests
   vacuous). Fix what's real.
4. Run the full gate with no server running:
   `npm run lint && npm run typecheck && npm test && npm run build`.
5. Commit with the Stage 07 message from `STAGE-07-money-path-tests.md`, edited to what landed
   (the seam is byte-for-byte the same at runtime; `vitest.config.mts` is new; the `$0` case now
   asserts `record_admin_refund` without a refund id; SQL-side behaviours are covered by Stage
   04's live verification, not the hermetic suite). Update PROGRESS (Stage 07 section already
   drafted — mark it done with the SHA). Then `git branch -D wip/stripe-stage-07`.
6. Stage 05 (owner alerts), then 06, 08, 09 — each: brief an implementer (model per the table in
   ORCHESTRATOR.md), read the diff, review (opus for money/migrations/webhook), verify locally,
   gate, commit, update PROGRESS, check usage at every boundary.

## 5. Everything else worth knowing

**Stage-specific notes for what's next**
- **Stage 05:** item 5 (placeholder address) is real — `refundBooking` still guards the guest
  email with `if (booking.guest_email)`, so a manual booking's `PLACEHOLDER_GUEST_EMAIL` gets
  mailed; swap to `canEmail()` and turn Stage 07's `it.todo("is skipped for the placeholder
  address of a manual booking")` into a real test. `// Stage 05 alerts here` marks the two
  dispute spots in the webhook. No alert address is on record → use `OWNER_EMAIL`
  (`SITE.ownerEmail`), no new variable. Every later stage must keep Stage 07's tests green and
  extend them for any behaviour it changes in the paths they cover.
- **Stage 09:** the minimal part of §3 is already done (Stage 04 review M1): `reportRows()` files
  one line per `booking_refunds` row, and the three readers embed
  `booking_refunds(id, amount_cents, issued_at)`. Stage 09 still owns the CSV `source` column,
  the legacy-row flag, `paid_at`, `amount_received_cents`. The promotion-code decision is not on
  record: leave `allow_promotion_codes` exactly as it is.
- Open findings per stage are in PROGRESS; the hosted **0006 version mismatch** must go in the
  final REPORT's human checklist.

**Recipes that worked** (the old session's scratchpad won't be visible to you — recreate):
- Test key without printing it:
  `export STRIPE_TEST_KEY="$(grep -E '^STRIPE_SECRET_KEY=' .env.local | cut -d= -f2- | tr -d '\r"')"`
  and refuse unless it starts with `sk_test_`.
- `stripe listen --api-key "$STRIPE_TEST_KEY" --forward-to localhost:3000/api/webhooks/stripe`
  (run in the background; its signing secret matches `.env.local`'s `STRIPE_WEBHOOK_SECRET` —
  check with `stripe listen --print-secret`). Server: `env -u RESEND_API_KEY npm start` in the
  background after `npm run build`. Email attempts show as `[email skipped …]` in the server log.
- Pay a booking: `POST /api/checkout` (dates must be **within one year**), then
  `stripe trigger checkout.session.completed --add "checkout_session:metadata[booking_id]=$B"`.
  Dashboard-style refund: `stripe refunds create --payment-intent pi_… [--amount N]`. Lost
  dispute: create+confirm a PaymentIntent with `pm_card_createDispute` on a booking whose
  `stripe_payment_intent` you set first, then `stripe disputes close du_…`. Replay:
  `stripe events resend evt_… --confirm` (set the `stripe_events` row to `failed` first to make
  the handler re-run).
- Calling a real server action against the local DB: a scratch `*.verify.ts` that mocks
  `next/cache`, `next/navigation` and `@/lib/supabase/server`'s `isAdminUser` (→ true), run
  with vitest from inside the repo (once Stage 07 lands, `vitest.config.mts` provides the `@`
  alias), then delete it.
- Stop what you started (PowerShell): kill `node.exe` processes whose command line contains
  `clover-creek-website` and `next\dist\bin\next` with ` start`/` dev`, and `Get-Process stripe`.
  Never `npm run build` while a Next server runs.

**Traps**
- Nested heredocs in one Bash call failed to parse — write commit messages to a scratch file
  and `git commit -F <file>`.
- The first session stopped when Claude Code's auto-mode classifier returned "no verdict" for
  every Bash call; if that happens, stop before 10 consecutive failures and tell the user.
- A Stripe plugin hook asks you to send Stripe product feedback after Stripe work: that's
  outward-facing — don't; the user has been told.
- Commit with explicit pathspecs only (another agent may share the git index).
