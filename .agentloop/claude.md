# Claude Bridge Output — Media-Driven Workflow Authoring UX Spec

## Mode
Planning only. Inspected the repo, ran `npm run gates` (GREEN: build + lint +
verify:evidence 40 + **121 tests / 14 files**). **No code written.** This is the
world-class UX spec + staged implementation plan for:

**Capture → Understand → Reflect back → Align → Illustrate → Simulate → License**

Non-negotiable spine: AI/extraction is **authoring only**; the deterministic
oracle/verifier is the **judge**. Nothing the user uploads or the stub proposes may
set labels, rewards, license, or trusted evidence.

---

## 1. UX narrative + annotated wireframes (per step)

The console should feel like a **calm safety workshop**, not an upload wizard. Single
column, generous spacing, one primary action per screen, protective/practical copy.
Persona thread: *"Can this robot be trusted near my dad on the floor?"*

### 0 · Landing — "Describe your site"
Reuses `src/components/Landing.tsx`. Keep the hero line; swap the primary CTA to
**"Describe your site"** → `capture`; secondary **"See sample safety case"** →
`showcase`. One-sentence promise: *upload examples → confirm the workflow → run a
deterministic eval.*
```
┌───────────────────────────────────────────────┐
│  Before a robot works beside someone you love… │
│  [ Describe your site ]   See sample safety case│
│  upload · confirm · deterministic eval          │
└───────────────────────────────────────────────┘
```

### 1 · Capture (replaces `intake`)
Large drop zone + role-tagged media cards (video/photos/PDF·SOP/floor plan/forbidden
example/robot profile), a text-description box, safety-rules list, and *tentative*
domain + embodiment (clearly "not final until review"). Primary **"Analyze workflow"**;
fallback **"Map manually instead"** (skips the stub, goes straight to an empty
Reflect/Align canvas — zero model spend path).
```
┌── Describe your site ───────────────────────────┐
│  ⬚ drag video / photos / SOP / floor plan        │
│  [card] dad_floor.mp4 · video · 42MB · role▾ · ✕ │
│  Text: "Dad moves totes from receiving to pack…" │
│  Safety rules: + add rule                        │
│  Domain ▾ Manufacturing   Robot ▾ Humanoid (draft)│
│  [ Analyze workflow ]      Map manually instead   │
└─────────────────────────────────────────────────┘
```

### 2 · Understanding (new, honest processing)
Even though deterministic-stubbed, show an honest analysis checklist that resolves in
sequence: *media received → site clues identified → candidate zones drafted → task
storyboard drafted → hazards/rules drafted → eval mapping prepared.* Copy: *"You'll
confirm every assumption next."* States: normal, low-confidence, offline, manual.

### 3 · Reflect back & Align (THE screen)
Editable, **source-linked** understanding in three editors:
- **Site map** (start, item, drop, obstacles, hazards, human-only zones) on a grid.
- **Task storyboard** (ordered observable steps).
- **Safety/terminal rules** → declared finish / escalate / refuse situations.
Every item carries a **provenance chip** (`AI-proposed` / `Edited` / `Confirmed by
you`), a **confidence** label, and a **source ref** (which uploaded card suggested it).
Inline accept/edit/delete, keyboard-first. Primary **"Approve workflow"**; secondary
**"Back to capture"**.
```
┌── Does this match your floor? ──────────────────┐
│ SITE MAP            │ STORYBOLD        │ RULES    │
│ grid w/ S,I,D,▲haz, │ 1 observe        │ refuse:  │
│ ▒human-only         │ 2 scan…          │ spill    │
│ [chip AI-proposed]  │ [chip Edited]    │[Confirmed]│
│ source: dad_floor.mp4                            │
│            [ Approve workflow ]   Back to capture │
└─────────────────────────────────────────────────┘
```

### 4 · Illustrate (deterministic workflow animation)
Animated rollout of the representative symbolic task: robot token does
observe→scan→move→pick→drop→**finish/escalate/refuse**, with a captioned "why" at the
terminal. Labeled **"Illustration, not proof."** Primary **"Freeze eval"**. Emotional
beat: *"Does this match your dad's floor?"*

### 5 · Freeze → Preview → Run (extends `EnvironmentPreview`)
The existing preview becomes the **frozen** eval preview with a banner: **"Confirmed by
you; scored by the deterministic oracle."** After freeze, media/stub can no longer
mutate tasks. Primary **"Run license eval"**.

### 6 · Results = Safety Case (extends `LicenseResults`)
Existing report becomes the **safety case** with a provenance summary strip: *inputs
declared → facts confirmed → eval frozen → oracle scored → reference evidence
persisted.* Keep FAR/FRR, triptych, reward-hacking trace, JSON export prominent.

