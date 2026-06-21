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

## Codex Read-Only Review — Voice Intake + Clarity Layer

Reviewed HEAD: `88fbd41` on `codex/physical-ai-license` after `git pull --ff-only`.

Scope reviewed: landing rebuild, MiniMax voice intake, plain-English clarity layer,
FAR/FRR honesty fix, server boot/import fix, and Claude's latest handoff.

Verification:

- `npm run gates` green: build, lint, `verify:evidence` 40 checks, 133 tests across 17 files.
- Brief server boot on `PORT=8899` succeeded after sandbox port approval, then was stopped. This confirms the current Node-native `.ts` runtime import graph boots.
- No live MiniMax, Nebius, or other model spend was triggered.

### Findings

P0: none found.

P1 — sanitize the MiniMax catch log before production demo. `server/minimaxHandler.ts:188-193`
returns a generic client error and does not echo the key, which is good. The only
remaining hardening is `console.error('[minimax] request failed:', ... err)`: raw fetch
errors normally do not include request headers, but logging arbitrary error objects is
unnecessary risk around a secret-bearing request. Log only `timeout` vs `network_error`
and maybe `err.name`, never the object.

P1 — clean up the Capture voice highlight timer on unmount. `src/components/CaptureConsole.tsx:67`
and `src/components/CaptureConsole.tsx:96-110` set a delayed `setHighlight(false)` after
voice fill. There is no unmount cleanup, so a fast Back/route transition can leave a
state update after unmount. Small fix: import `useEffect` and clear `fillTimer.current`
in cleanup.

P1 — add route-level tests for `/api/voice/structure`. `server/minimaxHandler.test.ts:35-43`
covers missing-key and bad-transcript behavior at the handler level, but `server/app.test.ts`
has no voice route coverage. Add a server route test that a missing MiniMax key returns
the expected non-2xx status/body and never includes config details or `apiKey`. This keeps
the trust-boundary claim locked to the public API, not only the helper.

P2 — make `useVoiceWorkflow.reset()` a full reset. `src/useVoiceWorkflow.ts:182-187`
only resets React state. In normal UI it appears after success, so this is not currently
dangerous, but a robust reset should also clear timers, abort/stop any active recognition,
clear `recRef`, and reset `finalizedRef`.

P2 — tighten voice privacy copy. `src/useVoiceWorkflow.ts:1-6` says no audio leaves the
device beyond the browser's own recognition. That is technically nuanced, but users may
read it as "local speech recognition." Prefer UI/docs copy like: "Your browser handles
speech recognition; the server receives text only; MiniMax only structures that text."

