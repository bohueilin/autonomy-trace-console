# Codex Bridge Output

## Status

Phase 1 + Phase 2 are implemented and reviewed. Codex added two product polish
layers after Claude's build:

1. A deterministic Physical AI License Report model and results-page report panel/export preview.
2. Investor/judge-ready polish: Why now / Why us, Pilot package, readiness-pack disclaimer, rescaled reference-readiness wording, and native report JSON copy/download.

Current gates: `npm run gates` is green.

Latest test count observed by Codex: 121 tests across 14 files.

## Bridge Instructions For Claude

Read:

- `.agentloop/BRIDGE.md`
- `.agentloop/GOAL.md`
- `.agentloop/PROTOCOL.md`
- `.agentloop/codex.md`

Write your latest output to:

- `.agentloop/claude.md`

End every update with:

```md
## Handoff To Codex
Status:
Needs:
Files changed:
Gates:
Questions:
```

## What Is Now Built

- Product journey: `landing -> intake -> preview -> results -> showcase`.
- Outcome requirement, domain selector, embodiment selector, and upload placeholders.
- Deterministic environment planner in `src/environmentPlan.ts`.
- Generated environment preview with oracle labels/assumptions.
- Generated results using the warehouse demo engine scoped to plan tasks.
- Deterministic report artifact in `src/licenseReport.ts`.
- Results-page reference-readiness decision, operating envelope, pilot next steps, disclaimer, and JSON report preview/copy/download.
- Stage A evidence bridge:
  - `/v1/warehouse` reset is embodiment/domain/plan-metadata aware.
  - Signed warehouse episodes carry the trusted embodiment enum.
  - Step scoring re-derives task physics from the signed token only.
  - `POST /v1/warehouse/reference-episodes` runs a deterministic server-owned oracle reference episode with `mock` provenance.
  - Evidence `scenario_snapshot` is enriched without schema changes and remains digest-covered.
  - Results UI can persist one representative reference evidence run with saved/local-only/unavailable states.
- Desktop bridge files in `.agentloop/BRIDGE.md`, `.agentloop/claude.md`, `.agentloop/codex.md`, and `.agentloop/prompts/claude-desktop-bridge.md`.

## Non-Negotiables

- Determinism is sacred.
- Oracle/verifier is source of truth.
- No LLM judge.
- No model/API spend until gates are green.
- Do not touch secrets, migrations, InsForge schema, or Nebius calls.
- Keep diffs focused and reviewable.

## Approved Next Iteration

Claude's planning-only pass is accepted with the refinements below.

Implement **Stage A only**. Do not implement Nebius/model-spend Stage B yet.

Objective: connect generated Physical AI eval plans to the server-authoritative
warehouse gym and tamper-evident evidence path, without allowing the browser to
forge task physics, oracle labels, rewards, or license outcomes.

### Stage A Scope

1. Make `/v1/warehouse` embodiment-aware and backward-compatible.
   - Extend warehouse reset input with optional `embodiment`, `domain`, and
     descriptive plan metadata (`planId`, `outcome` or `requirementSummary` if useful).
   - Validate `embodiment` against `ROBOT_EMBODIMENTS`.
   - Validate `domain` against `PHYSICAL_DOMAINS`.
   - Default to `embodiment: humanoid` and `domain: warehouse` so existing clients/tests
     remain compatible.
   - Only the server-trusted `embodiment` enum may affect physics via
     `applyEmbodiment`.
   - `domain`, `planId`, and requirement text are descriptive/provenance only; they
     must never affect oracle/reward.

2. Carry trusted eval context in the signed warehouse token.
   - Add signed payload fields for `embodiment`, `domain`, and optional plan metadata.
   - Step must use only signed token context, never step-body metadata.
   - Reject extra step fields as today.
   - Public reset cannot mint trusted reference provenance.

3. Enrich evidence without a migration.
   - No schema changes.
   - Use existing `scenario_snapshot jsonb` to include:
     - base task id,
     - adjusted task,
     - domain,
     - embodiment,
     - embodiment profile,
     - domain theme,
     - plan metadata,
     - rollout summary.
   - Existing digest must cover this because `scenario_snapshot` is already in
     `DIGEST_FIELDS`.

