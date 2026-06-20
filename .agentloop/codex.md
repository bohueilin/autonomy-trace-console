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

## Publish Policy

The user approved direct GitHub publishing for record keeping when safety and quality
are met. For implementation passes, Codex and Claude may decide to commit/push the
current branch directly when:

- the scope is clear,
- `npm run gates` is green,
- secrets are untouched,
- no unrelated local files are staged,
- and the handoff reports commit SHA, pushed branch, and any remaining local changes.

Do not stage unrelated files such as local agent instructions unless the user asks.

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

## Product Intent: Video-To-Workflow Eval

The user wants the web GUI workflow to support customers describing a real
workplace task by uploading video (plus text, SOPs, images, floor plans, and
forbidden examples). The product should extract enough workflow information and
reasoning to understand:

- what job the robot/agent is supposed to perform,
- what sequence of observable actions matters,
- what hazards, human-only zones, escalation triggers, and refusal conditions exist,
- what success/failure looks like,
- which robot embodiment is appropriate,
- and whether the agent did the right job under the deterministic verifier.

Trust boundary:

- Uploaded video and extracted reasoning are **input interpretation**, not the judge.
- Extraction may propose candidate tasks, constraints, rationales, and symbolic eval
  mappings, but the oracle/verifier remains the source of truth.
- Do not let a video model, LLM, or client-uploaded metadata directly set rewards,
  oracle labels, license outcomes, or trusted evidence.
- A human/operator approval step is acceptable before extracted workflow facts become
  server-authoritative eval configuration.
- For the next pass, do not implement real video parsing, storage, model calls, or
  upload infrastructure unless explicitly approved. Plan the UX and trust boundary
  first; if implementing UI polish only, keep it deterministic/local and label it as
  workflow footage/intake evidence, not parsed evidence.

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

## Approved Next Iteration: Media-Driven Workflow Authoring Stage A

Claude's UX plan is accepted. Implement Stage A only, as a polished,
YC-demo-ready no-spend build:

**Capture -> Understand -> Reflect back -> Align -> Illustrate -> Simulate -> License**

The product should feel like a calm safety workshop for a worried family member or
operations lead who needs to know whether a robot can be trusted around real people.

### Decisions On Claude's Questions

1. Site map is descriptive in Stage A: **yes**.
   - Editing the site map must not synthesize new scored grid physics.
   - It may drive the illustration and select/reorder existing canonical tasks.
   - UI copy must explicitly say the site map is a workflow illustration/mapping, not
     the scored physics grid.
   - Procedural grid physics is deferred.

2. Use real file inputs, metadata only: **yes**.
   - Use `<input type="file" multiple>`.
   - Store only serializable metadata: name, type, size, role, and local id.
   - Do not keep `File` objects in long-lived React state.
   - Do not read bytes, use `FileReader`, upload files, create object URLs, or parse media.
   - Copy must say: "declared locally; not uploaded or parsed in this demo".

3. Replace the old `intake` journey with `capture`: **yes**.
   - The richer `capture` flow becomes the default "Create eval" path.
   - Keep `showcase` intact.
   - It is fine to refactor or retire `IntakeForm` if the new components replace it.

4. Tests: pure logic + browser/preview verification, no new testing dependency: **yes**.
   - Do not add `@testing-library` in this pass.
   - Add focused Vitest tests for pure modules and trust-boundary behavior.
   - Verify the UX manually/browser-side and report what was checked.

5. Embodiment: tentative in Capture, final in Reflect/Align.
   - Capture may ask for expected robot type as a hint.
   - Understanding can propose a robot embodiment.
   - Reflect/Align must let the operator confirm/change the embodiment before freeze.
   - Only the confirmed enum may reach `buildEnvironmentPlan` and the server.

6. Provenance rides into evidence now, no schema: **yes, keep it descriptive**.
   - Thread `approvedFactsHash`, `inputManifestSummary`, and a compact
     `frozenWorkflowSummary` through plan/report metadata and the warehouse reference
     metadata if needed.
   - Store under `scenario_snapshot.plan` so it is digest-covered.
   - These fields are provenance only and must never affect oracle/reward/license.

