-- Clover Creek Guest House — record every Stripe webhook event
--
-- The webhook used to answer 200 whatever happened, including when the write
-- that confirms a paid booking failed. Stripe reads 200 as "handled" and never
-- retries, so a guest could pay and the booking stay pending with no trace.
-- It now answers 500 on failure and lets Stripe's own retry schedule be the
-- recovery path.
--
-- Retries are only safe if a redelivery can't do the work twice (confirm the
-- booking again, send the guest a second "your stay is confirmed"). This table
-- is that guard. Its primary key is Stripe's own event id, so a second delivery
-- collides on insert — the collision *is* the lock, with no transaction or
-- advisory lock needed. See src/lib/stripeEvents.ts.
--
-- It is also the local record of what Stripe actually sent: `payload` holds the
-- verified event, so what happened to a booking can be reconstructed without
-- the Stripe Dashboard.
--
-- Retention: nothing prunes this table. Volume is tiny (two or three rows per
-- booking), and whether to delete rows older than a year is a later decision —
-- not one this migration has quietly made.

create table public.stripe_events (
  id text primary key, -- Stripe's evt_… id
  type text not null,
  -- Set only once the handler has found the booking. The metadata on a session
  -- is not proof a booking exists (a Dashboard test event carries none), and an
  -- unknown id written here would fail the foreign key and turn an event that
  -- should be ignored into one Stripe retries for days.
  booking_id uuid references public.bookings (id) on delete set null,
  payload jsonb not null,
  status text not null default 'processing'
    check (status in ('processing', 'handled', 'ignored', 'failed')),
  error text,
  -- When Stripe first delivered it. Never rewritten.
  received_at timestamptz not null default now(),
  -- When the current attempt took the row. A retry of a failed event, or of one
  -- whose attempt died mid-flight, takes it again; staleness is measured from
  -- here, since measuring from received_at would make every retry of an
  -- event first seen more than five minutes ago look abandoned.
  claimed_at timestamptz not null default now(),
  -- How many deliveries have run the handler. Also the version the reclaim
  -- compares-and-swaps on, so two concurrent retries cannot both win.
  attempts int not null default 1 check (attempts >= 1),
  completed_at timestamptz
);

comment on table public.stripe_events is
  'Every Stripe webhook event received, keyed by Stripe''s event id. The idempotency gate for /api/webhooks/stripe, and the local record of what Stripe sent.';
comment on column public.stripe_events.status is
  'processing: an attempt is running (or died — reclaimable after five minutes). handled: done. ignored: nothing to do (unpaid, unknown booking, unhandled type). failed: Stripe was sent a 500 and will retry.';
comment on column public.stripe_events.error is
  'Why the event was ignored or failed. On a handled event, what went wrong after the booking was written (an email, say) — the booking itself is fine.';

create index stripe_events_booking_idx on public.stripe_events (booking_id, received_at desc);
create index stripe_events_type_idx on public.stripe_events (type, received_at desc);

-- Service role only: the webhook is the one writer and nothing in the browser
-- reads it. RLS with no policy denies anon and authenticated; the revoke takes
-- back the table grant 0002's default privileges hand them as well, because
-- `payload` carries the guest's name and email from the checkout session, and a
-- policy added here later by mistake should still find nothing to expose.
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;
