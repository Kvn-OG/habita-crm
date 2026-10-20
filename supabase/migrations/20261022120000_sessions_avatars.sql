-- =============================================================================
-- Habita CRM · 011 · Sessão única por usuário e foto de perfil
-- - Funções para detectar outra sessão aberta da mesma conta no login e para o
--   dispositivo antigo perceber que a sua sessão foi encerrada.
-- - Coluna avatar_path em profiles e bucket privado "avatars".
--   Estrutura dos caminhos: <user_id>/<arquivo>
-- Seguro para executar mais de uma vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Sessões (auth.sessions só é acessível por funções security definer)
-- -----------------------------------------------------------------------------

-- Outras sessões da conta atual ainda válidas, sem incluir a sessão desta requisição.
create or replace function public.other_active_sessions()
returns table (id uuid, created_at timestamptz, last_active_at timestamptz, user_agent text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
    select
      s.id,
      s.created_at,
      greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'utc') as last_active_at,
      s.user_agent
    from auth.sessions s
    where s.user_id = (select auth.uid())
      and s.id is distinct from nullif((select auth.jwt()) ->> 'session_id', '')::uuid
      and (s.not_after is null or s.not_after > now())
    order by 3 desc;
end;
$$;

-- false quando a sessão desta requisição foi encerrada (ex.: login em outro dispositivo).
create or replace function public.current_session_active()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_id uuid := nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
begin
  if current_id is null then
    return true;
  end if;
  return exists (select 1 from auth.sessions s where s.id = current_id and s.user_id = (select auth.uid()));
end;
$$;

revoke all on function public.other_active_sessions() from public, anon;
revoke all on function public.current_session_active() from public, anon;
grant execute on function public.other_active_sessions() to authenticated;
grant execute on function public.current_session_active() to authenticated;

-- -----------------------------------------------------------------------------
-- Foto de perfil
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_path text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_path_check') then
    -- Cada perfil só aponta para arquivos da própria pasta.
    alter table public.profiles
      add constraint profiles_avatar_path_check
      check (avatar_path is null or (char_length(avatar_path) <= 200 and avatar_path like id::text || '/%'));
  end if;
end;
$$;

comment on column public.profiles.avatar_path is 'Caminho da foto de perfil no bucket avatars (<user_id>/<arquivo>).';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_storage_select on storage.objects;
drop policy if exists avatars_storage_insert on storage.objects;
drop policy if exists avatars_storage_delete on storage.objects;

create policy avatars_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and ((select public.is_active_member()) or (storage.foldername(name))[1] = (select auth.uid())::text)
  );

create policy avatars_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
