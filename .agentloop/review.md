## Review

Verdict: ACCEPT for this round’s change. The previous provenance-forgery hole is closed.

P0: none.

P1: Runtime body validation is still too loose on the new trusted reference route. `POST /v1/reference-episodes` only checks extra keys in `server/app.ts:119-131`, then `runReferenceEpisode` silently converts any non-string `scenarioId` to `undefined` in `server/referenceAgent.ts:102-110`. That means malformed trusted-reference requests can sample a random scenario instead of failing closed. Recommendation: add a shared `/v1` schema parser that rejects malformed JSON, non-object bodies, bad field types, empty IDs, and unknown scenarios before minting trusted reference provenance.

P2: README still contradicts the new primary path. It says the browser sends `{ scenarioId, agentId }` to `/v1/episodes` for primary gym runs in `README.md:315-318` and again in `README.md:341-345`, but the code now calls `runReferenceGymEpisode(scenario.id, mode)` from `src/App.tsx:97-99`, which posts `{ scenarioId, mode }` to `/v1/reference-episodes` in `src/gymClient.ts:43-51`. Recommendation: remove the stale reset/step wording from the demo script and canonical path section.

What is solid:
- Public reset rejects reserved reference IDs: `server/env/gym.ts:243-257`, tested in `server/app.test.ts:29-45`.
- Durable provenance comes from signed `policySource`, not `agentId`: `server/env/episodeToken.ts:24-33`, `server/env/gym.ts:451-455`.
- Step routes reject extra client-controlled digest fields: `server/app.ts:83-113`, tested in `server/app.test.ts:47-88`.
- Nebius fallback does not step the Nebius episode; it opens a fresh mock episode: `server/referenceAgent.ts:116-126`.
- Gates are honest for this scope: `.agentloop/gates.log` reports build, lint, `verify:evidence` 40/40, and 66/66 tests passing.

## Next design

Objective: Tighten `/v1` runtime schema validation and fix stale docs so the trusted reference boundary fails closed and the README matches the implemented architecture.

Scope:
- `server/app.ts`
- `server/referenceAgent.ts`
- `server/app.test.ts`
- `src/gymClient.test.ts` if needed
- `README.md`

Steps:
1. Add small local validators for `/v1` JSON bodies.
2. `POST /v1/reference-episodes` must require exactly `{ scenarioId, mode }` where `scenarioId` is a non-empty string and `mode` is `mock | nebius`.
3. Reject malformed JSON/non-object bodies with `400 bad_request` on strict `/v1` routes instead of silently treating them as `{}`.
4. Keep public `/v1/episodes` behavior unchanged unless the body is malformed or field types are invalid.
5. Add route tests for non-string `scenarioId`, missing `scenarioId`, malformed JSON, array body, and valid reference requests.
6. Update README lines that still describe the primary UI as browser-driven `/v1/episodes` reset/step.

Acceptance criteria:
- Malformed or mistyped `/v1/reference-episodes` requests cannot mint trusted mock/nebius provenance.
- Valid `{ scenarioId: "com-1", mode: "mock" | "nebius" }` still works.
- Public external reset/step behavior from this round remains intact.
- README consistently says the primary UI uses `POST /v1/reference-episodes`; public reset/step is for external agents.

Gates:
```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
