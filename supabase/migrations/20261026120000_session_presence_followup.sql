-- =============================================================================
-- Habita CRM · 015 · Sessão em uso, aproveitamento de leads e follow-up
-- - O aviso de "conta aberta em outro dispositivo" considera apenas sessões em
--   uso: cada aba aberta do CRM dá sinal a cada minuto (session_heartbeats).
--   Sessões abandonadas (navegador fechado, computador desligado) não contam.
-- - Relatórios: leads ganhos, perdidos e em andamento por corretor.
-- - Diagnóstico de follow-up por corretor (followup_diagnostics).
-- Seguro para executar mais de uma vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Sinal de sessão em uso
-- -----------------------------------------------------------------------------
create table if not exists public.session_heartbeats (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

comment on table public.session_heartbeats is 'Último sinal de cada sessão aberta no CRM. Acessada apenas pelas funções de sessão.';

create index if not exists session_heartbeats_user_idx on public.session_heartbeats (user_id, last_seen_at desc);

-- Sem políticas: ninguém lê ou grava diretamente, só as funções abaixo.
alter table public.session_heartbeats enable row level security;
revoke all on public.session_heartbeats from anon, authenticated;

-- Chamada a cada minuto pelo CRM aberto: registra o sinal desta sessão e
-- devolve false quando ela foi encerrada (ex.: login em outro dispositivo).
create or replace function public.current_session_active()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_id uuid := nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_id is null then
    return true;
  end if;
  if not exists (select 1 from auth.sessions s where s.id = current_id and s.user_id = current_user_id) then
    delete from public.session_heartbeats where session_id = current_id;
    return false;
  end if;

  insert into public.session_heartbeats (session_id, user_id, last_seen_at)
  values (current_id, current_user_id, now())
  on conflict (session_id) do update set last_seen_at = excluded.last_seen_at;

  -- Limpeza de sinais antigos da própria conta.
  delete from public.session_heartbeats h
  where h.user_id = current_user_id and h.last_seen_at < now() - interval '1 day';

  return true;
end;
$$;

-- Outras sessões da conta EM USO agora: válidas e com sinal nos últimos 3 minutos.
create or replace function public.other_active_sessions()
returns table (id uuid, created_at timestamptz, last_active_at timestamptz, user_agent text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
    select s.id, s.created_at, h.last_seen_at as last_active_at, s.user_agent
    from auth.sessions s
    join public.session_heartbeats h on h.session_id = s.id
    where s.user_id = (select auth.uid())
      and s.id is distinct from nullif((select auth.jwt()) ->> 'session_id', '')::uuid
      and (s.not_after is null or s.not_after > now())
      and h.last_seen_at > now() - interval '3 minutes'
    order by 3 desc;
end;
$$;

revoke all on function public.current_session_active() from public, anon;
revoke all on function public.other_active_sessions() from public, anon;
grant execute on function public.current_session_active() to authenticated;
grant execute on function public.other_active_sessions() to authenticated;

-- -----------------------------------------------------------------------------
-- Relatórios: aproveitamento de leads por corretor (leads_won, leads_lost, leads_open)
-- Mesmo cálculo da versão anterior, chamado pelo report_metrics (só administradores).
-- -----------------------------------------------------------------------------
create or replace function public.report_metrics_data(p_from timestamptz, p_to timestamptz, p_pipeline public.pipeline_type default null)
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
        (select count(*) from period_leads pl where pl.assigned_to = p.id and pl.category = 'ganho')::integer as leads_won,
        (select count(*) from period_leads pl where pl.assigned_to = p.id and pl.category = 'perdido')::integer as leads_lost,
        (select count(*) from period_leads pl where pl.assigned_to = p.id and pl.category in ('aberto', 'negociacao'))::integer as leads_open,
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

revoke execute on function public.report_metrics_data(timestamptz, timestamptz, public.pipeline_type) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Diagnóstico de follow-up por corretor (situação atual dos leads em andamento)
-- "Contato" = anotação, ligação, WhatsApp, e-mail, visita ou reunião registrada.
-- -----------------------------------------------------------------------------
create or replace function public.followup_diagnostics(p_stale_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem ver os relatórios.' using errcode = '42501';
  end if;

  with
  active_leads as (
    select
      l.id, l.assigned_to, l.purpose, l.next_follow_up_at,
      c.full_name as contact_name,
      s.name as stage_name,
      coalesce(
        (select max(a.occurred_at) from public.activities a
         where a.lead_id = l.id and a.activity_type in ('nota', 'ligacao', 'whatsapp', 'email', 'visita', 'reuniao')),
        l.created_at
      ) as last_touch_at
    from public.leads l
    join public.pipeline_stages s on s.id = l.stage_id
    join public.contacts c on c.id = l.contact_id
    where s.category in ('aberto', 'negociacao')
  ),
  bounds as (
    select (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day') at time zone 'America/Sao_Paulo' as tomorrow
  ),
  classified as (
    select
      al.*,
      al.next_follow_up_at is null as no_followup,
      al.next_follow_up_at < now() as overdue,
      al.next_follow_up_at >= now() and al.next_follow_up_at < (select tomorrow from bounds) as due_today,
      al.last_touch_at < now() - make_interval(days => p_stale_days) as stale,
      extract(epoch from (now() - al.last_touch_at)) / 86400.0 as days_since_touch
    from active_leads al
  ),
  brokers as (
    select p.id from public.profiles p where p.is_active and p.role = 'corretor'
    union
    select distinct x.assigned_to from classified x
  ),
  per_broker as (
    select
      b.id,
      p.full_name,
      count(x.id)::integer as active,
      (count(x.id) filter (where x.overdue))::integer as overdue,
      (count(x.id) filter (where x.no_followup))::integer as no_followup,
      (count(x.id) filter (where x.due_today))::integer as due_today,
      (count(x.id) filter (where x.stale))::integer as stale,
      round(avg(x.days_since_touch)::numeric, 1) as avg_days_since_touch,
      (
        select coalesce(jsonb_agg(to_jsonb(w) order by w.last_touch_at), '[]'::jsonb)
        from (
          select y.id, y.contact_name, y.stage_name, y.purpose, y.last_touch_at, y.next_follow_up_at
          from classified y
          where y.assigned_to is not distinct from b.id and (y.overdue or y.no_followup or y.stale)
          order by y.last_touch_at
          limit 5
        ) w
      ) as attention
    from brokers b
    left join public.profiles p on p.id = b.id
    left join classified x on x.assigned_to is not distinct from b.id
    group by b.id, p.full_name
  )
  select coalesce(
    jsonb_agg(to_jsonb(pb) order by (pb.id is null), (pb.overdue + pb.no_followup) desc, pb.active desc, pb.full_name),
    '[]'::jsonb
  )
  into v_result
  from per_broker pb
  -- "Sem responsável" só aparece quando há leads sem corretor.
  where pb.id is not null or pb.active > 0;

  return jsonb_build_object('stale_days', p_stale_days, 'brokers', v_result);
end;
$$;

revoke execute on function public.followup_diagnostics(integer) from public, anon;
grant execute on function public.followup_diagnostics(integer) to authenticated;
