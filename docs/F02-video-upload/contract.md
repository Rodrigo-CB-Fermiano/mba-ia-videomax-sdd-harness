# Contrato de Comportamento: F02 - Upload de Vídeo

Este contrato descreve a promessa testável da feature F02 em linguagem agnóstica de implementação. O conteúdo é derivado exclusivamente dos critérios de aceitação do PRD (Seção 9). Refatorações de implementação não afetam este contrato.

---

## Prerequisites

### Persistent state
- PostgreSQL com schema da migração `002_video_upload` aplicada: tabela `videos` com enum `VideoStatus`, coluna `storageUsedBytes` adicionada à tabela `users`.
- Um usuário de teste pré-criado e autenticado (session cookie válido, conforme fixtures do F01 em `e2e/fixtures/test-user.json`).
- `storageUsedBytes` do usuário de teste definido no início de cada suite conforme o cenário (zero para testes de upload normal; próximo do limite para testes de quota).
- Diretório `UPLOAD_DIR` limpo antes de cada suite de testes E2E.

### Static inputs
- `e2e/fixtures/test-video-small.mp4` — arquivo de vídeo `video/mp4` com menos de 10 MB para testes de upload bem-sucedido.
- `e2e/fixtures/test-video-oversized.bin` — arquivo binário com exatamente 301 MB para testar rejeição por tamanho.
- `e2e/fixtures/test-image.png` — arquivo `image/png` para testar rejeição por MIME type.

### Configuration
- Todas as variáveis de ambiente do F01 ainda necessárias.
- `UPLOAD_DIR` — caminho absoluto de um diretório gravável para armazenar os vídeos.
- Limite de arquivo: 300 MB = 314.572.800 bytes.
- Limite de quota por usuário: 1 GB = 1.073.741.824 bytes.

### Runtime services
*(responsabilidade do contract evaluator)*
- PostgreSQL acessível em `DATABASE_URL`.
- Next.js dev server rodando em `http://localhost:3000`.
- Usuário autenticado no contexto dos testes E2E (cookie de sessão válido obtido via fluxo do F01).

---

## Superfícies de Verificação

| Superfície | Descrição | Como Verificar |
|-----------|-----------|---------------|
| Página `/upload` | Zona de drag-and-drop e indicador de quota | GET /upload (autenticado) → 200 com zona e quota visíveis |
| Zona de drag-and-drop | Área interativa para soltar arquivos | Elemento aceita eventos `dragover` e `drop` |
| Indicador de quota | "X MB usados de 1 GB" antes da seleção | Texto com bytes usados do usuário atual |
| Barra de progresso | Nome do arquivo, percentual, velocidade e ETA durante upload | Visível enquanto XHR está em andamento |
| Botão Cancelar | Interrompe o upload em andamento | Presente na barra de progresso; clicável durante upload |
| Botão flutuante de upload | Atalho para `/upload` visível no layout autenticado | Elemento link para `/upload` no DOM de `/library` |
| `POST /api/upload` | Endpoint de upload de arquivo | Status 201 + `{ videoId, originalFilename, fileSizeBytes, uploadedAt }` |
| `DELETE /api/upload/[videoId]` | Endpoint de cancelamento/limpeza | Status 200 + `{ success: true }` |
| Registro `Video` no banco | Linha em `videos` após upload bem-sucedido | `status = 'Queued'`; `userId` correto; `fileSizeBytes` correto |
| `users.storageUsedBytes` | Quota atualizada após upload | Valor incrementado pelo `fileSizeBytes` do arquivo |
| Card na biblioteca | Card do vídeo com badge "Queued" em `/library` | Visível dentro de 5 segundos após conclusão do upload |
| Arquivo em disco | Arquivo gravado no `UPLOAD_DIR` | `fs.existsSync(filePath)` retorna `true` após upload |

---

## Itens do Contrato (GTW)

### GTW-01 — Upload bem-sucedido via drag-and-drop cria registro e exibe card na biblioteca

**Dado** que o usuário autenticado está na página `/upload`
**Quando** arrasta um arquivo de vídeo válido (MIME começando com `video/`, tamanho ≤ 300 MB) para a zona de drop
**Então** o upload é iniciado, concluído com sucesso, um registro `Video` com status `Queued` é criado no banco, a quota do usuário é atualizada com o tamanho do arquivo, e o card do vídeo aparece na página `/library` com o badge "Queued" dentro de 5 segundos após a conclusão

**Critério de Aceitação:** F02-AC01, F02-AC07

---

### GTW-02 — Upload bem-sucedido via seletor de arquivo

**Dado** que o usuário autenticado está na página `/upload`
**Quando** clica no botão de seleção de arquivo, escolhe um arquivo de vídeo válido pelo seletor do sistema operacional
**Então** o upload é iniciado e concluído com o mesmo comportamento descrito no GTW-01

**Critério de Aceitação:** F02-AC02

---

### GTW-03 — Arquivo acima de 300 MB é rejeitado no cliente antes de qualquer envio

**Dado** que o usuário seleciona ou arrasta um arquivo com tamanho superior a 300 MB
**Quando** o arquivo é identificado pelo componente de upload
**Então** o upload NÃO é iniciado, nenhuma requisição é enviada ao servidor, e a mensagem "Arquivo muito grande. O tamanho máximo permitido é 300 MB." é exibida imediatamente

**Critério de Aceitação:** F02-AC03

