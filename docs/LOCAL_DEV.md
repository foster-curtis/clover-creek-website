# Local Development

How to run the whole stack on your laptop — database, auth, email and payments — without
touching production.

[SETUP.md](../SETUP.md) is about connecting the live services. This is about the local
copies of them.

---

## The one thing to understand

There are two completely separate databases:

- **Local** — Postgres and the rest of Supabase running in Docker on your machine.
  Disposable. Reset it as often as you like.
- **Production** — the hosted project this repo is linked to, which holds real bookings
  and real money.

**Only these commands touch production:** `supabase db push`, `supabase db pull`,
`supabase db dump`, and anything you pass `--linked` or `--db-url` to. Everything else
below is local-only and cannot affect the live site.

---

## First run

You need **Docker Desktop** installed and running — the Supabase stack is a set of
containers. Start Docker and wait for it to report the engine is running.

```bash
npm install
npx supabase start     # first run pulls images; several minutes
npm run dev            # http://localhost:3000
```

`supabase start` prints the local URLs and keys when it finishes. `npx supabase status`
prints them again any time.

| Service | URL |
| --- | --- |
| API | http://127.0.0.1:54321 |
| **Studio** — table browser, SQL editor | http://127.0.0.1:54323 |
| **Inbox** — every email auth sends | http://127.0.0.1:54324 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

The ports are pinned in [config.toml](../supabase/config.toml), so they are the same on
every machine.

### Environment

`.env.local` should point at the local stack, not the hosted project:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key from `supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<the service_role key from `supabase status`>
```

Those keys are fixed demo keys shared by every local Supabase install. They are not
secret and they are useless against production.

---

## Signing in

The seed data creates two accounts, both with the reserved `.test` domain so nothing can
ever be delivered to a real person:

| Address | Role |
| --- | --- |
| `owner@clovercreek.test` | admin — full dashboard |
| `guest@clovercreek.test` | ordinary visitor |

Go to [/login](http://localhost:3000/login), enter the address, then open
**http://localhost:54324** and click the magic link in the message waiting there. That
inbox catches every email GoTrue sends locally; nothing leaves your machine.

Both accounts also have the password `localdev`, if you want to sign in from Studio or a
SQL client. The site itself only ever uses the magic link.

---

## Email

Two different systems, and it matters which is which:

- **Supabase auth mail** (magic links, email-change confirmations) → always caught by the
  local inbox at **http://localhost:54324**. Nothing to configure.
- **Transactional mail** (booking confirmations, owner notifications) goes through
  **Resend**, which has no local equivalent. If `RESEND_API_KEY` is set in `.env.local`,
  a test booking sends a **real email to a real inbox**.

  Comment the key out while testing bookings. With it unset,
  [src/lib/email.ts](../src/lib/email.ts) logs `[email skipped — RESEND_API_KEY not set]`
  and the booking still completes, which is usually what you want.

---

## Seed data

[supabase/seed.sql](../supabase/seed.sql) runs automatically at the end of every
`supabase db reset`, and on the first `supabase start` against an empty volume. It gives
you a working site immediately: the two accounts above, six bookings spread across past
and future (including a refunded stay and an expired hold), reviews with one awaiting
approval, an open inquiry, a chat thread, a published blog post and a draft, and a
blocked week.

**It re-inserts what is in the file; it does not preserve what is in your database.**
Anything you create by clicking around is destroyed by the next reset. To change what you
start with, edit `seed.sql` and reset — treat the file as the definition of the fixture.

It refuses to run against any database that already holds users or bookings it did not
create, so it cannot be misfired at production.

`public.site_content` is left empty on purpose: every slug falls back to the copy in
[src/lib/content.ts](../src/lib/content.ts), so an empty table is the true "unedited site"
state.

---

## Migrations

Migrations are numbered by hand — `0001_init.sql` through `0005_record_refunds.sql`.
Keep that convention rather than using `supabase migration new`, which generates
timestamped names that sort inconsistently with the existing ones.

```bash
# 1. Write supabase/migrations/0006_your_change.sql

# 2. Wipe local, replay every migration from 0001, re-seed. LOCAL ONLY.
npx supabase db reset
```

`db reset` is the whole development loop. It is fast, it is safe, and a broken migration
costs you ten seconds. Run it as often as you like.

When the migration is right and committed:

```bash
npx supabase migration list   # local vs remote, side by side
npx supabase db push          # applies pending migrations to PRODUCTION
```

Migrations run in filename order, so a migration must never be edited after it has been
pushed — by then production has already run the old version. Write a new one instead.

---

## Stripe

Stripe cannot reach `localhost`, so webhooks need forwarding through the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Put the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET` in `.env.local`. It is a
different secret from the dashboard one used in production, and it changes each time you
start `stripe listen`.

Use test keys (`sk_test_…`). Test cards and the end-to-end cases worth exercising are in
[STRIPE_INTEGRATION_TODO.md](../STRIPE_INTEGRATION_TODO.md#testing).

---

## Stopping and troubleshooting

```bash
npx supabase stop               # stop containers, keep the local data
npx supabase stop --no-backup   # stop and discard the local data
npx supabase status             # URLs and keys of a running stack
```

**"failed to connect to the docker API"** — Docker Desktop isn't running. Start it and
wait for the engine.

**A port is already in use** — something else is on 54321-54324, often a Supabase stack
left running for a different project. `npx supabase stop` in that project, or
`docker ps` to find it.

**The stack is running but the site sees no data** — check `.env.local` is pointing at
`127.0.0.1:54321` and restart `npm run dev`; Next.js reads env vars at boot.

**A reset failed partway** — `npx supabase stop --no-backup` then `npx supabase start`
gives you a clean volume.
