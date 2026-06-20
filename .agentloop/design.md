## Objective

Satisfy the GOAL “Scenario scale” checkbox by expanding the scenario registry to a documented 24-scenario eval corpus with difficulty tiers and a held-out split, while keeping verifier/license semantics unchanged.

## Scope

Change only:
- `src/types.ts`
- `src/seedScenarios.ts`
- `src/App.tsx`
- `src/components/ScenarioCard.tsx`
- `src/seedScenarios.test.ts` (new)
- `README.md`

Do NOT touch:
- verifier/reward/license logic (`src/verifier.ts`, `src/license.ts`)
- gym reset/step semantics (`server/env/gym.ts`)
- evidence digest field list or InsForge persistence
- `/api` or `/v1` route behavior
- Nebius/Vapi handlers
- migrations or config

## Steps

1. Extend the `Scenario` type in `src/types.ts` with:
   - `difficulty: "easy" | "medium" | "hard"`
   - `split: "train" | "heldout"`

2. In `src/seedScenarios.ts`:
   - Bump `SCENARIO_VERSION`.
   - Expand `seedScenarios` from 9 to exactly 24 scenarios.
   - Preserve the existing 9 scenario ids/content unless a metadata-only update is needed.
   - Add 5 new scenarios per domain so each domain has exactly 8 scenarios:
     - commerce: `com-1` through `com-8`
     - business_ops: `ops-1` through `ops-8`
     - robotics: `rob-1` through `rob-8`
   - Assign each domain exactly 5 `train` and 3 `heldout` scenarios.
   - Ensure each domain includes all three difficulty tiers.
   - Keep every scenario deterministic and hand-authored: no LLM generation path, no randomness, no hidden answer leakage into `visibleSignals`.
   - Export:
     - `trainScenarios`
     - `heldoutScenarios`
     - `scenarioCorpusSummary` with counts by domain/split/difficulty, computed from `seedScenarios`.

3. In `src/App.tsx`:
   - Import and use `trainScenarios` for the mock batch eval, so the default batch run measures the training/public split only.
   - Rename UI copy from “Run 9-Episode Eval” to “Run Train Eval”.
   - Keep single `/v1` gym episodes cycling through the full `seedScenarios` registry unless a smaller change is needed; do not change the `/v1` request contract.
   - Update labels/aria text that still say “nine-episode”.

4. In `src/components/ScenarioCard.tsx`:
   - Display compact scenario metadata for `difficulty` and `split` next to the domain chip.
   - Keep hidden risk reveal behavior unchanged.

5. Add `src/seedScenarios.test.ts` with focused corpus tests:
   - exactly 24 scenarios
   - unique ids
   - exactly 8 scenarios per domain
   - exactly 5 train and 3 heldout scenarios per domain
   - every domain has at least one `easy`, `medium`, and `hard`
   - every split has at least one scenario in each domain
   - `visibleRiskScore` is finite and within `[0, 1]`
   - `correctAction` is one of `act|ask|escalate|stop`
   - `hiddenRisk` and `rationale` are non-empty strings

6. Update `README.md`:
   - Replace stale “nine seeded scenarios” / “Run 9-Episode Eval” wording.
   - Document the corpus: 24 scenarios, 8 per domain, train/heldout split, difficulty tiers.
   - Explain that the default batch eval runs the train split and held-out scenarios are reserved for generalization checks via known scenario ids.
   - Update the file table entry for `src/seedScenarios.ts`.

## Acceptance criteria

- The repo contains 24 hand-authored scenarios across the 3 existing domains.
- Scenario metadata makes train vs held-out and difficulty visible in code and UI.
- The default batch demo no longer claims to run all scenarios or a 9-episode eval.
- Held-out scenarios are present and addressable by existing server/gym paths through `scenarioId`.
- New tests enforce corpus size, balance, split, tiers, and basic scenario validity.
- Deterministic verifier/license behavior is unchanged.

## Gates

```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
