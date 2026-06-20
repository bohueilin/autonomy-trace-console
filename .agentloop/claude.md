# Claude Bridge Output

## Mode
Planning only (per `.agentloop/codex.md` → "Next Claude Planning Pass"). Read,
inspected the repo, ran gates. **No code changed.** Returns evaluation + scoped plan
for the video-to-workflow-to-eval journey.

## Repo state
- `npm run gates` GREEN: build + lint + verify:evidence (40) + **121 tests / 14 files**.
- Stage A landed: `/v1/warehouse` is embodiment/domain/plan-aware; embodiment enum is
  the ONLY physics lever; reference path + enriched (digest-covered) `scenario_snapshot`.
- Inspected: `IntakeForm.tsx`, `environmentPlan.ts`, `EnvironmentPreview.tsx`,
  `LicenseResults.tsx`, `server/env/warehouseGym.ts`, `server/app.ts`,
  `server/evidence/digest.ts`.

## Evaluation — current UI gaps vs the video-to-workflow intent
Current journey: `landing → intake → preview → results → showcase`.

1. **Intake captures intent, not artifacts.** `IntakeForm` has outcome + domain +
   embodiment + notes + attachment **toggle chips** ("Workspace images / video", etc.).
   The chips are non-functional and — critically — **never reach `buildEnvironmentPlan`**
   (it takes only the requirement; attachments/notes are dropped). There is no footage
   or file declaration.
2. **No extraction step.** Nothing turns inputs into structured **workflow facts**
   (actors/robot, zones, task steps, tools/actions, hazards, human-only zones,
   escalation triggers, refusal conditions, success criteria).
3. **No human approve/edit gate.** The intent of "operator confirms facts before they
   become eval config" has no surface.
4. **Plan ignores the job.** `buildEnvironmentPlan(req)` is a pure function of
   **domain + embodiment** over the canonical 18 tasks. So today the product cannot
   honestly claim "we understood your workflow" — two different outcomes in the same
   domain/embodiment yield identical evals.
5. **Preview shows truth but not the link.** `EnvironmentPreview` correctly shows
   `bfsOracle` labels + oracle assumptions (truth surface intact), but never connects a
   task/label back to the customer's declared workflow.
6. **Evidence lacks input provenance.** Stage A records embodiment/domain/plan in
   `scenario_snapshot`, but no input manifest or approved-facts snapshot.
7. **Trust framing is implicit.** Oracle-as-truth holds, but the UI doesn't yet make
   the "interpretation vs judge" distinction explicit — which becomes essential the
   moment video/extraction is shown to a judge.

## The trust-boundary spine (must hold in the design)
- Video/inputs/extraction = **interpretation only**. They feed a **proposal** the
  operator edits and **approves**.
- Approved facts may become eval config **only through already-server-trusted levers**:
  the **embodiment enum**, **canonical task selection**, and **descriptive metadata**.
  They must **never** set oracle labels, rewards, license, or trusted evidence.
- `bfsOracle` over canonical tasks stays the sole source of labels; the preview keeps
  showing server-derived labels.
- Uploaded media is **declared, not parsed** this pass — never proof of safety.

## Scoped plan — judge-ready "video-to-workflow-to-eval" (UI + deterministic facts)
New journey: `landing → intake → extract/review (approve) → preview → results → showcase`.

**V1 — deterministic facts model + UX (no parsing/model/storage/schema)**
1. **`src/workflowFacts.ts` (new, pure, tested).**
   - `WorkflowFacts` type: actors[], robotEmbodiment (enum), domain (enum),
     workspaceZones[], taskSteps[], tools[] (subset of warehouse tools), hazards[],
     humanOnlyZones[], escalationTriggers[], refusalConditions[], successCriteria[].
     Each fact carries `source: 'declared' | 'proposed' | 'edited'` (provenance only).
   - `proposeWorkflowFacts(requirement, declaredInputs)` — a **deterministic template
     stub** that stands in the exact UX + trust slot the future video/LLM extractor will
     occupy. Clearly labeled "proposed from template — no media parsed yet." No model.
   - `factsToPlanInput(approvedFacts)` → `{ embodiment, domain, curationHints,
     factsSnapshot }`. Emits **only** the enum levers + descriptive snapshot — provably
     cannot inject physics or labels.
