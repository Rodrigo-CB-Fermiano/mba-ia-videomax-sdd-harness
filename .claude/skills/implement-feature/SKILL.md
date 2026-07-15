---
name: implement-feature
description: Implements a feature autonomously based on its spec and plan and behavior contract; commits one commit per phase produces every contract Prerequisite as authored artifacts, and reports prliminary readiness against the contract´s Coverage Manifest.
---

# Implement Feature

Autonomously implement a feature from its existing `spec.md` + `plan.md` + `contract.md` triple. The skill reads the feature's technical specification (structure), the behavior contract (boundary behavior + prerequisites), and implementation plan (phase order). It writes the code phase by phase, produces every author-time artifact the contract´s Prerequisites declare (fixtures, seeds, migrations, config defaults), validates each phase, commits, and reports preliminary readiness for a downstream **contract evaluator** agent.

The skill **does not** verify contract items itself (that is the evaluator's job). It produces the artifacts the artifacts so the contract is executable, and 
gives a readiness signal in its report.

## INPUT

<!-- Free-form. The skill figures out what was passed. Any combination works:

- A feature identifier: `F09`, `Video Upload`, or similar.
- A feature folder: `docs/F09-in-video-transcription-search/`, `./F09/`, etc.
- A file inside the feature folder: `docs/F09-in-video-transcription-search/spec.md`.
- A PRD path: `@docs/PRD.md`, `docs/PRD.md`, `@PRD.md`.
- Extra natural-language instructions appended anywhere (see **Overrides**). -->

The skill only needs to locate three files and one reference source:

1. **`spec.md` and `plan.md` and `contract.md`** for the target feature - all three live as siblings int the same folder. generate together by `spec-writer`. If the input points to a folder, look inside. If it points to a file, look in its parent folder. If it points to an ID or name, search under `docs/` for a folder matching `<ID>-*` or whose name kebab-cases to the given name.
2. **The PRD**. If explicitly passed, use it. Otherwise, auto-discover: `docs/PRD.md` → `PRD.md` → any top-level `*.md` whose content reads like a product spec. If none found, abort. If multiple are plausible, abort and list them. (the PRD is needed for context and for the dependency-graph pre-flight; it is **not** the source acceptance criteria verification - that role belongs to `contract.md`´s Coverage Manifest.)

## OUTPUT

- **Commits**: one per phase of `plan.md`, on the current branch (no branch creation, no branch switching). Additionl commits may be produced by the contract-prerequisite walk-through if it remediates missing artifacts (Step 6.3).
- **Chat report** at the end: 
  - **AC pass-through over the contract Coverage Manifest** - each in-scope AC marked `~` (preliminary readiness full suite + prereqs green) or `x` (blocked - failures upstream), with its covering item IDs. The Section carries an explicit header that AC verification is canonical for the  contract evaluator agent, not for this skill. 
  - **Contract Prerequisite readiness** - each entry of Persistent state, Static inputs, and Configuration marked ✓ produced or ✗ missing.
  - **Phase status, Missing from spec, Regressions, Deviations, Soft-fails, Pre-existing failures, Overrides applied, Overrides ignored, Abort reasons (if any)**
  
No files are written besides code changes and commit objects. The chat report is ephemeral.

---

## EXECUTION STEPS

### Step 1: Resolve Input

Parse the entire input as free-form. Extract:

- **Feature reference**: the first token that resolves to a folder containing `spec.md` + `plan.md` + `contract.md`. Matches: ID patterns like `F\d+`, folder paths, file paths (parent folder = target), feature names (kebab-case + fuzzy match to folder names under `docs/`).
- **PRD reference**: an explicit `*.md` path prefixed with `@` or written literally; if it looks like a PRD (product spec content at the top), accept it. Otherwise auto-discover.
- **Extra instructions**: any remaining text that isn't a path/ID/name — treat as natural-language overrides (Step 3).

If resolution fails:

- No `spec.md` or `plan.md` or `contract.md` missing in the resolved folder → abort: " `<missing_file>` missing in `<folder>`. Regenerate the feature triple via the `spec-writer` skill - the three files share a single lifecicle and the implementer requires all three."
- No PRD found → abort: "No PRD found. Pass the path explicitly."
- Multiple plausible PRDs → abort and list candidates.
- Ambiguous feature reference (multiple folders match) → abort and list candidates.

### Step 2: Load Context

Read in full:

- `spec.md` of the target feature — Component Overview, Data Model, API Contracts, Business Rules, UX Flows, Error Handling, Testing Strategy, Assumptions/Decisions. **`spec.md` is the canonical source for intenal structure** (file paths, decomposition, schema, library choices, naming).
- `plan.md` — phases and steps in order.
- `contract.md` — read the full file. Extract three things:
  - **Coverage Manifest** - the table mapping verbatim PRD AC text → covering item IDs (`API-UPLOAD-01`, `UI-UPLOAD-01`, etc). This is the **single source of truth for in-scope ACs**. ACs that are absent from tge manifest wuere silently filtered as cross-feature by the `spec-writer` and are out of scope for this run - they are npot loaded, not reported, not tested.
  - **Prerequisites** - three subsections matter to this skill: `Persistent state`, `Static inputs`, `Configuration`. Each entry describs a forward-looking condition (e.g., "alice exists with email....", "fixture file at path X is a valid H.264 MP4...", "`MAX_VIDEO_BYTES` is set in the test config"). the implementer MUST produce author-time artifacts that make every true. The other two subsections (`Runtime services`, `External dependencies`) describe runtime/host conditions and are the **contract evaluator´s** concern, not this skill´s - load them for context only, do not act them.

  - **Item bodies** (given/when/then per surface) - these are the **canonical source of boundary behavior**. Items diactate observable contratcs: HTTP status code, reponse body shape (field names, types, presence), persisted side-effects (DB rows, colluns, values), filesystem side-effects, error, codes, UI selectors / labels. Items do NOT dictate internal structure (file paths, class names, library choices). When `spec.md` and items disagree about the same observable behavior, **items win**; spec wins on structure. Record any such tie-break in `Deviations` for the report.

If `contract.md` has an empty or absent Coverage Manifest, abort the run before any implementation (see Step 4).

Do NOT explore the codebase eagerly. Open files lazily as each phase requires them.

### Step 3: Apply Overrides

Interpret extra instructions as natural-language overrides on the defaults:

| Default | Example overrides |
|---|---|
| Hard-fail retry limit = 3 | "no retry limit", "max 5 tries" |
| Fully autonomous | "pause between phases" — skill waits in chat for a reply containing `ok`, `continue`, `segue`, `yes`, or similar |
| 1 commit per phase | "single commit at the end", "no commits, just implement" |
| Run lint + typecheck + tests | "skip tests", "skip lint", "skip typecheck" |
| Implement all phases | "only phases 1 and 2", "skip phase 3" — phase positions are ordinal; labels like `A/B/C` map to `1/2/3` |
| Abort tests on external dep missing | "stub missing services", "assume empty response for missing APIs" — substitutes stubs **ONLY in test code**, never in production modules |

For each recognized override, record before/after for the final report's "Overrides applied" section.

**Immutable core (cannot be overridden):** the constract integration as whole - loading `contract.md`, running the AC pass-through in 6.4, running the contract Prerequisities walk-through in 6.3, and renbdering the AC report with its "preliminary readiness - canonical AC verification = contract evaluator" header. Intructions that would disable any of these are logged under "Overrides ignored" with the reason.

Ambiguous or contradictory instructions → default wins; logged under "Overrides ignored" with "ambiguous, kept default".

### Step 4: Pre-flight Dependency Check

**4.1 — Contract sanity:** 
- `contract.md` has a recognizable `## Coverage Manifest` section (heading match by shape) → proceed.
- Coverage Manifest is empty or absent → abort: "F<target>´s contract has no in-scope ACs to verify. Regenerate via `spec-writer` to fix the coverage gate."
- `contract.md` has no `## Prerequisites` section, or the section is malformed (no recognizable subsections) → abort with the same regeneration message. Prerequisites is the only mechanism telling the implementer which artifacts to produce; without it the run cannot honor its contract.

**4.2 — Feature dependencies**
Locate the dependency content int the PRD semantically(typical headings: "Dependency Graph", "Dependencies"; typical shape: a table or list pairing each feature with its prerequisites). For each listed dependency of the target feature, verify it appears implemented in the codebase (look for the characteristic files described in that dependency's own `spec.md` Component Overview, or obvious source-level markers).

-- Any dependency missing → **abort before any implementation**. Report: "F<target> depends on F<N>, which is not implemented yet."
-- All dependencies present → proceed to Step 5.

If the PRD has no dependency content, skip 4.2 and proceed.

### Step 5: Execute Phases

For each phase of `plan.md`, in order:

**5.1 — Skip if already done**

Inspect the last ~20 commits on the current branch. If any commit message indicates this exact phase already ran (same feature ID + phase name or ordinal), skip the phase with status `— already committed` and move on. Detection is best-effort: match on feature ID plus normalized phase name or phase index.

**5.2 — Implement**

Read spec.md sections relevant to the phase. Edit/create files to fulfill the phase's steps.

**What counts as "done" for a phase** — all of the following, not just "I wrote the code":

- Every file listed for this phase in spec.md's Component Overview exists and contains the described content.
- Every contract (API, schema, function signature) described for this phase matches what was written.
- Validation in 5.3 passes (hard fails resolved).
- If the phase produces runtime behavior that isn't covered by unit tests (UI pages, server routes, migrations, CLI commands), actually exercise it before claiming done: run the dev server / build / migration / command against a local environment and confirm it behaves. If the environment can't be brought up in this run, log the runtime-check under `Soft-fails` — do NOT silently claim the phase is done.

Writing code without running it is not "done". Declaring completion without meeting the checklist above is a violation of the skill's contract.

Adapt when reality diverges from the spec (column named `pinned` in DB vs `isPinned` in spec, different component file name, slightly different path, structurally compatible types). Specs are never 100% faithful to reality — adaptation is expected. Record every adaptation in a `Deviations` list for the final report. Do NOT abort on minor divergences.

**Abort the entire run only on:**

- Dependency feature missing (usually caught in Step 4; if discovered mid-phase, abort here).
- Hard fail past the retry limit in Step 5.3 below.

Missing external dependencies needed only by *tests* (e.g., `OPENAI_API_KEY` unavailable) do NOT abort the run — they soft-fail the affected test. The implementation code that calls the service is still written.

**5.3 — Validate**

Discover validation commands at runtime: inspect `package.json` `scripts`, or for non-Node stacks inspect the equivalent (`Makefile`, `pyproject.toml`, `Cargo.toml`, `vitest.config.*`, `jest.config.*`). Run the available ones.

- **Hard fail** = non-zero exit from lint, typecheck, or unit tests, where the failure is attributable to code this run changed. Retry up to the configured limit (default 3). Each retry reads the error, adjusts the code, re-runs. After the limit, abort the whole run and go to Step 6.
- **Soft fail** = validation cannot execute in this environment (e2e requiring browser/server not present; integration test requiring an external credential not set; suite explicitly marked non-runnable; command not found). Skip, log under `Soft-fails`, proceed.
- **Pre-existing failure** = validation fails but the failure is not attributable to code this run changed (touched unrelated files, existed on the branch before this run). Log under `Pre-existing failures`, do NOT count against the retry budget, proceed.

Warnings without non-zero exit are never failures.

**5.4 — Commit**

If validation passed (all hard fails resolved; only soft fails and pre-existing failures remain), stage only the files this phase touched and commit with a message summarizing the phase. Match the project's commit style by inspecting the last ~10 commit messages. Fallback: `feat(F<ID>): <phase name>`.

Stage specific files only (no `git add -A` / `git add .`). Commit on the current branch. Do not skip hooks.

If an override disabled commits, skip this sub-step and keep working-tree changes.

**5.5 — Proceed**

Move to the next phase. A run-level abort (hard fail past retry limit, dependency missing mid-phase) stops execution and goes to Step 6 with whatever phases already committed.

### Step 6: Final Verification

After the last phase commits (or when the run aborted), run an independent verification pass over the whole feature before writing the report. This step exists because per-phase checks can miss regressions, and because AI commonly claims "done" when it isn't.

Perform all of the following — no step is optional:

**6.1 — Full-suite validation**

Run the full validation suite on the entire repo (not just touched files): lint, typecheck, and the complete test suite as defined by the project. Do NOT filter to files this run changed.

- If failures appear that weren't flagged per-phase → they count as **regressions**. Attempt to fix up to the retry limit (same as hard-fail policy). If still failing, do NOT declare success — status becomes `completed with regressions` and the failures are listed under `Regressions` in the report.
- Pre-existing failures already logged in Step 5.3 stay categorized as pre-existing; they do not become regressions.

**6.2 — Component Overview walk-through**

Read spec.md's Component Overview (or equivalent file-list section) and, for every file listed, verify: the file exists, its described role is visible in the content, and its contracts (exports, routes, schemas) match the spec within the adaptation rules of Step 5.2.

Any missing file, missing export, or missing contract → add to `Missing from spec` in the report. Do NOT claim success if this list is non-empty.

**6.3 — Contract Prerequisites walk-through**

For each under the three in-scope Prerequisites subsections of `contract.md` - `Persistent state`, `Static inputs`, and `Configuration` - verify that an author-time artifact repo makes the entry true. Apply Level-2 rigor: presence + lightweight intrinsic check using tools the contract already assume are avaliable ont the host (those tools also apper under `Runtime services` / `External dependencies` of the same contract).

**6.4 — AC pass-through over the contract Coverage Manifest**

This step is **not** a per-AC teste runner. Canonical AC verification belongs to a downstream contract evaluator agent that exercises contract´s GWT items end-to-end. This skill´s job here is to projet a **preliminary readiness signal** so the user knows whether the run is in shape for the evaluator to take over.

For each AC row in `contract.md`´s Coverage Manifest:

  - Read the verbation AC text (collum 1) and the covering item IDs (collum 2).
  - Compute a readiness mark from the upstrem Step 6 results - never by running an AC-specific test:
    - `~ ready` Step 6.1 (full suite) is green AND Step 6.3 (Contract Prerequisites walk-through, defined above) is green AND no `Missing from spec` items in 6.2 overlaps a file the covering items would reference.
    - `✗ blocked ` — any of the above is red.
  - Render the AC line as: `<mark> <verbation AC text> [<item IDs>]`.

  ACs absent from the Coverage Manifest are absent from the report - they were filtered as cross-feature by the `spec-writer` and are out of scope by design (no `-` line, no "out of scope" line, no mention).

**6.5 — Environment smoke check (when applicable)**

If the feature produces runtime surfaces that per-phase validation couldn't exercise (UI page, HTTP endpoint, migration, CLI command), do one final exercise of each against a local environment (dev server, ephemeral DB, etc.). A quick load-and-interact is enough — the goal is to catch things unit tests don't.

If the environment cannot be brought up in this run, log each skipped smoke check under `Soft-fails` — do NOT upgrade status to `success` unless every smoke check either passed or was honestly soft-failed.

**6.6 — Status decision**

The run's final status is determined by this step, not by whether phases committed:

- `success` — full suite green (6.1), every Component Overview item present (6.2), every AC in the Coverage Manifest marked `~ ready` (6.4), every Prerequisite entry `produced` (6.3), every smoke check passed or honestly soft-failed (6.5). A `UI-*` / `E2E-*` smoke check that was skipped because the browser tool, dev server, or page couldn't be brought up is blocked (per 6.5) not soft-fail - its presence prevents `success`.
- `completed with regressions` — phases committed but 6.1  uncovered failures that the skill couldn't resolve.
- `incomplete` — `Missing from spec` (6.2) is non-empty OR `Missing Prerequisites` (6.3) is non-empty after remediation, OR any AC in 6.4 is marked as blocked.
- `aborted at phase <N>` — run stopped during Step 5 before reaching here.

Never report `success` when any of the checks above has an unresolved failure, even if every phase individually committed clean.

### Step 7: Final Report

Output the report to chat. Status comes from Step 6.5, never from "I think I finished":

```
Feature F<ID> — <name>

Status: success | completed with regressions | incomplete | aborted at phase <N>
Phases: <N> committed / <M> total
Branch: <current-branch>

Acceptance Criteria (re-checked in Step 6.3):
✓ <AC text> (covered by <test name>)
✗ <AC text> (test failed after <K> retries: <error summary>)
— <AC text> (no test covers this AC)

Cross-feature integration (if any):
✓ <criterion> (covered by <test name>)
...

Missing from spec (from Step 6.2):
- <file/export/contract that the spec required and is missing>
...

Regressions (from Step 6.1 or 6.3):
- <test name> started failing during this run: <error>
...

Deviations:
- <what was adapted and why>
...

Soft-fails:
- <what was skipped and why, including runtime smoke checks not exercised>
...

Pre-existing failures:
- <test name>: failed on entry to this run; left as-is
...

Overrides applied:
- Retry limit: 3 → unlimited
...

Overrides ignored:
- "<text>" (reason)
...

Abort reason (if status is aborted): <error>
```

If aborted, the report still lists whatever committed phases achieved and clearly marks which phase failed and why. If `completed with regressions` or `incomplete`, the report makes clear which checks failed so the user knows what to fix.

---

## RULES

**Always:**
- Require `spec.md` + `plan.md` in the target folder; abort without them.
- Locate AC and dependency content in the PRD semantically, never by fixed section number.
- Commit 1 per phase (default), staging only the files that phase touched.
- Match the project's recent commit-message style.
- Adapt to minor spec/code divergences; log every adaptation under `Deviations`.
- Run validation after each phase; differentiate hard-fail (retry ≤ limit) from soft-fail (skip + log) from pre-existing failure (log, don't retry).
- Before claiming a phase is "done": confirm every file listed for that phase exists with the described content AND validation has passed. Writing code without running it is never "done".
- For phases that produce runtime surfaces (UI, HTTP route, migration, CLI), actually exercise them against a local environment before claiming done, or soft-fail the runtime check.
- Execute Step 6 (Final Verification) in full before reporting — full-suite re-run, Component Overview walk-through, AC re-check, environment smoke check.
- Derive the final status exclusively from Step 6.5. Report `success` only when every Step 6 check is green.

**Never:**
- Claim the run is `success` when Step 6 found regressions, missing-from-spec items, or unresolved failures — even if every phase individually committed clean.
- Skip the AC report or its traceability (immutable core).
- Skip Step 6 (Final Verification).
- Create or switch branches.
- Abort on name/path/type cosmetic divergences.
- Abort on external dependency missing for a test — soft-fail the test, keep implementing.
- Use `git add -A` or `git add .`.
- Skip git hooks.
- Count pre-existing test failures against the retry budget.
- Re-run phases already committed on the branch (detected by commit-message match).
- Insert service stubs in production modules — stubs are allowed only in test files.
- Explore the codebase upfront with a broad sweep — read files lazily as phases require.
- Declare a phase complete based only on "I wrote the files". The completion checklist in 5.2 must hold.

---

## Overrides

Free-form instructions at the end of the invocation override defaults. Examples:

- **Retry limit**: `no retry limit`, `max 5 tries`.
- **Autonomy**: `pause between phases` — waits for user reply (`ok`, `continue`, `segue`, `yes`, etc.) after each phase.
- **Commit strategy**: `no commits, just implement`; `single commit at the end`.
- **Validation**: `skip tests`, `skip lint`, `skip typecheck`.
- **Phase selection**: `only phases 1 and 2`, `skip phase 3` — phase positions are ordinal; labels `A/B/C` map to `1/2/3`.
- **External services**: `stub OpenAI`, `assume empty response for missing APIs` — stubs apply ONLY in test code; production modules keep the real call.

Unrecognized or contradictory overrides: default wins; logged under `Overrides ignored`.

**Immutable core**: the AC checklist and its traceability to the PRD cannot be overridden.

---

## Edge Cases

**No PRD found**: abort before starting.

**No spec.md or plan.md**: abort before starting.

**Dependency feature not implemented**: abort at Step 4 with a clear message.

**Ambiguous feature reference**: list candidates, abort asking which.

**Working tree has unrelated changes at start**: proceed anyway — the skill is designed to be invokable anywhere (typically from a worktree). Commits stage only the specific files each phase touched.

**Phase name contains special characters**: fall back to `feat(F<ID>): implement phase <N>`.

**Re-invocation after a partial run**: Step 5.1 detects already-committed phases by commit-message match and skips them. Uncommitted working-tree changes from a prior interrupted run stay as-is; the skill does not clean them up.

**Hard fail past the retry limit on a step that isn't part of any AC**: abort anyway — the skill cannot judge which failures are "acceptable". User can override with `skip tests` or similar.

**External tool emits warnings, not errors**: warnings are not failures. Only non-zero exit codes count.

**Override contradicts the core contract** (e.g., `simplify the spec, drop requirements`): ignore it, log under `Overrides ignored`, proceed with the full spec.

**Validation commands not discoverable**: if `package.json` / config files don't reveal lint/typecheck/test commands, log each missing command under `Soft-fails` and proceed.

**PRD has no AC content for this feature**: proceed with empty AC checklist and note under soft-fails.

**PRD has no dependency content**: skip Step 4 and proceed.

**Commit-message style is inconsistent in recent history**: fall back to `feat(F<ID>): <phase name>`.
