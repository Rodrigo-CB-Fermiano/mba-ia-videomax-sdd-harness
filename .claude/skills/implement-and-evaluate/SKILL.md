---
name: implement-and-evaluate
description: Implementa uma feature fase a fase (idêntico ao implement-feature), executa o avaliador de contrato (suíte de testes completa), aciona o fix-runner automático em caso de falha (até 3 retries), e atualiza prd_progress.json com o resultado.
---

# Implement and Evaluate

Autonomously implement a feature from its existing `spec.md` + `plan.md` + `contract.md` triple, then run the full test suite as a contract evaluator. On failure, attempt fixes (up to 3 retries). Update `docs/prd_progress.json` with the final evaluation result — pass or fail.

---

## INPUT

Free-form. Any combination works:

- A feature identifier: `F09`, `Video Upload`, or similar.
- A feature folder: `docs/F09-in-video-transcription-search/`, `./F09/`, etc.
- A file inside the feature folder: `docs/F09-in-video-transcription-search/spec.md`.
- Extra natural-language instructions appended anywhere (see **Overrides**).

The skill locates three files and one reference source:

1. **`spec.md` + `plan.md` + `contract.md`** — siblings in the same folder. If the input points to a folder, look inside. If it points to a file, look in its parent. If it points to an ID or name, search under `docs/` for a folder matching `<ID>-*`.
2. **The PRD** — auto-discover: `docs/PRD.md` → `PRD.md` → any top-level `*.md` that reads like a product spec. Abort if none or multiple found.
3. **`docs/prd_progress.json`** — auto-discover at the repo root level under `docs/`. Abort if not found.

---

## OUTPUT

- **Commits**: one per implementation phase on the current branch.
- **Updated `docs/prd_progress.json`**: evaluation result recorded under the feature entry.
- **Chat report** at the end (Step 10).

---

## EXECUTION STEPS

### Steps 1–6: Implement (identical to implement-feature)

Execute Steps 1 through 6 of the `implement-feature` skill verbatim:

1. **Resolve Input** — locate feature folder, PRD, and all three files.
2. **Load Context** — read `spec.md`, `plan.md`, `contract.md` in full.
3. **Apply Overrides** — parse extra natural-language instructions.
4. **Pre-flight Dependency Check** — contract sanity + feature dependencies.
5. **Execute Phases** — implement phase by phase, validate, commit.
6. **Final Verification** — full-suite run, Component Overview walk-through, Prerequisites walk-through, AC pass-through, environment smoke check, status decision.

If Steps 1–6 result in `aborted at phase <N>`, skip Steps 7–9 and go directly to Step 10 (Final Report).

---

### Step 7: Contract Evaluation

This is the **authoritative evaluator pass** — distinct from the per-phase and Step 6 validations. Its sole purpose is to produce a definitive pass/fail signal for the project schedule.

**7.1 — Discover and run the full test suite**

Inspect `package.json` scripts (or equivalent: `Makefile`, `pyproject.toml`, `Cargo.toml`) and identify:
- Unit/integration test command (e.g., `npm test`, `npx vitest run`)
- E2E test command (e.g., `npx playwright test`)

Run all available commands. Capture full output including individual test names and error messages.

**7.2 — Parse results**

For each failing test:
- Record the test name and error summary.
- Attempt to map it to a GTW item ID using the `contract.md` Coverage Manifest: match the test name or the AC text it covers to the manifest rows (semantic match — exact name match is not required).
- If a test cannot be mapped to a GTW ID, store it as its raw test name.

Build two lists:
- `passing_gtw`: GTW IDs whose covering tests all passed.
- `blocking_gtw`: GTW IDs (or raw test names) with at least one failing test.

**7.3 — Decision**

- If `blocking_gtw` is empty → **evaluation passed**. Go to Step 9.
- If `blocking_gtw` is non-empty → **evaluation failed**. Go to Step 8.

---

### Step 8: Fix Loop (max 3 retries)

Execute up to **3 fix attempts**. A fix attempt is the full cycle: read → fix → re-run.

**For each attempt:**

**8.1 — Read error context**

