-- Clover Creek Guest House — record refunds as data, not prose
--
-- refundBooking() (src/app/admin/actions.ts) set status = 'cancelled' and wrote
-- the amount returned only into the free-text `notes` column, as one of:
--
--   'cancelled · 75% refund $562.50 (4 to 6 weeks before check-in)'
--   'cancelled · refunded $1,200.00 (override; policy said 50%)'
--
-- That left the lodging tax report regexing money back out of an English
-- sentence, and left 'cancelled' unable to distinguish two opposite situations:
--
--   * a hold that expired or a checkout that was abandoned — no money ever
--     arrived, nothing to report; and
--   * a stay that was paid for and then refunded in part or in full — money did
--     arrive, tax was owed on it, and some of it went back.
--
-- Both now have an answer in the data: `refund_cents` is how much went back
-- (0 for every booking that was never refunded) and `refunded_at` is when.
--
-- `refunded_at` matters as much as the amount. A refund is reported as a
-- reduction in the period it was *issued*, not by amending the return for the
-- period the booking was paid for — so the report needs its date to put it on
-- the right return. See src/lib/taxReport.ts.

alter table public.bookings
  add column refund_cents int not null default 0,
  add column refunded_at timestamptz;

comment on column public.bookings.refund_cents is
  'Amount refunded to the guest, in cents. 0 when nothing was refunded.';
comment on column public.bookings.refunded_at is
  'When the refund was issued — the period it reduces. Null when refund_cents is 0, and also on rows backfilled below, where the date was never recorded.';

-- Backfill from the notes refundBooking() has been writing. `least(…)` keeps a
-- malformed historical note from exceeding the total and tripping the check
-- constraint added afterwards. `refunded_at` is deliberately left null: the
-- date genuinely was not recorded, and inventing one (the booking date, say)
-- would put refunds on returns they never belonged to. taxReport.ts falls back
-- for these rows and the fallback is documented there.
update public.bookings
set refund_cents = least(
      total_cents,
      round(
        replace(
          substring(notes from 'refund(?:ed)?[[:space:]]+\$([0-9,]+(?:\.[0-9]{1,2})?)'),
          ',', ''
        )::numeric * 100
      )::int
    )
where status = 'cancelled'
  and notes ~ 'refund(ed)?[[:space:]]+\$[0-9]';

alter table public.bookings
  add constraint bookings_refund_cents_nonnegative
    check (refund_cents >= 0),
  add constraint bookings_refund_within_total
    check (refund_cents <= total_cents);

-- Finding the refunds for a filing period is the report's hot path.
create index bookings_refunded_at_idx
  on public.bookings (refunded_at)
  where refund_cents > 0;
