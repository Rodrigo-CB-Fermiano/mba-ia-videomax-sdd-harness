# F03 — Background Processing: Behavior Contract

## Coverage Manifest

| PRD Acceptance Criterion (Section 9 — F03) | Covering Item IDs |
|---|---|
| Transcription starts automatically within 30 seconds of upload completion with no user action required | API-PROC-01 |
| Processing status transitions in order: Queued → Processing → Ready (or Failed) | API-PROC-02 |
| Library card status badge updates without page reload within 10 seconds of each transition | API-PROC-03 |
| Thumbnail appears on the video card after processing completes | API-PROC-04 |
| Transcription is complete within 2× the video's duration for 95% of uploads in testing | PERF-PROC-01 |
| Language detection correctly identifies Portuguese, English, and Spanish on test videos | API-PROC-05 |
| On transient failure the system retries automatically; the card returns to "Processing" for each retry attempt | API-PROC-06 |
| After 3 failed retries, status is set to "Failed" with the failure reason and a "Retry" button | API-PROC-07 |
| Clicking "Retry" re-queues the job and status resets to "Queued" | API-PROC-08 |

| PRD Acceptance Criterion (Section 9 — Cross-Feature Integration) | Covering Item IDs |
|---|---|
| After F02 upload completes, F03 processing starts within 30 seconds; the video card in F04 transitions from "Queued" to "Processing" without page reload | INT-F02-F03-01 |

---

## Prerequisites

### Persistent state
- A `User` record exists with id `test-user-alice`, email `alice@videomax.test`, `emailVerified` set, password hash for `Password1`.
- A `Video` record in `Queued` status exists owned by `test-user-alice`, with `filePath` pointing to `e2e/fixtures/sample-pt.mp4` (or a temp copy). Used by API-PROC-01, API-PROC-02, API-PROC-06.
- For retry tests (API-PROC-07, API-PROC-08): a `Video` record in `Failed` status with `retryCount = 3` and a non-null `failureReason` exists, owned by `test-user-alice`.

### Static inputs
- `e2e/fixtures/sample-pt.mp4` — valid H.264 MP4, ~10 seconds, spoken Portuguese.
- `e2e/fixtures/sample-en.mp4` — valid H.264 MP4, ~10 seconds, spoken English.
- `e2e/fixtures/sample-es.mp4` — valid H.264 MP4, ~10 seconds, spoken Spanish.

### Configuration
- `DATABASE_URL` points to a test PostgreSQL instance with the F03 migration applied.
- `UPLOAD_DIR` set to a writable temporary directory.
- `THUMBNAIL_DIR` set to a writable temporary directory.
- `OPENAI_API_KEY` set, OR `WHISPER_STUB=true` set to enable the transcription stub (items PERF-PROC-01 and API-PROC-05 soft-fail when stub is active).
- `NEXTAUTH_SECRET` set to any 32-character string.
- `NEXTAUTH_URL` set to `http://localhost:3000`.

### Runtime services
- PostgreSQL instance running and accessible at `DATABASE_URL`.
- Dev server running at `http://localhost:3000` (for E2E tests).

### External dependencies
- `ffmpeg` binary available via `@ffmpeg-installer/ffmpeg`.
- `ffprobe` binary available via `@ffprobe-installer/ffprobe`.
- OpenAI Whisper API accessible at `https://api.openai.com` (skippable via stub).

---

## Item Bodies

### API-PROC-01 — Processing auto-triggered after upload

**Surface:** API Route `POST /api/upload` → async side effect

**Given:**
- User `alice@videomax.test` is authenticated.
- `sample-pt.mp4` is available and under the 300 MB limit with quota available.

**When:**
- `POST /api/upload` is called with `sample-pt.mp4` as the file body.
- The route responds `201` with `{ videoId, originalFilename, fileSizeBytes, uploadedAt }`.

**Then:**
- Within 30 seconds, `GET /api/videos/{videoId}/status` returns a `status` field that is NOT `"Queued"` (i.e., `"Processing"` or `"Ready"`).

---

### API-PROC-02 — Status transitions in order

**Surface:** `GET /api/videos/[videoId]/status`

**Given:**
- A video in `Queued` status exists owned by `alice@videomax.test`.
- The processing pipeline runs to completion without error.

**When:**
- The pipeline executes `runProcessingJob(videoId)`.

**Then:**
- Status follows the sequence `Queued → Processing → Ready` with no states skipped.
- `GET /api/videos/{videoId}/status` never returns `Failed` during a successful run.
- After `Ready`, `status` does not change further.

---

### API-PROC-03 — Status polling endpoint contract

**Surface:** `GET /api/videos/[videoId]/status`

