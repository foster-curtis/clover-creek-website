-- Clover Creek Guest House — local development fixture
--
-- ---------------------------------------------------------------------------
-- LOCAL ONLY. This file is never run against production.
-- ---------------------------------------------------------------------------
-- The Supabase CLI runs it automatically at the end of `supabase db reset` and
-- on the first `supabase start` against an empty volume (see [db.seed] in
-- config.toml). `supabase db push` — the only command that writes to the linked
-- project — does not run seeds. A guard at the bottom of this header refuses to
-- run against any database that already holds real users or bookings, so
-- pasting this into the production SQL editor by mistake fails loudly instead
-- of inventing bookings on a live calendar.
--
-- What it gives you after every reset:
--
--   * an admin account you can sign into (see "Signing in" below)
--   * a guest account, with a booking and a chat thread attached to it
--   * six bookings spread across past and future, including one refunded stay
--     and one expired hold, so Admin → Calendar, Admin → Taxes and the
--     dashboard counters all have something real to show
--   * reviews (one awaiting approval, one featured), an open inquiry, a
--     published blog post and a draft, and a blocked week
--
-- Data you create by clicking around does NOT survive a reset — only what is
-- written here does. Treat this file as the definition of the dev fixture: to
-- change what you start with, edit it and reset, rather than editing rows.
--
-- Every date is relative to `current_date`, so the fixture never goes stale:
-- the upcoming stays stay upcoming no matter when you reset.
--
-- `public.site_content` is deliberately left empty. Every slug falls back to
-- the copy in src/lib/content.ts when no row overrides it, so an empty table is
-- the true "unedited site" state, and seeding it would fork the real copy.

-- ---------------------------------------------------------------------------
-- Guard: refuse to seed a database that already holds real data.
-- ---------------------------------------------------------------------------
do $$
declare
  stray_users bigint;
  stray_bookings bigint;
begin
  select count(*) into stray_users
  from auth.users
  where id not in (
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002'
  );

  -- Every row this file writes uses a fixed id from its own block; anything
  -- else is real data. Re-running the seed over its own output is therefore a
  -- no-op (the inserts all say `on conflict do nothing`), while one genuine
  -- booking is enough to stop it.
  select count(*) into stray_bookings
  from public.bookings
  where id::text not like 'b0000000-0000-4000-8000-%';

  if stray_users > 0 or stray_bookings > 0 then
    raise exception
      'Refusing to seed: this database already holds % user(s) and % booking(s) that this fixture did not create.',
      stray_users, stray_bookings
      using hint = 'seed.sql is for a freshly reset local database (npx supabase db reset). It must never run against the linked project.';
  end if;
end;
$$;