For each item in `blocking_gtw`:
- Read the full error output captured in Step 7.2 (or the prior attempt's output).
- Read the relevant source files identified by `spec.md`'s Component Overview and `contract.md`'s GTW item bodies (given/when/then).
- Identify the root cause.

**8.2 — Apply fix**

Edit only the source files responsible for the failure. Do not modify test files unless the test itself contains a factual error (wrong selector, wrong URL, wrong fixture path). Do not insert service stubs in production modules.

**8.3 — Re-run test suite**

Run the same commands as Step 7.1. Capture output.

**8.4 — Re-evaluate**

Rebuild `passing_gtw` and `blocking_gtw` from the new output.

- If `blocking_gtw` is empty → **evaluation passed**. Go to Step 9.
- If retries remain → increment counter, return to 8.1.
- If retries exhausted (3 attempts done) → **evaluation failed with retries exhausted**. Go to Step 9.

---

### Step 9: Update `docs/prd_progress.json`

Locate the feature entry by matching `id` to the resolved feature ID.

**On evaluation passed:**

```json
"evaluation": {
  "status": "passed",
  "last_run": "<YYYY-MM-DD>"
}
```

For each AC in `acceptance_criteria` whose GTW ID is in `passing_gtw` (or all ACs if full suite passed), set `"status": "verified"`.

**On evaluation failed (retries exhausted):**

```json
"evaluation": {
  "status": "failed",
  "retries_exhausted": <N>,
  "blocking_tests": ["GTW-04", "GTW-07"],
  "last_run": "<YYYY-MM-DD>"
}
```

ACs covered by items in `passing_gtw` → `"verified"`. ACs covered by items in `blocking_gtw` → keep current status (do not downgrade).

Write the updated JSON back to `docs/prd_progress.json`. Do not reformat unrelated entries — preserve the existing structure.

---

### Step 10: Final Report

Output to chat. Mirrors the `implement-feature` report format, extended with the evaluation result:

```
Feature F<ID> — <name>

Status: success | completed with regressions | incomplete | aborted at phase <N> | evaluation failed
Phases: <N> committed / <M> total
Branch: <current-branch>
Evaluation: passed | failed (after <N> fix retries)

Acceptance Criteria:
~ <AC text> [<GTW ID>] — verified
✗ <AC text> [<GTW ID>] — blocking (test: <test name>: <error summary>)

Fix Attempts (if any):
1. <what was changed and why>
2. <what was changed and why>
3. <what was changed and why>

prd_progress.json: updated (evaluation.<status>)

[remaining sections from implement-feature report]
Missing from spec / Regressions / Deviations / Soft-fails /
Pre-existing failures / Overrides applied / Overrides ignored /
Abort reason (if any)
```

If evaluation failed after retries, the report states clearly which tests are still blocking and what was attempted in each fix cycle.

---

## RULES

All rules from `implement-feature` apply unchanged, plus:

**Always:**
- Run the full test suite in Step 7 even if Step 6 already ran it — Step 7 is the authoritative evaluator pass.
- Map failing tests to GTW IDs semantically via the Coverage Manifest; fall back to raw test name if no mapping found.
- Update `docs/prd_progress.json` regardless of evaluation outcome (pass or fail).
- Set `"status": "verified"` only for ACs whose covering tests actually passed.
- Limit fix retries to exactly 3.

**Never:**
- Modify test files to force a pass (removing assertions, hardcoding expected values).
- Insert service stubs in production modules during the fix loop.
- Update `prd_progress.json` before Step 9 (evaluation must complete first).
- Skip Step 7 because Step 6 already ran the suite.
- Claim `evaluation: passed` when any item in `blocking_gtw` remains.

---

## Overrides

All overrides from `implement-feature` apply. Additional overrides:

- **Fix retries**: `max 5 fix tries`, `no fix retries` — changes the Step 8 retry limit.
- **Skip fix loop**: `skip fix loop` — if evaluation fails, skip Step 8 and go directly to Step 9 with failure status.

**Immutable core (cannot be overridden):** Steps 7 and 9 — the evaluator pass and the `prd_progress.json` update always run.
