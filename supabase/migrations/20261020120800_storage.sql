-- =============================================================================
-- Habita CRM · 009 · Armazenamento de fotos de imóveis
-- Bucket privado: as imagens só são exibidas por URLs assinadas e temporárias.
-- Estrutura dos caminhos: properties/<property_id>/<arquivo>
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-images',
  'property-images',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy property_images_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'property-images' and (select public.is_active_member()));

create policy property_images_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and (select public.is_active_member())
    and (storage.foldername(name))[1] = 'properties'
    and exists (
      select 1 from public.properties p
      where p.id::text = (storage.foldername(name))[2]
    )
  );

create policy property_images_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'property-images'
    and ((select public.is_manager()) or owner_id = (select auth.uid())::text)
  );
