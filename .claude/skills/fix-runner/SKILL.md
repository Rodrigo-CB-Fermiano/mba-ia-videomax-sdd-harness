---
name: fix-runner
description: Lê os testes bloqueantes de uma feature no prd_progress.json, aplica correções cirúrgicas no código, re-executa a suíte e atualiza o cronograma. Invocável manualmente após intervenção humana ou automaticamente pelo implement-and-evaluate.
---

# Fix Runner

Targeted fix agent for features that failed the contract evaluation. Reads the blocking GTW items from `docs/prd_progress.json`, inspects the actual test failures, applies code fixes (up to 3 retries), and updates the schedule with the new result.

Designed to be called:
- **Automatically** by `implement-and-evaluate` when its built-in fix loop is exhausted and the user wants a fresh standalone attempt after manual inspection.
- **Manually** by the user (e.g., `/fix-runner F01`) after investigating and/or patching the code themselves, to re-evaluate and update the schedule.

---

## INPUT

Free-form. Any combination works:

- A feature identifier: `F01`, `Authentication System`, etc.
- A feature folder: `docs/F01-authentication-system/`.
- A file inside the feature folder.

The skill needs:
1. **`contract.md`** — in the feature folder. Contains GTW item bodies (given/when/then) and the Coverage Manifest.
2. **`spec.md`** — in the feature folder. Contains the Component Overview (file locations, code structure).
3. **`docs/prd_progress.json`** — at the repo root level. Source of blocking test IDs and current evaluation state.

---

## OUTPUT

- **Code changes** committed to the current branch (one commit per successful fix cycle that resolves blocking tests).
- **Updated `docs/prd_progress.json`** — evaluation result overwritten with the new run's outcome.
- **Chat report** at the end (Step 5).

---

## EXECUTION STEPS

### Step 1: Resolve Input

**1.1 — Locate feature files**

Parse the input to extract the feature reference. Resolve to a folder under `docs/` matching `<ID>-*` or a fuzzy name match.

- If `contract.md` is missing → abort: "`contract.md` missing in `<folder>`. Regenerate via `spec-writer`."
- If `spec.md` is missing → abort: "`spec.md` missing in `<folder>`. Regenerate via `spec-writer`."

**1.2 — Read `docs/prd_progress.json`**

Locate the feature entry by `id`. Read the `evaluation` object:

```json
"evaluation": {
  "status": "failed",
  "retries_exhausted": 3,
  "blocking_tests": ["GTW-04", "GTW-07"],
  "last_run": "2026-07-15"
}
```

- If `evaluation.status` is `"passed"` → abort: "F<ID> evaluation already passed on <last_run>. Nothing to fix."
- If `evaluation` key is absent → the feature was never evaluated. Proceed as if `blocking_tests` is empty (full suite run in Step 2 will determine failures).

Extract `blocking_tests` (list of GTW IDs or raw test names).

**1.3 — Load contract context**

Read `contract.md` in full. For each GTW ID in `blocking_tests`, extract the full GTW item body (given/when/then) — this describes the observable behavior the test is asserting.

Read `spec.md`'s Component Overview to understand which source files are relevant to each blocking GTW item.

---

### Step 2: Gather Current Failure Context

Run the full test suite to get fresh failure output. Do not rely solely on the `blocking_tests` list from `prd_progress.json` — the user may have partially fixed things since the last run.

**2.1 — Discover and run test suite**

Inspect `package.json` scripts (or equivalent) and identify:
- Unit/integration test command (e.g., `npm test`, `npx vitest run`)
- E2E test command (e.g., `npx playwright test`)

Run all available commands. Capture full output.

**2.2 — Parse results**

Build fresh `passing_gtw` and `blocking_gtw` lists using the same mapping logic as `implement-and-evaluate` Step 7.2 (semantic match of test names → GTW IDs via Coverage Manifest; fall back to raw test name).

- If `blocking_gtw` is empty → the user's manual intervention already resolved everything. Skip to Step 4 (update schedule as passed).
- Otherwise → proceed to Step 3.

---

### Step 3: Fix Loop (max 3 retries)

Execute up to **3 fix attempts**. Each attempt is the full cycle: read → fix → re-run.

**For each attempt:**

**3.1 — Read error context**

For each item in `blocking_gtw`:
- Read the full error output from the last test run.
- Read the GTW item body from `contract.md` (the ground truth for expected behavior).
- Read the relevant source files from `spec.md`'s Component Overview.
- Identify the root cause.

**3.2 — Apply fix**

