# Plano de Implementação: F02 - Upload de Vídeo

**Pré-requisitos:**
- F01 completamente implementado (schema `users`, sessão NextAuth, middleware de proteção de rotas)
- Variável de ambiente `UPLOAD_DIR` apontando para um diretório gravável no sistema local (ex: `./storage/uploads`)
- PostgreSQL rodando com banco `videomax` acessível

---

### Fase 1: Modelo de Dados e Infraestrutura de Armazenamento

**1. Schema Prisma e Migração** - Adicionar o enum `VideoStatus` e o modelo `Video` ao `prisma/schema.prisma`, além da coluna `storageUsedBytes` ao modelo `User`. Executar `prisma migrate dev --name video_upload` para gerar a migration SQL e atualizar o Prisma Client. Consultar a seção 6 da spec para o schema completo com índices e constraints.

**2. Abstração de Storage Local** - Criar `src/lib/storage.ts` com a função `getUploadDir(userId)` que resolve o caminho absoluto baseado em `UPLOAD_DIR` e garante que o diretório do usuário exista antes de qualquer operação de escrita. Seguir o padrão de módulo utilitário do `src/lib/db.ts` do F01.

**3. Serviços de Upload** - Implementar `src/server/upload/services.ts` com as funções `saveFileToDisk()`, `deleteFileFromDisk()`, `generateStoredFilename()`, `incrementQuota()` e `decrementQuota()`. As operações de quota devem ser atômicas para garantir consistência. Consultar a seção 7 da spec para os contratos de entrada/saída de cada função.

---

### Fase 2: API de Upload

**4. Route Handler de Upload** - Implementar `src/app/api/upload/route.ts` como handler POST que valida a sessão via `auth()`, extrai o arquivo do `FormData`, aplica validações de MIME e tamanho no servidor como segunda linha de defesa, verifica a quota disponível do usuário, persiste o arquivo em disco, cria o registro `Video` com status `Queued` e atualiza `storageUsedBytes`. Configurar `export const maxDuration = 60` no topo do arquivo. Consultar a seção 5 da spec para os contratos de request/response e códigos de erro.

**5. Route Handler de Cancelamento** - Implementar `src/app/api/upload/[videoId]/route.ts` como handler DELETE que valida a sessão, verifica que o vídeo pertence ao usuário autenticado, remove o arquivo do disco, decrementa a quota e exclui o registro do banco. Consultar a seção 5 da spec para os códigos de erro e tratamento de ownership.

---

### Fase 3: Server Action de Quota

**6. Server Action getQuota** - Implementar `src/server/upload/actions.ts` com a função `getQuota()` autenticada, seguindo o padrão de Server Actions do `src/server/auth/actions.ts` do F01. A função lê `storageUsedBytes` do usuário logado e retorna `{ usedBytes, maxBytes }` para uso no Server Component da página de upload.

---

### Fase 4: Componentes de Interface

**7. QuotaIndicator** - Implementar `src/components/upload/QuotaIndicator.tsx` como componente que recebe `usedBytes` e `maxBytes` via props e exibe o uso de armazenamento em formato legível com uma barra de preenchimento visual. Utilizar os componentes Tailwind + shadcn/ui já presentes no projeto. Consultar a experiência descrita no PRD Seção 6 F02 para o texto exato do indicador.

**8. ProgressBar** - Implementar `src/components/upload/ProgressBar.tsx` recebendo `filename`, `percentage`, `speedBps` e `etaSeconds` como props. O componente formata a velocidade em KB/s ou MB/s conforme a magnitude e exibe o tempo estimado restante. O botão "Cancelar" dispara a prop `onCancel`. Consultar a seção 7 da spec para as funções de teste que descrevem o comportamento esperado.

**9. UploadZone** - Implementar `src/components/upload/UploadZone.tsx` como Client Component principal que gerencia o ciclo completo: estados `idle` → `dragover` → `uploading` → `done`/`error`; validação de MIME, tamanho e quota antes de iniciar o XHR; criação e controle do XMLHttpRequest com cálculo de velocidade e ETA via `onprogress`; chamada ao endpoint DELETE para limpeza ao cancelar. Consultar a seção 4 da spec para os callbacks expostos e a seção 7 para os cenários de teste dos componentes.

**10. Página de Upload** - Criar `src/app/(app)/upload/page.tsx` como Server Component que busca a quota inicial via `getQuota()` e passa os dados para `QuotaIndicator` e `UploadZone`. Após upload bem-sucedido, exibe toast via biblioteca de notificações do projeto e redireciona para `/library` usando `router.push()` no componente cliente.

**11. Botão Flutuante no Layout** - Modificar `src/app/(app)/layout.tsx` para incluir um `<Link href="/upload">` estilizado como botão flutuante fixo no canto inferior direito, visível em todas as páginas do grupo `(app)`. Manter compatibilidade com o layout de navbar existente do F01.

---

### Fase 5: Testes

**12. Testes Unitários de Serviços** - Implementar `src/server/upload/__tests__/services.test.ts` com Vitest e filesystem mockado (`vi.mock('node:fs/promises')`), cobrindo todos os cenários de gravação, remoção, geração de nome único, incremento e decremento atômico de quota. Consultar a seção 7 da spec para as funções de teste e asserções esperadas.

**13. Testes Unitários de Actions** - Implementar `src/server/upload/__tests__/actions.test.ts` cobrindo `getQuota()` para usuário autenticado e para chamada sem sessão, seguindo o padrão dos testes de actions do F01 em `src/server/auth/__tests__/actions.test.ts`.

**14. Testes de Componentes** - Implementar testes com Vitest + React Testing Library para `UploadZone.tsx` e `ProgressBar.tsx`, cobrindo renderização, rejeições por MIME inválido e tamanho excessivo, exibição do progresso e acionamento do cancelamento. O XHR deve ser mockado para simular eventos de progresso.

**15. Testes E2E** - Implementar `e2e/upload.spec.ts` com Playwright cobrindo todos os oito critérios de aceitação do F02: upload por drag-and-drop, upload por seletor, rejeição por tamanho, rejeição por MIME, exibição de progresso em tempo real, cancelamento com limpeza de arquivo parcial, aparição do card com status Queued na biblioteca e bloqueio por quota excedida. Consultar a seção 7 da spec para o mapeamento de cada teste ao critério de aceitação correspondente.
