-- Clover Creek Guest House — initial schema
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Profiles & roles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'visitor' check (role in ('admin', 'visitor')),
  name text,
  phone text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Editable site content (descriptive paragraphs only; titles/buttons live in code)
-- ---------------------------------------------------------------------------
create table public.site_content (
  slug text primary key,
  content text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Gallery
-- ---------------------------------------------------------------------------
create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  caption text,
  alt text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Pricing (single row) + holidays
-- ---------------------------------------------------------------------------
create table public.pricing_config (
  id int primary key default 1 check (id = 1),
  weekday_base numeric not null default 75,
  weekend_base numeric not null default 105,
  extra_guest_weekday numeric not null default 20,
  extra_guest_weekend numeric not null default 25,
  pet_fee_per_day numeric not null default 20,
  max_guests int not null default 6,
  max_pets int not null default 2,
  pet_weight_limit_lbs int not null default 50,
  min_stay_nights int not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.pricing_config (id) values (1);

-- Extra holidays beyond the US federal holidays computed in app code.
create table public.holidays (
  day date primary key,
  label text not null
);

-- ---------------------------------------------------------------------------
-- Bookings & blocked dates
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  stay daterange not null, -- [check_in, check_out) — half-open
  guests int not null check (guests between 1 and 12),
  pets int not null default 0 check (pets between 0 and 4),
  pet_details jsonb, -- [{ "type": "dog", "weight_lbs": 40 }]
  quote jsonb not null, -- full price breakdown captured at booking time
  total_cents int not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  stripe_session_id text,
  stripe_payment_intent text,
  rules_accepted_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  -- pending bookings expire; see expire_stale_holds()
  hold_expires_at timestamptz
);

-- Hard guarantee against double-booking: no two active bookings may overlap.
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (stay with &&)
  where (status in ('pending', 'confirmed'));

create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  span daterange not null,
  reason text,
  created_at timestamptz not null default now()
);

-- Release pending holds whose payment never completed (called before availability checks)
create or replace function public.expire_stale_holds()
returns void
language sql
security definer set search_path = public
as $$
  update public.bookings
  set status = 'cancelled', notes = coalesce(notes || ' | ', '') || 'hold expired'
  where status = 'pending' and hold_expires_at is not null and hold_expires_at < now();
$$;

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  author_name text not null,
  rating int not null check (rating between 1 and 5),
  body text not null,
  verified boolean not null default false,
  approved boolean not null default false,
  stayed_on date, -- for imported historical reviews
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Messaging (scoped to a booking) and pre-booking inquiries
-- ---------------------------------------------------------------------------
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  body text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  from_admin boolean not null default false,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Blog
-- ---------------------------------------------------------------------------
create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,
  body text not null, -- markdown
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.site_content enable row level security;
alter table public.gallery_images enable row level security;
alter table public.pricing_config enable row level security;
alter table public.holidays enable row level security;
alter table public.bookings enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.reviews enable row level security;
alter table public.inquiries enable row level security;
alter table public.messages enable row level security;
alter table public.blog_posts enable row level security;

-- profiles: users see/update their own; admin sees all
create policy "own profile read" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "own profile update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id and role = 'visitor');

-- public read-only content
create policy "public read content" on public.site_content for select using (true);
create policy "admin write content" on public.site_content for all using (public.is_admin()) with check (public.is_admin());

create policy "public read gallery" on public.gallery_images for select using (true);
create policy "admin write gallery" on public.gallery_images for all using (public.is_admin()) with check (public.is_admin());

create policy "public read pricing" on public.pricing_config for select using (true);
create policy "admin write pricing" on public.pricing_config for update using (public.is_admin()) with check (public.is_admin());

create policy "public read holidays" on public.holidays for select using (true);
create policy "admin write holidays" on public.holidays for all using (public.is_admin()) with check (public.is_admin());

-- bookings: guests see their own; admin sees all. Inserts happen server-side
-- with the service-role key (which bypasses RLS), so no insert policy here.
create policy "own bookings read" on public.bookings for select using (auth.uid() = user_id or public.is_admin());
create policy "admin write bookings" on public.bookings for update using (public.is_admin()) with check (public.is_admin());

create policy "admin blocked dates" on public.blocked_dates for all using (public.is_admin()) with check (public.is_admin());

-- reviews: everyone reads approved; admin reads/writes all; signed-in users may submit (unapproved)
create policy "public read approved reviews" on public.reviews for select using (approved or public.is_admin() or auth.uid() = user_id);
create policy "submit review" on public.reviews for insert with check (auth.uid() = user_id and approved = false);
create policy "admin manage reviews" on public.reviews for update using (public.is_admin()) with check (public.is_admin());
create policy "admin delete reviews" on public.reviews for delete using (public.is_admin());

-- inquiries: written server-side (service role); admin reads
create policy "admin read inquiries" on public.inquiries for select using (public.is_admin());
create policy "admin update inquiries" on public.inquiries for update using (public.is_admin()) with check (public.is_admin());

-- messages: booking participants only
create policy "participant read messages" on public.messages for select using (
  public.is_admin() or exists (
    select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid()
  )
);
create policy "participant send messages" on public.messages for insert with check (
  sender_id = auth.uid() and (
    (public.is_admin() and from_admin) or
    (not from_admin and exists (
      select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid()
    ))
  )
);

-- blog: public reads published; admin manages
create policy "public read published posts" on public.blog_posts for select using (published or public.is_admin());
create policy "admin manage posts" on public.blog_posts for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Realtime for chat
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------------------
-- Storage bucket for gallery photos (public read)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('gallery', 'gallery', true)
on conflict (id) do nothing;

create policy "public read gallery bucket" on storage.objects for select using (bucket_id = 'gallery');
create policy "admin write gallery bucket" on storage.objects for insert with check (bucket_id = 'gallery' and public.is_admin());
create policy "admin update gallery bucket" on storage.objects for update using (bucket_id = 'gallery' and public.is_admin());
create policy "admin delete gallery bucket" on storage.objects for delete using (bucket_id = 'gallery' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed: extra (non-federal) holidays that get weekend pricing
-- ---------------------------------------------------------------------------
insert into public.holidays (day, label) values
  ('2026-07-24', 'Pioneer Day'),
  ('2027-07-24', 'Pioneer Day')
on conflict (day) do nothing;