-- pgcrypto provides crypt()/gen_salt() for the account passwords below. Present
-- on a stock Supabase database; the guard keeps this from being a surprise.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
-- Fixed UUIDs, so bookings and messages below can reference them, and so the
-- ids stay the same across resets (handy for bookmarked admin URLs).
--
-- Signing in: go to /login, enter the address, then open the magic link from
-- the local inbox at http://localhost:54324. Passwords are set too, so you can
-- also sign in from a SQL client or the Studio auth panel if you prefer; the
-- site itself only ever uses the magic link.
--
-- The addresses use the reserved .test TLD. Nothing can accidentally deliver to
-- a real person if this fixture ever escapes a laptop.
--
--   owner@clovercreek.test   — admin, password "localdev"
--   guest@clovercreek.test   — ordinary visitor, password "localdev"
--
-- Inserting into auth.users fires the on_auth_user_created trigger from
-- 0001_init.sql, which creates the matching public.profiles row; the role is
-- promoted to 'admin' afterwards.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'owner@clovercreek.test',
    extensions.crypt('localdev', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Clover Creek Owner"}'::jsonb,
    now() - interval '1 year', now() - interval '1 year'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'guest@clovercreek.test',
    extensions.crypt('localdev', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Dana Whitlock"}'::jsonb,
    now() - interval '60 days', now() - interval '60 days'
  )
on conflict (id) do nothing;

-- auth.users has a set of token columns (confirmation_token, recovery_token,
-- email_change, …) that are nullable in Postgres but read into plain Go strings
-- by GoTrue. Leaving them NULL makes every sign-in attempt fail with a 500 and
-- `Scan error on column index 3, name "confirmation_token": converting NULL to
-- string is unsupported` in the auth container's log — the standard trap when a
-- user is inserted with SQL rather than through the API. Blanking them is the
-- fix. Done by inspection rather than as a fixed column list so a CLI upgrade
-- that adds another such column does not quietly break sign-in again.
do $$
declare
  col text;
begin
  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and data_type in ('text', 'character varying')
      and is_nullable = 'YES'
      and (column_name like '%token%' or column_name like '%change%')
  loop
    execute format(
      'update auth.users set %I = '''' where %I is null and id in (%L, %L)',
      col, col,
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002'
    );
  end loop;
end;
$$;

-- GoTrue expects an identity row per sign-in method. Without it the account
-- still authenticates, but `user.identities` comes back empty and the Studio
-- auth panel shows the user as having no provider.
insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', u.created_at, u.created_at, u.created_at
from auth.users u
where u.email in ('owner@clovercreek.test', 'guest@clovercreek.test')
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

update public.profiles
set role = 'admin', name = 'Clover Creek Owner', phone = '+1-385-204-6622'
where id = 'a0000000-0000-4000-8000-000000000001';

update public.profiles
set name = 'Dana Whitlock', phone = '+1-801-555-0148'
where id = 'a0000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- Quote builder
-- ---------------------------------------------------------------------------
-- bookings.quote stores the full price breakdown captured at booking time, and
-- bookings.total_cents must agree with it. Rather than hand-write JSON that
-- would drift from whatever dates `current_date` lands on, this mirrors
-- quoteStay() from src/lib/pricing.ts closely enough for a fixture: weekend
-- rates on Friday and Saturday nights and on holiday eves, extra-guest fees
-- above two guests, pet fee per pet per night, and the tax backed out of the
-- tax-inclusive total exactly as computeLodgingTax() does.
--
-- One knowing difference: the app's holiday map also includes the US federal
-- holidays computed in src/lib/holidays.ts, while this sees only the rows in
-- public.holidays. A seeded stay that straddles Thanksgiving would therefore
-- store a slightly low quote. It does not matter here — nothing reads the
-- stored quote except the booking detail view, and the tax report derives every
-- figure from total_cents on purpose (see src/lib/taxReport.ts).
--
-- The arithmetic is inlined into the INSERT below as a chain of LATERAL
-- subqueries rather than factored into a helper function, because the CLI sends
-- this whole file to Postgres as one batch: every statement is planned before
-- the first one runs, so a function the file creates is not yet visible to a
-- later statement that calls it. One self-contained statement sidesteps that.

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
-- Six rows chosen to exercise every branch the admin screens have:
--
--   b…01  a finished stay, last month          → completed
--   b…02  paid, then cancelled with a 50% refund → the refund line on the tax
--         report, filed in the quarter it was issued, not the quarter paid
--   b…03  next fortnight, 4 guests and a dog   → the chat thread below hangs
--         off this one
--   b…04  six weeks out, quiet midweek stay
--   b…05  a live hold, expiring in 20 minutes  → watch expire_stale_holds()
--         release it
--   b…06  a hold that was never paid           → cancelled, no money, and it
--         deliberately overlaps b…03: the exclusion constraint only covers
--         pending and confirmed, which is exactly how the calendar frees up
--
-- `refund_pct` is a fraction of the computed total rather than a fixed amount,
-- so the bookings_refund_within_total check constraint can never trip however
-- the rates change.

insert into public.bookings (
  id, user_id, guest_name, guest_email, guest_phone, stay, guests, pets,
  pet_details, quote, total_cents, status, stripe_session_id,
  stripe_payment_intent, rules_accepted_at, notes, created_at, hold_expires_at,
  refund_cents, refunded_at
)
select
  b.id, b.user_id, b.guest_name, b.guest_email, b.guest_phone, b.stay,
  b.guests, b.pets, b.pet_details,
  jsonb_build_object(
    'nights', n.nights,
    'nightCount', n.night_count,
    'guests', b.guests,
    'pets', b.pets,
    'lodgingSubtotal', n.lodging_subtotal,
    'petFee', m.pet_fee,
    'total', m.total,
    'totalCents', m.total_cents,
    'tax', jsonb_build_object(
      'grossCents', m.total_cents,
      'taxableBaseCents', t.taxable_base_cents,
      'salesTaxCents', t.sales_tax_cents,
      'stateTrtCents', t.state_trt_cents,
      'countyTrtCents', t.total_tax_cents - t.sales_tax_cents - t.state_trt_cents,
      'trtTotalCents', t.total_tax_cents - t.sales_tax_cents,
      'totalTaxCents', t.total_tax_cents,
      'rate', 0.1217
    )
  ),
  m.total_cents,
  b.status,
  case when b.payment_intent is null then null
       else replace(b.payment_intent, 'pi_', 'cs_test_') end,
  b.payment_intent,
  b.created_at,
  b.notes,
  b.created_at,
  b.hold_expires_at,
  round(m.total_cents * b.refund_pct)::int,
  b.refunded_at
from (
  values
    (
      'b0000000-0000-4000-8000-000000000001'::uuid,
      null::uuid,
      'Marta Reyes'::text,
      'marta.reyes@example.test'::text,
      '+1-435-555-0112'::text,
      daterange(current_date - 30, current_date - 27, '[)'),
      2::int, 0::int, null::jsonb,
      'completed'::text,
      'pi_seed_completed'::text,
      null::text,
      now() - interval '52 days',
      null::timestamptz,
      0::numeric,
      null::timestamptz
    ),
    (
      'b0000000-0000-4000-8000-000000000002',
      null,
      'Harold Nkemdirim',
      'harold.n@example.test',
      '+1-801-555-0173',
      daterange(current_date - 12, current_date - 10, '[)'),
      2, 0, null,
      'cancelled',
      'pi_seed_refunded',
      'cancelled · 50% refund (4 to 6 weeks before check-in)',
      now() - interval '70 days',
      null,
      0.50,
      now() - interval '20 days'
    ),
    (
      'b0000000-0000-4000-8000-000000000003',
      'a0000000-0000-4000-8000-000000000002',
      'Dana Whitlock',
      'guest@clovercreek.test',
      '+1-801-555-0148',
      daterange(current_date + 14, current_date + 17, '[)'),
      4, 1,
      '[{"type": "dog", "weight_lbs": 38}]'::jsonb,
      'confirmed',
      'pi_seed_upcoming',
      null,
      now() - interval '5 days',
      null,
      0,
      null
    ),
    (
      'b0000000-0000-4000-8000-000000000004',
      null,
      'Priya Raghunathan',
      'priya.r@example.test',
      '+1-385-555-0166',
      daterange(current_date + 45, current_date + 47, '[)'),
      2, 0, null,
      'confirmed',
      'pi_seed_later',
      null,
      now() - interval '2 days',
      null,
      0,
      null
    ),
    (
      'b0000000-0000-4000-8000-000000000005',
      null,
      'Tomasz Wierzbicki',
      'tomasz.w@example.test',
      null,
      daterange(current_date + 60, current_date + 62, '[)'),
      3, 0, null,
      'pending',
      null,
      null,
      now() - interval '10 minutes',
      now() + interval '20 minutes',
      0,
      null
    ),
    (
      'b0000000-0000-4000-8000-000000000006',
      null,
      'Beth Ann Coolidge',
      'bethann.c@example.test',
      null,
      daterange(current_date + 14, current_date + 16, '[)'),
      2, 0, null,
      'cancelled',
      null,
      'hold expired',
      now() - interval '9 days',
      now() - interval '9 days' + interval '30 minutes',
      0,
      null
    )
) as b (
  id, user_id, guest_name, guest_email, guest_phone, stay, guests, pets,
  pet_details, status, payment_intent, notes, created_at, hold_expires_at,
  refund_pct, refunded_at
)
-- Pricing comes from the single pricing_config row, so the fixture follows any
-- rate change made in the migrations rather than hard-coding $75/$105.
cross join public.pricing_config cfg
-- One row per night: weekend rates on Fri/Sat and on holiday eves, matching
-- isWeekendNight() in src/lib/pricing.ts.
cross join lateral (
  select
    count(*)::int as night_count,
    coalesce(sum(p.base + p.extra_guest_fee), 0) as lodging_subtotal,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'date', to_char(p.day, 'YYYY-MM-DD'),
          'weekendRate', p.weekend,
          'holiday', p.holiday,
          'base', p.base,
          'extraGuestFee', p.extra_guest_fee,
          'subtotal', p.base + p.extra_guest_fee
        )
        order by p.day
      ),
      '[]'::jsonb
    ) as nights
  from (
    select
      w.day, w.weekend, w.holiday,
      case when w.weekend then cfg.weekend_base else cfg.weekday_base end as base,
      greatest(b.guests - 2, 0)
        * case when w.weekend then cfg.extra_guest_weekend else cfg.extra_guest_weekday end
        as extra_guest_fee
    from (
      select
        d::date as day,
        (
          extract(dow from d) in (5, 6)
          or exists (
            select 1 from public.holidays h
            where h.day in (d::date, d::date + 1)
          )
        ) as weekend,
        (
          select h.label from public.holidays h
          where h.day in (d::date, d::date + 1)
          limit 1
        ) as holiday
      from generate_series(lower(b.stay), upper(b.stay) - 1, interval '1 day') d
    ) w
  ) p
) n
cross join lateral (
  select
    cfg.pet_fee_per_day * b.pets * n.night_count as pet_fee,
    n.lodging_subtotal + cfg.pet_fee_per_day * b.pets * n.night_count as total,
    round((n.lodging_subtotal + cfg.pet_fee_per_day * b.pets * n.night_count) * 100)::int
      as total_cents
) m
-- The tax backed out of the tax-inclusive total, as computeLodgingTax() does:
-- the county takes the remainder so the three components always sum to the
-- total rather than drifting a cent apart.
cross join lateral (
  select
    round(m.total_cents / 1.1217)::int as taxable_base_cents,
    m.total_cents - round(m.total_cents / 1.1217)::int as total_tax_cents,
    round(round(m.total_cents / 1.1217)::int * 0.066)::int as sales_tax_cents,
    round(round(m.total_cents / 1.1217)::int * 0.0107)::int as state_trt_cents
) t
where cfg.id = 1
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- Blocked dates
-- ---------------------------------------------------------------------------
insert into public.blocked_dates (id, span, reason)
values (
  'c0000000-0000-4000-8000-000000000001',
  daterange(current_date + 90, current_date + 95, '[)'),
  'Owner staying — well pump replacement'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
-- One unapproved row, so the dashboard's "awaiting approval" counter reads 1
-- and Admin → Reviews has something to act on.
insert into public.reviews (
  id, user_id, booking_id, author_name, rating, body,
  verified, approved, featured, stayed_on, created_at
)
values
  (
    'd0000000-0000-4000-8000-000000000001',
    null,
    'b0000000-0000-4000-8000-000000000001',
    'Marta Reyes', 5,
    'Quiet in a way I had forgotten was possible. We sat out back until the stars came out and never once heard a car. The kitchen had everything we needed to cook a real dinner.',
    true, true, true,
    current_date - 27,
    now() - interval '25 days'
  ),
  (
    'd0000000-0000-4000-8000-000000000002',
    null, null,
    'The Alvarado family', 5,
    'Three generations under one roof and nobody was on top of anybody. Grandma took the main bedroom, kids on the sleeper. Check-in instructions were clear and the place was spotless.',
    false, true, false,
    current_date - 120,
    now() - interval '115 days'
  ),
  (
    'd0000000-0000-4000-8000-000000000003',
    null, null,
    'Jeff M.', 4,
    'Great base for getting out to the Stansbury range. Only note is the last stretch of road is gravel — fine in our sedan, just take it slow.',
    false, true, false,
    current_date - 200,
    now() - interval '195 days'
  ),
  (
    'd0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000003',
    'Dana Whitlock', 5,
    'Booked again for the fall. The dog was as welcome as we were, which is not something I can say about most places that claim to be pet friendly.',
    true, false, false,
    null,
    now() - interval '1 day'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Inquiries (the contact form) — one open, one already dealt with
-- ---------------------------------------------------------------------------
insert into public.inquiries (id, name, email, body, archived, created_at)
values
  (
    'e0000000-0000-4000-8000-000000000001',
    'Sandra Kipling', 'sandra.kipling@example.test',
    'Hello — we are a party of five looking at the second week of October. Is the sleeper sofa comfortable enough for two teenagers, and is there anywhere nearby to rent horses? Thank you.',
    false,
    now() - interval '2 days'
  ),
  (
    'e0000000-0000-4000-8000-000000000002',
    'Ray Oduya', 'ray.oduya@example.test',
    'Do you allow a small trailer to be parked on the property overnight?',
    true,
    now() - interval '3 weeks'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Messages — the chat thread on the upcoming confirmed booking
-- ---------------------------------------------------------------------------
-- The guest's last message is left unread, so the dashboard's unread counter
-- reads 1 and Admin → Messages opens on something worth replying to.
insert into public.messages (
  id, booking_id, sender_id, from_admin, body, read_at, created_at
)
values
  (
    'f0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000002',
    false,
    'Hi! We are driving in from Boise and will probably not reach you until about 9pm. Is that too late to check in?',
    now() - interval '4 days',
    now() - interval '4 days'
  ),
  (
    'f0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000001',
    true,
    'Not at all — check-in is self-serve with a keypad, so arrive whenever suits you. I will send the code the morning of your stay.',
    now() - interval '4 days',
    now() - interval '4 days' + interval '2 hours'
  ),
  (
    'f0000000-0000-4000-8000-000000000003',
    'b0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000002',
    false,
    'Perfect, thank you. One more thing — is there a hose or spigot outside? The dog will be filthy by the time we arrive.',
    null,
    now() - interval '6 hours'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Blog — one published post and one draft
-- ---------------------------------------------------------------------------
insert into public.blog_posts (
  id, slug, title, excerpt, body, published, published_at, created_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'four-drives-from-the-guest-house',
    'Four drives worth taking from the guest house',
    'Rush Valley is the quiet middle of a lot of good country. Here is where we send people with a free afternoon and a full tank.',
    E'Rush Valley sits in the quiet middle of a lot of good country. Guests often arrive with one destination in mind and leave having found three more.\n\n## Ophir Canyon\n\nTwenty minutes south and then east into the Oquirrhs. The old mining town at the mouth of the canyon still has a handful of year-round residents and a small museum that keeps irregular hours.\n\n## The Stansbury Range\n\nSouth Willow Canyon climbs quickly into the pines and has a string of small campgrounds along the way. The road is paved most of the way up.\n\n## Great Salt Lake, the back way\n\nNorth through Grantsville and out toward Stansbury Island. Best in the hour before sunset.\n\n## Pony Express Trail\n\nWest along the old route. This one is a commitment — mostly gravel, with long stretches of nothing at all, which is precisely the appeal.',
    true,
    now() - interval '18 days',
    now() - interval '20 days'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'what-to-pack-for-a-high-desert-night',
    'What to pack for a high desert night',
    'A draft, sitting unpublished so the admin blog screen has both states to show.',
    E'It can be eighty degrees at six in the evening and fifty by ten. The single most common thing guests wish they had brought is a warmer layer than the forecast high suggested.\n\nTODO: finish this one — add the bit about the wind coming off the valley floor, and a short packing list.',
    false,
    null,
    now() - interval '3 days'
  )
on conflict (id) do nothing;
