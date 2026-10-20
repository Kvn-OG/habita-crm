// Testes das migrations e das políticas RLS com PGlite (Postgres em WASM) e stubs mínimos do Supabase.
// Uso: npm run test:db (não requer Docker nem credenciais).
// Os stubs de auth/storage reproduzem apenas o necessário: valide também em um projeto Supabase real.
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const migrationsDir = process.argv[2] ?? fileURLToPath(new URL('../migrations', import.meta.url))
const db = new PGlite({ extensions: { pg_trgm } })

const stub = `
create schema extensions;
create schema auth;
create schema storage;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text default auth.uid()::text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema public, auth, storage, extensions to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant all on storage.objects to authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`
await db.exec(stub)

for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'))
    console.log('✔ migration', file)
  } catch (error) {
    console.error('✘ migration', file, error.message)
    process.exit(1)
  }
}

let failures = 0
const ok = (cond, label) => { if (cond) console.log('  ✔', label); else { failures++; console.error('  ✘', label) } }

async function as(userId, role, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`)
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ''])
    return tx.query(sql, params)
  })
}
async function expectError(label, fn, pattern) {
  try { await fn(); ok(false, `${label} (esperava erro)`) }
  catch (e) { ok(!pattern || pattern.test(e.message), `${label} → ${e.message}`) }
}

// Usuários
const users = {}
for (const [key, email] of [['admin', 'admin@exemplo.com'], ['gestor', 'gestor@exemplo.com'], ['corretor', 'corretor@exemplo.com'], ['corretor2', 'c2@exemplo.com'], ['inativo', 'novo@exemplo.com']]) {
  const r = await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('full_name', $2::text)) returning id`, [email, key])
  users[key] = r.rows[0].id
}
console.log('\nPerfis criados pelo trigger')
const profiles = await db.query(`select role, is_active from public.profiles`)
ok(profiles.rows.length === 5 && profiles.rows.every((p) => p.role === 'corretor' && !p.is_active), 'todos nascem corretor e inativos')

// Bootstrap do primeiro admin (SQL Editor: auth.uid() nulo)
await db.query(`update public.profiles set role = 'admin', is_active = true where email = 'admin@exemplo.com'`)
ok(true, 'bootstrap do admin via SQL administrativo')

console.log('\nGestão de perfis')
await as(users.admin, 'authenticated', `update public.profiles set role = 'gestor', is_active = true where id = $1`, [users.gestor])
await as(users.admin, 'authenticated', `update public.profiles set is_active = true where id = any($1::uuid[])`, [[users.corretor, users.corretor2]])
const active = await db.query(`select count(*)::int as n from public.profiles where is_active`)
ok(active.rows[0].n === 4, 'admin ativa gestor e corretores')
await expectError('corretor não promove a si mesmo', () => as(users.corretor, 'authenticated', `update public.profiles set role = 'admin' where id = $1`, [users.corretor]), /administradores/)
const gestorRole = await as(users.gestor, 'authenticated', `update public.profiles set role = 'admin' where id = $1 returning id`, [users.corretor]); ok(gestorRole.rows.length === 0, 'gestor não altera papéis (RLS: 0 linhas)')
await expectError('admin não rebaixa a si mesmo', () => as(users.admin, 'authenticated', `update public.profiles set role = 'corretor' where id = $1`, [users.admin]), /próprio/)
const selfUpdate = await as(users.corretor, 'authenticated', `update public.profiles set full_name = 'Corretor Um' where id = $1 returning id`, [users.corretor])
ok(selfUpdate.rows.length === 1, 'usuário edita o próprio nome')
const otherUpdate = await as(users.corretor, 'authenticated', `update public.profiles set full_name = 'X' where id = $1 returning id`, [users.gestor])
ok(otherUpdate.rows.length === 0, 'corretor não edita perfil de outro (0 linhas)')
const ownPrefs = await as(users.corretor, 'authenticated', `update public.profiles set preferences = '{"quick_actions":["novo-lead"]}' where id = $1 returning preferences`, [users.corretor])
ok(ownPrefs.rows[0]?.preferences?.quick_actions?.[0] === 'novo-lead', 'usuário salva as próprias preferências')
const otherPrefs = await as(users.corretor, 'authenticated', `update public.profiles set preferences = '{}' where id = $1 returning id`, [users.gestor])
ok(otherPrefs.rows.length === 0, 'corretor não altera preferências de outro (0 linhas)')
await expectError('preferências precisam ser um objeto', () => as(users.corretor, 'authenticated', `update public.profiles set preferences = '[]' where id = $1`, [users.corretor]), /preferences_check/)
const inactiveProfiles = await as(users.inativo, 'authenticated', `select id from public.profiles`)
ok(inactiveProfiles.rows.length === 1, 'inativo vê apenas o próprio perfil')

