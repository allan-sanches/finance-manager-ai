# Diretrizes de Segurança — finance-manager-ai

> **Obrigatório:** segurança faz parte de toda tarefa. Nunca simplificar nem acelerar uma entrega
> abrindo mão dela. **Se um pedido conflitar com estas regras, pare e explique o risco antes de seguir.**

O app guarda a vida financeira de pessoas reais: saldos, faturas, extratos e dívidas do SCR/Serasa.
O pior cenário é dado de uma conta aparecer para outra (ou sair do servidor). Logo depois vem custo
descontrolado de IA.

Vale para qualquer mudança em autenticação, Server Actions, Route Handlers, banco, IA, importação,
integrações externas, variáveis de ambiente ou deploy.

---

## 1. O que já existe e não pode regredir

| Camada | Onde | O que garante |
|---|---|---|
| Sessão | `lib/session.ts` | Cookie `fm_session` = `userId.versão.expira.hmac` (HMAC-SHA256 com `SESSION_SECRET` ≥ 32 caracteres). httpOnly, secure em produção, sameSite=lax, 30 dias. |
| Primeira barreira | `proxy.ts` | Sem banco: confere só a assinatura. Públicas: `/login`, `/api/health`, `/api/cron/prices`, `/api/ai-spend`. |
| Barreira real | `lib/auth.ts` | `getSessionUserId` confere a `sessionVersion` no banco (troca de senha derruba os outros aparelhos). `requireUserId` em toda página e Server Action. |
| Isolamento | `lib/db/repository.ts` | Toda função recebe o `userId` da sessão e filtra com `own*(userId, id)`. IDs de cartão, conta e caixinha vindos do cliente passam por `existing*Id`. |
| Senhas | `lib/password.ts`, `lib/account.ts` | scrypt (N=2^15) com salt. Hash falso quando o e-mail não existe, para o tempo de resposta não revelar quem tem conta. |
| Força bruta | `app/actions/auth.ts` | 5 tentativas/min por IP + 10 a cada 15 min por conta. |
| Admin | `app/perfil/actions.ts` | `requireAdmin` lê `users.isAdmin` no banco. Não existe cadastro público. |
| IA | `lib/ai*.ts`, `lib/gemini.ts`, `lib/deepseek.ts` | Chaves só no servidor. Saída estruturada, revalidada com Zod. |
| SSRF | `lib/product-fetch.ts` | Só http(s) nas portas 80/443. IP checado no lookup do socket (barra DNS rebinding). Redirecionamentos revalidados. Limite de tempo e tamanho. |
| Cabeçalhos | `next.config.ts` | X-Frame-Options, CSP `frame-ancestors`, nosniff, Referrer-Policy, Permissions-Policy, HSTS. |
| Cron | `lib/price-watch-secret.ts` | Bearer comparado em tempo constante. |
| Gasto com IA | `lib/ai-spend-token.ts` | Bearer (`AI_SPEND_TOKEN`) comparado em tempo constante; sem a variável, a rota responde 404. Só somas do app, sem dado de usuário. |

---

## 2. Princípios

- Menor privilégio em tudo: sessão, banco, chaves, rotas.
- O navegador não é fronteira de segurança. Botão escondido, página protegida ou redirect no
  cliente não autorizam nada.
- Toda operação sensível é validada e autorizada no servidor.
- Na dúvida sobre a autorização, **negar** (fail closed).
- Nunca desligar um controle existente para uma feature funcionar.

---

## 3. Autenticação e autorização

- **Toda Server Action é um endpoint público.** Começa por `requireUserId()` (ou passa por `run()`
  em `app/actions/finance.ts`), mesmo que a tela já esteja atrás do login.
- **Todo Route Handler** chama `getSessionUserId()` no início e responde 401 se vier `null`.
  Não confiar só no `proxy.ts`: ele não confere a versão da sessão.
- Rota pública nova só entra em `PUBLIC_PATHS` com motivo escrito no comentário e proteção própria
  (como o Bearer do cron).