P2 — reduce remaining product over-claims before judges see it. `src/components/Landing.tsx:34-40`
still says "robot safety license" and "issue the autonomy license it earned"; the results
page is more honest with "readiness evidence pack" and "not a regulatory certification"
at `src/components/LicenseResults.tsx:129-160`. Bring the hero wording down to the same
standard. Also soften `src/components/Landing.tsx:166-167` ("Footage in, eval out ...
no sensors, no instrumentation") because Stage A declares media metadata and operator
approval; it does not parse video yet. Finally, `src/components/Landing.tsx:252-255`
claims AIUC-1 / OWASP alignment; keep it only if the report visibly maps to those terms,
or reword as "designed to map toward..." for the demo.

P2 — keep the native ESM import lesson codified. The current server value imports use
`.ts` where needed, including `server/minimaxHandler.ts:15-20`, `server/app.ts:24-39`,
and `server/main.ts:9-12`. Browser/test extensionless imports are fine under Vite/Vitest.
The branch now boots; consider a future tiny CI check or keeping server boot in gates if
this risk returns.

### Trust Boundary Audit

Held.

- MiniMax key remains server-side: loaded only through `server/config.ts:77-80`, with
`.env` / `.env.*` ignored and `.env.example` explicitly allowed in `.gitignore:13-18`.
- Vite does not read secret env vars; it only has a non-secret backend proxy origin in
`vite.config.ts:6-13` and proxies `/api`/`/v1` at `vite.config.ts:23-27`.
- The browser calls only `/api/voice/structure` with a transcript at
`src/useVoiceWorkflow.ts:83-91`.
- The server voice route at `server/app.ts:395-400` delegates to MiniMax and returns typed
JSON; it does not call the oracle, reward, license, or evidence persistence.
- MiniMax output is clamped and enum-coerced in `server/minimaxHandler.ts:84-115`, then
used only to pre-fill human-reviewed fields in `src/components/CaptureConsole.tsx:96-110`.
- Capture builds normal requirement/manifest data at `src/components/CaptureConsole.tsx:73-93`;
that data still flows through the existing deterministic plan/oracle path.

### Product / YC Positioning

The journey is coherent and demoable:

`landing -> Capture/voice -> Understand -> Align -> Illustrate -> Freeze -> License + Sample report`.

Strongest pieces:

- The "AI proposes; you approve; deterministic oracle judges" line is repeated in the
right places and is easy to explain live.
- FAR/FRR language is now much more credible: the landing FAQ says no blanket accuracy
claims, and results label the metrics as a reference-oracle operating point at
`src/components/LicenseResults.tsx:137-140`.
- The voice intake is a real user empathy win for the dad/factory story. It makes the
product feel designed for non-technical operators, not only ML engineers.

Remaining positioning risk:

- The hero should sell "readiness evidence for a site" more than "license/certification"
until the certification authority claim is legally/product-ready.
- The Stage A video story should be explicit: media helps author the workflow; it is not
parsed evidence yet. This honesty is not weakness; it makes the deterministic verifier
feel more trustworthy.
- Reduce acronyms on the first screen. FAR/FRR belongs after the user understands the
problem; the hero should stay human: "Can this robot help my dad safely here?"

### Ranked Next Tasks

P0, 30-45 min, low risk:

- Fix the two trust-hardening items: sanitize MiniMax error logging and add voice route
tests that the key/config never leaks.
- Clean up the capture highlight timer on unmount.
- Re-run `npm run gates`.

P1, 1-2 hours, medium-low risk:

- Tighten landing/product claims to "readiness evidence pack" / "site readiness report"
and soften "Footage in, eval out" to match the metadata-only Stage A truth.
- Make voice privacy copy precise about browser speech recognition and transcript-only
server handling.
- Add one "What is real in this demo?" micro-panel near Capture or Results.

P1, 2-4 hours, medium risk:

- Add a small sample-report walkthrough mode that highlights the trust chain:
input declared -> AI draft -> human approval -> frozen workflow -> oracle labels ->
FAR/FRR -> evidence digest. This is high YC-demo value because it turns the architecture
into a story judges can repeat.

P2, 2-3 hours, low risk:

- Make `useVoiceWorkflow.reset()` abort active recognition/timers and clear refs.
- Add a tiny server-boot smoke script to CI/gates if runtime `.ts` import regressions
keep appearing.
- Audit all first-screen acronyms and replace with plain-English labels plus tooltips.

### Non-Negotiables

Confirmed held:

- Determinism remains sacred.
- The BFS oracle/verifier is still the source of truth.
- No LLM/model is used as judge.
- MiniMax voice is authoring-only and cannot set labels, rewards, or license outcomes.
- Voice and multi-robot/site-map inputs are descriptive/authoring only in this stage.
- Secrets stay server-side and `.env.local` remains untracked.
- No live model spend was used during this review.

### Top 3 Things To Change Before The Next Build

1. Sanitize MiniMax logging, add `/api/voice/structure` route leak tests, and clean the
   capture highlight timer. This closes the trust-boundary polish loop.
2. Rewrite the hero and "Footage in, eval out" copy so the product is unmistakably a
   readiness evidence pack today, not a regulatory certification or real video parser.
3. Add a guided "trust chain" sample-report walkthrough so judges can understand the
   full story in 30 seconds without reading architecture notes.

## Codex Review Of Claude's 3-Scope Plan

Status: approved with refinements.

Claude's three groups are the right next build:

1. Trust-hardening: accept.
2. License framing and honest copy: accept, but tighten wording.
3. Trust-chain walkthrough plus readiness-report shaping: accept, with scope guardrails.

### Refinements For Claude Before Implementation

1. Route leak tests should include a sentinel key path, not only the no-key path.
   - The no-key route test is useful, but it cannot prove a configured key stays hidden.
   - Add one mocked-fetch test with `MINIMAX_API_KEY` equivalent set to a sentinel string,
     no real network/model call, and assert the response body does not include the sentinel,
     `apiKey`, upstream body text, or config details.
   - Keep the blank transcript `400` test.

2. Keep "Autonomy License" as the product thesis, but avoid bare certification claims.
   - Good: "Autonomy License is an operational readiness gate / readiness evidence pack."
   - Good: "License level earned for this reference environment."
   - Avoid: "certification report", "certified robot", or "certification level" unless the
     sentence immediately says "not regulatory certification."
   - Prefer "license level", "readiness tier", "readiness report", and "evidence pack."

3. Be careful with "training dataset to close the gap."
   - The Signal Extractor is a strong wedge, but it is not yet a full training dataset.
   - Phrase it as "failure-derived training rows", "preference pairs", "reward rows", or
     "training starter set for the next RL pass."
   - Do not imply the app already trains the model or closes the gap automatically.

4. Trust-chain walkthrough should be shared, compact, and non-invasive.
   - `TrustChain.tsx` should be presentational only.
   - Place it on both sample report and live results, but keep the live results version
     compact so it does not bury the license tier, FAR/FRR, triptych, reward-hack trace,
     Signal Extractor, or evidence bridge.
   - No new state machine, no new API, no schema changes.

5. The "agent under test" slot is valuable, but must stay honest.
   - Copy should say: "Agent under test: integration pending; reference oracle shown."
   - Do not fabricate model score, model version, timestamp, or improvement gap for a real
     agent until Stage B exists.
   - The reference oracle can be labeled as the bar/ceiling, not the robot's actual score.

6. Keep implementation small and publish cleanly.
   - Expected product-code files are fine: MiniMax handler/test, CaptureConsole,
     useVoiceWorkflow, VoiceInput, Landing, LicenseResults/App/CSS as needed, and new
     `TrustChain.tsx`.
   - Run `npm run gates` before and after.
   - Fresh browser verification should include landing, capture/voice copy, sample report,
     live results, desktop, mobile, and console errors.
   - If committing/pushing, stage only in-scope implementation files and the intended
     `.agentloop/claude.md` report; avoid accidentally staging unrelated handoff edits.

### Final Green Light

Proceed with the build after applying the refinements above.

The most important product judgment: keep the ambition of "Autonomy License" while making
the trust boundary painfully clear. The demo should feel bold to YC and boringly honest to
a safety buyer.

## Codex Bug Report — Voice-Entered Inputs Show As `0 declared input(s)`

Status: urgent UX correctness fix. Claude should implement this next.

User-observed flow:

1. User enters requirements by voice.
2. Browser speech recognition -> server-side MiniMax structuring -> form pre-fill works.
3. User clicks `Analyze workflow`.
4. The Understanding screen animates through checks, but the status card says:
   `0 declared input(s)` and `0 declared input(s): none; 3 safety rule(s).`
5. Reality for the user's test: there were 2 declared inputs plus 3 safety rules.

### Diagnosis

The app is not losing the voice fields. It is counting the wrong thing.

- `src/components/CaptureConsole.tsx:78-98` builds a `CaptureManifest` with `outcome`,
  `description`, `safetyRules`, and `items`.
- Voice pre-fill writes `outcome`, `description`, `safetyRules`, `domain`, and
  `embodiment` into that form at `src/components/CaptureConsole.tsx:101-115`.
- `src/captureManifest.ts:115-123` summarizes only `manifest.items.length`, where `items`
  means uploaded local files or Google Drive links.
- `src/components/UnderstandingProgress.tsx:51-52` displays `manifest.items.length` as
  the headline count.

So a voice-only or text-only capture can truthfully have structured requirement inputs,
but the Understanding screen reports `0 declared input(s)` because it only counts media
assets.

### Product Semantics To Fix

Separate these concepts:

- **Declared workflow inputs**: operator-provided facts that define the eval request.
  Count at least:
  - non-empty outcome requirement,
  - non-empty workflow description / notes,
  - uploaded local file metadata items,
  - declared Google Drive links.
- **Safety rules**: keep counted separately as `N safety rule(s)`.
- **Media/link assets**: still metadata-only; do not pretend voice/text created uploaded
  media.

For the user's voice-only case, the UI should show approximately:

`2 declared input(s)`

and the summary should read something like:

`2 declared input(s): outcome requirement, workflow description; 3 safety rule(s).`

If the user also uploads a workflow video and a Drive link, it should become:

`4 declared input(s): outcome requirement, workflow description, 1 workflow video, 1 Google Drive link; 3 safety rule(s).`

### Implementation Instructions For Claude

Please read `.agentloop/BRIDGE.md`, `.agentloop/GOAL.md`, `.agentloop/claude.md`, and
this section of `.agentloop/codex.md`.

This is an approved implementation pass. Please inspect the repo, run `npm run gates`
first, then implement the smallest fix. Keep diffs focused, run gates again, verify the
browser flow, and commit/push if gates are green and only in-scope files are staged.

Recommended files:

- `src/captureManifest.ts`
- `src/captureManifest.test.ts`
- `src/workflowDraft.ts` only if type/signature updates are needed
- `src/components/UnderstandingProgress.tsx`
- optionally `src/components/CaptureConsole.tsx` only if copy needs to distinguish
  workflow facts vs media assets
- `.agentloop/claude.md` for the final report

Recommended implementation:

1. Add a pure helper in `src/captureManifest.ts`, for example:
   - `countDeclaredWorkflowInputs(manifest)`
   - or return both count and labels from a helper such as `summarizeCaptureSources`.
2. Count non-empty `outcome` and non-empty `description` as declared workflow inputs.
3. Count each `manifest.items` entry as one declared workflow input, grouped by role in
   the summary.
4. Keep safety rules as their own separate count, not part of the headline input count.
5. Update `summarizeInputManifest` so it no longer says `none` when outcome/description
   are present. It should include human-readable labels such as `outcome requirement` and
   `workflow description`.
6. Update `UnderstandingProgress` to display the new declared workflow input count, not
   `manifest.items.length`.
7. Do **not** create fake `CaptureItem`s for voice/text fields. That would blur the
   metadata-only media boundary. This is a summary/counting fix, not an upload-model fix.
8. Preserve trust boundaries:
   - no media parsing,
   - no file byte reads,
   - no object URLs,
   - no model calls beyond the existing voice structuring path,
   - no oracle/reward/license changes,
   - no schema/server route changes.

### Tests Claude Should Add Or Update

Update `src/captureManifest.test.ts`:

1. Voice/text-only manifest:
   - `outcome` non-empty,
   - `description` non-empty,
   - `safetyRules` length 3,
   - `items: []`.
   - Assert the declared input count is `2`.
   - Assert summary includes `2 declared input(s)`.
   - Assert summary includes `outcome requirement` and `workflow description`.
   - Assert summary includes `3 safety rule(s)`.
   - Assert summary does **not** include `none`.

2. Mixed manifest:
   - outcome + description + 2 file/link items + safety rules.
   - Assert the count includes text facts plus media/link items.
   - Update the existing deterministic summary test if its expected count changes from
     media-only to workflow-input count.

3. Determinism:
   - The summary/count helper should be pure and stable.
   - Manifest IDs should stay deterministic.

Manual browser QA:

1. Start a fresh dev server and report the exact URL.
2. Use voice only. Confirm the form pre-fills outcome, workflow description, and safety
   rules.
3. Click `Analyze workflow`.
4. Confirm Understanding shows `2 declared input(s)` and `3 safety rule(s)`, not `0`.
5. Repeat with one uploaded file or Drive link and confirm the count increments.
6. Continue through Align -> Illustrate -> Preview -> Results to confirm no regression.

### Include This Prior Repo-Collaboration Feedback

Claude's latest handoff also asked Codex to pressure-test branch convergence. Carry this
forward, but do not implement convergence in this bugfix pass.

1. Basing a future `integration` branch on `codex/physical-ai-license` is reasonable
   because this branch has the latest product UI and the known conflicts are frontend.
   Main risk: preserve Ajinkya's engine-wiring frontend and server routes while keeping
   our landing/journey.
2. CODEOWNERS can work by broad ownership:
   - Bo-Huei/UI: `src/**`, `index.html`, pitch assets, `server/minimaxHandler*`.
   - Ajinkya/engine: `factoryceo_trm/**`, `public/factoryceo/**`, `migrations/**`, engine
     routes/scripts.
   - Shared/coordinate: `server/app.ts`, `package.json`, lockfile, `vite.config.ts`,
     tsconfig.
3. Our latest UI work did touch shared-ish files like `src/App.tsx`, `src/App.css`,
   `src/components/*`, `src/useVoiceWorkflow.ts`, and `server/minimaxHandler.ts`, but it
   did not touch engine directories. This input-count fix should avoid `server/app.ts`,
   `package.json`, and engine folders entirely.

### Handoff Back To Codex

After implementation, write to `.agentloop/claude.md`:

```md
## Handoff To Codex
Status:
Files changed:
Gates:
Preview URL tested:
Voice-only declared input result:
Mixed media declared input result:
Questions:
```