Edit only the source files responsible for the failure. Allowed targets:
- Application source files (services, components, API routes, database queries, config).
- Test fixture files if the fixture itself is wrong (wrong path, wrong format, wrong data shape).

Not allowed:
- Removing or weakening test assertions to force a pass.
- Inserting service stubs in production modules.
- Modifying test logic to skip the failing scenario.

**3.3 — Re-run test suite**

Run the same commands as Step 2.1. Capture output.

**3.4 — Re-evaluate**

Rebuild `passing_gtw` and `blocking_gtw` from the new output.

- If `blocking_gtw` is empty → **evaluation passed**. Commit the fix (Step 3.5), go to Step 4.
- If retries remain → increment counter, return to 3.1.
- If retries exhausted (3 attempts done) → **evaluation failed with retries exhausted**. Go to Step 4 with failure status.

**3.5 — Commit on resolution**

If the fix loop resolved all blocking tests, stage only the files changed during this fix session and commit:

```
fix(F<ID>): resolve evaluation blockers [GTW-xx, GTW-yy]
```

Match the project's recent commit-message style. Do not use `git add -A` or `git add .`. Do not skip hooks.

---

### Step 4: Update `docs/prd_progress.json`

Locate the feature entry. Overwrite the `evaluation` object entirely.

**On evaluation passed:**

```json
"evaluation": {
  "status": "passed",
  "last_run": "<YYYY-MM-DD>"
}
```

For each AC in `acceptance_criteria` whose GTW ID is in `passing_gtw` (or all ACs if `blocking_gtw` was empty from the start), set `"status": "verified"`.

**On evaluation failed (retries exhausted):**

```json
"evaluation": {
  "status": "failed",
  "retries_exhausted": <N>,
  "blocking_tests": ["GTW-xx", "GTW-yy"],
  "last_run": "<YYYY-MM-DD>"
}
```

ACs covered by items in `passing_gtw` → `"verified"`. ACs in `blocking_gtw` → keep current status.

Write the updated JSON back preserving the rest of the file structure.

---

### Step 5: Report

Output to chat:

```
Fix Runner — F<ID> <name>

Outcome: passed | failed (after <N> retries)
Blocking tests on entry: <GTW-xx, GTW-yy, ...>
Resolved: <GTW IDs now passing>
Still blocking: <GTW IDs still failing> (if any)

Fix Attempts:
1. <root cause identified> → <what was changed>
   Result: <resolved / still failing>
2. <root cause identified> → <what was changed>
   Result: <resolved / still failing>
3. ...

prd_progress.json: updated (evaluation.<status>)

Acceptance Criteria:
~ <AC text> [<GTW ID>] — verified
✗ <AC text> [<GTW ID>] — still blocking: <error summary>
```

If the manual intervention by the user already resolved everything (blocking_gtw empty in Step 2), the report notes this explicitly.

---

## RULES

**Always:**
- Re-run the full test suite in Step 2 — do not trust the `prd_progress.json` failure list as current truth.
- Map failing test names to GTW IDs semantically; fall back to raw test name.
- Update `docs/prd_progress.json` in Step 4 regardless of outcome.
- Set `"status": "verified"` only for ACs whose tests actually passed in this run.
- Limit fix retries to exactly 3.
- Commit fixes only when the fix loop resolves the blockers — do not commit partial fixes.

**Never:**
- Remove or weaken test assertions to force a pass.
- Insert service stubs in production modules.
- Skip Step 2 (fresh suite run) and rely solely on the stored `blocking_tests`.
- Update `prd_progress.json` before the evaluation in Step 2/3 is complete.
- Claim `evaluation: passed` when any item in `blocking_gtw` remains.

---

## Edge Cases

**All blocking tests already pass on entry (Step 2):** User's manual fix resolved everything. Skip Step 3, go to Step 4 with passed status.

**`evaluation` key absent in `prd_progress.json`:** Feature was never evaluated. Run full suite (Step 2), treat all failures as new blocking items, proceed normally.

**Test suite commands not discoverable:** Abort: "Cannot discover test commands in this project. Inspect `package.json` scripts and pass the test command explicitly."

**Partial resolution after retries:** Some GTW items pass, others still block. Update `prd_progress.json` with partial state — `evaluation.status = "failed"`, `blocking_tests` contains only the remaining blockers, ACs for passing items → `"verified"`.

**Fix introduces a regression (previously passing test now fails):** The new failure is added to `blocking_gtw`. If it was a GTW item not in the original `blocking_tests`, it is listed separately in the report under "Regressions introduced by fix". The retry budget continues counting.
