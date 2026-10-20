-- =============================================================================
-- Habita CRM · 007 · Views e funções de apoio
-- Todas as views usam security_invoker: as políticas RLS das tabelas se aplicam.
-- =============================================================================

-- Visão consolidada de leads para listagem, busca e kanban.
create view public.lead_overview
with (security_invoker = true)
as
select
  l.id,
  l.contact_id,
  l.purpose,
  l.source,
  l.stage_id,
  l.assigned_to,
  l.min_budget,
  l.max_budget,
  l.desired_region,
  l.notes,
  l.next_follow_up_at,
  l.stage_changed_at,
  l.closed_at,
  l.created_by,
  l.created_at,
  l.updated_at,
  c.full_name as contact_name,
  c.phone as contact_phone,
  c.email as contact_email,
  s.name as stage_name,
  s.position as stage_position,
  s.category as stage_category,
  p.full_name as assignee_name,
  (select count(*) from public.lead_properties lp where lp.lead_id = l.id)::integer as property_count
from public.leads l
join public.contacts c on c.id = l.contact_id
join public.pipeline_stages s on s.id = l.stage_id
left join public.profiles p on p.id = l.assigned_to;

-- Indicadores do painel calculados a partir dos dados reais.
create or replace function public.dashboard_metrics()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'properties_total', (select count(*) from public.properties),
    'properties_available', (select count(*) from public.properties where status = 'disponivel'),
    'leads_active', (
      select count(*) from public.leads l
      join public.pipeline_stages s on s.id = l.stage_id
      where s.category in ('aberto', 'negociacao')
    ),
    'visits_scheduled', (
      select count(*) from public.appointments
      where appointment_type = 'visita' and status = 'agendado' and starts_at >= now()
    ),
    'negotiations_in_progress', (
      select count(*) from public.leads l
      join public.pipeline_stages s on s.id = l.stage_id
      where s.category = 'negociacao'
    ),
    'sales_closed', (
      select count(*) from public.leads l
      join public.pipeline_stages s on s.id = l.stage_id
      where l.purpose = 'venda' and s.category = 'ganho'
    ),
    'rentals_closed', (
      select count(*) from public.leads l
      join public.pipeline_stages s on s.id = l.stage_id
      where l.purpose = 'locacao' and s.category = 'ganho'
    ),
    'leads_by_stage', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.pipeline, t.position), '[]'::jsonb)
      from (
        select s.pipeline, s.name, s.position, s.category, count(l.id)::integer as total
        from public.pipeline_stages s
        left join public.leads l on l.stage_id = s.id
        where s.is_active
        group by s.id
      ) t
    )
  );
$$;

-- Substitui os proprietários de um imóvel em uma única transação.
create or replace function public.set_property_owners(p_property_id uuid, p_contact_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_active_member() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;

  p_contact_ids := coalesce(p_contact_ids, array[]::uuid[]);

  insert into public.owners (contact_id)
  select distinct unnest(p_contact_ids)
  on conflict (contact_id) do nothing;

  delete from public.property_owners po
  using public.owners o
  where po.owner_id = o.id
    and po.property_id = p_property_id
    and not (o.contact_id = any (p_contact_ids));

  insert into public.property_owners (property_id, owner_id)
  select p_property_id, o.id
  from public.owners o
  where o.contact_id = any (p_contact_ids)
  on conflict do nothing;
end;
$$;

-- Substitui os imóveis de interesse de um lead em uma única transação.
create or replace function public.set_lead_properties(p_lead_id uuid, p_property_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_active_member() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;

  p_property_ids := coalesce(p_property_ids, array[]::uuid[]);

  delete from public.lead_properties
  where lead_id = p_lead_id and not (property_id = any (p_property_ids));

  insert into public.lead_properties (lead_id, property_id)
  select p_lead_id, unnest(p_property_ids)
  on conflict do nothing;
end;
$$;

-- Reordena as etapas de um funil (somente administradores).
create or replace function public.reorder_pipeline_stages(p_pipeline public.pipeline_type, p_stage_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem reorganizar os funis.' using errcode = '42501';
  end if;

  if (select count(*) from public.pipeline_stages where pipeline = p_pipeline)
     <> coalesce(array_length(p_stage_ids, 1), 0) then
    raise exception 'A lista de etapas está incompleta.' using errcode = '22023';
  end if;

  set constraints public.pipeline_stages_position_key deferred;

  update public.pipeline_stages s
  set position = o.ordinality
  from unnest(p_stage_ids) with ordinality as o (id, ordinality)
  where s.id = o.id and s.pipeline = p_pipeline;
end;
$$;

revoke execute on function public.dashboard_metrics() from public, anon;
revoke execute on function public.set_property_owners(uuid, uuid[]) from public, anon;
revoke execute on function public.set_lead_properties(uuid, uuid[]) from public, anon;
revoke execute on function public.reorder_pipeline_stages(public.pipeline_type, uuid[]) from public, anon;
grant execute on function public.dashboard_metrics() to authenticated;
grant execute on function public.set_property_owners(uuid, uuid[]) to authenticated;
grant execute on function public.set_lead_properties(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_pipeline_stages(public.pipeline_type, uuid[]) to authenticated;
