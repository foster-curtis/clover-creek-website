-- Clover Creek Guest House — featured reviews
--
-- Lets the owner pin standout reviews so they show first in the homepage
-- teaser and on the full reviews page, regardless of how recent they are.

alter table public.reviews
  add column featured boolean not null default false;
