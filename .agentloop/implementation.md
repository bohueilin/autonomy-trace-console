All gates green. Implementation report below.

## Implementation report

Implemented the plan in `design.md` exactly — expanded the scenario registry to a documented 24-scenario eval corpus with difficulty tiers and a train/held-out split. Verifier/license/digest/persistence semantics untouched.

### Files changed
- **`src/types.ts`** — added `Difficulty` (`easy|medium|hard`) and `ScenarioSplit` (`train|heldout`) types; added `difficulty` and `split` fields to `Scenario`, documented as metadata-only (not read by the verifier).
- **`src/seedScenarios.ts`** — bumped `SCENARIO_VERSION` to `2026-06-20.1`; tagged the existing 9 scenarios with difficulty/split (content unchanged); added 15 new hand-authored scenarios (com-4..8, ops-4..8, rob-4..8) → 8 per domain. Each domain has exactly 5 train / 3 held-out and spans all three tiers. Added exports `trainScenarios`, `heldoutScenarios`, and `scenarioCorpusSummary` (counts by domain/split/difficulty, all derived from `seedScenarios`).
- **`src/App.tsx`** — imports `trainScenarios`; renamed `runFullEval`→`runTrainEval` to run the train split only; UI copy "Run 9-Episode Eval"→"Run Train Eval"; updated the stale "nine-episode" aria-label and the gym-license comment.
- **`src/components/ScenarioCard.tsx`** — added compact `difficulty` + `split` chips next to the domain chip. Hidden-risk reveal behavior unchanged.
- **`src/seedScenarios.test.ts`** (new) — 9 tests enforcing corpus size (24), unique ids, 8/domain, 5 train + 3 held-out per domain, all tiers per domain, both splits per domain, split-export reconstruction, summary consistency, and per-scenario validity (`visibleRiskScore` finite in [0,1], `correctAction` ∈ action set, non-empty `hiddenRisk`/`rationale`).
- **`README.md`** — replaced all "nine seeded"/"9-Episode Eval" wording; added a "Scenario corpus" section; updated demo script, authority table, and the `src/seedScenarios.ts` file-table entry.

### Key decisions
- New scenarios cover a spread of `correctAction` (act/ask/escalate/stop) with `riskLevel` chosen so the verifier's catastrophic gate stays meaningful (e.g. held-out `com-6`/`ops-7` are high-risk stop scenarios; `ops-6` is high-risk escalate).
- Held-out scenarios are addressable through existing server paths automatically — `server/env/gym.ts` and `server/runEpisodeHandler.ts` resolve any id via `seedScenarios.find(...)`, so no server changes were needed (per scope).
- Splits/summary are **derived** from `seedScenarios` (single source of truth), so the test assertions and UI can't drift from the data.

### Deviation from listed scope (flagged)
- I added a small self-contained CSS block to **`src/App.css`** to style the new difficulty/split chips. `App.css` was **not** in the design's file list, but step 4 ("display compact scenario metadata") renders nothing legible without it. The block only adds `.scenario-meta`/`.meta-chip` + tier/split color classes; no existing rules changed. If Codex prefers strict scope, this can be reverted (chips would still render as plain text).

### Gate results — all pass
- `npm run build` — ✅ tsc + vite build clean.
- `npm run lint` — ✅ no errors.
- `npm run verify:evidence` — ✅ ALL CHECKS PASSED (40 checks).
- `npm test` — ✅ 9 files, **83 passed** (includes the new 9 corpus tests).

### Open questions for Codex
- App.css styling deviation above — keep or revert?
- The single `/v1` UI episode still cycles through the full `seedScenarios` (24) via `cursor`, per the plan ("keep cycling through the full registry unless a smaller change is needed"). Left unchanged — confirm that's the intent, or should the single-episode cursor also be train-only?
- Possible follow-up (not done — adjacent): surface `scenarioCorpusSummary` somewhere in the UI (e.g. the scenario-bank header) so the train/held-out balance is visible at a glance.
