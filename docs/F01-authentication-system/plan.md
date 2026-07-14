# Plano de Implementação: F01 - Sistema de Autenticação

**Pré-requisitos:**
- Node.js 20+
- PostgreSQL 15+ (via Docker: `docker run --name videomax-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=videomax -p 5432:5432 -d postgres:15`)
- Mailpit para SMTP local em dev (via Docker: `docker run --name videomax-mail -p 1025:1025 -p 8025:8025 -d axllent/mailpit`)
- Variáveis de ambiente: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `EMAIL_FROM`
- Credenciais OAuth: Google Cloud Console (OAuth 2.0) e GitHub Developer Settings com callback `http://localhost:3000/api/auth/callback/google` e `http://localhost:3000/api/auth/callback/github`

---

### Fase 1: Scaffolding e Infraestrutura Base

**1. Inicialização do Projeto** - Criar o projeto Next.js 14 via `create-next-app` com App Router, TypeScript, Tailwind CSS e diretório `src/`. Instalar as dependências principais: `next-auth@beta`, `@auth/prisma-adapter`, `prisma`, `@prisma/client`, `bcryptjs`, `nodemailer`, `react-hook-form`, `zod` e `@hookform/resolvers`.

**2. Schema do Banco de Dados e Migração** - Inicializar o Prisma e definir o schema completo em `prisma/schema.prisma` com as tabelas User, Account, VerificationToken e LoginAttempt conforme a seção 6 da spec. Executar `prisma migrate dev --name init_auth` para criar a migração inicial e gerar o Prisma Client.

**3. Configuração do NextAuth.js** - Criar `src/lib/db.ts` com o singleton do Prisma Client e `src/lib/auth.ts` com a configuração completa do NextAuth: providers Credentials (com integração de lockout no `authorize()`), Google e GitHub; Prisma adapter; callbacks JWT (adiciona `userId` ao token) e session (propaga `userId`). Expor o handler em `src/app/api/auth/[...nextauth]/route.ts`.

**4. Middleware de Proteção de Rotas** - Implementar `src/middleware.ts` exportando o helper `auth` do NextAuth como middleware padrão. Configurar o `matcher` para interceptar todas as rotas protegidas (`/library`, `/video/:path*`, `/upload`, `/search`) e redirecionar para `/login` quando não há sessão válida.

---

### Fase 2: Serviços e Server Actions

**5. Serviços de Lockout** - Implementar em `src/server/auth/services.ts` as funções `checkLockout()`, `recordFailedAttempt()` e `clearAttempts()`. A lógica de verificação conta registros na tabela `LoginAttempt` com `email` e `attemptedAt` dentro da janela de 15 minutos; se o count for ≥ 5, retorna `{ locked: true }`.

**6. Serviço de Email e Tokens de Reset** - Implementar em `src/server/auth/services.ts` as funções `generateResetToken()`, `validateResetToken()` e `sendResetEmail()`. O token é um UUID armazenado em `VerificationToken` com expiração de 1 hora. O email é enviado via Nodemailer com o link `${NEXTAUTH_URL}/reset-password/confirm?token=<uuid>`.

**7. Server Actions de Autenticação** - Implementar em `src/server/auth/actions.ts` as três actions: `register()` (valida com zod, verifica email duplicado, cria usuário com bcrypt hash), `resetPassword()` (sempre retorna sucesso, envia email apenas se email existir), e `setNewPassword()` (valida token, atualiza senha com novo hash, remove token do DB).

---

### Fase 3: Layouts e Componentes de Interface

**8. Layouts de Route Groups** - Criar o Route Group `(auth)` com layout público centrado e sem navbar, e o Route Group `(app)` com layout autenticado contendo a navbar global (logo, campo de busca em stub, avatar). O layout `(app)` verifica a sessão via `auth()` no servidor e redireciona para `/login` como camada adicional de proteção.

**9. Componentes de Formulário** - Implementar `LoginForm.tsx`, `RegisterForm.tsx`, `ResetPasswordForm.tsx` e `SocialButtons.tsx` como Client Components. Cada formulário usa react-hook-form + zod para validação inline antes do submit. O LoginForm lida com os cenários de erro `CredentialsSignin` e lockout. O ResetPasswordForm tem dois modos: solicitar email e definir nova senha.

**10. Páginas de Autenticação** - Criar as páginas em `src/app/(auth)/`: `/login/page.tsx`, `/register/page.tsx`, `/reset-password/page.tsx` e `/reset-password/confirm/page.tsx`. A página de confirmação lê `?token=` dos search params, chama `setNewPassword()` no submit e faz auto-login via `signIn('credentials')` após sucesso.

**11. Página da Biblioteca (Stub)** - Criar `src/app/(app)/library/page.tsx` com conteúdo mínimo ("Sua biblioteca está vazia") para validar o fluxo de redirect pós-login. Esta página será expandida pela feature F04.

---

### Fase 4: Testes

**12. Testes Unitários de Serviços** - Implementar `src/server/auth/__tests__/services.test.ts` com Vitest e um cliente Prisma mockado, cobrindo todos os cenários de lockout (block, allow por tempo, allow por threshold), geração e validação de tokens de reset, e limpeza de tentativas.

**13. Testes Unitários de Actions** - Implementar `src/server/auth/__tests__/actions.test.ts` cobrindo registro (sucesso, email duplicado, senha fraca), solicitar reset (email existente e não existente) e redefinir senha (sucesso, token expirado, token inválido).

**14. Testes de Componentes** - Implementar testes com Vitest + React Testing Library para `LoginForm.tsx` e `RegisterForm.tsx`, cobrindo renderização, validação inline, estados de loading, exibição de mensagens de erro de credenciais e lockout.

**15. Testes E2E** - Implementar `e2e/auth.spec.ts` com Playwright cobrindo os fluxos completos: registro com redirect para /library, login com credenciais corretas, mensagem genérica em login incorreto, bloqueio após 5 tentativas, solicitação de reset de senha e proteção de rotas para usuário não autenticado. Cada teste mapeia diretamente a um critério de aceitação do PRD.
