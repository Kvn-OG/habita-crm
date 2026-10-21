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
create function auth.jwt() returns jsonb language sql stable as $$
  select jsonb_build_object('sub', current_setting('request.jwt.claim.sub', true), 'session_id', nullif(current_setting('request.jwt.claim.session_id', true), '')) $$;
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz default now(), updated_at timestamptz default now(), refreshed_at timestamp, not_after timestamptz, user_agent text);
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text default auth.uid()::text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema public, auth, storage, extensions to anon, authenticated;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
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
for (const [key, email] of [['admin', 'admin@exemplo.com'], ['admin2', 'admin2@exemplo.com'], ['corretor', 'corretor@exemplo.com'], ['corretor2', 'c2@exemplo.com'], ['inativo', 'novo@exemplo.com']]) {
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
await as(users.admin, 'authenticated', `update public.profiles set role = 'admin', is_active = true where id = $1`, [users.admin2])
await as(users.admin, 'authenticated', `update public.profiles set is_active = true where id = any($1::uuid[])`, [[users.corretor, users.corretor2]])
const active = await db.query(`select count(*)::int as n from public.profiles where is_active`)
ok(active.rows[0].n === 4, 'admin ativa outro admin e corretores')
await expectError('corretor não promove a si mesmo', () => as(users.corretor, 'authenticated', `update public.profiles set role = 'admin' where id = $1`, [users.corretor]), /administradores/)
const brokerRole = await as(users.corretor2, 'authenticated', `update public.profiles set role = 'admin' where id = $1 returning id`, [users.corretor]); ok(brokerRole.rows.length === 0, 'corretor não altera papéis (RLS: 0 linhas)')
await expectError('papel gestor não existe mais', () => as(users.admin, 'authenticated', `update public.profiles set role = 'gestor' where id = $1`, [users.corretor]), /profiles_role_valid/)
await expectError('admin não rebaixa a si mesmo', () => as(users.admin, 'authenticated', `update public.profiles set role = 'corretor' where id = $1`, [users.admin]), /próprio/)
const selfUpdate = await as(users.corretor, 'authenticated', `update public.profiles set full_name = 'Corretor Um' where id = $1 returning id`, [users.corretor])
ok(selfUpdate.rows.length === 1, 'usuário edita o próprio nome')
const otherUpdate = await as(users.corretor, 'authenticated', `update public.profiles set full_name = 'X' where id = $1 returning id`, [users.admin2])
ok(otherUpdate.rows.length === 0, 'corretor não edita perfil de outro (0 linhas)')
const ownPrefs = await as(users.corretor, 'authenticated', `update public.profiles set preferences = '{"quick_actions":["novo-lead"]}' where id = $1 returning preferences`, [users.corretor])
ok(ownPrefs.rows[0]?.preferences?.quick_actions?.[0] === 'novo-lead', 'usuário salva as próprias preferências')
const otherPrefs = await as(users.corretor, 'authenticated', `update public.profiles set preferences = '{}' where id = $1 returning id`, [users.admin2])
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
ok(p1.rows[0].code === 'IM-0001', 'código gerado automaticamente (IM-0001)')
const p2 = await as(users.corretor2, 'authenticated', `insert into public.properties (code, title, property_type, purpose, sale_price) values ('XYZ', 'Casa térrea', 'casa', 'venda', 1) returning id, code`)
ok(p2.rows[0].code === 'IM-0002', 'código informado pelo usuário é ignorado (IM-0002)')
await expectError('código do imóvel não pode ser alterado', () => as(users.admin2, 'authenticated', `update public.properties set code = 'IM-9999' where id = $1`, [p2.rows[0].id]), /não pode ser alterado/)
const othersProperty = await as(users.corretor, 'authenticated', `select id from public.properties where id = $1`, [p2.rows[0].id])
ok(othersProperty.rows.length === 1, 'corretor vê imóveis cadastrados por outros')
await db.query(`delete from public.properties where id = $1`, [p2.rows[0].id])
await expectError('venda sem valor bloqueada', () => as(users.corretor, 'authenticated', `insert into public.properties (code, title, property_type, purpose) values ('IM-0002', 'Casa', 'casa', 'venda')`), /sale_price_required/)
await expectError('ambos sem aluguel bloqueado', () => as(users.corretor, 'authenticated', `insert into public.properties (code, title, property_type, purpose, sale_price) values ('IM-0003', 'Casa', 'casa', 'ambos', 10)`), /rent_price_required/)
await expectError('suítes > quartos bloqueado', () => as(users.corretor, 'authenticated', `insert into public.properties (code, title, property_type, purpose, sale_price, bedrooms, suites) values ('IM-0004', 'Casa', 'casa', 'venda', 10, 1, 2)`), /suites_le_bedrooms/)
await as(users.corretor, 'authenticated', `select public.set_property_owners($1, $2::uuid[])`, [propertyId, [ownerContactId]])
let po = await db.query(`select count(*)::int as n from public.property_owners where property_id = $1`, [propertyId])
ok(po.rows[0].n === 1, 'set_property_owners cria vínculo')
await as(users.corretor, 'authenticated', `select public.set_property_owners($1, $2::uuid[])`, [propertyId, []])
po = await db.query(`select count(*)::int as n from public.property_owners where property_id = $1`, [propertyId])
ok(po.rows[0].n === 0, 'set_property_owners remove vínculos')
await as(users.corretor, 'authenticated', `select public.set_property_owners($1, $2::uuid[])`, [propertyId, [ownerContactId]])
const ownersSeen = await as(users.corretor2, 'authenticated', `select owner_id from public.property_owners where property_id = $1`, [propertyId])
ok(ownersSeen.rows.length === 0, 'corretor2 não vê o proprietário cadastrado por outro corretor')
await as(users.corretor2, 'authenticated', `select public.set_property_owners($1, $2::uuid[])`, [propertyId, []])
po = await db.query(`select count(*)::int as n from public.property_owners where property_id = $1`, [propertyId])
ok(po.rows[0].n === 1, 'editar o imóvel não remove proprietários que o corretor não vê')
await as(users.corretor, 'authenticated', `select public.set_property_owners($1, $2::uuid[])`, [propertyId, []])
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
const byManager = await as(users.admin2, 'authenticated', `update public.leads set notes = 'ok' where id = $1 returning id`, [leadId])
ok(byManager.rows.length === 1, 'admin edita qualquer lead')
await as(users.corretor, 'authenticated', `select public.set_lead_properties($1, $2::uuid[])`, [leadId, [propertyId]])
const overview = await as(users.admin2, 'authenticated', `select contact_name, stage_name, stage_category, property_count, assignee_name from public.lead_overview where id = $1`, [leadId])
ok(overview.rows[0]?.property_count === 1 && overview.rows[0]?.stage_category === 'negociacao', 'lead_overview consolida dados')
const overviewInactive = await as(users.inativo, 'authenticated', `select id from public.lead_overview`)
ok(overviewInactive.rows.length === 0, 'lead_overview respeita RLS (inativo vê 0)')

console.log('\nCarteira de cada corretor')
const otherLeads = await as(users.corretor2, 'authenticated', `select id from public.lead_overview where id = $1`, [leadId])
ok(otherLeads.rows.length === 0, 'corretor2 não vê lead de outro corretor')
const otherContacts = await as(users.corretor2, 'authenticated', `select id from public.contacts where id = any($1::uuid[])`, [[contactId, ownerContactId]])
ok(otherContacts.rows.length === 0, 'corretor2 não vê contatos de outro corretor')
const otherActs = await as(users.corretor2, 'authenticated', `select id from public.activities where lead_id = $1`, [leadId])
ok(otherActs.rows.length === 0, 'corretor2 não vê o histórico do lead de outro corretor')
const otherLinks = await as(users.corretor2, 'authenticated', `select lead_id from public.lead_properties where lead_id = $1`, [leadId])
ok(otherLinks.rows.length === 0, 'corretor2 não vê imóveis de interesse do lead de outro')
const gestorContacts = await as(users.admin2, 'authenticated', `select id from public.contacts where id = any($1::uuid[])`, [[contactId, ownerContactId]])
ok(gestorContacts.rows.length === 2, 'admin vê os contatos de todos')
const assignedContact = await as(users.admin2, 'authenticated', `insert into public.contacts (full_name, phone) values ('Ana Repasse', '11966660000') returning id`)
const assignedLead = await as(users.admin2, 'authenticated', `insert into public.leads (contact_id, purpose, stage_id, assigned_to) values ($1, 'venda', $2, $3) returning id`, [assignedContact.rows[0].id, st('venda', 'Novo lead'), users.corretor2])
const seenAssigned = await as(users.corretor2, 'authenticated', `select (select count(*)::int from public.leads where id = $1) as leads, (select count(*)::int from public.contacts where id = $2) as contacts`, [assignedLead.rows[0].id, assignedContact.rows[0].id])
ok(seenAssigned.rows[0].leads === 1 && seenAssigned.rows[0].contacts === 1, 'corretor vê o lead atribuído a ele e o contato do lead')
await expectError('corretor não abre negociação em lead de outro', () => as(users.corretor2, 'authenticated', `insert into public.deals (lead_id, deal_type) values ($1, 'venda')`, [leadId]), /row-level security/)
await db.query(`delete from public.activities where lead_id = $1`, [assignedLead.rows[0].id])
await db.query(`delete from public.leads where id = $1`, [assignedLead.rows[0].id])
await db.query(`delete from public.contacts where id = $1`, [assignedContact.rows[0].id])

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

console.log('\nNegociações e propostas')
const c2 = await as(users.corretor2, 'authenticated', `insert into public.contacts (full_name, phone) values ('Carlos Lima', '11977770000') returning id`)
const lead2 = await as(users.corretor2, 'authenticated', `insert into public.leads (contact_id, purpose, stage_id, assigned_to) values ($1, 'venda', $2, $3) returning id`, [c2.rows[0].id, st('venda', 'Novo lead'), users.corretor2])
const lead2Id = lead2.rows[0].id
await as(users.corretor2, 'authenticated', `update public.leads set stage_id = $2 where id = $1`, [lead2Id, st('venda', 'Proposta')])
await expectError('tipo diferente da finalidade do lead bloqueado', () => as(users.corretor2, 'authenticated', `insert into public.deals (lead_id, deal_type) values ($1, 'locacao')`, [lead2Id]), /finalidade do lead/)
const deal = await as(users.corretor2, 'authenticated', `insert into public.deals (lead_id, property_id, deal_type, assigned_to) values ($1, $2, 'venda', $3) returning id`, [lead2Id, propertyId, users.corretor2])
const dealId = deal.rows[0].id
const propStatus = async () => (await db.query(`select status from public.properties where id = $1`, [propertyId])).rows[0].status
ok(await propStatus() === 'em_negociacao', 'imóvel passa para "em negociação"')
acts = await db.query(`select description from public.activities where lead_id = $1 and metadata ? 'deal_id'`, [lead2Id])
ok(acts.rows.some((a) => a.description === 'Negociação de venda aberta.'), 'histórico: negociação aberta')
const dealByOther = await as(users.corretor, 'authenticated', `update public.deals set notes = 'x' where id = $1 returning id`, [dealId])
ok(dealByOther.rows.length === 0, 'corretor não edita negociação de outro responsável')
await expectError('corretor não registra proposta em negociação de outro', () => as(users.corretor, 'authenticated', `insert into public.proposals (deal_id, amount) values ($1, 1)`, [dealId]), /row-level security/)
const prop1 = await as(users.corretor2, 'authenticated', `insert into public.proposals (deal_id, amount) values ($1, 300000) returning id`, [dealId])
await as(users.corretor2, 'authenticated', `update public.proposals set status = 'aceita' where id = $1`, [prop1.rows[0].id])
let dealRow = (await db.query(`select amount, status, closed_at, loss_reason from public.deals where id = $1`, [dealId])).rows[0]
ok(Number(dealRow.amount) === 300000, 'proposta aceita define o valor da negociação')
const prop2 = await as(users.corretor2, 'authenticated', `insert into public.proposals (deal_id, amount) values ($1, 310000) returning id`, [dealId])
await expectError('apenas uma proposta aceita por negociação', () => as(users.corretor2, 'authenticated', `update public.proposals set status = 'aceita' where id = $1`, [prop2.rows[0].id]), /proposals_one_accepted_idx/)
acts = await db.query(`select description from public.activities where lead_id = $1 and metadata ? 'proposal_id' order by created_at`, [lead2Id])
ok(acts.rows.some((a) => a.description === 'Proposta de R$ 300.000,00 aceita.'), `histórico: proposta aceita (${acts.rows.map((a) => a.description).join(' | ')})`)
const hiddenDeal = await as(users.corretor, 'authenticated', `select (select count(*)::int from public.deal_overview where id = $1) as deals, (select count(*)::int from public.proposals where deal_id = $1) as proposals`, [dealId])
ok(hiddenDeal.rows[0].deals === 0 && hiddenDeal.rows[0].proposals === 0, 'corretor não vê negociação nem propostas de outro')
const dealView = await as(users.admin2, 'authenticated', `select contact_name, property_code, proposal_count, last_proposal_amount from public.deal_overview where id = $1`, [dealId])
ok(dealView.rows[0]?.contact_name === 'Carlos Lima' && dealView.rows[0]?.proposal_count === 2 && Number(dealView.rows[0]?.last_proposal_amount) === 310000, 'deal_overview consolida dados')

await as(users.corretor2, 'authenticated', `update public.deals set status = 'perdido', loss_reason = 'Preço acima do orçamento' where id = $1`, [dealId])
dealRow = (await db.query(`select closed_at, loss_reason from public.deals where id = $1`, [dealId])).rows[0]
ok(dealRow.closed_at !== null && dealRow.loss_reason === 'Preço acima do orçamento', 'perdida: data de encerramento e motivo')
ok(await propStatus() === 'disponivel', 'imóvel volta a "disponível" sem negociação em andamento')
await as(users.corretor2, 'authenticated', `update public.deals set status = 'em_andamento' where id = $1`, [dealId])
dealRow = (await db.query(`select closed_at, loss_reason from public.deals where id = $1`, [dealId])).rows[0]
ok(dealRow.closed_at === null && dealRow.loss_reason === null, 'reaberta: limpa encerramento e motivo')
ok(await propStatus() === 'em_negociacao', 'imóvel volta a "em negociação"')
await as(users.corretor2, 'authenticated', `update public.deals set status = 'ganho' where id = $1`, [dealId])
ok(await propStatus() === 'vendido', 'ganha: imóvel vendido')
const lead2Stage = await db.query(`select s.category from public.leads l join public.pipeline_stages s on s.id = l.stage_id where l.id = $1`, [lead2Id])
ok(lead2Stage.rows[0].category === 'ganho', 'ganha: lead vai para a etapa de conclusão')
acts = await db.query(`select description from public.activities where lead_id = $1 and metadata ? 'deal_id' and metadata ->> 'deal_status' = 'ganho'`, [lead2Id])
ok(acts.rows[0]?.description === 'Negociação ganha por R$ 300.000,00.', 'histórico: negociação ganha')

const report = (await as(users.admin2, 'authenticated', `select public.report_metrics(now() - interval '1 day', now() + interval '1 day') as r`)).rows[0].r
const funnelStage = (name) => report.funnel.find((f) => f.pipeline === 'venda' && f.name === name)?.total
ok(report.deals.won_count === 1 && Number(report.deals.won_amount) === 300000 && report.deals.open_count === 0, `report_metrics: negociações ${JSON.stringify(report.deals)}`)
ok(funnelStage('Novo lead') === 2 && funnelStage('Proposta') === 2 && funnelStage('Fechado') === 2, 'report_metrics: funil pelas etapas percorridas')
ok(report.sources.reduce((sum, s) => sum + s.total, 0) === 2 && report.monthly.length === 1, 'report_metrics: origens e vendas por mês')
ok(report.brokers.find((b) => b.id === users.corretor2)?.deals_won === 1, 'report_metrics: desempenho por corretor')
const broker2 = report.brokers.find((b) => b.id === users.corretor2)
const broker1 = report.brokers.find((b) => b.id === users.corretor)
ok(broker2?.leads === 1 && broker2?.leads_won === 1 && broker2?.leads_open === 0 && broker1?.leads_won === 1, `report_metrics: aproveitamento de leads ${JSON.stringify({ broker1, broker2 })}`)
ok(report.stage_times.some((t) => t.name === 'Novo lead'), 'report_metrics: tempo por etapa')
const lostReport = (await as(users.admin2, 'authenticated', `select public.report_metrics(now() - interval '1 day', now() + interval '1 day', 'locacao') as r`)).rows[0].r
ok(lostReport.deals.won_count === 0 && lostReport.funnel.every((f) => f.pipeline === 'locacao'), 'report_metrics filtra pelo funil')
await expectError('corretor não acessa os relatórios', () => as(users.corretor, 'authenticated', `select public.report_metrics(now() - interval '1 day', now() + interval '1 day')`), /Apenas administradores/)
await expectError('inativo não acessa os relatórios', () => as(users.inativo, 'authenticated', `select public.report_metrics(now() - interval '1 day', now() + interval '1 day')`), /Apenas administradores/)
await expectError('anon não executa report_metrics', () => as(null, 'anon', `select public.report_metrics(now(), now())`), /permission denied/)
await expectError('lead com negociação não pode ser excluído', () => as(users.admin2, 'authenticated', `delete from public.leads where id = $1`, [lead2Id]), /deals_lead_id_fkey/)

console.log('\nHistórico de atividades')
const leadActs = (await db.query(`select count(*)::int as n from public.activities where lead_id = $1`, [leadId])).rows[0].n
const byOther = await as(users.corretor2, 'authenticated', `delete from public.activities where lead_id = $1 returning id`, [leadId])
ok(byOther.rows.length === 0, 'corretor não apaga o histórico de outro (0 linhas)')
const ownStage = await as(users.corretor, 'authenticated', `delete from public.activities where id = (select id from public.activities where lead_id = $1 and activity_type = 'mudanca_etapa' order by occurred_at limit 1) returning id`, [leadId])
ok(ownStage.rows.length === 1, 'autor apaga um registro automático de mudança de etapa')
const cleared = await as(users.admin2, 'authenticated', `delete from public.activities where lead_id = $1 returning id`, [leadId])
ok(cleared.rows.length === leadActs - 1, `admin limpa todo o histórico do lead (${cleared.rows.length} registros)`)
const leadStill = (await db.query(`select count(*)::int as n from public.leads where id = $1`, [leadId])).rows[0].n
ok(leadStill === 1, 'o lead continua existindo após limpar o histórico')

console.log('\nConfiguração de funis')
await expectError('corretor não altera etapas', async () => {
  const r = await as(users.corretor, 'authenticated', `update public.pipeline_stages set name = 'X' where pipeline = 'venda' and position = 1 returning id`)
  if (r.rows.length === 0) throw new Error('0 linhas (RLS)')
}, /RLS/)
const ids = stages.rows.filter((s) => s.pipeline === 'venda').map((s) => s.id)
const reversed = [...ids].reverse()
await as(users.admin, 'authenticated', `select public.reorder_pipeline_stages('venda', $1::uuid[])`, [reversed])
const first = await db.query(`select name from public.pipeline_stages where pipeline = 'venda' order by position limit 1`)
ok(first.rows[0].name === 'Perdido', 'admin reordena etapas (constraint adiada)')
await expectError('corretor não reordena', () => as(users.corretor, 'authenticated', `select public.reorder_pipeline_stages('venda', $1::uuid[])`, [ids]), /administradores/)
await expectError('lista incompleta rejeitada', () => as(users.admin, 'authenticated', `select public.reorder_pipeline_stages('venda', $1::uuid[])`, [ids.slice(1)]), /incompleta/)

console.log('\nExclusões')
await expectError('contato com lead não pode ser excluído', () => as(users.admin2, 'authenticated', `delete from public.contacts where id = $1`, [contactId]), /foreign key/)
const delProp = await as(users.admin2, 'authenticated', `delete from public.properties where id = $1 returning id`, [propertyId])
ok(delProp.rows.length === 1, 'admin exclui imóvel (cascata em fotos/vínculos)')

console.log('\nSessões')
async function asSession(userId, sessionId, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.exec('set local role authenticated')
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.session_id', $2, true)`, [userId, sessionId])
    return tx.query(sql, params)
  })
}
const sessA = (await db.query(`insert into auth.sessions (user_id, user_agent) values ($1, 'PC A') returning id`, [users.corretor])).rows[0].id
const sessB = (await db.query(`insert into auth.sessions (user_id, user_agent) values ($1, 'PC B') returning id`, [users.corretor])).rows[0].id
await db.query(`insert into auth.sessions (user_id, user_agent) values ($1, 'Outra conta')`, [users.admin2])
await db.query(`insert into auth.sessions (user_id, user_agent, not_after) values ($1, 'Expirada', now() - interval '1 day')`, [users.corretor])
const abandoned = await asSession(users.corretor, sessB, `select user_agent from public.other_active_sessions()`)
ok(abandoned.rows.length === 0, 'sessão aberta mas sem uso (sem sinal) não gera aviso')
ok((await asSession(users.corretor, sessA, `select public.current_session_active() as v`)).rows[0].v === true, 'PC A em uso dá sinal e segue ativa')
const others = await asSession(users.corretor, sessB, `select user_agent from public.other_active_sessions()`)
ok(others.rows.length === 1 && others.rows[0].user_agent === 'PC A', 'login no PC B enxerga a sessão em uso do PC A')
await expectError('ninguém lê os sinais de sessão diretamente', () => as(users.corretor, 'authenticated', `select * from public.session_heartbeats`), /permission denied/)
await db.query(`update public.session_heartbeats set last_seen_at = now() - interval '10 minutes' where session_id = $1`, [sessA])
const idle = await asSession(users.corretor, sessB, `select user_agent from public.other_active_sessions()`)
ok(idle.rows.length === 0, 'PC A sem sinal há 10 minutos (navegador fechado) não gera aviso')
await db.query(`delete from auth.sessions where id = $1`, [sessA])
ok((await asSession(users.corretor, sessA, `select public.current_session_active() as v`)).rows[0].v === false, 'PC A percebe que a sua sessão foi encerrada')
await expectError('visitante não consulta sessões', () => as(null, 'anon', `select * from public.other_active_sessions()`), /permission denied/)

