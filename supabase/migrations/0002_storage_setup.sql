-- ============================================
-- STORAGE: assets bucket
-- ============================================
-- Public-read bucket. Writes always come from one of two trusted sources:
--   1. API routes using the service-role key (server-side uploads)
--   2. Browser uploads via short-lived signed URLs created server-side
-- Both mechanisms bypass RLS, so we only declare a read policy here.
-- Direct anonymous writes are not possible because no client outside of our
-- code holds a write-grant.

insert into storage.buckets (id, name, public, file_size_limit)
values ('assets', 'assets', true, 5368709120) -- 5 GB per file
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "assets_public_read" on storage.objects;
create policy "assets_public_read" on storage.objects
  for select using (bucket_id = 'assets');
