# Plano: site público de imóveis

> **Status:** planejado, **não iniciado**. Nada deste plano foi implementado ainda.
> Antes de começar, confirmar os [pontos em aberto](#pontos-em-aberto).

## Objetivo

Cada imobiliária cliente ganha um site público, ligado ao CRM dela, que mostra os imóveis cadastrados. O site tem filtros de busca iguais aos do CRM e um formulário que cria leads direto no funil.

## Decisões já tomadas

| Tema | Decisão |
|---|---|
| Arquitetura | **Opção B:** site separado (Next.js) no mesmo repositório, numa pasta `site/`, publicado como um segundo projeto na Vercel com o domínio do cliente |
| Domínio | Cada cliente usa o próprio domínio |
| Publicação | Imóveis **disponíveis** vão para o site automaticamente, mas o cadastro tem um botão **"Publicar no site"** (ligado por padrão) |
| Endereço | Mostrar **somente bairro e cidade** (e UF) |
| Contato | Botão de WhatsApp **e** formulário "Tenho interesse" que **cria o lead no CRM** |
| Identidade visual | **Não** segue a marca Habita. Cada imobiliária tem a sua própria identidade, configurável |

### Ponto de partida

Cada imobiliária cliente tem a sua própria instalação (um projeto Supabase e um Vercel). O site segue o mesmo modelo: um site por cliente, ligado ao banco do CRM dele. O código é um só, e a identidade visual muda por cliente.

Regra de publicação: um imóvel aparece no site quando `publish_on_site = true` **e** a situação é `disponivel`. Se for vendido, alugado ou reservado, sai do site sozinho. Se voltar a ficar disponível, volta para o site.

---

## Etapa 1 — Banco de dados (novas migrations)

### 1.1 Campo de publicação
- Nova coluna `publish_on_site boolean not null default true` em `properties`.
- Os imóveis que já existem também ficam publicados.

### 1.2 Porta pública só de leitura
- View `site_properties`, filtrada por `publish_on_site = true and status = 'disponivel'`.
- **Campos que o público vê:** código, título, tipo, finalidade, bairro, cidade, UF, preço de venda, preço de locação, condomínio, IPTU, áreas, quartos, suítes, banheiros, vagas, descrição e fotos.
- **Campos que ficam de fora:** rua, número, complemento, CEP, proprietários, `created_by`, leads e negociações.
- A tabela `properties` continua fechada. O público (`anon`) só lê a view.

### 1.3 Fotos
- Uma regra no Storage (bucket `property-images`) que libera para `anon` apenas as fotos de imóveis presentes no site.
- As fotos dos demais imóveis continuam privadas.

### 1.4 Configurações do site — tabela `site_settings` (uma linha por instalação)
- **Identidade:** nome da imobiliária, logo, favicon, cor principal, cor secundária e fonte (escolhida numa lista curta de opções).
- **Contato:** WhatsApp, telefone, e-mail, endereço da loja, CRECI e links de redes sociais.
- **Conteúdo:** título e texto da página inicial, foto de capa e texto "Sobre".
- O público só lê. Só administradores (`is_admin()`) editam.
- Bucket público `site-assets` para o logo, o favicon e a foto de capa.

### 1.5 Recebimento de leads — função `submit_site_lead`
A função só pode ser chamada pelo servidor do site, com `service_role`; não é liberada para `anon`. Ela:
1. Valida nome, telefone (10 ou 11 dígitos), e-mail e mensagem.
2. Reaproveita o contato que tiver o mesmo telefone (`contacts_phone_key` é único) ou cria um contato novo.
3. Cria o lead com `source = 'site'`, na primeira etapa ativa do funil de `venda` ou de `locacao`.
4. Vincula o imóvel de interesse ao lead em `lead_properties`.
5. Registra uma atividade na linha do tempo, por exemplo: "Lead recebido pelo site — imóvel IM-0012".

### 1.6 Testes
Ampliar `supabase/tests/rls.test.mjs` para provar quatro coisas:
- o público não lê `properties`, `contacts` nem `leads`;
- a view não expõe o endereço completo;
- imóveis não publicados ou indisponíveis não aparecem;
- as fotos privadas continuam inacessíveis.

---

## Etapa 2 — Ajustes no CRM

- **Cadastro e edição de imóvel:** botão "Publicar no site", ligado por padrão.
- **Detalhe do imóvel:** selo "No site" ou "Fora do site", com o motivo (ex.: "Fora do site: situação Vendido").
- **Lista de imóveis:** novo filtro "Publicado no site".
- **Configurações:** nova aba **"Site"**, só para administradores, para editar a identidade visual, os contatos e os textos, com envio de logo e capa e prévia das cores. As mudanças aparecem no site sem novo deploy.
- **Leads:** os leads do site aparecem no funil com a origem "Site". Proposta: um selo de destaque para leads novos do site ainda sem corretor responsável.

---

## Etapa 3 — O site (pasta `site/`)

**Tecnologia:** Next.js (React).
- As páginas são montadas no servidor, o que é bom para o Google e gera a prévia com foto no WhatsApp.
- Com cache (revalidação), uma alteração no CRM aparece no site em até cerca de 1 minuto.
- O site reaproveita do CRM os nomes de tipos e finalidades (`src/lib/labels`) e a formatação de preços e áreas (`src/lib/format`).

### Páginas

| Página | Conteúdo |
|---|---|
| `/` Início | Capa com a busca rápida (finalidade, tipo e cidade ou bairro) e imóveis recentes |
| `/imoveis` | Lista com filtros, ordenação e paginação |
| `/imoveis/[código]-[título]` | Galeria de fotos, características, preços, bairro e cidade, botão de WhatsApp e formulário "Tenho interesse" |
| `/contato` | Dados da imobiliária e formulário geral, que também gera lead |
| `/sobre` | Texto institucional (opcional) |
| 404, `sitemap.xml`, `robots.txt` | Para o Google indexar os imóveis |

### Filtros
São os mesmos do CRM (`src/features/properties/api.ts`):
- **Busca por texto:** código, título, bairro e cidade. A rua sai da busca, porque o site não mostra rua.
- **Finalidade:** venda ou locação. Um imóvel `ambos` aparece nos dois, com a mesma regra do CRM.
- **Tipo do imóvel.**
- **Situação:** não entra como filtro, porque o site só mostra disponíveis.

Extras propostos (a confirmar): faixa de preço, quartos (1+, 2+, 3+…), vagas e bairro, este numa lista montada a partir dos imóveis publicados.

Os filtros ficam no endereço da página (ex.: `/imoveis?finalidade=venda&tipo=apartamento`), então uma busca pode ser compartilhada por link.

### Identidade visual por imobiliária
- O site lê `site_settings` e aplica cores, fonte, logo e textos em todas as páginas.
- O layout é neutro, sem nada da marca Habita.

### Formulário de interesse
- **Campos:** nome, telefone, e-mail (opcional), "quero comprar" ou "quero alugar" (só quando o imóvel é `ambos`), mensagem e aceite de LGPD.
- **Proteção contra spam:**
  - Cloudflare Turnstile;
  - um campo-armadilha (honeypot) que só robôs preenchem;
  - um limite de envios por IP.
- O servidor do site chama `submit_site_lead` com a chave secreta. A chave nunca chega ao navegador.

### Segurança e LGPD
- O site tem cabeçalhos de segurança próprios.
- O site libera a indexação no Google. O CRM continua com `noindex`.
- Uma página de política de privacidade, exigida pelo formulário.

---

## Etapa 4 — Implantação por cliente

1. Criar um segundo projeto na Vercel com *root directory* `site/`.
2. Configurar as variáveis de ambiente:
   - URL do Supabase;
   - chave pública (`anon`);
   - `service_role`, só no servidor;
   - chaves do Turnstile.
3. Ligar o domínio do cliente: a Vercel mostra os registros DNS que o cliente cria onde o domínio dele está registrado.
4. Preencher a aba "Site" no CRM com a identidade do cliente.
5. Documentar tudo no README, para repetir em cada novo cliente.

---

## Ordem de entrega

1. Banco: migrations, view, Storage, `submit_site_lead` e testes.
2. Ajustes no CRM: botão de publicação, selo, filtro e aba "Site".
3. Site: listagem com filtros e página do imóvel.
4. Site: formulário de lead com proteção contra spam.
5. Site: SEO (sitemap e prévias) e páginas de início, contato e sobre.
6. README e checklist de implantação.

Cada etapa passa por `npm run check` (tipos, lint, testes, testes de RLS e build) antes de seguir.

---

## Pontos em aberto

1. **Regra de publicação:** confirmar que o imóvel aparece quando o botão está ligado **e** a situação é "Disponível". "Reservado" e "Em negociação" também saem do site?
2. **Chave secreta no site:** o servidor do site guarda a `service_role` do Supabase para criar leads. É o jeito mais seguro de impedir que alguém crie leads sem passar pelo captcha. Confirmar.
3. **Turnstile:** cada cliente com uma conta gratuita na Cloudflare, ou uma conta só servindo todos os domínios?
4. **Filtros extras:** incluir faixa de preço, quartos, vagas e bairro, ou ficar só com os quatro filtros do CRM?
5. **Páginas "Sobre" e "Contato":** entram nesta primeira versão?