console.log('\nDiagnóstico de follow-up')
await expectError('corretor não vê o diagnóstico', () => as(users.corretor, 'authenticated', `select public.followup_diagnostics()`), /Apenas administradores/)
const fuContact = await as(users.admin, 'authenticated', `insert into public.contacts (full_name, phone) values ('Rita Retorno', '11933330000') returning id`)
const fuLead = await as(users.admin, 'authenticated', `insert into public.leads (contact_id, purpose, stage_id, assigned_to, next_follow_up_at) values ($1, 'venda', $2, $3, now() - interval '2 days') returning id`, [fuContact.rows[0].id, st('venda', 'Qualificado'), users.corretor])
await as(users.corretor, 'authenticated', `insert into public.activities (activity_type, description, lead_id, occurred_at) values ('nota', 'Primeiro contato', $1, now() - interval '20 days')`, [fuLead.rows[0].id])
const fuLead2 = await as(users.admin, 'authenticated', `insert into public.leads (contact_id, purpose, stage_id, assigned_to) values ($1, 'locacao', $2, $3) returning id`, [fuContact.rows[0].id, st('locacao', 'Qualificado'), users.corretor])
await as(users.corretor, 'authenticated', `insert into public.activities (activity_type, description, lead_id) values ('ligacao', 'Liguei', $1)`, [fuLead2.rows[0].id])
const diag = (await as(users.admin, 'authenticated', `select public.followup_diagnostics() as d`)).rows[0].d
const fu = diag.brokers.find((b) => b.id === users.corretor)
ok(fu?.active === 2 && fu?.overdue === 1 && fu?.no_followup === 1 && fu?.stale === 1, `diagnóstico: ativos, atrasados, sem retorno e sem contato ${JSON.stringify(fu && { ...fu, attention: fu.attention.length })}`)
ok(fu?.attention[0]?.id === fuLead.rows[0].id, 'diagnóstico: lead mais esquecido aparece primeiro')
ok(diag.brokers.every((b) => b.id !== null || b.active > 0), 'diagnóstico: "sem responsável" só quando há leads sem corretor')