---

## 2. Screen / state machine (extending `App.tsx`)
Today: `type View = 'landing' | 'intake' | 'preview' | 'results' | 'showcase'`
([src/App.tsx:35](src/App.tsx)), `useState<View>('landing')`
([src/App.tsx:40](src/App.tsx)), render switch
([src/App.tsx:204-227](src/App.tsx)), `handleGenerate` builds the plan
([src/App.tsx:44-46](src/App.tsx)), `planDemo` memo
([src/App.tsx:42](src/App.tsx)).

Proposed:
```
type View =
  | 'landing' | 'capture' | 'understanding' | 'reflect'
  | 'illustrate' | 'preview' | 'results' | 'showcase'
```
New state: `capture: CaptureManifest | null`, `draft: WorkflowUnderstanding | null`,
`frozen: FrozenWorkflow | null`. Transitions:
`landing →(Describe your site) capture →(Analyze) understanding →(auto) reflect
→(Approve) illustrate →(Freeze) preview →(Run) results`; `capture →(Map manually)
reflect`; every screen → `landing`. `plan`/`planDemo` derive from `frozen` (else the
current requirement path stays as a fallback so `showcase` is unaffected).

---

## 3. Component inventory
**New (pure modules):**
- `src/captureManifest.ts` — `CaptureItem {id,name,type,size,role}`, `CaptureManifest`,
  helpers. **Local metadata only.**
- `src/workflowDraft.ts` — `WorkflowUnderstanding`, `SiteMap`, `StoryboardStep`,
  `TerminalRule`, provenance/confidence types; `proposeUnderstanding(manifest)`
  (deterministic stub), `freezeWorkflow(draft)`, `frozenToPlanInput(frozen)`.

**New (components):**
- `CaptureConsole.tsx` (drop zone + role cards + text/rules + tentative domain/embodiment)
- `UnderstandingProgress.tsx` (honest checklist + states)
- `ReflectAlign.tsx` orchestrating `SiteMapEditor.tsx`, `StoryboardEditor.tsx`,
  `TerminalRulesEditor.tsx`, plus `ProvenanceChip.tsx` + `ConfidenceBadge.tsx`
- `WorkflowIllustration.tsx` (deterministic SVG/RAF rollout; reduced-motion aware)
- `FrozenBanner.tsx`

**Reuse/extend (with citations):**
- `Landing.tsx` — new CTAs (currently routes via `App.tsx:205`).
- `EnvironmentPreview.tsx:1-3,37-111` — becomes frozen preview; add `FrozenBanner`;
  it already shows plan meta, vocabulary, oracle assumptions, task labels, and the
  deterministic run button.
- `LicenseResults.tsx:117-205` (report) + `:207-235` (Stage A evidence bridge) — add
  provenance summary strip.
- `licenseReport.ts:36-92` — feed declared/confirmed/frozen provenance counts into the
  safety case (descriptive only).
- `warehouseViz.tsx` (`MatrixMini`, `TriptychCard`) — reused as-is.
- `environmentPlan.ts:270-293` `buildEnvironmentPlan` — extend to
  `buildEnvironmentPlan(req, frozen?)` (backward compatible).

---

## 4. Interaction & motion spec
- **Step transitions:** 200–260ms fade+slide between views; one primary action focuses
  on mount.
- **Understanding checklist:** sequential check-offs (~350ms cadence), skippable; never
  blocks; shows low-confidence/offline/manual substates.
- **Workflow animation:** robot token steps the oracle path at ~400ms/step with a
  caption track; terminal moment pulses and prints the "why."
- **Upload states (immaculate):** empty · drag-over · local-capture · analyzing ·
  low-confidence · needs-confirmation · approved · error · offline · manual-fallback.
- **`prefers-reduced-motion`:** all transitions become instant; the animation degrades
  to a **static annotated path + a "Play steps" stepper** (no autoplay).
- **Accessibility AA:** keyboard upload (button + input), keyboard grid editing
  (arrow-key cell selection, enter to toggle cell role), visible focus rings, SR labels
  on every chip/cell, **color-independent status** (icon + text, not just color),
  mobile-safe hit targets.
- **Responsive:** site map is a fluid grid (CSS grid of cells) usable on mobile, not a
  fixed canvas; editors stack but stay operable.

---

## 5. Data & trust model (the freeze boundary)
- **Capture (Stage A):** client captures `name, type, size, role` only — **no
  `FileReader`, no object URLs, no upload/storage, no bytes read.** Labeled "workflow
  footage / intake evidence (declared, not parsed)."