### Implementation Scope

Implement in small, reviewable diffs. Keep the existing deterministic shell intact.

1. Capture model and Capture UI.
   - Add `src/captureManifest.ts` or equivalent pure module.
   - Add `CaptureConsole` or equivalent component.
   - Support upload/drop/file picker states, role assignment, remove, empty/error states.
   - Capture text description, safety rules, domain, and expected embodiment.
   - "Map manually instead" must work with zero AI/model spend.

2. Workflow draft/freeze model.
   - Add `src/workflowDraft.ts` or equivalent pure module.
   - Types for site map, storyboard, terminal rules, provenance/confidence, draft,
     frozen workflow, and frozen hash.
   - Deterministic stub proposer: same capture manifest -> same draft.
   - `freezeWorkflow` creates immutable/serializable approved snapshot.
   - `frozenToPlanInput` must be a whitelist: domain enum, embodiment enum,
     canonical task selection/order, and descriptive provenance only.

3. Understanding screen.
   - Add honest checklist microstate screen.
   - Since Stage A has no model, label it clearly as a deterministic template draft.
   - Include low-confidence/offline/manual path copy.

4. Reflect/Align screen.
   - Editable source-linked summary:
     - descriptive site map,
     - task storyboard,
     - finish/escalate/refuse safety rules,
     - confirmed domain/embodiment.
   - Provenance chips: `AI-proposed`, `Edited`, `Confirmed by you`, and source refs.
   - Gate progression on explicit approval.

5. Workflow illustration.
   - Deterministic SVG/CSS illustration of representative rollout.
   - Caption why terminal action is finish/escalate/refuse.
   - Label as illustration, not proof.
   - Implement `prefers-reduced-motion` fallback/static stepper.

6. Plan/preview/results integration.
   - Extend `App.tsx` state machine:
     `landing -> capture -> understanding -> reflect -> illustrate -> preview -> results -> showcase`.
   - Extend `buildEnvironmentPlan(req, frozen?)` backward-compatibly.
   - Existing `preview` becomes frozen eval preview with a "Confirmed by you; scored by
     deterministic oracle" banner.
   - Results add safety-case provenance summary.
   - Preserve triptych, FAR/FRR, reward-hacking trace, Signal Extractor, JSON export,
     and Stage A evidence bridge.

7. Evidence provenance.
   - Extend warehouse reference metadata exact-field validation only as needed for:
     `approvedFactsHash`, `inputManifestSummary`, `frozenWorkflowSummary`.
   - Persist these under `scenario_snapshot.plan`.
   - No schema changes, no migrations.
   - Add tests showing these fields are digest-covered metadata and do not change
     oracle/reward behavior.

8. Styling and quality.
   - Use existing tokens and theme in `src/App.css`.
   - Avoid decorative clutter; content-first, warm, precise, high-trust.
   - Responsive, mobile-safe, keyboard/focus accessible, color-independent states.

### Required Tests

- Capture manifest stores metadata only; no `File` objects in frozen structures.
- Draft proposer is deterministic.
- Freeze hash is stable.
- `frozenToPlanInput` cannot emit labels, rewards, raw battery, raw geometry, or
  license fields.
- `buildEnvironmentPlan(req, frozen)` uses BFS labels from the final tasks.
- For the same embodiment and canonical task ids, frozen provenance does not alter
  oracle labels.
- Reference evidence metadata persists under `scenario_snapshot.plan` and remains
  digest-valid.
- Existing gates remain green.

### Explicit Deferrals

- No real video parsing/transcription.
- No vision/LLM extraction.
- No file upload/storage infrastructure.
- No model/API spend.
- No Nebius/Stage B warehouse policy.
- No InsForge schema/migration.
- No procedural scored grid generation.
- No new UI test dependency unless explicitly approved later.

### Gates

- `npm run gates`

### Publish

After implementation, if gates are green and only in-scope files are staged, commit
and push the branch directly per the publish policy. Report the commit SHA and branch.

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