console.log('\nFoto de perfil')
const ownAvatar = await as(users.corretor, 'authenticated', `update public.profiles set avatar_path = $1 || '/foto.jpg' where id = $1 returning id`, [users.corretor])
ok(ownAvatar.rows.length === 1, 'usuário define a própria foto')
await expectError('foto apontando para a pasta de outro usuário', () => as(users.corretor, 'authenticated', `update public.profiles set avatar_path = $2 || '/foto.jpg' where id = $1`, [users.corretor, users.admin2]), /avatar_path_check/)
await as(users.corretor, 'authenticated', `insert into storage.objects (bucket_id, name) values ('avatars', $1 || '/foto.jpg')`, [users.corretor])
ok(true, 'envio de arquivo na própria pasta')
await expectError('envio na pasta de outro usuário', () => as(users.corretor, 'authenticated', `insert into storage.objects (bucket_id, name) values ('avatars', $1 || '/x.jpg')`, [users.admin2]), /row-level security/)
const seen = await as(users.admin2, 'authenticated', `select name from storage.objects where bucket_id = 'avatars'`)
ok(seen.rows.length === 1, 'membro ativo vê as fotos da equipe')
const removedByOther = await as(users.admin2, 'authenticated', `delete from storage.objects where bucket_id = 'avatars' returning id`)
ok(removedByOther.rows.length === 0, 'ninguém apaga a foto de outro usuário')

