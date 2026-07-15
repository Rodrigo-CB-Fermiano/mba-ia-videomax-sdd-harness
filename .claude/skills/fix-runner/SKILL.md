---
name: fix-runner
description: Lê os testes bloqueantes de uma feature no prd_progress.json, aplica correções cirúrgicas no código, re-executa a suíte e atualiza o cronograma. Invocável manualmente após intervenção humana ou automaticamente pelo implement-and-evaluate.
---

# Fix Runner

Targeted fix agent for features that failed contract evaluation. Reads blocking GTW items from `docs/prd_progress.json`, inspects actual test failures, applies code fixes (up to 3 retries), and updates the schedule.

Called:
- **Automatically** by `implement-and-evaluate` when its fix loop is exhausted.
- **Manually** by the user (e.g., `/fix-runner F01`) after investigating or patching code themselves.

---

## INPUT

Free-form: feature identifier (`F01`), feature folder (`docs/F01-authentication-system/`), or file inside the folder.

Needs:
1. **`contract.md`** — GTW item bodies and Coverage Manifest.
2. **`spec.md`** — Component Overview (file locations).
3. **`docs/prd_progress.json`** — blocking test IDs and current evaluation state.

---

## EXECUTION STEPS

### Step 1: Resolve Input

**1.1 — Locate feature files**
Resolve input to a folder under `docs/` matching `<ID>-*` or fuzzy name.
- `contract.md` missing → abort: "`contract.md` missing in `<folder>`. Regenerate via `spec-writer`."
- `spec.md` missing → abort: "`spec.md` missing in `<folder>`. Regenerate via `spec-writer`."

**1.2 — Read `docs/prd_progress.json`**
Locate feature entry by `id`. Read the `evaluation` object:
- `evaluation.status` is `"passed"` → abort: "F<ID> evaluation already passed on <last_run>. Nothing to fix."
- `evaluation` key absent → feature never evaluated. Proceed as if `blocking_tests` is empty (full suite run in Step 2 determines failures).

Extract `blocking_tests` (list of GTW IDs or raw test names).

**1.3 — Load contract context**
Read `contract.md` in full. For each GTW ID in `blocking_tests`, extract the full GTW item body (given/when/then). Read `spec.md`'s Component Overview to identify relevant source files.

---

### Step 2: Gather Current Failure Context

Do not rely solely on `blocking_tests` from `prd_progress.json` — user may have partially fixed things.

**2.1 — Run the full test suite**
Inspect `package.json` scripts (or equivalent) and identify unit/integration and E2E commands. Run all. Capture full output.

**2.2 — Parse results**
Build fresh `passing_gtw` and `blocking_gtw` using semantic match of test names → GTW IDs via Coverage Manifest; fall back to raw test name.
- `blocking_gtw` empty → user's manual intervention resolved everything. Skip to Step 4 (update as passed).
- Otherwise → proceed to Step 3.

---

### Step 3: Fix Loop (max 3 retries)

**For each attempt:**

**3.1 — Read error context**
For each item in `blocking_gtw`:
- Read the full error output from the last test run.
- Read the GTW item body (ground truth for expected behavior).
- Read relevant source files from `spec.md`'s Component Overview.
- Identify the root cause.

**3.2 — Apply fix**
Edit only source files responsible for the failure. Allowed: application source files and fixture files if the fixture itself is wrong (wrong path, format, data shape).
Not allowed: removing/weakening test assertions, inserting service stubs in production modules, modifying test logic to skip failing scenarios.

**3.3 — Re-run test suite**
Same commands as 2.1. Capture output.

**3.4 — Re-evaluate**
Rebuild `passing_gtw` and `blocking_gtw`.
- `blocking_gtw` empty → **passed**. Commit the fix (3.5). Go to Step 4.
- Retries remain → increment counter, return to 3.1.
- Retries exhausted → **failed with retries exhausted**. Go to Step 4.

**3.5 — Commit on resolution**
Stage only files changed during this fix session:
```
fix(F<ID>): resolve evaluation blockers [GTW-xx, GTW-yy]
```
Match project's recent commit style. No `git add -A`. No skipping hooks.

---

### Step 4: Update `docs/prd_progress.json`

Locate the feature entry. Overwrite the `evaluation` object entirely.

**Passed:**
```json
"evaluation": {
  "status": "passed",
  "last_run": "<YYYY-MM-DD>"
}
```
ACs whose GTW ID is in `passing_gtw` (or all ACs if `blocking_gtw` was empty from the start) → `"status": "verified"`.

**Failed (retries exhausted):**
```json
"evaluation": {
  "status": "failed",
  "retries_exhausted": <N>,
  "blocking_tests": ["GTW-xx", "GTW-yy"],
  "last_run": "<YYYY-MM-DD>"
}
```
ACs in `passing_gtw` → `"verified"`. ACs in `blocking_gtw` → keep current status.

Write updated JSON back, preserving the rest of the file structure.

---

### Step 5: Report

```
Fix Runner — F<ID> <name>

Outcome: passed | failed (after <N> retries)
Blocking tests on entry: <GTW-xx, GTW-yy, ...>
Resolved: <GTW IDs now passing>
Still blocking: <GTW IDs still failing> (if any)

Fix Attempts:
1. <root cause> → <what was changed>   Result: resolved / still failing
2. ...

prd_progress.json: updated (evaluation.<status>)

Acceptance Criteria:
~ <AC text> [<GTW ID>] — verified
✗ <AC text> [<GTW ID>] — still blocking: <error summary>
```

If manual intervention already resolved everything (blocking_gtw empty in Step 2), note this explicitly.

---

## RULES

**Always:**
- Re-run the full test suite in Step 2 — do not trust the `prd_progress.json` failure list as current truth.
- Map failing test names to GTW IDs semantically; fall back to raw test name.
- Update `docs/prd_progress.json` in Step 4 regardless of outcome.
- Set `"status": "verified"` only for ACs whose tests actually passed in this run.
- Limit fix retries to exactly 3.
- Commit fixes only when the fix loop resolves all blockers.

**Never:**
- Remove or weaken test assertions to force a pass.
- Insert service stubs in production modules.
- Skip Step 2 (fresh suite run) and rely solely on stored `blocking_tests`.
- Update `prd_progress.json` before evaluation in Steps 2/3 is complete.
- Claim `evaluation: passed` when any item in `blocking_gtw` remains.

---

## Edge Cases

**All blocking tests pass on entry (Step 2):** skip Step 3; go to Step 4 with passed status.
**`evaluation` key absent:** feature never evaluated; run full suite in Step 2; treat all failures as new blocking items.
**Test suite commands not discoverable:** abort: "Cannot discover test commands. Inspect `package.json` scripts and pass the test command explicitly."
**Partial resolution after retries:** `evaluation.status = "failed"`, `blocking_tests` contains only remaining blockers; ACs for passing items → `"verified"`.
**Fix introduces a regression:** new failure added to `blocking_gtw`. If not in original `blocking_tests`, listed under "Regressions introduced by fix". Retry budget continues counting.
