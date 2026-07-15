---
name: implement-and-evaluate
description: Implementa uma feature fase a fase, executa o avaliador de contrato (suíte de testes completa), aciona o fix-runner automático em caso de falha (até 3 retries), e atualiza prd_progress.json com o resultado.
---

# Implement and Evaluate

Autonomously implement a feature from its `spec.md` + `plan.md` + `contract.md` triple, then run the full test suite as a contract evaluator. On failure, attempt fixes (up to 3 retries). Update `docs/prd_progress.json` with the final evaluation result.

---

## INPUT

Free-form. Any combination works:
- Feature identifier: `F09`, `Video Upload`, or similar.
- Feature folder: `docs/F09-in-video-transcription-search/`.
- File inside the feature folder: `docs/F09-in-video-transcription-search/spec.md`.
- Extra natural-language instructions appended anywhere (see **Overrides**).

The skill locates:
1. **`spec.md` + `plan.md` + `contract.md`** — siblings in the same folder. If input points to a folder, look inside. If to a file, look in its parent. If to an ID/name, search under `docs/` for `<ID>-*`.
2. **The PRD** — auto-discover: `docs/PRD.md` → `PRD.md` → any top-level `*.md` that reads like a product spec. Abort if none or multiple found.
3. **`docs/prd_progress.json`** — auto-discover at repo root under `docs/`. Abort if not found.

---

## OUTPUT

- **Commits**: one per implementation phase on the current branch.
- **Updated `docs/prd_progress.json`**: evaluation result recorded under the feature entry.
- **Chat report** at the end (Step 10).

---

## EXECUTION STEPS

### Step 1: Resolve Input

Parse the entire input as free-form. Extract:
- **Feature reference**: first token that resolves to a folder containing `spec.md` + `plan.md` + `contract.md`. Matches: `F\d+`, folder paths, file paths (parent = target), feature names (kebab-case + fuzzy match under `docs/`).
- **PRD reference**: explicit `*.md` path prefixed with `@` or written literally; if it reads like a PRD, accept it. Otherwise auto-discover.
- **Extra instructions**: remaining text that isn't a path/ID/name → natural-language overrides (Step 3).

Abort conditions:
- `spec.md`, `plan.md`, or `contract.md` missing → abort: "`<missing_file>` missing in `<folder>`. Regenerate via `spec-writer`."
- No PRD found → abort: "No PRD found. Pass the path explicitly."
- Multiple plausible PRDs → abort and list candidates.
- Ambiguous feature reference → abort and list candidates.

### Step 2: Load Context

Read in full:
- **`spec.md`** — Component Overview, Data Model, API Contracts, Business Rules, UX Flows, Error Handling, Testing Strategy, Assumptions/Decisions. Canonical source for internal structure (file paths, schema, library choices, naming).
- **`plan.md`** — phases and steps in order.
- **`contract.md`** — extract three things:
  - **Coverage Manifest** — table mapping PRD AC text → covering item IDs. Single source of truth for in-scope ACs. ACs absent from the manifest are out of scope for this run.
  - **Prerequisites** — three in-scope subsections: `Persistent state`, `Static inputs`, `Configuration`. Each entry describes an author-time artifact the implementer must produce. `Runtime services` and `External dependencies` are for the evaluator — load for context only, do not act on them.
  - **Item bodies** (given/when/then per surface) — canonical source of boundary behavior. Items dictate observable contracts (HTTP status, response shape, DB side-effects, error codes, UI selectors). Items do NOT dictate internal structure. When `spec.md` and items disagree on observable behavior, **items win**; spec wins on structure. Record tie-breaks in `Deviations`.

If `contract.md` has an empty/absent Coverage Manifest or missing Prerequisites section → abort (see Step 4).

Do NOT explore the codebase eagerly. Open files lazily as each phase requires them.

### Step 3: Apply Overrides

