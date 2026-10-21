-- =============================================================================
-- Habita CRM · 013 · Carteira própria do corretor e código automático do imóvel
-- - Corretores passam a ver apenas os próprios leads, contatos, negociações,
--   propostas, compromissos, tarefas e histórico (sob sua responsabilidade ou
--   criados por eles). Imóveis e fotos continuam visíveis para toda a equipe.
-- - Administradores e gestores continuam vendo e editando tudo.
-- - O código do imóvel é gerado pelo banco (IM-0001, IM-0002…) e não pode ser alterado.
-- Seguro para executar mais de uma vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funções de acesso (SECURITY DEFINER evita recursão entre as políticas)
-- -----------------------------------------------------------------------------

-- Lead sob responsabilidade do usuário atual (ou criado por ele); gestores acessam todos.
create or replace function public.can_access_lead(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_manager()
    or (
      public.is_active_member()
      and exists (
        select 1 from public.leads l
        where l.id = p_lead_id
          and (l.assigned_to = (select auth.uid()) or l.created_by = (select auth.uid()))
      )
    );
$$;

-- Contato criado pelo usuário ou ligado a um lead/negociação dele; gestores acessam todos.
create or replace function public.can_access_contact(p_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_manager()
    or (
      public.is_active_member()
      and (
        exists (select 1 from public.contacts c where c.id = p_contact_id and c.created_by = (select auth.uid()))
        or exists (
          select 1 from public.leads l
          where l.contact_id = p_contact_id
            and (l.assigned_to = (select auth.uid()) or l.created_by = (select auth.uid()))
        )
        or exists (
          select 1 from public.deals d
          join public.leads l on l.id = d.lead_id
          where l.contact_id = p_contact_id
            and (d.assigned_to = (select auth.uid()) or d.created_by = (select auth.uid()))
        )
      )
    );
$$;

create or replace function public.can_access_owner(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.owners o
    where o.id = p_owner_id and public.can_access_contact(o.contact_id)
  );
$$;

-- Negociação sob responsabilidade do usuário, criada por ele ou de um lead dele.
create or replace function public.can_access_deal(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_manager()
    or (
      public.is_active_member()
      and exists (
        select 1 from public.deals d
        where d.id = p_deal_id
          and (
            d.assigned_to = (select auth.uid())
            or d.created_by = (select auth.uid())
            or public.can_access_lead(d.lead_id)
          )
      )
    );
$$;

revoke execute on function public.can_access_lead(uuid) from public, anon;
revoke execute on function public.can_access_contact(uuid) from public, anon;
revoke execute on function public.can_access_owner(uuid) from public, anon;
revoke execute on function public.can_access_deal(uuid) from public, anon;
grant execute on function public.can_access_lead(uuid) to authenticated;
grant execute on function public.can_access_contact(uuid) to authenticated;
grant execute on function public.can_access_owner(uuid) to authenticated;
grant execute on function public.can_access_deal(uuid) to authenticated;

-- Edição de negociação: gestores, responsável ou autor (sem exceção para "sem responsável").
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
            and (d.assigned_to = (select auth.uid()) or d.created_by = (select auth.uid())))
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- Contatos e proprietários
-- -----------------------------------------------------------------------------
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
  for select to authenticated
  using (
    (select public.is_manager())
    -- Verificação direta: o contato recém-criado ainda não é visível dentro da função.
    or ((select public.is_active_member()) and created_by = (select auth.uid()))
    or public.can_access_contact(id)
  );

drop policy if exists contacts_update on public.contacts;
create policy contacts_update on public.contacts
  for update to authenticated
  using (
    (select public.is_manager())
    -- Verificação direta: o contato recém-criado ainda não é visível dentro da função.
    or ((select public.is_active_member()) and created_by = (select auth.uid()))
    or public.can_access_contact(id)
  )
  with check ((select public.is_active_member()));

drop policy if exists owners_select on public.owners;
create policy owners_select on public.owners
  for select to authenticated
  using ((select public.is_manager()) or public.can_access_contact(contact_id));

drop policy if exists owners_update on public.owners;
create policy owners_update on public.owners
  for update to authenticated
  using ((select public.is_manager()) or public.can_access_contact(contact_id))
  with check ((select public.is_active_member()));

-- Vínculos imóvel ↔ proprietário: cada corretor só vê e altera os dos contatos dele,
-- então editar um imóvel não remove proprietários cadastrados por outros.
drop policy if exists property_owners_select on public.property_owners;
create policy property_owners_select on public.property_owners
  for select to authenticated
  using ((select public.is_manager()) or public.can_access_owner(owner_id));

drop policy if exists property_owners_insert on public.property_owners;
create policy property_owners_insert on public.property_owners
  for insert to authenticated
  with check ((select public.is_active_member()) and public.can_access_owner(owner_id));

drop policy if exists property_owners_update on public.property_owners;
create policy property_owners_update on public.property_owners
  for update to authenticated
  using ((select public.is_manager()) or public.can_access_owner(owner_id))
  with check ((select public.is_active_member()));

drop policy if exists property_owners_delete on public.property_owners;
create policy property_owners_delete on public.property_owners
  for delete to authenticated
  using ((select public.is_manager()) or public.can_access_owner(owner_id));

-- -----------------------------------------------------------------------------
-- Leads e imóveis de interesse
-- -----------------------------------------------------------------------------
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select to authenticated
  using (
    (select public.is_manager())
    or ((select public.is_active_member())
        and (assigned_to = (select auth.uid()) or created_by = (select auth.uid())))
  );

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads
  for update to authenticated
  using (
    (select public.is_manager())
    or ((select public.is_active_member())
        and (assigned_to = (select auth.uid()) or created_by = (select auth.uid())))
  )
  with check ((select public.is_active_member()));

drop policy if exists lead_properties_select on public.lead_properties;
create policy lead_properties_select on public.lead_properties
  for select to authenticated using (public.can_access_lead(lead_id));

drop policy if exists lead_properties_insert on public.lead_properties;
create policy lead_properties_insert on public.lead_properties
  for insert to authenticated with check (public.can_access_lead(lead_id));

drop policy if exists lead_properties_delete on public.lead_properties;
create policy lead_properties_delete on public.lead_properties
  for delete to authenticated using (public.can_access_lead(lead_id));

-- -----------------------------------------------------------------------------
-- Histórico de atividades: do próprio autor ou do lead/contato do corretor
-- -----------------------------------------------------------------------------
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities
  for select to authenticated
  using (
    (select public.is_manager())
    or (
      (select public.is_active_member())
      and (
        created_by = (select auth.uid())
        or (lead_id is not null and public.can_access_lead(lead_id))
        or (lead_id is null and contact_id is not null and public.can_access_contact(contact_id))
      )
    )
  );

-- -----------------------------------------------------------------------------
-- Tarefas e compromissos
-- -----------------------------------------------------------------------------
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    (select public.is_manager())
    or ((select public.is_active_member())
        and (assigned_to = (select auth.uid()) or created_by = (select auth.uid())))
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    (select public.is_manager())
    or ((select public.is_active_member())
        and (assigned_to = (select auth.uid()) or created_by = (select auth.uid())))
  )
  with check ((select public.is_active_member()));

drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments
  for select to authenticated
  using (
    (select public.is_manager())
    or ((select public.is_active_member())
        and (assigned_to = (select auth.uid()) or created_by = (select auth.uid())))
  );

drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments
  for update to authenticated
  using (
    (select public.is_manager())
    or ((select public.is_active_member())
        and (assigned_to = (select auth.uid()) or created_by = (select auth.uid())))
  )
  with check ((select public.is_active_member()));

-- -----------------------------------------------------------------------------
-- Negociações e propostas
-- -----------------------------------------------------------------------------
drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals
  for select to authenticated
  using (
    (select public.is_manager())
    or ((select public.is_active_member())
        and (assigned_to = (select auth.uid()) or created_by = (select auth.uid()) or public.can_access_lead(lead_id)))
  );

drop policy if exists deals_insert on public.deals;
create policy deals_insert on public.deals
  for insert to authenticated
  with check ((select public.is_active_member()) and public.can_access_lead(lead_id));

drop policy if exists deals_update on public.deals;
create policy deals_update on public.deals
  for update to authenticated
  using (
    (select public.is_manager())
    or ((select public.is_active_member())
        and (assigned_to = (select auth.uid()) or created_by = (select auth.uid())))
  )
  with check ((select public.is_active_member()));

drop policy if exists proposals_select on public.proposals;
create policy proposals_select on public.proposals
  for select to authenticated using (public.can_access_deal(deal_id));

-- -----------------------------------------------------------------------------
-- Relatórios: somente administradores e gestores
-- -----------------------------------------------------------------------------
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.report_metrics(timestamptz, timestamptz, public.pipeline_type)'::regprocedure)
    into v_def;
  if v_def not like '%Apenas administradores e gestores%' then
    alter function public.report_metrics(timestamptz, timestamptz, public.pipeline_type) rename to report_metrics_data;
    revoke execute on function public.report_metrics_data(timestamptz, timestamptz, public.pipeline_type) from public, anon, authenticated;
  end if;
end;
$$;

create or replace function public.report_metrics(p_from timestamptz, p_to timestamptz, p_pipeline public.pipeline_type default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_manager() then
    raise exception 'Apenas administradores e gestores podem ver os relatórios.' using errcode = '42501';
  end if;
  return public.report_metrics_data(p_from, p_to, p_pipeline);
end;
$$;

revoke execute on function public.report_metrics(timestamptz, timestamptz, public.pipeline_type) from public, anon;
grant execute on function public.report_metrics(timestamptz, timestamptz, public.pipeline_type) to authenticated;

-- -----------------------------------------------------------------------------
-- Código do imóvel: gerado automaticamente e imutável
-- -----------------------------------------------------------------------------
create or replace function public.next_property_code()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'IM-' || lpad(
    (coalesce(max(substring(code from '^IM-(\d+)$')::integer), 0) + 1)::text,
    4, '0')
  from public.properties
  where code ~ '^IM-\d+$';
$$;

revoke execute on function public.next_property_code() from public, anon, authenticated;

create or replace function public.assign_property_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Fila única para cadastros simultâneos não gerarem o mesmo código.
    perform pg_advisory_xact_lock(hashtext('public.properties.code'));
    new.code := public.next_property_code();
  elsif new.code is distinct from old.code and (select auth.uid()) is not null then
    raise exception 'O código do imóvel é gerado automaticamente e não pode ser alterado.' using errcode = '42501';
  end if;
  return new;
end;
$$;

alter table public.properties alter column code set default '';

drop trigger if exists properties_assign_code on public.properties;
-- O nome começa com "a" para rodar antes de properties_normalize (ordem alfabética).
create trigger properties_assign_code
before insert or update of code on public.properties
for each row execute function public.assign_property_code();
