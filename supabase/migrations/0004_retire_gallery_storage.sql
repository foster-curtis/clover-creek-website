-- Clover Creek Guest House — retire the database-backed photo gallery
--
-- Photos now live in the repository: the files in public/gallery/ and their alt
-- text, captions and ordering in src/content/gallery.ts. Nothing in the
-- application reads public.gallery_images or the 'gallery' storage bucket any
-- more, and the admin gallery screen is gone.
--
-- DESTRUCTIVE AND IRREVERSIBLE. Before applying this, confirm all three:
--
--   1. The 15 full-resolution originals are in the owner's Google Drive. This
--      bucket is the last server-side copy of them — the repo holds only the
--      downscaled ~2400px derivatives.
--   2. docs/gallery-export.json is committed. Once this runs it is the only
--      remaining copy of the alt text and captions.
--   3. The new site is live in production and rendering all 15 photos from
--      public/gallery/. Deleting first makes this unrecoverable.
--
-- Public bucket URLs (.../storage/v1/object/public/gallery/...) stop resolving
-- when this runs. That is expected: no page, blog post or site_content row
-- references them (verified before writing this migration).

-- Storage policies first — they reference the bucket.
drop policy if exists "public read gallery bucket" on storage.objects;
drop policy if exists "admin write gallery bucket" on storage.objects;
drop policy if exists "admin update gallery bucket" on storage.objects;
drop policy if exists "admin delete gallery bucket" on storage.objects;

-- Then the objects, then the bucket itself. A bucket with rows left in it
-- cannot be dropped.
delete from storage.objects where bucket_id = 'gallery';
delete from storage.buckets where id = 'gallery';

-- Finally the metadata table. Its RLS policies go with it, but dropping them
-- explicitly keeps this readable next to the storage half above.
drop policy if exists "public read gallery" on public.gallery_images;
drop policy if exists "admin write gallery" on public.gallery_images;
drop table if exists public.gallery_images;
