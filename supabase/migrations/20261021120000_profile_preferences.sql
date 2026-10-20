-- =============================================================================
-- Habita CRM · 010 · Preferências pessoais do usuário
-- Ex.: ações rápidas escolhidas para o painel. Cada usuário edita apenas as suas
-- (política profiles_update já existente). Seguro para executar mais de uma vez.
-- =============================================================================

alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_preferences_check'
  ) then
    alter table public.profiles
      add constraint profiles_preferences_check
      check (jsonb_typeof(preferences) = 'object' and pg_column_size(preferences) <= 8192);
  end if;
end;
$$;

comment on column public.profiles.preferences is 'Preferências de interface do próprio usuário (ex.: quick_actions).';
