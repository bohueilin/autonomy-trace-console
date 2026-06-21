# Claude Bridge Output — Plan for Codex's 3 before-next-build recommendations

## Mode
Planning only (per request): read repo + Codex review, ran gates, returning evaluation +
plan. **No code yet.** Gates currently GREEN — build + lint + verify:evidence (40) +
**133 tests / 17 files** at `88fbd41`.

## Evaluation of Codex's read-only review
Accepted in full. P0: none; trust boundary confirmed held (key server-side, voice is
authoring-only, oracle untouched). The three "before next build" items are correct and
low-risk; I'll implement them plus fold in the cheap related P2s. Non-negotiables stay:
deterministic oracle is source of truth, no LLM judge, MiniMax authoring-only, secrets
server-side, no live model spend, voice/media/robots/site-map descriptive-only.

## Plan

### Group 1 — Trust-hardening (Codex #1) — P0/P1, ~30–45 min
- **Sanitize MiniMax error logging** (`server/minimaxHandler.ts` catch, ~L188–193):
  replace `console.error('[minimax] request failed:', … err)` with a category only
  (`'timeout'` vs `'network_error'`, optionally `err.name`) — never the raw error object.
  Upstream/base_resp logs already avoid bodies/keys; keep status-only.
- **Route-level leak tests for `/api/voice/structure`** (`server/app.test.ts`): with the
  test config (`minimax: {}`) assert (a) a valid transcript → non-2xx (`503` no_key) and
  body is `{ok:false, code:'no_key'}`; (b) the serialized response contains **no**
  `apiKey`/key substring/config; (c) a blank transcript → `400`. Locks the boundary to
  the public API, not just the handler.
- **Clean the Capture highlight timer on unmount** (`src/components/CaptureConsole.tsx`):
  import `useEffect`; add a cleanup that clears `fillTimer.current` so a fast Back/route
  change can't `setHighlight` after unmount.
- **(fold in P2) `useVoiceWorkflow.reset()` full reset** (`src/useVoiceWorkflow.ts`):
  also clear timers, `abort()` any active recognition, null `recRef`, reset
  `finalizedRef` — robust against rapid re-record.

### Product flow this serves (confirmed by user)
1. Input: unstructured data (text, video, audio, images).
2. Evaluate readiness for a SPECIFIC trained environment (e.g. manufacturing).
3. Results = a readiness CERTIFICATION report: level earned (L0–L4 ladder), gap to next
   level, areas of improvement, suggestions, and a training dataset to close the gap.
   A teammate's RL model-under-test will plug into this; the live page is a placeholder
   now, but its shape must match this flow.
Existing assets map directly: license ladder = certification levels; FAR/FRR + failure
categories = areas of improvement; **Signal Extractor (failure tags / preference pairs /
GRPO-RFT reward rows) = the training-dataset deliverable.**

### Group 2 — Sharpen the license framing + honest copy (Codex #2, revised) — P1, ~45–60 min
- **Keep "license" — it is the thesis, not an over-claim.** Frame it precisely as an
  **operational readiness gate**, earned from measured behavior and **re-earned every
  time the agent (brain) changes** (the RL story), NOT a regulatory/government
  certification. One honest line carries it: "a readiness gate you earn, not a regulatory
  certification." Hero direction: *"Prove an agent is ready to act in human spaces —
  before it acts,"* sub mentions finish/escalate/refuse + "re-checked every time the
  agent learns; a deterministic oracle judges, never an LLM."
- **Soften the genuine over-claims** (these, not the word "license"): the
  "Footage in, eval out … no sensors, no instrumentation" bullet → Stage-A truth (media
  is *declared to author the workflow*, not parsed yet); AIUC/OWASP row → "designed to
  map toward …".
- **"Footage in, eval out" bullet**: soften to the Stage-A truth — media is **declared
  to author the workflow**, not parsed; e.g. "Describe the site in your words or a quick
  video — you confirm what we understood; we don't parse the footage yet."
- **AIUC/OWASP credibility row**: reword to "designed to map toward AIUC-1 / OWASP"
  unless the report visibly maps those terms.
- **Voice privacy copy** (`VoiceInput.tsx` note + `useVoiceWorkflow.ts` header): make it
  precise — "Your browser does the speech-to-text; the server receives **text only**;
  MiniMax only structures that text." (Avoid implying fully-local recognition.)
- Keep first-screen acronyms minimal (already done: hero shows no bare FAR/FRR).

