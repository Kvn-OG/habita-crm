-- =============================================================================
-- Habita CRM · 014 · Papel único de administrador, exclusão de acessos e Marketing
-- - Os papéis passam a ser apenas Administrador e Corretor (o antigo "gestor"
--   vira corretor). is_manager() passa a significar "administrador".
-- - Exclusão de acessos: ao apagar um usuário, os registros dele são mantidos
--   (autor e responsável ficam vazios).
-- - Marketing: landing pages externas (até 5) que enviam leads ao funil e
--   campanhas de tráfego pago com investimento e resultados.
-- Seguro para executar mais de uma vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Papéis: somente admin e corretor
-- -----------------------------------------------------------------------------
update public.profiles set role = 'corretor' where role = 'gestor';

do $$
begin
  alter table public.profiles
    add constraint profiles_role_valid check (role in ('admin', 'corretor'));
exception when duplicate_object then null;
end;
$$;

-- Todas as políticas que usavam "gestor ou admin" passam a valer só para administradores.
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin();
$$;

create or replace function public.report_metrics(p_from timestamptz, p_to timestamptz, p_pipeline public.pipeline_type default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem ver os relatórios.' using errcode = '42501';
  end if;
  return public.report_metrics_data(p_from, p_to, p_pipeline);
end;
$$;

-- -----------------------------------------------------------------------------
-- Exclusão de acessos: o ON DELETE SET NULL do autor não pode ser desfeito pelo
-- trigger que protege created_by (senão a exclusão do usuário falha).
-- -----------------------------------------------------------------------------
create or replace function public.set_created_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then
      new.created_by := (select auth.uid());
    end if;
  else
    -- O autor só pode ficar vazio quando o perfil dele foi excluído.
    if not (new.created_by is null and old.created_by is not null
            and not exists (select 1 from public.profiles p where p.id = old.created_by)) then
      new.created_by := old.created_by;
    end if;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Origem "Landing page" nos leads
-- -----------------------------------------------------------------------------
alter type public.lead_source add value if not exists 'landing_page';

-- -----------------------------------------------------------------------------
-- Landing pages (criadas fora do CRM e vinculadas a ele)
-- -----------------------------------------------------------------------------
create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  purpose text not null check (char_length(btrim(purpose)) between 2 and 120),
  url text check (url is null or (url ~* '^https?://[^\s]+$' and char_length(url) <= 500)),
  -- Funil em que os leads recebidos entram.
  pipeline public.pipeline_type not null default 'venda',
  default_assignee uuid references public.profiles (id) on delete set null,
  is_active boolean not null default true,
  -- Identificador usado pelo formulário da página para enviar leads ao CRM.
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.landing_pages is 'Landing pages externas que enviam leads ao CRM (máximo de 5 por instalação).';

drop trigger if exists landing_pages_set_created_by on public.landing_pages;
create trigger landing_pages_set_created_by
before insert or update on public.landing_pages
for each row execute function public.set_created_by();

drop trigger if exists landing_pages_set_updated_at on public.landing_pages;
create trigger landing_pages_set_updated_at
before update on public.landing_pages
for each row execute function public.set_updated_at();

create or replace function public.limit_landing_pages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.landing_pages'));
  if (select count(*) from public.landing_pages) >= 5 then
    raise exception 'O limite é de 5 landing pages. Exclua uma antes de cadastrar outra.' using errcode = '23514';
  end if;
  new.name := btrim(new.name);
  new.purpose := btrim(new.purpose);
  return new;
end;
$$;

drop trigger if exists landing_pages_limit on public.landing_pages;
create trigger landing_pages_limit
before insert on public.landing_pages
for each row execute function public.limit_landing_pages();

-- -----------------------------------------------------------------------------
-- Campanhas de tráfego pago
-- -----------------------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  platform text not null default 'meta_ads'
    check (platform in ('meta_ads', 'google_ads', 'tiktok_ads', 'linkedin_ads', 'outro')),
  objective text not null default 'leads'
    check (objective in ('leads', 'mensagens', 'trafego', 'reconhecimento', 'vendas')),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'ativa', 'pausada', 'encerrada')),
  landing_page_id uuid references public.landing_pages (id) on delete set null,
  -- Valor do parâmetro utm_campaign dos anúncios: liga os leads à campanha.
  utm_campaign text unique check (utm_campaign is null or utm_campaign ~ '^[a-z0-9_.-]{1,80}$'),
  starts_on date,
  ends_on date,
  budget numeric(14, 2) check (budget is null or budget >= 0),
  spent numeric(14, 2) not null default 0 check (spent >= 0),
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  notes text check (notes is null or char_length(notes) <= 5000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_period check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

comment on table public.campaigns is 'Campanhas de tráfego pago: investimento, alcance e leads gerados.';

create or replace function public.normalize_campaign()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.utm_campaign := nullif(lower(btrim(coalesce(new.utm_campaign, ''))), '');
  return new;
end;
$$;

drop trigger if exists campaigns_normalize on public.campaigns;
create trigger campaigns_normalize
before insert or update on public.campaigns
for each row execute function public.normalize_campaign();

drop trigger if exists campaigns_set_created_by on public.campaigns;
create trigger campaigns_set_created_by
before insert or update on public.campaigns
for each row execute function public.set_created_by();

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Origem de marketing dos leads
-- -----------------------------------------------------------------------------
alter table public.leads add column if not exists landing_page_id uuid references public.landing_pages (id) on delete set null;
alter table public.leads add column if not exists campaign_id uuid references public.campaigns (id) on delete set null;
alter table public.leads add column if not exists utm jsonb not null default '{}'::jsonb;

create index if not exists leads_landing_page_idx on public.leads (landing_page_id) where landing_page_id is not null;
create index if not exists leads_campaign_idx on public.leads (campaign_id) where campaign_id is not null;

-- -----------------------------------------------------------------------------
-- Permissões: Marketing é exclusivo de administradores
-- -----------------------------------------------------------------------------
alter table public.landing_pages enable row level security;
alter table public.campaigns enable row level security;

drop policy if exists landing_pages_admin on public.landing_pages;
create policy landing_pages_admin on public.landing_pages
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists campaigns_admin on public.campaigns;
create policy campaigns_admin on public.campaigns
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Resultados por landing page e por campanha
-- -----------------------------------------------------------------------------
create or replace view public.landing_page_overview
with (security_invoker = true)
as
select
  lp.*,
  p.full_name as assignee_name,
  (select count(*) from public.leads l where l.landing_page_id = lp.id)::integer as leads_total,
  (select count(*) from public.leads l where l.landing_page_id = lp.id and l.created_at >= now() - interval '30 days')::integer as leads_30d,
  (select max(l.created_at) from public.leads l where l.landing_page_id = lp.id) as last_lead_at,
  (select count(*) from public.deals d join public.leads l on l.id = d.lead_id
   where l.landing_page_id = lp.id and d.status = 'ganho')::integer as deals_won,
  (select coalesce(sum(d.amount), 0) from public.deals d join public.leads l on l.id = d.lead_id
   where l.landing_page_id = lp.id and d.status = 'ganho') as won_amount
from public.landing_pages lp
left join public.profiles p on p.id = lp.default_assignee;

create or replace view public.campaign_overview
with (security_invoker = true)
as
select
  c.*,
  lp.name as landing_page_name,
  r.leads,
  r.deals_won,
  r.won_amount,
  case when r.leads > 0 then round(c.spent / r.leads, 2) end as cost_per_lead,
  case when r.deals_won > 0 then round(c.spent / r.deals_won, 2) end as cost_per_deal,
  case when c.impressions > 0 then round(c.clicks::numeric * 100 / c.impressions, 2) end as ctr
from public.campaigns c
left join public.landing_pages lp on lp.id = c.landing_page_id
cross join lateral (
  select
    (select count(*) from public.leads l where l.campaign_id = c.id)::integer as leads,
    (select count(*) from public.deals d join public.leads l on l.id = d.lead_id
     where l.campaign_id = c.id and d.status = 'ganho')::integer as deals_won,
    (select coalesce(sum(d.amount), 0) from public.deals d join public.leads l on l.id = d.lead_id
     where l.campaign_id = c.id and d.status = 'ganho') as won_amount
) r;

-- -----------------------------------------------------------------------------
-- Recebimento de leads das landing pages
-- Chamada SOMENTE pelo servidor (/api/public/lead, com service_role).
-- -----------------------------------------------------------------------------
create or replace function public.submit_landing_page_lead(
  p_token text,
  p_name text,
  p_phone text,
  p_email text default null,
  p_message text default null,
  p_utm jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page public.landing_pages%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_utm jsonb := '{}'::jsonb;
  v_contact uuid;
  v_lead uuid;
  v_stage uuid;
  v_campaign uuid;
  v_campaign_name text;
  v_assignee uuid;
begin
  select * into v_page from public.landing_pages where token = p_token and is_active;
  if not found then
    raise exception 'Landing page não encontrada ou desativada.' using errcode = 'P0002';
  end if;

  -- Telefone com DDI 55 também é aceito.
  if char_length(v_phone) in (12, 13) and v_phone like '55%' then
    v_phone := substr(v_phone, 3);
  end if;
  if v_phone !~ '^\d{10,11}$' then
    raise exception 'Informe um telefone com DDD.' using errcode = '22023';
  end if;
  if char_length(v_name) not between 2 and 160 then
    raise exception 'Informe o nome.' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    v_email := null;
  end if;
  v_message := left(v_message, 2000);

  -- Apenas os parâmetros UTM conhecidos, em texto curto.
  select coalesce(jsonb_object_agg(key, left(value, 200)), '{}'::jsonb) into v_utm
  from jsonb_each_text(coalesce(p_utm, '{}'::jsonb))
  where key in ('utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term') and btrim(value) <> '';

  -- Campanha: pelo utm_campaign; senão, a única campanha ativa ligada à página.
  select id, name into v_campaign, v_campaign_name
  from public.campaigns where utm_campaign = lower(btrim(v_utm ->> 'utm_campaign'));
  if v_campaign is null then
    select id, name into v_campaign, v_campaign_name
    from public.campaigns c
    where c.landing_page_id = v_page.id and c.status = 'ativa'
      and (select count(*) from public.campaigns x where x.landing_page_id = v_page.id and x.status = 'ativa') = 1;
  end if;

  -- Contato: reaproveita pelo telefone/WhatsApp ou e-mail; senão cria.
  select id into v_contact from public.contacts where phone = v_phone or whatsapp = v_phone limit 1;
  if v_contact is null and v_email is not null then
    select id into v_contact from public.contacts where email = v_email limit 1;
  end if;
  if v_contact is null then
    insert into public.contacts (full_name, phone, email, contact_type)
    values (v_name, v_phone, v_email,
            case v_page.pipeline when 'venda' then 'comprador'::public.contact_type else 'interessado_locacao'::public.contact_type end)
    returning id into v_contact;
  end if;

  -- Já existe um lead em andamento deste contato no mesmo funil: só registra o novo contato.
  select l.id into v_lead
  from public.leads l join public.pipeline_stages s on s.id = l.stage_id
  where l.contact_id = v_contact and l.purpose = v_page.pipeline and s.category in ('aberto', 'negociacao')
  order by l.created_at desc
  limit 1;

  if v_lead is not null then
    insert into public.activities (activity_type, description, lead_id, contact_id, metadata)
    values ('sistema',
            'Novo contato pela landing page "' || v_page.name || '"' || coalesce(': ' || v_message, '.'),
            v_lead, v_contact,
            jsonb_build_object('landing_page_id', v_page.id, 'campaign_id', v_campaign, 'utm', v_utm));
    return jsonb_build_object('lead_id', v_lead, 'created', false);
  end if;

  select id into v_stage
  from public.pipeline_stages
  where pipeline = v_page.pipeline and is_active and category = 'aberto'
  order by position
  limit 1;
  if v_stage is null then
    raise exception 'O funil não tem etapa inicial ativa.' using errcode = '23514';
  end if;

  select id into v_assignee from public.profiles where id = v_page.default_assignee and is_active;

  insert into public.leads (contact_id, purpose, source, stage_id, assigned_to, notes, landing_page_id, campaign_id, utm)
  values (v_contact, v_page.pipeline, 'landing_page', v_stage, v_assignee, v_message, v_page.id, v_campaign, v_utm)
  returning id into v_lead;

  insert into public.activities (activity_type, description, lead_id, contact_id, metadata)
  values ('sistema',
          'Lead recebido pela landing page "' || v_page.name || '"' || coalesce(' (campanha ' || v_campaign_name || ')', '') || '.',
          v_lead, v_contact,
          jsonb_build_object('landing_page_id', v_page.id, 'campaign_id', v_campaign, 'utm', v_utm));

  return jsonb_build_object('lead_id', v_lead, 'created', true);
end;
$$;

revoke execute on function public.submit_landing_page_lead(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_landing_page_lead(text, text, text, text, text, jsonb) to service_role;
revoke execute on function public.limit_landing_pages() from public, anon, authenticated;
