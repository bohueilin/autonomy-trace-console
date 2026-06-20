## Objective
Close the public provenance-forgery hole for the GOAL “One evidence schema” checkbox while keeping `/v1` reset/step as the canonical gym boundary.

## Scope
Change only these files:
- `server/env/episodeToken.ts`
- `server/env/episodeToken.test.ts`
- `server/env/gym.ts`
- `server/env/gym.test.ts`
- `server/main.ts`
- `server/app.ts` (new, if needed to make Hono routes testable without starting the listener)
- `server/app.test.ts` (new)
- `server/referenceAgent.ts` (new, if useful for server-owned mock/Nebius reference execution)
- `src/gymClient.ts`
- `src/gymClient.test.ts`
- `src/App.tsx`
- `src/types.ts`
- `README.md`

Do NOT touch verifier semantics, reward/license math, scenario contents, digest field list, InsForge store helpers, Vapi handlers, migrations, or `/api/run-episode` legacy behavior.

## Steps
1. Add signed provenance to episode tokens.
   - Extend `EpisodePayload` with a server-controlled provenance field, e.g. `policySource: "external" | "mock" | "nebius"`.
   - `verifyEpisode` must validate that field when present and treat older/missing tokens as `external` only if needed for compatibility.
   - Durable provenance in `stepEpisode` must come from this signed field, not from `agentId`.

2. Reserve trusted reference identities.
   - `mock-reference` and `nebius-reference` must not be trust-bearing through the public reset path.
   - Public `POST /v1/episodes` must reject `agentId: "mock-reference"` and `agentId: "nebius-reference"` with `400`, or force them to signed `external`; prefer rejection because it makes misuse obvious.
   - Normal external agents may still pass arbitrary non-reserved `agentId`s, but their signed provenance must be `external`.

3. Add an explicit server-owned reference-agent path.
   - Add `POST /v1/reference-episodes` accepting only `{ scenarioId, mode }`, where `mode` is `"mock"` or `"nebius"`.
   - This route must internally call the gym reset/step flow; it must not compute verifier/reward/license outside `stepEpisode`.
   - Mock mode: trusted reset signed with `policySource: "mock"` and `agentId: "mock-reference"`, propose using the mock policy from the returned observation, then step with `{ action }`.
   - Nebius mode: trusted reset signed with `policySource: "nebius"` and `agentId: "nebius-reference"`, call Nebius using only the returned observation/model view, then step with `{ action }`.
   - Nebius fallback: do not step the Nebius episode. Open a fresh trusted mock reset and step that. Response must make fallback explicit and show `actualPolicySource: "mock"`.

4. Make `/v1` step strict at the HTTP boundary.
   - `POST /v1/episodes/:episodeId/step` must accept exactly `{ action }`; reject unknown keys such as `confidence`, `rationale`, `reward`, `license`, `passed`, `episodeId`.
   - `POST /v1/step` must accept exactly `{ episodeId, action }`; reject any extra keys.
   - Remove `confidence` and `rationale` from the public `StepInput` contract, or ensure `stepEpisode` never reads them from public input.
   - Gym audit rows must use deterministic server defaults for `rationale`, `requested_info`, and `confidence`; public clients must not be able to write those digest-covered fields through `/v1`.

5. Refactor Hono app creation only as much as needed for route tests.
   - If importing `server/main.ts` starts the listener, move route construction into `server/app.ts` as `createApp(config)`.
   - Keep `server/main.ts` as the thin `loadConfig()` + warnings + `serve({ fetch: app.fetch, port })` entrypoint.
   - Route behavior must remain unchanged except for the strict reset/step/reference-agent changes above.

6. Update the frontend primary gym path.
   - `src/App.tsx` must stop calling `resetGymEpisode(..., "mock-reference" | "nebius-reference")` from the browser.
   - Add a client helper for `POST /v1/reference-episodes`.
   - The primary “Run Gym Episode” button should use this server-owned reference endpoint for mock/Nebius modes.
   - Keep public `resetGymEpisode` / `stepGymEpisode` helpers available for external gym clients, but their tests/docs must reflect that reserved reference IDs are rejected.

7. Update README trust-boundary wording.
   - Public `/v1/episodes` is for external agents and cannot mint trusted `mock`/`nebius` provenance.
   - `/v1/reference-episodes` is server-owned and is the only path that can produce trusted reference-agent provenance.
   - `/v1` step bodies are server-enforced as exactly `{ action }` or `{ episodeId, action }`.

## Acceptance criteria
- A public caller cannot persist `requested_policy_mode: "mock"` or `"nebius"` by sending `agentId: "mock-reference"` or `"nebius-reference"` to `/v1/episodes`.
- Durable gym provenance is derived from a signed server-controlled token field, not raw public `agentId`.
- The server-owned reference path persists `mock/mock` for mock runs and `nebius/nebius` only when Nebius actually returns an action.
- Nebius fallback persists only a fresh `mock/mock` episode and never steps a `nebius-reference` episode.
- Public step routes reject extra fields including `confidence` and `rationale`.
- Existing deterministic verifier/license behavior is unchanged.
- The primary UI still runs one reference gym episode end-to-end.

## Gates
```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