---

### GTW-04 — Arquivo com MIME type não-vídeo é rejeitado no cliente antes de qualquer envio

**Dado** que o usuário seleciona ou arrasta um arquivo cujo MIME type não começa com `video/` (ex: `image/png`, `application/pdf`)
**Quando** o arquivo é identificado pelo componente de upload
**Então** o upload NÃO é iniciado, nenhuma requisição é enviada ao servidor, e a mensagem "Apenas arquivos de vídeo são aceitos." é exibida imediatamente

**Critério de Aceitação:** F02-AC04

---

### GTW-05 — Progresso em tempo real exibe nome do arquivo, percentual, velocidade e tempo estimado

**Dado** que o usuário iniciou um upload válido que está em andamento
**Quando** o upload está entre 1% e 99% concluído
**Então** a interface exibe simultaneamente:
- o nome original do arquivo (ex: `aula.mp4`)
- o percentual de conclusão (ex: `47%`)
- a velocidade de transferência em unidade legível (ex: `2,4 MB/s`)
- o tempo estimado restante (ex: `12 segundos restantes`)

**Critério de Aceitação:** F02-AC05

---

### GTW-06 — Cancelamento aborta a transferência e remove o arquivo parcial do servidor

**Dado** que o usuário iniciou um upload válido que está em andamento
**Quando** clica no botão "Cancelar"
**Então:**
1. A transferência de rede é interrompida imediatamente
2. Qualquer arquivo parcial gravado no servidor é removido do disco (`UPLOAD_DIR`)
3. O registro `Video` (se criado antes do cancelamento) é excluído do banco
4. O valor de `users.storageUsedBytes` permanece igual ao valor anterior ao upload
5. O indicador de quota reflete o valor inalterado

**Critério de Aceitação:** F02-AC06

---

### GTW-07 — Quota excedida bloqueia o upload antes de iniciar e exibe o espaço disponível

**Dado** que a soma de `users.storageUsedBytes` e o tamanho do arquivo selecionado ultrapassaria 1.073.741.824 bytes (1 GB)
**Quando** o arquivo é selecionado ou arrastado para a zona de upload
**Então** o upload NÃO é iniciado e a mensagem "Armazenamento insuficiente. Você tem X MB restantes. Delete vídeos para liberar espaço." é exibida, onde X corresponde ao espaço efetivamente disponível calculado a partir do `storageUsedBytes` atual

**Critério de Aceitação:** F02-AC08

---

### GTW-08 — Indicador de quota exibe o uso atual antes da seleção de arquivo

**Dado** que o usuário autenticado acessa `/upload`
**Quando** a página carrega
**Então** o indicador exibe corretamente o uso de armazenamento no formato "X MB usados de 1 GB", onde X reflete o valor atual de `storageUsedBytes` do usuário no banco de dados

**Critério de Aceitação:** F02-AC08 (pré-condição informativa)

---

## Manifesto de Cobertura

| ID do Contrato | Critério de Aceitação (PRD) | Tipo de Teste Recomendado |
|---------------|-----------------------------|--------------------------|
| GTW-01 | F02-AC01 — Upload via drag-and-drop | E2E (Playwright) |
| GTW-01 | F02-AC07 — Card com status Queued em ≤ 5 segundos | E2E (Playwright) |
| GTW-02 | F02-AC02 — Upload via seletor de arquivo | E2E (Playwright) |
| GTW-03 | F02-AC03 — Rejeição de arquivo > 300 MB (client-side) | E2E (Playwright) + Unitário (UploadZone) |
| GTW-04 | F02-AC04 — Rejeição de MIME type não-vídeo | E2E (Playwright) + Unitário (UploadZone) |
| GTW-05 | F02-AC05 — Progresso em tempo real | E2E (Playwright) |
| GTW-06 | F02-AC06 — Cancelamento com limpeza de arquivo e quota | E2E (Playwright) + Unitário (services) |
| GTW-07 | F02-AC08 — Bloqueio por quota excedida com mensagem | E2E (Playwright) + Unitário (UploadZone) |
| GTW-08 | F02-AC08 — Indicador de quota na página /upload | E2E (Playwright) |

---

## Comportamentos de Segurança (não funcionais)

| Comportamento | Verificação |
|--------------|-------------|
| Upload requer sessão autenticada | `POST /api/upload` sem cookie → 401 sem criar arquivo no disco |
| Validação de MIME e tamanho é aplicada também no servidor | Enviar raw `POST` com arquivo inválido (sem passar pelo cliente) → 400 |
| Usuário só pode cancelar seus próprios uploads | `DELETE /api/upload/{videoId de outro usuário}` → 403 |
| Quota não é consumida após cancelamento | `storageUsedBytes` após cancelamento completo = valor antes do upload |
| Arquivo parcial não permanece no disco após cancelamento | `fs.existsSync(filePath)` retorna `false` após cancelamento concluído |

---

## Integração Cross-Feature

| Cenário | Feature Produtora | Feature Consumidora | Verificação |
|---------|------------------|--------------------|-----------:|
| Registro `Video` com `status: Queued` criado após upload | F02 | F03 | SELECT em `videos` após upload → linha com `status = 'Queued'`; F03 deve iniciar processamento em até 30 segundos |
| Card do vídeo visível na biblioteca após upload | F02 | F04 | GET /library após upload → card com badge "Queued" presente no DOM dentro de 5 segundos |
