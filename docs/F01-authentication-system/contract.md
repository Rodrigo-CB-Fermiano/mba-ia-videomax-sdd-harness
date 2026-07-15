# Contrato de Comportamento: F01 - Sistema de Autenticação

Este contrato descreve a promessa testável da feature F01 em linguagem agnóstica de implementação. O conteúdo é derivado exclusivamente dos critérios de aceitação do PRD (Seção 9). Refatorações de implementação não afetam este contrato.

---

## Prerequisites

### Persistent state
- PostgreSQL database acessível em `DATABASE_URL`. As tabelas `User`, `Account`, `VerificationToken` e `LoginAttempt` existem com o schema exato da spec (migração Prisma aplicada via `prisma migrate dev`).
- Nenhum usuário pré-semeado existe no banco de dados (os testes criam e limpam seus próprios dados).

### Static inputs
- `e2e/fixtures/test-user.json` — objeto `{ "email": "...", "name": "...", "password": "..." }` com senha satisfazendo a regra de 8+ caracteres e ao menos 1 número. Usado por testes E2E que iniciam a partir de um estado já autenticado.

### Configuration
- `NEXTAUTH_SECRET` — string aleatória de ao menos 32 caracteres.
- `NEXTAUTH_URL` — `http://localhost:3000` no ambiente de teste.
- `DATABASE_URL` — connection string PostgreSQL apontando para o banco de testes.
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` — qualquer valor não-vazio é aceitável nos testes unitários (testes E2E de OAuth podem usar stub do provider).
- `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` — idem ao Google.
- `SMTP_HOST`, `SMTP_PORT`, `EMAIL_FROM` — apontando para servidor SMTP local (Mailpit) para testes E2E de entrega de email.

### Runtime services
*(responsabilidade do contract evaluator)*
- PostgreSQL acessível em `DATABASE_URL`.
- Mailpit SMTP na porta 1025, web UI na porta 8025.
- Next.js dev server rodando em `http://localhost:3000`.

### External dependencies
*(responsabilidade do contract evaluator)*
- App Google OAuth com callback `http://localhost:3000/api/auth/callback/google` (pode ser stubado nos testes E2E).
- App GitHub OAuth com callback `http://localhost:3000/api/auth/callback/github` (pode ser stubado nos testes E2E).

---

## Superfícies de Verificação

| Superfície | Descrição | Como Verificar |
|-----------|-----------|---------------|
| Página `/login` | Formulário de login com email, senha e botões sociais | GET /login → renderiza formulário |
| Página `/register` | Formulário de registro com nome, email e senha | GET /register → renderiza formulário |
| Página `/reset-password` | Formulário de solicitação de reset por email | GET /reset-password → renderiza formulário |
| Página `/reset-password/confirm` | Formulário de nova senha após clicar no link | GET /reset-password/confirm?token=X → renderiza formulário |
| Página `/library` | Rota protegida; destino pós-login | GET /library com sessão → 200; sem sessão → redirect /login |
| Cookie de sessão | JWT HTTP-only após autenticação bem-sucedida | Cookie `next-auth.session-token` presente e HTTP-only |
| Email de reset | Email enviado após solicitar recuperação | Caixa de entrada SMTP contém link com token |

---

## Itens do Contrato (GTW)

### GTW-01 — Registro com dados válidos cria conta e redireciona para a biblioteca

**Dado** que o usuário acessa `/register`
**Quando** preenche nome, email único e senha com 8+ caracteres incluindo ao menos 1 número, e submete o formulário
**Então** uma conta é criada, o usuário é autenticado automaticamente e redirecionado para `/library`

**Critério de Aceitação:** F01-AC01

---

### GTW-02 — Login com credenciais corretas redireciona para a biblioteca

**Dado** que o usuário possui conta cadastrada e acessa `/login`
**Quando** informa email e senha corretos e submete o formulário
**Então** é autenticado e redirecionado para `/library`, com cookie de sessão HTTP-only presente na resposta

**Critério de Aceitação:** F01-AC02

---

### GTW-03 — Login com senha incorreta exibe mensagem genérica sem revelar qual campo é inválido

**Dado** que o usuário acessa `/login`
**Quando** informa um email existente e uma senha incorreta
**Então** a mensagem "Email or password is incorrect." é exibida, sem indicar se o email ou a senha está errado, e nenhum redirect ocorre

**Critério de Aceitação:** F01-AC03

---

### GTW-04 — Cinco tentativas consecutivas falhas bloqueiam a conta por 15 minutos

