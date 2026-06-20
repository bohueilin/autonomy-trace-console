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

## Active Claude Request: Media-Driven Workflow Authoring UX Plan

Mode: **planning only**. Do not code yet. The previous Video-To-Workflow
implementation scope is paused until this UX plan is reviewed.

Objective: produce a world-class, YC-demo-ready web console UX spec for
media-driven workflow authoring:

**Capture -> Understand -> Reflect back -> Align -> Illustrate -> Simulate -> License**

The product story is personal and concrete: the worried son wants to know whether a
robot can be trusted around his dad on a factory floor. The console should feel like
a calm safety workshop, not a generic upload wizard. Users upload or declare photos,
videos, SOPs, floor plans, forbidden examples, task descriptions, and robot context;
the system reflects back what it thinks the job is; the human confirms/edits it; the
approved workflow freezes into deterministic eval; the output is a safety case.

### Grounding In Current Code

Claude must inspect and cite file:line references for the real code:

- `src/App.tsx:35-47` current view flow is `landing -> intake -> preview -> results -> showcase`.
- `src/App.tsx:204-224` renders the current journey screens.
- `src/components/IntakeForm.tsx:1-3` explicitly says no file parsing/upload happens.
- `src/components/IntakeForm.tsx:26-33` lists placeholder attachment chips.
- `src/components/IntakeForm.tsx:140-166` captures attachment intent only.
- `src/components/EnvironmentPreview.tsx:1-3` is already the eval review surface.
- `src/components/EnvironmentPreview.tsx:37-75` shows plan metadata, vocabulary, and oracle assumptions.
- `src/components/EnvironmentPreview.tsx:77-111` shows task labels and runs the deterministic eval.
- `src/environmentPlan.ts:10-16` states the deterministic/no-LLM trust boundary.
- `src/environmentPlan.ts:35-45` shows current requirement/attachment shape.
- `src/environmentPlan.ts:264-293` builds the plan from domain + embodiment.
- `src/components/LicenseResults.tsx:117-205` renders the report/safety readout.
- `src/components/LicenseResults.tsx:207-235` has the Stage A evidence bridge.
- `src/licenseReport.ts:36-92` builds the deterministic readiness report.
- `server/env/warehouseGym.ts:136-148` signs trusted warehouse episode context.
- `server/env/warehouseGym.ts:312-398` builds digest-covered evidence rows.
- `server/env/warehouseGym.ts:448-528` scores warehouse episodes from signed context.
- `server/env/warehouseGym.ts:581-628` runs the deterministic reference episode.
- `server/app.ts:203-319` exposes the warehouse reset/step/reference routes.

### UX Quality Bar

Design to a frontier console standard:

- Content first; chrome recedes. Depth comes from hierarchy, spacing, and subtle
  layers, not decoration.
- One primary action per screen.
- Warm but restrained copy: protective, practical, never melodramatic.
- Trust made visible with provenance chips, confidence labels, edit history, and
  badges for `AI-proposed`, `Confirmed by you`, and `Scored by deterministic oracle`.
- Every AI-proposed item is editable until approved.
- Upload/media states are immaculate: empty, drag-over, local capture, analyzing,
  low-confidence, needs-confirmation, approved, error, offline, and manual fallback.
- Motion is purposeful: 60fps step transitions, analysis checklist microstates, and
  deterministic workflow animation; include `prefers-reduced-motion` behavior.
- Accessibility AA: keyboard upload, keyboard grid/site-map editing, visible focus,
  screen-reader labels, color-independent status, mobile-safe controls.
- Responsive first: the site-map/editor remains usable on mobile, not just stacked.
- Graceful no-AI path: manual mapping must be possible with zero model spend.

### Target Flow To Spec

0. **Landing: Describe your site**
   - Media-first CTA: "Describe your site".
   - Secondary CTA: "See sample safety case".
   - Explain in one sentence: upload examples, confirm the workflow, run deterministic eval.

