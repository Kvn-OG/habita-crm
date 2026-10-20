-- =============================================================================
-- Habita CRM · 006 · Negociações e propostas
-- Estrutura preparada para o módulo de Negociações (próxima etapa).
-- =============================================================================

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete restrict,
  property_id uuid references public.properties (id) on delete set null,
  deal_type public.pipeline_type not null,
  status public.deal_status not null default 'em_andamento',
  amount numeric(14, 2) check (amount is null or amount >= 0),
  expected_close_date date,
  closed_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 5000),
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_closed_at_consistency check (
    (status in ('ganho', 'perdido', 'cancelado')) = (closed_at is not null)
  )
);

create index deals_lead_idx on public.deals (lead_id);
create index deals_property_idx on public.deals (property_id);
create index deals_status_idx on public.deals (status, deal_type);

create trigger deals_set_created_by
before insert or update on public.deals
for each row execute function public.set_created_by();

create trigger deals_set_updated_at
before update on public.deals
for each row execute function public.set_updated_at();

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  amount numeric(14, 2) not null check (amount >= 0),
  status public.proposal_status not null default 'rascunho',
  valid_until date,
  conditions text check (conditions is null or char_length(conditions) <= 10000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index proposals_deal_idx on public.proposals (deal_id);

create trigger proposals_set_created_by
before insert or update on public.proposals
for each row execute function public.set_created_by();

create trigger proposals_set_updated_at
before update on public.proposals
for each row execute function public.set_updated_at();