- O `userId` vem **sempre** da sessão. Nunca de body, query, FormData ou resposta da IA.
- Gravações de dados financeiros passam por `run(actor, …)`: o `actor` impede gravar na conta errada
  quando a sessão mudou em outra aba.
- `isAdmin` nunca vem de input. Nenhum fluxo deixa a pessoa mudar o próprio `isAdmin`.
- Trocar ou redefinir senha sobe a `sessionVersion` (`setUserPassword`). Nenhum caminho novo pode
  mudar a senha sem isso.
- A mensagem de login é sempre genérica ("E-mail ou senha incorretos").
- Redirect depois do login só via `safeRedirectPath` (evita open redirect).

---

## 4. Isolamento de dados (no lugar do RLS)

Não usamos Supabase: o Postgres da Railway não é exposto ao navegador, e o isolamento entre pessoas
acontece no código do repositório. Por isso estas regras são críticas:

- Tabela nova de dados tem `user_id NOT NULL` com FK `on delete cascade` (helper `userId()` em
  `lib/db/schema.ts`) e índice.
- **Toda** query filtra pelo dono. Use ou crie um helper `own*(userId, id)`. UPDATE ou DELETE sem
  filtro de dono é bug crítico.
- IDs de referência vindos do cliente (cartão, conta, caixinha…) são conferidos contra o dono antes
  de gravar. A FK sozinha **não** protege: ela aceita a linha de outra pessoa.
- Schemas de entrada nunca aceitam `userId`, `isAdmin`, `sessionVersion`, `passwordHash` ou
  `createdAt` (mass assignment). Os schemas de patch listam só os campos permitidos.
- Rotina sem sessão que lê várias contas (cron) grava usando o `userId` da própria linha lida.
- O snapshot enviado ao navegador remove `userId` e nunca inclui nada da tabela `users`.
- **Teste obrigatório:** todo método novo do repositório ganha um caso no bloco
  `isolamento entre usuários` de `lib/db/repository.test.ts` (ler, alterar e apagar dado de outra
  pessoa pelo id; usar id de cartão/conta/caixinha de outra pessoa).
- RLS no Postgres é defesa em profundidade opcional (exigiria `SET app.user_id` por transação).
  Não substitui o filtro no código.

---

## 5. Validação de entrada e saída

- Zod em toda fronteira: Server Actions (`lib/finance-schemas.ts`), Route Handlers, respostas da IA
  e de APIs externas (Banco Central, Mercado Livre).
- Tudo com limite: strings com `max`, arrays com `max` (`MAX_IMPORT_ROWS`), números finitos com
  faixa, arquivos de até 5 MB e no máximo 8 imagens. Upload é lido com teto
  (`readLimitedFormData` em `lib/request-body.ts`), nunca com `request.formData()` direto: o corpo
  grande é recusado sem ser carregado inteiro na memória.
- Erros: mensagem amigável na tela; detalhe só no `console.error` do servidor. Nunca devolver stack,
  erro do Postgres ou corpo da resposta do provedor de IA.
- Devolver só o necessário (DTO). Proibido spread de linha do banco ou de resposta da IA.

---

## 6. IA: chaves, custo e prompt injection

- `AI_GATEWAY_API_KEY`, `GEMINI_API_KEY` e `DEEPSEEK_API_KEY` só no servidor, nunca com
  `NEXT_PUBLIC_`. Arquivo que lê chave tem `import 'server-only'`.
- Ordem em toda rota de IA: autenticação → rate limit → validação de tamanho → chamada ao provedor.
- **Rate limit da IA é por `userId`, não por IP**: o `X-Forwarded-For` pode ser forjado pelo
  cliente. Considerar também uma cota diária por conta.
- A saída é sempre estruturada (schema JSON) e revalidada com Zod. IDs que a IA devolver (cartão,
  conta, caixinha, categoria) são conferidos contra os do usuário (`parseMarxReply`).
