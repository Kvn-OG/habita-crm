# Habita · CRM Imobiliário

> **Sua imobiliária, mais organizada.**

CRM para imobiliárias: gestão de imóveis, contatos, leads e agenda comercial de vendas e locações residenciais, em um painel privado para a equipe.

> **Modelo de implantação:** cada imobiliária cliente recebe a sua própria instalação (um projeto Supabase e um projeto Vercel), com dados totalmente isolados. O código é o mesmo; o que muda por cliente são as variáveis de ambiente.

> Sistema privado, sem área pública. Toda a interface está em português do Brasil, com valores em reais (BRL), datas `dd/MM/aaaa` e horários de 24 horas no fuso de Brasília.

## Sumário

- [Stack](#stack)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Configuração do Supabase](#configuração-do-supabase)
- [Como executar as migrations](#como-executar-as-migrations)
- [Criar o primeiro administrador](#criar-o-primeiro-administrador-com-segurança)
- [Comandos](#comandos)
- [Modelo de segurança](#modelo-de-segurança)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Módulos da versão inicial](#módulos-da-versão-inicial)
- [Verificações realizadas](#verificações-realizadas)
- [Limitações conhecidas](#limitações-conhecidas)
- [Próximas etapas](#próximas-etapas)

## Stack

| Camada | Tecnologia |
|---|---|
| Interface | React 19 + Vite 8 + TypeScript 6 (strict) |
| Estilo | Tailwind CSS 4, com tokens de cor em `src/styles/index.css` |
| Navegação | React Router 7 (rotas carregadas sob demanda) |
| Dados | TanStack Query 5 + Supabase JS 2 |
| Formulários | React Hook Form 7 + Zod 4 (mensagens em pt-BR) |
| Backend | Supabase: Auth, PostgreSQL com RLS e Storage |
| Ícones e gráficos | Lucide React e Recharts (carregado só quando há gráfico) |
| Testes | Vitest (unitários) e PGlite (migrations e RLS sem Docker) |

> O TypeScript está fixado em `~6.0`, porque o `typescript-eslint` ainda não suporta o TypeScript 7. O `@hookform/resolvers` está na 5.x, porque a 6.0.0 publicada tem conflito nas próprias dependências opcionais.

## Pré-requisitos

- **Node.js 20.19 ou superior** (testado com Node 24) e npm.
- Uma conta e um projeto no [Supabase](https://supabase.com). O plano gratuito atende à equipe de 2 a 10 pessoas.
- Opcional: [Supabase CLI](https://supabase.com/docs/guides/cli) para aplicar as migrations pelo terminal.

## Instalação

```bash
npm install
cp .env.example .env.local   # no Windows (PowerShell): Copy-Item .env.example .env.local
# edite .env.local com os dados do seu projeto Supabase
npm run dev                  # http://localhost:5173
```

Sem as variáveis configuradas, a aplicação abre uma tela de **Configuração pendente**. Ela não simula dados nem sessões.

## Variáveis de ambiente

| Variável | Onde encontrar | Observação |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | ex.: `https://abcd1234.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → chave **anon / publishable** | Chave pública. A proteção dos dados é feita pelo RLS. |
| `VITE_IMOBILIARIA_NOME` | Opcional | Nome da imobiliária exibido no login (ex.: "Imobiliária Exemplo"). Sem ele, os textos ficam genéricos. |

> ⚠️ **Nunca** use a chave `service_role` (ou "secret") em variáveis `VITE_*`. Tudo que começa com `VITE_` é embutido no JavaScript entregue ao navegador. O frontend deste projeto não precisa dessa chave em nenhum momento.

Arquivos `.env*` (exceto `.env.example`) estão no `.gitignore`.

## Configuração do Supabase

1. **Crie o projeto** no Supabase. Para a latência, prefira a região `South America (São Paulo)`.
2. **Desative o cadastro público.** Em *Authentication → Sign In / Providers → Email*, desligue **"Allow new users to sign up"**. Contas passam a ser criadas apenas por um administrador, dentro do Habita. Mesmo que alguém se cadastre, a conta nasce **inativa** e não acessa nenhum dado (veja [Modelo de segurança](#modelo-de-segurança)).
3. **URLs de redirecionamento.** Em *Authentication → URL Configuration*:
   - **Site URL:** a URL de produção (ex.: `https://crm.suaimobiliaria.com.br`).
   - **Redirect URLs:** adicione `http://localhost:5173/redefinir-senha` e `https://SEU-DOMINIO/redefinir-senha`.
4. **Modelo de e-mail (recomendado).** Em *Authentication → Emails → Reset Password*, troque o link para que funcione mesmo quando o e-mail é aberto em outro dispositivo:
   `<a href="{{ .SiteURL }}/redefinir-senha?token_hash={{ .TokenHash }}&type=recovery">Redefinir senha</a>`

   Com o modelo padrão do Supabase (`{{ .ConfirmationURL }}`), a redefinição também funciona, mas o link precisa ser aberto no **mesmo navegador** em que foi solicitado (fluxo PKCE).
5. **Aplique as migrations** (próxima seção). Elas criam tabelas, políticas RLS, funções e o bucket privado `property-images`.
6. **E-mails em produção.** O SMTP padrão do Supabase tem limite baixo de envios. Para uso real, configure um SMTP próprio em *Project Settings → Auth → SMTP*.

## Como executar as migrations

As migrations ficam em `supabase/migrations/`, versionadas e em ordem:

| Arquivo | Conteúdo |
|---|---|
| `…120000_initial_schema.sql` | Extensões, enums, funções de auditoria e autorização, `profiles` |
| `…120100_contacts_owners.sql` | `contacts` (com prevenção de duplicidade) e `owners` |
| `…120200_properties.sql` | `properties`, `property_images` e `property_owners` |
| `…120300_pipeline_leads.sql` | `pipeline_stages` (com as etapas padrão), `leads` e `lead_properties` |
| `…120400_activities_tasks_appointments.sql` | `activities`, `tasks`, `appointments` e o histórico automático |
| `…120500_deals_proposals.sql` | `deals` e `proposals` |
| `…120600_views_functions.sql` | View `lead_overview` e RPCs (`dashboard_metrics`, vínculos, reordenação) |
| `…120700_rls_policies.sql` | Row Level Security de todas as tabelas |
| `…120800_storage.sql` | Bucket privado de fotos e suas políticas |
| `20261021120000_profile_preferences.sql` | Preferências pessoais do usuário (`profiles.preferences`) |
| `20261022120000_sessions_avatars.sql` | Sessão única por conta (`other_active_sessions`, `current_session_active`) e foto de perfil (`profiles.avatar_path`, bucket `avatars`) |
| `20261023120000_deals_reports.sql` | Regras automáticas das negociações (imóvel, lead e histórico), motivo de perda, view `deal_overview` e relatórios (`report_metrics`) |

**Opção A: Supabase CLI (recomendado)**

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

**Opção B: SQL Editor do painel.** Abra cada arquivo **na ordem do nome**, cole o conteúdo no SQL Editor e execute.

**Testar as migrations localmente (sem Docker):**

```bash
npm run test:db
```

Esse comando aplica todas as migrations em um PostgreSQL embutido (PGlite), com uma simulação mínima dos esquemas `auth` e `storage`, e executa 96 verificações de regras e permissões. Ele não substitui um teste em um projeto Supabase real.

### Tipos do banco (opcional)

Os tipos de domínio estão escritos à mão em `src/types/domain.ts` e nos `types.ts` de cada módulo. Depois de vincular o projeto, você pode gerar os tipos oficiais:

```bash
npx supabase gen types typescript --linked > src/types/database.generated.ts
```

## Criar o primeiro administrador com segurança

Nenhum usuário, senha ou chave administrativa fica no código. O primeiro administrador é promovido manualmente, pelo painel do Supabase:

1. Em *Authentication → Users*, clique em **Add user → Create new user**, informe o e-mail do responsável, uma senha forte e marque "Auto Confirm User".
2. O trigger `on_auth_user_created` cria automaticamente o perfil, com papel `corretor` e **inativo**.
3. No **SQL Editor**, execute (troque o e-mail):

   ```sql
   update public.profiles
   set role = 'admin', is_active = true, full_name = 'Nome do Administrador'
   where email = 'admin@suaimobiliaria.com.br';
   ```

   O SQL Editor roda com privilégios administrativos, por isso a trava de alteração de papéis não se aplica nele.
4. Entre no CRM com essa conta.

**Demais usuários:** crie direto no Habita, em *Acessos → Novo acesso* (somente administradores), com uma **senha provisória** (sem depender de e-mail). Na mesma tela é possível **redefinir a senha**, desativar ou **excluir** o acesso de um membro (os registros da pessoa continuam no CRM, sem responsável). Quem recebe uma senha provisória vê um aviso para trocá-la no primeiro acesso.

Essas ações rodam na função de servidor `api/admin/users.ts` (Vercel Function), que usa a chave `SUPABASE_SERVICE_ROLE_KEY` disponível **apenas no servidor da Vercel** (criada pela integração Supabase ↔ Vercel) e confere, a cada pedido, se quem chama é um administrador ativo. Em desenvolvimento local (`npm run dev`) essa função não roda; use `npx vercel dev` para testá-la no computador.

## Comandos

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | Verificação de tipos + build de produção em `dist/` |
| `npm run preview` | Serve o build de produção localmente |
| `npm run typecheck` | Verificação de tipos (TypeScript strict) |
| `npm run lint` | ESLint (inclui regras de hooks do React) |
| `npm test` | Testes unitários (formatação BRL e datas, máscaras, schemas) |
| `npm run test:db` | Testes das migrations e das políticas RLS (PGlite) |
| `npm run check` | Executa todas as verificações acima em sequência |

**Publicação:** o build gera arquivos estáticos (`dist/`). Configure o servidor para devolver `index.html` em rotas desconhecidas (fallback de SPA). Por exemplo: em Netlify, `/* /index.html 200` em `_redirects`; em Vercel, um rewrite de `/(.*)` para `/index.html`. Lembre de cadastrar as variáveis `VITE_*` no provedor.

## Modelo de segurança

- **Sem acesso anônimo:** o papel `anon` não tem privilégio em nenhuma tabela ou função da aplicação.
- **Contas nascem inativas:** todas as políticas exigem `is_active_member()`. Um usuário autenticado mas inativo vê apenas o próprio perfil e uma tela de "acesso pendente".
- **Papéis:**

| Ação | Corretor | Administrador |
|---|:-:|:-:|
| Ver imóveis | ✔ todos | ✔ todos |
| Ver contatos, leads, negociações, agenda e histórico | os seus* | todos |
| Cadastrar imóveis, contatos, leads e compromissos | ✔ | ✔ |
| Editar/mover leads, negociações e compromissos | os seus* | todos |
| Excluir imóveis, contatos e leads | — | ✔ |
| Excluir fotos e atividades | as próprias | todas |
| Relatórios e Marketing | — | ✔ |
| Acessos (criar, liberar, excluir) e funis | — | ✔ |

  \* sob sua responsabilidade ou cadastrados por ele. O código do imóvel é gerado pelo banco e não pode ser alterado.

- **Proteção contra escalonamento:** o trigger `guard_profile_update` impede que alguém altere o próprio papel ou status, e que não administradores alterem os de outros. Isso também garante que sempre reste um administrador ativo.
- **Autoria confiável:** `created_by` é preenchido pelo banco com `auth.uid()` e não pode ser forjado nem alterado.
- **Fotos:** bucket **privado**, limitado a JPG, PNG e WEBP de até 5 MB. O upload só é aceito em `properties/<id de imóvel existente>/`, e a exibição usa URLs assinadas válidas por 1 hora. O banco guarda apenas o caminho do arquivo, nunca o binário.
- **Integridade:** chaves estrangeiras, `check constraints` (valores não negativos, suítes ≤ quartos, orçamento mínimo ≤ máximo, preço obrigatório conforme a finalidade), código de imóvel único e telefone/e-mail de contato únicos.
- **Sessão única por conta:** ao entrar, o Habita verifica se a conta já está aberta em outro dispositivo. Se estiver, a pessoa escolhe entre encerrar a outra sessão e entrar ou cancelar o login (a outra sessão continua aberta). O dispositivo desconectado percebe o encerramento em até 1 minuto (ou ao voltar para a aba) e volta ao login com um aviso.
- **Fotos de perfil:** bucket **privado** `avatars`, recortadas em 320 × 320 px no navegador. Cada pessoa só envia e apaga arquivos da própria pasta (`<id do usuário>/`), e o perfil só pode apontar para ela. A equipe ativa vê as fotos por URLs assinadas.
- **Sessão:** a renovação do token é automática. Se o servidor rejeitar a sessão (expirada ou revogada), o usuário é desconectado e volta ao login com o aviso "Sua sessão expirou".

## Estrutura do projeto

```
src/
  app/            router (rotas lazy), providers, navegação, páginas de erro
  auth/           contexto de sessão, login, recuperação/redefinição de senha, guarda de rotas
  components/
    layout/       AppLayout, Sidebar, Topbar, PageHeader
    ui/           Button, Badge, Card, Modal, ConfirmDialog, DataTable, Pagination, Popover…
    forms/        Field, inputs (moeda, decimal, telefone, CEP), AsyncPicker, busca/filtros
    feedback/     Toast, Alert, EmptyState, ErrorState
  features/
    dashboard/    painel com indicadores reais e gráfico por etapa
    properties/   imóveis: api, schema, fotos, formulário, lista e detalhes
    contacts/     contatos: duplicidade, lista e detalhes
    leads/        leads: lista, funil kanban, detalhes e histórico de atividades
    calendar/     agenda de visitas e reuniões
    settings/     perfil, equipe e funis
    access/       página Acessos (equipe)
    marketing/    landing pages e campanhas de tráfego pago
    deals/        negociações: lista, detalhes, propostas e fechamento
    reports/      relatórios por período e exportação em planilha
    search/       busca global
  hooks/          filtros na URL, debounce, equipe
  lib/            supabase, formatação pt-BR, erros, rótulos, validações (Zod)
  styles/         tokens visuais (Tailwind @theme)
  types/          tipos de domínio
supabase/
  migrations/     SQL versionado
  tests/          testes de migrations e RLS (PGlite)
```

**Identidade visual Habita:** cores centralizadas em `src/styles/index.css` (verde `#142B25` em `--color-brand-*`, menta `#D0F0D8` em `--color-mint`/`--color-accent-*`, neutros em `--color-canvas`, `--color-ink`…), títulos em Manrope e textos em Inter. Os logotipos originais ficam em `assets/`; as versões otimizadas usadas pelo app ficam em `src/assets/brand/`. Nome e slogan estão em `src/app/brand.ts`.

## Módulos da versão inicial

- **Visão geral:** seis indicadores calculados no banco (`dashboard_metrics`), próximos compromissos e tarefas, leads com retorno atrasado ou nos próximos 7 dias, atividades recentes, gráfico de leads por etapa e ações rápidas. Sem registros, mostra estados vazios explicativos e nenhum dado fictício.
- **Imóveis:** listagem com busca (código, título, endereço, bairro, cidade), filtros por finalidade, tipo e situação, paginação e visualização em cartões no celular. O cadastro e a edição cobrem todos os campos, com máscara de moeda e CEP, busca de endereço por CEP (ViaCEP), proprietários vinculados a contatos e fotos com capa. Há página de detalhes com leads interessados e exclusão com confirmação (administradores).
- **Contatos:** busca por nome, telefone ou e-mail, filtro por tipo, cadastro e edição em modal, **alerta de duplicidade** (telefone, WhatsApp ou e-mail) com link para o cadastro existente, e página de detalhes com leads, imóveis como proprietário e histórico.
- **Leads:** lista com filtros (finalidade, etapa, situação, origem, responsável) e **funil Kanban** por arrastar e soltar, mais o menu "Mover para", acessível por teclado e no celular. O formulário associa contato (com cadastro rápido), responsável, orçamento, região, próximo retorno e imóveis de interesse. Na página de detalhes as etapas são clicáveis, e o histórico registra automaticamente a criação, as mudanças de etapa e as visitas, além das atividades manuais.
- **Agenda:** agendamento de visitas e reuniões (lead, imóvel, responsável, duração), lista agrupada por dia e ações para marcar como realizado, editar ou cancelar.
- **Configurações:** perfil e troca de senha e, para administradores, configuração dos funis no banco (renomear, categoria, ativar ou desativar, reordenar, adicionar etapas).
- **Acessos (administradores):** criar acessos com senha provisória, mudar papéis, redefinir senha, desativar e excluir.
- **Marketing (administradores):**
  - **Landing Pages:** até 5 páginas criadas fora do CRM (ex.: Minha Casa, Minha Vida, usados, lançamentos), cada uma com propósito, funil e corretor padrão. O formulário da página envia os leads para `POST /api/public/lead` com o identificador (token) dela; o lead entra na primeira etapa do funil com origem "Landing page", reaproveitando o contato pelo telefone e sem duplicar leads em andamento. O CRM mostra o HTML pronto do formulário (com campo-armadilha contra robôs e repasse dos parâmetros `utm_*`).
  - **Campanhas:** campanhas de tráfego pago (Meta Ads, Google Ads, TikTok Ads…) com situação, período, orçamento, valor investido, impressões e cliques. Os leads com `utm_campaign` igual ao identificador da campanha ficam ligados a ela, e a lista mostra leads, custo por lead, CTR e negócios ganhos.
- **Busca global:** pelo campo do cabeçalho (atalho `Ctrl+K`), em imóveis, contatos e leads.
- **Negociações:** abertas a partir de um lead em andamento (pela lista ou pela página do lead), com imóvel, valor, previsão de fechamento e responsável. Propostas e contrapropostas têm valor, validade, condições e situação, e a proposta aceita define o valor da negociação. Ao marcar como ganha, o imóvel fica vendido ou alugado e o lead vai para a etapa de conclusão. Ao perder (com motivo) ou cancelar, o imóvel volta a ficar disponível se não houver outra negociação em andamento. Tudo fica registrado no histórico do lead.
- **Relatórios:** filtro por período (predefinido ou personalizado) e por funil. Mostram o resumo do período, o funil de conversão pelas etapas percorridas, os leads por origem, os fechamentos por mês, o desempenho por corretor, o tempo médio em cada etapa e os motivos de perda, com exportação em planilha (CSV para Excel).

## Verificações realizadas

Executadas nesta versão:

- `npm run typecheck`: sem erros (TypeScript strict, `noUncheckedIndexedAccess`).
- `npm run lint`: sem erros. Restam 8 avisos de *fast refresh*, que afetam apenas o recarregamento em desenvolvimento.
- `npm test`: 43 testes unitários aprovados.
- `npm run test:db`: 96 verificações de migrations e RLS aprovadas no PGlite. Cobrem papéis, contas inativas, acesso anônimo, duplicidades, normalização, regras de preço, funis, histórico automático, storage, indicadores, negociações, propostas e relatórios.
- `npm run build`: build de produção concluído.
- Revisão visual automatizada (Playwright) em 1440 px e 390 px das principais telas, com estados vazios, modais, validação e menu mobile: sem erros de execução e sem rolagem horizontal. Para isso, as respostas do Supabase foram **interceptadas com listas vazias apenas no ambiente de teste**.

**Ainda não verificado:** a integração com um projeto Supabase real (login, gravação, upload de fotos, e-mails de recuperação de senha), porque não havia credenciais disponíveis. Recomenda-se um teste ponta a ponta após configurar o projeto.

## Limitações conhecidas

- **Gestão de acessos depende da Vercel:** a criação de usuários e a redefinição de senhas usam a função `api/admin/users.ts` e as variáveis `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` do ambiente de produção. Fora da Vercel, crie usuários pelo painel do Supabase.
- **Tarefas:** a tabela `tasks` existe e aparece no painel, mas ainda não há tela para criá-las. O "próximo retorno" do lead cumpre esse papel por enquanto.
- **Kanban:** exibe até 500 leads por funil (os movimentados mais recentemente). Acima disso, use busca e filtros.
- **Fotos:** sem reordenação por arrastar (apenas "definir como capa"). Ao excluir um imóvel, as fotos são removidas do Storage pelo aplicativo antes da exclusão do registro.
- **Busca:** usa `ilike` com índices trigram e não ignora acentos (`São` ≠ `Sao`).
- **Fuso horário:** datas são exibidas no horário de Brasília. O agendamento usa o horário do dispositivo, que se presume estar no mesmo fuso.
- **CEP:** a busca de endereço consulta o serviço público ViaCEP. Se ele estiver indisponível, o preenchimento é manual.
- **Sem modo offline** e sem tema escuro nesta versão.
- **Relatórios:** o funil e o tempo por etapa usam o histórico de atividades. Registros apagados do histórico deixam de ser considerados, e reordenar etapas muda a leitura de leads antigos.
- **Notificações, WhatsApp, portais, contratos e comissões** não foram implementados.

## Próximas etapas

1. Testes ponta a ponta com um projeto Supabase real.
2. Tarefas e lembretes, com central de notificações.
3. Integração com WhatsApp (segunda etapa do projeto).
