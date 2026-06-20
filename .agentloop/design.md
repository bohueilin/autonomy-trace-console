## Objective

Make `/v1` gym evidence and the visible license presentation authoritative for reference-agent runs, advancing the GOAL checkboxes “Gym is canonical” and “One evidence schema.”

## Scope

Change only:

- `server/env/gym.ts`
- `server/env/gym.test.ts`
- `src/types.ts`
- `src/gymClient.ts`
- `src/gymClient.test.ts`
- `src/App.tsx`
- `README.md`

Do NOT touch verifier, reward, license semantics, episode token signing, digest field list, InsForge write/read helpers, `server/runEpisodeHandler.ts`, Vapi, scenario answers, migrations, or Vite config.

## Steps

1. In `server/env/gym.ts`, make gym reset observations include the non-hidden mock feature `visibleRiskScore`:
   - Add it to the server `Observation` shape.
   - Return `scenario.visibleRiskScore` from `resetEpisode`.
   - Keep hidden fields excluded: no `hiddenRisk`, `correctAction`, or `rationale`.

2. In `src/types.ts`, mirror `visibleRiskScore: number` on `GymObservation`.

3. In `src/gymClient.ts`, add `observationToMockView(obs: GymObservation): MockPolicyView`.
   - It must build the mock policy view only from reset observation fields.
   - Keep `observationToModelView` omitting `visibleRiskScore`.

4. Update `src/App.tsx` so the mock proposer uses `observationToMockView(reset.observation)`, not `toMockView(scenario)`.
   - This applies to normal mock mode and Nebius fallback.
   - Keep local `scenario` only for post-score display.

5. Fix Nebius fallback attribution in `src/App.tsx`:
   - If Nebius proposal fails after an initial `nebius-reference` reset, do not step that episode.
   - Open a fresh `/v1/episodes` reset for the same scenario with `agentId: "mock-reference"`.
   - Step only the fresh mock episode.
   - The displayed trace must use the stepped reset/step pair and show fallback notice.
   - The fallback must not persist or display a stepped episode whose `agentId` is `nebius-reference`.

6. In `server/env/gym.ts`, derive durable provenance from the signed reset `agentId` when building `auditRow`:
   - `mock-reference` -> `requested_policy_mode: "mock"`, `actual_policy_source: "mock"`.
   - `nebius-reference` -> `requested_policy_mode: "nebius"`, `actual_policy_source: "nebius"`.
   - Anything else -> `requested_policy_mode: "external"`, `actual_policy_source: "external"`.
   - Keep `fallback: false` and `fallback_code: null` in gym rows; fallback is represented by stepping a fresh mock episode.
   - Do not accept provenance, reward, verdict, or license fields in the step request.

7. Make the visible license authoritative for gym runs:
   - In `src/gymClient.ts`, add a pure adapter from `GymRunLicense` to `LicenseState`.
   - In `src/App.tsx`, maintain separate state for the latest gym/server license.
   - The top license chip and `LicenseSummary` should render the latest `/v1` step license after a gym episode.
   - `Run 9-Episode Eval` must clear or label this as demo-only so it cannot overwrite the authoritative gym license.
   - Keep the evidence panel’s server license unchanged.

8. Update README wording around “Server-authoritative vs local/demo-only”:
   - Replace stale “Run Server Episode” / “Run Episode” rows with current `/v1` gym button and mock 9-episode demo eval.
   - State that Nebius fallback opens and steps a mock-reference gym episode so durable evidence does not claim Nebius decided.
   - State that the headline license after a gym run is the environment-returned license; the 9-episode eval license is demo-only.

9. Add focused tests:
   - `server/env/gym.test.ts`: reset observation includes `visibleRiskScore` but not hidden answer fields.
   - `server/env/gym.test.ts`: a configured InsForge insert for `agentId: "mock-reference"` persists `mock/mock` provenance.
   - `server/env/gym.test.ts`: a configured InsForge insert for `agentId: "nebius-reference"` persists `nebius/nebius` provenance.
   - `src/gymClient.test.ts`: `observationToMockView` uses only gym observation fields and includes `visibleRiskScore`.
   - `src/gymClient.test.ts`: gym license adapter maps level/stats into `LicenseState`.

## Acceptance criteria

- Mock policy decisions for the primary `/v1` path are made from reset observation data, not the local scenario registry.
- Nebius proposal failure does not step or persist an episode signed as `nebius-reference`.
- Gym audit rows for mock and Nebius reference agents preserve concrete `mock` / `nebius` provenance instead of generic `external`.
- Unknown external `agentId`s still persist as `external/external`.
- The main license chip and license summary show the latest `/v1` step license after a gym run.
- The 9-episode eval remains clearly demo-only and does not masquerade as the authoritative gym license.
- Step request body remains exactly `{ action }`.

## Gates

```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
