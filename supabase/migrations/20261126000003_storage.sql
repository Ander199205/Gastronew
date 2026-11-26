-- Fotos de platos y logos: bucket público, cada restaurante escribe solo en su carpeta (<restaurant_id>/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('restaurant-media', 'restaurant-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.can_manage_media(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  return public.is_manager_of((split_part(p_name, '/', 1))::uuid);
exception when others then
  return false;
end $$;
revoke execute on function public.can_manage_media(text) from public, anon;
grant execute on function public.can_manage_media(text) to authenticated;

create policy "media manager insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'restaurant-media' and public.can_manage_media(name));
create policy "media manager update" on storage.objects for update to authenticated
  using (bucket_id = 'restaurant-media' and public.can_manage_media(name));
create policy "media manager delete" on storage.objects for delete to authenticated
  using (bucket_id = 'restaurant-media' and public.can_manage_media(name));