console.log('\nAcesso anônimo e inativo')
await expectError('anon não lê contatos', () => as(null, 'anon', `select * from public.contacts`), /permission denied/)
await expectError('anon não executa dashboard_metrics', () => as(null, 'anon', `select public.dashboard_metrics()`), /permission denied/)
await expectError('inativo não insere contato', () => as(users.inativo, 'authenticated', `insert into public.contacts (full_name, phone) values ('Teste', '11999990000')`), /row-level security/)

console.log('\nContatos')
const c1 = await as(users.corretor, 'authenticated', `insert into public.contacts (full_name, phone, email, created_by) values ('  Maria Souza ', '11999990001', ' MARIA@Email.com ', $1) returning id, full_name, email, created_by`, [users.admin])
ok(c1.rows[0].full_name === 'Maria Souza' && c1.rows[0].email === 'maria@email.com', 'normaliza nome e e-mail')
ok(c1.rows[0].created_by === users.corretor, 'created_by não pode ser forjado')
const contactId = c1.rows[0].id
await expectError('telefone duplicado bloqueado', () => as(users.corretor, 'authenticated', `insert into public.contacts (full_name, phone) values ('Outra', '11999990001')`), /duplicate key/)
await expectError('e-mail duplicado (case-insensitive) bloqueado', () => as(users.corretor, 'authenticated', `insert into public.contacts (full_name, phone, email) values ('Outra', '11999990002', 'Maria@email.com')`), /duplicate key/)
await expectError('telefone inválido bloqueado', () => as(users.corretor, 'authenticated', `insert into public.contacts (full_name, phone) values ('Outra', '(11) 9999')`), /check constraint/)
const owner = await as(users.corretor, 'authenticated', `insert into public.contacts (full_name, phone, contact_type) values ('João Proprietário', '11988880000', 'proprietario') returning id`)
const ownerContactId = owner.rows[0].id
const delByCorretor = await as(users.corretor, 'authenticated', `delete from public.contacts where id = $1 returning id`, [ownerContactId])
ok(delByCorretor.rows.length === 0, 'corretor não exclui contato')

console.log('\nImóveis')
const p1 = await as(users.corretor, 'authenticated', `insert into public.properties (code, title, property_type, purpose, sale_price, postal_code, state) values ('IM-0001', 'Apartamento 2 quartos', 'apartamento', 'venda', 350000, '29140-000', 'es') returning id, code, postal_code, state`)
ok(p1.rows[0].postal_code === '29140000' && p1.rows[0].state === 'ES', 'normaliza CEP e UF')
const propertyId = p1.rows[0].id
await expectError('código minúsculo é normalizado mas duplicado é bloqueado', () => as(users.corretor, 'authenticated', `insert into public.properties (code, title, property_type, purpose, sale_price) values ('im-0001', 'Outro', 'casa', 'venda', 1)`), /duplicate key/)
await expectError('venda sem valor bloqueada', () => as(users.corretor, 'authenticated', `insert into public.properties (code, title, property_type, purpose) values ('IM-0002', 'Casa', 'casa', 'venda')`), /sale_price_required/)
await expectError('ambos sem aluguel bloqueado', () => as(users.corretor, 'authenticated', `insert into public.properties (code, title, property_type, purpose, sale_price) values ('IM-0003', 'Casa', 'casa', 'ambos', 10)`), /rent_price_required/)
await expectError('suítes > quartos bloqueado', () => as(users.corretor, 'authenticated', `insert into public.properties (code, title, property_type, purpose, sale_price, bedrooms, suites) values ('IM-0004', 'Casa', 'casa', 'venda', 10, 1, 2)`), /suites_le_bedrooms/)
await as(users.corretor, 'authenticated', `select public.set_property_owners($1, $2::uuid[])`, [propertyId, [ownerContactId]])
let po = await db.query(`select count(*)::int as n from public.property_owners where property_id = $1`, [propertyId])
ok(po.rows[0].n === 1, 'set_property_owners cria vínculo')
await as(users.corretor, 'authenticated', `select public.set_property_owners($1, $2::uuid[])`, [propertyId, []])
po = await db.query(`select count(*)::int as n from public.property_owners where property_id = $1`, [propertyId])
ok(po.rows[0].n === 0, 'set_property_owners remove vínculos')
await expectError('inativo não executa set_property_owners', () => as(users.inativo, 'authenticated', `select public.set_property_owners($1, $2::uuid[])`, [propertyId, [ownerContactId]]), /não autorizado/)
await expectError('imagem com caminho de outro imóvel bloqueada', () => as(users.corretor, 'authenticated', `insert into public.property_images (property_id, storage_path) values ($1, 'properties/outro/x.jpg')`, [propertyId]), /path_matches_property/)
await as(users.corretor, 'authenticated', `insert into public.property_images (property_id, storage_path, mime_type, file_size) values ($1::uuid, 'properties/' || $1::text || '/a.jpg', 'image/jpeg', 1000)`, [propertyId])
ok(true, 'registro de imagem válido')

