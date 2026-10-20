-- =============================================================================
-- Habita CRM · 004 · Funis comerciais e leads
-- =============================================================================

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline public.pipeline_type not null,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  position smallint not null check (position >= 0),
  -- Categoria orienta indicadores: aberto, em negociação, ganho ou perdido.
  category public.stage_category not null default 'aberto',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pipeline_stages_position_key unique (pipeline, position) deferrable initially immediate,
  constraint pipeline_stages_name_key unique (pipeline, name)
);

comment on table public.pipeline_stages is 'Etapas configuráveis dos funis de venda e locação.';

create trigger pipeline_stages_set_updated_at
before update on public.pipeline_stages
for each row execute function public.set_updated_at();

insert into public.pipeline_stages (pipeline, name, position, category) values
  ('venda', 'Novo lead', 1, 'aberto'),
  ('venda', 'Primeiro contato', 2, 'aberto'),
  ('venda', 'Qualificado', 3, 'aberto'),
  ('venda', 'Visita agendada', 4, 'aberto'),
  ('venda', 'Visita realizada', 5, 'aberto'),
  ('venda', 'Proposta', 6, 'negociacao'),
  ('venda', 'Negociação', 7, 'negociacao'),
  ('venda', 'Fechado', 8, 'ganho'),
  ('venda', 'Perdido', 9, 'perdido'),
  ('locacao', 'Novo interessado', 1, 'aberto'),
  ('locacao', 'Primeiro contato', 2, 'aberto'),
  ('locacao', 'Qualificado', 3, 'aberto'),
  ('locacao', 'Visita agendada', 4, 'aberto'),
  ('locacao', 'Visita realizada', 5, 'aberto'),
  ('locacao', 'Análise cadastral', 6, 'negociacao'),
  ('locacao', 'Proposta', 7, 'negociacao'),
  ('locacao', 'Contrato', 8, 'negociacao'),
  ('locacao', 'Concluído', 9, 'ganho'),
  ('locacao', 'Perdido', 10, 'perdido');

-- -----------------------------------------------------------------------------
-- Leads
-- -----------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete restrict,
  purpose public.pipeline_type not null,
  source public.lead_source not null default 'outro',
  stage_id uuid not null references public.pipeline_stages (id) on delete restrict,
  assigned_to uuid references public.profiles (id) on delete set null,
  min_budget numeric(14, 2) check (min_budget is null or min_budget >= 0),
  max_budget numeric(14, 2) check (max_budget is null or max_budget >= 0),
  desired_region text check (desired_region is null or char_length(desired_region) <= 200),
  notes text check (notes is null or char_length(notes) <= 5000),
  next_follow_up_at timestamptz,
  stage_changed_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_budget_range check (min_budget is null or max_budget is null or min_budget <= max_budget)
);

create index leads_contact_idx on public.leads (contact_id);
create index leads_stage_idx on public.leads (stage_id);
create index leads_assigned_idx on public.leads (assigned_to);
create index leads_purpose_idx on public.leads (purpose);
create index leads_created_at_idx on public.leads (created_at desc);
create index leads_follow_up_idx on public.leads (next_follow_up_at) where next_follow_up_at is not null;

create trigger leads_set_created_by
before insert or update on public.leads
for each row execute function public.set_created_by();

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

-- Valida o funil da etapa e mantém datas de mudança de etapa/fechamento.
create or replace function public.validate_lead_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_stage public.pipeline_stages%rowtype;
begin
  select * into v_stage from public.pipeline_stages where id = new.stage_id;

  if not found then
    raise exception 'Etapa comercial inexistente.' using errcode = '23503';
  end if;

  if v_stage.pipeline <> new.purpose then
    raise exception 'A etapa selecionada não pertence ao funil de %.',
      case new.purpose when 'venda' then 'venda' else 'locação' end
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' or new.stage_id <> old.stage_id then
    if not v_stage.is_active then
      raise exception 'A etapa selecionada está desativada.' using errcode = '23514';
    end if;
    new.stage_changed_at := now();
    new.closed_at := case when v_stage.category in ('ganho', 'perdido') then now() else null end;
  end if;

  return new;
end;
$$;

create trigger leads_validate_stage
before insert or update of stage_id, purpose on public.leads
for each row execute function public.validate_lead_stage();

-- -----------------------------------------------------------------------------
-- Imóveis de interesse de um lead (N:N)
-- -----------------------------------------------------------------------------
create table public.lead_properties (
  lead_id uuid not null references public.leads (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (lead_id, property_id)
);

create index lead_properties_property_idx on public.lead_properties (property_id);

create trigger lead_properties_set_created_by
before insert or update on public.lead_properties
for each row execute function public.set_created_by();