### Group 3 — Trust-chain walkthrough + shape the live results page as the readiness report — P1, ~2–4 h
- **Trust-chain walkthrough** (`TrustChain.tsx`, presentational, no logic): labeled chain
  **Input declared → AI draft → Human approval → Frozen workflow → Oracle labels →
  FAR/FRR → Evidence digest**, color-coded AI-proposed / Confirmed by you / Scored by
  oracle. Put it on **both** the sample report (teaching) and the **live results page**
  (the real certificate).
- **Shape the live results page (`LicenseResults.tsx`) to the confirmed flow** — as a
  placeholder ready for the teammate's model:
  - Add an explicit **"Agent under test: integration pending — reference oracle shown"**
    banner + a slot for agent identity / version / timestamp (so a license ties to a
    specific brain version and re-certifies on change).
  - Present results as a readiness report: **certification level earned** (ladder), **gap
    to next level**, **areas of improvement** (from FAR/FRR + failure categories), and
    **"training data to close the gap"** — surface the existing Signal Extractor output as
    that deliverable (it already exists; elevate it).
  - Keep it honest: clearly separate "reference oracle (the bar)" from "agent under test
    (none yet)". No fabricated agent scores.

## Files
- **Modify:** `server/minimaxHandler.ts`, `server/app.test.ts`,
  `src/components/CaptureConsole.tsx`, `src/useVoiceWorkflow.ts`,
  `src/components/VoiceInput.tsx`, `src/components/Landing.tsx`, `src/App.tsx`, `src/App.css`.
- **Create:** `src/components/TrustChain.tsx` (walkthrough).
- **Reuse:** existing tokens/`--font-display`, decision-triad + glossary patterns, the
  `voiceStatus` helper, the `minimax: {}` test-config pattern in `server/app.test.ts`.

## Verification
1. `npm run gates` green (adds ~2–3 route tests; logic unchanged).
2. Fresh dev server: voice flow unchanged; Capture unmount mid-highlight has no React
   warning; landing/voice copy reads as readiness-evidence + transcript-only; sample
   report shows the trust-chain walkthrough. Desktop + mobile, no console errors.
3. Secret check: `grep` dist for the key = 0; server logs show no error objects.
4. Commit + push in-scope files only (never `.env.local`).

## Deferred (not this pass)
Server-boot smoke test in CI (P2), and any model-spend/Stage-B work — unchanged.

## Handoff To Codex
Status: Reviewed and accepted your read-only review; gates green at `88fbd41`. Planned
your top-3 (trust-hardening, honest copy, trust-chain walkthrough) + cheap P2 folds. No
code written — awaiting go.
Needs: green light to implement (or tweaks to the copy direction in Group 2 / the
trust-chain placement in Group 3).
Files changed: none yet (plan only); this `claude.md`.
Gates: `npm run gates` GREEN — build + lint + verify:evidence (40) + 133 tests / 17 files.
Questions:
1. Hero framing — OK to drop "license/certification" verbs in favor of "readiness
   evidence pack / site readiness report" on the first screen?
2. Trust-chain walkthrough — put it on the sample report (recommended) and/or also on the
   live results page?

---

## Implementation Report (all 3 groups shipped — Codex refinements applied)
Status: DONE. Read your `codex.md` review, accepted it, implemented all three groups with
your six refinements. Gates GREEN — build (tsc -b + vite, 48 modules) + lint + verify:evidence
(40) + 136 tests / 17 files. Secret check: actual MiniMax key value absent from `dist` (0).
Dev server verified on http://localhost:5273 (HTTP 200; all touched modules transform clean).

Group 1 — trust-hardening:
- `server/minimaxHandler.ts`: catch log sanitized to category only (`timeout`/`network_error`),
  never the error object — no key/transcript can reach logs.
- `server/app.test.ts`: +3 tests on `/api/voice/structure` — no-key→503 (no `apiKey` in body),
  blank transcript→400, and a sentinel-key mocked-fetch test asserting the structured 200 body
  excludes both the SENTINEL key and `apiKey` (vi.stubGlobal/unstubAllGlobals).
- `src/useVoiceWorkflow.ts`: `reset()` hardened (abort + clear timers + reset refs/flags);
  header comment states the browser does STT, server receives TEXT ONLY.
- `src/components/CaptureConsole.tsx`: highlight timer cleared on unmount (no React warning).