| Default | Example overrides |
|---|---|
| Hard-fail retry limit = 3 | "no retry limit", "max 5 tries" |
| Fully autonomous | "pause between phases" — wait for `ok`/`continue`/`yes` |
| 1 commit per phase | "single commit at the end", "no commits" |
| Run lint + typecheck + tests | "skip tests", "skip lint", "skip typecheck" |
| Implement all phases | "only phases 1 and 2", "skip phase 3" |
| Abort tests on external dep missing | "stub missing services" — stubs in test code only, never in production |
| Fix retries = 3 | "max 5 fix tries", "no fix retries" |
| Run fix loop on failure | "skip fix loop" — go directly to Step 9 with failure status |

Record each recognized override (before/after) for the report's "Overrides applied" section.

**Immutable core (cannot be overridden):** loading `contract.md`, running Steps 7 and 9 (evaluator pass and `prd_progress.json` update), and rendering the AC report. Instructions that would disable any of these → logged under "Overrides ignored".

Ambiguous/contradictory instructions → default wins; logged under "Overrides ignored" with "ambiguous, kept default".

### Step 4: Pre-flight Dependency Check

**4.1 — Contract sanity:**
- `contract.md` has a recognizable `## Coverage Manifest` section → proceed.
- Coverage Manifest empty or absent → abort: "F<target>'s contract has no in-scope ACs. Regenerate via `spec-writer`."
- `contract.md` has no `## Prerequisites` section or it is malformed → abort with same message.

**4.2 — Feature dependencies:**
Locate dependency content in the PRD semantically (headings: "Dependency Graph", "Dependencies"; shape: table or list). For each listed dependency, verify it is implemented in the codebase (characteristic files from its `spec.md` Component Overview or obvious source markers).
- Any dependency missing → abort: "F<target> depends on F<N>, which is not implemented yet."
- All dependencies present → proceed.
- No dependency content in PRD → skip 4.2 and proceed.

### Step 5: Execute Phases

For each phase of `plan.md`, in order:

**5.1 — Skip if already done**
Inspect last ~20 commits. If any commit indicates this exact phase already ran (same feature ID + phase name/ordinal), skip with `— already committed`.

**5.2 — Implement**
Read `spec.md` sections relevant to the phase. Edit/create files to fulfill the phase steps.

A phase is "done" only when ALL of the following hold:
- Every file listed for this phase in spec.md's Component Overview exists with described content.
- Every contract (API, schema, function signature) described for this phase matches what was written.
- Validation in 5.3 passes.
- If the phase produces runtime behavior not covered by unit tests (UI pages, routes, migrations, CLI), actually exercise it before claiming done. If environment can't be brought up, log under `Soft-fails`.

Adapt when reality diverges from spec (different column names, file names, compatible types). Record every adaptation in `Deviations`. Do NOT abort on minor divergences.

**Abort the run only on:**
- Dependency feature missing (if discovered mid-phase).
- Hard fail past retry limit in 5.3.

Missing external dependencies needed only by tests → soft-fail the affected test; keep implementing.

**5.3 — Validate**
Discover commands at runtime: inspect `package.json` scripts, `Makefile`, `pyproject.toml`, `Cargo.toml`, etc.

- **Hard fail** = non-zero exit from lint/typecheck/unit tests, attributable to code this run changed. Retry up to configured limit. After limit → abort run, go to Step 6.
- **Soft fail** = validation can't execute in this environment. Skip, log under `Soft-fails`, proceed.
- **Pre-existing failure** = failure not attributable to this run. Log under `Pre-existing failures`, do NOT count against retry budget, proceed.

Warnings without non-zero exit are never failures.

**5.4 — Commit**
If validation passed, stage only the files this phase touched and commit. Match the project's commit style (inspect last ~10 commits). Fallback: `feat(F<ID>): <phase name>`. No `git add -A`. No skipping hooks. If commits are disabled by override, skip this sub-step.

**5.5 — Proceed**
Move to next phase. Run-level abort stops execution and goes to Step 6 with whatever phases committed.

### Step 6: Final Verification

After the last phase commits (or on abort), run independent verification before writing the report. All sub-steps are mandatory.

**6.1 — Full-suite validation**
Run the full validation suite on the entire repo (not just touched files): lint, typecheck, complete test suite.
- New failures not flagged per-phase → **regressions**. Attempt to fix up to the retry limit. If still failing → status `completed with regressions`; list under `Regressions`.
- Pre-existing failures stay categorized as pre-existing.