- Documento importado e mensagem do chat são **dados não confiáveis** (podem carregar prompt
  injection). A IA só monta uma **prévia**. Gravar exige confirmação do usuário por Server Action,
  que valida tudo de novo. A IA nunca grava direto nem escolhe o `userId`.
- O contexto do Marx sai do banco pela sessão, nunca do que o navegador manda.
- Mandar o mínimo de dado pessoal para o provedor: `redactPersonalIds` no texto de PDF; nada de
  e-mail, CPF ou nome completo. Preferir provedores com retenção zero
  (`AI_GATEWAY_ZERO_DATA_RETENTION`) quando o plano permitir.
- Falha do provedor: mensagem genérica para o usuário; no log, status e trecho curto, nunca a chave.

---

## 7. Requisições do servidor para fora (SSRF)

- Toda busca de URL digitada pelo usuário passa por `lib/product-fetch.ts`
  (`assertFetchableUrl` + `safeLookup`). Proibido `fetch()` direto com URL vinda do usuário.
- URLs fixas de terceiros (Banco Central, Mercado Livre) usam timeout e validam a resposta com Zod.
- Busca disparada pelo usuário tem rate limit por conta (`lookupProduct`).

---

## 8. Segredos e variáveis de ambiente

- Segredos só nas variáveis da Railway e no `.env.local` (o `.gitignore` ignora `.env*`). O
  `.env.example` traz só nomes e comentários, nunca valores reais.
- `NEXT_PUBLIC_` só para valor que pode ser público. Hoje nenhum segredo usa esse prefixo.
- `SESSION_SECRET` com pelo menos 32 caracteres aleatórios. Trocar derruba todas as sessões e muda
  o segredo derivado do cron.
- `APP_PASSWORD` é só a senha inicial do owner. Depois que ele troca a senha no perfil, ela deixa de
  valer e pode ser removida da Railway.
- Banco e chaves separados para dev e produção.
- Suspeita de vazamento: rotacionar na hora e revisar o histórico do git.

---

## 9. Navegador e front-end

- Produção roda `next build` + `next start` (`.railway/railway.ts`). `next dev` nunca fica exposto.
- Nada sensível em `localStorage`/`sessionStorage`. Hoje só ficam lá o tema, o modo privacidade e
  o modelo escolhido do Marx. Dado financeiro fica no servidor e na memória do store.
- O service worker (`public/sw.js`) não guarda dado financeiro em cache, só a página offline e o
  ícone. Não mudar isso.
- `dangerouslySetInnerHTML` é proibido com conteúdo dinâmico. O único uso é o script fixo do tema.
- Cookie novo: httpOnly, secure em produção, sameSite `lax` ou `strict`.
- Os cabeçalhos de `next.config.ts` não podem ser removidos. CSP com `script-src` é melhoria pendente.
- Server Actions têm checagem de Origin do Next contra CSRF. Não afrouxar
  (`serverActions.allowedOrigins`) sem motivo documentado.

---

## 10. Proteção de dados (LGPD)

- Dado financeiro e relatório SCR/Serasa são tratados como dado pessoal sensível: coletar só o
  necessário para o app funcionar.
- **Logs nunca levam** valores, descrições de lançamento, conteúdo de documento, mensagens do chat
  ou e-mails. Só ids, status e códigos de erro.
- Arquivo importado não fica guardado: é processado em memória e descartado.
- Apagar um usuário apaga os dados dele (FK com cascade).
- Print e PDF enviados à IA vão para um provedor externo. A tela deve deixar isso claro.

---

## 11. Abuso e monitoramento

Limites atuais (em memória, `lib/rate-limit.ts`):

| Operação | Limite |
|---|---|
| Login | 5/min por IP + 10 a cada 15 min por conta |
| Troca de senha | 5/min por conta |
| Extração por IA (`/api/chat`) | 10/min por conta |
| Marx (`/api/marx`) | 20/min por conta |
| Importação (`/api/import`) | 10/min por conta |
| Busca de produto | 20/min por conta |
| Atualizar preço na hora | 30/h por conta |

