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

## Latest Product State: Media Workflow UX Built, Needs Bright Premium Polish

Current branch: `codex/physical-ai-license`.

Latest pushed implementation commit from Codex:

- `6338892` — `Build media-driven workflow authoring UX`

Current gates observed after that commit:

- `npm run gates` green
- build green
- lint green
- `verify:evidence` green, 40 checks
- tests green, 129 tests across 16 files

### What Is Now Implemented

The app now has a Stage A no-spend media workflow journey:

`landing -> capture -> understanding -> reflect -> illustrate -> preview -> results -> showcase`

Key implementation files:

- `src/App.tsx` — state machine now routes through capture/understanding/reflect/illustrate.
- `src/captureManifest.ts` — local/Drive input manifest, metadata-only.
- `src/workflowDraft.ts` — deterministic workflow-understanding stub and frozen workflow snapshot.
- `src/components/CaptureConsole.tsx` — file picker/drop zone, Google Drive link intake, workflow/rules/domain/embodiment fields.
- `src/components/UnderstandingProgress.tsx` — deterministic "understanding" transition screen.
- `src/components/ReflectAlign.tsx` — editable site map, storyboard, rules, domain, and embodiment confirmation.
- `src/components/WorkflowIllustration.tsx` — deterministic oracle-path illustration.
- `src/environmentPlan.ts` — backward-compatible workflow metadata and canonical task selection.
- `src/components/EnvironmentPreview.tsx` — frozen-workflow banner and workflow mapping summary.
- `src/components/LicenseResults.tsx` and `src/licenseReport.ts` — provenance in license/safety-case output.
- `server/env/warehouseGym.ts`, `server/app.ts`, `src/serverEpisodeClient.ts` — descriptive workflow provenance can ride into reference evidence.

The capture UI supports:

- local video/image/PDF/text selection via `<input type="file" multiple>`,
- drag/drop,
- Google Drive link declaration,
- role assignment for captured items,
- metadata-only storage: name, type, size, role, id/link.

### Trust Boundary To Preserve

- No real video parsing/transcription in Stage A.
- No file upload/storage in Stage A.
- Do not store `File` objects in long-lived state.
- Do not use `FileReader`.
- Do not create object URLs.
- Do not call model APIs or spend tokens.
- Uploaded media and extracted workflow facts are authoring/interpretation only.
- The deterministic BFS oracle/verifier remains the source of truth.
- Workflow metadata may select/order canonical tasks and annotate provenance, but must never set rewards, labels, license results, or trusted physics.

### User QA Finding

The user initially tested `http://127.0.0.1:5174/` and saw the old UI:

- button copy: `+ Create Physical AI License Eval`
- screen title: `Create Physical AI License Eval`
- no visible upload/video path

Root cause: an old/stale Vite process on port `5174` served stale transformed modules
that still imported the old `IntakeForm`. Fresh preview ports served the new
`CaptureConsole` route correctly.

For UX verification, start a clean dev server and report the exact URL. If `5174`
shows old UI, use a new strict port, for example:

```sh
npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
```

Expected current click path in the new build:

1. Open the clean preview URL.
2. Click `Describe your site`.
3. See `Upload workflow video`.
4. Click `Select video or files`, or paste a link into `Paste Google Drive link`.
5. Click `Analyze workflow`.

### User Feedback On Current UX

The direction is correct, but not yet good enough:

- The user does not feel the Sierra/Linear/Apple-grade design influence.
- The upload/video path must be unmistakable, not hidden behind generic "describe" copy.
- The site should be bright and pretty, not dark theme.
- The next pass should be a serious product-experience polish pass, not just a CSS tweak.

## Approved Next Claude Implementation Prompt: Bright Premium UX Polish

This is the prompt Codex recommends copy-pasting to Claude:

```md
Follow `.agentloop/BRIDGE.md` and `.agentloop/prompts/claude-desktop-bridge.md`.
Read `.agentloop/GOAL.md`, `.agentloop/codex.md`, and the current code before editing.
Write your final implementation report to `.agentloop/claude.md`.

This is an approved implementation pass. Please read/inspect the repo, run
`npm run gates` first to establish the baseline, then implement the UX polish below.
If anything is genuinely ambiguous, ask before coding. Otherwise proceed, keep diffs
focused, run gates again, and commit/push the branch directly if gates are green and
only in-scope files are staged.

# Mission

Polish the Autonomy License for Physical AI web UX into a bright, premium,
YC-demo-ready product experience. The current media workflow is directionally
correct, but the user still cannot immediately see the video/image upload path and
does not feel the Sierra/Linear/Apple-grade quality yet.

The product story:

- A customer wants a robot to safely help in a real physical workplace, such as the
  user's dad's factory.
- They arrive at the console, upload or declare workflow media: video, images, floor
  plan, SOP, forbidden examples, and/or Google Drive link.
- The product reflects back what it understood, lets the operator approve/edit it,
  illustrates the mapped workflow, then runs the deterministic Physical AI license eval.
- The oracle/verifier, not an LLM, decides finish/escalate/refuse and license outcome.

# Design Direction

Act as an elite senior frontend engineer specializing in polished modern B2B product
UX. Use Sierra.ai and Linear.app as inspiration for clarity, refinement, spacing,
trust surfaces, and product-preview storytelling, but **do not make this dark mode**.

Desired aesthetic:

- Bright, premium, spacious, technically sophisticated.
- Apple-grade product feel: clear hierarchy, calm motion, crisp surfaces, polished
  whitespace, precise copy.
- "Safety lab meets enterprise builder": warm, trustworthy, optimistic.
- The page should feel beautiful immediately, but still usable as a working console.

Visual tokens:

- Background: bright white / soft ivory / very pale blue-gray, not black.
- Text: near-black graphite for primary, cool gray for secondary.
- Accent: soft cyan/blue with tiny hints of mint or lavender; avoid heavy purple
  gradient blobs and avoid dark navy/slate dominance.
- Borders: crisp thin light borders, subtle shadows, soft glass only when it improves
  legibility.
- Radius: restrained, generally <= 8px unless existing UI needs otherwise.
- Typography: SF Pro / Inter / system sans feel, large confident headings, no negative
  letter spacing.

# UX Requirements

1. Make upload-first obvious in the first viewport.
   - The primary CTA should communicate media upload, e.g. `Upload workflow video` or
     `Start with workflow media`, not a vague "Describe site" label.
   - The landing hero should visibly preview a media intake console with a video/file
     upload area and Google Drive link row.
   - The user should not wonder where to upload video/images.

2. Bright premium landing page.
   - Redesign `Landing` so the first screen feels like a polished product, not a
     generic hackathon form.
   - Include concise, strong copy. Possible headline directions:
     - `License robots before they act`
     - `Prove robot readiness`
     - `Turn factory footage into a safety eval`
   - Keep the human story implicit but present: helping real workers safely, not
     deploying robots blindly.
   - Include a product-preview mockup/bento below or beside the hero:
     media intake -> understood workflow -> deterministic oracle -> safety case.

3. Capture screen polish.
   - `CaptureConsole` should look like a premium media intake studio.
   - The upload zone must be visually dominant and above the fold.
   - Use clear labels: `Upload workflow video`, `Select video or files`,
     `Paste Google Drive link`.
   - Supported formats should be visible: MP4, MOV, WebM, AVI, images, PDFs, text.
   - Keep the honest Stage A copy: `Metadata only in this demo. Nothing is uploaded
     or parsed.`
   - Add polished selected-file cards and Drive-link cards.
   - Add a small trust note explaining that media helps author the workflow, while the
     deterministic oracle still judges safety.

4. Flow clarity.
   - Add/upgrade a visible stepper:
     `Capture -> Understand -> Align -> Simulate -> License`
   - The user should always know where they are and what happens next.

5. Product illustration.
   - Improve `WorkflowIllustration` so it feels like a real product visualization:
     clean map, path, terminal decision, and safety rationale.
   - Keep `prefers-reduced-motion` support.
   - Do not introduce heavy animation that risks jank or visual clutter.

6. Remove stale/confusing old journey.
   - Ensure the default app route cannot show the old `Create Physical AI License Eval`
     path.
   - If `IntakeForm` is now unused, either retire it safely or make sure it is not
     reachable and cannot confuse the demo.
   - Search for stale copy like `Create Physical AI License Eval` and replace/remove
     where appropriate.

7. Keep non-negotiable trust boundaries.
   - No real upload/storage.
   - No byte reads.
   - No object URLs.
   - No model calls.
   - No LLM judge.
   - No schema/migrations.
   - Do not alter oracle/verifier semantics.
   - Keep deterministic tests passing.

8. Preserve existing winning proof points.
   - Triptych demo.
   - FAR/FRR matrix.
   - Reward-hacking trace.
   - Signal Extractor JSON/report.
   - Evidence bridge and provenance.
   - Physical AI wedge and readiness disclaimer.

# Files To Inspect First

- `src/App.tsx`
- `src/App.css`
- `src/components/Landing.tsx`
- `src/components/CaptureConsole.tsx`
- `src/components/UnderstandingProgress.tsx`
- `src/components/ReflectAlign.tsx`
- `src/components/WorkflowIllustration.tsx`
- `src/components/EnvironmentPreview.tsx`
- `src/components/LicenseResults.tsx`
- `src/captureManifest.ts`
- `src/workflowDraft.ts`
- `src/environmentPlan.ts`
- relevant tests in `src/*.test.ts`, `server/*.test.ts`, `server/env/*.test.ts`

# Implementation Guidance

- Work in the existing React/CSS stack. Do not add Tailwind unless explicitly approved;
  this repo currently uses `src/App.css`.
- Prefer focused component/CSS refinements over large rewrites.
- Keep mobile responsive and avoid overlap/clipping.
- Use semantic HTML and accessible labels/focus states.
- If you add small CSS-native product mockups/illustrations, keep them lightweight.
- If you have access to image generation and want to add bitmap assets, ask first;
  otherwise use CSS/React product-preview visuals.

# Verification

- Run `npm run gates` before and after.
- Manually verify with a fresh dev server. If port `5174` shows stale old UI, start a
  strict fresh port such as:

  ```sh
  npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
  ```

- Report the exact URL tested.
- Verify the click path:
  1. landing page visible
  2. primary CTA leads to capture
  3. upload video/file button visible
  4. Google Drive link visible
  5. analyze -> understand -> align -> illustrate -> preview -> results

# Report Back

Write to `.agentloop/claude.md` and end with:

## Handoff To Codex
Status:
Needs:
Files changed:
Gates:
Preview URL tested:
Questions:
```
