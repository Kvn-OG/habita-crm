-- =============================================================================
-- Habita CRM · 012 · Negociações e relatórios
-- - Motivo de perda nas negociações e no máximo uma proposta aceita por negociação.
-- - Regras automáticas: tipo da negociação igual à finalidade do lead, data de
--   encerramento, situação do imóvel, etapa do lead e histórico de atividades.
-- - Permissões de edição de negociações e propostas alinhadas às dos leads.
-- - View deal_overview e função report_metrics (relatórios por período).
-- Seguro para executar mais de uma vez.
-- =============================================================================

alter table public.deals add column if not exists loss_reason text;

do $$
begin
  alter table public.deals
    add constraint deals_loss_reason_length check (loss_reason is null or char_length(loss_reason) <= 300);
exception when duplicate_object then null;
end;
$$;

create unique index if not exists proposals_one_accepted_idx on public.proposals (deal_id) where status = 'aceita';
create index if not exists deals_assigned_idx on public.deals (assigned_to);
create index if not exists deals_closed_at_idx on public.deals (closed_at) where closed_at is not null;

-- -----------------------------------------------------------------------------
-- Valores em reais para mensagens do histórico (ex.: R$ 1.234,56)
-- -----------------------------------------------------------------------------
create or replace function public.format_brl(p_value numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || translate(to_char(p_value, 'FM999,999,999,990.00'), ',.', '.,');
$$;

-- -----------------------------------------------------------------------------
-- Validação da negociação (antes de gravar)
-- -----------------------------------------------------------------------------
create or replace function public.validate_deal()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_purpose public.pipeline_type;
begin
  select purpose into v_purpose from public.leads where id = new.lead_id;
  if v_purpose is not null and v_purpose <> new.deal_type then
    raise exception 'O tipo da negociação deve ser igual à finalidade do lead (%).',
      case v_purpose when 'venda' then 'venda' else 'locação' end
      using errcode = '23514';
  end if;

  if new.status = 'em_andamento' then
    new.closed_at := null;
  elsif tg_op = 'INSERT' or old.status = 'em_andamento' then
    new.closed_at := now();
  else
    new.closed_at := coalesce(old.closed_at, now());
  end if;

  if new.status <> 'perdido' then
    new.loss_reason := null;
  end if;

  return new;
end;
$$;

drop trigger if exists deals_validate on public.deals;
create trigger deals_validate
before insert or update on public.deals
for each row execute function public.validate_deal();

-- -----------------------------------------------------------------------------
-- Efeitos da negociação (depois de gravar): imóvel, lead e histórico.
-- Executa com as permissões do usuário (SECURITY INVOKER): respeita RLS.
-- -----------------------------------------------------------------------------
create or replace function public.sync_deal_effects()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_release uuid[] := array[]::uuid[];
  v_stage uuid;
  v_contact uuid;
  v_description text;
begin
  -- Imóveis que podem ter ficado sem negociação em andamento.
  if tg_op = 'DELETE' then
    v_release := array[old.property_id];
  else
    if tg_op = 'UPDATE' and old.property_id is distinct from new.property_id then
      v_release := array[old.property_id];
    end if;
    if new.status in ('perdido', 'cancelado') then
      v_release := v_release || new.property_id;
    end if;
  end if;

  if tg_op <> 'DELETE' and new.property_id is not null then
    if new.status = 'ganho' and (tg_op = 'INSERT' or old.status <> 'ganho' or old.property_id is distinct from new.property_id) then
      update public.properties
      set status = case new.deal_type when 'venda' then 'vendido'::public.property_status else 'alugado'::public.property_status end
      where id = new.property_id;
    elsif tg_op = 'UPDATE' and old.status = 'ganho' and new.status <> 'ganho' and old.property_id = new.property_id then
      -- Negociação ganha reaberta ou desfeita: o imóvel volta para o mercado.
      update public.properties
      set status = case when new.status = 'em_andamento' then 'em_negociacao'::public.property_status else 'disponivel'::public.property_status end
      where id = new.property_id and status in ('vendido', 'alugado');
    elsif new.status = 'em_andamento' then
      update public.properties set status = 'em_negociacao' where id = new.property_id and status = 'disponivel';
    end if;
  end if;

  update public.properties p
  set status = 'disponivel'
  where p.id = any (v_release)
    and p.status = 'em_negociacao'
    and not exists (select 1 from public.deals d where d.property_id = p.id and d.status = 'em_andamento');

  if tg_op = 'DELETE' then
    return null;
  end if;

  -- Negociação ganha: o lead vai para a etapa de conclusão do funil.
  if new.status = 'ganho' and (tg_op = 'INSERT' or old.status <> 'ganho') then
    select s.id into v_stage
    from public.pipeline_stages s
    where s.pipeline = new.deal_type and s.category = 'ganho' and s.is_active
    order by s.position
    limit 1;

    if v_stage is not null then
      update public.leads l
      set stage_id = v_stage
      where l.id = new.lead_id
        and not exists (select 1 from public.pipeline_stages s where s.id = l.stage_id and s.category = 'ganho');
    end if;
  end if;

  if tg_op = 'INSERT' then
    v_description := 'Negociação de ' || case new.deal_type when 'venda' then 'venda' else 'locação' end || ' aberta'
      || coalesce(' no valor de ' || public.format_brl(new.amount), '') || '.';
  elsif new.status <> old.status then
    v_description := case new.status
      when 'ganho' then 'Negociação ganha' || coalesce(' por ' || public.format_brl(new.amount), '') || '.'
      when 'perdido' then 'Negociação perdida' || coalesce(': ' || new.loss_reason, '') || '.'
      when 'cancelado' then 'Negociação cancelada.'
      else 'Negociação reaberta.'
    end;
  end if;

  if v_description is not null then
    select contact_id into v_contact from public.leads where id = new.lead_id;
    insert into public.activities (activity_type, description, lead_id, contact_id, property_id, metadata)
    values ('sistema', v_description, new.lead_id, v_contact, new.property_id,
            jsonb_build_object('deal_id', new.id, 'deal_status', new.status));
  end if;

  return null;
end;
$$;

drop trigger if exists deals_sync_effects on public.deals;
create trigger deals_sync_effects
after insert or update or delete on public.deals
for each row execute function public.sync_deal_effects();

-- -----------------------------------------------------------------------------
-- Propostas: proposta aceita define o valor da negociação; histórico no lead.
-- -----------------------------------------------------------------------------
create or replace function public.sync_proposal_effects()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_lead uuid;
  v_contact uuid;
  v_description text;
begin
  if new.status = 'aceita' and (tg_op = 'INSERT' or old.status <> 'aceita' or old.amount <> new.amount) then
    update public.deals set amount = new.amount where id = new.deal_id;
  end if;

  if tg_op = 'INSERT' then
    v_description := 'Proposta de ' || public.format_brl(new.amount) || ' registrada.';
  elsif new.status <> old.status and new.status in ('aceita', 'recusada') then
    v_description := 'Proposta de ' || public.format_brl(new.amount) || ' '
      || case new.status when 'aceita' then 'aceita' else 'recusada' end || '.';
  end if;

  if v_description is not null then
    select d.lead_id, l.contact_id into v_lead, v_contact
    from public.deals d join public.leads l on l.id = d.lead_id
    where d.id = new.deal_id;
    insert into public.activities (activity_type, description, lead_id, contact_id, metadata)
    values ('sistema', v_description, v_lead, v_contact,
            jsonb_build_object('deal_id', new.deal_id, 'proposal_id', new.id));
  end if;

  return null;
end;
$$;

drop trigger if exists proposals_sync_effects on public.proposals;
create trigger proposals_sync_effects
after insert or update of status, amount on public.proposals
for each row execute function public.sync_proposal_effects();

-- -----------------------------------------------------------------------------
-- Permissões: mesmas regras de edição dos leads
-- (gestores, responsável, autor ou qualquer membro quando não há responsável).
-- -----------------------------------------------------------------------------
create or replace function public.can_edit_deal(p_deal_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.deals d
    where d.id = p_deal_id
      and (
        public.is_manager()
        or (public.is_active_member()
            and (d.assigned_to is null or d.assigned_to = (select auth.uid()) or d.created_by = (select auth.uid())))
      )
  );
$$;

drop policy if exists deals_update on public.deals;
create policy deals_update on public.deals
  for update to authenticated
  using (
    (select public.is_manager())
    or ((select public.is_active_member())
        and (assigned_to is null or assigned_to = (select auth.uid()) or created_by = (select auth.uid())))
  )
  with check ((select public.is_active_member()));

drop policy if exists proposals_insert on public.proposals;
create policy proposals_insert on public.proposals
  for insert to authenticated
  with check ((select public.is_active_member()) and public.can_edit_deal(deal_id));

drop policy if exists proposals_update on public.proposals;
create policy proposals_update on public.proposals
  for update to authenticated
  using (
    (select public.is_manager())
    or ((select public.is_active_member()) and (created_by = (select auth.uid()) or public.can_edit_deal(deal_id)))
  )
  with check ((select public.is_active_member()));

-- -----------------------------------------------------------------------------
-- Visão consolidada de negociações para listagem e detalhes
-- -----------------------------------------------------------------------------
create or replace view public.deal_overview
with (security_invoker = true)
as
select
  d.id,
  d.lead_id,
  d.property_id,
  d.deal_type,
  d.status,
  d.amount,
  d.expected_close_date,
  d.closed_at,
  d.loss_reason,
  d.notes,
  d.assigned_to,
  d.created_by,
  d.created_at,
  d.updated_at,
  l.contact_id,
  c.full_name as contact_name,
  c.phone as contact_phone,
  pr.code as property_code,
  pr.title as property_title,
  pr.status as property_status,
  p.full_name as assignee_name,
  (select count(*) from public.proposals x where x.deal_id = d.id)::integer as proposal_count,
  lp.amount as last_proposal_amount,
  lp.status as last_proposal_status
from public.deals d
join public.leads l on l.id = d.lead_id
join public.contacts c on c.id = l.contact_id
left join public.properties pr on pr.id = d.property_id
left join public.profiles p on p.id = d.assigned_to
left join lateral (
  select x.amount, x.status from public.proposals x where x.deal_id = d.id order by x.created_at desc limit 1
) lp on true;

-- -----------------------------------------------------------------------------
-- Relatórios por período (p_from inclusivo, p_to exclusivo) e funil opcional.
-- Etapas percorridas e tempo em cada etapa vêm do histórico de atividades.
-- -----------------------------------------------------------------------------
create or replace function public.report_metrics(p_from timestamptz, p_to timestamptz, p_pipeline public.pipeline_type default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  period_leads as (
    select l.id, l.purpose, l.source, l.assigned_to, s.category
    from public.leads l
    join public.pipeline_stages s on s.id = l.stage_id
    where l.created_at >= p_from and l.created_at < p_to
      and (p_pipeline is null or l.purpose = p_pipeline)
  ),
  stage_entries as (
    select
      a.lead_id,
      coalesce(a.metadata ->> 'to_stage_id', a.metadata ->> 'stage_id')::uuid as stage_id,
      a.occurred_at
    from public.activities a
    where a.lead_id is not null
      and (
        (a.activity_type = 'mudanca_etapa' and a.metadata ? 'to_stage_id')
        or (a.activity_type = 'sistema' and a.metadata ? 'stage_id')
      )
  ),
  reached as (
    select pl.id, pl.purpose, coalesce(max(s.position), 0) as max_position
    from period_leads pl
    left join (
      select e.lead_id, e.stage_id from stage_entries e
      union all
      select l.id, l.stage_id from public.leads l
    ) e on e.lead_id = pl.id
    left join public.pipeline_stages s on s.id = e.stage_id and s.category <> 'perdido'
    group by pl.id, pl.purpose
  ),
  funnel_stages as (
    select s.*, min(s.position) over (partition by s.pipeline) as first_position
    from public.pipeline_stages s
    where s.is_active and s.category <> 'perdido'
      and (p_pipeline is null or s.pipeline = p_pipeline)
  ),
  funnel as (
    select
      fs.pipeline, fs.name, fs.position, fs.category,
      (select count(*) from reached r
       where r.purpose = fs.pipeline and (r.max_position >= fs.position or fs.position = fs.first_position))::integer as total
    from funnel_stages fs
  ),
  sources as (
    select
      pl.purpose as pipeline,
      pl.source,
      count(*)::integer as total,
      (count(*) filter (where pl.category = 'ganho'))::integer as won,
      (count(*) filter (where pl.category = 'perdido'))::integer as lost
    from period_leads pl
    group by pl.purpose, pl.source
  ),
  stage_durations as (
    select e.stage_id, extract(epoch from (e.next_at - e.occurred_at)) / 86400.0 as days
    from (
      select se.*, lead(se.occurred_at) over (partition by se.lead_id order by se.occurred_at) as next_at
      from stage_entries se
    ) e
    where e.next_at is not null and e.next_at >= p_from and e.next_at < p_to
  ),
  stage_times as (
    select s.pipeline, s.name, s.position, round(avg(d.days)::numeric, 1) as avg_days, count(*)::integer as samples
    from stage_durations d
    join public.pipeline_stages s on s.id = d.stage_id
    where s.category in ('aberto', 'negociacao')
      and (p_pipeline is null or s.pipeline = p_pipeline)
    group by s.id
  ),
  period_deals as (
    select d.*
    from public.deals d
    where p_pipeline is null or d.deal_type = p_pipeline
  ),
  closed_deals as (
    select * from period_deals d where d.closed_at >= p_from and d.closed_at < p_to
  ),
  brokers as (
    select * from (
      select
        p.id,
        p.full_name,
        p.is_active,
        (select count(*) from period_leads pl where pl.assigned_to = p.id)::integer as leads,
        (select count(*)
         from public.appointments ap
         left join public.leads l on l.id = ap.lead_id
         where coalesce(ap.assigned_to, ap.created_by) = p.id
           and ap.appointment_type = 'visita' and ap.status = 'realizado'
           and ap.starts_at >= p_from and ap.starts_at < p_to
           and (p_pipeline is null or l.purpose = p_pipeline))::integer as visits,
        (select count(*) from period_deals d where d.assigned_to = p.id and d.status = 'em_andamento')::integer as deals_open,
        (select count(*) from closed_deals d where d.assigned_to = p.id and d.status = 'ganho')::integer as deals_won,
        (select coalesce(sum(d.amount), 0) from closed_deals d where d.assigned_to = p.id and d.status = 'ganho') as won_amount
      from public.profiles p
    ) b
    where b.is_active or b.leads + b.visits + b.deals_open + b.deals_won > 0
  ),
  deal_summary as (
    select
      (select count(*) from period_deals where status = 'em_andamento')::integer as open_count,
      (select coalesce(sum(amount), 0) from period_deals where status = 'em_andamento') as open_amount,
      (select count(*) from closed_deals where status = 'ganho')::integer as won_count,
      (select coalesce(sum(amount), 0) from closed_deals where status = 'ganho') as won_amount,
      (select count(*) from closed_deals where status = 'perdido')::integer as lost_count,
      (select count(*) from closed_deals where status = 'cancelado')::integer as cancelled_count,
      (select round(avg(extract(epoch from (closed_at - created_at)) / 86400.0)::numeric, 1)
       from closed_deals where status = 'ganho') as avg_days_to_close
  ),
  monthly as (
    select
      to_char(date_trunc('month', d.closed_at at time zone 'America/Sao_Paulo'), 'YYYY-MM') as month,
      d.deal_type as pipeline,
      count(*)::integer as total,
      coalesce(sum(d.amount), 0) as amount
    from closed_deals d
    where d.status = 'ganho'
    group by 1, 2
  ),
  loss_reasons as (
    select coalesce(nullif(btrim(d.loss_reason), ''), 'Não informado') as reason, count(*)::integer as total
    from closed_deals d
    where d.status = 'perdido'
    group by 1
  )
  select jsonb_build_object(
    'funnel', (select coalesce(jsonb_agg(to_jsonb(f) order by f.pipeline, f.position), '[]'::jsonb) from funnel f),
    'sources', (select coalesce(jsonb_agg(to_jsonb(s) order by s.total desc), '[]'::jsonb) from sources s),
    'stage_times', (select coalesce(jsonb_agg(to_jsonb(t) order by t.pipeline, t.position), '[]'::jsonb) from stage_times t),
    'brokers', (select coalesce(jsonb_agg(to_jsonb(b) - 'is_active' order by b.won_amount desc, b.deals_won desc, b.leads desc, b.full_name), '[]'::jsonb) from brokers b),
    'deals', (select to_jsonb(ds) from deal_summary ds),
    'monthly', (select coalesce(jsonb_agg(to_jsonb(m) order by m.month, m.pipeline), '[]'::jsonb) from monthly m),
    'loss_reasons', (select coalesce(jsonb_agg(to_jsonb(r) order by r.total desc, r.reason), '[]'::jsonb) from loss_reasons r)
  );
$$;

revoke execute on function public.report_metrics(timestamptz, timestamptz, public.pipeline_type) from public, anon;
revoke execute on function public.can_edit_deal(uuid) from public, anon;
grant execute on function public.report_metrics(timestamptz, timestamptz, public.pipeline_type) to authenticated;
grant execute on function public.can_edit_deal(uuid) to authenticated;