**6.2 — Component Overview walk-through**
For every file listed in spec.md's Component Overview, verify: file exists, described role is visible, exports/routes/schemas match spec within adaptation rules of 5.2.
- Missing file/export/contract → add to `Missing from spec`. Do NOT claim success if non-empty.

**6.3 — Contract Prerequisites walk-through**
For each entry under `Persistent state`, `Static inputs`, and `Configuration` in `contract.md`, verify an author-time artifact makes the entry true. Level-2 rigor: presence + lightweight intrinsic check using tools the contract already assumes available.

**6.4 — AC pass-through over the Coverage Manifest**
For each AC row in `contract.md`'s Coverage Manifest:
- Read the verbatim AC text (column 1) and covering item IDs (column 2).
- Compute a readiness mark from upstream Step 6 results — never by running an AC-specific test:
  - `~ ready` — Step 6.1 green AND Step 6.3 green AND no `Missing from spec` overlaps files the covering items would reference.
  - `✗ blocked` — any of the above is red.
- Render as: `<mark> <verbatim AC text> [<item IDs>]`.
- ACs absent from Coverage Manifest are out of scope — no mention.

**6.5 — Environment smoke check (when applicable)**
If the feature produces runtime surfaces that per-phase validation couldn't exercise (UI page, HTTP endpoint, migration, CLI), do one final exercise against a local environment. A quick load-and-interact suffices.
- If environment can't be brought up → log each skipped check under `Soft-fails`. A `UI-*` / `E2E-*` smoke check skipped because the browser/server couldn't be started is **blocked**, not soft-fail — it prevents `success`.

**6.6 — Status decision**
- `success` — 6.1 green, every Component Overview item present (6.2), every AC `~ ready` (6.4), every Prerequisite `produced` (6.3), every smoke check passed or honestly soft-failed (6.5).
- `completed with regressions` — phases committed but 6.1 found unresolved failures.
- `incomplete` — `Missing from spec` (6.2) non-empty, OR `Missing Prerequisites` (6.3) non-empty after remediation, OR any AC blocked (6.4).
- `aborted at phase <N>` — run stopped during Step 5.

Never report `success` when any check above has an unresolved failure.

### Step 7: Contract Evaluation

Authoritative evaluator pass — distinct from per-phase and Step 6 validations. Sole purpose: produce a definitive pass/fail for the project schedule.

**7.1 — Run the full test suite**
Inspect `package.json` scripts (or equivalent) and identify unit/integration and E2E commands. Run all. Capture full output including individual test names and error messages.

**7.2 — Parse results**
For each failing test:
- Record the test name and error summary.
- Map to a GTW item ID via the Coverage Manifest (semantic match; fall back to raw test name).

Build:
- `passing_gtw`: GTW IDs whose covering tests all passed.
- `blocking_gtw`: GTW IDs (or raw test names) with at least one failing test.

**7.3 — Decision**
- `blocking_gtw` empty → **evaluation passed**. Go to Step 9.
- `blocking_gtw` non-empty → **evaluation failed**. Go to Step 8.

### Step 8: Fix Loop (max 3 retries, configurable)

**For each attempt (up to configured limit):**

**8.1 — Read error context**
For each item in `blocking_gtw`:
- Read the full error output from the last run.
- Read the GTW item body from `contract.md` (ground truth for expected behavior).
- Read relevant source files from `spec.md`'s Component Overview.
- Identify the root cause.

**8.2 — Apply fix**
Edit only source files responsible for the failure. Allowed: application source files and fixture files if the fixture itself is wrong.
Not allowed: removing/weakening test assertions, inserting service stubs in production modules, modifying test logic to skip failing scenarios.

**8.3 — Re-run test suite**
Same commands as 7.1. Capture output.

**8.4 — Re-evaluate**
Rebuild `passing_gtw` and `blocking_gtw`.
- `blocking_gtw` empty → **evaluation passed**. Go to Step 9.
- Retries remain → increment counter, return to 8.1.
- Retries exhausted → **evaluation failed with retries exhausted**. Go to Step 9.