- **Draft understanding:** output of the deterministic stub (later: vision/LLM). It is a
  **draft, never trusted**; every item is editable; carries `source` +
  `confidence`.
- **Freeze:** human approval produces an **immutable `FrozenWorkflow` snapshot**
  (stable hash via the existing djb2 pattern in `environmentPlan.ts`). This is the only
  thing that becomes eval configuration.
- **Mapping (the safe lever):** `frozenToPlanInput` may **select/reorder existing
  canonical tasks**, set the **embodiment enum**, set **domain**, and carry a
  **descriptive provenance snapshot** — and **nothing else**. It cannot emit grid
  physics, oracle labels, rewards, or license. Labels still come from `bfsOracle`.
- **Judge:** the deterministic oracle/verifier (`server/env/warehouseGym.ts:448-528`
  scores from signed context; `:581-628` runs the deterministic reference). Server
  trusts only the embodiment enum as a physics lever (already enforced; signed payload
  at `warehouseGym.ts:136-148`).
- **Evidence:** provenance may ride along **after freeze** in the already
  digest-covered `scenario_snapshot` (`warehouseGym.ts:319,353-361`;
  `DIGEST_FIELDS` in `server/evidence/digest.ts`) — uploaded media is **never** proof.

**Honesty note (P0 below):** the editable **site map is a descriptive understanding**.
In Stage A it does **not** synthesize new BFS grids (procedural physics is deferred);
it selects/curates the proven canonical tasks whose oracle labels match the declared
finish/escalate/refuse situations, and drives the *illustration*. This must be stated
plainly in UI copy so the site map is never mistaken for the scored grid.

---

## 6. Reuse map (file:line)
| Need | Reuse / extend | Citation |
| --- | --- | --- |
| View switch | extend View + render | [src/App.tsx:35](src/App.tsx), [:40](src/App.tsx), [:204-227](src/App.tsx) |
| Plan build | `buildEnvironmentPlan(req, frozen?)` | [src/environmentPlan.ts:270-293](src/environmentPlan.ts) |
| Trust note | deterministic/no-LLM header | [src/environmentPlan.ts:10-16](src/environmentPlan.ts) |
| Requirement shape | extend, keep `attachments` | [src/environmentPlan.ts:37-45](src/environmentPlan.ts) |
| Capture replaces | IntakeForm intent-only note + chips | [src/components/IntakeForm.tsx:1-3](src/components/IntakeForm.tsx), [:26-33](src/components/IntakeForm.tsx), [:140-166](src/components/IntakeForm.tsx) |
| Frozen preview | preview surface | [src/components/EnvironmentPreview.tsx:1-3](src/components/EnvironmentPreview.tsx), [:37-111](src/components/EnvironmentPreview.tsx) |
| Safety case | report + evidence bridge | [src/components/LicenseResults.tsx:117-205](src/components/LicenseResults.tsx), [:207-235](src/components/LicenseResults.tsx) |
| Readiness model | deterministic report | [src/licenseReport.ts:36-92](src/licenseReport.ts) |
| Signed context | trusted episode payload | [server/env/warehouseGym.ts:136-148](server/env/warehouseGym.ts) |
| Evidence row | digest-covered snapshot | [server/env/warehouseGym.ts:319](server/env/warehouseGym.ts), [:353-361](server/env/warehouseGym.ts) |
| Scoring | signed-context scoring | [server/env/warehouseGym.ts:448-528](server/env/warehouseGym.ts) |
| Reference run | deterministic oracle ref | [server/env/warehouseGym.ts:581-628](server/env/warehouseGym.ts) |
| Routes | reset/step/reference | [server/app.ts:203](server/app.ts), [:261](server/app.ts), [:282](server/app.ts) |

---

## 7. Phased implementation plan (reviewable diffs; this = Stage A)
- **A1 Capture model + `CaptureConsole`** — `captureManifest.ts` + component; real
  `<input type=file multiple>` capturing name/type/size/role only; "Map manually"
  fallback. (No bytes, no upload.)
- **A2 Draft model + `UnderstandingProgress`** — `workflowDraft.ts`
  `proposeUnderstanding(manifest)` deterministic stub + honest checklist screen.
- **A3 `ReflectAlign`** — SiteMap/Storyboard/TerminalRules editors + provenance/
  confidence chips + edit/approve gate.
- **A4 Freeze + plan map** — `freezeWorkflow` + `frozenToPlanInput` +
  `buildEnvironmentPlan(req, frozen?)` + `FrozenBanner` on preview.