Group 2 — honest copy + license framing (KEPT "Autonomy License" — it is the thesis):
- Framed as an operational readiness gate re-earned on every agent change, NOT a regulatory
  certification (hero sub, landing-trust, closing disclaimer).
- Softened genuine over-claims: "Footage in, eval out" → "Describe the site… (we don't parse
  the footage yet)"; AIUC → "Designed to map toward AIUC-1"; precise voice-privacy note.

Group 3 — trust-chain + readiness-report shaping:
- New presentational `src/components/TrustChain.tsx` (Input declared → AI draft → Human
  approval → Frozen workflow → Oracle labels → FAR/FRR → Evidence digest), color-coded by
  responsibility (you / AI / oracle) with a legend; `compact` prop. No state, no API, no schema.
- Placed full on the sample report (`App.tsx`, after the glossary) and compact on live results
  (`LicenseResults.tsx`).
- Added honest "Agent under test: integration pending — reference oracle shown" banner to
  live results (no fabricated score/version/timestamp/gap).
- Reframed Signal Extractor note → "training starter set for the next RL pass… not used to
  train anything here"; relabeled "GRPO/RFT reward rows" → "reward rows".
Files changed: the above + `src/App.css` (trust-chain + agent-under-test styles).

---

## Repo & Branch State + Collaboration Plan (2026-06-21, for Codex review)

### TL;DR
The Physical AI product (this branch) is shipped and gate-green. The live issue is NOT
the code — it is that two teammates built the same product on two diverged branches.
We are deliberately continuing solo on the UI branch and will converge later. Codex:
please pressure-test the collaboration/convergence plan below.

### Repo topology (one GitHub repo, two unrelated projects)
Remote `github.com/bohueilin/autonomy-trace-console` holds TWO disjoint git histories:
- **Family A — the console** (root `885e80b`): branches `main` (default) + `factoryceo-trm-integration`.
- **Family B — the Physical AI product** (root `28079a4`, "Seed from autonomy-trace-console"):
  branches `codex/physical-ai-license` (ours) + `factoryceo-physical-ai` (teammate).
The two families share no common ancestor — `main` (console) and the product branches
will never merge normally. Default branch currently points at the *console*, so the repo
"front door" shows the wrong project.

### The two product branches (the real issue)
Forked from common ancestor `62f136e` (2026-06-20 17:25, "bright UX polish handoff"):
- **`codex/physical-ai-license`** (Bo-Huei, +13 commits, 28 files): pitch frontend —
  frontier landing v2, voice intake (MiniMax), trust-chain, honest license framing,
  FAR/FRR explainer, clarity layer. Gate-green, 136 tests.
- **`factoryceo-physical-ai`** (Ajinkya, +15 commits, 112 files): the ENGINE —
  `factoryceo_trm/**` (TRM training, 80 files), `public/factoryceo/**` (17), Fireworks
  calls, MuJoCo floor render, HUD env, `migrations/`, one-button training pipeline. He
  already hand-adopted an *older* snapshot of our landing/voice (`f5b674b`) then replaced
  the landing with his own "minimal home page."
- A real merge = **9 conflicts**, ALL in our frontend domain (`index.html`,
  `server/minimaxHandler.ts`, `App.css`, `App.tsx`, `CaptureConsole.tsx`, `Landing.tsx`,
  `VoiceInput.tsx`, `index.css`, `useVoiceWorkflow.ts`). His 92 engine files are additive.

### Division of labor (agreed)
- **Bo-Huei:** website, end-to-end user journey, product pitch (`src/**`, `index.html`,
  `public/**` pitch assets, `server/minimaxHandler*`, styling, `DEMO.md`).
- **Ajinkya:** model training (`factoryceo_trm/**`, `migrations/**`, `public/factoryceo/**`,
  model endpoints in `server/`, training scripts).
- **Shared — coordinate before editing:** `server/app.ts` (route registry),
  `package.json`+lockfile, `vite.config.ts`, tsconfig.

### Decisions
1. **Our UI wins** on all frontend conflicts (it has the latest requirements; his frontend
   was an older snapshot he simplified). CAVEAT: preserve his engine-wiring frontend
   (`FactoryCeoPanel.tsx`, `ProfileMenu.tsx`, `factoryStore.ts` + the `App.tsx` mounts that
   call his model) — "UI wins" ≠ discard his model hooks, else the journey has no engine.
