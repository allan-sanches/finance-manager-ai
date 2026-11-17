# Capitalismo Selvagem

Gerenciador de finanças pessoais feito para o celular: lançamentos, cartões, faturas, dívidas, caixinhas de reserva e listas de compras num lugar só, com IA para lançar gastos escritos em linguagem natural e ler extratos, faturas e relatórios de dívida em PDF.

O app é **self-hosted**: você sobe a sua própria instância, com o seu banco de dados e as suas chaves de IA. Não existe servidor central nem cadastro público.

> **Stack:** Next.js (App Router) · React · TypeScript · Tailwind CSS + daisyUI · PostgreSQL + Drizzle ORM · Zustand · Recharts · Vercel AI Gateway / Gemini / DeepSeek

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Privacidade e segurança](#privacidade-e-segurança)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Primeiro acesso e contas](#primeiro-acesso-e-contas)
- [Deploy](#deploy)
- [Instalar no celular](#instalar-no-celular)
- [Scripts](#scripts)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

---

## Funcionalidades

### Início (dashboard)
- Saldo do mês, entradas e saídas, com o previsto (contas fixas e faturas a vencer) separado do que já aconteceu.
- Blocos de **limite livre** dos cartões, **guardado** nas caixinhas, **dívidas** e **lançamentos**, cada um expansível.
- Gráficos de gastos do mês por categoria e de entradas × saídas dos últimos 6 meses.
- Busca global em lançamentos, cartões, caixinhas, dívidas e listas.
- Filtro por banco/conta.
- Saudação pelo nome ("Bom dia, Ana"), no horário de Brasília.

### Transações
- Visão mês a mês, com o que já foi pago e o que está previsto.
- Receitas e despesas com categoria, forma de pagamento (dinheiro, débito, crédito, Pix, transferência), banco, cartão, status de pago e **conta fixa** (repete todo mês).
- **Movimentações** entre contas e caixinhas, que ficam fora das entradas e saídas.
- Edição rápida e marcação de pago com um toque.

### Cartões
- Limite, dia de fechamento e de vencimento de cada cartão.
- Histórico de **faturas** (fechamento, vencimento, valor e pagamento) e cálculo da fatura atual com as compras novas.
- **Limite garantido por CDB/caixinha**: o cartão pode ter o limite vinculado a uma reserva.
- Contas bancárias com saldo e data do saldo.

### Dívidas
- Lista de dívidas com credor, modalidade, valor em dia e vencido.
- Status personalizáveis (ex.: "Em negociação", "Abandonada") e escolha de quais status entram no dashboard.
- Importação a partir do **Registrato (SCR do Banco Central)** e do **Serasa**, com conferência dos totais.

### Caixinhas (metas e reservas)
- Meta, valor guardado, prazo e instituição.
- Rendimento em **% do CDI**, projetado com o CDI atual e as expectativas da Selic do boletim Focus (dados públicos do Banco Central).
- Caixinhas em **dólar** com taxa fixa ao ano, convertidas pela PTAX do dia.
- **Aporte mensal** planejado, para ver quando a meta será atingida.
- Aplicações com vencimento (time deposits) e prazo de resgate.
- Depósitos e retiradas que viram movimentações nas transações.

### Lista de compras e lista de desejos
- **Compras da casa:** itens com preço estimado e checkbox.
- **Desejos:** prioridade, foto, link da loja e **histórico de preço**.
- **Acompanhamento automático de preço:** o servidor lê de novo o preço dos links a cada 6 horas e mostra o que ficou mais barato. Produtos do Mercado Livre usam a API oficial.

### Entrada por IA
- Escreva do seu jeito, por exemplo *"Gastei 45 reais no iFood ontem à noite no crédito"*. A IA preenche valor, data, categoria, forma de pagamento e cartão, e você revisa antes de salvar.

### Assistente Marx
- Chat sobre as suas finanças: pergunte quanto gastou com algo, onde dá para economizar ou como está a fatura.
- Lança **vários gastos de uma vez** a partir de uma mensagem, sempre com confirmação antes de gravar.
- Conhece cotações do dia (dólar, euro, bitcoin) e taxas do Banco Central.
- Você escolhe o modelo no próprio chat (GPT-4.1 mini, GPT-5 mini, Gemini 2.5 Flash Lite, DeepSeek V3.1).

### Importar arquivos
- **Extrato bancário em OFX ou CSV:** leitura local, **sem IA** (reconhece os formatos de vários bancos).
- **Extrato e fatura em PDF ou prints:** lidos pela IA.
- **Registrato e Serasa:** importam as dívidas.
- Nada é gravado antes de você revisar; lançamentos repetidos são detectados.

### Configurações e perfil
- Categorias personalizadas (emoji e cor) e categorias ocultas.
- Escolha do provedor de IA (Vercel AI Gateway, Gemini ou DeepSeek).
- Nome, e-mail de acesso e troca de senha.
- O administrador cria contas para outras pessoas e redefine senhas. Cada conta só enxerga os próprios dados.

### Experiência
- **Mobile first:** barra de abas no rodapé, cards empilhados e alvos de toque grandes.
- **Instalável (PWA)**, com página offline.
- Tema claro/escuro seguindo o sistema, com troca manual.
- **Modo privado:** o "olho" dos apps de banco esconde todos os valores (`R$ ••••`), por aparelho.

---

## Privacidade e segurança

Este é um app de dados financeiros. As decisões abaixo existem para que eles não vazem.

**O que o app faz para proteger os dados**
- **Isolamento por conta:** toda consulta ao banco filtra pelo usuário da sessão. Os dados nunca vêm do que o navegador diz ser. Há testes automatizados que garantem que uma conta não lê nem altera dados de outra.
- **Senhas** guardadas com scrypt e salt. O login gasta o mesmo tempo para e-mails que existem e que não existem, e tem limite de tentativas por IP e por conta.
- **Sessão** em cookie `httpOnly` assinado com HMAC (`SESSION_SECRET`). Server Actions e rotas de API conferem a sessão em toda chamada.
- **Trocar a senha desconecta os outros aparelhos:** cada conta tem uma versão de sessão que sobe a cada troca ou redefinição de senha, e cookies com versão antiga deixam de valer. Quem trocou continua logado no aparelho que usou. Quando o admin redefine a senha de alguém, essa pessoa sai de todos os aparelhos.
- **Chaves de IA só no servidor:** nenhuma variável sensível usa `NEXT_PUBLIC_`, e a IA é chamada por rotas do próprio app (proxy). A resposta da IA é validada com schemas antes de chegar à tela.
- **PDFs são limpos antes da IA:** nome e CPF são removidos do texto antes de qualquer envio.
- **Logs sem dados financeiros:** respostas da IA não são registradas.
- **Proteção contra SSRF:** a leitura de links da lista de desejos bloqueia endereços internos, como `localhost`, redes privadas e o metadata da nuvem, inclusive via DNS rebinding.
- **Cabeçalhos de segurança:** o app não abre em iframe de outro site, não envia `Referer` para fora e exige HTTPS (HSTS).

**O que você precisa saber ao usar IA**
- Quando você usa a entrada por IA, a importação de PDF/prints ou o Marx, o texto (e, no Marx, um **resumo das suas finanças**) é enviado ao provedor de IA configurado. Leia a política de retenção do provedor. No Vercel AI Gateway, `AI_GATEWAY_ZERO_DATA_RETENTION=true` restringe o uso a provedores com retenção zero.
- OFX e CSV são lidos no próprio servidor, sem IA.

**Recomendações para a sua instância**
- Gere um `SESSION_SECRET` aleatório de pelo menos 32 caracteres e nunca o commite.
- Troque a senha inicial (`APP_PASSWORD`) no primeiro acesso.
- Rode sempre atrás de HTTPS.
- O limite de tentativas fica em memória, por instância. Com várias réplicas, use um store compartilhado (ex.: Redis).
- Se um aparelho for perdido, troque a senha da conta: as sessões abertas nele caem. Para derrubar as sessões de **todas** as contas de uma vez, troque o `SESSION_SECRET`.

**Encontrou uma vulnerabilidade?** Não abra uma issue pública. Use o [aviso privado de segurança do GitHub](../../security/advisories/new) deste repositório.

---

## Como rodar localmente

**Pré-requisitos:** Node.js 20.9 ou mais novo (recomendado 22 LTS) e um PostgreSQL 14+.

```bash
# 1. Clone e instale
git clone https://github.com/allan-sanches/finance-manager-ai.git
cd finance-manager-ai
npm install

# 2. Suba um Postgres (exemplo com Docker)
docker run -d --name finance-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=finance postgres:17

# 3. Configure o ambiente
cp .env.example .env.local
# edite .env.local: DATABASE_URL, APP_PASSWORD, SESSION_SECRET e pelo menos uma chave de IA

# 4. Crie as tabelas
npm run db:migrate

# 5. Rode
npm run dev
```

Abra <http://localhost:3000> e entre com o e-mail em branco e a senha de `APP_PASSWORD` (veja [Primeiro acesso](#primeiro-acesso-e-contas)).

> O `npm run db:migrate` lê a `DATABASE_URL` do ambiente. Se ela estiver só no `.env.local`, rode `node --env-file=.env.local scripts/migrate.mjs`.

Para gerar o `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

---

## Variáveis de ambiente

Todas estão documentadas em [`.env.example`](.env.example). Nenhuma deve ter o prefixo `NEXT_PUBLIC_`.

| Variável | Obrigatória | Para que serve |
| --- | --- | --- |
| `DATABASE_URL` | sim | Conexão com o PostgreSQL. |
| `SESSION_SECRET` | sim | Assina os cookies de sessão. Mínimo de 32 caracteres. Trocar derruba todas as sessões. |
| `APP_PASSWORD` | sim | Senha inicial da conta administradora, até ela definir a própria senha. |
| `AI_PROVIDER` | não | Provedor de IA padrão: `gateway` (padrão), `gemini` ou `deepseek`. |
| `AI_GATEWAY_API_KEY` | para IA | Chave do [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). Necessária para o Marx. Funciona fora da Vercel. |
| `AI_GATEWAY_MODEL` | não | Modelo de extração no gateway (padrão `openai/gpt-5-mini`). |
| `MARX_MODEL` | não | Modelo padrão do Marx (um dos ids de [`lib/marx/models.ts`](lib/marx/models.ts)). |
| `AI_GATEWAY_ZERO_DATA_RETENTION` | não | `true` usa só provedores com retenção zero (exige plano pago do gateway). |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | não | Para usar o Google Gemini direto. |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` | não | Para usar o DeepSeek direto. |
| `PRICE_WATCH` | não | `off` desliga a leitura automática de preços (que só roda em produção). |
| `CRON_SECRET` | não | Permite chamar `POST /api/cron/prices` de um agendador externo com `Authorization: Bearer <CRON_SECRET>`. |
| `MERCADOLIVRE_CLIENT_ID` / `MERCADOLIVRE_CLIENT_SECRET` | não | Credenciais de um app em [developers.mercadolivre.com.br](https://developers.mercadolivre.com.br) para ler preços do Mercado Livre. |

Sem chave de IA, o app funciona normalmente. Só ficam indisponíveis a entrada por IA, a leitura de PDF/prints e o Marx.

---

## Primeiro acesso e contas

1. Na primeira vez, entre com o **e-mail em branco** e a senha definida em `APP_PASSWORD`. Essa é a conta administradora.
2. Em **Perfil**, cadastre o seu e-mail e troque a senha. A partir daí, o login passa a ser por e-mail e a `APP_PASSWORD` deixa de valer para essa conta.
3. Ainda em **Perfil**, o administrador pode **criar contas** para outras pessoas (com senha inicial) e **redefinir senhas** de quem esqueceu. Cada conta tem os próprios dados, sem compartilhamento.

Não há cadastro público: só o administrador cria contas.

---

## Deploy

Qualquer serviço que rode Node.js e tenha PostgreSQL serve. O processo é o mesmo em todos:

1. Configure as variáveis de ambiente obrigatórias.
2. Rode `npm run db:migrate` antes de cada deploy (aplica migrações novas; é seguro rodar de novo).
3. `npm run build` e `npm run start`.
4. Use `/api/health` como healthcheck (responde `{ ok: true }` quando o banco está acessível).

### Railway

O repositório já traz a configuração em [`.railway/railway.ts`](.railway/railway.ts): build com Railpack, migração no pre-deploy e healthcheck. Num fork, troque o repositório em `github("…")` pelo seu, crie um serviço Postgres e defina `DATABASE_URL=${{Postgres.DATABASE_URL}}`.

### Leitura automática de preços

Em produção, o servidor agenda sozinho a leitura dos preços a cada 6 horas. Em plataformas serverless, onde não existe processo contínuo, use um agendador externo (cron) chamando `POST /api/cron/prices` com `Authorization: Bearer <CRON_SECRET>`.

---

## Instalar no celular

O app é um PWA. Abra o endereço da sua instância no navegador do celular e:

- **Android (Chrome):** menu ⋮ → *Instalar app* / *Adicionar à tela inicial*.
- **iPhone (Safari):** botão compartilhar → *Adicionar à Tela de Início*.

---

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (Turbopack). |
| `npm run build` / `npm run start` | Build e servidor de produção. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | Checagem de tipos do TypeScript. |
| `npm test` | Testes com Vitest (o banco de teste usa PGlite em memória, sem precisar de Postgres). |
| `npm run db:generate` | Gera uma migração nova a partir de [`lib/db/schema.ts`](lib/db/schema.ts). |
| `npm run db:migrate` | Aplica as migrações de [`drizzle/`](drizzle/). |

---

## Estrutura do projeto

```
app/                 Páginas (App Router), Server Actions e rotas de API
  api/chat/          Entrada por IA (extração de um lançamento)
  api/marx/          Assistente Marx
  api/import/        Leitura de extratos, faturas, Registrato e Serasa
  api/cron/prices/   Rotina de acompanhamento de preços
  api/cdi, api/dolar Dados públicos do Banco Central
  actions/           Server Actions (login e operações financeiras)
components/          Componentes de interface (daisyUI)
lib/                 Regras de negócio, IA, importação, sessão e segurança
  db/                Schema Drizzle e repositório (todo acesso filtra por usuário)
  import/            Parsers de OFX, CSV e PDF; redação de dados pessoais
  marx/              Prompt, contexto financeiro e modelos do assistente
types/finance.ts     Tipos de domínio (Transaction, CreditCard, SavingsGoal…)
drizzle/             Migrações SQL
public/              Service worker, página offline e imagens
```

Os nomes no código são em inglês (`amount`, `paymentMethod`, `dueDate`…), e os textos da interface, em português.

---

## Contribuindo

Contribuições são bem-vindas. Antes de abrir um PR:

```bash
npm run lint && npm run typecheck && npm test
```

- Mantenha o padrão: código em inglês, interface em PT-BR, mobile first.
- Toda leitura ou escrita no banco recebe o `userId` da sessão. Nunca confie em ids vindos do cliente sem filtrar por usuário.
- Chaves e segredos só em variáveis de ambiente do servidor.
- Não inclua dados reais (extratos, faturas, CPFs) em testes ou issues. Use dados fictícios.

---

## Licença

[MIT](LICENSE).