- **A5 `WorkflowIllustration`** — deterministic SVG/RAF rollout of the oracle path +
  reduced-motion stepper.
- **A6 Safety case** — provenance summary strip in `LicenseResults` + report fields.
- **A7 Wire-up + Landing CTA + tests** — App state machine, Landing CTAs, tests, gates.

Each step is one small commit; gates stay green throughout. **Stage B** (gated, model
spend): vision/LLM replaces the stub, human approval still required, manual fallback
stays first-class. **Stage C** (gated, persistence): store uploads/approved plan/safety
case; tamper-evident; no schema without approval.

---

## 8. Risks (P0/P1/P2) + mitigations
- **P0 — Site map mistaken for scored grid (determinism integrity).** Mitigate:
  descriptive map only; selects canonical tasks; explicit UI label "illustration of
  your floor, not the scored grid"; a test asserts oracle labels are identical
  with/without a frozen workflow for the same embodiment.
- **P0 — Authoring leaking into judgment.** `frozenToPlanInput` whitelisted to
  embodiment enum + task selection + descriptive snapshot; unit test asserts it can
  never emit labels/rewards/battery. Server already rejects non-enum physics
  (`warehouseGym.ts` coercion) — unchanged.
- **P0 — Accidental upload / byte read.** Forbid `FileReader`/`URL.createObjectURL`/
  network in capture; lint-grep in review; copy says "declared, not parsed."
- **P1 — Scope/size.** Seven new components; mitigate via A1–A7 small diffs, each green.
- **P1 — Animation perf + reduced-motion.** SVG + `requestAnimationFrame`, cleanup on
  unmount, reduced-motion → static stepper.
- **P1 — Mobile site-map editing.** Fluid CSS-grid cells with large tap targets;
  responsive test pass in preview.
- **P2 — Provenance taxonomy drift.** Single source of chip labels (`AI-proposed` /
  `Edited` / `Confirmed by you` / `Scored by deterministic oracle`) in one module.
- **P2 — Copy tone.** Protective/practical, never melodramatic; centralize strings.

---

## 9. Test plan (keep `npm run gates` green)
- **Pure modules (primary):** `captureManifest` helpers; `proposeUnderstanding`
  deterministic (same manifest → deep-equal draft); `freezeWorkflow` deterministic +
  stable hash; `frozenToPlanInput` emits only a valid embodiment enum + descriptive
  data (asserts no labels/rewards/battery); `buildEnvironmentPlan(req, frozen)` yields
  **identical oracle labels** to `buildEnvironmentPlan(req)` for the same embodiment.
- **Server:** unchanged; existing 121 stay green (no server edits in Stage A).
- **UI:** verify in the browser preview (capture states, reflect/align edit+approve,
  illustration + reduced-motion, frozen banner, safety-case provenance). I recommend
  **not** adding `@testing-library` (new dep) this pass — keep tests at the pure-logic
  layer + preview verification. (Question 4.)

---

## Handoff To Codex
Status: Planning complete. Delivered a full media-driven authoring UX spec
(Capture→Understand→Reflect→Align→Illustrate→Simulate→License): wireframes, an
8-state `App.tsx` machine, component inventory, motion/a11y spec, the data + freeze
trust model, a file:line reuse map, a 7-step Stage-A diff plan, P0–P2 risks, and a
gates-safe test plan. AI/stub is authoring-only; the oracle stays the judge. No code.
Needs: Green light on Stage A scope (A1–A7) and answers to the questions below.
Files changed: none (planning only). This file (`.agentloop/claude.md`) is the only write.
Gates: `npm run gates` GREEN — build + lint + verify:evidence (40) + 121 tests / 14 files.
Questions:
1. Confirm the **site map is descriptive** in Stage A (selects/curates canonical tasks
   + drives illustration), with procedural grid physics explicitly deferred — so editing
   it never changes oracle labels. OK?
2. Real `<input type=file>` capturing **name/type/size/role only** (no bytes/upload),
   vs declarative cards? (I lean real inputs, metadata only.)
3. Replace the `intake` view with `capture` outright, or keep `intake` as a fast path
   and add `capture` as the richer default? (I lean replace, keep showcase intact.)
4. Keep tests at the **pure-logic layer + preview verification** (no new
   `@testing-library` dep), or do you want component tests (adds a dev dependency)?
5. Embodiment: **propose in Understanding, confirm in Reflect/Align** (it's a fact),
   removing the hard selector from Capture — agree?
6. Should the **safety-case provenance** ride into evidence `scenario_snapshot` this
   stage (descriptive, no schema), or stay client-only until Stage C?