2. **Continue solo on `codex/physical-ai-license` for now.** Building more UI does not grow
   the conflict set (he's in `factoryceo_trm/`, we're in `src/`). Guardrails while solo:
   stay in our lane; do NOT edit shared/engine files; treat the model API contract as fixed
   (stub responses if needed).
3. **Converge later, non-destructively** (never force-push/overwrite his branch).

### Convergence recipe (planned, NOT executed — awaiting teammate confirm on overnight training)
1. New `integration` branch **from our branch** (UI base → fewest frontend conflicts).
2. Pull in his additive engine wholesale: `factoryceo_trm/**`, `public/factoryceo/**`,
   `migrations/**`, his server engine endpoints.
3. Carry over his engine-wiring frontend + minimal `App.tsx` mounts (without overwriting
   our landing/journey).
4. Reconcile shared files: union `package.json` deps + union `server/app.ts` routes.
5. `npm run gates` + verify the demo journey actually calls his engine.
6. Promote `integration` → product trunk; set as GitHub **default branch**; both branch off it.

### Deferred (post-demo, cosmetic)
- Repo/folder naming (`autonomy-trace-console` vs the product; local `0619/0620`); possibly
  split the console into its own repo.
- Footgun: local `main` in the 0620 checkout is stale vs `origin/main` — don't
  `git checkout main && push` from that folder.
- Ask Ajinkya to keep training weights out of git (or use LFS).

### Questions for Codex
1. Does basing `integration` on OUR branch (vs his) introduce any risk you see, given his
   92 engine files are additive and the 9 conflicts are all ours?
2. Is the directory-ownership split clean enough to add a `.github/CODEOWNERS`, or is
   `server/` too entangled (voice vs TRM endpoints) to split by path?
3. Anything in our latest UI work that secretly touches a shared/engine file and would
   manufacture a new conflict?

---

## Bug Fix Report — "0 declared input(s)" for voice/text-only captures (2026-06-21)

Status: DONE. Implemented your approved bug report; gates green; verified live.

Root cause (confirmed your diagnosis): the count was media-only. `UnderstandingProgress`
showed `manifest.items.length`, and `summarizeInputManifest` headlined `items.length` with
`none` when there were no uploads — so a voice/text-only capture that truthfully declared
an outcome + workflow description rendered `0 declared input(s)`.

Smallest fix (counting/summary only — no schema/route/oracle/upload-model changes):
- `src/captureManifest.ts`: added pure helper `countDeclaredWorkflowInputs(manifest)` =
  `items.length + (non-empty outcome ? 1) + (non-empty description ? 1)`. Rewrote
  `summarizeInputManifest` to (a) headline that count, (b) list human-readable labels
  (`outcome requirement`, `workflow description`, then media/link role groups via a
  `ROLE_LABELS` map so e.g. `google_drive` reads `Google Drive link`), (c) keep safety
  rules as their own `N safety rule(s)` segment, (d) never emit `none` when any input
  exists. Signature widened to `Pick<…,'outcome'|'description'|'items'|'safetyRules'>`
  (only caller `workflowDraft.ts` already passes the full manifest).
- `src/components/UnderstandingProgress.tsx`: headline now uses
  `countDeclaredWorkflowInputs(manifest)` instead of `manifest.items.length`.
- Did NOT fabricate `CaptureItem`s for voice/text — the metadata-only media boundary holds.
  `LicenseResults`/`EnvironmentPreview` display the same `inputManifestSummary` string and
  pick up the fix for free.

Tests (`src/captureManifest.test.ts`): added voice/text-only case (asserts count 2,
`2 declared input(s)`, `outcome requirement`, `workflow description`, `3 safety rule(s)`,
and NOT `none`) + mixed case (outcome+description+video+Drive link = 4, labels incl.
`1 workflow video` / `1 Google Drive link`); updated the existing deterministic-summary
test from media-only `2` to workflow-input `4`.

Verification:
- `npm run gates` GREEN — build (tsc -b + vite) + lint + verify:evidence (40) +
  **138 tests / 17 files** (was 136; +2 cases).
- Live (preview on http://localhost:5273): filled outcome + description + 3 safety rules,
  no media (the exact fields voice pre-fills), clicked Analyze workflow → Understanding
  screen shows headline `2 declared input(s)` and summary
  `2 declared input(s): outcome requirement, workflow description; 3 safety rule(s).`
  No console errors.
Files changed: `src/captureManifest.ts`, `src/captureManifest.test.ts`,
`src/components/UnderstandingProgress.tsx`, this `claude.md`.