**Dado** que o usuário faz 5 tentativas de login com credenciais inválidas consecutivas para o mesmo email
**Quando** tenta realizar a 5ª (ou qualquer tentativa subsequente dentro de 15 minutos)
**Então** a mensagem "Too many attempts. Try again in 15 minutes." é exibida e o login é bloqueado, mesmo com a senha correta

**Critério de Aceitação:** F01-AC04

---

### GTW-05 — Fluxo OAuth com Google cria conta na primeira vez e reutiliza na segunda

**Dado** que o usuário clica em "Continuar com Google" na página `/login`
**Quando** autoriza o acesso na tela do Google (primeira vez)
**Então** uma nova conta é criada automaticamente e o usuário é redirecionado para `/library`

**E dado** que o mesmo usuário repete o fluxo OAuth com o mesmo email Google
**Quando** autoriza o acesso na tela do Google (segunda vez)
**Então** a conta existente é reconhecida e o usuário é redirecionado para `/library` sem criar duplicata

**Critério de Aceitação:** F01-AC05

---

### GTW-06 — Fluxo OAuth com GitHub cria conta na primeira vez e reutiliza na segunda

**Dado** que o usuário clica em "Continuar com GitHub" na página `/login`
**Quando** autoriza o acesso na tela do GitHub (primeira vez)
**Então** uma nova conta é criada automaticamente e o usuário é redirecionado para `/library`

**E dado** que o mesmo usuário repete o fluxo OAuth com o mesmo email GitHub
**Quando** autoriza o acesso (segunda vez)
**Então** a conta existente é reconhecida sem criar duplicata

**Critério de Aceitação:** F01-AC06

---

### GTW-07 — Solicitação de reset de senha entrega email em até 60 segundos

**Dado** que o usuário acessa `/reset-password` e informa seu email cadastrado
**Quando** submete o formulário
**Então** um email com link de recuperação é entregue na caixa de entrada em até 60 segundos, e o link leva para a página de definição de nova senha

**Critério de Aceitação:** F01-AC07

---

### GTW-08 — Link de reset expirado ou já utilizado exibe mensagem de expiração

**Dado** que o usuário acessa o link de reset de senha
**Quando** o token está expirado (mais de 1 hora) ou já foi utilizado
**Então** a mensagem "This link has expired. Request a new password reset." é exibida e o usuário não consegue definir nova senha com esse link

**Critério de Aceitação:** F01-AC08

---

### GTW-09 — Usuário não autenticado é redirecionado para /login ao acessar rota protegida

**Dado** que o usuário não possui sessão ativa
**Quando** tenta acessar qualquer rota protegida (`/library`, `/video/*`, `/upload`, `/search`)
**Então** é redirecionado automaticamente para `/login` sem carregar o conteúdo da rota protegida

**Critério de Aceitação:** F01-AC09

---

## Manifesto de Cobertura

| ID do Contrato | Critério de Aceitação (PRD) | Tipo de Teste Recomendado |
|---------------|-----------------------------|--------------------------|
| GTW-01 | F01-AC01 — Registro com email e senha válidos | E2E (Playwright) |
| GTW-02 | F01-AC02 — Login com credenciais corretas | E2E (Playwright) |
| GTW-03 | F01-AC03 — Mensagem genérica em login incorreto | E2E (Playwright) |
| GTW-04 | F01-AC04 — Bloqueio após 5 tentativas falhas | E2E (Playwright) + Unitário (services) |
| GTW-05 | F01-AC05 — Google OAuth (nova conta + reutilização) | E2E (Playwright) — requer mock OAuth |
| GTW-06 | F01-AC06 — GitHub OAuth (nova conta + reutilização) | E2E (Playwright) — requer mock OAuth |
| GTW-07 | F01-AC07 — Reset de senha entregue em 60 segundos | E2E (Playwright) + Unitário (actions) |
| GTW-08 | F01-AC08 — Link de reset expirado exibe erro | E2E (Playwright) + Unitário (services) |
| GTW-09 | F01-AC09 — Rota protegida redireciona para /login | E2E (Playwright) |

---

## Comportamentos de Segurança (não funcionais)

| Comportamento | Verificação |
|--------------|-------------|
| Cookie de sessão é HTTP-only (inacessível via JavaScript) | `document.cookie` não contém o token de sessão |
| Mensagem de erro de login não distingue email de senha | Mesmo texto para email inexistente e senha incorreta |
| Solicitação de reset não revela se email existe | Mesma resposta para emails cadastrados e não cadastrados |
| Token de reset expira em 1 hora | Token gerado há mais de 60 minutos retorna GTW-08 |
| Token de reset é invalidado após uso | Usar o mesmo token duas vezes retorna GTW-08 na segunda vez |
