-- =============================================================================
-- Habita CRM · 005 · Atividades, tarefas e compromissos
-- =============================================================================

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  activity_type public.activity_type not null,
  description text not null check (char_length(btrim(description)) between 1 and 5000),
  lead_id uuid references public.leads (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_has_subject check (lead_id is not null or contact_id is not null or property_id is not null)
);

comment on table public.activities is 'Histórico comercial (notas, ligações, mudanças de etapa, visitas).';

create index activities_lead_idx on public.activities (lead_id, occurred_at desc);
create index activities_contact_idx on public.activities (contact_id, occurred_at desc);
create index activities_property_idx on public.activities (property_id);
create index activities_occurred_at_idx on public.activities (occurred_at desc);

create trigger activities_set_created_by
before insert or update on public.activities
for each row execute function public.set_created_by();

create trigger activities_set_updated_at
before update on public.activities
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tarefas
-- -----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 200),
  description text check (description is null or char_length(description) <= 5000),
  due_at timestamptz,
  completed_at timestamptz,
  assigned_to uuid references public.profiles (id) on delete set null,
  lead_id uuid references public.leads (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_open_due_idx on public.tasks (due_at) where completed_at is null;
create index tasks_assigned_idx on public.tasks (assigned_to);
create index tasks_lead_idx on public.tasks (lead_id);

create trigger tasks_set_created_by
before insert or update on public.tasks
for each row execute function public.set_created_by();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Compromissos (visitas e reuniões)
-- -----------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_type public.appointment_type not null default 'visita',
  status public.appointment_status not null default 'agendado',
  title text not null check (char_length(btrim(title)) between 2 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text check (location is null or char_length(location) <= 300),
  notes text check (notes is null or char_length(notes) <= 5000),
  lead_id uuid references public.leads (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_range check (ends_at is null or ends_at > starts_at)
);

create index appointments_starts_at_idx on public.appointments (starts_at);
create index appointments_upcoming_idx on public.appointments (starts_at) where status = 'agendado';
create index appointments_lead_idx on public.appointments (lead_id);
create index appointments_property_idx on public.appointments (property_id);
create index appointments_assigned_idx on public.appointments (assigned_to);

create trigger appointments_set_created_by
before insert or update on public.appointments
for each row execute function public.set_created_by();

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Registro automático de histórico
-- Executa com as permissões do usuário (SECURITY INVOKER): respeita RLS.
-- -----------------------------------------------------------------------------
create or replace function public.log_lead_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old_stage text;
  v_new_stage text;
begin
  select name into v_new_stage from public.pipeline_stages where id = new.stage_id;

  if tg_op = 'INSERT' then
    insert into public.activities (activity_type, description, lead_id, contact_id, metadata)
    values ('sistema', 'Lead criado na etapa "' || v_new_stage || '".', new.id, new.contact_id,
            jsonb_build_object('stage_id', new.stage_id));
  elsif new.stage_id <> old.stage_id then
    select name into v_old_stage from public.pipeline_stages where id = old.stage_id;
    insert into public.activities (activity_type, description, lead_id, contact_id, metadata)
    values ('mudanca_etapa', 'Etapa alterada de "' || v_old_stage || '" para "' || v_new_stage || '".',
            new.id, new.contact_id,
            jsonb_build_object('from_stage_id', old.stage_id, 'to_stage_id', new.stage_id));
  end if;

  return null;
end;
$$;

create trigger leads_log_activity
after insert or update of stage_id on public.leads
for each row execute function public.log_lead_activity();

create or replace function public.log_appointment_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lead_id is null and new.contact_id is null and new.property_id is null then
    return null;
  end if;

  insert into public.activities (activity_type, description, lead_id, contact_id, property_id, metadata)
  values (
    case new.appointment_type when 'visita' then 'visita'::public.activity_type else 'reuniao'::public.activity_type end,
    case new.appointment_type when 'visita' then 'Visita agendada' else 'Compromisso agendado' end
      || ' para ' || to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI') || ': ' || new.title,
    new.lead_id, new.contact_id, new.property_id,
    jsonb_build_object('appointment_id', new.id)
  );

  return null;
end;
$$;

create trigger appointments_log_activity
after insert on public.appointments
for each row execute function public.log_appointment_activity();