console.log('\nStorage')
await as(users.corretor, 'authenticated', `insert into storage.objects (bucket_id, name) values ('property-images', 'properties/' || $1::text || '/a.jpg')`, [propertyId])
ok(true, 'upload no caminho do imóvel permitido')
await expectError('upload fora da pasta properties bloqueado', () => as(users.corretor, 'authenticated', `insert into storage.objects (bucket_id, name) values ('property-images', 'outros/a.jpg')`), /row-level security/)
await expectError('upload para imóvel inexistente bloqueado', () => as(users.corretor, 'authenticated', `insert into storage.objects (bucket_id, name) values ('property-images', 'properties/00000000-0000-0000-0000-000000000000/a.jpg')`), /row-level security/)
await expectError('inativo não faz upload', () => as(users.inativo, 'authenticated', `insert into storage.objects (bucket_id, name) values ('property-images', 'properties/' || $1::text || '/b.jpg')`, [propertyId]), /row-level security/)
const delOther = await as(users.corretor2, 'authenticated', `delete from storage.objects where bucket_id = 'property-images' returning id`)
ok(delOther.rows.length === 0, 'corretor não exclui arquivo de outro')
const inactiveRead = await as(users.inativo, 'authenticated', `select id from storage.objects`)
ok(inactiveRead.rows.length === 0, 'inativo não lê arquivos')

console.log('\nLeads e funis')
const stages = await db.query(`select id, pipeline, name, category from public.pipeline_stages order by pipeline, position`)
ok(stages.rows.length === 19, '19 etapas semeadas (9 venda + 10 locação)')
const st = (pipeline, name) => stages.rows.find((s) => s.pipeline === pipeline && s.name === name).id
await expectError('etapa de outro funil bloqueada', () => as(users.corretor, 'authenticated', `insert into public.leads (contact_id, purpose, stage_id) values ($1, 'venda', $2)`, [contactId, st('locacao', 'Novo interessado')]), /não pertence ao funil/)
await expectError('orçamento mínimo > máximo bloqueado', () => as(users.corretor, 'authenticated', `insert into public.leads (contact_id, purpose, stage_id, min_budget, max_budget) values ($1, 'venda', $2, 10, 5)`, [contactId, st('venda', 'Novo lead')]), /budget_range/)
const lead = await as(users.corretor, 'authenticated', `insert into public.leads (contact_id, purpose, stage_id, assigned_to) values ($1, 'venda', $2, $3) returning id`, [contactId, st('venda', 'Novo lead'), users.corretor])
const leadId = lead.rows[0].id
let acts = await db.query(`select activity_type, description, created_by from public.activities where lead_id = $1 order by created_at`, [leadId])
ok(acts.rows.length === 1 && acts.rows[0].activity_type === 'sistema' && acts.rows[0].created_by === users.corretor, 'histórico: lead criado (autor correto)')
await as(users.corretor, 'authenticated', `update public.leads set stage_id = $2 where id = $1`, [leadId, st('venda', 'Proposta')])
acts = await db.query(`select activity_type, description from public.activities where lead_id = $1 and activity_type = 'mudanca_etapa'`, [leadId])
ok(acts.rows.length === 1 && acts.rows[0].description.includes('"Novo lead" para "Proposta"'), 'histórico: mudança de etapa')
const blocked = await as(users.corretor2, 'authenticated', `update public.leads set notes = 'x' where id = $1 returning id`, [leadId])
ok(blocked.rows.length === 0, 'corretor2 não edita lead de outro responsável')
const byManager = await as(users.gestor, 'authenticated', `update public.leads set notes = 'ok' where id = $1 returning id`, [leadId])
ok(byManager.rows.length === 1, 'gestor edita qualquer lead')
await as(users.corretor, 'authenticated', `select public.set_lead_properties($1, $2::uuid[])`, [leadId, [propertyId]])
const overview = await as(users.corretor2, 'authenticated', `select contact_name, stage_name, stage_category, property_count, assignee_name from public.lead_overview where id = $1`, [leadId])
ok(overview.rows[0]?.property_count === 1 && overview.rows[0]?.stage_category === 'negociacao', 'lead_overview consolida dados')
const overviewInactive = await as(users.inativo, 'authenticated', `select id from public.lead_overview`)
ok(overviewInactive.rows.length === 0, 'lead_overview respeita RLS (inativo vê 0)')

