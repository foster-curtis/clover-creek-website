-- Clover Creek Guest House — import availability from other listing sites
--
-- The house is listed in more than one place. Until now the calendar only flowed
-- outward: /api/ical publishes busy dates so Airbnb and VRBO can block them.
-- Nothing flowed back, so a stay booked on Airbnb left this site's calendar wide
-- open and the same nights could be sold twice.
--
-- `ical_feeds` holds the subscription URLs the owner pastes in. Each event those
-- feeds publish becomes an ordinary row in `blocked_dates`, tagged with the feed
-- it came from. That tag is the whole design: availability
-- (getUnavailableRanges), the outbound feed and the booking overlap check all
-- already read `blocked_dates`, so an imported night blocks the calendar with no
-- change to any of them, while `feed_id is null` still means "the owner blocked
-- this by hand" and sync never touches those rows.

create table public.ical_feeds (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text not null,
  -- Paused rather than deleted: deleting cascades the blocks away, which is
  -- right when a listing ends and wrong when a feed is merely misbehaving.
  active boolean not null default true,
  last_synced_at timestamptz,
  last_status text check (last_status in ('ok', 'error')),
  last_error text,
  last_event_count int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.ical_feeds is
  'iCalendar subscriptions from other listing sites (Airbnb, VRBO, …). Their events are imported into blocked_dates.';
comment on column public.ical_feeds.active is
  'False pauses syncing without removing the feed or reopening the nights it has already blocked.';

alter table public.blocked_dates
  add column feed_id uuid references public.ical_feeds (id) on delete cascade,
  -- The source event's iCalendar UID. Stable across fetches, so a re-sync
  -- updates a moved stay in place instead of stacking duplicates on top of it.
  add column external_uid text;

comment on column public.blocked_dates.feed_id is
  'The ical_feeds row this block was imported from; null for blocks the owner added by hand. On delete cascade: removing a feed reopens its nights.';
comment on column public.blocked_dates.external_uid is
  'UID of the source calendar event. Null for manual blocks.';

-- A feed's event appears once. This index is what makes the sync an upsert:
-- re-importing the same UID rewrites its span rather than stacking a second
-- block over the same nights. It also serves the `where feed_id = …` lookups
-- the sync and the admin list do, feed_id being the leading column.
--
-- Not a partial index (`where feed_id is not null`), though every row it
-- constrains has one: PostgREST's upsert emits a bare
-- `on conflict (feed_id, external_uid)`, and Postgres will not infer a partial
-- index as the arbiter unless the statement repeats its predicate — which
-- PostgREST has no way to say. The full index is no looser in practice,
-- because Postgres counts nulls as distinct in a unique index, so the
-- (null, null) of every manual block collides with nothing, including other
-- manual blocks.
create unique index blocked_dates_feed_uid_idx
  on public.blocked_dates (feed_id, external_uid);

-- Either both columns are set (imported) or neither is (manual). Without this a
-- half-tagged row would be skipped by the sync's delete pass and stay blocked
-- forever with nothing in the UI able to remove it.
alter table public.blocked_dates
  add constraint blocked_dates_feed_pairing
    check ((feed_id is null) = (external_uid is null));

alter table public.ical_feeds enable row level security;

-- Same shape as the existing "admin blocked dates" policy: the owner manages
-- feeds in the admin console, and the sync itself runs with the service-role
-- key, which bypasses RLS.
create policy "admin ical feeds" on public.ical_feeds
  for all using (public.is_admin()) with check (public.is_admin());
