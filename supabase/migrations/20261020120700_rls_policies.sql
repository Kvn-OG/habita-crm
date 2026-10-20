-- =============================================================================
-- Habita CRM · 008 · Row Level Security
--
-- Modelo de acesso (equipe interna de uma única imobiliária):
--   * anon: nenhum acesso.
--   * Perfil inativo: vê apenas o próprio perfil (tela de "acesso pendente").
--   * Corretor ativo: lê todos os dados comerciais; cria registros; edita imóveis
--     e contatos; edita apenas leads/compromissos/tarefas sob sua responsabilidade,
--     criados por ele ou sem responsável; não exclui registros principais.
--   * Gestor ativo: tudo do corretor + edição e exclusão de qualquer registro.
--   * Administrador ativo: tudo do gestor + gestão de equipe e dos funis.
-- =============================================================================

-- Defesa em profundidade: o papel anon não acessa nenhuma tabela da aplicação.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;

alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.owners enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.property_owners enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.leads enable row level security;
alter table public.lead_properties enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.appointments enable row level security;
alter table public.deals enable row level security;
alter table public.proposals enable row level security;

-- -----------------------------------------------------------------------------
-- profiles (inserção apenas via trigger; exclusão via Supabase Auth)
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_active_member()));

-- Campos sensíveis (papel/status) são protegidos pelo trigger guard_profile_update.
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Cadastros compartilhados: contatos, proprietários e imóveis
-- -----------------------------------------------------------------------------
create policy contacts_select on public.contacts
  for select to authenticated using ((select public.is_active_member()));
create policy contacts_insert on public.contacts
  for insert to authenticated with check ((select public.is_active_member()));
create policy contacts_update on public.contacts
  for update to authenticated
  using ((select public.is_active_member())) with check ((select public.is_active_member()));
create policy contacts_delete on public.contacts
  for delete to authenticated using ((select public.is_manager()));

create policy owners_select on public.owners
  for select to authenticated using ((select public.is_active_member()));
create policy owners_insert on public.owners
  for insert to authenticated with check ((select public.is_active_member()));
create policy owners_update on public.owners
  for update to authenticated
  using ((select public.is_active_member())) with check ((select public.is_active_member()));
create policy owners_delete on public.owners
  for delete to authenticated using ((select public.is_manager()));

create policy properties_select on public.properties
  for select to authenticated using ((select public.is_active_member()));
create policy properties_insert on public.properties
  for insert to authenticated with check ((select public.is_active_member()));
create policy properties_update on public.properties
  for update to authenticated
  using ((select public.is_active_member())) with check ((select public.is_active_member()));
create policy properties_delete on public.properties
  for delete to authenticated using ((select public.is_manager()));

create policy property_images_select on public.property_images
  for select to authenticated using ((select public.is_active_member()));
create policy property_images_insert on public.property_images
  for insert to authenticated with check ((select public.is_active_member()));
create policy property_images_update on public.property_images
  for update to authenticated
  using ((select public.is_active_member())) with check ((select public.is_active_member()));
create policy property_images_delete on public.property_images
  for delete to authenticated
  using ((select public.is_manager()) or created_by = (select auth.uid()));

-- Tabelas de vínculo: membros ativos podem criar e remover vínculos.
create policy property_owners_select on public.property_owners
  for select to authenticated using ((select public.is_active_member()));
create policy property_owners_insert on public.property_owners
  for insert to authenticated with check ((select public.is_active_member()));
create policy property_owners_update on public.property_owners
  for update to authenticated
  using ((select public.is_active_member())) with check ((select public.is_active_member()));
create policy property_owners_delete on public.property_owners
  for delete to authenticated using ((select public.is_active_member()));

-- -----------------------------------------------------------------------------
-- Funis (configuração: somente administradores alteram)
-- -----------------------------------------------------------------------------
create policy pipeline_stages_select on public.pipeline_stages
  for select to authenticated using ((select public.is_active_member()));
create policy pipeline_stages_insert on public.pipeline_stages
  for insert to authenticated with check ((select public.is_admin()));
