-- Clover Creek Guest House — retire the database-backed photo gallery
--
-- Photos now live in the repository: the files in public/gallery/ and their alt
-- text, captions and ordering in src/content/gallery.ts. Nothing in the
-- application reads public.gallery_images or the 'gallery' storage bucket any
-- more, and the admin gallery screen is gone.
--
-- ---------------------------------------------------------------------------
-- The bucket's contents are NOT deleted here, on purpose.
-- ---------------------------------------------------------------------------
-- storage.objects rows are only Postgres's index of what is in object storage.
-- Deleting them in SQL does not delete the files themselves, which would leave
-- ~79 MB of blobs behind with nothing left to reference them. Supabase blocks
-- exactly that with a BEFORE DELETE trigger on both storage.objects and
-- storage.buckets (storage.protect_delete), so a `delete from storage.objects`
-- here fails with SQLSTATE 42501.
--
-- The Storage API is what actually removes the files. Do that first:
--
--   npx supabase storage rm -r ss:///gallery --linked
--
-- or, in the dashboard, Storage → gallery → select all → Delete, then delete
-- the bucket itself. Either way the bucket row goes with it, or is left empty
-- and inert — the guard below only insists that no objects remain.
--
-- ---------------------------------------------------------------------------
-- DESTRUCTIVE AND IRREVERSIBLE. Before running any of this, confirm all three:
-- ---------------------------------------------------------------------------
--   1. The 15 full-resolution originals are in the owner's Google Drive. The
--      bucket is the last server-side copy — the repo holds only the
--      downscaled ~2400px derivatives.
--   2. docs/gallery-export.json is committed. Once this runs it is the only
--      remaining copy of the alt text and captions.
--   3. Production is live on the new code and rendering all 15 photos from
--      public/gallery/. Deleting first makes this unrecoverable.
--
-- Public bucket URLs (.../storage/v1/object/public/gallery/...) stop resolving
-- once the files are deleted. That is expected: no page, blog post or
-- site_content row references them (verified before writing this migration).

-- ---------------------------------------------------------------------------
-- Guard: refuse to run while the bucket still holds files.
-- ---------------------------------------------------------------------------
-- This makes the ordering impossible to get wrong. It never trips on a fresh
-- `supabase db reset`, where 0001 recreates the bucket empty.
do $$
declare
  remaining bigint;
begin
  select count(*) into remaining from storage.objects where bucket_id = 'gallery';

  if remaining > 0 then
    raise exception
      'The "gallery" bucket still holds % file(s); its contents must be deleted through the Storage API before this migration runs.', remaining
      using hint = 'Run: npx supabase storage rm -r ss:///gallery --linked   (or delete them under Storage -> gallery in the dashboard). Deleting storage.objects rows in SQL would leave the files themselves behind in object storage.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage policies. These only ever referenced bucket_id = 'gallery'.
-- ---------------------------------------------------------------------------
drop policy if exists "public read gallery bucket" on storage.objects;
drop policy if exists "admin write gallery bucket" on storage.objects;
drop policy if exists "admin update gallery bucket" on storage.objects;
drop policy if exists "admin delete gallery bucket" on storage.objects;

-- ---------------------------------------------------------------------------
-- The metadata table. Its RLS policies go with it, but dropping them
-- explicitly keeps this readable next to the storage half above.
-- ---------------------------------------------------------------------------
drop policy if exists "public read gallery" on public.gallery_images;
drop policy if exists "admin write gallery" on public.gallery_images;
drop table if exists public.gallery_images;
