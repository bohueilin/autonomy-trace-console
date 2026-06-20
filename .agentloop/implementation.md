All gates green. Here's the implementation report.

---

## Implementation report — Round 10

Implemented `design.md` exactly: made `/v1` gym evidence and the visible license authoritative for reference-agent runs.

### Files changed
- **`server/env/gym.ts`** — Added `visibleRiskScore: number` to the server `Observation` shape and returned `scenario.visibleRiskScore` from `resetEpisode` (hidden fields stay excluded because the observation is built only from listed fields). Added a `provenanceForAgent(agentId)` helper that derives durable provenance from the signed reset `agentId` (`mock-reference`→`mock/mock`, `nebius-reference`→`nebius/nebius`, else `external/external`) and used it for `requested_policy_mode` / `actual_policy_source` in `auditRow`. `fallback: false` / `fallback_code: null` unchanged; step request body still only `{ action }`.
- **`src/types.ts`** — Mirrored `visibleRiskScore: number` onto `GymObservation`.
- **`src/gymClient.ts`** — Added `observationToMockView(obs)` (builds `MockPolicyView` from reset observation fields only, incl. `visibleRiskScore`); kept `observationToModelView` omitting it. Added pure `gymLicenseToState(GymRunLicense): LicenseState` adapter.
- **`src/App.tsx`** — Mock proposer now uses `observationToMockView(reset.observation)` (normal + fallback). Nebius fallback opens a **fresh `mock-reference` reset** and steps only that, so no `nebius-reference` episode is stepped/persisted. Added `gymLicense` state set from the `/v1` step license (headline chip + `LicenseSummary` render it); `runFullEval` and `reset` clear it so the 9-episode demo stays demo-only.
- **`README.md`** — Replaced the stale "Run Server Episode / Run Episode" table rows with the current `/v1` gym button and mock 9-episode demo; documented the fresh mock-reference fallback and that the headline license after a gym run is environment-returned (9-episode eval is demo-only).
- **`server/env/gym.test.ts`** — reset observation includes `visibleRiskScore` and excludes hidden fields; configured-InsForge inserts persist `mock/mock`, `nebius/nebius`, and (extra) `external/external` provenance.
- **`src/gymClient.test.ts`** — `observationToMockView` uses only gym observation fields incl. `visibleRiskScore`; `gymLicenseToState` maps level/stats into `LicenseState` (+ L0 fallback for unknown level).

### Key decisions
- 9-episode eval **clears** `gymLicense` (the "clear" option in the plan) rather than adding a visual label; displayed `license = gymLicense ?? traceLicense`, so the demo can't overwrite the authoritative gym license.
- Added a small extra `external/external` provenance test (covers the acceptance criterion for unknown `agentId`s); within the spirit of the provenance steps, no scope expansion.

### Gate results — all pass
- `npm run build` ✅ (tsc -b + vite)
- `npm run lint` ✅ (eslint clean)
- `npm run verify:evidence` ✅ (40/40, incl. legacy `external` provenance checks unaffected)
- `npm test` ✅ (7 files, 49 tests)
- `npm run gates` ✅

### Deferred / open questions for Codex
- The header chip and `LicenseSummary` now show the run-scoped `/v1` license, while the Evidence panel still shows the global server run history — these can legitimately differ after a fresh run. Left as-is per "keep the evidence panel's server license unchanged"; flag if you'd prefer a visible "run-scoped vs global" label.
- No new dedicated demo-only badge on the 9-episode license beyond clearing the gym license. If you want an explicit UI label, that's a small follow-up.
