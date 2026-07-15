# Spec Writer — Batch Mode

Generate specs for multiple features of the same wave in parallel, auto-accepting all interview recommendations. Thin orchestration wrapper on top of Steps 1–6: sub-agents run the full single-feature flow; the orchestrator resolves input, validates, dispatches, and reports.

## Activation

Enters Batch Mode automatically when the input matches:
- Multiple feature IDs: `F01 F02 F03`
- Wave reference: `wave 3`
- Mix within the same wave: `wave 3 F04`

Single-feature input continues to use the interactive flow.

## Same-wave rule

All features in a batch must belong to the same wave (per PRD Section 8).
- Cross-wave input → rejected: "Features from different waves cannot be generated in the same batch."
- Unknown wave → reject, list available waves from Section 8.
- Unknown feature ID/name → reject, list available features.

## Orchestration flow

**B.1: Resolve the batch**
- Locate PRD (Step 1.1 rules). If not found → direct to `prd-writer`. Multiple PRDs → ask user.
- Parse input into target feature list (expand waves, deduplicate).
- If PRD has no `Execution Waves` subsection and input references a wave → reject: "Wave references require 'Execution Waves' subsection in Section 8."
- Ambiguous feature name → list candidates and ask user before proceeding.
- Validate same-wave rule.
- Check whether `docs/<feature-id>-<kebab-name>/spec.md` already exists → mark as "already has spec".

**B.2: Greenfield and Foundation classification**
Apply Foundation state detection from Step 1.2 once for the batch:
- Foundation not implemented → must run sequentially.
- Non-Foundation or Foundation already implemented → eligible for parallel pool.

**B.3: Dependency readiness**
For each target, check PRD dependencies. If dependency not implemented AND not in current batch → mark as "dependency missing — will abort".

**B.4: Present consolidated plan and await confirmation**
```
Batch plan for <input>:
- F04 Video Library (Core only) — new
- F07 Background Processing Pipeline (full scope) — already has spec (skip / regenerate?)
- F12 Administration Panel (full scope — no Core/Full split) — new

Mode: parallel (N sub-agents)
Codebase state: Foundation complete
Auto-accept: all spec-writer recommendations will be applied
Destination: docs/F04-video-library/, docs/F07-background-processing-pipeline/, docs/F12-administration-panel/

OK to proceed? (yes/no)
```

Scope tags: `(Core only)` / `(full scope)` / `(full scope — no Core/Full split)`.
Status tags: `new`, `already has spec (skip / regenerate?)`, `dependency missing — will abort`, `Foundation, will run sequentially`, `already implemented (Foundation), skipping`.

Proceed only on explicit "yes". On "no" → abort cleanly, no files created. Features "already has spec" → skipped by default; user can request regeneration in confirmation response.

**B.5: Dispatch sub-agents**
- Sequential phase (Foundations only, when greenfield or Partial Foundation): one at a time, in Section 8 order.
- Parallel phase: all remaining in a single message, no concurrency cap.
- Each sub-agent prompt includes: feature ID, PRD path, instruction to execute Steps 1–6, the Auto-Accept Policy, reminder to save per Step 5.
- Each sub-agent runs its own Pattern Discovery independently.

**B.6: Collect and report**
```
Batch complete: 3/4 features generated successfully
✓ F04 → docs/F04-video-library/
✓ F12 → docs/F12-administration-panel/
✗ F05 → failed: <reason>
```
Sub-agent failures are isolated — others continue. Failed features can be re-run individually.

## Auto-Accept Policy

Sub-agents skip the interactive interview (Step 2) and apply:

| Decision | Default |
|---|---|
| Scope (Core vs Core+Full) | Core only |
| Technical decisions with clear recommendation | Apply the recommendation |
| Dependency not yet implemented | Orchestrator handles in B.3 — skip Step 1.2 warning |
| Greenfield Foundation warnings | Orchestrator handles in B.2 — skip Scenarios 2/3 |
| New technology not in codebase | Auto-confirm; document in spec assumptions |
| Multiple conflicting patterns | Pick most frequent (or most recent when tied); document |
| Ambiguous feature reference | Cannot occur — orchestrator disambiguates in B.1 |
| Empty codebase bootstrap | Industry best practices for detected stack; document assumptions |
| Partial PRD spec (detail omitted) | Industry-standard default; document as explicit assumption |
| Description too vague | Best-practice defaults for each open decision; document; never silently infer |
| No codebase patterns found | Industry best practices for detected stack; document |

Every Auto-Accept default applied MUST be recorded under "Assumptions" or "Decisions" in the spec.

## Rules (Batch Mode)

**Always:**
- Validate same-wave rule before dispatch; reject cross-wave batches.
- Present consolidated plan and await explicit confirmation before dispatching sub-agents.
- Skip features whose `spec.md` already exists unless user explicitly requests regeneration.
- Run Foundation features sequentially when greenfield or Partial Foundation.
- Apply Auto-Accept Policy inside each sub-agent.

**Never:**
- Mix features from different waves in the same batch.
- Dispatch Foundation features in parallel when any Foundation is still unimplemented.
- Cancel running sub-agents because another failed.
- Share a single Pattern Discovery across sub-agents.

## Edge Cases (Batch Mode)

Any edge case in SKILL.md that says "ask the user" is overridden by the Auto-Accept Policy inside sub-agents. Orchestrator-level issues (multiple PRDs, ambiguous references, dependency warnings) are resolved in B.1–B.3.

- **Cross-wave input:** reject; do not auto-split; user must run earlier wave first.
- **Unknown wave:** list available waves from Section 8.
- **Feature already spec'd:** flagged in plan; default skip; regenerate on user request.
- **External dependency missing:** mark "dependency missing — will abort"; generate remaining features; report aborted one.
- **Multiple Foundation features in greenfield:** run sequentially in Section 8 order; non-Foundation features still run in parallel after.
- **Sub-agent failure:** others continue; final report lists success/failure with reasons.
- **PRD without "Execution Waves":** reject wave references; user must use feature IDs directly.
- **User declines plan (B.4):** abort cleanly; no sub-agents, no files, no partial state.