- O limitador em memória só funciona porque há **1 réplica** (`.railway/railway.ts`). Ao escalar,
  trocar por um store compartilhado (Postgres ou Redis).
- Ação de admin (criar conta, redefinir senha) gera log com o id do admin e o da conta alvo.

---

## 12. Dependências e infraestrutura

- `npm audit` antes de deploy relevante. Vulnerabilidade high ou critical se corrige antes de subir.
- Next.js e React sempre na última versão (regra do projeto).
- Pacote novo: conferir manutenção, uso e advisories. Preferir o que já está instalado.
- Postgres acessado pela rede privada da Railway. Proxy TCP público desligado se não for usado.
- Ideal: o app conecta com um role sem DDL e sem superusuário; a migração usa role próprio no
  `preDeploy`.
- Push em `main` faz deploy direto. Antes do push: `npm run typecheck`, `npm run lint` e
  `npm test` (ou um CI que bloqueie o deploy).

---

## 13. Testes de segurança obrigatórios

| Cenário | Esperado | Onde já há teste |
|---|---|---|
| Sem login | 401 na API, redirect para `/login` nas telas | `app/api/chat/route.test.ts` |
| Token adulterado, expirado ou de outro segredo | Rejeitado | `lib/session.test.ts` |
| Senha trocada em outro aparelho | Sessão antiga cai | `app/api/chat/route.test.ts` |
| Ler, alterar ou apagar dado de outra pessoa pelo id | Nada acontece | `lib/db/repository.test.ts` |
| Usar id de cartão/conta/caixinha de outra pessoa | Referência descartada | `lib/db/repository.test.ts` |
| Pessoa comum chama ação de admin | Recusado | falta |
| Requisição direta à API, sem passar pela tela | Mesma autorização | (por construção) |
| Rajada de requisições, inclusive trocando o `X-Forwarded-For` | 429 | `app/api/chat/route.test.ts` |
| Entrada inválida ou grande demais | 400/413, sem stack | `app/api/import/route.test.ts`, `lib/request-body.test.ts` (parcial nas outras rotas) |
| URL interna no link do desejo (127.0.0.1, 169.254…) | Recusado | `lib/product-fetch.test.ts` (DNS rebinding sem teste) |

Use testes automatizados sempre que der. **Não afirmar que um controle está validado sem teste ou
inspeção que mostre isso.**

---

## 14. Fluxo de trabalho

**Antes:** identificar dados, tabelas, rotas e permissões afetados; pensar em como alguém acessaria
dado alheio, escalaria privilégio ou geraria custo.

**Durante:** seguir a arquitetura da seção 1; validar toda entrada; autorizar no servidor; nunca
mandar segredo ao cliente; aplicar limite onde houver custo ou chamada externa.

**Depois:** rodar typecheck, lint e testes; testar o acesso negado; conferir o diff atrás de
segredos e de logs com dados pessoais; relatar riscos que ficaram abertos.

---

## 15. Checklist antes de dar como pronto

- [ ] Autenticação exigida (`requireUserId` / `getSessionUserId`).
- [ ] Toda query filtra pelo dono; ids de referência conferidos.
- [ ] Teste de isolamento entre usuários para o que é novo.
- [ ] Entradas validadas com Zod e com limite de tamanho.
- [ ] Nenhum segredo no cliente nem no git.
- [ ] Rate limit por conta em operação cara ou externa.
- [ ] Permissão de admin conferida no servidor.
- [ ] Erros sem detalhe interno; logs sem dados pessoais.
- [ ] typecheck, lint e testes passando.

---

## 16. Regras inegociáveis

1. O front-end nunca é fronteira de segurança.
2. Nunca expor segredo ou chave de API.
3. Nunca escrever query sem filtro de dono para "resolver" um problema de acesso.
4. Nunca conceder admin a partir de dado controlado pelo usuário.
5. Nunca deixar alguém acessar recurso que não é seu.
6. Nunca rodar servidor de desenvolvimento como produção.
7. Nunca remover proteção existente em silêncio.
8. Nunca afirmar que algo foi validado sem evidência.