1. **Capture**
   - Large upload zone for video/photos/PDF/SOPs/floor plans/unsafe examples.
   - Local metadata cards with type, size, remove, source role.
   - Text description and safety rules.
   - Domain and expected embodiment stay visible but are not final until review.
   - Primary action: "Analyze workflow".
   - Manual fallback: "Map manually instead".

2. **Understanding**
   - Honest processing screen, even when deterministic stubbed.
   - Checklist: media received, site clues identified, candidate zones drafted,
     task storyboard drafted, hazards/rules drafted, eval mapping prepared.
   - Copy sets expectation: "You will confirm every assumption next."
   - Include low-confidence/offline/manual states.

3. **Reflect Back & Align**
   - The key screen.
   - Editable source-linked summary:
     - site map/grid: start, item, drop, obstacles, hazards, human-only zones,
     - task storyboard,
     - safety/terminal rules,
     - expected finish/escalate/refuse situations.
   - Each item has source chip, confidence, and state (`AI-proposed`, `edited`,
     `confirmed`).
   - Inline accept/edit/delete and keyboard-friendly editing.
   - Primary action: "Approve workflow".
   - Secondary: "Back to capture".

4. **Workflow Illustration**
   - Deterministic animated rollout of the symbolic plan: robot path, scan, move,
     pick, drop, finish/escalate/refuse moment, captioned why.
   - Optional richer illustration is clearly labeled as illustration, not proof.
   - Primary action: "Freeze eval".
   - This is the emotional alignment moment: "Does this match your dad's floor?"

5. **Freeze -> Preview -> Run**
   - Existing preview becomes the frozen eval preview.
   - Add a frozen banner: "Confirmed by you; scored by deterministic oracle."
   - Once frozen, media/extraction can no longer silently mutate tasks.
   - Primary action: "Run license eval".

6. **Results = Safety Case**
   - Existing report becomes the safety case.
   - Add provenance summary: inputs declared, facts confirmed, eval frozen, oracle
     scored, reference evidence persisted.
   - Keep FAR/FRR, triptych, reward-hacking trace, and JSON export prominent.

### Data And Trust Model

Claude must specify:

- Client captures local file metadata only in Stage A: name, type, size, role. No
  bytes read, no object URLs, no upload/storage.
- AI/stub output is a draft, never trusted.
- Human approval creates a frozen workflow snapshot.
- Frozen workflow may select/reorder existing canonical tasks and carry descriptive
  provenance, but cannot set labels/rewards/license.
- Deterministic oracle/verifier remains the judge.
- Evidence may carry provenance only after freeze; uploaded media is not proof.

### Phased Implementation Plan To Produce

Claude should produce a staged plan, not code:

1. **Stage A, no/low spend**
   - Real upload UX with local metadata only.
   - Manual/assisted site mapping.
   - Reflect-back alignment screen.
   - Deterministic workflow animation.
   - Existing eval unchanged except descriptive provenance.

2. **Stage B, gated model spend**
   - Vision/LLM extraction proposes drafts.
   - Human approval still required.
   - Manual fallback remains first-class.

3. **Stage C, gated persistence**
   - Store uploads, approved plan, and safety case.
   - Tamper-evident evidence and no schema changes unless approved.

### Deliverables For Claude

Write to `.agentloop/claude.md`:

1. UX narrative and annotated wireframe description for each step.
2. Full screen/state machine extending `App.tsx`.
3. Component inventory: new components and existing components to reuse/extend.
4. Interaction and motion spec, including reduced-motion.
5. Data and trust model with freeze boundary.
6. Reuse map with file:line citations.
7. Phased implementation plan with reviewable diffs.
8. P0/P1/P2 risks and mitigations.
9. Test plan to keep `npm run gates` green.

### Explicit Avoids

- No code yet.
- No LLM/video model as judge.
- No model/API spend.
- No real upload/storage.
- No InsForge schema changes.
- No procedural grid-physics generation.
- No secrets in client code.

### Gates

- Run `npm run gates` before writing the plan.

### Report Back

End with:

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