2. **Intake upgrade.** Add a "Workflow footage & inputs" section. Decision needed
   (Q4) on `<input type=file>` capturing name/type/size **client-side only, never read
   or uploaded** vs declarative chips. Prominent trust label.
3. **`ExtractionReview` screen (new) — beats 2+3.** Shows proposed facts grouped and
   **editable**, each with a source badge, under a banner: *"Interpretation only — the
   oracle remains the judge."* An **"Approve & build eval"** button gates progression.
4. **`buildEnvironmentPlan(requirement, approvedFacts?)` extended (backward-compatible).**
   When facts are present: derive embodiment/domain from them, optionally curate the
   canonical task subset (Q2), and attach the approved `facts` snapshot to the plan.
   **Oracle labels are unchanged** — a test will assert labels are identical with/without
   facts for the same embodiment.
5. **Preview link (beat 4).** Add a "Mapped from your approved workflow" panel that ties
   declared refusal/escalation/success facts to the matching oracle-labeled tasks
   (descriptive narrative; truth still from `bfsOracle`).
6. **App view-state machine.** Insert `extract`/`review` between `intake` and `preview`.
7. **Tests.** `proposeWorkflowFacts` deterministic; `factsToPlanInput` only ever yields a
   valid embodiment enum + descriptive data (never raw battery/labels); plan-with-facts
   keeps oracle labels identical to plan-without; approval-gate logic.

**V2 — evidence provenance (optional, small, additive; no schema)**
8. Thread a descriptive `inputManifest` (declared artifact types + counts) and an
   `approvedFactsHash` through the existing reset / reference-episode descriptive plan
   metadata into `scenario_snapshot.plan`. Digest-covered JSONB, **no schema**. Can be
   deferred to a follow-up if you'd rather keep this pass UI-only (Q3).

## Explicit deferrals (not in this plan)
Real video parsing/transcription, vision/LLM extraction, file upload/storage infra,
model/API spend, Nebius/Stage B, InsForge schema/migration, procedural grid generation.
The "extractor" is a clearly-labeled deterministic template stub.

## Handoff To Codex
Status: Planning complete. Current journey can't represent a customer's real workflow
(inputs are dropped, no extraction/approval, plan depends only on domain+embodiment).
Proposed a deterministic facts model + extract/review/approve UX that maps approved
facts into the eval ONLY through existing server-trusted levers, keeping the oracle the
sole judge. No code written.
Needs: Decisions on Q1–Q5 below, then green light to implement V1 (and a yes/no on V2).
Files changed: none (planning only). This file (`.agentloop/claude.md`) is the only write.
Gates: `npm run gates` GREEN — build + lint + verify:evidence (40) + 121 tests / 14 files.
Questions:
1. Is a **deterministic template "extractor" stub** (no model, labeled "no media parsed
   yet") the right stand-in for this UI pass?
2. May approved facts **curate/filter** the canonical task subset (deterministic; changes
   which tasks appear, never their oracle labels), or strictly set embodiment+domain +
   descriptive annotations only?
3. Include the **V2 evidence provenance** threading (inputManifest + approvedFactsHash,
   no schema) this pass, or defer it?
4. Footage/inputs control: real `<input type=file>` capturing name/type/size
   **client-side only (never read/uploaded)**, or keep declarative chips to avoid any
   impression of upload? (I lean file inputs, names only.)
5. Where is embodiment decided — keep the intake selector, or **propose it in extraction
   and confirm it in review** (since "which embodiment is appropriate" is itself a fact)?
   (I lean propose-then-confirm.)
