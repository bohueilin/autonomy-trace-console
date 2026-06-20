All gates green and no stale references. Implementation complete.

---

# Implementation report

## Summary
Made the `/v1` reset/step gym env the **primary** single-episode path. The browser now proposes an action with the selected reference agent and lets the environment verify, score, and license it — the client no longer runs the verifier/license for this path.

## Files changed
- **`src/types.ts`** — Added client-facing `/v1` shapes: `GymObservation`, `GymResetResult`, `GymStepInfo`, `GymRunLicense`, `GymStepResult`. No existing types touched.
- **`src/gymClient.ts`** *(new)* — Thin transport + pure mappers:
  - `resetGymEpisode(scenarioId, agentId)` → `POST /v1/episodes` with body **only** `{ scenarioId, agentId }`.
  - `stepGymEpisode(episodeId, action)` → `POST /v1/episodes/:episodeId/step` with body **only** `{ action }`.
  - `observationToModelView(obs)` → maps the reset observation to a `ModelPolicyView` for Nebius.
  - `buildGymTrace(scenario, decision, step, provenance)` → builds the displayed `Trace` purely from the `/v1` step result (`authority: 'server_authoritative_episode'`, verifier verdict/reward/`licenseSignal` all from `info`/`reward`). Verifier `checks` are synthesized from the env response (not a re-run).
- **`src/gymClient.test.ts`** *(new)* — Vitest covering: reset body is exactly `{ scenarioId, agentId }`; **step body is exactly `{ action }`** (asserts `Object.keys === ['action']`); `ok:false` throws.
- **`src/App.tsx`** — Replaced `decideFor`/`runEpisode`/`runServerEpisode` with `runGymEpisode` (reset → propose → step → render). Primary button now calls it (label "Run Gym Episode" / "Run 1 Nebius Gym Episode"). Removed the separate "Run Server Episode" (`/api/run-episode`) button and the `postServerEpisode`/`toModelView` imports. Persistence chip now reflects `step.persisted`; `/api/evidence/status` usage unchanged.
- **`README.md`** — `/v1` reset/step documented as canonical; `/api/run-episode` relabeled "legacy server-owned flow" / backward-compatibility only; top summary now lists InsForge read-back/rehydration as **implemented** (removed the "still deferred" claim); demo script steps 3–4 and the UI section updated to the gym buttons/flow; added a `gymClient.ts` row to the project layout.

## Key decisions
- **Reference agent only proposes.** Mock uses `decide(toMockView(scenario))` (the full local scenario supplies the mock-only `visibleRiskScore`); Nebius uses `observationToModelView(reset.observation)` so it acts on exactly what the env returned. On Nebius failure it falls back to mock and shows the existing banner.
- **Hidden risk for display** comes from the local `seedScenarios` copy already in the bundle — used only to reveal hidden risk *after* scoring, never to compute the verdict.
- **No `runId` threading.** Each primary click is an independent single-episode run (new server `runId`); the header license chip continues to aggregate the client trace list as before. Per-trace `licenseSignal` is derived from the `/v1` verdict.
- Kept `runFullEval` (9-episode mock client eval, `demo_client_trace`) and `buildTrace` untouched — out of scope.

## Gate results — all PASS
- `npm run build` — ✅ tsc + vite build clean.
- `npm run lint` — ✅ no warnings.
- `npm run verify:evidence` — ✅ ALL CHECKS PASSED (40 checks).
- `npm test` — ✅ 7 files, 43 tests (was 40; +3 from `gymClient.test.ts`).

## Acceptance criteria
- ✅ Primary button → exactly one `POST /v1/episodes` + one `POST /v1/episodes/:episodeId/step`.
- ✅ Step body is only `{ action }` (asserted in test).
- ✅ Primary trace tagged `server_authoritative_episode`.
- ✅ Browser computes no verifier/license for the primary path.
- ✅ `/api/run-episode` no longer presented as canonical (button removed; README relabeled legacy).
- ✅ README no longer claims InsForge read-back/rehydration is deferred.
- ✅ Evidence/digest/fail-closed behavior unchanged (server untouched).

## Intentionally deferred
- Nothing in scope deferred.

## Open questions for Codex
1. **Dev-mode evidence visibility:** With InsForge unconfigured, `/v1` episodes persist to the gym's in-memory `devRunStore`, while `/api/evidence/status` reads the `runEpisodeHandler` memory + InsForge — so dev-only `/v1` episodes won't appear in the Evidence panel unless InsForge is configured. The persistence chip correctly shows `local_only`. Unifying the two in-memory dev stores would close this gap but touches server evidence wiring (explicitly out of this round's scope). Want this next?
2. **`serverEpisodeClient.ts` now exports `runServerEpisode`/`fetchRecentRuns` that the UI no longer calls** (only `fetchEvidenceStatus` is used). Left in place for the legacy `/api/run-episode` path. Remove them in a future cleanup round, or keep as the documented legacy client?
3. **Header license chip** still aggregates the mixed client trace list via `computeLicense(traces)` (summation, not verifier re-run). Acceptable for the demo; if you want the chip to reflect the server-authoritative run license instead, that's a follow-up design decision.
