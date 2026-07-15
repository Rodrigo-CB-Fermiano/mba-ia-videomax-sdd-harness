# Implementation Plan: F03 — Background Processing

**Prerequisites:**
- `OPENAI_API_KEY` env var set (or `WHISPER_STUB=true` for test environments)
- `THUMBNAIL_DIR` env var (defaults to `./storage/thumbnails`)
- npm packages: `fluent-ffmpeg`, `@ffmpeg-installer/ffmpeg`, `@ffprobe-installer/ffprobe`, `openai`
- Prisma migration applied (`pnpm db:migrate`)

---

### Phase 1: Schema and Infrastructure

**1. Database schema extension** — Add the six processing fields to the `Video` model in `prisma/schema.prisma` (`durationSeconds`, `thumbnailPath`, `language`, `retryCount`, `processingStartedAt`, `transcriptionText`) and add the `TranscriptionSegment` model with its relation to `Video`. Refer to spec Section 6 (Data Model) for Prisma type definitions and the `@@index` and `@@map` directives.

**2. Migration** — Run `pnpm db:migrate` to generate and apply the migration. Verify that the generated SQL includes the ALTER TABLE for `videos`, the CREATE TABLE for `transcription_segments` with the FK and btree index, and the CREATE INDEX for the GIN full-text index. If Prisma does not generate the GIN index automatically, add it manually to the migration SQL file. Refer to spec Section 6 for the complete migration SQL.

---

### Phase 2: Processing Service

**3. Processing service** — Create `src/server/processing/services.ts` exporting `runProcessingJob(videoId: string)` as the pipeline orchestrator plus the internal helpers: `extractAudioAndMeta` (ffmpeg: WAV audio file + durationSeconds), `generateThumbnail` (ffmpeg: JPEG at 5-second mark saved to `THUMBNAIL_DIR/{userId}/{videoId}.jpg`), `transcribeAudio` (OpenAI Whisper: segments array + detected language), `saveSegments` (bulk insert to TranscriptionSegment via `createMany`), `indexFullText` (update `Video.transcriptionText` from concatenated segment texts), and `updateVideoStatus` (single Prisma update call). Refer to spec Sections 4 and 6 for function signatures, field names, and status transition rules including the retry counter logic.

**4. Fire-and-forget trigger** — Create `src/server/processing/trigger.ts` exporting `triggerProcessing(videoId: string): void`. The function calls `runProcessingJob(videoId)` without `await`, attaches a `.catch` handler that logs errors to console. This is the single entry point for all processing launches, including both the upload route and the retry endpoint.

---

### Phase 3: API Endpoints

**5. Status polling endpoint** — Create `src/app/api/videos/[videoId]/status/route.ts` with a `GET` handler. Authenticate the session, verify video ownership, and return a JSON response with `{ id, status, failureReason, thumbnailPath, durationSeconds, language }`. Refer to spec Section 5 (API Contracts) for the exact response shape and the error codes `UNAUTHORIZED`, `NOT_FOUND`, and `FORBIDDEN`.

**6. Manual retry endpoint** — Create `src/app/api/videos/[videoId]/retry/route.ts` with a `POST` handler. Authenticate the session, verify ownership, and reject with `CONFLICT` (409) if `video.status !== "Failed"`. On valid request, update the video with `{ status: "Queued", retryCount: 0, failureReason: null, processingStartedAt: null }` and call `triggerProcessing(videoId)`. Refer to spec Section 5 for response shape and error codes.

---

### Phase 4: Integration

**7. Upload route integration** — Modify `src/app/api/upload/route.ts` to import `triggerProcessing` from `src/server/processing/trigger.ts` and call `triggerProcessing(video.id)` immediately after the `await db.video.create(...)` succeeds, before returning the 201 response. The call is fire-and-forget — do not await it and do not let any error from it affect the upload response.

---

### Phase 5: Tests

**8. Unit tests** — Create `src/server/processing/__tests__/services.test.ts`. Mock `fluent-ffmpeg`, `openai`, and `@/lib/db` using `vi.mock`. Cover all test functions listed in spec Section 7: success path, ffmpeg failure, Whisper failure, single-retry recovery, retry exhaustion (3 attempts), `saveSegments` mapping, and `updateVideoStatus` field correctness. Follow the existing test file style (descriptions in Portuguese, `vi.clearAllMocks()` in `beforeEach`).

**9. E2E tests** — Create `e2e/processing.spec.ts` using Playwright. Use the fixture videos `e2e/fixtures/sample-pt.mp4`, `sample-en.mp4`, and `sample-es.mp4`. Cover: upload triggers pipeline (status leaves Queued), retry endpoint resets a Failed video to Queued, GET /status returns the correct language after Ready, ownership enforcement (403), and retry rejection on non-Failed video (409). If `OPENAI_API_KEY` is unavailable, skip Whisper-dependent assertions with `test.skip` and log under soft-fails.