console.log('\nCompromissos e painel')
await as(users.corretor, 'authenticated', `insert into public.appointments (title, starts_at, lead_id, property_id) values ('Visita IM-0001', now() + interval '2 days', $1, $2)`, [leadId, propertyId])
acts = await db.query(`select description from public.activities where lead_id = $1 and activity_type = 'visita'`, [leadId])
ok(acts.rows.length === 1 && /Visita agendada para \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/.test(acts.rows[0].description), 'histórico: visita agendada (data BR, 24h)')
const metrics = (await as(users.corretor, 'authenticated', `select public.dashboard_metrics() as m`)).rows[0].m
ok(metrics.properties_total === 1 && metrics.properties_available === 1 && metrics.leads_active === 1 && metrics.visits_scheduled === 1 && metrics.negotiations_in_progress === 1 && metrics.sales_closed === 0, `dashboard_metrics: ${JSON.stringify({ ...metrics, leads_by_stage: metrics.leads_by_stage.length })}`)
const metricsInactive = (await as(users.inativo, 'authenticated', `select public.dashboard_metrics() as m`)).rows[0].m
ok(metricsInactive.properties_total === 0, 'dashboard_metrics para inativo retorna zeros')
await as(users.corretor, 'authenticated', `update public.leads set stage_id = $2 where id = $1`, [leadId, st('venda', 'Fechado')])
const closed = await db.query(`select closed_at from public.leads where id = $1`, [leadId])
ok(closed.rows[0].closed_at !== null, 'closed_at preenchido em etapa ganha')
const m2 = (await as(users.corretor, 'authenticated', `select public.dashboard_metrics() as m`)).rows[0].m
ok(m2.sales_closed === 1 && m2.leads_active === 0, 'venda concluída contabilizada')

console.log('\nHistórico de atividades')
const leadActs = (await db.query(`select count(*)::int as n from public.activities where lead_id = $1`, [leadId])).rows[0].n
const byOther = await as(users.corretor2, 'authenticated', `delete from public.activities where lead_id = $1 returning id`, [leadId])
ok(byOther.rows.length === 0, 'corretor não apaga o histórico de outro (0 linhas)')
const ownStage = await as(users.corretor, 'authenticated', `delete from public.activities where id = (select id from public.activities where lead_id = $1 and activity_type = 'mudanca_etapa' order by occurred_at limit 1) returning id`, [leadId])
ok(ownStage.rows.length === 1, 'autor apaga um registro automático de mudança de etapa')
const cleared = await as(users.gestor, 'authenticated', `delete from public.activities where lead_id = $1 returning id`, [leadId])
ok(cleared.rows.length === leadActs - 1, `gestor limpa todo o histórico do lead (${cleared.rows.length} registros)`)
const leadStill = (await db.query(`select count(*)::int as n from public.leads where id = $1`, [leadId])).rows[0].n
ok(leadStill === 1, 'o lead continua existindo após limpar o histórico')

console.log('\nConfiguração de funis')
await expectError('gestor não altera etapas', async () => {
  const r = await as(users.gestor, 'authenticated', `update public.pipeline_stages set name = 'X' where pipeline = 'venda' and position = 1 returning id`)
  if (r.rows.length === 0) throw new Error('0 linhas (RLS)')
}, /RLS/)
const ids = stages.rows.filter((s) => s.pipeline === 'venda').map((s) => s.id)
const reversed = [...ids].reverse()
await as(users.admin, 'authenticated', `select public.reorder_pipeline_stages('venda', $1::uuid[])`, [reversed])
const first = await db.query(`select name from public.pipeline_stages where pipeline = 'venda' order by position limit 1`)
ok(first.rows[0].name === 'Perdido', 'admin reordena etapas (constraint adiada)')
await expectError('gestor não reordena', () => as(users.gestor, 'authenticated', `select public.reorder_pipeline_stages('venda', $1::uuid[])`, [ids]), /administradores/)
await expectError('lista incompleta rejeitada', () => as(users.admin, 'authenticated', `select public.reorder_pipeline_stages('venda', $1::uuid[])`, [ids.slice(1)]), /incompleta/)

console.log('\nExclusões')
await expectError('contato com lead não pode ser excluído', () => as(users.gestor, 'authenticated', `delete from public.contacts where id = $1`, [contactId]), /foreign key/)
const delProp = await as(users.gestor, 'authenticated', `delete from public.properties where id = $1 returning id`, [propertyId])
ok(delProp.rows.length === 1, 'gestor exclui imóvel (cascata em fotos/vínculos)')

console.log(failures ? `\n${failures} falha(s)` : '\nTodos os testes passaram')
process.exit(failures ? 1 : 0)