**Given:**
- A video of any status exists owned by `alice@videomax.test`.

**When:**
- `GET /api/videos/{videoId}/status` is called with a valid session for `alice`.

**Then:**
- Response: `200` with body:
  ```json
  {
    "id": "<string>",
    "status": "<Queued|Processing|Ready|Failed>",
    "failureReason": "<string|null>",
    "thumbnailPath": "<string|null>",
    "durationSeconds": "<number|null>",
    "language": "<string|null>"
  }
  ```
- `status` matches the current `Video.status` value in the database.
- Calling with no session → `401 { "error": "UNAUTHORIZED" }`.
- Calling for a video owned by another user → `403 { "error": "FORBIDDEN" }`.
- Calling for a non-existent videoId → `404 { "error": "NOT_FOUND" }`.

---

### API-PROC-04 — Thumbnail generated after processing

**Surface:** `GET /api/videos/[videoId]/status`

**Given:**
- A video has been processed successfully (status `Ready`).

**When:**
- `GET /api/videos/{videoId}/status` is called.

**Then:**
- `thumbnailPath` is a non-null, non-empty string.
- A file exists on disk at the path indicated by `thumbnailPath`.
- The file is a valid JPEG image.

---

### API-PROC-05 — Language detection

**Surface:** `GET /api/videos/[videoId]/status`

**Given:**
- `sample-pt.mp4` (spoken Portuguese) has been uploaded and processed to `Ready`.

**When:**
- `GET /api/videos/{videoId}/status` is called.

**Then:**
- `language === "pt"`.

*Note: this item requires a real Whisper API call. It soft-fails when `WHISPER_STUB=true`.*

---

### PERF-PROC-01 — SLA compliance

**Surface:** Processing pipeline execution time

**Given:**
- `sample-pt.mp4` (~10 seconds of content) has been uploaded.

**When:**
- Processing completes (status transitions to `Ready`).

**Then:**
- The time elapsed between the `201` response from `POST /api/upload` and the first `GET /status` returning `"Ready"` is ≤ 20 seconds (2× video duration).

*Note: this item soft-fails in environments where `OPENAI_API_KEY` is unavailable or Whisper latency is high.*

---

### API-PROC-06 — Automatic retry on transient failure

**Surface:** `runProcessingJob` internal retry logic; `GET /api/videos/[videoId]/status`

**Given:**
- A video is in `Queued` status with `retryCount = 0`.
- The processing pipeline encounters a transient error on the first attempt (e.g., a network timeout on the Whisper call).

**When:**
- The pipeline detects the error and increments `retryCount`.

**Then:**
- `GET /api/videos/{videoId}/status` returns `"Processing"` while the retry attempt runs.
- `retryCount` in the database increments by 1 for each failed attempt.
- If the retry succeeds, final status is `"Ready"`.

---

### API-PROC-07 — Failed status after max retries

**Surface:** `GET /api/videos/[videoId]/status`

**Given:**
- A video has exhausted all 3 automatic retry attempts (all failed).

**When:**
- `GET /api/videos/{videoId}/status` is called.

**Then:**
- `status === "Failed"`.
- `failureReason` is a non-null, non-empty string describing the error.
- `retryCount === 3`.

---

### API-PROC-08 — Manual retry resets state

**Surface:** `POST /api/videos/[videoId]/retry`

**Given:**
- A video in `Failed` status exists owned by `alice@videomax.test`.

**When:**
- `POST /api/videos/{videoId}/retry` is called with a valid session for `alice`.

**Then:**
- Response: `200 { "success": true }`.
- `GET /api/videos/{videoId}/status` returns `"Queued"` within 2 seconds.
- `retryCount` in the database is `0`.
- A new processing job has been launched (status transitions away from `Queued` within 30 seconds).

**Rejection cases:**
- Video in non-`Failed` status (e.g., `Ready`) → `409 { "error": "CONFLICT" }`.
- No session → `401 { "error": "UNAUTHORIZED" }`.
- Video owned by another user → `403 { "error": "FORBIDDEN" }`.

---

### INT-F02-F03-01 — Upload triggers processing (cross-feature)

**Surface:** `POST /api/upload` → async trigger → `GET /api/videos/[videoId]/status`

**Given:**
- User `alice@videomax.test` is authenticated with sufficient quota.
- `sample-pt.mp4` is available.

**When:**
- `POST /api/upload` is called and returns `201` with a `videoId`.

**Then:**
- `GET /api/videos/{videoId}/status` immediately after upload returns `"Queued"` (video record created).
- Within 30 seconds, a subsequent `GET /api/videos/{videoId}/status` returns `"Processing"` or `"Ready"`.
- No manual user action is required between upload and the status change.
