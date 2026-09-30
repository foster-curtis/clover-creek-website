-- Clover Creek Guest House — refunds as rows
--
-- bookings.refund_cents (0005) is one number, and refundBooking() assigned it
-- rather than adding to it: a second partial refund overwrote the first. And
-- nothing wrote it at all for a refund issued in the Stripe Dashboard — the
-- obvious place to refund a guest who phones — or for a chargeback, so the
-- booking stayed confirmed, its dates blocked, and the lodging tax report
-- counted a receipt that had been handed back.
--
-- Each refund is now a row here, keyed on Stripe's own id: re_… for a refund,
-- du_… (or dp_…, on older disputes) for a dispute lost. A dashboard refund, an admin refund and a
-- redelivered webhook event all converge on one row, the way stripe_events
-- (0007) makes a redelivery collide, and partial refunds accumulate. `source`
-- says who moved the money, so "I refunded this in the admin panel" and "this
-- was a chargeback" can still be told apart a year later. `issued_at` is
-- Stripe's clock, not ours: it decides which return a refund reduces.
--
-- Five things are deliberate.
--
-- 1. refund_cents and refunded_at stay, as a cache of these rows. The tax
--    report and the admin dashboard read them (src/lib/taxReport.ts), and
--    moving those onto the rows is a later change (Stage 09). A trigger keeps
--    the cache: refund_cents = sum(amount_cents), refunded_at = max(issued_at).
--    Nothing else writes those two columns any more.
--
--    The trigger locks the booking row before it sums. Two refunds recorded
--    at once — the webhook and the admin panel, say — would otherwise each sum
--    without seeing the other's uncommitted row, and whichever wrote last
--    would win with a total missing the other refund. With the lock the
--    second waits for the first to commit, then sums. Do not remove it as
--    noise. As in 0008, this only works because the function is VOLATILE and
--    the sum is its own statement after the lock: under READ COMMITTED each
--    statement of a volatile function takes a fresh snapshot, so the sum sees
--    the row the other transaction just committed. A single UPDATE that
--    summed in a subquery would not — it keeps the snapshot it started with
--    even after waiting for the row.
--
-- 2. The backfill. Every booking with refund_cents > 0 gets one row, source
--    'admin' (before this migration only refundBooking() ever wrote the
--    column), with id 'legacy:<booking id>'. That id is deliberately not a
--    Stripe id: the real one was never recorded, and a made-up re_… would
--    one day be looked up in Stripe and not found. issued_at is refunded_at,
--    or created_at where 0005 could not recover a date — exactly the
--    fallback refundDateOf() in taxReport.ts already uses, so the report
--    reads the same date either way. The rows go in before the trigger
--    exists, so the migration rewrites no booking's refund_cents or
--    refunded_at at all: for every booking that exists today, the tax
--    report cannot move.
--
-- 3. Replacing a legacy row. A legacy row stands for real Stripe refunds
--    whose ids were never kept. When Stripe's list of refunds for that
--    booking arrives — a further refund in the Dashboard, a replayed event —
--    inserting it beside the legacy row would count that money twice.
--    Stripe is the source of truth for money, so record_stripe_refunds()
--    swaps the legacy row for Stripe's rows in one transaction; the cache
--    never double-counts, and never dips in between. Replacing rows created
--    at or before the legacy row's issued_at are tagged 'admin' — that is
--    the refund it stood for. Later ones are 'dashboard', the normal rule.
--    Where the legacy date is 0005's fallback (the booking's created_at),
--    every real refund postdates it, so for those the cut-off is when this
--    migration ran (the legacy row's recorded_at) instead.
--
-- 4. An admin refund, and its own webhook. A refund issued from
--    /admin/calendar fires charge.refunded too, and that event can land
--    before refundBooking() has written its row. The webhook cannot tell,
--    so it records the refund as 'dashboard' (and, for a full refund,
--    cancels the booking with the dashboard note). record_admin_refund()
--    therefore upserts admin-wins: it knows for certain it issued that id.
--    The webhook's insert does nothing on conflict. Whichever lands first,
--    the end state is one row, 'admin', and the booking cancelled with the
--    admin's note. Both functions lock the booking row before touching this
--    table, so they serialise rather than deadlock on each other's insert.
--    The lost-dispute write in the webhook is a third writer and takes no
--    such lock: it is a single insert keyed on the dispute's id, which no
--    other writer produces, so there is no row to fight over. The cache
--    trigger locks the booking itself; at worst two writers on one booking
--    deadlock, one aborts, the webhook answers 500 and Stripe retries.
--
-- 5. bookings_refund_within_total (0005) is dropped. Refunds plus a lost
--    dispute can legitimately exceed total_cents, which is what the stay was
--    priced at, not what was captured — a price corrected after payment
--    separates the two. A constraint that rejects a true fact is worse than
--    none: it would fail the webhook's write, and Stripe would retry a
--    refund that can never be recorded. refund_cents >= 0 stays.

create table public.booking_refunds (
  id text primary key, -- Stripe's re_… (refund) or du_…/dp_… (dispute); 'legacy:…' from the backfill
  booking_id uuid not null references public.bookings (id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  reason text,
  source text not null check (source in ('admin', 'dashboard', 'dispute')),
  issued_at timestamptz not null, -- Stripe's created, not ours
  recorded_at timestamptz not null default now()
);

comment on table public.booking_refunds is
  'One row per refund or lost dispute, keyed by Stripe''s id. bookings.refund_cents and refunded_at are a trigger-kept cache of these rows.';
comment on column public.booking_refunds.source is
  'admin: refunded from /admin/calendar. dashboard: refunded in the Stripe Dashboard (learned from charge.refunded). dispute: a chargeback the guest won.';
comment on column public.booking_refunds.issued_at is
  'When Stripe issued it (Stripe''s clock) — the filing period the refund reduces.';

-- The webhook looks a booking up by its payment intent; a duplicate would make
-- every refund and dispute event for that charge 500 for Stripe's whole retry window.
create unique index bookings_stripe_payment_intent_key
  on public.bookings (stripe_payment_intent)
  where stripe_payment_intent is not null;

create index booking_refunds_booking_idx on public.booking_refunds (booking_id);
create index booking_refunds_issued_idx on public.booking_refunds (issued_at);

-- Service role only, as stripe_events (0007): the webhook and the admin
-- actions write it, the admin pages read it through the service role, and
-- nothing in the browser touches it. RLS with no policy denies anon and
-- authenticated; the revoke takes back the table grant 0002's default
-- privileges hand them.
alter table public.booking_refunds enable row level security;
revoke all on public.booking_refunds from anon, authenticated;

alter table public.bookings drop constraint bookings_refund_within_total;

-- The backfill (point 2). Before the trigger, on purpose.
insert into public.booking_refunds (id, booking_id, amount_cents, reason, source, issued_at)
select
  'legacy:' || b.id,
  b.id,
  b.refund_cents,
  b.notes,
  'admin',
  coalesce(b.refunded_at, b.created_at)
from public.bookings b
where b.refund_cents > 0;

comment on column public.bookings.refund_cents is
  'Total refunded to the guest, in cents: the sum of booking_refunds.amount_cents, kept by trigger. 0 when nothing was refunded. Write booking_refunds, never this.';
comment on column public.bookings.refunded_at is
  'The latest booking_refunds.issued_at, kept by trigger. Null when refund_cents is 0. On bookings refunded before 0009 it is left as it was until a later refund row is recorded, which recomputes it (to the same date the tax report already uses). Null where 0005 never recorded a date.';

-- The cache (point 1). SECURITY DEFINER so the sum sees every row whoever is
-- writing; VOLATILE is spelled out because the lock depends on it.
create or replace function public.booking_refunds_sync_cache()
returns trigger
language plpgsql
volatile
security definer set search_path = public
as $$
declare
  affected uuid[];
  target uuid;
begin
  if tg_op = 'INSERT' then
    affected := array[new.booking_id];
  elsif tg_op = 'DELETE' then
    affected := array[old.booking_id];
  elsif old.booking_id = new.booking_id then
    affected := array[new.booking_id];
  else
    -- Moved to another booking: both totals change. In id order, so two such
    -- moves can't each hold one booking and wait for the other.
    affected := array[
      least(old.booking_id, new.booking_id),
      greatest(old.booking_id, new.booking_id)
    ];
  end if;

  foreach target in array affected loop
    -- The lock (point 1 of the header), then the sum as a separate statement.
    -- When the booking itself is being deleted, its refunds go with it by
    -- cascade; both statements then find no row, which is right.
    perform 1 from public.bookings where id = target for update;
    update public.bookings b
    set refund_cents = s.total,
        refunded_at = s.latest
    from (
      select coalesce(sum(r.amount_cents), 0)::int as total, max(r.issued_at) as latest
      from public.booking_refunds r
      where r.booking_id = target
    ) s
    where b.id = target;
  end loop;
  return null;
end;
$$;

-- source and reason don't touch the cache, so the admin-wins upsert (point 4)
-- doesn't fire it.
create trigger booking_refunds_sync_cache
  after insert or delete or update of booking_id, amount_cents, issued_at
  on public.booking_refunds
  for each row execute function public.booking_refunds_sync_cache();

-- Records what Stripe says has been refunded on a booking's charge, for the
-- charge.refunded webhook. `p_refunds` is Stripe's current list, failed and
-- cancelled refunds already left out: [{id, amount_cents, issued_at, reason}].
-- Rows already here are left alone, including an admin row for the same id
-- (point 4). Replaces a legacy row, if there is one (point 3).
create or replace function public.record_stripe_refunds(p_booking_id uuid, p_refunds jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  legacy record;
  admin_until timestamptz; -- null: nothing is tagged admin
begin
  -- Before this table is touched: see point 4 of the header.
  perform 1 from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking % not found', p_booking_id;
  end if;

  select r.issued_at, r.recorded_at, b.created_at
  into legacy
  from public.booking_refunds r
  join public.bookings b on b.id = r.booking_id
  where r.id = 'legacy:' || p_booking_id;

  if found and jsonb_array_length(p_refunds) > 0 then
    admin_until := case
      when legacy.issued_at = legacy.created_at then legacy.recorded_at
      else legacy.issued_at
    end;
    delete from public.booking_refunds where id = 'legacy:' || p_booking_id;
  end if;

  insert into public.booking_refunds (id, booking_id, amount_cents, reason, source, issued_at)
  select
    r.id,
    p_booking_id,
    r.amount_cents,
    r.reason,
    case when r.issued_at <= admin_until then 'admin' else 'dashboard' end,
    r.issued_at
  from jsonb_to_recordset(p_refunds)
    as r (id text, amount_cents int, issued_at timestamptz, reason text)
  on conflict (id) do nothing;
end;
$$;

-- refundBooking()'s write, after Stripe has taken the refund: the refund row
-- (admin-wins, point 4) and the cancellation, in one transaction, so a failure
-- leaves nothing half-saved. With no p_refund_id — a $0 outcome — it only
-- cancels.
create or replace function public.record_admin_refund(
  p_booking_id uuid,
  p_notes text,
  p_refund_id text default null,
  p_amount_cents int default null,
  p_issued_at timestamptz default null,
  p_reason text default null
)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform 1 from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking % not found', p_booking_id;
  end if;

  if p_refund_id is not null then
    insert into public.booking_refunds (id, booking_id, amount_cents, reason, source, issued_at)
    values (p_refund_id, p_booking_id, p_amount_cents, p_reason, 'admin', p_issued_at)
    on conflict (id) do update
      set source = 'admin', reason = excluded.reason;
  end if;

  -- Unguarded, as refundBooking() always has been: the booking may already be
  -- cancelled by this refund's own webhook, and the admin's note should win.
  update public.bookings
  set status = 'cancelled', notes = p_notes
  where id = p_booking_id;
end;
$$;

-- 0002's default privileges let anon and authenticated execute every new
-- function through the Data API. These cancel bookings and record money, so
-- only the service role may call them.
revoke all on function public.booking_refunds_sync_cache() from public, anon, authenticated;
revoke all on function public.record_stripe_refunds(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.record_admin_refund(uuid, text, text, int, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.record_stripe_refunds(uuid, jsonb) to service_role;
grant execute on function public.record_admin_refund(uuid, text, text, int, timestamptz, text)
  to service_role;