### Step 9: Update `docs/prd_progress.json`

Locate the feature entry by matching `id`.

**On evaluation passed:**
```json
"evaluation": {
  "status": "passed",
  "last_run": "<YYYY-MM-DD>"
}
```
For each AC whose GTW ID is in `passing_gtw` (or all ACs if full suite passed), set `"status": "verified"`.

**On evaluation failed (retries exhausted):**
```json
"evaluation": {
  "status": "failed",
  "retries_exhausted": <N>,
  "blocking_tests": ["GTW-04", "GTW-07"],
  "last_run": "<YYYY-MM-DD>"
}
```
ACs in `passing_gtw` → `"verified"`. ACs in `blocking_gtw` → keep current status.

Write the updated JSON back. Do not reformat unrelated entries.

### Step 10: Final Report

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

Missing from spec:
- <file/export/contract missing>

Regressions:
- <test name>: <error>

Deviations:
- <what was adapted and why>

Soft-fails:
- <what was skipped and why>

Pre-existing failures:
- <test name>: failed on entry; left as-is

Overrides applied:
- <default> → <override>

Overrides ignored:
- "<text>" (reason)

Abort reason (if aborted): <error>
```

If evaluation failed after retries, the report states clearly which tests are still blocking and what was attempted in each fix cycle.

---

## RULES

**Always:**
- Require `spec.md` + `plan.md` + `contract.md` in the target folder; abort without them.
- Locate AC and dependency content in the PRD semantically, never by fixed section number.
- Commit 1 per phase (default), staging only files that phase touched. Match the project's commit-message style.
- Adapt to minor spec/code divergences; log every adaptation under `Deviations`.
- Run validation after each phase; differentiate hard-fail (retry ≤ limit) / soft-fail (skip + log) / pre-existing failure (log, don't retry).
- Before claiming a phase is "done": confirm every file listed exists with described content AND validation has passed.
- Execute Step 6 (Final Verification) in full before reporting.
- Run the full test suite in Step 7 even if Step 6 already ran it — Step 7 is the authoritative evaluator pass.
- Map failing tests to GTW IDs semantically via the Coverage Manifest; fall back to raw test name.
- Update `docs/prd_progress.json` regardless of evaluation outcome.
- Set `"status": "verified"` only for ACs whose covering tests actually passed.

**Never:**
- Claim `success` when Step 6 found regressions, missing-from-spec items, or unresolved failures.
- Claim `evaluation: passed` when any item in `blocking_gtw` remains.
- Skip Step 6 or Step 7.
- Create or switch branches.
- Use `git add -A` or `git add .`. Skip git hooks.
- Count pre-existing test failures against the retry budget.
- Re-run phases already committed on the branch.
- Insert service stubs in production modules.
- Modify test files to force a pass (removing assertions, hardcoding expected values).
- Update `prd_progress.json` before Step 9 (evaluation must complete first).
- Explore the codebase upfront — read files lazily as phases require.

---

## Edge Cases

**No PRD found:** abort before starting.
**No spec.md, plan.md, or contract.md:** abort before starting.
**Dependency feature not implemented:** abort at Step 4.
**Ambiguous feature reference:** list candidates, abort.
**Unrelated working-tree changes at start:** proceed — commits stage only phase-specific files.
**Phase name with special characters:** fallback to `feat(F<ID>): implement phase <N>`.
**Re-invocation after partial run:** Step 5.1 detects already-committed phases and skips them. Uncommitted working-tree changes from prior interrupted run stay as-is.
**Hard fail past limit on a step not part of any AC:** abort anyway. User can override with `skip tests` or similar.
**External tool emits warnings only:** warnings are not failures. Only non-zero exit counts.
**Override contradicts the core contract:** ignore it; log under "Overrides ignored"; proceed.
**Validation commands not discoverable:** log each missing command under `Soft-fails`; proceed.
**PRD has no AC content for this feature:** proceed with empty AC checklist; note under soft-fails.
**PRD has no dependency content:** skip Step 4.2 and proceed.
**Commit-message style inconsistent in recent history:** fallback to `feat(F<ID>): <phase name>`.
