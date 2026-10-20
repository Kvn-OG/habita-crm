-- =============================================================================
-- Habita CRM · 003 · Imóveis, fotos e proprietários
-- =============================================================================

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{0,19}$'),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  property_type public.property_type not null,
  purpose public.property_purpose not null,
  status public.property_status not null default 'disponivel',
  description text check (description is null or char_length(description) <= 10000),

  -- Localização
  postal_code text check (postal_code is null or postal_code ~ '^\d{8}$'),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  city text check (city is null or char_length(city) <= 120),
  neighborhood text check (neighborhood is null or char_length(neighborhood) <= 120),
  street text check (street is null or char_length(street) <= 200),
  street_number text check (street_number is null or char_length(street_number) <= 20),
  complement text check (complement is null or char_length(complement) <= 120),

  -- Características (áreas em m²)
  land_area numeric(12, 2) check (land_area is null or land_area >= 0),
  built_area numeric(12, 2) check (built_area is null or built_area >= 0),
  bedrooms smallint check (bedrooms is null or bedrooms between 0 and 99),
  suites smallint check (suites is null or suites between 0 and 99),
  bathrooms smallint check (bathrooms is null or bathrooms between 0 and 99),
  parking_spaces smallint check (parking_spaces is null or parking_spaces between 0 and 99),

  -- Valores em reais (BRL)
  sale_price numeric(14, 2) check (sale_price is null or sale_price >= 0),
  rent_price numeric(14, 2) check (rent_price is null or rent_price >= 0),
  condo_fee numeric(12, 2) check (condo_fee is null or condo_fee >= 0),
  iptu numeric(12, 2) check (iptu is null or iptu >= 0),

  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint properties_code_key unique (code),
  constraint properties_suites_le_bedrooms check (suites is null or bedrooms is null or suites <= bedrooms),
  constraint properties_sale_price_required check (purpose = 'locacao' or sale_price is not null),
  constraint properties_rent_price_required check (purpose = 'venda' or rent_price is not null)
);

comment on column public.properties.code is 'Código interno único, em maiúsculas (ex.: IM-0001).';
comment on column public.properties.iptu is 'Valor anual do IPTU em reais.';

create index properties_filters_idx on public.properties (purpose, property_type, status);
create index properties_status_idx on public.properties (status);
create index properties_created_at_idx on public.properties (created_at desc);
create index properties_code_trgm_idx on public.properties using gin (code extensions.gin_trgm_ops);
create index properties_title_trgm_idx on public.properties using gin (title extensions.gin_trgm_ops);
create index properties_street_trgm_idx on public.properties using gin (street extensions.gin_trgm_ops);
create index properties_neighborhood_trgm_idx on public.properties using gin (neighborhood extensions.gin_trgm_ops);

create or replace function public.normalize_property()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.code := upper(btrim(new.code));
  new.title := btrim(new.title);
  new.state := nullif(upper(btrim(coalesce(new.state, ''))), '');
  new.postal_code := nullif(regexp_replace(coalesce(new.postal_code, ''), '\D', '', 'g'), '');
  return new;
end;
$$;

create trigger properties_normalize
before insert or update on public.properties
for each row execute function public.normalize_property();

create trigger properties_set_created_by
before insert or update on public.properties
for each row execute function public.set_created_by();

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Fotos: apenas o caminho no Supabase Storage é armazenado (nunca o binário).
-- -----------------------------------------------------------------------------
create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  storage_path text not null unique,
  position integer not null default 0 check (position >= 0),
  caption text check (caption is null or char_length(caption) <= 200),
  mime_type text check (mime_type is null or mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size integer check (file_size is null or file_size between 1 and 5242880),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint property_images_path_matches_property
    check (storage_path like 'properties/' || property_id::text || '/%')
);

create index property_images_property_idx on public.property_images (property_id, position);

create trigger property_images_set_created_by
before insert or update on public.property_images
for each row execute function public.set_created_by();

-- -----------------------------------------------------------------------------
-- Relação N:N entre imóveis e proprietários
-- -----------------------------------------------------------------------------
create table public.property_owners (
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references public.owners (id) on delete cascade,
  share_percentage numeric(5, 2) check (share_percentage is null or (share_percentage > 0 and share_percentage <= 100)),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (property_id, owner_id)
);

create index property_owners_owner_idx on public.property_owners (owner_id);

create trigger property_owners_set_created_by
before insert or update on public.property_owners
for each row execute function public.set_created_by();
