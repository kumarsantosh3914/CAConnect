-- CAConnect V1 — storage buckets
--
-- Both buckets are PRIVATE. The CA reads files through short-lived signed URLs
-- generated server-side. Paths are namespaced {user_id}/{client_id}/{uuid}-{name}
-- so a leaked path cannot cross tenants.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'client-documents',
    'client-documents',
    false,
    10485760, -- 10 MB
    array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
  ),
  (
    'notice-sources',
    'notice-sources',
    false,
    10485760,
    array['application/pdf']
  )
on conflict (id) do nothing;

-- CAs may read and manage only objects under their own user_id prefix.
-- Anonymous client uploads never use these policies: they go through
-- app/api/upload/[token]/ with the service-role key, which bypasses RLS
-- only inside that one server-side route.

create policy "client_documents_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "client_documents_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "client_documents_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "notice_sources_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'notice-sources'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "notice_sources_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'notice-sources'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "notice_sources_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'notice-sources'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
