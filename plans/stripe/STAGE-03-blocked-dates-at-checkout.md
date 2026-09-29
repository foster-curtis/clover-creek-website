# Stage 03 — Blocked dates enforced at checkout

**Depends on:** nothing. Independent of Stages 01 and 02.

A guest can pay for dates the owner has blocked off. The block exists in the calendar UI and
nowhere else on the path that takes the money.

## Who does what

| Step | Who |
|---|---|
| Migration, checkout route check, admin-side guard, tests | **[AGENT]** |
| Nothing | [HUMAN] |

---

## Why

`bookings_no_overlap` in [supabase/migrations/0001_init.sql](../../supabase/migrations/0001_init.sql)
is an exclusion constraint on `bookings` alone. It makes double-booking impossible between
two bookings and says nothing about `blocked_dates`.

Trace where a block is actually consulted:

- [src/lib/data.ts](../../src/lib/data.ts) — `getUnavailableRanges()` merges blocks into the
  ranges the calendar greys out. **This is the only place.**
- [src/app/api/checkout/route.ts](../../src/app/api/checkout/route.ts) — never reads the
  table. `validateStay()` checks dates, occupancy and pets, not availability.

So the block is a UI hint. Two ordinary situations defeat it:

1. A guest has `/book` open, the owner blocks a week in `/admin/calendar`, the guest picks
   those dates from the stale calendar and pays.
2. Anything that posts to `/api/checkout` directly.

The result is a completed payment for a week the owner needs for themselves, discovered
either at the calendar or at the front door. Unwinding it means a manual refund, and the
Stripe fee is gone either way.

The reverse gap is the same bug from the other side: `blockDates()` in
[src/app/admin/actions.ts](../../src/app/admin/actions.ts) inserts a block over dates that
already hold a confirmed booking without a word of complaint. The owner ends up with a
calendar that shows a date as both blocked and booked, and no indication which came first.

## What to change

### 1. Check availability in the checkout route

Before the `bookings` insert, and after `expire_stale_holds()`:

```ts
const { data: clash } = await db
  .from("blocked_dates")
  .select("id")
  .overlaps("span", `[${checkIn},${checkOut})`)
  .limit(1);
if (clash?.length) return 409 with the same copy the booking conflict uses;
```

- **Reuse the existing 409 message** — "those dates were just booked by someone else" is
  what the guest needs to know and a block is not their business. One conflict message, one
  status code.
- **Check the error, not just the data.** A failed read must not fall through to the insert;
  that would reintroduce the fail-open this stage exists to close. On error, return the
  existing 500.
- Confirm `.overlaps()` is the right PostgREST operator for a `daterange` column in the
  installed client version before relying on it. The fallback is an RPC wrapping the `&&`
  operator, which is also the safer choice if the half-open semantics are at all uncertain
  — `[a,b)` must not clash with `[b,c)`.

### 2. Migration `supabase/migrations/0008_bookings_respect_blocks.sql`

The route check closes the realistic path. The database should close it outright, because
`createManualBooking()` bypasses the route entirely and so would any future admin path.

Postgres exclusion constraints work within one table, so this is a pair of triggers:

- `BEFORE INSERT OR UPDATE ON bookings` — raise when `status IN ('pending','confirmed')` and
  `stay` overlaps any `blocked_dates.span`.
- `BEFORE INSERT ON blocked_dates` — raise when `span` overlaps an active booking.

Two things to be honest about in the migration's comments:

- **A trigger is not an exclusion constraint.** Two concurrent transactions can each pass
  their check before either commits. Take `pg_advisory_xact_lock()` on a fixed key at the
  top of both trigger functions so they serialise, and say in the comment that this is why
  the lock is there — otherwise someone will remove it as noise.
- **Use a distinct SQLSTATE**, and have the route map it to the same 409 the exclusion
  constraint's `23P01` maps to. The route should not have to parse an error message.

Back-check before writing: if any existing row already violates this, the trigger will fire
on the next update to it. Run a query for current overlaps against local and production and
state the result in the stage's report. If production has overlaps, resolving them is an
owner decision, not an agent's — report and stop.

### 3. Give `blockDates()` a real answer

With the trigger in place, blocking over a live booking raises. Catch it and return an
`ActionResult` — **if Stage 02 has landed** — saying which booking is in the way and that
nothing was blocked. If Stage 02 has not landed, throw with that message and leave a
`TODO(stage-02)`. Do not reimplement the result type here.

### 4. Tests

The trigger needs a live database, so it is not a vitest case. Cover what is pure:
a `rangesOverlap(a, b)` helper with half-open semantics, including the adjacent-range case
that must **not** clash. Put the end-to-end check in this stage's manual verification and
the route-level case in Stage 07.

## Acceptance

- Blocking a week, then posting that week to `/api/checkout` with curl, returns 409 and
  creates no booking row and no Stripe session.
- The same, but where the block is created *after* the page load: the guest gets the 409 at
  submit rather than a charge.
- `createManualBooking()` over a blocked range fails at the database.
- `blockDates()` over a confirmed booking reports which booking, and blocks nothing.
- A block of `[Mar 1, Mar 8)` does not conflict with a booking of `[Mar 8, Mar 12)`.
- `npx supabase db reset` replays cleanly; the seed's blocked week and its bookings still
  coexist.

## Gate

```
npm run lint && npm run typecheck && npm test && npm run build
```

## Commit

```
Stop taking payment for dates the owner has blocked

blocked_dates was consulted when drawing the calendar and nowhere on the
path that charges a card, so a stale tab — or a direct POST — could pay
for a week the owner had taken for themselves.

The checkout route now returns the same 409 a double-booking gets, and a
pair of triggers enforces it in the database, since createManualBooking()
never goes through the route. The advisory lock in those triggers is load
bearing: unlike an exclusion constraint, two concurrent transactions
could otherwise both pass.
```