console.log('\nMarketing')
await expectError('corretor não vê landing pages', async () => {
  const r = await as(users.corretor, 'authenticated', `insert into public.landing_pages (name, purpose) values ('LP', 'Teste') returning id`)
  if (r.rows.length) throw new Error('inseriu')
}, /row-level security/)
const lp = await as(users.admin, 'authenticated', `insert into public.landing_pages (name, purpose, pipeline, default_assignee) values (' Minha Casa ', 'Imóveis do programa Minha Casa, Minha Vida', 'venda', $1) returning id, token, name`, [users.corretor2])
const lpId = lp.rows[0].id
const lpToken = lp.rows[0].token
ok(lp.rows[0].name === 'Minha Casa' && /^[0-9a-f]{64}$/.test(lpToken), 'landing page criada com identificador próprio')
for (let i = 2; i <= 5; i++) await as(users.admin, 'authenticated', `insert into public.landing_pages (name, purpose) values ($1, 'Teste')`, [`LP ${i}`])
await expectError('limite de 5 landing pages', () => as(users.admin, 'authenticated', `insert into public.landing_pages (name, purpose) values ('LP 6', 'Teste')`), /limite é de 5/)
const camp = await as(users.admin, 'authenticated', `insert into public.campaigns (name, platform, status, landing_page_id, utm_campaign, spent, impressions, clicks) values ('MCMV Outubro', 'meta_ads', 'ativa', $1, ' MCMV-Out ', 500, 10000, 250) returning id, utm_campaign`, [lpId])
const campId = camp.rows[0].id
ok(camp.rows[0].utm_campaign === 'mcmv-out', 'utm_campaign normalizado')
const campSeen = await as(users.corretor, 'authenticated', `select id from public.campaign_overview`)
ok(campSeen.rows.length === 0, 'corretor não vê campanhas')
await expectError('formulário não chama a função diretamente', () => as(null, 'anon', `select public.submit_landing_page_lead($1, 'Teste', '11955550000')`, [lpToken]), /permission denied/)
await expectError('corretor não chama a função de recebimento', () => as(users.corretor, 'authenticated', `select public.submit_landing_page_lead($1, 'Teste', '11955550000')`, [lpToken]), /permission denied/)
await expectError('token inválido rejeitado', () => db.query(`select public.submit_landing_page_lead('x', 'Teste', '11955550000')`), /não encontrada/)
await expectError('telefone inválido rejeitado', () => db.query(`select public.submit_landing_page_lead($1, 'Teste', '1234')`, [lpToken]), /telefone/)
const sub = (await db.query(`select public.submit_landing_page_lead($1, 'Paula Dias', '+55 (11) 95555-0000', 'paula@exemplo.com', 'Quero saber das condições', '{"utm_source":"facebook","utm_campaign":"MCMV-Out","x":"y"}') as r`, [lpToken])).rows[0].r
ok(sub.created === true, 'lead criado pela landing page')
const lpLead = (await db.query(`select l.source, l.assigned_to, l.campaign_id, l.landing_page_id, l.utm, c.phone from public.leads l join public.contacts c on c.id = l.contact_id where l.id = $1`, [sub.lead_id])).rows[0]
ok(lpLead.source === 'landing_page' && lpLead.phone === '11955550000' && lpLead.assigned_to === users.corretor2, 'origem, telefone sem DDI e corretor padrão')
ok(lpLead.campaign_id === campId && lpLead.landing_page_id === lpId && lpLead.utm.utm_source === 'facebook' && !('x' in lpLead.utm), 'vinculado à campanha e à página, só com UTMs conhecidos')
const again = (await db.query(`select public.submit_landing_page_lead($1, 'Paula Dias', '11955550000') as r`, [lpToken])).rows[0].r
ok(again.created === false && again.lead_id === sub.lead_id, 'novo envio do mesmo contato não duplica o lead')
const seenByBroker = await as(users.corretor2, 'authenticated', `select id from public.lead_overview where id = $1`, [sub.lead_id])
ok(seenByBroker.rows.length === 1, 'corretor padrão vê o lead recebido')
const co = (await as(users.admin, 'authenticated', `select leads, cost_per_lead, ctr from public.campaign_overview where id = $1`, [campId])).rows[0]
ok(co.leads === 1 && Number(co.cost_per_lead) === 500 && Number(co.ctr) === 2.5, `resultados da campanha ${JSON.stringify(co)}`)
const lpo = (await as(users.admin, 'authenticated', `select leads_total, assignee_name from public.landing_page_overview where id = $1`, [lpId])).rows[0]
ok(lpo.leads_total === 1 && lpo.assignee_name === 'corretor2', 'resultados da landing page')
await db.query(`update public.landing_pages set is_active = false where id = $1`, [lpId])
await expectError('landing page desativada não recebe leads', () => db.query(`select public.submit_landing_page_lead($1, 'Outro', '11944440000')`, [lpToken]), /desativada/)

