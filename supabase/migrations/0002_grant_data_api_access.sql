-- Clover Creek Guest House — grant Data API access to public tables
--
-- Supabase's current default (and this project's config.toml, with
-- `auto_expose_new_tables` left unset) does NOT auto-grant table privileges to
-- the Data API roles (anon, authenticated, service_role) when a migration
-- creates a table. Postgres evaluates these table-level GRANTs *before*
-- row-level security, so without them every Data API call fails with
-- "permission denied for table …" no matter how the RLS policies in
-- 0001_init.sql are written. Two visible symptoms of this gap:
--   * the service-role review insert failed (permission denied for reviews)
--   * isAdminUser() couldn't SELECT profiles, so admin tools stayed hidden
--
-- Row-level security (enabled on every table in 0001) remains the real access
-- boundary; these grants only let the RLS policies be reached. service_role
-- bypasses RLS entirely, which the trusted server-side code relies on.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

-- Apply the same defaults to objects added by future migrations (created by the
-- postgres role) so this gap doesn't have to be patched again per table.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on routines to anon, authenticated, service_role;