4. Add a deterministic server-owned warehouse reference path.
   - Add a route such as `POST /v1/warehouse/reference-episodes`.
   - It should accept exact fields only: `taskId`, `domain`, `embodiment`, optional
     `planId`, optional requirement summary.
   - It should run the calibrated oracle policy server-side through the same
     warehouse reset/step mechanics and persist the resulting terminal evidence.
   - Use a server-owned agent id such as `warehouse-oracle-reference`.
   - If adding provenance to the warehouse token, reference episodes may map to
     existing audit provenance `mock` (deterministic reference) while public resets
     remain `external`. Stay within current DB constraints: `mock | nebius | external`.

5. Surface the bridge lightly in UI.
   - Add a small action on `LicenseResults`, e.g. "Persist reference evidence".
   - It can run one representative calibrated-oracle warehouse reference episode
     for the generated plan (prefer a finish task if present, else first task).
   - Show the result as `saved`, `local_only`, or `unavailable`; do not over-claim
     that the full generated plan is persisted unless every task is actually run.
   - Keep current client-side report intact.

6. Tests.
   - Public warehouse reset defaults remain backward-compatible.
   - Invalid `embodiment`/`domain` rejected.
   - Embodiment affects oracle by re-running BFS server-side.
   - Step-body metadata spoofing is rejected/ignored.
   - Reference route runs the oracle and returns/persists a terminal result.
   - Evidence snapshot contains plan/embodiment/domain metadata and digest remains valid.

### Explicit Deferrals

- No Nebius warehouse policy yet.
- No model/API spend.
- No real upload parsing.
- No InsForge schema/migration.
- No procedural grid generation.
- No batch-persist full plan unless the implementation stays small and gates remain
  simple; one representative reference evidence run is enough for this iteration.

### Gates

- `npm run gates`

### Report Back

Write implementation results to `.agentloop/claude.md` and end with:

```md
## Handoff To Codex
Status:
Needs:
Files changed:
Gates:
Questions:
```

## Codex Review Of Stage A

Status: accepted.

Claude's implementation matches the approved trust boundary:

- Client-supplied plan/domain/requirement fields are provenance only.
- The only physics-changing input is the server-validated embodiment enum.
- The embodiment/domain/plan context is signed into the warehouse token at reset.
- Step accepts exactly `{ action }`; body-level metadata spoofing is rejected.
- The deterministic reference route uses the oracle policy, not an LLM/model judge.
- Evidence snapshot enrichment uses existing JSONB and is covered by the digest.

Codex applied one small cleanup before commit: `POST /v1/warehouse/reference-episodes`
now rejects client-supplied `runId` so the reference row stays fully server-owned.
The route accepts only `{ taskId, domain, embodiment, planId, requirementSummary }`.

Verification:

- `npm run gates` green.
- Build green.
- Lint green.
- `verify:evidence` green, 40 checks.
- Tests green, 121 tests across 14 files.

No Stage B work was done: no Nebius warehouse policy, no model spend, no migrations,
no upload parsing, no procedural generation.

Recommended next decision: polish the demo story and live evidence visibility for
judges before adding model spend. Stage B should still require explicit user approval.

## Future Iteration

Do not start this until the user asks Claude to continue.

Objective: connect the generated eval journey to a model-under-test path without changing trust boundaries.

Recommended scope:

1. Plan persistence design:
   - Decide whether generated EnvironmentPlan snapshots should be persisted in the existing `eval_episodes` audit row, a new table, or a local-only export first.
   - Do not add schema until Codex/user approves the trust boundary.

2. Model-under-test bridge:
   - Design how Nebius/external policies should consume a generated plan task without letting the client forge oracle labels or rewards.
   - Prefer reusing `/v1/warehouse` signed rollout state.

3. Visual review:
   - Check landing/results desktop and mobile if browser tooling is available.

Avoid:

- No real upload parsing yet.
- No InsForge schema changes without explicit approval.
- No live model spend until gates are green and the model path is explicitly approved.
- No procedural grid generation yet.

Gates:

- `npm run gates`

Report back in `.agentloop/claude.md`.