console.log('\nExclusão de acesso')
const authored = (await db.query(`select count(*)::int as n from public.contacts where created_by = $1`, [users.corretor2])).rows[0].n
await db.query(`delete from auth.users where id = $1`, [users.corretor2])
const gone = (await db.query(`select count(*)::int as n from public.profiles where id = $1`, [users.corretor2])).rows[0].n
ok(gone === 0, 'perfil removido junto com o usuário')
const kept = (await db.query(`select count(*)::int as n from public.contacts where created_by is null and full_name = 'Carlos Lima'`)).rows[0].n
ok(authored > 0 && kept === 1, 'registros do usuário excluído são mantidos sem autor')
const unassigned = (await db.query(`select assigned_to from public.leads where id = $1`, [sub.lead_id])).rows[0]
ok(unassigned.assigned_to === null, 'leads do usuário excluído ficam sem responsável')
await expectError('autor não pode ser apagado manualmente', async () => {
  const r = await as(users.admin, 'authenticated', `update public.contacts set created_by = null where id = $1 returning created_by`, [contactId])
  if (r.rows[0]?.created_by === null) throw new Error('autor apagado')
  throw new Error('preservado')
}, /preservado/)

console.log(failures ? `\n${failures} falha(s)` : '\nTodos os testes passaram')
process.exit(failures ? 1 : 0)
