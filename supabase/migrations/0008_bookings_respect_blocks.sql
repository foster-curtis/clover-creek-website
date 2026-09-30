-- Clover Creek Guest House — bookings respect blocked dates
--
-- bookings_no_overlap (0001) keeps two active bookings apart and says nothing
-- about blocked_dates, so a block was a hint the calendar drew and nothing on
-- the path that takes money ever read: a stale /book tab, or a direct POST to
-- /api/checkout, could pay for a week the owner had taken for themselves. The
-- checkout route now checks first. This closes it in the database as well,
-- because createManualBooking() never goes through the route, and nor would
-- the next admin path someone writes.
--
-- An exclusion constraint can only compare rows of one table, so this is a
-- pair of triggers, one on each side. Three things about them are deliberate.
--
-- 1. The lock. A trigger is not an exclusion constraint: two transactions — a
--    guest's checkout and the owner's block, say — can each run their check
--    before either commits, both find nothing, and both commit. So each
--    function takes pg_advisory_xact_lock() on the same fixed key before it
--    looks, and the two serialise. It is released at commit. Do not remove it
--    as noise; without it this is a check with a race in it, not a guarantee.
--
--    The lock only works because the functions are VOLATILE — the default,
--    written out anyway. Under READ COMMITTED a volatile function takes a
--    fresh snapshot for each statement, so the check's query, run after the
--    lock is granted, sees the row the other transaction just committed.
--    Declared STABLE, it would reuse the snapshot from before it waited and
--    miss exactly that row — silently.
--    (Everything here runs READ COMMITTED; under REPEATABLE READ the snapshot
--    is fixed for the transaction and the lock would not help either.)
--
-- 2. Imported blocks are never refused. Since 0006 every stay on Airbnb or
--    VRBO arrives as a blocked_dates row with feed_id set, written by one
--    batch upsert per feed (src/lib/icalSync.ts). Refusing one would fail the
--    whole batch, so a single conflicting event would stop every event in
--    that feed from syncing — including stays that must block this site. And
--    what it would refuse is the one fact the owner most needs on record: a
--    stay sold on another site over nights also sold here. That is a double
--    booking to sort out by phone, and hiding the second half of it helps no
--    one. So only the owner's own blocks (feed_id is null) are checked.
--
-- 3. A booking is checked when it becomes active or its dates move while
--    active — never when a payment lands on it. Not on pending → confirmed:
--    the hold cleared this check when it was inserted, and an imported block
--    can legitimately land during the 30 minutes a guest spends at Stripe. Nor
--    on a lapsed hold paid late (cancelled → confirmed in the same write that
--    sets stripe_payment_intent, which only the webhook does): by then the echo
--    of this very booking re-imported from Airbnb, the owner blocking the
--    nights it freed, or a genuine sale elsewhere may sit on its dates. Either
--    way Stripe already has the money, and refusing only hides it — the
--    webhook would answer 500 for Stripe's whole three-day retry window, and
--    the booking would stay cancelled with no payment on record, out of reach
--    of the refund controls and the tax report. Let through, it shows on the
--    calendar beside the block, a conflict the owner can see and resolve. A
--    stay resold here in the meantime is still refused, by bookings_no_overlap.
--    Any other reactivation is checked. And because an unrelated update —
--    notes, refund columns — never gets this far, no historical row is
--    re-judged by a rule it predates.
--
-- The error is SQLSTATE CC001, in a class of this project's own ("CC", Clover
-- Creek; Postgres uses none of it). PT… was avoided on purpose: PostgREST reads
-- that class as an HTTP status to answer with. The checkout route maps CC001 to
-- the same 409 as the exclusion constraint's 23P01 without reading the
-- message. The constant lives in src/lib/availability.ts; change both together.
--
-- Messages describe only the row being written. These triggers fire before
-- row-level security's WITH CHECK and, as SECURITY DEFINER, see every row, so
-- naming the row in the way would let anyone able to attempt an insert through
-- the Data API read another booking's id and status out of the error.
-- blockDates() looks up what is in the way itself, as the owner.

-- SECURITY DEFINER so the check sees every row whoever is writing. Run as the
-- caller, row-level security could hide the very row it is looking for and the
-- check would pass — failing open. VOLATILE is spelled out because the lock
-- depends on it; see the header.
create or replace function public.bookings_respect_blocks()
returns trigger
language plpgsql
volatile
security definer set search_path = public
as $$
begin
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;
  -- Already active with the same dates: pending → confirmed, a webhook retry.
  if tg_op = 'UPDATE'
     and old.status in ('pending', 'confirmed')
     and new.stay is not distinct from old.stay then
    return new;
  end if;
  -- A payment landing on a lapsed hold (point 3 of the header).
  if tg_op = 'UPDATE'
     and old.stripe_payment_intent is null
     and new.stripe_payment_intent is not null then
    return new;
  end if;

  -- The same key as blocks_respect_bookings(); see the header.
  perform pg_advisory_xact_lock(2026092903);

  if exists (select 1 from public.blocked_dates b where b.span && new.stay) then
    raise exception using
      errcode = 'CC001',
      message = format('Booking %s overlaps blocked dates', new.stay),
      hint = 'Unblock those dates, or pick others.';
  end if;
  return new;
end;
$$;

create trigger bookings_respect_blocks
  before insert or update of status, stay on public.bookings
  for each row execute function public.bookings_respect_blocks();

-- Covers updates too, though nothing in the app edits a block today: a manual
-- block's span moved onto a booking is the same mistake as inserting it there.
create or replace function public.blocks_respect_bookings()
returns trigger
language plpgsql
volatile
security definer set search_path = public
as $$
begin
  if new.feed_id is not null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.feed_id is null
     and new.span is not distinct from old.span then
    return new;
  end if;

  -- The same key as bookings_respect_blocks(); see the header.
  perform pg_advisory_xact_lock(2026092903);

  if exists (
    select 1 from public.bookings k
    where k.status in ('pending', 'confirmed') and k.stay && new.span
  ) then
    raise exception using
      errcode = 'CC001',
      message = format('Blocked dates %s overlap an active booking', new.span),
      hint = 'Cancel or move the booking first, or block the nights around it.';
  end if;
  return new;
end;
$$;

create trigger blocks_respect_bookings
  before insert or update of span, feed_id on public.blocked_dates
  for each row execute function public.blocks_respect_bookings();
