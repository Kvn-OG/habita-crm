-- =============================================================================
-- Habita CRM · 002 · Contatos e proprietários
-- =============================================================================

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  -- Telefones armazenados apenas com dígitos, incluindo DDD (10 ou 11 dígitos).
  phone text not null check (phone ~ '^\d{10,11}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\d{10,11}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_type public.contact_type not null default 'outro',
  notes text check (notes is null or char_length(notes) <= 5000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contacts is 'Pessoas com quem a imobiliária se relaciona. Um contato pode ter vários leads e ser proprietário de vários imóveis.';

-- Prevenção de duplicidades (o frontend avisa antes; o banco garante).
create unique index contacts_phone_key on public.contacts (phone);
create unique index contacts_email_key on public.contacts (lower(email)) where email is not null;
create index contacts_whatsapp_idx on public.contacts (whatsapp) where whatsapp is not null;
create index contacts_full_name_trgm_idx on public.contacts using gin (full_name extensions.gin_trgm_ops);
create index contacts_type_idx on public.contacts (contact_type);
create index contacts_created_at_idx on public.contacts (created_at desc);

-- Normaliza e-mail e campos opcionais vazios.
create or replace function public.normalize_contact()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.full_name := btrim(new.full_name);
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.whatsapp := nullif(btrim(coalesce(new.whatsapp, '')), '');
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  if new.whatsapp = new.phone then
    new.whatsapp := null;
  end if;
  return new;
end;
$$;

create trigger contacts_normalize
before insert or update on public.contacts
for each row execute function public.normalize_contact();

create trigger contacts_set_created_by
before insert or update on public.contacts
for each row execute function public.set_created_by();

create trigger contacts_set_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Proprietários: extensão de um contato (evita duplicar nome/telefone/e-mail).
-- -----------------------------------------------------------------------------
create table public.owners (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null unique references public.contacts (id) on delete restrict,
  notes text check (notes is null or char_length(notes) <= 5000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.owners is 'Contatos que são proprietários de imóveis. Dados pessoais permanecem em contacts.';

create trigger owners_set_created_by
before insert or update on public.owners
for each row execute function public.set_created_by();

create trigger owners_set_updated_at
before update on public.owners
for each row execute function public.set_updated_at();
