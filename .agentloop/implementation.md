All four gates pass (build → lint → verify:evidence → test, 66 tests). Here's the implementation report.

---

## Implementation report — Round 11: close provenance-forgery hole, strict `/v1` boundary

### Files changed
- **`server/env/episodeToken.ts`** — Added `EpisodePolicySource` (`external|mock|nebius`) and a signed `policySource` field to `EpisodePayload`. `verifyEpisode` validates it and defaults missing/invalid (pre-provenance) tokens to `external`, so an old token can never carry trusted attribution.
- **`server/env/gym.ts`** —
  - Reserved `mock-reference`/`nebius-reference` (`RESERVED_AGENT_IDS`); public `resetEpisode` now **rejects** them with `bad_request` and always signs `external`.
  - Added server-only `resetReferenceEpisode(scenarioId, 'mock'|'nebius', cfg)` — the only minter of trusted `policySource`. Shared scenario resolution (`pickScenario`) and signing (`buildReset`).
  - Durable provenance now derives from `payload.policySource` (`provenanceForSource`), not `agentId`. Removed `provenanceForAgent` + `clamp01`.
  - `StepInput` dropped `confidence`/`rationale`; audit rows now write deterministic defaults (`rationale:''`, `requested_info:''`, `confidence:0.5`). Exported `GymStepSuccess`.
- **`server/referenceAgent.ts`** (new) — `runReferenceEpisode({scenarioId,mode}, {gym,nebius})`. Mock: trusted reset → `decide` → step. Nebius: trusted reset → server-side `handleNebiusAction` → step only on success; on failure **does not step** the nebius episode, opens a fresh trusted mock episode (`fallback:true`, `actualPolicySource:'mock'`).
- **`server/app.ts`** (new) — `createApp(config)` owns the route table (no listener). Strict step validation: `/v1/episodes/:episodeId/step` accepts exactly `{action}`, `/v1/step` exactly `{episodeId,action}`, extra keys → 400. New `POST /v1/reference-episodes`.
- **`server/main.ts`** — slimmed to load config + `serve(createApp(config))`.
- **`src/gymClient.ts`** — added `runReferenceGymEpisode(scenarioId, mode)`; kept public `resetGymEpisode`/`stepGymEpisode` for external clients.
- **`src/App.tsx`** — primary button now calls the server-owned reference endpoint (browser sends only `{scenarioId,mode}`); removed browser-side Nebius/reset/step orchestration and now-unused imports.
- **`src/types.ts`** — added `GymReferenceResult`.
- **Tests**: `episodeToken.test.ts` (policySource round-trip + legacy default), `gym.test.ts` (reserved-ID rejection, trusted reference provenance via `resetReferenceEpisode`, public reset stays `external`, deterministic audit defaults), `app.test.ts` (new — route-level trust boundary + reference path + Nebius fallback), `gymClient.test.ts` (reference helper + external agentId).
- **`README.md`** — documented public vs server-owned `/v1` paths, signed-`policySource` provenance, strict step bodies; updated file table + route-owner references to `server/app.ts`.

### Gate results — all pass
- `npm run build` ✅ · `npm run lint` ✅ · `npm run verify:evidence` ✅ (40/40) · `npm test` ✅ (66/66, 8 files) · `npm run gates` ✅

### Key decisions
- **Provenance source of truth is the signed `policySource`**, not `agentId` — fixes the P0 directly. Reference IDs are reserved and rejected on the public path (chosen rejection over silent-downgrade per design, since misuse becomes obvious).
- **Strict step enforced at the HTTP boundary** in `app.ts` (reject unknown keys) — closes the P1 where the route merged the whole body into `stepEpisode`.
- **All gym rows use deterministic server defaults** for rationale/requested_info/confidence (uniform, including the reference path) — `confidence:0.5` matches the prior effective default, so no digest drift; `verify:evidence` unaffected.
- **Nebius now runs server-side** inside the reference endpoint (it already had the key); the browser no longer calls `/api/nebius-action` for the gym path.

### Intentionally deferred / out of scope
- Did not touch verifier/reward/license math, digest field list, InsForge store, Vapi, migrations, or `/api/run-episode`.

### Open questions for Codex
- The legacy `POST /api/nebius-action` route still exists (used by `runEpisodeHandler` fallback paths and the legacy flow) but is no longer called by the gym UI path. Worth pruning the legacy `/api` Nebius/run-episode surface in a later round, or keep for the DoD "two evidence paths → unify" item?
- `model_name` on persisted gym rows still records `payload.agentId` (e.g. `mock-reference`, or an external agent's chosen string). It's digest-covered and not trust-bearing for provenance, but an external caller controls that label — acceptable, or should it be sanitized/namespaced for external agents?
