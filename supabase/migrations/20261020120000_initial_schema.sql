-- =============================================================================
-- Habita CRM · 001 · Fundação: extensões, tipos, utilitários e perfis
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos enumerados (domínios comerciais)
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'gestor', 'corretor');
create type public.contact_type as enum ('comprador', 'interessado_locacao', 'proprietario', 'outro');
create type public.property_type as enum (
  'apartamento', 'casa', 'casa_condominio', 'cobertura', 'kitnet', 'terreno',
  'sala_comercial', 'loja', 'galpao', 'sitio_chacara', 'outro'
);
create type public.property_purpose as enum ('venda', 'locacao', 'ambos');
create type public.property_status as enum (
  'disponivel', 'reservado', 'em_negociacao', 'vendido', 'alugado', 'indisponivel'
);
-- Usado tanto para os funis quanto para a finalidade de um lead.
create type public.pipeline_type as enum ('venda', 'locacao');
create type public.stage_category as enum ('aberto', 'negociacao', 'ganho', 'perdido');
create type public.lead_source as enum (
  'site', 'instagram', 'whatsapp', 'telefone', 'indicacao', 'portal', 'outro'
);
create type public.activity_type as enum (
  'nota', 'ligacao', 'whatsapp', 'email', 'visita', 'reuniao', 'mudanca_etapa', 'sistema'
);
create type public.appointment_type as enum ('visita', 'reuniao', 'outro');
create type public.appointment_status as enum ('agendado', 'realizado', 'cancelado');
create type public.deal_status as enum ('em_andamento', 'ganho', 'perdido', 'cancelado');
create type public.proposal_status as enum ('rascunho', 'enviada', 'aceita', 'recusada', 'cancelada');

-- -----------------------------------------------------------------------------
-- Funções utilitárias de auditoria
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Garante que created_by reflita o usuário autenticado (não pode ser forjado pelo cliente).
create or replace function public.set_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then
      new.created_by := (select auth.uid());
    end if;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfis de usuário
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text not null default '',
  phone text check (phone is null or phone ~ '^\d{10,11}$'),
  role public.app_role not null default 'corretor',
  -- Novas contas nascem inativas: um administrador precisa liberar o acesso.
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Membros da equipe. Criados automaticamente a partir de auth.users.';
comment on column public.profiles.is_active is 'Somente perfis ativos acessam os dados do CRM.';

create index profiles_role_active_idx on public.profiles (role) where is_active;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Cria o perfil quando um usuário é criado no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Mantém o e-mail do perfil sincronizado com o Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Funções de autorização (usadas pelas políticas RLS)
-- SECURITY DEFINER evita recursão de RLS ao consultar profiles.
-- -----------------------------------------------------------------------------
create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active
  );
$$;

create or replace function public.has_role(roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active and role = any (roles)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(array['admin']::public.app_role[]);
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(array['admin', 'gestor']::public.app_role[]);
$$;

revoke execute on function public.is_active_member() from public, anon;
revoke execute on function public.has_role(public.app_role[]) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_manager() from public, anon;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.has_role(public.app_role[]) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_manager() to authenticated;

-- Impede escalonamento de privilégios: papel e status só mudam por um administrador,
-- e ninguém altera o próprio papel/status (garante que sempre reste um admin ativo).
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Execução administrativa (SQL Editor, migrations ou service_role): sem restrições.
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.id <> old.id or new.email <> old.email or new.created_at <> old.created_at then
    raise exception 'Este campo do perfil não pode ser alterado.' using errcode = '42501';
  end if;

  if new.role <> old.role or new.is_active <> old.is_active then
    if not public.is_admin() then
      raise exception 'Apenas administradores podem alterar papéis ou o status de acesso.'
        using errcode = '42501';
    end if;
    if old.id = (select auth.uid()) then
      raise exception 'Você não pode alterar o seu próprio papel ou status de acesso.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard_update
before update on public.profiles
for each row execute function public.guard_profile_update();
