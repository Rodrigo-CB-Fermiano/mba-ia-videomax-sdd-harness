# VideoMax

Plataforma pessoal de gerenciamento de vídeos com transcrição automática sincronizada, biblioteca organizável e busca em texto completo. Projeto construído como harness de desenvolvimento orientado por especificação (SDD) utilizando Claude Code com skills de automação de ciclo de vida de features.

## Visão Geral

VideoMax permite que usuários façam upload, organizem e assistam sua coleção particular de vídeos em um workspace privado. Cada usuário conta com 1 GB de armazenamento e pode enviar arquivos de até 300 MB. Após o upload, cada vídeo é transcrito automaticamente (PT/EN/ES) e o texto fica sincronizado com o player — clicar em qualquer linha da transcrição salta para aquele momento no vídeo.

**Stack:** Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL · NextAuth.js v5 · Tailwind CSS · shadcn/ui · Vitest · Playwright

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| Node.js | 20 |
| pnpm | 9 |
| PostgreSQL | 15 |
| Claude Code CLI | última |

---

## Configuração Local

### 1. Clonar e instalar dependências

```bash
git clone https://github.com/rc-fermiano/videomax-mba-sdd-harness.git
cd videomax-mba-sdd-harness
pnpm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com seus valores:

```env
# Banco de dados
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/videomax"

# Auth (gere com: openssl rand -base64 32)
NEXTAUTH_SECRET="seu-secret-aqui-com-pelo-menos-32-caracteres"
NEXTAUTH_URL="http://localhost:3000"

# Upload (valores padrão funcionam para desenvolvimento)
UPLOAD_DIR="./storage/uploads"
MAX_FILE_SIZE_BYTES="314572800"   # 300 MB
MAX_QUOTA_BYTES="1073741824"      # 1 GB
```

### 3. Banco de dados

```bash
# Criar banco (se ainda não existir)
createdb videomax

# Aplicar migrations e gerar cliente Prisma
pnpm prisma migrate dev
```

### 4. Rodar o projeto

```bash
# Desenvolvimento
pnpm dev

# Build de produção
pnpm build && pnpm start
```

### 5. Testes

```bash
# Testes unitários e de integração
pnpm test

# Testes E2E (requer servidor rodando em localhost:3000)
pnpm playwright test
```

---

## Estrutura do Projeto

```
src/
  app/                    # Rotas Next.js (App Router)
    (auth)/               # Grupo de rotas públicas (login, registro)
    (app)/                # Grupo de rotas protegidas (upload, biblioteca, player)
    api/                  # API Routes (upload, auth)
  components/             # Componentes React
    upload/               # UploadZone, ProgressBar, QuotaIndicator
    ui/                   # Componentes shadcn/ui
  server/                 # Lógica servidor (services, actions)
    upload/               # Serviços e Server Actions de upload
  lib/                    # Utilitários compartilhados (auth, db, storage)
prisma/
  schema.prisma           # Schema do banco de dados
  migrations/             # Histórico de migrations
docs/
  PRD.md                  # Product Requirements Document
  prd_progress.json       # Status de implementação por feature
  F01-authentication-system/
  F02-video-upload/
  ...
.claude/
  skills/                 # Skills de automação do Claude Code
```

---

## Features

| ID | Feature | Status |
|---|---|---|
| F01 | Sistema de Autenticação | ✅ Implementado |
| F02 | Upload de Vídeo | ✅ Implementado |
| F03 | Biblioteca de Vídeos | 🔲 Pendente |
| F04 | Player de Vídeo | 🔲 Pendente |
| F05 | Transcrição Automática | 🔲 Pendente |
| F06 | Player com Transcrição Sincronizada | 🔲 Pendente |
| F07 | Busca na Biblioteca | 🔲 Pendente |
| F08 | Gerenciamento de Vídeos | 🔲 Pendente |
| F09 | Busca In-Video por Transcrição | 🔲 Pendente |

---

## Skills de Automação (Claude Code)

Este projeto usa um conjunto de **skills do Claude Code** que automatizam o ciclo de vida completo de cada feature — do PRD ao código testado. As skills ficam em `.claude/skills/` e são invocadas com `/nome-da-skill` no terminal do Claude Code.

### `/prd-writer`

Gera ou atualiza o Product Requirements Document (`docs/PRD.md`) de forma interativa.

```
/prd-writer
```

### `/spec-writer`

Gera a especificação técnica de uma feature: `spec.md` (arquitetura), `plan.md` (fases de implementação) e `contract.md` (critérios de aceitação verificáveis).

```
# Modo interativo — entrevista passo a passo
/spec-writer F03

# Batch — gera specs para múltiplas features da mesma wave em paralelo (auto-accept ativado automaticamente)
/spec-writer F03 F04 F05
/spec-writer wave 2
```

Os arquivos são salvos em `docs/<ID>-<nome-kebab>/`.

### `/implement-and-evaluate`

Skill principal de implementação. Implementa a feature fase a fase a partir do trio `spec.md + plan.md + contract.md`, executa a suíte de testes completa, mapeia falhas aos GTW IDs do `contract.md`, tenta até 3 correções automáticas e atualiza `docs/prd_progress.json` com o resultado (`passed` ou `failed`).

```
/implement-and-evaluate F03
/implement-and-evaluate docs/F03-video-library/
```

### `/fix-runner`

Re-executa a avaliação de contrato e aplica correções cirúrgicas para uma feature que falhou. Útil para re-avaliar após correções manuais ou quando o ciclo de fixes do `implement-and-evaluate` se esgotou.

```
/fix-runner F03
```

### `/grill-me` / `/grilling`

Entrevista crítica sobre um plano, decisão ou ideia — o agente questiona cada aspecto, aponta fragilidades e força o refinamento do raciocínio.

```
/grill-me
/grilling docs/F03-video-library/spec.md
```

---

## Fluxo SDD (Specification-Driven Development)

```
PRD.md
  └─ /spec-writer F<N>          → spec.md + plan.md + contract.md
       └─ /implement-and-evaluate F<N>
            ├─ Implementa fase a fase (commit por fase)
            ├─ Roda suíte de testes
            ├─ Mapeia falhas → GTW IDs do contract.md
            ├─ Tenta até 3 correções automáticas
            └─ Atualiza prd_progress.json (evaluation: passed | failed)
```

---

Ao final do desenvolvmento de um feature, podemos rodar um /simplify para o agent rodar uma "refatoração" do código, deixando ele mais simples.

## Licença

MIT