create policy pipeline_stages_update on public.pipeline_stages
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy pipeline_stages_delete on public.pipeline_stages
  for delete to authenticated using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Leads (edição restrita ao responsável, ao criador, a leads sem responsável ou gestores)
-- -----------------------------------------------------------------------------
create policy leads_select on public.leads
  for select to authenticated using ((select public.is_active_member()));
create policy leads_insert on public.leads
  for insert to authenticated with check ((select public.is_active_member()));
create policy leads_update on public.leads
  for update to authenticated
  using (
    (select public.is_manager())
    or (
      (select public.is_active_member())
      and (assigned_to is null or assigned_to = (select auth.uid()) or created_by = (select auth.uid()))
    )
  )
  with check ((select public.is_active_member()));
create policy leads_delete on public.leads
  for delete to authenticated using ((select public.is_manager()));

create policy lead_properties_select on public.lead_properties
  for select to authenticated using ((select public.is_active_member()));
create policy lead_properties_insert on public.lead_properties
  for insert to authenticated with check ((select public.is_active_member()));
create policy lead_properties_delete on public.lead_properties
  for delete to authenticated using ((select public.is_active_member()));

-- -----------------------------------------------------------------------------
-- Atividades (cada autor edita/exclui as próprias; gestores, todas)
-- -----------------------------------------------------------------------------
create policy activities_select on public.activities
  for select to authenticated using ((select public.is_active_member()));
create policy activities_insert on public.activities
  for insert to authenticated with check ((select public.is_active_member()));
create policy activities_update on public.activities
  for update to authenticated
  using ((select public.is_manager()) or ((select public.is_active_member()) and created_by = (select auth.uid())))
  with check ((select public.is_active_member()));
create policy activities_delete on public.activities
  for delete to authenticated
  using ((select public.is_manager()) or ((select public.is_active_member()) and created_by = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Tarefas e compromissos
-- -----------------------------------------------------------------------------
create policy tasks_select on public.tasks
  for select to authenticated using ((select public.is_active_member()));
create policy tasks_insert on public.tasks
  for insert to authenticated with check ((select public.is_active_member()));
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    (select public.is_manager())
    or ((select public.is_active_member())
        and (assigned_to is null or assigned_to = (select auth.uid()) or created_by = (select auth.uid())))
  )
  with check ((select public.is_active_member()));
create policy tasks_delete on public.tasks
  for delete to authenticated
  using ((select public.is_manager()) or ((select public.is_active_member()) and created_by = (select auth.uid())));

create policy appointments_select on public.appointments
  for select to authenticated using ((select public.is_active_member()));
create policy appointments_insert on public.appointments
  for insert to authenticated with check ((select public.is_active_member()));
create policy appointments_update on public.appointments
  for update to authenticated
  using (
    (select public.is_manager())
    or ((select public.is_active_member())
        and (assigned_to is null or assigned_to = (select auth.uid()) or created_by = (select auth.uid())))
  )
  with check ((select public.is_active_member()));
create policy appointments_delete on public.appointments
  for delete to authenticated
  using ((select public.is_manager()) or ((select public.is_active_member()) and created_by = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Negociações e propostas
-- -----------------------------------------------------------------------------
create policy deals_select on public.deals
  for select to authenticated using ((select public.is_active_member()));
create policy deals_insert on public.deals
  for insert to authenticated with check ((select public.is_active_member()));
create policy deals_update on public.deals
  for update to authenticated
  using (
    (select public.is_manager())
    or ((select public.is_active_member())
        and (assigned_to = (select auth.uid()) or created_by = (select auth.uid())))
  )
  with check ((select public.is_active_member()));
create policy deals_delete on public.deals
  for delete to authenticated using ((select public.is_manager()));

create policy proposals_select on public.proposals
  for select to authenticated using ((select public.is_active_member()));
create policy proposals_insert on public.proposals
  for insert to authenticated with check ((select public.is_active_member()));
create policy proposals_update on public.proposals
  for update to authenticated
  using ((select public.is_manager()) or ((select public.is_active_member()) and created_by = (select auth.uid())))
  with check ((select public.is_active_member()));
create policy proposals_delete on public.proposals
  for delete to authenticated using ((select public.is_manager()));
